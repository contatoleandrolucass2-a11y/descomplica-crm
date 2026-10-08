import assert from "node:assert/strict";
import { test } from "node:test";

import {
  millisecondsUntilNextHalfHour,
  runEveryThirtyMinutes,
  runCollector,
} from "./run-every-30-minutes.mjs";
import { createCollectorProgress } from "./connection-monitor.mjs";
import { salesforceReportKeys } from "../../lib/crm/salesforce/connection-contract.ts";

test("schedules the next run on a 30-minute boundary", () => {
  assert.equal(millisecondsUntilNextHalfHour(0), 30 * 60 * 1_000);
  assert.equal(millisecondsUntilNextHalfHour(1), 30 * 60 * 1_000 - 1);
  assert.equal(millisecondsUntilNextHalfHour(30 * 60 * 1_000), 30 * 60 * 1_000);
  assert.equal(millisecondsUntilNextHalfHour(45 * 60 * 1_000), 15 * 60 * 1_000);
});

test("waits for a cycle to finish before scheduling another one", async () => {
  const controller = new AbortController();
  const events = [];
  await runEveryThirtyMinutes({
    signal: controller.signal,
    log: () => {},
    now: () => 15 * 60 * 1_000,
    run: async () => {
      events.push("run:start", "run:end");
    },
    waitFor: async (delayMs) => {
      events.push(`wait:${delayMs}`);
      controller.abort();
    },
  });
  assert.deepEqual(events, ["run:start", "run:end", `wait:${15 * 60 * 1_000}`]);
});

test("keeps the scheduler alive after a failed cycle", async () => {
  const controller = new AbortController();
  let runs = 0;
  await runEveryThirtyMinutes({
    signal: controller.signal,
    log: () => {},
    now: () => 15 * 60 * 1_000,
    run: async () => {
      runs += 1;
      if (runs === 1) throw new Error("manual login required");
      controller.abort();
    },
    waitFor: async () => {},
  });
  assert.equal(runs, 2);
});

test("collector shutdown cancels monitor and does not overlap export cycles", async () => {
  const controller = new AbortController();
  const progress = createCollectorProgress(() => 1000);
  let monitored = false;
  let cycles = 0;
  await runCollector(
    {},
    {
      signal: controller.signal,
      progress,
      log: () => {},
      now: () => 1000,
      monitor: async (_env, { signal }) => {
        await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
        monitored = true;
      },
      export: async (_env, { signal }) => {
        assert.equal(signal.aborted, false);
        cycles += 1;
        return {
          payload: { dashboard: { generatedAt: new Date(1000).toISOString() } },
          diagnostics: {
            sourceRows: Object.fromEntries(salesforceReportKeys.map((key) => [key, 1])),
          },
        };
      },
      waitFor: async () => controller.abort(),
    },
  );
  assert.equal(cycles, 1);
  assert.equal(monitored, true);
  assert.equal(progress.snapshot().cycle, "succeeded");
  assert.equal(progress.snapshot().lastPublishedAt, null);
});

test("collector distinguishes an unconfirmed publication from an export failure", async () => {
  const controller = new AbortController();
  const progress = createCollectorProgress();
  await runCollector(
    {},
    {
      signal: controller.signal,
      progress,
      log: () => {},
      export: async (_environment, { onCollected }) => {
        onCollected({
          payload: { dashboard: { generatedAt: new Date(1000).toISOString() } },
          diagnostics: {
            sourceRows: Object.fromEntries(salesforceReportKeys.map((key) => [key, 3])),
          },
        });
        throw Object.assign(new Error("redacted"), { code: "publication_failed" });
      },
      waitFor: async () => controller.abort(),
    },
  );
  assert.equal(progress.snapshot().errorCode, "publication_failed");
  assert.equal(progress.snapshot().lastPublishedAt, null);
  assert.equal(progress.snapshot().lastExportAt, new Date(1000).toISOString());
  assert.equal(progress.snapshot().reports.length, 7);
});
