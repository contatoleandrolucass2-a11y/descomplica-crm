import "server-only";

import type { createClient } from "@/lib/auth/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MfaAssuranceState =
  | { status: "optional"; currentLevel: "aal1" | "aal2" }
  | { status: "required"; currentLevel: "aal1" }
  | { status: "verified"; currentLevel: "aal2" }
  | { status: "recovery"; currentLevel: "aal1" | "aal2" }
  | { status: "unavailable"; currentLevel: null };

export async function getMfaAssurance(supabase: SupabaseServerClient): Promise<MfaAssuranceState> {
  const [{ data, error }, sessionResult, claimsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.rpc("current_session_is_live"),
    supabase.auth.getClaims(),
  ]);

  if (
    sessionResult.error ||
    sessionResult.data !== true ||
    claimsResult.error ||
    error ||
    !data ||
    (data.currentLevel !== "aal1" && data.currentLevel !== "aal2")
  ) {
    return { status: "unavailable", currentLevel: null };
  }
  const currentLevel: "aal1" | "aal2" = data.currentLevel === "aal2" ? "aal2" : "aal1";

  if (hasRecoveryAuthenticationMethod(claimsResult.data?.claims)) {
    return { status: "recovery", currentLevel };
  }

  if (data.currentLevel === "aal2") {
    return { status: "verified", currentLevel: "aal2" };
  }

  if (data.nextLevel === "aal2") {
    return { status: "required", currentLevel: "aal1" };
  }

  return { status: "optional", currentLevel: "aal1" };
}

export function hasRecoveryAuthenticationMethod(claims: unknown): boolean {
  if (!claims || typeof claims !== "object") return false;
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;

  return amr.some((entry) => {
    if (typeof entry === "string") return entry === "recovery" || entry === "otp";
    return (
      Boolean(entry) &&
      typeof entry === "object" &&
      ((entry as { method?: unknown }).method === "recovery" ||
        (entry as { method?: unknown }).method === "otp")
    );
  });
}

export const PASSWORD_RECOVERY_ASSURANCE_MAX_AGE_SECONDS = 15 * 60;

export function hasFreshRecoveryAuthenticationMethod(
  claims: unknown,
  options: { nowEpochSeconds?: number; maxAgeSeconds?: number } = {},
): boolean {
  if (!claims || typeof claims !== "object") return false;
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;

  const nowEpochSeconds = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? PASSWORD_RECOVERY_ASSURANCE_MAX_AGE_SECONDS;
  return amr.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const method = (entry as { method?: unknown }).method;
    const timestamp = (entry as { timestamp?: unknown }).timestamp;
    if ((method !== "recovery" && method !== "otp") || !Number.isSafeInteger(timestamp)) {
      return false;
    }
    const age = nowEpochSeconds - (timestamp as number);
    return age >= -60 && age <= maxAgeSeconds;
  });
}
