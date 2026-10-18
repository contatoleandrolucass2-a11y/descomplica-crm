import { authenticateQlikRelayRequest } from "@/lib/crm/qlik/auth";
import { getQlikV2Configuration } from "@/lib/crm/qlik/config-v2";
import { emptyQlikStatus, QLIK_STATUS_PATH } from "@/lib/crm/qlik/status-contract";
import { qlikStatusState } from "@/lib/crm/qlik/status-state";
import { noStoreHeaders } from "@/lib/security/api";
import { authorizePageRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (status: number, body: object) =>
  Response.json(body, { status, headers: noStoreHeaders() });
export async function GET() {
  const authorization = await authorizePageRoute("/app/configuracoes/conectar-sistemas");
  if (!authorization.ok) return authorization.response;
  const configuration = getQlikV2Configuration();
  return reply(
    200,
    configuration.available
      ? qlikStatusState.snapshot(configuration.hmacSecret)
      : emptyQlikStatus("unconfigured"),
  );
}
export async function POST(request: Request) {
  const configuration = getQlikV2Configuration();
  if (!configuration.available) return reply(404, { error: "status_unavailable" });
  const url = new URL(request.url);
  if (
    url.pathname !== QLIK_STATUS_PATH ||
    url.search ||
    request.headers.has("content-encoding") ||
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
  )
    return reply(415, { error: "unsupported_media_type" });
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) return reply(400, { error: "invalid_payload" });
  if (Number(length ?? 0) > 8192) return reply(413, { error: "payload_too_large" });
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { error: "invalid_payload" });
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 5000);
  try {
    for (;;) {
      const item = await reader.read();
      if (expired) return reply(408, { error: "request_timeout" });
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 8192) {
        void reader.cancel().catch(() => {});
        return reply(413, { error: "payload_too_large" });
      }
      chunks.push(item.value);
    }
  } catch {
    return reply(400, { error: "invalid_payload" });
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks, size);
  const authentication = authenticateQlikRelayRequest(
    request,
    body,
    configuration,
    new Date(),
    QLIK_STATUS_PATH,
  );
  if (!authentication.ok) return reply(401, { error: "unauthorized" });
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return reply(400, { error: "invalid_payload" });
  }
  const result = qlikStatusState.accept(input, authentication.nonceHash, configuration.hmacSecret);
  return result === "accepted"
    ? reply(202, { ok: true })
    : reply(result === "invalid_payload" ? 422 : 409, { error: result });
}
