import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_INGESTION_BODY_BYTES = 1_000_000;

export function secretsMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected || expected.length < 32) return false;
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function normalizedOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request, applicationOrigin?: string): boolean {
  const origin = normalizedOrigin(request.headers.get("origin"));
  if (!origin) return false;

  const allowed = new Set<string>([new URL(request.url).origin]);
  const configured = normalizedOrigin(applicationOrigin);
  if (configured) allowed.add(configured);

  return allowed.has(origin);
}

export function safeExternalUrl(value: string | undefined, production: boolean): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (production && url.protocol !== "https:") return null;
    if (!production && url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function noStoreHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store, max-age=0");
  headers.set("pragma", "no-cache");
  return headers;
}
