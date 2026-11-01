import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const keys = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "META_PAGE_ACCESS_TOKEN",
  "META_PAGE_IDS",
  "META_GRAPH_VERSION",
  "META_CALLBACK_URL",
  "META_REQUIRE_FORM_ROUTE",
  "META_FORM_ROUTES_FILE",
];
export function loadMetaEnvironment(env = process.env) {
  const path = env.META_ENV_FILE || ".env.meta-lead.local";
  const configured = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
  const result = { ...env };
  for (const key of keys) if (configured[key] !== undefined) result[key] = configured[key];
  if (result.META_FORM_ROUTES_FILE) {
    try {
      result.META_FORM_ROUTES_JSON = JSON.stringify(
        JSON.parse(readFileSync(result.META_FORM_ROUTES_FILE, "utf8")),
      );
    } catch {
      throw Error("O arquivo de rotas de formulários da Meta está ausente ou inválido.");
    }
  }
  return result;
}
export function formRoutes(env) {
  let routes;
  try {
    routes = JSON.parse(env.META_FORM_ROUTES_JSON || "[]");
  } catch {
    throw Error("Rotas de formulários inválidas.");
  }
  if (!Array.isArray(routes) || routes.length > 500) throw Error("Rotas de formulários inválidas.");
  const seen = new Set();
  for (const route of routes) {
    const rolesValid =
      Array.isArray(route?.roles) &&
      route.roles.length > 0 &&
      route.roles.length <= 3 &&
      new Set(route.roles).size === route.roles.length &&
      route.roles.every((role) => ["admin", "superintendent", "manager"].includes(role));
    const targets = [!!route?.owner_id, !!route?.team, route?.roles !== undefined].filter(
      Boolean,
    ).length;
    if (
      !route ||
      typeof route.page_id !== "string" ||
      typeof route.form_id !== "string" ||
      !/^\d{1,64}$/.test(route.page_id || "") ||
      !/^\d{1,64}$/.test(route.form_id || "") ||
      typeof route.product !== "string" ||
      !route.product.trim() ||
      route.product.length > 250 ||
      targets !== 1 ||
      (route.owner_id !== undefined &&
        !(
          typeof route.owner_id === "string" &&
          route.owner_id.length > 0 &&
          route.owner_id.length <= 100
        )) ||
      (route.team !== undefined &&
        !(typeof route.team === "string" && route.team.length > 0 && route.team.length <= 160)) ||
      (route.roles !== undefined && !rolesValid) ||
      Object.keys(route).some(
        (key) => !["page_id", "form_id", "owner_id", "team", "roles", "product"].includes(key),
      )
    )
      throw Error("Rota de formulário inválida.");
    const key = route.page_id + ":" + route.form_id;
    if (seen.has(key)) throw Error("Há formulários duplicados na configuração.");
    seen.add(key);
  }
  return routes;
}
export async function resolveFormRoute(store, env, job) {
  const routes = formRoutes(env);
  const route = routes.find(
    (route) => route.page_id === String(job.page_id) && route.form_id === String(job.form_id),
  );
  if (!route && env.META_REQUIRE_FORM_ROUTE === "1")
    throw Object.assign(Error("Formulário sem encaminhamento configurado."), {
      code: "META_FORM_ROUTE_MISSING",
    });
  if (!route) return null;
  const users = (await store.listResources("users")).filter((user) => user.active);
  if (route.owner_id) {
    if (!users.some((user) => user.id === route.owner_id))
      throw Object.assign(Error("Responsável indisponível."), { code: "META_OWNER_UNAVAILABLE" });
    return { product: route.product, owner_id: route.owner_id };
  }
  if (route.roles) {
    const candidates = users.filter((user) => route.roles.includes(user.role));
    if (!candidates.length)
      throw Object.assign(Error("Nenhum master ativo disponível."), {
        code: "META_MASTER_UNAVAILABLE",
      });
    return { product: route.product, permittedOwners: new Set(candidates.map((user) => user.id)) };
  }
  const candidates = users.filter((user) => user.team === route.team);
  if (!candidates.length)
    throw Object.assign(Error("Equipe sem usuários ativos."), { code: "META_TEAM_UNAVAILABLE" });
  return { product: route.product, permittedOwners: new Set(candidates.map((user) => user.id)) };
}
export function connectionReadiness(env) {
  const required = keys.slice(0, 7);
  const missing = required.filter((key) => !env[key]);
  let callbackValid = false;
  try {
    const url = new URL(env.META_CALLBACK_URL);
    callbackValid =
      url.protocol === "https:" &&
      url.pathname === "/webhooks/meta" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
  } catch {}
  const routes = formRoutes(env);
  const allowedPages = new Set(String(env.META_PAGE_IDS || "").split(","));
  const routePagesValid =
    routes.length > 0 && routes.every((route) => allowedPages.has(route.page_id));
  return {
    appId: env.META_APP_ID || null,
    graphVersion: env.META_GRAPH_VERSION || null,
    missing,
    callbackValid,
    pagesValid: /^\d+(,\d+)*$/.test(env.META_PAGE_IDS || ""),
    routes: routes.length,
    routePagesValid,
    requiresRouting: env.META_REQUIRE_FORM_ROUTE === "1",
    configured:
      env.META_REQUIRE_FORM_ROUTE === "1" &&
      missing.length === 0 &&
      callbackValid &&
      routePagesValid &&
      /^\d+(,\d+)*$/.test(env.META_PAGE_IDS || "") &&
      /^v\d+\.\d+$/.test(env.META_GRAPH_VERSION || ""),
  };
}
