import { describe, expect, it } from "vitest";

import { buildAppointmentComparison } from "@/app/(protected)/app/etapas/_components/appointments-comparison";
import type {
  DashboardAnalysisFact,
  DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import type { AppointmentFilters } from "@/lib/crm/stages/appointments";

const fact = (
  date: string,
  count: number,
  manager = 0,
  owner = 0,
  channel: 0 | 1 = 1,
  company = 0,
): DashboardAnalysisFact => [1, date, manager, owner, company, channel, -1, count, 0, 0, -1];

function slice(overrides: Partial<DashboardAnalysisSlice> = {}): DashboardAnalysisSlice {
  return {
    version: 2,
    viewKey: "all",
    coverageStart: "2025-12-01",
    referenceDate: "2026-03-10",
    dimensions: {
      managers: ["Gerente A", "Gerente B"],
      owners: ["Corretor A", "Corretor B"],
      companies: ["Empresa A", "Empresa B"],
      developments: [],
      stores: [],
    },
    facts: [],
    ...overrides,
  };
}

describe("appointment month comparison", () => {
  it("aligns January with the previous December and keeps future days unknown", () => {
    const result = buildAppointmentComparison(
      slice({
        referenceDate: "2026-01-10",
        facts: [fact("2025-12-01", 3), fact("2025-12-31", 4), fact("2026-01-01", 2)],
      }),
      { month: "2026-01" },
    );
    expect(result.days).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
    expect(result.series.map((series) => series.key)).toEqual([
      "selected",
      "previous",
      "year-average",
    ]);
    expect(result.series[1].label).toContain("dezembro de 2025");
    expect(result.series[0].values[0]).toBe(2);
    expect(result.series[0].values[9]).toBe(0);
    expect(result.series[0].values[10]).toBeNull();
    expect(result.series[0].values[30]).toBeNull();
    expect(result.series[1].values[30]).toBe(4);
    expect(result.series[2].values[0]).toBe(2);
    expect(result.series[2].values[10]).toBeNull();
  });

  it.each([
    ["2024", 6, 7],
    ["2023", 5, null],
  ] as const)(
    "excludes impossible February dates from the %s average denominator",
    (year, day29Average, previous29) => {
      const result = buildAppointmentComparison(
        slice({
          coverageStart: `${year}-02-01`,
          referenceDate: `${year}-03-31`,
          facts: [
            fact(`${year}-02-28`, 2),
            ...(year === "2024" ? [fact(`${year}-02-29`, 7)] : []),
            fact(`${year}-03-29`, 5),
            fact(`${year}-03-31`, 9),
          ],
        }),
        { month: `${year}-03` },
      );
      expect(result.series[1].values[28]).toBe(previous29);
      expect(result.series[1].values[29]).toBeNull();
      expect(result.series[1].values[30]).toBeNull();
      expect(result.series[2].values[28]).toBe(day29Average);
      expect(result.series[2].values[29]).toBe(0);
      expect(result.series[2].values[30]).toBe(9);
    },
  );

  it("averages each day only across dates covered in a partial year and partial current month", () => {
    const result = buildAppointmentComparison(
      slice({
        coverageStart: "2026-03-01",
        referenceDate: "2026-05-10",
        facts: [
          fact("2026-03-01", 2),
          fact("2026-04-01", 4),
          fact("2026-05-01", 9),
          fact("2026-03-11", 3),
          fact("2026-04-11", 7),
          fact("2026-03-31", 6),
        ],
      }),
      { month: "2026-05" },
    );
    expect(result.series[2].values[0]).toBe(5);
    expect(result.series[2].values[10]).toBe(5);
    expect(result.series[2].values[30]).toBe(6);
    expect(result.series[0].values[10]).toBeNull();
    expect(result.series[1].values[10]).toBe(7);
    expect(result.series[1].values[30]).toBeNull();
  });

  it("does not turn an entirely uncovered year or month into zero", () => {
    const input = slice({
      coverageStart: "2026-01-01",
      referenceDate: "2026-10-31",
      facts: [fact("2026-10-01", 4), fact("2026-10-31", 6)],
    });
    const november = buildAppointmentComparison(input, { month: "2026-11" });
    expect(november.series[0].values.every((value) => value === null)).toBe(true);
    expect(november.series[1].values[0]).toBe(4);
    expect(november.series[2].values[0]).toBe(0.4); // Ten covered months, not twelve.
    expect(november.days).toHaveLength(30);
    expect(november.series[2].values).toHaveLength(30);
    const nextYear = buildAppointmentComparison(input, { month: "2027-02" });
    expect(nextYear.series.every((series) => series.values.every((value) => value === null))).toBe(
      true,
    );
  });

  it("compares selected day numbers while preserving dimensions and the original temporal selection", () => {
    const input = slice({
      facts: [
        fact("2026-03-01", 2),
        fact("2026-03-02", 3),
        fact("2026-02-01", 4),
        fact("2026-03-01", 50, 1, 1, 0, 1),
        fact("2026-03-02", 60, 1, 1, 1, 1),
      ],
    });
    const filters: AppointmentFilters = {
      channel: 1,
      manager: "Gerente A",
      owner: "Corretor A",
      company: "Empresa A",
      createdDate: "2026-03-01",
      createdDates: ["2026-03-01"],
      week: 1,
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
    };
    const before = JSON.stringify({ input, filters });
    const result = buildAppointmentComparison(input, { month: "2026-03", filters });
    expect(result.series[0].values[0]).toBe(2);
    expect(result.days).toEqual([1]);
    expect(result.series[0].values).toEqual([2]);
    expect(result.series[1].values[0]).toBe(4);
    expect(result.description).toContain("filtros de período e equipe mantidos");
    expect(JSON.stringify({ input, filters })).toBe(before);
  });

  it("preserves v4 regional activity filters and does not invent events from inactive roster members", () => {
    const appointment = (date: string, manager: "A" | "B") => ({
      createdAt: `${date}T12:00:00-03:00`,
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: false,
      regionalManager: `Regional ${manager}`,
      salesManager: `Gerente ${manager}`,
      owner: `Corretor ${manager}`,
      accountName: "Conta sintética",
      accountRanking: "Ouro",
      channel: 1 as const,
      company: `Empresa ${manager}`,
      registeredBroker: true,
    });
    const input = slice({
      version: 4,
      coverageStart: "2026-02-01",
      referenceDate: "2026-03-31",
      brokerCount: 3,
      brokerManagerCount: 2,
      appointments: [
        appointment("2026-02-01", "A"),
        appointment("2026-03-01", "A"),
        appointment("2026-03-01", "A"),
        appointment("2026-03-01", "B"),
      ],
      facts: [fact("2026-02-01", 1), fact("2026-03-01", 2), fact("2026-03-01", 1, 1, 1, 1, 1)],
    });
    const brokerRoster = [
      { key: "a", owner: "Corretor A", manager: "Gerente A" },
      { key: "inactive", owner: "Sem atividade", manager: "Gerente A" },
      { key: "b", owner: "Corretor B", manager: "Gerente B" },
    ];
    const result = buildAppointmentComparison(input, {
      month: "2026-03",
      filters: { channel: 1, manager: "Gerente A", regionalManager: "Regional A" },
      brokerRoster,
      goalsByMonth: { "2026-02": 10, "2026-03": 20 },
    });
    expect(result.series[0].values[0]).toBe(2);
    expect(result.series[1].values[0]).toBe(1);
    expect(result.series[2].values[0]).toBe(1.5);
    const inactive = buildAppointmentComparison(input, {
      month: "2026-03",
      filters: { owner: "Sem atividade", channel: 1 },
      brokerRoster,
    });
    expect(inactive.series[0].values.every((value) => value === 0)).toBe(true);
    expect(inactive.series[2].values.every((value) => value === 0)).toBe(true);
  });

  it.each(["2026-00", "2026-13", "2026-1", "0000-01", "invalid"])(
    "rejects an invalid reference month %s",
    (month) => {
      expect(() => buildAppointmentComparison(slice(), { month })).toThrow(RangeError);
    },
  );
});
