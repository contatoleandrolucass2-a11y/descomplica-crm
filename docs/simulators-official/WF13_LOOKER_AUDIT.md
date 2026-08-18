# Auditoria Looker × WF13

## Escopo e evidência

Auditoria somente leitura concluída em 18/08/2026 na página
`p_3ll8k3zrrd` do relatório `2fc80aba-ceca-4e2c-8f94-3c2f4bf7b223`. O contrato
retornado pelo Looker indicou `editable: false`. Nenhum relatório, filtro,
fórmula, fonte, permissão ou compartilhamento foi alterado.

- SHA-256 da resposta sanitizada `getReport` usada na auditoria:
  `daf02309339c65c6af09cb8fc9183416fa07fca4cd4da8da48a5b57bcd1e44bc`;
- matriz dos 30 fluxos controlados:
  `docs/qa/wf13/looker-site-ranking-matrix.csv`;
- matriz das nove fronteiras anuais:
  `docs/qa/wf13/annual-boundary-matrix.csv`.

O payload bruto não é versionado. As matrizes contêm somente entradas
sintéticas e resultados comerciais não pessoais.

## Fórmulas comprovadas

### Valor final e pró-soluto

Os campos calculados e perturbações controladas comprovam:

```text
valor_final = valor_inicial - bônus_adimplência - desconto_mês - desconto_vc

saldo_nominal = valor_final
  - financiamento - subsídio - FGTS - cheque_moradia
  - ato - sinais_válidos - anuais_nominais_válidas

anuais_no_indicador = anuais_nominais_válidas × (1 + 0,5%)

percentual_pró_soluto =
  (pró_soluto_corrigido + anuais_no_indicador) / valor_final
```

- bônus, `Desconto MÊS` e `Desconto V.C.` reduzem valor final e saldo;
- financiamento, subsídio, FGTS, cheque, ato, sinais e anuais nominais reduzem
  o saldo nominal;
- `Volta ao Caixa` é informativa e não altera valor final, saldo nem os dois
  indicadores;
- a correção futura de cada anual continua separada na memória, mas não substitui
  `anuais_no_indicador`. Usá-la no numerador elevava indevidamente o cenário de
  ouro de `9,88%` para `10,08%`;
- anuais nominais não são abatidas novamente do saldo nominal;
- o cálculo compara a fração integral. Arredondamento para duas casas ocorre
  apenas na apresentação.

### Comprometimento de renda

O campo calculado `qt_6jixw381xd` divide pela renda a maior parcela corrigida
entre os períodos pré e pós-obra:

```text
parcela_pré = anuidade(saldo_alocado_pré; 0,5% a.m.; meses_pré)
parcela_pós = anuidade(saldo_alocado_pós × 1,005^meses_pré; 1,5% a.m.; meses_pós)
parcela_considerada = max(parcela_pré; parcela_pós)
comprometimento = parcela_considerada / renda_mensal
```

Anuais e sinais não são somados diretamente à parcela de comprometimento.
Anuais reduzem o saldo nominal e preservam sua correção separada no percentual
de pró-soluto. Sinais reduzem o saldo e deslocam a carência/correção conforme o
calendário. A renda é a renda mensal informada.

### Anuais

As mensagens condicionais do Looker e dois cenários de fronteira comprovam que
o limite é individual: cada anual deve ser menor ou igual a 50% da renda
mensal. Com renda de R$ 10.000,00, R$ 5.000,00 foi aceita e R$ 5.000,01 foi
rejeitada/excluída. O Looker também rejeita anual posterior à entrega.

As datas flexíveis do relatório não demonstram todas as fronteiras civis
exigidas. Nesses casos prevalece a regra explícita: cada `15/12/AAAA` é elegível
quando `data-base <= data <= entrega`, sem ajuste por dia útil.

## Ranking e diferença deliberada

Os limites exibidos e reproduzidos foram:

| Ranking  | Pró-soluto | Renda |
| -------- | ---------- | ----- |
| DIAMANTE | 25%        | 20%   |
| OURO     | 20%        | 20%   |
| PRATA    | 18%        | 18%   |
| BRONZE   | 15%        | 15%   |
| AÇO      | 12%        | 10%   |

O campo calculado `RESULTADO APROVAÇÃO` do Looker usa `<` para os dois limites.
Logo, o relatório antigo reprova valores exatamente iguais. A regra explícita
desta correção, de autoridade superior, usa `<=`: igualdade aprova e somente o
excesso reprova. A matriz marca os dez casos de fronteira como diferença
intencional.

`6° NÃO ELEGÍVEL` recebe limites zero no relatório e falha na comparação. O site
mantém a reprovação e adiciona o motivo determinístico `Cliente classificado
como não elegível`.

## Trinta cenários controlados

Foram executados seis cenários por ranking, sempre em contexto novo e com dados
sintéticos: ambos abaixo, pró-soluto exato, pró-soluto 0,01 p.p. acima, renda
exata, renda 0,01 p.p. acima e ambos acima. Valores, percentuais, datas e
fórmulas reconciliaram. Quando o card de status do Looker não renderizou antes
do timeout visual, o status registrado veio do campo calculado acessível; a
coluna `status_looker_evidence` distingue `rendered` de `calculated-field`.

Resultado: nenhuma diferença nas regras preservadas. A única diferença é a
inclusão deliberada do limite exato no site.

## Retificação do cenário com anuais

A matriz inicial de ranking não tinha anuais preenchidas e a matriz anual
validava elegibilidade, não o percentual financeiro. A reprodução integral do
PDF oficial com três anuais demonstrou que a interpretação anterior — somar as
correções futuras de cada anual ao numerador — era incompleta.

No cenário oficial, o numerador é `R$ 23.115,00`: `R$ 17.085,00` do saldo
mensal corrigido mais `R$ 6.030,00` das anuais nominais submetidas uma vez à
correção inicial de `0,5%`. Dividido por `R$ 234.000,00`, resulta em
`9,878205%`, exibido como `9,88%`. A correção futura das anuais soma
`R$ 6.506,19`, mas permanece memória do fluxo e não entra nesse indicador.

Comparação e rastreio completos: `WF13_PRO_SOLUTO_HOTFIX.md`.
