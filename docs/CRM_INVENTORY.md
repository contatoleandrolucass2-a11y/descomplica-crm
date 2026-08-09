# Inventário oficial da referência viva e do CRM seguro

Data de corte: 2026-08-09. Referência visual: `https://descomplicapro.com.br/`.

Este inventário substitui o levantamento de 2026-08-04 baseado apenas no
checkpoint `checkpoint/crm-original-2026-08-03`. O checkpoint continua útil para
proveniência, mas a referência viva é a fonte visual oficial. Ela não é fonte de
verdade para dados, fórmulas, regras comerciais, autenticação ou autorização.

## Limites de segurança

A referência viva expõe páginas e conteúdo comercial sem sessão. Isso é um
defeito conhecido e não será reproduzido. Capturas brutas, HTML, HAR, cookies,
payloads ou bundles da referência não entram no repositório. O baseline visual
versionado aplica máscaras sólidas e irreversíveis antes da captura.

O CRM seguro mantém Supabase SSR, guards server-side, RLS e grants mínimos. A
interface recebe somente páginas já filtradas pela permissão efetiva. As tabelas
Qlik `crm_imob_ranking_runs` e `crm_imob_ranking_entries` não são lidas por esta
fundação e continuam sem acesso direto por `anon`, `authenticated` ou
`service_role`.

## As 18 páginas oficiais da referência

Este é o conjunto de 18 rotas inventariadas e aprovado no diagnóstico. Sua
proveniência é a navegação superior, os menus hierárquicos e os destinos
registrados durante o levantamento da referência viva. O harness percorre esse
catálogo fixo e confirma endereço e resposta; ele funciona como contrato de
regressão, não como crawler capaz de provar que nenhuma rota não vinculada
existe.

| ID     | Rota da referência                    | Domínio visual          | Destino seguro                       | Permissão                   | Estado deste incremento                                  |
| ------ | ------------------------------------- | ----------------------- | ------------------------------------ | --------------------------- | -------------------------------------------------------- |
| REF-01 | `/`                                   | Dashboard analítico     | `/app`                               | `crm.dashboard.view`        | Fundação visual concluída                                |
| REF-02 | `/etapas/oportunidades`               | Etapa Oportunidades     | `/app/etapas/oportunidades`          | `crm.stages.view`           | Concluída                                                |
| REF-03 | `/etapas/agendamentos`                | Etapa Agendamentos      | `/app/etapas/agendamentos`           | `crm.stages.view`           | Concluída                                                |
| REF-04 | `/etapas/visitas`                     | Etapa Visitas           | `/app/etapas/visitas`                | `crm.stages.view`           | Concluída                                                |
| REF-05 | `/etapas/pastas`                      | Etapa Pastas            | `/app/etapas/pastas`                 | `crm.stages.view`           | Concluída                                                |
| REF-06 | `/etapas/vendas`                      | Etapa Vendas            | `/app/etapas/vendas`                 | `crm.stages.view`           | Concluída                                                |
| REF-07 | `/ranking`                            | Ranking comercial       | `/app/ranking`                       | `crm.ranking.view`          | Rota segura existente; paridade avançada adiada          |
| REF-08 | `/canal-de-parcerias`                 | Canal de Parcerias      | `/app/canal-de-parcerias`            | `crm.ranking.view`          | Placeholder protegido; incremento separado               |
| REF-09 | `/configuracoes`                      | Índice de configurações | `/app/configuracoes`                 | `crm.settings.view`         | Rota segura existente; fora do escopo visual             |
| REF-10 | `/configuracoes/metas`                | Metas do funil          | `/app/configuracoes/metas`           | `crm.settings.manage`       | Funcionalidade segura existente; fora do escopo visual   |
| REF-11 | `/configuracoes/metas/parcerias`      | Metas de parcerias      | `/app/configuracoes/metas/parcerias` | `crm.settings.manage`       | Funcionalidade segura existente; fora do escopo visual   |
| REF-12 | `/configuracoes/metas/pontos`         | Pesos e metas de pontos | `/app/configuracoes/metas/pontos`    | `crm.settings.manage`       | Funcionalidade segura existente; ranking avançado adiado |
| REF-13 | `/simulacao`                          | Índice de simuladores   | Não implementado                     | A definir com fonte oficial | Incremento separado                                      |
| REF-14 | `/simulacao/associativo-fluxo-linear` | Simulador associativo   | Não implementado                     | A definir com fonte oficial | Incremento separado                                      |
| REF-15 | `/simulacao/calcular-documentacao`    | Cálculo de documentação | Não implementado                     | A definir com fonte oficial | Incremento separado                                      |
| REF-16 | `/simulacao/caixa`                    | Simulador CAIXA         | Não implementado                     | A definir com fonte oficial | Incremento separado                                      |
| REF-17 | `/simulacao/tabela-direta`            | Tabela direta           | Não implementado                     | A definir com fonte oficial | Incremento separado                                      |
| REF-18 | `/simulacao/tabela-investidor`        | Tabela investidor       | Não implementado                     | A definir com fonte oficial | Incremento separado                                      |

Os nomes WF13, WF14, WF15 e WF16 não são associados a uma rota específica sem
documento oficial que confirme a correspondência. Nenhuma regra dos simuladores
foi copiada ou alterada neste incremento.

## Catálogo versionado de páginas do sistema seguro

O catálogo PostgreSQL possui 15 páginas protegidas. A consulta
`getAuthorizedNavigation` seleciona apenas entradas ativas e navegáveis e, em
seguida, aplica a permissão efetiva do contexto autenticado.

| Chave                       | Rota                                 | Pai             | Permissão             |
| --------------------------- | ------------------------------------ | --------------- | --------------------- |
| `crm.dashboard`             | `/app`                               | —               | `crm.dashboard.view`  |
| `crm.stage.opportunities`   | `/app/etapas/oportunidades`          | `crm.dashboard` | `crm.stages.view`     |
| `crm.stage.appointments`    | `/app/etapas/agendamentos`           | `crm.dashboard` | `crm.stages.view`     |
| `crm.stage.visits`          | `/app/etapas/visitas`                | `crm.dashboard` | `crm.stages.view`     |
| `crm.stage.folders`         | `/app/etapas/pastas`                 | `crm.dashboard` | `crm.stages.view`     |
| `crm.stage.sales`           | `/app/etapas/vendas`                 | `crm.dashboard` | `crm.stages.view`     |
| `crm.ranking`               | `/app/ranking`                       | —               | `crm.ranking.view`    |
| `crm.partnerships`          | `/app/canal-de-parcerias`            | —               | `crm.ranking.view`    |
| `crm.settings`              | `/app/configuracoes`                 | —               | `crm.settings.view`   |
| `crm.settings.goals`        | `/app/configuracoes/metas`           | `crm.settings`  | `crm.settings.manage` |
| `crm.settings.partnerships` | `/app/configuracoes/metas/parcerias` | `crm.settings`  | `crm.settings.manage` |
| `crm.settings.points`       | `/app/configuracoes/metas/pontos`    | `crm.settings`  | `crm.settings.manage` |
| `admin.home`                | `/admin`                             | —               | `admin.access`        |
| `admin.users`               | `/admin/usuarios`                    | `admin.home`    | `users.view`          |
| `admin.pages`               | `/admin/paginas`                     | `admin.home`    | `pages.manage`        |

Rotas públicas de autenticação, cadastro, saúde e respostas 403/404/500 não
fazem parte de `app_pages`. Elas permanecem separadas do catálogo comercial.

### Superfícies fora de `app_pages`

| Rota ou resposta                 | Responsabilidade                       | Enforcement ou exposição                          |
| -------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `/`                              | Entrada que encaminha ao fluxo correto | Não renderiza dados comerciais                    |
| `/login`                         | Login Supabase SSR                     | Pública; usuário já autenticado segue para `/app` |
| `/register`                      | Cadastro preservado                    | Pública; contrato de criação existente            |
| `/unauthorized`                  | Compatibilidade para acesso negado     | Resposta dinâmica 403                             |
| `forbidden()`, 404 e `error.tsx` | Estados sistêmicos seguros             | Sem detalhes internos ou dados comerciais         |
| `/api/health`                    | Liveness                               | Pública; não consulta dados comerciais            |
| `/api/dashboard/status`          | Estado da ingestão                     | Exige `crm.dashboard.view`                        |
| `/api/refresh/salesforce`        | Solicitação de atualização             | Exige permissão, flag e controles server-side     |
| `/api/ingest/salesforce`         | Ingestão de máquina                    | Bearer dedicado, contrato tipado e RPC mínima     |

## Catálogo completo de componentes de interface relevantes

| Componente                               | Responsabilidade                        | Regra de dados                                       |
| ---------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `ProtectedLayout`                        | Topbar, papel, tema, logout e navegação | Executa `enforceAuthorization` antes de renderizar   |
| `AuthorizedNavigation`                   | Hierarquia nativa por pai/filho         | Recebe somente páginas autorizadas; omite órfãos     |
| `ThemeSwitch`                            | Temas claro, equilibrado e escuro       | Persiste apenas preferência local não sensível       |
| `PageHeader`                             | Cabeçalho analítico navy/cyan/lime      | Metadados vêm do snapshot autenticado                |
| `AnalyticsCard`                          | Superfície reutilizável                 | Não calcula métricas                                 |
| `MetricCard`                             | Realizado, meta e rosca                 | Rosca só aparece com meta oficial maior que zero     |
| `FilterBar`, `FilterGroup`, `FilterLink` | Filtros de visão e período              | Somente parâmetros aceitos pelo catálogo server-side |
| `DonutChart`                             | Atingimento circular                    | Clamp apenas visual; texto mantém o valor real       |
| `FunnelChart`                            | Relação entre volumes por etapa         | Não reordena nem cria coorte ou projeção             |
| `Gauge`                                  | Leitura semicircular de meta            | Sem thresholds comerciais internos                   |
| `AnalyticsTable`                         | Tabela semântica e rolável              | Ausência usa estado explícito, nunca zero substituto |
| `RankingList`                            | Lista já ordenada pela fonte            | Não pontua, desempata ou reordena                    |
| `AnalyticsSkeleton`                      | Carregamento estável                    | `aria-busy` e animação desligada em reduced-motion   |
| `DataState`                              | Estados vazio, indisponível e erro      | Mensagem segura sem detalhes do Supabase             |
| `UnavailableValue`                       | Ausência em célula ou indicador         | Diferencia ausência de zero real                     |
| `RoutePlaceholder`                       | Página protegida ainda sem fonte        | Não consulta tabelas adiadas                         |
| `SalesforceRefreshButton`                | Aciona refresh já existente             | Só renderiza autorizado e respeita flag fail-closed  |
| `FunnelGoalsPage`                        | Edição segura de metas                  | Server Action/RPC e `crm.settings.manage`            |
| `PointSettingsPage`                      | Edição segura de pesos e objetivos      | Server Action/RPC e `crm.settings.manage`            |
| `UserAccessManager`                      | Papéis, status e overrides              | RPCs auditadas e permissões administrativas          |
| `LoginForm`, `RegisterForm`              | Autenticação e cadastro                 | Contratos existentes preservados                     |
| `AnimatedBrainVisual`                    | Arte visual do fluxo de autenticação    | Sem acesso a sessão, credenciais ou dados comerciais |

## Catálogo de fontes de dados

| Informação                       | Fonte segura                                                                                      | Enforcement                                  | Disponibilidade                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Sessão e papel                   | Supabase Auth SSR + contexto de autorização                                                       | Layout/guards + RPC/RLS                      | Obrigatória                                                  |
| Perfis, papéis e overrides       | `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permission_overrides` | RPCs/guards/RLS; sem confiança no cliente    | Disponível e preservada                                      |
| Auditoria administrativa         | `audit_logs`                                                                                      | Escrita por contratos protegidos             | Disponível                                                   |
| Navegação                        | `app_pages`                                                                                       | `pages.view`, permissão da página e RLS      | Disponível                                                   |
| Cabeçalho do dashboard           | `crm_dashboard_snapshots`                                                                         | `crm.dashboard.view` + RLS                   | Disponível quando há snapshot `global`                       |
| Valor vendido                    | `crm_dashboard_views`                                                                             | Mesma sessão/RLS                             | Disponível por visão e período                               |
| Realizados e históricos          | `crm_dashboard_metrics`                                                                           | Mesma sessão/RLS                             | Campos nulos permanecem indisponíveis                        |
| Metas                            | Campos de meta + `goals_available`                                                                | Barreira `availableCommercialValue`          | Indisponível quando a flag é falsa ou a meta não é positiva  |
| Oportunidades por empreendimento | `crm_dashboard_top_developments`                                                                  | Mesma sessão/RLS                             | Até cinco entradas já ordenadas                              |
| Visões suportadas                | `DASHBOARD_VIEWS`                                                                                 | Validação fechada de query string            | `all`, `with_canal_imob`, `without_canal_imob`               |
| Períodos suportados              | `DASHBOARD_PERIODS`                                                                               | Validação fechada de query string            | mês, semana e hoje                                           |
| Ordem das etapas                 | `DASHBOARD_STAGES` e `CRM_STAGES`                                                                 | Catálogo versionado                          | Cinco etapas                                                 |
| Filtros dimensionais             | Nenhuma fonte com enforcement completo                                                            | Não implementado                             | Indisponível                                                 |
| Projeção proporcional            | Nenhuma fórmula oficial versionada                                                                | Não implementado                             | Indisponível                                                 |
| Metas do funil                   | `crm_funnel_goals`                                                                                | Guard, RLS e RPC de escrita auditada         | Disponível conforme flag de fonte                            |
| Pesos e objetivos de pontos      | `crm_point_settings`, `crm_point_metrics`                                                         | Guard, RLS e RPC de escrita auditada         | Disponível                                                   |
| Ranking de corretores            | `crm_ranking_snapshots`, `crm_ranking_participants`                                               | `crm.ranking.view` + RLS                     | Disponível na rota de ranking                                |
| Histórico de ingestão            | `crm_ingestion_runs`                                                                              | Sem acesso direto do navegador               | Disponível pelos endpoints autorizados                       |
| Salesforce                       | Exportador/contrato v2 e RPC de ingestão existentes                                               | Bearer de máquina, validação Zod e transação | Disponível somente quando flags/configuração estão completas |
| Simuladores                      | Nenhuma regra oficial aprovada neste repositório                                                  | Não implementado                             | Incremento separado                                          |
| Ranking Qlik de imobiliárias     | Tabelas protegidas, sem leitura direta autorizada                                                 | RPC de escrita versionada; zero grant direto | Fora deste incremento                                        |
| Referência viva                  | Somente composição visual sanitizada                                                              | Nunca usada em runtime                       | Não é fonte comercial                                        |

## APIs legadas

As APIs manuais do sistema antigo continuam rejeitadas como autoridade. Login,
logout e sessão usam exclusivamente a arquitetura Supabase SSR existente. O
dashboard usa o read model normalizado. Metas e pontos usam Server Actions e
RPCs auditadas. Cloudflare, D1, Vinext, Vite e Wrangler não foram
reintroduzidos.

## Artefatos relacionados

- Matriz de paridade: [`REFERENCE_PARITY_MATRIX.md`](./REFERENCE_PARITY_MATRIX.md)
- Design system: [`ANALYTICS_DESIGN_SYSTEM.md`](./ANALYTICS_DESIGN_SYSTEM.md)
- Baseline visual: [`qa/reference-parity/README.md`](./qa/reference-parity/README.md)
