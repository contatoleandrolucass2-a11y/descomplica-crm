import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import enigma from "enigma.js";
import schema from "enigma.js/schemas/12.612.0.json" with { type: "json" };
import { collectQlikRanking } from "./qix-ranking.mjs";
import { createRankingMapping } from "./ranking-mapping.mjs";

const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
const CALENDAR = "=Year([DT])&Num(Month([DT]),'00')";
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const dimensionCell = (value, index) =>
  value === null
    ? { qText: "-", qNum: "NaN", qElemNumber: -2, qIsNull: true }
    : { qText: value, qNum: "NaN", qElemNumber: index };
const numberCell = (value, total = false) => ({
  qText: "display-is-not-authority",
  qNum: value,
  qElemNumber: total ? -1 : 0,
});

function fixture({ hook = (_method, value) => value, rows = 2, periods = 2 } = {}) {
  const controller = new AbortController();
  const state = {
    calls: [],
    selected: new Map(),
    months: [],
    sessions: new Map(),
    created: [],
    destroyed: [],
    counts: new Map(),
  };
  const masters = new Map();
  const cubes = {};
  const data = {};
  const mapping = {
    schemaVersion: 1,
    verified: true,
    appId: APP,
    sheetId: SHEET,
    mappingSha256: "a".repeat(64),
    numericPolicy: "safe-cent-v1",
    periods: Array.from(
      { length: periods },
      (_, index) => `2026-${String(index + 1).padStart(2, "0")}-01`,
    ),
    filters: [
      { field: "Synthetic.Company", value: "Direcional" },
      { field: "Synthetic.Region", value: "SP CAPITAL" },
      { field: "Synthetic.Channel", value: "CANAL IMOB" },
    ],
    calendar: { expression: CALENDAR, selectionFields: ["Synthetic.Date"] },
    cubes: {},
  };
  for (const role of ["imobs", "developments"]) {
    const nameId = `synthetic-${role}-name-master`;
    const amountId = `synthetic-${role}-vgv-master`;
    masters.set(nameId, {
      qInfo: { qId: nameId, qType: "dimension" },
      qDim: { qFieldDefs: [`Synthetic.${role}.Name`], qGrouping: "N" },
    });
    masters.set(amountId, {
      qInfo: { qId: amountId, qType: "measure" },
      qMeasure: {
        qDef: "Sum([Synthetic.Amount])",
        qLabel: "VGV",
        qGrouping: "N",
        qAggrFunc: "",
        qBrutalSum: false,
      },
    });
    cubes[role] = {
      qStateName: "$",
      qMode: "S",
      qSuppressZero: false,
      qSuppressMissing: false,
      qDimensions: [
        {
          qLibraryId: nameId,
          qNullSuppression: false,
          qOtherTotalSpec: { qOtherMode: "OTHER_OFF" },
        },
      ],
      qMeasures: [
        { qDef: { qDef: "Count([Synthetic.Contract])", qLabel: "CONTRATOS" } },
        { qLibraryId: amountId },
        { qDef: { qDef: "Sum([Synthetic.Unrelated])", qLabel: "NOT COLLECTED" } },
      ],
    };
    mapping.cubes[role] = {
      objectId: `synthetic-native-${role}`,
      cubeSha256: hash(cubes[role]),
      masterPins: [
        { kind: "dimension", id: nameId, sha256: hash(masters.get(nameId).qDim) },
        { kind: "measure", id: amountId, sha256: hash(masters.get(amountId).qMeasure) },
      ],
      idField: `Synthetic.${role}.Id`,
      idEncoding: "plain",
      vgvMeasureIndex: 1,
      contractsMeasureIndex: 0,
    };
    data[role] = Object.fromEntries(
      mapping.periods.map((period, month) => [
        period,
        Array.from({ length: rows }, (_, index) => ({
          id: `id-${index}`,
          name: role === "imobs" ? "Synthetic homonym" : `Synthetic product ${index}`,
          vgv: index + month + 1,
          contracts: 1,
        })),
      ]),
    );
  }
  function invoke(method, value, details = {}) {
    const count = (state.counts.get(method) ?? 0) + 1;
    state.counts.set(method, count);
    state.calls.push({ method, ...details });
    return hook(method, value, {
      ...details,
      count,
      state,
      mapping,
      data,
      cubes,
      masters,
      controller,
    });
  }
  function combined(role, native) {
    const groups = new Map();
    for (const month of state.months)
      for (const row of data[role][month] ?? []) {
        const key = native ? row.name : JSON.stringify([row.id, row.name]);
        const current = groups.get(key) ?? { ...row, vgv: 0, contracts: 0 };
        current.vgv += row.vgv;
        current.contracts += row.contracts;
        groups.set(key, current);
      }
    return [...groups.values()];
  }
  function cubeModel(role, native, properties) {
    const matrix = () =>
      combined(role, native).map((row, index) =>
        native
          ? [
              dimensionCell(row.name, index),
              numberCell(row.contracts),
              numberCell(row.vgv),
              ...cubes[role].qMeasures.slice(2).map(() => numberCell(777)),
            ]
          : [
              dimensionCell(row.id, index),
              dimensionCell(row.name, index),
              numberCell(row.vgv),
              numberCell(row.contracts),
            ],
      );
    return {
      getEffectiveProperties: async () =>
        invoke(
          native ? "properties" : "ownedProperties",
          native
            ? {
                qInfo: { qId: mapping.cubes[role].objectId, qType: "table" },
                qHyperCubeDef: structuredClone(cubes[role]),
              }
            : structuredClone(properties),
          { role, native },
        ),
      getLayout: async () => {
        const items = combined(role, native);
        const vgv = items.reduce((sum, row) => sum + row.vgv, 0);
        const contracts = items.reduce((sum, row) => sum + row.contracts, 0);
        return invoke(
          "cubeLayout",
          {
            qInfo: native
              ? { qId: mapping.cubes[role].objectId, qType: "table" }
              : { ...properties.qInfo },
            qHyperCube: {
              qStateName: "$",
              qMode: "S",
              qSize: { qcx: native ? 1 + cubes[role].qMeasures.length : 4, qcy: items.length },
              qDimensionInfo: Array.from({ length: native ? 1 : 2 }, () => ({
                qIsCalculated: false,
              })),
              qMeasureInfo: Array.from(
                { length: native ? cubes[role].qMeasures.length : 2 },
                () => ({}),
              ),
              qGrandTotalRow: (native
                ? [contracts, vgv, ...cubes[role].qMeasures.slice(2).map(() => 777)]
                : [vgv, contracts]
              ).map((value) => numberCell(value, true)),
            },
          },
          { role, native, annual: state.months.length > 1 },
        );
      },
      getHyperCubeData: async (path, pages) => {
        assert.equal(path, "/qHyperCubeDef");
        assert.ok(pages.reduce((sum, page) => sum + page.qWidth * page.qHeight, 0) <= 10000);
        if (native) assert.ok(pages.every((page) => [0, 1, 2].includes(page.qLeft)));
        const all = matrix();
        const result = pages.map((area) => ({
          qArea: { ...area },
          qTails: [],
          qMatrix: all
            .slice(area.qTop, area.qTop + area.qHeight)
            .map((row) => row.slice(area.qLeft, area.qLeft + area.qWidth)),
        }));
        return invoke("cubeData", result, { role, native, pages, annual: state.months.length > 1 });
      },
    };
  }
  function listValues(field) {
    if (field === CALENDAR)
      return mapping.periods.map((period, index) => ({
        ...dimensionCell(period.slice(0, 7).replace("-", ""), index),
        qState: state.months.includes(period) ? "S" : state.months.length ? "A" : "O",
      }));
    const filter = mapping.filters.find((item) => item.field === field);
    return [{ ...dimensionCell(filter.value, 0), qState: state.selected.has(field) ? "S" : "O" }];
  }
  const doc = {
    getVariableByName: async () => assert.fail("Variables are not an alias fallback"),
    getAppLayout: async () => invoke("reload", { qLastReloadTime: "2026-01-01T00:00:00.123456Z" }),
    getObject: async (id) => {
      const role = Object.keys(mapping.cubes).find((key) => mapping.cubes[key].objectId === id);
      assert.ok(role, "only approved native objects may be opened");
      return invoke("getObject", cubeModel(role, true), { id });
    },
    getDimension: async (id) => ({
      getProperties: async () => invoke("master", structuredClone(masters.get(id)), { id }),
    }),
    getMeasure: async (id) => ({
      getProperties: async () => invoke("master", structuredClone(masters.get(id)), { id }),
    }),
    clearAll: async (...args) => {
      assert.deepEqual(args, [false, "$"]);
      state.selected.clear();
      state.months = [];
      return invoke("clear", undefined);
    },
    getField: async (field, alternate) => {
      assert.equal(alternate, "$");
      assert.ok(mapping.filters.some((item) => item.field === field));
      return {
        selectValues: async (values, toggle, softLock) => {
          assert.equal(toggle, false);
          assert.equal(softLock, false);
          assert.equal(values.length, 1);
          assert.equal(values[0].qIsNumeric, false);
          state.selected.set(field, values[0].qText);
          return invoke("selectField", true, { field });
        },
      };
    },
    createSessionObject: async (properties) => {
      const id = properties.qInfo.qId;
      state.created.push(id);
      state.sessions.set(id, properties);
      invoke("create", undefined, { properties });
      if (properties.qMeasureListDef) {
        assert.equal(properties.qInfo.qType, "MeasureList");
        assert.deepEqual(JSON.parse(JSON.stringify(properties.qMeasureListDef)), {
          qType: "measure",
          qData: { title: "/qMetaDef/title", label: "/qMeasure/qLabel" },
        });
        return {
          getLayout: async () =>
            invoke("catalog", {
              qInfo: { ...properties.qInfo },
              qMeasureList: {
                qItems: [...masters.values()]
                  .filter((master) => master.qInfo.qType === "measure")
                  .map((master) => ({
                    qInfo: { ...master.qInfo },
                    qData: {
                      ...(master.qMetaDef?.title === undefined
                        ? {}
                        : { title: master.qMetaDef.title }),
                      ...(master.qMeasure.qLabel === undefined
                        ? {}
                        : { label: master.qMeasure.qLabel }),
                    },
                  })),
              },
            }),
        };
      }
      if (properties.qSelectionObjectDef) {
        assert.equal(properties.qSelectionObjectDef.qStateName, "$");
        return {
          getEffectiveProperties: async () =>
            invoke("ownedProperties", structuredClone(properties)),
          getLayout: async () =>
            invoke("selectionLayout", {
              qInfo: { ...properties.qInfo },
              qSelectionObject: {
                qStateName: "$",
                qSelections: [
                  ...[...state.selected].map(([qField]) => ({
                    qField,
                    qSelectedCount: 1,
                    qLocked: false,
                  })),
                  ...(state.months.length
                    ? [
                        {
                          qField: "Synthetic.Date",
                          qSelectedCount: state.months.length,
                          qLocked: false,
                        },
                      ]
                    : []),
                ],
              },
            }),
        };
      }
      if (properties.qListObjectDef) {
        const field = properties.qListObjectDef.qDef.qFieldDefs[0];
        return {
          getEffectiveProperties: async () =>
            invoke("ownedProperties", structuredClone(properties), { field }),
          getLayout: async () =>
            invoke(
              "listLayout",
              {
                qInfo: { ...properties.qInfo },
                qListObject: {
                  qStateName: "$",
                  qSize: { qcx: 1, qcy: listValues(field).length },
                  qDimensionInfo: {
                    qIsCalculated: field === CALENDAR,
                    qStateCounts: {
                      qSelected: listValues(field).filter((cell) => cell.qState === "S").length,
                      qLocked: 0,
                      qLockedExcluded: 0,
                      qSelectedExcluded: 0,
                    },
                  },
                },
              },
              { field },
            ),
          getListObjectData: async (path, pages) => {
            assert.equal(path, "/qListObjectDef");
            return invoke(
              "listData",
              pages.map((area) => ({
                qArea: { ...area },
                qMatrix: listValues(field)
                  .slice(area.qTop, area.qTop + area.qHeight)
                  .map((cell) => [cell]),
              })),
              { field },
            );
          },
          selectListObjectValues: async (path, values, toggle, softLock) => {
            assert.equal(field, CALENDAR);
            assert.equal(path, "/qListObjectDef");
            assert.equal(toggle, false);
            assert.equal(softLock, false);
            state.months = values.map((index) => mapping.periods[index]);
            return invoke("selectMonth", true);
          },
        };
      }
      assert.ok(properties.qHyperCubeDef);
      const role = Object.keys(mapping.cubes).find(
        (key) =>
          mapping.cubes[key].idField === properties.qHyperCubeDef.qDimensions[0].qDef.qFieldDefs[0],
      );
      assert.ok(role);
      const vgv = properties.qHyperCubeDef.qMeasures[0];
      assert.equal(
        vgv.qLibraryId ? masters.get(vgv.qLibraryId).qMeasure.qDef : vgv.qDef.qDef,
        masters.get(`synthetic-${role}-vgv-master`).qMeasure.qDef,
      );
      return cubeModel(role, false, properties);
    },
    destroySessionObject: async (id) => {
      assert.ok(state.created.includes(id));
      assert.ok(!id.startsWith("synthetic-native"));
      state.sessions.delete(id);
      state.destroyed.push(id);
      return invoke("destroy", true, { id });
    },
  };
  const global = {
    openDoc: async (id) => {
      assert.equal(id, APP);
      return invoke("open", doc);
    },
  };
  return {
    global,
    mapping,
    state,
    controller,
    data,
    cubes,
    masters,
    options: { mapping, signal: controller.signal },
  };
}

function missingFixture(options) {
  const f = fixture(options);
  const cube = f.cubes.developments;
  cube.qReductionMode = "N";
  cube.qSuppressMissing = true;
  delete cube.qSuppressZero;
  for (let index = 3; index < 6; index++)
    cube.qMeasures.push({
      qDef: { qDef: `Sum([Synthetic.Unrelated${index}])`, qLabel: "NOT COLLECTED" },
    });
  f.mapping.cubes.developments.cubeSha256 = hash(cube);
  return f;
}

function aliasFixture(options) {
  const f = missingFixture(options);
  const config = f.mapping.cubes.developments;
  f.masters.get("synthetic-imobs-vgv-master").qMeasure.qLabel = "Synthetic independent amount";
  f.mapping.cubes.imobs.masterPins[1].sha256 = hash(
    f.masters.get("synthetic-imobs-vgv-master").qMeasure,
  );
  config.masterPins = config.masterPins.filter((pin) => pin.kind !== "measure");
  config.aliasPins = ["VENDAS", "VGV"].map((alias, measureIndex) => {
    const id =
      measureIndex === 1
        ? "synthetic-developments-vgv-master"
        : "synthetic-developments-contracts-alias";
    const qMeasure =
      measureIndex === 1
        ? f.masters.get(id).qMeasure
        : { qDef: "Count([Synthetic.Contract])", qGrouping: "N" };
    qMeasure.qLabel = `Synthetic presentation ${alias}`;
    const properties = {
      qInfo: { qId: id, qType: "measure" },
      qMetaDef: { title: alias },
      qMeasure,
    };
    f.masters.set(id, properties);
    f.cubes.developments.qMeasures[measureIndex] = {
      qDef: { qDef: `=${alias}`, qLabel: measureIndex === 0 ? "CONTRATOS" : "VGV" },
    };
    return { alias, measureIndex, id, propertiesSha256: hash(properties) };
  });
  config.cubeSha256 = hash(f.cubes.developments);
  return f;
}

function expressionFixture(kind, expression, repin = true) {
  const f = kind === "alias" ? aliasFixture() : fixture();
  const config = f.mapping.cubes.developments;
  const properties = f.masters.get("synthetic-developments-vgv-master");
  properties.qMeasure.qDef = expression;
  if (kind === "inline") {
    f.cubes.developments.qMeasures[1] = { qDef: structuredClone(properties.qMeasure) };
    config.masterPins = config.masterPins.filter((pin) => pin.kind !== "measure");
    if (repin) config.cubeSha256 = hash(f.cubes.developments);
  } else if (repin && kind === "library") {
    config.masterPins.find((pin) => pin.kind === "measure").sha256 = hash(properties.qMeasure);
  } else if (repin) {
    config.aliasPins.find((pin) => pin.alias === "VGV").propertiesSha256 = hash(properties);
  }
  return f;
}

for (const kind of ["inline", "library", "alias"]) {
  for (const whitespace of ["\n", "\r\n", "\t", "\r\n\t"]) {
    test(`pinned ${kind} expression preserves native whitespace ${JSON.stringify(whitespace)}`, async () => {
      const expression = `Sum(${whitespace}[Synthetic.Amount]${whitespace})`;
      const f = expressionFixture(kind, expression);
      const native = structuredClone(f.cubes);
      const masters = structuredClone([...f.masters]);
      const collect = runInNewContext(`(${collectQlikRanking.toString()})`, {
        crypto: webcrypto,
        TextEncoder,
      });
      const result = await collect(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.deepEqual(f.cubes, native);
      assert.deepEqual([...f.masters], masters);
      assert.equal(f.state.sessions.size, 0);
      assert.doesNotMatch(JSON.stringify(result), /Sum\(|Synthetic.Amount/);
    });
  }

  test(`formatting changes still require a new ${kind} definition pin`, async () => {
    const f = expressionFixture(kind, "Sum(\r\n\t[Synthetic.Amount]\r\n)", false);
    await rejected(f, kind === "inline" ? "definition_changed" : "master_changed");
  });

  for (const invalid of ["\u0000", "\u000b", "\u000c", "\u001b", "\u007f", "\u0085", "\ud800"]) {
    test(`pinned ${kind} expression rejects unsupported control ${JSON.stringify(invalid)}`, async () => {
      await rejected(
        expressionFixture(kind, `Sum(${invalid}[Synthetic.Amount])`),
        "measure_unresolved",
      );
    });
  }
  for (const invalid of ["", " \t\r\n ", "x".repeat(16385)]) {
    test(`pinned ${kind} expression rejects empty or oversized definition (${invalid.length})`, async () => {
      await rejected(expressionFixture(kind, invalid), "measure_unresolved");
    });
  }
}

for (const serialized of [false, true]) {
  test(`explicit master aliases preserve six-measure native parity, serialized=${serialized}`, async () => {
    const f = aliasFixture();
    const native = structuredClone(f.cubes);
    const reference = fixture();
    const expected = await collectQlikRanking(reference.global, reference.options);
    const collect = serialized
      ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
      : collectQlikRanking;
    const result = await collect(f.global, f.options);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
    assert.deepEqual(f.cubes, native);
    assert.equal(f.cubes.developments.qMeasures.length, 6);
    const enriched = f.state.calls
      .filter((call) => call.method === "create" && call.properties.qHyperCubeDef)
      .map((call) => call.properties.qHyperCubeDef)
      .find(
        (cube) => cube.qDimensions[0].qDef.qFieldDefs[0] === f.mapping.cubes.developments.idField,
      );
    assert.deepEqual(JSON.parse(JSON.stringify(enriched.qMeasures)), [
      { qLibraryId: f.mapping.cubes.developments.aliasPins[1].id },
      { qLibraryId: f.mapping.cubes.developments.aliasPins[0].id },
    ]);
    assert.equal(enriched.qSuppressMissing, false);
    assert.equal(enriched.qSuppressZero, false);
    assert.equal(f.state.counts.get("catalog"), 2 * (1 + 2 * (f.mapping.periods.length + 1)));
    assert.equal(f.state.sessions.size, 0);
    assert.equal(f.state.created.length, f.state.destroyed.length);
    assert.doesNotMatch(JSON.stringify(result), /qLibraryId|propertiesSha256|Sum\(|Count\(/);
  });
}

for (const [alias, measureIndex] of [
  ["VENDAS", 0],
  ["VGV", 1],
]) {
  for (const expression of [`= ${alias}`, ` =${alias} `, `${alias} `]) {
    test(`whitespace identifies ${JSON.stringify(expression)} without rewriting the pinned source`, async () => {
      const f = aliasFixture();
      f.cubes.developments.qMeasures[measureIndex].qDef.qDef = expression;
      const config = f.mapping.cubes.developments;
      config.cubeSha256 = hash(f.cubes.developments);
      const native = structuredClone(f.cubes.developments);
      const collect = runInNewContext(`(${collectQlikRanking.toString()})`, {
        crypto: webcrypto,
        TextEncoder,
      });
      const result = await collect(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.deepEqual(f.cubes.developments, native);
      assert.equal(config.cubeSha256, hash(f.cubes.developments));
      assert.equal(f.cubes.developments.qMeasures[measureIndex].qDef.qDef, expression);
      assert.equal(f.state.sessions.size, 0);
    });

    test(`whitespace cannot bypass the required ${alias} pin: ${JSON.stringify(expression)}`, async () => {
      const f = aliasFixture();
      f.cubes.developments.qMeasures[measureIndex].qDef.qDef = expression;
      const config = f.mapping.cubes.developments;
      config.cubeSha256 = hash(f.cubes.developments);
      config.aliasPins = config.aliasPins.filter((pin) => pin.alias !== alias);
      await rejected(f, "master_pin_mismatch");
      assert.ok(!f.state.calls.some((call) => call.method === "catalog"));
    });
  }
}

test("whitespace does not bypass the exact source cube hash", async () => {
  const f = aliasFixture();
  f.cubes.developments.qMeasures[1].qDef.qDef = " =VGV ";
  await rejected(f, "definition_changed");
});

test("bracketed VENDAS cannot collect without a pin or a catalog check", async () => {
  const f = fixture();
  f.cubes.developments.qMeasures[0].qDef.qDef = "=[VENDAS]";
  f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
  await rejected(f, "master_pin_mismatch");
  assert.equal(f.state.counts.get("catalog") ?? 0, 0);
});

test("valid library pin takes precedence over its inline VGV fallback", async () => {
  const f = fixture();
  f.cubes.developments.qMeasures[1].qDef = { qDef: "VGV" };
  f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
  const native = structuredClone(f.cubes.developments);
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(f.state.counts.get("catalog") ?? 0, 0);
  assert.deepEqual(f.cubes.developments, native);
});

for (const [alias, measureIndex] of [
  ["VENDAS", 0],
  ["VGV", 1],
]) {
  for (const expression of [`=[${alias}]`, ` = [${alias}] `, ` [${alias}] `]) {
    test(`bracketed ${JSON.stringify(expression)} requires its explicit alias pin`, async () => {
      const f = aliasFixture();
      f.cubes.developments.qMeasures[measureIndex].qDef.qDef = expression;
      const config = f.mapping.cubes.developments;
      config.cubeSha256 = hash(f.cubes.developments);
      config.aliasPins = config.aliasPins.filter((pin) => pin.alias !== alias);
      await rejected(f, "master_pin_mismatch");
    });

    test(`bracketed ${JSON.stringify(expression)} binds by ID without rewriting the native expression`, async () => {
      const f = aliasFixture();
      f.cubes.developments.qMeasures[measureIndex].qDef.qDef = expression;
      f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
      const native = structuredClone(f.cubes.developments);
      const collect = runInNewContext(`(${collectQlikRanking.toString()})`, {
        crypto: webcrypto,
        TextEncoder,
      });
      const result = await collect(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.ok(f.state.counts.get("catalog") > 0);
      assert.deepEqual(f.cubes.developments, native);
      assert.equal(f.state.sessions.size, 0);
    });
  }

  for (const expression of [`=[ ${alias}]`, `=[${alias} ]`, ` = [ ${alias} ] `]) {
    test(`spaces inside quoted ${JSON.stringify(expression)} fail closed without trimming the name`, async () => {
      const f = aliasFixture();
      f.cubes.developments.qMeasures[measureIndex].qDef.qDef = expression;
      f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
      await rejected(f, "measure_unresolved");
      assert.equal(f.state.counts.get("catalog") ?? 0, 0);
    });
  }

  for (const expression of [`= ${alias}`, ` = [${alias}] `, `=[ ${alias} ]`]) {
    test(`library ID precedence ignores unused inline fallback ${JSON.stringify(expression)}`, async () => {
      const f = fixture();
      const config = f.mapping.cubes.developments;
      let id = "synthetic-developments-vgv-master";
      if (alias === "VENDAS") {
        id = "synthetic-library-contracts";
        f.masters.set(id, {
          qInfo: { qId: id, qType: "measure" },
          qMeasure: { qDef: "Count([Synthetic.Contract])", qGrouping: "N" },
        });
        config.masterPins.push({ kind: "measure", id, sha256: hash(f.masters.get(id).qMeasure) });
      }
      f.cubes.developments.qMeasures[measureIndex] = { qLibraryId: id, qDef: { qDef: expression } };
      config.cubeSha256 = hash(f.cubes.developments);
      const native = structuredClone(f.cubes.developments);
      const result = await collectQlikRanking(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.equal(f.state.counts.get("catalog") ?? 0, 0);
      assert.deepEqual(f.cubes.developments, native);
    });
  }
}

test("a bracketed alias in the actual linked master definition remains unbound", async () => {
  const f = fixture();
  const id = "synthetic-developments-vgv-master";
  f.masters.get(id).qMeasure.qDef = " = [VGV] ";
  f.mapping.cubes.developments.masterPins[1].sha256 = hash(f.masters.get(id).qMeasure);
  await rejected(f, "measure_unresolved");
});

for (const expression of ["=V GV", "=VGV+0", "=$(VGV)", "==VGV", "=vgv"]) {
  test(`only direct fixed aliases can use an alias pin, not ${JSON.stringify(expression)}`, async () => {
    const f = aliasFixture();
    f.cubes.developments.qMeasures[1].qDef.qDef = expression;
    f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
    await rejected(f, "master_pin_mismatch");
  });
}

test("title-only named masters bind without a matching or present display label", async () => {
  const f = aliasFixture();
  for (const pin of f.mapping.cubes.developments.aliasPins) {
    delete f.masters.get(pin.id).qMeasure.qLabel;
    pin.propertiesSha256 = hash(f.masters.get(pin.id));
  }
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(f.state.sessions.size, 0);
});

test("label-only candidate without an approved native title remains blocked", async () => {
  const f = aliasFixture();
  const pin = f.mapping.cubes.developments.aliasPins[1];
  const properties = f.masters.get(pin.id);
  delete properties.qMetaDef.title;
  properties.qMeasure.qLabel = pin.alias;
  pin.propertiesSha256 = hash(properties);
  await rejected(f, "master_alias_identity");
});

test("whitespace in an unbound linked-master alias fails closed", async () => {
  const f = fixture();
  const id = "synthetic-developments-vgv-master";
  f.masters.get(id).qMeasure.qDef = " = VGV ";
  f.mapping.cubes.developments.masterPins[1].sha256 = hash(f.masters.get(id).qMeasure);
  await rejected(f, "measure_unresolved");
});

test("alias catalog examines the complete list, ignores item order and reads no unrelated properties", async () => {
  const f = aliasFixture({
    hook(method, value, context) {
      if (method === "catalog" && context.count % 2 === 0) value.qMeasureList.qItems.reverse();
      if (method === "master") assert.ok(!context.id.startsWith("synthetic-unrelated-"));
      return value;
    },
  });
  for (let index = 0; index < 70; index++)
    f.masters.set(`synthetic-unrelated-${index}`, {
      qInfo: { qId: `synthetic-unrelated-${index}`, qType: "measure" },
      qMetaDef: { title: `Synthetic unrelated ${index}` },
      qMeasure: { qDef: "synthetic-private-unrelated", qLabel: "" },
    });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(f.state.sessions.size, 0);
});

for (const serialized of [false, true]) {
  for (const length of [257, 16384]) {
    test(`unrelated catalog text length ${length} collects, serialized=${serialized}`, async () => {
      const f = aliasFixture();
      f.masters.set("synthetic-unrelated-long", {
        qInfo: { qId: "synthetic-unrelated-long", qType: "measure" },
        qMetaDef: { title: "x".repeat(length) },
        qMeasure: { qDef: "synthetic-private-unrelated", qLabel: "y".repeat(length) },
      });
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      const result = await collect(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.equal(f.state.sessions.size, 0);
      assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
      assert.ok(!f.state.calls.some((call) => call.id === "synthetic-unrelated-long"));
    });
  }
}

for (const serialized of [false, true]) {
  for (const [name, qData] of [
    ["absent qData", undefined],
    ["null qData", null],
    ["absent title and label", {}],
    ["null title", { title: null, label: "Synthetic unrelated" }],
    ["null label", { title: "Synthetic unrelated", label: null }],
    ["null title and label", { title: null, label: null }],
    ["multiline title", { title: "synthetic-private-title\nsecond line", label: "" }],
    ["multiline label", { title: "", label: "synthetic-private-label\r\nsecond line" }],
    ["control characters", { title: "synthetic-private-\u0000\u0007", label: "\u007f\u0085" }],
    [
      "long multiline text",
      { title: "synthetic-private\n".repeat(1024), label: "\t".repeat(16384) },
    ],
  ]) {
    test(`unrelated ${name} preserves facts without publishing text, serialized=${serialized}`, async () => {
      const f = aliasFixture({
        hook(method, value) {
          if (method === "catalog")
            value.qMeasureList.qItems.push({
              qInfo: { qId: "synthetic-unrelated-optional", qType: "measure" },
              ...(qData === undefined ? {} : { qData }),
            });
          return value;
        },
      });
      const reference = aliasFixture();
      const expected = await collectQlikRanking(reference.global, reference.options);
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      const result = await collect(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
      assert.equal(f.state.sessions.size, 0);
      assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
      assert.ok(!f.state.calls.some((call) => call.id === "synthetic-unrelated-optional"));
      assert.doesNotMatch(JSON.stringify(result), /synthetic-private|qData|qMetaDef|qLabel/);
    });
  }
  for (const label of [undefined, null, "x".repeat(256)]) {
    test(`related optional label ${label === undefined ? "absent" : label === null ? "null" : "256 chars"} collects, serialized=${serialized}`, async () => {
      const f = aliasFixture();
      for (const pin of f.mapping.cubes.developments.aliasPins) {
        const properties = f.masters.get(pin.id);
        if (label === undefined) delete properties.qMeasure.qLabel;
        else properties.qMeasure.qLabel = label;
        pin.propertiesSha256 = hash(properties);
      }
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      const result = await collect(f.global, f.options);
      assert.equal(result.status, "collected", JSON.stringify(result));
      assert.equal(f.state.sessions.size, 0);
      assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
    });
  }
}

for (const serialized of [false, true]) {
  for (const projectedLabel of [undefined, null, ""]) {
    test(`selected projected label ${JSON.stringify(projectedLabel)} preserves native properties and pins, serialized=${serialized}`, async () => {
      const f = aliasFixture({
        hook(method, value) {
          if (method === "catalog") {
            const item = value.qMeasureList.qItems.find(
              (entry) => entry.qInfo.qId === "synthetic-developments-vgv-master",
            );
            if (projectedLabel === undefined) delete item.qData.label;
            else item.qData.label = projectedLabel;
          }
          return value;
        },
      });
      const pinsBefore = structuredClone(f.mapping.cubes.developments.aliasPins);
      const propertiesBefore = structuredClone(f.masters.get(pinsBefore[1].id));
      assert.notEqual(propertiesBefore.qMeasure.qLabel, "");
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      const result = await collect(f.global, f.options);
      if (projectedLabel === "")
        assert.deepEqual(JSON.parse(JSON.stringify(result)), {
          status: "unavailable",
          reason: "master_alias_identity",
        });
      else {
        const reference = aliasFixture();
        const expected = await collectQlikRanking(reference.global, reference.options);
        assert.equal(result.status, "collected", JSON.stringify(result));
        assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
      }
      assert.deepEqual(f.mapping.cubes.developments.aliasPins, pinsBefore);
      assert.deepEqual(f.masters.get(pinsBefore[1].id), propertiesBefore);
      assert.equal(hash(f.masters.get(pinsBefore[1].id)), pinsBefore[1].propertiesSha256);
      assert.equal(f.state.sessions.size, 0);
      assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
      assert.doesNotMatch(
        JSON.stringify(result),
        /qData|qLabel|propertiesSha256|Synthetic presentation/,
      );
    });
  }
  for (const [name, mutate, reason, projection = false] of [
    [
      "absent projected title",
      (item) => {
        delete item.qData.title;
        item.qData.label = "VGV";
      },
      "master_alias_identity",
      true,
    ],
    [
      "null projected title",
      (item) => {
        item.qData.title = null;
        item.qData.label = "VGV";
      },
      "master_alias_identity",
      true,
    ],
    [
      "wrong properties ID",
      (_item, properties) => (properties.qInfo.qId = "synthetic-unapproved"),
      "master_alias_identity",
    ],
    [
      "wrong properties type",
      (_item, properties) => (properties.qInfo.qType = "dimension"),
      "master_alias_identity",
    ],
    [
      "wrong native title",
      (_item, properties) => (properties.qMetaDef.title = "OTHER"),
      "master_alias_identity",
    ],
    [
      "changed full properties",
      (_item, properties) => (properties.qMetaDef.privateNote = "synthetic-private-secret"),
      "master_changed",
    ],
    [
      "changed native label",
      (_item, properties) => (properties.qMeasure.qLabel = "synthetic-private-secret"),
      "master_changed",
    ],
  ]) {
    test(`optional projected label cannot bypass ${name}, serialized=${serialized}`, async () => {
      const f = aliasFixture({
        hook(method, value, context) {
          if (method === "catalog") {
            const item = value.qMeasureList.qItems.find(
              (entry) => entry.qInfo.qId === "synthetic-developments-vgv-master",
            );
            item.qData.label = null;
            if (projection) mutate(item);
          }
          if (
            !projection &&
            method === "master" &&
            context.id === "synthetic-developments-vgv-master"
          )
            mutate(null, value);
          return value;
        },
      });
      const pinsBefore = structuredClone(f.mapping.cubes.developments.aliasPins);
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      const result = await collect(f.global, f.options);
      assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: "unavailable", reason });
      assert.deepEqual(f.mapping.cubes.developments.aliasPins, pinsBefore);
      assert.equal(f.state.sessions.size, 0);
      assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
      assert.doesNotMatch(JSON.stringify(result), /synthetic-private|qData|qLabel|qMetaDef/);
    });
  }
}

for (const [name, item] of [
  ["null item", null],
  ["array item", []],
  ["primitive item", "synthetic-private"],
  ["absent qInfo", {}],
  ["null qInfo", { qInfo: null }],
  ["absent ID", { qInfo: { qType: "measure" } }],
  ["empty ID", { qInfo: { qId: "", qType: "measure" } }],
  ["non-string ID", { qInfo: { qId: 42, qType: "measure" } }],
  ["long ID", { qInfo: { qId: "x".repeat(257), qType: "measure" } }],
  ["unsafe ID", { qInfo: { qId: "synthetic\nprivate", qType: "measure" } }],
  ["absent type", { qInfo: { qId: "synthetic-unrelated" } }],
  ["wrong type", { qInfo: { qId: "synthetic-unrelated", qType: "dimension" } }],
  ...[[], "synthetic-private", 42, false].map((qData) => [
    `invalid qData ${JSON.stringify(qData)}`,
    { qInfo: { qId: "synthetic-unrelated", qType: "measure" }, qData },
  ]),
]) {
  test(`catalog rejects ${name} without leaking the item`, async () => {
    const f = aliasFixture({
      hook(method, value) {
        if (method === "catalog") value.qMeasureList.qItems.push(item);
        return value;
      },
    });
    assert.deepEqual(await rejected(f, "master_catalog_item"), {
      status: "unavailable",
      reason: "master_catalog_item",
    });
  });
}

for (const [name, mutate] of [
  ["different bound ID", (item) => (item.qInfo.qId = "synthetic-unapproved")],
  ["absent candidate qData", (item) => delete item.qData],
  ["null candidate qData", (item) => (item.qData = null)],
]) {
  test(`catalog rejects ${name} as a binding failure`, async () => {
    const f = aliasFixture({
      hook(method, value) {
        if (method === "catalog")
          mutate(
            value.qMeasureList.qItems.find(
              (item) => item.qInfo.qId === "synthetic-developments-vgv-master",
            ),
          );
        return value;
      },
    });
    assert.deepEqual(await rejected(f, "master_catalog_binding"), {
      status: "unavailable",
      reason: "master_catalog_binding",
    });
    assert.ok(!f.state.calls.some((call) => call.id === "synthetic-unapproved"));
  });
}

test("catalog accepts exactly 4096 unique items with optional qData", async () => {
  const f = aliasFixture({
    hook(method, value) {
      if (method === "catalog") {
        const items = value.qMeasureList.qItems;
        while (items.length < 4096)
          items.push({ qInfo: { qId: `synthetic-unrelated-${items.length}`, qType: "measure" } });
      }
      return value;
    },
  });
  assert.equal((await collectQlikRanking(f.global, f.options)).status, "collected");
  assert.equal(f.state.sessions.size, 0);
  assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
});

for (const aliasField of ["title", "label"]) {
  for (const invalid of [
    "synthetic-private\ntext",
    "synthetic-private\u0000",
    "x".repeat(257),
    42,
  ]) {
    test(`related ${aliasField} rejects unsafe companion ${JSON.stringify(invalid)}`, async () => {
      const f = aliasFixture({
        hook(method, value) {
          if (method === "catalog") {
            const item = value.qMeasureList.qItems.find(
              (entry) => entry.qInfo.qId === "synthetic-developments-vgv-master",
            );
            item.qData = {
              [aliasField]: "VGV",
              [aliasField === "title" ? "label" : "title"]: invalid,
            };
          }
          return value;
        },
      });
      await rejected(f, "master_catalog_text");
    });
  }
  test(`catalog ${aliasField} alias keeps the other text bounded`, async () => {
    const f = aliasFixture({
      hook(method, value) {
        if (method === "catalog") {
          const item = value.qMeasureList.qItems.find(
            (entry) => entry.qInfo.qId === "synthetic-developments-vgv-master",
          );
          item.qData = { title: "x".repeat(257), label: "y".repeat(257), [aliasField]: "VGV" };
        }
        return value;
      },
    });
    await rejected(f, "master_catalog_text");
    assert.equal(f.state.sessions.size, 0);
  });

  test(`duplicate ${aliasField} alias with long companion text stays blocked`, async () => {
    const f = aliasFixture();
    f.masters.set("synthetic-unapproved-collision", {
      qInfo: { qId: "synthetic-unapproved-collision", qType: "measure" },
      qMetaDef: { title: aliasField === "title" ? "VGV" : "x".repeat(16384) },
      qMeasure: {
        qDef: "synthetic-private-unrelated",
        qLabel: aliasField === "label" ? "VGV" : "y".repeat(16384),
      },
    });
    await rejected(f, "master_catalog_text");
    assert.equal(f.state.sessions.size, 0);
    assert.ok(!f.state.calls.some((call) => call.id === "synthetic-unapproved-collision"));
  });
}

for (const invalid of [42, {}, [], true]) {
  for (const field of ["title", "label"]) {
    test(`unrelated catalog ${field} rejects type ${JSON.stringify(invalid)}`, async () => {
      const f = aliasFixture({
        hook(method, value) {
          if (method === "catalog")
            value.qMeasureList.qItems.push({
              qInfo: { qId: "synthetic-unrelated-invalid", qType: "measure" },
              qData: { title: "x".repeat(257), label: "y".repeat(257), [field]: invalid },
            });
          return value;
        },
      });
      await rejected(f, "master_catalog_text");
      assert.equal(f.state.sessions.size, 0);
    });
  }
}

for (const [name, mutate, reason = "master_pin_mismatch"] of [
  ["no pins", (f) => delete f.mapping.cubes.developments.aliasPins],
  ["partial pins", (f) => f.mapping.cubes.developments.aliasPins.pop()],
  [
    "linked native measure cannot opt in",
    (f) => {
      f.cubes.developments.qMeasures[0].qLibraryId = "synthetic-developments-vgv-master";
      f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
    },
  ],
  [
    "no master candidate, with no variable fallback",
    (f) => f.masters.delete(f.mapping.cubes.developments.aliasPins[0].id),
    "master_catalog_binding",
  ],
  [
    "mismatched native alias",
    (f) => {
      f.cubes.developments.qMeasures[0].qDef.qDef = "=VGV";
      f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
    },
  ],
  [
    "master name differs even when its label matches",
    (f) => {
      const pin = f.mapping.cubes.developments.aliasPins[0];
      const properties = f.masters.get(pin.id);
      properties.qMetaDef.title = "Synthetic other name";
      properties.qMeasure.qLabel = pin.alias;
      pin.propertiesSha256 = hash(properties);
    },
    "master_alias_identity",
  ],
]) {
  test(`master aliases reject ${name}`, async () => {
    const f = aliasFixture();
    mutate(f);
    await rejected(f, reason);
  });
}

for (const [name, mutate] of [
  ["null", (config) => (config.aliasPins = null)],
  ["extra variable kind", (config) => (config.aliasPins[0].kind = "variable")],
  ["wrong index", (config) => (config.aliasPins[0].measureIndex = 1)],
  ["wrong alias", (config) => (config.aliasPins[0].alias = "OTHER")],
  ["bad digest", (config) => (config.aliasPins[0].propertiesSha256 = "private-secret")],
  ["duplicate entry", (config) => (config.aliasPins = [config.aliasPins[0], config.aliasPins[0]])],
]) {
  test(`direct collector rejects alias pins ${name} before QIX`, async () => {
    const f = aliasFixture();
    mutate(f.mapping.cubes.developments);
    await rejected(f, "mapping_invalid");
    assert.equal(f.state.calls.length, 0);
  });
}

test("factory alias mapping crosses the actual collector boundary without altering formulas", async () => {
  const f = aliasFixture();
  const mapping = createRankingMapping({
    now: () => new Date("2026-02-15T12:00:00.000Z"),
    definition: {
      verified: true,
      provenance: {
        kind: "synthetic-fixture",
        observedAt: "2026-01-01T00:00:00.000Z",
        metadataSha256: hash("synthetic-metadata"),
      },
      filters: f.mapping.filters,
      calendar: f.mapping.calendar,
      cubes: f.mapping.cubes,
    },
  });
  const result = await collectQlikRanking(f.global, { mapping, signal: f.controller.signal });
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(result.source.mappingSha256, mapping.mappingSha256);
  assert.equal(f.cubes.developments.qMeasures[0].qDef.qDef, "=VENDAS");
  assert.equal(f.cubes.developments.qMeasures[1].qDef.qDef, "=VGV");
  assert.equal(f.state.sessions.size, 0);
});

for (const stage of ["month", "annual"]) {
  test(`master alias binding still rejects internally consistent but divergent ${stage} facts`, async () => {
    const f = aliasFixture({
      hook(method, value, context) {
        if (context.role !== "developments" || context.annual !== (stage === "annual"))
          return value;
        if (stage === "month" && context.native) return value;
        if (method === "cubeLayout") value.qHyperCube.qGrandTotalRow[context.native ? 1 : 0].qNum++;
        if (method === "cubeData") value[context.native ? 1 : 2].qMatrix[0][0].qNum++;
        return value;
      },
    });
    await rejected(f, "totals_mismatch");
  });
}

test("master alias properties are rehashed after data paging even when the cube is unchanged", async () => {
  let changed = false;
  const f = aliasFixture({
    hook(method, value, context) {
      if (method === "cubeData" && context.role === "developments") {
        context.masters.get("synthetic-developments-vgv-master").qMetaDef.privateNote =
          "synthetic-private-secret";
        changed = true;
      }
      return value;
    },
  });
  await rejected(f, "master_changed");
  assert.ok(changed);
});

test("a master cannot silently introduce another unbound literal alias", async () => {
  const f = aliasFixture();
  const pin = f.mapping.cubes.developments.aliasPins[1];
  f.masters.get(pin.id).qMeasure.qDef = "=VENDAS";
  pin.propertiesSha256 = hash(f.masters.get(pin.id));
  await rejected(f, "measure_unresolved");
});

test("a linked native master cannot leave a literal alias unresolved", async () => {
  const f = fixture();
  const id = "synthetic-developments-vgv-master";
  f.masters.get(id).qMeasure.qDef = "=VGV";
  f.mapping.cubes.developments.masterPins[1].sha256 = hash(f.masters.get(id).qMeasure);
  await rejected(f, "measure_unresolved");
});

test("abort while disposing the alias catalog cannot create a late enriched cube", async () => {
  const f = aliasFixture({
    hook(method, value, context) {
      if (
        method === "destroy" &&
        context.state.calls.some(
          (call) =>
            call.method === "create" &&
            call.properties.qInfo.qId === context.id &&
            call.properties.qMeasureListDef,
        )
      )
        context.controller.abort();
      return value;
    },
  });
  await rejected(f, "cancelled");
  const cubes = f.state.calls.filter(
    (call) => call.method === "create" && call.properties.qHyperCubeDef,
  );
  assert.equal(cubes.length, 1);
});

for (const match of ["title", "label"]) {
  test(`a second master matching by ${match} is ambiguous and is never opened`, async () => {
    const f = aliasFixture({
      hook(method, value) {
        if (method === "catalog")
          value.qMeasureList.qItems.push({
            qInfo: { qId: "synthetic-unapproved-collision", qType: "measure" },
            qData: { [match]: "VGV" },
          });
        return value;
      },
    });
    await rejected(f, "master_catalog_binding");
    assert.ok(!f.state.calls.some((call) => call.id === "synthetic-unapproved-collision"));
  });
}

for (const [name, mutate, reason] of [
  [
    "full properties changed outside qMeasure",
    (properties) => (properties.qMetaDef.privateNote = "synthetic-private-secret"),
    "master_changed",
  ],
  [
    "label expression changed",
    (properties) => (properties.qMeasure.qLabelExpression = "synthetic-private-secret"),
    "master_changed",
  ],
  [
    "wrong ID",
    (properties) => (properties.qInfo.qId = "synthetic-unapproved"),
    "master_alias_identity",
  ],
  ["wrong type", (properties) => (properties.qInfo.qType = "variable"), "master_alias_identity"],
  ["wrong title", (properties) => (properties.qMetaDef.title = "OTHER"), "master_alias_identity"],
  ["wrong label", (properties) => (properties.qMeasure.qLabel = "OTHER"), "master_alias_identity"],
]) {
  test(`master alias rejects ${name} without exposing private properties`, async () => {
    const f = aliasFixture({
      hook(method, value, context) {
        if (method === "master" && context.id === "synthetic-developments-vgv-master")
          mutate(value);
        return value;
      },
    });
    await rejected(f, reason);
  });
}

for (const [name, mutate, reason] of [
  ["missing catalog", (value) => delete value.qMeasureList, "invalid_source"],
  [
    "oversized catalog",
    (value) => (value.qMeasureList.qItems = Array(4097).fill({})),
    "master_catalog_coverage_limit",
  ],
  ["reduced catalog", (value) => (value.qMeasureList.qIsReduced = true), "reduced_page"],
  [
    "duplicate item",
    (value) => value.qMeasureList.qItems.push(value.qMeasureList.qItems[0]),
    "master_catalog_item",
  ],
  [
    "wrong catalog identity",
    (value) => (value.qInfo.qId = "synthetic-unapproved"),
    "object_mismatch",
  ],
]) {
  test(`master aliases reject ${name}`, async () => {
    await rejected(
      aliasFixture({
        hook(method, value) {
          if (method === "catalog") mutate(value);
          return value;
        },
      }),
      reason,
    );
  });
}

for (const checkpoint of ["catalog", "month", "annual"]) {
  test(`alias candidate membership is rechecked at ${checkpoint} checkpoint`, async () => {
    let changed = false;
    const f = aliasFixture({
      hook(method, value, context) {
        if (
          (checkpoint === "catalog" && method === "catalog" && context.count === 2) ||
          (checkpoint !== "catalog" &&
            method === "cubeData" &&
            context.role === "developments" &&
            context.annual === (checkpoint === "annual"))
        )
          changed = true;
        if (changed && method === "catalog")
          value.qMeasureList.qItems.push({
            qInfo: { qId: "synthetic-late-collision", qType: "measure" },
            qData: { title: "VGV" },
          });
        return value;
      },
    });
    await rejected(f, "master_catalog_binding");
    assert.ok(changed);
  });
}

for (const stage of ["create", "catalog", "master"]) {
  test(`abort during alias ${stage} stops further work and cleans owned catalogs`, async () => {
    const f = aliasFixture({
      hook(method, value, context) {
        if (
          method === stage &&
          (stage !== "create" || context.properties.qMeasureListDef) &&
          (stage !== "master" || context.id === "synthetic-developments-vgv-master")
        )
          context.controller.abort();
        return value;
      },
    });
    await rejected(f, "cancelled");
  });
}

test("alias catalog cleanup failure is sanitized and cannot produce collected facts", async () => {
  const f = aliasFixture({
    hook(method, value, context) {
      if (method === "destroy" && context.state.sessions.size >= 5)
        throw new Error("synthetic-private-secret");
      return value;
    },
  });
  assert.deepEqual(await collectQlikRanking(f.global, f.options), {
    status: "unavailable",
    reason: "cleanup_failed",
  });
});

for (const serialized of [false, true]) {
  for (const role of ["imobs", "developments"]) {
    for (const native of [false, true]) {
      test(`coverage rejection identifies ${role}/${native ? "native" : "identity"}, serialized=${serialized}`, async () => {
        const f = fixture({
          hook(method, value, context) {
            if (method === "cubeLayout" && context.role === role && context.native === native)
              value.qHyperCube.qSize.qcy = 5001;
            return value;
          },
        });
        const collect = serialized
          ? runInNewContext(`(${collectQlikRanking.toString()})`, {
              crypto: webcrypto,
              TextEncoder,
            })
          : collectQlikRanking;
        const result = JSON.parse(JSON.stringify(await collect(f.global, f.options)));
        assert.deepEqual(result, {
          status: "unavailable",
          reason: `${role}_${native ? "native" : "identity"}_coverage_limit`,
        });
        assert.equal(f.state.sessions.size, 0);
        assert.ok(
          !f.state.calls.some(
            (call) => call.method === "cubeData" && call.role === role && call.native === native,
          ),
        );
      });
    }
  }
  for (const calendar of [false, true]) {
    test(`coverage rejection identifies ${calendar ? "calendar" : "selection"} list, serialized=${serialized}`, async () => {
      const f = fixture({
        hook(method, value, context) {
          if (method === "listLayout" && (context.field === CALENDAR) === calendar)
            value.qListObject.qSize.qcy = 5001;
          return value;
        },
      });
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      assert.deepEqual(JSON.parse(JSON.stringify(await collect(f.global, f.options))), {
        status: "unavailable",
        reason: calendar ? "calendar_list_coverage_limit" : "selection_list_coverage_limit",
      });
      assert.equal(f.state.sessions.size, 0);
      assert.ok(
        !f.state.calls.some(
          (call) => call.method === "listData" && (call.field === CALENDAR) === calendar,
        ),
      );
    });
  }
  for (const invalid of [undefined, null, -1, 0.5, "synthetic-private-secret", Infinity]) {
    test(`invalid page height ${String(invalid)} is not a row-limit rejection, serialized=${serialized}`, async () => {
      const f = fixture({
        hook(method, value) {
          if (method === "listLayout") value.qListObject.qSize.qcy = invalid;
          return value;
        },
      });
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      assert.deepEqual(JSON.parse(JSON.stringify(await collect(f.global, f.options))), {
        status: "unavailable",
        reason: "page_size_invalid",
      });
      assert.equal(f.state.sessions.size, 0);
    });
  }
  for (const invalid of [null, "synthetic-private-secret", {}]) {
    test(`invalid catalog shape remains private, serialized=${serialized}, shape=${typeof invalid}`, async () => {
      const f = aliasFixture({
        hook(method, value) {
          if (method === "catalog") value.qMeasureList.qItems = invalid;
          return value;
        },
      });
      const collect = serialized
        ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
        : collectQlikRanking;
      assert.deepEqual(JSON.parse(JSON.stringify(await collect(f.global, f.options))), {
        status: "unavailable",
        reason: "master_catalog_shape",
      });
      assert.equal(f.state.sessions.size, 0);
    });
  }
}

async function rejected(f, reason) {
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "unavailable", JSON.stringify(result));
  if (reason) assert.equal(result.reason, reason);
  assert.equal(f.state.sessions.size, 0);
  assert.equal(f.state.created.length, f.state.destroyed.length);
  assert.doesNotMatch(JSON.stringify(result), /Synthetic|private-secret|Sum\(/);
  return result;
}

test("complete synthetic collection reconciles native, IDs, months and accumulated period", async () => {
  const f = fixture();
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(result.source.sheetId, SHEET);
  assert.equal(result.source.reloadTimestamp, "2026-01-01T00:00:00.123456Z");
  assert.deepEqual(
    result.months.map((month) => month.periodMonth),
    f.mapping.periods,
  );
  assert.deepEqual(result.months[0].imobs, {
    coverage: { state: "complete", sourceRows: 2 },
    nativeTotals: { vgv: "3.00", contracts: 2 },
    rows: [
      { key: "id-0", name: "Synthetic homonym", vgv: "1.00", contracts: 1 },
      { key: "id-1", name: "Synthetic homonym", vgv: "2.00", contracts: 1 },
    ],
  });
  assert.deepEqual(result.months[1].developments.nativeTotals, { vgv: "5.00", contracts: 2 });
  assert.equal(f.state.created.length, 7);
  assert.equal(f.state.sessions.size, 0);
  assert.deepEqual(f.state.destroyed, [...f.state.created].reverse());
  assert.doesNotMatch(JSON.stringify(result), /Sum\(|Synthetic\.Amount|777/);
});

test("native missing suppression with observed flags reconciles all rows in the serialized collector", async () => {
  const reference = fixture();
  const expected = await collectQlikRanking(reference.global, reference.options);
  assert.equal(expected.status, "collected", JSON.stringify(expected));
  const f = missingFixture();
  const cube = f.cubes.developments;
  assert.equal(cube.qMode, "S");
  assert.equal(cube.qReductionMode, "N");
  assert.equal(cube.qSuppressMissing, true);
  assert.equal(Object.hasOwn(cube, "qSuppressZero"), false);
  assert.equal(cube.qDimensions.length, 1);
  assert.equal(cube.qMeasures.length, 6);
  const collect = runInNewContext(`(${collectQlikRanking.toString()})`, {
    crypto: webcrypto,
    TextEncoder,
  });
  const result = await collect(f.global, f.options);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
  const enriched = f.state.calls
    .filter((call) => call.method === "create" && call.properties.qHyperCubeDef)
    .map((call) => call.properties.qHyperCubeDef);
  assert.equal(enriched.length, 2);
  for (const definition of enriched) {
    assert.equal(definition.qSuppressMissing, false);
    assert.equal(definition.qSuppressZero, false);
    assert.ok(definition.qDimensions.every((dimension) => dimension.qNullSuppression === false));
  }
  assert.equal(f.state.sessions.size, 0);
  assert.equal(f.state.created.length, f.state.destroyed.length);
});

for (const empty of [false, true]) {
  test(`native missing suppression rejects hidden zero rows even with matching totals and native empty=${empty}`, async () => {
    const f = missingFixture({
      hook(method, value, context) {
        if (method === "cubeLayout" && context.native && context.role === "developments")
          value.qHyperCube.qSize.qcy = empty ? 0 : 1;
        return value;
      },
    });
    for (const rows of Object.values(f.data.developments))
      for (const [index, row] of rows.entries())
        if (empty || index === 1) Object.assign(row, { vgv: 0, contracts: 0 });
    await rejected(f, "dimension_mismatch");
  });
}

for (const cell of [
  { qNum: "NaN", qIsNull: true, qElemNumber: -2 },
  { qNum: 0, qIsNull: true },
]) {
  test(`native missing suppression never turns hidden null-only facts into zero: ${cell.qNum}`, async () => {
    const f = missingFixture({
      rows: 1,
      hook(method, value, context) {
        if (context.role !== "developments") return value;
        if (method === "cubeLayout" && context.native) value.qHyperCube.qSize.qcy = 0;
        if (method === "cubeData" && !context.native)
          for (const page of value)
            if (page.qArea.qLeft >= 2) Object.assign(page.qMatrix[0][0], cell);
        return value;
      },
    });
    for (const rows of Object.values(f.data.developments))
      Object.assign(rows[0], { vgv: 0, contracts: 0 });
    await rejected(f, "invalid_number");
  });
}

test("native missing suppression cannot hide a nonzero contribution under a surviving name", async () => {
  const f = missingFixture({
    hook(method, value, context) {
      if (context.role !== "developments" || !context.native) return value;
      if (method === "cubeLayout") value.qHyperCube.qGrandTotalRow[1].qNum--;
      if (method === "cubeData") value.find((page) => page.qArea.qLeft === 2).qMatrix[0][0].qNum--;
      return value;
    },
  });
  await rejected(f, "totals_mismatch");
});

test("native missing suppression remains pinned by the complete definition hash", async () => {
  const f = fixture();
  f.cubes.developments.qSuppressMissing = true;
  await rejected(f, "definition_changed");
});

for (const [name, mutate] of [
  ["zero suppression", (cube) => (cube.qSuppressZero = true)],
  ["data reduction", (cube) => (cube.qReductionMode = "D1")],
  [
    "dimension limits",
    (cube) => (cube.qDimensions[0].qOtherTotalSpec.qOtherMode = "OTHER_COUNTED"),
  ],
  ["nonboolean missing suppression", (cube) => (cube.qSuppressMissing = "true")],
]) {
  test(`native missing suppression does not permit ${name}`, async () => {
    const f = missingFixture();
    mutate(f.cubes.developments);
    f.mapping.cubes.developments.cubeSha256 = hash(f.cubes.developments);
    await rejected(f, "limited_cube");
  });
}

for (const [name, hook, reason] of [
  [
    "reduced pages",
    (method, value) => {
      if (method === "cubeData") for (const page of value) page.qIsReduced = true;
    },
    "reduced_page",
  ],
  [
    "incomplete pages",
    (method, value) => {
      if (method === "cubeData") value[0].qMatrix.pop();
    },
    "incomplete_page",
  ],
  [
    "unproven totals",
    (method, value) => {
      if (method === "cubeLayout") value.qHyperCube.qGrandTotalRow[0].qNum++;
    },
    "totals_mismatch",
  ],
  [
    "annual mismatch",
    (method, value, context) => {
      if (context.annual && method === "cubeLayout")
        value.qHyperCube.qGrandTotalRow[context.native ? 1 : 0].qNum *= 2;
      if (context.annual && method === "cubeData")
        for (const row of value[context.native ? 1 : 2].qMatrix) row[0].qNum *= 2;
    },
    "totals_mismatch",
  ],
]) {
  test(`native missing suppression does not permit ${name}`, async () => {
    await rejected(
      missingFixture({
        hook(method, value, context) {
          if (context.role === "developments") hook(method, value, context);
          return value;
        },
      }),
      reason,
    );
  });
}

test("physical dimensions with qIsCalculated false collect successfully", async () => {
  let physicalLists = 0;
  let physicalCubes = 0;
  const f = fixture({
    hook(method, value) {
      if (method === "listLayout" && value.qListObject.qDimensionInfo.qIsCalculated === false)
        physicalLists++;
      if (method === "cubeLayout") {
        assert.ok(
          value.qHyperCube.qDimensionInfo.every((dimension) => dimension.qIsCalculated === false),
        );
        physicalCubes++;
      }
      return value;
    },
  });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.ok(physicalLists > 0);
  assert.ok(physicalCubes > 0);
  assert.equal(f.state.sessions.size, 0);
});

test("standalone serialization runs in an isolated browser-like realm", async () => {
  const f = fixture();
  const collect = runInNewContext(`(${collectQlikRanking.toString()})`, {
    crypto: webcrypto,
    TextEncoder,
  });
  const result = await collect(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(f.state.sessions.size, 0);
});

async function assertSdkCollection(f) {
  const transportErrors = [];
  const models = new Map([[-1, { type: "Global", model: f.global }]]);
  const objectTypes = {
    OpenDoc: "Doc",
    GetObject: "GenericObject",
    CreateSessionObject: "GenericObject",
    GetDimension: "GenericDimension",
    GetMeasure: "GenericMeasure",
    GetField: "Field",
  };
  let nextHandle = 1;
  const session = enigma.create({
    schema,
    url: "ws://synthetic.invalid",
    protocol: { delta: false },
    createSocket() {
      const socket = {
        close() {
          queueMicrotask(() => socket.onclose?.({ code: 1000 }));
        },
        send(raw) {
          void (async () => {
            await Promise.resolve();
            const request = JSON.parse(raw);
            try {
              const { model, type } = models.get(request.handle);
              const methodSchema = schema.structs[type][request.method];
              assert.ok(methodSchema, "method must exist in the installed QIX schema");
              assert.ok(request.params.length <= methodSchema.In.length);
              assert.ok(
                methodSchema.In.slice(request.params.length).every(
                  (parameter) => parameter.Optional,
                ),
              );
              const method = request.method[0].toLowerCase() + request.method.slice(1);
              const value = await model[method](...request.params);
              let result;
              if (objectTypes[request.method]) {
                const handle = nextHandle++;
                const qType = objectTypes[request.method];
                models.set(handle, { type: qType, model: value });
                result = {
                  qReturn: { qHandle: handle, qType, qGenericId: `synthetic-handle-${handle}` },
                };
              } else if (methodSchema.Out.length === 1) {
                result = { [methodSchema.Out[0].Name]: value };
              } else {
                result = value === undefined ? {} : { qReturn: value };
              }
              socket.onmessage({
                data: JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
              });
            } catch (error) {
              transportErrors.push(error);
              socket.onmessage({
                data: JSON.stringify({
                  jsonrpc: "2.0",
                  id: request.id,
                  error: { code: -32603, message: "synthetic transport failure" },
                }),
              });
            }
          })();
        },
      };
      queueMicrotask(() => socket.onopen());
      return socket;
    },
  });
  try {
    const global = await session.open();
    const result = await collectQlikRanking(global, f.options);
    assert.deepEqual(transportErrors, []);
    assert.equal(result.status, "collected", JSON.stringify(result));
    assert.equal(f.state.sessions.size, 0);
  } finally {
    await session.close();
  }
}

test("real Enigma 12.612 methods and return unwrapping collect over synthetic transport", async () => {
  await assertSdkCollection(fixture());
});

test("real Enigma 12.612 binds explicit aliases by pinned library IDs", async () => {
  await assertSdkCollection(aliasFixture());
});

for (const rows of [3001, 5000]) {
  test(`strict pagination covers ${rows} IDs without reading unrelated native columns`, async () => {
    const f = fixture({ rows, periods: 1 });
    const result = await collectQlikRanking(f.global, f.options);
    assert.equal(result.status, "collected", JSON.stringify(result));
    assert.equal(result.months[0].developments.rows.length, rows);
    assert.ok(
      f.state.calls.some((call) => call.method === "cubeData" && call.pages[0].qTop === 2500),
    );
    assert.equal(f.state.sessions.size, 0);
  });
}

for (const [name, mutate] of [
  [
    "unverified",
    (m) => {
      m.verified = false;
    },
  ],
  [
    "old sheet",
    (m) => {
      m.sheetId = "772db774-0bc2-42d8-ac11-3e4917bd0d37";
    },
  ],
  [
    "other app",
    (m) => {
      m.appId = "unapproved";
    },
  ],
  [
    "mapping hash",
    (m) => {
      m.mappingSha256 = "invalid";
    },
  ],
  [
    "money policy",
    (m) => {
      m.numericPolicy = "round-arbitrarily";
    },
  ],
  [
    "empty periods",
    (m) => {
      m.periods = [];
    },
  ],
  [
    "gap",
    (m) => {
      m.periods[1] = "2026-03-01";
    },
  ],
  [
    "duplicate month",
    (m) => {
      m.periods[1] = m.periods[0];
    },
  ],
  [
    "mixed year",
    (m) => {
      m.periods[1] = "2027-02-01";
    },
  ],
  [
    "wider scope",
    (m) => {
      m.filters[0].value = "Other company";
    },
  ],
  [
    "ambiguous filter",
    (m) => {
      m.filters[1].field = m.filters[0].field;
    },
  ],
  [
    "calendar expression",
    (m) => {
      m.calendar.expression = "=unverified";
    },
  ],
  [
    "same native objects",
    (m) => {
      m.cubes.imobs.objectId = m.cubes.developments.objectId;
    },
  ],
  [
    "missing ID field",
    (m) => {
      delete m.cubes.imobs.idField;
    },
  ],
  [
    "label hash identity",
    (m) => {
      m.cubes.imobs.idEncoding = "name-hash";
    },
  ],
  [
    "same measure index",
    (m) => {
      m.cubes.imobs.vgvMeasureIndex = 0;
    },
  ],
]) {
  test(`rejects mapping ${name} before QIX`, async () => {
    const f = fixture();
    mutate(f.mapping);
    await rejected(f, "mapping_invalid");
    assert.equal(f.state.calls.length, 0);
  });
}

test("changed native definition is rejected by its canonical hash", async () => {
  const f = fixture();
  f.cubes.imobs.qMeasures[0].qDef.qDef = "private-secret";
  await rejected(f, "definition_changed");
});

test("same library ID with a different expression is rejected", async () => {
  const f = fixture();
  f.masters.get("synthetic-imobs-vgv-master").qMeasure.qDef = "private-secret";
  await rejected(f, "master_changed");
});

for (const mode of ["missing", "extra", "duplicate"]) {
  test(`rejects ${mode} master pins`, async () => {
    const f = fixture();
    const pins = f.mapping.cubes.imobs.masterPins;
    if (mode === "missing") pins.pop();
    if (mode === "extra")
      pins.push({ kind: "measure", id: "unrelated-master", sha256: "a".repeat(64) });
    if (mode === "duplicate") pins[1] = { ...pins[0] };
    await rejected(f, "master_pin_mismatch");
  });
}

test("master changes during paging reject the whole observation", async () => {
  const f = fixture({
    hook(method, value, context) {
      if (method === "cubeData")
        context.masters.get("synthetic-imobs-vgv-master").qMeasure.qDef = "private-secret";
      return value;
    },
  });
  await rejected(f, "master_changed");
});

const stateCases = [
  ["selectionLayout", "qSelectionObject", "selection_state_unproven", false],
  ["listLayout", "qListObject", "list_state_unproven", false],
  ["cubeLayout", "qHyperCube", "cube_state_unproven", false],
  ["cubeLayout", "qHyperCube", "cube_state_unproven", true],
];

test("default state proof preserves ten-month reconciliation and explicit creation", async () => {
  const f = fixture({
    periods: 10,
    hook(method, value, context) {
      if (method === "create" && !context.properties.qMeasureListDef)
        assert.equal(context.properties.qStateName, "$");
      const entry = stateCases.find(([name]) => name === method);
      if (entry) delete value[entry[1]].qStateName;
      return value;
    },
  });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(f.state.sessions.size, 0);
});

test("explicit state after a default proof cannot bypass effective definition drift", async () => {
  let reads = 0;
  const f = fixture({
    hook(method, value) {
      if (method === "selectionLayout" && reads < 2) delete value.qSelectionObject.qStateName;
      if (method === "ownedProperties" && value.qSelectionObjectDef) {
        reads++;
        if (reads > 2) value.syntheticChanged = true;
      }
      return value;
    },
  });
  await rejected(f, "selection_state_unproven");
});

for (const serialized of [false, true]) {
  for (const [methodName, key, proofCode, native] of stateCases) {
    const matches = (method, context) =>
      method === methodName && (method !== "cubeLayout" || context.native === native);
    const collect = serialized
      ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
      : collectQlikRanking;
    for (const omitted of [true, false]) {
      test(`proves default state from effective properties: ${key}, native=${native}, omitted=${omitted}, serialized=${serialized}`, async () => {
        const f = fixture({
          hook(method, value, context) {
            if (matches(method, context)) {
              if (omitted) delete value[key].qStateName;
              else value[key].qStateName = "";
            }
            return value;
          },
        });
        if (native) {
          for (const role of ["imobs", "developments"]) {
            delete f.cubes[role].qStateName;
            f.mapping.cubes[role].cubeSha256 = hash(f.cubes[role]);
          }
        }
        const result = await collect(f.global, f.options);
        assert.equal(result.status, "collected", JSON.stringify(result));
        assert.equal(f.state.sessions.size, 0);
        assert.ok(
          f.state.calls.some((call) => call.method === (native ? "properties" : "ownedProperties")),
        );
        assert.doesNotMatch(JSON.stringify(result), /qStateName|qHyperCubeDef|Synthetic.Amount/);
      });
    }
    for (const mutation of [
      "identity",
      "type",
      "root-alternate",
      "root-null",
      "definition-state",
      "definition-change",
      "extends",
      "unstable",
      "later-change",
      "layout-identity",
      "layout-state",
    ]) {
      test(`rejects unproven default ${mutation}: ${key}, native=${native}, serialized=${serialized}`, async () => {
        let active = false;
        let proofReads = 0;
        const f = fixture({
          hook(method, value, context) {
            if (matches(method, context)) {
              active = true;
              delete value[key].qStateName;
              if (mutation === "layout-identity") value.qInfo.qId = "synthetic-other";
              if (mutation === "layout-state" && proofReads) value[key].qStateName = "alternate";
            }
            if (
              active &&
              method === (native ? "properties" : "ownedProperties") &&
              value[`${key}Def`]
            ) {
              proofReads++;
              if (mutation === "identity") value.qInfo.qId = "synthetic-other";
              if (mutation === "type") value.qInfo.qType = "";
              if (mutation === "root-alternate") value.qStateName = "alternate";
              if (mutation === "root-null") value.qStateName = null;
              if (mutation === "definition-state") value[`${key}Def`].qStateName = "alternate";
              if (mutation === "definition-change") {
                if (key === "qSelectionObject") value[`${key}Def`].qStateName = "";
                else if (key === "qListObject")
                  value[`${key}Def`].qDef.qFieldDefs = ["Synthetic.Other"];
                else value[`${key}Def`].qDimensions = [];
              }
              if (mutation === "extends") value.qExtendsId = "synthetic-other";
              if (mutation === "unstable") value.syntheticVersion = proofReads;
              if (mutation === "later-change" && proofReads > 2) value.syntheticVersion = 1;
            }
            return value;
          },
        });
        const result = JSON.parse(JSON.stringify(await collect(f.global, f.options)));
        assert.deepEqual(result, { status: "unavailable", reason: proofCode });
        assert.equal(f.state.sessions.size, 0);
      });
    }
    for (const invalid of [null, false, 0, " ", "alternate"]) {
      test(`rejects unsupported layout state ${JSON.stringify(invalid)}: ${key}, native=${native}, serialized=${serialized}`, async () => {
        const f = fixture({
          hook(method, value, context) {
            if (matches(method, context)) value[key].qStateName = invalid;
            return value;
          },
        });
        const result = JSON.parse(JSON.stringify(await collect(f.global, f.options)));
        assert.deepEqual(result, {
          status: "unavailable",
          reason: key === "qHyperCube" ? "cube_shape" : "state_mismatch",
        });
        assert.equal(f.state.sessions.size, 0);
      });
    }
  }
  for (const state of ["missing", "alternate"]) {
    for (const phase of ["initial", "selected"]) {
      test(`selection object rejects ${state} state without effective proof at ${phase}, serialized=${serialized}`, async () => {
        const f = fixture({
          hook(method, value) {
            if (state === "missing" && method === "ownedProperties") delete value.qStateName;
            if (
              method === "selectionLayout" &&
              (phase === "initial" || value.qSelectionObject.qSelections.length)
            ) {
              if (state === "missing") delete value.qSelectionObject.qStateName;
              else value.qSelectionObject.qStateName = "synthetic-alternate";
            }
            return value;
          },
        });
        const collect = serialized
          ? runInNewContext(`(${collectQlikRanking.toString()})`, {
              crypto: webcrypto,
              TextEncoder,
            })
          : collectQlikRanking;
        assert.deepEqual(JSON.parse(JSON.stringify(await collect(f.global, f.options))), {
          status: "unavailable",
          reason: state === "missing" ? "selection_state_unproven" : "state_mismatch",
        });
        assert.equal(
          f.state.calls.some((call) => call.method === "cubeData"),
          false,
        );
        assert.equal(
          f.state.calls.some((call) => call.method === "selectMonth"),
          phase === "selected",
        );
        assert.equal(f.state.sessions.size, 0);
        assert.equal(f.state.created.length, f.state.destroyed.length);
      });
    }
  }
}

for (const [name, mutation, reason] of [
  [
    "failed field selection",
    (method, value) => (method === "selectField" ? false : value),
    "selection_failed",
  ],
  [
    "failed month selection",
    (method, value) => (method === "selectMonth" ? false : value),
    "selection_failed",
  ],
  [
    "residual selection",
    (method, value) => {
      if (method === "selectionLayout" && value.qSelectionObject.qSelections.length === 0)
        value.qSelectionObject.qSelections.push({ qField: "unexpected" });
      return value;
    },
    "selection_residual",
  ],
  [
    "extra selection",
    (method, value) => {
      if (method === "selectionLayout" && value.qSelectionObject.qSelections.length)
        value.qSelectionObject.qSelections.push({ qField: "unexpected", qSelectedCount: 1 });
      return value;
    },
    "selection_unproven",
  ],
  [
    "locked selection",
    (method, value) => {
      if (method === "listData") value[0].qMatrix[0][0].qState = "L";
      return value;
    },
    "locked_or_excluded_selection",
  ],
  [
    "selected excluded",
    (method, value) => {
      if (method === "listData") value[0].qMatrix[0][0].qState = "XS";
      return value;
    },
    "locked_or_excluded_selection",
  ],
  [
    "locked excluded",
    (method, value) => {
      if (method === "listData") value[0].qMatrix[0][0].qState = "XL";
      return value;
    },
    "locked_or_excluded_selection",
  ],
  [
    "missing month",
    (method, value, context) => {
      if (method === "listData" && context.field === CALENDAR)
        value[0].qMatrix[0][0].qText = "202501";
      return value;
    },
    "month_unavailable",
  ],
  [
    "excluded month",
    (method, value, context) => {
      if (method === "listData" && context.field === CALENDAR) value[0].qMatrix[0][0].qState = "X";
      return value;
    },
    "month_unavailable",
  ],
]) {
  test(`rejects ${name}`, async () => {
    await rejected(fixture({ hook: mutation }), reason);
  });
}

test("deselected alternative does not invalidate the verified selected filter", async () => {
  const f = fixture({
    hook(method, value, context) {
      if (context.field === "Synthetic.Company" && context.state.selected.has(context.field)) {
        if (method === "listLayout") {
          value.qListObject.qSize.qcy++;
          value.qListObject.qDimensionInfo.qStateCounts.qDeselected = 1;
        }
        if (method === "listData")
          value[0].qMatrix.push([{ qText: "Other company", qElemNumber: 1, qState: "D" }]);
      }
      return value;
    },
  });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(f.state.sessions.size, 0);
});

for (const field of ["Synthetic.Company", CALENDAR]) {
  test(`deselected value cannot prove the required selection for ${field}`, async () => {
    await rejected(
      fixture({
        hook(method, value, context) {
          if (context.field === field) {
            if (method === "listLayout")
              value.qListObject.qDimensionInfo.qStateCounts.qSelected = 0;
            if (method === "listData")
              for (const row of value[0].qMatrix) {
                if (row[0].qState === "S") row[0].qState = "D";
              }
          }
          return value;
        },
      }),
      "selection_unproven",
    );
  });
}

for (const method of ["cubeData", "listData"]) {
  for (const [name, flag] of [
    ["true", true],
    ["null", null],
    ["number", 0],
    ["string", "false"],
    ["object", {}],
    ["array", []],
    ["undefined present", undefined],
  ]) {
    test(`${method} rejects qIsReduced ${name}`, async () => {
      await rejected(
        fixture({
          hook(actual, value) {
            if (actual === method) for (const page of value) page.qIsReduced = flag;
            return value;
          },
        }),
        "reduced_page",
      );
    });
  }
}

test("explicitly unreduced list and cube pages retain the reconciliation path", async () => {
  const f = fixture({
    hook(method, value) {
      if (method === "cubeData" || method === "listData")
        for (const page of value) page.qIsReduced = false;
      return value;
    },
  });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.deepEqual(result.months[0].imobs.nativeTotals, { vgv: "3.00", contracts: 2 });
  assert.equal(f.state.sessions.size, 0);
});

for (const serialized of [false, true]) {
  test(`zero group tails preserve complete native pages, serialized=${serialized}`, async () => {
    const f = fixture({
      hook(method, value) {
        if (method === "cubeData" || method === "listData")
          for (const page of value) page.qTails = [{ qUp: 0, qDown: 0 }];
        return value;
      },
    });
    const collect = serialized
      ? runInNewContext(`(${collectQlikRanking.toString()})`, { crypto: webcrypto, TextEncoder })
      : collectQlikRanking;
    const result = await collect(f.global, f.options);
    assert.equal(result.status, "collected", JSON.stringify(result));
    assert.deepEqual(JSON.parse(JSON.stringify(result.months[0].imobs.nativeTotals)), {
      vgv: "3.00",
      contracts: 2,
    });
    assert.equal(f.state.sessions.size, 0);
    assert.deepEqual([...f.state.created].sort(), [...f.state.destroyed].sort());
  });
}

for (const method of ["listData", "cubeData"]) {
  for (const tails of [
    [{ qUp: 1, qDown: 0 }],
    [{ qUp: 0, qDown: 1 }],
    [{ qUp: -1, qDown: 0 }],
    [{ qUp: 0, qDown: 0.5 }],
    [{ qUp: "0", qDown: 0 }],
    [{}],
    [null],
    { length: 0 },
    false,
    Array.from({ length: 100 }, () => ({ qUp: 0, qDown: 0 })),
  ]) {
    test(`invalid group tails reject ${method} ${JSON.stringify(tails)}`, async () => {
      const f = fixture({
        hook(actual, value) {
          if (actual === method) value[0].qTails = structuredClone(tails);
          return value;
        },
      });
      await rejected(f, "incomplete_page");
      assert.equal(f.state.sessions.size, 0);
    });
  }
}

for (const [name, mutate] of [
  ["missing page", (pages) => pages.pop()],
  ["short page", (pages) => pages[0].qMatrix.pop()],
  [
    "wrong area",
    (pages) => {
      pages[0].qArea.qTop++;
    },
  ],
  ["wide row", (pages) => pages[0].qMatrix[0].push(numberCell(1))],
  [
    "duplicate area",
    (pages) => {
      pages[1].qArea = { ...pages[0].qArea };
    },
  ],
  [
    "tail",
    (pages) => {
      pages[0].qTails = [{ qUp: 1 }];
    },
  ],
]) {
  test(`rejects ${name} without a partial result`, async () => {
    await rejected(
      fixture({
        hook(method, value) {
          if (method === "cubeData") mutate(value);
          return value;
        },
      }),
      "incomplete_page",
    );
  });
}

for (const [name, cell, reason] of [
  ["negative VGV", { qNum: -1 }, "invalid_number"],
  ["nonfinite VGV", { qNum: Infinity }, "invalid_number"],
  ["string VGV", { qNum: "1" }, "invalid_number"],
  ["fractional cents", { qNum: 1.005 }, "unsafe_cents"],
  ["unsafe monetary range", { qNum: 1e15 }, "unsafe_cents"],
  ["null measure", { qIsNull: true }, "invalid_number"],
]) {
  test(`rejects ${name}`, async () => {
    await rejected(
      fixture({
        hook(method, value, context) {
          if (method === "cubeData" && context.native) Object.assign(value[1].qMatrix[0][0], cell);
          return value;
        },
      }),
      reason,
    );
  });
}

for (const [name, patch, reason] of [
  ["Other", { qElemNumber: -3 }, "invalid_dimension"],
  ["null ID", { qElemNumber: -2, qIsNull: true }, "invalid_dimension"],
  ["invalid ID", { qText: "NAME WITH SPACES" }, "invalid_identity"],
]) {
  test(`rejects ${name} as an identity`, async () => {
    await rejected(
      fixture({
        hook(method, value, context) {
          if (method === "cubeData" && !context.native)
            Object.assign(value[0].qMatrix[0][0], patch);
          return value;
        },
      }),
      reason,
    );
  });
}

test("duplicate ID under distinct names is rejected", async () => {
  const f = fixture();
  f.data.developments["2026-01-01"][1].id = "id-0";
  await rejected(f, "duplicate_identity");
});

test("name change for the same ID across months fails closed", async () => {
  const f = fixture();
  f.data.developments["2026-02-01"][0].name = "Synthetic renamed";
  await rejected(f, "identity_name_changed");
});

test("UTF-8 encoding is reversible, preserves case and never hashes names", async () => {
  const f = fixture();
  f.mapping.cubes.developments.idEncoding = "utf8-hex";
  for (const rows of Object.values(f.data.developments)) {
    rows[0].id = "Ab-001";
    rows[1].id = "ab-001";
  }
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.deepEqual(
    result.months[0].developments.rows.map((row) => row.key),
    ["id-41622d303031", "id-61622d303031"],
  );
});

test("floating point representation noise does not invent monetary rounding", async () => {
  const f = fixture();
  for (const role of Object.keys(f.data))
    for (const rows of Object.values(f.data[role])) {
      rows[0].vgv = 0.1;
      rows[1].vgv = 0.2;
    }
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(result.months[0].imobs.nativeTotals.vgv, "0.30");
});

for (const [name, hook, reason] of [
  [
    "native total mismatch",
    (method, value, context) => {
      if (method === "cubeLayout" && context.native) value.qHyperCube.qGrandTotalRow[1].qNum++;
      return value;
    },
    "totals_mismatch",
  ],
  [
    "ID total mismatch",
    (method, value, context) => {
      if (method === "cubeLayout" && !context.native) value.qHyperCube.qGrandTotalRow[0].qNum++;
      return value;
    },
    "totals_mismatch",
  ],
  [
    "fractional count",
    (method, value, context) => {
      if (method === "cubeLayout" && !context.native) value.qHyperCube.qGrandTotalRow[1].qNum = 1.1;
      return value;
    },
    "invalid_count",
  ],
  [
    "Others layout",
    (method, value) => {
      if (method === "cubeLayout") value.qHyperCube.qHasOtherValues = true;
      return value;
    },
    "limited_cube",
  ],
  [
    "too many rows",
    (method, value) => {
      if (method === "cubeLayout") value.qHyperCube.qSize.qcy = 5001;
      return value;
    },
    "imobs_native_coverage_limit",
  ],
  [
    "calculation error",
    (method, value) => {
      if (method === "cubeLayout") value.qHyperCube.qError = { qErrorCode: 7009 };
      return value;
    },
    "calculation_failed",
  ],
  [
    "wrong state",
    (method, value) => {
      if (method === "cubeLayout") value.qHyperCube.qStateName = "other";
      return value;
    },
    "cube_shape",
  ],
  [
    "reload changed",
    (method, value, context) => {
      if (method === "reload" && context.count > 1) value.qLastReloadTime = "2026-01-02T00:00:00Z";
      return value;
    },
    "reload_changed",
  ],
  ["missing reload", (method, value) => (method === "reload" ? {} : value), "reload_unavailable"],
  ["cleanup failure", (method, value) => (method === "destroy" ? false : value), "cleanup_failed"],
]) {
  test(`rejects ${name}`, async () => {
    await rejected(fixture({ hook }), reason);
  });
}

test("internally reconciled annual facts must still equal the sum of monthly facts", async () => {
  const f = fixture({
    hook(method, value, context) {
      if (context.annual && method === "cubeLayout")
        value.qHyperCube.qGrandTotalRow[context.native ? 1 : 0].qNum *= 2;
      if (context.annual && method === "cubeData") {
        const vgvColumn = context.native ? 1 : 2;
        for (const row of value[vgvColumn].qMatrix) row[0].qNum *= 2;
      }
      return value;
    },
  });
  await rejected(f, "totals_mismatch");
});

test("no equality is imposed between independent IMOB and product populations", async () => {
  const f = fixture();
  for (const rows of Object.values(f.data.developments)) rows[0].vgv *= 3;
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.notEqual(
    result.months[0].imobs.nativeTotals.vgv,
    result.months[0].developments.nativeTotals.vgv,
  );
});

test("proven empty cubes are complete zero, not a missing month", async () => {
  const f = fixture({ rows: 0 });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.deepEqual(result.months[0].imobs, {
    coverage: { state: "complete", sourceRows: 0 },
    nativeTotals: { vgv: "0.00", contracts: 0 },
    rows: [],
  });
});

test("cancellation before opening performs no QIX calls", async () => {
  const f = fixture();
  f.controller.abort();
  await rejected(f, "cancelled");
  assert.equal(f.state.calls.length, 0);
});

test("cancellation after a page stops collection and destroys owned objects", async () => {
  const f = fixture({
    hook(method, value, context) {
      if (method === "cubeData") context.controller.abort();
      return value;
    },
  });
  await rejected(f, "cancelled");
  assert.equal(f.state.calls.filter((call) => call.method === "cubeData").length, 1);
});

test("upstream exceptions never return source definitions or details", async () => {
  const f = fixture({
    hook(method, value) {
      if (method === "cubeData") throw new Error("private-secret Sum([Synthetic.Amount])");
      return value;
    },
  });
  await rejected(f, "collection_failed");
});

test("list state changes during paging fail closed", async () => {
  await rejected(
    fixture({
      hook(method, value, context) {
        if (method === "listLayout" && context.count === 2) value.qListObject.qStateName = "other";
        return value;
      },
    }),
    "selection_changed",
  );
});

test("effective sort changes during cube paging fail closed", async () => {
  await rejected(
    fixture({
      hook(method, value, context) {
        if (method === "cubeLayout")
          value.qHyperCube.qEffectiveInterColumnSortOrder =
            context.count === 1 ? [0, 1, 2, 3] : [1, 0, 2, 3];
        return value;
      },
    }),
    "cube_changed",
  );
});

test("selection drift during data reads rejects the observation", async () => {
  await rejected(
    fixture({
      hook(method, value, context) {
        if (method === "cubeData") context.state.selected.set("unexpected", "private-secret");
        return value;
      },
    }),
    "selection_unproven",
  );
});

test("reload timestamp preserves microseconds while normalizing timezone", async () => {
  const f = fixture({
    hook(method, value) {
      if (method === "reload") value.qLastReloadTime = "2025-12-31T21:00:00.123456-03:00";
      return value;
    },
  });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(result.source.reloadTimestamp, "2026-01-01T00:00:00.123456Z");
});

test("empty calculation-condition message permits collection", async () => {
  const f = fixture({
    hook(method, value) {
      if (method === "cubeLayout") value.qHyperCube.qCalcCondMsg = "";
      return value;
    },
  });
  assert.equal((await collectQlikRanking(f.global, f.options)).status, "collected");
});

test("nonempty calculation-condition message fails closed", async () => {
  await rejected(
    fixture({
      hook(method, value) {
        if (method === "cubeLayout") value.qHyperCube.qCalcCondMsg = "private-secret";
        return value;
      },
    }),
    "calculation_failed",
  );
});

test("selected state count must match the complete list pages", async () => {
  await rejected(
    fixture({
      hook(method, value) {
        if (method === "listLayout") value.qListObject.qDimensionInfo.qStateCounts.qSelected++;
        return value;
      },
    }),
    "selection_changed",
  );
});

test("reload change below millisecond resolution is still rejected", async () => {
  await rejected(
    fixture({
      hook(method, value, context) {
        if (method === "reload" && context.count > 1)
          value.qLastReloadTime = "2026-01-01T00:00:00.123457Z";
        return value;
      },
    }),
    "reload_changed",
  );
});
