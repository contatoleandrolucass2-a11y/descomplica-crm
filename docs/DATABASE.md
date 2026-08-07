# Banco de dados

## Estado atual

O schema usa PostgreSQL 17 no Supabase local. Existem treze migrations versionadas. A validação local encontrou 20 tabelas públicas e RLS habilitada em todas; os seeds estruturais criam oito papéis, 17 permissões e 15 páginas. Nenhum dado comercial é seedado.

## Migrations

1. `20260519190726_access_control_foundation.sql`: tabelas, papéis, permissões, RLS e auditoria.
2. `20260522010552_access_control_admin_functions.sql`: funções administrativas e bootstrap master.
3. `20260527120000_authorization_context_rpc.sql`: contexto efetivo de autorização.
4. `20260721120000_fix_remove_user_permission_override_ambiguity.sql`: correção de ambiguidade em override.
5. `20260804041218_page_catalog_and_crm_permissions.sql`: catálogo de páginas, permissões CRM, provisionamento de contas, bloqueio de inativos e RPCs administrativas.
6. `20260804043416_dashboard_read_model.sql`: snapshots, resumos por visão, métricas e empreendimentos do dashboard.
7. `20260804044701_funnel_goals.sql`: metas mensais normalizadas, RLS e upsert auditado dos funis DV/parcerias.
8. `20260804045945_point_settings.sql`: pesos e objetivos normalizados do ranking, RLS e substituição auditada.
9. `20260804050720_ranking_read_model.sql`: snapshots e atividades agregadas do ranking por corretor/período.
10. `20260804052500_secure_salesforce_ingestion.sql`: ingestão transacional e refresh Salesforce auditado.
11. `20260804191713_normalize_new_project_grants.sql`: matriz explícita de grants compatível com os defaults fail-closed dos novos projetos Supabase.
12. `20260806222732_salesforce_source_availability.sql`: flags fail-closed para metas/roleta e wrapper privado do contrato de ingestão v2.
13. `20260807001159_reconcile_remote_imob_schema_and_grants.sql`: versionamento aditivo das tabelas Qlik de ranking de imobiliárias, identidade remota do catálogo e reconstrução fail-closed da matriz de grants.

## Desenvolvimento local

```bash
pnpm db:start
pnpm exec supabase migration list --local
pnpm exec supabase db lint --local
pnpm db:test
pnpm exec supabase db advisors --local --type security
pnpm exec supabase db advisors --local --type performance
pnpm exec supabase db reset
pnpm db:stop
```

O reset é destrutivo para o banco local. Não use comandos equivalentes contra ambiente remoto sem backup e autorização.

`supabase test db` executa 229 testes pgTAP: 27 do catálogo/autorização, 28 do dashboard, 25 das metas, 35 do schema Qlik de imobiliárias, 26 dos pontos, 27 do ranking, 43 da ingestão e 18 da matriz global de grants. A cobertura verifica nomes, schema, grants, policies, constraints, disponibilidade de fontes, provisionamento, usuários inativos, overrides, cálculos e auditoria. Cada novo domínio do CRM deve ampliar esse conjunto.

## RLS e grants

RLS e grants são camadas complementares. Cada nova tabela exposta precisa:

- grants mínimos por papel;
- RLS ativada;
- policies separadas por ação quando necessário;
- índice para colunas usadas pelas policies;
- teste com usuário autorizado e não autorizado;
- auditoria para alterações administrativas.

O advisor de segurança mantém apenas o `INFO` intencional de
`crm_ingestion_runs` com RLS e sem policy, pois a tabela não integra a Data API.
Os avisos informativos de foreign keys sem índice e índices ainda não usados
permanecem registrados para avaliação separada; esta correção de grants não
altera índices. As policies permissivas duplicadas da base de login foram
consolidadas sem alterar a regra self-or-manager.

Os grants são normalizados explicitamente para que projetos anteriores e novos
convirjam. `PUBLIC`/`anon` não acessam objetos da aplicação; `authenticated`
recebe apenas os `SELECT` e RPCs usados pelo SDK SSR; `service_role` recebe
somente a RPC server-only de ingestão. Default privileges de tabelas,
sequências e funções futuras também permanecem fechados até um `GRANT`
versionado. A matriz completa está em `docs/AUTHORIZATION_MATRIX.md`.

## D1 para PostgreSQL

Modelos e queries do CRM original não serão copiados literalmente. Cada tabela D1 será mapeada para tipo PostgreSQL, constraints, índices, grants e policies; o acesso ocorrerá pelo Supabase SDK/server-side. Drizzle/D1, bindings `env.DB` e imports `cloudflare:` não entram na aplicação final.

O antigo `collaborator_dashboards.payload_json` e a dependência não versionada `sf_relatorio_resumo` foram substituídos no dashboard por quatro tabelas normalizadas. A ingestão ainda não está exposta: navegadores recebem somente `SELECT` limitado por `crm.dashboard.view`.

A dependência não versionada `crm_funnel_goals` do CRM original foi substituída por uma tabela mensal tipada. O papel `authenticated` recebe somente `SELECT` com RLS; a Server Action grava exclusivamente pela função `upsert_crm_funnel_goals`, que exige `crm.settings.manage`, recalcula os volumes e audita a alteração.

Os JSONs da tabela D1 `point_goals` foram substituídos por `crm_point_settings` e `crm_point_metrics`. O ranking pode ler as sete métricas via `crm.ranking.view`; a escrita completa ocorre somente pela RPC `replace_crm_point_settings`, protegida por `crm.settings.manage`.

O ranking usa snapshots e contagens por participante/período, sem payload JSON. Os totais são recalculados na aplicação com os pesos atuais, evitando regravar atividade quando a configuração muda. A escrita permanece reservada à futura ingestão server-side.

As tabelas `crm_imob_ranking_runs` e `crm_imob_ranking_entries` preservam o histórico externo do ranking de imobiliárias originado no Qlik. Nenhum caller dessas tabelas existe no repositório atual; por isso `anon`, `authenticated` e `service_role` permanecem sem grants diretos. As policies nomeadas são mantidas com escopo `authenticated`, mas ficam inoperantes até uma futura leitura receber grant explícito e revisão própria. A auditoria do drift está em `docs/SUPABASE_REMOTE_DRIFT_AUDIT.md`.
