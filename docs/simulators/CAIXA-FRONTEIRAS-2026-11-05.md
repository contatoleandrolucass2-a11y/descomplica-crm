# CAIXA: fronteiras de São Paulo — 05/11/2026

## Escopo e fonte de cada prova

Esta revisão cobre somente o simulador CAIXA. A matriz interna verifica
consistência matemática e limites configurados; não equivale a 326.592 propostas
enviadas ao banco nem demonstra aprovação bancária. A base comercial otimizada
solicitada pelo usuário permanece separada da compra e avaliação reais e pode
divergir da regra bancária oficial de menor compra/avaliação.

### Comparações observadas na interface pública

O coordenador conferiu no Chrome a
[calculadora pública CAIXA](https://simuladorhabitacao.caixa.gov.br/calculadora),
versão 1.16.0.2, em 05/11/2026, usando dados fictícios:

| Nascimento |        Renda |        Imóvel | Financiamento | Primeira parcela | Taxa efetiva exibida | Prazo | Sistema |
| ---------- | -----------: | ------------: | ------------: | ---------------: | -------------------: | ----: | ------- |
| 22/01/1987 |  R$ 4.999,00 | R$ 210.000,00 | R$ 168.000,00 |      R$ 1.138,01 |           7,23% a.a. |   420 | PRICE   |
| 22/01/1987 |  R$ 5.001,00 | R$ 210.000,00 | R$ 168.000,00 |      R$ 1.277,54 |           8,47% a.a. |   420 | PRICE   |
| 15/03/1956 | R$ 20.000,00 | R$ 500.000,00 | R$ 286.573,66 |      R$ 6.000,00 |          11,49% a.a. |   119 | SAC     |

O comparador independente reproduz esses resultados. A calculadora rápida não
coleta município, área, FGTS, dependentes ou composição familiar e não calcula
subsídio. A simulação completa exige CPF, telefone, verificação SMS e autorização
de contato. Nenhum telefone/CPF fictício foi submetido para contornar esse fluxo;
igualdade do subsídio com uma proposta bancária completa não foi demonstrada.

Outras **24 capturas reais da interface**, todas com nascimento 22/01/1987 e
referência 05/11/2026, estão preservadas como fixtures independentes em
`tests/caixa-public-reference.test.ts`. Valores monetários em reais:

|  Renda |  Imóvel | Financiamento | Primeira parcela | Taxa efetiva exibida |
| -----: | ------: | ------------: | ---------------: | -------------------: |
|  2.159 | 210.000 |    121.500,67 |           647,70 |                4,85% |
|  2.161 | 210.000 |    117.973,66 |           648,30 |                5,12% |
|  2.849 | 210.000 |    157.039,53 |           854,70 |                5,12% |
|  2.851 | 210.000 |    152.518,29 |           855,30 |                5,38% |
|  3.199 | 210.000 |    168.000,00 |           939,58 |                5,38% |
|  3.201 | 210.000 |    166.819,12 |           960,30 |                5,64% |
|  3.499 | 210.000 |    168.000,00 |           966,92 |                5,64% |
|  3.501 | 210.000 |    168.000,00 |         1.022,65 |                6,17% |
|  3.999 | 210.000 |    168.000,00 |         1.022,65 |                6,17% |
|  4.001 | 210.000 |    168.000,00 |         1.138,01 |                7,23% |
|  4.999 | 210.000 |    168.000,00 |         1.138,01 |                7,23% |
|  5.001 | 210.000 |    168.000,00 |         1.277,54 |                8,47% |
|  9.599 | 210.000 |    168.000,00 |         1.277,54 |                8,47% |
|  9.601 | 210.000 |    168.000,00 |         1.508,83 |               10,47% |
| 12.999 | 210.000 |    168.000,00 |         1.508,83 |               10,47% |
| 13.001 | 210.000 |    168.000,00 |         1.994,36 |               11,49% |
|  4.000 | 209.999 |    167.999,20 |         1.022,65 |                6,17% |
|  4.000 | 210.001 |    157.599,38 |         1.200,00 |                8,47% |
|  4.000 | 274.999 |    157.599,38 |         1.200,00 |                8,47% |
|  4.000 | 275.001 |    157.599,38 |         1.200,00 |                8,47% |
|  4.000 | 399.999 |    157.599,38 |         1.200,00 |                8,47% |
|  4.000 | 400.001 |    133.034,26 |         1.200,00 |               10,47% |
|  4.000 | 599.999 |    133.034,26 |         1.200,00 |               10,47% |
|  4.000 | 600.001 |    100.235,63 |         1.200,00 |               11,49% |

Todas reproduzidas em centavos pelo comparador. Os resultados foram capturados
por preenchimento, cálculo e leitura da lista visível oficial, sem gerar os
valores esperados pelo próprio helper. O limite 275.000 não muda a taxa da
calculadora pública genérica; o município São Paulo é considerado na matriz
do perfil, não nessa interface que não solicita localização.

### Correção comprovada do prazo

O motor individual usava a diferença entre meses do calendário até a data-limite,
descartando o dia do aniversário; no último cenário acima produzia 118 meses.
Agora usa `966 - idade em meses completos`, limitado a 420, descontando o prazo
de construção informado. Em 05/11/2026: nascimentos 04/03 e 05/03/1956 resultam
118 meses; 06/03 e 15/03/1956 resultam 119. Foram preservadas validações de data,
maioridade, prazo positivo e período de obra. Não mudou taxa, cota ou subsídio.

## Matriz interna reproduzível

`tests/caixa-boundary-matrix.test.ts` executa **326.592 combinações**:

- Renda R$ 1 abaixo, no limite e R$ 1 acima de 2.160, 2.850, 3.200, 3.500,
  3.700, 4.000, 5.000, 9.600 e 13.000.
- Imóvel R$ 1 abaixo, no limite e R$ 1 acima de 275.000, 400.000 e 600.000.
- São Paulo/SP, apartamento novo na planta; todas as áreas inteiras de 15 a 70m².
- Um a três proponentes; com e sem dependentes; cotista e não cotista; SAC e PRICE.
- Nascimentos rotativos: 05/11/2008, 22/01/1987, 06/11/1976, 15/03/1956 e
  05/06/1946. Não é produto cartesiano completo das idades.

Resultado: **279.552 cálculos válidos**, **47.040 rejeições de domínio**, zero
violação de finitude, cota, capacidade de renda, prestação, prazo, teto regional
de subsídio ou reconciliação de financiamento + subsídio + entrada. As rejeições
incluem renda acima de R$ 13.000 e imóvel acima de R$ 600.000 no produto MCMV.
A matriz física anterior de 508.032 cenários foi reaproveitada e passou também.

## Taxas, subsídio, anuais e classificação

A página [MCID — linha financiada](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts),
atualizada em 28/10/2026 e consultada nesta revisão, confirma para cotistas em SP
as taxas nominais 4,25/4,50/4,75/5,00/5,50/6,50/7,66/10%, nos limites de renda
2.160/2.850/3.200/3.500/4.000/5.000/9.600/13.000. O teste verifica R$ 1 antes e
depois de cada transição. Taxa efetiva da calculadora pública não substitui essa
tabela nominal do perfil.

A cópia local do **MFOM Habitação v034**, vigência 22/04/2026, foi relida nas
páginas 130–134. SHA256:
`896f9f11aae2add4a9cd7f4e70301b08512b2606ca3b7e301e90f4511217e830`.
O arquivo foi previamente obtido da fonte oficial; nova obtenção do PDF oficial
retornou redirecionamentos. A cópia prova seu próprio conteúdo, não a ausência
de versão posterior. Seções verificadas:

- §2.2: desconto de equilíbrio relativo a juros, com linhas de renda até R$ 5.000.
- §3.1.1.1: fator renda com Dmax 50.000, Dmin 1.900, RDmax 1.750 e RDmin 3.700.
  O texto consultado não manda limitar a renda da parábola a 3.700; não foi
  introduzido um limitador especulativo para tornar a curva monotônica.
- §3.1.1.8: **desconto complemento limitado à renda R$ 4.000** e resultado da
  fórmula a partir de R$ 1.500. Assim, a frase genérica de descontos até R$ 5.000
  no portal MCID não comprova erro no corte de R$ 4.000 do complemento.
- §3.1.2: redutores posteriores de 70% para família unipessoal e 50% para usado;
  §3.1.2.3: unipessoal é um indivíduo sem dependentes. O código preserva essa
  distinção; dois ou três proponentes não recebem o redutor unipessoal.

As anuais já eram geradas automaticamente pelo calendário canônico: renda/2,
limitadas pelo saldo e por datas válidas anteriores à entrega. Com renda R$ 4.000
e entrega em dezembro/2029, são quatro anuais de R$ 2.000; entrega em junho/2029
permite três, sem criar uma quarta anual após a entrega. A classificação já aceita
**Linear OU Decrescente aprovado**. Alteração visual torna anuais existentes
visíveis, mas não aumenta limites nem relaxa ranking.

## Validação e limites

Node 24.19.0, Windows. Comando focado:
`pnpm exec vitest run tests/caixa-boundary-matrix.test.ts tests/caixa-calculator.test.ts tests/caixa-physical-domain.test.ts tests/caixa-public-reference.test.ts`.
Os quatro arquivos passaram inicialmente com **81 testes**; a nova matriz foi
reexecutada com contagens exatas (nove testes aprovados), e as 24 fixtures oficiais
adicionadas depois passaram no arquivo público (31 testes aprovados). São
**105 testes distintos aprovados** no conjunto final. Não foram executadas transações,
propostas reais, gravações de clientes nem alterações de outros simuladores.
CI e publicação são verificadas e registradas pelo coordenador no SHA final.
