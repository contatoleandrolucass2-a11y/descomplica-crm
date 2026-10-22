import { getMetaAdsApiConfiguration } from "@/lib/crm/meta-ads/config";
import { fetchMetaAdsDashboardData, MetaAdsApiError } from "@/lib/crm/meta-ads/marketing-api";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizePageRoute("/app/meta-ads");
  if (!authorization.ok) return authorization.response;
  try {
    const data = await fetchMetaAdsDashboardData(getMetaAdsApiConfiguration());
    return Response.json(data, { headers: noStoreHeaders() });
  } catch (error) {
    const status = error instanceof MetaAdsApiError ? error.status : 503;
    return Response.json(
      { error: "meta_ads_unavailable" },
      { status, headers: noStoreHeaders({ "retry-after": "60" }) },
    );
  }
}
