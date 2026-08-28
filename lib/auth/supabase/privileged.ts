import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseRuntimeConfiguration } from "./runtime";

export function createPrivilegedClient() {
  const { url } = getSupabaseRuntimeConfiguration();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Privileged Supabase client is not configured.");
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
