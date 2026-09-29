import { noStoreHeaders } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

const REFERENCE_INVENTORY_URL = "https://descomplicapro.com.br/api/inventory";
const INVENTORY_TTL_MS = 30_000;
const INVENTORY_RETRY_DELAY_MS = 5_000;

type InventoryCache = { body: string; fetchedAt: number };
// The upstream inventory is identical for all authorized simulator users.
// Authorization still runs for every request, including cache hits.
let cachedInventory: InventoryCache | null = null;
let pendingInventory: Promise<InventoryCache> | null = null;
let inventoryFailure: { code: string; retryAt: number } | null = null;

function inventoryErrorCode(error: unknown): string {
  return error instanceof Error &&
    ["inventory_query_failed", "inventory_payload_invalid"].includes(error.message)
    ? error.message
    : "inventory_unreachable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function fetchValidatedInventory(): Promise<InventoryCache> {
  const response = await fetch(REFERENCE_INVENTORY_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("inventory_query_failed");

  const payload: unknown = await response.json();
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.items) ||
    !(
      typeof payload.count === "number" ||
      (typeof payload.count === "string" && payload.count.trim() !== "")
    ) ||
    payload.items.length !== Number(payload.count) ||
    !payload.items.every(
      (item: unknown) =>
        isRecord(item) &&
        ["id", "businessUnit", "project", "product"].every(
          (field) => typeof item[field] === "string",
        ),
    )
  ) {
    throw new Error("inventory_payload_invalid");
  }

  const result = { body: JSON.stringify(payload), fetchedAt: Date.now() };
  cachedInventory = result;
  inventoryFailure = null;
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
      if (inventoryFailure && Date.now() < inventoryFailure.retryAt) {
        throw new Error(inventoryFailure.code);
      }
      cacheStatus = pendingInventory ? "COALESCED" : "MISS";
      pendingInventory ??= fetchValidatedInventory()
        .catch((error: unknown) => {
          // Only the shared attempt starts the cooldown, never an individual retry.
          inventoryFailure = {
            code: inventoryErrorCode(error),
            retryAt: Date.now() + INVENTORY_RETRY_DELAY_MS,
          };
          throw error;
        })
        .finally(() => {
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
    const retryAfter = Math.max(
      0,
      Math.ceil(((inventoryFailure?.retryAt ?? 0) - Date.now()) / 1000),
    );
    return Response.json(
      { error: inventoryErrorCode(error) },
      {
        status: 502,
        headers: noStoreHeaders({
          ...timingHeaders(),
          ...(retryAfter > 0 ? { "retry-after": String(retryAfter) } : {}),
        }),
      },
    );
  }
}
