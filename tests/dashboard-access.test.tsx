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
}));

vi.mock("next/navigation", () => ({
  forbidden: mocks.forbidden,
  notFound: mocks.notFound,
}));
vi.mock("@/lib/authorization/enforce", () => ({
  enforcePermission: mocks.enforcePermission,
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
});
