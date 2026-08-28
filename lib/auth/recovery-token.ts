const RECOVERY_TOKEN_HASH_PATTERN = /^(?:pkce_)?[a-f0-9]{56}$/;
const SUPABASE_PKCE_AUTH_CODE_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/**
 * Supabase Auth stores the SHA-224 token hash directly for implicit flows and
 * prefixes it with `pkce_` for PKCE flows. No raw OTP or arbitrary prefix is
 * accepted by the application callback.
 */
export function isRecoveryTokenHash(value: unknown): value is string {
  return typeof value === "string" && RECOVERY_TOKEN_HASH_PATTERN.test(value);
}

/**
 * Hosted Supabase's standard `ConfirmationURL` completes a PKCE recovery by
 * returning the current GoTrue v4 UUID auth-code format. Validate the opaque
 * code before asking Auth to exchange it; recovery assurance is still checked
 * after the exchange, so another authentication method cannot enter the reset
 * flow through this callback.
 */
export function isSupabasePkceAuthCode(value: unknown): value is string {
  return typeof value === "string" && SUPABASE_PKCE_AUTH_CODE_PATTERN.test(value);
}
