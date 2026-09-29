import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noStoreHeaders } from "@/lib/security/api";

const mocks = vi.hoisted(() => ({
  authorizeRoute: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));

let GET: typeof import("@/app/api/inventory/route").GET;

const unit = {
  id: "unit-1",
  businessUnit: "Direcional",
  project: "Synthetic project",
  product: "Apartamento A-101",
};
const validPayload = {
  source: "synthetic-live-source",
  generatedAt: "2026-09-28T12:00:00.000Z",
  count: 1,
  items: [unit],
};

function expectNoStore(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
}

function deferredFetch() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  ({ GET } = await import("@/app/api/inventory/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("inventory route authorization", () => {
  it("does not query or expose inventory when the user lacks simulator access", async () => {
    mocks.authorizeRoute.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "unauthenticated" }, { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("reuses validated stock for 30 seconds with authorization and private no-store responses", async () => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true, context: {} });
    mocks.fetch.mockResolvedValue(Response.json(validPayload, { status: 200 }));

    const response = await GET();

    expect(mocks.authorizeRoute).toHaveBeenCalledWith("crm.simulators.view");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ count: 1 });
    expect(response.headers.get("x-inventory-cache")).toBe("MISS");
    expect(response.headers.get("server-timing")).toMatch(/auth;dur=\d/);

    vi.advanceTimersByTime(29_000);
    const warm = await GET();
    expect(warm.headers.get("x-inventory-cache")).toBe("HIT");
    expect(warm.headers.get("x-inventory-cache-age")).toBe("29");
    expect(warm.headers.get("cache-control")).toContain("no-store");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(2);

    mocks.fetch.mockResolvedValue(Response.json({ count: 0, items: [] }));
    vi.advanceTimersByTime(1_000);
    const refreshed = await GET();
    expect(refreshed.headers.get("x-inventory-cache")).toBe("MISS");
    await expect(refreshed.json()).resolves.toMatchObject({ count: 0 });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("never exposes a warm cache to a user who lost permission", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockResolvedValue(Response.json(validPayload));
    await GET();
    mocks.authorizeRoute.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    });
    const denied = await GET();
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({ error: "forbidden" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("authorizes 20 cold, in-flight and warm requests while sharing one upstream fetch", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    const pending = deferredFetch();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    const requests = Array.from({ length: 20 }, () => GET());
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const inFlight = Array.from({ length: 20 }, () => GET());
    await vi.waitFor(() => expect(mocks.authorizeRoute).toHaveBeenCalledTimes(40));
    pending.resolve(Response.json(validPayload));
    const responses = await Promise.all([...requests, ...inFlight]);
    expect(responses.map((response) => response.headers.get("x-inventory-cache"))).toEqual([
      "MISS",
      ...Array(39).fill("COALESCED"),
    ]);

    const warm = await Promise.all(Array.from({ length: 20 }, () => GET()));
    expect(warm.map((response) => response.headers.get("x-inventory-cache"))).toEqual(
      Array(20).fill("HIT"),
    );
    for (const response of [...responses, ...warm]) {
      expect(response.status).toBe(200);
      expectNoStore(response);
      await expect(response.json()).resolves.toEqual(validPayload);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.authorizeRoute.mock.calls).toEqual(
      Array.from({ length: 60 }, () => ["crm.simulators.view"]),
    );
  });

  it.each([401, 403])(
    "denies 20 requests with %i on cold, in-flight and warm caches",
    async (status) => {
      const error = status === 401 ? "unauthenticated" : "forbidden";
      mocks.authorizeRoute.mockImplementation(async () => ({
        ok: false,
        response: Response.json({ error }, { status, headers: noStoreHeaders() }),
      }));
      const checkDenied = async () => {
        const responses = await Promise.all(Array.from({ length: 20 }, () => GET()));
        for (const response of responses) {
          expect(response.status).toBe(status);
          expectNoStore(response);
          expect(response.headers.get("x-inventory-cache")).toBeNull();
          expect(response.headers.get("x-inventory-cache-age")).toBeNull();
          await expect(response.json()).resolves.toEqual({ error });
        }
      };

      await checkDenied();
      expect(mocks.fetch).not.toHaveBeenCalled();

      const pending = deferredFetch();
      mocks.fetch.mockReturnValueOnce(pending.promise);
      mocks.authorizeRoute.mockResolvedValueOnce({ ok: true });
      const allowed = GET();
      await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
      // Denied callers must finish before the authorized upstream request resolves.
      await checkDenied();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      pending.resolve(Response.json(validPayload));
      expect((await allowed).status).toBe(200);

      await checkDenied();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      expect(mocks.authorizeRoute.mock.calls).toEqual(
        Array.from({ length: 61 }, () => ["crm.simulators.view"]),
      );
    },
  );

  it.each([
    null,
    false,
    [],
    "invalid",
    {},
    { count: 2, items: [] },
    { count: 0, items: null },
    { count: 0, items: {} },
    ...[undefined, null, false, true, "", " ", [], {}, -1, 0.5, "invalid"].map((count) => ({
      count,
      items: count === true ? [unit] : [],
    })),
    ...[null, false, true, 0, 1, "unit", [], [unit]].map((item) => ({
      count: 1,
      items: [item],
    })),
    ...["id", "businessUnit", "project", "product"].flatMap((field) =>
      [undefined, null, false, 1, [], {}].map((value) => ({
        count: 1,
        items: [{ ...unit, [field]: value }],
      })),
    ),
    { count: 2, items: [unit, null] },
  ])("does not cache an invalid upstream payload: %j", async (payload) => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockResolvedValueOnce(Response.json(payload));
    const failed = await GET();
    expect(failed.status).toBe(502);
    expectNoStore(failed);
    expect(failed.headers.get("x-inventory-cache")).toBeNull();
    await expect(failed.json()).resolves.toEqual({ error: "inventory_payload_invalid" });
    mocks.fetch.mockResolvedValueOnce(Response.json(validPayload));
    const cooldown = await GET();
    expect(cooldown.status).toBe(502);
    await expect(cooldown.json()).resolves.toEqual({ error: "inventory_payload_invalid" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    const retry = await GET();
    expect(retry.status).toBe(200);
    expect(retry.headers.get("x-inventory-cache")).toBe("MISS");
    await expect(retry.json()).resolves.toEqual(validPayload);
    const warm = await GET();
    expect(warm.headers.get("x-inventory-cache")).toBe("HIT");
    await expect(warm.json()).resolves.toEqual(validPayload);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([0, "0", 1, "1"])("preserves compatible numeric counts: %j", async (count) => {
    const payload = { ...validPayload, count, items: Number(count) === 0 ? [] : [unit] };
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockResolvedValueOnce(Response.json(payload));
    for (const cache of ["MISS", "HIT"]) {
      const response = await GET();
      expect(response.status).toBe(200);
      expectNoStore(response);
      expect(response.headers.get("x-inventory-cache")).toBe(cache);
      await expect(response.json()).resolves.toEqual(payload);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves optional null fields and upstream commercial data without normalization", async () => {
    const payload = {
      ...validPayload,
      items: [
        {
          ...unit,
          identifier: null,
          plant: null,
          finalPrice: null,
          finalWithKit: 300_000,
          unitBonus: 10_000,
          tableSlack: 5_000,
          completionDate: null,
        },
      ],
    };
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockResolvedValueOnce(Response.json(payload));
    for (const cache of ["MISS", "HIT"]) {
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("x-inventory-cache")).toBe(cache);
      await expect(response.json()).resolves.toEqual(payload);
    }
  });

  it("shares an invalid payload across 20 requests and retries once before warming the cache", async () => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    const invalid = deferredFetch();
    mocks.fetch.mockReturnValueOnce(invalid.promise);
    const requests = Array.from({ length: 20 }, () => GET());
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    invalid.resolve(Response.json({ count: 1, items: [null] }));
    for (const response of await Promise.all(requests)) {
      expect(response.status).toBe(502);
      expectNoStore(response);
      expect(response.headers.get("x-inventory-cache")).toBeNull();
      await expect(response.json()).resolves.toEqual({ error: "inventory_payload_invalid" });
    }

    const valid = deferredFetch();
    mocks.fetch.mockReturnValueOnce(valid.promise);
    vi.advanceTimersByTime(5_000);
    const retries = Array.from({ length: 20 }, () => GET());
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    valid.resolve(Response.json(validPayload));
    const recovered = await Promise.all(retries);
    expect(recovered.map((response) => response.headers.get("x-inventory-cache"))).toEqual([
      "MISS",
      ...Array(19).fill("COALESCED"),
    ]);
    const warm = await GET();
    expect(warm.headers.get("x-inventory-cache")).toBe("HIT");
    for (const response of [...recovered, warm]) {
      expect(response.status).toBe(200);
      expectNoStore(response);
      await expect(response.json()).resolves.toEqual(validPayload);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(41);
  });

  it("fails closed when the expired cache cannot be refreshed", async () => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockResolvedValueOnce(Response.json(validPayload));
    await GET();
    vi.advanceTimersByTime(30_000);
    mocks.fetch.mockRejectedValueOnce(new Error("network error"));
    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "inventory_unreachable" });
  });

  it("bounds successive failure retries and shares recovery after the cooldown", async () => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockRejectedValue(new Error("synthetic upstream failure"));

    for (let index = 0; index < 20; index += 1) {
      const response = await GET();
      expect(response.status).toBe(502);
      expectNoStore(response);
      expect(response.headers.get("retry-after")).toBe("5");
      await expect(response.json()).resolves.toEqual({ error: "inventory_unreachable" });
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4_999);
    expect((await GET()).headers.get("retry-after")).toBe("1");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    mocks.authorizeRoute.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    });
    const denied = await GET();
    expect(denied.status).toBe(403);
    expect(denied.headers.get("retry-after")).toBeNull();

    vi.advanceTimersByTime(1);
    const pending = deferredFetch();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    const recovery = Array.from({ length: 20 }, () => GET());
    await Promise.resolve();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    pending.resolve(Response.json(validPayload));
    for (const response of await Promise.all(recovery)) {
      expect(response.status).toBe(200);
      expect(response.headers.get("retry-after")).toBeNull();
      await expect(response.json()).resolves.toEqual(validPayload);
    }
    expect((await GET()).headers.get("x-inventory-cache")).toBe("HIT");
    expect(mocks.authorizeRoute).toHaveBeenCalledTimes(43);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the shared upstream request alive when one caller disconnects", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    const pending = deferredFetch();
    mocks.fetch.mockReturnValueOnce(pending.promise);
    const controller = new AbortController();
    const disconnected: Promise<Response> = Reflect.apply(GET, undefined, [
      new Request("http://localhost/api/inventory", { signal: controller.signal }),
    ]);
    const waiting = GET();
    await Promise.resolve();
    const upstreamSignal = mocks.fetch.mock.calls[0]?.[1]?.signal as AbortSignal | undefined;
    controller.abort();
    expect(upstreamSignal?.aborted).toBe(false);
    pending.resolve(Response.json(validPayload));
    await disconnected;
    await expect((await waiting).json()).resolves.toEqual(validPayload);
    expect((await GET()).headers.get("x-inventory-cache")).toBe("HIT");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["headers", "body"])("limits shared upstream %s waits to 20 seconds", async (phase) => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockImplementationOnce((delay) => {
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), delay);
      return controller.signal;
    });
    if (phase === "headers") {
      mocks.fetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            controller.signal.addEventListener("abort", () => reject(controller.signal.reason));
          }),
      );
    } else {
      mocks.fetch.mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(stream) {
              controller.signal.addEventListener("abort", () =>
                stream.error(controller.signal.reason),
              );
            },
          }),
        ),
      );
    }
    const responses: Response[] = [];
    const pending = Promise.all(
      Array.from({ length: 20 }, async () => responses.push(await GET())),
    );
    await vi.advanceTimersByTimeAsync(19_999);
    expect(responses).toHaveLength(0);
    expect(AbortSignal.timeout).toHaveBeenCalledExactlyOnceWith(20_000);
    await vi.advanceTimersByTimeAsync(1);
    expect(responses).toHaveLength(20);
    await pending;
    for (const response of responses) {
      expect(response.status).toBe(502);
      expectNoStore(response);
      expect(response.headers.get("retry-after")).toBe("5");
      await expect(response.json()).resolves.toEqual({ error: "inventory_unreachable" });
    }
    expect((await GET()).status).toBe(502);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    mocks.fetch.mockResolvedValueOnce(Response.json(validPayload));
    expect((await GET()).status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
