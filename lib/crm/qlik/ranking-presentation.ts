import type { QlikRankingIngestion } from "../integrations/contracts";

export type QlikRankingSelection = {
  startMonth: string;
  endMonth: string;
  businessUnit: string;
  query?: string;
  // Caller-supplied evidence metadata, not proof inferred from contract v1.
  coverage: {
    requestId: string;
    businessUnit: string;
    imobMonths: readonly string[] | null;
    developmentMonths: readonly string[] | null;
  };
};

export type QlikRankingRow = {
  key: string;
  name: string;
  businessUnit: string;
  vgvCents: bigint;
  contracts: bigint;
  position: number;
  gapToPreviousCents: bigint | null;
};

export type QlikRankingView =
  | { status: "unavailable"; reason: "coverage_missing" | "developments_missing" }
  | {
      status: "ready" | "empty";
      totals: {
        vgvCents: bigint;
        contracts: bigint;
        /** Distinct represented identities, including zero/zero rows; not a production metric. */
        entities: number;
      };
      podium: QlikRankingRow[];
      rows: QlikRankingRow[];
    };

type Fact = {
  month: string;
  key: string;
  name: string;
  unit: string;
  cents: bigint;
  count: bigint;
};

function fail(code: string): never {
  throw new Error(code);
}

function monthNumber(value: string, year: number): number {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) {
    fail("invalid_month");
  }
  if (Number(value.slice(0, 4)) !== year) fail("year_mismatch");
  return Number(value.slice(5, 7));
}

function cents(value: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(value)) {
    fail("invalid_amount");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function count(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) fail("invalid_count");
  return BigInt(value);
}

function covered(months: readonly string[] | null, year: number, start: number, end: number) {
  if (months === null) return false;
  if (!Array.isArray(months)) fail("invalid_coverage");
  const known = new Set(months.map((month) => monthNumber(month, year)));
  if (known.size !== months.length) fail("duplicate_coverage_month");
  for (let month = start; month <= end; month += 1) {
    if (!known.has(month)) return false;
  }
  return true;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function aggregate(facts: Fact[], selection: QlikRankingSelection, year: number): QlikRankingView {
  const seen = new Set<string>();
  const totals = new Map<string, Omit<QlikRankingRow, "position" | "gapToPreviousCents">>();
  for (const fact of facts) {
    monthNumber(fact.month, year);
    if (fact.unit !== selection.businessUnit) fail("mixed_business_units");
    const identity = JSON.stringify([fact.unit, fact.key]);
    const grain = JSON.stringify([fact.month, fact.unit, fact.key]);
    if (seen.has(grain)) fail("duplicate_fact");
    seen.add(grain);
    if (fact.month < selection.startMonth || fact.month > selection.endMonth) continue;
    const current = totals.get(identity);
    if (current) {
      // Do not silently choose a name when the selected source periods disagree.
      if (current.name !== fact.name) fail("conflicting_entity_names");
      current.vgvCents += fact.cents;
      current.contracts += fact.count;
    } else {
      totals.set(identity, {
        key: fact.key,
        name: fact.name,
        businessUnit: fact.unit,
        vgvCents: fact.cents,
        contracts: fact.count,
      });
    }
  }
  // Key order is a deterministic UI fallback, not an official commercial tie-break.
  const population = [...totals.values()].sort((a, b) =>
    a.vgvCents !== b.vgvCents
      ? a.vgvCents > b.vgvCents
        ? -1
        : 1
      : a.key < b.key
        ? -1
        : a.key > b.key
          ? 1
          : 0,
  );
  const rows = population.map((row, index) => ({
    ...row,
    position: index + 1,
    gapToPreviousCents: index === 0 ? null : population[index - 1]!.vgvCents - row.vgvCents,
  }));
  const query = normalizeSearch(selection.query ?? "");
  return {
    status: rows.length ? "ready" : "empty",
    totals: {
      vgvCents: population.reduce((sum, row) => sum + row.vgvCents, 0n),
      contracts: population.reduce((sum, row) => sum + row.contracts, 0n),
      entities: population.length,
    },
    podium: rows.slice(0, 3),
    rows: query
      ? rows.filter((row) => normalizeSearch(row.name).includes(query))
      : rows.slice(0, 10),
  };
}

/** Pure presentation of validated v1 input plus separately supplied coverage.
 * No authorization, source verification, official ranking policy or snapshot deltas.
 * BigInt output is not directly JSON-serializable.
 */
export function buildQlikRankingPresentation(
  snapshot: QlikRankingIngestion,
  selection: QlikRankingSelection,
): { imobs: QlikRankingView; developments: QlikRankingView } {
  const year = snapshot.referenceYear;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) fail("invalid_year");
  const start = monthNumber(selection.startMonth, year);
  const end = monthNumber(selection.endMonth, year);
  if (start > end) fail("reversed_period");
  if (
    !selection.businessUnit?.trim() ||
    selection.businessUnit.trim() !== selection.businessUnit ||
    selection.coverage.businessUnit !== selection.businessUnit ||
    selection.coverage.requestId !== snapshot.requestId
  )
    fail("scope_metadata_mismatch");
  const imobCovered = covered(selection.coverage.imobMonths, year, start, end);
  const developmentCovered = covered(selection.coverage.developmentMonths, year, start, end);
  const imobs = aggregate(
    snapshot.entries.map((entry) => ({
      month: entry.periodMonth,
      key: entry.imobKey,
      name: entry.imobName,
      unit: selection.coverage.businessUnit,
      cents: cents(entry.vgv),
      count: count(entry.contracts),
    })),
    selection,
    year,
  );
  const developments =
    snapshot.developments === undefined
      ? null
      : aggregate(
          snapshot.developments.map((entry) => ({
            month: entry.periodMonth,
            key: entry.developmentKey,
            name: entry.developmentName,
            unit: entry.businessUnit,
            cents: cents(entry.vgv),
            count: count(entry.contracts),
          })),
          selection,
          year,
        );
  return {
    imobs: imobCovered ? imobs : { status: "unavailable", reason: "coverage_missing" },
    developments:
      developments === null
        ? { status: "unavailable", reason: "developments_missing" }
        : developmentCovered
          ? developments
          : { status: "unavailable", reason: "coverage_missing" },
  };
}
