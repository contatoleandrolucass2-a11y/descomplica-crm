import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QlikRankingV2 } from "@/lib/crm/qlik/contracts-v2";

const { createClient, rpc, abortSignal } = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  abortSignal: vi.fn(),
}));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient }));
import { loadQlikRankingV2 } from "@/lib/crm/qlik/data-v2";

function snapshot(): QlikRankingV2 {
  const cube = {
    coverage: { state: "complete" as const, sourceRows: 0 },
    nativeTotals: { vgv: "0.00", contracts: 0 },
    rows: [],
  };
  return {
    schemaVersion: 2,
    batchId: "9f37407b-251c-43f3-8370-01b49e37ac40",
    requestId: "e0cfacb3-ea4b-4ca8-9587-a449e7dec1d3",
    startedAt: "2026-10-14T10:00:00Z",
    completedAt: "2026-10-14T10:10:00Z",
    source: {
      appId: "7c000871-8b32-4c0f-bfd5-4b9d46946575",
      sheetId: "772db774-0bc2-42d8-ac11-3e4917bd0d37",
      mappingSha256: "a".repeat(64),
      reloadTimestamp: "2026-10-14T09:00:00Z",
    },
    scope: { businessUnit: "Direcional", regional: "SP CAPITAL", channel: "CANAL IMOB" },
    months: [{ periodMonth: "2026-01-01", imobs: cube, developments: structuredClone(cube) }],
  };
}

function envelope() {
  return {
    current: snapshot(),
    previous: null as QlikRankingV2 | null,
    publishedAt: "2026-10-14T10:15:00.000001Z" as string | null,
    availableYears: [2026, 2025],
  };
}

describe("authenticated Qlik v2 reader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-14T12:00:00Z");
    vi.resetAllMocks();
    createClient.mockResolvedValue({ rpc });
    rpc.mockReturnValue({ abortSignal });
    abortSignal.mockResolvedValue({ data: envelope(), error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("uses a new session client and only the versioned RPC, with nullable year and timeout", async () => {
    const result = await loadQlikRankingV2();
    expect(result.status).toBe("ready");
    expect(createClient).toHaveBeenCalledExactlyOnceWith();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_qlik_ranking_v2", { p_year: null });
    expect(abortSignal.mock.calls[0]![0]).toBeInstanceOf(AbortSignal);
    await loadQlikRankingV2(2026);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("get_qlik_ranking_v2", { p_year: 2026 });
  });

  it("preserves current and previous only after strict validation", async () => {
    const data = envelope();
    data.previous = snapshot();
    data.previous.batchId = "bf2b6c33-cad4-4053-864c-a1605a5c3f47";
    data.previous.requestId = "915709b0-ecf2-430d-b5d6-a48e444d0ad7";
    abortSignal.mockResolvedValue({ data, error: null });
    expect(await loadQlikRankingV2()).toEqual({ status: "ready", ...data });
  });

  it("distinguishes no publication from failure", async () => {
    abortSignal.mockResolvedValue({
      data: { current: null, previous: null, publishedAt: null, availableYears: [] },
      error: null,
    });
    expect(await loadQlikRankingV2()).toEqual({ status: "empty", availableYears: [] });
  });

  it("retains other published years when the selected year is empty", async () => {
    abortSignal.mockResolvedValue({
      data: { current: null, previous: null, publishedAt: null, availableYears: [2026] },
      error: null,
    });
    expect(await loadQlikRankingV2(2025)).toEqual({ status: "empty", availableYears: [2026] });
    expect(await loadQlikRankingV2()).toEqual({ status: "unavailable" });
  });

  it.each([2019, 2101, NaN, Infinity, 2026.5])(
    "rejects invalid year %s without database access",
    async (year) => {
      expect(await loadQlikRankingV2(year)).toEqual({ status: "unavailable" });
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each(["missing_rpc", "permission_denied", "timeout"])(
    "fails closed on %s without exposing the error",
    async (code) => {
      abortSignal.mockResolvedValue({
        data: envelope(),
        error: { code, message: "private synthetic diagnostic" },
      });
      expect(await loadQlikRankingV2()).toEqual({ status: "unavailable" });
    },
  );

  it("fails closed on rejected client/RPC promises", async () => {
    createClient.mockRejectedValueOnce(new Error("session config"));
    expect(await loadQlikRankingV2()).toEqual({ status: "unavailable" });
    abortSignal.mockRejectedValueOnce(new Error("network"));
    expect(await loadQlikRankingV2()).toEqual({ status: "unavailable" });
  });

  it.each([
    "extra",
    "scope",
    "totals",
    "previous",
    "years",
    "year_order",
    "published",
    "future",
    "version",
  ])("rejects malformed %s", async (problem) => {
    const data = envelope();
    if (problem === "extra") Object.assign(data, { secret: "not allowed" });
    if (problem === "scope") Object.assign(data.current.scope, { channel: "OTHER" });
    if (problem === "totals") data.current.months[0]!.imobs.nativeTotals.vgv = "1.00";
    if (problem === "previous") data.previous = snapshot();
    if (problem === "years") data.availableYears = [2026, 2026];
    if (problem === "year_order") data.availableYears = [2025, 2026];
    if (problem === "published") data.publishedAt = null;
    if (problem === "future") data.publishedAt = "2027-01-01T00:00:00Z";
    if (problem === "version") Object.assign(data.current, { schemaVersion: 1 });
    abortSignal.mockResolvedValue({ data, error: null });
    expect(await loadQlikRankingV2()).toEqual({ status: "unavailable" });
  });

  it("rejects an RPC snapshot from another year", async () => {
    expect(await loadQlikRankingV2(2025)).toEqual({ status: "unavailable" });
  });

  it.each([
    ["2026-10-14T10:05:00.000000Z", "ready"],
    ["2026-10-14T10:04:59.999999Z", "unavailable"],
    ["2026-10-14T12:05:00.000000Z", "ready"],
    ["2026-10-14T12:05:00.000001Z", "unavailable"],
  ])("applies the exact five-minute publication tolerance at %s", async (publishedAt, status) => {
    const data = envelope();
    data.publishedAt = publishedAt;
    abortSignal.mockResolvedValue({ data, error: null });
    expect((await loadQlikRankingV2()).status).toBe(status);
  });

  it("keeps a legitimate skewed publication readable after clocks advance", async () => {
    const data = envelope();
    data.current.completedAt = "2026-10-14T12:05:00Z";
    data.publishedAt = "2026-10-14T12:00:00Z";
    abortSignal.mockResolvedValue({ data, error: null });
    expect((await loadQlikRankingV2()).status).toBe("ready");
    vi.setSystemTime("2026-10-15T12:00:00Z");
    expect((await loadQlikRankingV2()).status).toBe("ready");
  });
});
