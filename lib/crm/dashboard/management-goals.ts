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
 * Per broker: visits = 8, folders = 4, sales = 1. No goals are configured for
 * opportunities or approved-folders, so both always remain null, even for zero brokers.
 * A null brokerCount makes every goal unavailable; zero gives zero configured goals.
 * Expected values use elapsed calendar days including referenceDate, without rounding.
 * Throws RangeError for invalid dates, counts other than null/nonnegative safe
 * integers, or monthly totals exceeding the safe integer range.
 */
export function buildDashboardManagementGoals({
  referenceDate,
  brokerCount,
}: {
  referenceDate: string;
  brokerCount: number | null;
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

  // Gregorian 0001-01-01 was Monday. Integer calendar arithmetic avoids timezones
  // and JavaScript Date's special treatment of years 00-99.
  const previousYear = year - 1;
  const daysBeforeYear =
    365 * previousYear +
    Math.floor(previousYear / 4) -
    Math.floor(previousYear / 100) +
    Math.floor(previousYear / 400);
  const daysBeforeMonth = monthLengths.slice(0, month - 1).reduce((sum, days) => sum + days, 0);
  const firstWeekday = (daysBeforeYear + daysBeforeMonth + 1) % 7;
  let appointmentsPerBroker = 0;
  for (let date = 1; date <= daysInMonth; date += 1) {
    const weekday = (firstWeekday + date - 1) % 7;
    if (weekday >= 1 && weekday <= 5) appointmentsPerBroker += weekday === 4 ? 2 : 1;
  }

  function total(perBroker: number): number | null {
    if (brokerCount === null) return null;
    const value = perBroker * brokerCount;
    if (!Number.isSafeInteger(value)) {
      throw new RangeError("Monthly goal exceeds the safe integer range.");
    }
    return value === 0 ? 0 : value;
  }

  const monthlyGoals: DashboardManagementGoalValues = {
    opportunities: null,
    appointments: total(appointmentsPerBroker),
    visits: total(8),
    folders: total(4),
    "approved-folders": null,
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
      opportunities: null,
      appointments: expected(monthlyGoals.appointments),
      visits: expected(monthlyGoals.visits),
      folders: expected(monthlyGoals.folders),
      "approved-folders": null,
      sales: expected(monthlyGoals.sales),
    },
  };
}
