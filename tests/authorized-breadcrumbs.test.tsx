import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { AuthorizedBreadcrumbs } from "../app/(protected)/_components/AuthorizedBreadcrumbs";
import type { AppPage } from "../lib/navigation/pages";

const simulation: AppPage = {
  key: "crm.simulation",
  path: "/app/simulacao",
  name: "Simulacao",
  description: "Ferramentas autorizadas",
  section: "simulation",
  permissionKey: "crm.simulators.view",
  parentKey: null,
  sortOrder: 10,
  isNavigation: true,
  isActive: true,
};

function child(path: string): AppPage {
  return { ...simulation, key: path, path, name: "Simulador", parentKey: simulation.key };
}

describe("authorized breadcrumbs", () => {
  it.each(["/app/simulacao/associativo-fluxo-linear", "/app/simulacao/associativo-fluxo-linear/"])(
    "omits only the associative workspace breadcrumb at %s",
    (pathname) => {
      mocks.pathname = pathname;
      expect(
        renderToStaticMarkup(<AuthorizedBreadcrumbs pages={[simulation, child(pathname)]} />),
      ).toBe("");
    },
  );

  it.each([
    "/app/simulacao/tabela-direta",
    "/app/simulacao/tabela-investidor",
    "/app/simulacao/associativo-fluxo-linear/detalhe",
    "/app/simulacao/associativo-fluxo-linear-extra",
  ])("preserves authorized breadcrumbs on other routes: %s", (pathname) => {
    mocks.pathname = pathname;
    const markup = renderToStaticMarkup(
      <AuthorizedBreadcrumbs pages={[simulation, child(pathname)]} />,
    );
    expect(markup).toContain('aria-label="Breadcrumb"');
    expect(markup).toContain('href="/app/simulacao"');
    expect(markup).toContain('aria-current="page">Simulador');
  });

  it("preserves the simulation root and never creates an unauthorized breadcrumb", () => {
    mocks.pathname = simulation.path;
    expect(renderToStaticMarkup(<AuthorizedBreadcrumbs pages={[simulation]} />)).toContain(
      'aria-current="page">Simulacao',
    );
    mocks.pathname = "/app/simulacao/tabela-direta";
    expect(renderToStaticMarkup(<AuthorizedBreadcrumbs pages={[simulation]} />)).toBe("");
    expect(renderToStaticMarkup(<AuthorizedBreadcrumbs pages={[]} />)).toBe("");
  });
});
