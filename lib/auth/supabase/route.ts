import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import {
  applyAuthCookiePolicy,
  isSupabaseAuthCookieName,
  isSupabaseSessionCookieName,
  resolveSessionPersistence,
  SESSION_PERSISTENCE_COOKIE_NAME,
} from "@/lib/auth/session-persistence";
import { getSupabaseRuntimeConfiguration } from "@/lib/auth/supabase/runtime";

type BufferedCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Creates a request-scoped Supabase client for Route Handlers.
 *
 * Auth cookie mutations stay in memory until the handler has validated the
 * complete operation. The caller then applies them atomically to its final
 * response. This avoids coupling an auth-state callback to Next's Server
 * Action response lifecycle and lets fail-closed paths discard a new session.
 */
export function createRouteClient(request: NextRequest) {
  const configuration = getSupabaseRuntimeConfiguration();
  const persistence = resolveSessionPersistence(
    request.cookies.get(SESSION_PERSISTENCE_COOKIE_NAME)?.value,
  );
  const cookieValues = new Map<string, { name: string; value: string }>();
  const bufferedCookies = new Map<string, BufferedCookie>();
  const bufferedHeaders = new Headers();

  // Proxy refreshes the incoming request before this handler and deliberately
  // defers its response cookies for this endpoint. Stage the resulting auth
  // cookie set so an invalid TOTP can still persist a safe token rotation,
  // while a successful verification replaces it with one final AAL2 set.
  for (const { name, value } of request.cookies.getAll()) {
    if (isSupabaseAuthCookieName(name, configuration.url)) {
      if (value === "") {
        bufferedCookies.set(name, { name, value, options: { maxAge: 0 } });
        continue;
      }
      bufferedCookies.set(name, { name, value, options: {} });
    }
    cookieValues.set(name, { name, value });
  }

  const supabase = createServerClient(configuration.url, configuration.publishableKey, {
    cookies: {
      getAll() {
        return [...cookieValues.values()];
      },
      setAll(cookiesToSet, headersToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.options.maxAge === 0) cookieValues.delete(cookie.name);
          else cookieValues.set(cookie.name, { name: cookie.name, value: cookie.value });
          bufferedCookies.set(cookie.name, cookie);
        }
        for (const [name, value] of Object.entries(headersToSet)) {
          const normalizedName = name.toLowerCase();
          if (
            normalizedName === "cache-control" ||
            normalizedName === "expires" ||
            normalizedName === "pragma"
          ) {
            bufferedHeaders.set(normalizedName, value);
          }
        }
      },
    },
  });

  return {
    supabase,
    applyCookies(response: NextResponse) {
      for (const [name, value] of bufferedHeaders) {
        if (!response.headers.has(name)) response.headers.set(name, value);
      }
      for (const { name, value, options } of bufferedCookies.values()) {
        response.cookies.set(
          name,
          value,
          applyAuthCookiePolicy(
            options,
            isSupabaseSessionCookieName(name, configuration.url)
              ? persistence
              : { kind: "temporary" },
          ),
        );
      }
      return response;
    },
  };
}
