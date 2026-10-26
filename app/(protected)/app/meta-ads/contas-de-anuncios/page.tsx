import { MetaAdsPage } from "../MetaAdsPage";

export const metadata = { title: "Limites · Meta Ads" };

export default async function MetaAdsAccountsPage() {
  return MetaAdsPage({ path: "/app/meta-ads/contas-de-anuncios", view: "accounts" });
}
