import { MetaAdsPage } from "../MetaAdsPage";

export const metadata = { title: "Relatórios · Meta Ads" };

export default async function MetaAdsReportsPage() {
  return MetaAdsPage({ path: "/app/meta-ads/relatorios", view: "reports" });
}
