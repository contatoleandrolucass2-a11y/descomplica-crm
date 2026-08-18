# WF13 — limite 84 e comprometimento do pró-soluto

## Evidência e causa-raiz

Reprodução sintética do cenário do PDF oficial, sem persistência e sem alterar
Looker. O PDF informa `9,88%`; o site anterior retornava `10,08%`.

A causa era o numerador: após corrigir o saldo nominal para deduzir anuais sem
correção, o motor continuou somando `R$ 6.506,19`, valor futuro composto de cada
anual. O contrato oficial usa `R$ 6.030,00`: três anuais nominais de
`R$ 2.000,00`, submetidas uma única vez à correção inicial de `0,5%`.

```text
anterior = (R$ 17.085,00 + R$ 6.506,19) / R$ 234.000,00
         = 10,081705% = 10,08%

corrigido = (R$ 17.085,00 + (R$ 6.000,00 × 1,005)) / R$ 234.000,00
          = R$ 23.115,00 / R$ 234.000,00
          = 9,878205% = 9,88%
```

Diferença eliminada: `0,203500` ponto percentual bruto, ou `0,20 p.p.` na
apresentação. Nenhum valor específico do cenário foi codificado: centavos,
taxa, anuais e denominador vêm das entradas validadas e da fórmula versionada.

## Memória completa do cenário

| Campo                            |                                 Valor |
| -------------------------------- | ------------------------------------: |
| Valor original do imóvel         |                         R$ 262.500,00 |
| Bônus de adimplência             |                          R$ 28.500,00 |
| Desconto MÊS                     |                               R$ 0,00 |
| Desconto V.C.                    |                               R$ 0,00 |
| Valor final do imóvel            |                         R$ 234.000,00 |
| Volta ao Caixa                   |                  R$ 0,00, informativa |
| Financiamento                    |                         R$ 210.000,00 |
| Subsídio                         |                               R$ 0,00 |
| FGTS                             |                               R$ 0,00 |
| Cheque moradia                   |                               R$ 0,00 |
| Ato                              |                           R$ 1.000,00 |
| Sinais                           |                               R$ 0,00 |
| Anuais nominais                  |         3 × R$ 2.000,00 = R$ 6.000,00 |
| Anuais futuras corrigidas        | R$ 6.506,19, somente memória do fluxo |
| Anuais consideradas no indicador |                           R$ 6.030,00 |
| Saldo nominal do pró-soluto      |                          R$ 17.000,00 |
| Parcela nominal                  |                             R$ 202,38 |
| Parcela corrigida                |                             R$ 288,67 |
| Parcelas solicitadas             |                                    84 |
| Primeira mensal                  |                            15/09/2026 |
| Anuais                           |   15/12/2026, 15/12/2027 e 15/12/2028 |
| Numerador correto                |                          R$ 23.115,00 |
| Denominador correto              |                         R$ 234.000,00 |
| Percentual bruto                 |                             9,878205% |
| Percentual arredondado           |                                 9,88% |
| Comprometimento de renda         |                     7,22%, inalterado |

## Comparação

| Campo                         |   Referência |        Antes |       Depois | Diferença final |
| ----------------------------- | -----------: | -----------: | -----------: | --------------: |
| Saldo do pró-soluto           | R$ 17.000,00 | R$ 17.000,00 | R$ 17.000,00 |         R$ 0,00 |
| Parcela nominal               |    R$ 202,38 |    R$ 202,38 |    R$ 202,38 |         R$ 0,00 |
| Parcela corrigida             |    R$ 288,67 |    R$ 288,67 |    R$ 288,67 |         R$ 0,00 |
| Comprometimento do pró-soluto |        9,88% |       10,08% |        9,88% |       0,00 p.p. |
| Comprometimento de renda      |        7,22% |        7,22% |        7,22% |       0,00 p.p. |
| Quantidade solicitada         |           84 |           84 |           84 |               0 |

## Limite e manipulação

`WF13_MAX_INSTALLMENTS` vale `84` no contrato compartilhado e no servidor. O
campo visual é somente leitura; `policyLimit` não faz parte do payload. O schema
estrito rejeita tentativas de enviar limite ou confirmação manual. A quantidade
solicitada controla cronograma, divisão pré/pós, parcelas e memória; nunca é
substituída pelo limite.

Entradas vazia, `-1`, `0`, `84,5`, `85`, `100` e texto falham fechadas. Entradas
`1`, `36`, `37`, `83` e `84` passam a validação de quantidade. A política só é
marcada como conferida após cálculo integral aprovado.

## Gate local

- format, lint, typecheck e build: aprovados;
- testes: 385 aprovados e um ignorado; oito testes Node adicionais aprovados;
- Playwright: oito aprovados e um remoto ignorado no isolamento local;
- sete viewports: 147 verificações responsivas;
- três temas: 84 verificações;
- Axe e comparação: 192 verificações;
- zoom de 80%, 100%, 125%, 150% e 200%: 105 verificações;
- teclado, foco, reduced-motion, correção do erro e cadeado somente leitura:
  aprovados;
- onze evidências canônicas e onze do canário Master atualizadas; demais rotas
  e motores preservados byte a byte.
