import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/etapas/visitas",
}));

import { AuthorizedNavigation } from "../app/(protected)/_components/AuthorizedNavigation";

describe("authorized navigation component", () => {
  it("renders native buttons and marks only the current authorized child", () => {
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
    expect(markup).toContain('<button type="button"');
    expect(markup).toContain('aria-controls="authorized-navigation-crm-dashboard"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('id="authorized-navigation-crm-dashboard"');
    expect(markup).toContain("<svg");
    expect(markup).toContain("contém a página atual");
    expect(markup).toContain('aria-current="page" href="/app/etapas/visitas"');
    expect(markup).not.toContain("Não autorizada");
  });

  it("renders CAIXA only as a blocked state without href", () => {
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
            key: "crm.simulation.caixa",
            name: "CAIXA",
            description: "Jornada preservada até a autorização oficial.",
            section: "simulation",
            parentKey: "crm.simulation",
            sortOrder: 70,
            reason: "Aguardando autorização",
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("CAIXA");
    expect(markup).toContain("Aguardando autorização");
    expect(markup).not.toContain('href="/app/simulacao/caixa"');
    expect(markup).not.toContain('aria-controls="crm.simulation.caixa"');
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
