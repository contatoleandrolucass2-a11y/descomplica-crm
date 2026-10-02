export const ASSOCIATIVE_PROFILE_HELP = {
  income: {
    title: "Qual renda devo informar?",
    description:
      "Digite a renda mensal somada de todas as pessoas que participarão da compra, conforme os comprovantes aceitos pelo banco. Além do enquadramento municipal e da modalidade, ela é a base do % Comprometimento da Renda e do % Máximo da renda mensal. Também participa da estimativa de Evolução de Obra e do limite das anuais. Renda incorreta distorce esses resultados. A aprovação final depende da análise oficial.",
  },
  modality: {
    title: "Como a modalidade é escolhida?",
    description:
      "O sistema verifica renda, valor do imóvel e primeiro imóvel. Se o perfil passar pela triagem local, começa em MCMV; quem for elegível pode escolher SBPE. Fora dessa triagem, usa SBPE. A escolha afeta o enquadramento e as estimativas de financiamento e documentação, mas não aprova crédito nem altera automaticamente o financiamento informado. Confirme as condições com a instituição financeira.",
  },
  firstProperty: {
    title: "Quando devo marcar Sim?",
    description:
      "Nesta triagem, marque Sim quando o cliente não possui outro imóvel residencial nem financiamento habitacional ativo; caso contrário, marque Não. A resposta participa da escolha MCMV/SBPE e das estimativas de ITBI e registro. Não representa, sozinha, prova de primeira aquisição nem garantia de isenção ou desconto: banco, prefeitura e cartório devem confirmar os requisitos e documentos.",
  },
} as const;

export const ASSOCIATIVE_POLICY_TOPICS = [
  {
    title: "Renda familiar e capacidade de pagamento",
    items: [
      ASSOCIATIVE_PROFILE_HELP.income.description,
      "% Comprometimento da Renda = maior parcela mensal corrigida do cronograma ÷ renda familiar × 100. Não soma Evolução de Obra. O cálculo é separado para Linear e Decrescente; confira também a data do pico na ajuda do indicador.",
      "O % Máximo da renda mensal procura, entre os meses do cronograma, o maior total de parcela corrigida + Evolução de Obra e divide pela renda familiar. Não é renda anual nem a soma de todos os pagamentos de dezembro. O indicador exclui a anual, mesmo quando ela compõe o total da mesma linha mensal na memória; esse pagamento também precisa caber no orçamento.",
      "Exemplo ilustrativo: renda de R$ 5.000,00 e maior mensal corrigida de R$ 750,00 representam 15% de comprometimento. Se o maior total mensal com Evolução de Obra for R$ 2.000,00, o outro indicador será 40%. Os picos podem ocorrer em datas diferentes. Compare cada resultado com o limite do Ranking selecionado, não com um percentual bancário universal.",
      "A renda também limita cada anual nominal a 50% da renda mensal nesta página e compõe a estimativa de Evolução de Obra: renda × 30% × andamento. Essa projeção comercial não é o cálculo do encargo bancário real e não reúne todas as despesas da família. Não aumente a renda apenas para obter aprovação.",
    ],
  },
  {
    title: "MCMV e SBPE: finalidade e impacto",
    items: [
      "O Minha Casa, Minha Vida (MCMV) é uma política habitacional voltada ao acesso à moradia. Na linha financiada, oferece condições específicas de crédito e, para perfis elegíveis, subsídio. Faixa de renda, valor e localização do imóvel e demais requisitos influenciam as condições; selecionar MCMV não garante benefício.",
      "O Sistema Brasileiro de Poupança e Empréstimo (SBPE) direciona recursos captados na poupança ao financiamento imobiliário em geral. Não é uma faixa do MCMV nem um programa de subsídio habitacional. Atende também operações fora do enquadramento do MCMV, conforme o produto e a análise do banco.",
      "As alternativas existem para públicos e fontes de recursos diferentes. Juros, entrada necessária, cota financiável, subsídio e despesas de contratação podem mudar. Compare as condições oficiais e o custo total; não escolha a modalidade apenas pelo menor valor estimado na tela.",
      "Nesta página, a seleção alimenta a triagem do perfil, o Resumo financeiro da documentação e a Proposta pronta - Bora Vender. O campo Financiamento continua sendo o valor informado pelo corretor: trocar a modalidade não equivale a receber uma nova aprovação. As parcelas Linear/Decrescente são do pró-soluto comercial, não a prestação do financiamento bancário.",
      "O perfil usa o preço do estoque; a documentação reavalia a modalidade com o valor real após deduções. Perto dos limites, os quadros podem indicar modalidades diferentes. Confira a modalidade efetiva na ajuda Composição da documentação e concilie a divergência com a análise oficial antes de formalizar.",
      "As faixas MCMV são federais. HIS-1, HIS-2 e HMP são classificações municipais distintas; uma não substitui a outra. Os limites simplificados usados pelo simulador não comprovam enquadramento em todas as localidades ou linhas de crédito.",
    ],
  },
  {
    title: "Primeiro imóvel e documentação",
    items: [
      ASSOCIATIVE_PROFILE_HELP.firstProperty.description,
      "Marcar Não direciona a triagem desta página para SBPE; isso não significa que o cliente está impedido de comprar ou financiar outro imóvel. Marcar Sim não aprova MCMV automaticamente: renda, unidade, histórico e demais requisitos ainda precisam ser analisados.",
      "O motor documental usa primeiro imóvel e modalidade efetiva para selecionar suas regras de ITBI e registro. Mudar a resposta pode alterar o total estimado e suas parcelas. ITBI é municipal; registro depende dos atos e emolumentos do cartório. Não há isenção nacional automática de ITBI por ser o primeiro imóvel.",
      "A pergunta simplifica a triagem comercial. Não possuir imóvel hoje não comprova que nunca houve aquisição anterior; informe o histórico completo na análise oficial. Confirme os benefícios aplicáveis, sem prometer documentação gratuita ou redução fixa sobre o total.",
      "Na estimativa local, primeiro imóvel em MCMV pode zerar o ITBI até o limite parametrizado; em SBPE essa condição de isenção não é aplicada. A resposta Sim também aplica fatores locais aos registros de compra e de alienação. Esses critérios não comprovam direito ao benefício em qualquer município e não dispensam a conferência da guia e do cartório.",
    ],
  },
  {
    title: "Valor do imóvel, avaliação e custos",
    items: [
      "Confira a unidade, incorporadora, valor com kit, B.A., folga de tabela, avaliação bancária e entrega. O valor real da venda parte do valor com kit menos B.A. e folga; um desconto comercial autorizado reduz a base seguinte. Preço de venda e avaliação bancária são bases diferentes.",
      "O valor e a avaliação influenciam o enquadramento, a capacidade estimada de financiamento e os custos documentais. Se a avaliação não vier do relatório, preencha Avaliação bancária no Resumo financeiro; não a substitua automaticamente pelo preço de venda. A instituição avalia a garantia e confirma o crédito.",
      "O Resumo financeiro estima ITBI + Registro total + Despachante + Seguro Caixa. Modalidade, primeiro imóvel, valor de venda, avaliação, financiamento e incorporadora participam da regra local. A renda participa do enquadramento; a data-base orienta o primeiro vencimento. O total e o parcelamento são estimativas, sujeitos à validação do banco, município e cartório.",
      "O teto documental local considera o menor valor entre venda e avaliação × cota, usando 80% para MCMV e 90% para SBPE. Essas cotas parametrizadas não são uma promessa de financiamento: produto, imóvel, banco e análise de crédito podem impor condições diferentes. Um teto calculado pela avaliação não mede quanto a família consegue pagar por mês.",
      "Exibir parcelas em Resumo das parcelas mostra o cronograma comercial. Exibir parcelas em Resumo financeiro mostra somente a documentação. Some essas obrigações e as condições reais do banco ao analisar o orçamento; não confunda um quadro com o outro.",
    ],
  },
] as const;

// Each entry names the existing help control and its location, without copying live proposal data.
export const ASSOCIATIVE_FIELD_GUIDE = [
  {
    label: "Tabela Associativo",
    location: "Título da página",
    detail:
      "Apresenta a simulação associativa e a comparação dos fluxos. O resultado é preliminar e precisa de validação comercial e bancária.",
  },
  {
    label: "Passo a passo e guia da proposta",
    location: "Guia e cabeçalho de Monte a proposta",
    detail:
      "O guia explica a sequência de preenchimento sem modificar os valores. Renda, modalidade e primeiro imóvel liberam o perfil; depois vêm Financiamento, Subsídio, FGTS, Cheque Moradia, Entrada, parcelas e Ranking. Zero confirma a ausência de um recurso opcional.",
  },
  {
    label: "Orientação dos filtros",
    location: "Escolha a unidade",
    detail:
      "Os filtros localizam a unidade elegível. Confira identidade, planta, preço e entrega antes de iniciar a proposta; trocar a unidade muda as bases da simulação.",
  },
  {
    label: "Renda Familiar",
    location: "Perfil do financiamento, pergunta 1",
    detail: ASSOCIATIVE_PROFILE_HELP.income.description,
  },
  {
    label: "Modalidade do Financiamento",
    location: "Perfil do financiamento, pergunta 2",
    detail: ASSOCIATIVE_PROFILE_HELP.modality.description,
  },
  {
    label: "Primeiro imóvel",
    location: "Perfil do financiamento, pergunta 3",
    detail: ASSOCIATIVE_PROFILE_HELP.firstProperty.description,
  },
  {
    label: "Valor real da venda",
    location: "Monte a proposta, primeira linha da composição",
    detail:
      "Valor do imóvel com kit − B.A. da unidade − folga de tabela. A ajuda mostra a conta com os valores da unidade atual; esta linha antecede eventual desconto comercial.",
  },
  {
    label: "Desconto e Valor do imóvel",
    location: "Monte a proposta, após Inserir Desconto",
    detail:
      "Desconto é opcional e precisa de autorização comercial. Valor real da venda − desconto = base usada pelos recursos e pagamentos. A ajuda apresenta essa subtração; clicar no botão não concede autorização de desconto.",
  },
  {
    label: "Financiamento",
    location: "Monte a proposta, composição de recursos",
    detail:
      "Informe somente o crédito aprovado pelo banco, maior que zero. Não some FGTS, subsídio, Cheque Moradia ou entrada. Libera Subsídio e reduz o saldo após recursos; a ajuda mostra o saldo atual.",
  },
  {
    label: "Subsídio",
    location: "Monte a proposta, após Financiamento",
    detail:
      "Informe o benefício confirmado ou zero se não houver. Reduz o saldo após recursos e libera FGTS. O enquadramento em MCMV não atribui automaticamente um subsídio.",
  },
  {
    label: "FGTS",
    location: "Monte a proposta, após Subsídio",
    detail:
      "Informe somente o valor autorizado para esta compra, ou zero. Reduz o saldo após recursos e libera Cheque Moradia. A possibilidade de uso depende das regras próprias do FGTS e da análise oficial.",
  },
  {
    label: "Cheque Moradia",
    location: "Monte a proposta, após FGTS",
    detail:
      "Informe o benefício confirmado ou zero. Reduz o saldo após recursos e libera Entrada. Não presuma concessão apenas porque o campo está disponível.",
  },
  {
    label: "Saldo após recursos",
    location: "Monte a proposta, antes da Entrada",
    detail:
      "Valor do imóvel após desconto − Financiamento − Subsídio − FGTS − Cheque Moradia. A ajuda detalha todos os valores dessa subtração; Entrada e Sinais ainda serão deduzidos.",
  },
  {
    label: "Entrada",
    location: "Monte a proposta, junto à data do pagamento",
    detail:
      "Pagamento obrigatório de pelo menos R$ 150,00 na data exibida. Reduz o saldo parcelado; confira data, mínimo, validação e valor considerado na ajuda. Os ajustes sugeridos preservam a entrada já informada e só acrescentam o necessário.",
  },
  {
    label: "Sinal 1, Sinal 2 e Sinal 3",
    location: "Monte a proposta, após Inserir Sinal",
    detail:
      "Até três pagamentos opcionais, com mínimo de R$ 150,00 cada. Preencha na sequência; do segundo em diante, o valor não pode superar o anterior. Cada ajuda mostra vencimento, motivo da validação, valor aceito e total dos sinais válidos. Ocultar um sinal pode zerar também os seguintes, conforme o aviso do botão.",
  },
  {
    label: "Anual 1 a Anual 5",
    location: "Monte a proposta, após Inserir Anual",
    detail:
      "Pagamentos opcionais em 15/12 até a entrega, sujeitos às vagas e limites exibidos. Cada anual nominal é limitada a 50% da renda mensal. A correção exibida é valor × 1,005 × 1,005 elevado aos meses do cronograma. A ajuda mostra data, meses, valor corrigido e status. Anuais válidas reduzem a base das mensais, não o Pró-Soluto nem o Saldo parcelado; ocultar zera o valor.",
  },
  {
    label: "Saldo parcelado",
    location: "Monte a proposta, antes da quantidade de parcelas",
    detail:
      "Saldo após recursos − Entrada − Sinais válidos = Pró-Soluto antes da correção. A ajuda também informa a base mensal após anuais. São valores diferentes: o saldo parcelado não diminui quando se insere uma anual.",
  },
  {
    label: "Qtd. de parcelas",
    location: "Monte a proposta, última linha",
    detail:
      "Use um inteiro dentro do limite exibido, até 84. A ajuda informa parcelas antes/depois da entrega e valida a distribuição nos quatro blocos de 40%, 30%, 20% e 10%. O prazo altera o valor das mensais; não ignore a mensagem de quantidade inválida.",
  },
  {
    label: "% Pró-Soluto",
    location: "Parâmetros de aprovação, primeira regra",
    detail:
      "Saldo parcelado ÷ valor real do imóvel após desconto × 100. É comum aos dois fluxos e comparado ao limite do Ranking. Anuais não reduzem esse percentual. A ajuda mostra numerador, denominador e resultado da proposta atual.",
  },
  {
    label: "% Comprometimento da Renda",
    location: "Parâmetros de aprovação, segunda regra",
    detail:
      "Maior parcela mensal corrigida ÷ renda familiar × 100, sem Evolução de Obra. A ajuda identifica valor e data do pico de cada fluxo. Não usa apenas a primeira mensal e não representa a análise completa de endividamento do banco.",
  },
  {
    label: "% Máximo da renda mensal",
    location: "Parâmetros de aprovação, terceira regra",
    detail:
      "É o indicador de máxima carga mensal: maior soma de mensal corrigida + Evolução de Obra, dividida pela renda familiar. A ajuda identifica os picos Linear e Decrescente. Não inclui o valor da anual, mesmo quando ela integra o total da mesma linha mensal no cronograma; revise também esse pagamento e as demais despesas do cliente.",
  },
  {
    label: "Ranking, status e Repasse",
    location: "Parâmetros de aprovação",
    detail:
      "O Ranking seleciona os limites comerciais. Cada fluxo tem seu próprio status; confira todas as regras, a memória e as mensagens. Repasse tem critério separado e não substitui aprovação da proposta. Ver ajustes necessários abre uma prévia; Aplicar estes valores é que modifica a composição.",
  },
  {
    label: "Resumo das parcelas",
    location: "Quadro abaixo de Parâmetros de aprovação",
    detail:
      "Compara Linear e os quatro blocos Decrescentes, quantidade, valores sem/com correção e primeira/última data. A base mensal considera anuais válidas. A regra local utiliza 0,5% ao mês antes do mês de entrega e 1,5% a partir do mês de entrega; não são taxas do financiamento bancário. Exibir parcelas detalha vencimentos, Evolução de Obra, totais e percentuais da renda.",
  },
  {
    label: "Proposta pronta: Desconto, Valor de Contrato e B.A. da Unidade",
    location: "Proposta pronta - Bora Vender, resumo da proposta",
    detail:
      "Valor de Contrato é a base calculada para formalização. Na faturada, Desconto é valor final com kit menos contrato; B.A. da Unidade é contrato menos valor real. Na comissão apartada, o desconto também deduz comissão/prêmio, e o B.A. usa o valor real líquido dessa remuneração. São bases próprias desse quadro: não substitua os números de Monte a proposta sem conciliar as duas composições.",
  },
  {
    label: "Proposta pronta: recursos, Sinal CC, sinais, anuais e parcelas",
    location: "Proposta pronta - Bora Vender, linhas da composição",
    detail:
      "As ajudas identificam o crédito considerado, Subsídio, FGTS, Cheque Moradia, Sinal CC (Entrada na assinatura), cada Sinal/Anual informado e a quantidade mensal. Pagamentos adicionais ativos também entram. Confira os valores faturados e apartados separadamente; uma linha sem valor positivo não representa benefício concedido.",
  },
  {
    label: "Comissão e prêmio",
    location: "Proposta pronta, quando houver comissão apartada; remuneração no ícone $",
    detail:
      "O quadro apartada considera comissão e prêmio calculados pelo modelo comercial e pelo Ranking elegível. Remuneração não é recurso de FGTS, subsídio nem desconto automático concedido ao comprador. Confirme canal, classificação e modelo antes de apresentar o resultado.",
  },
  {
    label: "Composição da documentação",
    location: "Resumo financeiro, ao lado de Composição",
    detail:
      "Soma ITBI + Registro total + Despachante + Seguro Caixa. A ajuda mostra cada parcela da soma, modalidade efetiva, avaliação bancária, teto de financiamento estimado e regra de ITBI aplicada. A confirmação tributária e cartorária é externa; Exibir parcelas neste painel abre somente o plano da documentação.",
  },
] as const;

export const ASSOCIATIVE_FIELD_GUIDE_SECTION = {
  title: "Guia dos ícones de informação",
  questions: ASSOCIATIVE_FIELD_GUIDE.map(({ label, location, detail }) => ({
    question: label,
    answer: `Onde se aplica: ${location}. ${detail}`,
  })),
};
