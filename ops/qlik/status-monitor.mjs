import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  QLIK_COLLECTION_INTERVAL_MS,
  QLIK_STATUS_PATH,
  qlikStatusObservationSchema,
} from "../../lib/crm/qlik/status-contract.ts";
import { readRankingCredential } from "./ranking-credential.mjs";

/** Only fixed operational metadata leaves the private owner; never source rows or login data. */
export async function publishQlikStatus(
  observation,
  { secret, signal, send = fetch, uuid = randomUUID } = {},
) {
  const parsed = qlikStatusObservationSchema.safeParse(observation);
  if (!parsed.success || typeof secret !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(secret))
    return false;
  try {
    const body = JSON.stringify(parsed.data);
    const digest = createHash("sha256").update(body).digest("hex");
    const timestamp = parsed.data.observedAt;
    const nonce = uuid();
    const signature = createHmac("sha256", secret)
      .update(["POST", QLIK_STATUS_PATH, "qlik-ranking-v2", timestamp, nonce, digest].join("\n"))
      .digest("hex");
    const deadline = AbortSignal.timeout(5000);
    const response = await send(`https://crm.descomplicapro.com.br${QLIK_STATUS_PATH}`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      headers: {
        "content-type": "application/json",
        authorization: `HMAC-SHA256 ${signature}`,
        "x-crm-relay-key-id": "qlik-ranking-v2",
        "x-crm-relay-timestamp": timestamp,
        "x-crm-relay-nonce": nonce,
        "x-crm-relay-content-sha256": digest,
      },
      body,
    });
    await response.body?.cancel().catch(() => {});
    return response.status === 202;
  } catch {
    return false;
  }
}

export function startQlikStatusMonitor({
  signal,
  credential = readRankingCredential,
  publish = publishQlikStatus,
  now = () => new Date(),
  timers = { setInterval, clearInterval },
}) {
  let evidence;
  let publishing = false;
  async function report() {
    if (!evidence || signal.aborted || publishing) return;
    publishing = true;
    try {
      const secret = await credential();
      if (!signal.aborted)
        await publish({ ...evidence, observedAt: now().toISOString() }, { secret, signal });
    } catch {
      /* Status failure never changes or retries a business collection. */
    } finally {
      publishing = false;
    }
  }
  const timer = timers.setInterval(() => void report(), 30_000);
  timer?.unref?.();
  const stop = () => timers.clearInterval(timer);
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  return {
    update(result) {
      const cycleAt = now().toISOString();
      evidence = {
        schemaVersion: 1,
        cycle: result.state,
        cycleAt,
        lastCollectedAt: evidence?.lastCollectedAt ?? null,
        lastPublishedAt: evidence?.lastPublishedAt ?? null,
        sourceUpdatedAt: evidence?.sourceUpdatedAt ?? null,
        nextRunAt:
          result.state === "running"
            ? null
            : new Date(Date.parse(cycleAt) + QLIK_COLLECTION_INTERVAL_MS).toISOString(),
      };
      if (result.state === "succeeded") {
        evidence.lastCollectedAt = result.completedAt;
        evidence.lastPublishedAt = cycleAt;
        evidence.sourceUpdatedAt = result.sourceUpdatedAt
          ? new Date(result.sourceUpdatedAt).toISOString()
          : null;
      }
      void report();
    },
    stop() {
      stop();
      signal.removeEventListener("abort", stop);
    },
  };
}
