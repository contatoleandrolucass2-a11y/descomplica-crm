import type { CommercialEngineKey } from "@/lib/crm/commercial-engine/catalog";
import type { CommercialEngineRuntimeMode } from "@/lib/crm/commercial-engine/config";

export type CommercialEngineTelemetryEvent = {
  correlationId: string;
  requestId?: string;
  engineKey?: CommercialEngineKey;
  mode: CommercialEngineRuntimeMode;
  outcome:
    | "unavailable"
    | "not_found"
    | "forbidden"
    | "invalid_origin"
    | "invalid_payload"
    | "policy_unavailable"
    | "policy_invalid"
    | "audit_unavailable"
    | "conflict"
    | "shadow_succeeded"
    | "active_succeeded";
  httpStatus: number;
  durationMs: number;
  policyHash?: string;
  replay?: boolean;
};

export function emitCommercialEngineTelemetry(event: CommercialEngineTelemetryEvent): void {
  console.info(
    JSON.stringify({
      event: "crm.commercial_engine",
      correlationId: event.correlationId,
      requestId: event.requestId ?? null,
      engineKey: event.engineKey ?? null,
      mode: event.mode,
      outcome: event.outcome,
      httpStatus: event.httpStatus,
      durationMs: Math.max(0, Math.round(event.durationMs)),
      policyFingerprint: event.policyHash?.slice(0, 12) ?? null,
      replay: event.replay ?? false,
    }),
  );
}
