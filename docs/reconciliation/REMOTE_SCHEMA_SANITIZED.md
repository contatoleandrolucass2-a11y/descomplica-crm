# Inventário sanitizado do schema remoto

## Status do artefato

Este arquivo é um inventário completo dos objetos/metadados consultados, não um
`pg_dump` DDL restaurável. Tipos, defaults, constraints, índices, owners e
expressões das policies não Qlik estão resumidos ou representados por hashes;
bodies sensíveis foram excluídos. Gerar um dump DDL sanitizado e reproduzível
exige a sessão segura da CLI descrita no
[plano operacional](OPERATIONS_GATE_PLAN.md). Essa entrega permanece bloqueada;
nenhum conteúdo reconstruído será chamado de SQL remoto original.

## Identificação

- Captura UTC: `2026-08-09T05:31:42Z`.
- Projeto: `hnncxuerlcsaahdxoswb`.
- Banco: `postgres`.
- PostgreSQL: `17.6`.
- Fuso do servidor: `UTC`.
- PostgREST observado pelos tipos gerados: `14.15`.
- Método: `information_schema`, catálogos `pg_*`, histórico de migrations e
  geração de tipos, sempre por consultas somente leitura.

Este é um inventário de evidência, não um backup restaurável. Não contém linhas,
nomes de usuários, e-mails, IDs pessoais, payloads, credenciais, bodies de
funções ou o verificador presente na RPC Qlik legada. Definições sensíveis são
representadas por assinatura e hash.

## Objetos públicos

Todas as 21 tabelas abaixo possuem RLS habilitada e nenhuma usa
`FORCE ROW LEVEL SECURITY`. Não existem views ou materialized views no schema
`public`.

| Tabela                           | Colunas sanitizadas                                                                                     | Chave/relacionamento principal              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `profiles`                       | `user_id uuid`, `email text?`, `is_active bool`, `profile_completed bool`, timestamps                   | PK `user_id`; FK `auth.users`               |
| `roles`                          | `key text`, `name text`, `level int`, `is_system bool`, `created_at`                                    | PK `key`; `level` único                     |
| `permissions`                    | `key text`, `description text`, `min_level int`, `created_at`                                           | PK `key`                                    |
| `role_permissions`               | `role_key text`, `permission_key text`                                                                  | PK composta; FKs roles/permissions          |
| `user_roles`                     | `user_id uuid`, `role_key text`, `assigned_by uuid?`, timestamps                                        | PK `user_id`; FKs Auth/roles                |
| `user_permission_overrides`      | `user_id uuid`, `permission_key text`, `effect text`, `reason text?`, `granted_by uuid?`, `created_at`  | PK composta; FKs Auth/permissions           |
| `audit_logs`                     | `id bigint`, atores UUID opcionais, `action text`, before/after JSONB, IP/agent opcionais, `created_at` | PK `id`                                     |
| `app_pages`                      | chave/path/name/description/section/permission/parent, ordem e flags, timestamps                        | PK `key`; path único; FKs permission/parent |
| `crm_dashboard_snapshots`        | ID, chave/data/geração/fuso/fonte, `goals_available`, timestamps                                        | PK `id`; `snapshot_key` único               |
| `crm_dashboard_views`            | snapshot/visão e VGV de mês/semana/dia                                                                  | PK snapshot+visão; FK snapshot              |
| `crm_dashboard_metrics`          | snapshot/visão/etapa, realizados, metas e oito comparativos                                             | PK snapshot+visão+etapa; FK snapshot        |
| `crm_dashboard_top_developments` | snapshot/visão/rank/nome/total                                                                          | PK snapshot+visão+rank; FK snapshot         |
| `crm_funnel_goals`               | perfil/mês, seis volumes, cinco taxas, mínimos, ritmos, produtividade e auditoria                       | PK `id`; único perfil+mês                   |
| `crm_point_settings`             | chave singleton, ator e timestamps                                                                      | PK `setting_key`                            |
| `crm_point_metrics`              | setting/métrica/peso/objetivo                                                                           | PK setting+métrica; FK settings             |
| `crm_ranking_snapshots`          | ID, chave/data/geração/fuso/fonte, `roulette_available`, timestamps                                     | PK `id`; `snapshot_key` único               |
| `crm_ranking_participants`       | snapshot/período, chaves/nomes de corretor e gerente, sete contagens                                    | PK snapshot+período+corretor; FK snapshot   |
| `crm_ingestion_runs`             | UUID/request/kind/status/workflow/ator/contagem/status HTTP/erro/timestamps                             | PK `id`; `request_key` único                |
| `crm_imob_ranking_runs`          | UUID/status/ano/geração/fonte/recorte/contagens/timestamps/erro                                         | PK `id`                                     |
| `crm_imob_ranking_entries`       | run/mês/chave/nome da imobiliária/VGV/contratos/ranks/timestamp                                         | PK run+mês+imobiliária; FK run              |
| `crm_imob_ranking_developments`  | run/mês/unidade/chave/nome do empreendimento/VGV/contratos/ranks/timestamp                              | PK run+mês+unidade+empreendimento; FK run   |

Existem quatro sequências de identidade: `audit_logs_id_seq`,
`crm_dashboard_snapshots_id_seq`, `crm_funnel_goals_id_seq` e
`crm_ranking_snapshots_id_seq`.

## Policies observadas

As 17 policies não Qlik restringem leitura ao papel `authenticated` e às
permissões correspondentes, com três exceções estruturais de catálogo
(`roles`, `permissions`, `role_permissions`) que usam `true` para usuário
autenticado. `crm_ingestion_runs` possui RLS sem policy e sem grant de Data API.

As três policies Qlik estão divergentes e expostas:

| Tabela                          | Policy                                           | Papel                   | Predicado         |
| ------------------------------- | ------------------------------------------------ | ----------------------- | ----------------- |
| `crm_imob_ranking_runs`         | `crm_imob_ranking_runs_select_completed`         | `anon`, `authenticated` | run concluído     |
| `crm_imob_ranking_entries`      | `crm_imob_ranking_entries_select_completed`      | `anon`, `authenticated` | run pai concluído |
| `crm_imob_ranking_developments` | `crm_imob_ranking_developments_select_completed` | `anon`, `authenticated` | run pai concluído |

## Grants observados

- `anon`: `SELECT` nas três tabelas Qlik; nenhum outro grant de tabela
  relevante foi observado.
- `authenticated`: `SELECT` nos read models e tabelas administrativas usados
  pelo SDK, além de `SELECT` nas três tabelas Qlik.
- `service_role`: `SELECT`, `INSERT`, `UPDATE` e `DELETE` diretos nas três
  tabelas Qlik.
- `PUBLIC`: nenhum grant explícito de tabela relevante na captura.

O estado Qlik viola a allowlist local e a regra obrigatória do repositório. A
presença de RLS não neutraliza `anon`, pois as próprias policies admitem o papel.

## Funções públicas sanitizadas

Foram observadas 26 funções no schema `public`. Todas as funções privilegiadas
abaixo são registradas apenas por assinatura; bodies ficam nas migrations
locais quando versionados.

- Autorização: `_internal_assert_actor_active(uuid)`,
  `_internal_get_role_level(uuid)`, `_internal_has_permission(uuid,text)`,
  `_internal_list_permissions(uuid)`, `get_role_level(uuid)`,
  `has_permission(uuid,text)`, `can_assign_role(uuid,text)`,
  `can_grant_permission(uuid,text)`,
  `get_user_authorization_context(uuid)`.
- Administração: `assign_user_role(uuid,text,text)`,
  `remove_user_permission_override(uuid,text,text)`,
  `set_user_permission_override(uuid,text,text,text)`,
  `set_user_active(uuid,bool,text)`, `list_app_pages_for_management()`,
  `set_app_page_active(text,bool,text)`, `bootstrap_master_user(uuid)`.
- CRM: `begin_crm_salesforce_refresh(text)`,
  `finish_crm_salesforce_refresh(uuid,text,int,text)`,
  `get_crm_sync_status()`, `ingest_crm_salesforce_snapshot(jsonb)`,
  `replace_crm_point_settings(jsonb,jsonb)`,
  `upsert_crm_funnel_goals(...)`.
- Infraestrutura: `handle_new_auth_user()`, `set_updated_at()`,
  `rls_auto_enable()`.
- Divergente: `publish_crm_imob_ranking(jsonb,text)`, `SECURITY DEFINER`, hash
  da definição atual
  `0d8232d40fad8396cf495c44a65666d23a78062a66ec5a868df6cd4819d09236`,
  com `EXECUTE` para `anon` e `service_role`.

`ingest_crm_imob_ranking_snapshot(jsonb)`, existente na migration local segura,
não existe no remoto.

## Triggers

O remoto possui apenas triggers `BEFORE UPDATE` de `updated_at` em oito tabelas.
O trigger que exige motivo em alterações sensíveis, previsto em
`20260808174817`, não existe no remoto.

## Últimas bases comprovadas

| Domínio            | Referência   | Gerada em UTC              | Fonte                                        | Disponibilidade                 |
| ------------------ | ------------ | -------------------------- | -------------------------------------------- | ------------------------------- |
| Dashboard          | `2026-08-07` | `2026-08-07T18:03:36.329Z` | Salesforce Analytics Reports API v61 via n8n | Metas indisponíveis             |
| Ranking de pessoas | `2026-08-07` | `2026-08-07T18:03:36.329Z` | Salesforce Analytics Reports API v61 via n8n | 104 linhas; roleta indisponível |
| Ranking Qlik       | ano `2026`   | `2026-08-09T05:07:36.463Z` | `qlik:23.1-painel-comercial-vendas`          | 384 linhas; zero developments   |

Foram observados nove runs Qlik bem-sucedidos da origem atual entre
`00:53:46Z` e `05:07:36Z`, com intervalo médio de `31,7` minutos. Isso prova um
caller ativo, mas não torna o contrato legado nem seus grants autoridade
segura.

## Integridade da captura

O inventário exclui valores comerciais e dados pessoais. Para reproduzi-lo,
consultar
somente metadados dos seguintes catálogos:

```sql
information_schema.columns
information_schema.triggers
information_schema.role_table_grants
pg_catalog.pg_class
pg_catalog.pg_proc
pg_catalog.pg_policies
supabase_migrations.schema_migrations
```

Uma cópia restaurável exige `supabase db dump`/`pg_dump` e teste de restauração;
esta captura não substitui esse gate.
