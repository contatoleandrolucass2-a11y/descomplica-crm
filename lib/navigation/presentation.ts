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

const ROOT_NAVIGATION_ORDER = new Map([
  ["/app", 10],
  ["/app/simulacao", 20],
  ["/app/ranking", 30],
  ["/app/canal-de-parcerias", 40],
  [ADMIN_ROOT_PATH, 50],
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
  const rootPages = pages.filter((page) => page.parentKey === null).sort(compareRootPages);

  return rootPages.map((page) => ({
    page,
    children: pages.filter((candidate) => candidate.parentKey === page.key).sort(comparePages),
    includeOverview: page.key !== ADMIN_ROOT_KEY,
  }));
}

/**
 * Builds the approved top-level navigation without widening authorization.
 * Settings stay in the account menu, simulation children stay in their hub,
 * and the already-authorized integrations route is presented under Admin.
 */
export function getPrimaryNavigation(pages: NavigationItem[]): NavigationItem[] {
  const adminRoot = pages.find(
    (page) =>
      page.key === ADMIN_ROOT_KEY &&
      page.path === ADMIN_ROOT_PATH &&
      page.section === "admin" &&
      page.parentKey === null,
  );
  const primary: NavigationItem[] = [];

  for (const page of pages) {
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
  if (!root) return [];
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

/** Keeps breadcrumb ownership consistent with the approved Admin grouping. */
export function getBreadcrumbNavigation(pages: NavigationItem[]): NavigationItem[] {
  const adminRoot = pages.find(
    (page) =>
      page.key === ADMIN_ROOT_KEY &&
      page.path === ADMIN_ROOT_PATH &&
      page.section === "admin" &&
      page.parentKey === null,
  );
  if (!adminRoot) return pages;

  return pages.map((page) =>
    page.key === CONNECTED_SYSTEMS_KEY &&
    page.path === CONNECTED_SYSTEMS_PATH &&
    page.section === "settings" &&
    page.parentKey === SETTINGS_ROOT_KEY
      ? {
          ...page,
          section: "admin",
          parentKey: adminRoot.key,
          sortOrder: 40,
        }
      : page,
  );
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
  return pathname === group.page.path || group.children.some((child) => pathname === child.path);
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
