import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PROTECTED_PAGE_GATES } from "@/lib/authorization/page-gates";

describe("protected commercial page set", () => {
  it("matches the exact approved twenty-five-page protected set", () => {
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
        "crm.repasse|/app/repasse|crm.partnerships.view",
        "crm.ranking|/app/ranking|crm.ranking.view",
        "crm.settings.goals|/app/configuracoes/metas|crm.settings.manage",
        "crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.manage",
        "crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.manage",
        "crm.settings.marketing|/app/configuracoes/recurso-mkt|crm.settings.manage",
        "crm.settings.connected_systems|/app/configuracoes/conectar-sistemas|crm.settings.manage",
        "crm.settings|/app/configuracoes|crm.settings.view",
        "crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view",
        "crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view",
        "crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view",
        "crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view",
        "crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view",
        "crm.simulation.tabelao|/app/simulacao/tabelao|crm.simulators.view",
        "crm.simulation|/app/simulacao|crm.simulators.view",
        "crm.stage.appointments|/app/etapas/agendamentos|crm.stages.view",
        "crm.stage.folders|/app/etapas/pastas|crm.stages.view",
        "crm.stage.opportunities|/app/etapas/oportunidades|crm.stages.view",
        "crm.stage.sales|/app/etapas/vendas|crm.stages.view",
        "crm.stage.visits|/app/etapas/visitas|crm.stages.view",
      ].sort(),
    );
  });

  it("keeps no protected page in a restore-only release state", () => {
    expect(
      PROTECTED_PAGE_GATES.filter((page) => !page.releaseEnabled)
        .map((page) => `${page.pageKey}|${page.path}|${page.permission}`)
        .sort(),
    ).toEqual([]);
  });

  it("keeps the full twenty-five-route smoke inventory unique", () => {
    expect(PROTECTED_PAGE_GATES).toHaveLength(25);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.pageKey)).size).toBe(25);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.path)).size).toBe(25);
  });

  it("keeps Repasse explicitly Master-only in addition to its permission", () => {
    expect(PROTECTED_PAGE_GATES.find(({ path }) => path === "/app/repasse")).toMatchObject({
      permission: "crm.partnerships.view",
      releaseEnabled: true,
      requiredRole: "master",
    });
  });

  it("gates every supplemental simulator with the simulator permission and release state", () => {
    expect(
      PROTECTED_PAGE_GATES.filter((page) =>
        [
          "/app/simulacao/tabela-direta",
          "/app/simulacao/tabela-investidor",
          "/app/simulacao/tabelao",
          "/app/simulacao/calcular-documentacao",
          "/app/simulacao/caixa",
        ].includes(page.path),
      ).map(({ path, permission, releaseEnabled }) => ({ path, permission, releaseEnabled })),
    ).toEqual([
      {
        path: "/app/simulacao/calcular-documentacao",
        permission: "crm.simulators.view",
        releaseEnabled: true,
      },
      {
        path: "/app/simulacao/caixa",
        permission: "crm.simulators.view",
        releaseEnabled: true,
      },
      {
        path: "/app/simulacao/tabela-direta",
        permission: "crm.simulators.view",
        releaseEnabled: true,
      },
      {
        path: "/app/simulacao/tabelao",
        permission: "crm.simulators.view",
        releaseEnabled: true,
      },
      {
        path: "/app/simulacao/tabela-investidor",
        permission: "crm.simulators.view",
        releaseEnabled: true,
      },
    ]);
  });

  it("keeps server guards on the simulator layout and both route implementations", () => {
    const layout = readFileSync(
      new URL("../app/(protected)/app/simulacao/layout.tsx", import.meta.url),
      "utf8",
    );
    const dynamicPage = readFileSync(
      new URL("../app/(protected)/app/simulacao/[simulator]/page.tsx", import.meta.url),
      "utf8",
    );
    const tabelaoPage = readFileSync(
      new URL("../app/(protected)/app/simulacao/tabelao/page.tsx", import.meta.url),
      "utf8",
    );

    expect(layout).toContain('await enforcePermission("crm.simulators.view")');
    expect(dynamicPage).toContain('await enforcePermission("crm.simulators.view")');
    expect(dynamicPage).toContain("if (!pageGate?.releaseEnabled) forbidden()");
    expect(dynamicPage).toContain('const visualOnly = simulator === "caixa"');
    expect(dynamicPage.match(/!visualOnly &&/gu)).toHaveLength(2);
    expect(dynamicPage).toContain("motor e integração bancária permanecem indisponíveis");
    expect(tabelaoPage).toContain('await enforcePermission("crm.simulators.view")');
    expect(tabelaoPage).toContain('getProtectedPageGate("/app/simulacao/tabelao")?.releaseEnabled');
    expect(tabelaoPage).toContain("forbidden()");
  });
});
