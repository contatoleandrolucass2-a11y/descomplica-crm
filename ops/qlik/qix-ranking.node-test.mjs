import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import enigma from "enigma.js";
import schema from "enigma.js/schemas/12.612.0.json" with { type: "json" };
import { collectQlikRanking } from "./qix-ranking.mjs";

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
  function cubeModel(role, native) {
    const matrix = () =>
      combined(role, native).map((row, index) =>
        native
          ? [
              dimensionCell(row.name, index),
              numberCell(row.contracts),
              numberCell(row.vgv),
              numberCell(777),
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
          "properties",
          {
            qInfo: { qId: mapping.cubes[role].objectId },
            qHyperCubeDef: structuredClone(cubes[role]),
          },
          { role },
        ),
      getLayout: async () => {
        const items = combined(role, native);
        const vgv = items.reduce((sum, row) => sum + row.vgv, 0);
        const contracts = items.reduce((sum, row) => sum + row.contracts, 0);
        return invoke(
          "cubeLayout",
          {
            qHyperCube: {
              qStateName: "$",
              qMode: "S",
              qSize: { qcx: 4, qcy: items.length },
              qDimensionInfo: Array.from({ length: native ? 1 : 2 }, () => ({
                qIsCalculated: false,
              })),
              qMeasureInfo: Array.from({ length: native ? 3 : 2 }, () => ({})),
              qGrandTotalRow: (native ? [contracts, vgv, 777] : [vgv, contracts]).map((value) =>
                numberCell(value, true),
              ),
            },
          },
          { role, native, annual: state.months.length > 1 },
        );
      },
      getHyperCubeData: async (path, pages) => {
        assert.equal(path, "/qHyperCubeDef");
        assert.ok(pages.reduce((sum, page) => sum + page.qWidth * page.qHeight, 0) <= 10000);
        if (native) assert.ok(pages.every((page) => page.qLeft !== 3));
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
      if (properties.qSelectionObjectDef)
        return {
          getLayout: async () =>
            invoke("selectionLayout", {
              qSelectionObject: {
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
      if (properties.qListObjectDef) {
        const field = properties.qListObjectDef.qDef.qFieldDefs[0];
        return {
          getLayout: async () =>
            invoke(
              "listLayout",
              {
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
      assert.equal(
        properties.qHyperCubeDef.qMeasures[0].qDef.qDef,
        masters.get(`synthetic-${role}-vgv-master`).qMeasure.qDef,
      );
      return cubeModel(role, false);
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

test("real Enigma 12.612 methods and return unwrapping collect over synthetic transport", async () => {
  const f = fixture();
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
});

test("strict pagination covers 3001 IDs without reading unrelated native columns", async () => {
  const f = fixture({ rows: 3001, periods: 1 });
  const result = await collectQlikRanking(f.global, f.options);
  assert.equal(result.status, "collected", JSON.stringify(result));
  assert.equal(result.months[0].developments.rows.length, 3001);
  assert.ok(
    f.state.calls.some((call) => call.method === "cubeData" && call.pages[0].qTop === 2500),
  );
  assert.equal(f.state.sessions.size, 0);
});

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
    "coverage_limit",
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
