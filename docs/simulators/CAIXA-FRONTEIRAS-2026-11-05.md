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
subsídio. Posteriormente, o coordenador conseguiu consultar a simulação completa
em sessão autenticada; as amostras e seus limites estão separados abaixo.

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
  O trecho consultado não explicita o limitador superior. A aplicação desse
  limitador foi comprovada posteriormente por cinco amostras independentes
  da simulação completa, documentadas abaixo; não é atribuída somente ao PDF.
- §3.1.1.8: **desconto complemento limitado à renda R$ 4.000** e resultado da
  fórmula a partir de R$ 1.500. Assim, a frase genérica de descontos até R$ 5.000
  no portal MCID não comprova erro no corte de R$ 4.000 do complemento.
- §3.1.2: redutores posteriores de 70% para família unipessoal e 50% para usado;
  §3.1.2.3: unipessoal é um indivíduo sem dependentes. O código preserva essa
  distinção; dois ou três proponentes não recebem o redutor unipessoal.

### Subsídio: confronto posterior com a simulação completa

Em 05/11/2026, o coordenador observou a interface autenticada
[Simulador Habitacional CAIXA](https://simuladorhabitacao.caixa.gov.br/simulacao).
Cenário: São Paulo/SP; imóvel novo de R$ 275.000; nascimento 22/01/1987;
FGTS por pelo menos três anos; mais de um comprador e/ou dependente; sem
subsídio anterior; MCMV Recursos FGTS, imóvel vinculado a empreendimento
financiado pela CAIXA. A interface não solicitou área ou tipo casa/apartamento.

|    Renda |     Subsídio oficial | Financiamento SAC observado |
| -------: | -------------------: | --------------------------: |
| R$ 3.700 |             R$ 2.164 |               R$ 147.418,22 |
| R$ 3.750 |             R$ 2.153 |               R$ 149.528,43 |
| R$ 3.900 |             R$ 2.119 |               R$ 155.859,08 |
| R$ 3.999 |             R$ 2.099 |               R$ 160.037,30 |
| R$ 4.000 |             R$ 2.099 |               R$ 160.079,51 |
| R$ 4.001 | Sem subsídio exibido |               R$ 143.319,80 |

Prazo de 420 meses, taxa nominal de 5,5% e cota de 80% nessa modalidade
específica. Para renda de R$ 4.000, a primeira prestação SAC foi R$ 1.200; no
PRICE, financiamento de R$ 206.357,81 e mesmo subsídio de R$ 2.099. Essas cifras
de financiamento são evidências observadas, ainda não assertivas de igualdade
do motor: produto de seguro e demais encargos precisam ser confrontados. A cota
observada não redefine automaticamente outros produtos. A renda de R$ 4.001 já
não apresentou subsídio, preservando o corte de elegibilidade do complemento.

O defeito identificado era extrapolar a parábola do Fator Renda além do seu
mínimo em R$ 3.700, fazendo o fator voltar a crescer até R$ 3.038,46 na renda de
R$ 4.000. Agora somente a renda aplicada a esse fator é limitada a R$ 3.700,
mantendo Dmin = R$ 1.900; a renda real permanece no Dfin e altera FDfin. Com
FUH = 0, os resultados antes do truncamento para as rendas de R$ 3.700, R$ 3.750,
R$ 3.900 e R$ 4.000 são R$ 2.164,918775, R$ 2.153,482596, R$ 2.119,174060 e
R$ 2.099,196, respectivamente. O truncamento final em reais reproduz as cinco
observações com subsídio. Não foi alterada a base VVI de 67,5% do limite
municipal, nem o teto de renda de R$ 4.000 do complemento.

`tests/caixa-official-complete.test.ts` preserva as cinco amostras com subsídio.
Área de 32 m² foi usada no contrato local por produzir FUH = 0; a interface
completa não fornece evidência para provar equivalência nas áreas com FUH
positivo. A fórmula MFOM por área é preservada, mas sua validade matemática não
representa confronto oficial de todas as áreas. Tampouco se infere um limitador
inferior em R$ 1.750: em São Paulo, esses resultados saturam o teto regional e
não permitem identificar esse efeito.

A confirmação posterior com apenas um comprador sem dependentes trouxe:

|    Renda | Taxa nominal |     Subsídio oficial | Financiamento SAC observado |
| -------: | -----------: | -------------------: | --------------------------: |
| R$ 3.200 |        4,75% |             R$ 1.764 |               R$ 138.493,17 |
| R$ 3.250 |        5,00% |             R$ 1.564 |               R$ 136.423,07 |
| R$ 3.265 |        5,00% |             R$ 1.502 |               R$ 137.095,55 |
| R$ 3.266 |        5,00% | Sem subsídio exibido |               R$ 137.140,38 |

A renda de R$ 3.250 distingue a ordem de operações: o resultado antes do redutor
é R$ 5.213,490297. Reduzir 70% e truncar no final produz R$ 1.564; truncar antes
do redutor produziria R$ 1.563. A observação confirmou o truncamento final após
o redutor. Essas duas amostras foram adicionadas às fixtures independentes.

Para renda de R$ 3.300, apenas um comprador sem dependentes, a interface
completa não apresentou subsídio; financiamento SAC de R$ 138.664,68 e entrada
de R$ 136.335,32. Com renda de R$ 4.000 e a mesma composição unipessoal, também
não apresentou subsídio; financiamento de R$ 160.079,51 e entrada de
R$ 114.920,49. A interpretação anterior aplicava o piso de R$ 1.500 antes dos
redutores e produziria R$ 1.368 e R$ 629, respectivamente.

A fronteira com diferença de R$ 1 também foi observada: renda de R$ 3.265
recebeu R$ 1.502; renda de R$ 3.266 não recebeu subsídio, com entrada de
R$ 137.859,62. O valor matemático reduzido deste último caso seria
R$ 1.498,692909, abaixo do piso. Essa comparação confirma o corte sem criar um
limite de renda unipessoal arbitrário.

O comportamento observado comprova que o complemento automático precisa passar
pelo piso de R$ 1.500 **depois dos redutores**. A implementação foi corrigida
nesse ponto. A amostra positiva de R$ 3.250 evita confundir esse corte com a
supressão de qualquer subsídio unipessoal. O MFOM consultado fornece a fórmula,
o piso e os redutores; a ordem operacional foi confrontada na interface oficial,
sem atribuir ao texto uma instrução que ele não explicita. Subsídios confirmados
manualmente permanecem com os centavos informados, sem alteração de contrato.

### Limite da comparação do financiamento: seguros

O financiamento PRICE de R$ 206.357,81 na simulação completa com Seguro
Habitacional Mais difere dos R$ 209.416,34 da estimativa rápida do perfil. Essa
diferença, isoladamente, não demonstra erro na fórmula PRICE. O agente de
pesquisa conferiu as [condições do Seguro Habitacional Mais](https://cdn.caixaseguradora.com.br/AreaAberta/Habitacional/CondicoesGerais/Seguro-Habitacional-Mais.pdf),
cláusula 14 na página 9, cláusulas 8–9 na página 20 e cláusulas 9–10 na página
31: os coeficientes dependem da apólice, sem uma tabela universal estabelecida
nessa fonte. MIP e DFI precisam ser comparados com os mesmos dados de seguro.
Não foram inferidos novos coeficientes a partir de uma única amostra, nem
alterados seguros para forçar igualdade entre produtos diferentes.

As expectativas antigas de R$ 3.357,01 (área de 32 m² e taxa de 5,5%) e
R$ 3.638,05 (área de 50 m² e taxa de 6%) eram produtos da extrapolação incorreta;
foram substituídas por R$ 2.099 e R$ 2.274. Subsídios confirmados manualmente
permanecem com os centavos fornecidos. A correção reduz o abatimento e pode
retirar aprovações que dependiam do subsídio superestimado; nenhum limite do
ranking foi relaxado para preservar a contagem anterior.

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

### Revalidação após correção do subsídio

Após limitar o Fator Renda, aplicar o piso após redutores e truncar o resultado
final, passaram **149 testes em oito arquivos**: `caixa-calculator`,
`caixa-commercial-funding`, `caixa-available-units`, `caixa-unit-proposal-view`,
`caixa-boundary-matrix`, `caixa-physical-domain`, `caixa-unit-capacity` e
`caixa-official-complete`. A execução incluiu novamente as matrizes de 326.592 e
508.032 cenários, pois a alteração do piso invalidava as evidências anteriores
para famílias unipessoais. Os casos completos independentes incluídos nessa
rodada somam 12 testes, entre amostras observadas e invariantes locais.

A correção do subsídio invalidou dois asserts antigos de capacidade, relativos
ao comprometimento e à aprovação simultânea dos dois fluxos. A unidade de
R$ 260.000 permanece disponível pelo Linear, sem exigir aprovação do
Decrescente. O limite Ouro permaneceu intacto.

Na suíte de navegador, 14 casos passaram na primeira execução; o caso restante
usava imóvel de R$ 255.000 que, com o subsídio corrigido, já reprovava o
Decrescente (20,59%). A fixture foi ajustada para R$ 249.000 para continuar
testando a transição de aprovação e impressão; o reteste passou. São 15 casos
de navegador cobertos, com ranking e regras preservados. A alteração posterior
do piso unipessoal não afeta o perfil familiar desse teste. Evidências anteriores
da calculadora pública permanecem válidas para o comparador independente, que
não calcula subsídio.

As últimas duas fronteiras oficiais unipessoais, rendas de R$ 3.265 e R$ 3.266,
foram acrescentadas depois da rodada de 149 testes. Apenas o arquivo
`caixa-official-complete` foi reexecutado: **14 testes aprovados**. O motor não
mudou depois da rodada anterior; as matrizes não foram repetidas. O conjunto
financeiro final contém **151 testes distintos aprovados** nesses oito arquivos.
