import "server-only";

export const QLIK_RELAY_MAX_BODY_BYTES = 1_000_000;
export const QLIK_RELAY_MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export type QlikRelayMode = "off" | "shadow" | "canary" | "active";

type RuntimeEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "QLIK_RELAY_MODE"
    | "QLIK_RELAY_WRITE_ENABLED"
    | "QLIK_RELAY_KEY_ID"
    | "QLIK_RELAY_HMAC_SECRET"
    | "QLIK_RELAY_DATABASE_URL"
    | "SUPABASE_SECRET_KEY"
  >
>;

type UnavailableConfiguration = {
  mode: QlikRelayMode;
  available: false;
  writeEnabled: false;
};

export type AvailableQlikRelayConfiguration = {
  mode: Exclude<QlikRelayMode, "off">;
  available: true;
  writeEnabled: boolean;
  keyId: string;
  hmacSecret: string;
  databaseUrl: string;
};

export type QlikRelayConfiguration = UnavailableConfiguration | AvailableQlikRelayConfiguration;

function relayMode(value: string | undefined): QlikRelayMode {
  const normalized = value?.trim();
  return normalized === "shadow" || normalized === "canary" || normalized === "active"
    ? normalized
    : "off";
}

function validKeyId(value: string | undefined): value is string {
  return (
    typeof value === "string" && value.length <= 100 && /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(value)
  );
}

function validHmacSecret(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value.length >= 43 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function validDatabaseUrl(
  value: string | undefined,
  production: boolean,
  hmacSecret: string | undefined,
): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (!(["postgres:", "postgresql:"] as string[]).includes(url.protocol)) return false;
    if (!url.hostname || url.pathname !== "/postgres" || url.hash) return false;

    const username = decodeURIComponent(url.username);
    if (!(username === "crm_qlik_relay" || username.startsWith("crm_qlik_relay."))) {
      return false;
    }
    const password = decodeURIComponent(url.password);
    if (password.length < 16 || /[\u0000-\u001f\u007f]/u.test(password)) return false;
    if (password === hmacSecret) return false;

    if (url.searchParams.size !== 1 || url.searchParams.get("sslmode") !== "verify-full") {
      return false;
    }

    const isSupabaseDatabaseHost =
      url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.com");
    if (production) return isSupabaseDatabaseHost;
    return (
      isSupabaseDatabaseHost ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function getQlikRelayConfiguration(
  environment: RuntimeEnvironment = process.env,
): QlikRelayConfiguration {
  const mode = relayMode(environment.QLIK_RELAY_MODE);
  if (mode === "off") return { mode, available: false, writeEnabled: false };

  const writeEnabled = environment.QLIK_RELAY_WRITE_ENABLED?.trim() === "true";
  const credentialsAreValid =
    validKeyId(environment.QLIK_RELAY_KEY_ID) &&
    validHmacSecret(environment.QLIK_RELAY_HMAC_SECRET) &&
    environment.QLIK_RELAY_HMAC_SECRET !== environment.SUPABASE_SECRET_KEY &&
    validDatabaseUrl(
      environment.QLIK_RELAY_DATABASE_URL,
      environment.NODE_ENV === "production",
      environment.QLIK_RELAY_HMAC_SECRET,
    );
  const modeIsConsistent = mode === "shadow" ? !writeEnabled : writeEnabled;

  if (!credentialsAreValid || !modeIsConsistent) {
    return { mode, available: false, writeEnabled: false };
  }

  return {
    mode,
    available: true,
    writeEnabled,
    keyId: environment.QLIK_RELAY_KEY_ID!,
    hmacSecret: environment.QLIK_RELAY_HMAC_SECRET!,
    databaseUrl: environment.QLIK_RELAY_DATABASE_URL!,
  };
}
