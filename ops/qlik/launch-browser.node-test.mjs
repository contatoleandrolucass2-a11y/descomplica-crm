import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  collectAuthenticatedMetadata,
  holdBrowserSession,
  startRankingCollection,
} from "./launch-browser.mjs";
import { startQlikCollectionLoop } from "./collection-loop.mjs";
import { rankingCycleArtifact } from "./ranking-artifact.mjs";
import { collectBrowserRanking } from "./browser-ranking.mjs";
import { runRankingCycle } from "./ranking-cycle.mjs";
import { createRankingMapping } from "./ranking-mapping.mjs";

// Synthetic transport metadata only; never a source of production pins.
function syntheticDefinition() {
  const cube = (role) => ({
    objectId: `synthetic_${role}`,
    cubeSha256: "b".repeat(64),
    idField: "SyntheticIdentity",
    idEncoding: "plain",
    vgvMeasureIndex: 0,
    contractsMeasureIndex: 1,
    masterPins: [],
  });
  return {
    verified: true,
    provenance: {
      kind: "synthetic-fixture",
      observedAt: "2026-01-01T00:00:00.000Z",
      metadataSha256: "a".repeat(64),
    },
    filters: [
      { field: "SyntheticBusinessUnit", value: "Direcional" },
      { field: "SyntheticRegional", value: "SP CAPITAL" },
      { field: "SyntheticChannel", value: "CANAL IMOB" },
    ],
    calendar: {
      expression: "=Year([DT])&Num(Month([DT]),'00')",
      selectionFields: ["SyntheticYearMonth"],
    },
    cubes: { imobs: cube("imobs"), developments: cube("developments") },
  };
}

function syntheticMapping() {
  return createRankingMapping({
    now: () => new Date("2026-11-01T02:59:59.999Z"),
    definition: syntheticDefinition(),
  });
}

test("ranking authenticates before loading its writer credential or starting collection", async () => {
  const events = [];
  const signal = new AbortController().signal;
  await startRankingCollection({
    signal,
    collect: async () => {},
    authenticate: async (options) => {
      assert.equal(options.signal, signal);
      events.push("login");
      return { status: "authenticated" };
    },
    mappingFactory: () => {
      events.push("mapping");
      return syntheticMapping();
    },
    credential: async () => {
      events.push("credential");
      return "fixture";
    },
    cycle: async () => {
      events.push("cycle");
      return { state: "unavailable" };
    },
    write: async () => {},
    loop: async (options) => {
      await options.collect({ signal });
    },
  });
  assert.deepEqual(events, ["login", "mapping", "credential", "cycle"]);
});

test("MFA, unknown login and cancellation cannot load the ranking writer credential", async () => {
  for (const status of ["reauth_required", "unavailable", "unknown", "cancel"]) {
    const abort = new AbortController();
    await startRankingCollection({
      signal: abort.signal,
      collect: async () => assert.fail("No collection while login is unavailable"),
      authenticate: async () => {
        if (status === "cancel") abort.abort();
        return { status };
      },
      mappingFactory: () => assert.fail("No mapping access before authenticated session"),
      credential: async () => assert.fail("No HMAC access before authenticated session"),
      cycle: async () => assert.fail("No publication while login is unavailable"),
      write: async () => {},
      loop: async (options) => {
        const result = await options.collect({ signal: abort.signal });
        assert.equal(
          result.state,
          status === "reauth_required" ? "reauth_required" : "unavailable",
        );
      },
    });
  }
});

test("invalid or unverified mapping never reads HMAC or starts a publication cycle", async () => {
  for (const mappingFactory of [
    () => createRankingMapping({ definition: null }),
    () => {
      throw new Error("mapping_unverified: private source detail");
    },
    () => null,
    () => ({ ...syntheticMapping(), verified: false }),
    () => ({ ...syntheticMapping(), appId: "wrong-source" }),
    () => ({ ...syntheticMapping(), unsupported: () => {} }),
  ]) {
    const signal = new AbortController().signal;
    await startRankingCollection({
      signal,
      authenticate: async () => ({ status: "authenticated" }),
      mappingFactory,
      credential: () => assert.fail("No HMAC for an invalid mapping"),
      collect: () => assert.fail("No browser collection for an invalid mapping"),
      cycle: () => assert.fail("No publication cycle for an invalid mapping"),
      loop: async ({ collect }) => {
        assert.deepEqual(await collect({ signal }), {
          state: "unavailable",
          reason: "mapping_invalid",
        });
      },
    });
  }
});

test("cancellation while creating the mapping never reads HMAC or starts collection", async () => {
  const abort = new AbortController();
  const entered = Promise.withResolvers();
  const pending = Promise.withResolvers();
  const work = startRankingCollection({
    signal: abort.signal,
    authenticate: async () => ({ status: "authenticated" }),
    mappingFactory: () => {
      entered.resolve();
      return pending.promise;
    },
    credential: () => assert.fail("No HMAC after mapping cancellation"),
    collect: () => assert.fail("No collection after mapping cancellation"),
    cycle: () => assert.fail("No publication after mapping cancellation"),
    loop: async ({ collect }) => {
      assert.deepEqual(await collect({ signal: abort.signal }), { state: "unavailable" });
    },
  });
  await entered.promise;
  abort.abort();
  pending.resolve(syntheticMapping());
  await work;
});

test("one detached mapping crosses the real browser script boundary twice and refreshes next cycle", async () => {
  const signal = new AbortController().signal;
  const snapshots = [];
  const identities = [];
  const scripts = [];
  const factoryResults = [];
  const events = [];
  let instant = new Date("2026-11-01T02:59:59.999Z");
  let closedPages = 0;
  let published = 0;
  const collected = () => {
    const cube = () => ({
      coverage: { state: "complete", sourceRows: 1 },
      nativeTotals: { vgv: "100.25", contracts: 1 },
      rows: [{ key: "1", name: "Synthetic entity", vgv: "100.25", contracts: 1 }],
    });
    return {
      status: "collected",
      source: {
        appId: syntheticMapping().appId,
        sheetId: syntheticMapping().sheetId,
        mappingSha256: snapshots.at(-1).mappingSha256,
        reloadTimestamp: "2026-10-14T17:00:00.000Z",
      },
      scope: { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" },
      months: [{ periodMonth: "2026-09-01", imobs: cube(), developments: cube() }],
    };
  };
  const context = {
    newPage: async () => ({
      goto: async () => {},
      url: () => "https://direcional.us.qlikcloud.com/insights/home",
      addScriptTag: async ({ content }) => {
        assert.ok(content.includes("__descomplicaQlikRankingV1"));
        scripts.push(content);
      },
      evaluate: async () => collected(),
      close: async () => {
        closedPages++;
      },
    }),
  };
  await startRankingCollection({
    signal,
    authenticate: async () => {
      events.push("login");
      return { status: "authenticated" };
    },
    mappingFactory: () => {
      events.push("mapping");
      const value = structuredClone(
        createRankingMapping({
          now: () => instant,
          definition: syntheticDefinition(),
        }),
      );
      factoryResults.push(value);
      return value;
    },
    credential: () => {
      events.push("credential");
      return "a".repeat(43);
    },
    collect: async (options) => {
      snapshots.push(options.mapping);
      identities.push(options.identity);
      assert.ok(Object.isFrozen(options.mapping.periods));
      assert.throws(() => options.mapping.periods.push("2099-01-01"), TypeError);
      if (snapshots.length === 1) {
        instant = new Date("2026-11-01T03:00:00.000Z");
        factoryResults[0].periods.push("2099-01-01");
      }
      return collectBrowserRanking(context, options);
    },
    cycle: (options) =>
      runRankingCycle({
        ...options,
        now: () => new Date("2026-11-14T18:00:00.000Z"),
        publish: async (payload) => ({
          state: ++published % 2 ? "staged" : "published",
          requestId: payload.requestId,
          contentSha256: "c".repeat(64),
        }),
      }),
    loop: async ({ collect }) => {
      for (let count = 0; count < 2; count++)
        assert.equal((await collect({ signal })).state, "succeeded");
    },
  });
  assert.deepEqual(events, ["login", "mapping", "credential", "login", "mapping", "credential"]);
  assert.equal(factoryResults.length, 2);
  assert.equal(snapshots.length, 4);
  assert.equal(snapshots[0], snapshots[1]);
  assert.equal(snapshots[2], snapshots[3]);
  assert.notEqual(snapshots[0], snapshots[2]);
  assert.notEqual(snapshots[0], factoryResults[0]);
  assert.equal(snapshots[0].periods.length, 10);
  assert.equal(snapshots[2].periods.length, 11);
  assert.equal(new Set(identities).size, 4);
  assert.equal(closedPages, 4);
  assert.equal(published, 4);
  for (const script of scripts) assert.equal(script.includes("2099-01-01"), false);
  assert.equal(scripts[0].includes("2026-11-01"), false);
  assert.equal(scripts[1].includes("2026-11-01"), false);
  assert.equal(scripts[2].includes("2026-11-01"), true);
  assert.equal(scripts[3].includes("2026-11-01"), true);
});

test("metadata collection requires verified login and shares the owner cancellation signal", async () => {
  const signal = new AbortController().signal;
  const browser = {};
  const calls = [];
  const store = { canAttempt: async () => true, claimAttempt: async () => true };
  const result = await collectAuthenticatedMetadata(
    browser,
    { signal },
    {
      attempts: () => store,
      renew: async (context, options) => {
        assert.equal(context, browser);
        assert.equal(options.signal, signal);
        assert.equal(options.canAttempt, store.canAttempt);
        calls.push("login");
        return { status: "authenticated" };
      },
      collect: async (context, options) => {
        assert.equal(context, browser);
        assert.equal(options.signal, signal);
        calls.push("metadata");
        return { status: "inspected", metadata: "synthetic" };
      },
    },
  );
  assert.deepEqual(calls, ["login", "metadata"]);
  assert.equal(result.status, "inspected");
});

test("MFA, invalid login and cancellation never start the Engine collector", async () => {
  for (const status of ["reauth_required", "unavailable", "unknown", "throw", "cancel"]) {
    const abort = new AbortController();
    const result = await collectAuthenticatedMetadata(
      {},
      { signal: abort.signal },
      {
        attempts: () => ({}),
        renew: async () => {
          if (status === "throw") throw new Error("private authentication detail");
          if (status === "cancel") abort.abort();
          return { status };
        },
        collect: async () => assert.fail("Engine must not start"),
      },
    );
    assert.equal(result.status, status === "reauth_required" ? "reauth_required" : "unavailable");
    assert.doesNotMatch(JSON.stringify(result), /private/);
  }
});

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

test("authenticated collection preserves an existing MFA page until its guarded login flow runs", async () => {
  const f = fixture(async () => assert.fail("Do not replace a pending MFA page"));
  let started = false;
  const session = holdBrowserSession(f.browser, {
    signalSource: f.signals,
    navigate: false,
    startCollection: async () => {
      started = true;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, true);
  assert.deepEqual(f.messages, []);
  await f.browser.close();
  await session;
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
    const { getBrowserRankingScript } = await import(new URL("./browser-ranking.mjs", launcher).href);
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
    let authenticated = false;
    replace("./login-attempt.mjs", { loginAttemptStore: () => ({}) });
    replace("./browser-login.mjs", { renewBrowserLogin: async () => {
      authenticated = true;
      return { status: "authenticated" };
    }});
    let mappings = 0;
    replace("./ranking-mapping.mjs", { createRankingMapping: (...args) => {
      assert.equal(authenticated, true);
      assert.equal(args.length, 0);
      mappings++;
      return ${JSON.stringify(syntheticMapping())};
    }});
    replace("./ranking-cycle.mjs", { runRankingCycle: async ({ collect, signal }) => collect({ signal }) });
    replace("./browser-ranking.mjs", { getBrowserRankingScript, collectBrowserRanking: async (context, options) => {
      assert.equal(authenticated, true);
      assert.equal(mappings, 1);
      assert.equal(options.mapping.periods.length, 10);
      assert.equal(Object.isFrozen(options.mapping), true);
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

test("status does not retain success when the private receipt cannot be written", async () => {
  const signal = new AbortController().signal;
  const states = [];
  await startRankingCollection({
    signal,
    collect: async () => assert.fail("source must not run"),
    write: async () => {
      throw new Error("private receipt unavailable");
    },
    monitor: { update: (result) => states.push(result) },
    loop: async ({ onStatus }) => {
      await assert.rejects(onStatus({ state: "running" }), /private receipt unavailable/);
    },
  });
  assert.deepEqual(states, [{ state: "unavailable" }]);
});
