import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const trace = new AsyncLocalStorage<string>();

/** Aggregate timings only: never accept query strings, payloads or user identifiers. */
export type PerformanceRoute = "appointments" | "stages" | "repasse";
export type PerformancePhase =
  | "authorization"
  | "loader"
  | "snapshot"
  | "analysis"
  | "roster"
  | "goals"
  | "metadata"
  | "board"
  | "identity"
  | "identity_verification"
  | "record";

export interface PerformanceMeasurement {
  route: PerformanceRoute;
  phase: PerformancePhase;
  outcome: "passed" | "failed";
  durationMs: number;
}

/** Opt-in to the existing server log destination, without an external collector. */
function emitMeasurement(measurement: PerformanceMeasurement) {
  if (process.env.CRM_PERFORMANCE_LOGS !== "true") return;
  const revision = process.env.DEPLOYMENT_VERSION;
  try {
    console.info(
      JSON.stringify({
        event: "crm.performance",
        correlationId: trace.getStore() ?? null,
        revision: revision && /^[a-f0-9]{40}$/u.test(revision) ? revision : null,
        ...measurement,
      }),
    );
  } catch {
    // Observability must never replace the result/error of an authorized operation.
  }
}

export async function measureCrmPhase<T>(
  route: PerformanceRoute,
  phase: PerformancePhase,
  operation: () => Promise<T>,
  observe: (measurement: PerformanceMeasurement) => void = emitMeasurement,
): Promise<T> {
  if (!trace.getStore()) {
    return trace.run(randomUUID(), () => measureCrmPhase(route, phase, operation, observe));
  }
  const start = performance.now();
  let outcome: PerformanceMeasurement["outcome"] = "failed";
  try {
    const result = await operation();
    // Supabase resolves transport promises with an error field on failed reads.
    // Classify that result without serializing its message, details or payload.
    outcome =
      result && typeof result === "object" && "error" in result && result.error
        ? "failed"
        : "passed";
    return result;
  } finally {
    try {
      observe({ route, phase, outcome, durationMs: Math.max(0, performance.now() - start) });
    } catch {
      // A failed observer cannot change application behavior.
    }
  }
}
