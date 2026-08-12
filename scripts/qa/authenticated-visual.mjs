import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "@playwright/test";
import sharp from "sharp";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(repositoryRoot, "docs/qa/reference-parity");
const screenshotRoot = path.join(outputRoot, "target-authenticated");
const resultsPath = path.join(outputRoot, "authenticated-results.json");

const routes = [
  "/app",
  "/app/etapas/oportunidades",
  "/app/etapas/agendamentos",
  "/app/etapas/visitas",
  "/app/etapas/pastas",
  "/app/etapas/vendas",
  "/app/ranking",
  "/app/canal-de-parcerias",
  "/app/configuracoes",
  "/app/configuracoes/metas",
  "/app/configuracoes/metas/parcerias",
  "/app/configuracoes/metas/pontos",
  "/app/simulacao",
  "/app/simulacao/associativo-fluxo-linear",
  "/app/simulacao/calcular-documentacao",
  "/app/simulacao/caixa",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
];

const viewports = [
  { key: "desktop-1440x900", width: 1440, height: 900 },
  { key: "notebook-1280x720", width: 1280, height: 720 },
  { key: "tablet-768x1024", width: 768, height: 1024 },
  { key: "mobile-390x844", width: 390, height: 844 },
];

const themes = ["light", "balanced", "dark"];
const themeLabels = { light: "Claro", balanced: "Equilibrado", dark: "Escuro" };
const themeCaptureRoutes = new Set([
  "/app",
  "/app/ranking",
  "/app/configuracoes/metas",
  "/app/configuracoes/metas/pontos",
  "/app/simulacao/associativo-fluxo-linear",
]);

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseLocalOrigin(rawOrigin) {
  const candidate = new URL(rawOrigin);
  if (
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash ||
    candidate.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(candidate.hostname)
  ) {
    throw new Error("QA_AUTH_ORIGIN must be an HTTP loopback origin without credentials or path.");
  }
  return candidate.origin;
}

function parseLocalSupabaseUrl(rawUrl) {
  const candidate = new URL(rawUrl);
  if (
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash ||
    candidate.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(candidate.hostname)
  ) {
    throw new Error("QA_AUTH_SUPABASE_URL must be an HTTP loopback origin.");
  }
  return candidate.origin;
}

async function verifyDedicatedLocalQaIdentity(supabaseUrl, publishableKey, email, password) {
  if (!/^qa(?:[.+_-][a-z0-9-]+)+@local\.invalid$/i.test(email)) {
    throw new Error("QA_AUTH_EMAIL must identify a dedicated local.invalid QA account.");
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("Dedicated QA identity was not verified on local Supabase.");
  const session = await response.json();
  if (session.user?.email !== email || typeof session.access_token !== "string") {
    throw new Error("Local Supabase returned an unexpected QA identity.");
  }
  await fetch(`${supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` },
  });
  return { endpoint: supabaseUrl, accountPolicy: "qa.*@local.invalid" };
}

function routeKey(route) {
  return route === "/app" ? "dashboard" : route.slice(5).replaceAll("/", "-");
}

function getCaptureProvenance() {
  const captureCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const pathspec = [".", ":(exclude)docs/qa/reference-parity/**"];
  const diff = execFileSync("git", ["diff", "HEAD", "--binary", "--", ...pathspec], {
    cwd: repositoryRoot,
    maxBuffer: 100 * 1024 * 1024,
  });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.startsWith("docs/qa/reference-parity/"))
    .sort();
  const fingerprint = createHash("sha256").update("head-diff\0").update(diff);
  for (const file of untracked) {
    fingerprint.update("untracked\0").update(file).update("\0");
    fingerprint.update(readFileSync(path.join(repositoryRoot, file)));
  }
  return {
    captureCommit,
    worktreeDirtyAtCapture: diff.length > 0 || untracked.length > 0,
    worktreeFingerprint: fingerprint.digest("hex"),
    worktreeFingerprintAlgorithm: "sha256-git-diff-head-and-untracked-v1",
  };
}

async function saveLosslessWebp(buffer, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    await sharp(buffer).webp({ lossless: true, effort: 6 }).toFile(temporary);
    const contents = await readFile(temporary);
    const metadata = await sharp(contents).metadata();
    await rename(temporary, destination);
    return {
      path: path.relative(outputRoot, destination),
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
      width: metadata.width,
      height: metadata.height,
    };
  } finally {
    await rm(temporary, { force: true });
  }
}

async function login(page, origin, email, password) {
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.origin === origin && url.pathname === "/app", {
      timeout: 30_000,
    }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
}

async function inspectRoute(page, origin, route, expectedTheme, consoleErrors, pageErrors) {
  const consoleStart = consoleErrors.length;
  const pageErrorStart = pageErrors.length;
  const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    (theme) => document.documentElement.dataset.theme === theme,
    expectedTheme,
  );
  await page.evaluate(() => document.fonts.ready);

  const isSimulatorWorkspace = route.startsWith("/app/simulacao/");
  const snapshot = await page.evaluate((simulatorWorkspace) => {
    const text = document.body.innerText;
    const root = document.documentElement;
    const simulatorForm = simulatorWorkspace ? document.querySelector("main form") : null;
    return {
      pathname: window.location.pathname,
      h1Count: document.querySelectorAll("h1").length,
      mainCount: document.querySelectorAll("main").length,
      theme: root.dataset.theme ?? null,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      hasBrokenValue: /\b(?:NaN|undefined)\b/.test(text),
      protectedShellPresent: Boolean(document.querySelector("header nav")),
      loginPresent: Boolean(document.querySelector('input[name="password"]')),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      simulatorActionEnabled: simulatorForm
        ? [...simulatorForm.querySelectorAll("button")].some((button) => !button.disabled)
        : false,
      simulatorFormActionPresent: simulatorForm?.hasAttribute("action") ?? false,
      blockedCalculationMessagePresent:
        !simulatorWorkspace ||
        text.includes("Cálculo temporariamente indisponível — regra aguardando validação"),
    };
  }, isSimulatorWorkspace);

  const passed =
    response?.status() === 200 &&
    snapshot.pathname === route &&
    snapshot.h1Count === 1 &&
    snapshot.mainCount === 1 &&
    snapshot.theme === expectedTheme &&
    !snapshot.horizontalOverflow &&
    !snapshot.hasBrokenValue &&
    snapshot.protectedShellPresent &&
    !snapshot.loginPresent &&
    snapshot.reducedMotion &&
    !snapshot.simulatorActionEnabled &&
    !snapshot.simulatorFormActionPresent &&
    snapshot.blockedCalculationMessagePresent &&
    consoleErrors.length === consoleStart &&
    pageErrors.length === pageErrorStart;

  return {
    route,
    status: response?.status() ?? null,
    ...snapshot,
    consoleErrorCount: consoleErrors.length - consoleStart,
    pageErrorCount: pageErrors.length - pageErrorStart,
    passed,
  };
}

async function setTheme(page, theme) {
  await page.getByRole("button", { name: themeLabels[theme], exact: true }).click();
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    theme,
  );
}

async function checkKeyboard(page, origin) {
  await page.goto(`${origin}/app`, { waitUntil: "domcontentloaded" });
  const summary = page.locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  const opened = await summary.evaluate((element) => element.parentElement?.hasAttribute("open"));
  await page.keyboard.press("Escape");
  const closed = await summary.evaluate((element) => !element.parentElement?.hasAttribute("open"));
  const focusReturned = await summary.evaluate((element) => document.activeElement === element);

  await page.keyboard.press("Tab");
  const tabReachedInteractive = await page.evaluate(() =>
    document.activeElement?.matches("a, button, input, select, textarea, summary"),
  );

  return { opened: Boolean(opened), closed: Boolean(closed), focusReturned, tabReachedInteractive };
}

async function checkSimulatorValidation(page, origin) {
  await page.goto(`${origin}/app/simulacao/associativo-fluxo-linear`, {
    waitUntil: "domcontentloaded",
  });
  const field = page.locator("main form input[required]").first();
  await field.focus();
  await page.keyboard.press("Tab");
  const invalidAfterBlur = (await field.getAttribute("aria-invalid")) === "true";
  const errorId = (await field.getAttribute("aria-describedby"))
    ?.split(/\s+/)
    .find((id) => id.endsWith("-error"));
  const messageAssociated = Boolean(errorId) && (await page.locator(`#${errorId}`).isVisible());
  await field.fill("QA visual local");
  const validAfterInput = (await field.getAttribute("aria-invalid")) !== "true";

  return { invalidAfterBlur, messageAssociated, validAfterInput };
}

async function checkFixtureSourceMarker(page, origin, expectedMarker) {
  const checks = {};
  for (const [key, route] of [
    ["dashboard", "/app"],
    ["ranking", "/app/ranking"],
  ]) {
    await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
    const sourceLabel = page
      .locator("dt")
      .filter({ hasText: /^Fonte$/ })
      .first();
    const sourceValue = sourceLabel.locator("xpath=following-sibling::dd[1]");
    await sourceValue.waitFor({ state: "visible", timeout: 20_000 });
    const visibleSource = ((await sourceValue.textContent()) ?? "").replace(/\s+/g, " ").trim();
    checks[key] = (await sourceValue.isVisible()) && visibleSource === expectedMarker;
  }
  return checks;
}

async function checkZoom(origin, email, password, browser) {
  const context = await browser.newContext({
    viewport: { width: 720, height: 450 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await login(page, origin, email, password);
    const checks = [];
    for (const route of routes) {
      checks.push(await inspectRoute(page, origin, route, "light", consoleErrors, pageErrors));
    }
    return {
      method: "720×450 CSS viewport with deviceScaleFactor 2 (1440×900 physical canvas)",
      routes: checks,
      passed: checks.every((check) => check.passed),
    };
  } finally {
    await context.close();
  }
}

async function run() {
  const fixtureVerification = requiredEnvironment("QA_AUTH_FIXTURE_VERIFICATION");
  if (fixtureVerification !== "rls-marker-v1") {
    throw new Error("Authenticated QA requires fixtures verified by the local isolated runner.");
  }
  const expectedSourceMarker = requiredEnvironment("QA_AUTH_EXPECTED_SOURCE_MARKER");
  if (
    !/^QA local synthetic — not production · run \d{10,}-[a-f0-9]{12}$/.test(expectedSourceMarker)
  ) {
    throw new Error("Authenticated QA received an invalid synthetic source marker.");
  }
  const origin = parseLocalOrigin(requiredEnvironment("QA_AUTH_ORIGIN"));
  const email = requiredEnvironment("QA_AUTH_EMAIL");
  const password = requiredEnvironment("QA_AUTH_PASSWORD");
  const supabaseUrl = parseLocalSupabaseUrl(requiredEnvironment("QA_AUTH_SUPABASE_URL"));
  const publishableKey = requiredEnvironment("QA_AUTH_SUPABASE_PUBLISHABLE_KEY");
  const identityVerification = await verifyDedicatedLocalQaIdentity(
    supabaseUrl,
    publishableKey,
    email,
    password,
  );
  const browser = await chromium.launch({ headless: true });
  const routeChecks = [];
  const themeChecks = [];
  const screenshots = [];
  let keyboard = null;
  let simulatorValidation = null;
  let fixtureSourceMarker = null;

  try {
    await rm(screenshotRoot, { recursive: true, force: true });
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await login(page, origin, email, password);
        for (const route of routes) {
          const check = await inspectRoute(page, origin, route, "light", consoleErrors, pageErrors);
          routeChecks.push({ viewport: viewport.key, ...check });

          const buffer = await page.screenshot({ fullPage: true, animations: "disabled" });
          const destination = path.join(
            screenshotRoot,
            `${routeKey(route)}-${viewport.width}x${viewport.height}.webp`,
          );
          screenshots.push({
            kind: "responsive",
            route,
            viewport: viewport.key,
            theme: "light",
            ...(await saveLosslessWebp(buffer, destination)),
          });
        }

        if (viewport.key === "desktop-1440x900") {
          for (const theme of themes) {
            await page.goto(`${origin}/app`, { waitUntil: "domcontentloaded" });
            await setTheme(page, theme);
            for (const route of routes) {
              const check = await inspectRoute(
                page,
                origin,
                route,
                theme,
                consoleErrors,
                pageErrors,
              );
              themeChecks.push({ theme, ...check });
              if (themeCaptureRoutes.has(route)) {
                const buffer = await page.screenshot({ fullPage: true, animations: "disabled" });
                const destination = path.join(
                  screenshotRoot,
                  "themes",
                  `${routeKey(route)}-${theme}-1440x900.webp`,
                );
                screenshots.push({
                  kind: "theme",
                  route,
                  viewport: viewport.key,
                  theme,
                  ...(await saveLosslessWebp(buffer, destination)),
                });
              }
            }
          }
          keyboard = await checkKeyboard(page, origin);
          simulatorValidation = await checkSimulatorValidation(page, origin);
          fixtureSourceMarker = await checkFixtureSourceMarker(page, origin, expectedSourceMarker);
        }
      } finally {
        await context.close();
      }
    }

    const zoom = await checkZoom(origin, email, password, browser);
    const result = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      ...getCaptureProvenance(),
      environment: "isolated local Supabase",
      account: "dedicated ephemeral QA account",
      identityVerification,
      fixtureVerification: {
        contract: fixtureVerification,
        assertion: "synthetic marker and exact fixture counts verified through authenticated RLS",
        sourceMarkerPolicy: "QA local synthetic — not production · run <ephemeral-id>",
        sourceMarkerVisible: fixtureSourceMarker,
      },
      data: "synthetic local-only fixtures; never production runtime",
      credentialsPersisted: false,
      viewports,
      routeChecks,
      themeChecks,
      keyboard,
      simulatorValidation,
      zoom,
      screenshots,
      visualInspectionCoverage: {
        responsiveScreenshots: routes.length * viewports.length,
        themeScreenshots: themeCaptureRoutes.size * themes.length,
      },
    };
    result.passed =
      routeChecks.every((check) => check.passed) &&
      themeChecks.every((check) => check.passed) &&
      keyboard &&
      Object.values(keyboard).every(Boolean) &&
      simulatorValidation &&
      Object.values(simulatorValidation).every(Boolean) &&
      fixtureSourceMarker &&
      Object.values(fixtureSourceMarker).every(Boolean) &&
      zoom.passed;

    await mkdir(outputRoot, { recursive: true });
    const temporary = `${resultsPath}.tmp-${process.pid}`;
    try {
      await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      await rename(temporary, resultsPath);
    } finally {
      await rm(temporary, { force: true });
    }

    if (!result.passed) throw new Error("Authenticated visual QA failed. Inspect result artifact.");
    process.stdout.write(
      `Authenticated QA passed: ${routeChecks.length} responsive, ${themeChecks.length} theme and ${zoom.routes.length} zoom route checks.\n`,
    );
  } finally {
    await browser.close();
  }
}

await run();
