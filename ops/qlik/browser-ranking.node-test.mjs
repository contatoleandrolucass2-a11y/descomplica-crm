import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  createBrowserRankingClient,
  collectBrowserRanking,
  getBrowserRankingScript,
} from "./browser-ranking.mjs";

const ORIGIN = "https://direcional.us.qlikcloud.com";
const APP = "7c000871-8b32-4c0f-bfd5-4b9d46946575";
const SHEET = "46d5bcf7-965d-40fc-a808-2fdde2d0f74d";
const mapping = () => ({
  appId: APP,
  sheetId: SHEET,
  revision: "synthetic-only",
  nested: { b: 2, a: 1 },
});
const pause = () => new Promise((resolve) => setImmediate(resolve));
function timerFixture() {
  const pending = new Map();
  let id = 0;
  return {
    pending,
    setTimeout(fn, ms) {
      assert.ok([180_000, 5_000].includes(ms));
      pending.set(++id, { fn, ms });
      return id;
    },
    clearTimeout(key) {
      pending.delete(key);
    },
    expire(ms = 180_000) {
      for (const [key, timer] of [...pending.entries()]) {
        if (timer.ms !== ms) continue;
        pending.delete(key);
        timer.fn();
      }
    },
  };
}
// Deliberately standalone: this exact function can be serialized into the page.
async function syntheticCollector() {
  return { status: "unavailable" };
}
function transport({ status = 204, csrf = "synthetic-csrf-only", origin = ORIGIN } = {}) {
  const calls = [];
  const timers = timerFixture();
  const environment = {
    location: { origin },
    AbortController,
    URL,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    fetch: async (url, options) => {
      calls.push({ fetch: url, options });
      return {
        status,
        ok: status >= 200 && status < 300,
        headers: new Headers({ "qlik-csrf-token": csrf }),
      };
    },
    WebSocket: class {
      constructor(url) {
        calls.push({ websocket: url });
      }
      close() {
        calls.push("socket_closed");
      }
    },
  };
  const enigma = {
    create(options) {
      calls.push({ session: options });
      options.createSocket(options.url);
      return {
        open: async () => ({ synthetic: true }),
        close: async () => {
          calls.push("session_closed");
        },
      };
    },
  };
  return { calls, timers, environment, enigma };
}
function owner() {
  const calls = [];
  const timers = timerFixture();
  const controller = new AbortController();
  const page = {
    goto: async (url, options) => {
      calls.push({ goto: url, options });
    },
    url: () => `${ORIGIN}/insights/home`,
    addScriptTag: async ({ content }) => {
      assert.ok(content.includes("__descomplicaQlikRankingV1"));
      calls.push("script");
    },
    evaluate: async (_fn, identity) => {
      calls.push({ identity });
      return { status: "unavailable", reason: "collection_unavailable" };
    },
    close: async () => {
      calls.push("closed");
    },
  };
  const context = {
    newPage: async () => {
      calls.push("page");
      return page;
    },
  };
  const options = {
    signal: controller.signal,
    identity: randomUUID(),
    mapping: mapping(),
    collect: syntheticCollector,
    timers,
  };
  return { context, page, options, calls, controller, timers };
}

test("different collection UUIDs create isolated QIX URLs with no resume or token export", async () => {
  const f = transport();
  const identities = [randomUUID(), randomUUID()];
  const result = {
    status: "collected",
    source: { appId: APP },
    scope: {},
    months: [],
    token: "must-not-cross",
  };
  for (const identity of identities) {
    const collect = async (global, options) => {
      assert.equal(global.synthetic, true);
      assert.ok(options.signal instanceof AbortSignal);
      assert.ok(Object.isFrozen(options.mapping));
      assert.ok(Object.isFrozen(options.mapping.nested));
      assert.deepEqual(options.mapping, mapping());
      assert.deepEqual(Object.keys(options).sort(), ["mapping", "signal"]);
      return result;
    };
    const client = createBrowserRankingClient(f.enigma, {}, collect, mapping(), f.environment);
    assert.deepEqual(await client.run(identity), {
      status: "collected",
      source: result.source,
      scope: {},
      months: [],
    });
  }
  assert.deepEqual(
    f.calls.filter((c) => c.websocket).map((c) => new URL(c.websocket).pathname),
    identities.map((id) => `/app/${APP}/identity/${id}`),
  );
  for (const { session } of f.calls.filter((c) => c.session))
    assert.equal(session.suspendOnClose, false);
  const request = f.calls.find((c) => c.fetch);
  assert.equal(request.fetch, `${ORIGIN}/api/v1/csrf-token`);
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.cache, "no-store");
  assert.equal(f.calls.filter((c) => c === "session_closed").length, 2);
  assert.equal(f.timers.pending.size, 0);
});

for (const [input, expected] of [
  [{ status: 401 }, { status: "reauth_required" }],
  [{ status: 403 }, { status: "unavailable", reason: "access_denied" }],
  [{ status: 500 }, { status: "unavailable", reason: "source_unavailable" }],
  [{ csrf: "" }, { status: "unavailable", reason: "csrf_unavailable" }],
  [{ origin: "https://unrelated.invalid" }, { status: "unavailable", reason: "unexpected_origin" }],
]) {
  test(`transport refuses ${JSON.stringify(input)} before opening QIX`, async () => {
    const f = transport(input);
    const client = createBrowserRankingClient(
      f.enigma,
      {},
      syntheticCollector,
      mapping(),
      f.environment,
    );
    assert.deepEqual(await client.run(randomUUID()), expected);
    assert.ok(!f.calls.some((c) => c.session));
    assert.equal(f.timers.pending.size, 0);
  });
}

test("transport rejects invalid identities and mappings before network activity", async () => {
  for (const [identity, source] of [
    ["../invalid", mapping()],
    [randomUUID(), { ...mapping(), appId: "other" }],
  ]) {
    const f = transport();
    assert.equal(
      (
        await createBrowserRankingClient(
          f.enigma,
          {},
          syntheticCollector,
          source,
          f.environment,
        ).run(identity)
      ).reason,
      "ranking_configuration",
    );
    assert.equal(f.calls.length, 0);
  }
});

test("cancellation of a stalled CSRF fetch cannot start a late session or reuse the client", async () => {
  const f = transport();
  const fetch = Promise.withResolvers();
  f.environment.fetch = () => fetch.promise;
  const client = createBrowserRankingClient(
    f.enigma,
    {},
    syntheticCollector,
    mapping(),
    f.environment,
  );
  const work = client.run(randomUUID());
  assert.equal((await client.run(randomUUID())).reason, "session_already_used");
  client.cancel();
  assert.equal((await work).reason, "cancelled");
  fetch.resolve({
    status: 204,
    ok: true,
    headers: new Headers({ "qlik-csrf-token": "synthetic-late-token" }),
  });
  await pause();
  assert.ok(!f.calls.some((c) => c.session));
  assert.equal((await client.run(randomUUID())).reason, "session_already_used");
  assert.equal(f.timers.pending.size, 0);
});

test("180 second transport deadline aborts a pending collector, closes socket and ignores late success", async () => {
  const f = transport();
  const pending = Promise.withResolvers();
  let signal;
  const client = createBrowserRankingClient(
    f.enigma,
    {},
    async (_global, options) => {
      signal = options.signal;
      return pending.promise;
    },
    mapping(),
    f.environment,
  );
  const work = client.run(randomUUID());
  await pause();
  f.timers.expire();
  assert.deepEqual(await work, { status: "unavailable", reason: "transport_timeout" });
  assert.equal(signal.aborted, true);
  assert.ok(f.calls.includes("socket_closed"));
  assert.ok(f.calls.includes("session_closed"));
  pending.resolve({ status: "collected", secret: "late" });
  await pause();
  assert.equal((await client.run(randomUUID())).reason, "session_already_used");
});

test("late session.open after cancellation never calls the collector", async () => {
  const f = transport();
  const pending = Promise.withResolvers();
  f.enigma.create = () => ({ open: () => pending.promise, close: async () => {} });
  let collected = false;
  const client = createBrowserRankingClient(
    f.enigma,
    {},
    async () => {
      collected = true;
    },
    mapping(),
    f.environment,
  );
  const work = client.run(randomUUID());
  await pause();
  client.cancel();
  assert.equal((await work).reason, "cancelled");
  pending.resolve({});
  await pause();
  assert.equal(collected, false);
});

test("unknown status, collector errors and reauth details never cross the transport boundary", async () => {
  for (const status of [
    "pending",
    "inspected",
    "succeeded",
    "published",
    undefined,
    "reauth_required",
  ]) {
    const f = transport();
    const result = await createBrowserRankingClient(
      f.enigma,
      {},
      async () => ({ status, secret: "private" }),
      mapping(),
      f.environment,
    ).run(randomUUID());
    assert.deepEqual(
      result,
      status === "reauth_required"
        ? { status }
        : { status: "unavailable", reason: "collection_unavailable" },
    );
  }
  const f = transport();
  const result = await createBrowserRankingClient(
    f.enigma,
    {},
    async () => {
      throw new Error("private upstream details");
    },
    mapping(),
    f.environment,
  ).run(randomUUID());
  assert.deepEqual(result, { status: "unavailable", reason: "engine_unavailable" });
});

test("script serializes a standalone collector and canonical mapping without replacing page SDK", async () => {
  const f = transport();
  const window = { enigma: "existing" };
  const context = { ...f.environment, window };
  const a = await getBrowserRankingScript({ mapping: mapping(), collect: syntheticCollector });
  const b = await getBrowserRankingScript({
    mapping: { nested: { a: 1, b: 2 }, revision: "synthetic-only", sheetId: SHEET, appId: APP },
    collect: syntheticCollector,
  });
  assert.equal(a, b);
  runInNewContext(a, context);
  assert.equal(window.enigma, "existing");
  assert.equal(typeof window.__descomplicaQlikRankingV1.run, "function");
  assert.equal(
    Object.getOwnPropertyDescriptor(window, "__descomplicaQlikRankingV1").writable,
    false,
  );
  assert.throws(() => runInNewContext(a, context), /qlik_ranking_context_rejected/);
  assert.doesNotMatch(a, /document\.cookie|storageState|connectOverCDP|bypassCSP|unpkg\.com/);
});

test("serialized client and collector execute without Node closures", async () => {
  const f = transport();
  const client = runInNewContext(
    `(${createBrowserRankingClient.toString()})(enigma, {},
      async function collect(global, { signal, mapping }) {
        if (!global.synthetic || signal.aborted || !Object.isFrozen(mapping.nested))
          throw new Error("invalid standalone context");
        return { status: "reauth_required", privateDetail: "discarded" };
      }, mapping, environment)`,
    { enigma: f.enigma, mapping: mapping(), environment: f.environment },
  );
  assert.equal(JSON.stringify(await client.run(randomUUID())), '{"status":"reauth_required"}');
  assert.ok(f.calls.includes("session_closed"));
});

test("mapping rejects wrong scope, accessors, functions, cycles and excessive bytes", async () => {
  const cyclic = mapping();
  cyclic.self = cyclic;
  const accessor = mapping();
  Object.defineProperty(accessor, "extra", {
    enumerable: true,
    get() {
      throw new Error("getter invoked");
    },
  });
  for (const value of [
    null,
    { ...mapping(), sheetId: "other" },
    { ...mapping(), fn() {} },
    cyclic,
    accessor,
    { ...mapping(), big: "x".repeat(65_536) },
  ]) {
    await assert.rejects(
      getBrowserRankingScript({ mapping: value, collect: syntheticCollector }),
      /ranking_mapping_/,
    );
  }
});

test("owner passes the identity, respects CSP and awaits page closure", async () => {
  const f = owner();
  assert.equal((await collectBrowserRanking(f.context, f.options)).status, "unavailable");
  assert.deepEqual(
    f.calls.find((c) => c.goto),
    {
      goto: `${ORIGIN}/insights/home`,
      options: { waitUntil: "domcontentloaded", timeout: 30_000 },
    },
  );
  assert.equal(f.calls.find((c) => c.identity).identity, f.options.identity);
  assert.equal(f.calls.at(-1), "closed");
  assert.equal(f.timers.pending.size, 0);
  assert.equal((await collectBrowserRanking(f.context, f.options)).reason, "identity_reused");
});

for (const stage of ["newPage", "goto", "addScriptTag", "evaluate"]) {
  test(`owner sanitizes ${stage} failure and closes any acquired page`, async () => {
    const f = owner();
    (stage === "newPage" ? f.context : f.page)[stage] = async () => {
      throw new Error("private token source detail");
    };
    assert.deepEqual(await collectBrowserRanking(f.context, f.options), {
      status: "unavailable",
      reason: "browser_ranking_unavailable",
    });
    assert.equal(f.calls.includes("closed"), stage !== "newPage");
  });
}

test("owner treats login redirect as reauth without injecting or reading credentials", async () => {
  const f = owner();
  f.page.url = () => "https://identity.invalid/login";
  assert.deepEqual(await collectBrowserRanking(f.context, f.options), {
    status: "reauth_required",
  });
  assert.ok(!f.calls.includes("script"));
  assert.equal(f.calls.at(-1), "closed");
});

test("owner blocks overlap until page disposal resolves", async () => {
  const f = owner();
  const closing = Promise.withResolvers();
  f.page.close = () => closing.promise;
  const work = collectBrowserRanking(f.context, f.options);
  await pause();
  const next = { ...f.options, identity: randomUUID() };
  assert.equal((await collectBrowserRanking(f.context, next)).reason, "already_running");
  closing.resolve();
  await work;
  assert.notEqual((await collectBrowserRanking(f.context, next)).reason, "already_running");
});

test("owner cancellation closes a pending evaluation and never returns late collected facts", async () => {
  const f = owner();
  const evaluated = Promise.withResolvers();
  const entered = Promise.withResolvers();
  f.page.evaluate = () => {
    entered.resolve();
    return evaluated.promise;
  };
  f.page.close = async () => {
    f.calls.push("closed");
    evaluated.resolve({ status: "collected" });
  };
  const work = collectBrowserRanking(f.context, f.options);
  await entered.promise;
  f.controller.abort();
  assert.equal((await work).reason, "cancelled");
  assert.equal(f.calls.filter((c) => c === "closed").length, 1);
});

test("host watchdog closes a stalled page at 180 seconds", async () => {
  const f = owner();
  const evaluated = Promise.withResolvers();
  const entered = Promise.withResolvers();
  f.page.evaluate = () => {
    entered.resolve();
    return evaluated.promise;
  };
  f.page.close = async () => {
    evaluated.reject(new Error("page disposed"));
  };
  const work = collectBrowserRanking(f.context, f.options);
  await entered.promise;
  f.timers.expire();
  assert.equal((await work).reason, "transport_timeout");
  assert.equal(f.timers.pending.size, 0);
});

test("late page creation after abort is owned and closed before completion", async () => {
  const f = owner();
  const creation = Promise.withResolvers();
  const entered = Promise.withResolvers();
  f.context.newPage = () => {
    entered.resolve();
    return creation.promise;
  };
  const work = collectBrowserRanking(f.context, f.options);
  await entered.promise;
  f.controller.abort();
  creation.resolve(f.page);
  assert.equal((await work).reason, "cancelled");
  assert.deepEqual(f.calls, ["closed"]);
});

test("page close failure fails closed and keeps the context blocked", async () => {
  const f = owner();
  f.page.close = async () => {
    throw new Error("private browser detail");
  };
  assert.equal(
    (await collectBrowserRanking(f.context, f.options)).reason,
    "page_disposal_unconfirmed",
  );
  assert.equal(
    (await collectBrowserRanking(f.context, { ...f.options, identity: randomUUID() })).reason,
    "already_running",
  );
});

for (const stage of ["newPage", "goto", "addScriptTag", "evaluate"]) {
  for (const interruption of ["abort", "timeout"]) {
    test(`${stage} is bounded on ${interruption}; uncertain disposal never releases the context`, async () => {
      const f = owner();
      const entered = Promise.withResolvers();
      const pending = Promise.withResolvers();
      const target = stage === "newPage" ? f.context : f.page;
      const original = target[stage];
      target[stage] = () => {
        entered.resolve();
        return pending.promise;
      };
      const notices = [];
      f.options.onOwnerUnrecoverable = (reason) => notices.push(reason);
      const work = collectBrowserRanking(f.context, f.options);
      await entered.promise;
      if (interruption === "abort") f.controller.abort();
      else f.timers.expire();
      if (stage === "newPage") {
        await pause();
        const next = { ...f.options, signal: new AbortController().signal, identity: randomUUID() };
        assert.equal((await collectBrowserRanking(f.context, next)).reason, "already_running");
        f.timers.expire(5_000);
      }
      assert.equal(
        (await work).reason,
        stage === "newPage"
          ? "page_disposal_unconfirmed"
          : interruption === "abort"
            ? "cancelled"
            : "transport_timeout",
      );
      assert.deepEqual(notices, stage === "newPage" ? ["page_disposal_unconfirmed"] : []);
      assert.equal(f.timers.pending.size, 0);
      pending.resolve(
        stage === "newPage" ? f.page : { status: "collected", privateDetail: "late" },
      );
      await pause();
      assert.equal(f.calls.filter((call) => call === "closed").length, 1);
      target[stage] = original;
      const next = { ...f.options, signal: new AbortController().signal, identity: randomUUID() };
      const nextResult = await collectBrowserRanking(f.context, next);
      assert.equal(nextResult.reason === "already_running", stage === "newPage");
      assert.deepEqual(notices, stage === "newPage" ? ["page_disposal_unconfirmed"] : []);
    });
  }
}

for (const abort of [false, true]) {
  test(`stalled close has a five second bound and quarantines even after late disposal (abort=${abort})`, async () => {
    const f = owner();
    const entered = Promise.withResolvers();
    const pending = Promise.withResolvers();
    const notices = [];
    f.page.evaluate = async () => ({ status: "collected" });
    f.page.close = () => {
      entered.resolve();
      return pending.promise;
    };
    f.options.onOwnerUnrecoverable = (reason) => notices.push(reason);
    const work = collectBrowserRanking(f.context, f.options);
    await entered.promise;
    if (abort) f.controller.abort();
    f.timers.expire(5_000);
    assert.deepEqual(await work, { status: "unavailable", reason: "page_disposal_unconfirmed" });
    assert.deepEqual(notices, ["page_disposal_unconfirmed"]);
    assert.equal(f.timers.pending.size, 0);
    pending.resolve();
    await pause();
    assert.equal(
      (
        await collectBrowserRanking(f.context, {
          ...f.options,
          signal: new AbortController().signal,
          identity: randomUUID(),
        })
      ).reason,
      "already_running",
    );
    assert.deepEqual(notices, ["page_disposal_unconfirmed"]);
  });
}

test("abort before page acquisition cannot start a late page", async () => {
  const f = owner();
  const work = collectBrowserRanking(f.context, f.options);
  f.controller.abort();
  assert.equal((await work).reason, "cancelled");
  await pause();
  assert.deepEqual(f.calls, []);
  assert.equal(f.timers.pending.size, 0);
});

test("owner callback failure cannot expose errors or release an uncertain context", async () => {
  for (const onOwnerUnrecoverable of [
    () => {
      throw new Error("private owner detail");
    },
    async () => {
      throw new Error("private owner detail");
    },
  ]) {
    const f = owner();
    f.page.close = async () => {
      throw new Error("private browser detail");
    };
    f.options.onOwnerUnrecoverable = onOwnerUnrecoverable;
    assert.deepEqual(await collectBrowserRanking(f.context, f.options), {
      status: "unavailable",
      reason: "page_disposal_unconfirmed",
    });
    await pause();
    assert.equal(
      (await collectBrowserRanking(f.context, { ...f.options, identity: randomUUID() })).reason,
      "already_running",
    );
  }
});

test("pre-abort and invalid inputs create no pages", async () => {
  const f = owner();
  for (const options of [
    { ...f.options, identity: "invalid" },
    { ...f.options, signal: undefined },
    { ...f.options, onOwnerUnrecoverable: true },
  ]) {
    assert.equal((await collectBrowserRanking(f.context, options)).reason, "ranking_configuration");
  }
  f.controller.abort();
  assert.equal((await collectBrowserRanking(f.context, f.options)).reason, "cancelled");
  assert.deepEqual(f.calls, []);
});
