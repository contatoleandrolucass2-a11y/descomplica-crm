import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stage: vi.fn(),
  appointments: vi.fn(),
  profiles: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("@/lib/authorization/enforce", () => ({ enforcePageAccess: mocks.authorize }));
vi.mock("@/lib/authorization/dashboard-views", () => ({
  getAuthorizedDashboardViews: () => ["all"],
}));
vi.mock("@/lib/navigation/pages", () => ({
  getAuthorizedNavigation: async () => [{ path: "/app/etapas/visitas" }],
}));
vi.mock("@/lib/crm/dashboard/data", () => ({ loadStageReadModel: mocks.stage }));
vi.mock("@/lib/crm/stages/data", () => ({ loadAppointmentsReadModel: mocks.appointments }));
vi.mock("@/lib/dashboard-canvas/persistence/server", () => ({
  listDashboardProfiles: mocks.profiles,
}));

import StagePage, { generateMetadata } from "@/app/(protected)/app/etapas/[stage]/page";

const metric = {
  currentMonth: 3,
  currentWeek: 1,
  currentToday: 0,
  goalMonth: 0,
  goalWeek: 0,
  goalToday: 0,
  previousMonth: 1,
  previousWeek: 1,
  yesterday: 0,
  previousFourteenDays: null,
  lastFourteenDays: null,
  previousSevenDays: null,
  lastSevenDays: null,
};
const dashboard = {
  generatedAt: "2026-11-02T12:00:00Z",
  timezone: "America/Sao_Paulo",
  source: "salesforce",
  goalsAvailable: true,
  metrics: { all: { visits: metric } },
};
const renderStage = async () =>
  renderToStaticMarkup(
    await StagePage({
      params: Promise.resolve({ stage: "visitas" }),
      searchParams: Promise.resolve({ view: "all" }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({
    userId: "synthetic-user",
    roleKey: "admin",
    permissions: ["crm.dashboard.view"],
  });
  mocks.stage.mockResolvedValue({ status: "ready", dashboard });
  mocks.appointments.mockResolvedValue({ analysis: null, brokerRoster: null });
  mocks.profiles.mockResolvedValue({ data: [], error: null });
});

describe("stage source states and initial authorized profile", () => {
  it("shows a configured zero target and zero gap while keeping the percentage undefined", async () => {
    const html = await renderStage();
    expect(html).toContain("Meta oficial: 0");
    expect(html).toContain("Meta cadastrada igual a zero");
    expect(html).toMatch(/Gap matemático<\/dt><dd>0<\/dd>/u);
    expect(html).toContain("Indisponível");
  });
  it("does not expose a zero from an unavailable official source", async () => {
    mocks.stage.mockResolvedValue({
      status: "ready",
      dashboard: { ...dashboard, goalsAvailable: false },
    });
    expect(await renderStage()).not.toContain("Meta oficial: 0");
  });
  it("uses route-specific document titles without consulting commercial data", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ stage: "visitas" }) })).toEqual({
      title: "Visitas | Descomplica CRM",
    });
    expect(mocks.stage).not.toHaveBeenCalled();
  });
  it("does not load profiles when authorization fails", async () => {
    mocks.authorize.mockRejectedValue(new Error("forbidden"));
    await expect(
      StagePage({
        params: Promise.resolve({ stage: "agendamentos" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("forbidden");
    expect(mocks.profiles).not.toHaveBeenCalled();
  });
  it("keeps the dashboard available when the authorized profile read fails", async () => {
    mocks.profiles.mockRejectedValue(new Error("source unavailable"));
    const html = renderToStaticMarkup(
      await StagePage({
        params: Promise.resolve({ stage: "agendamentos" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Dados analíticos indisponíveis");
    expect(mocks.profiles).toHaveBeenCalledWith("crm.stage.appointments", "channel.house");
  });
});
