/**
 * Metadata only. The caller owns authenticated tenant binding, transport and deadline.
 * Keep all bindings inside: the owner serializes this function into its browser context.
 * Enigma unwraps qPropEntry/qProp/qLayout; no JSON-RPC envelopes are accepted here.
 */
export async function inspectQlikRankingMetadata(global, options = {}) {
  const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
  const SHEET = "772db774-0bc2-42d8-ac11-3e4917bd0d37";
  const PRODUCTS = "17f54180-e9f8-44d4-8a58-d055cff3e94c";
  const CONTAINER = "e039b893-0d96-444c-9773-aba1383f8d94";
  // UI tab identity is NOT an Engine object ID.
  const PARTNERS_TAB = "pUYysrvJ";
  const MAX_DEPTH = 8;
  const MAX_NODES = 128;
  const MAX_REFS = 512;
  const MAX_MASTER_DEFINITIONS = 64;
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
      if (parent) edge(parent, objectId);
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
    function containerReferences(properties) {
      const structure = { arrays: {}, references: [] };
      const targets = new Set();
      let unresolvedMatch = false;
      for (const key of ["children", "cells"]) {
        const items = own(properties, key);
        structure.arrays[key] = {
          kind: Array.isArray(items) ? "array" : items === undefined ? "missing" : "unknown",
          count: Array.isArray(items) ? items.length : null,
        };
        if (!Array.isArray(items)) continue;
        for (const item of array(items, 64)) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const reference = { source: key };
          for (const field of ["cId", "refId", "chartId"]) {
            const value = own(item, field);
            if (typeof value === "string" && value) reference[field] = id(value);
          }
          const matchesTab = reference.cId === PARTNERS_TAB;
          const matchesLabel = own(item, "label") === "Parceiras";
          reference.matchesPartners = matchesTab || matchesLabel;
          if (matchesLabel) reference.label = "Parceiras";
          structure.references.push(reference);
          if (!reference.matchesPartners) continue;
          if (reference.refId && reference.chartId && reference.refId !== reference.chartId) {
            partnerAmbiguous = true;
          }
          const target = reference.refId ?? reference.chartId;
          if (target) targets.add(target);
          else unresolvedMatch = true;
        }
      }
      if (targets.size > 1 || (targets.size === 1 && unresolvedMatch)) partnerAmbiguous = true;
      if (!partnerAmbiguous && targets.size === 1) {
        const target = [...targets][0];
        if ([SHEET, PRODUCTS, CONTAINER].includes(target)) partnerAmbiguous = true;
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
      if (objectId === CONTAINER) containerStructure = containerReferences(effective);
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
    // Additive output: {id,type,referencedBy:[{objectId,index}],qDim|qMeasure}.
    const masterDefinitions = [];
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
      const definition = project(record(own(properties, field)), schema);
      if (Object.keys(definition).length === 0) fail("qix_invalid_metadata");
      masterDefinitions.push({ ...reference, [field]: definition });
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
    const reasons = [];
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
    return {
      status: reasons.length ? "pending" : "inspected",
      appId: APP,
      sheetId: SHEET,
      sourceReloadTime,
      productionMappingVerified: false,
      selectionsVerified: false,
      dataRead: false,
      reasons,
      objects,
      masterDefinitions,
      containerStructure,
    };
  } catch (error) {
    if (error instanceof MetadataError) throw error;
    // Never propagate SDK messages, error data, payloads, tokens or causes.
    throw new MetadataError("qix_metadata_failed");
  }
}
