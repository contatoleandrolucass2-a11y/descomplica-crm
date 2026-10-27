import type { DashboardCard } from "./schema";

export const DASHBOARD_PROFILE_CATALOG = {
  "crm.dashboard": {
    metrics: [
      "overview.goal.month",
      "overview.goal.expected",
      "overview.current.month",
      "overview.period.month",
      "overview.period.previous-week",
      "overview.period.current-week",
      "overview.period.yesterday",
      "overview.period.today",
      "overview.history.year-average",
      "overview.history.three-month-average",
      "overview.history.previous",
      "overview.history.current",
      "overview.history.sale-average",
    ],
    entityIds: ["channel.house", "channel.partnerships"],
  },
  "crm.stage.appointments": {
    metrics: [
      "appointments.total",
      "appointments.rate",
      "appointments.daily",
      "appointments.weekly",
      "appointments.monthly",
      "appointments.yesterday",
      "appointments.today",
      "appointments.today-comparison",
      "appointments.planned-today",
      "appointments.performed-today",
      "appointments.goal",
      "appointments.funnel-comparison",
      "appointments.details",
      "team.productive",
      "brokers.total",
      "managers.total",
      "visits.total",
      "sales.total",
      "conversion.opportunity-appointment",
      "conversion.appointment-visit",
      "conversion.appointment-sale",
      "ranking.score",
      "ranking.owner",
      "ranking.manager",
      "ranking.regional-manager",
      "conversion-ranking.owner",
      "conversion-ranking.manager",
      "conversion-ranking.regional-manager",
      "recency.up-to-7-days",
      "recency.8-to-14-days",
      "recency.15-plus-days",
    ],
    entityIds: ["channel.house", "channel.partnerships"],
  },
} as const;

export type DashboardProfileCatalogPageKey = keyof typeof DASHBOARD_PROFILE_CATALOG;

export function isDashboardProfileCatalogPageKey(
  pageKey: string,
): pageKey is DashboardProfileCatalogPageKey {
  return Object.hasOwn(DASHBOARD_PROFILE_CATALOG, pageKey);
}

export function canEditDashboardProfilePage(pageKey: string, roleKey: string): boolean {
  return pageKey !== "crm.stage.appointments" || roleKey === "admin" || roleKey === "master";
}

export function dashboardCardsMatchPageCatalog(
  pageKey: string,
  cards: readonly Pick<DashboardCard, "metric" | "entityIds">[],
): boolean {
  if (!isDashboardProfileCatalogPageKey(pageKey)) return false;
  const catalog = DASHBOARD_PROFILE_CATALOG[pageKey];
  const metrics = new Set<string>(catalog.metrics);
  const entityIds = new Set<string>(catalog.entityIds);
  return cards.every(
    (card) =>
      metrics.has(card.metric) &&
      (card.entityIds === null || card.entityIds.every((entityId) => entityIds.has(entityId))),
  );
}
