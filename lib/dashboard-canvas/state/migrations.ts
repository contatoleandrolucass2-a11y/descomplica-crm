import { constrainCardLayout, MAX_CARDS_PER_CANVAS } from "../layout/limits";
import {
  DASHBOARD_CARD_TYPES,
  DASHBOARD_CANVAS_SCHEMA_VERSION,
  DASHBOARD_GROUPS,
  DASHBOARD_PERIODS,
  type DashboardCanvasSnapshot,
  type DashboardCard,
  type DashboardCardOptions,
  type DashboardCardType,
  type DashboardGroupBy,
  type DashboardPeriod,
} from "../types";
import { parseCivilDate } from "../data/periods";

export { DASHBOARD_CANVAS_SCHEMA_VERSION } from "../types";
export const CURRENT_DASHBOARD_SCHEMA_VERSION = DASHBOARD_CANVAS_SCHEMA_VERSION;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  fallback: Values[number],
) {
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? (value as Values[number])
    : fallback;
}

function validCivilDate(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    parseCivilDate(value);
    return value;
  } catch {
    return undefined;
  }
}

function normalizeOptions(value: unknown): DashboardCardOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: DashboardCardOptions = {};
  for (const key of ["showLegend", "showGoal", "showCeiling", "sharedScale"] as const) {
    if (typeof value[key] === "boolean") options[key] = value[key];
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

function migrateLegacyCard(value: unknown) {
  if (!isRecord(value)) return value;
  const layout = isRecord(value.layout) ? value.layout : {};
  return {
    ...value,
    type: value.type ?? value.chartType,
    entityIds: value.entityIds ?? value.entities,
    options: value.options ?? value.settings,
    layout: {
      ...layout,
      columnSpan: layout.columnSpan ?? layout.span ?? value.columnSpan,
      height: layout.height ?? layout.heightPx ?? value.height,
      order: layout.order ?? value.order,
    },
  };
}

function migrateLegacyToV1(value: UnknownRecord): UnknownRecord {
  const cards = Array.isArray(value.cards) ? value.cards.map(migrateLegacyCard) : [];
  return { ...value, schemaVersion: 1, cards };
}

function migrateV1ToV2(value: UnknownRecord): UnknownRecord {
  return { ...value, schemaVersion: DASHBOARD_CANVAS_SCHEMA_VERSION };
}

export function normalizeDashboardCard(value: unknown, fallbackOrder = 0): DashboardCard | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const metric = readString(value.metric);
  if (!id || !metric) return null;

  const type = oneOf(value.type, DASHBOARD_CARD_TYPES, "bars") as DashboardCardType;
  let period = oneOf(value.period, DASHBOARD_PERIODS, "global") as DashboardPeriod;
  const groupBy = oneOf(value.groupBy, DASHBOARD_GROUPS, "entity") as DashboardGroupBy;
  const layoutValue = isRecord(value.layout) ? value.layout : {};
  const startDate = validCivilDate(value.startDate);
  const endDate = validCivilDate(value.endDate);

  if (period === "custom") {
    if (!startDate || !endDate || startDate > endDate) period = "global";
  }

  const entityIds = Array.isArray(value.entityIds)
    ? [...new Set(value.entityIds.map(readString).filter((id): id is string => id !== null))]
    : null;
  const title = readString(value.title);
  const options = normalizeOptions(value.options);
  const layoutInput: Partial<DashboardCard["layout"]> = {
    order: finiteNumber(layoutValue.order) ?? fallbackOrder,
  };
  const columnSpan = finiteNumber(layoutValue.columnSpan);
  const height = finiteNumber(layoutValue.height);
  if (columnSpan !== undefined) layoutInput.columnSpan = columnSpan;
  if (height !== undefined) layoutInput.height = height;
  const card: DashboardCard = {
    id,
    type,
    metric,
    period,
    groupBy,
    entityIds,
    layout: constrainCardLayout(type, layoutInput),
  };
  if (title) card.title = title;
  if (period === "custom" && startDate && endDate) {
    card.startDate = startDate;
    card.endDate = endDate;
  }
  if (options) card.options = options;
  return card;
}

export function normalizeDashboardCards(values: readonly unknown[]) {
  const cards: DashboardCard[] = [];
  const ids = new Set<string>();
  for (const value of values.slice(0, MAX_CARDS_PER_CANVAS)) {
    const card = normalizeDashboardCard(value, cards.length);
    if (!card || ids.has(card.id)) continue;
    ids.add(card.id);
    cards.push(card);
  }
  return cards
    .sort((left, right) => left.layout.order - right.layout.order)
    .map((card, order) => ({ ...card, layout: { ...card.layout, order } }));
}

export function migrateCanvasSchema(input: unknown): DashboardCanvasSnapshot {
  let document: UnknownRecord = Array.isArray(input)
    ? { schemaVersion: 0, cards: input }
    : isRecord(input)
      ? { ...input }
      : { schemaVersion: CURRENT_DASHBOARD_SCHEMA_VERSION, cards: [] };
  const rawVersion = document.schemaVersion ?? 0;
  if (!Number.isSafeInteger(rawVersion) || typeof rawVersion !== "number" || rawVersion < 0) {
    throw new RangeError("Dashboard schemaVersion must be a nonnegative safe integer.");
  }
  if (rawVersion > CURRENT_DASHBOARD_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported dashboard schemaVersion: ${rawVersion}.`);
  }
  let version = rawVersion;
  while (version < CURRENT_DASHBOARD_SCHEMA_VERSION) {
    if (version === 0) document = migrateLegacyToV1(document);
    if (version === 1) document = migrateV1ToV2(document);
    version += 1;
  }
  return {
    schemaVersion: CURRENT_DASHBOARD_SCHEMA_VERSION,
    cards: normalizeDashboardCards(Array.isArray(document.cards) ? document.cards : []),
  };
}

export function serializeCanvasSnapshot(snapshot: DashboardCanvasSnapshot) {
  return JSON.stringify(migrateCanvasSchema(snapshot));
}

export function deserializeCanvasSnapshot(serialized: string) {
  return migrateCanvasSchema(JSON.parse(serialized) as unknown);
}
