import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRoute: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/security/route-auth", () => ({ authorizeRoute: mocks.authorizeRoute }));

import { GET } from "@/app/api/inventory/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

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

  it("returns validated inventory without cache only after authorization", async () => {
    mocks.authorizeRoute.mockResolvedValue({ ok: true, context: {} });
    mocks.fetch.mockResolvedValue(
      Response.json({ count: 1, items: [{ id: "unit-1" }] }, { status: 200 }),
    );

    const response = await GET();

    expect(mocks.authorizeRoute).toHaveBeenCalledWith("crm.simulators.view");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toMatchObject({ count: 1 });
  });
});
