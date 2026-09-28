type InventoryIdentity = {
  businessUnit: string;
  project: string;
  identifier: string | null;
};

export function inventoryIdentityKey(item: InventoryIdentity): string | null {
  if (typeof item.identifier !== "string" || item.identifier.trim() === "") return null;
  return JSON.stringify([item.businessUnit, item.project, item.identifier]);
}

export function uniqueInventoryReferences<T extends InventoryIdentity>(
  items: readonly InventoryIdentity[],
  reference: readonly T[],
): Map<string, T> {
  const sourceCounts = new Map<string, number>();
  const referenceCounts = new Map<string, number>();
  for (const [rows, counts] of [
    [items, sourceCounts],
    [reference, referenceCounts],
  ] as const) {
    for (const item of rows) {
      const key = inventoryIdentityKey(item);
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const unique = new Map<string, T>();
  for (const item of reference) {
    const key = inventoryIdentityKey(item);
    if (key !== null && sourceCounts.get(key) === 1 && referenceCounts.get(key) === 1) {
      unique.set(key, item);
    }
  }
  return unique;
}
