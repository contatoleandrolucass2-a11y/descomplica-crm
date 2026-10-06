export const ASSOCIATIVE_PROFILE_HELP = {
  income: {
    title: "Qual renda devo informar?",
    description:
      "Some quanto ganham por mês todas as pessoas que participarão da compra. Use os comprovantes aceitos pelo banco. Essa renda ajuda a verificar as regras da cidade e o tipo de financiamento. Ela também mostra quanto as parcelas usam da renda nos campos % Comprometimento da Renda e % Máximo da renda mensal. A renda entra no cálculo estimado da Evolução de Obra e no limite dos pagamentos anuais. Se a renda estiver errada, esses resultados também ficarão errados. A aprovação final depende da análise oficial.",
  },
  modality: {
    title: "Como a modalidade é escolhida?",
    description:
      "O sistema confere a renda, o valor do imóvel e a resposta sobre primeiro imóvel. Se atender às regras desta página, começa em MCMV (Minha Casa, Minha Vida). Nesse caso, também é possível escolher SBPE (Sistema Brasileiro de Poupança e Empréstimo). Se não atender, usa SBPE. A escolha muda as regras e as estimativas de financiamento e documentação. Ela não aprova crédito nem muda sozinha o valor que você informou em Financiamento. Confirme as condições com o banco.",
  },
  firstProperty: {
    title: "Quando devo marcar Sim?",
    description:
      "Marque Sim se o cliente não tem outro imóvel residencial e não tem financiamento de moradia em andamento. Se tiver qualquer um deles, marque Não. A resposta ajuda a escolher MCMV ou SBPE e a estimar ITBI (imposto sobre a compra) e registro do imóvel. Ela não prova, sozinha, que esta é a primeira compra. Também não garante dispensa de pagamento ou desconto. Banco, prefeitura e cartório precisam conferir as regras e os documentos.",
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
      "Compara duas formas de pagar: Linear e Decrescente. O resultado é uma simulação. A equipe comercial e o banco ainda precisam conferir e aprovar a proposta.",
  },
  {
    label: "Passo a passo e guia da proposta",
    location: "Guia e cabeçalho de Monte a proposta",
    detail:
      "O guia mostra a ordem de preenchimento e não muda os valores. Primeiro, informe renda, modalidade e primeiro imóvel para completar o perfil. Depois, preencha Financiamento, Subsídio, FGTS, Cheque Moradia, Entrada, parcelas e Ranking. Digite zero para confirmar que não há um recurso opcional.",
  },
  {
    label: "Orientação dos filtros",
    location: "Escolha a unidade",
    detail:
      "Use os filtros para encontrar uma unidade que atenda às condições da compra. Confira a identificação, a planta, o preço e a entrega antes de montar a proposta. Trocar a unidade muda os valores usados na simulação.",
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
      "A conta é: Valor do imóvel com kit − B.A. da unidade − folga de tabela. A ajuda mostra cada valor da unidade escolhida. O desconto comercial, se houver, ainda será retirado na próxima etapa.",
  },
  {
    label: "Desconto e Valor do imóvel",
    location: "Monte a proposta, após Inserir Desconto",
    detail:
      "O desconto é opcional e precisa de autorização comercial. A conta é: Valor real da venda − desconto = Valor do imóvel. Esse resultado será usado nos cálculos dos recursos e pagamentos. A ajuda mostra a conta. Clicar em Inserir Desconto não autoriza o desconto.",
  },
  {
    label: "Financiamento",
    location: "Monte a proposta, composição de recursos",
    detail:
      "Digite apenas o valor aprovado pelo banco, maior que zero. Não some FGTS, subsídio, Cheque Moradia ou entrada a esse valor. O financiamento reduz o Saldo após recursos e libera o campo Subsídio. A ajuda mostra quanto ainda falta pagar.",
  },
  {
    label: "Subsídio",
    location: "Monte a proposta, após Financiamento",
    detail:
      "Subsídio é uma ajuda para pagar o imóvel. Digite o valor confirmado ou zero, se não houver. Ele reduz o Saldo após recursos e libera o campo FGTS. Estar no MCMV não garante que o cliente receberá subsídio.",
  },
  {
    label: "FGTS",
    location: "Monte a proposta, após Subsídio",
    detail:
      "Digite apenas o valor do FGTS autorizado para esta compra, ou zero. Ele reduz o Saldo após recursos e libera o campo Cheque Moradia. Ter saldo no FGTS não garante que ele possa ser usado. O uso depende das regras do FGTS e da análise oficial.",
  },
  {
    label: "Cheque Moradia",
    location: "Monte a proposta, após FGTS",
    detail:
      "Digite o valor confirmado do Cheque Moradia ou zero, se não houver. Ele reduz o Saldo após recursos e libera o campo Entrada. O campo estar disponível não significa que o benefício foi aprovado.",
  },
  {
    label: "Saldo após recursos",
    location: "Monte a proposta, antes da Entrada",
    detail:
      "É o que falta pagar depois dos recursos confirmados. A conta é: Valor do imóvel após desconto − Financiamento − Subsídio − FGTS − Cheque Moradia. A ajuda mostra cada valor. Entrada e Sinais ainda serão descontados.",
  },
  {
    label: "Entrada",
    location: "Monte a proposta, junto à data do pagamento",
    detail:
      "É um pagamento obrigatório de pelo menos R$ 150,00 na data mostrada. Ele reduz o Pró-Soluto e o Saldo parcelado. Na ajuda, confira a data, o mínimo, se o valor foi aceito e quanto entrou na conta. Os ajustes sugeridos mantêm a entrada informada e só acrescentam o que falta.",
  },
  {
    label: "Sinal 1, Sinal 2 e Sinal 3",
    location: "Monte a proposta, após Inserir Sinal",
    detail:
      "Você pode incluir até três pagamentos extras, chamados sinais. Cada um deve ter pelo menos R$ 150,00. Preencha na ordem: o Sinal 2 não pode superar o Sinal 1, e o Sinal 3 não pode superar o Sinal 2. A ajuda mostra a data, se o valor foi aceito, o motivo e a soma dos sinais válidos. Ao ocultar um sinal, os seguintes também podem ser zerados. Confira o aviso do botão.",
  },
  {
    label: "Anual 1 a Anual 5",
    location: "Monte a proposta, após Inserir Anual",
    detail:
      "São pagamentos opcionais em 15/12 até a entrega. Confira quais datas estão disponíveis e os limites mostrados. Cada anual, antes da correção, pode ser de até 50% da renda mensal. A correção é: valor × 1,005 × 1,005 elevado aos meses do cronograma. A ajuda mostra a data, os meses, o valor corrigido e se a anual foi aceita. O Saldo parcelado desconta as anuais válidas pelos valores digitados, sem reajustes. Já o cálculo das mensais usa as anuais reajustadas para definir sua base. As anuais continuam dentro do Pró-Soluto: elas mudam a forma de pagar, sem reduzir esse total. Ao ocultar uma anual, seu valor é zerado.",
  },
  {
    label: "Saldo parcelado",
    location: "Monte a proposta, antes da quantidade de parcelas",
    detail:
      "Mostra quanto sobra depois dos pagamentos informados, sem reajustes. Primeiro: Saldo após recursos − Entrada − Sinais válidos = Pró-Soluto, antes da correção. Depois: Pró-Soluto − soma dos valores digitados nas anuais válidas = Saldo parcelado. Para calcular as mensais, o simulador faz uma conta separada: Pró-Soluto − total das anuais reajustadas. Depois, aplica a regra de reajuste das mensais. Por isso, dividir o Saldo parcelado pela quantidade de parcelas não mostra, sozinho, quanto será pago por mês. Não desconte as anuais de novo do Saldo parcelado. O Pró-Soluto continua incluindo as anuais.",
  },
  {
    label: "Qtd. de parcelas",
    location: "Monte a proposta, última linha",
    detail:
      "Digite uma quantidade sem vírgula, dentro do limite mostrado, até 84 parcelas. A ajuda mostra quantas vencem antes e depois da entrega. Também confere a divisão em quatro grupos: 40%, 30%, 20% e 10%. Mudar a quantidade muda o valor das mensais. Se aparecer quantidade inválida, corrija antes de continuar.",
  },
  {
    label: "% Pró-Soluto",
    location: "Parâmetros de aprovação, primeira regra",
    detail:
      "Mostra qual parte do valor do imóvel ficou no Pró-Soluto. A conta é: Pró-Soluto ÷ valor real do imóvel após desconto × 100. O Pró-Soluto é o Saldo após recursos menos Entrada e Sinais válidos, antes da correção. Ele inclui as anuais, por isso elas não reduzem esse percentual. Não use o Saldo parcelado nesta conta: ele já desconta as anuais válidas. O percentual é igual no Linear e no Decrescente e é comparado ao limite do Ranking. A ajuda mostra os dois valores da divisão e o resultado.",
  },
  {
    label: "% Comprometimento da Renda",
    location: "Parâmetros de aprovação, segunda regra",
    detail:
      "Mostra quanto a maior parcela mensal usa da renda. A conta é: Maior parcela mensal corrigida ÷ renda familiar × 100, sem Evolução de Obra. A ajuda mostra o valor e a data dessa parcela no Linear e no Decrescente. A conta procura a maior mensal, não apenas a primeira. Ela não substitui a análise do banco sobre todas as dívidas do cliente.",
  },
  {
    label: "% Máximo da renda mensal",
    location: "Parâmetros de aprovação, terceira regra",
    detail:
      "Mostra o mês em que a mensal com Evolução de Obra mais usa a renda. A conta é: maior soma de mensal corrigida + Evolução de Obra, dividida pela renda familiar, vezes 100. A ajuda mostra o valor e a data no Linear e no Decrescente. Esse percentual não inclui o valor da anual. Ela pode estar somada ao total da mesma linha mensal no cronograma. Confira também se a anual e as outras despesas cabem no orçamento.",
  },
  {
    label: "Ranking, status e Repasse",
    location: "Parâmetros de aprovação",
    detail:
      "O Ranking define os limites comerciais usados na análise. Linear e Decrescente têm resultados de aprovação separados. Confira todas as regras, os detalhes dos cálculos e os avisos. Repasse tem uma regra própria e não substitui a aprovação da proposta. Ver ajustes necessários só mostra uma sugestão. A proposta muda quando você clica em Aplicar estes valores.",
  },
  {
    label: "Resumo das parcelas",
    location: "Quadro abaixo de Parâmetros de aprovação",
    detail:
      "Compara o Linear com os quatro grupos do Decrescente. Mostra quantidade, valores antes e depois da correção e datas da primeira e da última parcela. O Saldo parcelado usa as anuais válidas pelos valores digitados, sem reajustes. O cálculo das mensais usa outra base: Pró-Soluto − total das anuais reajustadas. A regra de reajuste das mensais é aplicada separadamente. Ela usa 0,5% ao mês antes do mês de entrega e 1,5% a partir do mês de entrega. Essas não são as taxas do financiamento bancário. Exibir parcelas mostra datas de pagamento, Evolução de Obra, totais e percentuais da renda.",
  },
  {
    label: "Proposta pronta: Desconto, Valor de Contrato e B.A. da Unidade",
    location: "Proposta pronta - Bora Vender, resumo da proposta",
    detail:
      "Valor de Contrato é o valor calculado para preparar o contrato. Na proposta faturada, Desconto = valor final com kit − Valor de Contrato. B.A. da Unidade = Valor de Contrato − valor real. Na comissão apartada, a comissão é tratada em separado. Nesse caso, o desconto também retira comissão e prêmio. O B.A. usa o valor real depois de retirar essa remuneração. Esse quadro tem cálculos próprios. Confira as duas contas antes de substituir valores de Monte a proposta.",
  },
  {
    label: "Proposta pronta: recursos, Sinal CC, sinais, anuais e parcelas",
    location: "Proposta pronta - Bora Vender, linhas da composição",
    detail:
      "As ajudas mostram o financiamento usado, Subsídio, FGTS, Cheque Moradia e Sinal CC, que é a Entrada na assinatura. Mostram também cada sinal, cada anual e a quantidade de parcelas mensais. Outros pagamentos ativos também entram na conta. Confira em separado a proposta faturada e a proposta com comissão apartada. Uma linha zerada ou sem valor positivo não significa que um benefício foi concedido.",
  },
  {
    label: "Comissão e prêmio",
    location: "Proposta pronta, quando houver comissão apartada; remuneração no ícone $",
    detail:
      "Na proposta com comissão apartada, a comissão e o prêmio são calculados em separado. O cálculo segue o modelo comercial e o Ranking permitido para o caso. Esses valores pagam o trabalho da venda. Não são FGTS, subsídio ou desconto automático para o comprador. Confira o canal de venda, a classificação e o modelo antes de apresentar o resultado.",
  },
  {
    label: "Composição da documentação",
    location: "Resumo financeiro, ao lado de Composição",
    detail:
      "A conta é: ITBI + Registro total + Despachante + Seguro Caixa. A ajuda mostra cada custo, a modalidade usada, a avaliação do banco e o limite estimado de financiamento. Também explica qual regra de ITBI foi usada. Prefeitura e cartório precisam confirmar os impostos e os custos de registro. Exibir parcelas neste quadro mostra somente os pagamentos da documentação.",
  },
] as const;

export const ASSOCIATIVE_FIELD_GUIDE_SECTION = {
  title: "Guia dos ícones de informação",
  questions: ASSOCIATIVE_FIELD_GUIDE.map(({ label, location, detail }) => ({
    question: label,
    answer: `Onde se aplica: ${location}. ${detail}`,
  })),
};
