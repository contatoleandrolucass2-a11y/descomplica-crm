import "server-only";

import { safeExternalUrl } from "@/lib/security/api";

const MINIMUM_MACHINE_SECRET_LENGTH = 32;
const SUPABASE_SECRET_KEY_PATTERN = /^sb_secret_[A-Za-z0-9_-]{20,}$/;

type RuntimeEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "SALESFORCE_INGEST_ENABLED"
    | "SALESFORCE_INGEST_SECRET"
    | "SALESFORCE_REFRESH_ENABLED"
    | "SALESFORCE_REFRESH_SECRET"
    | "SALESFORCE_REFRESH_URL"
    | "SUPABASE_SECRET_KEY"
  >
>;

type DisabledCapability = { enabled: false; available: false };
type MisconfiguredCapability = { enabled: true; available: false };

export type SalesforceIngestConfiguration =
  | DisabledCapability
  | MisconfiguredCapability
  | {
      enabled: true;
      available: true;
      ingestSecret: string;
    };

export type SalesforceRefreshConfiguration =
  | DisabledCapability
  | MisconfiguredCapability
  | {
      enabled: true;
      available: true;
      refreshSecret: string;
      refreshUrl: URL;
    };

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value === "true";
}

function isValidMachineSecret(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= MINIMUM_MACHINE_SECRET_LENGTH;
}

function isValidSupabaseSecretKey(value: string | undefined): boolean {
  return typeof value === "string" && SUPABASE_SECRET_KEY_PATTERN.test(value);
}

export function getSalesforceIngestConfiguration(
  environment: RuntimeEnvironment = process.env,
): SalesforceIngestConfiguration {
  if (!isExplicitlyEnabled(environment.SALESFORCE_INGEST_ENABLED)) {
    return { enabled: false, available: false };
  }

  if (
    !isValidMachineSecret(environment.SALESFORCE_INGEST_SECRET) ||
    !isValidSupabaseSecretKey(environment.SUPABASE_SECRET_KEY)
  ) {
    return { enabled: true, available: false };
  }

  return {
    enabled: true,
    available: true,
    ingestSecret: environment.SALESFORCE_INGEST_SECRET,
  };
}

export function getSalesforceRefreshConfiguration(
  environment: RuntimeEnvironment = process.env,
): SalesforceRefreshConfiguration {
  if (!isExplicitlyEnabled(environment.SALESFORCE_REFRESH_ENABLED)) {
    return { enabled: false, available: false };
  }

  const refreshUrl = safeExternalUrl(
    environment.SALESFORCE_REFRESH_URL,
    environment.NODE_ENV === "production",
  );
  if (!refreshUrl || !isValidMachineSecret(environment.SALESFORCE_REFRESH_SECRET)) {
    return { enabled: true, available: false };
  }

  return {
    enabled: true,
    available: true,
    refreshSecret: environment.SALESFORCE_REFRESH_SECRET,
    refreshUrl,
  };
}
