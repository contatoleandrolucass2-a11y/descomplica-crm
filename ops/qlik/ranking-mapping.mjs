import { createHash } from "node:crypto";

const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
const CALENDAR = "=Year([DT])&Num(Month([DT]),'00')";
const SCOPE = Object.freeze({
  businessUnit: "Direcional",
  regional: "SP CAPITAL",
  channel: "CANAL IMOB",
});
const PERIOD_POLICY = Object.freeze({
  range: "current-year-through-month",
  timeZone: "America/Sao_Paulo",
  calendar: "gregory",
});
const UNVERIFIED = Symbol("unverified");

// Native structure reviewed on 2026-10-16; collection rechecks every pin and total.
// These pins do not attest successful selections, reconciliation or publication.
export const PRODUCTION_DEFINITION = freeze({
  verified: true,
  provenance: {
    kind: "qlik-native-metadata",
    observedAt: "2026-10-16T00:58:46.525Z",
    metadataSha256: "7972045382ad30177e123aa6716f176a76c41c695147e3d97c74be6424e96ffa",
  },
  filters: [
    {
      field: "Empresa (Filtro)",
      value: "Direcional",
    },
    {
      field: "Regional (Filtro)",
      value: "SP CAPITAL",
    },
    {
      field: "DS_Canal de Vendas - (DRCMIM)",
      value: "CANAL IMOB",
    },
  ],
  calendar: {
    expression: "=Year([DT])&Num(Month([DT]),'00')",
    selectionFields: ["DT"],
  },
  cubes: {
    imobs: {
      objectId: "f329b391-4760-4b29-b65b-5f63e46ce423",
      cubeSha256: "c599f1916c7b1055e65f90186cf20beb04ed82772a7ac780d06494aa53ff369c",
      idField: "Id da Imobiliaria - (DRCMCRC)",
      idEncoding: "utf8-hex",
      vgvMeasureIndex: 0,
      contractsMeasureIndex: 1,
      masterPins: [
        {
          kind: "measure",
          id: "ambkS",
          sha256: "12b95aab8efa827b0f429f1a8a5b7d52bb9ed3c594d6430f2f045508d8763121",
        },
      ],
      aliasPins: [
        {
          alias: "VENDAS",
          measureIndex: 1,
          id: "b49e2791-42be-4b14-b4a6-854cdf7da894",
          propertiesSha256: "02fb1d99e15442444d4dff6bf7c07f5b6e2c57cedc7719c924d830f62377f566",
        },
      ],
    },
    developments: {
      objectId: "26aed86d-e96b-4151-bc15-7b54d456f032",
      cubeSha256: "1d2d665a6b03f76831c8fe43852ecaa457ac40c8717b96add50f8f140abfff78",
      idField: "CD_Empreendimento - (DRCMEM)",
      idEncoding: "utf8-hex",
      vgvMeasureIndex: 1,
      contractsMeasureIndex: 0,
      masterPins: [
        {
          kind: "measure",
          id: "ytvHG",
          sha256: "2f573da74bfd9a20254071cf6253a5042baa21b85bc4774dc565fdc6653a6355",
        },
      ],
      aliasPins: [
        {
          alias: "VENDAS",
          measureIndex: 0,
          id: "b49e2791-42be-4b14-b4a6-854cdf7da894",
          propertiesSha256: "02fb1d99e15442444d4dff6bf7c07f5b6e2c57cedc7719c924d830f62377f566",
        },
        {
          alias: "VGV",
          measureIndex: 1,
          id: "ambkS",
          propertiesSha256: "d3eaf483241916a971fff339118b4fc8a2f995a514f4529e87fcb1a85b3005ce",
        },
      ],
    },
  },
});

function check(condition) {
  if (!condition) throw new Error("mapping_invalid");
}

function record(value, keys) {
  check(value !== null && typeof value === "object" && !Array.isArray(value));
  check([Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const own = Reflect.ownKeys(value);
  check(own.length === keys.length && own.every((key) => keys.includes(key)));
  return Object.fromEntries(
    keys.map((key) => {
      const property = Object.getOwnPropertyDescriptor(value, key);
      check(property && "value" in property && property.enumerable);
      return [key, property.value];
    }),
  );
}

function list(value, minimum, maximum, project) {
  check(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype);
  check(value.length >= minimum && value.length <= maximum);
  check(Reflect.ownKeys(value).length === value.length + 1);
  return Array.from({ length: value.length }, (_, index) => {
    const property = Object.getOwnPropertyDescriptor(value, String(index));
    check(property && "value" in property && property.enumerable);
    return project(property.value);
  });
}

function text(value) {
  check(typeof value === "string" && value.length > 0 && value.length <= 256);
  check(value.isWellFormed() && !/[\p{Cc}\p{Cs}]/u.test(value) && value.trim() === value);
  return value;
}

function field(value) {
  text(value);
  check(!value.startsWith("="));
  return value;
}

function id(value) {
  text(value);
  check(!/[\u0000-\u0020\u007f]/u.test(value));
  return value;
}

function hash(value) {
  check(typeof value === "string" && value.length === 64 && /^[a-f0-9]{64}$/.test(value));
  return value;
}

function cube(value) {
  const result = record(value, [
    "objectId",
    "cubeSha256",
    "idField",
    "idEncoding",
    "vgvMeasureIndex",
    "contractsMeasureIndex",
    "masterPins",
    ...(Object.hasOwn(value, "aliasPins") ? ["aliasPins"] : []),
  ]);
  id(result.objectId);
  check(![APP, SHEET].includes(result.objectId));
  hash(result.cubeSha256);
  field(result.idField);
  check(["plain", "utf8-hex"].includes(result.idEncoding));
  check(
    [result.vgvMeasureIndex, result.contractsMeasureIndex].every(
      (index) => Number.isInteger(index) && index >= 0 && index < 32,
    ),
  );
  check(result.vgvMeasureIndex !== result.contractsMeasureIndex);
  result.masterPins = list(result.masterPins, 0, 33, (value) => {
    const pin = record(value, ["kind", "id", "sha256"]);
    check(["dimension", "measure"].includes(pin.kind));
    id(pin.id);
    hash(pin.sha256);
    return pin;
  });
  check(
    new Set(result.masterPins.map((pin) => `${pin.kind}:${pin.id}`)).size ===
      result.masterPins.length,
  );
  result.aliasPins = Object.hasOwn(result, "aliasPins")
    ? list(result.aliasPins, 0, 2, (value) => {
        const pin = record(value, ["alias", "measureIndex", "id", "propertiesSha256"]);
        check(["VENDAS", "VGV"].includes(pin.alias));
        check(
          pin.measureIndex ===
            (pin.alias === "VENDAS" ? result.contractsMeasureIndex : result.vgvMeasureIndex),
        );
        id(pin.id);
        hash(pin.propertiesSha256);
        return pin;
      })
    : [];
  for (const key of ["alias", "measureIndex", "id"])
    check(new Set(result.aliasPins.map((pin) => pin[key])).size === result.aliasPins.length);
  return result;
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

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function createRankingMapping({
  now = () => new Date(),
  definition = PRODUCTION_DEFINITION,
} = {}) {
  try {
    if (definition === null) throw UNVERIFIED;
    const source = record(definition, ["verified", "provenance", "filters", "calendar", "cubes"]);
    if (source.verified !== true) throw UNVERIFIED;
    const provenance = record(source.provenance, ["kind", "observedAt", "metadataSha256"]);
    check(["qlik-native-metadata", "synthetic-fixture"].includes(provenance.kind));
    hash(provenance.metadataSha256);
    check(
      typeof provenance.observedAt === "string" &&
        Number.isFinite(Date.parse(provenance.observedAt)),
    );
    check(new Date(provenance.observedAt).toISOString() === provenance.observedAt);
    const filters = list(source.filters, 3, 3, (value) => {
      const filter = record(value, ["field", "value"]);
      field(filter.field);
      check(Object.values(SCOPE).includes(filter.value));
      return filter;
    });
    check(new Set(filters.map((filter) => filter.field)).size === 3);
    check(new Set(filters.map((filter) => filter.value)).size === 3);
    const calendar = record(source.calendar, ["expression", "selectionFields"]);
    check(calendar.expression === CALENDAR);
    calendar.selectionFields = list(calendar.selectionFields, 1, 2, (value) => {
      if (value !== CALENDAR) field(value);
      check(!filters.some((filter) => filter.field === value));
      return value;
    });
    check(new Set(calendar.selectionFields).size === calendar.selectionFields.length);
    const cubes = record(source.cubes, ["imobs", "developments"]);
    cubes.imobs = cube(cubes.imobs);
    cubes.developments = cube(cubes.developments);
    check(cubes.imobs.objectId !== cubes.developments.objectId);
    check(typeof now === "function");
    const instant = Date.prototype.getTime.call(now());
    check(Number.isFinite(instant) && Date.parse(provenance.observedAt) <= instant);
    const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone: PERIOD_POLICY.timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date(instant));
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    check(Number.isInteger(year) && year >= 2020 && year <= 2100);
    check(Number.isInteger(month) && month >= 1 && month <= 12);
    const fixed = {
      schemaVersion: 1,
      verified: true,
      appId: APP,
      sheetId: SHEET,
      numericPolicy: "safe-cent-v1",
      scope: SCOPE,
      periodPolicy: PERIOD_POLICY,
      provenance,
      filters,
      calendar,
      cubes,
    };
    const serialized = canonical(fixed);
    const mapping = {
      ...fixed,
      mappingSha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
      periods: Array.from(
        { length: month },
        (_, index) => `${year}-${String(index + 1).padStart(2, "0")}-01`,
      ),
    };
    check(Buffer.byteLength(JSON.stringify(mapping), "utf8") <= 65_536);
    return freeze(mapping);
  } catch (failure) {
    throw new Error(failure === UNVERIFIED ? "mapping_unverified" : "mapping_invalid");
  }
}
