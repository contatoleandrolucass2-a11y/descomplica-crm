import { describe, expect, it } from "vitest";

import { buildDashboardManagementGoals } from "@/lib/crm/dashboard/management-goals";

const calculate = (referenceDate: string, brokerCount: number | null = 1) =>
  buildDashboardManagementGoals({ referenceDate, brokerCount });

describe("buildDashboardManagementGoals", () => {
  it("sums monthly goals per filtered broker, leaving unspecified goals null", () => {
    // October 2026: 22 weekdays and 5 Thursdays, including holidays as weekdays.
    const result = calculate("2026-10-15", 3);
    expect(result).toMatchObject({
      referenceDate: "2026-10-15",
      brokerCount: 3,
      daysInMonth: 31,
      elapsedDays: 15,
      monthlyGoals: {
        opportunities: null,
        appointments: 81,
        visits: 24,
        folders: 12,
        "approved-folders": null,
        sales: 3,
      },
    });
    expect(result.expectedByToday.appointments).toBeCloseTo((81 * 15) / 31, 12);
    expect(result.expectedByToday.visits).toBeCloseTo((24 * 15) / 31, 12);
    expect(result.expectedByToday.folders).toBeCloseTo((12 * 15) / 31, 12);
    expect(result.expectedByToday.sales).toBeCloseTo((3 * 15) / 31, 12);
    expect(result.expectedByToday.opportunities).toBeNull();
    expect(result.expectedByToday["approved-folders"]).toBeNull();
  });

  it.each([
    ["2026-02-01", 28, 24], // 20 weekdays + 4 Thursdays; starts on Sunday.
    ["2024-02-01", 29, 26], // 21 weekdays + 5 Thursdays; leap day is Thursday.
    ["2000-02-01", 29, 25], // Century divisible by 400 is a leap year.
    ["1900-02-01", 28, 24], // Other centuries are not leap years.
    ["2100-02-01", 28, 24],
    ["2026-12-01", 31, 28],
    ["2027-01-01", 31, 25],
    ["0001-01-01", 31, 27], // No implicit conversion to 1901.
    ["0099-02-01", 28, 24],
    ["9999-12-01", 31, 28],
  ])("uses the full supplied month for %s", (date, days, appointments) => {
    const result = calculate(date);
    expect(result.daysInMonth).toBe(days);
    expect(result.monthlyGoals.appointments).toBe(appointments);
    expect(result.expectedByToday.sales).toBe(1 / days);
  });

  it("advances by calendar days on weekends and keeps the same monthly goal", () => {
    const friday = calculate("2026-10-02");
    const saturday = calculate("2026-10-03");
    const sunday = calculate("2026-10-04");
    expect(saturday.monthlyGoals).toEqual(friday.monthlyGoals);
    expect(sunday.monthlyGoals).toEqual(friday.monthlyGoals);
    expect(saturday.expectedByToday.sales).toBe(3 / 31);
    expect(sunday.expectedByToday.sales).toBe(4 / 31);
    expect(sunday.expectedByToday.appointments).toBeCloseTo((27 * 4) / 31, 12);
  });

  it("does not double the elapsed-day fraction on Thursdays", () => {
    const wednesday = calculate("2026-10-14");
    const thursday = calculate("2026-10-15");
    expect(wednesday.monthlyGoals.appointments).toBe(27);
    expect(thursday.monthlyGoals.appointments).toBe(27);
    expect(
      thursday.expectedByToday.appointments! - wednesday.expectedByToday.appointments!,
    ).toBeCloseTo(27 / 31, 12);
  });

  it.each(["2026-02-28", "2024-02-29", "2026-04-30", "2026-10-31", "2026-12-31"])(
    "equals the exact monthly goal on the last day %s",
    (date) => {
      const result = calculate(date, 7);
      expect(result.expectedByToday).toEqual(result.monthlyGoals);
    },
  );

  it("resets the calendar-day fraction across the year boundary", () => {
    const december = calculate("2026-12-31", 2);
    const january = calculate("2027-01-01", 2);
    expect(december.monthlyGoals.appointments).toBe(56);
    expect(december.expectedByToday.appointments).toBe(56);
    expect(january.monthlyGoals.appointments).toBe(50);
    expect(january.expectedByToday.appointments).toBeCloseTo(50 / 31, 12);
  });

  it("distinguishes unavailable cohort from an empty filtered cohort", () => {
    const unavailable = calculate("2026-10-15", null);
    expect(Object.values(unavailable.monthlyGoals)).toEqual(Array(6).fill(null));
    expect(Object.values(unavailable.expectedByToday)).toEqual(Array(6).fill(null));
    const empty = calculate("2026-10-15", 0);
    expect(empty.monthlyGoals).toEqual({
      opportunities: null,
      appointments: 0,
      visits: 0,
      folders: 0,
      "approved-folders": null,
      sales: 0,
    });
    expect(empty.expectedByToday).toEqual(empty.monthlyGoals);
  });

  it.each([
    "",
    "2026-2-01",
    "2026-02-1",
    "2026-02-29",
    "1900-02-29",
    "2100-02-29",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-01-32",
    "0000-01-01",
    "10000-01-01",
    "2026-10-15T00:00:00Z",
    " 2026-10-15",
    "2026-10-15\n",
  ])("rejects invalid dates without normalizing them: %j", (date) => {
    expect(() => calculate(date)).toThrow(RangeError);
    expect(() => calculate(date, null)).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid broker count %s",
    (count) => {
      expect(() => calculate("2026-10-15", count)).toThrow(RangeError);
    },
  );

  it("rejects monthly totals beyond exact integer precision", () => {
    expect(() => calculate("2026-10-15", Number.MAX_SAFE_INTEGER)).toThrow(
      "Monthly goal exceeds the safe integer range.",
    );
  });
});
