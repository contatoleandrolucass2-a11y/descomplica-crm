import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), probeApi: vi.fn() }));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/crm/meta-ads/marketing-api", () => ({ probeMetaAdsApi: mocks.probeApi }));
import { GET, POST } from "@/app/api/meta-ads/status/route";
import { getMetaAdsStatusConfiguration } from "@/lib/crm/meta-ads/config";
import { MetaAdsConnectionState } from "@/lib/crm/meta-ads/connection-state";
import {
  META_ADS_ACCOUNT_ID,
  META_ADS_BUSINESS_ID,
  metaAdsObservationSchema,
  metaAdsConnectionSnapshotSchema,
  type MetaAdsObservation,
} from "@/lib/crm/meta-ads/connection-contract";
const now = Date.parse("2026-10-16T12:00:00Z");
let secret = "synthetic-meta-status-secret-not-used-remotely";
function observation(overrides: Partial<MetaAdsObservation> = {}): MetaAdsObservation {
  return {
    version: 1,
    accountId: META_ADS_ACCOUNT_ID,
    businessId: META_ADS_BUSINESS_ID,
    observedAt: new Date(now).toISOString(),
    state: "connected",
    ...overrides,
  };
}
function request(body: unknown, token = secret) {
  return new Request("https://crm.example.test/api/meta-ads/status", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  secret += "x";
  vi.stubEnv("META_ADS_STATUS_ENABLED", "true");
  vi.stubEnv("META_ADS_STATUS_SECRET", secret);
  vi.stubEnv("META_ADS_API_ENABLED", "false");
  mocks.authorize.mockResolvedValue({ ok: true, context: {} });
  mocks.probeApi.mockResolvedValue({ accountName: "Superitendente Leandro", currency: "BRL" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Meta Ads session evidence", () => {
  it("requires fresh evidence after configuration, restart or key rotation", () => {
    const state = new MetaAdsConnectionState();
    expect(state.snapshot(secret, now).state).toBe("waiting");
    expect(state.accept(observation(), secret, now)).toBe("accepted");
    expect(state.snapshot(secret, now + 119_999).state).toBe("connected");
    expect(state.snapshot(secret, now + 120_000).state).toBe("stale");
    expect(state.snapshot(secret, now - 1).state).toBe("stale");
    expect(state.snapshot(secret + "rotated", now).state).toBe("waiting");
  });
  it("rejects replay and out-of-window timestamps without replacing evidence", () => {
    const state = new MetaAdsConnectionState();
    state.accept(observation(), secret, now);
    expect(state.accept(observation({ state: "unavailable" }), secret, now)).toBe("out_of_order");
    for (const offset of [-60_001, 5_001]) {
      expect(
        state.accept(
          observation({ observedAt: new Date(now + offset).toISOString() }),
          secret,
          now,
        ),
      ).toBe("invalid_time");
    }
    expect(state.snapshot(secret, now).state).toBe("connected");
  });
  it("pins the account and rejects secrets, campaign data and unknown states", () => {
    for (const input of [
      { ...observation(), accountId: "123" },
      { ...observation(), businessId: "123" },
      { ...observation(), password: "private" },
      { ...observation(), campaigns: [] },
      { ...observation(), state: "published" },
      { ...observation(), observedAt: "invalid" },
    ]) {
      expect(metaAdsObservationSchema.safeParse(input).success).toBe(false);
      expect(new MetaAdsConnectionState().accept(input, secret, now)).toBe("invalid_payload");
    }
    expect(
      metaAdsConnectionSnapshotSchema.safeParse({
        state: "connected",
        accountId: META_ADS_ACCOUNT_ID,
        businessId: META_ADS_BUSINESS_ID,
        checkedAt: null,
        receivedAt: null,
      }).success,
    ).toBe(false);
  });
  it("preserves negative observations and isolates mutable inputs", () => {
    const state = new MetaAdsConnectionState();
    const input = observation({ state: "wrong_account" });
    state.accept(input, secret, now);
    input.state = "connected";
    expect(state.snapshot(secret, now).state).toBe("wrong_account");
    state.accept(
      observation({ state: "reauth_required", observedAt: new Date(now + 1).toISOString() }),
      secret,
      now + 1,
    );
    expect(state.snapshot(secret, now + 1).state).toBe("reauth_required");
  });
  it("separates disabled and incomplete configuration", () => {
    expect(getMetaAdsStatusConfiguration({})).toEqual({ enabled: false, available: false });
    for (const value of ["", "short", "x".repeat(257), "x".repeat(40) + "\n"]) {
      expect(
        getMetaAdsStatusConfiguration({
          META_ADS_STATUS_ENABLED: "true",
          META_ADS_STATUS_SECRET: value,
        }),
      ).toEqual({ enabled: true, available: false });
    }
  });
});

describe("Meta Ads status API", () => {
  it("reports connected from the official read-only API when it is enabled", async () => {
    vi.stubEnv("META_ADS_API_ENABLED", "true");
    vi.stubEnv("META_ADS_ACCESS_TOKEN", "t".repeat(80));
    vi.stubEnv("META_ADS_ACCOUNT_ID", META_ADS_ACCOUNT_ID);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.probeApi).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({
      state: "connected",
      accountId: META_ADS_ACCOUNT_ID,
      businessId: META_ADS_BUSINESS_ID,
      checkedAt: new Date(now).toISOString(),
      receivedAt: new Date(now).toISOString(),
    });
  });
  it.each([401, 403])("requires management permission for read (%s)", async (status) => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "denied" }, { status }),
    });
    expect((await GET()).status).toBe(status);
    expect(mocks.authorize).toHaveBeenCalledWith("/app/configuracoes/conectar-sistemas");
  });
  it("never accepts a browser session in place of the dedicated machine secret", async () => {
    expect((await POST(request(observation(), "user-session"))).status).toBe(401);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("returns disabled or unavailable without claiming connected", async () => {
    vi.stubEnv("META_ADS_STATUS_ENABLED", "false");
    expect((await POST(request(observation()))).status).toBe(404);
    expect(await (await GET()).json()).toMatchObject({ state: "unconfigured" });
    vi.stubEnv("META_ADS_STATUS_ENABLED", "true");
    vi.stubEnv("META_ADS_STATUS_SECRET", "");
    expect((await POST(request(observation()))).status).toBe(503);
    expect(await (await GET()).json()).toMatchObject({ state: "unavailable" });
  });
  it("accepts a receipt and exposes only sanitized, uncached status", async () => {
    expect((await POST(request(observation()))).status).toBe(202);
    const response = await GET();
    const value = await response.json();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(value).toEqual({
      accountId: META_ADS_ACCOUNT_ID,
      businessId: META_ADS_BUSINESS_ID,
      state: "connected",
      checkedAt: new Date(now).toISOString(),
      receivedAt: new Date(now).toISOString(),
    });
    expect(JSON.stringify(value)).not.toContain(secret);
    expect((await POST(request(observation()))).status).toBe(409);
  });
  it("rejects extra fields, media types and oversized chunked bodies", async () => {
    expect((await POST(request({ ...observation(), password: "private" }))).status).toBe(400);
    const wrongType = request(observation());
    wrongType.headers.set("content-type", "text/plain");
    expect((await POST(wrongType)).status).toBe(415);
    expect((await POST(request("x".repeat(4097)))).status).toBe(413);
    const declared = request(observation());
    declared.headers.set("content-length", "4097");
    expect((await POST(declared)).status).toBe(413);
  });
  it("bounds a body that never completes", async () => {
    const slow = new Request("https://crm.example.test/api/meta-ads/status", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: new ReadableStream(),
      duplex: "half",
    } as RequestInit);
    const result = POST(slow);
    await vi.advanceTimersByTimeAsync(5001);
    expect((await result).status).toBe(400);
  });
});
