import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforcePermission: vi.fn(),
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_INTERRUPT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND_INTERRUPT");
  }),
  loadDashboardReadModel: vi.fn(),
  loadStageReadModel: vi.fn(),
  loadAppointmentsReadModel: vi.fn(),
  loadDashboardTeam: vi.fn(),
  loadFunnelGoals: vi.fn(),
  navigation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  forbidden: mocks.forbidden,
  notFound: mocks.notFound,
}));
vi.mock("@/lib/authorization/enforce", () => ({
  enforcePermission: mocks.enforcePermission,
  enforcePageAccess: mocks.enforcePermission,
}));
vi.mock("@/lib/crm/dashboard/team", () => ({
  loadDashboardTeam: mocks.loadDashboardTeam,
}));
vi.mock("@/lib/crm/goals/data", () => ({
  loadFunnelGoals: mocks.loadFunnelGoals,
}));
vi.mock("@/lib/navigation/pages", () => ({ getAuthorizedNavigation: mocks.navigation }));
vi.mock("@/lib/crm/stages/data", () => ({
  loadAppointmentsReadModel: mocks.loadAppointmentsReadModel,
}));
vi.mock("@/lib/crm/dashboard/data", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/crm/dashboard/data")>();
  return {
    ...original,
    loadDashboardReadModel: mocks.loadDashboardReadModel,
    loadStageReadModel: mocks.loadStageReadModel,
  };
});

import AppHomePage from "@/app/(protected)/app/page";
import StagePage from "@/app/(protected)/app/etapas/[stage]/page";
import type { DashboardReadModel } from "@/lib/crm/dashboard/data";

describe("dashboard autorizado por visão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadDashboardReadModel.mockResolvedValue({ status: "empty" });
    mocks.loadStageReadModel.mockResolvedValue({ status: "empty" });
    mocks.loadAppointmentsReadModel.mockResolvedValue({ analysis: null });
    mocks.loadDashboardTeam.mockResolvedValue({ status: "unavailable", reason: "Sem equipe." });
    mocks.loadFunnelGoals.mockResolvedValue({ status: "empty", effectiveMonth: "2026-10-01" });
    mocks.navigation.mockResolvedValue([]);
  });

  it("mostra somente Canal Imob e não carrega ranking para o perfil Imob", async () => {
    mocks.enforcePermission.mockResolvedValue({
      userId: "a4000000-0000-4000-8000-000000000001",
      roleKey: "manager_imob",
      level: 54,
      permissions: [
        "pages.view",
        "crm.dashboard.view",
        "crm.dashboard.with_canal_imob.view",
        "crm.stages.view",
        "crm.partnerships.view",
      ],
    });

    const markup = renderToStaticMarkup(await AppHomePage({ searchParams: Promise.resolve({}) }));

    expect(mocks.loadDashboardReadModel).toHaveBeenCalledWith(["with_canal_imob"], {
      includeTopDevelopments: false,
      includeAnalysis: true,
    });
    expect(mocks.loadFunnelGoals).toHaveBeenCalledExactlyOnceWith("partnerships");
    expect(markup).not.toContain('href="/app?view=');
    expect(markup).not.toContain("Sem canal de imobiliárias");
    expect(markup).not.toContain(">Geral<");
    expect(markup).not.toContain("Ranking validado");
    expect(markup).not.toContain("Oportunidades por empreendimento");
  });

  it("mantem somente a visao House e remove o ranking desta pagina", async () => {
    mocks.enforcePermission.mockResolvedValue({
      userId: "a4000000-0000-4000-8000-000000000002",
      roleKey: "broker_house",
      level: 25,
      permissions: [
        "pages.view",
        "crm.dashboard.view",
        "crm.dashboard.without_canal_imob.view",
        "crm.stages.view",
        "crm.ranking.view",
      ],
    });

    const markup = renderToStaticMarkup(await AppHomePage({ searchParams: Promise.resolve({}) }));

    expect(mocks.loadDashboardReadModel).toHaveBeenCalledWith(["without_canal_imob"], {
      includeTopDevelopments: true,
      includeAnalysis: true,
    });
    expect(markup).not.toContain('href="/app?view=');
    expect(markup).not.toContain("Com canal de imobiliárias");
    expect(markup).not.toContain(">Geral<");
    expect(markup).not.toContain("Ranking validado");
    expect(markup).not.toContain("Oportunidades por empreendimento");
  });

  it("mantem filtros e metas com analise sanitizada sem permissao de ranking", async () => {
    mocks.enforcePermission.mockResolvedValue({
      permissions: ["crm.dashboard.view", "crm.dashboard.with_canal_imob.view"],
    });
    const dashboard: DashboardReadModel = {
      id: 10,
      snapshotKey: "global",
      referenceDate: "2026-10-14",
      generatedAt: "2026-10-14T15:00:00Z",
      updatedAt: "2026-10-14T15:01:00Z",
      timezone: "America/Sao_Paulo",
      source: "Fixture sintetica",
      goalsAvailable: false,
      metrics: {},
      salesValue: {},
      topDevelopments: {},
      analysis: {
        with_canal_imob: {
          version: 1,
          viewKey: "with_canal_imob",
          coverageStart: "2026-01-01",
          referenceDate: "2026-10-14",
          dimensions: {
            managers: ["Gerente sintetico"],
            owners: ["Responsavel sintetico"],
            companies: ["Empresa sintetica"],
            developments: [],
          },
          facts: [[0, "2026-10-14", 0, 0, 0, 0, -1, 5, 0, 0]],
        },
      },
    };
    mocks.loadDashboardReadModel.mockResolvedValue({ status: "ready", dashboard });
    const markup = renderToStaticMarkup(await AppHomePage({ searchParams: Promise.resolve({}) }));
    expect(mocks.loadDashboardReadModel).toHaveBeenCalledExactlyOnceWith(["with_canal_imob"], {
      includeTopDevelopments: false,
      includeAnalysis: true,
    });
    expect(markup).toContain("Responsavel sintetico");
    expect(markup).toContain("Gerente sintetico");
    expect(markup).toContain("Empresa sintetica");
    expect(markup).toContain("Meta Imob indisponível para o mês");
    expect(markup).not.toContain("Ranking validado");
    expect(markup).not.toContain("Oportunidades por empreendimento");
    expect(mocks.loadDashboardTeam).not.toHaveBeenCalled();
  });

  it("uses the active partnership goal in the Imob dashboard", async () => {
    mocks.enforcePermission.mockResolvedValue({
      permissions: ["crm.dashboard.view", "crm.dashboard.with_canal_imob.view"],
    });
    mocks.loadFunnelGoals.mockResolvedValue({
      status: "ready",
      goals: {
        visits: 12,
        folders: 64,
        approvedFolders: 32,
        sales: 20,
      },
    });
    const dashboard: DashboardReadModel = {
      id: 11,
      snapshotKey: "global",
      referenceDate: "2026-10-20",
      generatedAt: "2026-10-20T12:00:00Z",
      updatedAt: "2026-10-20T12:01:00Z",
      timezone: "America/Sao_Paulo",
      source: "Fixture sintetica",
      goalsAvailable: true,
      metrics: {},
      salesValue: {},
      topDevelopments: {},
    };
    mocks.loadDashboardReadModel.mockResolvedValue({ status: "ready", dashboard });

    const markup = renderToStaticMarkup(await AppHomePage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain("7 gerentes de vendas no grupo");
    expect(markup).toContain("Visitas");
    expect(markup).not.toContain("Oportunidades");
    expect(markup).not.toContain("Agendamentos");
  });

  it("responde 403 antes de consultar dados quando a visão conhecida não é autorizada", async () => {
    mocks.enforcePermission.mockResolvedValue({
      userId: "a4000000-0000-4000-8000-000000000003",
      roleKey: "coordinator",
      level: 60,
      permissions: [
        "pages.view",
        "crm.dashboard.view",
        "crm.dashboard.with_canal_imob.view",
        "crm.stages.view",
      ],
    });

    await expect(AppHomePage({ searchParams: Promise.resolve({ view: "all" }) })).rejects.toThrow(
      "FORBIDDEN_INTERRUPT",
    );
    expect(mocks.loadDashboardReadModel).not.toHaveBeenCalled();
    expect(mocks.loadDashboardTeam).not.toHaveBeenCalled();
  });

  it("aplica a mesma restrição de visão nas páginas de etapa", async () => {
    mocks.enforcePermission.mockResolvedValue({
      userId: "a4000000-0000-4000-8000-000000000004",
      roleKey: "broker_imob",
      level: 24,
      permissions: [
        "pages.view",
        "crm.dashboard.view",
        "crm.dashboard.with_canal_imob.view",
        "crm.stages.view",
      ],
    });

    await expect(
      StagePage({
        params: Promise.resolve({ stage: "oportunidades" }),
        searchParams: Promise.resolve({ view: "without_canal_imob" }),
      }),
    ).rejects.toThrow("FORBIDDEN_INTERRUPT");
    expect(mocks.loadDashboardReadModel).not.toHaveBeenCalled();
  });

  it("recusa perfil sem nenhuma visão antes de consultar os read models", async () => {
    mocks.enforcePermission.mockResolvedValue({ permissions: ["crm.dashboard.view"] });
    await expect(AppHomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "FORBIDDEN_INTERRUPT",
    );
    expect(mocks.loadDashboardReadModel).not.toHaveBeenCalled();
    expect(mocks.loadDashboardTeam).not.toHaveBeenCalled();
  });

  it("loads an independent stage without Dashboard and omits unauthorized adjacent data", async () => {
    mocks.enforcePermission.mockResolvedValue({
      permissions: [
        "pages.view",
        "crm.stage.opportunities.view",
        "crm.dashboard.with_canal_imob.view",
      ],
    });
    mocks.navigation.mockResolvedValue([{ path: "/app/etapas/oportunidades" }]);
    const markup = renderToStaticMarkup(
      await StagePage({
        params: Promise.resolve({ stage: "oportunidades" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(mocks.loadStageReadModel).toHaveBeenCalledExactlyOnceWith(
      ["with_canal_imob"],
      ["opportunities"],
    );
    expect(mocks.loadDashboardReadModel).not.toHaveBeenCalled();
    expect(markup).not.toContain('href="/app/etapas/vendas');
  });

  it("loads appointments independently and removes the requested legacy blocks only there", async () => {
    mocks.enforcePermission.mockResolvedValue({
      permissions: [
        "pages.view",
        "crm.stage.appointments.view",
        "crm.dashboard.with_canal_imob.view",
      ],
    });
    const markup = renderToStaticMarkup(
      await StagePage({
        params: Promise.resolve({ stage: "agendamentos" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(mocks.loadAppointmentsReadModel).toHaveBeenCalledExactlyOnceWith("with_canal_imob");
    expect(mocks.loadStageReadModel).not.toHaveBeenCalled();
    expect(mocks.loadDashboardReadModel).not.toHaveBeenCalled();
    expect(markup).not.toContain("Posição no funil");
    expect(markup).not.toContain("Filtros dimensionais indisponíveis");
    expect(markup).not.toContain('aria-label="Etapas do funil"');
    expect(markup).not.toContain("Funil completo");
  });

  it("rejects a foreign appointments view before fetching analytics", async () => {
    mocks.enforcePermission.mockResolvedValue({
      permissions: [
        "pages.view",
        "crm.stage.appointments.view",
        "crm.dashboard.with_canal_imob.view",
      ],
    });
    await expect(
      StagePage({
        params: Promise.resolve({ stage: "agendamentos" }),
        searchParams: Promise.resolve({ view: "all" }),
      }),
    ).rejects.toThrow("FORBIDDEN_INTERRUPT");
    expect(mocks.loadAppointmentsReadModel).not.toHaveBeenCalled();
  });

  it("keeps root links removed and only links authorized neighboring stages", async () => {
    mocks.enforcePermission.mockResolvedValue({
      permissions: ["crm.dashboard.view", "crm.dashboard.all.view", "crm.stages.view"],
    });
    mocks.navigation.mockResolvedValue([
      { path: "/app/etapas/oportunidades" },
      { path: "/app/etapas/vendas" },
    ]);
    const dashboard = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({}) }),
    );
    const stage = renderToStaticMarkup(
      await StagePage({
        params: Promise.resolve({ stage: "oportunidades" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(dashboard).not.toContain('href="/app/etapas/');
    expect(stage).toContain('href="/app/etapas/vendas?');
    expect(stage).not.toContain('href="/app/etapas/agendamentos?');
    expect(stage).not.toContain('href="/app/etapas/visitas?');
    expect(stage).not.toContain('href="/app/etapas/pastas?');
  });

  it("nao usa o cadastro de ativos como equipe dos relatorios filtrados", async () => {
    const authorization = {
      userId: "a4000000-0000-4000-8000-000000000005",
      roleKey: "admin",
      level: 90,
      permissions: ["crm.dashboard.view", "crm.dashboard.all.view", "crm.ranking.view"],
    };
    const dashboard = {
      id: 1,
      snapshotKey: "global",
      referenceDate: "2026-10-13",
      generatedAt: "2026-10-13T15:00:00Z",
      updatedAt: "2026-10-13T15:01:00Z",
      timezone: "America/Sao_Paulo",
      source: "Fixture sintetica",
      goalsAvailable: false,
      metrics: {},
      salesValue: {},
      topDevelopments: {},
    };
    mocks.enforcePermission.mockResolvedValue(authorization);
    mocks.loadDashboardReadModel.mockResolvedValue({ status: "ready", dashboard });
    mocks.loadDashboardTeam.mockResolvedValue({
      status: "ready",
      team: { brokers: 2, managers: [{ name: "Gerente sintetico", total: 2 }] },
    });

    const markup = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({ view: "all", period: "week" }) }),
    );
    expect(mocks.loadDashboardTeam).toHaveBeenCalledExactlyOnceWith(
      dashboard,
      authorization,
      "all",
    );
    expect(markup).toContain("2 corretores no grupo");
    expect(markup).not.toContain("Gerente sintetico");
    expect(markup).not.toContain("Corretores por gerente");
    expect(markup).toContain("Filtros aguardando coleta detalhada dos relatórios.");
    expect(markup).not.toContain('href="/app/etapas/');
  });
});
