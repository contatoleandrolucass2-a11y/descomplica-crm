import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/app/leads" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
import { AuthorizedBreadcrumbs } from "../app/(protected)/_components/AuthorizedBreadcrumbs";
import type { NavigationItem } from "../lib/navigation/presentation";
function page(path: string): NavigationItem {
  return {
    key: path,
    path,
    name: "Área autorizada",
    description: "",
    section: "leads",
    parentKey: null,
    sortOrder: 1,
  };
}
describe("LEAD+ breadcrumbs integrados", () => {
  it.each(["/app/leads", "/app/leads/", "/app/leads/lista", "/app/leads/funil"])(
    "oculta a faixa antiga somente no workspace %s",
    (path) => {
      route.path = path;
      expect(renderToStaticMarkup(<AuthorizedBreadcrumbs pages={[page(path)]} />)).toBe("");
    },
  );
  it.each(["/app/leads-extra", "/app/ranking"])(
    "preserva o breadcrumb fora do workspace %s",
    (path) => {
      route.path = path;
      expect(renderToStaticMarkup(<AuthorizedBreadcrumbs pages={[page(path)]} />)).toContain(
        'aria-label="Breadcrumb"',
      );
    },
  );
});
