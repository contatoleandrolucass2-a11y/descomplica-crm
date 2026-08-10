import { createHash } from "node:crypto";

import type { QlikRelayMode } from "./config";

export type QlikRelayTelemetryEvent = {
  correlationId: string;
  outcome:
    | "unavailable"
    | "invalid_content_type"
    | "payload_too_large"
    | "unauthorized"
    | "invalid_payload"
    | "shadow_compared"
    | "succeeded"
    | "rejected"
    | "rate_limited"
    | "database_unavailable";
  httpStatus: number;
  mode: QlikRelayMode;
  durationMs: number;
  requestId?: string | undefined;
  keyId?: string | undefined;
  recordCount?: number | null | undefined;
  developmentRecordCount?: number | null | undefined;
  comparisonStatus?: "matched" | "mismatch" | "legacy_run_missing" | undefined;
  idempotent?: boolean | undefined;
};

function keyFingerprint(keyId: string | undefined): string | null {
  return keyId ? createHash("sha256").update(keyId).digest("hex").slice(0, 12) : null;
}

export function emitQlikRelayTelemetry(event: QlikRelayTelemetryEvent): void {
  const safeEvent = {
    event: "crm.qlik_relay",
    correlationId: event.correlationId,
    outcome: event.outcome,
    httpStatus: event.httpStatus,
    mode: event.mode,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    requestId: event.requestId ?? null,
    keyFingerprint: keyFingerprint(event.keyId),
    recordCount: event.recordCount ?? null,
    developmentRecordCount: event.developmentRecordCount ?? null,
    comparisonStatus: event.comparisonStatus ?? null,
    idempotent: event.idempotent ?? false,
  };

  console.info(JSON.stringify(safeEvent));
}
