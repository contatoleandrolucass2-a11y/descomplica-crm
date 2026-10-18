import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  parseRankingFilters,
  RankingDashboard,
} from "@/app/(protected)/app/canal-de-parcerias/RankingDashboard";

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
    const goals = source("app/(protected)/app/configuracoes/metas/_components/FunnelGoalsPage.tsx");
    expect(goals.match(/<main(?:\s|>)/g)).toHaveLength(1);
    for (const file of [
      "app/(protected)/admin/page.tsx",
      "app/(protected)/admin/usuarios/page.tsx",
      "app/(protected)/admin/paginas/page.tsx",
      "app/(protected)/app/configuracoes/page.tsx",
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
      "app/(protected)/app/canal-de-parcerias/RankingDashboard.tsx",
      "app/(protected)/app/ranking/page.tsx",
    ]) {
      expect(source(file), file).toContain("ManagementPage");
    }
    expect(source("app/(protected)/app/canal-de-parcerias/page.tsx")).toContain(
      "<RankingDashboard data={data} filters={filters}",
    );
  });

  it("contains mobile goal layouts and separates semantic ink from accents", () => {
    const stylesheet = source("app/(protected)/_components/ManagementCanvas.module.css");
    const funnel = source("app/(protected)/app/configuracoes/metas/_components/GoalPlanning.tsx");
    const goalStyles = source(
      "app/(protected)/app/configuracoes/metas/_components/GoalPlanning.module.css",
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
    expect(funnel).toContain("styles.planning");
    expect(goalStyles).toContain("min-width: 0");
    expect(goalStyles).toContain("overflow-x: auto");
    expect(goalStyles).toContain("max-width: 760px");
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
    expect(userManager).toContain("setPermissionOverridesBulkAction");
    expect(pages).toContain('enforcePermission("pages.manage")');
    expect(pageManager).toContain("setPageVisibilityAction.bind");
    expect(pageManager).not.toMatch(/Exportar|download/i);
  });

  it("matches the approved administration composition without changing access gates", () => {
    const admin = source("app/(protected)/admin/page.tsx");
    const users = source("app/(protected)/admin/usuarios/UserAccessManager.tsx");
    const pages = source("app/(protected)/admin/paginas/PageCatalogManager.tsx");
    const styles = source("app/(protected)/admin/admin-canvas.css");
    const visualHarness = source("scripts/qa/authenticated-visual.mjs");

    expect(admin).toContain('className="admin-canvas admin-home-page"');
    expect(admin).toContain('className="admin-home-grid"');
    expect(admin).not.toContain("Ferramentas autorizadas");
    expect(users).toContain("admin-users-summary");
    expect(users).toContain("admin-users-workspace");
    expect(users).toContain("admin-directory-status-filters");
    expect(users).toContain('role="tablist"');
    expect(users).toContain("admin-permission-tabs");
    expect(users).toContain("O que pode acessar");
    expect(users).toContain("keys.every(isChecked)");
    expect(users).toContain("onChange={() => togglePermission(permissionKey)}");
    expect(users).toContain("Usar padrão do perfil");
    expect(users).toContain("restoreDefaults");
    expect(users).not.toContain("admin-permission-effects");
    expect(users).toContain("Salvar alterações");
    expect(users).toContain("Total de usuários");
    expect(users).toContain('label: "Comercial"');
    expect(users).toContain('label: "Simuladores"');
    expect(users).toContain('label: "Configurações"');
    expect(users).toContain('label: "Administração"');
    expect(users).not.toContain('label: "Navegação e páginas"');
    expect(visualHarness).toContain('["/admin/usuarios", 1650]');
    expect(pages).toContain("Páginas cadastradas");
    expect(pages).toContain('<th scope="col">Descrição</th>');
    expect(pages).toContain('<th scope="col">Rota</th>');
    for (const label of ["Página", "Descrição", "Rota", "Status", "Ações"]) {
      expect(pages).toContain(`data-label="${label}"`);
    }
    expect(styles).toMatch(/\.admin-home-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
    expect(styles).toMatch(
      /\.admin-pages-content \{[\s\S]*?max-width: 100%;[\s\S]*?align-content: start/,
    );
    expect(styles).toMatch(
      /\.admin-pages-results \[class\*="tableRegion"\] \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%/,
    );
    expect(styles).toMatch(/\.admin-pages-page \{[\s\S]*?overflow-x: hidden/);
    expect(styles).toMatch(
      /\.admin-pages-content,[\s\S]*?\.admin-pages-results \{[\s\S]*?contain: inline-size/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 64rem\) \{[\s\S]*?\.admin-pages-results \{[\s\S]*?overflow: hidden[\s\S]*?\.admin-pages-results \[class\*="tableRegion"\] \{[\s\S]*?overflow-x: auto/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 60rem\) \{[\s\S]*?\.admin-pages-results table \{[\s\S]*?min-width: 0[\s\S]*?\.admin-pages-results tbody :is\(th, td\) \{[\s\S]*?min-width: 0 !important/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 40rem\) \{[\s\S]*?\.admin-user-detail-header h2 \{[\s\S]*?min-height: 2\.5em[\s\S]*?-webkit-line-clamp: 2/,
    );
    expect(users).toContain("const PAGE_SIZE = 6");
    expect(pages).toContain("admin-pages-scroll");
    expect(pages).not.toContain("Próxima página");
    expect(pages).not.toContain("Página anterior");
  });

  it("renders unavailable commercial states without invented rankings or defaults", () => {
    const ranking = source("app/(protected)/app/ranking/page.tsx");
    const partnerships = source("app/(protected)/app/canal-de-parcerias/page.tsx");
    const funnel = source("app/(protected)/app/configuracoes/metas/_components/GoalPlanning.tsx");
    const points = source(
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
    );

    expect(ranking).toContain("loadRankingReadModel");
    expect(ranking).not.toContain("loadQlikRankingV2");
    expect(ranking).toContain('enforcePermission("crm.ranking.view")');
    expect(ranking).toContain("Ranking de corretores da House");
    expect(partnerships).toContain('enforcePermission("crm.partnerships.view")');
    expect(partnerships.indexOf('await enforcePermission("crm.partnerships.view")')).toBeLessThan(
      partnerships.indexOf("await loadQlikRankingV2"),
    );
    for (const [kind, title] of [
      ["imobs", "Top 10 imobiliárias"],
      ["developments", "Top 10 empreendimentos"],
    ]) {
      const markup = renderToStaticMarkup(
        createElement(RankingDashboard, {
          data: { status: "unavailable" },
          filters: parseRankingFilters({ kind: kind! }),
          now: new Date("2026-10-14T12:00:00Z"),
        }),
      );
      expect(markup).toContain(title);
      expect(markup).toContain("Dados indisponíveis");
      expect(markup).toContain("<tbody></tbody>");
      expect(markup).not.toMatch(/R\$|>0<|Parceira [0-9]|Ouro: (?!Indisponível)/);
    }
    expect(partnerships).toContain("await loadQlikRankingV2(filters.year)");
    expect(partnerships).not.toMatch(/ImobRankingRow|DevelopmentRankingRow/);
    expect(funnel).toContain('placeholder="—"');
    expect(funnel).toContain("nenhum valor demonstrativo");
    expect(funnel).toContain("projectGoalVolumes");
    expect(funnel).toContain("Salvar rascunho de metas");
    expect(funnel).not.toContain(".rpc(");
    expect(points).toContain('placeholder="—"');
    expect(points).not.toContain("DEFAULT_POINT_WEIGHTS");
    expect(points).toContain('id="point-activity-heading"');
    expect(points).toContain('aria-labelledby="point-activity-heading"');
    expect(points).toContain("<caption");
  });
});
