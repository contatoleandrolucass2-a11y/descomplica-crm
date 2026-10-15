/**
 * Metadata only. The caller owns authenticated tenant binding, transport and deadline.
 * Keep all bindings inside: the owner serializes this function into its browser context.
 * Enigma unwraps qPropEntry/qProp/qLayout; no JSON-RPC envelopes are accepted here.
 * Container schema: https://unpkg.com/@nebula.js/sn-tabbed-container@2.12.0/api-specification/spec.json
 */
export async function inspectQlikRankingMetadata(global, options = {}) {
  const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
  const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
  const PRODUCTS = "26aed86d-e96b-4151-bc15-7b54d456f032";
  const CONTAINER = "8b78e5d8-6b6b-4a29-be0c-cd855b9ec765";
  // UI tab identity is NOT an Engine object ID.
  const PARTNERS_TAB = "pUYysrvJ";
  const MAX_DEPTH = 8;
  const MAX_NODES = 128;
  const MAX_REFS = 512;
  const MAX_MASTER_DEFINITIONS = 64;
  const ALIASES = ["VENDAS", "VGV"];
  const MAX_CATALOG_ITEMS = 10_000;
  const MAX_CATALOG_FIELDS = 256;
  let referenceCount = 0;
  let textBudget = 65_536;

  class MetadataError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }
  const fail = (code) => {
    throw new MetadataError(code);
  };
  function record(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("qix_invalid_metadata");
    }
    return value;
  }
  function own(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(record(value), key);
    if (!descriptor) return undefined;
    if (!("value" in descriptor)) fail("qix_invalid_metadata");
    return descriptor.value;
  }
  function array(value, max) {
    if (!Array.isArray(value)) fail("qix_invalid_metadata");
    if (value.length > max) fail("qix_metadata_limit");
    return value;
  }
  function string(value, max = 4096) {
    if (typeof value !== "string") fail("qix_invalid_metadata");
    if (value.length > max) fail("qix_metadata_limit");
    textBudget -= value.length;
    if (textBudget < 0) fail("qix_metadata_limit");
    return value;
  }
  function id(value) {
    const result = string(value, 256);
    if (!result || /[\u0000-\u0020\u007f]/u.test(result)) fail("qix_invalid_metadata");
    return result;
  }
  function checkAbort() {
    if (options.signal?.aborted) fail("qix_aborted");
  }
  async function definitionSha256(value, maxBytes = 262_144, maxDepth = 32) {
    const encoder = new TextEncoder();
    const parts = [];
    let remaining = maxBytes;
    function append(text) {
      remaining -= encoder.encode(text).length;
      if (remaining < 0) fail("qix_metadata_limit");
      parts.push(text);
    }
    function quoted(text) {
      if (text.length > remaining) fail("qix_metadata_limit");
      append(JSON.stringify(text));
    }
    // Match the collector's full-definition canonical JSON, without invoking getters/toJSON.
    function canonical(item, depth = 0) {
      checkAbort();
      if (depth > maxDepth) fail("qix_metadata_limit");
      if (typeof item === "string") return quoted(item);
      if (item === null || typeof item === "boolean") return append(JSON.stringify(item));
      if (typeof item === "number") {
        if (!Number.isFinite(item)) fail("qix_invalid_metadata");
        return append(JSON.stringify(item));
      }
      if (!item || typeof item !== "object") fail("qix_invalid_metadata");
      if (Object.getOwnPropertySymbols(item).length) fail("qix_invalid_metadata");
      if (Array.isArray(item)) {
        if (item.length > 131_071) fail("qix_metadata_limit");
        append("[");
        for (let index = 0; index < item.length; index++) {
          if (index) append(",");
          const property = Object.getOwnPropertyDescriptor(item, String(index));
          if (!property || !("value" in property)) fail("qix_invalid_metadata");
          canonical(property.value, depth + 1);
        }
        append("]");
      } else {
        append("{");
        const keys = Object.keys(item).sort();
        for (let index = 0; index < keys.length; index++) {
          if (index) append(",");
          quoted(keys[index]);
          append(":");
          canonical(own(item, keys[index]), depth + 1);
        }
        append("}");
      }
    }
    canonical(value);
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(parts.join("")));
    checkAbort();
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function call(model, method, ...args) {
    checkAbort();
    if (typeof model?.[method] !== "function") fail("qix_invalid_sdk");
    let result;
    try {
      result = await model[method](...args);
    } catch {
      checkAbort();
      fail("qix_request_failed");
    }
    checkAbort();
    return result;
  }

  // Projection, never a raw property clone. Expressions remain definitions, not evaluated data.
  const expression = { qv: "string" };
  const otherLimits = {
    qOtherMode: "string",
    qOtherCounted: expression,
    qOtherLimit: expression,
    qOtherLimitMode: "string",
    qSuppressOther: "boolean",
    qForceBadValueKeeping: "boolean",
    qApplyEvenWhenPossiblyWrongResult: "boolean",
    qGlobalOtherGrouping: "boolean",
    qOtherCollapseInnerDimensions: "boolean",
    qOtherSortMode: "string",
    qTotalMode: "string",
    qReferencedExpression: expression,
  };
  const dimension = {
    qLibraryId: "string",
    qDef: { qFieldDefs: ["string", 16], qFieldLabels: ["string", 16], qGrouping: "string" },
    qNullSuppression: "boolean",
    qOtherTotalSpec: otherLimits,
    qCalcCond: expression,
    qCalcCondition: { qCond: expression },
  };
  const measure = {
    qLibraryId: "string",
    qDef: {
      qDef: "string",
      qLabel: "string",
      qLabelExpression: "string",
      qGrouping: "string",
      qNumFormat: { qType: "string", qFmt: "string", qDec: "string", qThou: "string" },
    },
    qCalcCond: expression,
    qCalcCondition: { qCond: expression },
  };
  const cubeDefinition = {
    qStateName: "string",
    qMode: "string",
    qReductionMode: "string",
    qSuppressZero: "boolean",
    qSuppressMissing: "boolean",
    qCalcCond: expression,
    qCalcCondition: { qCond: expression },
    qContextSetExpression: "string",
    qDimensions: [dimension, 32],
    qMeasures: [measure, 32],
  };
  function project(value, schema) {
    if (schema === "string") return string(value);
    if (schema === "int32") {
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
        fail("qix_invalid_metadata");
      return value;
    }
    if (schema === "boolean") {
      if (typeof value !== "boolean") fail("qix_invalid_metadata");
      return value;
    }
    if (Array.isArray(schema)) {
      return array(value, schema[1]).map((item) => project(item, schema[0]));
    }
    const result = {};
    for (const key of Object.keys(schema)) {
      const item = own(value, key);
      if (item !== undefined) result[key] = project(item, schema[key]);
    }
    return result;
  }
  function identity(properties, expected) {
    const info = own(properties, "qInfo");
    const objectId = id(own(info, "qId"));
    if (expected && objectId !== expected) fail("qix_scope_mismatch");
    return objectId;
  }

  try {
    record(options);
    if (Object.keys(options).some((key) => key !== "signal")) fail("qix_invalid_options");
    const doc = await call(global, "openDoc", APP);
    const sheet = await call(doc, "getObject", SHEET);
    const tree = await call(sheet, "getFullPropertyTree");
    const root = own(tree, "qProperty");
    identity(root, SHEET);
    if (own(own(root, "qInfo"), "qType") !== "sheet") fail("qix_scope_mismatch");

    const propertiesById = new Map();
    const childrenById = new Map();
    const edges = new Map();
    const visitedEntries = new WeakSet();
    function edge(parent, child) {
      if (++referenceCount > MAX_REFS) fail("qix_metadata_limit");
      if (!edges.has(parent)) edges.set(parent, new Set());
      edges.get(parent).add(child);
    }
    function cells(properties, parent) {
      const refs = own(properties, "cells");
      if (refs === undefined) return;
      for (const cell of array(refs, MAX_REFS)) {
        const refId = own(cell, "refId");
        const chartId = own(cell, "chartId");
        if (refId && chartId && refId !== chartId) continue;
        const target = refId ?? chartId ?? own(cell, "name");
        if (typeof target === "string" && target) edge(parent, id(target));
      }
    }
    function visit(entry, parent, depth) {
      checkAbort();
      if (depth > MAX_DEPTH || propertiesById.size >= MAX_NODES) fail("qix_metadata_limit");
      record(entry);
      if (visitedEntries.has(entry)) fail("qix_metadata_cycle");
      visitedEntries.add(entry);
      const properties = own(entry, "qProperty");
      const objectId = identity(properties);
      if (propertiesById.has(objectId)) fail("qix_duplicate_object");
      propertiesById.set(objectId, properties);
      if (parent) {
        edge(parent, objectId);
        if (!childrenById.has(parent)) childrenById.set(parent, []);
        childrenById.get(parent).push(objectId);
      }
      cells(properties, objectId);
      const children = own(entry, "qChildren");
      if (children !== undefined) {
        for (const child of array(children, MAX_NODES)) visit(child, objectId, depth + 1);
      }
      // qEmbeddedSnapshotRef and every unrelated definition/layout are deliberately ignored.
    }
    visit(tree, null, 0);

    function reachable(from, target) {
      const seen = new Set([from]);
      const queue = [[from, 0]];
      for (let index = 0; index < queue.length; index++) {
        const [current, depth] = queue[index];
        if (current === target) return true;
        const children = edges.get(current) ?? [];
        for (const child of children) {
          if (seen.has(child)) continue;
          if (depth >= MAX_DEPTH || seen.size >= MAX_REFS) fail("qix_metadata_limit");
          seen.add(child);
          queue.push([child, depth + 1]);
        }
      }
      return false;
    }

    const objects = [];
    const read = new Set();
    let containerStructure = null;
    let partnerId = null;
    let partnerAmbiguous = false;
    async function containerReferences(properties) {
      const structure = { arrays: {}, references: [], properties: {}, childObjects: [] };
      const targets = new Set();
      let unresolvedMatch = false;
      let matchingTabs = 0;
      async function describe(value) {
        const kind =
          value === undefined
            ? "missing"
            : value === null
              ? "null"
              : Array.isArray(value)
                ? "array"
                : typeof value;
        return {
          kind,
          ...(Array.isArray(value) ? { count: value.length } : {}),
          ...(value === undefined ? {} : { sha256: await definitionSha256(value) }),
        };
      }
      const tabbed = own(properties, "visualization") === "sn-tabbed-container";
      const childRefs = new Map();
      if (tabbed) {
        // Qlik's published sn-tabbed-container 2.12.0 ContainerChildProperties schema.
        // The published core/esm/index.js creates the same childRefId on the child property.
        // objects[].childRefId joins the direct child's /childRefId, never its Engine ID.
        for (const childId of array(childrenById.get(CONTAINER) ?? [], 64)) {
          const childRefId = own(propertiesById.get(childId), "childRefId");
          structure.childObjects.push({
            id: childId,
            childRefId: await describe(childRefId),
          });
          if (typeof childRefId !== "string" || !childRefId) continue;
          const ref = id(childRefId);
          if (!childRefs.has(ref)) childRefs.set(ref, []);
          childRefs.get(ref).push(childId);
        }
        structure.properties.qChildListDef = await describe(own(properties, "qChildListDef"));
      }
      for (const key of ["children", "cells", "objects"]) {
        const items = own(properties, key);
        structure.arrays[key] = {
          kind: Array.isArray(items) ? "array" : items === undefined ? "missing" : "unknown",
          count: Array.isArray(items) ? items.length : null,
        };
        if (Array.isArray(items)) array(items, 64);
        structure.properties[key] = await describe(items);
        if (!Array.isArray(items) || (key === "objects" && !tabbed)) continue;
        for (const item of array(items, 64)) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const reference = { source: key };
          for (const field of key === "objects" ? ["childRefId"] : ["cId", "refId", "chartId"]) {
            const value = own(item, field);
            if (typeof value === "string" && value) reference[field] = id(value);
          }
          if (key === "objects") {
            reference.fields = {};
            for (const field of ["childRefId", "label", "condition", "components"])
              reference.fields[field] = await describe(own(item, field));
          }
          const matchesTab = (reference.childRefId ?? reference.cId) === PARTNERS_TAB;
          const matchesLabel = own(item, "label") === "Parceiras";
          reference.matchesPartners = matchesTab || matchesLabel;
          if (matchesLabel) reference.label = "Parceiras";
          structure.references.push(reference);
          if (!reference.matchesPartners) continue;
          if (key === "objects" && ++matchingTabs > 1) partnerAmbiguous = true;
          if (reference.refId && reference.chartId && reference.refId !== reference.chartId) {
            partnerAmbiguous = true;
          }
          let target = reference.refId ?? reference.chartId;
          if (key === "objects") {
            const matches = childRefs.get(reference.childRefId) ?? [];
            if (matches.length > 1) partnerAmbiguous = true;
            if (matches.length === 1) {
              [target] = matches;
              reference.engineId = target;
            }
          }
          if (target) targets.add(target);
          else unresolvedMatch = true;
        }
      }
      if (targets.size > 1 || (targets.size === 1 && unresolvedMatch)) partnerAmbiguous = true;
      if (!partnerAmbiguous && targets.size === 1) {
        const target = [...targets][0];
        if ([SHEET, PRODUCTS, CONTAINER, PARTNERS_TAB].includes(target)) partnerAmbiguous = true;
        else {
          partnerId = target;
          edge(CONTAINER, partnerId);
        }
      }
      return structure;
    }
    async function inspectCandidate(objectId, role) {
      const model = await call(doc, "getObject", objectId);
      const properties = propertiesById.get(objectId) ?? (await call(model, "getProperties"));
      identity(properties, objectId);
      cells(properties, objectId);
      const effective = await call(model, "getEffectiveProperties");
      identity(effective, objectId);
      cells(effective, objectId);
      const metadata = project(effective, {
        visualization: "string",
        qExtendsId: "string",
        qStateName: "string",
        qHyperCubeDef: cubeDefinition,
      });
      const fullCube = own(effective, "qHyperCubeDef");
      if (fullCube !== undefined)
        metadata.qHyperCubeSha256 = await definitionSha256(record(fullCube));
      const master = own(properties, "qExtendsId");
      if (master !== undefined && metadata.qExtendsId === undefined)
        metadata.qExtendsId = string(master);
      objects.push({
        id: objectId,
        role,
        type: string(own(own(effective, "qInfo"), "qType"), 256),
        ...metadata,
      });
      read.add(objectId);
      if (objectId === CONTAINER) containerStructure = await containerReferences(effective);
    }
    const candidates = [CONTAINER, PRODUCTS];
    // Fixed candidates first; only a proved matching tab may add one Engine ID.
    for (let pass = 0; pass < candidates.length; pass++) {
      for (const objectId of candidates) {
        if (read.has(objectId) || !reachable(SHEET, objectId)) continue;
        await inspectCandidate(
          objectId,
          objectId === PRODUCTS ? "products_candidate" : "container_candidate",
        );
      }
    }
    if (partnerId && !partnerAmbiguous && reachable(CONTAINER, partnerId)) {
      await inspectCandidate(partnerId, "partners_tab_candidate");
    }

    // Plan the entire typed allowlist before any library request. No recursive master lookup.
    const masterPlan = new Map();
    for (const object of objects) {
      if (!["products_candidate", "partners_tab_candidate"].includes(object.role)) continue;
      for (const [type, field] of [
        ["dimension", "qDimensions"],
        ["measure", "qMeasures"],
      ]) {
        for (const [index, definition] of (object.qHyperCubeDef?.[field] ?? []).entries()) {
          if (definition.qLibraryId === undefined || definition.qLibraryId === "") continue;
          const libraryId = id(definition.qLibraryId);
          const key = `${type}:${libraryId}`;
          if (!masterPlan.has(key)) {
            if (masterPlan.size >= MAX_MASTER_DEFINITIONS) fail("qix_metadata_limit");
            masterPlan.set(key, { id: libraryId, type, referencedBy: [] });
          }
          masterPlan.get(key).referencedBy.push({ objectId: object.id, index });
        }
      }
    }
    const extraReasons = [];
    const namedPlan = new Map();
    const inspectAliases = objects.some(
      (object) => object.id !== CONTAINER && object.qHyperCubeDef,
    );
    const fieldCatalog = [];
    const fieldNames = new Set();
    const sourceFields = new Set();
    function sourceField(value) {
      if (typeof value !== "string") return;
      // Only literal field references, never expression expansion or evaluation.
      const match = /^=?\s*\[([^\[\]]+)\]\s*$/.exec(value);
      sourceFields.add(match ? match[1] : value);
    }
    for (const object of objects)
      if (["products_candidate", "partners_tab_candidate"].includes(object.role))
        for (const definition of object.qHyperCubeDef?.qDimensions ?? [])
          for (const field of definition.qDef?.qFieldDefs ?? []) sourceField(field);
    let catalogFields;
    let scannedFields = 0;
    function catalogField(item) {
      if (++scannedFields > MAX_CATALOG_ITEMS) fail("qix_metadata_limit");
      const name = own(item, "qName");
      if (typeof name !== "string") fail("qix_invalid_metadata");
      if (name.length > 256) fail("qix_metadata_limit");
      if (
        name.startsWith("=") ||
        !(
          /imob|empreend|produto/i.test(name) ||
          name === "DT" ||
          name.startsWith("DT.Cal.") ||
          /^(Empresa|Regional)\s*\(Filtro\)$/.test(name) ||
          name.startsWith("DS_Canal") ||
          ALIASES.includes(name) ||
          sourceFields.has(name)
        )
      )
        return;
      if (!name || /[\p{Cc}\p{Cs}]/u.test(name) || fieldNames.has(name))
        fail("qix_invalid_metadata");
      if (fieldCatalog.length >= MAX_CATALOG_FIELDS) fail("qix_metadata_limit");
      fieldNames.add(name);
      fieldCatalog.push({
        name: string(name, 256),
        tags: array(own(item, "qTags") ?? [], 32).map((tag) => string(tag, 256)),
      });
    }
    if (typeof doc.destroySessionObject !== "function") fail("qix_invalid_sdk");
    const catalogId = `ranking-metadata-catalog-${crypto.randomUUID()}`;
    try {
      const catalog = await call(doc, "createSessionObject", {
        qInfo: { qId: catalogId, qType: "MeasureList" },
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
      const layout = await call(catalog, "getLayout");
      identity(layout, catalogId);
      if (own(own(layout, "qInfo"), "qType") !== "MeasureList") fail("qix_scope_mismatch");
      for (const item of array(own(own(layout, "qMeasureList"), "qItems"), MAX_CATALOG_ITEMS)) {
        const data = own(item, "qData");
        const title = own(data, "title");
        const label = own(data, "label");
        for (const value of [title, label])
          if (typeof value === "string" && value.length > 256) fail("qix_metadata_limit");
        const aliases = ALIASES.filter((alias) => alias === title || alias === label);
        if (!inspectAliases || !aliases.length) continue;
        const info = own(item, "qInfo");
        const measureId = id(own(info, "qId"));
        if (own(info, "qType") !== "measure" || namedPlan.has(measureId))
          fail("qix_invalid_metadata");
        const referencedByAlias = [];
        for (const object of objects) {
          if (!["products_candidate", "partners_tab_candidate"].includes(object.role)) continue;
          for (const [index, definition] of (object.qHyperCubeDef?.qMeasures ?? []).entries()) {
            for (const alias of aliases)
              if ([alias, `=${alias}`].includes(definition.qDef?.qDef?.trim()))
                referencedByAlias.push({ objectId: object.id, index, alias });
          }
        }
        namedPlan.set(measureId, {
          id: measureId,
          ...(typeof title === "string" ? { title: string(title, 256) } : {}),
          ...(typeof label === "string" ? { label: string(label, 256) } : {}),
          aliases,
          referencedByAlias,
        });
        const all = new Set([
          ...masterPlan.keys(),
          ...[...namedPlan.keys()].map((id) => `measure:${id}`),
        ]);
        if (all.size > MAX_MASTER_DEFINITIONS) fail("qix_metadata_limit");
      }
      catalogFields = array(own(own(layout, "qFieldList"), "qItems"), MAX_CATALOG_ITEMS);
    } finally {
      // Cleanup must still run after abort, and never destroy a source object.
      try {
        if ((await doc.destroySessionObject(catalogId)) !== true) fail("qix_cleanup_failed");
      } catch {
        fail("qix_cleanup_failed");
      }
    }
    checkAbort();

    // Full properties remain private; no unrelated measure definitions are requested.
    const masterDefinitions = [];
    const masterProperties = new Map();
    for (const reference of masterPlan.values()) {
      const isDimension = reference.type === "dimension";
      const model = await call(doc, isDimension ? "getDimension" : "getMeasure", reference.id);
      const properties = await call(model, "getProperties");
      identity(properties, reference.id);
      if (own(own(properties, "qInfo"), "qType") !== reference.type) fail("qix_scope_mismatch");
      const field = isDimension ? "qDim" : "qMeasure";
      const schema = isDimension
        ? { ...dimension.qDef, qLabelExpression: "string", qAlias: "string" }
        : { ...measure.qDef, qExpressions: ["string", 32], qActiveExpression: "int32" };
      const original = record(own(properties, field));
      const definition = project(original, schema);
      if (Object.keys(definition).length === 0) fail("qix_invalid_metadata");
      const hash = await definitionSha256(original);
      masterDefinitions.push({ ...reference, [field]: definition, definitionSha256: hash });
      masterProperties.set(`${reference.type}:${reference.id}`, properties);
      if (isDimension) for (const field of definition.qFieldDefs ?? []) sourceField(field);
    }
    for (const item of catalogFields) {
      catalogField(item);
      const derived = own(item, "qDerivedFieldData");
      if (derived === undefined || derived === null) continue;
      for (const group of array(own(derived, "qDerivedFieldLists"), 64))
        for (const field of array(own(group, "qFieldDefs"), MAX_CATALOG_ITEMS)) catalogField(field);
    }
    fieldCatalog.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const matchingMasterMeasures = [];
    for (const reference of namedPlan.values()) {
      let properties = masterProperties.get(`measure:${reference.id}`);
      if (!properties) {
        const model = await call(doc, "getMeasure", reference.id);
        properties = await call(model, "getProperties");
      }
      identity(properties, reference.id);
      const original = record(own(properties, "qMeasure"));
      if (
        own(own(properties, "qInfo"), "qType") !== "measure" ||
        (reference.title !== undefined &&
          own(own(properties, "qMetaDef"), "title") !== reference.title) ||
        (reference.label !== undefined && own(original, "qLabel") !== reference.label)
      )
        fail("qix_scope_mismatch");
      matchingMasterMeasures.push({
        id: reference.id,
        ...(reference.title === undefined ? {} : { title: reference.title }),
        referencedByAlias: reference.referencedByAlias,
        qMeasure: project(original, {
          ...measure.qDef,
          qExpressions: ["string", 32],
          qActiveExpression: "int32",
        }),
        definitionSha256: await definitionSha256(original),
        // Full properties add an envelope around the independently bounded definition.
        propertiesSha256: await definitionSha256(properties, 524_288, 34),
      });
    }
    const variableDefinitions = [];
    for (const name of inspectAliases ? ALIASES : []) {
      let properties;
      try {
        const model = await call(doc, "getVariableByName", name);
        properties = await call(model, "getProperties");
      } catch (error) {
        if (!(error instanceof MetadataError) || error.code !== "qix_request_failed") throw error;
        extraReasons.push(`variable_${name}_unresolved`);
        continue;
      }
      const variableId = identity(properties);
      if (
        own(properties, "qName") !== name ||
        !["variable", "Variable"].includes(own(own(properties, "qInfo"), "qType"))
      )
        fail("qix_scope_mismatch");
      const definition = own(properties, "qDefinition");
      if (typeof definition !== "string" || !definition) {
        extraReasons.push(`variable_${name}_unresolved`);
        continue;
      }
      variableDefinitions.push({
        name,
        id: variableId,
        qDefinition: string(definition),
        propertiesSha256: await definitionSha256(properties, 524_288, 34),
      });
    }
    for (const title of inspectAliases ? ALIASES : []) {
      const count = [...namedPlan.values()].filter((item) => item.aliases.includes(title)).length;
      if (count !== 1)
        extraReasons.push(
          count ? `named_measure_${title}_ambiguous` : `named_measure_${title}_unresolved`,
        );
    }

    const layout = await call(doc, "getAppLayout");
    const reload = own(layout, "qLastReloadTime");
    let sourceReloadTime = null;
    if (reload !== undefined && reload !== null && reload !== "") {
      if (
        typeof reload !== "string" ||
        reload.length > 64 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(reload) ||
        !Number.isFinite(Date.parse(reload))
      )
        fail("qix_invalid_reload_time");
      sourceReloadTime = reload;
    }
    const reasons = [...extraReasons];
    if (!read.has(PRODUCTS)) reasons.push("products_membership_unproven");
    if (!read.has(CONTAINER)) reasons.push("container_membership_unproven");
    if (!partnerId || !read.has(partnerId))
      reasons.push(
        partnerAmbiguous ? "partners_reference_ambiguous" : "partners_membership_unproven",
      );
    for (const object of objects) {
      if (object.id !== CONTAINER && !object.qHyperCubeDef)
        reasons.push(`${object.role}_cube_unresolved`);
    }
    if (sourceReloadTime === null) reasons.push("reload_time_unavailable");
    checkAbort();
    const result = {
      status: reasons.length ? "pending" : "inspected",
      appId: APP,
      sheetId: SHEET,
      sourceReloadTime,
      productionMappingVerified: false,
      dependencyClosureVerified: false,
      selectionsVerified: false,
      dataRead: false,
      reasons,
      objects,
      masterDefinitions,
      matchingMasterMeasures,
      variableDefinitions,
      fieldCatalog,
      containerStructure,
    };
    const encoder = new TextEncoder();
    if (encoder.encode(JSON.stringify(result)).length > 262_144) fail("qix_metadata_limit");
    // The private artifact writer and owner preflight impose a tighter envelope cap.
    const artifact = {
      schemaVersion: 1,
      kind: "qlik_metadata_preflight",
      observedAt: "2000-01-01T00:00:00.000Z",
      rankingConnected: false,
      result,
    };
    if (encoder.encode(JSON.stringify(artifact)).length > 131_072) fail("qix_metadata_limit");
    return result;
  } catch (error) {
    if (error instanceof MetadataError) throw error;
    // Never propagate SDK messages, error data, payloads, tokens or causes.
    throw new MetadataError("qix_metadata_failed");
  }
}
