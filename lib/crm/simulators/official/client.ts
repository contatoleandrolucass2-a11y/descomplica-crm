import type { OfficialSimulatorSlug } from "./catalog";
import { generateWf13AnnualDates } from "./wf13-policy";

export type SimulatorFormValues = Record<string, string | boolean>;

export type OfficialSimulatorResultRow = {
  label: string;
  value: string;
};

type OfficialSimulatorMemoryItem = {
  step: string;
  value: number | string;
  format: "currency" | "date" | "integer" | "percent" | "text";
};

export type OfficialSimulatorViolation = {
  code: string;
  message: string;
  fieldPaths: string[];
};

export type OfficialSimulatorApprovalMetric = {
  value: number;
  limit: number;
  approved: boolean;
  excessPercentagePoints: number;
};

export type OfficialSimulatorApproval = {
  policyVersion: string;
  ranking: string;
  status: "APROVADO" | "REPROVADO";
  proSoluto: OfficialSimulatorApprovalMetric;
  incomeCommitment: OfficialSimulatorApprovalMetric;
};

function localToday(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function field(values: SimulatorFormValues, id: string): string {
  const value = values[id];
  return typeof value === "string" ? value.trim() : "";
}

function checked(values: SimulatorFormValues, id: string): boolean {
  return values[id] === true;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function decimal(value: string): string {
  if (!value) return "";
  const compact = value.replace(/\s+/g, "");
  if (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(compact)) return compact;
  if (/^(?:0|[1-9]\d{0,2})(?:\.\d{3})*(?:,\d{1,2})?$/.test(compact)) {
    return compact.replaceAll(".", "").replace(",", ".");
  }
  return compact;
}

export function officialSimulatorInitialValues(slug: string): SimulatorFormValues {
  const today = localToday();
  if (slug === "associativo-fluxo-linear") {
    return {
      "simulator-official-context-effective-date": today,
      "simulator-official-context-monthly-due-day": "15",
      "simulator-pro-soluto-bonus": "0",
      "simulator-pro-soluto-discount": "0",
      "simulator-pro-soluto-cashback": "0",
      "simulator-pro-soluto-cashback-discount": "0",
      "simulator-pro-soluto-subsidy": "0",
      "simulator-pro-soluto-fgts": "0",
      "simulator-pro-soluto-housing-check": "0",
      "simulator-signals-signal-1": "0",
      "simulator-signals-signal-2": "0",
      "simulator-signals-signal-3": "0",
      "simulator-commercial-policy-ranking": "",
      "simulator-commercial-policy-approved-limit": "84",
      "simulator-commercial-policy-requested-installments": "84",
    };
  }
  if (slug === "calcular-documentacao") {
    return {};
  }
  if (slug === "caixa") {
    return {
      "simulator-client-property-approved-payment": "",
      "simulator-client-property-own-resources": "",
      "simulator-client-property-fgts": "",
      "simulator-client-property-applicants": "1",
      "simulator-financing-term": "360",
    };
  }
  if (slug === "tabela-direta") {
    return {
      "simulator-commercial-values-discount": "0",
    };
  }
  if (slug === "tabela-investidor") {
    return {
      "simulator-proposal-discount-request": false,
      "simulator-proposal-income": "",
    };
  }
  return {};
}

export function buildOfficialSimulatorInput(
  slug: OfficialSimulatorSlug,
  values: SimulatorFormValues,
): Record<string, unknown> | null {
  if (slug === "calcular-documentacao") {
    const modality = field(values, "simulator-purchase-type-modality").toUpperCase();
    const firstProperty = field(values, "simulator-purchase-type-first-property");
    return {
      businessUnit: field(values, "simulator-profile-builder").toLocaleLowerCase("pt-BR"),
      modality: modality === "MCMV" ? "mcmv" : modality === "SPBE" ? "spbe" : "",
      firstProperty: firstProperty === "Sim" ? true : firstProperty === "Não" ? false : null,
      salePrice: decimal(field(values, "simulator-values-property-value")),
      appraisalValue: decimal(field(values, "simulator-values-bank-appraisal")),
      financing: decimal(field(values, "simulator-values-financing")),
      income: decimal(field(values, "simulator-values-family-income")),
      baseDate: field(values, "simulator-profile-simulation-date"),
      requestedFirstInstallment: field(values, "simulator-values-first-installment-date"),
    };
  }
  if (slug === "caixa") {
    return {
      income: decimal(field(values, "simulator-client-property-gross-income")),
      approvedPayment: decimal(field(values, "simulator-client-property-approved-payment")),
      propertyValue: decimal(field(values, "simulator-client-property-property-value")),
      ownFunds: decimal(field(values, "simulator-client-property-own-resources")),
      fgts: decimal(field(values, "simulator-client-property-fgts")),
      birthDate: field(values, "simulator-financing-birth-date"),
      asOf: localToday(),
      state: field(values, "simulator-financing-state"),
      city: field(values, "simulator-financing-city"),
      cityLimit: "",
      populationFactor: "1",
      term: field(values, "simulator-financing-term"),
      product: field(values, "simulator-financing-product").toLocaleLowerCase("pt-BR"),
      system: field(values, "simulator-financing-system").toLocaleLowerCase("pt-BR"),
      hasFgts36: field(values, "simulator-financing-minimum-fgts-time") === "Sim",
      previousSubsidy: field(values, "simulator-financing-previous-subsidy") === "Sim",
      socialFactor: field(values, "simulator-financing-social-factor") === "Sim",
      inConstruction: field(values, "simulator-financing-off-plan-property") === "Sim",
    };
  }
  if (slug === "tabela-direta") {
    return {
      developmentName: field(values, "simulator-property-development"),
      businessUnit: field(values, "simulator-property-business-unit").toLocaleLowerCase("pt-BR"),
      product: field(values, "simulator-property-unit"),
      plant: field(values, "simulator-property-floor-plan"),
      description: field(values, "simulator-property-description"),
      propertyValue: decimal(field(values, "simulator-commercial-values-property-value")),
      discount: decimal(field(values, "simulator-commercial-values-discount")) || "0",
      income: decimal(field(values, "simulator-commercial-values-monthly-income")),
      baseDate: field(values, "simulator-dates-simulation-date"),
      workEndDate: field(values, "simulator-dates-construction-end"),
    };
  }
  if (slug === "tabela-investidor") {
    return {
      selectedUnitId: field(values, "simulator-inventory-inventory-search"),
      inventoryMatch: false,
      propertyValue: decimal(field(values, "simulator-proposal-property-value")),
      discountAuthorized: checked(values, "simulator-proposal-discount-request"),
      discount: "",
      income: decimal(field(values, "simulator-proposal-income")),
      baseDate: field(values, "simulator-proposal-simulation-date"),
      completionDate: field(values, "simulator-proposal-construction-end"),
    };
  }
  if (slug !== "associativo-fluxo-linear") return null;
  const entryDate = field(values, "simulator-official-context-effective-date");
  const constructionEnd = field(values, "simulator-official-context-construction-end");
  const annuals = generateWf13AnnualDates(entryDate, constructionEnd).map(
    (_, index) => decimal(field(values, `simulator-annuals-${index + 1}-annual-value`)) || "0",
  );
  return {
    development: field(values, "simulator-official-context-development"),
    product: field(values, "simulator-official-context-product"),
    stockMatch: checked(values, "simulator-official-context-official-match"),
    ranking: field(values, "simulator-commercial-policy-ranking"),
    installments: field(values, "simulator-commercial-policy-requested-installments"),
    entryDate,
    constructionEnd,
    monthlyDueDay: field(values, "simulator-official-context-monthly-due-day").replace(/^0/, ""),
    income: decimal(field(values, "simulator-official-context-income")),
    salePrice: decimal(field(values, "simulator-pro-soluto-property-value")),
    bonus: decimal(field(values, "simulator-pro-soluto-bonus")),
    discount: decimal(field(values, "simulator-pro-soluto-discount")),
    cashback: decimal(field(values, "simulator-pro-soluto-cashback")),
    cashbackDiscount: decimal(field(values, "simulator-pro-soluto-cashback-discount")),
    financing: decimal(field(values, "simulator-pro-soluto-financing")),
    subsidy: decimal(field(values, "simulator-pro-soluto-subsidy")),
    fgts: decimal(field(values, "simulator-pro-soluto-fgts")),
    housingCheck: decimal(field(values, "simulator-pro-soluto-housing-check")),
    entry: decimal(
      field(values, "simulator-entry-entry") || field(values, "simulator-signals-entry"),
    ),
    signal1: decimal(field(values, "simulator-signals-signal-1")),
    signal1Date: field(values, "simulator-signals-signal-1-date"),
    signal2: decimal(field(values, "simulator-signals-signal-2")),
    signal2Date: field(values, "simulator-signals-signal-2-date"),
    signal3: decimal(field(values, "simulator-signals-signal-3")),
    signal3Date: field(values, "simulator-signals-signal-3-date"),
    annuals,
  };
}

function finiteNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function currencyFromCents(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const cents = BigInt(value);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return currency.format(Number(cents) / 100);
}

function booleanLabel(value: unknown): string | null {
  return typeof value === "boolean" ? (value ? "Sim" : "Não") : null;
}

function legacyReferenceResultRows(
  slug: Exclude<OfficialSimulatorSlug, "associativo-fluxo-linear">,
  result: Record<string, unknown>,
): OfficialSimulatorResultRow[] | null {
  const rows: Array<OfficialSimulatorResultRow | null> = [];
  const money = (label: string, key: string) => {
    const value = currencyFromCents(result[key]);
    rows.push(value === null ? null : { label, value });
  };
  const numeric = (label: string, key: string) => {
    const value = finiteNumber(result, key);
    rows.push(value === null ? null : { label, value: number.format(value) });
  };
  const yesNo = (label: string, key: string) => {
    const value = booleanLabel(result[key]);
    rows.push(value === null ? null : { label, value });
  };

  if (slug === "calcular-documentacao") {
    money("Financiamento máximo", "maximumFinancingCents");
    money("ITBI", "itbiCents");
    money("Registro da compra", "purchaseRegistrationCents");
    money("Registro da alienação", "lienRegistrationCents");
    money("Despachante", "dispatchFeeCents");
    money("Seguro CAIXA", "caixaInsuranceCents");
    money("Total da documentação", "totalCashCents");
    numeric("Quantidade de parcelas", "installments");
    money("Valor da parcela", "installmentValueCents");
    const firstDate = text(result, "firstInstallmentDate");
    rows.push(
      firstDate === null
        ? null
        : { label: "Primeiro vencimento", value: firstDate ? formatClientDate(firstDate) : "—" },
    );
    yesNo("Data corrigida pelo motor", "firstInstallmentCorrected");
  } else if (slug === "caixa") {
    money("Prestação aprovada", "approvedPaymentCents");
    money("Financiamento calculado", "financingCents");
    money("Financiamento máximo pela renda", "maximumFinancingByIncomeCents");
    money("Subsídio", "subsidyCents");
    money("FGTS", "fgtsCents");
    money("Recursos próprios", "ownFundsCents");
    money("Total de recursos", "totalResourcesCents");
    money("Entrada necessária", "entryNeededCents");
    money("Primeira prestação", "firstPaymentCents");
    numeric("Prazo", "term");
    yesNo("Valor do imóvel enquadrado", "fitsProperty");
  } else {
    money("Valor real da venda", "valueRealCents");
    const scenarios = result.scenarios;
    if (!Array.isArray(scenarios)) return null;
    for (const [index, rawScenario] of scenarios.entries()) {
      if (!rawScenario || typeof rawScenario !== "object") return null;
      const scenario = rawScenario as Record<string, unknown>;
      const prefix = text(scenario, "label") ?? text(scenario, "code") ?? `Cenário ${index + 1}`;
      const installment =
        currencyFromCents(scenario.postKeysPaymentCents) ??
        currencyFromCents(scenario.installmentValueCents);
      const balance =
        currencyFromCents(scenario.postKeysBalanceCents) ??
        currencyFromCents(scenario.balanceCents);
      const available = booleanLabel(scenario.approved ?? scenario.available);
      if (installment === null || balance === null || available === null) return null;
      rows.push(
        { label: `${prefix} · parcela`, value: installment },
        { label: `${prefix} · saldo`, value: balance },
        { label: `${prefix} · enquadrado`, value: available },
      );
    }
  }
  return rows.every((row): row is OfficialSimulatorResultRow => row !== null) ? rows : null;
}

function formatClientDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  return date.format(new Date(`${value}T00:00:00.000Z`));
}

export function officialSimulatorResultRows(
  slug: OfficialSimulatorSlug,
  rawResult: unknown,
): OfficialSimulatorResultRow[] | null {
  if (!rawResult || typeof rawResult !== "object") {
    return null;
  }
  const result = rawResult as Record<string, unknown>;
  if (slug !== "associativo-fluxo-linear") return legacyReferenceResultRows(slug, result);
  const values = {
    realSaleValue: finiteNumber(result, "realSaleValue"),
    proSoluto: finiteNumber(result, "proSoluto"),
    nominalInstallment: finiteNumber(result, "nominalInstallment"),
    nominalScheduleTotal:
      result.nominalSchedule && typeof result.nominalSchedule === "object"
        ? finiteNumber(result.nominalSchedule as Record<string, unknown>, "total")
        : null,
    nominalScheduleRemainder:
      result.nominalSchedule && typeof result.nominalSchedule === "object"
        ? finiteNumber(result.nominalSchedule as Record<string, unknown>, "remainder")
        : null,
    correctedProSoluto: finiteNumber(result, "correctedProSoluto"),
    correctedInstallment: finiteNumber(result, "correctedInstallment"),
    incomeCommitment: finiteNumber(result, "incomeCommitment"),
    entryAmount: finiteNumber(result, "entryAmount"),
    signalsTotal: finiteNumber(result, "signalsTotal"),
    annualNominalTotal: finiteNumber(result, "annualNominalTotal"),
    installments: finiteNumber(result, "installments"),
    policyLimit: finiteNumber(result, "policyLimit"),
    financing: finiteNumber(result, "financing"),
    subsidy: finiteNumber(result, "subsidy"),
    fgts: finiteNumber(result, "fgts"),
    preInstallments: finiteNumber(result, "preInstallments"),
    postInstallments: finiteNumber(result, "postInstallments"),
    installmentOverSale: finiteNumber(result, "installmentOverSale"),
    proSolutoOverSale: finiteNumber(result, "proSolutoOverSale"),
    firstInstallmentDate: text(result, "firstInstallmentDate"),
  };
  if (Object.values(values).some((value) => value === null)) return null;

  return [
    { label: "Valor real da venda", value: currency.format(values.realSaleValue!) },
    { label: "Saldo do pró-soluto", value: currency.format(values.proSoluto!) },
    { label: "Mensal nominal", value: currency.format(values.nominalInstallment!) },
    {
      label: "Ajuste de centavos no cronograma",
      value: currency.format(values.nominalScheduleRemainder!),
    },
    {
      label: "Total nominal reconciliado",
      value: currency.format(values.nominalScheduleTotal!),
    },
    { label: "Pró-soluto corrigido", value: currency.format(values.correctedProSoluto!) },
    { label: "Ato", value: currency.format(values.entryAmount!) },
    { label: "Sinais", value: currency.format(values.signalsTotal!) },
    { label: "Anuais", value: currency.format(values.annualNominalTotal!) },
    { label: "Parcelas mensais solicitadas", value: number.format(values.installments!) },
    { label: "Limite máximo de parcelas", value: number.format(values.policyLimit!) },
    { label: "Mensal corrigida", value: currency.format(values.correctedInstallment!) },
    { label: "Financiamento", value: currency.format(values.financing!) },
    { label: "Subsídio", value: currency.format(values.subsidy!) },
    { label: "FGTS", value: currency.format(values.fgts!) },
    { label: "Parcelas antes da obra", value: number.format(values.preInstallments!) },
    { label: "Parcelas após a obra", value: number.format(values.postInstallments!) },
    {
      label: "Início das mensais",
      value: values.firstInstallmentDate
        ? date.format(new Date(`${values.firstInstallmentDate}T00:00:00.000Z`))
        : "—",
    },
    { label: "Comprometimento de renda", value: percent.format(values.incomeCommitment!) },
    {
      label: "Comprometimento do pró-soluto",
      value: percent.format(values.proSolutoOverSale!),
    },
  ];
}

export function officialSimulatorMemoryRows(
  slug: OfficialSimulatorSlug,
  rawResult: unknown,
): OfficialSimulatorResultRow[] | null {
  if (!rawResult || typeof rawResult !== "object") {
    return null;
  }
  if (slug !== "associativo-fluxo-linear") {
    const result = rawResult as Record<string, unknown>;
    const formulaVersion = text(result, "formulaVersion");
    const provenance = text(result, "provenance");
    if (!formulaVersion || provenance !== "legacy-reference-2026-08-28") return null;
    const rows: OfficialSimulatorResultRow[] = [
      { label: "Versão da fórmula", value: formulaVersion },
      { label: "Origem auditada", value: provenance },
    ];
    if (Array.isArray(result.audit)) {
      for (const rawItem of result.audit) {
        if (!rawItem || typeof rawItem !== "object") return null;
        const item = rawItem as Record<string, unknown>;
        if (typeof item.label !== "string" || typeof item.ok !== "boolean") return null;
        rows.push({ label: item.label, value: item.ok ? "Conforme" : "Pendente" });
      }
    }
    return rows;
  }
  const rawMemory = (rawResult as Record<string, unknown>).calculationMemory;
  if (!Array.isArray(rawMemory)) return null;

  const memory: OfficialSimulatorMemoryItem[] = [];
  for (const rawItem of rawMemory) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const item = rawItem as Record<string, unknown>;
    if (
      typeof item.step !== "string" ||
      !["currency", "date", "integer", "percent", "text"].includes(String(item.format)) ||
      (typeof item.value !== "number" && typeof item.value !== "string")
    ) {
      return null;
    }
    memory.push(item as OfficialSimulatorMemoryItem);
  }

  return memory.map((item) => {
    if (item.format === "currency" && typeof item.value === "number") {
      return { label: item.step, value: currency.format(item.value) };
    }
    if (item.format === "integer" && typeof item.value === "number") {
      return { label: item.step, value: number.format(item.value) };
    }
    if (item.format === "percent" && typeof item.value === "number") {
      return { label: item.step, value: percent.format(item.value) };
    }
    if (item.format === "text" && typeof item.value === "string") {
      return { label: item.step, value: item.value };
    }
    if (item.format === "date" && typeof item.value === "string" && item.value) {
      return {
        label: item.step,
        value: date.format(new Date(`${item.value}T00:00:00.000Z`)),
      };
    }
    return { label: item.step, value: "—" };
  });
}

function approvalMetric(value: unknown): OfficialSimulatorApprovalMetric | null {
  if (!value || typeof value !== "object") return null;
  const metric = value as Record<string, unknown>;
  const parsed = {
    value: finiteNumber(metric, "value"),
    limit: finiteNumber(metric, "limit"),
    excessPercentagePoints: finiteNumber(metric, "excessPercentagePoints"),
    approved: metric.approved,
  };
  if (
    parsed.value === null ||
    parsed.limit === null ||
    parsed.excessPercentagePoints === null ||
    typeof parsed.approved !== "boolean"
  ) {
    return null;
  }
  return parsed as OfficialSimulatorApprovalMetric;
}

export function officialSimulatorApproval(
  slug: OfficialSimulatorSlug,
  rawResult: unknown,
): OfficialSimulatorApproval | null {
  if (slug !== "associativo-fluxo-linear" || !rawResult || typeof rawResult !== "object") {
    return null;
  }
  const rawApproval = (rawResult as Record<string, unknown>).approval;
  if (!rawApproval || typeof rawApproval !== "object") return null;
  const approval = rawApproval as Record<string, unknown>;
  const proSoluto = approvalMetric(approval.proSoluto);
  const incomeCommitment = approvalMetric(approval.incomeCommitment);
  if (
    typeof approval.policyVersion !== "string" ||
    typeof approval.ranking !== "string" ||
    !["APROVADO", "REPROVADO"].includes(String(approval.status)) ||
    !proSoluto ||
    !incomeCommitment
  ) {
    return null;
  }
  return {
    policyVersion: approval.policyVersion,
    ranking: approval.ranking,
    status: approval.status as "APROVADO" | "REPROVADO",
    proSoluto,
    incomeCommitment,
  };
}

export function officialSimulatorViolations(
  slug: OfficialSimulatorSlug,
  rawResult: unknown,
): OfficialSimulatorViolation[] | null {
  if (!rawResult || typeof rawResult !== "object") {
    return null;
  }
  if (slug !== "associativo-fluxo-linear") {
    return stringList((rawResult as Record<string, unknown>).errors).map((message, index) => ({
      code: `legacy_reference_${index + 1}`,
      message,
      fieldPaths: [],
    }));
  }
  const rawViolations = (rawResult as Record<string, unknown>).violations;
  if (!Array.isArray(rawViolations)) return null;
  const violations: OfficialSimulatorViolation[] = [];
  for (const value of rawViolations) {
    if (!value || typeof value !== "object") return null;
    const violation = value as Record<string, unknown>;
    if (
      typeof violation.code !== "string" ||
      typeof violation.message !== "string" ||
      !Array.isArray(violation.fieldPaths) ||
      !violation.fieldPaths.every((fieldPath) => typeof fieldPath === "string")
    ) {
      return null;
    }
    violations.push(violation as OfficialSimulatorViolation);
  }
  return violations;
}
