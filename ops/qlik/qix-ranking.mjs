/**
 * Standalone browser collector. No imports or bindings outside this function.
 * Mapping authority is external: verified=true is required, not an attestation.
 * Hashes: SHA-256 of UTF-8 JSON, recursively sorted object keys, array order retained.
 * cubeSha256 pins qHyperCubeDef; master pins hash qDim / qMeasure, not just library IDs.
 * aliasPins bind only fixed master names and hash their complete GetProperties response.
 */
export async function collectQlikRanking(global, { mapping, signal } = {}) {
  const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
  const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
  const CALENDAR = "=Year([DT])&Num(Month([DT]),'00')";
  const SCOPE = { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" };
  const MAX_ROWS = 5000;
  const temporary = [];
  let doc;
  let result;
  class Failure extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }
  const fail = (code) => {
    throw new Failure(code);
  };
  const check = (condition, code = "invalid_source") => {
    if (!condition) fail(code);
  };
  const aborted = () => {
    if (signal?.aborted) fail("cancelled");
  };
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value, max = 256) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    !/[\p{Cc}\p{Cs}]/u.test(value);
  const sha = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  // Normalize recognition only; native expressions and their hashes remain byte-exact.
  const directAlias = (value) => {
    if (typeof value !== "string") return;
    let name = value.trim();
    if (name.startsWith("=")) name = name.slice(1).trim();
    if (name.startsWith("[") && name.endsWith("]")) {
      name = name.slice(1, -1);
      // Quoted-name whitespace must not silently become a different master name.
      check(name === name.trim() || !["VENDAS", "VGV"].includes(name.trim()), "measure_unresolved");
    }
    return ["VENDAS", "VGV"].find((alias) => name === alias);
  };
  const equal = (a, b) => canonical(a) === canonical(b);
  function canonical(value, depth = 0) {
    check(depth <= 32, "definition_limit");
    if (value === null || typeof value === "string" || typeof value === "boolean")
      return JSON.stringify(value);
    if (typeof value === "number") {
      check(Number.isFinite(value));
      return JSON.stringify(value);
    }
    check(typeof value === "object" && value !== null);
    if (Array.isArray(value))
      return `[${value.map((item) => canonical(item, depth + 1)).join(",")}]`;
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        const property = Object.getOwnPropertyDescriptor(value, key);
        check(property && "value" in property);
        return `${JSON.stringify(key)}:${canonical(property.value, depth + 1)}`;
      })
      .join(",")}}`;
  }
  async function digest(value) {
    const bytes = new TextEncoder().encode(canonical(value));
    check(bytes.length <= 262144, "definition_limit");
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    aborted();
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function call(model, method, ...args) {
    aborted();
    check(typeof model?.[method] === "function", "invalid_sdk");
    const value = await model[method](...args);
    aborted();
    return value;
  }
  function noError(value) {
    check(record(value));
    check(!value.qError?.qErrorCode && !value.qCalcCondMsg, "calculation_failed");
  }
  function dimension(definition) {
    check(record(definition) && record(definition.qDef));
    check(Array.isArray(definition.qDef.qFieldDefs) && definition.qDef.qFieldDefs.length === 1);
    check(text(definition.qDef.qFieldDefs[0], 4096));
    check(!definition.qDef.qGrouping || definition.qDef.qGrouping === "N", "unsupported_group");
    check(
      !definition.qOtherTotalSpec?.qOtherMode ||
        definition.qOtherTotalSpec.qOtherMode === "OTHER_OFF",
      "limited_cube",
    );
  }
  function money(cell) {
    check(
      record(cell) &&
        !cell.qIsNull &&
        !cell.qIsOtherCell &&
        ![-2, -3, -4].includes(cell.qElemNumber),
      "invalid_number",
    );
    const value = cell.qNum;
    check(typeof value === "number" && Number.isFinite(value) && value >= 0, "invalid_number");
    const scaled = value * 100;
    const integer = Math.round(scaled);
    // Allow only floating-point representation noise, never monetary rounding.
    const tolerance = 4 * Number.EPSILON * Math.abs(scaled);
    check(
      Number.isSafeInteger(integer) && tolerance < 0.01 && Math.abs(scaled - integer) <= tolerance,
      "unsafe_cents",
    );
    return BigInt(integer);
  }
  function count(cell) {
    check(
      record(cell) &&
        !cell.qIsNull &&
        !cell.qIsOtherCell &&
        ![-2, -3, -4].includes(cell.qElemNumber),
      "invalid_number",
    );
    check(
      Number.isSafeInteger(cell.qNum) && cell.qNum >= 0 && cell.qNum <= 1_000_000_000,
      "invalid_count",
    );
    return BigInt(cell.qNum);
  }
  function label(cell) {
    check(
      record(cell) &&
        !cell.qIsNull &&
        !cell.qIsOtherCell &&
        Number.isInteger(cell.qElemNumber) &&
        cell.qElemNumber >= 0,
      "invalid_dimension",
    );
    check(
      text(cell.qText) && !cell.qText.startsWith(" ") && !cell.qText.endsWith(" "),
      "invalid_dimension",
    );
    return cell.qText;
  }
  const decimal = (value) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  const zero = () => ({ vgv: 0n, contracts: 0n });
  const add = (a, b) => {
    a.vgv += b.vgv;
    a.contracts += b.contracts;
    return a;
  };
  const totalsEqual = (a, b) =>
    check(a.vgv === b.vgv && a.contracts === b.contracts, "totals_mismatch");
  function publicTotals(value) {
    check(value.contracts <= 1_000_000_000n && value.vgv <= 999999999999999999n, "aggregate_limit");
    return { vgv: decimal(value.vgv), contracts: Number(value.contracts) };
  }
  function keyOf(cell, encoding) {
    const raw = label(cell);
    const key =
      encoding === "plain"
        ? raw
        : `id-${Array.from(new TextEncoder().encode(raw), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    check(key.length <= 128 && /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(key), "invalid_identity");
    return key;
  }
  async function create(properties) {
    const id = `ranking-${crypto.randomUUID()}`;
    temporary.push(id);
    return await call(doc, "createSessionObject", {
      ...properties,
      qInfo: { qId: id, qType: "ranking-session" },
    });
  }
  async function reload() {
    const layout = await call(doc, "getAppLayout");
    const value = layout?.qLastReloadTime;
    check(
      typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
        Number.isFinite(Date.parse(value)),
      "reload_unavailable",
    );
    check(Date.parse(value) <= Date.now(), "reload_unavailable");
    return value;
  }
  function aliasCandidates(layout, id, pins) {
    noError(layout);
    check(layout.qInfo?.qId === id && layout.qInfo.qType === "MeasureList", "object_mismatch");
    const list = layout.qMeasureList;
    noError(list);
    check(!Object.hasOwn(list, "qIsReduced") || list.qIsReduced === false, "reduced_page");
    check(Array.isArray(list.qItems) && list.qItems.length <= 4096, "coverage_limit");
    const ids = new Set();
    for (const item of list.qItems) {
      check(
        record(item) &&
          text(item.qInfo?.qId) &&
          item.qInfo.qType === "measure" &&
          !ids.has(item.qInfo.qId) &&
          (item.qData == null || record(item.qData)),
        "master_catalog_item",
      );
      ids.add(item.qInfo.qId);
      const data = item.qData ?? {};
      const related = pins.some((pin) => data.title === pin.alias || data.label === pin.alias);
      for (const key of ["title", "label"]) {
        const value = data[key];
        // Optional projections of unrelated masters are not ranking labels or definitions.
        check(
          value == null || value === "" || (related ? text(value) : typeof value === "string"),
          "master_catalog_text",
        );
      }
    }
    return pins.map((pin) => {
      const matches = list.qItems.filter(
        (item) => item.qData?.title === pin.alias || item.qData?.label === pin.alias,
      );
      check(matches.length === 1 && matches[0].qInfo.qId === pin.id, "master_catalog_binding");
      return {
        id: pin.id,
        title: matches[0].qData.title ?? "",
        label: matches[0].qData.label ?? null,
      };
    });
  }
  async function pinnedAliases(config, cube) {
    const pins = config.aliasPins;
    const selected = [config.vgvMeasureIndex, config.contractsMeasureIndex];
    const required = selected.filter(
      (index) => !cube.qMeasures[index].qLibraryId && directAlias(cube.qMeasures[index].qDef?.qDef),
    );
    check(required.length === pins.length, "master_pin_mismatch");
    for (const pin of pins) {
      const measure = cube.qMeasures[pin.measureIndex];
      check(
        !measure.qLibraryId && directAlias(measure.qDef?.qDef) === pin.alias,
        "master_pin_mismatch",
      );
    }
    const definitions = new Map();
    if (!pins.length) return definitions;
    const id = `ranking-${crypto.randomUUID()}`;
    temporary.push(id);
    try {
      const catalog = await call(doc, "createSessionObject", {
        qInfo: { qId: id, qType: "MeasureList" },
        qMeasureListDef: {
          qType: "measure",
          qData: { title: "/qMetaDef/title", label: "/qMeasure/qLabel" },
        },
      });
      const before = aliasCandidates(await call(catalog, "getLayout"), id, pins);
      for (const [index, pin] of pins.entries()) {
        const model = await call(doc, "getMeasure", pin.id);
        const properties = await call(model, "getProperties");
        // Only the approved native title binds a name; display labels detect collisions only.
        check(
          record(properties) &&
            properties.qInfo?.qId === pin.id &&
            properties.qInfo.qType === "measure" &&
            properties.qMetaDef?.title === pin.alias &&
            properties.qMetaDef.title === before[index].title &&
            (before[index].label === null ||
              (properties.qMeasure?.qLabel ?? "") === before[index].label),
          "master_alias_identity",
        );
        check((await digest(properties)) === pin.propertiesSha256, "master_changed");
        definitions.set(pin.measureIndex, { id: pin.id, definition: properties.qMeasure });
      }
      check(
        equal(before, aliasCandidates(await call(catalog, "getLayout"), id, pins)),
        "master_changed",
      );
    } finally {
      // Cleanup is owned even after abort; only confirmed disposal removes the retry entry.
      try {
        check((await doc.destroySessionObject(id)) === true, "cleanup_failed");
      } catch {
        fail("cleanup_failed");
      }
      temporary.splice(temporary.indexOf(id), 1);
    }
    aborted();
    return definitions;
  }
  async function pinned(config) {
    const model = await call(doc, "getObject", config.objectId);
    const properties = await call(model, "getEffectiveProperties");
    check(properties?.qInfo?.qId === config.objectId, "object_mismatch");
    check(!properties.qStateName || properties.qStateName === "$", "state_mismatch");
    const cube = properties.qHyperCubeDef;
    check(record(cube) && (await digest(cube)) === config.cubeSha256, "definition_changed");
    check(
      (!cube.qStateName || cube.qStateName === "$") && (!cube.qMode || cube.qMode === "S"),
      "state_mismatch",
    );
    // Native missing suppression is safe only after unsuppressed ID/name/totals reconciliation.
    check(
      !cube.qSuppressZero &&
        (!Object.hasOwn(cube, "qSuppressMissing") || typeof cube.qSuppressMissing === "boolean") &&
        (!cube.qReductionMode || cube.qReductionMode === "N"),
      "limited_cube",
    );
    check(
      Array.isArray(cube.qDimensions) &&
        cube.qDimensions.length === 1 &&
        Array.isArray(cube.qMeasures) &&
        cube.qMeasures.length >= 2 &&
        cube.qMeasures.length <= 32,
    );
    check(
      config.vgvMeasureIndex < cube.qMeasures.length &&
        config.contractsMeasureIndex < cube.qMeasures.length,
      "mapping_invalid",
    );
    const references = new Map();
    for (const [kind, definitions] of [
      ["dimension", cube.qDimensions],
      ["measure", cube.qMeasures],
    ]) {
      for (const definition of definitions) {
        check(record(definition));
        if (definition.qLibraryId)
          references.set(`${kind}:${definition.qLibraryId}`, { kind, id: definition.qLibraryId });
      }
    }
    check(references.size === config.masterPins.length, "master_pin_mismatch");
    const masters = new Map();
    for (const pin of config.masterPins) {
      check(
        references.has(`${pin.kind}:${pin.id}`) && !masters.has(`${pin.kind}:${pin.id}`),
        "master_pin_mismatch",
      );
      const master = await call(
        doc,
        pin.kind === "dimension" ? "getDimension" : "getMeasure",
        pin.id,
      );
      const properties = await call(master, "getProperties");
      check(
        properties?.qInfo?.qId === pin.id && properties.qInfo.qType === pin.kind,
        "master_pin_mismatch",
      );
      const definition = properties[pin.kind === "dimension" ? "qDim" : "qMeasure"];
      check(record(definition) && (await digest(definition)) === pin.sha256, "master_changed");
      masters.set(`${pin.kind}:${pin.id}`, definition);
    }
    const resolved = (definition, kind) =>
      definition.qLibraryId ? masters.get(`${kind}:${definition.qLibraryId}`) : definition.qDef;
    const aliases = await pinnedAliases(config, cube);
    const name = {
      ...cube.qDimensions[0],
      qLibraryId: "",
      qDef: resolved(cube.qDimensions[0], "dimension"),
    };
    dimension(name);
    const measures = [config.vgvMeasureIndex, config.contractsMeasureIndex].map((index) => {
      const alias = aliases.get(index);
      const definition = alias ? alias.definition : resolved(cube.qMeasures[index], "measure");
      check(record(definition) && text(definition.qDef, 16384), "measure_unresolved");
      check(!directAlias(definition.qDef), "measure_unresolved");
      check(
        !definition.qRelative &&
          !definition.qAccumulate &&
          (!definition.qGrouping || definition.qGrouping === "N"),
        "non_additive_measure",
      );
      return alias ? { qLibraryId: alias.id } : { qDef: definition };
    });
    return { model, cube, name, measures };
  }
  async function pages(model, method, path, size, columns) {
    check(
      Number.isInteger(size?.qcx) &&
        Number.isInteger(size?.qcy) &&
        size.qcy >= 0 &&
        size.qcy <= MAX_ROWS &&
        columns.every((column) => column >= 0 && column < size.qcx),
      "coverage_limit",
    );
    const rows = [];
    const height = Math.floor(10000 / columns.length);
    for (let top = 0; top < size.qcy; top += height) {
      const requested = columns.map((left) => ({
        qLeft: left,
        qTop: top,
        qWidth: 1,
        qHeight: Math.min(height, size.qcy - top),
      }));
      const received = await call(model, method, path, requested);
      check(Array.isArray(received) && received.length === requested.length, "incomplete_page");
      const ordered = requested.map((area) => {
        const matches = received.filter((page) => equal(page.qArea, area));
        check(matches.length === 1, "incomplete_page");
        const page = matches[0];
        check(!Object.hasOwn(page, "qIsReduced") || page.qIsReduced === false, "reduced_page");
        const tails = page.qTails;
        // QIX can report explicit zero tails even when the requested page is complete.
        check(
          tails == null ||
            (Array.isArray(tails) &&
              tails.length <= size.qcx &&
              tails.every((tail) => record(tail) && tail.qUp === 0 && tail.qDown === 0)),
          "incomplete_page",
        );
        check(
          Array.isArray(page.qMatrix) &&
            page.qMatrix.length === area.qHeight &&
            page.qMatrix.every((row) => Array.isArray(row) && row.length === 1),
          "incomplete_page",
        );
        return page.qMatrix;
      });
      for (let row = 0; row < requested[0].qHeight; row++)
        rows.push(ordered.map((column) => column[row][0]));
    }
    return rows;
  }
  async function list(model) {
    const before = (await call(model, "getLayout"))?.qListObject;
    noError(before);
    check(before.qStateName === "$" && before.qSize?.qcx === 1, "state_mismatch");
    noError(before.qDimensionInfo);
    const rows = await pages(model, "getListObjectData", "/qListObjectDef", before.qSize, [0]);
    const after = (await call(model, "getLayout"))?.qListObject;
    noError(after);
    check(
      after.qStateName === "$" &&
        equal(before.qSize, after.qSize) &&
        equal(before.qDimensionInfo, after.qDimensionInfo),
      "selection_changed",
    );
    const elements = new Set();
    const names = new Set();
    for (const [cell] of rows) {
      const name = label(cell);
      check(!elements.has(cell.qElemNumber) && !names.has(name), "ambiguous_selection");
      check(["O", "S", "A", "X", "D"].includes(cell.qState), "locked_or_excluded_selection");
      elements.add(cell.qElemNumber);
      names.add(name);
    }
    const counts = before.qDimensionInfo.qStateCounts;
    check(
      record(counts) &&
        counts.qSelected === rows.filter(([cell]) => cell.qState === "S").length &&
        !counts.qLocked &&
        !counts.qLockedExcluded &&
        !counts.qSelectedExcluded,
      "selection_changed",
    );
    return rows.map(([cell]) => cell);
  }
  function cubeLayout(layout, dimensionCount, measureCount) {
    const cube = layout?.qHyperCube;
    noError(cube);
    check(!cube.qHasOtherValues, "limited_cube");
    check(
      cube.qMode === "S" &&
        cube.qStateName === "$" &&
        cube.qSize?.qcx === dimensionCount + measureCount,
      "cube_shape",
    );
    check(
      Array.isArray(cube.qDimensionInfo) &&
        cube.qDimensionInfo.length === dimensionCount &&
        Array.isArray(cube.qMeasureInfo) &&
        cube.qMeasureInfo.length === measureCount,
      "cube_shape",
    );
    cube.qDimensionInfo.forEach(noError);
    cube.qMeasureInfo.forEach(noError);
    check(
      Array.isArray(cube.qGrandTotalRow) && cube.qGrandTotalRow.length === measureCount,
      "totals_missing",
    );
    return cube;
  }
  async function readCube(model, dimensions, measures, columns, totalIndices) {
    const before = cubeLayout(await call(model, "getLayout"), dimensions, measures);
    const rows = await pages(model, "getHyperCubeData", "/qHyperCubeDef", before.qSize, columns);
    const after = cubeLayout(await call(model, "getLayout"), dimensions, measures);
    for (const field of ["qSize", "qGrandTotalRow", "qDimensionInfo", "qMeasureInfo"])
      check(equal(before[field], after[field]), "cube_changed");
    check(
      equal(
        before.qEffectiveInterColumnSortOrder ?? null,
        after.qEffectiveInterColumnSortOrder ?? null,
      ),
      "cube_changed",
    );
    return {
      rows,
      totals: {
        vgv: money(before.qGrandTotalRow[totalIndices[0]]),
        contracts: count(before.qGrandTotalRow[totalIndices[1]]),
      },
    };
  }
  try {
    mapping = JSON.parse(canonical(mapping));
    check(
      record(mapping) &&
        mapping.schemaVersion === 1 &&
        mapping.verified === true &&
        mapping.appId === APP &&
        mapping.sheetId === SHEET &&
        sha(mapping.mappingSha256) &&
        mapping.numericPolicy === "safe-cent-v1",
      "mapping_invalid",
    );
    check(signal && typeof signal.aborted === "boolean", "mapping_invalid");
    check(
      Array.isArray(mapping.periods) && mapping.periods.length >= 1 && mapping.periods.length <= 12,
      "mapping_invalid",
    );
    const year = mapping.periods[0]?.slice(0, 4);
    check(/^(20[2-9][0-9]|2100)$/.test(year), "mapping_invalid");
    mapping.periods.forEach((period, index) =>
      check(period === `${year}-${String(index + 1).padStart(2, "0")}-01`, "mapping_invalid"),
    );
    check(
      Array.isArray(mapping.filters) &&
        mapping.filters.length === 3 &&
        new Set(mapping.filters.map((item) => item.field)).size === 3 &&
        equal(mapping.filters.map((item) => item.value).sort(), Object.values(SCOPE).sort()) &&
        mapping.filters.every((item) => text(item.field) && !item.field.startsWith("=")),
      "mapping_invalid",
    );
    check(
      mapping.calendar?.expression === CALENDAR &&
        Array.isArray(mapping.calendar.selectionFields) &&
        mapping.calendar.selectionFields.length >= 1 &&
        mapping.calendar.selectionFields.length <= 2 &&
        new Set(mapping.calendar.selectionFields).size ===
          mapping.calendar.selectionFields.length &&
        mapping.calendar.selectionFields.every(
          (field) => text(field) && !mapping.filters.some((item) => item.field === field),
        ),
      "mapping_invalid",
    );
    check(
      record(mapping.cubes) &&
        mapping.cubes.imobs?.objectId !== mapping.cubes.developments?.objectId,
      "mapping_invalid",
    );
    for (const role of ["imobs", "developments"]) {
      const config = mapping.cubes[role];
      check(
        record(config) &&
          text(config.objectId) &&
          config.objectId !== SHEET &&
          sha(config.cubeSha256) &&
          text(config.idField) &&
          !config.idField.startsWith("=") &&
          ["plain", "utf8-hex"].includes(config.idEncoding),
        "mapping_invalid",
      );
      check(
        [config.vgvMeasureIndex, config.contractsMeasureIndex].every(
          (index) => Number.isInteger(index) && index >= 0 && index < 32,
        ) && config.vgvMeasureIndex !== config.contractsMeasureIndex,
        "mapping_invalid",
      );
      check(
        Array.isArray(config.masterPins) &&
          config.masterPins.length <= 33 &&
          config.masterPins.every(
            (pin) => ["dimension", "measure"].includes(pin.kind) && text(pin.id) && sha(pin.sha256),
          ),
        "mapping_invalid",
      );
      if (!Object.hasOwn(config, "aliasPins")) config.aliasPins = [];
      check(Array.isArray(config.aliasPins) && config.aliasPins.length <= 2, "mapping_invalid");
      for (const pin of config.aliasPins) {
        check(
          record(pin) &&
            equal(Object.keys(pin).sort(), ["alias", "id", "measureIndex", "propertiesSha256"]) &&
            ["VENDAS", "VGV"].includes(pin.alias) &&
            pin.measureIndex ===
              (pin.alias === "VENDAS" ? config.contractsMeasureIndex : config.vgvMeasureIndex) &&
            text(pin.id) &&
            !/[\u0000-\u0020\u007f]/u.test(pin.id) &&
            sha(pin.propertiesSha256),
          "mapping_invalid",
        );
      }
      for (const key of ["alias", "measureIndex", "id"])
        check(
          new Set(config.aliasPins.map((pin) => pin[key])).size === config.aliasPins.length,
          "mapping_invalid",
        );
    }
    aborted();
    doc = await call(global, "openDoc", APP);
    const initialReload = await reload();
    const selection = await create({ qSelectionObjectDef: { qStateName: "$" } });
    const lists = [];
    for (const field of [...mapping.filters.map((item) => item.field), CALENDAR]) {
      lists.push(
        await create({
          qListObjectDef: {
            qStateName: "$",
            qDef: { qFieldDefs: [field] },
            qShowAlternatives: true,
          },
        }),
      );
    }
    const sources = {};
    for (const role of ["imobs", "developments"]) {
      const config = mapping.cubes[role];
      const native = await pinned(config);
      const idCube = await create({
        qHyperCubeDef: {
          qStateName: "$",
          qMode: "S",
          qSuppressZero: false,
          qSuppressMissing: false,
          ...(native.cube.qContextSetExpression === undefined
            ? {}
            : { qContextSetExpression: native.cube.qContextSetExpression }),
          qDimensions: [
            {
              qDef: { qFieldDefs: [config.idField], qGrouping: "N" },
              qNullSuppression: false,
              qOtherTotalSpec: { qOtherMode: "OTHER_OFF" },
            },
            {
              ...native.name,
              qNullSuppression: false,
              qOtherTotalSpec: { qOtherMode: "OTHER_OFF" },
            },
          ],
          qMeasures: native.measures,
          qInterColumnSortOrder: [0, 1, 2, 3],
        },
      });
      sources[role] = { ...native, idCube };
    }
    async function selectedFields(empty = false) {
      const layout = await call(selection, "getLayout");
      check(layout?.qSelectionObject?.qStateName === "$", "state_mismatch");
      const selections = layout?.qSelectionObject?.qSelections;
      check(Array.isArray(selections) && selections.length <= 5, "selection_unproven");
      if (empty) {
        check(selections.length === 0, "selection_residual");
        return;
      }
      const allowed = [
        ...mapping.filters.map((item) => item.field),
        ...mapping.calendar.selectionFields,
      ];
      check(
        new Set(selections.map((item) => item.qField)).size === selections.length &&
          selections.every(
            (item) =>
              allowed.includes(item.qField) &&
              !item.qLocked &&
              Number.isInteger(item.qSelectedCount) &&
              item.qSelectedCount > 0,
          ),
        "selection_unproven",
      );
      check(
        mapping.filters.every((filter) =>
          selections.some((item) => item.qField === filter.field && item.qSelectedCount === 1),
        ) &&
          mapping.calendar.selectionFields.every((field) =>
            selections.some((item) => item.qField === field),
          ),
        "selection_unproven",
      );
    }
    async function verifySelection(periods) {
      await selectedFields();
      for (let index = 0; index < 4; index++) {
        const values = (await list(lists[index]))
          .filter((cell) => cell.qState === "S")
          .map((cell) => cell.qText)
          .sort();
        const expected =
          index < 3
            ? [mapping.filters[index].value]
            : periods.map((period) => period.slice(0, 7).replace("-", "")).sort();
        check(equal(values, expected), "selection_unproven");
      }
    }
    async function selectPeriods(periods) {
      await call(doc, "clearAll", false, "$");
      await selectedFields(true);
      for (const filter of mapping.filters) {
        const field = await call(doc, "getField", filter.field, "$");
        check(
          (await call(
            field,
            "selectValues",
            [{ qText: filter.value, qIsNumeric: false }],
            false,
            false,
          )) === true,
          "selection_failed",
        );
      }
      const calendar = await list(lists[3]);
      const values = periods.map((period) => {
        const matches = calendar.filter(
          (cell) => cell.qText === period.slice(0, 7).replace("-", ""),
        );
        check(matches.length === 1 && ["O", "A"].includes(matches[0].qState), "month_unavailable");
        return matches[0].qElemNumber;
      });
      check(
        (await call(
          lists[3],
          "selectListObjectValues",
          "/qListObjectDef",
          values,
          false,
          false,
        )) === true,
        "selection_failed",
      );
      await verifySelection(periods);
    }
    async function readRole(role) {
      const config = mapping.cubes[role];
      await pinned(config);
      const source = sources[role];
      const native = await readCube(
        source.model,
        1,
        source.cube.qMeasures.length,
        [0, 1 + config.vgvMeasureIndex, 1 + config.contractsMeasureIndex],
        [config.vgvMeasureIndex, config.contractsMeasureIndex],
      );
      const enriched = await readCube(source.idCube, 2, 2, [0, 1, 2, 3], [0, 1]);
      await pinned(config);
      const nativeNames = new Map();
      const nativeSum = zero();
      for (const [nameCell, vgvCell, countCell] of native.rows) {
        const name = label(nameCell);
        check(!nativeNames.has(name), "duplicate_native_dimension");
        const values = { vgv: money(vgvCell), contracts: count(countCell) };
        nativeNames.set(name, values);
        add(nativeSum, values);
      }
      const rows = new Map();
      const names = new Map();
      const sum = zero();
      for (const [idCell, nameCell, vgvCell, countCell] of enriched.rows) {
        const key = keyOf(idCell, config.idEncoding);
        const name = label(nameCell);
        check(!rows.has(key), "duplicate_identity");
        const values = { vgv: money(vgvCell), contracts: count(countCell) };
        rows.set(key, { name, ...values });
        names.set(name, add(names.get(name) ?? zero(), values));
        add(sum, values);
      }
      check(nativeNames.size === names.size, "dimension_mismatch");
      for (const [name, values] of names) {
        check(nativeNames.has(name), "dimension_mismatch");
        totalsEqual(values, nativeNames.get(name));
      }
      totalsEqual(nativeSum, native.totals);
      totalsEqual(sum, enriched.totals);
      totalsEqual(sum, native.totals);
      return { rows, totals: sum };
    }
    const months = [];
    const accumulated = { imobs: new Map(), developments: new Map() };
    for (const periodMonth of mapping.periods) {
      await selectPeriods([periodMonth]);
      check((await reload()) === initialReload, "reload_changed");
      const month = { periodMonth };
      for (const role of ["imobs", "developments"]) {
        const collected = await readRole(role);
        for (const [key, values] of collected.rows) {
          const previous = accumulated[role].get(key);
          check(!previous || previous.name === values.name, "identity_name_changed");
          accumulated[role].set(key, {
            name: values.name,
            ...add(
              previous ? { vgv: previous.vgv, contracts: previous.contracts } : zero(),
              values,
            ),
          });
        }
        month[role] = {
          coverage: { state: "complete", sourceRows: collected.rows.size },
          nativeTotals: publicTotals(collected.totals),
          rows: [...collected.rows]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, values]) => ({ key, name: values.name, ...publicTotals(values) })),
        };
      }
      await verifySelection([periodMonth]);
      check((await reload()) === initialReload, "reload_changed");
      months.push(month);
      check(
        new TextEncoder().encode(JSON.stringify(months)).length <= 3_990_000,
        "aggregate_limit",
      );
    }
    await selectPeriods(mapping.periods);
    for (const role of ["imobs", "developments"]) {
      const annual = await readRole(role);
      check(annual.rows.size === accumulated[role].size, "annual_mismatch");
      const sum = zero();
      for (const [key, values] of accumulated[role]) {
        const row = annual.rows.get(key);
        check(row && row.name === values.name, "annual_mismatch");
        totalsEqual(row, values);
        add(sum, values);
      }
      totalsEqual(sum, annual.totals);
    }
    await verifySelection(mapping.periods);
    check((await reload()) === initialReload, "reload_changed");
    const fraction = initialReload.match(/\.\d+/)?.[0] ?? "";
    const reloadTimestamp = `${new Date(initialReload).toISOString().slice(0, 19)}${fraction}Z`;
    result = {
      status: "collected",
      source: { appId: APP, sheetId: SHEET, mappingSha256: mapping.mappingSha256, reloadTimestamp },
      scope: SCOPE,
      months,
    };
  } catch (error) {
    result = {
      status: "unavailable",
      reason: signal?.aborted
        ? "cancelled"
        : error instanceof Failure
          ? error.code
          : "collection_failed",
    };
  } finally {
    let cleanupFailed = false;
    if (doc)
      for (const id of temporary.reverse()) {
        try {
          if ((await doc.destroySessionObject(id)) !== true) cleanupFailed = true;
        } catch {
          cleanupFailed = true;
        }
      }
    if (cleanupFailed) result = { status: "unavailable", reason: "cleanup_failed" };
    if (signal?.aborted) result = { status: "unavailable", reason: "cancelled" };
  }
  return result;
}
