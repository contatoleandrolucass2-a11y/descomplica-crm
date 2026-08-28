import "server-only";

import { z } from "zod";

import {
  addLegacyDays,
  legacyDateInput,
  legacyMoneyCentsOutput,
  legacyMoneyInput,
  legacyOptionalDateInput,
  legacyOptionalMoneyInput,
  multiplyLegacyRatio,
  parseLegacyDate,
  parseLegacyMoneyCents,
  roundLegacyFraction,
  serializeLegacyDate,
  serializeLegacyMoneyCents,
} from "./legacy-reference-shared";

const REGISTRATION_FEES = [
  ["0.01", "250.89"],
  ["2222.01", "402.59"],
  ["5551.01", "722.25"],
  ["9253.01", "1071.65"],
  ["18510.01", "1302.87"],
  ["37020.01", "1452.97"],
  ["111060.01", "1854.49"],
  ["185100.01", "2255.22"],
  ["222120.01", "2455.19"],
  ["259140.01", "2656.29"],
  ["296160.01", "2800.25"],
  ["333180.01", "2873.24"],
  ["370200.01", "3203.68"],
  ["740400.01", "3751.85"],
  ["1110600.01", "4319.28"],
  ["1480800.01", "4886.77"],
  ["1851000.01", "5180.15"],
  ["2221200.01", "6647.08"],
  ["3702000.01", "9287.49"],
  ["5553000.01", "12221.30"],
  ["7404000.01", "15155.11"],
  ["9255000.01", "18088.94"],
  ["11106000.01", "21022.73"],
  ["12957000.01", "23956.56"],
  ["14808000.01", "26890.36"],
  ["16659000.01", "29824.18"],
  ["18510000.01", "34224.89"],
  ["22212000.01", "40092.51"],
  ["25914000.01", "45960.13"],
  ["29616000.01", "51827.75"],
  ["33318000.01", "57695.39"],
  ["37020000.01", "63563.01"],
  ["40722000.01", "69430.64"],
  ["44424000.01", "75298.27"],
  ["48126000.01", "81165.89"],
  ["51828000.01", "87033.51"],
  ["55530000.01", "95834.95"],
  ["62934000.01", "107570.19"],
  ["70338000.01", "119305.45"],
  ["77742000.01", "131040.70"],
  ["85146000.01", "142775.96"],
  ["92550000.01", "154511.21"],
  ["99954000.01", "166246.46"],
  ["107358000.01", "177981.70"],
  ["114762000.01", "189716.95"],
  ["122166000.01", "201452.21"],
  ["129570000.01", "213187.45"],
  ["136974000", "225606.27"],
] as const;

const REGISTRATION_FEE_CENTS = REGISTRATION_FEES.map(([minimum, fee]) => ({
  minimum: parseLegacyMoneyCents(minimum),
  fee: parseLegacyMoneyCents(fee),
}));

const auditSchema = z.object({ label: z.string(), ok: z.boolean() }).strict();

export const wf16InputSchema = z
  .object({
    businessUnit: z.enum(["direcional", "riva"]),
    modality: z.enum(["mcmv", "spbe"]),
    firstProperty: z.boolean(),
    salePrice: legacyMoneyInput,
    appraisalValue: legacyMoneyInput,
    financing: legacyMoneyInput,
    income: legacyOptionalMoneyInput,
    baseDate: legacyDateInput,
    requestedFirstInstallment: legacyOptionalDateInput,
  })
  .strict();

export type Wf16Input = z.infer<typeof wf16InputSchema>;

export const wf16ResultSchema = z
  .object({
    ok: z.boolean(),
    errors: z.array(z.string()),
    formulaVersion: z.string(),
    provenance: z.literal("legacy-reference-2026-08-28"),
    effectiveModality: z.enum(["mcmv", "spbe"]),
    modalityForced: z.boolean(),
    maximumFinancingCents: legacyMoneyCentsOutput,
    financingRateBps: z.number().int().nonnegative(),
    incomeRange: z.number().int().nonnegative(),
    propertyRange: z.number().int().nonnegative(),
    itbiCents: legacyMoneyCentsOutput,
    purchaseRegistrationCents: legacyMoneyCentsOutput,
    lienRegistrationCents: legacyMoneyCentsOutput,
    totalRegistrationCents: legacyMoneyCentsOutput,
    dispatchFeeCents: legacyMoneyCentsOutput,
    caixaInsuranceCents: legacyMoneyCentsOutput,
    totalCashCents: legacyMoneyCentsOutput,
    installments: z.number().int().nonnegative(),
    installmentValueCents: legacyMoneyCentsOutput,
    firstInstallmentDate: z.string(),
    firstInstallmentCorrected: z.boolean(),
    audit: z.array(auditSchema),
  })
  .strict();

export type Wf16Result = z.infer<typeof wf16ResultSchema>;

export const WF16_FORMULA = Object.freeze({
  engineKey: "simulator.wf16" as const,
  workflow: "WF-16",
  scope: "Calcular Documentação",
  version: "wf16-legacy-reference-2026-08-28.1",
  provenance: "legacy-reference-2026-08-28" as const,
  sourceRoute: "https://descomplicapro.com.br/simulacao/calcular-documentacao",
  sourceAsset: "https://descomplicapro.com.br/assets/documentation-calculator-rules-xUNTLmKr.js",
  sourceSha256: "615a41e0bdcce3b567ee80c708072c44f41908371d4f6f1101ea565685836713",
  observedAt: "2026-08-28T00:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  rounding: "half-up-to-cent",
});

function registrationFee(value: bigint): bigint {
  for (let index = REGISTRATION_FEE_CENTS.length - 1; index >= 0; index -= 1) {
    const row = REGISTRATION_FEE_CENTS[index];
    if (row && value >= row.minimum) return row.fee;
  }
  return 0n;
}

function latestDueDate(baseDate: Date): Date {
  const end = addLegacyDays(baseDate, 120);
  let latest = baseDate;
  for (
    let month = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 12));
    month <= end;
    month.setUTCMonth(month.getUTCMonth() + 1)
  ) {
    for (const day of [5, 10, 15]) {
      const candidate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 12));
      if (candidate >= baseDate && candidate <= end && candidate > latest) latest = candidate;
    }
  }
  return latest;
}

function installment(totalCents: bigint, installments: number): bigint {
  if (totalCents === 0n) return 0n;
  const base = 203n ** BigInt(installments);
  const neutral = 200n ** BigInt(installments);
  return roundLegacyFraction(totalCents * 3n * base, 200n * (base - neutral));
}

function incomeRange(income: bigint): number {
  if (income === 0n) return 0;
  if (income <= 500_000n) return 2;
  if (income <= 960_000n) return 3;
  if (income <= 1_300_000n) return 4;
  return 0;
}

function propertyRange(salePrice: bigint): number {
  if (salePrice === 0n) return 0;
  if (salePrice <= 27_500_000n) return 2;
  if (salePrice <= 35_000_000n) return 3;
  if (salePrice <= 50_000_000n) return 4;
  return 99;
}

export function calculateWf16(input: Wf16Input): Wf16Result {
  const salePrice = parseLegacyMoneyCents(input.salePrice);
  const appraisal = parseLegacyMoneyCents(input.appraisalValue);
  const financing = parseLegacyMoneyCents(input.financing);
  const income = input.income ? parseLegacyMoneyCents(input.income) : 0n;
  const effectiveModality = input.firstProperty ? input.modality : "spbe";
  const financingRateBps = effectiveModality === "mcmv" ? 8_000 : 9_000;
  const maximumFromAppraisal = multiplyLegacyRatio(appraisal, BigInt(financingRateBps), 10_000n);
  const maximumFinancing = maximumFromAppraisal < salePrice ? maximumFromAppraisal : salePrice;
  const incomeBand = incomeRange(income);
  const propertyBand = propertyRange(salePrice);
  const errors: string[] = [];

  if (salePrice === 0n) errors.push("Valor da venda deve ser maior que zero.");
  if (appraisal === 0n) errors.push("Avaliação bancária deve ser maior que zero.");
  if (financing === 0n) errors.push("Valor do financiamento deve ser maior que zero.");
  if (effectiveModality === "mcmv" && income === 0n) {
    errors.push("Informe a renda para validar cenário MCMV.");
  }
  if (
    effectiveModality === "mcmv" &&
    income > 0n &&
    (income > 1_300_000n || salePrice > 50_000_000n || incomeBand < propertyBand)
  ) {
    errors.push("Renda ou valor do imóvel incompatível com o enquadramento MCMV.");
  }
  if (financing > salePrice) errors.push("Financiamento não pode superar o valor da venda.");
  if (financing > maximumFinancing) {
    errors.push("Financiamento supera o teto da avaliação bancária.");
  }

  const baseDate = parseLegacyDate(input.baseDate)!;
  const requestedDate = input.requestedFirstInstallment
    ? parseLegacyDate(input.requestedFirstInstallment)
    : null;
  const endDate = addLegacyDays(baseDate, 120);
  const requestedIsValid =
    requestedDate !== null &&
    requestedDate >= baseDate &&
    requestedDate <= endDate &&
    [5, 10, 15].includes(requestedDate.getUTCDate());
  const firstInstallmentDate = requestedIsValid ? requestedDate : latestDueDate(baseDate);

  const purchaseFee = registrationFee(salePrice);
  const lienFee = registrationFee(financing);
  if (purchaseFee === 0n) errors.push("Faixa de registro da compra e venda não localizada.");
  if (lienFee === 0n) errors.push("Faixa de registro da alienação não localizada.");

  let itbi = 0n;
  if (!(input.firstProperty && effectiveModality === "mcmv" && salePrice <= 24_552_777n)) {
    if (salePrice <= 72_580_800n) {
      const reducedBase = [financing, 12_096_800n, salePrice].reduce((lowest, current) =>
        current < lowest ? current : lowest,
      );
      itbi =
        multiplyLegacyRatio(reducedBase, 5n, 1_000n) +
        multiplyLegacyRatio(salePrice - reducedBase, 3n, 100n);
    } else {
      itbi = multiplyLegacyRatio(salePrice, 3n, 100n);
    }
  }
  const purchaseRegistration = input.firstProperty
    ? multiplyLegacyRatio(purchaseFee, 620_879n, 1_000_000n)
    : purchaseFee;
  const lienRegistration = input.firstProperty ? multiplyLegacyRatio(lienFee, 1n, 2n) : lienFee;
  const totalRegistration = purchaseRegistration + lienRegistration;
  const dispatchFee = 30_000n;
  const caixaInsurance = 100_000n;
  const totalCash = dispatchFee + itbi + totalRegistration + caixaInsurance;
  const installments = input.businessUnit === "direcional" ? 40 : 36;

  const result: Wf16Result = {
    ok: errors.length === 0,
    errors,
    formulaVersion: WF16_FORMULA.version,
    provenance: WF16_FORMULA.provenance,
    effectiveModality,
    modalityForced: input.modality !== effectiveModality,
    maximumFinancingCents: serializeLegacyMoneyCents(maximumFinancing),
    financingRateBps,
    incomeRange: incomeBand,
    propertyRange: propertyBand,
    itbiCents: serializeLegacyMoneyCents(itbi),
    purchaseRegistrationCents: serializeLegacyMoneyCents(purchaseRegistration),
    lienRegistrationCents: serializeLegacyMoneyCents(lienRegistration),
    totalRegistrationCents: serializeLegacyMoneyCents(totalRegistration),
    dispatchFeeCents: serializeLegacyMoneyCents(dispatchFee),
    caixaInsuranceCents: serializeLegacyMoneyCents(caixaInsurance),
    totalCashCents: serializeLegacyMoneyCents(totalCash),
    installments,
    installmentValueCents: serializeLegacyMoneyCents(installment(totalCash, installments)),
    firstInstallmentDate: serializeLegacyDate(firstInstallmentDate),
    firstInstallmentCorrected: Boolean(input.requestedFirstInstallment && !requestedIsValid),
    audit: [
      { label: "Valores financeiros", ok: salePrice > 0n && appraisal > 0n && financing > 0n },
      { label: "Teto do financiamento", ok: financing <= maximumFinancing },
      {
        label: "Enquadramento MCMV",
        ok:
          effectiveModality !== "mcmv" ||
          (income > 0n &&
            income <= 1_300_000n &&
            salePrice <= 50_000_000n &&
            incomeBand >= propertyBand),
      },
      { label: "Tabela local de registro", ok: purchaseFee > 0n && lienFee > 0n },
    ],
  };
  return wf16ResultSchema.parse(result);
}
