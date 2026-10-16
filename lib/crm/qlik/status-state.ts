import "server-only";
import { createHash } from "node:crypto";
import {
  emptyQlikStatus,
  QLIK_COLLECTION_INTERVAL_MS,
  QLIK_STATUS_TTL_MS,
  qlikStatusObservationSchema,
  type QlikStatusObservation,
  type QlikStatusSnapshot,
} from "./status-contract";

/** Volatile liveness only. A server restart or key rotation requires fresh evidence. */
export class QlikStatusState {
  private receipt: { observation: QlikStatusObservation; receivedAt: number } | null = null;
  private secretDigest = "";
  private nonces = new Map<string, number>();
  private selectSecret(secret: string) {
    const digest = createHash("sha256").update(secret).digest("hex");
    if (digest !== this.secretDigest) {
      this.receipt = null;
      this.nonces.clear();
      this.secretDigest = digest;
    }
  }
  accept(input: unknown, nonce: string, secret: string, now = Date.now()) {
    this.selectSecret(secret);
    const parsed = qlikStatusObservationSchema.safeParse(input);
    if (!parsed.success) return "invalid_payload";
    const observation = parsed.data;
    const observed = Date.parse(observation.observedAt);
    if (observed > now + 5_000 || now - observed > 60_000) return "invalid_time";
    for (const [key, time] of this.nonces) if (now - time > 600_000) this.nonces.delete(key);
    if (this.nonces.has(nonce)) return "replay";
    if (this.receipt && observed <= Date.parse(this.receipt.observation.observedAt))
      return "out_of_order";
    if (this.nonces.size >= 1024) return "rate_limited";
    this.nonces.set(nonce, now);
    this.receipt = { observation: structuredClone(observation), receivedAt: now };
    return "accepted";
  }
  snapshot(secret: string, now = Date.now()): QlikStatusSnapshot {
    this.selectSecret(secret);
    if (!this.receipt) return emptyQlikStatus();
    const { observation, receivedAt } = this.receipt;
    const cycleAge = now - Date.parse(observation.cycleAt);
    const stale =
      now < receivedAt ||
      now - receivedAt >= QLIK_STATUS_TTL_MS ||
      now - Date.parse(observation.observedAt) >= QLIK_STATUS_TTL_MS ||
      cycleAge >
        (observation.cycle === "running" ? 480_000 : QLIK_COLLECTION_INTERVAL_MS + 480_000);
    return {
      state: stale ? "stale" : observation.cycle,
      checkedAt: observation.cycleAt,
      receivedAt: new Date(receivedAt).toISOString(),
      lastCollectedAt: observation.lastCollectedAt,
      lastPublishedAt: observation.lastPublishedAt,
      sourceUpdatedAt: observation.sourceUpdatedAt,
      nextRunAt: stale ? null : observation.nextRunAt,
    };
  }
}
const stateKey = Symbol.for("descomplica.qlik.status.v1");
const registry = globalThis as typeof globalThis & { [stateKey]?: QlikStatusState };
export const qlikStatusState = (registry[stateKey] ??= new QlikStatusState());
