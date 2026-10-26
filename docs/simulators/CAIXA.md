# Simulação CAIXA: referência, matemática e limites

Consulta: 25/10/2026, America/Sao_Paulo. Escopo exclusivo: `/app/simulacao/caixa`.
A origem `https://descomplicapro.com.br/simulacao/caixa` foi consultada somente
por leitura pública. Nenhum arquivo ou configuração daquele site foi alterado.

## O que foi reproduzido

Formulário cliente/imóvel, abas Simulador, Documentos (perfil e duas fases),
Diagnóstico e Utilitários (amortização extraordinária e tempo de FGTS), resumo,
impressão, compartilhamento e cenário de juros durante a obra. Conteúdo público
de municípios foi extraído somente como nome e UF, sem fatores financeiros.
O shell autenticado do CRM permanece único. Nenhuma proposta é salva remotamente.

A réplica preserva o fluxo e o conteúdo útil; não perpetua uma informação
financeira que contradiz as fontes oficiais nem apresenta estimativas como
aprovação. Campos adicionais permitem registrar parâmetros confirmados na CAIXA.
O motor novo é isolado em `lib/crm/simulators/caixa.ts`. O motor legado órfão
`lib/archive-investor/caixa-rules.mjs` não é utilizado pela página.

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
   podendo haver tetos menores (pronto CCI R$ 49.500). O código não presume
   esses parâmetros: usa somente complemento informado como confirmado, com
   validações básicas de renda/teto; a conferência específica continua oficial.
5. [CAIXA: SBPE, 09/12/2025](https://caixanoticias.caixa.gov.br/Paginas/Not%C3%ADcias/2025/12-DEZEMBRO/CAIXA-volta-a-permitir-mais-de-um-financiamento--imobiliario-pelo-SBPE.aspx):
   cotas até 80% SAC/70% Price; juros efetivos a partir de 10,99% a.a.
   Não converter uma taxa mínima divulgada em taxa nominal individual fixa.
6. [CAIXA: perguntas frequentes de financiamento](https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx):
   MIP depende de idade e participação de renda, DFI da avaliação. Não reutilizar
   a tabela de seguros fixa da referência como apólice universal.
7. [CAIXA: lote urbanizado/FAQ geral](https://www.caixa.gov.br/voce/habitacao/lote-urbanizado/Paginas/default.aspx)
   e [Cartilha PF construção v12/dezembro de 2025](https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/cartilha-habitacao-PF-construcao-conclusao-reforma-ampliacao-de-unidades-habitacionais.pdf):
   proponente mais velho, obra e amortização dentro de 80 anos e seis meses;
   comprometimento até 30%, conforme produto e análise. Não foi comprovado
   limite universal de 360 meses no SBPE Price ou 25% fixos para todo Price.
8. [Simulador oficial](https://simuladorhabitacao.caixa.gov.br/).
   `/home` e `/simulacao` retornaram HTTP 404 contendo shell Angular; a raiz
   retornou HTTP 200. Não foram acessados dados privados ou contratada operação.

## Memória matemática

Para principal `P`, taxa nominal anual percentual `j` e prazo `n`:

- Taxa mensal `i = j / 1200`.
- Price: `A = P × i / (1 − (1+i)^(-n))`; com `i=0`, `A=P/n`.
- SAC: amortização mensal `P/n`; primeira parcela financeira `P/n + P×i`.
- Efetiva anual matemática `(1+i)^12 − 1`, sem confundir com CET.
- Capacidade indicativa: `(prestação limite − seguros informados − tarifa) /
fator financeiro`; limitar por quota e necessidade de recursos. Financiamento
  arredondado para baixo no centavo; exibição monetária em centavos.
- Entrada adicional: `max(0, imóvel − financiamento − recursos − FGTS − subsídio
confirmado)`. Recursos próprios informados já são parte da entrada.
- MIP e DFI são valores mensais confirmados, não coeficientes universais. Sem
  ambos, o resultado é parcial e deve indicar os encargos ausentes. Tarifa
  ausente também não é presumida como zero contratual. TR futura não é prevista.
- Amortização extraordinária compara preservar prazo ou a dinâmica financeira
  original, com saldo reduzido pelo aporte. Ao reduzir prazo, Price preserva
  a prestação financeira; SAC preserva a amortização original `P/n`, enquanto
  os juros incidem sobre o novo saldo. Não há TR, seguros ou tarifas futuros
  incluídos, nem autorização de amortização do contrato real.
- Obra: cenário de liberação linear a partir do progresso informado; juros
  mensais sobre saldo liberado. TR anual hipotética convertida por
  `(1+TR_anual)^(1/12)−1`, separada dos juros. Não é medição real nem cobrança
  contratual; não se aplica a regra de evolução de obra do Associativo.
- FGTS: união dos intervalos evita dupla contagem de empregos simultâneos;
  datas inválidas/futuras impedem indicação. Dias/anos são aproximação do tempo;
  tempo contributivo e demais requisitos dependem do extrato e validação CAIXA.

## Diferenças necessárias frente à referência

### Fórmula operacional do desconto complemento

MFOM v034, pp. 131–133, §§3.1.1–3.1.2. A expressão exige dados oficiais que
o formulário de referência não coleta; por isso é documentada, sem calcular
um subsídio aparentemente exato com valores presumidos:

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
`FDr` vem do Anexo III; `Fpop`, do Anexo IV (tabela A ou B para Norte).
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

Não forçar Price, migrar automaticamente para SBPE ou aceitar nascimento
inválido/menor como adulto. Não inventar um mês de prazo quando o limite é zero.
Não subtrair 36 meses de qualquer obra. Não somar períodos sobrepostos do FGTS.
Não fixar taxa SBPE, MIP/DFI, subsídio municipal ou prazo de baixa de restrição
sem prova. Diagnóstico é orientação informativa com resultado bancário já
informado pelo usuário, sem decidir crédito nem garantir aprovação.

## Segurança e validação

A [IN17 compilada, alterada pela IN4 de 08/04/2026](https://www.gov.br/cidades/pt-br/acesso-a-informacao/institucional/base-juridica/instrucoes-normativas/20260409_InstruoNormativan.17_Compilada.pdf),
art. 3, define Classe Média com renda limitada a R$ 13 mil, sem piso de
R$ 9.600. Por isso a página permite selecionar esse enquadramento inclusive
para renda menor, sem subsídio complemento, com taxa de referência de 10%.
Imóvel acima de R$ 400 mil ou renda acima de R$ 9.600 identificam esse cenário
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
