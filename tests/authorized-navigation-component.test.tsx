import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/etapas/visitas",
}));

import { AuthorizedNavigation } from "../app/(protected)/_components/AuthorizedNavigation";

describe("authorized navigation component", () => {
  it("renders a native hierarchy and marks only the current authorized child", () => {
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

    expect(markup).toContain("<details");
    expect(markup).toContain('name="authorized-navigation"');
    expect(markup).toContain("<summary");
    expect(markup).toContain("<svg");
    expect(markup).toContain("contém a página atual");
    expect(markup).toContain('aria-current="page" href="/app/etapas/visitas"');
    expect(markup).not.toContain("Não autorizada");
  });
});
