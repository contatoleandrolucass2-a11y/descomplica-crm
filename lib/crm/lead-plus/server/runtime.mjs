import { resolveViewMember, viewableMembers } from "./view-as.mjs";
import { runLeadRequestAuditContext } from "./request-audit-context.mjs";
import { operationPage, operationPermissions } from "./access.mjs";
import { intersectPermissions, intersectGranularPermissions } from "./access.mjs";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createPool, postgresStore } from "./postgres.mjs";
import { createApp } from "./app.mjs";
import { c2sFlags, c2sPermissions } from "./permissions.mjs";

const denied = () =>
  Object.assign(Error("Seu acesso ao DESCOMPLICA LEAD não está configurado."), { status: 403 });
/** Membership comes exclusively from the operational database, never from client input or a CRM role-name heuristic. */
export function membershipSession(users, identity) {
  const matches = users.filter((user) => user.auth_user_id === identity.id);
  if (matches.length !== 1) throw denied();
  const user = matches[0];
  if (user.active !== true || !["admin", "superintendent", "manager", "broker"].includes(user.role))
    throw denied();
  const scope =
    user.role === "manager"
      ? user.team
        ? "team"
        : "self"
      : user.role === "broker"
        ? "self"
        : "all";
  const effectiveRole = user.role === "manager" && scope === "self" ? "broker" : user.role;
  return {
    csrf: createHash("sha256")
      .update("lead-plus-csrf:" + identity.token)
      .digest("hex"),
    preview: false,
    user: {
      id: user.id,
      auth_id: identity.id,
      name: user.name,
      email: identity.email,
      role: user.role,
      team: user.team || "",
      scope,
      permissions: intersectGranularPermissions(
        intersectPermissions(c2sPermissions(effectiveRole), identity.authorizedPages || []),
        identity.canonicalPermissions || [],
      ),
      host_pages: identity.authorizedPages || [],
      c2s_flags: c2sFlags(effectiveRole),
    },
  };
}
let singleton;
export function getLeadPlusStore() {
  if (!singleton) {
    // This service must never inherit the CRM database as a fallback.
    if (!process.env.LEAD_DB_URL || process.env.LEAD_DB_PROJECT_REF !== "xwtasgjnkctyxokxjykk") {
      throw Object.assign(Error("Banco operacional do LEAD+ não configurado."), { status: 503 });
    }
    singleton = postgresStore(createPool({ ...process.env, SUPABASE_DB_URL: undefined }));
  }
  return singleton;
}
function runtimeEnvironment() {
  const env = {
    ...process.env,
    C2S_LOCAL_PREVIEW: "0",
    LEAD_DEMO_MODE: "0",
    NODE_ENV: "production",
    META_REQUIRE_FORM_ROUTE: "1",
  };
  // Only an explicitly configured route file is read. Never load developer .env files in production.
  if (env.META_FORM_ROUTES_FILE)
    env.META_FORM_ROUTES_JSON = JSON.stringify(
      JSON.parse(readFileSync(env.META_FORM_ROUTES_FILE, "utf8")),
    );
  return env;
}
let workerApp;
export async function tickLeadPlus() {
  if (!workerApp)
    workerApp = createApp(getLeadPlusStore(), runtimeEnvironment(), {
      auth: {
        context: async () => {
          throw denied();
        },
      },
    });
  return workerApp.tick();
}
export async function handleMetaWebhook(request, dependencies = {}) {
  if (!["GET", "POST"].includes(request.method)) return new Response(null, { status: 405 });
  try {
    return await serveRequest(request, "/webhooks/meta", dependencies.store || getLeadPlusStore(), {
      context: async () => {
        throw denied();
      },
    });
  } catch {
    return Response.json(
      { error: "Recebimento Meta temporariamente indisponível." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
export async function handleLeadPlus(request, path, identity, dependencies = {}) {
  if (
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path) ||
    /^\/(demo|auth|webhooks)(\/|$)/.test(path)
  ) {
    return Response.json({ error: "Rota indisponível." }, { status: 404 });
  }
  try {
    const store = dependencies.store || getLeadPlusStore();
    const users = await store.listResources("users");
    const real = membershipSession(users, identity);
    const actor = users.find((user) => user.id === real.user.id);
    const target = resolveViewMember(users, actor, request.headers.get("x-lead-view-as"));
    const active = target.id !== actor.id;
    if (active && !real.user.permissions.includes("users.view")) throw denied();
    let session = real;
    let canonical = identity;
    if (active) {
      if (typeof dependencies.resolveViewTarget !== "function") throw denied();
      canonical = await dependencies.resolveViewTarget(target.auth_user_id);
      if (!canonical || canonical.id !== target.auth_user_id) throw denied();
      const viewed = membershipSession(users, { ...canonical, token: identity.token });
      const realPermissions = new Set(real.user.permissions);
      session = {
        ...viewed,
        csrf: real.csrf,
        user: {
          ...viewed.user,
          auth_id: identity.id,
          viewed_auth_id: canonical.id,
          permissions: viewed.user.permissions.filter((permission) =>
            realPermissions.has(permission),
          ),
          host_pages: viewed.user.host_pages.filter((page) => real.user.host_pages.includes(page)),
        },
      };
    }
    const required = operationPermissions(path, request.method);
    const page = operationPage(path, request.method);
    if (
      active &&
      (!required ||
        !page ||
        !session.user.host_pages.includes(page) ||
        !required.every((permission) =>
          (canonical.canonicalPermissions || []).includes(permission),
        ))
    )
      throw denied();
    session = {
      ...session,
      actor: {
        id: actor.id,
        auth_id: identity.id,
        name: actor.name,
        email: identity.email,
        role: actor.role,
      },
      view_as: { active, target_id: target.id, target_name: target.name },
      viewable_users: real.user.permissions.includes("users.view")
        ? viewableMembers(users, actor)
        : viewableMembers(users, actor).filter((member) => member.id === actor.id),
    };
    if (path === "/crm-users" && request.method === "GET") {
      if (
        active ||
        actor.role !== "admin" ||
        !real.user.permissions.includes("users.view") ||
        typeof dependencies.loadCrmUsers !== "function"
      )
        throw denied();
      const query = new URL(request.url).searchParams;
      const result = await dependencies.loadCrmUsers(
        query.get("search") || "",
        Number(query.get("offset") || "0"),
      );
      return Response.json(result, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/crm-users/link" && request.method === "POST") {
      if (
        active ||
        actor.role !== "admin" ||
        !["users.manage", "crm.leads.settings.manage"].every((permission) =>
          (identity.canonicalPermissions || []).includes(permission),
        ) ||
        typeof dependencies.resolveViewTarget !== "function"
      )
        throw denied();
      if (request.headers.get("x-c2s-csrf") !== real.csrf) throw denied();
      if (Number(request.headers.get("content-length")) > 32768)
        throw Object.assign(Error("Invalid request"), { status: 422 });
      const input = await boundedLinkBody(request);
      if (
        !input ||
        Object.keys(input).some((key) => !["auth_user_id", "role", "version"].includes(key)) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          input.auth_user_id || "",
        ) ||
        !["admin", "superintendent", "manager", "broker"].includes(input.role) ||
        (input.version !== undefined && (!Number.isInteger(input.version) || input.version < 1))
      )
        throw Object.assign(Error("Invalid request"), { status: 422 });
      const source = await dependencies.resolveViewTarget(input.auth_user_id);
      if (!source || source.id !== input.auth_user_id || !source.email) throw denied();
      const matches = users.filter(
        (user) => user.id === input.auth_user_id || user.auth_user_id === input.auth_user_id,
      );
      if (matches.length > 1 || (matches[0] && matches[0].id !== input.auth_user_id))
        throw Object.assign(Error("Conflicting membership"), { status: 409 });
      const existing = matches[0];
      if (existing?.id === actor.id && input.role !== actor.role)
        throw Object.assign(Error("Não é possível alterar o próprio perfil de acesso."), {
          status: 403,
        });
      if (
        (existing && existing.version !== input.version) ||
        (!existing && input.version !== undefined)
      )
        throw Object.assign(Error("Conflicting membership"), { status: 409 });
      const { id: _id, version: _version, ...previous } = existing || {};
      void _id;
      void _version;
      const saved = await runLeadRequestAuditContext(session.actor, session.user, () =>
        store.saveResource(
          "users",
          source.id,
          {
            ...previous,
            auth_user_id: source.id,
            email: source.email,
            name: existing?.name || source.email,
            phone: existing?.phone || "",
            team: existing?.team || "",
            active: existing ? existing.active === true : true,
            role: input.role,
          },
          input.version,
        ),
      );
      return Response.json(saved, { headers: { "cache-control": "no-store" } });
    }
    const privateResource = path.match(
      /^\/resources\/(profile|templates|training|exports|lead-preferences)\/([a-zA-Z0-9-]+)$/,
    );
    if (privateResource && privateResource[2] !== session.user.id) {
      return Response.json(
        { error: "Registro privado de outro usuário." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    return await runLeadRequestAuditContext(session.actor, session.user, () =>
      serveRequest(request, "/api" + path, store, { context: async () => session }),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error?.status === 403
            ? "Seu acesso ao DESCOMPLICA LEAD não está configurado."
            : "DESCOMPLICA LEAD temporariamente indisponível.",
      },
      {
        status: [403, 409, 422].includes(error?.status) ? error.status : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
async function serveRequest(request, path, store, auth) {
  const chunks = [];
  let bytes = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        return Response.json({ error: "Arquivo excede 1 MB." }, { status: 413 });
      }
      chunks.push(Buffer.from(result.value));
    }
  }
  const req = Readable.from(chunks);
  req.url = path + new URL(request.url).search;
  req.method = request.method;
  req.headers = {
    host: "localhost:3001",
    "content-type": request.headers.get("content-type") || "application/json",
    "x-hub-signature-256": request.headers.get("x-hub-signature-256") || "",
    "x-c2s-csrf": request.headers.get("x-c2s-csrf") || "",
    "idempotency-key": request.headers.get("idempotency-key") || "",
  };
  req.socket = { remoteAddress: "127.0.0.1" };
  let status = 500;
  let headers = {};
  let payload = "";
  const res = {
    writeHead(code, values) {
      status = code;
      headers = values;
    },
    setHeader(key, value) {
      headers[key] = value;
    },
    end(value = "") {
      payload = value;
    },
  };
  const app = createApp(store, runtimeEnvironment(), { auth });
  await app.handler(req, res);
  return new Response(payload, {
    status,
    headers: { ...headers, "cache-control": "no-store", pragma: "no-cache" },
  });
}

async function boundedLinkBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(Error("Invalid request"), { status: 422 });
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 32768) {
      await reader.cancel();
      throw Object.assign(Error("Invalid request"), { status: 422 });
    }
    chunks.push(Buffer.from(part.value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(Error("Invalid request"), { status: 422 });
  }
}
