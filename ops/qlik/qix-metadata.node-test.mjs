import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { inspectQlikRankingMetadata } from "./qix-metadata.mjs";

const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
const SHEET = "772db774-0bc2-42d8-ac11-3e4917bd0d37";
const PRODUCTS = "17f54180-e9f8-44d4-8a58-d055cff3e94c";
const CONTAINER = "e039b893-0d96-444c-9773-aba1383f8d94";
const PARTNERS = "synthetic-partner-engine-id";
const TAB = "pUYysrvJ";
const RELOAD = "2026-10-14T08:09:14.000Z";
const PRIVATE = "DO_NOT_RETURN_PRIVATE_CUSTOMER_OR_TOKEN";

// Enigma resolves the single out parameter, not the raw JSON-RPC result wrapper.
// GenericObjectEntry uses qProperty/qChildren; sn-container uses children[].refId/cId.
function entry(objectId, type = "table", children = [], extra = {}) {
  return { qProperty: { qInfo: { qId: objectId, qType: type }, ...extra }, qChildren: children };
}

function cube() {
  return {
    qMode: "S",
    qStateName: "$",
    qSuppressZero: true,
    qSuppressMissing: false,
    qDimensions: [
      {
        qLibraryId: "synthetic-dimension-master",
        qDef: { qFieldDefs: ["[Synthetic Entity ID]"], qFieldLabels: ["Entity"] },
        qNullSuppression: true,
        qOtherTotalSpec: { qOtherMode: "OTHER_COUNTED", qOtherCounted: { qv: "10" } },
      },
    ],
    qMeasures: [
      {
        qLibraryId: "synthetic-measure-master",
        qDef: {
          qDef: "Sum([Synthetic VGV])",
          qLabel: "VGV",
          qNumFormat: { qType: "M", qFmt: "0.00" },
        },
      },
    ],
    qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 100, qWidth: 3 }],
    qDataPages: [{ qMatrix: [[{ qText: PRIVATE, qNum: 987654321.99 }]] }],
  };
}

function master(libraryId, type) {
  return {
    qInfo: { qId: libraryId, qType: type },
    ...(type === "dimension"
      ? {
          qDim: {
            qFieldDefs: ["[Synthetic Entity ID]"],
            qFieldLabels: ["Entity"],
            qGrouping: "N",
            qLabelExpression: "='Entity'",
            qAlias: "Entity",
          },
        }
      : {
          qMeasure: {
            qDef: "Sum([Synthetic VGV])",
            qLabel: "VGV",
            qGrouping: "N",
            qExpressions: ["Sum([Synthetic VGV])"],
            qActiveExpression: 0,
            qLabelExpression: "='VGV'",
          },
        }),
    qMetaDef: { description: PRIVATE },
    qDataPages: [{ qMatrix: [[{ qText: PRIVATE, qNum: 987654321.99 }]] }],
    qExtendsId: "customer-master-never-query",
  };
}

function fixture() {
  const partner = entry(PARTNERS, "table", [], { qHyperCubeDef: cube() });
  const container = entry(CONTAINER, "container", [partner], {
    visualization: "container",
    children: [{ cId: TAB, refId: PARTNERS, label: "Parceiras", isMaster: false }],
  });
  const product = entry(PRODUCTS, "table", [], { qHyperCubeDef: cube() });
  const unrelated = entry("unrelated-chart", "table");
  Object.defineProperty(unrelated.qProperty, "qHyperCubeDef", {
    get() {
      throw new Error("must not inspect unrelated chart definitions");
    },
  });
  const tree = entry(SHEET, "sheet", [product, container, unrelated], {
    cells: [{ name: PRODUCTS }, { name: CONTAINER }, { name: "unrelated-chart" }],
    qMetaDef: { title: PRIVATE },
  });
  const properties = new Map([
    [SHEET, tree.qProperty],
    [PRODUCTS, product.qProperty],
    [CONTAINER, container.qProperty],
    [PARTNERS, partner.qProperty],
  ]);
  const calls = [];
  const masters = new Map([
    ["dimension:synthetic-dimension-master", master("synthetic-dimension-master", "dimension")],
    ["measure:synthetic-measure-master", master("synthetic-measure-master", "measure")],
  ]);
  const f = {
    tree,
    properties,
    calls,
    masters,
    failure: null,
    afterCall: null,
    layout: { qLastReloadTime: RELOAD, qTitle: PRIVATE, qFileName: PRIVATE },
  };
  function invoke(method, args, result) {
    calls.push([method, ...args]);
    if (f.failure === method) throw Object.assign(new Error(PRIVATE), { code: 403, data: PRIVATE });
    f.afterCall?.(method);
    return Promise.resolve(result);
  }
  class GenericObject {
    constructor(objectId) {
      this.id = objectId;
    }
    getFullPropertyTree() {
      assert.equal(this.id, SHEET);
      return invoke("getFullPropertyTree", [this.id], f.tree);
    }
    getProperties() {
      return invoke("getProperties", [this.id], properties.get(this.id));
    }
    getEffectiveProperties() {
      return invoke("getEffectiveProperties", [this.id], properties.get(this.id));
    }
    getLayout() {
      assert.fail("object layout is forbidden");
    }
    getHyperCubeData() {
      assert.fail("data is forbidden");
    }
  }
  class Doc {
    getDimension(libraryId) {
      return libraryModel("dimension", libraryId);
    }
    getMeasure(libraryId) {
      return libraryModel("measure", libraryId);
    }
    getObject(objectId) {
      assert.ok(
        [SHEET, PRODUCTS, CONTAINER, PARTNERS].includes(objectId),
        "unexpected object query",
      );
      return invoke("getObject", [objectId], new GenericObject(objectId));
    }
    getAppLayout() {
      return invoke("getAppLayout", [], f.layout);
    }
    getField() {
      assert.fail("field access is forbidden");
    }
    getScript() {
      assert.fail("script access is forbidden");
    }
    clearAll() {
      assert.fail("selections are forbidden");
    }
  }
  function libraryModel(type, libraryId) {
    return invoke(type === "dimension" ? "getDimension" : "getMeasure", [libraryId], {
      getProperties() {
        return invoke(
          "masterGetProperties",
          [type, libraryId],
          masters.get(`${type}:${libraryId}`),
        );
      },
      getLayout() {
        assert.fail("master layout is forbidden");
      },
    });
  }
  f.global = {
    openDoc: (appId) => {
      assert.equal(appId, APP);
      return invoke("openDoc", [appId], new Doc());
    },
  };
  return f;
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}
function sanitized(code) {
  return (error) => {
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    assert.equal(error.cause, undefined);
    assert.equal(error.data, undefined);
    assert.ok(!String(error.stack).includes(PRIVATE));
    return true;
  };
}

// Every scenario also runs from toString() in a realm without Node globals/imports.
for (const [mode, inspect] of [
  ["module", inspectQlikRankingMetadata],
  ["closure-free VM", runInNewContext(`(${inspectQlikRankingMetadata.toString()})`)],
]) {
  test(`${mode}: fixed scope, definitions only, actual tab refId, reload allowlist`, async () => {
    const f = fixture();
    const result = clean(await inspect(f.global));
    assert.equal(result.status, "inspected");
    assert.equal(result.appId, APP);
    assert.equal(result.sheetId, SHEET);
    assert.equal(result.sourceReloadTime, RELOAD);
    assert.equal(result.productionMappingVerified, false);
    assert.equal(result.selectionsVerified, false);
    assert.equal(result.dataRead, false);
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(
      f.calls.filter(([method]) => method === "getObject").map(([, value]) => value),
      [SHEET, CONTAINER, PRODUCTS, PARTNERS],
    );
    const product = result.objects.find(({ id }) => id === PRODUCTS);
    assert.equal(product.qHyperCubeDef.qMeasures[0].qDef.qDef, "Sum([Synthetic VGV])");
    assert.equal(product.qHyperCubeDef.qDimensions[0].qOtherTotalSpec.qOtherCounted.qv, "10");
    assert.equal(product.qHyperCubeDef.qDimensions[0].qLibraryId, "synthetic-dimension-master");
    assert.deepEqual(result.containerStructure.references, [
      {
        source: "children",
        cId: TAB,
        refId: PARTNERS,
        matchesPartners: true,
        label: "Parceiras",
      },
    ]);
    const serialized = JSON.stringify(result);
    for (const denied of [
      PRIVATE,
      "987654321",
      "qInitialDataFetch",
      "qDataPages",
      "qMatrix",
      "qMetaDef",
      "unrelated-chart",
    ]) {
      assert.ok(!serialized.includes(denied), denied);
    }
  });

  test(`${mode}: missing membership stays pending without probing candidates`, async () => {
    const f = fixture();
    f.tree = entry(SHEET, "sheet");
    const result = await inspect(f.global);
    assert.equal(result.status, "pending");
    assert.deepEqual(clean(result.objects), []);
    assert.deepEqual(clean(result.masterDefinitions), []);
    assert.ok(!f.calls.some(([method]) => ["getDimension", "getMeasure"].includes(method)));
    assert.deepEqual(
      f.calls.filter(([method]) => method === "getObject"),
      [["getObject", SHEET]],
    );
  });

  test(`${mode}: sheet cells refId and nested container cells chartId prove membership`, async () => {
    const f = fixture();
    f.tree = entry(SHEET, "sheet", [], { cells: [{ refId: CONTAINER }] });
    f.properties.get(CONTAINER).cells = [{ chartId: PRODUCTS }];
    const result = await inspect(f.global);
    assert.equal(result.status, "inspected");
    assert.ok(
      f.calls.some(([method, objectId]) => method === "getProperties" && objectId === CONTAINER),
    );
  });

  test(`${mode}: full tree resolves layout parents without fetching those charts`, async () => {
    const f = fixture();
    f.tree = entry(SHEET, "sheet", [entry("layout-parent", "layout-container", f.tree.qChildren)]);
    assert.equal((await inspect(f.global)).status, "inspected");
    assert.ok(!f.calls.some(([, objectId]) => objectId === "layout-parent"));
  });

  test(`${mode}: cId is never guessed as Engine ID; only matching static label can resolve chartId`, async () => {
    const f = fixture();
    f.properties.get(CONTAINER).children = [
      { cId: "different-tab", chartId: PARTNERS, label: "Parceiras" },
    ];
    assert.equal((await inspect(f.global)).status, "inspected");
    assert.ok(!f.calls.some(([, objectId]) => objectId === TAB));
    f.properties.get(CONTAINER).children = [{ cId: TAB }];
    f.calls.length = 0;
    const result = await inspect(f.global);
    assert.equal(result.status, "pending");
    assert.ok(!f.calls.some(([, objectId]) => objectId === PARTNERS));
  });

  test(`${mode}: dynamic label and unrelated refs do not authorize a query`, async () => {
    const f = fixture();
    f.properties.get(CONTAINER).children = [
      { cId: "other", refId: "customer-table", label: { qStringExpression: "='Parceiras'" } },
    ];
    const result = await inspect(f.global);
    assert.equal(result.status, "pending");
    assert.ok(
      !f.calls.some(([, objectId]) => objectId === "customer-table" || objectId === PARTNERS),
    );
    assert.ok(!JSON.stringify(result).includes("qStringExpression"));
  });

  test(`${mode}: unknown container shape returns bounded structural metadata`, async () => {
    const f = fixture();
    f.properties.get(CONTAINER).children = { arbitrary: PRIVATE };
    const result = await inspect(f.global);
    assert.equal(result.status, "pending");
    assert.deepEqual(clean(result.containerStructure.arrays.children), {
      kind: "unknown",
      count: null,
    });
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
  });

  test(`${mode}: ambiguous Parceiras targets are pending, not queried`, async () => {
    const f = fixture();
    f.properties
      .get(CONTAINER)
      .children.push({ cId: "other", label: "Parceiras", refId: "other-chart" });
    const result = await inspect(f.global);
    assert.ok(result.reasons.includes("partners_reference_ambiguous"));
    assert.ok(!f.calls.some(([, objectId]) => objectId === PARTNERS));
  });

  test(`${mode}: conflicting cell refs and unresolved matching tabs never choose an arbitrary target`, async () => {
    const conflict = fixture();
    conflict.tree = entry(SHEET, "sheet", [], {
      cells: [{ refId: CONTAINER, chartId: PRODUCTS }],
    });
    assert.equal((await inspect(conflict.global)).objects.length, 0);
    for (const reverse of [false, true]) {
      const f = fixture();
      f.properties.get(CONTAINER).children.push({ label: "Parceiras" });
      if (reverse) f.properties.get(CONTAINER).children.reverse();
      const result = await inspect(f.global);
      assert.ok(result.reasons.includes("partners_reference_ambiguous"));
      assert.ok(!f.calls.some(([, objectId]) => objectId === PARTNERS));
    }
  });

  test(`${mode}: metadata accessors and wrong effective identities are rejected without leaking`, async () => {
    const f = fixture();
    Object.defineProperty(f.properties.get(PRODUCTS), "qHyperCubeDef", {
      get() {
        throw new Error(PRIVATE);
      },
    });
    await assert.rejects(inspect(f.global), sanitized("qix_invalid_metadata"));
    const wrong = fixture();
    wrong.afterCall = (method) => {
      if (method === "getFullPropertyTree") {
        wrong.properties.set(PRODUCTS, entry("another-engine-object").qProperty);
      }
    };
    await assert.rejects(inspect(wrong.global), sanitized("qix_scope_mismatch"));
  });

  test(`${mode}: embedded snapshots cannot prove sheet membership`, async () => {
    const f = fixture();
    const original = f.tree;
    f.tree = entry(SHEET, "sheet");
    f.tree.qEmbeddedSnapshotRef = original;
    const result = await inspect(f.global);
    assert.equal(result.objects.length, 0);
  });

  test(`${mode}: wrong sheet identity is blocked before any other query`, async () => {
    const f = fixture();
    f.tree.qProperty.qInfo.qId = "wrong-sheet";
    await assert.rejects(inspect(f.global), sanitized("qix_scope_mismatch"));
    assert.equal(f.calls.length, 3);
  });

  test(`${mode}: caller cannot supply app or object IDs`, async () => {
    const f = fixture();
    await assert.rejects(
      inspect(f.global, { appId: "another-app" }),
      sanitized("qix_invalid_options"),
    );
    assert.equal(f.calls.length, 0);
  });

  test(`${mode}: depth, node count, references and definition sizes are bounded`, async () => {
    for (const mutate of [
      (f) => {
        let node = f.tree;
        for (let i = 0; i < 9; i++) {
          const child = entry(`depth-${i}`);
          node.qChildren = [child];
          node = child;
        }
      },
      (f) => {
        f.tree.qChildren = Array.from({ length: 129 }, (_, i) => entry(`node-${i}`));
      },
      (f) => {
        f.tree.qProperty.cells = Array.from({ length: 513 }, () => ({ name: PRODUCTS }));
      },
      (f) => {
        f.properties.get(PRODUCTS).qHyperCubeDef.qMeasures = Array.from({ length: 33 }, () => ({}));
      },
      (f) => {
        f.properties.get(PRODUCTS).qHyperCubeDef.qMeasures[0].qDef.qDef = "x".repeat(4097);
      },
      (f) => {
        f.properties.get(CONTAINER).children = Array.from({ length: 65 }, () => ({}));
      },
    ]) {
      const f = fixture();
      mutate(f);
      await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
    }
  });

  test(`${mode}: cyclic trees and duplicate object definitions fail closed`, async () => {
    const f = fixture();
    f.tree.qChildren.push(f.tree);
    await assert.rejects(inspect(f.global), sanitized("qix_metadata_cycle"));
    const duplicate = fixture();
    duplicate.tree.qChildren.push(entry(PRODUCTS));
    await assert.rejects(inspect(duplicate.global), sanitized("qix_duplicate_object"));
  });

  test(`${mode}: SDK/auth errors never expose upstream messages or payloads`, async () => {
    for (const method of [
      "openDoc",
      "getObject",
      "getFullPropertyTree",
      "getEffectiveProperties",
      "getAppLayout",
    ]) {
      const f = fixture();
      f.failure = method;
      await assert.rejects(inspect(f.global), sanitized("qix_request_failed"));
    }
    await assert.rejects(inspect({}), sanitized("qix_invalid_sdk"));
  });

  test(`${mode}: abort prevents subsequent calls without taking ownership of transport`, async () => {
    const before = fixture();
    const controller = new AbortController();
    controller.abort(PRIVATE);
    await assert.rejects(
      inspect(before.global, { signal: controller.signal }),
      sanitized("qix_aborted"),
    );
    assert.equal(before.calls.length, 0);
    const during = fixture();
    const next = new AbortController();
    during.afterCall = () => next.abort(PRIVATE);
    await assert.rejects(inspect(during.global, { signal: next.signal }), sanitized("qix_aborted"));
    assert.equal(during.calls.length, 1);
  });

  test(`${mode}: unresolved qExtendsId is reported, never fetched`, async () => {
    const f = fixture();
    delete f.properties.get(PRODUCTS).qHyperCubeDef;
    f.properties.get(PRODUCTS).qExtendsId = "unresolved-master";
    const result = await inspect(f.global);
    assert.equal(result.status, "pending");
    assert.equal(result.objects.find(({ id }) => id === PRODUCTS).qExtendsId, "unresolved-master");
    assert.ok(!f.calls.some(([, objectId]) => objectId === "unresolved-master"));
  });

  test(`${mode}: typed masters project definitions and deduplicate references across proved cubes`, async () => {
    const f = fixture();
    f.properties
      .get(PRODUCTS)
      .qHyperCubeDef.qDimensions.push({ qLibraryId: "synthetic-dimension-master" });
    f.properties.get(PRODUCTS).qExtendsId = "customer-master-never-query";
    f.properties.get(CONTAINER).qHyperCubeDef = {
      qDimensions: [{ qLibraryId: "customer-dimension-never-query" }],
      qMeasures: [{ qLibraryId: "customer-measure-never-query" }],
    };
    const result = clean(await inspect(f.global));
    assert.equal(result.masterDefinitions.length, 2);
    const [dimension, measure] = result.masterDefinitions;
    assert.deepEqual(dimension, {
      id: "synthetic-dimension-master",
      type: "dimension",
      referencedBy: [
        { objectId: PRODUCTS, index: 0 },
        { objectId: PRODUCTS, index: 1 },
        { objectId: PARTNERS, index: 0 },
      ],
      qDim: {
        qFieldDefs: ["[Synthetic Entity ID]"],
        qFieldLabels: ["Entity"],
        qGrouping: "N",
        qLabelExpression: "='Entity'",
        qAlias: "Entity",
      },
    });
    assert.equal(measure.type, "measure");
    assert.deepEqual(measure.qMeasure.qExpressions, ["Sum([Synthetic VGV])"]);
    assert.equal(measure.qMeasure.qActiveExpression, 0);
    assert.equal(measure.qMeasure.qLabel, "VGV");
    assert.deepEqual(
      f.calls.filter(([method]) => ["getDimension", "getMeasure"].includes(method)),
      [
        ["getDimension", "synthetic-dimension-master"],
        ["getMeasure", "synthetic-measure-master"],
      ],
    );
    assert.ok(!f.calls.some((call) => call.some((value) => String(value).startsWith("customer-"))));
    for (const denied of [PRIVATE, "987654321", "qMetaDef", "qDataPages", "qExtendsId"]) {
      assert.ok(!JSON.stringify(result.masterDefinitions).includes(denied));
    }
  });

  test(`${mode}: same library ID in different types is not conflated; inline definitions are ignored`, async () => {
    const f = fixture();
    for (const objectId of [PRODUCTS, PARTNERS]) {
      f.properties.get(objectId).qHyperCubeDef = {
        qDimensions: [
          { qLibraryId: "shared" },
          { qLibraryId: "" },
          { qDef: { qFieldDefs: ["inline"] } },
        ],
        qMeasures: [{ qLibraryId: "shared" }],
      };
    }
    f.masters.set("dimension:shared", master("shared", "dimension"));
    f.masters.set("measure:shared", master("shared", "measure"));
    assert.deepEqual(
      clean((await inspect(f.global)).masterDefinitions).map(({ id, type }) => [id, type]),
      [
        ["shared", "dimension"],
        ["shared", "measure"],
      ],
    );
  });

  test(`${mode}: global 64-master boundary checked before any master lookup`, async () => {
    for (const count of [64, 65]) {
      const f = fixture();
      f.properties.get(PARTNERS).qHyperCubeDef = {};
      const product = f.properties.get(PRODUCTS).qHyperCubeDef;
      product.qDimensions = [];
      product.qMeasures = [];
      for (let i = 0; i < count; i++) {
        const type = i < 32 ? "dimension" : "measure";
        const target = i < 64 ? product : f.properties.get(PARTNERS).qHyperCubeDef;
        const field = type === "dimension" ? "qDimensions" : "qMeasures";
        (target[field] ??= []).push({ qLibraryId: `master-${i}` });
        f.masters.set(`${type}:master-${i}`, master(`master-${i}`, type));
      }
      if (count === 64) {
        assert.equal((await inspect(f.global)).masterDefinitions.length, 64);
        assert.equal(
          f.calls.filter(([method]) => ["getDimension", "getMeasure"].includes(method)).length,
          64,
        );
      } else {
        await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
        assert.ok(!f.calls.some(([method]) => ["getDimension", "getMeasure"].includes(method)));
      }
    }
  });

  test(`${mode}: wrong master identity/type and unavailable definitions fail closed`, async () => {
    for (const type of ["dimension", "measure"]) {
      const libraryId = `synthetic-${type}-master`;
      for (const field of ["qId", "qType"]) {
        const f = fixture();
        f.masters.get(`${type}:${libraryId}`).qInfo[field] = "wrong";
        await assert.rejects(inspect(f.global), sanitized("qix_scope_mismatch"));
        assert.equal(f.calls.at(-1)[0], "masterGetProperties");
      }
      const missing = fixture();
      missing.masters.delete(`${type}:${libraryId}`);
      await assert.rejects(inspect(missing.global), sanitized("qix_invalid_metadata"));
    }
    for (const method of ["getDimension", "getMeasure", "masterGetProperties"]) {
      const f = fixture();
      f.failure = method;
      await assert.rejects(inspect(f.global), sanitized("qix_request_failed"));
      assert.equal(f.calls.at(-1)[0], method);
    }
  });

  test(`${mode}: malformed master IDs and definitions are bounded and sanitized`, async () => {
    for (const value of [null, 42, "has space", "x".repeat(257)]) {
      const f = fixture();
      f.properties.get(PRODUCTS).qHyperCubeDef.qDimensions[0].qLibraryId = value;
      await assert.rejects(
        inspect(f.global),
        sanitized(
          typeof value === "string" && value.length > 256
            ? "qix_metadata_limit"
            : "qix_invalid_metadata",
        ),
      );
      assert.ok(!f.calls.some(([method]) => ["getDimension", "getMeasure"].includes(method)));
    }
    for (const [field, value, code] of [
      ["qExpressions", Array(33).fill("synthetic"), "qix_metadata_limit"],
      ["qDef", "x".repeat(4097), "qix_metadata_limit"],
      ["qActiveExpression", 0.5, "qix_invalid_metadata"],
    ]) {
      const f = fixture();
      f.masters.get("measure:synthetic-measure-master").qMeasure[field] = value;
      await assert.rejects(inspect(f.global), sanitized(code));
    }
    const empty = fixture();
    empty.masters.get("dimension:synthetic-dimension-master").qDim = {};
    await assert.rejects(inspect(empty.global), sanitized("qix_invalid_metadata"));
  });

  test(`${mode}: abort during each master stage prevents subsequent requests`, async () => {
    for (const method of ["getDimension", "getMeasure", "masterGetProperties"]) {
      const f = fixture();
      const controller = new AbortController();
      f.afterCall = (current) => {
        if (current === method) controller.abort(PRIVATE);
      };
      await assert.rejects(
        inspect(f.global, { signal: controller.signal }),
        sanitized("qix_aborted"),
      );
      assert.equal(f.calls.at(-1)[0], method);
    }
  });

  test(`${mode}: missing reload stays unknown; unexpected reload text is sanitized`, async () => {
    const f = fixture();
    f.layout = {};
    const result = await inspect(f.global);
    assert.equal(result.sourceReloadTime, null);
    assert.ok(result.reasons.includes("reload_time_unavailable"));
    f.layout.qLastReloadTime = PRIVATE;
    await assert.rejects(inspect(f.global), sanitized("qix_invalid_reload_time"));
  });
}
