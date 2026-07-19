import type {
  DashboardPayload,
  DashboardView,
  DashboardViewKey,
  MetricSnapshot,
  PeriodKey,
} from "./types";

const VIEW_KEYS: DashboardViewKey[] = [
  "with_canal_imob",
  "without_canal_imob",
  "all",
];

const METRIC_KEYS = [
  "opportunities",
  "appointments",
  "visits",
  "folders",
  "sales",
] as const;

const PERIOD_KEYS: PeriodKey[] = ["month", "week", "today"];

function sum(values: number[]) {
  return values.reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  );
}

function aggregateMetric(
  dashboards: DashboardPayload[],
  viewKey: DashboardViewKey,
  metricKey: (typeof METRIC_KEYS)[number],
): MetricSnapshot {
  const metrics = dashboards.map(
    (dashboard) => dashboard.views[viewKey].metrics[metricKey],
  );

  return {
    current: Object.fromEntries(
      PERIOD_KEYS.map((period) => [
        period,
        sum(metrics.map((metric) => metric.current[period])),
      ]),
    ) as Record<PeriodKey, number>,
    goal: Object.fromEntries(
      PERIOD_KEYS.map((period) => [
        period,
        sum(metrics.map((metric) => metric.goal[period])),
      ]),
    ) as Record<PeriodKey, number>,
    previousMonth: sum(metrics.map((metric) => metric.previousMonth ?? 0)),
    last7Days: sum(metrics.map((metric) => metric.last7Days ?? 0)),
    last14Days: sum(metrics.map((metric) => metric.last14Days ?? 0)),
  };
}

function aggregateView(
  dashboards: DashboardPayload[],
  viewKey: DashboardViewKey,
): DashboardView {
  const template = dashboards[0].views[viewKey];
  const developments = new Map<string, number>();

  for (const dashboard of dashboards) {
    for (const item of dashboard.views[viewKey].topDevelopments) {
      developments.set(
        item.name,
        (developments.get(item.name) ?? 0) + item.total,
      );
    }
  }

  return {
    key: viewKey,
    label: template.label,
    description:
      viewKey === "all"
        ? "Visão consolidada de toda a equipe e de todas as origens."
        : viewKey === "with_canal_imob"
          ? "Resultados consolidados da equipe associados ao CANAL IMOB."
          : "Resultados consolidados da equipe removendo o CANAL IMOB.",
    metrics: Object.fromEntries(
      METRIC_KEYS.map((metricKey) => [
        metricKey,
        aggregateMetric(dashboards, viewKey, metricKey),
      ]),
    ) as DashboardView["metrics"],
    salesValue: Object.fromEntries(
      PERIOD_KEYS.map((period) => [
        period,
        sum(
          dashboards.map(
            (dashboard) => dashboard.views[viewKey].salesValue[period],
          ),
        ),
      ]),
    ) as Record<PeriodKey, number>,
    topDevelopments: [...developments.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5),
  };
}

export function aggregateDashboards(
  dashboards: DashboardPayload[],
): DashboardPayload | null {
  if (!dashboards.length) return null;

  const latestGeneratedAt = dashboards.reduce(
    (latest, dashboard) =>
      dashboard.generatedAt > latest ? dashboard.generatedAt : latest,
    dashboards[0].generatedAt,
  );
  const currentSnapshot = dashboards.filter(
    (dashboard) => dashboard.generatedAt === latestGeneratedAt,
  );
  const latest = currentSnapshot[0];

  return {
    collaborator: {
      email: "relatorio-completo@descomplicapro.com.br",
      name: "Relatório completo",
      manager: `${currentSnapshot.length} colaboradores`,
      role: "Relatório completo",
    },
    generatedAt: latestGeneratedAt,
    referenceDate: currentSnapshot.reduce(
      (reference, dashboard) =>
        dashboard.referenceDate > reference
          ? dashboard.referenceDate
          : reference,
      latest.referenceDate,
    ),
    timezone: latest.timezone,
    source: `${latest.source} · visão consolidada`,
    views: Object.fromEntries(
      VIEW_KEYS.map((viewKey) => [
        viewKey,
        aggregateView(currentSnapshot, viewKey),
      ]),
    ) as DashboardPayload["views"],
  };
}
