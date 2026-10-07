export type AssociativeFaqQuestion = {
  id?: number;
  question: string;
  answer: string | readonly string[];
  sources?: readonly { label: string; href: string }[];
};

export type AssociativeFaqSection = {
  title: string;
  questions: readonly AssociativeFaqQuestion[];
};

export const ASSOCIATIVE_FAQ_REFERENCE =
  "Referência: São Paulo capital. Conteúdo de origem: material de referência fornecido, datado de 30/09/2026; fontes públicas e código da página conferidos em 01/10/2026. As planilhas e o contrato citados nesse material não foram disponibilizados para conferência direta. Suas condições são referências específicas, não regras gerais nem garantia de aprovação. A simulação desta página e a cobrança efetiva do banco são identificadas separadamente nas respostas.";

const sources = {
  his: {
    label: "São Paulo: Decreto 64.895/2026, renda e valores HIS/HMP",
    href: "https://legislacao.prefeitura.sp.gov.br/decreto-64895-de-5-de-janeiro-de-2026",
  },
  zoning: {
    label: "São Paulo: Lei 16.402/2016, classificação dos usos residenciais",
    href: "https://legislacao.prefeitura.sp.gov.br/lei-16402-de-22-de-marco-de-2016/consolidado",
  },
  destination: {
    label: "São Paulo: Decreto 63.130/2024, destinação de HIS/HMP",
    href: "https://legislacao.prefeitura.sp.gov.br/decreto-63130-de-19-de-janeiro-de-2024",
  },
  mcmv: {
    label: "Ministério das Cidades: linhas e recursos do MCMV",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/sobre-o-minha-casa-minha-vida-1",
  },
  financed: {
    label: "Ministério das Cidades: MCMV, linha financiada",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts",
  },
  bands: {
    label: "Ministério das Cidades: Portaria 333/2026, faixas de renda",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/institucional/base-juridica/portarias/2026/PORTARIAMCIDN333DE30DEMARODE2026.pdf",
  },
  sbpe: {
    label: "Banco Central: Resolução CMN 4.676/2018, SBPE e poupança",
    href: "https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=4676&tipo=Resolu%C3%A7%C3%A3o",
  },
  paulista: {
    label: "Habitação SP: Casa Paulista, Carta de Crédito Imobiliário",
    href: "https://www.habitacao.sp.gov.br/habitacao/institucional/nossos_servicos/programa-casa-paulista/setor%20privado",
  },
  fgtsLaw: {
    label: "Planalto: Lei 8.036/1990, artigo 15, depósitos do FGTS",
    href: "https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm",
  },
  fgts: {
    label: "CAIXA: condições de utilização do FGTS na casa própria",
    href: "https://www.caixa.gov.br/voce/habitacao/Paginas/utilizacao-fgts.aspx",
  },
  financing: {
    label: "CAIXA: aquisição, avaliação e contratação do financiamento",
    href: "https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx",
  },
  installments: {
    label: "CAIXA: composição da prestação e encargos habitacionais",
    href: "https://www.caixa.gov.br/voce/habitacao/financiamento/perguntas-frequentes/Paginas/default.aspx",
  },
  construction: {
    label: "CAIXA: cartilha de juros na fase de obras",
    href: "https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/Cartilha_Juros_Fase_de_Obras.pdf",
  },
  associative: {
    label: "Direcional: modelo de crédito associativo",
    href: "https://ri.direcional.com.br/a-companhia/diferenciais-competitivos/",
  },
  registration: {
    label: "Planalto: Lei 6.015/1973, artigo 290, emolumentos",
    href: "https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm",
  },
  itbi: {
    label: "Prefeitura de São Paulo: cálculo do ITBI em 2026",
    href: "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513",
  },
  exemption: {
    label: "Prefeitura de São Paulo: isenções e incentivos do ITBI",
    href: "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2517",
  },
  incc: {
    label: "FGV IBRE: INCC, composição e versões",
    href: "https://portalibre.fgv.br/estudos-e-pesquisas/indices-de-precos/incc",
  },
  ipca: {
    label: "IBGE: Índice Nacional de Preços ao Consumidor Amplo",
    href: "https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor.html",
  },
  contact: {
    label: "Direcional: canal de relacionamento com o cliente",
    href: "https://ri.direcional.com.br/servicos-aos-investidores/fale-conosco/",
  },
  podeMorar: {
    label: "Direcional: aplicativo Pode Morar",
    href: "https://www.direcional.com.br/blog/direcional/app-pode-morar-premio-master/",
  },
  caixaApp: {
    label: "CAIXA: serviços do contrato e App Habitação CAIXA",
    href: "https://www.caixa.gov.br/voce/habitacao/servicos/Paginas/default.aspx",
  },
} as const;

export const ASSOCIATIVE_FAQ_SECTIONS: readonly AssociativeFaqSection[] = [
  {
    title: "HIS, HMP, R2V e enquadramento dos imóveis",
    questions: [
      {
        id: 1,
        question: "O que são HIS, HMP e R2V?",
        answer: [
          "HIS significa Habitação de Interesse Social. Em São Paulo, divide-se em HIS-1 e HIS-2, destinadas a famílias dentro dos respectivos limites de renda. São categorias municipais de habitação, com regras de destinação e incentivos à produção de moradia. Não são nomes de financiamentos bancários.",
          "HMP significa Habitação de Mercado Popular. Também é uma categoria habitacional municipal, mas atende a um limite de renda superior ao das HIS.",
          "R2V é uma classificação de uso residencial multifamiliar vertical: conjunto com mais de duas unidades habitacionais agrupadas verticalmente, como edifícios de apartamentos. Possui subdivisões conforme a área construída do conjunto. R2V, por si só, não é programa de subsídio nem faixa de renda.",
          "HIS-1 não significa automaticamente Faixa 1 do Minha Casa, Minha Vida. Uma classificação é municipal; a outra pertence ao programa federal.",
        ],
        sources: [sources.his, sources.zoning],
      },
      {
        id: 2,
        question: "Quais são as faixas de renda e de valor desses imóveis?",
        answer: [
          "Para HIS e HMP no município de São Paulo, o Decreto Municipal 64.895/2026 publica os seguintes tetos de renda familiar mensal e de alienação da unidade:",
          "HIS-1: renda familiar mensal de até R$ 4.863,00, referência de 3 salários mínimos; valor máximo de alienação de R$ 276.102,20.",
          "HIS-2: renda familiar mensal de até R$ 9.726,00, referência de 6 salários mínimos; valor máximo de alienação de R$ 383.636,74.",
          "HMP: renda familiar mensal de até R$ 16.210,00, referência de 10 salários mínimos; valor máximo de alienação de R$ 537.672,71.",
          "São tetos publicados, não intervalos exclusivos deduzidos desta lista. O decreto também apresenta alternativas de renda por pessoa: R$ 810,50 para HIS-1, R$ 1.621,00 para HIS-2 e R$ 2.431,50 para HMP. O material de referência fornecido relata uma condição contratual que destaca a renda familiar para a destinação. Confirme os critérios legais, a certificação e o contrato aplicáveis; não escolha uma forma de cálculo apenas por favorecer o enquadramento.",
          "R2V não possui esses tetos sociais apenas por receber essa classificação. Os limites de valor do MCMV são outros, apresentados na pergunta 18. A triagem financeira desta página não certifica a destinação municipal de HIS/HMP.",
        ],
        sources: [sources.his, sources.destination],
      },
      {
        id: 3,
        question: "Por que HIS e HMP foram criadas?",
        answer: [
          "Para estimular a oferta de moradias destinadas a famílias com menor capacidade de compra, inclusive em regiões com infraestrutura urbana.",
          "O empreendimento recebe incentivos públicos e urbanísticos e, em contrapartida, as unidades devem atender ao público e às condições previstos na legislação. Por isso existem regras de renda, preço e destinação: não basta o apartamento ser pequeno ou ter preço baixo.",
          "O material de referência fornecido também relata responsabilidade contratual pela destinação correta da unidade, inclusive em futuras vendas ou locações. A legislação municipal disciplina responsabilidades e fiscalização; confirme as obrigações aplicáveis à unidade e à operação.",
        ],
        sources: [sources.destination],
      },
    ],
  },
  {
    title: "MCMV, SBPE, subsídio, Cheque Moradia e FGTS",
    questions: [
      {
        id: 4,
        question: "O que é o MCMV e de onde vêm os recursos?",
        answer: [
          "MCMV significa Minha Casa, Minha Vida. É um programa federal de acesso à moradia, com linhas de atendimento diferentes.",
          "Na linha financiada, a família contrata um financiamento e paga a dívida ao banco. Os recursos incluem FGTS e Fundo Social, conforme a modalidade. Na produção habitacional subsidiada, destinada principalmente à Faixa 1, existem recursos do Orçamento Geral da União e de fundos como FAR, FDS e FNHIS.",
          "Nem todo MCMV funciona da mesma maneira: comprar uma unidade de mercado com financiamento não é o mesmo processo de seleção de uma moradia altamente subsidiada.",
        ],
        sources: [sources.mcmv, sources.financed],
      },
      {
        id: 5,
        question: "O que é o SBPE e de onde vêm os recursos?",
        answer: [
          "SBPE significa Sistema Brasileiro de Poupança e Empréstimo. Direciona recursos captados em depósitos de poupança para o financiamento imobiliário. Participam instituições financeiras habilitadas, como bancos e caixas econômicas.",
          "A poupança é uma fonte de recursos que permite ao banco emprestar dinheiro para compra, construção e outras operações imobiliárias. SBPE não é um programa de subsídio equivalente ao MCMV.",
        ],
        sources: [sources.sbpe],
      },
      {
        id: 6,
        question: "Qual é a diferença entre MCMV e SBPE?",
        answer: [
          "O MCMV possui enquadramento por renda, limites de valor dos imóveis e condições definidas pelo programa. Algumas famílias podem receber subsídio e acessar juros diferenciados.",
          "O SBPE é uma estrutura de financiamento com recursos da poupança, com condições comerciais e de crédito da instituição financeira. Não utiliza as faixas do MCMV como sua classificação principal.",
          "O uso do saldo pessoal do FGTS não torna automaticamente um financiamento MCMV. O comprador também pode utilizar FGTS em operações que atendam às regras do Fundo, inclusive fora do programa.",
        ],
        sources: [sources.financed, sources.sbpe, sources.fgts],
      },
      {
        id: 7,
        question: "O que é subsídio?",
        answer: [
          "É um benefício financeiro aplicado à aquisição da moradia, diminuindo a parte que a família precisará pagar com entrada ou financiamento. Não é a mesma coisa que o saldo pessoal de FGTS nem um desconto concedido pela construtora.",
          "Na linha financiada do MCMV, o benefício depende do enquadramento e do cálculo oficial. Para famílias com renda até R$ 5 mil, o Ministério das Cidades informa subsídios que podem chegar a R$ 55 mil nas regiões fora do Norte, mas o máximo não é garantido para todos.",
          "Exemplo didático: imóvel de R$ 250 mil com subsídio aprovado de R$ 20 mil deixa R$ 230 mil para composição entre financiamento, FGTS e recursos próprios, antes de considerar outras condições da operação.",
        ],
        sources: [sources.financed],
      },
      {
        id: 8,
        question: "O que é Cheque Moradia?",
        answer: [
          "Cheque Moradia é uma expressão usada para benefícios habitacionais que ajudam a compor a compra. É necessário identificar qual programa está concedendo o recurso.",
          "Em São Paulo, o benefício citado comercialmente como Cheque Paulista está associado à Carta de Crédito Imobiliário do Casa Paulista, programa estadual. A referência oficial consultada informa renda bruta mensal de até R$ 4.863,00; para a capital, o valor previsto é de R$ 16 mil, em empreendimentos habilitados e observadas as condições do programa.",
          "Não é dinheiro livre para saque nem benefício automático de qualquer imóvel. No simulador, só deve entrar como recurso confirmado.",
          "O material de referência fornecido relata uma rubrica contratual de R$ 16 mil chamada Subsídio. A coincidência do valor não comprova, sozinha, que a origem seja o Casa Paulista. Confirme a origem para não contabilizar o mesmo benefício em Subsídio e Cheque Moradia.",
        ],
        sources: [sources.paulista],
      },
      {
        id: 9,
        question: "O que é FGTS?",
        answer: [
          "FGTS significa Fundo de Garantia do Tempo de Serviço. É formado por depósitos feitos pelo empregador na conta vinculada do trabalhador. Para o trabalhador comum regido pela CLT, o depósito corresponde, em regra, a 8% da remuneração, pago pelo empregador.",
          "Na habitação, o saldo pode ser utilizado em situações permitidas, como aquisição, amortização ou liquidação de financiamento e pagamento de parte das prestações.",
          "Entre as condições para aquisição estão pelo menos três anos de trabalho sob o regime do FGTS, consecutivos ou não. Também há requisitos sobre financiamento ativo no SFH, propriedade de outro imóvel, sua localização e finalidade residencial. Ter saldo não significa poder utilizá-lo automaticamente; confirme o enquadramento a cada utilização.",
        ],
        sources: [sources.fgtsLaw, sources.fgts],
      },
    ],
  },
  {
    title: "Crédito, financiamento, evolução de obra e avaliação",
    questions: [
      {
        id: 10,
        question: "O que é crédito associativo e crédito bancário?",
        answer: [
          "Crédito bancário é o financiamento concedido por uma instituição financeira. Crédito associativo também é bancário: os compradores participam de um empreendimento e os financiamentos individuais são vinculados à sua produção. A contratação pode ocorrer durante a construção, com liberação de recursos conforme o andamento da obra.",
          "No atendimento comercial, costuma-se contrastar o associativo com a operação em que o cliente paga a construtora durante a construção e contrata o financiamento individual na etapa de repasse. A diferença central é a estrutura e o momento da contratação, não ter banco ou não ter banco.",
          "Nesta página, o Associativo combina recursos do financiamento com pró-soluto pago à construtora. São obrigações distintas, sujeitas às respectivas análises e contratos.",
        ],
        sources: [sources.associative, sources.construction],
      },
      {
        id: 11,
        question: "Como é feito o financiamento?",
        answer: [
          "O processo envolve simulação, apresentação de documentos, análise de crédito, análise do imóvel, aprovação, assinatura e registro do contrato.",
          "A CAIXA informa que, após as avaliações e a assinatura, a liberação ao vendedor depende do registro do contrato no Cartório de Registro de Imóveis. Em empreendimentos em construção, a liberação segue a estrutura contratada para a obra, também descrita no material de referência fornecido.",
          "O comprador passa a ter uma dívida com o banco. Se também parcelou parte do preço com a construtora, terá dois compromissos diferentes, que precisam caber no orçamento.",
        ],
        sources: [sources.financing, sources.construction],
      },
      {
        id: 12,
        question: "Precisa estar aprovado com a Caixa?",
        answer: [
          "Para contratar financiamento com a CAIXA, sim. Para fazer uma simulação inicial, não.",
          "Simulação, aprovação comercial da construtora e aprovação bancária são etapas distintas. A instituição financeira precisa aprovar a operação conforme suas exigências.",
          "O material de referência fornecido relata uma condição contratual de obtenção do financiamento em até 60 dias após a assinatura. Esse prazo pertence ao caso descrito e exige confirmação no contrato aplicável; não é regra universal para toda compra.",
          "Aprovado no simulador não deve ser apresentado como financiamento garantido.",
        ],
        sources: [sources.financing],
      },
      {
        id: 13,
        question: "Como são calculadas as parcelas?",
        answer: [
          "É necessário separar a parcela do banco da parcela da construtora. No banco, a prestação considera amortização da dívida, juros, seguros e eventual tarifa de administração. Seu cálculo depende do saldo, prazo, taxa, indexador e sistema de amortização.",
          "No SAC, a amortização é constante e os juros tendem a diminuir; na Price, a parcela financeira é nivelada, sem eliminar possíveis efeitos de indexadores e seguros.",
          "Fórmula didática da Price, para taxa positiva, sem seguros e atualizações adicionais: parcela = saldo financiado × taxa mensal ÷ [1 − (1 + taxa mensal) elevado a −n]. Nessa fórmula, n é a quantidade de parcelas; com taxa zero, o saldo é dividido por n.",
          "Para a construtora, o material de referência fornecido descreve o WF-13 considerando entrada, sinais, recursos aprovados, anuais, prazo e períodos pré/pós-obra. O documento de cálculo nele citado utiliza 0,5% ao mês no pré e 1,5% no pós para uma parcela linear final. Essas não são as taxas do financiamento CAIXA.",
          "Na simulação desta página, o cálculo local também usa PRICE com 0,5% no pré e 1,5% no pós, separa os períodos e exibe como parcela corrigida o maior pagamento calculado entre eles. A memória local não confirma execução nem equivalência com o workflow oficial. Consulte também a pergunta 43.",
        ],
        sources: [sources.installments],
      },
      {
        id: 14,
        question: "O que é evolução de obra?",
        answer: [
          "A expressão possui dois sentidos relacionados: o avanço físico da construção e a cobrança bancária durante a fase de construção, popularmente chamada de evolução de obra ou juros de obra.",
          "O material de referência fornecido descreve uma cobrança da instituição financeira com juros, atualização monetária, seguro e taxa de administração, conforme a operação. A cartilha da CAIXA também distingue os encargos dessa fase da amortização posterior.",
          "Ela não é a parcela da entrada paga à construtora. O valor mostrado na programação desta página é uma estimativa comercial, não o encargo bancário real; a pergunta 16 explica essa diferença.",
        ],
        sources: [sources.construction],
      },
      {
        id: 15,
        question: "Por que existe a evolução de obra?",
        answer: [
          "Porque o banco libera recursos para viabilizar a construção antes de o imóvel estar concluído. Durante esse período, há encargos sobre o crédito liberado.",
          "O material de referência fornecido relata que os pagamentos dessa fase não amortizam o saldo financiado. A cartilha da CAIXA explica que a amortização passa a integrar a cobrança na transição para a fase de obra concluída, conforme os procedimentos e condições do financiamento.",
          "Não confunda essa cobrança do financiamento do comprador com a dívida de produção da própria construtora, cuja responsabilidade é tratada separadamente no contrato descrito no material. Confirme os contratos aplicáveis.",
        ],
        sources: [sources.construction],
      },
      {
        id: 16,
        question: "Como é calculada a evolução de obra?",
        answer: [
          "Na cobrança bancária, a referência é o financiamento efetivamente liberado, não simplesmente o preço total do apartamento. Como explicação aproximada: juros do período ≈ saldo liberado atualizado × taxa do período.",
          "Podem ser acrescentados seguros, atualização e tarifas contratuais. O cálculo exato é do banco e pode considerar datas e liberações ao longo do mês.",
          "Exemplo hipotético: financiamento de R$ 200 mil, com R$ 80 mil já liberados e taxa mensal de 0,6%, produz aproximadamente R$ 480 de juros, antes dos demais componentes.",
          "O material de referência fornecido descreve, em Associativo!K59, uma reserva de 30% da renda para a parcela máxima de evolução. Essa premissa não é a fórmula real da cobrança bancária nem um teto garantido pelo banco.",
          "Na programação desta página, Evolução de Obra = renda familiar × 30% × andamento estimado da obra. O andamento parte do percentual informado no relatório, evolui mensalmente até 100% no mês da entrega e permanece congelado em 100% depois dela. O mês da simulação e o mês seguinte ficam sem cobrança; a cobrança começa no terceiro mês programado. Essa projeção continua aparecendo após a entrega, mas não significa cobrança real de juros de obra após a conclusão. Confirme os encargos e a fase do contrato com o banco.",
        ],
        sources: [sources.construction],
      },
      {
        id: 17,
        question: "O que é valor de avaliação e por que ele existe?",
        answer: [
          "É o valor apurado na avaliação técnica do imóvel para a operação de crédito. A CAIXA utiliza profissionais credenciados para verificar se o bem atende às condições necessárias para servir como garantia.",
          "Na orientação pública da CAIXA para aquisição, considera-se o menor entre o preço negociado e o valor da avaliação, observadas as condições da operação. Uma avaliação maior não autoriza automaticamente financiar mais do que a compra comporta.",
          "Exemplo: compra por R$ 250 mil, avaliação de R$ 240 mil e quota hipotética de 80%: o teto sobre essa base seria R$ 192 mil. A capacidade de crédito do comprador ainda pode reduzir esse valor. A avaliação não deve ser alterada artificialmente para fazer a proposta aprovar.",
          "Nesta página, a documentação usa a avaliação do relatório, ou uma avaliação informada quando ela falta, e calcula o limite de financiamento sobre essa avaliação. Esse cálculo local não substitui a conferência bancária do menor valor entre compra e avaliação. Veja a pergunta 41.",
        ],
        sources: [sources.financing],
      },
    ],
  },
  {
    title: "Faixas do MCMV e primeiro imóvel",
    questions: [
      {
        id: 18,
        question: "O que são as Faixas 1, 2 e 3?",
        answer: [
          "São os grupos de renda familiar bruta utilizados pelo MCMV. Em 2026, o programa também contempla a Faixa 4, chamada Classe Média. Para imóveis urbanos na linha financiada:",
          "Faixa 1: renda familiar bruta mensal de até R$ 3.200,00; teto de imóvel conforme a localização, entre R$ 210 mil e R$ 275 mil.",
          "Faixa 2: renda de R$ 3.200,01 a R$ 5.000,00; teto de imóvel conforme a localização, entre R$ 210 mil e R$ 275 mil.",
          "Faixa 3: renda de R$ 5.000,01 a R$ 9.600,00; imóvel de até R$ 400 mil.",
          "Faixa 4, Classe Média: renda de R$ 9.600,01 a R$ 13.000,00; imóvel de até R$ 600 mil.",
          "As rendas seguem a Portaria MCID 333/2026. Nas Faixas 1 e 2, confira o teto da localidade na tabela do agente operador. Esses valores são da linha financiada, não de todas as modalidades subsidiadas do programa.",
          "HIS/HMP e MCMV precisam ser analisados separadamente: uma unidade pode atender ao limite municipal de HIS-2 e não atender ao limite MCMV aplicável à renda da família.",
          "Na simulação desta página, as faixas de renda coincidem com essas referências, mas a triagem usa um teto simplificado de imóvel de R$ 600.000,00. Esse teto não vale indistintamente para todas as faixas e localidades; o enquadramento exibido não confirma elegibilidade bancária.",
        ],
        sources: [sources.bands, sources.financed],
      },
      {
        id: 19,
        question: "Por que essas faixas foram criadas?",
        answer: [
          "Para diferenciar o atendimento conforme a capacidade financeira das famílias. Elas ajudam a definir condições de financiamento, juros, subsídios e limites de enquadramento.",
          "Na linha financiada, o programa direciona subsídios às rendas menores e escalona as taxas conforme suas regras. Estar na Faixa 1, por exemplo, não significa receber automaticamente uma unidade gratuita ou financiamento aprovado.",
        ],
        sources: [sources.financed, sources.mcmv],
      },
      {
        id: 20,
        question: "Onde impacta informar “primeiro imóvel: sim ou não”?",
        answer: [
          "Impacta na análise de enquadramento habitacional, benefícios e documentação, mas o campo não substitui a comprovação dos requisitos.",
          "No MCMV financiado, é necessário verificar propriedade e financiamento habitacional ativo. No FGTS, há critérios próprios sobre outros imóveis, localização e financiamento. Já ter tido um imóvel no passado e ser proprietário de outro imóvel hoje não são situações equivalentes.",
          "Na documentação, a primeira aquisição residencial financiada pelo SFH possui redução legal de 50% nos emolumentos dos atos abrangidos pelo artigo 290 da Lei de Registros Públicos. Isso não significa desconto de 50% em todos os custos da compra.",
          "Em São Paulo há isenção de ITBI para operações que cumpram os requisitos municipais, dentro do limite de R$ 245.527,77 em 2026. A Prefeitura prevê primeira aquisição ou enquadramento no MCMV, nas condições publicadas para pessoa física e imóvel de uso exclusivamente residencial.",
          "Marcar não não permite concluir, sozinho, que todo benefício está proibido ou que a única alternativa legal é SBPE. Porém, a configuração desta página força SBPE quando primeiro imóvel é não. Esse comportamento é uma triagem interna simplificada, não uma conclusão jurídica; confirme o enquadramento com o agente financeiro, sem alterar a resposta para contornar a triagem.",
          "Há também diferença na documentação: a página só aplica sua isenção de ITBI quando primeiro imóvel é sim e a modalidade é MCMV, dentro do teto. A orientação municipal apresenta primeira aquisição ou enquadramento no MCMV, sujeitos aos demais requisitos. Por isso, o resultado do simulador não é uma decisão fiscal sobre o direito à isenção.",
        ],
        sources: [sources.financed, sources.fgts, sources.registration, sources.exemption],
      },
    ],
  },
  {
    title: "Parâmetros, ranking e aprovação da proposta",
    questions: [
      {
        id: 21,
        question: "O que são parâmetros de aprovação e para que servem?",
        answer: [
          "São os limites e condições usados para verificar se a proposta pode seguir: percentual de pró-soluto, comprometimento de renda, quantidade de parcelas, entrada, sinais, anuais e demais exigências aplicáveis.",
          "O material de referência fornecido condiciona a simulação à política comercial do empreendimento, além dos dados e fórmulas do modelo. Uma conta pode estar matematicamente correta e, ainda assim, ultrapassar uma condição comercial permitida.",
          "Esses parâmetros evitam propostas inviáveis e orientam os ajustes necessários, sem substituir a aprovação do banco. Nesta página, há parâmetros locais de Ranking e validações de valores, datas e quantidade de parcelas. Confirme sua aplicação à unidade no fluxo comercial oficial.",
        ],
      },
      {
        id: 22,
        question:
          "Por que o ranking é dividido em Diamante, Ouro, Prata, Bronze, Aço e não elegível?",
        answer: [
          "São classes internas de enquadramento que permitem aplicar conjuntos diferentes de limites à proposta. Não são faixas do MCMV nem classificação oficial da CAIXA. Não elegível indica que o enquadramento exigido não foi atendido; não significa, por si só, que a pessoa jamais poderá comprar um imóvel.",
          "O material de referência fornecido não traz a tabela completa e vigente de limites nem o método de atribuição de cada categoria e remete a decisão à política comercial consultada pelos WF-10 e WF-19. Esse relato não confirma consulta ou execução desses workflows nesta página.",
          "O código atual possui limites locais de pró-soluto, comprometimento e máxima carga mensal com obra para cada Ranking selecionado. A existência desses parâmetros não comprova sua vigência comercial para todo empreendimento nem a classificação de crédito do cliente. Confira os limites exibidos no painel e a política autorizada, sem atribuir percentuais à CAIXA.",
        ],
      },
      {
        id: 23,
        question: "O que é o percentual de pró-soluto?",
        answer: [
          "É o indicador de quanto da operação permanece parcelado diretamente com a construtora, em relação à base de venda adotada na análise. Não é taxa de juros nem percentual financiado pelo banco.",
          "O material de referência fornecido descreve em Associativo!D48: % pró-soluto = (pró-soluto corrigido das mensais + anuais válidas nominais) ÷ (preço − bônus − desconto). Exemplo didático: R$ 45 mil de saldo considerado sobre base de R$ 250 mil representam 18%.",
          "A base desse indicador é interna e não deve ser confundida com o preço contratual para fins tributários. O material relata uma condição específica segundo a qual o bônus de adimplência, quando concedido, não reduz o preço de venda; confirme o contrato aplicável.",
          "Nesta página, o percentual usa o Pró-Soluto com a correção inicial da carência, dividido pelo valor real de venda. As anuais continuam dentro do Pró-Soluto. O Saldo parcelado desconta as anuais pelos valores digitados, uma única vez; os juros das anuais não reduzem novamente essa base. A fórmula histórica de D48 acima não é a fórmula atual desse indicador.",
        ],
      },
      {
        id: 24,
        question: "O que é percentual de comprometimento da renda?",
        answer: [
          "É a proporção da renda utilizada para pagar determinado compromisso. O material de referência fornecido descreve em Associativo!J59: % comprometimento = parcela mensal corrigida da construtora ÷ renda familiar mensal.",
          "Exemplo: parcela de R$ 600 para renda de R$ 4 mil representa 15%. Nesse campo, a fórmula relatada não soma automaticamente a parcela do banco, a documentação e as anuais. O percentual isolado não representa todo o orçamento comprometido.",
          "Na simulação desta página, o indicador consulta todas as mensais corrigidas, sem Evolução de Obra, escolhe a maior e divide pela renda familiar. O resultado e a data do pico aparecem separadamente para Linear e Decrescente; o pico pode ocorrer depois da primeira parcela.",
        ],
      },
      {
        id: 25,
        question: "O que é percentual máximo da renda mensal?",
        answer: [
          "É necessário distinguir o percentual consumido pela proposta do limite máximo permitido pela política. O material de referência fornecido descreve em Associativo!M59: % total = (parcela da construtora + reserva estimada para evolução/banco) ÷ renda.",
          "Como a reserva relatada em K59 é de 30% da renda, nesse modelo % total = comprometimento da parcela da construtora + 30%. Exemplo: renda de R$ 4 mil, mensal da construtora de R$ 600 e reserva de R$ 1.200 resultam em R$ 1.800, equivalentes a 45%.",
          "Esse resultado deve ser comparado com o limite autorizado para o perfil. Os 45% do exemplo são um resultado matemático, não uma regra universal de aprovação.",
          "Na simulação desta página, o indicador % Máximo da renda mensal calcula o maior total de mensal corrigida + Evolução de Obra dividido pela renda, separadamente por fluxo. Como a evolução varia com o andamento estimado, não é sempre o comprometimento acrescido de 30 pontos percentuais.",
          "Apesar do nome, o indicador não inclui o valor da anual, mesmo quando ela integra o total da mesma linha mensal no cronograma. Confira também anuais, documentação, prestação bancária e demais despesas familiares; esses indicadores não formam um orçamento completo.",
        ],
      },
      {
        id: 26,
        question: "O que é “% status da proposta”?",
        answer: [
          "Status da proposta é uma situação, não um percentual por natureza. Pode indicar aprovação comercial, reprovação, bloqueio por inconsistência ou informação pendente. Percentuais são indicadores usados nessa decisão.",
          "O material de referência fornecido distingue estados de processamento como ok, bloqueado, erro e aguardando_usuario. Cálculo executado com sucesso não equivale a aprovação bancária.",
          "Nesta página, o status comercial resulta das validações da proposta, da memória comparativa e dos limites do Ranking. Os estados internos são pendente, aprovado ou reprovado. Não há uma fórmula de percentual chamada status: leia a situação junto aos indicadores e aos motivos apresentados, sem tratá-la como aprovação de crédito.",
        ],
      },
      {
        id: 27,
        question: "Por que a proposta é reprovada e o que fazer para aprovar?",
        answer: [
          "Primeiro identifique qual análise recusou a proposta. Na análise comercial, pode haver prazo acima do permitido, entrada ou sinais inválidos, saldo inconsistente ou desenquadramento nos limites da política.",
          "Conforme o motivo, o ajuste pode envolver aumentar recursos próprios, reduzir o preço da unidade escolhida ou reorganizar o parcelamento dentro das regras. No painel desta página, confira os motivos e a prévia dos ajustes antes de aplicar novos valores.",
          "Na análise bancária, podem existir impedimentos cadastrais, documentação insuficiente ou crédito aprovado menor que o necessário. O material de referência fornecido relata condição contratual em que a diferença de financiamento precisa ser quitada com a incorporadora; confirme sua aplicação à operação.",
          "O ajuste depende da causa. Não aumente renda ficticiamente, não lance FGTS indisponível nem trate subsídio estimado como aprovado. Resolver uma pendência permite nova análise, mas não garante aprovação.",
        ],
        sources: [sources.financing],
      },
      {
        id: 28,
        question: "Onde a data de entrega impacta na parcela?",
        answer: [
          "Ela define a distribuição das mensais entre pré-obra e pós-obra, influenciando as taxas e o saldo parcelado. O material de referência fornecido utiliza 0,5% ao mês no pré e 1,5% no pós. Alterar o término da obra ou o início das mensais muda a quantidade de parcelas em cada período e pode mudar a parcela final.",
          "A data da simulação precisa vir da referência oficial da unidade. No cálculo desta página, o pré-obra abrange os meses anteriores ao mês da entrega; o mês da entrega já integra o pós-obra. A data também limita anuais e orienta a projeção do andamento da obra.",
          "Na cobrança contratual, importa o marco previsto no contrato. O material de referência fornecido relata mudança dos índices vinculada ao Habite-se, não simplesmente ao dia de recebimento das chaves. Essa condição específica não torna a data estimada desta página prova de emissão do Habite-se.",
        ],
      },
    ],
  },
  {
    title: "Correções, índices e análise de crédito",
    questions: [
      {
        id: 29,
        question: "Por que as parcelas têm correções?",
        answer: [
          "Quando previstas no contrato, as correções atualizam monetariamente os valores ao longo do tempo. Correção monetária e juros são diferentes: a primeira atualiza o valor monetário; os juros remuneram o crédito. Encargos por atraso são outra situação.",
          "O material de referência fornecido relata parcelas reajustáveis pelo INCC até o Habite-se e, depois, pelo IPCA acrescido de juros de 1% ao mês, calculados pela Price, conforme a cláusula daquele contrato. Essa condição precisa ser confirmada na contratação específica.",
          "Parcelamento linear não deve ser apresentado automaticamente como sem juros e sem qualquer possibilidade de atualização. As taxas projetadas de 0,5% e 1,5% do simulador não substituem índices reais nem as condições de cobrança do contrato.",
        ],
        sources: [sources.incc, sources.ipca, sources.installments],
      },
      {
        id: 30,
        question: "Como é feito o cálculo da correção?",
        answer: [
          "Quando a atualização é por índice mensal, aplica-se o fator acumulado: valor atualizado = valor-base × (1 + índice do mês 1) × (1 + índice do mês 2) × os demais fatores mensais.",
          "Com índice hipotético constante de 0,5% durante 12 meses: R$ 1.000 × 1,005 elevado a 12 = aproximadamente R$ 1.061,68.",
          "O material de referência fornecido relata um contrato em que INCC e IPCA foram estimados em 0,5% ao mês, com cobrança de diferença se o índice real superar a estimativa e possibilidade de o comprador solicitar devolução se ficar abaixo. Esse mecanismo pertence ao caso descrito, exige conferência contratual e não transforma INCC ou IPCA em índices fixos de 0,5%.",
          "Quando a parcela já incorpora a projeção contratual, evite cobrar novamente a mesma atualização sem observar o mecanismo de apuração das diferenças. A memória desta página usa projeções e não consulta mensalmente as séries reais de INCC/IPCA.",
        ],
        sources: [sources.incc, sources.ipca],
      },
      {
        id: 31,
        question: "O que é INCC?",
        answer: [
          "INCC é o Índice Nacional de Custo da Construção, calculado pela FGV IBRE. Acompanha a variação dos custos de materiais, equipamentos, serviços e mão de obra da construção.",
          "Possui versões como INCC-M, INCC-DI e INCC-10, com períodos de coleta diferentes. O contrato deve indicar qual referência utiliza. Não é uma taxa criada pela construtora e não é um percentual fixo mensal.",
        ],
        sources: [sources.incc],
      },
      {
        id: 32,
        question: "O que é IPCA?",
        answer: [
          "IPCA é o Índice Nacional de Preços ao Consumidor Amplo, produzido pelo IBGE. Mede a variação de preços de produtos e serviços consumidos pelas famílias e é a referência oficial de inflação do país.",
          "O material de referência fornecido o descreve como índice de atualização após o Habite-se em uma condição contratual específica. Também aponta uma atribuição incorreta da divulgação do IPCA à FGV em um dos termos citados. A fonte oficial do IPCA é o IBGE; a FGV IBRE produz o INCC.",
          "A ressalva preserva o alerta do material, sem afirmar que houve acesso direto ao termo contratual citado.",
        ],
        sources: [sources.ipca, sources.incc],
      },
      {
        id: 33,
        question: "O que é análise de crédito e por que ela existe?",
        answer: [
          "É a avaliação das condições para conceder financiamento: documentação, capacidade de pagamento, situação cadastral e adequação da operação.",
          "Ela verifica o risco de conceder crédito e as condições em que a dívida poderá ser assumida. Na CAIXA, a análise do comprador é seguida da análise do imóvel.",
          "Ter o nome limpo é importante, mas não significa aprovação automática. O material de referência fornecido relata que o valor solicitado estava sujeito ao sistema de risco e ao comitê de crédito do agente financeiro. O Ranking do simulador não substitui essa decisão.",
        ],
        sources: [sources.financing],
      },
    ],
  },
  {
    title: "Documentação e atendimento ao cliente",
    questions: [
      {
        id: 34,
        question:
          "Por que se paga documentação, por que existem esses valores e para quem são pagos?",
        answer: [
          "Documentação reúne despesas diferentes. ITBI é um tributo municipal, pago à Prefeitura. Registros, averbações e certidões correspondem aos atos dos cartórios, com emolumentos previstos em legislação e tabelas. Também podem existir despesas bancárias e serviços de assessoria contratados.",
          "Não existe um preço universal de documentação: o valor depende dos atos necessários, dos valores da operação e dos benefícios aplicáveis.",
          "O material de referência fornecido relata um Termo de Bonificação de 100% do Registro, ITBI e taxas bancárias abrangidas, com pagamento pela vendedora. É um benefício específico, com condições como adimplência e manutenção do contrato; não se deve cobrar novamente do cliente os itens efetivamente cobertos.",
          "O cálculo local desta página não aplica automaticamente essa bonificação contratual específica. Confirme sua existência, condições e itens cobertos antes de apresentar a documentação calculada como valor a pagar.",
        ],
        sources: [sources.itbi, sources.registration, sources.financing],
      },
      {
        id: 35,
        question: "Como é calculada a documentação?",
        answer: [
          "A composição básica é: documentação = ITBI + registros e certidões + despesas bancárias aplicáveis + serviços contratados − benefícios e bonificações.",
          "ITBI em São Paulo, em 2026: nas operações abrangidas pela regra favorecida, como SFH, PAR, HIS e consórcios, com imóvel de até R$ 725.808,00, aplica-se 0,5% sobre a parte efetivamente financiada, limitada a R$ 120.968,00, e 3% sobre o restante da base tributável. Nas demais situações indicadas pela Prefeitura, aplica-se 3% sobre toda a base; confira a modalidade e a data do contrato.",
          "Exemplo hipotético: base tributável de R$ 265 mil, financiamento superior a R$ 120.968 e operação elegível: ITBI = R$ 120.968 × 0,5% + R$ 144.032 × 3% = R$ 4.925,80.",
          "Antes, verifique eventual isenção, inclusive a referência de R$ 245.527,77 para aquisições que cumpram os requisitos municipais. Isenção de ITBI não elimina automaticamente registros, taxas ou serviços.",
          "O material de referência fornecido descreve em Documentação!B49 a soma de honorários, ITBI, registros e um componente chamado seguro Caixa. Cita R$ 300 para honorários e R$ 1.000 para esse componente bancário. São parâmetros do modelo, não tarifas oficiais universais.",
          "A página mantém esses dois valores fixos e uma tabela local de registros, além das referências de ITBI acima. O total é uma estimativa: confirme emolumentos, base tributável, modalidade, benefícios e tarifas efetivamente aplicáveis. A bonificação relatada na pergunta 34 precisa de conferência própria.",
          "O cálculo local usa o valor de venda como base e aplica a regra progressiva pelo teto de preço, sem distinguir todas as modalidades tributárias citadas pela Prefeitura. Também exige primeiro imóvel e MCMV simultaneamente para sua isenção, como explicado na pergunta 20. Confirme a base tributável e o enquadramento fiscal da operação antes da cobrança.",
        ],
        sources: [sources.itbi, sources.exemption],
      },
      {
        id: 36,
        question: "A parcela da documentação também é corrigida?",
        answer: [
          "O material de referência fornecido descreve um parcelamento de documentação com juros: taxa por unidade de negócio e prazo, padrão de 1,5% ao mês em Documentação!B52 e prestação em B53, com configurações gerais para 36 e 40 meses.",
          "No código atual, a documentação usa 1,5% ao mês, com 40 parcelas para Direcional e 36 para Riva. Isso é configuração do modelo e não prova que todo contrato de prestação de serviços ou parcelamento adotará essas condições.",
          "Não significa acrescentar automaticamente INCC à documentação. Juros do parcelamento e atualização por índice são cobranças diferentes. Primeiro aplique benefícios e bonificações comprovados aos itens cobertos e confirme o contrato específico.",
        ],
      },
      {
        id: 37,
        question: "Qual é o número do relacionamento com o cliente?",
        answer: [
          "Para a Direcional, o número do relacionamento com o cliente é 4002-2600. A página oficial consultada em 01/10/2026 o apresenta com DDD: (31) 4002-2600.",
          "Use o canal oficial de relacionamento para demandas sobre o imóvel e o contrato com a construtora. Ele não substitui o atendimento do banco para o financiamento.",
        ],
        sources: [sources.contact],
      },
      {
        id: 38,
        question: "Qual é o nome do aplicativo do cliente?",
        answer: [
          "O aplicativo divulgado pela Direcional para relacionamento com o grupo é o Pode Morar. Reúne serviços relacionados ao imóvel, documentos, acompanhamento e atendimento, também disponíveis pelo portal.",
          "Para acompanhar o financiamento bancário da CAIXA, o aplicativo é outro: Habitação CAIXA. Não confunda o atendimento da construtora com a gestão do contrato bancário. Acesse os aplicativos pelos canais oficiais.",
        ],
        sources: [sources.podeMorar, sources.contact, sources.caixaApp],
      },
    ],
  },
  {
    title: "Entrada, sinais, repasse, anuais e tipos de fluxo",
    questions: [
      {
        id: 39,
        question: "Qual é a regra da entrada e dos sinais?",
        answer: [
          "O material de referência fornecido descreve no documento de cálculo do fluxo associativo linear as seguintes condições:",
          "Entrada/ato: obrigatória, a partir de R$ 150.",
          "Sinal 1: opcional; quando utilizado, pelo menos R$ 150, com entrada válida.",
          "Sinal 2: exige Sinal 1 válido; pelo menos R$ 150 e não pode superar o Sinal 1.",
          "Sinal 3: exige os sinais anteriores válidos; pelo menos R$ 150 e não pode superar o Sinal 2.",
          "R$ 150 é o mínimo do ato no modelo, não necessariamente toda a entrada necessária para viabilizar a compra. O restante depende da composição financeira.",
          "Os sinais válidos também deslocam o início das mensais. O material relata vencimentos em 5, 10 ou 15, janela de 30 dias e acréscimo de meses conforme os sinais, mas cita janela de 31 dias em outra implementação. Não há uma regra única de vencimento confirmada entre esses referenciais.",
          "A orientação de que o Sinal 1 não pode superar a entrada aparece em outra planilha descrita no material, mas não na fórmula de validação relatada acima. Precisa de confirmação comercial antes de ser imposta como regra definitiva.",
          "Nesta página, a entrada mínima é R$ 150 e os três sinais opcionais respeitam mínimo, sequência e comparação do Sinal 2 com o 1 e do 3 com o 2. A validação local não impõe Sinal 1 menor ou igual à entrada. O código contém funções de datas com janelas de 30 e 31 dias; confira as datas efetivamente exibidas na proposta, sem prometer um vencimento apenas a partir desta descrição.",
        ],
      },
      {
        id: 40,
        question: "Quando o repasse com o banco é reprovado e por quê?",
        answer: [
          "O repasse pode não se concretizar quando a operação deixa de cumprir exigências do banco: crédito não aprovado, restrições cadastrais, documentos pendentes ou financiamento aprovado abaixo do necessário.",
          "O material de referência fornecido relata exigência de manutenção das condições cadastrais e possibilidade de diferença de financiamento a quitar com a incorporadora. Confirme as condições contratuais da operação.",
          "Também pode haver impedimento relacionado ao imóvel ou à formalização: a CAIXA analisa se o bem pode ser aceito como garantia e a liberação depende do registro contratual.",
          "Uma aprovação anterior não dispensa o cumprimento das condições até a contratação e a liberação.",
        ],
        sources: [sources.financing],
      },
      {
        id: 41,
        question: "Existe algum valor que trava o repasse? Qual?",
        answer: [
          "Existem travas diferentes, não um único valor universal. O material de referência fornecido descreve em Documentação!B35:B37 um teto de 80% da avaliação para MCMV e 90% para SBPE, retornando BLOQUEADO quando o financiamento solicitado supera o teto.",
          "Esses percentuais também constam no cálculo local de documentação desta página, aplicado à avaliação. São parâmetros do modelo. A quota efetiva do banco depende da modalidade, dos recursos e do sistema de amortização; 80%/90% não são uma regra universal para todas as operações. A orientação bancária sobre a base de compra e avaliação deve ser conferida separadamente, conforme a pergunta 17.",
          "Valor mínimo para desligamento (VMD): o material de referência fornecido relata uma amortização mínima para liberar a unidade da garantia do financiamento à produção. Não informa seu valor numérico e relata uma condição específica em que, se o comprador já quitou integralmente a unidade, o valor seria suportado pela empresa. Isso exige confirmação no contrato aplicável.",
          "Para responder qual valor trava uma unidade, são necessários o VMD oficial e as condições bancárias daquela operação. Não há base para inventar um piso em reais; o limite calculado de financiamento não identifica o VMD.",
        ],
        sources: [sources.financing],
      },
      {
        id: 42,
        question: "Qual é o valor máximo que posso utilizar nas anuais?",
        answer: [
          "O material de referência fornecido descreve, nas duas planilhas citadas, limite de 50% da renda familiar mensal para cada anual nominal. Exemplo: renda mensal de R$ 4.000 permite uma anual nominal de até R$ 2.000.",
          "As validações relatadas em Associativo!D37:E41 verificam esse limite, valor positivo e data em relação à obra. Há até cinco posições de anuais, com vencimento em 15 de dezembro, respeitando o término da construção. Isso não significa que sempre haverá cinco anuais disponíveis.",
          "O limite de 50% é por anual nominal, não 50% da renda anual nem 50% do preço do apartamento. O modelo também atualiza as anuais; o valor corrigido no vencimento pode superar o nominal. O uso final continua sujeito à política comercial vigente do empreendimento.",
          "Nesta página, o limite nominal também é 50% da renda mensal. Cada anual válida usa valor × 1,005 × 1,005 elevado aos meses completos até o vencimento para calcular o pagamento. Só o valor digitado é descontado da base das mensais. A soma desses valores deve ser menor que o Pró-Soluto, para sobrar saldo nas mensais.",
        ],
      },
      {
        id: 43,
        question: "O que é fluxo linear e fluxo decrescente?",
        answer: [
          "Fluxo linear organiza o saldo parcelado com a construtora em uma mensalidade nivelada na simulação, considerando prazo e condições pré/pós-obra. O material de referência fornecido descreve uma parcela corrigida final no WF-13. Isso não elimina disposições contratuais sobre índices e diferenças de atualização.",
          "Fluxo decrescente concentra parte maior do pagamento no começo e reduz a distribuição nos períodos seguintes. O material descreve na guia Associativo a distribuição de 40%, 30%, 20% e 10% em quatro períodos, nas células B64, B68, B72 e B76. O valor efetivo de cada mensal depende da quantidade de parcelas, das datas e das correções de cada bloco.",
          "Nesta página, a base mensal desconta as anuais nominais. A Data de término da obra, vinda do cadastro da unidade, separa os juros: 0,5% ao mês antes do mês do término e 1,5% a partir dele. O Linear mantém uma mensal nivelada. No Decrescente, os quatro blocos recebem juros até seus próprios pagamentos. Por isso, um bloco posterior pode ter parcela maior. As datas do primeiro juro e da primeira mensal também alteram o cálculo.",
          "A memória local não comprova equivalência nem execução dos workflows oficiais WF-13 e WF-13B. Linear e decrescente, aqui, organizam pagamentos à construtora. Não são a mesma coisa que SAC e Price, que são sistemas de amortização também utilizados pelo banco.",
        ],
        sources: [sources.installments],
      },
    ],
  },
];
