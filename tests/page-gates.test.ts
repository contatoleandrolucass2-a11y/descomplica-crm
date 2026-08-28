import { describe, expect, it } from "vitest";

import { PROTECTED_PAGE_GATES } from "@/lib/authorization/page-gates";

describe("protected commercial page set", () => {
  it("matches the exact approved seventeen-page production set", () => {
    expect(
      PROTECTED_PAGE_GATES.filter((page) => page.releaseEnabled)
        .map((page) => `${page.pageKey}|${page.path}|${page.permission}`)
        .sort(),
    ).toEqual(
      [
        "admin.home|/admin|admin.access",
        "admin.pages|/admin/paginas|pages.manage",
        "admin.users|/admin/usuarios|users.view",
        "crm.dashboard|/app|crm.dashboard.view",
        "crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view",
        "crm.ranking|/app/ranking|crm.ranking.view",
        "crm.settings.goals|/app/configuracoes/metas|crm.settings.manage",
        "crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.manage",
        "crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.manage",
        "crm.settings|/app/configuracoes|crm.settings.view",
        "crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view",
        "crm.simulation|/app/simulacao|crm.simulators.view",
        "crm.stage.appointments|/app/etapas/agendamentos|crm.stages.view",
        "crm.stage.folders|/app/etapas/pastas|crm.stages.view",
        "crm.stage.opportunities|/app/etapas/oportunidades|crm.stages.view",
        "crm.stage.sales|/app/etapas/vendas|crm.stages.view",
        "crm.stage.visits|/app/etapas/visitas|crm.stages.view",
      ].sort(),
    );
  });

  it("identifies exactly the four restore-only simulator routes", () => {
    expect(
      PROTECTED_PAGE_GATES.filter((page) => !page.releaseEnabled)
        .map((page) => `${page.pageKey}|${page.path}|${page.permission}`)
        .sort(),
    ).toEqual(
      [
        "crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view",
        "crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view",
        "crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view",
        "crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view",
      ].sort(),
    );
  });

  it("keeps the full twenty-one-route smoke inventory unique", () => {
    expect(PROTECTED_PAGE_GATES).toHaveLength(21);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.pageKey)).size).toBe(21);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.path)).size).toBe(21);
  });
});
