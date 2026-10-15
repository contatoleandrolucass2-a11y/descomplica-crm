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
  getAuthorizedSettingsNavigation,
  getBreadcrumbNavigation,
  getNavigationHome,
  getPrimaryNavigation,
  isNavigationGroupActive,
  isNavigationRootActive,
  type NavigationItem,
} from "../lib/navigation/presentation";
import {
  getAuthorizedNavigation,
  getDisabledNavigationItems,
  type AppPage,
} from "../lib/navigation/pages";
import { PAGE_REGISTRY } from "@/lib/navigation/registry";
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
  it.each(PAGE_REGISTRY)("honors persisted activation and permission for $path", async (entry) => {
    const row: AppPage = {
      key: entry.pageKey,
      path: entry.path,
      name: entry.name,
      description: entry.description,
      section: entry.section,
      parentKey: entry.parentKey,
      sortOrder: entry.sortOrder,
      isNavigation: entry.isNavigation,
      permissionKey: entry.permission,
      isActive: true,
    };
    const context: AuthorizationContext = {
      ...viewerContext,
      roleKey: "admin",
      permissions: ["pages.view", entry.permission],
    };
    configurePageCatalog([pageRow(row)]);
    expect(await getAuthorizedNavigation(context)).toEqual([row]);
    configurePageCatalog([pageRow({ ...row, isActive: false })]);
    expect(await getAuthorizedNavigation(context)).toEqual([]);
    configurePageCatalog([]); // RLS also omits disabled rows entirely.
    expect(await getAuthorizedNavigation(context)).toEqual([]);
    configurePageCatalog([pageRow(row)]);
    expect(await getAuthorizedNavigation({ ...context, permissions: ["pages.view"] })).toEqual([]);
  });

  it("retains the additional Repasse role restriction", async () => {
    const entry = PAGE_REGISTRY.find((page) => page.pageKey === "crm.repasse")!;
    configurePageCatalog([
      pageRow({ ...entry, key: entry.pageKey, permissionKey: entry.permission, isActive: true }),
    ]);
    expect(
      await getAuthorizedNavigation({
        ...viewerContext,
        roleKey: "coordinator",
        permissions: ["pages.view", "crm.partnerships.view"],
      }),
    ).toEqual([]);
  });

  it.each([
    { isActive: false },
    { isNavigation: false },
    { path: "/app/collision" },
    { key: "crm.catalog.collision" },
    { permissionKey: "crm.settings.manage" as const },
  ])(
    "does not recreate a disabled or conflicting management catalog entry: %j",
    async (override) => {
      const dashboard: AppPage = {
        ...simulationParent,
        key: "crm.dashboard",
        path: "/app",
        section: "crm",
        permissionKey: "crm.dashboard.view",
      };
      const management: AppPage = {
        ...dashboard,
        key: "crm.management",
        path: "/app/gestao",
        section: "management",
        ...override,
      };
      configurePageCatalog([dashboard, management].map(pageRow));
      const result = await getAuthorizedNavigation({
        ...viewerContext,
        permissions: ["pages.view", "crm.dashboard.view"],
      });
      expect(result).toEqual([dashboard]);
    },
  );

  it.each([false, true])("preserves a catalog-owned routine when active=%s", async (isActive) => {
    const dashboard: AppPage = {
      ...simulationParent,
      key: "crm.dashboard",
      path: "/app",
      section: "crm",
      permissionKey: "crm.dashboard.view",
    };
    const routine: AppPage = {
      ...dashboard,
      key: "crm.management.routine",
      path: "/app/gestao/rotina",
      section: "management",
      parentKey: "crm.management",
      isActive,
    };
    configurePageCatalog([dashboard, routine].map(pageRow));
    const result = await getAuthorizedNavigation({
      ...viewerContext,
      permissions: ["pages.view", "crm.dashboard.view"],
    });
    expect(result.filter((page) => page.key === routine.key)).toEqual(isActive ? [routine] : []);
    expect(result.some((page) => page.key === "crm.management")).toBe(false);
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
        key: "crm.management",
        path: "/app/gestao",
        name: "Gestão",
        description: "Gestão autorizada",
        section: "management",
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
      "/app/gestao",
      "/app/configuracoes",
    ]);
    expect(buildNavigationGroups(authorizedRoots).flatMap(({ page }) => page)).toHaveLength(
      authorizedRoots.length,
    );
  });

  it("keeps Simulation direct, Settings in the account and Admin grouped in the navbar", () => {
    const settings: NavigationItem = {
      key: "crm.settings",
      path: "/app/configuracoes",
      name: "Configurações",
      description: "Metas e pontuação",
      section: "settings",
      parentKey: null,
      sortOrder: 10,
    };
    const goals: NavigationItem = {
      ...settings,
      key: "crm.settings.goals",
      path: "/app/configuracoes/metas",
      name: "Metas do funil",
      parentKey: settings.key,
      sortOrder: 20,
    };
    const integrations: NavigationItem = {
      ...settings,
      key: "crm.settings.connected_systems",
      path: "/app/configuracoes/conectar-sistemas",
      name: "Integrações",
      parentKey: settings.key,
      sortOrder: 60,
    };
    const simulationChild: NavigationItem = {
      ...simulationParent,
      key: "crm.simulation.wf14",
      path: "/app/simulacao/tabela-direta",
      name: "Tabela Direta",
      parentKey: simulationParent.key,
      sortOrder: 30,
    };
    const admin: NavigationItem = {
      key: "admin.home",
      path: "/admin",
      name: "Administração",
      description: "Gestão do CRM",
      section: "admin",
      parentKey: null,
      sortOrder: 10,
    };
    const users: NavigationItem = {
      ...admin,
      key: "admin.users",
      path: "/admin/usuarios",
      name: "Usuários",
      parentKey: admin.key,
      sortOrder: 20,
    };
    const catalog: NavigationItem = {
      ...admin,
      key: "admin.pages",
      path: "/admin/paginas",
      name: "Páginas",
      parentKey: admin.key,
      sortOrder: 30,
    };

    const source = [
      settings,
      goals,
      integrations,
      simulationParent,
      simulationChild,
      admin,
      users,
      catalog,
    ];
    const primary = getPrimaryNavigation(source);
    const groups = buildNavigationGroups(primary);

    expect(groups.map(({ page }) => page.path)).toEqual(["/app/simulacao", "/admin"]);
    expect(groups[0]?.children).toEqual([]);
    expect(groups[1]?.includeOverview).toBe(false);
    expect(groups[1]?.children.map((page) => [page.name, page.path])).toEqual([
      ["Usuários", "/admin/usuarios"],
      ["Páginas", "/admin/paginas"],
      ["Integrações", "/app/configuracoes/conectar-sistemas"],
    ]);
    expect(getAuthorizedSettingsNavigation(source).map((page) => page.path)).toEqual([
      "/app/configuracoes",
      "/app/configuracoes/metas",
    ]);
    expect(
      getAuthorizedSettingsNavigation([settings, integrations]).map((page) => page.path),
    ).toEqual(["/app/configuracoes", "/app/configuracoes/conectar-sistemas"]);
    expect(
      buildBreadcrumbs("/app/configuracoes/conectar-sistemas", getBreadcrumbNavigation(source)).map(
        (page) => page.name,
      ),
    ).toEqual(["Administração", "Integrações"]);
    expect(isNavigationRootActive("/app/simulacao/tabelao", simulationParent)).toBe(true);
    expect(isNavigationRootActive("/app/ranking/detalhe", simulationParent)).toBe(false);
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

  it("uses only persisted catalog rows and never fabricates absent pages", async () => {
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

    expect(query.eq).not.toHaveBeenCalled();
    expect(result.map((page) => page.name)).not.toContain("Administração sigilosa");
    expect(result.map((page) => page.name)).toContain("CAIXA do catálogo");
    expect(result.map((page) => page.name)).not.toContain("Tabela Direta divergente");
    expect(result.map((page) => page.key)).toContain("crm.simulation.caixa");
    expect(result.map((page) => page.key)).not.toContain("crm.simulation.wf14-shadow");
    expect(result.map((page) => page.path)).toEqual([
      "/app",
      "/app/simulacao",
      "/app/simulacao/caixa",
    ]);
  });
});
