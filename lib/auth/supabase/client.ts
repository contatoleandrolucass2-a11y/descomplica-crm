"use client";

// Supabase browser client for Client Components.
//
// createBrowserClient handles document.cookie automatically when no
// cookies option is provided. The library defaults to a singleton per
// browser session, preventing duplicate clients across components.
//
// Env vars used:
//   - NEXT_PUBLIC_SUPABASE_URL (public)
//   - NEXT_PUBLIC_SUPABASE_ANON_KEY (public, RLS-bounded)
// SUPABASE_SERVICE_ROLE_KEY is server-only and must never be referenced
// from this file or from any other module that this file imports.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
