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
//   - NEXT_PUBLIC_SUPABASE_URL (public)
//   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public, RLS-bounded)
// SUPABASE_SERVICE_ROLE_KEY is server-only and is NOT referenced here.

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Mirror rotated cookies to the request so downstream handlers in
          // the same request observe the refreshed session.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild the response so it carries the request mutation forward.
          response = NextResponse.next({ request });
          // Persist rotated cookies on the response for the browser.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Apply anti-cache headers per @supabase/ssr contract. See
          // file-level comment for rationale.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Trigger the session refresh. The return value is intentionally not
  // inspected, logged, or rendered: M3 does not branch on user state, and
  // exposing session material outside the cookie boundary is forbidden
  // per AUTH_SECURITY.md > Session Observability Requirements.
  await supabase.auth.getClaims();

  return { supabase, response };
}
