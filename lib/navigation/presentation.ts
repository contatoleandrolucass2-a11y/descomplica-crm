import { PAGE_REGISTRY } from "./registry";

export interface NavigationItem {
  key: string;
  path: string;
  name: string;
  description: string;
  section: string;
  parentKey: string | null;
  sortOrder: number;
}

/**
 * Presentation-only entry for a journey that an authorized user may discover,
 * but cannot open yet. Deliberately omits `path` so the client cannot turn a
 * blocked release into a navigable link by mistake.
 */
export interface DisabledNavigationItem {
  key: string;
  name: string;
  description: string;
  section: string;
  parentKey: string;
  sortOrder: number;
  reason: string;
}

export interface NavigationGroup {
  page: NavigationItem;
  children: NavigationItem[];
  includeOverview: boolean;
}

const ADMIN_ROOT_KEY = "admin.home";
const ADMIN_ROOT_PATH = "/admin";
const CONNECTED_SYSTEMS_KEY = "crm.settings.connected_systems";
const CONNECTED_SYSTEMS_PATH = "/app/configuracoes/conectar-sistemas";
const SETTINGS_ROOT_KEY = "crm.settings";
const SETTINGS_ROOT_PATH = "/app/configuracoes";
const SIMULATION_ROOT_KEY = "crm.simulation";
const MANAGEMENT_ROOT_KEY = "crm.management";
const GOALS_KEY = "crm.settings.goals";
const GOALS_PATH = "/app/configuracoes/metas";
const GOAL_SUBPAGES = new Map([
  ["crm.settings.partnerships", `${GOALS_PATH}/parcerias`],
  ["crm.settings.points", `${GOALS_PATH}/pontos`],
]);

function getManagementGoals(pages: NavigationItem[]): NavigationItem | undefined {
  const management = pages.find(
    (page) =>
      page.key === MANAGEMENT_ROOT_KEY &&
      page.path === "/app/gestao" &&
      page.section === "management" &&
      page.parentKey === null,
  );
  const goals = pages.find(
    (page) =>
      page.key === GOALS_KEY &&
      page.path === GOALS_PATH &&
      page.section === "settings" &&
      page.parentKey === SETTINGS_ROOT_KEY,
  );
  if (!management || !goals) return undefined;
  return {
    ...goals,
    name: "Meta",
    section: "management",
    parentKey: management.key,
    sortOrder: 30,
  };
}

const ROOT_NAVIGATION_ORDER = new Map([
  ["/app", 10],
  ["/app/meta-ads", 15],
  ["/app/simulacao", 20],
  ["/app/ranking", 30],
  ["/app/canal-de-parcerias", 40],
  ["/app/gestao", 50],
  [ADMIN_ROOT_PATH, 60],
]);

function comparePages(left: NavigationItem, right: NavigationItem) {
  return (
    left.section.localeCompare(right.section, "pt-BR") ||
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name, "pt-BR")
  );
}

function compareRootPages(left: NavigationItem, right: NavigationItem) {
  const leftOrder = ROOT_NAVIGATION_ORDER.get(left.path) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = ROOT_NAVIGATION_ORDER.get(right.path) ?? Number.MAX_SAFE_INTEGER;

  return leftOrder - rightOrder || comparePages(left, right);
}

export function buildNavigationGroups(pages: NavigationItem[]): NavigationGroup[] {
  const keys = new Set(pages.map((page) => page.key));
  const rootPages = pages
    .filter(
      (page) =>
        page.parentKey === null ||
        (page.section !== "admin" &&
          !keys.has(page.parentKey) &&
          PAGE_REGISTRY.some((entry) => entry.pageKey === page.key && entry.path === page.path)),
    )
    .sort(compareRootPages);

  return rootPages.map((page) => ({
    page,
    children: pages.filter((candidate) => candidate.parentKey === page.key).sort(comparePages),
    includeOverview: page.key !== ADMIN_ROOT_KEY,
  }));
}

/**
 * Builds the approved top-level navigation without widening authorization.
 * Settings stay in the account menu, simulation children stay in their hub,
 * and already-authorized integrations and goals appear under Admin and Gestão.
 */
export function getPrimaryNavigation(pages: NavigationItem[]): NavigationItem[] {
  const managementGoals = getManagementGoals(pages);
  const adminRoot = pages.find(
    (page) =>
      page.key === ADMIN_ROOT_KEY &&
      page.path === ADMIN_ROOT_PATH &&
      page.section === "admin" &&
      page.parentKey === null,
  );
  const primary: NavigationItem[] = [];

  for (const page of pages) {
    if (managementGoals && page.key === GOALS_KEY) {
      primary.push(managementGoals);
      continue;
    }
    if (page.key === CONNECTED_SYSTEMS_KEY) {
      if (
        adminRoot &&
        page.path === CONNECTED_SYSTEMS_PATH &&
        page.section === "settings" &&
        page.parentKey === SETTINGS_ROOT_KEY
      ) {
        primary.push({
          ...page,
          section: "admin",
          parentKey: adminRoot.key,
          sortOrder: 40,
        });
      }
      continue;
    }

    if (
      page.key === SETTINGS_ROOT_KEY ||
      page.section === "settings" ||
      page.parentKey === SETTINGS_ROOT_KEY ||
      page.parentKey === SIMULATION_ROOT_KEY
    ) {
      continue;
    }

    primary.push(page);
  }

  return primary;
}

export function getAuthorizedSettingsNavigation(pages: NavigationItem[]) {
  const root = pages.find(
    (page) =>
      page.key === SETTINGS_ROOT_KEY &&
      page.path === SETTINGS_ROOT_PATH &&
      page.section === "settings" &&
      page.parentKey === null,
  );
  if (!root) return pages.filter((page) => page.section === "settings").sort(comparePages);
  const integrationsPresentedInAdmin = pages.some(
    (page) =>
      page.key === ADMIN_ROOT_KEY &&
      page.path === ADMIN_ROOT_PATH &&
      page.section === "admin" &&
      page.parentKey === null,
  );

  return [
    root,
    ...pages
      .filter(
        (page) =>
          page.parentKey === root.key &&
          page.section === "settings" &&
          (!integrationsPresentedInAdmin || page.key !== CONNECTED_SYSTEMS_KEY),
      )
      .sort(comparePages),
  ];
}

/** Keeps breadcrumb ownership consistent with the approved navbar grouping. */
export function getBreadcrumbNavigation(pages: NavigationItem[]): NavigationItem[] {
  const managementGoals = getManagementGoals(pages);
  const adminRoot = pages.find(
    (page) =>
      page.key === ADMIN_ROOT_KEY &&
      page.path === ADMIN_ROOT_PATH &&
      page.section === "admin" &&
      page.parentKey === null,
  );
  return pages.map((page) => {
    if (managementGoals && page.key === GOALS_KEY) return managementGoals;
    if (
      managementGoals &&
      GOAL_SUBPAGES.get(page.key) === page.path &&
      page.section === "settings" &&
      page.parentKey === SETTINGS_ROOT_KEY
    ) {
      return { ...page, section: "management", parentKey: managementGoals.key };
    }
    if (
      adminRoot &&
      page.key === CONNECTED_SYSTEMS_KEY &&
      page.path === CONNECTED_SYSTEMS_PATH &&
      page.section === "settings" &&
      page.parentKey === SETTINGS_ROOT_KEY
    ) {
      return { ...page, section: "admin", parentKey: adminRoot.key, sortOrder: 40 };
    }
    return page;
  });
}

export function getNavigationHome(pages: NavigationItem[]) {
  const groups = buildNavigationGroups(pages);
  return groups.find((group) => group.page.path === "/app")?.page ?? groups[0]?.page ?? null;
}

export function getAuthorizedAdminNavigation(pages: NavigationItem[]) {
  const primary = getPrimaryNavigation(pages);
  const root = primary.find(
    (page) =>
      page.key === ADMIN_ROOT_KEY &&
      page.path === ADMIN_ROOT_PATH &&
      page.section === "admin" &&
      page.parentKey === null,
  );
  if (!root) return [];

  return [root, ...primary.filter((page) => page.parentKey === root.key).sort(comparePages)];
}

export function isNavigationGroupActive(pathname: string, group: NavigationGroup) {
  return (
    pathname === group.page.path ||
    group.children.some(
      (child) =>
        pathname === child.path ||
        (child.key === GOALS_KEY &&
          child.path === GOALS_PATH &&
          [...GOAL_SUBPAGES.values()].includes(pathname)),
    )
  );
}

export function isNavigationRootActive(pathname: string, page: NavigationItem) {
  return (
    pathname === page.path ||
    (page.key === SIMULATION_ROOT_KEY && pathname.startsWith(`${page.path}/`))
  );
}

export function buildBreadcrumbs(pathname: string, pages: NavigationItem[]): NavigationItem[] {
  const byKey = new Map(pages.map((page) => [page.key, page]));
  const current = pages.find((page) => page.path === pathname);
  if (!current) return [];

  const chain: NavigationItem[] = [];
  const visited = new Set<string>();
  let cursor: NavigationItem | undefined = current;
  while (cursor && !visited.has(cursor.key)) {
    visited.add(cursor.key);
    chain.unshift(cursor);
    cursor = cursor.parentKey ? byKey.get(cursor.parentKey) : undefined;
  }
  return chain;
}
