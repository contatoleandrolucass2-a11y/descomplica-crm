# Equipe Produtiva: contrato visual e de acesso

Rota: `/app/equipe-produtiva`. Origem: pedido e cinco prints fornecidos pelo
usuário em 01/11/2026. Os prints orientam a composição; não são dados comerciais
nem uma baseline autenticada produzida pelo ambiente de QA.

A página usa os temas Claro, Médio e Escuro e reutiliza o filtro de período e
os cards de equipe produtiva de Agendamentos. Os seis filtros são Canal de
vendas, Gerente Regional, Gerente de Vendas, Responsável da conta, Empresa e
Período. Os quatro cards mostram corretores únicos com Agendamentos, Visitas,
Pastas e Vendas, em relação ao cadastro vigente filtrado. Ausência de fonte ou
de cadastro compatível deve aparecer como indisponibilidade; zero só representa
um resultado calculável com fonte confirmada.

O item lateral vem exclusivamente do catálogo autorizado. A permissão própria
`crm.productive_team.view` é concedida por padrão somente a Admin e Master;
demais perfis são negados, salvo concessão individual válida. URL conhecida ou
item de menu não substitui guard de servidor, autorização da RPC ou visão de
dados permitida.

## Validação reproduzível

Executar `node scripts/qa/productive-team-preview.mjs` com Node 24.19.x e as
dependências fixadas no lockfile. O preview usa somente fixtures sintéticas e
o DashboardShell real, com transporte de navegação sintético. O teste de zoom
aguarda a largura publicada pelo ResizeObserver do shell antes de exigir
ausência de overflow; não aceita a largura antiga nem amplia a tolerância.
O preview
grava evidências em `test-results/productive-team-preview/evidence.json`, com
capturas nos três temas em 390 e 1440 px. Verifica quatro cards, filtros,
calendário por teclado, limpar, zoom de layout de 200%, overflow, axe e a
distinção entre ausência de fonte e zero real. Esse preview usa CSS Vite; não
substitui runtime Next autenticado, CSS compilado de produção, CI ou banco.

Os testes `tests/productive-team-dashboard.test.tsx`,
`tests/productive-team-analysis.test.ts` e `tests/productive-team-data.test.ts`
conferem apresentação, contagem e contrato de leitura. A matriz autenticada
completa executa a nova rota por um contrato dedicado integrado em
`scripts/qa/authenticated-visual.mjs`, seguindo o padrão de Repasse. Exige sua
abertura com sessão sintética autorizada, responsividade, temas, acessibilidade,
teclado, zoom e ausência de erros do navegador. As capturas reais usam o CSS do
runtime Next e ficam em `test-results/authenticated-visual/productive-team`;
o resultado obrigatório fica em `productive-team-results.json`. A lista dos
22 canvases históricos e suas comparações permanecem distintas desse contrato.
O inventário de release verifica acesso permitido e negado por perfil.

Nenhuma execução de preview aprova automaticamente merge, ativação de migration
remota ou publicação. As referências e baselines das páginas anteriores
permanecem preservadas; uma captura da implementação não é referência externa.
