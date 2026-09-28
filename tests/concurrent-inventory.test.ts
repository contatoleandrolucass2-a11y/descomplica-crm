import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Local QA module, without production runtime dependencies.
import * as inventoryQa from "../scripts/qa/concurrent-inventory.mjs";

const {
  assertLocalQaEnvironment,
  createQaInventoryFetch,
  startSyntheticInventoryUpstream,
  verifySyntheticInventoryUpstream,
} = inventoryQa;
const nativeFetch = globalThis.fetch;
const execute = promisify(execFile);
const authorize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: authorize }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  authorize.mockReset();
});

describe("QA-only inventory upstream isolation", () => {
  it("routes only the exact inventory feed to loopback and rejects external targets", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const guarded = createQaInventoryFetch({
      appOrigin: "http://127.0.0.1:4173",
      supabaseOrigin: "http://127.0.0.1:54321",
      upstreamOrigin: "http://127.0.0.1:4174",
      fetchImpl,
    });
    await guarded("https://descomplicapro.com.br/api/inventory", {
      headers: { authorization: "synthetic-only-secret" },
    });
    expect(fetchImpl.mock.calls[0]).toEqual([
      "http://127.0.0.1:4174/api/inventory",
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: { accept: "application/json" },
      }),
    ]);
    fetchImpl.mockClear();
    for (const url of [
      "https://descomplicapro.com.br/api/inventory?x=1",
      "https://descomplicapro.com.br/",
      "http://127.0.0.1:9999/",
      "https://elsewhere.invalid/",
    ]) {
      await expect(guarded(url)).rejects.toThrow("qa_fetch_nonlocal_blocked");
    }
    await expect(guarded("http://user:password@127.0.0.1:4173/")).rejects.toThrow(
      "qa_fetch_url_credentials",
    );
    await expect(
      guarded("https://descomplicapro.com.br/api/inventory", { method: "POST" }),
    ).rejects.toThrow("qa_inventory_method_blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves local auth requests and refuses redirect escape", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const origin = "http://127.0.0.1:54321";
    const guarded = createQaInventoryFetch({
      appOrigin: origin,
      supabaseOrigin: origin,
      upstreamOrigin: origin,
      fetchImpl,
    });
    const request = new Request(`${origin}/auth/v1/token`, {
      method: "POST",
      body: "synthetic",
      headers: { apikey: "synthetic" },
    });
    await guarded(request, { redirect: "follow" });
    expect(fetchImpl.mock.calls[0]).toEqual([request, { redirect: "error" }]);
    const server = createServer((_, response) => {
      response.writeHead(302, { location: "https://blocked.invalid/" }).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No loopback port");
    const redirectOrigin = `http://127.0.0.1:${address.port}`;
    try {
      const realGuard = createQaInventoryFetch({
        appOrigin: redirectOrigin,
        supabaseOrigin: redirectOrigin,
        upstreamOrigin: redirectOrigin,
      });
      await expect(realGuard(redirectOrigin)).rejects.toThrow();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("keeps real inventory-route denials before and after cache warmup (auth stub only)", async () => {
    const upstream = await startSyntheticInventoryUpstream();
    const guarded = createQaInventoryFetch({
      appOrigin: upstream.origin,
      supabaseOrigin: upstream.origin,
      upstreamOrigin: upstream.origin,
      fetchImpl: (input: string | URL | Request, init?: RequestInit) => {
        // Independent boundary: this test cannot contact production even if the adapter regresses.
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        expect(url.origin).toBe(upstream.origin);
        return nativeFetch(input, init);
      },
    });
    vi.stubGlobal("fetch", guarded);
    try {
      const { GET } = await import("@/app/api/inventory/route");
      for (const [status, error] of [
        [401, "unauthenticated"],
        [403, "forbidden"],
      ] as const) {
        authorize.mockResolvedValue({ ok: false, response: Response.json({ error }, { status }) });
        expect((await GET()).status).toBe(status);
      }
      expect(upstream.requestCount()).toBe(0);
      authorize.mockResolvedValue({ ok: true, context: { roleKey: "master" } });
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toMatchObject({
        count: 3301,
        sourceKind: "live",
        qaFixture: { synthetic: true },
      });
      expect(upstream.requestCount()).toBe(1);
      for (const [status, error] of [
        [401, "unauthenticated"],
        [403, "forbidden"],
      ] as const) {
        authorize.mockResolvedValue({ ok: false, response: Response.json({ error }, { status }) });
        const denied = await GET();
        expect(denied.status).toBe(status);
        expect(await denied.json()).toEqual({ error });
      }
      expect(upstream.requestCount()).toBe(1);
      expect(authorize).toHaveBeenCalledTimes(5);
    } finally {
      await upstream.close();
    }
  });

  it("verifies the fixture and loads the actual QA preload in an isolated Node process", async () => {
    const upstream = await startSyntheticInventoryUpstream();
    try {
      await verifySyntheticInventoryUpstream(upstream.origin);
      const child = await execute(
        process.execPath,
        [
          "--import",
          new URL("../scripts/qa/concurrent-inventory-preload.mjs", import.meta.url).href,
          "--input-type=module",
          "-e",
          'const response = await fetch(process.env.QA_CONCURRENT_INVENTORY_ORIGIN + "/api/inventory"); const body = await response.json(); console.log(JSON.stringify({ count: body.count, synthetic: body.qaFixture.synthetic }));',
        ],
        {
          timeout: 10_000,
          env: {
            PATH: process.env.PATH,
            SYSTEMROOT: process.env.SYSTEMROOT,
            NODE_ENV: "test",
            QA_E2E_LOCAL_ONLY: "true",
            AUTH_LOCAL_INSECURE_LOOPBACK_QA: "true",
            APP_ORIGIN: upstream.origin,
            SUPABASE_URL: upstream.origin,
            QA_CONCURRENT_INVENTORY_ORIGIN: upstream.origin,
          },
        },
      );
      expect(JSON.parse(child.stdout)).toEqual({ count: 3301, synthetic: true });
      expect(upstream.requestCount()).toBe(3);
    } finally {
      await upstream.close();
    }
  });

  it("rejects nonsynthetic feeds before installation", async () => {
    await expect(
      verifySyntheticInventoryUpstream("http://127.0.0.1:4174", async () =>
        Response.json({ count: 3301, items: [], qaFixture: { synthetic: true } }),
      ),
    ).rejects.toThrow("upstream_not_synthetic");
  });

  it.each([
    "HOMOLOGATION_MODE",
    "QA_E2E_REMOTE_HOMOLOGATION",
    "QA_SUPABASE_WORKDIR",
    "QA_RELEASE_PERSIST_ACCOUNTS_FILE",
  ])("rejects nonisolated environment %s", (name) => {
    expect(() => assertLocalQaEnvironment({ [name]: "true" })).toThrow("local_ci_only");
    expect(() => assertLocalQaEnvironment({})).not.toThrow();
  });

  it("never accepts a remote mock origin", () => {
    expect(() =>
      createQaInventoryFetch({
        appOrigin: "http://127.0.0.1:4173",
        supabaseOrigin: "http://127.0.0.1:54321",
        upstreamOrigin: "https://production.invalid",
      }),
    ).toThrow("invalid_local_origin");
  });
});
