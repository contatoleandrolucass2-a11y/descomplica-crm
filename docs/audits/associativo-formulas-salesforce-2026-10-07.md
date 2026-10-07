# Associativo: reconstrucao das formulas Salesforce

Data: 2026-10-07. Status: validado na amostra; implementacao e paridade global pendentes.
Escopo: investigacao somente leitura. Nenhum motor, proposta ou politica foi alterado.

## Fonte e alcance

- Relatorio autorizado: [VENDAS COMPLETO AUTOMACAO](https://direcional.lightning.force.com/lightning/r/Report/00OU600000EjFyyMAF/view?queryScope=userFolders).
- A navegacao autenticada percorreu os dados resumidos das 1.120 oportunidades,
  distribuidas em 24 empreendimentos. A tabela nao contem as entradas completas
  dos motores; esse inventario NAO equivale a 1.120 simulacoes recalculadas.
- Comparacao financeira: 20 propostas com mensal linear, incluindo quatro
  referencias da conferencia anterior, e 13 comparativos decrescentes, com
  quatro valores de bloco em cada um. Duas vendas sem Mensal PS nao entraram
  nos denominadores de validacao.
- Prazos lineares conferidos: 24, 36, 38, 40, 42, 46, 48, 52, 69 e 84.
- As 20 mensais lineares coincidiram nos centavos. Dos 52 valores decrescentes,
  50 coincidiram; dois diferiram em R$ 0,01. Todos ficaram dentro da tolerancia
  de R$ 0,05 por parcela aceita pelo usuario. Nao arredondar para multiplos de
  cinco centavos: a tolerancia e de comparacao, nao uma nova regra monetaria.
- O codigo interno Salesforce nao foi obtido. As expressoes abaixo sao uma
  reconstrucao matematica confrontada com resultados observados, nao codigo
  oficial exportado nem prova de todas as combinacoes possiveis.
- Nao persistir nomes, rendas individuais, IDs de propostas, series reais,
  arquivos exportados do relatorio, cookies ou tokens neste repositorio.

## Entradas que nao podem ser confundidas

`P` e o principal nominal destinado exclusivamente as mensais. Recursos,
sinais e anuais nominais ja foram deduzidos. Nao deduzir anuais corrigidas
dessa base nem descontar anuais novamente depois de formar `P`.

A data financeira da unidade pode diferir da data do empreendimento e do
campo de conclusao mostrado na cotacao. A inspecao da secao Datas do Produto
Direcional resolveu divergencias de oito meses em unidades de dois
empreendimentos. Nao usar automaticamente a data geral do empreendimento.
Os campos dessa secao sao carregados sob demanda ao navegar ate ela.

Uma proposta historica pode manter resumo calculado com um calendario antigo,
enquanto sua tabela comparativa utiliza dados atuais da unidade. Foi observada
uma proposta com mensal diferente nessas duas superficies; ambas puderam ser
reconstruidas com os respectivos calendarios. Nao misturar o resultado salvo
com entradas atuais nem chamar essa diferenca, sem qualificacao, de erro de juros.

`n` e a quantidade de mensais. `m` e a quantidade de periodos pre-obra, limitada
ao intervalo de 0 a n. Nos casos conferidos, a diferenca entre competencias
da primeira mensal e da entrega financeira determina `m`; o proprio mes da
entrega ja entra no pos-obra. Isso foi confrontado com um caso cuja primeira
mensal ocorre antes do dia da entrega, mas na mesma competencia.

`k` e a correcao inicial das mensais. A data do primeiro juro e a primeira
mensal precisam ser preservadas. Nos registros com essas datas, o numero de
competencias entre elas, excluindo a competencia da primeira mensal, reproduz
os resultados. Nao derivar `k` somente da quantidade de sinais ou do dia atual.
Quatro referencias historicas nao expunham a data inicial: nelas foi utilizado
o numero de meses de correcao salvo, sem alegar validacao da data ausente.
Vencimentos no ultimo dia do mes, carencia negativa e outras fronteiras nao
observadas permanecem pendentes de fonte adicional.

O campo Total meses correcao usado no indicador de Pro-Soluto nao e sempre o
mesmo `k` necessario para as mensais. Uma das referencias necessita de tres
periodos nas mensais e dois no indicador. Nao acrescentar um mes fixo a todos
os casos para ajustar essa referencia.

As politicas inspecionadas usam `i_pre = 0.005` e `i_pos = 0.015` ao mes.
As taxas continuam parametros da politica, nao uma autorizacao para impor
esses valores a todos os produtos do relatorio.

## Base corrigida

Nas referencias conferidas:

```text
i_inicial = i_pre, se m > 0; caso contrario, i_pos
V = P * (1 + i_inicial)^k
```

`V` nao inclui novamente anuais ou sinais. A escolha da fase inicial foi
confrontada tambem com primeira mensal na competencia da entrega.

## Formula linear

Defina o fator de valor presente de uma anuidade:

```text
A(i, q) = (1 - (1 + i)^(-q)) / i, para q > 0 e i != 0
A(i, 0) = 0
A(0, q) = q

L = V / [A(i_pre, m) + (1 + i_pre)^(-m) * A(i_pos, n - m)]
```

O resultado monetario exibido e arredondado ao centavo. A formula cobre
planos totalmente pre, mistos e totalmente pos. Nao distribuir o mesmo peso
entre taxas nem aplicar uma unica taxa a todo plano misto.

## Formula decrescente

Os pesos monetarios dos blocos sao `w = [0.4, 0.3, 0.2, 0.1]`.

A particao que reproduziu os valores observados distribui o resto primeiro:

```text
q = floor(n / 4)
r = n mod 4
n_j = q + (j < r ? 1 : 0), para j = 0, 1, 2, 3
s_j = soma de n_h para h < j
u_j = min(n_j, max(m - s_j, 0))
v_j = n_j - u_j
C_j = (1 + i_pre)^min(s_j, m) * (1 + i_pos)^max(s_j - m, 0)

B_j = w_j * V * C_j /
      [A(i_pre, u_j) + (1 + i_pre)^(-u_j) * A(i_pos, v_j)]
```

Forma independente equivalente, descontando os pagamentos mes a mes:

```text
D_t = (1 + i_pre)^(-min(t, m)) * (1 + i_pos)^(-max(t - m, 0))
B_j = w_j * V / soma(D_t, t de s_j + 1 ate s_j + n_j)
```

Cada bloco conserva valor presente `w_j * V`. A soma do VP dos quatro blocos
e `V`, antes do arredondamento monetario. Essa prova nao significa que o total
nominal com juros seja igual a `V`.

Todos os blocos precisam considerar a capitalizacao anterior, inclusive
blocos 3 e 4 inteiramente pre-obra. O caso de 36 parcelas totalmente pre
reproduziu os quatro valores da fonte com essa regra.

Percentuais menores nao garantem uma sequencia estritamente decrescente de
mensais: juros acumulados podem tornar o segundo bloco maior que o primeiro.
Isso ocorreu na fonte e nao deve ser corrigido por uma limitacao artificial.

## Divergencia entre calculo e distribuicao visual

As seguintes particoes reproduziram os quatro valores dos respectivos casos:

| Prazo | Periodos da formula | Segmentos observados na tabela Salesforce |
| ----- | ------------------- | ----------------------------------------- |
| 38    | 10, 10, 9, 9        | 10, 10, 10, 8                             |
| 69    | 18, 17, 17, 17      | 18, 18, 18, 15                            |

Nao usar a segmentacao visual como prova da quantidade usada na formula.
A escolha de como apresentar datas, quantidades e total contratado exige
reconciliacao explicita na implementacao. A tolerancia por parcela nao
autoriza silenciosamente um total diferente.

## Diferencas do CRM antes da implementacao

- `associative-linear-calculator-rules.mjs` deduz anuais corrigidas da base
  mensal; as referencias usam principal mensal nominal antes da correcao.
- O calendario precisa da data financeira individual e de datas historicas
  coerentes. Aplicar a data geral a todas as unidades subestima algumas mensais.
- A carencia das mensais nao deve ser confundida com a correcao do indicador.
- `associative-decreasing-calculator-rules.mjs` usa `round(n / 4)` nos tres
  primeiros blocos. Isso diverge da particao equilibrada para restos 1 e 2.
- O helper capitaliza o principal pre anterior somente no bloco 2. Nos blocos
  3 e 4 totalmente pre, a mensal fica abaixo do equivalente observado.
- A matriz QA atual reproduz essa excecao; passar nela nao comprova paridade
  com Salesforce. Sao necessarios oraculos independentes por valor presente.
- A prestacao bancaria registrada nao deve ser substituida automaticamente
  por 30% da renda ao conferir comprometimento. Indicadores e classificacao
  comercial precisam de validacao propria, fora da tolerancia monetaria.

## Verificacao independente e limites

- Subagente `crm-simuladores`, Windows/PowerShell, Node v24.19.0, execucao
  efemera por stdin com `node:assert`, sem escrita ou servicos externos.
- 130.662 cenarios sinteticos: `n = 4..360`, todos os `m = 0..n`, duas bases
  sinteticas. Formula fechada confrontada com desconto acumulado mes a mes.
- Quantidades e VP fecharam; maior residuo de VP total inferior a 0.000001.
  O alcance numerico ate 360 nao estabelece prazo comercial autorizado.
- A varredura prova consistencia matematica da formula candidata; nao equivale
  a 130.662 respostas comparadas com Salesforce.
- A comparacao com fonte real ficou limitada aos 20 lineares e 52 valores
  de bloco declarados acima. Dois centavos residuais individuais ficaram
  dentro da margem aceita; a ordem interna exata de arredondamento permanece
  desconhecida. Nao criar ajustes especificos para registros particulares.
- Nao foram criadas propostas sinteticas remotas. Sem alteracao de Salesforce,
  CRM, n8n, politicas, contas ou dados. Implementacao e validacao integral do
  produto continuam fora deste diagnostico.

## Verificacoes locais da etapa documental

Ambiente: Windows/PowerShell, Node 24.19.0 e pnpm 11.20.0.

- `pnpm lint`: aprovado, com um aviso em arquivo local ignorado de
  `test-results/pr150-review/sheets.mjs` sobre variavel nao utilizada.
- `pnpm typecheck` e `pnpm build`: aprovados.
- `pnpm test`: 2.008 testes aprovados, seis falhos e seis ignorados. As seis
  falhas envolvem modos POSIX 0600/0700, propriedade de arquivos e verificacao
  de caminhos/symlinks em quatro suites, nao a comparacao financeira acima:
  `commercial-engine`, `mapping-import`, `homologation-legacy-canary-retirement`
  e `homologation-legacy-canary-retirement-backup`. O comando parou no Vitest;
  a etapa encadeada `node --test ops/salesforce/*.node-test.mjs` nao executou.
- `git diff --check`: aprovado. Somente documentacao foi alterada.
- Suite geral nao verde neste host; sem commit, publicacao ou reinicio de
  runtime nesta etapa. Nenhum teste foi enfraquecido para contornar as falhas.

## Implementacao solicitada em 07/10/2026

### Autoridade da data

- O usuario confirmou o campo `Data de termino da obra`. Leitura somente de
  metadados e agregados localizou `public.estoque_spc.data_termino_obra` no
  estoque legado. A API existente o expoe como `completionDate` por unidade.
- Conferencia de todos os 2.243 identificadores e datas da API com o banco:
  contagens iguais, identificadores unicos, sem datas ausentes e checksum
  MD5 agregado identico `c07f85bf14bd0c418ff7a9058162c5c4`. O checksum serve
  para reconciliacao, nao para autenticacao. Nao houve exportacao de estoque
  bruto, clientes, propostas, cookies ou credenciais.
- Mantidos proxy protegido e autorizacao antes do cache. No Associativo,
  snapshot nao libera selecao: a fonte viva e obrigatoria e uma data ausente
  nela nao recebe fallback da copia antiga. Investidor/Direta preservam contrato.
- A ficha identifica o campo correto. O mes do termino ja e pos-obra;
  unidades concluidas podem formar um plano inteiramente pos-obra.

### Calendario e contas

- Nos registros inspecionados com os dois campos disponiveis, `Data 1o juros`
  correspondeu ao ultimo dia do mes anterior a `Data de Calculo`. Propostas
  salvas podem manter uma data de calculo anterior a data corrente.
- O calendario automatico adota essa origem para uma nova simulacao. O grupo
  `Datas do calculo` permite conferir e informar primeiro juro/primeira mensal
  historicos, sem editar o termino da obra. Campos vazios ou datas impossiveis
  invalidam a simulacao; restaurar automaticas recalcula pela data corrente.
- `k = max(0, mesesCalendario(primeiroJuro, primeiraMensal) - 1)` para os
  vencimentos suportados 5/10/15. A mensal deve suceder entrada e sinais.
- Principal mensal desconta anuais nominais exatamente uma vez. Os pagamentos
  anuais corrigidos continuam separados no cronograma. Linear resolve o VP
  dos dois periodos; todos os quatro blocos acumulam juros anteriores.
- Quantidades, datas e totais usam a particao matematica equilibrada, sem
  copiar os segmentos visuais divergentes observados em 38/69 meses.
- Painel e busca de sugestoes usam `correctedProSoluto` no indicador de
  aprovacao, preservando a correcao propria da carencia. Nao substituir essa
  correcao pelo `k` mensal nem alterar limites comerciais.
- O adaptador TypeScript legado chama o motor canonico, evitando duas formulas
  divergentes. Nao houve alteracao do motor oficial desativado nem de n8n.

### Limites preservados

- A prova real continua limitada a 20 lineares e 52 valores decrescentes.
  Nao transforma o inventario de 1.120 oportunidades em 1.120 calculos validados.
- Os limites de Ranking, as projecoes de evolucao de obra e os juros anuais
  existentes nao receberam uma nova politica comercial. O maior desembolso
  mensal continua sendo a maior mensal com evolucao, conforme contrato local;
  isso nao representa uma prestacao bancaria real extraida do Salesforce.
- Ordem interna de arredondamento da fonte permanece desconhecida. A margem
  de R$ 0,05 vale por parcela, nunca para afrouxar aprovacao ou esconder
  diferencas de total. Sem ajustes especificos para um cliente/proposta.

### Validacao do candidato

- Node 24.19.0 / pnpm 11.20.0 em Windows. Lint sem erros (um aviso em artefato
  local ignorado); typecheck e build aprovados. Formatacao dos arquivos editados
  e `git diff --check` aprovados.
- 70 novos testes financeiros por VP independente; 78 testes de inventario;
  243 testes de integracao/calendario/ledger/matriz, incluindo 7.285 cenarios.
  Suites do adaptador e motores oficiais/Investidor: 113 aprovados.
- Suite integral reexecutada com dois workers: 2.168 aprovados, seis ignorados
  e as mesmas seis falhas de permissoes POSIX/caminhos no Windows, em quatro
  suites ja listadas acima. A primeira execucao tambem detectou expectativas
  antigas de ajuda/calendario, corrigidas, e dois timeouts Obsidian; a repeticao
  confirmou as correcoes e nao repetiu os timeouts. Nada foi ignorado para
  obter aprovacao. CI Linux integral permanece obrigatoria antes da promocao.
- Etapa Salesforce `node --test` executada separadamente: 15 aprovados.
- QA de navegador ampliado com estoque sintetico: fonte viva obrigatoria,
  datas distintas por unidade, campos invalidos/vazios, restauracao automatica
  e indisponibilidade HTTP 503. Execucao do navegador e release pendentes na CI.

### Primeira conferencia integral na CI

- CI `37577305243`, candidato `96081a7`, captura limpa `9f0c6640`: validacao
  Linux, seguranca de dependencias, banco, E2E e restore isolado aprovados.
- A nova continuidade parou antes das assercoes de calendario: o seletor de
  texto encontrou tanto o summary quanto o titulo da ajuda. Escopo corrigido
  para o summary; parcelas financeiras diferenciadas das de documentacao.
- Artefato `11463448905`, ZIP SHA-256
  `f47ec91d19acdac3dc61026a731941e1e554cda9cc55770a49ac4b98aef1fd66`.
  Nenhuma baseline promovida nem teste enfraquecido. Nova CI obrigatoria.

### Revisao de historicos e sugestoes

- Revisao independente encontrou dois caminhos sem cobertura inicial: entrada
  permanecia no dia atual ao informar uma mensal historica; busca de aprovacao
  acrescentava sinais posteriores a uma mensal fixada, ignorando a alternativa
  valida de concentrar o complemento na entrada.
- UI agora expoe Data do calculo e Data da entrada separadamente. A primeira
  alimenta o calendario da simulacao; a segunda alimenta entrada, sinais,
  cronograma, sugestoes e quatro cenarios. Valor vazio nao recebe fallback.
  Restaurar datas automaticas limpa as quatro substituicoes.
- Calendario de sinais reutiliza a funcao canonica, sem duplicar vencimentos.
  `maximumSignalCount` restringe apenas adicionais; sinais ja informados nao
  sao apagados e continuam sujeitos a validacao de datas e sequencia.
- 25 novas regressoes de sugestoes; 13 de calendario; seis do calendario de
  sinais compartilhado. Suites focadas: 105 de aprovacao, 416 de integracao e
  outros motores e 76 de paridade. QA inclui vazio, historico e restauracao.
- Nenhuma alteracao da data oficial da obra, taxas ou limites comerciais.

### Validacao local final da revisao

- Lint, typecheck, build, formatacao e diff aprovados em Node 24.19.0.
- Suite integral: 2.221 testes aprovados, seis ignorados e somente as seis
  falhas POSIX conhecidas no Windows. Os 15 testes Node Salesforce passaram.
  A CI Linux integral e a jornada autenticada continuam obrigatorias para
  este novo candidato; nao houve publicacao nesta etapa.

- CI `37581613136`: 2.224 testes Linux e 15 Node aprovados, nove skips de
  plataforma/fixtures existentes; banco, build, E2E e restore aprovados.
  A continuidade passou pelas datas invalidas e historicas, mas o seletor da
  data no ledger usava um ancestral externo dentro de `has`. Corrigido para
  procurar o campo Entrada dentro da propria linha, sem remover a assercao.
  Artefato `11465947336`, SHA-256 do ZIP
  `3e5c543bb55600f355ae21d5467bca588e4229d435b027bb78da49ca0a0c8b4a`.
