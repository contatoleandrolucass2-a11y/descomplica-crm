import "server-only";

import { cookies } from "next/headers";

import {
  applyAuthCookiePolicy,
  isSupabaseAuthCookieName,
  SESSION_PERSISTENCE_COOKIE_NAME,
} from "./session-persistence";
import { getSupabaseRuntimeConfiguration } from "./supabase/runtime";

export async function clearLocalAuthenticationCookies(): Promise<void> {
  const configuration = getSupabaseRuntimeConfiguration();
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name === SESSION_PERSISTENCE_COOKIE_NAME ||
      isSupabaseAuthCookieName(cookie.name, configuration.url)
    ) {
      cookieStore.set(cookie.name, "", applyAuthCookiePolicy({ maxAge: 0 }, { kind: "temporary" }));
    }
  }
}
