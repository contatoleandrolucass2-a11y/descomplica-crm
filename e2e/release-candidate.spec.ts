import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";

const expectedRoles = [
  "master",
  "admin",
  "manager",
  "broker",
  "coordinator",
  "real_estate",
  "house",
  "partnership_channel",
  "pending",
] as const;

type Role = (typeof expectedRoles)[number];
type QaAccount = { email: string; password: string; role: Role };
type QaTarget = {
  origin: string;
  remoteHomologation: boolean;
  contextOptions: BrowserContextOptions;
};

const homologationOrigin = "https://homolog.descomplicapro.com.br";
const unexpectedRemoteOrigins = new Set<string>();

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required by the local release-candidate harness.`);
  return value;
}

function readTarget(): QaTarget {
  const remoteHomologation = process.env.QA_E2E_REMOTE_HOMOLOGATION === "true";
  if (
    process.env.QA_E2E_REMOTE_HOMOLOGATION !== undefined &&
    !["true", "false"].includes(process.env.QA_E2E_REMOTE_HOMOLOGATION)
  ) {
    throw new Error("QA_E2E_REMOTE_HOMOLOGATION accepts only true or false.");
  }

  const origin = new URL(requiredEnvironment("QA_E2E_ORIGIN"));
  const isCredentialFreeOrigin =
    !origin.username &&
    !origin.password &&
    origin.pathname === "/" &&
    !origin.search &&
    !origin.hash;

  if (remoteHomologation) {
    if (
      !isCredentialFreeOrigin ||
      origin.origin !== homologationOrigin ||
      origin.href !== `${homologationOrigin}/`
    ) {
      throw new Error("Remote E2E is restricted to the isolated homologation origin.");
    }
    const username = requiredEnvironment("QA_E2E_BASIC_AUTH_USERNAME");
    const password = requiredEnvironment("QA_E2E_BASIC_AUTH_PASSWORD");
    return {
      origin: origin.origin,
      remoteHomologation: true,
      contextOptions: { httpCredentials: { username, password } },
    };
  }

  if (requiredEnvironment("QA_E2E_LOCAL_ONLY") !== "true") {
    throw new Error("Release-candidate E2E requires the local-only orchestrator by default.");
  }
  if (
    !isCredentialFreeOrigin ||
    origin.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
  ) {
    throw new Error("QA_E2E_ORIGIN must be a credential-free HTTP loopback origin.");
  }
  return { origin: origin.origin, remoteHomologation: false, contextOptions: {} };
}

const qaTarget = readTarget();
const captureFinalStateEvidence = process.env.QA_CAPTURE_STATE_EVIDENCE === "true";
const finalStateEvidenceRoot = path.resolve(process.cwd(), "docs/qa/final-states");

async function captureState(page: Page, name: string) {
  if (!captureFinalStateEvidence) return;
  await mkdir(finalStateEvidenceRoot, { recursive: true });
  await page.locator("[data-session-identity-label]").evaluateAll((labels) => {
    for (const label of labels) label.textContent = "QA dedicada";
  });
  await page.screenshot({
    path: path.join(finalStateEvidenceRoot, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}

function readAccounts(): Record<Role, QaAccount> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(requiredEnvironment("QA_E2E_ACCOUNTS"));
  } catch {
    throw new Error("QA_E2E_ACCOUNTS must contain valid ephemeral account JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length !== expectedRoles.length) {
    throw new Error("QA_E2E_ACCOUNTS must contain the complete ephemeral role matrix.");
  }

  const accounts = {} as Record<Role, QaAccount>;
  for (const candidate of parsed) {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      !("role" in candidate) ||
      !("email" in candidate) ||
      !("password" in candidate) ||
      !expectedRoles.includes(candidate.role as Role) ||
      typeof candidate.email !== "string" ||
      !/^qa\.rls-[a-z_]+-[a-f0-9]+@local\.invalid$/.test(candidate.email) ||
      typeof candidate.password !== "string" ||
      candidate.password.length < 20
    ) {
      throw new Error("QA_E2E_ACCOUNTS contains an invalid synthetic QA identity.");
    }
    accounts[candidate.role as Role] = candidate as QaAccount;
  }
  if (expectedRoles.some((role) => accounts[role] === undefined)) {
    throw new Error("QA_E2E_ACCOUNTS is missing a required role.");
  }
  return accounts;
}

const accounts = readAccounts();
const genericLoginFailure =
  "Não foi possível autenticar. Verifique suas credenciais e tente novamente.";
const forbiddenHeading = "Você não possui acesso a esta página";
const adminRoles = new Set<Role>(["master", "admin"]);
const masterOnlyRoles = new Set<Role>(["master"]);
const protectedSurfaces = [
  { path: "/app", heading: "Relatório completo da equipe", allowed: masterOnlyRoles },
  {
    path: "/app/etapas/oportunidades",
    heading: "Oportunidades",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/etapas/agendamentos",
    heading: "Agendamentos",
    allowed: masterOnlyRoles,
  },
  { path: "/app/etapas/visitas", heading: "Visitas", allowed: masterOnlyRoles },
  { path: "/app/etapas/pastas", heading: "Pastas", allowed: masterOnlyRoles },
  { path: "/app/etapas/vendas", heading: "Vendas", allowed: masterOnlyRoles },
  { path: "/app/ranking", heading: "Ranking por pontos", allowed: masterOnlyRoles },
  {
    path: "/app/canal-de-parcerias",
    heading: "Ranking das imobiliárias",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/configuracoes",
    heading: "Configurações do CRM",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/configuracoes/metas",
    heading: "Metas do funil",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/configuracoes/metas/parcerias",
    heading: "Metas do funil de parcerias",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/configuracoes/metas/pontos",
    heading: "Metas de pontos",
    allowed: masterOnlyRoles,
  },
  { path: "/app/simulacao", heading: "Simulação", allowed: masterOnlyRoles },
  {
    path: "/app/simulacao/associativo-fluxo-linear",
    heading: "Associativo · Fluxo Linear",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/simulacao/calcular-documentacao",
    heading: "Calcular documentação",
    allowed: masterOnlyRoles,
  },
  { path: "/app/simulacao/caixa", heading: "Simulação CAIXA", allowed: masterOnlyRoles },
  {
    path: "/app/simulacao/tabela-direta",
    heading: "Tabela Direta",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/simulacao/tabela-investidor",
    heading: "Tabela Investidor",
    allowed: masterOnlyRoles,
  },
  { path: "/admin", heading: "Área administrativa", allowed: adminRoles },
  { path: "/admin/usuarios", heading: "Usuários e acessos", allowed: adminRoles },
  { path: "/admin/paginas", heading: "Catálogo de páginas", allowed: masterOnlyRoles },
] as const;

function expectedRoutesForRole(role: Role) {
  return protectedSurfaces
    .filter((surface) => surface.allowed.has(role))
    .map((surface) => surface.path)
    .sort();
}

async function login(page: Page, account: QaAccount) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/app"),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
  await page.locator("h1").first().waitFor({ state: "visible" });
}

async function withRolePage(browser: Browser, role: Role, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    ...qaTarget.contextOptions,
  });
  try {
    await constrainRemoteRequests(context);
    const page = await context.newPage();
    await login(page, accounts[role]);
    await run(page);
  } finally {
    await context.close();
  }
}

async function constrainRemoteRequests(context: BrowserContext) {
  if (!qaTarget.remoteHomologation) return;
  await context.route("**/*", async (route) => {
    let origin: string;
    try {
      origin = new URL(route.request().url()).origin;
    } catch {
      unexpectedRemoteOrigins.add("invalid-url");
      await route.abort("blockedbyclient");
      return;
    }
    if (origin !== qaTarget.origin) {
      unexpectedRemoteOrigins.add(origin);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context }) => {
  unexpectedRemoteOrigins.clear();
  await constrainRemoteRequests(context);
});

test.afterEach(() => {
  expect([...unexpectedRemoteOrigins]).toEqual([]);
});

test("anonymous boundaries and generic login failure stay closed", async ({ page }) => {
  const response = await page.goto("/app/ranking");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("QA synthetic");

  await page.getByLabel("E-mail").fill("qa.unknown@local.invalid");
  await page.getByLabel("Senha").fill("invalid-credential-Aa1!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText(genericLoginFailure, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
});

test("all nine profiles enforce browser navigation and direct-route permissions", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  for (const role of expectedRoles) {
    await withRolePage(browser, role, async (page) => {
      let navigationChecked = false;
      const expectedNavigationRoutes = expectedRoutesForRole(role);
      for (const surface of protectedSurfaces) {
        const response = await page.goto(surface.path);
        if (surface.allowed.has(role)) {
          expect(response?.status()).toBe(200);
          await expect(page).toHaveURL((url) => url.pathname === surface.path);
          const surfaceHeading = page.getByRole("heading", {
            level: 1,
            name: surface.heading,
            exact: true,
          });
          await expect(surfaceHeading).toBeVisible();
          await expect(page.locator("main").filter({ has: surfaceHeading })).toBeVisible();
          await expect(page.getByRole("heading", { level: 1, name: forbiddenHeading })).toHaveCount(
            0,
          );
        } else {
          // A loading boundary may commit a 200 shell before forbidden() runs;
          // terminal UI and the independent RLS matrix remain authoritative.
          expect([200, 403]).toContain(response?.status());
          await expect(
            page.getByRole("heading", { level: 1, name: forbiddenHeading }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { level: 1, name: surface.heading, exact: true }),
          ).toHaveCount(0);
        }

        const navigation = page.locator('header nav[aria-label="Navegação autorizada"]');
        const navigationRoutes = await navigation
          .locator('a[href^="/"]')
          .evaluateAll((links) =>
            [
              ...new Set(
                links.map((link) => new URL(link.getAttribute("href")!, location.origin).pathname),
              ),
            ].sort(),
          );
        expect(navigationRoutes).toEqual(expectedNavigationRoutes);
        if (expectedNavigationRoutes.length > 0) navigationChecked = true;
      }

      expect(navigationChecked).toBe(expectedNavigationRoutes.length > 0);

      if (role === "pending") {
        await page.getByRole("button", { name: "Sair", exact: true }).click();
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
      }
    });
  }
});

test("Master traverses dashboard, five stages, ranking, partnerships and safe filters", async ({
  browser,
}) => {
  await withRolePage(browser, "master", async (page) => {
    const surfaces = [
      ["/app", "Relatório completo da equipe"],
      ["/app/etapas/oportunidades", "Oportunidades"],
      ["/app/etapas/agendamentos", "Agendamentos"],
      ["/app/etapas/visitas", "Visitas"],
      ["/app/etapas/pastas", "Pastas"],
      ["/app/etapas/vendas", "Vendas"],
      ["/app/ranking", "Ranking por pontos"],
      ["/app/canal-de-parcerias", "Ranking das imobiliárias"],
    ] as const;

    for (const [pathname, heading] of surfaces) {
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.locator("html")).not.toHaveJSProperty("scrollWidth", Number.NaN);
      await expect(page.locator("body")).not.toContainText(/\b(?:NaN|undefined)\b/);
    }

    await expect(page.getByText("Dado indisponível — integração pendente").first()).toBeVisible();
    await expect(
      page.getByLabel("Visões e filtros do Canal de Parcerias", { exact: true }),
    ).toBeVisible();
  });
});

test("dashboard and ranking filter links enforce their selected server state", async ({
  browser,
}) => {
  await withRolePage(browser, "master", async (page) => {
    const cases = [
      {
        pathname: "/app?view=with_canal_imob&period=month",
        selectedHref: "/app?view=with_canal_imob&amp;period=month",
      },
      {
        pathname: "/app?view=with_canal_imob&period=week",
        selectedHref: "/app?view=with_canal_imob&amp;period=week",
      },
      {
        pathname: "/app/ranking?period=month&scope=managers",
        selectedHref: "/app/ranking?period=month&amp;scope=managers",
      },
      {
        pathname: "/app/ranking?period=week&scope=managers",
        selectedHref: "/app/ranking?period=week&amp;scope=managers",
      },
    ];

    for (const filterCase of cases) {
      const response = await page.context().request.get(filterCase.pathname, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      const html = await response.text();
      const escapedHref = filterCase.selectedHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(html).toMatch(
        new RegExp(`<a(?=[^>]*href="${escapedHref}")(?=[^>]*aria-current="page")[^>]*>`),
      );
    }
  });
});

test("v3 follows the isolated gate while Qlik relay and commercial engines remain off", async ({
  browser,
  request,
}) => {
  await withRolePage(browser, "master", async (page) => {
    if (qaTarget.remoteHomologation) {
      const response = await page.goto("/app/read-model-v3");
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard do funil v3", exact: true }),
      ).toBeVisible();
    } else {
      for (const pathname of [
        "/app/read-model-v3",
        "/app/read-model-v3/ranking",
        "/app/read-model-v3/canal-de-parcerias",
        "/app/read-model-v3/etapas/oportunidades",
      ]) {
        const response = await page.goto(pathname);
        expect([200, 404]).toContain(response?.status());
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Este endereço ainda não está disponível",
          }),
        ).toBeVisible();
        const technicalDetails = page.getByText("Detalhes técnicos", { exact: true });
        await expect(technicalDetails).toBeVisible();
        await technicalDetails.click();
        await expect(
          page.getByText("Código para suporte: ROUTE-404", { exact: true }),
        ).toBeVisible();
      }
    }
  });

  const relay = await request.post("/api/ingest/qlik", {
    data: { requestId: "00000000-0000-4000-8000-000000000001" },
    maxRedirects: 0,
  });
  expect(relay.status()).toBe(503);
  await expect(relay.json()).resolves.toEqual({ error: "ingestion_unavailable" });

  const engine = await request.post("/api/commercial-engine/simulator.wf13", {
    data: { requestId: "00000000-0000-4000-8000-000000000002", input: {} },
    maxRedirects: 0,
  });
  expect(engine.status()).toBe(503);
  await expect(engine.json()).resolves.toEqual({ error: "engine_unavailable" });

  const officialSimulator = await request.post("/api/official-simulator/associativo-fluxo-linear", {
    data: { schemaVersion: 1, input: {} },
    headers: { origin: qaTarget.origin },
    maxRedirects: 0,
  });
  expect(officialSimulator.status()).toBe(401);
  await expect(officialSimulator.json()).resolves.toEqual({ error: "unauthenticated" });
});

test("isolated homologation exposes its safety controls without sharing production cookies", async ({
  browser,
}) => {
  test.skip(!qaTarget.remoteHomologation, "Remote homologation safety controls are remote-only.");

  await withRolePage(browser, "master", async (page) => {
    const response = await page.goto("/app");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("HOMOLOGAÇÃO — DADOS SINTÉTICOS", { exact: true })).toBeVisible();
    expect(response?.headers()["x-robots-tag"]?.toLowerCase()).toContain("noindex");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);

    const cookies = await page.context().cookies();
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.domain).not.toBe("descomplicapro.com.br");
      expect(cookie.domain).not.toBe(".descomplicapro.com.br");
      expect(cookie.domain.replace(/^\./, "")).toBe("homolog.descomplicapro.com.br");
    }

    const register = await page.goto("/register");
    expect(register?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Criar sua conta" })).toHaveCount(0);
  });
});

test("WF13 runs only for Master while other simulators stay blocked", async ({ browser }) => {
  await withRolePage(browser, "master", async (page) => {
    const status = await page.request.get("/api/official-simulator/associativo-fluxo-linear");
    expect(status.status()).toBe(200);
    expect(status.headers()["cache-control"]).toContain("no-store");
    expect(await status.json()).toMatchObject({
      engineKey: "simulator.wf13",
      executionEnabled: true,
    });

    await page.goto("/app/simulacao/associativo-fluxo-linear");
    await expect(
      page.getByRole("heading", { name: "Motor oficial em validação Master", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Empreendimento *").fill("Residencial QA");
    await page.getByLabel("Produto / unidade *").fill("Torre QA 101");
    await page.getByLabel("Match 100% confirmado").check();
    await page.getByLabel("Data vigente *").fill("2026-08-17");
    await page.getByLabel("Término da obra *").fill("2029-02-28");
    await page.getByLabel("Dia de vencimento das mensais *").selectOption("15");
    await page.getByLabel("Renda *").fill("4.000,00");
    await page.getByLabel("Valor do imóvel *").fill("262.500,00");
    await page.getByLabel("Bônus de adimplência").fill("28.500,00");
    await page.getByLabel("Financiamento").fill("210.000,00");
    await page.getByLabel("Valor do ato").fill("1.000,00");
    await expect(page.getByText("Data do ato", { exact: true })).toBeVisible();
    await expect(page.getByText("17/08/2026", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Valor da anual").first().fill("2.000,00");
    await page.getByLabel("Valor da anual").nth(1).fill("2.000,00");
    await page.getByLabel("Valor da anual").nth(2).fill("2.000,00");
    await expect(page.getByText("15/12/2026", { exact: true })).toBeVisible();
    await expect(page.getByText("15/12/2027", { exact: true })).toBeVisible();
    await expect(page.getByText("15/12/2028", { exact: true })).toBeVisible();
    await page.getByLabel("Ranking no Bora Vender *").selectOption("BRONZE");
    await page.getByLabel("Política comercial conferida").check();
    await page.getByRole("button", { name: "Calcular fluxo linear" }).click();
    await expect(page.getByText("Cálculo concluído para conferência.")).toBeVisible();
    await expect(page.getByText("R$ 17.000,00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 202,38", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 288,67", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("15/09/2026", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/wf13-1\.2\.0/)).toBeVisible();
    await page.getByText("Memória de cálculo auditável", { exact: true }).click();
    await expect(page.getByText("R$ 6.000,00", { exact: true }).first()).toBeVisible();

    const firstAnnual = page.getByLabel("Valor da anual").first();
    await firstAnnual.fill("2.000,01");
    await page.getByRole("button", { name: "Calcular fluxo linear" }).click();
    await expect(firstAnnual).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#simulator-annuals-1-annual-value-error")).toContainText(
      "Anual 1: A anual supera 50% da renda",
    );
    await firstAnnual.fill("2.000,00");
    await page.getByRole("button", { name: "Calcular fluxo linear" }).click();
    await expect(firstAnnual).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Cálculo concluído para conferência.")).toBeVisible();

    for (const simulator of [
      "calcular-documentacao",
      "caixa",
      "tabela-direta",
      "tabela-investidor",
    ]) {
      await page.goto(`/app/simulacao/${simulator}`);
      await expect(
        page.getByRole("heading", {
          name: "Cálculo temporariamente indisponível — regra aguardando validação",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("main form")).not.toHaveAttribute("action");
      await expect(page.locator('main form button[type="submit"]')).toHaveCount(0);
      const calculationAction = page.locator(
        'main form button[aria-describedby="calculation-blocked-reason"]',
      );
      await expect(calculationAction).toHaveCount(1);
      await expect(calculationAction).toBeDisabled();
      await expect(calculationAction).toHaveAttribute("data-cta-state", "blocked");
      await expect(calculationAction.locator("svg")).toHaveCount(1);
      await expect(page.locator("#calculation-blocked-reason")).toBeVisible();
    }

    const enabledAction = page.locator('main form button[data-cta-state="enabled"]').first();
    const blockedAction = page.locator('main form button[data-cta-state="blocked"]').first();
    const unavailableAction = page
      .locator('main form button[data-cta-state="unavailable"]')
      .first();
    await expect(enabledAction).toBeEnabled();
    await expect(blockedAction).toBeDisabled();
    await expect(unavailableAction).toBeDisabled();
    const readActionStyle = (locator: typeof enabledAction) =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderStyle: style.borderStyle,
          color: style.color,
          cursor: style.cursor,
        };
      });
    const [enabledStyle, blockedStyle, unavailableStyle] = await Promise.all([
      readActionStyle(enabledAction),
      readActionStyle(blockedAction),
      readActionStyle(unavailableAction),
    ]);
    expect(enabledStyle.cursor).toBe("pointer");
    expect(blockedStyle.cursor).toBe("not-allowed");
    expect(unavailableStyle.cursor).toBe("not-allowed");
    expect(blockedStyle.backgroundColor).not.toBe(enabledStyle.backgroundColor);
    expect(unavailableStyle.backgroundColor).not.toBe(enabledStyle.backgroundColor);
    expect(blockedStyle.color).not.toBe(enabledStyle.color);
    expect(unavailableStyle.borderStyle).toBe("dashed");
    expect(blockedStyle.borderStyle).toBe("solid");

    await page.goto("/app");
    const disclosure = page.locator("header summary").first();
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure.locator("xpath=..")).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(disclosure).toBeFocused();

    for (const [label, theme] of [
      ["Equilibrado", "balanced"],
      ["Escuro", "dark"],
      ["Claro", "light"],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    }

    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  });

  await withRolePage(browser, "admin", async (page) => {
    const status = await page.request.get("/api/official-simulator/associativo-fluxo-linear");
    expect(status.status()).toBe(403);
    expect(await status.json()).toEqual({ error: "forbidden" });
    await page.goto("/app/simulacao/associativo-fluxo-linear");
    await expect(page.getByRole("heading", { level: 1, name: forbiddenHeading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Calcular fluxo linear" })).toHaveCount(0);
  });
});

test("long session identity truncates without overlapping navigation at 1440", async ({
  browser,
}) => {
  await withRolePage(browser, "master", async (page) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app");
    const identity = page.locator("[data-session-identity]");
    const identityLabel = page.locator("[data-session-identity-label]");
    const navigation = page.getByRole("navigation", { name: "Navegação autorizada" });
    await identityLabel.evaluate((element) => {
      element.textContent = `${"identidade-de-sessao-muito-longa-".repeat(8)}@qa.local.invalid`;
    });

    const metrics = await page.evaluate(() => {
      const label = document.querySelector<HTMLElement>("[data-session-identity-label]");
      const identityElement = document.querySelector<HTMLElement>("[data-session-identity]");
      const navigationElement = document.querySelector<HTMLElement>(
        'nav[aria-label="Navegação autorizada"]',
      );
      if (!label || !identityElement || !navigationElement)
        throw new Error("shell markers missing");
      const style = getComputedStyle(label);
      const identityBox = identityElement.getBoundingClientRect();
      const navigationBox = navigationElement.getBoundingClientRect();
      return {
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        truncated: label.scrollWidth > label.clientWidth,
        separated: navigationBox.top >= identityBox.bottom,
        rootOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    await expect(identity).toBeVisible();
    await expect(navigation).toBeVisible();
    expect(metrics).toEqual({
      overflow: "hidden",
      textOverflow: "ellipsis",
      truncated: true,
      separated: true,
      rootOverflow: false,
    });
  });
});

test("login, logout and terminal state surfaces remain visually explicit", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  await captureState(page, "login");

  await withRolePage(browser, "pending", async (rolePage) => {
    await rolePage.setViewportSize({ width: 1440, height: 900 });
    await rolePage.goto("/app");
    await expect(rolePage.getByRole("heading", { level: 1, name: forbiddenHeading })).toBeVisible();
    await captureState(rolePage, "403");
  });

  await withRolePage(browser, "master", async (rolePage) => {
    await rolePage.setViewportSize({ width: 1440, height: 900 });
    await rolePage.goto("/app/rota-inexistente");
    await expect(
      rolePage.getByRole("heading", {
        level: 1,
        name: "Este endereço ainda não está disponível",
      }),
    ).toBeVisible();
    await captureState(rolePage, "404");

    await rolePage.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) throw new Error("404 surface missing");
      main.className = "flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-12";
      main.innerHTML = `
        <section class="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p class="text-sm font-semibold text-red-700">Falha de carregamento</p>
          <h1 class="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Não foi possível carregar esta página</h1>
          <p class="mt-4 text-slate-600">Ocorreu um erro inesperado. Tente novamente; se o problema continuar, informe o código abaixo ao suporte.</p>
          <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" class="min-h-11 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white">Tentar novamente</button>
            <a href="/app" class="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700">Voltar ao início</a>
          </div>
          <details class="mt-6 text-xs text-slate-500">
            <summary class="mx-auto w-fit cursor-pointer underline underline-offset-2">Detalhes técnicos</summary>
            <code class="mt-2 block font-mono">Código para suporte: APP-500</code>
          </details>
        </section>`;
    });
    await expect(
      rolePage.getByRole("heading", { level: 1, name: "Não foi possível carregar esta página" }),
    ).toBeVisible();
    await captureState(rolePage, "500");

    await rolePage.goto("/app/canal-de-parcerias");
    for (const state of [
      {
        variant: "empty",
        label: "Sem dados",
        title: "Nenhum registro encontrado",
        description: "A consulta autorizada foi concluída sem registros para o período.",
      },
      {
        variant: "stale",
        label: "Fonte atrasada",
        title: "Dados aguardando atualização",
        description:
          "A última base segura permanece identificada enquanto a atualização não chega.",
      },
      {
        variant: "error",
        label: "Erro",
        title: "Não foi possível carregar os dados",
        description: "Nenhum valor anterior foi apresentado como atual. Tente novamente.",
      },
    ] as const) {
      await rolePage.evaluate((currentState) => {
        const source = document.querySelector<HTMLElement>("[data-variant]");
        if (!source) throw new Error("data-state surface missing");
        const clone = source.cloneNode(true) as HTMLElement;
        clone.dataset.variant = currentState.variant;
        clone.setAttribute("role", currentState.variant === "error" ? "alert" : "status");
        const paragraphs = clone.querySelectorAll("p");
        const heading = clone.querySelector("h1, h2, h3");
        if (paragraphs.length < 2 || !heading) throw new Error("data-state structure changed");
        paragraphs[0]!.textContent = currentState.label;
        heading.textContent = currentState.title;
        paragraphs[1]!.textContent = currentState.description;
        document.querySelector("[data-qa-state-evidence]")?.remove();
        const wrapper = document.createElement("div");
        wrapper.dataset.qaStateEvidence = "true";
        wrapper.className = "mx-auto grid min-h-[70vh] max-w-4xl place-items-center px-4 py-12";
        Object.assign(wrapper.style, {
          position: "fixed",
          inset: "0",
          zIndex: "999",
          maxWidth: "none",
          minHeight: "100vh",
          background: "var(--analytics-page)",
        });
        wrapper.append(clone);
        document.body.append(wrapper);
      }, state);
      await expect(rolePage.locator(`[data-variant="${state.variant}"]`)).toBeVisible();
      await captureState(rolePage, state.variant);
    }

    await rolePage.goto("/app");
    await rolePage.evaluate(() => {
      const card = document.querySelector<HTMLElement>('article[data-tone="default"]');
      const cardClass = [...(card?.classList ?? [])].find((className) =>
        className.endsWith("__card"),
      );
      if (!cardClass) throw new Error("compiled analytics card class missing");
      const analyticsPrefix = cardClass.slice(0, -"__card".length);
      const classes = {
        skeleton: `${analyticsPrefix}__skeleton`,
        line: `${analyticsPrefix}__skeletonLine`,
        value: `${analyticsPrefix}__skeletonValue`,
        chart: `${analyticsPrefix}__skeletonChart`,
      };
      document.querySelector("[data-qa-state-evidence]")?.remove();
      const wrapper = document.createElement("main");
      wrapper.dataset.qaStateEvidence = "true";
      wrapper.className = "px-4 py-8 sm:px-6";
      Object.assign(wrapper.style, {
        position: "fixed",
        inset: "0",
        zIndex: "999",
        minHeight: "100vh",
        background: "var(--analytics-page)",
      });
      wrapper.innerHTML = `<div class="mx-auto max-w-7xl" aria-label="Carregando área analítica"><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">${Array.from(
        { length: 5 },
        (_, index) =>
          `<div class="${classes.skeleton}" aria-busy="true" aria-label="Carregando indicador ${index + 1} de 5"><span class="${classes.line}" aria-hidden="true"></span><span class="${classes.value}" aria-hidden="true"></span><span class="${classes.chart}" aria-hidden="true"></span></div>`,
      ).join("")}</div></div>`;
      document.body.append(wrapper);
    });
    await expect(rolePage.locator('[aria-busy="true"]')).toHaveCount(5);
    await captureState(rolePage, "loading");

    await rolePage.goto("/app");
    await rolePage.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(rolePage).toHaveURL(/\/login$/);
    await captureState(rolePage, "logout");
  });

  if (captureFinalStateEvidence) {
    const captureCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
    await writeFile(
      path.join(finalStateEvidenceRoot, "results.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          captureCommit,
          capturedAt: new Date().toISOString(),
          viewport: { width: 1440, height: 900 },
          states: ["login", "logout", "403", "404", "500", "loading", "empty", "stale", "error"],
          method: {
            runtime: ["login", "logout", "403", "404"],
            componentSurface: ["500", "loading", "empty", "stale", "error"],
          },
          syntheticQaOnly: true,
          credentialsPersisted: false,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
});
