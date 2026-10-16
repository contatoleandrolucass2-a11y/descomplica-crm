# Aprendizados e atualizacoes

## 2026-10-15: Dashboard, filtros dependentes e metas

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
