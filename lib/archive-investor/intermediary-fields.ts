type DatedPayment = { date: string };

export function eligibleIntermediaryIndexes({
  annualMode,
  payments,
  baseDate,
  completionDate,
  inputLimit,
}: {
  annualMode: boolean;
  payments: readonly DatedPayment[];
  baseDate: string;
  completionDate: string;
  inputLimit: number;
}): number[] {
  return payments.flatMap((payment, index) => {
    if (!annualMode) return index < inputLimit ? [index] : [];
    return payment.date &&
      baseDate &&
      completionDate &&
      payment.date >= baseDate &&
      payment.date <= completionDate
      ? [index]
      : [];
  });
}
