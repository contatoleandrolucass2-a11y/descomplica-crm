import { describe, expect, it } from "vitest";
import { analyzeDashboard, emptyDashboardFilters } from "@/lib/crm/dashboard/analysis";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";

function slice(referenceDate: string): DashboardAnalysisSlice {
  return {
    version: 1,
    viewKey: "all",
    coverageStart: "2026-01-01",
    referenceDate,
    dimensions: {
      managers: ["Gestor"],
      owners: ["Corretor"],
      companies: ["Empresa"],
      developments: [],
    },
    facts: [[4, referenceDate, 0, 0, 0, 0, -1, 2, 500_000, 0]],
  };
}
describe("dashboard calendar and snapshot freshness", () => {
  it("preserva o mes datado mas nao chama vendas de ontem de hoje", () => {
    const result = analyzeDashboard(slice("2026-10-14"), emptyDashboardFilters(), "2026-10-15");
    expect(result.metrics.sales).toMatchObject({
      currentMonth: 2,
      currentWeek: 2,
      currentToday: null,
      lastSevenDays: null,
      lastFourteenDays: null,
    });
    expect(result.salesValue).toEqual({ month: 500_000, week: 500_000, today: null });
    expect(result.metrics.sales).toMatchObject({
      yesterday: null,
      previousSevenDays: null,
      previousFourteenDays: null,
    });
  });
  it("nao reaproveita a semana passada na segunda-feira", () => {
    const result = analyzeDashboard(slice("2026-10-18"), emptyDashboardFilters(), "2026-10-19");
    expect(result.metrics.sales.currentWeek).toBeNull();
    expect(result.metrics.sales.previousWeek).toBeNull();
    expect(result.salesValue.week).toBeNull();
    expect(result.metrics.sales.currentMonth).toBe(2);
  });
  it("nao reaproveita o mes anterior no novo mes", () => {
    const result = analyzeDashboard(slice("2026-10-31"), emptyDashboardFilters(), "2026-11-01");
    expect(result.metrics.sales.currentMonth).toBeNull();
    expect(result.salesValue.month).toBeNull();
  });
  it("volta a mostrar todas as janelas quando a coleta esta atualizada", () => {
    const result = analyzeDashboard(slice("2026-10-15"), emptyDashboardFilters(), "2026-10-15");
    expect(result.metrics.sales).toMatchObject({
      currentMonth: 2,
      currentWeek: 2,
      currentToday: 2,
      lastSevenDays: 2,
      lastFourteenDays: 2,
    });
  });
});
