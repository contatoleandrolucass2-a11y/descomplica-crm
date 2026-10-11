export type AssociativePageGuideStep = {
  id: string;
  title: string;
  description: string;
  selector: string;
  fallback?: string;
  unavailable?: string;
};

const proposal = '[data-tour="proposal"]';
const resources = ".investor-associative-resource-actions";
const field = (name: string) => `li:has([aria-label="${name}"])`;

export const ASSOCIATIVE_PAGE_GUIDE_STEPS: readonly [
  AssociativePageGuideStep,
  ...AssociativePageGuideStep[],
] = [
  {
    id: "welcome",
    title: "Conheça o caminho da proposta",
    selector: ".investor-stock-panel",
    description:
      "Vamos percorrer a página inteira: escolher o imóvel, preencher os dados e conferir os resultados. Você pode voltar ou fechar a qualquer momento. O guia não escolhe imóveis nem muda valores por você.",
  },
  {
    id: "help",
    title: "Ajuda ao lado de cada campo",
    selector: ".investor-stock-title-row",
    description:
      "O pequeno ícone de informação explica o campo ao lado. Passe o mouse, use o teclado ou clique para ler. Os avisos da página também dizem o que está faltando ou precisa ser corrigido.",
  },
  {
    id: "filters",
    title: "Encontre o imóvel",
    selector: '[data-tour="filters"]',
    description:
      "Combine Incorporadora, Nome do Empreendimento, Região, Planta e Valor do Imóvel. Os números mostram quantas unidades combinam com a busca. Se a lista ficar vazia, retire um filtro ou use Limpar filtros.",
  },
  {
    id: "sort",
    title: "Compare os preços e recomece a busca",
    selector: '[data-tour="sort"]',
    description:
      "Ordenar valor coloca os menores ou os maiores preços primeiro. Limpar filtros reabre a busca. Esses controles mudam a lista, mas não apagam a proposta que você já começou. Confira também a atualização do estoque.",
  },
  {
    id: "inventory",
    title: "Escolha a unidade certa",
    selector: '[data-tour="inventory"]',
    description:
      "Confira produto, metragem, término da obra, planta e preço. Use a seta da primeira coluna ou clique na linha para selecionar. A linha marcada é a unidade da simulação. Sem estoque disponível ou dados essenciais, a seleção fica bloqueada.",
  },
  {
    id: "property",
    title: "Leia a ficha do imóvel",
    selector: '[data-tour="property-summary"]',
    description:
      "Confira incorporadora, planta, metragem, andar, andamento da obra, término da obra, avaliação bancária, volta ao caixa e outras descrições. O término vem do cadastro da unidade e separa pré e pós-obra; o mês do término já é pós-obra.",
  },
  {
    id: "missing-facts",
    title: "Não adivinhe dados que estão faltando",
    selector: ".investor-associative-unit-facts",
    fallback: '[data-tour="property-summary"]',
    unavailable: "Os campos complementares só aparecem quando faltam dados oficiais da unidade.",
    description:
      "Se o andamento da obra ou a avaliação bancária não vierem no estoque, a página pede esses dados. Use somente valores oficiais. Eles valem para esta simulação e não alteram o cadastro. Resultados que dependem deles aguardam o preenchimento.",
  },
  {
    id: "income",
    title: "1. Informe a renda familiar",
    selector: '.investor-associative-question:has([aria-label="Renda Familiar"])',
    description:
      "Digite a renda mensal total da família. Ela precisa ser maior que zero. A página usa esse valor para comparar os pagamentos com a renda e verificar o enquadramento. Depois, libera a modalidade do financiamento.",
  },
  {
    id: "modality",
    title: "2. Confirme a modalidade",
    selector: ".investor-associative-question:has(#investor-associative-modality-status)",
    description:
      "Confira MCMV ou SBPE e selecione a opção adequada. Leia o aviso abaixo: ele informa o enquadramento ou por que uma opção não está disponível. Essa indicação é preliminar e não substitui a análise do banco.",
  },
  {
    id: "first-property",
    title: "3. Responda sobre o primeiro imóvel",
    selector: '.investor-associative-question:has(input[type="radio"])',
    description:
      "Responda Sim ou Não conforme a situação real do cliente. Quando as três perguntas estiverem completas, o fluxo de pagamentos será liberado. Alterar uma resposta pode exigir uma nova conferência das seguintes.",
  },
  {
    id: "sale-discount",
    title: "Confira o valor e o desconto",
    selector: ".investor-associative-payment-actions-bar",
    fallback: proposal,
    description:
      "O Valor real da venda vem da unidade. Inserir Desconto abre o campo opcional e reduz o Valor do imóvel usado na proposta. Só use um desconto autorizado. O botão muda para Remover Desconto quando o campo está aberto.",
  },
  {
    id: "financing",
    title: "Informe o financiamento",
    selector: field("Financiamento"),
    fallback: proposal,
    description:
      "Digite o financiamento aprovado pelo banco, maior que zero. Esse valor libera os próximos campos, mas a página não confirma a aprovação do banco. Financiamento é diferente das parcelas pagas à incorporadora.",
  },
  {
    id: "subsidy",
    title: "Informe o subsídio",
    selector: field("Subsídio"),
    fallback: proposal,
    description:
      "Digite o subsídio aprovado. Se não houver subsídio, informe zero para continuar. Ele reduz o valor que ainda precisa ser pago pelo cliente.",
  },
  {
    id: "fgts",
    title: "Informe o FGTS",
    selector: field("FGTS"),
    fallback: proposal,
    description:
      "Digite o FGTS que será usado nesta compra. Se não houver, informe zero. Não inclua esse mesmo dinheiro novamente na entrada ou em outro pagamento.",
  },
  {
    id: "housing-check",
    title: "Informe o Cheque Moradia",
    selector: field("Cheque Moradia"),
    fallback: proposal,
    description:
      "Digite o valor do Cheque Moradia ou zero quando não houver. Após confirmar os recursos, a página libera a entrada e mostra quanto ainda falta pagar.",
  },
  {
    id: "entry",
    title: "Defina a entrada",
    selector: field("Entrada"),
    fallback: proposal,
    description:
      "Confira a data e digite o primeiro pagamento do cliente. Leia o mínimo e os avisos mostrados na linha. A entrada é descontada do Saldo após recursos para formar o restante da proposta.",
  },
  {
    id: "signals",
    title: "Adicione sinais, se precisar",
    selector: '[data-tour="proposal-signals"]',
    fallback: proposal,
    description:
      "Inserir Sinal acrescenta pagamentos iniciais depois da entrada. Confira valor, vencimento e avisos de cada um. O botão de remover zera o sinal e os seguintes indicados no aviso. Todos os sinais devem vencer antes da primeira mensal, nunca no mesmo dia.",
  },
  {
    id: "annuals",
    title: "Adicione anuais, se precisar",
    selector: '[data-tour="proposal-intermediaries"]',
    fallback: proposal,
    description:
      "Inserir Anual abre os pagamentos anuais permitidos pelo calendário. Confira os vencimentos e o valor corrigido indicado. O valor nominal de cada anual é descontado uma única vez do saldo das mensais. Remover uma anual zera esse pagamento.",
  },
  {
    id: "balances",
    title: "Confira o que ainda falta pagar",
    selector: 'li:has([aria-label^="Saldo parcelado:"])',
    fallback: proposal,
    description:
      "Saldo após recursos é o valor do imóvel menos financiamento, subsídio, FGTS e Cheque Moradia. Saldo parcelado também desconta entrada, sinais e anuais nominais. É essa base que será dividida nas mensais, antes dos juros.",
  },
  {
    id: "installment-count",
    title: "Escolha a quantidade de parcelas",
    selector: field("Quantidade de parcelas"),
    fallback: proposal,
    description:
      "Informe uma quantidade inteira dentro do limite mostrado. Confira quantas parcelas ficam antes e depois do término da obra. Mudar o prazo muda o valor mensal e pode mudar o resultado da aprovação.",
  },
  {
    id: "dates",
    title: "Confira as datas do cálculo",
    selector: ".investor-associative-calendar",
    fallback: proposal,
    description:
      "Abra Datas do cálculo. O término da obra vem do estoque e não é editável aqui. Confira data do cálculo, entrada, primeiro juro e primeira mensal. Para comparar uma proposta antiga, use as mesmas datas. Restaurar datas automáticas volta ao calendário atual.",
  },
  {
    id: "ranking",
    title: "Selecione a classificação correta",
    selector: ".investor-associative-approval-editable",
    fallback: proposal,
    unavailable:
      "A classificação aparece quando os dados necessários do fluxo estiverem preenchidos.",
    description:
      "Escolha o Ranking aplicável à proposta. Ele define os limites usados na comparação. Não escolha outra classificação apenas para obter aprovação: confirme qual regra realmente se aplica.",
  },
  {
    id: "approval",
    title: "Leia os três percentuais",
    selector: ".investor-associative-approval table",
    fallback: ".investor-associative-approval",
    unavailable: "Preencha o fluxo e selecione o Ranking para ver os percentuais calculados.",
    description:
      "Pró-Soluto compara o saldo corrigido correspondente com o valor do imóvel. Comprometimento compara a maior mensal corrigida com a renda. Máximo da renda mensal soma a mensal com a evolução da obra, sem as anuais. Reserve o dinheiro das anuais separadamente e confira o total de cada mês no cronograma. Compare Linear, Decrescente e Limite.",
  },
  {
    id: "release",
    title: "Confira o repasse",
    selector: ".investor-associative-release-status",
    fallback: ".investor-associative-approval",
    unavailable: "A situação do repasse aparece junto ao resultado da proposta.",
    description:
      "O quadro Repasse mostra se essa condição está liberada, depende de uma data ou precisa de ajuste. Leia a mensagem inteira. Repasse liberado e proposta aprovada são verificações diferentes.",
  },
  {
    id: "adjustments",
    title: "Resolva as pendências",
    selector: ".investor-associative-approval > footer",
    fallback: ".investor-associative-approval",
    unavailable: "Os avisos e sugestões aparecem conforme o resultado da proposta.",
    description:
      "Confira o status e a próxima ação. Se a página oferecer ajustes, abra e compare o que muda antes de aplicar. Uma sugestão só deve ser usada depois de conferir entrada, sinais, parcelas e datas com o cliente. Aprovação da simulação não é aprovação bancária.",
  },
  {
    id: "linear",
    title: "Compare a parcela Linear",
    selector: ".investor-associative-payment-table-row.is-linear",
    fallback: ".investor-associative-payment-summary",
    unavailable: "O resumo aparece depois que o fluxo estiver pronto para calcular.",
    description:
      "Na linha Linear 100%, confira quantidade, valor sem correção, valor com correção e as datas da primeira e da última mensal. O valor corrigido é diferente da simples divisão do saldo pelo número de parcelas.",
  },
  {
    id: "decreasing",
    title: "Compare os quatro blocos Decrescentes",
    selector: ".investor-associative-payment-summary",
    fallback: proposal,
    unavailable: "Complete os pagamentos para visualizar os quatro blocos.",
    description:
      "Leia as linhas de 40%, 30%, 20% e 10%. Cada bloco tem sua quantidade, valor corrigido e período. Confira todos eles: os juros e a passagem de pré para pós-obra podem fazer um bloco ficar maior do que o anterior.",
  },
  {
    id: "schedule",
    title: "Veja cada vencimento",
    selector: '[aria-controls="investor-associative-installments"]',
    fallback: ".investor-associative-payment-summary",
    unavailable: "Exibir parcelas é liberado quando o cronograma puder ser calculado.",
    description:
      "Exibir parcelas abre o cronograma completo. Compare Linear e Decrescente, evolução da obra, anuais, total do mês, percentual da renda e vencimentos. As opções da janela permitem ver as tabelas separadas e imprimir a visão escolhida.",
  },
  {
    id: "ready-proposal",
    title: "Confira a proposta pronta",
    selector: '[aria-controls="investor-associative-ready-proposal"]',
    fallback: ".investor-associative-payment-summary",
    unavailable: "A proposta pronta depende de dados completos e válidos.",
    description:
      "Proposta pronta - Bora Vender abre a composição final. Confira os valores, as condições e as mensagens de pendência antes de copiar ou usar o resultado no atendimento. Abrir essa conferência não envia a proposta ao Salesforce.",
  },
  {
    id: "remuneration",
    title: "Consulte a remuneração comercial",
    selector: '[aria-label="Abrir remuneração comercial"]',
    fallback: ".investor-associative-payment-summary",
    unavailable: "O botão de remuneração aparece junto ao resumo calculado.",
    description:
      "O botão $ ao lado das parcelas abre a remuneração comercial. Confira as bases, percentuais e condições apresentados na janela. Essa consulta é separada das parcelas que o cliente vai pagar.",
  },
  {
    id: "documentation",
    title: "Confira o custo da documentação",
    selector: ".investor-associative-documentation",
    fallback: proposal,
    description:
      "O Resumo financeiro da documentação reúne ITBI, registro, despachante e seguro. Informe os dados bancários ausentes e confira os dados fiscais: cidade, datas, bases e condições do contrato. Sem essa conferência, o cálculo documental fica pendente. Confira os dois registros, as regras aplicadas, o total e o primeiro vencimento. Os botões desse quadro mostram as parcelas da documentação e permitem imprimir.",
  },
  {
    id: "manual",
    title: "Use o manual quando tiver dúvidas",
    selector: '.investor-associative-resource-actions [aria-label="Manual da Associativo"]',
    fallback: resources,
    description:
      "Aprenda + abre o manual do Associativo, com explicações e perguntas frequentes. Ele complementa este guia. Os avisos e os dados da proposta continuam sendo a referência para a conferência do caso em atendimento.",
  },
  {
    id: "documents",
    title: "Confira os documentos do cliente",
    selector: '.investor-associative-resource-actions [aria-controls="investor-documentation-pf"]',
    fallback: resources,
    description:
      "Doc Pessoa Física abre a lista de documentos de identificação, estado civil, renda e dependentes. Confira a lista aplicável ao cliente antes de formalizar. Não envie documentos ou dados pessoais sem autorização.",
  },
  {
    id: "print",
    title: "Revise antes de imprimir",
    selector: '[aria-label="Imprimir a proposta associativa"]',
    fallback: resources,
    description:
      "Antes de imprimir, confira unidade, renda, recursos, entrada, sinais, anuais, datas e resultados. Corrija pendências. A impressão deve refletir a proposta conferida, e não uma versão ainda em preenchimento.",
  },
  {
    id: "platforms",
    title: "Acesse as plataformas de atendimento",
    selector: ".investor-associative-resource-actions a",
    fallback: resources,
    description:
      "Bora Vendas e Salesforce abrem as plataformas em outra aba. O guia não envia dados nem registra uma venda. Para formalizar, siga o processo autorizado e confira tudo novamente no sistema de destino.",
  },
  {
    id: "finish",
    title: "Pronto para conferir sua proposta",
    selector: ".investor-stock-panel",
    description:
      "Você percorreu todos os pontos da página. Volte às etapas que precisar, confira os avisos e valide a proposta antes de apresentar. Concluir guia apenas fecha esta apresentação. O botão Guia passo a passo permite começar de novo.",
  },
];
