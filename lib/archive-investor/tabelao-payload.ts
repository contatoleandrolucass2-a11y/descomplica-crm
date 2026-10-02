import type { TabelaoInventoryItem } from "./tabelao-inventory.mjs";

export type TabelaoPayloadItem = TabelaoInventoryItem & {
  id: string;
  businessUnit: string;
  project: string;
  product: string;
  completionDate?: string | null;
  city?: string | null;
  state?: string | null;
};

export type TabelaoPayload = {
  source?: string;
  generatedAt?: string;
  snapshotReferenceDate?: string;
  sourceKind?: "live" | "versioned-snapshot";
  count: number;
  items: TabelaoPayloadItem[];
};

const textFields = [
  "identifier",
  "plant",
  "classification",
  "completionDate",
  "street",
  "streetNumber",
  "neighborhood",
  "district",
  "region",
  "postalCode",
  "city",
  "state",
] as const;
const numberFields = [
  "finalPrice",
  "finalWithKit",
  "unitBonus",
  "tableSlack",
  "cashBackSlack",
  "appraisal",
  "privateArea",
  "progress",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isItem(value: unknown): value is TabelaoPayloadItem {
  return (
    isRecord(value) &&
    ["id", "businessUnit", "project", "product"].every(
      (field) => typeof value[field] === "string",
    ) &&
    textFields.every((field) => value[field] == null || typeof value[field] === "string") &&
    numberFields.every(
      (field) =>
        value[field] == null || (typeof value[field] === "number" && Number.isFinite(value[field])),
    ) &&
    (value.parkingSpaces == null ||
      (typeof value.parkingSpaces === "number" &&
        Number.isSafeInteger(value.parkingSpaces) &&
        value.parkingSpaces >= 0))
  );
}

export async function fetchInventoryPayload(
  url: string,
  signal: AbortSignal,
): Promise<TabelaoPayload> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(25_000)]);
  requestSignal.throwIfAborted();
  const response = await fetch(url, { cache: "no-store", signal: requestSignal });
  if (!response.ok) throw new Error("inventory_unavailable");
  const payload: unknown = await response.json();
  requestSignal.throwIfAborted();
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.items) ||
    !(
      typeof payload.count === "number" ||
      (typeof payload.count === "string" && payload.count.trim() !== "")
    ) ||
    payload.items.length !== Number(payload.count) ||
    !payload.items.every(isItem) ||
    !["source", "generatedAt", "snapshotReferenceDate"].every(
      (field) => payload[field] === undefined || typeof payload[field] === "string",
    ) ||
    !(
      payload.sourceKind === undefined ||
      payload.sourceKind === "live" ||
      payload.sourceKind === "versioned-snapshot"
    )
  ) {
    throw new Error("inventory_payload_invalid");
  }
  return { ...payload, count: Number(payload.count) } as TabelaoPayload;
}

export function needsTabelaoLocationReference(items: readonly TabelaoPayloadItem[]) {
  return items.some((item) =>
    (["street", "streetNumber", "neighborhood"] as const).some((field) => !item[field]?.trim()),
  );
}
