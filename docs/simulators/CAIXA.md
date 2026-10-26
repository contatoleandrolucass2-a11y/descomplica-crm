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
- Amortização extraordinária compara preservar prazo ou prestação financeira,
  com saldo reduzido pelo aporte, sem TR, seguros ou tarifas futuros. Não é
  uma autorização de amortização do contrato real.
- Obra: cenário de liberação linear a partir do progresso informado; juros
  mensais sobre saldo liberado. TR anual hipotética convertida por
  `(1+TR_anual)^(1/12)−1`, separada dos juros. Não é medição real nem cobrança
  contratual; não se aplica a regra de evolução de obra do Associativo.
- FGTS: união dos intervalos evita dupla contagem de empregos simultâneos;
  datas inválidas/futuras impedem indicação. Dias/anos são aproximação do tempo;
  tempo contributivo e demais requisitos dependem do extrato e validação CAIXA.

## Diferenças necessárias frente à referência

Não forçar Price, migrar automaticamente para SBPE ou aceitar nascimento
inválido/menor como adulto. Não inventar um mês de prazo quando o limite é zero.
Não subtrair 36 meses de qualquer obra. Não somar períodos sobrepostos do FGTS.
Não fixar taxa SBPE, MIP/DFI, subsídio municipal ou prazo de baixa de restrição
sem prova. Diagnóstico é orientação informativa com resultado bancário já
informado pelo usuário, sem decidir crédito nem garantir aprovação.

## Segurança e validação

Os guards de servidor, catálogo e permissão compartilhada dos simuladores
permanecem. APIs official/commercial continuam fechadas para CAIXA: o cálculo
indicativo local não é integração bancária, workflow n8n nem motor oficial.
Não há migration, alteração de RLS, ACL, dados, contas ou configurações remotas.
Histórico eventual é somente memória da página. Compartilhamento exige ação
explícita do usuário; não enviar nomes/documentos automaticamente a terceiros.

Testes financeiros cobrem limites de faixa/taxa, idade/datas, cotas, recursos,
subsídio, finitude, prestação, Price/SAC, amortização, FGTS e cenário de obra.
A validação visual deve confrontar a nova página com a referência viva e
verificar desktop/celular, três temas, teclado, zoom, nomes acessíveis e estados
de erro. CI/merge/publicação são estados separados, registrados em ATUALIZACOES.
