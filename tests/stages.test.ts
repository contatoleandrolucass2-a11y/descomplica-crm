import { describe, expect, it } from "vitest";

import { CRM_STAGES, getCrmStage } from "../lib/crm/stages/catalog";
import { buildStageComparisons } from "../lib/crm/stages/presentation";

const metric = {
  currentMonth: 80,
  currentWeek: 20,
  currentToday: 4,
  goalMonth: 100,
  goalWeek: 25,
  goalToday: 5,
  previousMonth: 70,
  yearClosedMonthsAverage: 60,
  lastThreeClosedMonthsAverage: 65,
  previousFourteenDays: 35,
  lastFourteenDays: 40,
  previousSevenDays: 18,
  lastSevenDays: 22,
  previousWeek: 19,
  yesterday: 3,
};

describe("stage details", () => {
  it("maps the five authorized slugs to dashboard stages", () => {
    expect(CRM_STAGES).toHaveLength(5);
    expect(getCrmStage("visitas")?.key).toBe("visits");
    expect(getCrmStage("desconhecida")).toBeNull();
  });

  it("builds the five period comparisons", () => {
    const comparisons = buildStageComparisons(metric);
    expect(comparisons).toHaveLength(5);
    expect(comparisons[0]).toMatchObject({ previous: 70, current: 80, goal: 100 });
    expect(comparisons.at(-1)).toMatchObject({ previous: 3, current: 4, goal: 5 });
  });

  it("preserves unavailable temporal windows instead of inventing zero or fallback values", () => {
    const comparisons = buildStageComparisons({
      ...metric,
      lastFourteenDays: null,
      lastSevenDays: null,
    });

    expect(comparisons.find((row) => row.label === "14 dias")?.current).toBeNull();
    expect(comparisons.find((row) => row.label === "7 dias")?.current).toBeNull();
  });
});
