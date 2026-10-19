# Aprendizados e atualizacoes

## 2026-10-19: retomada — refinamento da Previsão

- Nova demanda sobre a entrega integrada no PR #259: calendário 30% menor e
  estável durante a interação, dias validados restritos a sexta, sábado e
  domingo, títulos dos nove empreendimentos com quebras prescritas, colunas de
  mesma largura, linhas compactas de 22 px e realce no ponto sob o mouse.
- `origin/main` em `32c7cbdff5147890d8e9a49e58ea31ed2c2965e5`, com CI push/main
  `39211218104` aprovada. Produção observada em `2026-10-19T11:58:38Z`:
  HTTP 200, status `ok`, versão `3002d578a2db346883e661c4ba568faa4ff99c26`.
  A versão publicada não contém o PR #259; a captura do erro é evidência do
  comportamento observado pelo usuário, sem provar a origem sozinha.
- O contrato remoto continua anterior à migration local
  `20261019004204_crm_forecast_action_plan.sql`. A autorização específica
  solicitada para essa migration não foi concedida; nenhuma alteração remota
  foi feita. O refinamento será integrado e validado antes de renovar a
  solicitação de aplicação e recuperação.

## 2026-10-19: Gestão > Meta editável publicada

- PR #260 integrado em `3002d578a2db346883e661c4ba568faa4ff99c26`. CI do PR `39198445488` aprovada; CI de `main` `39202510879` aprovada após repetir somente o job que falhou transitoriamente na consulta externa de taxas documentais. Nenhum gate foi removido ou ignorado.
- Artefato imutável `12164931560` conferido por checksum e revisão. `image:prove` aprovou dois perfis no ID local `sha256:efa0d85cb298c0b85fb839c2a462cffb0a6174257920927daeefd01eb99bb5e9`, sem rebuild.
- Publicação protegida concluída em `2026-10-19T05:59:19.007Z`, deployment `2c8cfb30-b73a-4180-b7e7-56b2aa2c5df5`. Health público `ok`/`3002d578`, container `healthy`, rota anônima `/app/configuracoes/metas` com `307` para login e ledger sem pendência.
- Escopo final restrito à página Meta e suas evidências. Não houve migration, mudança de Parcerias/Pontos, configuração de integração, mutação de dados remotos ou alteração de workflow n8n.

## 2026-10-18: Gestão > Meta editável e com salvamento

- Escopo exclusivo: `/app/configuracoes/metas`. O bloqueio visual vinha da divergência entre o gate da página (`crm.settings.manage`) e o gate Master-only do rascunho comercial. O formulário agora segue a permissão da própria página.
- **Salvar alterações** submete o formulário do cabeçalho. A Server Action valida os 17 campos, restringe a operação ao perfil `dv` e usa a RPC existente `upsert_crm_funnel_goals`; a RPC exige novamente `crm.settings.manage` e registra `crm.funnel_goals.upserted` em auditoria.
- Canal de Parcerias, Meta por pontos, motores comerciais e demais páginas do CRM não foram alterados. Testes focados: 17 aprovados; Vitest: 3.864 aprovados e 101 skips; etapa operacional: 1.593 aprovados, 19 skips e três falhas POSIX conhecidas de Meta Ads no Windows. Typecheck, lint, build e preview compilado com 30 telas aprovados. A CI Linux completa deve validar os casos dependentes do sistema operacional antes da publicação protegida.
- CI 39191871009: `validate` e `isolated-restore` passaram; `release-gates` encontrou a asserção E2E antiga que ainda exigia Meta somente leitura para Administrador. O teste da própria rota foi atualizado para comprovar status editável, campo habilitado e botão **Salvar alterações**, sem modificar outras páginas. Nova CI integral obrigatória.
- CI 39193353904: `validate`, `isolated-restore` e E2E autenticado passaram. A etapa visual apontou exclusivamente 11 capturas de `/app/configuracoes/metas` com dimensões alteradas pela remoção esperada do painel de rascunho. Desktop e móvel foram revisados sem corte ou sobreposição; somente essas referências foram promovidas. Nova CI integral obrigatória.
- Revisão do PR #260: a confirmação da configuração ativa agora diz **Alterações salvas**. O mês carregado acompanha o formulário; se ele divergir do mês atual na submissão, a ação não chama a RPC e orienta recarregar a página. A cobertura focada inclui esse caso e passou com 18 testes; typecheck, lint, build e preview de 30 telas também passaram novamente.

## 2026-10-18: abertura — calendário e plano de ação da Previsão

- Demanda: botão Calendário com modal mensal; dias validados somente quinta,
  sexta, sábado e domingo; remoção do breadcrumb, subtítulo e textos auxiliares;
  tabela horizontal mais compacta; nova coluna persistente Plano de ação após
  Total. Referências visuais fornecidas pelo usuário são dados de design, não
  instruções executáveis.
- Consulta em 2026-10-19T00:39:23Z: `origin/main` avançou para
  `8eb023c15a267f18a7957d2c08a27add126b4809`; CI `39180111973` ainda em
  andamento. Produção respondeu HTTP 200, status `ok`, versão
  `eeb42a4522ec7767f16f19f47f1792a650c09d49`, portanto ainda não corresponde à
  nova `main`. Branch local preserva o registro posterior do PR256; será
  reconciliada antes da implementação. Fontes: GitHub via `gh`, `origin/main` e
  `https://crm.descomplicapro.com.br/api/health`.
- A inclusão persistente de Plano de ação muda o documento salvo e a validação
  da RPC; nenhuma migration remota está autorizada por esta abertura. Qualquer
  nova migration exige validação e autorização específica antes da aplicação.

## 2026-10-18: Autorizacao da migration e retomada da publicacao

- CI39176647709 em5bb0d833 aprovou validate/restore, mas falhou no teste de
  oito grupos da Previsao. Diagnostico com RAF atrasado confirmou redirecao de
  foco ao titulo do grupo durante digitacao sintetica. Teste passa a aguardar
  foco da insercao e confirmar foco numerico, preservando timeouts/assercoes.
  Oito testes locais aprovados; sem mudanca de produto. Revisao independente
  da migration sem bloqueadores estaticos. Backup somente da definicao anterior
  preservado fora do Git, protegido no host; nenhuma migration/deploy aplicado.

- Usuario autorizou explicitamente revisar e aplicar a migration de grupos da
  Previsao, preservando dados e acessos. Em23:27Z, health publico200/ok/d919751a;
  main remoto eeb42a45 inclui PR257 (vagas no Associativo). CI39143952391 passou
  integralmente no head09dbca08, mas a base avancou. Integracao bloqueada por
  conflitos documentais; preservar ambos os registros e repetir CI do conjunto.
- Consulta MCP confirmou ausencia de crm_forecast_groups no historico remoto e
  RPC anterior MD5 9bb11666b25feae744f2ab24d0405f24, owner postgres, EXECUTE apenas
  postgres/authenticated, search_path vazio e limites10s/5s. Sem mutacao remota.
  Aplicacao condicionada a imagem validada pronta, backup da definicao anterior,
  reconferencia de ACL/RLS/dados e publicacao protegida. Fontes: PR255, Actions
  39143952391, origin/main, health publico e metadados Supabase. A autorizacao
  nao abrange outras migrations nem reescrita de previsoes existentes.

## 2026-10-18: Retomada de filtros e conciliacao Salesforce

- Consulta em 10:54 America/Sao_Paulo: git fetch concluido; PR254 merged,
  main d919751a51772dd0c57a582b9581e61412642ced com CI39100233037 success.
  Health publico HTTP200/status ok/version identica. Fonte: GitHub PR254,
  Actions39100233037 e https://crm.descomplicapro.com.br/api/health.
- Checkout codex/dashboard-resumo-compacto em6380394e preserva notas locais
  do encerramento anterior. Nova demanda: examinar video do erro recorrente
  e conciliar funis com Salesforce nos dois canais e filtros selecionados.
  A validacao anterior nao comprovou a causa nativa STATUS_BREAKPOINT;
  numeros reais filtrados ainda exigem conciliacao atual. Sem mutacao remota.

- Retomada: video confirma STATUS_BREAKPOINT; substituido caminho nativo dos
  filtros por disclosure React. Nao afirmar causa interna do Chrome comprovada.
  Carga13:32:48.967Z e UI conciliadas nos dois canais:913/68/51/128/13 no mes;
  medias e periodos coincidentes. Sem coleta nova nem alteracao dos calculos.
  Auditoria: docs/audits/dashboard-filtros-conciliacao-2026-10-18.md.
  Tipos/build e32 testes aprovados; QA207 checks nos tres temas e cinco larguras.
  Lint com exclusao de artefatos locais passou; CI integral/publicacao pendentes.

- Rechecagem11:20: carga11:02:59.121 e UI coincidem916/68/51/128/13;
  tres novas oportunidades Direcional. Brutos nao localizados; prova limitada
  a artefato/UI. Usuario reabriu aba e quatro filtros fecharam por clique
  externo sem crash nessa rodada, ainda na versao antiga d919751a.
  CI39135151478 passou lint/tipos/testes Linux, falhou fonteITBI HTTP403;
  repeticao solicitada sem bypass. Deploy permanece bloqueado ate CI completa.
  Regressao inicial240s excedeu limite global; separar cenarios preservando
  assercoes, nao registrar teste incompleto como aprovado. Reavaliar com
  resultado por caso e CI do head atualizado. Fonte: PR255 e auditoria citada.

- Quatro cenarios isolados do controle React aprovados em3dde464d,32 ciclos
  sem erro coletado. CI39136199536 aprovou validate/restore/dashboard/banco,
  mas E2E ainda buscava summary antigo em release-candidate.spec.ts:1588.
  Corrigido seletor e ampliada verificacao autenticada de clique externo.
  Nenhum bypass: matriz visual/publicacao aguardam nova CI. Causa nativa
  STATUS_BREAKPOINT segue desconhecida; aprovacoes nao comprovam essa causa.
- CI39138212029 aprovou E2E e parou em dashboard-auto-refresh por seletor
  details/summary antigo. Helper atualizado para botao/grupo, preservando
  selecao, scroll e refresh RSC. Nao relaxar timeout nem ignorar a etapa.
  Revalidar matriz inteira no novo head antes de integrar ou publicar.
- CI39140025155 aprovada integralmente no head4877dd76: validate,
  release-gates (incluindo matriz autenticada/refresh) e isolated-restore.
  Em16:11Z, main avancou para6b6e88fb (PR256 Previsao por empreendimento),
  enquanto health publico segue200/ok/d919751a. Protecao BEHIND impediu
  merge normal do PR255; origin/main integrado sem descartar notas ou codigo.
  Nova CI obrigatoria do head combinado. Migration20261018142142 da outra
  entrega exige autorizacao propria e coordenacao de ativacao; nenhuma
  migration aplicada aqui. Pergunta ao usuario pendente, sem ampliar escopo.

## 2026-10-18: Resumo geral publicado

- PR254 integrado em d919751a51772dd0c57a582b9581e61412642ced.
  CI39100233037 aprovada em todos os jobs na segunda tentativa. A primeira
  parou na fonte oficial ITBI HTTP403; repeticao sem alterar ou ignorar gate.
  CI do PR39097282527 tambem aprovada, incluindo matriz autenticada completa.
- Artefato12125739919: checksum975754d2bd3cead2ac35b527597b04f4e87159a909452c6166e1a56dc6aadacf,
  revision exata, configuracao OCI4d00d36e e manifesto local66f822df com11
  camadas verificadas. image:prove aprovou os dois perfis sem rebuild.
- Producao anterior f8ad7bbf/deployment c4d5dc22, publicada por outra entrega,
  foi preservada como baseline CAS. Coordenador retornou deployed/codigo0,
  deployment d2fc040b-ad09-4442-8fd3-8b1317463b65, em2026-10-18T06:35:30.334Z
  (03:35:30 America/Sao_Paulo), sem pendencia. Imagem anterior preservada.
- GET publico /api/health em03:38 retornou200/ok e versao d919751a exata;
  GET anonimo /app retornou307 para/login. Status do coordenador confirmou
  recibo, imagem e ausencia de pendencia. Fontes: Actions39100233037,
  release:production deploy/status, prova OCI e health publico.
- Navegador autenticado em1440x900 e390x844 nos tres temas:13 funis visiveis,
  nenhuma quantidade decimal, nenhum overflow horizontal; titulos, etapas,
  valores e controles verificados sem corte. Filtro canal no desktop e gerente
  no celular fecharam por clique externo sem erro. Tema escuro e viewport
  original restaurados. Nao exportados dados privados ou credenciais.
- Limite: STATUS_BREAKPOINT original nao reproduzido; a sequencia de foco foi
  corrigida e validada, mas nao se afirma causa unica do crash nativo. Suite
  POSIX local Windows nao e comprovacao Linux: CI completa e a evidencia final.

## 2026-10-18: Vagas no Associativo

A linha de estoque e a descrição da unidade selecionada no Associativo exibem `VAGA: N`, usando `parkingSpaces`. Zero é preservado; valores ausentes ou inválidos exibem `VAGA: Não informada`. As variantes Investidor e Tabela Direta e os cálculos financeiros permanecem inalterados. A branch foi reconciliada com `main` em `6b6e88fb`.

Na retomada, passaram formatação, lint, tipos, build, 3.861 testes Vitest (98 skips condicionais), 1.610 testes operacionais (cinco skips Linux) e 723 testes de release (14 skips Linux). A CI Ubuntu é obrigatória para os casos POSIX. O navegador isolado confirmou 18 seleções reais com vagas zero, um e ausentes em 390/1440 px e três temas. A matriz completa do guia passou em 1440/375/320 px, nos três temas e com/sem proposta, sem erros de console ou requisições externas. Capturas sintéticas foram inspecionadas. Isso não substitui autenticação/RLS e gates completos da CI.

A CI anterior falhou na formatação documental e a segunda na formatação do novo teste de navegador, corrigidas sem relaxar gates. Produção consultada no ledger permanece em `d919751a`, publicada em `2026-10-18T06:35:30.334Z`. A `main` inclui o PR #256, cuja migration `20261018142142_crm_forecast_groups.sql` ainda não consta no banco produtivo e cuja RPC continua anterior. O runbook de Previsão exige autorização específica para essa aplicação remota; este PR não a executa. Merge, CI final e deploy permanecem etapas separadas, com DEPLOY-001 obrigatória.

## 2026-10-18: Validacao do resumo geral compacto

- PR254, HEAD f0329c03: matriz sintetica local aprovada,207 checks,
  temas light/balanced/dark e larguras320/390/768/1440/1920. Conferencia
  visual de capturas desktop/mobile nos tres temas sem cortes aparentes.
  Relatorio: test-results/dashboard-report/report.json. Filtros, historico,
  metas, navegacao, atualizacao automatica e piso de quantidades incluidos.
- Vitest completo repetido com maxWorkers=2:3808 aprovados,95 skips;
  os timeouts de Obsidian nao reapareceram. Suites operacionais Windows:
  1593 aprovados,19 skips,3 falhas de requisitos POSIX Meta Ads. Suite
  release Windows tambem falhou em requisitos de host e timeout Qlik.
  Nenhum requisito de seguranca foi relaxado para aprovar no Windows.
- CI Linux39093336285 aprovou validate no SHA exato, incluindo pnpm test,
  fontes oficiais, auditoria e build. Restore e E2E autenticado aprovados.
  Producao nao foi alterada. Revisao estatica independente
  sem achados no diff fe1b343e..f0329c03; nao substitui os gates pendentes.
- CI39093336285 reprovou apenas11 comparacoes de imagens /app, decorrentes
  do layout solicitado. Gates funcionais,242 auditorias de acessibilidade,
  zoom/teclado e canvas aprovados. Revisadas capturas desktop/mobile e temas;
  promovidas11 referencias e preservadas231, sem reduzir tolerancias.
  Artefato12124916025, SHA2568615a849aa566b93a8f05d48ca05cd82c7877b9b52bc0af8d026a6891918924d.
  Tree do merge de captura ec9ae253 equivale ao HEAD f0329c03; fingerprint
  recomposto com29 arquivos gerados. Manifesto guarda proveniencia completa.
  Nova CI verify obrigatoria: promocao de baseline nao aprova o run anterior.

## 2026-10-18: Abertura do resumo geral compacto

- Git comum confirmado; branch codex/dashboard-resumo-compacto parte de
  main fe1b343e. GitHub run 39088213591 terminou failure nesse SHA;
  run 39084939569 aprovou o main anterior 36f3c317.
- GET observacional de /api/health retornou status ok e version 840f0908.
  Fonte: https://crm.descomplicapro.com.br/api/health e GitHub Actions,
  consulta nesta retomada. Codigo integrado e publicado permanecem distintos.
- Escopo: corrigir fechamento dos filtros, compactar cabecalho, remover
  pulso/ritmo/reset, inteiros por piso nos funis e conferir a base dos relatorios.
  Usuario confirmou manter funis com filtros e periodos. Validacao e nova
  publicacao ainda pendentes; nenhuma alteracao de dados remotos autorizada aqui.

- Conferencia de origem: ops/salesforce/transform.mjs deduplica a coleta;
  connection-monitor publica diagnostics.sourceRows. analysis-transform.mjs
  restringe os fatos aos dois canais definidos; analysis.ts recorta os periodos.
  Usuario confirmou preservar essa restricao. Totais coletados desde janeiro
  nao equivalem ao mes vigente. Sem mudanca de contrato, banco ou workflow.
- Falha do main identificada em fonte oficial ITBI HTTP403. A verificacao
  local scripts/verify-documentation-sources.mjs passou nesta retomada;
  CI do candidato ainda deve comprovar acesso. Nao houve bypass do gate.
- Correcao dos filtros remove focus() durante fechamento externo; regressao
  reproduziu chamada indevida e passou nos quatro campos em desktop/mobile.
  STATUS_BREAKPOINT nativo nao reproduzido: a relacao causal permanece inferida.
  Typecheck/build aprovados; lint sem erros e dois avisos em test-results.
  Testes focados de relatorio/paridade: 44 aprovados. Matriz visual em andamento.
- pnpm test local: 3802 aprovados, 95 skips e seis falhas. Duas assercoes
  antigas do reset foram corrigidas e os 44 testes focados passaram depois;
  quatro timeouts/EBUSY em Obsidian estao sendo repetidos isoladamente.
  Nao alterar timeouts ou tolerancias para mascarar concorrencia. CI Linux
  completa do candidato permanece requisito antes de publicar.

## 2026-10-17: Dashboard3/5/5 publicado e validado em producao

- PR250 integrou o ajuste do timeout no main840f0908. CI39061398333 aprovou
  validate, release-gates, isolated-restore e promotable-image; a matriz visual
  completa concluiu sem reduzir cobertura ou tolerancias.
- Artefato12112195227: checksum/revision aprovados. Divergencia esperada entre
  ID config da CI `fab39fbb` e manifesto local `0d2c7cd2` foi comprovada por
  index/config OCI, plataforma linux/amd64, label da release,11 camadas iguais
  no manifesto legado, OCI, diff_ids e RootFS, alem de image:prove2 perfis.
- `release:production` registrou deployment
  fc04ef76-1350-4298-8692-aed95b1bb2f8 no SHA840f0908, deployedAt
  2026-10-18T00:10:01.373Z, sem pendencia. Health publico retornou200/ok e a
  versao exata; container ficou healthy na imagem0d2c7cd2. GET anonimo /app
  retornou307 para /login.
- O comando deploy terminou com codigo1 e mensagem sanitizada depois de o
  recibo final ja estar gravado. `status`, imagem do container, health e CAS
  confirmaram conclusao; nao houve retry nem alteracao manual de ledger/lock.
  Reavaliar se o retorno nao zero reaparecer em outra publicacao concluida.
- Navegador autenticado:1440x900 e390x844 nos temas claro/medio/escuro,
  13 funis/16 artigos, sem overflow horizontal. Somente spans acessiveis1x1
  ficaram tecnicamente recortados por design; textos visiveis nao. Filtro de
  gerente abriu e fechou ao clique externo. Viewport foi restaurado.
- Fontes: PR250, Actions39061398333, artefato12112195227,
  `release:production status`, Docker inspect, /api/health e navegador real.

## 2026-10-17: Gate visual cancelado por limite global

- CI39037162463 no merge ca6c33cf aprovou validate, isolated-restore,
  promotable-image, E2E e todos os checks visuais registrados. A matriz ampla
  foi cancelada pelo runner ao atingir o timeout do job, sem assercao visual
  reprovada; o artefato nao foi promovido e producao permaneceu em eff7f729.
- `release-gates` passa de45 para60 minutos, preservando etapas, cobertura e
  tolerancias. Uma nova CI completa no `main` exato continua obrigatoria para
  publicacao. Fontes: Actions39037162463 e `release:production status`.

## 2026-10-17: Revisao visual do dashboard e retomada12:03Z

- CI38995290171: funcional, RSC, acessibilidade e zoom aprovados;11 diferencas
  intencionais /app revisadas,231 capturas preservadas. Baseline parcial
  promovida com hashes e proveniencia no manifesto, sem reduzir tolerancias.
- Git fetch: main61c9a6a8. GET /api/health12:03:55Z:200/ok, versaoeff7f729.
  PR245 aberto, HEADf6698997. Nenhuma publicacao do dashboard realizada.
- Incorporar base Qlik concorrente e repetir CI verify antes de merge/deploy.
  Fontes: Actions38995290171, PR245, origin/main e health publico.

## 2026-10-17: Locator de filtro fechado na verificacao RSC

- CI38993369136 aprovou validate, restore, matriz sintetica e E2E autenticado.
  Refresh chegou a state-preservation; checkbox dentro de details fechado nao
  e encontrado por getByRole padrao. Reproduzido em Chromium local:0 vs1 com
  includeHidden, mantendo toBeChecked. Teste corrigido sem relaxar assercoes.
- Producao e baseline permanecem inalteradas; nova CI e revisao visual exigidas.

## 2026-10-17: Retomada do PR245 e base concorrente integrada

- Consulta GitHub02:01Z: PR245 mergeable, HEAD73d37fee; CI38993263801 iniciada.
  Mainf1088046 integrada preservando os registros Meta Ads e dashboard.
- GET anonimo /api/health02:01:42Z: HTTP200, statusok, versao34517ba2.
  Dashboard ainda nao publicado. Fontes: GitHub PR245/Actions38993263801 e
  https://crm.descomplicapro.com.br/api/health.
- Nao ativar integracoes ou servicos adicionais nesta entrega. Matriz local
  aprovada nao substitui a CI autenticada, baseline revisada e gates de deploy.
- Proximo criterio: CI funcional completa, revisao das diferencas visuais
  intencionais e nova CI de verificacao antes de merge/publicacao.

## 2026-10-16: Grupos de funis em validacao no PR245

- CI38972729758 aprovou validate/restore/E2E; matriz autenticada interrompida
  em dashboard-auto-refresh. Teste exigia filtro aberto depois de clique
  externo; alinhado ao comportamento solicitado e mantida selecao/RSC.
  Titulos de dialogs fechados excluidos da leitura de titulos visiveis.
  Artefato incompleto nao promovido; nova CI necessaria, sem publicacao.

- Resultado da CI38970011556: validate/restore aprovados,
  mas E2E exigia report-diagnosis-title removido. Atualizado
  e2e/release-candidate.spec.ts para exigir13 funis/78 etapas, ordem3/5/5
  e ausencia das secoes removidas. Guards e demais paginas preservados;
  nova CI obrigatoria antes de publicar. Comparacao visual autenticada nao rodou.

- Fonte GitHub CI38970011556: validate e isolated-restore aprovados;
  release-gates ainda em andamento. Base main34517ba2 integrada emc20d0dc7;
  arvore coincide com merge de teste1be8d014 emd75318ac599d8dd0660a65d4ad2eab268376b77b.
- GET observacional https://crm.descomplicapro.com.br/api/health em21:41:35Z:
  HTTP200/statusok/version34517ba2b2e4022f52bec29260e071b9cf124cca.
  Publicacao concorrente de Qlik; nao e a entrega dos grupos do dashboard.
- QA local:200 verificacoes aprovadas nos tres temas,320/390/768/1440/1920px,
  com dados sinteticos; build, lint, tipos e3670 testes Vitest aprovados.
  pnpm test local parou depois por ACL temporaria Windows em testes de
  publish-candidate Salesforce; sem relaxar permissoes. Comando completo
  aprovado na CI Linux da arvore equivalente. Limite e evidencia no audit
  docs/audits/dashboard-grupos-2026-10-16.md; reavaliar com gates finais.
- Nenhum deploy desta entrega, migration ou workflow n8n executado.

## 2026-10-16: Retomada dos grupos de funis

- Fonte Git fetch origin e GitHub via gh na VPS: main69ae9839, CI38928064973
  concluida/success; HEAD local1c91e0c no ramo codex/dashboard-grupos-periodos-20261016.
  Health publico18:42:09Z HTTP200/ok/66ed7360; integrado, local e publicado distintos.
- Escopo solicitado: grupos3/5/5, periodos limitados ao mes vigente, media anual
  por uma venda, fechar filtros fora/Escape, remover diagnostico/tabelas/equipe/ranking.
  Preservar metas por responsavel e roscas. Sem migrations ou workflows.
- Retomada preservou edicoes locais. Treze testes de periodos e teste de filtros
  em Chromium desktop/mobile passaram. Suite visual e gates globais em andamento;
  nenhuma publicacao desta alteracao. Revisar capturas dos tres temas antes do deploy.

## 2026-10-16: Conferencia autenticada dos tres temas

- Complemento responsivo16/10: inspecao autenticada em viewports1920x1080,
  1366x768,390x844 e360x800, alternando Claro/Medio/Escuro. Roscas, funis,
  filtros abertos, historicos e tabelas nos trechos examinados sem sobreposicao
  indevida. Medicao DOM nao encontrou overflow horizontal da pagina nem dos
  textos folha visiveis avaliados. Tabelas moveis possuem overflow:auto local;
  ultima coluna Hoje acessivel (scrollLeft233, largura343/conteudo576).
  Historico movel rolavel, largura357 sem overflow horizontal, altura811 e
  conteudo1188. Nao e teste em aparelho fisico nem garantia de toda combinacao.
- Captura nativa inicial divergiu do viewport; captura documentada com clip
  no scroll atual confirmou enquadramento correto. Evidencias JPG locais fora
  do Git. Console capturado sem erros; coleta mostrada14:03BRT. Viewport
  temporario removido, Claro restaurado, filtros limpos e dialogos fechados.
  Nenhuma alteracao de codigo ou deploy; suites nao repetidas nesta inspecao.

- Navegador de producao acessivel apos login pelo usuario. Claro, Medio e
  Escuro inspecionados na largura atual do painel (304px), com roscas, funis,
  metas e dialogos legiveis; nenhuma falha visual observada nos trechos vistos.
  Nao equivale a uma nova matriz desktop/mobile. Console capturado sem erros.
- Filtros de canal, gerente, responsavel e empresa exercitados; opcoes dependentes
  e limpeza confirmadas. Um responsavel produziu metas27/8/4/1; esperado ate
  hoje proporcional a16/31. Troca de tema preservou filtro e valores; limpeza
  restaurou315 responsaveis. Historicos: janeiro-setembro, julho-setembro e
  setembro, sem outubro ainda aberto. Fonte: UI autenticada, coleta13:33BRT.
- Estado final: tema Claro, sem filtros ou dialogos. Nenhuma alteracao de
  dados, integracao ou runtime. Health publico16:58:38Z ok/66ed7360; HEAD
  local1c91e0c e versao publicada continuam distintos. Nova consulta gh
  indisponivel no PATH; nao alegar nova validacao CI. Suites nao repetidas
  nesta verificacao observacional. Evidencias visuais locais fora do Git.
- Limite: disponibilidade de pastas aprovadas e metas nao definidas nao foi
  alterada. Reavaliar apos mudanca de dados, layout ou regras. Registro local
  de verificacao, sem nova publicacao de runtime.

## 2026-10-16: Sessão Meta Ads na página Integrações

A etapa implementa a conta de anúncios `1080988750909489`, no business
`310106776631136`, com console dedicado na VPS e status separado de Salesforce.
Não há nova página comercial nem extração de métricas nesta entrega. A leitura
exige acesso efetivo à página Integrações; o console exige também papel master.
A prova de conexão combina URL, conta e interface visível após atualização
controlada; URL ou sessão antiga isoladas não confirmam conexão.

O monitor evita atualizar o navegador enquanto o console está ocupado, publica
somente estado e horário e permite que a evidência expire após 120 segundos.
Os perfis, portas e segredos são exclusivos. O instalador não inicia serviços e
o coordenador aceita `deploy --meta-ads enable` e aplica a configuração com
backup integral, lock compartilhado e comparação atômica.

Build, formatação, testes locais e matriz sintética de navegador passaram; as
auditorias de dependências e segredos não encontraram achados. Esses resultados
não comprovam instalação, login na VPS, coleta ou publicação. Após login no
navegador local, a interface real confirmou a conta e os seletores; parâmetros
transitórios de navegação são aceitos com validação estrita, sem persistência.
A configuração automática do Obsidian não está instalada neste Git
comum. Fontes: código e testes desta branch, inspeção somente leitura da VPS e
runbook `docs/runbooks/meta-ads-vps-session.md`. Revalidar SHA, CI e estado real
antes de qualquer ativação.

## 2026-10-15: Dashboard, filtros dependentes e metas

- Aceite16/10/15:07Z: dois ciclos automaticos novos publicados e conciliados.
  Ingestoes14:36:04.49803Z e15:06:30.629428Z succeeded; inventarios confirmados,
  proximo ciclo15:30Z. Tres visoes presentes no banco, hashes dos fatos,
  contagens e generatedAt identicos a cada carga; segunda carga ja apresentou
  incremento real. Filtros dependentes, nove meses fechados do ano, julho-setembro
  e metas individuais (27 agendamentos,8 visitas,4 pastas,1 venda em outubro)
  conferidos usando codigo atual e agregados reais, sem exportar nomes/registros.
  Falha inicial nao se repetiu nos dois ciclos seguintes; causa nao comprovada,
  sem relaxar validacao. Reavaliar se houver recorrencia ou defasagem da coleta.
  Validacao local repetida: lint Node24 com zero erros/tres warnings existentes,
  tipos/build verdes,3654 Vitest/1181 Node/703 release, skips90/19/14.
  Fonte: journal sanitizado, carga privada no host e consultas agregadas MCP.
- Atualizacao16/10/14:24Z: coleta antiga retomou com ingestao14:06:19Z e
  inventario confirmado; preflight passou. Coletor66ed7360 ativado14:10Z com
  transacao preservada. Reload systemd reordenou dependencias sem mudar conjuntos
  ou identidades: CAS pausou antes do start; comparacao canonica e retomada
  restrita testadas91 Windows/90 Linux+1skip, mantendo bloqueio de drift real.
  Primeiro ciclo novo falhou antes de publicar; diagnostico somente leitura
  validou20230 oportunidades, mas nao comprova causa nem aceite integral.
  Aguardar dois ciclos completos novos. Health200/ok/66ed7360 e acesso anonimo
  redirecionado ao login; n8n inalterado, payload integral confirmado via MCP.
- Publicacao16/10/13:24Z: PR238 integrado em66ed7360, CI38901994232 com os
  quatro jobs verdes. Coordenador unico confirmou deploy69796520-5afb-4136-a8dd-9ffe0b907e97
  em13:24:00.784Z, sem pendencia; health anonimo confirmou66ed7360/ok.
  Preparacao aditiva do banco aplicada via MCP em13:23:14Z; trio do catalogo
  aplicado em uma unica instrucao atomica em13:24:47Z, apos a imagem compativel.
  Conferencias13:25Z e13:58Z preservaram permissoes antigas, overrides, papeis,
  visibilidade, ACL/RLS e policies fora do escopo. Catalogo:27 paginas,
  38 permissoes,146 vinculos de papeis,6 overrides e10 vinculos de usuarios.
  Nginx validado/recarregado13:25:41Z:8m somente no endpoint Salesforce.
- Coletor ainda antigo nesta conferencia: ciclo12:00Z deixou lock apos morte
  do processo; falhas13:00Z e13:30Z antecedem a troca do coletor, ainda nao feita.
  Owner morto, cgroup apenas com scheduler e ausencia de exportacao confirmados.
  Em13:42:03Z o lock original foi movido intacto para backup privado, sob trava
  de instalacao e CAS de identidade/metadados; nenhum dado ou credencial apagado.
  Aguardar ciclo natural14:00Z com publicacao confirmada antes da atualizacao.
  Guard de ciclo completo nao foi relaxado. Criterio final: dois ciclos reais
  distintos do coletor novo e conciliacao dos agregados; health nao os comprova.
  Browser de producao indisponivel por timeout de foco; matriz visual da CI
  aprovada nao equivale a inspecao autenticada em producao. Fontes: GitHub,
  coordenador, health anonimo, MCP Supabase e metadados/journal sanitizados.
- Conferencia16/10/12:38Z apos interrupcao de transporte: Git fetch concluido,
  PR238/25ec804 CLEAN/MERGEABLE, CI38892072377 verde em validate, release-gates
  e isolated-restore. Matriz visual terminou12:00:23Z; imagem ignorada em PR,
  conforme contrato. Ensaio PostgreSQL real do catalogo passou165+53 assertions,
  incluindo falha tardia/rollback e ativacao normal. Restore sintetico passou
  61 migrations/1910 assertions, preservando owners e privilegios efetivos.
  Gates locais completos: lint/tipos/build/format verdes; testes3654 Vitest,
  1181 Node e703 release, skips90/19/14. Health publico12:38:27Z200/ok/b5458ff;
  nada aplicado ao banco, app, Nginx, coletor ou workflow. Fontes: GitHub Actions,
  Git e GET anonimo. A aprovacao do PR nao substitui CI da main nem publicacao.
- Catalogo autorizado16/10: planejador offline fixa hashes do trio PR235,
  remove somente wrappers externos e produz uma unica instrucao DO em autocommit.
  CAS e preservacao abrangem cinco tabelas, inclusive user_roles.40 testes locais
  passaram; revisao independente sem bloqueio concreto. Ensaio compacto ampliado
  mantem165 assertions e acrescenta53, com falha tardia P0235 e comparacao integral
  antes/depois. PostgreSQL real ainda nao executado: Docker indisponivel neste
  Windows; CI deve comprovar o resultado antes de qualquer aplicacao remota.
  Lint global passou com tres warnings preexistentes; suite completa em andamento.
  Backup privado BdFdKs salvo/releitura/hash conferidos, sem dados comerciais;
  nao equivale a restore SQL e precisa novo snapshot/CAS antes da ativacao.
- Retomada16/10/10:55Z: usuario autorizou explicitamente coordenar tambem a
  atualizacao aditiva do catalogo, preservando acessos. A pendencia de autorizacao
  abaixo esta resolvida; testes, backup, transacao atomica e coordenador continuam
  obrigatorios. Git fetch confirma main2eae903 e HEAD2234298; PR238 aberto,
  MERGEABLE/BLOCKED. CI38858636662 passou validate/restore, mas release-gates foi
  cancelado, portanto ainda nao autoriza merge/publicacao do SHA atual.
- GET anonimo10:54:59Z200/ok/b5458ff e coordenador status confirmam deploy
  e42363ec-0f81-4084-9ced-aa405c263b09 de03:59:23.023Z, sem pendencia.
  Historico MCP Supabase permanece sem migrations do catalogo novo, somente
  master_all_permission_defaults apos o marco de preparacao. Fontes: GitHub/gh,
  Git, health publico e Supabase; nenhuma mutacao remota nesta conferencia.
- Encerramento16/10/05:54Z: PR238/cb3078f esta CLEAN/MERGEABLE e CI38854933173
  verde em validate/release-gates/restore. Build e tipos locais verdes; suite
  completa em componentes:3614 Vitest/1181 Node/703 release, skips90/19/14.
  Vitest precisou dois workers por timeouts locais de Obsidian, sem aumentar
  limites; CI Linux passou sem essa adaptacao. Worktree de codigo limpo.
- Publicacao retida por dependencia do PR235, nao por falha do dashboard:
  main2eae903 tem os quatro jobs verdes, mas health05:53:58.936Z ainda b5458ff.
  Coordenador registra deploye42363ec-0f81-4084-9ced-aa405c263b09 em03:59:23.023Z,
  sem pendencia. Supabase confirma17 paginas, ausencia da preparacao do catalogo
  e das novas permissoes; somente defaults Master aplicados. Runtime novo exige
  preparacao do catalogo para preservar acessos. Nao aplicar migrations alheias
  sob autorizacao exclusiva da analise. Usuario consultado: aguardar responsavel
  ou autorizar coordenacao aditiva do catalogo; sem resposta nesta verificacao.
  Reavaliar quando catalogo/runtime forem conciliados ou houver autorizacao.
- Nenhuma migration, app, Nginx, coletor ou workflow foi alterado por esta tarefa.
  MCP n8n confirmou versao ativa dcffaf09-354c-4a82-817c-5e6ca9da1dd5,
  payload integral e persistencia de execucoes desativada. Backup delimitado e
  operador temporario preparados nao comprovam publicacao. Fonte: GitHub/gh,
  GET anonimo, coordenador status, MCP Supabase/n8n; detalhes no audit.
- CI38851076367/f36f9fa concluida verde nos tres jobs de PR. Merge posterior
  2eae903 preserva restricao por etapa e analise somente no dashboard;156 testes
  focais passaram, inventario61 migrations/1910 assertions.11 capturas do
  dashboard e231 da main preservadas. Novos gates combinados ainda obrigatorios;
  migrations de catalogo alheias nao estao autorizadas por esta demanda.
- Retomada16/10/05:07Z: main2eae903 integrou PR235 de catalogo/permissoes,
  exigindo merge da leitura de etapas, inventario e referencias. Health anonimo
  05:07:33.837Z200/ok/b5458ff; GitHubPR238 conflitante. CI38851076367/f36f9fa
  ainda na matriz visual; lint/tipos/test/build locais passaram na repeticao
  (3556/1181/703, skips90/19/14). Primeira repeticao Windows teve dois timeouts,
  ambos passaram isolados e na suite completa sem aumentar limites. Nova CI
  combinada obrigatoria. Fontes Git fetch/GitHub/GET; nenhuma mutacao remota.
- CI38846827500/7804c73 concluida com validate, release-gates e restore verdes;
  imagem ignorada como previsto em PR. Merge posterior com cd004e4 requer nova
  CI. Operador isolado Linux:84 testes aprovados,1 skip exclusivo de Windows,
  sem mutacao de servicos ou dados. Nao substitui aceite real de dois ciclos.
- Retomada16/10/04:22Z: maincd004e4 integrou PR237 dos simuladores; PR238
  exige merge de documentos e manifesto. Preservadas11 entradas do dashboard
  e231 da main, incluindo quatro novas referencias moveis dos simuladores.
  Health anonimo04:22:48.788Z200/ok/b5458ff; CI38846827500/7804c73 ainda na
  matriz visual, validate/restore aprovados. Fontes GitHub/gh, Git fetch e GET
  publico; nenhuma ativacao remota desta tarefa. Nova CI combinada obrigatoria.
- CI38845696585/2014576: validate passou; QA sintetico encontrou disputa de
  foco ao abrir historicos em sequencia. Teste deterministico reproduziu:
  onClose atrasado roubava foco do proximo botao apos close nativo. Removido
  callback redundante; teste falhou antes/passou depois e quatro testes de
  navegador passaram. Nova CI continua obrigatoria; sem ativacao remota.
- Consulta16/10/03:28:58.816Z: health publico200/ok/b9377a1, atualizado por
  outra publicacao; mainb5458ff e branch2014576 sao distintos. CI38845696585
  em andamento no PR238. Fontes: GET anonimo, Git remoto e GitHub Actions.
  Nenhuma ativacao de analise/DDL/coletor desta demanda foi executada.
- Retomada16/10/03:27Z: mainb5458ff integrou PR231 de planejamento de metas.
  PR238 precisou novo merge. Manifesto combinado por JSON:11 entradas do
  dashboard preservadas e231 da main preservadas, todos os hashes conferidos.
  66 testes de inventario/paridade/navegacao/metas passaram; CI nova obrigatoria.
- CI38841091143/4fa4c5d: funcional/banco1883/restore/E2E aprovados. Matriz242
  completa com11 diferencas apenas em /app; referencias revisadas e231 restantes
  preservadas, incluindo Qlik. Hash/arvore/fingerprint comprovados no audit.
  Nova CI verify exigida; sem migration, coletor ou app publicados. Preflight
  Salesforce02:58Z confirmou Unidade de Negocio selecionada nas duas atividades.
- Retomada16/10/02:33Z: origin/main b9377a1 incorporado, preservando ranking
  Qlik v2 e suas referencias. Inventario combinado:56 migrations/1883 assercoes
  pgTAP. PR238 estava DIRTY, sem CI para d08070d; resolucao preserva testes de
  dashboard e ranking. Nova validacao obrigatoria antes de qualquer ativacao.
- Merge4fa4c5d em PR238, CI38841091143 iniciada; formatacao/lint/tipos verdes
  em02:35Z, restante pendente. Health anonimo02:35:49.765Z200/ok/d83c22d.
  Fontes: GitHub Actions/PR238 via gh e GET publico; sem mutacao de runtime.
- Verificacao local4fa4c5d: lint/tipos/test/build passaram,3547 Vitest/1181 Node/
  703 release aprovados;90/19/14 skips registrados. CI Linux e provas reais
  continuam obrigatorias. Revisao independente do merge sem achados no escopo.
- CI38834121342/3f05de8: validate/banco/restore aprovados; E2E exige links
  removidos da raiz e foi atualizado ao novo contrato, preservando as etapas.
  Matriz visual/merge/ativacao pendentes. Health16/10/01:23Z200/ok/d83c22d.
  Backup privado da funcao/ACL preparado, sem DDL ou dados de clientes;
  [evidencias e limites](../audits/dashboard-filtros-metas-2026-10-15.md).
- CI38836371948/270ccb3 repetiu banco/restore aprovados; E2E dependia de
  atributo opcional ausente sem snapshot. Seletor corrigido; quatro casos
  sinteticos passaram com/sem coleta. Matriz autenticada ainda pendente.
- CI38838263880/01cea33: E2E autenticado aprovado. Matriz parou no helper de
  auto-refresh que exigia link removido; atualizado para selecao real de canal,
  sem reduzir provas de RSC/estado. Referencias e ativacao ainda pendentes.

- Retomada18:36Z: maina7fdf92, CI38775901605 success; site200/ok/fae77f9.
  Branch codex/dashboard-filtros-metas criada do main. PR234 documental tem
  CI38773011324 verde, mas conflito com main; preservado sem integrar.
- Usuario definiu colunas: Gerentes de vendas, Contato Corretor Proprietario,
  Unidade de Negocio e Imobiliaria; canal limitado aos dois textos informados.
  Novas regras de meses fechados, metas e comparativos requerem verificacao
  do contrato completo. Confirmado depois: metas por responsavel unico dos
  relatorios filtrados, dias uteis segunda-sexta com quinta valendo2.
  Usuario autorizou explicitamente atualizacao aditiva do banco/coletor apos
  testes. Autorizacao nao e evidencia de aplicacao. Fontes:
  Git fetch/GitHub branches/main, PR234/Actions e health publico sem sessao.
- Validacao posterior:284 focais,37 Node e185 checks visuais aprovados; revisao
  isolou ranking via RPC protegida (68 testes). Global3245 aprovados/88skips,
  texto removido corrigido; O_NOFOLLOW no Windows requer CI Linux. Transporte
  Salesforce8MiB somente no endpoint exato, restante preservado. Nenhuma
  migration, configuracao remota ou workflow alterado nesta etapa.
- Main d83c22d integrado em b26ddaa; health16/10/2026 00:22:32Z200/ok/d83c22d.
  Fetch posterior mostrou main17ab106, CI38829007559 em andamento. Fonte:
  Git/GitHub via gh no host existente; versoes local/integrada/publicada distintas.

## 2026-10-16: Limite Qlik corrigido na fonte real

- Main17ab106/CI38829007559 quatro success; imagem imutavel e dois perfis
  comprovados. Owner deployment933a111d-17db-4ea3-a327-9f10be9cbaa6 promovido
  pelo coordenador00:58:46.990Z. Qlik real respondeu sem qix_metadata_limit.
- Metadados nativos00:58:46.525Z/recarga00:12:35.983Z,18438 bytes privados.
  Hash7972045382ad30177e123aa6716f176a76c41c695147e3d97c74be6424e96ffa.
  Mapeamento configurado com dois objetos reais, IDs CRC/MEM, DT e medidas
  pinadas.39 testes focais aprovados; nao equivale a conciliacao ou publicacao.
- Fonte JSON foi relida via SSH sem TTY: quebra de linha do terminal havia
  duplicado caracteres em transcricoes de hashes. Recusas ocorreram antes
  de escrita; pins produtivos usam somente os64 caracteres do JSON original.
- Fontes: coordenador/ledger owner, JSON nativo privado e testes locais.
  CRM continua d83c22d; fatos e agenda habilitada ainda nao comprovados.
  Manter interface congelada; proxima evidencia exigida e carga real conciliada.
- CI38829579490 validate/restore success, matriz falhou somente11Ranking
  por dimensions_changed. Captura38829579457/artifact12017910719 revisada,
  11 baselines e manifesto integral promovidos;231 demais imagens preservadas.
  Testref15pass/1skip. Prettier apenas formata JSON, igualdade semantica exigida.
  Collector+mapping260pass, lint/tipos exit0. Nova CI ainda necessaria.
- Build Windows exit0; teste completo falhou somente na fixture que esperava
  default produtivo null. Corrigida para definition:null sem relaxar bloqueio
  de HMAC/coleta. Novo teste completo e CI ainda exigidos.

## 2026-10-16: Coleta priorizada, interface congelada

- Escopo vigente: corrigir Qlik e provar atualizacao real via VPS, sem novas
  mudancas na interface. Canal de Parcerias continua referencia, recorte
  Direcional/SP CAPITAL/CANAL IMOB e destino /app/ranking preservados.
- Fetch/GitHub confirmam main17ab106; CI38829007559 com validate/restore/
  imagem success, matriz final ainda em andamento. GET publico00:53:44Z
  HTTP200/ok/d83c22d. Ledgers CRM72be7b10 e owner00bbab75/a7 sem pendencia.
  Nenhuma nova promocao realizada; aguardar gate sem dispensa.
- Checkout17ab tem codigo legivel e SDK/script aprovados como UID tecnico,
  Node24; assertQlikDependencies passou. Copia d83 tinha dependencias somente
  de producao e foi preservada em quarentena privada. Reposta com copia
  integral a7,38123 entradas verificadas, bytes preservados. JSON package
  difere apenas pelo comando QA compacto; lock byte a byte igual. Sem build
  na VPS, credencial ou perfil alterado.
- Nova leitura web da referencia retornou400/timeout; nao alegar atualizacao
  dessa fonte. Usar contrato observado previamente e documentado no runbook,
  nao valores antigos para conciliar a carga atual. Confirmar metadados reais
  apos promocao protegida. Fontes: GitHub, health e probes locais/host.

## 2026-10-16: Conferencia apos interrupcao e limite da entrega

- Conferencia00:47Z: Git primary7c11e3c limpo, exceto output preexistente;
  health publico HTTP200/ok/d83c22d. CI main38829007559/17ab106 com
  validate/restore/imagem success e release-gates ainda em progresso.
  Nenhuma nova promocao app/owner executada nesta retomada.
- Atualizacao real do ranking continua nao comprovada. Ultima falha nativa
  conferida foi qix_metadata_limit; preparar checkout/testes nao a resolve
  por si. Priorizar coleta real e reaproveitamento da referencia Canal de
  Parcerias, sem novas frentes de interface. Gates de seguranca/publicacao
  continuam obrigatorios, sem transformar este redirecionamento em dispensa.
- Fontes: Git local, GET /api/health e GitHub actions38829007559/jobs.
  Ferramenta de subagentes retornou not_found para os IDs anteriores apos
  interrupcao; nao inferir seus resultados finais. Logs locais preservados.
- Recibos locais posteriormente lidos em qa-primary-sequential-7c11e3c
  confirmam lint exit0, tipos exit0 e teste exit1 concluido00:42:33Z;
  build ainda sem comprovacao. Sessao SSH56092 tambem retornou not_found,
  sem comando novo ou alteracao de servicos. Nao declarar gates locais verdes.

## 2026-10-16: PR236 integrado, primary combinado

- Merge normal PR236/f7e6731 em17ab106 apos CI38802612284 tres success.
  Push/main38829007559 ainda pendente; nenhuma imagem antecipada. Local
  Windows OP so lint nessa rodada; CI Linux executou quatro comandos.
- Primary incorpora usuarios/presenca:55 migrations/1695 pgTAP planejados,
  focais28 e review das tres resolucoes sem achados. Baseline fullmain
  transitora96d5799b/242 imagens,11Ranking iguaismain/231 preservadas;
  testref15 pass/1skip. Recaptura combinada unica continua obrigatoria.
- Health/ledgers apos retomada permanecem CRMd83c/72be7b10 e ownera7/
  00bbab75 sem pendencia. Checkout17ab apenas preparado com package/lock
  iguais a d83c, sem runtime publicado. Fontes e limites em WORKLOG.

## 2026-10-16: Retomada e CI Linux completa do corretivo

- Relogio UTC retomado00:18Z apos intervalo longo de transporte/execucao;
  nao inferir atividade ou conclusao local pelo tempo. SSH97485 perdeu
  transporte; nova sessao56092 restabelecida sem alterar rede/contas.
- Fetch e GitHub PR236 confirmam main/base d83c22d, headf7e6731,
  mergeabletrue. CI38802612284 concluiu validate, isolated-restore e
  release-gates success; promotable-image skipped por ser PR. Este resultado
  nao comprova CI/main nem imagem/publicacao. Full Windows continua separado.
- GET publico sem cookies00:19:35Z200/ok/d83c22d. Ainda publicado o CRM
  concorrente, nao esta demanda. Nova consulta ao ledger/CI/main exigida
  antes de qualquer promocao. Mapeamento/fatos reais ainda pendentes.
- Fontes: Git fetch, GitHub PR236/actions38802612284/jobs e health publico.

## 2026-10-15: Pre-requisitos privados e tentativa autonoma

- Probe standalone readonly confirmou leitura/presenca/formato Supabase e
  HMAC;114 checks e review70, valores nunca exibidos. Nao comprova RPC ou
  aceite integral do transform. Guardas/caminhos/resultados em WORKLOG.
- Owner PID3849356/NRestarts0 ativo desde18:12:31Z. Tentativa autonoma
  20:12:51.412Z ainda unavailable/qix_metadata_limit, artefato privado
  7H0sjX/181bytes/SHA69aab608. Nao e carga de fatos. PR236/f7e6731/
  CI38802612284 validate success; restore/release pendentes nessa consulta.
- Fontes: systemctl show restrito, projector privado de enums/hashes e
  GitHub CI. Metadata novo e publicacao real continuam criterios de aceite.

## 2026-10-15: Consistencia do estado de selecao QIX

- Primary acrescenta estado$ explicito ao objeto proprio SelectionObject e
  exige qStateName$ em todos os layouts. Oito regressoes modulo/VM cobrem
  ausencia/alternancia antes de fatos/cleanup;247 focais aprovados, lint e
  format aprovados. Demais gates e runtime do delta ainda nao verificados.
- Revisao readonly consultou schema instalado12.612.0/Enigma2.15.0 e
  https://help.qlik.com/en-US/sense-developer/May2026/Subsystems/EngineJSONAPI/Content/models-selectionobject.htm.
  Layouts HyperCube/ListObject possuem qStateName oficial; nao relaxar
  guards pela ausencia no required OpenRPC sem evidencia real de omissao.

## 2026-10-15: Nova baseline CRM e retomada de transporte

- SSH2632 perdeu transporte; tentativa de reconexao e conector GitHub
  ficaram indisponiveis temporariamente. Sessao97485 restabelecida sem
  alterar contas/rede/permissoes. Nao houve mutacao durante a indisponibilidade.
- GET publico20:16:53Z confirmou200/ok/d83c22d. Coordenador status registra
  deployment72be7b10-a4f6-4178-8f9f-6049dd5ae0d3, d83c22d,
  imagem2e832356, deployedAt19:15:11.541Z, sem pendencia. Publicacao
  concorrente PR232, nao realizada por esta frente. Qlik owner00bbab75/a7fdf92
  permanece separado, rankingConnectedfalse e sem pendencia.
- CI38785519700/2f27e2f concluiu tres gates success; imagem PR skipped.
  Nao e CI main nem comprova carga real. Probe privado readonly de config
  recusou na fase imports: a7 nao possui o transform Qlik ainda exclusivo
  do PR216. Nao prova ausencia de credencial e nao alterou arquivos privados.
- Fontes: coordinator status/qlik-status, GitHub actions/jobs e health.
  Preservar nova baseline nas proximas operacoes CAS. Pins/fatos pendentes.

## 2026-10-15: Retomada observacional as18:56Z

- Git comum confirmado; fetch preservou codex/qlik-ranking-vps/2f27e2f.
  GitHub branches/main retornou d83c22d, merge concorrente PR232. Nao
  confundir main integrado com CRM publicado fae77f9: GET publico sem
  cookies18:56:18Z confirmou HTTP200/statusok/versao fae77f9.
- CI38785519700 no head2f27e2f: validate/restore success e release-gates
  ainda em progresso. Nao valida o hotfix OP nao commitado. Owner Qlik
  segue a7fdf92 com ultimo diagnostico qix_metadata_limit; sem evidencia
  nova de fatos publicados. Gates completos e nova coleta real pendentes.
- Fontes: GitHub API branches/main e actions/runs/38785519700/jobs,
  https://crm.descomplicapro.com.br/api/health e Git local. Reavaliar
  main/CI/health/ledger no minuto de cada promocao protegida.

## 2026-10-15: CI visual verde e limite real de metadados

- CI38777064690/0acb00f concluiu os tres gates success, incluindo verify das
  referencias combinadas. c00d390 acrescenta aliases e gates locais verdes,
  mas permanece somente local; nao confundir CIs de SHAs diferentes.
- Owner00bbab75/a7fdf92 promovido pelo coordenador18:12:40.057Z apos CI
  main38775901605 quatro jobs success, imagem/verificacao OCI11 camadas e
  dois perfis runtime. CRM8e3594fd/fae77f9 preservado; sem pendencia.
- Checkout inicialmente0700/0600 bloqueou antes de intencao. Modos somente
  da copia de codigo versionado foram normalizados, com hashes/Git limpo;
  1369 arquivos/203 diretorios. Probe efetivo com Node24/usuario tecnico
  passou. Ignorados/credenciais/perfil nao alterados; detalhes no ramo OP.
- Nova tentativa QIX gerou unavailable/qix_metadata_limit: snapshot privado
  7WjFNw/181bytes/afaa9c83/18:12:39.879Z. Limite especifico ainda desconhecido.
  Correto restringir projecao e diagnosticar, nao aumentar caps para passar.
  Nenhum fato publicado; corretivo separado em codex/qlik-bounded-catalog.

## 2026-10-15: Alias pinado e evidencia inicial real

- Cinco suites367/367 e review independente14 probes/367 testes passaram.
  Catalogo unico/fresco e hash integral protegem masters nomeados; enriquecido
  usa biblioteca explicita e preserva nativo/totais/IDs. Espacos/colchetes e
  fallback com biblioteca cobertos. Producao null; transitivas ainda pendentes.
- Lint/tipos/test/build globais passaram no Windows/Node24.19.0/pnpm11.20.0:
  total4979 aprovados/120 skips,51 paginas. CI Linux/publicacao nao inferidas
  desses skips; limites/assercoes preservados.
- Banco production consultado17:44:43Z: zero observacoes/publicacoes v2.
  Sessao CRM autenticada manualmente confirmada; ainda UI antiga. Referencia
  acessivel IAB17:38Z, mas agosto/fonte20-08 desatualizados, nao conciliacao
  atual. Projecao privada corrigida antes de uso real,38 testes sinteticos;
  detalhes e limites integrais em WORKLOG. CI main38775901605 ainda pendente.

## 2026-10-15: Publicacao concorrente observada

- Coordenador status consultado17:20Z registra CRM8e3594fd/fae77f9,
  deployedAt16:50:53.010Z, imagem3fc560e5, sem pendencia. GET publico
  /api/health17:20:49Z confirma200/ok/fae77f9. CI main38765178719 quatro
  jobs success. Este agente nao publicou esse dashboard; preservar baseline
  nova nas proximas observacoes/CAS, nunca reutilizar o esperado6843ef1.
- Checkout separado a7fdf92 preparado sem runtime; package/lock identicos a
  9ffc8a9, copia de dependencias38123 entradas protegidas/root/nlink1,
  sem bytes modificados ou build na VPS. CI38775901605 ainda pendente.

## 2026-10-15: Captura unica promovida para revisao verify

- Captura38770527668/aa9df803 success,242 hashes conferidos,11 Ranking
  revisados e231 preservados. Proveniencia unica; ZIPb8c118f1 e manifesto
  217a76c2. Detalhes/limites em WORKLOG. Nova CI verify ainda obrigatoria.
- Contrato antigo sourceMarkerVisible divergia do harness main que emite
  sourceMarkerVerified/Presentation. Teste agora exige os valores atuais
  exatos; nao remove RLS/contagens. Focal15 passou, um browser condicional
  nao executado. Ranking produtivo continua bloqueado por pins reais.

## 2026-10-15: Retomada observacional as16:50Z

- PR233/6b0350b: CI38769375192 concluida success nos tres gates do PR,
  inclusive matriz integral. Merge normal, com head exato, em maina7fdf92
  as17:16:04Z. CI push/main e imagem ainda pendentes; owner nao alterado.
- Gates locais de b4fc3fc, Node24.19.0/pnpm11.20.0/Windows, sequenciais:
  lint/tipos/test/build exit0. Vitest3199/87 skips, release703/14 skips,
  build51 paginas. Warning lint preexistente e MODULE_TYPELESS preservados;
  nenhum timeout/asserção alterado. Nao substitui CI/publicacao real.
- Fetch/GitHub: mainfae77f9; PR233/6b0350b com validate/restore success e
  matriz visual em curso. PR216/b4fc3fc permanece draft; captura combinada
  38770527668 e CI38770527596 em curso, sem aprovar outra versao por inferencia.
- GET publico de /api/health16:50:20Z:200/ok/6843ef1. Coordenador confirma
  CRM57c09296/14-10T20:38:13.413Z e owner3a4698b7/9ffc8a9/15:24:46.025Z,
  ambos sem pendencia. Fonte GitHub e health consultadas nesta retomada;
  metadados autonomos anteriores nao comprovam publicacao de fatos.

## 2026-10-15: Baseline integrada exige captura nova

- Mainfae77f9 integrado ao ramo Ranking. Referencia temporaria integral da
  main, manifesto2383f380/242 imagens verificadas, sem proveniencia mista.
  Lote Ranking anterior preservado em e03b972. Codigo Ranking inalterado;
  nova captura combinada/revisao exigidas antes de atualizar a referencia.
- Reference-parity15 aprovado e um browser condicional nao executado.
  CI completa ainda pendente. O PR de fatos segue draft enquanto faltam
  pins nativos/publicacao. Owner9ffc8a9 consultou QIX sozinho16:24:52Z,
  mesmo PID3446769/sem restarts desde15:24:35Z; ainda somente metadados.

## 2026-10-15: Supressao real nao implica zero

- Snapshot QIX real tinha qSuppressMissing true. Aceitacao agora depende da
  mesma prova integral nativo/enriquecido, sem converter NULL em zero. Dados
  ocultos, faltantes e totais divergentes continuam rejeitados. Focais218,
  incluindo15 regressoes novas, lint/formatacao aprovados. CI ainda pendente.
- Aliases reais =VENDAS/=VGV ainda requerem definicoes e precedencia; somente
  os nomes nao provam se sao variaveis/medidas/campos. Metadata corretivo em
  branch separada, sem enfraquecer o bloqueio produtivo do mapping.

## 2026-10-15: QIX real autenticado, mapping pendente

- Main9ffc8a9/CI38753275427 quatro jobs success. Download repetido apos gates,
  hashes/cadeia OCI11 camadas e image:prove2 perfis aprovados. Credencial
  systemd preparada sem expor valor. Desvio anterior nao dispensou gates.
- Owner3a4698b7/9ffc8a9 promovido15:24:46.025Z, CRM6843ef1 preservado,
  sem pendencia. QIX real leu metadados; recarga14:13:23.247Z. Snapshot
  privado0TX0aCu9/cf87dcb1/3318bytes, sem linhas de dados nem publicacao.
- Container sn-tabbed-container nao resolvido para Parceiras. Produto tem
  qSuppressMissing true e aliases VENDAS/VGV; conferir definicoes/identidades
  reais antes do mapping. Ramo metadata corretivo separado; coleta bloqueada.

## 2026-10-15: Mapping dinamico, ainda sem pins produtivos

- Factory/launcher passaram62 testes e review independente. Mesmo snapshot
  nas duas sessoes; novo ciclo recalcula YTD em Sao Paulo. Definicao/politica
  entram no SHA; periodos derivados nao. Default null bloqueia uso produtivo.
- Transporte preserva somente codigos QIX da allowlist existente, antes
  descartados genericamente. Script serializado/limites:149 aprovados/um skip.
  Lint/formatacao focais aprovados. Fatos e CI deste delta nao comprovados.

## 2026-10-15: Renovacao integrada, ativacao ainda bloqueada

- PR229/CI38747697537 aprovado; main9ffc8a9 integrado14:38:57Z,
  CI38753275427 ainda em execucao. Novo checkout/deps protegidos e HMAC
  dedicado root0600 preparados, sem ativacao ou leitura do segredo.
- Imagem isolada foi baixada/carregada antes de todos os gates, ordem incorreta
  detalhada na auditoria. Sem runtime promovido. Repetir download/verificacao/
  prova apos quatro jobs success; excecao nao altera o procedimento autorizado.
- Global local repetido:3176 aprovados/87 skips, timeout MCP devtools;
  isolado24/24 passou sem ampliar limites. Linux continua gate integral.
- Review QIX: mes excluido sem fatos falha fechado antes dos cubos. Nao
  converter X em zero. Ocorrencia real nao verificada; exige prova nativa se
  surgir. Fontes oficiais/limites na revisao, nao alterar selecoes por suposicao.

## 2026-10-15: Integracao candidata e limite das evidencias

- Renovacao integrada ao ramo PR216, ainda sem mapping produtivo. Revisao
  independente confirmou arquivo exigido ausente e argumento mapping nao
  encaminhado; ambos bloqueiam promocao, sem preencher hashes por suposicao.
- Host/inputs/engine553 aprovados/2 skips; launcher39. Lint/tipos aprovados.
  Global3176 aprovados/87 skips/um timeout30s no Obsidian; repeticao isolada
  22/22 aprovada, sem mudar limites. Build51 rotas aprovado. Node integrado
  teve timeout25s artifact-stale; repeticao isolada passou1,8s. CI obrigatoria.
- Arquivo historico preserva18 secoes completas, transferencia literal
  SHA256af225b06040f743196a1f859f513433e6d8215e69fef16d58135a4f2173dcde2.
  Sync voltou a passar. Fonte atual14:28Z: health200/ok/6843ef1; PR229 aberto,
  CI38747697537 ainda na matriz, validate/restore aprovados. Owner sem carga.

Historico integral: [arquivo de 2026-09-27 a 2026-10-13](ATUALIZACOES-ARQUIVO-2026-09-27-a-2026-10-13.md).

## 2026-10-15: Migration Qlik v2 autorizada e aplicada

- Fonte CI38742972444/ba96607 success e backup privado novo lAzyGoTT na VPS,
  checksums/fsync/modos conferidos. Supabase MCP aplicou somente a aditiva;
  historico20261015141558 corresponde ao arquivo20261014170549 aprovado.
  Nao usar repair/db push para igualar carimbos. Pos-check: RLS forcada,
  zero grants diretos novos/legados, writer service_role-only, reader
  authenticated-only e zero EXECUTE PUBLIC. Ainda sem fatos ou flag ativa.
  Detalhes, limites do backup e prova em WORKLOG/auditoria Qlik.

## 2026-10-15: Projecao delimitada e validacao inconclusiva Windows

- Ramo codex/qlik-bounded-catalog/basea7fdf92:207 focais aprovados e
  review independente22 probes sem P1/P2. Caps mantidos; catalogo relevante
  retido antes de validar comprimento. Diagnostico fixo inclui stage/kind/
  observed/maximum, sem campos/expressoes. Tres aliases adicionais somente
  com referencia direta. Ainda nao identifica qual limite real falhou.
- Lint/tipos exit0; teste global exit1/4918.24s,10 arquivos/26 testes
  falhos,2798 aprovados/85 skips,5 erros incluindo worker timeout. Causa
  completa nao isolada. Node/release nao rodaram e build interrompido;
  repetir com um worker apos integrar main e exigir CI Linux completa.
- GitHub main d83c22d/PR232; health publico20:16:53Z200/ok/d83c22d,
  ledger deployment72be7b10/deployedAt19:15:11.541Z/imagem2e832356,
  sem pendencia. Owner00bbab75/a7 permanece separado, sem fatos. Nao
  confundir main integrado, validacao Windows e runtime publicado.
- Fontes: GitHub branches/main, health e coordenador status/qlik-status.
  Transporte temporariamente indisponivel recuperado; nenhuma mutacao
  durante a falha. Proxima promocao depende de fresh CI/main/CAS e imagem.

## 2026-10-15: Owner atualizado, limite nativo ainda bloqueia

- Maina7fdf92/CI38775901605 quatro jobs success. Artefato11993912111 baixado
  somente apos gates: ZIPcd46ea9c, tare589a5cb, config3317425c e manifesto
  local9346dc27/11 camadas conferidos. image:prove dois perfis passou.
- Primeira promocao bloqueou antes de intencao, sem trocar owner/pendencia.
  Checkout novo sob umask077 tinha codigo0700/0600; dependencias estavam
  legiveis. Corrigidos somente1369 arquivos versionados e203 diretorios do
  candidato,1572 modos, hashes antes/depois e Git limpo. Helper revisado27
  casos, sem locks opcionais do Git. Ignorados/credenciais/perfil preservados.
  Probe inicial usou /usr/bin/node18 e nao valida o runtime; probe exato com
  /usr/local/bin/node24, env limpo e usuario tecnico passou SDK/script.
  Reavaliar em cada checkout novo; nao mudar umask/ACL global ou segredos.
- Promocao pelo coordenador as18:12:40.057Z: owner00bbab75/a7fdf92,
  sem pendencia, rankingConnected false, preflight unavailable. Snapshot
  privado7WjFNw,181bytes/SHAafaa9c83, observado18:12:39.879Z, motivo
  qix_metadata_limit. Nao atribuir o limite a um contador sem diagnostico.
  CRM8e3594fd/fae77f9 preservado, health18:12:04Z200/ok/fae77f9.
  Ramo corretivo codex/qlik-bounded-catalog separado; ainda sem fatos.

## 2026-10-15: Meta

Implementação no PR231; integração concorrente de main b9377a1 em andamento, produção ainda d83c22d (health200/ok,16/10 02:16UTC). CI anterior passou validação/restauração/E2E; nova integração exige CI completa. [Histórico integral, testes e limites](../audits/meta-2026-10-15.md). O histórico desta seção foi movido integralmente para a auditoria após atingir o limite de exportação do runtime; nenhuma evidência foi descartada.

- 16/10/2026,00:59 BRT: Gestão > Meta publicada em b5458ff, PR231 e CI38844155079 aprovados; health200/ok e barreira anônima307 confirmados. Deployment e42363ec-0f81-4084-9ced-aa405c263b09 sem pendência. Testes locais completos e242 comparações visuais aprovados. [Evidências, proveniência e limites](../audits/meta-2026-10-15.md#encerramento-publicação-verificada-em-16102026). Registro final somente documental, sem novo restart.

- 18/10/2026: PR240 integrado no SHA `8eb023c1` após a CI `39176723284` aprovar validação, restauração isolada e release gates sobre a `main` atualizada. O registro documental da publicação da Meta está concluído; não houve alteração de runtime ou restart.

- 18/10/2026, 12:59 BRT: retomada do PR240 no SHA `bbc3fbd3`. A CI `38848589053` aprovou formatação, lint, tipos e 717 testes, mas falhou na consulta documental do ITBI por HTTP 403; os demais jobs foram ignorados. O PR está conflitante com a `main` `6b6e88f` e será reaplicado sobre essa base, preservando os registros posteriores. Health observado em `https://crm.descomplicapro.com.br/api/health`: HTTP 200, `status=ok`, versão `d919751`; essa versão publicada não corresponde ao ramo documental e não comprova a correção solicitada para edição de metas.

## 2026-10-16: Publicacao app e recusa de fatos preservada

- Main b937/CI38839240305 quatro success. ZIP12021130754 SHA3f37c0258cd1fe10d10bfbd032a0132011c7068ac1fe71cf2a7de5d98240269f,
  OCI11 camadas e dois perfis comprovados. CRM a8a126eb-c373-4005-b68a-456012a6336b
  publicado02:59:30.399Z pelo coordenador, Qlik v2 habilitado. Health03:00:08.353Z
  200/ok/b937. Nao confundir endpoint habilitado com dados atualizados.
- Owner e26cdcd3 interrompido apos backup; recuperado17ab/c8314c64 via comando
  exato. Nova tentativa84cdd4c0 gerou recibo real03:02:41.093Z unavailable/
  master_pin_mismatch, sem publicacao. Recuperada em28b9ffc9/17ab03:07:20.476Z.
  Sem remover ledgers/travas, restaurar perfil automaticamente ou alterar ACL.
- Banco produtivo MCP03:10:14.101Z:0observacoes/0publicacoes. Diagnostico do
  artifact exige UID/GID997: tentativa root usou validador que compara gid do
  processo e recusou a leitura; nao era ausencia de arquivo. Projetor como
  usuario tecnico validou o recibo e imprimiu somente codigo fixo.
- Corretivo focal separa metadados opcionais alheios dos aliases pinados e
  acrescenta diagnosticos fixos de catalogo. Mecanismo local reproduzivel;
  entrada exata da fonte nao observada. Novo canario necessario para confirmar
  causa/resolucao, sem relaxar conciliacao, selecoes ou hashes. Interface intacta.
  Fontes: GitHub, coordenador, artifact sanitizado e Supabase MCP.
- Focais collector/artifact327:326 pass/1 skip POSIX, sem falhas. Label
  projetado ausente nao vira propriedade vazia; titulo/ID/hash nativos continuam
  obrigatorios. Alteracoes e colisoes seguem recusadas. Revisao independente
  sem P1/P2 de binding nos cenarios, nao confirma entrada exata da fonte.
- Lint/tipos/build Windows exit0 no corretivo. Teste completo registrou falhas
  de subprocessos locais fora do Qlik; conjunto ainda em execucao e causa
  nao isolada. Nao ocultar falhas ou reduzir cobertura. PR239 inicialmente
  sem checks; push documental synchronize sera conferido, sem alegar CI verde.
- Causa da ausencia de checks confirmada: PR239 CONFLICTING/DIRTY apos main
  PR231/b5458ff. Nao era evidencia de credencial invalida. Merge preservou
  secoes completas Meta/Qlik de CHANGELOG/WORKLOG; codigo e referencias main
  sem ajuste manual. Conjunto integrado exige CI nova, sem trocar baselines.
- Protocolo Qlik NxGroupTail permite qUp/qDown zero em paginas completas;
  duas regressoes direta/VM falharam antes e passam apos tratamento estrito
  de zeros. Array limitado por qSize.qcx, nao-zero/tipos invalidos recusados,
  area/matriz/reducao/totais preservados.388 focais:387pass/1skip POSIX.
  Nao atribuir o canario master_pin_mismatch a tails (fase posterior).
- Revisao readonly de tails sem P1/P2;44 testes focados de paginacao/reducao
  passaram. Nao substitui CI completa nem prova a coleta produtiva.

## 2026-10-16: PR216 integrado; promocao e fatos ainda pendentes

- Head8dd4a3e: lint/tipos/build Windows exit0; teste completo3334 vitest,
  1164 ops e703 release aprovados (89/19/14 skips explicitos). CI38834764103
  tentativa1 falhou por HTTP403 da fonte publica ITBI; tentativa2 concluiu
  validate/restore/release success, sem alterar politica, fonte ou gate.
- PR216 integrado normalmente02:12:36Z em b9377a1031865a01dccfbda4a87fa2d2dd84b2c5,
  arvore identica ao head. MainCI38839240305 em andamento, nao e autorizacao
  para baixar/promover imagem antes dos quatro jobs success. Captura adicional
  38834764063 tambem concluiu success; nao houve nova mudanca visual.
- Canonical b937 na VPS tem package/lock identicos a17ab,38123 dependencias
  verificadas e probe UID997/Node24 com SDK/script/mapa aprovado. Probe privado
  readonly do transform retornou complete/preparationAccepted true, sem revelar
  ou escrever segredos; nao comprova autenticacao Supabase/RPC ou coleta QIX.
- GET publico02:16:20.295Z200/ok/d83c22d. Coordenador confirma CRM72be7b10,
  publicado15/10/19:15:11.541Z; owner933a111d/17ab,16/10/00:58:46.990Z.
  Ambos sem pendencia. Nenhum servico alterado por esta preparacao.
- Supabase MCP confirmou projeto hnncxuerlcsaahdxoswb, production ACTIVE_HEALTHY;
  consulta01:34Z mostra0 observacoes/0 publicacoes. Writer presente com assinatura
  de cinco argumentos igual migration, service_role permitido/anon negado;
  probe inicial usou assinatura incorreta de dois argumentos, nao era ausencia.
  Reader presente. Fontes: Git/GitHub, health, coordenador, probes e catalogos.

## 2026-10-16: CI verde e nova base concorrente

- CI38846173348/cf2b1c1 tres success; merge normal bloqueado depois de main
  receber PR237/cd004e4. Conflitos somente documentais, sem codigo Qlik.
  GitHub required_status_checks.strict=true em consulta readonly: cada
  base nova exige checks novos. Nao mudar protecao ou alegar CI do SHA novo.
- Cinco registros Qlik deste PR movidos ao final dos tres documentos com
  hashes antes/depois iguais; conteudo restante preserva main, normalizando
  somente linhas em branco. Evita conflito de prefixo, nao dispensa nova CI.
  Ops/qlik e identico a cf2b1c1; nenhuma mudanca propria de interface.
- Windows lint/tipos/build exit0; pnpm test com1worker passou3337/1248/703,
  skips89/19/14. Timeouts anteriores nao reproduzidos, sem reduzir cobertura.
  Execucao local atravessou merge; CI cf2b1c1 atesta o SHA imutavel anterior.
- Metadata03:07:20.107Z/recarga02:14:57.356Z: pins de cubos, masters e aliases
  selecionados iguais aos revisados, sem ler fatos. Health03:55:48.744Z200/
  ok/b937. Coleta real corrigida e publicacao ainda pendentes. Fontes:
  GitHub/protecao/checks, Git/digests, recibos locais e projecao privada.

## 2026-10-16: Abertura da aba Previsao em Gestao

- Fonte: Git local e `git fetch origin`, consulta em 2026-10-17T02:21Z (16/10 em America/Sao_Paulo). Git comum confirmado; checkout inicialmente detached e limpo, SHA f10880465f80c8f1164a6db9aaea43907f14fdd1 igual a origin/main, merge do PR #243. Documentos de contexto/ferramentas lidos nessa base.
- GET observacional https://crm.descomplicapro.com.br/api/health: HTTP 200, status ok, version 34517ba2b2e4022f52bec29260e071b9cf124cca. Versao publicada difere da base local/main; health nao prova publicacao desta demanda.
- gh ausente no PATH e no caminho padrao. Conector GitHub consultado separadamente para metadados/CI; limites dos resultados devem ser preservados. Nenhum dado privado consultado.
- Escopo solicitado: nova pagina Previsao em Gestao, tabela manual com Nome do corretor, Previsao e Realizado, inclusao/exclusao de linhas/colunas e Salvar. Prints sao referencias visuais. Novas migrations remotas permanecem condicionadas a autorizacao especifica.

- Complemento da abertura: API publica GitHub confirmou main e PR #243 integrado; CI main 38988235307 concluida com success no SHA f10880465f80c8f1164a6db9aaea43907f14fdd1 (https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38988235307). O conector de workflow runs retorna apenas eventos pull_request e nao prova CI de main. Usuario autorizou explicitamente a migration aditiva da Previsao e permissao apos validacao; autorizacao limitada a esta entrega.

## 2026-10-16: Implementação e validação da Previsão

- Branch `codex/gestao-previsao`, base f1088046. Página e GET/PUT usam permissão
  própria `crm.management.forecast.view`; escrita exige também settings.manage.
  Tabela global manual, com equipe, colunas e linhas editáveis, sem cálculo ou
  integração comercial. As referências visuais não fornecem registros iniciais.
- Salvamento usa RPC com revisão otimista. RLS forçada e ausência de ACL direta
  protegem a tabela; usuário, conta ativa, MFA e página ativa são verificados no
  banco. Auditoria contém somente revisão/quantidades. Conflito e falha preservam
  o rascunho. Limites agregados de 2 MB complementam os limites de células.
- Build e tipos aprovados em Node 24.19.0/pnpm 11.20.0 Windows. Testes focais:
  backend 51, acesso administrativo 65 e contratos/recursos 33 aprovados.
  Navegador sintético: 5 aprovados, nove capturas em três temas e larguras
  1440/390/320, axe sem violações; inspeção das capturas desktop/escuro e
  celular/médio realizada. Isto não substitui uma sessão real de produção.
- Primeira suite global Windows: 3765 passaram, 17 falharam, 94 skips. Falhas de
  inventários/contagens foram corrigidas e retestadas; os demais timeouts e teste
  de concorrência requerem repetição com menor paralelismo e confirmação na CI
  Linux. Testes de banco locais não executados: Docker indisponível. Novo pgTAP
  tem 61 assertions; inventário agregado passa a 1971 em 34 arquivos.
- Projeto de produção confirmado pelo hostname do runtime e MCP:
  hnncxuerlcsaahdxoswb. Conferência prévia somente leitura encontrou 27 páginas,
  38 permissões, 146 vínculos de papel, 6 overrides e ausência da nova tabela,
  RPCs, permissão e página. Backup privado de catálogo, ausência dos objetos,
  histórico e hashes de preservação retido na VPS, modo 0600, SHA-256
  45ec1a83f82b5c5377fdce656d3047a1d4c619bfa5e08a47b7dd678075f664ef.
  Nenhuma migration aplicada nesta etapa. Reavaliar baseline imediatamente antes
  da aplicação; publicar somente com CI completa e coordenador de release.

## 2026-10-17: Retomada, CI e publicacao pendente da Previsao

- Fonte: PR #247 e CI https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38996000303 no SHA 58ff617ea8f775ea5ecc396c61ffcd883c8340a0. Tentativas 1 e 2 aprovaram formatacao, lint, tipos e pnpm test completo Linux (incluindo suites operacionais e release); pararam na fonte externa https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517 com HTTP 403. Segunda falha observada em 2026-10-17T12:02:45Z. Gate preservado; banco, restore e imagem nao executaram nessas tentativas.
- Fechamento local da base anterior: Vitest 3782 aprovados/94 skips, navegador sintetico 5 aprovados, formatacao/lint/tipos/build e Gitleaks aprovados. Suites Node Windows: operacionais 1386 aprovados/15 falhas/19 skips; release 711 aprovados/12 falhas/14 skips, com contratos POSIX e tempos do host, sem modificar assercoes para passar. Linux da CI aprovou 1419 operacionais (1 skip) e737 release. A validacao financeira externa passou localmente, inclusive em nova consulta desta retomada; isso nao substitui o gate da CI.
- Estado externo mudou durante a espera: fetch confirmou origin/main 61c9a6a8fe2813831bc167d91e6d7e0ab9b3bab4, PR #248 integrado e CI main39007579400 verde. Health observacional em 2026-10-17T12:03:29Z retornou HTTP200/ok/eff7f729c4386af14af16902fe4c761027df597a. Esta versao e de outra entrega; Previsao segue sem publicacao, merge ou migration remota.
- Integracao da main atual em andamento para manter o PR revisavel, preservando Qlik/House/Parcerias e suas referencias. Novo catalogo e restore devem somar as assertions recebidas da main e os61 testes da Previsao. Backup inicial e antigo e deve ser revalidado/refeito antes de qualquer aplicacao remota. A autorizacao especifica da migration permanece limitada a Previsao e seu catalogo, apos gates; nao inclui aplicar migrations Qlik de outra entrega.
- Limite de publicacao: o403 externo impede promocao enquanto persistir; nao alterar fonte financeira, remover gate ou declarar banco/restauracao aprovados. Reavaliar em CI completa do candidato integrado. Nenhum dado de producao foi gravado por esta tarefa.

## 2026-10-17: Validacao integrada da Previsao e correcao da fixture

- CI39031197492 no candidato8fe43e72 aprovou validate completo, inclusive fonte
  externa, lint, tipos, testes Linux, auditoria e build. Os cinco testes de
  navegador da Previsao passaram. Local integrado: Vitest3787 aprovados/94 skips,
  lint/tipos/build aprovados. O403 anterior deixou de ocorrer nesta execucao.
- Restore isolado interrompeu o pgTAP apos46 de61 assertions da Previsao.
  A fixture mantinha claim.sub do corretor depois de RESET ROLE e em seguida
  preparava override de Admin, atingindo o guard de contas administrativas.
  Corrigida somente a identidade da preparacao privilegiada;61 assertions e
  controles de runtime preservados. Teste focal release-candidate:21 aprovados.
  Confirmacao SQL depende da nova CI; Docker local permanece indisponivel.
- PR #247 ainda sem merge/publicacao; migrations remotas nao aplicadas. A
  autorizacao recebida permite aplicar as duas migrations desta entrega apos
  aprovacao integral dos gates e nova conferencia da baseline de producao.

## 2026-10-17: Banco e restore aprovados; matriz autenticada da Previsao

- CI39032248476, tentativa2, candidato f16b558f (merge sintetico794ded8a):
  validate aprovado; restore isolado aprovado em2026-10-17T12:37Z. Fonte ITBI
  retornou403 na primeira tentativa e respondeu normalmente na segunda.
- Ensaio de64 migrations e34 arquivos pgTAP:1972 assertions aprovadas na
  origem e no destino, incluindo61 da Previsao. Lint/advisors de seguranca e
  performance aprovados; backup/restauracao logica e fingerprints de ACL/owner
  preservados. Ambiente sintetico, sem restore remoto representativo.
- Release-gates aprovou banco e build; parou em local-rls-api.mjs com
  Application-page visibility does not match role permissions. Matriz de
  paginas esperadas em revisao para incluir a nova permissao sem relaxar guards.
  PR continua sem merge e producao sem mutacao desta tarefa.
- Retomada apos pausa do host: em2026-10-17T13:34Z, fetch confirmou main ainda
  61c9a6a8 e CI39007579400 success. GET publico api/health retornou ok/eff7f729.
  Fontes: origin, GitHub via gh e endpoint publico; versao da Previsao continua
  somente no PR. Matrizes QA corrigidas sem alterar acesso de runtime.
- Em13:38Z main avancou para ca6c33cf, mergePR245/dashboard; CI39037162463 em
  andamento. Integracao preservou dashboard e Previsao; conflitos restritos aos
  prefixos de WORKLOG/CHANGELOG, conservando ambos os registros. Matriz RLS e
  menu corrigidos passaram42 testes focais. Nova CI integrada necessaria.

## 2026-10-17: Previsao integrada e CI final aprovada

- PR247 integrado em47f5d449ccc0ac5f2f4bf8c948a5736979f2daea apos CI39037358734
  aprovar validate, restore e release-gates, incluindo navegador autenticado e
  matriz visual. CI main39040316212 aprovou os quatro jobs, inclusive imagem.
- Retomada em2026-10-17T19:11Z apos pausa do host: fetch confirmou main ainda
  47f5d449; GitHub confirmou CI concluida/success. GET observacional api/health
  HTTP200/ok/eff7f729c4386af14af16902fe4c761027df597a. A entrega esta integrada,
  mas a versao publicada ainda e anterior. Migration ainda nao aplicada.
- Preflight MCP14:32Z: somente nova pagina/permissao e dois grants Master/Admin;
  conteudo e acesso das27 paginas existentes preservados. Trigger renova apenas
  updated_at no snapshot. Backup privado14:01Z com checksum
  522f2c436a99093fe5164fee474d4bdee6a0037c4e8f9857da528865de0b9a81.
  Revalidar hashes e ausencia dos objetos antes da aplicacao autorizada.
- Nova retomada em2026-10-18T00:06Z (17/10 America/Sao_Paulo): main840f0908
  recebeu PR250, somente timeout da CI e documentos, sem mudanca de runtime.
  CI39061398333 concluida/success; candidato atualizado para esse SHA exato.
  Ledger ainda eff7f729/deployment6a8e7f60-2847-4e32-8be3-9c6e1d23ed39,
  deployedAt2026-10-17T04:49:20.557Z, sem pendencia. Primeira transferencia
  perdeu conexao SSH, mas arquivo47f5d449 chegou integro; nenhum deploy ocorreu.
  Artefato840f0908 baixado separadamente e checksum aprovado; prova OCI em curso.

## 2026-10-17: Previsao publicada e verificada

- Publicacao em2026-10-18T00:10:01.373Z (17/10,21:10 America/Sao_Paulo),
  SHA840f0908, CI39061398333 integralmente aprovada, deployment
  fc04ef76-1350-4298-8692-aed95b1bb2f8. Coordenador unico confirmou deploy e
  ausencia de pendencia; imagem imutavel com prova OCI e dois perfis aprovada.
- Migrations MCP autorizadas: crm_forecasts/20261018000941 e
  sync_page_catalog_forecast/20261018001010. Storage antes da promocao,
  catalogo depois do runtime compativel. RLS forcada/ACL sem acesso direto,
  tabela sem fixtures. Pagina ativa com grants somente Master/Admin.
- Backup final00:09Z preservou8 overrides, incluindo dois criados externamente
  durante a espera. Conferencia posterior confirmou hashes antigos de permissoes,
  grants e overrides iguais;27 paginas antigas preservadas salvo updated_at
  tecnico. Totais28 paginas/39 permissoes/148 grants/8 overrides.
- Health publico apos catalogo200/ok/840f0908; API anonima401 e pagina307 para
  login. Edicao validada na CI/sintetico, sem gravacao com conta real de producao.
  Evidencias e limites em docs/audits/previsao-2026-10-17.md. Registro documental
  posterior nao exige reinicio do aplicativo nem reaplicacao das migrations.

## 2026-10-17: Finalizacao do PR documental251

- Retomada em2026-10-18T01:05Z (17/10 America/Sao_Paulo). GitHub confirmou
  CI39081939465 aprovada no head d703d412, mas PR251 conflitante apos PR252
  documental integrar main36f3c317. CI main39084939569 ainda em andamento.
- GET publico api/health200/ok/840f0908, mesma versao publicada. Escopo desta
  retomada: preservar ambos os registros, repetir CI no head integrado e fazer
  merge somente apos aprovacao. Sem nova publicacao de runtime ou migration.
- Encerramento: CI39085264715 aprovada no head2e1c046a (validate, restore e
  release-gates; imagem dispensada em PR). Merge normal confirmado pelo GitHub
  em2026-10-18T01:55:20Z, commitfe1b343eeb1d5534f47779738b9fdbaf7d776d2f.
  Conflitos documentais resolvidos preservando os dois registros; nenhum gate
  dispensado. Health posterior200/ok/840f0908. PR251 concluido, sem novo deploy.

## 2026-10-18: abertura do ajuste visual da Previsão

- Consulta às 02:55 UTC: main remoto fe1b343e, checkout 1b75d003 com registro documental posterior. GitHub Actions 39088213591 de main falhou; causa ainda não inspecionada. CI anterior 39084939569 aprovada em 36f3c317.
- GET observacional https://crm.descomplicapro.com.br/api/health: HTTP 200, status ok, versão 840f0908e9c3d5c06f5a4dbb4cdf161404b31753. A versão publicada difere de main por registros documentais.
- Escopo autorizado: aplicar padrão visual do dashboard à Previsão, mantendo tabela editável e Salvar. Nenhuma alteração de banco prevista. Fonte: Git local/remoto, GitHub via gh e health público.

## 2026-10-18: Previsão alinhada ao dashboard — integração

- PR253 integrou em f8ad7bbfda9f22190018593266b1fa1769a1702f após CI39092735520 aprovar validate, isolated-restore e release-gates no head2e37ad71. Imagem é gerada apenas no push/main.
- Reutilizados canvas e tokens de /app, cabeçalho compacto, superfícies e Salvar destacado. Tabela padrão sem rolagem lateral em1440/390/320 px; colunas extras usam rolagem interna. Nenhuma alteração de API, permissões ou banco.
- Local: lint, typecheck e build aprovados; cinco testes de navegador aprovados, três temas e axe sem violações. Suíte geral teve três timeouts; repetição aprovou3803 testes e restou um timeout do Obsidian, aprovado isoladamente em13,56s. CI Linux aprovou a suíte completa; nenhum timeout ou asserção foi relaxado.
- Conferência04:01 UTC: main f8ad7bbf, CI39095660275 iniciada. Health público HTTP200/ok/840f0908. Implementado e integrado; publicação ainda pendente da CI exata de main e prova da imagem.

### Publicação confirmada

- CI39095660275: push/main f8ad7bbf, quatro jobs aprovados. PR253 integrado e runtime publicado em2026-10-18T04:51:47.145Z pelo coordenador release:production, retorno0, deployment c4d5dc22-ad9d-4fa4-a5aa-d20184a5339c, sem pendência.
- Baseline conferida às04:51:31Z: deployment fc04ef76-1350-4298-8692-aed95b1bb2f8, SHA840f0908, deployedAt2026-10-18T00:10:01.373Z. Coordenador executou consulta final, travas, backup e CAS no minuto da troca.
- Artefato: checksum ad9134c2a60f31612d0d4f2770beeb4894377e48304a6fb03aed7bb86c4c131f; config CI6c9d9680 e manifesto local cdd72fbb comprovados pela cadeia OCI,11 camadas, RootFS, label e plataforma linux/amd64. image:prove aprovou dois perfis usando a mesma imagem, sem imprimir segredos.
- Pós-publicação04:51:55Z: health público HTTP200/ok/f8ad7bbf; container healthy com imagem cdd72fbb. GET anônimo da página307 e API401. Nenhuma migration ou mutação de dados de negócio nesta entrega.
- Limites: interface validada com fixtures sintéticas locais e na CI; não houve sessão autenticada de produção nesta verificação nem gravação de fixture no CRM real. pnpm test local parou no Vitest por timeout; as etapas Node subsequentes foram comprovadas pela CI Linux. O teste restante de Obsidian passou isoladamente, sem alterar limites ou asserções.
- Fontes: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/253, Actions39092735520/39095660275, https://crm.descomplicapro.com.br/api/health, coordenador e provas locais. Reavaliar os timeouts locais apenas se reaparecerem isoladamente ou na CI.

## 2026-10-18 — abertura: Previsão por empreendimento

Consulta em 2026-10-18T14:16:41Z: GitHub main d919751a51772dd0c57a582b9581e61412642ced, CI 39100233037 aprovada; PR 253 integrado em f8ad7bbf. Health público HTTP 200, status ok, version d919751a. Branch codex/previsao-empreendimentos incorpora origin/main e preserva os registros locais de publicação. Fontes: GitHub via gh, origin/main e https://crm.descomplicapro.com.br/api/health. Nova demanda: sete grupos editáveis Previsão/Realizado, reordenação, números e totais calculados. Nenhuma alteração remota de dados realizada nesta abertura.

### Validação da implementação por empreendimento

Branch codex/previsao-empreendimentos: lint, typecheck e build aprovados; 45 testes de modelo e 46 de API aprovados. Navegador sintético: sete cenários funcionais aprovados, arraste real aprovado separadamente, matriz Claro/Médio/Escuro em 1440/390/320 sem overflow horizontal e axe sem violações. Capturas em test-results/forecast-preview (não versionadas). Suíte global inicial: 3.841 aprovados e sete falhas; quatro eram inventários atualizados nesta entrega e três eram timeouts locais. Após ajuste, os quatro arquivos de regressão passaram 75 testes; repetição global em andamento. Sem alterações de tolerância ou skips para ocultar falhas.

Migration 20261018142142_crm_forecast_groups.sql preparada, não aplicada remotamente. Projeto de produção hnncxuerlcsaahdxoswb confirmado via URL do runtime e MCP; RPC anterior hash MD5 9bb11666b25feae744f2ab24d0405f24, backup de definição sem dados preparado fora do Git. CI pgTAP/restore e autorização específica continuam pendentes. Fonte: código, logs locais e consultas observacionais MCP. Limite: capturas sintéticas não representam escrita ou sessão autenticada na produção.

### CI inicial e correção da fixture pgTAP

CI 39136448707 no SHA cde0b99d: validate aprovado (inclui suíte completa Linux); isolated-restore falhou porque o novo teste usava operador JSON junto de subtração sem parênteses. A expressão avaliava columns como inteiro e causava 22P02 antes da segunda asserção. SELECTs somente de constantes confirmaram a causa e a correção. Fixture corrigida, plano36 preservado, 67 testes focados aprovados. Nova CI obrigatória antes de merge/aplicação. Na repetição local, Vitest passou 3.848 testes; etapa Node teve 1.593 aprovados, três falhas de permissões/caminhos POSIX em Meta Ads e 19 skips existentes. Não foram alterados skips, permissões ou testes para mascarar essas limitações; validate Linux aprovou o conjunto.

### Revisão final do legado

Cenário sintético com cabeçalho antigo personalizado confirmou necessidade de usar o nome acessível fixo ao focar novas linhas. Ajuste de duas chamadas e teste de inserção/exclusão aprovados em Chromium (15,10 s). A execução 39137287690 passou testes, mas a fonte documental Prefeitura SP retornou HTTP 403; repetição solicitada sem alterar ou dispensar o gate externo. Nenhuma aplicação remota ou merge realizado.

### Lint SQL após a correção da fixture

CI 39137907096: validate aprovado incluindo a fonte documental que retornara403. A restauração avançou até o lint de banco e bloqueou por shadowed_variables/unused variable v_index na migration nova. FOR inteiro declara o índice implicitamente; removida a declaração externa redundante. Não houve mudança de regra, bypass de lint ou mutação remota. Nova CI necessária para comprovar pgTAP, lint e restore completos.

### Integração e autorização da migration por empreendimento

CI39138652862 no head ebd7ad414312895a778eb8d3f4b62c17e80c5d07 concluiu aprovada: validate, release-gates e isolated-restore; imagem é gerada apenas em push/main. Restore isolado comprovou65 migrations,35 arquivos pgTAP e2.008 testes na origem e no banco restaurado, lint/advisors aprovados e fingerprint correspondente. São dados sintéticos, não restauração de produção.

Usuário autorizou expressamente aplicar apenas20261018142142_crm_forecast_groups.sql depois da CI completa e restaurar a função anterior se a publicação falhar. Backup privado da definição anterior tem SHA2563d82ce724bf05b02c2ea0ba663e847b761c78619faae39528fb905b441d35c11; nenhuma previsão de cliente integra esse backup. A autorização não abrange outras migrations ou mutações de dados.

PR256 integrado em2026-10-18T15:51:32Z no SHA6b6e88fb33964e2ced5c2a07ecbf308e5f1875c5, sem bypass. CI push/main39142373485 iniciada. Consulta preliminar do coordenador: produção d919751a, deployment d2fc040b-ad09-4442-8fd3-8b1317463b65, publicada em2026-10-18T06:35:30.334Z, sem pendência. Migration e publicação ainda não realizadas; nova observação no minuto da promoção é obrigatória. Fontes: GitHub PR256/Actions, retorno do coordenador e autorização direta nesta conversa.

Retomada após mudança externa: main avançou para eeb42a4522ec7767f16f19f47f1792a650c09d49 (PR257, vagas no Associativo). Diff restrito a simulador/testes/documentação; Previsão e sua migration não mudaram. CI39165128618 push/main concluiu os quatro jobs aprovados em2026-10-18T21:38:38Z. Health observado HTTP200/ok/d919751a e ledger anterior sem pendência. Candidato atualizado para main atual; imagem6b6e88fb carregada mas nunca promovida. Autorização específica da migration segue válida para o mesmo SQL. Fontes: origin/main, GitHub Actions e coordenador.

### Previsão por empreendimento publicada

- Migration local `20261018142142_crm_forecast_groups.sql` aplicada via MCP ao projeto confirmado `hnncxuerlcsaahdxoswb`, sob autorização direta para aplicação e recuperação. Histórico remoto: `20261018232900 / crm_forecast_groups`. Somente a definição da RPC foi substituída; nenhuma previsão existente foi reescrita.
- Antes: save MD5 `9bb11666b25feae744f2ab24d0405f24`; depois: `752c15eebf5553125667fbe6295a0744`. RPC get manteve MD5 `e088aa7c1c66909618b0e21c66c1c705`. Owner postgres, security definer, ACL e configurações preservados. Backup privado anterior conferido; recuperação não foi necessária.
- CI final `39165128618`, push/main `eeb42a4522ec7767f16f19f47f1792a650c09d49`, quatro jobs aprovados. Artefato SHA256 `8d4d8d25d24cc2500180ec1e0a7cddcbce8b4a5043310b602c459d22f6e21bec`; config CI `6e6513a4f3d68594a81fbd0a38f9e431655f902f80386401455a5784b3f763ec`; manifesto local `a11cbf0a37dfca32954eb9bdbc259ab47fc379b6ec221e5a6ef51e5d97656348`. Cadeia OCI, 11 camadas, RootFS e linux/amd64 conferidos. image:prove aprovou os dois perfis na mesma imagem, sem segredos em saída.
- Coordenador `release:production` publicou em `2026-10-18T23:29:19.335Z` (20:29:19 America/Sao_Paulo), deployment `4ecf1a6f-18a9-4ab7-9dfc-31bb39ab3f5b`, sem pendência. Baseline: deployment `d2fc040b-ad09-4442-8fd3-8b1317463b65`, SHA d919751a, publicação real `2026-10-18T06:35:30.334Z`. Consulta ao vivo, CI/main, travas e CAS foram executados pelo coordenador no minuto da troca.
- Pós-publicação às 23:29:27Z: health público HTTP200/ok/eeb42a45; container healthy na imagem comprovada; acesso anônimo à página307 e API401. Testes funcionais autenticados usam fixtures sintéticas locais/CI; não foi feita gravação de teste em produção. Capturas desktop/celular são sintéticas, não evidência de uma sessão autenticada produtiva.
- Fontes: PR256, CI39138652862/39142373485/39165128618, MCP Supabase, coordenador e https://crm.descomplicapro.com.br/api/health. Implementado, CI aprovada, integrado e publicado são estados confirmados separadamente. Alteração concorrente PR257 preservada no candidato atual.

## 2026-10-18: Calendário e Plano de ação da Previsão

- Branch `codex/previsao-calendario-plano`, derivada de main `8eb023c1`. Abertura
  observacional às 00:39Z: health HTTP 200/ok em `eeb42a45`; GitHub indicava a CI
  39180111973 de main em andamento. Fontes: origin, GitHub via `gh` e health
  público. A divergência era externa à página e foi preservada pelo merge.
- Interface: botão Calendário e diálogo mensal destacam e contam exclusivamente
  quinta a domingo como dias validados. Outubro de 2026 tem 19; no dia 18 são 12
  passados e 7 restantes. Breadcrumb, subtítulo e instruções visíveis foram
  removidos. A tabela usa rolagem horizontal, corretor compacto, títulos em duas
  linhas e Plano de ação textual após Total.
- Persistência: documentos anteriores são adaptados apenas em memória com
  `action_plan` vazio; salvar persiste a nova coluna. A migration
  `20261019004204_forecast_action_plan.sql` substitui somente a RPC de gravação,
  sem reescrita de dados ou mudança de ACL/RLS. Ela ainda não foi aplicada e a
  autorização anterior não a abrange. Imagem nova e RPC nova devem ser promovidas
  juntas; a recuperação restaura primeiro a RPC anterior.
- Evidência local: lint, typecheck e build aprovados; Vitest 3.873 aprovados e 99 skips;
  API 47/47; navegador 9/9 em 1440/390/320, três temas e axe, com capturas
  sintéticas inspecionadas. A etapa Node teve 1.593 aprovações, 19 skips e três
  falhas POSIX conhecidas no Windows. `test:release` reproduziu 11 falhas da
  fixture Meta Ads por arquivo sintético ausente, inclusive isoladamente; nenhum
  arquivo dessa área foi alterado nesta entrega e nenhuma asserção foi relaxada.
  pgTAP da restauração isolada e CI Linux permanecem pendentes antes do merge.
- PR259, CI inicial `39184161292`: validate aprovado e restauração isolada
  aprovada. Release-gates parou no teste do oitavo grupo porque a asserção fixava
  um título em vez de ler o valor realmente criado. A verificação foi tornada
  independente do título e mantém as mesmas exigências de visibilidade, rolagem
  e reordenação; navegador focal 9/9 aprovado. Nova CI exigida, sem bypass.

## 2026-10-18: Meta vazia editável

- A referência pública confirma “Aplicar metas” no cabeçalho e controles numéricos editáveis na coluna Configuração. O preview local associava incorretamente `empty` a `canManageDraft=false`, gerando a imagem sem botão e com campos desabilitados.
- Fixture corrigida: estado vazio e autorização são independentes. Perfil autorizado vazio vê a ação, edita a meta mensal e mantém projeções sem valores inventados; `readonly` preserva o bloqueio explícito. Preview Chromium: 30 telas aprovadas, desktop/mobile, três temas, axe e overflow.
- Limite: a ação revisa e salva somente rascunho inativo; não ativa política comercial. A permissão Master-only existente foi preservada. Fonte: `https://descomplicapro.com.br/configuracoes/metas`, código e execução local em 18/10/2026.
- Validação local: lint, tipos e build aprovados em Node 24.19/pnpm 11.20; preview 30 telas e Vitest 3.861 aprovados. A etapa Node aprovou 1.593 e reteve três falhas Windows de Meta Ads já conhecidas, sem relação com o delta; integração exige CI Linux completa.

## 2026-10-19: refinamento do calendário e da grade da Previsão

- Base conferida às `2026-10-19T11:58:38Z`: `origin/main` em
  `32c7cbdff5147890d8e9a49e58ea31ed2c2965e5`, CI push/main `39211218104`
  aprovada. Health público HTTP 200/ok ainda em
  `3002d578a2db346883e661c4ba568faa4ff99c26`; a diferença confirma que a
  interface do PR259 não estava publicada. Fontes: Git/GitHub e
  `https://crm.descomplicapro.com.br/api/health`.
- O calendário foi reduzido em 30%, permanece aberto durante interações e conta
  somente sexta, sábado e domingo. Os nove empreendimentos conhecidos recebem
  as quebras solicitadas, largura uniforme e linhas de 22 px. Células recebem
  realce no hover e a rolagem horizontal preserva Total e Plano de ação.
- A falha de salvamento é incompatibilidade confirmada entre o documento com
  `action_plan` e a RPC produtiva anterior. O código não remove o texto para
  simular sucesso. A migration `20261019004204_crm_forecast_action_plan.sql`
  continua não aplicada e exige autorização específica; imagem e RPC precisam
  ser promovidas no mesmo ciclo protegido, com restauração da função anterior
  se a publicação falhar.
- Local: lint, typecheck, build, 103 testes de modelo/API/componentes, 49 focais
  e navegador 9/9 aprovados. Vitest completo aprovou 3.876 e ignorou 102; dois
  timeouts do Obsidian passaram isoladamente 22/22. Etapas Node/release
  reproduziram falhas e retenção de processo em cenários POSIX de Meta Ads no
  Windows, fora do delta. Nenhuma tolerância foi mudada; CI Linux completa é o
  critério de integração.

## 2026-10-19: abertura dos gráficos de agendamentos

Consulta às 00:10 BRT: checkout limpo e destacado em 59f1ee4799652694e2d2fd92aa12451675b7b9c1, origin/main no mesmo SHA após fetch. Health público https://crm.descomplicapro.com.br/api/health HTTP200/ok/eeb42a4522ec7767f16f19f47f1792a650c09d49; versão publicada difere do checkout. GitHub via conector retornou statuses vazio para o SHA local, sem comprovar CI; busca de PR por agendamentos retornou apenas PR71 histórico. gh ausente no PATH. Estado integrado e publicado ainda exige confronto antes da publicação. Demanda: gráficos diários, semanais e mensais e rankings de gerente, responsável, loja e empreendimento; manter validação de colunas da exportação Salesforce. Nenhuma mutação remota nesta abertura.

Conferência complementar da abertura: API pública do GitHub confirmou CI39189857296 push/main concluída com sucesso em59f1ee47, incluindo validate, release-gates, isolated-restore e promotable-image. Versão publicada eeb42a45 corresponde ao merge do PR257, anterior ao main consultado; essa diferença não valida a nova demanda. O relatório Salesforce aberto já continha Nome do empreendimento; o cabeçalho identificou Activity.Nome_do_empreendimento\_\_c. Conferidos apenas metadados para a implementação, sem gravar registros privados.

## 2026-10-19: implementação dos gráficos de agendamentos

Branch codex/agendamentos-graficos, PR261, implementação8307e637. Sete gráficos, três colunas responsivas e rankings integrais; mês independente do Ano do gráfico mensal, semanas segunda-domingo1ª–6ª com valores somente quando existentes. Removidos breadcrumb, Posição no funil e controles legados somente desta página. Loja e empreendimento foram separados no contrato analítico v2; v1 continua legível com empreendimento indisponível. A nova RPC filtra somente fatos de agendamento e reindexa dicionários; permissões existentes de etapa, visão, sessão/MFA e ranking preservadas. Coluna Activity.Nome_do_empreendimento\_\_c validada nos metadados de cada coleta; nenhuma alteração da definição salva foi necessária.

Validação local Node24.19/pnpm11.20: lint e tipos aprovados; build aprovado. Vitest global3.883 aprovados/101 skips existentes. Etapa Node1.595 aprovados/19 skips existentes e3 falhas Windows de Meta Ads (arquivo privado e diretório absoluto/POSIX), sem redução dos gates ou relação com a mudança. Novos testes focados e contrato aprovados; inventário67 migrations e36 arquivos pgTAP/2.036 asserções. db:test e db lint locais indisponíveis por ECONNREFUSED127.0.0.1:54322; execução SQL depende da CI Linux. A primeira rodada teve falhas de inventário e fixture de tupla atualizadas; repetição Vitest passou. Não houve alteração de timeouts ou skips para ocultar falhas.

Preview sintético com CSS do build Next:12 telas (três temas em1440/1024/390/320), dois cenários de31dias com1.000.000 por barra e um zoom de layout720CSSpx/2dppx. Todos aprovados, axe0, sem overflow horizontal, scroll interno ou colisões. Conferidos alturas das31barras proporcionais,24 responsáveis completos, ordenação e desempate, filtros independentes, legado v1, indisponível e restrição por perfil. Evidências não versionadas: test-results/appointments-preview/result.json e screenshots. Validação isolada do componente não equivale ao shell autenticado nem à carga real da produção.

CI39194511433 iniciada no head8307e637; resultado completo ainda pendente. Migrations20261019031700/20261019031715 preparadas e não aplicadas remotamente. Publicação, atualização do coletor e reconciliação do primeiro snapshot v2 dependem de autorização específica das migrations e dos gates completos. N8n não foi alterado. Rollback exige manter SQL/leitores compatíveis v1/v2; nunca reetiquetar v2 como v1. Fontes: PR261, logs locais, metadados da coluna no relatório Salesforce, código e runbook appointments-charts.md.

### CI inicial e ajuste da fixture de permissões

CI39194672592 em341edd46 aprovou validate Linux (incluindo testes e build), mas isolated-restore encontrou appointments_analysis com26 de28 asserções executadas antes de uma exceção e grants_matrix falhou na lista exata de funções do navegador. A fixture tentava criar um override na própria conta Master depois de definir auth.uid; o trigger existente proíbe essa mutação. Ajustado somente o preparo privilegiado da fixture para limpar a identidade antes das mutações de teste e restaurá-la antes de cada leitura autenticada. Acrescentada a nova RPC à lista exata auditada. Plan28, proteções, migrations e regras de runtime preservados. Nova CI obrigatória; nenhum SQL remoto aplicado.

A execução separada de test:release local registrou712 aprovados/14 skips existentes e11 falhas Windows nos testes Meta Ads de filesystem/caminhos POSIX. Esses arquivos não foram alterados por esta entrega; validate Linux da CI39194672592 aprovou a suíte completa. Não relaxar asserções; reavaliar se houver falha no Linux ou em cenário isolado pertinente.

### Lint SQL e preflight observacional

CI39195598335 em5d285bb8 aprovou validate Linux e passou o pgTAP da origem; a restauração avançou ao lint e bloqueou porque read_crm_appointments_analysis, STABLE, chamava a auxiliar de projeção com volatilidade padrão VOLATILE. A auxiliar só projeta o JSON recebido e usa funções JSON estáveis; marcada STABLE. Migrations ainda não aplicadas remotamente. Nova CI necessária, sem relaxar lint ou asserções.

Preflight observacional às00:41 BRT confirmou runtime e health59f1ee47 (HTTP200/ok), atualizado por outra publicação desde a abertura. Supabase host público do runtime coincide com projeto hnncxuerlcsaahdxoswb; três slices analíticas seguem versão1 e a RPC nova está ausente. Hashes MD5 de definição atuais: ingest_crm_salesforce_snapshot ae1ef7824854a5f98e8a2bc6f7d890dc; private.validate_crm_dashboard_analysis9f99dd850e2c63d654442d142739a790; read_crm_dashboard_analysis bcf49ac4c17098b9c2271f043de27bfa. Só metadados foram consultados, sem registros de clientes. Conferir novamente identidade, definições/histórico e backup antes de qualquer aplicação autorizada. Fonte: SSH observacional selecionando somente host público/SHA, MCP Supabase e health público; isso não substitui CAS/frescor do coordenador no minuto do deploy.

### Encerramento técnico e referências visuais de Agendamentos

CI39196528870 no head78707ecc (merge de teste c7251e03) aprovou validate, isolated-restore, pgTAP2.036 asserções, lint SQL e E2E. Release-gates falhou somente nas11 imagens de Agendamentos por dimensions_changed: larguras iguais e alturas reduzidas pela remoção solicitada dos blocos. Rotas154/154, temas88/88, acessibilidade242/242, teclado e zoom passaram;231 imagens ficaram aprovadas. Coordenador e QA inspecionaram desktop1440 e mobile320; adotadas somente11 imagens do artefato12162399175, com SHA/bytes conferidos, proveniência individual, comparação anterior e origem verify/falha/dirty preservadas. Não houve execução fictícia de update-baseline, afrouxamento de limiar ou alteração das231 demais imagens. Teste local reference-parity:15 aprovados/1 opt-in ACCOUNT_MENU_BROWSER ignorado. Nova CI no commit da adoção segue obrigatória.

Limite: a fixture autenticada geral não contém fatos analíticos e as imagens mostram indisponibilidade; não comprova os gráficos preenchidos nem a leitura RPC com carga real. Os sete gráficos têm evidência sintética separada com CSS de produção; pgTAP cobre a RPC e permissões. Reavaliar na implantação autorizada com primeiro snapshot v2 e conciliação agregada, sem dados privados. Fonte: artefato de CI e test-results/appointments-preview/result.json.

Conferência final em2026-10-19T04:32:33Z: fetch atualizou origin/main para2354a8d2 (PR259, calendário/plano de ação), enquanto esta branch ainda mantinha base59f1ee47. Consulta GitHub de workflow_runs para2354a8d2 retornou lista vazia, sem comprovar CI. Health público HTTP200/status ok/version59f1ee4799652694e2d2fd92aa12451675b7b9c1. Estados local, integrado e publicado distintos. Nenhuma migration remota, atualização operacional do coletor, merge do PR261 ou deploy desta demanda executados. Autorização específica das duas migrations foi solicitada e ainda não respondida; aprovação de entrega da pergunta pela ferramenta não é consentimento. Após resposta, repetir fontes/gates pertinentes e frescor/CAS no minuto da publicação. Publicação bloqueada até gates verdes e autorização das migrations; sincronizar conhecimento no encerramento.

Na sequência, integrado origin/main2354a8d2 na branch de Agendamentos para resolver conflitos de documentação e inventários compartilhados. Preservadas ambas as entregas e as três migrations; inventário combinado68 migrations,36 arquivos pgTAP/2.042 asserções. Perfil de dados validou29/29 testes focados de inventário/homologação, sem stage/commit nem mutação remota. A CI do novo commit de merge continua necessária; o sucesso anterior em78707ecc não valida automaticamente o novo estado.

Repetição local após integração, Node24.19/pnpm11.20: lint e typecheck aprovados; build aprovado; Vitest3.895 aprovados/102 skips existentes. Etapa operacional1.595 aprovados/19 skips e as mesmas três falhas Windows em Meta Ads (arquivo privado/permissão/caminho POSIX); pnpm test terminou1 e, pelo encadeamento, não executou test:release nessa repetição. Testes focados de inventário/homologação29/29 aprovados. Um script temporário local de adoção causou inicialmente erro de estilo require no lint; removido após uso e lint repetido com sucesso. Não houve mudança de regra, skip ou teste de produto para ocultar falha. CI Linux integral do novo SHA e autorização das migrations permanecem pendentes; nenhuma publicação alegada.

### Autorização e aplicação das migrations de Agendamentos

Em19/10/2026 o usuário respondeu “continua e publica”, autorizando continuar a publicação e as duas migrations específicas anteriormente apresentadas. A CI39200512469 no head7dbf0e77 aprovou validate, isolated-restore, release-gates, banco, navegador e referências; promotable-image foi corretamente ignorada por ser PR. Confirmado projeto Supabase `descomplica-crm-production`, ref `hnncxuerlcsaahdxoswb`, URL pública coincidente com o runtime e estado ACTIVE_HEALTHY. Definições anteriores registradas por hashes e histórico; nenhuma RPC de Agendamentos existia.

Aplicadas via MCP somente as migrations aditivas autorizadas, registradas remotamente como `20261019113232 appointments_analysis_stores` e `20261019113239 appointments_analysis_read`. Verificação: três payloads existentes permanecem versão1; nova auxiliar/RPC presentes e STABLE; `anon=false`, `authenticated=true`, `service_role=false` para EXECUTE da RPC; sem acesso direto novo às tabelas. Advisors posteriores mantêm alertas preexistentes; o novo aviso de SECURITY DEFINER autenticada é esperado para a RPC pública, que valida `auth.uid`, permissão da etapa, visão e ranking internamente e passou pgTAP. Não corrigir avisos alheios nesta entrega. Rollback operacional mantém as funções/leitores v1/v2, sem apagar snapshots nem contrair schema.

Antes de integrar PR261, `main` avançou ao SHA32c7cbdf pelos PR260/263, já publicado. O GitHub recusou merge por conflitos apenas em CHANGELOG, WORKLOG e manifesto visual. Integração local preservou ambas as notas e as referências de Meta e Agendamentos; manifesto combinado recalculado para242 imagens. `reference-parity`:15 aprovados/1 opt-in ignorado. Nova CI integral no SHA combinado continua obrigatória antes de merge/deploy. Nenhuma atualização do coletor, carga v2, merge ou deploy de Agendamentos ocorreu até este registro.

### Publicação e aceite do contrato v2

O PR261 foi integrado em `0ba37461c5615b290ac25b60f0970f0f9a3dcf2e` após a CI de PR `39246206975` aprovar validate, isolated-restore e release-gates. Antes da promoção, o PR264 de Previsão avançou `main` para `afb4a97df72a3c45a1982a8d520ef400eef2d985`; a imagem anterior foi corretamente rejeitada como candidata por não ser mais o topo. A CI de `main` `39264769472` aprovou os quatro jobs no SHA vigente, incluindo `promotable-image`.

Artefato `12192506863`: `image.tar.gz` SHA-256 `0b35c9331085f2c5f0468f8ce7ba66a793a81729b6106fab943e4c372284c56e`; revision exata e checksum aprovados. A configuração registrada pela CI é `sha256:67b0cfdfc724118cdd4405c3f67f773a02f0ad6459883b178097edfb644a8464`; o manifesto OCI/Docker no host é `sha256:493165cc26357d276a5cebd23764689f9b7a73bf3abcd92e25599cd2db21a393`. A diferença foi aceita somente após conferir index/manifest/config, plataforma linux/amd64, label da revisão, 11 blobs comprimidos, 11 camadas sem compressão, `rootfs.diff_ids` e `image:prove` nos dois perfis, sem rebuild ou retag.

Consulta imediatamente anterior mostrou produção no deployment `2c8cfb30-b73a-4180-b7e7-56b2aa2c5df5`, SHA `3002d578a2db346883e661c4ba568faa4ff99c26`, publicado em `2026-10-19T05:59:19.007Z`, sem pendência. O coordenador exclusivo publicou `afb4a97df72a3c45a1982a8d520ef400eef2d985` em `2026-10-19T14:50:45.273Z`, deployment `0eebcfc6-83af-4e09-947f-fe737fc58a5d`, sem pendência. Health público retornou HTTP200/ok na versão exata; acesso anônimo a `/app/etapas/agendamentos` retornou307 para login.

O coletor existente foi atualizado sob `installation.lock`, backup e CAS, preservando unidade, drop-ins, ledger, credenciais, destinos, agenda, navegador e monitor separado. WorkingDirectory passou de `66ed7360e5406129da20cde8983be4e51b7b83db` para o release `afb4a97d`; recibo privado em `/var/lib/descomplica-salesforce-collector-install/updates/20261019T145222Z-afb4a97df72a`. A primeira inicialização expôs apenas permissões de leitura insuficientes em `node_modules`; nenhum export iniciou. O serviço foi parado, a árvore de dependências tornou-se legível pelo usuário dedicado, o import foi comprovado e a mesma atualização foi concluída. Serviço ativo com PID estável, navegador ativo e monitor independente inativo.

Dois ciclos reais distintos foram aceitos: requests `025566d7-7c58-4642-9f3d-ba6e7ab64daf` e `2211a2cb-5732-4551-aca8-c995ce1fe950`, ambos `succeeded`, 155 registros e sem sobreposição. Inventários publicados às `2026-10-19T15:01:10Z` e `2026-10-19T15:36:10Z`, ambos com 3.298 itens na geração final. O snapshot vigente, gerado em `2026-10-19T15:33:04.883Z`, é versão2: todos os846 fatos agregados de Agendamentos têm11 posições; total1.097 em248 dias/10 meses,23 gerentes,118 responsáveis,14 lojas e33 empreendimentos. As três visões possuem dicionário de loja v2; nenhuma dimensão nominal ou registro individual foi exportado na evidência. N8n não foi editado: transportou o contrato integral já normalizado.

Validação local do registro final: lint, typecheck e build de57 rotas aprovados; Vitest3.900 aprovados/102 skips. A etapa Node aprovou1.595/19 skips e reproduziu somente as três falhas POSIX conhecidas de Meta Ads no Windows (arquivo privado e caminho absoluto), sem relação com o delta documental; a CI Linux completa `39264769472` permaneceu verde. Conferência posterior: ledger sem pendência e health HTTP200/ok ainda em `afb4a97d`. `origin/main` avançou depois do deploy para `f56236b3` pelo PR265; isso não altera o recibo da publicação concluída e deve ser integrado antes do PR documental.
