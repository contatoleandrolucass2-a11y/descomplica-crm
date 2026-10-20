# Associativo: ajuste minimo e calendario anual

## Escopo e origem

Pedido do usuario em 20/10/2026 para
`/app/simulacao/associativo-fluxo-linear`. Regra de desempate confirmada pelo
usuario: menor valor por pagamento, dividido igualmente entre Entrada e ate
tres Sinais. Nao significa menor soma inicial entre calendarios diferentes:
mais sinais podem aumentar a carencia e a soma necessaria.

## Causa e correcao

A busca anterior montava uma segunda entrada do motor com
`discountAuthorized: false` e `discount: 0`. Depois aplicava seus pagamentos
a proposta real, que mantinha o desconto. A sugestao portanto amortizava uma
divida maior que a real. O modal ainda exibia REPROVADO fixo e usava as datas
dos sinais anteriores, nao as datas do candidato.

`investorInput` agora e a unica base para proposta e sugestao. O helper
`associative-approval-suggestion.mjs` altera somente Entrada, Sinais, Anuais
e quantidade de parcelas. Desconto, bonus, folga, recursos, renda, ranking,
datas e unidade sao conservados. A pre-validacao rejeita renda, classificacao
ou progresso invalidos antes da busca.

Cada calendario de zero a tres sinais e avaliado separadamente. A busca usa
ate 84 mensais, anuais elegiveis dentro do teto e compara todos os limites do
fluxo escolhido. Os pagamentos iniciais ativos sao iguais em centavos. A
menor prestacao inicial aprovada vence; a soma inicial e o desempate.
Nenhum candidato reprovado pode ser aplicado. A previa mostra datas,
saldo, mensal e percentuais do proprio candidato.

## Anuais

- Vencimento em 15/12, ate a data de termino da obra.
- Sempre depois do mes/ano da Entrada e do ultimo Sinal, sem coincidencia
  ou intercalacao entre sinais.
- Indices de dezembro permanecem estaveis; adicionar/remover sinal nao
  transfere uma anual existente silenciosamente para outro ano.
- Campos que se tornam inelegiveis sao retirados e zerados na interface.
  O motor tambem rejeita anual em data inelegivel.
- Teto nominal: `floor(renda * 100 / 2) / 100`, calculado com inteiros
  decimais antes da conversao para Number. Nao ha epsilon de tolerancia.
  Renda de 2550,01 permite anual de 1275,00, nunca 1275,01.
- Entrada de anual e truncada em centavos e limitada ao teto. Reduzir renda
  reaplica o teto. As correcoes de juros existentes nao foram alteradas:
  o limite de 50% e sobre o valor nominal, antes dos juros.

## Regressao sintetica do caso informado

Sem identificadores de cliente/unidade: preco 276900, desconto 27000,
financiamento 126633,61, subsidio 23035, Cheque Moradia 16000, renda 2550,
Entrada inicial 150, data 20/10/2026, obra 31/12/2029, progresso 15% e Prata.

- Valor real 249900; saldo apos recursos 84231,39.
- Linear: Entrada + tres Sinais de 13269,73 cada.
- Sinais em 15/11/2026, 15/12/2026 e 15/01/2027.
- Anuais de 1275 em 15/12 de 2027, 2028 e 2029; nenhuma em 2026.
- Saldo mensal nominal 27327,47; maior mensal arredondada 459,00.
- Reduzir cada pagamento inicial em um centavo reprova o fluxo.
- A soma em centavos de pagamentos iniciais, anuais e saldo mensal confere
  com o saldo apos recursos.

O contrato de aprovacao monetaria em centavos permanece inalterado. Estas
evidencias validam o simulador local, nao substituem aprovacao bancaria nem
alegam uma nova auditoria do Salesforce.

## Documentacao e limites

A composicao exibe apenas `Registro = totalRegistration`, dinamico por
proposta. O calculo interno dos dois atos permanece. Removida a nota visual
solicitada; ajudas preservam limites da estimativa. ITBI, taxas de registro,
despachante, Seguro Caixa, juros e calculadora avulsa nao foram alterados.
Nenhuma migration, workflow n8n, importacao ou dado remoto neste escopo.

## Validacao

Testes de regressao cobrem input congelado, desconto/recursos, Linear e
Decrescente, igualdade dos pagamentos, fronteiras de um centavo, anuais
invalidas, teto estrito e reconciliacao nominal. O QA Playwright usa apenas
estoque sintetico e verifica previa/aplicacao, datas, limite, composicao e
impressoes. Resultados finais, CI, merge e versao publicada sao registrados
separadamente em `docs/knowledge/ATUALIZACOES.md`.
