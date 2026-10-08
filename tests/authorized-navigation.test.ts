import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/authorization/guards", () => ({ requirePermission: vi.fn() }));

import {
  buildBreadcrumbs,
  buildNavigationGroups,
  getAuthorizedAdminNavigation,
  getNavigationHome,
  isNavigationGroupActive,
  type NavigationItem,
} from "../lib/navigation/presentation";
import {
  extendAuthorizedNavigationWithReleasedPages,
  getAuthorizedNavigation,
  getDisabledNavigationItems,
  type AppPage,
} from "../lib/navigation/pages";
import type { AuthorizationContext } from "../lib/authorization/types";

const pages: NavigationItem[] = [
  {
    key: "crm.stage.visits",
    path: "/app/etapas/visitas",
    name: "Visitas",
    description: "Detalhe",
    section: "crm",
    parentKey: "crm.dashboard",
    sortOrder: 40,
  },
  {
    key: "crm.dashboard",
    path: "/app",
    name: "Dashboard",
    description: "Visão geral",
    section: "crm",
    parentKey: null,
    sortOrder: 10,
  },
  {
    key: "crm.stage.opportunities",
    path: "/app/etapas/oportunidades",
    name: "Oportunidades",
    description: "Detalhe",
    section: "crm",
    parentKey: "crm.dashboard",
    sortOrder: 20,
  },
  {
    key: "hidden.orphan",
    path: "/hidden",
    name: "Órfã",
    description: "Pai não autorizado",
    section: "crm",
    parentKey: "hidden.parent",
    sortOrder: 1,
  },
];

const viewerContext: AuthorizationContext = {
  userId: "10000000-0000-4000-8000-000000000001",
  roleKey: "user",
  level: 10,
  permissions: ["pages.view", "crm.simulators.view"],
};

const simulationParent: AppPage = {
  key: "crm.simulation",
  path: "/app/simulacao",
  name: "Simulação",
  description: "Ferramentas autorizadas",
  section: "simulation",
  permissionKey: "crm.simulators.view",
  parentKey: null,
  sortOrder: 10,
  isNavigation: true,
  isActive: true,
};

function pageRow(page: AppPage) {
  return {
    key: page.key,
    path: page.path,
    name: page.name,
    description: page.description,
    section: page.section,
    permission_key: page.permissionKey,
    parent_key: page.parentKey,
    sort_order: page.sortOrder,
    is_navigation: page.isNavigation,
    is_active: page.isActive,
  };
}

function configurePageCatalog(rows: unknown[]) {
  type QueryResult = { data: unknown[]; error: null };
  type PageQuery = Promise<QueryResult> & {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  };

  const query = Promise.resolve({ data: rows, error: null }) as PageQuery;
  query.select = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  const from = vi.fn(() => query);
  mocks.createClient.mockResolvedValue({ from });
  return { from, query };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorized hierarchical navigation", () => {
  it("adds Repasse only under the active Dashboard for Master with partnership access", () => {
    const dashboard: AppPage = {
      ...simulationParent,
      key: "crm.dashboard",
      path: "/app",
      name: "Dashboard",
      section: "crm",
      permissionKey: "crm.dashboard.view",
    };
    const context: AuthorizationContext = {
      ...viewerContext,
      roleKey: "master",
      permissions: ["pages.view", "crm.dashboard.view", "crm.partnerships.view"],
    };
    const result = extendAuthorizedNavigationWithReleasedPages([dashboard], context);

    expect(result.map((page) => page.path)).toEqual(["/app", "/app/repasse"]);
    expect(buildBreadcrumbs("/app/repasse", result).map((page) => page.name)).toEqual([
      "Dashboard",
      "Repasse",
    ]);
    expect(
      extendAuthorizedNavigationWithReleasedPages([dashboard], {
        ...context,
        roleKey: "coordinator",
      }),
    ).toEqual([dashboard]);
    expect(
      extendAuthorizedNavigationWithReleasedPages([dashboard], {
        ...context,
        permissions: ["pages.view", "crm.dashboard.view"],
      }),
    ).toEqual([dashboard]);
    expect(
      extendAuthorizedNavigationWithReleasedPages(
        [{ ...dashboard, path: "/app/divergent" }],
        context,
      ),
    ).toHaveLength(1);
    expect(extendAuthorizedNavigationWithReleasedPages(result, context)).toEqual(result);
  });

  it("adds settings tools only under the active authorized root with management permission", () => {
    const settings: AppPage = {
      ...simulationParent,
      key: "crm.settings",
      path: "/app/configuracoes",
      name: "Configurações",
      section: "settings",
      permissionKey: "crm.settings.view",
    };
    const context: AuthorizationContext = {
      ...viewerContext,
      permissions: ["pages.view", "crm.settings.view", "crm.settings.manage"],
    };
    const result = extendAuthorizedNavigationWithReleasedPages([settings], context);
    expect(result.map((page) => page.path)).toEqual([
      "/app/configuracoes",
      "/app/configuracoes/recurso-mkt",
      "/app/configuracoes/conectar-sistemas",
    ]);
    expect(
      buildBreadcrumbs("/app/configuracoes/recurso-mkt", result).map((page) => page.name),
    ).toEqual(["Configurações", "Recurso MKT"]);
    expect(
      buildBreadcrumbs("/app/configuracoes/conectar-sistemas", result).map((page) => page.name),
    ).toEqual(["Configurações", "Conectar Sistemas"]);
    expect(extendAuthorizedNavigationWithReleasedPages([settings], viewerContext)).toEqual([
      settings,
    ]);
    expect(extendAuthorizedNavigationWithReleasedPages([], context)).toEqual([]);
    expect(
      extendAuthorizedNavigationWithReleasedPages([{ ...settings, isActive: false }], context),
    ).toHaveLength(1);
    expect(
      extendAuthorizedNavigationWithReleasedPages(
        [{ ...settings, path: "/app/divergent" }],
        context,
      ),
    ).toHaveLength(1);
    expect(extendAuthorizedNavigationWithReleasedPages(result, context)).toEqual(result);
    expect(
      extendAuthorizedNavigationWithReleasedPages(
        [settings, { ...settings, key: "crm.settings.marketing", path: "/app/collision" }],
        context,
      ),
    ).toHaveLength(3);
    const collision = extendAuthorizedNavigationWithReleasedPages(
      [settings, { ...settings, key: "crm.settings.connected_systems", path: "/app/collision" }],
      context,
    );
    expect(collision.some((page) => page.path === "/app/configuracoes/conectar-sistemas")).toBe(
      false,
    );
  });
  it("keeps the approved root order without creating unauthorized entries", () => {
    const authorizedRoots: NavigationItem[] = [
      {
        key: "crm.settings",
        path: "/app/configuracoes",
        name: "Configurações",
        description: "Configurações autorizadas",
        section: "settings",
        parentKey: null,
        sortOrder: 10,
      },
      {
        key: "crm.partnerships",
        path: "/app/canal-de-parcerias",
        name: "Canal de Parcerias",
        description: "Canal autorizado",
        section: "partnerships",
        parentKey: null,
        sortOrder: 10,
      },
      {
        key: "crm.ranking",
        path: "/app/ranking",
        name: "Ranking",
        description: "Ranking autorizado",
        section: "crm",
        parentKey: null,
        sortOrder: 70,
      },
      {
        key: "crm.simulation",
        path: "/app/simulacao",
        name: "Simulação",
        description: "Simulação autorizada",
        section: "simulation",
        parentKey: null,
        sortOrder: 10,
      },
      {
        key: "crm.dashboard",
        path: "/app",
        name: "Dashboard",
        description: "Dashboard autorizado",
        section: "crm",
        parentKey: null,
        sortOrder: 10,
      },
    ];

    expect(buildNavigationGroups(authorizedRoots).map(({ page }) => page.path)).toEqual([
      "/app",
      "/app/simulacao",
      "/app/ranking",
      "/app/canal-de-parcerias",
      "/app/configuracoes",
    ]);
    expect(buildNavigationGroups(authorizedRoots).flatMap(({ page }) => page)).toHaveLength(
      authorizedRoots.length,
    );
  });

  it("groups only children whose authorized parent is present", () => {
    const groups = buildNavigationGroups(pages);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.page.key).toBe("crm.dashboard");
    expect(groups[0]?.children.map((page) => page.key)).toEqual([
      "crm.stage.opportunities",
      "crm.stage.visits",
    ]);
    expect(JSON.stringify(groups)).not.toContain("hidden.orphan");
  });

  it("marks the authorized ancestor active only for a known child", () => {
    const group = buildNavigationGroups(pages)[0]!;

    expect(isNavigationGroupActive("/app", group)).toBe(true);
    expect(isNavigationGroupActive("/app/etapas/visitas", group)).toBe(true);
    expect(isNavigationGroupActive("/app/ranking", group)).toBe(false);
  });

  it("uses only an authorized root as the brand destination", () => {
    expect(getNavigationHome(pages)?.path).toBe("/app");
    expect(getNavigationHome(pages.filter((page) => page.key !== "crm.dashboard"))).toBeNull();
    expect(
      getNavigationHome([
        {
          key: "crm.ranking",
          path: "/app/ranking",
          name: "Ranking",
          description: "Ranking autorizado",
          section: "crm",
          parentKey: null,
          sortOrder: 30,
        },
      ])?.path,
    ).toBe("/app/ranking");
  });

  it("builds a cycle-safe breadcrumb only from authorized catalog entries", () => {
    expect(buildBreadcrumbs("/app/etapas/visitas", pages).map((page) => page.name)).toEqual([
      "Dashboard",
      "Visitas",
    ]);
    expect(buildBreadcrumbs("/app/admin/secret", pages)).toEqual([]);
  });

  it("keeps orphan or divergent admin pages out of the account navigation", () => {
    const child: NavigationItem = {
      key: "admin.users",
      path: "/admin/usuarios",
      name: "Usuários",
      description: "Gerenciar usuários",
      section: "admin",
      parentKey: "admin.home",
      sortOrder: 20,
    };
    const divergentRoot: NavigationItem = {
      ...child,
      key: "admin.home",
      path: "/admin-divergente",
      name: "Administração",
      parentKey: null,
      sortOrder: 10,
    };

    expect(getAuthorizedAdminNavigation([child])).toEqual([]);
    expect(getAuthorizedAdminNavigation([divergentRoot, child])).toEqual([]);
  });

  it("orders authorized admin children only after the exact authorized root", () => {
    const root: NavigationItem = {
      key: "admin.home",
      path: "/admin",
      name: "Administração",
      description: "Início administrativo",
      section: "admin",
      parentKey: null,
      sortOrder: 10,
    };
    const users: NavigationItem = {
      ...root,
      key: "admin.users",
      path: "/admin/usuarios",
      name: "Usuários",
      parentKey: root.key,
      sortOrder: 30,
    };
    const pagesAdmin: NavigationItem = {
      ...root,
      key: "admin.pages",
      path: "/admin/paginas",
      name: "Páginas",
      parentKey: root.key,
      sortOrder: 20,
    };

    expect(getAuthorizedAdminNavigation([users, root, pagesAdmin])).toEqual([
      root,
      pagesAdmin,
      users,
    ]);
  });

  it("adds only released supplemental simulators after their authorized parent", () => {
    const result = extendAuthorizedNavigationWithReleasedPages([simulationParent], viewerContext);
    const supplemental = result.filter((page) => page.key !== simulationParent.key);

    expect(supplemental.map((page) => page.path)).toEqual([
      "/app/simulacao/tabela-direta",
      "/app/simulacao/tabela-investidor",
      "/app/simulacao/tabelao",
      "/app/simulacao/calcular-documentacao",
      "/app/simulacao/caixa",
    ]);
    expect(
      supplemental.every(
        (page) =>
          page.permissionKey === "crm.simulators.view" &&
          page.parentKey === simulationParent.key &&
          page.isNavigation &&
          page.isActive,
      ),
    ).toBe(true);
    expect(result.map((page) => page.path)).toContain("/app/simulacao/caixa");
  });

  it("does not expose supplemental labels without permission or an authorized root", () => {
    const withoutPermission = extendAuthorizedNavigationWithReleasedPages([simulationParent], {
      ...viewerContext,
      permissions: ["pages.view"],
    });
    const withoutParent = extendAuthorizedNavigationWithReleasedPages([], viewerContext);

    expect(withoutPermission).toEqual([simulationParent]);
    expect(withoutParent).toEqual([]);
    expect(JSON.stringify([withoutPermission, withoutParent])).not.toMatch(
      /Tabela Direta|Tabela Investidor|Tabelão|Documentação|CAIXA/,
    );
  });

  it("fails closed when the simulator parent key collides with another catalog identity", () => {
    const conflictingParent: AppPage = {
      ...simulationParent,
      path: "/app/catalog-collision",
      section: "crm",
      permissionKey: "crm.dashboard.view",
    };

    expect(extendAuthorizedNavigationWithReleasedPages([conflictingParent], viewerContext)).toEqual(
      [conflictingParent],
    );
    expect(getDisabledNavigationItems(viewerContext, [conflictingParent])).toEqual([]);
  });

  it("fails closed per supplemental entry when a catalog key or path collides", () => {
    const keyCollision: AppPage = {
      ...simulationParent,
      key: "crm.simulation.wf14",
      path: "/app/catalog-owned",
      name: "Entrada do catálogo",
      parentKey: simulationParent.key,
      sortOrder: 20,
    };
    const pathCollision: AppPage = {
      ...simulationParent,
      key: "crm.simulation.catalog-collision",
      path: "/app/simulacao/tabela-investidor",
      name: "Caminho do catálogo",
      parentKey: simulationParent.key,
      sortOrder: 25,
    };

    const result = extendAuthorizedNavigationWithReleasedPages(
      [simulationParent, keyCollision, pathCollision],
      viewerContext,
    );

    expect(result.filter((page) => page.key === keyCollision.key)).toEqual([keyCollision]);
    expect(result.filter((page) => page.path === pathCollision.path)).toEqual([pathCollision]);
    expect(result).not.toContainEqual(
      expect.objectContaining({
        key: "crm.simulation.wf14",
        path: "/app/simulacao/tabela-direta",
      }),
    );
    expect(result).not.toContainEqual(
      expect.objectContaining({
        key: "crm.simulation.wf15",
        path: "/app/simulacao/tabela-investidor",
      }),
    );
  });

  it("does not duplicate CAIXA as a pathless item after its protected page is released", () => {
    const blocked = getDisabledNavigationItems(viewerContext, [simulationParent]);

    expect(blocked).toEqual([]);
    expect(
      getDisabledNavigationItems({ ...viewerContext, permissions: ["pages.view"] }, [
        simulationParent,
      ]),
    ).toEqual([]);
    expect(getDisabledNavigationItems(viewerContext, [])).toEqual([]);
  });

  it("queries no catalog and leaks no labels when pages.view is absent", async () => {
    const result = await getAuthorizedNavigation({
      ...viewerContext,
      permissions: ["crm.simulators.view"],
    });

    expect(result).toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("filters catalog rows before deriving supplemental navigation", async () => {
    const dashboard: AppPage = {
      ...simulationParent,
      key: "crm.dashboard",
      path: "/app",
      name: "Dashboard",
      description: "Visão geral",
      section: "crm",
      permissionKey: "crm.dashboard.view",
    };
    const admin: AppPage = {
      ...simulationParent,
      key: "admin.home",
      path: "/admin",
      name: "Administração sigilosa",
      description: "Não autorizada",
      section: "admin",
      permissionKey: "admin.access",
    };
    const catalogCaixa: AppPage = {
      ...simulationParent,
      key: "crm.simulation.caixa",
      path: "/app/simulacao/caixa",
      name: "CAIXA do catálogo",
      parentKey: simulationParent.key,
      sortOrder: 70,
    };
    const mismatchedGateIdentity: AppPage = {
      ...simulationParent,
      key: "crm.simulation.wf14-shadow",
      path: "/app/simulacao/tabela-direta",
      name: "Tabela Direta divergente",
      parentKey: simulationParent.key,
      sortOrder: 30,
    };
    const { query } = configurePageCatalog(
      [dashboard, simulationParent, admin, catalogCaixa, mismatchedGateIdentity].map((page) =>
        pageRow(page),
      ),
    );

    const result = await getAuthorizedNavigation({
      ...viewerContext,
      permissions: ["pages.view", "crm.simulators.view", "crm.dashboard.view"],
    });

    expect(query.eq).toHaveBeenCalledWith("is_navigation", true);
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(result.map((page) => page.name)).not.toContain("Administração sigilosa");
    expect(result.map((page) => page.name)).toContain("CAIXA do catálogo");
    expect(result.map((page) => page.name)).not.toContain("Tabela Direta divergente");
    expect(result.map((page) => page.key)).toContain("crm.simulation.caixa");
    expect(result.map((page) => page.key)).not.toContain("crm.simulation.wf14-shadow");
    expect(result.map((page) => page.path)).toEqual([
      "/app",
      "/app/simulacao",
      "/app/simulacao/caixa",
      "/app/simulacao/tabela-direta",
      "/app/simulacao/tabela-investidor",
      "/app/simulacao/tabelao",
      "/app/simulacao/calcular-documentacao",
    ]);
  });
});
