import { describe, expect, it } from "vitest";

import { PROTECTED_PAGE_GATES, protectedPageGateIsReleased } from "@/lib/authorization/page-gates";

const approvedCatalog = [
  "admin.home|/admin|admin.access",
  "admin.pages|/admin/paginas|pages.manage",
  "admin.users|/admin/usuarios|users.view",
  "crm.dashboard|/app|crm.dashboard.view",
  "crm.dialer.weekend_forecast|/app/discador/previsao-final-de-semana|crm.dialer.view",
  "crm.dialer|/app/discador|crm.dialer.view",
  "crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view",
  "crm.ranking|/app/ranking|crm.ranking.view",
  "crm.settings.goals|/app/configuracoes/metas|crm.settings.manage",
  "crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.manage",
  "crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.manage",
  "crm.settings|/app/configuracoes|crm.settings.view",
  "crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view",
  "crm.simulation.tabelao|/app/simulacao/tabela|crm.simulators.view",
  "crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view",
  "crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view",
  "crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view",
  "crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view",
  "crm.simulation|/app/simulacao|crm.simulators.view",
  "crm.stage.appointments|/app/etapas/agendamentos|crm.stages.view",
  "crm.stage.folders|/app/etapas/pastas|crm.stages.view",
  "crm.stage.opportunities|/app/etapas/oportunidades|crm.stages.view",
  "crm.stage.sales|/app/etapas/vendas|crm.stages.view",
  "crm.stage.visits|/app/etapas/visitas|crm.stages.view",
].sort();

describe("protected commercial page set", () => {
  it("matches the exact approved twenty-four-page canary catalog", () => {
    expect(
      PROTECTED_PAGE_GATES.map((page) => `${page.pageKey}|${page.path}|${page.permission}`).sort(),
    ).toEqual(approvedCatalog);
  });

  it("keeps exactly seven migrated pages independently runtime-gated", () => {
    expect(
      PROTECTED_PAGE_GATES.filter((page) => "runtimeModule" in page)
        .map((page) => `${page.pageKey}|${page.runtimeModule}`)
        .sort(),
    ).toEqual(
      [
        "crm.dialer.weekend_forecast|dialer.weekend-forecast",
        "crm.dialer|dialer",
        "crm.simulation.caixa|simulator.caixa",
        "crm.simulation.tabelao|simulator.tabelao",
        "crm.simulation.wf14|simulator.wf14",
        "crm.simulation.wf15|simulator.wf15",
        "crm.simulation.wf16|simulator.wf16",
      ].sort(),
    );
  });

  it("fails closed at seventeen pages and releases twenty-four only with the full canary", () => {
    const defaultReleased = PROTECTED_PAGE_GATES.filter((page) =>
      protectedPageGateIsReleased(page, {}),
    );
    const canaryReleased = PROTECTED_PAGE_GATES.filter((page) =>
      protectedPageGateIsReleased(page, {
        LEGACY_MIGRATION_RUNTIME_MODE: "active",
        LEGACY_MIGRATION_ENABLED_MODULES:
          "simulator.wf16,simulator.caixa,simulator.wf14,simulator.wf15,simulator.tabelao,dialer,dialer.weekend-forecast",
      }),
    );
    expect(defaultReleased).toHaveLength(17);
    expect(canaryReleased).toHaveLength(24);
  });

  it("keeps the full twenty-four-route inventory unique", () => {
    expect(PROTECTED_PAGE_GATES).toHaveLength(24);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.pageKey)).size).toBe(24);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.path)).size).toBe(24);
  });
});
