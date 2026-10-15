import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import test from "node:test";
import enigma from "enigma.js";
import schema from "enigma.js/schemas/12.612.0.json" with { type: "json" };
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

function sdkFixture({ reply, openError } = {}) {
  const f = fixture();
  f.environment.WebSocket = class {
    constructor() {
      f.calls.push("socket_created");
      queueMicrotask(() => {
        if (openError) this.onerror?.(openError);
        else this.onopen?.();
      });
    }
    send(raw) {
      const request = JSON.parse(raw);
      f.calls.push(request.method);
      assert.equal(typeof reply, "function", "The mock inspector must issue no QIX requests");
      const response = reply(request);
      queueMicrotask(() =>
        this.onmessage?.({
          data: JSON.stringify({ jsonrpc: "2.0", id: request.id, ...response }),
        }),
      );
    }
    close() {
      f.calls.push("socket_closed");
      this.onclose?.({ code: 1000 });
    }
  };
  return f;
}

async function serializedFailure(error, { openError } = {}) {
  const f = sdkFixture({ openError });
  const create = runInNewContext(`(${createBrowserMetadataClient.toString()})`);
  let inspected = false;
  const result = await create(
    enigma,
    schema,
    async (global, { signal }) => {
      assert.equal(typeof global.openDoc, "function");
      assert.equal(signal.aborted, false);
      inspected = true;
      throw error;
    },
    f.environment,
  ).run();
  assert.equal(inspected, !openError);
  assert.ok(f.calls.includes("socket_created"));
  assert.ok(f.calls.includes("socket_closed"));
  assert.equal(f.timers.size, 0);
  return JSON.parse(JSON.stringify(result));
}

for (const code of [
  "qix_invalid_metadata",
  "qix_metadata_limit",
  "qix_invalid_sdk",
  "qix_request_failed",
  "qix_scope_mismatch",
  "qix_metadata_cycle",
  "qix_duplicate_object",
  "qix_invalid_reload_time",
  "qix_aborted",
  "qix_metadata_failed",
  "qix_cleanup_failed",
]) {
  test(`serialized client with real SDK preserves only the fixed metadata code ${code}`, async () => {
    const error = Object.assign(new Error("synthetic-private-sdk-message"), {
      code,
      data: { source: "synthetic-private-payload" },
      token: "synthetic-private-token",
      error: "synthetic-private-error",
      cause: new Error("synthetic-private-cause"),
    });
    assert.deepEqual(await serializedFailure(error), { status: "unavailable", reason: code });
  });
}

test("serialized client discards unknown codes, error messages, causes and invalid code types", async () => {
  for (const code of [
    "synthetic-private-token",
    "qix_invalid_metadata:synthetic-private-payload",
    "QIX_INVALID_METADATA",
    "qix_invalid_options",
    "",
    undefined,
    null,
    123,
    ["qix_invalid_metadata"],
    { code: "qix_invalid_metadata" },
  ]) {
    assert.deepEqual(
      await serializedFailure(
        Object.assign(new Error("qix_invalid_metadata"), {
          code,
          reason: "qix_invalid_metadata",
          cause: { code: "qix_invalid_metadata", token: "synthetic-private-token" },
        }),
      ),
      { status: "unavailable", reason: "engine_unavailable" },
    );
  }
  for (const error of [
    "qix_invalid_metadata",
    null,
    Object.create({ code: "qix_invalid_metadata" }),
  ])
    assert.deepEqual(await serializedFailure(error), {
      status: "unavailable",
      reason: "engine_unavailable",
    });
  assert.deepEqual(
    await serializedFailure(undefined, {
      openError: Object.assign(new Error("qix_invalid_metadata"), {
        code: "synthetic-private-sdk-code",
        data: "synthetic-private-sdk-data",
      }),
    }),
    { status: "unavailable", reason: "engine_unavailable" },
  );
});

test("error projection reads only one own data code without invoking private accessors", async () => {
  let getters = 0;
  const error = { code: "qix_scope_mismatch" };
  for (const key of ["message", "stack", "data", "token", "error", "cause"])
    Object.defineProperty(error, key, {
      get() {
        getters++;
        throw new Error("synthetic-private-accessor");
      },
    });
  let reads = 0;
  const oneRead = new Proxy(error, {
    getOwnPropertyDescriptor(target, key) {
      assert.equal(key, "code");
      reads++;
      return Object.getOwnPropertyDescriptor(target, key);
    },
  });
  assert.deepEqual(await serializedFailure(oneRead), {
    status: "unavailable",
    reason: "qix_scope_mismatch",
  });
  assert.equal(reads, 1);
  const accessorCode = Object.defineProperty({}, "code", {
    get() {
      getters++;
      return "qix_scope_mismatch";
    },
  });
  assert.deepEqual(await serializedFailure(accessorCode), {
    status: "unavailable",
    reason: "engine_unavailable",
  });
  assert.equal(getters, 0);
  assert.deepEqual(
    await serializedFailure(
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new Error("synthetic-private-descriptor-failure");
          },
        },
      ),
    ),
    { status: "unavailable", reason: "engine_unavailable" },
  );
});

test("generated script and bundled SDK preserve real inspector failures without engine details", async () => {
  const script = await getBrowserMetadataScript();
  assert.ok(script.includes(createBrowserMetadataClient.toString()));
  for (const [fault, reason] of [
    ["request", "qix_request_failed"],
    ["scope", "qix_scope_mismatch"],
    ["metadata", "qix_invalid_metadata"],
  ]) {
    const f = sdkFixture({
      reply(request) {
        if (request.method === "OpenDoc") {
          if (fault === "request")
            return {
              error: {
                code: 1002,
                message: "synthetic-private-sdk-message",
                data: { token: "synthetic-private-token" },
              },
            };
          return { result: { qReturn: { qType: "Doc", qHandle: 1 } } };
        }
        if (request.method === "GetObject")
          return { result: { qReturn: { qType: "GenericObject", qHandle: 2 } } };
        assert.equal(request.method, "GetFullPropertyTree");
        return {
          result: {
            qPropEntry:
              fault === "metadata"
                ? {}
                : { qProperty: { qInfo: { qId: "synthetic-wrong-sheet", qType: "sheet" } } },
          },
        };
      },
    });
    const window = { enigma: "existing-page-sdk" };
    runInNewContext(script, { ...f.environment, window });
    const result = await window.__descomplicaQlikMetadataV1.run();
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: "unavailable", reason });
    assert.equal(window.enigma, "existing-page-sdk");
    assert.ok(f.calls.includes("OpenDoc"));
    assert.ok(f.calls.includes("socket_closed"));
    assert.equal(f.timers.size, 0);
  }
});

for (const mode of ["cancel", "deadline", "signal"]) {
  test(`${mode} takes priority over a metadata error during inspection`, async () => {
    const f = fixture();
    const started = Promise.withResolvers();
    const pending = Promise.withResolvers();
    const abort = new AbortController();
    f.environment.AbortController = class {
      constructor() {
        return abort;
      }
    };
    const inspect = () => {
      started.resolve();
      return pending.promise;
    };
    const client = createBrowserMetadataClient(f.enigma, {}, inspect, f.environment);
    const work = client.run();
    await started.promise;
    if (mode === "cancel") client.cancel();
    else if (mode === "deadline") for (const stop of f.timers.values()) stop();
    else abort.abort();
    pending.reject(
      Object.assign(new Error("synthetic-private-late-message"), {
        code: "qix_aborted",
        token: "synthetic-private-late-token",
      }),
    );
    assert.deepEqual(await work, { status: "unavailable", reason: "cancelled" });
    assert.ok(f.calls.includes("socket_closed"));
    assert.equal(f.timers.size, 0);
  });
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
