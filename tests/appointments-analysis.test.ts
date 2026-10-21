import { describe, expect, it } from "vitest";

import type {
  DashboardAnalysisFact,
  DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import {
  analyzeAppointments,
  appointmentMonthlyGoal,
  appointmentWeekOfMonth,
  appointmentYears,
  plannedAppointmentsForDate,
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

function stageFact(
  stage: 0 | 1 | 2 | 4,
  count: number,
  manager = 0,
  owner = 0,
  company = 0,
  channel: 0 | 1 = 1,
): DashboardAnalysisFact {
  return [stage, "2026-10-19", manager, owner, company, channel, 0, count, 0, 0, -1];
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
    expect(result.plannedToday).toBe(10);
    expect(result.performedToday).toBe(1);
    expect(result.details).toHaveLength(2);
    expect(result.regionalManagers?.map(({ label }) => label)).toEqual([
      "Regional A",
      "Regional B",
    ]);
    expect(result.accountRankings?.map(({ label }) => label)).toEqual(["Ouro", "Prata"]);
    expect(result.dailyAverage).toBeCloseTo(2 / 19);
  });

  it("calculates the monthly goal and weekday plan from registered brokers", () => {
    expect(appointmentMonthlyGoal(24, 32)).toBe(768);
    expect(appointmentMonthlyGoal(null, 32)).toBeNull();
    expect(plannedAppointmentsForDate("2026-10-19", 32)).toBe(32);
    expect(plannedAppointmentsForDate("2026-10-22", 32)).toBe(64);
    expect(plannedAppointmentsForDate("2026-10-24", 32)).toBe(0);
  });

  it("applies combined chart filters to every operational result", () => {
    const input = slice({
      version: 3,
      brokerCount: 2,
      appointments: [
        {
          createdAt: "2026-10-19T12:00:00-03:00",
          scheduledAt: null,
          attendedAt: null,
          visitPerformed: false,
          regionalManager: "Regional A",
          salesManager: "Gerente A",
          owner: "Responsável A",
          accountName: "Conta A",
          accountRanking: "Ouro",
        },
        {
          createdAt: "2026-10-18T12:00:00-03:00",
          scheduledAt: null,
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
    const result = analyzeAppointments(input, {
      filters: { regionalManager: "Regional A", owner: "Responsável A" },
    });
    expect(result.total).toBe(1);
    expect(result.details?.map((row) => row.accountName)).toEqual(["Conta A"]);
    expect(result.managers).toEqual([{ key: "Gerente A", label: "Gerente A", total: 1 }]);
    expect(result.accountRankings).toEqual([{ key: "Ouro", label: "Ouro", total: 1 }]);
  });

  it("combines the four dashboard filters across funnel, productive team and details in v4", () => {
    const appointment = (
      owner: string,
      salesManager: string,
      company: string,
      channel: 0 | 1,
      registeredBroker = true,
    ) => ({
      createdAt: "2026-10-19T12:00:00-03:00",
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: false,
      regionalManager: "Regional A",
      salesManager,
      owner,
      accountName: `Conta ${owner}`,
      accountRanking: "Ouro",
      channel,
      company,
      registeredBroker,
    });
    const input = slice({
      version: 4,
      brokerCount: 4,
      brokerManagerCount: 2,
      dimensions: {
        managers: ["Gerente A", "Gerente B"],
        owners: ["Responsável A", "Responsável B"],
        companies: ["Empresa A", "Empresa B"],
        developments: ["Residencial A"],
        stores: ["Loja A"],
      },
      facts: [
        stageFact(0, 9),
        stageFact(1, 3),
        stageFact(2, 2),
        stageFact(4, 1),
        stageFact(0, 20, 1, 1, 1, 0),
        stageFact(1, 8, 1, 1, 1, 0),
        stageFact(2, 4, 1, 1, 1, 0),
        stageFact(4, 2, 1, 1, 1, 0),
      ],
      appointments: [
        appointment("Responsável A", "Gerente A", "Empresa A", 1),
        appointment("Responsável A", "Gerente A", "Empresa A", 1),
        appointment("Responsável B", "Gerente B", "Empresa B", 0),
      ],
    });
    const result = analyzeAppointments(input, {
      filters: {
        channel: 1,
        manager: "Gerente A",
        owner: "Responsável A",
        company: "Empresa A",
      },
    });
    expect(result.total).toBe(2);
    expect(result.details).toHaveLength(2);
    expect(result.funnel).toEqual({ opportunities: 9, appointments: 3, visits: 2, sales: 1 });
    expect(result.productiveBrokers).toBe(1);
    expect(result.productivePercent).toBe(25);
    expect(result.registeredManagerCount).toBe(2);
    expect(result.visitsPerformed).toBe(2);
    expect(result.sales).toBe(1);
    expect(result.filterOptions.channels).toEqual([
      { key: 1, label: "House" },
      { key: 0, label: "Imob" },
    ]);
  });

  it("returns finite zero funnel indicators when no source or destination exists", () => {
    const result = analyzeAppointments(
      slice({
        version: 4,
        brokerCount: 0,
        brokerManagerCount: 0,
        dimensions: { ...slice().dimensions, stores: ["Loja A", "Loja B"] },
        facts: [],
        appointments: [],
      }),
    );
    expect(result.funnel).toEqual({ opportunities: 0, appointments: 0, visits: 0, sales: 0 });
    expect(result.productiveBrokers).toBe(0);
    expect(result.productivePercent).toBe(0);
    expect(result.visitsPerformed).toBe(0);
    expect(result.sales).toBe(0);
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
