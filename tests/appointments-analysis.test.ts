import { describe, expect, it } from "vitest";

import type {
  DashboardAnalysisFact,
  DashboardAnalysisSlice,
} from "@/lib/crm/dashboard/analysis-contract";
import {
  type AppointmentFilters,
  analyzeAppointments,
  appointmentMonthlyGoal,
  appointmentWeekOfMonth,
  appointmentYears,
  plannedAppointmentsForDate,
  normalizeAppointmentCreatedDates,
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
  stage: 0 | 1 | 2 | 3 | 4,
  count: number,
  manager = 0,
  owner = 0,
  company = 0,
  channel: 0 | 1 = 1,
  approved = 0,
): DashboardAnalysisFact {
  return [stage, "2026-10-19", manager, owner, company, channel, 0, count, 0, approved, -1];
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
  const goalRoster = [
    { key: "a", owner: "Responsável A", manager: "Gerente A" },
    { key: "b", owner: "Responsável B", manager: "Gerente B" },
  ];
  const goalSlice = (overrides: Partial<DashboardAnalysisSlice> = {}) =>
    slice({
      version: 4,
      viewKey: "without_canal_imob",
      brokerCount: 99,
      appointments: [],
      facts: [],
      ...overrides,
    });
  const goalOptions = {
    brokerRoster: goalRoster,
    goalsByMonth: { "2026-09": 17, "2026-10": 29 },
  };

  it("applies inclusive exact period boundaries without changing explicit-day intersections", () => {
    const filters = { periodStart: "2026-10-04", periodEnd: "2026-10-15" };
    const result = analyzeAppointments(slice(), { filters });
    expect(result.total).toBe(11);
    expect(result.daily.map(({ key }) => key)).toEqual(["2026-10-04", "2026-10-05", "2026-10-15"]);
    expect(result.selectedCoveredDays).toBe(12);

    const selectedDays = analyzeAppointments(slice(), {
      filters: {
        ...filters,
        createdDates: ["2026-10-04", "2026-10-15", "2026-10-19"],
      },
    });
    expect(selectedDays.total).toBe(4);
    expect(selectedDays.daily.map(({ key }) => key)).toEqual(["2026-10-04", "2026-10-15"]);
  });

  it("filters an inclusive quarter across month boundaries", () => {
    const input = slice({
      facts: [
        fact("2026-06-30", 1),
        fact("2026-07-01", 2),
        fact("2026-08-15", 4),
        fact("2026-09-30", 3),
        fact("2026-10-01", 8),
      ],
    });
    const result = analyzeAppointments(input, {
      filters: { periodStart: "2026-07-01", periodEnd: "2026-09-30" },
    });
    expect(result.total).toBe(9);
    expect(result.daily.map(({ key }) => key)).toEqual(["2026-07-01", "2026-08-15", "2026-09-30"]);
    expect(result.selectedCoveredDays).toBe(92);
  });

  it("filters the current year through the reference date", () => {
    const result = analyzeAppointments(slice(), {
      filters: { periodStart: "2026-01-01", periodEnd: "2026-10-19" },
    });
    expect(result.total).toBe(23);
    expect(result.daily.map(({ key }) => key)).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-10-04",
      "2026-10-05",
      "2026-10-15",
    ]);
    expect(result.selectedCoveredDays).toBe(292);
  });

  it("sums real Monday-Sunday dates, including partial boundary weeks and zero-actual days", () => {
    const result = analyzeAppointments(goalSlice(), goalOptions);
    expect(result.daily).toHaveLength(19);
    expect(result.daily.find(({ key }) => key === "2026-10-01")).toMatchObject({
      total: 0,
      goal: 4,
    });
    expect(result.daily.find(({ key }) => key === "2026-10-03")?.goal).toBe(0);
    expect(result.weekly.map(({ goal }) => goal)).toEqual([6, 12, 12, 12]);
    expect(result.todayGoal).toBe(2);
    expect(result.plannedToday).toBe(2);
    expect(result.monthlyGoal).toBe(58);
    expect(result.goalBrokerCount).toBe(2);
    expect(result.monthly.map(({ key, goal }) => [key, goal])).toEqual([
      ["09", 34],
      ["10", 58],
    ]);
    expect(result.daily.reduce((sum, bucket) => sum + bucket.goal!, 0)).toBe(32);
  });

  it("intersects date/week filters and uses the deduplicated filtered roster", () => {
    const result = analyzeAppointments(goalSlice(), {
      ...goalOptions,
      brokerRoster: [...goalRoster, goalRoster[0]!],
      filters: {
        manager: "Gerente A",
        week: 2,
        createdDates: ["2026-10-05", "2026-10-08", "2026-10-15"],
      },
    });
    expect(result.daily.map(({ key, goal }) => [key, goal])).toEqual([
      ["2026-10-05", 1],
      ["2026-10-08", 2],
    ]);
    expect(result.weekly).toEqual([{ key: "2", label: "2ª semana", total: 0, goal: 3 }]);
    expect(result.todayGoal).toBeNull();
    expect(result.monthlyGoal).toBe(29);
    expect(result.monthly.map(({ goal }) => goal)).toEqual([17, 29]);
  });

  it.each([
    ["2024-02", 29, [6, 12, 12, 12, 10]],
    ["2026-02", 28, [0, 12, 12, 12, 12]],
    ["2026-03", 31, [0, 12, 12, 12, 12, 4]],
  ])("handles leap years and six-week months: %s", (month, days, expected) => {
    const result = analyzeAppointments(
      goalSlice({ coverageStart: `${month}-01`, referenceDate: `${month}-${days}` }),
      {
        ...goalOptions,
        goalsByMonth: { [month]: 31 },
      },
    );
    expect(result.daily).toHaveLength(days);
    expect(result.weekly.map(({ goal }) => goal)).toEqual(expected);
  });

  it("keeps missing, Imob, mixed-channel and unmappable cohort goals null", () => {
    for (const filters of [
      { channel: 0 as const },
      { company: "Empresa A" },
      { accountRanking: "Ouro" },
    ]) {
      const result = analyzeAppointments(goalSlice(), { ...goalOptions, filters });
      expect(result.monthlyGoal).toBeNull();
      expect(result.todayGoal).toBeNull();
    }
    expect(analyzeAppointments(goalSlice(), { brokerRoster: goalRoster }).monthlyGoal).toBeNull();
    expect(analyzeAppointments(goalSlice({ viewKey: "all" }), goalOptions).monthlyGoal).toBeNull();
    expect(
      analyzeAppointments(goalSlice({ viewKey: "with_canal_imob" }), goalOptions).todayGoal,
    ).toBeNull();
    expect(
      analyzeAppointments(goalSlice({ viewKey: "all" }), {
        ...goalOptions,
        filters: { channel: 1 },
      }).monthlyGoal,
    ).toBe(58);
    expect(
      analyzeAppointments(goalSlice(), {
        goalsByMonth: goalOptions.goalsByMonth,
        filters: { owner: "Responsável A" },
      }).todayGoal,
    ).toBeNull();
  });

  it("preserves configured zero and empty roster while never backfilling missing month policies", () => {
    const zero = analyzeAppointments(goalSlice(), { ...goalOptions, brokerRoster: [] });
    expect(zero.todayGoal).toBe(0);
    expect(zero.monthlyGoal).toBe(0);
    const missing = analyzeAppointments(goalSlice(), {
      ...goalOptions,
      goalsByMonth: { "2026-09": 0 },
    });
    expect(missing.monthlyGoal).toBeNull();
    expect(missing.todayGoal).toBe(2);
    expect(missing.monthly).toEqual([{ key: "09", label: "Setembro", total: 0, goal: 0 }]);
  });
  it("uses the authorized daily policy without a monthly registration and never paints future days", () => {
    const result = analyzeAppointments(goalSlice(), { brokerRoster: goalRoster });
    expect(result.monthlyGoal).toBeNull();
    expect(result.todayGoal).toBe(2);
    expect(result.plannedToday).toBe(2);
    expect(result.daily.at(-1)?.key).toBe("2026-10-19");
    expect(result.daily.some(({ key }) => key > "2026-10-19")).toBe(false);
    expect(result.weekly.map(({ key, goal }) => [key, goal])).toEqual([
      ["1", 6],
      ["2", 12],
      ["3", 12],
      ["4", 12],
    ]);
  });

  it("keeps the full boundary week target on the first Thursday but no later weeks", () => {
    const result = analyzeAppointments(goalSlice({ referenceDate: "2026-10-01" }), goalOptions);
    expect(result.daily).toEqual([{ key: "2026-10-01", label: "01", total: 0, goal: 4 }]);
    expect(result.todayGoal).toBe(4);
    expect(result.weekly).toEqual([{ key: "1", label: "1ª semana", total: 0, goal: 6 }]);
  });

  it("clips daily coverage but sums the entire intersecting week within the month", () => {
    const input = goalSlice({ coverageStart: "2026-10-21", referenceDate: "2026-10-22" });
    const result = analyzeAppointments(input, goalOptions);
    expect(result.daily.map(({ key, goal }) => [key, goal])).toEqual([
      ["2026-10-21", 2],
      ["2026-10-22", 4],
    ]);
    expect(result.weekly).toEqual([{ key: "4", label: "4ª semana", total: 0, goal: 12 }]);
    const selected = analyzeAppointments(input, {
      ...goalOptions,
      filters: { createdDates: ["2026-10-22"], week: 4 },
    });
    expect(selected.weekly[0]?.goal).toBe(4);
    expect(analyzeAppointments(input, { ...goalOptions, filters: { week: 5 } }).weekly).toEqual([]);
    expect(analyzeAppointments(input, { ...goalOptions, month: "2026-11" }).daily).toEqual([]);
    expect(analyzeAppointments(input, { ...goalOptions, month: "2026-11" }).weekly).toEqual([]);
  });

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

  it("uses the same covered date/week intersection for actual and goal averages", () => {
    const appointment = {
      createdAt: "2026-10-19T12:00:00Z",
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: false,
      regionalManager: "Regional A",
      salesManager: "Gerente A",
      owner: "Responsável A",
      accountName: "Conta A",
      accountRanking: "Ouro",
      channel: 1 as const,
      company: "Empresa A",
      registeredBroker: true,
    };
    const input = goalSlice({ referenceDate: "2026-10-25", appointments: [appointment] });
    const week = analyzeAppointments(input, { ...goalOptions, filters: { week: 4 } });
    expect(week.selectedCoveredDays).toBe(7);
    expect(week.dailyAverage).toBeCloseTo(1 / 7);
    expect(week.dailyAverageGoal).toBeCloseTo(12 / 7);
    const intersection = analyzeAppointments(input, {
      ...goalOptions,
      filters: { week: 4, createdDates: ["2026-10-15", "2026-10-19", "2026-10-22", "2026-10-24"] },
    });
    expect(intersection.selectedCoveredDays).toBe(3);
    expect(intersection.dailyAverage).toBeCloseTo(1 / 3);
    expect(intersection.dailyAverageGoal).toBe(2); // (2 + 4 + 0) / 3.
    const partial = analyzeAppointments(
      { ...input, referenceDate: "2026-10-19" },
      {
        ...goalOptions,
        filters: { week: 4 },
      },
    );
    expect(partial.selectedCoveredDays).toBe(1);
    expect(partial.dailyAverageGoal).toBe(2);
    expect(partial.weekly[0]?.goal).toBe(12); // Week target still includes future weekdays.
  });

  it("keeps empty/unknown average goals null and known weekend or empty-roster goals zero", () => {
    const empty = analyzeAppointments(goalSlice(), { ...goalOptions, filters: { week: 5 } });
    expect(empty.dailyAverage).toBeNull();
    expect(empty.dailyAverageGoal).toBeNull();
    expect(
      analyzeAppointments(goalSlice({ viewKey: "with_canal_imob" }), goalOptions).dailyAverageGoal,
    ).toBeNull();
    expect(
      analyzeAppointments(goalSlice(), { ...goalOptions, filters: { company: "Empresa A" } })
        .dailyAverageGoal,
    ).toBeNull();
    expect(
      analyzeAppointments(goalSlice(), { ...goalOptions, brokerRoster: [] }).dailyAverageGoal,
    ).toBe(0);
    expect(
      analyzeAppointments(goalSlice(), {
        ...goalOptions,
        filters: { createdDates: ["2026-10-18"] },
      }).dailyAverageGoal,
    ).toBe(0);
  });

  it("resolves yesterday's Thursday/weekend target and respects filters and coverage", () => {
    expect(
      analyzeAppointments(goalSlice({ referenceDate: "2026-10-23" }), goalOptions).yesterdayGoal,
    ).toBe(4);
    expect(analyzeAppointments(goalSlice(), goalOptions).yesterdayGoal).toBe(0);
    expect(
      analyzeAppointments(goalSlice(), {
        ...goalOptions,
        filters: { createdDates: ["2026-10-19"] },
      }).yesterdayGoal,
    ).toBeNull();
    expect(
      analyzeAppointments(goalSlice({ coverageStart: "2026-10-19" }), goalOptions).yesterdayGoal,
    ).toBeNull();
    expect(
      analyzeAppointments(goalSlice({ viewKey: "with_canal_imob" }), goalOptions).yesterdayGoal,
    ).toBeNull();
  });

  it("never divides unfiltered conversions by ranking-filtered appointments", () => {
    const appointment = (accountRanking: string) => ({
      createdAt: "2026-10-19T12:00:00Z",
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: true,
      regionalManager: "Regional A",
      salesManager: "Gerente A",
      owner: "Responsável A",
      accountName: "Conta A",
      accountRanking,
      channel: 1 as const,
      company: "Empresa A",
      registeredBroker: true,
    });
    const input = goalSlice({
      facts: [stageFact(1, 2), stageFact(2, 2), stageFact(4, 1)],
      appointments: [appointment("Ouro"), appointment("Prata")],
    });
    const filtered = analyzeAppointments(input, {
      ...goalOptions,
      filters: { accountRanking: "Ouro" },
    });
    expect(filtered.total).toBe(1);
    expect(filtered.details).toHaveLength(1);
    expect(filtered.performedToday).toBe(1);
    expect(filtered.conversionAvailable).toBe(false);
    expect(filtered.funnel).toBeNull();
    expect(filtered.visitsPerformed).toBeNull();
    expect(filtered.sales).toBeNull();
    expect(filtered.conversionRankings).toEqual({ owners: [], managers: [], regionalManagers: [] });
    const unfiltered = analyzeAppointments(input, goalOptions);
    expect(unfiltered.conversionAvailable).toBe(true);
    expect(unfiltered.visitsPerformed).toBe(2);
    expect(unfiltered.conversionRankings.owners[0]?.percent).toBe(100);
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
    expect(result.brokerCount).toBeNull(); // A mixed view has no authoritative House cohort.
    expect(result.plannedToday).toBeNull(); // No authorized monthly goal/channel supplied.
    expect(result.performedToday).toBe(1);
    expect(result.details).toHaveLength(2);
    expect(
      result.details?.map(({ accountName, daysSinceAppointment }) => [
        accountName,
        daysSinceAppointment,
      ]),
    ).toEqual([
      ["Conta A", 0],
      ["Conta B", 1],
    ]);
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

  it("combines all dashboard filters across funnel, productive team and details in v4", () => {
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
      regionalManager: salesManager === "Gerente A" ? "Regional A" : "Regional B",
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
        stageFact(3, 2, 0, 0, 0, 1, 1),
        stageFact(4, 1),
        stageFact(0, 20, 1, 1, 1, 0),
        stageFact(1, 8, 1, 1, 1, 0),
        stageFact(2, 4, 1, 1, 1, 0),
        stageFact(3, 3, 1, 1, 1, 0, 1),
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
        regionalManager: "Regional A",
        manager: "Gerente A",
        owner: "Responsável A",
        company: "Empresa A",
      },
      brokerRoster: [
        { key: "broker-a", owner: "Responsável A", manager: "Gerente A" },
        { key: "broker-a-inativo", owner: "Responsável sem atividade", manager: "Gerente A" },
        { key: "broker-b", owner: "Responsável B", manager: "Gerente B" },
        { key: "broker-b-inativo", owner: "Outro sem atividade", manager: "Gerente B" },
      ],
    });
    expect(result.total).toBe(2);
    expect(result.details).toHaveLength(2);
    expect(result.funnel).toEqual({
      opportunities: 9,
      appointments: 3,
      visits: 2,
      folders: 2,
      approvedFolders: 1,
      sales: 1,
    });
    expect(result.brokerCount).toBeNull(); // Company is absent from the registered roster.
    expect(result.plannedToday).toBeNull(); // Company cannot be mapped to the registered roster.
    expect(result.productiveBrokers).toBe(1);
    expect(result.productivePercent).toBeNull();
    expect(result.registeredManagerCount).toBeNull();
    expect(result.visitsPerformed).toBe(2);
    expect(result.sales).toBe(1);
    expect(result.filterOptions.regionalManagers).toEqual(["Regional A", "Regional B"]);
    expect(result.conversionRankings.owners[0]).toMatchObject({
      label: "Responsável A",
      appointments: 3,
      visits: 2,
    });
    expect(result.conversionRankings.regionalManagers[0]).toMatchObject({
      label: "Regional A",
      appointments: 3,
      visits: 2,
    });
    expect(result.filterOptions.channels).toEqual([
      { key: 1, label: "House" },
      { key: 0, label: "Imob" },
    ]);

    const imob = analyzeAppointments(input, { filters: { channel: 0 } });
    expect(imob.funnel).toEqual({
      opportunities: 20,
      appointments: 8,
      visits: 4,
      folders: 3,
      approvedFolders: 1,
      sales: 2,
    });

    const managerOnly = analyzeAppointments(input, {
      filters: { manager: "Gerente A", channel: 1 },
      brokerRoster: [
        { key: "broker-a", owner: "Responsável A", manager: "Gerente A" },
        { key: "broker-a-inativo", owner: "Responsável sem atividade", manager: "Gerente A" },
        { key: "broker-b", owner: "Responsável B", manager: "Gerente B" },
      ],
    });
    expect(managerOnly.brokerCount).toBe(2);
    expect(managerOnly.registeredManagerCount).toBe(1);
    expect(managerOnly.productiveBrokers).toBe(1);
    expect(managerOnly.productivePercent).toBe(50);
  });

  it("does not infer a filtered registered roster from appointment activity", () => {
    const input = slice({
      version: 4,
      brokerCount: 4,
      brokerManagerCount: 2,
      dimensions: { ...slice().dimensions, companies: [], stores: [] },
      appointments: [],
    });
    const result = analyzeAppointments(input, { filters: { manager: "Gerente A" } });
    expect(result.brokerCount).toBeNull();
    expect(result.registeredManagerCount).toBeNull();
  });

  it("never substitutes active brokers for an unmappable company, ranking or channel roster", () => {
    const input = goalSlice({ brokerCount: 4, brokerManagerCount: 2 });
    for (const filters of [
      { company: "Empresa A" },
      { accountRanking: "Ouro" },
      { channel: 0 as const },
    ]) {
      const result = analyzeAppointments(input, { brokerRoster: goalRoster, filters });
      expect(result.rosterUnavailableReason).toBe("unsupported-dimensions");
      expect(result.brokerCount).toBeNull();
      expect(result.registeredManagerCount).toBeNull();
      expect(result.productivePercent).toBeNull();
      expect(result.goalBrokerCount).toBeNull();
    }
    const house = analyzeAppointments(input, { brokerRoster: goalRoster });
    expect(house.brokerCount).toBe(4);
    expect(house.registeredManagerCount).toBe(2);
    expect(house.rosterUnavailableReason).toBeNull();
  });

  const historicalRegionalAppointment = (date: string, regionalManager: string) => ({
    createdAt: `${date}T12:00:00-03:00`,
    scheduledAt: null,
    attendedAt: null,
    visitPerformed: false,
    regionalManager,
    salesManager: "Gerente A",
    owner: "Responsável A",
    accountName: "Conta sintética",
    accountRanking: "Ouro",
    channel: 1 as const,
    company: "Empresa A",
    registeredBroker: true,
  });
  const historicalRegionalSlice = () =>
    goalSlice({
      coverageStart: "2026-09-01",
      brokerCount: 2,
      brokerManagerCount: 1,
      dimensions: {
        managers: ["Gerente A"],
        owners: ["Responsável A"],
        companies: ["Empresa A"],
        developments: [],
        stores: [],
      },
      facts: [
        [1, "2026-09-19", 0, 0, 0, 1, -1, 2, 0, 0, -1],
        [2, "2026-09-19", 0, 0, 0, 1, -1, 1, 0, 0, -1],
        [1, "2026-10-19", 0, 0, 0, 1, -1, 3, 0, 0, -1],
        [2, "2026-10-19", 0, 0, 0, 1, -1, 2, 0, 0, -1],
      ],
      appointments: [
        historicalRegionalAppointment("2026-09-19", "Regional Antiga"),
        historicalRegionalAppointment("2026-10-19", "Regional Nova"),
      ],
    });

  it("keeps historical regional filters, rows, facts and roster on the same dated link", () => {
    const input = historicalRegionalSlice();
    const brokerRoster = [
      { key: "a", owner: "Responsável A", manager: "Gerente A" },
      { key: "inactive", owner: "Sem atividade", manager: "Gerente A" },
    ];
    const oldRegion = analyzeAppointments(input, {
      month: "2026-09",
      filters: { regionalManager: "Regional Antiga", createdDates: ["2026-09-19"] },
      brokerRoster,
    });
    expect(oldRegion.total).toBe(1);
    expect(oldRegion.details?.map((row) => row.regionalManager)).toEqual(["Regional Antiga"]);
    expect(oldRegion.funnel?.appointments).toBe(2);
    expect(oldRegion.conversionRankings.regionalManagers).toMatchObject([
      { label: "Regional Antiga", appointments: 2, visits: 1 },
    ]);
    expect(oldRegion.brokerCount).toBe(2); // Includes the registered broker with no activity.
    expect(oldRegion.registeredManagerCount).toBe(1);
    expect(oldRegion.productivePercent).toBe(50);
    const futureRegion = analyzeAppointments(input, {
      month: "2026-09",
      filters: { regionalManager: "Regional Nova", createdDates: ["2026-09-19"] },
      brokerRoster,
    });
    expect(futureRegion.total).toBe(0);
    expect(futureRegion.regionalManagers).toEqual([]);
    expect(futureRegion.funnel?.appointments).toBe(0);
    expect(futureRegion.brokerCount).toBe(0);
    expect(oldRegion.filterOptions.regionalManagers).toEqual(["Regional Antiga", "Regional Nova"]);
  });

  it("does not use a future link for facts or an unknown link for the registered roster", () => {
    const input = historicalRegionalSlice();
    input.appointments = input.appointments!.filter((row) => row.createdAt.startsWith("2026-10"));
    const result = analyzeAppointments(input, {
      month: "2026-09",
      filters: { regionalManager: "Regional Nova" },
      brokerRoster: goalRoster,
    });
    expect(result.regionalFactsAvailable).toBe(false);
    expect(result.conversionAvailable).toBe(false);
    expect(result.funnel).toBeNull();
    expect(result.conversionRankings.regionalManagers).toEqual([]);
    expect(result.rosterUnavailableReason).toBe("unknown-regional-link");
    expect(result.brokerCount).toBeNull();
  });

  it("does not arbitrarily assign daily facts with conflicting regional observations", () => {
    const input = historicalRegionalSlice();
    input.appointments!.push(historicalRegionalAppointment("2026-09-19", "Regional Nova"));
    const result = analyzeAppointments(input, {
      month: "2026-09",
      filters: { regionalManager: "Regional Antiga" },
      brokerRoster: [goalRoster[0]!],
    });
    expect(result.details?.map((row) => row.regionalManager)).toEqual(["Regional Antiga"]);
    expect(result.regionalFactsAvailable).toBe(false);
    expect(result.funnel).toBeNull();
    expect(result.brokerCount).toBeNull();
    expect(result.rosterUnavailableReason).toBe("unknown-regional-link");
  });

  it("withholds regional denominators across a transfer while preserving both regions' activity", () => {
    const input = historicalRegionalSlice();
    input.referenceDate = "2026-10-31";
    input.appointments = [
      historicalRegionalAppointment("2026-10-05", "Regional Antiga"),
      historicalRegionalAppointment("2026-10-20", "Regional Nova"),
    ];
    const brokerRoster = [goalRoster[0]!];
    for (const regionalManager of ["Regional Antiga", "Regional Nova"]) {
      const result = analyzeAppointments(input, {
        month: "2026-10",
        filters: { regionalManager, periodStart: "2026-10-05", periodEnd: "2026-10-25" },
        brokerRoster,
        goalsByMonth: { "2026-10": 24 },
      });
      expect(result.total).toBe(1);
      expect(result.productiveBrokers).toBe(1);
      expect(result.details?.map((row) => row.regionalManager)).toEqual([regionalManager]);
      expect(result.rosterUnavailableReason).toBe("unknown-regional-link");
      expect(result.brokerCount).toBeNull();
      expect(result.registeredManagerCount).toBeNull();
      expect(result.goalBrokerCount).toBeNull();
      expect(result.monthlyGoal).toBeNull();
      expect(result.dailyAverageGoal).toBeNull();
      expect(result.productivePercent).toBeNull();
    }
    const unknownBeginning = analyzeAppointments(input, {
      month: "2026-10",
      filters: { regionalManager: "Regional Antiga" },
      brokerRoster,
    });
    expect(unknownBeginning.rosterUnavailableReason).toBe("unknown-regional-link");
    for (const [regionalManager, periodStart, periodEnd] of [
      ["Regional Antiga", "2026-10-05", "2026-10-19"],
      ["Regional Nova", "2026-10-20", "2026-10-25"],
    ] as const) {
      const stable = analyzeAppointments(input, {
        filters: { regionalManager, periodStart, periodEnd },
        brokerRoster,
      });
      expect(stable.brokerCount).toBe(1);
      expect(stable.productivePercent).toBe(100);
      expect(stable.rosterUnavailableReason).toBeNull();
    }
  });

  it("checks regional roster stability only across covered days selected by calendar, week and range", () => {
    const input = historicalRegionalSlice();
    input.referenceDate = "2026-10-31";
    input.appointments = [
      historicalRegionalAppointment("2026-10-05", "Regional Antiga"),
      historicalRegionalAppointment("2026-10-20", "Regional Nova"),
    ];
    const brokerRoster = [goalRoster[0]!];
    const resultFor = (filters: AppointmentFilters) =>
      analyzeAppointments(input, { month: "2026-10", brokerRoster, filters });
    expect(
      resultFor({ regionalManager: "Regional Antiga", createdDates: ["2026-10-05", "2026-10-20"] })
        .brokerCount,
    ).toBeNull();
    expect(
      resultFor({ regionalManager: "Regional Antiga", createdDates: ["2026-10-06", "2026-10-10"] })
        .brokerCount,
    ).toBe(1);
    expect(
      resultFor({ regionalManager: "Regional Nova", createdDates: ["2026-10-22", "2026-10-24"] })
        .brokerCount,
    ).toBe(1);
    expect(resultFor({ regionalManager: "Regional Antiga", week: 3 }).brokerCount).toBe(1);
    expect(resultFor({ regionalManager: "Regional Antiga", week: 4 }).brokerCount).toBeNull();
    expect(
      resultFor({
        regionalManager: "Regional Antiga",
        periodStart: "2026-10-05",
        periodEnd: "2026-10-19",
        createdDates: ["2026-10-05", "2026-10-20"],
      }).brokerCount,
    ).toBe(1);
    expect(
      resultFor({
        regionalManager: "Regional Nova",
        week: 5,
        createdDates: ["2026-10-19", "2026-10-28"],
      }).brokerCount,
    ).toBe(1);
  });

  it("normalizes multiple selected days and applies them to details and funnel facts", () => {
    expect(
      normalizeAppointmentCreatedDates(
        ["2026-10-19", "invalid", "2026-10-18", "2026-10-19", "2026-10-20"],
        "2026-10-01",
        "2026-10-19",
      ),
    ).toEqual(["2026-10-18", "2026-10-19"]);
    const appointment = (date: string) => ({
      createdAt: `${date}T12:00:00-03:00`,
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: false,
      regionalManager: "Regional A",
      salesManager: "Gerente A",
      owner: "Responsável A",
      accountName: "Conta A",
      accountRanking: "Ouro",
      channel: 1 as const,
      company: "Empresa A",
      registeredBroker: true,
    });
    const input = slice({
      version: 4,
      brokerCount: 10,
      brokerManagerCount: 3,
      dimensions: {
        managers: ["Gerente A"],
        owners: ["Responsável A"],
        companies: ["Empresa A"],
        developments: ["Residencial A"],
        stores: ["Loja A"],
      },
      facts: [
        [0, "2026-10-17", 0, 0, 0, 1, 0, 90, 0, 0, -1],
        [0, "2026-10-18", 0, 0, 0, 1, 0, 18, 0, 0, -1],
        [1, "2026-10-18", 0, 0, 0, 1, 0, 8, 0, 0, -1],
        [2, "2026-10-19", 0, 0, 0, 1, 0, 4, 0, 0, -1],
        [4, "2026-10-17", 0, 0, 0, 1, 0, 3, 0, 0, -1],
      ],
      appointments: [appointment("2026-10-17"), appointment("2026-10-18")],
    });
    const result = analyzeAppointments(input, {
      filters: { channel: 1, createdDates: ["2026-10-19", "2026-10-18", "2026-10-18"] },
    });
    expect(result.total).toBe(1);
    expect(
      result.details?.map((row) => ({
        createdAt: row.createdAt.slice(0, 10),
        daysSinceAppointment: row.daysSinceAppointment,
      })),
    ).toEqual([{ createdAt: "2026-10-18", daysSinceAppointment: 1 }]);
    expect(result.funnel).toEqual({
      opportunities: 18,
      appointments: 8,
      visits: 4,
      folders: 0,
      approvedFolders: 0,
      sales: 0,
    });
    expect(result.dailyAverage).toBe(0.5);
    expect(result.brokerCount).toBe(10);
    expect(result.registeredManagerCount).toBe(3);
  });

  it("classifies registered brokers by civil-day recency without truncating history to selected days", () => {
    const appointment = (
      owner: string,
      manager: string,
      date: string,
      company = "Empresa A",
      registeredBroker = true,
    ) => ({
      createdAt: `${date}T23:30:00-03:00`,
      scheduledAt: null,
      attendedAt: null,
      visitPerformed: false,
      regionalManager: "Regional A",
      salesManager: manager,
      owner,
      accountName: `Conta ${owner}`,
      accountRanking: "Ouro",
      channel: 1 as const,
      company,
      registeredBroker,
    });
    const input = slice({
      version: 4,
      coverageStart: "2026-09-01",
      referenceDate: "2026-10-22",
      brokerCount: 6,
      brokerManagerCount: 3,
      dimensions: {
        managers: ["Gerente A", "Gerente B", "Gerente C"],
        owners: ["Limite 7", "Limite 8", "Limite 14", "Limite 15"],
        companies: ["Empresa A", "Empresa B"],
        developments: [],
        stores: [],
      },
      facts: [],
      appointments: [
        appointment("Limite 7", "Gerente antigo", "2026-10-01"),
        appointment("Limite 7", "Gerente A", "2026-10-13"),
        appointment("Limite 8", "Gerente B", "2026-10-12"),
        appointment("Limite 14", "Gerente B", "2026-10-06"),
        appointment("Limite 15", "Gerente C", "2026-10-05"),
        appointment("Outro filtro", "Gerente D", "2026-10-19", "Empresa B"),
        appointment("Não cadastrado", "Gerente E", "2026-10-19", "Empresa A", false),
      ],
    });
    const result = analyzeAppointments(input, {
      filters: {
        createdDates: ["2026-10-20"],
        company: "Empresa A",
        channel: 1,
      },
    });
    expect(result.details).toEqual([]);
    expect(result.brokerRecency).toEqual({
      upTo7Days: [
        {
          owner: "Limite 7",
          manager: "Gerente A",
          lastAppointmentDate: "2026-10-13",
          daysSinceLastAppointment: 7,
        },
      ],
      from8To14Days: [
        {
          owner: "Limite 14",
          manager: "Gerente B",
          lastAppointmentDate: "2026-10-06",
          daysSinceLastAppointment: 14,
        },
        {
          owner: "Limite 8",
          manager: "Gerente B",
          lastAppointmentDate: "2026-10-12",
          daysSinceLastAppointment: 8,
        },
      ],
      from15Days: [
        {
          owner: "Limite 15",
          manager: "Gerente C",
          lastAppointmentDate: "2026-10-05",
          daysSinceLastAppointment: 15,
        },
      ],
    });
  });

  it("returns finite zero funnel indicators when no source or destination exists", () => {
    const result = analyzeAppointments(
      slice({
        version: 4,
        brokerCount: 0,
        brokerManagerCount: 0,
        viewKey: "without_canal_imob",
        dimensions: { ...slice().dimensions, stores: ["Loja A", "Loja B"] },
        facts: [],
        appointments: [],
      }),
    );
    expect(result.funnel).toEqual({
      opportunities: 0,
      appointments: 0,
      visits: 0,
      folders: 0,
      approvedFolders: 0,
      sales: 0,
    });
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

  it("keeps the annual chart independent of selected calendar days and weeks", () => {
    const result = analyzeAppointments(slice(), {
      year: "2026",
      filters: { createdDates: ["2026-10-19"], week: 3 },
    });
    expect(result.monthly.map(({ label, total }) => [label, total])).toEqual([
      ["Setembro", 10],
      ["Outubro", 13],
    ]);
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
