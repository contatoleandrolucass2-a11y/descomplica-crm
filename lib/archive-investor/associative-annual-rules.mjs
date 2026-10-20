function decimalParts(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).trim();
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (parsed === 0) return { coefficient: 0n, scale: 0 };
  const match = /^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/iu.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? "";
  return {
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length - Number(match[3] ?? 0),
  };
}

function floorDecimalMoney(value, divisor) {
  const parts = decimalParts(value);
  if (!parts) return 0;
  // Divide decimal integers before converting back to Number: no epsilon or binary product.
  const power = 2 - parts.scale;
  const cents =
    power >= 0
      ? (parts.coefficient * 10n ** BigInt(power)) / divisor
      : parts.coefficient / (divisor * 10n ** BigInt(-power));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) / 100 : 0;
}

export function floorMoney(value) {
  return floorDecimalMoney(value, 1n);
}

export function getAssociativeAnnualLimit(income) {
  return floorDecimalMoney(income, 2n);
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getAssociativeAnnualEligibility({
  baseDate,
  completionDate,
  entryDate = baseDate,
  signalDates = [],
}) {
  const baseValid = validIsoDate(baseDate);
  const entryValid = validIsoDate(entryDate);
  const completionValid = validIsoDate(completionDate);
  const activeSignalDates = signalDates.filter(Boolean);
  const signalsValid = activeSignalDates.every(validIsoDate);
  const initialMonths = [entryDate, ...activeSignalDates].map((date) => String(date).slice(0, 7));
  const lastInitialMonth = [...initialMonths].sort().at(-1) ?? "";

  return Array.from({ length: 5 }, (_, index) => {
    const year = baseValid ? Number(baseDate.slice(0, 4)) + index : 0;
    const date = baseValid && year <= 9999 ? `${String(year).padStart(4, "0")}-12-15` : "";
    const month = date.slice(0, 7);
    let reason = "";
    if (!date || !entryValid || !completionValid || !signalsValid)
      reason = "Informe datas válidas para entrada, sinais e término da obra.";
    else if (date < baseDate) reason = "A data da anual já passou.";
    else if (date > completionDate) reason = "A anual ultrapassa o término da obra.";
    else if (initialMonths.includes(month))
      reason = "A anual não pode coincidir com o mês/ano da entrada ou de um sinal.";
    else if (month <= lastInitialMonth)
      reason = "A anual deve ser posterior ao mês/ano da entrada e do último sinal.";
    return { index: index + 1, date, eligible: reason === "", reason };
  });
}
