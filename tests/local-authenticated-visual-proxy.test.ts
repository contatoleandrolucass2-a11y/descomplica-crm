import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error — runner JavaScript importado para testar o proxy local isolado.
import { startSerializedSupabaseProxy } from "../scripts/qa/local-authenticated-visual.mjs";

type Closable = { close: () => Promise<void> };

const cleanups: Closable[] = [];

afterEach(async () => {
  await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((resource) => resource.close()),
  );
});

describe("local authenticated visual Supabase proxy", () => {
  it("serializes only the exact auth user endpoint and preserves upstream responses", async () => {
    let activeAuthUser = 0;
    let maxActiveAuthUser = 0;
    let activeOther = 0;
    let maxActiveOther = 0;
    const observedHosts = new Set<string>();

    const upstream = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const exactAuthUser = requestUrl.pathname === "/auth/v1/user";
      observedHosts.add(request.headers.host ?? "");
      if (exactAuthUser) {
        activeAuthUser += 1;
        maxActiveAuthUser = Math.max(maxActiveAuthUser, activeAuthUser);
      } else {
        activeOther += 1;
        maxActiveOther = Math.max(maxActiveOther, activeOther);
      }

      setTimeout(() => {
        const status = requestUrl.searchParams.get("status") === "401" ? 401 : 200;
        response.writeHead(status, {
          "content-type": "application/json",
          "x-upstream-probe": "preserved",
        });
        response.end(JSON.stringify({ pathname: requestUrl.pathname, status }));
        if (exactAuthUser) activeAuthUser -= 1;
        else activeOther -= 1;
      }, 40);
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

    const upstreamOrigin = `http://127.0.0.1:${address.port}`;
    const proxy = await startSerializedSupabaseProxy(upstreamOrigin);
    cleanups.push(proxy);

    const responses = await Promise.all([
      fetch(`${proxy.origin}/auth/v1/user?status=401`),
      fetch(`${proxy.origin}/auth/v1/user?probe=2`),
      fetch(`${proxy.origin}/auth/v1/user?probe=3`),
      fetch(`${proxy.origin}/auth/v1/users?probe=1`),
      fetch(`${proxy.origin}/auth/v1/users?probe=2`),
      fetch(`${proxy.origin}/rest/v1/probe?item=1`),
      fetch(`${proxy.origin}/rest/v1/probe?item=2`),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json()));

    expect(maxActiveAuthUser).toBe(1);
    expect(maxActiveOther).toBeGreaterThan(1);
    expect(responses.slice(0, 3).map((response) => response.status)).toEqual([401, 200, 200]);
    expect(
      responses.every((response) => response.headers.get("x-upstream-probe") === "preserved"),
    ).toBe(true);
    expect(payloads.map((payload) => payload.pathname)).toEqual([
      "/auth/v1/user",
      "/auth/v1/user",
      "/auth/v1/user",
      "/auth/v1/users",
      "/auth/v1/users",
      "/rest/v1/probe",
      "/rest/v1/probe",
    ]);
    expect(observedHosts).toEqual(new Set([new URL(upstreamOrigin).host]));
  });
});
