// Supabase server client for Server Components and Server Actions.
//
// Creates a NEW client per request — never reuse across requests (each
// request has its own cookie store and lifecycle).
//
// Uses the current getAll/setAll cookie API. The deprecated get/set/remove
// API is intentionally avoided.
//
// setAll behavior:
//   - The cookieStore.set call is wrapped in try/catch because Server
//     Components cannot write cookies. The catch silently absorbs that
//     failure; Server Actions (which CAN write cookies) execute normally.
//   - The second parameter of setAll is the anti-cache headers
//     (Cache-Control, Expires, Pragma) that prevent CDNs from caching auth
//     responses. We intentionally omit handling these here: Server
//     Components and Server Actions have no direct response-object access
//     in Next.js App Router. Applying anti-cache headers is the
//     responsibility of the middleware (M3), which has NextResponse.headers
//     available.
//
// Env vars used:
//   - NEXT_PUBLIC_SUPABASE_URL (public)
//   - NEXT_PUBLIC_SUPABASE_ANON_KEY (public, RLS-bounded)
// SUPABASE_SERVICE_ROLE_KEY is NOT used here and must never be referenced
// from this file.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookie writes are not
            // permitted in that context. Session refresh must be handled
            // by middleware (M3). See file-level comment above.
          }
        },
      },
    },
  );
}
