import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbs,
  buildNavigationGroups,
  getPrimaryNavigation,
  isNavigationGroupActive,
  isNavigationRootActive,
  type NavigationItem,
} from "../lib/navigation/presentation";

const root: NavigationItem = {
  key: "crm.leads",
  path: "/app/leads",
  name: "Lead",
  description: "Operação comercial",
  section: "leads",
  parentKey: null,
  sortOrder: 15,
};
const child: NavigationItem = {
  ...root,
  key: "crm.leads.list",
  path: "/app/leads/lista",
  name: "Lista de leads",
  parentKey: "crm.leads",
};

describe("LEAD+ root navigation presentation", () => {
  it("renders one LEAD+ entry without an overview or old dropdown while preserving the catalog", () => {
    const catalog = [root, child];
    const original = structuredClone(catalog);
    const primary = getPrimaryNavigation(catalog);
    const group = buildNavigationGroups(primary)[0]!;
    expect(group.page).toEqual({ ...root, name: "LEAD+" });
    expect(group.children).toEqual([]);
    expect(group.includeOverview).toBe(false);
    expect(primary).toEqual(original);
    expect(catalog).toEqual(original);
    expect(buildBreadcrumbs(child.path, catalog)).toEqual([root, child]);
  });

  it("keeps the LEAD+ entry active in its workspace without matching sibling URLs", () => {
    const group = buildNavigationGroups([root, child])[0]!;
    for (const path of [root.path, child.path, "/app/leads/funil"]) {
      expect(isNavigationRootActive(path, group.page)).toBe(true);
      expect(isNavigationGroupActive(path, group)).toBe(true);
    }
    for (const path of ["/app/leads-other", "/app/meta-ads", "/app"]) {
      expect(isNavigationRootActive(path, group.page)).toBe(false);
      expect(isNavigationGroupActive(path, group)).toBe(false);
    }
  });

  it("does not relabel or collapse another group, or a mismatched Lead identifier", () => {
    const other = { ...root, key: "other.root", path: "/other", name: "Outra área" };
    const otherChild = { ...child, key: "other.child", path: "/other/child", parentKey: other.key };
    const groups = buildNavigationGroups([other, otherChild]);
    expect(groups[0]).toEqual({ page: other, children: [otherChild], includeOverview: true });
    const mismatch = { ...root, path: "/different" };
    expect(buildNavigationGroups([mismatch])[0]?.page.name).toBe("Lead");
  });
});
