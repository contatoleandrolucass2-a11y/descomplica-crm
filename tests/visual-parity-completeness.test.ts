import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("complete visual composition on the scoped v3 read model", () => {
  it("connects the shadow dashboard to the shared secure analytical composition", () => {
    const productionPage = source("app/(protected)/app/page.tsx");
    const page = source("app/(protected)/app/read-model-v3/page.tsx");
    const bridge = source("app/(protected)/app/_components/ReadModelV3Page.tsx");
    const shared = source("app/(protected)/app/_components/ReadModelV3View.tsx");

    expect(productionPage).toContain("loadDashboardReadModel");
    expect(page).toContain("isReadModelV3ShadowEnabled");
    expect(page).toContain('dataset="funnel"');
    expect(bridge).toContain("DATASET_PERMISSIONS");
    expect(bridge).toContain("loadReadModelV3(dataset");
    expect(bridge).toContain("<ReadModelV3View");
    expect(shared).toContain("<PageHeader");
    expect(shared).toContain("<ReadModelV3Filters");
    expect(shared).toContain("<MetricCard");
    expect(shared).toContain("<FunnelChart");
    expect(shared).toContain("<AnalyticsTable");
    expect(shared).toContain("Opções de filtro limitadas");
    expect(shared).toContain("Cobertura do escopo não comprovada");
    expect(shared).toContain("Cobertura do período não comprovada");
    expect(shared).toContain("Fórmula ou política oficial ainda não aprovada");
  });

  it("keeps every shadow stage on the same v3 loader and dimensional filter surface", () => {
    const page = source("app/(protected)/app/read-model-v3/etapas/[stage]/page.tsx");

    expect(page).toContain("generateStaticParams");
    expect(page).toContain("<ReadModelV3Page");
    expect(page).toContain('dataset="funnel"');
    expect(page).toContain("focusStage={stage.key}");
    expect(page).toContain('breakdown="brokers"');
  });

  it("keeps shadow ranking facts separate while its commercial motor stays blocked", () => {
    const productionPage = source("app/(protected)/app/ranking/page.tsx");
    const page = source("app/(protected)/app/read-model-v3/ranking/page.tsx");

    expect(page).toContain('dataset="ranking"');
    expect(page).toContain(
      "Ranking avançado, pesos, bônus, roleta e prêmios permanecem bloqueados",
    );
    expect(productionPage).toContain("loadRankingReadModel");
  });

  it("does not prefill an unconfigured point policy with legacy defaults", () => {
    const page = source(
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
    );

    expect(page).not.toContain("DEFAULT_POINT_WEIGHTS");
    expect(page).toContain("defaultValue={weights?.[metric.key]}");
    expect(page).toContain("campos permanecem vazios");
  });

  it("keeps deterministic dashboard and partnership structures visible without invented data", () => {
    const dashboard = source("app/(protected)/app/page.tsx");
    const partnerships = source("app/(protected)/app/canal-de-parcerias/page.tsx");

    for (const label of [
      "Ritmo de vendas",
      "Realizado Funil",
      "Corretores por gerente",
      "Canal de contato: configuração institucional indisponível",
    ]) {
      expect(dashboard).toContain(label);
    }
    for (const label of [
      "Mês atual",
      "Mês anterior",
      "Ano",
      "Personalizado",
      "Período personalizado",
      "Ranking das imobiliárias",
      "Ranking dos Empreendimentos",
      "Aguardando conciliação das fontes",
    ]) {
      expect(partnerships).toContain(label);
    }
    expect(partnerships).not.toMatch(/VGV[^\n]*[1-9][0-9.,]/);
  });

  it("keeps final commercial copy localized and technical identifiers disclosed on demand", () => {
    const partnerships = source("app/(protected)/app/canal-de-parcerias/page.tsx");
    const ranking = source("app/(protected)/app/ranking/page.tsx");
    const funnel = source(
      "app/(protected)/app/configuracoes/metas/_components/FunnelGoalsPage.tsx",
    );
    const points = source(
      "app/(protected)/app/configuracoes/metas/pontos/_components/PointSettingsPage.tsx",
    );
    const draft = source(
      "app/(protected)/app/configuracoes/metas/_components/ConfigurationDraftForm.tsx",
    );
    const sourceLabel = source("app/(protected)/app/_components/analytics/DataDisplay.tsx");

    expect(partnerships).toContain('title="Ranking das imobiliárias"');
    expect(partnerships).not.toMatch(/Imob’s|IMOBs/);
    expect(ranking).toContain("Nenhuma pontuação oficial foi calculada");
    expect(ranking).toContain("Sem pontuação oficial");
    expect(funnel).toContain("Metas do funil de parcerias");
    expect(funnel).toContain("Base legada: somente leitura · Rascunho atual: editável");
    expect(points).toContain("Metas de pontos");
    expect(points).toContain("Base legada: somente leitura · Rascunho atual: editável");
    expect(draft).toContain("política ativa, ativação, permissões");
    expect(draft).toContain("Validar sem aplicar");
    expect(sourceLabel).toContain("Dados sintéticos de homologação");
    expect(sourceLabel).toContain("Detalhes técnicos");
  });
});

describe("isolated authenticated visual QA contract", () => {
  it("requires a local Supabase QA identity and captures every responsive route", () => {
    const script = source("scripts/qa/authenticated-visual.mjs");
    const runner = source("scripts/qa/local-authenticated-visual.mjs");
    const remoteRunner = source("scripts/homologation/run-remote-qa.mjs");

    expect(script).toContain('requiredEnvironment("QA_AUTH_FIXTURE_VERIFICATION")');
    expect(script).toContain('requiredEnvironment("QA_AUTH_SUPABASE_URL")');
    expect(script).toContain('requiredEnvironment("QA_AUTH_SUPABASE_PUBLISHABLE_KEY")');
    expect(script).toContain("@local\\.invalid");
    expect(script).toContain('kind: "responsive"');
    expect(script).toContain("responsiveScreenshots: routes.length * viewports.length");
    expect(script).toContain(
      "themeScreenshots: desktopThemeCaptureRoutes.size * themes.length + routes.length",
    );
    expect(script).toContain('locale: "pt-BR"');
    expect(script).toContain('timezoneId: "America/Sao_Paulo"');
    expect(script).toContain('process.env.OFFICIAL_SIMULATOR_RUNTIME_MODE !== "active"');
    expect(script).toContain("process.env.OFFICIAL_SIMULATOR_ENABLED_KEYS");
    expect(script).toContain("unknown simulator runtime key");
    expect(script).toContain("expectedSimulatorState: isSimulatorWorkspace");
    expect(script).toContain("simulatorStatePassed");
    expect(script).toContain("const simulatorCanaryBaselineRoot = path.join(");
    expect(script).toContain("visualBaselinePath(route, destination)");
    expect(script).toContain("enabledSimulatorRoutes.has(route)");
    expect(script).toContain('route === "/app/simulacao" && simulatorHubCanaryKey');
    expect(runner).toContain('QA_AUTH_FIXTURE_VERIFICATION: "rls-marker-v1"');
    expect(runner).toContain('"OFFICIAL_SIMULATOR_RUNTIME_MODE"');
    expect(runner).toContain('"OFFICIAL_SIMULATOR_ENABLED_KEYS"');
    expect(runner).toContain("verifyFixturesThroughRls");
    expect(runner).toContain("auth.admin.deleteUser");
    expect(runner).toContain("reserved dashboard fixture slot is occupied");
    expect(remoteRunner).toContain(
      'const appEnvironmentPath = "/etc/descomplica-crm/homologation.env"',
    );
    expect(remoteRunner).toContain("readRuntimeEnvironmentContract()");
    expect(remoteRunner).toContain("hostedRuntime.officialSimulatorEnvironment");
    expect(remoteRunner).toContain("...officialSimulatorEnvironment");
    expect(remoteRunner).toContain("unsafe ownership or permissions");
    expect(remoteRunner).toContain("QA_E2E_MAILPIT_ORIGIN: mailpitOrigin");
    expect(remoteRunner).toContain("restoreQaIdentity(");
    expect(remoteRunner).toContain("auth.admin.mfa.deleteFactor");
    expect(remoteRunner).toContain("auth.admin.updateUserById");
    expect(remoteRunner).toContain("delete from auth.sessions where user_id =");
    expect(remoteRunner).toContain("purgeQaMail(master.email)");
    expect(remoteRunner).toContain("assertHostedAccessLogSafety(callbackLogSnapshot)");
  });
});
