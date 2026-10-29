# Aprendizados e atualizacoes — arquivo complementar de 2026-10-15 a 2026-10-27

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

### Abertura do ajuste visual dos gráficos

Em `2026-10-19T20:57:58-03:00`, o checkout foi atualizado para `origin/main`
`197cd012ae4a2021de3e9889fa1770d66cdf29e5` na branch
`codex/agendamentos-layout-uniforme`, sem mudanças locais. O GitHub público
mostrou a CI de `main` #964 concluída com sucesso nesse SHA; o cliente `gh` não
está instalado neste host. O health público retornou HTTP 200, `status=ok` e
`version=60ef87c7d52b5c68603e696a4cfe59dce92c4554`, anterior apenas ao commit
documental do topo. A demanda limita-se a manter rótulos e valores dos gráficos
na horizontal, uniformizar a altura dos sete cards e permitir rolagem vertical
interna quando o conteúdo exceder a área. Fonte: Git local/fetch, página pública
de Actions e `https://crm.descomplicapro.com.br/api/health`. Nenhum dado remoto,
contrato analítico, coletor ou workflow n8n será alterado.

Implementação local: valores e rótulos de dia, semana e mês usam escrita
horizontal e séries extensas quebram em linhas. Os sete cards têm 40 rem de
altura e corpo com rolagem vertical acessível por teclado, sem overflow
horizontal. Rankings, filtros e agregações permanecem inalterados. Preview com
CSS compilado do Next aprovou 12 telas em quatro larguras e três temas, zero
violações Axe, colisões ou diferenças de altura. Lint, typecheck e build de 57
rotas passaram; Vitest aprovou 3.952/102 skips. A etapa Node aprovou 1.595/19
skips e reproduziu três falhas POSIX conhecidas de Meta Ads no Windows;
`test:release` reteve o grupo Meta Ads dependente da fixture privada POSIX. A CI
Linux do SHA exato é o gate de integração e publicação. Fonte: código, execução
local e `test-results/appointments-preview/result.json`.

### Correção do estado sem dados após a primeira CI

A CI 39347120702 do PR270 aprovou validate e isolated-restore; release-gates
falhou somente em três comparações de Agendamentos. O artefato autenticado
12233333433 confirmou que a fixture não possui análise: a altura de 40rem havia
alterado as dimensões do estado indisponível em 1280 e 320px, e a captura balanced
ficou vazia. A imagem vazia não foi adotada. A altura fixa passou a existir
somente no componente Chart, mantendo o card sem dados compacto e preservando
nos sete gráficos preenchidos a escrita horizontal, a igualdade de altura e a
rolagem vertical. Repetir CI no novo SHA; o primeiro resultado não autoriza
merge nem publicação. Fonte: GitHub Actions 39347120702, artefato 12233333433,
capturas locais e código do componente.

### Encerramento e publicação do ajuste visual de Agendamentos

PR270 integrado no SHA `06a41f767fc721d4e85ac10142697a92e0fee0e1`.
CI de PR `39353605323` e CI de main `39357425838` verdes; a segunda aprovou os
quatro jobs e gerou o artefato imutável `12234994906`. ZIP e imagem foram
conferidos por SHA-256; revisão, manifesto/config OCI, plataforma linux/amd64,
13 descritores, 11 camadas, 11 diff IDs, rootfs e dois perfis de runtime
coincidiram no destino. A diferença config/manifest do armazenamento containerd
foi provada sobre o mesmo arquivo, sem rebuild nem retag.

Consulta imediatamente anterior registrou produção em `60ef87c7`, deployment
`561b4861-7f6a-477c-95d9-6f46427921d8`, `deployedAt=2026-10-19T20:51:02.314Z`,
sem pendência. O coordenador exclusivo publicou `06a41f76` às
`2026-10-20T02:57:56.421Z`, deployment
`979fb2df-a353-4df4-9c8b-b28caf2a9cf3`. Health posterior HTTP200/ok confirmou
a versão exata, ledger continuou sem pendência e a página anônima retornou307
para `/login`. Nenhuma migration, dado remoto, integração ou workflow n8n foi
modificado. A matriz com gráficos preenchidos é sintética; não houve acesso a
sessão privada de produção. Fonte: PR270, GitHub Actions, artefato12234994906,
coordenador de release, ledger e health público.

### Abertura dos indicadores e da tabela de Agendamentos

Em `2026-10-20T01:42:46-03:00`, o Git comum foi confirmado em
`C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git`. A branch
`codex/agendamentos-indicadores-tabela` partiu de `origin/main`
`2eb17cc052754519ebee1156060e394ea5728169`, sem mudanças locais. O health
público retornou HTTP 200, `status=ok` e versão
`06a41f767fc721d4e85ac10142697a92e0fee0e1`, que corresponde ao último runtime
publicado. A CI de push mais recente de `main`, execução `39366805822`, terminou
com falha no commit exclusivamente documental `2eb17cc0`; a CI anterior de
`main`, execução `39357425838`, aprovou o runtime `06a41f76`. O cliente `gh` não
está instalado; GitHub foi consultado pelo conector e Git por `fetch`.

A demanda amplia o contrato de Agendamentos com seis indicadores, previsão e
realização do dia, rankings regionais e de conta e uma tabela detalhada. O
contrato vigente publica somente fatos agregados e não contém linhas
individuais, horário, gerente regional, visita realizada nem ranking da conta.
Esses campos devem ser resolvidos pelo metadado vigente do relatório Salesforce
em cada coleta; nomes de API não serão inferidos, e dados pessoais ou linhas do
relatório não serão registrados nesta nota. Fonte: código atual, relatórios
`00OU600000ELaA6MAL` e `00OTT000009j0l32AA` indicados pelo usuário, GitHub
Actions e health público. Alteração remota de schema, caso necessária, continua
dependente da autorização específica aplicável.

## 2026-10-20: Abertura da edição de metas do Canal Parcerias

- Às `2026-10-20T04:03:57Z`, `origin/main` e o GitHub apontavam para
  `2eb17cc052754519ebee1156060e394ea5728169`; produção respondia HTTP 200,
  `status=ok` e `version=06a41f767fc721d4e85ac10142697a92e0fee0e1`.
  A diferença corresponde ao commit documental posterior ao runtime publicado.
- A CI de `main` `39366805822` falhou somente em
  `Verify current documentation fee sources`; os demais jobs foram ignorados.
  Essa fonte externa não valida nem bloqueia a investigação local da página Meta,
  mas uma CI verde no SHA candidato continua obrigatória para integração.
- Escopo solicitado: tornar a configuração do Canal Parcerias editável e
  salvável como Direcional Vendas, somente em `/app/configuracoes/metas`.
  Nenhum workflow n8n, dado remoto ou outra página será alterado nesta etapa.
- Fontes: Git local após `fetch`, GitHub branches/actions e GET observacional de
  `https://crm.descomplicapro.com.br/api/health`. O cliente `gh` está indisponível
  neste host; o conector GitHub forneceu as evidências equivalentes.

### Implementação e validação local

- Causa confirmada: Parcerias ainda carregava o rascunho inativo de política
  comercial e condicionava a edição a `crm.commercial_policy.manage`, enquanto
  Direcional Vendas já carregava e persistia a meta ativa com
  `crm.settings.manage` e a RPC versionada `upsert_crm_funnel_goals`.
- Parcerias passou a reutilizar integralmente o fluxo ativo: campos editáveis,
  botão `Salvar alterações`, validação de mês, persistência e confirmação na
  própria rota. A RPC existente já restringe o perfil e fixa em zero os campos
  que não pertencem ao funil de Parcerias; nenhuma migration foi necessária.
- Evidências locais: 32 testes focados aprovados; `lint`, `typecheck`, `build` e
  `format:check` aprovados; build com 57 rotas; Vitest com 3.954 aprovações e
  102 ignorados; preview específico com 30 telas, cinco larguras, três temas,
  edição habilitada, sem overflow e sem violações Axe.
- A suíte operacional Node aprovou 1.595 casos, ignorou 19 e apresentou três
  falhas já conhecidas na emulação POSIX de arquivos privados do Meta Ads no
  Windows. `test:release` reproduziu a limitação nas fixtures privadas do mesmo
  módulo. Não houve alteração nessa área; a CI Linux do SHA candidato continua
  sendo o gate conclusivo de integração e publicação.
- Na execução CI `39368979457` do PR #272, `validate` e `isolated-restore`
  passaram integralmente. `release-gates` aprovou banco, autorização, build e
  E2E, mas bloqueou na comparação visual porque a página Parcerias ficou menor
  após remover o bloco de rascunho inativo: 11 capturas da própria rota mudaram
  de dimensão. O artefato sanitizado `12241794237` foi inspecionado; os campos
  estavam editáveis, o botão `Salvar alterações` estava presente e não havia
  overflow. Somente essas 11 referências foram promovidas para nova validação;
  baselines de outras páginas permaneceram intactas.
- A execução seguinte `39373587403` parou no teste de integridade porque o
  resultado promovido preservou do artefato o marcador transitório
  `worktreeDirtyAtCapture=true`. O marcador foi corrigido para o estado limpo
  da baseline versionada; os 28 testes locais de catálogo/paridade passaram
  (27 aprovados e um ignorado) antes do novo envio.

## 2026-10-20: Abertura da previsão por período e gerente

- A branch `codex/previsao-periodos` iniciou no `origin/main`
  `099493a9f1f64730efd449364979384309c2ed44`. A CI de `main`
  `39411919967` concluiu com sucesso no mesmo SHA.
- Às `2026-10-20T12:18:13.3265927Z`, o health público respondeu HTTP 200,
  `status=ok` e `version=08d050f90c877009cd55140322b7c822e578d672`.
  A produção estava um commit documental atrás de `main`; esse estado não
  comprova a publicação da nova demanda.
- Escopo solicitado: selecionar fins de semana válidos no calendário, separar
  Geral, House e Imob por gerente, carregar e salvar previsões por período,
  manter dez corretores no estado inicial e compactar a grade com primeira
  coluna fixa, destaque cruzado e controles de empreendimento reposicionados.
- A migration `20261019004204_forecast_action_plan.sql` permanece versionada,
  mas ainda não foi aplicada no banco remoto. Qualquer migration adicional ou
  aplicação em produção continua condicionada à validação e à autorização
  específica do usuário. Fontes: Git local após `fetch`, GitHub Actions e GET
  observacional de `https://crm.descomplicapro.com.br/api/health`.

### Implementação e validação local

- A chave de persistência passou a ser fim de semana, segmento e gerente. House
  e Imob editam grades independentes; Geral devolve até doze seções completas e
  somente leitura, preservando personalizações diferentes entre gerentes.
- O calendário usa sexta, sábado e domingo como dias válidos. A seleção carrega
  o mesmo período, permanece visível e atualiza o título com o intervalo. Sem
  registro, a API reutiliza somente a estrutura mais recente, limpa valores e
  Plano de ação e mantém a primeira linha de corretor.
- A interface fixa a coluna do corretor em cabeçalho, corpo e Total geral,
  destaca corretor, métrica e empreendimento da célula ativa, impede quebra do
  índice 10 e mantém dez corretores no rascunho inicial. Controles de grupo
  ficaram compactos no canto superior esquerdo sem deslocar o título.
- O armazenamento novo força RLS, não concede acesso direto e expõe RPCs com
  usuário ativo, permissão da página, MFA e CAS de revisão. A migration
  `20261020122216_forecast_period_scopes.sql` depende da anterior
  `20261019004204_forecast_action_plan.sql`; ambas permanecem sem aplicação
  remota e exigem autorização específica depois da CI aprovada.
- Evidências locais: `lint`, `typecheck`, `build`, `format:check`, catálogo,
  recursos e `git diff --check` passaram; Vitest aprovou 3.965 e ignorou 105;
  110 testes focados e 12 cenários de navegador passaram. A suíte Node aprovou
  1.595, ignorou 19 e reproduziu três falhas POSIX conhecidas do Meta Ads no
  Windows. `test:release` reproduziu a fixture privada do mesmo módulo e um
  timeout Qlik isolado; o delta não altera essas áreas. A CI Linux no SHA exato,
  com pgTAP e restauração isolada, é obrigatória antes de merge e publicação.

## 2026-10-20: Retomada para preencher corretores automaticamente na Previsão

- A branch `codex/previsao-corretores-automaticos` iniciou no `origin/main`
  `c1e931d5ad805f9f43766d67f1d7f297e99a31ae`, após a integração da Previsão
  por período no merge `dfe174635fe4712670a36268b1f9cd5f9cb297a2`.
- Às `2026-10-20T19:39:57.3530636Z`, o health público respondeu HTTP 200,
  `status=ok` e `version=50f11d326cdd37b051db46f1dd1015076b85d545`.
  A versão publicada não corresponde ao `main` atual e não comprova esta demanda.
- A leitura observacional do banco confirmou que os nomes de corretores e seus
  gerentes já existem no snapshot analítico do CRM. A grade ainda cria
  `Corretor 1` a `Corretor 10` localmente e o contrato da Previsão não consome
  essa fonte. O ajuste deve preencher somente rascunhos ainda não salvos; períodos
  salvos permanecem históricos e editáveis. Nenhum usuário ou dado remoto foi
  alterado. Fontes: Git local após `fetch`, `/api/health`, catálogo e consultas
  somente leitura do Supabase de produção.
- A primeira CI do PR #283 bloqueou no `pnpm audit` por
  `@modelcontextprotocol/sdk` 1.31.0, dependência transitiva do diagnóstico local.
  O override foi atualizado para 1.32.1, indicada como corrigida pelo advisory
  GHSA-22jm-h49p-29qw; a auditoria local passou sem achados altos ou críticos.
- Na segunda CI, o teste 15 de `grants_matrix.test.sql` detectou que a RPC nova
  ainda não constava na allowlist nominal de funções executáveis por
  `authenticated`. A lista foi atualizada para auditar a permissão já concedida
  pela migration; nenhum grant adicional foi criado.
- A terceira CI aprovou a restauração isolada e todos os 2.085 testes pgTAP, mas
  o gate visual capturou os cabeçalhos ativo e de grupo em pontos diferentes da
  transição CSS. O contexto ativo passou a não animar a cor; hover comum mantém
  a transição e a indicação visual solicitada continua coordenada.
- Antes do build da quarta CI, um advisory recém-publicado bloqueou Vite 8.2.0
  a 8.2.3, dependência transitiva do Vitest. O projeto passou a forçar Vite
  8.2.4, versão corrigida, sem trocar a versão do executor de testes.

### CI aprovada e migrations autorizadas em produção

- A execução CI `39506011102` aprovou `validate`, `isolated-restore` e
  `release-gates` no SHA
  `3437f9a0c15786fee830b6de2fc3e8c562ad4d7d`. O job de imagem promovível foi
  corretamente ignorado por se tratar de PR.
- Após autorização específica do usuário em 20/10/2026, o Supabase de produção
  aplicou, nesta ordem, as migrations locais
  `20261019004204_forecast_action_plan.sql`,
  `20261020122216_forecast_period_scopes.sql` e
  `20261020204500_forecast_broker_roster.sql`. O ledger remoto registrou
  `20261021002706_forecast_action_plan`,
  `20261021002724_forecast_period_scopes` e
  `20261021002737_forecast_broker_roster`; a diferença de timestamp é do
  aplicador remoto e não autoriza reparo ou reaplicação.
- SHA-256 dos arquivos aplicados, na mesma ordem:
  `bac79025080c09ce45500966c2ef5eb9237e796ab0d9cfce9a22b0a6d64d213f`,
  `db1c688751b21d32aa84acd2ccb3c5bf752fad9d3aa88b929c6d6819f23808d8` e
  `486ca992f3637b8ff82e792421a1bd6be030b29d43bba4f304162eddfbfb7586`.
- O pós-check confirmou `crm_forecast_periods` vazia, RLS forçado, leitura e
  gravação somente pelas RPCs autorizadas e o novo elenco executável apenas por
  `authenticated`. O documento legado permaneceu com uma linha e digest
  `5a44047fd53a72f0bc5b9f72c3fa6bf92c136144859c5f3fc48ea7e0025c8e9b`.
- O advisor de segurança não apontou acesso anônimo novo. O advisor de
  desempenho registrou como informativa a ausência de índice isolado na chave
  `updated_by`; ela não participa das leituras do produto e não justifica uma
  quarta migration neste escopo. Os demais avisos pertencem a objetos anteriores.
- No runtime obrigatório Node 24.19, `lint`, `typecheck` e `build` passaram. O
  Vitest geral aprovou 3.970 e ignorou 105; dois testes independentes da
  Previsão excederam o timeout sob carga local. A repetição isolada aprovou os
  dois arquivos, com 251 testes, e a CI Linux do novo SHA permanece obrigatória.
- A revisão do PR encontrou um caso funcional antes do merge: `upper()` não
  remove acentos, portanto Álvaro, Fabrício e Thiago de Araújo poderiam não ser
  localizados no snapshot. A migration corretiva
  `20261020214500_forecast_broker_manager_accents.sql` normaliza os diacríticos
  com `translate`, preserva ACL e guards e acrescenta pgTAP para os dois nomes
  acentuados. Consulta somente leitura no Supabase confirmou as formas
  `ALVARO`, `FABRICIO` e `THIAGO DE ARAUJO`.
- Após a CI `39524875107` aprovar `validate`, `isolated-restore` e
  `release-gates` no SHA
  `ff38d6a1c762ea790466906627936b320491f52c`, o usuário autorizou a aplicação e
  a recuperação correspondente. O Supabase MCP aplicou somente a corretiva e o
  ledger remoto registrou
  `20261021021551_forecast_broker_manager_accents`. O arquivo aplicado tem
  SHA-256
  `0270b3926fa9c6e3badd6c7ea0a2e9fbc67169f064948846c90b497e15e4a62f`.
- O pós-check confirmou `translate` e o mapa de diacríticos na definição,
  função `STABLE SECURITY DEFINER`, owner `postgres`, `search_path` vazio,
  timeout de 10 segundos e `EXECUTE` apenas para `authenticated`; `anon` e
  `service_role` seguem bloqueados. `crm_forecast_periods` permanece vazia e o
  singleton legado mantém uma linha e revisão 5. Os advisors não apontaram
  acesso anônimo novo; permanece apenas o aviso informativo já registrado para
  o índice de `crm_forecast_periods.updated_by` e avisos anteriores ao escopo.

## 2026-10-20: Abertura do painel inteligente de agendamentos

- A branch `codex/agendamentos-interactive-dashboard` iniciou no `origin/main`
  `0b7fc85fe898b9778ea5899fc222e50240692753`. O health público consultado em
  `2026-10-20T23:11:03-03:00` respondeu HTTP 200, `status=ok` e versão
  `ee451647dc895dafe83be17604849e0cb163c1dc`; essa versão ainda não contém a
  demanda atual.
- O snapshot vigente tinha 32 corretores, 78 agendamentos agregados no mês e
  74 linhas operacionais. A divergência foi reproduzida: datas Salesforce no
  formato `YYYY-MM-DD` eram preservadas nos fatos, mas convertidas como UTC no
  detalhamento, deslocando-as para o dia anterior em `America/Sao_Paulo`.
- A meta individual vigente reproduzirá o volume de Agendamentos projetado pela
  tela de Metas a partir da meta de Vendas e das taxas entre etapas; nenhum campo
  isolado de taxa ou contagem será tratado como esse volume. A meta mensal
  solicitada é a projeção individual multiplicada pelos corretores do snapshot.
- Escopo: corrigir a transformação na origem, expor somente a meta necessária
  com autorização da página, compactar e reorganizar gráficos, implementar
  filtros cruzados acessíveis e reconciliar tabela e indicadores. Fontes: Git
  local/remoto, health público, código versionado e leitura agregada sanitizada
  do snapshot; nenhuma linha de cliente foi registrada.

### Implementação e validação local

- A leitura da meta expõe somente o volume projetado de Agendamentos e exige
  `crm.stage.appointments.view`; anon e service role não executam a RPC. O
  cálculo replica a sequência de taxas da tela de Metas e o card multiplica o
  resultado pelos corretores cadastrados.
- Datas Salesforce sem horário agora recebem o offset de São Paulo antes da
  normalização. A coleta rejeita detalhes cujo calendário de criação divirja do
  fato diário, eliminando a causa do total 78 contra 74 e dos registros de hoje
  deslocados para ontem.
- O painel usa as linhas operacionais reconciliadas para indicadores, gráficos,
  rankings e tabela; ordena criação de forma decrescente e aplica filtros
  cruzados por clique ou teclado. O previsto diário usa um por corretor de
  segunda a quarta e sexta, dois na quinta e zero no fim de semana.
- `lint`, `typecheck` e `build` passaram. Vitest aprovou 4.071 e ignorou 105; 50
  testes focados e 13 cenários da transformação passaram. O preview aprovou 12
  combinações de largura/tema, sem overflow ou violações Axe, incluindo filtros
  de gráfico e linha completa da tabela.
- A suíte Node aprovou 1.596, ignorou 19 e reproduziu três limitações POSIX já
  conhecidas do Meta Ads no Windows, fora do delta. O pgTAP local não executou
  porque Docker/Podman não está instalado; a CI Linux, incluindo restauração
  isolada das 72 migrations e 2.082 asserções pgTAP, permanece gate obrigatório.

## 2026-10-21: Abertura dos totais separados e da visão Geral da Previsão

- A branch `codex/previsao-totais-geral` iniciou no `origin/main`
  `755659e9a467db2758f8a17dfd8ce126ddf8948a`, após `git fetch origin --prune`.
  O Git comum foi confirmado em
  `C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git` e o checkout
  estava limpo. O GitHub registrava os PRs #294 e #295 como mudanças abertas
  pertinentes a outros módulos; a consulta de runs de `main` pelo conector não
  retornou execução associada ao SHA, portanto esse resultado não comprova CI.
- O health público consultado em `2026-10-21T21:45:48.7472710Z` respondeu HTTP
  200, `status=ok` e versão
  `755659e9a467db2758f8a17dfd8ce126ddf8948a`, alinhada ao `origin/main` dessa
  abertura. A demanda ainda não estava implementada.
- Escopo solicitado: separar o Total em Previsão e Realizado e transformar a
  visão Geral em tabela somente leitura com `Equipe Origem`, linhas House e
  Imob e somatórios por empreendimento. A investigação inicial permanece local
  e sem migration, escrita remota ou acesso a dados privados.
- A implementação manteve o contrato da API e agregou localmente os documentos
  já autorizados. Empreendimentos são conciliados pelo título NFKC, com espaços
  normalizados e acentos preservados; IDs internos de grupos não são
  compartilhados entre gerentes. Dado numérico inválido propaga total
  indisponível, sem ser convertido em zero.
- Testes focais aprovaram 88 casos de cálculo/API/componente e 12 cenários de
  navegador, incluindo desktop e celular. `lint`, `typecheck` e `build` passaram
  no Node 24.19/pnpm 11.20. O Vitest geral aprovou 4.082 testes e ignorou 105,
  mas o teste anterior do Associativo em
  `associative-approval-suggestion.test.ts` excedeu 5 segundos duas vezes sob
  carga; isolado, o arquivo aprovou 13/13. As suítes Node mantiveram três falhas
  POSIX conhecidas do Meta Ads no Windows, e `test:release` também reproduziu
  falhas do host Meta Ads em fixtures de arquivos privados. Nenhuma asserção foi
  relaxada; a CI Linux do SHA candidato permanece o gate para integração.

## 2026-10-22: Totais separados e visão Geral da Previsão publicados

- O PR #296 foi integrado na `main` pelo commit
  `c50d2070a92d6522e052f955301aa436be22563a`. A revisão automática identificou
  que títulos `__proto__` e `constructor` poderiam atingir propriedades do
  protótipo durante a agregação; o armazenamento passou a usar objetos sem
  protótipo e ganhou regressão dedicada. A thread foi resolvida somente depois
  do teste passar.
- A proteção de branch recusou corretamente resultados antigos quando a `main`
  avançou duas vezes durante as matrizes longas. As integrações concorrentes
  foram incorporadas e a CI final do PR `39710170718` aprovou `validate`,
  `isolated-restore` e `release-gates` no SHA atualizado, sem reduzir gates.
- A CI de `push/main` `39714940532` aprovou também `promotable-image`. O artefato
  `12398148502` conferiu com
  `sha256:209eb85df458f1be22e6a92fc5951eda163697b1e944f6a941bf2a49bf126f7e`.
  A diferença esperada entre a config da CI
  `sha256:9653c0a8dee24e9f71791ae4464287e668fd5ccecd4ad750c83ea79e954149b7`
  e o manifesto containerd
  `sha256:fa464f8e188c587f0ecc19cd45f9364bbe621849b9d997f8036238b41cd8ae56`
  foi comprovada pelo índice OCI, hashes dos blobs, onze camadas, RootFS,
  plataforma `linux/amd64`, label da revisão e `image:prove` nos dois perfis.
- O coordenador exclusivo `pnpm release:production deploy` publicou o deployment
  `085edb7e-f7ca-4453-bb34-1cab1b6a7d67` em
  `2026-10-22T03:50:24.306Z`, usando o deployment anterior
  `f21451fd-2a4a-431c-8edf-df1a8d1190bf` como CAS. O ledger final confirmou a
  versão `c50d2070`, o manifesto homologado e nenhuma pendência.
- A observação externa de `2026-10-22T03:52:05.3546957Z` confirmou HTTP 200,
  `status=ok` e a versão exata. A rota anônima `/app/gestao/previsao` respondeu
  HTTP 307 para `/login`. Esta entrega não criou migration, não alterou n8n e
  não acessou dados privados de produção.

## 2026-10-23: Agendamentos publicado e regra de escopo registrada

- O dashboard de Agendamentos integrado pelo PR #307 permaneceu como o único
  escopo funcional desta conversa. O PR #312 registrou no repositório a regra
  permanente de tratar cada chat como exclusivo à demanda solicitada, sem
  aproveitar a execução para alterar outras páginas.
- A `main` exata `f3b512dce5e725f9002b06b3c9382213466824e6` foi validada pela
  CI `39906486242`: `validate`, `release-gates`, `isolated-restore` e
  `promotable-image` concluíram com sucesso. O artefato imutável `12480374065`
  teve digest ZIP
  `sha256:3fdf17851f6fc691a2d41b243973b041c09510b7a7e088310bd7ca4d40489a7d`.
- `image.tar.gz`, `revision.txt` e o checksum foram conferidos. A configuração
  registrada pela CI foi
  `sha256:00f4e162b3f33d37bf4bd5f5197a5d240ac4fd1b97a633ec8e68d27d860dda61`;
  o manifesto carregado no Docker containerd foi
  `sha256:316b1503187abe6eaa858808a0ef62e5dfd9415420a05915166e664bdc0036b2`.
  Índice, hashes do manifesto e da configuração, plataforma `linux/amd64`,
  revisão OCI, 11 camadas, 11 `diff_ids` e `image:prove` nos dois perfis foram
  aprovados, sem rebuild ou retag.
- O coordenador `pnpm release:production deploy` publicou o deployment
  `aed84f63-8ccb-49bc-a8e5-88280edb65ef` em
  `2026-10-23T06:29:59.711Z` (`03:29:59` em America/Sao_Paulo), usando o
  deployment anterior `9e38c7e0-a2f5-4a08-8512-3b92a3e7429b` como CAS. O
  ledger final confirmou o SHA e a imagem homologada, sem pendência.
- A observação externa de `2026-10-23T06:30:07.9946224Z` confirmou HTTP 200,
  `status=ok` e a versão exata. A rota anônima
  `/app/etapas/agendamentos` respondeu HTTP 307 para `/login`. Nenhuma outra
  página foi alterada nesta etapa de publicação; não houve migration, mudança
  de n8n, DNS, cobrança ou mutação de dados remotos.

## 2026-10-23: abertura dos ajustes visuais e filtros de Agendamentos

- A branch `codex/agendamentos-layout-filtros-v6` iniciou no `origin/main`
  `c80a39d92d5ecfcada4241076d58cd874df35096`, após a integração documental do
  PR #314 com CI `39911972202` aprovada. O health público consultado em
  `2026-10-23T13:58:28.0362540Z` respondeu HTTP 200, `status=ok` e versão
  `f3b512dce5e725f9002b06b3c9382213466824e6`; a diferença é exclusivamente o
  registro documental integrado depois do último deploy e não exige reinício.
- Escopo exclusivo: somente `/app/etapas/agendamentos` e seus componentes e
  cálculos diretos. A demanda uniformiza doze indicadores e cinco gráficos,
  organiza seis rankings/recências em duas linhas, melhora rótulos, hover e
  inclinação dos cards e faz todos os indicadores respeitarem os filtros,
  incluindo a contagem de gerentes no recorte selecionado. Nenhuma outra página,
  migration, n8n ou dado remoto será alterado.

## 2026-10-23: implementação local dos ajustes de Agendamentos

- Os 12 indicadores usam uma grade única, altura uniforme, tipografia comum e
  conteúdo centralizado. A inclinação limitada acompanha o ponteiro e respeita
  `prefers-reduced-motion`. Os cinco gráficos principais têm a mesma altura; os
  três rankings e as três faixas de recência formam uma grade 3 × 2. Ranking
  Score exibe os nomes na vertical, de baixo para cima. Barras, rótulos,
  rankings, recências e linhas da tabela recebem realce no hover.
- Filtros dimensionais passam a recortar o elenco registrado antes de calcular
  corretores, gerentes, meta prevista e equipe produtiva. A regressão comprova
  que um gerente filtrado resulta em um gerente, um corretor registrado, meta
  diária de um e equipe produtiva de 100% na fixture. Filtros de período mantêm
  o cadastro vigente e recortam somente as métricas operacionais.
- Evidência local: lint, typecheck, build e 18 testes focados aprovados. O QA com
  CSS compilado aprovou 12 combinações de tema/largura, zoom de layout, axe,
  filtros, hover, inclinação, dimensões e overflow. O Vitest geral aprovou 4.107
  testes e ignorou 107; o estágio Node do `pnpm test` falhou em três testes
  Windows do Meta Ads, externos ao escopo (ACL de segredo e diretório de perfil
  dedicado). Nenhum arquivo dessa área foi alterado. CI, merge e publicação
  ainda não ocorreram e permanecem estados separados.

## 2026-10-23: bloqueio externo de integração dos ajustes de Agendamentos

- O PR #315 chegou ao SHA `63da2f4db520c61a68b97f991510447373a6af34`
  com CI `40009497577` e candidato visual `40009497616` aprovados. Após a
  integração externa do PR #317, a branch incorporou `origin/main`
  `f8799dbc5f5d280979be261699018186be616037` sem conflito funcional e passou ao
  SHA `bde9bbd39ff4af83284b51ae00c2336cb54d3313`.
- A CI da própria `main` (`40022552767`) e duas tentativas do job `validate` do
  PR (`40023399660`) falharam exclusivamente em `pnpm audit --audit-level high`.
  A reprodução local do mesmo comando terminou com código 0. O candidato visual
  `40023399816` não substitui o gate obrigatório. Pela regra máxima de escopo,
  nenhuma dependência ou área externa foi alterada; merge e publicação ficam
  bloqueados até o gate da `main` voltar a aprovar ou receber correção em chat
  próprio.
- A observação final de `2026-10-23T18:09:47-03:00` confirmou HTTP 200,
  `status=ok` e versão publicada
  `74b76c248c67e62b5cfad5e721389f1c81431a43`; portanto, o conteúdo do PR #315
  ainda não está em produção.

## 2026-10-23: correção comprovada do gate de auditoria do PR #315

- A reprodução no Ubuntu com Node `24.19.0` e pnpm `11.20.0` identificou
  `GHSA-mrhx-c7xc-m3w5`: Zod menor que `4.6.6`, inclusive o `3.25.76` fixado pelo
  `next-devtools-mcp@0.4.0`. O Windows não reproduzia o advisory.
- Zod foi atualizado para `4.6.7` e o DevTools passou a reutilizar essa versão.
  `pnpm audit --audit-level high --json` no Ubuntu terminou com código 0, sem
  vulnerabilidade alta ou crítica. `pnpm devtools:check` aprovou o protocolo e
  as ferramentas Next e Chrome. Dois refinamentos explícitos preservaram os
  limites UTF-16 existentes; 72 testes dos contratos afetados passaram. A
  publicação segue condicionada aos demais gates e ao coordenador oficial.

## 2026-10-23: segundo advisory no fechamento da publicação de Agendamentos

- O PR #315 foi integrado no `main` como
  `b88122c7dddadd1d14ef4dc8cfeb033c0c57c8d1`, após CI `40029289783` e
  candidato visual `40029289690` aprovados.
- Durante a CI do `main` (`40035073028`), o registry passou a reportar o novo
  `GHSA-27r3-jxmh-p828` em `body-parser@2.3.0`, transitivo do Next DevTools. O
  pacote foi fixado em `2.4.0`; não houve mudança funcional em Agendamentos.

## 2026-10-24: terceiro advisory no fechamento da publicação de Agendamentos

- A CI de `push/main` `40061774780`, no SHA
  `b403071c1b749476f638bd6a36dcaedfcce033be`, aprovou testes e documentação,
  mas bloqueou no audit porque o registry passou a reportar
  `GHSA-xjj6-f33q-929c` em `undici@7.30.0`, transitivo do Next DevTools.
- O override mínimo para `undici@7.30.1` atualizou o lockfile. A auditoria local
  terminou sem severidade alta ou crítica. Esta correção não altera a página de
  Agendamentos nem qualquer outra funcionalidade; ela existe somente para
  restabelecer o gate obrigatório de publicação.

## 2026-10-24: núcleo operacional do menu Lead concluído localmente

- O banco próprio do DESCOMPLICA-CRM é a fonte autoritativa do corte. Foram
  implementadas nove páginas protegidas e a rota autenticada de exportação,
  cobrindo cadastro, lista, detalhe, atividades, mensagens internas, etiquetas,
  favoritos, funil, distribuição, relatórios, importação, configurações e
  auditoria. C2S permanece apenas como referência funcional; nenhuma credencial
  ou informação de cliente foi copiada.
- Duas migrations funcionais adicionam o domínio normalizado e operações por
  RPC com RLS forçada, grants mínimos, permissões por página e ação,
  idempotência vinculada a organização, ator e comando, retenção automática de
  prévias de importação e auditoria sem PII. A migration do catálogo registra
  as 41 páginas protegidas atuais.
- Evidência local em Node 24.19 e pnpm 11.20: lint sem erros, typecheck e build
  aprovados; Vitest com 4.179 aprovados e 107 ignorados; `pages:check`,
  `resources:check`, Gitleaks e verificação de diff aprovados. Os 72 testes
  pgTAP do núcleo e 53 das operações dependem da CI Linux porque não há
  Docker, Podman ou Supabase local neste host.
- Limite externo: `pnpm test` mantém três falhas Windows preexistentes do Meta
  Ads, e `pnpm test:release` mantém onze falhas do mesmo host por arquivo
  sintético ausente. Esses arquivos não foram alterados, conforme a regra de
  escopo exclusivo. Integrações externas, WhatsApp, CRM imobiliário,
  financeiro e produtos opcionais não fazem parte desta entrega.

## 2026-10-25 — Abertura: paridade do Simulador CAIXA

- Escopo: exclusivamente /app/simulacao/caixa; referencia https://descomplicapro.com.br/simulacao/caixa somente leitura; validar regras em fontes oficiais CAIXA.
- Git comum confirmado; checkout inicialmente detached/limpo em 6a0f678eee50bd1f8178cd11de9301b016d9bd99; origin/main no mesmo SHA apos fetch em 2026-10-26 UTC (25/10 America/Sao_Paulo). Branch de trabalho codex/simulador-caixa-paridade.
- Health https://crm.descomplicapro.com.br/api/health consultado sem autenticacao em 2026-10-26T00:37:00Z: HTTP 200, status ok, version ec98b41aedc721c22fff4f28dca9b31bc6317373. Versao publicada difere do checkout documental; nao comprova entrega desta demanda.
- CONTEXTO.md/FERRAMENTAS.md lidos. Runtime instalado context/search falhou com Documento excede o limite de exportacao; ATUALIZACOES.md ja possuia 259205 bytes (limite 256000). Nao reduzir protecao nem alterar ferramenta fora do escopo. Sync sera tentado e eventual pendencia registrada. Reavaliar com manutencao especifica do arquivo de conhecimento.
- gh ausente no PATH; consultas GitHub pelo conector. Pagina de referencia acessivel por leitura web. URLs /home e /simulacao do simulador oficial retornaram 404 na ferramenta web; investigar acesso publico normal e fontes oficiais alternativas, sem presumir regras.

### Abertura CAIXA — complemento de fonte GitHub

- Conector confirmou main como branch padrão. Consulta observacional via gh instalado na VPS confirmou CI push/main 40240265203 concluída com sucesso no SHA local 6a0f678eee50bd1f8178cd11de9301b016d9bd99; fonte https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40240265203. Não há PR aberto da demanda CAIXA; PRs antigos de migração registravam apenas canário/visual, não validação financeira atual. Branch remota atualizada por fetch. Não executar suites na VPS compartilhada.
- Sync inicial tentado e recusado por limite de exportação; o mesmo problema preexistente consta no registro documental anterior de main. Mantida pendência, sem ampliar escopo para corrigir a infraestrutura do conhecimento.

## 2026-10-25 — CAIXA: implementação e validação específica

- PR https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/351 aberto em draft; implementação restrita à página CAIXA, sem alterar a origem de referência, outras páginas, banco ou workflows. Fórmulas e fontes oficiais completas em docs/simulators/CAIXA.md.
- Testes específicos: 64 de motor/guards aprovados após correções; cliente4/4, nove combinações de largura/tema e seis auditorias adicionais de abas, sem axe/overflow. Inspeção visual corrigiu detalhes que axe não cobre. Artefatos locais sintéticos em private-data/caixa-qa, não dados de clientes.
- Lint e typecheck aprovados localmente; 36 warnings existentes em assets Meta fora do escopo. Build inicial aprovado. pnpm test Windows executado, primeira tentativa saturou host; repetição com VITEST_MAX_WORKERS=2 apresentou timeouts externos (conhecimento, Qlik, Associativo, DevTools), sem alterar testes ou baseline dessas áreas. A CI Linux0ab2a93c aprovou4241 testes e detectou apenas novo caso de taxaClasseMédia acima10%; corrigido e regressão local64/64 aprovada. CI final ainda pendente.
- Revisão independente corrigiu data-limite80a6, finitude, custos acima da prestação, teto de complemento, cidade/UF e prazo de obra. IN17/IN4 de08/04/2026 art3 permite ClasseMédia até13000 sem renda mínima9600; art16 taxa nominal máxima10. Cálculo local indicativo, não aprovação/CET; complemento e encargos sem dados oficiais não são inventados. Fórmula MFOM034 com FUH e anexos documentada integralmente.
- Primeira CI185c1595 falhou formatação; corrigida no0ab2a93c. Merge/publicação não executados; dependem da CI final, QA autenticada e coordenador exclusivo de produção. Sync continua pendente pelo limite preexistente de256000 bytes; não alterar infraestrutura do conhecimento fora do pedido. Reavaliar em manutenção específica.

## 2026-10-25 — CAIXA: captura autenticada e regressão de tablet

- Fonte: run Protected visual candidate 40254914307, head203754ae46b102519e299f8d647a72fd60fd7685, captureCommit de merge bb05924600ef3dea1bd1413fbccdd3f6ac2aefd4, capturado em 2026-10-26T02:05:15Z. Artifact12623137226 contém diagnóstico sintético. Falhas restritas à CAIXA: mainCount0 em7 larguras e overflow em1024. Demais páginas, Axe e canvas passaram; promoção de baseline recusada corretamente. Nenhuma referência foi alterada a partir dessa execução inválida.
- Causa comprovada: harness local usava main artificial, enquanto o shell autenticado fornece div. Tracks com mínimos260/140 também ampliavam a largura intrínseca para além do formulário. Corrigidos apenas CaixaArchive/main e CSS próprio, sem esconder overflow nem mudar shared shell/gates/limiares.
- Regressão local anterior reproduziu overflow1024. Artefato final formatado aprovado em run local98692 (23:28 America/Sao_Paulo):4/4 testes,12 combinações1440/1024/390/320 por3 temas,6 auditorias adicionais de abas, exatamente1main, zero Axe/overflow/console. Teste usa Archive real, globals e canvasCSS, com hostdiv sem landmark artificial. Run financeiro/guards local:64/64 aprovado após proteção de valores extremos nos utilitários e teto nominal MCMV10%.
- CI203754ae validou lint/tipos/suíte Linux/fontes/audit/build, restore isolado e E2E autenticado; release bloqueada pela captura descrita. Nova captura e CI do código corrigido pendentes. Não houve merge/deploy. Sync Obsidian continua impedido pelo limite preexistente do documento, a reavaliar em manutenção própria.

## 2026-10-26 — CAIXA: contraste transitório e cobertura de estados

- Fonte: CI 40259598078, job 121370107375. Dois casos de contraste falharam no Linux: diagnóstico ativo em1440 e botões inativos em320/light; outros48 testes desse passo passaram. Validate (lint, tipos, suíte completa, fontes, audit e build) passou; produção permaneceu na versão anterior.
- Causa: transição global de cor/fundo de160ms, com interpolação de texto e fundo passando por contraste insuficiente. Correção somente no CSS CAIXA, com cores opacas e opt-out dessa interpolação em controles. Não foi alterado app/globals.css, não houve espera artificial nem exclusão de violações. Estados DARK adicionais de fase/contador, avisos, FGTS e Remover habilitado foram verificados e corrigidos pontualmente.
- Resultado local do artefato formatado68439:4/4 em61,52s;12 combinações main e24 auditorias de estados (Resumo Parcial/Documentos/Diagnóstico/Utilitários,3 temas,1440/390), com dois períodos no FGTS para testar Remover habilitado. Zero Axe/overflow/console; timeout90s intacto. Relatórios de erro incluem cores calculadas, contraste e failureSummary.
- Contrastes medidos: inativos claros #40546c/#fff=7,77:1; diagnóstico ativo #fff/#087583=5,41:1; inativos DARK #a9bfd2/#102a42=7,73:1. As cores restantes foram preservadas quando não havia falha. Nova CI e captura autenticada ainda pendentes; referências não promovidas de execução inválida. Sync permanece pendente pelo limite preexistente do exportador, sem ampliar escopo de autorização.

### CAIXA — revisão móvel e atualização concorrente

- Revisão visual independente das seis capturas de resultado identificou quebra da última casa decimal em390 nos três temas. Layout próprio reorganizado para manter quantias completas; regressão verifica linha única, contenção e ausência de reticências. A conferência final será registrada após o handoff.
- Fetch em2026-10-26T03:21Z detectou origin/main5ed6260600f22cbaab348eb67f900bbbe653f932, entrega concorrente de Agendamentos e shell. Integração preservará esse código e suas referências, sem corrigir outras páginas. CI push/main40263238224 ainda em execução. Health público em2026-10-26T03:21:53Z:HTTP200,status ok,version ec98b41aedc721c22fff4f28dca9b31bc6317373. A versão CAIXA continua sem merge/publicação.
- A atualização externa exige reconferência do candidato integrado antes dos gates finais. Obsidian permanece pendente pelo limite de exportação preexistente; não alegar sincronização ou produção atualizadas apenas por tentativa.
- Artefato local formatado38545:4/4 testes aprovados em36,97s, preservando12 combinações do formulário e24 auditorias de estados. Quantias240.000,00/60.000,00 verificadas por fragmentos de texto/limites DOM, sem quebra ou reticências. Trinta imagens restantes revisadas; seis resultados regenerados enviados à reconferência independente. Sync de retomada tentou exportar e recusou o documento pelo limite já registrado.
- Reconferência independente concluída nas seis PNG de resultado em resolução original: quantias completas em390/light/balanced/dark e sem regressão observada em1440. Código congelado após handoff; nova captura autenticada e gates globais ainda pendentes.
- Main5ed62606 integrado no candidato051fb2ee sem alterar o código concorrente; conflitos documentais conservaram ambos os registros. Após integração: typecheck/lint/build locais aprovados (36 warnings Meta existentes); regressão específica83 aprovados e1 condicional não executado. CI40263953550 aprovou4290 testes Linux/110 condicionais, mas bloqueou na fonte externa de Documentação: https://www2.prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2517 respondeuHTTP403 em2026-10-26T03:29:59Z. Gate/script/exceção preservados; não corrigir outra página para liberar CAIXA. Nova execução após incorporação das referências deverá reavaliar a disponibilidade; falha persistente impede publicação. Captura40263953439 já aprovou build/E2E autenticado e segue na matriz visual.

### CAIXA — captura autenticada aprovada e incorporação restrita

- Run 40263953439 aprovado: build, E2E e matriz funcional/Axe/zoom. Artifact 12626398223; ZIP SHA256 84842462516ae1274d482bc9583e1fea9e2575aa08244dbc5679862ffa80aee7. Head 051fb2ee3d1c959f845ac2389b177efc1ff9f0ee; captureCommit 2c3e6d8c408bd6402a9a3653757c2da9f1a702f1; capturedAt 2026-10-26T03:54:26.619Z. Fonte: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40263953439.
- Revisão independente das 11 imagens em resolução original: sete larguras, três temas desktop e dark mobile. Estado inicial legível e integrado ao shell, sem corte, sobreposição ou overflow visível. Resultados preenchidos e demais abas têm a prova sintética anterior; esta revisão estática não substitui cálculo ou oferta bancária.
- Incorporadas somente 11 imagens CAIXA, 38 entradas da rota (7 responsivas, 4 temas, 11 Axe, 11 screenshots e 5 zoom), seus registros de hash e proveniência parcial. Metadados globais e referências das demais páginas preservados. Nova CI requerida; HTTP 403 da fonte de ITBI continua pendência externa até reavaliação bem-sucedida. Merge e publicação ainda não executados. Sync final permanece sujeito ao limite preexistente de exportação.
- Verificação local após incorporação: reference-parity com 15 testes aprovados e 1 condicional não executado; Prettier e diff-check aprovados. Comparação estrutural confirmou que todas as outras rotas e os metadados globais permaneceram idênticos. A edição do JSON usou intervalos de AST para preservar texto fora das entradas necessárias.

### CAIXA — reconferência da publicação concorrente

- Fetch em 26/10/2026 às 04:25 UTC confirmou origin/main 5ed6260600f22cbaab348eb67f900bbbe653f932, já integrado ao candidato CAIXA. CI push/main 40263238224 concluída com sucesso nos quatro jobs; fonte https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40263238224.
- Health público em 2026-10-26T04:25:54.067Z: HTTP 200, status ok, version 5ed6260600f22cbaab348eb67f900bbbe653f932. A entrega concorrente de Agendamentos está publicada; esta versão não comprova publicação da CAIXA. O candidato CAIXA eac63e7b continua sem merge/deploy, com validate, restauração e E2E aprovados na CI 40266778359 e matriz visual final em execução.
- A próxima publicação deve usar a versão/deployment ID/data reais então ativos, obtidos novamente pelo coordenador; não reutilizar o registro anterior ec98b41a como expectativa. Sync de retomada será tentado, mantendo o limite preexistente como pendência se recusado.

### CAIXA — precisão documental do complemento

- Releitura independente do MFOM034, pp. 131–133, §3.1.1.1 e §3.1.1.8: não localizada saturação explícita de R/Frenda ou função por faixas após RDmin=3700. A expressão literal volta a crescer acima do mínimo; elegibilidade até renda4000 não define como limitar a curva. Não inventar congelamento ou extensão monotônica. Limite acrescentado à memória matemática em docs/simulators/CAIXA.md.
- Escopo estritamente documental: a página não executa essa expressão e já utiliza somente complemento informado como confirmado, sem estimar fatores ausentes. Nenhuma regra financeira ou código do candidato foi alterado por esse esclarecimento. Reavaliar apenas com especificação operacional oficial adicional.

## 2026-10-26 — CAIXA: CI, merge e publicação confirmados

- Implementado no head eac63e7bad1a2ec42ce17cf11c3541f95932a12d. CI de PR 40266778359 e captura 40266778468 aprovadas; PR https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/351 integrado sem bypass em 54eb7cdd7460130fc8c70d71fb956cb801b8d12c. CI push/main https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40270504690 concluída com os quatro jobs aprovados. Validate confirmou 4.290 testes/110 condicionais, fontes sem exceção de indisponibilidade, audit, lint, tipos e build; release validou navegadores, E2E, banco, restauração e matriz visual.
- Indisponibilidade transitória HTTP403 da fonte de ITBI no run40263953550 encerrada por novas verificações aprovadas, sem alterar script, exceção, baseline ou página externa. Falhas/timeouts Windows anteriores permanecem como limite daquele host; não foram mascarados nem usados para dispensar a suíte Linux completa.
- Artifact12627897001, nome promotable-image-54eb7cdd7460130fc8c70d71fb956cb801b8d12c; digest do artifact c6e3aac871ccbd879f5446c0d1af9d10a74291343a76ed357e8db2d5edfe7fa8. image.tar.gz SHA25675ddefb97c1603703dbe0edbdd1dff104ef1d3bfc375f8bf9be0252d74c9c955; revisão exata conferida. ID CI/configuração sha256:1f4b3ff0b1a6eb7995f41009918271f3fe38d1f7227c88c5b7e5c21de2a58102 e ID VPS/manifesto sha256:f4b4005ae5d9a7ecba2f0e30efbf39c03836d180f4e12b6e69d91890400e3ff7 reconciliados por index/manifest/config, hashes/tamanhos, plataforma linux/amd64, manifesto legado e onze camadas/rootfs. Nenhum rebuild ou retag na VPS. image:prove confirmou dois perfis, mesma imagem e nenhum segredo impresso.
- Checkout remoto limpo em /srv/descomplica-crm-releases/54eb7cdd7460130fc8c70d71fb956cb801b8d12c. A reutilização inicial de node_modules por symlink foi recusada pelo pnpm antes da prova; removido somente o link explicitamente verificado e instalado o lockfile congelado pelo cache, sem scripts, downloads ou build. Node24.19.0/pnpm11.20.0; checkout permaneceu limpo. Dependências compartilhadas não foram removidas ou alteradas.
- Backup privado de production.env e ledger em /var/backups/descomplica-crm/caixa-54eb7cdd7460130fc8c70d71fb956cb801b8d12c, diretório0700/arquivos0600, comparados aos originais; imagem anterior 5ed62606, IDsha256:a2d421bbf725296dce309e031647963409af7473673fcb684e57e33bf8a2df8d, disponível para recuperação. Sem mudança de schema/dados, DNS, cobranças, contas, flags ou n8n.
- Publicado exclusivamente por pnpm release:production, com as três travas, consulta no próprio minuto/até60s, CI/main exatos e CAS. Expectativa anterior: deployment d04aed32-b1af-4ff7-a768-4d5f7e4189d9, SHA5ed6260600f22cbaab348eb67f900bbbe653f932, data real2026-10-26T04:04:22.711Z. Resultado deployed: deployment042fc7e9-ab92-4f96-a45f-b3eed91e184b, SHA54eb7cdd7460130fc8c70d71fb956cb801b8d12c, imagem f4b4005a..., deployedAt2026-10-26T05:40:32.386Z (26/10/2026 02:40:32 America/Sao_Paulo), pendingDeploymentId null. Nenhuma recuperação necessária.
- Pós-publicação: GET público sem cookies em2026-10-26T05:41:09.860Z retornou HTTP200/status ok/version54eb7cdd7460130fc8c70d71fb956cb801b8d12c. GET anônimo da rota às05:41:11.423Z retornou307 para/login. Status do coordenador confirmou mesmo deployment/imagem/data e ausência de pendência.
- Smoke autenticado de produção, somente com dados sintéticos: renda6000, imóvel300000, nascimento1991-03-15, São Paulo/SP, MCMV/PRICE/420 meses. Resultado: financiamento indicativo240000, entrada complementar60000, primeiro encargo parcial1732,59; avisos de MIP/DFI, tarifa, subsídio, obra e CET exibidos. Documentos, Diagnóstico e Utilitários abriram corretamente. Campos limpos no fim, sem compartilhar, imprimir, salvar proposta ou criar registro remoto. Captura local do formulário vazio: private-data/caixa-qa/caixa-production-54eb7cdd.png; identidade de conta e dados privados não transcritos para evidências versionadas.
- Fonte de referência https://descomplicapro.com.br/simulacao/caixa permaneceu somente leitura. O registro de fechamento é documental e deve ser publicado no Git sem reiniciar a aplicação. Sync Obsidian continua impedido pelo limite preexistente de256000 bytes; não reduzir proteção, arquivar autoridade ou alterar infraestrutura nesta demanda. Reavaliar em manutenção específica do conhecimento; a falha não invalida a evidência direta de GitHub/CI/site nem concede autorização adicional.

### CAIXA — conciliação do registro documental com main

- CI documental `40276795962` aprovada no head `d620621c40ad4156524d16f0215caa507a7d97e9`. Antes da integração, main avançou para `bebbb2adbb0fe345f8535e7918fd6fa293edc267`, PR #353 de Meta Ads. Houve conflito somente nos registros iniciais de CHANGELOG/WORKLOG; preservados integralmente os dois textos e o código concorrente. A demanda CAIXA continua com quatro arquivos documentais no diff contra a nova base, sem alteração de runtime.
- Reconferência em `2026-10-26T06:44:15.295Z`: health HTTP 200/status ok/version `54eb7cdd7460130fc8c70d71fb956cb801b8d12c`. CI push/main `40280448260` da entrega concorrente em execução; a CI runtime CAIXA `40270504690` já estava concluída com sucesso. Nova validação do registro reconciliado é exigida pela proteção de branch; a aplicação CAIXA já publicada mantém suas evidências e não será reiniciada por esta alteração documental. Sync permanece pendente pelo limite de exportação já registrado.

## 2026-10-26 — Abertura: compactação e navegação de Agendamentos

- Escopo exclusivo: `/app/etapas/agendamentos`. Pedido cobre compactação dos menus e cabeçalho, vermelho semântico no tema escuro, reordenação acessível dos 12 cards e dos dois blocos do funil, além de seções guiadas que exibem somente o conjunto solicitado com alturas e gráficos aproveitando toda a área.
- Git comum confirmado. Branch `codex/agendamentos-layout-compacto-v12` criada a partir de `origin/main` `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f` em 26/10/2026. A CI push/main `40381778238` do commit documental mais recente estava em execução; isso não valida esta nova demanda.
- Health público observado sem autenticação em `2026-10-26T19:22:32.2416289Z`: status `ok`, versão publicada `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. A versão publicada difere do `main` documental atual e não comprova esta implementação.
- `context` e `search` no runtime Node 24.19 recusaram a exportação porque o documento excede o limite. O mesmo limite preexistente impede o sync inicial; não reduzir proteção nem alterar a infraestrutura do conhecimento nesta demanda. Código, GitHub e health atuais permanecem as evidências diretas.

## 2026-10-26 — Abertura: revisão cirúrgica das cotas SBPE

- Escopo exclusivo: revisar `/app/simulacao/caixa`, aplicar a regra solicitada de
  cota SBPE de 90% no SAC e 80% no Price e confrontar as demais regras do motor
  com fontes oficiais e simulações sintéticas, sem alterar outras páginas,
  dados remotos, n8n ou a referência pública.
- Git comum confirmado. Branch `codex/caixa-sbpe-cotas` criada sobre
  `origin/main` `4e6c8a9da91fbc4acfeaaa40669dc09cb95caedc`; CI de `push/main`
  `40315829223` aprovada. Health público observado em
  `2026-10-26T12:33:23.7747568Z`: HTTP 200, `status=ok`, versão publicada
  `ef91f3ec277adf490991e6d477a96da10a9fbe69`. Código publicado e `main` serão
  distinguidos durante a validação.
- `knowledge:context`, `knowledge:search` e sincronização continuam bloqueados
  pela falha preexistente `Documento excede o limite de exportacao.`. A
  indisponibilidade não autoriza reduzir o documento ou omitir a conferência
  direta de código, fontes, CI e site; reavaliar em manutenção própria.

### CAIXA — regras implementadas e validação local

- SBPE configurado com teto de 90% no SAC e 80% no Price. A cota passou a
  incidir sobre o menor entre compra e avaliação CAIXA; cota individual
  confirmada pode apenas reduzir o teto. Aporte MCMV Cidades foi separado do
  desconto complemento FGTS, que agora rejeita valor positivo inferior a
  R$ 1.500. O último mês do cenário de obra atinge 100% da liberação.
- Calculadora rápida pública exercitada em 26/10/2026 somente com dados
  fictícios, sem CPF, telefone, consentimento ou proposta: cenários de renda
  R$ 3 mil, R$ 6 mil e R$ 20 mil, imóveis de R$ 210 mil, R$ 300 mil e
  R$ 500 mil, idades de 35 e 70 anos. Recurso público identificou versão
  1.16.0.2/data 06/07/2026 #1 e parâmetros de taxa, MIP, DFI e tarifa. Eles
  entram apenas como estimativa identificada quando valores confirmados faltam;
  proposta individual prevalece. SBPE não reutiliza taxas MCMV de renda baixa.
- Validação focada: 51 testes financeiros aprovados; cinco jornadas completas
  de navegador aprovadas, incluindo três temas, desktop/celular, Axe, overflow,
  quantias completas e fluxo SBPE SAC 90%. Capturas sintéticas revisadas em
  `private-data/caixa-qa`, sem dados de clientes.
- Gates em Node 24.19.0/pnpm 11.20.0: lint sem erros (44 warnings preexistentes
  em assets Meta fora do escopo), typecheck e build aprovados. `pnpm test`
  aprovou 4.298 testes e encontrou três timeouts de host em Associativo e
  DevTools; os dois arquivos exatos foram reexecutados isoladamente com um
  worker e aprovaram 37/37 sem alteração fora do escopo. CI remota continua
  obrigatória antes de merge/publicação.
- Primeira captura protegida `40329412235` interrompeu no E2E porque a asserção
  ainda exigia o texto antigo `seguros não confirmados`; a própria evidência
  mostrava o novo estado correto `seguros de referência`. Os 15 cenários
  anteriores passaram. A expectativa CAIXA foi atualizada sem reduzir o gate;
  nova CI/captura é obrigatória.

### CAIXA — captura protegida e referências visuais

- CI `40331622292`: validate e restauração isolada aprovados. O release gate
  aprovou cálculo CAIXA, temas, Axe, banco, build e E2E; recusou apenas cinco
  comparações visuais esperadas da própria rota, sem falha financeira.
- A primeira tentativa da captura `40331622478` atingiu o limite de 45 minutos
  durante a matriz global, depois de E2E aprovado. A repetição exata concluiu
  com sucesso, sem mudança de workflow ou redução de gate.
- Artefato aprovado `12660573871`, digest
  `35990d8d37adcd201cda2d161859ca92ec4ad0392943c40b5bf32dfca93812b1`;
  head `0a301c77e66be38361df9d7b1667ecc49360be7d`, capture commit
  `bbe3748a4c32a354d18bc578b55b2ad49cb2067e`, capturado em
  `2026-10-26T15:01:33.668Z`.
- Onze imagens CAIXA revisadas em resolução original: formulário completo e
  legível, sem corte, sobreposição ou overflow horizontal nas sete larguras,
  três temas desktop e escuro móvel. Incorporadas somente as cinco imagens
  materialmente alteradas e os registros da rota; demais páginas e metadados
  globais preservados. Nova CI do head integrado continua obrigatória.
- Validação final local em Node 24.19.0/pnpm 11.20.0: lint sem erros e com os
  mesmos 44 warnings Meta preexistentes; typecheck e build aprovados; Vitest
  aprovou 4.302 testes e pulou 111. A etapa Node aprovou 1.599 e pulou 19, mas
  três testes de ACL/perfil privado Meta falharam no host Windows. Não houve
  correção fora do escopo nem dispensa do gate; a suíte Linux da nova CI deve
  aprovar integralmente antes de merge/publicação.

### CAIXA — integração, publicação e aceite em produção

- O PR #358 foi integrado sem bypass na `main` como
  `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. A CI de `push/main`
  `40362745379` aprovou `validate`, `promotable-image`, `isolated-restore` e
  `release-gates`, incluindo a jornada CAIXA e a matriz completa de temas,
  larguras, zoom, teclado, banco, build e restauração.
- Artefato imutável `12669426869`, digest ZIP
  `874a59a060cfd7ecafab44b1f8edcd092b864c000d104ffa09cd57bac8bffe18`;
  `image.tar.gz` conferiu com
  `f160251d0aba5288fd9f1aaa0c12118957b5a99ec69e24572677f1ef60c520bd`.
  A configuração da CI
  `sha256:ee62b6bba79908d3854fff59d71a6580daab2f8940941290bbb8d78711d7b123`
  e o manifesto/ID no Docker containerd
  `sha256:23f6b685003781ecc4274f68d960100a89fa29dd0ad6443a3fae0a83b6726a9b`
  foram reconciliados por índice, hashes, plataforma `linux/amd64`, revisão e
  11 camadas/`diff_ids`; `image:prove` aprovou os dois perfis, sem rebuild ou
  retag.
- Checkout remoto limpo em
  `/srv/descomplica-crm-releases/24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`,
  com Node 24.19.0, pnpm 11.20.0 e lockfile instalado do cache em modo offline,
  congelado e sem scripts. Backup privado verificado em
  `/var/backups/descomplica-crm/caixa-24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`;
  imagem anterior preservada para recuperação. Nenhuma migration, dado remoto,
  DNS, cobrança, conta ou workflow n8n foi alterado.
- O coordenador exclusivo `release:production` confirmou no próprio minuto a
  produção anterior — deployment `0c1664b4-31cf-4fc5-bc84-a807627e0dab`, SHA
  `9e7d1c56232bd6742d4419a9a6a291092aedc3c3`, publicado em
  `2026-10-26T15:53:23.442Z` — e publicou o deployment
  `3928ca60-0e0b-433e-8da2-e08cc24a4dca` em
  `2026-10-26T17:45:12.098Z` (`14:45:12` America/Sao_Paulo). O ledger final
  confirmou SHA/imagem exatos e `pendingDeploymentId=null`.
- Às `2026-10-26T17:45:17Z`, o health público respondeu HTTP 200,
  `status=ok` e versão `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`; o GET
  anônimo da rota retornou 307 para `/login`. Smoke autenticado, somente com
  dados sintéticos, confirmou em SBPE/Price imóvel de R$ 500 mil, financiamento
  de R$ 400 mil, entrada de R$ 100 mil e cota de 80%; no mesmo cenário em SAC,
  financiamento de R$ 450 mil, entrada de R$ 50 mil e cota de 90%. A base da
  cota, taxa estimada de 11,49% a.a., seguros/tarifa de referência e alertas
  apareceram corretamente; os campos foram limpos, sem imprimir, compartilhar,
  salvar proposta ou criar registro.
- A referência `https://descomplicapro.com.br/simulacao/caixa` permaneceu
  somente leitura. A simulação oficial completa não foi submetida porque exige
  CPF, celular, consentimento e verificação; os confrontos públicos usaram
  apenas informações fictícias e parâmetros expostos pela calculadora rápida.
- Fechamento documental em Node 24.19.0/pnpm 11.20.0: lint sem erros e com os
  44 warnings Meta já conhecidos, typecheck e build aprovados. Vitest aprovou
  4.302 testes e pulou 111; a etapa Node aprovou 1.599, pulou 19 e repetiu as
  mesmas três falhas exclusivas do host Windows em ACL/perfil privado Meta.
  Esses arquivos não foram alterados; a CI Linux integral do SHA publicado está
  verde e continua sendo a evidência de release.
- O `knowledge:sync` final foi tentado após este registro e permaneceu bloqueado
  pela falha preexistente `Documento excede o limite de exportacao.`. Não houve
  redução do documento, alteração do vault ou alegação de sincronização; a
  pendência deve ser tratada em manutenção própria do conhecimento.

## 2026-10-26 — abertura: canvas analítico em Visão Geral e Agendamentos

- Escopo solicitado: transformar exclusivamente `/app` e
  `/app/etapas/agendamentos` em canvases analíticos configuráveis, preservando
  fontes, filtros, permissões e fórmulas existentes. A especificação exige grade
  responsiva, movimentação e redimensionamento, reflow, histórico, perfis por
  usuário, expansão e exportação selecionável em PDF.
- Estado local observado em `2026-10-26`: branch
  `codex/agendamentos-layout-compacto-v12`, SHA
  `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`, com mudanças em andamento somente
  na experiência de Agendamentos e `output/` não rastreado preservado. O Git
  comum confirmado é o repositório autorizado do DESCOMPLICA-CRM.
- Produção consultada em leitura observacional: `/api/health` respondeu HTTP 200,
  `status=ok`, versão `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`.
  `git fetch origin --prune` concluiu; a consulta de CI pelo `gh` ficou
  indisponível porque o executável não existe neste host.
- Limite desta ampliação: a especificação anexada determina autorização separada
  para publicação. Portanto, implementação, migration versionada e testes podem
  ser preparados localmente, mas migration remota, merge e produção ficam
  bloqueados até nova autorização explícita. Nenhuma mutação remota de dados foi
  autorizada por este pedido.

## 2026-10-26 — canvas analítico implementado e validado localmente

- Implementado nas rotas `/app` e `/app/etapas/agendamentos` um canvas
  configurável em grade responsiva de 12 colunas, com movimentação e
  redimensionamento por Pointer Events, encaixe, reflow, seleção múltipla,
  movimentação em grupo, desfazer/refazer, expansão, editor compatível por
  métrica/modelo/filtros/período, detecção de duplicados e exportação seletiva
  ordenada em PDF. Em celular, o layout é reorganizado em uma coluna sem perder
  legibilidade ou controles por teclado.
- Os perfis por usuário foram preparados com cache local de contingência,
  salvamento automático, perfil padrão e conflito otimista. A persistência
  versionada está em `20261026194815_dashboard_profiles.sql`, com RLS, MFA,
  grants mínimos e acesso somente pelas RPCs próprias; a migration não foi
  aplicada remotamente porque a especificação exige autorização separada para
  publicação.
- A Visão Geral preserva os 13 funis existentes e Agendamentos preserva seus 28
  cards, fontes, filtros, permissões e fórmulas. Os modelos alternativos só são
  oferecidos quando compatíveis com a métrica; nenhuma regra comercial foi
  inventada ou alterada.
- Validação local em Node 24.19.0/pnpm 11.20.0: lint sem erros (46 warnings já
  existentes/gerados), typecheck, catálogo de 41 páginas, inventário de 79
  rotas e build de produção aprovados. Vitest aprovou 4.355 testes e pulou 111.
- A etapa Node do `pnpm test` aprovou 1.599 testes e pulou 19, mas o gate global
  terminou com três falhas de ambiente Windows fora deste escopo: duas em
  `ops/meta-ads/connection-monitor.node-test.mjs` (arquivo privado owner-only e
  heartbeat do monitor) e uma em `ops/meta-ads/vps/session.node-test.mjs`
  (diretório pai absoluto real). Nenhum arquivo Meta Ads foi alterado para
  contornar o gate; CI integral continua obrigatória antes de qualquer merge ou
  publicação.
- QA visual da Visão Geral aprovou 267 verificações, sem erro de console, página
  ou navegador, cobrindo temas claro, médio e escuro, larguras desktop e móvel,
  filtros, permissões, estados indisponíveis e extremos. O canvas de
  Agendamentos aprovou 15 combinações de 320, 390, 768, 1440 e 1920 px nos três
  temas, sem corte, sobreposição ou overflow, além de teclado, desfazer,
  redimensionamento, grupo, expansão, perfis, editor e diálogo de PDF.
- Estado final: alteração implementada e validada localmente, sem commit, PR,
  merge, migration remota ou deploy. Produção permanece separada deste trabalho
  e deve continuar na versão observada na abertura até autorização explícita e
  aprovação integral dos gates.
- Conferência final em `2026-10-26T20:44:20Z`: `git fetch origin --prune`
  concluiu, `HEAD` e `origin/main` permaneciam em
  `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`, enquanto o health público
  respondeu HTTP 200, `status=ok` e versão
  `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. Isso confirma somente que o site
  publicado permaneceu inalterado; não constitui publicação deste canvas.
- O `knowledge:sync` final foi tentado depois do registro e permaneceu bloqueado
  pela falha preexistente `Documento excede o limite de exportacao.`. O vault
  não foi alterado por contorno e a sincronização não é alegada como concluída.

## 2026-10-26 — autorização para migration, PR e publicação do canvas

- O usuário concedeu autorização explícita para aplicar a migration aditiva de
  perfis, abrir e integrar o PR e publicar o canvas em produção. A autorização
  permanece limitada às rotas `/app` e `/app/etapas/agendamentos`, à migration
  `20261026194815_dashboard_profiles.sql` e aos arquivos de validação associados.
- O início do fluxo protegido confirmou `HEAD=origin/main` em
  `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`; `git diff --check` aprovou e o
  diretório não rastreado `output/` continua preservado e fora da entrega.
- A publicação seguirá PR, CI do SHA exato, migration via conector Supabase,
  artefato imutável, backup/rollback e o coordenador `release:production`. Uma
  falha em qualquer gate interrompe somente a etapa dependente, sem redução ou
  contorno do controle.
- No PR #367, o `validate` confirmou formato, lint e tipos, mas o inventário do
  ensaio ainda esperava 2.289 testes pgTAP depois da inclusão da asserção de
  volatilidade. O contador foi alinhado para 2.290 e o teste direcionado
  `tests/release-candidate.test.ts` aprovou 26/26 antes da nova CI.

## 2026-10-26 — Abertura: layout e acesso do Simulador CAIXA

- Escopo aprovado: alinhar `/app/simulacao/caixa` ao padrão visual dos
  simuladores Associativo e Tabela Direta nos temas claro, médio e escuro, além
  de liberar o motor CAIXA para todos os perfis autenticados do CRM. Fórmulas,
  cotas, taxas e demais regras financeiras permanecem fora do escopo de mudança.
- Git comum confirmado. A branch `codex/caixa-layout-acesso` foi criada sobre
  `origin/main` `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`; checkout iniciou limpo.
  O GitHub CLI está indisponível neste host, portanto PR e CI serão consultados
  por conector ou alternativa disponível antes da publicação.
- Health público observado em 26/10/2026: HTTP 200, `status=ok`, versão
  `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. A versão publicada contém as
  cotas SBPE anteriores, mas não contém esta nova alteração de interface/acesso.
- `knowledge:context`, `knowledge:search` e a sincronização inicial foram
  tentados e continuam bloqueados pela falha preexistente
  `Documento excede o limite de exportacao.`. A indisponibilidade não autoriza
  reduzir a autoridade documental nem dispensa a conferência direta do código,
  dos testes, do GitHub/CI e do site.

### CAIXA — layout, acesso, CI e publicação confirmados

- O PR #362 foi integrado sem bypass no `main` como
  `9cf72dafb273693f412143abc337eefd0ed80f4e`. A CI push/main
  `40411904177` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`; a etapa CAIXA e a matriz global de largura, temas, zoom,
  teclado e Axe passaram. Fonte:
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40411904177.
- Artefato imutável `12693059289`, nome
  `promotable-image-9cf72dafb273693f412143abc337eefd0ed80f4e`, digest do
  artifact `dd3216791d2c8ba7029747fb825d777e176ea1d0d38abfc00c7666b45e1231dc`.
  A captura protegida final `40404389362` também foi aprovada; artifact visual
  `12691744581`, digest
  `8f1c94fd968991568d736eb9abfdbf7ed8b9edb76a2b7e1ede0640bf7469be90`.
- O coordenador exclusivo registrou o deployment
  `a9d4d0ba-a660-4d88-b241-02ecff8d4e9b`, SHA exato `9cf72daf...`, imagem
  `sha256:41d65835f860fcb08797add395276711a9eb5e0bf39ce5b8ed938be3c1bc962c`
  e `deployedAt=2026-10-26T23:32:26.887Z` (20:32:26
  America/Sao_Paulo), sem pendência. A reconferência protegida com a CI exata
  retornou `noop`, preservando o deployment já ativo e sem reiniciar.
- Pós-publicação em `2026-10-27T00:34:26.521Z`: GET público do health respondeu
  HTTP 200, `status=ok` e versão
  `9cf72dafb273693f412143abc337eefd0ed80f4e`; GET anônimo de
  `/app/simulacao/caixa` respondeu 307 para `/login`. A CI já havia validado a
  jornada autenticada com dados sintéticos, três temas, cálculo, Axe e overflow.
- Escopo preservado: fórmulas e regras financeiras não foram modificadas; SAC
  90% e Price 80% continuam cobertos. Nenhum dado remoto, migration aplicada,
  DNS, cobrança, conta ou workflow n8n foi alterado.
- Após a publicação, `origin/main` avançou para `962f7d9d` por uma entrega
  concorrente de Meta Ads. O registro distingue esse estado posterior da versão
  CAIXA comprovadamente publicada; não houve intervenção ou republicação da
  entrega concorrente.
- Fechamento documental: formato, lint, typecheck e build aprovados. A suíte
  Windows teve quatro timeouts de host em Associativo e conhecimento; repetição
  isolada dos dois arquivos, com um worker, aprovou 35/35. A CI Linux exata do
  SHA publicado é a evidência integral. O `knowledge:sync` final foi tentado e
  permaneceu bloqueado por `Documento excede o limite de exportacao.`; nenhuma
  redução do documento ou alteração do vault foi feita.

## 2026-10-27 — referências visuais do canvas autenticado

- A CI de `main` `40438827767`, no SHA exato
  `4d3557d5f0a147535cce6e8668fb25eab70f61a2`, aprovou `validate`,
  `isolated-restore` e `promotable-image`. O `release-gates` falhou somente por
  divergência em 22 capturas das duas rotas alteradas pelo canvas: `/app` e
  `/app/etapas/agendamentos`.
- O artefato autenticado `12707058881`, digest
  `83d8733eee69b847487efe4be1602feffafd3ffc87a8a8359d53128b8afb0a43`,
  comprovou 154/154 rotas, 88/88 combinações de tema, 242/242 auditorias Axe,
  teclado e zoom aprovados. Das 242 imagens, 220 permaneceram idênticas.
- Foram adotadas somente as 22 referências revisadas das duas rotas, com
  conferência de hash e tamanho, registro de proveniência no manifesto e sem
  alterar limiares, páginas externas ao escopo ou dados de produção. A revisão
  cobriu desktop nos temas claro, médio e escuro e celular nos temas claro e
  escuro, sem corte, sobreposição ou rolagem horizontal.
- A atualização oficial local do baseline não pôde subir o Supabase porque este
  host não possui Docker nem Podman. Foi usado o procedimento parcial já
  registrado no projeto, baseado no artefato autenticado da CI e limitado às
  imagens divergentes. Uma nova CI integral continua obrigatória antes do merge,
  da migration e da publicação.
- O fixture autenticado de Agendamentos apresentou o estado vazio
  `Dados analíticos indisponíveis`; portanto, essa evidência confirma layout e
  responsividade do estado protegido, mas não substitui o smoke pós-publicação
  com dados reais.
- O `knowledge:sync` continua indisponível pela falha preexistente
  `Documento excede o limite de exportacao.`; a sincronização com o Obsidian
  permanece pendente e não é declarada como concluída.

## 2026-10-27 — Canvas de Visão Geral e Agendamentos publicado

- O PR #369 foi integrado sem bypass no `main` como
  `897d0cf9c8a91b197a91c742c3799968c7dcc61c`. A CI push/main
  `40446127865` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`; a matriz protegida confirmou 154 rotas, 88 combinações
  de tema, 242 auditorias Axe, teclado e zoom. Fonte:
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40446127865.
- A migration aditiva `dashboard_profiles` foi aplicada no projeto Supabase
  `hnncxuerlcsaahdxoswb` após a CI verde. A conferência encontrou a tabela
  vazia, RLS ativa e forçada, duas policies, seis RPCs e seis grants de execução
  somente ao papel autenticado. Nenhuma linha anterior foi reescrita ou
  removida. Os advisors não apontaram falta de RLS/policy nessa tabela; os
  avisos globais preexistentes e o índice sugerido para a chave estrangeira de
  `page_key` ficam fora do escopo desta publicação e não alteram o contrato
  validado pelo pgTAP.
- Artefato imutável `12708028636`, nome
  `promotable-image-897d0cf9c8a91b197a91c742c3799968c7dcc61c`, digest do
  artifact `23e4fba0a27e60408a63042cdb5fefb3e5cee0d34b56664609db6f78152591e2`.
  `image.tar.gz` conferiu com SHA-256
  `c569e73511cf57801d087866246ffa6338aea3ba2e852a4bc353daf3cc1388f3`.
  O ID de configuração da CI
  `sha256:23fa4850774188822a2821caef1278a0afa0ce81f6067f80ff8be37815bffdc1`
  e o manifesto no host
  `sha256:716c83bf5718cae2a5d14e28dc400391e38b5569547c1c8a2e7eb5c982dacaee`
  foram reconciliados pelo índice, hashes de todos os blobs, revisão, plataforma
  `amd64/linux`, 11 camadas e `image:prove` nos dois perfis, sem rebuild ou
  retag.
- Checkout remoto limpo em
  `/srv/descomplica-crm-releases/897d0cf9c8a91b197a91c742c3799968c7dcc61c`,
  com Node 24.19.0 e pnpm 11.20.0. Backup privado do env e do ledger anterior em
  `/var/backups/descomplica-crm/canvas-897d0cf9-20261027T044637Z`; imagem
  anterior `sha256:41d65835f860fcb08797add395276711a9eb5e0bf39ce5b8ed938be3c1bc962c`
  preservada para recuperação.
- Publicação executada exclusivamente por `pnpm release:production`, com as
  três travas, consulta de baseline no próprio minuto, CI/main exatos e CAS.
  Resultado `deployed`: deployment
  `61163953-0645-423b-ab6a-ea62d18edf27`, SHA e imagem candidatos,
  `deployedAt=2026-10-27T04:46:55.929Z` (01:46:55 America/Sao_Paulo) e
  `pendingDeploymentId=null`.
- Pós-publicação em `2026-10-27T04:47:06.0919180Z`: health público respondeu
  `HTTP 200`, `status=ok` e a versão exata publicada; acessos anônimos a `/app`
  e `/app/etapas/agendamentos` responderam 307 para `/login`. O smoke
  autenticado recarregou Agendamentos com os controles de adicionar, organizar,
  desfazer/refazer, perfis, PDF, mover, editar, expandir, excluir e redimensionar;
  a Visão Geral exibiu `Dashboard | Resumo Geral` e os mesmos controles de
  canvas. As duas páginas ficaram sem alertas de interface e sem erros de
  console.
- O `knowledge:sync` final permanece sujeito à falha preexistente de documento
  acima do limite de exportação. O resultado será registrado como pendência,
  sem reduzir a proteção, truncar autoridade ou declarar sincronização concluída.

## 2026-10-27 — Abertura: automações e simplificação do Simulador CAIXA

- Escopo solicitado: tornar automático o teto indicativo de comprometimento em
  30%, o limite municipal conforme cidade/UF, o prazo máximo conforme a idade e
  a seleção da taxa aplicável ao valor do imóvel; reorganizar e vincular
  `Imóvel na planta?` e `Condição do imóvel`, preservando exatidão e simplificando
  a jornada de `/app/simulacao/caixa`.
- Git comum confirmado. Branch `codex/caixa-ux-automacoes` criada sobre
  `origin/main` `661c575619cfa53356406e5fbe15c71ca341be2d`; checkout limpo. A CI
  push/main `40436653510` estava em execução no início da demanda.
- Health público observado em `2026-10-27T02:19:47.032Z`: HTTP 200,
  `status=ok`, versão publicada
  `9cf72dafb273693f412143abc337eefd0ed80f4e`. A produção contém a entrega
  anterior do CAIXA, mas ainda não contém esta nova automação.
- `knowledge:context` e `knowledge:search` foram tentados e permanecem
  bloqueados por `Documento excede o limite de exportacao.`. A indisponibilidade
  não autoriza inferir limites ou taxas; regras financeiras serão confrontadas
  no código e em fontes oficiais antes da implementação.

### CAIXA — automações implementadas e validação pré-publicação

- A tela aplica e exibe automaticamente o comprometimento indicativo de 30% da
  renda e o limite municipal por cidade/UF. Foram importados os 5.571 registros
  da planilha oficial `TABELA_MUNICIPIOS_VIGENCIA_01JAN2026.xlsx`; uma comparação
  independente encontrou zero divergências, incluindo seis aliases históricos
  de nomes. A planilha é usada somente para o limite geográfico, pois seus
  títulos de faixas de renda estão defasados das regras publicadas em 2026.
- `Imóvel na planta = Sim` fixa `Novo` e desabilita a condição; `Não` limpa o
  valor, habilita a escolha e exige `Novo` ou `Usado`. O prazo solicitado é
  reduzido automaticamente ao máximo permitido pela idade em meses-calendário,
  preservando prazos menores escolhidos pelo usuário.
- A calculadora pública CAIXA v1.16.0.2 foi confrontada com dados fictícios, sem
  CPF, telefone, consentimento ou OTP. Renda de R$ 4.000, imóvel de R$ 276.000 e
  nascimento em 22/01/1987 produziram Price, 420 meses, primeira prestação de
  R$ 1.200 e 8,47% efetivos; com nascimento em 22/01/1955, o prazo caiu para
  105 meses. O motor local reproduz 8,4722% efetivos a partir de 8,16% nominal
  e identifica que a taxa da Faixa 3 foi aplicada pelo valor do imóvel.
- Cotas preservadas: SBPE usa 90% no SAC e 80% no Price. Classe Média com imóvel
  usado no Sul/Sudeste usa 60%. Subsídio incompatível é limpo e ocultado nesse
  enquadramento; o limite municipal não é mostrado como teto do SBPE.
- Validação local em Node 24.19.0/pnpm 11.20.0: lint sem erros e com 44 warnings
  preexistentes em arquivos públicos fora do escopo, typecheck, catálogo de 41
  páginas e build aprovados. Testes focados aprovaram 54 casos; a jornada de
  navegador aprovou 6/6 cenários nos três temas, larguras desktop/tablet/celular,
  Axe e overflow. A matriz Vitest integral com um worker aprovou 4.369 testes e
  pulou 112; seis timeouts do comando paralelo foram repetidos isoladamente e
  aprovaram 59/59.
- O `pnpm test` e o `pnpm test:release` no Windows também alcançaram falhas fora
  deste escopo em fixtures de host Meta Ads (`Missing synthetic file`) e testes
  de permissões/monitor do ambiente. Nenhum arquivo Meta Ads ou de release foi
  alterado para contornar essas falhas. A CI Linux no SHA exato permanece gate
  obrigatório antes de merge e publicação.
- Revisão independente não encontrou achados remanescentes no escopo CAIXA.
  Nenhuma migration, dado remoto, DNS, cobrança, conta ou workflow n8n foi
  alterado. Estado neste registro: implementado e validado localmente no escopo;
  PR, CI, merge e publicação ainda pendentes e serão registrados separadamente.
- O primeiro candidato visual do PR #368 falhou porque o E2E protegido ainda
  tentava editar `Condição do imóvel` depois de a nova regra tê-la preenchido
  como `Novo` e desabilitado para imóvel na planta. O teste foi alinhado para
  conferir o valor e o estado travado; nenhuma regra financeira foi relaxada.
- O segundo candidato protegido aprovou o E2E e a comparação cromática/estrutural
  com o canvas externo. A única reprovação foi a altura de 1.204 px diante do
  teto histórico de 1.200 px da rota, após incluir as orientações automáticas.
  O teto exclusivo foi ajustado para 1.220 px; referência, tolerâncias de cor e
  bordas, baseline, Axe, overflow e demais rotas permanecem inalterados.
- O PR #368 foi integrado em `main` como
  `04300be6bb54561b8ab4785dab197f3822010140`. Na CI de `main`
  `40457067981`, `validate`, `isolated-restore`, a imagem promovível e todos os
  testes funcionais do `release-gates` passaram. A matriz visual reprovou
  exclusivamente onze comparações da rota CAIXA por mudança de altura: as
  referências ainda representavam a tela anterior, sem os dois cartões
  automáticos. Não houve falha funcional, Axe, teclado, zoom, overflow ou do
  canvas externo.
- As onze capturas sintéticas do artefato `12714049954`, digest
  `7445ed01d68d655405e1c25ace6468ec76b58a9b5e058b6591dc49d0aa23c922`,
  foram revisadas em desktop, notebook, tablet e celular, nos temas claro,
  médio e escuro. Somente essas imagens e suas 38 entradas de evidência foram
  adotadas; as outras 231 referências e todos os limiares foram preservados.
  O Docker/Podman está indisponível neste host, portanto a nova comprovação
  integral depende da CI Linux em modo de verificação. Produção permanece
  bloqueada até esse gate concluir com sucesso.
- Na branch da baseline, 69 testes focados passaram e 5 foram ignorados por
  condição; lint, typecheck, formatação e build de 41 páginas/71 saídas
  estáticas passaram. O `pnpm test` confirmou 4.369 testes Vitest e 1.599
  testes Node, mas encerrou com as mesmas três falhas de host Windows dos
  fixtures Meta Ads (arquivo privado/perfil absoluto), fora do escopo. A CI
  Linux continua sendo a evidência conclusiva desses testes.

## 2026-10-27 — Abertura: Links Úteis

- Escopo solicitado: menu Links Úteis e conteúdo das sete opções da referência Data Studio, excluindo Ranking Geral.
- Consulta em 27/10/2026 às 14:51–14:54 UTC: Git comum confirmado; checkout inicialmente destacado e limpo em bb56fd7b23e872c69e3c5dac144afb30e4397cc4, igual a origin/main após fetch. Branch de trabalho codex/links-uteis.
- GitHub: main bb56fd7b23e872c69e3c5dac144afb30e4397cc4; CI 40470172649 concluída com sucesso. Busca de PR por Links Úteis sem resultados. Fontes: https://api.github.com/repos/contatoleandrolucass2-a11y/descomplica-crm/branches/main e https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40470172649.
- Health observacional https://crm.descomplicapro.com.br/api/health: HTTP 200, status ok, version 83a92392bbf1734a15ce5eb2f33a4e623bf9af41. Main posterior contém registro documental de publicação; versões local e publicada permanecem distintas.
- Conhecimento: comandos context e search interrompidos por “Documento excede o limite de exportacao.”; contexto versionado lido diretamente. gh ausente no PATH; conector GitHub funcionou. Relatório de referência abriu no navegador, após falha da ferramenta web; conteúdo ainda em levantamento. O problema de tamanho do runtime não será corrigido incidentalmente; reavaliar em demanda própria de conhecimento ou quando houver documentos dentro do limite.

### Implementação e validação local

- Implementado o hub `/app/links-uteis` e sete subpáginas: Grupos WhatsApp, Lojas Horários, Relacionamento, Regras Comerciais, Campanha do Mês, App Bora Vender e Linktree e Liveprint. Ranking Geral não integra o novo menu.
- Fonte: relatório Data Studio `6012adde-5a26-4274-b83b-67f3bac84f08`, consultado visualmente em 27/10/2026. Contato de Lucas e Grupo de Apoio ficaram sem link porque os destinos da referência divergiam do texto; materiais de julho foram identificados como históricos, sem alegação de vigência.
- Catálogo: oito permissões independentes e migration `20261027160500_sync_page_catalog.sql`; o primeiro registro herda `crm.dashboard.view` para preservar o acesso dos perfis ativos, mantendo overrides futuros por página. Nenhuma migration foi aplicada remotamente nesta etapa local.
- Gates locais em Node 24.19.0 e pnpm 11.20.0: lint sem erros (44 avisos preexistentes), formatação, typecheck, build, pages:check, resources:check e 4.415 testes Vitest aprovados; 28 testes dedicados cobrem guards, conteúdo, links e ausência do Ranking Geral. Os 35 testes isolados antes afetados por carga também passaram.
- Limite do host Windows: a etapa Node da suíte integral aprovou 1.599 testes e falhou em três fixtures de permissões/ACL Meta Ads dependentes de Linux. `test:release` também encontrou fixtures Linux de arquivo privado. Essas falhas não foram corrigidas fora do escopo; a CI Linux é o gate conclusivo antes de integração e publicação.
- PR #376: o primeiro candidato no SHA `6f0440aa` detectou overflow do cabeçalho em 1.440 px após o nono item raiz; o layout intermediário foi compactado sem alterar o breakpoint móvel. O E2E integral seguinte aprovou a largura antes problemática. No SHA `5d621a3e`, `validate` aprovou integralmente, mas a captura arquivada ainda fixava os oito itens anteriores e reprovou exclusivamente o contrato de navegação. O verificador passou a exigir a ordem, o foco por teclado, o nome acessível e os sete destinos do novo submenu; nenhuma tolerância visual foi relaxada.
- Após integrar `main` em `ebafdc9b`, `validate`, replay das 93 migrations, build e E2E autenticado aprovaram. A captura arquivada identificou que o contrato novo havia invertido somente os dois últimos grupos comerciais: a ordem renderizada e definida em `ROOT_NAVIGATION_ORDER` é Gestão, Links Úteis e Administração. O contrato e o percurso por teclado foram alinhados a essa ordem; artefato diagnóstico `12756382812`, digest `9407da3e32548ed059a0303a35997a2d52d79b1a8b03f1da438aed6c046906e6`.
- No SHA `0f5ed1b8`, a CI Linux `40572457942` aprovou formatação, lint, tipos, suíte integral, inventários, audit e build. O candidato autenticado `40572457793` aprovou migrations, E2E de autorização, Axe, teclado, zoom, simuladores e contratos do arquivo; 49 comparações excederam 1% exclusivamente pelo novo item raiz e pelas oito permissões visíveis no catálogo. As 49 imagens foram revisadas no artefato `12767594748`, mas sua adoção aguarda um novo candidato sem falhas funcionais; as demais referências e os limiares permanecem inalterados.
- O mesmo candidato registrou uma falha funcional adicional em `/app/etapas/agendamentos` no viewport 1.280×720: a superfície da navegação excedia a largura disponível após o nono item. A faixa de 1.181–1.320 px passou a reaplicar a compactação de 11 px e espaçamento mínimo também nessa rota; teste de contrato da interface e arquivo aprovou localmente. A nova CI permanece necessária antes do merge.
- Após integrar `main` `74ae2030`, o SHA `80bdb936` aprovou a CI Linux `40581631899` e o candidato visual `40581631908`. A matriz registrou zero falhas de rota, Axe, arquivo e zoom; a geometria de Agendamentos em 1.280 px foi validada. O artefato transacional `12772484092`, digest `31b1b99aae51829b6bcefc6424bea020eb112e3df0fcaeaf573285486939f376`, promoveu 60 de 242 imagens: as 49 previamente revisadas mais 11 referências do Dashboard cuja baseline vigente chegou pela integração concorrente. Nenhum limiar foi relaxado.
