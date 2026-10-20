import { describe, expect, it } from "vitest";

import type {
  DashboardAnalysisFact,
  DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentWeekOfMonth,
  appointmentYears,
} from "@/lib/crm/stages/appointments";

function fact(
  date: string,
  count: number,
  manager = 0,
  owner = 0,
  development = 0,
  store = 0,
): DashboardAnalysisFact {
  return [1, date, manager, owner, -1, 0, development, count, 0, 0, store];
}

function slice(overrides: Partial<DashboardAnalysisSlice> = {}): DashboardAnalysisSlice {
  return {
    version: 2,
    viewKey: "all",
    coverageStart: "2025-10-01",
    referenceDate: "2026-10-19",
    dimensions: {
      managers: ["Gerente A", "Gerente B"],
      owners: ["Responsável A", "Responsável B"],
      companies: [],
      developments: ["Residencial A", "Residencial B"],
      stores: ["Loja A", "Loja B"],
    },
    facts: [
      fact("2026-10-01", 2),
      fact("2026-10-04", 3, 1, 1, 1, 0),
      fact("2026-10-05", 7, 1, 1, 0, 1),
      fact("2026-10-15", 1),
      fact("2026-09-01", 10),
      fact("2025-10-01", 99),
      [0, "2026-10-03", 0, 0, -1, 0, 0, 1000, 0, 0, -1],
    ],
    ...overrides,
  };
}

describe("appointment chart analysis", () => {
  it("counts only appointments, sums quantities and sorts all four dimensions descending", () => {
    const result = analyzeAppointments(slice());
    expect(result.total).toBe(13);
    expect(result.managers.map(({ label, total }) => [label, total])).toEqual([
      ["Gerente B", 10],
      ["Gerente A", 3],
    ]);
    expect(result.owners.map(({ total }) => total)).toEqual([10, 3]);
    expect(result.stores.map(({ label, total }) => [label, total])).toEqual([
      ["Loja B", 7],
      ["Loja A", 6],
    ]);
    expect(result.developments?.map(({ label, total }) => [label, total])).toEqual([
      ["Residencial A", 10],
      ["Residencial B", 3],
    ]);
    expect(result.daily.map(({ total }) => total)).toEqual([2, 3, 7, 1]);
    expect(result.weekly.map(({ label, total }) => [label, total])).toEqual([
      ["1ª semana", 5],
      ["2ª semana", 7],
      ["3ª semana", 1],
    ]);
  });

  it("derives the six indicators, operational comparison, rankings and table from v3", () => {
    const input = slice({
      version: 3,
      brokerCount: 10,
      appointments: [
        {
          createdAt: "2026-10-19T12:00:00Z",
          scheduledAt: "2026-10-19T15:00:00Z",
          attendedAt: "2026-10-19T15:30:00Z",
          visitPerformed: true,
          regionalManager: "Regional A",
          salesManager: "Gerente A",
          owner: "Responsável A",
          accountName: "Conta A",
          accountRanking: "Ouro",
        },
        {
          createdAt: "2026-10-18T12:00:00Z",
          scheduledAt: "2026-10-19T18:00:00Z",
          attendedAt: null,
          visitPerformed: false,
          regionalManager: "Regional B",
          salesManager: "Gerente B",
          owner: "Responsável B",
          accountName: "Conta B",
          accountRanking: "Prata",
        },
      ],
    });
    const result = analyzeAppointments(input);
    expect(result.brokerCount).toBe(10);
    expect(result.plannedToday).toBe(2);
    expect(result.performedToday).toBe(1);
    expect(result.details).toHaveLength(2);
    expect(result.regionalManagers?.map(({ label }) => label)).toEqual([
      "Regional A",
      "Regional B",
    ]);
    expect(result.accountRankings?.map(({ label }) => label)).toEqual(["Ouro", "Prata"]);
    expect(result.dailyAverage).toBeCloseTo(13 / 19);
  });

  it("keeps yearly monthly values independent of the other charts' selected month", () => {
    const result = analyzeAppointments(slice(), { month: "2026-09", year: "2026" });
    expect(result.total).toBe(10);
    expect(result.monthly.map(({ label, total }) => [label, total])).toEqual([
      ["Setembro", 10],
      ["Outubro", 13],
    ]);
    expect(analyzeAppointments(slice(), { year: "2025" }).monthly[0]?.total).toBe(99);
    expect(appointmentYears(slice())).toEqual(["2026", "2025"]);
  });

  it("treats legacy dimension 6 as store and explicitly leaves development unavailable", () => {
    const legacy = slice({
      version: 1,
      dimensions: { managers: [], owners: [], companies: [], developments: ["PDV legado"] },
      facts: [[1, "2026-10-01", -1, -1, -1, 0, 0, 4, 0, 0]],
    });
    const result = analyzeAppointments(legacy);
    expect(result.stores).toEqual([{ key: "PDV legado", label: "PDV legado", total: 4 }]);
    expect(result.developments).toBeNull();
    expect(result.managers[0]?.label).toBe("Gerente não informado");
    expect(result.owners[0]?.label).toBe("Responsável não informado");
  });

  it("covers Monday/Sunday boundaries, the third week and months with six weeks", () => {
    expect(appointmentWeekOfMonth("2026-10-04")).toBe(1);
    expect(appointmentWeekOfMonth("2026-10-05")).toBe(2);
    expect(appointmentWeekOfMonth("2026-10-15")).toBe(3);
    expect(appointmentWeekOfMonth("2026-03-01")).toBe(1);
    expect(appointmentWeekOfMonth("2026-03-02")).toBe(2);
    expect(appointmentWeekOfMonth("2026-03-31")).toBe(6);
  });

  it("distinguishes no coverage, partial coverage and covered periods without records", () => {
    expect(analyzeAppointments(slice()).coverage).toBe("partial");
    expect(analyzeAppointments(slice(), { month: "2026-09" }).coverage).toBe("complete");
    const unavailable = analyzeAppointments(slice(), { month: "2027-01" });
    expect(unavailable.coverage).toBe("unavailable");
    expect(unavailable.daily).toEqual([]);
    const empty = analyzeAppointments(slice({ facts: [] }), { month: "2026-09" });
    expect(empty.coverage).toBe("complete");
    expect(empty.daily).toEqual([]);
    expect(empty.monthly).toEqual([]);
    expect(empty.managers).toEqual([]);
  });

  it("preserves more than 20 rankings and missing dimension counts without inventing names", () => {
    const names = Array.from({ length: 35 }, (_, index) => `Responsável ${index}`);
    const input = slice();
    input.dimensions.owners = names;
    input.facts = names.map((_, index) => fact("2026-10-01", index + 1, 0, index));
    input.facts.push(fact("2026-10-01", 40, -1, -1, -1, -1));
    const result = analyzeAppointments(input);
    expect(result.owners).toHaveLength(36);
    expect(result.owners[0]).toEqual({
      key: "Responsável não informado",
      label: "Responsável não informado",
      total: 40,
    });
    expect(result.stores.find((item) => item.label === "Loja não informada")?.total).toBe(40);
    expect(
      result.developments?.find((item) => item.label === "Empreendimento não informado")?.total,
    ).toBe(40);
    expect(result.owners.reduce((sum, item) => sum + item.total, 0)).toBe(result.total);
  });
});
