# Aprendizados e atualizacoes

## 2026-10-14: Atualizacao dos relatorios no dashboard

- Polling30s e leitura consistente implementados;180 testes focais/75 QA
  aprovados. PR223 ainda bloqueado por QA: fixture corrigida, timeout limitado
  e QA da Rotina aguardando CSS exato; refresh Next real aprovado na
  CI38601828514, sem reduzir gates. Retomada17:28:51Z: fetch confirmou main
  efc6a20/PR226; health200/ok/0019690. PR223 conflitante em documentos;
  integracao preserva seletor/contorno e exige nova CI. Sem n8n ou dados remotos.
  CI38607169365 aprovou2877 testes/restore/refresh real; QA aguarda tambem
  alinhamento do contorno antes de overflow, com rejeicao de erro persistente.
  Fontes, consultas de abertura, testes, falhas, limites e criterios integrais:
  [auditoria](../audits/dashboard-atualizacao-2026-10-14.md).

## 2026-10-14: Qlik via VPS

- Retomada19:40Z: Qlik substituiu os IDs observados da pasta/objetos. Navegacao
  pelo catalogo confirma Vendas46d5bcf7, PRODUTO26aed86d e container8b78e5d8;
  tabParceiraspUYysrvJ permanece. Motivo/periodicidade desconhecidos. Mapa
  registra evidencia e limites; preflight precisa novo candidato aprovado.
  Main d660ba9/CI38620208026 terminou com quatro jobs aprovados;
  health19:40:30Z200/ok77dd.
  FixSQL1ea9c09 passou validate e restore na CI38624000997; release pendente.
  Nenhum owner atualizado, schema aplicado ou carga real publicada.

- CI38620973126/ab61437: validate/SQL passaram; restore e lint falharam pela
  classificacao IMMUTABLE dos validadores timestamp/conteudo. Corrigida para
  STABLE na migration nao aplicada; nova CI obrigatoria, sem relaxar gates.
  Fonte logs GitHub19:14/19:18Z e documentacao PostgreSQL de volatilidade.
  Dependencias d660ba9 na VPS agora privadas e verificadas byte a byte; owner
  segue2f0907e, sem coleta. Health19:23:58Z200/ok77dd; mainCI ainda pendente.

- Retomada19:04Z: CI main77dd/38610165621 concluida success; main avancou
  externamente para d660ba9, CI38620208026 pendente. Health200/ok77dd e ledger
  CRM ee03fade-fcd0-4c3c-b410-d2bc0abd57f7, deploy18:42:12.845Z. Nenhum
  upgrade Qlik executado. Fontes git fetch/GitHub/SSH e health publico.
- Candidate visual38610921925 falhou sem artefato de diagnostico (upload so
  em sucesso). Adicionado upload sanitizado always separado; nao promove
  baseline reprovada. Reexecutar e corrigir causa antes de merge/deploy216.

- CI216/47c1e85: pgTAP v2 passou254; suite falhou somente2 allowlists globais.
  Expectativas corrigidas sem grants novos; nova CI/restore exigidos. Catalogo
  produtivo18:07Z confirma helpers, ausencia v2 e ACLs legadas restritas.
  Fonte GitHubCI38610922021/job116015515782 e Supabase MCP; nenhuma DDL.
  Gates locais combinados passaram. Ciclo/credencial/recibo em implementacao;
  nao confundem testes sinteticos com QIX, publicacao ou agenda real.

- 17:52Z: PR224/a282b3d aprovado CI38605138409, merge77ddc69; CI push/main
  38610165621 pendente. Health publico200/ok0019690; owner ainda nao atualizado.
  Checkout/dependencias preparados, sem alterar servicos. Fonte GitHub/SSH/health.

- V2 local com contrato/RPC/reader/UI e ativacao HMAC protegida. Testes locais
  passaram; pgTAP e visual autenticado ainda exigem CI isolada. Backup privado
  public/private/historico gravado; sem restore novo, fonte real ou DDL remota.
  Detalhes/limites no [runbook v2](../runbooks/qlik-ranking-v2.md) e auditoria.

- Destino /app/ranking, referencia Canal de Parcerias, Direcional/SP CAPITAL/
  CANAL IMOB. Duas coletas conciliadas e audiencia crm.ranking.view autorizadas.
- Historico integral em [auditoria](../audits/qlik-integracao-2026-10-14.md);
  contrato e pendencias em [mapa](../runbooks/qlik-partnerships-mapping.md).
- Retomada16:57Z: CI224/1d96204 com codigo/restore/E2E OK, visual pendente.
  Main0019690; health200/ok5c4d95e. Ledger externo depois registra0019690
  em16:58:40Z. Sem publicacao Qlik. Sync confirmou tres documentos.
- Migration/RPC v2 e endpoint HMAC em implementacao; sem DDL, carga ou agenda.
  Salesforce preservado. Revisar apos CI e prova de coleta real; nao e excecao
  aos controles. Historico arquivado por limite do sync, sem alterar o limite.
- CI38598554910/1d96204 integralmente aprovada em14/10. Main avancou para
  efc6a20 durante a CI; conflitos documentais conciliados preservando ambos.
  Nova CI do candidato combinado exigida. Sem upgrade ou coleta Qlik na VPS.
- [Historico integral](../audits/qlik-owner-historico-2026-10-14.md) movido
  por limite do sync. Contrato e escopo em qlik-partnerships-mapping.md.

## 2026-10-14: Pesquisa manual de unidades no Associativo

- Registro recebido de main0019690 preservado integralmente em
  [auditoria](../audits/associativo-pesquisa-conhecimento-2026-10-14.md).
  Movido somente por limite de sincronizacao; nao revalida fatos historicos.

## 2026-10-14: Seletor e contorno da Rotina

- Retomada15:54Z: Git comum confirmado, main/publicado5c4d95e; health200/ok.
  PR225 documental em5d7631c: validate/restore aprovados, release-gates falhou
  em daily-layout-320-balanced (CI38588434885). Diagnostico antes do merge;
  nao reiniciar CRM por documentos. Fontes: GitHub, git fetch e /api/health.
- Novos ajustes autorizados para publicacao apos validacao: seletor unico,
  controles redesenhados e contorno branco da coluna atual, sem mudar dados.
  Evidencias: [auditoria do seletor](../audits/rotina-seletor-2026-10-14.md).

## 2026-10-14: Pesquisa manual de unidades no Associativo

- PR220 integrado em main0019690. Registro integral de implementacao, CI,
  conflitos e limites preservado em
  [auditoria da pesquisa](../audits/associativo-busca-conhecimento-2026-10-14.md).

## 2026-10-14: Rotina compacta por conclusao

- PR222/publicado5c4d95e em15:16:09Z, deployment9573a6e9. Historico integral,
  validacoes e limites preservados na
  [auditoria compacta](../audits/rotina-compacta-2026-10-14.md).

## 2026-10-14: Funis mensais publicados

- PR218/16f4587 publicado12:24:35.454Z, CI main38558435232 verde, backup/imagem
  e CAS verificados. Smoke200/ok, /app307login e API401;242 comparacoes na CI.
  Origem intocada, aprovadas indisponiveis sem serie. Historico, recibo, excecao
  do limite de sync e evidencias integrais em
  [auditoria dos funis](../audits/dashboard-funis-2026-10-14.md). Sync final passou.

## 2026-10-14: Rotina individual publicada

- PR215/runtime faae8e9, CI38514527676 aprovada, deploy05:45:08Z; migration
  remota20261014054331 autorizada. Textos Imob revisados, conclusoes individuais
  semanais persistidas. Evidencias e registro integral anterior preservados em
  [auditoria da Rotina](../audits/rotina-individual-2026-10-14.md).
- PR219 documental aprovado na CI, ainda nao integrado; conteudo preservado
  na branch atual. Nao ampliar permissoes nem alterar dados comerciais.

## 2026-10-13: Replica informacional do dashboard legado

- PR213: informacoes da referencia em /app com dados atuais, origem intocada.
  Limites de dimensoes, series, autorizacao e evidencias da implementacao/CI
  preservados integralmente no [historico da replica](../audits/dashboard-reference-knowledge-2026-10-14.md).
  Historico nao comprova estado atual nem concede autorizacao.

## 2026-10-13: Conferencia de abertura do worktree 2fb2

- Consulta em 2026-10-14T01:04Z (13/10, 22:04 BRT). Git comum confirmado;
  checkout inicialmente limpo, HEAD destacado em
  b53dff377b56ac651cd7362f1babd7a6a0fb196b. Fetch origin concluido.
- GitHub main em 0fdbb80aa79d731bcd458ca4bc892ecc76be2918, um commit a frente
  do checkout. PR211 integrado em 13/10 as20:27:33Z; CI38462971446 concluida
  com success para esse SHA as21:06:36Z. Fontes:
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/211 e
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38462971446.
- GET publico de https://crm.descomplicapro.com.br/api/health as01:04:19Z:
  HTTP200, status ok, version0fdbb80aa79d731bcd458ca4bc892ecc76be2918.
  A versao anunciada coincide com main; esta leitura nao confere data de deploy,
  ledger ou fluxos autenticados e nao substitui o coordenador de publicacao.
- CONTEXTO, FERRAMENTAS, ATUALIZACOES e AGENTS locais sem diferenca para main.
  Runtime context/search executado, incluindo referencias curadas do Obsidian;
  notas historicas nao foram reutilizadas como prova operacional atual.
- gh ausente do PATH; consultas realizadas pelo conector GitHub. Doctor local
  incompleto por dependencias ausentes; Node24.19.0 e pnpm11.20.0 confirmados
  nos comandos com runtime fixado. Checks locais ainda pendentes; pnpm iniciou
  preparo automatico de dependencias pelo lockfile existente.
- Escopo de implementacao ainda nao informado neste chat. Registro de abertura
  local, sem novo commit, PR ou deploy. Reavaliar checkout e checks quando houver
  tarefa definida; CI de main nao valida alteracoes locais desta nota.

## 2026-10-13: Dois ciclos automaticos e protecao de entrada confirmados

- Status: agenda ativa e aceite concluido. Fonte: journal, Supabase MCP,
  get_workflow_details e auditoria salesforce-agenda-vps-2026-10-13.
- Segundo inicio natural17:30Z, publicacao201 as17:36:10Z, request
  3bdb5ff0-ee7a-4a32-974c-5947b50cd77a. Run392a3e84-bde8-46ea-afb3-e4fd6fa06484
  succeeded,159 registros/uma auditoria. Primeira run tambem unica apos replay.
- Snapshots avancaram17:08:37 ->17:33:45Z, mantendo3views/15metricas/
  15empreendimentos/144participantes. Sete relatorios completos por ciclo.
- Coletor689bf174 enabled/active, PID1138878 e zero reinicios; navegador2881480
  preservado. Proximo disparo18:00Z. Pico723681280 bytes abaixo do limite768MiB.
- N8n novo permanece dcffaf09/5nodes, ativo igual ao draft e sem salvar payloads.
  Probes sem bearer e corpo vazio: n8n403/CRM401 as17:22Z. Antigo nao acessado.
- Limites: causa do primeiro erro de coleta nao identificada; dois ciclos
  posteriores aprovados nao provam ausencia de falhas. Em recorrencia investigar
  diagnostico seguro sem enfraquecer integridade; MFA continua manual quando exigida.
- Guia de conclusao consolida acessos, operacao, backups e reversao. Segunda
  copia independente da chave de recuperacao continua recomendada ao operador.
- Evidencias e guia publicados no PR209. Escopo final de cinco documentos,
  sem novo deploy/restart; conferir CI desse PR antes de integrar. Runtime e
  coletor permanecem no SHA689bf174 ja aprovado, independentemente do SHA documental.

## 2026-10-13: Agenda ativa com primeiro recibo real confirmado

- Fonte: CI38431108475, instalador689bf174, journal, Supabase MCP e tela
  autenticada. Quatro jobs aprovados; ativacao17:04:52Z. Collector PID1138878,
  zero reinicios, monitor independente disabled/inactive, browser PID2881480.
- Publicacao17:10:59Z HTTP201, requestcf334046-6c94-4898-a04c-17f85e6ca05e;
  run6d4aaa43-1a8d-4db7-889b-00d46151700c succeeded,159 registros e uma auditoria.
  Replay controlado17:13Z HTTP200/idempotenttrue, sem duplicar run/auditoria.
- Sete contagens19974/1092/515/2606/766/36/7. Snapshots3views/15metricas/
  15empreendimentos/144participantes, generated_at17:08:37.306Z. CRM mostra
  coleta concluida e proxima execucao14:30BRT. Segundo ciclo ainda pendente.
- App foi publicado externamente em689bf174 as17:06:31Z, deploymentId
  fee876e4-5133-46db-93d6-8cc708a53e92. Health200/ok e ledger reconferidos17:12Z,
  inProgressnull; coletor nao reiniciou app ou navegador.
- Windows integradob825c2e: pnpm verify exit0, lint/tipos/test/build passaram,
  Vitest136arquivos/2647aprovados/63skips. Novo n8n mantem versao dcffaf09,
  cinco nodes, sem persistir payloads; nenhuma alteracao de workflow ou n8n antigo.

## 2026-10-13: Ensaio agendado revertido e coleta isolada completa

- Fonte: journal systemd, instalador privado, exportCandidate e consulta MCP
  agregada ao Supabase, entre16:26Z e16:39Z. CI38425049893 passou nos quatro
  jobs antes da ativacao554a971. Credenciais e estabilidade inicial passaram.
- Primeiro ciclo falhou16:28:55Z antes de publicar, sem diagnostico detalhado
  no log do scheduler. Nao atribuir a falha a timeout, memoria ou mudanca de
  dados sem evidencia. Ultima ingestao permaneceu07:28:32Z, request25ec6322.
- Rollback corrigido concluiu sem excecao, restaurando monitor enabled/active.
  Navegador manteve PID2881480. Historicos rolled-back foram arquivados sob
  lock, com verificacao de inode/fase/monitor e fsync; nenhuma credencial apagada.
- Repeticao isolada, publicacao false, concluiu os sete relatorios16:36:20Z:
  19973/1091/514/2605/767/36/7 linhas,15 metricas e144 participantes. Esse
  candidato privado nao foi enviado ao n8n/Supabase e nao prova agenda ativa.
- Main avancou para689bf174 pelo PR208 de outra tarefa. Instalador bloqueou
  preparo do SHA anterior, conforme contrato. Nenhuma mudanca em coletor,
  lockfile ou CI entre554a971 e689bf174. Novo checkout limpo e preflight passaram;
  aguardar CI38431108475 completa e dois ciclos reais antes de encerrar.

## 2026-10-13: Correcao systemd integrada e nova conferencia externa

- PR206 integrado em554a9715c2f2528dafa08dcc3eccd4d552d783d7 depois de
  CI38418203102 aprovada. CI de push38425049893 em curso; sem nova ativacao
  antes dos quatro jobs aprovados. Fonte: GitHub PR206/actions/main.
- Main recebeu PR205 de outra tarefa; merge preservou os dois conjuntos e
  todas as notas. Health e ledger as15:20Z confirmaram app7d6341f, publicacao
  b4e2c6bd-1b5a-4d7f-b324-8a580562eb0b as15:16Z, sem transacao pendente.
  Coletor e app possuem versoes separadas; esta tarefa nao reiniciou o CRM.
- Windows no conjunto a7657a1: lint (zero erros/um aviso preexistente), tipos,
  pnpm test completo e build passaram. Vitest136 arquivos/2647 testes/63skips;
  suites Node/coletor/release exit0, instalador focado69/69. Uma rodada anterior
  teve timeout30s Obsidian; repeticao sem build concorrente passou, sem mudar
  limites ou assertions. Revisao independente estatica sem achados concretos.
- Prova adicional com arquivo real de unidade systemd: dois ExecStartPre,
  expansao de caminhos, arquivos0600 e validacao estrita passaram sem rede.
  Unidade temporaria removida apos conferir seus bytes; runtime limpo pelo
  systemd. Nao registrar prova isolada como coleta ou publicacao real.
- Checkout554a971 preparado na VPS com copias locais de dependencias, sem
  hardlinks externos; leitura ajustada somente nas copias. Codigo imutavel e
  preflight dedicado passaram. Estado da tentativa anterior continua rolled-back,
  monitor enabled/active, navegador preservado. Nova ativacao e dois ciclos pendentes.

## 2026-10-13: Credenciais systemd e reversao real do coletor

- Fonte: VPS Ubuntu/systemd255, ensaio13/10 entre14:36Z e14:44Z, SHA1ace82d,
  depois de CI38408795856 aprovada nos quatro jobs. Suite coletor195/195 passou.
- Coletor saiu na inicializacao; nenhuma publicacao nova confirmada. Prova
  transiente reproduziu LoadCredential0440/root, recusado pelo contrato privado.
  Copias0600 em RuntimeDirectory0700 passaram, sem pedidos de rede nem segredos
  impressos; bytes conferidos e pasta runtime removida ao encerrar a prova.
- Rollback travou porque reset-failed recebeu unidade ja descarregada.
  Recuperacao excepcional omitiu somente reset depois de conferir collector
  inactive/disabled; CAS, lock, remocao da unidade propria e restauracao do
  monitor foram preservados. Estado final rolled-back e monitor enabled/active.
- Navegador manteve PID2881480 e inicio12/10; novo n8n e antigo intocados.
  Corrigir compatibilidade e estabilidade inicial, publicar via PR/CI e repetir
  dois ciclos antes de afirmar agenda ativa. Excecao nao autoriza pular gates.

## 2026-10-13: Coletor integrado, preparo sem ativacao

- PR203 integrado em `1ace82d16ad3cdc117a96d36cd9f935657581bee`, apos CI38400603988
  aprovar validate/release-gates/isolated-restore. Imagem no evento PR e pulada
  por contrato; CI de push38408795856 valida os quatro jobs antes da ativacao.
- Suite Vitest Windows passou integralmente com maxWorkers1: 136 arquivos,
  2647 testes,56 skips existentes. As rodadas com concorrencia maior tiveram
  timeouts devtools/Obsidian; Next MCP isolado passou em2,89s. Contencao de
  recursos e hipotese, nao causa definitivamente provada. Nenhum timeout,
  assertion ou codigo de teste foi afrouxado. Criterio de revisao: recorrencia
  sem carga concorrente exige novo diagnostico; CI Linux tambem passou.
- Coletor194/194 antes de caso adicional, instalador final57/57 e release113/11
  skips POSIX no Windows. Lint/typecheck/build e formato passaram. Unidade
  renderizada foi aceita por systemd255 em pasta temporaria, sem instalar.
- Checkout1ace82d preparado na VPS, lockfile congelado e lifecycle scripts
  desabilitados. Copias pnpm independentes tinham23750 arquivos sem leitura
  pelo usuario dedicado. Conferidos root-owner, ausencia de hardlinks/links
  externos e inode antes de liberar leitura somente dessas copias de codigo.
  Cache compartilhado e segredos nao alterados. Imports e preflight passaram.
- Backup operacional privado com checksums e fsync em
  `/srv/descomplica-backups/collector-before-1ace82d-m4obyc`: unidade/config do
  monitor e candidato anterior. Nao substitui o backup de banco ja restaurado.
- Nova conferencia11:00BRT: health publico200/ok e ledger no SHA08c3ae, sem
  publicacao pendente. Git main1ace82d e distinto do app08c3ae. MCP confirmou
  novo n8n ativo emdcffaf09, cinco nodes e execucoes sem payloads persistidos.
  N8n antigo intocado. Agenda ainda desligada, monitor atual preservado.

## 2026-10-13: Integracao concorrente durante a correcao da Rotina

- PR203 integrado em1ace82d16ad3cdc117a96d36cd9f935657581bee as13:54:12Z,
  CI38400603988 aprovada. GitHub/main passou a incluir o instalador de agenda
  Salesforce. Merge preserva ambos os conjuntos; conflitos somente nas tres
  notas compartilhadas, resolvidos mantendo o conteudo integral.
- Browser final90/90 passou com24 combinacoes Axe e CSS minificado. Nova
  verificacao local foi interrompida durante lint para integrar main; nao vale
  como validacao do conjunto. Reexecutar gates apos o merge e CI no novo SHA.
  Nenhum instalador, agenda, n8n, migration ou configuracao remota sera executado
  por esta tarefa de interface; publicacao normal preserva env vigente.

## 2026-10-13: Abertura da correcao de rolagem da Rotina

- Git comum confirmado; checkout limpo em ad539567, PR #204 documental com
  CI38369900656 aprovada e integrado em cdb26fbd248c0a42cb7112cdb7674dae5237770a.
  Nova branch codex/rotina-rolagem-estavel parte desse main.
- GET observacional de https://crm.descomplicapro.com.br/api/health em
  2026-10-13T09:22:39-03:00: HTTP200, status ok, version
  08c3ae453ddfb225c3cb64971b53333c36d8932e. Diferenca do main e documental;
  nao demonstra a correcao solicitada. Fontes: GitHub PR204/CI e health publico.
- Escopo: investigar salto ao passar o mouse nas ultimas linhas; preservar
  posicao/foco e deixar credito sem faixa, a direita, com brilho direita-esquerda.
  Sem alteracao de dados, permissoes, migrations ou workflows. Validacao e
  publicacao ainda pendentes; testes anteriores nao cobriram este sintoma.
- Causa reproduzida no Chromium: focus na linha7 + hover final + GET de30s
  reduz scrollY4028 para237 ao zerar altura dos editores na medicao. Probes
  invisiveis fora do fluxo eliminam o encolhimento; regressao focal passou.
  Rodape passa a fundo transparente/alinhamento direito, entrada650ms e
  shimmer4.5s direita-esquerda, ambos desligados com movimento reduzido.
- CI38398973974: validate/restore aprovados; regressao autenticada de rolagem
  passou. Matriz bloqueada por comparacao textual dos keyframes de entrada.
  Reproduzido localmente habilitando minificacao CSS: translateX e translate
  sao serializacoes equivalentes. QA passa a conferir matriz/deslocamento e
  opacidade reais, sem afrouxar direcao/distancia; fixture usa CSS minificado.
- Suite geral local: primeira tentativa teve dois timeouts Obsidian sob carga;
  repeticao com VITEST_MAX_WORKERS=1 passou2647 casos, coletor138 e release113.
  Os11 testes fisicos POSIX continuam exclusivos Linux. Browser focal inicial:
  80 passaram/7 timeouts sob carga; repeticao e build local pendentes.
- Retomada as10:53 Sao Paulo: origin/main permanece cdb26fbd; health publico
  HTTP200/ok/08c3ae4. Checkout limpo37951f4 e PR205 aberto. CI38402470753 tem
  validate/restore aprovados, mas matriz autenticada bloqueada em visual1440-light,
  apos aprovar regressao de rolagem e sem repetir erro de keyframe.
  Fontes: GitHub PR205/actions e /api/health; nenhum deploy desta correcao.
- Repeticao local com CSS minificado passou87/87 casos de interface/API;
  pnpm build aprovado. Pendencia restante: diagnosticar e corrigir a divergencia
  da matriz autenticada, sem remover gates ou assumir sucesso pelo teste local.
- Causa da segunda falha reproduzida: Axe com movimento reduzido detecta contraste
  1.08:1 no credito branco sobre fundo claro. Sombra nao substitui contraste.
  Texto branco preservado no escuro; temas claros usam18354f/156782. Axe passa
  a testar ambas as preferencias; diagnostico CI registra somente IDs de regras.

## 2026-10-13: Retomada para agenda Salesforce na VPS

- Usuario autorizou continuar depois da conexao e carga real. Escopo agora:
  preparar, validar e ativar o agendador de 30 minutos, preservando n8n antigo.
- Consulta GitHub e health em 09:14 de Brasilia: main e versao publicada
  `08c3ae453ddfb225c3cb64971b53333c36d8932e`, health 200/ok. PR202 integrado
  depois da nossa publicacao15ddedd; nao usar o ledger anterior para deploy.
- PR203 documental continua aberto em a91d30e; CI38363681423 falhou em validate
  e ignorou os jobs dependentes. Log do job115183614012 confirmou HTTP403 da
  fonte ITBI/SP. O mesmo verificador passou localmente depois, sem mudar o gate.
- Merge de main preserva integralmente os registros de ambas as frentes.
  Agenda, monitor e configuracao remota ainda nao alterados nesta retomada.
- Preflight09:31BRT: probe real retornou connected, n8n MCP ativo emdcffaf09
  com cinco nodes e sem salvar execucoes. Container CRM ingesttrue/refreshfalse;
  chaves efetivas correspondem aos arquivos privados, sem valores exportados.
  Supabase ainda mostra a carga real07:28Z como ultima run.
- Preparacao usa coletor integrado existente, unidade nao-root e LoadCredential
  systemd255, com instalacao reversivel separada. Revisao crm-qa57tests passou;
  encerramento forcado/lock e progresso volatil permanecem limites documentados.
  Criterio de conclusao: CI verde, ativacao protegida e dois ciclos reconciliados.
- Nova conferencia GitHub: main avancou para cdb26fb (PR204), exclusivamente
  CHANGELOG/WORKLOG/ATUALIZACOES. Publicacao da aplicacao continua08c3ae.
  Integrar as notas antes de enviar o coletor; nao reiniciar CRM por documentos.
- Testes do instalador57/57, coletor194 antes do ultimo caso adicional,
  release113/11 skips POSIX, lint/typecheck/build passaram. Suite Vitest local
  registrou timeouts em devtools/Obsidian, ainda em diagnostico. CI Linux e
  verificacao fisica do systemd permanecem gates, sem alegar ativacao.

## 2026-10-13: Conexao real concluida, agenda ainda desligada

- Fontes atuais: GitHub PR198/main15ddedd e CI38358420498 com quatro jobs verdes;
  VPS release54fc028d de07:27:06Z; health publico200/ok no SHA15ddedd.
- Artefato da CI preservado sem rebuild. Diferenca classic/containerd provada
  pela cadeia index/manifest/config/11camadas e RootFS; image:prove aprovou
  os dois perfis. Auditoria registra checksums/digests e cronologia completa.
- Configuracao aplicada pelo coordenador com tres travas, CAS, backup integral
  root600 e verificacao dos quatro valores efetivos. Ingesttrue/refreshfalse;
  CRM sem auth401, webhook n8n sem auth403, refresh desabilitado404.
- MCP publicou L90AYSBEat4vYHLz/dcffaf09 e releu ativo igual ao draft.
  Nome atual CRM VPS - Salesforce - Ingestao CRM, alterado somente por MCP
  apos validate_workflow; nodes, credenciais, conexoes e settings identicos.
- Exportacao real06:56Z, UUID25ec6322-4a01-4838-9b89-55934a9217fe:
  HTTP201 em07:28Z e replay200/idempotenttrue em07:29Z. Supabase confirma
  run d5b24cc6-561a-4eef-a427-97086d60c9ec, count159 e uma auditoria.
  Snapshot13/10: 3views,15metricas,15empreendimentos,144participantes.
- Navegador autenticado confirmou Salesforce conectado, n8n ingestao confirmada
  e Supabase leitura confirmada. Sem logs persistentes de payloads no n8n.
- Excecao operacional explicita: monitor atual nao recebe contagens/recibos
  do envio pontual. Tabela do coletor ainda pode mostrar Sem dados; cartoes
  consultam evidencia duravel independente. Revisar ao implantar agendador.
- Agenda30min sem timer/processo ativo em07:31Z; publisher habilitado somente
  em dois processos pontuais. Proximo passo exige implantacao versionada,
  teste de falha/restart e dois ciclos reconciliados. Nao prometer recorrencia.
- N8n antigo nao acessado/alterado. Sem migrations remotas. Backup offsite ja
  recuperado; segunda copia independente da chave continua recomendada.
- pnpm verify repetido exit0, CI completa verde e screenshot real inspecionado.
  Documentacao final em branch separada, sem nova mudanca de runtime.

## 2026-10-13: Efeitos e compactacao da Rotina publicados

- PR #202 aprovado pela CI38360349190, integrado em08c3ae453ddfb225c3cb64971b53333c36d8932e
  as07:41:55Z. CI main38364326341 concluida com os quatro jobs aprovados.
- Conferencia do coordenador novo no checkout limpo do candidato: producao
  mudou por outra entrega para15ddedd, deployment54fc028d-2a07-4b82-9605-7c42421c5a72,
  deployedAt2026-10-13T07:27:06.373Z (04:27:06 Sao Paulo), imagem
  sha256:e1770f9bcfd5148a56335027f60c209fb47fb86cf6282489531f92d1bb17855a,
  sem pendencia. CI main38358420498 aprovada. Proxima expectativa de CAS usa
  esse estado observado; nao reutilizar a baseline anterior7c50f59.
- Promocao da Rotina nao solicitou configuracao Salesforce; preservou o env
  vigente. Nenhum workflow, banco, agenda ou fonte de credenciais alterado.
- Publicado pelo coordenador: deploymentd045c054-2ad5-4e5c-aff0-c8c100df3a03,
  deployedAt2026-10-13T08:22:09.455Z (05:22:09 Sao Paulo), SHA08c3ae4 completo
  acima, sem pendencia. Consulta no mesmo minuto, trava e CAS da baseline15ddedd.
  Nenhuma opcao de configuracao Salesforce usada.
- Imagem local sha256:03b6c8594550a0ac61b79b287b0cae8bdb5fbb3fc7001a0b4f484310cd2d268e;
  config/CI sha256:b56165aa25d622efbb07b41caff60a66e4e489356be07f47df1d759dc387ff17.
  Artefato dd7723dbdad1ac496d779286eb85d8320a916ce2733dcb8f2e53b5bff40797d4;
  checksum, manifesto OCI, 11 camadas e dois perfis conferidos, sem rebuild na VPS.
- Backup privado verificado: /var/backups/descomplica-crm/releases/08c3ae453ddfb225c3cb64971b53333c36d8932e.ivNJ7z,
  manifestb31926a4a9f6f399cf89f9fe0183fdcd44bc3dc3a22c88e995852f790fba2d7e.
  Imagem anterior preservada; reversao de release concluida exige novo PR/CI.
- Pos-publicacao: health publico SHA exato/ok, container healthy, zero reinicios
  e sem OOM; inventario anonimo401, Gestao e Rotina anonimas307. Navegador
  autenticado confirmou Semana/Hoje, gradientes, contorno animado, realce,
  cabecalho sob menu, texto diario a esquerda e rodape com shimmer; console
  sem erros. Capturas locais em test-results/routine-preview/rotina-efeitos-publicada\*.png.
- Nenhuma edicao/salvamento de dados reais nesta verificacao; persistencia e
  permissoes preservadas e cobertas pela matriz autenticada CI. Testes locais
  focais83/83, Axe12 combinacoes, suite integrada2647/coletor138/release113;
  testes fisicos Linux aprovados na CI. Registro posterior e apenas documental,
  sem novo restart. Limites: browser manual desktop; mobile/temas na matriz CI.
- Encerramento documental: pnpm verify passou novamente no checkout integrado
  (lint/typecheck/test/build), sem mudanca de runtime apos a publicacao.

## 2026-10-13: Retomada apos integracao concorrente

- Consulta as 03:58 Sao Paulo: origin/main mudou para15ddedd, PR #198
  integrado as06:44:24Z com CI38354900341 aprovada. Health publico segue
  ok/7c50f59. Fontes: GitHub PR198/main e /api/health do CRM.
- Merge em codex/rotina-efeitos-compactos preserva ambos os historicos; conflitos
  limitados a CHANGELOG, WORKLOG e este registro, resolvidos mantendo entradas.
  Revalidar conjunto integrado; nao ativar opcao Salesforce, agenda ou migrations
  nesta entrega de interface. Coordenador novo deve ser relido antes do deploy.
- Conjunto integrado: lint/typecheck/test/build aprovados. Vitest2647/56skips,
  coletor138/0skips, release113/11skips fisicos exclusivos Linux. Fixtures
  Windows corrigidas pelo PR198 eliminam as seis falhas locais anteriores.
  VITEST_MAX_WORKERS=2; CI Linux continua obrigatoria no SHA integrado exato.

## 2026-10-13: Abertura dos efeitos e compactacao da Rotina

- Consulta as 02:23 de Sao Paulo: health publico em
  https://crm.descomplicapro.com.br/api/health confirmou ok/7c50f59.
  GitHub PR #201 documental tinha CI 38344420076 aprovada e foi integrado em
  1c36fce187a22cc2527d19839eaa4f620f6673c4; nenhum redeploy documental.
- Branch codex/rotina-efeitos-compactos parte desse main. Demanda restrita a
  gradientes, realce linha/coluna, controles compactos e rodape da Rotina.
  Referencia https://descomplicapro.com.br/configuracoes/metas/parcerias
  somente leitura; nao alterar sua pagina nem persistencia, permissoes ou dados.
- Fetch web retornou timeout; navegador leu a referencia sem mutacoes. Estilo
  observado: current linear-gradient(145deg,#176f8a,#123b63), sombra cyan e
  transicoes de 180ms. Prints fornecidos definem realce de linha/coluna.
- Implementacao local restrita a RoutineSettings.tsx/module.css e seus testes:
  controles movidos, faixa redundante removida, gradientes e borda especular,
  crosshair CSS sem render React por mouse e rodape com movimento reduzido.
  API, schema e dados nao alterados. Ainda nao publicado.
- Revisao independente encontrou conflito de especificidade na intersecao,
  realces simultaneos de hover/foco e area touch de 36px. Corrigidos com
  seletores :where, prioridade ao ponteiro com retorno ao foco e minimo de
  44px em pointer coarse. Novos testes cobrem esses cenarios nos tres temas.
- Primeira rodada local: lint/tipos/build/formatacao aprovados; suite geral
  com 2567 aprovados, seis falhas POSIX conhecidas e 52 ignorados. Reexecucao
  final e CI Linux obrigatorias. Servidor dev em background bloqueado pela
  politica da ferramenta; nao contornado. Preview/testes usam harness isolado.
- Rodada final no CSS corrigido: 80/80 testes (48 de interface e 32 de API),
  sem skips, 73,43s; Axe sem violacoes nas 12 combinacoes. Revisao independente
  sem achados residuais, incluindo contraste do contorno com hover/foco nos
  tres temas e toque de 44px em 320/390px. Capturas em test-results/routine-preview.
- Gates locais finais: lint, typecheck e build aprovados. Suite geral Windows:
  2567 aprovados, seis falhas POSIX conhecidas em quatro arquivos e 53 skips;
  nao suprimir testes, reavaliar na CI Linux do mesmo SHA. QA usa fixtures/RPC
  mockada; nao comprova backend autenticado real. Nenhuma escrita em producao.
- CI PR #202/38353319930: validate e restore passaram, matriz autenticada
  falhou no helper novo que pressupunha movimento habilitado. O runner cria
  contexto reducedMotion=reduce; falha reproduzida localmente. Helpers agora
  testam ambos os modos e restauram a preferencia original em finally, inclusive
  apos falha. Nao mudar runtime, thresholds, baseline ou contexto global.
- Regressao ampliada: 83/83 casos focais aprovados; gates Windows mantem seis
  falhas POSIX/2567 aprovados/56 skips. Diagnostico futuro limita logs a fase,
  viewport e tipo de falha, sem DOM ou payload privado. Nova CI obrigatoria.
- CI 38356113124: primeira tentativa teve 403 da fonte Prefeitura; repeticao
  sem alterar checker passou validate/restore. O teste de celulas encontrou
  duracao minima global de 0,01ms com !important, divergente do contrato 0s.
  CSS reduzido da Rotina agora desliga a transicao com prioridade local;
  fixture importa globals.css integral. 83/83 testes e typecheck passam com
  a cascata real, sem reduzir assertions. CI autenticada precisa confirmar.
- Gates apos CSS global: lint/tipos/build/formatacao aprovados. Suite geral
  teve 2566 aprovados, seis falhas POSIX e um timeout transitorio do handshake
  Next DevTools; reexecucao isolada de project-devtools passou 24/24 em 2,32s
  sem alteracoes. Nao equivale a CI integral; reavaliar se timeout se repetir.

## 2026-10-13: Preparacao transacional da conexao Salesforce

- Encerramento da implementacao local06:06Z: pnpm verify aprovado, Vitest2647/
  43skips, coletor138, release113/11skips Linux e build50rotas. N8n23/23,
  fontes e QA sintetico nove telas/temas/zoom200% aprovados. Regressao manual
  sem monitor corrigida. Revisao independente sem P1/P2; crash fisico do
  conjunto config/Compose nao ensaiado. Status dos servicos usa endpoint
  autorizado e distingue leitura/ingestao historica de disponibilidade atual.
- Preflight VPS05:54Z: arquivos secretos privados/validos, baseline env/container
  coincide, ingestfalse/refreshfalse e ledger sem pendencia. Nao houve injecao.
- Formatacao alterada aprovada; comando global encontra dois artefatos output
  preexistentes nao versionados, preservados e fora da CI. Consulta ao PR por
  gh pr edit falhou pela API Projects classic; corpo atualizado via GitHub API,
  sem impacto sobre a regra de MCP exclusivo do n8n.
- Fonte: revisao do coordenador em c0fc782 e teste local de CLI/engine/policy/
  recovery, 91 aprovados. Alteracao em preparo no PR198: opcao explicita de
  configuracao, backup privado completo, CAS, verificacao efetiva e rollback.
  Nao e evidencia de promocao nem de ingestao real. Validacao completa pendente.
- Fonte remota 05:37Z: probe da sessao Salesforce conectado; Supabase ativo,
  ACL da RPC Salesforce service_role-only e tabelas Qlik sem acesso direto.
  Fonte MCP: candidata L90AYSBEat4vYHLz inativa, cinco nodes, sem agenda/logs.
- Main1c36fce integrada localmente; publicacao continua7c50f59. Consulta05:44Z
  PR198/head129e707: validate/restore aprovados, release-gates em andamento.
- Correcao da orientacao anterior de custodia: backup ja recuperado e chave
  fora da VPS/Supabase. Segunda copia independente recomendada; usuario nao
  tem pendrive e solicitou continuidade. Perda do PC continua risco documentado,
  sem dispensar gates de CI, autenticacao, restore ou reconciliacao de ingestao.

## 2026-10-13: Inicio da conexao n8n e Supabase ao CRM

- Usuario solicitou conectar o novo n8n e Supabase ao CRM. Main1c36fce contem
  evidencia documental de outro trabalho; producao continua7c50f59/ok,
  conferida05:31Z. PR198/head129e707 em conflito documental com main.
- CI38351116371: validate aprovado; restore/release em andamento. Nenhuma
  promocao autorizada por checks incompletos. Preservar n8n antigo e agenda.
- Backup externo e recuperacao estao comprovados; segunda copia da chave
  segue pendente. Conferir contrato de release/configuracao antes de mutacao.

## 2026-10-13: Retomada do backup externo e gates de ingestao

- Encerramento local: lint (um aviso preexistente), typecheck, test e build
  aprovados; Vitest2620/43skips, coletor138, release86/10skips Linux, n8n23/23.
  Fontes documentais e diff check aprovados. Build50rotas. PR198/aa2ec8f
  publicado; CI38350763371 ainda em validacao na consulta05:22Z.
- Health05:22Z ok/SHA7c50f59; runtime confirma ingestfalse/refreshfalse e
  secrets ainda nao injetados. Novo n8n e Postgres running/pausedfalse.
  Guia unico docs/runbooks/conclusao-salesforce-n8n.md entregue. Sem afirmar
  carga HTTP real, agenda ativa ou recuperacao de desastre completa.
- Restam custodia independente da chave, CI/main/imagem, promocao protegida da
  configuracao e carga201/replay200 reconciliados. Nao dispensar esses gates.
- Backup externo concluido: bucket privado crm-private-backups, dois objetos
  CMS AES256GCM/OAEP-SHA256, total881567bytes. Upload sem sobrescrita,
  download identico e decrypt local com SHA256 exato. Chave nunca transferida.
  Recibo privado offsite-20261013-HFynaO e copia criptografada local preservados.
- Novo backup n8n local-20261013T051032Z-Xi29nV restaurado148tabelas. Corrigida
  corrida pg_isready/socket temporario para SELECT1/TCP no banco destino.
  Primeira execucao via PowerShell acrescentou CR final; invocacao Node resolveu.
  Segunda tentativa revelou corrida real; script corrigido passou exit0.
- Revisao independente crm-dados confirmou gate Salesforce sem Qlik/v3 e
  necessidade de promocao efetiva para aplicar env (mesmo SHA resulta noop).
  Checklist atualizado, sem migrations, restart ou escrita de dados comerciais.
- MCP relido: candidata L90AYSBEat4vYHLz inativa, cinco nodes, versao
  dcffaf09-354c-4a82-817c-5e6ca9da1dd5, sem gravacao de execucoes/agenda.
- Repeticao da CI passou validate em 05:11Z, inclusive fonte anteriormente403;
  release-gates e restore ainda em andamento nessa consulta.
- Consulta 2026-10-13T05:07Z: producao health ok/SHA7c50f59; PR198
  head63bf15b aberto. CI38349346664 falhou na fonte Prefeitura ITBI HTTP403,
  nao no teste de criptografia. Release/restore dependentes foram ignorados.
- Nenhum gate sera removido por indisponibilidade de fonte. Backup externo
  autorizado pode avancar sem publicar runtime; nova tentativa CI sera conferida.
- Chave local continua sem segunda copia independente confirmada; usuario
  informou nao dispor de pendrive. N8n antigo e agenda permanecem preservados.

## 2026-10-13: Bucket privado e recuperacao sintetica

- Bucket crm-private-backups criado no projeto autorizado, privado, limite
  50MiB, MIME octet-stream. Sem policies anon/authenticated ou upgrade.
  Upload/download ficticio identico, leitura anonima negada, probe removido.
- RSA4096 local com ACL usuario/SYSTEM; somente certificado publico usado
  temporariamente na VPS. CMS AES256GCM/OAEP-SHA256 recuperado no Windows;
  adulteracao rejeitada. Chave sem senha propria, sob ACL; copia offline
  ainda depende do usuario, que informou nao ter pendrive agora. Guia local
  criado, sem segredo no Git. Nao considerar perda do PC coberta.
- GPG falhou ao iniciar agente Windows; OpenSSL existente passou no teste.
  Fontes: SDK Storage, catalogo SQL, ACL Windows e processos OpenSSL.
- Limites: nenhum backup real no bucket, sem prova de restore offsite ainda.
  Mesmo projeto nao protege contra exclusao do Supabase. Runbook
  docs/runbooks/crm-backup-storage.md registra gates restantes.
- PR198/e0fc881: validate e isolated-restore aprovados; release-gates ainda
  em andamento na consulta desta etapa. Nenhuma alteracao no n8n antigo,
  configuracao de runtime, migrations ou agenda.
- Health publico reconferido em 2026-10-13T04:55:18Z: ok, SHA7c50f59.
- Revalidacao local apos documentar a chave: lint aprovado (um aviso
  preexistente), typecheck, Vitest2620/43skips, coletor138/0skips,
  release86/10skips Linux e build50rotas aprovados. Formatacao dos quatro
  documentos, fontes publicas e git diff --check aprovados. Commit5820879
  publicado no PR198; nenhuma publicacao de runtime nesta etapa.

## 2026-10-13: Inicio do destino privado de backup autorizado

- Usuario autorizou bucket privado exclusivo no Supabase atual, sem upgrade.
  Projeto MCP hnncxuerlcsaahdxoswb confirmado ACTIVE_HEALTHY, organizacao Free.
- GitHub/main e health publico conferidos: 7c50f59/ok. PR198 head e0fc881;
  CI38347083443 validate aprovado, restore/release-gates ainda em andamento.
- Catalogo Storage: zero objetos/buckets/policies; RLS ativo em buckets/objects.
  Management API confirma limite global 52428800 bytes, sem alterar configuracao.
- Criacao e teste com arquivo ficticio nao equivalem a backup externo validado.
  Dados reais aguardam criptografia e guarda da chave de recuperacao separada.
  N8n antigo, agenda e configuracao do CRM permanecem fora desta operacao.

## 2026-10-13: Windows validado e plano remoto para revisao

- Corrigidas as seis falhas iniciais e incompatibilidades subsequentes nas
  etapas Node Salesforce/release antes bloqueadas por Vitest. Sem relaxar
  protecao de producao: ACL nativa Windows, POSIX fisico no Linux, logica CAS
  em memoria e rejeicao explicita de publicacao Windows. Dois testes fisicos
  POSIX somam-se aos oito flock ja exclusivos Linux; todos obrigatorios na CI.
- Apos integrar main7c50f59 preservando as tres notas conflitantes, pnpm test
  passou: Vitest2620/43skips, Salesforce138/0skips, release86/10skips, exit0.
  VITEST_MAX_WORKERS=2 evitou timeouts de concorrencia vistos na primeira rodada.
  Lint aprovado com aviso preexistente, typecheck e build50rotas aprovados.
  Testes n8n focados22/22. CI38346664206 parou somente na formatacao de tres
  arquivos n8n anteriores; formatacao corrigida e validada, nova CI necessaria.
- Auditoria aprovada somente como preparacao: Qlik/v3 ausentes no cloud nao
  sao dependencias do endpoint Salesforce v2. Plano e fontes em
  docs/audits/salesforce-cloud-preflight-2026-10-13.md. Nao criar/reaplicar
  migrations amplas para satisfazer gate de outro escopo; revisar gate primeiro.
- Restore temporario removido apos conferir label/imagem/rede; backup e recibo
  isolado privados preservados na VPS. Sem dados privados no Git. Backup externo
  autorizado ainda necessario segundo runbook n8n antes da carga comercial.
- Conferencia 2026-10-13T04:32:26Z: health200/ok e ledger7c50f59 sem pendencia;
  ingestfalse, refreshfalse, segredos ainda fora do processo CRM. N8n novo relido
  inativo por MCP; antigo intocado. Sem deploy, escrita cloud ou agenda nesta etapa.

## 2026-10-13: Backup cloud e prova isolada Salesforce

- Fonte: Supabase MCP, CLI 2.115.0 na VPS e restore Postgres 17.6.1.155.
  Backup privado em /srv/descomplica-backups/supabase-pre-salesforce-20261013-h0umc6;
  verification.json contem hashes/contagens, sem copiar dados para Git ou chat.
  Schema/dados separados nao compartilham snapshot; sem objetos Storage/offsite.
- Restore sem rede e sem portas passou: 65 tabelas COPY com contagens iguais;
  checksums, arquivos root600 e fsync confirmados. Nao prova boot da aplicacao
  restaurada ou descriptografia Vault. Nenhuma restauracao no banco cloud.
- Exportacao real finalizada em 2026-10-13T04:12:59Z, publisher desativado.
  Request 7fefa339-a000-4fdf-b7b5-7bce3231b1dd: RPC na copia isolada confirmou
  159 registros (15 metricas/144 participantes), replay idempotente e um run.
  Isto NAO comprova o caminho HTTP n8n -> CRM -> Supabase de producao.
- Suite pgTAP secure_ingestion em copia com dados nao e fixture limpa:
  primeiros 13 checks passaram, mas contagem preexistente e trigger de aceite
  legal impedem usar essa execucao como gate integral; transacao revertida.
- MCP remoto mostra somente RPC Salesforce dentre as tres do runbook;
  service_role pode executa-la, anon/authenticated nao. Auditoria/preparacao
  de migrations autorizada; sem aplicacao cloud e sem ativacao de agenda.
- Publicacao externa mudou runtime para 7c50f59 durante a tarefa; ledger
  bf212f6d-32ae-450c-868f-5ce080359fe9, deployedAt 2026-10-13T03:57:09.142Z,
  CI38340719697 aprovada e health com nonce conferido. Nao foi deploy desta tarefa.

## 2026-10-13: Inicio da primeira ingestao autorizada

- Usuario autorizou backup do banco, aplicacao da configuracao, teste real
  antes da agenda e correcao das seis falhas Windows; n8n antigo preservado.
- Git comum confirmado; trabalho segue no worktree n8n-crm-isolado, HEAD
  81e31af. Checkout principal tem alteracoes alheias e nao sera modificado.
- Fontes: git fetch, GitHub PR198 e GET health. Main 7c50f59, PR aberto com
  conflitos, runtime ok/1160a0e. Nenhuma dessas versoes equivale a outra.
- MCP Supabase confirma hnncxuerlcsaahdxoswb ACTIVE_HEALTHY/Postgres17.
  Acesso SQL de backup ainda nao comprovado; nao contornar esse gate.

## 2026-10-12: Segredos privados preparados, sem aplicar runtime

- Usuario criou crm_salesforce_backend_20261012 no projeto Supabase correto,
  preservando a chave antiga, e transferiu o valor via entrada oculta/SSH.
- /etc/descomplica-crm/secrets/salesforce-supabase-secret confirmado regular,
  root 600. GET autenticado somente do catalogo OpenAPI retornou HTTP 200;
  nao houve consulta a linhas comerciais nem ingestao.
- Criado Bearer separado em salesforce-crm-ingest-bearer no mesmo diretorio,
  root 600, sem exibir valor. Nao reutilizar segredo de entrada do n8n.
- Formulario do novo n8n preparado para CRM VPS - Ingestao CRM saida,
  Authorization, dominio especifico crm.descomplicapro.com.br; Valor e Salvar
  dependem do handoff ao usuario. Nao afirmar credencial salva ate releitura MCP.
- production.env nao alterado e app nao reiniciado. Aplicacao passa pelo
  coordenador release:production; mesmo SHA ativo gera noop, nao autoriza
  contornar locks com Compose/restart manual. Gates de ingestao permanecem.

## 2026-10-12: Preflight da saida n8n para CRM

- Inspecao sanitizada do container confirmou ingestao e refresh desligados,
  SALESFORCE_INGEST_SECRET e SUPABASE_SECRET_KEY sem valor. Nao confundir
  SUPABASE_URL de servidor com NEXT_PUBLIC_SUPABASE_URL inexistente no container.
- Projeto da URL conferido via MCP: hnncxuerlcsaahdxoswb,
  descomplica-crm-production, ACTIVE_HEALTHY. Nenhuma linha comercial consultada.
- Catalogo remoto: ingest_crm_salesforce_snapshot(jsonb) existe; EXECUTE negado
  a anon/authenticated e permitido a service_role. Nas duas tabelas Qlik, RLS
  ativo e SELECT/INSERT/UPDATE/DELETE negados aos tres papeis.
- As RPCs ingest_crm_imob_ranking_snapshot e ingest_crm_read_model_v3 nao foram
  encontradas nesse projeto, inclusive em outros schemas. Nao aplicar migrations
  para corrigir diferenca apenas com base no runbook; reconciliar antes de escrita.
- MCP novo n8n lista somente a credencial de entrada. Saida n8n para CRM ainda
  sem credencial propria; nao reutilizar token de entrada nem chave Supabase no n8n.
- Vitest tests/ingestion.test.ts: oito testes aprovados. O segundo filtro
  salesforce-config.test.ts nao encontrou arquivo; nao contar como suite executada.
- Usuario pediu ajuda para criar chave secreta. Guia oficial de API Keys aberta,
  redirecionou ao login; handoff ao usuario, nenhuma chave criada/extraida.
- Sem mudanca de workflow, runtime, ACL, dados ou agenda. Pendentes chave privada
  no servidor, credencial de saida, backup e demais gates da primeira ingestao.

## 2026-10-12: Coleta unica Salesforce na VPS validada

- Fonte: SSH, probe do monitor e exportador do release
  1a949982071ea0f62b094051668bfdb3f24b18b6, usuario descomplica-salesforce.
- Probe confirmou connected as 23:14 Brasilia. Exportacao iniciou 23:14:21
  e concluiu 23:20:21 com publisher explicitamente false, sem agenda.
- Contagens: oportunidades 19965; agendamentos 1091; visitas 514; pastas 2603;
  vendas 766; corretores 36; contas Canal Imob 7. Nao sao contagens de escrita.
- Candidato privado na VPS: 46592 bytes, modo 600, 15 metricas e 144 registros
  de ranking. Schema Zod salesforceIngestionSchema do release validou sem issues.
- requestId 3f9abc26-a79e-42bf-8a6c-402c5aecf974. Lock removido pelo exportador;
  nenhum conteudo de cliente copiado para Git, chat ou maquina local.
- Teste local report-collection.node-test.mjs: 20/20 passaram, com fixtures.
  Suite geral nao repetida: nenhuma alteracao de runtime nesta etapa.
- Main remoto e health permanecem 1160a0e92d734414f267249b63f56d70325fc529;
  branch iniciou em 99dfed55179b9c745adc00e30fc7f95762dc8593.
- Nenhuma escrita Supabase, publicacao n8n ou alteracao do n8n antigo.
  Pendentes os gates de backup/ACL/RPC, workflow completo, primeira ingestao
  confirmada e idempotencia. Somente depois habilitar agenda de 30 minutos.
- Transformacao levou aproximadamente 133 segundos apos a ultima fonte;
  tempo total de cerca de seis minutos nao garante SLA em outros volumes.

## 2026-10-12: Autenticacao HTTP VPS para n8n confirmada

- Fonte: SSH e MCP oficial, 23:11 Brasilia, branch codex/n8n-crm-isolado.
- Arquivo privado do token confirmado regular, root e modo 600; valor nao registrado.
- SDK validado antes da publicacao temporaria autorizada do workflow
  L90AYSBEat4vYHLz, versao 88270273-9a3b-40e6-9684-6e7ff54204a1.
- POST sintetico via HTTPS da VPS: sem token 403; token incorreto 403;
  token salvo 202 com ok false e status candidate_validated_not_published.
- Despublicacao via MCP concluida e relida: active false, activeVersionId null;
  persistencia success/error none e manual/progress false preservada.
- Nenhuma coleta Salesforce, escrita Supabase, agenda ou alteracao do n8n antigo.
- Health CRM ok, versao 1160a0e92d734414f267249b63f56d70325fc529.
  Consulta PR/CI indisponivel nesta retomada: gh ausente no PATH. Nao afirmar CI verde.
- Limite: comprova autenticacao e resposta da candidata, nao exportacao ou ingestao.
  Suite geral nao repetida: somente evidencia documental, sem mudanca de runtime.
  Revisar o fluxo antes de habilitar dados reais; token permanece privado na VPS.

## 2026-10-12: Teste sintetico remoto aprovado

- Limite liberado: validate_workflow retornou valid true/tres nodes. Fonte
  SDK recarregada do arquivo local apos argumento ausente em chamada inicial;
  erro de argumento nao foi HTTP 429 nem produziu alteracao remota.
- Mediante autorizacao especifica, settings manual/success/error habilitados
  temporariamente via MCP e relidos. Executada somente uma fixture sintetica,
  sem header secreto, Salesforce ou saida Supabase, em executionMode manual.
- Execucao 2 do workflow L90AYSBEat4vYHLz: status success, inicio 22:57:22 e
  fim 22:57:25 Brasilia. Validador retornou accepted true e ultimo node
  Responder Validacao Candidata terminou success, verificados por MCP.
- Escopo da prova: processamento interno. Execucao MCP sem header nao testa
  a autenticacao HTTP da VPS; nao comprova resposta de rede, exportacao real,
  qualidade integral dos relatorios nem ingestao CRM. Fixture preservada
  como evidencia, sem token real ou dados pessoais.
- validate_workflow aprovado antes da restauracao; update e releitura
  confirmaram saveManualExecutions false, success/error none, progresso false
  e active false. Sem versao publicada. Nenhuma mudanca no n8n antigo.
- Etapa documental local e teste remoto autorizado; sem nova suite geral,
  alteracao de codigo ou deploy CRM. Proximo gate: teste HTTP autenticado
  da VPS e, separadamente, conciliacao/exportacao e destino final autorizado.

## 2026-10-12: Teste temporario autorizado, bloqueado por rate limit

- Operador autorizou persistencia temporaria exclusivamente de execucao
  sintetica, com restauracao dos settings de privacidade depois.
- get_workflow_details confirmou candidata inativa e persistencia desativada.
  validate_workflow falhou no transporte HTTP 429 Too many requests, antes
  de qualquer update_workflow. Nenhum setting alterado ou teste executado.
- Aplicada regra de parada em falha MCP: sem repeticao ou fallback REST/UI.
  Retomar apenas apos liberacao do limite, validando antes de qualquer escrita.
  Autorizacao especifica registrada; nenhuma autorizacao para dados reais.
- Etapa apenas documental local; sem nova suite, deploy ou acesso ao legado.

## 2026-10-12: Primeiro teste manual MCP sem resultado recuperavel

- execute_workflow passou a estar disponivel apos recarregamento. Detalhes
  confirmaram candidata L90AYSBEat4vYHLz inativa, mesma versao 88270273,
  Header Auth vinculado e saveManualExecutions false.
- Teste manual com envelope inteiramente sintetico e header explicitamente
  invalido retornou executionId 1/status started. Nao equivale a sucesso nem
  a verificacao da autenticacao HTTP; MCP pode injetar dados no trigger.
- get_workflow_execution retornou execution null e Execution 1 not found.
  Nenhuma consulta por REST/UI/banco para contornar. Interrompidos os testes
  remotos conforme regra de falha MCP. Nao afirmar processamento aprovado.
- Nao persistir execucoes manuais pode explicar a falta de evidencia, mas
  causa nao comprovada. Solicitada autorizacao para guardar temporariamente
  uma execucao somente sintetica e restaurar a privacidade ao final.
- Sem alteracao de codigo/workflow, publicacao, dados reais ou Supabase.
  Health publico observado ok/1160a0e. Registro documental, sem nova suite.

## 2026-10-12: Credencial vinculada a candidata

- Operador salvou Header Auth. UI Detalhes confirmou ID VtBqo7sf3XOwxzpr;
  nenhum segredo lido ou copiado. Nome original CRM VPS - Snapshot entrada.
- validate_workflow aprovou SDK (tres nodes); setNodeCredential via MCP
  vinculou httpHeaderAuth ao Receber Snapshot Normalizado. Releitura confirmou
  referencia, active false e settings de privacidade preservados. Versao
  88270273-9a3b-40e6-9684-6e7ff54204a1. Sem publicacao ou execucao.
- Inventario e busca de ferramentas ainda nao expoem execute_workflow,
  apesar de OAuth anterior confirmado pelo CLI. Bloqueio de disponibilidade
  da ferramenta neste chat; nao contornado por REST, UI ou CLI de workflows.
  Revisar apos recarregar a conexao MCP no cliente; sucesso de autenticacao
  nao comprova exposicao da ferramenta nem teste da credencial.
- Novo backup apos cadastro/vinculo: local-20261013T014724Z-gwfMvc em
  /srv/descomplica-n8n/backups; 148 tabelas restauradas em banco isolado e
  checksums aprovados. Permanece local, sem teste de descriptografia ou boot.
- Apenas documentacao local alterada: gates de codigo da etapa anterior
  preservados, sem nova execucao da suite geral. Validacao MCP e restore reais
  feitos nesta etapa. CRM health ok/1160a0e e PR198 aberto em83eba34 antes
  deste registro. Nenhum deploy/restart CRM ou acesso ao n8n antigo.

## 2026-10-12: Retomada para backup e credencial

- Preflight: Git comum confirmado, branch codex/n8n-crm-isolado d7173b0;
  GitHub PR198 aberto nesse head, consulta Actions sem runs retornados.
  origin/main e health publico agora 1160a0e: publicacao externa ao trabalho
  desta branch. Runbook n8n-crm-isolated ainda ausente de main; usar PR198.
- Inventario MCP segue sem criacao de credenciais nem execucao de workflows.
  Solicitada autorizacao especifica para credencial pela UI e OAuth de testes;
  nenhuma ampliacao aplicada. Workflow e agenda permanecem inativos.

### Resultado da retomada

- Backup local privado executado em 12/10/2026 22:25 Brasilia; diretorio
  /srv/descomplica-n8n/backups/local-20261013T012505Z-dSchqd (nome UTC).
  pg_dump, configuracao/chave privada e volume .n8n arquivados na propria VPS;
  checksums aprovados. Sem transferencia de segredos ou dumps para o desktop/Git.
- Restore em container PostgreSQL descartavel sem rede/portas, imagem local
  igual ao banco e armazenamento tmpfs: 148 tabelas restauradas. Container
  removido; readiness ok. Diretório 0700/root e arquivos 0600/root confirmados.
- Limites: sem backup externo, boot de aplicacao restaurada ou teste de
  descriptografia. Copia no mesmo disco nao protege contra perda da VPS.
- Fonte tecnica: documentacao oficial n8n backup-and-restore; script
  ops/n8n/backup-local.sh. bash -n aprovado e execucao real delimitada acima.
  Tres testes locais estaticos de guardas, mais oito da candidata, passaram.
- Lint (aviso anterior), typecheck e build passaram. Suite geral: 2566 passaram,
  27 skips e seis falhas Windows anteriores; etapas posteriores ao Vitest nao
  executadas. Nao afirmar CI verde ou merge. Sem deploy/restart do CRM.
- Operador autorizou credencial nova via UI e OAuth para testes sinteticos.
  CLI confirmou login OAuth concluido com solicitacao de sete escopos:
  workflow read/write/execute, execution read, credential read, project read,
  tag read. Nenhuma permissao de administracao/pacotes/tabelas solicitada.
- Uma guia duplicada exibiu sessao expirada, mas CLI da primeira autorizacao
  confirmou sucesso. Tentativa redundante posterior cancelada, sem substituir
  MCP antigo. Ferramentas novas ainda ausentes no inventario deste chat;
  conferir carregamento antes de executar testes; nao contornar por REST.
- Formulario Header Auth preparado, Authorization e dominios de saida None.
  Usuario precisa colar/salvar segredo; token aleatorio 256 bits gerado em
  memoria e colocado no clipboard por pedido de ajuda, sem registrar seu valor.
  Credencial NAO confirmada salva nem vinculada. Nenhum workflow alterado/ativado.

## 2026-10-12: Candidata criada e privacidade relida

- Fonte: MCP n8n_crm_vps, workflow L90AYSBEat4vYHLz. Criacao e releitura
  confirmaram tres nodes, active false e activeVersionId null; nenhuma agenda.
- Operador autorizou expressamente validate_workflow no lugar de
  validate_workflow_code. Validacao SDK retornou valid true, tres nodes;
  update_workflow aplicou uma operacao de settings e releitura confirmou
  persistencia desativada, timeout 600 e timezone America/Sao_Paulo.
- Webhook headerAuth sem credencial atribuida. Candidata NAO esta pronta para
  receber dados. Sem execucao remota, publicacao de workflow ou escrita no CRM.
- Oito testes Node locais aprovados: baseline, paridade SDK, autenticacao
  requerida, resposta nao final e settings. Nao equivalem a teste ponta a ponta.
- Pendencias: credencial de entrada, backup/restauracao da instancia, execucao
  sintetica ponta a ponta e contrato completo antes da agenda de 30 minutos.
  MCP sem ferramenta de execucao/credenciais: nao contornar por REST ou CLI.
- Instancia antiga nao acessada nem modificada nesta etapa. Revisar bloqueios
  apenas com evidencias dos gates e ferramentas autorizadas disponiveis.
- Verificacao final: Node 24.19.0, pnpm 11.20.0; lint passou com aviso anterior
  em scripts/qa/connected-systems.mjs:18; typecheck e build passaram.
  pnpm test: 2566 passaram, 27 skips, seis falhas de caminhos/permissoes Windows
  em commercial-engine, mapping-import e dois testes de retirement/backup.
  Etapas posteriores ao Vitest nao rodaram; os oito testes Node acima rodaram
  separadamente. Falhas impedem alegar todos os gates verdes ou merge aprovado.
- Fontes finais: GitHub main 1160a0e, PR198 aberto (head anterior 2e95fa6 sem
  runs encontrados); GET /api/health publico ok/9ff3fd3. Versoes distintas.
  SSH docker ps confirmou n8n e PostgreSQL healthy, runner Up, n8n apenas em
  127.0.0.1:5678. Nenhum restart/deploy do aplicativo nesta etapa.

## 2026-10-12: MCP operacional e candidata nova

- search_workflows via MCP novo respondeu count0. Instancia nova vazia;
  nenhuma consulta ou alteracao no n8n antigo. SDK e tipos obtidos por MCP.
- GitHub main avancou para1160a0e; runtime publico segue9ff3fd3. PR198 aberto
  em2e95fa6 antes desta etapa. Consulta CI desse head nao retornou execucoes.
- Candidata local tem quatro testes Node aprovados. Preparacao nova sera
  inativa e autenticada, sem destino externo nem credenciais copiadas.
  validate_workflow e a ferramenta de validacao SDK exposta pelo MCP atual;
  validate_workflow_code nao existe neste inventario. Nao editar workflow
  existente sem resolver o requisito nominal exigido pelo operador.

## 2026-10-12: OAuth MCP confirmado

- CLI confirmou Successfully logged in to MCP server n8n_crm_vps apos acao
  do operador. UI Connected clients confirmou Codex e cinco escopos: listar
  workflows, criar/atualizar workflows, detalhes de execucao, buscar projetos
  e pastas, listar tags. Sem permissao de execucao ou instalacao de pacotes.
- codex mcp get confirmou entrada HTTPS habilitada sem bearer/http_headers.
  Autenticacao OAuth concluida nao prova ferramenta carregada no chat atual:
  inventario ainda nao expoe n8n nem validate_workflow_code. Necessario recarregar
  cliente/sessao MCP antes de trabalhar em workflows. Nao contornar via REST.
- Nenhum workflow criado, alterado ou ativado. Etapa documental/operacional,
  sem novo teste de codigo; preservar validacoes e limites do ultimo commit.

## 2026-10-12: MCP habilitado com OAuth pendente

- Confirmacao explicita recebida; Enable MCP access aplicado somente na nova
  instancia. Tela confirmou zero workflows, zero agentes e zero clientes.
- CLI oficial adicionou entrada separada n8n_crm_vps para URL HTTPS publica.
  Hashes das secoes n8n e n8n.http_headers antigos permaneceram identicos.
- OAuth padrao amplo foi cancelado antes do consentimento. Novo fluxo pede
  workflow:read, workflow:write, execution:read, project:read e tag:read,
  sem executar workflows, agentes, instalar pacotes ou ler credenciais.
- Navegador exigiu login no dominio HTTPS; handoff ao operador, sem leitura
  de senha/token e sem concessao concluida. Nenhum workflow alterado ou ativado.

## 2026-10-12: Preflight da conexao MCP nova

- Observacao CUA: Settings > Instance-level MCP em localhost5678 mostra
  Enable MCP access, portanto acesso ainda desativado. Usuario autenticado.
- Inventario de ferramentas sem MCP n8n; busca de plugins n8n retornou vazia.
  CLI local suporta mcp add/login com OAuth. Nenhuma configuracao alterada.
- Solicitada confirmacao no momento da habilitacao de acesso. Aguardar antes
  de clicar ou conceder permissoes. Preservar entrada MCP antiga e nao criar,
  editar nem ativar workflows sem ferramentas MCP e validacao exigida.
- GitHub PR198 aberto em b8ed0ef; health publico ok/9ff3fd3 nesta consulta.
  Somente diagnostico documental; sem testes novos ou restart nesta etapa.

## 2026-10-12: Owner confirmado e HTTPS n8n liberado

- Usuario confirmou cadastro. Navegador mostrou localhost/assistant autenticado,
  sem leitura de senha. Override HTTPS aplicado somente ao container n8n novo.
- Nginx validado e recarregado, sem restart CRM. HTTPS painel200, API anonima401,
  owner/setup403 e pagina signin confirmados. N8n/Postgres saudaveis, runner
  iniciado e servicos Salesforce ativos. CRM permanece ok/9ff3fd3.
- Fonte: SSH, CUA, health publico e GitHub PR198 (aberto,0d4c21b antes desta
  mudanca). CI desse head nao retornou run nesta consulta, sem afirmar aprovado.
- Nenhum workflow ou credencial legado alterado; MCP e backup/restore pendentes.
- Validacao final:41 testes focados, lint (um aviso anterior), typecheck e build
  aprovados. Suite Windows:2566 aprovados,27 skips,6 falhas POSIX/caminhos em
  arquivos fora do escopo; etapas encadeadas apos Vitest nao executadas.
  Sem merge ou declaracao de CI aprovada. Login HTTPS entregue ao operador.

## 2026-10-12: Retomada DNS n8n pela Hostinger

- Fonte: GitHub API e health publico em 2026-10-13T00:27Z. Main e runtime
  permanecem em 9ff3fd3; PR198 aberto em 2608b31, CI38326970948 em andamento.
- Acesso observacional a guia Hostinger recuperado nesta retomada. Autorizacao
  limitada ao novo A n8n-crm e HTTPS; preservar registros e instancia antigos.
  Owner ainda nao confirmado; nao expor setup administrativo na internet.
- Aplicado 21:29-21:32 Brasilia: Hostinger confirmou novo A n8n-crm, TTL300;
  DNS autoritativo e1.1.1.1 resolvem187.127.249.50. Registros anteriores intactos.
  Certbot webroot com conta existente emitiu certificado ate2027-01-10.
- Backup privado do Nginx anterior; virtual host exclusivo, nginx -t aprovado,
  reload sem restart. Primeira consulta imediatamente apos reload viu certificado
  antigo; consulta posterior com verificacao TLS normal confirmou503 esperado.
  Opcoes listen alinhadas ao http2 existente para eliminar aviso Nginx.
- HTTPS externo retorna503 deliberado, sem proxy para owner setup. Cadastro
  privado observado em localhost5678/setup, handoff ao usuario para senha.
  CRM segue ok/9ff3fd3; browser/monitor Salesforce e certbot.timer ativos.
- Encerramento 21:43 Brasilia: 40 testes focados aprovados; lint (um aviso
  preexistente), typecheck e build aprovados. Suite Windows: 2564 passaram,
  27 skips e7 falharam (seis contratos POSIX/caminhos, um timeout Obsidian
  com timeout adicional de limpeza). Etapas encadeadas apos Vitest nao rodaram.
- PR198 atualizado em d414e77; CI38328239216 na fila na consulta21:42.
  Registro final documental requer CI do novo SHA. Sem merge, restart CRM,
  proxy publico ao n8n ou ativacao de fluxos. Configuracao Codex conserva hash
  anterior; antigo DNS n8n permanece187.77.226.131. Owner/MCP/backup pendentes.

## 2026-10-12: Inicio de instancia n8n exclusiva

- Usuario confirmou preservar integralmente o n8n antigo e seguir com nova
  instancia; autorizou somente novo subdominio n8n-crm.descomplicapro.com.br
  e HTTPS. Nenhum workflow antigo, banco, volume ou conexao sera substituido.
- Fontes em 21:03 Brasilia: GitHub/main e health publico ok em 9ff3fd3,
  CI push/main 38302711569 aprovada; novo worktree parte desse SHA. PR #194
  documental continua aberto em 00ff6ac, separado desta implementacao.
- SSH observacional: nenhum container/volume n8n, porta5678 livre e destino
  /srv/descomplica-n8n ausente. DNS do novo nome ainda inexistente; NS Hostinger.
  Configuracao MCP antiga preservada, sem ferramentas n8n disponiveis no chat.
  Instalacao sera isolada, sem ativar workflows ou ingestao neste estagio.
- Releases oficiais conferidos: n8n 2.42.7 (GitHub, publicado 12/10/2026),
  runner 2.42.7 e PostgreSQL 17. Downloads de imagens concluidos sem iniciar
  containers. Configuracao antiga do Codex nao foi editada nem lida em claro.
- Painel Hostinger pelo navegador indisponivel por timeout; solicitado ao
  operador apenas registro A n8n-crm para 187.127.249.50. Sem DNS aplicado
  nesta etapa, nao emitir certificado nem expor setup administrativo publico.
- Aplicacao privada autorizada, 21:19-21:22 Brasilia: preparador executado apos
  testes focados e validacao Compose, hashes conferidos no transporte. Criados
  somente /srv/descomplica-n8n (root0700), .env/compose (root0600), projeto
  descomplica-n8n-crm e seus dois volumes/tres redes novos. N8n2.42.7 e Postgres
  saudaveis; runner iniciado (sem healthcheck proprio). Porta127.0.0.1:5678;
  healthz/readiness e pagina via tunel local retornam200. Nenhum workflow ativo.
- Configuracao global Codex comparada por SHA256 antes/depois: identica. Nao
  houve acesso mutante nem backup/exportacao do n8n antigo; nao afirmar backup
  validado dessa instancia. Health CRM permanece ok/9ff3fd3, browser/monitor
  Salesforce ativos. Sem restart do CRM ou alteracao de sua sessao.
- Novo n8n segue privado, sem conta proprietaria confirmada, DNS ou HTTPS.
  Tunel SSH local PID19368 aberto para cadastro pelo operador em localhost5678.
  Comando open_in_codex retornou queued; nao comprova tela visual aberta.
  Controle Chrome/Hostinger falhou por timeout; sem contornar protecoes.
- Validacao Node24.19/pnpm11.20: 37 testes novos aprovados; lint com aviso
  preexistente, tipos e build aprovados. Fixture de teste corrigida apos erro
  inicial de tipos. Suite Windows: 2559 aprovados,27 skips,9 falhas (seis de
  contratos POSIX/caminhos, dois timeouts Obsidian e um timeout reference-parity).
  Estagios encadeados apos Vitest nao executados. CI Linux38326592427 do
  SHA26e29e5: validate aprovado; isolated-restore/release-gates em andamento.
  PR198 publicado, nao integrado. Registro final documental exige CI do novo SHA.
- Limite: instalacao privada inicial nao e liberacao de automacao em producao.
  Gates completos, owner, DNS/HTTPS, MCP e backup/restore sao pendencias antes
  de carga comercial. Rollback limitado a parar este projeto sem excluir volumes.
  Nao alterar n8n antigo, conectar Supabase nem ativar agenda ate essas provas.

## 2026-10-13: Rotina compartilhada publicada

- PR #200 integrado em 7c50f59b61be3c07b2540f517f01660fce3728e3.
  CI main 38340719697: validate, release-gates, isolated-restore e imagem
  aprovados. SQL: 1242 casos totais, 91 novos. QA de navegador e matriz visual
  aprovados, incluindo persistencia entre sessoes isoladas. PR #199 substituido.
- Migration autorizada aplicada via MCP somente no projeto hnncxuerlcsaahdxoswb:
  arquivo 20261013014310_crm_shared_routines.sql registrado remotamente como
  20261013035612/crm_shared_routines (timestamp gerado pelo conector).
  Nao reaplicar pelo timestamp local. SHA-256 do arquivo local Windows:
  c223e5fe38fe9ad7caf49c1f2442e22deb6cb4e26427c3ac8a166211e8ffd63a.
- Antes do DDL: tabela/RPCs ausentes e nenhum app_pages afetado, reconfirmados
  as 03:56:03 UTC. Snapshot dos objetos afetados (nao dump completo) em
  /var/backups/descomplica-crm/routine-20261013/database-before.json,
  modo 0600/root, hash ec87bf0b709c821dcde58336a19adccd15b3dea73e6e3cbb6dab7fca6f2a1bfd.
  Nenhum dado de cliente exportado ou alterado.
- Pos-DDL: RLS ligada/forcada, gate MFA restritivo, zero grants diretos para
  anon/authenticated/service_role; somente authenticated executa RPCs, que
  verificam permissao. Fonte: consultas MCP observacionais de 03:56:26 UTC.
- Deploy pelo coordenador com consulta no minuto e CAS: bf212f6d-32ae-450c-868f-5ce080359fe9,
  2026-10-13T03:57:09.142Z (00:57:09 Sao Paulo), sem pendencia.
  Imagem sha256:68667bf3adb837ca641dc36e161a392acd001297eb89b556e29e55d94e361dcf;
  configuracao CI sha256:eb7460ed99b5c74d1837f658deebd38eb5ce21c74a5ba97a8f477f0cf26f2448.
  Checksum, manifesto, 11 camadas e dois perfis verificados; sem build na VPS.
- Backup runtime verificado: /var/backups/descomplica-crm/releases/7c50f59b61be3c07b2540f517f01660fce3728e3.7YE3XX,
  manifest 6a14ff6c42949ea0c0913e52a28070927d202675eaecad7f6cbfb441727d69b4.
  Rollback anterior 1160a0e preserva tabela e dados novos; nao desfazer DDL.
- Health SHA exato, container healthy/zero reinicios/sem OOM, inventario anonimo
  401 e Gestao/Rotina anonimas 307. Browser autenticado confirmou novo cabecalho,
  salvamento e recarga. Rotina house aprovada salva pela interface: revisao 1,
  26 linhas, 2026-10-13T03:58:16.181953Z; metadados conferidos via MCP.
  Demais funcoes continuam vazias; nenhuma fixture inserida em producao.
- Limites: nao houve teste manual com conta de terceiro em producao; matriz
  automatizada e pgTAP cobrem leitores/gestores. Legado local nao e enviado
  automaticamente: usar importacao explicita no navegador que contem a copia.
- Excecao de CI: fonte Prefeitura retornou 403 transitorio na primeira tentativa
  de 38336892318; nova execucao passou sem mudar checker, URL ou regras.
  Reavaliar se recorrente. Registro documental posterior nao requer redeploy.

## 2026-10-12: Persistencia compartilhada da Rotina em preparacao

- Retomada: origin/main e health publico confirmam 1160a0e, status ok.
  Branch codex/rotina-compartilhada preserva os registros documentais de #199.
- Pedido confirmado: dados compartilhados entre computadores/usuarios;
  somente administradores e gestores autorizados editam. Leitores sem escrita.
- Plano: RPC autenticada, revisao por funcao para impedir sobrescrita concorrente,
  importacao explicita de legado local e cabecalho com contraste distinto.
  Nenhum dado local deve substituir silenciosamente a versao compartilhada.
- Mudanca de banco sera aditiva e testada com pgTAP antes de qualquer aplicacao.
  Producao ainda mantem salvamento local nesta conferencia.
- Usuario autorizou explicitamente a migration aditiva da Rotina e publicacao,
  condicionadas a testes e backup. Projeto confirmado pelo runtime:
  hnncxuerlcsaahdxoswb, descomplica-crm-production; nao usar o banco self-hosted.
- Implementacao: RPCs sem acesso direto a tabela, RLS forcada, CAS por funcao,
  limite UTF-16 consistente e importacao apenas de papeis locais validos.
  Revisao focal de seguranca sem achados residuais nesses caminhos.
- Validacao local Windows/Node 24.19.0/pnpm 11.20.0: 70 testes focais de
  API/interface aprovados, incluindo Chromium; 30 de inventario/hub aprovados.
  Lint, tipos, formatacao e build aprovados. Suite geral: 2567 passaram, 43 ignorados e seis
  falhas POSIX conhecidas em quatro arquivos; nao equivalem a CI aprovada.
  Causa: modos/ownership Unix indisponiveis neste host; escopo exclusivo dos
  testes de backup, retirement, manifesto comercial e mapping import.
  Reavaliar no Linux do mesmo SHA, sem enfraquecer assertions.
- pgTAP novo tem 91 casos; restore passa a esperar 1242 no total.
  Execucao SQL, QA autenticado completo e gates de CI ainda pendentes.
- PR #200, CI 38335624699: validate Linux aprovado; banco/restore reprovaram
  fixture com escopos de equipe repetidos e inventario/gate MFA da nova tabela.
  Corrigidos escopo unico por alvo, limpeza de claims administrativos, policy
  restritiva padrao e allowlists de tabela/RPC. Sem remover assertions.
  Nova execucao SQL obrigatoria antes de migration; producao inalterada.

## 2026-10-12: Rolagem da Rotina publicada e verificada

- Fonte: PR #197 e CI main 38328297524, quatro jobs aprovados, SHA exato
  1160a0e92d734414f267249b63f56d70325fc529. Publicacao pelo coordenador
  release:production, com consulta no minuto, CAS, travas e sem rebuild.
- Deployment 519064c7-2816-4cb6-88a3-ed3100bd5489, concluido em
  2026-10-13T01:21:12.886Z (12/10/2026 22:21:12 America/Sao_Paulo).
  Anterior 9ff3fd3 preservado; nenhuma pendencia no ledger.
- Imagem sha256:92857837d0e5076b607865651194a78dd4d591c30d2f2e8d28ac67eb69edd97a;
  configuracao CI sha256:840f99b1dd7c323301d3711526b579eee41abc11acdce6b6f4adf42bc659483e.
  Checksum, manifesto, 11 camadas e dois perfis de runtime verificados.
- Backup privado verificado em
  /var/backups/descomplica-crm/releases/1160a0e92d734414f267249b63f56d70325fc529.GwoIvt;
  manifest SHA-256 90dde07278e50c6a6a25ee75211a74756baa07a956f4b2d43bbb61760eecec54.
- Pos-publicacao: health publico com SHA exato, container healthy, zero
  reinicios e sem OOM. Inventario anonimo 401; Gestao/Rotina anonimas 307.
- Smoke autenticado somente leitura em /app/gestao/rotina: 156 campos,
  74 preenchidos, Hoje com 24 atividades alinhadas a esquerda; h1 32px/400.
  Regiao sem overflow vertical, max-height none. Com window.scrollY 472,
  menu bottom 58px e cabecalho top 58px; titulo/abas/toolbar fora da viewport,
  scrollTop interno zero. Capturas locais ignoradas em test-results/routine-preview:
  rotina-rolagem-publicada.jpg e rotina-cabecalho-publicado.jpg.
- Nenhum Salvar/Inserir/Reset executado em producao. Persistencia permanece
  local ao navegador; nenhuma alteracao em Associativo, dados ou financeiro.
  Limites Windows e validacao Linux registrados abaixo, sem relaxar gates.
- Este encerramento e documental: nao requer novo deploy ou restart.

## 2026-10-12: Rolagem de pagina aprovada e integrada

- PR #197 aprovado na CI 38325392795 (validate, restore e release-gates),
  integrado em 1160a0e92d734414f267249b63f56d70325fc529. PR #196 encerrado
  como substituido com todos os registros preservados.
- Node 24.19.0/pnpm 11.20.0 local: lint, typecheck e build aprovados.
  Chromium 23/23. Suite Windows: 2522 aprovados, 28 skips, seis falhas POSIX
  e tres timeouts de Obsidian. CI Linux integral aprovada, sem alterar gates.
- Menu e cabecalho real verificados por geometria, inclusive fim de tabela;
  titulo/abas/toolbar saem da viewport. Sem mudanca em Associativo ou dados.
  Integracao nao e publicacao: aguardar CI main e promocao protegida.

## 2026-10-12: Ajuste solicitado de rolagem e referencia Associativo

- Abertura: GitHub main e health publico conferidos em 9ff3fd3, site ok.
  PR documental #196 ainda aberto, validate/restore aprovados e release-gates
  em andamento. Registros preservados nesta branch derivada.
- Novo escopo: Hoje alinhado a esquerda, titulo/botao conforme Associativo,
  rolagem vertical da pagina e somente cabecalho dos dias fixo abaixo do menu.
  Titulo principal, abas e toolbar da funcao devem rolar normalmente.
  Associativo permanece referencia somente leitura.
- Retomada apos interrupcao do runtime: sessao local de validacao nao existe
  mais e logs finais nao foram criados. Nenhuma aprovacao presumida; repetir
  os checks. GitHub main e health continuam 9ff3fd3/ok; edicoes preservadas.
- Chromium isolado atualizado: 23/23 aprovados. Exercita scroll da janela,
  ausencia de overflow vertical interno, limite inferior da tabela, alinhamento
  horizontal do cabecalho real, menu acima da tabela, titulo/abas/toolbar fora
  da viewport, Hoje a esquerda e animacao do salvar com reduced-motion.
  Capturas sinteticas inspecionadas; CI autenticada ainda necessaria.

## 2026-10-12: Rotina compacta publicada e conferida

- CI main 38302711569 aprovada nos quatro jobs: validate, release-gates,
  isolated-restore e promotable-image. SHA publicado:
  9ff3fd3fe175cc5b5b36babe0fb8815c53a8a14d. Sem rebuild na VPS.
- Artefato verificado por checksum, configuracao, manifesto OCI e 11 camadas.
  Config CI: sha256:ffe0d989b2a9aa15c6a317f43e3a63d2378bb707a5b6cb3b786cb8b2979720fa.
  Imagem Docker: sha256:547a5c7b2dce3b08480d81f526ad6b2adb940b485816dae613d39e53a7650782.
  Dois perfis de runtime aprovados sobre a mesma imagem.
- Coordenador release:production concluiu com CAS/travas e consulta atual de
  main/CI/health. Deployment 192fefa4-28bc-4421-9621-3bc77cdad8ca,
  2026-10-12T21:47:17.004Z (18:47:17 America/Sao_Paulo), sem pendencia.
  Anterior 1dd58c46e53281943ea68378efc4e8b3473c395c preservado.
- Backup privado verificado em
  /var/backups/descomplica-crm/releases/9ff3fd3fe175cc5b5b36babe0fb8815c53a8a14d.ky1ARs;
  manifest SHA-256 9925f26c158432266c082073a7a43d4e3c809699a972b376105b31a7fcc5bb08.
  Nenhum segredo registrado no Git ou exportado.
- Pos-publicacao: health ok/SHA exato; container healthy, sem OOM e zero
  reinicios. Inventario anonimo 401; Gestao e Rotina anonimas 307.
- Smoke autenticado observacional: titulo novo, seis dias, 26 linhas,
  156 campos habilitados e 74 atividades. Hoje exibiu 24 atividades de
  segunda-feira. Titulo e cabecalho mantiveram top 180.0625px/216px apos
  rolagem ate as ultimas linhas. Captura local ignorada:
  test-results/routine-preview/rotina-publicada.jpg. Sem editar/salvar dados.
- Limite preservado: salvamento local ao navegador, nao compartilhado.
  Este fechamento documental nao exige novo restart da aplicacao.

## 2026-10-12: Cancelamento corrigido e release da Rotina em validacao

- CI 38289033322 reproduziu o cliente fechando antes do cancelamento no
  servidor; diagnostico fixo do teste confirmou a ordem. Espera limitada
  pelo abort preserva a assercao e reabertura, acrescentando backend sem
  conexoes. Revisao independente sem achados; runtime nao foi alterado.
- Linux: 2531 testes Vitest, 137 Salesforce e 94 de release aprovados.
  Primeira tentativa parou depois por HTTP 403 da fonte Prefeitura; segunda
  passou todos os gates, sem dispensar a consulta. PR #195 integrado em
  9ff3fd3fe175cc5b5b36babe0fb8815c53a8a14d; CI main 38302711569 iniciada.
- Local Windows: lint e typecheck aprovados (um warning herdado), build 49
  rotas aprovado, gateway 36/36. Suite global: 2525 aprovados, 27 skips e
  seis falhas de modos POSIX preexistentes. Linux segue autoridade do release.
- Retomada apos espera longa: main ainda era 5bf6213 e health ok/1dd58c4
  antes do merge. Checkout limpo de 9ff3fd3 preparado na VPS; sem deploy
  ate esta nota. Versao publicada continua distinta da integrada.

## 2026-10-12: Retomada da publicacao da Rotina

- Conferencia de abertura: GitHub main permanece 5bf6213; GET publico
  /api/health retorna ok/1dd58c4. CI main 38285832880 segue falha na segunda
  tentativa; PR documental #195 tambem falhou em validate (38287348337).
  Checkout limpo em codex/rotina-compacta-evidencias antes desta nota.
- Investigar a ordem de fechamento/cancelamento do gateway antes de editar.
  Publicacao continua condicionada a todos os gates, imagem imutavel e CAS.

## 2026-10-12: Rotina integrada; publicacao bloqueada pela CI de main

- PR #192 integrado em main 5bf62134b1a7290f042cd68e29019aa69bc9ac64.
  CI do PR 38282502810 aprovada em validate, release-gates e isolated-restore.
  Artefato visual 11763311230 confirma 30 combinacoes da Rotina e 26 linhas;
  capturas de Semana desktop e Hoje mobile inspecionadas. Suite Chromium
  isolada: 22/22. Build atualizado: 49 rotas; lint e typecheck aprovados.
- CI de main 38285832880 falhou duas vezes no teste existente
  ops/salesforce/console-gateway.node-test.mjs:377, bounded auth timeout
  releases a pending reservation: signal.aborted era false ao encerrar o
  cliente. Jobs 114933859265 e 114936201184. Teste isolado local passou;
  isso nao invalida a falha Linux nem comprova sua causa. Ha timers de socket
  e autorizacao concorrentes, mas a causalidade exige investigacao especifica.
- Nenhum gate foi relaxado. Imagem promotable nao foi produzida e nao houve
  deploy desta entrega. Revisar o bloqueio somente apos corrigir/reproduzir o
  teste e aprovar todos os gates do SHA a publicar. PR #190 encerrado como
  substituido, com registros preservados no #192.
- Conferencia final via GitHub e GET /api/health em 12/10/2026: main 5bf6213,
  site saudavel em 1dd58c46e53281943ea68378efc4e8b3473c395c (publicacao
  externa a esta tarefa). Nao confundir versao integrada com publicada.
  Edicoes da Rotina continuam locais ao navegador, sem persistencia compartilhada.
- Suite Windows final: 2523 aprovados, 27 skips, seis falhas POSIX e dois
  timeouts de project-devtools; repeticao isolada deste ultimo passou 24/24.
  CI Linux aprovada do PR permanece a evidencia integral anterior ao merge.

## 2026-10-12: Integracao final da Rotina com main atualizado

- Main avancou para 1dd58c4 (PR #193) durante a tarefa. Conflitos restritos
  a WORKLOG, CHANGELOG e este historico foram resolvidos preservando ambos
  os conteudos; nenhuma edicao no trabalho Salesforce. Health observado
  continuava ok/83592ab. Build local atualizado passou com 49 rotas.
- Lint passou com um warning herdado em scripts/qa/connected-systems.mjs:18.
  CI 38281759395 bloqueou formatacao dos tres documentos mesclados; aplicar
  Prettier sem mudar conteudo e repetir gates, sem publicar antes da aprovacao.

## 2026-10-12: Abertura da Rotina semanal e diaria compacta

- Fontes atuais: git fetch origin, GitHub PR #190 e GET publico
  https://crm.descomplicapro.com.br/api/health. Main caac544 integra #189;
  producao saudavel permanece em 83592ab. PR documental #190 tem CI aprovada,
  mas conflito documental com main; ambos os historicos foram preservados
  nesta branch codex/rotina-semana-hoje, sem alterar outro checkout.
- Escopo solicitado: centralizacao, seis dias visiveis, modos Semana/Hoje,
  cabecalho fixo e remocao de rotulos redundantes. Preservar armazenamento,
  dados antigos de domingo e protecao de alteracoes nao salvas.
- Consulta inicial e sincronizacao nao comprovam implementacao nem deploy.
- Implementacao local: seis dias visiveis, modos Semana/Hoje, centralizacao,
  cabecalho fixo no scroll e foco na linha inserida. Domingo legado permanece
  no armazenamento local. Nao ha nova persistencia compartilhada no servidor.
- Validacao Windows Node 24.19.0/pnpm 11.20.0: lint, typecheck, build das 47
  rotas, resources:check e nove testes de breadcrumbs aprovados. pnpm test:
  2469 aprovados, 25 skips e seis falhas POSIX em quatro arquivos (backup e
  retirada canario, commercial-engine e mapping-import). Nenhum skip novo
  para contornar esses erros; CI Linux continua obrigatoria.
- Capturas sinteticas Semana/Hoje e rolagem em desktop/mobile inspecionadas;
  a pagina autenticada e a publicacao dependem dos gates seguintes.
- Suite Chromium isolada concluida: 19/19 aprovados. Revisao detectou linha
  preenchida somente no domingo legado aparecendo vazia em Hoje; filtro
  corrigido para preservar o dado e omitir a linha nessa visao. Cobertura
  verifica virada Sao Paulo, geometria sticky, foco, persistencia e navegacao.
- Revisao independente reproduziu foco branco sobre fundo claro no modo Hoje.
  Correcao usa o accent do tema somente nessa visao; Semana conserva branco
  sobre a coluna destacada. Teste de regressao de foco nos tres temas exigido.
- CI 38267645863: validate e restore aprovados; matriz autenticada falhou
  em Rotina 720/claro depois da captura semanal. Artefato 11756600780 nao
  inclui a assercao original (diagnostico sanitizado). Reproducao Chromium
  com CSS compilado/Geist passou sticky e Axe; sem shell completo e sem a
  sequencia anterior da CI, nao comprova causa. Instrumentacao adiciona
  somente etapas fixas/geometria/IDs Axe e espera transicoes antes do Axe
  diario. Mesmas assercoes e tolerancias; publicacao bloqueada ate CI verde.
- CI instrumentada 38271094364 delimitou a falha em daily-layout-720-light:
  sticky vertical/horizontal passou (0px na barra, -0,1875px no cabecalho).
  A falha precede o Axe diario. Medicao de largura agora registra valores
  inicial/final e aguarda a mesma condicao sem overflow por expect.poll,
  mantendo tolerancia de 1px. Causa de eventual largura transitoria ainda
  nao comprovada; uma nova CI aprovada e necessaria.
- Evidencia 38273867131/artefato 11759768049: Rotina aprovada nas 30
  combinacoes. Log mostra 960px inicial -> 694px estavel em 17ms ao trocar
  para Hoje. Todos os checks gerais de rotas, temas, Axe, zoom e comparacao
  visual passaram; bloqueio final foi tabelaoValidation.groupedProjects,
  que agrega sticky/layout, nao apenas ordenacao. Log confirmou sticky:false
  somente em 1440px. Repeticao do job interrompida para corrigir isolamento.
- Revisao Chromium reproduziu que setSystemTime restaura Date avancando mas
  nao remove requestAnimationFrame/setTimeout simulados do contexto. Esse
  vazamento e confirmado; sua causalidade sobre o sticky especifico nao.
  Rotina agora usa contexto proprio com login sintetico e fechamento finally,
  sem exportar storageState nem alterar Tabelao/Associativo. Nova CI integral
  obrigatoria; nenhum gate enfraquecido e nenhuma publicacao realizada.
- Suite local final 22/22 passou. Teste de estilos dividido por tema apos
  timeout de 5s ao reunir seis capturas e tres focos; limites e assercoes
  preservados. Lint focal e typecheck aprovados. Revisao confirmou que Rotina
  nao depende da fixture de estoque do contexto principal.

## 2026-10-12: Planilha de Rotina publicada e conferida

- Status final: publicada a versao `83592abf431ad357f0649209c03b08fc4039472b`.
  Este registro sucede os estados pendentes abaixo, mantidos como historico.
  Fontes: PR #188, CI `38250580690` tentativa 2, recibo do coordenador,
  Docker, health publico e navegador autenticado consultado apenas em leitura.
- Os quatro jobs da CI passaram. A repeticao isolada resolveu a falha de
  preparacao do pnpm sem alterar codigo, versoes ou gates. Artefato visual
  `11748444223` confirma o SHA final e a Rotina aprovada em 15 combinacoes.
- Imagem CI `11746764327`, SHA-256 do arquivo comprimido
  `610258d148e30c716b90a6cc8a53c51674bf088f743bc74e9e60be9236b2ec14`.
  Configuracao/ID da CI:
  `sha256:bce888c6dcf2e4f7f1a9652d2d6dbd27832b666faa6f7ddd595245c765ef0166`.
  Manifesto OCI/ID Docker de destino:
  `sha256:a1a74432612b3fa18a335cdd59a52781046fe19d02ebfbdbe428e7db539879eb`.
  Cadeia criptografica de 11 camadas e dois perfis de runtime comprovados;
  nenhuma recompilacao na VPS.
- Backup privado verificado em
  `/var/backups/descomplica-crm/releases/83592abf431ad357f0649209c03b08fc4039472b.BUEwDm`;
  hash do manifesto
  `893abcbc51b1f835ca92b1e60d872337acde832caff964a08337d8a85999b599`.
- Promocao pelo coordenador concluida em `2026-10-12T13:19:10.060Z`
  (10:19:10.060, America/Sao_Paulo), deployment ID
  `48a08b2c-d4fe-4331-a710-5fdcb46f6d4c`, sem pendencia. Versao anterior
  `7c6dce5` preservada. Travas, consulta atual de main/CI, CAS e health mantidos.
- Excecao do helper externo: encerrou com exit 1 APOS o recibo de sucesso,
  porque a verificacao Docker imediata ainda encontrou `starting false 0`.
  A releitura confirmou `healthy false 0`, sem OOM, reinicio ou pendencia.
  Demais verificacoes foram executadas separadamente: health na versao nova,
  inventory anonimo 401 e rotas de Gestao/Rotina 307. Nao houve nova promocao
  nem recuperacao desnecessaria de uma publicacao ja concluida. Esse diagnostico
  vale para esta execucao; nao prova a causa do helper antigo de `7c6dce5`.
- Smoke autenticado: seis funcoes, 26 linhas, 74 atividades, Salvar habilitado,
  segunda-feira marcada Hoje e todos os editores transparentes, sem borda
  arredondada ou texto recortado. Inspecao visual da grade publicada concluida.
  Nenhuma edicao, insercao ou salvamento realizado no navegador de producao.
- Limites preservados: salvamento local ao navegador; referencia externa
  inalterada; nenhuma migration, dado de cliente, conta ou regra financeira.
  Fechamento documental publicado no Git e sincronizado ao Obsidian sem
  reiniciar a aplicacao novamente.

## 2026-10-12: Grade de Rotina integrada e validada

- PR #188 integrado em `83592abf431ad357f0649209c03b08fc4039472b`.
  CI do candidato `38246693168` aprovada; artefato `11747187938`, capturado
  no merge sintetico `44d323ecfbc8cac738da1862e82691eb179c9d05` em
  `2026-10-12T12:39:21Z`. Nao confundir SHA de captura, head do PR e main.
- Evidencia: authenticated-visual/routine-results.json confirma 26 linhas,
  edicao, insercao, persistencia, teclado e restauracao. Quinze combinacoes
  de largura/tema, sem overflow ou violacoes de acessibilidade. Capturas
  claro/escuro desktop e medio mobile inspecionadas; grade continua e coluna
  Hoje preservam texto completo. Dados de QA exclusivamente sinteticos.
- Repeticao isolada dos timeouts Windows: Obsidian e DevTools, 46 testes
  aprovados. Os seis erros restantes da suite local sao restricoes POSIX;
  a suite integral Linux da CI passou sem afrouxar permissoes ou assertions.
- Revisao independente do diff nao encontrou bug confirmado. Teste de
  virada do dia exige ROUTINE_SETTINGS_BROWSER=1 e foi executado localmente;
  pnpm test padrao nao habilita esse grupo. Matriz autenticada cobre a grade.
- Falha antiga em Integrações nao foi reproduzida: harness sintetico terminou
  com exit 0, nove combinacoes e seis estados aprovados. Corrida de transicao
  continua hipotese, nao causa confirmada. A nova CI completa passou tambem
  nessa area, sem alteracao no codigo de Integrações.
- CI de main `38250580690` em andamento. Runtime ainda em `7c6dce5`;
  checkout limpo preparado na VPS, sem troca de imagem ou restart ate aqui.
- Excecao observada no job `114816701144`: Enable pnpm falhou antes das
  dependencias/testes, em `2026-10-12T12:44:39Z`, com ERR_ASSERTION
  `assert(!this.paused)` em `Parser.finish`/Undici do Node 24.19.0. Nao e uma
  falha comprovada da restauracao, pois ela nao chegou a executar. Repeticao
  do job enquanto a execucao global ainda estava ativa foi recusada pelo
  GitHub. Aguardar conclusao e repetir apenas o job falho, sem alterar gates.

## 2026-10-12: Primeiro gate do PR #193

- Evidencia 38273862007/job114896148359: status do console medido em #6d7886
  sobre branco (4.48), enquanto o token final e #68727f. A espera por uma leva
  de animation.finished nao cobriu novas transicoes herdadas. QA passa a
  consultar estilos e aguardar zero CSSTransition pendentes em toda a arvore.
  Contraste minimo 4.5 preservado; produto e cores nao foram alterados.
- Repeticao 38272615268: fonte Prefeitura retornou 403 transitorio, sem
  dispensar a consulta; reexecucao aprovada. Job validate verde. Release-gates
  114892885508 falhou antes do console, Axe dark/320 na pagina base. A mesma
  espera por transicoes foi estendida a ambas as matrizes, sem excluir regras.
- Fonte: GitHub Actions 38271515539, job validate aprovado e release-gates
  114888030823 reprovado em Console axe light/320, color-contrast, 15:41Z.
- A repeticao local completa passou. O teste trocava dark -> light e aguardava
  100ms no relogio simulado, enquanto globals.css aplica transicoes de 160ms
  no compositor. QA agora aguarda animation.finished e inclui nos erros o
  elemento e failureSummary; nenhuma regra axe foi excluida.
- Confirmacao definitiva depende da repeticao Linux. Producao nao alterada;
  pareamento, gateway, Nginx e login continuam pendentes dos gates.

## 2026-10-12: Candidato do console integrado Salesforce

- Fonte: branch codex/salesforce-console-integrado, base main caac544,
  revisao independente e testes sinteticos locais em Node 24.19.0/pnpm 11.20.0.
- Implementado noVNC dentro do CRM, bootstrap exclusivo Master e WSS na
  origem existente, bridge 127.0.0.1:6081 -> 5909, uma sessao por vez e dez
  minutos de acesso. Login/MFA continuam na pagina real da VPS; nao ha senha
  Salesforce em API/formulario proprio, Git, n8n ou Supabase.
- Sonda de autorizacao revalida identidade, sessao viva, MFA e permissao a
  cada 30s. Correcao da revisao: nao renovar cookies congelados no gateway.
  A rota da sonda dispensa refresh do proxy e bloqueia /auth/v1/token antes
  da rede no SDK. Expiracao fecha a tela; bootstrap normal renova no browser.
  Fonte: SDK instalado e supabase.com/docs/guides/auth/sessions, 12/10/2026.
- Instalador confere seis units; gateway opt-in por --with-console-gateway,
  ambiente privado e boot habilitado apenas na operacao autorizada. Revisao
  corrigiu a antiga allowlist de cinco units. Nenhum servico remoto alterado
  ainda por este candidato; Chrome/VNC existentes ativos, monitor inativo.
- Aprovados: typecheck, build (49 rotas), 66 testes focados de auth/API/SDK,
  41 testes Node de gateway/instalacao, audit sem vulnerabilidade conhecida e
  resources:check. Matriz visual usa RFB sintetico e noVNC real, nao Salesforce.
- pnpm test no Windows: 2503 testes aprovados, 22 skips e 11 falhas em seis
  arquivos (modos POSIX e timeouts DevTools/Obsidian). Suite Node completa:
  126/137 passaram; restricoes de arquivos/ACL e timeout de exportacao em
  fixtures. Um teste novo de cancelamento dependia da chegada ao servidor
  antes do timeout; corrigido para comprovar ClientRequest destruido e
  repeticao focada aprovada. Nenhum skip/timeout de producao foi relaxado.
- Gitleaks apontou nonce publico RFC em teste, nao segredo. Fixture agora
  gera os bytes sinteticos; repeticao redigida sem achados. Lint aprovado
  com um warning em helper output nao versionado. Evidencia
  definitiva da suite POSIX depende da CI Linux, sem dispensa dos gates.
- Pendente: PR/CI, imagem imutavel, pareamento privado, gateway/Nginx,
  promocao pelo coordenador e login/MFA do operador. Health 15:19Z continua
  ok/83592ab. N8n, exportacao, agenda e escritas comerciais continuam fora.

## 2026-10-12: Abertura da integracao do console Salesforce

- Fonte: origin/main caac544, CI 38258310602 com quatro jobs aprovados,
  PR #191 documental aberto e health publico em 2026-10-12T15:04:32Z.
- Runtime publicado continua ok/83592ab; nao confundir main, checkout e site.
  Nova branch codex/salesforce-console-integrado parte de main. Checkout
  primario e output local alheio preservados.
- Escopo solicitado: conectar pelo proprio CRM ao navegador persistente da
  VPS; login/MFA feitos pelo operador, prova real pelo monitor. N8n, agenda
  de exportacao e escrita Supabase continuam fora desta etapa.
- Modelo em implementacao: console restrito a Master e permissao de
  configuracoes, HTTPS/WSS, bridge apenas loopback e revalidacao da sessao CRM.
  Nenhuma senha Salesforce sera coletada em formulario proprio ou persistida
  pelo CRM. Producao so apos testes, PR/CI, imagem, backup e coordenador.

## 2026-10-12: Candidato de sessao remota Salesforce

- Fonte: branch codex/salesforce-vps-session, inspecao SSH observacional da VPS,
  scripts em ops/salesforce/vps e testes sinteticos do supervisor.
- VPS Ubuntu 24.04/systemd 255, Node 24.19.0 e pnpm 11.20.0 confirmados.
  Dependencias oficiais instaladas; Chrome 155.0.8059.39. Keyring conferido:
  somente a chave primaria Google aprovada e suas subchaves. Nenhum servico
  existente reiniciado; health permanece ok/7c6dce5.
- Implementado supervisor opt-in, instalador de primeira instancia, usuario
  sem shell, perfil privado, VNC com senha e console apenas loopback/SSH.
  Instalador recusa unidade extra, compara unidades com o SHA e verifica
  runtime absoluto. Revisao corrigiu esses pontos e rejeicao de chave extra.
- Validacao: lint, typecheck, build (47 rotas), resources:check, formatacao,
  bash -n e systemd-analyze verify das unidades renderizadas aprovados.
  Gitleaks do diretorio Salesforce: nenhum achado. Treze testes novos do
  supervisor e quatro de contrato VPS passaram.
- Windows: Vitest 2465 aprovados, 22 skips, oito falhas (seis POSIX, dois
  timeouts). Repeticao isolada: DevTools passou; Obsidian preservou um timeout
  de 30s, 45/46 aprovados. Node Salesforce: 92/100 aprovados, oito falhas
  preexistentes de modos/caminhos Windows. Nenhuma assercao reduzida.
- Excecao local: build concorrente produziu lock; repeticao isolada passou.
  CI Linux do candidato continua obrigatoria; resultados Windows nao a
  substituem. Reavaliar falhas no SHA aprovado em Linux.
- Pendencias: PR/CI, instalacao/ativacao dos servicos, login/MFA do operador,
  pareamento privado do status e aplicacao pelo coordenador de release.
  Nao houve exportacao real, alteracao n8n ou escrita Supabase.

## 2026-10-12: Abertura da sessao Salesforce na VPS

- Fontes observacionais: git fetch origin main, GitHub PRs #173/#178 e CI
  37777133589, docs de main e GET publico /api/health em 12/10/2026.
- Checkout primario preservado em bc6c0ab, com configuracao local alheia.
  Worktree reutilizado em codex/salesforce-vps-session, base main 83592ab.
  Producao responde status ok, versao 7c6dce5; nao confundir com main/local.
- PR #173 integrado em 683948f com CI aprovada no head baa2833; PR #178
  integrado em ac3d789. Esses resultados nao aprovam alteracoes novas.
- Escopo atual solicitado: sessao dedicada na VPS Hostinger, login e MFA
  manuais pelo operador. N8n, exportacao e escrita de snapshots ficam para
  etapa posterior. Ainda nao houve provisionamento nem prova de conexao.
- Pendencias: inspecao da VPS, acesso grafico privado, supervisao e pareamento
  do monitor. Expiracao/revogacao Salesforce continuam exigindo o operador;
  nenhuma promessa de sessao permanente nem transferencia de perfil pessoal.

## 2026-10-12: Planilha de Rotina implementada, aguardando CI

- Fonte visual: navegador Chrome, consulta somente leitura a
  https://descomplicapro.com.br/configuracoes/metas/parcerias. Estilos computados
  confirmaram Geist, superficie #0e2135, grade #29435b e destaque em gradiente
  #176f8a/#123b63 com bordas #62d8ff. Nenhum ajuste na referencia externa.
- Implementacao restrita a Gestao > Rotina: celulas continuas, sem caixas
  individuais, texto integral com autoaltura e dia atual em America/Sao_Paulo.
  Selo Hoje e aria-current indicam o destaque tambem sem depender apenas da cor.
  Conteudo, abas, salvar local, inserir e protecao de alteracoes preservados.
- Evidencias locais: lint, typecheck, build e resources:check aprovados.
  Chromium: 16 testes aprovados em repeticao isolada, incluindo sete dias,
  virada de meia-noite local, tres temas, mobile e desktop. Capturas em
  test-results/routine-preview, sem dados reais. Primeira execucao teve timeout
  ao fechar Chromium durante carga concorrente; segunda terminou normalmente.
- pnpm test no Windows: 2464 aprovados, 22 ignorados e nove falhas. Seis sao
  verificacoes POSIX de permissoes/ownership; tres sao timeouts em Obsidian e
  DevTools, com repeticao isolada em andamento. Linux CI continua obrigatoria;
  nenhum gate foi reduzido nem falha marcada artificialmente como sucesso.
- CI anterior 38221618183: artefato comprova falha na etapa connected-systems,
  enquanto Rotina passou em 15 combinacoes. Mensagem sanitizada nao preservou
  a assercao original; corrida durante transicao de tema e apenas hipotese.
- Limites: sem alteracao de backend/dados; salvamento permanece neste navegador.
  Novo layout ainda nao publicado. Integracao, CI e promocao pendentes.

## 2026-10-12: Abertura da revisao visual da Rotina

- Fonte: git fetch origin, GitHub CI `38221618183` e health publico consultados
  em `2026-10-12T11:46:19Z`. Main/local em `2a18956` (fechamento documental);
  site HTTP 200, status ok, versao publicada `7c6dce5`.
- CI de main documental aprovou validate, restore e imagem, mas falhou na
  matriz visual. Causa ainda nao apurada; nao reutilizar essa rodada como
  aprovacao de interface. A versao publicada conserva sua CI anterior aprovada.
- Novo pedido: Rotina com aparencia de planilha, celulas continuas e destaque
  do dia atual inspirado no segundo print. Conteudo, edicao, inserir e salvar
  devem permanecer. O site descomplicapro.com.br/configuracoes/metas/parcerias
  foi autorizado somente para consulta visual; nenhuma alteracao nesse destino.
- Status: conferencia inicial concluida, implementacao e novos testes pendentes.
  Consulta web da referencia sofreu timeout; navegador sera a alternativa de leitura.

## 2026-10-12: Rotina publicada e conhecimento sincronizado

- Status: integrado e publicado. Esta conclusao sucede os estados pendentes
  registrados abaixo, que permanecem como historico da investigacao.
- Fontes: PR #183, CI do candidato `38209790612`, CI de main `38213038968`
  (tentativa 2), recibo de release:production, inspect Docker, health publico e
  navegador autenticado em leitura. Conferencia final em
  `2026-10-12T07:31:16Z`: main e site em
  `7c6dce5c48b9e267586283a273866bf4f87aa6e3`, HTTP 200 e status ok.
- O coordenador publicou em `2026-10-12T07:22:13.239Z`
  (`04:22:13.239`, America/Sao_Paulo), deployment ID
  `8f267ba8-ea32-4d42-9314-dbbc4113e11b`, sem tentativa pendente.
  Imagem ativa: `sha256:5715bc8c7e9888cd44851b6b86d9d33b45f99f366e8e192dff13b4b029e5a01e`.
  Container saudavel, sem OOM e com zero reinicios na conferencia.
- CI aprovou validate, release-gates, isolated-restore e promotable-image no
  SHA exato. Artefato `11730695750`; SHA-256 do arquivo comprimido:
  `8bbaedf8c8202786fd3f577a9efb2105cd114aa87cd2e27fe07760452732a0f6`.
  Configuracao e manifest OCI diferem de identidade; a promocao verificou a
  cadeia de hashes e as 11 camadas, o ID carregado, label/plataforma e os dois
  perfis de runtime. Diferenca de ID isolada nao permite ignorar essa prova.
- Backup privado verificado, manifesto SHA-256
  `445cb091b85460361086fbd31051d7ba2eb308a9cca6bf3a96644b7485b2601b`.
  Versao anterior `f84867d`, deployment ID
  `1061530d-5dfc-4027-b943-5c18a43e0c93`, conclusao real
  `2026-10-12T03:26:50.036Z`. Nenhum rollback foi necessario ou executado.
- Checks anonimos: inventory HTTP 401; Gestao e Rotina HTTP 307. Navegador
  autenticado confirmou menu Gestao > Rotina, seis funcoes, 26 linhas e 74
  atividades, demais opcoes nulas, e ausencia de edicao pendente. Nenhum dado
  foi alterado durante o smoke. CI cobriu edicao/insercao/persistencia/teclado,
  15 combinacoes de tema/largura e 40 checks de navegacao sem falhas.
- Limite: Salvar grava apenas no navegador atual; nao ha persistencia
  compartilhada entre usuarios ou dispositivos. Nao houve migration, n8n,
  alteracao de contas, DNS, cobranca ou politica financeira nesta entrega.
- Excecao operacional: o helper externo retornou exit 1 depois do recibo
  deployed bem-sucedido. O predicado exato nao foi emitido, portanto a causa
  nao esta confirmada. Consultas posteriores de ledger, runtime, health,
  fronteira anonima e tela afetada passaram. Aplicar essa distincao somente
  com recibo concluido, pendencia nula e verificacao ao vivo; nao ignorar uma
  falha com pendencia ou runtime divergente. Reavaliar/logar cada predicado em
  eventual recorrencia, sem republicar a mesma imagem nem contornar o guard.
- HTTP 403 municipal da primeira tentativa de CI nao virou excecao de gate:
  o verificador original passou na tentativa 2. Falhas locais Windows POSIX,
  caminhos ESM e getuid permanecem documentadas; CI Linux passou sem reducao.
- Protocolo permanente de inicio/fim foi integrado no PR #183 e na orientacao
  local deste Git comum. Runtime/referencias do conhecimento foram atualizados
  no vault existente. O fechamento publica apenas evidencias documentais no
  Git e sincroniza Obsidian; um SHA documental posterior nao exige novo deploy.
  A melhora vem do contexto verificavel, nao de treinamento do modelo.

## 2026-10-12: Main pode avancar durante validacao e mudar o procedimento

- Fonte: git fetch/GitHub, PR #186, runbook production-release-guard e registro
  sanitizado da VPS. Status: integrado; nova CI e publicacao pendentes.
- O candidato `3bad94e` passou CI `38205980422`, com 40 checks de navegacao e
  15 combinacoes de Rotina. A conferencia anterior ao merge encontrou main
  `e162411`, que mudou o processo de publicacao. CI verde da base antiga nao
  dispensa integracao nem validacao do candidato combinado.
- Versao ativa permanece `f84867d`, com registro de conclusao real em
  `2026-10-12T03:26:50.036Z` e nenhuma tentativa pendente. Main recebeu tooling,
  nao runtime da aplicacao: essa divergencia de SHA nao exige restart por si so.
- Usar exclusivamente release:production da versao atual, sem bind/Compose
  antigos nem locks externos. O coordenador consulta registro, runtime e
  GitHub no mesmo minuto da escrita, preserva exclusao mutua e exige evidencia
  do historico. Registro ausente, data desconhecida, main/CI divergentes ou
  tentativa pendente bloqueiam; nunca inferir a data por commit ou container.
- Reavaliar o procedimento a cada publicacao e repetir a busca de fontes ao
  detectar mudanca externa. A observacao desta entrada nao substitui a consulta
  fresca executada dentro da trava no momento do deploy.

## 2026-10-12: ScrollWidth de painel pode incluir pintura na borda

- Fonte: CI `38203285914`, artefato `11726659106`, 32 medicoes compactas e
  captura 320 x 568. Status: correcao local validada; nova CI/publicacao pendentes.
- A versao `b38a184` aprovou validate, restore, banco/advisors, build, E2E e
  a QA propria da Rotina (15 combinacoes, edicao, persistencia, teclado e reset).
  A matriz terminou com 32 falhas na geometria nova dos menus compactos.
- clientWidth exclui bordas. O painel tinha caixa externa de 296 px,
  clientWidth 294 e scrollWidth 296, com pintura alinhada a caixa e sem
  overflow de nav/pagina ou recorte. O limite do painel agora usa sua caixa
  externa, mantendo 1 px de tolerancia. Controles, container e ancestrais
  seguem protegidos; conteudo alem da caixa continua sendo rejeitado.
- O gate corrigido passou nas 32 medicoes originais; 34 testes direcionados
  passaram com um skip previsto. Reavaliar esta excecao ao mudar bordas,
  box-sizing, overflow ou posicionamento do menu; nao generalizar para campos
  de formulario nem aceitar scroll extra sem causa geometrica comprovada.
- Captura evidenciou titulo Gestao em caixa alta herdada; o novo painel usa
  capitalizacao normal, conferida pelo estilo computado. Sem baseline promovida.

## 2026-10-12: Confirmacao de saida nao pode cancelar o commit React

- Fonte: revisao independente, `next/dist/client/components/app-router.js`,
  RoutineSettings e regressao em Chromium. Status: correcao local validada;
  novo candidato CI ainda pendente. Suite de navegador/servidor: 17/17.
- Uma aprovacao expirada apos um segundo permitia repetir o aviso em um
  history.pushState atrasado por 1,5 s. Recusar o segundo aviso impedia a URL
  de acompanhar a navegacao. A regressao falhou antes e passou apos a correcao.
- O HistoryUpdater do App Router atualiza pushState/replaceState durante
  useInsertionEffect; cancelar esse evento nao desfaz o render React. Proteger
  o gesto de saida antes desse commit e nunca cancelar push/replace
  same-document nesse listener. Reload/traverse e beforeunload mantem guards.
- A aprovacao acompanha o destino, encerra em sucesso/erro ou nova edicao e
  dispensa prazo arbitrario. Reavaliar ao mudar Next.js, navegacao do shell ou
  suporte da Navigation API. Essa excecao de fase de navegacao nao autoriza
  sair de uma edicao sem confirmacao nem enfraquecer a autorizacao do servidor.
- CI `38202252671` da versao anterior `dbc9e13` aprovou validate/restore na
  tentativa 2. O HTTP 403 municipal da tentativa 1 foi transitorio: verificador
  original passou localmente e depois na CI. Nao houve troca de politica,
  fonte, hash ou gate; aprovacao anterior nao valida o fix novo.

## 2026-10-12: Conferencia atual antes de retomar a demanda

- Fonte: `git fetch origin`, GitHub PR #183/CI `38184457031` e GET observacional
  de `https://crm.descomplicapro.com.br/api/health`, conferidos nesta data.
- GitHub main e site publicado convergem em
  `f84867d0729e5782a0d41a040bf078a4506e7685`; health retorna `status: ok`.
  Esse fato e um retrato da consulta, nao garantia sobre uma consulta futura.
- Rotina continua no PR #183, candidato `b08ba26`: validate e restore isolado
  aprovados; release-gates falhou na matriz de navegacao. Implementacao local
  nao deve ser apresentada como publicada. Integracao com main e fechamento
  dos comentarios de revisao ainda pendentes.
- O usuario determinou consultar site/GitHub e sincronizar o Obsidian antes
  de tratar cada novo chat, e registrar resultados e excecoes ao encerrar.
  A regra foi persistida nos documentos do projeto e na orientacao local
  limitada a este Git comum. Fontes indisponiveis exigem registro explicito;
  uma excecao documentada nao concede novas permissoes.
- Esta entrada registra consulta de fontes; nao comprova novos testes.

## 2026-10-12: Excecoes e protecao de edicoes precisam de evidencia propria

- Fonte: AGENTS.md, runbook de Obsidian, perfil crm-memoria e review do PR #183.
  Status: protocolo e correcoes implementados localmente; CI/publicacao pendentes.
- Atualizar conhecimento significa confrontar fontes atuais e reutilizar notas
  verificadas. Nao equivale a treinar o modelo ou validar uma versao publicada.
  Excecoes duraveis precisam de causa, evidencia, escopo/limites, quando aplicar
  e criterio de reavaliacao; nunca ampliam permissao ou regra comercial.
- Aviso de alteracoes pendentes sozinho nao evita perda por navegacao. Rotina
  usa confirmacao para links, Navigation API/historico e beforeunload, conforme
  o padrao da Tabela Direta; cancela a saida e preserva a edicao, e libera apos
  salvar. A API de navegacao requer tipos locais neste componente porque o
  contrato DOM da versao instalada nao fornece NavigateEvent.
- Um gate desligado precisa remover a ancora, nao apenas exibir aviso. O hub
  de Gestao conserva o cartao indisponivel sem href; o servidor continua negando
  a rota. Testes de servidor e Chromium: 16/16 aprovados; tipos e recursos
  aprovados. Lint, suite completa, build e nova CI ainda em verificacao.
- Fechamento local: lint, tipos, recursos e build de 47 rotas aprovados. Suite
  Windows: 2.462 aprovados, 19 skips previstos e 11 falhas (seis POSIX e cinco
  timeouts). Reteste isolado de conhecimento/DevTools: 46/46; referencia:
  15 aprovados e um skip. Nao alterar contratos POSIX para obter verde neste
  host; a CI Linux e a referencia e permanece gate obrigatorio.
  Testes Node do Salesforce foram executados separadamente e tambem falharam
  em contratos POSIX/arquivos privados e executavel deste host Windows.

## 2026-10-12: Menu flutuante nao equivale a overflow da pagina

- Fonte: CI `38184457031`, artefato `11719861187`, JSON de navegacao e reproducao
  em Chromium com CSS real. Status: causa confirmada e correcao local validada;
  matriz autenticada do candidato final ainda pendente.
- As quatro falhas ocorreram em 1181 x 800 nos quatro simuladores. O nav tinha
  clientWidth 654 e scrollWidth 668; o painel terminava em x=854, dentro dos
  1181 px da viewport. Documento/body nao excediam a largura e nao havia erro
  de runtime. A assercao isolada sobre scrollWidth do nav era insuficiente.
- Aplicar a excecao somente para a extensao medida de um painel flutuante no
  desktop. Exigir controles dentro do nav, painel dentro da viewport, texto
  sem overflow e ancestrais sem recorte; mobile continua limitado ao container.
  Tolerancia permanece 1 px. Dezenove regressoes passaram; nao houve promocao
  de baseline. Reavaliar quando mudar o posicionamento, o breakpoint ou o CSS
  de overflow do cabecalho. Esta regra e de geometria QA, nao autorizacao.

## 2026-10-11: Menu Gestao e submenu Rotina

- Fonte: pedido do usuario, print do menu principal e planilha `TESTE1.xlsx`
  tratada somente como dado. Status: implementado localmente; publicacao
  pendente de gates Linux/CI.
- Nova raiz `/app/gestao` e submenu `/app/gestao/rotina` usam
  `crm.settings.manage`, aparecem no menu suplementar autorizado e reaproveitam
  os tokens da Tabela Associativo.
- A rotina inicial cobre apenas Gerente regional house. Gerente regional imob,
  Gerente house, Coordenador de vendas, Coordenador de parcerias e Corretor
  ficam nulos ate receberem classificacao propria.
- Fonte conferida por XML da planilha: 26 linhas preenchidas e 74 atividades,
  incluindo repeticoes e alinhamento por dia. Textos revisados sem reduzir os
  detalhes operacionais. A linha Excel 29, totalmente vazia, nao vira atividade.
- Edicao, insercao de linhas e botao Salvar gravam no `localStorage` do
  navegador. Nao houve migration, escrita remota, n8n ou nova permissao de banco.
- Validacoes locais aprovadas: lint, typecheck, build e testes focados de
  componente, rota, navegacao, inventario e contrato visual. `pnpm test`
  completo no Windows manteve seis falhas de modo POSIX e symlink; a falha de
  contador de rotas foi corrigida. A CI Linux e a referencia desses testes.
- Em 11/10, a publicacao foi retomada no PR #183. Integracao de `main`
  `7cbca83` preserva Administracao no menu principal e Configuracoes na conta,
  acrescentando Gestao antes de Administracao. A revisao da planilha encontrou
  atividades omitidas; recuperacao integral, feedback de armazenamento,
  teclado e QA autenticada dedicada foram incluidos no fechamento.
- Validacao do candidato `d72c9cc`: CI Linux `38181426038` aprovou validate,
  restore isolado, banco/advisors e E2E por perfil. O fechamento remove
  `text-transform: uppercase` herdado dos cabecalhos de Gestao/Rotina e
  confere o estilo computado na QA. Nova CI integral exigida no SHA final.
- Windows com Node 24.19.0: 2.457 testes aprovados, seis falhas POSIX e dois
  timeouts de conhecimento. Reteste isolado de conhecimento: 22/22 aprovados.
  Nao houve skips novos para esconder as falhas; testes opcionais do componente
  em Chromium foram executados localmente, e a jornada autenticada roda na CI.
- A captura autenticada do candidato anterior aprovou 15 combinacoes de largura
  e tema, com zero overflow global ou violacao Axe, alem dos controles. A revisao
  visual identificou texto escondido por scroll interno e uma pagina mobile
  excessivamente alta. O fechamento usa medidas em lote para altura dos campos,
  duas colunas nas opcoes mobile e tabela com pan horizontal e coluna de linhas
  fixa. Nova QA exige texto completo, alcance de todos os dias e foco visivel.

## 2026-10-12: Caixa de acesso e o proprio rascunho

- Fonte: draft aprovado `modelo-site.html#users`, implementação de
  `/admin/usuarios`, migration
  `20261012113000_apply_user_permission_access_draft.sql`, pgTAP e matriz visual
  autenticada. Status: validado localmente; publicação é registrada no Worklog
  somente depois da promoção.
- Não separar o estado efetivo da ação pretendida com um segundo seletor. Na
  tela aprovada, marcado significa acesso desejado e desmarcado significa sem
  acesso; clicar na própria caixa deve atualizar o rascunho e continuar
  exibindo claramente o tique.
- O rascunho precisa distinguir três efeitos de armazenamento: `allow` quando
  a caixa marcada diverge do papel, `deny` quando a caixa desmarcada diverge do
  papel e `inherit` quando volta ao padrão. Voltar ao mesmo efeito salvo remove
  a alteração pendente.
- `Usar padrão do perfil` não troca o papel. Ele prepara `inherit` para as
  exceções individuais atuais e remove mudanças transitórias sem exceção,
  fazendo a caixa refletir novamente a matriz herdada.
- Um rascunho misto deve ser persistido atomicamente. A RPC de composição pode
  ser `SECURITY INVOKER`, mas cada grupo continua passando pela RPC guardada
  que revalida autorização e grava auditoria. Interface nunca substitui a
  proteção do servidor/banco, especialmente para contas Administrador.
- Evidência visual precisa cobrir Claro, Médio, Escuro e mobile; a presença do
  tique também deve ser confirmada nas referências, sem introduzir ilhas
  escuras no tema Claro. Os quatro simuladores permanecem fora do escopo da
  mudança e devem repetir seus gates antes da publicação.

## 2026-10-11: Usuarios deve permanecer mestre-detalhe compacto

- Fonte: draft aprovado `modelo-site.html#users`, implementação real de
  `/admin/usuarios` e matriz visual autenticada. Status: validado localmente;
  publicação registrada no Worklog quando concluída.
- Preservar contratos não basta para paridade visual. Quatro cards de resumo e
  cinco grupos expandidos mudaram a tarefa de escolher uma pessoa e revisar um
  grupo por vez, produzindo 2.592 px onde o draft usa mestre-detalhe compacto.
- O contrato estável da tela é: diretório à esquerda, busca e filtros em chips,
  detalhe à direita, quatro abas (Comercial, Simuladores, Configurações e
  Administração), uma aba renderizada por vez e ações salvas pelo mesmo fluxo
  auditável do servidor.
- Catálogos reais podem ter mais itens que a demonstração. No desktop, limitar
  a região de permissões e mantê-la rolável/focável preserva todos os acessos e
  a densidade; no mobile, remover o limite interno mantém o fluxo vertical.
- O gate desktop de Usuários é 1.200 px. A captura aprovada mediu 1.187 px. Axe
  deve bloquear qualquer região rolável sem foco; `role=tabpanel`, nome pela
  aba e `tabIndex=0` compõem o contrato acessível.
- Dados, nomes e estados do draft continuam demonstrativos. A interface usa
  somente o diretório e a autorização reais, preservando a administração de
  contas Administrador exclusivamente pelo Master em todas as camadas.

## 2026-10-11: Temas sem ilhas escuras e Administrador como classe protegida

- Fonte: draft aprovado de 10/10/2026, migration
  `20261011143218_protect_administrator_accounts_and_enable_simulator_view`,
  matriz de autorizacao, PR #181, CI final `38161298050` e CI de `main`
  `38163173310`. Status: banco remoto aplicado como versao `20261011174323` e
  runtime publicado na release
  `6b3e5ffdd25c1a962f2a8ab46a763fec419a39b2`.
- Tema nao e apenas preferencia global: componentes com superfice navy propria
  precisam de override semantico explicito tanto em `light` quanto em
  `balanced`. O tema `dark` continua usando a regra-base navy.
- Administrador pode operar o CRM e visualizar os simuladores, mas nao recebe
  automaticamente capacidades exclusivas do plano de controle. Visualizacao,
  execucao oficial e gestao de politica comercial sao permissoes distintas.
- Contas Administrador sao administradas somente por Master. A regra precisa
  convergir em apresentacao, Server Actions, RPCs e triggers para impedir
  bypass por chamada direta; esconder controles nunca e uma fronteira de
  autorizacao.
- A limpeza de privilegios deve ser cirurgica: remover apenas overrides `allow`
  de Administrador para capacidades Master-only, preservando `deny` e qualquer
  override de outros papeis. As tabelas Qlik e os quatro motores financeiros
  ficam fora desse escopo.
- Antes da migration remota, criar e validar backup privado. Nesta aplicacao, o
  manifesto do backup tem SHA-256
  `4ec0ef67f7982963344881c70421af4cb41ad95517653839b38ebf4d10538950`; o
  pos-check confirmou zero grant Qlik direto e zero exposicao Data API dos
  helpers novos.
- Nao criar identidades produtivas apenas para completar um teste. Como havia
  uma unica conta Administrador, o ensaio remoto usou a propria conta dentro de
  transacao revertida e confirmou o bloqueio; o caso entre dois Administradores
  ficou apoiado pelo pgTAP e E2E isolado executados na VPS.
- A publicacao deve consumir o artefato da CI sem rebuild. Nesta release, o tar
  aprovado tem SHA-256
  `13d6d7333c1e3fdc1e75f841fc904af81cdc8eeb826f522b7dd40dbcd3a1ae51`,
  configuracao CI `sha256:9e172428` e manifesto local `sha256:e68a6141`; a
  cadeia de 11 camadas e os dois perfis de runtime foram comprovados.
- CAS partiu de `ac3d7893`; backup privado e rollback foram preparados. O
  container permaneceu saudavel, sem restart/OOM, com health local/publico,
  protecoes anonimas, assets e headers aprovados. A matriz autenticada usou
  identidades sinteticas isoladas; nenhuma sessao produtiva foi improvisada.

## 2026-10-11: ITBI e registro publicados com estimativa fiscal condicionada

- Fonte: PR #177, CI `38101674797` e CI main `38103844760`, verificacao publica
  de health e sessao autenticada. Status: publicado no SHA
  `1de9f5af9a4fe528b081c4c7b546e4ff667f2b9d`.
- Todos os gates passaram. A primeira tentativa da main teve interrupcao do
  auditor Axe em Repasse sem diagnostico conclusivo; o mesmo job/SHA passou na
  repeticao, sem modificar criterios. Nao transformar retry em excecao ao gate.
- Imagem unica validada e promovida com backup e CAS; saude e protecoes de acesso
  confirmadas. Registro tecnico completo em `docs/audits/itbi-registro-sp-2026-10-10.md`.
- Tabelas dependem da serventia e do enquadramento confirmado. O resultado nao
  substitui guia ou orcamento oficial; casos nao cobertos permanecem bloqueados.
  Nao assumir vigencia de 2027 nem alterar despachante, seguro ou juros.

## 2026-10-10: Integracao do draft aprovado para a VPS

Registro integral preservado em [auditoria vinculada](../audits/knowledge-draft-vps-2026-10-10.md).
Movido em14/10 somente para respeitar o limite do sincronizador; autoridades,
fontes, evidencias, pendencias e criterios anteriores nao foram alterados.

## 2026-10-10: ITBI e registro dependem do contrato fiscal, nao do perfil comercial

- Fonte: pedido autorizado, Prefeitura SP (ITBI 2513/2517), ARISP tabela 2026
  ISS 2%, tabela do 5o RI, Lei SP 11.331 e Leis federais 11.977/6.015. Branch
  `codex/itbi-registro-vigente`. Status: publicado em 11/10/2026, conforme registro acima.
- Isencao de 2026 ate R$ 245.527,77: pessoa fisica, uso somente residencial e
  primeira aquisicao **ou** MCMV. SBPE nao elimina isencao; a triagem comercial
  nao comprova primeira aquisicao, programa ou sistema do contrato.
- Aliquota reduzida depende de SFH/PAR/HIS/consorcio, valor e data do contrato.
  Data da transmissao, registro, entrega e primeira parcela sao distintas.
- Registro usa bases proprias e beneficios nao cumulativos; antigo fator fixo
  `0.620879` removido. ARISP/ISS 2% e 5o RI publicam totais diferentes; tabela
  aplicavel deve ser confirmada com o cartorio, sem inferencia pela cidade.
- Beneficio FGTS depende da origem do financiamento, nao do uso de saldo
  pessoal na entrada. Compra e garantia aparecem no resumo. Sobreposicao de
  FGTS fora do MCMV/item 14.4 e SFH com base superior ao preco ficam pendentes
  de analise do cartorio; nao escolher automaticamente o menor valor.
- Parametros, fontes, limites, atualizacao e testes em
  `docs/runbooks/documentation-fees-sp.md`; evidencias e release em
  `docs/audits/itbi-registro-sp-2026-10-10.md`.
- Verificacao Web na CI bloqueia limites/tabelas alterados, fonte indisponivel ou
  vigencia vencida. Runtime nao faz pesquisa a cada calculo e nao assume 2027.
- Preservados despachante, seguro, juros, parcelamento e fluxo comercial.
- CI `38098773619` aprovou banco, restore, E2E e predicado funcional visual;
  onze imagens documentais revisadas, 231 preservadas. Publicacao depende
  de nova CI contra as referencias atualizadas e imagem imutavel da main.
- QA autenticado exige altura inicial de Calcular Documentacao de ate 1200 px
  em desktop 1440. Dados fiscais extensos precisam de disclosure acessivel,
  mantendo validacao obrigatoria e o acesso aos campos; nao elevar o limite
  nem promover baseline com falha funcional. Evidencia: CI `38094894492`.

## 2026-10-09: Posicao atual do guia Associativo

- Fonte: pedido mais recente do usuario e componentes da branch
  `codex/guia-associativo-cabecalho`. Status: validado localmente e na primeira
  matriz funcional da CI; comparacoes visuais atualizadas apos revisao.
- Guia passo a passo agora pertence ao cabecalho, a direita do titulo, e nao
  ao rodape do estoque. Largura acompanha o texto, sem dimensao fixa de 260px.
- Cabecalho opcional no InvestorCalculator reutiliza SimulationCanvasHeader e
  mantem a referencia do guia no mesmo proprietario do estado. Outros simuladores
  continuam com seus cabecalhos anteriores; motores e os 36 passos nao mudam.
- QA deve conferir o acionador no titulo, preservar a rejeicao dos rotulos
  anteriormente removidos e testar quebra em 320px/375px sem sobreposicao.
- Testes, CI e release registrados na auditoria especifica deste ajuste.
- PR #176: 11 referencias mudam, inclusive celulares agora com o acionador no
  primeiro viewport; 231 preservadas. CI final em verify/publicacao pendentes.

## 2026-10-09: símbolo da marca deve herdar o token do texto

- Fonte: imagens de referência do usuário, `ProtectedShell.module.css` e
  `DescomplicaBrandMark.tsx`. Status: validado localmente; CI/publicação
  pendentes.
- Um PNG com o corpo branco preservava o tema Escuro, mas exigia sombra e não
  podia acompanhar `--header-text` no Claro/Médio. A marca inline usa SVG com
  `currentColor` somente no “D” e mantém a seta vermelha fixa.
- O componente vetorial também deve ser reutilizado nas fixtures para que o QA
  exerça a mesma geometria do runtime, sem uma cópia raster em data URI.
- Prévia Chromium sintética em 320 px foi inspecionada em Claro/Escuro. A suíte
  opt-in encontrou uma asserção preexistente fora do símbolo em 1181 px, não
  executada pelo gate padrão. Após integrar `origin/main`, Prettier, lint,
  tipos, 2.285 testes Vitest, 83 testes Node e build de 45 rotas passaram; CI e
  publicação estão pendentes.

## 2026-10-09: Apresentacao da pagina Associativo

- Estado final: publicado em `c20c9d2` pelo PR #174. CI main `37898684744`
  integralmente aprovada, prova da imagem e dois perfis, backup, CAS e health
  confirmados. Abertura/avanco/retorno/Escape/reabertura conferidos em sessao real,
  sem selecionar unidade ou modificar valores; nenhum erro de console.
- Fonte: pedido do usuario, branch `codex/guia-pagina-associativo`, componente
  `AssociativePageGuide` e catalogo `associative-page-guide-content.ts`.
- O novo Guia passo a passo fica no rodape direito do estoque, exclusivo do
  Associativo. Nao substitui o manual nem o passo a passo do preenchimento.
- A apresentacao nao altera dados para revelar secoes. Quando falta unidade ou
  preenchimento, explica o requisito e destaca a secao disponivel mais proxima.
- Portal dentro do workspace preserva os tokens de tema sem ficar preso ao
  overflow da tabela. Observadores acompanham scroll, resize e conteudo dinamico;
  Escape respeita dialogs nativos abertos e a saida devolve foco ao acionador.
- Status: implementado, validacao local/CI e publicacao em andamento. Evidencias,
  limites e resultado final em `docs/audits/associativo-guia-pagina-2026-10-09.md`.
- CI `37889190061`: validate/restore/banco/E2E e predicado funcional completo
  aprovados. Guia local: 18 cenarios, 648 etapas e seis verificacoes do estoque
  completo. Sete diferencas visuais esperadas revisadas, 235 imagens preservadas;
  nova CI verify e publicacao pendentes. Nenhum gate reduzido.
- CI verify `37892455623` aprovada; main `4e16a61` integrada sem conflitos.
  Status: aguardando CI conjunta, artefato imutavel e publicacao protegida.

## 2026-10-08: Telemetria da sessao e integridade da coleta Salesforce

- Fonte: pedido atual do usuario, branch `codex/salesforce-collector-status`,
  contrato `connection-contract.ts`, monitor e testes de coleta versionados.
  Status: implementado e validado localmente no escopo; gates Linux pendentes.
- Login/MFA continuam manuais no Chrome dedicado. O CRM so confirma conexao
  depois da prova de API recebida do coletor; nao infere sessao a partir do link.
- Recibo efemero de uma replica Node, TTL de 120 segundos e reset apos restart.
  Nao e historico persistente nem prova de publicacao. Escala horizontal exige
  armazenamento compartilhado antes da ativacao em multiplas replicas.
- Lock exclusivo e fail-closed para report incompleto; GET transitorio admite
  retry limitado, criacao de instancia nao. Segredos e dados brutos nao entram
  na telemetria. Regras de transformacao e IDs dos sete reports preservados.
- Pendencias operacionais: MCP n8n ausente, host do coletor/login dedicado,
  segredos privados e reconciliacao da primeira carga. Nenhum workflow remoto,
  migration, MFA ou dado remoto foi modificado nesta etapa.
- Evidencias: lint, tipos, build com 45 rotas, inventario e Gitleaks aprovados;
  21 testes focados da tela/status e 13 Node monitor/agenda; QA Chromium em nove
  cenarios, zoom 200%, estados e polling. Suite Windows registrou seis falhas
  POSIX e tres timeouts fora do escopo; os timeouts passaram em reteste 46/46.
  Node integral possui oito falhas Windows preexistentes. A corrida de I/O no
  cancelamento foi corrigida com await da escrita/limpeza antes do unlock;
  36 testes de extracao/retry/lock passaram, incluindo regressao A/B. CI Linux
  final permanece obrigatoria para publicacao.

## 2026-10-08: Conectar Sistemas validado para revisão final

- Fonte: CI 37720363346, artefato 11526388631 e captura limpa f3a209d,
  com árvore idêntica a 4a21e26. Status: validado funcionalmente; CI final das
  referências revisadas e publicação pendentes no PR #172.
- Validate, restore com 1.104 pgTAP antes/depois e E2E dos oito perfis passaram.
  Matriz visual: 154 checks responsivos, 88 de tema, 242 Axe/comparações,
  110 de zoom e nove cenários próprios da guia sem overflow ou violações.
- Onze diferenças intencionais de Configurações foram inspecionadas e
  promovidas pelo helper transacional original. Outras 231 imagens e limites
  1%/16 preservados, com proveniência registrada em reviewedUpdates.
- Testes locais finais: lint/tipos/build e 66 testes focados aprovados;
  2.247 testes Windows aprovados, seis falhas POSIX preexistentes e nove skips.
  Os mesmos gates de teste passaram no Linux da CI.
- Não há nova migration em relação à produção aad1536. Resultado de merge,
  imagem aprovada, backup e health ficará no PR #172. Autonomia Salesforce
  continua dependente de MFA dedicado, n8n e primeira carga reconciliada.

## 2026-10-08: Gates da guia Conectar Sistemas

- Fonte: CI 37718756017, revisão independente Chromium/axe no HEAD 2e80626.
- Status: pendente_validacao. Validate, restore e banco aprovados; E2E falhou
  porque esperava o menu anterior. A matriz passa a incluir a 25a rota e
  conserva os bloqueios dos perfis sem crm.settings.manage.
- O refresh herdado tinha contraste 1,37:1 no claro e 1,12:1 no médio.
  Mensagens da nova página passam a usar analytics-muted sem alterar os
  consumidores existentes; regressão coberta para ambos os estados.
- Publicação depende da nova CI. Integração real, MFA dedicado e primeira
  reconciliação continuam pendentes; não houve alteração de dados remotos.

## 2026-10-08: Conectar Sistemas na base atual

- Fonte: main 089daa1, integração fc34548 (PR #169), branch original bc6c0ab.
- Status: PR #172 aberto; gates completos e operação remota pendentes.
- A branch original continha oito commits Windows anteriores à entrega; o PR
  usa branch nova baseada na main e mantém coletor/publisher/agenda do PR #169.
- Guia suplementar sob Configurações, conforme Recurso MKT, com
  crm.settings.manage no servidor/Proxy e crm.salesforce.refresh para a ação.
  Catálogo PostgreSQL permanece com 17 páginas e sem migration adicional.
- Estado configurado não comprova sessão MFA nem sincronização ativa.
- Evidências: lint, tipos e build aprovados; 60 testes focados aprovados. Suíte
  Windows com 2.242 aprovados, 11 falhos e nove skips, incluindo um contrato
  da nova rota já corrigido e revalidado. Demais falhas: seis POSIX e quatro
  timeouts em arquivos intactos da main. Reexecução dos timeouts com dois
  workers: 61 aprovados e um skip. Node Salesforce: oito falhas locais.
- CI Linux 37718470536/job validate passou no SHA 38946ef, incluindo testes,
  auditoria e build. Banco, restore e harness autenticado permanecem pendentes; nenhum baseline
  histórico foi sobrescrito para aprovar a nova tela.
- Operação real ainda exige integração remota, sessão dedicada aprovada e
  reconciliação da primeira carga. Nenhum dado remoto foi modificado nesta etapa.

Registrar uma entrada curta por resultado tecnico relevante. Usar data real,
fonte, status (rascunho, pendente_validacao, validado ou arquivado), evidencias
e pendencias. Nunca copiar chats completos, segredos, clientes ou estoque bruto.

## 2026-10-07: publisher Salesforce para n8n preparado sem ativacao

- Status: pendente de integracao remota e primeira carga. Fonte:
  `ops/salesforce/publish-candidate.mjs`, testes Node e contratos documentais.
- O publisher fail-closed nasce desligado, envia somente `.payload` por HTTPS,
  le o Bearer origem→n8n de arquivo privado (`0600` POSIX ou ACL owner-only
  Windows) e aceita apenas confirmacao final do CRM `200/201`, `ok=true` e o
  mesmo `requestId`.
- MFA manual em Chrome/CDP dedicado e intencional. Aba do Codex nao e sessao CDP
  reutilizavel. `pnpm salesforce:chrome` prepara na estacao grafica um perfil
  exclusivo e CDP loopback, sem root, headless ou `--no-sandbox`.
- Os quatro comandos usam o mesmo `.env` local ignorado, aceitam caminhos
  nativos Windows/macOS/Linux, exigem porta CDP coerente e protegem o candidato
  atomicamente com permissao/ACL owner-only. Chromium Snap nao e selecionado.
- MCP n8n indisponivel: nenhum workflow remoto foi validado, atualizado, relido
  ou ativado. Refresh segue desligado; primeira carga e agenda permanecem
  bloqueadas ate n8n completo, CDP dedicado e reconciliacao da requisicao unica.
- As referencias historicas de 229 e 1.099 pgTAP estao desatualizadas; o HEAD
  atual exige 1.104. O contrato versionado permite a `service_role` somente as
  tres RPCs auditadas de ingestao Salesforce, Qlik e read model v3, sem acesso
  direto a tabelas. Nenhum pgTAP remoto foi executado nesta etapa.
- Evidencia local: 2.239 testes Vitest e 41/41 testes Node Salesforce aprovados;
  lint, tipos, build de 44 rotas e inventario aprovados. Launcher recusou root
  nesta VPS antes de iniciar processo, como projetado.

## 2026-10-07: mailer bloqueou signup/recovery

- Status: pendente_validacao e ativacao operacional. Fonte: logs agregados do
  Supabase produtivo, codigo das Server Actions, configuracao Nginx/Compose e
  documentacao oficial de limites do Supabase.
- Foram observados 15 `429` (`/signup`: cinco; `/recover`: dez) e um unico IP
  remoto nas 19 chamadas do recorte. O mailer padrao estava limitado a dois
  e-mails/hora. O IP da VPS e apenas observacional: o limite de envio combinado
  de `/signup` e `/recover` e project-wide.
- Preservar o servidor como autoridade de validacao, cookies, callback,
  anti-enumeracao e aceite legal. Depois de validar o formulario, sucesso, conta
  ofuscada, erro retornado e excecao do provedor precisam do mesmo aceite
  publico. Nao introduzir `Sb-Forwarded-For` ou `sb_secret_`: nao ha beneficio
  para esse limite e a credencial aumentaria o risco.
- Resend SMTP transacional usa subdominio de Auth e tracking off. Follow-up usa
  `relacionamento.*`, outra chave e controles proprios. Manter
  `ConfirmationURL`/PKCE em producao ate provar o template `TokenHash` contra
  scanners/prefetch.
- A CI revelou o advisory alto `GHSA-cjq9-62q9-8jv4` no runtime Next.js 16.3.6.
  Subir somente `next` para o patch oficial 16.3.8 remove a cadeia vulneravel e
  preserva o `eslint-config-next` 16.3.6 com seu patch versionado de glob.
- A migration Auth/MFA ja esta aplicada; este incremento nao requer migration.
  Lint, tipos, 2.248 testes Vitest, 41 testes Node, formatacao e build de 44
  rotas foram aprovados apos o rebase. DNS, SMTP, `rate_limit_email_sent` e
  deploy permanecem pendentes. Subir o limite somente depois do dominio
  verificado, com cooldown individual de 60 segundos e protecao contra abuso.

## 2026-10-07: quadro de repasses deve separar listagem e detalhe

- Status: validado localmente, pendente de CI; fonte: `RepasseWorkspace`,
  `data.ts`, Server Actions e QA sintético de Repasse.
- A visão geral projeta somente `A:E`; a coluna de motivo permanece fora da
  carga e só é lida pelo FID exato ao abrir o detalhe. Isso reduz exposição e
  mantém o contrato existente da planilha pública sem exigir mudança de
  compartilhamento.
- Como a fonte não possui data individual de início, atraso laranja exige uma
  duração superior a 20 dias escrita no próprio status. Não derivar idade da
  data global de atualização nem fabricar cartões atrasados.
- `crm.partnerships.view` é compartilhada por outros papéis. O acesso gerencial
  de Repasse combina essa permissão com allowlist exata de `master` e `admin`
  em todos os boundaries; Coordenador e perfis Imob continuam negados.

## 2026-10-07: substituições de portas aleatórias devem ser atômicas

- Status: validado localmente, pendente de CI; fonte:
  `isolated-restore-rehearsal.mjs`, `remote-state.mjs` e falha do job
  `isolated-restore` da CI `37575092037`.
- Substituir portas padrão sequencialmente permite colisão: um valor aleatório
  já inserido pode ser igual a outra porta padrão e ser contado ou substituído
  de novo. O arquivo de origem permanece válido, mas o gate falha de modo
  probabilístico antes de iniciar o ensaio.
- Validar o texto original e aplicar todas as trocas em uma única passagem
  elimina o encadeamento. O teste de regressão deve forçar uma porta gerada a
  `54327`, além de preservar falha fechada para padrão ausente ou duplicado.
- O ensaio completo posterior aprovou 44 migrations, 1.099 testes pgTAP em cada
  banco, lint, advisors, backup, restore, owners, privilégios e fingerprints em
  dois projetos locais efêmeros, sem mutação remota.

## 2026-10-07: Associativo publicado com data oficial e formulas conferidas

- Status: validado e publicado. Fonte: PR #165, CI main `37594420463`, prova da
  imagem imutavel `4d73412` e conferencia autenticada em producao.
- Todos os gates aprovados: 2.235 testes Vitest, 15 Node, banco, restore e QA
  autenticado com 242 comparacoes visuais, sem alterar baselines. Nove skips
  de plataforma/fixtures existentes; falhas Windows nao foram mascaradas.
- Backup, CAS, rollback preparado, health e negacao anonima verificados. Sem
  mutacao comercial, migration, proxy ou n8n. Evidencias tecnicas no audit
  `docs/audits/associativo-formulas-salesforce-2026-10-07.md`.
- Comparar propostas historicas exige o mesmo primeiro juro e primeira mensal,
  alem do termino da obra individual. Edicoes no calendario nativo precisam
  efetivamente disparar a mudanca da interface antes de ler o novo resultado.
- A nova versao encerra as pendencias de release do registro candidato abaixo.
  Amostra de paridade continua limitada a 20 lineares e 52 valores decrescentes;
  maior diferenca R$ 0,01, nao prova universal nem acesso ao codigo Salesforce.

## 2026-10-07: data oficial e formulas implementadas no candidato

- Status: pendente_validacao integral e publicacao.
- Fonte: pedido do usuario e audit `associativo-formulas-salesforce-2026-10-07`.
  `estoque_spc.data_termino_obra` e o campo financeiro; API o expoe como
  `completionDate`. 2.243 pares identificador/data conferidos por checksum.
- Associativo exige estoque vivo e nao completa data com snapshot. O proprio
  mes do termino pertence ao pos-obra; obra concluida admite plano todo pos.
- Principal mensal deduz anuais nominais; quatro blocos recebem juros acumulados
  e particao floor(n/4) com resto nos primeiros. Datas/totais usam essa particao.
- `Data 1o juros` observada no fim do mes anterior a `Data de Calculo`;
  datas financeiras de proposta salva nao devem ser trocadas pela data atual.
  UI permite conferir primeiro juro/primeira mensal e restaurar automaticas.
- Indicador Pro-Soluto usa correcao propria da carencia, distinta de `k` mensal.
  Limites comerciais e projecao bancaria local nao foram redefinidos.
- 70 novos casos sinteticos do motor aprovados. Gates integrais/CI, navegador
  e release permanecem pendentes; nao confundir amostra real com todo relatorio.
- Tipos/build/lint aprovados; suite geral Windows 2.168 aprovados e seis falhas
  POSIX conhecidas, seis ignorados. Matriz/integracao/ledger: 243 aprovados,
  incluindo 7.285 cenarios. Aprovacao de release depende da CI Linux e navegador.
- CI `37577305243`: validate, E2E e restore verdes. QA de continuidade falhou
  por seletor com dois alvos (summary e ajuda). Corrigido escopo do seletor;
  nova verificacao integral pendente. Nunca contornar o gate por essa falha.
- Revisao independente: historico exige datas do calculo e da entrada separadas;
  primeira mensal fixada limita novos sinais. UI e sugestoes passaram a usar
  essas datas e o calendario canonico, preservando sinais ja digitados.
  Regressoes focadas aprovadas; release ainda depende da repeticao dos gates.
- CI `37581613136` aprovou testes Linux, banco, E2E e restore. Seletores `has`
  devem procurar descendentes da linha, sem incluir o ancestral da pagina.
  Correcao reproduzida em Chromium sintetico; nova matriz integral pendente.
- CI `37584281089`: continuidade financeira completa aprovada em mobile/desktop.
  Teste negativo HTTP 503 precisa reconhecer o evento de console provocado por
  sua propria fixture. Excecao limitada ao evento exato, quantidade e janela
  controlada; nunca ignorar todos os erros de recurso. Repeticao integral pendente.
- Ao mudar autoridade de dados, conferir tambem os testes globais de carregamento:
  `checkDeferredInventory` ainda exigia selecao pelo snapshot no Associativo.
  Atualizado para bloquear ate a fonte viva; continuidade preserva a verificacao
  de valores ao trocar filtros. Fonte: CI `37587316857`, 40 navegacoes aprovadas.

## 2026-10-07: formulas do Associativo confrontadas com Salesforce

- Status: validado na amostra; implementacao e paridade global pendentes.
- Fonte: `docs/audits/associativo-formulas-salesforce-2026-10-07.md`, leitura
  autenticada autorizada do relatorio de vendas e propostas relacionadas.
- Inventario: 1.120 oportunidades em 24 empreendimentos, nao 1.120 calculos
  recalculados. Comparacao: 20 lineares exatos; 52 valores decrescentes de
  13 propostas, com maior diferenca de R$ 0,01, dentro da margem de R$ 0,05.
- Data financeira da unidade pode diferir da data geral; o mes da entrega
  ja entra no pos-obra. Preservar datas da memoria historica, sem misturar
  resultado salvo com calendario atual da unidade.
- Particao decrescente equilibrada distribui o resto nos primeiros blocos;
  capitalizacao acumulada vale tambem para blocos 3/4 inteiramente pre.
  A segmentacao visual Salesforce divergiu dos periodos de calculo em dois
  prazos. Reconciliar quantidades e totais antes da implementacao.
- 130.662 casos sinteticos independentes comprovaram fechamento por VP, nao
  paridade Salesforce. Sem persistir clientes/propostas ou alterar motores.
- Lint, tipos e build aprovados; suite geral com 2.008 testes aprovados e
  seis falhas POSIX/caminhos em Windows, detalhadas no audit. Sem publicacao.
- Pendentes: ultimo dia do mes e outras fronteiras nao observadas, ordem
  interna exata dos centavos, implementacao e validacao integral do produto.

## 2026-10-07: preferências de cookies contextuais e falhas observáveis

- Status: validado localmente; fonte: `CookieConsentBanner`, menu da conta,
  documento legal e QA autenticado.
- Um consentimento já registrado não precisa manter um controle fixo sobre toda
  página. O acesso posterior fica contextual no menu da conta e na Política de
  Cookies, enquanto o banner inicial continua obrigatório até uma escolha.
- Server Actions de preferências precisam retornar estado observável: durante a
  gravação os envios ficam bloqueados; sucesso fecha o painel; falha mantém o
  contexto e anuncia recuperação. O cookie continua `HttpOnly`, `SameSite=Lax`,
  `Secure` em HTTPS e sem enfraquecer categorias essenciais ou de segurança.
- O QA deve comprovar ausência do atalho flutuante, abertura contextual, foco,
  fechamento e uma gravação real com dados sintéticos. O ensaio público passou
  nos quatro viewports, sem overflow ou erro de navegador; lint, tipos, 2.051
  testes Vitest, 15 testes Node, build de 44 páginas, inventário e Gitleaks
  também passaram. A primeira CI bloqueou a expectativa E2E obsoleta do atalho
  permanente; o gate agora exige o fluxo contextual e ausência do controle
  antigo. Nova CI autenticada e publicação permanecem pendentes.

## 2026-10-07: sessão manual Salesforce com recarga fail-closed

- Status: validado localmente, sem MFA, coleta real ou mutação remota.
- Fonte: `ops/salesforce/browser-session.mjs`,
  `ops/salesforce/run-every-30-minutes.mjs` e runbook Salesforce/n8n.
- A integração aceita Chrome dedicado com MFA manual; não presume Connected App
  nem autenticação automática. CDP fica restrito a loopback e o `sid` permanece
  somente em memória.
- Cada ciclo recarrega a aba do workspace, confirma a sessão da origem exata e
  falha fechado ao chegar ao login. A agenda de meia hora é serial e continua
  pronta para recuperar depois de nova MFA, sem contornar timeout absoluto.
- O n8n candidato permanece inativo e sem envio ao CRM. Alteração remota exige
  MCP n8n, validação prévia e releitura; ausência da ferramenta não autoriza REST.
- ESLint, TypeScript, 2.048 testes Vitest com seis skips condicionais, 15 testes
  Node Salesforce, build de 44 páginas, inventário, Gitleaks e diff aprovados.
  Primeira coleta real, alteração n8n e flags remotas permanecem pendentes.

## 2026-10-07: matriz de acessos publicada com convergencia remota

- Status: validado e publicado; fonte: PR #159, CI `37556958745`, migration
  `20261005234936_reconcile_roles_dashboard_views_and_bulk_overrides.sql` e
  runtime `3bcc3c4a4ad892df4e127bb53a4a5696c9d6dbed`.
- A aplicacao via MCP registra uma versao baseada no horario remoto
  (`20261007021254`) mesmo quando o SQL vem de um arquivo versionado anterior.
  Preservar ambos no registro de release e o hash do SQL; nao fabricar
  alinhamento com `migration repair`.
- Sem backup fisico/PITR disponivel, foi criado backup logico privado antes da
  migration, com schema, dados, papeis, historico, permissoes `0600` e checksums.
  A imagem foi promovida por CAS e validada por health, ID/label OCI, container
  saudavel, rotas anonimas redirecionadas e Data API/RPC anonimas negadas.
- A convergencia nao decide House ou Imob para identidades antigas. Uma conta
  `broker` e duas `user` continuam sem grants herdados ate reclassificacao
  explicita; nenhuma identidade foi lida ou convertida durante a publicacao.

## 2026-10-07: reutilizar permissao exige revisar o novo conjunto de grants

- Status: validado localmente; fonte: integracao de `73b20d0`, matriz de papeis
  e contratos de Repasse.
- Uma rota Master-only reutilizava `crm.partnerships.view` porque, na base em
  que nasceu, apenas Master tinha a chave. Depois da separacao House/Imob, essa
  mesma permissao e legitima para Administrador, Coordenador e perfis Imob no
  Canal de Parcerias.
- O boundary de Repasse agora exige papel `master` mais a permissao no Proxy,
  navegacao, pagina e Server Action. Assim excecoes ou grants de Parcerias nao
  abrem a consulta de FID. O E2E deve manter 24 rotas por oito perfis.

## 2026-10-06: identificadores sinteticos nao podem variar a altura da baseline

- Status: validado localmente; fonte: CI `37532674180`,
  `admin-canvas.css` e matriz autenticada integral.
- A CI aprovou todos os gates funcionais, mas um e-mail sintetico quebrou em
  duas linhas no runner e em tres na referencia de 375 px. A diferenca de
  21 px era geometrica, nao uma regressao de autorizacao.
- Cabecalhos moveis com identificador variavel agora reservam duas linhas e
  limitam o excesso, mantendo o texto completo na arvore acessivel. As
  referencias de Usuarios em 320 e 375 px foram recapturadas.
- Interceptacoes Playwright que aguardam uma fixture podem encontrar a rota ja
  encerrada pela navegacao. Somente o erro exato `Route is already handled`
  pode ser tratado como cancelamento tardio; os demais erros devem continuar
  falhando o gate.
- Em host sem swap, a habilitacao sequencial do Associativo pode exceder 30 s
  sob carga normal. O gate aguarda explicitamente ate 60 s por campo, sem
  relaxar o estado esperado nem a continuidade do calculo.
- A recaptura integral aprovou 154 checks responsivos, 88 de tema, 242 Axe,
  242 comparacoes e 110 de zoom no commit `2fbb35b`, com arvore limpa no inicio
  e `passed: true`. Capturas pesadas devem rodar sem outro gate concorrente na
  VPS, que nao possui swap.

## 2026-10-06: build incremental pode ocultar CSS integrado entre worktrees

- Status: pendente_validacao na CI; fonte: integracao de `a89a93c` na branch de
  acessos e artefatos compilados em `.next/static`.
- Depois do merge, o fonte continha o novo brilho continuo do Associativo, mas
  o chunk CSS incremental ainda continha o atraso antigo de `4.5s` em
  `animation-delay`. Mover o `.next` gerado e reconstruir do zero produziu o
  chunk correto; o contrato de pixels focado e as dez larguras da navegacao
  passaram.
- Capturas locais extensas nao devem ser avaliadas sob contencao extrema. Um
  ensaio paralelo elevou a carga acima de 200 e causou timeout de teclado sem
  mudanca no produto. Nessa situacao, preservar os gates, registrar a uniao de
  promocoes limpas disjuntas e exigir o candidato integral da CI isolada.
- O manifesto combinado identifica `e0e0ce9` para o Associativo e `f1df3d6`
  para Usuarios. Seus hashes e 27 contratos de referencia passaram; a CI final
  ainda deve comprovar todas as 242 comparacoes antes do merge.

# 2026-10-07: negacao herdada nao bloqueia delegacao explicita do Master

- Status: validado em banco isolado; fonte: `lib/authorization/hierarchy.ts`, migration
  `20261007050255_allow_master_permission_overrides.sql` e matriz pgTAP.
- `Herdada: negada` e o default do papel alvo, nao uma proibicao absoluta. Um
  Master pode aplicar `allow` para permissao que possui a qualquer alvo de
  nivel inferior, inclusive quando `min_level = 100`.
- A excecao nao muda o papel. Admin continua sem alterar pares e nao propaga
  capacidade de nivel Master recebida por override; alvo Master e o proprio
  ator continuam bloqueados pela hierarquia.
- O contrato consolidado do restore passa a 1.104 pgTAP em 27 arquivos. Reset,
  duas execucoes pgTAP, backup/restore logico, lint, advisors, ACLs, owners e
  fingerprint canonico passaram em dois projetos PostgreSQL 17 descartaveis.
- Aplicacao local: formato, lint, tipos, 2.049 Vitest, 15 testes Node, audit e
  build de 44 paginas aprovados. A matriz visual longa terminou em timeout de
  tema do Associativo 375 px; nao foi reduzida e segue obrigatoria na CI limpa.

## 2026-10-06: baseline de tela longa deve preservar legibilidade interna

- Status: validado; fonte: candidato visual da CI `37507333920` e
  `scripts/qa/authenticated-visual.mjs`.
- Uma mudanca intencional de altura nao torna toda diferenca aceitavel. Revisar
  as capturas completas revelou que a grade somente leitura usava a primeira
  coluna para o texto e deixava largura insuficiente ao selo na segunda.
- A correcao explicita o modo editavel na linha: consulta usa texto + selo no
  desktop e empilha o selo no celular. O limite global de densidade permanece
  1.125 px; apenas `/admin/usuarios` admite 2.500 px para a matriz de 23
  permissoes, medida em 2.486 px no candidato anterior.
- A captura limpa no commit `f1df3d6` aprovou 154 cenarios responsivos, 88 de
  tema, 242 auditorias Axe/comparacoes e 110 checks de zoom. O promotor mudou
  somente as onze referencias de `/admin/usuarios` e preservou as outras 231.
  Axe, overflow, temas, teclado e zoom permaneceram obrigatorios.

## 2026-10-06: gates de release também são consumidores da matriz de papéis

- Status: validado localmente; fonte: CI `37501848220`,
  `scripts/qa/local-rls-api.mjs`, `e2e/release-candidate.spec.ts` e ensaio de
  restore.
- Alterar RBAC exige atualizar fixtures, escopos, conjuntos de rotas, menus e
  contagens do QA de release. Manter papéis aposentados no harness pode bloquear
  a CI corretamente, mesmo quando migrations e testes unitários passam.
- A contagem consolidada do pgTAP é um contrato fail-closed do restore. Ela
  deve acompanhar novos planos deliberados; o valor atual é 1.099 em 27
  arquivos, sem alterar evidências históricas já versionadas.
- Com `output: standalone`, gates locais devem iniciar `.next/standalone/server.js`
  e preparar `public` e `.next/static`, reproduzindo a imagem Docker. Isso evita
  depender do comportamento de compatibilidade de `next start`.
- Evidência: 19 Playwright aprovados e um skip previsto, oito perfis em 23 rotas,
  nove identidades sintéticas removidas, zero papel legado aprovado, oito
  acessos anônimos negados e zero linha exposta. CI final e publicação seguem
  pendentes.

## 2026-10-06: autorização de escopo precisa ser repetida depois do lock

- Status: validado localmente; fonte: revisão de segurança da RPC
  `set_user_permission_overrides_bulk` e branch
  `codex/roles-permissions-bulk-layout`.
- Um precheck antes de `FOR UPDATE` evita oráculos de metadados, mas não prova
  que o alvo continua gerenciável quando a transação retoma. Repetir a mesma
  decisão depois do lock fecha a janela antes de qualquer leitura sensível,
  override ou auditoria.
- Triggers de linha são defesa adicional, não substituem o guard da RPC:
  operações sem linha afetada, como `inherit` sem override, ainda podem chegar
  ao retorno e à auditoria se a autorização não for revalidada no boundary.
- Evidência focada: três Vitest e 57 pgTAP aprovados; prova local com duas
  sessões retornou SQLSTATE `42501` após mudança concorrente de escopo e deixou
  zero override e zero auditoria. O schema legado continua no ramo sem helper.
  Fechamento: formato, lint, tipos, inventário, segredos, build, 1.980 Vitest,
  oito testes Node e 1.099 pgTAP aprovados; lint e advisors do banco sem achados.
- A CI pode passar localmente e receber advisories novos antes da publicação.
  O audit do PR bloqueou `source-map-js` 1.2.1 e `sharp` 0.35.4; a consulta
  local seguinte também encontrou o SDK MCP 1.30.1. Atualizar somente para as
  versões corrigidas mínimas e repetir todos os gates, sem criar ignores.
  `pnpm audit --audit-level high` passou sem vulnerabilidades conhecidas nas
  versões 1.2.2, 0.35.5 e 1.31.0; suites obrigatórias foram repetidas.

## 2026-10-05: papéis por canal exigem permissão também no read model

- Status: validado localmente; fonte: matriz aprovada de papéis e branch
  `codex/roles-permissions-bulk-layout`.
- Ocultar uma guia de dashboard não separa os dados. Geral, Com Canal Imob e
  Sem Canal Imob precisam de chaves próprias, consulta server-side limitada e
  policy RLS por `view_key` nas tabelas de resumo, métricas e destaques.
- Papéis genéricos não provam o canal. Ao substituir Gerente/Corretor por House
  e Imob, manter chaves antigas sem grants e exigir reclassificação explícita é
  mais seguro que conceder ranking ou parcerias por inferência.
- Exceções múltiplas devem chegar ao banco em uma RPC atômica. Validar todas as
  permissões e a hierarquia antes da primeira escrita evita salvar apenas parte
  da seleção e mantém uma trilha de auditoria coerente.
- Produção pode estar atrás da árvore local de migrations. Uma convergência
  nova precisa ser ensaiada tanto no reset completo quanto sobre o schema
  remoto restaurado; `db push --include-all` e `migration repair` não resolvem
  essa diferença.
- Evidências: 1.980 testes Vitest, oito Node, 1.099 pgTAP, lint, tipos, build e
  jornada autenticada sem violações Axe. Autorização da migration,
  reclassificação das três contas legadas e publicação continuam pendentes.

## 2026-10-06: origem pública de repasse exige risco explícito e isolamento

- Status: pendente_validacao; fonte: implementação, revisão independente e decisão
  expressa do responsável na branch `codex/repasse-map`.
- Autenticação no CRM não privatiza uma planilha cujo export aceita leitura
  anônima. O responsável decidiu manter esse compartilhamento em 06/10/2026;
  portanto o risco de leitura fora do CRM é residual conhecido, não uma garantia
  fornecida pelo RBAC Master-only.
- O adapter server-only usa o datasource CSV público com documento, `gid`,
  `headers=0` e intervalos fixos. `headers=0` evita que o Google infira cabeçalhos
  e desloque os índices. Não há token, conta de serviço ou credencial Google no
  runtime.
- Para reduzir a projeção do CRM, primeiro buscar metadados e somente a coluna de
  FIDs; carregar as colunas pessoais apenas quando houver uma correspondência
  exata. Duplicidade deve falhar antes da segunda leitura, e a segunda leitura
  precisa revalidar unicidade e FID se as linhas mudarem.
- Server Action precisa repetir release gate, papel `master` e permissão, mesmo
  quando Proxy e página já validam. Nesta jornada `crm.partnerships.view` é
  compartilhada com papéis Imob; somente a combinação explícita mantém Repasse
  restrito sem migration remota.
- Evidências: `tests/repasse.test.ts`, `tests/repasse-action.test.ts`,
  `scripts/qa/repasse.mjs` e `docs/runbooks/repasse-google-sheet.md`. A matriz
  sintética passou 12 combinações de viewport/tema, Axe, teclado e quatro estados.
- O acesso e os dados remotos não foram modificados. Se a origem passar a privada,
  o endpoint público deve falhar como indisponível até existir adapter autenticado;
  não usar fallback que exponha segredos ao navegador.
- A revisão de segurança do diff público terminou com cobertura completa e sem
  achado reportável. Foram conferidos RBAC, SSRF/redirect, parser CSV, limites de
  recursos e remoção de credenciais; 39 testes focados passaram. A limitação de
  taxa da infraestrutura e a governança dos editores da planilha permanecem
  controles operacionais externos, não garantias deste adapter.
- Após integrar `main` em `a89a93c`, lint, tipos, 2027 testes Vitest, oito testes
  Node e build das 44 rotas passaram localmente. CI `37532954767` aprovou build,
  banco, restore, autorização e matriz visual no SHA `a06ebad4`; a mudança de
  adapter aprovou lint, tipos, 2.030 testes Vitest, oito testes Node, inventário
  de recursos e build das 44 rotas no estado final local, mas ainda exige nova CI
  e imagem promovível.
- A primeira CI integrada detectou o inventário E2E antigo de 23 rotas. Toda rota
  nova precisa entrar no contrato dos oito perfis: Repasse retorna `200` somente
  para Master e `403` para os demais; sua captura visual permanece no QA dedicado.
- Ao redimensionar uma página já renderizada, medir overflow no mesmo instante
  pode observar geometria intermediária. O QA deve aguardar fontes e amostras
  consecutivas estáveis de `innerWidth`, `clientWidth` e `scrollWidth`, e só então
  aplicar o limite original; nunca corrigir esse ruído com `overflow-x: hidden`,
  baseline nova ou espera condicionada ao resultado desejado.

## 2026-10-06: saldo do Associativo publicado com bases financeiras preservadas

- Status: validado e publicado; fonte: PR #156, CI `37511669464`/`37515245924`
  e `docs/audits/associativo-anuais-e-ajudas-2026-10-05.md`.
- Runtime `a89a93c07127b2ff1c5cdd4730a709fb1f973424`; imagem/11 camadas e dois
  perfis conferidos sem rebuild, backup/CAS/rollback e health/guards aprovados.
- 7285 cenarios sinteticos/250197 comparacoes sem divergencias; 242 capturas
  finais aprovadas. Isso nao equivale a todas as combinacoes nem aprovacao bancaria.
- Sobrecarga de validacoes locais em outro checkout tornou SSH/HTTP lentos
  antes do deploy. Aguardar recuperacao, medir health e preservar processos
  alheios; suites extensas continuam exclusivas da CI/ambiente isolado.
- Conferencia autenticada real aprovada apos login: incluir/retirar anuais
  desconta/restaura R$ 7.350,00, preserva Pro-Soluto e recalcula indicadores.
  CI sintetica e smoke publico aprovados. Nenhum dado remoto ou workflow n8n
  foi alterado; os valores temporarios foram removidos ao recarregar a aba.

## 2026-10-06: revalidar advisories antes da publicacao

- Status: pendente_validacao integral; fonte: CI `37506185905` e advisories
  oficiais registrados no audit de anuais e ajudas do Associativo.
- Um lockfile validado no dia anterior pode receber alertas novos. Corrigidos
  Sharp 0.35.5, source-map-js 1.2.2 e SDK MCP transitivo do Next 1.31.0;
  auditoria voltou a zero, sem ignorar alertas nem reduzir gates.
- Protocolo dos MCPs e docs locais aprovados; 34 testes focados aprovados.
  Repetir CI Linux, imagem e QA integrado antes da publicacao.
- CI `37507557118` aprovou Linux, banco, restore, autorizacao e contratos
  funcionais. 11 capturas do Associativo revistas na combinacao atual e
  promovidas, mantendo 231 por hash. CI final e publicacao ainda obrigatorias.

## 2026-10-05: saldo nominal e base financeira do Associativo

- Status: pendente_validacao; fonte: audit de anuais e ajudas de 05/10/2026,
  codigo archive e pedido do usuario na branch `codex/associativo-saldo-anuais`.
- `balanceBeforeCorrection` e Pro-Soluto, nao saldo exclusivo das mensais.
  Ledger nominal usa valores digitados em centavos; motor archive subtrai
  anuais corrigidas antes de calcular mensais. Nao substituir uma base pela
  outra nem descontar anuais duas vezes para corrigir um rotulo de interface.
- Archive e WF13 oficial possuem contratos diferentes; preservar ambos e os
  oraculos existentes. Esta correcao expositiva nao autoriza mudar politica.
- 33 testes iniciais e 364 testes da auditoria financeira aprovados; gates
  globais, QA visual e publicacao ainda pendentes.
- Validacao local concluida: lint/tipos/build, 81 regressoes finais, 13 testes
  de brilho, nove etapas React e oito Node aprovados. Windows exige CI Linux
  para seis testes POSIX; timeout de conhecimento passou isolado (22/22).
- Keyframes alinhados ainda podem ter pausa invisivel. Medir pixels entre
  cards detectou quase quatro segundos na versao antiga e 0 ms na correcao.
- Ao medir um efeito isolado, pausar e restaurar as animacoes vizinhas evita
  falsos pixels positivos. Prova React em 1440px e 375px passou, sem relaxar
  tolerancia. Matriz definida: 7285 casos, 250197 comparacoes, zero divergencias.
- CI detectou ruido subpixel nos cantos. Manter a camada sozinho nao bastou:
  CSS compilado e Geist reproduziram pixels fora do pseudo-elemento. A mascara
  deve respeitar border-box, insets e raio reais; fixture inclui essas bases,
  posicoes fracionarias e prova negativa da pausa antiga, sem relaxar tolerancia.
- Integra `dcb88c9` preservando canvas e temas mobile aprovados; o Associativo
  fica somente com o titulo no cabecalho. Revalidacao combinada obrigatoria.
- Integracao local aprovada (lint/tipos/build, 83 testes focados, roteiro mobile,
  oito Node); seis testes POSIX dependem da CI Linux. Timeout DevTools passou
  isolado (24/24). CI `37364639266` nao obteve runner hospedado durante incidente
  GitHub Actions `3q1yb5m7ltvb`, em 05/10/2026. PR #156 sem deploy; gates mantidos.
- Na retomada, CI Linux passou em validate, banco, restauracao e autorizacao.
  Geometria do cabecalho ainda exigia o selo que o usuario retirou; contrato
  atualizado exige ausencia dos tres rotulos e do aside vazio, sem reduzir
  verificacoes de titulo, estoque ou navegacao. Publicacao ainda pendente.
- Em 06/10, CI `37383133528` tentativa 2 aprovou todos os contratos funcionais.
  11 capturas do Associativo revisadas por retirada do cabecalho; 231 referencias
  preservadas. Promocao canonica com hashes e tolerancias originais. Repeticao
  financeira: 7285 casos, 250197 comparacoes, zero erros; publicacao pendente.
- Integracao posterior de `a22f4dc`: preserva temas e sua baseline integral.
  Capturas anteriores do Associativo sao historico, nao prova da combinacao;
  nova CI e revisao visual obrigatorias antes da publicacao.

## 2026-10-05: temas precisam compartilhar tokens, nao paletas locais completas

- Status: validado; fonte: auditoria das capturas autenticadas e branch
  `codex/theme-color-calibration`.
- Claro e Medio podem existir formalmente e ainda parecer o mesmo tema quando a
  diferenca de luminosidade e pequena. Usar fundos `#f3f6fa` e `#d9e1eb`
  produz separacao perceptivel mantendo a mesma hierarquia azul.
- Um canvas que redefine todos os tokens semanticos interrompe a preferencia
  global. Ranking, Canal e Configuracoes devem herdar a paleta da raiz; variaveis
  locais ficam reservadas a identidades deliberadas, como o dourado do
  Associativo, e precisam de contrato proprio.
- Contraste calculado apenas sobre o token de texto nao basta quando o mesmo
  azul tambem e fundo de CTA ou filtro. Axe em navegador encontrou essa
  composicao e exigiu um azul de preenchimento mais claro, sem voltar ao verde.
- Evidencias: `tests/theme-color-calibration.test.ts`, matriz autenticada em
  `docs/qa/reference-parity/authenticated-results.json` e auditoria
  `docs/audits/theme-color-calibration-2026-10-05.md`.

## 2026-10-04: Recurso MKT em Configuracoes

- Status: validado; fonte: print do usuario, PR #152 e auditoria de publicacao.
- Rota `/app/configuracoes/recurso-mkt` reutiliza o canvas e os tokens da Tabela
  Associativo, com um unico shell protegido. Navegacao suplementar exige pai
  Configuracoes autorizado, permissao de gestao e gate de release habilitado.
- Fundo e custo ajustaveis somente no estado local, com rateio 40/30/20/10 e
  expectativa de vendas inteiras arredondada para baixo. Sem gravacao de
  politica, recurso ou configuracao ativa; sem migration ou workflow n8n.
- Evidencias: 62 testes focados e lint/tipos/build locais aprovados; 12 capturas
  do componente real em preview isolado, com Axe, controles e teclado aprovados.
  Testes: `tests/marketing-resources.test.tsx`, navegacao e Proxy; jornada
  autenticada: `scripts/qa/marketing-resources.mjs`. CI Linux e publicacao no
  PR #152 pendentes; o preview nao substitui a prova de autenticacao.
- CI `37255127701` aprovou validate e restore; E2E exigiu atualizar a lista
  esperada de links. Nova rota agora participa da matriz de autorizacao dos
  nove perfis, com acesso administrativo existente e negacao dos demais.
- CI `37255825356` aprovou os nove perfis; seletores semanticos identificaram
  que links envolvendo `article` nao recebiam nome acessivel do conteudo.
  Usar rotulo explicito do titulo. Correcao coberta por renderizacao do card.
- CI `37257361148`: falha residual curta exige prova adicional no helper,
  sem alterar produto ou reduzir gates. Aguardar URL do router e registrar
  somente etapas e classes estaticas de erro, nunca a mensagem bruta do browser.
- A lista de links autorizados tambem aparece em `archive-navigation.mjs`.
  Ao adicionar uma guia, atualizar esse contrato junto da matriz E2E; manter
  contagem exata e provas de alcance de cada link, sem relaxar os limites.
- CI `37258678938` comprovou os 12 cenarios autenticados MKT, teclado e
  controles. Contrato antigo do menu impediu o restante; corrigido na branch.
  Integracao de `e1ab14a` preserva as referencias e resultados do PR #150;
  validacao combinada e publicacao continuam pendentes.
- CI `37260367645`, captura limpa `c81abd2` com arvore identica a `1b68614`:
  validate, restore, nove perfis E2E e todos os criterios funcionais aprovados.
  154 responsivos, 88 temas, 209 Axe, 110 zooms, 40 menus e 12 cenarios MKT.
  Somente oito diferencas esperadas da visao geral de Configuracoes; revisadas
  em 05/10 e promovidas transacionalmente apos conferencia de arvore e hashes.
  Preservadas outras 201 imagens e a proveniencia anterior, sem reduzir gates.
  Pendencias: CI integral depois da promocao e verificacao pos-publicacao.
- CI `37263297496` integral aprovada em `393457d`. Resultado anterior nao
  substitui a validacao depois da integracao de `afdb1c9` (PR #154), que alterou
  composicoes e referencias. Preservar a baseline da main, validar a combinacao
  e revisar somente as oito referencias afetadas pelo link solicitado.
- CI `37309490617`: validate, restore, nove perfis e todos os criterios
  funcionais passaram na base combinada. Captura limpa `7818dcf`, arvore identica
  a `af85930`; 12 cenarios MKT sem overflow ou violacoes Axe. Nova revisao das
  oito diferencas de Configuracoes promovida transacionalmente, com hashes e
  predicado original conferidos. Preservadas as outras 201 referencias da main
  e os contratos de canvas. Pendencias: CI final e publicacao.
- Fechamento em 05/10: CI do PR `37314518298` e da main `37322433490`
  integralmente aprovadas. Runtime `edbfcd13` publicado as 11:47 BRT por imagem
  imutavel comprovada, backup privado, CAS e rollback. Cinco healthchecks 200
  no SHA exato; container healthy sem reinicios/OOM/padroes criticos. Rota sem
  sessao retorna 307 para login; jornada MKT comprovada pela CI sintetica.
  Fonte: `docs/audits/recurso-mkt-2026-10-05.md`. Sem migration, n8n, politica
  ativa ou dados remotos alterados. Este fechamento documental nao reinicia o app.

## 2026-10-05: baseline autorreferente nao comprova paridade com canvas

- Status: validado localmente; fonte: auditoria visual do usuario, branch
  `codex/canvas-layout-parity-hotfix` e 11 canvases em
  `docs/qa/canvas-parity/reference`.
- Uma captura gerada pela propria aplicacao detecta regressao em relacao ao
  ultimo build, mas nao prova aderencia a uma referencia externa. O contrato
  precisa mapear rota para canvas e verificar tambem a densidade estrutural.
- Limite uniforme de altura e incorreto quando as referencias tem composicoes
  distintas. O limite deve ser explicito por rota, sem usar `overflow: hidden`
  e sem reduzir alvos de toque para fazer a tela caber.
- Componentes analiticos extensos podem continuar implementados sem fazer parte
  da composicao publicada. Sua reintroducao exige novo canvas e novo gate.
- Dados, RBAC e layout sao contratos separados: aproximar a tela nao autoriza
  copiar valores do mockup, remover guards nem liberar motores bloqueados.
- Evidencia: `docs/audits/canvas-layout-correction-2026-10-05.md`.
- Validacao local combinada concluida em `2026-10-05T18:32:51Z`, no source SHA
  `8a15aa4` sobre a base `de57b6a`: 154 cenarios
  responsivos, 88 de tema, 242 auditorias Axe, 242 comparacoes de regressao,
  22/22 comparacoes com os canvases, 110 verificacoes de zoom e 40 navegacoes,
  sem falhas. CAIXA continua fail-closed e o Tabelao oculta os controles no
  modo de impressao. Conta e fixtures efemeras foram removidas; nenhum remoto
  mudou nesta validacao.
- Recurso MKT permanece uma 23a pagina protegida com contrato proprio; passou
  12 combinacoes de viewport/tema, teclado e Axe. Sua chegada altera somente as
  referencias de Configuracoes que exibem o card, nao o conjunto dos 22 canvases.
- O E2E de release aprovou 20 cenarios com um skip remoto previsto e removeu
  dez identidades sinteticas. Expectativas antigas devem acompanhar a
  composicao aprovada: o Associativo nao possui guia no cabecalho e o desktop
  conta somente os tres botoes dentro de `data-theme-options-desktop`, sem
  confundir o ciclo de tema mobile oculto.

## 2026-10-04: cadencia visual e nome cadastrado

- Status: validado e publicado em 05/10/2026; fonte: PR #150, runtime
  `e1ab14a8739153c56081e4f36a76e99f80fed8b2`, pedido de doze ajustes e branch
  `codex/associativo-animacao-sequencial`, base `a4a9ef5`.
- Animacoes CSS montadas em momentos distintos nao compartilham necessariamente
  a fase. Alinhar somente novas animacoes a um relogio, sem timer de renderizacao,
  preserva sincronia; grupos sequenciais iniciam juntos em sua propria montagem.
- Movimento reduzido desliga decoracoes, nao a indicacao de foco. Botoes
  desabilitados nao devem continuar chamando a acao por brilho automatico.
- Pseudo-elementos exigem getAnimations com subtree e filtro por effect.target;
  hover nao pode substituir o loop continuo, pois isso reinicia seu relogio.
- O primeiro nome vem de `user_metadata.name`, preenchido no cadastro; email
  permanece identidade da sessao, nao e usado para inventar o nome. Sem nome
  valido, usar Conta. Essa apresentacao nao altera autorizacao.
- A CI `37245218837` detectou recorte do menu em 320px: nomes longos ampliam
  o cabecalho. O limite dos paineis absolutos deve usar a altura real do pai
  (`100%`), nao os 58px do caso compacto. Regressao inclui o ultimo item visivel.
- CI `37247029738`: contratos funcionais, acessibilidade e zoom passaram;
  somente comparacoes com a referencia anterior divergiram. Revisao visual
  ajustou a largura do nome no desktop; 44 testes focados aprovados.
- CI seguinte `37249431505` repetiu timeout de navegacao entre simuladores.
  A limpeza do contexto ocultava a operacao original; diagnostico preserva
  esse erro e limita acoes, sem ampliar timeout ou enfraquecer gates.
- CI `37251923554` identificou Configuracoes interceptando Claro. O menu e os
  temas precisam de tracks intrinsecos; nomes flexiveis ocupam somente o restante.
  Fixtures sem filhos nao reproduzem a largura dos chevrons de grupos reais.
  Incluir grupos completos e testar hit-testing com fontes distintas.
- CI `37253579651` confirmou a correcao: E2E, validacao Linux e todos os
  contratos funcionais passaram. As 173 diferencas visuais foram revisadas e
  promovidas; 36 capturas ja aprovadas conservaram seus bytes de referencia.
- Evidencias e pendencias: `docs/audits/associativo-sequencias-2026-10-04.md`.
  Preview 6/6, 47 testes de efeitos, 76 do cabecalho e 126 cenarios geometricos;
  CI do PR `37257462975` e do main `37259237555` integralmente aprovadas,
  incluindo modo verify. Nenhuma formula financeira alterada.
- Publicacao imutavel com hashes/OCI, dois perfis, backup, CAS e rollback.
  Health, guards anonimos e jornada autenticada aprovados. Registro final
  documental nao exige novo restart da aplicacao.
- A sessao real usada no postcheck nao forneceu nome valido, apesar de as
  fixtures exercitarem nomes completos. Nao inventar nome pelo email nem alterar
  contas pela autorizacao de deploy. Solicitados dado e autorizacao especifica.

## 2026-10-04: origem incompleta, recuperacao e prova numerica do Associativo

- Status: validado e publicado; fonte: PR #147, runtime
  `f4dec82249c2b3e56beaaea518ec194ced81b480` e audit
  `docs/audits/associativo-origem-brilho-2026-10-04.md`.
- Consulta observacional encontrou 84 unidades visiveis sem andamento e 594
  sem avaliacao positiva no snapshot. Ausencia real nao e defeito aritmetico e
  nao autoriza inferir zero ou copiar dado de outra unidade.
- Complemento tardio exige identidade unica e entrega igual, preenche somente
  fatos nulos e preserva a proposta iniciada. API alternativa e mais antiga;
  54 avaliacoes tem correspondencia compativel, quatro andamentos foram recusados
  por divergencia de entrega. Unidades apontadas continuam exigindo fonte oficial.
- Entrada manual de fatos oficiais fica isolada por unidade. Comprometimento
  funciona sem andamento; maximo e aprovacao ficam pendentes sem esse dado.
- Os dois motores rejeitam datas que JavaScript normalizaria para outro mes.
  Matriz numerica usa oraculos independentes e publica somente agregados.
- Capturas de elementos maiores que a viewport podem remover a emulacao de
  toque no Chromium. Preview captura a viewport e verifica o ponteiro novamente,
  sem alterar regras da aplicacao para fazer testes passarem.
- Evidencias locais: 14.014 casos numericos sem divergencias, seis jornadas
  visuais e seis jornadas de continuidade aprovadas, build/lint/tipos/audit
  aprovados. Windows conserva seis falhas POSIX; timeouts passaram isoladamente.
- CI Linux `37220843131` (PR) e `37222464725` (main) integralmente aprovadas:
  banco, restore, E2E, imagem e QA visual, sem promover baseline. Publicacao
  imutavel com backup/CAS; health, negacao anonima e jornada autenticada aprovados.
- Queda do transporte SSH apos mensagem de sucesso nao prova rollback nem
  autoriza repetir deploy: conferir versao, ID da imagem e health separadamente.
  Neste caso, as tres verificacoes confirmaram a promocao concluida.
- Pendencia: obter fonte oficial atual das duas unidades apontadas. O postcheck
  usou a API alternativa, mais antiga, e nao atesta completude do snapshot.
- Nenhuma migration, politica comercial, fonte externa ou workflow foi alterado.

## 2026-10-04: canvases aprovados cobrem 22 rotas protegidas

- Status: validado e publicado; fonte: PR #148, runtime
  `77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`,
  `docs/qa/canvas-parity` e
  `docs/audits/canvas-layout-parity-2026-10-04.md`.
- Uma unica navbar global serve Dashboard, cinco etapas, Ranking, Canal,
  Configuracoes/metas, Simulacao e Administracao. Subrotas nao devem recriar
  navegacao de aplicacao dentro do conteudo.
- Canvases sao autoridade apenas de composicao. A tela mostra dados de fonte
  validada ou indisponibilidade explicita; nomes, numeros e estados ilustrados
  nao podem virar dados reais, formulas nem politica comercial.
- CAIXA e uma rota protegida somente visual. O acesso exige permissao, enquanto
  motor, endpoint, submissao, analise e aprovacao bancaria permanecem
  fail-closed; o QA recusa habilitar `simulator.caixa` mesmo por flag.
- A captura limpa do SHA `a4c1717a1ac159804a1cda7b02ec3a3f48379b4a`
  aprovou 154 checks responsivos, 88 de tema, 209 de acessibilidade/comparacao,
  110 de zoom e 40 combinacoes da navegacao. Baseline transacional com 209
  imagens promovida; nenhuma conta ou fixture QA permaneceu no banco local.
- O roteiro de continuidade aguarda campos habilitados e valores persistidos e
  interpreta vazio como ausencia, sem mudar valores do cenario, formulas ou
  regras financeiras.
- O smoke de release deve tratar pagina e motor CAIXA como gates distintos. A
  matriz local aprovou Master 22, Admin 14, tres papeis analiticos com sete e os
  quatro papeis sem acesso comercial com zero; 20 cenarios E2E passaram, um foi
  ignorado conforme o contrato e dez contas sinteticas foram removidas.
- CI Linux do PR `37241474990` e do `main` `37243547805` aprovadas. Imagem da
  CI foi verificada por checksum, manifesto, configuracao, revisao, 11 camadas
  e dois perfis antes do CAS. Health, protecao anonima, headers e smoke HTTP
  passaram; rollback preserva a imagem anterior sem tocar no banco.
- Nenhuma migration, alteracao de dados, Nginx, DNS, integracao ou motor foi
  ativada. A conferencia autenticada produtiva permanece com o usuario; os
  gates de CI usaram identidades sinteticas isoladas e removidas.

## 2026-10-04: separar ausencia de dados de resultado zero no Associativo

- Status: validado e publicado; fonte: codigo do forecast, handlers de selecao e
  testes sinteticos da branch `codex/associativo-calculo-e-continuidade`.
- Comprometimento precisa de renda e cronograma valido; maximo mensal tambem
  precisa da evolucao de obra. Ausencia deve permanecer `null`, com pendencia
  explicita e aprovacao bloqueada, sem assumir andamento zero.
- Trocar unidade atualiza apenas informacoes do imovel; respostas e recursos
  permanecem. Revalidacao automatica nao significa reconfirmar ou apagar respostas.
- Avaliacao so vem da origem ou referencia inequivoca da mesma unidade. Preco
  de venda nao e substituto de avaliacao bancaria. Resposta tardia nao pode
  sobrescrever uma proposta que o usuario ja iniciou.
- Testes focados, build e cinco cenarios de continuidade no navegador aprovados.
  Windows teve falhas POSIX e timeouts em ferramentas; CI Linux 37203612944
  aprovou integralmente o PR #145. Consultar o audit de 04/10/2026.
- CI 37202986207 aprovou Linux, banco e restore; E2E ainda exigia apagar ranking
  apos editar renda. Atualizado para continuidade com prova proporcional dos dois
  comprometimentos, mantendo a barreira de isolamento entre usuarios.
- Main 106d626 aprovado na CI 37205634578 e publicado com imagem imutavel,
  backup privado e CAS. Health, negacao anonima e conferencia autenticada sem
  salvar dados aprovados. Ausencia genuina de informacao ainda bloqueia aprovacao.
- Matriz: 147 responsivos, 84 temas, 201 Axe/capturas, 105 zooms e 40 jornadas
  arquivadas; baseline intacta. Sem migration, mutacao de dados remotos ou n8n.

## 2026-10-04: shell unico validado em toda a matriz autenticada

- Status: validado localmente, pendente CI/publicacao; fonte: branch
  `codex/unified-protected-navigation`, resultado autenticado versionado e audit
  `docs/audits/unified-protected-navigation-2026-10-03.md`.
- Navegacao comercial vem do catalogo autorizado no servidor; quatro paginas
  liberadas fora das 17 do banco exigem pai, permissao efetiva e gate convergentes.
  CAIXA permanece sem caminho no item bloqueado e com guard direto fail-closed.
- A matriz limpa aprovou 147 responsivos, 84 temas, 201 Axe/comparacoes e 105
  zooms, alem de 40 combinacoes das jornadas arquivadas. Documentacao agora faz
  parte das 21 paginas visuais liberadas e conserva a suite funcional dedicada.
- A baseline fisica passou a ter exatamente as 201 imagens manifestadas; oito
  evidencias antigas da CAIXA foram removidas. O teste falha se uma captura
  orfa reaparecer e cada viewport comprova o truncamento da identidade longa.
- CSS legado reduzia `2.75rem` para 38,5px; controles de cookies passaram a usar
  minimo explicito de 44px. Nenhuma regra comercial, migration ou dado mudou.

## 2026-10-04: Associativo publicado com gates completos

- Status: validado; fonte: PR #141, CI 37173712179 tentativa 2 e audit
  `docs/audits/associativo-brilho-reprovacao-2026-10-03.md`.
- Runtime publicado 7337b97; 193 comparacoes visuais, 193 auditorias,
  40 navegacoes e seis jornadas v5 aprovadas. Sem promover baseline.
- Braces removido na base ja validada; preservar o patch, nao ignorar audit.
  Verificados hashes do artefato, equivalencia OCI/config/11 camadas e dois
  perfis no destino. Backup, CAS e pos-check aprovados; rollback desnecessario.
- Checkout principal da VPS sujo: usar checkout de release limpo, sem
  alterar trabalho alheio. Pressao de memoria adiou a troca ate estabilizar.
- Health e 12 GETs aprovados; jornada autenticada com dados ficticios sem
  salvar confirmou UI. Nao prova capacidade nem autoriza alteracoes de dados.
- PR #143 trata apenas QA/documentacao, sem necessidade de novo restart;
  CI do SHA final desse registro ainda obrigatoria antes da integracao.

## 2026-10-04: Aguardar o layout de impressao no QA

- Status: pendente_validacao; fonte: CI 37173712179 e reproducao sintetica
  com CSS completo do Tabelao, em Node 24.19/Chromium 151.
- `emulateMedia` pode devolver o controle antes de uma transicao de min-width
  terminar, mesmo com reduced motion (duracao 0.01ms). Cinco de seis leituras
  imediatas falharam; seis de seis passaram apos 13-48ms com o mesmo predicado.
- Usar polling limitado do contrato integral, nao espera fixa nem remocao de
  assercoes. A correcao e exclusivamente de ferramenta; pagina de referencia,
  CSS, limites visuais e regras financeiras permanecem iguais.
- Predicado preservado por AST; bloco final passou 10/10 vezes, enquanto
  largura e transform incorretos persistentes falharam por timeout nos probes.
  Oitenta e nove testes focados aprovados; CI do ajuste de QA ainda pendente.
- PR #141 ja integrado; CI do PR aprovou 193 capturas, 40 navegacoes e seis
  jornadas v5. Publicacao depende da revalidacao final da main, registrada no audit.

## 2026-10-03: shell protegido único e navegação fail-closed

- Status: pendente_validacao; fonte: código no SHA-base `8e158cc`, inventário de
  22 gates protegidos e pedido visual aprovado pelo usuário.
- Cinco simuladores renderizavam um cabeçalho local com links estáticos, enquanto
  as demais páginas usavam o catálogo autorizado. A convergência deve remover o
  shell interno, sem transformar visibilidade do menu em autorização.
- Quatro simuladores liberados fora do catálogo de 17 páginas podem ser anexados
  somente no servidor quando pai, permissão efetiva e `releaseEnabled` convergem.
  CAIXA permanece visível apenas como bloqueada e seu modelo de apresentação não
  contém `path`; banco, proxy, guards e RLS não mudam.
- Baseline: lint, tipos, 1.478 Vitest (1 ignorado), oito Node e build aprovados.
  Pendências: testes integrados, matriz visual/a11y, CI e publicação pelo runbook.

## 2026-10-03: Integracao da base corrigida no Associativo

- CI combinada 37167561944 aprovou validate e restore, mas o guidance detectou
  comparacao textual incorreta: CSS de producao serializa 0% como 0px. O QA
  normaliza apenas esse zero equivalente, preservando topo/rodape exatos e
  rejeitando 1px ou posicoes intermediarias. Quinze testes aprovados;
  publicacao ainda exige nova CI completa. Fonte: audit do Associativo.

- Status: pendente_validacao; fonte: pedido do usuario, PR #141 e main db1b625.
- O bloqueio de braces foi removido na base pelo PR #139, com patch versionado
  do plugin Next e tinyglobby. Incorporar essa solucao, sem aguardar 3.0.4,
  ignorar advisory ou refazer o patch. Validar novamente a arvore combinada.
- Preservados o Tabelao publicado e os ajustes exclusivos do Associativo.
  CI anterior 37136181590 parou apenas no audit; novos gates ainda obrigatorios.

## 2026-10-03: Brilho sem contorno e reprovacao metalica

- Status: pendente_validacao; branch codex/associativo-brilho-reprovacao.
- Fonte: seis capturas posteriores, CSS/JSX do Associativo e QA de guidance.
- Pedido mais recente remove o contorno fixo somente do ledger: verificar
  input, wrapper e composicao ancestral em vazio/preenchido/foco. Uma sombra
  herdada de focus-within pode restaurar o contorno mesmo com input limpo.
- Manter foco de teclado identificavel pelo nome sublinhado. Brilho de 3s
  percorre duas faixas de 2px no topo e rodape da linha inteira; reduced
  motion desativa animacao. Nunca alterar calculos para atender estilo.
- Dolar precisa ser irmao externo do resumo, nao filho da celula de data.
  Validar alvo 24/44px, icone 17px, distancia, alinhamento e hover no mobile.
- Reprovacao usa gradiente #650c17/#9d1828/#74101c/#48080f, texto branco,
  brilho vermelho e CTA escuro local, sem depender do fundo claro do tema.
- 30 testes focados e oito Node aprovados. Cinco timeouts da suite integral
  passaram na repeticao serial (46 testes); seis falhas POSIX exigem CI Linux.
- Lint, tipos, build e 6/6 jornadas finais aprovados, incluindo contraste,
  animacao/reduced motion, ausencia de contornos e dolar externo alinhado.
- Publicacao bloqueada: audit braces GHSA-vfj7-8cjw-p6xm; 3.0.4 indisponivel
  no registro consultado. Nao ignorar advisory nem alegar correcao aplicada.
- Detalhes e pendencias: docs/audits/associativo-brilho-reprovacao-2026-10-03.md.

## 2026-10-03: Tabelao publicado com evidencia de producao

- Status: validado; fonte: PR #139, CI 37136895575, CI main 37144378453 e
  verificacao HTTP/DOM autenticado em crm.descomplicapro.com.br.
- Runtime publicado: 8e158cc9d13beeff0087064df6d9b58d87790379. Todos os gates
  verdes; imagem imutavel comprovada por hashes/camadas e dois perfis no destino.
- Backup privado e rollback preservados; CAS concluido. Health confirmou SHA,
  acesso anonimo negado e pagina autenticada exibiu layout, ordem, dourado,
  Maps e recursos. Politica comercial continua disabled, sem destino.
- Endereco ausente na origem oficial continua sem link; nao inventar logradouro.
  Alteracao nao muda origem do estoque, regra financeira, dados ou migrations.
- Evidencias: docs/audits/tabelao-layout-maps-2026-10-02.md. Sem pendencia de
  publicacao do runtime. Registro documental posterior nao exige restart.

## 2026-10-03: Tabelao validado funcionalmente e referencias revisadas

- Status: pendente_validacao final; fonte: CI 37134880142 e artefato 11278718828.
- Build, lint, tipos, 1475 Vitest, oito Node, audit, banco, restore e E2E aprovados.
- Matriz funcional integral aprovada. Somente 11 capturas do Tabelao divergiram;
  revisao visual confirmou cabecalho compacto, Maps, ordem, dourado e rodape.
- Promocao transacional conferiu arvore limpa, hashes e predicado funcional
  original; 182 imagens preservadas, sem mudar tolerancias. Politica continua
  desabilitada e sem destino. Pendencias: nova CI, imagem e verificacao de producao.
- Evidencia: docs/audits/tabelao-layout-maps-2026-10-02.md; PR #139.

## 2026-10-03: Substituicao do glob no lint Next

- Status: pendente_validacao; fonte: codigo Next 16.3.6 e guia oficial tinyglobby.
- getRootDirs e o unico consumidor do fast-glob no plugin. Patch pnpm troca por
  tinyglobby 0.2.17 ja presente, com packageExtensions e remocao da cadeia antiga.
- Desabilitar expandDirectories e preservar saidas relativas/absolutas e aliases
  Windows 8.3. Testar a regra Next real, nao somente a ausencia no lockfile.
- Docker precisa copiar patches antes do install. Auditar normalmente, sem ignore.
- Dez testes focados passaram; primeira auditoria limpa. Lint local interrompido
  sob baixa memoria. Conclusao depende da CI e demais gates.
  Evidencias: docs/audits/next-eslint-glob-2026-10-03.md; PR #139.

## 2026-10-03: Politica desabilitada e bloqueio de auditoria do Tabelao

- Status: pendente_validacao; branch codex/tabelao-layout-maps, runtime 562465b.
- Fonte: confirmacao direta do usuario e rechecagem do PR #139/CI 37086793201.
- Politica comercial desabilitada e sem destino e o estado solicitado, nao uma
  pendencia de documento. Componente e QA existentes ja preservam esse contrato.
- CI aprovou formatacao, lint, tipos e testes; pnpm audit local tambem confirmou
  GHSA-vfj7-8cjw-p6xm alto. npm latest de braces permanece 3.0.3, sem correcao
  segundo GitHub Advisory. As ultimas versoes dos consumidores mantem a cadeia.
- Sem mudanca de runtime ou dependencia, bypass, merge ou deploy. Evidencias:
  docs/audits/tabelao-layout-maps-2026-10-02.md. Release segue pendente do gate.

## 2026-10-02: Layout e Maps no Tabelao

- Status: pendente_validacao; branch codex/tabelao-layout-maps, base 3960724.
- Fonte: sete prints, rota explicitada pelo usuario e confirmacao de manter
  a origem oficial atual para os enderecos.
- O endpoint protegido de estoque repassa uma API externa; o complemento de
  endereco vem do snapshot ESTOQUE SPC. Nao afirmar consulta direta ao banco.
- URL Maps usa somente componentes presentes e URLSearchParams. Sem logradouro,
  manter ausencia explicita sem link; rowspan deve comparar texto e destino.
- Nova ordem exige colgroup, cabecalho, corpo e oraculos de QA consistentes.
- CSS legado de impressao oculta investor-stock-panel. Restaurar somente no
  Tabelao e verificar presenca de todas as linhas antes de aprovar Imprimir.
  Conferir tambem textos descendentes e variaveis de tema: somente restaurar a
  tabela deixa Empresa/Empreendimento claros sobre branco. QA exige 4,5:1;
  capturas devem esperar o fim das transicoes antes de inspecionar o papel.
- Enriquecimento compara cidade/UF/CEP conhecidos antes de completar endereco;
  referencias ambiguas nao podem escolher arbitrariamente uma localizacao.
- Lint, tipos e build iniciais aprovados; 283 testes de dados e 18 de interface
  aprovados. Seis larguras, tres temas, Maps e impressao conferidos localmente.
  Duas suites Windows interrompidas por timeouts/baixa memoria e falhas POSIX.
  Gates completos pendentes. Politica depende de documento/destino do usuario.
- CI 37086002430/PR #139: 1465 Vitest e oito Node aprovados; audit bloqueia
  braces@3.0.3, GHSA-vfj7-8cjw-p6xm. Em 02/10, npm retornou E404 para 3.0.4
  e GitHub Advisory informou nenhuma versao corrigida. Nao ignorar esse gate.
  Publicacao, imagem e matriz visual autenticada continuam pendentes.
- Evidencias: docs/audits/tabelao-layout-maps-2026-10-02.md. Sem migration ou n8n.

## 2026-10-02: Contorno dourado sem preenchimento nos editaveis

- Status: pendente_validacao; branch codex/associativo-contorno-dourado.
- Fonte: duas capturas e pedido posterior do usuario, CSS e QA de guidance.
- A direcao nova substitui o preenchimento dourado das etapas por contorno;
  apenas a selecao do estoque preserva preenchimento metalico, mais escuro.
- Campos preenchidos precisam continuar transparentes. O seletor global de
  formularios tem alta especificidade: aplicar a excecao local tambem ao
  Ranking, sem mudar tokens compartilhados ou outras tabelas.
- Brilho limitado a 2px junto a borda, ciclo de 3s, sem cobrir texto. Mantem
  reduced motion e destaque somente na etapa pendente, sem pular modalidade.
- Contratos de QA atualizados para a solicitacao: rejeitam fundos dourados,
  caixas escuras, brilho branco/azul, faixa larga ou estatica. Contraste >=4.5
  para texto e >=3 para contorno nos tres temas; nenhuma tolerancia relaxada.
- 28 testes focados, lint, tipos, build, 8 Node e 6/6 jornadas aprovados.
  Windows com 6 falhas POSIX conhecidas; CI Linux e publicacao pendentes.

## 2026-10-02: Paleta do Tabelao como referencia do Associativo

- Status: validado; PR #136, runtime 150b771.
- Fonte: novo pedido do usuario e leitura da pagina /app/simulacao/tabelao.
- Referencia escura confirmada no DOM: fundo #061f35, painel #0a2b47,
  cabecalho de secao #0e4163 e campos #071a31. Tabelao somente leitura.
- A nova direcao substitui o azul quase preto anterior. Remover overrides
  exclusivos para herdar os tokens comuns evita duplicar a paleta; nao alterar
  tokens compartilhados nem seletores do Tabelao para atender o Associativo.
- Dourado e brilho de 3s continuam exclusivos das selecoes/proximas acoes.
- 28 testes focados, lint, tipos, build e 8 testes Node aprovados. Navegador:
  6/6 jornadas, 3/3 comparacoes de paleta e revisao desktop/celular aprovadas.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas POSIX conhecidas.
  CI Linux 37063588639 aprovou suite, build, restore e gate funcional.
- Duas capturas escuras do Associativo revisadas/promovidas; demais 191
  preservadas, inclusive Tabelao. CI PR 37067036288 e main 37069870083 verdes.
- Publicacao por imagem imutavel comprovada, backup e CAS; health correto,
  acesso anonimo negado e paleta/dourado de 3s confirmados no DOM publicado.
- Limite: verificacoes de producao observacionais, sem prova de capacidade.
  Fechamento documental nao demanda reinicio. Auditoria vinculada no WORKLOG.

## 2026-10-02: Tipografia e caixa de frase no Tabelao

- Status: pendente_validacao; branch codex/tabelao-tipografia-ptbr, base d7c06b6.
- Fonte: sete capturas e confirmacao do usuario para preservar nomes proprios
  e siglas; TabelaoClient, TabelaoFilters, CSS local e tabelao-presentation.
- Fonte unica de 11px para corpo/cabecalho; titulos nao quebram palavras nem
  dependem da caixa alta herdada. A coluna Planta libera espaco para os titulos
  Regiao, Metragem, Vagas e Estoque, mantendo o total das larguras em 100%.
- Formatar somente o rotulo exibido; manter valores dos selects, identificadores
  de estoque e comparadores comerciais originais. Isso evita regressao de filtros
  ao corrigir acentos ou a grafia de Terreo/Tipo/Adaptavel.
- Trocar Incorporadora por Empresa apenas na pagina solicitada. Outras tabelas
  usam seus contratos existentes e nao pertencem a esta mudanca.
- Nove cenarios Playwright locais, 42 testes do formatador, 17 contratos focados,
  lint do codigo, tipos e build aprovados. Suite Windows: 1405 aprovados e seis
  falhas POSIX; oito testes Node aprovados. Auditoria: tabelao-tipografia-2026-10-02.
- CI Linux 37028915320: 1411 Vitest e oito Node aprovados, banco/restore/E2E
  e matriz funcional verdes. Sete capturas revistas e promovidas; 186 imagens
  preservadas por hash. Reexecucao final/publicacao pendentes no PR #133,
  que recebera a evidencia de fechamento apos validacao da release real.
- A revisao detectou siglas compostas e filtros C/AP versus C/ AP. Normalizar
  somente vocabulario comum na apresentacao; preservar palavras desconhecidas
  e separadores evita descaracterizar nomes ou tornar opcoes indistinguiveis.
- CI 37033511673 aprovada antes da atualizacao paralela de main d79bf8c.
  Ao integrar manifestos visuais concorrentes, reconciliar registros por caminho
  com JSON, manter proveniencias e validar todos os hashes instalados. Preservadas
  sete imagens Tabelao, duas Associativo e 184 comuns; CI combinada pendente.

## 2026-10-02: Azul noturno e retorno ao dourado no Associativo

- Status: validado e publicado; PR #134, runtime d79bf8c.
- Fonte: pedido posterior do usuario, investor-archive.css e testes de temas.
- A solicitacao mais recente substitui o prata por dourado metalico e pede
  azul quase preto; nao reaplicar #001c54/#002774 por referencia anterior.
- Tokens restritos ao Associativo preservam as outras tabelas. O brilho de 3s
  continua somente na acao pendente e respeita prefers-reduced-motion.
- Testes focados: 28 aprovados, incluindo contraste >=4.5:1 nos fundos escuros
  e em todas as paradas do gradiente dourado. CI 37030093010 aprovou 1369 Vitest,
  oito Node, banco, restore, E2E e matriz funcional completa. Apenas duas
  capturas escuras diferiram, revisadas e promovidas sem alterar tolerancias;
  191 referencias preservadas. CIs 37034089884 e 37037035430 verdes.
- Publicacao por imagem imutavel, onze camadas/dois perfis comprovados,
  backup/CAS/rollback verificados e doze leituras publicas sem erro.
- Navegador autenticado confirmou cores computadas e brilho 3s; selecao local
  descartada ao final, sem salvar proposta. Registro posterior nao muda runtime.

## 2026-10-02: Ordem territorial e falhas transitorias do Tabelao

- Status: pendente_validacao; branch codex/tabelao-regioes-layout, base 727c858.
- CI 37003636668 aprovou 1367 Vitest, oito Node, validacoes de banco/restore,
  E2E e todos os criterios funcionais da matriz autenticada. Sete diferencas
  visuais restritas ao Tabelao foram revisadas e promovidas com proveniencia;
  186 referencias preservadas. CI das referencias/publicacao ainda pendentes.
- Fonte: pedido e capturas do usuario, tabelao-inventory.mjs, tabelao-region.mjs
  e testes de inventario/regiao. A consulta real foi somente observacional.
- Prioridade comercial das regioes: Leste, Sul, Norte, Oeste e Centro. Agrupar
  por regiao antes do nome evita misturar zonas; a chave de apresentacao inclui
  regiao para nao reunir projetos homonimos de localizacoes distintas.
- O rótulo de carga depende de consulta realmente pendente. Timeout/falha nao
  podem continuar indefinidamente como carga nem virar regiao presumida.
- Retry de transporte limitado a uma tentativa depois dos demais lotes, com
  os mesmos tres CEPs por lote; 401/403/400 e contrato contraditorio nao repetem.
- Divergencias atuais eram tipo/titulo do logradouro. CODLOG na camada municipal
  segmento_logradouro por HTTPS comprova identidade, sem remover tokens como
  prova ou criar mapa projeto/zona. Backend local confirmou 22/22 CEPs atuais em
  02/10/2026 08:37 BRT; Itaim Bibi pertence a Oeste mesmo com bairro Brooklin.
- Retry respeita Retry-After com espera abortavel ate dez segundos. Acima do
  orcamento, nao chamar antes do prazo. CEPs excedentes ao limite nao ficam pendentes.
- 405 testes focados, lint do codigo, tipos, build e oito testes Node aprovados.
  Suite Windows: 1361 aprovados, quatro skips e seis falhas POSIX preexistentes.
  Chromium local: nove cenarios aprovados para letras verticais, ordem, filtros,
  colunas compactas e cabecalho rolando, com capturas revisadas. CI autenticada
  e publicacao pendentes; nao usar esta nota como prova de release.

## 2026-10-02: Replica de Calcular documentacao

- Status: pendente_validacao; branch codex/calcular-documentacao.
- Fonte: pedido do usuario e pagina publica /simulacao/calcular-documentacao,
  bundles DocumentationCalculator-BjH7PIsT.js e documentation-calculator-rules-DI3ss1MX.js.
- O modulo lib/archive-investor/documentation-calculator-rules.mjs ja corresponde
  a referencia em 2.048 entradas comparadas, incluindo limites e erros; reutilizar
  sem criar outro motor. Esta evidencia nao homologa a politica como regra oficial.
- A nova replica usa a rota protegida existente e o item antes Em breve no SiteMenu.
  Nao requer habilitar runtime WF16, n8n, migrations ou novas permissoes.
- Conteudo integral inclui ajudas Em construcao, impressao, auditoria e alertas.
- Lint, typecheck, build, 32 testes focados e oito testes Node aprovados. Matriz local
  final: 12 combinacoes sem overflow ou violacoes Axe, impressao e layout de zoom 200%.
- Decoracao com overflow hidden podia gerar scroll interno ao focar e redimensionar;
  overflow clip localizado preserva a geometria. Testar limites internos, nao so o body.
- Suite Windows: 1.271 aprovados, quatro skips e 20 falhas POSIX/timeouts sob carga.
  CI Linux e publicacao pendentes no PR #130; gates nao foram reduzidos.
- CI 36968955807: 1.293 testes Vitest e oito Node aprovados, restore aprovado;
  E2E conservava a expectativa antiga de 403. Ao liberar pagina de arquivo, atualizar
  tambem protectedSurfaces, hub e smoke, preservando perfis negados e APIs oficiais.
- CI 36970005859: validate, restore, 20 E2E (um skip) e matriz dedicada autenticada
  aprovados. Atualizar tambem assertDisabledItems de archive-navigation ao ativar
  um link; simulationLinks sozinho nao remove a expectativa antiga de bloqueio.
  Artefato 11211986933 conferido por SHA-256; nenhum baseline promovido com gate falho.
- CI 36971939367: todos os criterios funcionais aprovados, incluindo 140 responsivos,
  80 de tema, 193 auditorias Axe, 100 de zoom e navegacao 4 rotas x 10 larguras.
  Sete diferencas visuais intencionais do hub foram revisadas e promovidas pelo
  promotor transacional existente; outras 186 imagens preservadas por hash.
  Captura 47318329 tem arvore identica a 5ec9311; artefato 11213300733 validado.
  Nova CI e publicacao pendentes, sem reduzir limite de diferenca ou tolerancia.
- Integracao com main 29a487b: manifestos concorrentes devem ser unidos por caminho,
  preservando imagens e hashes aprovados de cada escopo. Os 186 registros da main
  e sete do hub tem proveniencia separada; isso nao substitui nova CI integrada.

## 2026-10-02: Prata e confirmacao explicita no Associativo

- Status: validado e publicado. PR #129; CIs 36971256999, 36973571026 e 36998281910. Runtime 727c8583ab46a51f81fddb7e0c0ec01b4803a531 inclui o
  Associativo e a integracao paralela, sem reverter trabalho de outro escopo.
- Gate de origem recusou preparar revisao anterior quando a main avancou.
  Reconciliar tip, CI e versao viva antes de CAS; nao contornar a verificacao.
- Imagem imutavel comprovada, backup validado e 12 leituras publicas sem erro.
  Jornada autenticada confirmou etapas sequenciais. Fechamento sem novo runtime.
- Fonte: dezoito prints do usuario, InvestorCalculator.tsx, investor-archive.css
  e ArchiveHeader. Nova direcao visual substitui o dourado da etapa anterior.
- Enquadramento automatico nao equivale a confirmacao do usuario. Renda libera
  modalidade; somente sua confirmacao libera primeiro imovel, sem mudar regras.
- Usar um unico espacamento para padding do formulario e gap das duas colunas;
  recalcular a posicao da orientacao e sua seta com o mesmo token.
- Brilho recorrente de 3s deve depender do estado pendente, ter contorno interno
  e desligar em prefers-reduced-motion. Nao animar o painel inteiro.
- D de marca e cabecalho compartilhados afetam capturas de outras tabelas;
  revisar o escopo completo antes de promover referencias visuais.
- Alterar renda invalida confirmacoes dependentes, inclusive Ranking. QA de
  edicao precisa confirmar novamente, exigindo proposta bloqueada antes disso.
- Tabela de aprovacao conserva alturas fixas legadas com !important: layout
  mobile por regra precisa liberar alturas de tr/th/td, nao apenas quebrar texto.
- Evidencias completas da implementacao e publicacao:
  docs/audits/associativo-prata-2026-10-02.md.
- CI 36968663861: funcional completo aprovado; 44 referencias alteradas
  somente nas quatro tabelas, revisadas por viewport e tema. Promocao canonica
  preserva 149 imagens fora do escopo, mesmo quando ha drift abaixo de 1%.

## 2026-10-02: Capacidade por CEP, nao apenas por lote

- Status: validado (regressao e CI); publicacao pendente; branch codex/tabelao-regioes-fila.
- Fonte: smoke real de 598e117, lib/archive-investor/tabelao-region.mjs,
  tests/inventory-regions.test.ts e docs/runbooks/tabelao-regions.md.
- Tres requests de oito CEPs equivalem a 24 consultas, nao tres. Com mapa frio,
  a fila de cinco segundos descartava CEPs antes dos tres slots serem liberados.
- Cliente usa um lote de tres CEPs, ordenado e progressivo; paginas simultaneas
  compartilham consultas por CEP no servidor. API preserva contrato de oito CEPs.
- Duas regressoes integradas falharam antes e passaram depois; 235 testes focados
  aprovados. CI 36961528199 totalmente aprovada em 825d8a3. Tipos, build, lint
  do codigo e oito testes Node locais aprovados; seis falhas POSIX no Windows.
- Main documental 0ef7b2f integrada, sem mudar runtime; CI conjunta obrigatoria.
  Evidencia final da publicacao e da carga real de regioes sera registrada no PR #128.
- Nao confundir region_lookup_busy com ambiguidade geografica. Contagem de
  requests HTTP reduzida nao basta para provar o comportamento com cache frio.

## 2026-10-01: Regioes e vagas do Tabelao

- Status: pendente_validacao; branch codex/tabelao-regioes-vagas.
- Fonte: pedido do usuario, origem de estoque configurada, ViaCEP, Localiza Sampa,
  GeoSampa WFS; lib/inventory/region-lookup.ts e docs/runbooks/tabelao-regions.md.
- postalCode e parkingSpaces ja chegam da origem HTTP. A consulta atual nao prova
  atualizacao do estoque nem vinculo com uma coluna SQL; preservar generatedAt.
- CEP pode abranger distritos de zonas diferentes. Nao usar primeiro resultado,
  faixas aproximadas de CEP, bairro como distrito ou codigos entre sistemas.
- Localiza Sampa e GeoSampa usam codigos de distrito diferentes. Cruzar os nomes
  oficiais e nm_regiao_05; nao interpretar o codigo de regiao isoladamente.
- Fonte HTML sem API/SLA e apenas HTTP verificado: parse estrutural, contagem de
  linhas, CEP e logradouro cruzados; qualquer conflito fica nao confirmado.
- Cache territorial nao leva sessao; autorizar cada request antes dele. Consultas
  opcionais nao podem sobrescrever endereco, selecoes ou impedir uso do estoque.
- Vagas entram na chave da opcao, no estoque e nas facetas. null nao vira zero.
- 335 testes focados aprovados; sete cenarios Chromium com componente/CSS reais
  passam. Fonte atual: 20/22 CEPs confirmados, dois conflitos mantidos nao confirmados.
- Lint do codigo, tipos, build e oito testes Node aprovados. Windows registra seis
  falhas POSIX e timeouts na suite de conhecimento, sem alterar gates.
- CI Linux 36952238409: 1.279 Vitest e oito Node aprovados, quatro skips;
  formato, lint, tipos, build, banco, restore isolado e E2E aprovados.
- Matriz funcional passou (140 rotas, 80 temas, 193 axe, 100 zoom). Sete capturas
  do Tabelao revisadas e promovidas; outras 186 preservadas. PR #125, captura
  dd373aa e codigo 02074e7. CI final e publicacao pendentes; fechamento no PR.
- CI 36954481187 passou integralmente em 805e0ca. Integrada main ef0a2fb
  (guia do Associativo, PR #126), preservando seus arquivos e as referencias
  visuais. Nova CI conjunta e publicacao pendentes; nenhum deploy desta etapa.

## 2026-10-01: Cabecalhos e alinhamento do Tabelao

- Status: pendente_validacao; branch codex/tabelao-cabecalhos-centralizados.
- Fonte: pedido e captura do usuario, TabelaoClient.tsx, investor-archive.css,
  scripts/qa/authenticated-visual.mjs e auditoria tabelao-cabecalhos-2026-10-01.
- Titulo e corpo devem compartilhar o tamanho de fonte. Remover regras de
  4/6px, permitir altura automatica e manter limites de largura para quebra.
- Mover uma coluna exige atualizar colgroup, thead e tbody juntos. Com rowspan,
  td:first-child nao identifica a primeira coluna logica; conferir padding e
  geometria das celulas pelos headers depois de filtros e ordenacao.
- Centralizacao inclui th de rowgroup, td, titulos e wrappers de texto.
- Sete cenarios locais aprovados, com componente/CSS reais e fixtures; colunas
  compactas mantidas em 115/145/73px externos, sem corte de texto ou overflow.
  Typecheck e 55 testes focados aprovados; 992 testes Windows aprovados,
  quatro skips e seis falhas POSIX conhecidas. Build e lint do codigo aprovados.
  CI 36916047513 aprovou Linux, banco, restore, E2E e toda a matriz funcional.
- Sete capturas revisadas com fontes reais e tres temas, apenas do Tabelao;
  promocao canonica preservou as outras 186 referencias e os limiares 1%/16.
  CI final 36919972124 aprovada; main f1d71da integrada posteriormente sem
  sobrescrever o Associativo. Catalogo conciliado por rota com proveniencia;
  capturas preservadas. Nova CI conjunta/publicacao pendentes, fechamento no PR #123.

## 2026-10-01: Proxima acao dourada no Associativo

- Status: publicado_verificado_2026-10-02; runtime 598e1171; PR #126.
- Fonte: nove capturas e pedido do usuario; referencias publicas somente leitura,
  InvestorCalculator.tsx, investor-archive.css e auditoria guia-dourado.
- Dourado indica etapa atual, sem mudar as paletas azuis. Nao destacar a linha
  Financiamento enquanto o Perfil estiver incompleto: usar estagio qualification.
- Borda pulsante com scale ultrapassava o ledger. Usar pseudo-elemento interno
  inset 0, border-box, sem transform; manter popovers e foco acessiveis.
- Quantidade precisa reservar a mesma coluna de 26px do prefixo R$; igualar
  apenas wrappers nao igualava a largura das caixas de edicao.
- % Maximo da renda mensal e mudanca de rotulo, nao de regra. Manter indicadores
  de maior mensal e maior mensal + Evolucao de Obra distintos e atualizar ajudas.
- Estilos legados de background-clip/text-fill podem manter o $ azul mesmo com
  color dourado; verificar a pintura efetiva, nao apenas computed color.
- Inputs iguais no desktop nao devem diminuir alvos mobile: manter 44px.
- `hasTouch` isolado nao comprovou ponteiro coarse neste host. Usar contexto
  mobile real e conferir media query; neutralizar transform legado fora do hover.
- Jornada visual 6/6, mesma pagina 3/3 e coarse real/desktop 2/2. Suite Windows
  com limites POSIX registrados; CI Linux do PR 36954146586, main 36956549122 e
  integrada 36958962302 aprovadas. Nenhum gate enfraquecido.
- Main avancou com PR #125 do Tabelao; publicar descendente validado em vez
  de sobrescrever o trabalho concorrente. Imagem/backup/CAS/rollback verificados,
  12 GETs sem erro e pagina autenticada carregada. Referencias permaneceram intactas.
- Fonte final: docs/audits/associativo-guia-dourado-2026-10-01.md. Encerramento
  documental nao requer outro deploy nem prova de capacidade em producao.

## 2026-10-01: Layout inicial e FAQ do Associativo

- Status: validado; runtime f1d71da81a21cf139acc26b95a6cacc218b79325.
- Publicacao: PR #122, CI final do PR 36919448507 e CI main 36923454213 verdes.
  Imagem imutavel verificada em onze camadas e dois perfis, com backup/CAS/rollback.
- Fonte: quatro capturas e material de FAQ fornecidos pelo usuario;
  investor-archive.css, AssociativeLearningManual.module.css e QA compacto.
- Compactacao reduz margens e remove contorno duplicado dos filtros, sem
  overflow:hidden global, sem truncar estoque e sem alterar altura virtual.
- Guia usa largura intrinseca; ouro metalizado aplica-se a hover, foco e selecao.
- Paineis usam contornos de 6/8px, sem sombras amplas ou brilho continuo do guia.
- Anexo educacional nao e politica comercial: preservar exemplos e ressalvas,
  verificar fontes oficiais e explicitar divergencias com o runtime vigente.
- Previa em 1280x580 coube sem rolagem global; CI verifica esse tamanho e os
  tres temas antes de qualquer selecao. Nao misturar essa verificacao com o
  estado de proposta aberta, que deve conservar rolagem normal.
- CI 36915441302 aprova Linux (1.006 testes, quatro skips condicionais e oito
  Node), banco, restore, E2E, 40 navegacoes, 193 axe, zoom/teclado e manual
  em 30 capturas. Onze diferencas exclusivas do Associativo foram revisadas
  e promovidas pela rotina canonica; demais 182 referencias preservadas.
- Lint, tipos e build locais aprovados; seis falhas Windows de POSIX/symlink
  nao reproduziram na CI Linux. Publicacao e verificacao pos-deploy concluidas.
- Health local/publico confirma a release; doze GETs anonimos sem erros, com
  estoque e snapshot protegidos por 401. Esse smoke nao comprova capacidade.
- UI autenticada em 1280x580: zero rolagem global nos tres temas, dez linhas,
  guia 32px com 25,33px de folga total e card 8px. Ouro metalizado confirmado
  por foco, sem selecionar unidade real. Guia/Escape/retorno de foco aprovados.
- Em viewport muito baixo, preservar acesso ao conteudo: 1280x529 exigiu 16px
  de rolagem. Nunca esconder overflow global para simular uma tela que cabe.
- Console sem erros/avisos; nenhuma proposta alterada. Evidencia completa em
  docs/audits/layout-manual-associativo-2026-10-01.md. Registro documental sem restart.

## 2026-10-01: Alinhamento do fechamento do Associativo

- Status: validado; runtime 5878c3bce83990496d886c3311527724beb7d9f9.
- Fonte: captura e pedido do usuario; AssociativeTableArchive.tsx,
  investor-archive.css, PR #120, CI main 36881065033, health, navegador
  autenticado e docs/audits/rodape-associativo-2026-10-01.md.
- O aviso preliminar e o contato pertencem a uma grade comum alinhada pelo topo;
  abaixo de 760px passam para uma coluna, sem sobreposicao ou overflow horizontal.
- Navegador local com dados sinteticos mediu 0px de diferenca no desktop e
  empilhamento correto no celular, sem erros ou avisos no console.
- Matriz de navegacao 40/40 aprovada nos quatro simuladores, tres temas e dez
  larguras por rota, sem erros de runtime.
- CI 36862800456 aprovou validacao Linux, banco, E2E e restore isolado. Tres
  diferencas visuais esperadas em 768, 1024 e 1280px foram inspecionadas e
  promovidas pela rotina canonica; outras 190 referencias foram preservadas.
- Lint, tipos, teste focado e build aprovados. Suite Windows: 994 aprovados,
  um skip e sete falhas de POSIX/symlink ou timeout Chrome; CI Linux aprovada.
- Imagem imutavel com onze camadas e dois perfis, backup/CAS/rollback verificados.
  Doze GETs anonimos sem erro nao provam capacidade. UI publicada confirmou 0px
  no desktop e empilhamento correto no celular, sem console ou selecao de unidade.
- Preservar textos, tres temas, estoque, simulacao e demais rotas.
- Este registro documental deve ser integrado e sincronizado sem novo deploy.

## 2026-10-01: Filtros compactos publicados e conferidos

- Status: validado; runtime de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c.
- Fonte: PR #118, CI main 36807945046, health e navegador autenticado;
  docs/audits/filtros-associativo-2026-09-30.md.
- CI integral verde; imagem imutavel, onze camadas/dois perfis, backup e CAS.
- UI real confirma titulo a 8px do menu, guia de 32px, ajudas alinhadas,
  metadados a esquerda de Limpar filtros e dez linhas, sem overflow da pagina.
- Guia/ajuda/Escape/foco passaram; nenhum erro de console. Sem selecionar
  unidades reais ou alterar propostas. Doze GETs anonimos passaram; nao prova carga.
- Preservar navy/azuis e selecao dourada. Para layouts compactos, conferir
  tambem fonte real e proposta aberta em tablet, nao somente estado inicial.
- Resultado apenas documental: publicar no Git e sincronizar sem novo deploy.

## 2026-09-30: Estoque Associativo compacto e selecao dourada

- CI 36800158280: gates funcionais, banco, restore, E2E, 40 navegacoes,
  193 axe e zoom aprovados. Onze capturas revisadas/promovidas, exclusivas
  do Associativo; demais 182 e thresholds preservados. CI final/deploy pendentes.

- Proposta selecionada: regra antiga movia a ajuda para segunda linha em
  561-1100px com cabecalho fixo de 40px. Mantem a ajuda na terceira coluna;
  QA exige botao contido e sem colidir com titulo/conteudo seguinte.

- CI 36798139339 aprova E2E; falha visual em 768px mostrou o guia em duas linhas.
  Largura em vw encolhia o texto junto da ajuda. Usa 260px limitado ao conteiner;
  conferir fontes reais, nao apenas fallback Arial, antes de homologar geometria.

- CI 36797025028: validacao Linux, banco, restore e concorrencia sintetica passam.
  E2E exigia Filtros do estoque; contrato atualizado para ajuda/acao no cabecalho.
  Matriz local completa passou em 40 navegacoes/tres temas. CI integral pendente.

- Status: pendente_validacao; branch codex/associativo-filtros-compactos.
- Fonte: nove capturas do usuario, InvestorCalculator.tsx, CSS com escopo
  Associativo e docs/audits/filtros-associativo-2026-09-30.md.
- Selecao persistente usa o mesmo dourado do hover/foco, com texto escuro.
- Limpar filtros fica no cabecalho, metadados a esquerda; ajuda ao lado de
  Escolha a unidade. Sem Guia completo ou Filtros do estoque redundantes.
- CSS compartilhado tem sobrescritas tardias: conferir geometria renderizada,
  altura dos campos no celular e alinhamento dos icones; nao alterar outras rotas.
- Preservar propostas ao limpar filtros, dez linhas e estoque virtual completo.
- Local: lint/tipos/build, 30 combinacoes de geometria e dois contextos de toque
  aprovados. Obsidian 22/22 na reexecucao; seis limitacoes POSIX exigem CI Linux.
- CI, revisao visual e publicacao pendentes. Nao confundir codigo com release.

## 2026-09-30: Topo compacto publicado e conferido

- Status: validado; runtime 843fd113a3a1f6b6fd3b6b12b6de58de180256ce.
- Fonte: PR #116, CI main 36780351488, health e navegador autenticado;
  docs/audits/topo-associativo-2026-09-30.md.
- Titulo e Guia completo ficam a 8px da linha do menu; botao 36px em ponteiro
  preciso e 44px em toque. Mantem tres paletas e tamanho do titulo.
- CI integral aprovada; imagem imutavel com onze camadas e dois perfis comprovados,
  backup/CAS/rollback preservados. Doze GETs anonimos sem erro; nao prova carga.
- UI publicada confirmou geometria, guia, Escape, retorno de foco e nenhum erro
  de console. Usa nova aba sem recarregar a aba de trabalho; nao altera propostas.
- Registro documental: publicar no Git e sincronizar sem reiniciar a aplicacao.

## 2026-09-30: Alinhamento superior do titulo e guia

- CI 36774530982 aprovou testes Linux, banco, restore, E2E, navegacao e axe.
  Onze capturas revisadas e promovidas; demais 182 preservadas. Comparador
  continua em 1%/16 por canal. CI final e publicacao ainda pendentes.
- Status: pendente_validacao; branch codex/topo-associativo-compacto.
- Fonte: pedido e duas capturas do usuario; investor-archive.css e contrato
  scripts/qa/associative-compact-layout.mjs.
- Escopo somente Associativo: titulo e guia alinhados pelo topo, margem de 8px
  apos o menu e entre linhas no celular; botao 36px, com 44px para ponteiro coarse.
- Preservar as tres paletas, altura do menu e regras financeiras. Validacao
  deve conferir geometria real, toque, guia funcional, temas e zoom.
- Geometria: 30 combinacoes largura/tema e dois contextos de toque aprovados.
  Guia/Escape/foco/axe passaram em desktop/celular. Lint/tipos/build aprovados;
  Windows 994 testes aprovados, um skip, seis falhas POSIX. Oito testes Node passaram.
- CI Linux, referencias visuais e publicacao pendentes; nao interpretar
  implementado como publicado. Evidencia: docs/audits/topo-associativo-2026-09-30.md.

## 2026-09-30: Compactacao publicada e verificada

- Status: validado; runtime d9c2bee07fd6304006e28e357bf8e918a2031bf4.
- Fonte: PR #114, CI main 36764731943, health e navegador autenticado;
  docs/audits/compactacao-associativo-2026-09-30.md.
- Estoque Associativo mostra dez unidades por vez sem limitar resultados.
  Hover/foco dourado; passo virtual alinhado a 26px/48px no breakpoint 760px.
- Cabecalho compartilhado 56px em desktop/tablet; temas sem caixas, com texto,
  icones e sublinhado ativo. Titulo Associativo 2rem desktop e 1.475rem mobile.
- Mantem azul-marinho e tres paletas. Next 16.3.6 atende advisory critico; gates
  completos aprovados. Foco do menu preservado mesmo quando CSS oculta o controle.
- Publicacao com imagem imutavel, backup/CAS/rollback e dois perfis comprovados.
  Doze GETs anonimos sem erro, sem prova de carga. Confirmacao UI sem propostas
  ou dados alterados; nova aba evita descartar trabalho na aba do usuario.
- Registro apenas documental: publicar no Git e sincronizar sem reiniciar runtime.

## 2026-09-30: Dez linhas e cabecalho compacto

- Evidencia: CI 36758571149 aprovou gates funcionais, 40 navegacoes, 193 axe e
  100 zoom. Revisa/promove 44 capturas e preserva as demais 149/thresholds.
  Preview final 40/40; Next 16.3.6 com lint/tipos/build/audit aprovados.
  CI das referencias e publicacao ainda pendentes.
- CI 36757589260 bloqueou Next 16.3.3 por advisory critico atualizado em 30/09;
  patch oficial 16.3.6. Revalidar deps mesmo quando o commit anterior passou.
- matchMedia pode receber change apos o browser desfocar o controle oculto.
  Menu preserva ultimo foco interno, limpando referencia ao interagir fora.
- Status: pendente_validacao; branch codex/compactacao-associativo.
- Fonte: quatro capturas e pedido direto do usuario; auditoria de compactacao.
- Dez unidades visiveis significa viewport limitado, sem truncar estoque.
  Alinhar alturas CSS e passo virtual: 26px desktop, 48px ate 760px.
- Dourado reservado ao hover/foco da linha selecionavel; preservar temas azuis
  e fundo Escuro original. Temas sem caixas e com indicador textual de selecao.
- Cabecalho compartilhado compacto; titulo reduzido apenas no Associativo.
- Lint/tipos/build passaram; Windows com seis falhas POSIX e um timeout DevTools.
  Reteste isolado DevTools passou. QA integrado e publicacao pendentes.
  Sem alteracao financeira; aguardar transicoes CSS antes de conferir cores.

## 2026-09-30: Correcao azul publicada e confirmada

- Status: validado; runtime b55fa6fc95eb26087c70736d618bf019818c5876.
- Fonte: PR #112, CI main 36734239866 aprovada, health publico e navegador
  autenticado; docs/audits/cores-azuis-2026-09-30.md.
- Nos tres temas, marca, destaques e positivos sao azuis. Escuro preserva a
  pagina #061f35 e o cabecalho #071a31. Nao redesenhar essa base sem novo pedido.
- Imagem imutavel comprovada, dois perfis aprovados, backup/CAS/rollback
  preservados. Nenhuma mudanca de formulas, dados, banco, contas ou n8n.
- Navegador confirmou os tres temas e estoque carregado; zero erros de console
  observados. Smoke de doze GETs e quatro concorrentes passou, sem prova de carga.
- Conhecimento final documental; nao reiniciar o runtime ao integrar esse registro.

## 2026-09-30: Preservar o azul-marinho; retirar verdes

- Status: pendente_validacao; branch codex/temas-azul-original.
- Fonte: correcao direta do usuario e paleta anterior no commit 96410f9.
- Preferencia explicita: nao substituir a base azul-marinho do modo escuro.
  Nos tres temas, destaques e estados antes verdes devem ser azuis.
- Correcao restrita aos tokens dos quatro simuladores e cabecalho compartilhado,
  sem novo redesign nem alteracao financeira. Erros e avisos seguem distinguiveis.
- Testes de contrato protegem fundos originais, paleta azul e contraste.
- Evidencia: docs/audits/cores-azuis-2026-09-30.md; lint/tipos/build locais e
  preview 40/40 aprovados. Timeouts DevTools passaram no reteste isolado.
  Seis testes POSIX exigem Linux; validate e restore da CI 36726351781 passaram.
  Matriz: 40 navegacoes, 193 auditorias axe e 100 cenarios de zoom aprovados.
  Revisa e promove 44 referencias afetadas; preserva as demais 149 e limites.
  CI integrada das referencias e publicacao pendentes.
- A promocao canonica pode gerar JSON fora do estilo Prettier: formatar o
  manifesto e executar seus contratos antes do push. CI 36730344413 mostrou
  essa diferenca de formatacao; nao alterar evidencias para corrigi-la.

## 2026-09-30: Identidade publicada na web

- Status: validado; runtime 2c002df10fa2777165fec5b96f707ed971422e74.
- Fonte: PRs #109/#110, CI main 36667629540 aprovada, health publico e navegador
  autenticado em crm.descomplicapro.com.br; auditoria de identidade versionada.
- Imagem imutavel conferida por checksum, config, manifesto e onze camadas;
  dois perfis de runtime aprovados. Backup privado, CAS e rollback preservados.
- Marca sem Inteligencia comercial; Claro/Medio/Escuro, menu/Escape e estoque
  confirmados no Associativo publicado, sem erros de console observados.
- Smoke anonimo somente leitura: doze GETs com concorrencia quatro, health 200
  na nova versao, inventory/snapshot 401 e no-store, zero falhas.
- Limites: nao houve benchmark de capacidade nem mutacao de propostas/dados.
  Navegacao nas quatro rotas, temas, acessibilidade e zoom validados na CI.
- Atualizacoes deste registro sao documentais; nao reiniciar a aplicacao por elas.

## 2026-09-30: Auditoria pode mudar entre PR e main

- Status: pendente_validacao; branch codex/correcao-auditoria-identidade.
- Fonte: CI PR 36662908716 aprovada; merge 83f1b2f; CI main 36664719186 bloqueada
  por brace-expansion. Advisories GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p e
  GHSA-q2hr-2g5m-vwhr consultados na base oficial GitHub em 2026-09-30.
- Atualiza somente as duas resolucoes para 1.1.21 e 5.0.12. Instalacao frozen
  e politica supply-chain aprovadas; audit passou sem vulnerabilidades conhecidas.
- A CI do PR nao dispensa a CI do SHA final. Nao ignorar auditoria nem publicar
  imagem antiga quando um novo advisory aparecer. Producao permanece inalterada.
- Reteste local: lint, tipos e build aprovados; 987 testes passaram, um skip
  e seis falhas POSIX preexistentes no Windows. Nao alterar essas assercoes.
- Pendente: CI Linux integrada, imagem imutavel e publicacao.

## 2026-09-30: Validacao da identidade e referencias

- Status: pendente_validacao; branch codex/identidade-navegacao-temas.
- Fonte: CI 36660701681, captura e985f6791de4dfd5681cc47429a6d5f06bc61d25,
  docs/audits/identidade-navegacao-2026-09-29.md e authenticated-results.json.
- Linux, banco, advisors, restore e E2E aprovados. Navegacao 40/40,
  acessibilidade 193 e zoom 100 aprovados; somente 44 diffs visuais previstos.
- Capturas inspecionadas apos corrigir temas/tablet e filtros/mobile;
  44 referencias promovidas, outras 149 preservadas, sem afrouxar thresholds.
- Reteste local: 63 testes focados e preview 40/40 com cookies reais;
  revisao estatica independente sem novos achados. Preview usa dados sinteticos.
- Pendente: CI integrada das referencias, merge e publicacao com imagem imutavel.

## 2026-09-29: Identidade e navegacao dos simuladores

- Status: pendente_validacao; branch codex/identidade-navegacao-temas.
- Fonte: ArchiveHeader.tsx, SiteMenu.tsx, ThemeSwitch.tsx e auditoria de identidade.
- Cabecalho compartilhado substitui quatro copias de marca; remove subtitulo.
- Navegacao compacta usa estado independente dos popovers para que abrir
  um submenu nao feche o pai. Escape fecha um nivel por vez e restaura foco.
- Em accordion, fechar no pointerdown pode deslocar o proximo acionador antes
  do click. Fronteira de dismiss compartilhada preserva o gesto e a exclusao
  mutua; nao alterar globalmente todos os popovers por esse caso.
- Temas permanecem visiveis e so persistem com consentimento funcional.
- CSS legado fixava cores escuras nos simuladores; trocar apenas data-theme
  nao comprova aplicacao visual do tema. Validar tambem conteudo e controles.
- Primeira rodada: tipos/build aprovados, 57 contratos das tabelas aprovados;
  22 testes Obsidian passaram isolados apos dois timeouts por concorrencia.
- Preview: 40 combinacoes de rota/largura e tres temas do cabecalho aprovados.
  CI Linux 36650605575 passou validacao, banco, restore e E2E autenticado;
  matriz parou em sete checks de navegacao (seis cores durante transicao e
  um timeout de clique). Gate agora espera a cor final e guarda diagnostico
  incremental. Nova matriz/publicacao pendentes; nenhuma baseline promovida.
  Preview completo posterior: 40/40, tres temas e zero erros de navegador,
  incluindo Direta/320. Fonte: test-results/identity-full-preview.json local.
  Sem alteracao financeira.
- CI 36653241052: navegacao 39/40; atalho global de cookies interceptava clique
  na Direta/320. Camadas corrigidas para atalho < navegacao < painel de cookies.
  Seis testes do gate aprovados; CUA confirmou troca de submenu e abertura/
  fechamento de preferencias com o componente real no preview. CI final pendente.
- CI 36655323860 aprovou 40 navegacoes, 193 auditorias de acessibilidade e 100
  cenarios de zoom; diferencas visuais limitadas a 44 capturas dos simuladores.
  Inspecao manual identificou largura legada de 44 px nos temas/tablet e colisao
  de Limpar filtros na Direta/mobile. Correcoes e checks geometricos adicionados;
  nao promover capturas anteriores com esses defeitos. Nova CI obrigatoria.

## 2026-09-29: Colunas compactas e celulas repetidas do Tabelao

- Status: validacao local concluida; CI/publicacao pendentes; branch codex/tabelao-colunas-compactas.
- Fonte: TabelaoClient.tsx, investor-archive.css e tabelao-inventory.mjs.
- Textos de empreendimento, endereco e limitador passam a quebrar em larguras
  delimitadas. O min-width da tabela nao deve redistribuir espaco excedente.
- Mesclar rotulos consecutivos somente depois de agrupar por empreendimento e
  incorporadora. Nao excluir plantas nem unir A/B/A atraves de um valor distinto.
- Testes focados iniciais: 62 aprovados. Lint, tipos, build e Gitleaks aprovados.
  Suite Windows: 978 aprovados, quatro skips e seis falhas POSIX preexistentes;
  oito testes Node aprovados. Navegador sintetico local passou em sete cenarios,
  revisao independente sem achados; 75 testes focados finais aprovados.
  CI 36526268323: 984 testes Linux, matriz funcional/acessibilidade e restore
  aprovados. Sete referencias do Tabelao inspecionadas e atualizadas, com
  proveniencia por imagem; outras 186 preservadas. Nova CI e publicacao pendentes.
  Evidencias: docs/audits/tabelao-colunas-2026-09-29.md.

## 2026-09-29: Cabecalho compacto do Associativo

- Status: validacao local e inspecao visual concluidas; nova CI integrada e publicacao pendentes.
- Fonte: AssociativeTableArchive.tsx e investor-archive.css.
- Remove somente a trilha e o rotulo redundantes do topo; preserva H1, ajuda e guia.
- Espacamento reduzido fica limitado a investor-associative-table-page.
- Captura autenticada da CI 36520154289 validou navegacao, acessibilidade,
  teclado, zoom e responsividade; onze referencias exclusivas do Associativo
  foram inspecionadas e promovidas.
- O teste do catalogo passa a reconhecer as vinte verificacoes do Tabelao que
  o capturador atual ja executava; nenhuma referencia visual do Tabelao mudou.
- Teste especifico, lint, tipos, inventario e build aprovados. Suite Windows:
  972 aprovados, um skip e seis falhas POSIX preexistentes; nova CI Linux exigida.

## 2026-09-28: Tabelao e indisponibilidade concorrente

- Status: validacao local concluida com limitacao POSIX; branch codex/tabelao-concorrencia.
- Fonte: app/api/inventory e snapshot; TabelaoClient; tabelao-payload.ts;
  docs/audits/tabelao-concorrencia-2026-09-28.md.
- Deduplicar somente promessas em andamento nao contem consultas sucessivas
  quando a origem falha rapidamente. O intervalo de cinco segundos deve comecar
  na falha compartilhada, sem ser prolongado por cada novo acesso.
- Cada acesso continua autorizado antes do cache ou erro compartilhado; nunca
  reutilizar sessao nem devolver estoque vencido como recuperacao.
- Deadline da pagina inclui leitura do corpo; cancelamento de uma pagina nao
  pode cancelar a consulta compartilhada de outros usuarios no servidor.
- Lint, tipos, build e formatacao aprovados. Windows: 967 testes aprovados,
  quatro skips condicionais e seis falhas POSIX preexistentes. Endpoints:
  92 testes aprovados; payload exercita trinta consultas isoladas. Gitleaks
  passou. Gates Linux, navegador e publicacao pendentes; consultar auditoria/PR.

## 2026-09-28: Conteudo e ajudas do Associativo

- Status: pendente_validacao integrada/publicacao. Base publicada: b297614.
- Fonte: associative-learning-content.ts, InvestorCalculator e auditoria
  docs/audits/associativo-manual-conteudo-2026-09-28.md; referencias oficiais nela.
- Perfil e manual compartilham tres ajudas. Guia possui 27 topicos e seus locais.
- Indicador "Maximo da renda por anual" exclui a anual mesmo quando o total
  da mesma linha mensal a inclui. Descrever exatamente o indicador, nao como
  comprometimento global de todas as despesas da familia.
- Motor local e WF13 versionado nao sao equivalentes. Perfil/documentacao usam
  bases diferentes e podem divergir de modalidade perto dos limites. Explicar
  essas limitacoes; nao alterar calculos em pedido exclusivamente editorial.
- ITBI e registro sao estimativas locais; primeiro imovel declarado nao e prova
  de primeira aquisicao nem garantia de isencao. Exigir conferencia oficial.
- Testes: 145 de dominio e cinco do manual aprovados. Suite Windows: 950 pass,
  um skip, seis falhas POSIX preexistentes. CI Linux e QA final ainda exigidos.
- Lint, tipos, build, oito testes Node e QA isolado (30 capturas/axe) aprovados.
  Matriz integrada deve confirmar o mesmo comportamento no build autenticado.
- Evidencias finais de CI e release devem ficar no PR da branch
  codex/associativo-manual-conteudo, sem inferir publicacao deste checkpoint.

## 2026-09-28: Manual Associativo com abas acessiveis

- Atualizar uma imagem revisada exige atualizar seu tamanho/hash no catalogo
  authenticated-results.json. Registrar origem por baselineRevision e manter
  delta anterior real; o teste de integridade nao deve ser enfraquecido.

- Status: comportamento validado na CI 36486887891; referencia visual atualizada
  para o menu corrigido. Evidencias finais de CI/publicacao: PR #104.
- Fonte: AssociativeLearningManual.tsx/module.css; InvestorCalculator;
  docs/audits/associativo-manual-2026-09-28.md.
- Isolar a moldura interativa do manual preserva textos e os outros simuladores.
  Manter abas e fechar fora da area rolavel evita perder a navegacao em celular.
- Ancoras policy/faq sao preservadas quando o componente esta montado; a
  selecao da unidade continua sendo previa aos recursos finais da simulacao.
- Testes: tres unitarios novos aprovados; lint, tipos e build locais aprovados.
  Windows: 948 pass, um skip e seis falhas POSIX preexistentes. CI Linux exigida.
- Matriz acrescentada: cinco viewports, tres temas, ambos os paineis,
  teclado, foco, ancoras, axe, geometria e capturas. Evidencias em test-results.
  Rodada local isolada do componente passou com 30 capturas e zero violacoes
  axe; oito testes Node tambem passaram. Sem dados ou credenciais de producao.
- Sem alteracao de calculos, politica comercial, backend, migrations ou n8n.
- QA deve aguardar o evento nativo close para validar efeitos posteriores ao
  fechamento; hidden/foco podem ocorrer antes da limpeza da ancora.
- O manifesto Next carrega CSS legado apos o modulo: regras de titulo/foco
  precisam de especificidade suficiente, nao apenas da ordem dos imports.
- Tema intermediario no SiteMenu do arquivo chama-se Medio; no shell geral,
  Equilibrado. A matriz do manual usa o controle local, preservando a proposta.
- CI 36483450994 identificou corte preexistente do menu em 1024px; reproduzido
  no navegador publicado. Cabecalho Associativo passa a duas linhas entre
  821 e 1100px, sem alterar os demais simuladores. QA mede o seletor de tema;
  referencia de 1024px requer atualizacao visual justificada, sem relaxar gates.
- CI 36486887891: 30 capturas/axe do manual aprovadas; matriz funcional inteira
  aprovada. Unica divergencia foi a imagem 1024x768 do cabecalho corrigido,
  inspecionada e atualizada com hashes/proveniencia no relatorio. Demais 192
  comparacoes preservadas; nova CI confirma a referencia. Consultar evidencias
  do PR #104 para o estado final, nao inferir deploy deste checkpoint.

## 2026-09-28: Associativo, estoque e publicacao automatica

- Status: validado; PR #102 integrado e release 3d92b7a publicada em 15:01 UTC.
- Fonte: docs/audits/associativo-concorrencia-2026-09-28.md; rotas inventory;
  calculator-rules, approval-rules, installment-memory e testes de concorrencia.
- HTTP 200 nao comprova corpo recebido: duas aberturas falharam com transferencias
  parciais e timeout de 25 segundos. Compressao so nas duas rotas autorizadas.
- Identidade ausente/duplicada nao deve enriquecer valores financeiros.
  Validar payload antes do cache e cada usuario antes de compartilhar resposta.
- Validar parcelas antes de alocacao; calendario estrito, indices anuais reais
  e comparacao monetaria em centavos, inclusive painel e sugestoes.
- CI integrada detectou clamp assincrono de parcelas: invalidade precisa
  permanecer visivel, nao ser aceita em um estado transitorio de um frame.
- Usuario reiterou autorizacao permanente de publicar alteracoes concluidas
  apos validacao em qualquer chat deste Git comum. Persistida nas instrucoes
  globais delimitadas ao projeto e automatic-publication.md. Sem ampliar
  permissoes para DNS, contas, cobrancas, migrations ou dados remotos.
- Concorrencia usa identidades/dados sinteticos locais; nao prova capacidade
  de producao. Build da imagem ocorre no runner CI, nao no VPS.
- CI 36437130674: 948 Vitest, oito Node, 1.042 pgTAP e 20 E2E aprovados;
  restore, lint, tipos e build passaram. Quatro sessoes, 20 chamadas simultaneas
  e zero erros em ambiente sintetico; nao equivale a 20 usuarios distintos.
- Producao: estoque autenticado carregou, duas respostas comprimidas completas,
  12 sondagens de leitura sem erro e acesso anonimo negado. Quantidade extrema,
  anual acima do limite e preservacao de proposta conferidas na pagina publicada.
- Docker classic identifica config; containerd identifica manifesto. Nao
  comparar digests de tipos distintos nem ignorar diferenca: provar checksum,
  ligacao manifesto/config, plataforma, label e camadas; revalidar dois perfis
  e registrar ID do host antes do CAS. Prova e hashes no relatorio de auditoria.
- Pendencias: fonte live informa 07/08/2026; transporte funcionando nao comprova
  atualidade comercial. Divergencia preexistente de autoridade entre WF13
  oficial e arquivo nao autoriza substituir formulas.

## 2026-09-28: Caveman automatico e regressao do estoque

- Status: validado (local; gates Linux vinculados ao PR, sem publicacao).
- Fonte: PR #101; docs/audits/caveman-ferramentas-2026-09-28.md; FERRAMENTAS.md;
  InvestorCalculator.tsx; rota inventory/snapshot; testes e QA sintetico.
- Caveman Lite rege concisao, nao exatidao financeira; Cavecrew complementa os
  sete agentes crm-\* existentes. Onze skills locais constam no inventario.
- Next DevTools/Chrome DevTools sao diagnosticos locais, sem contas novas,
  telemetria, CrUX ou conexao a navegador pessoal. MCP configurado nao implica
  ferramenta carregada no chat atual; conferir em nova sessao e usar runbook.
- Filtrar nao inicia proposta: somente selecao da unidade bloqueia substituicao
  pela fonte viva. Filtrar/limpar deve preservar unidade e valores preenchidos.
- Snapshot frio precisa compartilhar leitura em andamento e limpar falhas para
  retry, sempre apos autorizacao individual; no-store e integridade preservados.
- Vitest 4.1.11 aprovado no PR #65 e integrado; nao migrar major sem necessidade.
- Testes Windows: 806 aprovados, seis falhas POSIX preexistentes e um skip;
  oito testes Salesforce passaram separadamente. Lint/tipos, inventario, MCPs,
  Gitleaks, pnpm audit e OSV passaram; scanners sem achados conhecidos apos
  corrigir o SDK transitivo do Next MCP para 1.30.1. Sem ignores de seguranca.
- Pendencias: gates finais desta branch, fontes/politicas de negocio e eventual
  publicacao explicitamente autorizada. Nenhum ganho percentual foi medido.

## 2026-09-28: prontidao e selecao das ferramentas

- Status: validado (instalacoes e verificacoes locais; gates Linux vinculados ao PR).
- Fonte: scripts/knowledge/doctor.mjs; tests/project-resource-doctor.test.ts;
  catalogo de plugins; releases oficiais Gitleaks v8.30.1 e OSV-Scanner v2.6.0.
- Codex Security agora consta instalado/habilitado, atualizando a observacao
  historica anterior. Selecionar skill por alvo, cumprir preflight e preservar
  aprovacoes; nao acionar scans completos em tarefas sem demanda de seguranca.
- Gitleaks/OSV instalados em ~/.local/bin no Windows, com hashes verificados.
  secrets passou; OSV encontrou somente o advisory moderado GHSA-82fw-gwwq-j7x9
  em Vitest/@vitest/mocker 4.1.10, rastreado no PR #65; achado nao foi suprimido.
- resources:doctor distingue disponibilidade local de autenticacao e testes.
  Docker nao instalado neste desktop; gates isolados continuam na CI Linux.
- Doctor real, 16 testes novos, 26 de conhecimento/inventario, lint, tipos,
  build e formatacao passaram. Suite geral Windows tem seis falhas POSIX
  preexistentes; um timeout inicial nao repetiu com dois workers. Oito testes
  Node Salesforce passaram separadamente; CI Linux valida o candidato integral.
- Revisao independente corrigiu falsos positivos de Supabase sem binario e
  scanner antigo. O diagnostico exige CLI Supabase na versao do pacote e
  Gitleaks 8.19+ serie 8 / OSV serie 2; novos majors precisam ser validados.
- Perfil crm-qa aplicado em delegacao real e inventario validado: 40 arquivos,
  nove areas, sete perfis e quatro skills. Nao foram executados todos os perfis.
- Pendencias: conferir conexoes quando forem usadas; MCP n8n nao exposto nesta
  sessao, sem alteracao de workflow nem fallback REST. PostHog/Datadog opcionais
  nao equivalem a telemetria do CRM configurada. Sem SDK, conta nova ou deploy.

## 2026-09-28: recursos e busca entre chats

- Status: validado (mecanismo e instalacao local; gates Linux vinculados ao PR).
- Fonte: PR #99 (recursos-memoria-crm); docs/audits/recursos-crm-2026-09-28.md; scripts/knowledge;
  tests/obsidian-knowledge.test.ts; tests/project-resources.test.ts.
- Conhecimento compartilhado e documental: agentes registram aprendizados,
  nao conversas completas. knowledge:search recupera trechos do checkout e
  aprendizados de outros worktrees sincronizados; nao treina o modelo.
- Sete agentes locais e quatro skills de dominio. Novas sessoes carregam os
  arquivos; nao ha injecao retroativa em chats nem autorizacao adicional.
- Manifesto cobre 40 arquivos de rotas/APIs em nove areas, com teste que detecta
  rotas novas sem mapeamento. Nao certifica todos os slugs ou papeis dinamicos.
- Navegador em 27/09: 19 rotas inspecionadas em leitura com Master. Dashboard
  sem overflow global nas quatro larguras, mas metas ainda sem fonte segura;
  ranking bloqueado por politica e parcerias aguardando conciliacao. Confirmar
  estado atual antes de agir; nao remover bloqueios por suposicao.
- Catalogo confirmou plugins principais instalados; autenticacao e telemetria
  sao verificacoes separadas. Codex Security apenas sugerido, nao confirmado.
- Validacao: 26 testes especificos, lint, tipos, build e formatacao passam.
  Suite geral Windows: 744 passam, seis falhas POSIX conhecidas e um skip;
  oito testes Node Salesforce passam em execucao separada. CI Linux e o gate
  integral, nao suprimir as falhas locais para obter resultado verde.
- Revisao independente corrigiu isolamento entre repositorios, proveniencia de
  fallback, geracoes intercaladas e tamanho dos titulos; regressao automatizada.
- Instalacao compartilhada atualizada e conferida nos tres checkouts, inclusive
  busca a partir da branch antiga e leitura pelo CLI do Obsidian. Backup de
  100 arquivos restaurado com hashes equivalentes em 28/09/2026.
- Audit: dois moderados em Vitest/@vitest/mocker, sem altos/criticos. Atualizacao
  ja proposta no PR Dependabot #65; nao foi misturada a esta entrega.
- Diagnostico CLI: configuracao carregada, mas verificacao opcional do MCP n8n
  sofreu timeout. Revalidar o conector quando necessario; nenhuma alteracao de
  workflow ou credenciais foi tentada e nao existe fallback REST autorizado.
- Nenhuma publicacao em producao ou alteracao de dados remotos.

## 2026-09-27: desempenho do estoque

- Status: validado.
- Fonte: PRs #94 e #95; docs/runbooks/inventory-performance.md;
  CI 36349004691; conferencias de producao neste chat.
- Fontes de estoque em paralelo, cache de 30 segundos com autorizacao antes do
  cache, deduplicacao e reducao de calculos repetidos dos filtros.
- Benchmark de facetas por regiao: mediana de 57,023 ms para 12,449 ms em 3.301
  unidades. Nao representa reducao equivalente no tempo total de abertura.
- Regra compacta herdada com !important impediu inicialmente o alvo de 44 px.
  Corrigida a prioridade CSS e acrescentada medicao geometrica no teste visual.
- Validacao: lint, tipos, testes, build e matriz visual aprovados na CI Linux.
  Conferencia real confirmou filtros utilizaveis, botao de 44 px e console limpo.
- Limite operacional: a VPS sofreu pressao de memoria com testes visuais
  extensivos. Preferir a CI para a matriz pesada; nao interromper servicos alheios.
- Nao houve alteracao de regras financeiras, schema ou workflows n8n.

## 2026-09-27: memoria local e ferramentas automaticas

- Status: validado (instalacao e testes locais especificos).
- Fonte: scripts/knowledge/obsidian.mjs e docs/runbooks/obsidian-project-memory.md.
- Documentos tecnicos selecionados sao exportados para o vault local. Cada
  checkout tem estado separado; historico deduplicado por conteudo e revisao.
- Hooks Git locais sincronizam commits, merges, checkouts e rewrites. AGENTS.md
  define consulta inicial, roteamento automatico de skills e registro final.
- Notas editadas manualmente, links simbolicos e possiveis credenciais bloqueiam
  a exportacao. Nenhum plugin comunitario, SDK ou servico pago e necessario.
- Validacao: 14 testes especificos aprovados, incluindo hook post-commit real,
  worktrees, concorrencia, idempotencia e preservacao de notas manuais.
- Instalacao conferida nos tres checkouts locais; o CLI do Obsidian leu o indice
  gerado. Backup anterior com 77 arquivos e restauracao por hash aprovada.
- Lint, tipos e build das 41 rotas passaram no Windows. A suite geral encontrou
  as seis falhas preexistentes ligadas a permissoes POSIX; consultar a CI Linux
  do PR para a validacao integral antes do merge.
- Nenhuma alteracao de producao, conta, plugin comunitario ou regra financeira.

## 2026-10-05: paridade visual exige referencia externa

- Status: em validacao antes da publicacao.
- Fonte: `docs/qa/canvas-parity/README.md`,
  `docs/audits/canvas-layout-correction-2026-10-05.md` e
  `scripts/qa/authenticated-visual.mjs`.
- Uma baseline gerada pela propria aplicacao detecta regressao entre commits,
  mas nao comprova que a tela corresponde a um canvas externo aprovado. O gate
  anterior era autorreferente e permitiu promover uma composicao divergente.
- A matriz autenticada passou a recortar a metade correta das 11 pranchas e
  comparar as 22 rotas por distribuicao cromatica e estrutura de bordas, alem
  de manter capturas internas, Axe, overflow, console, zoom, teclado,
  reduced-motion, sete larguras e tres temas.
- O contrato continua estrutural: canvases nao autorizam numeros, politicas,
  rotas, grants ou motores. Dados e navegacao permanecem derivados dos loaders
  e guards existentes; ausencia de fonte continua fail-closed.

## 2026-10-12 — DEPLOY-001 no fluxo de promoção

Implementado `release:production`: consulta ao vivo de SHA, deployment ID e
horário real dentro de lock compartilhado, CI completa no main exato,
validade no próprio minuto/até 60 s, CAS, noop e recuperação de pendência.
Procedimento: [production-release-guard](../runbooks/production-release-guard.md).
CI executa testes de política, transação, recuperação e concorrência Linux.
A adoção operacional exige histórico confiável para inicializar o ledger e
uso do coordenador por todos os publicadores; esta entrega não publica runtime.

## 2026-10-13 - Retomada do recibo n8n

- Fonte: git fetch/ls-remote, health publico e MCP get_workflow_details.
- Branch codex/n8n-crm-isolado em 897e5ad; main remoto em 7c50f59.
  Health ok, runtime ainda 1160a0e; nao confundir main com publicado.
- Workflow L90AYSBEat4vYHLz inativo, tres nodes, sem versao publicada.
  Proxima etapa: preparar envio e recibo verificado, sem agenda/carga real.
- Credenciais privadas armazenadas nao significam configuracao aplicada ao CRM.
  Backup/restore do banco e gates de release permanecem pendentes.
- Credencial de saida anqcQZ0zCBoko0YH confirmada por list_credentials e vinculada
  ao POST fixo CRM. Nenhum segredo lido ou gravado no repositorio.
- Validate_node_config e validate_workflow aprovados; update atomico com dez
  operacoes e releitura: versao dcffaf09-354c-4a82-817c-5e6ca9da1dd5, cinco
  nodes, active false e activeVersionId null. Sem persistencia success/error.
- Testes locais: 19 passaram, incluindo recibos 200/201, idempotencia, rejeicao
  de 202/ID divergente e bloqueio de campo proibido. Nao houve POST ao CRM.
- PR198 consultado via conector: aberto, mergeable false. Nenhum workflow run
  retornado para 897e5ad; nao declarar CI verde. N8n antigo nao alterado.
- Lint aprovado com um aviso preexistente em connected-systems.mjs:18;
  typecheck/build aprovados. Vitest 2566 passaram, 27 skips, seis falhas em
  quatro arquivos de caminhos/permissoes Windows; as etapas Node/release
  posteriores ao Vitest nao rodaram. Os 19 testes n8n foram executados a parte.
- Validacao SDK final manteve um aviso PLAIN_GENERIC_AUTH pelo placeholder
  newCredential; update utilizou o ID existente e releitura confirmou o vinculo.
  Nao criar credencial duplicada a partir do placeholder. Nenhum deploy CRM.
