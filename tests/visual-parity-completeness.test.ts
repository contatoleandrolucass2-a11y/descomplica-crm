import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("complete visual composition without commercial fixtures", () => {
  it("keeps the dashboard analytical composition when the snapshot is absent", () => {
    const page = source("app/(protected)/app/page.tsx");
    const emptyBranch = page.slice(
      page.indexOf('if (result.status === "empty")'),
      page.indexOf("const { dashboard } = result"),
    );

    expect(page).toContain(
      'const DATA_UNAVAILABLE_LABEL = "Dado indisponível — integração pendente"',
    );
    expect(emptyBranch).toContain("DATA_UNAVAILABLE_LABEL");
    expect(emptyBranch).toContain("<PageHeader");
    expect(emptyBranch).toContain("<FilterBar");
    expect(emptyBranch).toContain("<MetricCard");
    expect(emptyBranch).toContain("<FunnelChart");
    expect(emptyBranch).toContain("<AnalyticsTable");
    expect(emptyBranch).toContain("Diagnóstico, gargalo e plano de ação");
  });

  it("keeps every stage composition when the shared snapshot is absent", () => {
    const page = source("app/(protected)/app/etapas/[stage]/page.tsx");
    const emptyPage = page.slice(
      page.indexOf("function EmptyStagePage"),
      page.indexOf("export function generateStaticParams"),
    );

    expect(page).toContain(
      'const INTEGRATION_PENDING_LABEL = "Dado indisponível — integração pendente"',
    );
    expect(emptyPage).toContain("INTEGRATION_PENDING_LABEL");
    expect(emptyPage).toContain("Nenhum snapshot validado");
    expect(emptyPage).toContain("<PageHeader");
    expect(emptyPage).toContain("<StageFilters");
    expect(emptyPage).toContain("<Gauge");
    expect(emptyPage).toContain("<FunnelChart");
    expect(emptyPage).toContain("<AnalyticsTable");
  });

  it("keeps ranking structure empty and hides its admin action from readers", () => {
    const page = source("app/(protected)/app/ranking/page.tsx");

    expect(page).toContain("function UnavailableRankingComposition");
    expect(page).toContain("<AnalyticsTable");
    expect(page).toContain("<UnavailableRankingComposition period={period} scope={scope} />");
    expect(page).toContain(
      'const canManagePoints = authorization.permissions.includes("crm.settings.manage")',
    );
    expect(page).toContain("!isEmpty && canManagePoints");
  });

  it("does not prefill an unconfigured point policy with legacy defaults", () => {
    const page = source(
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
    );

    expect(page).not.toContain("DEFAULT_POINT_WEIGHTS");
    expect(page).toContain("defaultValue={weights?.[metric.key]}");
    expect(page).toContain("campos permanecem vazios");
  });
});

describe("isolated authenticated visual QA contract", () => {
  it("requires a local Supabase QA identity and captures every responsive route", () => {
    const script = source("scripts/qa/authenticated-visual.mjs");
    const runner = source("scripts/qa/local-authenticated-visual.mjs");

    expect(script).toContain('requiredEnvironment("QA_AUTH_FIXTURE_VERIFICATION")');
    expect(script).toContain('requiredEnvironment("QA_AUTH_SUPABASE_URL")');
    expect(script).toContain('requiredEnvironment("QA_AUTH_SUPABASE_PUBLISHABLE_KEY")');
    expect(script).toContain("@local\\.invalid");
    expect(script).toContain('kind: "responsive"');
    expect(script).toContain("responsiveScreenshots: routes.length * viewports.length");
    expect(script).toContain("themeScreenshots: themeCaptureRoutes.size * themes.length");
    expect(script).toContain('locale: "pt-BR"');
    expect(script).toContain('timezoneId: "America/Sao_Paulo"');
    expect(runner).toContain('QA_AUTH_FIXTURE_VERIFICATION: "rls-marker-v1"');
    expect(runner).toContain("verifyFixturesThroughRls");
    expect(runner).toContain("auth.admin.deleteUser");
    expect(runner).toContain("reserved dashboard fixture slot is occupied");
  });
});
