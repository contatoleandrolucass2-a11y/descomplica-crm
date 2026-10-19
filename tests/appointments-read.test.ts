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
const slice = {
  version: 1,
  viewKey: "all",
  coverageStart: "2026-01-01",
  referenceDate: "2026-10-19",
  dimensions: { managers: [], owners: [], companies: [], developments: [] },
  facts: [[1, "2026-10-19", -1, -1, -1, 0, -1, 2, 0, 0]],
};
const result = (payload = slice) => ({ data: [{ view_key: "all", payload }], error: null });
let headers: Array<{ data: unknown; error: unknown }>;

beforeEach(() => {
  vi.resetAllMocks();
  headers = Array.from({ length: 4 }, () => ({ data: snapshot, error: null }));
  mocks.from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => headers.shift()),
  }));
  mocks.createClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue(result());
});

describe("appointments snapshot read", () => {
  it("uses the stage RPC and only the authorized view, without querying other commercial tables", async () => {
    const actual = await loadAppointmentsReadModel("all");
    expect(actual).toEqual({ analysis: slice, generatedAt: snapshot.generated_at });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_crm_appointments_analysis", {
      p_snapshot_id: 1,
      p_view_keys: ["all"],
    });
    expect(mocks.from.mock.calls.every(([table]) => table === "crm_dashboard_snapshots")).toBe(
      true,
    );
  });

  it("does not fabricate a series for missing snapshots or inaccessible analysis", async () => {
    headers[0] = { data: null, error: null };
    expect(await loadAppointmentsReadModel("all")).toEqual({ analysis: null });
    expect(mocks.rpc).not.toHaveBeenCalled();
    headers[0] = { data: snapshot, error: null };
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadAppointmentsReadModel("all")).toEqual({ analysis: null });
  });

  it.each(["PGRST202", "42883"])(
    "handles only the missing additive RPC as unavailable: %s",
    async (code) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code } });
      expect(await loadAppointmentsReadModel("all")).toEqual({ analysis: null });
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

  it("retries when ingestion changes even the PostgreSQL microsecond version", async () => {
    const next = { ...snapshot, updated_at: "2026-10-19T00:00:00.123457Z" };
    headers = [snapshot, next, next, next].map((data) => ({ data, error: null }));
    expect((await loadAppointmentsReadModel("all")).analysis).toEqual(slice);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("fails instead of returning mixed generations after repeated concurrent ingestion", async () => {
    headers = [snapshot, { ...snapshot, id: 2 }, snapshot, { ...snapshot, id: 3 }].map((data) => ({
      data,
      error: null,
    }));
    await expect(loadAppointmentsReadModel("all")).rejects.toThrow("durante a leitura");
  });
});
