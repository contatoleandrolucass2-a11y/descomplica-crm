export type ForecastCalendarDate = { year: number; month: number; day: number };

export type ForecastCalendarSummary = {
  year: number;
  month: number;
  validatedDays: number[];
  total: number;
  elapsed: number;
  remaining: number;
};

const VALIDATED_WEEKDAYS = new Set([0, 5, 6]);

function localCalendarDate(date: Date): ForecastCalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function dateKey(date: ForecastCalendarDate): number {
  return date.year * 10_000 + date.month * 100 + date.day;
}

/** Counts only Friday through Sunday. UTC generation keeps weekdays stable in every timezone. */
export function getForecastCalendar(
  year: number,
  month: number,
  today: Date | ForecastCalendarDate = new Date(),
): ForecastCalendarSummary {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
    throw new RangeError("Mês e ano inválidos.");

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const validatedDays = Array.from({ length: lastDay }, (_, index) => index + 1).filter((day) =>
    VALIDATED_WEEKDAYS.has(new Date(Date.UTC(year, month - 1, day)).getUTCDay()),
  );
  const current = today instanceof Date ? localCalendarDate(today) : today;
  const currentKey = dateKey(current);
  const elapsed = validatedDays.filter((day) => dateKey({ year, month, day }) <= currentKey).length;

  return {
    year,
    month,
    validatedDays,
    total: validatedDays.length,
    elapsed,
    remaining: validatedDays.length - elapsed,
  };
}
