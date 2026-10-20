import { describe, expect, it } from "vitest";

import {
  analyzeDashboard,
  emptyDashboardFilters,
  parseDashboardFilters,
  type DashboardFilterKey,
} from "@/lib/crm/dashboard/analysis";
import {
  ANALYSIS_STAGE_KEYS,
  DASHBOARD_CHANNELS,
  dashboardAnalysisFactSchema,
  dashboardAnalysisSchema,
  dashboardAnalysisSliceSchema,
  dashboardAnalysisViewSchema,
  type DashboardAnalysis,
  type DashboardAnalysisFact,
  type DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";

function fact({
  stage = 0,
  date = "2026-10-15",
  manager = 0,
  owner = 0,
  company = 0,
  channel = 0,
  development = 0,
  count = 1,
  amount = 0,
  approved = 0,
}: {
  stage?: number;
  date?: string;
  manager?: number;
  owner?: number;
  company?: number;
  channel?: number;
  development?: number;
  count?: number;
  amount?: number;
  approved?: number;
} = {}): DashboardAnalysisFact {
  return [stage, date, manager, owner, company, channel, development, count, amount, approved];
}

function slice(overrides: Partial<DashboardAnalysisSlice> = {}): DashboardAnalysisSlice {
  return {
    version: 1,
    viewKey: "all",
    coverageStart: "2025-10-01",
    referenceDate: "2026-10-31",
    dimensions: {
      managers: ["Gerente A", "Gerente B"],
      owners: ["Corretor A", "Corretor B", "Corretor C"],
      companies: ["Empresa A", "Empresa B"],
      developments: ["Empreendimento A", "Empreendimento B"],
    },
    facts: [
      fact({ date: "2026-10-01", count: 2 }),
      fact({ date: "2026-10-02", owner: 1, company: 1, channel: 1, count: 3 }),
      fact({ date: "2026-10-03", manager: 1, owner: 1, company: 1, count: 5 }),
      fact({ date: "2026-10-04", manager: 1, owner: 2, channel: 1, count: 7 }),
      fact({ stage: 2, date: "2026-10-05", count: 11 }),
      fact({ stage: 4, date: "2026-10-06", amount: 500_000 }),
    ],
    ...overrides,
  };
}

function analysis(): DashboardAnalysis {
  const { version, coverageStart, referenceDate, ...view } = slice();
  return {
    version,
    coverageStart,
    referenceDate,
    views: (["all", "with_canal_imob", "without_canal_imob"] as const).map((viewKey) => ({
      ...structuredClone(view),
      viewKey,
    })),
  };
}

describe("dashboard analysis filters and aggregation", () => {
  it("accepts exactly the two official channels, trims and deduplicates selections", () => {
    expect(DASHBOARD_CHANNELS).toEqual(["SPC - CANAL IMOB PJ", "DIRECIONAL VENDAS SPC"]);
    expect(
      parseDashboardFilters({
        channel: [...DASHBOARD_CHANNELS, ` ${DASHBOARD_CHANNELS[0]} `],
        manager: [" Gerente A ", "Gerente A", ""],
        owner: "Corretor A",
        company: undefined,
      }),
    ).toEqual({
      channel: [...DASHBOARD_CHANNELS],
      manager: ["Gerente A"],
      owner: ["Corretor A"],
      company: [],
    });
    expect(parseDashboardFilters({})).toEqual(emptyDashboardFilters());
  });

  it.each(["Outro canal", "SPC", "direcional vendas spc", "SPC - CANAL IMOB PJ extra"])(
    "rejects unsupported channel %s",
    (channel) => {
      expect(() => parseDashboardFilters({ channel })).toThrow("Invalid dashboard channel.");
    },
  );

  it("bounds raw filter counts and label lengths before deduplication", () => {
    expect(() => parseDashboardFilters({ manager: Array(51).fill("Gerente A") })).toThrow(
      RangeError,
    );
    expect(() => parseDashboardFilters({ owner: "a".repeat(201) })).toThrow(RangeError);
    expect(
      parseDashboardFilters({ company: Array(50).fill("a".repeat(200)) }).company,
    ).toHaveLength(1);
    const first = emptyDashboardFilters();
    first.manager.push("Gerente A");
    expect(emptyDashboardFilters().manager).toEqual([]);
  });

  it.each<DashboardFilterKey>(["channel", "manager", "owner", "company"])(
    "ignores only its own %s selection when deriving cascading options",
    (key) => {
      const filters = parseDashboardFilters({
        channel: DASHBOARD_CHANNELS[0],
        manager: "Gerente A",
        owner: "Corretor A",
        company: "Empresa A",
      });
      const alternate = {
        channel: DASHBOARD_CHANNELS[1],
        manager: "Gerente B",
        owner: "Corretor B",
        company: "Empresa B",
      };
      filters[key] = [alternate[key]];
      const result = analyzeDashboard(slice(), filters);
      const expected = {
        channel: DASHBOARD_CHANNELS[0],
        manager: "Gerente A",
        owner: "Corretor A",
        company: "Empresa A",
      };
      expect(result.options[key]).toEqual([expected[key]]);
      expect(result.metrics.opportunities.currentMonth).toBe(0);
    },
  );

  it("combines dimensions with AND and selections within one dimension with OR", () => {
    const result = analyzeDashboard(
      slice(),
      parseDashboardFilters({
        channel: DASHBOARD_CHANNELS[0],
        manager: ["Gerente A", "Gerente B"],
        owner: ["Corretor A", "Corretor B"],
        company: "Empresa B",
      }),
    );
    expect(result.metrics.opportunities.currentMonth).toBe(5);
    expect(result.metrics.visits.currentMonth).toBe(0);
    expect(result.salesValue.month).toBe(0);
    expect(result.brokerCount).toBe(1);
    expect(result.topDevelopments).toEqual([{ name: "Empreendimento A", total: 5, rank: 1 }]);
  });

  it("deduplicates owners and options across stages and repeated daily aggregates", () => {
    const source = slice();
    const before = structuredClone(source);
    const result = analyzeDashboard(source, emptyDashboardFilters());
    expect(result.brokerCount).toBe(3);
    expect(result.team).toEqual({
      brokers: 3,
      managers: [
        { name: "Gerente A", total: 2 },
        { name: "Gerente B", total: 2 },
      ],
    });
    expect(result.options.owner).toEqual(["Corretor A", "Corretor B", "Corretor C"]);
    expect(result.options.channel).toHaveLength(2);
    expect(result.salesValue.month).toBe(500_000);
    expect(source).toEqual(before);
  });

  it("counts unique known owners even when unidentified owners coexist", () => {
    const result = analyzeDashboard(
      slice({ facts: [fact(), fact({ date: "2026-10-16", owner: -1 })] }),
      emptyDashboardFilters(),
    );
    expect(result.brokerCount).toBe(1);
    expect(result.team.brokers).toBe(1);
    expect(result.options.owner).toEqual(["Corretor A"]);
  });

  it("keeps broker count unavailable when every fact has an unidentified owner", () => {
    const result = analyzeDashboard(
      slice({ facts: [fact({ owner: -1 }), fact({ stage: 1, owner: -1 })] }),
      emptyDashboardFilters(),
    );
    expect(result.brokerCount).toBeNull();
    expect(result.team.brokers).toBe(0);
    expect(result.options.owner).toEqual([]);
  });

  it.each(["empty source", "empty intersection"])(
    "returns real zeros for covered periods with %s",
    (scenario) => {
      const result = analyzeDashboard(
        slice(scenario === "empty source" ? { facts: [] } : {}),
        parseDashboardFilters(scenario === "empty source" ? {} : { manager: "Inexistente" }),
      );
      for (const key of ANALYSIS_STAGE_KEYS) {
        expect(result.metrics[key].currentMonth).toBe(0);
        expect(result.metrics[key].previousMonth).toBe(0);
        expect(result.metrics[key].yearClosedMonthsAverage).toBe(0);
        expect(result.metrics[key].lastThreeClosedMonthsAverage).toBe(0);
      }
      expect(result.brokerCount).toBe(0);
      expect(result.team).toEqual({ brokers: 0, managers: [] });
      expect(result.salesValue).toEqual({ month: 0, week: 0, today: 0 });
      expect(result.topDevelopments).toEqual([]);
    },
  );
});

describe("dashboard complete closed-month calculations", () => {
  it("uses the entire previous month even when today is near the start of this month", () => {
    const result = analyzeDashboard(
      slice({
        referenceDate: "2026-10-02",
        facts: [
          fact({ date: "2026-09-01", count: 3 }),
          fact({ date: "2026-09-30", count: 7 }),
          fact({ date: "2026-10-02", count: 100 }),
        ],
      }),
      emptyDashboardFilters(),
    );
    expect(result.metrics.opportunities.previousMonth).toBe(10);
    expect(result.metrics.opportunities.currentMonth).toBe(100);
    expect(result.history.previous).toEqual([
      {
        month: "2026-09",
        readings: [
          ...ANALYSIS_STAGE_KEYS.slice(0, 4).map((key) => ({
            key,
            value: key === "opportunities" ? 10 : 0,
          })),
          { key: "approved-folders", value: 0 },
          { key: "sales", value: 0 },
        ],
      },
    ]);
  });

  it("excludes October even on its last day and averages January through September", () => {
    const result = analyzeDashboard(
      slice({
        coverageStart: "2026-01-01",
        facts: [
          ...Array.from({ length: 9 }, (_, index) =>
            fact({
              date: `2026-${String(index + 1).padStart(2, "0")}-01`,
              count: (index + 1) * 10,
            }),
          ),
          fact({ date: "2026-10-31", count: 9_000 }),
        ],
      }),
      emptyDashboardFilters(),
    );
    expect(result.metrics.opportunities.currentToday).toBe(9_000);
    expect(result.metrics.opportunities.yearClosedMonthsAverage).toBe(50);
    expect(result.metrics.opportunities.lastThreeClosedMonthsAverage).toBe(80);
    expect(result.metrics.opportunities.previousMonth).toBe(90);
    expect(result.history["year-average"].map((month) => month.month)).toEqual(
      Array.from({ length: 9 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}`),
    );
    expect(result.history["three-month-average"].map((month) => month.month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(
      Object.values(result.history)
        .flat()
        .some((month) => month.month === "2026-10"),
    ).toBe(false);
  });

  it("has no annual closed month in January and takes the latest three from the previous year", () => {
    const result = analyzeDashboard(
      slice({
        referenceDate: "2026-01-31",
        facts: [
          fact({ date: "2025-10-31", count: 10 }),
          fact({ date: "2025-11-30", count: 20 }),
          fact({ date: "2025-12-31", count: 30 }),
          fact({ date: "2026-01-31", count: 900 }),
        ],
      }),
      emptyDashboardFilters(),
    );
    expect(result.metrics.opportunities.yearClosedMonthsAverage).toBeNull();
    expect(result.metrics.opportunities.lastThreeClosedMonthsAverage).toBe(20);
    expect(result.metrics.opportunities.previousMonth).toBe(30);
    expect(result.history["year-average"]).toEqual([]);
    expect(result.history["three-month-average"].map((month) => month.month)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
  });

  it("preserves null for periods before coverage while current covered periods remain zero", () => {
    const result = analyzeDashboard(
      slice({ coverageStart: "2026-10-01", referenceDate: "2026-10-05", facts: [] }),
      emptyDashboardFilters(),
    );
    const metrics = result.metrics.opportunities;
    expect(metrics.currentMonth).toBe(0);
    expect(metrics.currentToday).toBe(0);
    expect(metrics.previousMonth).toBeNull();
    expect(metrics.previousWeek).toBeNull();
    expect(metrics.lastSevenDays).toBeNull();
    expect(metrics.lastFourteenDays).toBeNull();
    expect(metrics.previousSevenDays).toBeNull();
    expect(metrics.previousFourteenDays).toBeNull();
    expect(metrics.yearClosedMonthsAverage).toBeNull();
    expect(metrics.lastThreeClosedMonthsAverage).toBeNull();
  });

  it.each(["yearClosedMonthsAverage", "lastThreeClosedMonthsAverage"] as const)(
    "keeps %s null with incomplete coverage",
    (metric) => {
      const result = analyzeDashboard(
        slice({
          coverageStart: "2026-08-01",
          facts: [fact({ date: "2026-08-01", count: 10 }), fact({ date: "2026-09-30", count: 30 })],
        }),
        emptyDashboardFilters(),
      );
      expect(result.metrics.opportunities[metric]).toBeNull();
      const historyKey =
        metric === "yearClosedMonthsAverage" ? "year-average" : "three-month-average";
      expect(result.history[historyKey]).toEqual([]);
      expect(result.metrics.opportunities.previousMonth).toBe(30);
    },
  );
});

describe("dashboard analysis contract", () => {
  it("accepts valid synthetic snapshots and a selected view with full slice metadata", () => {
    expect(dashboardAnalysisSchema.safeParse(analysis()).success).toBe(true);
    expect(dashboardAnalysisSliceSchema.safeParse(slice()).success).toBe(true);
    expect(
      dashboardAnalysisSliceSchema.safeParse(
        slice({ facts: [fact({ manager: -1, owner: -1, company: -1, development: -1 })] }),
      ).success,
    ).toBe(true);
  });

  it.each([
    [0, -1],
    [0, 5],
    [0, 0.5],
    [1, "2026-02-30"],
    [1, "2026-10-01T00:00:00Z"],
    [2, -2],
    [2, 10_000],
    [2, 0.5],
    [3, -2],
    [4, 10_000],
    [5, -1],
    [5, 2],
    [6, 10_000],
    [7, 0],
    [7, -1],
    [7, 1.5],
    [7, 1_000_000_001],
    [8, -1],
    [8, Infinity],
    [8, NaN],
    [8, 1_000_000_000_000_001],
    [9, -1],
    [9, 0.5],
    [9, 1_000_000_001],
  ])("rejects tuple bounds/date at index %s with value %s", (position, value) => {
    const invalid: unknown[] = fact();
    invalid[position as number] = value;
    expect(dashboardAnalysisFactSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts inclusive numeric bounds and rejects extra or missing tuple entries", () => {
    expect(
      dashboardAnalysisFactSchema.safeParse(
        fact({
          stage: 4,
          manager: 9_999,
          owner: -1,
          channel: 1,
          count: 1_000_000_000,
          amount: 1_000_000_000_000_000,
          approved: 1_000_000_000,
        }),
      ).success,
    ).toBe(true);
    expect(dashboardAnalysisFactSchema.safeParse([...fact(), 0]).success).toBe(true);
    expect(dashboardAnalysisFactSchema.safeParse([...fact(), 0, 0]).success).toBe(false);
    expect(dashboardAnalysisFactSchema.safeParse(fact().slice(0, -1)).success).toBe(false);
  });

  it("requires v2 store dictionaries and tuples together while preserving v1", () => {
    const value = slice();
    value.version = 2;
    value.dimensions.stores = ["Loja A", "Loja B"];
    value.facts = [
      [1, "2026-10-15", 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [1, "2026-10-15", 0, 0, 0, 0, 0, 1, 0, 0, 1],
    ];
    expect(dashboardAnalysisSliceSchema.safeParse(value).success).toBe(true);
    expect(dashboardAnalysisSliceSchema.safeParse({ ...value, version: 1 }).success).toBe(false);
    expect(
      dashboardAnalysisSliceSchema.safeParse({ ...value, facts: [fact({ stage: 1 })] }).success,
    ).toBe(false);
    expect(
      dashboardAnalysisSliceSchema.safeParse({ ...value, facts: [[...fact({ stage: 1 }), 2]] })
        .success,
    ).toBe(false);
    expect(
      dashboardAnalysisSliceSchema.safeParse({ ...value, facts: [[...fact({ stage: 0 }), 0]] })
        .success,
    ).toBe(false);
    expect(dashboardAnalysisSliceSchema.safeParse(slice()).success).toBe(true);
  });

  it.each([2, 3, 4, 6])(
    "rejects dictionary index %s outside this view even if tuple bounds allow it",
    (position) => {
      const value = slice();
      value.facts = [fact()];
      value.facts[0]![position] = 9_999;
      expect(dashboardAnalysisSliceSchema.safeParse(value).success).toBe(false);
    },
  );

  it("rejects duplicate dictionary labels after trimming and empty/oversized labels", () => {
    for (const labels of [["Gerente A", " Gerente A "], [" "], ["a".repeat(201)]]) {
      const value = slice();
      value.dimensions.managers = labels;
      expect(dashboardAnalysisSliceSchema.safeParse(value).success).toBe(false);
    }
  });

  it("rejects duplicate aggregate keys even if counts differ, without collapsing distinct dates/stages", () => {
    expect(
      dashboardAnalysisSliceSchema.safeParse(slice({ facts: [fact(), fact({ count: 9 })] }))
        .success,
    ).toBe(false);
    expect(
      dashboardAnalysisSliceSchema.safeParse(
        slice({ facts: [fact(), fact({ date: "2026-10-16" }), fact({ stage: 1 })] }),
      ).success,
    ).toBe(true);
  });

  it.each([
    { invalid: fact({ stage: 3, count: 1, approved: 2 }) },
    { invalid: fact({ stage: 0, approved: 1 }) },
    { invalid: fact({ stage: 2, amount: 1 }) },
  ])("rejects counts/amounts incompatible with the aggregate stage", ({ invalid }) => {
    expect(dashboardAnalysisSliceSchema.safeParse(slice({ facts: [invalid] })).success).toBe(false);
  });

  it("requires the three unique views and strict known metadata", () => {
    const valid = analysis();
    expect(
      dashboardAnalysisSchema.safeParse({ ...valid, views: valid.views.slice(0, 2) }).success,
    ).toBe(false);
    expect(
      dashboardAnalysisSchema.safeParse({ ...valid, views: [...valid.views, valid.views[0]] })
        .success,
    ).toBe(false);
    expect(
      dashboardAnalysisSchema.safeParse({
        ...valid,
        views: [valid.views[0], valid.views[0], valid.views[2]],
      }).success,
    ).toBe(false);
    expect(dashboardAnalysisSchema.safeParse({ ...valid, version: 2 }).success).toBe(false);
    expect(dashboardAnalysisSchema.safeParse({ ...valid, unexpected: true }).success).toBe(false);
    expect(
      dashboardAnalysisViewSchema.safeParse({ ...valid.views[0], unexpected: true }).success,
    ).toBe(false);
  });

  it.each([
    { coverageStart: "2026-11-01" },
    { coverageStart: "2025-10-02" },
    { referenceDate: "2026-02-30" },
    { facts: [fact({ date: "2025-09-30" })] },
    { facts: [fact({ date: "2026-11-01" })] },
  ])("rejects invalid coverage in both complete snapshots and slices: %j", (invalid) => {
    expect(dashboardAnalysisSliceSchema.safeParse({ ...slice(), ...invalid }).success).toBe(false);
    const value = analysis();
    if ("facts" in invalid) value.views[0]!.facts = invalid.facts!;
    else Object.assign(value, invalid);
    expect(dashboardAnalysisSchema.safeParse(value).success).toBe(false);
  });

  it.each(["version", "coverageStart", "referenceDate"])(
    "rejects missing slice metadata %s",
    (key) => {
      const value: Record<string, unknown> = { ...slice() };
      delete value[key];
      expect(dashboardAnalysisSliceSchema.safeParse(value).success).toBe(false);
    },
  );

  it("accepts dates exactly on coverage boundaries and rejects unknown slice metadata", () => {
    const value = slice({ facts: [fact({ date: "2025-10-01" }), fact({ date: "2026-10-31" })] });
    expect(dashboardAnalysisSliceSchema.safeParse(value).success).toBe(true);
    expect(dashboardAnalysisSliceSchema.safeParse({ ...value, sliceMetadata: {} }).success).toBe(
      false,
    );
  });

  it("enforces maximum dictionary and aggregate sizes explicitly", () => {
    const dictionary = slice();
    dictionary.dimensions.owners = Array.from(
      { length: 10_001 },
      (_, index) => `Corretor ${index}`,
    );
    const labels = dashboardAnalysisSliceSchema.safeParse(dictionary);
    expect(labels.success).toBe(false);
    if (!labels.success)
      expect(
        labels.error.issues.some(
          (issue) => issue.code === "too_big" && issue.path.join(".") === "dimensions.owners",
        ),
      ).toBe(true);
    const rows = dashboardAnalysisSliceSchema.safeParse(
      slice({ facts: Array(100_001).fill(fact()) }),
    );
    expect(rows.success).toBe(false);
    if (!rows.success)
      expect(
        rows.error.issues.some(
          (issue) => issue.code === "too_big" && issue.path.join(".") === "facts",
        ),
      ).toBe(true);
  });

  it("uses the folder Status aggregate for approved folders in current and closed periods", () => {
    const result = analyzeDashboard(
      slice({
        facts: [
          fact({ stage: 3, date: "2026-09-10", count: 4, approved: 3 }),
          fact({ stage: 3, date: "2026-10-13", count: 5, approved: 2 }),
        ],
      }),
      emptyDashboardFilters(),
    );
    expect(
      result.periodReadings.month.find((reading) => reading.key === "approved-folders")?.value,
    ).toBe(2);
    expect(
      result.history.previous[0]?.readings.find((reading) => reading.key === "approved-folders")
        ?.value,
    ).toBe(3);
  });
});
