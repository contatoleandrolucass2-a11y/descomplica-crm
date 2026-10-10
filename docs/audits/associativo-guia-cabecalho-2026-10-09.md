# Guia do Associativo no cabecalho

Data: 09/10/2026. Branch: `codex/guia-associativo-cabecalho`.
Fonte: pedido direto e dois prints do usuario. Substitui apenas a posicao
inferior do acionador entregue pelo PR #174.

## Escopo

- Botao a direita de Simulador Tabela Associativo, com largura intrinseca,
  padding de 16px e quebra responsiva. Mantem acabamento e animacao existentes.
- Um unico guia, sem modificar conteudo, estado da proposta ou formulas.
- Cabecalho opcional no InvestorCalculator preserva a hierarquia DOM anterior:
  cabecalho e workspace continuam irmaos. Outros simuladores nao o utilizam.
- QA exige alinhamento desktop, quebra sem sobreposicao em celular, largura
  proporcional ao texto, ausencia do acionador no estoque e toque minimo de 44px.
- Nenhuma rota, dependencia, banco, integracao, politica ou permissao modificada.

## Validacao

Oito testes focados aprovados, incluindo browser do contrato de cabecalho.
Primeira execucao excedeu o limite padrao local de cinco segundos; reteste com
30 segundos passou sem modificar os testes ou o limite da CI.
Lint, typecheck e build de 45 rotas passaram. Dois avisos de lint pertencem a
artefatos locais ignorados de auditorias anteriores, sem erros. Guia browser:
18 cenarios, 648 visitas, tres temas, 1440x900/375x812/320x568, nenhum erro de
console; seis combinacoes adicionais de estoque completo passaram. Campos,
filtros e selecao preservados. Capturas da CI confirmam titulo inteiro no celular.

Windows: 2.276 testes Vitest aprovados, seis skips e nove falhas; seis dependem
de semantica POSIX e tres foram timeouts em conhecimento. Reteste isolado dos
22 testes de conhecimento passou. Suite Node executada separadamente: 75/83
passaram, oito falharam em permissoes POSIX/caminhos executaveis. Nenhuma
asserção foi suprimida; o job validate Linux do mesmo HEAD passou integralmente.

## Revisao visual

PR #176. CI `37986779336`, HEAD `fdbf09fb324ebf760dca7e6a81e78a216ead3c54`:
validate, restore, banco, advisors, build, guia e autorizacao/E2E aprovados.
O predicado funcional original da matriz autenticada passou. Somente 11 imagens
do Associativo diferiram devido a mudanca solicitada; capturas revisadas em
sete viewports e nos tres temas, sem sobreposicao ou truncamento do acionador.

Captura limpa `ba192ecf7e8e355f8560b0de4c2817024f520044`, arvore identica ao
HEAD; artefato `11645226430`, ZIP SHA-256
`60c7698d714bc960df60ca083fcace6f124dc573ec57fb6884f07d9e637de772`.
Hashes de todas as candidatas e referencias conferidos; promocao transacional
reutilizou o helper versionado sem mudar predicados ou limiares de 1%/16.
Atualizadas 11 referencias, preservadas as outras 231 imagens e sua proveniencia.
O roteiro do guia tambem retorna ao topo antes da captura do cabecalho, para
nao registrar a rolagem residual da selecao de filtros como corte do titulo.

CI final em verify, integracao e publicacao pendentes.
