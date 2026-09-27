import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

type InventoryPayload = {
  source?: string;
  reportId?: string;
  generatedAt?: string;
  count?: number;
  items?: unknown[];
};

const REFERENCE_INVENTORY_URL = "https://descomplicapro.com.br/api/inventory";
const INVENTORY_TTL_MS = 30_000;

type InventoryCache = { body: string; fetchedAt: number };
// The upstream inventory is identical for all authorized simulator users.
// Authorization still runs for every request, including cache hits.
let cachedInventory: InventoryCache | null = null;
let pendingInventory: Promise<InventoryCache> | null = null;

async function fetchValidatedInventory(): Promise<InventoryCache> {
  const response = await fetch(REFERENCE_INVENTORY_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("inventory_query_failed");

  const payload = (await response.json()) as InventoryPayload | null;
  if (!payload || !Array.isArray(payload.items) || payload.items.length !== Number(payload.count)) {
    throw new Error("inventory_payload_invalid");
  }

  const result = { body: JSON.stringify(payload), fetchedAt: Date.now() };
  cachedInventory = result;
  return result;
}

export async function GET() {
  const startedAt = performance.now();
  const authorization = await authorizeRoute("crm.simulators.view");
  if (!authorization.ok) return authorization.response;
  const authorizedAt = performance.now();
  const timingHeaders = () => ({
    "server-timing": `auth;dur=${(authorizedAt - startedAt).toFixed(1)}, inventory;dur=${(performance.now() - authorizedAt).toFixed(1)}`,
  });

  try {
    let inventory = cachedInventory;
    let cacheStatus = "HIT";
    if (!inventory || Date.now() - inventory.fetchedAt >= INVENTORY_TTL_MS) {
      cacheStatus = pendingInventory ? "COALESCED" : "MISS";
      pendingInventory ??= fetchValidatedInventory().finally(() => {
        pendingInventory = null;
      });
      inventory = await pendingInventory;
    }

    return new Response(inventory.body, {
      headers: noStoreHeaders({
        ...timingHeaders(),
        "content-type": "application/json; charset=utf-8",
        "x-inventory-cache": cacheStatus,
        "x-inventory-cache-age": String(Math.floor((Date.now() - inventory.fetchedAt) / 1000)),
      }),
    });
  } catch (error) {
    const code =
      error instanceof Error &&
      ["inventory_query_failed", "inventory_payload_invalid"].includes(error.message)
        ? error.message
        : "inventory_unreachable";
    return Response.json(
      { error: code },
      { status: 502, headers: noStoreHeaders(timingHeaders()) },
    );
  }
}
