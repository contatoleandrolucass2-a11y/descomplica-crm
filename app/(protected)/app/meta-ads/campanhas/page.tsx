import { MetaAdsPage } from "../MetaAdsPage";

export const metadata = { title: "Campanhas · Meta Ads" };

export default async function MetaAdsCampaignsPage() {
  return MetaAdsPage({ path: "/app/meta-ads/campanhas", view: "campaigns" });
}
