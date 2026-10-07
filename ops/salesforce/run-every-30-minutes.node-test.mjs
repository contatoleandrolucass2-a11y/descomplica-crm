import assert from "node:assert/strict";
import { test } from "node:test";

import { millisecondsUntilNextHalfHour, runEveryThirtyMinutes } from "./run-every-30-minutes.mjs";

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
