import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { holdBrowserSession } from "./launch-browser.mjs";

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
