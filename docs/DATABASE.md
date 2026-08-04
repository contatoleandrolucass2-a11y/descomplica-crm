# Banco de dados

## Estado atual

O schema usa PostgreSQL 17 no Supabase local. Existem oito migrations versionadas. A validação local encontrou 15 tabelas públicas e RLS habilitada em todas; os seeds estruturais criam oito papéis, 17 permissões e 14 páginas. Nenhum dado comercial é seedado.

## Migrations

1. `20260519190726_access_control_foundation.sql`: tabelas, papéis, permissões, RLS e auditoria.
2. `20260522010552_access_control_admin_functions.sql`: funções administrativas e bootstrap master.
3. `20260527120000_authorization_context_rpc.sql`: contexto efetivo de autorização.
4. `20260721120000_fix_remove_user_permission_override_ambiguity.sql`: correção de ambiguidade em override.
5. `20260804041218_page_catalog_and_crm_permissions.sql`: catálogo de páginas, permissões CRM, provisionamento de contas, bloqueio de inativos e RPCs administrativas.
6. `20260804043416_dashboard_read_model.sql`: snapshots, resumos por visão, métricas e empreendimentos do dashboard.
7. `20260804044701_funnel_goals.sql`: metas mensais normalizadas, RLS e upsert auditado dos funis DV/parcerias.
8. `20260804045945_point_settings.sql`: pesos e objetivos normalizados do ranking, RLS e substituição auditada.

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

`supabase test db` executa 103 testes pgTAP: 26 do catálogo/autorização, 26 do dashboard, 25 das metas e 26 dos pontos. A cobertura verifica schema, grants, policies, constraints, provisionamento, usuários inativos, overrides, cálculos e auditoria. Cada novo domínio do CRM deve ampliar esse conjunto.

## RLS e grants

RLS e grants são camadas complementares. Cada nova tabela exposta precisa:

- grants mínimos por papel;
- RLS ativada;
- policies separadas por ação quando necessário;
- índice para colunas usadas pelas policies;
- teste com usuário autorizado e não autorizado;
- auditoria para alterações administrativas.

Os advisors locais de segurança e performance não apontam problemas. As três policies permissivas duplicadas da base de login foram consolidadas sem alterar a regra self-or-manager.

## D1 para PostgreSQL

Modelos e queries do CRM original não serão copiados literalmente. Cada tabela D1 será mapeada para tipo PostgreSQL, constraints, índices, grants e policies; o acesso ocorrerá pelo Supabase SDK/server-side. Drizzle/D1, bindings `env.DB` e imports `cloudflare:` não entram na aplicação final.

O antigo `collaborator_dashboards.payload_json` e a dependência não versionada `sf_relatorio_resumo` foram substituídos no dashboard por quatro tabelas normalizadas. A ingestão ainda não está exposta: navegadores recebem somente `SELECT` limitado por `crm.dashboard.view`.

A dependência não versionada `crm_funnel_goals` do CRM original foi substituída por uma tabela mensal tipada. O papel `authenticated` recebe somente `SELECT` com RLS; a Server Action grava exclusivamente pela função `upsert_crm_funnel_goals`, que exige `crm.settings.manage`, recalcula os volumes e audita a alteração.

Os JSONs da tabela D1 `point_goals` foram substituídos por `crm_point_settings` e `crm_point_metrics`. O ranking pode ler as sete métricas via `crm.ranking.view`; a escrita completa ocorre somente pela RPC `replace_crm_point_settings`, protegida por `crm.settings.manage`.
