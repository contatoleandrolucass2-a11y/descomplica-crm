import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getProtectedPageGate,
  pageGateAllowsRole,
  PROTECTED_PAGE_GATES,
} from "@/lib/authorization/page-gates";

describe("protected commercial page set", () => {
  it.each([
    ["leads", "crm.leads.view"],
    ["leads/lista", "crm.leads.list.view"],
    ["leads/atividades", "crm.leads.activities.view"],
    ["leads/funil", "crm.leads.pipeline.view"],
    ["leads/distribuicao", "crm.leads.distribution.view"],
    ["leads/relatorios", "crm.leads.reports.view"],
    ["leads/importacao", "crm.leads.import.view"],
    ["leads/configuracoes", "crm.leads.settings.view"],
    ["leads/auditoria", "crm.leads.audit.view"],
  ])("keeps %s behind its independent Lead page guard", (route, permission) => {
    const source = readFileSync(
      new URL(`../app/(protected)/app/${route}/page.tsx`, import.meta.url),
      "utf8",
    );

    expect(source).toContain(`enforcePageAccess("/app/${route}")`);
    expect(getProtectedPageGate(`/app/${route}`)?.permission).toBe(permission);
  });

  it.each(["gestao", "gestao/rotina", "gestao/previsao"])(
    "keeps %s readable behind its independent page guard",
    (route) => {
      const source = readFileSync(
        new URL(`../app/(protected)/app/${route}/page.tsx`, import.meta.url),
        "utf8",
      );
      expect(source).toContain(`enforcePageAccess("/app/${route}")`);
      expect(source).not.toContain('enforcePermission("crm.settings.manage")');
      expect(getProtectedPageGate(`/app/${route}`)?.permission).toBe(
        route === "gestao"
          ? "crm.management.view"
          : route === "gestao/previsao"
            ? "crm.management.forecast.view"
            : "crm.management.routine.view",
      );
    },
  );

  it.each([
    ["links-uteis", "crm.useful_links.view"],
    ["links-uteis/grupos-whatsapp", "crm.useful_links.grupos_whatsapp.view"],
    ["links-uteis/lojas-horarios", "crm.useful_links.lojas_horarios.view"],
    ["links-uteis/relacionamento", "crm.useful_links.relacionamento.view"],
    ["links-uteis/regras-comerciais", "crm.useful_links.regras_comerciais.view"],
    ["links-uteis/campanha-do-mes", "crm.useful_links.campanha_do_mes.view"],
    ["links-uteis/app-bora-vender", "crm.useful_links.app_bora_vender.view"],
    ["links-uteis/linktree-liveprint", "crm.useful_links.linktree_liveprint.view"],
  ])("keeps %s behind its independent Useful Links page guard", (route, permission) => {
    const source = readFileSync(
      new URL(`../app/(protected)/app/${route}/page.tsx`, import.meta.url),
      "utf8",
    );
    expect(source).toContain(`enforcePageAccess("/app/${route}")`);
    expect(getProtectedPageGate(`/app/${route}`)?.permission).toBe(permission);
  });

  it("matches the exact approved forty-nine-page protected set", () => {
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
        "crm.leads.activities|/app/leads/atividades|crm.leads.activities.view",
        "crm.leads.audit|/app/leads/auditoria|crm.leads.audit.view",
        "crm.leads.distribution|/app/leads/distribuicao|crm.leads.distribution.view",
        "crm.leads.import|/app/leads/importacao|crm.leads.import.view",
        "crm.leads.list|/app/leads/lista|crm.leads.list.view",
        "crm.leads.pipeline|/app/leads/funil|crm.leads.pipeline.view",
        "crm.leads.reports|/app/leads/relatorios|crm.leads.reports.view",
        "crm.leads.settings|/app/leads/configuracoes|crm.leads.settings.view",
        "crm.leads|/app/leads|crm.leads.view",
        "crm.management.routine|/app/gestao/rotina|crm.management.routine.view",
        "crm.management.forecast|/app/gestao/previsao|crm.management.forecast.view",
        "crm.management|/app/gestao|crm.management.view",
        "crm.meta_ads.accounts|/app/meta-ads/contas-de-anuncios|crm.meta_ads.accounts.view",
        "crm.meta_ads.campaigns|/app/meta-ads/campanhas|crm.meta_ads.campaigns.view",
        "crm.meta_ads.reports|/app/meta-ads/relatorios|crm.meta_ads.reports.view",
        "crm.meta_ads|/app/meta-ads|crm.meta_ads.view",
        "crm.partnerships|/app/canal-de-parcerias|crm.partnerships.view",
        "crm.repasse|/app/repasse|crm.repasse.view",
        "crm.ranking|/app/ranking|crm.ranking.view",
        "crm.settings.goals|/app/configuracoes/metas|crm.settings.goals.view",
        "crm.settings.partnerships|/app/configuracoes/metas/parcerias|crm.settings.partnerships.view",
        "crm.settings.points|/app/configuracoes/metas/pontos|crm.settings.points.view",
        "crm.settings.marketing|/app/configuracoes/recurso-mkt|crm.settings.marketing.view",
        "crm.settings.connected_systems|/app/configuracoes/conectar-sistemas|crm.settings.connected_systems.view",
        "crm.settings|/app/configuracoes|crm.settings.view",
        "crm.simulation.caixa|/app/simulacao/caixa|crm.simulators.view",
        "crm.simulation.wf13|/app/simulacao/associativo-fluxo-linear|crm.simulators.view",
        "crm.simulation.wf14|/app/simulacao/tabela-direta|crm.simulators.view",
        "crm.simulation.wf15|/app/simulacao/tabela-investidor|crm.simulators.view",
        "crm.simulation.wf16|/app/simulacao/calcular-documentacao|crm.simulators.view",
        "crm.simulation.tabelao|/app/simulacao/tabelao|crm.simulators.view",
        "crm.simulation|/app/simulacao|crm.simulators.view",
        "crm.stage.appointments|/app/etapas/agendamentos|crm.stage.appointments.view",
        "crm.stage.folders|/app/etapas/pastas|crm.stage.folders.view",
        "crm.stage.opportunities|/app/etapas/oportunidades|crm.stage.opportunities.view",
        "crm.stage.sales|/app/etapas/vendas|crm.stage.sales.view",
        "crm.stage.visits|/app/etapas/visitas|crm.stage.visits.view",
        "crm.useful_links|/app/links-uteis|crm.useful_links.view",
        "crm.useful_links.grupos_whatsapp|/app/links-uteis/grupos-whatsapp|crm.useful_links.grupos_whatsapp.view",
        "crm.useful_links.lojas_horarios|/app/links-uteis/lojas-horarios|crm.useful_links.lojas_horarios.view",
        "crm.useful_links.relacionamento|/app/links-uteis/relacionamento|crm.useful_links.relacionamento.view",
        "crm.useful_links.regras_comerciais|/app/links-uteis/regras-comerciais|crm.useful_links.regras_comerciais.view",
        "crm.useful_links.campanha_do_mes|/app/links-uteis/campanha-do-mes|crm.useful_links.campanha_do_mes.view",
        "crm.useful_links.app_bora_vender|/app/links-uteis/app-bora-vender|crm.useful_links.app_bora_vender.view",
        "crm.useful_links.linktree_liveprint|/app/links-uteis/linktree-liveprint|crm.useful_links.linktree_liveprint.view",
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

  it("keeps the full forty-nine-route smoke inventory unique", () => {
    expect(PROTECTED_PAGE_GATES).toHaveLength(49);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.pageKey)).size).toBe(49);
    expect(new Set(PROTECTED_PAGE_GATES.map((page) => page.path)).size).toBe(49);
  });

  it("keeps Repasse restricted to Master and Admin in addition to its permission", () => {
    const repasseGate = getProtectedPageGate("/app/repasse");
    expect(repasseGate).toMatchObject({
      permission: "crm.repasse.view",
      releaseEnabled: true,
      allowedRoles: ["master", "admin"],
    });
    if (!repasseGate) throw new Error("Repasse gate is missing.");

    expect(pageGateAllowsRole(repasseGate, "master")).toBe(true);
    expect(pageGateAllowsRole(repasseGate, "admin")).toBe(true);
    expect(pageGateAllowsRole(repasseGate, "coordinator")).toBe(false);
    expect(pageGateAllowsRole(repasseGate, "manager_imob")).toBe(false);
    expect(pageGateAllowsRole(repasseGate, "broker_imob")).toBe(false);

    const dashboardGate = getProtectedPageGate("/app");
    if (!dashboardGate) throw new Error("Dashboard gate is missing.");
    expect(pageGateAllowsRole(dashboardGate, "pending")).toBe(true);
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
    expect(dynamicPage).toContain('if (simulator === "caixa") return <CaixaArchive />');
    expect(dynamicPage.indexOf('await enforcePermission("crm.simulators.view")')).toBeLessThan(
      dynamicPage.indexOf('if (simulator === "caixa") return <CaixaArchive />'),
    );
    expect(dynamicPage.indexOf("if (!pageGate?.releaseEnabled) forbidden()")).toBeLessThan(
      dynamicPage.indexOf('if (simulator === "caixa") return <CaixaArchive />'),
    );
    expect(dynamicPage).not.toContain('const visualOnly = simulator === "caixa"');
    expect(dynamicPage).not.toContain("motor e integração bancária permanecem indisponíveis");
    expect(tabelaoPage).toContain('await enforcePermission("crm.simulators.view")');
    expect(tabelaoPage).toContain('getProtectedPageGate("/app/simulacao/tabelao")?.releaseEnabled');
    expect(tabelaoPage).toContain("forbidden()");
  });
});
