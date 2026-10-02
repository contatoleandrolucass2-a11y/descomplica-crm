import { normalizeTabelaoPostalCode } from "@/lib/archive-investor/tabelao-region.mjs";
import { lookupInventoryRegion } from "@/lib/inventory/region-lookup";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

export async function GET(request: Request) {
  const authorization = await authorizeRoute("crm.simulators.view");
  if (!authorization.ok) return authorization.response;
  const searchParams = new URL(request.url).searchParams;
  const single = searchParams.getAll("postalCode");
  const batch = searchParams.getAll("postalCodes");
  const isBatch = batch.length === 1 && single.length === 0;
  const values = isBatch
    ? batch[0]!.split(",")
    : single.length === 1 && batch.length === 0
      ? single
      : [];
  const postalCodes = values
    .map(normalizeTabelaoPostalCode)
    .filter((value): value is string => value !== null);
  if (
    values.length === 0 ||
    values.length > 8 ||
    postalCodes.length !== values.length ||
    new Set(postalCodes).size !== postalCodes.length
  )
    return Response.json(
      { error: "invalid_postal_code" },
      { status: 400, headers: noStoreHeaders() },
    );
  const results = await Promise.all(postalCodes.map(lookupInventoryRegion));
  return Response.json(isBatch ? { results } : results[0], { headers: noStoreHeaders() });
}
