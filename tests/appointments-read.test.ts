import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));

import { loadAppointmentsReadModel } from "@/lib/crm/stages/data";

const snapshot = {
  id: 1,
  reference_date: "2026-10-19",
  generated_at: "2026-10-19T00:00:00.123456Z",
  updated_at: "2026-10-19T00:00:00.123456Z",
};
const rankingSnapshot = { ...snapshot, id: 2 };
const roster = [
  { broker_key: "broker-a", broker_name: "Responsável A", manager_name: "Gerente A" },
  { broker_key: "broker-b", broker_name: "Responsável B", manager_name: "Gerente B" },
];
const slice = {
  version: 1,
  viewKey: "all",
  coverageStart: "2026-01-01",
  referenceDate: "2026-10-19",
  dimensions: { managers: [], owners: [], companies: [], developments: [] },
  facts: [[1, "2026-10-19", -1, -1, -1, 0, -1, 2, 0, 0]],
};
const result = (payload: unknown = slice) => ({
  data: [{ view_key: "all", payload }],
  error: null,
});
let headers: Array<{ data: unknown; error: unknown }>;
let rankingHeaders: Array<{ data: unknown; error: unknown }>;
let participantResponses: Array<{ data: unknown; count: number | null; error: unknown }>;

beforeEach(() => {
  vi.resetAllMocks();
  headers = Array.from({ length: 4 }, () => ({ data: snapshot, error: null }));
  rankingHeaders = Array.from({ length: 10 }, () => ({ data: rankingSnapshot, error: null }));
  participantResponses = Array.from({ length: 5 }, () => ({
    data: roster,
    count: roster.length,
    error: null,
  }));
  mocks.from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(async () => participantResponses.shift()),
    maybeSingle: vi.fn(async () =>
      table === "crm_dashboard_snapshots" ? headers.shift() : rankingHeaders.shift(),
    ),
  }));
  mocks.createClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "read_crm_appointments_goal" ? { data: 24, error: null } : result(),
  );
});

describe("appointments snapshot read", () => {
  it("uses the stage RPC and only the authorized view, without querying other commercial tables", async () => {
    const actual = await loadAppointmentsReadModel("all");
    expect(actual).toEqual({
      analysis: slice,
      brokerRoster: [
        { key: "broker-a", owner: "Responsável A", manager: "Gerente A" },
        { key: "broker-b", owner: "Responsável B", manager: "Gerente B" },
      ],
      generatedAt: snapshot.generated_at,
      individualGoal: 24,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("read_crm_appointments_analysis", {
      p_snapshot_id: 1,
      p_view_keys: ["all"],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("read_crm_appointments_goal", {
      p_reference_date: snapshot.reference_date,
    });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "crm_dashboard_snapshots",
      "crm_ranking_snapshots",
      "crm_ranking_participants",
      "crm_ranking_snapshots",
      "crm_dashboard_snapshots",
    ]);
  });

  it("does not fabricate a series for missing snapshots or inaccessible analysis", async () => {
    headers[0] = { data: null, error: null };
    expect(await loadAppointmentsReadModel("all")).toEqual({
      analysis: null,
      brokerRoster: null,
      individualGoal: null,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    headers[0] = { data: snapshot, error: null };
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadAppointmentsReadModel("all")).toEqual({
      analysis: null,
      brokerRoster: null,
      individualGoal: null,
    });
  });

  it.each(["PGRST202", "42883"])(
    "handles only the missing additive RPC as unavailable: %s",
    async (code) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code } });
      expect(await loadAppointmentsReadModel("all")).toEqual({
        analysis: null,
        brokerRoster: null,
        individualGoal: null,
      });
    },
  );

  it("fails closed on database errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("gráficos");
  });

  it("rejects foreign views, stages, dates and duplicate responses", async () => {
    mocks.rpc.mockResolvedValue(result({ ...slice, viewKey: "with_canal_imob" }));
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("snapshot");
    mocks.rpc.mockResolvedValue(
      result({ ...slice, facts: [[4, "2026-10-19", -1, -1, -1, 0, -1, 2, 100, 0]] }),
    );
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("snapshot");
    headers = Array.from({ length: 4 }, () => ({ data: snapshot, error: null }));
    mocks.rpc.mockResolvedValue(result({ ...slice, referenceDate: "2026-10-20" }));
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("snapshot");
    mocks.rpc.mockResolvedValue({ data: [...result().data, ...result().data], error: null });
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("visão");
  });

  it("accepts the v4 aggregate funnel while preserving the authorized view", async () => {
    const v4 = {
      ...slice,
      version: 4,
      brokerCount: 2,
      brokerManagerCount: 1,
      dimensions: { ...slice.dimensions, companies: ["Empresa A"], stores: ["Loja A"] },
      facts: [
        [0, "2026-10-19", -1, -1, 0, 1, -1, 9, 0, 0, -1],
        [1, "2026-10-19", -1, -1, 0, 1, -1, 1, 0, 0, 0],
        [2, "2026-10-19", -1, -1, 0, 1, -1, 1, 0, 0, -1],
        [4, "2026-10-19", -1, -1, 0, 1, -1, 1, 0, 0, -1],
      ],
      appointments: [
        {
          createdAt: "2026-10-19T12:00:00-03:00",
          scheduledAt: null,
          attendedAt: null,
          visitPerformed: false,
          regionalManager: "",
          salesManager: "",
          owner: "",
          accountName: "",
          accountRanking: "",
          channel: 1,
          company: "Empresa A",
          registeredBroker: false,
        },
      ],
    };
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "read_crm_appointments_goal" ? { data: 24, error: null } : result(v4),
    );
    expect((await loadAppointmentsReadModel("all")).analysis).toEqual(v4);
  });

  it("keeps the page available but marks a filtered roster unavailable when it cannot prove it", async () => {
    participantResponses[0] = { data: roster.slice(0, 1), count: 2, error: null };
    expect(await loadAppointmentsReadModel("all")).toMatchObject({
      analysis: slice,
      brokerRoster: null,
    });
  });

  it("retries when ingestion changes even the PostgreSQL microsecond version", async () => {
    const next = { ...snapshot, updated_at: "2026-10-19T00:00:00.123457Z" };
    headers = [snapshot, next, next, next].map((data) => ({ data, error: null }));
    expect((await loadAppointmentsReadModel("all")).analysis).toEqual(slice);
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
  });

  it("fails instead of returning mixed generations after repeated concurrent ingestion", async () => {
    headers = [snapshot, { ...snapshot, id: 2 }, snapshot, { ...snapshot, id: 3 }].map((data) => ({
      data,
      error: null,
    }));
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("durante a leitura");
  });
});
