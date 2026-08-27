import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
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

import { isRecoveryTokenHash } from "../lib/auth/recovery-token";

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

type BrowserStorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

const homologationOrigin = "https://homolog.descomplicapro.com.br";
const unexpectedRemoteOrigins = new Set<string>();
const roleStorageStates = new Map<Role, BrowserStorageState>();

function decodeBase32(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replaceAll(/\s+/g, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("TOTP enrollment returned an invalid Base32 secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string, at = Date.now()): string {
  const counter = BigInt(Math.floor(at / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value =
    (((digest[offset]! & 0x7f) << 24) |
      (digest[offset + 1]! << 16) |
      (digest[offset + 2]! << 8) |
      digest[offset + 3]!) %
    1_000_000;
  return value.toString().padStart(6, "0");
}

async function waitForNextTotp(secret: string, previousCode: string): Promise<string> {
  const deadline = Date.now() + 35_000;
  while (Date.now() < deadline) {
    const candidate = currentTotp(secret);
    if (candidate !== previousCode) return candidate;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("TOTP window did not advance before timeout.");
}

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
const targetUsesHttps = new URL(qaTarget.origin).protocol === "https:";

function expectCookieUsesTargetTransport(cookie: { secure: boolean } | undefined) {
  expect(cookie).toBeDefined();
  expect(cookie?.secure).toBe(targetUsesHttps);
}

function readMailpitOrigin(): string {
  const origin = new URL(requiredEnvironment("QA_E2E_MAILPIT_ORIGIN"));
  if (
    origin.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("QA_E2E_MAILPIT_ORIGIN must be a credential-free HTTP loopback origin.");
  }
  return origin.origin;
}

const mailpitOrigin = readMailpitOrigin();
const captureFinalStateEvidence = process.env.QA_CAPTURE_STATE_EVIDENCE === "true";
const finalStateEvidenceRoot = path.resolve(process.cwd(), "docs/qa/final-states");

async function captureState(page: Page, name: string) {
  if (!captureFinalStateEvidence) return;
  await mkdir(finalStateEvidenceRoot, { recursive: true });
  await page.screenshot({
    path: path.join(finalStateEvidenceRoot, `${name}.png`),
    fullPage: false,
    animations: "disabled",
    mask: [page.locator("[data-session-identity], [data-account-identity]")],
    maskColor: "#334155",
  });
}

async function waitForRecoveryLink(recipient: string, requestedAfter: number): Promise<string> {
  const deadline = Date.now() + 15_000;
  const diagnostics = {
    callbacks: 0,
    exactKeys: 0,
    tokenContract: 0,
    links: 0,
    messages: 0,
    recoveryType: 0,
    sameOrigin: 0,
  };
  while (Date.now() < deadline) {
    try {
      const listResponse = await fetch(`${mailpitOrigin}/api/v1/messages`, {
        signal: AbortSignal.timeout(2_000),
      });
      const list = (await listResponse.json()) as { messages?: unknown };
      const messages = Array.isArray(list.messages) ? list.messages : [];
      for (const candidate of messages) {
        if (!candidate || typeof candidate !== "object") continue;
        const message = candidate as {
          ID?: unknown;
          Created?: unknown;
          To?: unknown;
        };
        const recipients = Array.isArray(message.To) ? message.To : [];
        const matchesRecipient = recipients.some(
          (entry) =>
            entry !== null &&
            typeof entry === "object" &&
            (entry as { Address?: unknown }).Address === recipient,
        );
        const createdAt = typeof message.Created === "string" ? Date.parse(message.Created) : 0;
        if (
          !matchesRecipient ||
          createdAt < requestedAfter - 1_000 ||
          typeof message.ID !== "string"
        ) {
          continue;
        }
        diagnostics.messages += 1;

        let recoveryLink: string | null = null;
        try {
          const detailResponse = await fetch(
            `${mailpitOrigin}/api/v1/message/${encodeURIComponent(message.ID)}`,
            { signal: AbortSignal.timeout(2_000) },
          );
          const detail = (await detailResponse.json()) as { HTML?: unknown; Text?: unknown };
          const content = [detail.HTML, detail.Text]
            .filter((value): value is string => typeof value === "string")
            .join("\n")
            .replaceAll("&amp;", "&");
          const links = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
          diagnostics.links += links.length;
          for (const link of links) {
            const url = new URL(link);
            const tokenHash = url.searchParams.get("token_hash");
            if (url.origin === qaTarget.origin) diagnostics.sameOrigin += 1;
            if (url.pathname === "/auth/callback") diagnostics.callbacks += 1;
            if (url.searchParams.get("type") === "recovery") diagnostics.recoveryType += 1;
            if (isRecoveryTokenHash(tokenHash)) {
              diagnostics.tokenContract += 1;
            }
            if ([...url.searchParams.keys()].sort().join(",") === "token_hash,type") {
              diagnostics.exactKeys += 1;
            }
            if (
              url.origin === qaTarget.origin &&
              url.pathname === "/auth/callback" &&
              url.searchParams.get("type") === "recovery" &&
              isRecoveryTokenHash(tokenHash) &&
              [...url.searchParams.keys()].sort().join(",") === "token_hash,type"
            ) {
              recoveryLink = url.toString();
              break;
            }
          }
        } finally {
          const deleteResponse = await fetch(`${mailpitOrigin}/api/v1/messages`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ IDs: [message.ID] }),
            signal: AbortSignal.timeout(2_000),
          });
          if (!deleteResponse.ok) throw new Error("Local SMTP message cleanup failed.");
        }
        if (recoveryLink) return recoveryLink;
      }
    } catch {
      // Retry without exposing message bodies, links, tokens or request codes.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Isolated SMTP recovery contract failed (messages=${diagnostics.messages}, links=${diagnostics.links}, same_origin=${diagnostics.sameOrigin}, callbacks=${diagnostics.callbacks}, recovery_type=${diagnostics.recoveryType}, token_contract=${diagnostics.tokenContract}, exact_keys=${diagnostics.exactKeys}).`,
  );
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
const inheritedAnalyticalRoles = new Set<Role>([
  "master",
  "admin",
  "broker",
  "coordinator",
  "real_estate",
]);
const masterOnlyRoles = new Set<Role>(["master"]);
const noRoles = new Set<Role>();
const protectedSurfaces = [
  {
    path: "/app",
    heading: "Relatório completo da equipe",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/etapas/oportunidades",
    heading: "Oportunidades",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/etapas/agendamentos",
    heading: "Agendamentos",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/etapas/visitas",
    heading: "Visitas",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/etapas/pastas",
    heading: "Pastas",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/etapas/vendas",
    heading: "Vendas",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/ranking",
    heading: "Ranking por pontos",
    allowed: inheritedAnalyticalRoles,
  },
  {
    path: "/app/canal-de-parcerias",
    heading: "Ranking das imobiliárias",
    allowed: masterOnlyRoles,
  },
  {
    path: "/app/configuracoes",
    heading: "Configurações do CRM",
    allowed: adminRoles,
  },
  {
    path: "/app/configuracoes/metas",
    heading: "Metas do funil",
    allowed: adminRoles,
  },
  {
    path: "/app/configuracoes/metas/parcerias",
    heading: "Metas do funil de parcerias",
    allowed: adminRoles,
  },
  {
    path: "/app/configuracoes/metas/pontos",
    heading: "Metas de pontos",
    allowed: adminRoles,
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
    allowed: noRoles,
  },
  { path: "/app/simulacao/caixa", heading: "Simulação CAIXA", allowed: noRoles },
  {
    path: "/app/simulacao/tabela-direta",
    heading: "Tabela Direta",
    allowed: noRoles,
  },
  {
    path: "/app/simulacao/tabela-investidor",
    heading: "Tabela Investidor",
    allowed: noRoles,
  },
  { path: "/admin", heading: "Área administrativa", allowed: adminRoles },
  { path: "/admin/usuarios", heading: "Usuários e acessos", allowed: adminRoles },
  { path: "/admin/paginas", heading: "Catálogo de páginas", allowed: adminRoles },
] as const;

function expectedRoutesForRole(role: Role) {
  return protectedSurfaces
    .filter((surface) => surface.allowed.has(role))
    .map((surface) => surface.path)
    .sort();
}

const expectedCommercialPageCountByRole: Readonly<Record<Role, number>> = {
  master: 17,
  admin: 14,
  broker: 7,
  coordinator: 7,
  real_estate: 7,
  manager: 0,
  house: 0,
  partnership_channel: 0,
  pending: 0,
};

function expectedHomeForRole(role: Role) {
  if (inheritedAnalyticalRoles.has(role)) return "/app";
  return "/conta/seguranca";
}

async function acceptEssentialCookies(page: Page) {
  const essential = page.getByRole("button", { name: "Somente essenciais", exact: true });
  if (await essential.isVisible().catch(() => false)) {
    await essential.click();
    await expect(essential).toHaveCount(0);
  }
}

async function login(page: Page, account: QaAccount, rememberBrowser = false) {
  await page.goto("/login");
  await acceptEssentialCookies(page);
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  if (rememberBrowser) {
    await page.getByLabel("Lembrar neste navegador por até 30 dias").check();
  }
  const expectedHome = expectedHomeForRole(account.role);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  try {
    await page.waitForURL((url) => url.pathname === expectedHome, { timeout: 15_000 });
  } catch {
    const actualPath = new URL(page.url()).pathname;
    throw new Error(
      `Authenticated ${account.role} reached ${actualPath}; expected ${expectedHome}.`,
    );
  }
  const actualPath = new URL(page.url()).pathname;
  if (actualPath !== expectedHome) {
    throw new Error(
      `Authenticated ${account.role} reached ${actualPath}; expected ${expectedHome}.`,
    );
  }
  await page.locator("h1").first().waitFor({ state: "visible" });
}

async function withRolePage(browser: Browser, role: Role, run: (page: Page) => Promise<void>) {
  const storageState = roleStorageStates.get(role);
  const context = await browser.newContext({
    reducedMotion: "reduce",
    ...qaTarget.contextOptions,
    ...(storageState ? { storageState } : {}),
  });
  try {
    await constrainRemoteRequests(context);
    const page = await context.newPage();
    if (storageState) {
      await page.goto(expectedHomeForRole(role));
      await expect(page).toHaveURL((url) => url.pathname === expectedHomeForRole(role));
      await page.locator("h1").first().waitFor({ state: "visible" });
    } else {
      await login(page, accounts[role]);
      roleStorageStates.set(role, await context.storageState());
    }
    await run(page);
  } finally {
    await context.close();
  }
}

async function logoutAndAssertBoundary(page: Page, role: Role) {
  await page.goto("/conta/seguranca");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  roleStorageStates.delete(role);
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
}

async function assertRecoveryRedirect(
  page: Page,
  expectedPathname: "/redefinir-senha" | "/esqueci-senha",
  expectedSearch = "",
) {
  const current = new URL(page.url());
  if (
    current.origin === qaTarget.origin &&
    current.pathname === expectedPathname &&
    current.search === expectedSearch
  ) {
    return;
  }

  // A failed callback can leave its one-time token hash in the browser URL.
  // Replace it before throwing so Playwright reporters never receive the
  // token-bearing URL through an assertion message or automatic attachment.
  try {
    await page.goto("/esqueci-senha?status=invalid", { waitUntil: "domcontentloaded" });
  } catch {
    // The context is closed by the caller. Never surface the previous URL.
  }
  throw new Error("Password recovery did not reach the expected safe destination.");
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

test.afterAll(() => {
  roleStorageStates.clear();
});

test("the hosted profile matrix uses the exact approved commercial page sets", () => {
  expect(protectedSurfaces).toHaveLength(21);
  for (const role of expectedRoles) {
    expect(expectedRoutesForRole(role), role).toHaveLength(expectedCommercialPageCountByRole[role]);
  }
});

test("anonymous boundaries and generic login failure stay closed", async ({ page }) => {
  const callbackBoundary = await page.context().request.get("/auth/callback?code=invalid", {
    maxRedirects: 0,
  });
  expect(callbackBoundary.status()).toBe(307);
  expect(callbackBoundary.headers()["referrer-policy"]).toBe("no-referrer");
  const directBoundary = await page.context().request.get("/app/ranking", { maxRedirects: 0 });
  expect([303, 307]).toContain(directBoundary.status());
  expect(directBoundary.headers().location).toBe("/login");
  const response = await page.goto("/app/ranking");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("QA synthetic");
  await acceptEssentialCookies(page);

  await page.getByLabel("E-mail").fill("qa.unknown@local.invalid");
  await page.getByLabel("Senha").fill("invalid-credential-Aa1!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText(genericLoginFailure, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
});

test("cookie choices, legal documents and browser-session lifetimes are explicit", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const consentContext = await browser.newContext(qaTarget.contextOptions);
  try {
    await constrainRemoteRequests(consentContext);
    const page = await consentContext.newPage();
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { level: 2, name: "Preferências de cookies" }),
    ).toBeVisible();
    for (const optionalCategory of ["Funcionais", "Desempenho", "Análise"]) {
      await expect(page.getByLabel(new RegExp(`^${optionalCategory}`))).not.toBeChecked();
    }

    const preferencesButton = page.getByRole("button", {
      name: "Preferências de cookies",
      exact: true,
    });
    await page.getByRole("button", { name: "Somente essenciais", exact: true }).click();
    await expect(preferencesButton).toBeVisible();
    let consentCookie = (await consentContext.cookies()).find(
      (cookie) => cookie.name === "descomplica-cookie-consent",
    );
    expect(consentCookie).toBeDefined();
    expect(consentCookie?.httpOnly).toBe(true);
    expect(consentCookie?.sameSite).toBe("Lax");
    expect(consentCookie?.path).toBe("/");
    expectCookieUsesTargetTransport(consentCookie);
    let consentValue = JSON.parse(decodeURIComponent(consentCookie!.value));
    expect(consentValue.categories).toEqual({
      essential: true,
      security: true,
      functional: false,
      performance: false,
      analytics: false,
    });

    await preferencesButton.click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Preferências de cookies" }),
    ).toBeVisible();
    await page.getByLabel(/^Funcionais/).check();
    await page.getByRole("button", { name: "Salvar preferências", exact: true }).click();
    await expect(preferencesButton).toBeVisible();
    consentCookie = (await consentContext.cookies()).find(
      (cookie) => cookie.name === "descomplica-cookie-consent",
    );
    consentValue = JSON.parse(decodeURIComponent(consentCookie!.value));
    expect(consentValue.categories).toMatchObject({
      functional: true,
      performance: false,
      analytics: false,
    });

    await preferencesButton.click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Preferências de cookies" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Aceitar todos", exact: true }).click();
    await expect(preferencesButton).toBeVisible();
    consentCookie = (await consentContext.cookies()).find(
      (cookie) => cookie.name === "descomplica-cookie-consent",
    );
    consentValue = JSON.parse(decodeURIComponent(consentCookie!.value));
    expect(consentValue.categories).toMatchObject({
      functional: true,
      performance: true,
      analytics: true,
    });

    for (const document of [
      ["/termos-de-uso", "Termos de Uso"],
      ["/politica-de-privacidade", "Política de Privacidade"],
      ["/politica-de-cookies", "Política de Cookies"],
    ] as const) {
      const response = await page.goto(document[0]);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: document[1] })).toBeVisible();
      await expect(page.getByText("Pendente de revisão jurídica", { exact: true })).toBeVisible();
    }

    if (!qaTarget.remoteHomologation) {
      await page.goto("/register");
      const terms = page.getByLabel(/Li e aceito os Termos de Uso/);
      const privacy = page.getByLabel(/Li e aceito a Política de Privacidade/);
      await expect(terms).not.toBeChecked();
      await expect(privacy).not.toBeChecked();
      await expect(terms).toHaveAttribute("required", "");
      await expect(privacy).toHaveAttribute("required", "");
      await expect(page.getByText(/separado das preferências de cookies opcionais/i)).toBeVisible();
    }
  } finally {
    await consentContext.close();
  }

  const temporaryContext = await browser.newContext(qaTarget.contextOptions);
  try {
    await constrainRemoteRequests(temporaryContext);
    const page = await temporaryContext.newPage();
    await login(page, accounts.master);
    const authCookies = (await temporaryContext.cookies()).filter((cookie) =>
      cookie.name.includes("-auth-token"),
    );
    expect(authCookies.length).toBeGreaterThan(0);
    for (const cookie of authCookies) {
      expect(cookie.expires).toBe(-1);
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
      expect(cookie.path).toBe("/");
      expectCookieUsesTargetTransport(cookie);
    }
    const authStorageKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /(?:supabase|auth-token|access|refresh)/i.test(key),
      ),
    );
    expect(authStorageKeys).toEqual([]);
    await logoutAndAssertBoundary(page, "master");
  } finally {
    await temporaryContext.close();
  }

  const rememberedContext = await browser.newContext(qaTarget.contextOptions);
  try {
    await constrainRemoteRequests(rememberedContext);
    const page = await rememberedContext.newPage();
    await login(page, accounts.master, true);
    const now = Date.now() / 1000;
    const rememberedCookies = await rememberedContext.cookies();
    const marker = rememberedCookies.find(
      (cookie) => cookie.name === "descomplica-session-persistence",
    );
    const authCookies = rememberedCookies.filter((cookie) => cookie.name.includes("-auth-token"));
    expect(marker).toBeDefined();
    expect(marker?.httpOnly).toBe(true);
    expect(marker?.sameSite).toBe("Lax");
    expect(marker?.path).toBe("/");
    expectCookieUsesTargetTransport(marker);
    expect(marker?.expires).toBeGreaterThan(now + 29 * 24 * 60 * 60);
    expect(marker?.expires).toBeLessThanOrEqual(now + 30 * 24 * 60 * 60 + 60);
    expect(authCookies.length).toBeGreaterThan(0);
    for (const cookie of authCookies) {
      expect(cookie.expires).toBeGreaterThan(now + 29 * 24 * 60 * 60);
      expect(cookie.expires).toBeLessThanOrEqual(marker!.expires);
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
      expect(cookie.path).toBe("/");
      expectCookieUsesTargetTransport(cookie);
    }

    const invalidRecovery = await page.request.get(
      `/auth/callback?token_hash=${"0".repeat(56)}&type=recovery`,
      { maxRedirects: 0 },
    );
    expect(invalidRecovery.status()).toBe(307);
    const invalidRecoveryLocation = new URL(
      invalidRecovery.headers().location ?? "/",
      qaTarget.origin,
    );
    expect({
      origin: invalidRecoveryLocation.origin,
      pathname: invalidRecoveryLocation.pathname,
      search: invalidRecoveryLocation.search,
    }).toEqual({
      origin: qaTarget.origin,
      pathname: "/esqueci-senha",
      search: "?status=invalid",
    });
    const cookiesAfterFalseCallback = await rememberedContext.cookies();
    const markerAfterFalseCallback = cookiesAfterFalseCallback.find(
      (cookie) => cookie.name === "descomplica-session-persistence",
    );
    expect(markerAfterFalseCallback?.value === marker?.value).toBe(true);
    const sessionAfterFalseCallback = await page.request.get("/api/dashboard/status");
    expect(sessionAfterFalseCallback.status()).toBe(200);

    await rememberedContext.clearCookies({ name: "descomplica-session-persistence" });
    await page.reload();
    const downgradedCookies = (await rememberedContext.cookies()).filter((cookie) =>
      cookie.name.includes("-auth-token"),
    );
    expect(downgradedCookies.length).toBeGreaterThan(0);
    for (const cookie of downgradedCookies) {
      expect(cookie.expires).toBe(-1);
      expect(cookie.sameSite).toBe("Lax");
      expect(cookie.path).toBe("/");
      expectCookieUsesTargetTransport(cookie);
    }
    await logoutAndAssertBoundary(page, "master");
  } finally {
    await rememberedContext.close();
  }
});

for (const role of expectedRoles) {
  test(`profile ${role} enforces browser navigation and every direct route`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    await withRolePage(browser, role, async (page) => {
      const reportProgress = (phase: string) =>
        process.stdout.write(`[route-matrix] role=${role} phase=${phase}\n`);

      reportProgress("identity");
      await expect(page).toHaveURL((url) => url.pathname === expectedHomeForRole(role));
      const identity = page.locator(
        expectedHomeForRole(role) === "/conta/seguranca"
          ? "[data-account-identity]"
          : "[data-session-identity-label]",
      );
      expect((await identity.textContent())?.includes(accounts[role].email)).toBe(true);

      const securityPage = await page.goto("/conta/seguranca");
      expect(securityPage?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: "Segurança da conta", exact: true }),
      ).toBeVisible();
      expect(
        (await page.locator("[data-account-identity]").textContent())?.includes(
          accounts[role].email,
        ),
      ).toBe(true);
      reportProgress("account-security");

      const dashboardApi = await page.request.get("/api/dashboard/status");
      if (inheritedAnalyticalRoles.has(role)) {
        expect(dashboardApi.status()).toBe(200);
        expect(dashboardApi.headers()["cache-control"]).toContain("no-store");
      } else {
        expect(dashboardApi.status()).toBe(403);
        expect(await dashboardApi.json()).toEqual({ error: "forbidden" });
      }

      const simulatorStatus = await page.request.get(
        "/api/official-simulator/associativo-fluxo-linear",
      );
      if (role === "master") {
        expect(simulatorStatus.status()).toBe(200);
        expect(await simulatorStatus.json()).toMatchObject({
          engineKey: "simulator.wf13",
          executionEnabled: true,
        });
      } else {
        expect(simulatorStatus.status()).toBe(403);
        expect(await simulatorStatus.json()).toEqual({ error: "forbidden" });
        const simulatorExecution = await page.request.post(
          "/api/official-simulator/associativo-fluxo-linear",
          {
            data: { schemaVersion: 1, input: {} },
            headers: { origin: qaTarget.origin },
          },
        );
        expect(simulatorExecution.status()).toBe(403);
        expect(await simulatorExecution.json()).toEqual({ error: "forbidden" });
      }

      const disabledApiProbes = [
        page.request.post("/api/ingest/qlik", {
          data: { requestId: "00000000-0000-4000-8000-000000000011" },
        }),
        page.request.post("/api/ingest/salesforce", {
          data: { requestId: "00000000-0000-4000-8000-000000000012" },
        }),
        page.request.post("/api/refresh/salesforce", {
          data: {},
          headers: { origin: qaTarget.origin },
        }),
        page.request.post("/api/commercial-engine/simulator.wf14", {
          data: { requestId: "00000000-0000-4000-8000-000000000013", input: {} },
          headers: { origin: qaTarget.origin },
        }),
      ];
      const disabledApiResponses = await Promise.all(disabledApiProbes);
      const expectedDisabledErrors = [
        "ingestion_unavailable",
        "ingestion_unavailable",
        "refresh_unavailable",
        "engine_unavailable",
      ];
      for (const [index, response] of disabledApiResponses.entries()) {
        expect(response.status()).toBe(503);
        expect(response.headers()["cache-control"]).toContain("no-store");
        expect(await response.json()).toEqual({ error: expectedDisabledErrors[index] });
      }
      reportProgress("api-gates");

      const expectedNavigationRoutes = expectedRoutesForRole(role);
      // Exercise the complete profile × route matrix as direct authenticated
      // requests. Small batches keep the app under realistic concurrency while
      // avoiding a serial browser render for every response-code assertion.
      for (let offset = 0; offset < protectedSurfaces.length; offset += 4) {
        const batch = protectedSurfaces.slice(offset, offset + 4);
        const directResponses = await Promise.all(
          batch.map(async (surface) => ({
            surface,
            response: await page.context().request.get(surface.path, { maxRedirects: 0 }),
          })),
        );
        for (const { surface, response } of directResponses) {
          expect(response.status(), `${role} ${surface.path}`).toBe(
            surface.allowed.has(role) ? 200 : 403,
          );
        }
        reportProgress(`direct-routes-${offset + 1}-${offset + batch.length}`);
      }

      const allowedSurface = protectedSurfaces.find((surface) => surface.allowed.has(role));
      const deniedSurface = protectedSurfaces.find((surface) => !surface.allowed.has(role));
      const navigationSurface = allowedSurface ?? deniedSurface;
      expect(navigationSurface).toBeDefined();

      const assertRenderedSurface = async (surface: (typeof protectedSurfaces)[number]) => {
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
          expect(response?.status()).toBe(403);
          await expect(
            page.getByRole("heading", { level: 1, name: forbiddenHeading }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { level: 1, name: surface.heading, exact: true }),
          ).toHaveCount(0);
        }
      };

      await assertRenderedSurface(navigationSurface!);

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
      reportProgress("navigation");

      if (role === "master") {
        const hubResponse = await page.goto("/app/simulacao");
        expect(hubResponse?.status()).toBe(200);
        await expect(
          page.locator('main a[href="/app/simulacao/associativo-fluxo-linear"]'),
        ).toHaveCount(1);
        for (const route of [
          "/app/simulacao/calcular-documentacao",
          "/app/simulacao/caixa",
          "/app/simulacao/tabela-direta",
          "/app/simulacao/tabela-investidor",
        ]) {
          await expect(page.locator(`main a[href="${route}"]`)).toHaveCount(0);
        }
        await expect(page.locator('article[data-release-state="blocked"]')).toHaveCount(4);
        await expect(page.getByText("Aguardando autorização", { exact: true })).toHaveCount(4);
        reportProgress("simulator-release-gates");
      }

      if (role === "admin") {
        const settingsResponse = await page.goto("/app/configuracoes/metas");
        expect(settingsResponse?.status()).toBe(200);
        await expect(page.getByText("Rascunho indisponível para este perfil")).toBeVisible();
        await expect(page.getByRole("button", { name: "Validar sem aplicar" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Salvar rascunho/ })).toHaveCount(0);
        reportProgress("settings-read-only");
      }

      if (allowedSurface && deniedSurface) await assertRenderedSurface(deniedSurface);

      // These three sessions are reused by the subsequent, role-specific
      // scenarios and logged out there. This keeps the complete release smoke
      // below the local Supabase anti-brute-force threshold without weakening
      // that threshold or skipping a profile logout.
      if (!qaTarget.remoteHomologation && ["master", "admin", "pending"].includes(role)) return;

      await logoutAndAssertBoundary(page, role);
      reportProgress("logout");
    });
  });
}

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
    const policyLimit = page.getByLabel("Limite aprovado");
    const requestedInstallments = page.getByLabel("Parcelas mensais solicitadas *");
    await expect(policyLimit).toHaveValue("84");
    await expect(policyLimit).toHaveAttribute("readonly", "");
    await expect(policyLimit).toHaveAttribute("aria-readonly", "true");
    await expect(requestedInstallments).toHaveAttribute("min", "1");
    await expect(requestedInstallments).toHaveAttribute("max", "84");
    await expect(requestedInstallments).toHaveAttribute("step", "1");
    await expect(page.locator("#simulator-commercial-policy-policy-confirmed")).toHaveCount(0);

    await requestedInstallments.fill("85");
    await requestedInstallments.press("Tab");
    await expect(requestedInstallments).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.locator("#simulator-commercial-policy-requested-installments-error"),
    ).toHaveText(/O limite máximo permitido é de 84 parcelas mensais/);
    await expect(page.getByRole("button", { name: "Calcular fluxo linear" })).toBeDisabled();
    await page.locator("main form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(requestedInstallments).toBeFocused();

    await requestedInstallments.fill("84.5");
    await requestedInstallments.press("Tab");
    await expect(
      page.locator("#simulator-commercial-policy-requested-installments-error"),
    ).toHaveText(/Informe uma quantidade inteira de parcelas/);

    await requestedInstallments.fill("84");
    await expect(requestedInstallments).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Calcular fluxo linear" })).toBeEnabled();
    await page.getByRole("button", { name: "Calcular fluxo linear" }).click();
    await expect(page.getByText("Cálculo concluído para conferência.")).toBeVisible();
    await expect(
      page.getByText("Política comercial conferida", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("R$ 17.000,00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 202,38", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 288,67", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("9,88%", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("15/09/2026", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/wf13-1\.3\.0/)).toBeVisible();
    await page.getByText("Memória de cálculo auditável", { exact: true }).click();
    await expect(page.getByText("R$ 6.000,00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 23.115,00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 234.000,00", { exact: true }).first()).toBeVisible();

    await requestedInstallments.fill("36");
    await page.getByRole("button", { name: "Calcular fluxo linear" }).click();
    const requestedInstallmentsResult = page
      .locator("aside dt")
      .filter({ hasText: /^Parcelas mensais solicitadas$/ })
      .first()
      .locator("xpath=following-sibling::dd[1]");
    const policyLimitResult = page
      .locator("aside dt")
      .filter({ hasText: /^Limite máximo de parcelas$/ })
      .first()
      .locator("xpath=following-sibling::dd[1]");
    await expect(requestedInstallmentsResult).toHaveText("36");
    await expect(policyLimitResult).toHaveText("84");

    await requestedInstallments.fill("84");
    await page.getByRole("button", { name: "Calcular fluxo linear" }).click();
    await expect(page.getByText("Cálculo concluído para conferência.")).toBeVisible();

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
      const response = await page.goto(`/app/simulacao/${simulator}`);
      expect(response?.status()).toBe(403);
      await expect(
        page.getByRole("heading", { level: 1, name: forbiddenHeading, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /^Calcular/u })).toHaveCount(0);
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
  });

  await withRolePage(browser, "admin", async (page) => {
    const status = await page.request.get("/api/official-simulator/associativo-fluxo-linear");
    expect(status.status()).toBe(403);
    expect(await status.json()).toEqual({ error: "forbidden" });
    await page.goto("/app/simulacao/associativo-fluxo-linear");
    await expect(page.getByRole("heading", { level: 1, name: forbiddenHeading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Calcular fluxo linear" })).toHaveCount(0);
    await logoutAndAssertBoundary(page, "admin");
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
    await logoutAndAssertBoundary(rolePage, "pending");
    await captureState(rolePage, "logout");
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
    if (qaTarget.remoteHomologation) {
      await logoutAndAssertBoundary(rolePage, "master");
    }
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

test("password recovery is generic, quarantined, one-time and revokes every session", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const genericRecoveryMessage =
    "Se houver uma conta elegível para esse e-mail, enviaremos as instruções de redefinição.";

  const masterStorageState = roleStorageStates.get("master");
  if (!masterStorageState)
    throw new Error("Master smoke session is unavailable for revocation QA.");
  const existingSessionContext = await browser.newContext({
    ...qaTarget.contextOptions,
    storageState: masterStorageState,
  });
  const recoveryContext = await browser.newContext(qaTarget.contextOptions);
  try {
    await constrainRemoteRequests(existingSessionContext);
    await constrainRemoteRequests(recoveryContext);
    const existingSessionPage = await existingSessionContext.newPage();
    await existingSessionPage.goto("/app");
    await expect(existingSessionPage).toHaveURL((url) => url.pathname === "/app");

    const recoveryPage = await recoveryContext.newPage();
    await recoveryPage.goto("/esqueci-senha");
    await acceptEssentialCookies(recoveryPage);
    await recoveryPage.getByLabel("E-mail").fill("qa.recovery-unknown@local.invalid");
    await recoveryPage.getByRole("button", { name: "Enviar instruções", exact: true }).click();
    await expect(recoveryPage.getByText(genericRecoveryMessage, { exact: true })).toBeVisible();

    await recoveryPage.goto("/esqueci-senha");
    const requestedAfter = Date.now();
    await recoveryPage.getByLabel("E-mail").fill(accounts.master.email);
    await recoveryPage.getByRole("button", { name: "Enviar instruções", exact: true }).click();
    await expect(recoveryPage.getByText(genericRecoveryMessage, { exact: true })).toBeVisible();
    const recoveryLink = await waitForRecoveryLink(accounts.master.email, requestedAfter);

    try {
      await recoveryPage.goto(recoveryLink, { waitUntil: "domcontentloaded" });
    } catch {
      throw new Error("The isolated one-time recovery link could not be opened.");
    }
    await assertRecoveryRedirect(recoveryPage, "/redefinir-senha");

    const quarantinedApi = await recoveryPage.request.get("/api/dashboard/status");
    expect(quarantinedApi.status()).toBe(403);
    expect(await quarantinedApi.json()).toEqual({ error: "password_recovery_required" });
    for (const pathname of ["/app", "/conta/seguranca", "/mfa"]) {
      await recoveryPage.goto(pathname);
      await expect(recoveryPage).toHaveURL((url) => url.pathname === "/redefinir-senha");
    }

    await recoveryPage.getByLabel("Nova senha", { exact: true }).fill("lowercase123!");
    await recoveryPage.getByLabel("Confirmar nova senha", { exact: true }).fill("lowercase123!");
    await recoveryPage
      .getByRole("button", { name: "Redefinir e encerrar sessões", exact: true })
      .click();
    await expect(recoveryPage.getByText("Inclua ao menos uma letra maiúscula.")).toBeVisible();

    const replacementPassword = `Aa1!Reset-${createHmac("sha256", accounts.master.password)
      .update("isolated-recovery-smoke")
      .digest("base64url")}`;
    await recoveryPage.getByLabel("Nova senha", { exact: true }).fill(replacementPassword);
    await recoveryPage
      .getByLabel("Confirmar nova senha", { exact: true })
      .fill(replacementPassword);
    await Promise.all([
      recoveryPage.waitForURL(
        (url) => url.pathname === "/login" && url.search === "?password=updated",
      ),
      recoveryPage
        .getByRole("button", { name: "Redefinir e encerrar sessões", exact: true })
        .click(),
    ]);
    accounts.master.password = replacementPassword;
    roleStorageStates.delete("master");
    await expect(
      recoveryPage.getByText(
        "Senha redefinida. Todas as sessões foram encerradas; entre novamente.",
        { exact: true },
      ),
    ).toBeVisible();

    const oldSessionApi = await existingSessionPage.request.get("/api/dashboard/status");
    expect([401, 403]).toContain(oldSessionApi.status());
    expect(await oldSessionApi.json()).toEqual({
      error: oldSessionApi.status() === 401 ? "unauthenticated" : "forbidden",
    });
    await existingSessionPage.goto("/conta/seguranca");
    await expect(existingSessionPage).toHaveURL((url) => url.pathname === "/login");

    try {
      await recoveryPage.goto(recoveryLink, { waitUntil: "domcontentloaded" });
    } catch {
      throw new Error("The consumed isolated recovery link could not be rechecked.");
    }
    await assertRecoveryRedirect(recoveryPage, "/esqueci-senha", "?status=invalid");
    await expect(
      recoveryPage.getByText(/O link é inválido, expirou ou já foi utilizado/),
    ).toBeVisible();

    await recoveryPage.goto("/login");
    await recoveryPage.getByLabel("E-mail").fill(accounts.master.email);
    await recoveryPage.getByLabel("Senha").fill(replacementPassword.slice(0, -1));
    await recoveryPage.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(recoveryPage.getByText(genericLoginFailure, { exact: true })).toBeVisible();
    // React resets uncontrolled Server Action fields after the failed submit.
    // Re-enter both required credentials so native form validation does not
    // suppress the success-path request.
    await recoveryPage.getByLabel("E-mail").fill(accounts.master.email);
    await recoveryPage.getByLabel("Senha").fill(replacementPassword);
    await Promise.all([
      recoveryPage.waitForURL((url) => url.pathname === "/app"),
      recoveryPage.getByRole("button", { name: "Entrar", exact: true }).click(),
    ]);
    await logoutAndAssertBoundary(recoveryPage, "master");
  } finally {
    await existingSessionContext.close();
    await recoveryContext.close();
  }
});

test("MFA TOTP upgrades Master to AAL2 and remember-browser never bypasses it", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  let secret = "";
  let enrollmentCode = "";
  await withRolePage(browser, "master", async (page) => {
    await page.goto("/conta/seguranca");
    await page
      .getByRole("button", { name: "Ativar verificação em duas etapas", exact: true })
      .click();
    await expect(
      page.getByAltText("Código QR para configurar o aplicativo autenticador"),
    ).toBeVisible();
    secret =
      (
        await page
          .locator("code")
          .filter({ hasText: /^[A-Z2-7]+$/ })
          .textContent()
      )?.trim() ?? "";
    if (!/^[A-Z2-7]{16,128}$/.test(secret)) {
      throw new Error("MFA enrollment did not expose a valid synthetic manual key.");
    }
    enrollmentCode = currentTotp(secret);
    await page.getByLabel("Código de 6 dígitos").fill(enrollmentCode);
    await Promise.all([
      page.waitForURL(
        (url) => url.pathname === "/conta/seguranca" && url.search === "?mfa=enabled",
      ),
      page.getByRole("button", { name: "Confirmar e ativar", exact: true }).click(),
    ]);
    await expect(
      page.getByText("Verificação em duas etapas ativada.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    roleStorageStates.delete("master");
    await expect(page).toHaveURL(/\/login$/);
  });

  const staleAal1Context = await browser.newContext(qaTarget.contextOptions);
  const challengeContext = await browser.newContext(qaTarget.contextOptions);
  try {
    await constrainRemoteRequests(staleAal1Context);
    await constrainRemoteRequests(challengeContext);
    const staleAal1Page = await staleAal1Context.newPage();
    await staleAal1Page.goto("/login");
    await acceptEssentialCookies(staleAal1Page);
    await staleAal1Page.getByLabel("E-mail").fill(accounts.master.email);
    await staleAal1Page.getByLabel("Senha").fill(accounts.master.password);
    await Promise.all([
      staleAal1Page.waitForURL((url) => url.pathname === "/mfa"),
      staleAal1Page.getByRole("button", { name: "Entrar", exact: true }).click(),
    ]);
    const staleBeforeRemoval = await staleAal1Page.request.get("/api/dashboard/status");
    expect(staleBeforeRemoval.status()).toBe(403);
    expect(await staleBeforeRemoval.json()).toEqual({ error: "mfa_required" });

    const page = await challengeContext.newPage();
    await page.goto("/login");
    await acceptEssentialCookies(page);
    await page.getByLabel("E-mail").fill(accounts.master.email);
    await page.getByLabel("Senha").fill(accounts.master.password);
    await page.getByLabel("Lembrar neste navegador por até 30 dias").check();
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/mfa"),
      page.getByRole("button", { name: "Entrar", exact: true }).click(),
    ]);

    const blockedApi = await page.request.get("/api/dashboard/status");
    expect(blockedApi.status()).toBe(403);
    expect(await blockedApi.json()).toEqual({ error: "mfa_required" });
    await page.goto("/app");
    await expect(page).toHaveURL((url) => url.pathname === "/mfa");

    const challengeCode = await waitForNextTotp(secret, enrollmentCode);
    await page.getByLabel("Código de 6 dígitos").fill(challengeCode);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/app"),
      page.getByRole("button", { name: "Verificar e continuar", exact: true }).click(),
    ]);
    await expect(
      page.getByRole("heading", { level: 1, name: "Relatório completo da equipe" }),
    ).toBeVisible();

    await page.goto("/conta/seguranca");
    await Promise.all([
      page.waitForURL(
        (url) => url.pathname === "/conta/seguranca" && url.search === "?mfa=removed",
      ),
      page.getByRole("button", { name: "Remover fator", exact: true }).click(),
    ]);
    await expect(
      page.getByText("Fator removido. A sessão foi atualizada.", { exact: true }),
    ).toBeVisible();

    const staleAfterRemoval = await staleAal1Page.request.get("/api/dashboard/status");
    expect(staleAfterRemoval.status()).toBe(401);
    expect(await staleAfterRemoval.json()).toEqual({ error: "unauthenticated" });
    const stalePageResponse = await staleAal1Page.goto("/app");
    expect(stalePageResponse?.status()).toBe(200);
    await expect(staleAal1Page).toHaveURL((url) => url.pathname === "/login");

    await page.getByRole("button", { name: "Sair", exact: true }).click();
  } finally {
    await staleAal1Context.close();
    await challengeContext.close();
  }

  const noMfaContext = await browser.newContext(qaTarget.contextOptions);
  try {
    await constrainRemoteRequests(noMfaContext);
    const page = await noMfaContext.newPage();
    await login(page, accounts.master);
    await expect(page).toHaveURL((url) => url.pathname === "/app");
    await logoutAndAssertBoundary(page, "master");
  } finally {
    await noMfaContext.close();
  }
});
