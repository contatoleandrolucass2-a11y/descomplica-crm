import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { test } from "node:test";
import { startQlikCollectionLoop } from "./collection-loop.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  let now = 0;
  let nextId = 0;
  const pending = new Map();
  const controller = new AbortController();
  const statuses = [];
  const timers = {
    setTimeout(callback, delay) {
      const id = ++nextId;
      pending.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
  };
  return {
    controller,
    statuses,
    pending,
    options: {
      signal: controller.signal,
      intervalMs: 100,
      timeoutMs: 20,
      clock: () => now,
      timers,
      onStatus: (status) => statuses.push(status),
    },
    async advance(ms, fireTimers = true) {
      now += ms;
      if (fireTimers) {
        for (const [id, timer] of [...pending]) {
          if (timer.at <= now && pending.delete(id)) timer.callback();
        }
      }
      await flush();
    },
    assertClean() {
      assert.equal(pending.size, 0);
      assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    },
  };
}

test("starts immediately and waits a full interval after each settled cycle", async () => {
  const f = fixture();
  let calls = 0;
  const loop = startQlikCollectionLoop({
    ...f.options,
    collect: async () => {
      calls += 1;
      return { state: "succeeded" };
    },
  });
  await flush();
  assert.equal(calls, 1);
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "succeeded" }]);
  await f.advance(99);
  assert.equal(calls, 1);
  await f.advance(1);
  assert.equal(calls, 2);
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("uses the requested defaults without waiting on wall clock time", async () => {
  const f = fixture();
  const work = Promise.withResolvers();
  const loop = startQlikCollectionLoop({
    ...f.options,
    intervalMs: undefined,
    timeoutMs: undefined,
    collect: () => work.promise,
  });
  await flush();
  assert.equal([...f.pending.values()][0].at, 120_000);
  work.resolve({ state: "succeeded" });
  await flush();
  assert.equal([...f.pending.values()][0].at, 3_600_000);
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("timeout aborts but never overlaps an uncooperative late callback", async () => {
  const f = fixture();
  const work = Promise.withResolvers();
  let cycleSignal;
  let calls = 0;
  const loop = startQlikCollectionLoop({
    ...f.options,
    collect: ({ signal }) => {
      calls += 1;
      cycleSignal = signal;
      return calls === 1 ? work.promise : { state: "succeeded" };
    },
  });
  await flush();
  await f.advance(20);
  assert.equal(cycleSignal.aborted, true);
  await f.advance(10_000);
  assert.equal(calls, 1);
  assert.equal(f.pending.size, 0);
  work.resolve({ state: "succeeded", data: "must not publish late results" });
  await flush();
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "unavailable" }]);
  await f.advance(99);
  assert.equal(calls, 1);
  await f.advance(1);
  assert.equal(calls, 2);
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("rejects late success even before an overdue timeout callback runs", async () => {
  const f = fixture();
  const work = Promise.withResolvers();
  const loop = startQlikCollectionLoop({ ...f.options, collect: () => work.promise });
  await flush();
  await f.advance(20, false);
  work.resolve({ state: "succeeded" });
  await flush();
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "unavailable" }]);
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("cooperative timeout rejection is unavailable and retries only next interval", async () => {
  const f = fixture();
  let calls = 0;
  const loop = startQlikCollectionLoop({
    ...f.options,
    collect: ({ signal }) => {
      calls += 1;
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("private timeout detail")), {
          once: true,
        });
      });
    },
  });
  await flush();
  await f.advance(20);
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "unavailable" }]);
  await f.advance(99);
  assert.equal(calls, 1);
  await f.advance(1);
  assert.equal(calls, 2);
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("an overdue running observer cannot start a collection after the deadline", async () => {
  const f = fixture();
  const observed = Promise.withResolvers();
  const loop = startQlikCollectionLoop({
    ...f.options,
    collect: () => assert.fail("unexpected cycle"),
    onStatus: (status) => {
      f.statuses.push(status);
      if (status.state === "running") return observed.promise;
    },
  });
  await f.advance(20, false);
  observed.resolve();
  await flush();
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "unavailable" }]);
  f.controller.abort();
  await loop;
  f.assertClean();
});

for (const rejects of [false, true]) {
  test(`shutdown waits for the owned callback to ${rejects ? "reject" : "resolve"}`, async () => {
    const f = fixture();
    const work = Promise.withResolvers();
    let cycleSignal;
    let stopped = false;
    const loop = startQlikCollectionLoop({
      ...f.options,
      collect: ({ signal }) => {
        cycleSignal = signal;
        return work.promise;
      },
    }).then(() => {
      stopped = true;
    });
    await flush();
    f.controller.abort(new Error("private stop reason"));
    await flush();
    assert.equal(cycleSignal.aborted, true);
    assert.notEqual(cycleSignal.reason, f.controller.signal.reason);
    assert.equal(stopped, false);
    if (rejects) work.reject(new Error("private upstream detail"));
    else work.resolve({ state: "succeeded" });
    await loop;
    assert.equal(stopped, true);
    assert.deepEqual(f.statuses, [{ state: "running" }]);
    f.assertClean();
  });
}

test("already aborted signal starts no timer, callback or status", async () => {
  const f = fixture();
  f.controller.abort();
  await startQlikCollectionLoop({ ...f.options, collect: () => assert.fail("unexpected cycle") });
  assert.deepEqual(f.statuses, []);
  f.assertClean();
});

test("reauth pauses until the regular interval, then detects manual recovery", async () => {
  const f = fixture();
  let calls = 0;
  const loop = startQlikCollectionLoop({
    ...f.options,
    collect: () => ({ state: ++calls === 1 ? "reauth_required" : "succeeded" }),
  });
  await flush();
  await f.advance(99);
  assert.equal(calls, 1);
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "reauth_required" }]);
  await f.advance(1);
  assert.equal(calls, 2);
  assert.deepEqual(f.statuses.at(-1), { state: "succeeded" });
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("errors, unknown results and result getters fail closed without leaking details", async () => {
  const f = fixture();
  const callbacks = [
    () => {
      throw new Error("private sync failure");
    },
    () => Promise.reject(new Error("private async failure")),
    () => ({ state: "private arbitrary state", message: "secret" }),
    () => undefined,
    () => ({
      get state() {
        throw new Error("private getter");
      },
    }),
    () => ({ state: "unavailable", message: "secret" }),
  ];
  const loop = startQlikCollectionLoop({ ...f.options, collect: () => callbacks.shift()() });
  await flush();
  for (let i = 0; i < 5; i += 1) await f.advance(100);
  assert.deepEqual(
    f.statuses,
    Array.from({ length: 6 }, () => [{ state: "running" }, { state: "unavailable" }]).flat(),
  );
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("emits no counts, timestamps, payload or diagnostics and never touches data", async () => {
  const f = fixture();
  const result = Object.freeze({
    state: "succeeded",
    count: 12,
    timestamp: "untrusted",
    get data() {
      assert.fail("data accessed");
    },
  });
  const loop = startQlikCollectionLoop({ ...f.options, collect: () => result });
  await flush();
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "succeeded" }]);
  assert.ok(f.statuses.every(Object.isFrozen));
  f.controller.abort();
  await loop;
  f.assertClean();
});

test("observer failures are contained and shutdown waits for a pending observer", async () => {
  const f = fixture();
  const observed = Promise.withResolvers();
  let stopped = false;
  const loop = startQlikCollectionLoop({
    ...f.options,
    collect: () => ({ state: "succeeded" }),
    onStatus: (status) => {
      f.statuses.push(status);
      if (status.state === "running") throw new Error("private observer error");
      return observed.promise;
    },
  }).then(() => {
    stopped = true;
  });
  await flush();
  f.controller.abort();
  await flush();
  assert.equal(stopped, false);
  observed.reject(new Error("private async observer error"));
  await loop;
  assert.deepEqual(f.statuses, [{ state: "running" }, { state: "succeeded" }]);
  f.assertClean();
});

test("abort from running observer prevents collection", async () => {
  const f = fixture();
  await startQlikCollectionLoop({
    ...f.options,
    collect: () => assert.fail("unexpected cycle"),
    onStatus: () => f.controller.abort(),
  });
  f.assertClean();
});

test("invalid timing and callback options reject before starting", async () => {
  const f = fixture();
  for (const option of [
    ...[0, -1, 0.5, NaN, Infinity, 2_147_483_648, "100"].flatMap((value) => [
      { intervalMs: value },
      { timeoutMs: value },
    ]),
    { collect: null },
    { onStatus: null },
    { signal: undefined },
    { clock: 0 },
    { timers: {} },
    { timers: null },
  ]) {
    await assert.rejects(
      startQlikCollectionLoop({
        ...f.options,
        collect: () => assert.fail("unexpected cycle"),
        ...option,
      }),
      { message: "invalid_collection_loop_options" },
    );
  }
  assert.deepEqual(f.statuses, []);
  f.assertClean();
});
