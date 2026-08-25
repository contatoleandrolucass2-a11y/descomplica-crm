"use client";

// Supabase browser client for Client Components.
//
// createBrowserClient handles document.cookie automatically when no
// cookies option is provided. The library defaults to a singleton per
// browser session, preventing duplicate clients across components.
//
// Runtime configuration is supplied explicitly by a Server Component. The
// app does not read NEXT_PUBLIC_* variables because Next.js freezes them into
// the image during `next build`, preventing safe artifact promotion.
// SUPABASE_SERVICE_ROLE_KEY is server-only and must never be referenced
// from this file or from any other module that this file imports.

import { createBrowserClient } from "@supabase/ssr";

export type SupabaseBrowserConfiguration = Readonly<{
  publishableKey: string;
  url: string;
}>;

export function createClient(configuration: SupabaseBrowserConfiguration) {
  return createBrowserClient(configuration.url, configuration.publishableKey);
}
