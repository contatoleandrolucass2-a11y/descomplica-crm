import { resolveFormRoute } from "./meta-connection.mjs";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

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
    const route = await resolveFormRoute(store, env, job);
    const url = new URL(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${encodeURIComponent(job.external_id)}`,
    );
    url.searchParams.set("fields", "id,created_time,ad_id,form_id,field_data");
    if (env.META_APP_SECRET)
      url.searchParams.set(
        "appsecret_proof",
        createHmac("sha256", env.META_APP_SECRET).update(env.META_PAGE_ACCESS_TOKEN).digest("hex"),
      );
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!response.ok)
      throw Object.assign(new Error("Graph API recusou a consulta."), {
        code: "META_HTTP_" + response.status,
      });
    const result = await response.json();
    if (String(result.id) !== job.external_id || !Array.isArray(result.field_data))
      throw Object.assign(new Error("Resposta Meta inválida."), {
        code: "META_INVALID_RESPONSE",
      });
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
    const saved = await store.createLead(
      {
        name: String(
          fields.full_name ||
            [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
            "Lead Meta",
        ).slice(0, 160),
        phone,
        email,
        product: route?.product || (job.form_id ? "Formulário " + job.form_id : "Formulário Meta"),
        ...(route?.owner_id ? { owner_id: route.owner_id } : {}),
        source: "facebook",
        external_id: job.external_id,
        attribution: {
          delivery_connector: "meta_direct",
          page_id: job.page_id,
          form_id: job.form_id,
          ad_id: job.ad_id,
          ...(Number.isFinite(Date.parse(result.created_time))
            ? { external_created_at: new Date(result.created_time).toISOString() }
            : {}),
        },
      },
      "meta:" + job.external_id,
      null,
      route?.permittedOwners || null,
    );
    await store.completeMeta(job.id, saved.lead.id);
  } catch (error) {
    await store.failMeta(job, error.code || "META_PROCESSING_FAILED");
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
