import type { OfficialSimulatorSlug } from "./catalog";

export type SimulatorFormValues = Record<string, string | boolean>;

export type OfficialSimulatorResultRow = {
  label: string;
  value: string;
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
  if (slug !== "associativo-fluxo-linear") return {};
  return {
    "simulator-official-context-effective-date": localToday(),
    "simulator-pro-soluto-bonus": "0",
    "simulator-pro-soluto-discount": "0",
    "simulator-pro-soluto-subsidy": "0",
    "simulator-pro-soluto-fgts": "0",
    "simulator-pro-soluto-housing-check": "0",
    "simulator-signals-signal-1": "0",
    "simulator-signals-signal-2": "0",
    "simulator-signals-signal-3": "0",
    "simulator-annuals-1-annual-value": "0",
    "simulator-commercial-policy-approved-limit": "84",
    "simulator-commercial-policy-requested-installments": "84",
  };
}

export function buildOfficialSimulatorInput(
  slug: OfficialSimulatorSlug,
  values: SimulatorFormValues,
): Record<string, string | boolean> | null {
  if (slug !== "associativo-fluxo-linear") return null;
  return {
    development: field(values, "simulator-official-context-development"),
    product: field(values, "simulator-official-context-product"),
    stockMatch: checked(values, "simulator-official-context-official-match"),
    policyConfirmed: checked(values, "simulator-commercial-policy-policy-confirmed"),
    policyLimit: field(values, "simulator-commercial-policy-approved-limit"),
    installments: field(values, "simulator-commercial-policy-requested-installments"),
    entryDate: field(values, "simulator-official-context-effective-date"),
    constructionEnd: field(values, "simulator-official-context-construction-end"),
    income: decimal(field(values, "simulator-official-context-income")),
    salePrice: decimal(field(values, "simulator-pro-soluto-property-value")),
    bonus: decimal(field(values, "simulator-pro-soluto-bonus")),
    discount: decimal(field(values, "simulator-pro-soluto-discount")),
    financing: decimal(field(values, "simulator-pro-soluto-financing")),
    subsidy: decimal(field(values, "simulator-pro-soluto-subsidy")),
    fgts: decimal(field(values, "simulator-pro-soluto-fgts")),
    housingCheck: decimal(field(values, "simulator-pro-soluto-housing-check")),
    entry: decimal(field(values, "simulator-signals-entry")),
    signal1: decimal(field(values, "simulator-signals-signal-1")),
    signal2: decimal(field(values, "simulator-signals-signal-2")),
    signal3: decimal(field(values, "simulator-signals-signal-3")),
    annual1: decimal(field(values, "simulator-annuals-1-annual-value")) || "0",
    annual2: decimal(field(values, "simulator-annuals-2-annual-value")) || "0",
    annual3: decimal(field(values, "simulator-annuals-3-annual-value")) || "0",
    annual4: decimal(field(values, "simulator-annuals-4-annual-value")) || "0",
    annual5: decimal(field(values, "simulator-annuals-5-annual-value")) || "0",
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

export function officialSimulatorResultRows(
  slug: OfficialSimulatorSlug,
  rawResult: unknown,
): OfficialSimulatorResultRow[] | null {
  if (slug !== "associativo-fluxo-linear" || !rawResult || typeof rawResult !== "object") {
    return null;
  }
  const result = rawResult as Record<string, unknown>;
  const values = {
    realSaleValue: finiteNumber(result, "realSaleValue"),
    proSoluto: finiteNumber(result, "proSoluto"),
    correctedProSoluto: finiteNumber(result, "correctedProSoluto"),
    correctedInstallment: finiteNumber(result, "correctedInstallment"),
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
    { label: "Pró-soluto corrigido", value: currency.format(values.correctedProSoluto!) },
    { label: "Parcela corrigida", value: currency.format(values.correctedInstallment!) },
    { label: "Parcelas antes da obra", value: number.format(values.preInstallments!) },
    { label: "Parcelas após a obra", value: number.format(values.postInstallments!) },
    { label: "Primeira parcela", value: values.firstInstallmentDate! || "—" },
    { label: "Parcela sobre a venda", value: percent.format(values.installmentOverSale!) },
    { label: "Pró-soluto sobre a venda", value: percent.format(values.proSolutoOverSale!) },
  ];
}
