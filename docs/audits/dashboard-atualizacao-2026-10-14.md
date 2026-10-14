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

Retomada17:28:51Z: origin/main avancou para efc6a20 (PR226, seletor/contorno
da Rotina), enquanto health publico200/ok informou0019690. PR223 emfc5754e
ficou conflitante e nao disparou CI. Merge preserva integralmente runtime e
QA do PR226, assim como a espera exata de CSS e regressao adicionadas aqui.
Conflitos somente documentais, resolvidos mantendo ambas as evidencias.
Fonte: git fetch/log, GitHub PR223 e /api/health. Nova CI da combinacao exigida.

## Integracao efc6a20 e prontidao geometrica

CI38607169365/476c393: validate aprovou2877 testes/83 skips, lint, tipos,
build e audit. Restore isolado aprovado. Local Node24: build/tipos/lint
aprovados,103 testes focais e4 casos Chromium aprovados. Suite Windows teve
2874 aprovados/83 skips, symlink conhecido e dois timeouts DevTools; os dois
passaram no reteste focal sem alterar limites. Execucao inicial com Node25
nao foi usada como gate; as verificacoes acima foram repetidas com Node24.

Tentativa1 falhou no Associativo concorrente, etapa browser_fill_financing_failed:
3/4 contextos passaram, sem erros de pagina/HTTP. O diagnostico sanitizado nao
identifica a causa. Oito sequencias locais concorrentes passaram; repeticao unica
do job sem mudar codigo/criterios aprovou4/4 contextos e o E2E completo. Nao
atribuir a falha a foco sem prova; reavaliar com diagnostico sanitizado se repetir.

Tentativa2 aprovou refresh Next real17:59:09Z. Rotina falhou em720/light com
minWidth0, tableOverflowfalse e pageOverflowtrue. Artefato11917721064,
SHA256f52d01548059a98f56f790dc0b2d7b03b1c090d10df1cc631a11869bcd527978.
Prova independente com RAF updateHeading retido reproduziu esses predicados:
tabela694px, contorno1368px e pagina1419px no viewport720. Ao liberar RAF,
contorno656px/pagina720px e checks passaram. Mantendo retido, o assert existente
de alinhamento falhou em5.020ms.28 verificacoes naturais passaram; mecanismo
reproduzido nao comprova a causa historica da CI nem a jornada autenticada.

QA passa a chamar checkRoutineCurrentColumn depois do CSS exato e antes de
medir overflow. Nenhum assert, tolerancia, timeout ou runtime alterado. Regressao
sintetica exige sucesso quando o contorno converge e falha se permanece largo.
Essa espera e verificada, nao uma pausa fixa nem permissao para aceitar overflow.
Nova CI completa continua obrigatoria; sem deploy desta correcao ate aprovacao.
Seis casos Chromium passaram (incluindo rejeicao persistente), sem erro de
runtime; tipagem do cleanup da fixture ajustada para Node.parentNode.

Retomada18:14:35Z: fetch confirmou main77ddc69 (owner Qlik), health publico
200/ok permanece0019690. Head221ffbb ficou conflitante antes de disparar CI;
merge somente concilia os tres documentos, preservando codigo/lockfile recebidos.
Runbook/coordenador novos conferidos: operacoes Qlik sao separadas; pendencia
Qlik bloqueia deploy CRM. Esta tarefa nao aciona upgrade, coleta ou recuperacao
Qlik. Nova CI exata e consulta final de ambas as pendencias continuam exigidas.

Ordem diaria alinhada a semanal: overflow (CSS/contorno alinhados) antecede
geometria compacta. Evita medir celulas antes da barreira ja testada; nenhum
predicado ou tolerancia removido. CI38613560953 iniciou em0e1d827, mas o gate
final devera corresponder ao novo SHA que inclui essa ordem.

## Integracao aprovada

CI38614164208/703b59e concluida com sucesso:2877 Vitest/85 skips, coletores
350 aprovados/1 skip, release507/507, lint/tipos/build/audit, restore isolado,
banco/E2E. QA aprovou154 responsivos,88 temas,242 acessibilidade,242 comparacoes
e110 verificacoes de zoom; nenhuma baseline promovida. Refresh e Rotina passaram.
Suite local final Node24: lint/tipos/build passaram;2876 testes/85 skips, somente
symlink Windows falhou. Duas regressoes finais de contorno repetidas e aprovadas.

PR223 integrado em d660ba9121124be0094519814e6cbb5b704102b7. CI main38620208026
em andamento; isso ainda nao autoriza promocao. Checkout remoto isolado do SHA
foi preparado limpo, com install offline/frozen; nenhum build/teste pesado na VPS.

Consulta19:03Z pelo coordenador do candidato: producao77ddc69, deployment
ee03fade-fcd0-4c3c-b410-d2bc0abd57f7, imageId
sha256:d6f0f5783e2a3adf1cc92013710530c6deacfc97229de7b959164334332dae70,
deployedAt2026-10-14T18:42:12.845Z. CRM e Qlik sem pendencias. Publicacao
concorrente preservada;0019690 nao e mais baseline. Essa consulta e preparatoria,
nao substitui a observacao dentro do minuto exigida antes da publicacao.

CI main38620208026, tentativa1: testes aprovados; verificacao de fontes
documentais bloqueada19:04:51Z por HTTP403 da fonte oficial ITBI Sao Paulo
https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517. Uma repeticao do
job falho foi solicitada sem editar fonte, criterio ou regra financeira.
Imagem, gates seguintes e deploy permanecem pendentes ate CI completa verde.
Na tentativa2, validate passou integralmente: fonte oficial voltou a responder
sem mudanca de URL, regra ou criterio. Demais jobs em andamento em19:10Z.

## Preparacao e concorrencia de publicacao

CI38620208026/attempt2 concluiu com os quatro jobs aprovados em19:47:48Z,
incluindo a matriz completa. Artefato d660ba9 recebido diretamente dessa CI:
archiveSHA25605fee35c42c860030461e695f84515a515ae6cf3b542b2a61aaa4e1b3637431a,
configsha256:865ccdcf63f107eac2e56b42f640a801cec9936012d84e43b6164de8cb8688bd,
manifestsha256:d3cd32d9909d07c34818c0d7d9fcd2df2d4199cbbf41c7a3d046ee2256a61cf2.
Prova independente validou caminhos unicos, manifest/config,11 camadas, RootFS,
revisao e identidade Docker. image:prove aprovou os dois perfis, sem imprimir
secrets. Nenhum build/teste pesado executado na VPS.

Backup root:root0700 em /etc/descomplica-crm/dashboard-refresh-20261014-FTRqEA:
env e ledger privados0600, comparacao byte a byte aprovada. A impressao final
inicial recebeu CR no transporte PowerShell; a verificacao foi repetida com
saida somente de identificadores e confirmou a baseline77ddc69/ee03fade.

Duas tentativas exclusivamente pelo coordenador foram recusadas antes de
persistir intencao. A primeira19:52Z recebeu expected-sha incompleto (erro do
operador, corrigido). Na segunda19:55:35Z, com SHA completo, main ja havia
avancado19:55:08Z para6843ef1ca6ab1f4344c11cdd7491004fd4f9faa9, PR225 somente
documental. O CLI retorna mensagem generica; a divergencia confirmada bloqueia
o candidato pela politica, sem atribuir a mensagem a uma etapa interna nao
instrumentada. Status posterior confirmou77ddc69 e pendingDeploymentIdnull.
Nao houve bind, Compose direto, alteracao de locks/ledger ou contorno de gate.

Em20:00Z, CI38627677505 do main6843ef1 tem validate/imagem aprovados; restore
e release-gates pendentes. O novo SHA contem integralmente PR223, sem alteracao
adicional de runtime. Exige artefato proprio, CI completa e nova observacao no
minuto da promocao; d660ba9 aprovado nao autoriza publicar o main novo.
Fontes: git ls-remote, commit/CI GitHub e release:production status na VPS.
