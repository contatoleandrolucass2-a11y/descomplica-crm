import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/api";
import { applySecurityHeaders } from "@/lib/security/headers";
import { authorizeRoute, type RouteAuthorizationResult } from "@/lib/security/route-auth";

import {
  OFFICIAL_SIMULATOR_SLUGS,
  isOfficialSimulatorSlug,
  type OfficialSimulatorKey,
  type OfficialSimulatorSlug,
} from "./catalog";
import {
  getOfficialSimulatorRuntimeConfiguration,
  officialSimulatorIsEnabled,
  type OfficialSimulatorRuntimeConfiguration,
} from "./config";
import { emitOfficialSimulatorTelemetry, type OfficialSimulatorTelemetryEvent } from "./telemetry";
import { calculateWf13, WF13_FORMULA, wf13InputSchema } from "./wf13";

export const OFFICIAL_SIMULATOR_MAX_BODY_BYTES = 64_000;

const requestSchema = z
  .object({
    schemaVersion: z.literal(1),
    input: z.unknown(),
  })
  .strict();

type Calculator = {
  engineKey: OfficialSimulatorKey;
  formulaVersion: string;
  sourceSha256: string;
  execute: (input: unknown, today: string) => unknown;
};

const calculators: Partial<Record<OfficialSimulatorSlug, Calculator>> = {
  "associativo-fluxo-linear": {
    engineKey: "simulator.wf13",
    formulaVersion: WF13_FORMULA.version,
    sourceSha256: WF13_FORMULA.sourceSha256,
    execute(input, today) {
      return calculateWf13(wf13InputSchema.parse(input), { today });
    },
  },
};

export type OfficialSimulatorHandlerDependencies = {
  configuration: () => OfficialSimulatorRuntimeConfiguration;
  authorize: typeof authorizeRoute;
  emit: (event: OfficialSimulatorTelemetryEvent) => void;
  today: () => string;
  calculators: Partial<Record<OfficialSimulatorSlug, Calculator>>;
};

function saoPauloToday(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const defaultDependencies: OfficialSimulatorHandlerDependencies = {
  configuration: getOfficialSimulatorRuntimeConfiguration,
  authorize: authorizeRoute,
  emit: emitOfficialSimulatorTelemetry,
  today: saoPauloToday,
  calculators,
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

function authorizationOutcome(result: RouteAuthorizationResult): "unauthorized" | "forbidden" {
  if (result.ok) return "forbidden";
  return result.response.status === 401 ? "unauthorized" : "forbidden";
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
      if (total > OFFICIAL_SIMULATOR_MAX_BODY_BYTES) {
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

export async function handleOfficialSimulatorPost(
  request: Request,
  suppliedSlug: string,
  dependencies: OfficialSimulatorHandlerDependencies = defaultDependencies,
): Promise<Response> {
  const startedAt = performance.now();
  const correlationId = randomUUID();
  const emit = (
    event: Omit<OfficialSimulatorTelemetryEvent, "event" | "correlationId" | "durationMs">,
  ) =>
    dependencies.emit({
      event: "crm.official_simulator",
      correlationId,
      durationMs: performance.now() - startedAt,
      ...event,
    });

  if (!isOfficialSimulatorSlug(suppliedSlug)) {
    emit({ outcome: "not_found", httpStatus: 404 });
    return json(request, { error: "simulator_not_found" }, 404);
  }
  const engineKey = OFFICIAL_SIMULATOR_SLUGS[suppliedSlug];
  const calculator = dependencies.calculators[suppliedSlug];
  const configuration = dependencies.configuration();
  if (
    !calculator ||
    calculator.engineKey !== engineKey ||
    !officialSimulatorIsEnabled(configuration, engineKey)
  ) {
    emit({ outcome: "unavailable", httpStatus: 503, engineKey });
    return json(request, { error: "simulator_unavailable" }, 503);
  }

  const authorization = await dependencies.authorize("crm.simulators.execute");
  if (!authorization.ok) {
    emit({
      outcome: authorizationOutcome(authorization),
      httpStatus: authorization.response.status,
      engineKey,
    });
    return authorization.response;
  }
  if (authorization.context.roleKey !== "master") {
    emit({ outcome: "forbidden", httpStatus: 403, engineKey });
    return json(request, { error: "forbidden" }, 403);
  }
  if (!isSameOriginRequest(request, process.env.APP_ORIGIN)) {
    emit({ outcome: "invalid_origin", httpStatus: 403, engineKey });
    return json(request, { error: "invalid_origin" }, 403);
  }
  if (
    new URL(request.url).search ||
    request.headers.has("content-encoding") ||
    !isJsonContentType(request.headers.get("content-type"))
  ) {
    emit({ outcome: "invalid_payload", httpStatus: 415, engineKey });
    return json(request, { error: "unsupported_media_type" }, 415);
  }
  const contentLength = request.headers.get("content-length");
  if (
    (contentLength && !/^\d+$/.test(contentLength)) ||
    Number(contentLength ?? 0) > OFFICIAL_SIMULATOR_MAX_BODY_BYTES
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
  const parsed = requestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    emit({ outcome: "invalid_payload", httpStatus: 400, engineKey });
    return json(request, { error: "invalid_payload" }, 400);
  }

  let result: unknown;
  try {
    result = calculator.execute(parsed.data.input, dependencies.today());
  } catch {
    emit({ outcome: "invalid_payload", httpStatus: 422, engineKey });
    return json(request, { error: "input_rejected" }, 422);
  }

  const businessAccepted =
    typeof result === "object" && result !== null && "ok" in result && result.ok === true;
  emit({
    outcome: businessAccepted ? "success" : "business_rejected",
    httpStatus: 200,
    engineKey,
    formulaVersion: calculator.formulaVersion,
  });
  return json(
    request,
    {
      schemaVersion: 1,
      engineKey,
      formulaVersion: calculator.formulaVersion,
      sourceSha256: calculator.sourceSha256,
      correlationId,
      result,
    },
    200,
  );
}

export async function handleOfficialSimulatorStatus(
  request: Request,
  suppliedSlug: string,
  dependencies: OfficialSimulatorHandlerDependencies = defaultDependencies,
): Promise<Response> {
  if (!isOfficialSimulatorSlug(suppliedSlug)) {
    return json(request, { error: "simulator_not_found" }, 404);
  }

  const engineKey = OFFICIAL_SIMULATOR_SLUGS[suppliedSlug];
  const calculator = dependencies.calculators[suppliedSlug];
  const configuration = dependencies.configuration();
  if (
    !calculator ||
    calculator.engineKey !== engineKey ||
    !officialSimulatorIsEnabled(configuration, engineKey)
  ) {
    return json(request, { error: "simulator_unavailable" }, 503);
  }

  const authorization = await dependencies.authorize("crm.simulators.execute");
  if (!authorization.ok) return authorization.response;
  if (authorization.context.roleKey !== "master") {
    return json(request, { error: "forbidden" }, 403);
  }

  return json(request, { schemaVersion: 1, engineKey, executionEnabled: true }, 200);
}
