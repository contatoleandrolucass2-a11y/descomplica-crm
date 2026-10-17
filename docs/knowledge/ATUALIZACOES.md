# Aprendizados e atualizacoes

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
