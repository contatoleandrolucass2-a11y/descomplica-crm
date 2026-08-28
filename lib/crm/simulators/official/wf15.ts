import "server-only";

import { z } from "zod";

import {
  addLegacyDays,
  addLegacyMonths,
  legacyBoundedText,
  legacyDateInput,
  legacyMoneyCentsOutput,
  legacyMoneyInput,
  legacyOptionalMoneyInput,
  multiplyLegacyRatio,
  parseLegacyDate,
  parseLegacyMoneyCents,
  roundLegacyFraction,
  serializeLegacyDate,
  serializeLegacyMoneyCents,
} from "./legacy-reference-shared";

const signalSchema = z
  .object({
    index: z.number().int().positive(),
    valueCents: legacyMoneyCentsOutput,
    date: legacyDateInput,
  })
  .strict();

const scenarioSchema = z
  .object({
    code: z.enum(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]),
    entryRateBps: z.number().int().nonnegative(),
    targetEntryRateBps: z.number().int().nonnegative(),
    installmentLimit: z.number().int().positive(),
    signalLimit: z.number().int().nonnegative(),
    intermediaryLimit: z.number().int().nonnegative(),
    installments: z.number().int().nonnegative(),
    intermediaryCount: z.number().int().nonnegative(),
    intermediaryDates: z.array(legacyDateInput),
    entryCents: legacyMoneyCentsOutput,
    signals: z.array(signalSchema),
    signalTotalCents: legacyMoneyCentsOutput,
    intermediaryTotalCents: legacyMoneyCentsOutput,
    intermediaryUnitCents: legacyMoneyCentsOutput,
    balanceCents: legacyMoneyCentsOutput,
    installmentValueCents: legacyMoneyCentsOutput,
    lastInstallmentValueCents: legacyMoneyCentsOutput,
    firstInstallmentDate: z.string(),
    monthlyDates: z.array(legacyDateInput),
    available: z.boolean(),
  })
  .strict();

export const wf15InputSchema = z
  .object({
    selectedUnitId: legacyBoundedText,
    inventoryMatch: z.boolean(),
    propertyValue: legacyMoneyInput,
    discountAuthorized: z.boolean(),
    discount: legacyOptionalMoneyInput,
    income: legacyOptionalMoneyInput,
    baseDate: legacyDateInput,
    completionDate: legacyDateInput,
  })
  .strict();

export type Wf15Input = z.infer<typeof wf15InputSchema>;

export const wf15ResultSchema = z
  .object({
    ok: z.boolean(),
    errors: z.array(z.string()),
    formulaVersion: z.string(),
    provenance: z.literal("legacy-reference-2026-08-28"),
    sourceInventoryRequired: z.literal(true),
    valueRealCents: legacyMoneyCentsOutput,
    incomeCents: legacyMoneyCentsOutput,
    scenarios: z.array(scenarioSchema),
    audit: z.array(z.object({ label: z.string(), ok: z.boolean() }).strict()),
  })
  .strict();

export type Wf15Result = z.infer<typeof wf15ResultSchema>;

export const WF15_FORMULA = Object.freeze({
  engineKey: "simulator.wf15" as const,
  workflow: "WF-15",
  scope: "Tabela Investidor",
  version: "wf15-legacy-reference-2026-08-28.1",
  provenance: "legacy-reference-2026-08-28" as const,
  sourceRoute: "https://descomplicapro.com.br/simulacao/tabela-investidor",
  sourceAsset: "https://descomplicapro.com.br/assets/InvestorCalculator-Crkupg5w.js",
  sourceSha256: "4540fa0a11abf5a150466349c07907af3f0110ecee247e594e6c741dd36bf877",
  observedAt: "2026-08-28T00:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  rounding: "half-up-to-cent-with-last-installment-reconciliation",
});

type ScenarioPolicy = {
  code: z.infer<typeof scenarioSchema>["code"];
  entryRateBps: number;
  targetEntryRateBps: number;
  installmentLimit: number;
  signalLimit: number;
  intermediaryLimit: number;
};

const SCENARIOS: readonly ScenarioPolicy[] = [
  {
    code: "C1",
    entryRateBps: 1_000,
    targetEntryRateBps: 1_000,
    installmentLimit: 18,
    signalLimit: 0,
    intermediaryLimit: 0,
  },
  {
    code: "C2",
    entryRateBps: 600,
    targetEntryRateBps: 1_000,
    installmentLimit: 18,
    signalLimit: 3,
    intermediaryLimit: 0,
  },
  {
    code: "C3",
    entryRateBps: 600,
    targetEntryRateBps: 1_000,
    installmentLimit: 18,
    signalLimit: 3,
    intermediaryLimit: 3,
  },
  {
    code: "C4",
    entryRateBps: 1_000,
    targetEntryRateBps: 1_000,
    installmentLimit: 18,
    signalLimit: 0,
    intermediaryLimit: 3,
  },
  {
    code: "C5",
    entryRateBps: 2_000,
    targetEntryRateBps: 2_000,
    installmentLimit: 24,
    signalLimit: 0,
    intermediaryLimit: 0,
  },
  {
    code: "C6",
    entryRateBps: 1_700,
    targetEntryRateBps: 2_000,
    installmentLimit: 24,
    signalLimit: 3,
    intermediaryLimit: 0,
  },
  {
    code: "C7",
    entryRateBps: 1_700,
    targetEntryRateBps: 2_000,
    installmentLimit: 24,
    signalLimit: 3,
    intermediaryLimit: 4,
  },
  {
    code: "C8",
    entryRateBps: 2_000,
    targetEntryRateBps: 2_000,
    installmentLimit: 24,
    signalLimit: 0,
    intermediaryLimit: 4,
  },
] as const;

function normalizedDueDate(value: Date): Date {
  const result = new Date(value);
  const day = result.getUTCDate();
  if (day >= 15) result.setUTCDate(15);
  else if (day >= 10) result.setUTCDate(10);
  else if (day >= 5) result.setUTCDate(5);
  else {
    result.setUTCDate(15);
    result.setUTCMonth(result.getUTCMonth() - 1);
  }
  return result;
}

function distributeSignalCents(
  valueReal: bigint,
  entryRateBps: number,
  targetEntryRateBps: number,
  count: number,
): bigint[] {
  if (count === 0 || targetEntryRateBps <= entryRateBps) return [];
  const total = multiplyLegacyRatio(valueReal, BigInt(targetEntryRateBps - entryRateBps), 10_000n);
  const base = total / BigInt(count);
  const remainder = total % BigInt(count);
  return Array.from({ length: count }, (_, index) => base + (BigInt(index) < remainder ? 1n : 0n));
}

function createScenario(
  policy: ScenarioPolicy,
  valueReal: bigint,
  baseDate: Date,
  completionDate: Date,
): z.infer<typeof scenarioSchema> {
  const firstInstallmentBase = normalizedDueDate(addLegacyDays(baseDate, 30));
  const signalValues = distributeSignalCents(
    valueReal,
    policy.entryRateBps,
    policy.targetEntryRateBps,
    policy.signalLimit,
  );
  const signals = signalValues.map((value, index) => ({
    index: index + 1,
    valueCents: serializeLegacyMoneyCents(value),
    date: serializeLegacyDate(addLegacyMonths(firstInstallmentBase, index)),
  }));
  const monthlyDates = Array.from({ length: policy.installmentLimit }, (_, index) =>
    addLegacyMonths(firstInstallmentBase, policy.signalLimit + index),
  )
    .filter((date) => date <= completionDate)
    .map(serializeLegacyDate);
  const monthlySet = new Set(monthlyDates);
  const deadline = addLegacyMonths(completionDate, -3);
  const intermediaryDates = Array.from({ length: policy.intermediaryLimit }, (_, index) =>
    addLegacyMonths(firstInstallmentBase, (index + 1) * 6 - 1),
  )
    .filter((date) => date <= deadline && monthlySet.has(serializeLegacyDate(date)))
    .map(serializeLegacyDate);
  const entry = multiplyLegacyRatio(valueReal, BigInt(policy.entryRateBps), 10_000n);
  const signalTotal = signalValues.reduce((total, value) => total + value, 0n);
  const intermediaryUnit = multiplyLegacyRatio(valueReal, 5n, 100n);
  const intermediaryTotal = intermediaryUnit * BigInt(intermediaryDates.length);
  const balance =
    valueReal > entry + signalTotal + intermediaryTotal
      ? valueReal - entry - signalTotal - intermediaryTotal
      : 0n;
  const installmentValue = monthlyDates.length
    ? roundLegacyFraction(balance, BigInt(monthlyDates.length))
    : 0n;
  const lastInstallmentValue = monthlyDates.length
    ? balance - installmentValue * BigInt(monthlyDates.length - 1)
    : 0n;

  return {
    ...policy,
    installments: monthlyDates.length,
    intermediaryCount: intermediaryDates.length,
    intermediaryDates,
    entryCents: serializeLegacyMoneyCents(entry),
    signals,
    signalTotalCents: serializeLegacyMoneyCents(signalTotal),
    intermediaryTotalCents: serializeLegacyMoneyCents(intermediaryTotal),
    intermediaryUnitCents: serializeLegacyMoneyCents(intermediaryUnit),
    balanceCents: serializeLegacyMoneyCents(balance),
    installmentValueCents: serializeLegacyMoneyCents(installmentValue),
    lastInstallmentValueCents: serializeLegacyMoneyCents(lastInstallmentValue),
    firstInstallmentDate: monthlyDates[0] ?? "",
    monthlyDates,
    available: valueReal > 0n && monthlyDates.length === policy.installmentLimit,
  };
}

export function calculateWf15(input: Wf15Input): Wf15Result {
  const propertyValue = parseLegacyMoneyCents(input.propertyValue);
  const discount =
    input.discountAuthorized && input.discount ? parseLegacyMoneyCents(input.discount) : 0n;
  const income = input.income ? parseLegacyMoneyCents(input.income) : 0n;
  const valueReal = propertyValue > discount ? propertyValue - discount : 0n;
  const baseDate = parseLegacyDate(input.baseDate)!;
  const completionDate = parseLegacyDate(input.completionDate)!;
  const errors: string[] = [];
  if (!input.inventoryMatch) errors.push("A unidade não foi conciliada com o estoque oficial.");
  if (propertyValue === 0n) errors.push("O valor do imóvel deve ser maior que zero.");
  if (discount >= propertyValue && propertyValue > 0n) {
    errors.push("O desconto precisa ser menor que o valor do imóvel.");
  }
  if (completionDate <= baseDate) errors.push("A data da obra precisa ser futura.");

  const scenarios = errors.length
    ? []
    : SCENARIOS.map((policy) => createScenario(policy, valueReal, baseDate, completionDate));
  const result: Wf15Result = {
    ok: errors.length === 0,
    errors,
    formulaVersion: WF15_FORMULA.version,
    provenance: WF15_FORMULA.provenance,
    sourceInventoryRequired: true,
    valueRealCents: serializeLegacyMoneyCents(valueReal),
    incomeCents: serializeLegacyMoneyCents(income),
    scenarios,
    audit: [
      {
        label: "Unidade conciliada selecionada",
        ok: input.selectedUnitId.length > 0 && input.inventoryMatch,
      },
      { label: "Valor real da venda", ok: valueReal > 0n },
      { label: "Data da obra futura", ok: completionDate > baseDate },
      { label: "Cenários calculados no servidor", ok: scenarios.length === 8 },
    ],
  };
  return wf15ResultSchema.parse(result);
}
