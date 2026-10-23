import { MetaAdsPage } from "./MetaAdsPage";

export const metadata = { title: "Meta Ads" };

export default async function MetaAdsDashboardPage({
  searchParams,
}: { searchParams?: Promise<{ panel?: string }> } = {}) {
  const panel = (await searchParams)?.panel;
  const view = panel === "map" || panel === "settings" ? panel : "overview";
  return MetaAdsPage({ path: "/app/meta-ads", view });
}
