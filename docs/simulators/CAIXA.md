# Simulação CAIXA: referência, matemática e limites

Consultas: 25, 26 e 27/10/2026, America/Sao_Paulo. Escopo exclusivo:
`/app/simulacao/caixa`.
A origem `https://descomplicapro.com.br/simulacao/caixa` foi consultada somente
por leitura pública. Nenhum arquivo ou configuração daquele site foi alterado.

## O que foi reproduzido

Formulário cliente/imóvel, abas Simulador, Documentos (perfil e duas fases),
Diagnóstico e Utilitários (amortização extraordinária e tempo de FGTS), resumo,
impressão, compartilhamento e cenário de juros durante a obra. Conteúdo público
de municípios foi complementado com os limites geográficos da planilha oficial
`TABELA_MUNICIPIOS_VIGENCIA_01JAN2026.xlsx`, sem presumir subsídio ou aprovação.
O shell autenticado do CRM permanece único. Nenhuma proposta é salva remotamente.

A réplica preserva o fluxo e o conteúdo útil; não perpetua uma informação
financeira que contradiz as fontes oficiais nem apresenta estimativas como
aprovação. Campos adicionais permitem registrar parâmetros confirmados na CAIXA.
O motor novo é isolado em `lib/crm/simulators/caixa.ts`. O motor legado órfão
`lib/archive-investor/caixa-rules.mjs` não é utilizado pela página.

## Interface e acesso

Desde 28/10/2026, a página usa a mesma linguagem visual compacta dos simuladores
Associativo e Tabela Direta e os tokens de Agendamentos. Os campos ficam em grade
sem cartões de fundo redundantes; limite de parcela e limite aplicável aparecem
diretamente sob renda e imóvel. Parâmetros e juros de obra ficam recolhidos até
o usuário solicitar. Os temas claro, médio e escuro compartilham a mesma
estrutura e mantêm contraste, teclado, zoom e adaptação móvel.

O cálculo é local ao navegador, não envia proposta e não persiste os dados do
formulário. Ele está disponível a todos os papéis operacionais ativos que possuem
`crm.simulators.view`. A rota continua protegida por sessão, catálogo, permissão,
estado da conta, escopo e overrides individuais; contas pendentes, inativas ou com
negação explícita não recebem acesso. A API de simulador oficial da CAIXA permanece
fechada porque não possui contrato de entrada/saída nem calculadora server-side.
Essa separação impede que a liberação da interface seja interpretada como uma
integração bancária ou aprovação de crédito.

O resumo é recalculado automaticamente quando qualquer entrada muda. Não existe
botão de cálculo nem estado de resultado antigo: se um requisito deixa de estar
preenchido, o resumo é ocultado até que o cenário volte a ser válido. A mudança é
de interação e apresentação; fórmulas, tetos e regras financeiras permanecem no
motor isolado e continuam cobertos pelos testes do simulador.

O formulário principal aplica automaticamente 30% da renda como teto indicativo,
mostra o limite municipal ao selecionar cidade/UF e reduz o prazo ao máximo
permitido pela idade. `Imóvel na planta = Sim` fixa a condição como `Novo`; ao
selecionar `Não`, a condição é limpa e o usuário precisa escolher `Novo` ou
`Usado`. Esses valores não precisam mais ser procurados no bloco opcional.

## Autoridades consultadas

1. [Portaria MCID 333, de 30/03/2026, DOU 01/04/2026](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/arquivos/PORTARIAMCIDN333DE30DEMARODE2026PORTARIAMCIDN333DE30DEMARODE2026DOUImprensaNacional.pdf).
   Faixas urbanas: 1 até R$ 3.200; 2 até R$ 5.000; 3 até R$ 9.600; programa
   financiado/classe média até R$ 13.000. Valores brutos familiares mensais.
2. [MCID: MCMV linha financiada](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts),
   atualizado em 28/06/2026. Tabela nominal anual, diferenciação regional e cotista;
   imóveis faixas 1/2 entre R$ 210 mil e R$ 275 mil conforme município, faixa 3
   até R$ 400 mil e classe média até R$ 600 mil; prazo até 420 meses.
3. [Manual de Fomento Habitação CAIXA v034](https://www.caixa.gov.br/Downloads/fgts-manual-fomento-agente-operador/MFOM_HABITACAO_VERSAO_034.pdf),
   vigência 22/04/2026, obtido por GET público (a ferramenta web encontrou ciclo
   de redirecionamento; download HTTPS normal retornou 200). Páginas 96–101:
   classe média usado Sul/Sudeste até 60%; contrapartida normativa mínima 20%,
   podendo chegar a 10% em SAC; SAC e alternativa; tarifa de administração até
   R$ 25. Estes são tetos normativos, não oferta individual da CAIXA.
4. Mesmo manual, pp. 125–133: descontos em conjunto até renda R$ 5 mil; desconto
   complemento exige renda até R$ 4 mil e resultado mínimo R$ 1.500. Sua fórmula
   inclui RD, FD, fatores municipais/FUH, área/tipo do imóvel, modalidade e
   redutores. Teto regional R$ 65 mil no Norte/R$ 55 mil nas demais regiões,
   podendo haver tetos menores (pronto CCI R$ 49.500). O motor coleta os fatores
   necessários, calcula o valor indicativo e mantém a confirmação manual como
   substituição explícita; a concessão continua sujeita à análise da CAIXA.
5. [CAIXA: perguntas frequentes de financiamento](https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx),
   consultada em 26/10/2026: cota de financiamento de até 90%, variável conforme
   modalidade, recursos e sistema; valor do imóvel para a operação corresponde ao
   menor entre compra/venda e avaliação da engenharia CAIXA. A regra comercial
   solicitada para esta página é 90% no SAC e 80% no Price para SBPE. A cota
   aprovada, quando informada, só pode reduzir esses tetos.
6. [CAIXA: SBPE, 09/12/2025](https://caixanoticias.caixa.gov.br/Paginas/Not%C3%ADcias/2025/12-DEZEMBRO/CAIXA-volta-a-permitir-mais-de-um-financiamento--imobiliario-pelo-SBPE.aspx):
   registro histórico de cotas 80% SAC/70% Price e juros efetivos a partir de
   10,99% a.a. Não foi usado para contrariar a configuração vigente solicitada;
   permanece documentado para evidenciar que condições comerciais mudam.
7. Mesma FAQ da CAIXA:
   MIP depende de idade e participação de renda, DFI da avaliação. Não reutilizar
   a tabela de seguros fixa da referência como apólice universal.
8. [CAIXA: lote urbanizado/FAQ geral](https://www.caixa.gov.br/voce/habitacao/lote-urbanizado/Paginas/default.aspx)
   e [Cartilha PF construção v12/dezembro de 2025](https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/cartilha-habitacao-PF-construcao-conclusao-reforma-ampliacao-de-unidades-habitacionais.pdf):
   proponente mais velho, obra e amortização dentro de 80 anos e seis meses;
   comprometimento até 30%, conforme produto e análise. Não foi comprovado
   limite universal de 360 meses no SBPE Price ou 25% fixos para todo Price.
9. [Simulador oficial](https://simuladorhabitacao.caixa.gov.br/).
   `/home` e `/simulacao` retornaram HTTP 404 contendo shell Angular; a raiz
   retornou HTTP 200. A calculadora rápida pública foi exercitada apenas com dados
   fictícios; a simulação completa exige CPF, celular, consentimento e código de
   verificação, portanto não foi submetida. Não foram acessados dados privados nem
   contratada operação.
10. [Tabela de municípios do Agente Operador do FGTS, vigência 01/01/2026](https://www.caixa.gov.br/Downloads/fgts-tabela-municipios/TABELA_MUNICIPIOS_VIGENCIA_01JAN2026.xlsx),
    ligada pela página vigente do MCID. Foram importados 5.571 municípios, com
    limites da menor faixa entre R$ 210 mil e R$ 275 mil. A planilha ainda usa
    títulos de colunas anteriores para renda e Classe Média; por isso ela é
    autoridade apenas para o recorte geográfico, enquanto renda, tetos nacionais
    e taxas seguem as fontes de 2026 acima. Seis diferenças históricas de nomes
    na lista local são conciliadas por aliases explícitos, sem fallback silencioso.
11. [IBGE REGIC 2018 — base municipal](https://geoftp.ibge.gov.br/organizacao_do_territorio/divisao_regional/regioes_de_influencia_das_cidades/Regioes_de_influencia_das_cidades_2018_Resultados_definitivos/base_tabular/REGIC2018_Municipios_Hierarquia_e_regiao.xlsx)
    e [estimativas municipais de população 2026](https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2026/estimativa_dou_2026.xlsx),
    cruzadas com o Anexo IV do MFOM v034 para versionar `Fpop`. O cruzamento
    encontra 5.570 dos 5.571 municípios atuais; a exceção posterior à REGIC não
    recebe fallback silencioso.

### Referência pública da calculadora rápida

O recurso público carregado pela calculadora em 26/10/2026 identificou a versão
`1.16.0.2`, data `06/07/2026 #1`, prazo de 35 anos, tarifa de referência de R$ 25,
DFI de referência de 0,0066% ao mês e coeficientes MIP por idade. As taxas efetivas
por renda observadas no recurso são mantidas numa tabela versionada no motor. Elas
só preenchem lacunas quando a opção de estimativa rápida estiver marcada; valores
confirmados na proposta sempre prevalecem.
Ao selecionar SBPE, a estimativa usa 11,49% efetivos a.a. até renda de R$ 77.500
e 13,40% acima desse valor. As taxas menores da tabela rápida correspondem ao
enquadramento MCMV escolhido automaticamente pelo site e não são reutilizadas
como taxa SBPE de famílias com renda menor.

Cenários fictícios observados na interface pública, em 26/10/2026:

- nascimento 15/03/1991, renda R$ 6.000, imóvel R$ 300.000: entrada mínima
  R$ 60.704,70, financiamento R$ 239.295,30, taxa efetiva 8,47% a.a., Price,
  primeira parcela R$ 1.800 e 420 meses;
- nascimento 15/03/1991, renda R$ 20.000, imóvel R$ 500.000: entrada R$ 100.000,
  financiamento R$ 400.000, taxa efetiva 11,49% a.a., SAC, primeira parcela
  R$ 4.698,75 e 420 meses;
- nascimento 15/03/1956, mesma renda e imóvel: financiamento R$ 286.573,66,
  taxa efetiva 11,49% a.a., SAC, primeira parcela R$ 6.000 e 119 meses;
- nascimento 15/03/1991, renda R$ 3.000, imóvel R$ 210.000: financiamento
  R$ 161.859,07, taxa efetiva 5,38% a.a., Price, primeira parcela R$ 900 e
  420 meses.
- nascimento 22/01/1987, renda R$ 4.000, imóvel R$ 276.000: taxa efetiva
  8,47% a.a. (nominal equivalente de 8,16%), Price, primeira parcela de
  R$ 1.200 e 420 meses. O valor acima do limite inferior promove a estimativa
  para a primeira linha que comporte renda e imóvel, sem bloquear a simulação;
- nascimento 22/01/1955, mesma renda e imóvel: taxa efetiva 8,47% a.a., Price,
  primeira parcela de R$ 1.200 e prazo máximo de 105 meses.

A calculadora pública declara que são parâmetros médios e que a condição final
depende da simulação completa e análise. Por isso fixtures de regressão aceitam a
diferença de arredondamento do cálculo público, enquanto uma proposta individual
só pode ser reproduzida exatamente com seus valores confirmados.

## Memória matemática

Para principal `P`, taxa nominal anual percentual `j` e prazo `n`:

- Taxa mensal `i = j / 1200`.
- Price: `A = P × i / (1 − (1+i)^(-n))`; com `i=0`, `A=P/n`.
- SAC: amortização mensal `P/n`; primeira parcela financeira `P/n + P×i`.
- Efetiva anual matemática `(1+i)^12 − 1`, sem confundir com CET.
- Capacidade indicativa com encargos confirmados: `(prestação limite − seguros −
tarifa) / fator financeiro`. Quando a estimativa rápida está ativa e o MIP depende
  do saldo, divide-se por `fator financeiro + coeficiente MIP`; limitar por quota e
  necessidade de recursos. Financiamento
  arredondado para baixo no centavo; exibição monetária em centavos.
- A quota incide sobre `min(valor de compra, avaliação CAIXA)`. Sem avaliação, a
  página usa provisoriamente o preço e exibe a pendência. SBPE usa teto de 90% SAC
  e 80% Price; uma cota individual confirmada pode ser menor.
- O comprometimento padrão é `renda × 30%`. Uma prestação aprovada informada pode
  reduzir o valor usado, nunca ultrapassar esse teto indicativo.
- Nas Faixas 1 e 2, o limite municipal é obtido por cidade/UF. Quando o imóvel
  ultrapassa esse limite e não supera R$ 400 mil, a estimativa rápida aplica a
  linha da Faixa 3: 8,16% nominal, ou 7,66% para cotista elegível. Acima de
  R$ 400 mil e até R$ 600 mil, aplica-se Classe Média a 10% nominal. O resultado
  identifica expressamente quando a taxa foi elevada pelo valor do imóvel.
- O prazo máximo é o menor entre 420 meses e o intervalo, em meses-calendário,
  até o proponente mais velho completar 80 anos e 6 meses, menos a obra somente
  quando seu prazo foi informado. Prazo solicitado acima do máximo é reduzido e
  avisado, como na calculadora pública; limite igual a zero continua inválido.
- Entrada adicional: `max(0, imóvel − financiamento − recursos − FGTS − desconto
complemento − aporte público confirmado)`. Desconto FGTS e aporte MCMV Cidades são
  campos distintos; recursos próprios informados já são parte da entrada.
- MIP, DFI e tarifa confirmados prevalecem. Se ausentes e a opção rápida estiver
  ativa, o resultado os identifica como estimados pela referência versionada; se
  a opção for desligada, permanecem ausentes e o resultado é parcial. TR futura
  não é prevista.
- Amortização extraordinária compara preservar prazo ou a dinâmica financeira
  original, com saldo reduzido pelo aporte. Ao reduzir prazo, Price preserva
  a prestação financeira; SAC preserva a amortização original `P/n`, enquanto
  os juros incidem sobre o novo saldo. Não há TR, seguros ou tarifas futuros
  incluídos, nem autorização de amortização do contrato real.
- Obra: cenário de liberação linear a partir do progresso informado; o primeiro
  mês representa a primeira evolução e o último atinge 100% da liberação; juros
  mensais sobre saldo liberado. TR anual hipotética convertida por
  `(1+TR_anual)^(1/12)−1`, separada dos juros. Não é medição real nem cobrança
  contratual; não se aplica a regra de evolução de obra do Associativo.
- FGTS: união dos intervalos evita dupla contagem de empregos simultâneos;
  datas inválidas/futuras impedem indicação. Dias/anos são aproximação do tempo;
  tempo contributivo e demais requisitos dependem do extrato e validação CAIXA.

## Diferenças necessárias frente à referência

### Fórmula operacional do desconto complemento

MFOM v034, pp. 131–133, §§3.1.1–3.1.2. O formulário coleta tipo e área oficial
da unidade e dependentes quando a renda permite o desconto. Município/UF
selecionam automaticamente o fator populacional versionado; nenhum fator é
presumido quando a fonte não possui correspondência.

```text
D = Frenda × [1 + (FDr + FDfin + FUH)/100] × Fpop
Frenda = a(R − RDmax)² + b(R − RDmax) + Dmax
a = −b / [2(RDmin − RDmax)]
b = 2Dmax(Dmin/Dmax − 1) / (RDmin − RDmax)
Dmax = 50000; Dmin = 1900; RDmax = 1750; RDmin = 3700

Dfin = 0,25R × [(1+j)^420 − 1] / [(1+j)^420 × j]
FDfin = 10 − 40(Dfin/VVI − 0,5)
VVI = min(valor de venda/investimento, 0,675 × teto do Anexo I)

FUH apartamento = 10(A − 39)/(59 − 39)
FUH casa = 10(A − 46)/(66 − 46)
```

`R` é renda familiar mensal bruta; `j` é a taxa mensal da tabela pertinente.
O coeficiente 0,25 nessa fórmula não define aprovação a 25% da renda.
`FDr` vem do Anexo III; `Fpop`, do Anexo IV (tabela A ou B para Norte), cruzado
com a hierarquia REGIC 2018 e a estimativa populacional municipal IBGE 2026.
Os fatores têm peso limitado a dez pontos; `FUH` é limitado entre zero e dez.
`A` corresponde à área definida pelo manual: privativa real coberta para
condomínio conforme NBR 12721/2006; isolado usa área construída com exclusões
de áreas de padrão diferente, beirais e garagens. Não substituir por uma área
comercial sem conferir sua definição.

Além da expressão, aplicam-se condições e redutores: renda até R$ 4 mil,
resultado mínimo R$ 1.500, teto regional R$ 55 mil/R$ 65 mil e teto próprio de
R$ 49.500 para pronto CCI. Terreno próprio reduz 20% (com exceção prevista para
doação pública); família unipessoal reduz 70%, restando 30%; imóvel usado
reduz 50%; retomado pode reduzir 30% somente nas condições do §3.1.2.4. Se o
resultado exceder o teto, o redutor incide sobre o teto. Unipessoal pode acumular
com outros redutores. Não confundir um proponente com família unipessoal:
esta definição exige indivíduo sem dependentes. A exceção histórica de usado
com contratação/trâmite até 01/12/2023 não se aplica a uma operação nova em 2026.

O ponto de renda RDmin=3700 da curva não substitui o limite de elegibilidade
R$ 4000. Também não se deve substituir esse limite pelo de R$ 5000, referente
ao conjunto de descontos. Esses detalhes e a falta de FUH/município explicam
por que copiar a fórmula reduzida da referência não comprova o desconto real.

A expressão de `Frenda` acima é a transcrição do MFOM034, p. 131, §3.1.1.1.
O PDF oficial consultado em 27/10/2026 tem SHA-256
`896f9f11aae2add4a9cd7f4e70301b08512b2606ca3b7e301e90f4511217e830` e
traz os anexos III e IV como planilhas embutidas. O Anexo III confirma, entre
outros valores, `FDr=2,07` para SP. O Anexo IV confirma que `Fpop` varia por
hierarquia territorial e população (`0,85` a `1,20` na tabela geral e `1,25` a
`1,63` na tabela específica da Região Norte). Logo, cidade/UF sozinhas não
determinam o fator sem o recorte territorial oficial correspondente.

Nas pp. 131–133 consultadas não foi localizada regra explícita de saturação de
`R`/`Frenda` ou função por faixas após `RDmin`. A expressão literal atinge seu
mínimo em R$ 3.700 e volta a crescer acima desse ponto; o limite de concessão
de R$ 4.000, no §3.1.1.8, não esclarece essa lacuna operacional. Não presumir
congelamento, extensão monotônica ou piso da curva: o motor executa a expressão
literal do manual e identifica o resultado como indicativo. A página calcula e
abate automaticamente o complemento quando o cenário permite análise (`MCMV`,
renda até R$ 4 mil, imóvel até R$ 400 mil, sem subsídio anterior e fora de
Classe Média) e todos os fatores necessários estão presentes. O valor oficial
confirmado manualmente continua prevalecendo. Sem tipo, área, composição ou
fator territorial conhecido, a página mantém somente a elegibilidade e não
abate valor.

O cadastro territorial contém `Fpop` para 5.570 municípios. Boa Esperança do
Norte/MT, criada após a REGIC 2018, permanece sem fator automático para evitar
uma classificação inventada. A implementação limita `FDfin` e `FUH` entre
-10/+10 e 0/+10, respectivamente, aplica o teto de R$ 49.500 para imóvel pronto,
os tetos regionais, o mínimo de R$ 1.500 e os redutores de 50% para usado e 70%
para família unipessoal. O campo informativo de fator social não substitui a
definição de família unipessoal e não altera o valor.

Não forçar Price, migrar automaticamente para SBPE ou aceitar nascimento
inválido/menor como adulto. Não inventar um mês de prazo quando o limite é zero.
Não subtrair 36 meses de qualquer obra. Não somar períodos sobrepostos do FGTS.
Não fixar taxa SBPE, MIP/DFI, subsídio municipal ou prazo de baixa de restrição
sem prova. Diagnóstico é orientação informativa com resultado bancário já
informado pelo usuário, sem decidir crédito nem garantir aprovação.

## Segurança e validação

A [IN17 compilada, alterada pela IN4 de 08/04/2026](https://www.gov.br/cidades/pt-br/acesso-a-informacao/institucional/base-juridica/instrucoes-normativas/20260409_InstruoNormativan.17_Compilada.pdf),
art. 3, define Classe Média com renda limitada a R$ 13 mil, sem piso de
R$ 9.600. Por isso o enquadramento é automático inclusive para renda menor,
sem exigir uma escolha escondida no bloco opcional, com taxa de referência de
10%. Imóvel acima de R$ 400 mil ou renda acima de R$ 9.600 identificam esse cenário
expressamente no resultado, respeitando o teto de R$ 600 mil e a cota de usado
Sul/Sudeste. Não declarar uma família inelegível a todas as modalidades MCMV
apenas por superar o teto de imóvel da Faixa 3.

Os guards de servidor, catálogo e permissão compartilhada dos simuladores
permanecem. APIs official/commercial continuam fechadas para CAIXA: o cálculo
indicativo local não é integração bancária, workflow n8n nem motor oficial.
Não há migration, alteração de RLS, ACL, dados, contas ou configurações remotas.
Histórico eventual é somente memória da página. Compartilhamento exige ação
explícita do usuário; não enviar nomes/documentos automaticamente a terceiros.

Testes financeiros cobrem limites de faixa/taxa, idade/datas, cotas, recursos,
subsídio, finitude, prestação, Price/SAC, amortização, FGTS e cenário de obra.
Entradas monetárias extremas são recusadas também nos utilitários, antes de
gerar resultados não finitos; esses limites são proteções técnicas, não
ofertas ou limites comerciais. Taxas manuais MCMV não podem ultrapassar 10%.
A validação visual deve confrontar a nova página com a referência viva e
verificar desktop/celular, três temas, teclado, zoom, nomes acessíveis e estados
de erro. CI/merge/publicação são estados separados, registrados em ATUALIZACOES.

A regressão usa o Archive real e os estilos globais. Audita 12 combinações do
formulário e 24 estados entre resultado parcial, documentos, diagnóstico e
utilitários, nos três temas e em desktop/celular. Contraste é conferido também
em controles habilitados. Transições de cor/fundo que cruzavam um estado de
baixo contraste foram removidas somente no escopo CAIXA; não se usam esperas
ou exclusões de violações para obter aprovação.
