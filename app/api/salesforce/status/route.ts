import { getSalesforceStatusConfiguration } from "@/lib/crm/salesforce/config";
import {
  emptySalesforceConnectionSnapshot,
  salesforceObservationSchema,
} from "@/lib/crm/salesforce/connection-contract";
import { salesforceConnectionState } from "@/lib/crm/salesforce/connection-state";
import { noStoreHeaders, secretsMatch } from "@/lib/security/api";
import { authorizeRoute } from "@/lib/security/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_STATUS_BYTES = 8_192;

export async function GET() {
  const authorization = await authorizeRoute("crm.settings.manage");
  if (!authorization.ok) return authorization.response;
  const config = getSalesforceStatusConfiguration();
  const snapshot = config.available
    ? salesforceConnectionState.snapshot(config.statusSecret)
    : emptySalesforceConnectionSnapshot(config.enabled ? "unavailable" : "unconfigured");
  return Response.json(snapshot, { headers: noStoreHeaders() });
}

async function readObservation(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_payload");
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 5_000);
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new Error("invalid_payload");
      if (done) {
        complete = true;
        break;
      }
      length += value.byteLength;
      if (length > MAX_STATUS_BYTES) throw new Error("payload_too_large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    clearTimeout(timer);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const config = getSalesforceStatusConfiguration();
  if (!config.available)
    return Response.json(
      { error: "status_unavailable" },
      {
        status: config.enabled ? 503 : 404,
        headers: noStoreHeaders(),
      },
    );
  const authorization = request.headers.get("authorization");
  if (
    !secretsMatch(
      authorization?.startsWith("Bearer ") ? authorization.slice(7) : null,
      config.statusSecret,
    )
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    return Response.json({ error: "invalid_payload" }, { status: 415, headers: noStoreHeaders() });
  }
  if (Number(request.headers.get("content-length")) > MAX_STATUS_BYTES) {
    return Response.json(
      { error: "payload_too_large" },
      { status: 413, headers: noStoreHeaders() },
    );
  }
  let input: unknown;
  try {
    input = await readObservation(request);
  } catch (error) {
    return Response.json(
      { error: "invalid_payload" },
      {
        status: error instanceof Error && error.message === "payload_too_large" ? 413 : 400,
        headers: noStoreHeaders(),
      },
    );
  }
  const parsed = salesforceObservationSchema.safeParse(input);
  if (!parsed.success)
    return Response.json({ error: "invalid_payload" }, { status: 400, headers: noStoreHeaders() });
  const result = salesforceConnectionState.accept(parsed.data, config.statusSecret);
  if (result !== "accepted")
    return Response.json({ error: result }, { status: 409, headers: noStoreHeaders() });
  return Response.json({ ok: true }, { status: 202, headers: noStoreHeaders() });
}
