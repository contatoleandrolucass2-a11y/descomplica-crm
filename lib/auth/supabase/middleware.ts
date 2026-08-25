// Supabase middleware helper.
//
// Used by the root middleware.ts (added in M3.3) to perform Supabase session
// refresh at the edge on every matched request. Isolated here so the root
// middleware stays small and the cookie-sync logic is testable in isolation.
//
// Why this exists:
//   - The browser holds Supabase session material in cookies (per B9). When
//     the access token nears expiry, a refresh rotates both the access and
//     refresh tokens. The rotated cookies must be mirrored to BOTH the
//     incoming request (so downstream code in the same request sees the new
//     session) AND the outgoing response (so the browser persists the
//     rotation). This helper handles both sides.
//
// Cookie API:
//   - Uses the current getAll/setAll cookie API of @supabase/ssr. The
//     deprecated get/set/remove API is intentionally avoided.
//
// Anti-cache headers:
//   - The second parameter of setAll carries anti-cache response headers
//     (Cache-Control, Expires, Pragma) required by @supabase/ssr. These
//     prevent CDNs and reverse proxies from caching token-bearing
//     responses, which could otherwise leak one user's session to another.
//   - These headers ARE applied here (unlike lib/auth/supabase/server.ts)
//     because middleware has direct access to NextResponse.headers. This is
//     exactly the layer that AUTH_SECURITY.md > HTTP Security Headers
//     designates as the place to enforce response-level headers.
//
// Out of scope for M3.2:
//   - No redirects. NextResponse.redirect is not called from this helper.
//     Route protection enforcement (per ROUTE_PROTECTION.md) is deferred
//     until login and verification-pending surfaces exist in M4+.
//
// Env vars:
//   - SUPABASE_URL (public API URL, server runtime only)
//   - SUPABASE_PUBLISHABLE_KEY (public, RLS-bounded, server runtime only)
// SUPABASE_SERVICE_ROLE_KEY is server-only and is NOT referenced here.

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import {
  applyAuthCookiePolicy,
  buildSessionPersistenceCookie,
  issueSessionPersistence,
  isSupabaseAuthCookieName,
  isSupabaseSessionCookieName,
  resolveSessionPersistence,
  SESSION_PERSISTENCE_COOKIE_NAME,
} from "@/lib/auth/session-persistence";
import { getSupabaseRuntimeConfiguration } from "@/lib/auth/supabase/runtime";

export async function updateSession(request: NextRequest) {
  const configuration = getSupabaseRuntimeConfiguration();
  let response = NextResponse.next({ request });
  const markerValue = request.cookies.get(SESSION_PERSISTENCE_COOKIE_NAME)?.value;
  const persistence = resolveSessionPersistence(markerValue);
  const temporaryAuthCookies =
    persistence.kind === "temporary"
      ? request.cookies
          .getAll()
          .filter(({ name }) => isSupabaseAuthCookieName(name, configuration.url))
      : [];
  const rotatedAuthCookies = new Set<string>();

  const supabase = createServerClient(configuration.url, configuration.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name }) => {
          if (isSupabaseAuthCookieName(name, configuration.url)) {
            rotatedAuthCookies.add(name);
          }
        });
        // Mirror rotated cookies to the request so downstream handlers in
        // the same request observe the refreshed session.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Rebuild the response so it carries the request mutation forward.
        response = NextResponse.next({ request });
        // Persist rotated cookies on the response for the browser.
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(
            name,
            value,
            applyAuthCookiePolicy(
              options,
              isSupabaseSessionCookieName(name, configuration.url)
                ? persistence
                : { kind: "temporary" },
            ),
          ),
        );
        // Apply anti-cache headers per @supabase/ssr contract. See
        // file-level comment for rationale.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Trigger the session refresh. The return value is intentionally not
  // inspected, logged, or rendered: M3 does not branch on user state, and
  // exposing session material outside the cookie boundary is forbidden
  // per AUTH_SECURITY.md > Session Observability Requirements.
  await supabase.auth.getClaims();

  // An absent, invalid or expired marker means a session-only browser
  // lifetime. Existing remembered Supabase cookies must be rewritten even
  // when no token refresh happened during this request.
  if (temporaryAuthCookies.length > 0) {
    temporaryAuthCookies
      .filter(({ name }) => !rotatedAuthCookies.has(name))
      .forEach(({ name, value }) =>
        response.cookies.set(name, value, applyAuthCookiePolicy({}, persistence)),
      );
  }

  // Invalid, expired and unverifiable markers fail back to a temporary
  // session. Clear the stale marker without exposing its value.
  if (markerValue && persistence.kind === "temporary") {
    const marker = buildSessionPersistenceCookie(issueSessionPersistence(undefined));
    response.cookies.set(marker.name, marker.value, marker.options);
  }

  return { supabase, response };
}
