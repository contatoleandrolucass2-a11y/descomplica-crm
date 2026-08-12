export interface NavigationItem {
  key: string;
  path: string;
  name: string;
  description: string;
  section: string;
  parentKey: string | null;
  sortOrder: number;
}

export interface NavigationGroup {
  page: NavigationItem;
  children: NavigationItem[];
}

function comparePages(left: NavigationItem, right: NavigationItem) {
  return (
    left.section.localeCompare(right.section, "pt-BR") ||
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name, "pt-BR")
  );
}

export function buildNavigationGroups(pages: NavigationItem[]): NavigationGroup[] {
  const rootPages = pages.filter((page) => page.parentKey === null).sort(comparePages);

  return rootPages.map((page) => ({
    page,
    children: pages.filter((candidate) => candidate.parentKey === page.key).sort(comparePages),
  }));
}

export function getNavigationHome(pages: NavigationItem[]) {
  const groups = buildNavigationGroups(pages);
  return groups.find((group) => group.page.path === "/app")?.page ?? groups[0]?.page ?? null;
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
