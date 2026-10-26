import type { DashboardPeriod } from "../types";

const DAY_IN_MILLISECONDS = 86_400_000;
const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface CivilDateRange {
  start: string;
  end: string;
}

export interface ResolvePeriodOptions {
  today: string;
  globalRange?: CivilDateRange;
  customRange?: CivilDateRange;
}

function dateFromParts({ year, month, day }: CivilDate) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function parseCivilDate(value: string): CivilDate {
  const match = CIVIL_DATE.exec(value);
  if (!match) throw new RangeError(`Invalid civil date: ${JSON.stringify(value)}.`);
  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const date = dateFromParts(parsed);
  if (
    parsed.year < 1 ||
    date.getUTCFullYear() !== parsed.year ||
    date.getUTCMonth() + 1 !== parsed.month ||
    date.getUTCDate() !== parsed.day
  ) {
    throw new RangeError(`Invalid civil date: ${JSON.stringify(value)}.`);
  }
  return parsed;
}

export function formatCivilDate(date: CivilDate) {
  parseCivilDate(
    `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
  );
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function epochDay(value: string) {
  return Math.floor(dateFromParts(parseCivilDate(value)).getTime() / DAY_IN_MILLISECONDS);
}

export function inclusiveDayCount(start: string, end: string) {
  const difference = epochDay(end) - epochDay(start);
  if (difference < 0) throw new RangeError("Civil date range cannot end before it starts.");
  return difference + 1;
}

export function addCivilDays(value: string, days: number) {
  if (!Number.isSafeInteger(days)) throw new RangeError("Day offset must be a safe integer.");
  const date = dateFromParts(parseCivilDate(value));
  date.setUTCDate(date.getUTCDate() + days);
  return formatCivilDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function assertRange(range: CivilDateRange) {
  inclusiveDayCount(range.start, range.end);
  return range;
}

export function resolveDashboardPeriod(
  period: DashboardPeriod,
  { today, globalRange, customRange }: ResolvePeriodOptions,
): CivilDateRange {
  const parsedToday = parseCivilDate(today);
  if (period === "today") return { start: today, end: today };
  if (period === "global") {
    if (!globalRange) throw new RangeError("Global period requires globalRange.");
    return assertRange(globalRange);
  }
  if (period === "custom") {
    if (!customRange) throw new RangeError("Custom period requires customRange.");
    return assertRange(customRange);
  }
  if (period === "month") {
    return {
      start: formatCivilDate({ ...parsedToday, day: 1 }),
      end: today,
    };
  }

  const dayOfWeek = dateFromParts(parsedToday).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return { start: addCivilDays(today, -daysSinceMonday), end: today };
}

export function ceilingForPeriod(dailyCeiling: number, range: CivilDateRange) {
  if (!Number.isFinite(dailyCeiling) || dailyCeiling < 0) {
    throw new RangeError("Daily ceiling must be a finite nonnegative number.");
  }
  return dailyCeiling * inclusiveDayCount(range.start, range.end);
}
