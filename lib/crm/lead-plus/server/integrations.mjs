import { readCampaignSelection } from "./meta-campaign-selection.mjs";
import { resolveFormRoute } from "./meta-connection.mjs";
import { createHmac, timingSafeEqual } from "node:crypto";

export function validSignature(raw, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || "")) return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    createHmac("sha256", secret).update(raw).digest(),
  );
}
export const providers = ["facebook"];
export function metaPageIds(env) {
  return new Set(
    String(env.META_PAGE_IDS || env.META_PAGE_ID || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d{1,64}$/.test(id)),
  );
}
export async function integrationStatus(store, env, ownerIds = null) {
  const received = (await store.leads()).filter(
    (lead) =>
      lead.source === "facebook" &&
      lead.attribution?.delivery_connector === "meta_direct" &&
      (!ownerIds || ownerIds.has(lead.owner_id)),
  );
  const configured = !!(
    env.META_APP_SECRET &&
    env.META_VERIFY_TOKEN &&
    env.META_PAGE_ACCESS_TOKEN &&
    /^v\d+\.\d+$/.test(env.META_GRAPH_VERSION || "") &&
    metaPageIds(env).size
  );
  return [
    {
      provider: "facebook",
      transport: "meta_direct",
      status: configured ? "configured" : "missing_credentials",
      connected: false,
      total_received: received.length,
      last_received_at: received[0]?.created_at || null,
      events: received.slice(0, 50).map((lead) => ({
        provider: "facebook",
        external_id: lead.external_id,
        status: "received",
        received_at: lead.created_at,
      })),
    },
  ];
}
export async function receiveMeta(store, payload, env) {
  if (!payload || payload.object !== "page" || !Array.isArray(payload.entry))
    throw Object.assign(new Error("Evento Meta inválido."), { status: 422 });
  const jobs = [];
  for (const entry of payload.entry) {
    if (!entry || !metaPageIds(env).has(String(entry.id)))
      throw Object.assign(new Error("Página não autorizada."), { status: 403 });
    if (entry.changes !== undefined && !Array.isArray(entry.changes))
      throw Object.assign(new Error("Alterações Meta inválidas."), { status: 422 });
    for (const change of entry.changes || []) {
      if (!change || change.field !== "leadgen") continue;
      const v = change.value;
      if (!v || !/^[0-9]{1,64}$/.test(String(v.leadgen_id || "")))
        throw Object.assign(new Error("leadgen_id inválido."), { status: 422 });
      if (v.page_id && String(v.page_id) !== String(entry.id))
        throw Object.assign(new Error("Página não autorizada."), {
          status: 403,
        });
      jobs.push({
        external_id: String(v.leadgen_id),
        page_id: String(entry.id),
        form_id: v.form_id ? String(v.form_id) : null,
        ad_id: v.ad_id ? String(v.ad_id) : null,
      });
    }
  }
  return store.enqueueMeta(jobs);
}
export async function processMeta(store, env, fetcher = fetch) {
  if (
    !env.META_PAGE_ACCESS_TOKEN ||
    !env.META_GRAPH_VERSION ||
    !/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION)
  )
    return false;
  const job = await store.claimMeta();
  if (!job) return false;
  try {
    if (!metaPageIds(env).has(String(job.page_id)))
      throw Object.assign(new Error("Página não autorizada."), { code: "META_UNAUTHORIZED_PAGE" });
    const selected = async (campaignId) =>
      (await readCampaignSelection(store)).campaign_ids.includes(campaignId);
    const initialSelection = await readCampaignSelection(store);
    if (!initialSelection.campaign_ids.length) {
      await store.ignoreMeta(job.id);
      return true;
    }
    const metadataFields = "id,ad_id,form_id,campaign_id,campaign_name,is_organic";
    const graph = async (id, fields) => {
      const url = new URL(
        `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${encodeURIComponent(id)}`,
      );
      url.searchParams.set("fields", fields);
      if (env.META_APP_SECRET)
        url.searchParams.set(
          "appsecret_proof",
          createHmac("sha256", env.META_APP_SECRET)
            .update(env.META_PAGE_ACCESS_TOKEN)
            .digest("hex"),
        );
      const response = await fetcher(url, {
        headers: { Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}` },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!response.ok)
        throw Object.assign(Error("Graph API recusou a consulta."), {
          code: "META_HTTP_" + response.status,
        });
      return response.json();
    };
    const metadata = await graph(job.external_id, metadataFields);
    const invalid = () => {
      throw Object.assign(Error("Metadados Meta divergentes."), { code: "META_INVALID_RESPONSE" });
    };
    if (String(metadata.id) !== job.external_id) invalid();
    if (metadata.is_organic === true || !/^\d{1,64}$/.test(metadata.campaign_id || "")) {
      await store.ignoreMeta(job.id);
      return true;
    }
    if (!(await selected(metadata.campaign_id))) {
      await store.ignoreMeta(job.id);
      return true;
    }
    if (
      metadata.is_organic !== false ||
      typeof metadata.ad_id !== "string" ||
      !/^\d{1,64}$/.test(metadata.ad_id) ||
      typeof metadata.form_id !== "string" ||
      !/^\d{1,64}$/.test(metadata.form_id) ||
      (job.ad_id && metadata.ad_id !== job.ad_id) ||
      !job.form_id ||
      metadata.form_id !== job.form_id
    )
      invalid();
    const form = await graph(metadata.form_id, "id,page_id,name");
    if (String(form.id) !== metadata.form_id || String(form.page_id) !== job.page_id) invalid();
    let route;
    try {
      route = await resolveFormRoute(store, env, job);
    } catch (error) {
      if (error.code !== "META_FORM_ROUTE_MISSING") throw error;
    }
    const masters = (await store.listResources("users")).filter(
      (user) => user.active === true && ["admin", "superintendent", "manager"].includes(user.role),
    );
    const permittedOwners = new Set(
      masters
        .filter((user) =>
          route?.owner_id
            ? user.id === route.owner_id
            : !route?.permittedOwners || route.permittedOwners.has(user.id),
        )
        .map((user) => user.id),
    );
    if (!permittedOwners.size)
      throw Object.assign(Error("Nenhum master ativo disponível."), {
        code: "META_MASTER_UNAVAILABLE",
      });
    if (!(await selected(metadata.campaign_id))) {
      await store.ignoreMeta(job.id);
      return true;
    }
    const result = await graph(job.external_id, metadataFields + ",created_time,field_data");
    if (
      String(result.id) !== job.external_id ||
      !Array.isArray(result.field_data) ||
      result.campaign_id !== metadata.campaign_id ||
      result.ad_id !== metadata.ad_id ||
      result.form_id !== metadata.form_id ||
      result.is_organic !== false
    )
      invalid();
    if (!(await selected(metadata.campaign_id))) {
      await store.ignoreMeta(job.id);
      return true;
    }
    const fields = Object.fromEntries(result.field_data.map((f) => [f.name, f.values?.[0] || ""]));
    const phone = normalizePhone(fields.phone_number || "");
    const candidateEmail = String(fields.email || "")
      .trim()
      .toLowerCase();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail) ? candidateEmail : "";
    if (!phone && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Object.assign(new Error("Contato ausente."), {
        code: "META_INVALID_CONTACT",
      });
    const saved = await store.createMetaLead(
      {
        name: String(
          fields.full_name ||
            [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
            "Lead Meta",
        ).slice(0, 160),
        phone,
        email,
        product:
          route?.product ||
          String(form.name || metadata.campaign_name || "Formulário " + job.form_id).slice(0, 250),
        ...(route?.owner_id ? { owner_id: route.owner_id } : {}),
        source: "facebook",
        external_id: job.external_id,
        attribution: {
          delivery_connector: "meta_direct",
          page_id: job.page_id,
          form_id: job.form_id,
          ad_id: metadata.ad_id,
          campaign_id: metadata.campaign_id,
          campaign_name: String(metadata.campaign_name || "").slice(0, 250),
          ...(Number.isFinite(Date.parse(result.created_time))
            ? { external_created_at: new Date(result.created_time).toISOString() }
            : {}),
        },
      },
      "meta:" + job.external_id,
      permittedOwners,
    );
    await store.completeMeta(job.id, saved.lead.id);
  } catch (error) {
    if (error.code === "META_CAMPAIGN_NOT_SELECTED") await store.ignoreMeta(job.id);
    else await store.failMeta(job, error.code || "META_PROCESSING_FAILED");
  }
  return true;
}
export function normalizePhone(value) {
  let digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return "";
  return "+" + digits;
}
