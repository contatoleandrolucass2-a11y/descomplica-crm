import { describe, expect, it } from "vitest";

import { isDashboardPeriod, isDashboardView } from "../lib/crm/dashboard/catalog";
import {
  calculateConversion,
  calculateProgress,
  clampPercentage,
} from "../lib/crm/dashboard/presentation";

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

  it("limita o valor visual de progresso entre zero e cem", () => {
    expect(clampPercentage(1.2)).toBe(100);
    expect(clampPercentage(-0.2)).toBe(0);
    expect(clampPercentage(null)).toBe(0);
  });
});
