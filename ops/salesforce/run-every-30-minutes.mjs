import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { exportCandidate } from "./export-candidate.mjs";
import {
  createCollectorProgress,
  runConnectionMonitor,
  statusDestination,
} from "./connection-monitor.mjs";

const INTERVAL_MS = 30 * 60 * 1_000;

function log(message, details = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), message, ...details })}\n`,
  );
}

export function millisecondsUntilNextHalfHour(now = Date.now()) {
  const remainder = now % INTERVAL_MS;
  return remainder === 0 ? INTERVAL_MS : INTERVAL_MS - remainder;
}

export async function runEveryThirtyMinutes(options = {}) {
  const run = options.run ?? exportCandidate;
  const waitFor = options.waitFor ?? wait;
  const now = options.now ?? Date.now;
  const signal = options.signal;
  const writeLog = options.log ?? log;

  while (!signal?.aborted) {
    try {
      await run();
    } catch {
      writeLog("candidate cycle failed; publication not confirmed");
    }

    const scheduledAt = now();
    const delayMs = millisecondsUntilNextHalfHour(scheduledAt);
    options.onSchedule?.(scheduledAt + delayMs);
    writeLog("next Salesforce candidate cycle scheduled", {
      delaySeconds: Math.ceil(delayMs / 1_000),
    });
    try {
      await waitFor(delayMs, undefined, signal ? { signal } : undefined);
    } catch (error) {
      if (signal?.aborted && error instanceof Error && error.name === "AbortError") return;
      throw error;
    }
  }
}

export async function runCollector(environment = process.env, options = {}) {
  await statusDestination(environment, options);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const progress = options.progress ?? createCollectorProgress(options.now);
  const jobs = [
    (options.monitor ?? runConnectionMonitor)(environment, {
      ...options,
      progress,
      signal: controller.signal,
    }),
    runEveryThirtyMinutes({
      ...options,
      signal: controller.signal,
      onSchedule: (timestamp) => progress.scheduled(timestamp),
      run: async () => {
        progress.start();
        try {
          const candidate = await (options.export ?? exportCandidate)(environment, {
            signal: controller.signal,
            onCollected: (result) => progress.collected(result),
          });
          progress.succeed(candidate, environment.SALESFORCE_N8N_PUBLISH_ENABLED === "true");
        } catch (error) {
          progress.fail(
            error?.code === "publication_failed" ? "publication_failed" : "export_failed",
          );
          throw error;
        }
      },
    }),
  ];
  try {
    await Promise.all(jobs);
  } finally {
    abort();
    options.signal?.removeEventListener("abort", abort);
    await Promise.allSettled(jobs);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  runCollector(process.env, { signal: controller.signal }).catch(() => {
    log("Salesforce scheduler failed; check private configuration");
    process.exitCode = 1;
  });
}
