import { operationAnalytics } from "./analytics.mjs";
import { randomUUID, createHash } from "node:crypto";

import { propertySchema, invoiceSchema } from "./schemas.mjs";
import { c2sFlags, c2sPermissionLabels, scopedResourceId } from "./permissions.mjs";
import { z } from "zod";
import { stages } from "./postgres.mjs";
import { fetchMetaCampaignCatalog } from "./meta-campaign-catalog.mjs";
import {
  readCampaignSelection,
  saveCampaignSelection,
  validateCampaignIds,
} from "./meta-campaign-selection.mjs";
import {
  validSignature,
  receiveMeta,
  processMeta,
  metaPageIds,
  normalizePhone,
  integrationStatus,
} from "./integrations.mjs";

const text = z.string().trim().max(2000);
const leadSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().toLowerCase().email().or(z.literal("")).optional().default(""),
    phone: z.string().max(40).optional().default(""),
    product: z.string().trim().min(1).max(250),
    source: z.enum(["manual", "facebook", "instagram", "webhook", "csv", "c2s"]).default("manual"),
    external_id: z.string().min(1).max(250).optional(),
    owner_id: z.string().max(100).optional(),
    message: text.optional(),
    attribution: z.record(z.string(), z.string().max(250)).optional(),
  })
  .strict()
  .transform((v) => ({ ...v, phone: normalizePhone(v.phone) }))
  .refine((v) => !!(v.email || v.phone), {
    message: "Informe e-mail ou telefone válido.",
  });
const updateSchema = z
  .object({
    version: z.number().int().positive(),
    stage: z.number().int().min(0).max(5).optional(),
    archived: z.boolean().optional(),
    archive_reason: z.string().trim().min(1).max(250).optional(),
    owner_id: z.string().max(100).optional(),
    value: z.number().min(0).max(1e12).optional(),
    confirm_sale: z.boolean().optional(),
    negotiation_type: z.enum(["Indefinido", "Compra", "Locação"]).optional(),
    next_contact_at: z.string().datetime().nullable().optional(),
  })
  .strict();
const allowedKinds = [
  "users",
  "tags",
  "alerts",
  "referrals",
  "settings",
  "profile",
  "templates",
  "queues",
  "teams",
  "portals",
  "archive-reasons",
  "properties",
  "invoices",
  "training",
  "exports",
  "lead-preferences",
];
const userSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.string().email(),
    phone: z.string().max(40),
    team: z.string().max(160),
    active: z.boolean(),
  })
  .strict();
function parseJSON(raw) {
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON inválido."), { status: 400 });
  }
}
async function body(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Corpo excede 1 MB."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function createApp(store, env = process.env, dependencies = {}) {
  const auth = dependencies.auth;
  if (!auth) throw Error("Host authentication is required.");
  const allowedOrigins = new Set(
    dependencies.allowedOrigins ?? [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ],
  );
  let working = false;
  const tick = async () => {
    if (working) return;
    working = true;
    let processed = 0;
    try {
      while (processed < 25 && (await processMeta(store, env, dependencies.fetcher || fetch)))
        processed++;
    } finally {
      working = false;
    }
    if (processed === 25)
      setImmediate(() => {
        void tick().catch(() => {});
      });
  };
  const handler = async (req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      });
      res.end(JSON.stringify(payload));
    };
    try {
      if (!/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(req.headers.host || ""))
        return send(403, { error: "Host não autorizado." });
      if (req.headers.origin && !allowedOrigins.has(req.headers.origin))
        return send(403, { error: "Origem não autorizada." });
      const url = new URL(req.url, "http://localhost:3001"),
        p = url.pathname,
        method = req.method;
      if (p === "/webhooks/meta") {
        if (method === "GET") {
          if (!env.META_VERIFY_TOKEN)
            return send(503, { error: "A conexão direta com a Meta ainda não está configurada." });
          const challenge = url.searchParams.get("hub.challenge");
          if (
            url.searchParams.get("hub.mode") !== "subscribe" ||
            url.searchParams.get("hub.verify_token") !== env.META_VERIFY_TOKEN ||
            !challenge ||
            challenge.length > 512
          )
            return send(403, { error: "Verificação Meta inválida." });
          res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          });
          return res.end(challenge);
        }
        if (method === "POST") {
          if (
            !env.META_APP_SECRET ||
            !env.META_PAGE_ACCESS_TOKEN ||
            !/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION || "") ||
            !metaPageIds(env).size
          )
            return send(503, { error: "A conexão direta com a Meta ainda não está configurada." });
          const raw = await body(req);
          if (!validSignature(raw, req.headers["x-hub-signature-256"], env.META_APP_SECRET))
            return send(401, { error: "Assinatura Meta inválida." });
          const receipt = await receiveMeta(store, parseJSON(raw), env);
          send(200, receipt);
          void tick().catch(() => {});
          return;
        }
      }
      if (!p.startsWith("/api/")) return send(404, { error: "Rota não encontrada." });
      const session = await auth.context(req, res);
      if (method === "GET" && p === "/api/session")
        return send(200, {
          ...session,
          mode: session.demo ? "local-demo" : session.preview ? "local-preview" : "supabase-auth",
        });
      if (!["GET", "HEAD"].includes(method) && req.headers["x-c2s-csrf"] !== session.csrf)
        return send(403, {
          error: "Sessão local inválida. Recarregue a página.",
        });
      if (!session.user && !session.preview)
        return send(401, {
          error: "Acesse o DESCOMPLICA LEAD pela sessão do CRM.",
        });
      const actor = session.user || {
        id: "local-preview",
        auth_id: null,
        permissions: session.permissions,
      };
      const can = (permission) => actor.permissions.includes(permission);
      const allowed = (specific) =>
        can(specific) || (!actor.c2s_flags && can("crm.settings.manage"));
      const manager = actor.c2s_flags ? actor.c2s_flags.is_master : can("crm.settings.manage");
      if (p === "/api/demo/user" && method === "POST") {
        if (!auth.selectDemoUser)
          return send(404, {
            error: "Demonstração indisponível neste ambiente.",
          });
        const input = z
          .object({ id: z.string().min(1).max(100) })
          .strict()
          .parse(parseJSON(await body(req)));
        return send(200, await auth.selectDemoUser(req, res, input.id));
      }
      let usersForRequest;
      const readUsers = () => (usersForRequest ??= store.listResources("users"));
      const visibleOwners =
        actor.scope === "team"
          ? new Set(
              (await readUsers()).filter((user) => user.team === actor.team).map((user) => user.id),
            )
          : manager || actor.scope === "all"
            ? null
            : new Set([actor.id]);
      const withinScope = (lead) => !visibleOwners || visibleOwners.has(lead.owner_id);
      const leadScope = { ownerIds: visibleOwners ? [...visibleOwners] : null };
      if (p.startsWith("/api/admin/") && !can("admin.access"))
        return send(403, { error: "Acesso exclusivo do Admin do DESCOMPLICA LEAD." });
      if (p === "/api/admin/overview" && method === "GET") {
        const [leads, users, teams, properties] = await Promise.all([
          store.leads(),
          readUsers(),
          store.listResources("teams"),
          store.listResources("properties"),
        ]);
        return send(200, {
          totals: {
            leads: leads.length,
            users: users.length,
            teams: teams.length,
            properties: properties.length,
          },
          permissions: actor.permissions,
        });
      }
      if (p === "/api/permissions" && method === "GET") {
        const levels =
          actor.scope === "all"
            ? Object.fromEntries(
                [
                  ["Admin", "admin"],
                  ["Superintendente", "superintendent"],
                  ["Gerente", "manager"],
                  ["Corretor", "broker"],
                ].map(([label, role]) => [
                  label,
                  { ...c2sFlags(role), admin_access: role === "admin" },
                ]),
              )
            : {};
        return send(200, {
          labels: {
            ...c2sPermissionLabels,
            admin_access: "Administração exclusiva do DESCOMPLICA LEAD",
          },
          current: { ...actor.c2s_flags, admin_access: can("admin.access") },
          levels,
        });
      }
      if ((p === "/api/report-leads" || p === "/api/exports/leads") && method === "GET") {
        if (p === "/api/exports/leads" && actor.c2s_flags && !can("reports.export"))
          return send(403, { error: "Seu nível não pode extrair relatórios de leads." });
        return send(200, { data: (await store.leads(leadScope)).filter(withinScope) });
      }
      const resourceRights = {
        users: "users.manage",
        teams: "teams.manage",
        queues: "queues.manage",
        tags: "tags.manage",
        settings: "crm.settings.manage",
        portals: "portals.manage",
        "archive-reasons": "crm.settings.manage",
        alerts: "crm.settings.manage",
        properties: "properties.manage",
        exports: "reports.export",
      };
      const kindAtPath = p.match(/^\/api\/resources\/([a-z-]+)/)?.[1];
      if (
        method !== "GET" &&
        kindAtPath &&
        resourceRights[kindAtPath] &&
        !allowed(resourceRights[kindAtPath])
      )
        return send(403, { error: "Esta permissão está desativada para o seu nível no C2S." });
      if (p.startsWith("/api/resources/invoices") && !can("admin.access"))
        return send(403, {
          error: "Acesso financeiro restrito à administração.",
        });
      if (p === "/api/properties/import" && method === "POST") {
        if (!allowed("properties.manage"))
          return send(403, {
            error: "Somente a administração pode importar imóveis.",
          });
        const input = z
          .object({ properties: z.array(propertySchema).min(1).max(500) })
          .strict()
          .parse(parseJSON(await body(req)));
        return send(200, await store.importProperties(input.properties, actor));
      }
      if (method === "GET" && p === "/api/health")
        return send(200, {
          ok: true,
          ...(await store.health()),
          mode: "supabase-auth",
        });
      if (method === "GET" && p === "/api/leads") {
        const [leads, bucket, timing] = await Promise.all([
          store.leads(leadScope),
          store.bucketLeads(),
          store.bucketTimers(),
        ]);
        const timers = new Map(timing.map((timer) => [timer.id, timer]));
        const available = new Map(bucket.data.map((lead) => [lead.id, lead.bucket_available_at]));
        // The bucket has its own authorized claim contract. Merge its records without
        // loading the entire operational table for a broker's personal list.
        const visible = new Map(leads.filter(withinScope).map((lead) => [lead.id, lead]));
        for (const lead of bucket.data) if (!visible.has(lead.id)) visible.set(lead.id, lead);
        return send(200, {
          data: [...visible.values()]
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
            .map((lead) => ({
              ...lead,
              ...(timers.get(lead.id) || {}),
              ...(available.has(lead.id) ? { bucket_available_at: available.get(lead.id) } : {}),
            })),
          stages,
          server_time: new Date().toISOString(),
        });
      }
      if (method === "GET" && p === "/api/bucket") {
        const bucket = await store.bucketLeads();
        const policy = await store.bucketPolicy(undefined, actor.team || null);
        return send(200, {
          ...bucket,
          policy: { ...policy, enabled: policy.enabled || bucket.data.length > 0 },
        });
      }
      if (p === "/api/bucket/policy") {
        if (method === "GET")
          return send(
            200,
            await store.bucketPolicy(undefined, actor.scope === "team" ? actor.team : null),
          );
        if (method === "PUT") {
          if (!allowed("bucket.manage"))
            return send(403, { error: "Seu nível não pode editar o Bolsão." });
          const input = z
            .object({
              enabled: z.boolean(),
              timeout_minutes: z.number().int().min(1).max(525600),
              version: z.number().int().positive().nullable(),
            })
            .strict()
            .parse(parseJSON(await body(req)));
          await store.saveResource(
            "settings",
            scopedResourceId("bucket-policy", actor.scope === "team" ? actor.team : null),
            { enabled: input.enabled, timeout_minutes: input.timeout_minutes },
            input.version,
          );
          return send(
            200,
            await store.bucketPolicy(undefined, actor.scope === "team" ? actor.team : null),
          );
        }
      }
      const bucketMatch = p.match(/^\/api\/bucket\/([a-zA-Z0-9-]+)\/claim$/);
      if (bucketMatch && method === "POST") {
        if (!session.user)
          return send(401, {
            error:
              "O resgate exige a sessão real do usuário no CRM. Nenhum usuário é simulado na prévia.",
          });
        const input = z
          .object({
            version: z.number().int().positive(),
          })
          .strict()
          .parse(parseJSON(await body(req)));
        return send(
          200,
          await store.claimBucketLead(bucketMatch[1], {
            ...input,
            owner_id: actor.id,
            auth_user_id: actor.auth_id,
          }),
        );
      }
      if (method === "POST" && p === "/api/leads") {
        const input = leadSchema.parse(parseJSON(await body(req)));
        if (actor.scope === "team" || !manager) {
          if (actor.scope === "team" && input.owner_id && !visibleOwners.has(input.owner_id))
            return send(403, { error: "Responsável fora da sua equipe." });
          if (actor.scope !== "team" || !input.owner_id) input.owner_id = actor.id;
        }
        if (input.source === "facebook")
          return send(422, {
            error: "Leads Meta entram somente pelo webhook validado.",
          });
        const key = req.headers["idempotency-key"];
        if (key && !/^[a-zA-Z0-9:_-]{1,200}$/.test(key))
          return send(422, { error: "Chave de idempotência inválida." });
        const saved = await store.createLead(input, key);
        return send(saved.duplicate ? 200 : 201, saved);
      }
      const leadMatch = p.match(/^\/api\/leads\/([a-zA-Z0-9-]+)(\/activities)?$/);
      if (leadMatch) {
        const [, id, activities] = leadMatch;
        const current = await store.getLead(id);
        if (!current) return send(404, { error: "Lead não encontrado." });
        const managesLead = manager || (actor.scope === "team" && withinScope(current));
        if (!withinScope(current)) {
          const bucket = await store.bucketLeads();
          if (method !== "GET" || !bucket.data.some((lead) => lead.id === id))
            return send(403, {
              error: "Assuma o lead pelo Bolsão antes de alterar o atendimento.",
            });
        }
        if (activities && method === "GET")
          return send(200, {
            data: await store.activities(id),
          });
        if (activities && method === "POST") {
          const input = z
            .object({
              body: z.string().trim().min(1).max(4000),
              type: z.enum(["note", "call", "whatsapp", "visit"]).default("note"),
            })
            .strict()
            .parse(parseJSON(await body(req)));
          return send(
            201,
            await store.addActivity(id, input, {
              ...actor,
              canManage: managesLead,
            }),
          );
        }
        if (method === "GET") return send(200, await store.getLead(id));
        if (method === "PATCH" && !activities) {
          const input = updateSchema.parse(parseJSON(await body(req)));
          if (input.owner_id && visibleOwners && !visibleOwners.has(input.owner_id))
            return send(403, { error: "Responsável fora da sua equipe." });
          return send(200, await store.updateLead(id, input, { ...actor, canManage: managesLead }));
        }
      }
      const importMatch = p.match(/^\/api\/imports(?:\/([a-f0-9]{64})(?:\/(leads))?)?$/);
      if (importMatch) {
        if (!can("leads.create") && !can("crm.settings.manage"))
          return send(403, { error: "Você não pode importar leads." });
        const allJobs = await store.importJobs();
        const accessibleLeadIds = visibleOwners
          ? new Set((await store.leads(leadScope)).filter(withinScope).map((lead) => lead.id))
          : null;
        const jobs = allJobs.filter((job) => {
          if (
            accessibleLeadIds &&
            !job.deleted &&
            job.outcomes.some((row) => row.lead_id && !accessibleLeadIds.has(row.lead_id))
          )
            return false;
          if (actor.scope === "self") return job.actor_id === actor.id;
          if (actor.scope === "team") return job.actor_team === actor.team;
          return manager || job.actor_id === actor.id;
        });
        const [, id, remove] = importMatch;
        if (method === "GET") {
          if (id) {
            const job = jobs.find((job) => job.id === id);
            if (!job) return send(404, { error: "Importação não encontrada." });
            return send(200, await store.importJob(id));
          }
          return send(200, {
            data: jobs
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 20)
              .map(({ rows, ...summary }) => summary),
          });
        }
        if (method === "POST" && !id) {
          const input = z
            .object({
              filename: z.string().min(1).max(200),
              rows: z
                .array(z.array(z.string().max(2000)).min(1).max(50))
                .min(1)
                .max(501),
              has_header: z.boolean(),
              archived: z.boolean(),
              owner_id: z.string().max(100).default(""),
            })
            .strict()
            .parse(parseJSON(await body(req, 8 * 1024 * 1024)));
          const count = input.rows.length - Number(input.has_header);
          if (
            count < 1 ||
            count > 500 ||
            Buffer.byteLength(JSON.stringify(input.rows)) > 5 * 1024 * 1024
          )
            return send(422, { error: "Selecione entre 1 e 500 leads, em arquivo de até 5 MB." });
          const users = (await readUsers()).filter(
            (user) => !visibleOwners || visibleOwners.has(user.id),
          );
          if (input.owner_id && !users.some((user) => user.id === input.owner_id))
            return send(403, { error: "Responsável fora do seu acesso." });
          let jobId = createHash("sha256")
            .update(JSON.stringify({ actor: actor.id, ...input, filename: undefined }))
            .digest("hex");
          let previous = allJobs.find((job) => job.id === jobId);
          while (previous) {
            if (!jobs.some((job) => job.id === jobId))
              return send(403, { error: "Esta importação contém leads fora do seu acesso atual." });
            if (!previous.deleted && previous.status !== "Finalizado com erros") break;
            jobId = createHash("sha256")
              .update(jobId + previous.updated_at)
              .digest("hex");
            previous = allJobs.find((job) => job.id === jobId);
          }
          const job = await store.importSpreadsheet(jobId, input, users, {
            ...actor,
            canAssign: manager,
          });
          const { rows, ...summary } = job;
          return send(200, summary);
        }
        if (method === "DELETE" && id && remove) {
          if (!jobs.some((job) => job.id === id))
            return send(404, { error: "Importação não encontrada." });
          return send(200, await store.removeSpreadsheetLeads(id, actor, visibleOwners));
        }
        return send(405, { error: "Método não permitido." });
      }
      if (["/api/analytics", "/api/management"].includes(p) && method === "GET") {
        if (p === "/api/management" && !can("teams.view"))
          return send(403, { error: "Seu nível não possui acesso à Gestão." });
        if (!can("crm.dashboard.view"))
          return send(403, { error: "Seu nível não possui acesso aos dashboards." });
        const day = z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine(
            (value) =>
              !Number.isNaN(Date.parse(value)) &&
              new Date(value).toISOString().slice(0, 10) === value,
          );
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
          new Date(),
        );
        const defaultFrom = new Date(Date.parse(today + "T12:00:00Z") - 29 * 86400000)
          .toISOString()
          .slice(0, 10);
        const filters = z
          .object({
            from: day.default(defaultFrom),
            to: day.default(today),
            team: z.string().max(160).default(""),
            owner: z.string().max(100).default(""),
            source: z.string().max(100).default(""),
            negotiation: z.string().max(100).default(""),
            queue: z.string().max(250).default(""),
          })
          .strict()
          .parse(Object.fromEntries(url.searchParams));
        const span = Date.parse(filters.to) - Date.parse(filters.from);
        if (span < 0 || span > 365 * 86400000)
          return send(422, { error: "Selecione um período válido de até 366 dias." });
        const [allLeads, allUsers, bucket] = await Promise.all([
          store.leads({ ...leadScope, summary: true }),
          readUsers(),
          store.bucketLeads(),
        ]);
        const leads = allLeads.filter(withinScope);
        const users = allUsers.filter((user) => !visibleOwners || visibleOwners.has(user.id));
        const history = await store.analyticsHistory(leads.map((lead) => lead.id));
        return send(
          200,
          operationAnalytics({
            leads,
            users,
            ...history,
            bucketIds: new Set(bucket.data.filter(withinScope).map((lead) => lead.id)),
            filters,
          }),
        );
      }
      if (p === "/api/dashboard" && method === "GET") {
        if (store.dashboard) return send(200, await store.dashboard(leadScope));
        const leads = (await store.leads(leadScope)).filter((lead) => withinScope(lead)),
          active = leads.filter((l) => !l.archived);
        return send(200, {
          total: leads.length,
          active: active.length,
          archived: leads.length - active.length,
          stages: stages.map((name, stage) => ({
            name,
            count: active.filter((l) => l.stage === stage).length,
            value: active.filter((l) => l.stage === stage).reduce((n, l) => n + l.value, 0),
          })),
          sources: [...new Set(leads.map((l) => l.source))].map((name) => ({
            name,
            leads: leads.filter((l) => l.source === name).length,
            convertidos: leads.filter((l) => l.source === name && l.stage === 5).length,
          })),
        });
      }
      if (p === "/api/audit" && method === "GET" && !can("audit.view"))
        return send(403, {
          error: "Seu usuário não possui acesso à auditoria.",
        });
      if (p === "/api/audit" && method === "GET") {
        const scopedLeadIds = new Set(
          (await store.leads(leadScope)).filter(withinScope).map((lead) => lead.id),
        );
        const scopedTeamIds = new Set(
          (await store.listResources("teams"))
            .filter((team) => team.name === actor.team)
            .map((team) => team.id),
        );
        return send(200, {
          data: (await store.auditEntries()).filter((entry) => {
            if (!visibleOwners) return true;
            if (entry.entity === "lead") return scopedLeadIds.has(entry.entity_id);
            if (entry.entity === "users") return visibleOwners.has(entry.entity_id);
            if (entry.entity === "teams") return scopedTeamIds.has(entry.entity_id);
            return !!actor.team && entry.entity_id.endsWith(scopedResourceId("", actor.team));
          }),
        });
      }
      if (p === "/api/integrations/facebook/campaigns" && ["GET", "PUT"].includes(method)) {
        if (!allowed("crm.settings.manage") || actor.scope !== "all")
          return send(403, {
            error: "A seleção global de campanhas é restrita aos administradores autorizados.",
          });
        if (method === "GET") {
          const selection = await readCampaignSelection(store);
          const catalog = await fetchMetaCampaignCatalog(env, dependencies.fetcher || fetch, {
            refresh: url.searchParams.get("refresh") === "1",
          });
          return send(200, { ...catalog, selection });
        }
        const input = parseJSON(await body(req));
        const ids = validateCampaignIds(input?.campaign_ids);
        // Clearing the selection must remain possible when the external API is unavailable.
        const catalog = ids.length
          ? (await fetchMetaCampaignCatalog(env, dependencies.fetcher || fetch)).data
          : [];
        const selection = await saveCampaignSelection(store, input, catalog);
        return send(200, { selection });
      }
      if (p === "/api/integrations" && method === "GET" && !allowed("crm.settings.manage"))
        return send(403, { error: "Seu nível não pode consultar integrações." });
      if (p === "/api/integrations" && method === "GET") {
        const data = await integrationStatus(store, env, visibleOwners);
        return send(200, {
          data: data.map(({ events, ...provider }) => provider),
          events: data.flatMap((provider) => provider.events),
        });
      }
      const resourceMatch = p.match(/^\/api\/resources\/([a-z-]+)(?:\/([a-zA-Z0-9-]+))?$/);
      if (resourceMatch) {
        const [, kind, id] = resourceMatch;
        if (kind === "settings" && id === "meta-campaign-selection" && method !== "GET")
          return send(403, {
            error: "Altere esta configuração pela seleção de campanhas do Facebook.",
          });
        if (!allowedKinds.includes(kind)) return send(404, { error: "Recurso não encontrado." });
        if (
          ["profile", "templates", "training", "exports", "lead-preferences"].includes(kind) &&
          id &&
          id !== actor.id
        )
          return send(403, {
            error: "Registro de outro usuário não pode ser alterado.",
          });
        if (method === "GET") {
          const rows = await store.listResources(kind);
          if (
            ["settings", "queues", "tags", "portals", "archive-reasons", "alerts"].includes(kind) &&
            actor.c2s_flags &&
            !actor.c2s_flags.is_master
          )
            return send(403, { error: "Configuração restrita aos usuários master deste nível." });
          if (
            actor.scope === "team" &&
            ["settings", "queues", "tags", "portals", "archive-reasons", "alerts"].includes(kind)
          ) {
            const suffix = scopedResourceId("", actor.team);
            const combined = new Map(
              rows
                .filter((row) => !row.id.includes("--"))
                .map((row) => [row.id, { ...row, version: 0, inherited: true }]),
            );
            for (const row of rows.filter((row) => row.id.endsWith(suffix))) {
              const id = row.id.slice(0, -suffix.length);
              combined.set(id, { ...row, id, inherited: false });
            }
            return send(200, { data: [...combined.values()] });
          }
          if (kind === "users" && !can("users.view"))
            return send(200, { data: rows.filter((user) => user.id === actor.id) });
          if (kind === "users" && visibleOwners)
            return send(200, {
              data: rows.filter((user) => visibleOwners.has(user.id)),
            });
          if (kind === "teams" && actor.c2s_flags && !can("teams.view"))
            return send(403, { error: "Seu nível não pode consultar hierarquias." });
          if (kind === "teams" && actor.scope && actor.scope !== "all")
            return send(200, {
              data: rows.filter((team) => team.name === actor.team),
            });
          return send(200, {
            data:
              (kind === "users" && !can("users.view")) ||
              ["profile", "templates", "training", "exports", "lead-preferences"].includes(kind)
                ? rows.filter((row) => row.id === actor.id)
                : rows,
          });
        }
        if (method === "PUT" && id) {
          const raw = parseJSON(await body(req));
          const { version, ...data } = raw;
          if (actor.scope === "team" && ["users", "teams"].includes(kind)) {
            const existing = (await store.listResources(kind)).find((row) => row.id === id);
            if (
              kind === "users" &&
              ((existing && existing.team !== actor.team) || data.team !== actor.team)
            )
              return send(403, { error: "Você só pode editar usuários da sua equipe." });
            if (
              kind === "teams" &&
              ((existing && existing.name !== actor.team && existing.parent !== actor.team) ||
                (!existing && data.parent !== actor.team))
            )
              return send(403, {
                error: "Você só pode editar sua hierarquia e equipes subordinadas.",
              });
          }
          if (
            kind === "users" &&
            [actor.id, session.actor?.id].includes(id) &&
            data.active === false
          )
            return send(403, { error: "Você não pode desativar seu próprio usuário." });
          if (kind === "lead-preferences")
            z.object({ favorites: z.array(z.string().uuid()).max(10000) })
              .strict()
              .parse(data);
          if (kind === "users") {
            userSchema.parse(data);
            const existing = (await store.listResources("users")).find((row) => row.id === id);
            if (!existing?.auth_user_id)
              return send(422, { error: "Vincule um usuário já cadastrado no CRM." });
            if (data.email !== existing.email || data.name !== existing.name)
              return send(422, {
                error: "Nome e e-mail são mantidos pelo cadastro de usuários do CRM.",
              });
            if (existing?.auth_user_id) data.auth_user_id = existing.auth_user_id;
            // Membership and role are provisioned separately; ordinary user edits cannot remove or change them.
            if (existing?.role) data.role = existing.role;
          } else if (kind === "properties") propertySchema.parse(data);
          else if (kind === "invoices") invoiceSchema.parse(data);
          else if (["tags", "alerts", "referrals"].includes(kind))
            z.object({ row: z.array(z.string().max(2000)).min(1).max(20) })
              .strict()
              .parse(data);
          else if (JSON.stringify(data).length > 50000)
            return send(422, { error: "Configuração excede o limite." });
          const scopedKind =
            ["settings", "queues", "tags", "portals", "archive-reasons", "alerts"].includes(kind) &&
            actor.scope === "team";
          return send(200, {
            ...(await store.saveResource(
              kind,
              scopedKind ? scopedResourceId(id, actor.team) : id,
              data,
              version,
            )),
            id,
          });
        }
        if (method === "DELETE" && id) {
          if (kind === "users" && [actor.id, session.actor?.id].includes(id))
            return send(403, { error: "Você não pode excluir seu próprio usuário." });
          if (actor.scope === "team" && ["users", "teams"].includes(kind)) {
            const existing = (await store.listResources(kind)).find((row) => row.id === id);
            if (
              !existing ||
              (kind === "users"
                ? existing.team !== actor.team
                : existing.name !== actor.team && existing.parent !== actor.team)
            )
              return send(403, { error: "Registro fora da sua hierarquia." });
          }
          const version = Number(url.searchParams.get("version"));
          await store.deleteResource(
            kind,
            actor.scope === "team" &&
              ["settings", "queues", "tags", "portals", "archive-reasons", "alerts"].includes(kind)
              ? scopedResourceId(id, actor.team)
              : id,
            version,
          );
          return send(200, { deleted: true });
        }
      }
      return send(404, { error: "Rota não encontrada." });
    } catch (error) {
      if (error instanceof z.ZodError)
        return send(422, {
          error: "Dados inválidos.",
          fields: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      return send(error.status || 500, {
        error: error.status ? error.message : "Falha interna ao processar a solicitação.",
      });
    }
  };
  return { handler, store, tick };
}
