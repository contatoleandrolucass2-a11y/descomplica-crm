import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSalesforceRequest,
  SalesforceAuthenticationError,
  safeSalesforceError,
} from "./report-request.mjs";

const endpoint = "https://salesforce.invalid/report";
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers });
const noWait = async () => {};

test("GET retries transport, 429 and 5xx failures at most three times", async () => {
  for (const kind of ["network", 429, 500, 503]) {
    let attempts = 0;
    const waits = [];
    const request = createSalesforceRequest("synthetic-sid", {
      sleep: async (ms) => waits.push(ms),
      fetchImpl: async (_url, options) => {
        assert.equal(options.redirect, "manual");
        assert.equal(options.headers.Authorization, "Bearer synthetic-sid");
        if (++attempts === 3) return json({ ok: true });
        if (kind === "network") throw new TypeError("sensitive network text");
        return json({}, kind, { "retry-after": "2" });
      },
    });
    assert.deepEqual(await request(endpoint), { ok: true });
    assert.equal(attempts, 3);
    assert.deepEqual(waits, kind === "network" ? [500, 1_000] : [2_000, 2_000]);
  }
});

test("bounded retries stop on repeated GET errors and never repeat POST", async () => {
  for (const method of ["GET", "POST"]) {
    for (const kind of ["network", 429, 503]) {
      let attempts = 0;
      const request = createSalesforceRequest("synthetic-sid", {
        sleep: noWait,
        fetchImpl: async () => {
          attempts += 1;
          if (kind === "network") throw new Error("sid=PRIVATE client@example.invalid");
          return json({}, kind);
        },
      });
      await assert.rejects(request(endpoint, { method }), (error) => {
        assert.doesNotMatch(JSON.stringify(safeSalesforceError(error)), /PRIVATE|example.invalid/);
        return true;
      });
      assert.equal(attempts, method === "GET" ? 3 : 1);
    }
  }
});

test("auth failures are typed, sanitized and not retried or redirected", async () => {
  for (const response of [
    () => json({ message: "sid=PRIVATE" }, 401),
    () => json([{ errorCode: "INVALID_SESSION_ID", message: "private@example.invalid" }], 403),
    () => json([{ errorCode: "INVALID_SESSION_ID", message: "private@example.invalid" }]),
    () => new Response(null, { status: 302, headers: { location: "https://other.invalid/login" } }),
  ]) {
    let attempts = 0;
    const request = createSalesforceRequest("synthetic-sid", {
      fetchImpl: async () => {
        attempts += 1;
        return response();
      },
    });
    await assert.rejects(request(endpoint), (error) => {
      assert.ok(error instanceof SalesforceAuthenticationError);
      assert.equal(error.code, "SALESFORCE_AUTH_REQUIRED");
      assert.doesNotMatch(
        error.message + JSON.stringify(error),
        /PRIVATE|example.invalid|synthetic-sid/,
      );
      return true;
    });
    assert.equal(attempts, 1);
  }
  assert.throws(() => createSalesforceRequest(""), SalesforceAuthenticationError);
});

test("timeouts cover both connection and body reads, abort, and do not retry POST", async () => {
  for (const phase of ["connection", "body"]) {
    let signal;
    let attempts = 0;
    const request = createSalesforceRequest("synthetic-sid", {
      timeoutMs: 10,
      fetchImpl: async (_url, options) => {
        attempts += 1;
        signal = options.signal;
        const hang = new Promise(() => {});
        return phase === "connection" ? hang : { ok: true, status: 200, json: () => hang };
      },
    });
    await assert.rejects(request(endpoint, { method: "POST" }), { code: "SALESFORCE_TIMEOUT" });
    assert.ok(signal.aborted);
    assert.equal(attempts, 1);
  }
});

test("GET timeouts exhaust the retry budget", async () => {
  let attempts = 0;
  const request = createSalesforceRequest("synthetic-sid", {
    sleep: noWait,
    timeoutMs: 5,
    fetchImpl: async () => {
      attempts += 1;
      return new Promise(() => {});
    },
  });
  await assert.rejects(request(endpoint), { code: "SALESFORCE_TIMEOUT" });
  assert.equal(attempts, 3);
});

test("HTTP client errors and malformed JSON/shape fail without retry or response logging", async () => {
  for (const response of [
    () => json({ message: "PRIVATE" }, 400),
    () => json({ message: "PRIVATE" }, 403),
    () => new Response('{"name":"PRIVATE"'),
    () => new Response("<html>PRIVATE</html>"),
    () => json(null),
    () => json([]),
    () => json({ errorCode: "UNKNOWN", message: "PRIVATE" }),
  ]) {
    let attempts = 0;
    const request = createSalesforceRequest("synthetic-sid", {
      fetchImpl: async () => {
        attempts += 1;
        return response();
      },
    });
    await assert.rejects(request(endpoint), (error) => !error.message.includes("PRIVATE"));
    assert.equal(attempts, 1);
  }
  assert.deepEqual(safeSalesforceError(new Error("PRIVATE")), {
    code: "SALESFORCE_EXPORT_FAILED",
    error: "Salesforce candidate export failed",
  });
});

test("Retry-After HTTP dates are respected; excessive delay or expired deadline fails closed", async () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  for (const seconds of [2, 60]) {
    let attempts = 0;
    const waits = [];
    const request = createSalesforceRequest("synthetic-sid", {
      now: () => now,
      sleep: async (ms) => waits.push(ms),
      fetchImpl: async () =>
        ++attempts === 1
          ? json({}, 429, { "retry-after": new Date(now + seconds * 1_000).toUTCString() })
          : json({ ok: true }),
    });
    if (seconds === 2) {
      await request(endpoint);
      assert.deepEqual(waits, [2_000]);
    } else {
      await assert.rejects(request(endpoint), { code: "SALESFORCE_HTTP_ERROR" });
      assert.equal(attempts, 1);
    }
    await assert.rejects(request(endpoint, { deadline: now }), { code: "SALESFORCE_TIMEOUT" });
  }
});

test("cancellation aborts pending requests and retry waits without exposing the abort reason", async () => {
  for (const phase of ["request", "retry"]) {
    const controller = new AbortController();
    let attempts = 0;
    let requestSignal;
    const request = createSalesforceRequest("synthetic-sid", {
      signal: controller.signal,
      sleep: async () => {
        controller.abort(new Error("PRIVATE"));
      },
      fetchImpl: async (_url, options) => {
        attempts += 1;
        requestSignal = options.signal;
        if (phase === "request") {
          queueMicrotask(() => controller.abort("PRIVATE"));
          return new Promise(() => {});
        }
        return json({}, 503);
      },
    });
    await assert.rejects(request(endpoint), { code: "SALESFORCE_CANCELLED" });
    assert.equal(attempts, 1);
    assert.ok(requestSignal.aborted);
    await assert.rejects(request(endpoint), { code: "SALESFORCE_CANCELLED" });
    assert.equal(attempts, 1);
  }
});
