import { CAIXA_QUICK_REFERENCE } from "./caixa";

const incomeLimits = [2160, 2850, 3200, 3500, 4000, 5000, 9600, 13000, 77500, Infinity];
const propertyLimits = [
  210000,
  210000,
  210000,
  210000,
  210000,
  210000,
  400000,
  600000,
  2250000,
  Infinity,
];
const effectiveRates = [
  0.048548, 0.051162, 0.053782, 0.056408, 0.061678, 0.07229, 0.084722, 0.1047, 0.1149, 0.134,
];
const round = (value: number) => Number(value.toFixed(2));

/** Independent reproduction of the public quick calculator v1.16.0.2.
 * It does not calculate a subsidy or replace the individual housing profile.
 * Source: simuladorhabitacao.caixa.gov.br/237.1b0cf2e0c38ee0d5.js, checked 2026-11-04.
 */
export function calculateCaixaPublicReference(input: {
  income: number;
  propertyValue: number;
  birthDate: string;
  asOf: string;
}) {
  const { income, propertyValue } = input;
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
      ? date
      : null;
  };
  const birth = parse(input.birthDate),
    today = parse(input.asOf);
  if (
    !birth ||
    !today ||
    !Number.isFinite(income) ||
    income <= 0 ||
    income > 1e9 ||
    !Number.isFinite(propertyValue) ||
    propertyValue <= 0 ||
    propertyValue > 1e10
  )
    return null;
  const ageMonths =
    (today.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    today.getUTCMonth() -
    birth.getUTCMonth() -
    (today.getUTCDate() < birth.getUTCDate() ? 1 : 0);
  const term = Math.min(420, 966 - ageMonths);
  if (ageMonths < 216 || term < 1) return null;
  const index = Math.max(
    incomeLimits.findIndex((value) => income <= value),
    propertyLimits.findIndex((value) => propertyValue <= value),
  );
  const effectiveRate = effectiveRates[index]!;
  const monthlyRate = Math.pow(1 + effectiveRate, 1 / 12) - 1;
  const age = Math.floor(ageMonths / 12);
  const mip =
    (CAIXA_QUICK_REFERENCE.mipMonthlyPercent.find(([maximum]) => age <= maximum) ??
      CAIXA_QUICK_REFERENCE.mipMonthlyPercent.at(-1)!)[1] / 100;
  const system = effectiveRate >= 0.1149 ? ("sac" as const) : ("price" as const);
  const payment = (value: number) => {
    const principal = value * 0.8;
    const financial =
      system === "sac"
        ? principal / term + principal * monthlyRate
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));
    return financial + 25 + value * 0.000066 + principal * mip;
  };
  let financedProperty = propertyValue;
  if (payment(propertyValue) > income * 0.3) {
    let low = 0,
      high = propertyValue,
      best = 0;
    for (let iteration = 0; iteration < 30; iteration++) {
      const middle = (low + high) / 2;
      if (payment(middle) <= income * 0.3) best = low = middle;
      else high = middle;
    }
    financedProperty = best;
  }
  const financing = financedProperty * 0.8;
  return {
    financing: round(financing),
    entry: round(propertyValue - financing),
    firstPayment: round(payment(financedProperty)),
    term,
    system,
    effectiveRate: effectiveRate * 100,
    nominalRate: monthlyRate * 1200,
    version: CAIXA_QUICK_REFERENCE.version,
    subsidyCalculated: false as const,
  };
}
