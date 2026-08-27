import { createPrivilegedClient } from "@/lib/auth/supabase/privileged";
import { salesforceIngestionSchema } from "@/lib/crm/ingestion/schema";
import { getSalesforceIngestConfiguration } from "@/lib/crm/salesforce/config";
import { MAX_INGESTION_BODY_BYTES, noStoreHeaders, secretsMatch } from "@/lib/security/api";

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function POST(request: Request) {
  const configuration = getSalesforceIngestConfiguration();
  if (!configuration.available) {
    return Response.json(
      { error: "ingestion_unavailable" },
      { status: configuration.enabled ? 503 : 404, headers: noStoreHeaders() },
    );
  }

  if (!secretsMatch(bearerToken(request), configuration.ingestSecret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStoreHeaders() });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INGESTION_BODY_BYTES) {
    return Response.json(
      { error: "payload_too_large" },
      { status: 413, headers: noStoreHeaders() },
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400, headers: noStoreHeaders() });
  }
  if (Buffer.byteLength(body, "utf8") > MAX_INGESTION_BODY_BYTES) {
    return Response.json(
      { error: "payload_too_large" },
      { status: 413, headers: noStoreHeaders() },
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400, headers: noStoreHeaders() });
  }
  const parsed = salesforceIngestionSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload" }, { status: 400, headers: noStoreHeaders() });
  }

  try {
    const supabase = createPrivilegedClient();
    const { data, error } = await supabase.rpc("ingest_crm_salesforce_snapshot", {
      p_payload: parsed.data,
    });
    if (error || !data || typeof data !== "object") {
      return Response.json(
        { error: "ingestion_unavailable" },
        { status: 503, headers: noStoreHeaders() },
      );
    }

    const result = data as Record<string, unknown>;
    if (result.ok !== true) {
      if (result.status === "rate_limited") {
        return Response.json(
          { error: "rate_limited", requestId: parsed.data.requestId },
          { status: 429, headers: noStoreHeaders({ "retry-after": "60" }) },
        );
      }
      return Response.json(
        { error: "ingestion_rejected", requestId: parsed.data.requestId },
        { status: 422, headers: noStoreHeaders() },
      );
    }
    return Response.json(
      {
        ok: true,
        requestId: parsed.data.requestId,
        status: result.status,
        idempotent: result.idempotent === true,
        recordCount: result.recordCount ?? null,
      },
      { status: result.idempotent === true ? 200 : 201, headers: noStoreHeaders() },
    );
  } catch {
    return Response.json(
      { error: "ingestion_unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
