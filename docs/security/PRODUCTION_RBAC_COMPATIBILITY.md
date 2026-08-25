# Compatibilidade RBAC produtiva do PR #49

## Escopo e método

Inventário capturado em 25 de agosto de 2026 usando somente consultas
`BEGIN TRANSACTION READ ONLY`, `supabase migration list --linked` e dump de schema sem
dados. Evidências não contêm e-mail, UUID, token, cookie, linha comercial ou segredo.
Nenhum objeto remoto foi alterado.

Objetivo: aplicar Auth, MFA e aceite legal sem importar fundações posteriores nem mudar
qualquer acesso já existente. A migration preserva as implementações de autorização
instaladas e as envolve com um gate de sessão/MFA. Em produção, isso conserva o modelo
legado. Em instalação limpa, conserva aprovação, escopos e fail-closed já existentes.

## Matriz produtiva observada

Produção contém 17 páginas ativas e zero overrides individuais.

| Papel produtivo | Usuários atribuídos | Páginas ativas | Contrato preservado                                                                      |
| --------------- | ------------------: | -------------: | ---------------------------------------------------------------------------------------- |
| `master`        |                   1 |             17 | catálogo produtivo completo                                                              |
| `admin`         |                   2 |             14 | Dashboard, etapas, Ranking, Configurações, `/admin`, `/admin/usuarios`, `/admin/paginas` |
| `coordinator`   |                   0 |              7 | Dashboard, cinco etapas e Ranking                                                        |
| `supervisor`    |                   0 |              7 | Dashboard, cinco etapas e Ranking                                                        |
| `real_estate`   |                   0 |              7 | Dashboard, cinco etapas e Ranking                                                        |
| `broker_lead`   |                   0 |              7 | Dashboard, cinco etapas e Ranking                                                        |
| `broker`        |                   0 |              7 | Dashboard, cinco etapas e Ranking                                                        |
| `user`          |                   0 |              7 | Dashboard, cinco etapas e Ranking                                                        |

Os papéis novos `manager`, `house`, `partnership_channel` e `pending` não existem no
schema produtivo atual. Continuam sem acesso herdado na instalação limpa. O PR não cria
esses papéis em produção.

Permissões produtivas observadas:

- `master`: 20 permissões, incluindo parcerias, simuladores e execução WF13;
- `admin`: 17 permissões, mantendo as 14 páginas herdadas;
- seis papéis operacionais legados: `crm.dashboard.view`, `crm.stages.view`,
  `crm.ranking.view` e `pages.view`;
- overrides: zero linhas no instante do inventário.

## Grants, RLS, funções e triggers

Estado anterior à migration candidata:

- 21 tabelas em `public`; todas com RLS habilitada;
- três tabelas Qlik com `FORCE ROW LEVEL SECURITY`;
- 17 policies permissivas em `public`;
- 14 grants de tabela para `authenticated`, todos `SELECT`;
- nenhum grant de tabela para `anon`, `service_role` ou `PUBLIC`;
- nove triggers não internos em `auth` e `public`;
- `profiles` possui somente `user_id`, `email`, `is_active`, `profile_completed`,
  `created_at` e `updated_at`; não possui `access_status`;
- helpers de aprovação, escopo, relay e motores não existem no baseline produtivo.

RPCs produtivas concedidas a `authenticated` permanecem inalteradas. Os helpers
`can_assign_role` e `can_grant_permission` não possuem `EXECUTE` direto em produção e o
PR não amplia esse grant.

## Estratégia standalone

`20260824230058_auth_mfa_legal_foundation.sql`:

1. exige os sete contratos RBAC mínimos já presentes desde a fundação de acesso;
2. preserva as definições exatas instaladas em funções privadas sem grants Data API;
3. substitui os mesmos OIDs públicos por wrappers de sessão/MFA;
4. não consulta `access_status`, helpers de aprovação, tabelas de escopo, relay ou
   motores;
5. recompõe de forma idempotente os 41 vínculos de `admin` e dos seis papéis
   operacionais já existentes em produção, sem alterar `master`;
6. adiciona policy restritiva a toda tabela `public` com RLS instalada;
7. falha se existir grant `authenticated` em tabela sem RLS ou se a cobertura não for
   exata;
8. cria somente ledger legal privado, funções de sessão/recovery e triggers legais;
9. não cria papéis ou permissões, não remove vínculos e não altera `app_pages`,
   `user_roles`, `user_permission_overrides` ou `profiles`.

O trigger de cadastro exige os Termos e a Política de Privacidade versionados durante a
criação do usuário. Não depende de um fluxo de aprovação ausente em produção.

`20260824230100_role_isolation_net_fail_closed.sql` não cria fundação de relay ou
motor. Na produção, onde os dois contratos opcionais não existem, ela não altera
estado. Numa instalação limpa, corrige somente o predicado conhecido que consultava o
schema opcional `net` por nome. Função presente com definição desconhecida reprova a
migration; função, papel ou schema ausente nunca é criado.

## Pós-condições obrigatórias do rehearsal

- no rehearsal fiel de produção, fingerprints de papéis, permissões, vínculos, páginas,
  usuários atribuídos e overrides idênticos antes/depois;
- na instalação limpa, os 41 vínculos de compatibilidade convergem para a matriz
  produtiva; `manager`, `house`, `partnership_channel` e `pending` continuam sem
  permissão herdada;
- `admin` continua com 14 páginas; papéis operacionais legados continuam com sete;
- sessão sem fator mantém exatamente o acesso anterior;
- usuário com fator verificado em AAL1 falha fechado em guards, RPCs e RLS;
- AAL2 restaura somente as permissões já existentes;
- uma policy `authenticated_session_mfa_gate` por tabela `public` com RLS;
- ledger legal com RLS forçada, sem grant para Data API ou `PUBLIC`;
- nenhuma função, role, schema ou grant de relay/motor introduzido.
- contratos opcionais já presentes usam lookup por OID e não falham quando `pg_net`
  está ausente.

Rollback após aplicação é somente roll-forward. A imagem anterior pode ser restaurada,
mas as migrations de segurança e o ledger legal não devem ser revertidos destrutivamente.
