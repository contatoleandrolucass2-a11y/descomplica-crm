import { getAssociativeAnnualEligibility } from "../../archive-investor/associative-annual-rules.mjs";
import { caixaAutomaticAnnuals } from "./caixa-available-units";

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
