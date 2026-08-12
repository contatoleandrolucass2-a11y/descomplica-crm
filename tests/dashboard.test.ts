import { describe, expect, it } from "vitest";

import { isDashboardPeriod, isDashboardView } from "../lib/crm/dashboard/catalog";
import {
  buildMonthlyFunnelSnapshots,
  buildPeriodFunnelReadings,
  calculateConversion,
  calculateProgress,
  clampPercentage,
} from "../lib/crm/dashboard/presentation";

const metric = {
  currentMonth: 100,
  currentWeek: 20,
  currentToday: 3,
  goalMonth: 120,
  goalWeek: 24,
  goalToday: 4,
  previousMonth: null,
  yearClosedMonthsAverage: 80,
  lastThreeClosedMonthsAverage: 90,
  previousFourteenDays: null,
  lastFourteenDays: null,
  previousSevenDays: null,
  lastSevenDays: null,
  previousWeek: null,
  yesterday: null,
};

const metrics = {
  opportunities: metric,
  appointments: { ...metric, currentMonth: 50 },
  visits: { ...metric, currentMonth: 25 },
  folders: { ...metric, currentMonth: 10 },
  sales: { ...metric, currentMonth: 5 },
};

describe("dashboard query catalog", () => {
  it("aceita somente visões e períodos declarados", () => {
    expect(isDashboardView("all")).toBe(true);
    expect(isDashboardView("internal")).toBe(false);
    expect(isDashboardPeriod("week")).toBe(true);
    expect(isDashboardPeriod(["week"])).toBe(false);
  });
});

describe("dashboard indicators", () => {
  it("calcula conversão e progresso sem dividir por zero", () => {
    expect(calculateConversion(25, 100)).toBe(0.25);
    expect(calculateConversion(1, 0)).toBeNull();
    expect(calculateProgress(5, 10)).toBe(0.5);
    expect(calculateProgress(5, 0)).toBeNull();
  });

  it("builds period funnels from the declared snapshot fields", () => {
    const readings = buildPeriodFunnelReadings(metrics, "month");

    expect(readings.map((reading) => reading.value)).toEqual([100, 50, 25, 10, 5]);
    expect(readings[0]?.conversion).toBeNull();
    expect(readings[1]?.conversion).toBe(0.5);
  });

  it("keeps unavailable history and goals explicit", () => {
    const snapshots = buildMonthlyFunnelSnapshots(metrics, false);
    const previous = snapshots.find((snapshot) => snapshot.key === "previous")!;
    const goal = snapshots.find((snapshot) => snapshot.key === "goal")!;

    expect(previous.readings.every((reading) => reading.value === null)).toBe(true);
    expect(goal.readings.every((reading) => reading.value === null)).toBe(true);
  });

  it("does not treat a zero target as a usable goal", () => {
    const zeroGoals = Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, { ...value, goalMonth: 0 }]),
    ) as typeof metrics;
    const goal = buildMonthlyFunnelSnapshots(zeroGoals, true).find(
      (snapshot) => snapshot.key === "goal",
    )!;

    expect(goal.readings.every((reading) => reading.value === null)).toBe(true);
  });

  it("limita o valor visual de progresso entre zero e cem", () => {
    expect(clampPercentage(1.2)).toBe(100);
    expect(clampPercentage(-0.2)).toBe(0);
    expect(clampPercentage(null)).toBe(0);
  });
});
