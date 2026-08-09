import { describe, expect, it } from "vitest";

import {
  buildNavigationGroups,
  getNavigationHome,
  isNavigationGroupActive,
  type NavigationItem,
} from "../lib/navigation/presentation";

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

describe("authorized hierarchical navigation", () => {
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
});
