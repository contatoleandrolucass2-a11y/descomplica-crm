import "server-only";

import type { MetaAdsApiConfiguration } from "./config";

const GRAPH_ORIGIN = "https://graph.facebook.com";
const MAX_PAGES = 25;
const MAX_ROWS = 50_000;
const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 5 * 60_000;
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

type MetaAction = { action_type?: unknown; value?: unknown };
type MetaInsight = Record<string, unknown> & { actions?: MetaAction[] };
type MetaAd = Record<string, unknown>;

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
};

export type MetaAdsDashboardData = {
  source: "meta_marketing_api";
  accountId: string;
  accountName: string;
  currency: string;
  fetchedAt: string;
  range: { start: string; end: string };
  rows: MetaAdsDashboardRow[];
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

function actionValue(actions: MetaAction[] | undefined, names: readonly string[]) {
  if (!Array.isArray(actions)) return 0;
  const accepted = new Set(names);
  return actions.reduce(
    (sum, action) => sum + (accepted.has(text(action.action_type)) ? number(action.value) : 0),
    0,
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
  adStatuses: ReadonlyMap<string, MetaAdsDashboardRow["status"]>,
  adDestinations: ReadonlyMap<string, MetaAdsDashboardRow["destination"]>,
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
  const leadConversions = actionValue(insight.actions, LEAD_ACTIONS);
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
    status: adStatuses.get(adId) || "unknown",
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

function dateRange(now: Date, days: number) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

let cache: { key: string; expiresAt: number; data: MetaAdsDashboardData } | null = null;

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
  if (!options.bypassCache && cache?.key === key && cache.expiresAt > now.getTime())
    return cache.data;
  const fetcher = options.fetcher || fetch;

  const adsUrl = graphUrl(configuration, `act_${configuration.accountId}/ads`);
  adsUrl.searchParams.set("fields", "id,effective_status");
  adsUrl.searchParams.set(
    "filtering",
    JSON.stringify([{ field: "effective_status", operator: "IN", value: AD_EFFECTIVE_STATUSES }]),
  );
  adsUrl.searchParams.set("limit", "500");
  const ads = await graphPages<MetaAd>(adsUrl, configuration, fetcher);
  const statuses = new Map(
    ads
      .map((ad) => [text(ad.id), normalizeStatus(ad.effective_status)] as const)
      .filter(([id]) => Boolean(id)),
  );

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
    else if (
      actionValue(insight.actions, LEAD_ACTIONS) > 0 &&
      destinations.get(adId) !== "whatsapp"
    )
      destinations.set(adId, "form");
  }
  const rows = insights
    .map((insight) => mapInsight(insight, statuses, destinations))
    .filter((row): row is MetaAdsDashboardRow => row !== null);
  if (rows.length !== insights.length) throw new MetaAdsApiError("invalid_data", 502);
  const accountName = rows[0]?.account || configuration.accountId;
  const data: MetaAdsDashboardData = {
    source: "meta_marketing_api",
    accountId: configuration.accountId,
    accountName,
    currency: "BRL",
    fetchedAt: now.toISOString(),
    range,
    rows,
  };
  cache = { key, expiresAt: now.getTime() + CACHE_TTL_MS, data };
  return data;
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
