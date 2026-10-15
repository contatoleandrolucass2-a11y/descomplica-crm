import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PAGE_REGISTRY, getPermissionPages } from "@/lib/navigation/registry";
import { CRM_STAGES } from "@/lib/crm/stages/catalog";
import { SIMULATOR_LIST } from "@/lib/crm/simulators/catalog";
import {
  checkPageCatalog,
  renderPageCatalogMigration,
  validatePageRegistry,
} from "../scripts/pages/catalog.mjs";

vi.mock("@/app/(protected)/admin/paginas/actions", () => ({ setPageVisibilityAction: vi.fn() }));
import { PageCatalogManager } from "@/app/(protected)/admin/paginas/PageCatalogManager";

describe("unified page registration", () => {
  it("keeps routes, access labels and the deployable migration synchronized", async () => {
    const result = await checkPageCatalog();
    expect(result.synchronized).toBe(true);
    for (const page of PAGE_REGISTRY) {
      expect(getPermissionPages(page.permission)).toContain(page);
    }
  });

  it("covers every dynamic commercial route", () => {
    const paths = new Set<string>(PAGE_REGISTRY.map((page) => page.path));
    for (const stage of CRM_STAGES) expect(paths.has(`/app/etapas/${stage.slug}`)).toBe(true);
    for (const simulator of SIMULATOR_LIST)
      expect(paths.has(`/app/simulacao/${simulator.slug}`)).toBe(true);
  });

  it("rejects duplicate identities, incomplete metadata and parent cycles", () => {
    const page = PAGE_REGISTRY[0];
    expect(() => validatePageRegistry([page, page])).toThrow("duplicate");
    expect(() => validatePageRegistry([{ ...page, name: "" }])).toThrow("Incomplete");
    expect(() => validatePageRegistry([{ ...page, parentKey: page.pageKey }])).toThrow("cycle");
    expect(() => validatePageRegistry([{ ...page, parentKey: "missing" }])).toThrow(
      "Unknown page parent",
    );
  });

  it("adds a future registered page to its permission and database catalog without resetting visibility", () => {
    const page = {
      ...PAGE_REGISTRY[0],
      pageKey: "crm.future",
      path: "/app/futura",
      name: "Página futura",
      permission: "users.manage" as const,
    };
    const sql = renderPageCatalogMigration([...PAGE_REGISTRY, page]);
    expect(sql).toContain("'crm.future', '/app/futura', 'Página futura'");
    expect(sql).not.toContain("is_active = excluded.is_active");
    expect(sql).toContain("newly_registered_page_permissions");
    expect(sql).toContain("(values ('master'), ('admin'))");
  });

  it("requires independent page permissions except for the simulator group", () => {
    const page = PAGE_REGISTRY[0];
    expect(() =>
      validatePageRegistry([
        page,
        { ...page, pageKey: "crm.duplicate-access", path: "/app/duplicate-access" },
      ]),
    ).toThrow("permission");
    expect(() => validatePageRegistry([...PAGE_REGISTRY])).not.toThrow();
  });

  it("renders every managed row in one keyboard-scrollable list without pagination", () => {
    const markup = renderToStaticMarkup(
      createElement(PageCatalogManager, {
        pages: PAGE_REGISTRY.map((page) => ({
          ...page,
          key: page.pageKey,
          permissionKey: page.permission,
          isActive: true,
        })),
      }),
    );
    for (const page of PAGE_REGISTRY) expect(markup).toContain(page.path);
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("27 de 27 páginas");
    expect(markup).not.toContain("Próxima página");
    expect(markup).not.toContain("Página anterior");
  });
});
