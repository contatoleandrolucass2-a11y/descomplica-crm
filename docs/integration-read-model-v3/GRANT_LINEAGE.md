# Linhagem de grants de escopo comercial

## Estado desta entrega

Este documento descreve o contrato implementado **somente no código local** pela
migration `20260809181422_integration_identity_governance.sql` e consumido pelo
read model v3. Nenhuma migration foi aplicada remotamente, nenhum grant remoto
foi alterado e nenhum caller externo foi trocado.

O cutover continua bloqueado até que a cadeia histórica seja reconciliada, os
donos das integrações sejam comprovados, os testes obrigatórios passem e exista
autorização explícita para produção. A presença da migration no repositório não
prova que o contrato esteja ativo em qualquer ambiente remoto.

## Objetivo

Um grant em `crm_user_reporting_scope_grants` não é considerado suficiente, por
si só, para liberar o read model v3. Cada grant precisa de uma linhagem privada
que registre:

- qual grant efetivo permitiu a delegação;
- qual é a raiz da cadeia;
- quantos níveis existem entre a raiz e o beneficiário;
- o papel observado para o beneficiário;
- origem, finalidade, consumidor, responsável operacional e plano de rollback;
- se a cadeia depende de reconciliação.

O vínculo é por UUID. Nomes, nível numérico do papel e semelhança textual de
escopos não participam da autorização.

## Objetos implementados localmente

### `private.crm_reporting_scope_grant_lineage`

Existe uma linha por `grant_id`.

| Campo                     | Semântica implementada                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `grant_id`                | Grant beneficiário descrito pela linha.                                                                    |
| `parent_grant_id`         | Grant direto do concedente que continha o novo escopo e cobria toda a sua vigência. É nulo apenas em raiz. |
| `root_grant_id`           | Primeiro grant da cadeia. Em uma raiz, é igual a `grant_id`.                                               |
| `depth`                   | Raiz em `0`; filho direto em `1`; limite persistido de `8`.                                                |
| `request_id`              | Identificador gerado para a linha de linhagem. Não é hoje recebido de um comando externo.                  |
| `beneficiary_role_key`    | Fotografia operacional do papel atual do beneficiário; é atualizada quando `user_roles.role_key` muda.     |
| `grant_origin`            | `bootstrap`, `migration`, `delegated` ou `historical_backfill`.                                            |
| `purpose`                 | Motivo do grant original.                                                                                  |
| `consumer`                | Atualmente fixado em `authorization-scope`.                                                                |
| `owner_user_id`           | Usuário que concedeu o grant.                                                                              |
| `created_by_migration`    | Migration responsável quando aplicável.                                                                    |
| `maintenance_action`      | `retain`, `review`, `replace` ou `remove`. É metadado operacional, não revoga sozinho.                     |
| `rollback_plan`           | Orientação persistida para desfazer a concessão sem apagar evidência.                                      |
| `requires_reconciliation` | Quando verdadeiro, a cadeia falha fechada.                                                                 |

As FKs usam `ON DELETE RESTRICT`. A tabela fica no schema `private` e todo
acesso direto é revogado de `PUBLIC`, `anon`, `authenticated` e `service_role`.
Os índices locais atendem procura por pai e travessia por raiz/profundidade.

### Relação pai, raiz e profundidade

Uma cadeia válida tem a forma:

```text
raiz:  parent = null, root = grant_id, depth = 0
filho: parent = grant anterior, root = raiz, depth = parent.depth + 1
```

Na inserção de um grant delegado, o trigger procura grants do `granted_by` que:

- não estejam revogados;
- tenham iniciado até o começo do novo grant;
- cubram toda a janela do novo grant;
- já possuam linhagem sem reconciliação pendente;
- contenham o escopo filho segundo `private.reporting_scope_contains(...)`.

Quando mais de um pai atende ao contrato, a seleção prefere o mesmo escopo,
depois a cadeia mais profunda, o grant mais recente e, por fim, o UUID. A
linhagem é capturada apenas na inserção; ela não é recalculada ou reparenteada
automaticamente depois.

O predicado de contenção implementa estes casos:

- o mesmo escopo contém a si próprio;
- `global` contém qualquer escopo ativo;
- organização contém a própria organização, suas equipes ativas e pessoas com
  vínculo vigente nessas equipes;
- equipe contém a própria equipe e pessoas com vínculo vigente nela;
- carteira contém organizações vinculadas, suas equipes ativas e pessoas com
  vínculo vigente, respeitando as janelas temporais.

Não há inferência de contenção por nome.

## Raízes e delegações novas

O trigger trata um grant global autocedido como raiz. O motivo especial
`Master bootstrap global scope` o classifica como `bootstrap`; os demais casos
desse ramo são classificados como `migration`. As proteções já existentes sobre
papel, escopo e escrita administrativa continuam necessárias: a linhagem não é
uma API pública para criar raízes.

Para uma inserção autenticada sem pai efetivo, o trigger rejeita a operação com
`42501`. Uma sessão interna de migration pode registrar o caso como
`historical_backfill`, mas a linha nasce com `requires_reconciliation = true` e
`maintenance_action = review`.

## Reconciliação histórica

Na instalação local da migration, grants preexistentes recebem uma linha de
backfill:

- grant de papel `master` em escopo `global` somente quando é self-grant
  (`user_id = granted_by`) e traz o motivo exato
  `Master bootstrap global scope`: raiz `bootstrap`, profundidade zero, mantido
  e sem reconciliação;
- qualquer outro grant histórico: raiz de si mesmo, origem
  `historical_backfill`, ação `review` e reconciliação obrigatória.

Isso preserva a evidência anterior sem inventar um concedente. Um grant
histórico não-Master não se torna efetivo no v3 apenas porque existia antes da
migration.

Não existe, nesta entrega, RPC que conecte retroativamente uma linha histórica
a um pai. A reconciliação operacional deve criar uma concessão substituta por
um fluxo auditado e aprovado, então revogar a concessão antiga. Alterar
diretamente `parent_grant_id`, `root_grant_id` ou `requires_reconciliation` não
é um procedimento de cutover aprovado.

A fila `private.crm_identity_reconciliation_items` resolve identidades externas
de integrações. Ela é separada da reconciliação de linhagem de grants; resolver
um ID Salesforce ou Qlik não repara a ancestralidade de autorização.

## Cadeia efetiva

`private.reporting_scope_grant_lineage_is_effective(grant_id, instante)` sobe
recursivamente do grant consultado até a raiz, com no máximo oito saltos e nove
linhas. O resultado somente é verdadeiro quando:

- o grant consultado possui linhagem;
- todos os grants da cadeia estão dentro da vigência e não revogados;
- nenhuma linha exige reconciliação;
- todos os escopos existem e estão ativos;
- cada grant pai ainda contém o escopo do filho no instante consultado,
  revalidando memberships de equipe e carteira em todas as arestas;
- cada papel atual admite o tipo de escopo em `crm_role_scope_types`;
- todo ancestral possui perfil ativo e aprovado;
- a cadeia alcança uma raiz com `parent_grant_id` nulo, `root_grant_id` igual ao
  próprio grant e `depth = 0`;
- o total não ultrapassa nove linhas.

O read model acrescenta outras condições.
`private.can_read_crm_read_model_v3_scope` exige usuário autenticado com
papel/escopo válido, um grant direto exatamente para o escopo solicitado e a
cadeia efetiva; a função de dataset exige separadamente a permissão de funil,
ranking, parcerias ou estoque. Suspender, expirar ou revogar um ancestral torna
os descendentes inefetivos sem fallback para um escopo mais amplo.

## Limitações conhecidas

- A profundidade máxima é oito; não existe paginação ou cadeia arbitrariamente
  longa.
- `beneficiary_role_key` é uma fotografia atualizada, não um histórico imutável
  de todas as trocas de papel. O teste de efetividade usa `user_roles` atual.
- `request_id` da linhagem é gerado localmente e ainda não correlaciona um
  comando administrativo externo ponta a ponta.
- A topologia é capturada na inserção. Mudanças posteriores de vigência,
  revogação ou estrutura tornam a cadeia efetiva/inefetiva, mas não escolhem um
  novo pai.
- A função de contenção exige escopos ativos no momento da consulta e usa
  vínculos temporais no instante informado. Desativar um escopo pode retirar
  leituras históricas dependentes dele.
- Não há UI nem RPC de inspeção pública da linhagem; a evidência permanece
  privada.
- A migration não decide semântica de união de múltiplos escopos. O cliente v3
  exige a seleção de exatamente um escopo.
- A nova cadeia é exigida pelas leituras v3 e pela RPC Qlik escopada. Helpers
  v2 legados não foram globalmente reescritos nesta PR; por isso seus read
  models continuam Master-only e não podem ser usados como prova de lineage ou
  abertos a novos papéis.
- Metadados como `maintenance_action` e `rollback_plan` documentam intenção;
  não executam manutenção automaticamente.

## Manutenção e rollback

Rollback de autorização é revogação auditada, nunca exclusão física:

1. impedir novas delegações a partir do ramo;
2. identificar descendentes pelo índice de `parent_grant_id` ou
   `root_grant_id`;
3. revogar primeiro os grants folha e depois seus ancestrais, registrando ator,
   motivo e instante;
4. confirmar que `reporting_scope_grant_lineage_is_effective` passou a negar o
   ramo;
5. preservar grants e linhas de linhagem como evidência.

Revogar um ancestral já faz a cadeia falhar fechada, mas a ordem folha-primeiro
evita deixar descendentes operacionais sem plano explícito. Uma substituição
deve criar a nova cadeia aprovada antes de revogar a anterior e deve evitar
janelas sobrepostas não intencionais.

Rollback da migration em ambiente onde ela já tenha sido aplicada deve ser uma
nova migration revisada. O caminho conservador é retirar o uso da permissão/RPC
v3 e manter as tabelas privadas inertes; não apagar linhagem, histórico de
identidade ou evidência de reconciliação. Remoção física exige autorização
destrutiva separada.

## Gates antes do cutover

- reconciliar ou substituir todo `historical_backfill` que seria necessário ao
  acesso v3;
- comprovar que cada raiz é autorizada e que cada delegação cabe no pai durante
  toda a vigência;
- decidir e documentar os papéis oficiais e a semântica de múltiplos escopos;
- validar suspensão, expiração, revogação e troca de papel em pgTAP;
- manter `anon` e `service_role` sem acesso direto às tabelas privadas;
- executar `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`;
- obter autorização explícita antes de aplicar migrations ou alterar produção.

## Fontes locais do contrato

- `supabase/migrations/20260809181422_integration_identity_governance.sql`
- `supabase/migrations/20260809181424_crm_read_model_v3.sql`
- `supabase/tests/read_model_v3.test.sql`
- `supabase/tests/integration_identity_governance.test.sql`
- `lib/crm/read-model-v3/data.ts`
