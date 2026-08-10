import { expect, test, type Browser, type Page } from "@playwright/test";

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

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required by the local release-candidate harness.`);
  return value;
}

function readAccounts(): Record<Role, QaAccount> {
  if (requiredEnvironment("QA_E2E_LOCAL_ONLY") !== "true") {
    throw new Error("Release-candidate E2E is restricted to the local-only orchestrator.");
  }

  const origin = new URL(requiredEnvironment("QA_E2E_ORIGIN"));
  if (
    origin.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("QA_E2E_ORIGIN must be a credential-free HTTP loopback origin.");
  }

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
      throw new Error("QA_E2E_ACCOUNTS contains an invalid local QA identity.");
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
const simulatorRoles = new Set<Role>(["master", "admin", "broker", "coordinator", "real_estate"]);
const adminRoles = new Set<Role>(["master", "admin"]);
const masterOnlyRoles = new Set<Role>(["master"]);
const protectedSurfaces = [
  { path: "/app", heading: "Dashboard do funil", allowed: masterOnlyRoles },
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
    heading: "Performance das parcerias",
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
    heading: "Metas do funil",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/configuracoes/metas/pontos",
    heading: "Meta por pontos",
    allowed: masterOnlyRoles,
  },
  { path: "/app/simulacao", heading: "Simulação", allowed: simulatorRoles },
  {
    path: "/app/simulacao/associativo-fluxo-linear",
    heading: "Associativo · Fluxo Linear",
    allowed: simulatorRoles,
  },
  {
    path: "/app/simulacao/calcular-documentacao",
    heading: "Calcular documentação",
    allowed: simulatorRoles,
  },
  { path: "/app/simulacao/caixa", heading: "Simulação CAIXA", allowed: simulatorRoles },
  {
    path: "/app/simulacao/tabela-direta",
    heading: "Tabela Direta",
    allowed: simulatorRoles,
  },
  {
    path: "/app/simulacao/tabela-investidor",
    heading: "Tabela Investidor",
    allowed: simulatorRoles,
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
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await login(page, accounts[role]);
    await run(page);
  } finally {
    await context.close();
  }
}

test.describe.configure({ mode: "serial" });

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
          await expect(page.locator("main")).toBeVisible();
          await expect(
            page.getByRole("heading", { level: 1, name: surface.heading, exact: true }),
          ).toBeVisible();
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
      ["/app", "Dashboard do funil"],
      ["/app/etapas/oportunidades", "Oportunidades"],
      ["/app/etapas/agendamentos", "Agendamentos"],
      ["/app/etapas/visitas", "Visitas"],
      ["/app/etapas/pastas", "Pastas"],
      ["/app/etapas/vendas", "Vendas"],
      ["/app/ranking", "Ranking por pontos"],
      ["/app/canal-de-parcerias", "Performance das parcerias"],
    ] as const;

    for (const [pathname, heading] of surfaces) {
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.locator("html")).not.toHaveJSProperty("scrollWidth", Number.NaN);
      await expect(page.locator("body")).not.toContainText(/\b(?:NaN|undefined)\b/);
    }

    await page.goto("/app");
    await page.getByRole("link", { name: "Com Canal Imob", exact: true }).click();
    await expect(page).toHaveURL(/view=with_canal_imob/);
    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await expect(page).toHaveURL(/view=with_canal_imob.*period=week/);
    await expect(page.getByRole("link", { name: "Semana", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.goto("/app/ranking");
    await page.getByRole("link", { name: "Gerentes", exact: true }).click();
    await expect(page).toHaveURL(/scope=managers/);
    await page.getByRole("link", { name: "Esta semana", exact: true }).click();
    await expect(page).toHaveURL(/period=week.*scope=managers/);

    await page.goto("/app/canal-de-parcerias");
    await expect(page.getByText("Dado indisponível — integração pendente").first()).toBeVisible();
    await expect(
      page.locator('[aria-label="Filtros do Canal de Parcerias indisponíveis"]'),
    ).toBeVisible();
  });
});

test("v3, Qlik relay and commercial engines remain off at the real HTTP boundary", async ({
  browser,
  request,
}) => {
  await withRolePage(browser, "master", async (page) => {
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
      await expect(page.getByText("Código para suporte: ROUTE-404", { exact: true })).toBeVisible();
    }
  });

  const relay = await request.post("/api/ingest/qlik", {
    data: { requestId: "00000000-0000-4000-8000-000000000001" },
  });
  expect(relay.status()).toBe(503);
  await expect(relay.json()).resolves.toEqual({ error: "ingestion_unavailable" });

  const engine = await request.post("/api/commercial-engine/simulator.wf13", {
    data: { requestId: "00000000-0000-4000-8000-000000000002", input: {} },
  });
  expect(engine.status()).toBe(503);
  await expect(engine.json()).resolves.toEqual({ error: "engine_unavailable" });
});

test("simulators stay visual-only and keyboard/theme controls remain operable", async ({
  browser,
}) => {
  await withRolePage(browser, "master", async (page) => {
    for (const simulator of [
      "associativo-fluxo-linear",
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
      const enabledActionCount = await page.locator("main form button:enabled").count();
      expect(enabledActionCount).toBe(0);
    }

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
});
