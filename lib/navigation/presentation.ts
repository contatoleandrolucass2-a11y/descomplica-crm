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
}

const ROOT_NAVIGATION_ORDER = new Map([
  ["/app", 10],
  ["/app/simulacao", 20],
  ["/app/ranking", 30],
  ["/app/canal-de-parcerias", 40],
  ["/app/configuracoes", 50],
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
  }));
}

export function getNavigationHome(pages: NavigationItem[]) {
  const groups = buildNavigationGroups(pages);
  return groups.find((group) => group.page.path === "/app")?.page ?? groups[0]?.page ?? null;
}

export function getAuthorizedAdminNavigation(pages: NavigationItem[]) {
  const root = pages.find(
    (page) =>
      page.key === "admin.home" &&
      page.path === "/admin" &&
      page.section === "admin" &&
      page.parentKey === null,
  );
  if (!root) return [];

  return [root, ...pages.filter((page) => page.parentKey === root.key).sort(comparePages)];
}

export function isNavigationGroupActive(pathname: string, group: NavigationGroup) {
  return pathname === group.page.path || group.children.some((child) => pathname === child.path);
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
