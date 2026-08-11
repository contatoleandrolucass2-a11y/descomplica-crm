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

    await expect(page.getByText("Dado indisponível — integração pendente").first()).toBeVisible();
    await expect(
      page.locator('[aria-label="Filtros do Canal de Parcerias indisponíveis"]'),
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
