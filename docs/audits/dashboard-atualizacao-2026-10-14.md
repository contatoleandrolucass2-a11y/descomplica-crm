# Atualizacao do dashboard pelos relatorios publicados

## Pedido e conferencia inicial

O usuario pediu que os funis acompanhem os relatorios atualizados exibidos em
Conectar sistemas. Nao substituir os recortes mensais pelas contagens de linhas
nem usar o retrato historico da pagina de referencia.

Conferencia em14/10/2026 12:47:52Z: Git comum correto; main e runtime em
`16f458720406e76efcd1eda8a1eeb791509800a3`, health HTTP200/ok. CI main38558435232
aprovou os quatro jobs. Branch documental2ac7d52 preservada; trabalho iniciado
em codex/dashboard-atualizacao-relatorios. Context/search e sync executados;
notas antigas de operacao nao comprovam o estado atual do coletor.

## Origem dos numeros

- `ConnectedSystemsPanel.tsx` e `ops/salesforce/export-candidate.mjs` referem os
  mesmos sete relatorios comerciais por chave/ID. Estoque segue outro ciclo de
  publicacao e nao e uma etapa do funil.
- `transform.mjs` normaliza/deduplica os registros, separa as tres visoes e
  calcula as cinco etapas por periodo. Medias usam meses encerrados; o mes
  anterior preserva o corte ate o mesmo dia. Nenhuma formula foi alterada.
- A tabela mostra `diagnostics.sourceRows` do candidato. Esses totais de linhas
  normalizadas abrangem o lote, nao sao iguais aos recortes ou medias mensais.
- `publish-candidate.mjs` envia o payload pelo workflow versionado para a API
  de ingestao; a RPC existente grava os indicadores e o cabecalho do dashboard.
  Este trabalho nao publica workflow, nao dispara coleta e nao altera o banco.
- `lastExportAt` confirma geracao do candidato, antes de publicar. Coleta sem
  publicacao, falha ou recibo perdido nao certificam dados novos no dashboard.
  `lastPublishedAt` registra a confirmacao recebida pelo coletor, nao a data de
  geracao. A autoridade para a tela e o snapshot persistido no CRM.

## Correcao

A pagina carregava o read model real, mas permanecia com a versao renderizada
quando chegava outra publicacao. `DashboardAutoRefresh` consulta a API existente
ao montar, a cada30 segundos e ao voltar para a aba/foco ou recuperar conexao.
Usa GET autenticado, same-origin e no-store; nao solicita ingestao ou refresh
Salesforce. Abas ocultas pausam, requests pendentes sao deduplicados/cancelados,
timeout de10 segundos e cleanup evitam listeners ou respostas tardias.
Refresh da rota fica deduplicado ate receber novas props, com retry limitado
apos60 segundos se a resposta nao chegar. Eventos repetidos nao multiplicam
refreshes enquanto a mesma versao esta sendo aguardada nessa janela.

A API preserva os campos existentes e adiciona `updatedAt` do cabecalho, com
cliente autenticado/RLS e a mesma permissao `crm.dashboard.view`. O par
generatedAt/updatedAt detecta publicacao normal e correcao que reutiliza a data
de geracao. Metadados invalidos/indisponiveis nao simulam versao nova. 401/403
revalidam a rota protegida e interrompem o polling daquela montagem.

`router.refresh()` solicita os Server Components atuais sem substituir URL,
filtros ou estado de navegador. A data exibida continua sendo a geracao do lote
real; nao e o horario do polling. Sem mudanca de cores, funis ou baselines.

Foi reproduzida tambem leitura intercalada: ingestao preserva o ID do snapshot
e substitui filhos, enquanto o loader consulta cabecalho e metricas em requests
separadas. A correcao reconfere a identidade/versao depois das leituras, repete
uma vez se houver troca e falha fechada diante de outra troca. Nao apresenta
um conjunto misto como ready e nao amplia permissoes nem exige migration.

## Validacao e limites

- Node24.19.0/pnpm11.20.0. Primeiros71 testes de polling, API, permissoes e
  componentes passaram. Typecheck passou; lint sem erros, com um aviso
  preexistente em scripts/qa/connected-systems.mjs:18.
- QA sintetico Chromium:75 checks aprovados. O caso novo recebeu uma versao
  publicada, alterou o funil, preservou periodo week, nao repetiu refresh para
  versao igual e detectou updatedAt novo com generatedAt igual. Somente dados
  sinteticos;75 checks nao atestam o ciclo real de coleta em producao.
- Revisao independente conferiu pares de IDs e20 testes existentes de
  transformacao/monitor/scheduler, sem rede ou mutacao remota. Falha de leitura
  intercalada reproduzida em memoria; ocorrencia em producao nao foi verificada.
- Documentacao Next local use-router e Supabase maybeSingle consultadas.
  Changelog Supabase foi lido por HTTP apos o fetch web recusar text/markdown;
  sem mudanca de SDK, grants ou schema nesta tarefa.
- Suite global, CI, integracao e publicacao desta correcao ainda pendentes.
  Funis16f4587 publicados nao incluem esta atualizacao automatica ate novo deploy.
- A tela acompanha a ultima publicacao valida, nao promete atualizacao durante
  indisponibilidade de rede, autenticacao ou falha da coleta/publicacao.
  Pastas aprovadas permanece indisponivel ate haver serie mensal propria.

## Validacao local consolidada

- 180 testes focais passaram em sete arquivos, incluindo leitura intercalada,
  precisao de microssegundos, cancelamento, autorizacao e retry. Typecheck e
  build Next passaram. QA sintetico reexecutado apos revisao:75 checks verdes,
  incluindo entrega tardia de props, varios eventos durante espera e atualizacao
  por polling/foco sem repetir refresh quando a versao ja foi reconhecida.

- `pnpm test`:2.869 passaram,79 skips e uma falha preexistente no Windows em
  salesforce-inventory-api.test.ts:164 (symlink, esperado502/obtido200). A cadeia
  parou antes dos testes Node. Execucao separada do coletor:226 passaram/15 skips;
  release:113 passaram/11 skips POSIX. Nenhum teste foi desativado ou relaxado.
- Revisao crm-qa reproduziu quatro refreshes para a mesma versao enquanto a
  resposta RSC estava pendente. Corrigido e verificado por teste de deduplicacao,
  retry60s e reconhecimento das props;48 testes da reavaliacao passaram.
- E2E adicionado usa o Next real e segura a resposta RSC para verificar URL,
  filtros, scroll e details abertos. Esse caso anuncia metadata sintetica nova
  sem alterar o banco, portanto nao prova troca real de lote; a troca/reconhecimento
  e coberta no loader, no componente e na QA sintetica. Execucao E2E depende da CI.
- PR documental221 concluiu os tres gates aplicaveis na CI38564073920 e foi
  integrado em8e015c6. Nenhum runtime foi publicado para essa alteracao documental;
  a producao permanece16f4587 ate aprovacao/publicacao desta correcao.

Referencias tecnicas: [Next useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router),
[Supabase maybeSingle](https://supabase.com/docs/reference/javascript/maybesingle),
[CI anterior](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38558435232).

## Ajuste da fixture na CI

CI38570002899 em8421e85: validate aprovou2.870 testes/79 skips, tipos, lint,
build e auditoria sem vulnerabilidades conhecidas. Restore isolado e banco
passaram. Novo E2E falhou em13:30:39Z: esperava generatedAt string, recebeu null.
`local-rls-api.mjs:setupSql` nao cria dashboard global; nao e falha da API.

O caso foi movido integralmente para `dashboard-auto-refresh.mjs`, chamado na
QA autenticada apos `local-authenticated-visual.mjs` semear e verificar via RLS
o dashboard global. Reutiliza fixture e cleanup existentes; nao acrescenta
dado remoto, permissao, skip ou baseline. Asserts de versao, refresh unico,
filtros, scroll e details permanecem. Aguarda cada probe concluido antes do
proximo evento e remove interceptacoes ao finalizar. Nova CI completa exigida.

Revisao independente confirmou integracao unica no bloco desktop, pagina
isolada e cleanup existente. Lint/tipos/build passaram novamente. Suite local
teve2.867 aprovados/79 skips, symlink Windows e dois timeouts; reteste focal
executado sem build concorrente:33 passaram, somente symlink falhou.
Nenhum timeout ampliado ou teste desativado.

Retomada14:37:39Z: git fetch e GitHub confirmam main5c4d95e (Rotina, PR222),
CI push38581434699 em andamento; health publico200/ok permanece16f4587.
Integracao concorrente deve ser preservada e revalidada. Nenhuma publicacao
desta correcao nem alteracao da fonte de referencia.

## Diagnostico da QA autenticada

CI38582426726/8d7b6a7: primeira tentativa falhou no checkpoint da Rotina
daily-layout-720-light antes do helper novo.20 ciclos locais com helpers reais
passaram; os quatro arquivos dessa area sao identicos a main5c4d95e. Nenhuma
causa de CSS ou tolerancia comprovada, portanto esses arquivos nao foram editados.

Uma reexecucao dos jobs falhos passou toda a Rotina. Artefato11907544056
contem routine-results.json e connected-systems-results.json, mas nao o resultado
do dashboard nem dos passos seguintes. Job cancelado pelo limite45min em
15:47:25Z. Ausencia de checkpoints no helper impediu identificar a espera.

Hipotese inicial de clock herdado de checkConnectedSystems foi descartada como
nao comprovada: pauseAt pertence ao runner sintetico separado, nao ao helper
usado nessa matriz. Isolamento defensivo em contexto proprio, esperas de frame
com timeout10s e limite total60s no Node evitam outro hang ilimitado e geram
checkpoints sanitizados. Nao aumenta o limite da CI nem muda asserts/baselines.
Validacao do helper real permanece pendente de nova CI.

Consulta15:33:56Z confirmou main e health publico200/ok em5c4d95e, com todos
os quatro jobs da CI38581434699 aprovados. Deploy concorrente da Rotina foi
preservado;16f4587 deixou de ser baseline corrente e nao pode ser usado no CAS.

CI38594232559/791593c voltou a falhar em daily-layout-720-light antes do teste
novo. Agora a QA registra somente geometria/booleans dos predicados que falham,
sem texto, identidade ou dados comerciais; o teste de refresh passa a ocorrer
antes da Rotina, ambos continuam obrigatorios. Nenhum limiar/assert foi reduzido.
Revisao independente comprovou timeout de frame10s, isolamento20/20 e deadline
global60s em memoria; isso nao identifica a causa do cancelamento anterior.

CI38597977609/6fa3cd6 executou as tres sondagens e confirmou um refresh
pendente; chegou a release-rsc16:43:48Z e expirou60s aguardando a resposta/
Response.finished, antes dos asserts de preservacao. Clock herdado nao e causa
comprovada. O helper passa a exigir HTTP200, content-type RSC e ResourceTiming
da URL exata, iniciado depois da sondagem, responseEnd positivo e bytes
decodificados positivos. Prazo10s, mantendo60s global e todos os asserts de UI.

Referencia primaria de semantica:
[MDN responseEnd](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseEnd).
[Relato Next96243](https://github.com/vercel/next.js/issues/96243) descreve falsos
positivos de Response.finished em outra versao; nao comprova a causa neste CRM.
Nao houve atualizacao de dependencia nem relaxamento para aceitar corpo aberto.

Prova local independente do helper inteiro: resposta normal934ms e atraso400ms
passaram com tres sondagens/um refresh e preservacao de UI; corpo aberto foi
rejeitado em10.998ms pelo ResourceTiming. HTTP200/tipo RSC em todos os casos;
nenhuma entrada completa para o corpo aberto. Loopback sintetico, nao Next real.
Suite Windows apos main001969:2.876 passaram/82 skips, somente symlink falhou;
sem os timeouts anteriores. Tres testes Chromium de geometria passaram, assim
como33 testes focais (72 casos opt-in nao executados nesse comando).

CI38601828514/a8dc309 confirmou o helper Next real em17:08:57Z: tres sondagens,
um refresh, HTTP/tipo RSC, ResourceTiming completo e preservacao de estado.
Falhou depois na Rotina: data-view=day com minWidth=960px, demais medidas sem
overflow. QA passa a aguardar toHaveCSS exato0px/960px para o modo antes de
capturar geometria; assert anterior permanece e tolerancias/CSS nao mudam.
Isso trata o ponto observado, sem atribuir causa interna nao comprovada ao browser.
Regressao Chromium simula CSS day ainda960px e posterior0px; helper aguarda
sem aceitar geometria incorreta. Quatro casos passaram, incluindo tres temas
agora em1440/720/390px. Lint focal passou; nenhum arquivo de runtime alterado.
