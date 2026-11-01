import { createHash } from "node:crypto";

const cache = new Map();
const lifetime = 30_000;
const refreshCooldown = 5_000;
const maxPages = 20;
const maxCampaigns = 2_000;
const unavailable = () =>
  Object.assign(new Error("Não foi possível consultar as campanhas do Facebook."), {
    code: "META_CAMPAIGN_CATALOG_UNAVAILABLE",
    status: 503,
  });
const accountId = (value) => {
  if (typeof value !== "string") throw unavailable();
  const normalized = value.replace(/^act_/, "");
  if (!/^\d{1,32}$/.test(normalized)) throw unavailable();
  return normalized;
};
const label = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 500) throw unavailable();
  return value;
};
async function json(response) {
  if (!response.ok || !response.body) throw unavailable();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        throw unavailable();
      }
      chunks.push(Buffer.from(part.value));
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result) || result.error)
      throw unavailable();
    return result;
  } finally {
    reader.releaseLock();
  }
}
async function retrieve(configuration, fetcher) {
  const { account, token, version } = configuration;
  const request = async (campaigns, after) => {
    const url = new URL(
      `https://graph.facebook.com/${version}/act_${account}${campaigns ? "/campaigns" : ""}`,
    );
    url.searchParams.set("fields", campaigns ? "id,name,effective_status,objective" : "id,name");
    if (campaigns) url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    return json(
      await fetcher(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      }),
    );
  };
  const metadata = await request(false);
  if (accountId(metadata.id) !== account) throw unavailable();
  const name = label(metadata.name);
  const data = [];
  const seenIds = new Set();
  const seenCursors = new Set();
  let after;
  for (let page = 0; page < maxPages; page++) {
    const response = await request(true, after);
    if (!Array.isArray(response.data)) throw unavailable();
    for (const campaign of response.data) {
      if (
        !campaign ||
        typeof campaign.id !== "string" ||
        !/^\d{1,64}$/.test(campaign.id) ||
        seenIds.has(campaign.id)
      )
        throw unavailable();
      if (campaign.account_id !== undefined && accountId(campaign.account_id) !== account)
        throw unavailable();
      if (
        typeof campaign.effective_status !== "string" ||
        !/^[A-Z_]{1,64}$/.test(campaign.effective_status)
      )
        throw unavailable();
      seenIds.add(campaign.id);
      data.push({
        id: campaign.id,
        name: label(campaign.name),
        status: campaign.effective_status,
        account_id: account,
        account_name: name,
      });
      if (data.length > maxCampaigns) throw unavailable();
    }
    if (
      response.paging !== undefined &&
      (!response.paging || typeof response.paging !== "object" || Array.isArray(response.paging))
    )
      throw unavailable();
    if (
      response.paging?.next !== undefined &&
      (typeof response.paging.next !== "string" || !response.paging.next)
    )
      throw unavailable();
    if (!response.paging?.next) {
      return {
        available: true,
        data,
        account: { id: account, name },
        business: { id: "310106776631136", name: "BM MÃE 2" },
      };
    }
    // Only the cursor is used. Never follow an upstream next URL, even a Graph URL.
    const cursor = response.paging.cursors?.after;
    if (
      typeof response.paging.next !== "string" ||
      typeof cursor !== "string" ||
      !cursor ||
      cursor.length > 4096 ||
      /[\x00-\x1f\x7f]/.test(cursor) ||
      cursor.includes(token) ||
      seenCursors.has(cursor)
    )
      throw unavailable();
    seenCursors.add(cursor);
    after = cursor;
  }
  throw unavailable(); // A truncated catalogue must never masquerade as complete.
}

/** Read-only campaign metadata from the metrics credential, without changing its configuration. */
export async function fetchMetaCampaignCatalog(env, fetcher = fetch, { refresh = false } = {}) {
  try {
    const account = accountId(env.META_ADS_ACCOUNT_ID);
    const token = env.META_ADS_ACCESS_TOKEN;
    const version = env.META_ADS_API_VERSION;
    if (
      typeof token !== "string" ||
      !token ||
      token.length > 16384 ||
      /[\s\x00-\x1f\x7f]/.test(token) ||
      typeof version !== "string" ||
      !/^v\d{1,2}\.\d{1,2}$/.test(version)
    )
      throw unavailable();
    const key = createHash("sha256")
      .update(JSON.stringify([token, account, version]))
      .digest("hex");
    let entry = cache.get(key);
    const now = Date.now();
    if (entry?.inFlight) return structuredClone(await entry.inFlight);
    if (
      entry?.value &&
      entry.expires > now &&
      (!refresh || now - entry.refreshedAt < refreshCooldown)
    )
      return structuredClone(entry.value);
    if (!entry) {
      if (cache.size >= 64) {
        const removable = [...cache.entries()].find(([, item]) => !item.inFlight);
        if (removable) cache.delete(removable[0]);
        else throw unavailable();
      }
      entry = { value: null, expires: 0, refreshedAt: 0, inFlight: null };
      cache.set(key, entry);
    }
    const inFlight = retrieve({ account, token, version }, fetcher);
    entry.inFlight = inFlight;
    if (refresh) entry.refreshedAt = now;
    try {
      const value = await inFlight;
      entry.value = value;
      entry.expires = Date.now() + lifetime;
      return structuredClone(value);
    } finally {
      entry.inFlight = null;
    }
  } catch {
    throw unavailable();
  }
}
