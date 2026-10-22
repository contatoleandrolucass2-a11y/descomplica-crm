import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), fetchData: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/crm/meta-ads/marketing-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/crm/meta-ads/marketing-api")>();
  return { ...original, fetchMetaAdsDashboardData: mocks.fetchData };
});

import { GET } from "@/app/api/meta-ads/data/route";
import { MetaAdsApiError } from "@/lib/crm/meta-ads/marketing-api";

beforeEach(() => {
  mocks.authorize.mockResolvedValue({ ok: true, context: {} });
  mocks.fetchData.mockResolvedValue({ source: "meta_marketing_api", rows: [{ rowId: "1" }] });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("Meta Ads data API", () => {
  it("requires the existing Meta dashboard authorization and disables caching", async () => {
    const response = await GET();
    expect(mocks.authorize).toHaveBeenCalledWith("/app/meta-ads");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      source: "meta_marketing_api",
      rows: [{ rowId: "1" }],
    });
  });

  it.each([401, 403])("preserves authentication denials (%s)", async (status) => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "denied" }, { status }),
    });
    expect((await GET()).status).toBe(status);
    expect(mocks.fetchData).not.toHaveBeenCalled();
  });

  it("returns a sanitized unavailable response without leaking provider details", async () => {
    mocks.fetchData.mockRejectedValue(new MetaAdsApiError("authentication", 503));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toEqual({ error: "meta_ads_unavailable" });
  });
});
