import { getMetaAdsApiConfiguration } from "@/lib/crm/meta-ads/config";
import {
  fetchMetaAdsDashboardData,
  MetaAdsApiError,
  validateMetaAdsRange,
} from "@/lib/crm/meta-ads/marketing-api";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const authorization = await authorizePageRoute("/app/meta-ads");
  if (!authorization.ok) return authorization.response;
  try {
    const query = request ? new URL(request.url).searchParams : new URLSearchParams();
    const range = validateMetaAdsRange(query.get("start"), query.get("end"));
    const data = await fetchMetaAdsDashboardData(
      getMetaAdsApiConfiguration(),
      range ? { range } : {},
    );
    return Response.json(data, { headers: noStoreHeaders() });
  } catch (error) {
    const status = error instanceof MetaAdsApiError ? error.status : 503;
    return Response.json(
      { error: status === 400 ? "invalid_period" : "meta_ads_unavailable" },
      { status, headers: noStoreHeaders(status === 400 ? {} : { "retry-after": "60" }) },
    );
  }
}
