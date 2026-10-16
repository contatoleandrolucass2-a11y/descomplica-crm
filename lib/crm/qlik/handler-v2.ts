import "server-only";

import { z } from "zod";
import { createPrivilegedClient } from "@/lib/auth/supabase/privileged";
import { noStoreHeaders } from "@/lib/security/api";
import { applySecurityHeaders } from "@/lib/security/headers";
import { authenticateQlikRelayRequest, type QlikRelayAuthentication } from "./auth";
import { getQlikV2Configuration, QLIK_V2_MAX_BODY_BYTES, QLIK_V2_PATH } from "./config-v2";
import { createQlikRankingV2Schema, type QlikRankingV2 } from "./contracts-v2";

const resultSchema = z
  .object({
    ok: z.boolean(),
    status: z.enum(["staged", "published", "rejected"]),
    reason: z
      .enum([
        "invalid_payload",
        "request_conflict",
        "replay_conflict",
        "batch_conflict",
        "stale_source",
        "rate_limited",
      ])
      .optional(),
    requestId: z.string().uuid().optional(),
    contentSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    idempotent: z.boolean().optional(),
  })
  .strict();

type Authentication = Extract<QlikRelayAuthentication, { ok: true }>;
async function execute(payload: QlikRankingV2, authentication: Authentication): Promise<unknown> {
  const result = await createPrivilegedClient().rpc("ingest_qlik_ranking_v2", {
    p_payload: payload,
    p_nonce_hash: authentication.nonceHash,
    p_body_sha256: authentication.bodySha256,
    p_requested_at: authentication.requestedAt,
    p_key_id: authentication.keyId,
  });
  if (result.error) throw new Error("qlik_v2_database_unavailable");
  return result.data;
}

const defaults = { configuration: getQlikV2Configuration, execute, now: () => new Date() };

export async function handleQlikV2Post(
  request: Request,
  dependencies = defaults,
): Promise<Response> {
  const headers = noStoreHeaders();
  applySecurityHeaders(headers, {
    isProd: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:",
  });
  const reply = (status: number, body: object) => Response.json(body, { status, headers });
  const configuration = dependencies.configuration();
  if (!configuration.available) return reply(404, { error: "ingestion_unavailable" });
  const url = new URL(request.url);
  if (
    request.method !== "POST" ||
    url.pathname !== QLIK_V2_PATH ||
    url.search ||
    request.headers.has("content-encoding") ||
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
  ) {
    return reply(415, { error: "unsupported_media_type" });
  }
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) return reply(400, { error: "invalid_payload" });
  if (Number(length ?? 0) > QLIK_V2_MAX_BODY_BYTES)
    return reply(413, { error: "payload_too_large" });
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { error: "invalid_payload" });
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 15_000);
  try {
    while (true) {
      const item = await reader.read();
      if (expired) return reply(408, { error: "request_timeout" });
      if (item.done) break;
      size += item.value.byteLength;
      if (size > QLIK_V2_MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return reply(413, { error: "payload_too_large" });
      }
      chunks.push(item.value);
    }
  } catch {
    return reply(expired ? 408 : 400, { error: expired ? "request_timeout" : "invalid_payload" });
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks, size);
  const now = dependencies.now();
  const authentication = authenticateQlikRelayRequest(
    request,
    body,
    configuration,
    now,
    QLIK_V2_PATH,
  );
  if (!authentication.ok) return reply(401, { error: "unauthorized" });
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return reply(400, { error: "invalid_payload" });
  }
  const parsed = createQlikRankingV2Schema(() => now).safeParse(raw);
  if (!parsed.success) return reply(422, { error: "invalid_payload" });
  try {
    const result = resultSchema.parse(await dependencies.execute(parsed.data, authentication));
    if (
      result.ok &&
      result.status !== "rejected" &&
      !result.reason &&
      result.requestId?.toLowerCase() === parsed.data.requestId.toLowerCase() &&
      result.contentSha256 &&
      typeof result.idempotent === "boolean"
    ) {
      return reply(result.status === "staged" ? 202 : 200, result);
    }
    if (result.ok || result.status !== "rejected") throw new Error("invalid_result");
    if (result.reason === "rate_limited") headers.set("retry-after", "60");
    return reply(
      result.reason === "rate_limited" ? 429 : result.reason === "invalid_payload" ? 422 : 409,
      { error: result.reason ?? "ingestion_rejected", requestId: parsed.data.requestId },
    );
  } catch {
    return reply(503, { error: "ingestion_unavailable", requestId: parsed.data.requestId });
  }
}
