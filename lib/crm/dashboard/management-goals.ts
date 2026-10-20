import { DASHBOARD_CHANNELS } from "./analysis-contract";
import type { DashboardStageKey } from "./catalog";

export type DashboardManagementGoalKey = DashboardStageKey | "approved-folders";
export type DashboardManagementGoalValues = Record<DashboardManagementGoalKey, number | null>;

export interface DashboardManagementGoals {
  referenceDate: string;
  brokerCount: number | null;
  daysInMonth: number;
  elapsedDays: number;
  monthlyGoals: DashboardManagementGoalValues;
  expectedByToday: DashboardManagementGoalValues;
}

/**
 * Calculates the user-confirmed monthly goals for an already authorized, filtered
 * broker cohort. The caller owns server authorization and cohort completeness.
 * referenceDate is an explicit Gregorian local date (YYYY-MM-DD, years 0001-9999),
 * never a timestamp or the machine's current date. Holidays are not supplied:
 * appointments count Monday-Friday once and Thursday twice, for the whole month.
 * House goals per broker: opportunities = 143, appointments = 24, visits = 12,
 * folders = 8, approved folders = 2 and sales = 1. Imob goals are intentionally
 * unavailable until that channel is configured.
 * A null brokerCount makes every goal unavailable; zero gives zero configured goals.
 * Expected values use elapsed calendar days including referenceDate, without rounding.
 * Throws RangeError for invalid dates, counts other than null/nonnegative safe
 * integers, or monthly totals exceeding the safe integer range.
 */
export function buildDashboardManagementGoals({
  referenceDate,
  brokerCount,
  channel,
}: {
  referenceDate: string;
  brokerCount: number | null;
  channel: (typeof DASHBOARD_CHANNELS)[number];
}): DashboardManagementGoals {
  const match =
    typeof referenceDate === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(referenceDate) : null;
  if (!match) throw new RangeError("referenceDate must be a valid YYYY-MM-DD date.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const daysInMonth = monthLengths[month - 1] ?? 0;
  if (year < 1 || daysInMonth === 0 || day < 1 || day > daysInMonth) {
    throw new RangeError("referenceDate must be a valid YYYY-MM-DD date.");
  }
  if (brokerCount !== null && (!Number.isSafeInteger(brokerCount) || brokerCount < 0)) {
    throw new RangeError("brokerCount must be null or a nonnegative safe integer.");
  }

  function total(perBroker: number): number | null {
    if (channel !== DASHBOARD_CHANNELS[1] || brokerCount === null) return null;
    const value = perBroker * brokerCount;
    if (!Number.isSafeInteger(value)) {
      throw new RangeError("Monthly goal exceeds the safe integer range.");
    }
    return value === 0 ? 0 : value;
  }

  const monthlyGoals: DashboardManagementGoalValues = {
    opportunities: total(143),
    appointments: total(24),
    visits: total(12),
    folders: total(8),
    "approved-folders": total(2),
    sales: total(1),
  };
  function expected(goal: number | null): number | null {
    if (goal === null || day === daysInMonth) return goal;
    return (goal * day) / daysInMonth;
  }

  return {
    referenceDate,
    brokerCount,
    daysInMonth,
    elapsedDays: day,
    monthlyGoals,
    expectedByToday: {
      opportunities: expected(monthlyGoals.opportunities),
      appointments: expected(monthlyGoals.appointments),
      visits: expected(monthlyGoals.visits),
      folders: expected(monthlyGoals.folders),
      "approved-folders": expected(monthlyGoals["approved-folders"]),
      sales: expected(monthlyGoals.sales),
    },
  };
}
