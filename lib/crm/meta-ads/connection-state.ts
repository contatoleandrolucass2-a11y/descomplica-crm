import "server-only";
import { createHash } from "node:crypto";
import {
  emptyMetaAdsConnectionSnapshot,
  META_ADS_STATUS_TTL_MS,
  metaAdsObservationSchema,
  type MetaAdsObservation,
  type MetaAdsConnectionSnapshot,
} from "./connection-contract";

/** Session liveness only. Restart or secret rotation requires a fresh observation. */
export class MetaAdsConnectionState {
  private receipt: { observation: MetaAdsObservation; receivedAt: number } | null = null;
  private secretDigest = "";
  private selectSecret(secret: string) {
    const digest = createHash("sha256").update(secret).digest("hex");
    if (digest !== this.secretDigest) {
      this.receipt = null;
      this.secretDigest = digest;
    }
  }
  accept(input: unknown, secret: string, now = Date.now()) {
    this.selectSecret(secret);
    const parsed = metaAdsObservationSchema.safeParse(input);
    if (!parsed.success) return "invalid_payload";
    const observation = parsed.data;
    const observedAt = Date.parse(observation.observedAt);
    if (observedAt > now + 5_000 || now - observedAt > 60_000) return "invalid_time";
    if (this.receipt && observedAt <= Date.parse(this.receipt.observation.observedAt))
      return "out_of_order";
    this.receipt = { observation: structuredClone(observation), receivedAt: now };
    return "accepted";
  }
  snapshot(secret: string, now = Date.now()): MetaAdsConnectionSnapshot {
    this.selectSecret(secret);
    if (!this.receipt) return emptyMetaAdsConnectionSnapshot();
    const { observation, receivedAt } = this.receipt;
    const stale =
      now < receivedAt ||
      now - receivedAt >= META_ADS_STATUS_TTL_MS ||
      now - Date.parse(observation.observedAt) >= META_ADS_STATUS_TTL_MS;
    return {
      accountId: observation.accountId,
      businessId: observation.businessId,
      state: stale ? "stale" : observation.state,
      checkedAt: observation.observedAt,
      receivedAt: new Date(receivedAt).toISOString(),
    };
  }
}
const key = Symbol.for("descomplica.meta-ads.connection.v1");
const registry = globalThis as typeof globalThis & { [key]?: MetaAdsConnectionState };
export const metaAdsConnectionState = (registry[key] ??= new MetaAdsConnectionState());
