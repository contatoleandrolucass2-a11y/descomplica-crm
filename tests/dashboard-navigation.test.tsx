import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_REGISTRY } from "../lib/navigation/registry";

const route = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
import { DashboardShell } from "../app/(protected)/_components/DashboardShell";
import { ProtectedShellFrame } from "../app/(protected)/_components/ProtectedShellFrame";

const pages = PAGE_REGISTRY.filter(
  (page) => page.pageKey === "crm.dashboard" || page.parentKey === "crm.dashboard",
).map((page) => ({ ...page, key: page.pageKey }));

beforeEach(() => {
  route.pathname = "/app/etapas/agendamentos";
});

describe("Dashboard sidebar navigation", () => {
  it("keeps the default frame pure and preserves its original markup", () => {
    const source = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShellFrame.tsx", import.meta.url),
      "utf8",
    );
    expect(source.match(/^import(?!\s+type\b).*$/gm) ?? []).toEqual([]);
    expect(
      renderToStaticMarkup(
        <ProtectedShellFrame shellClassName="shell" contentClassName="content" chrome={<header />}>
          Conteúdo
        </ProtectedShellFrame>,
      ),
    ).toBe(
      '<div class="shell" data-protected-shell="true"><header></header><div id="protected-main-content" class="content" data-protected-main-content="true" tabindex="-1">Conteúdo</div></div>',
    );
  });

  it("allows the layout to wrap only the content with authorized dashboard navigation", () => {
    const markup = renderToStaticMarkup(
      <ProtectedShellFrame
        shellClassName="shell"
        chrome={<header>Chrome</header>}
        wrapContent={(content) => <DashboardShell pages={pages}>{content}</DashboardShell>}
      >
        Conteúdo
      </ProtectedShellFrame>,
    );
    expect(markup).toContain('<header>Chrome</header>');
    expect(markup).toContain('aria-label="Agendamentos" aria-current="page"');
    expect(markup.match(/id="protected-main-content"/g)).toHaveLength(1);
    expect(markup).toContain('tabindex="-1">Conteúdo</div>');
  });

  it("uses catalog order and only one active destination", () => {
    route.pathname = "/app/etapas/agendamentos";
    const markup = renderToStaticMarkup(
      <DashboardShell pages={[...pages].reverse()}>Conteúdo</DashboardShell>,
    );
    expect([...markup.matchAll(/title="([^"]+)"/g)].map((match) => match[1])).toEqual([
      "Recolher navegação do Dashboard",
      "Visão Geral",
      "Oportunidades",
      "Agendamentos",
      "Visitas",
      "Pastas",
      "Vendas",
      "Repasse",
    ]);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Agendamentos" aria-current="page"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Conteúdo");
  });

  it("never adds overview or Repasse when the authorized catalog omits them", () => {
    const markup = renderToStaticMarkup(
      <DashboardShell pages={pages.filter((page) => page.key === "crm.stage.appointments")}>
        Conteúdo
      </DashboardShell>,
    );
    expect([...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual([
      "/app/etapas/agendamentos",
    ]);
    expect(markup).not.toContain("Repasse");
    expect(markup).not.toContain("Visão Geral");
  });

  it.each([
    "/app",
    "/app/etapas/oportunidades",
    "/app/etapas/visitas",
    "/app/etapas/pastas",
    "/app/etapas/vendas",
    "/app/repasse",
    "/app/meta-ads",
    "/app/etapas/agendamentos/detalhe",
    "/app/etapas/agendamentos-extra",
    "/app/etapas/agendamentos/",
    "/app/simulacao",
    "/app/gestao",
    "/app/repasse-extra",
    "/admin",
    "/app/etapas/visitas-extra",
  ])("returns children without a wrapper outside the exact appointments route: %s", (pathname) => {
    route.pathname = pathname;
    expect(renderToStaticMarkup(<DashboardShell pages={pages}>Conteúdo</DashboardShell>)).toBe(
      "Conteúdo",
    );
    const frameProps = { shellClassName: "shell", chrome: <header /> };
    expect(
      renderToStaticMarkup(
        <ProtectedShellFrame
          {...frameProps}
          wrapContent={(content) => <DashboardShell pages={pages}>{content}</DashboardShell>}
        >
          Conteúdo
        </ProtectedShellFrame>,
      ),
    ).toBe(
      renderToStaticMarkup(<ProtectedShellFrame {...frameProps}>Conteúdo</ProtectedShellFrame>),
    );
  });

  it("does not add a sidebar without an authorized appointments destination", () => {
    expect(
      renderToStaticMarkup(
        <DashboardShell pages={pages.filter((page) => page.key !== "crm.stage.appointments")}>
          Conteúdo
        </DashboardShell>,
      ),
    ).toBe("Conteúdo");
  });
});
