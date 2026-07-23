import type {
  DashboardFilterRecord,
  DashboardFilterSelection,
  DashboardPayload,
  DashboardView,
  MetricSnapshot,
  RealizedFunnel,
  RealizedFunnelMetric,
} from "./types";

type StageKey = keyof DashboardPayload["views"]["all"]["metrics"];

export const EMPTY_FILTER_SELECTION: DashboardFilterSelection = {
  salesChannels: [],
  managers: [],
  owners: [],
  companies: [],
};

export function filterCount(selection: DashboardFilterSelection) {
  return Object.values(selection).reduce((total, values) => total + values.length, 0);
}

export function hasDashboardFilters(selection: DashboardFilterSelection) {
  return filterCount(selection) > 0;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function selected(value: string, values: string[]) {
  if (!values.length) return true;
  const key = normalized(value);
  return values.some((item) => normalized(item) === key);
}

function matches(record: DashboardFilterRecord, selection: DashboardFilterSelection) {
  return (
    selected(record.salesChannel, selection.salesChannels) &&
    selected(record.manager, selection.managers) &&
    selected(record.owner, selection.owners) &&
    selected(record.company, selection.companies)
  );
}

function localDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function startOfWeek(value: Date) {
  const day = value.getDay();
  return addDays(value, day === 0 ? -6 : 1 - day);
}

function inRange(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const date = localDate(value);
  return date >= start && date <= end;
}

function periodCounts(records: DashboardFilterRecord[], referenceDate: string) {
  const today = localDate(referenceDate);
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const previousMonthEnd = new Date(
    previousMonthStart.getFullYear(),
    previousMonthStart.getMonth(),
    Math.min(today.getDate(), previousMonthLastDay),
  );
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const previousWeekStart = addDays(weekStart, -7);
  const previousWeekEnd = addDays(weekStart, -1);
  const yesterday = addDays(today, -1);

  const count = (start: Date, end: Date) =>
    records.filter((record) => inRange(record.date, start, end)).length;
  const last3ClosedMonths = [1, 2, 3].map((offset) => {
    const start = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - offset + 1, 0);
    return count(start, end);
  });
  const yearClosedMonths = Array.from(
    { length: today.getMonth() },
    (_, monthIndex) => {
      const start = new Date(today.getFullYear(), monthIndex, 1);
      const end = new Date(today.getFullYear(), monthIndex + 1, 0);
      return count(start, end);
    },
  );

  return {
    previousMonth: count(previousMonthStart, previousMonthEnd),
    yearClosedMonthsAverage: yearClosedMonths.length
      ? yearClosedMonths.reduce((total, value) => total + value, 0) /
        yearClosedMonths.length
      : null,
    last3ClosedMonthsAverage:
      last3ClosedMonths.reduce((total, value) => total + value, 0) /
      last3ClosedMonths.length,
    month: count(currentMonthStart, today),
    previous14Days: count(addDays(today, -27), addDays(today, -14)),
    last14Days: count(addDays(today, -13), today),
    previous7Days: count(addDays(today, -13), addDays(today, -7)),
    last7Days: count(addDays(today, -6), today),
    previousWeek: count(previousWeekStart, previousWeekEnd),
    currentWeek: count(weekStart, weekEnd),
    yesterday: count(yesterday, yesterday),
    today: count(today, today),
  };
}

function metricFromRecords(
  records: DashboardFilterRecord[],
  referenceDate: string,
  base: MetricSnapshot,
): MetricSnapshot {
  const counts = periodCounts(records, referenceDate);
  return {
    current: {
      month: counts.month,
      week: counts.currentWeek,
      today: counts.today,
    },
    goal: { ...base.goal },
    previousMonth: counts.previousMonth,
    yearClosedMonthsAverage: counts.yearClosedMonthsAverage,
    last3ClosedMonthsAverage: counts.last3ClosedMonthsAverage,
    previous14Days: counts.previous14Days,
    last14Days: counts.last14Days,
    previous7Days: counts.previous7Days,
    last7Days: counts.last7Days,
    previousWeek: counts.previousWeek,
    currentWeek: counts.currentWeek,
    yesterday: counts.yesterday,
  };
}

function periodAmount(records: DashboardFilterRecord[], referenceDate: string) {
  const today = localDate(referenceDate);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const weekStart = startOfWeek(today);
  const sum = (start: Date, end: Date) =>
    records
      .filter((record) => inRange(record.date, start, end))
      .reduce((total, record) => total + (Number(record.amount) || 0), 0);
  return {
    month: sum(monthStart, today),
    week: sum(weekStart, addDays(weekStart, 6)),
    today: sum(today, today),
  };
}

function topDevelopments(records: DashboardFilterRecord[]) {
  const totals = new Map<string, number>();
  for (const record of records) {
    const name = record.development.trim();
    if (!name || name === "-") continue;
    totals.set(name, (totals.get(name) ?? 0) + 1);
  }
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 5);
}

export function buildFilteredView(
  dashboard: DashboardPayload,
  selection: DashboardFilterSelection,
): DashboardView {
  const base = dashboard.views.all;
  const data = dashboard.filterData;
  if (!data || !hasDashboardFilters(selection)) return base;

  const records = {
    opportunities: data.records.opportunities.filter((item) => matches(item, selection)),
    appointments: data.records.appointments.filter((item) => matches(item, selection)),
    visits: data.records.visits.filter((item) => matches(item, selection)),
    folders: data.records.folders.filter((item) => matches(item, selection)),
    sales: data.records.sales.filter((item) => matches(item, selection)),
  };
  const metrics = Object.fromEntries(
    (Object.keys(records) as StageKey[]).map((key) => [
      key,
      metricFromRecords(records[key], dashboard.referenceDate, base.metrics[key]),
    ]),
  ) as DashboardView["metrics"];

  return {
    key: "all",
    label: "Resultado filtrado",
    description: `${filterCount(selection)} ${filterCount(selection) === 1 ? "seleção ativa" : "seleções ativas"} em todo o funil.`,
    metrics,
    salesValue: periodAmount(records.sales, dashboard.referenceDate),
    topDevelopments: topDevelopments([
      ...records.opportunities,
      ...records.folders,
      ...records.sales,
    ]),
  };
}

function realizedMetric(metric: MetricSnapshot): RealizedFunnelMetric {
  const monthGoal = metric.goal.month;
  const weekGoal = metric.goal.week;
  const todayGoal = metric.goal.today;
  return {
    mesAnterior: metric.previousMonth ?? 0,
    mesAtual: metric.current.month,
    ultimos14DiasAnteriores: metric.previous14Days ?? 0,
    ultimos14Dias: metric.last14Days ?? 0,
    ultimos7DiasAnteriores: metric.previous7Days ?? 0,
    ultimos7Dias: metric.last7Days ?? 0,
    semanaPassada: metric.previousWeek ?? 0,
    estaSemana: metric.currentWeek ?? metric.current.week,
    ontem: metric.yesterday ?? 0,
    hoje: metric.current.today,
    metas: { mes: monthGoal, semana: weekGoal, dia: todayGoal },
    realizado_meta_mes: monthGoal ? metric.current.month / monthGoal : 0,
    realizado_meta_semana: weekGoal ? metric.current.week / weekGoal : 0,
    realizado_meta_dia: todayGoal ? metric.current.today / todayGoal : 0,
  };
}

export function buildFilteredRealizedFunnel(
  dashboard: DashboardPayload,
  view: DashboardView,
  selection: DashboardFilterSelection,
): RealizedFunnel | undefined {
  if (!dashboard.realizedFunnel) return undefined;
  if (!hasDashboardFilters(selection)) return dashboard.realizedFunnel;
  const records = dashboard.filterData
    ? Object.values(dashboard.filterData.records).flat().filter((item) => matches(item, selection))
    : [];
  return {
    resumo: {
      corretores: new Set(records.map((item) => item.owner).filter(Boolean)).size,
      gerentes: new Set(records.map((item) => item.manager).filter(Boolean)).size,
    },
    agendamentos: realizedMetric(view.metrics.appointments),
    visitas: realizedMetric(view.metrics.visits),
    pastas: realizedMetric(view.metrics.folders),
    vendas: realizedMetric(view.metrics.sales),
  };
}
