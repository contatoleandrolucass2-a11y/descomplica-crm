import { createHash, createHmac, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const PATH = "/api/ingest/qlik/v2";
const URL = `https://crm.descomplicapro.com.br${PATH}`;
const KEY_ID = "qlik-ranking-v2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;

async function responseJson(response) {
  if (!/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel().catch(() => {});
    throw new Error("invalid_response");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("invalid_response");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) throw new Error("invalid_response");
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Same immutable observation on retry; retries never constitute a second collection. */
export async function publishRankingObservation(
  payload,
  {
    secret,
    signal,
    fetch: send = globalThis.fetch,
    now = () => new Date(),
    uuid = randomUUID,
    wait = delay,
  } = {},
) {
  if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(secret))
    return { state: "unavailable", reason: "publisher_configuration" };
  let body;
  try {
    if (
      payload?.schemaVersion !== 2 ||
      typeof payload.requestId !== "string" ||
      typeof payload.batchId !== "string" ||
      !UUID.test(payload.requestId) ||
      !UUID.test(payload.batchId)
    )
      throw new Error("invalid_payload");
    body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > 4_000_000) throw new Error("invalid_payload");
  } catch {
    return { state: "unavailable", reason: "invalid_payload" };
  }
  const bodySha256 = createHash("sha256").update(body).digest("hex");
  const requestId = payload.requestId;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) return { state: "unavailable", reason: "cancelled" };
    const deadline = AbortSignal.timeout(20_000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    let retryDelay = 1000 * 2 ** attempt;
    try {
      const timestamp = now().toISOString();
      const nonce = uuid();
      if (!UUID.test(nonce)) throw new Error("invalid_nonce");
      const signature = createHmac("sha256", secret)
        .update(["POST", PATH, KEY_ID, timestamp, nonce, bodySha256].join("\n"))
        .digest("hex");
      const response = await send(URL, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: requestSignal,
        headers: {
          "content-type": "application/json",
          authorization: `HMAC-SHA256 ${signature}`,
          "x-crm-relay-key-id": KEY_ID,
          "x-crm-relay-timestamp": timestamp,
          "x-crm-relay-nonce": nonce,
          "x-crm-relay-content-sha256": bodySha256,
        },
        body,
      });
      if (response.status === 200 || response.status === 202) {
        const result = await responseJson(response);
        const expected = response.status === 200 ? "published" : "staged";
        if (
          !result ||
          result.ok !== true ||
          result.status !== expected ||
          result.requestId !== requestId ||
          typeof result.contentSha256 !== "string" ||
          !SHA.test(result.contentSha256) ||
          Object.keys(result).some(
            (key) => !["ok", "status", "requestId", "contentSha256", "idempotent"].includes(key),
          ) ||
          (result.idempotent !== undefined && typeof result.idempotent !== "boolean")
        )
          return { state: "unavailable", reason: "publisher_response" };
        return { state: expected, requestId, contentSha256: result.contentSha256 };
      }
      await response.body?.cancel().catch(() => {});
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after") ?? "";
        const seconds = /^\d{1,2}$/.test(retryAfter) ? Number(retryAfter) : 60;
        retryDelay = (seconds >= 1 && seconds <= 60 ? seconds : 60) * 1000;
      }
      if (response.status < 500 && response.status !== 429)
        return { state: "unavailable", reason: "publisher_rejected" };
    } catch {
      // Transport errors may include URLs or request headers. Never return their text.
    }
    if (attempt < 2) {
      try {
        await wait(retryDelay, undefined, { signal });
      } catch {
        return { state: "unavailable", reason: "cancelled" };
      }
    }
  }
  return { state: "unavailable", reason: signal?.aborted ? "cancelled" : "publisher_unavailable" };
}
