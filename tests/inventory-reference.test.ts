import { describe, expect, it } from "vitest";
import {
  completeMissingInventoryUnitFacts,
  enrichInventoryReferenceFields,
  inventoryIdentityKey,
  uniqueInventoryReferences,
} from "@/lib/archive-investor/inventory-reference";

const reference = {
  id: "synthetic-snapshot-1",
  businessUnit: "Riva",
  project: "Estilo Lapa",
  identifier: "BL02-0715",
  appraisal: 350_000,
  progress: 0.42,
  completionDate: "2028-12-30",
};

describe("late facts for an existing Associativo proposal", () => {
  const current = Object.freeze({
    ...reference,
    id: "selected-snapshot",
    appraisal: null,
    progress: null,
    finalPrice: 234990,
  });
  it("fills only absent appraisal/progress, preserving price, delivery, ID and ordering", () => {
    const other = { ...current, identifier: "ANOTHER-UNIT", id: "another" };
    const late = { ...reference, finalPrice: 230000 };
    const result = completeMissingInventoryUnitFacts([current, other], [late]);
    expect(result).toEqual([
      { ...current, appraisal: reference.appraisal, progress: reference.progress },
      other,
    ]);
    expect(result[1]).toBe(other);
    expect(current.appraisal).toBeNull();
    expect(current.progress).toBeNull();
  });
  it("preserves known values including explicit source zero", () => {
    const known = { ...current, appraisal: 0, progress: 0 };
    expect(completeMissingInventoryUnitFacts([known], [reference])[0]).toBe(known);
  });
  it("rejects a reference with a conflicting or absent delivery date", () => {
    for (const completionDate of ["2035-12-30", null, ""]) {
      expect(
        completeMissingInventoryUnitFacts([current], [{ ...reference, completionDate }])[0],
      ).toBe(current);
    }
  });
  it("accepts actual zero progress from the unique reference", () => {
    expect(
      completeMissingInventoryUnitFacts([current], [{ ...reference, progress: 0 }])[0]?.progress,
    ).toBe(0);
  });
  it.each([NaN, Infinity, -1, 1.01, 15])("does not copy invalid source progress %s", (progress) => {
    expect(
      completeMissingInventoryUnitFacts([current], [{ ...reference, progress }])[0]?.progress,
    ).toBeNull();
  });
  it.each([NaN, Infinity, -1, 0])("does not copy invalid source appraisal %s", (appraisal) => {
    expect(
      completeMissingInventoryUnitFacts([current], [{ ...reference, appraisal }])[0]?.appraisal,
    ).toBeNull();
  });
  it("does not choose a neighbor or ambiguous unit", () => {
    expect(completeMissingInventoryUnitFacts([current], [reference, reference])[0]).toBe(current);
    expect(completeMissingInventoryUnitFacts([current, current], [reference])).toEqual([
      current,
      current,
    ]);
    expect(
      completeMissingInventoryUnitFacts(
        [current],
        [{ ...reference, identifier: "ANOTHER-UNIT" }],
      )[0],
    ).toBe(current);
  });
});

describe("inventory reference identity", () => {
  it("matches presentation-only differences without rewriting either source", () => {
    const live = {
      ...reference,
      id: "synthetic-live-1",
      businessUnit: " RIVA ",
      project: " ESTILO\u00a0 LAPA ",
      identifier: " bl02-0715 ",
      appraisal: null,
      progress: null,
    };
    expect(uniqueInventoryReferences([live], [reference]).get(inventoryIdentityKey(live)!)).toBe(
      reference,
    );
    expect(live.identifier).toBe(" bl02-0715 ");
    expect(reference.identifier).toBe("BL02-0715");
  });

  it.each(["businessUnit", "project", "identifier"] as const)(
    "rejects a missing identity component: %s",
    (field) => {
      const missing = { ...reference, [field]: " " };
      expect(inventoryIdentityKey(missing)).toBeNull();
      expect(uniqueInventoryReferences([missing], [missing]).size).toBe(0);
    },
  );

  it.each(["live", "reference"])("rejects normalized collisions in %s", (side) => {
    const collision = { ...reference, id: "synthetic-duplicate", project: " ESTILO LAPA " };
    const live = side === "live" ? [reference, collision] : [reference];
    const snapshot = side === "reference" ? [reference, collision] : [reference];
    expect(uniqueInventoryReferences(live, snapshot).size).toBe(0);
  });

  it.each([
    { businessUnit: "Direcional" },
    { project: "Estilo Lapa II" },
    { project: "Estilo Lap\u00e1" },
    { identifier: "BL2-0715" },
    { identifier: "BL02-715" },
    { identifier: "BL02/0715" },
    { identifier: "BL02 -0715" },
    { identifier: null },
  ])("does not infer identity from similar names, codes or IDs: %j", (difference) => {
    expect(uniqueInventoryReferences([{ ...reference, ...difference }], [reference]).size).toBe(0);
  });
});

describe("unit facts from inventory references", () => {
  const missing = {
    ...reference,
    id: "synthetic-live-1",
    appraisal: null,
    progress: null,
    completionDate: null,
  };

  it("fills all three missing facts without changing live prices, metadata or either input", () => {
    const live = Object.freeze({ ...missing, finalPrice: 240_000, source: "live" });
    const snapshot = Object.freeze({ ...reference, finalPrice: 230_000, source: "snapshot" });
    const enriched = enrichInventoryReferenceFields([live], [snapshot]);
    expect(enriched).toEqual([
      {
        ...live,
        appraisal: 350_000,
        progress: 0.42,
        completionDate: "2028-12-30",
      },
    ]);
    expect(live.appraisal).toBeNull();
    expect(snapshot.finalPrice).toBe(230_000);
  });

  it("preserves zero progress, reported appraisal and an explicit divergent delivery date", () => {
    const live = { ...missing, appraisal: 360_000, progress: 0, completionDate: "2035-12-30" };
    expect(enrichInventoryReferenceFields([live], [reference])).toEqual([live]);
  });

  it("does not guess a bank appraisal from the price or another unit in the same project", () => {
    const live = { ...missing, finalPrice: 240_000 };
    const otherUnit = { ...reference, identifier: "BL02-0716" };
    expect(enrichInventoryReferenceFields([live], [otherUnit])).toEqual([live]);
    expect(enrichInventoryReferenceFields([live], [])).toEqual([live]);
    expect(enrichInventoryReferenceFields([live], [{ ...live, finalPrice: 999_000 }])).toEqual([
      live,
    ]);
  });

  it.each(["live", "reference"])("does not enrich a %s identity collision", (side) => {
    const duplicateLive = { ...missing, id: "synthetic-live-2", project: " ESTILO LAPA " };
    const duplicateReference = {
      ...reference,
      id: "synthetic-snapshot-2",
      project: " ESTILO LAPA ",
    };
    const live = side === "live" ? [missing, duplicateLive] : [missing];
    const snapshot = side === "reference" ? [reference, duplicateReference] : [reference];
    expect(enrichInventoryReferenceFields(live, snapshot)).toEqual(live);
  });

  it("rejects duplicates even when their available facts agree", () => {
    expect(enrichInventoryReferenceFields([missing], [reference, reference])).toEqual([missing]);
  });

  it("leaves payload items without an identity untouched", () => {
    const items: unknown[] = [
      null,
      false,
      "BL02-0715",
      { id: "same-id" },
      { ...missing, identifier: null },
    ];
    expect(enrichInventoryReferenceFields(items, [reference])).toEqual(items);
  });
});
