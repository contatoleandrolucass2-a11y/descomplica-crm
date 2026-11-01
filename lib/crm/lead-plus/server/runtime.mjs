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
    const session = membershipSession(await store.listResources("users"), identity);
    return await serveRequest(request, "/api" + path, store, { context: async () => session });
  } catch (error) {
    return Response.json(
      {
        error:
          error.status === 403
            ? "Seu acesso ao DESCOMPLICA LEAD não está configurado."
            : "DESCOMPLICA LEAD temporariamente indisponível.",
      },
      { status: error.status === 403 ? 403 : 503, headers: { "cache-control": "no-store" } },
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
