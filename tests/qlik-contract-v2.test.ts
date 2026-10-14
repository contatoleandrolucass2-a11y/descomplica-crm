import { describe, expect, it } from "vitest";

import {
  createQlikRankingV2Schema,
  qlikRankingV2JsonbByteLength,
  qlikRankingV2Schema,
  type QlikRankingV2,
} from "@/lib/crm/qlik/contracts-v2";

const NOW = new Date("2026-10-14T12:00:00.000Z");
const schema = createQlikRankingV2Schema(() => NOW);

function fixture(): QlikRankingV2 {
  const cube = {
    coverage: { state: "complete" as const, sourceRows: 2 },
    nativeTotals: { vgv: "0.30", contracts: 3 },
    rows: [
      { key: "a-1", name: "First", vgv: "0.10", contracts: 1 },
      { key: "b_2", name: "Second", vgv: "0.20", contracts: 2 },
    ],
  };
  return {
    schemaVersion: 2,
    batchId: "9f37407b-251c-43f3-8370-01b49e37ac40",
    requestId: "e0cfacb3-ea4b-4ca8-9587-a449e7dec1d3",
    startedAt: "2026-10-14T11:00:00Z",
    completedAt: "2026-10-14T11:30:00Z",
    source: {
      appId: "7c000871-8b32-4c0f-bfd5-4b9d46946575",
      sheetId: "772db774-0bc2-42d8-ac11-3e4917bd0d37",
      mappingSha256: "a".repeat(64),
      reloadTimestamp: "2026-10-14T10:00:00Z",
    },
    scope: { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" },
    months: [{ periodMonth: "2026-01-01", imobs: cube, developments: structuredClone(cube) }],
  };
}

describe("isolated Qlik ranking v2 contract", () => {
  it("exports a default schema and preserves the JSON payload without coercion", () => {
    const input = fixture();
    expect(schema.parse(input)).toEqual(input);
    expect(qlikRankingV2Schema).toBeDefined();
  });

  it("accepts twelve sorted months and zero-row cubes only with zero totals", () => {
    const input = fixture();
    const empty = {
      coverage: { state: "complete" as const, sourceRows: 0 },
      nativeTotals: { vgv: "0.00", contracts: 0 },
      rows: [],
    };
    input.months = Array.from({ length: 12 }, (_, index) => ({
      periodMonth: `2024-${String(index + 1).padStart(2, "0")}-01`,
      imobs: structuredClone(empty),
      developments: structuredClone(empty),
    }));
    expect(schema.safeParse(input).success).toBe(true);
    input.months[0]!.imobs.nativeTotals.vgv = "0.01";
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each(["imobs", "developments"] as const)(
    "checks exact %s totals beyond floating-point precision",
    (kind) => {
      const input = fixture();
      const cube = input.months[0]![kind];
      cube.rows[0]!.vgv = "9007199254740993.01";
      cube.rows[1]!.vgv = "0.02";
      cube.nativeTotals.vgv = "9007199254740993.03";
      expect(schema.safeParse(input).success).toBe(true);
      cube.nativeTotals.vgv = "9007199254740993.04";
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it.each(["vgv", "contracts", "sourceRows"] as const)("rejects inconsistent %s", (field) => {
    const input = fixture();
    const cube = input.months[0]!.imobs;
    if (field === "sourceRows") cube.coverage.sourceRows = 1;
    else if (field === "vgv") cube.nativeTotals.vgv = "0.31";
    else cube.nativeTotals.contracts = 4;
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each([
    "0",
    "0.1",
    "01.00",
    "-0.00",
    "1.000",
    "1e2",
    " 1.00",
    "10000000000000000.00",
    "NaN",
    "Infinity",
    "1.00\n",
  ])("rejects noncanonical money %j without throwing", (amount) => {
    const input = fixture();
    input.months[0]!.imobs.rows[0]!.vgv = amount;
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0.5, 1_000_000_001, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe or out-of-range count %s",
    (count) => {
      const input = fixture();
      input.months[0]!.imobs.rows[0]!.contracts = count;
      input.months[0]!.imobs.nativeTotals.contracts = count;
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it("enforces the 5000-row bound and sourceRows equality", () => {
    const input = fixture();
    const cube = input.months[0]!.imobs;
    cube.rows = Array.from({ length: 5000 }, (_, index) => ({
      key: `key-${String(index).padStart(4, "0")}`,
      name: "Test",
      vgv: "0.00",
      contracts: 0,
    }));
    cube.coverage.sourceRows = 5000;
    cube.nativeTotals = { vgv: "0.00", contracts: 0 };
    expect(schema.safeParse(input).success).toBe(true);
    cube.rows.push({ key: "key-5000", name: "Test", vgv: "0.00", contracts: 0 });
    cube.coverage.sourceRows = 5001;
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each(["", "A", "a/b", "a b", "a--b", "a".repeat(129)])(
    "rejects invalid stable key %j",
    (key) => {
      const input = fixture();
      input.months[0]!.imobs.rows[0]!.key = key;
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it.each(["duplicate", "unsorted"])("rejects %s row keys", (mode) => {
    const input = fixture();
    const rows = input.months[0]!.developments.rows;
    if (mode === "duplicate") rows[1]!.key = rows[0]!.key;
    else rows.reverse();
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each(["", "x".repeat(257)])("rejects invalid name length %s", (name) => {
    const input = fixture();
    input.months[0]!.imobs.rows[0]!.name = name;
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each([
    " leading",
    "trailing ",
    " ",
    "bad\nlabel",
    "bad\tlabel",
    "bad\rlabel",
    "bad\u0000label",
    "bad\u001flabel",
    "bad\u007flabel",
    "bad\u0085label",
    "\ud800",
    "\udfff",
  ])("rejects untrimmed, control or malformed Unicode label %j", (name) => {
    for (const kind of ["imobs", "developments"] as const) {
      const input = fixture();
      input.months[0]![kind].rows[0]!.name = name;
      expect(schema.safeParse(input).success).toBe(false);
    }
  });

  it.each(["Two words", 'A, B: {"C"} \\ D', "A\u00e7\u00e3o \u754c \u{1f3e2}", "\u00a0Name\u00a0"])(
    "preserves valid labels without normalization: %j",
    (name) => {
      const input = fixture();
      input.months[0]!.imobs.rows[0]!.name = name;
      expect(schema.parse(input).months[0]!.imobs.rows[0]!.name).toBe(name);
    },
  );

  it.each([2020, 2100])("accepts reference year boundary %s", (year) => {
    const input = fixture();
    input.months[0]!.periodMonth = `${year}-01-01`;
    expect(schema.safeParse(input).success).toBe(true);
  });

  it.each([2019, 2101])("rejects reference year outside SQL range: %s", (year) => {
    const input = fixture();
    input.months[0]!.periodMonth = `${year}-01-01`;
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each([
    [],
    ["2026-01-01", "2026-01-01"],
    ["2026-02-01", "2026-01-01"],
    ["2025-12-01", "2026-01-01"],
    ["2026-13-01"],
    ["2026-02-29"],
    ["2024-02-29"],
    ["2026-2-01"],
  ])("rejects invalid month set %j", (...periods) => {
    const input = fixture();
    const month = input.months[0]!;
    input.months = periods.map((periodMonth) => ({ ...structuredClone(month), periodMonth }));
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each([
    "2026-02-29T10:00:00Z",
    "2024-02-30T10:00:00Z",
    "2026-04-31T10:00:00Z",
    "2026-10-14T24:00:00Z",
    "2026-10-14",
    "2026-10-14T10:00:00+03:00",
  ])("rejects invalid/non-UTC datetime %s", (time) => {
    const input = fixture();
    input.startedAt = time;
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("accepts leap days and exact five-minute clock skew, but rejects one microsecond later", () => {
    const input = fixture();
    input.source.reloadTimestamp = "2024-02-29T10:00:00.123456Z";
    input.completedAt = "2026-10-14T12:05:00.000000Z";
    expect(schema.safeParse(input).success).toBe(true);
    input.completedAt = "2026-10-14T12:05:00.000001Z";
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("checks reload versus start and start versus completion at microsecond precision", () => {
    const input = fixture();
    input.source.reloadTimestamp = input.startedAt;
    expect(schema.safeParse(input).success).toBe(true);
    input.source.reloadTimestamp = "2026-10-14T11:00:00.000001Z";
    expect(schema.safeParse(input).success).toBe(false);
    input.source.reloadTimestamp = input.startedAt;
    input.startedAt = "2026-10-14T11:30:00.000001Z";
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("evaluates the injected clock on each parse and rejects an invalid clock", () => {
    let now = NOW;
    const dynamic = createQlikRankingV2Schema(() => now);
    expect(dynamic.safeParse(fixture()).success).toBe(true);
    now = new Date("2026-10-14T10:00:00Z");
    expect(dynamic.safeParse(fixture()).success).toBe(false);
    now = new Date(NaN);
    expect(dynamic.safeParse(fixture()).success).toBe(false);
  });

  it.each(["root", "source", "scope", "month", "cube", "coverage", "nativeTotals", "row"])(
    "rejects unknown fields at %s",
    (level) => {
      const input = fixture();
      const month = input.months[0]!;
      const targets: Record<string, object> = {
        root: input,
        source: input.source,
        scope: input.scope,
        month,
        cube: month.imobs,
        coverage: month.imobs.coverage,
        nativeTotals: month.imobs.nativeTotals,
        row: month.imobs.rows[0]!,
      };
      Object.assign(targets[level]!, { contentSha256: "a".repeat(64) });
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it.each([
    "schemaVersion",
    "batchId",
    "requestId",
    "appId",
    "sheetId",
    "mappingSha256",
    "businessUnit",
    "regional",
    "channel",
    "state",
  ])("rejects incorrect identity/scope %s", (field) => {
    const input = fixture();
    const target =
      field in input.source
        ? input.source
        : field in input.scope
          ? input.scope
          : field === "state"
            ? input.months[0]!.imobs.coverage
            : input;
    Object.assign(target, { [field]: "invalid" });
    expect(schema.safeParse(input).success).toBe(false);
  });

  it.each(["money", "key", "hash", "timestamp", "uuid"])(
    "rejects a trailing newline in %s even when totals agree",
    (field) => {
      const input = fixture();
      if (field === "money") input.months[0]!.imobs.rows[0]!.vgv += "\n";
      if (field === "key") input.months[0]!.imobs.rows[0]!.key += "\n";
      if (field === "hash") input.source.mappingSha256 += "\n";
      if (field === "timestamp") input.startedAt += "\n";
      if (field === "uuid") input.batchId += "\n";
      expect(schema.safeParse(input).success).toBe(false);
    },
  );

  it("counts UTF-8 bytes, not characters, for the 4000000-byte payload limit", () => {
    const input = fixture();
    const cube = input.months[0]!.imobs;
    cube.rows = Array.from({ length: 4800 }, (_, index) => ({
      key: `key-${String(index).padStart(4, "0")}`,
      name: "\u754c".repeat(256),
      vgv: "0.00",
      contracts: 0,
    }));
    cube.coverage.sourceRows = 4800;
    cube.nativeTotals = { vgv: "0.00", contracts: 0 };
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThanOrEqual(4_000_000);
    expect(schema.safeParse(input).success).toBe(true);
    cube.rows.push(
      ...Array.from({ length: 100 }, (_, index) => ({
        key: `key-${4800 + index}`,
        name: "\u754c".repeat(256),
        vgv: "0.00",
        contracts: 0,
      })),
    );
    cube.coverage.sourceRows = 4900;
    expect(Buffer.byteLength(JSON.stringify(input))).toBeGreaterThan(4_000_000);
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(4 * 1024 * 1024);
    expect(schema.safeParse(input).success).toBe(false);
    input.months[0]!.developments = structuredClone(cube);
    expect(JSON.stringify(input).length).toBeLessThan(4_000_000);
    expect(Buffer.byteLength(JSON.stringify(input))).toBeGreaterThan(4_000_000);
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("rejects JSONB overhead above 4M even when compact JSON is below 4M", () => {
    const input = fixture();
    const cube = input.months[0]!.imobs;
    cube.rows = Array.from({ length: 4820 }, (_, index) => ({
      key: `key-${String(index).padStart(4, "0")}`,
      name: "\u754c".repeat(256),
      vgv: "0.00",
      contracts: 0,
    }));
    cube.coverage.sourceRows = cube.rows.length;
    cube.nativeTotals = { vgv: "0.00", contracts: 0 };
    expect(Buffer.byteLength(JSON.stringify(input), "utf8")).toBeLessThan(4_000_000);
    expect(qlikRankingV2JsonbByteLength(input)).toBeGreaterThan(4_000_000);
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "payload must fit PostgreSQL JSONB within 4000000 bytes",
      );
    }
  });
});

describe("Qlik JSONB byte measurement", () => {
  it.each([
    "null",
    "true",
    "false",
    "0",
    "1000000000",
    '"text"',
    "[]",
    "{}",
    '{"a": [1, 2], "b": {"x": null}}',
    '{"text": "a,b: {} []", "unicode": "\u00e7\u754c\u{1f3e2}"}',
    String.raw`{"escaped": "\\ \" \n \t \b \f \r \u0001"}`,
  ])("counts PostgreSQL-style serialization %s", (serialized) => {
    expect(qlikRankingV2JsonbByteLength(JSON.parse(serialized))).toBe(
      Buffer.byteLength(serialized, "utf8"),
    );
  });

  it("key order and Unicode escape spelling do not change decoded JSONB size", () => {
    const first = JSON.parse(String.raw`{"b":"\u00e7","a":"\ud83c\udfe2"}`);
    const second = { a: "\u{1f3e2}", b: "\u00e7" };
    expect(qlikRankingV2JsonbByteLength(first)).toBe(qlikRankingV2JsonbByteLength(second));
    expect(qlikRankingV2JsonbByteLength(first)).toBe(
      Buffer.byteLength('{"a": "\u{1f3e2}", "b": "\u00e7"}', "utf8"),
    );
  });

  it.each(["\u0000", "\ud800", "\udfff", 1.25, Infinity, NaN, undefined, 1n, new Date(0)])(
    "fails closed outside the contract's JSONB representation: %s",
    (value) => expect(qlikRankingV2JsonbByteLength(value)).toBe(Infinity),
  );
});
