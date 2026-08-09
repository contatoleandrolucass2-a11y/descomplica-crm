# Diferenças e baseline de reconciliação

## Estado observado

| Grupo                      | Versões                                                                | Consequência                                                                              |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Comuns                     | 13 migrations até `20260807001159`                                     | Histórico alinhado por versão                                                             |
| Somente remotas            | `20260808235856`, `20260809004414`, `20260809010942`, `20260809031936` | Grants/RPC/developments Qlik existem apenas remotamente                                   |
| Somente locais no SHA-base | `20260807185611`, `20260808174817`, `20260809024000`                   | Contrato Qlik seguro, motivos sensíveis e catálogo visual ainda não aplicados remotamente |

## Quatro migrations somente remotas

| Versão           | Statements SHA-256                                                 | Efeito observado                                | Tratamento proposto                             |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------- |
| `20260808235856` | `11070628523162b3dca78628a26d060ceda092afbcfcf18a3a1b420357673d0b` | CRUD direto de `service_role` no Qlik           | Substituir por RPC específica depois do cutover |
| `20260809004414` | `dbb139eedb24d2527e92d8dd6e4d326047237f845945bfe81b297ba643042af7` | RPC Qlik legada com verifier em argumento       | Não copiar; remover no estado final             |
| `20260809010942` | `27fc899b0f784238ab9812052270c905cdbdbd20e754eeaea9cd569a2e0b23c5` | Ajuste de EXECUTE ainda mantém `anon`           | Revogar somente após migrar caller ativo        |
| `20260809031936` | `c01b7dd375839d776fd8d7cf09b24d6e32c603ec7bca78f7636c51222143e4d0` | Developments, contagem, grants e policy anônima | Preservar schema/dados; fechar ACL/policy       |

Os hashes são dos arrays de statements recuperados do histórico remoto, não
de arquivos SQL históricos reconstruídos.

## Três migrations somente locais no SHA-base

| Versão           | Arquivo SHA-256                                                    | Situação                                               |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `20260807185611` | `30b375f7199574a4a897dc231e7a3b24522487cbc5027107586522b4a2d58355` | RPC Qlik segura v1, mas originalmente sem developments |
| `20260808174817` | `0d7f29e4fb40397906f0af6e7bb2b13b82ddd0370400da441b81ae69ca694217` | Motivo obrigatório para mudanças sensíveis             |
| `20260809024000` | `361aa17cbc3015dc0b1019d80db9ac7143316d9e1e14b54c7c99fb45c8658696` | Catálogo visual de simuladores, sem motores            |

Aplicar as três migrations locais isoladamente seria incorreto: o hardening
Qlik anterior conhecia somente runs/entries e não fecharia developments/RPC
legada do remoto.

## Baseline proposta

As migrations novas são convergentes e determinísticas sobre a união conhecida.
Elas preservam tabelas e linhas Qlik existentes, mas removem grants/policies de
tabela e eliminam a RPC legada. Por isso, a migration Qlik só pode ser aplicada
depois do cutover validado, e o rollback não pode ser descrito como simples
remoção de objetos novos.

1. `20260809144137_pending_onboarding_scope_foundation.sql`
   - cadastro `pending`, inativo e sem permissão;
   - estados `approved`, `suspended` e `legacy_review`;
   - organizações, pessoas, equipes, carteiras, identidades estáveis e escopos;
   - aprovação atômica e auditada;
   - negação por padrão e guards de mutação por escopo;
   - fronteiras imutáveis, locks concorrentes e manutenção de topologia somente
     com usuários afetados suspensos;
   - aprovação/reativação Master ou Admin, cardinalidade central e revalidação
     após locks.
2. `20260809144143_qlik_rls_contract_hardening.sql`
   - converge developments e sua contagem sem apagar dados;
   - remove acesso direto Data API/service role às três tabelas;
   - remove as policies Qlik legadas e elimina a RPC legada somente depois do
     cutover;
   - mantém ingestão transacional por RPC específica;
   - oferece leitura autenticada somente quando identidade Qlik e organização
     estão mapeadas a um escopo autorizado.

Os read models v2 de dashboard, ranking, metas e pontos continuam globais. A
foundation não finge escopo dimensional nesses dados. O futuro v3 deve carregar
`reporting_scope_id` no snapshot e na ingestão antes de habilitar filtros ou
policies dimensionais.

## Gate remoto obrigatório

1. aprovação deste PR e das decisões de papel/escopo;
2. backup novo e restore de ensaio;
3. identificação formal do caller Qlik;
4. migração do caller para a RPC segura e prova de idempotência;
5. reconciliação de usuários `legacy_review` e identidades por IDs estáveis;
6. execução dry-run/diff em homologação;
7. pgTAP, contrato e rollback ensaiados;
8. autorização explícita para migration remota.

Sem esses oito itens, a baseline permanece somente local. Preservação de dados
não significa preservação de ACL, policy ou interface RPC insegura.
