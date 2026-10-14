import "server-only";

export const QLIK_V2_PATH = "/api/ingest/qlik/v2";
export const QLIK_V2_MAX_BODY_BYTES = 4_000_000;

export type QlikV2Configuration =
  | { available: false }
  | { available: true; keyId: "qlik-ranking-v2"; hmacSecret: string };

export function getQlikV2Configuration(
  environment: NodeJS.ProcessEnv = process.env,
): QlikV2Configuration {
  const secret = environment.QLIK_RANKING_V2_HMAC_SECRET;
  if (
    environment.QLIK_RANKING_V2_ENABLED !== "true" ||
    typeof secret !== "string" ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(secret) ||
    !environment.SUPABASE_SECRET_KEY ||
    secret === environment.SUPABASE_SECRET_KEY ||
    secret === environment.QLIK_RELAY_HMAC_SECRET ||
    secret === environment.SALESFORCE_INGEST_SECRET
  )
    return { available: false };
  return { available: true, keyId: "qlik-ranking-v2", hmacSecret: secret };
}
