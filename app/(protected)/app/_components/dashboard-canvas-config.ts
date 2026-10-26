import type { DashboardCard, DashboardPeriod } from "@/lib/dashboard-canvas";
import type {
  ConfigurableDashboardCatalog,
  ConfigurableDashboardCompatibility,
} from "@/lib/dashboard-canvas/ui/configurable/types";

export const OVERVIEW_CANVAS_PAGE_KEY = "crm.dashboard";

export const OVERVIEW_CANVAS_GROUPS = [
  {
    key: "goals",
    label: "Metas",
    metricKeys: ["overview.goal.month", "overview.goal.expected", "overview.current.month"],
  },
  {
    key: "periods",
    label: "Períodos do mês",
    metricKeys: [
      "overview.period.month",
      "overview.period.previous-week",
      "overview.period.current-week",
      "overview.period.yesterday",
      "overview.period.today",
    ],
  },
  {
    key: "history",
    label: "Histórico e média por venda",
    metricKeys: [
      "overview.history.year-average",
      "overview.history.three-month-average",
      "overview.history.previous",
      "overview.history.current",
      "overview.history.sale-average",
    ],
  },
] as const;

type OverviewMetricKey = (typeof OVERVIEW_CANVAS_GROUPS)[number]["metricKeys"][number];

interface OverviewCardSeed {
  id: string;
  metric: OverviewMetricKey;
  title: string;
  description: string;
  period: DashboardPeriod;
  columnSpan: number;
}

const seeds: readonly OverviewCardSeed[] = [
  {
    id: "overview-goal-month",
    metric: "overview.goal.month",
    title: "Meta mês",
    description: "Meta mensal por corretor ou gerente de vendas.",
    period: "month",
    columnSpan: 4,
  },
  {
    id: "overview-goal-expected",
    metric: "overview.goal.expected",
    title: "Meta esperada até hoje",
    description: "Meta proporcional ao dia do mês.",
    period: "month",
    columnSpan: 4,
  },
  {
    id: "overview-current-month",
    metric: "overview.current.month",
    title: "Mês atual",
    description: "Realizado no mês vigente.",
    period: "month",
    columnSpan: 4,
  },
  {
    id: "overview-period-month",
    metric: "overview.period.month",
    title: "Mês",
    description: "Realizado no mês vigente.",
    period: "month",
    columnSpan: 2,
  },
  {
    id: "overview-period-previous-week",
    metric: "overview.period.previous-week",
    title: "Semana anterior",
    description: "Realizado na semana anterior dentro do mês vigente.",
    period: "week",
    columnSpan: 2,
  },
  {
    id: "overview-period-current-week",
    metric: "overview.period.current-week",
    title: "Esta semana",
    description: "Realizado na semana atual.",
    period: "week",
    columnSpan: 2,
  },
  {
    id: "overview-period-yesterday",
    metric: "overview.period.yesterday",
    title: "Ontem",
    description: "Realizado no dia anterior.",
    period: "today",
    columnSpan: 3,
  },
  {
    id: "overview-period-today",
    metric: "overview.period.today",
    title: "Hoje",
    description: "Realizado hoje.",
    period: "today",
    columnSpan: 3,
  },
  {
    id: "overview-history-year-average",
    metric: "overview.history.year-average",
    title: "Média do ano",
    description: "Média dos meses encerrados no ano.",
    period: "global",
    columnSpan: 2,
  },
  {
    id: "overview-history-three-month-average",
    metric: "overview.history.three-month-average",
    title: "Média dos últimos 3 meses",
    description: "Média dos três meses encerrados mais recentes.",
    period: "global",
    columnSpan: 2,
  },
  {
    id: "overview-history-previous",
    metric: "overview.history.previous",
    title: "Mês anterior",
    description: "Realizado no último mês encerrado.",
    period: "month",
    columnSpan: 2,
  },
  {
    id: "overview-history-current",
    metric: "overview.history.current",
    title: "Mês",
    description: "Realizado no mês atual.",
    period: "month",
    columnSpan: 3,
  },
  {
    id: "overview-history-sale-average",
    metric: "overview.history.sale-average",
    title: "Média venda",
    description: "Média anual de cada etapa por venda.",
    period: "global",
    columnSpan: 3,
  },
];

export const OVERVIEW_CANVAS_DEFAULT_CARDS: DashboardCard[] = seeds.map((seed, order) => ({
  id: seed.id,
  type: "funnel",
  metric: seed.metric,
  title: seed.title,
  period: seed.period,
  groupBy: "entity",
  entityIds: null,
  layout: {
    order,
    columnSpan: seed.columnSpan,
    height: 672,
  },
}));

export const OVERVIEW_CANVAS_CATALOG: ConfigurableDashboardCatalog = {
  metrics: seeds.map((seed) => ({
    key: seed.metric,
    label: seed.title,
    description: seed.description,
    defaultType: "funnel",
  })),
  types: [{ value: "funnel", label: "Funil" }],
  periods: [
    { value: "global", label: "Todo o período" },
    { value: "today", label: "Hoje" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mês" },
  ],
  groups: [{ value: "entity", label: "Funil comercial" }],
  options: [],
};

export const OVERVIEW_CANVAS_COMPATIBILITY: ConfigurableDashboardCompatibility = {
  typesByMetric: Object.fromEntries(seeds.map(({ metric }) => [metric, ["funnel"] as const])),
  groupsByMetric: Object.fromEntries(seeds.map(({ metric }) => [metric, ["entity"] as const])),
  periodsByMetric: Object.fromEntries(
    seeds.map(({ metric, period }) => [metric, [period] as const]),
  ),
  optionsByMetric: Object.fromEntries(seeds.map(({ metric }) => [metric, []])),
};
