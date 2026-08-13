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
  visibleWhen?: {
    fieldKey: string;
    values: readonly string[];
  };
}

export interface SimulatorSectionPreview {
  kind: "inventory" | "scenarios" | "status";
  items: readonly string[];
  title: string;
  description: string;
}

export interface SimulatorSection {
  key: string;
  title: string;
  description?: string;
  group?: string;
  fields: readonly SimulatorField[];
  repeatable?: {
    itemLabel: string;
    addLabel: string;
    maxItems?: number;
  };
  preview?: SimulatorSectionPreview;
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
        description:
          "Quantidade, valores e datas dependem da política oficial; este item representa a estrutura repetível.",
        repeatable: {
          itemLabel: "Anual",
          addLabel: "Adicionar anual",
          maxItems: 5,
        },
        fields: [{ key: "annual-value", label: "Valor da anual", type: "currency" }],
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
      "Origem do registro oficial",
      "Data do registro oficial",
      "Valor oficial",
      "Valor real da venda",
      "Total de recursos externos",
      "Total de descontos",
      "Saldo do pró-soluto",
      "Divergências",
      "Limites violados",
      "Ato",
      "Sinais",
      "Total de anuais",
      "Percentual da renda por anual",
      "Validade das anuais no período de obras",
      "Motivos de bloqueio",
      "Parcelas pré-obra",
      "Parcelas pós-obra",
      "Parcela corrigida",
      "Quantidades",
      "Datas de vencimento",
      "Totais por fase",
      "Total geral",
      "Memória de cálculo",
      "Regras aplicadas",
      "Auditoria completa",
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
        key: "profile",
        title: "Perfil",
        description: "Como será a compra?",
        fields: [
          {
            key: "builder",
            label: "Construtora",
            type: "text",
            required: true,
            hint: "As opções virão da configuração administrável aprovada.",
          },
        ],
      },
      {
        key: "purchase-type",
        title: "Tipo da compra",
        fields: [
          {
            key: "modality",
            label: "Modalidade de financiamento",
            type: "text",
            required: true,
            hint: "As modalidades e seus limites dependem da configuração oficial.",
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
        title: "Valores",
        fields: [
          {
            key: "property-value",
            label: "Valor do imóvel",
            type: "currency",
            required: true,
            hint: "Limite aplicável indisponível até a configuração oficial.",
          },
          {
            key: "bank-appraisal",
            label: "Avaliação bancária",
            type: "currency",
            hint: "Limite aplicável indisponível até a configuração oficial.",
          },
          {
            key: "financing",
            label: "Financiamento",
            type: "currency",
            required: true,
            hint: "Limite aplicável indisponível até a configuração oficial.",
          },
          {
            key: "family-income",
            label: "Renda familiar",
            type: "currency",
            required: true,
            hint: "Faixa e exigências dependem da configuração oficial.",
          },
        ],
      },
      {
        key: "financial-structure",
        title: "Estrutura financeira",
        description:
          "Percentual financiado, teto, avaliação, faixa de renda e progresso aguardam política oficial.",
        fields: [],
        preview: {
          kind: "status",
          title: "Estrutura financeira indisponível",
          description: "Aguardando configuração administrável aprovada.",
          items: [
            "Percentual financiado",
            "Teto permitido",
            "Relação com a avaliação",
            "Faixa de renda",
            "Progresso do preenchimento válido",
          ],
        },
      },
      {
        key: "result",
        title: "Resultado",
        description: "Estimativa bloqueada até a validação das regras oficiais.",
        fields: [],
        preview: {
          kind: "status",
          title: "Resultado indisponível",
          description: "Nenhum plano, parcela ou vencimento é calculado.",
          items: [
            "Data da simulação",
            "Plano sugerido",
            "Quantidade de parcelas",
            "Valor da parcela",
            "Primeira data de vencimento",
            "Total da documentação",
          ],
        },
      },
      {
        key: "financial-summary",
        title: "Resumo financeiro",
        description: "Composição e auditoria serão exibidas sem afirmar aprovação oficial.",
        fields: [],
        preview: {
          kind: "status",
          title: "Resumo indisponível",
          description: "Composição bloqueada até a validação da política.",
          items: ["Custos configurados", "Descontos e isenções", "Total", "Auditoria"],
        },
      },
    ],
    resultItems: [
      "Percentual financiado",
      "Teto permitido",
      "Relação com a avaliação",
      "Faixa de renda",
      "Progresso do preenchimento válido",
      "Data da simulação",
      "Plano sugerido",
      "Quantidade de parcelas",
      "Valor da parcela",
      "Primeira data de vencimento",
      "Total da documentação",
      "ITBI",
      "Registro",
      "Despachante",
      "Seguro",
      "Taxas adicionais configuradas",
      "Descontos",
      "Isenções",
      "Total",
      "Sistema de parcelamento",
      "Taxa aplicada",
      "Fundamento de isenção",
      "Memória do cálculo",
      "Auditoria",
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
        title: "Simulador · Cliente e imóvel",
        group: "Simulador",
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
        ],
      },
      {
        key: "financing",
        title: "Simulador · Financiamento",
        group: "Simulador",
        fields: [
          { key: "birth-date", label: "Data de nascimento", type: "date", required: true },
          { key: "state", label: "Estado", type: "select", required: true, options: STATE_OPTIONS },
          {
            key: "city",
            label: "Cidade",
            type: "text",
            required: true,
            placeholder: "Buscar cidade",
          },
          { key: "term", label: "Prazo em meses", type: "number", required: true },
          {
            key: "product",
            label: "Produto",
            type: "text",
            required: true,
            hint: "Produtos elegíveis virão da configuração oficial.",
          },
          {
            key: "system",
            label: "Sistema de amortização",
            type: "text",
            required: true,
            hint: "Opções serão limitadas pelo produto na configuração oficial.",
          },
          {
            key: "minimum-fgts-time",
            label: "Tempo mínimo de FGTS",
            type: "number",
            hint: "Unidade e limite dependem da regra oficial vigente.",
          },
          {
            key: "previous-subsidy",
            label: "Recebimento anterior de subsídio",
            type: "radio",
            options: ["Sim", "Não"],
          },
          {
            key: "social-factor",
            label: "Fator social",
            type: "text",
            hint: "Classificação fornecida pela configuração oficial.",
          },
          {
            key: "off-plan-property",
            label: "Imóvel na planta",
            type: "radio",
            options: ["Sim", "Não"],
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
      {
        key: "documents-profile",
        title: "Documentos · Perfil",
        group: "Documentos",
        description:
          "Estrutura repetível por proponente; os tipos de renda virão da configuração administrável.",
        repeatable: {
          itemLabel: "Proponente",
          addLabel: "Adicionar proponente",
        },
        fields: [
          { key: "applicant-name", label: "Nome do proponente", type: "text" },
          {
            key: "income-relationship",
            label: "Tipo de vínculo / renda",
            type: "text",
            hint: "Perfis suportados dependem da configuração oficial.",
          },
          { key: "applicant-gross-income", label: "Renda bruta", type: "currency" },
          { key: "applicant-fgts-time", label: "Tempo de FGTS", type: "number" },
          {
            key: "applicant-fgts-use",
            label: "Uso do FGTS",
            type: "radio",
            options: ["Sim", "Não"],
          },
          {
            key: "income-tax-return",
            label: "Declaração de IR",
            type: "radio",
            options: ["Sim", "Não"],
          },
          {
            key: "applicant-product",
            label: "Produto",
            type: "text",
            hint: "Produto fornecido pela configuração oficial.",
          },
          {
            key: "applicant-social-factor",
            label: "Fator social",
            type: "text",
            hint: "Classificação fornecida pela configuração oficial.",
          },
        ],
      },
      {
        key: "documents-phase-1",
        title: "Documentos · Fase 1",
        group: "Documentos",
        description: "Documentos para análise de potencial.",
        fields: [
          {
            key: "identity-document",
            label: "Documento de identificação",
            type: "checkbox",
          },
          {
            key: "proof-of-address",
            label: "Comprovante de residência",
            type: "checkbox",
          },
          {
            key: "profile-conditional-documents",
            label: "Comprovantes condicionais ao perfil",
            type: "checkbox",
          },
        ],
      },
      {
        key: "documents-phase-2",
        title: "Documentos · Fase 2",
        group: "Documentos",
        description: "Documentos para fechamento.",
        fields: [
          {
            key: "civil-status-certificate",
            label: "Certidão de estado civil",
            type: "checkbox",
          },
          {
            key: "labor-documents",
            label: "Documentos trabalhistas conforme perfil",
            type: "checkbox",
          },
          {
            key: "tax-documents",
            label: "Documentos fiscais conforme perfil",
            type: "checkbox",
          },
          {
            key: "fgts-documents",
            label: "Documentos de FGTS conforme perfil",
            type: "checkbox",
          },
          { key: "specific-pending-items", label: "Pendências específicas", type: "text" },
        ],
      },
      {
        key: "diagnosis",
        title: "Diagnóstico",
        group: "Diagnóstico",
        fields: [
          {
            key: "diagnosis-result",
            label: "Qual foi o resultado?",
            type: "radio",
            options: ["Aprovado", "Condicionado", "Documentação pendente", "Reprovado"],
          },
          {
            key: "managed-reason",
            label: "Motivo administrável",
            type: "text",
            hint: "Motivos e campos condicionais virão da configuração oficial, sem opção presumida.",
            visibleWhen: {
              fieldKey: "diagnosis-result",
              values: ["Condicionado", "Reprovado"],
            },
          },
          {
            key: "document-pending-item",
            label: "Pendência documental",
            type: "text",
            visibleWhen: {
              fieldKey: "diagnosis-result",
              values: ["Documentação pendente"],
            },
          },
          {
            key: "action-plan",
            label: "Plano de ação",
            type: "text",
            wide: true,
            visibleWhen: {
              fieldKey: "diagnosis-result",
              values: ["Reprovado"],
            },
          },
        ],
      },
      {
        key: "amortization-utility",
        title: "Utilitários · Amortização",
        group: "Utilitários",
        fields: [
          { key: "outstanding-balance", label: "Saldo devedor", type: "currency" },
          { key: "annual-nominal-rate", label: "Taxa nominal anual", type: "number" },
          { key: "remaining-term", label: "Prazo restante", type: "number" },
          { key: "amortization-value", label: "Valor a amortizar", type: "currency" },
          {
            key: "amortization-system",
            label: "Sistema",
            type: "text",
            hint: "Sistemas disponíveis virão da configuração oficial.",
          },
        ],
      },
      {
        key: "fgts-time-utility",
        title: "Utilitários · Tempo de FGTS",
        group: "Utilitários",
        description: "Estrutura repetível para adicionar ou remover períodos.",
        repeatable: {
          itemLabel: "Período",
          addLabel: "Adicionar período",
        },
        fields: [
          { key: "fgts-company", label: "Empresa", type: "text" },
          { key: "fgts-start-date", label: "Data inicial", type: "date" },
          { key: "fgts-end-date", label: "Data final", type: "date" },
          {
            key: "fgts-current-relationship",
            label: "Vínculo atual",
            type: "checkbox",
            hint: "Use quando a data final estiver vazia.",
          },
        ],
      },
    ],
    resultItems: [
      "Produto",
      "Sistema",
      "Prazo",
      "Parecer sobre o potencial",
      "Valor do imóvel",
      "Financiamento",
      "Subsídio estimado",
      "FGTS e recursos",
      "Entrada necessária",
      "Primeira prestação estimada",
      "Parcela principal",
      "Seguro",
      "Taxas",
      "Taxa nominal",
      "Taxa efetiva",
      "Comprometimento de renda",
      "Alertas",
      "Documentos para análise de potencial",
      "Documentos para fechamento",
      "Orientação do diagnóstico",
      "Redução de prazo",
      "Redução de parcela",
      "Comparação da amortização",
      "Memória de cálculo da amortização",
      "Avisos da amortização",
      "Tempo total de FGTS",
      "Períodos consolidados",
      "Sobreposições",
      "Elegibilidade conforme regra vigente",
      "Explicação dos períodos de FGTS",
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
        title: "Identificação",
        description: "Qual imóvel será simulado?",
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
            type: "text",
            required: true,
            hint: "Unidade conciliada com o estoque oficial, quando disponível.",
          },
        ],
      },
      {
        key: "commercial-values",
        title: "Estrutura financeira",
        description: "Informe valor e renda.",
        fields: [
          { key: "property-value", label: "Valor do imóvel", type: "currency", required: true },
          { key: "discount", label: "Desconto", type: "currency" },
          { key: "monthly-income", label: "Renda mensal", type: "currency", required: true },
        ],
      },
      {
        key: "dates",
        title: "Cronograma",
        description: "Defina as datas.",
        fields: [
          { key: "simulation-date", label: "Data da simulação", type: "date", required: true },
          { key: "construction-end", label: "Término da obra", type: "date", required: true },
        ],
      },
      {
        key: "comparison",
        title: "Comparação",
        description:
          "Os dois cenários permanecem bloqueados até a publicação da regra oficial versionada.",
        fields: [],
        preview: {
          kind: "scenarios",
          title: "Comparação indisponível",
          description: "Os cartões não contêm valores ou parecer comercial.",
          items: ["Cenário 1", "Cenário 2"],
        },
      },
    ],
    resultItems: [
      "Versão da regra",
      "Proporções vigentes",
      "Percentual de preenchimento obrigatório",
      "Valor oficial",
      "Valor real da venda",
      "Percentual de desconto",
      "Limite de desconto",
      "Validação de renda",
      "Data oficial",
      "Datas comerciais dos sinais",
      "Primeiras parcelas",
      "Período pré-chaves",
      "Período pós-chaves",
      "Quantidade de parcelas permitida",
      "Cenário 1 · Ato",
      "Cenário 1 · Sinais",
      "Cenário 1 · Entrada total",
      "Cenário 1 · Mensais pré-chaves",
      "Cenário 1 · Mensais pós-chaves",
      "Cenário 1 · Quantidade e valor das parcelas",
      "Cenário 1 · Datas",
      "Cenário 1 · Saldo",
      "Cenário 1 · Comprometimento de renda",
      "Cenário 1 · Parecer",
      "Cenário 1 · Alertas",
      "Cenário 1 · Auditoria",
      "Cenário 2 · Ato",
      "Cenário 2 · Sinais",
      "Cenário 2 · Entrada total",
      "Cenário 2 · Mensais pré-chaves",
      "Cenário 2 · Mensais pós-chaves",
      "Cenário 2 · Quantidade e valor das parcelas",
      "Cenário 2 · Datas",
      "Cenário 2 · Saldo",
      "Cenário 2 · Comprometimento de renda",
      "Cenário 2 · Parecer",
      "Cenário 2 · Alertas",
      "Cenário 2 · Auditoria",
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
        preview: {
          kind: "inventory",
          title: "Estoque indisponível",
          description: "Nenhuma unidade é presumida ou carregada sem fonte oficial conciliada.",
          items: ["Código", "Unidade de negócio", "Empreendimento", "Descrição", "Valor oficial"],
        },
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
            type: "text",
            hint: "Filtro alimentado pelo estoque oficial.",
          },
          {
            key: "development",
            label: "Empreendimento",
            type: "text",
            hint: "Filtro alimentado pelo estoque oficial.",
          },
        ],
      },
      {
        key: "selected-unit",
        title: "Unidade selecionada",
        description:
          "Código, empreendimento, planta, obra, status, valor, fonte e atualização virão do estoque conciliado.",
        fields: [],
        preview: {
          kind: "status",
          title: "Nenhuma unidade selecionada",
          description: "Selecione somente uma unidade conciliada com a fonte oficial.",
          items: [
            "Código",
            "Empreendimento",
            "Planta",
            "Data da obra",
            "Status",
            "Valor final",
            "Fonte",
            "Atualização",
          ],
        },
      },
      {
        key: "proposal",
        title: "Monte a proposta",
        fields: [
          { key: "property-value", label: "Valor do imóvel", type: "currency", required: true },
          {
            key: "construction-end",
            label: "Data de término da obra",
            type: "date",
            required: true,
          },
          { key: "entry-percentage", label: "Percentual de entrada", type: "number" },
          { key: "installment-count", label: "Quantidade de parcelas", type: "number" },
          {
            key: "discount-request",
            label: "Solicitação explícita de desconto",
            type: "checkbox",
            wide: true,
          },
        ],
      },
      {
        key: "intermediate-installments",
        title: "Intermediárias",
        description:
          "Quantidade e limites dependem da política oficial; este item representa a estrutura repetível.",
        repeatable: {
          itemLabel: "Intermediária",
          addLabel: "Adicionar intermediária",
        },
        fields: [
          { key: "intermediate-value", label: "Valor da intermediária", type: "currency" },
          { key: "intermediate-start-date", label: "Data inicial", type: "date" },
          { key: "intermediate-end-date", label: "Data final do intervalo", type: "date" },
        ],
      },
      {
        key: "standard-scenarios",
        title: "Quatro cenários padrão",
        description: "C1, C2, C3 e C4 serão gerados na ordem da política oficial versionada.",
        fields: [],
        preview: {
          kind: "scenarios",
          title: "Cenários indisponíveis",
          description: "Ordem preservada; regras e valores aguardam política oficial.",
          items: ["C1", "C2", "C3", "C4"],
        },
      },
      {
        key: "custom-flow",
        title: "Fluxo personalizado",
        description: "Parecer, valores, limites e auditoria aguardam a política oficial.",
        fields: [],
        preview: {
          kind: "status",
          title: "Fluxo personalizado indisponível",
          description: "Nenhum parecer ou valor é produzido sem política oficial.",
          items: [
            "Parecer da proposta",
            "Parcela e quantidade",
            "Saldo",
            "Valor real da venda",
            "Entrada e percentual",
            "Intermediárias válidas",
            "Data limite",
            "Auditoria",
          ],
        },
      },
    ],
    resultItems: [
      "Total de unidades",
      "Data e hora da atualização",
      "Estado da sincronização",
      "Lista de unidades · Código",
      "Lista de unidades · Unidade de negócio",
      "Lista de unidades · Empreendimento",
      "Lista de unidades · Descrição",
      "Lista de unidades · Valor oficial",
      "Unidade selecionada · Código",
      "Unidade selecionada · Empreendimento",
      "Unidade selecionada · Planta",
      "Unidade selecionada · Data da obra",
      "Unidade selecionada · Status",
      "Unidade selecionada · Valor final",
      "Unidade selecionada · Fonte e atualização",
      "Intermediária · Limite",
      "Intermediária · Situação da validação",
      "C1 · Nome e resumo da regra",
      "C1 · Parcela mensal e quantidade",
      "C1 · Entrada, intermediárias e saldo",
      "C1 · Alertas",
      "C2 · Nome e resumo da regra",
      "C2 · Parcela mensal e quantidade",
      "C2 · Entrada, intermediárias e saldo",
      "C2 · Alertas",
      "C3 · Nome e resumo da regra",
      "C3 · Parcela mensal e quantidade",
      "C3 · Entrada, intermediárias e saldo",
      "C3 · Alertas",
      "C4 · Nome e resumo da regra",
      "C4 · Parcela mensal e quantidade",
      "C4 · Entrada, intermediárias e saldo",
      "C4 · Alertas",
      "Fluxo personalizado · Parecer da proposta",
      "Fluxo personalizado · Parcela e quantidade",
      "Fluxo personalizado · Saldo",
      "Fluxo personalizado · Valor real da venda",
      "Fluxo personalizado · Entrada e percentual",
      "Fluxo personalizado · Intermediárias válidas",
      "Fluxo personalizado · Data limite",
      "Fluxo personalizado · Auditoria",
    ],
  },
} as const satisfies Record<string, SimulatorDefinition>;

export type SimulatorSlug = keyof typeof SIMULATORS;

export const SIMULATOR_LIST = Object.values(SIMULATORS);

export function isSimulatorSlug(value: string): value is SimulatorSlug {
  return Object.prototype.hasOwnProperty.call(SIMULATORS, value);
}
