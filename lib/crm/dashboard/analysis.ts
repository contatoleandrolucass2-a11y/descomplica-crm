import {
  ANALYSIS_STAGE_KEYS,
  DASHBOARD_CHANNELS,
  type DashboardAnalysisFact,
  type DashboardAnalysisSlice,
} from "./analysis-contract";
import type { DashboardMetric, DashboardReadModel } from "./data";
import type { DashboardStageKey } from "./catalog";

export const DASHBOARD_FILTER_KEYS = ["channel", "manager", "owner", "company"] as const;
export type DashboardFilterKey = (typeof DASHBOARD_FILTER_KEYS)[number];
export type DashboardFilters = Record<DashboardFilterKey, string[]>;
export type DashboardFilterOptions = Record<DashboardFilterKey, string[]>;
export const emptyDashboardFilters = (): DashboardFilters => ({
  channel: [],
  manager: [],
  owner: [],
  company: [],
});
export interface DashboardHistoryMonth {
  month: string;
  readings: Array<{ key: DashboardStageKey; value: number | null }>;
}

export function parseDashboardFilters(
  query: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const filters = emptyDashboardFilters();
  for (const key of DASHBOARD_FILTER_KEYS) {
    const input = query[key];
    const values = input === undefined ? [] : typeof input === "string" ? [input] : input;
    if (
      values.length > 50 ||
      values.some((value) => typeof value !== "string" || value.length > 200)
    )
      throw new RangeError("Invalid dashboard filters.");
    filters[key] = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }
  if (filters.channel.some((channel) => !DASHBOARD_CHANNELS.some((allowed) => allowed === channel)))
    throw new RangeError("Invalid dashboard channel.");
  return filters;
}

const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
function shiftMonth(date: string, months: number) {
  const value = new Date(`${monthStart(date)}T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}
const monthEnd = (date: string) => shiftDate(shiftMonth(date, 1), -1);
const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function analyzeDashboard(
  slice: DashboardAnalysisSlice,
  filters: DashboardFilters,
  asOfDate = slice.referenceDate,
) {
  const { dimensions, referenceDate, coverageStart } = slice;
  const dimensionValue = (fact: DashboardAnalysisFact, key: DashboardFilterKey) => {
    if (key === "channel") return DASHBOARD_CHANNELS[fact[5]];
    if (key === "manager") return dimensions.managers[fact[2]];
    if (key === "owner") return dimensions.owners[fact[3]];
    return dimensions.companies[fact[4]];
  };
  const matches = (fact: DashboardAnalysisFact, omit?: DashboardFilterKey) =>
    DASHBOARD_FILTER_KEYS.every(
      (key) =>
        key === omit ||
        filters[key].length === 0 ||
        filters[key].includes(dimensionValue(fact, key) ?? ""),
    );
  const options = Object.fromEntries(
    DASHBOARD_FILTER_KEYS.map((key) => [
      key,
      [
        ...new Set(
          slice.facts
            .filter((fact) => matches(fact, key))
            .map((fact) => dimensionValue(fact, key))
            .filter((value): value is string => value !== undefined),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    ]),
  ) as DashboardFilterOptions;
  const facts = slice.facts.filter((fact) => matches(fact));
  const closedStarts: string[] = [];
  for (let start = coverageStart; start < monthStart(referenceDate); start = shiftMonth(start, 1)) {
    if (monthEnd(start) <= referenceDate) closedStarts.push(start);
  }
  const yearMonths =
    coverageStart <= `${referenceDate.slice(0, 4)}-01-01`
      ? closedStarts.filter((start) => start.slice(0, 4) === referenceDate.slice(0, 4))
      : [];
  const threeMonths = closedStarts.length >= 3 ? closedStarts.slice(-3) : [];
  const previousStart = shiftMonth(referenceDate, -1);
  const previousMonths = closedStarts.includes(previousStart) ? [previousStart] : [];
  const weekday = new Date(`${referenceDate}T12:00:00Z`).getUTCDay();
  const weekStart = shiftDate(referenceDate, -((weekday + 6) % 7));
  const count = (stage: number, start: string, end: string): number | null =>
    start < coverageStart || end > referenceDate
      ? null
      : facts
          .filter((fact) => fact[0] === stage && fact[1] >= start && fact[1] <= end)
          .reduce((sum, fact) => sum + fact[7], 0);
  const history = (months: string[]): DashboardHistoryMonth[] =>
    months.map((start) => ({
      month: start.slice(0, 7),
      readings: ANALYSIS_STAGE_KEYS.map((key, stage) => ({
        key,
        value: count(stage, start, monthEnd(start)),
      })),
    }));
  const metrics = Object.fromEntries(
    ANALYSIS_STAGE_KEYS.map((key, stage) => [
      key,
      {
        currentMonth: count(stage, monthStart(referenceDate), referenceDate),
        currentWeek: count(stage, weekStart, referenceDate),
        currentToday: count(stage, referenceDate, referenceDate),
        previousMonth: previousMonths.length
          ? count(stage, previousStart, monthEnd(previousStart))
          : null,
        yearClosedMonthsAverage: average(
          yearMonths.map((start) => count(stage, start, monthEnd(start))!),
        ),
        lastThreeClosedMonthsAverage: average(
          threeMonths.map((start) => count(stage, start, monthEnd(start))!),
        ),
        previousFourteenDays: count(
          stage,
          shiftDate(referenceDate, -27),
          shiftDate(referenceDate, -14),
        ),
        lastFourteenDays: count(stage, shiftDate(referenceDate, -13), referenceDate),
        previousSevenDays: count(
          stage,
          shiftDate(referenceDate, -13),
          shiftDate(referenceDate, -7),
        ),
        lastSevenDays: count(stage, shiftDate(referenceDate, -6), referenceDate),
        previousWeek: count(stage, shiftDate(weekStart, -7), shiftDate(weekStart, -1)),
        yesterday: count(stage, shiftDate(referenceDate, -1), shiftDate(referenceDate, -1)),
        goalMonth: 0,
        goalWeek: 0,
        goalToday: 0,
      } satisfies DashboardMetric,
    ]),
  ) as Record<DashboardStageKey, DashboardMetric>;
  const sameDay = asOfDate === referenceDate;
  const sameMonth = monthStart(asOfDate) === monthStart(referenceDate);
  const currentWeekday = new Date(`${asOfDate}T12:00:00Z`).getUTCDay();
  const sameWeek = weekStart === shiftDate(asOfDate, -((currentWeekday + 6) % 7));
  if (!sameDay) {
    // Old snapshots remain dated; never relabel yesterday's events as today's.
    for (const metric of Object.values(metrics)) {
      metric.currentToday = null;
      metric.yesterday = null;
      metric.lastSevenDays = null;
      metric.lastFourteenDays = null;
      metric.previousSevenDays = null;
      metric.previousFourteenDays = null;
      if (!sameWeek) {
        metric.currentWeek = null;
        metric.previousWeek = null;
      }
      if (!sameMonth) metric.currentMonth = null;
    }
  }
  const owners = new Set(facts.filter((fact) => fact[3] >= 0).map((fact) => fact[3]));
  const managerOwners = new Map<string, Set<number>>();
  for (const fact of facts) {
    if (fact[3] < 0) continue;
    const name = dimensions.managers[fact[2]] ?? "Sem gerente informado";
    const members = managerOwners.get(name) ?? new Set<number>();
    members.add(fact[3]);
    managerOwners.set(name, members);
  }
  const developmentCounts = new Map<string, number>();
  for (const fact of facts) {
    const name = dimensions.developments[fact[6]];
    if (fact[0] === 0 && name)
      developmentCounts.set(name, (developmentCounts.get(name) ?? 0) + fact[7]);
  }
  const amount = (start: string) =>
    start < coverageStart
      ? null
      : facts
          .filter((fact) => fact[0] === 4 && fact[1] >= start && fact[1] <= referenceDate)
          .reduce((sum, fact) => sum + fact[8], 0);
  return {
    filters,
    options,
    metrics,
    history: {
      "year-average": history(yearMonths),
      "three-month-average": history(threeMonths),
      previous: history(previousMonths),
    },
    brokerCount: facts.length > 0 && owners.size === 0 ? null : owners.size,
    team: {
      brokers: owners.size,
      managers: [...managerOwners]
        .map(([name, members]) => ({ name, total: members.size }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    },
    salesValue: {
      month: sameMonth ? amount(monthStart(referenceDate)) : null,
      week: sameWeek ? amount(weekStart) : null,
      today: sameDay ? amount(referenceDate) : null,
    },
    topDevelopments: [...developmentCounts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .slice(0, 5)
      .map(([name, total], index) => ({ name, total, rank: index + 1 })),
  };
}

export type DashboardAnalysisResult = ReturnType<typeof analyzeDashboard>;
export function applyDashboardAnalysis(
  dashboard: DashboardReadModel,
  result: DashboardAnalysisResult,
  view: DashboardAnalysisSlice["viewKey"],
): DashboardReadModel {
  return {
    ...dashboard,
    metrics: { [view]: result.metrics },
    salesValue: { [view]: result.salesValue },
    topDevelopments: { [view]: result.topDevelopments },
  };
}
