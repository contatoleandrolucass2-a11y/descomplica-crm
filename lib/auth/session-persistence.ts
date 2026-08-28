import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { CookieOptions } from "@supabase/ssr";

export const SESSION_PERSISTENCE_COOKIE_NAME = "descomplica-session-persistence";
export const REMEMBER_BROWSER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const MARKER_VERSION = "v1";
const MINIMUM_SECRET_BYTES = 32;
const TEMPORARY_SESSION = { kind: "temporary" } as const;

export type SessionPersistence =
  | typeof TEMPORARY_SESSION
  | { kind: "remembered"; deadlineEpochSeconds: number };

export type IssuedSessionPersistence =
  | { persistence: typeof TEMPORARY_SESSION; markerValue: null }
  | {
      persistence: Extract<SessionPersistence, { kind: "remembered" }>;
      markerValue: string;
    };

export type SessionPersistenceCookie = {
  name: typeof SESSION_PERSISTENCE_COOKIE_NAME;
  value: string;
  options: CookieOptions;
};

type PersistenceOptions = {
  now?: Date;
  secret?: string | undefined;
};

type SecretEnvironment = Readonly<{
  [name: string]: string | undefined;
  AUTH_SESSION_COOKIE_SECRET?: string;
  AUTH_SESSION_COOKIE_SECRET_FILE?: string;
}>;

type CookiePolicyOptions = {
  allowInsecureLoopback?: boolean;
  applicationOrigin?: string;
  now?: Date;
  production?: boolean;
};

function currentEpochSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

function validSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= MINIMUM_SECRET_BYTES;
}

function normalizeSecretFile(contents: string): string | undefined {
  const normalized = contents.replace(/\r?\n$/, "");
  if (normalized.includes("\n") || normalized.includes("\r") || normalized.includes("\0")) {
    return undefined;
  }
  return validSecret(normalized) ? normalized : undefined;
}

/**
 * Reads the HMAC key from a runtime-mounted secret file. Direct environment
 * injection remains a local-test fallback; deployment Compose files mount a
 * root-owned secret and provide only its in-container path.
 */
export function readSessionPersistenceSecret(
  environment: SecretEnvironment = process.env,
): string | undefined {
  const configuredPath = environment.AUTH_SESSION_COOKIE_SECRET_FILE?.trim();
  if (configuredPath) {
    if (!path.isAbsolute(configuredPath)) return undefined;
    try {
      return normalizeSecretFile(readFileSync(configuredPath, { encoding: "utf8" }));
    } catch {
      return undefined;
    }
  }
  return validSecret(environment.AUTH_SESSION_COOKIE_SECRET)
    ? environment.AUTH_SESSION_COOKIE_SECRET
    : undefined;
}

function markerPayload(deadlineEpochSeconds: number): string {
  return `${MARKER_VERSION}.${deadlineEpochSeconds}`;
}

function markerSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${SESSION_PERSISTENCE_COOKIE_NAME}:${payload}`, "utf8")
    .digest("base64url");
}

function signaturesMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}

function isValidRememberedDeadline(deadlineEpochSeconds: number, now: Date): boolean {
  if (!Number.isSafeInteger(deadlineEpochSeconds)) return false;
  const remaining = deadlineEpochSeconds - currentEpochSeconds(now);
  return remaining > 0 && remaining <= REMEMBER_BROWSER_MAX_AGE_SECONDS;
}

function isHttpsOrigin(
  applicationOrigin: string | undefined,
  production: boolean,
  allowInsecureLoopback: boolean,
): boolean {
  if (!applicationOrigin) return production;
  try {
    const origin = new URL(applicationOrigin);
    if (origin.protocol === "https:") return true;
    if (production && origin.protocol === "http:") {
      const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
      return !(loopback && allowInsecureLoopback);
    }
    return false;
  } catch {
    return production;
  }
}

function hasExplicitLocalQaCookieOverride(): boolean {
  if (process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA !== "true") return false;
  try {
    const supabase = new URL(process.env.SUPABASE_URL ?? "");
    return ["127.0.0.1", "localhost", "[::1]"].includes(supabase.hostname);
  } catch {
    return false;
  }
}

export function isRememberBrowserRequested(value: unknown): boolean {
  return value === "on";
}

function getSupabaseAuthStorageKey(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectReference = hostname.split(".")[0];
    return projectReference ? `sb-${projectReference}-auth-token` : null;
  } catch {
    return null;
  }
}

function withoutChunkSuffix(name: string): string {
  return name.replace(/[.](0|[1-9][0-9]*)$/, "");
}

export function isSupabaseSessionCookieName(
  name: string,
  supabaseUrl: string | undefined,
): boolean {
  const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
  return storageKey !== null && withoutChunkSuffix(name) === storageKey;
}

export function isSupabaseAuthCookieName(name: string, supabaseUrl: string | undefined): boolean {
  const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
  if (!storageKey) return false;
  const unchunkedName = withoutChunkSuffix(name);
  if (unchunkedName === storageKey || unchunkedName === `${storageKey}-code-verifier`) return true;
  if (unchunkedName === `${storageKey}-flows-code-verifier`) return true;
  const flowPrefix = `${storageKey}-flow-`;
  if (!unchunkedName.startsWith(flowPrefix) || !unchunkedName.endsWith("-code-verifier")) {
    return false;
  }
  const flowId = unchunkedName.slice(flowPrefix.length, -"-code-verifier".length);
  return /^[A-Za-z0-9_-]{8,64}$/.test(flowId);
}

export function issueSessionPersistence(
  checkboxValue: unknown,
  options: PersistenceOptions = {},
): IssuedSessionPersistence {
  const now = options.now ?? new Date();
  const secret = options.secret ?? readSessionPersistenceSecret();

  if (!isRememberBrowserRequested(checkboxValue) || !validSecret(secret)) {
    return { persistence: TEMPORARY_SESSION, markerValue: null };
  }

  const deadlineEpochSeconds = currentEpochSeconds(now) + REMEMBER_BROWSER_MAX_AGE_SECONDS;
  const payload = markerPayload(deadlineEpochSeconds);
  return {
    persistence: { kind: "remembered", deadlineEpochSeconds },
    markerValue: `${payload}.${markerSignature(payload, secret)}`,
  };
}

export function resolveSessionPersistence(
  markerValue: string | null | undefined,
  options: PersistenceOptions = {},
): SessionPersistence {
  const now = options.now ?? new Date();
  const secret = options.secret ?? readSessionPersistenceSecret();
  if (!markerValue || !validSecret(secret)) return TEMPORARY_SESSION;

  const match = markerValue.match(/^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return TEMPORARY_SESSION;

  const deadlineEpochSeconds = Number(match[1]);
  if (!isValidRememberedDeadline(deadlineEpochSeconds, now)) return TEMPORARY_SESSION;

  const payload = markerPayload(deadlineEpochSeconds);
  if (!signaturesMatch(match[2]!, markerSignature(payload, secret))) return TEMPORARY_SESSION;

  return { kind: "remembered", deadlineEpochSeconds };
}

export function applyAuthCookiePolicy(
  originalOptions: CookieOptions,
  persistence: SessionPersistence,
  options: CookiePolicyOptions = {},
): CookieOptions {
  const now = options.now ?? new Date();
  const applicationOrigin = options.applicationOrigin ?? process.env.APP_ORIGIN;
  const production = options.production ?? process.env.NODE_ENV === "production";
  const allowInsecureLoopback = options.allowInsecureLoopback ?? hasExplicitLocalQaCookieOverride();
  const isRemoval = originalOptions.maxAge === 0;
  const result: CookieOptions = {
    ...originalOptions,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isHttpsOrigin(applicationOrigin, production, allowInsecureLoopback),
  };

  delete result.expires;

  if (isRemoval) {
    result.maxAge = 0;
    return result;
  }

  delete result.maxAge;

  if (
    persistence.kind === "remembered" &&
    isValidRememberedDeadline(persistence.deadlineEpochSeconds, now)
  ) {
    result.maxAge = persistence.deadlineEpochSeconds - currentEpochSeconds(now);
    result.expires = new Date(persistence.deadlineEpochSeconds * 1000);
  }

  return result;
}

export function buildSessionPersistenceCookie(
  issued: IssuedSessionPersistence,
  options: CookiePolicyOptions = {},
): SessionPersistenceCookie {
  if (issued.markerValue === null) {
    return {
      name: SESSION_PERSISTENCE_COOKIE_NAME,
      value: "",
      options: applyAuthCookiePolicy({ maxAge: 0 }, issued.persistence, options),
    };
  }

  return {
    name: SESSION_PERSISTENCE_COOKIE_NAME,
    value: issued.markerValue,
    options: applyAuthCookiePolicy({}, issued.persistence, options),
  };
}
