import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { publishRankingObservation } from "./publish-ranking.mjs";

const payload = {
  schemaVersion: 2,
  requestId: "11111111-1111-4111-8111-111111111111",
  batchId: "22222222-2222-4222-8222-222222222222",
};
const secret = "a".repeat(43);
const contentSha256 = "f".repeat(64);
const result = (status = "published", extra = {}) => ({
  ok: true,
  status,
  requestId: payload.requestId,
  contentSha256,
  ...extra,
});
const reply = (value, status = 200) => Response.json(value, { status });
const now = () => new Date("2026-10-14T18:00:00.000Z");
const options = { secret, now, wait: async () => {} };

test("publisher fixes origin, v2 HMAC domain and exact immutable UTF8 digest", async () => {
  let calls = 0;
  const response = await publishRankingObservation(payload, {
    ...options,
    fetch: async (url, request) => {
      calls++;
      assert.equal(url, "https://crm.descomplicapro.com.br/api/ingest/qlik/v2");
      assert.equal(request.method, "POST");
      assert.equal(request.redirect, "error");
      assert.equal(request.cache, "no-store");
      const h = request.headers;
      const digest = createHash("sha256").update(request.body).digest("hex");
      assert.equal(h["x-crm-relay-content-sha256"], digest);
      const canonical = [
        "POST",
        "/api/ingest/qlik/v2",
        "qlik-ranking-v2",
        now().toISOString(),
        h["x-crm-relay-nonce"],
        digest,
      ].join("\n");
      assert.equal(
        h.authorization,
        `HMAC-SHA256 ${createHmac("sha256", secret).update(canonical).digest("hex")}`,
      );
      assert.equal(request.body, JSON.stringify(payload));
      return reply(result());
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(response, { state: "published", requestId: payload.requestId, contentSha256 });
});

test("staged is not published and retry preserves request/body with distinct nonce", async () => {
  const sent = [];
  const response = await publishRankingObservation(payload, {
    ...options,
    fetch: async (_, request) => {
      sent.push(request);
      if (sent.length < 3) return new Response(null, { status: sent.length === 1 ? 503 : 429 });
      return reply(result("staged", { idempotent: true }), 202);
    },
  });
  assert.equal(response.state, "staged");
  assert.equal(new Set(sent.map((r) => r.body)).size, 1);
  assert.equal(new Set(sent.map((r) => r.headers["x-crm-relay-nonce"])).size, 3);
});

for (const status of [301, 400, 401, 403, 404, 409, 413, 422]) {
  test(`publisher does not retry HTTP ${status} or expose rejection body`, async () => {
    let calls = 0;
    const response = await publishRankingObservation(payload, {
      ...options,
      fetch: async () => {
        calls++;
        return new Response("private-value", { status });
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(response, { state: "unavailable", reason: "publisher_rejected" });
  });
}

for (const value of [
  null,
  result("staged"),
  result("published", { requestId: payload.batchId }),
  result("published", { contentSha256: "bad" }),
  result("published", { secret }),
  result("published", { contentSha256: [contentSha256] }),
  result("published", { ok: false }),
  result("published", { idempotent: "yes" }),
]) {
  test(`invalid success response fails closed ${JSON.stringify(value)}`, async () => {
    const response = await publishRankingObservation(payload, {
      ...options,
      fetch: async () => reply(value),
    });
    assert.deepEqual(response, { state: "unavailable", reason: "publisher_response" });
  });
}

test("invalid config, payload, oversize and cancellation never send", async () => {
  const fetch = async () => {
    assert.fail("unexpected network");
  };
  for (const s of [undefined, "short", secret + "\n"]) {
    assert.equal(
      (await publishRankingObservation(payload, { secret: s, fetch })).reason,
      "publisher_configuration",
    );
  }
  for (const p of [
    null,
    { ...payload, requestId: "bad" },
    { ...payload, schemaVersion: 1 },
    { ...payload, extra: "x".repeat(4_000_000) },
  ]) {
    assert.equal(
      (await publishRankingObservation(p, { ...options, fetch })).reason,
      "invalid_payload",
    );
  }
  assert.equal(
    (await publishRankingObservation(payload, { ...options, fetch, signal: AbortSignal.abort() }))
      .reason,
    "cancelled",
  );
});

test("transport failure is bounded, redacted and response bytes are bounded", async () => {
  for (const fetch of [
    async () => {
      throw new Error(`private ${secret}`);
    },
    async () => new Response("x".repeat(2049), { headers: { "content-type": "application/json" } }),
    async () => new Response("private", { headers: { "content-type": "text/html" } }),
  ]) {
    let calls = 0;
    const response = await publishRankingObservation(payload, {
      ...options,
      fetch: (...args) => {
        calls++;
        return fetch(...args);
      },
    });
    assert.equal(calls, 3);
    assert.deepEqual(response, { state: "unavailable", reason: "publisher_unavailable" });
  }
});

test("payload mutation during transport does not alter acknowledgment identity", async () => {
  const mutable = { ...payload };
  const response = await publishRankingObservation(mutable, {
    ...options,
    fetch: async () => {
      mutable.requestId = payload.batchId;
      return reply(result());
    },
  });
  assert.equal(response.requestId, payload.requestId);
});

test("rate limit honors bounded Retry-After and cancels non-JSON responses", async () => {
  for (const header of ["60", "10", "-1", "3600", "invalid"]) {
    const waits = [];
    let calls = 0;
    await publishRankingObservation(payload, {
      ...options,
      wait: async (ms) => {
        waits.push(ms);
      },
      fetch: async () => {
        calls++;
        return calls === 1
          ? new Response(null, { status: 429, headers: { "retry-after": header } })
          : reply(result());
      },
    });
    assert.deepEqual(waits, [header === "10" ? 10_000 : 60_000]);
  }
  let cancelled = 0;
  await publishRankingObservation(payload, {
    ...options,
    fetch: async () =>
      new Response(
        new ReadableStream({
          cancel: () => {
            cancelled++;
          },
        }),
        {
          headers: { "content-type": "text/html" },
        },
      ),
  });
  assert.equal(cancelled, 3);
});
