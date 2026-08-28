import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "@/next.config";
import { config as proxyConfig } from "@/proxy";
import {
  authenticateQlikRelayRequest,
  createQlikRelaySignature,
  qlikRelayBodySha256,
  qlikRelayCanonicalRequest,
} from "@/lib/crm/qlik/auth";
import {
  getQlikRelayConfiguration,
  QLIK_RELAY_MAX_BODY_BYTES,
  type AvailableQlikRelayConfiguration,
} from "@/lib/crm/qlik/config";
import type { QlikRelayDatabaseResult } from "@/lib/crm/qlik/database";
import { handleQlikRelayPost } from "@/lib/crm/qlik/handler";
import { emitQlikRelayTelemetry } from "@/lib/crm/qlik/telemetry";

const ENDPOINT = "https://crm.example.com/api/ingest/qlik";
const NOW = new Date("2026-08-10T12:00:00.000Z");
const KEY_ID = "qa.qlik-relay";
const HMAC_SECRET = "q".repeat(43);
const DATABASE_URL =
  "postgresql://crm_qlik_relay:local-test-password@127.0.0.1:54322/postgres?sslmode=verify-full";
const NONCE = "8a6f5b44-4d58-4cf5-b329-7acfa4ef4101";

type QlikRelayRuntimeEnvironment = NonNullable<Parameters<typeof getQlikRelayConfiguration>[0]>;

function validPayload() {
  return {
    schemaVersion: 1,
    requestId: "60000000-0000-4000-8000-000000000001",
    referenceYear: 2026,
    generatedAt: "2026-01-15T12:00:00.000Z",
    sourceUpdatedAt: "2026-01-15T11:55:00.000Z",
    entries: [
      {
        periodMonth: "2026-01-01",
        imobKey: "imob.qa",
        imobName: "Imobiliaria QA",
        vgv: "123.45",
        contracts: 2,
        sourceRankVgv: 1,
        sourceRankContracts: 1,
      },
    ],
    developments: [
      {
        periodMonth: "2026-01-01",
        businessUnit: "Unidade QA",
        developmentKey: "development.qa",
        developmentName: "Empreendimento QA",
        vgv: "123.45",
        contracts: 2,
        sourceRankVgv: 1,
        sourceRankContracts: 1,
      },
    ],
  };
}

function availableConfiguration(
  mode: AvailableQlikRelayConfiguration["mode"] = "active",
): AvailableQlikRelayConfiguration {
  return {
    mode,
    available: true,
    writeEnabled: mode !== "shadow",
    keyId: KEY_ID,
    hmacSecret: HMAC_SECRET,
    databaseUrl: DATABASE_URL,
  };
}

type SignedRequestOptions = {
  body?: string | Uint8Array;
  contentType?: string | null;
  declaredDigest?: string;
  headers?: HeadersInit;
  keyId?: string;
  signatureKeyId?: string;
  method?: string;
  nonce?: string;
  signature?: string;
  signatureSecret?: string;
  timestamp?: string;
  url?: string;
};

function signedRequest(options: SignedRequestOptions = {}): Request {
  const body = options.body ?? JSON.stringify(validPayload());
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const timestamp = options.timestamp ?? NOW.toISOString();
  const nonce = options.nonce ?? NONCE;
  const keyId = options.keyId ?? KEY_ID;
  const declaredDigest = options.declaredDigest ?? qlikRelayBodySha256(bytes);
  const signature =
    options.signature ??
    createQlikRelaySignature(options.signatureSecret ?? HMAC_SECRET, {
      keyId: options.signatureKeyId ?? keyId,
      timestamp,
      nonce,
      bodySha256: declaredDigest,
    });
  const headers = new Headers(options.headers);
  if (options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  headers.set("x-crm-relay-key-id", keyId);
  headers.set("x-crm-relay-timestamp", timestamp);
  headers.set("x-crm-relay-nonce", nonce);
  headers.set("x-crm-relay-content-sha256", declaredDigest);
  headers.set("authorization", `HMAC-SHA256 ${signature}`);

  return new Request(options.url ?? ENDPOINT, {
    method: options.method ?? "POST",
    headers,
    body: bytes as BodyInit,
  });
}

function handlerHarness(input: {
  configuration?: AvailableQlikRelayConfiguration;
  result?: QlikRelayDatabaseResult;
  error?: Error;
}) {
  const execute = input.error
    ? vi.fn(async (databaseInput: unknown) => {
        void databaseInput;
        throw input.error;
      })
    : vi.fn(async (databaseInput: unknown) => {
        void databaseInput;
        return Promise.resolve(
          input.result ?? {
            ok: true,
            status: "succeeded" as const,
            runId: validPayload().requestId,
            recordCount: 1,
            developmentRecordCount: 1,
            idempotent: false,
          },
        );
      });
  const emit = vi.fn();

  return {
    emit,
    execute,
    dependencies: {
      configuration: () => input.configuration ?? availableConfiguration(),
      execute,
      emit,
      now: () => NOW,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Qlik relay configuration", () => {
  const validEnvironment: QlikRelayRuntimeEnvironment = {
    NODE_ENV: "test",
    QLIK_RELAY_MODE: "shadow",
    QLIK_RELAY_WRITE_ENABLED: "false",
    QLIK_RELAY_KEY_ID: KEY_ID,
    QLIK_RELAY_HMAC_SECRET: HMAC_SECRET,
    QLIK_RELAY_DATABASE_URL: DATABASE_URL,
    SUPABASE_SECRET_KEY: `sb_secret_${"s".repeat(24)}`,
  };

  it.each([undefined, "", "false", "unexpected"])("keeps unknown mode %s off", (mode) => {
    expect(getQlikRelayConfiguration({ ...validEnvironment, QLIK_RELAY_MODE: mode })).toEqual({
      mode: "off",
      available: false,
      writeEnabled: false,
    });
  });

  it("accepts only consistent shadow and writable modes", () => {
    expect(getQlikRelayConfiguration(validEnvironment)).toMatchObject({
      mode: "shadow",
      available: true,
      writeEnabled: false,
    });
    expect(
      getQlikRelayConfiguration({
        ...validEnvironment,
        QLIK_RELAY_MODE: "canary",
        QLIK_RELAY_WRITE_ENABLED: "true",
      }),
    ).toMatchObject({ mode: "canary", available: true, writeEnabled: true });
    expect(
      getQlikRelayConfiguration({ ...validEnvironment, QLIK_RELAY_WRITE_ENABLED: "true" }),
    ).toMatchObject({ mode: "shadow", available: false, writeEnabled: false });
    expect(
      getQlikRelayConfiguration({ ...validEnvironment, QLIK_RELAY_MODE: "active" }),
    ).toMatchObject({ mode: "active", available: false, writeEnabled: false });
  });

  it.each<{
    label: string;
    patch: QlikRelayRuntimeEnvironment;
  }>([
    { label: "missing key ID", patch: { QLIK_RELAY_KEY_ID: "" } },
    { label: "unsafe key ID", patch: { QLIK_RELAY_KEY_ID: "QA Relay" } },
    { label: "oversized key ID", patch: { QLIK_RELAY_KEY_ID: "q".repeat(101) } },
    { label: "short HMAC secret", patch: { QLIK_RELAY_HMAC_SECRET: "short" } },
    {
      label: "reused Supabase secret",
      patch: { QLIK_RELAY_HMAC_SECRET: HMAC_SECRET, SUPABASE_SECRET_KEY: HMAC_SECRET },
    },
    { label: "missing database URL", patch: { QLIK_RELAY_DATABASE_URL: "" } },
    {
      label: "HMAC secret reused as database password",
      patch: {
        QLIK_RELAY_DATABASE_URL: `postgresql://crm_qlik_relay:${HMAC_SECRET}@127.0.0.1:54322/postgres?sslmode=verify-full`,
      },
    },
    {
      label: "service role database user",
      patch: {
        QLIK_RELAY_DATABASE_URL:
          "postgresql://service_role:local-test-password@127.0.0.1:54322/postgres?sslmode=verify-full",
      },
    },
    {
      label: "postgres database user",
      patch: {
        QLIK_RELAY_DATABASE_URL:
          "postgresql://postgres:local-test-password@127.0.0.1:54322/postgres?sslmode=verify-full",
      },
    },
    {
      label: "missing TLS mode",
      patch: {
        QLIK_RELAY_DATABASE_URL:
          "postgresql://crm_qlik_relay:local-test-password@127.0.0.1:54322/postgres",
      },
    },
    {
      label: "TLS mode without certificate verification",
      patch: {
        QLIK_RELAY_DATABASE_URL:
          "postgresql://crm_qlik_relay:local-test-password@127.0.0.1:54322/postgres?sslmode=require",
      },
    },
    {
      label: "extra connection option",
      patch: { QLIK_RELAY_DATABASE_URL: `${DATABASE_URL}&application_name=override` },
    },
  ])("fails closed for $label", ({ patch }) => {
    expect(getQlikRelayConfiguration({ ...validEnvironment, ...patch })).toMatchObject({
      available: false,
      writeEnabled: false,
    });
  });

  it("requires a Supabase host in production", () => {
    expect(
      getQlikRelayConfiguration({
        ...validEnvironment,
        NODE_ENV: "production",
        QLIK_RELAY_DATABASE_URL: DATABASE_URL,
      }),
    ).toMatchObject({ available: false });

    expect(
      getQlikRelayConfiguration({
        ...validEnvironment,
        NODE_ENV: "production",
        QLIK_RELAY_DATABASE_URL:
          "postgresql://crm_qlik_relay.project:local-test-password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
      }),
    ).toMatchObject({ available: true });
  });
});

describe("Qlik relay HMAC", () => {
  it("uses a stable canonical request and authenticates valid bytes", () => {
    const body = new TextEncoder().encode(JSON.stringify(validPayload()));
    const bodySha256 = qlikRelayBodySha256(body);
    const request = signedRequest({ body });

    expect(
      qlikRelayCanonicalRequest({
        keyId: KEY_ID,
        timestamp: NOW.toISOString(),
        nonce: NONCE,
        bodySha256,
      }),
    ).toBe(`POST\n/api/ingest/qlik\n${KEY_ID}\n${NOW.toISOString()}\n${NONCE}\n${bodySha256}`);
    expect(authenticateQlikRelayRequest(request, body, availableConfiguration(), NOW)).toEqual({
      ok: true,
      keyId: KEY_ID,
      nonceHash: createHash("sha256").update(NONCE).digest("hex"),
      requestedAt: NOW.toISOString(),
      bodySha256,
    });
  });

  it.each([
    {
      label: "wrong key ID",
      request: () => signedRequest({ keyId: "unknown.caller" }),
    },
    {
      label: "key ID swapped after signing",
      request: () => signedRequest({ keyId: KEY_ID, signatureKeyId: "previous.qlik-relay" }),
    },
    {
      label: "wrong secret",
      request: () => signedRequest({ signatureSecret: "x".repeat(43) }),
    },
    {
      label: "malformed signature",
      request: () => signedRequest({ signature: "a".repeat(63) }),
    },
    {
      label: "malformed nonce",
      request: () => signedRequest({ nonce: "not-a-uuid" }),
    },
    {
      label: "non-v4 nonce",
      request: () => signedRequest({ nonce: "8a6f5b44-4d58-3cf5-b329-7acfa4ef4101" }),
    },
    {
      label: "malformed timestamp",
      request: () => signedRequest({ timestamp: "2026-08-10T12:00:00+00:00" }),
    },
    {
      label: "invalid calendar timestamp",
      request: () => signedRequest({ timestamp: "2026-08-10T12:60:00Z" }),
    },
    {
      label: "stale timestamp",
      request: () => signedRequest({ timestamp: "2026-08-10T11:54:59.999Z" }),
    },
    {
      label: "future timestamp",
      request: () => signedRequest({ timestamp: "2026-08-10T12:05:00.001Z" }),
    },
  ])("rejects $label", ({ request }) => {
    const signed = request();
    const body = new TextEncoder().encode(JSON.stringify(validPayload()));
    expect(authenticateQlikRelayRequest(signed, body, availableConfiguration(), NOW)).toEqual({
      ok: false,
    });
  });

  it("accepts the exact five-minute clock boundary", () => {
    const body = new TextEncoder().encode(JSON.stringify(validPayload()));
    const past = signedRequest({ timestamp: "2026-08-10T11:55:00.000Z", body });
    const future = signedRequest({ timestamp: "2026-08-10T12:05:00.000Z", body });

    expect(authenticateQlikRelayRequest(past, body, availableConfiguration(), NOW).ok).toBe(true);
    expect(authenticateQlikRelayRequest(future, body, availableConfiguration(), NOW).ok).toBe(true);
  });

  it("rejects body and declared-digest tampering", () => {
    const original = new TextEncoder().encode(JSON.stringify(validPayload()));
    const tampered = new TextEncoder().encode(
      JSON.stringify({ ...validPayload(), referenceYear: 2027 }),
    );
    const originalDigest = qlikRelayBodySha256(original);
    const request = signedRequest({ body: tampered, declaredDigest: originalDigest });

    expect(authenticateQlikRelayRequest(request, tampered, availableConfiguration(), NOW)).toEqual({
      ok: false,
    });
  });
});

describe("Qlik relay HTTP boundary", () => {
  it("short-circuits off mode before touching request body or database", async () => {
    let bodyTouched = false;
    const request = {
      url: ENDPOINT,
      headers: new Headers(),
      get body() {
        bodyTouched = true;
        throw new Error("body must remain unread");
      },
    } as unknown as Request;
    const execute = vi.fn();
    const emit = vi.fn();

    const response = await handleQlikRelayPost(request, {
      configuration: () => ({ mode: "off", available: false, writeEnabled: false }),
      execute,
      emit,
      now: () => NOW,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "ingestion_unavailable" });
    expect(bodyTouched).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unavailable", httpStatus: 404, mode: "off" }),
    );
  });

  it("reports non-off runtime misconfiguration as unavailable", async () => {
    const execute = vi.fn();
    const emit = vi.fn();
    const response = await handleQlikRelayPost(signedRequest(), {
      configuration: () => ({ mode: "active", available: false, writeEnabled: false }),
      execute,
      emit,
      now: () => NOW,
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "ingestion_unavailable" });
    expect(execute).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unavailable", httpStatus: 503, mode: "active" }),
    );
  });

  it.each([
    {
      label: "query string",
      request: () => signedRequest({ url: `${ENDPOINT}?mode=active` }),
      status: 415,
      error: "unsupported_media_type",
      outcome: "invalid_content_type",
    },
    {
      label: "content encoding",
      request: () => signedRequest({ headers: { "content-encoding": "gzip" } }),
      status: 415,
      error: "unsupported_media_type",
      outcome: "invalid_content_type",
    },
    {
      label: "missing content type",
      request: () => signedRequest({ contentType: null }),
      status: 415,
      error: "unsupported_media_type",
      outcome: "invalid_content_type",
    },
    {
      label: "wrong content type",
      request: () => signedRequest({ contentType: "text/plain" }),
      status: 415,
      error: "unsupported_media_type",
      outcome: "invalid_content_type",
    },
    {
      label: "malformed content length",
      request: () => signedRequest({ headers: { "content-length": "1e6" } }),
      status: 400,
      error: "invalid_payload",
      outcome: "invalid_payload",
    },
    {
      label: "declared oversized body",
      request: () =>
        signedRequest({ headers: { "content-length": String(QLIK_RELAY_MAX_BODY_BYTES + 1) } }),
      status: 413,
      error: "payload_too_large",
      outcome: "payload_too_large",
    },
  ])("rejects $label before database execution", async (testCase) => {
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(testCase.request(), harness.dependencies);

    expect(response.status).toBe(testCase.status);
    await expect(response.json()).resolves.toEqual({ error: testCase.error });
    expect(harness.execute).not.toHaveBeenCalled();
    expect(harness.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: testCase.outcome, httpStatus: testCase.status }),
    );
  });

  it("accepts application/json with an explicit UTF-8 charset", async () => {
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(
      signedRequest({ contentType: "Application/JSON; charset=UTF-8" }),
      harness.dependencies,
    );

    expect(response.status).toBe(201);
    expect(harness.execute).toHaveBeenCalledOnce();
  });

  it("limits streamed bytes even without Content-Length", async () => {
    const body = new Uint8Array(QLIK_RELAY_MAX_BODY_BYTES + 1);
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(signedRequest({ body }), harness.dependencies);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "payload_too_large" });
    expect(harness.execute).not.toHaveBeenCalled();
  });

  it("authenticates before parsing and rejects an altered signature", async () => {
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(
      signedRequest({ signatureSecret: "x".repeat(43) }),
      harness.dependencies,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(harness.execute).not.toHaveBeenCalled();
    expect(harness.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unauthorized", httpStatus: 401 }),
    );
  });

  it.each([
    { label: "invalid JSON", body: "{" },
    { label: "invalid UTF-8", body: new Uint8Array([0xc3, 0x28]) },
    {
      label: "invalid schema",
      body: JSON.stringify({ ...validPayload(), schemaVersion: 2 }),
    },
  ])("rejects signed $label without exposing validation details", async ({ body }) => {
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(signedRequest({ body }), harness.dependencies);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_payload" });
    expect(harness.execute).not.toHaveBeenCalled();
    expect(harness.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "invalid_payload", httpStatus: 400 }),
    );
  });

  it("passes only authenticated envelope metadata and parsed payload to database", async () => {
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(signedRequest(), harness.dependencies);

    expect(response.status).toBe(201);
    expect(harness.execute).toHaveBeenCalledWith({
      databaseUrl: DATABASE_URL,
      payload: validPayload(),
      mode: "active",
      keyId: KEY_ID,
      requestedAt: NOW.toISOString(),
      nonceHash: createHash("sha256").update(NONCE).digest("hex"),
      bodySha256: qlikRelayBodySha256(new TextEncoder().encode(JSON.stringify(validPayload()))),
    });
    expect(harness.execute.mock.calls[0]?.[0]).not.toHaveProperty("hmacSecret");
  });

  it.each([
    {
      label: "shadow comparison",
      result: {
        ok: true,
        status: "shadow_compared",
        runId: validPayload().requestId,
        recordCount: 1,
        developmentRecordCount: 1,
        comparisonStatus: "matched",
      } satisfies QlikRelayDatabaseResult,
      status: 202,
      outcome: "shadow_compared",
      error: null,
    },
    {
      label: "new snapshot",
      result: {
        ok: true,
        status: "succeeded",
        runId: validPayload().requestId,
        recordCount: 1,
        developmentRecordCount: 1,
        idempotent: false,
      } satisfies QlikRelayDatabaseResult,
      status: 201,
      outcome: "succeeded",
      error: null,
    },
    {
      label: "idempotent snapshot",
      result: {
        ok: true,
        status: "succeeded",
        runId: validPayload().requestId,
        recordCount: 1,
        idempotent: true,
      } satisfies QlikRelayDatabaseResult,
      status: 200,
      outcome: "succeeded",
      error: null,
    },
    {
      label: "nonce replay",
      result: {
        ok: false,
        status: "rejected",
        reason: "replay_conflict",
        replay: true,
      } satisfies QlikRelayDatabaseResult,
      status: 409,
      outcome: "rejected",
      error: "ingestion_conflict",
    },
    {
      label: "request conflict",
      result: {
        ok: false,
        status: "rejected",
        reason: "request_conflict",
      } satisfies QlikRelayDatabaseResult,
      status: 409,
      outcome: "rejected",
      error: "ingestion_conflict",
    },
    {
      label: "database payload rejection",
      result: {
        ok: false,
        status: "rejected",
        reason: "invalid_payload",
      } satisfies QlikRelayDatabaseResult,
      status: 422,
      outcome: "rejected",
      error: "ingestion_rejected",
    },
    {
      label: "rate limit",
      result: {
        ok: false,
        status: "rejected",
        reason: "rate_limited",
      } satisfies QlikRelayDatabaseResult,
      status: 429,
      outcome: "rate_limited",
      error: "rate_limited",
    },
    {
      label: "closed cutover gate",
      result: {
        ok: false,
        status: "gate_blocked",
        reason: "cutover_gate_closed",
      } satisfies QlikRelayDatabaseResult,
      status: 503,
      outcome: "rejected",
      error: "ingestion_unavailable",
    },
  ])("maps $label database outcome", async (testCase) => {
    const harness = handlerHarness({ result: testCase.result });
    const response = await handleQlikRelayPost(signedRequest(), harness.dependencies);
    const responseBody = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(testCase.status);
    if (testCase.error) expect(responseBody.error).toBe(testCase.error);
    else expect(responseBody.ok).toBe(true);
    expect(harness.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: testCase.outcome, httpStatus: testCase.status }),
    );
    if (testCase.status === 429) expect(response.headers.get("retry-after")).toBe("60");
  });

  it("maps database failures to a sanitized unavailable response", async () => {
    const harness = handlerHarness({ error: new Error("database secret and SQL details") });
    const response = await handleQlikRelayPost(signedRequest(), harness.dependencies);
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toContain("ingestion_unavailable");
    expect(serialized).not.toContain("database secret");
    expect(harness.emit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "database_unavailable", httpStatus: 503 }),
    );
  });

  it("applies no-store and security headers to relay responses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const harness = handlerHarness({});
    const response = await handleQlikRelayPost(signedRequest(), harness.dependencies);

    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});

describe("Qlik relay telemetry and least privilege", () => {
  it("logs only allowlisted telemetry and fingerprints the credential ID", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    emitQlikRelayTelemetry({
      correlationId: "70000000-0000-4000-8000-000000000001",
      outcome: "succeeded",
      httpStatus: 201,
      mode: "active",
      durationMs: 12.6,
      requestId: validPayload().requestId,
      keyId: KEY_ID,
      recordCount: 1,
      developmentRecordCount: 1,
      idempotent: false,
    });

    const serialized = String(info.mock.calls[0]?.[0]);
    const event = JSON.parse(serialized) as Record<string, unknown>;
    expect(event).toEqual({
      event: "crm.qlik_relay",
      correlationId: "70000000-0000-4000-8000-000000000001",
      outcome: "succeeded",
      httpStatus: 201,
      mode: "active",
      durationMs: 13,
      requestId: validPayload().requestId,
      keyFingerprint: createHash("sha256").update(KEY_ID).digest("hex").slice(0, 12),
      recordCount: 1,
      developmentRecordCount: 1,
      comparisonStatus: null,
      idempotent: false,
    });
    expect(serialized).not.toContain(KEY_ID);
    expect(serialized).not.toContain(HMAC_SECRET);
    expect(serialized).not.toMatch(/authorization|nonce|bodySha256|databaseUrl/i);
  });

  it("keeps relay database code off privileged Supabase clients", () => {
    const source = readFileSync(new URL("../lib/crm/qlik/database.ts", import.meta.url), "utf8");
    expect(source).toContain("qlik_relay.ingest_snapshot");
    expect(source).toContain("ssl: { rejectUnauthorized: true }");
    expect(source).not.toContain('ssl: "require"');
    expect(source).not.toMatch(/createPrivilegedClient|SUPABASE_SECRET_KEY|service_role/);
  });

  it("forces explicit HMAC handling when the relay key ID rotates", () => {
    const source = readFileSync(
      new URL("../deploy/system/descomplica-configure-env", import.meta.url),
      "utf8",
    );
    expect(source).toContain('previous_relay_key_id="${values[QLIK_RELAY_KEY_ID]:-}"');
    expect(source).toContain('"${values[QLIK_RELAY_KEY_ID]}" == "${previous_relay_key_id}"');
    expect(source).toContain("Preservar o HMAC existente para o mesmo key ID?");
    expect(source).toContain('values[QLIK_RELAY_HMAC_SECRET]="$(openssl rand -hex 32)"');
  });

  it("removes relay credentials from the managed environment when mode is off", () => {
    const source = readFileSync(
      new URL("../deploy/system/descomplica-configure-env", import.meta.url),
      "utf8",
    );
    const offBranch = source.slice(
      source.indexOf("else\n    unset 'values[QLIK_RELAY_KEY_ID]'"),
      source.indexOf(
        "\n  fi\n\n  values[QLIK_RELAY_MODE]",
        source.indexOf("configure_qlik_relay()"),
      ),
    );
    const outputBlock = source.slice(source.indexOf("  printf 'QLIK_RELAY_MODE=%s"));

    expect(offBranch).toContain("unset 'values[QLIK_RELAY_KEY_ID]'");
    expect(offBranch).toContain("unset 'values[QLIK_RELAY_HMAC_SECRET]'");
    expect(offBranch).toContain("unset 'values[QLIK_RELAY_DATABASE_URL]'");
    expect(outputBlock).toContain('if [[ "${values[QLIK_RELAY_MODE]}" != "off" ]]');
  });

  it("keeps the legacy publisher intact in the additive bridge", () => {
    const source = readFileSync(
      new URL(
        "../supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const executableSql = source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    expect(executableSql).not.toContain("publish_crm_imob_ranking(jsonb,text)");
    expect(executableSql).not.toContain("publish_crm_imob_ranking(jsonb, text)");
  });

  it("excludes only the Qlik relay namespace from Supabase session proxying", () => {
    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config: proxyConfig, nextConfig, url });

    expect(matches("/api/ingest/qlik")).toBe(false);
    expect(matches("/api/ingest/qlik/")).toBe(false);
    expect(matches("/api/ingest/qlik/internal")).toBe(false);
    expect(matches("/api/ingest/qlik-other")).toBe(true);
    expect(matches("/api/ingest/salesforce")).toBe(true);
    expect(matches("/app/dashboard")).toBe(true);
  });
});
