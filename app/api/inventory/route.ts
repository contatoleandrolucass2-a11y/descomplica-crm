import { authorizeRoute } from "@/lib/security/route-auth";
import { noStoreHeaders } from "@/lib/security/api";

type InventoryPayload = {
  source?: string;
  reportId?: string;
  generatedAt?: string;
  count?: number;
  items?: unknown[];
};

const REFERENCE_INVENTORY_URL = "https://descomplicapro.com.br/api/inventory";

export async function GET() {
  const authorization = await authorizeRoute("crm.simulators.view");
  if (!authorization.ok) return authorization.response;

  try {
    const response = await fetch(REFERENCE_INVENTORY_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return Response.json(
        { error: "inventory_query_failed" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    const payload = (await response.json()) as InventoryPayload;
    if (!Array.isArray(payload.items) || payload.items.length !== Number(payload.count)) {
      return Response.json(
        { error: "inventory_payload_invalid" },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return Response.json(payload, {
      headers: noStoreHeaders(),
    });
  } catch {
    return Response.json(
      { error: "inventory_unreachable" },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
