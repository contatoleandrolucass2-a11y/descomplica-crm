import { describe, expect, it } from "vitest";
import {
  analyzeDashboard,
  emptyDashboardFilters,
  type DashboardPeriodReadings,
} from "@/lib/crm/dashboard/analysis";
import {
  ANALYSIS_STAGE_KEYS,
  DASHBOARD_CHANNELS,
  type DashboardAnalysisFact,
  type DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import { DASHBOARD_STAGES } from "@/lib/crm/dashboard/catalog";

function fact(date: string, count = 1, stage = 0, dimension = 0): DashboardAnalysisFact {
  return [stage, date, dimension, dimension, dimension, dimension, -1, count, 0, 0];
}

function slice(referenceDate: string, facts: DashboardAnalysisFact[]): DashboardAnalysisSlice {
  return {
    version: 1,
    viewKey: "all",
    coverageStart: "2025-01-01",
    referenceDate,
    dimensions: {
      managers: ["Manager A", "Manager B"],
      owners: ["Owner A", "Owner B"],
      companies: ["Company A", "Company B"],
      developments: [],
    },
    facts,
  };
}

function values(readings: DashboardPeriodReadings) {
  return Object.fromEntries(
    Object.entries(readings).map(([key, stages]) => [key, stages[0]!.value]),
  );
}

describe("month-scoped dashboard period readings", () => {
  it("clips a Monday-Sunday week at month start without changing legacy metrics", () => {
    const result = analyzeDashboard(
      slice("2026-10-04", [fact("2026-09-30", 100), fact("2026-10-01", 2), fact("2026-10-04", 3)]),
      emptyDashboardFilters(),
    );
    expect(values(result.periodReadings)).toEqual({
      month: 5,
      "previous-week": 0,
      "current-week": 5,
      yesterday: 0,
      today: 3,
    });
    expect(result.metrics.opportunities.currentWeek).toBe(105);
    expect(result.metrics.opportunities.lastSevenDays).toBe(105);
    expect(result.metrics.opportunities.previousMonth).toBe(100);
    expect(result.history.previous[0]!.readings[0]!.value).toBe(100);
  });

  it("moves the Sunday into the previous week on Monday and clips that week", () => {
    const result = analyzeDashboard(
      slice("2026-10-05", [
        fact("2026-09-28", 100),
        fact("2026-10-01", 2),
        fact("2026-10-04", 3),
        fact("2026-10-05", 5),
      ]),
      emptyDashboardFilters(),
    );
    expect(values(result.periodReadings)).toEqual({
      month: 10,
      "previous-week": 5,
      "current-week": 5,
      yesterday: 3,
      today: 5,
    });
    expect(result.metrics.opportunities.previousWeek).toBe(105);
  });

  it.each(["2026-01-01", "2026-06-01", "2026-11-01"])(
    "zeros periods outside the month with coverage starting on %s",
    (referenceDate) => {
      const input = {
        ...slice(referenceDate, [fact(referenceDate, 4)]),
        coverageStart: referenceDate,
      };
      const result = analyzeDashboard(input, emptyDashboardFilters());
      expect(values(result.periodReadings)).toEqual({
        month: 4,
        "previous-week": 0,
        "current-week": 4,
        yesterday: 0,
        today: 4,
      });
      expect(result.metrics.opportunities.yesterday).toBeNull();
      expect(result.metrics.opportunities.previousWeek).toBeNull();
    },
  );

  it("excludes December from January while preserving legacy yesterday", () => {
    const result = analyzeDashboard(
      slice("2026-01-01", [fact("2025-12-31", 100), fact("2026-01-01", 2)]),
      emptyDashboardFilters(),
    );
    expect(values(result.periodReadings)).toEqual({
      month: 2,
      "previous-week": 0,
      "current-week": 2,
      yesterday: 0,
      today: 2,
    });
    expect(result.metrics.opportunities.yesterday).toBe(100);
  });

  it.each([
    [
      "2026-10-14",
      "2026-10-15",
      { month: 2, "previous-week": 0, "current-week": 2, yesterday: null, today: null },
    ],
    [
      "2026-10-18",
      "2026-10-19",
      { month: 2, "previous-week": null, "current-week": null, yesterday: null, today: null },
    ],
    [
      "2026-10-31",
      "2026-11-01",
      { month: null, "previous-week": null, "current-week": null, yesterday: null, today: null },
    ],
    [
      "2025-12-31",
      "2026-01-01",
      { month: null, "previous-week": null, "current-week": null, yesterday: null, today: null },
    ],
  ])("preserves stale validity from %s to %s", (referenceDate, asOfDate, expected) => {
    const result = analyzeDashboard(
      slice(referenceDate, [fact(referenceDate, 2)]),
      emptyDashboardFilters(),
      asOfDate,
    );
    expect(values(result.periodReadings)).toEqual(expected);
  });

  it("does not turn an empty out-of-month period into zero for a stale month", () => {
    const result = analyzeDashboard(slice("2026-10-01", []), emptyDashboardFilters(), "2026-11-01");
    for (const readings of Object.values(result.periodReadings)) {
      expect(
        readings.every((reading) => reading.value === null && reading.conversion === null),
      ).toBe(true);
    }
  });

  it("preserves null when the requested interval lacks coverage", () => {
    const input = { ...slice("2026-10-15", []), coverageStart: "2026-11-01" };
    // Defensive behavior for callers bypassing the validated slice schema.
    const result = analyzeDashboard(input, emptyDashboardFilters());
    expect(
      Object.values(result.periodReadings).every((readings) =>
        readings.every((r) => r.value === null),
      ),
    ).toBe(true);
  });

  it("applies all filters before counting stages and computing conversion", () => {
    const facts = ["2026-10-04", "2026-10-05", "2026-10-06"].flatMap((date) => [
      fact(date, 10),
      fact(date, 5, 1),
      fact(date, 100, 0, 1),
      fact(date, 100, 1, 1),
    ]);
    const filters = {
      channel: [DASHBOARD_CHANNELS[0]],
      manager: ["Manager A"],
      owner: ["Owner A"],
      company: ["Company A"],
    };
    const input = slice("2026-10-06", facts);
    const original = structuredClone(input);
    const result = analyzeDashboard(input, filters);
    expect(values(result.periodReadings)).toEqual({
      month: 30,
      "previous-week": 10,
      "current-week": 20,
      yesterday: 10,
      today: 10,
    });
    for (const readings of Object.values(result.periodReadings)) {
      expect(readings.map((reading) => reading.key)).toEqual(ANALYSIS_STAGE_KEYS);
      expect(readings.map((reading) => reading.label)).toEqual(
        ANALYSIS_STAGE_KEYS.map((key) => DASHBOARD_STAGES[key].label),
      );
      expect(readings.map((reading) => reading.conversion)).toEqual([null, 0.5, 0, null, null]);
    }
    expect(input).toEqual(original);
    const empty = analyzeDashboard(input, { ...filters, owner: ["Absent"] });
    expect(
      Object.values(empty.periodReadings).every((readings) =>
        readings.every((r) => r.value === 0 && r.conversion === null),
      ),
    ).toBe(true);
  });
});
