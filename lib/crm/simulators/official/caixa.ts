import "server-only";

import { z } from "zod";

import {
  legacyDateInput,
  legacyDecimalInput,
  legacyMoneyCentsOutput,
  legacyMoneyCentsToNumber,
  legacyMoneyInput,
  legacyNumberToMoneyCents,
  legacyOptionalMoneyInput,
  parseLegacyDate,
  parseLegacyMoneyCents,
  roundLegacyNumber,
  serializeLegacyMoneyCents,
  wholeLegacyMonths,
} from "./legacy-reference-shared";

const STATES = [
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

const MCMV_RATE_TABLE = [
  [2_160, 4.5, 4.75],
  [2_850, 4.75, 5],
  [3_200, 5, 5.25],
  [3_500, 5.25, 5.5],
  [4_000, 6, 6],
  [5_000, 7, 7],
  [9_600, 8.16, 8.16],
  [13_000, 10, 10],
] as const;

const PREVIOUS_SUBSIDY_RATE_TABLE = [
  [2_160, 6.13, 5.63],
  [2_850, 6.06, 5.56],
  [3_200, 6.08, 5.58],
  [3_500, 6.08, 5.58],
  [4_000, 6.08, 5.58],
  [5_000, 7, 6.5],
  [9_600, 8.16, 7.66],
  [13_000, 10, 10],
] as const;

const MCMV_MIP_TABLE = [
  [18, 25, 0.0082],
  [26, 30, 0.0085],
  [31, 35, 0.0108],
  [36, 40, 0.0144],
  [41, 45, 0.0244],
  [46, 50, 0.0359],
  [51, 55, 0.0645],
  [56, 60, 0.0764],
  [61, 65, 0.1296],
  [66, 70, 0.2005],
  [71, 75, 0.3729],
  [76, 99, 0.4566],
] as const;

const SBPE_MIP_TABLE = [
  [18, 25, 0.0093],
  [26, 30, 0.0096],
  [31, 35, 0.0116],
  [36, 40, 0.0154],
  [41, 45, 0.0252],
  [46, 50, 0.0386],
  [51, 55, 0.0676],
  [56, 60, 0.1533],
  [61, 65, 0.2731],
  [66, 70, 0.3259],
  [71, 75, 0.4894],
  [76, 99, 0.5312],
] as const;

const SUBSIDY_STATE_ADJUSTMENT: Record<(typeof STATES)[number], number> = {
  DF: 7.17,
  GO: -0.68,
  MS: -3.49,
  MT: -0.13,
  AL: -8.14,
  BA: -5.03,
  CE: -7.87,
  MA: 0.69,
  PB: -6.78,
  PE: -5.31,
  PI: -8.13,
  RN: 0.58,
  SE: -6.18,
  AC: 3.44,
  AM: 0.56,
  AP: 10,
  PA: 5.45,
  RO: -10,
  RR: -4.83,
  TO: -3.17,
  ES: -5.1,
  MG: -5.68,
  RJ: -1.78,
  SP: -5.68,
  PR: -5.13,
  RS: -1.09,
  SC: 4.58,
};

const SPECIAL_RATE_STATES = new Set([
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "MA",
  "PA",
  "PB",
  "PE",
  "PI",
  "RN",
  "RO",
  "RR",
  "SE",
  "TO",
]);
const NORTH_STATES = new Set(["AC", "AM", "AP", "PA", "RO", "RR", "TO"]);

const termInput = z.union([z.literal(""), z.string().regex(/^[1-9]\d{0,2}$/)]);

export const caixaInputSchema = z
  .object({
    income: legacyMoneyInput,
    approvedPayment: legacyOptionalMoneyInput,
    propertyValue: legacyMoneyInput,
    ownFunds: legacyOptionalMoneyInput,
    fgts: legacyOptionalMoneyInput,
    birthDate: legacyDateInput,
    asOf: legacyDateInput,
    state: z.enum(STATES),
    city: z.string().trim().min(1).max(160),
    cityLimit: legacyOptionalMoneyInput,
    populationFactor: legacyDecimalInput,
    term: termInput,
    product: z.enum(["mcmv", "sbpe"]),
    system: z.enum(["price", "sac"]),
    hasFgts36: z.boolean(),
    previousSubsidy: z.boolean(),
    socialFactor: z.boolean(),
    inConstruction: z.boolean(),
  })
  .strict();

export type CaixaInput = z.infer<typeof caixaInputSchema>;

export const caixaResultSchema = z
  .object({
    ok: z.boolean(),
    errors: z.array(z.string()),
    formulaVersion: z.string(),
    provenance: z.literal("legacy-reference-2026-08-28"),
    validation: z.literal("indicative_requires_caixa_confirmation"),
    product: z.enum(["mcmv", "sbpe"]),
    system: z.enum(["price", "sac"]),
    forcedSbpe: z.boolean(),
    age: z.number().int().min(18).max(99),
    term: z.number().int().nonnegative(),
    maximumTerm: z.number().int().nonnegative(),
    annualRatePercent: z.number().nonnegative(),
    effectiveAnnualRatePercent: z.number().nonnegative(),
    incomeLimitPercent: z.number().nonnegative(),
    maximumPaymentByIncomeCents: legacyMoneyCentsOutput,
    approvedPaymentCents: legacyMoneyCentsOutput,
    propertyValueCents: legacyMoneyCentsOutput,
    financingCents: legacyMoneyCentsOutput,
    maximumFinancingByIncomeCents: legacyMoneyCentsOutput,
    quotaFinancingCents: legacyMoneyCentsOutput,
    subsidyCents: legacyMoneyCentsOutput,
    fgtsCents: legacyMoneyCentsOutput,
    ownFundsCents: legacyMoneyCentsOutput,
    totalResourcesCents: legacyMoneyCentsOutput,
    entryNeededCents: legacyMoneyCentsOutput,
    firstPaymentCents: legacyMoneyCentsOutput,
    principalPaymentCents: legacyMoneyCentsOutput,
    insuranceCents: legacyMoneyCentsOutput,
    operatingFeeCents: legacyMoneyCentsOutput,
    commitmentBps: z.number().int().nonnegative(),
    fitsProperty: z.boolean(),
  })
  .strict();

export type CaixaResult = z.infer<typeof caixaResultSchema>;

export const CAIXA_FORMULA = Object.freeze({
  engineKey: "simulator.caixa" as const,
  workflow: "CAIXA",
  scope: "Simulador habitacional indicativo",
  version: "caixa-legacy-reference-2026-08-28.1",
  provenance: "legacy-reference-2026-08-28" as const,
  sourceRoute: "https://descomplicapro.com.br/simulacao/caixa",
  sourceAsset: "https://descomplicapro.com.br/assets/CaixaSimulator-B0xGSx3Z.js",
  sourceSha256: "9cf6bb798a8a1a7a2566390af38fe3aca2a391eaaecf2f38f44f90cdcc7c50ef",
  observedAt: "2026-08-28T00:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  rounding: "legacy-number-then-half-up-to-cent",
});

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function ageAt(birthDate: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    asOf.getUTCMonth() < birthDate.getUTCMonth() ||
    (asOf.getUTCMonth() === birthDate.getUTCMonth() && asOf.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return clamp(age, 18, 99);
}

function maximumTerm(
  birthDate: Date,
  asOf: Date,
  product: "mcmv" | "sbpe",
  system: "price" | "sac",
  inConstruction: boolean,
): number {
  const ageMonths = wholeLegacyMonths(birthDate, asOf);
  const insuranceTerm = Math.max(0, 966 - ageMonths - (inConstruction ? 36 : 0));
  const productLimit = product === "mcmv" ? 420 : system === "price" ? 360 : 420;
  return Math.max(0, Math.min(productLimit, insuranceTerm));
}

function annualRate(
  income: number,
  state: string,
  propertyValue: number,
  product: "mcmv" | "sbpe",
  hasFgts36: boolean,
  previousSubsidy: boolean,
): number {
  if (product === "sbpe") return 10.9259;
  if (previousSubsidy) {
    const row = PREVIOUS_SUBSIDY_RATE_TABLE.find(([maximum]) => income <= maximum);
    let value: number = row?.[hasFgts36 ? 2 : 1] ?? 10;
    if (propertyValue > 400_000 && propertyValue <= 600_000) value = Math.max(value, 10);
    return value;
  }
  const row = MCMV_RATE_TABLE.find(([maximum]) => income <= maximum);
  let value: number = row?.[SPECIAL_RATE_STATES.has(state) ? 1 : 2] ?? 10;
  if (propertyValue > 400_000 && propertyValue <= 600_000) value = Math.max(value, 10);
  if (hasFgts36 && income <= 9_600 && value < 10) value -= 0.5;
  return value;
}

function mipRate(age: number, product: "mcmv" | "sbpe"): number {
  const row = (product === "sbpe" ? SBPE_MIP_TABLE : MCMV_MIP_TABLE).find(
    ([minimum, maximum]) => age >= minimum && age <= maximum,
  );
  return (row?.[2] ?? (product === "sbpe" ? 0.5312 : 0.4566)) / 100;
}

function pricePayment(balance: number, annualRatePercent: number, term: number): number {
  if (!balance || !term) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (!monthlyRate) return balance / term;
  const compound = (1 + monthlyRate) ** term;
  return (balance * monthlyRate * compound) / (compound - 1);
}

function sacPayment(balance: number, annualRatePercent: number, term: number): number {
  return !balance || !term ? 0 : balance / term + (balance * annualRatePercent) / 100 / 12;
}

function subsidy(input: {
  income: number;
  propertyValue: number;
  state: (typeof STATES)[number];
  cityLimit: number;
  populationFactor: number;
  socialFactor: boolean;
  previousSubsidy: boolean;
}): number {
  if (
    input.previousSubsidy ||
    input.income > 3_700 ||
    !input.income ||
    !input.propertyValue ||
    input.populationFactor <= 0
  ) {
    return 0;
  }
  const maximum = 50_000;
  const minimumIncome = 1_750;
  const maximumIncome = 3_700;
  const linear = (2 * maximum * (1_900 / maximum - 1)) / (maximumIncome - minimumIncome);
  const quadratic = -linear / (2 * (maximumIncome - minimumIncome));
  const base = Math.max(
    0,
    quadratic * (input.income - minimumIncome) ** 2 +
      linear * (input.income - minimumIncome) +
      maximum,
  );
  const rate =
    annualRate(input.income, input.state, input.propertyValue, "mcmv", false, false) / 100 / 12;
  const compound = (1 + rate) ** 420;
  const adjustment = clamp(
    10 -
      40 *
        ((0.25 * input.income * (compound - 1)) /
          (compound * rate) /
          Math.min(input.propertyValue, 0.675 * (input.cityLimit || input.propertyValue)) -
          0.5),
    -10,
    10,
  );
  let result =
    base *
    (1 + (SUBSIDY_STATE_ADJUSTMENT[input.state] + adjustment) / 100) *
    input.populationFactor;
  result = Math.min(result, NORTH_STATES.has(input.state) ? 65_000 : 55_000);
  if (!input.socialFactor) result *= 0.3;
  return result < 1_500 ? 0 : Math.round(result);
}

function cents(value: number): string {
  return serializeLegacyMoneyCents(legacyNumberToMoneyCents(value));
}

export function calculateCaixa(input: CaixaInput): CaixaResult {
  const income = legacyMoneyCentsToNumber(parseLegacyMoneyCents(input.income));
  const propertyValue = legacyMoneyCentsToNumber(parseLegacyMoneyCents(input.propertyValue));
  const ownFunds = input.ownFunds
    ? legacyMoneyCentsToNumber(parseLegacyMoneyCents(input.ownFunds))
    : 0;
  const requestedProduct = input.product;
  const errors: string[] = [];
  if (income === 0) errors.push("Informe a renda familiar.");
  if (propertyValue === 0) errors.push("Informe o valor do imóvel.");
  const product = income > 13_000 || propertyValue > 600_000 ? "sbpe" : requestedProduct;
  const system = product === "mcmv" ? "price" : input.system;
  const birthDate = parseLegacyDate(input.birthDate)!;
  const asOf = parseLegacyDate(input.asOf)!;
  const age = ageAt(birthDate, asOf);
  const maxTerm = maximumTerm(birthDate, asOf, product, system, input.inConstruction);
  const requestedTerm = input.term ? Number(input.term) : maxTerm;
  const term = Math.max(1, Math.min(requestedTerm || maxTerm, maxTerm));
  const rate = annualRate(
    income,
    input.state,
    propertyValue,
    product,
    input.hasFgts36,
    input.previousSubsidy,
  );
  const subsidyValue =
    product === "mcmv"
      ? subsidy({
          income,
          propertyValue,
          state: input.state,
          cityLimit: input.cityLimit
            ? legacyMoneyCentsToNumber(parseLegacyMoneyCents(input.cityLimit))
            : 0,
          populationFactor: Number(input.populationFactor),
          socialFactor: input.socialFactor,
          previousSubsidy: input.previousSubsidy,
        })
      : 0;
  const fgts =
    input.hasFgts36 && input.fgts ? legacyMoneyCentsToNumber(parseLegacyMoneyCents(input.fgts)) : 0;
  const totalResources = fgts + ownFunds;
  const quota = product === "mcmv" || system === "price" ? 0.8 : 0.9;
  const outstanding = Math.max(0, propertyValue - totalResources - subsidyValue);
  const quotaFinancing = propertyValue * quota;
  const monthlyMip = mipRate(age, product);
  const monthlyDfi = (product === "sbpe" ? 0.0066 : 0.0071) / 100;
  const operatingFee = product === "mcmv" && income <= 2_850 ? 0 : 25;
  const unitFactor = system === "price" ? pricePayment(1, rate, term) : sacPayment(1, rate, term);
  const incomeLimitPercent = product === "sbpe" && system === "price" ? 25 : 30;
  const maximumPaymentByIncome = (income * incomeLimitPercent) / 100;
  const approvedPayment = input.approvedPayment
    ? legacyMoneyCentsToNumber(parseLegacyMoneyCents(input.approvedPayment))
    : 0;
  if (approvedPayment > maximumPaymentByIncome) {
    errors.push("A prestação informada ultrapassa o teto de comprometimento da renda.");
  }
  const paymentCapacity =
    (approvedPayment || maximumPaymentByIncome) - propertyValue * monthlyDfi - operatingFee;
  const maximumFinancingByIncome =
    paymentCapacity > 0 ? paymentCapacity / (unitFactor + monthlyMip) : 0;
  const financing = Math.max(0, Math.min(outstanding, quotaFinancing, maximumFinancingByIncome));
  const principalPayment =
    system === "price" ? pricePayment(financing, rate, term) : sacPayment(financing, rate, term);
  const insurance = financing * monthlyMip + propertyValue * monthlyDfi;
  const firstPayment = principalPayment + insurance + operatingFee;
  const entryNeeded = Math.max(0, propertyValue - financing - totalResources - subsidyValue);
  const effectiveRate = ((1 + rate / 100 / 12) ** 12 - 1) * 100;

  const result: CaixaResult = {
    ok: errors.length === 0,
    errors,
    formulaVersion: CAIXA_FORMULA.version,
    provenance: CAIXA_FORMULA.provenance,
    validation: "indicative_requires_caixa_confirmation",
    product,
    system,
    forcedSbpe: product === "sbpe" && requestedProduct === "mcmv",
    age,
    term,
    maximumTerm: maxTerm,
    annualRatePercent: roundLegacyNumber(rate, 4),
    effectiveAnnualRatePercent: roundLegacyNumber(effectiveRate, 6),
    incomeLimitPercent,
    maximumPaymentByIncomeCents: cents(maximumPaymentByIncome),
    approvedPaymentCents: cents(approvedPayment),
    propertyValueCents: cents(propertyValue),
    financingCents: cents(financing),
    maximumFinancingByIncomeCents: cents(maximumFinancingByIncome),
    quotaFinancingCents: cents(quotaFinancing),
    subsidyCents: cents(subsidyValue),
    fgtsCents: cents(fgts),
    ownFundsCents: cents(ownFunds),
    totalResourcesCents: cents(totalResources),
    entryNeededCents: cents(entryNeeded),
    firstPaymentCents: cents(firstPayment),
    principalPaymentCents: cents(principalPayment),
    insuranceCents: cents(insurance),
    operatingFeeCents: cents(operatingFee),
    commitmentBps: income > 0 ? Math.max(0, Math.round((firstPayment / income) * 10_000)) : 0,
    fitsProperty: entryNeeded <= 0.01,
  };
  return caixaResultSchema.parse(result);
}
