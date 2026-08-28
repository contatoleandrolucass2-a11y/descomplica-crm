import "server-only";

import { isCommercialEngineKey, type CommercialEngineKey } from "./catalog.ts";

export const COMMERCIAL_ENGINE_MAX_BODY_BYTES = 256_000;

export type CommercialEngineRuntimeMode = "off" | "shadow" | "active";

type RuntimeEnvironment = {
  NODE_ENV?: string;
  SUPABASE_URL?: string;
  COMMERCIAL_ENGINE_RUNTIME_MODE?: string;
  COMMERCIAL_ENGINE_ENABLED_KEYS?: string;
  COMMERCIAL_ENGINE_DATABASE_URL?: string;
  QLIK_RELAY_DATABASE_URL?: string;
  QLIK_RELAY_HMAC_SECRET?: string;
  SUPABASE_SECRET_KEY?: string;
};

type UnavailableCommercialEngineRuntimeConfiguration = {
  mode: CommercialEngineRuntimeMode;
  available: false;
  enabledKeys: readonly [];
};

export type AvailableCommercialEngineRuntimeConfiguration = {
  mode: Exclude<CommercialEngineRuntimeMode, "off">;
  available: true;
  enabledKeys: readonly CommercialEngineKey[];
  databaseUrl: string;
};

export type CommercialEngineRuntimeConfiguration =
  | UnavailableCommercialEngineRuntimeConfiguration
  | AvailableCommercialEngineRuntimeConfiguration;

function parseMode(value: string | undefined): CommercialEngineRuntimeMode {
  const normalized = value?.trim();
  return normalized === "shadow" || normalized === "active" ? normalized : "off";
}

function parseEnabledKeys(value: string | undefined): CommercialEngineKey[] | null {
  if (!value?.trim()) return [];

  const supplied = value.split(",").map((item) => item.trim());
  if (supplied.some((item) => !item) || new Set(supplied).size !== supplied.length) return null;
  if (supplied.some((item) => !isCommercialEngineKey(item))) return null;
  return supplied as CommercialEngineKey[];
}

function databasePassword(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(new URL(value).password);
  } catch {
    return null;
  }
}

function supabaseProjectRef(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname;
    return /^([a-z0-9-]+)\.supabase\.(?:co|com)$/.exec(hostname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function validDatabaseUrl(
  value: string | undefined,
  environment: RuntimeEnvironment,
): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (!(url.protocol === "postgres:" || url.protocol === "postgresql:")) return false;
    if (!url.hostname || url.pathname !== "/postgres" || url.hash) return false;

    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    if (
      password.length < 16 ||
      /[\u0000-\u001f\u007f]/u.test(password) ||
      password === environment.SUPABASE_SECRET_KEY ||
      password === environment.QLIK_RELAY_HMAC_SECRET ||
      password === databasePassword(environment.QLIK_RELAY_DATABASE_URL)
    ) {
      return false;
    }
    if (url.searchParams.size !== 1 || url.searchParams.get("sslmode") !== "verify-full") {
      return false;
    }

    const isLocalDatabaseHost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (isLocalDatabaseHost) {
      return environment.NODE_ENV !== "production" && username === "crm_commercial_engine";
    }

    const projectRef = supabaseProjectRef(environment.SUPABASE_URL);
    if (!projectRef) return false;
    const isDirectDatabase =
      username === "crm_commercial_engine" &&
      (url.hostname === `db.${projectRef}.supabase.co` ||
        url.hostname === `db.${projectRef}.supabase.com`);
    const isProjectPooler =
      username === `crm_commercial_engine.${projectRef}` &&
      /^[a-z0-9-]+\.pooler\.supabase\.(?:co|com)$/.test(url.hostname);
    return isDirectDatabase || isProjectPooler;
  } catch {
    return false;
  }
}

export function getCommercialEngineRuntimeConfiguration(
  environment?: RuntimeEnvironment,
): CommercialEngineRuntimeConfiguration {
  const runtimeEnvironment = environment ?? process.env;
  const mode = parseMode(runtimeEnvironment.COMMERCIAL_ENGINE_RUNTIME_MODE);
  if (mode === "off") return { mode, available: false, enabledKeys: [] };

  const enabledKeys = parseEnabledKeys(runtimeEnvironment.COMMERCIAL_ENGINE_ENABLED_KEYS);
  if (!enabledKeys?.length) return { mode, available: false, enabledKeys: [] };
  if (!validDatabaseUrl(runtimeEnvironment.COMMERCIAL_ENGINE_DATABASE_URL, runtimeEnvironment)) {
    return { mode, available: false, enabledKeys: [] };
  }

  return {
    mode,
    available: true,
    enabledKeys,
    databaseUrl: runtimeEnvironment.COMMERCIAL_ENGINE_DATABASE_URL,
  };
}

export function commercialEngineIsEnabled(
  configuration: CommercialEngineRuntimeConfiguration,
  engineKey: CommercialEngineKey,
): configuration is AvailableCommercialEngineRuntimeConfiguration {
  return configuration.available && configuration.enabledKeys.includes(engineKey);
}
