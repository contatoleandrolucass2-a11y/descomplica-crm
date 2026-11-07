import { describe, expect, it, vi } from "vitest";

import { buildAppointmentComparison } from "@/app/(protected)/app/etapas/_components/appointments-comparison";
import type {
  DashboardAnalysisFact,
  DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import type { AppointmentFilters } from "@/lib/crm/stages/appointments";
import * as appointmentAnalysis from "@/lib/crm/stages/appointments";

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

// The former implementation independently ran the full analysis for each
// comparison month. Keep that authoritative path as a differential oracle.
function monthlyOracle(
  input: DashboardAnalysisSlice,
  referenceMonth: string,
  filters: AppointmentFilters,
  days: number[],
) {
  const dimensions = { ...filters };
  delete dimensions.createdDate;
  delete dimensions.createdDates;
  delete dimensions.week;
  delete dimensions.periodStart;
  delete dimensions.periodEnd;
  const months = new Map<string, (number | null)[]>();
  const values = (month: string) => {
    if (months.has(month)) return months.get(month)!;
    const daily = new Map(
      appointmentAnalysis
        .analyzeAppointments(input, { month, filters: dimensions })
        .daily.map(({ key, total }) => [key, total]),
    );
    const end = new Date(`${month}-01T12:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const lastDate = end.toISOString().slice(0, 10);
    const result = days.map((day) => {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      return date > lastDate || date < input.coverageStart || date > input.referenceDate
        ? null
        : (daily.get(date) ?? 0);
    });
    months.set(month, result);
    return result;
  };
  const previous = new Date(`${referenceMonth}-01T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const annual = Array.from({ length: 12 }, (_, index) =>
    values(`${referenceMonth.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`),
  );
  const start = new Date(`${referenceMonth}-01T12:00:00Z`);
  start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3 - 3);
  const quarter = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + index);
    return date.toISOString().slice(0, 7);
  });
  const roundedMean = (numbers: number[]) =>
    numbers.length
      ? Math.ceil(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
      : null;
  return [
    values(referenceMonth),
    values(previous.toISOString().slice(0, 7)),
    days.map((_, index) =>
      roundedMean(annual.map((month) => month[index]!).filter((value) => value !== null)),
    ),
    days.map((day, index) => {
      const covered = quarter
        .filter((month) => {
          const date = new Date(`${month}-01T12:00:00Z`);
          date.setUTCMonth(date.getUTCMonth() + 1, 0);
          return day <= date.getUTCDate();
        })
        .map((month) => values(month)[index]!);
      return covered.some((value) => value === null) ? null : roundedMean(covered as number[]);
    }),
  ];
}

describe("appointment month comparison", () => {
  it.each([2, 3, 4] as const)(
    "matches independent monthly analysis for v%s dimensions, hierarchy and temporal selections",
    (version) => {
      const dates = Array.from({ length: 12 }, (_, index) =>
        new Date(Date.UTC(2025, 11 + index, 5, 15)).toISOString().slice(0, 10),
      );
      const input = slice({
        version,
        coverageStart: "2025-12-01",
        referenceDate: "2026-11-19",
        facts: dates.flatMap((date) => [fact(date, 2), fact(date, 3, 1, 1, 0, 1)]),
        ...(version >= 3
          ? {
              appointments: dates.flatMap((date) =>
                ["A", "B"].map((team) => ({
                  createdAt: `${date}T15:00:00Z`,
                  scheduledAt: null,
                  attendedAt: null,
                  visitPerformed: false,
                  salesManager: `Gerente ${team}`,
                  regionalManager:
                    team === "A" && date >= "2026-07-01" ? "Regional Nova" : `Regional ${team}`,
                  owner: `Corretor ${team}`,
                  accountName: "Conta sintética",
                  accountRanking: team === "A" ? "Ouro" : "Prata",
                  ...(version === 4
                    ? {
                        channel: team === "A" ? (1 as const) : (0 as const),
                        company: `Empresa ${team}`,
                        registeredBroker: true,
                      }
                    : {}),
                })),
              ),
            }
          : {}),
      });
      for (const filters of [
        {},
        { channel: 1 },
        { channel: 0 },
        { company: "Empresa A" },
        { owner: "Corretor A" },
        { manager: "Gerente A" },
        { regionalManager: "Regional A" },
        { regionalManager: "Regional Nova" },
        { accountRanking: "Ouro" },
        { channel: 1, company: "Empresa A", manager: "Gerente A", owner: "Corretor A" },
        { createdDates: ["2026-10-05", "2026-10-31"], manager: "Gerente A" },
        { week: 2, periodStart: "2026-10-05", periodEnd: "2026-10-20", channel: 0 },
      ] satisfies AppointmentFilters[]) {
        const month = "2026-10";
        const result = buildAppointmentComparison(input, { month, filters });
        expect(
          result.series.map(({ values }) => values),
          JSON.stringify({ version, filters }),
        ).toEqual(monthlyOracle(input, month, filters, result.days));
      }
    },
  );

  it("runs the complete dashboard aggregation only once for the covered comparison period", () => {
    const analysis = vi.spyOn(appointmentAnalysis, "analyzeAppointments");
    try {
      buildAppointmentComparison(slice({ referenceDate: "2026-11-19" }), { month: "2026-10" });
      expect(analysis).toHaveBeenCalledTimes(1);
    } finally {
      analysis.mockRestore();
    }
  });

  it("rounds each covered daily annual average upward to an integer and preserves zero", () => {
    const result = buildAppointmentComparison(
      slice({
        coverageStart: "2026-01-01",
        referenceDate: "2026-02-28",
        facts: [fact("2026-01-01", 2), fact("2026-02-01", 3), fact("2026-01-03", 1)],
      }),
      { month: "2026-02" },
    );
    expect(result.series[2].values.slice(0, 3)).toEqual([3, 0, 1]);
    expect(result.series[0].values[0]).toBe(3);
    expect(result.series[1].values[0]).toBe(2);
  });

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
      "quarter-average",
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
    expect(november.series[2].values[0]).toBe(1); // Ceiling of 0.4 across ten covered months.
    expect(november.days).toHaveLength(30);
    expect(november.series[2].values).toHaveLength(30);
    const nextYear = buildAppointmentComparison(input, { month: "2027-02" });
    expect(
      nextYear.series.slice(0, 3).every((series) => series.values.every((value) => value === null)),
    ).toBe(true);
    expect(nextYear.series[3].values.every((value) => value === null)).toBe(true);
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
    expect(result.series[2].values[0]).toBe(2);
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

  it("adds the previous complete calendar quarter, not a rolling three-month window", () => {
    const input = slice({
      coverageStart: "2026-01-01",
      referenceDate: "2026-11-30",
      facts: [
        fact("2026-07-01", 2),
        fact("2026-08-01", 4),
        fact("2026-09-01", 7),
        fact("2026-10-01", 90),
        fact("2026-07-31", 3),
        fact("2026-08-31", 4),
      ],
    });
    for (const month of ["2026-10", "2026-11"]) {
      const result = buildAppointmentComparison(input, { month });
      expect(result.series[3].label).toBe("Último trimestre · julho de 2026 a setembro de 2026");
      expect(result.series[3].values[0]).toBe(5);
      expect(result.series[3].values[1]).toBe(0);
    }
    const october = buildAppointmentComparison(input, { month: "2026-10" });
    expect(october.series[3].values[30]).toBe(4);
  });

  it("rolls the quarter back across the year and keeps missing source dates unavailable", () => {
    const input = slice({
      coverageStart: "2025-10-02",
      referenceDate: "2026-01-31",
      facts: [fact("2025-10-02", 1), fact("2025-11-02", 2), fact("2025-12-02", 4)],
    });
    const result = buildAppointmentComparison(input, { month: "2026-01" });
    expect(result.series[3].label).toBe("Último trimestre · outubro de 2025 a dezembro de 2025");
    expect(result.series[3].values[0]).toBeNull();
    expect(result.series[3].values[1]).toBe(3);
    expect(result.series[3].values[2]).toBe(0);
  });

  it("preserves quarter dimensions and reference-day selections without mutating filters", () => {
    const input = slice({
      coverageStart: "2026-07-01",
      referenceDate: "2026-10-31",
      facts: [
        fact("2026-07-05", 2),
        fact("2026-08-05", 3),
        fact("2026-09-05", 5),
        fact("2026-07-05", 90, 1, 1),
      ],
    });
    const filters: AppointmentFilters = { manager: "Gerente A", createdDates: ["2026-10-05"] };
    const before = JSON.stringify(filters);
    const result = buildAppointmentComparison(input, { month: "2026-10", filters });
    expect(result.days).toEqual([5]);
    expect(result.series[3].values).toEqual([4]);
    expect(JSON.stringify(filters)).toBe(before);
  });

  it("does not fail for the earliest supported reference year", () => {
    const result = buildAppointmentComparison(slice(), { month: "0001-01" });
    expect(result.series[3].values.every((value) => value === null)).toBe(true);
  });
});
