import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));

import { GET } from "@/app/api/appointments/status/route";

const version = {
  generated_at: "2026-11-05T00:35:00.123456+00:00",
  updated_at: "2026-11-05T00:39:00.654321+00:00",
};

async function assertResponse(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(await response.json()).toEqual(body);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({
    ok: true,
    context: { permissions: ["crm.stage.appointments.view"] },
  });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: version, error: null });
});

describe("appointments persisted snapshot status", () => {
  it("authorizes the appointments page independently of Dashboard and reads only its version", async () => {
    await assertResponse(await GET(), 200, {
      generatedAt: version.generated_at,
      updatedAt: version.updated_at,
    });
    expect(mocks.authorize).toHaveBeenCalledExactlyOnceWith("/app/etapas/agendamentos");
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("crm_dashboard_snapshots");
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("generated_at,updated_at");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("snapshot_key", "global");
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])("returns denial %i before creating a data client", async (status) => {
    const response = Response.json({ error: "denied" }, { status });
    mocks.authorize.mockResolvedValue({ ok: false, response });
    expect(await GET()).toBe(response);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reports a truly missing snapshot as a null pair", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await assertResponse(await GET(), 200, { generatedAt: null, updatedAt: null });
  });

  it.each([
    { generated_at: version.generated_at },
    { generated_at: version.generated_at, updated_at: null },
    { generated_at: "invalid", updated_at: version.updated_at },
    { generated_at: version.generated_at, updated_at: "invalid" },
  ])("does not advertise an invalid or partial version pair: %j", async (data) => {
    mocks.maybeSingle.mockResolvedValue({ data, error: null });
    await assertResponse(await GET(), 503, { error: "status_unavailable" });
  });

  it("does not advertise stale data returned alongside a database error", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: version, error: { code: "42501" } });
    await assertResponse(await GET(), 503, { error: "status_unavailable" });
  });

  it("keeps an interrupted read unavailable without exposing the underlying error", async () => {
    mocks.maybeSingle.mockRejectedValue(new Error("private database diagnostics"));
    await assertResponse(await GET(), 503, { error: "status_unavailable" });
  });

  it("never exposes payload fields or ingestion-attempt status", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { ...version, payload: { private: "fixture" }, ingestion: "running" },
      error: null,
    });
    await assertResponse(await GET(), 200, {
      generatedAt: version.generated_at,
      updatedAt: version.updated_at,
    });
  });
});
