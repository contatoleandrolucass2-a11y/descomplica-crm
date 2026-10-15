import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { collectAuthenticatedMetadata, holdBrowserSession } from "./launch-browser.mjs";

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
