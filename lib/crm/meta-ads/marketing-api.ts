import "server-only";

import type { MetaAdsApiConfiguration } from "./config";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const MAX_PAGES = 25;
const MAX_ROWS = 50_000;
const REQUEST_TIMEOUT_MS = 20_000;
// The dashboard polls while visible. Keep one short shared window so concurrent
// users reuse the same Meta response instead of multiplying provider calls.
const CACHE_TTL_MS = 8_000;
const AD_EFFECTIVE_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "DELETED",
  "ARCHIVED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "PENDING_REVIEW",
  "PREAPPROVED",
  "DISAPPROVED",
  "PENDING_BILLING_INFO",
] as const;
const CAMPAIGN_EFFECTIVE_STATUSES = ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"] as const;

type MetaAction = { action_type?: unknown; value?: unknown };
type MetaInsight = Record<string, unknown> & { actions?: MetaAction[] };
type MetaAd = Record<string, unknown> & {
  adset?: { id?: unknown; targeting?: unknown };
};
type MetaCampaign = Record<string, unknown> & {
  id?: unknown;
  effective_status?: unknown;
};

export type MetaAdsTargetLocation = {
  type: "country" | "region" | "city" | "zip";
  key: string;
  name: string;
  region: string | null;
  country: string | null;
};

export type MetaAdsDashboardRow = {
  rowId: string;
  date: string;
  accountId: string;
  account: string;
  campaignId: string;
  campaign: string;
  adsetId: string;
  adset: string;
  adId: string;
  ad: string;
  project: string;
  destination: "form" | "site" | "whatsapp" | "unknown";
  status: "active" | "paused" | "deleted" | "archived" | "unknown";
  event: "lead" | "conversation" | "conversion";
  attribution: string;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
  reach: number | null;
  formOpens: number | null;
  sessions: number | null;
  convertedSessions: number | null;
  waClicks: number | null;
  messageClicks: number | null;
  crmContacts: null;
  qualifiedLeads: null;
  sales: null;
  cohortMature: false;
  crmDeduplicated: false;
  qualityRanking: null;
  engagementRanking: null;
  conversionRanking: null;
  targetLocations: MetaAdsTargetLocation[];
};

export type MetaAdsDashboardData = {
  source: "meta_marketing_api";
  accountId: string;
  accountName: string;
  currency: string;
  accountBalance: number | null;
  amountSpent: number | null;
  spendCap: number | null;
  fetchedAt: string;
  range: { start: string; end: string };
  rows: MetaAdsDashboardRow[];
  regionalResults: MetaAdsRegionalResult[];
};

export type MetaAdsRegionalResult = {
  rowId: string;
  date: string;
  accountId: string;
  campaignId: string;
  adsetId: string;
  adId: string;
  region: string;
  destination: MetaAdsDashboardRow["destination"];
  status: MetaAdsDashboardRow["status"];
  conversions: number;
};

export class MetaAdsApiError extends Error {
  constructor(
    readonly code: "configuration" | "authentication" | "rate_limit" | "upstream" | "invalid_data",
    readonly status: number,
  ) {
    super(code);
    this.name = "MetaAdsApiError";
  }
}

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { code?: number; message?: string; type?: string };
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return number(value);
}

function moneyFromMinorUnits(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed / 100 : null;
}

function targetLocations(value: unknown): MetaAdsTargetLocation[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const targeting = value as Record<string, unknown>;
  const included = targeting.geo_locations;
  if (!included || typeof included !== "object" || Array.isArray(included)) return [];
  const geo = included as Record<string, unknown>;
  const output: MetaAdsTargetLocation[] = [];
  const add = (type: MetaAdsTargetLocation["type"], item: unknown, fallbackName = "") => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    const key = text(record.key) || text(record.id) || text(record.name) || fallbackName;
    const name = text(record.name) || fallbackName || key;
    if (!key || !name) return;
    output.push({
      type,
      key,
      name,
      region: text(record.region) || null,
      country: text(record.country_name) || text(record.country) || null,
    });
  };
  for (const [field, type] of [
    ["regions", "region"],
    ["cities", "city"],
    ["zips", "zip"],
  ] as const) {
    const rows = geo[field];
    if (Array.isArray(rows)) for (const row of rows) add(type, row);
  }
  const countries = geo.countries;
  if (Array.isArray(countries)) {
    for (const country of countries) {
      const code = text(country);
      if (code)
        output.push({ type: "country", key: code, name: code, region: null, country: code });
      else add("country", country);
    }
  }
  return output;
}

function actionValue(actions: MetaAction[] | undefined, names: readonly string[]) {
  if (!Array.isArray(actions)) return 0;
  const accepted = new Set(names);
  return actions.reduce(
    (sum, action) => sum + (accepted.has(text(action.action_type)) ? number(action.value) : 0),
    0,
  );
}

// Meta may return the generic lead action together with a destination-specific
// alias for the same conversion. Ads Manager treats those as one result; adding
// aliases inflates campaign totals. Keep the largest compatible counter instead.
function leadActionValue(actions: MetaAction[] | undefined) {
  if (!Array.isArray(actions)) return 0;
  const accepted = new Set<string>(LEAD_ACTIONS);
  return Math.max(
    0,
    ...actions.map((action) => (accepted.has(text(action.action_type)) ? number(action.value) : 0)),
  );
}

const MESSAGE_ACTIONS = ["onsite_conversion.messaging_conversation_started_7d"] as const;
const LEAD_ACTIONS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
] as const;
const LINK_CLICK_ACTIONS = ["link_click"] as const;

function normalizeStatus(value: unknown): MetaAdsDashboardRow["status"] {
  const status = text(value).toUpperCase();
  if (status === "ACTIVE") return "active";
  if (status === "PAUSED" || status === "CAMPAIGN_PAUSED" || status === "ADSET_PAUSED")
    return "paused";
  if (status === "DELETED") return "deleted";
  if (status === "ARCHIVED") return "archived";
  return "unknown";
}

function mapInsight(
  insight: MetaInsight,
  campaignStatuses: ReadonlyMap<string, MetaAdsDashboardRow["status"]>,
  adDestinations: ReadonlyMap<string, MetaAdsDashboardRow["destination"]>,
  adsetTargets: ReadonlyMap<string, MetaAdsTargetLocation[]>,
): MetaAdsDashboardRow | null {
  const date = text(insight.date_start);
  const accountId = text(insight.account_id);
  const campaignId = text(insight.campaign_id);
  const adsetId = text(insight.adset_id);
  const adId = text(insight.ad_id);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !accountId || !campaignId || !adsetId || !adId) {
    return null;
  }
  const messageConversions = actionValue(insight.actions, MESSAGE_ACTIONS);
  const leadConversions = leadActionValue(insight.actions);
  const destination =
    messageConversions > 0
      ? "whatsapp"
      : leadConversions > 0
        ? "form"
        : adDestinations.get(adId) || "unknown";
  const conversions = destination === "whatsapp" ? messageConversions : leadConversions;
  const clicks = actionValue(insight.actions, LINK_CLICK_ACTIONS);
  const campaign = text(insight.campaign_name);
  const project = campaign.split(/[|·—-]/u, 1)[0]?.trim() || campaign;
  return {
    rowId: [date, accountId, campaignId, adsetId, adId].join("|"),
    date,
    accountId,
    account: text(insight.account_name) || accountId,
    campaignId,
    campaign: campaign || campaignId,
    adsetId,
    adset: text(insight.adset_name) || adsetId,
    adId,
    ad: text(insight.ad_name) || adId,
    project,
    destination,
    status: campaignStatuses.get(campaignId) || "unknown",
    event:
      destination === "whatsapp" ? "conversation" : destination === "form" ? "lead" : "conversion",
    attribution: "Configuração unificada do conjunto de anúncios",
    spend: number(insight.spend),
    conversions,
    clicks,
    impressions: number(insight.impressions),
    reach: nullableNumber(insight.reach),
    formOpens: null,
    sessions: null,
    convertedSessions: null,
    waClicks: destination === "whatsapp" ? clicks : null,
    messageClicks: destination === "whatsapp" ? conversions : null,
    crmContacts: null,
    qualifiedLeads: null,
    sales: null,
    cohortMature: false,
    crmDeduplicated: false,
    qualityRanking: null,
    engagementRanking: null,
    conversionRanking: null,
    targetLocations: adsetTargets.get(adsetId) || [],
  };
}

function mapRegionalInsight(
  insight: MetaInsight,
  campaignStatuses: ReadonlyMap<string, MetaAdsDashboardRow["status"]>,
  adDestinations: ReadonlyMap<string, MetaAdsDashboardRow["destination"]>,
): MetaAdsRegionalResult | null {
  const date = text(insight.date_start);
  const accountId = text(insight.account_id);
  const campaignId = text(insight.campaign_id);
  const adsetId = text(insight.adset_id);
  const adId = text(insight.ad_id);
  const region = text(insight.region);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !accountId ||
    !campaignId ||
    !adsetId ||
    !adId ||
    !region
  ) {
    return null;
  }
  const destination = adDestinations.get(adId) || "unknown";
  const conversions =
    destination === "whatsapp"
      ? actionValue(insight.actions, MESSAGE_ACTIONS)
      : leadActionValue(insight.actions);
  return {
    rowId: [date, accountId, campaignId, adsetId, adId, region].join("|"),
    date,
    accountId,
    campaignId,
    adsetId,
    adId,
    region,
    destination,
    status: campaignStatuses.get(campaignId) || "unknown",
    conversions,
  };
}

function safeNext(next: unknown, configuration: MetaAdsApiConfiguration & { available: true }) {
  if (typeof next !== "string" || !next) return null;
  const url = new URL(next);
  const expectedPrefix = `/${configuration.apiVersion}/`;
  if (url.origin !== GRAPH_ORIGIN || !url.pathname.startsWith(expectedPrefix)) {
    throw new MetaAdsApiError("invalid_data", 502);
  }
  url.searchParams.delete("access_token");
  return url;
}

function classifyGraphError(status: number, code?: number) {
  if (status === 401 || status === 403 || code === 190) {
    return new MetaAdsApiError("authentication", 503);
  }
  if (status === 429 || code === 4 || code === 17 || code === 32 || code === 613) {
    return new MetaAdsApiError("rate_limit", 503);
  }
  return new MetaAdsApiError("upstream", 502);
}

async function graphPages<T>(
  initial: URL,
  configuration: MetaAdsApiConfiguration & { available: true },
  fetcher: typeof fetch,
) {
  let next: URL | null = initial;
  const output: T[] = [];
  for (let page = 0; next && page < MAX_PAGES; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher(next, {
        headers: { Authorization: `Bearer ${configuration.accessToken}` },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      throw new MetaAdsApiError("upstream", 502);
    } finally {
      clearTimeout(timeout);
    }
    let body: GraphPage<T>;
    try {
      body = (await response.json()) as GraphPage<T>;
    } catch {
      throw new MetaAdsApiError("invalid_data", 502);
    }
    if (!response.ok || body.error) throw classifyGraphError(response.status, body.error?.code);
    if (!Array.isArray(body.data)) throw new MetaAdsApiError("invalid_data", 502);
    output.push(...body.data);
    if (output.length > MAX_ROWS) throw new MetaAdsApiError("invalid_data", 502);
    next = safeNext(body.paging?.next, configuration);
  }
  if (next) throw new MetaAdsApiError("invalid_data", 502);
  return output;
}

async function graphObject<T extends Record<string, unknown>>(
  url: URL,
  configuration: MetaAdsApiConfiguration & { available: true },
  fetcher: typeof fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `Bearer ${configuration.accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new MetaAdsApiError("upstream", 502);
  } finally {
    clearTimeout(timeout);
  }
  let body: T & { error?: { code?: number } };
  try {
    body = (await response.json()) as T & { error?: { code?: number } };
  } catch {
    throw new MetaAdsApiError("invalid_data", 502);
  }
  if (!response.ok || body.error) throw classifyGraphError(response.status, body.error?.code);
  return body;
}

function graphUrl(configuration: MetaAdsApiConfiguration & { available: true }, edge: string) {
  return new URL(`${GRAPH_ORIGIN}/${configuration.apiVersion}/${edge}`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function saoPauloDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateRange(now: Date, days: number) {
  const end = new Date(`${saoPauloDate(now)}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

export function validateMetaAdsRange(start: string | null, end: string | null) {
  if (!start && !end) return undefined;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/u.test(start) || !/^\d{4}-\d{2}-\d{2}$/u.test(end)) {
    throw new MetaAdsApiError("invalid_data", 400);
  }
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  const days = (last.getTime() - first.getTime()) / 86_400_000 + 1;
  if (
    !Number.isFinite(days) ||
    days < 1 ||
    days > 732 ||
    isoDate(first) !== start ||
    isoDate(last) !== end
  ) {
    throw new MetaAdsApiError("invalid_data", 400);
  }
  return { start, end };
}

const cache = new Map<string, { expiresAt: number; data: MetaAdsDashboardData }>();
const inFlight = new Map<string, Promise<MetaAdsDashboardData>>();

export async function fetchMetaAdsDashboardData(
  configuration: MetaAdsApiConfiguration,
  options: {
    fetcher?: typeof fetch;
    now?: Date;
    bypassCache?: boolean;
    range?: { start: string; end: string };
  } = {},
): Promise<MetaAdsDashboardData> {
  if (!configuration.available) throw new MetaAdsApiError("configuration", 503);
  const now = options.now || new Date();
  const range = options.range
    ? validateMetaAdsRange(options.range.start, options.range.end)!
    : dateRange(now, 120);
  const key = `${configuration.apiVersion}:${configuration.accountId}:${range.start}:${range.end}`;
  const cached = cache.get(key);
  if (!options.bypassCache && cached?.expiresAt && cached.expiresAt > now.getTime())
    return cached.data;
  if (cached) cache.delete(key);
  const pending = inFlight.get(key);
  if (!options.bypassCache && pending) return pending;
  const fetcher = options.fetcher || fetch;

  const refresh = async () => {
    const adsUrl = graphUrl(configuration, `act_${configuration.accountId}/ads`);
    adsUrl.searchParams.set("fields", "id,adset{id,targeting}");
    adsUrl.searchParams.set(
      "filtering",
      JSON.stringify([{ field: "effective_status", operator: "IN", value: AD_EFFECTIVE_STATUSES }]),
    );
    adsUrl.searchParams.set("limit", "500");
    const ads = await graphPages<MetaAd>(adsUrl, configuration, fetcher);
    const campaignsUrl = graphUrl(configuration, `act_${configuration.accountId}/campaigns`);
    campaignsUrl.searchParams.set("fields", "id,effective_status");
    campaignsUrl.searchParams.set(
      "filtering",
      JSON.stringify([
        { field: "effective_status", operator: "IN", value: CAMPAIGN_EFFECTIVE_STATUSES },
      ]),
    );
    campaignsUrl.searchParams.set("limit", "500");
    const metaCampaigns = await graphPages<MetaCampaign>(campaignsUrl, configuration, fetcher);
    const campaignStatuses = new Map(
      metaCampaigns
        .map((campaign) => [text(campaign.id), normalizeStatus(campaign.effective_status)] as const)
        .filter(([id]) => Boolean(id)),
    );
    const adsetTargets = new Map<string, MetaAdsTargetLocation[]>();
    for (const ad of ads) {
      const adsetId = text(ad.adset?.id);
      const locations = targetLocations(ad.adset?.targeting);
      if (adsetId && (!adsetTargets.has(adsetId) || locations.length)) {
        adsetTargets.set(adsetId, locations);
      }
    }

    const insightsUrl = graphUrl(configuration, `act_${configuration.accountId}/insights`);
    insightsUrl.searchParams.set("level", "ad");
    insightsUrl.searchParams.set("time_increment", "1");
    insightsUrl.searchParams.set(
      "time_range",
      JSON.stringify({ since: range.start, until: range.end }),
    );
    insightsUrl.searchParams.set("use_unified_attribution_setting", "true");
    insightsUrl.searchParams.set("limit", "500");
    insightsUrl.searchParams.set(
      "fields",
      "date_start,account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,actions",
    );
    const insights = await graphPages<MetaInsight>(insightsUrl, configuration, fetcher);
    const destinations = new Map<string, MetaAdsDashboardRow["destination"]>();
    for (const insight of insights) {
      const adId = text(insight.ad_id);
      if (!adId) continue;
      if (actionValue(insight.actions, MESSAGE_ACTIONS) > 0) destinations.set(adId, "whatsapp");
      else if (leadActionValue(insight.actions) > 0 && destinations.get(adId) !== "whatsapp")
        destinations.set(adId, "form");
    }
    const rows = insights
      .map((insight) => mapInsight(insight, campaignStatuses, destinations, adsetTargets))
      .filter((row): row is MetaAdsDashboardRow => row !== null);
    if (rows.length !== insights.length) throw new MetaAdsApiError("invalid_data", 502);
    const regionalUrl = graphUrl(configuration, `act_${configuration.accountId}/insights`);
    regionalUrl.searchParams.set("level", "ad");
    regionalUrl.searchParams.set("time_increment", "1");
    regionalUrl.searchParams.set("breakdowns", "region");
    regionalUrl.searchParams.set(
      "time_range",
      JSON.stringify({ since: range.start, until: range.end }),
    );
    regionalUrl.searchParams.set("use_unified_attribution_setting", "true");
    regionalUrl.searchParams.set("limit", "500");
    regionalUrl.searchParams.set(
      "fields",
      "date_start,account_id,campaign_id,adset_id,ad_id,actions",
    );
    const regionalInsights = await graphPages<MetaInsight>(regionalUrl, configuration, fetcher);
    const regionalResults = regionalInsights
      .map((insight) => mapRegionalInsight(insight, campaignStatuses, destinations))
      .filter((row): row is MetaAdsRegionalResult => row !== null);
    if (regionalResults.length !== regionalInsights.length) {
      throw new MetaAdsApiError("invalid_data", 502);
    }
    const accountUrl = graphUrl(configuration, `act_${configuration.accountId}`);
    accountUrl.searchParams.set("fields", "id,name,currency,balance,amount_spent,spend_cap");
    const account = await graphObject(accountUrl, configuration, fetcher);
    const accountName = text(account.name) || rows[0]?.account || configuration.accountId;
    const data: MetaAdsDashboardData = {
      source: "meta_marketing_api",
      accountId: configuration.accountId,
      accountName,
      currency: text(account.currency) || "BRL",
      accountBalance: moneyFromMinorUnits(account.balance),
      amountSpent: moneyFromMinorUnits(account.amount_spent),
      spendCap: moneyFromMinorUnits(account.spend_cap),
      fetchedAt: now.toISOString(),
      range,
      rows,
      regionalResults,
    };
    cache.set(key, { expiresAt: now.getTime() + CACHE_TTL_MS, data });
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    return data;
  };

  if (options.bypassCache) return refresh();
  const promise = refresh();
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }
}

export async function probeMetaAdsApi(
  configuration: MetaAdsApiConfiguration,
  fetcher: typeof fetch = fetch,
) {
  if (!configuration.available) throw new MetaAdsApiError("configuration", 503);
  const url = graphUrl(configuration, `act_${configuration.accountId}`);
  url.searchParams.set("fields", "id,name,currency,account_status");
  const account = await graphObject(url, configuration, fetcher);
  if (!account || text(account.id) !== `act_${configuration.accountId}`) {
    throw new MetaAdsApiError("invalid_data", 502);
  }
  return { accountName: text(account.name), currency: text(account.currency) };
}
