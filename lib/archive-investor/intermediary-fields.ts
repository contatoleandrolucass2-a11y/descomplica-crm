import { getAssociativeAnnualEligibility } from "./associative-annual-rules.mjs";

type DatedPayment = { date: string; eligible?: boolean };

export function eligibleIntermediaryIndexes({
  annualMode,
  payments,
  baseDate,
  completionDate,
  inputLimit,
  entryDate,
  signalDates,
}: {
  annualMode: boolean;
  payments: readonly DatedPayment[];
  baseDate: string;
  completionDate: string;
  inputLimit: number;
  entryDate?: string;
  signalDates?: readonly string[];
}): number[] {
  const annualEligibility =
    annualMode && (entryDate !== undefined || signalDates !== undefined)
      ? getAssociativeAnnualEligibility({ baseDate, completionDate, entryDate, signalDates })
      : null;
  return payments.flatMap((payment, index) => {
    if (!annualMode) return index < inputLimit ? [index] : [];
    if (
      payment.eligible === false ||
      (annualEligibility &&
        (!annualEligibility[index]?.eligible || annualEligibility[index].date !== payment.date))
    )
      return [];
    return payment.date &&
      baseDate &&
      completionDate &&
      payment.date >= baseDate &&
      payment.date <= completionDate
      ? [index]
      : [];
  });
}
