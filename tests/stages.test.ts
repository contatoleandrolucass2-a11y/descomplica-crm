import { describe, expect, it } from "vitest";

import { CRM_STAGES, getCrmStage } from "../lib/crm/stages/catalog";
import { buildStageComparisons, stageAttainment } from "../lib/crm/stages/presentation";

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

  it("classifies progress thresholds", () => {
    expect(stageAttainment(null).label).toBe("Sem meta definida");
    expect(stageAttainment(0.49).label).toBe("Gap relevante");
    expect(stageAttainment(0.8).label).toBe("Próximo da meta");
    expect(stageAttainment(1).label).toBe("Meta atingida");
  });
});
