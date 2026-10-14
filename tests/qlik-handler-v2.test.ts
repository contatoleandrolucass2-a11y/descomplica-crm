import { createHash, createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authenticateQlikRelayRequest,
  createQlikRelaySignature,
  qlikRelayBodySha256,
  qlikRelayCanonicalRequest,
} from "@/lib/crm/qlik/auth";
import {
  getQlikV2Configuration,
  QLIK_V2_MAX_BODY_BYTES,
  QLIK_V2_PATH,
  type QlikV2Configuration,
} from "@/lib/crm/qlik/config-v2";
import { handleQlikV2Post } from "@/lib/crm/qlik/handler-v2";
import { createQlikRankingV2Schema, type QlikRankingV2 } from "@/lib/crm/qlik/contracts-v2";

const { privilegedClient } = vi.hoisted(() => ({
  privilegedClient: vi.fn(() => {
    throw new Error("Unexpected database access in an isolated handler test");
  }),
}));
vi.mock("@/lib/auth/supabase/privileged", () => ({
  createPrivilegedClient: privilegedClient,
}));

const NOW = new Date("2026-10-14T12:00:00.000Z");
const KEY_ID = "qlik-ranking-v2";
const SECRET = "q".repeat(43);
const NONCE = "8a6f5b44-4d58-4cf5-b329-7acfa4ef4101";
const V1_PATH = "/api/ingest/qlik";
const ENDPOINT = `https://crm.example.invalid${QLIK_V2_PATH}`;
const configuration = { available: true, keyId: KEY_ID, hmacSecret: SECRET } as const;
const environment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  QLIK_RANKING_V2_ENABLED: "true",
  QLIK_RANKING_V2_HMAC_SECRET: SECRET,
  SUPABASE_SECRET_KEY: "synthetic-database-secret",
};

function validPayload(): QlikRankingV2 {
  return {
    schemaVersion: 2,
    batchId: "60000000-0000-4000-8000-000000000001",
    requestId: "60000000-0000-4000-8000-000000000002",
    startedAt: "2026-10-14T11:50:00.000Z",
    completedAt: "2026-10-14T11:55:00.000Z",
    source: {
      appId: "7c000871-8b32-4c0f-bfd5-4b9d46946575",
      sheetId: "46d5bcf7-965d-40fc-a808-2fdde2d0f74d",
      mappingSha256: "b".repeat(64),
      reloadTimestamp: "2026-10-14T11:45:00.000Z",
    },
    scope: { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" },
    months: [
      {
        periodMonth: "2026-10-01",
        imobs: {
          coverage: { state: "complete", sourceRows: 1 },
          nativeTotals: { vgv: "100.01", contracts: 1 },
          rows: [{ key: "imob.qa", name: "Imobiliaria QA", vgv: "100.01", contracts: 1 }],
        },
        developments: {
          coverage: { state: "complete", sourceRows: 1 },
          nativeTotals: { vgv: "200.02", contracts: 3 },
          rows: [{ key: "development.qa", name: "Empreendimento QA", vgv: "200.02", contracts: 3 }],
        },
      },
    ],
  };
}

type RequestOptions = {
  body?: string | Uint8Array;
  path?: string;
  method?: string;
  signingPath?: typeof V1_PATH | typeof QLIK_V2_PATH;
  keyId?: string;
  timestamp?: string;
  nonce?: string;
  digest?: string;
  secret?: string;
  signature?: string;
  contentType?: string | null;
  headers?: HeadersInit;
};

function signedRequest(options: RequestOptions = {}) {
  const body = options.body ?? "{}";
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const input = {
    keyId: options.keyId ?? KEY_ID,
    timestamp: options.timestamp ?? NOW.toISOString(),
    nonce: options.nonce ?? NONCE,
    bodySha256: options.digest ?? qlikRelayBodySha256(bytes),
  };
  const signature =
    options.signature ??
    createQlikRelaySignature(options.secret ?? SECRET, input, options.signingPath ?? QLIK_V2_PATH);
  const headers = new Headers(options.headers);
  if (options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  headers.set("x-crm-relay-key-id", input.keyId);
  headers.set("x-crm-relay-timestamp", input.timestamp);
  headers.set("x-crm-relay-nonce", input.nonce);
  headers.set("x-crm-relay-content-sha256", input.bodySha256);
  headers.set("authorization", `HMAC-SHA256 ${signature}`);
  return new Request(options.path ? `https://crm.example.invalid${options.path}` : ENDPOINT, {
    method: options.method ?? "POST",
    headers,
    body: bytes as BodyInit,
  });
}

function harness(
  result: unknown = {
    ok: true,
    status: "staged",
    requestId: validPayload().requestId,
    contentSha256: "a".repeat(64),
    idempotent: false,
  },
) {
  const execute = vi.fn(async (...args: unknown[]) => {
    void args;
    return result;
  });
  return {
    execute,
    dependencies: {
      configuration: (): QlikV2Configuration => configuration,
      execute,
      now: () => NOW,
    },
  };
}

afterEach(() => {
  expect(privilegedClient).not.toHaveBeenCalled();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Qlik v2 configuration", () => {
  it("requires explicit activation and fixes the v2 credential ID", () => {
    expect(getQlikV2Configuration(environment)).toEqual(configuration);
  });

  it.each([undefined, "", "false", "TRUE", "1"])("stays off for enabled=%s", (enabled) => {
    expect(getQlikV2Configuration({ ...environment, QLIK_RANKING_V2_ENABLED: enabled })).toEqual({
      available: false,
    });
  });

  it.each([undefined, "", "q".repeat(42), "q".repeat(129), "!".repeat(43), "q".repeat(42) + " "])(
    "rejects malformed secret %s",
    (secret) => {
      expect(
        getQlikV2Configuration({ ...environment, QLIK_RANKING_V2_HMAC_SECRET: secret }),
      ).toEqual({ available: false });
    },
  );

  it.each(["SUPABASE_SECRET_KEY", "QLIK_RELAY_HMAC_SECRET", "SALESFORCE_INGEST_SECRET"])(
    "rejects reuse of %s",
    (key) => {
      expect(getQlikV2Configuration({ ...environment, [key]: SECRET })).toEqual({
        available: false,
      });
    },
  );

  it.each([undefined, ""])("rejects absent database secret %s", (secret) => {
    expect(getQlikV2Configuration({ ...environment, SUPABASE_SECRET_KEY: secret })).toEqual({
      available: false,
    });
  });
});

describe("Qlik v2 HMAC boundary", () => {
  const body = new TextEncoder().encode("{}");

  it("binds exact bytes, method, v2 path and fixed key ID to the signature", () => {
    const input = {
      keyId: KEY_ID,
      timestamp: NOW.toISOString(),
      nonce: NONCE,
      bodySha256: qlikRelayBodySha256(body),
    };
    const canonical = `POST\n${QLIK_V2_PATH}\n${KEY_ID}\n${input.timestamp}\n${NONCE}\n${input.bodySha256}`;
    expect(qlikRelayCanonicalRequest(input, QLIK_V2_PATH)).toBe(canonical);
    expect(createQlikRelaySignature(SECRET, input, QLIK_V2_PATH)).toBe(
      createHmac("sha256", SECRET).update(canonical).digest("hex"),
    );
    expect(
      authenticateQlikRelayRequest(signedRequest(), body, configuration, NOW, QLIK_V2_PATH),
    ).toEqual({
      ok: true,
      keyId: KEY_ID,
      nonceHash: createHash("sha256").update(NONCE).digest("hex"),
      requestedAt: input.timestamp,
      bodySha256: input.bodySha256,
    });
  });

  it("cannot replay v2 at v1, or v1 at v2, even with the same credential", () => {
    const v2AtV1 = signedRequest({ path: V1_PATH });
    expect(authenticateQlikRelayRequest(v2AtV1, body, configuration, NOW)).toEqual({ ok: false });
    const v1AtV2 = signedRequest({ signingPath: V1_PATH });
    expect(authenticateQlikRelayRequest(v1AtV2, body, configuration, NOW, QLIK_V2_PATH)).toEqual({
      ok: false,
    });
    const v1 = signedRequest({ path: V1_PATH, signingPath: V1_PATH });
    expect(authenticateQlikRelayRequest(v1, body, configuration, NOW).ok).toBe(true);
    expect(authenticateQlikRelayRequest(signedRequest(), body, configuration, NOW)).toEqual({
      ok: false,
    });
    expect(authenticateQlikRelayRequest(v2AtV1, body, configuration, NOW, QLIK_V2_PATH)).toEqual({
      ok: false,
    });
    expect(
      authenticateQlikRelayRequest(
        signedRequest({ method: "PUT" }),
        body,
        configuration,
        NOW,
        QLIK_V2_PATH,
      ),
    ).toEqual({ ok: false });
  });

  it.each([-300_000, 300_000])("accepts the exact skew boundary %s ms", (skew) => {
    const request = signedRequest({ timestamp: new Date(NOW.getTime() + skew).toISOString() });
    expect(authenticateQlikRelayRequest(request, body, configuration, NOW, QLIK_V2_PATH).ok).toBe(
      true,
    );
  });
});

describe("Qlik v2 HTTP rejection before database access", () => {
  it.each([
    { label: "off", env: { ...environment, QLIK_RANKING_V2_ENABLED: "false" } },
    {
      label: "malformed configuration",
      env: { ...environment, QLIK_RANKING_V2_HMAC_SECRET: "short" },
    },
  ])("does not read the body when $label", async ({ env }) => {
    const body = vi.fn(() => {
      throw new Error("Body must remain unread");
    });
    const request = {
      url: ENDPOINT,
      get body() {
        return body();
      },
    } as unknown as Request;
    const h = harness();
    const response = await handleQlikV2Post(request, {
      ...h.dependencies,
      configuration: () => getQlikV2Configuration(env),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "ingestion_unavailable" });
    expect(body).not.toHaveBeenCalled();
    expect(h.execute).not.toHaveBeenCalled();
  });

  it.each<{ label: string; options: RequestOptions; status: number; error: string }>([
    {
      label: "wrong path",
      options: { path: V1_PATH },
      status: 415,
      error: "unsupported_media_type",
    },
    {
      label: "wrong method",
      options: { method: "PUT" },
      status: 415,
      error: "unsupported_media_type",
    },
    {
      label: "query",
      options: { path: `${QLIK_V2_PATH}?mode=publish` },
      status: 415,
      error: "unsupported_media_type",
    },
    {
      label: "encoding",
      options: { headers: { "content-encoding": "gzip" } },
      status: 415,
      error: "unsupported_media_type",
    },
    {
      label: "missing type",
      options: { contentType: null },
      status: 415,
      error: "unsupported_media_type",
    },
    {
      label: "wrong type",
      options: { contentType: "text/plain" },
      status: 415,
      error: "unsupported_media_type",
    },
    {
      label: "invalid length",
      options: { headers: { "content-length": "1e6" } },
      status: 400,
      error: "invalid_payload",
    },
    {
      label: "negative length",
      options: { headers: { "content-length": "-1" } },
      status: 400,
      error: "invalid_payload",
    },
    {
      label: "declared oversized",
      options: { headers: { "content-length": String(QLIK_V2_MAX_BODY_BYTES + 1) } },
      status: 413,
      error: "payload_too_large",
    },
    { label: "invalid JSON", options: { body: "{" }, status: 400, error: "invalid_payload" },
    {
      label: "invalid UTF-8",
      options: { body: new Uint8Array([0xc3, 0x28]) },
      status: 400,
      error: "invalid_payload",
    },
    { label: "invalid schema", options: { body: "{}" }, status: 422, error: "invalid_payload" },
  ])("rejects $label", async ({ options, status, error }) => {
    const h = harness();
    const response = await handleQlikV2Post(signedRequest(options), h.dependencies);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it.each<{ label: string; options: RequestOptions }>([
    { label: "v1 signature", options: { signingPath: V1_PATH } },
    { label: "wrong key ID", options: { keyId: "qlik-ranking-v1" } },
    { label: "wrong secret", options: { secret: "x".repeat(43) } },
    { label: "malformed signature", options: { signature: "a".repeat(63) } },
    { label: "malformed digest", options: { digest: "not-a-sha" } },
    {
      label: "changed body digest",
      options: { digest: qlikRelayBodySha256(new TextEncoder().encode("different")) },
    },
    { label: "malformed nonce", options: { nonce: "not-a-uuid" } },
    { label: "non-v4 nonce", options: { nonce: "8a6f5b44-4d58-3cf5-b329-7acfa4ef4101" } },
    { label: "non-UTC timestamp", options: { timestamp: "2026-10-14T12:00:00+00:00" } },
    { label: "invalid calendar timestamp", options: { timestamp: "2026-02-30T12:00:00Z" } },
    { label: "invalid time", options: { timestamp: "2026-10-14T12:60:00Z" } },
    { label: "stale timestamp", options: { timestamp: "2026-10-14T11:54:59.999Z" } },
    { label: "future timestamp", options: { timestamp: "2026-10-14T12:05:00.001Z" } },
  ])("rejects $label before parsing even malformed JSON", async ({ options }) => {
    const h = harness();
    const response = await handleQlikV2Post(
      signedRequest({ ...options, body: "{" }),
      h.dependencies,
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("bounds actual streamed bytes regardless of a smaller declared length", async () => {
    const h = harness();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(QLIK_V2_MAX_BODY_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "1" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const response = await handleQlikV2Post(request, h.dependencies);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "payload_too_large" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("accepts exactly the byte limit before rejecting the invalid schema", async () => {
    const body = "{}" + " ".repeat(QLIK_V2_MAX_BODY_BYTES - 2);
    const h = harness();
    const response = await handleQlikV2Post(signedRequest({ body }), h.dependencies);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "invalid_payload" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it.each([
    "authorization",
    "x-crm-relay-key-id",
    "x-crm-relay-timestamp",
    "x-crm-relay-nonce",
    "x-crm-relay-content-sha256",
  ])("rejects missing %s before parsing or database access", async (header) => {
    const request = signedRequest({ body: "{" });
    request.headers.delete(header);
    const h = harness();
    const response = await handleQlikV2Post(request, h.dependencies);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("rejects a missing body without database access", async () => {
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const h = harness();
    const response = await handleQlikV2Post(request, h.dependencies);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_payload" });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("sanitizes stream errors and clears the read deadline", async () => {
    vi.useFakeTimers();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("synthetic-private-read-error"));
      },
    });
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const h = harness();
    const response = await handleQlikV2Post(request, h.dependencies);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_payload" });
    expect(stream.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("cancels stalled reads at 15 seconds and releases the reader", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const h = harness();
    const settled = vi.fn();
    const pending = handleQlikV2Post(request, h.dependencies).then((response) => {
      settled();
      return response;
    });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(408);
    await expect(response.json()).resolves.toEqual({ error: "request_timeout" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(h.execute).not.toHaveBeenCalled();
  });
});

describe("Qlik v2 authenticated database outcomes", () => {
  it("uses the real v2 contract without equating the two cube totals", () => {
    const payload = validPayload();
    expect(createQlikRankingV2Schema(() => NOW).parse(payload)).toEqual(payload);
    expect(payload.months[0]!.imobs.nativeTotals).not.toEqual(
      payload.months[0]!.developments.nativeTotals,
    );
  });

  it.each([
    { status: "staged", httpStatus: 202, idempotent: false },
    { status: "published", httpStatus: 200, idempotent: false },
    { status: "published", httpStatus: 200, idempotent: true },
  ])("returns $status with idempotent=$idempotent", async ({ status, httpStatus, idempotent }) => {
    const payload = validPayload();
    const body = JSON.stringify(payload);
    const result = {
      ok: true,
      status,
      requestId: payload.requestId,
      contentSha256: "a".repeat(64),
      idempotent,
    };
    const h = harness(result);
    const response = await handleQlikV2Post(
      signedRequest({ body, contentType: "Application/JSON; charset=UTF-8" }),
      h.dependencies,
    );
    expect(response.status).toBe(httpStatus);
    await expect(response.json()).resolves.toEqual(result);
    expect(h.execute).toHaveBeenCalledExactlyOnceWith(payload, {
      ok: true,
      keyId: KEY_ID,
      nonceHash: createHash("sha256").update(NONCE).digest("hex"),
      requestedAt: NOW.toISOString(),
      bodySha256: qlikRelayBodySha256(new TextEncoder().encode(body)),
    });
    expect(JSON.stringify(h.execute.mock.calls)).not.toContain(SECRET);
  });

  it("accepts PostgreSQL UUID normalization without changing the signed payload", async () => {
    const payload = { ...validPayload(), requestId: "ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF" };
    const result = {
      ok: true,
      status: "published",
      requestId: payload.requestId.toLowerCase(),
      contentSha256: "a".repeat(64),
      idempotent: false,
    };
    const h = harness(result);
    const response = await handleQlikV2Post(
      signedRequest({ body: JSON.stringify(payload) }),
      h.dependencies,
    );
    expect(response.status).toBe(200);
    expect(h.execute.mock.calls[0]?.[0]).toEqual(payload);
    await expect(response.json()).resolves.toEqual(result);
  });

  it.each([
    { reason: "invalid_payload", status: 422 },
    { reason: "request_conflict", status: 409 },
    { reason: "replay_conflict", status: 409 },
    { reason: "batch_conflict", status: 409 },
    { reason: "stale_source", status: 409 },
    { reason: "rate_limited", status: 429 },
    { reason: undefined, status: 409 },
  ])("maps rejection $reason without claiming publication", async ({ reason, status }) => {
    const payload = validPayload();
    const h = harness({ ok: false, status: "rejected", ...(reason ? { reason } : {}) });
    const response = await handleQlikV2Post(
      signedRequest({ body: JSON.stringify(payload) }),
      h.dependencies,
    );
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: reason ?? "ingestion_rejected",
      requestId: payload.requestId,
    });
    expect(response.headers.get("retry-after")).toBe(reason === "rate_limited" ? "60" : null);
    expect(h.execute).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "null", result: null },
    { label: "array", result: [] },
    { label: "missing status", result: { ok: true } },
    { label: "missing publication identity", result: { ok: true, status: "published" } },
    {
      label: "different publication request",
      result: {
        ok: true,
        status: "published",
        requestId: "90000000-0000-4000-8000-000000000009",
        contentSha256: "a".repeat(64),
        idempotent: false,
      },
    },
    { label: "non-boolean success", result: { ok: "true", status: "published" } },
    { label: "unknown status", result: { ok: true, status: "succeeded" } },
    {
      label: "unknown rejection",
      result: { ok: false, status: "rejected", reason: "synthetic-private-error" },
    },
    {
      label: "extra fields",
      result: { ok: true, status: "published", secret: "synthetic-private-error" },
    },
    { label: "invalid request ID", result: { ok: true, status: "published", requestId: "bad-id" } },
    {
      label: "invalid fingerprint",
      result: { ok: true, status: "staged", contentSha256: "bad-hash" },
    },
    {
      label: "non-boolean idempotence",
      result: { ok: true, status: "staged", idempotent: "false" },
    },
    { label: "successful rejection", result: { ok: true, status: "rejected" } },
    { label: "unsuccessful staging", result: { ok: false, status: "staged" } },
    { label: "unsuccessful publication", result: { ok: false, status: "published" } },
    {
      label: "successful stage with reason",
      result: { ok: true, status: "staged", reason: "rate_limited" },
    },
    {
      label: "successful publication with reason",
      result: { ok: true, status: "published", reason: "invalid_payload" },
    },
  ])("fails closed on $label database response", async ({ result }) => {
    const payload = validPayload();
    const h = harness(result);
    const response = await handleQlikV2Post(
      signedRequest({ body: JSON.stringify(payload) }),
      h.dependencies,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ingestion_unavailable",
      requestId: payload.requestId,
    });
    expect(h.execute).toHaveBeenCalledOnce();
  });

  it("redacts thrown database secrets from the response and logs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const payload = validPayload();
    const h = harness();
    h.execute.mockRejectedValueOnce(new Error(`synthetic-private-database-error ${SECRET}`));
    const response = await handleQlikV2Post(
      signedRequest({ body: JSON.stringify(payload) }),
      h.dependencies,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ingestion_unavailable",
      requestId: payload.requestId,
    });
    const emitted = JSON.stringify([
      error.mock.calls,
      warn.mock.calls,
      info.mock.calls,
      log.mock.calls,
    ]);
    expect(emitted).not.toContain(SECRET);
    expect(emitted).not.toContain("synthetic-private-database-error");
  });

  it("retains no-store and security headers on successful and rejected requests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const h = harness();
    for (const request of [
      signedRequest({ body: JSON.stringify(validPayload()) }),
      signedRequest({ secret: "x".repeat(43) }),
    ]) {
      const response = await handleQlikV2Post(request, h.dependencies);
      expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
      expect(response.headers.get("pragma")).toBe("no-cache");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(response.headers.get("strict-transport-security")).toBe(
        "max-age=31536000; includeSubDomains",
      );
    }
  });
});
