import type { OfficialSimulatorKey } from "./catalog";

export type OfficialSimulatorTelemetryEvent = {
  event: "crm.official_simulator";
  correlationId: string;
  engineKey?: OfficialSimulatorKey;
  formulaVersion?: string;
  outcome:
    | "success"
    | "business_rejected"
    | "unavailable"
    | "not_found"
    | "unauthorized"
    | "forbidden"
    | "invalid_origin"
    | "invalid_payload";
  httpStatus: number;
  durationMs: number;
};

export function emitOfficialSimulatorTelemetry(event: OfficialSimulatorTelemetryEvent): void {
  console.info(JSON.stringify({ ...event, durationMs: Math.max(0, Math.round(event.durationMs)) }));
}
