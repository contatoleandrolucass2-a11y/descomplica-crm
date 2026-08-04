# Inventário funcional do CRM original

Data: 2026-08-04. Fonte analisada: checkpoint `checkpoint/crm-original-2026-08-03` e cópia isolada do ZIP original.

## Páginas

| Rota original                    | Função                                                           | Destino planejado                    | Permissão             |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------------ | --------------------- |
| `/`                              | Dashboard e funil comercial                                      | `/app`                               | `crm.dashboard.view`  |
| `/etapas/[stage]`                | Detalhe de oportunidades, agendamentos, visitas, pastas e vendas | `/app/etapas/[stage]`                | `crm.stages.view`     |
| `/ranking`                       | Ranking de corretores e gerentes                                 | `/app/ranking`                       | `crm.ranking.view`    |
| `/configuracoes`                 | Índice de configurações                                          | `/app/configuracoes`                 | `crm.settings.view`   |
| `/configuracoes/metas`           | Metas do funil DV                                                | `/app/configuracoes/metas`           | `crm.settings.manage` |
| `/configuracoes/metas/parcerias` | Metas do canal parcerias                                         | `/app/configuracoes/metas/parcerias` | `crm.settings.manage` |
| `/configuracoes/metas/pontos`    | Pesos, metas e ranking por pontos                                | `/app/configuracoes/metas/pontos`    | `crm.settings.manage` |

O parâmetro `stage` aceita cinco slugs: `oportunidades`, `agendamentos`, `visitas`, `pastas` e `vendas`.

## Componentes reutilizáveis

| Componente              | Responsabilidade                               | Decisão                                        |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `DashboardClient`       | KPIs, funil, progresso, atualização Salesforce | migrar após substituir APIs e dados demo       |
| `StageDetailClient`     | Detalhe e comparação por etapa                 | migrado sobre o read model do dashboard        |
| `RankingClient`         | Pontuação, conversões, filtros e produtividade | migrado para ranking server-rendered           |
| `GoalsSettingsClient`   | Edição de metas mensais/semanais/diárias       | migrado para Server Component + Server Action  |
| `PointsSettingsClient`  | Pesos e metas de pontuação                     | migrado para Server Component + Server Action  |
| `DashboardFilters`      | Filtros locais persistidos no navegador        | reutilizar com revisão de acessibilidade       |
| `PeriodComparisonTable` | Comparações de período                         | reutilizar                                     |
| `StageNavigation`       | Navegação das etapas                           | substituir pelo catálogo de páginas autorizado |
| `SiteMenu`              | Menu principal estático                        | substituir por navegação dinâmica autorizada   |
| `ThemeSwitch`           | Tema claro/equilibrado/escuro                  | reutilizar depois do shell protegido           |

## APIs encontradas

| Endpoint original         | Método   | Dependência                       | Problema preexistente                          | Destino                              |
| ------------------------- | -------- | --------------------------------- | ---------------------------------------------- | ------------------------------------ |
| `/api/auth/login`         | POST     | Supabase Auth manual              | duplica login SSR; cookie manual               | remover                              |
| `/api/auth/logout`        | POST     | cookie manual                     | duplica Server Action existente                | remover                              |
| `/api/auth/session`       | GET      | token em cookie                   | duplica cliente SSR                            | remover                              |
| `/api/dashboard/status`   | GET      | Supabase REST ou D1               | fallback Cloudflare/demo e autorização ausente | migrado para sessão + RPC segura     |
| `/api/ingest/salesforce`  | POST     | `INGEST_SECRET`, D1/n8n           | validação rasa, fallback hard-coded            | migrado para Zod + RPC transacional  |
| `/api/refresh/salesforce` | POST     | Salesforce/n8n                    | sem sessão ou permissão                        | migrado com permissão e controles    |
| `/api/settings/goals`     | GET/POST | Supabase REST com publishable key | sem autenticação/permissão server-side         | substituída por SDK SSR + RLS/RPC    |
| `/api/settings/points`    | GET/POST | Cloudflare D1                     | sem autenticação/permissão                     | substituída por PostgreSQL + RLS/RPC |

Nenhuma API original será copiada diretamente. O sistema de login e seus cookies Supabase SSR continuam como única autenticação.

## Dados e integrações

- `collaborator_dashboards`: ranking extraído para snapshots e atividades normalizadas.
- `ingestion_runs`: histórico simples de ingestão.
- `point_goals`: JSONs D1 substituídos por duas tabelas PostgreSQL normalizadas.
- `crm_funnel_goals`: dependência ausente do ZIP, agora versionada em PostgreSQL com colunas tipadas, RLS e auditoria.
- Salesforce/n8n: refresh e persistência por URLs externas configuradas em ambiente.
- Dados demo: dashboard completo hard-coded e usuário fictício; não podem chegar à produção.

## Ordem de migração

1. Catálogo de páginas e permissões no PostgreSQL.
2. Navegação protegida e painel administrativo de papéis/overrides.
3. Dashboard somente leitura, com contrato de dados validado.
4. Metas e pontos com escrita auditada.
5. Ranking e etapas.
6. Ingestão e Salesforce com controles de segurança.

## Critério de aceite por rota

Autenticação SSR, permissão server-side, grants/RLS quando houver dados, validação Zod, ausência de Cloudflare/D1, testes automatizados, responsividade e documentação.
