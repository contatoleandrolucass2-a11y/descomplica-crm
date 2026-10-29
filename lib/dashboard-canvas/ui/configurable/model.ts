import {
  DASHBOARD_CARD_LAYOUT_LIMITS,
  constrainCardLayout,
  type DashboardCardLayoutPolicy,
} from "../../layout/limits";
import { normalizeDashboardCards } from "../../state/migrations";
import {
  DASHBOARD_CARD_TYPES,
  DASHBOARD_GROUPS,
  DASHBOARD_PERIODS,
  type DashboardCard,
  type DashboardCardOptions,
  type DashboardCardType,
  type DashboardGroupBy,
  type DashboardPeriod,
} from "../../types";
import type {
  ConfigurableDashboardCatalog,
  ConfigurableDashboardCompatibility,
  DashboardCardOptionKey,
} from "./types";

export const DEFAULT_CARD_TYPE_LABELS: Record<DashboardCardType, string> = {
  kpi: "Indicador",
  bars: "Barras",
  "horizontal-bars": "Barras horizontais",
  line: "Linha",
  area: "Área",
  donut: "Rosca",
  radar: "Radar",
  scatter: "Dispersão",
  funnel: "Funil",
  table: "Tabela",
};

export const DEFAULT_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  global: "Todo o período",
  today: "Hoje",
  week: "Semana",
  month: "Mês",
  custom: "Personalizado",
};

export const DEFAULT_GROUP_LABELS: Record<DashboardGroupBy, string> = {
  entity: "Entidade",
  day: "Dia",
  hour: "Hora",
};

export const DEFAULT_OPTION_LABELS: Record<DashboardCardOptionKey, string> = {
  showLegend: "Mostrar legenda",
  showGoal: "Mostrar meta",
  showCeiling: "Mostrar teto",
  sharedScale: "Compartilhar escala",
};

function uniqueAllowed<Value extends string>(
  configured: readonly Value[] | undefined,
  known: readonly Value[],
): Value[] {
  if (!configured) return [...known];
  const knownValues = new Set<string>(known);
  return [...new Set(configured)].filter((value) => knownValues.has(value));
}

export function compatibleTypes(
  metric: string,
  compatibility?: ConfigurableDashboardCompatibility,
) {
  return uniqueAllowed(compatibility?.typesByMetric?.[metric], DASHBOARD_CARD_TYPES);
}

export function compatibleGroups(
  metric: string,
  compatibility?: ConfigurableDashboardCompatibility,
) {
  return uniqueAllowed(compatibility?.groupsByMetric?.[metric], DASHBOARD_GROUPS);
}

export function compatiblePeriods(
  metric: string,
  compatibility?: ConfigurableDashboardCompatibility,
) {
  return uniqueAllowed(compatibility?.periodsByMetric?.[metric], DASHBOARD_PERIODS);
}

export function compatibleOptions(
  metric: string,
  catalog: ConfigurableDashboardCatalog,
  compatibility?: ConfigurableDashboardCompatibility,
) {
  const known = (
    catalog.options ??
    Object.keys(DEFAULT_OPTION_LABELS).map((key) => ({
      key: key as DashboardCardOptionKey,
      label: DEFAULT_OPTION_LABELS[key as DashboardCardOptionKey],
    }))
  ).map(({ key }) => key);
  return uniqueAllowed(compatibility?.optionsByMetric?.[metric], known);
}

export function createCatalogCard({
  catalog,
  compatibility,
  id,
  order,
}: {
  catalog: ConfigurableDashboardCatalog;
  compatibility?: ConfigurableDashboardCompatibility | undefined;
  id: string;
  order: number;
}): DashboardCard | null {
  const metric = catalog.metrics[0];
  if (!metric) return null;
  const types = compatibleTypes(metric.key, compatibility);
  const groups = compatibleGroups(metric.key, compatibility);
  const periods = compatiblePeriods(metric.key, compatibility);
  const type =
    metric.defaultType && types.includes(metric.defaultType)
      ? metric.defaultType
      : (types[0] ?? "kpi");
  const groupBy = groups[0] ?? "entity";
  const period = periods[0] ?? "global";
  return {
    id,
    metric: metric.key,
    type,
    period,
    groupBy,
    entityIds: null,
    layout: constrainCardLayout(type, { order }),
  };
}

export function reconcileCardCompatibility(
  card: DashboardCard,
  catalog: ConfigurableDashboardCatalog,
  compatibility?: ConfigurableDashboardCompatibility,
  layoutPolicy?: DashboardCardLayoutPolicy,
): DashboardCard {
  const types = compatibleTypes(card.metric, compatibility);
  const groups = compatibleGroups(card.metric, compatibility);
  const periods = compatiblePeriods(card.metric, compatibility);
  const optionKeys = new Set(compatibleOptions(card.metric, catalog, compatibility));
  const type = types.includes(card.type) ? card.type : (types[0] ?? "kpi");
  const period = periods.includes(card.period) ? card.period : (periods[0] ?? "global");
  const groupBy = groups.includes(card.groupBy) ? card.groupBy : (groups[0] ?? "entity");
  const options = Object.fromEntries(
    Object.entries(card.options ?? {}).filter(([key]) =>
      optionKeys.has(key as DashboardCardOptionKey),
    ),
  ) as DashboardCardOptions;
  const next: DashboardCard = {
    ...card,
    type,
    period,
    groupBy,
    layout: constrainCardLayout(type, card.layout, layoutPolicy),
  };
  delete next.options;
  if (Object.keys(options).length > 0) next.options = options;
  if (period !== "custom") {
    delete next.startDate;
    delete next.endDate;
  }
  return next;
}

export function moveSelectedCards(
  cards: readonly DashboardCard[],
  selectedIds: ReadonlySet<string>,
  direction: -1 | 1,
  layoutPolicy?: DashboardCardLayoutPolicy,
) {
  const ordered = normalizeDashboardCards(cards, layoutPolicy);
  const selected = ordered.filter((card) => selectedIds.has(card.id));
  if (selected.length === 0 || selected.length === ordered.length) return ordered;
  const remaining = ordered.filter((card) => !selectedIds.has(card.id));
  const unselectedBefore = ordered
    .slice(
      0,
      ordered.findIndex((card) => selectedIds.has(card.id)),
    )
    .filter((card) => !selectedIds.has(card.id)).length;
  const insertAt = Math.min(Math.max(unselectedBefore + direction, 0), remaining.length);
  const next = [...remaining];
  next.splice(insertAt, 0, ...selected);
  return next.map((card, order) => ({ ...card, layout: { ...card.layout, order } }));
}

export function cardSummary(card: DashboardCard, catalog: ConfigurableDashboardCatalog) {
  const metric = catalog.metrics.find(({ key }) => key === card.metric)?.label ?? card.metric;
  const entities =
    card.entityIds === null
      ? "Todas as entidades"
      : card.entityIds
          .map((id) => catalog.entities?.find((entity) => entity.id === id)?.label ?? id)
          .join(", ") || "Nenhuma entidade";
  const optionLabels = Object.entries(card.options ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => DEFAULT_OPTION_LABELS[key as DashboardCardOptionKey] ?? key);
  return [
    `Métrica: ${metric}`,
    `Modelo: ${DEFAULT_CARD_TYPE_LABELS[card.type]}`,
    `Agrupamento: ${DEFAULT_GROUP_LABELS[card.groupBy]}`,
    `Período: ${DEFAULT_PERIOD_LABELS[card.period]}${
      card.period === "custom" ? ` (${card.startDate ?? "?"} a ${card.endDate ?? "?"})` : ""
    }`,
    `Entidades: ${entities}`,
    `Opções: ${optionLabels.length > 0 ? optionLabels.join(", ") : "Padrão"}`,
    `Estado: ${card.layout.columnSpan} colunas, ${card.layout.height}px de altura`,
  ];
}

export function cardMinimumHeight(type: DashboardCardType) {
  return DASHBOARD_CARD_LAYOUT_LIMITS[type].minHeight;
}
