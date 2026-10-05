import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ManagementPage,
  ManagementPageHeader,
  ManagementStatusBadge,
} from "@/app/(protected)/_components/ManagementCanvas";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("management canvas layout", () => {
  it("exposes one semantic page title and a real status region", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ManagementPage,
        null,
        createElement(ManagementPageHeader, {
          eyebrow: "Administração",
          title: "Catálogo",
          description: "Descrição operacional.",
          status: createElement(ManagementStatusBadge, null, "Fonte conectada"),
        }),
      ),
    );

    expect(markup).toContain("<main");
    expect(markup).toContain("<h1");
    expect(markup).toContain("Catálogo");
    expect(markup).toContain("Fonte conectada");
  });

  it("keeps every delegated management surface on the compact canvas", () => {
    for (const file of [
      "app/(protected)/admin/page.tsx",
      "app/(protected)/admin/usuarios/page.tsx",
      "app/(protected)/admin/paginas/page.tsx",
      "app/(protected)/app/configuracoes/page.tsx",
      "app/(protected)/app/configuracoes/metas/_components/FunnelGoalsPage.tsx",
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
      "app/(protected)/app/ranking/page.tsx",
      "app/(protected)/app/canal-de-parcerias/page.tsx",
    ]) {
      expect(source(file), file).toContain("ManagementPage");
    }
  });

  it("contains mobile goal layouts and separates semantic ink from accents", () => {
    const stylesheet = source("app/(protected)/_components/ManagementCanvas.module.css");
    const funnel = source(
      "app/(protected)/app/configuracoes/metas/_components/FunnelGoalsPage.tsx",
    );
    const pointSettings = source(
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
    );
    const draftForm = source(
      "app/(protected)/app/configuracoes/metas/_components/ConfigurationDraftForm.tsx",
    );
    const userAccess = source("app/(protected)/admin/usuarios/UserAccessManager.tsx");

    expect(stylesheet).toMatch(/\.pageInner > \* \{[\s\S]*?min-width: 0/);
    expect(stylesheet).toMatch(
      /\.statusPill \{[\s\S]*?max-width: 100%[\s\S]*?overflow-wrap: anywhere[\s\S]*?white-space: normal/,
    );
    expect(stylesheet).toMatch(
      /\.statusBadge\[data-tone="positive"\] \{[\s\S]*?border-color: var\(--analytics-positive\)[\s\S]*?color: var\(--analytics-positive-ink\)/,
    );
    expect(funnel).toContain("w-full min-w-0 grid-cols-2");
    expect(funnel).toContain("lg:w-auto lg:min-w-72");
    expect(funnel).toContain("text-[var(--analytics-positive-ink)]");
    for (const component of [funnel, pointSettings, draftForm, userAccess]) {
      expect(component).not.toMatch(/text-\[var\(--analytics-(?:positive|warning|danger)\)\]/);
    }
    expect(pointSettings).toContain("aria-label={`Peso de ${metric.label}`}");
    expect(pointSettings).toContain("aria-label={`Objetivo de ${metric.label}`}");
    expect(pointSettings).not.toContain("htmlFor={`weight-${metric.formKey}`}");
    expect(pointSettings).not.toContain("htmlFor={`target-${metric.formKey}`}");
  });

  it("preserves server authorization and the existing mutation contracts", () => {
    const admin = source("app/(protected)/admin/page.tsx");
    const users = source("app/(protected)/admin/usuarios/page.tsx");
    const userManager = source("app/(protected)/admin/usuarios/UserAccessManager.tsx");
    const pages = source("app/(protected)/admin/paginas/page.tsx");
    const pageManager = source("app/(protected)/admin/paginas/PageCatalogManager.tsx");

    expect(admin).toContain('enforcePermission("admin.access")');
    expect(admin).toContain('hasPermission(context, "users.view")');
    expect(admin).toContain('hasPermission(context, "pages.manage")');
    expect(users).toContain('enforcePermission("users.view")');
    expect(userManager).toContain("assignRoleAction");
    expect(userManager).toContain("approveUserAccessAction");
    expect(userManager).toContain("setPermissionOverrideAction");
    expect(pages).toContain('enforcePermission("pages.manage")');
    expect(pageManager).toContain("setPageVisibilityAction.bind");
    expect(pageManager).not.toMatch(/Exportar|download/i);
  });

  it("matches the approved administration composition without changing access gates", () => {
    const admin = source("app/(protected)/admin/page.tsx");
    const users = source("app/(protected)/admin/usuarios/UserAccessManager.tsx");
    const pages = source("app/(protected)/admin/paginas/PageCatalogManager.tsx");
    const styles = source("app/(protected)/admin/admin-canvas.css");

    expect(admin).toContain('className="admin-canvas admin-home-page"');
    expect(admin).toContain('className="admin-home-grid"');
    expect(admin).not.toContain("Ferramentas autorizadas");
    expect(users.indexOf("admin-users-toolbar")).toBeLessThan(users.indexOf("admin-users-summary"));
    expect(users).toContain("Acessos revogados");
    expect(pages).toContain("Páginas cadastradas");
    expect(pages).toContain('<th scope="col">Descrição</th>');
    expect(pages).toContain('<th scope="col">Rota</th>');
    expect(styles).toMatch(/\.admin-home-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
    expect(users).toContain("const PAGE_SIZE = 6");
    expect(pages).toContain("const PAGE_SIZE = 8");
  });

  it("renders unavailable commercial states without invented rankings or defaults", () => {
    const ranking = source("app/(protected)/app/ranking/page.tsx");
    const partnerships = source("app/(protected)/app/canal-de-parcerias/page.tsx");
    const funnel = source(
      "app/(protected)/app/configuracoes/metas/_components/FunnelGoalsPage.tsx",
    );
    const points = source(
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
    );

    expect(ranking).toContain("loadRankingReadModel");
    expect(ranking).toContain("Nenhuma pontuação oficial foi calculada");
    expect(partnerships).toContain("const imobRows: ImobRankingRow[] = []");
    expect(partnerships).toContain("const developmentRows: DevelopmentRankingRow[] = []");
    expect(partnerships).toContain("Dado indisponível — integração pendente");
    expect(funnel).toContain('placeholder="—"');
    expect(funnel).toContain("refletem exclusivamente a última base legada carregada");
    expect(funnel).not.toContain("recalcula as etapas localmente");
    expect(points).toContain('placeholder="—"');
    expect(points).not.toContain("DEFAULT_POINT_WEIGHTS");
    expect(points).toContain('id="point-activity-heading"');
    expect(points).toContain('aria-labelledby="point-activity-heading"');
    expect(points).toContain("<caption");
  });
});
