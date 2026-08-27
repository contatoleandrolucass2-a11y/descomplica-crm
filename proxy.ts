// Root proxy — Supabase session refresh at the edge.
//
// File convention:
//   - Next.js 16 renamed the root "middleware.ts" file convention
//     to "proxy.ts" and the exported function from `middleware` to
//     `proxy`. Building with the old name emits a deprecation
//     warning that points at the migration note in the Next.js
//     docs (messages/middleware-to-proxy). The runtime behavior
//     is unchanged: same request lifecycle position, same matcher
//     contract, same NextRequest/NextResponse types. We use the
//     new convention to avoid the deprecation warning and to be
//     forward-compatible with Next.js 17+.
//   - The internal helper at lib/auth/supabase/middleware.ts
//     keeps its name. It is not a Next.js convention file — it is
//     an isolated module that implements the cookie-sync logic
//     and is imported by this proxy. Renaming it would have no
//     effect on Next.js and would only churn imports.
//
// Responsibility (M3.3, reduced scope):
//   - Delegate cookie sync and token rotation to the helper in
//     lib/auth/supabase/middleware.ts. That helper rebuilds the
//     NextResponse with rotated cookies and applies the anti-cache
//     headers required by @supabase/ssr.
//   - Fail closed for disabled or incomplete Salesforce capabilities
//     before session refresh. This prevents even an unrelated auth
//     network request from preceding the controlled 503 response.
//
// Security headers (M3.4):
//   - HTTP security headers (CSP, HSTS, X-Frame-Options,
//     Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
//     are now applied via applySecurityHeaders from
//     lib/security/headers.ts. The policy itself lives there so
//     this file stays focused on request wiring. For normal responses,
//     the call happens AFTER updateSession so the cookies and anti-cache
//     headers placed by @supabase/ssr are not overwritten. Direct 503
//     responses receive the same policy before being returned.
//   - The production-mode gate combines NODE_ENV with a runtime
//     check that the request is actually over HTTPS. Running a
//     local prod build over plain HTTP must NOT emit HSTS or
//     upgrade-insecure-requests, because those headers would
//     poison the browser cache against plain-HTTP access to other
//     local services. The combined gate is the only safe signal
//     for "we are serving real production traffic".
//
// Authorization boundary:
//   - Versioned protected pages receive an early permission check so Cache
//     Components cannot stream an HTTP 200 before a page-level forbidden()
//     interrupt. Layout/page guards, APIs, RPCs and RLS repeat the check.
//   - The proxy reads only the authenticated user id and effective permission
//     keys. It never logs or renders user, session, token, cookie or env data.
//
// Route groups note:
//   - The app/(auth)/ and app/(protected)/ segments are Next.js
//     route groups. They organize files but DO NOT appear in
//     URLs, so the matcher below cannot and must not reference
//     them. A future page at app/(protected)/dashboard/page.tsx
//     is served at /dashboard, and that path is matched by the
//     generic catch-all below.
//
// Matcher:
//   - Excludes all Next.js internals (/_next/*) to keep
//     Turbopack, HMR, RSC payloads, static chunks, and image
//     optimization off the auth path. Excludes favicon and
//     common static asset extensions for the same reason.

import { updateSession } from "@/lib/auth/supabase/middleware";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
} from "@/lib/crm/salesforce/config";
import { applySecurityHeaders } from "@/lib/security/headers";
import { isHomologationMode } from "@/lib/homologation/config";
import { getProtectedPageGate } from "@/lib/authorization/page-gates";
import { NextResponse, type NextRequest } from "next/server";
import type { PermissionKey } from "@/lib/authorization/permissions";

interface AuthorizationContextRow {
  permissions?: unknown;
}

// Cache Components can stream a shared protected shell before a page-level
// forbidden() interrupt changes the status. Enforce the exact page permission
// for the versioned route inventory in Proxy as well. Page guards, APIs and RLS
// remain authoritative and still re-check the same key.
function permissionRequiredBeforeStreaming(pathname: string): {
  permission: PermissionKey;
  releaseEnabled: boolean;
} | null {
  const pageGate = getProtectedPageGate(pathname);
  if (pageGate) return pageGate;

  if (pathname.startsWith("/app/etapas/")) {
    return { permission: "crm.stages.view", releaseEnabled: true };
  }
  if (pathname.startsWith("/app/configuracoes/metas")) {
    return { permission: "crm.settings.manage", releaseEnabled: true };
  }
  if (pathname === "/app/simulacao" || pathname.startsWith("/app/simulacao/")) {
    return { permission: "crm.simulators.view", releaseEnabled: true };
  }
  return null;
}

function copySessionResponse(source: NextResponse, target: NextResponse) {
  for (const [name, value] of source.headers) {
    if (name === "set-cookie" || name.startsWith("x-middleware-")) continue;
    target.headers.set(name, value);
  }
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
}

function forbiddenBeforeStreaming(request: NextRequest, sessionResponse: NextResponse) {
  const response = NextResponse.rewrite(new URL("/unauthorized", request.url), { status: 403 });
  copySessionResponse(sessionResponse, response);
  return response;
}

async function lacksEarlyPermission(
  supabase: Awaited<ReturnType<typeof updateSession>>["supabase"],
  pageGate: { permission: PermissionKey; releaseEnabled: boolean },
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return false;
  if (!pageGate.releaseEnabled) return true;

  const { data, error } = await supabase.rpc("get_user_authorization_context", {
    user_uuid: user.id,
  });
  if (error) return true;
  if (!Array.isArray(data) || data.length === 0) return false;
  if (data.length !== 1) return true;

  const permissions = (data[0] as AuthorizationContextRow).permissions;
  return !Array.isArray(permissions) || !permissions.includes(pageGate.permission);
}

function unavailableSalesforceResponse(request: NextRequest): NextResponse | null {
  if (
    request.nextUrl.pathname === "/api/ingest/salesforce" &&
    !getSalesforceIngestConfiguration().available
  ) {
    return NextResponse.json(
      { error: "ingestion_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    request.nextUrl.pathname === "/api/refresh/salesforce" &&
    !getSalesforceRefreshConfiguration().available
  ) {
    return NextResponse.json(
      { error: "refresh_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const isSecureProduction =
    process.env.NODE_ENV === "production" && request.nextUrl.protocol === "https:";

  const unavailableResponse = unavailableSalesforceResponse(request);
  if (unavailableResponse) {
    applySecurityHeaders(unavailableResponse.headers, {
      isProd: isSecureProduction,
      noIndex: isHomologationMode(),
    });
    return unavailableResponse;
  }

  const { supabase, response: sessionResponse } = await updateSession(request);
  let response = sessionResponse;
  const earlyPermission =
    request.method === "GET" || request.method === "HEAD"
      ? permissionRequiredBeforeStreaming(request.nextUrl.pathname)
      : null;
  if (earlyPermission && (await lacksEarlyPermission(supabase, earlyPermission))) {
    response = forbiddenBeforeStreaming(request, sessionResponse);
  }

  applySecurityHeaders(response.headers, {
    isProd: isSecureProduction,
    noIndex: isHomologationMode(),
    suppressReferrer: request.nextUrl.pathname === "/auth/callback",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!api/ingest/qlik(?:/|$)|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
