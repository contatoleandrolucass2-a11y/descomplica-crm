/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Arquivo preservado da implementação oficial anexada.
"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  buildDirectTableAmortizationSchedule,
  buildDirectTablePreKeysSchedule,
  buildDirectTableProposalPreset,
  calculateDirectTableFileFlow,
  DIRECT_TABLE_PROPOSAL_OPTIONS,
} from "@/lib/archive-investor/direct-table-file-rules.mjs";
import {
  calculateInvestorFlow,
  distributeSignalBalance,
} from "@/lib/archive-investor/investor-calculator-rules.mjs";
import {
  buildInvestorFilterOptions,
  isInvestorEligibleUnit,
  matchesInvestorFilters,
  reconcileInvestorFilters,
  sortInvestorInventoryBySalePrice,
} from "@/lib/archive-investor/investor-filter-options.mjs";
import {
  ASSOCIATIVE_APPROVAL_TIERS,
  calculateAssociativeApproval,
  findAssociativeApprovalPlan,
} from "@/lib/archive-investor/associative-approval-rules.mjs";
import {
  buildAssociativeInstallmentMemory,
  buildAssociativePaymentComparison,
} from "@/lib/archive-investor/associative-installment-memory.mjs";
import { buildDocumentationInstallmentSchedule } from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import { calculateAssociativeDocumentationView } from "@/lib/archive-investor/associative-documentation-adapter.mjs";
import {
  ASSOCIATIVE_COMMISSION_RATES,
  calculateAssociativeCommercialRemuneration,
} from "@/lib/archive-investor/associative-commercial-remuneration-rules.mjs";
import { calculateAssociativeReleaseStatus } from "@/lib/archive-investor/associative-release-rules.mjs";
import {
  evaluateFinancingModality,
  moneyToCents,
  MCMV_PROPERTY_LIMIT_CENTS,
  type FinancingDecision,
  type FinancingModality,
} from "@/lib/archive-investor/financing-modality-rules.mjs";

type InventoryItem = {
  id: string;
  businessUnit: "Direcional" | "Riva";
  project: string;
  product: string;
  identifier: string | null;
  plant: string | null;
  classification: string | null;
  description: string | null;
  finalPrice: number | null;
  finalWithKit?: number | null;
  unitBonus?: number | null;
  tableSlack?: number | null;
  cashBackSlack?: number | null;
  launchPrice: number | null;
  appraisal: number | null;
  minimumSignal: number | null;
  privateArea: number | null;
  constructionStatus: string | null;
  rooms: number | null;
  unitType: string | null;
  building: string | null;
  floor: number | null;
  finalUnit: number | null;
  parkingSpaces: number | null;
  postalCode: string | null;
  neighborhood: string | null;
  district: string | null;
  street: string | null;
  streetNumber: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  progress: number | null;
  completionDate: string | null;
};

type InventoryPayload = {
  source: string;
  reportId?: string;
  generatedAt?: string;
  count: number;
  items: InventoryItem[];
};

type DirectCalculationPayment = {
  key: string;
  label: string;
  operator: string;
  calculation: string;
  result: string;
  amount?: number;
  meta: string;
  featured?: boolean;
  supportingResult?: string;
  invalid?: boolean;
};

type DirectTableFlowResult = ReturnType<typeof calculateDirectTableFileFlow>;
type DirectProposalOption = (typeof DIRECT_TABLE_PROPOSAL_OPTIONS)[number];

const INVESTOR_TOUR_STEPS = [
  {
    target: "welcome",
    eyebrow: "Visão geral",
    title: "Entenda o caminho completo",
    description:
      "A página segue quatro blocos: estoque, planos prontos, proposta personalizada e resultado. O guia mostra onde agir e o que conferir em cada um.",
    tip: "Avançar no guia não altera valores. Você pode voltar, fechar e reiniciar quando quiser.",
    checklist: [
      "Siga os itens 01 a 04",
      "Use Anterior para revisar",
      "Conclua somente depois da validação",
    ],
  },
  {
    target: "information",
    eyebrow: "Ajuda em cada etapa",
    title: "Consulte os ícones de informação",
    description:
      "Os ícones de informação explicam regras, limites e ações do campo ao lado. Passe o cursor ou use o foco para consultar; clique para manter a explicação aberta.",
    tip: "Clique em qualquer área fora da explicação para fechá-la.",
    checklist: [
      "Procure o ícone ao lado do campo",
      "Leia a orientação antes de preencher",
      "Use a ajuda sempre que tiver dúvida",
    ],
  },
  {
    target: "filters",
    eyebrow: "Encontre o imóvel",
    title: "Defina o perfil desejado",
    description:
      "Combine Incorporadora, Empreendimento, Região, Planta e Valor do Imóvel. Cada escolha atualiza as opções e o total de unidades disponíveis.",
    tip: "Vagas de garagem avulsas não são comercializadas nesta modalidade. Use Limpar filtros para recomeçar.",
    checklist: [
      "Combine quantos filtros precisar",
      "Confira o total encontrado",
      "Ajuste até chegar ao perfil correto",
    ],
  },
  {
    target: "inventory",
    eyebrow: "Escolha uma unidade",
    title: "Escolha a unidade correta",
    description:
      "Revise produto, metragem, entrega, planta e valor. Selecione a unidade pela linha ou pelo botão circular da primeira coluna.",
    tip: "A unidade escolhida define valor, prazo da obra e todas as datas. Sem ela, os próximos passos ficam bloqueados.",
    checklist: [
      "Confirme empreendimento e produto",
      "Confira metragem, planta e entrega",
      "Selecione apenas quando os dados estiverem corretos",
    ],
  },
  {
    target: "sort",
    eyebrow: "Organize a comparação",
    title: "Ordene as unidades por valor",
    description:
      "Escolha Menor para o maior ou Maior para o menor. A ordenação muda somente a sequência da lista e facilita encontrar a faixa de preço desejada.",
    tip: "A unidade selecionada conserva os mesmos dados; somente a posição da lista muda.",
    checklist: [
      "Escolha a direção da ordenação",
      "Compare unidades próximas de preço",
      "Confirme o valor antes de seguir",
    ],
  },
  {
    target: "scenarios",
    eyebrow: "Compare os planos prontos",
    title: "Compare as oito propostas prontas",
    description:
      "Abra os planos de 18 ou 24 parcelas e escolha entre as combinações com ou sem sinais e intermediárias. Cada opção detalha entrada, pagamentos, saldo e primeira mensal.",
    tip: "Abra mais de uma opção para comparar antes de montar a proposta personalizada.",
    checklist: [
      "Escolha o prazo desejado",
      "Compare entrada e pagamentos adicionais",
      "Observe o valor e o início das mensais",
    ],
  },
  {
    target: "proposal",
    eyebrow: "Monte a proposta",
    title: "Monte a proposta personalizada",
    description:
      "A entrada inicia em 10% e continua editável. Se necessário, adicione sinais, intermediárias ou desconto e escolha a quantidade de parcelas permitida.",
    tip: "Acompanhe percentuais, vencimentos, limites e avisos dentro de cada cartão; valores fora da regra são destacados.",
    checklist: [
      "Entrada mínima de 6%",
      "Entrada total mínima de 10%",
      "Sinais e intermediárias devem respeitar os avisos",
    ],
  },
  {
    target: "result",
    eyebrow: "Leia o resultado",
    title: "Confira a composição final",
    description:
      "Confira valor do imóvel, entrada, sinais válidos, intermediárias válidas, saldo, quantidade de parcelas, valor mensal e datas inicial e final.",
    tip: "O selo informa se a proposta está aprovada ou se ainda precisa de ajuste.",
    checklist: [
      "Reconcilie cada pagamento",
      "Confira saldo e parcela mensal",
      "Valide primeira e última mensal",
    ],
  },
  {
    target: "documents",
    eyebrow: "Documentação do cliente",
    title: "Consulte os documentos necessários",
    description:
      "Use Doc Pessoa Física ou Doc Pessoa Jurídica para abrir a relação adequada ao tipo de cliente antes de formalizar a proposta.",
    tip: "A lista documental não substitui a conferência do gerente ou da área responsável.",
    checklist: [
      "Identifique o tipo de cliente",
      "Abra a lista correspondente",
      "Confirme todos os documentos antes de imprimir",
    ],
  },
  {
    target: "audit",
    eyebrow: "Valide a proposta",
    title: "Faça a última conferência",
    description:
      "Abra a auditoria, leia cada condição e corrija todos os itens reprovados. Só apresente ou imprima depois de confirmar regras, valores, datas e documentação.",
    tip: "Imprima somente depois de confirmar unidade, valores, datas, documentação e o selo de proposta dentro da regra.",
    checklist: [
      "Nenhuma condição pode ficar reprovada",
      "Confira a documentação do cliente",
      "Imprima somente a versão validada",
    ],
  },
] as const;

const ASSOCIATIVE_TOUR_ORDER = [
  "welcome",
  "information",
  "filters",
  "inventory",
  "sort",
  "qualification",
  "proposal",
  "result",
  "documents",
] as const;

const ASSOCIATIVE_TOUR_STEPS = [
  ...INVESTOR_TOUR_STEPS.filter((step) => step.target !== "audit" && step.target !== "scenarios"),
  {
    target: "qualification",
    eyebrow: "Perfil do financiamento",
    title: "Responda as 3 perguntas na ordem",
    description:
      "Primeiro digite a renda familiar. Depois confira MCMV ou SBPE. Por último, responda se é o primeiro imóvel. Cada resposta libera a próxima.",
    tip: "Leia a frase branca na parte inferior de cada cartão. Ela mostra o resultado ou diz exatamente o que falta.",
    checklist: ["Digite a renda mensal total", "Confira a modalidade", "Responda Sim ou Não"],
  },
]
  .map((step) => {
    if (step.target === "proposal")
      return {
        ...step,
        eyebrow: "Monte a proposta",
        title: "Preencha os recursos e pagamentos",
        description:
          "Confira B.A. e folga e informe primeiro o Financiamento. Depois ajuste Subsídio, FGTS, Cheque Moradia, Entrada, Sinais, Anuais e quantidade de parcelas.",
        tip: "O financiamento libera os cálculos; saldo e parcela corrigida são atualizados a cada valor informado.",
        checklist: [
          "Confira as deduções da unidade",
          "Informe recursos e entrada",
          "Revise sinais, anuais e parcelas",
        ],
      };
    if (step.target === "result")
      return {
        ...step,
        eyebrow: "Leia o resultado",
        title: "Confira a composição final",
        description:
          "Confira valor real da venda, recursos, entrada, sinais, anuais corrigidas, saldo parcelado e parcela corrigida.",
        tip: "Corrija qualquer item reprovado antes de apresentar a proposta.",
        checklist: [
          "Reconcilie recursos e pagamentos",
          "Confira o saldo parcelado",
          "Valide a parcela corrigida",
        ],
      };
    if (step.target === "documents")
      return {
        ...step,
        eyebrow: "Documentação associativa",
        title: "Consulte os documentos da Pessoa Física",
        description:
          "Abra Doc Pessoa Física para conferir identificação, estado civil, comprovantes de renda e documentos dos dependentes antes de formalizar a proposta associativa.",
        tip: "A modalidade associativa não aceita Pessoa Jurídica; a análise de crédito é realizada pela CAIXA.",
        checklist: [
          "Abra Doc Pessoa Física",
          "Confira renda e dependentes",
          "Imprima somente a versão validada",
        ],
      };
    return step;
  })
  .sort((first, second) => {
    return (
      ASSOCIATIVE_TOUR_ORDER.indexOf(first.target) - ASSOCIATIVE_TOUR_ORDER.indexOf(second.target)
    );
  });

const DIRECT_TABLE_TOUR_STEPS = [
  {
    target: "welcome",
    eyebrow: "Vamos começar",
    title: "Monte a proposta como um quebra-cabeça",
    description:
      "Primeiro você escolhe o imóvel. Depois informa a renda, escolhe um modelo pronto, confere os pagamentos e valida o resultado. O simulador faz as contas; você confirma se os dados estão corretos.",
    tip: "O guia apenas explica e aponta os lugares da tela. Ele não muda nenhum valor sozinho.",
    checklist: ["Escolha o imóvel", "Monte os pagamentos", "Confira antes de imprimir"],
  },
  {
    target: "information",
    eyebrow: "Ajuda sempre disponível",
    title: "Este símbolo explica a tela",
    description:
      "Quando encontrar este ícone ao lado de um valor ou título, passe o mouse, use o teclado ou clique para abrir uma explicação curta. Feche a ajuda e continue: nenhum valor da proposta será alterado.",
    tip: "",
    checklist: [],
  },
  {
    target: "filters",
    eyebrow: "Passo 1 · procurar",
    title: "Filtre o estoque até encontrar o imóvel",
    description:
      "Escolha incorporadora, empreendimento, região, planta e faixa de valor. Cada filtro diminui a lista para mostrar somente as unidades que combinam com o que o cliente procura.",
    tip: "Se a busca ficar confusa, use Limpar filtros e comece novamente.",
    checklist: ["Escolha os filtros", "Veja quantas unidades restaram", "Compare as opções"],
  },
  {
    target: "inventory",
    eyebrow: "Passo 2 · escolher",
    title: "Confira a unidade e selecione a linha correta",
    description:
      "Leia produto, metragem, data de entrega, planta e valor. Esses dados alimentam todas as contas, por isso o guia só deixa avançar depois que uma unidade for escolhida.",
    tip: "Se qualquer informação estiver errada, não avance: escolha outra unidade.",
    checklist: ["Confirme o produto", "Confira entrega e planta", "Selecione a unidade"],
  },
  {
    target: "sort",
    eyebrow: "Organize a lista",
    title: "Coloque os preços na ordem mais útil",
    description:
      "Escolha do menor para o maior ou do maior para o menor. Isso apenas muda a ordem visual da lista; não altera o imóvel nem o cálculo.",
    tip: "Use a ordenação para comparar rapidamente unidades próximas de preço.",
    checklist: ["Escolha a ordem", "Compare os valores", "Mantenha a unidade correta"],
  },
  {
    target: "property-summary",
    eyebrow: "Passo 3 · conhecer o imóvel",
    title: "Leia a ficha do imóvel antes de calcular",
    description:
      "Confira o empreendimento e a descrição da unidade, a incorporadora, a planta, a metragem, o andar, o andamento da obra, a data de entrega e o valor. A planta também define a política: quando contém “Vaga”, a obra recebe 40% e o pós-chaves 50% em até 66 parcelas; nas demais, são 30% e 60% em 120 parcelas.",
    tip: "Data de entrega e planta mudam datas, intermediárias e quantidade de parcelas. Se algo estiver errado, volte ao estoque.",
    checklist: [
      "Descrição e incorporadora",
      "Planta, metragem e andar",
      "Andamento, entrega e valor",
    ],
  },
  {
    target: "income",
    eyebrow: "Passo 4 · informar a renda",
    title: "Digite a renda mensal real do cliente",
    description:
      "A renda precisa ser maior que zero. Enquanto ela não for informada, a primeira opção e todo o fluxo editável ficam visíveis, mas congelados. Depois do preenchimento, o sistema libera os controles e compara a parcela pós-chaves com a renda.",
    tip: "O limite de comprometimento é 40%. A simulação orienta o atendimento, mas não substitui a análise de crédito interna.",
    checklist: [
      "Use a renda mensal real",
      "Digite um valor maior que zero",
      "Aguarde a liberação automática",
    ],
  },
  {
    target: "ready-options",
    eyebrow: "Passo 5 · escolher um modelo",
    title: "Entenda os 4 botões antes de escolher",
    description:
      "01 Pagamento simples: ato de 10%, sem sinais e sem intermediárias. 02 Entrada distribuída: ato de 6% e 3 sinais que completam 4%, sem intermediária. 03 Parcela reduzida: ato de 10%, sem sinais, com intermediárias de até 5% conforme a entrega. 04 Maior flexibilidade: ato de 6%, 3 sinais que completam 4% e intermediárias válidas.",
    tip: "Sem renda, somente a opção 01 aparece selecionada como referência e nenhum botão altera a proposta. Com renda, escolha um modelo e depois ajuste o fluxo editável.",
    checklist: ["Compare ato e sinais", "Confira se haverá intermediárias", "Escolha 1 modelo"],
  },
  {
    target: "proposal",
    eyebrow: "Passo 6 · fluxo editável",
    title: "Este é o Fluxo editável",
    description:
      "Este campo mostra como a proposta foi montada, com cada etapa, cálculo e resultado; ele fica bloqueado até a renda ser informada.",
    tip: "",
    checklist: [],
  },
  {
    target: "proposal-discount",
    eyebrow: "Passo 7 · valor e desconto",
    title: "Comece pelo valor real da proposta",
    description:
      "O valor do imóvel vem da unidade escolhida. O desconto é opcional e só deve ser aplicado quando estiver autorizado. Ele reduz a base usada em todas as contas seguintes.",
    tip: "O desconto não pode ser negativo nem igual ou maior que o valor do imóvel.",
    checklist: [
      "Confirme o valor",
      "Verifique a autorização",
      "Deixe zero quando não houver desconto",
    ],
  },
  {
    target: "proposal-entry",
    eyebrow: "Passo 8 · entrada",
    title: "Monte pelo menos 10% de entrada",
    description:
      "O ato é pago na data da simulação. Sem sinais, use pelo menos 10% no ato. Com sinais, o ato pode começar em 6% e o restante deve levar a entrada total a 10% ou mais.",
    tip: "A entrada total precisa atingir pelo menos 10% antes das intermediárias.",
    checklist: [
      "Ato de 10% ou mais sem sinais",
      "Ou ato mínimo de 6%",
      "Complete pelo menos 10% com sinais",
    ],
  },
  {
    target: "proposal-signals",
    eyebrow: "Passo 9 · sinais",
    title: "Adicione até 3 sinais, sempre em ordem",
    description:
      "O Sinal 2 só existe depois do Sinal 1, e o Sinal 3 só existe depois do Sinal 2. Cada sinal não pode ser maior que o pagamento anterior. As datas usam os dias comerciais 05, 10 ou 15, sempre depois do pagamento anterior.",
    tip: "Ocultar um sinal zera essa linha e também os sinais seguintes, preservando a sequência.",
    checklist: ["Não pule sinais", "Respeite os valores decrescentes", "Confira as datas"],
  },
  {
    target: "proposal-intermediaries",
    eyebrow: "Passo 10 · intermediárias",
    title: "Use somente as intermediárias liberadas pela entrega",
    description:
      "Cada intermediária é opcional e pode chegar a 5% do valor real. Ela precisa coincidir com uma mensal pré-chaves, ocorrer a partir da primeira mensal e no máximo até 3 meses-calendário antes da entrega. A quantidade disponível muda conforme o prazo da obra e o saldo do bloco pré-chaves.",
    tip: "Na regra geral, o bloco comporta até 30%; para planta com “Vaga”, até 40%. Ocultar uma intermediária afeta somente aquela linha.",
    checklist: [
      "Máximo de 5% por linha",
      "Data até entrega menos 3 meses",
      "Não ultrapasse o saldo pré-chaves",
    ],
  },
  {
    target: "proposal-prekeys",
    eyebrow: "Passo 11 · durante a obra",
    title: "Confira o saldo e as mensais pré-chaves",
    description:
      "O simulador reserva 30% do imóvel para a obra, ou 40% quando a planta contém “Vaga”. Intermediárias válidas são descontadas desse bloco, e o saldo restante é dividido pelas mensais disponíveis até a entrega.",
    tip: "As mensais pré-chaves não têm juros, MIP ou DFI e incluem o mês da entrega.",
    checklist: [
      "Confirme o percentual da obra",
      "Desconte intermediárias válidas",
      "Confira quantidade, valor e 1ª parcela",
    ],
  },
  {
    target: "proposal-postkeys",
    eyebrow: "Passo 12 · depois das chaves",
    title: "Confira o saldo e a parcela pós-chaves",
    description:
      "Na regra geral, 60% ficam para 120 parcelas. Quando a planta contém “Vaga”, 50% ficam para até 66 parcelas. A parcela usa PRICE, juros de 12% ao ano, seguro MIP e seguro DFI.",
    tip: "Abra o ícone de informação ao lado da parcela para consultar a memória de cálculo e as datas.",
    checklist: [
      "Confirme o saldo financiado",
      "Confira 120 ou 66 parcelas",
      "Leia valor e 1ª data",
    ],
  },
  {
    target: "credit-status",
    eyebrow: "Passo 13 · resultado",
    title: "Entenda APROVADO, REPROVADO ou PENDENTE",
    description:
      "O sistema divide a parcela pós-chaves pela renda. Até e incluindo 40% mostra APROVADO; acima de 40% mostra REPROVADO. Sem renda, mostra PENDENTE e mantém a proposta congelada.",
    tip: "O resultado do simulador não substitui a análise de crédito interna obrigatória.",
    checklist: ["Confira a parcela", "Leia o percentual da renda", "Veja o resultado"],
  },
  {
    target: "resources",
    eyebrow: "Passo 14 · consultar e imprimir",
    title: "Saiba para que serve cada botão final",
    description:
      "Aprenda + abre políticas, regras e perguntas frequentes. Doc Pessoa Física mostra documentos e comprovantes do cliente. Doc Pessoa Jurídica mostra documentos da empresa e dos sócios. Imprimir prepara a versão limpa para conferência ou entrega.",
    tip: "Imprima por último, depois de confirmar regras, documentos e auditoria.",
    checklist: [
      "Consulte Aprenda +",
      "Abra a documentação correta",
      "Imprima somente a versão validada",
    ],
  },
  {
    target: "audit",
    eyebrow: "Passo 15 · validar",
    title: "Abra a auditoria e procure qualquer reprovação",
    description:
      "A auditoria é a conferência final da conta. Abra a lista, leia cada regra e volte ao campo indicado quando aparecer um item reprovado.",
    tip: "Só apresente a proposta quando unidade, renda, entrada, datas, distribuição e documentação estiverem conferidas.",
    checklist: ["Abra a auditoria", "Corrija as reprovações", "Confira novamente"],
  },
] as const;

const DIRECT_TABLE_PROPOSAL_GUIDE_STEPS = [
  {
    title: "Confirme o imóvel",
    description:
      "Veja se empreendimento, unidade, planta, valor e data de entrega são os mesmos escolhidos pelo cliente.",
    note: "Se algo estiver errado, volte ao item 01 e escolha a linha correta. Essas informações são a base de toda a conta.",
  },
  {
    title: "Informe a renda real",
    description:
      "No item 02, escreva a renda mensal que será usada na análise. Esse preenchimento libera as quatro opções prontas.",
    note: "Não estime a renda. O sistema divide a parcela pós-chaves pela renda informada para medir o comprometimento.",
  },
  {
    title: "Escolha um modelo para começar",
    description:
      "No item 03, escolha uma das quatro opções: com ou sem sinais e com ou sem intermediárias. Sem renda, a primeira opção permanece visível como exemplo, mas todos os botões ficam congelados.",
    note: "Depois de informar uma renda válida, os quatro botões são liberados. A opção escolhida apenas prepara a proposta; você ainda pode revisar e ajustar cada valor no fluxo editável.",
  },
  {
    title: "Entenda a divisão do pagamento",
    description:
      "Na regra geral, a proposta separa 10% para entrada, 30% durante a obra e 60% depois das chaves em 120 parcelas.",
    note: "Quando o nome da planta contém “Vaga”, a divisão muda para 10% de entrada, 40% durante a obra e 50% depois das chaves em até 66 parcelas.",
  },
  {
    title: "Aplique desconto somente quando autorizado",
    description: "O desconto é opcional e reduz o valor real usado em todas as contas seguintes.",
    note: "Sem autorização, deixe o desconto desligado. O valor não pode ser negativo nem igual ou maior que o valor do imóvel.",
  },
  {
    title: "Monte a entrada em ordem",
    description:
      "A entrada total precisa chegar a pelo menos 10%. O ato de hoje pode ser de 6% ou mais; se ficar abaixo de 10%, complete com até 3 sinais.",
    note: "Não pule a sequência: Sinal 2 precisa do Sinal 1, e Sinal 3 precisa do Sinal 2. Cada sinal não pode ser maior que o pagamento anterior.",
  },
  {
    title: "Confira as datas dos sinais",
    description:
      "O simulador procura uma data comercial nos dias 05, 10 ou 15, sempre depois do pagamento anterior e dentro da janela de 31 dias.",
    note: "Ao ocultar um sinal, os sinais seguintes também são ocultados e zerados para manter a ordem correta.",
  },
  {
    title: "Use intermediárias somente quando fizer sentido",
    description:
      "Cada intermediária é opcional e pode chegar a 5% do valor real. A quantidade liberada depende do tempo que falta até a entrega.",
    note: "Ela precisa coincidir com uma mensal pré-chaves e ocorrer no máximo até 3 meses-calendário antes da entrega. Ocultar uma linha zera somente aquela intermediária.",
  },
  {
    title: "Leia as mensais pré-chaves",
    description:
      "Depois da entrada, o saldo da fase de obra é dividido pelos meses disponíveis até a entrega: 30% na regra geral ou 40% quando a planta contém “Vaga”.",
    note: "Intermediárias válidas diminuem esse saldo. As mensais pré-chaves não têm juros, MIP ou DFI.",
  },
  {
    title: "Leia as parcelas pós-chaves",
    description:
      "Depois da última mensal da obra começa o pós-chaves: 60% em 120 parcelas na regra geral ou 50% em até 66 parcelas para planta com “Vaga”.",
    note: "A parcela usa sistema PRICE, juros de 12% ao ano, MIP e DFI. Use o ícone de informação ao lado do valor para abrir a memória de cálculo.",
  },
  {
    title: "Entenda o resultado da proposta",
    description:
      "O sistema compara a parcela pós-chaves com a renda. Até e incluindo 40% mostra APROVADO; acima de 40% mostra REPROVADO.",
    note: "Esse resultado não substitui a análise de crédito interna obrigatória. Se reprovar, ajuste a proposta ou revise os dados corretos.",
  },
  {
    title: "Faça a conferência final",
    description:
      "Abra a Auditoria do cálculo e corrija qualquer item reprovado. Depois consulte Aprenda + e a documentação de Pessoa Física ou Jurídica.",
    note: "Imprima somente depois de conferir imóvel, renda, pagamentos, datas, resultado, documentos e auditoria.",
  },
] as const;

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const currencyInput = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const STANDARD_SCENARIO_OPTIONS = {
  C1: { plan: 18, title: "Proposta sem sinais e sem intermediárias", description: null },
  C2: {
    plan: 18,
    title: "Proposta com sinais e sem intermediárias",
    description: "Entrada de 6% complementada por 3 sinais, chegando aos 10%.",
  },
  C3: {
    plan: 18,
    title: "Proposta com sinais e com intermediárias",
    description: "Entrada de 6% complementada por 3 sinais e até 3 intermediárias.",
  },
  C4: {
    plan: 18,
    title: "Proposta sem sinais e com intermediárias",
    description: "Entrada integral de 10% e até 3 intermediárias.",
  },
  C5: { plan: 24, title: "Proposta sem sinais e sem intermediárias", description: null },
  C6: {
    plan: 24,
    title: "Proposta com sinais e sem intermediárias",
    description: "Entrada de 17% complementada por 3 sinais de 1%, chegando aos 20%.",
  },
  C7: {
    plan: 24,
    title: "Proposta com sinais e com intermediárias",
    description: "Entrada de 17%, 3 sinais de 1% e até 4 intermediárias.",
  },
  C8: {
    plan: 24,
    title: "Proposta sem sinais e com intermediárias",
    description: "Entrada integral de 20% e até 4 intermediárias.",
  },
} as const;

const ASSOCIATIVE_SCENARIO_OPTIONS = {
  C1: {
    plan: 84,
    title: "Proposta sem sinais e sem anuais",
    description: "Entrada ajustada à classificação, sem regra percentual fixa.",
  },
  C2: {
    plan: 84,
    title: "Proposta com sinais e sem anuais",
    description: "Entrada e 3 sinais iguais, respeitando o mínimo de R$ 150,00.",
  },
  C3: {
    plan: 84,
    title: "Proposta sem sinais e com anuais",
    description: "Anuais até 50% da renda e entrada ajustada ao saldo.",
  },
  C4: {
    plan: 84,
    title: "Proposta com sinais e com anuais",
    description: "Anuais até 50% da renda; entrada e 3 sinais iguais.",
  },
} as const;

const STANDARD_SCENARIO_PLANS = [18, 24] as const;

function currencyInputNumber(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const clean = value.trim().replace(/[^\d,.-]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  return digits ? (Number(digits) / 100).toFixed(2) : "";
}

function inputName(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function MoneyInput({
  id,
  value,
  onChange,
  label,
  describedBy,
  invalid = false,
  disabled = false,
  max,
  inputRef,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  max?: number;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      id={id}
      ref={inputRef}
      name={inputName(label)}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      type="text"
      value={value ? currencyInput.format(currencyInputNumber(value)) : ""}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(parseCurrencyInput(event.target.value))}
      placeholder="0,00"
      data-max={max}
    />
  );
}

function AssociativeMoneyControl({
  label,
  value,
  onChange,
  describedBy,
  invalid = false,
  disabled = false,
  max,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  max?: number;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="investor-direct-editable-value investor-associative-line-control">
      <span aria-hidden="true">R$</span>
      <MoneyInput
        inputRef={inputRef}
        label={label}
        describedBy={describedBy}
        invalid={invalid}
        disabled={disabled}
        max={max}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function AssociativeStepGuide({
  title,
  description,
  tone = "guidance",
}: {
  title: string;
  description: string;
  tone?: "guidance" | "rejected";
}) {
  return (
    <aside
      className={`investor-associative-step-guide ${tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>Próxima ação</span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </aside>
  );
}

function AssociativeMoneyValue({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="investor-direct-editable-value investor-associative-line-control investor-associative-readonly-value"
      aria-label={`${label}: ${money.format(value)}`}
    >
      <span aria-hidden="true">R$</span>
      <strong>{currencyInput.format(Math.max(0, value))}</strong>
    </div>
  );
}

function DirectReadyLedgerValue({
  label,
  amount,
  text,
  help,
  action,
}: {
  label: string;
  amount?: number;
  text: string;
  help: string;
  action?: ReactNode;
}) {
  return (
    <div className="investor-associative-value-help investor-direct-ready-value-help">
      <div
        className={`investor-direct-editable-value investor-associative-line-control investor-associative-readonly-value${amount == null ? "is-text" : ""}`}
        aria-label={`${label}: ${amount == null ? text : money.format(amount)}`}
      >
        {amount == null ? (
          <strong>{text}</strong>
        ) : (
          <>
            <span aria-hidden="true">R$</span>
            <strong>{currencyInput.format(Math.max(0, amount))}</strong>
          </>
        )}
      </div>
      {action ?? <InvestorInfoHint label={label} title={`Entenda ${label}`} description={help} />}
    </div>
  );
}

function associativeHelp(...lines: Array<string | null | undefined | false>) {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

type DirectEditableAccountRowProps = {
  number?: number;
  operator?: string;
  label: string;
  date?: string;
  dateLabel?: string;
  meta?: ReactNode;
  help?: { title: string; description: string };
  calculation?: ReactNode;
  result?: ReactNode;
  cornerAction?: ReactNode;
  total?: boolean;
  invalid?: boolean;
  action?: boolean;
  tourTarget?: string;
  twoColumn?: boolean;
  fieldState?: "editable" | "locked";
  rowClassName?: string;
  leadingAction?: ReactNode;
  sideGuidance?: ReactNode;
  disabled?: boolean;
};

function DirectEditableAccountRow({
  number,
  operator,
  label,
  date,
  dateLabel,
  meta,
  help,
  calculation,
  result,
  cornerAction,
  total = false,
  invalid = false,
  action = false,
  tourTarget,
  twoColumn = false,
  fieldState,
  rowClassName = "",
  leadingAction,
  sideGuidance,
  disabled = false,
}: DirectEditableAccountRowProps) {
  const operatorLabel =
    operator === "−"
      ? "subtrair"
      : operator === "÷"
        ? "dividir"
        : operator === "="
          ? "igual"
          : operator === "!"
            ? "atenção"
            : operator === "…"
              ? "pendente"
              : "";
  return (
    <li
      className={`${total ? "total" : ""}${invalid ? "invalid" : ""}${fieldState ? ` field-${fieldState}` : ""}${disabled ? "is-stage-locked" : ""}${sideGuidance ? "has-side-guidance" : ""}${rowClassName ? ` ${rowClassName}` : ""}`}
      value={number}
      role={number ? undefined : "presentation"}
      data-tour={tourTarget}
      aria-disabled={disabled || undefined}
    >
      <span className="investor-direct-step-number" aria-hidden="true">
        {number ? String(number).padStart(2, "0") : ""}
      </span>
      <div className="investor-direct-step-content">
        <div
          className={`investor-direct-step-name${twoColumn ? "investor-associative-label-only" : ""}${leadingAction ? "has-leading-action" : ""}${date ? "has-date" : ""}`}
        >
          {leadingAction ?? (twoColumn ? null : <span aria-hidden="true">{operator ?? ""}</span>)}
          <div className={`investor-direct-step-label${date ? "has-date" : ""}`}>
            {help ? (
              <span className="investor-associative-row-title">
                <strong>{label}</strong>
                <InvestorInfoHint label={label} title={help.title} description={help.description} />
              </span>
            ) : (
              <strong>{label}</strong>
            )}
            {date ? (
              <time
                className={`investor-associative-row-date${dateLabel ? "has-label" : ""}`}
                dateTime={date}
              >
                {dateLabel ? `${dateLabel} ${formatDate(date)}` : formatDate(date)}
              </time>
            ) : null}
            {meta ? <small>{meta}</small> : null}
          </div>
        </div>
        {twoColumn ? (
          <div className="investor-direct-step-formula investor-direct-step-composition">
            <div className="investor-direct-step-calculation investor-associative-calculation-line">
              <span className="investor-associative-ledger-operator" aria-hidden="true">
                {operator ?? ""}
              </span>
              {operatorLabel ? <span className="sr-only">{operatorLabel}</span> : null}
              <div>{calculation}</div>
            </div>
            {result != null ? (
              <div className={`investor-direct-step-outcome${action ? "has-action" : ""}`}>
                {result}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="investor-direct-step-formula">{calculation}</div>
            {result != null ? (
              <div className={`investor-direct-step-result${action ? "has-action" : ""}`}>
                {result}
              </div>
            ) : null}
          </>
        )}
      </div>
      {cornerAction ? (
        <div className="investor-associative-corner-action">{cornerAction}</div>
      ) : null}
      {sideGuidance ? sideGuidance : null}
    </li>
  );
}

function DirectComparisonLedgerRow({
  label,
  detail,
  operator,
  value,
  emphasized = false,
  muted = false,
}: {
  label: string;
  detail: string;
  operator: "=" | "−" | "÷";
  value: number;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`investor-direct-comparison-ledger-row${emphasized ? "is-emphasized" : ""}${muted ? "is-muted" : ""}`}
      role="row"
    >
      <div className="investor-direct-comparison-ledger-label" role="rowheader">
        <strong>{label}</strong>
      </div>
      <span
        className="investor-direct-comparison-ledger-operator"
        role="cell"
        aria-label={operator === "=" ? "igual" : operator === "−" ? "subtrair" : "dividir"}
      >
        {operator}
      </span>
      <span className="investor-direct-comparison-ledger-currency" role="cell" aria-hidden="true">
        R$
      </span>
      <strong className="investor-direct-comparison-ledger-value" role="cell">
        {money.format(value).replace(/^R\$\s?/u, "")}
      </strong>
      <div className="investor-direct-comparison-ledger-help" role="cell">
        <InvestorInfoHint label={label} title={label} description={detail} />
      </div>
    </div>
  );
}

function DirectProposalComparisonCard({
  option,
  flow,
  optionNumber,
  active,
  baseDate,
  policySummary,
}: {
  option: DirectProposalOption;
  flow: DirectTableFlowResult;
  optionNumber: number;
  active: boolean;
  baseDate: string;
  policySummary: string;
}) {
  const titleId = useId();
  const creditState =
    flow.custom.income <= 0 ? "pending" : flow.custom.creditApproved ? "approved" : "rejected";
  const creditLabel =
    flow.custom.income <= 0 ? "PENDENTE" : flow.custom.creditApproved ? "APROVADO" : "REPROVADO";
  const approvedSignals = flow.custom.signals.filter(
    (signal: { active: boolean; approved: boolean }) => signal.active && signal.approved,
  );
  const approvedIntermediaries = flow.custom.intermediaries.filter(
    (item: { value: number; approved: boolean }) => item.value > 0 && item.approved,
  );
  const signalDates = approvedSignals.map((signal: { date: string }) => formatDate(signal.date));
  const intermediaryDates = approvedIntermediaries.map((item: { date: string }) =>
    formatDate(item.date),
  );
  const signalPeriod =
    signalDates.length === 1
      ? signalDates[0]
      : `${signalDates[0]} a ${signalDates[signalDates.length - 1]}`;
  const intermediaryPeriod =
    intermediaryDates.length === 1
      ? intermediaryDates[0]
      : `${intermediaryDates[0]} a ${intermediaryDates[intermediaryDates.length - 1]}`;
  const signalDetail =
    approvedSignals.length > 0
      ? `${approvedSignals.length} pagamentos · ${signalPeriod}`
      : "Sem sinais nesta opção";
  const intermediaryDetail =
    approvedIntermediaries.length > 0
      ? `${approvedIntermediaries.length} pagamentos · ${intermediaryPeriod}`
      : option.withIntermediary
        ? "Nenhuma data válida até 3 meses antes da entrega"
        : "Sem intermediárias nesta opção";
  const intermediarySummary =
    approvedIntermediaries.length > 0
      ? `${approvedIntermediaries.length} ${approvedIntermediaries.length === 1 ? "intermediária" : "intermediárias"} de 5%`
      : option.withIntermediary
        ? "Intermediárias indisponíveis nesta entrega"
        : "Sem intermediária";
  const preKeysAvailable = flow.custom.balance > 0 && flow.custom.desiredInstallments > 0;
  const preKeysDetail =
    approvedIntermediaries.length > 0
      ? `${percent.format(flow.context.preKeysRate)} do imóvel menos ${approvedIntermediaries.length} ${approvedIntermediaries.length === 1 ? "intermediária" : "intermediárias"}`
      : `${percent.format(flow.context.preKeysRate)} do valor do imóvel`;

  return (
    <article
      className={`investor-direct-comparison-card${active ? "is-active" : ""}`}
      aria-labelledby={titleId}
      data-selected={active || undefined}
    >
      <header className="investor-direct-comparison-heading">
        <div>
          <div className="investor-direct-comparison-option-line">
            <span>Opção {String(optionNumber).padStart(2, "0")}</span>
          </div>
          <h4 id={titleId}>{option.title}</h4>
          <p>
            {[option.entrySummary, option.signalSummary, intermediarySummary, policySummary]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className={`investor-direct-credit-status ${creditState}`}>
          <small>Resultado</small>
          <strong>{creditLabel}</strong>
          <span>
            {flow.custom.income > 0
              ? `${percent.format(flow.custom.commitment)} da renda`
              : "Informe a renda"}
          </span>
        </div>
      </header>
      <div
        className="investor-direct-comparison-ledger"
        role="table"
        aria-label={`Livro-caixa da opção ${String(optionNumber).padStart(2, "0")}`}
      >
        <DirectComparisonLedgerRow
          label="Valor real da venda"
          detail="Base usada nesta proposta"
          operator="="
          value={flow.context.valueReal}
        />
        <DirectComparisonLedgerRow
          label="Ato"
          detail={`Pagamento em ${formatDate(baseDate)}`}
          operator="−"
          value={flow.custom.actValue}
        />
        <DirectComparisonLedgerRow
          label="Sinais"
          detail={signalDetail}
          operator="−"
          value={flow.custom.signalTotal}
          muted={approvedSignals.length === 0}
        />
        <DirectComparisonLedgerRow
          label="Intermediárias"
          detail={intermediaryDetail}
          operator="−"
          value={flow.custom.validIntermediaryTotal}
          muted={approvedIntermediaries.length === 0}
        />
        <DirectComparisonLedgerRow
          label="Saldo parcelado pré-chaves"
          detail={preKeysDetail}
          operator="="
          value={flow.custom.balance}
        />
        <DirectComparisonLedgerRow
          label={
            preKeysAvailable
              ? `${flow.custom.desiredInstallments} mensais pré-chaves`
              : "Mensais pré-chaves"
          }
          detail={
            preKeysAvailable
              ? `1ª em ${formatDate(flow.custom.firstPreKeysDate)}`
              : "Saldo coberto pelas intermediárias"
          }
          operator="÷"
          value={preKeysAvailable ? flow.custom.installmentValue : 0}
          muted={!preKeysAvailable}
        />
        <DirectComparisonLedgerRow
          label="Saldo financiado"
          detail={`${percent.format(flow.context.postKeysRate)} do valor do imóvel`}
          operator="="
          value={flow.custom.postKeysBalance}
        />
        <DirectComparisonLedgerRow
          label={`${flow.custom.postKeysInstallments} parcelas mensais pós-chaves`}
          detail={`1ª em ${formatDate(flow.custom.firstPostKeysDate)}`}
          operator="÷"
          value={flow.custom.postKeysPayment}
          emphasized
        />
      </div>
      <footer className="investor-direct-comparison-footer">
        <span>
          Entrada total <strong>{money.format(flow.custom.totalEntryValue)}</strong>
        </span>
        <span>
          Percentual <strong>{percent.format(flow.custom.totalEntryRate)}</strong>
        </span>
      </footer>
    </article>
  );
}

function AssociativeEditableAccountRow({
  label,
  meta,
  calculation,
  ...props
}: Omit<DirectEditableAccountRowProps, "twoColumn">) {
  const helpDescription = typeof meta === "string" ? meta : undefined;
  return (
    <DirectEditableAccountRow
      {...props}
      label={label}
      calculation={
        <div className="investor-associative-value-help">
          <div className="investor-associative-value-only">{calculation}</div>
          {helpDescription ? (
            <InvestorInfoHint
              label={label}
              title={`Entenda ${label}`}
              description={helpDescription}
            />
          ) : null}
        </div>
      }
      twoColumn
    />
  );
}

type AssociativeDecreasingBlockView = {
  label: string;
  count: number;
  uncorrectedInstallment: number;
  correctedInstallment: number;
  firstInstallmentDate: string;
  lastInstallmentDate: string;
};

function AssociativePaymentSummary({
  available,
  installments,
  linearUncorrected,
  linearCorrected,
  linearFirstDate,
  linearLastDate,
  blocks,
  onShowInstallments,
}: {
  available: boolean;
  installments: number;
  linearUncorrected: number;
  linearCorrected: number;
  linearFirstDate: string;
  linearLastDate: string;
  blocks: AssociativeDecreasingBlockView[];
  onShowInstallments: () => void;
}) {
  const rows = [
    {
      key: "linear",
      label: "Linear 100%",
      count: installments,
      uncorrected: linearUncorrected,
      corrected: linearCorrected,
      firstDate: linearFirstDate,
      lastDate: linearLastDate,
      featured: true,
    },
    ...blocks.map((block) => ({
      key: `decreasing-${block.label}`,
      label: `Decrescente ${block.label}`,
      count: block.count,
      uncorrected: block.uncorrectedInstallment,
      corrected: block.correctedInstallment,
      firstDate: block.firstInstallmentDate,
      lastDate: block.lastInstallmentDate,
      featured: false,
    })),
  ];

  return (
    <section
      className={`investor-associative-payment-summary${available ? "is-ready" : "is-locked"}`}
      aria-labelledby="investor-associative-payment-summary-title"
    >
      <header>
        <div>
          <div>
            <strong id="investor-associative-payment-summary-title">Resumo das parcelas</strong>
            <small>Fluxo linear e quatro blocos decrescentes</small>
          </div>
        </div>
        <div className="investor-associative-payment-summary-actions">
          <button
            type="button"
            disabled={!available}
            aria-haspopup="dialog"
            aria-controls="investor-associative-installments"
            onClick={onShowInstallments}
          >
            Exibir parcelas
          </button>
          <InvestorInfoHint
            label="Resumo das parcelas"
            title="Como este resumo é calculado"
            description={associativeHelp(
              `Linear sem correção: saldo parcelado ÷ ${installments || 0}.`,
              "Linear com correção: usa 0,5% ao mês antes da entrega e 1,5% ao mês depois da entrega.",
              "Decrescente: separa o saldo em 4 blocos de 40%, 30%, 20% e 10%. As parcelas ficam menores a cada bloco.",
              "As datas seguem o mesmo calendário mensal da proposta.",
            )}
          />
        </div>
      </header>
      <div
        className="investor-associative-payment-table"
        role="table"
        aria-label="Comparativo das parcelas lineares e decrescentes"
      >
        <div className="investor-associative-payment-table-head" role="row">
          <span role="columnheader">Resumo</span>
          <span role="columnheader">Qtd.</span>
          <span role="columnheader">Sem correção</span>
          <span role="columnheader">Com correção</span>
          <span role="columnheader">1ª mensal</span>
          <span role="columnheader">Última mensal</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.key}
            className={`investor-associative-payment-table-row ${row.featured ? "is-linear" : "is-decreasing"}`}
            role="row"
          >
            <strong role="rowheader">{row.label}</strong>
            <span role="cell" data-label="Quantidade" aria-label={`${row.count} parcelas`}>
              {available ? row.count : "—"}
            </span>
            <span
              role="cell"
              data-label="Sem correção"
              aria-label={`Sem correção: ${available ? money.format(row.uncorrected) : "indisponível"}`}
            >
              {available ? money.format(row.uncorrected) : "—"}
            </span>
            <span
              role="cell"
              data-label="Com correção"
              aria-label={`Com correção: ${available ? money.format(row.corrected) : "indisponível"}`}
            >
              {available ? money.format(row.corrected) : "—"}
            </span>
            <time
              role="cell"
              data-label="1ª mensal"
              aria-label={`Primeira mensal: ${available ? formatDate(row.firstDate) : "indisponível"}`}
              dateTime={available ? row.firstDate : undefined}
            >
              {available ? formatDate(row.firstDate) : "—"}
            </time>
            <time
              role="cell"
              data-label="Última mensal"
              aria-label={`Última mensal: ${available ? formatDate(row.lastDate) : "indisponível"}`}
              dateTime={available ? row.lastDate : undefined}
            >
              {available ? formatDate(row.lastDate) : "—"}
            </time>
          </div>
        ))}
      </div>
    </section>
  );
}

async function fetchInventory(source = "/api/inventory") {
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error("inventory_unavailable");
  return response.json() as Promise<InventoryPayload>;
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  return value ? date.format(new Date(`${value}T12:00:00.000Z`)) : "Não informada";
}

function formatPaymentDate(value?: string | null) {
  return value ? formatDate(value) : "Indisponível";
}

function informationLabel(value?: string | null) {
  return value?.trim() || "Não informado";
}

function progressLabel(value: number | null) {
  return value == null ? "Não informado" : percent.format(value > 1 ? value / 100 : value);
}

function floorLabel(value: number | null) {
  if (value == null) return "Não informado";
  return value === 0 ? "Térreo" : `${decimal.format(value)}º andar`;
}

function municipalHousingBand(income: number) {
  if (income <= 0) return "";
  if (income <= 4863) return "HIS-1";
  if (income <= 9726) return "HIS-2";
  if (income <= 16210) return "HMP";
  return "Mercado Livre";
}

function municipalHousingPriceLimit(income: number) {
  if (income <= 0) return null;
  if (income <= 4863) return 276102.2;
  if (income <= 9726) return 383636.74;
  if (income <= 16210) return 537672.71;
  return null;
}

function propertyAddress(item: InventoryItem) {
  const street = item.street?.trim() || "";
  const number = item.streetNumber?.trim() || "";
  const neighborhood = item.neighborhood?.trim() || "";
  const city = item.city?.trim() || "";
  const state = item.state?.trim() || "";
  const streetAndNumber = [street, number].filter(Boolean).join(", ");
  const cityAndState = city ? `${city}${state ? `-${state}` : ""}` : state;
  return (
    `${streetAndNumber}${neighborhood ? ` - ${neighborhood}` : ""}${cityAndState ? `, ${cityAndState}` : ""}` ||
    "Endereço não informado"
  );
}

export function InvestorInfoHint({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hintId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span
      className="investor-info-hint"
      ref={containerRef}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (!pinned && !containerRef.current?.contains(document.activeElement)) setOpen(false);
      }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!pinned && !event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        type="button"
        className="investor-info-trigger"
        title={`Abrir ajuda: ${label}`}
        aria-label={`Informações sobre ${label}`}
        aria-expanded={open}
        aria-controls={hintId}
        aria-describedby={open ? hintId : undefined}
        onClick={() => {
          setPinned(true);
          setOpen(true);
        }}
      >
        <span className="investor-info-mark" aria-hidden="true" />
      </button>
      {open ? (
        <span className="investor-info-dialog" id={hintId} role="note" aria-label={title}>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
      ) : null}
    </span>
  );
}

export function InvestorGuideLauncher() {
  return (
    <aside
      className="investor-hero-guide"
      aria-label="Guia completo do simulador"
      data-tour="welcome"
    >
      <div className="investor-proposal-help-cta">
        <span className="investor-hero-guide-information" data-tour="information">
          <small>Guia completo</small>
          <InvestorInfoHint
            label="passo a passo"
            title="Como funciona o guia?"
            description="Abra o guia e leia um passo por vez. Ele mostra onde clicar, o que digitar e como conferir o resultado. O guia não muda nenhum valor."
          />
        </span>
        <button
          className="investor-guided-start"
          type="button"
          aria-haspopup="dialog"
          aria-controls="investor-guided-tour"
          onClick={(event) =>
            window.dispatchEvent(
              new CustomEvent("investor:start-guide", { detail: { trigger: event.currentTarget } }),
            )
          }
        >
          Iniciar passo a passo
        </button>
      </div>
    </aside>
  );
}

function InvestorCommercialLinks() {
  return (
    <>
      <a
        className="investor-resource-platform"
        href="https://boravender.app.br/login"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir Bora Vendas em nova aba"
      >
        <span className="investor-hero-logo bora" aria-hidden="true" />
        <span>
          <small>Acessar plataforma</small>
          <strong>Bora Vendas</strong>
        </span>
      </a>
      <a
        className="investor-resource-platform"
        href="https://direcional.my.site.com/vendas/s/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir Salesforce em nova aba"
      >
        <span className="investor-hero-logo salesforce" aria-hidden="true" />
        <span>
          <small>Acessar plataforma</small>
          <strong>Salesforce</strong>
        </span>
      </a>
    </>
  );
}

function associativeModalityMessage(decision: FinancingDecision) {
  if (!decision.effectiveModality) return "Informe uma renda familiar válida.";
  if (
    decision.reasonCodes.includes("INCOME_ABOVE_MCMV_LIMIT") &&
    decision.reasonCodes.includes("NOT_FIRST_PROPERTY")
  )
    return "SBPE automático: renda acima de R$ 13.000,00 e cliente fora da regra de primeiro imóvel.";
  if (decision.reasonCodes.includes("INCOME_ABOVE_MCMV_LIMIT"))
    return "SBPE automático: renda familiar acima do limite atual de R$ 13.000,00 do MCMV.";
  if (decision.reasonCodes.includes("NOT_FIRST_PROPERTY"))
    return "SBPE automático: cliente informou que não se enquadra como primeiro imóvel.";
  if (decision.reasonCodes.includes("PROPERTY_ABOVE_MCMV_LIMIT"))
    return "SBPE automático: valor do imóvel acima do limite atual de R$ 600.000,00 do MCMV.";
  if (decision.effectiveModality === "SBPE") return "SBPE selecionado pelo usuário.";
  return `MCMV — ${decision.mcmvRangeLabel ?? "faixa a confirmar"}.`;
}

function AssociativeQualificationPanel({
  income,
  modality,
  modalityDecision,
  firstProperty,
  sectionRef,
  guided,
  incomeInputRef,
  onIncomeChange,
  onModalityChange,
  onFirstPropertyChange,
}: {
  income: string;
  modality: string;
  modalityDecision: FinancingDecision;
  firstProperty: string;
  sectionRef: Ref<HTMLElement>;
  guided: boolean;
  incomeInputRef: Ref<HTMLInputElement>;
  onIncomeChange: (value: string) => void;
  onModalityChange: (value: string) => void;
  onFirstPropertyChange: (value: string) => void;
}) {
  const [blockedMcmvAttempt, setBlockedMcmvAttempt] = useState(false);
  const incomeReady = currencyInputNumber(income) > 0;
  const incomeValue = currencyInputNumber(income);
  const incomeBand = municipalHousingBand(incomeValue);
  const incomeBandPropertyLimit = municipalHousingPriceLimit(incomeValue);
  const modalityReady = Boolean(modality);
  const firstPropertyReady = Boolean(firstProperty);
  const completed = Number(incomeReady) + Number(modalityReady) + Number(firstPropertyReady);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className={`investor-associative-qualification${completed === 3 ? "is-complete" : ""}${guided ? "is-guided-active" : ""}`}
      aria-labelledby="investor-associative-qualification-title"
      data-tour="qualification"
    >
      <header className="investor-section-heading investor-associative-qualification-heading">
        <span>02</span>
        <div>
          <p>Perfil do financiamento</p>
          <h2 id="investor-associative-qualification-title">Responda para liberar o fluxo</h2>
        </div>
        <strong aria-live="polite">{completed}/3 concluídas</strong>
      </header>
      <div className="investor-associative-qualification-grid">
        <div className={`investor-associative-question ${incomeReady ? "complete" : "current"}`}>
          <div className="investor-associative-question-heading">
            <span>
              <b>1</b>Renda Familiar
            </span>
            <InvestorInfoHint
              label="Renda Familiar"
              title="Qual renda devo informar?"
              description="Digite a renda mensal somada de todas as pessoas que participarão da compra. Ela ajuda a indicar a faixa municipal e a modalidade. A aprovação final depende da análise oficial."
            />
          </div>
          <div className="investor-associative-question-money">
            <span aria-hidden="true">R$</span>
            <MoneyInput
              inputRef={incomeInputRef}
              label="Renda Familiar"
              describedBy="investor-associative-income-status"
              value={income}
              onChange={onIncomeChange}
            />
          </div>
          <small id="investor-associative-income-status" role="status" aria-live="polite">
            {incomeReady
              ? `Enquadramento municipal: ${incomeBand} · ${incomeBandPropertyLimit ? `imóvel até ${money.format(incomeBandPropertyLimit)}` : "sem teto HIS/HMP"}`
              : "Informe um valor maior que zero"}
          </small>
        </div>

        <fieldset
          className={`investor-associative-question${!incomeReady ? "locked" : modalityReady ? "complete" : "current"}`}
        >
          <legend className="sr-only">Modalidade do Financiamento</legend>
          <div className="investor-associative-question-heading">
            <span>
              <b>2</b>Modalidade do Financiamento
            </span>
            <InvestorInfoHint
              label="Modalidade do Financiamento"
              title="Como a modalidade é escolhida?"
              description="O sistema verifica renda, valor do imóvel e primeiro imóvel. Se o cliente estiver dentro das regras, começa em MCMV. Quando não estiver, usa SBPE. A instituição financeira confirma a modalidade na análise final."
            />
          </div>
          <div className="investor-associative-choice-row">
            {(["MCMV", "SBPE"] as FinancingModality[]).map((option) => {
              const unavailable = option === "MCMV" && modalityDecision.forced;
              return (
                <button
                  key={option}
                  type="button"
                  className={`${modality === option ? "selected" : ""}${unavailable ? "unavailable" : ""}`}
                  aria-pressed={modality === option}
                  aria-disabled={!incomeReady || unavailable}
                  aria-describedby="investor-associative-modality-status"
                  onClick={() => {
                    if (!incomeReady) return;
                    if (unavailable) {
                      setBlockedMcmvAttempt(true);
                      return;
                    }
                    setBlockedMcmvAttempt(false);
                    onModalityChange(option);
                  }}
                >
                  {option}
                  {unavailable ? <small>Indisponível</small> : null}
                </button>
              );
            })}
          </div>
          <small
            id="investor-associative-modality-status"
            className="investor-associative-modality-result"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {blockedMcmvAttempt
              ? `MCMV indisponível. ${associativeModalityMessage(modalityDecision)}`
              : associativeModalityMessage(modalityDecision)}{" "}
            <span>Enquadramento preliminar.</span>
          </small>
        </fieldset>

        <fieldset
          className={`investor-associative-question${!modalityReady ? "locked" : firstPropertyReady ? "complete" : "current"}`}
        >
          <legend className="sr-only">Primeiro imóvel?</legend>
          <div className="investor-associative-question-heading">
            <span>
              <b>3</b>Primeiro imóvel?
            </span>
            <InvestorInfoHint
              label="Primeiro imóvel"
              title="Quando devo marcar Sim?"
              description="Marque Sim quando o cliente não possui outro imóvel residencial e não tem financiamento habitacional ativo. Marque Não quando uma dessas situações existir."
            />
          </div>
          <div className="investor-associative-choice-row investor-associative-yes-no">
            {[
              { value: "SIM", label: "Sim" },
              { value: "NAO", label: "Não" },
            ].map((option) => (
              <label
                key={option.value}
                className={firstProperty === option.value ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="primeiro-imovel-associativo"
                  value={option.value}
                  checked={firstProperty === option.value}
                  disabled={!modalityReady}
                  onChange={(event) => onFirstPropertyChange(event.target.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <small role="status" aria-live="polite">
            {!modalityReady
              ? "Conclua a etapa anterior"
              : firstPropertyReady
                ? "Perfil completo"
                : "Sim = sem outro imóvel residencial ou financiamento habitacional ativo"}
          </small>
        </fieldset>
      </div>
    </section>
  );
}

function AssociativeDocumentationPanel({
  businessUnit,
  modality,
  manualModalityPreference,
  firstProperty,
  salePrice,
  reportedAppraisal,
  appraisalOverride,
  financing,
  income,
  baseDate,
  onAppraisalOverrideChange,
}: {
  businessUnit: string;
  modality: string;
  manualModalityPreference: FinancingModality | null;
  firstProperty: string;
  salePrice: number;
  reportedAppraisal: number;
  appraisalOverride: string;
  financing: string;
  income: string;
  baseDate: string;
  onAppraisalOverrideChange: (value: string) => void;
}) {
  const installmentsDialog = useRef<HTMLDialogElement>(null);
  const financingValue = currencyInputNumber(financing);
  const incomeValue = currencyInputNumber(income);
  const documentationView = useMemo(
    () =>
      calculateAssociativeDocumentationView({
        businessUnit,
        modality,
        manualModalityPreference,
        firstProperty,
        salePrice,
        reportedAppraisal,
        appraisalOverride: currencyInputNumber(appraisalOverride),
        financing: financingValue,
        income: incomeValue,
        baseDate,
      }),
    [
      appraisalOverride,
      baseDate,
      businessUnit,
      financingValue,
      firstProperty,
      incomeValue,
      manualModalityPreference,
      modality,
      reportedAppraisal,
      salePrice,
    ],
  );
  const { appraisalFromReport, appraisalValue, missingItems, result, status } = documentationView;
  const documentationInstallments = useMemo(
    () =>
      result.ok
        ? buildDocumentationInstallmentSchedule({
            firstInstallmentDate: result.firstInstallmentDate,
            installments: result.installments,
            installmentValue: result.installmentValue,
          })
        : [],
    [result],
  );

  return (
    <>
      <aside
        className={`investor-associative-documentation ${status}`}
        aria-labelledby="investor-associative-documentation-title"
      >
        <header>
          <div>
            <span>03</span>
            <div>
              <p>Proposta calculada</p>
              <h3 id="investor-associative-documentation-title">Resumo financeiro</h3>
            </div>
          </div>
          <div className="investor-associative-documentation-actions">
            <button
              type="button"
              disabled={!result.ok}
              aria-haspopup="dialog"
              aria-controls="investor-associative-documentation-installments"
              onClick={() => installmentsDialog.current?.showModal()}
            >
              Exibir parcelas
            </button>
            <button type="button" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </header>

        {!appraisalFromReport ? (
          <section
            className="investor-associative-documentation-input"
            aria-label="Avaliação bancária necessária"
          >
            <label htmlFor="investor-documentation-appraisal">Avaliação bancária</label>
            <div className="investor-associative-documentation-appraisal">
              <span aria-hidden="true">R$</span>
              <MoneyInput
                id="investor-documentation-appraisal"
                label="Avaliação bancária"
                describedBy="investor-documentation-appraisal-help"
                value={appraisalOverride}
                onChange={onAppraisalOverrideChange}
              />
            </div>
            <small id="investor-documentation-appraisal-help">
              O relatório da unidade não trouxe este valor.
            </small>
          </section>
        ) : null}

        {result.ok ? (
          <>
            <div className="investor-associative-documentation-summary">
              <section
                className="investor-associative-documentation-plan"
                aria-label="Plano sugerido para a documentação"
              >
                <small>Plano sugerido</small>
                <p>
                  <strong>{result.installments}x Parcelas de</strong>{" "}
                  <span>{money.format(result.installmentValue)}</span>
                </p>
                <small>
                  1ª parcela para <b>{formatDate(result.firstInstallmentDate)}</b>
                </small>
                <div>
                  <small>Total da documentação</small>
                  <strong>{money.format(result.totalCash)}</strong>
                </div>
              </section>

              <section className="investor-associative-documentation-breakdown">
                <header>
                  <h4>Composição</h4>
                  <InvestorInfoHint
                    label="Composição da documentação"
                    title="De onde vem o total?"
                    description={associativeHelp(
                      `O total soma ITBI, registro, despachante e Seguro Caixa. Modalidade usada: ${result.effectiveModality}.`,
                      `Conta atual: ${money.format(result.itbi)} + ${money.format(result.totalRegistration)} + ${money.format(result.dispatchFee)} + ${money.format(result.caixaInsurance)} = ${money.format(result.totalCash)}.`,
                      `Avaliação bancária: ${money.format(appraisalValue)}. Limite de financiamento: ${money.format(result.maximumFinancing)}. ${result.itbiRule}`,
                    )}
                  />
                </header>
                <dl>
                  <div>
                    <dt>ITBI</dt>
                    <dd>{money.format(result.itbi)}</dd>
                  </div>
                  <div>
                    <dt>Registro total</dt>
                    <dd>{money.format(result.totalRegistration)}</dd>
                  </div>
                  <div>
                    <dt>Despachante</dt>
                    <dd>{money.format(result.dispatchFee)}</dd>
                  </div>
                  <div>
                    <dt>Seguro Caixa</dt>
                    <dd>{money.format(result.caixaInsurance)}</dd>
                  </div>
                  <div className="total">
                    <dt>Total da documentação</dt>
                    <dd>{money.format(result.totalCash)}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </>
        ) : (
          <section
            className="investor-associative-documentation-empty"
            role={missingItems.length > 0 ? "status" : "alert"}
            aria-live="polite"
          >
            <span aria-hidden="true">{missingItems.length > 0 ? "…" : "!"}</span>
            <div>
              <h4>
                {missingItems.length > 0
                  ? "Complete os dados para ver o resultado"
                  : "A proposta precisa de ajuste"}
              </h4>
              <p>
                {missingItems.length > 0
                  ? "O painel calcula automaticamente assim que as bases obrigatórias estiverem completas."
                  : "O motor documental encontrou uma condição fora da regra."}
              </p>
              <ul>
                {(missingItems.length > 0 ? missingItems : result.errors).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </aside>
      <dialog
        ref={installmentsDialog}
        id="investor-associative-documentation-installments"
        className="investor-documentation-dialog investor-direct-amortization-dialog investor-associative-documentation-installments-dialog"
        aria-labelledby="investor-associative-documentation-installments-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <article>
          <header>
            <div>
              <p>Documentação</p>
              <h2 id="investor-associative-documentation-installments-title">
                Parcelas da documentação
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Fechar parcelas da documentação">
                ×
              </button>
            </form>
          </header>
          {result.ok ? (
            <>
              <div
                className="investor-direct-amortization-scroll investor-associative-documentation-installment-table-wrap"
                role="region"
                tabIndex={0}
                aria-label="Cronograma das parcelas da documentação"
              >
                <table>
                  <caption className="sr-only">Cronograma mensal da documentação</caption>
                  <thead>
                    <tr>
                      <th scope="col">Parcela</th>
                      <th scope="col">Vencimento</th>
                      <th scope="col">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentationInstallments.map((item) => (
                      <tr key={item.number}>
                        <th scope="row">
                          {String(item.number).padStart(2, "0")}/{result.installments}
                        </th>
                        <td>
                          <time dateTime={item.paymentDate}>{formatDate(item.paymentDate)}</time>
                        </td>
                        <td>
                          <strong>{money.format(item.value)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="investor-associative-documentation-installment-empty">
              Complete a proposta para gerar o cronograma.
            </p>
          )}
        </article>
      </dialog>
    </>
  );
}

type AssociativeCommissionChannel = "House" | "Imobiliária";
type AssociativeCommissionOption = { classification: string; rate: number };

const ASSOCIATIVE_COMMISSION_OPTIONS: Record<
  AssociativeCommissionChannel,
  readonly AssociativeCommissionOption[]
> = {
  House: Object.entries(ASSOCIATIVE_COMMISSION_RATES.House).map(([classification, rate]) => ({
    classification,
    rate,
  })),
  Imobiliária: Object.entries(ASSOCIATIVE_COMMISSION_RATES.Imobiliária).map(
    ([classification, rate]) => ({ classification, rate }),
  ),
};

function AssociativeCommissionPanel({
  realSaleValue,
  propertyValue,
  cashBackSlack,
}: {
  realSaleValue: number;
  propertyValue: number;
  cashBackSlack: number;
}) {
  const channelId = useId();
  const classificationId = useId();
  const [channel, setChannel] = useState<"" | AssociativeCommissionChannel>("");
  const [classification, setClassification] = useState("");
  const classificationOptions = channel ? ASSOCIATIVE_COMMISSION_OPTIONS[channel] : [];
  const remuneration = calculateAssociativeCommercialRemuneration({
    channel,
    classification,
    realSaleValue,
    propertyValue,
    cashBackSlack,
  });
  const {
    commissionBase,
    commissionRate,
    commissionValue,
    awardBase,
    awardRate,
    awardValue,
    hasAward,
    totalValue,
    totalRate,
  } = remuneration;
  const commissionReady = remuneration.ready;

  return (
    <aside
      className={`investor-associative-commission ${commissionReady ? "ready" : "pending"}`}
      aria-labelledby="investor-associative-commission-title"
    >
      <header>
        <div>
          <span>04</span>
          <div>
            <p>Remuneração comercial</p>
            <h3 id="investor-associative-commission-title">Comissão + Prêmio da venda</h3>
          </div>
        </div>
      </header>

      <div className="investor-associative-commission-filters">
        <label htmlFor={channelId}>
          <span>Canal de venda</span>
          <select
            id={channelId}
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value as "" | AssociativeCommissionChannel);
              setClassification("");
            }}
          >
            <option value="">Selecione o canal</option>
            <option value="House">House</option>
            <option value="Imobiliária">Imobiliária</option>
          </select>
        </label>
        <label htmlFor={classificationId}>
          <span>Classificação</span>
          <select
            id={classificationId}
            value={classification}
            disabled={!channel}
            onChange={(event) => setClassification(event.target.value)}
          >
            <option value="">Selecione a classificação</option>
            {classificationOptions.map((option) => (
              <option key={option.classification} value={option.classification}>
                {option.classification} · {percent.format(option.rate)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="investor-associative-commission-table" aria-live="polite" aria-atomic="true">
        <table>
          <caption className="sr-only">Composição da comissão e da premiação comercial</caption>
          <thead>
            <tr>
              <th scope="col">Composição</th>
              <th scope="col">Base</th>
              <th scope="col">Taxa</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Comissão</th>
              <td>{money.format(commissionBase)}</td>
              <td>{commissionReady ? percent.format(commissionRate) : "—"}</td>
              <td>
                <div className="investor-associative-commission-result">
                  <span>Valor da Comissão</span>
                  <strong>{commissionReady ? money.format(commissionValue) : "—"}</strong>
                </div>
              </td>
            </tr>
            <tr>
              <th scope="row">Prêmio MKT V.C</th>
              <td>{money.format(awardBase)}</td>
              <td>{hasAward ? percent.format(awardRate) : "—"}</td>
              <td>
                <div className="investor-associative-commission-result">
                  <span>Valor da premiação</span>
                  <strong>
                    {hasAward ? money.format(awardValue) : commissionReady ? "Sem premiação" : "—"}
                  </strong>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>
                <strong>{commissionReady ? money.format(totalValue) : "—"}</strong>
              </td>
              <td>
                <span>% total</span>
              </td>
              <td>
                <strong>
                  {commissionReady && totalRate !== null ? percent.format(totalRate) : "—"}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </aside>
  );
}

function AssociativeCommissionDialog({
  dialogRef,
  realSaleValue,
  propertyValue,
  cashBackSlack,
}: {
  dialogRef: Ref<HTMLDialogElement>;
  realSaleValue: number;
  propertyValue: number;
  cashBackSlack: number;
}) {
  return (
    <dialog
      ref={dialogRef}
      id="investor-associative-commission-dialog"
      className="investor-documentation-dialog investor-associative-commission-dialog"
      aria-labelledby="investor-associative-commission-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <article>
        <form method="dialog" className="investor-associative-commission-close">
          <button type="submit" aria-label="Fechar comissão e prêmio">
            ×
          </button>
        </form>
        <AssociativeCommissionPanel
          realSaleValue={realSaleValue}
          propertyValue={propertyValue}
          cashBackSlack={cashBackSlack}
        />
      </article>
    </dialog>
  );
}

type AssociativeAdjustmentPayment = {
  label: string;
  date?: string;
  value: number;
};

type AssociativeFlow = "linear" | "decreasing";

type AssociativeFlowSuggestion = {
  installments: number;
  annuals: number[];
  entry: number;
  signals: number[];
  signalCount: number;
};

type AssociativeAdjustmentRow = {
  label: string;
  date?: string;
  value: number | string;
  currency?: boolean;
  featured?: boolean;
};

function AssociativeApprovalPanel({
  tierId,
  onTierChange,
  income,
  realSaleValue,
  proSoluto,
  linearInstallment,
  decreasingInstallment,
  linearMaximumIncomePayment,
  decreasingMaximumIncomePayment,
  linearInstallmentDate,
  decreasingInstallmentDate,
  linearMaximumIncomeDate,
  decreasingMaximumIncomeDate,
  comparisonReady,
  proposalValid,
  proposalError,
  financingReady,
  entryPending,
  entryRejected,
  currentEntryDate,
  currentSignalPayments,
  currentAnnualPayments,
  releaseStatus,
  onBuildFlowSuggestion,
  onApplyFlowSuggestion,
}: {
  tierId: string;
  onTierChange: (value: string) => void;
  income: number;
  realSaleValue: number;
  proSoluto: number;
  linearInstallment: number | null;
  decreasingInstallment: number | null;
  linearMaximumIncomePayment: number | null;
  decreasingMaximumIncomePayment: number | null;
  linearInstallmentDate?: string;
  decreasingInstallmentDate?: string;
  linearMaximumIncomeDate?: string;
  decreasingMaximumIncomeDate?: string;
  comparisonReady: boolean;
  proposalValid: boolean;
  proposalError?: string;
  financingReady: boolean;
  entryPending: boolean;
  entryRejected: boolean;
  currentEntryDate?: string;
  currentSignalPayments: AssociativeAdjustmentPayment[];
  currentAnnualPayments: AssociativeAdjustmentPayment[];
  releaseStatus: ReturnType<typeof calculateAssociativeReleaseStatus>;
  onBuildFlowSuggestion: (flow: AssociativeFlow) => AssociativeFlowSuggestion | null;
  onApplyFlowSuggestion: (flow: AssociativeFlow, suggestion: AssociativeFlowSuggestion) => void;
}) {
  const adjustmentsDialogRef = useRef<HTMLDialogElement>(null);
  const [preparedSuggestions, setPreparedSuggestions] = useState<
    Partial<Record<AssociativeFlow, AssociativeFlowSuggestion | null>>
  >({});
  const approval = calculateAssociativeApproval({
    tierId,
    income,
    realSaleValue,
    proSoluto,
    linearInstallment,
    decreasingInstallment,
    linearMaximumIncomePayment,
    decreasingMaximumIncomePayment,
    proposalValid,
    paymentComparisonValid: comparisonReady,
  });
  const tier = approval.tier;
  const rows = [
    {
      id: "pro-soluto",
      label: "% Pró-Soluto",
      linearValue: approval.proSolutoRate,
      decreasingValue: approval.proSolutoRate,
      limit: tier?.proSolutoRate,
      help: `Mostra quanto do imóvel ainda será parcelado após recursos, Entrada e Sinais. Anuais não entram nesta conta. Cálculo: ${money.format(proSoluto)} ÷ ${money.format(realSaleValue)} = ${percent.format(approval.proSolutoRate)}. O resultado precisa ficar igual ou abaixo do limite do Ranking.`,
    },
    {
      id: "commitment",
      label: "% Comprometimento da Renda",
      linearValue: approval.linearCommitmentRate,
      decreasingValue: approval.decreasingCommitmentRate,
      limit: tier?.commitmentRate,
      help: comparisonReady
        ? `O sistema procura a maior parcela do cronograma e divide pela renda, sem somar a Evolução de Obra. Linear: ${money.format(linearInstallment ?? 0)} em ${formatPaymentDate(linearInstallmentDate)} = ${percent.format(approval.linearCommitmentRate)} da renda. Decrescente: ${money.format(decreasingInstallment ?? 0)} em ${formatPaymentDate(decreasingInstallmentDate)} = ${percent.format(approval.decreasingCommitmentRate)} da renda.`
        : "Complete a proposta para o sistema comparar as maiores parcelas dos fluxos Linear e Decrescente com a renda.",
    },
    {
      id: "annual-income",
      label: "% Máximo da renda por anual",
      linearValue: approval.linearMaximumIncomeRate,
      decreasingValue: approval.decreasingMaximumIncomeRate,
      limit: tier?.annualIncomeLimitRate,
      help: comparisonReady
        ? `O sistema procura o mês mais pesado: parcela corrigida + Evolução de Obra. Depois divide o total pela renda. Linear: ${money.format(linearMaximumIncomePayment ?? 0)} em ${formatPaymentDate(linearMaximumIncomeDate)} = ${percent.format(approval.linearMaximumIncomeRate)}. Decrescente: ${money.format(decreasingMaximumIncomePayment ?? 0)} em ${formatPaymentDate(decreasingMaximumIncomeDate)} = ${percent.format(approval.decreasingMaximumIncomeRate)}.`
        : "Complete a proposta para comparar o mês mais pesado de cada fluxo com a renda familiar.",
    },
  ];
  const approvalReady = Boolean(
    financingReady && !entryPending && !entryRejected && tier && comparisonReady && proposalValid,
  );
  const tierRejectsAll = tier?.id === "not-eligible";
  const linearFailures = rows.filter((row) => row.limit != null && row.linearValue > row.limit);
  const decreasingFailures = rows.filter(
    (row) => row.limit != null && row.decreasingValue > row.limit,
  );
  const linearStatus = approvalReady
    ? tierRejectsAll || linearFailures.length > 0
      ? "rejected"
      : "approved"
    : "pending";
  const decreasingStatus = approvalReady
    ? tierRejectsAll || decreasingFailures.length > 0
      ? "rejected"
      : "approved"
    : "pending";
  const adjustmentFor = (
    flow: AssociativeFlow,
    suggestion: AssociativeFlowSuggestion | null | undefined,
  ) => {
    const status = flow === "linear" ? linearStatus : decreasingStatus;
    const failure = (flow === "linear" ? linearFailures : decreasingFailures)[0];
    if (status === "pending")
      return { summary: "Complete os campos-chave para calcular este fluxo.", rows: [] };
    if (status === "approved") return { summary: "Nenhum ajuste necessário.", rows: [] };
    if (tierRejectsAll)
      return {
        summary: "Selecione um Ranking elegível para comparar este fluxo com limites de aprovação.",
        rows: [],
      };
    if (!failure)
      return { summary: proposalError || "Revise os dados informados neste fluxo.", rows: [] };
    if (suggestion === undefined)
      return { summary: "Preparando a prévia exata do ajuste…", rows: [] };
    if (!suggestion)
      return {
        summary: "Nenhum ajuste automático válido foi encontrado para este fluxo.",
        rows: [],
      };
    const signalRows: AssociativeAdjustmentRow[] = suggestion.signals
      .map((value, index) => ({
        label: `Sinal ${index + 1}`,
        date: currentSignalPayments[index]?.date,
        value,
        currency: true,
      }))
      .filter((row) => Number(row.value) > 0);
    const annualRows: AssociativeAdjustmentRow[] = suggestion.annuals
      .map((value, index) => ({
        label: `Anual ${index + 1}`,
        date: currentAnnualPayments[index]?.date,
        value,
        currency: true,
      }))
      .filter((row) => Number(row.value) > 0);
    return {
      summary: "",
      rows: [
        { label: "Qtd. de parcelas", value: suggestion.installments, featured: true },
        {
          label: "Entrada sugerida",
          date: currentEntryDate,
          value: suggestion.entry,
          currency: true,
        },
        ...signalRows,
        ...annualRows,
      ] satisfies AssociativeAdjustmentRow[],
    };
  };
  const nextKeyAction = !financingReady
    ? "Informe o valor do Financiamento para continuar."
    : entryPending
      ? "Informe o valor da Entrada para continuar."
      : !entryRejected && !tier
        ? "Selecione o Ranking para calcular a aprovação."
        : null;
  const feedbackTone = nextKeyAction
    ? "guidance"
    : entryRejected || !proposalValid
      ? "rejected"
      : !comparisonReady
        ? "guidance"
        : linearStatus === "approved" && decreasingStatus === "approved"
          ? "approved"
          : linearStatus !== decreasingStatus
            ? "partial"
            : "rejected";
  const feedbackLabel =
    feedbackTone === "approved"
      ? "APROVADO"
      : feedbackTone === "rejected"
        ? "REPROVADO"
        : feedbackTone === "partial"
          ? "1 FLUXO APROVADO"
          : "PRÓXIMA AÇÃO";
  const feedbackMessage =
    nextKeyAction ||
    (!comparisonReady
      ? "Aguarde o cálculo completo das parcelas para validar o resultado."
      : linearStatus === "approved" && decreasingStatus === "approved"
        ? "Linear e Decrescente estão dentro da regra selecionada."
        : linearStatus !== decreasingStatus
          ? `${linearStatus === "approved" ? "Linear" : "Decrescente"} aprovado. Compare a sugestão do fluxo reprovado antes de escolher.`
          : tier?.id === "not-eligible"
            ? "Classificação Não Elegível: a proposta não possui limite disponível."
            : "Os dois fluxos precisam de ajuste. Abra os ajustes necessários para corrigir a proposta.");
  const hasApplicableAdjustment =
    (feedbackTone === "rejected" || feedbackTone === "partial") &&
    !tierRejectsAll &&
    (linearStatus === "rejected" || decreasingStatus === "rejected");
  const adjustmentOptions = [
    ...(linearStatus === "rejected"
      ? [
          {
            flow: "linear" as const,
            label: "Fluxo Linear",
            suggestion: preparedSuggestions.linear,
            details: adjustmentFor("linear", preparedSuggestions.linear),
          },
        ]
      : []),
    ...(decreasingStatus === "rejected"
      ? [
          {
            flow: "decreasing" as const,
            label: "Fluxo Decrescente",
            suggestion: preparedSuggestions.decreasing,
            details: adjustmentFor("decreasing", preparedSuggestions.decreasing),
          },
        ]
      : []),
  ];
  const prepareAndOpenAdjustments = () => {
    const nextSuggestions: Partial<Record<AssociativeFlow, AssociativeFlowSuggestion | null>> = {};
    if (linearStatus === "rejected") nextSuggestions.linear = onBuildFlowSuggestion("linear");
    if (decreasingStatus === "rejected")
      nextSuggestions.decreasing = onBuildFlowSuggestion("decreasing");
    setPreparedSuggestions(nextSuggestions);
    window.requestAnimationFrame(() => {
      const dialog = adjustmentsDialogRef.current;
      if (dialog && !dialog.open) dialog.showModal();
    });
  };
  const applySuggestionAndClose = (
    flow: AssociativeFlow,
    suggestion: AssociativeFlowSuggestion | null | undefined,
  ) => {
    if (!suggestion) return;
    onApplyFlowSuggestion(flow, suggestion);
    adjustmentsDialogRef.current?.close();
  };
  const releaseLabel = (item: typeof releaseStatus.commission) =>
    item.status === "released"
      ? "LIBERADO"
      : item.status === "scheduled"
        ? "PROGRAMADO"
        : item.status === "blocked"
          ? "BLOQUEADO"
          : "PENDENTE";

  return (
    <section
      className={`investor-associative-approval ${approval.status}`}
      aria-labelledby="investor-associative-approval-title"
    >
      <header>
        <div>
          <div>
            <p>Parâmetros de aprovação</p>
            <h3 id="investor-associative-approval-title">Resultado × regra da classificação</h3>
          </div>
        </div>
        <label
          className={`investor-associative-approval-editable investor-key-field${financingReady && !entryPending && !entryRejected && !tier ? "is-active" : ""}`}
        >
          <select
            aria-label="Selecione o Ranking"
            name="classificacao-associativo"
            value={tierId}
            onChange={(event) => onTierChange(event.target.value)}
          >
            <option value="">Selecione o Ranking</option>
            {ASSOCIATIVE_APPROVAL_TIERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      {tier ? (
        <>
          <table>
            <caption className="sr-only">
              Comparação entre os resultados atuais e as regras da classificação selecionada
            </caption>
            <thead>
              <tr>
                <th>Regra de aprovação</th>
                <th>Resultado Linear</th>
                <th>Resultado Decrescente</th>
                <th>Limite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const linearFailed = row.limit != null && row.linearValue > row.limit;
                const decreasingFailed = row.limit != null && row.decreasingValue > row.limit;
                const failed = linearFailed || decreasingFailed;
                return (
                  <tr
                    key={row.id}
                    className={failed ? "failed" : row.limit != null ? "passed" : "pending"}
                  >
                    <th scope="row">
                      <span className="investor-associative-approval-rule">
                        <span>{row.label}</span>
                        <InvestorInfoHint
                          label={row.label}
                          title={`Entenda ${row.label}`}
                          description={row.help}
                        />
                      </span>
                    </th>
                    <td className={linearFailed ? "failed-value" : undefined}>
                      {percent.format(row.linearValue)}
                    </td>
                    <td className={decreasingFailed ? "failed-value" : undefined}>
                      {percent.format(row.decreasingValue)}
                    </td>
                    <td>{row.limit == null ? "—" : `≤ ${percent.format(row.limit)}`}</td>
                  </tr>
                );
              })}
              <tr className="investor-associative-approval-status-row">
                <th scope="row">Status da proposta</th>
                <td>
                  <strong className={`investor-associative-flow-status ${linearStatus}`}>
                    {linearStatus === "approved"
                      ? "APROVADO"
                      : linearStatus === "rejected"
                        ? "REPROVADO"
                        : "PENDENTE"}
                  </strong>
                </td>
                <td>
                  <strong className={`investor-associative-flow-status ${decreasingStatus}`}>
                    {decreasingStatus === "approved"
                      ? "APROVADO"
                      : decreasingStatus === "rejected"
                        ? "REPROVADO"
                        : "PENDENTE"}
                  </strong>
                </td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
          <div
            className={`investor-associative-release-status ${releaseStatus.repasse.status}`}
            role="status"
            aria-live="polite"
            aria-label="Situação do repasse"
          >
            <div className="investor-associative-release-status-header">
              <div className="investor-associative-release-status-identity">
                <h4>Repasse</h4>
                <strong className={releaseStatus.repasse.status}>
                  {releaseLabel(releaseStatus.repasse)}
                </strong>
              </div>
              {releaseStatus.repasse.releaseDate ? (
                <div className="investor-associative-release-date">
                  <span>Liberação prevista</span>
                  <time dateTime={releaseStatus.repasse.releaseDate}>
                    {formatPaymentDate(releaseStatus.repasse.releaseDate)}
                  </time>
                </div>
              ) : null}
            </div>
            <p>{releaseStatus.repasse.reason}</p>
          </div>
          {hasApplicableAdjustment ? (
            <dialog
              ref={adjustmentsDialogRef}
              id="investor-associative-adjustments"
              className="investor-documentation-dialog investor-associative-adjustment-dialog"
              aria-labelledby="investor-associative-adjustments-title"
              aria-describedby="investor-associative-adjustments-description"
              onClick={(event) => {
                if (event.target === event.currentTarget) event.currentTarget.close();
              }}
            >
              <article>
                <header>
                  <div>
                    <p>Ajuste da proposta</p>
                    <h2 id="investor-associative-adjustments-title">Ajustes necessários</h2>
                  </div>
                  <form method="dialog">
                    <button type="submit" aria-label="Fechar ajustes">
                      ×
                    </button>
                  </form>
                </header>
                <p id="investor-associative-adjustments-description">
                  Confira a prévia e escolha o fluxo. O sistema nunca diminui a Entrada, os Sinais
                  ou as Anuais já informados: ele apenas acrescenta o que faltar. Ao aplicar, a
                  janela fecha para você conferir o novo resultado.
                </p>
                <div className="investor-associative-adjustment-options">
                  {adjustmentOptions.map((option) => (
                    <section key={option.flow} className={`is-${option.flow}`}>
                      <header>
                        <div>
                          <span>{option.label}</span>
                          <small>Prévia exata do ajuste</small>
                        </div>
                        <strong>REPROVADO</strong>
                      </header>
                      {option.details.summary ? (
                        <p className="investor-associative-adjustment-summary">
                          {option.details.summary}
                        </p>
                      ) : null}
                      {option.details.rows.length > 0 ? (
                        <dl className="investor-associative-adjustment-ledger">
                          {option.details.rows.map((row) => (
                            <div
                              key={row.label}
                              className={
                                `${row.featured ? "featured" : ""}${row.date ? "payment-row" : ""}`.trim() ||
                                undefined
                              }
                            >
                              <dt>{row.label}</dt>
                              <span className="payment-date">
                                {row.date ? formatPaymentDate(row.date) : ""}
                              </span>
                              <span className="operator" aria-hidden="true">
                                =
                              </span>
                              <span className="currency" aria-hidden="true">
                                {row.currency ? "R$" : ""}
                              </span>
                              <dd
                                aria-label={
                                  row.currency && typeof row.value === "number"
                                    ? money.format(row.value)
                                    : undefined
                                }
                              >
                                {row.currency && typeof row.value === "number"
                                  ? currencyInput.format(row.value)
                                  : row.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <footer>
                        <button
                          type="button"
                          disabled={!option.suggestion}
                          onClick={() => applySuggestionAndClose(option.flow, option.suggestion)}
                        >
                          {option.suggestion
                            ? `Aplicar estes valores no ${option.label}`
                            : "Ajuste automático indisponível"}
                        </button>
                      </footer>
                    </section>
                  ))}
                </div>
              </article>
            </dialog>
          ) : null}
          <footer
            className={`${feedbackTone}${hasApplicableAdjustment ? "has-adjustment-action" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {hasApplicableAdjustment ? (
              <button
                type="button"
                className="investor-associative-approval-trigger"
                aria-haspopup="dialog"
                aria-controls="investor-associative-adjustments"
                onClick={prepareAndOpenAdjustments}
              >
                <span>{feedbackLabel}</span>
                <small>{feedbackMessage}</small>
                <strong>Ver ajustes necessários</strong>
              </button>
            ) : (
              <>
                <span>{feedbackLabel}</span>
                <div className="investor-associative-approval-feedback-copy">
                  <small>{feedbackMessage}</small>
                </div>
              </>
            )}
          </footer>
        </>
      ) : null}
    </section>
  );
}

const PERSON_DOCUMENTATION = {
  pf: {
    title: "Documentação Pessoa Física",
    items: [
      "Ficha de Cadastro para Análise Interna;",
      "RG/ CPF, CNH, CTPS ou Carteira Profissional. Documento com foto;",
      "Certidão de estado Civil (Nascimento/ Casamento, Casamento com averbação do divórcio/ óbito;",
      "Comprovante de endereço (prazo 60 dias da emissão/ IR poderá ser aceito, por ser tratar de venda à vista)",
    ],
  },
  pj: {
    title: "Documentação Pessoa Jurídica",
    items: [
      "Ficha de Cadastro para Análise Interna;",
      "Cartão CNPJ;",
      "Contrato Social/ última alteração contratual;",
      "Proprietário/Sócios: RG e CPF ou CNH;",
      "Certidão de estado Civil (Nascimento/ Casamento, Casamento com averbação do divórcio/ óbito);",
      "Comprovante de endereço (prazo 60 dias da emissão/ IR poderá ser aceito, por ser tratar de venda à vista)",
    ],
  },
} as const;

const ASSOCIATIVE_PERSON_DOCUMENTATION = {
  title: "Documentação Pessoa Física · Associativo",
  sections: [
    {
      title: "Identificação e estado civil",
      items: [
        "RG/CPF, CNH, CTPS ou Carteira Profissional com foto;",
        "Certidão de estado civil: nascimento, casamento ou casamento com averbação do divórcio/óbito;",
        "Comprovante de endereço emitido nos últimos 60 dias.",
      ],
    },
    {
      title: "Comprovação de renda",
      items: [
        "Renda formal: contracheques dos últimos 60 dias, Carteira de Trabalho com identificação e contratos, e extrato do FGTS;",
        "Renda informal: extratos completos dos últimos 3 a 6 meses e Declaração de Imposto de Renda com recibo de entrega;",
        "A análise de crédito da modalidade Associativo é realizada diretamente pela CAIXA.",
      ],
    },
    {
      title: "Dependentes e fator social",
      items: [
        "Pais, mães, sogros, filhos maiores de 18 anos e parentes de 2º ou 3º grau exigem os documentos pessoais e as comprovações aplicáveis;",
        "Filhos menores de 18 anos não exigem comprovante de residência nem declaração de parentesco, residência e ausência de rendimentos;",
        "A CAIXA pode solicitar documentos adicionais durante a análise.",
      ],
    },
  ],
  note: "União estável não substitui a Certidão de estado Civil.",
} as const;

const DIRECT_PERSON_DOCUMENTATION = {
  pf: {
    title: "Documentação Pessoa Física · Tabela Direta",
    sections: [
      {
        title: "Cadastro e identificação",
        items: [
          "Ficha de Cadastro para Análise Interna preenchida com renda e despesas informadas pelo cliente;",
          "RG/CPF, CNH, CTPS ou Carteira Profissional com foto;",
          "Pesquisa SERASA. São aceitas restrições de até R$ 3.000,00, somando todos os proponentes;",
          "Certidão de estado civil: nascimento, casamento ou casamento com averbação do divórcio/óbito;",
          "Comprovante de endereço emitido nos últimos 60 dias.",
        ],
      },
      {
        title: "Comprovação de renda formal",
        items: [
          "Apresente os 3 últimos contracheques ou comprovantes de benefícios;",
          "Para pró-labore, apresente os 3 últimos comprovantes com os DARFs pagos;",
          "Apresente o Imposto de Renda 2026 e, para cliente sem restrição, a resposta da análise de crédito bancária;",
          "A resposta do crédito Associativo não condiciona o resultado da análise de crédito interna.",
        ],
      },
      {
        title: "Comprovação de renda informal",
        items: [
          "Apresente extratos bancários completos dos últimos 6 meses consecutivos, com períodos fechados de 30 ou 31 dias e identificação do banco, titular, período, agência e conta;",
          "Não são aceitos: movimentações entre cônjuges ou parentes, ganho de capital, resgates, venda de imóveis, doações, heranças, entradas e saídas simultâneas, PIX do próprio titular, valores esporádicos sem comprovação ou extrato com saldo final negativo.",
        ],
      },
      {
        title: "Clientes no exterior",
        items: [
          "Apresente a mesma documentação de Pessoa Física, oficial e reconhecida no Brasil, CPF ativo, endereço e telefone brasileiros. Documentos em língua estrangeira precisam de tradução para o português;",
          "Para renda recebida no exterior, traduza a comprovação formal e apresente ao menos 1 extrato bancário com o valor líquido do contracheque. Traduza também ao menos 1 extrato; a análise pode solicitar documentos adicionais.",
        ],
      },
    ],
    note: "União estável não substitui a Certidão de estado Civil.",
  },
  pj: {
    title: "Documentação Pessoa Jurídica · Tabela Direta",
    sections: [
      {
        title: "Cadastro da empresa",
        items: [
          "Ficha de Cadastro para Análise Interna;",
          "Cartão CNPJ;",
          "Contrato Social ou última alteração contratual;",
          "Extratos bancários dos últimos 6 meses completos, da mesma Razão Social e CNPJ.",
        ],
      },
      {
        title: "Documentos dos sócios",
        items: [
          "RG e CPF ou CNH dos proprietários e sócios;",
          "Certidão de estado civil dos proprietários e sócios;",
          "Comprovante de endereço emitido nos últimos 60 dias. O Imposto de Renda pode ser aceito como comprovante de endereço.",
        ],
      },
      {
        title: "Capacidade financeira",
        items: [
          "A análise considera extratos bancários consecutivos e completos da mesma empresa;",
          "Pode ser utilizado até 40% da renda validada para as parcelas pós-Habite-se.",
        ],
      },
    ],
    note: "União estável não substitui a Certidão de estado Civil.",
  },
} as const;

const INVESTOR_MANUAL_SECTIONS = [
  {
    title: "Entenda a modalidade",
    questions: [
      {
        question: "O que é a Tabela Investidor?",
        answer:
          "É uma modalidade para parcelar o valor do imóvel durante o período de obra, conforme a política comercial interna. O simulador reúne estoque, planos prontos, proposta personalizada, resultado e validação em um único fluxo.",
      },
      {
        question: "Qual é a principal vantagem para o cliente?",
        answer:
          "A principal vantagem informada nesta modalidade é a não incidência de correção sobre o fluxo apresentado. Antes de formalizar, confirme a condição no processo comercial oficial.",
      },
      {
        question: "É feita análise de crédito?",
        answer:
          "Para vendas na modalidade Tabela Investidor, a orientação exibida no simulador informa que não é feita análise de crédito. Ainda assim, confira a documentação indicada para pessoa física ou jurídica antes de formalizar a proposta.",
      },
    ],
  },
  {
    title: "Encontre o imóvel e compare os planos",
    questions: [
      {
        question: "Como localizar a unidade correta?",
        answer:
          "Combine os filtros de Incorporadora, Empreendimento, Região, Planta e Valor do Imóvel. Depois, confira produto, metragem, data de entrega e valor antes de selecionar a unidade.",
      },
      {
        question: "Posso vender vaga de garagem avulsa nesta modalidade?",
        answer:
          "Não. Vagas de garagem avulsas são retiradas do estoque elegível da Tabela Investidor. Apartamentos que possuem vaga continuam disponíveis normalmente.",
      },
      {
        question: "Por que existem 8 propostas prontas?",
        answer:
          "São 4 combinações em 18 parcelas e 4 em 24 parcelas. Em cada prazo, você pode comparar propostas com ou sem sinais e com ou sem intermediárias antes de personalizar o fluxo.",
      },
      {
        question: "Quando devo usar uma proposta pronta?",
        answer:
          "Comece sempre pelos planos prontos. Eles ajudam a explicar as diferenças de entrada, pagamentos adicionais, saldo, valor das mensais e início do parcelamento. Personalize somente quando a condição do cliente exigir.",
      },
    ],
  },
  {
    title: "Regras para montar a proposta",
    questions: [
      {
        question: "Qual é a entrada mínima?",
        answer:
          "O ato deve representar pelo menos 6% do valor real. A entrada total, formada pelo ato mais os sinais aprovados, precisa atingir 10% para liberar o fluxo de até 18 parcelas e 20% para liberar até 24 parcelas, sempre limitada pelo prazo da obra.",
      },
      {
        question: "Como funcionam os sinais?",
        answer:
          "Podem ser usados até 3 sinais. Cada sinal ativo deve ser de pelo menos R$ 150,00. O Sinal 2 não pode ser maior que o Sinal 1, o Sinal 3 não pode ser maior que o Sinal 2 e não é permitido pular o sinal anterior.",
      },
      {
        question: "Como funcionam as intermediárias?",
        answer:
          "São permitidas até 3 intermediárias no fluxo de 18 parcelas e até 4 no fluxo de 24 parcelas. Cada uma pode representar no máximo 5% do valor real, deve coincidir com uma mensal e ocorrer até 3 meses antes do término da obra.",
      },
      {
        question: "Quando devo aplicar desconto?",
        answer:
          "Use o desconto somente quando solicitado pelo cliente e autorizado. Enquanto estiver desativado, ele não altera o cálculo da proposta.",
      },
    ],
  },
  {
    title: "Datas, parcelas e validação",
    questions: [
      {
        question: "Como são definidas as datas dos pagamentos?",
        answer:
          "O simulador trabalha com dias comerciais 5, 10 ou 15. Os sinais começam após a entrada e a primeira mensal é deslocada para depois do último sinal aprovado. As intermediárias seguem a cadência do plano e precisam coincidir com uma mensal.",
      },
      {
        question: "Por que o limite de parcelas pode ser menor que 18 ou 24?",
        answer:
          "18 e 24 são limites comerciais máximos. A quantidade realmente disponível também considera a entrada total, os sinais usados e o tempo restante até a data de entrega da obra.",
      },
      {
        question: "Como saber onde a proposta está errada?",
        answer:
          "Campos fora da regra recebem destaque e explicam o motivo do ajuste. Abra a Auditoria do cálculo para conferir entrada, sinais, intermediárias, prazo, saldo e parcela. Corrija todos os itens reprovados antes de apresentar a proposta.",
      },
      {
        question: "O que devo conferir no resultado?",
        answer:
          "Reconcilie valor do imóvel, entrada, sinais válidos, intermediárias válidas, saldo parcelado, quantidade de parcelas, valor mensal e datas inicial e final. O selo deve indicar que a proposta está dentro da regra.",
      },
    ],
  },
  {
    title: "Documentação e condução comercial",
    questions: [
      {
        question: "Onde encontro a documentação do cliente?",
        answer:
          "No cabeçalho do resultado, use Doc Pessoa Física ou Doc Pessoa Jurídica. Abra a lista correta, confira todos os itens e valide eventuais dúvidas com o gerente ou a área responsável.",
      },
      {
        question: "Quando posso imprimir a proposta?",
        answer:
          "Imprima somente depois de confirmar a unidade, os valores, todas as datas, a documentação e a auditoria sem reprovações. Se a opção pronta estiver fechada, abra-a antes de imprimir para garantir que o plano desejado esteja visível.",
      },
      {
        question: "Qual é a melhor forma de apresentar as opções ao cliente?",
        answer:
          "Compare as alternativas disponíveis com o cliente e explique a diferença entre entrada imediata, sinais, intermediárias e mensais. Evite prometer condições que não estejam aprovadas no simulador e no fluxo oficial.",
      },
      {
        question: "O simulador substitui a validação oficial?",
        answer:
          "Não. Ele é uma ferramenta de apoio comercial. Confirme os dados da unidade, o resultado e a documentação no fluxo oficial antes de formalizar a proposta.",
      },
    ],
  },
] as const;

const ASSOCIATIVE_MANUAL_SECTIONS = [
  {
    title: "MCMV e SBPE",
    questions: [
      {
        question: "Como a modalidade é selecionada?",
        answer:
          "A renda atualiza o enquadramento imediatamente. Até R$ 13.000,00, sem outro imóvel residencial ou financiamento habitacional ativo e com unidade dentro do limite vigente, a opção inicial é MCMV; o cliente elegível ainda pode escolher SBPE. Acima dos limites ou fora da regra de primeiro imóvel, o sistema aplica SBPE.",
      },
      {
        question: "Quais são as faixas urbanas do MCMV em 2026?",
        answer:
          "Faixa 1: até R$ 3.200,00; Faixa 2: de R$ 3.200,01 a R$ 5.000,00; Faixa 3: de R$ 5.000,01 a R$ 9.600,00; Classe Média: de R$ 9.600,01 a R$ 13.000,00. O limite do imóvel usado nesta simulação é R$ 600.000,00. HIS-1, HIS-2 e HMP são enquadramentos municipais separados.",
      },
      {
        question: "O enquadramento confirma o crédito ou o percentual financiado?",
        answer:
          "Não. É uma triagem preliminar. A contratação, o percentual financiável e as condições dependem da instituição, do produto, da avaliação, do sistema de amortização, da localização e da análise de crédito.",
      },
    ],
  },
  {
    title: "Como funciona o Associativo",
    questions: [
      {
        question: "O que é a modalidade Associativo?",
        answer:
          "É a aquisição com crédito imobiliário contratado com a CAIXA e um pró-soluto pago à Direcional. O pró-soluto é a diferença que permanece depois de descontar financiamento, subsídio, FGTS, Cheque Moradia, entrada, sinais e anuais válidas.",
      },
      {
        question: "Quem faz a análise de crédito?",
        answer:
          "Na modalidade Associativo, a análise de crédito é realizada diretamente pela CAIXA. O simulador compara a proposta com a classificação informada, mas não substitui a aprovação do agente financeiro.",
      },
    ],
  },
  {
    title: "Entrada, sinais e anuais",
    questions: [
      {
        question: "Como a entrada e os sinais são validados?",
        answer:
          "A entrada é obrigatória e precisa ter ao menos R$ 150,00. Há até três sinais opcionais: cada sinal ativo precisa ter ao menos R$ 150,00, seguir a sequência e não superar o sinal anterior.",
      },
      {
        question: "Como funcionam as anuais?",
        answer:
          "Há até cinco anuais opcionais com vencimento em 15/12 e somente até o término da obra. Cada anual válida recebe a correção do WF-13 e aparece, na sua data, junto do cronograma completo de pagamentos.",
      },
      {
        question: "Por que os campos aparecem somente quando adicionados?",
        answer:
          "Sinais e anuais começam resumidos para manter a leitura compacta. O botão + adiciona uma linha por vez; × oculta a linha e zera o valor correspondente sem alterar os demais pagamentos válidos.",
      },
    ],
  },
  {
    title: "Fluxos linear e decrescente",
    questions: [
      {
        question: "Como é calculada a parcela linear?",
        answer:
          "O saldo parcelado é dividido entre o período pré-obra e pós-obra. O WF-13 aplica PRICE a 0,5% ao mês no pré-obra e 1,5% ao mês no pós-obra; a parcela linear corrigida é o maior pagamento calculado entre os dois períodos.",
      },
      {
        question: "Como é calculado o fluxo decrescente?",
        answer:
          "O WF-13B distribui o mesmo saldo em quatro blocos sequenciais: 40%, 30%, 20% e 10%. Cada bloco calcula seus períodos pré e pós-obra e exibe o maior pagamento corrigido do bloco.",
      },
      {
        question: "O que é Evolução de Obra?",
        answer:
          "É renda familiar × 30% × andamento estimado da obra. O andamento aparece em todos os vencimentos, parte do percentual informado no relatório, evolui mensalmente até 100% na entrega e permanece congelado em 100% depois dela. O mês da simulação e o mês seguinte ficam sem cobrança; a cobrança começa no terceiro mês programado.",
      },
    ],
  },
  {
    title: "Jornada guiada e documentação",
    questions: [
      {
        question: "Qual é a ordem correta de preenchimento?",
        answer:
          "Siga o destaque dourado: Financiamento, Subsídio, FGTS, Cheque Moradia, Entrada, quantidade de parcelas e Ranking. Cada resposta válida libera a etapa seguinte; use zero nos recursos que não existirem.",
      },
      {
        question: "Onde consultar parcelas e remuneração?",
        answer:
          "Em Resumo financeiro, Exibir parcelas abre somente número, vencimento e valor da documentação. Depois de selecionar o Ranking, o ícone $ no canto inferior direito abre a remuneração comercial.",
      },
    ],
  },
  {
    title: "Parâmetros de aprovação",
    questions: [
      {
        question: "As anuais diminuem o Pró-Soluto?",
        answer:
          "Não. O Pró-Soluto e o Saldo parcelado são calculados depois dos recursos, da Entrada e dos Sinais, sem descontar anuais. A anual reduz somente a base distribuída nas parcelas mensais; por isso pode melhorar o Comprometimento da Renda e o Máximo da renda por anual sem alterar o percentual de Pró-Soluto.",
      },
      {
        question: "O que é % Comprometimento da Renda?",
        answer:
          "O simulador consulta todas as parcelas corrigidas, sem a Evolução de Obra, escolhe a maior e divide pela renda familiar. O resultado e a data do pico são mostrados separadamente para o fluxo Linear e para o Decrescente.",
      },
      {
        question: "O que é % Máximo da renda por anual?",
        answer:
          "O simulador consulta o popup inteiro, soma parcela corrigida + Evolução de Obra em cada mensal, escolhe a maior carga e divide pela renda familiar. Assim o atendimento considera o mês mais pesado de cada fluxo, e não presume que a primeira parcela é a maior.",
      },
      {
        question: "Como a classificação é aplicada?",
        answer:
          "Diamante, Ouro, Prata, Bronze e Aço definem limites próprios de pró-soluto, comprometimento mensal e anual. A proposta só é aprovada quando todos os parâmetros, a proposta e a memória comparativa estão dentro da regra selecionada.",
      },
    ],
  },
] as const;

const ASSOCIATIVE_PROPOSAL_GUIDE_STEPS = [
  {
    title: "Confira os valores que vieram do estoque",
    description:
      "Leia Valor real da venda, B.A. da unidade e Folga de tabela. Esses campos já vêm preenchidos e não precisam ser digitados.",
    note: "Se o imóvel ou algum valor estiver errado, volte ao estoque e escolha a unidade correta antes de continuar.",
  },
  {
    title: "Digite o Financiamento",
    description:
      "Informe o valor aprovado pelo banco. Use um número maior que zero. Depois disso, o campo Subsídio será liberado.",
    note: "Digite somente o financiamento. Não some entrada, FGTS, subsídio ou Cheque Moradia neste campo.",
  },
  {
    title: "Digite o Subsídio ou zero",
    description:
      "Se o cliente recebeu subsídio, informe o valor. Se não recebeu, digite zero. Assim, o campo FGTS será liberado.",
    note: "Nunca deixe o campo vazio: use zero para dizer ao sistema que não há subsídio.",
  },
  {
    title: "Digite o FGTS ou zero",
    description:
      "Informe quanto do FGTS será usado na compra. Se o cliente não usar FGTS, digite zero. Depois, o Cheque Moradia será liberado.",
    note: "Use apenas o valor confirmado para esta proposta.",
  },
  {
    title: "Digite o Cheque Moradia ou zero",
    description:
      "Informe o valor do benefício. Se não houver, digite zero. O sistema então libera a Entrada.",
    note: "Financiamento, Subsídio, FGTS e Cheque Moradia são descontados do valor do imóvel.",
  },
  {
    title: "Informe a Entrada",
    description:
      "Digite quanto o cliente pagará na data mostrada ao lado do campo. A entrada mínima é R$ 150,00.",
    note: "Ajustes necessários nunca diminuem a entrada já digitada. Eles preservam esse valor e acrescentam somente o que faltar.",
  },
  {
    title: "Escolha a quantidade de parcelas",
    description:
      "Digite um número inteiro entre 1 e o limite mostrado na tela. O sistema divide esse total entre o período antes e depois da entrega.",
    note: "Comece com 84 quando quiser a menor mensal possível. Se a quantidade não formar os 4 blocos, siga a mensagem de correção.",
  },
  {
    title: "Selecione o Ranking",
    description:
      "Abra a lista à direita e escolha a classificação correta. O sistema compara os fluxos Linear e Decrescente com os limites desse Ranking.",
    note: "Sem Ranking, sinais, anuais, desconto e resultado de aprovação continuam bloqueados.",
  },
  {
    title: "Adicione Sinais somente se precisar",
    description:
      "Use Inserir Sinal para criar até 3 pagamentos extras. Preencha na ordem: Sinal 1, depois 2 e depois 3.",
    note: "Cada sinal precisa ter pelo menos R$ 150,00. Um ajuste automático preserva os sinais já informados e só aumenta o necessário.",
  },
  {
    title: "Adicione Anuais somente se precisar",
    description:
      "Use Inserir Anual para incluir pagamentos em 15 de dezembro, enquanto a obra estiver em andamento. Elas reduzem a base das mensais, mas nunca o Pró-Soluto.",
    note: "Cada anual pode chegar a 50% da renda familiar. O sistema preserva os valores já digitados e aplica a correção mostrada na ajuda.",
  },
  {
    title: "Leia o resultado e os ajustes",
    description:
      "APROVADO significa que o fluxo está dentro do Ranking. REPROVADO mostra o botão Ver ajustes necessários, com uma prévia antes de qualquer mudança.",
    note: "Confira a prévia. Só clique em Aplicar estes valores se quiser substituir a proposta pelos valores mostrados.",
  },
  {
    title: "Confira parcelas, documentos e impressão",
    description:
      "Abra Exibir parcelas para revisar valores e datas. Depois confira a documentação e imprima somente a proposta final.",
    note: "Antes de apresentar ao cliente, confirme unidade, renda, recursos, entrada, Ranking, datas e status de aprovação.",
  },
] as const;

const ASSOCIATIVE_LEARNING_SOURCES = [
  {
    label: "Ministério das Cidades — regras e faixas do MCMV",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/perguntas-frequentes/habitacao",
  },
  {
    label: "Ministério das Cidades — MCMV Classe Média",
    href: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/minha-casa-minha-vida-classe-media/minha-casa-minha-vida-classe-media-1",
  },
  {
    label: "Banco Central — Sistema Brasileiro de Poupança e Empréstimo",
    href: "https://www.bcb.gov.br/estabilidadefinanceira/associacaopoupancaemprestimo",
  },
] as const;

const DIRECT_TABLE_POLICY_TOPICS = [
  {
    title: "Modalidade e validação",
    items: [
      "A Tabela Direta é o financiamento da construtora. Atende, em geral, clientes que comportam parcelas maiores, querem quitar o imóvel em menos tempo, têm restrição para financiamento CAIXA ou preferem outra instituição financeira.",
      "Toda venda exige análise de crédito interna. O simulador apoia o atendimento, mas não substitui a aprovação e o fluxo comercial oficiais.",
      "Existem quatro opções: sem sinal e sem intermediária; com sinal e sem intermediária; sem sinal e com intermediária; com sinal e com intermediária.",
      "A unidade, o valor e as datas precisam estar válidos. Desconto somente altera a base real da proposta quando estiver autorizado; deve ser maior ou igual a zero e menor que o valor do imóvel.",
    ],
  },
  {
    title: "Distribuição, ato e sinais",
    items: [
      "Regra geral: 10% de entrada, 30% durante a obra e 60% pós-chaves em 120 parcelas. Se o nome da planta contiver “Vaga”: 10% de entrada, 40% durante a obra e 50% pós-chaves em até 66 parcelas.",
      "Sem sinais, o ato pronto corresponde a 10%. Com sinais, o padrão pronto distribui 6% no ato e 4% em três sinais: 1,34%, 1,33% e 1,33%, com ajuste final de centavos para fechar os 10%.",
      "Os sinais são consecutivos: não existe Sinal 2 sem Sinal 1 nem Sinal 3 sem Sinal 2. O Sinal 1 não pode superar o ato; o Sinal 2 não pode superar o Sinal 1; e o Sinal 3 não pode superar o Sinal 2.",
      "O ato usa a data da simulação. Cada pagamento seguinte usa o último dia comercial disponível entre 5, 10 e 15, sempre depois do anterior e dentro da janela de 31 dias.",
    ],
  },
  {
    title: "Obra e intermediárias",
    items: [
      "As mensais pré-chaves começam depois do último pagamento da entrada, seguem mês a mês e incluem o mês da entrega. Não possuem juros, MIP ou DFI.",
      "O saldo pré-chaves é 30% na regra geral ou 40% para planta contendo Vaga. Intermediárias válidas são descontadas desse saldo; o restante é dividido pela quantidade de mensais até a entrega.",
      "Cada intermediária é opcional e limitada a 5% do valor real. Precisa respeitar a entrada total de 10%, ocorrer a partir da primeira mensal, coincidir com uma mensal e ficar, no máximo, até três meses-calendário antes da entrega.",
      "Há até oito posições semestrais, mas a quantidade liberada depende da data de entrega e do saldo da obra. Na regra geral, o teto financeiro é seis intermediárias de 5%; em planta contendo Vaga, pode chegar a oito.",
      "Sinais e intermediárias com valor zero são neutros e não entram na composição apresentada.",
    ],
  },
  {
    title: "Pós-chaves e resultado",
    items: [
      "O pós-chaves começa após a última mensal pré-chaves. O saldo é 60% em 120 parcelas na regra geral ou 50% em até 66 parcelas quando a planta contém Vaga.",
      "A parcela usa o sistema PRICE com juros equivalentes a 12% ao ano, seguro MIP de 0,021% e seguro DFI de 0,007%.",
      "A renda mensal positiva é obrigatória. O comprometimento corresponde à parcela pós-chaves dividida pela renda: até e incluindo 40% resulta em APROVADO no simulador; acima de 40% resulta em REPROVADO.",
      "A idade máxima informada para o participante é 79 anos, 11 meses e 29 dias. A elegibilidade final deve ser confirmada na análise interna.",
    ],
  },
  {
    title: "Correção, banco e registro",
    items: [
      "A política informa correção pelo INCC durante a obra e por IPCA + 1% após o Habite-se. Depois de seis meses do Habite-se, o cliente pode optar por financiar o saldo com o banco de sua preferência; confirme as condições no fluxo oficial.",
      "O registro começa após a averbação do Habite-se e a disponibilidade da matrícula individualizada, IPTU e certificação da conclusão. O cliente deve estar adimplente.",
      "O registro pode ser conduzido pelo cliente ou por despachante, com conferência prévia das taxas cartoriais. O prazo médio informado é de 50 dias.",
      "Antes de apresentar ou imprimir, confirme unidade, valores, datas, composição dos pagamentos, renda, auditoria e a documentação disponível nos botões Pessoa Física e Pessoa Jurídica.",
    ],
  },
] as const;

const DIRECT_TABLE_FAQ = [
  {
    question: "Para quem serve a Tabela Direta?",
    answer:
      "Para clientes que comportam parcelas maiores, querem quitar o imóvel em menos tempo, possuem restrição para financiamento CAIXA ou preferem financiar em outra instituição. A modalidade continua sujeita à análise interna.",
  },
  {
    question: "Qual das quatro opções devo usar?",
    answer:
      "Escolha conforme a forma de entrada desejada: ato único ou ato com três sinais; e com ou sem intermediárias. Compare o fluxo completo e só apresente a alternativa que respeitar a renda e a auditoria.",
  },
  {
    question: "O que muda quando a planta contém “Vaga”?",
    answer:
      "A entrada permanece em 10%. O bloco da obra passa de 30% para 40%, e o pós-chaves passa de 60% em 120 parcelas para 50% em até 66 parcelas.",
  },
  {
    question: "Posso pular ou aumentar um sinal?",
    answer:
      "Não pode haver lacunas: o Sinal 2 depende do Sinal 1, e o Sinal 3 depende do Sinal 2. Cada sinal também precisa ser igual ou menor que o pagamento anterior.",
  },
  {
    question: "Como as datas 5, 10 e 15 são escolhidas?",
    answer:
      "A partir do pagamento anterior, o simulador procura o último dia válido entre 5, 10 e 15 que seja posterior e esteja dentro de 31 dias. Essa cascata define sinais e o início das mensais.",
  },
  {
    question: "Como o pré-chaves é calculado?",
    answer:
      "O saldo da obra, de 30% ou 40%, é reduzido pelas intermediárias válidas e dividido pelas mensais desde o fim da entrada até o mês da entrega. Essas mensais não têm juros ou seguros.",
  },
  {
    question: "Por que a quantidade de intermediárias muda?",
    answer:
      "Porque cada uma precisa coincidir com uma mensal, respeitar o intervalo semestral e terminar até três meses-calendário antes da entrega. O prazo da obra e o teto de 30% ou 40% determinam quantas podem ser usadas.",
  },
  {
    question: "Como o pós-chaves é calculado?",
    answer:
      "O saldo de 60% ou 50% é parcelado pelo sistema PRICE, com juros de 12% ao ano, MIP de 0,021% e DFI de 0,007%. A memória de cálculo mostra parcela, juros, seguros e saldo devedor.",
  },
  {
    question: "O que significa APROVADO ou REPROVADO?",
    answer:
      "É o resultado do comprometimento da renda no simulador. Até 40% é APROVADO; acima de 40% é REPROVADO. Em todos os casos, a análise de crédito interna continua obrigatória.",
  },
  {
    question: "Quando o desconto pode ser usado?",
    answer:
      "Somente quando estiver autorizado. Ele reduz a base real usada em todos os percentuais e deve ser menor que o valor do imóvel.",
  },
  {
    question: "O que acontece com campos zerados?",
    answer:
      "Sinais e intermediárias zerados são tratados como não utilizados. Eles não somam, não alteram o saldo e não aparecem na composição final.",
  },
  {
    question: "Onde consulto os documentos do cliente?",
    answer:
      "Use os botões Doc Pessoa Física e Doc Pessoa Jurídica no fim da página. Para cliente no exterior, consulte a seção específica dentro da documentação de Pessoa Física.",
  },
  {
    question: "O cliente pode migrar o saldo para um banco?",
    answer:
      "A política permite optar por financiamento bancário após seis meses do Habite-se. As condições precisam ser confirmadas no fluxo oficial antes de qualquer compromisso com o cliente.",
  },
  {
    question: "Quando o registro pode começar?",
    answer:
      "Após a averbação do Habite-se e a disponibilidade dos documentos do imóvel. O cliente deve estar adimplente e pode conduzir o processo ou contratar despachante; o prazo médio informado é de 50 dias.",
  },
] as const;

function DocumentationDialog({
  type,
  dialogRef,
  directTable = false,
  associative = false,
}: {
  type: keyof typeof PERSON_DOCUMENTATION;
  dialogRef: Ref<HTMLDialogElement>;
  directTable?: boolean;
  associative?: boolean;
}) {
  const content =
    associative && type === "pf"
      ? ASSOCIATIVE_PERSON_DOCUMENTATION
      : directTable
        ? DIRECT_PERSON_DOCUMENTATION[type]
        : PERSON_DOCUMENTATION[type];
  const directContent = DIRECT_PERSON_DOCUMENTATION[type];
  const standardContent = PERSON_DOCUMENTATION[type];
  const titleId = `investor-documentation-${type}-title`;
  return (
    <dialog
      ref={dialogRef}
      id={`investor-documentation-${type}`}
      className="investor-documentation-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <article>
        <header>
          <h2 id={titleId}>{content.title}</h2>
          <form method="dialog">
            <button type="submit" aria-label={`Fechar ${content.title}`}>
              ×
            </button>
          </form>
        </header>
        {directTable || (associative && type === "pf") ? (
          <div className="investor-documentation-sections">
            {(associative && type === "pf"
              ? ASSOCIATIVE_PERSON_DOCUMENTATION.sections
              : directContent.sections
            ).map((section, sectionIndex) => (
              <section
                key={section.title}
                aria-labelledby={`investor-documentation-${type}-section-${sectionIndex}`}
              >
                <h3 id={`investor-documentation-${type}-section-${sectionIndex}`}>
                  <span aria-hidden="true">{String(sectionIndex + 1).padStart(2, "0")}</span>
                  {section.title}
                </h3>
                <ol>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </section>
            ))}
            <p className="investor-documentation-note">
              <strong>Observação</strong>
              <span>
                {associative && type === "pf"
                  ? ASSOCIATIVE_PERSON_DOCUMENTATION.note
                  : directContent.note}
              </span>
            </p>
          </div>
        ) : (
          <>
            <ol>
              {standardContent.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <p>
              <em>Obs.: União estável não substitui a Certidão de estado Civil.</em>
            </p>
          </>
        )}
      </article>
    </dialog>
  );
}

function DirectAmortizationDialog({
  dialogRef,
  principal,
  schedule,
}: {
  dialogRef: Ref<HTMLDialogElement>;
  principal: number;
  schedule: ReturnType<typeof buildDirectTableAmortizationSchedule>;
}) {
  return (
    <dialog
      ref={dialogRef}
      id="investor-direct-amortization"
      className="investor-documentation-dialog investor-direct-amortization-dialog"
      aria-labelledby="investor-direct-amortization-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <article>
        <header>
          <div>
            <span>Memória de cálculo</span>
            <h2 id="investor-direct-amortization-title">{schedule.length} parcelas pós-chaves</h2>
            <p>Saldo inicial {money.format(principal)} · juros de 12% a.a. · seguros MIP e DFI.</p>
          </div>
          <form method="dialog">
            <button type="submit" aria-label="Fechar tabela de amortização">
              ×
            </button>
          </form>
        </header>
        <div
          className="investor-direct-amortization-scroll"
          role="region"
          tabIndex={0}
          aria-label="Tabela de amortização das parcelas pós-chaves"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Amortização</th>
                <th scope="col">Juros</th>
                <th scope="col">Seguro MIP</th>
                <th scope="col">Seguro DFI</th>
                <th scope="col">Parcela total</th>
                <th scope="col">Data da parcela</th>
                <th scope="col">Saldo devedor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">0</th>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>{money.format(principal)}</td>
              </tr>
              {schedule.map((item) => (
                <tr key={item.month}>
                  <th scope="row">{item.month}</th>
                  <td>{money.format(item.amortization)}</td>
                  <td>{money.format(item.interest)}</td>
                  <td>{money.format(item.mip)}</td>
                  <td>{money.format(item.dfi)}</td>
                  <td>
                    <strong>{money.format(item.totalPayment)}</strong>
                  </td>
                  <td>{formatDate(item.paymentDate)}</td>
                  <td>{money.format(item.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </dialog>
  );
}

function DirectPreKeysDialog({
  dialogRef,
  principal,
  schedule,
}: {
  dialogRef: Ref<HTMLDialogElement>;
  principal: number;
  schedule: ReturnType<typeof buildDirectTablePreKeysSchedule>;
}) {
  return (
    <dialog
      ref={dialogRef}
      id="investor-direct-pre-keys"
      className="investor-documentation-dialog investor-direct-amortization-dialog"
      aria-labelledby="investor-direct-pre-keys-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <article>
        <header>
          <div>
            <span>Memória de cálculo</span>
            <h2 id="investor-direct-pre-keys-title">{schedule.length} parcelas pré-chaves</h2>
            <p>Saldo inicial {money.format(principal)} · parcelas mensais sem juros e seguros.</p>
          </div>
          <form method="dialog">
            <button type="submit" aria-label="Fechar tabela das parcelas pré-chaves">
              ×
            </button>
          </form>
        </header>
        <div
          className="investor-direct-amortization-scroll investor-direct-pre-keys-scroll"
          role="region"
          tabIndex={0}
          aria-label="Tabela das parcelas mensais pré-chaves"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Parcela</th>
                <th scope="col">Data da parcela</th>
                <th scope="col">Saldo devedor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">0</th>
                <td>—</td>
                <td>—</td>
                <td>{money.format(principal)}</td>
              </tr>
              {schedule.map((item) => (
                <tr key={item.month}>
                  <th scope="row">{item.month}</th>
                  <td>
                    <strong>{money.format(item.payment)}</strong>
                  </td>
                  <td>{formatDate(item.paymentDate)}</td>
                  <td>{money.format(item.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </dialog>
  );
}

function AssociativeInstallmentDialog({
  dialogRef,
  comparison,
  installments,
  preInstallments,
  postInstallments,
  uncorrectedBalance,
}: {
  dialogRef: Ref<HTMLDialogElement>;
  comparison: ReturnType<typeof buildAssociativePaymentComparison>;
  installments: number;
  preInstallments: number;
  postInstallments: number;
  uncorrectedBalance: number;
}) {
  const { hasAnnuals, normalizedProgress, rows: comparisonRows } = comparison;
  const [viewMode, setViewMode] = useState<"comparison" | "decreasing" | "linear">("comparison");
  const showLinear = viewMode !== "decreasing";
  const showDecreasing = viewMode !== "linear";
  const dialogTitle =
    viewMode === "comparison"
      ? "Linear × Decrescente"
      : viewMode === "linear"
        ? "Tabela Linear"
        : "Tabela Decrescente";

  return (
    <dialog
      ref={dialogRef}
      id="investor-associative-installments"
      className="investor-documentation-dialog investor-direct-amortization-dialog investor-associative-installment-dialog"
      aria-labelledby="investor-associative-installments-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <article>
        <header>
          <div className="investor-associative-dialog-heading">
            <span>Todos os pagamentos</span>
            <h2 id="investor-associative-installments-title">{dialogTitle}</h2>
          </div>
          <p className="investor-associative-dialog-summary">
            <span>Entrada e sinais válidos aparecem primeiro.</span>
            <strong>
              {installments} mensais: {preInstallments} parcelas pré-chaves e {postInstallments}{" "}
              parcelas pós-chaves.
            </strong>
            <span>
              Valores a pagar exibidos nesta tabela já estão corrigidos. Saldo parcelado antes da
              correção: <strong>{money.format(uncorrectedBalance)}</strong>. Anuais aparecem
              separadas e não reduzem esse saldo.
            </span>
          </p>
          <nav
            className="investor-associative-comparison-tabs"
            aria-label="Exibição e impressão das parcelas"
          >
            {[
              { id: "comparison", label: "Tabela comparativa" },
              { id: "decreasing", label: "Tabela Decrescente" },
              { id: "linear", label: "Tabela Linear" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={viewMode === item.id ? "active" : ""}
                aria-pressed={viewMode === item.id}
                onClick={() => setViewMode(item.id as typeof viewMode)}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="investor-associative-print-button"
              onClick={() => window.print()}
              aria-label="Imprimir valores atuais da tabela"
            >
              Imprimir
            </button>
          </nav>
          <form method="dialog">
            <button type="submit" aria-label="Fechar comparativo das parcelas associativas">
              ×
            </button>
          </form>
        </header>
        <p className="investor-associative-comparison-formula">
          % Obra parte de{" "}
          {normalizedProgress == null
            ? "um valor ainda não informado"
            : percent.format(normalizedProgress)}{" "}
          e chega a 100% na entrega. Evolução = renda × 30% × % Obra; mês vigente e próximo mês
          formam a carência de assinatura.
        </p>
        <div
          className={`investor-associative-installment-scroll mode-${viewMode}`}
          role="region"
          aria-label="Todos os pagamentos e comparativo das parcelas lineares e decrescentes"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr className="investor-associative-comparison-groups">
                <th rowSpan={2} scope="col">
                  Nº
                </th>
                <th rowSpan={2} scope="col">
                  Pagamento
                </th>
                <th className="is-work-group" colSpan={2} scope="colgroup">
                  Obra
                </th>
                {hasAnnuals ? (
                  <th className="is-annual-column" rowSpan={2} scope="col">
                    Anual
                  </th>
                ) : null}
                {showLinear ? (
                  <th className="is-linear-group" colSpan={3} scope="colgroup">
                    Fluxo Linear
                  </th>
                ) : null}
                {showDecreasing ? (
                  <th className="is-decreasing-group" colSpan={3} scope="colgroup">
                    Fluxo Decrescente
                  </th>
                ) : null}
                <th rowSpan={2} scope="col">
                  Data Parcela
                </th>
              </tr>
              <tr>
                <th className="is-work-column" scope="col">
                  % Obra
                </th>
                <th className="is-work-column" scope="col">
                  Evolução Obra
                </th>
                {showLinear ? (
                  <>
                    <th className="is-linear-column" scope="col">
                      Parcela Linear
                    </th>
                    <th className="is-linear-column" scope="col">
                      Total Linear
                    </th>
                    <th className="is-linear-column" scope="col">
                      % da Renda
                    </th>
                  </>
                ) : null}
                {showDecreasing ? (
                  <>
                    <th className="is-decreasing-column" scope="col">
                      Decrescente
                    </th>
                    <th className="is-decreasing-column" scope="col">
                      Total Decrescente
                    </th>
                    <th className="is-decreasing-column" scope="col">
                      % da Renda
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((item, index) => (
                <tr
                  key={`${item.kind}-${item.installment ?? item.label}-${item.paymentDate}-${index}`}
                  className={`is-${item.kind}`}
                >
                  <td data-label="Nº">{item.installment ?? "—"}</td>
                  <td data-label="Pagamento">
                    <strong>{item.label}</strong>
                  </td>
                  <td className="is-work-column" data-label="% Obra">
                    {item.constructionProgress == null
                      ? "—"
                      : percent.format(item.constructionProgress)}
                  </td>
                  <td className="is-work-column" data-label="Evolução Obra">
                    {item.workEvolution == null ? "—" : money.format(item.workEvolution)}
                  </td>
                  {hasAnnuals ? (
                    <td className="is-annual-column" data-label="Anual">
                      {item.annualPayment > 0 ? money.format(item.annualPayment) : "—"}
                    </td>
                  ) : null}
                  {showLinear ? (
                    <>
                      <td className="is-linear-column" data-label="Parcela Linear">
                        {item.kind === "monthly" || item.kind === "entry" || item.kind === "signal"
                          ? money.format(item.linearPayment)
                          : "—"}
                      </td>
                      <td className="is-linear-column is-linear-total" data-label="Total Linear">
                        {item.kind === "monthly" ? (
                          <strong>{money.format(item.linearTotal)}</strong>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="is-linear-column" data-label="% da Renda Linear">
                        {item.kind === "monthly" && item.linearIncomeRate != null
                          ? percent.format(item.linearIncomeRate)
                          : "—"}
                      </td>
                    </>
                  ) : null}
                  {showDecreasing ? (
                    <>
                      <td className="is-decreasing-column" data-label="Decrescente">
                        {item.kind === "monthly" ? money.format(item.decreasingPayment) : "—"}
                      </td>
                      <td
                        className="is-decreasing-column is-decreasing-total"
                        data-label="Total Decrescente"
                      >
                        {item.kind === "monthly" ? (
                          <strong>{money.format(item.decreasingTotal)}</strong>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="is-decreasing-column" data-label="% da Renda Decrescente">
                        {item.kind === "monthly" && item.decreasingIncomeRate != null
                          ? percent.format(item.decreasingIncomeRate)
                          : "—"}
                      </td>
                    </>
                  ) : null}
                  <td data-label="Data Parcela">
                    <time dateTime={item.paymentDate}>{formatDate(item.paymentDate)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </dialog>
  );
}

export function InvestorLearningManual({
  directTable = false,
  associative = false,
}: {
  directTable?: boolean;
  associative?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modality = directTable
    ? "Tabela Direta"
    : associative
      ? "Associativo"
      : "Tabela Investidor";

  return (
    <section className="investor-learning-manual" aria-label={`Manual da ${modality}`}>
      <button
        type="button"
        className="investor-learning-link"
        aria-haspopup="dialog"
        aria-controls="investor-learning-dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        Aprenda <span aria-hidden="true">+</span>
      </button>
      <dialog
        ref={dialogRef}
        id="investor-learning-dialog"
        className="investor-documentation-dialog investor-learning-dialog"
        aria-labelledby="investor-learning-title"
        aria-describedby="investor-learning-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <article>
          <header>
            <div>
              <span>{directTable ? "Guia de consulta" : "Manual do corretor"}</span>
              <h2 id="investor-learning-title">
                {directTable ? "Aprenda Tabela Direta" : `Aprenda ${modality}`}
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label={`Fechar manual da ${modality}`}>
                ×
              </button>
            </form>
          </header>
          <p id="investor-learning-description" className="investor-learning-intro">
            Consulte a política completa e as respostas objetivas para conduzir a simulação com
            segurança.
          </p>
          {directTable ? (
            <div className="investor-direct-learning-content">
              <nav aria-label="Navegação do guia">
                <a href="#investor-direct-learning-policy">Política</a>
                <a href="#investor-direct-learning-faq">Perguntas</a>
              </nav>
              <section
                id="investor-direct-learning-policy"
                className="investor-direct-learning-policy"
                aria-labelledby="investor-direct-learning-policy-title"
              >
                <div className="investor-direct-learning-section-heading">
                  <span aria-hidden="true">01</span>
                  <h3 id="investor-direct-learning-policy-title">Política</h3>
                </div>
                <div>
                  {DIRECT_TABLE_POLICY_TOPICS.map((topic) => (
                    <section key={topic.title}>
                      <h4>{topic.title}</h4>
                      <ul>
                        {topic.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>
              <section
                id="investor-direct-learning-faq"
                className="investor-direct-learning-faq"
                aria-labelledby="investor-direct-learning-faq-title"
              >
                <div className="investor-direct-learning-section-heading">
                  <span aria-hidden="true">02</span>
                  <h3 id="investor-direct-learning-faq-title">Perguntas</h3>
                </div>
                <div>
                  {DIRECT_TABLE_FAQ.map((item) => (
                    <details key={item.question}>
                      <summary>{item.question}</summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          ) : associative ? (
            <div className="investor-direct-learning-content investor-associative-learning-content">
              <nav aria-label="Navegação do manual">
                <a href="#investor-associative-learning-policy">Política</a>
                <a href="#investor-associative-learning-faq">Perguntas</a>
              </nav>
              <section
                id="investor-associative-learning-policy"
                className="investor-direct-learning-policy"
                aria-labelledby="investor-associative-learning-policy-title"
              >
                <div className="investor-direct-learning-section-heading">
                  <span aria-hidden="true">01</span>
                  <h3 id="investor-associative-learning-policy-title">Política</h3>
                </div>
                <div>
                  <section>
                    <h4>Resumo da simulação</h4>
                    <ul
                      className="investor-associative-learning-summary"
                      aria-label="Resumo do manual"
                    >
                      <li>
                        <strong>2</strong>
                        <span>fluxos comparados</span>
                      </li>
                      <li>
                        <strong>3</strong>
                        <span>sinais no máximo</span>
                      </li>
                      <li>
                        <strong>Até 84</strong>
                        <span>parcelas máximas</span>
                      </li>
                      <li>
                        <strong>PF</strong>
                        <span>documentação do cliente</span>
                      </li>
                    </ul>
                  </section>
                  <section>
                    <h4>Checklist antes de apresentar</h4>
                    <ul>
                      <li>Unidade, valor e data de entrega confirmados.</li>
                      <li>Entrada, sinais, anuais e mensais reconciliados.</li>
                      <li>Parâmetros de aprovação e memória comparativa conferidos.</li>
                      <li>Resultado validado no fluxo comercial oficial.</li>
                    </ul>
                  </section>
                  <section>
                    <h4>Fontes oficiais</h4>
                    <ul className="investor-associative-learning-sources">
                      {ASSOCIATIVE_LEARNING_SOURCES.map((source) => (
                        <li key={source.href}>
                          <a href={source.href} target="_blank" rel="noopener noreferrer">
                            {source.label}
                            <span aria-hidden="true">↗</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </section>
              <section
                id="investor-associative-learning-faq"
                className="investor-direct-learning-faq investor-associative-learning-faq"
                aria-labelledby="investor-associative-learning-faq-title"
              >
                <div className="investor-direct-learning-section-heading">
                  <span aria-hidden="true">02</span>
                  <h3 id="investor-associative-learning-faq-title">Perguntas</h3>
                </div>
                <div className="investor-associative-learning-faq-groups">
                  {ASSOCIATIVE_MANUAL_SECTIONS.map((section, sectionIndex) => (
                    <section
                      key={section.title}
                      aria-labelledby={`investor-associative-learning-faq-group-${sectionIndex}`}
                    >
                      <h4 id={`investor-associative-learning-faq-group-${sectionIndex}`}>
                        {section.title}
                      </h4>
                      <div>
                        {section.questions.map((item) => (
                          <details key={item.question}>
                            <summary>{item.question}</summary>
                            <p>{item.answer}</p>
                          </details>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <>
              <ul className="investor-learning-highlights" aria-label="Resumo do manual">
                <li>
                  <strong>{associative ? "2" : "8"}</strong>
                  <span>{associative ? "fluxos comparados" : "propostas prontas"}</span>
                </li>
                <li>
                  <strong>3</strong>
                  <span>sinais no máximo</span>
                </li>
                <li>
                  <strong>{associative ? "Até 84" : "18 ou 24"}</strong>
                  <span>parcelas máximas</span>
                </li>
                <li>
                  <strong>{associative ? "PF" : "PF e PJ"}</strong>
                  <span>{associative ? "documentação do cliente" : "listas de documentos"}</span>
                </li>
              </ul>
              <div className="investor-learning-sections">
                {(associative ? ASSOCIATIVE_MANUAL_SECTIONS : INVESTOR_MANUAL_SECTIONS).map(
                  (section) => (
                    <section key={section.title}>
                      <h3>{section.title}</h3>
                      <div>
                        {section.questions.map((item) => (
                          <details key={item.question}>
                            <summary>{item.question}</summary>
                            <p>{item.answer}</p>
                          </details>
                        ))}
                      </div>
                    </section>
                  ),
                )}
              </div>
              <aside className="investor-learning-checklist">
                <strong>Checklist antes de apresentar</strong>
                <ul>
                  <li>Unidade, valor e data de entrega confirmados.</li>
                  <li>
                    Entrada, sinais, {associative ? "anuais" : "intermediárias"} e mensais
                    reconciliados.
                  </li>
                  <li>
                    {associative
                      ? "Parâmetros de aprovação e memória comparativa conferidos."
                      : "Auditoria sem reprovações e documentação conferida."}
                  </li>
                  <li>Resultado validado no fluxo comercial oficial.</li>
                </ul>
              </aside>
            </>
          )}
          <footer>
            <form method="dialog">
              <button type="submit">Fechar manual</button>
            </form>
          </footer>
        </article>
      </dialog>
    </section>
  );
}

function PropertySummary({
  item,
  label,
  associative = false,
}: {
  item: InventoryItem;
  label: string;
  associative?: boolean;
}) {
  return (
    <article
      className={`investor-selected-unit investor-property-summary${associative ? "is-associative" : ""}`}
      aria-label={label}
      data-tour="property-summary"
    >
      <header>
        <div className="investor-unit-identity">
          <h2>Descrição do Imóvel</h2>
          <p className="investor-property-summary-line">
            <strong>{item.project}</strong>
            <span aria-hidden="true">|</span>
            <strong>{compactProductDescription(item.product, item.project)}</strong>
            <span aria-hidden="true">|</span>
            <strong>{propertyAddress(item)}</strong>
          </p>
        </div>
        <div className="investor-unit-price">
          <span>Valor do imóvel</span>
          <strong>{item.finalPrice ? money.format(item.finalPrice) : "Não informado"}</strong>
        </div>
      </header>
      <dl>
        <div tabIndex={0}>
          <dt>Incorporadora</dt>
          <dd>{informationLabel(item.businessUnit)}</dd>
        </div>
        <div tabIndex={0}>
          <dt>Planta</dt>
          <dd>{informationLabel(item.plant)}</dd>
        </div>
        <div tabIndex={0}>
          <dt>Metragem</dt>
          <dd>
            {item.privateArea != null ? `${decimal.format(item.privateArea)} m²` : "Não informada"}
          </dd>
        </div>
        <div tabIndex={0}>
          <dt>Andar</dt>
          <dd>{floorLabel(item.floor)}</dd>
        </div>
        <div tabIndex={0}>
          <dt>Andamento da obra</dt>
          <dd>{item.progress != null ? progressLabel(item.progress) : "Não informado"}</dd>
        </div>
        <div tabIndex={0}>
          <dt>Data de Entrega</dt>
          <dd>{formatDate(item.completionDate)}</dd>
        </div>
        {associative ? (
          <>
            <div tabIndex={0}>
              <dt>Avaliação bancária</dt>
              <dd>{item.appraisal != null ? money.format(item.appraisal) : "Não informada"}</dd>
            </div>
            <div tabIndex={0}>
              <dt>Volta ao caixa</dt>
              <dd>
                {item.cashBackSlack != null ? money.format(item.cashBackSlack) : "Não informada"}
              </dd>
            </div>
            <div tabIndex={0}>
              <dt>Outras Descrições</dt>
              <dd>{informationLabel(item.classification)}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </article>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function compactProductDescription(product: string, project: string) {
  const trimmedProduct = product.trim();
  const trimmedProject = project.trim();
  if (!trimmedProject) return trimmedProduct;
  const repeatedSuffix = ` - ${trimmedProject}`;
  return trimmedProduct
    .toLocaleLowerCase("pt-BR")
    .endsWith(repeatedSuffix.toLocaleLowerCase("pt-BR"))
    ? trimmedProduct.slice(0, -repeatedSuffix.length).trim()
    : trimmedProduct;
}

function inventoryKey(item: Pick<InventoryItem, "businessUnit" | "project" | "identifier">) {
  return [item.businessUnit, item.project, item.identifier ?? ""].join("|");
}

function inventoryProjectKey(item: Pick<InventoryItem, "businessUnit" | "project">) {
  return [item.businessUnit, item.project].join("|");
}

function inferLocation(identifier: string | null) {
  const digits = identifier?.match(/-(\d{3,5})$/)?.[1];
  if (!digits) return { floor: null, finalUnit: null };
  if (identifier?.startsWith("VG-")) return { floor: 0, finalUnit: Number(digits) };
  if (digits.length === 3)
    return { floor: Number(digits.slice(0, 1)), finalUnit: Number(digits.slice(1)) };
  return { floor: Number(digits.slice(0, 2)), finalUnit: Number(digits.slice(2)) };
}

function inferUnitType(product: string) {
  if (normalize(product).startsWith("vaga de garagem")) return "Vaga de Garagem";
  return product.split(" ")[0] || null;
}

function enrichInventory(items: InventoryItem[], reference: InventoryItem[]) {
  const referenceByKey = new Map(reference.map((item) => [inventoryKey(item), item]));
  const referenceByProject = new Map(reference.map((item) => [inventoryProjectKey(item), item]));
  return items.map((item) => {
    const source = referenceByKey.get(inventoryKey(item));
    const projectSource = referenceByProject.get(inventoryProjectKey(item));
    const inferred = inferLocation(item.identifier);
    const finalWithKit = item.finalWithKit ?? source?.finalWithKit ?? null;
    const unitBonus = item.unitBonus ?? source?.unitBonus ?? 0;
    const tableSlack = item.tableSlack ?? source?.tableSlack ?? 0;
    const cashBackSlack = item.cashBackSlack ?? source?.cashBackSlack ?? null;
    const finalPrice =
      finalWithKit != null
        ? Math.max(0, finalWithKit - (unitBonus + tableSlack))
        : (item.finalPrice ?? source?.finalPrice ?? null);
    return {
      ...item,
      finalWithKit,
      unitBonus,
      tableSlack,
      cashBackSlack,
      finalPrice,
      appraisal: item.appraisal ?? source?.appraisal ?? null,
      description: item.description ?? source?.description ?? null,
      floor: item.floor ?? source?.floor ?? inferred.floor,
      finalUnit: item.finalUnit ?? source?.finalUnit ?? inferred.finalUnit,
      parkingSpaces: item.parkingSpaces ?? source?.parkingSpaces ?? null,
      postalCode: item.postalCode ?? source?.postalCode ?? null,
      neighborhood:
        item.neighborhood ?? source?.neighborhood ?? projectSource?.neighborhood ?? null,
      district: item.district ?? source?.district ?? projectSource?.district ?? null,
      street: item.street ?? source?.street ?? projectSource?.street ?? null,
      streetNumber:
        item.streetNumber ?? source?.streetNumber ?? projectSource?.streetNumber ?? null,
      city: item.city ?? source?.city ?? projectSource?.city ?? null,
      state: item.state ?? source?.state ?? projectSource?.state ?? null,
      progress: item.progress ?? source?.progress ?? projectSource?.progress ?? null,
      region: item.region ?? source?.region ?? null,
      unitType: item.unitType ?? source?.unitType ?? inferUnitType(item.product),
    };
  });
}

export function InvestorCalculator({
  directTable = false,
  directVisualLayout = false,
}: {
  directTable?: boolean;
  directVisualLayout?: boolean;
}) {
  const usesDirectDesign = directTable || directVisualLayout;
  const annualMode = directVisualLayout;
  const tourSteps = directTable
    ? DIRECT_TABLE_TOUR_STEPS
    : directVisualLayout
      ? ASSOCIATIVE_TOUR_STEPS
      : INVESTOR_TOUR_STEPS;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const inventoryReference = useRef<InventoryItem[]>([]);
  const proposalGuideDialog = useRef<HTMLDialogElement>(null);
  const pfDocumentationDialog = useRef<HTMLDialogElement>(null);
  const pjDocumentationDialog = useRef<HTMLDialogElement>(null);
  const directPreKeysDialog = useRef<HTMLDialogElement>(null);
  const directAmortizationDialog = useRef<HTMLDialogElement>(null);
  const associativeInstallmentsDialog = useRef<HTMLDialogElement>(null);
  const associativeCommissionDialog = useRef<HTMLDialogElement>(null);
  const proposalTourTrigger = useRef<HTMLButtonElement>(null);
  const tourReturnFocus = useRef<HTMLButtonElement | null>(null);
  const tourPanel = useRef<HTMLElement>(null);
  const associativeQualificationSectionRef = useRef<HTMLElement>(null);
  const associativeFlowSectionRef = useRef<HTMLElement>(null);
  const guidedAttentionTimer = useRef<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourSpotlight, setTourSpotlight] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tourPlacement, setTourPlacement] = useState({ top: false, left: false });
  const [guidedAttention, setGuidedAttention] = useState<"qualification" | "flow" | null>(null);
  const [inventoryStatus, setInventoryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [inventoryMeta, setInventoryMeta] = useState<InventoryPayload | null>(null);
  const [businessUnit, setBusinessUnit] = useState("Todas");
  const [project, setProject] = useState("Todos");
  const [plant, setPlant] = useState("Todos");
  const [region, setRegion] = useState("Todas");
  const [salePriceFilter, setSalePriceFilter] = useState("Todos");
  const [priceSort, setPriceSort] = useState<"asc" | "desc">("asc");
  const [filterNotice, setFilterNotice] = useState("");
  const [visibleInventoryCount, setVisibleInventoryCount] = useState(75);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [discountAuthorized, setDiscountAuthorized] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [financing, setFinancing] = useState(annualMode ? "" : "0");
  const [subsidy, setSubsidy] = useState(annualMode ? "" : "0");
  const [fgts, setFgts] = useState(annualMode ? "" : "0");
  const [housingCheck, setHousingCheck] = useState(annualMode ? "" : "0");
  const [entryValue, setEntryValue] = useState("0");
  const [installments, setInstallments] = useState(
    annualMode ? "" : directVisualLayout ? "84" : "18",
  );
  const [income, setIncome] = useState("0");
  const [associativeManualModalityPreference, setAssociativeManualModalityPreference] =
    useState<FinancingModality | null>(null);
  const [associativeFirstProperty, setAssociativeFirstProperty] = useState("");
  const [associativeApprovalTier, setAssociativeApprovalTier] = useState("");
  const [documentationAppraisalOverride, setDocumentationAppraisalOverride] = useState("");
  const [signalFieldCount, setSignalFieldCount] = useState(0);
  const [signals, setSignals] = useState(["0", "0", "0"]);
  const [hiddenSignalIndexes, setHiddenSignalIndexes] = useState<number[]>([]);
  const [signalDistributionMode, setSignalDistributionMode] = useState<"auto" | "manual">("auto");
  const [intermediaryFieldCount, setIntermediaryFieldCount] = useState(0);
  const [intermediaries, setIntermediaries] = useState(() =>
    Array.from({ length: directTable ? 8 : annualMode ? 5 : 4 }, () => "0"),
  );
  const [hiddenIntermediaryIndexes, setHiddenIntermediaryIndexes] = useState<number[]>([]);
  const [selectedDirectOption, setSelectedDirectOption] = useState("");
  const [directIncomeNotice, setDirectIncomeNotice] = useState("");
  const [visibleScenarioCodes, setVisibleScenarioCodes] = useState<string[]>([]);
  const [expandedScenarioPlans, setExpandedScenarioPlans] = useState<number[]>([]);
  const [baseDate] = useState(todayIso);
  const signalInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const intermediaryInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const signalActionRef = useRef<HTMLButtonElement | null>(null);
  const intermediaryActionRef = useRef<HTMLButtonElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const directIncomeInputRef = useRef<HTMLInputElement | null>(null);
  const associativeIncomeInputRef = useRef<HTMLInputElement | null>(null);
  const associativeFinancingInputRef = useRef<HTMLInputElement | null>(null);
  const directIncomeReady = currencyInputNumber(income) > 0;
  const associativeIncomeReady = currencyInputNumber(income) > 0;
  const associativeFinancingDecision = useMemo(
    () =>
      evaluateFinancingModality({
        familyIncomeCents: moneyToCents(income),
        firstProperty: associativeFirstProperty || null,
        manualPreference: associativeManualModalityPreference,
        propertyValueCents: moneyToCents(salePrice),
        mcmvPropertyLimitCents: MCMV_PROPERTY_LIMIT_CENTS,
      }),
    [associativeFirstProperty, associativeManualModalityPreference, income, salePrice],
  );
  const associativeFinancingModality = associativeFinancingDecision.effectiveModality ?? "";
  const associativeFinancingModalityReady = Boolean(associativeFinancingModality);
  const associativeFinancingValueReady = currencyInputNumber(financing) > 0;
  const associativeSubsidyComplete = subsidy.trim() !== "";
  const associativeFgtsComplete = fgts.trim() !== "";
  const associativeHousingCheckComplete = housingCheck.trim() !== "";
  const associativeSubsidyUnlocked = annualMode && associativeFinancingValueReady;
  const associativeFgtsUnlocked = associativeSubsidyUnlocked && associativeSubsidyComplete;
  const associativeHousingCheckUnlocked = associativeFgtsUnlocked && associativeFgtsComplete;
  const associativeEntryUnlocked =
    associativeHousingCheckUnlocked && associativeHousingCheckComplete;
  const associativeQualificationComplete =
    !annualMode ||
    (associativeIncomeReady &&
      associativeFinancingModalityReady &&
      Boolean(associativeFirstProperty));
  const associativeQualificationLocked = annualMode && !associativeQualificationComplete;
  useEffect(() => {
    const openGuide = (event: Event) => {
      const trigger =
        (event as CustomEvent<{ trigger?: HTMLButtonElement }>).detail?.trigger ?? null;
      tourReturnFocus.current = trigger;
      setTourStep(0);
      setTourOpen(true);
    };
    window.addEventListener("investor:start-guide", openGuide);
    return () => window.removeEventListener("investor:start-guide", openGuide);
  }, []);

  useEffect(
    () => () => {
      if (guidedAttentionTimer.current !== null) window.clearTimeout(guidedAttentionTimer.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchInventory(), fetchInventory("/data/investor-inventory.json")])
      .then(([liveResult, referenceResult]) => {
        if (!active) return;
        const reference = referenceResult.status === "fulfilled" ? referenceResult.value.items : [];
        const payload = liveResult.status === "fulfilled"
          ? liveResult.value
          : referenceResult.status === "fulfilled" ? referenceResult.value : null;
        if (!payload) throw new Error("inventory_unavailable");
        inventoryReference.current = directTable
          ? reference
          : reference.filter(isInvestorEligibleUnit);
        const enrichedInventory = enrichInventory(payload.items, reference);
        setInventory(directTable ? enrichedInventory : enrichedInventory.filter(isInvestorEligibleUnit));
        setInventoryMeta(payload);
        setInventoryStatus("ready");
      })
      .catch(() => active && setInventoryStatus("error"));
    return () => {
      active = false;
    };
  }, [directTable]);

  const activeFilters = useMemo(
    () => ({ businessUnit, project, plant, region, salePrice: salePriceFilter }),
    [businessUnit, project, plant, region, salePriceFilter],
  );
  const filterOptions = useMemo(
    () => buildInvestorFilterOptions(inventory, activeFilters),
    [inventory, activeFilters],
  );
  const matchingInventory = useMemo(
    () =>
      sortInvestorInventoryBySalePrice(
        inventory.filter((item) => matchesInvestorFilters(item, activeFilters)),
        priceSort,
      ),
    [inventory, activeFilters, priceSort],
  );

  useEffect(() => {
    const reconciledFilters = reconcileInvestorFilters(inventory, activeFilters);
    const changedDimension = (
      ["businessUnit", "project", "plant", "region", "salePrice"] as const
    ).find((dimension) => reconciledFilters[dimension] !== activeFilters[dimension]);
    if (!changedDimension) return;

    const resetInvalidFilters = window.setTimeout(() => {
      setBusinessUnit(reconciledFilters.businessUnit);
      setProject(reconciledFilters.project);
      setPlant(reconciledFilters.plant);
      setRegion(reconciledFilters.region);
      setSalePriceFilter(reconciledFilters.salePrice);
      setFilterNotice("Uma seleção indisponível foi limpa após a atualização do estoque.");
    }, 0);
    return () => window.clearTimeout(resetInvalidFilters);
  }, [inventory, activeFilters]);

  const selectedUnit = useMemo(
    () => inventory.find((item) => item.id === selectedUnitId) ?? null,
    [inventory, selectedUnitId],
  );
  const result = useMemo(
    () =>
      directTable
        ? calculateDirectTableFileFlow({
            selectedUnitId,
            developmentName: selectedUnit?.project,
            businessUnit: selectedUnit?.businessUnit,
            product: selectedUnit?.product,
            plant: selectedUnit?.plant,
            description: selectedUnit?.description ?? selectedUnit?.classification,
            baseDate,
            completionDate,
            salePrice,
            discountAuthorized,
            discount,
            entryValue,
            income,
            signals,
            intermediaries,
          })
        : calculateInvestorFlow({
            selectedUnitId,
            baseDate,
            completionDate,
            salePrice,
            propertyValue: selectedUnit?.finalWithKit ?? salePrice,
            unitBonus: selectedUnit?.unitBonus ?? 0,
            tableSlack: selectedUnit?.tableSlack ?? 0,
            discountAuthorized,
            discount,
            financing,
            subsidy,
            fgts,
            housingCheck,
            entryValue,
            installments,
            annualMode,
            income,
            signals,
            intermediaries,
            approvalTierId: associativeApprovalTier,
          }),
    [
      directTable,
      annualMode,
      selectedUnitId,
      selectedUnit,
      baseDate,
      completionDate,
      salePrice,
      discountAuthorized,
      discount,
      financing,
      subsidy,
      fgts,
      housingCheck,
      entryValue,
      income,
      installments,
      signals,
      intermediaries,
      associativeApprovalTier,
    ],
  );
  const directAmortizationSchedule = useMemo(
    () =>
      directTable
        ? buildDirectTableAmortizationSchedule(
            result.custom.postKeysBalance,
            result.custom.firstPostKeysDate,
            result.custom.postKeysInstallments,
          )
        : [],
    [
      directTable,
      result.custom.postKeysBalance,
      result.custom.firstPostKeysDate,
      result.custom.postKeysInstallments,
    ],
  );
  const directPreKeysSchedule = useMemo(
    () =>
      directTable
        ? buildDirectTablePreKeysSchedule(
            result.custom.desiredInstallments * result.custom.installmentValue,
            result.custom.desiredInstallments,
            result.custom.firstPreKeysDate,
          )
        : [],
    [
      directTable,
      result.custom.desiredInstallments,
      result.custom.installmentValue,
      result.custom.firstPreKeysDate,
    ],
  );
  const associativeInstallmentSchedule = useMemo(
    () =>
      annualMode && result.custom.linear
        ? buildAssociativeInstallmentMemory({
            monthlyDates: result.context.monthlyDates,
            preInstallments: result.custom.preInstallments,
            postInstallments: result.custom.postInstallments,
            adjustedPre: result.custom.linear.adjustedPre,
            adjustedPost: result.custom.linear.adjustedPost,
            prePayment: result.custom.linear.prePayment,
            postPayment: result.custom.linear.postPayment,
          })
        : [],
    [
      annualMode,
      result.context.monthlyDates,
      result.custom.linear,
      result.custom.postInstallments,
      result.custom.preInstallments,
    ],
  );
  const associativePaymentComparison = useMemo(
    () =>
      buildAssociativePaymentComparison({
        monthlyDates: result.context.monthlyDates,
        installments: result.custom.desiredInstallments,
        linearSchedule: associativeInstallmentSchedule,
        decreasingBlocks: result.custom.decreasing?.blocks ?? [],
        income: currencyInputNumber(income),
        constructionProgress: selectedUnit?.progress ?? null,
        baseDate,
        completionDate,
        entryPayment:
          result.custom.actValue >= 150
            ? {
                kind: "entry",
                label: "Entrada",
                paymentDate: baseDate,
                value: result.custom.actValue,
              }
            : null,
        signals: result.custom.signals
          .filter(
            (signal: { active: boolean; approved: boolean; value: number }) =>
              signal.active && signal.approved && signal.value > 0,
          )
          .map((signal: { index: number; date: string; value: number }) => ({
            kind: "signal",
            label: `Sinal ${signal.index}`,
            paymentDate: signal.date,
            value: signal.value,
          })),
        annuals: result.custom.intermediaries
          .filter(
            (annual: { value: number; approved: boolean; correctedValue: number }) =>
              annual.value > 0 && annual.approved && annual.correctedValue > 0,
          )
          .map((annual: { index: number; date: string; correctedValue: number }) => ({
            index: annual.index,
            paymentDate: annual.date,
            correctedValue: annual.correctedValue,
            approved: true,
          })),
      }),
    [
      associativeInstallmentSchedule,
      baseDate,
      completionDate,
      income,
      result.context.monthlyDates,
      result.custom.actValue,
      result.custom.decreasing?.blocks,
      result.custom.desiredInstallments,
      result.custom.intermediaries,
      result.custom.signals,
      selectedUnit?.progress,
    ],
  );
  const signalsRequired = !annualMode && result.custom.actRate < 0.1;
  const associativeEntryPending = annualMode && currencyInputNumber(entryValue) <= 0;
  const associativeEntryRejected =
    annualMode && !associativeEntryPending && currencyInputNumber(entryValue) < 150;
  const associativeApprovalRule =
    ASSOCIATIVE_APPROVAL_TIERS.find((item) => item.id === associativeApprovalTier) ?? null;
  const associativeIncomeValue = currencyInputNumber(income);
  const associativeAnnualIncomeLimitRate = 0.5;
  const associativeAnnualIncomeLimit = associativeIncomeValue * associativeAnnualIncomeLimitRate;
  const associativeAnnualIncomeFailure =
    annualMode && associativeIncomeValue > 0
      ? result.custom.intermediaries.find(
          (item: { value: number }) => item.value > associativeAnnualIncomeLimit,
        )
      : undefined;
  const associativeBlockCounts = annualMode
    ? (result.custom.decreasing?.blocks?.map((block: { count: number }) => block.count) ?? [])
    : [];
  const associativeBlockDistributionError =
    annualMode &&
    result.custom.desiredInstallments > 0 &&
    (associativeBlockCounts.length !== 4 ||
      associativeBlockCounts.some((count: number) => count <= 0) ||
      associativeBlockCounts.reduce((total: number, count: number) => total + count, 0) !==
        result.custom.desiredInstallments)
      ? "A quantidade informada precisa formar os quatro blocos com pelo menos uma parcela em cada."
      : "";
  const associativeInstallmentsRejected =
    annualMode &&
    (!result.context.installmentsInteger ||
      result.custom.desiredInstallments < 1 ||
      result.custom.desiredInstallments > result.context.maxInstallments ||
      Boolean(associativeBlockDistributionError));
  const associativeEntryReady =
    annualMode && associativeEntryUnlocked && !associativeEntryPending && !associativeEntryRejected;
  const associativeInstallmentsUnlocked =
    annualMode && associativeFinancingValueReady && associativeEntryReady;
  const associativeInstallmentsReady =
    associativeInstallmentsUnlocked && !associativeInstallmentsRejected;
  const associativeRankingUnlocked = annualMode && associativeInstallmentsReady;
  const associativeApprovalDetailsUnlocked =
    associativeRankingUnlocked && Boolean(associativeApprovalTier);
  const associativeGuidanceStage = !associativeFinancingValueReady
    ? "financing"
    : !associativeSubsidyComplete
      ? "subsidy"
      : !associativeFgtsComplete
        ? "fgts"
        : !associativeHousingCheckComplete
          ? "housingCheck"
          : !associativeEntryReady
            ? "entry"
            : !associativeInstallmentsReady
              ? "installments"
              : !associativeApprovalTier
                ? "ranking"
                : "complete";
  const associativeCalculatedProposalLocked =
    annualMode &&
    (associativeQualificationLocked ||
      !associativeFinancingValueReady ||
      !associativeEntryReady ||
      !associativeInstallmentsReady);
  const associativeProposalMissingLabel = !associativeQualificationComplete
    ? "Conclua as 3 perguntas do perfil."
    : !associativeFinancingValueReady
      ? "Informe um financiamento maior que zero."
      : subsidy.trim() === ""
        ? "Informe o Subsídio; use zero quando não houver."
        : fgts.trim() === ""
          ? "Informe o FGTS; use zero quando não houver."
          : housingCheck.trim() === ""
            ? "Informe o Cheque Moradia; use zero quando não houver."
            : !associativeEntryReady
              ? "Informe uma entrada válida de no mínimo R$ 150,00."
              : !associativeInstallmentsReady
                ? "Informe uma quantidade válida de parcelas."
                : "Campos obrigatórios concluídos.";
  const associativeSignalFailure = annualMode
    ? result.custom.signals.find(
        (item: { active: boolean; approved: boolean }) => item.active && !item.approved,
      )
    : undefined;
  const associativeReleaseStatus = useMemo(
    () =>
      calculateAssociativeReleaseStatus({
        vgv: result.context.valueReal,
        entryValue: result.custom.actValue,
        entryDate: baseDate,
        referenceDate: baseDate,
        signals: result.custom.signals
          .filter((item: { active: boolean }) => item.active)
          .map((item: { value: number; date: string }) => ({ value: item.value, date: item.date })),
      }),
    [baseDate, result.context.valueReal, result.custom.actValue, result.custom.signals],
  );
  const associativeAnnualRuleFailure = annualMode
    ? result.custom.intermediaries.find(
        (item: { value: number; approved: boolean }) => item.value > 0 && !item.approved,
      )
    : undefined;
  const associativeProposalError = associativeEntryPending
    ? "Entrada: informe um valor para continuar."
    : associativeEntryRejected
      ? "Entrada: valor mínimo de R$ 150,00."
      : associativeSignalFailure
        ? `Sinal ${associativeSignalFailure.index}: ${associativeSignalFailure.reason}`
        : associativeAnnualRuleFailure
          ? `Anual ${associativeAnnualRuleFailure.index}: ${associativeAnnualRuleFailure.reason}`
          : associativeAnnualIncomeFailure
            ? `Anual ${associativeAnnualIncomeFailure.index}: ${money.format(associativeAnnualIncomeFailure.value)} supera ${percent.format(associativeAnnualIncomeLimitRate)} da renda familiar (${money.format(associativeAnnualIncomeLimit)}).`
            : associativeInstallmentsRejected
              ? associativeBlockDistributionError ||
                `Qtd. de parcelas: use um número inteiro entre 1 e ${result.context.maxInstallments}.`
              : !result.ok
                ? result.errors?.[0] || "Revise os campos destacados no Fluxo editável."
                : undefined;
  const activeSignalFieldCount = signals.reduce(
    (latest, value, index) => (currencyInputNumber(value) > 0 ? index + 1 : latest),
    0,
  );
  const signalVisibilityFloor = Math.max(
    signalFieldCount,
    activeSignalFieldCount,
    signalsRequired ? 1 : 0,
  );
  const visibleSignalIndexes = signals
    .map((_, index) => index)
    .filter((index) => index < signalVisibilityFloor && !hiddenSignalIndexes.includes(index));
  const visibleSignalCount = visibleSignalIndexes.length;
  const signalsVisible = visibleSignalCount > 0;
  const intermediaryFieldLimit = Math.min(
    intermediaries.length,
    result.context.intermediaryInputLimit,
  );
  const activeIntermediaryFieldCount = intermediaries.reduce(
    (latest, value, index) => (currencyInputNumber(value) > 0 ? index + 1 : latest),
    0,
  );
  const intermediaryVisibilityFloor = Math.min(
    intermediaryFieldLimit,
    Math.max(intermediaryFieldCount, activeIntermediaryFieldCount),
  );
  const visibleIntermediaryIndexes = intermediaries
    .map((_, index) => index)
    .filter(
      (index) => index < intermediaryVisibilityFloor && !hiddenIntermediaryIndexes.includes(index),
    );
  const visibleIntermediaryCount = visibleIntermediaryIndexes.length;
  const intermediariesVisible = visibleIntermediaryCount > 0;
  const missingForMinimumEntry = Math.max(
    0,
    result.context.valueReal * 0.1 - result.custom.totalEntryValue,
  );
  const validInstallmentSchedule = directTable
    ? result.context.maxInstallments > 0
    : result.custom.desiredInstallments > 0 &&
      result.custom.desiredInstallments <= result.context.maxInstallments;
  const firstInstallmentDate = validInstallmentSchedule
    ? (result.context.monthlyDates[0] ?? "")
    : "";
  const lastInstallmentDate = validInstallmentSchedule
    ? (result.context.monthlyDates[result.context.monthlyDates.length - 1] ?? "")
    : "";
  const associativeLinearUncorrected =
    annualMode && result.custom.desiredInstallments > 0
      ? result.custom.installmentBalanceBeforeCorrection / result.custom.desiredInstallments
      : 0;
  const associativePaymentSummaryAvailable =
    annualMode &&
    result.ok &&
    !associativeInstallmentsRejected &&
    Boolean(result.custom.decreasing?.ok) &&
    result.custom.installmentValue > 0;
  const activeSignalDates = result.custom.signals
    .filter(
      (item: { active: boolean; approved: boolean; date: string }) =>
        item.active && item.approved && item.date,
    )
    .map((item: { date: string }) => formatDate(item.date));
  const validIntermediaryDates = result.custom.intermediaries
    .filter(
      (item: { value: number; approved: boolean; date: string }) =>
        item.value > 0 && item.approved && item.date,
    )
    .map((item: { date: string }) => formatDate(item.date));
  const scenarioOptions: Record<
    string,
    { plan: number; title: string; description: string | null }
  > = annualMode ? ASSOCIATIVE_SCENARIO_OPTIONS : STANDARD_SCENARIO_OPTIONS;
  const scenarioPlans: readonly number[] = annualMode ? [84] : STANDARD_SCENARIO_PLANS;
  const selectedDirectProposalOption = directTable
    ? (DIRECT_TABLE_PROPOSAL_OPTIONS.find((option) => option.id === selectedDirectOption) ?? null)
    : null;
  const directProposalComparison = useMemo(() => {
    if (!directTable || !directIncomeReady || !selectedDirectProposalOption) return [];
    const optionNumber =
      DIRECT_TABLE_PROPOSAL_OPTIONS.findIndex(
        (option) => option.id === selectedDirectProposalOption.id,
      ) + 1;
    const preset = buildDirectTableProposalPreset(
      selectedDirectProposalOption.id,
      result.context.valueReal,
      { baseDate, completionDate, plant: selectedUnit?.plant ?? "" },
    );
    if (!preset || optionNumber <= 0) return [];

    return [
      {
        option: selectedDirectProposalOption,
        optionNumber,
        flow: calculateDirectTableFileFlow({
          selectedUnitId,
          developmentName: selectedUnit?.project,
          businessUnit: selectedUnit?.businessUnit,
          product: selectedUnit?.product,
          plant: selectedUnit?.plant,
          description: selectedUnit?.description ?? selectedUnit?.classification,
          baseDate,
          completionDate,
          salePrice,
          discountAuthorized,
          discount,
          entryValue: preset.entryValue,
          income,
          signals: preset.signals,
          intermediaries: preset.intermediaries,
        }),
      },
    ];
  }, [
    baseDate,
    completionDate,
    directIncomeReady,
    directTable,
    discount,
    discountAuthorized,
    income,
    result.context.valueReal,
    salePrice,
    selectedDirectProposalOption,
    selectedUnit?.businessUnit,
    selectedUnit?.classification,
    selectedUnit?.description,
    selectedUnit?.plant,
    selectedUnit?.product,
    selectedUnit?.project,
    selectedUnitId,
  ]);
  const directPreKeysRateLabel = percent.format(result.context.preKeysRate);
  const directPostKeysRateLabel = percent.format(result.context.postKeysRate);
  const directParkingPolicySummary = result.context.parkingPolicy
    ? `Política Vaga: 10% de entrada · ${directPreKeysRateLabel} durante a obra · ${directPostKeysRateLabel} pós-chaves em até ${result.custom.postKeysInstallments} parcelas`
    : "";
  const validDirectIntermediaryCount = result.custom.intermediaries.filter(
    (item: { value: number; approved: boolean }) => item.value > 0 && item.approved,
  ).length;
  const directIntermediaryPayments: DirectCalculationPayment[] =
    selectedDirectProposalOption?.withIntermediary
      ? result.custom.intermediaries
          .filter((item: { value: number }) => item.value > 0)
          .map(
            (item: {
              index: number;
              value: number;
              date: string;
              reason: string;
              approved: boolean;
            }) => ({
              key: `intermediary-${item.index}`,
              label: `Intermediária ${item.index}`,
              operator: item.approved ? "−" : "!",
              calculation: item.approved
                ? `${money.format(result.context.valueReal)} × ${percent.format(item.value / result.context.valueReal)}`
                : "Regra de 5% não aplicada",
              result: item.approved ? `− ${money.format(item.value)}` : "Não aplicada",
              amount: item.approved ? item.value : undefined,
              meta: item.approved ? `Pagamento em ${formatDate(item.date)}` : item.reason,
              invalid: !item.approved,
            }),
          )
      : [];
  const directReadyPayments: DirectCalculationPayment[] = selectedDirectProposalOption
    ? [
        {
          key: "property",
          label: "Valor real da venda",
          operator: "=",
          calculation: "",
          result: money.format(result.context.valueReal),
          amount: result.context.valueReal,
          meta: "Valor real usado como base para montar esta proposta.",
        },
        {
          key: "entry",
          label: "Ato",
          operator: "−",
          calculation: `${money.format(result.context.valueReal)} × ${percent.format(result.custom.actRate)}`,
          result: `− ${money.format(result.custom.actValue)}`,
          amount: result.custom.actValue,
          meta: `Pagamento em ${formatDate(baseDate)}`,
        },
        {
          key: "balance-after-entry",
          label: "Saldo após o ato",
          operator: "=",
          calculation: `${money.format(result.context.valueReal)} − ${money.format(result.custom.actValue)}`,
          result: money.format(result.context.valueReal - result.custom.actValue),
          amount: result.context.valueReal - result.custom.actValue,
          meta: "Valor restante após o pagamento inicial",
        },
        ...result.custom.signals
          .filter((signal: { active: boolean }) => signal.active)
          .map(
            (signal: {
              index: number;
              value: number;
              date: string;
              approved: boolean;
              reason: string;
            }) => ({
              key: `signal-${signal.index}`,
              label: `Sinal ${signal.index}`,
              operator: signal.approved ? "−" : "!",
              calculation: signal.approved
                ? `${money.format(result.context.valueReal)} × ${percent.format(signal.value / result.context.valueReal)}`
                : "Regra do sinal não aplicada",
              result: signal.approved ? `− ${money.format(signal.value)}` : "Não aplicado",
              amount: signal.approved ? signal.value : undefined,
              meta: signal.approved ? `Pagamento em ${formatDate(signal.date)}` : signal.reason,
              invalid: !signal.approved,
            }),
          ),
        ...(selectedDirectProposalOption.withIntermediary && directIntermediaryPayments.length === 0
          ? [
              {
                key: "intermediary-pending",
                label: "Intermediária",
                operator: "…",
                calculation: "Defina o valor",
                result: "Pendente",
                meta: "Complete no fluxo editável",
              },
            ]
          : directIntermediaryPayments),
        {
          key: "pre-keys-balance",
          label: "Saldo parcelado pré-chaves",
          operator: "−",
          calculation:
            result.custom.validIntermediaryTotal > 0
              ? `${money.format(result.context.valueReal)} × ${directPreKeysRateLabel} − ${money.format(result.custom.validIntermediaryTotal)}`
              : `${money.format(result.context.valueReal)} × ${directPreKeysRateLabel}`,
          result: `− ${money.format(result.custom.balance)}`,
          amount: result.custom.balance,
          meta:
            result.custom.validIntermediaryTotal > 0
              ? `${directPreKeysRateLabel} menos ${validDirectIntermediaryCount} ${validDirectIntermediaryCount === 1 ? "intermediária" : "intermediárias"} de 5%`
              : `${directPreKeysRateLabel} do valor do imóvel`,
        },
        {
          key: "pre-keys",
          label:
            result.custom.balance > 0
              ? `${result.custom.desiredInstallments} Mensais pré-chaves`
              : "Mensais pré-chaves",
          operator: result.custom.balance > 0 ? "÷" : "",
          calculation:
            result.custom.balance > 0
              ? `${money.format(result.custom.balance)} ÷ ${result.custom.desiredInstallments}`
              : "",
          result:
            result.custom.balance > 0
              ? money.format(result.custom.installmentValue)
              : "Dispensadas",
          amount: result.custom.balance > 0 ? result.custom.installmentValue : undefined,
          meta:
            result.custom.balance > 0
              ? `1ª parcela em ${formatDate(result.custom.firstPreKeysDate)}`
              : "Saldo quitado pelas intermediárias",
        },
        {
          key: "post-keys-balance",
          label: "Saldo financiado",
          operator: "=",
          calculation: `${money.format(result.context.valueReal)} × ${directPostKeysRateLabel}`,
          result: money.format(result.custom.postKeysBalance),
          amount: result.custom.postKeysBalance,
          meta: `Base para ${result.custom.postKeysInstallments} parcelas pós-chaves`,
        },
        {
          key: "post-keys",
          label: `${result.custom.postKeysInstallments} Parcelas mensais pós-chaves`,
          operator: "÷",
          calculation: "",
          result: money.format(result.custom.postKeysPayment),
          amount: result.custom.postKeysPayment,
          meta: `1ª parcela em ${formatDate(result.custom.firstPostKeysDate)}`,
          featured: true,
        },
        {
          key: "credit",
          label: "Status",
          operator: "",
          calculation: "",
          result:
            result.custom.income > 0
              ? `${percent.format(result.custom.commitment)} | ${result.custom.creditApproved ? "APROVADO" : "REPROVADO"}`
              : "Informe a renda",
          meta: "Limite de comprometimento: 40%",
        },
      ]
    : [];
  const directCalculationSteps = directReadyPayments.filter((payment) => payment.key !== "credit");
  const directCreditState =
    result.custom.income <= 0 ? "pending" : result.custom.creditApproved ? "approved" : "rejected";
  const directCreditLabel =
    result.custom.income <= 0
      ? "PENDENTE"
      : result.custom.creditApproved
        ? "APROVADO"
        : "REPROVADO";

  useEffect(() => {
    if (directTable) return;
    const limit = result.context.maxInstallments;
    if (limit > 0 && Number(installments) > limit) {
      const clampInstallments = window.setTimeout(() => setInstallments(String(limit)), 0);
      return () => window.clearTimeout(clampInstallments);
    }
  }, [directTable, installments, result.context.maxInstallments]);

  useEffect(() => {
    if (directTable || annualMode || signalDistributionMode !== "auto") return;
    const distributed = distributeSignalBalance(result.context.valueReal, entryValue);
    const activeCount = distributed.filter((value: number) => value > 0).length;
    const applyDistribution = window.setTimeout(() => {
      setSignals(distributed.map((value: number) => (value > 0 ? value.toFixed(2) : "0")));
      setSignalFieldCount(activeCount);
    }, 0);
    return () => window.clearTimeout(applyDistribution);
  }, [
    directTable,
    annualMode,
    entryValue,
    result.context.valueReal,
    result.custom.actRate,
    signalDistributionMode,
  ]);

  useEffect(() => {
    if (
      intermediaryFieldCount <= intermediaryFieldLimit &&
      intermediaries
        .slice(intermediaryFieldLimit)
        .every((value) => currencyInputNumber(value) === 0)
    )
      return;

    const reconcileIntermediaryFields = window.setTimeout(() => {
      setIntermediaryFieldCount((current) => Math.min(current, intermediaryFieldLimit));
      setIntermediaries((current) =>
        current.map((value, index) => (index < intermediaryFieldLimit ? value : "0")),
      );
    }, 0);
    return () => window.clearTimeout(reconcileIntermediaryFields);
  }, [intermediaries, intermediaryFieldCount, intermediaryFieldLimit]);

  useEffect(() => {
    if (!tourOpen) return;

    const currentTarget = document.querySelector<HTMLElement>(
      `[data-tour="${tourSteps[tourStep].target}"]`,
    );
    if (!currentTarget) return;

    let spotlightFrame = 0;
    const updateSpotlight = () => {
      const rect = currentTarget.getBoundingClientRect();
      const gutter = window.innerWidth <= 760 ? 6 : 10;
      setTourSpotlight({
        top: Math.max(gutter, rect.top - gutter),
        left: Math.max(gutter, rect.left - gutter),
        width: Math.min(window.innerWidth - gutter * 2, rect.width + gutter * 2),
        height: Math.min(window.innerHeight - gutter * 2, rect.height + gutter * 2),
      });
      setTourPlacement({
        top: rect.top + rect.height / 2 > window.innerHeight / 2,
        left: rect.left + rect.width / 2 > window.innerWidth / 2,
      });
    };
    const scheduleSpotlight = () => {
      if (spotlightFrame) return;
      spotlightFrame = window.requestAnimationFrame(() => {
        spotlightFrame = 0;
        updateSpotlight();
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const popupControl =
        event.target instanceof Element ? event.target.closest("select,[aria-haspopup]") : null;
      if (event.defaultPrevented || popupControl) return;
      if (event.key === "Escape") closeGuidedTour();
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stockScroller = currentTarget.closest<HTMLElement>(".investor-stock-results");
    const previousScrollLeft = stockScroller?.scrollLeft ?? 0;

    currentTarget.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
    if (stockScroller) stockScroller.scrollLeft = previousScrollLeft;
    const focusFrame = window.requestAnimationFrame(() => {
      scheduleSpotlight();
      tourPanel.current?.focus({ preventScroll: true });
    });
    const resizeObserver = new ResizeObserver(scheduleSpotlight);
    resizeObserver.observe(currentTarget);
    window.addEventListener("resize", scheduleSpotlight);
    window.addEventListener("scroll", scheduleSpotlight, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (spotlightFrame) window.cancelAnimationFrame(spotlightFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSpotlight);
      window.removeEventListener("scroll", scheduleSpotlight, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [tourOpen, tourStep, tourSteps]);

  useEffect(() => {
    if (tourOpen && !selectedUnit && tourStep > 3) {
      const returnToInventory = window.setTimeout(() => setTourStep(3), 0);
      return () => window.clearTimeout(returnToInventory);
    }
  }, [selectedUnit, tourOpen, tourStep]);

  function startProposalGuidedTour() {
    const proposalStart = tourSteps.findIndex((step) => step.target === "property-summary");
    tourReturnFocus.current = proposalTourTrigger.current;
    setTourStep(proposalStart >= 0 ? proposalStart : 0);
    setTourOpen(true);
  }

  function closeGuidedTour() {
    setTourOpen(false);
    window.requestAnimationFrame(() => tourReturnFocus.current?.focus());
  }

  function showPreviousTourStep() {
    setTourStep((current) => Math.max(0, current - 1));
  }

  function showNextTourStep() {
    if (tourStep === tourSteps.length - 1) {
      closeGuidedTour();
      return;
    }
    setTourStep((current) => Math.min(tourSteps.length - 1, current + 1));
  }

  function guideToSection(target: "qualification" | "flow") {
    if (!annualMode) return;
    const section =
      target === "qualification"
        ? associativeQualificationSectionRef.current
        : associativeFlowSectionRef.current;
    if (!section) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (guidedAttentionTimer.current !== null) window.clearTimeout(guidedAttentionTimer.current);
    setGuidedAttention(target);
    section.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
    window.requestAnimationFrame(() => section.focus({ preventScroll: true }));
    guidedAttentionTimer.current = window.setTimeout(() => {
      setGuidedAttention(null);
      guidedAttentionTimer.current = null;
    }, 3400);
  }

  function focusNextAssociativeRow(event: ReactKeyboardEvent<HTMLOListElement>) {
    if (
      event.key !== "Enter" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    const currentInput = event.target;
    if (!(currentInput instanceof HTMLInputElement)) return;
    const ledger = event.currentTarget;
    const currentRow = currentInput.closest("li");
    const currentRowIndex = currentRow ? Array.from(ledger.children).indexOf(currentRow) : -1;
    if (currentRowIndex < 0) return;
    event.preventDefault();
    window.requestAnimationFrame(() => {
      const nextInput = Array.from(ledger.children)
        .slice(currentRowIndex + 1)
        .map((row) =>
          row.querySelector<HTMLInputElement>('input:not([disabled]):not([type="hidden"])'),
        )
        .find((input): input is HTMLInputElement => Boolean(input));
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
        return;
      }
      ledger
        .closest(".investor-associative-workspace")
        ?.querySelector<HTMLSelectElement>(
          'select[name="classificacao-associativo"]:not([disabled])',
        )
        ?.focus();
    });
  }

  function selectUnit(item: InventoryItem) {
    setSelectedUnitId(item.id);
    setDocumentationAppraisalOverride("");
    setSalePrice(item.finalPrice ? String(item.finalPrice) : "");
    setCompletionDate(item.completionDate ?? "");
    setDiscountAuthorized(false);
    setDiscount("0");
    setFinancing(annualMode ? "" : "0");
    setSubsidy(annualMode ? "" : "0");
    setFgts(annualMode ? "" : "0");
    setHousingCheck(annualMode ? "" : "0");
    setEntryValue(
      annualMode ? "" : item.finalPrice ? (Math.ceil(item.finalPrice * 10) / 100).toFixed(2) : "0",
    );
    setInstallments(annualMode ? "" : directVisualLayout ? "84" : "18");
    setIncome("0");
    setAssociativeManualModalityPreference(null);
    setAssociativeFirstProperty("");
    setAssociativeApprovalTier("");
    setSignalFieldCount(0);
    setSignals(["0", "0", "0"]);
    setHiddenSignalIndexes([]);
    setSignalDistributionMode(directTable || annualMode ? "manual" : "auto");
    setIntermediaryFieldCount(0);
    setIntermediaries(Array.from({ length: directTable ? 8 : annualMode ? 5 : 4 }, () => "0"));
    setHiddenIntermediaryIndexes([]);
    setSelectedDirectOption(directTable ? DIRECT_TABLE_PROPOSAL_OPTIONS[0].id : "");
    setVisibleScenarioCodes([]);
    setExpandedScenarioPlans([]);
    if (tourOpen) {
      if (annualMode) setTourOpen(false);
      else
        setTourStep((current) =>
          tourSteps[current].target === "inventory" ? current + 1 : current,
        );
    }
    if (annualMode) window.setTimeout(() => guideToSection("qualification"), 0);
  }

  function updateSignal(index: number, value: string) {
    setSignalDistributionMode("manual");
    setHiddenSignalIndexes((current) => current.filter((item) => item !== index));
    setSignals((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function updateEntryValue(value: string) {
    setSignalDistributionMode(directTable || annualMode ? "manual" : "auto");
    setEntryValue(value);
  }

  function updateIncome(value: string) {
    setIncome(value);
    if (currencyInputNumber(value) > 0) setDirectIncomeNotice("");
    else if (directTable) setDirectProposalPreset(DIRECT_TABLE_PROPOSAL_OPTIONS[0].id);
  }

  function updateAssociativeIncome(value: string) {
    updateIncome(value);
    if (currencyInputNumber(value) <= 0) {
      setAssociativeManualModalityPreference(null);
      setAssociativeFirstProperty("");
      setAssociativeApprovalTier("");
    }
  }

  function updateAssociativeModality(value: string) {
    if (value === "MCMV" && associativeFinancingDecision.forced) return;
    setAssociativeManualModalityPreference(value === "MCMV" || value === "SBPE" ? value : null);
    if (!value) setAssociativeFirstProperty("");
  }

  function updateAssociativeFirstProperty(value: string) {
    setAssociativeFirstProperty(value);
    if (value) window.setTimeout(() => guideToSection("flow"), 0);
  }

  function addSignalField() {
    const nextIndex = signals.findIndex((_, index) => !visibleSignalIndexes.includes(index));
    if (nextIndex < 0) return;
    setHiddenSignalIndexes((current) => current.filter((item) => item !== nextIndex));
    setSignalFieldCount((current) => Math.max(current, nextIndex + 1));
    window.requestAnimationFrame(() => signalInputRefs.current[nextIndex]?.focus());
  }

  function hideSignalField(index: number) {
    setSignalDistributionMode("manual");
    const dependentIndexes = signals
      .map((_, itemIndex) => itemIndex)
      .filter((itemIndex) => itemIndex >= index);
    setSignals((current) => current.map((item, itemIndex) => (itemIndex >= index ? "0" : item)));
    setSignalFieldCount((current) => Math.min(current, index));
    setHiddenSignalIndexes((current) => Array.from(new Set([...current, ...dependentIndexes])));
    window.requestAnimationFrame(() => signalActionRef.current?.focus());
  }

  function clearSignalFields() {
    setSignalDistributionMode("manual");
    setSignalFieldCount(0);
    setSignals(["0", "0", "0"]);
    setHiddenSignalIndexes([]);
    window.requestAnimationFrame(() => signalActionRef.current?.focus());
  }

  function addIntermediaryField() {
    const nextIndex = intermediaries.findIndex(
      (_, index) => index < intermediaryFieldLimit && !visibleIntermediaryIndexes.includes(index),
    );
    if (nextIndex < 0) return;
    setHiddenIntermediaryIndexes((current) => current.filter((item) => item !== nextIndex));
    setIntermediaryFieldCount((current) => Math.max(current, nextIndex + 1));
    window.requestAnimationFrame(() => intermediaryInputRefs.current[nextIndex]?.focus());
  }

  function hideIntermediaryField(index: number) {
    setIntermediaries((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? "0" : item)),
    );
    setHiddenIntermediaryIndexes((current) =>
      current.includes(index) ? current : [...current, index],
    );
    window.requestAnimationFrame(() => intermediaryActionRef.current?.focus());
  }

  function clearIntermediaryFields() {
    setIntermediaryFieldCount(0);
    setIntermediaries(Array.from({ length: directTable ? 8 : annualMode ? 5 : 4 }, () => "0"));
    setHiddenIntermediaryIndexes([]);
    window.requestAnimationFrame(() => intermediaryActionRef.current?.focus());
  }

  function applyDirectProposalOption(optionId: string) {
    if (!directIncomeReady) {
      setDirectIncomeNotice("Informe a renda mensal para liberar as quatro opções prontas.");
      window.requestAnimationFrame(() => directIncomeInputRef.current?.focus());
      return;
    }
    setDirectProposalPreset(optionId);
  }

  function setDirectProposalPreset(optionId: string) {
    const preset = buildDirectTableProposalPreset(optionId, result.context.valueReal, {
      baseDate,
      completionDate,
      plant: selectedUnit?.plant ?? "",
    });
    if (!preset) return;
    setSelectedDirectOption(optionId);
    setEntryValue(preset.entryValue.toFixed(2));
    setSignalDistributionMode("manual");
    setSignals(preset.signals.map((value: number) => (value > 0 ? value.toFixed(2) : "0")));
    setSignalFieldCount(preset.signalFieldCount);
    setHiddenSignalIndexes([]);
    setIntermediaries(
      preset.intermediaries.map((value: number) => (value > 0 ? value.toFixed(2) : "0")),
    );
    setIntermediaryFieldCount(preset.intermediaryFieldCount);
    setHiddenIntermediaryIndexes([]);
  }

  function toggleDiscountField() {
    if (discountAuthorized) {
      setDiscountAuthorized(false);
      setDiscount("0");
      return;
    }
    setDiscountAuthorized(true);
    window.requestAnimationFrame(() => discountInputRef.current?.focus());
  }

  function clearFilters() {
    setBusinessUnit("Todas");
    setProject("Todos");
    setPlant("Todos");
    setRegion("Todas");
    setSalePriceFilter("Todos");
    setPriceSort("asc");
    setVisibleInventoryCount(75);
    setFilterNotice("");
    setSelectedUnitId("");
    setDocumentationAppraisalOverride("");
  }

  function updateIntermediary(index: number, value: string) {
    setHiddenIntermediaryIndexes((current) => current.filter((item) => item !== index));
    setIntermediaries((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function toggleScenarioOption(code: string) {
    setVisibleScenarioCodes((current) => (current[0] === code ? [] : [code]));
  }

  function toggleScenarioPlan(plan: number) {
    setExpandedScenarioPlans((current) =>
      current.includes(plan) ? current.filter((item) => item !== plan) : [...current, plan],
    );
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setVisibleInventoryCount(75);
    setFilterNotice("");
    setSelectedUnitId("");
    setDocumentationAppraisalOverride("");
  }

  function applyAssociativeProSolutoSuggestion(suggestion: {
    entry: number;
    signals: number[];
    signalCount: number;
  }) {
    setSignalDistributionMode("manual");
    setEntryValue(suggestion.entry.toFixed(2));
    setSignals(suggestion.signals.map((value) => (value > 0 ? value.toFixed(2) : "0")));
    setSignalFieldCount(suggestion.signalCount);
    setHiddenSignalIndexes([]);
  }

  function buildAssociativeFlowSuggestion(flow: AssociativeFlow): AssociativeFlowSuggestion | null {
    if (!associativeApprovalRule || associativeApprovalRule.id === "not-eligible") return null;

    const currentEntry = currencyInputNumber(entryValue);
    const currentSignals = signals.map(currencyInputNumber);
    const currentAnnuals = intermediaries.map(currencyInputNumber);
    const annualEligible = result.custom.intermediaries.map((item: { date: string }) =>
      Boolean(
        item.date &&
        baseDate &&
        completionDate &&
        item.date >= baseDate &&
        item.date <= completionDate,
      ),
    );
    return findAssociativeApprovalPlan({
      currentInstallments: Math.trunc(currencyInputNumber(installments)) || 1,
      maximumInstallments: Math.min(84, result.context.maxInstallments || 84),
      currentAnnuals,
      annualEligible,
      annualMaximum: currencyInputNumber(income) * 0.5,
      currentEntry,
      currentSignals,
      maximumPaymentAdditional: Math.max(0, result.custom.balanceBeforeCorrection - 0.01),
      evaluate: (candidate: {
        installments: number;
        annuals: number[];
        entry: number;
        signals: number[];
      }) => {
        const candidateEntry = candidate.entry.toFixed(2);
        const candidateSignals = candidate.signals.map((value) => value.toFixed(2));
        const candidateAnnuals = candidate.annuals.map((value) => value.toFixed(2));
        const candidateResult = calculateInvestorFlow({
          selectedUnitId,
          baseDate,
          completionDate,
          salePrice,
          propertyValue: selectedUnit?.finalWithKit ?? salePrice,
          unitBonus: selectedUnit?.unitBonus ?? 0,
          tableSlack: selectedUnit?.tableSlack ?? 0,
          discountAuthorized: false,
          discount: 0,
          financing,
          subsidy,
          fgts,
          housingCheck,
          entryValue: candidateEntry,
          installments: String(candidate.installments),
          annualMode: true,
          income,
          signals: candidateSignals,
          intermediaries: candidateAnnuals,
          approvalTierId: associativeApprovalTier,
        });
        if (!candidateResult.custom.linear || !candidateResult.custom.decreasing?.ok) {
          return { valid: false, approved: false };
        }

        const candidateLinearSchedule = buildAssociativeInstallmentMemory({
          monthlyDates: candidateResult.context.monthlyDates,
          preInstallments: candidateResult.custom.preInstallments,
          postInstallments: candidateResult.custom.postInstallments,
          adjustedPre: candidateResult.custom.linear.adjustedPre,
          adjustedPost: candidateResult.custom.linear.adjustedPost,
          prePayment: candidateResult.custom.linear.prePayment,
          postPayment: candidateResult.custom.linear.postPayment,
        });
        const candidateComparison = buildAssociativePaymentComparison({
          monthlyDates: candidateResult.context.monthlyDates,
          installments: candidateResult.custom.desiredInstallments,
          linearSchedule: candidateLinearSchedule,
          decreasingBlocks: candidateResult.custom.decreasing.blocks,
          income: currencyInputNumber(income),
          constructionProgress: selectedUnit?.progress ?? null,
          baseDate,
          completionDate,
          entryPayment: {
            kind: "entry",
            label: "Entrada",
            paymentDate: baseDate,
            value: candidate.entry,
          },
          signals: candidateResult.custom.signals
            .filter(
              (signal: { active: boolean; approved: boolean; value: number }) =>
                signal.active && signal.approved && signal.value > 0,
            )
            .map((signal: { index: number; date: string; value: number }) => ({
              kind: "signal",
              label: `Sinal ${signal.index}`,
              paymentDate: signal.date,
              value: signal.value,
            })),
          annuals: candidateResult.custom.intermediaries
            .filter(
              (annual: { value: number; approved: boolean; correctedValue: number }) =>
                annual.value > 0 && annual.approved && annual.correctedValue > 0,
            )
            .map((annual: { index: number; date: string; correctedValue: number }) => ({
              index: annual.index,
              paymentDate: annual.date,
              correctedValue: annual.correctedValue,
              approved: true,
            })),
        });
        const candidateApproval = calculateAssociativeApproval({
          tierId: associativeApprovalTier,
          income: currencyInputNumber(income),
          realSaleValue: candidateResult.context.valueReal,
          proSoluto: candidateResult.custom.balanceBeforeCorrection,
          linearInstallment: candidateComparison.highestLinearPayment,
          decreasingInstallment: candidateComparison.highestDecreasingPayment,
          linearMaximumIncomePayment: candidateComparison.highestLinearTotal,
          decreasingMaximumIncomePayment: candidateComparison.highestDecreasingTotal,
          proposalValid: candidateResult.ok,
          paymentComparisonValid: candidateComparison.comparisonAvailable,
        });
        const commitmentRate =
          flow === "linear"
            ? candidateApproval.linearCommitmentRate
            : candidateApproval.decreasingCommitmentRate;
        const maximumIncomeRate =
          flow === "linear"
            ? candidateApproval.linearMaximumIncomeRate
            : candidateApproval.decreasingMaximumIncomeRate;
        const valid = candidateResult.ok && candidateComparison.comparisonAvailable;
        return {
          valid,
          approved:
            valid &&
            candidateApproval.proSolutoRate <= associativeApprovalRule.proSolutoRate &&
            commitmentRate <= associativeApprovalRule.commitmentRate &&
            maximumIncomeRate <= associativeApprovalRule.annualIncomeLimitRate,
        };
      },
    }) as AssociativeFlowSuggestion | null;
  }

  function applyAssociativeFlowSuggestion(
    _flow: AssociativeFlow,
    suggestion: AssociativeFlowSuggestion,
  ) {
    setInstallments(String(suggestion.installments));
    setIntermediaries(suggestion.annuals.map((value) => (value > 0 ? value.toFixed(2) : "0")));
    setIntermediaryFieldCount(
      suggestion.annuals.reduce((latest, value, index) => (value > 0 ? index + 1 : latest), 0),
    );
    setHiddenIntermediaryIndexes([]);
    applyAssociativeProSolutoSuggestion(suggestion);
  }

  function renderCalculatedProposal() {
    return (
      <section
        className={`investor-standard-panel ${directTable ? "investor-direct-combined-panel" : directVisualLayout ? "investor-associative-direct-panel" : ""}${associativeCalculatedProposalLocked ? "is-locked" : ""}${annualMode && associativeQualificationComplete && !associativeFinancingValueReady ? "is-awaiting-financing" : ""}`}
        aria-labelledby={
          directTable
            ? "investor-direct-income-title investor-standard-title"
            : "investor-standard-title"
        }
        data-locked={associativeCalculatedProposalLocked || undefined}
        data-tour="scenarios"
      >
        {!directTable ? (
          <header className="investor-section-heading investor-standard-heading">
            <span>{annualMode ? "04" : "02"}</span>
            <div>
              <p>Proposta calculada</p>
              <h2 id="investor-standard-title">
                {directVisualLayout ? "1 plano · 4 opções" : "2 cenários · 8 opções"}
              </h2>
            </div>
            <div className="investor-standard-actions">
              <InvestorInfoHint
                label="propostas prontas"
                title="Como funcionam as propostas prontas?"
                description={
                  directVisualLayout
                    ? "Contém 4 propostas prontas em 84 parcelas. Escolha entre combinações com ou sem sinais e anuais. Cada opção abre a memória vertical da composição."
                    : "Contém 8 propostas prontas: 4 com 18 parcelas e 4 com 24 parcelas. Escolha entre combinações com ou sem sinais e intermediárias. Cada opção detalha entrada, pagamentos, saldo e primeira mensal."
                }
              />
              <button
                className="investor-standard-print"
                type="button"
                disabled={visibleScenarioCodes.length === 0 || associativeCalculatedProposalLocked}
                onClick={() => window.print()}
                aria-label={
                  visibleScenarioCodes.length === 0
                    ? "Abra uma opção para imprimir"
                    : "Imprimir as opções abertas"
                }
                title={
                  visibleScenarioCodes.length === 0
                    ? "Abra pelo menos uma opção para imprimir"
                    : "Imprimir as opções abertas"
                }
              >
                Imprimir
              </button>
            </div>
          </header>
        ) : null}
        {associativeCalculatedProposalLocked ? (
          <div
            className={`investor-associative-section-lock${associativeQualificationComplete ? "awaiting-financing" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">
              {associativeQualificationComplete ? "PRÓXIMA AÇÃO" : "BLOQUEADO"}
            </span>
            <div>
              <strong>Proposta calculada bloqueada</strong>
              <small>
                {associativeProposalMissingLabel} Renda, financiamento, recursos e quantidade de
                parcelas precisam estar confirmados.
              </small>
            </div>
            <button
              type="button"
              onClick={() =>
                associativeQualificationComplete
                  ? associativeFinancingInputRef.current?.focus()
                  : associativeIncomeInputRef.current?.focus()
              }
            >
              {associativeQualificationComplete ? "Ir ao fluxo" : "Responder perguntas"}
            </button>
          </div>
        ) : null}
        <fieldset
          className="investor-associative-gated-fieldset"
          disabled={associativeCalculatedProposalLocked}
          aria-disabled={associativeCalculatedProposalLocked || undefined}
        >
          <legend className="sr-only">Propostas calculadas disponíveis</legend>
          {directTable ? (
            <>
              <div className="investor-direct-five-card-headings">
                <header className="investor-section-heading investor-standard-heading investor-direct-income-heading">
                  <span>02</span>
                  <div>
                    <p id="investor-direct-income-title">Informe a renda</p>
                  </div>
                </header>
                <header className="investor-section-heading investor-standard-heading investor-direct-choice-heading">
                  <span>03</span>
                  <div>
                    <p>Escolha rápida</p>
                    <h2 id="investor-standard-title">4 opções prontas disponíveis</h2>
                  </div>
                </header>
              </div>
              <div
                className="investor-direct-five-card-grid"
                role="group"
                aria-label="Renda e opções de proposta da Tabela Direta"
              >
                <label
                  className="investor-installments-field investor-direct-income-card"
                  data-tour="income"
                >
                  <span className="investor-installments-heading">
                    <span>Renda mensal</span>
                  </span>
                  <MoneyInput
                    inputRef={directIncomeInputRef}
                    label="Renda mensal"
                    describedBy="investor-income-guidance"
                    value={income}
                    onChange={updateIncome}
                  />
                </label>
                <span className="sr-only" id="investor-income-guidance">
                  Informe a renda mensal real para validar o comprometimento máximo de 40%.
                </span>
                <div className="investor-direct-ready-options" data-tour="ready-options">
                  {DIRECT_TABLE_PROPOSAL_OPTIONS.map((option, index) => (
                    <div
                      key={option.id}
                      className="investor-scenario-plan"
                      data-scenario={(index % 2) + 1}
                    >
                      <button
                        type="button"
                        aria-labelledby={`investor-direct-option-${index}-title`}
                        aria-describedby={`investor-direct-option-${index}-entry investor-direct-option-${index}-details${directIncomeNotice ? " investor-direct-income-notice" : ""}`}
                        aria-pressed={selectedDirectOption === option.id}
                        aria-disabled={!directIncomeReady}
                        onClick={() => applyDirectProposalOption(option.id)}
                      >
                        <span className="investor-direct-option-number" aria-hidden="true">
                          0{index + 1}
                        </span>
                        <strong id={`investor-direct-option-${index}-title`}>{option.title}</strong>
                        <span
                          id={`investor-direct-option-${index}-entry`}
                          className="investor-direct-option-entry"
                        >
                          {option.entrySummary}
                        </span>
                        <small id={`investor-direct-option-${index}-details`}>
                          {option.signalSummary}
                          <br />
                          {option.intermediarySummary}
                        </small>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {directIncomeNotice ? (
                <p
                  id="investor-direct-income-notice"
                  className="investor-direct-income-notice"
                  role="alert"
                >
                  {directIncomeNotice}
                </p>
              ) : null}
              <div className="investor-scenario-stack" aria-live="polite">
                {directIncomeReady && selectedDirectProposalOption ? (
                  <section
                    className="investor-scenario-group investor-scenario-option-panel investor-direct-option-panel"
                    data-scenario={selectedDirectProposalOption.withSignals ? 2 : 1}
                  >
                    <div className="investor-scenario-grid">
                      <article>
                        <section
                          className="investor-direct-calculation"
                          aria-label={`${selectedDirectProposalOption.label}: proposta pronta`}
                        >
                          <div className="investor-direct-calculation-body">
                            {directProposalComparison.length > 0 ? (
                              <div
                                className="investor-direct-comparison-grid is-single"
                                role="region"
                                aria-label={`${selectedDirectProposalOption.label}: composição completa`}
                              >
                                {directProposalComparison.map(({ option, flow, optionNumber }) => (
                                  <DirectProposalComparisonCard
                                    key={option.id}
                                    option={option}
                                    flow={flow}
                                    optionNumber={optionNumber}
                                    active={selectedDirectOption === option.id}
                                    baseDate={baseDate}
                                    policySummary={directParkingPolicySummary}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div
                                className="investor-direct-account investor-associative-compact-account investor-direct-ready-account"
                                role="region"
                                tabIndex={0}
                                aria-label={`${selectedDirectProposalOption.label}: memória de cálculo em formato de conta`}
                              >
                                <ol>
                                  {directCalculationSteps.map((payment, index) => {
                                    const help = associativeHelp(
                                      payment.meta,
                                      payment.calculation
                                        ? `Cálculo: ${payment.calculation}.`
                                        : null,
                                    );
                                    const action =
                                      payment.key === "pre-keys" && result.custom.balance > 0 ? (
                                        <button
                                          type="button"
                                          className="investor-info-trigger investor-direct-dialog-trigger"
                                          aria-label="Ver parcelas pré-chaves"
                                          title="Ver parcelas pré-chaves"
                                          aria-haspopup="dialog"
                                          aria-controls="investor-direct-pre-keys"
                                          onClick={() => directPreKeysDialog.current?.showModal()}
                                        >
                                          <span className="investor-info-mark" aria-hidden="true" />
                                        </button>
                                      ) : payment.key === "post-keys" ? (
                                        <button
                                          type="button"
                                          className="investor-info-trigger investor-direct-dialog-trigger"
                                          aria-label={`Ver amortização das ${result.custom.postKeysInstallments} parcelas pós-chaves`}
                                          title={`Ver amortização das ${result.custom.postKeysInstallments} parcelas pós-chaves`}
                                          aria-haspopup="dialog"
                                          aria-controls="investor-direct-amortization"
                                          onClick={() =>
                                            directAmortizationDialog.current?.showModal()
                                          }
                                        >
                                          <span className="investor-info-mark" aria-hidden="true" />
                                        </button>
                                      ) : undefined;
                                    return (
                                      <DirectEditableAccountRow
                                        key={payment.key}
                                        number={index + 1}
                                        operator={payment.operator}
                                        label={payment.label}
                                        meta={payment.meta}
                                        calculation={
                                          <DirectReadyLedgerValue
                                            label={payment.label}
                                            amount={payment.amount}
                                            text={payment.result}
                                            help={help}
                                            action={action}
                                          />
                                        }
                                        total={payment.featured}
                                        invalid={payment.invalid}
                                        twoColumn
                                      />
                                    );
                                  })}
                                </ol>
                              </div>
                            )}
                          </div>
                        </section>
                      </article>
                    </div>
                  </section>
                ) : null}
              </div>
              <DirectPreKeysDialog
                dialogRef={directPreKeysDialog}
                principal={result.custom.desiredInstallments * result.custom.installmentValue}
                schedule={directPreKeysSchedule}
              />
              <DirectAmortizationDialog
                dialogRef={directAmortizationDialog}
                principal={result.custom.postKeysBalance}
                schedule={directAmortizationSchedule}
              />
              <p className="investor-scenario-order">
                {!directIncomeReady
                  ? "A opção 01 e o fluxo editável abaixo estão visíveis como referência, mas permanecem congelados até você informar a renda."
                  : selectedDirectProposalOption
                    ? "Confira a proposta pronta e ajuste os valores no fluxo editável abaixo."
                    : "Escolha uma opção para exibir a proposta pronta."}
              </p>
            </>
          ) : (
            <>
              {directVisualLayout ? (
                <div
                  className="investor-direct-five-card-grid investor-associative-direct-grid"
                  role="group"
                  aria-label="Opções prontas da Tabela Associativo"
                >
                  <div className="investor-direct-ready-options">
                    {result.standardScenarios.map((scenario, index) => {
                      const option = scenarioOptions[scenario.code];
                      const visible = visibleScenarioCodes.includes(scenario.code);
                      const availabilityId = `investor-scenario-availability-${scenario.code}`;
                      const availabilityMessage =
                        scenario.availabilityReason ?? "Cenário fora da regra";
                      return (
                        <div
                          key={scenario.code}
                          className="investor-scenario-plan"
                          data-scenario={option.plan === 18 ? 1 : 2}
                        >
                          <button
                            type="button"
                            aria-pressed={visible}
                            aria-disabled={!scenario.available}
                            aria-describedby={!scenario.available ? availabilityId : undefined}
                            title={!scenario.available ? availabilityMessage : undefined}
                            onClick={() => {
                              if (scenario.available) toggleScenarioOption(scenario.code);
                            }}
                          >
                            <span className="investor-direct-option-number" aria-hidden="true">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <strong>{option.title}</strong>
                            <span className="investor-direct-option-entry">
                              Plano em {scenario.installments} parcelas
                            </span>
                            <small id={!scenario.available ? availabilityId : undefined}>
                              {scenario.available ? option.description : availabilityMessage}
                            </small>
                            {visible ? (
                              <span className="investor-direct-option-selected">Selecionada</span>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className="investor-scenario-plan-picker"
                  aria-label="Escolha o plano para ver as propostas"
                >
                  {scenarioPlans.map((plan) => {
                    const expanded = expandedScenarioPlans.includes(plan);
                    const planId = `investor-scenario-plan-${plan}`;
                    return (
                      <section
                        key={plan}
                        className="investor-scenario-plan"
                        data-scenario={plan === 18 ? 1 : 2}
                      >
                        <button
                          id={`${planId}-button`}
                          className="investor-scenario-plan-button"
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={planId}
                          onClick={() => toggleScenarioPlan(plan)}
                        >
                          {`Plano em ${plan} Parcelas`}{" "}
                          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                        </button>
                        <div
                          id={planId}
                          className="investor-scenario-subpicker"
                          role="group"
                          aria-labelledby={`${planId}-button`}
                          hidden={!expanded}
                        >
                          {result.standardScenarios
                            .filter((scenario) => scenarioOptions[scenario.code]?.plan === plan)
                            .map((scenario) => {
                              const option = scenarioOptions[scenario.code];
                              const visible = visibleScenarioCodes.includes(scenario.code);
                              const availabilityId = `investor-scenario-availability-${scenario.code}`;
                              return (
                                <button
                                  key={scenario.code}
                                  type="button"
                                  aria-pressed={visible}
                                  aria-disabled={!scenario.available}
                                  aria-describedby={
                                    !scenario.available ? availabilityId : undefined
                                  }
                                  title={
                                    !scenario.available
                                      ? `O prazo da obra não comporta ${option.plan} parcelas completas`
                                      : undefined
                                  }
                                  onClick={() => {
                                    if (scenario.available) toggleScenarioOption(scenario.code);
                                  }}
                                >
                                  <span>{option.title}</span>
                                  {!scenario.available ? (
                                    <small id={availabilityId}>Prazo da obra insuficiente</small>
                                  ) : null}
                                </button>
                              );
                            })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
              <div className="investor-scenario-stack" aria-live="polite">
                {visibleScenarioCodes.map((code) => {
                  const scenario = result.standardScenarios.find(
                    (scenario) => scenario.code === code,
                  );
                  if (!scenario) return null;
                  const option = scenarioOptions[scenario.code];
                  if (!option) return null;
                  const optionTitle = `Plano em ${scenario.installments} parcelas · ${option.title}`;
                  const optionDescription = option.description;
                  const payments = [
                    {
                      key: "property",
                      label: "Valor do imóvel",
                      value: money.format(result.context.valueReal),
                      meta: "Base do plano",
                    },
                    {
                      key: "entry",
                      label: "Entrada",
                      value: money.format(scenario.entry),
                      meta: `${percent.format(scenario.entryRate)} do valor do imóvel`,
                    },
                    ...scenario.signals.map((signal) => ({
                      key: `signal-${signal.index}`,
                      label: `Sinal ${signal.index}`,
                      value: money.format(signal.value),
                      meta: `Pagamento em ${formatDate(signal.date)}`,
                    })),
                    ...scenario.intermediaryDates.map((date, index) => ({
                      key: `intermediary-${index + 1}`,
                      label: `${annualMode ? "Anual" : "Intermediária"} ${index + 1}`,
                      value: money.format(
                        scenario.intermediaryValues?.[index] ??
                          scenario.intermediaryTotal / scenario.intermediaryCount,
                      ),
                      meta: `Pagamento em ${formatDate(date)}`,
                    })),
                    {
                      key: "balance",
                      label: "Saldo parcelado",
                      value: money.format(scenario.balance),
                      meta: "Valor dividido nas mensais",
                    },
                    {
                      key: "installment",
                      label: "Parcela mensal",
                      value:
                        scenario.lastInstallmentValue === scenario.installmentValue
                          ? `${scenario.installments}x de ${money.format(scenario.installmentValue)}`
                          : `${scenario.installments - 1}x de ${money.format(scenario.installmentValue)} + última de ${money.format(scenario.lastInstallmentValue)}`,
                      meta: `1ª em ${formatDate(scenario.firstInstallmentDate)}`,
                      featured: true,
                    },
                  ];
                  const linear = scenario.linear;
                  const verticalPayments = linear
                    ? [
                        {
                          key: "property",
                          label: "Valor real do imóvel",
                          operator: "",
                          calculation: "Preço do imóvel − deduções comerciais",
                          result: money.format(linear.realSaleValue),
                          meta: "Base selecionada no estoque",
                        },
                        {
                          key: "financing",
                          label: "Financiamento",
                          operator: "−",
                          calculation: "Recurso bancário aplicado nesta proposta",
                          result: `− ${money.format(scenario.financing)}`,
                          meta: "Valor ajustado para preservar a aprovação",
                        },
                        {
                          key: "subsidy",
                          label: "Subsídio",
                          operator: "−",
                          calculation: "Recurso informado no fluxo editável",
                          result: `− ${money.format(scenario.subsidy)}`,
                          meta: "Abate o saldo da venda",
                        },
                        {
                          key: "fgts",
                          label: "FGTS",
                          operator: "−",
                          calculation: "Recurso informado no fluxo editável",
                          result: `− ${money.format(scenario.fgts)}`,
                          meta: "Abate o saldo da venda",
                        },
                        {
                          key: "housing-check",
                          label: "Cheque Moradia",
                          operator: "−",
                          calculation: "Recurso informado no fluxo editável",
                          result: `− ${money.format(scenario.housingCheck)}`,
                          meta: "Abate o saldo da venda",
                        },
                        {
                          key: "entry",
                          label: "Entrada",
                          operator: "−",
                          calculation: `${money.format(linear.realSaleValue)} × ${percent.format(scenario.entryRate)}`,
                          result: `− ${money.format(scenario.entry)}`,
                          meta: `Pagamento em ${formatDate(baseDate)}`,
                        },
                        ...scenario.signals.map((signal) => ({
                          key: `signal-${signal.index}`,
                          label: `Sinal ${signal.index}`,
                          operator: "−",
                          calculation: "Complemento da entrada",
                          result: `− ${money.format(signal.value)}`,
                          meta: `Pagamento em ${formatDate(signal.date)}`,
                        })),
                        ...linear.annualSchedule
                          .filter((annual) => annual.amount > 0 && annual.valid)
                          .map((annual) => ({
                            key: `annual-${annual.index}`,
                            label: `Anual ${annual.index}`,
                            operator: "↳",
                            calculation: `${money.format(annual.amount)} corrigidos a 0,5% a.m.`,
                            result: money.format(annual.corrected),
                            meta: `Reduz somente a base mensal · pagamento em ${formatDate(annual.dueDate)}`,
                          })),
                        {
                          key: "pro-soluto",
                          label: "Pró-soluto",
                          operator: "=",
                          calculation:
                            "Imóvel − financiamento − subsídio − FGTS − cheque − entrada − sinais",
                          result: money.format(linear.proSoluto),
                          meta: "Anuais não alteram este saldo",
                        },
                        {
                          key: "corrected-pro-soluto",
                          label: "Pró-soluto corrigido",
                          operator: "+",
                          calculation: `${money.format(linear.proSoluto)} corrigido pela carência`,
                          result: money.format(linear.correctedProSoluto),
                          meta: `Taxa-base de ${percent.format(linear.baseRate)} a.m.`,
                        },
                        ...(linear.preInstallments > 0
                          ? [
                              {
                                key: "pre-installments",
                                label: `${linear.preInstallments} Mensais pré-obra`,
                                operator: "÷",
                                calculation: `PMT(0,5% a.m.; ${linear.preInstallments}; ${money.format(linear.adjustedPre)})`,
                                result: money.format(linear.prePayment),
                                meta: "Fluxo anterior ao término da obra",
                              },
                            ]
                          : []),
                        ...(linear.postInstallments > 0
                          ? [
                              {
                                key: "post-installments",
                                label: `${linear.postInstallments} Mensais pós-obra`,
                                operator: "÷",
                                calculation: `PMT(1,5% a.m.; ${linear.postInstallments}; ${money.format(linear.adjustedPost)})`,
                                result: money.format(linear.postPayment),
                                meta: "Fluxo posterior ao término da obra",
                              },
                            ]
                          : []),
                        {
                          key: "corrected-installment",
                          label: "Parcela corrigida",
                          operator: "=",
                          calculation: "Maior parcela entre pré e pós-obra",
                          result: money.format(linear.correctedInstallment),
                          meta: `1ª em ${formatDate(linear.firstInstallmentDate)} · ${linear.preInstallments} pré + ${linear.postInstallments} pós = ${linear.installments}`,
                          featured: true,
                        },
                      ]
                    : [];
                  if (directVisualLayout) {
                    const calculationTitleId = `investor-associative-calculation-title-${scenario.code}`;
                    return (
                      <section
                        id={`investor-scenario-option-${scenario.code}`}
                        key={scenario.code}
                        className="investor-scenario-group investor-scenario-option-panel investor-direct-option-panel investor-associative-option-panel"
                        data-scenario={scenario.signals.length > 0 ? 2 : 1}
                      >
                        <header>
                          <div />
                          <button
                            type="button"
                            onClick={() => toggleScenarioOption(scenario.code)}
                            aria-label={`Ocultar ${optionTitle}`}
                            title="Ocultar proposta"
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </header>
                        <div className="investor-scenario-grid">
                          <article>
                            <section
                              className="investor-direct-calculation"
                              aria-labelledby={calculationTitleId}
                            >
                              <header className="investor-direct-calculation-heading">
                                <div>
                                  <span>Proposta pronta</span>
                                  <h4
                                    id={calculationTitleId}
                                  >{`Composição do pagamento ${option.title.replace(/^Proposta /u, "").toLocaleLowerCase("pt-BR")}`}</h4>
                                  <p>{`Plano em ${scenario.installments} parcelas · ${optionDescription}`}</p>
                                </div>
                                <div
                                  className={`investor-direct-credit-status ${scenario.available ? "approved" : "pending"}`}
                                >
                                  <small>Resultado da proposta</small>
                                  <strong>{scenario.available ? "VALIDADO" : "PENDENTE"}</strong>
                                  <span>{`${scenario.preInstallments} pré + ${scenario.postInstallments} pós = ${scenario.installments}`}</span>
                                </div>
                              </header>
                              <div className="investor-direct-calculation-body">
                                <div
                                  className="investor-direct-account"
                                  role="region"
                                  tabIndex={0}
                                  aria-label={`${optionTitle}: memória de cálculo`}
                                >
                                  <div
                                    className="investor-direct-account-legend"
                                    aria-hidden="true"
                                  >
                                    <span>Etapa</span>
                                    <span>Cálculo</span>
                                    <span>Resultado</span>
                                  </div>
                                  <ol>
                                    {verticalPayments.map((payment, index) => (
                                      <li
                                        key={payment.key}
                                        className={payment.featured ? "total" : ""}
                                      >
                                        <span
                                          className="investor-direct-step-number"
                                          aria-hidden="true"
                                        >
                                          {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <div className="investor-direct-step-content">
                                          <div className="investor-direct-step-name">
                                            <span aria-hidden="true">{payment.operator}</span>
                                            <div>
                                              <strong>{payment.label}</strong>
                                              <small>{payment.meta}</small>
                                            </div>
                                          </div>
                                          <div className="investor-direct-step-formula">
                                            {payment.calculation}
                                          </div>
                                          <div className="investor-direct-step-result">
                                            <strong>{payment.result}</strong>
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            </section>
                          </article>
                        </div>
                      </section>
                    );
                  }
                  return (
                    <section
                      id={`investor-scenario-option-${scenario.code}`}
                      key={scenario.code}
                      className="investor-scenario-group investor-scenario-option-panel"
                      data-scenario={option.plan === 18 ? 1 : 2}
                    >
                      <header>
                        <div>
                          <h3>{optionTitle}</h3>
                          {optionDescription ? <p>{optionDescription}</p> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleScenarioOption(scenario.code)}
                          aria-label={`Ocultar ${optionTitle}`}
                        >
                          Ocultar opção
                        </button>
                      </header>
                      <div className="investor-scenario-grid">
                        <article className={!scenario.available ? "unavailable" : ""}>
                          {scenario.available ? (
                            <dl
                              className={`investor-scenario-flow investor-scenario-flow-${payments.length}`}
                              role="region"
                              tabIndex={payments.length >= 10 ? 0 : undefined}
                              aria-label={`${optionTitle}: pagamentos em sequência`}
                            >
                              {payments.map((payment) => (
                                <div
                                  key={payment.key}
                                  className={payment.featured ? "featured" : ""}
                                >
                                  <dt>{payment.label}</dt>
                                  <dd>{payment.value}</dd>
                                  <small>{payment.meta}</small>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <div className="investor-scenario-unavailable">
                              <strong>Opção indisponível</strong>
                              <p>O prazo da obra não permite esta quantidade de parcelas.</p>
                            </div>
                          )}
                        </article>
                      </div>
                    </section>
                  );
                })}
              </div>
              <p className="investor-scenario-order">
                {annualMode
                  ? "Compare as opções liberadas após o financiamento informado no fluxo acima."
                  : "Compare as opções acima e, se necessário, monte a sua proposta personalizada abaixo."}
              </p>
            </>
          )}
        </fieldset>
      </section>
    );
  }

  return (
    <div
      className={`investor-workspace${usesDirectDesign ? "investor-direct-workspace" : ""}${directVisualLayout ? "investor-direct-design-copy" : ""}`}
    >
      {tourOpen ? (
        <>
          <div
            className="investor-tour-spotlight"
            aria-hidden="true"
            style={{
              top: tourSpotlight.top,
              left: tourSpotlight.left,
              width: tourSpotlight.width,
              height: tourSpotlight.height,
            }}
          />
          <aside
            id="investor-guided-tour"
            ref={tourPanel}
            className={`investor-guided-tour${tourPlacement.top ? "at-top" : ""}${tourPlacement.left ? "at-left" : ""}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby="investor-guided-tour-title"
            aria-describedby="investor-guided-tour-description"
            tabIndex={-1}
          >
            <header>
              <span>
                Passo {tourStep + 1} de {tourSteps.length}
              </span>
              <button type="button" onClick={closeGuidedTour} aria-label="Fechar passo a passo">
                ×
              </button>
            </header>
            <div
              className="investor-tour-progress"
              role="progressbar"
              aria-label="Progresso do guia"
              aria-valuemin={1}
              aria-valuemax={tourSteps.length}
              aria-valuenow={tourStep + 1}
            >
              <span style={{ width: `${((tourStep + 1) / tourSteps.length) * 100}%` }} />
            </div>
            <div className="investor-tour-copy" aria-live="polite">
              <span>{tourSteps[tourStep].eyebrow}</span>
              <h2 id="investor-guided-tour-title">{tourSteps[tourStep].title}</h2>
              {directTable && tourSteps[tourStep].target === "information" ? (
                <div id="investor-guided-tour-description" className="investor-tour-info-demo">
                  <span className="investor-info-mark" aria-hidden="true" />
                  <p>{tourSteps[tourStep].description}</p>
                </div>
              ) : (
                <>
                  <p id="investor-guided-tour-description">{tourSteps[tourStep].description}</p>
                  {tourSteps[tourStep].checklist.length ? (
                    <ul>
                      {tourSteps[tourStep].checklist.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {tourSteps[tourStep].tip ? <small>{tourSteps[tourStep].tip}</small> : null}
                </>
              )}
            </div>
            {tourSteps[tourStep].target === "inventory" && !selectedUnit ? (
              <p className="investor-tour-action" role="status">
                Selecione uma unidade para liberar o próximo passo.
              </p>
            ) : null}
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={showPreviousTourStep}
                disabled={tourStep === 0}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={showNextTourStep}
                disabled={tourSteps[tourStep].target === "inventory" && !selectedUnit}
              >
                {tourStep === tourSteps.length - 1
                  ? "Concluir guia"
                  : tourSteps[tourStep].target === "inventory" && !selectedUnit
                    ? "Selecione uma unidade"
                    : "Próximo"}
              </button>
            </footer>
          </aside>
        </>
      ) : null}

      <section className="investor-stock-panel" aria-labelledby="investor-stock-title">
        <header className="investor-section-heading">
          <span>01</span>
          <div>
            <p>Estoque SPC</p>
            <h2 id="investor-stock-title">Escolha a unidade</h2>
          </div>
          <div className="investor-stock-sync">
            <small>
              {inventoryStatus === "ready"
                ? `${inventory.length.toLocaleString("pt-BR")} unidades`
                : inventoryStatus === "error"
                  ? "Estoque indisponível"
                  : "Carregando estoque"}
            </small>
            {inventoryMeta?.generatedAt ? (
              <small>Atualizado {dateTime.format(new Date(inventoryMeta.generatedAt))}</small>
            ) : null}
          </div>
        </header>

        <div className="investor-stock-filters" data-tour="filters">
          <div className="investor-filter-heading">
            <div className="investor-filter-title-row">
              <strong>Filtros do estoque</strong>
              <InvestorInfoHint
                label="orientação dos filtros"
                title="Como usar os filtros?"
                description={
                  directTable
                    ? "Use os filtros para localizar a unidade exata do estoque SPC que será usada na Tabela Direta."
                    : "Use os filtros para localizar uma unidade elegível. Na Tabela Investidor, vagas de garagem avulsas não são comercializadas."
                }
              />
            </div>
            <button type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
          <label>
            <span>Incorporadora</span>
            <select
              value={businessUnit}
              onChange={(event) => updateFilter(setBusinessUnit, event.target.value)}
            >
              <option value="Todas">
                Todas ({filterOptions.totals.businessUnit.toLocaleString("pt-BR")})
              </option>
              {filterOptions.businessUnits.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Nome do Empreendimento</span>
            <select
              value={project}
              onChange={(event) => updateFilter(setProject, event.target.value)}
            >
              <option value="Todos">
                Todos ({filterOptions.totals.project.toLocaleString("pt-BR")})
              </option>
              {filterOptions.projects.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Região</span>
            <select
              value={region}
              onChange={(event) => updateFilter(setRegion, event.target.value)}
            >
              <option value="Todas">
                Todas ({filterOptions.totals.region.toLocaleString("pt-BR")})
              </option>
              {filterOptions.regions.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Planta</span>
            <select value={plant} onChange={(event) => updateFilter(setPlant, event.target.value)}>
              <option value="Todos">
                Todos ({filterOptions.totals.plant.toLocaleString("pt-BR")})
              </option>
              {filterOptions.plants.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.value} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Valor do Imóvel</span>
            <select
              value={salePriceFilter}
              onChange={(event) => updateFilter(setSalePriceFilter, event.target.value)}
            >
              <option value="Todos">
                Todos ({filterOptions.totals.salePrice.toLocaleString("pt-BR")})
              </option>
              {filterOptions.salePrices.map((item) => (
                <option value={item.value} key={item.value}>
                  {money.format(Number(item.value))} ({item.count.toLocaleString("pt-BR")})
                </option>
              ))}
            </select>
          </label>
          <label className="investor-stock-sort" data-tour="sort">
            <span>Ordenar valor</span>
            <select
              aria-label="Ordenar unidades por valor do imóvel"
              value={priceSort}
              onChange={(event) => {
                setPriceSort(event.target.value as "asc" | "desc");
                setVisibleInventoryCount(75);
              }}
            >
              <option value="asc">Menor para o maior</option>
              <option value="desc">Maior para o menor</option>
            </select>
          </label>
          {filterNotice && (
            <span className="sr-only" aria-live="polite">
              {filterNotice}
            </span>
          )}
        </div>

        <p className="investor-stock-summary sr-only" aria-live="polite">
          <span>
            {inventoryStatus === "ready" ? (
              <>
                <strong>{matchingInventory.length.toLocaleString("pt-BR")}</strong> unidades
                disponíveis
              </>
            ) : inventoryStatus === "loading" ? (
              "Carregando estoque…"
            ) : (
              "Estoque indisponível"
            )}
          </span>
        </p>

        <div
          className="investor-stock-results"
          role="region"
          aria-label="Estoque completo de unidades"
          tabIndex={0}
          data-tour="inventory"
          onScroll={(event) => {
            const element = event.currentTarget;
            if (element.scrollTop + element.clientHeight >= element.scrollHeight - 180) {
              setVisibleInventoryCount((current) =>
                Math.min(current + 75, matchingInventory.length),
              );
            }
          }}
        >
          <table className="investor-stock-table">
            <caption className="sr-only">Unidades encontradas no estoque</caption>
            <colgroup>
              <col className="investor-stock-col-start" />
              <col className="investor-stock-col-business" />
              <col className="investor-stock-col-product" />
              <col className="investor-stock-col-area" />
              <col className="investor-stock-col-date" />
              <col className="investor-stock-col-plant" />
              <col className="investor-stock-col-price" />
            </colgroup>
            <thead>
              <tr>
                <th className="investor-stock-start-heading">Início</th>
                <th>Incorporadora</th>
                <th>Produto</th>
                <th>Metragem</th>
                <th>Data de Entrega</th>
                <th>Planta</th>
                <th>Valor do imóvel</th>
              </tr>
            </thead>
            <tbody>
              {inventoryStatus === "loading" ? (
                <tr>
                  <td className="investor-empty-result" colSpan={7}>
                    Carregando unidades do estoque…
                  </td>
                </tr>
              ) : null}
              {inventoryStatus === "error" ? (
                <tr>
                  <td className="investor-empty-result" colSpan={7}>
                    Estoque indisponível. Recarregue a página para tentar novamente.
                  </td>
                </tr>
              ) : null}
              {matchingInventory.slice(0, visibleInventoryCount).map((item) => {
                const canSelect = Boolean(item.finalPrice && item.completionDate);
                const selected = item.id === selectedUnitId;
                return (
                  <tr
                    key={item.id}
                    className={`${selected ? "selected" : ""} ${canSelect ? "selectable" : "unavailable"}`.trim()}
                    aria-selected={selected}
                    onClick={() => canSelect && selectUnit(item)}
                  >
                    <td className="investor-stock-start-cell" data-label="Início">
                      <button
                        type="button"
                        className="investor-stock-unit-button"
                        disabled={!canSelect}
                        aria-pressed={selected}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectUnit(item);
                        }}
                        aria-label={
                          canSelect
                            ? `Iniciar proposta com ${item.identifier ?? item.product}`
                            : `${item.identifier ?? item.product} sem valor ou término da obra`
                        }
                      >
                        <span aria-hidden="true">{selected ? "✓" : "›"}</span>
                      </button>
                    </td>
                    <td data-label="Incorporadora">{item.businessUnit}</td>
                    <td className="investor-stock-product" data-label="Produto">
                      <span className="investor-stock-product-text">{item.product}</span>
                    </td>
                    <td data-label="Metragem">
                      {item.privateArea != null ? `${decimal.format(item.privateArea)} m²` : "—"}
                    </td>
                    <td data-label="Data de Entrega">{formatDate(item.completionDate)}</td>
                    <td className="investor-stock-plant" data-label="Planta">
                      {informationLabel(item.plant)}
                    </td>
                    <td className="investor-stock-price" data-label="Valor do imóvel">
                      {item.finalPrice ? money.format(item.finalPrice) : "Não informado"}
                    </td>
                  </tr>
                );
              })}
              {inventoryStatus === "ready" && matchingInventory.length === 0 && (
                <tr>
                  <td className="investor-empty-result" colSpan={7}>
                    Nenhuma unidade encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedUnit ? (
        <PropertySummary
          item={selectedUnit}
          label={
            directTable
              ? "Descrição do imóvel usado na proposta"
              : "Descrição do imóvel usado nos cenários"
          }
          associative={directTable || directVisualLayout}
        />
      ) : null}

      {selectedUnit && annualMode ? (
        <AssociativeQualificationPanel
          income={income}
          modality={associativeFinancingModality}
          modalityDecision={associativeFinancingDecision}
          firstProperty={associativeFirstProperty}
          sectionRef={associativeQualificationSectionRef}
          guided={guidedAttention === "qualification"}
          incomeInputRef={associativeIncomeInputRef}
          onIncomeChange={updateAssociativeIncome}
          onModalityChange={updateAssociativeModality}
          onFirstPropertyChange={updateAssociativeFirstProperty}
        />
      ) : null}

      {selectedUnit && !annualMode ? renderCalculatedProposal() : null}

      {selectedUnit ? (
        <div className="investor-proposal-layout">
          <section
            ref={annualMode ? associativeFlowSectionRef : undefined}
            tabIndex={annualMode ? -1 : undefined}
            className={`investor-flow-panel${usesDirectDesign ? "investor-direct-flow-panel" : ""}${annualMode ? "investor-associative-flow-panel" : ""}${associativeQualificationLocked ? "is-locked" : ""}${guidedAttention === "flow" ? "is-guided-active" : ""}`}
            aria-labelledby="investor-flow-title"
            data-locked={associativeQualificationLocked || undefined}
            data-tour="proposal"
          >
            <header className="investor-section-heading investor-flow-heading">
              <span>{directTable ? "04" : "03"}</span>
              <div>
                <p>Fluxo editável</p>
                <h2 id="investor-flow-title">Monte a proposta</h2>
              </div>
              <aside className="investor-proposal-help" aria-label="Guia da proposta">
                <div className="investor-proposal-help-action">
                  <InvestorInfoHint
                    label="guia da proposta"
                    title="O que este guia explica?"
                    description={
                      directTable
                        ? "Mostra a proposta inteira em ordem, com palavras simples: imóvel, renda, entrada, sinais, intermediárias, pré-chaves, pós-chaves, resultado e conferência final."
                        : annualMode
                          ? "Ensina a preencher Financiamento, Subsídio, FGTS, Cheque Moradia, Entrada, parcelas e Ranking. Também explica sinais, anuais, ajustes e a conferência final."
                          : "Explica entrada, pagamentos e parcelas em ordem."
                    }
                  />
                  <div className="investor-proposal-help-cta">
                    <small>Guia completo</small>
                    <button
                      ref={directTable ? proposalTourTrigger : undefined}
                      className="investor-guided-start"
                      type="button"
                      disabled={associativeQualificationLocked}
                      aria-haspopup="dialog"
                      aria-controls={
                        directTable ? "investor-guided-tour" : "investor-proposal-guide"
                      }
                      onClick={
                        directTable
                          ? startProposalGuidedTour
                          : () => {
                              setTourOpen(false);
                              proposalGuideDialog.current?.showModal();
                            }
                      }
                    >
                      Iniciar passo a passo
                    </button>
                  </div>
                </div>
              </aside>
            </header>

            {associativeQualificationLocked ? (
              <div className="investor-associative-section-lock" role="status" aria-live="polite">
                <span aria-hidden="true">BLOQUEADO</span>
                <div>
                  <strong>Fluxo editável bloqueado</strong>
                  <small>Responda Renda Familiar, Modalidade e Primeiro imóvel.</small>
                </div>
                <button type="button" onClick={() => associativeIncomeInputRef.current?.focus()}>
                  Responder perguntas
                </button>
              </div>
            ) : null}
            <fieldset
              className="investor-associative-gated-fieldset"
              disabled={associativeQualificationLocked}
              aria-disabled={associativeQualificationLocked || undefined}
            >
              <legend className="sr-only">Fluxo editável da proposta</legend>
              <div className="investor-flow-form">
                <dialog
                  ref={proposalGuideDialog}
                  id="investor-proposal-guide"
                  className={`investor-proposal-guide${usesDirectDesign ? "investor-direct-proposal-guide" : ""}`}
                  aria-labelledby="investor-proposal-guide-title"
                  aria-describedby="investor-proposal-guide-description"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) event.currentTarget.close();
                  }}
                >
                  <div
                    className={`investor-proposal-guide-card${usesDirectDesign ? "investor-direct-proposal-guide-card" : ""}`}
                  >
                    <header>
                      <div>
                        <span>Orientação completa</span>
                        <h2 id="investor-proposal-guide-title">
                          Vamos montar esta proposta juntos
                        </h2>
                      </div>
                      <form method="dialog">
                        <button type="submit" aria-label="Fechar passo a passo">
                          ×
                        </button>
                      </form>
                    </header>
                    <p id="investor-proposal-guide-description">
                      Pense na proposta como uma conta montada em blocos. Você confere um bloco por
                      vez, e o simulador usa cada resposta para calcular o próximo. Siga a ordem
                      abaixo sem pular etapas.
                    </p>
                    <ol>
                      {directTable ? (
                        DIRECT_TABLE_PROPOSAL_GUIDE_STEPS.map((step, index) => (
                          <li key={step.title}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{step.title}</strong>
                              <p>{step.description}</p>
                              <small>{step.note}</small>
                            </div>
                          </li>
                        ))
                      ) : annualMode ? (
                        ASSOCIATIVE_PROPOSAL_GUIDE_STEPS.map((step, index) => (
                          <li key={step.title}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{step.title}</strong>
                              <p>{step.description}</p>
                              <small>{step.note}</small>
                            </div>
                          </li>
                        ))
                      ) : (
                        <>
                          <li>
                            <span>1</span>
                            <div>
                              <strong>Confirme a unidade escolhida</strong>
                              <p>
                                O valor do imóvel e a data de entrega vêm do estoque e ficam
                                bloqueados. Se a unidade estiver incorreta, volte ao item 01 e
                                selecione outra linha.
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>2</span>
                            <div>
                              <strong>Ajuste a entrada</strong>
                              <p>
                                O campo inicia com 10% e pode ser editado em reais. O pagamento
                                inicial nunca pode ficar abaixo de 6%; o percentual aparece abaixo
                                do campo.
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>3</span>
                            <div>
                              <strong>Complete com sinais quando necessário</strong>
                              <p>
                                Se a entrada ficar entre 6% e menos de 10%, o simulador distribui o
                                valor restante em até 3 sinais, com datas comerciais nos dias 05, 10
                                ou 15. Cada sinal deve ser de no mínimo R$ 150,00; o Sinal 2 não
                                pode superar o Sinal 1 e o Sinal 3 não pode superar o Sinal 2. Você
                                pode ajustar os valores.
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>4</span>
                            <div>
                              <strong>Inclua intermediárias se o cliente desejar</strong>
                              <p>
                                Cada intermediária pode representar até 5% do valor do imóvel. O
                                limite é de 3 pagamentos no fluxo de 18 parcelas e 4 no fluxo de 24,
                                sempre respeitando as datas e o prazo da obra.
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>5</span>
                            <div>
                              <strong>Aplique desconto somente com autorização</strong>
                              <p>
                                Abra o campo apenas quando houver solicitação e autorização. O
                                desconto reduz o valor real usado no cálculo e pode alterar
                                percentuais e limites.
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>6</span>
                            <div>
                              <strong>Defina a quantidade de parcelas</strong>
                              <p>
                                Entrada total de 10% a 19,99% permite até 18 parcelas; a partir de
                                20%, até 24. O prazo da obra pode reduzir esse máximo. Confira o
                                valor mensal e a data da primeira parcela no cartão.
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>7</span>
                            <div>
                              <strong>Valide o resultado</strong>
                              <p>
                                No item 04, confira composição, saldo, parcela mensal e datas. Abra
                                a auditoria e corrija cada reprovação indicada antes de imprimir ou
                                apresentar ao cliente.
                              </p>
                            </div>
                          </li>
                        </>
                      )}
                    </ol>
                    <aside>
                      <strong>Regra simples para não se perder</strong>
                      <p>
                        {directTable
                          ? "Leia sempre de cima para baixo: imóvel → renda → opção → pagamentos → parcela pós-chaves → resultado → auditoria. Se uma linha reprovar, corrija essa linha antes de continuar."
                          : annualMode
                            ? "Ela evita montar um fluxo fora da regra e permite visualizar as datas de sinais, anuais e parcelas antes de apresentar a proposta."
                            : "Ela evita montar um fluxo fora da regra e permite visualizar as datas de sinais, intermediárias e parcelas antes de apresentar a proposta."}
                      </p>
                    </aside>
                    <form method="dialog" className="investor-proposal-guide-actions">
                      <button type="submit">Entendi, montar proposta</button>
                    </form>
                  </div>
                </dialog>

                {directTable ? (
                  <div
                    className={`investor-direct-credit-tour-anchor investor-direct-editable-freeze${directIncomeReady ? "" : "is-locked"}`}
                  >
                    {!directIncomeReady ? (
                      <div
                        className="investor-direct-editable-lock"
                        role="status"
                        aria-live="polite"
                      >
                        <span className="investor-direct-editable-lock-mark" aria-hidden="true" />
                        <div>
                          <p>Fluxo visível e congelado</p>
                          <h3>Informe a renda no item 02 para editar esta proposta.</h3>
                          <small>
                            A opção 01 permanece como referência. Nenhum campo abaixo pode ser
                            alterado até o preenchimento da renda.
                          </small>
                        </div>
                        <button type="button" onClick={() => directIncomeInputRef.current?.focus()}>
                          Informar renda
                        </button>
                      </div>
                    ) : null}
                    <fieldset disabled={!directIncomeReady} aria-disabled={!directIncomeReady}>
                      <legend className="sr-only">
                        Fluxo editável da proposta{" "}
                        {directIncomeReady ? "liberado" : "congelado até informar a renda"}
                      </legend>
                      <div
                        className="investor-direct-account investor-direct-editable-account"
                        role="group"
                        aria-labelledby="investor-flow-title"
                      >
                        <div className="investor-direct-account-legend" aria-hidden="true">
                          <span>Etapa</span>
                          <span>Cálculo</span>
                          <span>Resultado</span>
                        </div>
                        <ol>
                          <DirectEditableAccountRow
                            number={1}
                            label="Valor do imóvel"
                            calculation="Base da proposta"
                            result={<strong>{money.format(currencyInputNumber(salePrice))}</strong>}
                          />
                          <DirectEditableAccountRow
                            number={2}
                            operator="−"
                            label="Desconto"
                            tourTarget="proposal-discount"
                            meta={
                              discountAuthorized
                                ? "Valor autorizado aplicado ao cálculo"
                                : "Opcional · aplique somente com autorização"
                            }
                            calculation={
                              <div className="investor-direct-editable-value has-inline-action">
                                {discountAuthorized ? (
                                  <>
                                    <span aria-hidden="true">R$</span>
                                    <MoneyInput
                                      inputRef={discountInputRef}
                                      label="Desconto autorizado"
                                      value={discount}
                                      onChange={setDiscount}
                                    />
                                  </>
                                ) : (
                                  <strong>{money.format(0)}</strong>
                                )}
                                <button
                                  type="button"
                                  aria-label={
                                    discountAuthorized ? "Remover desconto" : "Aplicar desconto"
                                  }
                                  title={
                                    discountAuthorized ? "Remover desconto" : "Aplicar desconto"
                                  }
                                  aria-pressed={discountAuthorized}
                                  onClick={toggleDiscountField}
                                >
                                  <span aria-hidden="true">{discountAuthorized ? "×" : "+"}</span>
                                </button>
                              </div>
                            }
                            result={
                              <>
                                <strong>{money.format(result.context.valueReal)}</strong>
                                <small>Valor real da proposta</small>
                              </>
                            }
                          />
                          <DirectEditableAccountRow
                            number={3}
                            operator="−"
                            label="Ato"
                            tourTarget="proposal-entry"
                            meta={`Pagamento em ${formatDate(baseDate)}`}
                            calculation={
                              <>
                                {money.format(result.context.valueReal)} ×{" "}
                                {percent.format(result.custom.actRate)}
                                <small>
                                  Mínimo {money.format(result.context.valueReal * 0.06)} (6%)
                                </small>
                              </>
                            }
                            result={
                              <div className="investor-direct-editable-value">
                                <span aria-hidden="true">R$</span>
                                <MoneyInput
                                  label="Valor do ato"
                                  describedBy="investor-editable-entry-status"
                                  value={entryValue}
                                  onChange={updateEntryValue}
                                />
                                <small id="investor-editable-entry-status">
                                  {percent.format(result.custom.actRate)} do valor real
                                </small>
                              </div>
                            }
                          />
                          <DirectEditableAccountRow
                            number={4}
                            operator="="
                            label="Saldo após o ato"
                            meta="Atualizado automaticamente"
                            calculation={`${money.format(result.context.valueReal)} − ${money.format(result.custom.actValue)}`}
                            result={
                              <strong>
                                {money.format(result.context.valueReal - result.custom.actValue)}
                              </strong>
                            }
                          />
                          {visibleSignalIndexes.map((index, visiblePosition) => {
                            const value = signals[index];
                            const signal = result.custom.signals[index];
                            const active = currencyInputNumber(value) > 0;
                            const statusId = `investor-editable-signal-${index + 1}-status`;
                            const hideActionLabel =
                              index === signals.length - 1
                                ? `Ocultar Sinal ${index + 1} e zerar valor`
                                : `Ocultar Sinal ${index + 1} e os sinais seguintes; os valores serão zerados`;
                            const hideActionText =
                              index === signals.length - 1
                                ? `Ocultar ${index + 1}`
                                : `Ocultar ${index + 1}–${signals.length}`;
                            return (
                              <DirectEditableAccountRow
                                key={`editable-signal-${index}`}
                                number={5 + visiblePosition}
                                operator={active && !signal.approved ? "!" : "−"}
                                label={`Sinal ${index + 1}`}
                                meta={
                                  active
                                    ? `Pagamento em ${formatDate(signal.date)}`
                                    : `Previsto para ${formatDate(signal.date)}`
                                }
                                calculation={
                                  active
                                    ? `${money.format(result.context.valueReal)} × ${percent.format(signal.rate)}`
                                    : "Complete se necessário"
                                }
                                invalid={active && !signal.approved}
                                result={
                                  <div className="investor-direct-editable-value has-row-action">
                                    <span aria-hidden="true">R$</span>
                                    <MoneyInput
                                      inputRef={(input) => {
                                        signalInputRefs.current[index] = input;
                                      }}
                                      label={`Valor do sinal ${index + 1}`}
                                      describedBy={statusId}
                                      invalid={active && !signal.approved}
                                      value={value}
                                      onChange={(nextValue) => updateSignal(index, nextValue)}
                                    />
                                    <button
                                      type="button"
                                      className="investor-direct-row-hide"
                                      aria-label={hideActionLabel}
                                      title={hideActionLabel}
                                      onClick={() => hideSignalField(index)}
                                    >
                                      <span aria-hidden="true">×</span>
                                      <span>{hideActionText}</span>
                                    </button>
                                    <small
                                      id={statusId}
                                      role={active && !signal.approved ? "alert" : undefined}
                                    >
                                      {active ? signal.reason : "Campo opcional"}
                                    </small>
                                  </div>
                                }
                              />
                            );
                          })}
                          <DirectEditableAccountRow
                            label={signalsVisible ? "Adicionar sinal" : "Sinais"}
                            tourTarget="proposal-signals"
                            meta={
                              signalsRequired
                                ? `Faltam ${money.format(missingForMinimumEntry)} para completar 10%`
                                : "Opcionais · limite de 3 pagamentos"
                            }
                            calculation={`Total atual: ${money.format(result.custom.signalTotal)}`}
                            result={
                              <div className="investor-direct-editable-actions">
                                {visibleSignalCount < signals.length ? (
                                  <button
                                    ref={signalActionRef}
                                    type="button"
                                    aria-label={
                                      signalsVisible
                                        ? "Adicionar ou reexibir sinal"
                                        : "Adicionar sinal"
                                    }
                                    title={
                                      signalsVisible
                                        ? "Adicionar ou reexibir sinal"
                                        : "Adicionar sinal"
                                    }
                                    onClick={addSignalField}
                                  >
                                    <span aria-hidden="true">+</span>
                                  </button>
                                ) : (
                                  <small>Limite atingido</small>
                                )}
                              </div>
                            }
                          />
                          {visibleIntermediaryIndexes.map((index, visiblePosition) => {
                            const item = result.custom.intermediaries[index];
                            const statusId = `investor-editable-intermediary-${item.index}-status`;
                            return (
                              <DirectEditableAccountRow
                                key={`editable-intermediary-${item.index}`}
                                number={5 + visibleSignalCount + visiblePosition}
                                operator={item.value > 0 && !item.approved ? "!" : "−"}
                                label={`Intermediária ${item.index}`}
                                meta={
                                  item.date
                                    ? `Pagamento em ${formatDate(item.date)}`
                                    : "Data indisponível"
                                }
                                calculation={
                                  item.value > 0
                                    ? `${money.format(result.context.valueReal)} × ${percent.format(item.rate)}`
                                    : `Limite: ${money.format(result.context.valueReal)} × 5,0%`
                                }
                                invalid={item.value > 0 && !item.approved}
                                result={
                                  <div className="investor-direct-editable-value has-row-action">
                                    <span aria-hidden="true">R$</span>
                                    <MoneyInput
                                      inputRef={(input) => {
                                        intermediaryInputRefs.current[index] = input;
                                      }}
                                      label={`Valor da intermediária ${item.index}`}
                                      describedBy={statusId}
                                      invalid={item.value > 0 && !item.approved}
                                      max={result.context.valueReal * 0.05}
                                      value={intermediaries[index]}
                                      onChange={(nextValue) => updateIntermediary(index, nextValue)}
                                    />
                                    <button
                                      type="button"
                                      className="investor-direct-row-hide"
                                      aria-label={`Ocultar Intermediária ${item.index} e zerar valor`}
                                      title={`Ocultar Intermediária ${item.index}`}
                                      onClick={() => hideIntermediaryField(index)}
                                    >
                                      Ocultar
                                    </button>
                                    <small
                                      id={statusId}
                                      role={item.value > 0 && !item.approved ? "alert" : undefined}
                                    >
                                      {item.value > 0
                                        ? item.reason
                                        : `Máximo ${money.format(result.context.valueReal * 0.05)}`}
                                    </small>
                                  </div>
                                }
                              />
                            );
                          })}
                          <DirectEditableAccountRow
                            label={
                              intermediariesVisible ? "Adicionar intermediária" : "Intermediárias"
                            }
                            tourTarget="proposal-intermediaries"
                            meta={
                              intermediaryFieldLimit > 0
                                ? `5% cada · ${intermediaryFieldLimit} disponíveis até ${formatDate(result.context.deadline)} (3 meses antes da entrega)`
                                : `Nenhuma data disponível até ${formatDate(result.context.deadline)} (3 meses antes da entrega)`
                            }
                            calculation={`Total válido: ${money.format(result.custom.validIntermediaryTotal)}`}
                            result={
                              <div className="investor-direct-editable-actions">
                                {visibleIntermediaryCount < intermediaryFieldLimit ? (
                                  <button
                                    ref={intermediaryActionRef}
                                    type="button"
                                    aria-label={
                                      intermediariesVisible
                                        ? "Adicionar ou reexibir intermediária"
                                        : "Adicionar intermediária"
                                    }
                                    title={
                                      intermediariesVisible
                                        ? "Adicionar ou reexibir intermediária"
                                        : "Adicionar intermediária"
                                    }
                                    onClick={addIntermediaryField}
                                  >
                                    <span aria-hidden="true">+</span>
                                  </button>
                                ) : (
                                  <small>
                                    {intermediaryFieldLimit > 0
                                      ? "Limite da entrega atingido"
                                      : "Sem datas antes do limite"}
                                  </small>
                                )}
                              </div>
                            }
                          />
                          <DirectEditableAccountRow
                            number={5 + visibleSignalCount + visibleIntermediaryCount}
                            operator="−"
                            label="Saldo parcelado pré-chaves"
                            tourTarget="proposal-prekeys"
                            meta={
                              result.custom.validIntermediaryTotal > 0
                                ? `${directPreKeysRateLabel} menos intermediárias válidas`
                                : `${directPreKeysRateLabel} do valor do imóvel`
                            }
                            calculation={
                              result.custom.validIntermediaryTotal > 0
                                ? `${money.format(result.context.valueReal)} × ${directPreKeysRateLabel} − ${money.format(result.custom.validIntermediaryTotal)}`
                                : `${money.format(result.context.valueReal)} × ${directPreKeysRateLabel}`
                            }
                            result={<strong>− {money.format(result.custom.balance)}</strong>}
                          />
                          <DirectEditableAccountRow
                            number={6 + visibleSignalCount + visibleIntermediaryCount}
                            operator={result.custom.balance > 0 ? "÷" : ""}
                            label={
                              result.custom.balance > 0
                                ? `${result.custom.desiredInstallments} Mensais pré-chaves`
                                : "Mensais pré-chaves"
                            }
                            meta={
                              result.custom.balance > 0
                                ? `1ª parcela em ${formatDate(result.custom.firstPreKeysDate)}`
                                : "Saldo quitado pelas intermediárias"
                            }
                            calculation={
                              result.custom.balance > 0
                                ? `${money.format(result.custom.balance)} ÷ ${result.custom.desiredInstallments}`
                                : ""
                            }
                            action={result.custom.balance > 0}
                            result={
                              result.custom.balance > 0 ? (
                                <>
                                  <strong>{money.format(result.custom.installmentValue)}</strong>
                                  <button
                                    type="button"
                                    className="investor-info-trigger investor-direct-dialog-trigger"
                                    aria-label="Ver parcelas pré-chaves"
                                    title="Ver parcelas pré-chaves"
                                    aria-haspopup="dialog"
                                    aria-controls="investor-direct-pre-keys"
                                    onClick={() => directPreKeysDialog.current?.showModal()}
                                  >
                                    <span className="investor-info-mark" aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <strong>Dispensadas</strong>
                              )
                            }
                          />
                          <DirectEditableAccountRow
                            number={7 + visibleSignalCount + visibleIntermediaryCount}
                            operator="="
                            label="Saldo financiado"
                            tourTarget="proposal-postkeys"
                            meta={`Base para ${result.custom.postKeysInstallments} parcelas pós-chaves`}
                            calculation={`${money.format(result.context.valueReal)} × ${directPostKeysRateLabel}`}
                            result={<strong>{money.format(result.custom.postKeysBalance)}</strong>}
                          />
                          <DirectEditableAccountRow
                            number={8 + visibleSignalCount + visibleIntermediaryCount}
                            operator="÷"
                            label={`${result.custom.postKeysInstallments} Parcelas mensais pós-chaves`}
                            meta={`1ª parcela em ${formatDate(result.custom.firstPostKeysDate)}`}
                            calculation=""
                            action
                            total
                            result={
                              <>
                                <strong>{money.format(result.custom.postKeysPayment)}</strong>
                                <button
                                  type="button"
                                  className="investor-info-trigger investor-direct-dialog-trigger"
                                  aria-label={`Ver amortização das ${result.custom.postKeysInstallments} parcelas pós-chaves`}
                                  title={`Ver amortização das ${result.custom.postKeysInstallments} parcelas pós-chaves`}
                                  aria-haspopup="dialog"
                                  aria-controls="investor-direct-amortization"
                                  onClick={() => directAmortizationDialog.current?.showModal()}
                                >
                                  <span className="investor-info-mark" aria-hidden="true" />
                                </button>
                              </>
                            }
                          />
                          <DirectEditableAccountRow
                            number={9 + visibleSignalCount + visibleIntermediaryCount}
                            operator=""
                            label="Resultado da proposta"
                            tourTarget="credit-status"
                            meta="Limite de comprometimento: 40%"
                            calculation=""
                            invalid={result.custom.income > 0 && !result.custom.creditApproved}
                            result={
                              <span
                                className={`investor-direct-credit-result ${directCreditState}`}
                                role="status"
                                aria-live="polite"
                                aria-atomic="true"
                              >
                                <strong>{directCreditLabel}</strong>
                                {result.custom.income > 0 ? (
                                  <small>{percent.format(result.custom.commitment)} da renda</small>
                                ) : null}
                              </span>
                            }
                          />
                        </ol>
                      </div>
                    </fieldset>
                  </div>
                ) : (
                  <>
                    {!directVisualLayout ? (
                      <ol
                        className="investor-stage-trail investor-payment-stage-trail"
                        aria-label="Etapas para montar a proposta"
                      >
                        <li>
                          <span>1</span>Valor do imóvel
                        </li>
                        <li>
                          <span>2</span>Entrada
                        </li>
                        <li>
                          <span>3</span>Sinais
                        </li>
                        <li>
                          <span>4</span>
                          {annualMode ? "Anuais" : "Intermediárias"}
                        </li>
                        <li>
                          <span>5</span>Desconto
                        </li>
                        <li>
                          <span>6</span>Parcelas
                        </li>
                      </ol>
                    ) : null}
                    {directVisualLayout ? (
                      <div className="investor-associative-workspace">
                        <div
                          className="investor-associative-ledger"
                          role="group"
                          aria-labelledby="investor-flow-title"
                        >
                          <div className="investor-direct-account investor-direct-editable-account investor-associative-compact-account">
                            <ol onKeyDown={focusNextAssociativeRow}>
                              <li className="investor-associative-payment-actions-row">
                                <span className="investor-direct-step-number" aria-hidden="true" />
                                <div
                                  className="investor-associative-payment-actions-bar"
                                  aria-label="Adicionar pagamentos opcionais"
                                >
                                  <button
                                    ref={signalActionRef}
                                    type="button"
                                    data-tour="proposal-signals"
                                    disabled={
                                      !associativeApprovalDetailsUnlocked ||
                                      visibleSignalCount >= signals.length
                                    }
                                    onClick={addSignalField}
                                  >
                                    Inserir Sinal
                                  </button>
                                  <button
                                    ref={intermediaryActionRef}
                                    type="button"
                                    data-tour="proposal-intermediaries"
                                    disabled={
                                      !associativeApprovalDetailsUnlocked ||
                                      visibleIntermediaryCount >= intermediaryFieldLimit
                                    }
                                    onClick={addIntermediaryField}
                                  >
                                    Inserir Anual
                                  </button>
                                  <button
                                    type="button"
                                    data-tour="proposal-discount"
                                    disabled={!associativeApprovalDetailsUnlocked}
                                    aria-pressed={discountAuthorized}
                                    onClick={toggleDiscountField}
                                  >
                                    {discountAuthorized ? "Remover Desconto" : "Inserir Desconto"}
                                  </button>
                                </div>
                              </li>

                              <AssociativeEditableAccountRow
                                number={3}
                                operator="="
                                label="Valor real da venda"
                                fieldState="locked"
                                meta={associativeHelp(
                                  "É o preço usado na proposta. O sistema tira o B.A. da unidade e a folga de tabela do valor do imóvel com kit.",
                                  `Conta atual: ${money.format(result.context.propertyValue)} − ${money.format(result.context.unitBonus)} − ${money.format(result.context.tableSlack)} = ${money.format(result.context.valueReal + result.context.discount)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyValue
                                    label="Valor real da venda"
                                    value={result.context.valueReal + result.context.discount}
                                  />
                                }
                                total
                              />

                              {discountAuthorized ? (
                                <>
                                  <AssociativeEditableAccountRow
                                    operator="−"
                                    label="Desconto"
                                    fieldState="editable"
                                    rowClassName="investor-associative-discount-line"
                                    meta={associativeHelp(
                                      "Desconto comercial opcional. O valor informado reduz a base usada pelos recursos e pagamentos.",
                                      `Conta atual: ${money.format(result.context.valueReal + result.context.discount)} − ${money.format(result.context.discount)} = ${money.format(result.context.valueReal)}.`,
                                    )}
                                    calculation={
                                      <AssociativeMoneyControl
                                        inputRef={discountInputRef}
                                        label="Desconto"
                                        value={discount}
                                        disabled={!associativeApprovalDetailsUnlocked}
                                        onChange={setDiscount}
                                      />
                                    }
                                    disabled={!associativeApprovalDetailsUnlocked}
                                  />
                                  <AssociativeEditableAccountRow
                                    operator="="
                                    label="Valor do imóvel"
                                    fieldState="locked"
                                    meta={associativeHelp(
                                      "Valor após o desconto comercial. Esta é a base usada no financiamento e nos demais recursos.",
                                      `Conta atual: ${money.format(result.context.valueReal + result.context.discount)} − ${money.format(result.context.discount)} = ${money.format(result.context.valueReal)}.`,
                                    )}
                                    calculation={
                                      <AssociativeMoneyValue
                                        label="Valor do imóvel"
                                        value={result.context.valueReal}
                                      />
                                    }
                                    total
                                  />
                                </>
                              ) : null}

                              <AssociativeEditableAccountRow
                                number={4}
                                operator="−"
                                label="Financiamento"
                                fieldState="editable"
                                rowClassName={`investor-key-field${associativeGuidanceStage === "financing" ? " is-active" : ""}`}
                                meta={associativeHelp(
                                  "Digite somente o financiamento aprovado pelo banco. Um valor maior que zero libera o Subsídio.",
                                  `Saldo atual: ${money.format(result.context.valueReal)} − recursos informados = ${money.format(result.context.balanceAfterResources)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyControl
                                    inputRef={associativeFinancingInputRef}
                                    label="Financiamento"
                                    value={financing}
                                    onChange={setFinancing}
                                  />
                                }
                                sideGuidance={
                                  associativeGuidanceStage === "financing" ? (
                                    <AssociativeStepGuide
                                      title="Informe o Financiamento"
                                      description="Digite um valor maior que zero para liberar o Subsídio."
                                    />
                                  ) : null
                                }
                              />
                              <AssociativeEditableAccountRow
                                number={5}
                                operator="−"
                                label="Subsídio"
                                fieldState="editable"
                                disabled={!associativeSubsidyUnlocked}
                                rowClassName={`investor-key-field${associativeGuidanceStage === "subsidy" ? " is-active" : ""}`}
                                meta={associativeHelp(
                                  "Digite o subsídio aprovado. Se não houver, digite zero para liberar o FGTS.",
                                  `Saldo atual: ${money.format(result.context.valueReal)} − recursos informados = ${money.format(result.context.balanceAfterResources)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyControl
                                    label="Subsídio"
                                    value={subsidy}
                                    disabled={!associativeSubsidyUnlocked}
                                    onChange={setSubsidy}
                                  />
                                }
                                sideGuidance={
                                  associativeGuidanceStage === "subsidy" ? (
                                    <AssociativeStepGuide
                                      title="Informe o Subsídio"
                                      description="Digite o valor aprovado ou zero quando não houver para liberar o FGTS."
                                    />
                                  ) : null
                                }
                              />
                              <AssociativeEditableAccountRow
                                number={6}
                                operator="−"
                                label="FGTS"
                                fieldState="editable"
                                disabled={!associativeFgtsUnlocked}
                                rowClassName={`investor-key-field${associativeGuidanceStage === "fgts" ? " is-active" : ""}`}
                                meta={associativeHelp(
                                  "Digite o FGTS que será usado. Se não houver, digite zero para liberar o Cheque Moradia.",
                                  `Saldo atual: ${money.format(result.context.valueReal)} − recursos informados = ${money.format(result.context.balanceAfterResources)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyControl
                                    label="FGTS"
                                    value={fgts}
                                    disabled={!associativeFgtsUnlocked}
                                    onChange={setFgts}
                                  />
                                }
                                sideGuidance={
                                  associativeGuidanceStage === "fgts" ? (
                                    <AssociativeStepGuide
                                      title="Informe o FGTS"
                                      description="Digite o valor utilizado ou zero quando não houver para liberar o Cheque Moradia."
                                    />
                                  ) : null
                                }
                              />
                              <AssociativeEditableAccountRow
                                number={7}
                                operator="−"
                                label="Cheque Moradia"
                                fieldState="editable"
                                disabled={!associativeHousingCheckUnlocked}
                                rowClassName={`investor-key-field${associativeGuidanceStage === "housingCheck" ? " is-active" : ""}`}
                                meta={associativeHelp(
                                  "Digite o valor do Cheque Moradia. Se não houver, digite zero para liberar a Entrada.",
                                  `Saldo atual: ${money.format(result.context.valueReal)} − recursos informados = ${money.format(result.context.balanceAfterResources)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyControl
                                    label="Cheque Moradia"
                                    value={housingCheck}
                                    disabled={!associativeHousingCheckUnlocked}
                                    onChange={setHousingCheck}
                                  />
                                }
                                sideGuidance={
                                  associativeGuidanceStage === "housingCheck" ? (
                                    <AssociativeStepGuide
                                      title="Informe o Cheque Moradia"
                                      description="Digite o valor utilizado ou zero quando não houver para liberar a Entrada."
                                    />
                                  ) : null
                                }
                              />

                              <AssociativeEditableAccountRow
                                number={8}
                                operator="="
                                label="Saldo após recursos"
                                fieldState="locked"
                                meta={associativeHelp(
                                  "É o valor que sobra depois de tirar Financiamento, Subsídio, FGTS e Cheque Moradia.",
                                  `Conta atual: ${money.format(result.context.valueReal)} − ${money.format(result.custom.financing)} − ${money.format(result.custom.subsidy)} − ${money.format(result.custom.fgts)} − ${money.format(result.custom.housingCheck)} = ${money.format(result.context.balanceAfterResources)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyValue
                                    label="Saldo após recursos"
                                    value={result.context.balanceAfterResources}
                                  />
                                }
                                total
                              />

                              <AssociativeEditableAccountRow
                                number={9}
                                operator="−"
                                label="Entrada"
                                date={baseDate}
                                fieldState="editable"
                                rowClassName={`investor-key-field${associativeGuidanceStage === "entry" ? " is-active" : ""}`}
                                meta={associativeHelp(
                                  `Digite quanto o cliente pagará em ${formatDate(baseDate)}. O mínimo é ${money.format(150)}. Ajustes automáticos nunca diminuem este valor.`,
                                  `Status atual: ${associativeEntryPending ? "entrada ainda não informada" : associativeEntryRejected ? "reprovada por ficar abaixo do mínimo" : "entrada válida"}.`,
                                  `Conta atual do saldo parcelado: ${money.format(result.context.balanceAfterResources)} − (${money.format(result.custom.actValue)} de entrada + ${money.format(result.custom.signalTotal)} de sinais válidos) = ${money.format(result.custom.balanceBeforeCorrection)}. As anuais não reduzem este saldo.`,
                                )}
                                calculation={
                                  <>
                                    <AssociativeMoneyControl
                                      label="Entrada"
                                      describedBy="investor-entry-meta"
                                      invalid={associativeEntryUnlocked && associativeEntryRejected}
                                      disabled={!associativeEntryUnlocked}
                                      value={entryValue}
                                      onChange={updateEntryValue}
                                    />
                                    <span
                                      className="sr-only"
                                      id="investor-entry-meta"
                                      role={
                                        associativeEntryUnlocked && associativeEntryRejected
                                          ? "alert"
                                          : "status"
                                      }
                                      aria-live="polite"
                                      aria-atomic="true"
                                    >
                                      {!associativeEntryUnlocked
                                        ? "Entrada bloqueada até concluir Financiamento, Subsídio, FGTS e Cheque Moradia"
                                        : associativeEntryPending
                                          ? "Informe a entrada"
                                          : associativeEntryRejected
                                            ? "Entrada reprovada"
                                            : "Entrada válida"}
                                    </span>
                                  </>
                                }
                                invalid={associativeEntryUnlocked && associativeEntryRejected}
                                disabled={!associativeEntryUnlocked}
                                sideGuidance={
                                  associativeGuidanceStage === "entry" ? (
                                    <AssociativeStepGuide
                                      title={
                                        associativeEntryRejected
                                          ? "Revise a Entrada"
                                          : "Informe a Entrada"
                                      }
                                      tone={associativeEntryRejected ? "rejected" : "guidance"}
                                      description={
                                        associativeEntryRejected
                                          ? "Entrada não aprovada: informe no mínimo R$ 150,00."
                                          : "Informe uma Entrada de no mínimo R$ 150,00 para liberar a quantidade de parcelas."
                                      }
                                    />
                                  ) : null
                                }
                              />

                              {visibleSignalIndexes.map((index) => {
                                const value = signals[index];
                                const signal = result.custom.signals[index];
                                const active = currencyInputNumber(value) > 0;
                                const signalInvalid =
                                  associativeApprovalDetailsUnlocked && active && !signal.approved;
                                const statusId = `investor-associative-signal-${index + 1}-status`;
                                const hideActionLabel =
                                  index === signals.length - 1
                                    ? `Ocultar Sinal ${index + 1} e zerar valor`
                                    : `Ocultar Sinal ${index + 1} e os sinais seguintes; os valores serão zerados`;
                                return (
                                  <AssociativeEditableAccountRow
                                    key={index}
                                    label={`Sinal ${index + 1}`}
                                    date={signal.date || undefined}
                                    rowClassName="payment-group-child payment-group-child-signal"
                                    fieldState="editable"
                                    leadingAction={
                                      <button
                                        type="button"
                                        className="investor-associative-row-remove"
                                        aria-label={hideActionLabel}
                                        title={hideActionLabel}
                                        disabled={!associativeApprovalDetailsUnlocked}
                                        onClick={() => hideSignalField(index)}
                                      >
                                        <span aria-hidden="true">×</span>
                                      </button>
                                    }
                                    meta={associativeHelp(
                                      `Pagamento opcional em ${formatDate(signal.date)}. O mínimo é ${money.format(150)}. ${index > 0 ? `Preencha primeiro o Sinal ${index}; este sinal não pode ser maior que o anterior.` : "O Sinal 2 não pode ser maior que este valor."}`,
                                      `Status atual: ${active ? signal.reason : "não usado"}. Valor que entra no total: ${money.format(active && signal.approved ? signal.value : 0)}.`,
                                      `Total atual dos sinais válidos: ${money.format(result.custom.signalTotal)}.`,
                                    )}
                                    calculation={
                                      <>
                                        <div className="investor-direct-editable-value investor-associative-line-control">
                                          <span aria-hidden="true">R$</span>
                                          <MoneyInput
                                            inputRef={(input) => {
                                              signalInputRefs.current[index] = input;
                                            }}
                                            label={`Sinal ${index + 1}`}
                                            describedBy={statusId}
                                            invalid={signalInvalid}
                                            disabled={!associativeApprovalDetailsUnlocked}
                                            value={value}
                                            onChange={(nextValue) => updateSignal(index, nextValue)}
                                          />
                                        </div>
                                        <span
                                          className="sr-only"
                                          id={statusId}
                                          role={signalInvalid ? "alert" : "status"}
                                          aria-live="polite"
                                        >
                                          {!associativeApprovalDetailsUnlocked
                                            ? "Sinal bloqueado até selecionar o Ranking"
                                            : active
                                              ? signal.reason
                                              : "Sinal opcional não usado"}
                                        </span>
                                      </>
                                    }
                                    invalid={signalInvalid}
                                    disabled={!associativeApprovalDetailsUnlocked}
                                  />
                                );
                              })}

                              {visibleIntermediaryIndexes.map((index) => {
                                const item = result.custom.intermediaries[index];
                                const statusId = `investor-associative-annual-${item.index}-status`;
                                const active = item.value > 0;
                                const exceedsIncomeLimit =
                                  active &&
                                  associativeIncomeValue > 0 &&
                                  item.value > associativeAnnualIncomeLimit;
                                const annualInvalid =
                                  associativeApprovalDetailsUnlocked &&
                                  active &&
                                  (!item.approved || exceedsIncomeLimit);
                                const annualStatus = exceedsIncomeLimit
                                  ? `Anual reprovada: ${money.format(item.value)} supera ${percent.format(associativeAnnualIncomeLimitRate)} da renda familiar, limite de ${money.format(associativeAnnualIncomeLimit)}.`
                                  : item.approved
                                    ? `Anual válida; valor corrigido ${money.format(item.correctedValue)}`
                                    : item.reason;
                                return (
                                  <AssociativeEditableAccountRow
                                    key={item.index}
                                    label={`Anual ${item.index}`}
                                    date={item.date || undefined}
                                    rowClassName="payment-group-child payment-group-child-annual"
                                    fieldState="editable"
                                    leadingAction={
                                      <button
                                        type="button"
                                        className="investor-associative-row-remove"
                                        aria-label={`Ocultar Anual ${item.index} e zerar valor`}
                                        title={`Ocultar Anual ${item.index}`}
                                        disabled={!associativeApprovalDetailsUnlocked}
                                        onClick={() => hideIntermediaryField(index)}
                                      >
                                        <span aria-hidden="true">×</span>
                                      </button>
                                    }
                                    meta={associativeHelp(
                                      `Pagamento opcional em ${item.date ? formatDate(item.date) : "data ainda indisponível"}. A anual não reduz o Pró-Soluto nem o Saldo parcelado; ela reduz somente a base distribuída nas mensais e ajuda nos indicadores de renda.`,
                                      active && item.approved
                                        ? `Fórmula: valor informado × 1,005 × 1,005^${result.custom.linear?.annualSchedule?.[index]?.months ?? 0}.`
                                        : "A anual só entra no cálculo quando possui valor e respeita as regras mostradas na tela.",
                                      active && item.approved
                                        ? `Conta atual: ${money.format(item.value)} × 1,005 × 1,005^${result.custom.linear?.annualSchedule?.[index]?.months ?? 0} = ${money.format(item.correctedValue)}. Status: ${item.reason}.`
                                        : `Conta atual: ${money.format(item.value)} considerada como ${money.format(0)} no total corrigido. Status: ${active ? item.reason : "não usada"}.`,
                                    )}
                                    calculation={
                                      <>
                                        <div className="investor-direct-editable-value investor-associative-line-control">
                                          <span aria-hidden="true">R$</span>
                                          <MoneyInput
                                            inputRef={(input) => {
                                              intermediaryInputRefs.current[index] = input;
                                            }}
                                            label={`Anual ${item.index}`}
                                            describedBy={statusId}
                                            invalid={annualInvalid}
                                            disabled={!associativeApprovalDetailsUnlocked}
                                            value={intermediaries[index]}
                                            onChange={(nextValue) =>
                                              updateIntermediary(index, nextValue)
                                            }
                                          />
                                        </div>
                                        <span
                                          className="sr-only"
                                          id={statusId}
                                          role={annualInvalid ? "alert" : "status"}
                                          aria-live="polite"
                                        >
                                          {!associativeApprovalDetailsUnlocked
                                            ? "Anual bloqueada até selecionar o Ranking"
                                            : active
                                              ? annualStatus
                                              : "Anual opcional não usada"}
                                        </span>
                                      </>
                                    }
                                    invalid={annualInvalid}
                                    disabled={!associativeApprovalDetailsUnlocked}
                                  />
                                );
                              })}

                              <AssociativeEditableAccountRow
                                number={18}
                                operator="="
                                label="Saldo parcelado"
                                fieldState="locked"
                                meta={associativeHelp(
                                  "É o Pró-Soluto antes da correção. Anuais não alteram este valor.",
                                  `Conta atual: saldo após recursos ${money.format(result.context.balanceAfterResources)} − entrada ${money.format(result.custom.actValue)} − sinais ${money.format(result.custom.signalTotal)} = ${money.format(result.custom.balanceBeforeCorrection)}. Base das mensais após anuais: ${money.format(result.custom.installmentBalanceBeforeCorrection)}.`,
                                )}
                                calculation={
                                  <AssociativeMoneyValue
                                    label="Saldo parcelado"
                                    value={result.custom.balanceBeforeCorrection}
                                  />
                                }
                                total
                              />

                              <AssociativeEditableAccountRow
                                number={19}
                                operator="÷"
                                label="Qtd. de parcelas"
                                fieldState="editable"
                                rowClassName={`investor-key-field${associativeGuidanceStage === "installments" ? " is-active" : ""}`}
                                meta={associativeHelp(
                                  `Digite um número inteiro entre 1 e ${result.context.maxInstallments}. O sistema divide as parcelas em 4 blocos: 40%, 30%, 20% e 10%.`,
                                  `A entrega separa as parcelas antes e depois da obra. Conta atual: ${result.custom.preInstallments} antes + ${result.custom.postInstallments} depois = ${result.custom.desiredInstallments} parcelas.`,
                                  `Status atual: ${associativeInstallmentsRejected ? (!result.context.installmentsInteger ? "informe um número inteiro" : associativeBlockDistributionError || `use de 1 a ${result.context.maxInstallments}`) : "quantidade dentro da regra"}.`,
                                )}
                                calculation={
                                  <>
                                    <div className="investor-direct-editable-value investor-associative-installment-control">
                                      <input
                                        aria-label="Quantidade de parcelas"
                                        name="quantidade-de-parcelas"
                                        autoComplete="off"
                                        aria-describedby="investor-installment-guidance investor-associative-installment-status"
                                        aria-invalid={
                                          (associativeInstallmentsUnlocked &&
                                            associativeInstallmentsRejected) ||
                                          undefined
                                        }
                                        type="number"
                                        min="1"
                                        max={result.context.maxInstallments || 1}
                                        step="1"
                                        value={installments}
                                        placeholder="0"
                                        disabled={
                                          !associativeInstallmentsUnlocked ||
                                          result.context.maxInstallments <= 0
                                        }
                                        onChange={(event) => setInstallments(event.target.value)}
                                      />
                                    </div>
                                    <span
                                      className="sr-only"
                                      id="investor-associative-installment-status"
                                      role={
                                        associativeInstallmentsUnlocked &&
                                        associativeInstallmentsRejected
                                          ? "alert"
                                          : "status"
                                      }
                                      aria-live="polite"
                                      aria-atomic="true"
                                    >
                                      {associativeInstallmentsRejected
                                        ? !result.context.installmentsInteger
                                          ? "Informe um número inteiro"
                                          : associativeBlockDistributionError ||
                                            `Use de 1 a ${result.context.maxInstallments} parcelas`
                                        : `${result.custom.preInstallments} parcelas pré-obra mais ${result.custom.postInstallments} parcelas pós-obra totalizam ${result.custom.desiredInstallments}`}
                                    </span>
                                  </>
                                }
                                invalid={
                                  associativeInstallmentsUnlocked && associativeInstallmentsRejected
                                }
                                disabled={!associativeInstallmentsUnlocked}
                                sideGuidance={
                                  associativeGuidanceStage === "installments" ? (
                                    <AssociativeStepGuide
                                      title="Informe a Qtd. de parcelas"
                                      tone={
                                        associativeInstallmentsRejected && installments !== ""
                                          ? "rejected"
                                          : "guidance"
                                      }
                                      description={
                                        associativeBlockDistributionError ||
                                        `Use um número inteiro entre 1 e ${result.context.maxInstallments} para liberar o Ranking.`
                                      }
                                    />
                                  ) : null
                                }
                              />
                            </ol>
                          </div>
                        </div>
                        {associativeRankingUnlocked ? (
                          <div
                            className={`investor-associative-results-stack${associativeApprovalDetailsUnlocked ? "is-complete" : "is-ranking-only"}`}
                          >
                            <AssociativeApprovalPanel
                              tierId={associativeApprovalTier}
                              onTierChange={setAssociativeApprovalTier}
                              income={currencyInputNumber(income)}
                              realSaleValue={result.context.valueReal}
                              proSoluto={result.custom.balanceBeforeCorrection}
                              linearInstallment={associativePaymentComparison.highestLinearPayment}
                              decreasingInstallment={
                                associativePaymentComparison.highestDecreasingPayment
                              }
                              linearMaximumIncomePayment={
                                associativePaymentComparison.highestLinearTotal
                              }
                              decreasingMaximumIncomePayment={
                                associativePaymentComparison.highestDecreasingTotal
                              }
                              linearInstallmentDate={
                                associativePaymentComparison.highestLinearPaymentRow?.paymentDate
                              }
                              decreasingInstallmentDate={
                                associativePaymentComparison.highestDecreasingPaymentRow
                                  ?.paymentDate
                              }
                              linearMaximumIncomeDate={
                                associativePaymentComparison.highestLinearTotalRow?.paymentDate
                              }
                              decreasingMaximumIncomeDate={
                                associativePaymentComparison.highestDecreasingTotalRow?.paymentDate
                              }
                              comparisonReady={
                                associativePaymentComparison.comparisonAvailable &&
                                Boolean(result.custom.decreasing?.ok)
                              }
                              proposalValid={result.ok && Boolean(result.custom.decreasing?.ok)}
                              proposalError={associativeProposalError}
                              financingReady={associativeFinancingValueReady}
                              entryPending={associativeEntryPending}
                              entryRejected={associativeEntryRejected}
                              currentEntryDate={baseDate}
                              currentSignalPayments={result.custom.signals.map(
                                (item: { index: number; date: string; value: number }) => ({
                                  label: `Sinal ${item.index}`,
                                  date: item.date,
                                  value: item.value,
                                }),
                              )}
                              currentAnnualPayments={result.custom.intermediaries.map(
                                (item: { index: number; date: string; value: number }) => ({
                                  label: `Anual ${item.index}`,
                                  date: item.date,
                                  value: item.value,
                                }),
                              )}
                              releaseStatus={associativeReleaseStatus}
                              onBuildFlowSuggestion={buildAssociativeFlowSuggestion}
                              onApplyFlowSuggestion={applyAssociativeFlowSuggestion}
                            />
                            {associativeApprovalDetailsUnlocked ? (
                              <AssociativePaymentSummary
                                available={associativePaymentSummaryAvailable}
                                installments={result.custom.desiredInstallments}
                                linearUncorrected={associativeLinearUncorrected}
                                linearCorrected={result.custom.installmentValue}
                                linearFirstDate={firstInstallmentDate}
                                linearLastDate={lastInstallmentDate}
                                blocks={result.custom.decreasing?.blocks ?? []}
                                onShowInstallments={() =>
                                  associativeInstallmentsDialog.current?.showModal()
                                }
                              />
                            ) : null}
                          </div>
                        ) : null}
                        <AssociativeInstallmentDialog
                          dialogRef={associativeInstallmentsDialog}
                          comparison={associativePaymentComparison}
                          installments={result.custom.desiredInstallments}
                          preInstallments={result.custom.preInstallments}
                          postInstallments={result.custom.postInstallments}
                          uncorrectedBalance={result.custom.balanceBeforeCorrection}
                        />
                      </div>
                    ) : (
                      <div
                        className="investor-payment-controls"
                        role="group"
                        aria-labelledby="investor-flow-title"
                      >
                        {!directVisualLayout ? (
                          <article
                            className="investor-property-value-step investor-payment-step"
                            data-step="01"
                            data-operator=""
                          >
                            <span>Valor do imóvel</span>
                            <strong>{money.format(result.context.valueReal)}</strong>
                          </article>
                        ) : null}
                        <label
                          className={`investor-entry-field investor-payment-step${associativeEntryRejected ? "rejected" : ""}`}
                          data-step={directVisualLayout ? "01" : "02"}
                          data-operator="−"
                        >
                          <span className="investor-control-heading">
                            <span className="investor-entry-title">Entrada</span>
                            <small className="investor-entry-minimum">
                              <span>Mínimo</span>
                              <span>
                                {annualMode
                                  ? money.format(150)
                                  : `${money.format(result.context.valueReal * 0.06)} (6%)`}
                              </span>
                            </small>
                          </span>
                          <div>
                            <b>R$</b>
                            <MoneyInput
                              label="Entrada"
                              describedBy="investor-entry-meta"
                              invalid={associativeEntryRejected}
                              value={entryValue}
                              onChange={updateEntryValue}
                            />
                          </div>
                          <small className="investor-money-meta" id="investor-entry-meta">
                            <b role={associativeEntryRejected ? "alert" : undefined}>
                              {annualMode
                                ? associativeEntryPending
                                  ? "Informe a entrada"
                                  : associativeEntryRejected
                                    ? "Reprovada · mínimo R$ 150,00"
                                    : "Entrada válida"
                                : `${percent.format(result.custom.actRate)} do valor real`}
                            </b>
                            <span>Pagamento {formatDate(baseDate)}</span>
                          </small>
                        </label>

                        <div
                          className={`investor-signal-disclosure ${signalsRequired ? "required" : "optional"}`}
                          data-step={directVisualLayout ? "02" : "03"}
                          data-operator="−"
                        >
                          <div className="investor-option-heading">
                            <strong>Sinais</strong>
                            <InvestorInfoHint
                              label="sinais"
                              title="Quer usar sinais?"
                              description="Sinal 1, 2 e 3 são opcionais e podem aumentar a entrada ou liberar mais parcelas."
                            />
                          </div>
                          <fieldset
                            className="investor-intermediaries investor-inline-payment-fields investor-signal-fields"
                            id="investor-signal-fields"
                            hidden={!signalsVisible}
                          >
                            <legend className="sr-only">Sinais da entrada</legend>
                            <div>
                              {signals.slice(0, visibleSignalCount).map((value, index) => {
                                const signal = result.custom.signals[index];
                                const active = currencyInputNumber(value) > 0;
                                return (
                                  <label
                                    key={index}
                                    className={
                                      active ? (signal.approved ? "approved" : "rejected") : ""
                                    }
                                  >
                                    <span>
                                      Sinal {index + 1}
                                      <small>{signal.status}</small>
                                    </span>
                                    <div>
                                      <b>R$</b>
                                      <MoneyInput
                                        inputRef={(input) => {
                                          signalInputRefs.current[index] = input;
                                        }}
                                        label={`Sinal ${index + 1}`}
                                        value={value}
                                        onChange={(nextValue) => updateSignal(index, nextValue)}
                                      />
                                    </div>
                                    <em role={active && !signal.approved ? "alert" : undefined}>
                                      {active
                                        ? `${percent.format(signal.rate)} do valor · ${formatDate(signal.date)} · ${signal.reason}`
                                        : `Previsto para ${formatDate(signal.date)}`}
                                    </em>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                          {signalsRequired ? (
                            <small
                              className="investor-required-note"
                              role="status"
                              aria-live="polite"
                            >
                              Entrada abaixo de 10%. Faltam{" "}
                              <b>{money.format(missingForMinimumEntry)}</b>.
                            </small>
                          ) : null}
                          <div className="investor-disclosure-actions">
                            {directVisualLayout ? (
                              <span className="investor-ledger-result-summary">
                                <small>Total em sinais</small>
                                <strong>{money.format(result.custom.signalTotal)}</strong>
                              </span>
                            ) : null}
                            {visibleSignalCount < signals.length ? (
                              <button
                                ref={signalActionRef}
                                className="investor-option-toggle"
                                type="button"
                                aria-expanded={signalsVisible}
                                aria-controls="investor-signal-fields"
                                onClick={addSignalField}
                              >
                                {signalsVisible ? "Adicionar outro sinal" : "Adicionar sinal"}
                              </button>
                            ) : (
                              <span className="investor-option-limit">Limite de 3 sinais</span>
                            )}
                            {signalsRequired && signalDistributionMode === "manual" ? (
                              <button
                                className="investor-option-reset"
                                type="button"
                                onClick={() => setSignalDistributionMode("auto")}
                              >
                                Redistribuir automaticamente
                              </button>
                            ) : null}
                            {signalsVisible ? (
                              <button
                                className="investor-option-reset"
                                type="button"
                                onClick={clearSignalFields}
                              >
                                {signalsRequired ? "Zerar sinais" : "Ocultar e zerar"}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className="investor-signal-disclosure investor-intermediary-disclosure optional"
                          data-step={directVisualLayout ? "03" : "04"}
                          data-operator="−"
                        >
                          <div className="investor-option-heading">
                            <strong>{annualMode ? "Anuais" : "Intermediárias"}</strong>
                            <InvestorInfoHint
                              label={annualMode ? "anuais" : "intermediárias"}
                              title={annualMode ? "Quer usar anuais?" : "Quer usar intermediárias?"}
                              description={
                                annualMode
                                  ? "Até 5 anuais opcionais, com vencimento em 15/12 e limite pelo término da obra. O valor é corrigido em 0,5% no início e 0,5% ao mês."
                                  : `Opcional · até 5% cada · máximo ${intermediaryFieldLimit || 3} pagamentos neste fluxo.`
                              }
                            />
                          </div>
                          <fieldset
                            className="investor-intermediaries investor-inline-payment-fields"
                            id="investor-intermediary-fields"
                            hidden={!intermediariesVisible}
                          >
                            <legend className="sr-only">
                              {annualMode ? "Anuais" : "Intermediárias"}
                            </legend>
                            <div>
                              {result.custom.intermediaries
                                .slice(0, visibleIntermediaryCount)
                                .map((item, index) => (
                                  <label
                                    key={item.index}
                                    className={
                                      item.value > 0
                                        ? item.approved
                                          ? "approved"
                                          : "rejected"
                                        : ""
                                    }
                                  >
                                    <span>
                                      {annualMode ? "Anual" : "Intermediária"} {item.index}
                                      <small>
                                        {item.date
                                          ? `Pagamento ${formatDate(item.date)}`
                                          : "Data indisponível"}
                                      </small>
                                    </span>
                                    <div>
                                      <b>R$</b>
                                      <MoneyInput
                                        inputRef={(input) => {
                                          intermediaryInputRefs.current[index] = input;
                                        }}
                                        label={`${annualMode ? "Anual" : "Intermediária"} ${item.index}`}
                                        max={
                                          annualMode ? undefined : result.context.valueReal * 0.05
                                        }
                                        value={intermediaries[index]}
                                        onChange={(nextValue) =>
                                          updateIntermediary(index, nextValue)
                                        }
                                      />
                                    </div>
                                    <em>
                                      {item.value > 0
                                        ? annualMode && item.approved
                                          ? `Corrigida: ${money.format(item.correctedValue)} · ${item.reason}`
                                          : `${percent.format(item.rate)} do valor · ${item.reason}`
                                        : annualMode
                                          ? "Opcional"
                                          : `Máximo ${money.format(result.context.valueReal * 0.05)}`}
                                    </em>
                                  </label>
                                ))}
                            </div>
                          </fieldset>
                          <div className="investor-disclosure-actions">
                            {directVisualLayout ? (
                              <span className="investor-ledger-result-summary">
                                <small>{annualMode ? "Total corrigido" : "Total válido"}</small>
                                <strong>
                                  {money.format(result.custom.validIntermediaryTotal)}
                                </strong>
                              </span>
                            ) : null}
                            {visibleIntermediaryCount < intermediaryFieldLimit ? (
                              <button
                                ref={intermediaryActionRef}
                                className="investor-option-toggle"
                                type="button"
                                aria-expanded={intermediariesVisible}
                                aria-controls="investor-intermediary-fields"
                                onClick={addIntermediaryField}
                              >
                                {intermediariesVisible
                                  ? `Adicionar outra ${annualMode ? "anual" : "intermediária"}`
                                  : `Adicionar ${annualMode ? "anual" : "intermediária"}`}
                              </button>
                            ) : intermediaryFieldLimit > 0 ? (
                              <span className="investor-option-limit">
                                Limite de {intermediaryFieldLimit}{" "}
                                {annualMode ? "anuais" : "intermediárias"}
                              </span>
                            ) : (
                              <span className="investor-option-limit">
                                Libere com 10% de entrada
                              </span>
                            )}
                            {intermediariesVisible ? (
                              <button
                                className="investor-option-reset"
                                type="button"
                                onClick={clearIntermediaryFields}
                              >
                                Ocultar e zerar
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div
                          className="investor-final-field investor-final-action"
                          data-step={directVisualLayout ? "04" : "05"}
                          data-operator="−"
                        >
                          <span className="investor-final-field-heading">
                            <span>Desconto</span>
                            <InvestorInfoHint
                              label="desconto"
                              title="Como funciona o desconto?"
                              description="Use somente quando o cliente solicitar. Sem impacto enquanto estiver desativado e aplicado apenas quando autorizado."
                            />
                          </span>
                          {directVisualLayout ? (
                            <>
                              <div className="investor-ledger-control-stack">
                                <label
                                  className="investor-discount-field investor-inline-discount-field"
                                  id="investor-discount-field"
                                  hidden={!discountAuthorized}
                                >
                                  <span>Valor autorizado</span>
                                  <div>
                                    <b>R$</b>
                                    <MoneyInput
                                      inputRef={discountInputRef}
                                      label="Desconto autorizado"
                                      value={discount}
                                      onChange={setDiscount}
                                    />
                                  </div>
                                </label>
                                <button
                                  className={`investor-option-toggle ${discountAuthorized ? "active" : ""}`}
                                  type="button"
                                  aria-pressed={discountAuthorized}
                                  aria-expanded={discountAuthorized}
                                  aria-controls="investor-discount-field"
                                  onClick={toggleDiscountField}
                                >
                                  {discountAuthorized
                                    ? "Ocultar e zerar desconto"
                                    : "Aplicar desconto"}
                                </button>
                              </div>
                              <span className="investor-ledger-result-summary">
                                <small>Valor real</small>
                                <strong>{money.format(result.context.valueReal)}</strong>
                              </span>
                            </>
                          ) : (
                            <>
                              <label
                                className="investor-discount-field investor-inline-discount-field"
                                id="investor-discount-field"
                                hidden={!discountAuthorized}
                              >
                                <span>Valor autorizado</span>
                                <div>
                                  <b>R$</b>
                                  <MoneyInput
                                    inputRef={discountInputRef}
                                    label="Desconto autorizado"
                                    value={discount}
                                    onChange={setDiscount}
                                  />
                                </div>
                              </label>
                              <button
                                className={`investor-option-toggle ${discountAuthorized ? "active" : ""}`}
                                type="button"
                                aria-pressed={discountAuthorized}
                                aria-expanded={discountAuthorized}
                                aria-controls="investor-discount-field"
                                onClick={toggleDiscountField}
                              >
                                {discountAuthorized
                                  ? "Ocultar e zerar desconto"
                                  : "Aplicar desconto"}
                              </button>
                            </>
                          )}
                        </div>
                        <label
                          className="investor-installments-field"
                          data-step={directVisualLayout ? "05" : "06"}
                          data-operator="÷"
                        >
                          <span className="investor-installments-heading">
                            <span>Qtd. de parcelas</span>
                            <small>
                              {annualMode
                                ? "Plano fixo"
                                : `Máximo ${result.context.maxInstallments}`}
                            </small>
                          </span>
                          <input
                            aria-describedby="investor-installment-guidance"
                            aria-readonly={annualMode}
                            readOnly={annualMode}
                            type="number"
                            min="1"
                            max={result.context.maxInstallments || 1}
                            step="1"
                            value={result.context.maxInstallments > 0 ? installments : ""}
                            placeholder="Indisponível"
                            disabled={result.context.maxInstallments <= 0}
                            onChange={(event) => {
                              if (!annualMode) setInstallments(event.target.value);
                            }}
                          />
                          <span className="investor-installments-preview">
                            <span>
                              {annualMode ? (
                                <>
                                  <strong>Parcela corrigida</strong>{" "}
                                  {money.format(result.custom.installmentValue)}
                                </>
                              ) : (
                                <>
                                  <strong>{result.custom.desiredInstallments}x</strong> de{" "}
                                  {money.format(result.custom.installmentValue)}
                                </>
                              )}
                            </span>
                            <small>
                              {annualMode
                                ? `${result.custom.preInstallments} pré + ${result.custom.postInstallments} pós = ${result.custom.desiredInstallments}`
                                : `1ª em ${formatPaymentDate(firstInstallmentDate)}`}
                            </small>
                          </span>
                        </label>
                      </div>
                    )}
                    <span className="sr-only" id="investor-installment-guidance">
                      {annualMode
                        ? "Informe uma quantidade inteira entre 1 e 84 parcelas para o plano Associativo."
                        : "A quantidade máxima de parcelas varia conforme a entrada total e o prazo da obra."}
                    </span>
                  </>
                )}
              </div>
            </fieldset>
            {annualMode && associativeApprovalDetailsUnlocked ? (
              <button
                type="button"
                className="investor-associative-commission-launcher"
                aria-label="Abrir remuneração comercial"
                aria-haspopup="dialog"
                aria-controls="investor-associative-commission-dialog"
                onClick={() => associativeCommissionDialog.current?.showModal()}
              >
                <span aria-hidden="true">$</span>
              </button>
            ) : null}
          </section>

          {annualMode ? (
            <div className="investor-associative-documentation-strip">
              <fieldset
                className="investor-associative-documentation-lock"
                disabled={associativeCalculatedProposalLocked}
                aria-disabled={associativeCalculatedProposalLocked || undefined}
              >
                <legend className="sr-only">Resultado da documentação</legend>
                <AssociativeDocumentationPanel
                  businessUnit={selectedUnit.businessUnit}
                  modality={associativeFinancingModality}
                  manualModalityPreference={associativeManualModalityPreference}
                  firstProperty={associativeFirstProperty}
                  salePrice={result.context.valueReal}
                  reportedAppraisal={selectedUnit.appraisal ?? 0}
                  appraisalOverride={documentationAppraisalOverride}
                  financing={financing}
                  income={income}
                  baseDate={baseDate}
                  onAppraisalOverrideChange={setDocumentationAppraisalOverride}
                />
              </fieldset>
              <AssociativeCommissionDialog
                dialogRef={associativeCommissionDialog}
                realSaleValue={result.context.valueReal + result.context.discount}
                propertyValue={result.context.valueReal}
                cashBackSlack={selectedUnit.cashBackSlack ?? 0}
              />
            </div>
          ) : null}

          {!directTable && !annualMode ? (
            <section
              className={`investor-result-panel ${result.ok ? "approved" : "blocked"}${directVisualLayout ? "investor-direct-copy-result" : ""}`}
              aria-labelledby="investor-result-title"
              data-tour="result"
            >
              <header className="investor-result-heading">
                <span>{directTable ? "05" : annualMode ? "05" : "04"}</span>
                <div>
                  <p>Resultado da proposta</p>
                  <h2 id="investor-result-title">
                    {directTable ? "Resultado Tabela Direta" : "Valor do parcelamento"}
                  </h2>
                  <small className="investor-result-status" role="status" aria-live="polite">
                    {directTable
                      ? result.status
                      : result.ok
                        ? "Proposta dentro da regra"
                        : "Ajuste necessário"}
                  </small>
                </div>
                <div className="investor-result-actions" data-tour="documents">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-controls="investor-documentation-pf"
                    onClick={() => pfDocumentationDialog.current?.showModal()}
                  >
                    Doc Pessoa Física
                  </button>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-controls="investor-documentation-pj"
                    onClick={() => pjDocumentationDialog.current?.showModal()}
                  >
                    Doc Pessoa Jurídica
                  </button>
                  <button type="button" onClick={() => window.print()}>
                    Imprimir
                  </button>
                  <InvestorCommercialLinks />
                </div>
              </header>
              <DocumentationDialog
                type="pf"
                dialogRef={pfDocumentationDialog}
                directTable={directTable}
              />
              <DocumentationDialog
                type="pj"
                dialogRef={pjDocumentationDialog}
                directTable={directTable}
              />
              <div className="investor-result-summary-grid">
                <section
                  className="investor-result-breakdown"
                  aria-labelledby="investor-composition-title"
                >
                  <h3 id="investor-composition-title">Composição</h3>
                  {directTable ? (
                    <ol
                      className="investor-stage-trail investor-result-stage-trail"
                      aria-label="Etapas da composição da proposta"
                    >
                      <li>
                        <span>1</span>Valor do imóvel
                      </li>
                      <li>
                        <span>2</span>Entrada
                      </li>
                      <li>
                        <span>3</span>Pré-chaves
                      </li>
                      <li>
                        <span>4</span>Pós-chaves
                      </li>
                      <li>
                        <span>5</span>Crédito
                      </li>
                    </ol>
                  ) : (
                    <ol
                      className="investor-stage-trail investor-result-stage-trail"
                      aria-label="Etapas da composição da proposta"
                    >
                      <li>
                        <span>1</span>Valor do imóvel
                      </li>
                      <li>
                        <span>2</span>Entrada
                      </li>
                      {result.custom.signalTotal > 0 ? (
                        <>
                          <li>
                            <span>3</span>Sinais
                          </li>
                          <li>
                            <span>4</span>Entrada total
                          </li>
                        </>
                      ) : null}
                      {result.custom.validIntermediaryTotal > 0 ? (
                        <li>
                          <span>{result.custom.signalTotal > 0 ? 5 : 3}</span>
                          {annualMode ? "Anuais" : "Intermediárias"}
                        </li>
                      ) : null}
                      <li>
                        <span>
                          {3 +
                            (result.custom.signalTotal > 0 ? 2 : 0) +
                            (result.custom.validIntermediaryTotal > 0 ? 1 : 0)}
                        </span>
                        {annualMode ? "Pró-soluto corrigido" : "Saldo parcelado"}
                      </li>
                      {annualMode ? (
                        <>
                          {result.custom.preInstallments > 0 ? (
                            <li>
                              <span>→</span>Mensais pré-obra
                            </li>
                          ) : null}
                          {result.custom.postInstallments > 0 ? (
                            <li>
                              <span>→</span>Mensais pós-obra
                            </li>
                          ) : null}
                        </>
                      ) : null}
                      <li>
                        <span>
                          {annualMode
                            ? "="
                            : 4 +
                              (result.custom.signalTotal > 0 ? 2 : 0) +
                              (result.custom.validIntermediaryTotal > 0 ? 1 : 0)}
                        </span>
                        {annualMode ? "Parcela corrigida" : "Parcela mensal"}
                      </li>
                    </ol>
                  )}
                  {directTable ? (
                    <dl>
                      <div>
                        <dt>Valor real da venda</dt>
                        <dd>{money.format(result.context.valueReal)}</dd>
                      </div>
                      <div>
                        <dt>Ato ({percent.format(result.custom.actRate)})</dt>
                        <dd>{money.format(result.custom.actValue)}</dd>
                      </div>
                      {result.custom.signalTotal > 0 ? (
                        <div>
                          <dt>
                            Sinais<small>Pagamentos em {activeSignalDates.join(", ")}</small>
                          </dt>
                          <dd>{money.format(result.custom.signalTotal)}</dd>
                        </div>
                      ) : null}
                      {result.custom.validIntermediaryTotal > 0 ? (
                        <div>
                          <dt>
                            {annualMode ? "Anuais corrigidas" : "Intermediárias válidas"}
                            <small>Pagamentos em {validIntermediaryDates.join(", ")}</small>
                          </dt>
                          <dd>{money.format(result.custom.validIntermediaryTotal)}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>
                          Mensais pré-chaves
                          <small>
                            1ª em {formatPaymentDate(result.custom.firstPreKeysDate)} · última em{" "}
                            {formatPaymentDate(result.custom.lastPreKeysDate)}
                          </small>
                        </dt>
                        <dd>
                          <strong>{result.custom.desiredInstallments}x</strong> de{" "}
                          {money.format(result.custom.installmentValue)}
                        </dd>
                      </div>
                      <div className="investor-result-installment-total">
                        <dt>
                          Mensais pós-chaves
                          <small>
                            1ª em {formatPaymentDate(result.custom.firstPostKeysDate)} · juros, MIP
                            e DFI
                          </small>
                        </dt>
                        <dd>
                          <strong>{result.custom.postKeysInstallments}x</strong> de{" "}
                          {money.format(result.custom.postKeysPayment)}
                        </dd>
                      </div>
                      <div className="investor-result-breakdown-total">
                        <dt>Renda e comprometimento</dt>
                        <dd>
                          {result.custom.income > 0
                            ? `${money.format(result.custom.income)} · ${percent.format(result.custom.commitment)}`
                            : "Renda não informada"}
                        </dd>
                      </div>
                      <div>
                        <dt>Status do crédito</dt>
                        <dd>
                          <strong>
                            {result.custom.income > 0
                              ? result.custom.creditApproved
                                ? "APROVADO"
                                : "REPROVADO"
                              : "PENDENTE"}
                          </strong>
                        </dd>
                      </div>
                    </dl>
                  ) : annualMode ? (
                    <dl>
                      <div>
                        <dt>
                          Valor real da venda<small>Imóvel − B.A. − folga</small>
                        </dt>
                        <dd>{money.format(result.context.valueReal)}</dd>
                      </div>
                      {result.custom.financing > 0 ? (
                        <div>
                          <dt>Financiamento</dt>
                          <dd>− {money.format(result.custom.financing)}</dd>
                        </div>
                      ) : null}
                      {result.custom.subsidy > 0 ? (
                        <div>
                          <dt>Subsídio</dt>
                          <dd>− {money.format(result.custom.subsidy)}</dd>
                        </div>
                      ) : null}
                      {result.custom.fgts > 0 ? (
                        <div>
                          <dt>FGTS</dt>
                          <dd>− {money.format(result.custom.fgts)}</dd>
                        </div>
                      ) : null}
                      {result.custom.housingCheck > 0 ? (
                        <div>
                          <dt>Cheque Moradia</dt>
                          <dd>− {money.format(result.custom.housingCheck)}</dd>
                        </div>
                      ) : null}
                      <div className="investor-result-breakdown-total">
                        <dt>Saldo após recursos</dt>
                        <dd>{money.format(result.custom.balanceAfterResources)}</dd>
                      </div>
                      <div>
                        <dt>Entrada ({percent.format(result.custom.actRate)})</dt>
                        <dd>{money.format(result.custom.actValue)}</dd>
                      </div>
                      {result.custom.signalTotal > 0 ? (
                        <>
                          <div>
                            <dt>
                              Sinais<small>Pagamentos em {activeSignalDates.join(", ")}</small>
                            </dt>
                            <dd>{money.format(result.custom.signalTotal)}</dd>
                          </div>
                          <div className="investor-result-breakdown-total">
                            <dt>Entrada total ({percent.format(result.custom.totalEntryRate)})</dt>
                            <dd>{money.format(result.custom.totalEntryValue)}</dd>
                          </div>
                        </>
                      ) : null}
                      {result.custom.validIntermediaryTotal > 0 ? (
                        <div>
                          <dt>
                            Anuais corrigidas
                            <small>Pagamentos em {validIntermediaryDates.join(", ")}</small>
                          </dt>
                          <dd>{money.format(result.custom.validIntermediaryTotal)}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>
                          Pró-soluto<small>Saldo antes da correção</small>
                        </dt>
                        <dd>{money.format(result.custom.linear?.proSoluto ?? 0)}</dd>
                      </div>
                      <div>
                        <dt>
                          Pró-soluto corrigido
                          <small>
                            Taxa-base de {percent.format(result.custom.linear?.baseRate ?? 0)} a.m.
                            · anuais não reduzem
                          </small>
                        </dt>
                        <dd>{money.format(result.custom.correctedProSoluto)}</dd>
                      </div>
                      {result.custom.preInstallments > 0 ? (
                        <div>
                          <dt>
                            Mensais pré-obra<small>Taxa de 0,5% a.m.</small>
                          </dt>
                          <dd>
                            <strong>{result.custom.preInstallments}x</strong> de{" "}
                            {money.format(result.custom.linear?.prePayment ?? 0)}
                          </dd>
                        </div>
                      ) : null}
                      {result.custom.postInstallments > 0 ? (
                        <div>
                          <dt>
                            Mensais pós-obra<small>Taxa de 1,5% a.m.</small>
                          </dt>
                          <dd>
                            <strong>{result.custom.postInstallments}x</strong> de{" "}
                            {money.format(result.custom.linear?.postPayment ?? 0)}
                          </dd>
                        </div>
                      ) : null}
                      <div className="investor-result-installment-total">
                        <dt>
                          Parcela corrigida
                          <small>
                            1ª em {formatPaymentDate(firstInstallmentDate)} · última em{" "}
                            {formatPaymentDate(lastInstallmentDate)}
                          </small>
                        </dt>
                        <dd>{money.format(result.custom.installmentValue)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <dl>
                      <div>
                        <dt>Valor do imóvel</dt>
                        <dd>{money.format(result.context.valueReal)}</dd>
                      </div>
                      <div>
                        <dt>Entrada ({percent.format(result.custom.actRate)})</dt>
                        <dd>{money.format(result.custom.actValue)}</dd>
                      </div>
                      {result.custom.signalTotal > 0 ? (
                        <>
                          <div>
                            <dt>
                              Sinais<small>Pagamentos em {activeSignalDates.join(", ")}</small>
                            </dt>
                            <dd>{money.format(result.custom.signalTotal)}</dd>
                          </div>
                          <div className="investor-result-breakdown-total">
                            <dt>Entrada total ({percent.format(result.custom.totalEntryRate)})</dt>
                            <dd>{money.format(result.custom.totalEntryValue)}</dd>
                          </div>
                        </>
                      ) : null}
                      {result.custom.validIntermediaryTotal > 0 ? (
                        <div>
                          <dt>
                            {annualMode ? "Anuais corrigidas" : "Intermediárias válidas"}
                            <small>Pagamentos em {validIntermediaryDates.join(", ")}</small>
                          </dt>
                          <dd>{money.format(result.custom.validIntermediaryTotal)}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Saldo parcelado</dt>
                        <dd>{money.format(result.custom.balance)}</dd>
                      </div>
                      <div className="investor-result-installment-total">
                        <dt>
                          Parcela mensal
                          <small>
                            1ª em {formatPaymentDate(firstInstallmentDate)} · última em{" "}
                            {formatPaymentDate(lastInstallmentDate)}
                          </small>
                        </dt>
                        <dd>
                          <strong>{result.custom.desiredInstallments}x</strong> de{" "}
                          {money.format(result.custom.installmentValue)}
                        </dd>
                      </div>
                    </dl>
                  )}
                </section>
              </div>
            </section>
          ) : null}
          {annualMode ? (
            <>
              <section
                className="investor-direct-resource-actions investor-associative-resource-actions"
                aria-labelledby="investor-associative-resources-title"
                data-tour="documents"
              >
                <h2 id="investor-associative-resources-title" className="sr-only">
                  Ajuda, documentação e impressão do Associativo
                </h2>
                <InvestorLearningManual associative />
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="investor-documentation-pf"
                  onClick={() => pfDocumentationDialog.current?.showModal()}
                >
                  Doc Pessoa Física
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Imprimir a proposta associativa"
                >
                  Imprimir
                </button>
                <InvestorCommercialLinks />
              </section>
              <DocumentationDialog type="pf" dialogRef={pfDocumentationDialog} associative />
            </>
          ) : directTable ? (
            <>
              <section
                className="investor-direct-resource-actions"
                aria-labelledby="investor-direct-resources-title"
                data-tour="resources"
              >
                <h2 id="investor-direct-resources-title" className="sr-only">
                  Ajuda e documentação da Tabela Direta
                </h2>
                <InvestorLearningManual directTable />
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="investor-documentation-pf"
                  onClick={() => pfDocumentationDialog.current?.showModal()}
                >
                  Doc Pessoa Física
                </button>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="investor-documentation-pj"
                  onClick={() => pjDocumentationDialog.current?.showModal()}
                >
                  Doc Pessoa Jurídica
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Imprimir a proposta"
                >
                  Imprimir
                </button>
                <InvestorCommercialLinks />
              </section>
              <DocumentationDialog type="pf" dialogRef={pfDocumentationDialog} directTable />
              <DocumentationDialog type="pj" dialogRef={pjDocumentationDialog} directTable />
            </>
          ) : null}
          {!annualMode ? (
            <details className="investor-audit investor-proposal-audit" data-tour="audit">
              <summary>Auditoria do cálculo</summary>
              <ul>
                {result.audit.map((item) => (
                  <li key={item.id} className={item.ok ? "ok" : "error"}>
                    <span>{item.ok ? "✓" : "×"}</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
