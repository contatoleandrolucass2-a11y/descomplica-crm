export type GoalCalendarWeek = {
  start: number;
  end: number;
  workdays: number;
  cumulativeWorkdays: number;
  isCurrent: boolean;
};

function finiteNonnegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Preview only: keep precision between stages and round displayed volumes. */
export function projectGoalVolumes(
  sales: number | null,
  rates: Array<number | null>,
): Array<number | null> {
  const volumes: Array<number | null> = Array(6).fill(null);
  let value = finiteNonnegative(sales) ? sales : null;
  volumes[5] = value === null ? null : Math.round(value);

  for (let index = 4; index >= 0; index -= 1) {
    const rate = rates[index];
    const projected: number | null =
      value !== null && finiteNonnegative(rate) ? value * (rate / 100) : null;
    value = finiteNonnegative(projected) ? projected : null;
    volumes[index] = value === null ? null : Math.round(value);
  }

  return volumes;
}

function calendarDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

/** Calendar days are UTC date-only values; elapsed workdays include today. */
export function buildGoalCalendar(year: number, monthIndex: number, todayISO: string) {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    throw new RangeError("Invalid goal calendar month");
  }
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayISO);
  if (!todayMatch) throw new RangeError("Invalid goal calendar date");
  const todayYear = Number(todayMatch[1]);
  const todayMonth = Number(todayMatch[2]) - 1;
  const todayDay = Number(todayMatch[3]);
  const today = calendarDate(todayYear, todayMonth, todayDay);
  if (
    todayYear < 1 ||
    today.getUTCFullYear() !== todayYear ||
    today.getUTCMonth() !== todayMonth ||
    today.getUTCDate() !== todayDay
  ) {
    throw new RangeError("Invalid goal calendar date");
  }

  const leadingDays = calendarDate(year, monthIndex, 1).getUTCDay();
  const lastDay = calendarDate(year, monthIndex + 1, 0).getUTCDate();
  const days = Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const weekday = calendarDate(year, monthIndex, day).getUTCDay();
    return { day, workday: weekday > 0 && weekday < 6 };
  });
  const workdays = days.filter((day) => day.workday).length;
  const elapsedWorkdays = days.filter(
    (day) => day.workday && calendarDate(year, monthIndex, day.day) <= today,
  ).length;
  const weeks: GoalCalendarWeek[] = [];
  let cumulativeWorkdays = 0;
  for (let start = 1; start <= lastDay; ) {
    const end = Math.min(lastDay, start === 1 ? 7 - leadingDays : start + 6);
    const weekWorkdays = days.slice(start - 1, end).filter((day) => day.workday).length;
    cumulativeWorkdays += weekWorkdays;
    weeks.push({
      start,
      end,
      workdays: weekWorkdays,
      cumulativeWorkdays,
      isCurrent:
        todayYear === year && todayMonth === monthIndex && todayDay >= start && todayDay <= end,
    });
    start = end + 1;
  }
  return { days, leadingDays, workdays, elapsedWorkdays, weeks };
}

/**
 * Allocate integer targets by largest remainder, breaking ties by week order.
 * This is a UI preview and does not persist a commercial rule.
 */
export function distributeWeeklyGoal(
  total: number | null,
  weeks: Array<{ workdays: number; cumulativeWorkdays: number }>,
  workdays: number,
): Array<{ cumulative: number | null; increment: number | null }> {
  if (
    !finiteNonnegative(total) ||
    !Number.isInteger(workdays) ||
    workdays <= 0 ||
    weeks.some(
      (week, index) =>
        !Number.isInteger(week.workdays) ||
        week.workdays < 0 ||
        !Number.isInteger(week.cumulativeWorkdays) ||
        week.cumulativeWorkdays !==
          (index === 0 ? 0 : (weeks[index - 1]?.cumulativeWorkdays ?? NaN)) + week.workdays,
    ) ||
    (weeks.length > 0 && weeks.at(-1)?.cumulativeWorkdays !== workdays)
  ) {
    return weeks.map(() => ({ cumulative: null, increment: null }));
  }
  const monthlyTotal = Math.round(total);
  if (weeks.length === 0) return [];
  if (!Number.isSafeInteger(monthlyTotal)) {
    return weeks.map(() => ({ cumulative: null, increment: null }));
  }
  const allocations = weeks.map((week, index) => {
    const exact = monthlyTotal * (week.workdays / workdays);
    const increment = Math.floor(exact);
    return { index, increment, remainder: exact - increment };
  });
  const remaining = monthlyTotal - allocations.reduce((sum, week) => sum + week.increment, 0);
  const ranked = [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  if (remaining < 0 || remaining > ranked.length) {
    return weeks.map(() => ({ cumulative: null, increment: null }));
  }
  for (const allocation of ranked.slice(0, remaining)) {
    allocation.increment += 1;
  }
  let cumulative = 0;
  return allocations.map(({ increment }) => {
    cumulative += increment;
    return { cumulative, increment };
  });
}

/** Stage-major weekly preview; each stage preserves its monthly endpoint. */
export function distributeFunnelWeeks(
  volumes: Array<number | null>,
  weeks: Array<{ workdays: number; cumulativeWorkdays: number }>,
  workdays: number,
): Array<Array<{ cumulative: number | null; increment: number | null }>> {
  const result: Array<Array<{ cumulative: number | null; increment: number | null }>> = [];
  for (let stage = 0; stage < volumes.length; stage += 1) {
    const total = volumes[stage] ?? null;
    const previousTotal = stage > 0 ? volumes[stage - 1] : null;
    const previousWeeks = result[stage - 1];
    const allocated = distributeWeeklyGoal(total, weeks, workdays);
    if (
      !finiteNonnegative(total) ||
      !finiteNonnegative(previousTotal) ||
      previousTotal === 0 ||
      !previousWeeks?.every((week) => week.cumulative !== null) ||
      allocated.some((week) => week.cumulative === null)
    ) {
      result.push(allocated);
      continue;
    }
    const monthlyTotal = Math.round(total);
    const previousMonthlyTotal = Math.round(previousTotal);
    if (previousMonthlyTotal === 0) {
      result.push(allocated);
      continue;
    }
    let previous = 0;
    result.push(
      previousWeeks.map((week, index) => {
        const cumulative =
          index === weeks.length - 1
            ? monthlyTotal
            : Math.floor(week.cumulative! * (monthlyTotal / previousMonthlyTotal));
        const increment = cumulative - previous;
        previous = cumulative;
        return { cumulative, increment };
      }),
    );
  }
  return result;
}
