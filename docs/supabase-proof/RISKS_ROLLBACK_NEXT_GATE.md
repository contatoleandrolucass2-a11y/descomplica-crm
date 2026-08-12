# Riscos, rollback e próximo gate

## Riscos abertos

| Severidade | Risco                                                                 | Controle atual                                                                                                                                          |
| ---------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0         | Signup remoto cria acesso comercial ativo                             | Migration local pending; nenhuma aplicação remota ainda                                                                                                 |
| P0         | Qlik remoto legível e publicável por `anon`                           | Estado final versionado; caller precisa cutover antes de revogar                                                                                        |
| P0         | Owner operacional/backup e leitores Qlik residuais não resolvidos     | Caller técnico identificado; relay continua off e migration remota bloqueada                                                                            |
| P1         | Usuários existentes não possuem IDs/escopos reconciliados             | `legacy_review` fail-closed; plano de reconciliação obrigatório                                                                                         |
| P1         | Read models v2 são globais                                            | Nenhum filtro dimensional habilitado; v3 pendente                                                                                                       |
| P1         | Default ACL de `supabase_admin` pode abrir objetos futuros do Studio  | Evitar DDL manual; revisar defaults em migration própria                                                                                                |
| P1         | Funções `SECURITY DEFINER` e leaked-password protection               | Revisão individual e configuração de Auth em gate separado                                                                                              |
| P1         | Grants delegados ainda não registram ancestral nem revogam em cascata | Delegação não-Master exige caminho persistente e contido; reconciliar descendentes antes de revogar grant do delegador; modelar lineage no próximo gate |
| P1         | Topologia confiável não possui UI/RPC administrativa                  | Escrita permanece owner/migration-only; protocolo suspender→mudar→reativar e revisão humana obrigatórios                                                |
| P2         | Versões local/remoto de Auth/Storage diferem levemente                | Restore validou schema/contagens; ensaio novo antes de rollout                                                                                          |
| P2         | Regras comerciais não têm política oficial                            | Engines, roleta e prêmios continuam bloqueados                                                                                                          |

## Rollback proposto

- Onboarding: restaurar funções/policies anteriores somente por migration de
  rollback revisada; preservar colunas e audit logs para não perder evidência.
- Escopos: desabilitar nova RPC de aprovação e retornar contas afetadas a
  `legacy_review`; não apagar grants/auditoria.
- Qlik: abortar antes da revogação se o caller não passar contrato. Depois do
  cutover, rollback pode restaurar temporariamente EXECUTE da RPC anterior
  apenas ao role M2M identificado, nunca a `anon` e nunca com verifier em Git.
- Dados: migrations propostas convergem a estrutura e preservam as três tabelas
  Qlik e suas linhas. Não há `DROP TABLE` ou truncamento, mas policies/grants
  inseguros e a RPC legada são removidos após o cutover; rollback exige migration
  explícita e não deve restaurar exposição pública.

## Próximo gate

O próximo gate não é deploy. É revisão humana deste PR draft, decisão dos
papéis/escopos, identificação do caller Qlik, aprovação das decisões comerciais
e ensaio em homologação autorizada. O ensaio também deve reconciliar grants
descendentes antes de qualquer revogação de delegador e definir owner para
`crm_source_identities` e demais mappings de topologia. Migration remota, merge
e deploy continuam fora de escopo.
