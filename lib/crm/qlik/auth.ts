import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { AvailableQlikRelayConfiguration } from "./config";
import { QLIK_RELAY_MAX_CLOCK_SKEW_MS } from "./config";

const RELAY_PATH = "/api/ingest/qlik";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?Z$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type QlikRelayAuthentication =
  | { ok: false }
  | {
      ok: true;
      keyId: string;
      nonceHash: string;
      requestedAt: string;
      bodySha256: string;
    };

function equalHex(left: string, right: string): boolean {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function qlikRelayBodySha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function qlikRelayCanonicalRequest(input: {
  keyId: string;
  timestamp: string;
  nonce: string;
  bodySha256: string;
}): string {
  return ["POST", RELAY_PATH, input.keyId, input.timestamp, input.nonce, input.bodySha256].join(
    "\n",
  );
}

export function createQlikRelaySignature(
  secret: string,
  input: { keyId: string; timestamp: string; nonce: string; bodySha256: string },
): string {
  return createHmac("sha256", secret).update(qlikRelayCanonicalRequest(input)).digest("hex");
}

function parseStrictUtcTimestamp(value: string): number | null {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const parsed = new Date(timestamp);
  const parts = match.slice(1, 7).map(Number);
  if (
    parsed.getUTCFullYear() !== parts[0] ||
    parsed.getUTCMonth() + 1 !== parts[1] ||
    parsed.getUTCDate() !== parts[2] ||
    parsed.getUTCHours() !== parts[3] ||
    parsed.getUTCMinutes() !== parts[4] ||
    parsed.getUTCSeconds() !== parts[5]
  ) {
    return null;
  }
  return timestamp;
}

export function authenticateQlikRelayRequest(
  request: Request,
  body: Uint8Array,
  configuration: AvailableQlikRelayConfiguration,
  now: Date = new Date(),
): QlikRelayAuthentication {
  const keyId = request.headers.get("x-crm-relay-key-id") ?? "";
  const requestedAt = request.headers.get("x-crm-relay-timestamp") ?? "";
  const nonce = request.headers.get("x-crm-relay-nonce") ?? "";
  const declaredDigest = request.headers.get("x-crm-relay-content-sha256") ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const signature = authorization.match(/^HMAC-SHA256 ([0-9a-f]{64})$/)?.[1] ?? "";

  if (
    keyId !== configuration.keyId ||
    !ISO_TIMESTAMP_PATTERN.test(requestedAt) ||
    !UUID_V4_PATTERN.test(nonce) ||
    !SHA256_PATTERN.test(declaredDigest) ||
    !SHA256_PATTERN.test(signature)
  ) {
    return { ok: false };
  }

  const requestedTime = parseStrictUtcTimestamp(requestedAt);
  if (
    requestedTime === null ||
    Math.abs(now.getTime() - requestedTime) > QLIK_RELAY_MAX_CLOCK_SKEW_MS
  ) {
    return { ok: false };
  }

  const bodySha256 = qlikRelayBodySha256(body);
  if (!equalHex(bodySha256, declaredDigest)) return { ok: false };

  const expectedSignature = createQlikRelaySignature(configuration.hmacSecret, {
    keyId,
    timestamp: requestedAt,
    nonce,
    bodySha256,
  });
  if (!equalHex(signature, expectedSignature)) return { ok: false };

  return {
    ok: true,
    keyId,
    nonceHash: createHash("sha256").update(nonce).digest("hex"),
    requestedAt,
    bodySha256,
  };
}
