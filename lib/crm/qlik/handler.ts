import "server-only";

import { randomUUID } from "node:crypto";

import { qlikRankingIngestionSchema } from "../integrations/contracts";
import { authenticateQlikRelayRequest } from "./auth";
import {
  getQlikRelayConfiguration,
  QLIK_RELAY_MAX_BODY_BYTES,
  type QlikRelayConfiguration,
} from "./config";
import { executeQlikRelayIngestion, type QlikRelayDatabaseResult } from "./database";
import { emitQlikRelayTelemetry, type QlikRelayTelemetryEvent } from "./telemetry";
import { noStoreHeaders } from "@/lib/security/api";
import { applySecurityHeaders } from "@/lib/security/headers";

type Dependencies = {
  configuration: () => QlikRelayConfiguration;
  execute: typeof executeQlikRelayIngestion;
  emit: (event: QlikRelayTelemetryEvent) => void;
  now: () => Date;
};

const defaultDependencies: Dependencies = {
  configuration: getQlikRelayConfiguration,
  execute: executeQlikRelayIngestion,
  emit: emitQlikRelayTelemetry,
  now: () => new Date(),
};

function responseHeaders(request: Request, extra: HeadersInit = {}): Headers {
  const headers = noStoreHeaders(extra);
  applySecurityHeaders(headers, {
    isProd: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:",
  });
  return headers;
}

function json(
  request: Request,
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return Response.json({ error, ...extra }, { status, headers: responseHeaders(request) });
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function statusForDatabaseResult(result: QlikRelayDatabaseResult): number {
  if (result.status === "shadow_compared") return 202;
  if (result.status === "succeeded") return result.idempotent || result.replay ? 200 : 201;
  if (result.reason === "request_conflict" || result.reason === "replay_conflict") return 409;
  if (result.reason === "invalid_payload") return 422;
  if (result.reason === "rate_limited") return 429;
  return 503;
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > QLIK_RELAY_MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function handleQlikRelayPost(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
): Promise<Response> {
  const startedAt = performance.now();
  const correlationId = randomUUID();
  const configuration = dependencies.configuration();
  const emit = (
    event: Omit<QlikRelayTelemetryEvent, "mode" | "durationMs" | "correlationId">,
  ): void => {
    dependencies.emit({
      ...event,
      correlationId,
      mode: configuration.mode,
      durationMs: performance.now() - startedAt,
    });
  };

  if (!configuration.available) {
    const status = configuration.mode === "off" ? 404 : 503;
    emit({ outcome: "unavailable", httpStatus: status });
    return json(request, "ingestion_unavailable", status);
  }

  if (new URL(request.url).search || request.headers.has("content-encoding")) {
    emit({ outcome: "invalid_content_type", httpStatus: 415 });
    return json(request, "unsupported_media_type", 415);
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    emit({ outcome: "invalid_content_type", httpStatus: 415 });
    return json(request, "unsupported_media_type", 415);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && !/^\d+$/.test(contentLengthHeader)) {
    emit({ outcome: "invalid_payload", httpStatus: 400 });
    return json(request, "invalid_payload", 400);
  }
  if (Number(contentLengthHeader ?? 0) > QLIK_RELAY_MAX_BODY_BYTES) {
    emit({ outcome: "payload_too_large", httpStatus: 413 });
    return json(request, "payload_too_large", 413);
  }

  let body: Uint8Array | null;
  try {
    body = await readBoundedBody(request);
  } catch {
    emit({ outcome: "invalid_payload", httpStatus: 400 });
    return json(request, "invalid_payload", 400);
  }
  if (body === null) {
    emit({ outcome: "payload_too_large", httpStatus: 413 });
    return json(request, "payload_too_large", 413);
  }

  const authentication = authenticateQlikRelayRequest(
    request,
    body,
    configuration,
    dependencies.now(),
  );
  if (!authentication.ok) {
    emit({ outcome: "unauthorized", httpStatus: 401 });
    return json(request, "unauthorized", 401);
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    emit({ outcome: "invalid_payload", httpStatus: 400, keyId: authentication.keyId });
    return json(request, "invalid_payload", 400);
  }

  const parsed = qlikRankingIngestionSchema.safeParse(rawPayload);
  if (!parsed.success) {
    emit({ outcome: "invalid_payload", httpStatus: 400, keyId: authentication.keyId });
    return json(request, "invalid_payload", 400);
  }

  let result: QlikRelayDatabaseResult;
  try {
    result = await dependencies.execute({
      databaseUrl: configuration.databaseUrl,
      payload: parsed.data,
      mode: configuration.mode,
      keyId: authentication.keyId,
      requestedAt: authentication.requestedAt,
      nonceHash: authentication.nonceHash,
      bodySha256: authentication.bodySha256,
    });
  } catch {
    emit({
      outcome: "database_unavailable",
      httpStatus: 503,
      requestId: parsed.data.requestId,
      keyId: authentication.keyId,
    });
    return json(request, "ingestion_unavailable", 503, { requestId: parsed.data.requestId });
  }

  const status = statusForDatabaseResult(result);
  const outcome =
    result.status === "shadow_compared"
      ? "shadow_compared"
      : result.status === "succeeded"
        ? "succeeded"
        : result.reason === "rate_limited"
          ? "rate_limited"
          : "rejected";
  emit({
    outcome,
    httpStatus: status,
    requestId: parsed.data.requestId,
    keyId: authentication.keyId,
    recordCount: result.recordCount,
    developmentRecordCount: result.developmentRecordCount,
    comparisonStatus: result.comparisonStatus,
    idempotent: result.idempotent || result.replay,
  });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return Response.json(
        { error: "rate_limited", requestId: parsed.data.requestId },
        { status, headers: responseHeaders(request, { "retry-after": "60" }) },
      );
    }
    return json(
      request,
      result.reason === "request_conflict" || result.reason === "replay_conflict"
        ? "ingestion_conflict"
        : result.reason === "invalid_payload"
          ? "ingestion_rejected"
          : "ingestion_unavailable",
      status,
      { requestId: parsed.data.requestId },
    );
  }

  return Response.json(
    {
      ok: true,
      requestId: parsed.data.requestId,
      status: result.status,
      comparisonStatus: result.comparisonStatus ?? null,
      idempotent: result.idempotent === true || result.replay === true,
      recordCount: result.recordCount ?? null,
      developmentRecordCount: result.developmentRecordCount ?? null,
    },
    { status, headers: responseHeaders(request) },
  );
}
