import { describe, expect, it } from "vitest";

import { buildDashboardManagementGoals } from "@/lib/crm/dashboard/management-goals";
import { DASHBOARD_CHANNELS } from "@/lib/crm/dashboard/analysis-contract";

const calculate = (referenceDate: string, brokerCount: number | null = 1) =>
  buildDashboardManagementGoals({ referenceDate, brokerCount, channel: DASHBOARD_CHANNELS[1] });

describe("buildDashboardManagementGoals", () => {
  it("sums every House goal from the approved per-broker reference", () => {
    const result = calculate("2026-10-15", 3);
    expect(result).toMatchObject({
      referenceDate: "2026-10-15",
      brokerCount: 3,
      daysInMonth: 31,
      elapsedDays: 15,
      monthlyGoals: {
        opportunities: 429,
        appointments: 72,
        visits: 36,
        folders: 24,
        "approved-folders": 6,
        sales: 3,
      },
    });
    expect(result.expectedByToday.opportunities).toBeCloseTo((429 * 15) / 31, 12);
    expect(result.expectedByToday.appointments).toBeCloseTo((72 * 15) / 31, 12);
    expect(result.expectedByToday.visits).toBeCloseTo((36 * 15) / 31, 12);
    expect(result.expectedByToday.folders).toBeCloseTo((24 * 15) / 31, 12);
    expect(result.expectedByToday["approved-folders"]).toBeCloseTo((6 * 15) / 31, 12);
    expect(result.expectedByToday.sales).toBeCloseTo((3 * 15) / 31, 12);
  });

  it.each([
    ["2026-02-01", 28],
    ["2024-02-01", 29],
    ["2000-02-01", 29],
    ["1900-02-01", 28],
    ["2100-02-01", 28],
    ["2026-12-01", 31],
    ["2027-01-01", 31],
    ["0001-01-01", 31],
    ["0099-02-01", 28],
    ["9999-12-01", 31],
  ])("uses the full supplied month for %s", (date, days) => {
    const result = calculate(date);
    expect(result.daysInMonth).toBe(days);
    expect(result.monthlyGoals.appointments).toBe(24);
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
    expect(sunday.expectedByToday.appointments).toBeCloseTo((24 * 4) / 31, 12);
  });

  it("does not double the elapsed-day fraction on Thursdays", () => {
    const wednesday = calculate("2026-10-14");
    const thursday = calculate("2026-10-15");
    expect(wednesday.monthlyGoals.appointments).toBe(24);
    expect(thursday.monthlyGoals.appointments).toBe(24);
    expect(
      thursday.expectedByToday.appointments! - wednesday.expectedByToday.appointments!,
    ).toBeCloseTo(24 / 31, 12);
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
    expect(december.monthlyGoals.appointments).toBe(48);
    expect(december.expectedByToday.appointments).toBe(48);
    expect(january.monthlyGoals.appointments).toBe(48);
    expect(january.expectedByToday.appointments).toBeCloseTo(48 / 31, 12);
  });

  it("distinguishes unavailable cohort from an empty filtered cohort", () => {
    const unavailable = calculate("2026-10-15", null);
    expect(Object.values(unavailable.monthlyGoals)).toEqual(Array(6).fill(null));
    expect(Object.values(unavailable.expectedByToday)).toEqual(Array(6).fill(null));
    const empty = calculate("2026-10-15", 0);
    expect(empty.monthlyGoals).toEqual({
      opportunities: 0,
      appointments: 0,
      visits: 0,
      folders: 0,
      "approved-folders": 0,
      sales: 0,
    });
    expect(empty.expectedByToday).toEqual(empty.monthlyGoals);
  });

  it("keeps every Imob goal unavailable without an active partnership goal", () => {
    const result = buildDashboardManagementGoals({
      referenceDate: "2026-10-15",
      brokerCount: 315,
      channel: DASHBOARD_CHANNELS[0],
    });
    expect(Object.values(result.monthlyGoals)).toEqual(Array(6).fill(null));
    expect(Object.values(result.expectedByToday)).toEqual(Array(6).fill(null));
  });

  it("multiplies the active Imob goal by the seven confirmed managers", () => {
    const result = buildDashboardManagementGoals({
      referenceDate: "2026-10-20",
      brokerCount: null,
      channel: DASHBOARD_CHANNELS[0],
      partnershipGoals: {
        visits: 12,
        folders: 64,
        "approved-folders": 32,
        sales: 20,
      },
    });
    expect(result.monthlyGoals).toEqual({
      opportunities: null,
      appointments: null,
      visits: 84,
      folders: 448,
      "approved-folders": 224,
      sales: 140,
    });
    expect(result.expectedByToday.visits).toBeCloseTo((84 * 20) / 31, 12);
    expect(result.expectedByToday.folders).toBeCloseTo((448 * 20) / 31, 12);
    expect(result.expectedByToday["approved-folders"]).toBeCloseTo((224 * 20) / 31, 12);
    expect(result.expectedByToday.sales).toBeCloseTo((140 * 20) / 31, 12);
  });

  it("rejects malformed or unsafe Imob goal values", () => {
    expect(() =>
      buildDashboardManagementGoals({
        referenceDate: "2026-10-20",
        brokerCount: null,
        channel: DASHBOARD_CHANNELS[0],
        partnershipGoals: {
          visits: -1,
          folders: 64,
          "approved-folders": 32,
          sales: 20,
        },
      }),
    ).toThrow("partnershipGoals must contain nonnegative safe integers.");
    expect(() =>
      buildDashboardManagementGoals({
        referenceDate: "2026-10-20",
        brokerCount: null,
        channel: DASHBOARD_CHANNELS[0],
        partnershipGoals: {
          visits: 12,
          folders: 64,
          "approved-folders": 32,
          sales: Number.MAX_SAFE_INTEGER,
        },
      }),
    ).toThrow("Monthly goal exceeds the safe integer range.");
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
