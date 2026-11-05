import { getAssociativeAnnualEligibility } from "../../archive-investor/associative-annual-rules.mjs";
import {
  assessCaixaAvailableUnit,
  caixaAutomaticAnnuals,
  type CaixaAvailableUnit,
} from "./caixa-available-units";
import type { HousingInput } from "./caixa";

/** A commercial discount changes the bank's purchase basis and must be assessed again. */
export function reassessCaixaProposalDiscount({
  selected,
  input,
  capacity,
  ranking,
  baseDate,
  firstProperty,
  discount,
  authorized,
}: {
  selected: CaixaAvailableUnit;
  input: HousingInput;
  capacity: number;
  ranking: string;
  baseDate: string;
  firstProperty: boolean;
  discount: number;
  authorized: boolean;
}):
  | { status: "ready"; value: CaixaAvailableUnit; discount: number }
  | { status: "blocked"; reason: string } {
  if (!Number.isFinite(discount) || discount < 0)
    return { status: "blocked", reason: "Informe um desconto válido." };
  if (discount === 0) return { status: "ready", value: selected, discount: 0 };
  if (!authorized)
    return {
      status: "blocked",
      reason: "O desconto informado depende de autorização. Revise a proposta antes de continuar.",
    };
  const priceCents = Math.round(selected.price * 100) - Math.round(discount * 100);
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0)
    return { status: "blocked", reason: "O desconto deve ser menor que o valor da venda." };
  if (!Number.isFinite(capacity) || capacity <= 0)
    return {
      status: "blocked",
      reason: "Capacidade de financiamento indisponível para reavaliar o desconto.",
    };
  const discountedUnit = {
    ...selected.unit,
    finalPrice: priceCents / 100,
    unitBonus: 0,
    tableSlack: 0,
  };
  delete discountedUnit.finalWithKit;
  const reassessed = assessCaixaAvailableUnit(
    discountedUnit,
    input,
    { maximumFinancingByIncome: capacity },
    ranking,
    baseDate,
    firstProperty,
  );
  return reassessed.status === "approved"
    ? { status: "ready", value: reassessed.value, discount: Math.round(discount * 100) / 100 }
    : { status: "blocked", reason: `Desconto sem validação CAIXA: ${reassessed.reason}` };
}

/** Keep the canonical five calendar slots, including zero/ineligible dates. */
export function buildCaixaProposalAnnuals({
  income,
  baseDate,
  completionDate,
  balanceAfterResources,
  entry,
  signals,
  overrides = {},
}: {
  income: number;
  baseDate: string;
  completionDate: string;
  balanceAfterResources: number;
  entry: number;
  signals: readonly { date: string; value: number; approved: boolean }[];
  overrides?: Readonly<Record<string, number>>;
}) {
  const validSignals = signals.filter((signal) => signal.approved && signal.value > 0);
  const remaining =
    balanceAfterResources - entry - validSignals.reduce((sum, signal) => sum + signal.value, 0);
  const automatic = caixaAutomaticAnnuals(income, baseDate, completionDate, remaining);
  return getAssociativeAnnualEligibility({
    baseDate,
    entryDate: baseDate,
    completionDate,
    signalDates: validSignals.map((signal) => signal.date),
  }).map((slot) => ({
    ...slot,
    amount: slot.eligible
      ? (overrides[slot.date] ?? automatic.find((annual) => annual.date === slot.date)?.amount ?? 0)
      : 0,
  }));
}
