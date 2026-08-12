import { z } from "zod";

import { readModelV3PeriodSchema, type ReadModelV3Period } from "./contracts";

const uuid = z.string().uuid();

export const DIMENSION_QUERY_KEYS = {
  organizations: "organizationIds",
  teams: "teamIds",
  portfolios: "portfolioIds",
  coordinators: "coordinatorIds",
  managers: "managerIds",
  brokers: "brokerIds",
  origins: "originIds",
  developments: "developmentIds",
  locations: "locationIds",
} as const;

export type ReadModelV3Dimension = keyof typeof DIMENSION_QUERY_KEYS;

export interface ReadModelV3FilterSelection {
  scopeId: string | null;
  period: ReadModelV3Period;
  from: string | null;
  to: string | null;
  dimensions: Record<ReadModelV3Dimension, string[]>;
}

export type ReadModelV3FilterParseResult =
  | { ok: true; selection: ReadModelV3FilterSelection }
  | { ok: false; reason: "invalid_filter_parameters" };

export type SearchParameterRecord = Record<string, string | string[] | undefined>;

const ALLOWED_QUERY_KEYS = new Set([
  "scope",
  "period",
  "from",
  "to",
  ...Object.keys(DIMENSION_QUERY_KEYS),
]);

export function createEmptyReadModelV3Selection(): ReadModelV3FilterSelection {
  return {
    scopeId: null,
    period: "month",
    from: null,
    to: null,
    dimensions: {
      organizations: [],
      teams: [],
      portfolios: [],
      coordinators: [],
      managers: [],
      brokers: [],
      origins: [],
      developments: [],
      locations: [],
    },
  };
}

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : value === undefined ? undefined : null;
}

function parseUuidList(value: string | string[] | undefined): string[] | null {
  const single = one(value);
  if (single === null) return null;
  if (single === undefined || single.trim() === "") return [];
  const values = single.split(",").map((item) => item.trim());
  if (values.length > 1 || values.some((item) => !uuid.safeParse(item).success)) return null;
  const normalized = [...new Set(values)].sort();
  return normalized.length === values.length ? normalized : null;
}

export function parseReadModelV3Filters(
  query: SearchParameterRecord,
): ReadModelV3FilterParseResult {
  if (Object.keys(query).some((key) => !ALLOWED_QUERY_KEYS.has(key))) {
    return { ok: false, reason: "invalid_filter_parameters" };
  }

  const rawScope = one(query.scope);
  const rawPeriod = one(query.period);
  const rawFrom = one(query.from);
  const rawTo = one(query.to);
  if (rawScope === null || rawPeriod === null || rawFrom === null || rawTo === null) {
    return { ok: false, reason: "invalid_filter_parameters" };
  }

  const scopeId = rawScope && rawScope.trim() !== "" ? rawScope.trim() : null;
  const periodResult = readModelV3PeriodSchema.safeParse(rawPeriod || "month");
  if ((scopeId && !uuid.safeParse(scopeId).success) || !periodResult.success) {
    return { ok: false, reason: "invalid_filter_parameters" };
  }

  const from = rawFrom?.trim() || null;
  const to = rawTo?.trim() || null;
  const date = z.string().date();
  if (
    (periodResult.data === "custom" &&
      (!from ||
        !to ||
        !date.safeParse(from).success ||
        !date.safeParse(to).success ||
        from >= to)) ||
    (periodResult.data !== "custom" && (from !== null || to !== null))
  ) {
    return { ok: false, reason: "invalid_filter_parameters" };
  }

  const dimensions = {} as Record<ReadModelV3Dimension, string[]>;
  for (const dimension of Object.keys(DIMENSION_QUERY_KEYS) as ReadModelV3Dimension[]) {
    const value = parseUuidList(query[dimension]);
    if (value === null) return { ok: false, reason: "invalid_filter_parameters" };
    dimensions[dimension] = value;
  }

  return {
    ok: true,
    selection: { scopeId, period: periodResult.data, from, to, dimensions },
  };
}

export function toReadModelV3RpcFilters(selection: ReadModelV3FilterSelection) {
  const filters: Record<string, string | string[]> = { period: selection.period };
  if (selection.period === "custom" && selection.from && selection.to) {
    filters.from = selection.from;
    filters.to = selection.to;
  }
  for (const [queryKey, rpcKey] of Object.entries(DIMENSION_QUERY_KEYS) as Array<
    [ReadModelV3Dimension, (typeof DIMENSION_QUERY_KEYS)[ReadModelV3Dimension]]
  >) {
    const values = selection.dimensions[queryKey];
    if (values.length > 0) filters[rpcKey] = values;
  }
  return filters;
}

export function readModelV3FilterStateKey(selection: ReadModelV3FilterSelection) {
  return JSON.stringify([
    selection.scopeId,
    selection.period,
    selection.from,
    selection.to,
    ...(Object.keys(DIMENSION_QUERY_KEYS) as ReadModelV3Dimension[]).map((dimension) => [
      dimension,
      selection.dimensions[dimension],
    ]),
  ]);
}

export function buildReadModelV3Href(
  path: string,
  selection: ReadModelV3FilterSelection,
  overrides: Partial<Record<"scope" | "period" | ReadModelV3Dimension, string | null>> = {},
) {
  const params = new URLSearchParams();
  const scope = overrides.scope === undefined ? selection.scopeId : overrides.scope;
  const period = overrides.period === undefined ? selection.period : overrides.period;
  if (scope) params.set("scope", scope);
  if (period) params.set("period", period);
  if (period === "custom" && selection.from && selection.to) {
    params.set("from", selection.from);
    params.set("to", selection.to);
  }
  for (const dimension of Object.keys(DIMENSION_QUERY_KEYS) as ReadModelV3Dimension[]) {
    const override = overrides[dimension];
    const value = override === undefined ? selection.dimensions[dimension].join(",") : override;
    if (value) params.set(dimension, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
