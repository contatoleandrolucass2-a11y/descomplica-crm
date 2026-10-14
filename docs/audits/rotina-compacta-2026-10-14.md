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
