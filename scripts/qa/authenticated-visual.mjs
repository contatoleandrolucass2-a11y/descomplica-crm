import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(repositoryRoot, "docs/qa/reference-parity");
const baselineScreenshotRoot = path.join(outputRoot, "target-authenticated");
const simulatorCanaryBaselineRoot = path.join(outputRoot, "target-authenticated-canary");
const baselineResultsPath = path.join(outputRoot, "authenticated-results.json");
const artifactRoot = path.join(repositoryRoot, "test-results/authenticated-visual");
const candidateScreenshotRoot = path.join(artifactRoot, "candidate");
const candidateResultsPath = path.join(artifactRoot, "candidate-results.json");
const visualDifferenceThreshold = 0.01;
const visualChannelTolerance = 16;
const accessibilityTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const homologationOrigin = "https://homolog.descomplicapro.com.br";
const remoteHomologation = process.env.QA_AUTH_REMOTE_HOMOLOGATION === "true";
const environmentLabel = remoteHomologation
  ? "isolated remote homologation with local-only Supabase"
  : "isolated local Supabase";
const accountLabel = remoteHomologation
  ? "dedicated persistent synthetic QA account"
  : "dedicated ephemeral QA account";
const identityEvidencePolicy = Object.freeze({
  persistedScreenshotsSanitized: remoteHomologation,
  strategy: remoteHomologation
    ? "mask visible identity and email regions before persistence"
    : "local synthetic baseline capture",
});

function parseMode(argv) {
  if (argv.length === 0) return "verify";
  if (argv.length === 1 && argv[0] === "--update-baseline") return "update-baseline";
  throw new Error("Authenticated visual QA accepts only the optional --update-baseline flag.");
}

const mode = parseMode(process.argv.slice(2));

const baseRoutes = [
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
  "/admin",
  "/admin/usuarios",
  "/admin/paginas",
];

const legacyRoutesByRuntimeKey = new Map([
  ["simulator.wf16", "/app/simulacao/calcular-documentacao"],
  ["simulator.caixa", "/app/simulacao/caixa"],
  ["simulator.wf14", "/app/simulacao/tabela-direta"],
  ["simulator.wf15", "/app/simulacao/tabela-investidor"],
  ["simulator.tabelao", "/app/simulacao/tabela"],
  ["dialer", "/app/discador"],
  ["dialer.weekend-forecast", "/app/discador/previsao-final-de-semana"],
]);

function expectedEnabledLegacyRoutes() {
  if (process.env.LEGACY_MIGRATION_RUNTIME_MODE !== "active") return new Set();
  const enabledKeys = (process.env.LEGACY_MIGRATION_ENABLED_MODULES ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const unknownKeys = enabledKeys.filter((key) => !legacyRoutesByRuntimeKey.has(key));
  if (unknownKeys.length > 0 || new Set(enabledKeys).size !== enabledKeys.length) {
    throw new Error("Authenticated visual QA received an invalid legacy migration runtime key.");
  }
  return new Set(enabledKeys.map((key) => legacyRoutesByRuntimeKey.get(key)));
}

const enabledLegacyRoutes = expectedEnabledLegacyRoutes();
const routes = [
  ...baseRoutes.slice(0, 14),
  ...[...enabledLegacyRoutes].filter((route) => !baseRoutes.includes(route)),
  ...baseRoutes.slice(14),
];

const simulatorRoutesByRuntimeKey = new Map([
  ["simulator.wf13", "/app/simulacao/associativo-fluxo-linear"],
  ["simulator.wf16", "/app/simulacao/calcular-documentacao"],
  ["simulator.caixa", "/app/simulacao/caixa"],
  ["simulator.wf14", "/app/simulacao/tabela-direta"],
  ["simulator.wf15", "/app/simulacao/tabela-investidor"],
]);
const simulatorRuntimeKeysByRoute = new Map(
  [...simulatorRoutesByRuntimeKey].map(([runtimeKey, route]) => [route, runtimeKey]),
);

function expectedEnabledSimulatorRoutes() {
  if (process.env.OFFICIAL_SIMULATOR_RUNTIME_MODE !== "active") return new Set();

  const enabledKeys = (process.env.OFFICIAL_SIMULATOR_ENABLED_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const unknownKeys = enabledKeys.filter((key) => !simulatorRoutesByRuntimeKey.has(key));
  if (unknownKeys.length > 0) {
    throw new Error("Authenticated visual QA received an unknown simulator runtime key.");
  }

  return new Set(enabledKeys.map((key) => simulatorRoutesByRuntimeKey.get(key)));
}

const enabledSimulatorRoutes = expectedEnabledSimulatorRoutes();
const simulatorHubCanaryKey =
  enabledSimulatorRoutes.size === 1
    ? simulatorRuntimeKeysByRoute.get([...enabledSimulatorRoutes][0])
    : undefined;

function visualBaselinePath(route, candidatePath) {
  const relativeCandidatePath = path.relative(candidateScreenshotRoot, candidatePath);
  if (enabledLegacyRoutes.size > 0) {
    return path.join(
      simulatorCanaryBaselineRoot,
      "legacy-migration-2026-08-28",
      relativeCandidatePath,
    );
  }
  const runtimeKey = simulatorRuntimeKeysByRoute.get(route);
  if (runtimeKey && enabledSimulatorRoutes.has(route)) {
    return path.join(simulatorCanaryBaselineRoot, runtimeKey, relativeCandidatePath);
  }
  if (route === "/app/simulacao" && simulatorHubCanaryKey) {
    return path.join(simulatorCanaryBaselineRoot, simulatorHubCanaryKey, relativeCandidatePath);
  }
  return path.join(baselineScreenshotRoot, relativeCandidatePath);
}

const viewports = [
  { key: "desktop-1440x900", width: 1440, height: 900 },
  { key: "notebook-1280x720", width: 1280, height: 720 },
  { key: "tablet-1024x768", width: 1024, height: 768 },
  { key: "tablet-768x1024", width: 768, height: 1024 },
  { key: "mobile-390x844", width: 390, height: 844 },
  { key: "mobile-360x800", width: 360, height: 800 },
  { key: "mobile-320x568", width: 320, height: 568 },
];

const themes = ["light", "balanced", "dark"];
const themeLabels = { light: "Claro", balanced: "Equilibrado", dark: "Escuro" };
const adminRoutes = ["/admin", "/admin/usuarios", "/admin/paginas"];
const desktopThemeCaptureRoutes = new Set([
  "/app",
  "/app/ranking",
  "/app/configuracoes/metas",
  "/app/configuracoes/metas/pontos",
  "/app/simulacao/associativo-fluxo-linear",
  ...adminRoutes,
]);
const mobileDarkViewportKey = "mobile-390x844";
const zoomLevels = [
  { percent: 80, width: 1800, height: 1125, deviceScaleFactor: 0.8 },
  { percent: 100, width: 1440, height: 900, deviceScaleFactor: 1 },
  { percent: 125, width: 1152, height: 720, deviceScaleFactor: 1.25 },
  { percent: 150, width: 960, height: 600, deviceScaleFactor: 1.5 },
  { percent: 200, width: 720, height: 450, deviceScaleFactor: 2 },
];

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseQaOrigin(rawOrigin) {
  const candidate = new URL(rawOrigin);
  if (
    remoteHomologation &&
    !candidate.username &&
    !candidate.password &&
    candidate.origin === homologationOrigin &&
    candidate.pathname === "/" &&
    !candidate.search &&
    !candidate.hash
  ) {
    return candidate.origin;
  }
  if (
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash ||
    candidate.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(candidate.hostname)
  ) {
    throw new Error(
      "QA_AUTH_ORIGIN must be HTTP loopback, or the explicitly enabled homologation origin.",
    );
  }
  return candidate.origin;
}

function homologationHttpCredentials(origin) {
  if (!remoteHomologation) return undefined;
  if (origin !== homologationOrigin) {
    throw new Error("Remote homologation mode requires the approved homologation origin.");
  }
  return {
    username: requiredEnvironment("QA_AUTH_BASIC_USERNAME"),
    password: requiredEnvironment("QA_AUTH_BASIC_PASSWORD"),
    origin,
    send: "always",
  };
}

async function hideHomologationBannerForBaseline(context) {
  if (!remoteHomologation) return;
  await context.addInitScript(() => {
    const hideBanner = () => {
      const style = document.createElement("style");
      style.textContent = ".homologation-banner{display:none!important}";
      document.head.append(style);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", hideBanner, { once: true });
    } else {
      hideBanner();
    }
  });
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
  if (route === "/app") return "dashboard";
  const pathWithoutRoot = route.startsWith("/app/") ? route.slice(5) : route.slice(1);
  return pathWithoutRoot.replaceAll("/", "-");
}

function repositoryRelative(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

function relativeTo(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function trackedRepositoryFiles() {
  return new Set(
    execFileSync("git", ["ls-files", "-z", "--", "docs/qa/reference-parity"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean),
  );
}

function baselineMatchesHead() {
  const paths = [
    repositoryRelative(baselineResultsPath),
    repositoryRelative(baselineScreenshotRoot),
    repositoryRelative(simulatorCanaryBaselineRoot),
  ];
  try {
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) {
      return false;
    }
    throw error;
  }

  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  return untracked.length === 0;
}

async function sha256File(filePath) {
  try {
    const contents = await readFile(filePath);
    return {
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJsonAtomically(destination, value) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
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
      path: relativeTo(artifactRoot, destination),
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
      width: metadata.width,
      height: metadata.height,
    };
  } finally {
    await rm(temporary, { force: true });
  }
}

async function captureComparableScreenshot(page) {
  const volatileRegions = page.locator("[data-qa-visual-volatile]:not([hidden])");
  await volatileRegions.evaluateAll((elements) => {
    for (const element of elements) {
      element.setAttribute("data-qa-visual-hidden", "true");
      element.setAttribute("hidden", "");
    }
  });
  try {
    return await page.screenshot({ fullPage: true, animations: "disabled" });
  } finally {
    await page.locator('[data-qa-visual-hidden="true"]').evaluateAll((elements) => {
      for (const element of elements) {
        element.removeAttribute("hidden");
        element.removeAttribute("data-qa-visual-hidden");
      }
    });
  }
}

async function capturePersistedScreenshot(page, comparableBuffer) {
  if (!remoteHomologation) {
    return comparableBuffer ?? (await page.screenshot({ fullPage: true, animations: "disabled" }));
  }

  await page.evaluate(() => {
    const marker = "remote-homologation";
    const emailPattern =
      /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/iu;
    const mark = (element) => {
      if (element instanceof HTMLElement) {
        element.setAttribute("data-qa-evidence-identity", marker);
      }
    };

    for (const element of document.querySelectorAll(
      "[data-session-identity], [data-account-identity]",
    )) {
      mark(element);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (emailPattern.test(node.nodeValue ?? "")) mark(node.parentElement);
      node = walker.nextNode();
    }

    for (const element of document.querySelectorAll("[aria-label], [title], input[value]")) {
      if (
        ["aria-label", "title", "value"].some((attribute) =>
          emailPattern.test(element.getAttribute(attribute) ?? ""),
        )
      ) {
        mark(element);
      }
    }
  });

  try {
    return await page.screenshot({
      fullPage: true,
      animations: "disabled",
      mask: [page.locator('[data-qa-evidence-identity="remote-homologation"]')],
      maskColor: "#334155",
    });
  } finally {
    await page
      .locator('[data-qa-evidence-identity="remote-homologation"]')
      .evaluateAll((elements) => {
        for (const element of elements) element.removeAttribute("data-qa-evidence-identity");
      });
  }
}

async function compareVisualBaseline(buffer, baselinePath, trackedFiles) {
  const repositoryPath = repositoryRelative(baselinePath);
  if (!trackedFiles.has(repositoryPath)) {
    return {
      passed: false,
      reason: "baseline_not_tracked",
      changedPixelRatio: null,
      baselineUsed: { path: repositoryPath, tracked: false, bytes: null, sha256: null },
    };
  }

  let baseline;
  try {
    baseline = await readFile(baselinePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        passed: false,
        reason: "baseline_missing",
        changedPixelRatio: null,
        baselineUsed: {
          path: repositoryPath,
          tracked: true,
          bytes: null,
          sha256: null,
        },
      };
    }
    throw error;
  }

  const baselineUsed = {
    path: repositoryPath,
    tracked: true,
    bytes: baseline.byteLength,
    sha256: createHash("sha256").update(baseline).digest("hex"),
  };

  const [actual, expected] = await Promise.all([
    sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(baseline).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (
    actual.info.width !== expected.info.width ||
    actual.info.height !== expected.info.height ||
    actual.info.channels !== expected.info.channels
  ) {
    return {
      passed: false,
      reason: "dimensions_changed",
      changedPixelRatio: 1,
      expected: { width: expected.info.width, height: expected.info.height },
      actual: { width: actual.info.width, height: actual.info.height },
      baselineUsed,
    };
  }

  const channels = actual.info.channels;
  const pixels = actual.info.width * actual.info.height;
  let changedPixels = 0;
  for (let offset = 0; offset < actual.data.length; offset += channels) {
    let changed = false;
    for (let channel = 0; channel < channels; channel += 1) {
      if (
        Math.abs(actual.data[offset + channel] - expected.data[offset + channel]) >
        visualChannelTolerance
      ) {
        changed = true;
        break;
      }
    }
    if (changed) changedPixels += 1;
  }
  const changedPixelRatio = pixels === 0 ? 1 : changedPixels / pixels;
  return {
    passed: changedPixelRatio <= visualDifferenceThreshold,
    reason: changedPixelRatio <= visualDifferenceThreshold ? "within_threshold" : "pixel_drift",
    changedPixels,
    totalPixels: pixels,
    changedPixelRatio,
    baselineUsed,
  };
}

function summarizeBaselineUsage(screenshots, resultsFile) {
  const files = screenshots
    .map((screenshot) => screenshot.visualComparison.baselineUsed)
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = createHash("sha256");
  for (const file of files) {
    manifest
      .update(file.path)
      .update("\0")
      .update(file.sha256 ?? "missing")
      .update("\0");
  }
  return {
    root: repositoryRelative(baselineScreenshotRoot),
    result: {
      path: repositoryRelative(baselineResultsPath),
      tracked: resultsFile.tracked,
      bytes: resultsFile.digest?.bytes ?? null,
      sha256: resultsFile.digest?.sha256 ?? null,
    },
    files,
    fileCount: files.length,
    manifestSha256: manifest.digest("hex"),
  };
}

async function baselineUsageIsUnchanged(baselineUsed) {
  const resultDigest = await sha256File(path.join(repositoryRoot, baselineUsed.result.path));
  if (
    resultDigest?.sha256 !== baselineUsed.result.sha256 ||
    resultDigest?.bytes !== baselineUsed.result.bytes
  ) {
    return false;
  }

  for (const file of baselineUsed.files) {
    const digest = await sha256File(path.join(repositoryRoot, file.path));
    if ((digest?.sha256 ?? null) !== file.sha256 || (digest?.bytes ?? null) !== file.bytes) {
      return false;
    }
  }
  return true;
}

async function inspectAccessibility(page, route, viewport, theme) {
  const analysis = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
  const violations = analysis.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    affectedNodes: violation.nodes.length,
    targets: violation.nodes.map((node) => node.target),
    helpUrl: violation.helpUrl,
  }));
  return { route, viewport, theme, violations, passed: violations.length === 0 };
}

async function login(page, origin, email, password) {
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  const acceptAllCookies = page.getByRole("button", {
    name: "Aceitar todos",
    exact: true,
  });
  if (await acceptAllCookies.isVisible()) {
    await acceptAllCookies.click();
    await page
      .getByRole("button", { name: "Preferências de cookies", exact: true })
      .waitFor({ state: "visible" });
  }
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

  const isSimulatorWorkspace = simulatorRuntimeKeysByRoute.has(route);
  const expectsEnabledSimulatorAction = enabledSimulatorRoutes.has(route);
  const snapshot = await page.evaluate((simulatorWorkspace) => {
    const text = document.body.innerText;
    const root = document.documentElement;
    const simulatorForm = simulatorWorkspace ? document.querySelector("main form") : null;
    const topbarInner = document.querySelector("header > div");
    const brand = topbarInner?.firstElementChild;
    const navigation = document.querySelector('header nav[aria-label="Navegação autorizada"]');
    const identity = document.querySelector("[data-session-identity]");
    const identityLabel = document.querySelector("[data-session-identity-label]");
    const actions = identity?.parentElement;
    const accountLink = document.querySelector('header a[href="/conta/seguranca"]');
    const actionChildren = actions ? [...actions.children] : [];
    const elementLabel = (element, index) => {
      if (element === identity) return "identity";
      if (element === accountLink) return "accountLink";
      if (element.matches('[role="group"][aria-label="Aparência da página"]')) {
        return "themeSwitch";
      }
      if (element.matches("form")) return "logoutForm";
      return `action-${index}`;
    };
    const rectanglesOverlap = (first, second) => {
      if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) return false;
      if (
        getComputedStyle(first).display === "none" ||
        getComputedStyle(second).display === "none"
      ) {
        return false;
      }
      const firstBox = first.getBoundingClientRect();
      const secondBox = second.getBoundingClientRect();
      return (
        firstBox.left < secondBox.right &&
        firstBox.right > secondBox.left &&
        firstBox.top < secondBox.bottom &&
        firstBox.bottom > secondBox.top
      );
    };
    const topbarCollisionPairs = [];
    if (rectanglesOverlap(navigation, identity)) {
      topbarCollisionPairs.push("navigation×identity");
    }
    if (rectanglesOverlap(brand, actions)) {
      topbarCollisionPairs.push("brand×actions");
    }
    for (let firstIndex = 0; firstIndex < actionChildren.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < actionChildren.length;
        secondIndex += 1
      ) {
        if (rectanglesOverlap(actionChildren[firstIndex], actionChildren[secondIndex])) {
          topbarCollisionPairs.push(
            `${elementLabel(actionChildren[firstIndex], firstIndex)}×${elementLabel(
              actionChildren[secondIndex],
              secondIndex,
            )}`,
          );
        }
      }
    }
    const blockedAction = simulatorForm?.querySelector('[data-cta-state="blocked"]');
    const enabledAction = simulatorForm?.querySelector(
      'button[type="submit"][data-cta-state="enabled"]',
    );
    const unavailableAction = simulatorForm?.querySelector('[data-cta-state="unavailable"]');
    const blockedStyle = blockedAction ? getComputedStyle(blockedAction) : null;
    const enabledStyle = enabledAction ? getComputedStyle(enabledAction) : null;
    const unavailableStyle = unavailableAction ? getComputedStyle(unavailableAction) : null;
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
      topbarCollision: topbarCollisionPairs.length > 0,
      topbarCollisionPairs,
      identityTruncationReady:
        !identityLabel ||
        getComputedStyle(identityLabel).display === "none" ||
        (getComputedStyle(identityLabel).overflow === "hidden" &&
          getComputedStyle(identityLabel).textOverflow === "ellipsis"),
      simulatorActionEnabled: Boolean(enabledAction) && !enabledAction?.disabled,
      simulatorFormActionPresent: simulatorForm?.hasAttribute("action") ?? false,
      blockedCalculationMessagePresent:
        !simulatorWorkspace || Boolean(document.querySelector("#calculation-blocked-reason")),
      blockedActionDistinct:
        !simulatorWorkspace ||
        (Boolean(blockedAction?.querySelector("svg")) &&
          Boolean(document.querySelector("#calculation-blocked-reason")) &&
          blockedStyle?.backgroundColor !== enabledStyle?.backgroundColor &&
          blockedStyle?.cursor === "not-allowed"),
      unavailableActionDistinct:
        !unavailableAction ||
        (unavailableStyle?.backgroundColor !== enabledStyle?.backgroundColor &&
          unavailableStyle?.borderStyle === "dashed" &&
          unavailableStyle?.cursor === "not-allowed"),
    };
  }, isSimulatorWorkspace);

  const simulatorStatePassed = !isSimulatorWorkspace
    ? !snapshot.simulatorActionEnabled && !snapshot.simulatorFormActionPresent
    : expectsEnabledSimulatorAction
      ? snapshot.simulatorActionEnabled &&
        !snapshot.simulatorFormActionPresent &&
        !snapshot.blockedCalculationMessagePresent
      : !snapshot.simulatorActionEnabled &&
        !snapshot.simulatorFormActionPresent &&
        snapshot.blockedCalculationMessagePresent &&
        snapshot.blockedActionDistinct;

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
    !snapshot.topbarCollision &&
    snapshot.identityTruncationReady &&
    simulatorStatePassed &&
    snapshot.unavailableActionDistinct &&
    consoleErrors.length === consoleStart &&
    pageErrors.length === pageErrorStart;

  return {
    route,
    status: response?.status() ?? null,
    expectedSimulatorState: isSimulatorWorkspace
      ? expectsEnabledSimulatorAction
        ? "enabled"
        : "blocked"
      : "not-applicable",
    simulatorStatePassed,
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
  await field.waitFor({ state: "visible" });
  await field.focus();
  await page.keyboard.press("Tab");
  await page.waitForFunction(
    () =>
      document.querySelector("main form input[required]")?.getAttribute("aria-invalid") === "true",
  );
  const invalidAfterBlur = (await field.getAttribute("aria-invalid")) === "true";
  const errorId = (await field.getAttribute("aria-describedby"))
    ?.split(/\s+/)
    .find((id) => id.endsWith("-error"));
  if (errorId) await page.locator(`#${errorId}`).waitFor({ state: "visible" });
  const messageAssociated = Boolean(errorId) && (await page.locator(`#${errorId}`).isVisible());
  await field.fill("QA visual local");
  await page.waitForFunction(
    () =>
      document.querySelector("main form input[required]")?.getAttribute("aria-invalid") !== "true",
  );
  const validAfterInput = (await field.getAttribute("aria-invalid")) !== "true";

  const policyLimit = page.getByLabel("Limite aprovado");
  const requestedInstallments = page.getByLabel("Parcelas mensais solicitadas *");
  const calculationAction = page.getByRole("button", { name: "Calcular fluxo linear" });
  const fixedLimit =
    (await policyLimit.inputValue()) === "84" &&
    (await policyLimit.getAttribute("readonly")) !== null &&
    (await policyLimit.getAttribute("aria-readonly")) === "true";
  const policyConfirmationIsAutomatic =
    (await page.locator("#simulator-commercial-policy-policy-confirmed").count()) === 0;

  await requestedInstallments.fill("85");
  await requestedInstallments.press("Tab");
  const maximumRejected =
    (await requestedInstallments.getAttribute("aria-invalid")) === "true" &&
    (
      await page.locator("#simulator-commercial-policy-requested-installments-error").textContent()
    )?.includes("O limite máximo permitido é de 84 parcelas mensais.") === true &&
    (await calculationAction.isDisabled());

  await requestedInstallments.fill("84.5");
  await requestedInstallments.press("Tab");
  const decimalRejected =
    (
      await page.locator("#simulator-commercial-policy-requested-installments-error").textContent()
    )?.includes("Informe uma quantidade inteira de parcelas.") === true;

  await requestedInstallments.fill("84");
  const expectsEnabledAction = enabledSimulatorRoutes.has(
    "/app/simulacao/associativo-fluxo-linear",
  );
  const correctionClearsError =
    (await requestedInstallments.getAttribute("aria-invalid")) !== "true" &&
    ((expectsEnabledAction && !(await calculationAction.isDisabled())) ||
      (!expectsEnabledAction && (await calculationAction.isDisabled())));

  return {
    invalidAfterBlur,
    messageAssociated,
    validAfterInput,
    fixedLimit,
    policyConfirmationIsAutomatic,
    maximumRejected,
    decimalRejected,
    correctionClearsError,
  };
}

async function checkFixtureSourceMarker(page, origin, expectedMarker) {
  const checks = {};
  for (const [key, route] of [
    ["dashboard", "/app"],
    ["stageOpportunities", "/app/etapas/oportunidades"],
  ]) {
    await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
    const sourceLabel = page
      .locator("dt")
      .filter({ hasText: /^Fonte$/ })
      .first();
    const sourceValue = sourceLabel.locator("xpath=following-sibling::dd[1]");
    await sourceValue.waitFor({ state: "visible", timeout: 20_000 });
    const visibleLabel = sourceValue.locator("[data-commercial-source-label]");
    const technicalDetails = sourceValue.locator("details code");
    const markerRunId = expectedMarker.replace(/^QA local synthetic — not production · run /, "");
    checks[key] =
      (await sourceValue.isVisible()) &&
      (await visibleLabel.textContent())?.trim() === "Dados sintéticos de homologação" &&
      (await technicalDetails.textContent())?.trim() === `Execução: ${markerRunId}`;
  }
  return checks;
}

async function checkZoom(origin, email, password, browser, httpCredentials) {
  const checks = [];
  for (const level of zoomLevels) {
    const context = await browser.newContext({
      viewport: { width: level.width, height: level.height },
      deviceScaleFactor: level.deviceScaleFactor,
      reducedMotion: "reduce",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      httpCredentials,
    });
    await hideHomologationBannerForBaseline(context);
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
        checks.push({
          zoomPercent: level.percent,
          viewport: `zoom-${level.percent}`,
          ...(await inspectRoute(page, origin, route, "light", consoleErrors, pageErrors)),
        });
      }
    } finally {
      await context.close();
    }
  }
  return {
    method: "CSS viewport equivalents with deviceScaleFactor on a 1440×900 physical canvas",
    levels: zoomLevels,
    routes: checks,
    passed: checks.every((check) => check.passed),
  };
}

async function captureHomologationCheckpoints(browser, origin, email, password, httpCredentials) {
  if (!remoteHomologation) return [];
  const checkpoints = [];
  for (const viewport of [viewports[0], viewports.at(-1)]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      httpCredentials,
    });
    try {
      const page = await context.newPage();
      await login(page, origin, email, password);
      const banner = page.getByText("HOMOLOGAÇÃO — DADOS SINTÉTICOS", { exact: true });
      await banner.waitFor({ state: "visible", timeout: 20_000 });
      const destination = path.join(
        artifactRoot,
        `homologation-dashboard-${viewport.width}x${viewport.height}.webp`,
      );
      const buffer = await capturePersistedScreenshot(page);
      checkpoints.push({
        viewport: viewport.key,
        bannerVisible: await banner.isVisible(),
        ...(await saveLosslessWebp(buffer, destination)),
      });
    } finally {
      await context.close();
    }
  }
  return checkpoints;
}

function functionalChecksPassed({
  routeChecks,
  themeChecks,
  accessibilityChecks,
  screenshots,
  keyboard,
  simulatorValidation,
  fixtureSourceMarker,
  zoom,
}) {
  return (
    routeChecks.length === routes.length * viewports.length &&
    routeChecks.every((check) => check.passed) &&
    themeChecks.length === routes.length * (themes.length + 1) &&
    themeChecks.every((check) => check.passed) &&
    accessibilityChecks.length ===
      routes.length * viewports.length +
        desktopThemeCaptureRoutes.size * themes.length +
        routes.length &&
    accessibilityChecks.every((check) => check.passed) &&
    screenshots.length ===
      routes.length * viewports.length +
        desktopThemeCaptureRoutes.size * themes.length +
        routes.length &&
    keyboard &&
    Object.values(keyboard).every(Boolean) &&
    simulatorValidation &&
    Object.values(simulatorValidation).every(Boolean) &&
    fixtureSourceMarker &&
    Object.values(fixtureSourceMarker).every(Boolean) &&
    zoom.routes.length === routes.length * zoomLevels.length &&
    zoom.passed
  );
}

function createPromotedResult(candidateResult) {
  const screenshots = candidateResult.screenshots.map((screenshot) => {
    const baselinePath = screenshot.visualComparison.baselineUsed.path;
    const absoluteBaselinePath = path.join(repositoryRoot, baselinePath);
    const baselineChanged = !screenshot.visualComparison.passed;
    const promotedBytes = baselineChanged
      ? screenshot.bytes
      : screenshot.visualComparison.baselineUsed.bytes;
    const promotedSha256 = baselineChanged
      ? screenshot.sha256
      : screenshot.visualComparison.baselineUsed.sha256;
    return {
      ...screenshot,
      path: relativeTo(outputRoot, absoluteBaselinePath),
      bytes: promotedBytes,
      sha256: promotedSha256,
      previousBaselineComparison: screenshot.visualComparison,
      visualComparison: {
        passed: true,
        reason: baselineChanged ? "baseline_updated" : "baseline_preserved",
        changedPixels: 0,
        totalPixels: screenshot.width * screenshot.height,
        changedPixelRatio: 0,
        baselineUsed: {
          path: baselinePath,
          tracked: true,
          bytes: promotedBytes,
          sha256: promotedSha256,
        },
      },
    };
  });
  const promoted = {
    ...candidateResult,
    mode: "update-baseline",
    artifacts: {
      baselineScreenshots: repositoryRelative(baselineScreenshotRoot),
      baselineResult: repositoryRelative(baselineResultsPath),
      candidateDiagnostics: repositoryRelative(artifactRoot),
    },
    screenshots,
    baselineUsed: summarizeBaselineUsage(screenshots, {
      tracked: true,
      digest: null,
    }),
    baselinePromotion: {
      requested: true,
      performed: true,
      method: "same-filesystem transactional rename with rollback",
      previousBaselineManifestSha256: candidateResult.baselineUsed.manifestSha256,
      previousBaselineResultSha256: candidateResult.baselineUsed.result.sha256,
    },
    passed: true,
  };
  return promoted;
}

async function promoteBaseline(candidateResult) {
  const promotionRoot = path.join(outputRoot, `.authenticated-visual-promotion-${process.pid}`);
  const stagedScreenshots = path.join(promotionRoot, "target-authenticated.next");
  const stagedCanaryScreenshots = path.join(promotionRoot, "target-authenticated-canary.next");
  const stagedResult = path.join(promotionRoot, "authenticated-results.next.json");
  const backupScreenshots = path.join(promotionRoot, "target-authenticated.previous");
  const backupCanaryScreenshots = path.join(promotionRoot, "target-authenticated-canary.previous");
  const backupResult = path.join(promotionRoot, "authenticated-results.previous.json");
  const promotedResult = createPromotedResult(candidateResult);
  const promoteCanonicalResult = simulatorHubCanaryKey === undefined;
  let baselineMoved = false;
  let canaryBaselineMoved = false;
  let resultMoved = false;
  let screenshotsInstalled = false;
  let canaryScreenshotsInstalled = false;
  let resultInstalled = false;

  await rm(promotionRoot, { recursive: true, force: true });
  await mkdir(promotionRoot, { recursive: true });
  await cp(baselineScreenshotRoot, stagedScreenshots, { recursive: true });
  await cp(simulatorCanaryBaselineRoot, stagedCanaryScreenshots, { recursive: true });
  for (const screenshot of candidateResult.screenshots) {
    if (screenshot.visualComparison.passed) continue;
    const relativeCandidatePath = screenshot.path.replace(/^candidate\//, "");
    const baselinePath = path.join(repositoryRoot, screenshot.visualComparison.baselineUsed.path);
    const canonicalRelativePath = path.relative(baselineScreenshotRoot, baselinePath);
    const canaryRelativePath = path.relative(simulatorCanaryBaselineRoot, baselinePath);
    const isInside = (relativePath) =>
      relativePath !== "" &&
      !relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath);
    const destination = isInside(canonicalRelativePath)
      ? path.join(stagedScreenshots, canonicalRelativePath)
      : isInside(canaryRelativePath)
        ? path.join(stagedCanaryScreenshots, canaryRelativePath)
        : null;
    if (!destination) {
      throw new Error("Baseline promotion target is outside approved visual roots.");
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(candidateScreenshotRoot, relativeCandidatePath), destination);
  }
  if (promoteCanonicalResult) await writeJsonAtomically(stagedResult, promotedResult);

  try {
    await rename(baselineScreenshotRoot, backupScreenshots);
    baselineMoved = true;
    await rename(simulatorCanaryBaselineRoot, backupCanaryScreenshots);
    canaryBaselineMoved = true;
    if (promoteCanonicalResult) {
      await rename(baselineResultsPath, backupResult);
      resultMoved = true;
    }
    await rename(stagedScreenshots, baselineScreenshotRoot);
    screenshotsInstalled = true;
    await rename(stagedCanaryScreenshots, simulatorCanaryBaselineRoot);
    canaryScreenshotsInstalled = true;
    if (promoteCanonicalResult) {
      await rename(stagedResult, baselineResultsPath);
      resultInstalled = true;
    }
  } catch {
    if (resultInstalled) await rm(baselineResultsPath, { force: true });
    if (canaryScreenshotsInstalled)
      await rm(simulatorCanaryBaselineRoot, { recursive: true, force: true });
    if (screenshotsInstalled) await rm(baselineScreenshotRoot, { recursive: true, force: true });
    if (resultMoved) await rename(backupResult, baselineResultsPath);
    if (canaryBaselineMoved) await rename(backupCanaryScreenshots, simulatorCanaryBaselineRoot);
    if (baselineMoved) await rename(backupScreenshots, baselineScreenshotRoot);
    throw new Error("Baseline promotion failed and was rolled back.");
  } finally {
    await rm(promotionRoot, { recursive: true, force: true });
  }

  return promotedResult;
}

async function run() {
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(candidateScreenshotRoot, { recursive: true });
  const baselineCommittedAtStart = baselineMatchesHead();
  const trackedFiles = trackedRepositoryFiles();
  const baselineResultsTracked = trackedFiles.has(repositoryRelative(baselineResultsPath));
  const baselineResultsDigest = await sha256File(baselineResultsPath);
  let candidateResultWritten = false;
  await writeJsonAtomically(candidateResultsPath, {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    ...getCaptureProvenance(),
    mode,
    environment: environmentLabel,
    account: accountLabel,
    data: "synthetic local-only fixtures; never production runtime",
    credentialsPersisted: false,
    storageStatePersisted: false,
    identityEvidencePolicy,
    artifacts: {
      baselineScreenshots: repositoryRelative(baselineScreenshotRoot),
      baselineResult: repositoryRelative(baselineResultsPath),
      candidateScreenshots: repositoryRelative(candidateScreenshotRoot),
      candidateResult: repositoryRelative(candidateResultsPath),
    },
    baselinePromotion: {
      requested: mode === "update-baseline",
      performed: false,
      eligible: false,
    },
    baselineIntegrity: {
      committedAtStart: baselineCommittedAtStart,
      unchangedDuringCapture: null,
    },
    failure: { stage: "initializing", kind: "sanitized" },
    passed: false,
  });
  if (!baselineCommittedAtStart) {
    throw new Error("Authenticated visual baseline must match HEAD before verification.");
  }
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
  const origin = parseQaOrigin(requiredEnvironment("QA_AUTH_ORIGIN"));
  if (remoteHomologation && mode !== "verify") {
    throw new Error("Remote homologation may verify baselines but cannot update them.");
  }
  const httpCredentials = homologationHttpCredentials(origin);
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
  const accessibilityChecks = [];
  const screenshots = [];
  let keyboard = null;
  let simulatorValidation = null;
  let fixtureSourceMarker = null;
  let homologationCheckpoints = [];
  let currentStage = "homologation-checkpoints";

  try {
    homologationCheckpoints = await captureHomologationCheckpoints(
      browser,
      origin,
      email,
      password,
      httpCredentials,
    );
    for (const viewport of viewports) {
      currentStage = `responsive:${viewport.key}`;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
        httpCredentials,
      });
      await hideHomologationBannerForBaseline(context);
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
          currentStage = `responsive:${viewport.key}:${route}`;
          const check = await inspectRoute(page, origin, route, "light", consoleErrors, pageErrors);
          routeChecks.push({ viewport: viewport.key, ...check });
          accessibilityChecks.push(await inspectAccessibility(page, route, viewport.key, "light"));

          const buffer = await captureComparableScreenshot(page);
          const persistedBuffer = await capturePersistedScreenshot(page, buffer);
          const destination = path.join(
            candidateScreenshotRoot,
            `${routeKey(route)}-${viewport.width}x${viewport.height}.webp`,
          );
          screenshots.push({
            kind: "responsive",
            route,
            viewport: viewport.key,
            theme: "light",
            visualComparison: await compareVisualBaseline(
              buffer,
              visualBaselinePath(route, destination),
              trackedFiles,
            ),
            ...(await saveLosslessWebp(persistedBuffer, destination)),
          });
        }

        if (viewport.key === "desktop-1440x900") {
          for (const theme of themes) {
            currentStage = `theme:${theme}`;
            await page.goto(`${origin}/app`, { waitUntil: "domcontentloaded" });
            await setTheme(page, theme);
            for (const route of routes) {
              currentStage = `theme:${theme}:${route}`;
              const check = await inspectRoute(
                page,
                origin,
                route,
                theme,
                consoleErrors,
                pageErrors,
              );
              themeChecks.push({
                matrix: "desktop-themes",
                viewport: viewport.key,
                theme,
                ...check,
              });
              if (desktopThemeCaptureRoutes.has(route)) {
                accessibilityChecks.push(
                  await inspectAccessibility(page, route, viewport.key, theme),
                );
                const buffer = await captureComparableScreenshot(page);
                const persistedBuffer = await capturePersistedScreenshot(page, buffer);
                const destination = path.join(
                  candidateScreenshotRoot,
                  "themes",
                  `${routeKey(route)}-${theme}-${viewport.width}x${viewport.height}.webp`,
                );
                screenshots.push({
                  kind: "theme",
                  route,
                  viewport: viewport.key,
                  theme,
                  visualComparison: await compareVisualBaseline(
                    buffer,
                    visualBaselinePath(route, destination),
                    trackedFiles,
                  ),
                  ...(await saveLosslessWebp(persistedBuffer, destination)),
                });
              }
            }
          }
          currentStage = "keyboard";
          keyboard = await checkKeyboard(page, origin);
          currentStage = "simulator-validation";
          simulatorValidation = await checkSimulatorValidation(page, origin);
          currentStage = "fixture-source-marker";
          fixtureSourceMarker = await checkFixtureSourceMarker(page, origin, expectedSourceMarker);
        }

        if (viewport.key === mobileDarkViewportKey) {
          currentStage = `mobile-dark:${viewport.key}`;
          await page.goto(`${origin}/app`, { waitUntil: "domcontentloaded" });
          await setTheme(page, "dark");
          for (const route of routes) {
            currentStage = `mobile-dark:${viewport.key}:${route}`;
            const check = await inspectRoute(
              page,
              origin,
              route,
              "dark",
              consoleErrors,
              pageErrors,
            );
            themeChecks.push({
              matrix: "mobile-dark",
              viewport: viewport.key,
              theme: "dark",
              ...check,
            });
            accessibilityChecks.push(await inspectAccessibility(page, route, viewport.key, "dark"));
            const buffer = await captureComparableScreenshot(page);
            const persistedBuffer = await capturePersistedScreenshot(page, buffer);
            const destination = path.join(
              candidateScreenshotRoot,
              "themes",
              "mobile-dark",
              `${routeKey(route)}-dark-${viewport.width}x${viewport.height}.webp`,
            );
            screenshots.push({
              kind: "mobile-dark",
              route,
              viewport: viewport.key,
              theme: "dark",
              visualComparison: await compareVisualBaseline(
                buffer,
                visualBaselinePath(route, destination),
                trackedFiles,
              ),
              ...(await saveLosslessWebp(persistedBuffer, destination)),
            });
          }
        }
      } finally {
        await context.close();
      }
    }

    currentStage = "zoom";
    const zoom = await checkZoom(origin, email, password, browser, httpCredentials);
    const functionalPassed = functionalChecksPassed({
      routeChecks,
      themeChecks,
      accessibilityChecks,
      screenshots,
      keyboard,
      simulatorValidation,
      fixtureSourceMarker,
      zoom,
    });
    const visualComparisonsPassed = screenshots.every(
      (screenshot) => screenshot.visualComparison.passed,
    );
    const baselineUsed = summarizeBaselineUsage(screenshots, {
      tracked: baselineResultsTracked,
      digest: baselineResultsDigest,
    });
    const baselineUnchangedDuringCapture = await baselineUsageIsUnchanged(baselineUsed);
    const result = {
      schemaVersion: 2,
      capturedAt: new Date().toISOString(),
      ...getCaptureProvenance(),
      mode,
      environment: environmentLabel,
      account: accountLabel,
      identityVerification,
      fixtureVerification: {
        contract: fixtureVerification,
        assertion: "synthetic marker and exact fixture counts verified through authenticated RLS",
        sourceMarkerPolicy: "QA local synthetic — not production · run <ephemeral-id>",
        sourceMarkerVisible: fixtureSourceMarker,
      },
      data: "synthetic local-only fixtures; never production runtime",
      credentialsPersisted: false,
      storageStatePersisted: false,
      identityEvidencePolicy,
      artifacts: {
        baselineScreenshots: repositoryRelative(baselineScreenshotRoot),
        baselineResult: repositoryRelative(baselineResultsPath),
        candidateScreenshots: repositoryRelative(candidateScreenshotRoot),
        candidateResult: repositoryRelative(candidateResultsPath),
      },
      viewports,
      routeChecks,
      themeChecks,
      accessibilityChecks,
      keyboard,
      simulatorValidation,
      homologationCheckpoints,
      zoom,
      screenshots,
      baselineUsed,
      baselineIntegrity: {
        trackedFilesRequired: true,
        committedAtStart: baselineCommittedAtStart,
        unchangedDuringCapture: baselineUnchangedDuringCapture,
      },
      baselinePromotion: {
        requested: mode === "update-baseline",
        performed: false,
        eligible: mode === "update-baseline" && functionalPassed,
      },
      visualInspectionCoverage: {
        responsiveScreenshots: routes.length * viewports.length,
        themeScreenshots: desktopThemeCaptureRoutes.size * themes.length + routes.length,
        accessibilityAudits: accessibilityChecks.length,
        baselineComparisons: screenshots.length,
        changedPixelRatioThreshold: visualDifferenceThreshold,
        channelTolerance: visualChannelTolerance,
      },
    };
    result.passed =
      functionalPassed &&
      baselineUnchangedDuringCapture &&
      (mode === "update-baseline" || visualComparisonsPassed);

    await writeJsonAtomically(candidateResultsPath, result);
    candidateResultWritten = true;

    if (!result.passed) {
      throw new Error("Authenticated visual QA failed. Inspect candidate diagnostics.");
    }
    if (mode === "update-baseline") {
      await promoteBaseline(result);
      result.baselinePromotion = {
        requested: true,
        performed: true,
        eligible: true,
        method: "same-filesystem transactional rename with rollback",
      };
      await writeJsonAtomically(candidateResultsPath, result);
    }
    process.stdout.write(
      `Authenticated QA passed in ${mode} mode: ${routeChecks.length} responsive, ${themeChecks.length} theme, ${accessibilityChecks.length} accessibility, ${screenshots.length} candidate/baseline comparisons and ${zoom.routes.length} zoom route checks.\n`,
    );
  } catch {
    if (!candidateResultWritten) {
      await writeJsonAtomically(candidateResultsPath, {
        schemaVersion: 2,
        capturedAt: new Date().toISOString(),
        ...getCaptureProvenance(),
        mode,
        environment: environmentLabel,
        account: accountLabel,
        data: "synthetic local-only fixtures; never production runtime",
        credentialsPersisted: false,
        storageStatePersisted: false,
        identityEvidencePolicy,
        artifacts: {
          baselineScreenshots: repositoryRelative(baselineScreenshotRoot),
          baselineResult: repositoryRelative(baselineResultsPath),
          candidateScreenshots: repositoryRelative(candidateScreenshotRoot),
          candidateResult: repositoryRelative(candidateResultsPath),
        },
        baselineUsed: {
          root: repositoryRelative(baselineScreenshotRoot),
          result: {
            path: repositoryRelative(baselineResultsPath),
            tracked: baselineResultsTracked,
            bytes: baselineResultsDigest?.bytes ?? null,
            sha256: baselineResultsDigest?.sha256 ?? null,
          },
          files: [],
          fileCount: 0,
          manifestSha256: null,
        },
        baselinePromotion: {
          requested: mode === "update-baseline",
          performed: false,
          eligible: false,
        },
        baselineIntegrity: {
          committedAtStart: baselineCommittedAtStart,
          unchangedDuringCapture: null,
        },
        failure: { stage: currentStage, kind: "sanitized" },
        passed: false,
      });
    }
    throw new Error("Authenticated visual QA failed. Inspect candidate diagnostics.");
  } finally {
    await browser.close();
  }
}

await run();
