import { readFile } from "node:fs/promises";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PAGE_REGISTRY } from "@/lib/navigation/registry";
import { buildNavigationGroups, getPrimaryNavigation } from "@/lib/navigation/presentation";

const mocks = vi.hoisted(() => ({
  enforcePageAccess: vi.fn().mockResolvedValue({
    userId: "qa-user",
    roleKey: "master",
    level: 100,
    permissions: [],
  }),
  getAuthorizedNavigation: vi.fn(() =>
    PAGE_REGISTRY.filter(
      (page) => page.pageKey === "crm.meta_ads" || page.parentKey === "crm.meta_ads",
    ).map((page) => ({
      key: page.pageKey,
      path: page.path,
      name: page.name,
      parentKey: page.parentKey,
    })),
  ),
}));

vi.mock("@/lib/navigation/pages", () => ({
  getAuthorizedNavigation: mocks.getAuthorizedNavigation,
}));

vi.mock("@/lib/authorization/enforce", () => ({
  enforcePageAccess: mocks.enforcePageAccess,
}));

vi.mock("@/lib/authorization/page-gates", () => ({
  getProtectedPageGate: () => ({ releaseEnabled: true }),
}));

import MetaAdsDashboardPage from "@/app/(protected)/app/meta-ads/page";
import MetaAdsCampaignsPage from "@/app/(protected)/app/meta-ads/campanhas/page";
import MetaAdsAccountsPage from "@/app/(protected)/app/meta-ads/contas-de-anuncios/page";
import MetaAdsReportsPage from "@/app/(protected)/app/meta-ads/relatorios/page";
import { getVisibleFrameViewport } from "@/app/(protected)/app/meta-ads/MetaAdsDashboardFrame";

const dashboardDocumentUrl = new URL(
  "../app/(protected)/app/meta-ads/dashboard-frame.html",
  import.meta.url,
);

describe("dashboard Meta Ads", () => {
  it("fica em um link proprio da navbar e deixa as visoes no menu lateral", () => {
    expect(PAGE_REGISTRY).toContainEqual(
      expect.objectContaining({
        pageKey: "crm.meta_ads",
        path: "/app/meta-ads",
        permission: "crm.meta_ads.view",
        parentKey: null,
        isNavigation: true,
      }),
    );

    const navigation = getPrimaryNavigation(
      PAGE_REGISTRY.map((page) => ({
        key: page.pageKey,
        path: page.path,
        name: page.name,
        description: page.description,
        section: page.section,
        parentKey: page.parentKey,
        sortOrder: page.sortOrder,
      })),
    );
    const groups = buildNavigationGroups(navigation);
    const dashboard = groups.find((group) => group.page.key === "crm.dashboard");
    const metaAds = groups.find((group) => group.page.key === "crm.meta_ads");

    expect(dashboard?.children).not.toContainEqual(
      expect.objectContaining({ key: "crm.meta_ads" }),
    );
    expect(metaAds).toMatchObject({
      includeOverview: true,
      page: { name: "Meta Ads", path: "/app/meta-ads" },
    });
    expect(metaAds?.children.map((child) => [child.name, child.path])).toEqual([
      ["Campanhas", "/app/meta-ads/campanhas"],
      ["Contas de anúncios", "/app/meta-ads/contas-de-anuncios"],
      ["Relatórios", "/app/meta-ads/relatorios"],
    ]);
    expect(metaAds?.children.map((child) => child.key)).toEqual([
      "crm.meta_ads.campaigns",
      "crm.meta_ads.accounts",
      "crm.meta_ads.reports",
    ]);
    const dashboardIndex = groups.findIndex((group) => group.page.key === "crm.dashboard");
    const leadIndex = groups.findIndex((group) => group.page.key === "crm.leads");
    const metaAdsIndex = groups.findIndex((group) => group.page.key === "crm.meta_ads");
    expect(leadIndex).toBe(dashboardIndex + 1);
    expect(metaAdsIndex).toBe(leadIndex + 1);
  });

  it("abre o menu lateral expandido e permite recolher somente no desktop", async () => {
    const [sidebarSource, styles] = await Promise.all([
      readFile(
        new URL("../app/(protected)/app/meta-ads/MetaAdsSidebar.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/(protected)/app/meta-ads/MetaAdsDashboardFrame.module.css",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    expect(sidebarSource).toContain("useState(false)");
    expect(sidebarSource).toContain('aria-label={collapsed ? "Expandir menu lateral"');
    expect(sidebarSource).toContain("<ChevronLeft");
    expect(sidebarSource).toContain("<ChevronRight");
    expect(sidebarSource).toContain("return MapPinned");
    expect(sidebarSource).toContain("return SlidersHorizontal");
    expect(sidebarSource).toContain("return Megaphone");
    expect(sidebarSource).toContain("<Icon size={19}");
    expect(styles).toContain('.sidebar[data-collapsed="true"]');
    expect(styles).toContain("width: 64px");
    expect(styles).toContain("top: 58px");
    expect(styles).toContain("min-height: calc(100dvh - 58px)");
    expect(styles).toContain(".brand strong");
    expect(styles).toContain("color: inherit");
  });

  it("remove navegacao duplicada do artefato porque as visoes pertencem a navbar", async () => {
    const document = await readFile(dashboardDocumentUrl, "utf8");

    expect(document).not.toContain('<header class="topbar">');
    expect(document).not.toContain('aria-label="Navegação principal"');
    expect(document).not.toContain('aria-label="Aparência"');
    expect(document).not.toContain('id="profile-button"');
    expect(document).not.toContain("<base ");
    expect(document).toContain('src="/descomplica-ads-compact/live-data.js"');
    expect(document).not.toContain('aria-label="Visões do dashboard Meta Ads"');
    expect(document).not.toContain("data-nav=");
    expect(document).not.toContain('id="alerts-button"');
    expect(document).not.toContain('class="dashboard-toolbar"');
  });

  it("carrega a fonte oficial sem substituir falhas por demonstracao", async () => {
    const application = await readFile(
      new URL("../public/descomplica-ads-compact/live-data.js", import.meta.url),
      "utf8",
    );
    expect(application).toContain('fetch("/api/meta-ads/data"');
    expect(application).toContain('payload.source !== "meta_marketing_api"');
    expect(application).toContain("Nenhum dado de demonstração foi exibido");
    expect(application).toContain("Meta API · somente leitura");
    expect(application).not.toContain("let isDemo=!imported");
  });

  it("inicia com campanhas ativas e permite consultar o historico das excluidas", async () => {
    const application = await readFile(
      new URL("../public/descomplica-ads-compact/live-data.js", import.meta.url),
      "utf8",
    );
    expect(application).toContain('status: "active"');
    expect(application).toContain('["archived", "Excluídas/arquivadas (Meta)"]');
    expect(application).toContain("deliveryBadge(c)");
    expect(application).toContain('"ads-filters:v2:"');
  });

  it("separa segmentacao geografica da origem indisponivel dos leads e mostra saldo oficial", async () => {
    const [application, dashboard] = await Promise.all([
      readFile(new URL("../public/descomplica-ads-compact/live-data.js", import.meta.url), "utf8"),
      readFile(new URL("../public/descomplica-ads-compact/app.js", import.meta.url), "utf8"),
    ]);

    expect(application).toContain("row.targetLocations");
    expect(application).toContain("Saldo total informado pela Meta");
    expect(application).toContain("sourceData.accountBalance");
    expect(dashboard).toContain("Segmentação geográfica configurada nas campanhas");
    expect(dashboard).toContain("origem dos leads indisponível");
    expect(dashboard).toContain("Resultados por região · Meta");
    expect(dashboard).toContain("Nenhum dado vem do CRM");
    expect(dashboard).toContain(
      "A Meta não fornece município, bairro ou coordenada de origem de cada lead",
    );
    expect(dashboard).not.toContain("Origem informada pelos leads");
  });

  it("oferece selecionar todos nos filtros multiplos e fecha os menus fora da area", async () => {
    const [application, dashboard, styles] = await Promise.all([
      readFile(new URL("../public/descomplica-ads-compact/live-data.js", import.meta.url), "utf8"),
      readFile(new URL("../public/descomplica-ads-compact/app.js", import.meta.url), "utf8"),
      readFile(new URL("../public/descomplica-ads-compact/style.css", import.meta.url), "utf8"),
    ]);

    expect(application).toContain('data-filter-all="${key}"');
    expect(application).toContain('data-filter-option="${key}"');
    expect(application).toContain("Selecionar todos");
    expect(application).toContain('key: "account"');
    expect(application).toContain('key: "campaigns"');
    expect(application).toContain('key: "status"');
    expect(application).toContain('key: "destination"');
    expect(application).toContain("closeFilterMenus()");
    expect(application).toContain('!e.target.closest("#choose-campaigns")');
    expect(application).toContain('window.addEventListener("blur", () => closeFilterMenus())');
    expect(application).toContain("master.indeterminate");
    expect(dashboard).toContain('e.key === "Escape"');
    expect(styles).toContain(".filter-select-all");
  });

  it("le o documento por caminho textual compativel com o runtime empacotado", async () => {
    const pageSource = await readFile(
      new URL("../app/(protected)/app/meta-ads/MetaAdsPage.tsx", import.meta.url),
      "utf8",
    );

    expect(pageSource).toContain(
      'join(process.cwd(), "app", "(protected)", "app", "meta-ads", "dashboard-frame.html")',
    );
    expect(pageSource).not.toContain('readFile(new URL("./dashboard-frame.html"');
  });

  it("herda os tres temas e os tokens visuais do shell protegido", async () => {
    const [frameSource, dashboardStyles] = await Promise.all([
      readFile(
        new URL("../app/(protected)/app/meta-ads/MetaAdsDashboardFrame.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../public/descomplica-ads-compact/style.css", import.meta.url), "utf8"),
    ]);

    expect(frameSource).toContain('crmTheme === "balanced" ? "medium" : "light"');
    expect(frameSource).toContain('attributeFilter: ["data-theme"]');
    expect(dashboardStyles).toContain("--bg: #0e1d2c;");
    expect(dashboardStyles).toContain("--card: #162b40;");
    expect(dashboardStyles).toContain("body[data-theme");
    expect(dashboardStyles).not.toContain("fonts.googleapis.com");
  });

  it("mantem os modais dentro da area visivel do iframe com rolagem interna", async () => {
    const [frameSource, dashboardStyles, modalSource] = await Promise.all([
      readFile(
        new URL("../app/(protected)/app/meta-ads/MetaAdsDashboardFrame.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../public/descomplica-ads-compact/style.css", import.meta.url), "utf8"),
      readFile(new URL("../public/descomplica-ads-compact/app.js", import.meta.url), "utf8"),
    ]);

    expect(getVisibleFrameViewport({ height: 2400, top: 300 } as DOMRect, 0, 1000)).toEqual({
      height: 700,
      top: 0,
    });
    expect(getVisibleFrameViewport({ height: 2400, top: -500 } as DOMRect, 58, 1000)).toEqual({
      height: 942,
      top: 558,
    });
    expect(frameSource).toContain(
      'document.addEventListener("scroll", scheduleViewportSync, true)',
    );
    expect(dashboardStyles).toContain("top: var(--crm-visible-frame-top, 0px)");
    expect(dashboardStyles).toContain("height: var(--crm-visible-frame-height, 100dvh)");
    expect(dashboardStyles).toContain("overflow-y: auto");
    expect(frameSource).toContain('event.data?.type !== "descomplica:meta-ads-modal-open"');
    expect(frameSource).toContain("window.addEventListener(OPEN_ALERTS_EVENT, openAlerts)");
    expect(modalSource).toContain('type: "descomplica:meta-ads-modal-open"');
  });

  it("leva o estado dos alertas ao sino global e aceita apenas a abertura pedida pelo pai", async () => {
    const application = await readFile(
      new URL("../public/descomplica-ads-compact/live-data.js", import.meta.url),
      "utf8",
    );

    expect(application).toContain('type: "descomplica:meta-ads-alert-state"');
    expect(application).toContain("event.source === window.parent");
    expect(application).not.toContain("$('#alerts-button').addEventListener");
  });

  it("evita nomes aglomerados nos gráficos de comparação", async () => {
    const [application, styles] = await Promise.all([
      readFile(new URL("../public/descomplica-ads-compact/app.js", import.meta.url), "utf8"),
      readFile(new URL("../public/descomplica-ads-compact/style.css", import.meta.url), "utf8"),
    ]);

    expect(application).toContain("function chartLabelLines");
    expect(application).toContain('class="chart-scroll"');
    expect(application).toContain('class="legend chart-campaign-legend"');
    expect(application).not.toContain('x="${x + 9}" y="${y - 8}"');
    expect(styles).toContain(".chart-campaign-legend");
    expect(styles).toContain("overflow-x: auto");
  });

  it("omite destinos que não foram autorizados no catálogo", async () => {
    mocks.getAuthorizedNavigation.mockReturnValueOnce([]);
    const markup = renderToStaticMarkup(await MetaAdsDashboardPage());
    expect(markup).not.toContain('href="/app/meta-ads/campanhas"');
    expect(markup).not.toContain('href="/app/meta-ads/contas-de-anuncios"');
  });

  it("concentra contas de anúncios em Ajustes sem duplicar a navegação lateral", async () => {
    const overviewMarkup = renderToStaticMarkup(await MetaAdsDashboardPage());
    expect(overviewMarkup).not.toContain('href="/app/meta-ads/contas-de-anuncios"');
    expect(overviewMarkup).toContain('href="/app/meta-ads?panel=settings"');

    const legacyMarkup = renderToStaticMarkup(await MetaAdsAccountsPage());
    expect(legacyMarkup).not.toContain('href="/app/meta-ads/contas-de-anuncios"');
    expect(legacyMarkup).toMatch(
      /<a(?=[^>]*href="\/app\/meta-ads\?panel=settings")(?=[^>]*aria-current="page")[^>]*>/,
    );
  });

  it("mantém o mapa visível para Master com cadeado e aviso de manutenção", async () => {
    const markup = renderToStaticMarkup(
      await MetaAdsDashboardPage({ searchParams: Promise.resolve({ panel: "map" }) }),
    );

    expect(markup).toContain('href="/app/meta-ads?panel=map"');
    expect(markup).toContain("Mapa temporariamente desabilitado para melhorias");
    expect(markup).toContain("A visualização permanece disponível para Master");
    expect(markup).toContain("data-crm-view=&quot;map&quot;");
  });

  it("mostra o botão bloqueado do mapa para papéis abaixo de Master", async () => {
    mocks.enforcePageAccess.mockResolvedValueOnce({
      userId: "qa-admin",
      roleKey: "admin",
      level: 80,
      permissions: [],
    });
    const markup = renderToStaticMarkup(await MetaAdsDashboardPage());

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Página temporariamente desabilitada para melhorias");
    expect(markup).not.toContain('href="/app/meta-ads?panel=map"');
  });

  it("impede acesso direto ao painel do mapa para papéis abaixo de Master", async () => {
    mocks.enforcePageAccess.mockResolvedValueOnce({
      userId: "qa-admin",
      roleKey: "admin",
      level: 80,
      permissions: [],
    });

    await expect(
      MetaAdsDashboardPage({ searchParams: Promise.resolve({ panel: "map" }) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT;replace;/app/meta-ads"),
    });
  });

  it("protege cada rota e abre a visao correspondente no mesmo dashboard", async () => {
    const routes = [
      [MetaAdsDashboardPage, "/app/meta-ads", "overview"],
      [MetaAdsCampaignsPage, "/app/meta-ads/campanhas", "campaigns"],
      [MetaAdsAccountsPage, "/app/meta-ads/contas-de-anuncios", "accounts"],
      [MetaAdsReportsPage, "/app/meta-ads/relatorios", "reports"],
    ] as const;

    for (const [renderPage, path, view] of routes) {
      const page = await renderPage();
      const markup = renderToStaticMarkup(page);

      expect(mocks.enforcePageAccess).toHaveBeenCalledWith(path);
      expect(markup).toContain('aria-label="Dashboard Meta Ads"');
      expect(markup).toContain('title="Descomplica Ads — desempenho de campanhas Meta"');
      expect(markup).toContain("srcDoc=");
      expect(markup).toContain('aria-label="Navegação lateral Meta Ads"');
      expect(markup).toContain(
        view === "accounts" ? 'href="/app/meta-ads?panel=settings"' : `href="${path}"`,
      );
      expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
      expect(markup).toContain(`data-crm-view=&quot;${view}&quot;`);
    }

    expect(routes.map(([, path, view]) => [path, view])).toEqual([
      ["/app/meta-ads", "overview"],
      ["/app/meta-ads/campanhas", "campaigns"],
      ["/app/meta-ads/contas-de-anuncios", "accounts"],
      ["/app/meta-ads/relatorios", "reports"],
    ]);
  });
});
