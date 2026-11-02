# 2026-11-02: melhorias de leitura em Agendamentos

Abertura em 17:42Z: Git comum confirmado; árvore limpa, base atualizada de d4bb4d91 para origin/main b93d3904. CI 41380947066 concluída com sucesso. PR467 integrou aa28d38e e PR468 registros b93d3904; health público consultado em 17:42:05Z retorna ok/aa28d38e. Fontes: Git origin/main, gh PRs 467/468, https://crm.descomplicapro.com.br/api/health. Versão local documental difere da versão runtime como esperado. Escopo: rolagem vertical em conteúdo excedente, datas/tooltips do comparativo, recência legível, rankings PDV/empreendimento e tabela de comparecimento vencido sem visita, feriados. Pendente esclarecer terceiro gráfico (somente dois descritos) e abrangência local de feriados. Nenhuma alteração de outras páginas, permissões ou integração autorizada por contexto.

## Implementação e evidências locais

Usuário confirmou somente dois rankings. Sem jurisdição informada, feriados
limitados às datas nacionais fixas, sem presumir ponto facultativo ou feriado
municipal. Fontes conferidas: Lei662/1949 na Câmara
(https://www2.camara.leg.br/legin/fed/lei/1940-1949/lei-662-6-abril-1949-347136-normaatualizada-pl.html),
Lei14.759/2023 no Senado (https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2023-12-21%3B14759),
Lei6.802/1980 e calendário federal2026 no MGI/AgênciaGov. Textos explicativos
próprios, sem copiar artigos. Os marcadores não alteram metas ou cálculos.

Fonte dos rankings: Activity.PDV\_\_c.Name separado da dimensão de empreendimento
já coletada, confirmado em ops/salesforce/export-candidate.mjs e
analysis-transform.mjs. Sem nova coleta, join de pessoas ou integração. Filtros
por ranking de conta ou regional sem vínculo confiável retornam indisponível;
as quantidades e percentuais vêm do mesmo recorte agregado.

Data de comparecimento usa attendedAt, oriunda de Activity.Data_de_comparecimento\_\_c;
vencido é data civil SãoPaulo anterior a calendarDate e visitPerformed=false.
Ausentes/hoje/futuro/visitaSim não entram. subsetoverdue é validado no servidor
antes de paginação/CSV, com cache/cursor separado e guards/snapshot existentes.

Node24.19/pnpm11.20: tipo e lint focado aprovados; análise, renderização,
comparação, transporte e backend de detalhes passaram em testes focados.
Inventário de release26/26 aprovado após acrescentar migration e pgTAP novos.
Falhas iniciais de contagem28→31 e inventário100→101 foram corrigidas, sem
remover asserções ou reduzir gates. DB local ECONNREFUSED127.0.0.1:54322;
SQL não foi executado aqui.22asserções novas aguardam CI obrigatória.

QA real de componentes/CSS em Chromium isolado com dados sintéticos:
test-results/appointments-reading/result.json e
test-results/appointments-comparison-days/result.json:6/6 combinações por suite,
três temas e1440/390, scroll e leitura até último registro, tooltip só numérico,
datas alinhadas e meses28/29/30/31/filtros. Integração em
test-results/appointments-reading-integration/result.json:6/6, rankings35,
vencidos73 (páginas50+23/CSV73), feriado12/10 vermelho com explicação; sem erros
de página, requisições externas ou overflow. Transporte dessa QA é mock;
seleção/paginação reais estão cobertas pelos testes de servidor, não por produção.

Migration20261102175113 expande catálogo e insere somente três métricas ausentes
nos perfis de Agendamentos. IDs existentes, dimensões e apresentação mantidos;
ordem relativa preservada, com reindexação. Lock/preflight/CAS/version/timestamp
e rollback transacional mantidos; excesso50cards/bytes aborta sem truncar.
Revisão independente somente leitura não demonstrou vulnerabilidade; constatou
que pgTAP cobre helper/ACL/limites, sem provar concorrência de produção.
Aplicação remota ainda não autorizada. Exige backup e cliente/rollback compatível
com métricas novas. Não reverter removendo cards como efeito incidental.

## Autorização e revisão final do candidato

PR469 aberto. Usuário autorizou explicitamente aplicar em produção a migration
20261102175113 após CI verde, incluindo backup e expansão dos layouts existentes.
A aprovação não se estende a outras migrations. Preflight observacional MCP
confirmou projeto descomplica-crm-production/hnncxuerlcsaahdxoswb, PostgreSQL17.6,
2perfis de Agendamentos, máximo29cards e nenhum acima47; nenhum dado alterado.

Revisão final corrigiu a apresentação de fonte indisponível nos novos rankings e
na tabela de vencidos, preservando distinção de ausência e vazio.65testes de
análise/renderização/rankings passaram após a correção. CI anterior do mesmo PR
foi substituída pelo candidato atualizado; resultados do SHA anterior não serão
usados para aprovar publicação do novo. A geometria atual de29cards foi guardada
localmente sem conteúdo de clientes para comparação posterior; a cópia já presente
não pertence a este teste e não será excluída.
