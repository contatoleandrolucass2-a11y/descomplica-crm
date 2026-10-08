import "server-only";

import { createHash } from "node:crypto";
import {
  emptySalesforceConnectionSnapshot,
  SALESFORCE_STATUS_TTL_MS,
  type SalesforceConnectionSnapshot,
  type SalesforceObservation,
} from "./connection-contract";

type Receipt = { observedAt: number; receivedAt: number; observation: SalesforceObservation };

// Live liveness only. A restart loses the receipt and must return waiting, never connected.
// Business snapshots remain in the existing transactional Supabase ingestion path.
export class SalesforceConnectionState {
  private receipt: Receipt | null = null;
  private secretDigest = "";

  private selectSecret(secret: string) {
    const digest = createHash("sha256").update(secret).digest("hex");
    if (digest !== this.secretDigest) {
      this.receipt = null;
      this.secretDigest = digest;
    }
  }

  accept(observation: SalesforceObservation, secret: string, now = Date.now()) {
    this.selectSecret(secret);
    const observedAt = Date.parse(observation.observedAt);
    const checkedAt = Date.parse(observation.checkedAt);
    if (
      observedAt > now + 5_000 ||
      now - observedAt > 60_000 ||
      checkedAt > observedAt ||
      observedAt - checkedAt > 60_000 ||
      (observation.nextRunAt && Date.parse(observation.nextRunAt) > now + 31 * 60_000)
    ) {
      return "invalid_time" as const;
    }
    if (this.receipt && observedAt <= this.receipt.observedAt) return "out_of_order" as const;
    this.receipt = { observedAt, receivedAt: now, observation: structuredClone(observation) };
    return "accepted" as const;
  }

  snapshot(secret: string, now = Date.now()): SalesforceConnectionSnapshot {
    this.selectSecret(secret);
    if (!this.receipt) return emptySalesforceConnectionSnapshot();
    const { observation, receivedAt } = this.receipt;
    const stale =
      now < receivedAt ||
      now - receivedAt >= SALESFORCE_STATUS_TTL_MS ||
      now - Date.parse(observation.checkedAt) >= SALESFORCE_STATUS_TTL_MS;
    return {
      state: stale ? "stale" : observation.state,
      checkedAt: observation.checkedAt,
      receivedAt: new Date(receivedAt).toISOString(),
      nextRunAt: stale ? null : observation.nextRunAt,
      cycle: stale && observation.cycle === "running" ? "failed" : observation.cycle,
      lastExportAt: observation.lastExportAt,
      lastPublishedAt: observation.lastPublishedAt,
      reports: observation.reports ? structuredClone(observation.reports) : null,
      errorCode: stale ? "collector_unreachable" : observation.errorCode,
    };
  }
}

const stateKey = Symbol.for("descomplica.salesforce.connection.v1");
const registry = globalThis as typeof globalThis & { [stateKey]?: SalesforceConnectionState };
export const salesforceConnectionState = (registry[stateKey] ??= new SalesforceConnectionState());
