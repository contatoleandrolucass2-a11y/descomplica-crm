import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_REGISTRY } from "../lib/navigation/registry";

const route = vi.hoisted(() => ({ pathname: "/app/etapas/agendamentos" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));
beforeEach(() => {
  route.pathname = "/app/etapas/agendamentos";
});

import { AuthorizedNavigation } from "../app/(protected)/_components/AuthorizedNavigation";

describe("authorized navigation component", () => {
  it.each([
    "/app",
    "/app/etapas/oportunidades",
    "/app/etapas/visitas",
    "/app/etapas/pastas",
    "/app/etapas/vendas",
    "/app/repasse",
    "/app/meta-ads",
    "/app/etapas/agendamentos/detalhe",
    "/app/etapas/agendamentos/",
  ])("preserves the original Dashboard disclosure at %s", (pathname) => {
    route.pathname = pathname;
    const pages = PAGE_REGISTRY.filter(
      (page) => page.pageKey === "crm.dashboard" || page.parentKey === "crm.dashboard",
    ).map((page) => ({ ...page, key: page.pageKey }));
    const markup = renderToStaticMarkup(<AuthorizedNavigation pages={pages} />);
    expect(markup).toContain('aria-controls="authorized-navigation-crm-dashboard"');
    expect(markup).toContain('id="authorized-navigation-crm-dashboard"');
    for (const page of pages) expect(markup).toContain(`href="${page.path}"`);
    if (pathname === "/app/meta-ads") expect(markup).not.toContain('data-navigation-active="true"');
    else if (pages.some((page) => page.path === pathname))
      expect(markup).toContain('data-navigation-active="true"');
  });
  it("links Dashboard directly to its overview without a dropdown or stage links", () => {
    const markup = renderToStaticMarkup(
      <AuthorizedNavigation
        pages={[
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
            key: "crm.stage.visits",
            path: "/app/etapas/visitas",
            name: "Visitas",
            description: "Detalhe de visitas",
            section: "crm",
            parentKey: "crm.dashboard",
            sortOrder: 20,
          },
          {
            key: "orphan",
            path: "/orphan",
            name: "Não autorizada",
            description: "Pai ausente",
            section: "crm",
            parentKey: "missing",
            sortOrder: 30,
          },
        ]}
      />,
    );

    expect(markup).toContain('id="authorized-navigation"');
    expect(markup).toContain('href="/app"');
    expect(markup).not.toContain('aria-controls="authorized-navigation-crm-dashboard"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('id="authorized-navigation-crm-dashboard"');
    expect(markup).toContain("<svg");
    expect(markup).not.toContain('href="/app/etapas/visitas"');
    expect(markup).not.toContain("Não autorizada");
  });

  it("keeps Simulation as a direct hub link without child or future entries", () => {
    const markup = renderToStaticMarkup(
      <AuthorizedNavigation
        pages={[
          {
            key: "crm.simulation",
            path: "/app/simulacao",
            name: "Simulação",
            description: "Ferramentas comerciais",
            section: "simulation",
            parentKey: null,
            sortOrder: 10,
          },
          {
            key: "crm.simulation.wf13",
            path: "/app/simulacao/associativo-fluxo-linear",
            name: "Simulador Associativo",
            description: "Fluxo autorizado",
            section: "simulation",
            parentKey: "crm.simulation",
            sortOrder: 20,
          },
        ]}
        disabledItems={[
          {
            key: "crm.simulation.future",
            name: "Jornada futura",
            description: "Página ainda não liberada.",
            section: "simulation",
            parentKey: "crm.simulation",
            sortOrder: 70,
            reason: "Aguardando autorização",
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/app/simulacao"');
    expect(markup).not.toContain('aria-disabled="true"');
    expect(markup).not.toContain("Jornada futura");
    expect(markup).not.toContain("Aguardando autorização");
    expect(markup).not.toContain("Simulador Associativo");
    expect(markup).not.toContain('href="/app/simulacao/future"');
    expect(markup).not.toContain('aria-controls="crm.simulation.future"');
  });

  it("keeps protected CAIXA discoverable only from the Simulation hub", () => {
    const markup = renderToStaticMarkup(
      <AuthorizedNavigation
        pages={[
          {
            key: "crm.simulation",
            path: "/app/simulacao",
            name: "Simulação",
            description: "Ferramentas comerciais",
            section: "simulation",
            parentKey: null,
            sortOrder: 10,
          },
          {
            key: "crm.simulation.caixa",
            path: "/app/simulacao/caixa",
            name: "CAIXA",
            description: "Jornada visual protegida",
            section: "simulation",
            parentKey: "crm.simulation",
            sortOrder: 70,
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/app/simulacao"');
    expect(markup).not.toContain('href="/app/simulacao/caixa"');
    expect(markup).not.toContain("CAIXA");
    expect(markup).not.toContain('aria-disabled="true"');
  });

  it("does not render disabled or unauthorized labels whose parent was not authorized", () => {
    const markup = renderToStaticMarkup(
      <AuthorizedNavigation
        pages={[
          {
            key: "crm.dashboard",
            path: "/app",
            name: "Dashboard",
            description: "Visão geral",
            section: "crm",
            parentKey: null,
            sortOrder: 10,
          },
        ]}
        disabledItems={[
          {
            key: "crm.simulation.caixa",
            name: "CAIXA",
            description: "Rótulo indevido",
            section: "simulation",
            parentKey: "crm.simulation",
            sortOrder: 70,
            reason: "Aguardando autorização",
          },
        ]}
      />,
    );

    expect([...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual(["/app"]);
    expect(markup).not.toMatch(/CAIXA|Rótulo indevido|Administração|Usuários/);
  });
});
