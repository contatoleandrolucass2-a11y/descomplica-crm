# Rotina compacta por conclusao

## Escopo

Pedido de 14/10/2026: checkbox no canto superior esquerdo de cada atividade
na semana e antes do texto em Hoje. Alinhar controles verticalmente, remover
altura adicional abaixo do texto e rolagem interna. Somente atividades
concluidas recebem gradiente; dia atual destacado exclusivamente no cabecalho.
Preservar fonte, textos, persistencia individual e virada semanal de Brasilia.

## Baseline

- Abertura 2026-10-14T12:13:43Z: health200/ok/faae8e9efa487c44d01b991a3949ce1627ad2980.
  main16f458720406e76efcd1eda8a1eeb791509800a3, CI38558435232 em andamento.
- Checkoutdf0c52c documental/PR219, CI38518828290 aprovada mas conflito de
  registros com main. Nova branch codex/rotina-compacta preserva ambos;
  integracao8ca3d41 mantem o dashboard sem reescrever seus arquivos.
- ATUALIZACOES excedeu limite256000 apos integracao. Registro integral anterior
  da Rotina preservado em rotina-individual-2026-10-14.md e referencia curada
  mantida no indice; sync confirmado. Nao alterado limite do exportador.

## Implementacao

- RoutineSettings.tsx: checkbox antes do textarea em grade local; remove
  data-today do corpo e mantem data-completed derivado do hook existente.
- RoutineSettings.module.css: trilho fixo28px (44px toque), texto flexivel,
  fundo da pagina nas pendentes e gradiente nas concluidas. Contorno de foco
  sem transformacao de escala, eliminando overflow lateral por hover.
- Wrapper com overflow visible; rolagem pertence a pagina. Semana mantem
  minimo960px para legibilidade; Hoje nao exige largura minima. Cabecalho
  acompanha rolagem abaixo do menu usando o mecanismo existente.
- Sem alteracao de hook, API, schema, permissoes, dados remotos ou n8n.

## Verificacao

- Lint, typecheck e build locais aprovados em 14/10/2026, Node24.19/pnpm11.20.
  Logs locais compact-lint.log, compact-typecheck.log e compact-build.log.
- pnpm test foi executado, mas interrompido apos falhas Windows de symlink
  Salesforce e timeouts em reference-parity/devtools com concorrencia padrao.
  Nao e aprovacao da suite completa. Revalidar com concorrencia limitada e
  exigir a suite Linux integral na CI; nao reduzir assercoes ou gates.
- Repeticao limitada a dois workers tambem registrou symlink Salesforce e
  timeout Next DevTools; interrompida para priorizar QA focal, sem mascarar
  falhas. O lint tem um aviso preexistente em connected-systems.mjs:18.
- QA focal Chromium: 4/4 aprovados com ROUTINE_SETTINGS_BROWSER=1 e filtro
  `compact completion geometry|lets readers autosave` (72 fora do filtro).
  Tres temas, Semana/Hoje, 1440/390px, geometria, fundos, Axe sem violacoes,
  sincronizacao bidirecional e reload. Sticky/scroll aprovado na rodada anterior.
  Suite ampla interrompida nao equivale a aprovacao integral; CI e deploy pendentes.
- Doze capturas sinteticas compact-completions em test-results/routine-preview;
  coordenador revisou Semana/Hoje dark1440 e Hoje dark390. Checkbox alinha a
  primeira linha, inclusive em textos longos. Nenhuma atividade real alterada.

## Integracao

- PR222, head ea2e639d88dfae4a829d8a4dc0ac1ce9d08dbb1d: CI38565559075
  concluida com sucesso em 13:20:40Z. validate, release-gates e isolated-restore
  aprovados; promotable-image corretamente nao se aplica ao evento de PR.
  Aprovados suite Linux completa, banco, restore, E2E e matriz autenticada.
- Consulta13:21Z: main mudou para8e015c6 somente com fechamento documental dos
  funis. Integracao preserva as duas notas; conflito restrito a ATUALIZACOES.
  Fonte: GitHub PR222/run38565559075 e git fetch. CI do novo SHA e deploy ainda
  pendentes; aprovacao de ea2e639 nao substitui a verificacao do SHA integrado.
- A consulta de producao em 14/10 durante a CI confirmou
  deployment713b3b88-e489-4153-9057-096c7b044661, SHA16f4587 e data real
  2026-10-14T12:24:35.454Z. Fonte: release:production status; nao e evidencia
  de frescor para a proxima promocao, que exige nova consulta no minuto.
- Retomada14:32Z apos indisponibilidade do acompanhamento local: git fetch,
  GitHub e health relidos. CI38571239681/3def954 concluida com sucesso13:58:29Z,
  PR222 CLEAN, main ainda8e015c6; health200/ok/16f4587. Nenhuma falha de gate.
  Fontes: GitHub actions/runs e PR222, /api/health. Sync repetido antes de seguir.

## Publicacao e encerramento

- PR222 integrado por squash em 14:32:29Z. Main/publicado:
  `5c4d95ee1e1b95d40d3ac283fb47d32d139494d7`. CI38581434699 concluida com os
  quatro jobs aprovados: validate, release-gates, isolated-restore e
  promotable-image. Nenhuma assercao, baseline ou gate relaxado.
- Imagem da CI baixada somente apos todos os jobs concluirem. Checksum
  comprimido77778823f67270d368c2ffb73bdba7dc2a0385ad2c6ce8486cd2c177af30c9e9.
  Config/CI IDsha256:b8e878981263c0643ea3ced3d7ccc408d3ea44cbe10f1dafa3f84e4811cc894c;
  OCI/Docker IDsha256:10177af0128dec1e419cb0e427b1c7412bce601256b1e1c307a4e323d5fbc11e.
  Hashes, manifesto, plataforma linux/amd64,11 camadas e dois perfis comprovados.
- Backup privado verificado em
  `/var/backups/descomplica-crm/releases/5c4d95ee1e1b95d40d3ac283fb47d32d139494d7.Ubfihv`.
  Manifest2d4b23fb0d630b084791a9c8bbc053f58bdb3d25e044f770976c518de089985d.
  Sem dumps, segredos ou arquivos privados no Git.
- Publicado exclusivamente pelo coordenador release:production, com consulta
  ao vivo no minuto, locks/CAS e rollback disponivel. Deployment
  `9573a6e9-5c6b-451c-b071-5f79977d9ea0`, concluido
  `2026-10-14T15:16:09.397Z` (12:16:09 America/Sao_Paulo), sem pendencia.
  Versao anterior16f4587/deployment713b3b88 mantida como referencia de retorno.
- Smoke: health200/ok/SHA esperado; container healthy, OOMfalse, reinicios0;
  API inventory401 e rotas Gestao/Rotina307 para anonimo.
- UI autenticada observacional: Semana e Hoje carregaram, fonte13px preservada,
  controles antes do texto/primeira linha, overflow visible nos dois e sem
  overflow da pagina no viewport observado. Pendentes iguais ao fundo e somente
  concluida com gradiente; data-today ausente do corpo e cabecalho atual presente.
  Textos e marcacoes identicos antes/depois da troca de visualizacao. Nao houve
  escrita de atividades reais, alteracao de permissoes, migration ou n8n.
- Capturas locais ignoradas: rotina-compacta-semana-publicada.jpg e
  rotina-compacta-hoje-publicada.jpg em test-results/routine-preview. Navegador
  reconectado apos a instancia anterior ficar indisponivel, sem contornar login.
- Fontes: GitHub PR222, runs38565559075/38571239681/38581434699; registro do
  coordenador; health publico e DOM/capturas da pagina publicada. Evidencia
  operacional sanitizada em test-results/routine-release/compact-production.log.
- Encerramento documental nao requer novo deploy. Publicacao desta nota no Git
  segue PR/CI separados; nao confundir SHA documental com versao de runtime.

## Registro historico do indice de conhecimento

Fonte: docs/knowledge/ATUALIZACOES.md em ccd1639, preservado integralmente
para manter o indice abaixo de 256000 bytes. Este trecho e historico.

- Retomada12:13Z: main16f4587/CI38558435232 em andamento; health200/ok
  em faae8e9. Checkout documental df0c52c/PR219 com CI38518828290 aprovada,
  conflitante apenas nos registros. Fontes: GitHub, git fetch e /api/health.
- Nova branch codex/rotina-compacta preserva dashboard e registros anteriores.
  Pedido: controles a esquerda, fundo somente por conclusao, destaque do dia
  apenas no cabecalho e rolagem da pagina. Sem alterar texto, API ou banco.
  Lint/tipos/build e QA focal4/4 aprovados; suite Windows integral indisponivel
  por symlink/timeouts. PR222/CI38565559075 aprovada em ea2e639; incorporado
  main8e015c6 documental, sem alterar runtime. CI38571239681/3def954 aprovada;
  consulta14:32Z confirmou GitHub/health200/ok/16f4587 apos falha do acompanhamento.
  PR222 integrado; CI main38581434699 com quatro jobs aprovados. Publicado
  5c4d95e em15:16:09Z (12:16 BRT), deployment9573a6e9, sem pendencia.
  Backup/rollback e frescor verificados; health correto, anonimo negado e UI
  autenticada validada nos dois modos, sem alterar textos/marcacoes reais.
  Evidencias e limites:
  [auditoria compacta](../audits/rotina-compacta-2026-10-14.md).
