import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRoute: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));

let GET: typeof import("@/app/api/inventory/route").GET;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  ({ GET } = await import("@/app/api/inventory/route"));
});

afterEach(() => {
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
    mocks.fetch.mockResolvedValue(
      Response.json({ count: 1, items: [{ id: "unit-1" }] }, { status: 200 }),
    );

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
    mocks.fetch.mockResolvedValue(Response.json({ count: 1, items: [{ id: "unit-1" }] }));
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

  it("shares one upstream request between concurrent authorized users", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    let resolveFetch!: (response: Response) => void;
    mocks.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const requests = [GET(), GET(), GET()];
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    resolveFetch(Response.json({ count: 0, items: [] }));
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.headers.get("x-inventory-cache"))).toEqual([
      "MISS",
      "COALESCED",
      "COALESCED",
    ]);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      { count: 0, items: [] },
      { count: 0, items: [] },
      { count: 0, items: [] },
    ]);
  });

  it.each([null, { count: 2, items: [] }])(
    "does not cache an invalid upstream payload: %j",
    async (payload) => {
      mocks.authorizeRoute.mockResolvedValue({ ok: true });
      mocks.fetch.mockResolvedValueOnce(Response.json(payload));
      const failed = await GET();
      expect(failed.status).toBe(502);
      await expect(failed.json()).resolves.toEqual({ error: "inventory_payload_invalid" });
      mocks.fetch.mockResolvedValueOnce(Response.json({ count: 0, items: [] }));
      expect((await GET()).status).toBe(200);
      expect(mocks.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("fails closed when the expired cache cannot be refreshed", async () => {
    vi.useFakeTimers();
    mocks.authorizeRoute.mockResolvedValue({ ok: true });
    mocks.fetch.mockResolvedValueOnce(Response.json({ count: 1, items: [{ id: "old" }] }));
    await GET();
    vi.advanceTimersByTime(30_000);
    mocks.fetch.mockRejectedValueOnce(new Error("network error"));
    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "inventory_unreachable" });
  });
});
