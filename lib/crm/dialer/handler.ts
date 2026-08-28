import "server-only";

import { applySecurityHeaders } from "@/lib/security/headers";
import { authorizeRoute, type RouteAuthorizationResult } from "@/lib/security/route-auth";
import { legacyMigrationModuleIsEnabled } from "@/lib/crm/legacy-migration/config";

import { isMonday } from "./weekend-forecast";

export type DialerHandlerDependencies = {
  authorize: typeof authorizeRoute;
  moduleEnabled: typeof legacyMigrationModuleIsEnabled;
};

const defaultDependencies: DialerHandlerDependencies = {
  authorize: authorizeRoute,
  moduleEnabled: legacyMigrationModuleIsEnabled,
};

function headers(request: Request): Headers {
  const value = new Headers({ "Cache-Control": "private, no-store, max-age=0" });
  applySecurityHeaders(value, {
    isProd: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:",
  });
  return value;
}

function json(request: Request, body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: headers(request) });
}

function denied(request: Request, authorization: RouteAuthorizationResult): Response {
  const status = authorization.ok ? 403 : authorization.response.status;
  return json(request, { error: status === 401 ? "unauthenticated" : "forbidden" }, status);
}

async function authorizeMaster(request: Request, dependencies: DialerHandlerDependencies) {
  const authorization = await dependencies.authorize("crm.dialer.view");
  if (!authorization.ok || authorization.context.roleKey !== "master") {
    return { ok: false as const, response: denied(request, authorization) };
  }
  return { ok: true as const };
}

export async function handleWeekendForecastGet(
  request: Request,
  dependencies: DialerHandlerDependencies = defaultDependencies,
): Promise<Response> {
  if (!dependencies.moduleEnabled("dialer.weekend-forecast")) {
    return json(request, { error: "not_found" }, 404);
  }
  const authorization = await authorizeMaster(request, dependencies);
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "week")) {
    return json(request, { error: "invalid_query" }, 400);
  }
  const week = url.searchParams.get("week") ?? "";
  if (!isMonday(week)) return json(request, { error: "invalid_week" }, 400);

  return json(
    request,
    {
      schemaVersion: 1,
      state: "development",
      week,
      writable: false,
      source: "synthetic-contract-only",
      brokers: [],
      developments: [],
      visits: [],
      sales: [],
    },
    200,
  );
}

export async function handleWeekendForecastPost(
  request: Request,
  dependencies: DialerHandlerDependencies = defaultDependencies,
): Promise<Response> {
  if (!dependencies.moduleEnabled("dialer.weekend-forecast")) {
    return json(request, { error: "not_found" }, 404);
  }
  const authorization = await authorizeMaster(request, dependencies);
  if (!authorization.ok) return authorization.response;
  return json(request, { error: "weekend_forecast_writes_disabled" }, 503);
}
