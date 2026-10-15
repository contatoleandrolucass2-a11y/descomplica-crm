import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { inspectQlikRankingMetadata } from "./qix-metadata.mjs";
import { getBrowserMetadataScript } from "./browser-preflight.mjs";

const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
const PRODUCTS = "26aed86d-e96b-4151-bc15-7b54d456f032";
const CONTAINER = "8b78e5d8-6b6b-4a29-be0c-cd855b9ec765";
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
    qMetaDef: { ...(type === "measure" ? { title: "VENDAS" } : {}), description: PRIVATE },
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
    measureItems: [
      {
        qInfo: { qId: "synthetic-measure-master", qType: "measure" },
        qData: { title: "VENDAS", label: "VGV" },
      },
    ],
    fields: [{ qName: "DT", qTags: ["$date"] }],
    variables: new Map(
      ["VENDAS", "VGV"].map((name) => [
        name,
        {
          qInfo: { qId: `synthetic-variable-${name}`, qType: "variable" },
          qName: name,
          qDefinition: `Sum([Synthetic ${name}])`,
          qComment: PRIVATE,
        },
      ]),
    ),
    sessions: new Set(),
    catalogLayout: null,
    cleanupResult: true,
    effective: new Map(),
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
      return invoke(
        "getEffectiveProperties",
        [this.id],
        f.effective.get(this.id) ?? properties.get(this.id),
      );
    }
    getLayout() {
      assert.fail("object layout is forbidden");
    }
    getHyperCubeData() {
      assert.fail("data is forbidden");
    }
  }
  class Doc {
    createSessionObject(properties) {
      const { qId } = properties.qInfo;
      assert.match(qId, /^ranking-metadata-catalog-[0-9a-f-]{36}$/);
      assert.deepEqual(clean(properties), {
        qInfo: { qId, qType: "MeasureList" },
        qMeasureListDef: {
          qType: "measure",
          qData: { title: "/qMetaDef/title", label: "/qMeasure/qLabel" },
        },
        qFieldListDef: {
          qShowSystem: false,
          qShowHidden: true,
          qShowSemantic: false,
          qShowSrcTables: false,
          qShowDefinitionOnly: true,
          qShowDerivedFields: true,
          qShowImplicit: false,
        },
      });
      f.sessions.add(qId);
      return invoke("createSessionObject", [properties], {
        getLayout() {
          return invoke(
            "catalogLayout",
            [qId],
            f.catalogLayout ?? {
              qInfo: { qId, qType: "MeasureList" },
              qMeasureList: { qItems: f.measureItems },
              qFieldList: { qItems: f.fields },
            },
          );
        },
      });
    }
    destroySessionObject(objectId) {
      assert.ok(f.sessions.delete(objectId), "only the owned session can be destroyed");
      return invoke("destroySessionObject", [objectId], f.cleanupResult);
    }
    getVariableByName(name) {
      assert.ok(["VENDAS", "VGV"].includes(name), "no broad variable scan");
      if (!f.variables.has(name)) {
        calls.push(["getVariableByName", name]);
        throw new Error(PRIVATE);
      }
      return invoke("getVariableByName", [name], {
        getProperties() {
          return invoke("variableGetProperties", [name], f.variables.get(name));
        },
        getLayout() {
          assert.fail("variable evaluated layout is forbidden");
        },
      });
    }
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

function tabbedFixture() {
  const f = fixture();
  const container = f.properties.get(CONTAINER);
  container.qInfo.qType = "sn-tabbed-container";
  container.visualization = "sn-tabbed-container";
  delete container.children;
  // Qlik's published sn-tabbed-container 2.12.0 ContainerChildProperties schema.
  container.objects = [
    { childRefId: TAB, label: "Parceiras", condition: { qValueExpression: {} } },
  ];
  container.qChildListDef = { qData: { childRefId: "/childRefId" } };
  f.properties.get(PARTNERS).childRefId = TAB;
  return f;
}

function namedMeasure(f, measureId, title, label = title) {
  const properties = master(measureId, "measure");
  properties.qMetaDef.title = title;
  properties.qMeasure.qLabel = label;
  f.masters.set(`measure:${measureId}`, properties);
  f.measureItems.push({
    qInfo: { qId: measureId, qType: "measure" },
    qData: { title, label },
  });
  return properties;
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
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
function digest(value) {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}
const hashTargets = [
  {
    name: "effective cube",
    raw: (f) => f.properties.get(PRODUCTS).qHyperCubeDef,
    output: (result) => result.objects.find(({ id }) => id === PRODUCTS),
    hash: "qHyperCubeSha256",
    projection: "qHyperCubeDef",
  },
  ...["dimension", "measure"].map((type) => ({
    name: `${type} master`,
    raw: (f) =>
      f.masters.get(`${type}:synthetic-${type}-master`)[type === "dimension" ? "qDim" : "qMeasure"],
    output: (result) => result.masterDefinitions.find((item) => item.type === type),
    hash: "definitionSha256",
    projection: type === "dimension" ? "qDim" : "qMeasure",
  })),
];
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
  [
    "closure-free VM",
    runInNewContext(`(${inspectQlikRankingMetadata.toString()})`, { crypto, TextEncoder }),
  ],
]) {
  test(`${mode}: cube digest uses effective properties rather than the sheet tree`, async () => {
    const f = fixture();
    const effective = structuredClone(f.properties.get(PRODUCTS));
    effective.qHyperCubeDef.extraPrivateDefinition = PRIVATE;
    f.effective.set(PRODUCTS, effective);
    const product = (await inspect(f.global)).objects.find(({ id }) => id === PRODUCTS);
    assert.equal(product.qHyperCubeSha256, digest(effective.qHyperCubeDef));
    assert.notEqual(product.qHyperCubeSha256, digest(f.properties.get(PRODUCTS).qHyperCubeDef));
    assert.equal(JSON.stringify(product).includes(PRIVATE), false);
  });

  for (const target of hashTargets) {
    test(`${mode}: ${target.name} digest covers unprojected metadata without exposing it`, async () => {
      const f = fixture();
      const raw = target.raw(f);
      raw.extraPrivateDefinition = {
        z: PRIVATE,
        a: { 2: "two", 10: "ten", text: "\u00e9\ud83d\ude00", value: [null, true, 1.5, -0] },
      };
      const first = target.output(await inspect(f.global));
      assert.equal(first[target.hash], digest(raw));
      assert.equal(JSON.stringify(first).includes(PRIVATE), false);
      assert.equal(JSON.stringify(first).includes("extraPrivateDefinition"), false);
      const reversed = Object.fromEntries(Object.entries(raw.extraPrivateDefinition).reverse());
      raw.extraPrivateDefinition = reversed;
      assert.equal(target.output(await inspect(f.global))[target.hash], first[target.hash]);
      reversed.a.value.reverse();
      const changed = target.output(await inspect(f.global));
      assert.notEqual(changed[target.hash], first[target.hash]);
      assert.equal(changed[target.hash], digest(raw));
      assert.deepEqual(clean(changed[target.projection]), clean(first[target.projection]));
    });

    test(`${mode}: ${target.name} digest enforces the exact UTF8 byte boundary`, async () => {
      const f = fixture();
      const raw = target.raw(f);
      raw.extra = "";
      const remaining = 262_144 - Buffer.byteLength(canonical(raw), "utf8");
      raw.extra = "\u00e9".repeat(Math.floor(remaining / 2)) + "a".repeat(remaining % 2);
      assert.equal(Buffer.byteLength(canonical(raw), "utf8"), 262_144);
      assert.equal(target.output(await inspect(f.global))[target.hash], digest(raw));
      raw.extra += "a";
      await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
    });

    test(`${mode}: ${target.name} digest rejects non-JSON values and accessors without invoking them`, async () => {
      for (const value of [NaN, Infinity, -Infinity, undefined, 1n, () => {}, Array(1)]) {
        const f = fixture();
        target.raw(f).extra = value;
        await assert.rejects(inspect(f.global), sanitized("qix_invalid_metadata"));
      }
      for (const extra of [{}, [0]]) {
        const f = fixture();
        let invoked = false;
        Object.defineProperty(extra, Array.isArray(extra) ? "0" : "private", {
          enumerable: true,
          get() {
            invoked = true;
            throw new Error(PRIVATE);
          },
        });
        target.raw(f).extra = extra;
        await assert.rejects(inspect(f.global), sanitized("qix_invalid_metadata"));
        assert.equal(invoked, false);
      }
    });

    test(`${mode}: ${target.name} digest bounds recursive depth and cycles`, async () => {
      const f = fixture();
      const raw = target.raw(f);
      let nested = null;
      for (let index = 0; index < 31; index++) nested = { next: nested };
      raw.extra = nested;
      assert.equal(target.output(await inspect(f.global))[target.hash], digest(raw));
      raw.extra = { next: nested };
      await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
      raw.extra = raw;
      await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
    });
  }

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
    assert.equal(product.qHyperCubeSha256, digest(f.properties.get(PRODUCTS).qHyperCubeDef));
    assert.equal(
      result.objects.find(({ id }) => id === PARTNERS).qHyperCubeSha256,
      digest(f.properties.get(PARTNERS).qHyperCubeDef),
    );
    assert.equal(result.objects.find(({ id }) => id === CONTAINER).qHyperCubeSha256, undefined);
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

  test(`${mode}: native tab objects join direct childRefId, never the UI ID as an Engine ID`, async () => {
    const f = tabbedFixture();
    const result = clean(await inspect(f.global));
    assert.equal(result.status, "inspected");
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.containerStructure.arrays.objects, { kind: "array", count: 1 });
    assert.deepEqual(result.containerStructure.properties.objects, {
      kind: "array",
      count: 1,
      sha256: digest(f.properties.get(CONTAINER).objects),
    });
    assert.deepEqual(result.containerStructure.childObjects, [
      { id: PARTNERS, childRefId: { kind: "string", sha256: digest(TAB) } },
    ]);
    const [reference] = result.containerStructure.references;
    assert.equal(reference.source, "objects");
    assert.equal(reference.childRefId, TAB);
    assert.equal(reference.engineId, PARTNERS);
    assert.equal(reference.matchesPartners, true);
    assert.equal(reference.label, "Parceiras");
    assert.equal(reference.fields.label.sha256, digest("Parceiras"));
    assert.deepEqual(
      f.calls.filter(([method]) => method === "getObject").map(([, objectId]) => objectId),
      [SHEET, CONTAINER, PRODUCTS, PARTNERS],
    );
    assert.ok(!f.calls.some(([, objectId]) => objectId === TAB));
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
  });

  test(`${mode}: effective native tabs can resolve a static label through the exact child link`, async () => {
    const f = tabbedFixture();
    const effective = structuredClone(f.properties.get(CONTAINER));
    delete f.properties.get(CONTAINER).objects;
    effective.objects[0].childRefId = "synthetic-different-ui-tab";
    f.properties.get(PARTNERS).childRefId = "synthetic-different-ui-tab";
    f.effective.set(CONTAINER, effective);
    const result = await inspect(f.global);
    assert.equal(result.status, "inspected");
    assert.equal(result.containerStructure.references[0].engineId, PARTNERS);
  });

  test(`${mode}: unrelated native tabs expose no labels/formulas and authorize no sibling query`, async () => {
    const f = tabbedFixture();
    const sibling = entry("synthetic-unrelated-native-child", "table", [], {
      childRefId: "synthetic-unrelated-ui-tab",
    });
    Object.defineProperty(sibling.qProperty, "qHyperCubeDef", {
      get() {
        assert.fail("No unrelated child definition access");
      },
    });
    f.tree.qChildren.find((item) => item.qProperty.qInfo.qId === CONTAINER).qChildren.push(sibling);
    f.properties.get(CONTAINER).objects.push({
      childRefId: "synthetic-unrelated-ui-tab",
      label: PRIVATE,
      condition: { qValueExpression: { qExpr: PRIVATE } },
    });
    const result = await inspect(f.global);
    assert.equal(result.status, "inspected");
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
    assert.ok(!f.calls.some(([, objectId]) => objectId === "synthetic-unrelated-native-child"));
  });

  test(`${mode}: a native child link still cannot promote the known UI tab ID to an Engine ID`, async () => {
    const f = tabbedFixture();
    f.tree.qChildren.find((item) => item.qProperty.qInfo.qId === CONTAINER).qChildren = [
      entry(TAB, "table", [], { childRefId: TAB }),
    ];
    const result = await inspect(f.global);
    assert.equal(result.status, "pending");
    assert.ok(result.reasons.includes("partners_reference_ambiguous"));
    assert.ok(!f.calls.some(([, objectId]) => objectId === TAB || objectId === PARTNERS));
  });

  test(`${mode}: native tabs do not trust guessed refId/id, unrelated or nested child matches`, async () => {
    for (const scenario of ["missing", "different", "unrelated", "nested", "wrong-visualization"]) {
      const f = tabbedFixture();
      const container = f.tree.qChildren.find((item) => item.qProperty.qInfo.qId === CONTAINER);
      Object.assign(f.properties.get(CONTAINER).objects[0], { id: PARTNERS, refId: PARTNERS });
      if (scenario === "missing") delete f.properties.get(PARTNERS).childRefId;
      if (scenario === "different") f.properties.get(PARTNERS).childRefId = "different-ui-tab";
      if (scenario === "unrelated") f.tree.qChildren.push(...container.qChildren.splice(0));
      if (scenario === "nested")
        container.qChildren = [
          entry("synthetic-nested-container", "container", container.qChildren),
        ];
      if (scenario === "wrong-visualization")
        f.properties.get(CONTAINER).visualization = "unrecognized-container";
      const result = await inspect(f.global);
      assert.equal(result.status, "pending", scenario);
      assert.ok(result.reasons.includes("partners_membership_unproven"), scenario);
      assert.ok(
        !f.calls.some(([, objectId]) => objectId === PARTNERS || objectId === TAB),
        scenario,
      );
    }
  });

  test(`${mode}: duplicate native tabs or child links stay ambiguous without querying a target`, async () => {
    for (const scenario of ["duplicate-tab", "duplicate-child", "unresolved-tab"]) {
      const f = tabbedFixture();
      const container = f.properties.get(CONTAINER);
      if (scenario === "duplicate-tab") container.objects.push({ ...container.objects[0] });
      if (scenario === "unresolved-tab")
        container.objects.push({ childRefId: "synthetic-unresolved-tab", label: "Parceiras" });
      if (scenario === "duplicate-child")
        f.tree.qChildren
          .find((item) => item.qProperty.qInfo.qId === CONTAINER)
          .qChildren.push(entry("synthetic-other-engine-id", "table", [], { childRefId: TAB }));
      const result = await inspect(f.global);
      assert.equal(result.status, "pending", scenario);
      assert.ok(result.reasons.includes("partners_reference_ambiguous"), scenario);
      assert.ok(!f.calls.some(([, objectId]) => objectId === PARTNERS || objectId === TAB));
    }
  });

  test(`${mode}: unresolved native structure projects known field types and hashes, not formulas/data`, async () => {
    const f = tabbedFixture();
    const container = f.properties.get(CONTAINER);
    container.objects = [
      {
        childRefId: "synthetic-unresolved-tab",
        label: { qStringExpression: PRIVATE },
        condition: { qValueExpression: { qExpr: PRIVATE } },
        components: [{ arbitraryPrivateKey: PRIVATE }],
        qDataPages: [{ qMatrix: [[{ qText: PRIVATE }]] }],
      },
    ];
    const result = clean(await inspect(f.global));
    assert.equal(result.status, "pending");
    const [reference] = result.containerStructure.references;
    assert.equal(reference.matchesPartners, false);
    assert.equal(reference.fields.label.kind, "object");
    assert.equal(reference.fields.label.sha256, digest(container.objects[0].label));
    assert.equal(reference.fields.condition.sha256, digest(container.objects[0].condition));
    assert.deepEqual(reference.fields.components, {
      kind: "array",
      count: 1,
      sha256: digest(container.objects[0].components),
    });
    assert.equal(result.containerStructure.properties.qChildListDef.kind, "object");
    for (const denied of [PRIVATE, "qMatrix", "arbitraryPrivateKey"])
      assert.ok(!JSON.stringify(result).includes(denied), denied);
    for (const denied of ["qExpr", "qStringExpression"])
      assert.ok(!JSON.stringify(result.containerStructure).includes(denied), denied);
    assert.ok(!f.calls.some(([, objectId]) => objectId === PARTNERS));
    container.objects = { unknown: PRIVATE };
    const unknown = (await inspect(f.global)).containerStructure;
    assert.deepEqual(clean(unknown.arrays.objects), { kind: "unknown", count: null });
    assert.deepEqual(clean(unknown.properties.objects), {
      kind: "object",
      sha256: digest(container.objects),
    });
  });

  test(`${mode}: native structural limits and getters fail before any unproved query`, async () => {
    for (const scenario of ["objects", "children", "bytes", "getter", "child-getter"]) {
      const f = tabbedFixture();
      let invoked = false;
      const unsafe = () => {
        invoked = true;
        throw new Error(PRIVATE);
      };
      if (scenario === "objects") f.properties.get(CONTAINER).objects = Array(65).fill({});
      if (scenario === "children")
        f.tree.qChildren.find((item) => item.qProperty.qInfo.qId === CONTAINER).qChildren =
          Array.from({ length: 65 }, (_, index) => entry(`synthetic-child-${index}`));
      if (scenario === "bytes")
        f.properties.get(CONTAINER).objects[0].condition = "x".repeat(262144);
      if (scenario === "getter")
        Object.defineProperty(f.properties.get(CONTAINER).objects[0], "condition", {
          enumerable: true,
          get: unsafe,
        });
      if (scenario === "child-getter")
        Object.defineProperty(f.properties.get(PARTNERS), "childRefId", {
          enumerable: true,
          get: unsafe,
        });
      await assert.rejects(
        inspect(f.global),
        sanitized(scenario.includes("getter") ? "qix_invalid_metadata" : "qix_metadata_limit"),
      );
      assert.equal(invoked, false);
      assert.ok(!f.calls.some(([, objectId]) => objectId === PARTNERS));
    }
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
      definitionSha256: digest(f.masters.get("dimension:synthetic-dimension-master").qDim),
    });
    assert.equal(measure.type, "measure");
    assert.equal(
      measure.definitionSha256,
      digest(f.masters.get("measure:synthetic-measure-master").qMeasure),
    );
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
      // This boundary isolates cube library references; alias-union bounds are tested separately.
      f.measureItems = [];
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

  test(`${mode}: native aliases collect exact title/label candidates and full-property hashes without resolving precedence`, async () => {
    const f = tabbedFixture();
    const product = f.properties.get(PRODUCTS).qHyperCubeDef;
    product.qDimensions = [{ qDef: { qFieldDefs: ["=[Empreendimento (Filtro)]"] } }];
    product.qMeasures = [
      { qDef: { qDef: "=VENDAS", qLabel: "CONTRATOS" } },
      { qDef: { qDef: "=VGV", qLabel: "VGV" } },
    ];
    f.measureItems = [];
    const sales = namedMeasure(f, "synthetic-sales", "VENDAS", "Contratos de exemplo");
    const value = namedMeasure(f, "synthetic-value", "Valor de exemplo", "VGV");
    sales.qMeasure.unprojectedMetadata = { secret: PRIVATE };
    value.qMeasure.unprojectedMetadata = { secret: PRIVATE };
    f.measureItems.push({
      qInfo: { qId: "unrelated-measure", qType: "measure" },
      qData: { title: "Unrelated", label: "Unrelated" },
    });
    f.fields.push({ qName: "Empreendimento (Filtro)", qTags: ["$text"] });
    const result = clean(await inspect(f.global));
    assert.equal(result.status, "inspected");
    assert.equal(result.productionMappingVerified, false);
    assert.equal(result.dependencyClosureVerified, false);
    assert.equal(result.dataRead, false);
    assert.deepEqual(result.objects.find(({ id }) => id === PRODUCTS).qHyperCubeDef, {
      qMode: "S",
      qStateName: "$",
      qSuppressZero: true,
      qSuppressMissing: false,
      qDimensions: product.qDimensions,
      qMeasures: product.qMeasures,
    });
    assert.deepEqual(
      result.matchingMasterMeasures.map(({ id, title, referencedByAlias }) => ({
        id,
        title,
        referencedByAlias,
      })),
      [
        {
          id: "synthetic-sales",
          title: "VENDAS",
          referencedByAlias: [{ objectId: PRODUCTS, index: 0, alias: "VENDAS" }],
        },
        {
          id: "synthetic-value",
          title: "Valor de exemplo",
          referencedByAlias: [{ objectId: PRODUCTS, index: 1, alias: "VGV" }],
        },
      ],
    );
    for (const [output, original] of result.matchingMasterMeasures.map((item, index) => [
      item,
      [sales, value][index],
    ])) {
      assert.equal(output.definitionSha256, digest(original.qMeasure));
      assert.equal(output.propertiesSha256, digest(original));
      assert.equal(output.qMeasure.unprojectedMetadata, undefined);
    }
    assert.deepEqual(
      f.calls.filter(([method]) => method === "getVariableByName"),
      [
        ["getVariableByName", "VENDAS"],
        ["getVariableByName", "VGV"],
      ],
    );
    for (const item of result.variableDefinitions) {
      const original = f.variables.get(item.name);
      assert.deepEqual(item, {
        name: item.name,
        id: original.qInfo.qId,
        qDefinition: original.qDefinition,
        propertiesSha256: digest(original),
      });
    }
    assert.ok(!f.calls.some((call) => call.includes("unrelated-measure")));
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
    assert.equal(f.sessions.size, 0);
  });

  test(`${mode}: library and named measure requests are deduplicated without conflating aliases`, async () => {
    const f = fixture();
    const result = clean(await inspect(f.global));
    assert.equal(result.matchingMasterMeasures.length, 1);
    assert.equal(result.matchingMasterMeasures[0].id, "synthetic-measure-master");
    assert.equal(f.calls.filter(([method]) => method === "getMeasure").length, 1);
    assert.equal(
      f.calls.filter(([method, type]) => method === "masterGetProperties" && type === "measure")
        .length,
      1,
    );
    assert.equal(result.dependencyClosureVerified, false);
    assert.equal(result.productionMappingVerified, false);
  });

  test(`${mode}: all exact homonyms remain candidates; absent aliases remain diagnostic pending`, async () => {
    const f = fixture();
    namedMeasure(f, "synthetic-duplicate-sales", "VENDAS");
    namedMeasure(f, "synthetic-near-match", " vendas ", "Vgv");
    f.variables.delete("VENDAS");
    const result = clean(await inspect(f.global));
    assert.equal(result.status, "pending");
    assert.ok(result.reasons.includes("named_measure_VENDAS_ambiguous"));
    assert.ok(result.reasons.includes("variable_VENDAS_unresolved"));
    assert.deepEqual(
      result.matchingMasterMeasures.map(({ id }) => id),
      ["synthetic-measure-master", "synthetic-duplicate-sales"],
    );
    assert.deepEqual(
      result.variableDefinitions.map(({ name }) => name),
      ["VGV"],
    );
    assert.ok(!f.calls.some((call) => call.includes("synthetic-near-match")));
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
    const absent = fixture();
    absent.measureItems = [];
    absent.variables.clear();
    const missing = await inspect(absent.global);
    assert.equal(missing.status, "pending");
    assert.equal(missing.matchingMasterMeasures.length, 0);
    assert.equal(missing.variableDefinitions.length, 0);
    for (const name of ["VENDAS", "VGV"]) {
      assert.ok(missing.reasons.includes(`named_measure_${name}_unresolved`));
      assert.ok(missing.reasons.includes(`variable_${name}_unresolved`));
    }
  });

  test(`${mode}: named definitions recheck identities/types and advertised title/label`, async () => {
    for (const change of [
      (properties) => {
        properties.qInfo.qId = "wrong";
      },
      (properties) => {
        properties.qInfo.qType = "dimension";
      },
      (properties) => {
        properties.qMetaDef.title = "wrong";
      },
      (properties) => {
        properties.qMeasure.qLabel = "wrong";
      },
    ]) {
      const f = fixture();
      change(f.masters.get("measure:synthetic-measure-master"));
      await assert.rejects(inspect(f.global), sanitized("qix_scope_mismatch"));
    }
    for (const change of [
      (properties) => {
        properties.qName = "another-variable";
      },
      (properties) => {
        properties.qInfo.qType = "measure";
      },
      (properties) => {
        properties.qInfo.qId = "bad id";
      },
    ]) {
      const f = fixture();
      change(f.variables.get("VENDAS"));
      await assert.rejects(
        inspect(f.global),
        sanitized(
          f.variables.get("VENDAS").qInfo.qId === "bad id"
            ? "qix_invalid_metadata"
            : "qix_scope_mismatch",
        ),
      );
    }
    const uppercase = fixture();
    uppercase.variables.get("VGV").qInfo.qType = "Variable";
    assert.equal((await inspect(uppercase.global)).variableDefinitions.length, 2);
  });

  test(`${mode}: catalogue accepts 10k unrelated fields without charging their text or reading values`, async () => {
    const f = fixture();
    const retained = [
      "CD_IMOB",
      "ID_IMOBILIARIA",
      "ID_EMPREENDIMENTO",
      "CD_PRODUTO",
      "Empreendimento (Filtro)",
      "Empresa (Filtro)",
      "Regional (Filtro)",
      "DT",
      "DT.Cal.Ano",
      "DT.Cal.AnoMes",
      "DS_Canal_Origem",
      "VENDAS",
      "VGV",
      "Synthetic Entity ID",
      "Synthetic Partner Key",
    ];
    f.properties.get(PARTNERS).qHyperCubeDef.qDimensions.push({
      qDef: { qFieldDefs: ["=[Synthetic Partner Key]"] },
    });
    f.fields = Array.from({ length: 10_000 - retained.length }, (_, index) => {
      const item = { qName: `Unrelated_${index}_`.padEnd(256, "x") };
      for (const key of ["qTags", "qCardinal", "qData", "qSrcTables", "qValues"])
        Object.defineProperty(item, key, {
          get() {
            throw new Error(PRIVATE);
          },
        });
      return item;
    });
    for (const name of retained)
      f.fields.push({
        qName: name,
        qTags: ["$text"],
        qCardinal: 987654321,
        qData: PRIVATE,
        qSrcTables: [PRIVATE],
      });
    const result = clean(await inspect(f.global));
    assert.deepEqual(
      result.fieldCatalog,
      retained.sort().map((name) => ({ name, tags: ["$text"] })),
    );
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 262_144);
    for (const denied of [PRIVATE, "Unrelated_", "qCardinal", "qData", "qSrcTables", "qValues"])
      assert.ok(!JSON.stringify(result).includes(denied), denied);
  });

  test(`${mode}: derived calendar definitions retain only filtered names/tags, never expressions`, async () => {
    const f = fixture();
    const derived = { qName: "DT.Cal.AnoMes", qTags: ["$date", "$hidden"] };
    Object.defineProperty(derived, "qExpr", {
      get() {
        throw new Error(PRIVATE);
      },
    });
    f.fields = [
      {
        qName: "DT",
        qTags: ["$timestamp"],
        qDerivedFieldData: {
          qDerivedFieldLists: [
            {
              qFieldDefs: [derived, { qName: "UnrelatedDerived", qExpr: PRIVATE }],
            },
          ],
        },
      },
    ];
    assert.deepEqual(clean((await inspect(f.global)).fieldCatalog), [
      { name: "DT", tags: ["$timestamp"] },
      { name: "DT.Cal.AnoMes", tags: ["$date", "$hidden"] },
    ]);
  });

  test(`${mode}: raw catalogue counts, retained names/tags and aggregate text stay bounded`, async () => {
    for (const mutate of [
      (f) => {
        f.fields = Array.from({ length: 10_001 }, () => ({ qName: "Unrelated" }));
      },
      (f) => {
        f.fields = [{ qName: "x".repeat(257) }];
      },
      (f) => {
        f.fields = Array.from({ length: 257 }, (_, i) => ({ qName: `IMOB_${i}` }));
      },
      (f) => {
        f.fields = [{ qName: "DT", qTags: Array(33).fill("tag") }];
      },
      (f) => {
        f.fields = [{ qName: "DT", qTags: ["x".repeat(257)] }];
      },
      (f) => {
        f.fields = Array.from({ length: 9 }, (_, i) => ({
          qName: `IMOB_${i}`,
          qTags: Array(32).fill("x".repeat(256)),
        }));
      },
      (f) => {
        f.measureItems = Array(10_001).fill({});
      },
      (f) => {
        f.measureItems = [{ qData: { title: "x".repeat(257) } }];
      },
      (f) => {
        f.fields = [
          {
            qName: "DT",
            qDerivedFieldData: {
              qDerivedFieldLists: [{ qFieldDefs: Array(10_000).fill({ qName: "Unrelated" }) }],
            },
          },
        ];
      },
    ]) {
      const f = fixture();
      mutate(f);
      await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
      assert.equal(f.sessions.size, 0);
    }
    const f = fixture();
    f.fields = [{ qName: "DT", qTags: [42] }];
    await assert.rejects(inspect(f.global), sanitized("qix_invalid_metadata"));
  });

  test(`${mode}: alias candidates share the existing 64 typed-master budget before lookups`, async () => {
    for (const count of [62, 63]) {
      const f = fixture();
      f.measureItems = [];
      for (let index = 0; index < count; index++)
        namedMeasure(f, `synthetic-named-${index}`, "VENDAS");
      if (count === 62) {
        const result = await inspect(f.global);
        assert.equal(result.matchingMasterMeasures.length, 62);
        assert.equal(
          f.calls.filter(([method]) => ["getDimension", "getMeasure"].includes(method)).length,
          64,
        );
      } else {
        await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
        assert.ok(!f.calls.some(([method]) => ["getDimension", "getMeasure"].includes(method)));
      }
      assert.equal(f.sessions.size, 0);
    }
  });

  test(`${mode}: metadata session is destroyed on layout failure, bounds and abort, never a source object`, async () => {
    for (const method of ["createSessionObject", "catalogLayout"]) {
      const f = fixture();
      f.failure = method;
      await assert.rejects(inspect(f.global), sanitized("qix_request_failed"));
      assert.equal(f.calls.at(-1)[0], "destroySessionObject");
      assert.equal(f.sessions.size, 0);
      const abort = fixture();
      const controller = new AbortController();
      abort.afterCall = (current) => {
        if (current === method) controller.abort(PRIVATE);
      };
      await assert.rejects(
        inspect(abort.global, { signal: controller.signal }),
        sanitized("qix_aborted"),
      );
      assert.equal(abort.calls.at(-1)[0], "destroySessionObject");
      assert.equal(abort.sessions.size, 0);
    }
    for (const value of [false, undefined]) {
      const f = fixture();
      f.cleanupResult = value;
      await assert.rejects(inspect(f.global), sanitized("qix_cleanup_failed"));
    }
    const wrong = fixture();
    wrong.catalogLayout = { qInfo: { qId: SHEET, qType: "MeasureList" } };
    await assert.rejects(inspect(wrong.global), sanitized("qix_scope_mismatch"));
    assert.equal(wrong.sessions.size, 0);
  });

  test(`${mode}: variable properties have independent bounded hashes and sanitized definitions`, async () => {
    for (const [field, value, code] of [
      ["qDefinition", "x".repeat(4097), "qix_metadata_limit"],
      ["privateMetadata", "x".repeat(524_288), "qix_metadata_limit"],
      ["privateMetadata", Infinity, "qix_invalid_metadata"],
    ]) {
      const f = fixture();
      f.variables.get("VGV")[field] = value;
      await assert.rejects(inspect(f.global), sanitized(code));
    }
    const accessor = fixture();
    Object.defineProperty(accessor.variables.get("VGV"), "qDefinition", {
      get() {
        throw new Error(PRIVATE);
      },
    });
    await assert.rejects(inspect(accessor.global), sanitized("qix_invalid_metadata"));
    const empty = fixture();
    empty.variables.get("VGV").qDefinition = "";
    assert.ok((await inspect(empty.global)).reasons.includes("variable_VGV_unresolved"));
  });

  test(`${mode}: complete metadata output never exceeds the reader's fixed 262144-byte cap`, async () => {
    for (const text of ["x", "\u0001"]) {
      const f = fixture();
      for (const objectId of [PRODUCTS, PARTNERS])
        f.properties.get(objectId).qHyperCubeDef.qMeasures = Array.from({ length: 6 }, () => ({
          qDef: { qDef: text.repeat(4096) },
        }));
      if (text === "x") {
        const result = await inspect(f.global);
        assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 262_144);
      } else {
        await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
        assert.equal(f.calls.at(-1)[0], "getAppLayout");
      }
    }
  });

  test(`${mode}: artifact envelope also respects the existing writer/host 131072-byte cap`, async () => {
    for (const text of ["x", "\u0001"]) {
      const f = fixture();
      for (const objectId of [PRODUCTS, PARTNERS])
        f.properties.get(objectId).qHyperCubeDef.qMeasures = Array.from({ length: 4 }, () => ({
          qDef: { qDef: text.repeat(4096) },
        }));
      if (text === "x") {
        const result = await inspect(f.global);
        const artifact = {
          schemaVersion: 1,
          kind: "qlik_metadata_preflight",
          observedAt: RELOAD,
          rankingConnected: false,
          result,
        };
        assert.ok(Buffer.byteLength(JSON.stringify(artifact), "utf8") <= 131_072);
      } else {
        // These definitions fit individually and the result fits 256 KiB, but not the artifact.
        await assert.rejects(inspect(f.global), sanitized("qix_metadata_limit"));
        assert.equal(f.calls.at(-1)[0], "getAppLayout");
      }
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

test("serialized digest failures and cancellation remain sanitized", async () => {
  for (const action of ["missing", "failure", "abort"]) {
    const controller = new AbortController();
    const inspect = runInNewContext(`(${inspectQlikRankingMetadata.toString()})`, {
      TextEncoder,
      crypto:
        action === "missing"
          ? undefined
          : {
              subtle: {
                digest: async (...args) => {
                  if (action === "failure") throw new Error(PRIVATE);
                  const result = await crypto.subtle.digest(...args);
                  controller.abort(PRIVATE);
                  return result;
                },
              },
            },
    });
    const f = fixture();
    await assert.rejects(
      inspect(f.global, { signal: controller.signal }),
      sanitized(action === "abort" ? "qix_aborted" : "qix_metadata_failed"),
    );
    assert.equal(f.calls.at(-1)[0], "getEffectiveProperties");
  }
});

test("generated script and pinned SDK round-trip native tabs, catalogues and variable properties with owned cleanup", async () => {
  const script = await getBrowserMetadataScript();
  for (const scenario of ["success", "missing-reload", "field-limit", "catalog-failure"]) {
    const f = tabbedFixture();
    f.properties.get(PRODUCTS).qHyperCubeDef.qMeasures = [
      { qDef: { qDef: "=VENDAS", qLabel: "CONTRATOS" } },
      { qDef: { qDef: "=VGV", qLabel: "VGV" } },
    ];
    f.fields.push({
      qName: "UnrelatedDate",
      qDerivedFieldData: {
        qDerivedFieldLists: [
          { qFieldDefs: [{ qName: "DT.Cal.AnoMes", qTags: ["$date"], qExpr: PRIVATE }] },
        ],
      },
    });
    if (scenario === "missing-reload") f.layout = {};
    if (scenario === "field-limit") f.fields = Array(10_001).fill({ qName: "Unrelated" });
    if (scenario === "catalog-failure") f.failure = "catalogLayout";
    const handles = new Map([[-1, f.global]]);
    let nextHandle = 0;
    let socketClosed = false;
    const rpc = [];
    const timers = new Map();
    const window = { enigma: "existing-page-sdk" };
    const methods = {
      OpenDoc: ["openDoc", "Doc"],
      GetObject: ["getObject", "GenericObject"],
      GetDimension: ["getDimension", "GenericDimension"],
      GetMeasure: ["getMeasure", "GenericMeasure"],
      GetVariableByName: ["getVariableByName", "GenericVariable"],
      CreateSessionObject: ["createSessionObject", "GenericObject"],
      DestroySessionObject: ["destroySessionObject", null, "qSuccess"],
      GetFullPropertyTree: ["getFullPropertyTree", null, "qPropEntry"],
      GetEffectiveProperties: ["getEffectiveProperties", null, "qProp"],
      GetProperties: ["getProperties", null, "qProp"],
      GetLayout: ["getLayout", null, "qLayout"],
      GetAppLayout: ["getAppLayout", null, "qLayout"],
    };
    runInNewContext(script, {
      window,
      crypto,
      TextEncoder,
      AbortController,
      URL,
      location: { origin: "https://direcional.us.qlikcloud.com" },
      fetch: async () => ({
        ok: true,
        status: 204,
        headers: new Headers({ "qlik-csrf-token": "synthetic-csrf-token-for-tests" }),
      }),
      setTimeout: (callback) => {
        const id = timers.size + 1;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      WebSocket: class {
        constructor() {
          queueMicrotask(() => this.onopen?.());
        }
        send(raw) {
          const request = JSON.parse(raw);
          rpc.push(request.method);
          assert.ok(Object.hasOwn(methods, request.method), `unexpected RPC ${request.method}`);
          const [method, type, out] = methods[request.method];
          Promise.resolve().then(async () => {
            let response;
            try {
              const model = handles.get(request.handle);
              const result = await model[method](...request.params);
              response = type
                ? { qReturn: { qType: type, qHandle: ++nextHandle } }
                : { [out]: result };
              if (type) handles.set(nextHandle, result);
            } catch {
              this.onmessage?.({
                data: JSON.stringify({
                  jsonrpc: "2.0",
                  id: request.id,
                  error: { code: 1002, message: PRIVATE },
                }),
              });
              return;
            }
            this.onmessage?.({
              data: JSON.stringify({ jsonrpc: "2.0", id: request.id, result: response }),
            });
          });
        }
        close() {
          socketClosed = true;
          this.onclose?.({ code: 1000 });
        }
      },
    });
    const result = clean(await window.__descomplicaQlikMetadataV1.run());
    if (["success", "missing-reload"].includes(scenario)) {
      assert.equal(result.status, scenario === "success" ? "inspected" : "pending");
      assert.equal(result.sourceReloadTime, scenario === "success" ? RELOAD : null);
      if (scenario === "missing-reload")
        assert.ok(result.reasons.includes("reload_time_unavailable"));
      assert.equal(result.matchingMasterMeasures.length, 1);
      assert.equal(result.variableDefinitions.length, 2);
      assert.equal(result.containerStructure.references[0].engineId, PARTNERS);
      assert.ok(result.fieldCatalog.some(({ name }) => name === "DT.Cal.AnoMes"));
      assert.equal(result.dependencyClosureVerified, false);
      assert.equal(result.productionMappingVerified, false);
      assert.ok(rpc.includes("GetVariableByName"));
      assert.ok(rpc.includes("GetAppLayout"));
    } else {
      assert.deepEqual(result, {
        status: "unavailable",
        reason: scenario === "field-limit" ? "qix_metadata_limit" : "qix_request_failed",
      });
    }
    assert.equal(f.sessions.size, 0);
    assert.equal(f.calls.filter(([method]) => method === "destroySessionObject").length, 1);
    assert.equal(rpc.filter((method) => method === "GetLayout").length, 1);
    assert.ok(rpc.includes("CreateSessionObject"));
    assert.ok(rpc.includes("DestroySessionObject"));
    assert.equal(window.enigma, "existing-page-sdk");
    assert.equal(socketClosed, true);
    assert.equal(timers.size, 0);
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 262_144);
  }
});
