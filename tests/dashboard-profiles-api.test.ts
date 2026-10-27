import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH } from "@/app/api/dashboard-profiles/[id]/route";
import { POST as SET_DEFAULT } from "@/app/api/dashboard-profiles/[id]/set-default/route";
import { GET, POST } from "@/app/api/dashboard-profiles/route";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
  setDefault: vi.fn(),
  pagePath: vi.fn(),
}));

vi.mock("@/lib/security/route-auth", () => ({ authorizePageRoute: mocks.authorize }));
vi.mock("@/lib/dashboard-canvas/persistence/server", () => ({
  createDashboardProfile: mocks.create,
  getDashboardProfile: mocks.get,
  listDashboardProfiles: mocks.list,
  updateDashboardProfile: mocks.patch,
  deleteDashboardProfile: mocks.remove,
  setDefaultDashboardProfile: mocks.setDefault,
  dashboardPagePath: mocks.pagePath,
}));

const userId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const card = {
  id: "card-1",
  type: "bars" as const,
  metric: "appointments.total",
  period: "month" as const,
  groupBy: "day" as const,
  entityIds: null,
  layout: { order: 0, columnSpan: 6, height: 360 },
};
const profile = {
  id: profileId,
  userId,
  pageKey: "crm.stage.appointments",
  scopeKey: null,
  name: "Meu painel",
  isDefault: true,
  schemaVersion: 2 as const,
  version: 2,
  cards: [card],
  createdAt: "2026-10-26T18:00:00.000Z",
  updatedAt: "2026-10-26T19:00:00.000Z",
};
const context = { params: Promise.resolve({ id: profileId }) };

function request(path: string, method: string, value?: unknown, origin = "https://crm.test") {
  return new Request(`https://crm.test${path}`, {
    method,
    headers: value === undefined ? { origin } : { origin, "content-type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}

async function result(response: Response, status: number, value: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(await response.json()).toEqual(value);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://crm.test");
  mocks.pagePath.mockReturnValue("/app/etapas/agendamentos");
  mocks.authorize.mockResolvedValue({ ok: true, context: { userId } });
  mocks.get.mockResolvedValue({ data: profile, error: null });
  mocks.list.mockResolvedValue({ data: [profile], error: null });
  mocks.create.mockResolvedValue({ data: { ...profile, version: 1 }, error: null });
  mocks.patch.mockResolvedValue({ data: profile, error: null });
  mocks.setDefault.mockResolvedValue({ data: profile, error: null });
  mocks.remove.mockResolvedValue({
    data: { deletedId: profileId, defaultProfile: null, savedAt: profile.updatedAt },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("dashboard profiles API", () => {
  it("lists one authenticated page scope without accepting a user id", async () => {
    const response = await GET(
      new Request("https://crm.test/api/dashboard-profiles?pageKey=crm.stage.appointments"),
    );
    await result(response, 200, { profiles: [profile] });
    expect(mocks.authorize).toHaveBeenCalledWith("/app/etapas/agendamentos");
    expect(mocks.list).toHaveBeenCalledWith("crm.stage.appointments", null);
  });

  it("creates a validated profile and returns the optimistic version", async () => {
    const response = await POST(
      request("/api/dashboard-profiles", "POST", {
        pageKey: "crm.stage.appointments",
        name: "Meu painel",
        cards: [card],
      }),
    );
    await result(response, 201, {
      profile: { ...profile, version: 1 },
      savedAt: profile.updatedAt,
      version: 1,
    });
    expect(mocks.create).toHaveBeenCalledWith({
      pageKey: "crm.stage.appointments",
      scopeKey: null,
      name: "Meu painel",
      isDefault: false,
      schemaVersion: 2,
      cards: [card],
    });
  });

  it("authorizes and creates a profile for the overview catalog", async () => {
    const overviewCard = {
      ...card,
      id: "overview-goal",
      type: "funnel" as const,
      metric: "overview.goal.month",
      layout: { order: 0, columnSpan: 4, height: 384 },
    };
    const overviewProfile = {
      ...profile,
      pageKey: "crm.dashboard",
      cards: [overviewCard],
    };
    mocks.pagePath.mockReturnValueOnce("/app");
    mocks.create.mockResolvedValueOnce({ data: overviewProfile, error: null });
    const response = await POST(
      request("/api/dashboard-profiles", "POST", {
        pageKey: "crm.dashboard",
        name: "Visão geral",
        cards: [overviewCard],
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.authorize).toHaveBeenCalledWith("/app");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ pageKey: "crm.dashboard", cards: [overviewCard] }),
    );
  });

  it("patches only after ownership lookup and page authorization", async () => {
    const response = await PATCH(
      request(`/api/dashboard-profiles/${profileId}`, "PATCH", { name: "Renomeado", version: 1 }),
      context,
    );
    await result(response, 200, {
      profile,
      savedAt: profile.updatedAt,
      version: profile.version,
    });
    expect(mocks.get).toHaveBeenCalledWith(profileId);
    expect(mocks.authorize).toHaveBeenCalledWith("/app/etapas/agendamentos");
    expect(mocks.patch).toHaveBeenCalledWith(profileId, { name: "Renomeado", version: 1 });
  });

  it("rejects PATCH cards outside the stored profile page catalog", async () => {
    const response = await PATCH(
      request(`/api/dashboard-profiles/${profileId}`, "PATCH", {
        cards: [{ ...card, metric: "finance.revenue" }],
        version: 1,
      }),
      context,
    );
    await result(response, 400, { error: "invalid_profile_catalog" });
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("deletes with a required expected version and reports replacement default", async () => {
    const response = await DELETE(
      request(`/api/dashboard-profiles/${profileId}?version=2`, "DELETE"),
      context,
    );
    await result(response, 200, {
      deletedId: profileId,
      defaultProfile: null,
      savedAt: profile.updatedAt,
    });
    expect(mocks.remove).toHaveBeenCalledWith(profileId, 2);
  });

  it("sets the default with optimistic concurrency", async () => {
    const response = await SET_DEFAULT(
      request(`/api/dashboard-profiles/${profileId}/set-default`, "POST", { version: 1 }),
      context,
    );
    await result(response, 200, {
      profile,
      savedAt: profile.updatedAt,
      version: profile.version,
    });
    expect(mocks.setDefault).toHaveBeenCalledWith(profileId, 1);
  });

  it("maps version conflicts to 409 without leaking database diagnostics", async () => {
    mocks.patch.mockResolvedValue({ data: null, error: { code: "40001", message: "private" } });
    const response = await PATCH(
      request(`/api/dashboard-profiles/${profileId}`, "PATCH", { cards: [], version: 1 }),
      context,
    );
    await result(response, 409, { error: "version_conflict" });
  });

  it.each([
    ["foreign origin", request("/api/dashboard-profiles", "POST", {}, "https://foreign.test"), 403],
    [
      "unknown page",
      request("/api/dashboard-profiles", "POST", { pageKey: "crm.unknown", name: "X", cards: [] }),
      400,
    ],
    [
      "arbitrary user id",
      request("/api/dashboard-profiles", "POST", {
        pageKey: "crm.stage.appointments",
        userId,
        name: "X",
        cards: [],
      }),
      400,
    ],
  ])("rejects %s before persistence", async (_label, candidate, status) => {
    if (_label === "unknown page") mocks.pagePath.mockReturnValueOnce(null);
    const response = await POST(candidate);
    expect(response.status).toBe(status);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["28000", 401, "unauthenticated"],
    ["42501", 403, "forbidden"],
    ["P0002", 404, "profile_not_found"],
    ["22023", 400, "invalid_profile"],
  ])("maps RPC %s to sanitized HTTP %i", async (code, status, error) => {
    mocks.get.mockResolvedValue({ data: null, error: { code, message: "private diagnostic" } });
    const response = await PATCH(
      request(`/api/dashboard-profiles/${profileId}`, "PATCH", { name: "Renomeado", version: 1 }),
      context,
    );
    await result(response, Number(status), { error });
  });
});
