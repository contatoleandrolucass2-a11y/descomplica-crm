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
//     headers required by @supabase/ssr. This file just wires the
//     helper into Next.js and forwards its response.
//
// Out of scope for M3.3:
//   - HTTP security headers (CSP, HSTS, X-Frame-Options,
//     Referrer-Policy, X-Content-Type-Options) are added in M3.4
//     via lib/security/headers.ts. This file intentionally does
//     NOT import or apply applySecurityHeaders yet because that
//     module does not exist until M3.4.
//   - No redirects. Real route protection enforcement (per
//     ROUTE_PROTECTION.md and the B10 verification gate) is
//     deferred to M4+ once login and verification-pending
//     surfaces exist. Redirecting before those surfaces exist
//     would produce loops.
//   - No branching on user/session state. M3 does not read or
//     render session material outside the cookie boundary
//     (AUTH_SECURITY.md > Session Observability Requirements).
//     Nothing about the user, session, token, cookie, or env is
//     logged from this file.
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
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
