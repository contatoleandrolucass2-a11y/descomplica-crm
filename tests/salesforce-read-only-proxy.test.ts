import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock("@/lib/auth/supabase/middleware", () => ({ updateSession: mocks.updateSession }));
import { proxy } from "@/proxy";

const origin = "https://crm.example.test";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("HOMOLOGATION_MODE", "false");
  mocks.updateSession.mockReset();
  mocks.updateSession.mockImplementation(async () => {
    const response = NextResponse.next();
    response.cookies.set("synthetic-rotation", "refreshed");
    return { response, supabase: {} };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Salesforce read-only probe proxy boundary", () => {
  it.each(["/api/salesforce/console/authorize", "/api/meta-ads/console/authorize"])(
    "skips refresh only for the probe %s while retaining transport and cache headers",
    async (path) => {
      const response = await proxy(new NextRequest(`${origin}${path}`));
      expect(mocks.updateSession).not.toHaveBeenCalled();
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.has("set-cookie")).toBe(false);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(response.headers.get("strict-transport-security")).toContain("max-age=");
    },
  );

  it.each([
    ["/api/salesforce/console", "POST"],
    ["/api/meta-ads/console", "POST"],
    ["/api/meta-ads/status", "GET"],
    ["/api/meta-ads/console/authorize-other", "GET"],
    ["/api/meta-ads/console/authorize/child", "GET"],
    ["/api/salesforce/status", "GET"],
    ["/api/salesforce/console/authorize-other", "GET"],
    ["/api/salesforce/console/authorize/child", "GET"],
  ])("preserves normal refresh for %s", async (path, method) => {
    const request = new NextRequest(`${origin}${path}`, { method });
    const response = await proxy(request);
    expect(mocks.updateSession).toHaveBeenCalledWith(request, { deferResponseAuthCookies: false });
    expect(response.headers.get("set-cookie")).toContain("synthetic-rotation=refreshed");
  });
});
