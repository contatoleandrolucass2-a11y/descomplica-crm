import type { DashboardCard } from "./types";

export function dashboardCardSignature(
  card: Pick<
    DashboardCard,
    "type" | "metric" | "groupBy" | "period" | "startDate" | "endDate" | "entityIds"
  >,
) {
  const entityIds = card.entityIds
    ? [...new Set(card.entityIds.map((id) => id.trim()).filter(Boolean))].sort()
    : null;
  return JSON.stringify([
    card.type,
    card.metric.trim(),
    card.groupBy,
    card.period,
    card.startDate ?? null,
    card.endDate ?? null,
    entityIds,
  ]);
}

export function findDuplicateCard(
  cards: readonly DashboardCard[],
  candidate: DashboardCard,
  excludeCardId?: string,
) {
  const signature = dashboardCardSignature(candidate);
  return (
    cards.find((card) => card.id !== excludeCardId && dashboardCardSignature(card) === signature) ??
    null
  );
}
