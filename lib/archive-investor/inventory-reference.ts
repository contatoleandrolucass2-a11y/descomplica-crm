type InventoryIdentity = {
  businessUnit: string;
  project: string;
  identifier: string | null;
};

export function inventoryIdentityKey(item: InventoryIdentity): string | null {
  const parts = [item.businessUnit, item.project, item.identifier];
  if (parts.some((part) => typeof part !== "string" || part.trim() === "")) return null;
  // Keep accents, punctuation and leading zeroes: they can distinguish units.
  return JSON.stringify(
    parts.map((part) =>
      part!.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"),
    ),
  );
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

type InventoryReferenceFields = InventoryIdentity & {
  appraisal?: number | null;
  progress?: number | null;
  completionDate?: string | null;
};

export function completeMissingInventoryUnitFacts<T extends InventoryReferenceFields>(
  items: readonly T[],
  reference: readonly InventoryReferenceFields[],
): T[] {
  const matches = uniqueInventoryReferences(items, reference);
  return items.map((item) => {
    const key = inventoryIdentityKey(item);
    const source = key === null ? undefined : matches.get(key);
    if (!source || !item.completionDate || source.completionDate !== item.completionDate)
      return item;
    const appraisal =
      item.appraisal == null &&
      typeof source.appraisal === "number" &&
      Number.isFinite(source.appraisal) &&
      source.appraisal > 0
        ? source.appraisal
        : item.appraisal;
    const progress =
      item.progress == null &&
      typeof source.progress === "number" &&
      Number.isFinite(source.progress) &&
      source.progress >= 0 &&
      source.progress <= 1
        ? source.progress
        : item.progress;
    // A late source may complete absent facts, never replace the selected commercial proposal.
    return appraisal === item.appraisal && progress === item.progress
      ? item
      : { ...item, appraisal, progress };
  });
}

function hasInventoryIdentity<T>(value: T): value is T & InventoryReferenceFields {
  if (value === null || typeof value !== "object") return false;
  return (
    "businessUnit" in value &&
    typeof value.businessUnit === "string" &&
    "project" in value &&
    typeof value.project === "string" &&
    "identifier" in value &&
    typeof value.identifier === "string"
  );
}

export function enrichInventoryReferenceFields<T>(
  items: readonly T[],
  reference: readonly unknown[],
  { allowCompletionDateFallback = true }: { allowCompletionDateFallback?: boolean } = {},
): T[] {
  const referenceByKey = uniqueInventoryReferences(
    items.filter(hasInventoryIdentity),
    reference.filter(hasInventoryIdentity),
  );
  return items.map((item) => {
    if (!hasInventoryIdentity(item)) return item;
    const key = inventoryIdentityKey(item);
    const source = key === null ? undefined : referenceByKey.get(key);
    if (!source) return item;

    // Absent facts require a unique unit; live-required delivery dates cannot use the snapshot.
    return {
      ...item,
      appraisal: item.appraisal ?? source.appraisal ?? null,
      progress: item.progress ?? source.progress ?? null,
      ...(allowCompletionDateFallback
        ? { completionDate: item.completionDate ?? source.completionDate ?? null }
        : {}),
    };
  });
}
