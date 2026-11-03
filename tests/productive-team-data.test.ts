import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));

import { loadProductiveTeamReadModel } from "@/lib/crm/stages/productive-team-data";

const fixture = () => ({
  generatedAt: "2026-11-01T18:00:00Z",
  availableStages: ["appointments", "visits", "folders", "sales"],
  brokerRoster: [
    { key: "synthetic-broker", owner: "Corretor Sintético", manager: "Gerente Sintético" },
  ],
  analysis: {
    version: 4,
    viewKey: "all",
    referenceDate: "2026-11-01",
    coverageStart: "2026-10-01",
    brokerCount: 1,
    brokerManagerCount: 1,
    dimensions: { managers: [], owners: [], companies: [], developments: [], stores: [] },
    facts: [[4, "2026-11-01", -1, -1, -1, 1, -1, 1, 0, 0, -1]],
    appointments: [],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: fixture(), error: null });
});

describe("productive team authorized read", () => {
  it("reads one atomic RPC without stage goals or direct table access", async () => {
    expect(await loadProductiveTeamReadModel("all")).toEqual(fixture());
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_crm_productive_team", {
      p_view_key: "all",
    });
  });

  it.each(["PGRST202", "42883"])("keeps unactivated RPC unavailable (%s)", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } });
    expect(await loadProductiveTeamReadModel("all")).toEqual({
      analysis: null,
      brokerRoster: null,
      availableStages: [],
    });
  });

  it("does not hide database permission failures as an empty team", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(loadProductiveTeamReadModel("all")).rejects.toThrow("Não foi possível");
  });

  it("keeps denied or absent data unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await loadProductiveTeamReadModel("all")).analysis).toBeNull();
  });

  it("accepts a real empty source and an unavailable roster independently", async () => {
    const payload = fixture();
    payload.analysis.facts = [];
    mocks.rpc.mockResolvedValue({ data: { ...payload, brokerRoster: null }, error: null });
    const result = await loadProductiveTeamReadModel("all");
    expect(result.analysis?.facts).toEqual([]);
    expect(result.availableStages).toHaveLength(4);
    expect(result.brokerRoster).toBeNull();
  });

  it.each([
    (payload: ReturnType<typeof fixture>) => {
      payload.analysis.viewKey = "without_canal_imob";
    },
    (payload: ReturnType<typeof fixture>) => {
      payload.analysis.version = 3;
    },
    (payload: ReturnType<typeof fixture>) => {
      payload.availableStages = ["appointments"];
    },
    (payload: ReturnType<typeof fixture>) => {
      payload.availableStages.push("sales");
    },
    (payload: ReturnType<typeof fixture>) => {
      payload.brokerRoster.push({ ...payload.brokerRoster[0]! });
    },
  ])("rejects inconsistent or overbroad envelopes (%#)", async (mutate) => {
    const payload = fixture();
    mutate(payload);
    mocks.rpc.mockResolvedValue({ data: payload, error: null });
    await expect(loadProductiveTeamReadModel("all")).rejects.toThrow();
  });
});
