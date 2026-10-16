import "server-only";

import type { PermissionKey } from "@/lib/authorization/permissions";

export type InventoryBrandAccess = Readonly<{ riva: boolean; direcional: boolean }>;

export type InventorySourcePayload = Record<string, unknown> & { items: unknown[] };

export function getInventoryBrandAccess(
  permissions: readonly PermissionKey[],
): InventoryBrandAccess {
  return {
    riva: permissions.includes("crm.inventory.riva.view"),
    direcional: permissions.includes("crm.inventory.direcional.view"),
  };
}

export function hasInventoryBrandAccess(access: InventoryBrandAccess): boolean {
  return access.riva || access.direcional;
}

export function filterInventoryByBrand(
  payload: InventorySourcePayload,
  access: InventoryBrandAccess,
) {
  const items = payload.items.filter((item) => {
    if (item === null || typeof item !== "object" || !("businessUnit" in item)) return false;
    if (typeof item.businessUnit !== "string") return false;
    const brand = item.businessUnit.trim().toLowerCase();
    return (brand === "riva" && access.riva) || (brand === "direcional" && access.direcional);
  });

  // Upstream facets, aggregates and custom metadata may describe forbidden units.
  // Keep only provenance fields; derive the visible count from the authorized rows.
  const metadata: Record<string, string> = {};
  for (const key of ["source", "generatedAt", "snapshotReferenceDate", "snapshotSha256"] as const) {
    if (typeof payload[key] === "string") metadata[key] = payload[key];
  }
  if (payload.sourceKind === "live" || payload.sourceKind === "versioned-snapshot") {
    metadata.sourceKind = payload.sourceKind;
  }
  return { ...metadata, count: items.length, items };
}
