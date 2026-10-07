import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { exportCandidate } from "./export-candidate.mjs";

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
    } catch (error) {
      writeLog("candidate cycle failed", {
        error: error instanceof Error ? error.message : "unknown Salesforce candidate failure",
      });
    }

    const delayMs = millisecondsUntilNextHalfHour(now());
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  runEveryThirtyMinutes({ signal: controller.signal }).catch((error) => {
    log("Salesforce scheduler failed", {
      error: error instanceof Error ? error.message : "unknown Salesforce scheduler failure",
    });
    process.exitCode = 1;
  });
}
