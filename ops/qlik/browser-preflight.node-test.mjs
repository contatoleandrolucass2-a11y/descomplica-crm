import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  createBrowserMetadataClient,
  collectBrowserMetadata,
  getBrowserMetadataScript,
} from "./browser-preflight.mjs";

function fixture({ status = 204, csrf = "synthetic-csrf-token-for-tests", origin } = {}) {
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  const socket = { close: () => calls.push("socket_closed") };
  const environment = {
    location: { origin: origin ?? "https://direcional.us.qlikcloud.com" },
    AbortController,
    URL,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        status,
        ok: status >= 200 && status < 300,
        headers: new Headers({ "qlik-csrf-token": csrf }),
      };
    },
    WebSocket: class {
      constructor(url) {
        calls.push({ websocket: url });
        return socket;
      }
    },
    setTimeout: (fn) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const enigma = {
    create: (options) => {
      calls.push("session_created");
      options.createSocket(options.url);
      return {
        open: async () => ({ fakeGlobal: true }),
        close: async () => calls.push("session_closed"),
      };
    },
  };
  const inspect = async (global) => {
    assert.equal(global.fakeGlobal, true);
    calls.push("metadata_only");
    return { status: "inspected", dataRead: false };
  };
  return { calls, timers, environment, enigma, inspect };
}

test("official session transport stays on the fixed origin and returns no authentication material", async () => {
  const f = fixture();
  const result = await createBrowserMetadataClient(f.enigma, {}, f.inspect, f.environment).run();
  assert.deepEqual(result, { status: "inspected", dataRead: false });
  assert.equal(f.calls[0].url, "https://direcional.us.qlikcloud.com/api/v1/csrf-token");
  assert.equal(f.calls[0].options.redirect, "error");
  assert.equal(f.calls[0].options.credentials, "same-origin");
  const socketUrl = new URL(f.calls.find((entry) => entry.websocket)?.websocket);
  assert.equal(socketUrl.origin, "wss://direcional.us.qlikcloud.com");
  assert.equal(
    socketUrl.pathname,
    "/app/7c000871-8b32-4c0f-bfd5-4b9d46946575/identity/descomplica-ranking-metadata-v1",
  );
  assert.equal(socketUrl.searchParams.get("qlik-csrf-token"), "synthetic-csrf-token-for-tests");
  assert.doesNotMatch(JSON.stringify(result), /synthetic-csrf|cookie|token/i);
  assert.ok(f.calls.includes("socket_closed"));
  assert.ok(f.calls.includes("session_closed"));
  assert.equal(f.timers.size, 0);
});

test("expired, denied, unavailable and malformed CSRF responses never open an engine", async () => {
  for (const [input, expected] of [
    [{ status: 401 }, { status: "reauth_required" }],
    [{ status: 403 }, { status: "unavailable", reason: "access_denied" }],
    [{ status: 500 }, { status: "unavailable", reason: "source_unavailable" }],
    [{ csrf: "" }, { status: "unavailable", reason: "csrf_unavailable" }],
    [
      { origin: "https://idp.example.invalid" },
      { status: "unavailable", reason: "unexpected_origin" },
    ],
  ]) {
    const f = fixture(input);
    assert.deepEqual(
      await createBrowserMetadataClient(f.enigma, {}, f.inspect, f.environment).run(),
      expected,
    );
    assert.ok(!f.calls.includes("session_created"));
    assert.equal(f.timers.size, 0);
  }
});

test("cancellation interrupts a stalled call and a late fetch cannot start an engine", async () => {
  const f = fixture();
  const pending = Promise.withResolvers();
  f.environment.fetch = () => pending.promise;
  const client = createBrowserMetadataClient(f.enigma, {}, f.inspect, f.environment);
  const work = client.run();
  assert.deepEqual(await client.run(), { status: "unavailable", reason: "already_running" });
  client.cancel();
  assert.deepEqual(await work, { status: "unavailable", reason: "cancelled" });
  pending.resolve({
    status: 204,
    ok: true,
    headers: new Headers({ "qlik-csrf-token": "synthetic-late-token" }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(!f.calls.includes("session_created"));
  assert.equal(f.timers.size, 0);
});

test("native errors and deadline results are sanitized", async () => {
  const f = fixture();
  f.inspect = async () => {
    throw new Error("private token and upstream payload");
  };
  assert.deepEqual(
    await createBrowserMetadataClient(f.enigma, {}, f.inspect, f.environment).run(),
    {
      status: "unavailable",
      reason: "engine_unavailable",
    },
  );
  const stalled = fixture();
  stalled.environment.fetch = () => new Promise(() => {});
  const work = createBrowserMetadataClient(
    stalled.enigma,
    {},
    stalled.inspect,
    stalled.environment,
  ).run();
  for (const fn of stalled.timers.values()) fn();
  assert.deepEqual(await work, { status: "unavailable", reason: "cancelled" });
});

test("fixed script uses the pinned SDK without changing the page's enigma or importing remote code", async () => {
  const f = fixture();
  const window = { enigma: "existing-page-library" };
  const context = { window, location: f.environment.location, ...f.environment };
  const script = await getBrowserMetadataScript();
  runInNewContext(script, context);
  assert.equal(window.enigma, "existing-page-library");
  assert.equal(typeof window.__descomplicaQlikMetadataV1.run, "function");
  assert.equal(
    Object.getOwnPropertyDescriptor(window, "__descomplicaQlikMetadataV1").writable,
    false,
  );
  assert.throws(() => runInNewContext(script, context), /qlik_preflight_context_rejected/);
  assert.doesNotMatch(script, /unpkg\.com|cdn\.jsdelivr|storageState|document\.cookie/);
});

test("owner opens and closes only its temporary page; no cookies, CDP or CSP bypass", async () => {
  const calls = [];
  const page = {
    goto: async (url) => calls.push(url),
    url: () => "https://direcional.us.qlikcloud.com/insights/home",
    addScriptTag: async ({ content }) => {
      assert.ok(content.includes("__descomplicaQlikMetadataV1"));
    },
    evaluate: async () => ({ status: "inspected", dataRead: false }),
    close: async () => calls.push("page_closed"),
  };
  const browser = { newPage: async () => page };
  assert.deepEqual(await collectBrowserMetadata(browser), { status: "inspected", dataRead: false });
  assert.deepEqual(calls, ["https://direcional.us.qlikcloud.com/insights/home", "page_closed"]);
  page.addScriptTag = async () => {
    throw new Error("CSP blocked private details");
  };
  assert.deepEqual(await collectBrowserMetadata(browser), {
    status: "unavailable",
    reason: "browser_preflight_unavailable",
  });
  page.url = () => "https://identity.example.invalid/login";
  assert.deepEqual(await collectBrowserMetadata(browser), { status: "reauth_required" });
});
