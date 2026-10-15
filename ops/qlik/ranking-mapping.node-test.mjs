import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createRankingMapping, PRODUCTION_DEFINITION } from "./ranking-mapping.mjs";
import { collectQlikRanking } from "./qix-ranking.mjs";

const CALENDAR = "=Year([DT])&Num(Month([DT]),'00')";
const NOW = "2026-10-15T12:00:00.000Z";
const digest = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// Every pin/field below is synthetic. Never use this definition in production.
function syntheticDefinition() {
  const cube = (role) => ({
    objectId: `synthetic-${role}`,
    cubeSha256: digest(`synthetic-cube-${role}`),
    idField: `Synthetic.${role}.Id`,
    idEncoding: "plain",
    vgvMeasureIndex: 1,
    contractsMeasureIndex: 0,
    masterPins: [
      { kind: "dimension", id: `synthetic-${role}-name`, sha256: digest(`synthetic-name-${role}`) },
      { kind: "measure", id: `synthetic-${role}-vgv`, sha256: digest(`synthetic-vgv-${role}`) },
    ],
  });
  return {
    verified: true,
    provenance: {
      kind: "synthetic-fixture",
      observedAt: "2020-01-01T03:00:00.000Z",
      metadataSha256: digest("synthetic-metadata-only"),
    },
    filters: [
      { field: "Synthetic.Company", value: "Direcional" },
      { field: "Synthetic.Region", value: "SP CAPITAL" },
      { field: "Synthetic.Channel", value: "CANAL IMOB" },
    ],
    calendar: { expression: CALENDAR, selectionFields: ["Synthetic.Date"] },
    cubes: { imobs: cube("imobs"), developments: cube("developments") },
  };
}

function create({ instant = NOW, definition = syntheticDefinition() } = {}) {
  return createRankingMapping({ now: () => new Date(instant), definition });
}

function syntheticAliases() {
  const definition = syntheticDefinition();
  definition.cubes.developments.aliasPins = ["VENDAS", "VGV"].map((alias, measureIndex) => ({
    alias,
    measureIndex,
    id: `synthetic-alias-${alias}`,
    propertiesSha256: digest(`synthetic-properties-${alias}`),
  }));
  return definition;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

test("production stays null and fails closed, without clock/I/O or invented verified pins", () => {
  assert.equal(PRODUCTION_DEFINITION, null);
  assert.throws(() => createRankingMapping(), /^Error: mapping_unverified$/);
  assert.throws(
    () =>
      createRankingMapping({ now: () => assert.fail("Unverified mapping must not use the clock") }),
    /^Error: mapping_unverified$/,
  );
  for (const verified of [false, null, "true", 1, undefined]) {
    const definition = syntheticDefinition();
    definition.verified = verified;
    assert.throws(() => create({ definition }), /^Error: mapping_unverified$/);
  }
});

test("synthetic definition yields only schema-one contract, fixed scope and policy", () => {
  const mapping = create();
  assert.equal(mapping.schemaVersion, 1);
  assert.equal(mapping.verified, true);
  assert.equal(mapping.appId, "7c000871-8b32-4c0f-bfd5-4b9d46946575");
  assert.equal(mapping.sheetId, "46d5bcf7-965d-40fc-a808-2fdde2d0f74d");
  assert.equal(mapping.numericPolicy, "safe-cent-v1");
  assert.deepEqual(mapping.scope, {
    businessUnit: "Direcional",
    regional: "SP CAPITAL",
    channel: "CANAL IMOB",
  });
  assert.deepEqual(mapping.periodPolicy, {
    range: "current-year-through-month",
    timeZone: "America/Sao_Paulo",
    calendar: "gregory",
  });
  assert.equal(mapping.provenance.kind, "synthetic-fixture");
  assert.equal(mapping.periods.length, 10);
  assert.equal(mapping.periods[0], "2026-01-01");
  assert.equal(mapping.periods.at(-1), "2026-10-01");
  assert.match(mapping.mappingSha256, /^[a-f0-9]{64}$/);
  assert.equal(PRODUCTION_DEFINITION, null);
});

test("optional alias pins default to empty without admitting other cube properties", () => {
  const legacy = syntheticDefinition();
  const implicit = create({ definition: legacy });
  for (const role of ["imobs", "developments"]) {
    assert.deepEqual(implicit.cubes[role].aliasPins, []);
    legacy.cubes[role].aliasPins = [];
  }
  assert.deepEqual(create({ definition: legacy }), implicit);
  legacy.cubes.imobs.variablePins = [];
  assert.throws(() => create({ definition: legacy }), /^Error: mapping_invalid$/);
});

test("master-only alias pins are detached, frozen and part of the semantic hash", () => {
  const definition = syntheticAliases();
  const mapping = create({ definition });
  assert.deepEqual(mapping.cubes.developments.aliasPins, definition.cubes.developments.aliasPins);
  assert.ok(Object.isFrozen(mapping.cubes.developments.aliasPins));
  assert.ok(Object.isFrozen(mapping.cubes.developments.aliasPins[0]));
  assert.notEqual(mapping.mappingSha256, create().mappingSha256);
  for (const mutate of [
    (pins) => (pins[0].id = "synthetic-other-master"),
    (pins) => (pins[0].propertiesSha256 = digest("synthetic-other-properties")),
    (pins) => pins.pop(),
  ]) {
    const changed = syntheticAliases();
    mutate(changed.cubes.developments.aliasPins);
    assert.notEqual(create({ definition: changed }).mappingSha256, mapping.mappingSha256);
  }
  definition.cubes.developments.aliasPins[0].id = "synthetic-mutated-input";
  assert.notEqual(
    mapping.cubes.developments.aliasPins[0].id,
    definition.cubes.developments.aliasPins[0].id,
  );
  assert.equal(PRODUCTION_DEFINITION, null);
});

for (const [name, mutate] of [
  ["null", (cube) => (cube.aliasPins = null)],
  ["wrong container", (cube) => (cube.aliasPins = {})],
  ["too many", (cube) => cube.aliasPins.push({ ...cube.aliasPins[0] })],
  ["unknown alias", (cube) => (cube.aliasPins[0].alias = "OTHER")],
  ["wrong case", (cube) => (cube.aliasPins[0].alias = "vendas")],
  ["expression as alias", (cube) => (cube.aliasPins[0].alias = "=VENDAS")],
  ["wrong index", (cube) => (cube.aliasPins[0].measureIndex = 1)],
  ["string index", (cube) => (cube.aliasPins[0].measureIndex = "0")],
  ["malformed ID", (cube) => (cube.aliasPins[0].id = "synthetic master")],
  ["bad digest", (cube) => (cube.aliasPins[0].propertiesSha256 = "a".repeat(63))],
  ["duplicate alias", (cube) => (cube.aliasPins = [cube.aliasPins[0], { ...cube.aliasPins[0] }])],
  ["duplicate master", (cube) => (cube.aliasPins[1].id = cube.aliasPins[0].id)],
  ["variable target", (cube) => (cube.aliasPins[0].kind = "variable")],
  ["raw definition", (cube) => (cube.aliasPins[0].qDefinition = "synthetic-private-expression")],
  ["missing field", (cube) => delete cube.aliasPins[0].propertiesSha256],
]) {
  test(`factory rejects alias pins ${name}`, () => {
    const definition = syntheticAliases();
    mutate(definition.cubes.developments);
    assert.throws(() => create({ definition }), /^Error: mapping_invalid$/);
  });
}

test("optional alias pin accessors, symbols and sparse arrays never execute", () => {
  let called = 0;
  const dangerous = () => {
    called++;
    throw new Error("synthetic-private-secret");
  };
  for (const mutate of [
    (cube) => Object.defineProperty(cube, "aliasPins", { get: dangerous, enumerable: true }),
    (cube) => Object.defineProperty(cube.aliasPins[0], "id", { get: dangerous, enumerable: true }),
    (cube) => (cube.aliasPins[0][Symbol("extra")] = true),
    (cube) => delete cube.aliasPins[0],
  ]) {
    const definition = syntheticAliases();
    mutate(definition.cubes.developments);
    assert.throws(() => create({ definition }), /^Error: mapping_invalid$/);
  }
  assert.equal(called, 0);
});

for (const [instant, year, months] of [
  ["2026-01-01T02:59:59.999Z", 2025, 12],
  ["2026-01-01T03:00:00.000Z", 2026, 1],
  ["2026-03-01T02:59:59.999Z", 2026, 2],
  ["2026-03-01T03:00:00.000Z", 2026, 3],
  ["2024-02-29T23:59:59.999-03:00", 2024, 2],
  ["2027-01-01T11:59:59.999+09:00", 2026, 12],
  ["2027-01-01T12:00:00.000+09:00", 2027, 1],
  ["2020-01-01T03:00:00.000Z", 2020, 1],
  ["2101-01-01T02:59:59.999Z", 2100, 12],
]) {
  test(`BRT current year through month, no future periods at ${instant}`, () => {
    const mapping = create({ instant });
    assert.deepEqual(
      mapping.periods,
      Array.from(
        { length: months },
        (_, index) => `${year}-${String(index + 1).padStart(2, "0")}-01`,
      ),
    );
  });
}

test("native IDs stay opaque and the clock is sampled once for a consistent year/month", () => {
  const definition = syntheticDefinition();
  definition.cubes.imobs.objectId = "synthetic:\u00e1rea/$opaque";
  definition.cubes.imobs.masterPins[0].id = "synthetic:master/\u00e1rea";
  definition.calendar.selectionFields = [CALENDAR];
  let calls = 0;
  const mapping = createRankingMapping({
    definition,
    now: () => {
      calls++;
      return new Date("2027-01-01T02:59:59.999Z");
    },
  });
  assert.equal(calls, 1);
  assert.equal(mapping.periods.at(-1), "2026-12-01");
  assert.equal(mapping.cubes.imobs.objectId, definition.cubes.imobs.objectId);
  assert.equal(mapping.cubes.imobs.masterPins[0].id, definition.cubes.imobs.masterPins[0].id);
  assert.deepEqual(mapping.calendar.selectionFields, [CALENDAR]);
});

test("period policy is independent of process timezone", () => {
  const url = new URL("./ranking-mapping.mjs", import.meta.url).href;
  const script = `import {createRankingMapping} from ${JSON.stringify(url)};console.log(JSON.stringify(createRankingMapping({definition:${JSON.stringify(syntheticDefinition())},now:()=>new Date("2027-01-01T02:59:59.999Z")})));`;
  const outputs = [];
  for (const TZ of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
      env: { TZ, SystemRoot: process.env.SystemRoot },
      timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    outputs.push(JSON.parse(result.stdout));
  }
  assert.deepEqual(outputs[0], outputs[1]);
  assert.deepEqual(outputs[0], outputs[2]);
  assert.equal(outputs[0].periods.at(-1), "2026-12-01");
});

test("hash covers full canonical static definition and explicit period policy, not month/year", () => {
  const mappings = ["2026-01-01T03:00:00.000Z", NOW, "2027-01-01T03:00:00.000Z"].map((instant) =>
    create({ instant }),
  );
  assert.equal(new Set(mappings.map((mapping) => mapping.mappingSha256)).size, 1);
  const { periods, mappingSha256, ...fixed } = mappings[1];
  assert.equal(periods.length, 10);
  assert.equal(mappingSha256, digest(canonical(fixed)));
  const { periodPolicy, ...withoutPolicy } = fixed;
  assert.equal(periodPolicy.timeZone, "America/Sao_Paulo");
  assert.notEqual(mappingSha256, digest(canonical(withoutPolicy)));
  function reversed(value) {
    if (Array.isArray(value)) return value.map(reversed);
    if (value !== null && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, item]) => [key, reversed(item)]),
      );
    return value;
  }
  assert.equal(
    create({ definition: reversed(syntheticDefinition()) }).mappingSha256,
    mappingSha256,
  );
});

test("every configurable static component changes the semantic hash", () => {
  const baseline = create().mappingSha256;
  for (const mutate of [
    (d) => {
      d.provenance.metadataSha256 = digest("other-synthetic-metadata");
    },
    (d) => {
      d.provenance.observedAt = "2020-01-02T03:00:00.000Z";
    },
    (d) => {
      d.filters[0].field = "Synthetic.OtherCompanyField";
    },
    (d) => {
      d.filters.reverse();
    },
    (d) => {
      d.calendar.selectionFields = ["Synthetic.Year", "Synthetic.Month"];
    },
    (d) => {
      d.cubes.imobs.objectId = "synthetic-other-imobs";
    },
    (d) => {
      d.cubes.imobs.cubeSha256 = digest("other-synthetic-cube");
    },
    (d) => {
      d.cubes.imobs.idField = "Synthetic.OtherId";
    },
    (d) => {
      d.cubes.imobs.idEncoding = "utf8-hex";
    },
    (d) => {
      d.cubes.imobs.vgvMeasureIndex = 2;
    },
    (d) => {
      d.cubes.developments.contractsMeasureIndex = 3;
    },
    (d) => {
      d.cubes.imobs.masterPins[0].sha256 = digest("other-synthetic-master");
    },
    (d) => {
      d.cubes.imobs.masterPins[0].id = "synthetic-other-master";
    },
    (d) => {
      d.cubes.imobs.masterPins.reverse();
    },
  ]) {
    const definition = syntheticDefinition();
    mutate(definition);
    assert.notEqual(create({ definition }).mappingSha256, baseline);
  }
});

test("mapping and nested fields/pins are immutable snapshots without freezing caller input", () => {
  const definition = syntheticDefinition();
  const mapping = create({ definition });
  function frozen(value) {
    if (value !== null && typeof value === "object") {
      assert.ok(Object.isFrozen(value));
      Object.values(value).forEach(frozen);
    }
  }
  frozen(mapping);
  assert.equal(Object.isFrozen(definition), false);
  definition.filters[0].field = "Synthetic.Changed";
  definition.cubes.imobs.masterPins[0].sha256 = digest("changed");
  assert.equal(mapping.filters[0].field, "Synthetic.Company");
  assert.equal(mapping.cubes.imobs.masterPins[0].sha256, digest("synthetic-name-imobs"));
  assert.throws(() => mapping.periods.push("2026-11-01"), TypeError);
  assert.throws(() => {
    mapping.verified = false;
  }, TypeError);
});

test("rejects extra fields, raw data/formulas, unsafe fields/hashes, duplicate pins and widened scope", () => {
  for (const mutate of [
    (d) => {
      d.scope = { channel: "other" };
    },
    (d) => {
      d.numericPolicy = "round-arbitrarily";
    },
    (d) => {
      d.periods = ["2099-01-01"];
    },
    (d) => {
      d.rawData = [{ username: "synthetic-only" }];
    },
    (d) => {
      delete d.provenance;
    },
    (d) => {
      d.provenance = {};
    },
    (d) => {
      d.provenance.kind = "verified-because-true";
    },
    (d) => {
      d.provenance.metadataSha256 = "a".repeat(64) + "\n";
    },
    (d) => {
      d.provenance.observedAt = "2027-01-01T03:00:00.000Z";
    },
    (d) => {
      d.provenance.observedAt = "2020-01-01";
    },
    (d) => {
      d.filters[0].value = "Riva";
    },
    (d) => {
      d.filters[1].value = d.filters[0].value;
    },
    (d) => {
      d.filters[1].field = d.filters[0].field;
    },
    (d) => {
      d.filters.pop();
    },
    (d) => {
      d.filters[0].field = "=unverified-formula";
    },
    (d) => {
      d.filters[0].field = "bad\nfield";
    },
    (d) => {
      d.filters[0].field = "\ud800";
    },
    (d) => {
      d.filters[0].field = "x".repeat(257);
    },
    (d) => {
      d.calendar.expression = "=unverified";
    },
    (d) => {
      d.calendar.selectionFields = [];
    },
    (d) => {
      d.calendar.selectionFields = ["Synthetic.Date", "Synthetic.Date"];
    },
    (d) => {
      d.calendar.selectionFields = [d.filters[0].field];
    },
    (d) => {
      d.calendar.selectionFields = ["=unverified"];
    },
    (d) => {
      d.cubes.imobs.objectId = d.cubes.developments.objectId;
    },
    (d) => {
      d.cubes.imobs.objectId = "synthetic\n";
    },
    (d) => {
      d.cubes.imobs.cubeSha256 = "A".repeat(64);
    },
    (d) => {
      d.cubes.imobs.idField = "=unverified";
    },
    (d) => {
      d.cubes.imobs.idEncoding = "label-hash";
    },
    (d) => {
      d.cubes.imobs.vgvMeasureIndex = 32;
    },
    (d) => {
      d.cubes.imobs.contractsMeasureIndex = d.cubes.imobs.vgvMeasureIndex;
    },
    (d) => {
      d.cubes.imobs.rawFormula = "synthetic-unapproved-formula";
    },
    (d) => {
      d.cubes.imobs.masterPins[0].kind = "unapproved";
    },
    (d) => {
      d.cubes.imobs.masterPins[0].sha256 = "a".repeat(63);
    },
    (d) => {
      d.cubes.imobs.masterPins[0].expression = "synthetic-unapproved-formula";
    },
    (d) => {
      d.cubes.imobs.masterPins.push({ ...d.cubes.imobs.masterPins[0] });
    },
    (d) => {
      d.cubes.imobs.masterPins = Array.from({ length: 34 }, (_, i) => ({
        kind: "dimension",
        id: `synthetic-${i}`,
        sha256: digest(String(i)),
      }));
    },
  ]) {
    const definition = syntheticDefinition();
    mutate(definition);
    assert.throws(() => create({ definition }), /^Error: mapping_invalid$/);
  }
});

test("rejects accessors, symbols, holes, cycles and custom serialization without invoking them", () => {
  let calls = 0;
  const dangerous = () => {
    calls++;
    throw new Error("synthetic-private-diagnostic");
  };
  for (const mutate of [
    (d) => {
      Object.defineProperty(d, "verified", { get: dangerous, enumerable: true });
    },
    (d) => {
      Object.defineProperty(d.filters, "0", { get: dangerous, enumerable: true });
    },
    (d) => {
      Object.defineProperty(d.cubes.imobs, "cubeSha256", { get: dangerous, enumerable: true });
    },
    (d) => {
      Object.defineProperty(d.provenance, "metadataSha256", {
        value: digest("fixture"),
        enumerable: false,
      });
    },
    (d) => {
      d[Symbol("extra")] = true;
    },
    (d) => {
      d.toJSON = dangerous;
    },
    (d) => {
      Object.setPrototypeOf(d, { hidden: true });
    },
    (d) => {
      delete d.filters[1];
    },
    (d) => {
      d.cubes.imobs.masterPins.extra = "unapproved";
    },
    (d) => {
      d.cubes.imobs.masterPins[0].id = d;
    },
  ]) {
    const definition = syntheticDefinition();
    mutate(definition);
    assert.throws(() => create({ definition }), /^Error: mapping_invalid$/);
  }
  assert.equal(calls, 0);
});

test("invalid clock and unsupported collector years fail closed with fixed diagnostics", () => {
  for (const now of [
    null,
    () => new Date(NaN),
    () => "2026-10-15",
    () => 0,
    () => {
      throw new Error("synthetic-secret");
    },
    () => new Date("2019-12-31T23:59:59.999-03:00"),
    () => new Date("2101-01-01T03:00:00.000Z"),
  ])
    assert.throws(
      () => createRankingMapping({ now, definition: syntheticDefinition() }),
      /^Error: mapping_invalid$/,
    );
});

test("output passes the actual collector mapping gate; native metadata pins remain independently required", async () => {
  const calls = [];
  const result = await collectQlikRanking(
    {
      openDoc: async (app) => {
        calls.push(app);
        throw new Error("synthetic-stop-before-any-data");
      },
    },
    { mapping: create(), signal: new AbortController().signal },
  );
  assert.deepEqual(calls, ["7c000871-8b32-4c0f-bfd5-4b9d46946575"]);
  assert.equal(result.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /synthetic-stop|metadata-only/);
});
