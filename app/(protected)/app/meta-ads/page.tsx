import { MetaAdsPage } from "./MetaAdsPage";

export const metadata = { title: "Meta Ads" };

export default async function MetaAdsDashboardPage() {
  return MetaAdsPage({ path: "/app/meta-ads", view: "overview" });
}
