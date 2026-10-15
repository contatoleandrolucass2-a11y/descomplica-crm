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
  loadDashboardTeam: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
vi.mock("@/lib/crm/dashboard/data", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/crm/dashboard/data")>();
  return {
    ...original,
    loadDashboardReadModel: mocks.loadDashboardReadModel,
  };
});

import AppHomePage from "@/app/(protected)/app/page";
import StagePage from "@/app/(protected)/app/etapas/[stage]/page";

describe("dashboard autorizado por visão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadDashboardReadModel.mockResolvedValue({ status: "empty" });
    mocks.loadDashboardTeam.mockResolvedValue({ status: "unavailable", reason: "Sem equipe." });
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
    });
    expect(markup).toContain("Com canal de imobiliárias");
    expect(markup).not.toContain("Sem canal de imobiliárias");
    expect(markup).not.toContain(">Geral<");
    expect(markup).not.toContain("Ranking validado");
    expect(markup).not.toContain("Oportunidades por empreendimento");
  });

  it("mostra somente House e o ranking para o perfil House", async () => {
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
    });
    expect(markup).toContain("Sem canal de imobiliárias");
    expect(markup).not.toContain("Com canal de imobiliárias");
    expect(markup).not.toContain(">Geral<");
    expect(markup).toContain("Ranking validado");
    expect(markup).toContain("Oportunidades por empreendimento");
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

  it("encaminha a autorização e o snapshot atual para a contagem da equipe", async () => {
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
    expect(markup).toContain("Gerente sintetico");
    expect(markup).toContain("Vínculos informados no snapshot");
    expect(markup).not.toContain('href="/app/etapas/');
  });
});
