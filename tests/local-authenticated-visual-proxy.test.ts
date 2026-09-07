import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error — runner JavaScript importado para testar o proxy local isolado.
import { startSerializedSupabaseProxy } from "../scripts/qa/local-authenticated-visual.mjs";

type Closable = { close: () => Promise<void> };
type UpstreamHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;

const cleanups: Closable[] = [];

function jwt(label: string, expirationMs: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: label, exp: expirationMs / 1_000 })}.${Buffer.from(label).toString("base64url")}`;
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function respondJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
    "x-upstream-probe": "preserved",
  });
  response.end(JSON.stringify(payload));
}

async function responseSnapshot(response: Response) {
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    upstreamProbe: response.headers.get("x-upstream-probe"),
    body: await response.text(),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for deterministic test state.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function completesWithin(promise: Promise<unknown>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function startTestProxy(handler: UpstreamHandler, options?: { now?: () => number }) {
  const upstream = createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch(() => {
      if (!response.headersSent) respondJson(response, 500, { message: "test upstream failed" });
      else response.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", resolve);
  });
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("Test upstream did not bind.");
  cleanups.push({
    close: () =>
      new Promise<void>((resolve) => {
        upstream.close(() => resolve());
        upstream.closeAllConnections();
      }),
  });

  const proxy = await startSerializedSupabaseProxy(`http://127.0.0.1:${address.port}`, options);
  cleanups.push(proxy);
  return { ...proxy, upstreamHost: `127.0.0.1:${address.port}` };
}

function protectedHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    authorization: `Bearer ${token}`,
    apikey: "qa-publishable-key",
    "content-type": "application/json",
    ...extra,
  };
}

afterEach(async () => {
  await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((resource) => resource.close()),
  );
});

describe("local authenticated visual Supabase proxy", () => {
  it("single-flights equal protected reads and serializes different protected reads globally", async () => {
    const token = jwt("qa-a", Date.now() + 10 * 60_000);
    const attempts = new Map<string, number>();
    const observedHosts = new Set<string>();
    let active = 0;
    let maxActive = 0;
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const key = `${request.method} ${url.pathname}`;
      attempts.set(key, (attempts.get(key) ?? 0) + 1);
      observedHosts.add(request.headers.host ?? "");
      active += 1;
      maxActive = Math.max(maxActive, active);
      await requestBody(request);
      await new Promise((resolve) => setTimeout(resolve, 30));
      active -= 1;
      if (url.pathname === "/auth/v1/user") respondJson(response, 200, { id: "qa-user" });
      else if (url.pathname.endsWith("current_session_is_live")) respondJson(response, 200, true);
      else respondJson(response, 200, [{ role_key: "master" }]);
    });

    const authUrl = `${proxy.origin}/auth/v1/user`;
    const sessionUrl = `${proxy.origin}/rest/v1/rpc/current_session_is_live`;
    const contextUrl = `${proxy.origin}/rest/v1/rpc/get_user_authorization_context`;
    const responses = await Promise.all([
      fetch(authUrl, { headers: protectedHeaders(token) }),
      fetch(authUrl, { headers: protectedHeaders(token) }),
      fetch(authUrl, { headers: protectedHeaders(token) }),
      fetch(sessionUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: "{}",
      }),
      fetch(contextUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: '{"user_uuid":"qa-user"}',
      }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
    expect(
      responses.every((response) => response.headers.get("x-upstream-probe") === "preserved"),
    ).toBe(true);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      { id: "qa-user" },
      { id: "qa-user" },
      { id: "qa-user" },
      true,
      [{ role_key: "master" }],
    ]);

    await Promise.all([
      fetch(authUrl, { headers: protectedHeaders(token) }),
      fetch(sessionUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: "{}",
      }),
      fetch(contextUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: '{"user_uuid":"qa-user"}',
      }),
    ]);

    expect(maxActive).toBe(1);
    expect(observedHosts).toEqual(new Set([proxy.upstreamHost]));
    expect(Object.fromEntries(attempts)).toEqual({
      "GET /auth/v1/user": 1,
      "POST /rest/v1/rpc/current_session_is_live": 1,
      "POST /rest/v1/rpc/get_user_authorization_context": 1,
    });
    const evidence = proxy.evidence();
    expect(evidence).toMatchObject({
      tokenCount: 1,
      upstreamTokenCount: 1,
      allTokensHadUpstream: true,
      cacheHits: 3,
      singleFlightFollowers: 2,
      endpoints: {
        authUser: { upstreamRequests: 1, upstreamMiss200: 1, cacheHits: 1 },
        sessionLive: { upstreamRequests: 1, upstreamMiss200: 1, cacheHits: 1 },
        authorizationContext: { upstreamRequests: 1, upstreamMiss200: 1, cacheHits: 1 },
      },
    });
    expect(JSON.stringify(evidence)).not.toContain(token);
    expect(() => proxy.assertEvidence()).not.toThrow();
  }, 20_000);

  it("isolates protected cache entries by token, URL, relevant headers, and exact body", async () => {
    const expiration = Date.now() + 10 * 60_000;
    const tokenA = jwt("qa-a", expiration);
    const tokenB = jwt("qa-b", expiration);
    let attempts = 0;
    const observedBodies: string[] = [];
    const proxy = await startTestProxy(async (request, response) => {
      attempts += 1;
      observedBodies.push((await requestBody(request)).toString("utf8"));
      respondJson(response, 200, [{ role_key: "master" }]);
    });
    const url = `${proxy.origin}/rest/v1/rpc/get_user_authorization_context`;
    const call = (token: string, body: string, extra: Record<string, string> = {}, query = "") =>
      fetch(`${url}${query}`, {
        method: "POST",
        headers: protectedHeaders(token, extra),
        body,
      });

    await call(tokenA, '{"user_uuid":"a"}');
    await call(tokenA, '{"user_uuid":"a"}');
    await call(tokenA, '{"user_uuid":"b"}');
    await call(tokenB, '{"user_uuid":"a"}');
    await call(tokenA, '{"user_uuid":"a"}', { "accept-profile": "private" });
    await call(tokenA, '{"user_uuid":"a"}', { "accept-encoding": "identity" });
    await call(tokenA, '{"user_uuid":"a"}', { "if-none-match": '"qa-context"' });
    await call(tokenA, '{"user_uuid":"a"}', { "range-unit": "items" });
    await call(tokenA, '{"user_uuid":"a"}', {}, "?probe=1");

    expect(attempts).toBe(8);
    expect(observedBodies).toEqual([
      '{"user_uuid":"a"}',
      '{"user_uuid":"b"}',
      '{"user_uuid":"a"}',
      '{"user_uuid":"a"}',
      '{"user_uuid":"a"}',
      '{"user_uuid":"a"}',
      '{"user_uuid":"a"}',
      '{"user_uuid":"a"}',
    ]);
    expect(proxy.evidence()).toMatchObject({
      tokenCount: 2,
      upstreamTokenCount: 2,
      allTokensHadUpstream: true,
      cacheHits: 1,
    });
  });

  it("does not cache invalid JSON, invalid shapes, 401, or 5xx and retries only safe reads", async () => {
    const token = jwt("qa-retry", Date.now() + 10 * 60_000);
    const attempts = new Map<string, number>();
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const scenario = url.searchParams.get("case") ?? "default";
      const key = `${request.method} ${url.pathname} ${scenario}`;
      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);
      await requestBody(request);

      if (scenario === "invalid-json") {
        response.writeHead(200, {
          "content-type": "application/json",
          "x-upstream-probe": "preserved",
        });
        response.end("not-json");
      } else if (scenario === "invalid-user") {
        respondJson(response, 200, { id: 42 });
      } else if (scenario === "invalid-shape") {
        respondJson(response, 200, { role_key: "master" });
      } else if (scenario === "false-session") {
        respondJson(response, 200, false);
      } else if (scenario === "unauthorized") {
        respondJson(response, 401, { message: "unauthorized" });
      } else if (scenario === "always-5xx") {
        respondJson(response, 503, { message: "unavailable" });
      } else if (scenario === "flaky") {
        respondJson(response, attempt < 3 ? 504 : 200, true);
      } else {
        respondJson(response, 500, { message: "mutation failed" });
      }
    });

    const auth = (scenario: string) =>
      fetch(`${proxy.origin}/auth/v1/user?case=${scenario}`, {
        headers: protectedHeaders(token),
      });
    const invalidJsonResponses = [await auth("invalid-json"), await auth("invalid-json")];
    await auth("invalid-user");
    await auth("invalid-user");
    const unauthorizedResponses = [await auth("unauthorized"), await auth("unauthorized")];
    const unavailableResponses = [await auth("always-5xx"), await auth("always-5xx")];

    const contextUrl = `${proxy.origin}/rest/v1/rpc/get_user_authorization_context?case=invalid-shape`;
    const invalidContextResponses = [
      await fetch(contextUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: "{}",
      }),
      await fetch(contextUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: "{}",
      }),
    ];

    const falseSessionUrl = `${proxy.origin}/rest/v1/rpc/current_session_is_live?case=false-session`;
    const falseSessionResponses = [
      await fetch(falseSessionUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: "{}",
      }),
      await fetch(falseSessionUrl, {
        method: "POST",
        headers: protectedHeaders(token),
        body: "{}",
      }),
    ];

    const sessionUrl = `${proxy.origin}/rest/v1/rpc/current_session_is_live?case=flaky`;
    const flakyResponse = await fetch(sessionUrl, {
      method: "POST",
      headers: protectedHeaders(token),
      body: "{}",
    });
    const cachedFlakyResponse = await fetch(sessionUrl, {
      method: "POST",
      headers: protectedHeaders(token),
      body: "{}",
    });
    const mutationResponse = await fetch(`${proxy.origin}/rest/v1/rpc/mutating?case=mutation`, {
      method: "POST",
      headers: protectedHeaders(token),
      body: "{}",
    });

    expect(await Promise.all(invalidJsonResponses.map(responseSnapshot))).toEqual([
      {
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: "not-json",
      },
      {
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: "not-json",
      },
    ]);
    expect(await Promise.all(unauthorizedResponses.map(responseSnapshot))).toEqual([
      {
        status: 401,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"message":"unauthorized"}',
      },
      {
        status: 401,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"message":"unauthorized"}',
      },
    ]);
    expect(await Promise.all(unavailableResponses.map(responseSnapshot))).toEqual([
      {
        status: 503,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"message":"unavailable"}',
      },
      {
        status: 503,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"message":"unavailable"}',
      },
    ]);
    expect(await Promise.all(invalidContextResponses.map(responseSnapshot))).toEqual(
      Array.from({ length: 2 }, () => ({
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"role_key":"master"}',
      })),
    );
    expect(await Promise.all(falseSessionResponses.map(responseSnapshot))).toEqual(
      Array.from({ length: 2 }, () => ({
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: "false",
      })),
    );
    expect(await responseSnapshot(flakyResponse)).toEqual({
      status: 200,
      contentType: "application/json",
      upstreamProbe: "preserved",
      body: "true",
    });
    expect(await responseSnapshot(cachedFlakyResponse)).toEqual({
      status: 200,
      contentType: "application/json",
      upstreamProbe: "preserved",
      body: "true",
    });
    expect(await responseSnapshot(mutationResponse)).toEqual({
      status: 500,
      contentType: "application/json",
      upstreamProbe: "preserved",
      body: '{"message":"mutation failed"}',
    });

    expect(attempts.get("GET /auth/v1/user invalid-json")).toBe(2);
    expect(attempts.get("GET /auth/v1/user invalid-user")).toBe(2);
    expect(attempts.get("GET /auth/v1/user unauthorized")).toBe(2);
    expect(attempts.get("GET /auth/v1/user always-5xx")).toBe(6);
    expect(attempts.get("POST /rest/v1/rpc/get_user_authorization_context invalid-shape")).toBe(2);
    expect(attempts.get("POST /rest/v1/rpc/current_session_is_live flaky")).toBe(3);
    expect(attempts.get("POST /rest/v1/rpc/current_session_is_live false-session")).toBe(2);
    expect(attempts.get("POST /rest/v1/rpc/mutating mutation")).toBe(1);
  }, 20_000);

  it("forwards exactly 64 KiB and rejects 64 KiB plus one byte before upstream", async () => {
    const token = jwt("qa-body-limit", Date.now() + 10 * 60_000);
    const attempts = new Map<string, number>();
    const observedSizes = new Map<string, number>();
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const scenario = url.searchParams.get("case") ?? "unknown";
      attempts.set(scenario, (attempts.get(scenario) ?? 0) + 1);
      observedSizes.set(scenario, (await requestBody(request)).length);
      respondJson(response, 200, true);
    });
    const endpoint = `${proxy.origin}/rest/v1/rpc/current_session_is_live`;
    const request = (scenario: string, size: number) =>
      fetch(`${endpoint}?case=${scenario}`, {
        method: "POST",
        headers: protectedHeaders(token),
        body: Buffer.alloc(size, 0x61),
      });

    const allowed = await request("allowed", 64 * 1024);
    const cachedAllowed = await request("allowed", 64 * 1024);
    const rejected = await request("rejected", 64 * 1024 + 1);

    expect(await responseSnapshot(allowed)).toEqual({
      status: 200,
      contentType: "application/json",
      upstreamProbe: "preserved",
      body: "true",
    });
    expect(await responseSnapshot(cachedAllowed)).toEqual({
      status: 200,
      contentType: "application/json",
      upstreamProbe: "preserved",
      body: "true",
    });
    expect(await responseSnapshot(rejected)).toEqual({
      status: 413,
      contentType: "application/json; charset=utf-8",
      upstreamProbe: null,
      body: '{"message":"Local QA proxy request body exceeds 64 KiB."}',
    });
    expect(Object.fromEntries(attempts)).toEqual({ allowed: 1 });
    expect(Object.fromEntries(observedSizes)).toEqual({ allowed: 64 * 1024 });
  }, 20_000);

  it("expires protected entries at JWT expiry or five minutes and invalidates on auth mutation 2xx", async () => {
    let currentTime = 2_000_000_000_000;
    const longToken = jwt("qa-long", currentTime + 10 * 60_000);
    let authAttempts = 0;
    const proxy = await startTestProxy(
      async (request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        await requestBody(request);
        if (url.pathname === "/auth/v1/user" && request.method === "GET") {
          authAttempts += 1;
          respondJson(response, 200, { id: "qa-user" });
        } else if (url.pathname === "/auth/v1/user" && request.method === "PUT") {
          respondJson(response, 200, { id: "qa-user", updated: true });
        } else if (url.pathname === "/auth/v1/user" && request.method === "OPTIONS") {
          response.writeHead(204);
          response.end();
        } else if (url.pathname === "/auth/v1/logout") {
          response.writeHead(url.searchParams.has("fail") ? 500 : 204);
          response.end();
        } else if (url.pathname === "/auth/v1/token") {
          respondJson(response, 200, { access_token: "rotated" });
        } else {
          respondJson(response, 404, { message: "not found" });
        }
      },
      { now: () => currentTime },
    );
    const auth = (token: string) =>
      fetch(`${proxy.origin}/auth/v1/user`, { headers: protectedHeaders(token) });

    await auth(longToken);
    await auth(longToken);
    expect(authAttempts).toBe(1);
    currentTime += 5 * 60_000 + 1;
    await auth(longToken);
    expect(authAttempts).toBe(2);

    const shortToken = jwt("qa-short", currentTime + 60_000);
    await auth(shortToken);
    await auth(shortToken);
    expect(authAttempts).toBe(3);
    currentTime += 60_001;
    await auth(shortToken);
    expect(authAttempts).toBe(4);

    const mutationToken = jwt("qa-mutation", currentTime + 10 * 60_000);
    await auth(mutationToken);
    await auth(mutationToken);
    expect(authAttempts).toBe(5);
    await fetch(`${proxy.origin}/auth/v1/logout?fail=1`, {
      method: "POST",
      headers: protectedHeaders(mutationToken),
    });
    await auth(mutationToken);
    expect(authAttempts).toBe(5);
    await fetch(`${proxy.origin}/auth/v1/logout`, {
      method: "POST",
      headers: protectedHeaders(mutationToken),
    });
    await auth(mutationToken);
    expect(authAttempts).toBe(6);
    await auth(mutationToken);
    expect(authAttempts).toBe(6);
    await fetch(`${proxy.origin}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: protectedHeaders(mutationToken),
      body: '{"refresh_token":"opaque"}',
    });
    await auth(mutationToken);
    expect(authAttempts).toBe(7);
    await auth(mutationToken);
    expect(authAttempts).toBe(7);
    const updateUser = await fetch(`${proxy.origin}/auth/v1/user`, {
      method: "PUT",
      headers: protectedHeaders(mutationToken),
      body: '{"data":{"qa":true}}',
    });
    expect(updateUser.status).toBe(200);
    await auth(mutationToken);
    expect(authAttempts).toBe(8);
    await auth(mutationToken);
    const preflight = await fetch(`${proxy.origin}/auth/v1/user`, {
      method: "OPTIONS",
      headers: protectedHeaders(mutationToken),
    });
    expect(preflight.status).toBe(204);
    await auth(mutationToken);
    expect(authAttempts).toBe(8);
  });

  it("does not repopulate protected or REST caches from requests started before invalidation", async () => {
    const token = jwt("qa-invalidation-race", Date.now() + 10 * 60_000);
    const releaseFirstWave = deferred();
    const protectedUpstreamStarted = deferred();
    const restUpstreamStarted = deferred();
    const attempts = new Map<string, number>();
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const endpoint = url.pathname.endsWith("current_session_is_live")
        ? "sessionLive"
        : url.pathname.endsWith("get_user_authorization_context")
          ? "authorizationContext"
          : url.pathname === "/auth/v1/user"
            ? "authUser"
            : url.pathname === "/rest/v1/race"
              ? "rest"
              : "logout";
      const attempt = (attempts.get(endpoint) ?? 0) + 1;
      attempts.set(endpoint, attempt);
      await requestBody(request);

      if (endpoint === "logout") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (attempt === 1 && endpoint === "rest") {
        restUpstreamStarted.resolve();
        await releaseFirstWave.promise;
      } else if (
        attempt === 1 &&
        ["authUser", "sessionLive", "authorizationContext"].includes(endpoint)
      ) {
        protectedUpstreamStarted.resolve();
        await releaseFirstWave.promise;
      }

      if (endpoint === "authUser") respondJson(response, 200, { id: "qa-user" });
      else if (endpoint === "sessionLive") respondJson(response, 200, true);
      else if (endpoint === "authorizationContext") {
        respondJson(response, 200, [{ role_key: "master" }]);
      } else respondJson(response, 200, { source: "upstream" });
    });
    const headers = protectedHeaders(token);
    const authRequest = () => fetch(`${proxy.origin}/auth/v1/user`, { headers });
    const sessionRequest = () =>
      fetch(`${proxy.origin}/rest/v1/rpc/current_session_is_live`, {
        method: "POST",
        headers,
        body: "{}",
      });
    const contextRequest = () =>
      fetch(`${proxy.origin}/rest/v1/rpc/get_user_authorization_context`, {
        method: "POST",
        headers,
        body: '{"user_uuid":"qa-user"}',
      });
    const restRequest = () => fetch(`${proxy.origin}/rest/v1/race`, { headers });
    const requestAllReads = () => [
      authRequest(),
      sessionRequest(),
      contextRequest(),
      restRequest(),
    ];

    const firstWave = requestAllReads();
    try {
      await Promise.all([protectedUpstreamStarted.promise, restUpstreamStarted.promise]);
      await waitFor(() =>
        Object.values(proxy.evidence().endpoints).every(
          (endpoint: { requestsSeen: number }) => endpoint.requestsSeen >= 1,
        ),
      );
      const logout = await fetch(`${proxy.origin}/auth/v1/logout`, {
        method: "POST",
        headers,
      });
      expect(logout.status).toBe(204);
    } finally {
      releaseFirstWave.resolve();
    }
    await Promise.all(firstWave);

    const secondWave = await Promise.all(requestAllReads());
    expect(secondWave.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    const thirdWave = await Promise.all(requestAllReads());
    expect(await Promise.all(thirdWave.map(responseSnapshot))).toEqual([
      {
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"id":"qa-user"}',
      },
      {
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: "true",
      },
      {
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '[{"role_key":"master"}]',
      },
      {
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"source":"upstream"}',
      },
    ]);
    expect(Object.fromEntries(attempts)).toEqual({
      authUser: 2,
      rest: 2,
      logout: 1,
      sessionLive: 2,
      authorizationContext: 2,
    });
  }, 30_000);

  it("preserves the existing GET REST cache and leaves unrelated requests concurrent", async () => {
    const expiration = Date.now() + 10 * 60_000;
    const tokenA = jwt("qa-rest-a", expiration);
    const tokenB = jwt("qa-rest-b", expiration);
    const attempts = new Map<string, number>();
    const unrelatedPairStarted = deferred();
    let activeOther = 0;
    let maxActiveOther = 0;
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      attempts.set(url.pathname, (attempts.get(url.pathname) ?? 0) + 1);
      activeOther += 1;
      maxActiveOther = Math.max(maxActiveOther, activeOther);
      if (url.pathname === "/auth/v1/users") {
        if (activeOther === 2) unrelatedPairStarted.resolve();
        await unrelatedPairStarted.promise;
      }
      activeOther -= 1;
      respondJson(response, 200, { pathname: url.pathname });
    });

    const unrelatedResponses = await Promise.all([
      fetch(`${proxy.origin}/auth/v1/users?probe=1`),
      fetch(`${proxy.origin}/auth/v1/users?probe=2`),
    ]);
    const cacheUrl = `${proxy.origin}/rest/v1/cacheable?item=1`;
    const firstCached = await fetch(cacheUrl, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const secondCached = await fetch(cacheUrl, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const isolated = await fetch(cacheUrl, {
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(maxActiveOther).toBeGreaterThan(1);
    expect(attempts.get("/rest/v1/cacheable")).toBe(2);
    expect(unrelatedResponses.map((response) => response.status)).toEqual([200, 200]);
    expect(await Promise.all([firstCached, secondCached, isolated].map(responseSnapshot))).toEqual(
      Array.from({ length: 3 }, () => ({
        status: 200,
        contentType: "application/json",
        upstreamProbe: "preserved",
        body: '{"pathname":"/rest/v1/cacheable"}',
      })),
    );
  }, 20_000);

  it("invalidates every cache after successful REST writes but not after 4xx or 5xx", async () => {
    const token = jwt("qa-rest-write", Date.now() + 10 * 60_000);
    const readAttempts = new Map<string, number>();
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      await requestBody(request);
      if (url.pathname === "/rest/v1/mutation") {
        const status = Number(url.searchParams.get("status") ?? "204");
        response.writeHead(status, { "x-upstream-probe": "preserved" });
        response.end();
        return;
      }

      const endpoint = url.pathname.endsWith("current_session_is_live")
        ? "sessionLive"
        : url.pathname.endsWith("get_user_authorization_context")
          ? "authorizationContext"
          : url.pathname === "/auth/v1/user"
            ? "authUser"
            : "rest";
      readAttempts.set(endpoint, (readAttempts.get(endpoint) ?? 0) + 1);
      if (endpoint === "authUser") respondJson(response, 200, { id: "qa-user" });
      else if (endpoint === "sessionLive") respondJson(response, 200, true);
      else if (endpoint === "authorizationContext") {
        respondJson(response, 200, [{ role_key: "master" }]);
      } else respondJson(response, 200, { source: "upstream" });
    });
    const headers = protectedHeaders(token);
    const readAll = () => [
      fetch(`${proxy.origin}/auth/v1/user`, { headers }),
      fetch(`${proxy.origin}/rest/v1/rpc/current_session_is_live`, {
        method: "POST",
        headers,
        body: "{}",
      }),
      fetch(`${proxy.origin}/rest/v1/rpc/get_user_authorization_context`, {
        method: "POST",
        headers,
        body: '{"user_uuid":"qa-user"}',
      }),
      fetch(`${proxy.origin}/rest/v1/cacheable-write-test`, { headers }),
    ];

    await Promise.all(readAll());
    await Promise.all(readAll());
    expect(Object.fromEntries(readAttempts)).toEqual({
      authUser: 1,
      rest: 1,
      sessionLive: 1,
      authorizationContext: 1,
    });

    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const mutation = await fetch(`${proxy.origin}/rest/v1/mutation`, {
        method,
        headers,
        body: "{}",
      });
      expect(mutation.status).toBe(204);
      await Promise.all(readAll());
      await Promise.all(readAll());
    }
    expect(Object.fromEntries(readAttempts)).toEqual({
      authUser: 5,
      rest: 5,
      sessionLive: 5,
      authorizationContext: 5,
    });

    for (const status of [409, 503]) {
      const mutation = await fetch(`${proxy.origin}/rest/v1/mutation?status=${status}`, {
        method: "PATCH",
        headers,
        body: "{}",
      });
      expect(mutation.status).toBe(status);
    }
    await Promise.all(readAll());
    expect(Object.fromEntries(readAttempts)).toEqual({
      authUser: 5,
      rest: 5,
      sessionLive: 5,
      authorizationContext: 5,
    });
  }, 30_000);

  it("isolates GET REST cache entries by every response-relevant request header", async () => {
    const expiration = Date.now() + 10 * 60_000;
    const tokenA = jwt("qa-rest-key-a", expiration);
    const tokenB = jwt("qa-rest-key-b", expiration);
    let attempts = 0;
    const proxy = await startTestProxy(async (request, response) => {
      attempts += 1;
      await requestBody(request);
      respondJson(response, 200, { attempt: attempts });
    });
    const url = `${proxy.origin}/rest/v1/header-isolation`;
    const baseHeaders = protectedHeaders(tokenA);
    const headerSets = [
      baseHeaders,
      protectedHeaders(tokenA, { prefer: "count=exact" }),
      protectedHeaders(tokenA, { "content-profile": "private" }),
      protectedHeaders(tokenA, { "content-type": "application/vnd.pgrst.object+json" }),
      protectedHeaders(tokenA, { "accept-profile": "private" }),
      protectedHeaders(tokenA, { "range-unit": "items" }),
      protectedHeaders(tokenA, { "accept-encoding": "identity" }),
      protectedHeaders(tokenA, { "if-match": '"qa-etag"' }),
      protectedHeaders(tokenA, { "if-none-match": '"qa-none"' }),
      protectedHeaders(tokenA, { "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT" }),
      protectedHeaders(tokenA, { "if-unmodified-since": "Wed, 21 Oct 2015 07:28:00 GMT" }),
      protectedHeaders(tokenA, { "if-range": '"qa-range"' }),
      protectedHeaders(tokenA, { range: "0-9" }),
      protectedHeaders(tokenA, { accept: "application/vnd.pgrst.object+json" }),
      protectedHeaders(tokenA, { apikey: "qa-other-publishable-key" }),
      protectedHeaders(tokenB),
    ];

    for (const headers of headerSets) expect((await fetch(url, { headers })).status).toBe(200);
    for (const headers of headerSets) expect((await fetch(url, { headers })).status).toBe(200);

    expect(attempts).toBe(headerSets.length);
  }, 20_000);

  it("limits GET REST caching by valid Bearer JWT expiry and five-minute TTL", async () => {
    let currentTime = 2_100_000_000_000;
    const longToken = jwt("qa-rest-long", currentTime + 10 * 60_000);
    let attempts = 0;
    const proxy = await startTestProxy(
      async (request, response) => {
        attempts += 1;
        await requestBody(request);
        respondJson(response, 200, { attempt: attempts });
      },
      { now: () => currentTime },
    );
    const url = `${proxy.origin}/rest/v1/expiry`;
    const read = (authorization?: string) =>
      fetch(url, { headers: authorization ? { authorization } : undefined });

    await read(`Bearer ${longToken}`);
    await read(`Bearer ${longToken}`);
    expect(attempts).toBe(1);
    currentTime += 5 * 60_000 + 1;
    await read(`Bearer ${longToken}`);
    expect(attempts).toBe(2);

    const shortToken = jwt("qa-rest-short", currentTime + 60_000);
    await read(`Bearer ${shortToken}`);
    await read(`Bearer ${shortToken}`);
    expect(attempts).toBe(3);
    currentTime += 60_001;
    await read(`Bearer ${shortToken}`);
    expect(attempts).toBe(4);

    const expiredToken = jwt("qa-rest-expired", currentTime - 1);
    await read(`Bearer ${expiredToken}`);
    await read(`Bearer ${expiredToken}`);
    await read("Bearer opaque-not-jwt");
    await read("Bearer opaque-not-jwt");
    await read();
    await read();
    expect(attempts).toBe(10);
  });

  it("closes quickly by cancelling pending upstream requests, retries, and protected work", async () => {
    const token = jwt("qa-close", Date.now() + 10 * 60_000);
    const pendingStarted = deferred();
    let retryAttempts = 0;
    let queuedProtectedUpstreamAttempts = 0;
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      await requestBody(request);
      if (url.pathname === "/auth/v1/user") {
        pendingStarted.resolve();
        return;
      }
      if (
        url.pathname.endsWith("current_session_is_live") ||
        url.pathname.endsWith("get_user_authorization_context")
      ) {
        queuedProtectedUpstreamAttempts += 1;
        if (url.pathname.endsWith("current_session_is_live")) {
          respondJson(response, 200, true);
        } else {
          respondJson(response, 200, [{ role_key: "master" }]);
        }
        return;
      }
      retryAttempts += 1;
      respondJson(response, 503, { message: "retry pending" });
    });
    const headers = protectedHeaders(token);
    const pendingRead = fetch(`${proxy.origin}/auth/v1/user`, { headers }).catch(
      (error: unknown) => error,
    );
    await pendingStarted.promise;
    const queuedSessionRead = fetch(`${proxy.origin}/rest/v1/rpc/current_session_is_live`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((error: unknown) => error);
    const queuedContextRead = fetch(`${proxy.origin}/rest/v1/rpc/get_user_authorization_context`, {
      method: "POST",
      headers,
      body: '{"user_uuid":"qa-user"}',
    }).catch((error: unknown) => error);
    await waitFor(() =>
      Object.values(proxy.evidence().endpoints).every(
        (endpoint: { requestsSeen: number }) => endpoint.requestsSeen >= 1,
      ),
    );
    const retryingRead = fetch(`${proxy.origin}/rest/v1/retry-close`, { headers }).catch(
      (error: unknown) => error,
    );

    await waitFor(() => {
      const evidence = proxy.evidence();
      return evidence.activeUpstreamRequests >= 1 && evidence.retryTimers >= 1;
    });
    expect(await completesWithin(proxy.close(), 2_000)).toBe(true);
    await Promise.allSettled([pendingRead, queuedSessionRead, queuedContextRead, retryingRead]);
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(retryAttempts).toBe(1);
    expect(queuedProtectedUpstreamAttempts).toBe(0);
    expect(proxy.evidence()).toMatchObject({
      activeUpstreamRequests: 0,
      retryTimers: 0,
    });
    expect(await completesWithin(proxy.close(), 100)).toBe(true);
  }, 20_000);

  it("requires a sanitized cache hit from every protected endpoint", async () => {
    const token = jwt("qa-evidence", Date.now() + 10 * 60_000);
    const proxy = await startTestProxy(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      await requestBody(request);
      if (url.pathname === "/auth/v1/user") respondJson(response, 200, { id: "qa-user" });
      else if (url.pathname.endsWith("current_session_is_live")) respondJson(response, 200, true);
      else respondJson(response, 200, [{ role_key: "master" }]);
    });
    const headers = protectedHeaders(token);
    await fetch(`${proxy.origin}/auth/v1/user`, { headers });
    await fetch(`${proxy.origin}/auth/v1/user`, { headers });
    const sessionUrl = `${proxy.origin}/rest/v1/rpc/current_session_is_live`;
    await fetch(sessionUrl, { method: "POST", headers, body: "{}" });
    await fetch(sessionUrl, { method: "POST", headers, body: "{}" });
    const contextUrl = `${proxy.origin}/rest/v1/rpc/get_user_authorization_context`;
    await fetch(contextUrl, {
      method: "POST",
      headers,
      body: '{"user_uuid":"qa-user"}',
    });

    expect(() => proxy.assertEvidence()).toThrow("Local QA proxy evidence is incomplete");
    const evidence = proxy.evidence();
    expect(evidence).toMatchObject({
      tokenCount: 1,
      upstreamTokenCount: 1,
      allTokensHadUpstream: true,
      cacheHits: 2,
      endpoints: {
        authUser: { upstreamMiss200: 1, cacheHits: 1 },
        sessionLive: { upstreamMiss200: 1, cacheHits: 1 },
        authorizationContext: { upstreamMiss200: 1, cacheHits: 0 },
      },
    });
    expect(Object.keys(evidence)).not.toContain("tokens");
    expect(JSON.stringify(evidence)).not.toContain(token);
    await fetch(contextUrl, {
      method: "POST",
      headers,
      body: '{"user_uuid":"qa-user"}',
    });
    expect(() => proxy.assertEvidence()).not.toThrow();
  });
});
