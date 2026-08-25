const RECOVERY_TOKEN_HASH_PATTERN = /^(?:pkce_)?[a-f0-9]{56}$/;

/**
 * Supabase Auth stores the SHA-224 token hash directly for implicit flows and
 * prefixes it with `pkce_` for PKCE flows. No raw OTP or arbitrary prefix is
 * accepted by the application callback.
 */
export function isRecoveryTokenHash(value: unknown): value is string {
  return typeof value === "string" && RECOVERY_TOKEN_HASH_PATTERN.test(value);
}
