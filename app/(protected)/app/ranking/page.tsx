import { enforcePermission } from "@/lib/authorization/enforce";
import { loadQlikRankingV2 } from "@/lib/crm/qlik/data-v2";

import { parseRankingFilters, RankingDashboard } from "./RankingDashboard";

export const metadata = { title: "Ranking de parcerias" };

export default async function RankingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await enforcePermission("crm.ranking.view");
  const filters = parseRankingFilters((await searchParams) ?? {});
  const data = filters ? await loadQlikRankingV2(filters.year) : { status: "unavailable" as const };
  return <RankingDashboard data={data} filters={filters} />;
}
