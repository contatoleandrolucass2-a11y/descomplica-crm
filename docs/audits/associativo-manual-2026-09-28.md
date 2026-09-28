# Manual Associativo: layout e navegacao

## Escopo

- Pedido: destacar Politica e Perguntas e melhorar Aprenda + no Associativo.
- Branch: `codex/associativo-manual-navegacao`.
- Componente dedicado preserva os textos, fontes e perguntas em InvestorCalculator.
  Tabela Direta, Tabela Investidor, calculos e contratos de estoque nao mudam.
- Abas com icones Lucide, estado selecionado, cabecalho/fechar persistentes,
  painel com rolagem independente, foco visivel e alvos de pelo menos 44px.
- Temas claro, equilibrado e escuro usam os tokens existentes. Sem novas rotas,
  servicos externos, migrations ou integracoes de monitoramento.

## Validacao

- Testes unitarios verificam semantica, ancoras, conteudo renderizado e isolamento
  dos outros manuais. QA Playwright integrado usa apenas estoque sintetico.
- Matriz do manual: 375x812, 768x1024, 1024x768, 1440x900 e 812x375; tres temas,
  ambos os paineis, axe, overflow, tamanho dos controles, teclado, foco,
  fechamento, ancoras e permanencia das abas durante a rolagem.
- As ancoras preservadas funcionam quando o manual esta montado; a pagina
  continua exigindo selecionar uma unidade para apresentar os recursos finais.
- Referencia de interacao: [WAI-ARIA Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- CI 36483450994 passou validacao, banco, restore e E2E, mas parou no controle
  de tema em 1024px depois de capturar os dois paineis nos tres temas em 375/768.
  Reproducao publicada: menu ultrapassava a largura visivel, com os controles
  de tema fora da tela. Corrige o cabecalho apenas entre 821 e 1100px, conforme
  padrao ja usado nos outros simuladores. Revisar somente a referencia afetada.
- Validacao local inicial: lint, tipos e build aprovados; 948 testes aprovados,
  um skip e seis falhas POSIX preexistentes no Windows (0700/0600 e symlinks).
  A CI Linux deve passar integralmente antes da publicacao.
- QA local isolado do componente React real: 30 capturas, cinco viewports,
  tres temas, axe sem violacoes, teclado, foco e ancoras aprovados. Sem estoque,
  credenciais ou dados de producao. Oito testes Node Salesforce tambem passaram.
- Status: implementado e validado localmente; CI integrada pendente. Nao publicado
  neste registro. Evidencias finais de CI/release devem identificar o SHA real.

## Publicacao

### Checkpoint integrado

- CI 36486887891, commit `58a0254719296d5400e3f7577b6fb4c9d8865cba`:
  validacao, restore, banco e E2E aprovados. Manual: 30 capturas/axe, cinco
  viewports e tres temas aprovados. Matriz geral: 140 verificacoes responsivas,
  80 de tema, 193 axe e 100 de zoom aprovados, incluindo demais simuladores.
- Unica divergencia entre 193 comparacoes: Associativo 1024x768, pelo cabecalho
  que agora exibe os temas. Captura sintetica inspecionada; atualiza somente
  `target-authenticated/simulacao-associativo-fluxo-linear-1024x768.webp`.
- Artefato fonte: `authenticated-visual-candidate-9e1b4a40454f71c0802c7407b78f7918361296b9`.
  SHA256 anterior: `3021cd327501abe95dbd57810171e2e362f12fc332eab6cc2bff6210902cc6e3`.
  SHA256 novo: `9c952daba9d9892941cd3f8bfa617b39a97f9fa110b625b58c7d3fdef9c6ae0a`.
  Catalogo atualiza somente esse registro, com baselineRevision para a origem
  nova e previousBaselineComparison para o delta real (233485/786432 pixels).
  Metadados da captura original e outros registros permanecem intactos.
  CI 36495001616 detectou o catalogo desatualizado; corrige tamanho/hash sem
  mudar testes, limiares ou assercoes. Nenhum outro baseline foi relaxado.
- Nova CI deve confirmar a referencia atualizada. O estado final de merge,
  CI e publicacao fica nas evidencias do [PR #104](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/104).

Seguir o runbook de publicacao automatica: PR/CI, imagem imutavel comprovada,
backup, CAS, rollback e verificacao autenticada depois da promocao. Nao fazer
build no VPS compartilhado nem reiniciar por alteracoes somente documentais.
