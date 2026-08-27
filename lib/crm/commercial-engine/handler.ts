import "server-only";

import { randomUUID } from "node:crypto";

import {
  COMMERCIAL_ENGINE_CATALOG,
  isCommercialEngineKey,
  type CommercialEngineKey,
} from "@/lib/crm/commercial-engine/catalog";
import {
  commercialEngineIsEnabled,
  COMMERCIAL_ENGINE_MAX_BODY_BYTES,
  getCommercialEngineRuntimeConfiguration,
  type CommercialEngineRuntimeConfiguration,
} from "@/lib/crm/commercial-engine/config";
import { commercialEngineRequestSchema } from "@/lib/crm/commercial-engine/contract";
import {
  loadCommercialEnginePolicy,
  recordCommercialEngineExecution,
} from "@/lib/crm/commercial-engine/data";
import {
  commercialPolicyExecutionHash,
  commercialPolicyInputHash,
  CommercialPolicyRuntimeError,
  executeVerifiedCommercialPolicy,
} from "@/lib/crm/commercial-engine/runtime";
import {
  emitCommercialEngineTelemetry,
  type CommercialEngineTelemetryEvent,
} from "@/lib/crm/commercial-engine/telemetry";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { applySecurityHeaders } from "@/lib/security/headers";
import { authorizeRoute, type RouteAuthorizationResult } from "@/lib/security/route-auth";

export type CommercialEngineHandlerDependencies = {
  configuration: () => CommercialEngineRuntimeConfiguration;
  authorize: typeof authorizeRoute;
  loadPolicy: typeof loadCommercialEnginePolicy;
  recordExecution: typeof recordCommercialEngineExecution;
  emit: (event: CommercialEngineTelemetryEvent) => void;
};

const defaultDependencies: CommercialEngineHandlerDependencies = {
  configuration: getCommercialEngineRuntimeConfiguration,
  authorize: authorizeRoute,
  loadPolicy: loadCommercialEnginePolicy,
  recordExecution: recordCommercialEngineExecution,
  emit: emitCommercialEngineTelemetry,
};

function responseHeaders(request: Request): Headers {
  const headers = noStoreHeaders();
  applySecurityHeaders(headers, {
    isProd: process.env.NODE_ENV === "production" && new URL(request.url).protocol === "https:",
  });
  return headers;
}

function json(request: Request, body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: responseHeaders(request) });
}

function isJsonContentType(value: string | null): boolean {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
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
      if (total > COMMERCIAL_ENGINE_MAX_BODY_BYTES) {
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

function authorizationOutcome(result: RouteAuthorizationResult): "forbidden" {
  void result;
  return "forbidden";
}

export async function handleCommercialEnginePost(
  request: Request,
  suppliedEngineKey: string,
  dependencies: CommercialEngineHandlerDependencies = defaultDependencies,
): Promise<Response> {
  const startedAt = performance.now();
  const correlationId = randomUUID();
  const configuration = dependencies.configuration();
  const emit = (
    event: Omit<CommercialEngineTelemetryEvent, "correlationId" | "durationMs" | "mode">,
  ) =>
    dependencies.emit({
      ...event,
      correlationId,
      durationMs: performance.now() - startedAt,
      mode: configuration.mode,
    });

  if (!isCommercialEngineKey(suppliedEngineKey)) {
    emit({ outcome: "not_found", httpStatus: 404 });
    return json(request, { error: "engine_not_found" }, 404);
  }
  const engineKey: CommercialEngineKey = suppliedEngineKey;
  const descriptor = COMMERCIAL_ENGINE_CATALOG[engineKey];
  if (!descriptor.interactive || configuration.mode === "off") {
    emit({ outcome: "unavailable", httpStatus: 404, engineKey });
    return json(request, { error: "engine_unavailable" }, 404);
  }
  if (!configuration.available) {
    emit({ outcome: "unavailable", httpStatus: 503, engineKey });
    return json(request, { error: "engine_unavailable" }, 503);
  }
  if (!commercialEngineIsEnabled(configuration, engineKey)) {
    emit({ outcome: "unavailable", httpStatus: 404, engineKey });
    return json(request, { error: "engine_unavailable" }, 404);
  }

  const authorization = await dependencies.authorize(descriptor.requiredPermission);
  if (!authorization.ok) {
    emit({
      outcome: authorizationOutcome(authorization),
      httpStatus: authorization.response.status,
      engineKey,
    });
    return authorization.response;
  }
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    emit({ outcome: "invalid_origin", httpStatus: 403, engineKey });
    return json(request, { error: "invalid_origin" }, 403);
  }
  if (new URL(request.url).search || request.headers.has("content-encoding")) {
    emit({ outcome: "invalid_payload", httpStatus: 415, engineKey });
    return json(request, { error: "unsupported_media_type" }, 415);
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    emit({ outcome: "invalid_payload", httpStatus: 415, engineKey });
    return json(request, { error: "unsupported_media_type" }, 415);
  }
  const contentLength = request.headers.get("content-length");
  if (
    (contentLength && !/^\d+$/.test(contentLength)) ||
    Number(contentLength ?? 0) > COMMERCIAL_ENGINE_MAX_BODY_BYTES
  ) {
    emit({ outcome: "invalid_payload", httpStatus: 413, engineKey });
    return json(request, { error: "payload_too_large" }, 413);
  }

  let body: Uint8Array | null;
  try {
    body = await readBoundedBody(request);
  } catch {
    body = null;
  }
  if (body === null) {
    emit({ outcome: "invalid_payload", httpStatus: 413, engineKey });
    return json(request, { error: "payload_too_large" }, 413);
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    emit({ outcome: "invalid_payload", httpStatus: 400, engineKey });
    return json(request, { error: "invalid_payload" }, 400);
  }
  const parsed = commercialEngineRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    emit({ outcome: "invalid_payload", httpStatus: 400, engineKey });
    return json(request, { error: "invalid_payload" }, 400);
  }

  let policy;
  try {
    policy = await dependencies.loadPolicy(
      configuration.databaseUrl,
      authorization.context.userId,
      engineKey,
      configuration.mode,
    );
  } catch {
    emit({
      outcome: "policy_invalid",
      httpStatus: 503,
      engineKey,
      requestId: parsed.data.requestId,
    });
    return json(request, { error: "engine_unavailable", requestId: parsed.data.requestId }, 503);
  }
  if (!policy) {
    emit({
      outcome: "policy_unavailable",
      httpStatus: 503,
      engineKey,
      requestId: parsed.data.requestId,
    });
    return json(request, { error: "policy_unavailable", requestId: parsed.data.requestId }, 503);
  }

  let output;
  try {
    output = executeVerifiedCommercialPolicy(policy, parsed.data.input);
  } catch (error) {
    const invalidInput = error instanceof CommercialPolicyRuntimeError;
    emit({
      outcome: invalidInput ? "invalid_payload" : "policy_invalid",
      httpStatus: invalidInput ? 422 : 503,
      engineKey,
      requestId: parsed.data.requestId,
      policyHash: policy.policyHash,
    });
    return json(
      request,
      {
        error: invalidInput ? "input_rejected" : "engine_unavailable",
        requestId: parsed.data.requestId,
      },
      invalidInput ? 422 : 503,
    );
  }

  let audit;
  try {
    audit = await dependencies.recordExecution({
      databaseUrl: configuration.databaseUrl,
      actorUserId: authorization.context.userId,
      engineKey,
      mode: configuration.mode,
      policyHash: policy.policyHash,
      requestId: parsed.data.requestId,
      inputHash: commercialPolicyInputHash(parsed.data.input),
      outputHash: commercialPolicyExecutionHash(output),
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });
  } catch {
    emit({
      outcome: "audit_unavailable",
      httpStatus: 503,
      engineKey,
      requestId: parsed.data.requestId,
      policyHash: policy.policyHash,
    });
    return json(request, { error: "engine_unavailable", requestId: parsed.data.requestId }, 503);
  }
  if (audit.status === "conflict") {
    emit({
      outcome: "conflict",
      httpStatus: 409,
      engineKey,
      requestId: parsed.data.requestId,
      policyHash: policy.policyHash,
    });
    return json(request, { error: "request_conflict", requestId: parsed.data.requestId }, 409);
  }

  if (configuration.mode === "shadow") {
    emit({
      outcome: "shadow_succeeded",
      httpStatus: 202,
      engineKey,
      requestId: parsed.data.requestId,
      policyHash: policy.policyHash,
      replay: audit.replay,
    });
    return json(
      request,
      {
        ok: true,
        status: "shadow_evaluated",
        requestId: parsed.data.requestId,
        policyVersion: policy.version,
        replay: audit.replay,
      },
      202,
    );
  }

  emit({
    outcome: "active_succeeded",
    httpStatus: 200,
    engineKey,
    requestId: parsed.data.requestId,
    policyHash: policy.policyHash,
    replay: audit.replay,
  });
  return json(
    request,
    {
      ok: true,
      status: "succeeded",
      requestId: parsed.data.requestId,
      policyVersion: policy.version,
      policyHash: policy.policyHash,
      output,
      replay: audit.replay,
    },
    200,
  );
}
