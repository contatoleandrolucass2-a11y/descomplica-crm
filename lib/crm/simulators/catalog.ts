export type SimulatorFieldType =
  | "text"
  | "currency"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox";

export interface SimulatorField {
  key: string;
  label: string;
  type: SimulatorFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: readonly string[];
  wide?: boolean;
}

export interface SimulatorSection {
  key: string;
  title: string;
  description?: string;
  fields: readonly SimulatorField[];
}

export interface SimulatorDefinition {
  slug: string;
  code: string;
  title: string;
  shortTitle: string;
  description: string;
  actionLabel: string;
  sections: readonly SimulatorSection[];
  resultItems: readonly string[];
}

const STATE_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const SIMULATORS = {
  "associativo-fluxo-linear": {
    slug: "associativo-fluxo-linear",
    code: "WF13",
    title: "Associativo · Fluxo Linear",
    shortTitle: "Fluxo Linear",
    description:
      "Estrutura visual para organizar contexto oficial, pró-soluto, sinais, anuais e política comercial.",
    actionLabel: "Calcular fluxo linear",
    sections: [
      {
        key: "official-context",
        title: "Contexto oficial",
        description: "Identificação da unidade e vigência usadas na análise.",
        fields: [
          {
            key: "development",
            label: "Empreendimento",
            type: "text",
            required: true,
            placeholder: "Nome conforme fonte oficial",
          },
          {
            key: "product",
            label: "Produto / unidade",
            type: "text",
            required: true,
            placeholder: "Produto exato do estoque",
          },
          { key: "effective-date", label: "Data vigente", type: "date", required: true },
          { key: "construction-end", label: "Término da obra", type: "date", required: true },
          { key: "income", label: "Renda", type: "currency", required: true },
          {
            key: "official-match",
            label: "Match 100% confirmado",
            type: "checkbox",
            hint: "Empreendimento e produto precisam ser conferidos na base oficial.",
            wide: true,
          },
        ],
      },
      {
        key: "pro-soluto",
        title: "Formação do pró-soluto",
        fields: [
          { key: "property-value", label: "Valor do imóvel", type: "currency", required: true },
          { key: "bonus", label: "Bônus adimplência", type: "currency" },
          { key: "discount", label: "Desconto", type: "currency" },
          { key: "financing", label: "Financiamento", type: "currency" },
          { key: "subsidy", label: "Subsídio", type: "currency" },
          { key: "fgts", label: "FGTS", type: "currency" },
          { key: "housing-check", label: "Cheque moradia", type: "currency" },
        ],
      },
      {
        key: "signals",
        title: "Ato e sinais",
        fields: [
          { key: "entry", label: "Entrada / ato", type: "currency" },
          { key: "signal-1", label: "Sinal 1", type: "currency" },
          { key: "signal-2", label: "Sinal 2", type: "currency" },
          { key: "signal-3", label: "Sinal 3", type: "currency" },
        ],
      },
      {
        key: "annuals",
        title: "Anuais",
        fields: [
          { key: "annual-1", label: "Anual 1", type: "currency" },
          { key: "annual-2", label: "Anual 2", type: "currency" },
          { key: "annual-3", label: "Anual 3", type: "currency" },
          { key: "annual-4", label: "Anual 4", type: "currency" },
          { key: "annual-5", label: "Anual 5", type: "currency" },
        ],
      },
      {
        key: "commercial-policy",
        title: "Política comercial",
        fields: [
          { key: "approved-limit", label: "Limite aprovado", type: "currency" },
          {
            key: "requested-installments",
            label: "Parcelas mensais solicitadas",
            type: "number",
          },
          {
            key: "policy-confirmed",
            label: "Política comercial conferida",
            type: "checkbox",
            hint: "O limite deve respeitar a política oficial do empreendimento.",
            wide: true,
          },
        ],
      },
    ],
    resultItems: [
      "Pró-soluto apurado",
      "Parcela mensal",
      "Quantidade de parcelas",
      "Total de anuais",
      "Saldo da proposta",
    ],
  },
  "calcular-documentacao": {
    slug: "calcular-documentacao",
    code: "WF16",
    title: "Calcular documentação",
    shortTitle: "Documentação",
    description:
      "Composição visual para registrar modalidade, condição de compra e valores da operação.",
    actionLabel: "Calcular documentação",
    sections: [
      {
        key: "purchase-profile",
        title: "Como será a compra?",
        fields: [
          {
            key: "business-unit",
            label: "Construtora",
            type: "radio",
            required: true,
            options: ["Direcional", "Riva"],
          },
          {
            key: "modality",
            label: "Financiamento",
            type: "radio",
            required: true,
            options: ["80% MCMV", "90% SPBE"],
          },
          {
            key: "first-property",
            label: "Primeiro imóvel?",
            type: "radio",
            required: true,
            options: ["Sim", "Não"],
          },
        ],
      },
      {
        key: "values",
        title: "Informe os valores",
        fields: [
          { key: "property-value", label: "Valor do imóvel", type: "currency", required: true },
          { key: "bank-appraisal", label: "Avaliação bancária", type: "currency" },
          { key: "financing", label: "Financiamento", type: "currency", required: true },
          { key: "family-income", label: "Renda familiar", type: "currency", required: true },
        ],
      },
    ],
    resultItems: [
      "Resumo da documentação",
      "Custos e taxas",
      "Registro",
      "Tributos",
      "Total estimado",
    ],
  },
  caixa: {
    slug: "caixa",
    code: "CAIXA",
    title: "Simulação CAIXA",
    shortTitle: "CAIXA",
    description:
      "Jornada visual de cliente, imóvel, financiamento, documentos e diagnóstico da proposta.",
    actionLabel: "Calcular simulação",
    sections: [
      {
        key: "client-property",
        title: "Cliente e imóvel",
        fields: [
          {
            key: "gross-income",
            label: "Renda familiar bruta",
            type: "currency",
            required: true,
          },
          { key: "approved-payment", label: "Prestação aprovada", type: "currency" },
          {
            key: "property-value",
            label: "Valor do imóvel",
            type: "currency",
            required: true,
          },
          { key: "own-resources", label: "Recursos próprios", type: "currency" },
          {
            key: "applicants",
            label: "Quantidade de proponentes",
            type: "number",
            required: true,
          },
          { key: "birth-date", label: "Data de nascimento", type: "date", required: true },
          { key: "state", label: "Estado", type: "select", required: true, options: STATE_OPTIONS },
          {
            key: "city",
            label: "Cidade",
            type: "text",
            required: true,
            placeholder: "Buscar cidade",
          },
        ],
      },
      {
        key: "financing",
        title: "Condições do financiamento",
        fields: [
          { key: "term", label: "Prazo em meses", type: "number", required: true },
          {
            key: "product",
            label: "Produto",
            type: "select",
            required: true,
            options: ["MCMV", "SBPE"],
          },
          {
            key: "system",
            label: "Sistema",
            type: "radio",
            required: true,
            options: ["PRICE", "SAC"],
          },
          {
            key: "documents-confirmed",
            label: "Documentos conferidos",
            type: "checkbox",
            hint: "A conferência visual não substitui validação documental oficial.",
            wide: true,
          },
        ],
      },
    ],
    resultItems: [
      "Financiamento estimado",
      "Entrada necessária",
      "Prestação inicial",
      "Prazo",
      "Diagnóstico da proposta",
    ],
  },
  "tabela-direta": {
    slug: "tabela-direta",
    code: "WF14",
    title: "Tabela Direta",
    shortTitle: "Tabela Direta",
    description: "Dois cenários visuais para organizar uma decisão comercial sem cálculo ativo.",
    actionLabel: "Gerar dois cenários",
    sections: [
      {
        key: "property",
        title: "Qual imóvel será simulado?",
        fields: [
          {
            key: "development",
            label: "Empreendimento",
            type: "text",
            required: true,
            placeholder: "Nome conforme estoque oficial",
          },
          {
            key: "unit",
            label: "Produto / unidade",
            type: "text",
            required: true,
            placeholder: "Ex.: bloco e unidade",
          },
          { key: "floor-plan", label: "Planta", type: "text", required: true },
          { key: "description", label: "Descrição", type: "text" },
          {
            key: "business-unit",
            label: "Unidade de negócio",
            type: "radio",
            required: true,
            options: ["Direcional", "Riva"],
          },
        ],
      },
      {
        key: "commercial-values",
        title: "Informe valor e renda",
        fields: [
          { key: "property-value", label: "Valor do imóvel", type: "currency", required: true },
          { key: "discount", label: "Desconto", type: "currency" },
          { key: "monthly-income", label: "Renda mensal", type: "currency", required: true },
        ],
      },
      {
        key: "dates",
        title: "Defina as datas",
        fields: [
          { key: "simulation-date", label: "Data da simulação", type: "date", required: true },
          { key: "construction-end", label: "Término da obra", type: "date", required: true },
        ],
      },
    ],
    resultItems: [
      "Cenário de menor prazo",
      "Cenário de menor parcela",
      "Entrada",
      "Mensais",
      "Saldo final",
    ],
  },
  "tabela-investidor": {
    slug: "tabela-investidor",
    code: "WF15",
    title: "Tabela Investidor",
    shortTitle: "Tabela Investidor",
    description:
      "Seleção visual de estoque e montagem de proposta; dados e cálculo aguardam contratos oficiais.",
    actionLabel: "Montar proposta",
    sections: [
      {
        key: "inventory",
        title: "Escolha a unidade",
        fields: [
          {
            key: "inventory-search",
            label: "Buscar empreendimento, bloco ou unidade",
            type: "text",
            required: true,
            placeholder: "Empreendimento, bloco ou unidade",
            wide: true,
          },
          {
            key: "business-unit",
            label: "Unidade de negócio",
            type: "select",
            options: ["Todas", "Direcional", "Riva"],
          },
          {
            key: "development",
            label: "Empreendimento",
            type: "select",
            options: ["Todos"],
          },
        ],
      },
      {
        key: "proposal",
        title: "Monte a proposta",
        fields: [
          { key: "selected-unit", label: "Unidade selecionada", type: "text", required: true },
          { key: "proposal-value", label: "Valor da proposta", type: "currency", required: true },
          { key: "entry", label: "Entrada", type: "currency" },
          { key: "term", label: "Prazo pretendido", type: "number" },
        ],
      },
    ],
    resultItems: [
      "Disponibilidade da unidade",
      "Resumo da proposta",
      "Fluxo de pagamento",
      "Saldo projetado",
    ],
  },
} as const satisfies Record<string, SimulatorDefinition>;

export type SimulatorSlug = keyof typeof SIMULATORS;

export const SIMULATOR_LIST = Object.values(SIMULATORS);

export function isSimulatorSlug(value: string): value is SimulatorSlug {
  return Object.prototype.hasOwnProperty.call(SIMULATORS, value);
}
