import { z } from "zod";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MAX_MONEY = 1_000_000_000_000;

const boundedText = z
  .string()
  .max(40)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));
const moneyInput = z
  .union([z.literal(""), z.string().regex(DECIMAL_PATTERN)])
  .refine((value) => value === "" || Math.abs(Number(value)) <= MAX_MONEY);

export const wf16InputSchema = z
  .object({
    businessUnit: boundedText,
    modality: boundedText,
    firstProperty: z.union([boundedText, z.boolean()]),
    salePrice: moneyInput,
    appraisalValue: moneyInput,
    financing: moneyInput,
    income: moneyInput,
    baseDate: boundedText,
    requestedFirstInstallment: boundedText,
  })
  .strict();

export type Wf16Input = z.infer<typeof wf16InputSchema>;

export const WF16_FORMULA = Object.freeze({
  engineKey: "simulator.wf16" as const,
  workflow: "WF-16",
  scope: "Documentação",
  version: "wf16-1.0.0",
  sourceRoute: "https://descomplicapro.com.br/simulacao/calcular-documentacao",
  sourceAsset: "https://descomplicapro.com.br/assets/DocumentationCalculator-DPrKFDk2.js",
  sourceSha256: "1bde87c5c9f3abad9841c5187f9b4457e0b67b01eb7d839639c2896cbc88dca8",
  observedAt: "2026-08-13T00:00:00.000Z",
  itbiExemptionLimit: 245_527.77,
  reducedItbiBase: 120_968,
  progressiveItbiLimit: 725_808,
  reducedItbiRate: 0.005,
  fullItbiRate: 0.03,
  dispatchFee: 300,
  caixaInsurance: 1_000,
  monthlyInterest: 0.015,
  firstPropertyPurchaseRegistrationFactor: 0.620879,
  firstPropertyLienRegistrationFactor: 0.5,
  direcionalInstallments: 40,
  rivaInstallments: 36,
  mcmvFinancingLimit: 0.8,
  spbeFinancingLimit: 0.9,
  mcmvIncomeLimit: 13_000,
  mcmvPropertyLimit: 500_000,
  validDueDays: [5, 10, 15] as const,
  firstInstallmentWindowDays: 120,
});

const INCOME_RANGES = Object.freeze([
  Object.freeze({ label: "Faixa 1", minimum: 0.01, maximum: 3_200 }),
  Object.freeze({ label: "Faixa 2", minimum: 3_200.01, maximum: 5_000 }),
  Object.freeze({ label: "Faixa 3", minimum: 5_000.01, maximum: 9_600 }),
  Object.freeze({ label: "Faixa 4", minimum: 9_600.01, maximum: 13_000 }),
]);

const REGISTRATION_TABLE = Object.freeze(
  [
    [0.01, 250.89],
    [2_222.01, 402.59],
    [5_551.01, 722.25],
    [9_253.01, 1_071.65],
    [18_510.01, 1_302.87],
    [37_020.01, 1_452.97],
    [111_060.01, 1_854.49],
    [185_100.01, 2_255.22],
    [222_120.01, 2_455.19],
    [259_140.01, 2_656.29],
    [296_160.01, 2_800.25],
    [333_180.01, 2_873.24],
    [370_200.01, 3_203.68],
    [740_400.01, 3_751.85],
    [1_110_600.01, 4_319.28],
    [1_480_800.01, 4_886.77],
    [1_851_000.01, 5_180.15],
    [2_221_200.01, 6_647.08],
    [3_702_000.01, 9_287.49],
    [5_553_000.01, 12_221.3],
    [7_404_000.01, 15_155.11],
    [9_255_000.01, 18_088.94],
    [11_106_000.01, 21_022.73],
    [12_957_000.01, 23_956.56],
    [14_808_000.01, 26_890.36],
    [16_659_000.01, 29_824.18],
    [18_510_000.01, 34_224.89],
    [22_212_000.01, 40_092.51],
    [25_914_000.01, 45_960.13],
    [29_616_000.01, 51_827.75],
    [33_318_000.01, 57_695.39],
    [37_020_000.01, 63_563.01],
    [40_722_000.01, 69_430.64],
    [44_424_000.01, 75_298.27],
    [48_126_000.01, 81_165.89],
    [51_828_000.01, 87_033.51],
    [55_530_000.01, 95_834.95],
    [62_934_000.01, 107_570.19],
    [70_338_000.01, 119_305.45],
    [77_742_000.01, 131_040.7],
    [85_146_000.01, 142_775.96],
    [92_550_000.01, 154_511.21],
    [99_954_000.01, 166_246.46],
    [107_358_000.01, 177_981.7],
    [114_762_000.01, 189_716.95],
    [122_166_000.01, 201_452.21],
    [129_570_000.01, 213_187.45],
    [136_974_000, 225_606.27],
  ].map((row) => Object.freeze(row as unknown as readonly [number, number])),
);

type AuditItem = { label: string; ok: boolean };

export type Wf16Result = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  businessUnit: string;
  informedModality: string;
  effectiveModality: string;
  modalityForced?: boolean;
  financingRate: number;
  maximumFinancing: number;
  financingUsage?: number;
  financingHeadroom?: number;
  incomeRange: number;
  propertyRange: number;
  normalizations: string[];
  itbi?: number;
  itbiRule?: string;
  purchaseRegistration?: number;
  lienRegistration?: number;
  totalRegistration?: number;
  dispatchFee?: number;
  caixaInsurance?: number;
  totalCash?: number;
  installments?: number;
  installmentValue?: number;
  firstInstallmentDate?: string;
  firstInstallmentCorrected?: boolean;
  audit: AuditItem[];
  calculationMemory: Array<{ step: string; value: number | string }>;
};

function normalized(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/\s+/g, " ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
    : "";
}

function businessUnit(value: unknown): string {
  const candidate = normalized(value);
  return candidate === "DIRECIONAL" ? "Direcional" : candidate === "RIVA" ? "Riva" : "";
}

function modality(value: unknown): string {
  const candidate = normalized(value);
  if (candidate === "MCMV" || candidate === "MINHA CASA MINHA VIDA") return "MCMV";
  return candidate === "SBPE" || candidate === "SPBE" ? "SPBE" : "";
}

function firstProperty(value: unknown): string {
  if (value === true) return "SIM";
  if (value === false) return "NAO";
  const candidate = normalized(value);
  return candidate === "SIM" || candidate === "NAO" ? candidate : "";
}

function numeric(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value.trim() ? date : null;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function registrationFee(value: number): number | null {
  for (let index = REGISTRATION_TABLE.length - 1; index >= 0; index -= 1) {
    const [minimum, fee] = REGISTRATION_TABLE[index]!;
    if (value >= minimum) return fee;
  }
  return null;
}

function lastValidFirstInstallment(baseDate: Date): Date | null {
  const limit = addDays(baseDate, WF16_FORMULA.firstInstallmentWindowDays);
  let selected: Date | null = null;
  for (
    const cursor = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
    cursor <= limit;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    for (const day of WF16_FORMULA.validDueDays) {
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
      if (candidate >= baseDate && candidate <= limit && (!selected || candidate > selected)) {
        selected = candidate;
      }
    }
  }
  return selected;
}

function firstInstallment(baseDate: Date, requested: string) {
  const fallback = lastValidFirstInstallment(baseDate);
  const requestedDate = parseDate(requested);
  const limit = addDays(baseDate, WF16_FORMULA.firstInstallmentWindowDays);
  const requestedIsValid = Boolean(
    requestedDate &&
    requestedDate >= baseDate &&
    requestedDate <= limit &&
    WF16_FORMULA.validDueDays.includes(requestedDate.getUTCDate() as 5 | 10 | 15),
  );
  const selected = requestedIsValid ? requestedDate : fallback;
  return {
    date: selected?.toISOString().slice(0, 10) ?? "",
    corrected: Boolean(requested) && !requestedIsValid,
  };
}

function itbi({
  salePrice,
  financing,
  effectiveModality,
  firstPropertyValue,
}: {
  salePrice: number;
  financing: number;
  effectiveModality: string;
  firstPropertyValue: string;
}) {
  if (
    firstPropertyValue === "SIM" &&
    effectiveModality === "MCMV" &&
    salePrice <= WF16_FORMULA.itbiExemptionLimit
  ) {
    return { value: 0, rule: "Isenção: 1º imóvel + MCMV dentro do limite oficial." };
  }
  if (salePrice <= WF16_FORMULA.progressiveItbiLimit) {
    const reducedBase = Math.min(Math.max(financing, 0), WF16_FORMULA.reducedItbiBase);
    return {
      value: Math.max(
        0,
        reducedBase * WF16_FORMULA.reducedItbiRate +
          (salePrice - reducedBase) * WF16_FORMULA.fullItbiRate,
      ),
      rule: "Progressivo: 0,5% sobre a base reduzida do financiamento e 3% sobre o excedente da venda.",
    };
  }
  return {
    value: salePrice * WF16_FORMULA.fullItbiRate,
    rule: "Integral: 3% sobre o valor da venda.",
  };
}

function installmentPayment(total: number, installments: number): number {
  if (total <= 0) return 0;
  const rate = WF16_FORMULA.monthlyInterest;
  const factor = (1 + rate) ** installments;
  return total * ((rate * factor) / (factor - 1));
}

function incomeRange(value: number): number {
  return value <= 5_000 ? 2 : value <= 9_600 ? 3 : value <= 13_000 ? 4 : 0;
}

function propertyRange(value: number): number {
  return value <= 275_000 ? 2 : value <= 350_000 ? 3 : value <= 500_000 ? 4 : 99;
}

function registrationTableIsValid(): boolean {
  return (
    REGISTRATION_TABLE.length === 48 &&
    REGISTRATION_TABLE.every(
      ([minimum, fee], index) =>
        Number.isFinite(minimum) &&
        Number.isFinite(fee) &&
        minimum > 0 &&
        fee > 0 &&
        (index === 0 || minimum > REGISTRATION_TABLE[index - 1]![0]),
    )
  );
}

export function calculateWf16(input: Wf16Input): Wf16Result {
  const unit = businessUnit(input.businessUnit);
  const informedModality = modality(input.modality);
  const firstPropertyValue = firstProperty(input.firstProperty);
  const effectiveModality = firstPropertyValue === "NAO" ? "SPBE" : informedModality;
  const salePrice = numeric(input.salePrice);
  const appraisalValue = numeric(input.appraisalValue);
  const financing = numeric(input.financing);
  const income = numeric(input.income);
  const baseDate = parseDate(input.baseDate);
  const tableIsValid = registrationTableIsValid();
  const selectedIncomeRange = Number.isFinite(income) && income > 0 ? incomeRange(income) : 0;
  const selectedPropertyRange =
    Number.isFinite(salePrice) && salePrice > 0 ? propertyRange(salePrice) : 0;
  const mcmvCompatible =
    effectiveModality !== "MCMV" ||
    (income <= WF16_FORMULA.mcmvIncomeLimit &&
      salePrice <= WF16_FORMULA.mcmvPropertyLimit &&
      selectedIncomeRange >= selectedPropertyRange &&
      selectedPropertyRange <= 4);
  const normalizations: string[] = [];
  if (input.businessUnit !== unit) normalizations.push("unidade_negocio");
  if (normalized(input.modality) !== informedModality) normalizations.push("modalidade");
  if (
    typeof input.firstProperty === "boolean" ||
    (typeof input.firstProperty === "string" && input.firstProperty !== firstPropertyValue)
  ) {
    normalizations.push("primeiro_imovel");
  }

  const errors: string[] = [];
  if (!["Direcional", "Riva"].includes(unit)) errors.push("Selecione Direcional ou Riva.");
  if (!["MCMV", "SPBE"].includes(informedModality)) errors.push("Selecione MCMV ou SPBE.");
  if (!["SIM", "NAO"].includes(firstPropertyValue)) {
    errors.push("Informe se é o primeiro imóvel.");
  }
  if (!(Number.isFinite(salePrice) && salePrice > 0)) {
    errors.push("Valor da venda deve ser numérico e maior que zero.");
  }
  if (!(Number.isFinite(appraisalValue) && appraisalValue > 0)) {
    errors.push("Avaliação bancária deve ser numérica e maior que zero.");
  }
  if (!(Number.isFinite(financing) && financing > 0)) {
    errors.push("Valor do financiamento deve ser numérico e maior que zero.");
  }
  if (input.income !== "" && !Number.isFinite(income)) errors.push("Renda deve ser numérica.");
  if (effectiveModality === "MCMV" && !(income > 0)) {
    errors.push("Informe a renda para validar cenário MCMV.");
  }
  if (effectiveModality === "MCMV" && income > 0 && !mcmvCompatible) {
    errors.push("Renda ou valor do imóvel incompatível com o enquadramento MCMV.");
  }
  if (!baseDate) errors.push("Informe data-base válida.");
  if (!tableIsValid) errors.push("Tabela local de registro ausente ou incompleta.");

  const financingRate =
    effectiveModality === "MCMV"
      ? WF16_FORMULA.mcmvFinancingLimit
      : WF16_FORMULA.spbeFinancingLimit;
  const appraisalLimit =
    Number.isFinite(appraisalValue) && appraisalValue > 0
      ? roundMoney(appraisalValue * financingRate)
      : 0;
  const maximumFinancing =
    appraisalLimit > 0 && salePrice > 0
      ? Math.min(appraisalLimit, roundMoney(salePrice))
      : appraisalLimit;
  if (financing > salePrice && salePrice > 0) {
    errors.push("Financiamento não pode superar o valor da venda.");
  }
  if (financing > appraisalLimit && appraisalLimit > 0) {
    errors.push(
      `Financiamento supera teto de ${Math.round(financingRate * 100)}% da avaliação bancária.`,
    );
  }

  const purchaseFee = tableIsValid && salePrice > 0 ? registrationFee(salePrice) : null;
  const lienFee = tableIsValid && financing > 0 ? registrationFee(financing) : null;
  if (salePrice > 0 && purchaseFee === null) {
    errors.push("Faixa de registro da compra e venda não localizada.");
  }
  if (financing > 0 && lienFee === null) {
    errors.push("Faixa de registro da alienação não localizada.");
  }

  const audit: AuditItem[] = [
    { label: "UDN", ok: ["Direcional", "Riva"].includes(unit) },
    { label: "Modalidade efetiva", ok: ["MCMV", "SPBE"].includes(effectiveModality) },
    {
      label: "Valores financeiros",
      ok:
        Number.isFinite(salePrice) &&
        salePrice > 0 &&
        Number.isFinite(appraisalValue) &&
        appraisalValue > 0 &&
        Number.isFinite(financing) &&
        financing > 0,
    },
    {
      label: "Teto do financiamento",
      ok: financing > 0 && financing <= maximumFinancing && financing <= salePrice,
    },
    { label: "Enquadramento MCMV", ok: mcmvCompatible },
    { label: "Data-base", ok: Boolean(baseDate) },
    {
      label: "Tabela local de registro",
      ok: tableIsValid && purchaseFee !== null && lienFee !== null,
    },
  ];

  const baseResult = {
    ok: errors.length === 0,
    errors,
    warnings: [] as string[],
    businessUnit: unit,
    informedModality,
    effectiveModality,
    financingRate,
    maximumFinancing,
    incomeRange: selectedIncomeRange,
    propertyRange: selectedPropertyRange,
    normalizations,
    audit,
  };

  if (errors.length > 0 || !baseDate || purchaseFee === null || lienFee === null) {
    return { ...baseResult, calculationMemory: [] };
  }

  const itbiResult = itbi({
    salePrice,
    financing,
    effectiveModality,
    firstPropertyValue,
  });
  const isFirstProperty = firstPropertyValue === "SIM";
  const itbiValue = roundMoney(itbiResult.value);
  const purchaseRegistration = roundMoney(
    purchaseFee * (isFirstProperty ? WF16_FORMULA.firstPropertyPurchaseRegistrationFactor : 1),
  );
  const lienRegistration = roundMoney(
    lienFee * (isFirstProperty ? WF16_FORMULA.firstPropertyLienRegistrationFactor : 1),
  );
  const totalRegistration = roundMoney(purchaseRegistration + lienRegistration);
  const totalCash = roundMoney(
    WF16_FORMULA.dispatchFee + itbiValue + totalRegistration + WF16_FORMULA.caixaInsurance,
  );
  const installments =
    unit === "Direcional" ? WF16_FORMULA.direcionalInstallments : WF16_FORMULA.rivaInstallments;
  const installmentValue = roundMoney(installmentPayment(totalCash, installments));
  const selectedFirstInstallment = firstInstallment(baseDate, input.requestedFirstInstallment);

  return {
    ...baseResult,
    ok: true,
    modalityForced: informedModality !== effectiveModality,
    financingUsage: financing / appraisalValue,
    financingHeadroom: maximumFinancing - financing,
    itbi: itbiValue,
    itbiRule: itbiResult.rule,
    purchaseRegistration,
    lienRegistration,
    totalRegistration,
    dispatchFee: WF16_FORMULA.dispatchFee,
    caixaInsurance: WF16_FORMULA.caixaInsurance,
    totalCash,
    installments,
    installmentValue,
    firstInstallmentDate: selectedFirstInstallment.date,
    firstInstallmentCorrected: selectedFirstInstallment.corrected,
    calculationMemory: [
      { step: "Modalidade efetiva", value: effectiveModality },
      { step: "Teto do financiamento", value: maximumFinancing },
      { step: "ITBI", value: itbiValue },
      { step: "Registro total", value: totalRegistration },
      { step: "Total da documentação", value: totalCash },
      { step: "Parcelas", value: installments },
      { step: "Parcela", value: installmentValue },
      { step: "Primeiro vencimento", value: selectedFirstInstallment.date },
    ],
  };
}

export const WF16_REFERENCE_TABLES = Object.freeze({
  incomeRanges: INCOME_RANGES,
  registrationTable: REGISTRATION_TABLE,
});
