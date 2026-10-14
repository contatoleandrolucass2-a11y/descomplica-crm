import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { holdBrowserSession, startRankingCollection } from "./launch-browser.mjs";
import { startQlikCollectionLoop } from "./collection-loop.mjs";
import { rankingCycleArtifact } from "./ranking-artifact.mjs";

function fixture(goto) {
  const browser = new EventEmitter();
  const signals = new EventEmitter();
  const messages = [];
  let closed = false;
  browser.pages = () => [{ goto }];
  browser.close = async () => {
    if (!closed) {
      closed = true;
      browser.emit("close");
    }
  };
  return { browser, signals, messages, closed: () => closed };
}

test("initial navigation failure leaves the session available for manual recovery", async () => {
  const f = fixture(async () => {
    throw new Error("private upstream detail");
  });
  const session = holdBrowserSession(f.browser, {
    signalSource: f.signals,
    log: (message) => f.messages.push(message),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.closed(), false);
  assert.deepEqual(f.messages, ["qlik_navigation_pending"]);
  f.signals.emit("SIGTERM");
  await session;
  assert.equal(f.closed(), true);
  assert.equal(f.signals.listenerCount("SIGTERM"), 0);
});

test("SIGTERM during navigation closes cleanly without a false unavailable diagnostic", async () => {
  const navigation = Promise.withResolvers();
  const f = fixture(() => navigation.promise);
  f.browser.once("close", () => navigation.reject(new Error("navigation closed")));
  const session = holdBrowserSession(f.browser, {
    signalSource: f.signals,
    log: (message) => f.messages.push(message),
  });
  f.signals.emit("SIGTERM");
  await session;
  assert.deepEqual(f.messages, []);
  assert.equal(f.closed(), true);
});

test("closing the remote browser releases signal handlers", async () => {
  const f = fixture(async () => {});
  const session = holdBrowserSession(f.browser, { signalSource: f.signals });
  await new Promise((resolve) => setImmediate(resolve));
  await f.browser.close();
  await session;
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"])
    assert.equal(f.signals.listenerCount(signal), 0);
});

test("collection belongs to browser lifetime and shutdown awaits cancellation", async () => {
  const f = fixture(async () => {});
  const finished = Promise.withResolvers();
  let collectionSignal;
  let resolved = false;
  const session = holdBrowserSession(f.browser, {
    signalSource: f.signals,
    startCollection: async (signal) => {
      collectionSignal = signal;
      await finished.promise;
    },
  }).then(() => {
    resolved = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(collectionSignal.aborted, false);
  f.signals.emit("SIGTERM");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(collectionSignal.aborted, true);
  assert.equal(resolved, false);
  finished.resolve();
  await session;
  assert.equal(resolved, true);
});

test("collection errors are sanitized without closing the login session", async () => {
  const f = fixture(async () => {});
  const session = holdBrowserSession(f.browser, {
    signalSource: f.signals,
    log: (message) => f.messages.push(message),
    startCollection: async () => {
      throw new Error("private upstream token");
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.messages, ["qlik_metadata_preflight_unavailable"]);
  assert.equal(f.closed(), false);
  await f.browser.close();
  await session;
});

test("shutdown during navigation never starts collection", async () => {
  const navigation = Promise.withResolvers();
  const f = fixture(() => navigation.promise);
  let calls = 0;
  f.browser.once("close", () => navigation.reject(new Error("closed")));
  const session = holdBrowserSession(f.browser, {
    signalSource: f.signals,
    startCollection: () => {
      calls++;
    },
  });
  f.signals.emit("SIGTERM");
  await session;
  assert.equal(calls, 0);
});

test("ranking loop keeps the successful receipt and uses bounded hourly cycles", async () => {
  const controller = new AbortController();
  const events = [];
  const collect = async () => {};
  const receipt = { state: "succeeded", batchId: "receipt" };
  await startRankingCollection({
    signal: controller.signal,
    collect,
    credential: async () => {
      events.push("credential");
      return "private fixture";
    },
    cycle: async (options) => {
      assert.equal(options.signal, controller.signal);
      assert.equal(options.secret, "private fixture");
      assert.equal(options.collect, collect);
      return receipt;
    },
    write: async (value) => events.push(value),
    loop: async (options) => {
      assert.equal(options.intervalMs, 3_600_000);
      assert.equal(options.timeoutMs, 480_000);
      assert.equal(options.signal, controller.signal);
      await options.onStatus({ state: "running" });
      assert.equal(await options.collect({ signal: controller.signal }), receipt);
      assert.deepEqual(events, [{ state: "running" }, "credential"]);
      await options.onStatus({ state: "succeeded" });
    },
  });
  assert.deepEqual(events, [{ state: "running" }, "credential", receipt]);
});

test("expired ranking cycles never expose their successful result as an artifact", async () => {
  const signal = new AbortController().signal;
  const writes = [];
  await startRankingCollection({
    signal,
    collect: async () => {},
    credential: async () => "fixture",
    cycle: async () => ({ state: "succeeded", batchId: "expired" }),
    write: async (result) => writes.push(result),
    loop: async (options) => {
      await options.onStatus({ state: "running" });
      await options.collect({ signal });
      await options.onStatus({ state: "unavailable" });
    },
  });
  assert.deepEqual(writes, [{ state: "running" }, { state: "unavailable" }]);
});

for (const state of ["unavailable", "reauth_required", "succeeded"]) {
  for (const elapsed of [479_999, 480_000, 480_001, -1, NaN, Infinity]) {
    test(`ranking real loop preserves only accepted ${state} at elapsed ${elapsed}`, async () => {
      const controller = new AbortController();
      let clock = 0;
      const writes = [];
      const result =
        state === "succeeded"
          ? {
              state,
              batchId: "11111111-1111-4111-8111-111111111111",
              requestId: "22222222-2222-4222-8222-222222222222",
              contentSha256: "a".repeat(64),
              completedAt: "2026-10-14T18:00:00.000Z",
            }
          : { state, reason: "definition_changed" };
      await startRankingCollection({
        signal: controller.signal,
        collect: async () => {},
        credential: async () => "fixture",
        cycle: async () => {
          clock = elapsed;
          return result;
        },
        clock: () => clock,
        loop: (options) =>
          startQlikCollectionLoop({
            ...options,
            timers: {
              setTimeout: () => 1,
              clearTimeout: () => {},
            },
          }),
        write: async (value) => {
          writes.push(rankingCycleArtifact(value).result);
          if (value.state !== "running") controller.abort();
        },
      });
      const accepted = elapsed === 479_999;
      assert.deepEqual(writes, [
        { state: "running" },
        accepted
          ? state === "succeeded"
            ? result
            : { state, code: "definition_changed" }
          : { state: "unavailable" },
      ]);
    });
  }
}

test("timer cancellation suppresses a failure code even before its clock deadline", async () => {
  const controller = new AbortController();
  const writes = [];
  let timeout;
  await startRankingCollection({
    signal: controller.signal,
    collect: async () => {},
    credential: async () => "fixture",
    clock: () => 0,
    cycle: async () => {
      timeout();
      return { state: "unavailable", reason: "mapping_invalid" };
    },
    loop: (options) =>
      startQlikCollectionLoop({
        ...options,
        timers: {
          setTimeout: (callback) => {
            timeout = callback;
            return 1;
          },
          clearTimeout: () => {},
        },
      }),
    write: async (result) => {
      writes.push(result);
      if (result.state !== "running") controller.abort();
    },
  });
  assert.deepEqual(writes, [{ state: "running" }, { state: "unavailable" }]);
});

test("failed final monotonic clock observation cannot preserve a failure diagnostic", async () => {
  const controller = new AbortController();
  const writes = [];
  let completed = false;
  await startRankingCollection({
    signal: controller.signal,
    collect: async () => {},
    credential: async () => "fixture",
    cycle: async () => {
      completed = true;
      return { state: "unavailable", reason: "mapping_invalid" };
    },
    clock: () => {
      if (completed) throw new Error("private clock failure");
      return 0;
    },
    write: async (result) => {
      writes.push(result);
      if (result.state !== "running") controller.abort();
    },
  });
  assert.deepEqual(writes, [{ state: "running" }, { state: "unavailable" }]);
});

test("ranking failure diagnostics never leak from an earlier hourly cycle", async () => {
  const controller = new AbortController();
  const writes = [];
  let credentials = 0;
  let clock = 0;
  await startRankingCollection({
    signal: controller.signal,
    collect: async () => {},
    credential: async () => {
      if (++credentials === 2) throw new Error("private credential failure");
      return "fixture";
    },
    cycle: async () => {
      clock += 100;
      return {
        state: "unavailable",
        reason: credentials === 1 ? "mapping_invalid" : "reload_changed",
      };
    },
    clock: () => clock,
    loop: (options) =>
      startQlikCollectionLoop({
        ...options,
        timers: {
          setTimeout: (callback, milliseconds) => {
            if (milliseconds === 3_600_000) {
              clock += milliseconds;
              queueMicrotask(callback);
            }
            return 1;
          },
          clearTimeout: () => {},
        },
      }),
    write: async (result) => {
      writes.push(rankingCycleArtifact(result).result);
      if (credentials === 3 && result.state !== "running") controller.abort();
    },
  });
  assert.deepEqual(writes, [
    { state: "running" },
    { state: "unavailable", code: "mapping_invalid" },
    { state: "running" },
    { state: "unavailable" },
    { state: "running" },
    { state: "unavailable", code: "reload_changed" },
  ]);
});

for (const at of ["before", "credential", "cycle"]) {
  test(`ranking shutdown ${at} never writes a successful receipt`, async () => {
    const controller = new AbortController();
    const writes = [];
    let cycles = 0;
    if (at === "before") controller.abort();
    await startRankingCollection({
      signal: controller.signal,
      collect: async () => {},
      credential: async () => {
        if (at === "credential") controller.abort();
        return "private fixture";
      },
      cycle: async () => {
        cycles++;
        controller.abort();
        return { state: "succeeded" };
      },
      write: async (result) => writes.push(result),
      loop: async ({ collect }) => {
        assert.deepEqual(await collect({ signal: controller.signal }), { state: "unavailable" });
      },
    });
    assert.equal(cycles, at === "cycle" ? 1 : 0);
    assert.deepEqual(writes, []);
  });
}

test("ranking credential failure does not invoke a source collection", async () => {
  const signal = new AbortController().signal;
  await startRankingCollection({
    signal,
    collect: async () => assert.fail("source must not run"),
    credential: async () => {
      throw new Error("ranking_credential_unavailable");
    },
    cycle: async () => assert.fail("cycle must not run"),
    loop: async ({ collect }) => {
      await assert.rejects(collect({ signal }), /ranking_credential_unavailable/);
    },
  });
});

test("Linux main explicitly exits nonzero for an unrecoverable ranking owner", () => {
  const launcher = new URL("./launch-browser.mjs", import.meta.url).href;
  const source = `
    import assert from "node:assert/strict";
    import { mock } from "node:test";
    import { EventEmitter } from "node:events";
    import { fileURLToPath } from "node:url";
    const launcher = ${JSON.stringify(launcher)};
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "getuid", { value: () => 997 });
    process.argv[1] = fileURLToPath(launcher);
    const browser = new EventEmitter();
    browser.pages = () => [{ goto: async () => {} }];
    browser.close = async () => browser.emit("close");
    mock.module("node:fs/promises", { namedExports: {
      lstat: async (path) => {
        assert.equal(path, "/var/lib/descomplica-qlik/chrome");
        return { isDirectory: () => true, isSymbolicLink: () => false, uid: 997, mode: 0o700 };
      },
    }});
    mock.module("@playwright/test", { namedExports: {
      chromium: { launchPersistentContext: async () => browser },
    }});
    const replace = (name, namedExports) => mock.module(new URL(name, launcher).href, { namedExports });
    replace("./browser-preflight.mjs", { collectBrowserMetadata: async () => assert.fail("wrong mode") });
    replace("./metadata-artifact.mjs", { writeMetadataArtifact: async () => assert.fail("wrong mode") });
    replace("./ranking-credential.mjs", { readRankingCredential: async () => "synthetic-only" });
    replace("./ranking-artifact.mjs", { writeRankingArtifact: async () => {} });
    replace("./ranking-cycle.mjs", { runRankingCycle: async ({ collect, signal }) => collect({ signal }) });
    replace("./browser-ranking.mjs", { collectBrowserRanking: async (context, options) => {
      assert.equal(context, browser);
      assert.equal(typeof options.onOwnerUnrecoverable, "function");
      console.log("ranking_callback_reached");
      options.onOwnerUnrecoverable("page_disposal_unconfirmed");
      assert.fail("owner must exit");
    }});
    await import(launcher);
  `;
  const child = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--input-type=module", "-e", source],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 16_384,
      env: {
        SystemRoot: process.env.SystemRoot ?? "",
        DISPLAY: ":98",
        QLIK_RANKING_COLLECTION: "enabled",
      },
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stdout, /ranking_callback_reached/);
  assert.match(child.stderr, /qlik_owner_unrecoverable/);
  assert.doesNotMatch(child.stderr, /synthetic-only/);
});
