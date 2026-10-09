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
Validacao integral e publicacao pendentes.
