# Rotina: seletor e contorno da coluna

Data: 2026-10-14. Branch: codex/rotina-seletor-coluna.

## Escopo

- Filtro nativo de escolha unica substitui seis abas; as seis funcoes continuam
  disponiveis, com rascunhos separados e salvamento compartilhado existente.
- Contorno branco animado unico na coluna atual. A geometria acompanha o
  cabecalho durante a rolagem sem alterar altura das celulas ou foco.
- Cabecalhos com o token do antigo seletor ativo; nenhum brilho individual.
- Modos segmentados, insercao secundaria e salvamento destacado, com foco
  visivel e movimento reduzido. Conclusoes e tipografia preservadas.
- Sem alteracao de hook, endpoint, schema, RLS, conteudo ou workflow n8n.

## Abertura e PR documental

- Git comum confirmado. Em15:54Z, main e health200/ok apontavam para
  5c4d95ee1e1b95d40d3ac283fb47d32d139494d7, versao anterior publicada.
- PR225 documental, head5d7631cd5957dfb86f6e57c204e414596217dd45, possui
  somente CHANGELOG, WORKLOG e duas notas. CI38588434885 aprovou validate e
  restore, mas falhou no estagio daily-layout-320-balanced do QA autenticado.
- Artifact autenticado baixado e inspecionado: relatorio sanitizado indica
  somente estagio routine-settings, sem causa detalhada. Runtime identico ao
  main aprovado na CI38581434699. Reexecucao do job falho solicitada como
  reproducao; nao equivale a diagnostico confirmado nem autoriza bypass.
- PR documental nao exige republicacao/reinicio. Novas mudancas visuais possuem
  autorizacao explicita de publicacao apos validacao.

## Validacao

- Retomada16:17Z: origin/main avancou para0019690 (PR220, pesquisa no
  Associativo); health permaneceu200/ok/5c4d95e. Merge preserva codigo e
  baselines recebidos, sem edita-los. Conflitos somente em tres registros,
  conciliados com ambas as entradas. Nota detalhada do PR220 arquivada
  integralmente para respeitar limite256000bytes do indice de conhecimento.

- Lint aprovado, com warning preexistente em scripts/qa/connected-systems.mjs:18.
- Typecheck e build aprovados. API/fixture da Rotina: 88 testes aprovados.
- `pnpm test -- --maxWorkers=2` iniciado e interrompido apos falha externa ao
  escopo; o argumento atingiu o ultimo script encadeado, nao o Vitest.
  Reproducao focal de salesforce-inventory-api no Windows: caso symlink retorna
  200 onde o teste espera 502 (linha164). Nao equivale a aprovacao integral;
  exigir CI Linux completa, sem alterar esse teste para acomodar o host.
- Revisao independente: sem achados; contorno alinhado (0px) em scroll
  vertical/horizontal, resize1440/390, troca de funcao/modo/dia. Domingo remove
  o contorno; teclado e foco2px aprovados. Zoom via escala do Chromium, nao
  zoom nativo; nao substitui a matriz autenticada da CI.
- QA Chromium focal confirmou sincronizacao bidirecional, seletor e rascunhos,
  contorno unico, sticky e rolagem. Doze scans axe sem violacoes; capturas
  desktop/mobile revisadas. Ajuste final: texto branco puro nos titulos dark.
- Rodada final: 16 testes aprovados, zero falhas, 60 fora do filtro; mais quatro
  testes source aprovados em rodada propria (19 distintos no conjunto).
  Falhas iniciais de seletores/assercoes foram corrigidas sem retirar gates.
- Previa loopback reconstruida e inspecionada no Chrome pelo coordenador:
  checkbox sintetico confirmado apos resposta assincrona e refletido em Hoje.
  A acao check do driver reportou falha imediata, mas a leitura posterior
  confirmou checked=true sem segunda escrita. Nenhum dado real utilizado.
- ESLint focal, Prettier e typecheck repetidos apos os novos testes: aprovados.
- Nao alterar dados reais para validar layout; usar fixtures sinteticas locais.
- PR, CI completa, merge e publicacao ainda nao comprovados para este ajuste.

## Integracao e retomada operacional

- PR226 aprovado na CI38597484257, headfb324d3: validate, isolated-restore e
  release-gates aprovados, incluindo matriz visual autenticada. Nenhum gate
  dispensado. Integrado em efc6a20f7a60b477214e5889fec52081cce9f9b9 as17:04:24Z.
- CI push/main38603513278 em andamento; ainda nao autoriza promocao da imagem.
- PR225 antigo: segunda execucao da CI38588434885 falhou em zoom. Log confirma
  Rotina aprovada em Semana/Hoje, todos os tamanhos/temas, incluindo320balanced.
  Artifact candidate-results.json informa failure.stage=zoom, kind=sanitized;
  causa especifica nao comprovada. Nao relaxar testes nem repetir por tentativa.
- Conteudo documental do PR225 incorporado integralmente no PR226. Sua branch
  foi reconciliada com main para registrar o encerramento operacional sem outro
  deploy. Conflitos apenas no indice/arquivo historico, preservados integralmente.
- Fonte ao vivo17:06:17Z: /api/health200/ok/001969010d1d33297b9d42148be95832feefb6ab.
  Coordenador confirma deployment5c4dc0b6-173b-443f-be29-cb67bd32b0bc,
  deployedAt2026-10-14T16:58:40.048Z, pending=null. Publicacao concorrente do
  Associativo ja incluida em efc6a20. CI main38596610544 aprovada.
- Preparado checkout remoto limpo efc6a20, dependencias de producao pelo lockfile,
  sem build/testes pesados na VPS. Nenhuma promocao do novo runtime executada ainda.
- CI main38603513278: primeira tentativa aprovou validate, restore, imagem e E2E,
  mas falhou em daily-layout-1024-balanced antes de daily-size. Artifact sanitizado
  informa apenas routine-settings; assert/causa especifica nao comprovada.
- Reproducao local independente: tres rodadas validas,104 transicoes,zero falhas,
  com26linhas/74atividades House do repositorio, segunda-feira,1024/320balanced.
  Windows/Node24/Chromium151. Uma rodada extra com erro da instrumentacao foi
  descartada, sem usar seu resultado como evidencia do produto.
- Uma reexecucao do job main falho foi solicitada para verificar reproducibilidade
  no mesmo SHA, apos inspecao dos logs e tentativas locais. Nenhum criterio,
  timeout, baseline ou codigo foi alterado para obter aprovacao. Falha recorrente
  exige instrumentacao sanitizada da assert antes de novas tentativas/publicacao.
- A segunda tentativa foi CANCELADA, nao uma nova falha: GitHub informa
  conclusion=cancelled apos integracao concorrente do PR224 em17:51:04Z.
  Seu log confirma Rotina completa aprovada, incluindo1024balanced e320dark.
  Nenhuma instrumentacao adicional foi aplicada com base no cancelamento.
- Retomada17:55Z: main77ddc69d79678d6944c34c5a3ac0f5c8a2ee2f8c preserva efc6a20;
  CI38610165621 em andamento. Health200/ok continua0019690. Candidato anterior
  nao pode ser promovido: o coordenador exige main exato. Novo suporte Qlik tem
  comandos proprios e nao sera acionado; esta tarefa promove somente o CRM.

## Historico transferido do indice

Trecho integral de ATUALIZACOES apos integracao do PR224, transferido para
manter o limite de exportacao do Obsidian sem descartar evidencias.

- Retomada15:54Z: Git comum confirmado, main/publicado5c4d95e; health200/ok.
  PR225 documental em5d7631c: validate/restore aprovados, release-gates falhou
  em daily-layout-320-balanced (CI38588434885). Diagnostico antes do merge;
  nao reiniciar CRM por documentos. Fontes: GitHub, git fetch e /api/health.
- Novos ajustes autorizados para publicacao apos validacao: seletor unico,
  controles redesenhados e contorno branco da coluna atual, sem mudar dados.
  Evidencias: [auditoria do seletor](../audits/rotina-seletor-2026-10-14.md).
- PR226/CI38597484257 aprovado, integrado em efc6a20; CI main38603513278
  em andamento. Consulta17:06Z: health200/ok/0019690, publicado por trabalho
  concorrente em16:58:40Z. Esta versao ja esta incluida no candidato.
- Retomada17:55Z: main77ddc69/PR224 preserva Rotina; CI38610165621 em andamento.
  Reexecucao de efc6a20 cancelada pela integracao, nao nova falha; health0019690.

## Publicacao e verificacao final

- Main77ddc69d79678d6944c34c5a3ac0f5c8a2ee2f8c aprovado integralmente na
  CI38610165621: validate, release-gates, isolated-restore e promotable-image.
  Matriz autenticada aprovada sem alterar criterio, timeout ou baseline.
  Causa da primeira oscilacao em efc6a20 continua desconhecida; nao declarar
  correcao causal. Reavaliar com diagnostico sanitizado se voltar a ocorrer.
- Artifact baixado somente depois de todos os jobs concluirem. SHA256 gzip
  ed89d385d5c577ed42fc7a616c9ac7fec57730157e21bcfec1e9fd7e50490da3;
  config/CIsha256:b109a55e7ec5f6e4736774b4f9ff361d3ec6f1d803431be59ac60e90973d07f0;
  OCI/Dockersha256:d6f0f5783e2a3adf1cc92013710530c6deacfc97229de7b959164334332dae70.
  Revisao, plataforma linux/amd64,11 camadas e dois perfis comprovados.
- Backup privado verificado em
  `/var/backups/descomplica-crm/releases/77ddc69d79678d6944c34c5a3ac0f5c8a2ee2f8c.GBuvp3`,
  manifest0e05568db613d17e43d7c91f3b2b6053b1488bee4accdbe195b0d4a24068cd9a.
  Arquivos privados e segredos nao foram exportados ao Git.
- Publicacao exclusivamente por release:production deploy, locks/CAS e consulta
  no minuto. Deploymentee03fade-fcd0-4c3c-b410-d2bc0abd57f7,
  deployedAt2026-10-14T18:42:12.845Z (15:42:12 America/Sao_Paulo), pending=null.
  Anterior0019690/deployment5c4dc0b6 mantido como referencia de recuperacao.
  Nenhum comando Qlik de mutacao, migration, n8n ou dado comercial alterado.
- Smoke: health200/ok/SHA77ddc69; container healthy, OOMfalse, reinicios0;
  inventory anonimo401, Gestao e Rotina307. Evidencia operacional sanitizada:
  test-results/routine-release/selector-production.log (ignorado pelo Git).
- UI autenticada observacional confirmou seis opcoes, selecao unica e uma
  secao visivel; House26linhas/Imob18linhas. Semana/Hoje preservaram os textos
  e marcacoes das10atividades de quarta, sem gravar uma atividade real.
  Fonte13px, overflow visible, Hoje sem excesso horizontal, contorno unico
  pointer-events:none, branco, cabecalhos sem pseudo-brilho e no tom solicitado.
  Desvio geometrico observado menor que0,34px. Navegacao de funcao/modo aprovada.
- Capturas locais: test-results/routine-preview/seletor-semana-publicada.jpg e
  seletor-hoje-publicada.jpg. Sem dados pessoais nos registros versionados.
- PR225 passa a conter somente o encerramento documental sobre main77ddc69.
  Sua integracao nao exige nem autoriza republicacao do CRM. SHA documental
  posterior deve permanecer distinto do runtime publicado, salvo nova demanda.
- Fontes: GitHub PR226/run38610165621; coordenador; health publico e DOM/capturas
  autenticadas. Obsidian sincronizado apos registro, respeitando limite256000bytes.
- Conferencia GitHub/git fetch e health em2026-10-14T19:10:46Z: main d660ba9
  integrou dashboard enquanto CI documental38617882257 estava em andamento.
  Merge local sem conflitos preserva todas as alteracoes externas; diff do
  PR225 contra a base continua exclusivamente nos quatro documentos. Health
  200/ok/77ddc69. Nova validacao obrigatoria antes de integrar, sem redeploy.
