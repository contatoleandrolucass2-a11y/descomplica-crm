import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { publishQlikStatus, startQlikStatusMonitor } from "./status-monitor.mjs";
const secret = "a".repeat(43);
const now = new Date("2026-10-16T12:00:00.000Z");
const observation = {
  schemaVersion: 1,
  observedAt: now.toISOString(),
  cycleAt: now.toISOString(),
  cycle: "running",
  lastCollectedAt: null,
  lastPublishedAt: null,
  sourceUpdatedAt: null,
  nextRunAt: null,
};
test("status signs only the fixed endpoint and bounded operational metadata", async () => {
  let sent;
  assert.equal(
    await publishQlikStatus(observation, {
      secret,
      send: async (url, options) => {
        sent = { url, ...options };
        return new Response(null, { status: 202 });
      },
    }),
    true,
  );
  assert.equal(sent.url, "https://crm.descomplicapro.com.br/api/ingest/qlik/status");
  const h = sent.headers;
  const digest = createHash("sha256").update(sent.body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update(
      [
        "POST",
        "/api/ingest/qlik/status",
        "qlik-ranking-v2",
        h["x-crm-relay-timestamp"],
        h["x-crm-relay-nonce"],
        digest,
      ].join("\n"),
    )
    .digest("hex");
  assert.equal(h.authorization, `HMAC-SHA256 ${signature}`);
  assert.equal(sent.redirect, "error");
  assert.equal(sent.body.includes(secret), false);
  assert.equal(
    await publishQlikStatus(
      { ...observation, rows: [] },
      { secret, send: () => assert.fail("unexpected send") },
    ),
    false,
  );
});
test("transport failures stay sanitized and cannot fail a collection", async () => {
  assert.equal(
    await publishQlikStatus(observation, {
      secret,
      send: async () => {
        throw new Error(secret);
      },
    }),
    false,
  );
  assert.equal(
    await publishQlikStatus(observation, {
      secret,
      send: async () => new Response(null, { status: 401 }),
    }),
    false,
  );
});
test("heartbeat keeps publication history, schedules hourly, and stops on shutdown", async () => {
  const controller = new AbortController();
  let tick;
  let cleared = false;
  let current = now;
  const sent = [];
  const monitor = startQlikStatusMonitor({
    signal: controller.signal,
    credential: async () => secret,
    now: () => current,
    timers: {
      setInterval(fn, ms) {
        assert.equal(ms, 30_000);
        tick = fn;
        return 1;
      },
      clearInterval(id) {
        assert.equal(id, 1);
        cleared = true;
      },
    },
    publish: async (input) => {
      sent.push(input);
      return true;
    },
  });
  monitor.update({ state: "running" });
  await new Promise(setImmediate);
  assert.equal(sent.at(-1).nextRunAt, null);
  const completedAt = now.toISOString();
  current = new Date(now.getTime() + 1000);
  monitor.update({ state: "succeeded", completedAt, sourceUpdatedAt: completedAt });
  await new Promise(setImmediate);
  assert.equal(sent.at(-1).lastPublishedAt, current.toISOString());
  assert.equal(sent.at(-1).nextRunAt, "2026-10-16T13:00:01.000Z");
  current = new Date(now.getTime() + 3_601_000);
  monitor.update({ state: "reauth_required" });
  await new Promise(setImmediate);
  assert.equal(sent.at(-1).lastCollectedAt, completedAt);
  const count = sent.length;
  controller.abort();
  tick();
  await new Promise(setImmediate);
  assert.equal(cleared, true);
  assert.equal(sent.length, count);
});
test("slow status delivery never overlaps heartbeats or blocks collection status updates", async () => {
  const controller = new AbortController();
  let tick;
  let release;
  let calls = 0;
  const monitor = startQlikStatusMonitor({
    signal: controller.signal,
    credential: async () => secret,
    now: () => now,
    timers: {
      setInterval(fn) {
        tick = fn;
        return 1;
      },
      clearInterval() {},
    },
    publish: async () => {
      calls++;
      await new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  monitor.update({ state: "running" });
  await new Promise(setImmediate);
  tick();
  tick();
  monitor.update({ state: "unavailable" });
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  release();
  await new Promise(setImmediate);
  tick();
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  release();
  controller.abort();
});
