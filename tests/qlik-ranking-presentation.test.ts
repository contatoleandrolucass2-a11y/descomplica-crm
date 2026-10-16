import { describe, expect, it } from "vitest";
import type { QlikRankingIngestion } from "../lib/crm/integrations/contracts";
import {
  buildQlikRankingPresentation,
  type QlikRankingSelection,
} from "../lib/crm/qlik/ranking-presentation";

function fixture(): { snapshot: QlikRankingIngestion; selection: QlikRankingSelection } {
  const requestId = "00000000-0000-4000-8000-000000000001";
  return {
    snapshot: {
      schemaVersion: 1,
      requestId,
      referenceYear: 2026,
      generatedAt: "2026-03-01T12:00:00Z",
      entries: [
        {
          periodMonth: "2026-01-01",
          imobKey: "a",
          imobName: "Synthetic A",
          vgv: "0.10",
          contracts: 1,
        },
      ],
      developments: [],
    },
    selection: {
      startMonth: "2026-01-01",
      endMonth: "2026-02-01",
      businessUnit: "Direcional",
      coverage: {
        requestId,
        businessUnit: "Direcional",
        imobMonths: ["2026-01-01", "2026-02-01"],
        developmentMonths: ["2026-01-01", "2026-02-01"],
      },
    },
  };
}

describe("offline Qlik ranking presentation", () => {
  it("counts represented entities including zero/zero rows without reconciling dimension totals", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries.push({
      ...snapshot.entries[0]!,
      imobKey: "zero",
      imobName: "Synthetic Zero",
      vgv: "0",
      contracts: 0,
    });
    snapshot.developments = [
      {
        periodMonth: "2026-01-01",
        businessUnit: "Direcional",
        developmentKey: "p",
        developmentName: "Synthetic Product",
        vgv: "0.10",
        contracts: 3,
      },
      {
        periodMonth: "2026-01-01",
        businessUnit: "Direcional",
        developmentKey: "zero",
        developmentName: "Synthetic Zero",
        vgv: "0",
        contracts: 0,
      },
    ];
    const { imobs, developments } = buildQlikRankingPresentation(snapshot, selection);
    if (imobs.status === "unavailable" || developments.status === "unavailable")
      throw new Error("unexpected unavailable");
    expect(imobs.totals).toEqual({ vgvCents: 10n, contracts: 1n, entities: 2 });
    expect(developments.totals).toEqual({ vgvCents: 10n, contracts: 3n, entities: 2 });
    expect(imobs.rows.map((row) => row.key)).toContain("zero");
    expect(developments.rows.map((row) => row.key)).toContain("zero");
    expect(imobs.totals).not.toHaveProperty("producingEntities");
  });

  it("keeps legitimate zero production and does not turn a search miss into empty source data", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries[0]!.vgv = "0";
    snapshot.entries[0]!.contracts = 0;
    const result = buildQlikRankingPresentation(snapshot, {
      ...selection,
      query: "not present",
    }).imobs;
    if (result.status === "unavailable") throw new Error("unexpected unavailable");
    expect(result.status).toBe("ready");
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual({ vgvCents: 0n, contracts: 0n, entities: 1 });
  });

  it("aggregates products across months by stable identity and requires their own coverage", () => {
    const { snapshot, selection } = fixture();
    snapshot.developments = ["2026-01-01", "2026-02-01"].map((periodMonth) => ({
      periodMonth,
      businessUnit: "Direcional",
      developmentKey: "product-a",
      developmentName: "Synthetic Product",
      vgv: "0.15",
      contracts: 1,
    }));
    const result = buildQlikRankingPresentation(snapshot, selection).developments;
    if (result.status === "unavailable") throw new Error("unexpected unavailable");
    expect(result.totals).toEqual({ vgvCents: 30n, contracts: 2n, entities: 1 });
    expect(result.rows[0]!.key).toBe("product-a");
    expect(result.rows[0]!.businessUnit).toBe("Direcional");
    selection.coverage.developmentMonths = ["2026-01-01"];
    expect(buildQlikRankingPresentation(snapshot, selection).developments).toEqual({
      status: "unavailable",
      reason: "coverage_missing",
    });
  });

  it("sums cents beyond safe Number precision and computes exact gaps", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries[0]!.vgv = "9999999999999999.99";
    snapshot.entries.push(
      { ...snapshot.entries[0]!, periodMonth: "2026-02-01", vgv: "0.02" },
      { ...snapshot.entries[0]!, imobKey: "b", imobName: "Synthetic B" },
    );
    const result = buildQlikRankingPresentation(snapshot, selection).imobs;
    expect(result.status).toBe("ready");
    if (result.status === "unavailable") throw new Error("unexpected unavailable");
    expect(result.rows[0]!.vgvCents).toBe(1000000000000000001n);
    expect(result.rows[1]!.gapToPreviousCents).toBe(2n);
    expect(result.rows[0]!.gapToPreviousCents).toBeNull();
    expect(result.totals).toEqual({ vgvCents: 2000000000000000000n, contracts: 3n, entities: 2 });
  });

  it("keeps homonyms distinct and uses key order for equal VGV, not source rank", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries = ["b", "a"].map((imobKey, index) => ({
      ...snapshot.entries[0]!,
      imobKey,
      imobName: "Same Name",
      sourceRankVgv: index + 1,
    }));
    snapshot.developments = ["p2", "p1"].map((developmentKey) => ({
      periodMonth: "2026-01-01",
      businessUnit: "Direcional",
      developmentKey,
      developmentName: "Same Product",
      vgv: "0.20",
      contracts: 2,
    }));
    const result = buildQlikRankingPresentation(snapshot, selection);
    if (result.imobs.status === "unavailable" || result.developments.status === "unavailable")
      throw new Error("unexpected unavailable");
    expect(result.imobs.rows.map((row) => row.key)).toEqual(["a", "b"]);
    expect(result.imobs.rows[1]!.gapToPreviousCents).toBe(0n);
    expect(result.developments.rows.map((row) => row.key)).toEqual(["p1", "p2"]);
    expect(result.developments.totals.vgvCents).toBe(40n);
  });

  it("computes population totals and podium before top10 or search", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries = Array.from({ length: 12 }, (_, i) => ({
      ...snapshot.entries[0]!,
      imobKey: `key-${String(i).padStart(2, "0")}`,
      imobName: `Synthetic ${i}`,
      vgv: String(12 - i),
    }));
    const original = structuredClone(snapshot);
    const all = buildQlikRankingPresentation(snapshot, selection).imobs;
    const search = buildQlikRankingPresentation(snapshot, {
      ...selection,
      query: "synthetic 11",
    }).imobs;
    if (all.status === "unavailable" || search.status === "unavailable")
      throw new Error("unexpected unavailable");
    expect(all.rows).toHaveLength(10);
    expect(search.rows).toHaveLength(1);
    expect(search.rows[0]!.position).toBe(12);
    expect(search.rows[0]!.gapToPreviousCents).toBe(100n);
    expect(search.totals).toEqual(all.totals);
    expect(search.totals.entities).toBe(12);
    expect(search.podium).toEqual(all.podium);
    expect(snapshot).toEqual(original);
    expect(search.rows[0]).not.toHaveProperty("delta");
  });

  it("preserves names while normalizing only search", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries[0]!.imobName = "Sintética Á";
    const result = buildQlikRankingPresentation(snapshot, {
      ...selection,
      query: " sintetica a ",
    }).imobs;
    if (result.status === "unavailable") throw new Error("unexpected unavailable");
    expect(result.rows[0]!.name).toBe("Sintética Á");
  });

  it("distinguishes declared empty, omitted developments and missing coverage", () => {
    const { snapshot, selection } = fixture();
    const empty = buildQlikRankingPresentation(snapshot, selection).developments;
    expect(empty).toEqual({
      status: "empty",
      totals: { vgvCents: 0n, contracts: 0n, entities: 0 },
      rows: [],
      podium: [],
    });
    delete snapshot.developments;
    expect(buildQlikRankingPresentation(snapshot, selection).developments).toEqual({
      status: "unavailable",
      reason: "developments_missing",
    });
    selection.coverage.imobMonths = ["2026-01-01"];
    expect(buildQlikRankingPresentation(snapshot, selection).imobs).toEqual({
      status: "unavailable",
      reason: "coverage_missing",
    });
    selection.coverage.imobMonths = null;
    expect(buildQlikRankingPresentation(snapshot, selection).imobs.status).toBe("unavailable");
  });

  it("selects inclusive months without treating missing rows as missing coverage", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries.push(
      { ...snapshot.entries[0]!, periodMonth: "2026-02-01", vgv: "0.20" },
      { ...snapshot.entries[0]!, periodMonth: "2026-03-01", vgv: "900.00" },
    );
    const result = buildQlikRankingPresentation(snapshot, selection).imobs;
    if (result.status === "unavailable") throw new Error("unexpected unavailable");
    expect(result.totals.vgvCents).toBe(30n);
    selection.startMonth = selection.endMonth = "2026-04-01";
    selection.coverage.imobMonths = ["2026-04-01"];
    expect(buildQlikRankingPresentation(snapshot, selection).imobs.status).toBe("empty");
  });

  it.each(["2026-00-01", "2026-13-01", "2026-02-30", "2026-1-01", "2026-01", "2025-12-01"])(
    "rejects invalid or out-of-year month %s in selection, facts and coverage",
    (month) => {
      for (const target of ["selection", "fact", "coverage"]) {
        const { snapshot, selection } = fixture();
        if (target === "selection") selection.startMonth = month;
        if (target === "fact") snapshot.entries[0]!.periodMonth = month;
        if (target === "coverage") selection.coverage.imobMonths = [month];
        expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow();
      }
    },
  );

  it("rejects reversed periods and invalid years", () => {
    const { snapshot, selection } = fixture();
    expect(() =>
      buildQlikRankingPresentation(snapshot, { ...selection, startMonth: "2026-03-01" }),
    ).toThrow("reversed_period");
    expect(() =>
      buildQlikRankingPresentation({ ...snapshot, referenceYear: 2019 }, selection),
    ).toThrow("invalid_year");
  });

  it("rejects duplicate facts for either dimension, even outside selection", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries.push({ ...snapshot.entries[0]! });
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow("duplicate_fact");
    snapshot.entries.pop();
    const product = {
      periodMonth: "2026-03-01",
      businessUnit: "Direcional",
      developmentKey: "p",
      developmentName: "Synthetic Product",
      vgv: "1",
      contracts: 1,
    };
    snapshot.developments = [product, { ...product }];
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow("duplicate_fact");
  });

  it("requires explicit matching mono-unit metadata bound to this request", () => {
    const { snapshot, selection } = fixture();
    for (const coverage of [
      { ...selection.coverage, businessUnit: "Other" },
      { ...selection.coverage, requestId: "another-request" },
    ]) {
      expect(() => buildQlikRankingPresentation(snapshot, { ...selection, coverage })).toThrow(
        "scope_metadata_mismatch",
      );
    }
    expect(() =>
      buildQlikRankingPresentation(snapshot, { ...selection, businessUnit: "" }),
    ).toThrow("scope_metadata_mismatch");
    snapshot.developments = [
      {
        periodMonth: "2026-01-01",
        businessUnit: "Other",
        developmentKey: "p",
        developmentName: "Synthetic",
        vgv: "1",
        contracts: 1,
      },
    ];
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow("mixed_business_units");
  });

  it("rejects conflicting names rather than silently relabeling an entity", () => {
    const { snapshot, selection } = fixture();
    snapshot.entries.push({
      ...snapshot.entries[0]!,
      periodMonth: "2026-02-01",
      imobName: "Different",
    });
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow(
      "conflicting_entity_names",
    );
  });

  it("rejects duplicate coverage declarations and malformed numeric values", () => {
    const { snapshot, selection } = fixture();
    selection.coverage.imobMonths = ["2026-01-01", "2026-01-01"];
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow(
      "duplicate_coverage_month",
    );
    selection.coverage.imobMonths = null;
    snapshot.entries[0]!.vgv = "1.001";
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow("invalid_amount");
    snapshot.entries[0]!.vgv = "1";
    snapshot.entries[0]!.contracts = 1.5;
    expect(() => buildQlikRankingPresentation(snapshot, selection)).toThrow("invalid_count");
  });
});
