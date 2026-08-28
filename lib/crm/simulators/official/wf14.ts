import "server-only";

import { z } from "zod";

import {
  addLegacyDays,
  addLegacyMonths,
  legacyBoundedText,
  legacyDateInput,
  legacyMoneyCentsOutput,
  legacyMoneyCentsToNumber,
  legacyMoneyInput,
  legacyNumberToMoneyCents,
  legacyOptionalText,
  multiplyLegacyRatio,
  parseLegacyDate,
  parseLegacyMoneyCents,
  roundLegacyFraction,
  serializeLegacyDate,
  serializeLegacyMoneyCents,
} from "./legacy-reference-shared";

const paymentSchema = z
  .object({
    label: z.string(),
    rateBps: z.number().int().nonnegative(),
    valueCents: legacyMoneyCentsOutput,
    date: legacyDateInput,
  })
  .strict();

const scenarioSchema = z
  .object({
    key: z.enum(["scenario-one", "scenario-two"]),
    label: z.string(),
    payments: z.array(paymentSchema),
    firstPreKeysDate: legacyDateInput,
    preKeysInstallments: z.number().int().positive(),
    preKeysBalanceCents: legacyMoneyCentsOutput,
    preKeysPaymentCents: legacyMoneyCentsOutput,
    postKeysBalanceCents: legacyMoneyCentsOutput,
    postKeysInstallments: z.number().int().positive(),
    firstPostKeysDate: legacyDateInput,
    postKeysPaymentCents: legacyMoneyCentsOutput,
    commitmentBps: z.number().int().nonnegative(),
    approved: z.boolean(),
  })
  .strict();

export const wf14InputSchema = z
  .object({
    developmentName: legacyBoundedText,
    businessUnit: z.enum(["direcional", "riva"]),
    product: legacyBoundedText,
    plant: legacyBoundedText,
    description: legacyOptionalText,
    propertyValue: legacyMoneyInput,
    discount: legacyMoneyInput,
    income: legacyMoneyInput,
    baseDate: legacyDateInput,
    workEndDate: legacyDateInput,
  })
  .strict();

export type Wf14Input = z.infer<typeof wf14InputSchema>;

export const wf14ResultSchema = z
  .object({
    ok: z.boolean(),
    errors: z.array(z.string()),
    formulaVersion: z.string(),
    provenance: z.literal("legacy-reference-2026-08-28"),
    parking: z.boolean(),
    valueRealCents: legacyMoneyCentsOutput,
    incomeCents: legacyMoneyCentsOutput,
    preKeysRateBps: z.number().int().nonnegative(),
    postKeysRateBps: z.number().int().nonnegative(),
    postKeysInstallments: z.number().int().nonnegative(),
    scenarios: z.array(scenarioSchema),
    audit: z.array(z.object({ label: z.string(), ok: z.boolean() }).strict()),
  })
  .strict();

export type Wf14Result = z.infer<typeof wf14ResultSchema>;

export const WF14_FORMULA = Object.freeze({
  engineKey: "simulator.wf14" as const,
  workflow: "WF-14",
  scope: "Tabela Direta",
  version: "wf14-legacy-reference-2026-08-28.1",
  provenance: "legacy-reference-2026-08-28" as const,
  sourceRoute: "https://descomplicapro.com.br/simulacao/tabela-direta",
  sourceAsset: "https://descomplicapro.com.br/assets/direct-table-rules-cwr_4H8Y.js",
  sourceSha256: "307ed9ec45f9bcb46e03cfc5a7fc21f3e995a804eba3dcc50c464e2ad0d3ede2",
  observedAt: "2026-08-28T00:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  rounding: "half-up-to-cent",
});

function isParking(plant: string): boolean {
  return plant
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .includes("vaga");
}

function nextCascadeDate(value: Date): Date {
  const end = addLegacyDays(value, 31);
  let latest: Date | null = null;
  const monthStart = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 12));
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    const month = addLegacyMonths(monthStart, monthOffset);
    for (const day of [5, 10, 15]) {
      const candidate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 12));
      if (candidate > value && candidate <= end && (!latest || candidate > latest)) {
        latest = candidate;
      }
    }
  }
  if (!latest) throw new Error("cascade_date_unavailable");
  return latest;
}

function inclusiveMonths(start: Date, end: Date): number {
  if (end < start) return 0;
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    1
  );
}

function postKeysPayment(balanceCents: bigint, installments: number): bigint {
  if (balanceCents === 0n) return 0n;
  const balance = legacyMoneyCentsToNumber(balanceCents);
  const monthlyRate = 1.12 ** (1 / 12) - 1;
  const compound = (1 + monthlyRate) ** installments;
  const price = balance * ((monthlyRate * compound) / (compound - 1));
  const insurance = balance * (0.00021 + 0.00007);
  return legacyNumberToMoneyCents(price + insurance);
}

function createScenario(
  key: "scenario-one" | "scenario-two",
  valueReal: bigint,
  income: bigint,
  baseDate: Date,
  workEndDate: Date,
  preKeysRateBps: number,
  postKeysRateBps: number,
  postKeysInstallments: number,
): z.infer<typeof scenarioSchema> | null {
  const payments: Array<{
    label: string;
    rateBps: number;
    valueCents: string;
    date: string;
  }> = [];
  let paymentDate = baseDate;
  if (key === "scenario-one") {
    payments.push({
      label: "Ato",
      rateBps: 1_000,
      valueCents: serializeLegacyMoneyCents(multiplyLegacyRatio(valueReal, 1n, 10n)),
      date: serializeLegacyDate(baseDate),
    });
  } else {
    const act = multiplyLegacyRatio(valueReal, 6n, 100n);
    const target = multiplyLegacyRatio(valueReal, 1n, 10n);
    const signalTwo = multiplyLegacyRatio(valueReal, 133n, 10_000n);
    const signalThree = multiplyLegacyRatio(valueReal, 133n, 10_000n);
    const rawSignalOne = multiplyLegacyRatio(valueReal, 134n, 10_000n);
    const signalOne = rawSignalOne + target - (act + rawSignalOne + signalTwo + signalThree);
    payments.push({
      label: "Ato",
      rateBps: 600,
      valueCents: serializeLegacyMoneyCents(act),
      date: serializeLegacyDate(baseDate),
    });
    for (const [index, value, rateBps] of [
      [1, signalOne, 134],
      [2, signalTwo, 133],
      [3, signalThree, 133],
    ] as const) {
      paymentDate = nextCascadeDate(paymentDate);
      payments.push({
        label: `Sinal ${index}`,
        rateBps,
        valueCents: serializeLegacyMoneyCents(value),
        date: serializeLegacyDate(paymentDate),
      });
    }
  }

  const firstPreKeys = nextCascadeDate(paymentDate);
  const preKeysInstallments = inclusiveMonths(firstPreKeys, workEndDate);
  if (preKeysInstallments <= 0) return null;
  const lastPreKeysMonth = addLegacyMonths(firstPreKeys, preKeysInstallments - 1);
  const firstPostKeys = nextCascadeDate(lastPreKeysMonth);
  const preKeysBalance = multiplyLegacyRatio(valueReal, BigInt(preKeysRateBps), 10_000n);
  const postKeysBalance = multiplyLegacyRatio(valueReal, BigInt(postKeysRateBps), 10_000n);
  const postPayment = postKeysPayment(postKeysBalance, postKeysInstallments);
  const commitmentBps =
    income > 0n ? Number(roundLegacyFraction(postPayment * 10_000n, income)) : 0;
  const approved = income > 0n && postPayment * 10_000n <= income * 4_000n;

  return {
    key,
    label: key === "scenario-one" ? "Cenário 1" : "Cenário 2",
    payments,
    firstPreKeysDate: serializeLegacyDate(firstPreKeys),
    preKeysInstallments,
    preKeysBalanceCents: serializeLegacyMoneyCents(preKeysBalance),
    preKeysPaymentCents: serializeLegacyMoneyCents(
      roundLegacyFraction(preKeysBalance, BigInt(preKeysInstallments)),
    ),
    postKeysBalanceCents: serializeLegacyMoneyCents(postKeysBalance),
    postKeysInstallments,
    firstPostKeysDate: serializeLegacyDate(firstPostKeys),
    postKeysPaymentCents: serializeLegacyMoneyCents(postPayment),
    commitmentBps,
    approved,
  };
}

export function calculateWf14(input: Wf14Input): Wf14Result {
  const propertyValue = parseLegacyMoneyCents(input.propertyValue);
  const discount = parseLegacyMoneyCents(input.discount);
  const income = parseLegacyMoneyCents(input.income);
  const baseDate = parseLegacyDate(input.baseDate)!;
  const workEndDate = parseLegacyDate(input.workEndDate)!;
  const parking = isParking(input.plant);
  const preKeysRateBps = parking ? 4_000 : 3_000;
  const postKeysRateBps = parking ? 5_000 : 6_000;
  const postKeysInstallments = parking ? 66 : 120;
  const errors: string[] = [];
  if (propertyValue === 0n) errors.push("O valor do imóvel deve ser maior que zero.");
  if (discount >= propertyValue && propertyValue > 0n) {
    errors.push("O desconto precisa ser menor que o valor do imóvel.");
  }
  if (income === 0n) errors.push("Informe a renda mensal para validar o crédito.");
  if (workEndDate <= baseDate) {
    errors.push("O término da obra precisa ocorrer depois da data da simulação.");
  }
  const valueReal = propertyValue > discount ? propertyValue - discount : 0n;
  const scenarios = errors.length
    ? []
    : (["scenario-one", "scenario-two"] as const)
        .map((key) =>
          createScenario(
            key,
            valueReal,
            income,
            baseDate,
            workEndDate,
            preKeysRateBps,
            postKeysRateBps,
            postKeysInstallments,
          ),
        )
        .filter((scenario): scenario is z.infer<typeof scenarioSchema> => scenario !== null);
  if (errors.length === 0 && scenarios.length !== 2) {
    errors.push("O término da obra precisa ocorrer depois do início das mensais pré-chaves.");
  }

  const result: Wf14Result = {
    ok: errors.length === 0,
    errors,
    formulaVersion: WF14_FORMULA.version,
    provenance: WF14_FORMULA.provenance,
    parking,
    valueRealCents: serializeLegacyMoneyCents(valueReal),
    incomeCents: serializeLegacyMoneyCents(income),
    preKeysRateBps,
    postKeysRateBps,
    postKeysInstallments,
    scenarios: errors.length ? [] : scenarios,
    audit: [
      { label: "Empreendimento e produto", ok: true },
      { label: "Valor real da venda", ok: valueReal > 0n },
      { label: "Renda informada", ok: income > 0n },
      {
        label: `Distribuição 10% + ${preKeysRateBps / 100}% + ${postKeysRateBps / 100}%`,
        ok: true,
      },
      { label: `Prazo pós-chaves de ${postKeysInstallments} parcelas`, ok: true },
    ],
  };
  return wf14ResultSchema.parse(result);
}
