import { enforcePermission } from "@/lib/authorization/enforce";
import { loadQlikRankingV2 } from "@/lib/crm/qlik/data-v2";

import { parseRankingFilters, RankingDashboard } from "./RankingDashboard";

export const metadata = { title: "Canal de Parcerias" };

export default async function PartnershipsChannelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await enforcePermission("crm.partnerships.view");
  const filters = parseRankingFilters((await searchParams) ?? {});
  const data = filters ? await loadQlikRankingV2(filters.year) : { status: "unavailable" as const };
  return <RankingDashboard data={data} filters={filters} />;
}
