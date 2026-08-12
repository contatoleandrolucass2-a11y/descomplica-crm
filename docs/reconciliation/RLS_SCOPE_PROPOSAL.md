# Proposta de RLS e escopos comerciais

## Limite deste gate

Esta é uma proposta local, sem migration executável e sem alteração remota. O
schema atual autoriza por capacidade (`has_permission`), mas os read models são
globais e não carregam IDs suficientes para impor organização, equipe, carteira
ou autoria. Adicionar filtros apenas na interface deixaria os dados globais
acessíveis e, portanto, está proibido.

## Estado comprovado

- As 21 tabelas públicas remotas têm RLS habilitada, mas nenhuma usa
  `FORCE ROW LEVEL SECURITY`.
- Os read models de dashboard e ranking usam policies por permissão, sem
  predicado de escopo comercial.
- `crm_ranking_participants` guarda nomes e uma chave derivada do corretor, mas
  não guarda IDs estáveis de pessoa, equipe ou organização.
- Os snapshots de dashboard não guardam escopo; qualquer usuário com
  `crm.dashboard.view` lê a mesma base global.
- O papel técnico `user` herda dashboard, etapas e ranking.
- O cadastro público chama `signUp`; o trigger atual cria perfil ativo e atribui
  `user`. Se o cadastro estiver habilitado no projeto, uma nova conta
  autenticada alcança snapshots globais. O risco é P0.
- As três tabelas Qlik remotas permitem `SELECT` a `anon`; isso está detalhado no
  [dump sanitizado](REMOTE_SCHEMA_SANITIZED.md).
- Não existem relações versionadas entre usuário Auth, identidade Salesforce,
  identidade Qlik, organização, equipe ou carteira.

RLS habilitada, sozinha, não garante isolamento: a policy precisa negar o papel
e o escopo incorretos. A proposta abaixo é deny-by-default.

## Vocabulário pendente

| Perfil pedido      | Representação atual                   | Lacuna                                                                  |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------- |
| Master             | `master`                              | Global por desenho atual; manter break-glass auditado.                  |
| Admin              | `admin`                               | Hoje global por nível; falta decidir global ou organizações explícitas. |
| Coordenador        | `coordinator`                         | Existe, mas sem carteiras ou equipes associadas.                        |
| Gerente            | `supervisor` e `broker_lead`          | Duas chaves plausíveis; relação oficial não localizada.                 |
| Corretor           | `broker`                              | Sem vínculo estável com pessoa Salesforce.                              |
| Imobiliária        | `real_estate`                         | Sem vínculo com organização Qlik/Salesforce.                            |
| House              | inexistente                           | Pode ser tipo de organização ou papel; exige decisão.                   |
| Canal de Parcerias | página/perfil de relatório, não papel | Pode ser carteira ou organização; exige decisão.                        |

Até essas decisões serem tomadas, nenhum alias deve ser inferido em migration.

## Modelo proposto

### Identidade e estrutura

| Objeto                         | Finalidade mínima                               | Regras                                                            |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------- |
| `crm_organizations`            | Empresas, imobiliárias e Houses                 | `id uuid`, tipo controlado, chave oficial, status e vigência.     |
| `crm_people`                   | Pessoas comerciais independentes de Auth        | `id uuid`, `auth_user_id` opcional e único, status e vigência.    |
| `crm_source_identities`        | Liga IDs Salesforce/Qlik a pessoas/organizações | Fonte + tipo + ID externo únicos; conflito vai para quarentena.   |
| `crm_teams`                    | Equipes pertencentes a uma organização          | Gerente/coordenador por relações vigentes, nunca por nome.        |
| `crm_team_memberships`         | Participação temporal de pessoa na equipe       | Intervalo `[valid_from, valid_until)`; sem sobreposição inválida. |
| `crm_portfolios`               | Carteiras de organizações/equipes               | Tipo controlado e vigência.                                       |
| `crm_portfolio_organizations`  | Organizações dentro de carteira                 | Relação temporal auditada.                                        |
| `crm_user_organization_scopes` | Escopos explícitos de usuário                   | Concessão/revogação por RPC administrativa e com motivo.          |
| `crm_user_team_scopes`         | Equipes explícitas                              | Mesmas regras de auditoria e vigência.                            |
| `crm_user_portfolio_scopes`    | Carteiras explícitas                            | Mesmas regras de auditoria e vigência.                            |
| `crm_reporting_scopes`         | Identidade única de agregado                    | Tipos `global`, `organization`, `team`, `portfolio`, `person`.    |

Todas as FKs de fonte devem usar IDs estáveis. Nome é atributo apresentacional,
nunca chave de autorização. Identidade ausente, ambígua, inativa ou expirada
resulta em zero linha visível e registro de reconciliação, não em fallback
global.

### Read models

Uma próxima versão dos read models deve incluir `reporting_scope_id` em cada
snapshot e agregado. O produtor deve emitir agregados por escopo já reconciliado:

- dashboard: global, organização, equipe, carteira e pessoa, quando permitidos;
- ranking: `person_id`, `team_id`, `organization_id` e competência;
- Qlik: `organization_id` para imobiliária e, se oficial, unidade/empreendimento;
- filtros: somente dimensões presentes no mesmo escopo autorizado.

Não se deve filtrar um snapshot global no cliente nem criar uma policy baseada
em nomes. Uma linha histórica sem ID oficial fica em quarentena e visível apenas
ao Master durante a reconciliação, se essa exceção for aprovada.

### Helpers privados

Funções como `private.can_read_reporting_scope(uuid)` e
`private.can_manage_target(uuid)` devem:

- ser `SECURITY DEFINER`, ter `search_path = ''` e referenciar objetos
  qualificados;
- validar `auth.uid()`, perfil ativo, papel, vigência e escopo;
- não receber `EXECUTE` de `PUBLIC`, `anon` ou `service_role`;
- receber de `authenticated` somente `USAGE` no schema privado e `EXECUTE` nas
  assinaturas chamadas por policies; sem acesso às tabelas privadas;
- ser chamadas somente por policies/RPCs versionadas e ter esses grants mínimos
  cobertos por pgTAP;
- negar em qualquer ausência, erro ou identidade ambígua.

## Matriz de acesso-alvo

Esta matriz descreve o modelo seguro; células marcadas “decisão” não podem virar
SQL antes da resposta oficial.

| Perfil             | Leitura de dados                           | Próprio usuário/gerente/coordenador             | Escrita administrativa         | Auditoria/configurações                          | Ranking                       | Simulações salvas                         |
| ------------------ | ------------------------------------------ | ----------------------------------------------- | ------------------------------ | ------------------------------------------------ | ----------------------------- | ----------------------------------------- |
| Master             | Global                                     | Todos                                           | Hierarquia inferior            | Global, com motivo                               | Global                        | Política de break-glass a decidir         |
| Admin              | Organizações explícitas ou global, decisão | Dentro do escopo                                | Hierarquia e escopo inferiores | Mesmo escopo                                     | Mesmo escopo                  | Mesmo escopo; acesso excepcional auditado |
| Coordenador        | Carteiras/equipes explícitas               | Gerentes e corretores subordinados vigentes     | Nenhuma por padrão             | Sem configuração por padrão                      | Carteira/equipe               | Próprias; compartilhamento a decidir      |
| Gerente            | Equipes explícitas                         | Próprio gerente e corretores da equipe          | Nenhuma                        | Nenhuma                                          | Equipe e próprio              | Próprias                                  |
| Corretor           | Pessoa vinculada                           | Somente próprio                                 | Nenhuma                        | Nenhuma                                          | Próprio; comparação a decidir | Próprias                                  |
| Imobiliária        | Organização vinculada                      | Pessoas da própria organização conforme decisão | Nenhuma                        | Nenhuma                                          | Própria organização           | Próprias                                  |
| House              | Organização House, se aprovado             | Própria organização                             | Nenhuma                        | Nenhuma                                          | Própria organização           | Próprias                                  |
| Canal de Parcerias | Carteira explícita, se aprovado            | Somente carteira                                | Nenhuma                        | Metas do canal somente com capacidade específica | Carteira                      | Próprias                                  |

Múltiplos escopos devem ser unidos somente se essa semântica for aprovada. Uma
concessão mais ampla nunca pode ser inferida do nível numérico do papel.

## Auditoria e configurações

- Conceder/revogar escopo, trocar papel, ativar conta e usar break-glass exige
  ator, motivo, alvo, before/after, timestamp e request ID.
- Tentativas negadas precisam de destino operacional definido; o log de
  auditoria atual registra mutações bem-sucedidas, não todas as negações.
- Metas, pesos, políticas e campanhas devem ser versões imutáveis com vigência,
  autor e status de aprovação; o singleton mutável atual não é autoridade
  histórica suficiente.
- Simulações futuras devem ter `owner_user_id`, `reporting_scope_id`, política
  versionada e payload privado. Por padrão, só o autor lê; retenção,
  compartilhamento e break-glass dependem de decisão oficial.

## Ordem futura de migrations

1. Fechar cadastro público ou mudar o provisionamento para pendente/inativo,
   após decisão de onboarding.
2. Criar identidades, organizações, equipes, carteiras e vínculos temporais,
   sem alterar read models existentes.
3. Importar e reconciliar IDs oficiais em tabelas de quarentena; conflitos
   falham fechados.
4. Criar escopos de usuário e helpers privados, sem grants externos.
5. Criar read models v3 com `reporting_scope_id` e contratos de produtor v3.
6. Fazer dupla validação local entre totais globais conciliados e soma dos
   escopos, sem liberar filtros.
7. Trocar leituras/RPCs para v3 e ativar policies deny-by-default.
8. Remover grants, policies e read models globais antigos somente depois de
   backup restaurado, rollback e autorização explícita.

Cada etapa deve ser uma migration pequena, reversível por migration posterior e
acompanhada por pgTAP. Não será usado `migration repair` como substituto de DDL.

## Matriz mínima de testes

| Classe        | Casos obrigatórios                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Positivo      | Cada perfil lê exatamente organização/equipe/carteira/pessoa concedida e páginas permitidas.                                |
| Negativo      | `anon`, conta sem perfil, inativa, pendente, vínculo expirado e identidade não conciliada leem zero.                        |
| Horizontal    | Corretor A não lê B; gerente A não lê equipe B; imobiliária A não lê B; carteiras não vazam entre si.                       |
| Vertical      | Perfil inferior não atribui papel/escopo superior, não altera configuração e não lê auditoria superior.                     |
| Manipulação   | Trocar IDs, query strings, cookies, JWT claims não autoritativas ou body da RPC não amplia escopo.                          |
| Ciclo de vida | Convite, ativação, mudança de equipe, revogação, expiração e desativação têm efeito imediato.                               |
| ACL           | Nenhuma tabela comercial aceita `anon`; tabelas Qlik não aceitam acesso direto de `service_role`; RPCs têm allowlist exata. |
| Configuração  | Versão futura não afeta período passado; publicação exige permissão e motivo; concorrência é detectada.                     |
| Simulações    | Autor lê a própria; pares e superiores não leem sem regra aprovada; payload não aparece em logs.                            |
| E2E           | Rotas e API retornam 401/403 sem revelar contagem; filtros oferecem apenas dimensões autorizadas.                           |

## Decisões necessárias antes do SQL

1. “Gerente” corresponde a `supervisor`, `broker_lead` ou a um novo papel?
2. House é tipo de organização, papel de usuário ou ambos?
3. Canal de Parcerias é carteira, organização ou tipo de usuário?
4. Admin continua global ou recebe organizações explícitas?
5. Corretores veem somente a própria posição ou também comparação anonimizada/
   completa do ranking?
6. Quais IDs oficiais ligam Auth, Salesforce e Qlik?
7. Cadastro público deve ser removido, virar convite ou criar conta pendente?
8. Usuário com múltiplos escopos recebe união simples ou existe prioridade?
9. Qual retenção, compartilhamento e break-glass valem para simulações salvas?
10. Onde tentativas negadas devem ser auditadas e por quanto tempo?
11. Dados históricos globais sem identidade ficam Master-only ou em quarentena
    sem leitura?
