import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import sharp from "sharp";

import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";

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
const qaNavigationTimeout = remoteHomologation ? 30_000 : 180_000;
const qaRouteBootstrapTimeout = remoteHomologation ? 30_000 : 90_000;
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
const directTableInventoryEvidencePolicy = Object.freeze({
  persistedVisualCaptures: "deterministic synthetic inventory only",
  functionalValidation: remoteHomologation
    ? "protected homologation snapshot without persisted commercial fields"
    : "deterministic synthetic local runtime",
});
const inventoryRoutePattern = "**/api/inventory*";
const syntheticDirectTableSnapshot = (() => {
  const contents = buildSyntheticDirectTableQaSnapshot();
  return JSON.stringify({
    ...JSON.parse(contents),
    sourceKind: "versioned-snapshot",
    snapshotReferenceDate: "2026-09-05",
    snapshotSha256: createHash("sha256").update(contents).digest("hex"),
  });
})();

function configureQaPage(page) {
  page.setDefaultTimeout(qaNavigationTimeout);
  page.setDefaultNavigationTimeout(qaNavigationTimeout);
  return page;
}

function parseMode(argv) {
  if (argv.length === 0) return "verify";
  if (argv.length === 1 && argv[0] === "--update-baseline") return "update-baseline";
  throw new Error("Authenticated visual QA accepts only the optional --update-baseline flag.");
}

const mode = parseMode(process.argv.slice(2));

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
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
  "/admin",
  "/admin/usuarios",
  "/admin/paginas",
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
const archiveSimulatorRoutes = new Set([
  "/app/simulacao/associativo-fluxo-linear",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
]);

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
  { key: "mobile-375x812", width: 375, height: 812 },
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
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
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

async function installSyntheticInventoryForVisualCapture(context, origin) {
  let installed = true;
  const handler = async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (
      request.method() !== "GET" ||
      requestUrl.origin !== origin ||
      !["/api/inventory", "/api/inventory/snapshot"].includes(requestUrl.pathname)
    ) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: { "cache-control": "no-store" },
      body: syntheticDirectTableSnapshot,
    });
  };

  await context.route(inventoryRoutePattern, handler);
  return async () => {
    if (!installed) return;
    installed = false;
    await context.unroute(inventoryRoutePattern, handler);
  };
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
  let response = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: publishableKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) break;
    await response.arrayBuffer();
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1_000));
    }
  }
  if (!response?.ok) {
    throw new Error("Dedicated QA identity was not verified on local Supabase.");
  }
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
  const fullPage = !archiveSimulatorRoutes.has(new URL(page.url()).pathname);
  const volatileRegions = page.locator("[data-qa-visual-volatile]:not([hidden])");
  await volatileRegions.evaluateAll((elements) => {
    for (const element of elements) {
      element.setAttribute("data-qa-visual-hidden", "true");
      element.setAttribute("hidden", "");
    }
  });
  try {
    return await page.screenshot({
      fullPage,
      animations: "disabled",
      timeout: qaNavigationTimeout,
    });
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
    const fullPage = !archiveSimulatorRoutes.has(new URL(page.url()).pathname);
    return (
      comparableBuffer ??
      (await page.screenshot({
        fullPage,
        animations: "disabled",
        timeout: qaNavigationTimeout,
      }))
    );
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
    const fullPage = !archiveSimulatorRoutes.has(new URL(page.url()).pathname);
    return await page.screenshot({
      fullPage,
      animations: "disabled",
      timeout: qaNavigationTimeout,
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
  const archiveInventoryRows = archiveSimulatorRoutes.has(route)
    ? page.locator(".investor-stock-table tbody tr:nth-child(n+51)")
    : null;
  if (archiveInventoryRows) {
    await archiveInventoryRows.evaluateAll((rows) => {
      for (const row of rows) {
        row.setAttribute("data-qa-axe-sampled", "true");
        row.setAttribute("hidden", "");
      }
    });
  }

  let analysis;
  try {
    // Repeated stock rows share one semantic template. Sampling keeps Axe from
    // exhausting Chromium while data tests still validate the complete snapshot.
    analysis = await new AxeBuilder({ page }).withTags(accessibilityTags).analyze();
  } finally {
    if (archiveInventoryRows) {
      await page.locator('[data-qa-axe-sampled="true"]').evaluateAll((rows) => {
        for (const row of rows) {
          row.removeAttribute("hidden");
          row.removeAttribute("data-qa-axe-sampled");
        }
      });
    }
  }
  const violations = analysis.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    affectedNodes: violation.nodes.length,
    targets: violation.nodes.map((node) => node.target),
    helpUrl: violation.helpUrl,
  }));
  const acceptedViolationIds = new Set();
  const blockingViolations = violations.filter(
    (violation) => !acceptedViolationIds.has(violation.id),
  );
  return {
    route,
    viewport,
    theme,
    violations,
    acceptedViolations: violations.filter((violation) => acceptedViolationIds.has(violation.id)),
    blockingViolations,
    passed: blockingViolations.length === 0,
  };
}

async function releaseRenderedRoute(page) {
  // Axe and full-page captures allocate large renderer-side trees. Releasing
  // each document prevents Chromium accumulation across the 300+ route passes.
  await page.goto("about:blank", { waitUntil: "commit" });
}

async function gotoWithServerRetry(page, destination, options) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(destination, options);
      if ((response?.status() ?? 200) < 500) return response;
      lastError = new Error("Authenticated route returned a transient server error.");
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await page.waitForTimeout((attempt + 1) * 1_000);
  }
  throw lastError ?? new Error("Authenticated route navigation failed.");
}

async function openInspectableRoute(page, destination, expectedTheme, consoleErrors, pageErrors) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const consoleAttemptStart = consoleErrors.length;
    const pageAttemptStart = pageErrors.length;
    try {
      const response = await page.goto(destination, { waitUntil: "commit" });
      await page
        .locator("h1")
        .first()
        .waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        expectedTheme,
        { timeout: qaRouteBootstrapTimeout },
      );
      if ((response?.status() ?? 200) >= 500) {
        throw new Error("Authenticated route returned a transient server error.");
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        consoleErrors.length = consoleAttemptStart;
        pageErrors.length = pageAttemptStart;
        await page.waitForTimeout((attempt + 1) * 1_000);
      }
    }
  }
  throw lastError ?? new Error("Authenticated route did not become inspectable.");
}

async function login(page, origin, email, password) {
  await gotoWithServerRetry(page, `${origin}/login`, { waitUntil: "domcontentloaded" });
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
      timeout: qaNavigationTimeout,
    }),
    page.getByRole("button", { name: "Entrar", exact: true }).click(),
  ]);
}

async function inspectRoute(
  page,
  origin,
  route,
  expectedTheme,
  consoleErrors,
  pageErrors,
  { waitForArchiveInventory = true } = {},
) {
  const consoleStart = consoleErrors.length;
  const pageErrorStart = pageErrors.length;
  const response = await openInspectableRoute(
    page,
    `${origin}${route}`,
    expectedTheme,
    consoleErrors,
    pageErrors,
  );
  await page.evaluate(() => document.fonts.ready);

  const isArchiveSimulator = archiveSimulatorRoutes.has(route);
  if (isArchiveSimulator && waitForArchiveInventory) {
    await page.locator(".investor-stock-table tbody tr.selectable").first().waitFor({
      state: "visible",
      timeout: 25_000,
    });
  }
  const isSimulatorWorkspace = route.startsWith("/app/simulacao/") && !isArchiveSimulator;
  const expectsEnabledSimulatorAction = enabledSimulatorRoutes.has(route);
  const snapshot = await page.evaluate((simulatorWorkspace) => {
    const text = document.body.innerText;
    const root = document.documentElement;
    const simulatorForm = simulatorWorkspace ? document.querySelector("main form") : null;
    const archiveSimulator = [
      "/app/simulacao/associativo-fluxo-linear",
      "/app/simulacao/tabela-direta",
      "/app/simulacao/tabela-investidor",
    ].includes(window.location.pathname);
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
        !simulatorWorkspace ||
        (archiveSimulator && Boolean(blockedAction?.disabled)) ||
        text.includes("Cálculo temporariamente indisponível — regra aguardando validação"),
      blockedActionDistinct:
        !simulatorWorkspace ||
        (archiveSimulator
          ? Boolean(blockedAction?.disabled) && blockedStyle?.cursor === "not-allowed"
          : Boolean(blockedAction?.querySelector("svg")) &&
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
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page
        .getByRole("button", { name: themeLabels[theme], exact: true })
        .click({ timeout: qaRouteBootstrapTimeout });
      await page.waitForFunction(
        (expected) => document.documentElement.dataset.theme === expected,
        theme,
        { timeout: qaRouteBootstrapTimeout },
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await page.waitForTimeout((attempt + 1) * 1_000);
        await gotoWithServerRetry(page, page.url(), { waitUntil: "domcontentloaded" });
      }
    }
  }
  throw lastError ?? new Error("Theme control did not become available.");
}

async function checkKeyboard(page, origin) {
  await gotoWithServerRetry(page, `${origin}/app`, { waitUntil: "domcontentloaded" });
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

async function checkSimulatorValidation(page, origin, httpCredentials) {
  await gotoWithServerRetry(page, `${origin}/app/simulacao/associativo-fluxo-linear`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Simulador Tabela Associativo", exact: true })
    .waitFor({ state: "visible" });
  await page.locator(".investor-stock-table tbody tr.selectable").first().waitFor({
    state: "visible",
  });
  const initialChecks = await page.evaluate(() => {
    const filters = [...document.querySelectorAll(".investor-stock-filters select")];
    const selectedUnit = document.querySelector('.investor-stock-unit-button[aria-pressed="true"]');
    return {
      associativeTableTitlePresent:
        document.querySelector("h1")?.textContent === "Simulador Tabela Associativo",
      stockPanelPresent: Boolean(document.querySelector("#investor-stock-title")),
      stockRowsPresent:
        document.querySelectorAll(".investor-stock-table tbody tr.selectable").length > 0,
      fiveStockFiltersPresent: filters.length === 6,
      manualSelectionRequired: !selectedUnit,
      guidePresent: Boolean(
        [...document.querySelectorAll("button")].find((button) =>
          button.textContent?.includes("Iniciar passo a passo"),
        ),
      ),
    };
  });

  // Use a project present in both the protected reference snapshot and the
  // live feed so the flow remains deterministic while the background refresh
  // resolves. Its units are still in construction and exercise the full plan.
  await page
    .getByRole("combobox", { name: "Nome do Empreendimento", exact: true })
    .selectOption("Estilo Lapa");
  await page.locator(".investor-stock-table tbody tr.selectable").first().waitFor({
    state: "visible",
  });
  await page.locator(".investor-stock-table tbody tr.selectable").first().click();
  await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).fill("500000");
  await page.getByRole("radio", { name: "Sim", exact: true }).check();

  const financingInput = page.getByRole("textbox", { name: "Financiamento", exact: true });
  await financingInput.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Financiamento",
  );

  const optionalPaymentButtons = ["Inserir Sinal", "Inserir Anual", "Inserir Desconto"];
  const optionalPaymentsUnlockedAfterProfile = (
    await Promise.all(
      optionalPaymentButtons.map(async (name) => {
        const button = page.getByRole("button", { name, exact: true });
        return (await button.isEnabled()) && (await button.isVisible());
      }),
    )
  ).every(Boolean);
  const financingFocusedAfterProfile = await financingInput.evaluate(
    (input) => document.activeElement === input,
  );

  await financingInput.fill("19000000");
  const subsidyInput = page.getByRole("textbox", { name: "Subsídio", exact: true });
  await subsidyInput.waitFor({ state: "visible" });
  await subsidyInput.fill("0");
  const fgtsInput = page.getByRole("textbox", { name: "FGTS", exact: true });
  await fgtsInput.waitFor({ state: "visible" });
  await fgtsInput.fill("0");
  const housingCheckInput = page.getByRole("textbox", { name: "Cheque Moradia", exact: true });
  await housingCheckInput.waitFor({ state: "visible" });
  await housingCheckInput.fill("0");
  const entryInput = page.getByRole("textbox", { name: "Entrada", exact: true });
  await entryInput.waitFor({ state: "visible" });
  await entryInput.fill("100000");
  const installmentsInput = page.locator('input[name="quantidade-de-parcelas"]');
  await installmentsInput.waitFor({ state: "visible" });
  await installmentsInput.fill("84");
  const rankingSelect = page.getByRole("combobox", { name: "Selecione o Ranking", exact: true });
  await rankingSelect.waitFor({ state: "visible" });
  await rankingSelect.selectOption("diamond");

  const readyProposalButton = page.getByRole("button", {
    name: "Proposta pronta - Bora Vender",
    exact: true,
  });
  await readyProposalButton.waitFor({ state: "visible" });
  const readyProposalButtonEnabled = await readyProposalButton.isEnabled();
  const readyProposalButtonPlacedAfterInstallments = await page.evaluate(() => {
    const installmentsButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Exibir parcelas",
    );
    const proposalButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Proposta pronta - Bora Vender",
    );
    if (!installmentsButton || !proposalButton) return false;
    const installmentsBox = installmentsButton.getBoundingClientRect();
    const proposalBox = proposalButton.getBoundingClientRect();
    return (
      proposalButton.previousElementSibling === installmentsButton &&
      proposalBox.left >= installmentsBox.right
    );
  });
  const releaseStatusUsesSingleDesktopRow = await page
    .locator(".investor-associative-release-status")
    .evaluate((element) => {
      const identity = element.querySelector(".investor-associative-release-status-identity");
      const reason = element.querySelector(":scope > p");
      if (!identity || !reason) return false;
      const identityBox = identity.getBoundingClientRect();
      const reasonBox = reason.getBoundingClientRect();
      return (
        reason.previousElementSibling === identity &&
        Math.abs(
          (identityBox.top + identityBox.bottom) / 2 - (reasonBox.top + reasonBox.bottom) / 2,
        ) < 2
      );
    });

  await readyProposalButton.click();
  const readyProposalDialog = page.getByRole("dialog", {
    name: "Proposta pronta - Bora Vender",
    exact: true,
  });
  const readyProposalDialogElement = page.locator("#investor-associative-ready-proposal");
  await readyProposalDialog.waitFor({ state: "visible" });
  const proposalAppraisalInput = readyProposalDialog.getByRole("textbox", {
    name: "Avaliação bancária da proposta",
    exact: true,
  });
  await proposalAppraisalInput.fill("35000000");
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-associative-ready-proposal")
      ?.textContent?.includes("PROPOSTA PRONTA"),
  );
  const readyProposalAppraisalEditable =
    (await proposalAppraisalInput.inputValue()) === "350.000,00";
  const readyProposalDialogComplete = await readyProposalDialog.evaluate((dialog) => {
    const expectedLabels = [
      "Desconto",
      "Valor de Contrato",
      "B.A. da Unidade",
      "Financiamento",
      "Sinal CC",
      "Qtd. de parcelas",
    ];
    const table = dialog.querySelector(".investor-associative-ready-proposal-sheet table");
    const labels = [...(table?.querySelectorAll("th[scope='row']") ?? [])].map((cell) =>
      cell.textContent?.trim(),
    );
    const valueFor = (label) => {
      const row = [...(table?.querySelectorAll("tr") ?? [])].find(
        (candidate) => candidate.querySelector("th")?.textContent?.trim() === label,
      );
      return row?.querySelector(".investor-associative-ready-proposal-value")?.textContent?.trim();
    };
    return (
      JSON.stringify(labels) === JSON.stringify(expectedLabels) &&
      valueFor("Sinal CC") === "1.000,00" &&
      [
        "FGTS",
        "Cheque Moradia",
        "Sinal 1",
        "Sinal 2",
        "Sinal 3",
        "Anual 1",
        "Anual 2",
        "Anual 3",
        "Anual 4",
      ].every((label) => valueFor(label) === undefined) &&
      valueFor("Qtd. de parcelas") === "84" &&
      !(dialog.textContent || "").includes("Contrato e conferência")
    );
  });
  const readyProposalDesktopFits = await readyProposalDialog.evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    return (
      rect.left >= 0 &&
      rect.right <= window.innerWidth &&
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight
    );
  });
  const firstReadyProposalHelp = readyProposalDialog.getByRole("button", {
    name: "Explicar Desconto",
    exact: true,
  });
  await firstReadyProposalHelp.click();
  const readyProposalHelpPopover = readyProposalDialog.locator(
    "#investor-associative-ready-proposal-help-discount:popover-open",
  );
  const readyProposalHelpAccessible = await readyProposalHelpPopover.isVisible();
  await page.keyboard.press("Escape");
  await readyProposalHelpPopover.waitFor({ state: "hidden" });
  await readyProposalDialog
    .getByRole("button", { name: "Fechar proposta pronta", exact: true })
    .click();
  await readyProposalDialogElement.waitFor({ state: "hidden" });

  const readyProposalResponsiveChecks = [];
  await readyProposalDialogElement.evaluate((dialog) => dialog.showModal());
  await readyProposalDialogElement.waitFor({ state: "visible" });
  const readyProposalSnapshot = await readyProposalDialogElement.evaluate((dialog) => ({
    dialogHtml: dialog.outerHTML,
    stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href),
    htmlTheme: document.documentElement.getAttribute("data-theme"),
  }));
  const readyProposalViewports = [
    { key: "desktop-1440x900", width: 1440, height: 900 },
    { key: "tablet-1024x768", width: 1024, height: 768 },
    { key: "tablet-768x1024", width: 768, height: 1024 },
    { key: "mobile-375x812", width: 375, height: 812 },
  ];
  const stylesheets = readyProposalSnapshot.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");
  const themeAttribute = readyProposalSnapshot.htmlTheme
    ? ` data-theme="${readyProposalSnapshot.htmlTheme}"`
    : "";
  await readyProposalDialogElement.evaluate((dialog) => dialog.close());
  await readyProposalDialogElement.waitFor({ state: "hidden" });

  const snapshotBrowser = page.context().browser();
  if (!snapshotBrowser) throw new Error("Ready proposal snapshot browser is unavailable.");
  for (const viewport of readyProposalViewports) {
    const snapshotContext = await snapshotBrowser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      httpCredentials,
    });
    try {
      const snapshotPage = configureQaPage(await snapshotContext.newPage());
      await snapshotPage.setContent(
        `<!doctype html><html${themeAttribute}><head><base href="${origin}/">${stylesheets}</head><body><div class="investor-page-shell">${readyProposalSnapshot.dialogHtml}</div></body></html>`,
        { waitUntil: "networkidle" },
      );
      await snapshotPage.locator("dialog").evaluate((dialog) => {
        dialog.removeAttribute("open");
        dialog.showModal();
      });
      await snapshotPage.evaluate(() => document.fonts.ready);
      await snapshotPage.locator("dialog").evaluate((dialog) => {
        dialog.scrollTop = 0;
        const tableRegion = dialog.querySelector(".investor-associative-ready-proposal-table-wrap");
        if (tableRegion) tableRegion.scrollTop = 0;
      });
      readyProposalResponsiveChecks.push(
        await snapshotPage.locator("dialog").evaluate((dialog) => {
          const dialogBox = dialog.getBoundingClientRect();
          const tableRegion = dialog.querySelector(
            ".investor-associative-ready-proposal-table-wrap",
          );
          const rowLabels = [
            ...dialog.querySelectorAll(".investor-associative-ready-proposal-sheet th"),
          ];
          const rows = [
            ...dialog.querySelectorAll(".investor-associative-ready-proposal-sheet tbody tr"),
          ];
          const usesCompactDesktopSize =
            window.innerWidth < 481 ||
            (Math.abs(dialogBox.width - 600) <= 2 &&
              rows.every((row) => row.getBoundingClientRect().height <= 25));
          return (
            dialogBox.left >= 0 &&
            dialogBox.right <= window.innerWidth &&
            dialogBox.top >= 0 &&
            dialogBox.bottom <= window.innerHeight &&
            dialog.scrollWidth <= dialog.clientWidth + 1 &&
            tableRegion &&
            tableRegion.scrollWidth <= tableRegion.clientWidth + 1 &&
            rowLabels.every((label) => label.scrollWidth <= label.clientWidth + 1) &&
            usesCompactDesktopSize
          );
        }),
      );
      process.stdout.write(`Ready proposal QA: ${viewport.key} measured\n`);
      await snapshotPage.screenshot({
        path: path.join(
          candidateScreenshotRoot,
          `associative-ready-proposal-dialog-${viewport.width}x${viewport.height}.png`,
        ),
      });
      process.stdout.write(`Ready proposal QA: ${viewport.key} captured\n`);
    } finally {
      await snapshotContext.close();
    }
  }
  const readyProposalResponsive = readyProposalResponsiveChecks.every(Boolean);

  return {
    ...initialChecks,
    financingFocusedAfterProfile,
    optionalPaymentsUnlockedAfterProfile,
    readyProposalButtonEnabled,
    readyProposalButtonPlacedAfterInstallments,
    releaseStatusUsesSingleDesktopRow,
    readyProposalAppraisalEditable,
    readyProposalDialogComplete,
    readyProposalDesktopFits,
    readyProposalHelpAccessible,
    readyProposalResponsive,
  };
}

async function checkDirectTableValidation(page, origin, consoleErrors, pageErrors) {
  const consoleStart = consoleErrors.length;
  const pageErrorStart = pageErrors.length;
  const directTablePath = "/app/simulacao/tabela-direta";
  const directTableUrl = `${origin}${directTablePath}`;
  const fixedDirectTableTime = new Date("2026-09-06T12:00:00-03:00");
  const context = page.context();

  async function closeAuxiliaryPage(auxiliaryPage) {
    if (!auxiliaryPage.isClosed()) {
      await auxiliaryPage.close({ runBeforeUnload: false });
    }
  }

  async function waitForDirectInventory(auxiliaryPage) {
    await auxiliaryPage
      .getByRole("heading", { name: "Simulador Tabela Direta", exact: true })
      .waitFor({ state: "visible", timeout: qaNavigationTimeout });
    await auxiliaryPage
      .locator(".investor-stock-sync")
      .getByText("3.301 unidades", {
        exact: true,
      })
      .waitFor({ state: "visible", timeout: qaNavigationTimeout });
  }

  async function prepareApprovedDirectProposal(auxiliaryPage, { navigate = true } = {}) {
    if (navigate) {
      await gotoWithServerRetry(auxiliaryPage, directTableUrl, {
        waitUntil: "domcontentloaded",
      });
    }
    await waitForDirectInventory(auxiliaryPage);
    await auxiliaryPage
      .locator(
        ".investor-stock-table tbody tr.selectable .investor-stock-unit-button:not(:disabled)",
      )
      .first()
      .click();
    const auxiliaryIncome = auxiliaryPage.getByRole("textbox", {
      name: "Renda mensal",
      exact: true,
    });
    await auxiliaryIncome.fill("10000000");
    await auxiliaryPage
      .locator(
        '.investor-direct-credit-result[role="status"] strong, .investor-direct-comparison-heading .investor-direct-credit-status strong',
      )
      .filter({ hasText: /^APROVADO$/ })
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
  }

  async function directProposalFingerprint(auxiliaryPage) {
    return auxiliaryPage.evaluate(() => {
      const text = (selector) =>
        document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const inputValue = (label) =>
        document.querySelector(`input[aria-label="${label}"]`)?.value ?? "";
      return JSON.stringify({
        pathname: window.location.pathname,
        selectedUnit: document
          .querySelector('.investor-stock-unit-button[aria-pressed="true"]')
          ?.getAttribute("aria-label"),
        property: text(
          '.investor-property-summary[aria-label="Descrição do imóvel usado na proposta"]',
        ),
        income: inputValue("Renda mensal"),
        act: inputValue("Valor do ato"),
        selectedOption: text('.investor-direct-ready-options button[aria-pressed="true"]'),
        comparison: text(".investor-direct-comparison-card"),
      });
    });
  }

  await page.clock.setFixedTime(fixedDirectTableTime);
  await gotoWithServerRetry(page, directTableUrl, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Simulador Tabela Direta", exact: true })
    .waitFor({ state: "visible" });
  const inventoryStatus = page.locator(".investor-stock-sync");
  await inventoryStatus.getByText("3.301 unidades", { exact: true }).waitFor({
    state: "visible",
    timeout: qaNavigationTimeout,
  });

  const inventoryRows = page.locator(".investor-stock-table tbody tr");
  const selectedUnitButtons = page.locator('.investor-stock-unit-button[aria-pressed="true"]');
  const inventoryPagination = page.getByRole("navigation", {
    name: "Paginação do estoque completo",
    exact: true,
  });
  const previousInventoryPage = inventoryPagination.getByRole("button", {
    name: "Anterior",
    exact: true,
  });
  const nextInventoryPage = inventoryPagination.getByRole("button", {
    name: "Próxima",
    exact: true,
  });
  const firstPageHasOneHundredRows = (await inventoryRows.count()) === 100;
  const startsWithoutSelectedUnit = (await selectedUnitButtons.count()) === 0;
  const inventoryHeaderText = (await inventoryStatus.innerText()).replace(/\s+/g, " ");
  const firstPaginationText = (await inventoryPagination.innerText()).replace(/\s+/g, " ");
  const fullInventoryCountVisible =
    inventoryHeaderText.includes("3.301 unidades") &&
    firstPaginationText.includes("Exibindo 1–100 de 3.301 unidades") &&
    firstPaginationText.includes("Página 1 de 34");
  const inventoryOriginVisible = inventoryHeaderText.includes(
    "Arquivo ESTOQUE SPC.xlsx · referência 05/09/2026",
  );
  const paginationStartsInExpectedState =
    (await previousInventoryPage.isDisabled()) && (await nextInventoryPage.isEnabled());

  await nextInventoryPage.click();
  await inventoryPagination.getByText("Página 2 de 34", { exact: true }).waitFor();
  const firstUnitOnSecondPage = page
    .locator(".investor-stock-table tbody tr.selectable .investor-stock-unit-button:not(:disabled)")
    .first();
  const paginationFocusedFirstVisibleUnit = await page
    .waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector(
          ".investor-stock-table tbody tr.selectable .investor-stock-unit-button:not(:disabled)",
        ),
      undefined,
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false);
  const paginationFocusedUnitIsVisible = await firstUnitOnSecondPage.evaluate((button) => {
    const results = button.closest(".investor-stock-results");
    if (!(results instanceof HTMLElement)) return false;
    const buttonRect = button.getBoundingClientRect();
    const resultsRect = results.getBoundingClientRect();
    return (
      document.activeElement === button &&
      buttonRect.top >= Math.max(0, resultsRect.top) - 1 &&
      buttonRect.bottom <= Math.min(window.innerHeight, resultsRect.bottom) + 1 &&
      buttonRect.left >= Math.max(0, resultsRect.left) - 1 &&
      buttonRect.right <= Math.min(window.innerWidth, resultsRect.right) + 1
    );
  });
  const paginationFocusesVisibleFirstUnit =
    paginationFocusedFirstVisibleUnit && paginationFocusedUnitIsVisible;
  const secondPaginationText = (await inventoryPagination.innerText()).replace(/\s+/g, " ");
  const paginationAdvancesOneHundredRows =
    (await inventoryRows.count()) === 100 &&
    secondPaginationText.includes("Exibindo 101–200 de 3.301 unidades");
  await previousInventoryPage.click();
  await inventoryPagination.getByText("Página 1 de 34", { exact: true }).waitFor();

  const firstSelectableRow = page.locator(".investor-stock-table tbody tr.selectable").first();
  await firstSelectableRow.click();
  const manualUnitSelectionWorks =
    (await selectedUnitButtons.count()) === 1 &&
    (await firstSelectableRow.getAttribute("aria-selected")) === "true" &&
    (await page
      .getByRole("article", { name: "Descrição do imóvel usado na proposta", exact: true })
      .isVisible());

  const incomeInput = page.getByRole("textbox", { name: "Renda mensal", exact: true });
  await incomeInput.fill("10000000");
  const incomeAccepted =
    (await incomeInput.inputValue()) === "100.000,00" &&
    (await page
      .locator('.investor-direct-editable-freeze fieldset[aria-disabled="false"]')
      .count()) === 1;

  const proposalOptions = page.locator(".investor-direct-ready-options button");
  const fourProposalOptionsPresent = (await proposalOptions.count()) === 4;
  const optionSelectionChecks = [];
  for (let index = 0; index < (await proposalOptions.count()); index += 1) {
    const option = proposalOptions.nth(index);
    const available =
      (await option.isVisible()) &&
      (await option.isEnabled()) &&
      (await option.getAttribute("aria-disabled")) === "false";
    await option.click();
    optionSelectionChecks.push(
      available &&
        (await option.getAttribute("aria-pressed")) === "true" &&
        (await page
          .locator('.investor-direct-ready-options button[aria-pressed="true"]')
          .count()) === 1,
    );
  }
  const allProposalOptionsSelectable =
    optionSelectionChecks.length === 4 && optionSelectionChecks.every(Boolean);
  await proposalOptions.first().click();

  const proposalStatus = page.locator(
    '.investor-direct-credit-result[role="status"][aria-live="polite"][aria-atomic="true"]',
  );
  const approvedProposalStatusVisible =
    (await proposalStatus.isVisible()) &&
    (await proposalStatus.locator("strong").textContent())?.trim() === "APROVADO";

  const selectedProperty = page.getByRole("article", {
    name: "Descrição do imóvel usado na proposta",
    exact: true,
  });
  const propertyBeforeFilter = (await selectedProperty.innerText()).replace(/\s+/g, " ");
  const incomeBeforeFilter = await incomeInput.inputValue();
  const selectedUnitLabel = await selectedUnitButtons.first().getAttribute("aria-label");
  const businessUnitFilter = page
    .locator(".investor-stock-filters label")
    .filter({ hasText: /^Incorporadora/ })
    .locator("select");
  const selectedBusinessUnit = (
    await firstSelectableRow.locator("td").nth(1).textContent()
  )?.trim();
  const alternativeBusinessUnit = await businessUnitFilter
    .locator("option")
    .evaluateAll(
      (options, currentBusinessUnit) =>
        options
          .map((option) => option.value)
          .find((value) => value !== "Todas" && value !== currentBusinessUnit) ?? "",
      selectedBusinessUnit,
    );
  if (alternativeBusinessUnit) {
    await businessUnitFilter.selectOption(alternativeBusinessUnit);
    await page.waitForFunction(
      (value) => document.querySelector(".investor-stock-filters label select")?.value === value,
      alternativeBusinessUnit,
    );
  }
  const filterPreservesSelectedUnitAndIncome =
    alternativeBusinessUnit.length > 0 &&
    (await selectedProperty.innerText()).replace(/\s+/g, " ") === propertyBeforeFilter &&
    (await incomeInput.inputValue()) === incomeBeforeFilter &&
    (await page.locator('.investor-direct-ready-options button[aria-pressed="true"]').count()) ===
      1;

  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await page.waitForFunction(
    (label) =>
      document
        .querySelector('.investor-stock-unit-button[aria-pressed="true"]')
        ?.getAttribute("aria-label") === label,
    selectedUnitLabel,
  );
  const proposalBeforeCancelledUnitChange = await directProposalFingerprint(page);
  const differentUnitButton = page
    .locator(
      ".investor-stock-table tbody tr.selectable:not(.selected) .investor-stock-unit-button:not(:disabled)",
    )
    .first();
  let unitChangeConfirmation = "";
  page.once("dialog", async (dialog) => {
    unitChangeConfirmation = dialog.message();
    await dialog.dismiss();
  });
  await differentUnitButton.click();
  await page.waitForTimeout(50);
  const cancelledUnitChangePreservesProposal =
    unitChangeConfirmation ===
      "Trocar a unidade descartará a renda e a composição atual da proposta. Deseja continuar?" &&
    (await directProposalFingerprint(page)) === proposalBeforeCancelledUnitChange;

  await page.getByRole("button", { name: "Ver parcelas pré-chaves", exact: true }).last().click();
  const preKeysDialog = page.locator("#investor-direct-pre-keys");
  await preKeysDialog.waitFor({ state: "visible" });
  const preKeysDialogWorks = await preKeysDialog.evaluate(
    (dialog) =>
      dialog.open &&
      /\d+ parcelas pré-chaves/.test(dialog.querySelector("h2")?.textContent ?? "") &&
      dialog.querySelectorAll("tbody tr").length > 1,
  );
  await preKeysDialog
    .getByRole("button", { name: "Fechar tabela das parcelas pré-chaves", exact: true })
    .click();
  await preKeysDialog.waitFor({ state: "hidden" });

  await page
    .getByRole("button", { name: /^Ver amortização das \d+ parcelas pós-chaves$/ })
    .last()
    .click();
  const postKeysDialog = page.locator("#investor-direct-amortization");
  await postKeysDialog.waitFor({ state: "visible" });
  const postKeysDialogWorks = await postKeysDialog.evaluate(
    (dialog) =>
      dialog.open &&
      /\d+ parcelas pós-chaves/.test(dialog.querySelector("h2")?.textContent ?? "") &&
      dialog.querySelectorAll("tbody tr").length > 1,
  );
  await postKeysDialog
    .getByRole("button", { name: "Fechar tabela de amortização", exact: true })
    .click();
  await postKeysDialog.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Doc Pessoa Física", exact: true }).click();
  const physicalPersonDialog = page.locator("#investor-documentation-pf");
  await physicalPersonDialog.waitFor({ state: "visible" });
  const physicalPersonDocumentationWorks = await physicalPersonDialog.evaluate(
    (dialog) =>
      dialog.open &&
      dialog.querySelector("h2")?.textContent?.trim() ===
        "Documentação Pessoa Física · Tabela Direta" &&
      dialog.querySelectorAll(".investor-documentation-sections > section").length === 4 &&
      dialog.querySelectorAll("li").length > 0,
  );
  await physicalPersonDialog
    .getByRole("button", {
      name: "Fechar Documentação Pessoa Física · Tabela Direta",
      exact: true,
    })
    .click();
  await physicalPersonDialog.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Doc Pessoa Jurídica", exact: true }).click();
  const legalEntityDialog = page.locator("#investor-documentation-pj");
  await legalEntityDialog.waitFor({ state: "visible" });
  const legalEntityDocumentationWorks = await legalEntityDialog.evaluate(
    (dialog) =>
      dialog.open &&
      dialog.querySelector("h2")?.textContent?.trim() ===
        "Documentação Pessoa Jurídica · Tabela Direta" &&
      dialog.querySelectorAll(".investor-documentation-sections > section").length === 3 &&
      dialog.querySelectorAll("li").length > 0,
  );
  await legalEntityDialog
    .getByRole("button", {
      name: "Fechar Documentação Pessoa Jurídica · Tabela Direta",
      exact: true,
    })
    .click();
  await legalEntityDialog.waitFor({ state: "hidden" });

  await proposalOptions.last().click();
  await page
    .locator('.investor-direct-ready-options button[aria-pressed="true"]')
    .filter({ hasText: "Maior flexibilidade" })
    .waitFor({ state: "visible" });
  await proposalStatus.getByText("APROVADO", { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });

  const actInput = page.getByRole("textbox", { name: "Valor do ato", exact: true });
  const actBeforeInvalidState = await actInput.inputValue();
  const intermediaryAdjustmentInput = page
    .locator('input[aria-label^="Valor da intermediária "]')
    .last();
  const intermediaryBeforeApprovedEdit = await intermediaryAdjustmentInput.inputValue();
  await actInput.fill("100");
  const actDescriptionId = await actInput.getAttribute("aria-describedby");
  const actDescription = actDescriptionId ? page.locator(`#${actDescriptionId}`) : null;
  const belowSixPercentActIsInvalid =
    (await actInput.getAttribute("aria-invalid")) === "true" &&
    actDescription !== null &&
    (await actDescription.getAttribute("role")) === "alert" &&
    /Ato abaixo do mínimo de R\$\s[\d.,]+ \(6%\)\./.test(
      (await actDescription.textContent())?.trim() ?? "",
    );
  const invalidCompositionDisablesPrint = await page
    .getByRole("button", {
      name: "Impressão indisponível até a proposta ser aprovada",
      exact: true,
    })
    .isDisabled();
  let invalidBrowserPrintShowsBlockedNoticeOnly = false;
  await page.emulateMedia({ media: "print" });
  try {
    const blockedWorkspace = page.locator(
      ".investor-direct-workspace.investor-direct-print-blocked",
    );
    const blockedNotice = blockedWorkspace.locator(
      ":scope > .investor-direct-print-blocked-notice",
    );
    invalidBrowserPrintShowsBlockedNoticeOnly =
      (await blockedNotice.isVisible()) &&
      (await blockedNotice.getByRole("heading", { name: "Impressão indisponível" }).isVisible()) &&
      (await blockedNotice.textContent())?.includes(
        "Corrija todas as pendências e obtenha o resultado APROVADO antes de imprimir",
      ) === true &&
      (await page.locator(".investor-direct-print-composition").count()) === 0 &&
      (await blockedWorkspace.evaluate((workspace) =>
        [...workspace.children]
          .filter((child) => !child.classList.contains("investor-direct-print-blocked-notice"))
          .every((child) => getComputedStyle(child).display === "none"),
      ));
  } finally {
    await page.emulateMedia({ media: "screen" });
  }

  const audit = page.locator("details.investor-proposal-audit");
  await audit.locator("summary").click();
  const auditOpensWithRejectedAct = await audit.evaluate(
    (details) =>
      details.open &&
      details.querySelectorAll("li").length > 0 &&
      [...details.querySelectorAll("li.error")].some((item) =>
        item.textContent?.includes("Ato mínimo de 6%"),
      ),
  );
  await audit.locator("summary").click();
  await page.waitForFunction(
    () => !document.querySelector("details.investor-proposal-audit")?.hasAttribute("open"),
  );

  const actAmountBeforeInvalidState = Number(
    actBeforeInvalidState.replace(/\./g, "").replace(",", "."),
  );
  const intermediaryAmountBeforeApprovedEdit = Number(
    intermediaryBeforeApprovedEdit.replace(/\./g, "").replace(",", "."),
  );
  const editedIntermediaryInput = String(
    Math.round((intermediaryAmountBeforeApprovedEdit - 100) * 100),
  );
  const editedActInput = String(Math.round((actAmountBeforeInvalidState + 100) * 100));
  await intermediaryAdjustmentInput.fill(editedIntermediaryInput);
  await actInput.fill(editedActInput);
  const editedActDisplay = await actInput.inputValue();
  const editedIntermediaryDisplay = await intermediaryAdjustmentInput.inputValue();
  const comparisonActRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: "Ato", exact: true }) })
    .first();
  const comparisonActValue = comparisonActRow.locator(".investor-direct-comparison-ledger-value");
  await comparisonActValue.getByText(editedActDisplay, { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await proposalStatus.getByText("APROVADO", { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  const approvedPrintButton = page.getByRole("button", {
    name: "Imprimir a proposta aprovada",
    exact: true,
  });
  const approvedEditedCompositionEnablesPrint =
    editedActDisplay !== actBeforeInvalidState &&
    editedIntermediaryDisplay !== intermediaryBeforeApprovedEdit &&
    (await approvedPrintButton.isEnabled());

  const printComposition = page.locator(".investor-direct-print-composition");
  const printCompositionHiddenOnScreen = await printComposition.isHidden();
  const dynamicPrintPayments = await page
    .locator('input[aria-label^="Valor do sinal "], input[aria-label^="Valor da intermediária "]')
    .evaluateAll((inputs) =>
      inputs
        .map((input) => ({
          label: (input.getAttribute("aria-label") ?? "")
            .replace(/^Valor do sinal /, "Sinal ")
            .replace(/^Valor da intermediária /, "Intermediária "),
          value: input.value,
          amount: Number(input.value.replace(/\./g, "").replace(",", ".")),
        }))
        .filter((payment) => Number.isFinite(payment.amount) && payment.amount > 0),
    );
  const expectedPrintSignals = dynamicPrintPayments.filter((payment) =>
    payment.label.startsWith("Sinal "),
  );
  const expectedPrintIntermediaries = dynamicPrintPayments.filter((payment) =>
    payment.label.startsWith("Intermediária "),
  );
  const expectedPrintAuditLabels = await audit.locator(":scope > ul > li").allTextContents();
  const expectedPrintIncomeDisplay = await incomeInput.inputValue();
  let printMediaShowsEditedValues = false;
  let printMediaShowsCompleteDynamicComposition = false;
  let printMediaHidesIncomeOptionsAndGuidance = false;
  let printMediaShowsCompleteAudit = false;
  await page.emulateMedia({ media: "print" });
  try {
    printMediaShowsEditedValues =
      printCompositionHiddenOnScreen &&
      (await printComposition.isVisible()) &&
      (
        await printComposition
          .locator("dt")
          .filter({ hasText: /^Ato$/ })
          .locator("xpath=following-sibling::dd[1]")
          .textContent()
      )
        ?.replace(/\s+/g, " ")
        .includes(editedActDisplay) === true;
    printMediaShowsCompleteDynamicComposition = await printComposition.evaluate(
      (section, expected) => {
        const definitionLabels = [...section.querySelectorAll("dt")].map((term) =>
          term.textContent?.replace(/\s+/g, " ").trim(),
        );
        const definitionValue = (label) => {
          const term = [...section.querySelectorAll("dt")].find(
            (candidate) => candidate.textContent?.trim() === label,
          );
          return term?.parentElement?.querySelector("dd")?.textContent?.replace(/\s+/g, " ").trim();
        };
        const tableMatches = (caption, payments) => {
          const table = [...section.querySelectorAll("table")].find(
            (candidate) => candidate.querySelector("caption")?.textContent?.trim() === caption,
          );
          if (!table || payments.length === 0) return false;
          return payments.every((payment) => {
            const row = [...table.querySelectorAll("tbody tr")].find(
              (candidate) => candidate.querySelector("th")?.textContent?.trim() === payment.label,
            );
            return row?.textContent?.includes(payment.value) === true;
          });
        };
        return (
          getComputedStyle(section).display !== "none" &&
          section.querySelector("h2")?.textContent?.trim() ===
            "Composição atual da Tabela Direta" &&
          JSON.stringify(definitionLabels) ===
            JSON.stringify([
              "Valor do imóvel",
              "Desconto autorizado",
              "Valor real da venda",
              "Ato",
              "Entrada total",
              "Limites da entrada",
              "Saldo pré-chaves",
              "Saldo pós-chaves",
              "Renda e comprometimento",
              "Resultado",
            ]) &&
          definitionValue("Desconto autorizado") === "Não aplicado" &&
          definitionValue("Ato")?.includes(expected.editedActDisplay) === true &&
          definitionValue("Renda e comprometimento")?.includes(expected.incomeDisplay) === true &&
          definitionValue("Resultado") === "APROVADO" &&
          expected.signals.length === 3 &&
          expected.intermediaries.length > 0 &&
          tableMatches("Sinais informados", expected.signals) &&
          tableMatches("Intermediárias informadas", expected.intermediaries)
        );
      },
      {
        editedActDisplay,
        incomeDisplay: expectedPrintIncomeDisplay,
        signals: expectedPrintSignals,
        intermediaries: expectedPrintIntermediaries,
      },
    );
    printMediaHidesIncomeOptionsAndGuidance =
      !(await incomeInput.isVisible()) &&
      !(await page.locator(".investor-direct-ready-options").isVisible()) &&
      !(await page.locator(".investor-scenario-order").isVisible()) &&
      !(await page.locator(".investor-direct-five-card-headings").isVisible()) &&
      !(await page.locator(".investor-direct-five-card-grid").isVisible());
    printMediaShowsCompleteAudit = await printComposition
      .locator(".investor-direct-print-audit")
      .evaluate((printAudit, expectedLabels) => {
        const actualLabels = [...printAudit.querySelectorAll("li")].map(
          (item) => item.textContent?.replace(/\s+/g, " ").trim() ?? "",
        );
        return (
          getComputedStyle(printAudit).display !== "none" &&
          printAudit.getBoundingClientRect().height > 0 &&
          printAudit.querySelector("h3")?.textContent?.trim() === "Auditoria integral do cálculo" &&
          actualLabels.length > 0 &&
          JSON.stringify(actualLabels) ===
            JSON.stringify(expectedLabels.map((label) => label.replace(/\s+/g, " ").trim()))
        );
      }, expectedPrintAuditLabels);
  } finally {
    await page.emulateMedia({ media: "screen" });
  }

  let snapshotFailureFailsClosedWithoutLiveFallback = false;
  let snapshotRetryRestoresInventory = false;
  const snapshotPage = configureQaPage(await context.newPage());
  try {
    await snapshotPage.clock.setFixedTime(fixedDirectTableTime);
    let rejectSnapshot = true;
    let snapshotRequestCount = 0;
    let liveInventoryRequestCount = 0;
    snapshotPage.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === "/api/inventory/snapshot") snapshotRequestCount += 1;
      if (pathname === "/api/inventory") liveInventoryRequestCount += 1;
    });
    await snapshotPage.route("**/api/inventory/snapshot*", async (route) => {
      if (!rejectSnapshot) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({ error: "Synthetic snapshot outage for authenticated QA." }),
      });
    });
    await gotoWithServerRetry(snapshotPage, directTableUrl, {
      waitUntil: "domcontentloaded",
    });
    const snapshotFailureMessage =
      "Arquivo oficial do estoque indisponível. Nenhuma fonte alternativa foi usada.";
    const snapshotFailure = snapshotPage
      .locator(".investor-empty-result")
      .filter({ hasText: snapshotFailureMessage });
    await snapshotFailure.waitFor({ state: "visible", timeout: 20_000 });
    const retrySnapshot = snapshotPage.getByRole("button", {
      name: "Tentar novamente",
      exact: true,
    });
    snapshotFailureFailsClosedWithoutLiveFallback =
      snapshotRequestCount >= 1 &&
      liveInventoryRequestCount === 0 &&
      (await snapshotFailure.innerText()).includes(snapshotFailureMessage) &&
      (await snapshotPage.locator(".investor-stock-table tbody tr.selectable").count()) === 0 &&
      (await snapshotPage
        .getByRole("navigation", { name: "Paginação do estoque completo", exact: true })
        .count()) === 0 &&
      (await retrySnapshot.isVisible()) &&
      (await retrySnapshot.isEnabled());

    const requestsBeforeRetry = snapshotRequestCount;
    rejectSnapshot = false;
    await retrySnapshot.click();
    await waitForDirectInventory(snapshotPage);
    snapshotRetryRestoresInventory =
      snapshotRequestCount > requestsBeforeRetry &&
      liveInventoryRequestCount === 0 &&
      (await snapshotPage.locator(".investor-stock-table tbody tr").count()) === 100 &&
      (await snapshotPage
        .getByRole("navigation", { name: "Paginação do estoque completo", exact: true })
        .isVisible());
  } finally {
    await closeAuxiliaryPage(snapshotPage);
  }

  let mobileComparisonHasNoTruncationOrOverlap = false;
  const responsiveMenuChecks = {
    menuAndBodyUnclippedAt768: false,
    menuAndBodyUnclippedAt834: false,
    menuAndBodyUnclippedAt900: false,
    menuAndBodyUnclippedAt912: false,
    menuAndBodyUnclippedAt1024: false,
  };
  const responsivePage = configureQaPage(await context.newPage());
  try {
    await responsivePage.clock.setFixedTime(fixedDirectTableTime);
    await responsivePage.setViewportSize({ width: 375, height: 812 });
    await prepareApprovedDirectProposal(responsivePage);
    const mobileComparison = responsivePage.locator(".investor-direct-comparison-card").first();
    await mobileComparison.waitFor({ state: "visible", timeout: 10_000 });
    await mobileComparison.scrollIntoViewIfNeeded();
    mobileComparisonHasNoTruncationOrOverlap = await mobileComparison.evaluate((card) => {
      const root = document.documentElement;
      const body = document.body;
      const cardRect = card.getBoundingClientRect();
      const rows = [...card.querySelectorAll(".investor-direct-comparison-ledger-row")];
      const fitsOwnBox = (element) =>
        element instanceof HTMLElement &&
        element.scrollWidth <= element.clientWidth + 1 &&
        element.scrollHeight <= element.clientHeight + 1;
      const orderedWithoutOverlap = (elements) => {
        const rectangles = elements.map((element) => element.getBoundingClientRect());
        return rectangles.every(
          (rectangle, index) => index === 0 || rectangles[index - 1].right <= rectangle.left + 1,
        );
      };
      return (
        window.innerWidth === 375 &&
        root.scrollWidth <= root.clientWidth + 1 &&
        body.scrollWidth <= body.clientWidth + 1 &&
        cardRect.left >= -1 &&
        cardRect.right <= window.innerWidth + 1 &&
        card.scrollWidth <= card.clientWidth + 1 &&
        rows.length >= 8 &&
        rows.every((row) => {
          const cells = [
            row.querySelector(".investor-direct-comparison-ledger-label"),
            row.querySelector(".investor-direct-comparison-ledger-operator"),
            row.querySelector(".investor-direct-comparison-ledger-currency"),
            row.querySelector(".investor-direct-comparison-ledger-value"),
            row.querySelector(".investor-direct-comparison-ledger-help"),
          ].filter((element) => element instanceof HTMLElement);
          const label = row.querySelector(".investor-direct-comparison-ledger-label strong");
          const value = row.querySelector(".investor-direct-comparison-ledger-value");
          const labelStyle = label ? getComputedStyle(label) : null;
          const valueStyle = value ? getComputedStyle(value) : null;
          return (
            row.scrollWidth <= row.clientWidth + 1 &&
            cells.length === 5 &&
            orderedWithoutOverlap(cells) &&
            fitsOwnBox(label) &&
            fitsOwnBox(value) &&
            labelStyle?.textOverflow !== "ellipsis" &&
            labelStyle?.whiteSpace === "normal" &&
            valueStyle?.textOverflow !== "ellipsis" &&
            valueStyle?.whiteSpace === "normal"
          );
        })
      );
    });

    async function checkOpenMenuPanel(triggerName, panelId) {
      const trigger = responsivePage.getByRole("button", { name: triggerName, exact: true });
      const panel = responsivePage.locator(`#${panelId}`);
      await trigger.click();
      await responsivePage.waitForFunction(
        (id) =>
          document.querySelector(`[aria-controls="${id}"]`)?.getAttribute("aria-expanded") ===
          "true",
        panelId,
        { timeout: 5_000 },
      );
      await responsivePage.waitForTimeout(250);
      const unclipped = await panel.evaluate((menuPanel) => {
        const viewportTolerance = 1;
        const panelRect = menuPanel.getBoundingClientRect();
        const triggerElement = document.querySelector(`[aria-controls="${menuPanel.id}"]`);
        const triggerRect = triggerElement?.getBoundingClientRect();
        const menu = menuPanel.closest(".site-menu");
        const root = document.documentElement;
        const body = document.body;
        let ancestor = menuPanel.parentElement;
        let ancestorDoesNotClip = true;
        while (ancestor && ancestor !== root) {
          const style = getComputedStyle(ancestor);
          const ancestorRect = ancestor.getBoundingClientRect();
          const clipsX = ["auto", "hidden", "scroll", "clip"].includes(style.overflowX);
          const clipsY = ["auto", "hidden", "scroll", "clip"].includes(style.overflowY);
          if (
            (clipsX &&
              (panelRect.left < ancestorRect.left - viewportTolerance ||
                panelRect.right > ancestorRect.right + viewportTolerance)) ||
            (clipsY &&
              (panelRect.top < ancestorRect.top - viewportTolerance ||
                panelRect.bottom > ancestorRect.bottom + viewportTolerance))
          ) {
            ancestorDoesNotClip = false;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return (
          getComputedStyle(menuPanel).visibility === "visible" &&
          Number(getComputedStyle(menuPanel).opacity) > 0 &&
          triggerElement?.getAttribute("aria-expanded") === "true" &&
          Boolean(triggerRect) &&
          panelRect.width > 0 &&
          panelRect.height > 0 &&
          panelRect.left >= -viewportTolerance &&
          panelRect.right <= window.innerWidth + viewportTolerance &&
          panelRect.top >= -viewportTolerance &&
          panelRect.bottom <= window.innerHeight + viewportTolerance &&
          triggerRect.left >= -viewportTolerance &&
          triggerRect.right <= window.innerWidth + viewportTolerance &&
          menu instanceof HTMLElement &&
          menu.scrollWidth <= menu.clientWidth + viewportTolerance &&
          menuPanel.scrollWidth <= menuPanel.clientWidth + viewportTolerance &&
          menuPanel.scrollHeight <= menuPanel.clientHeight + viewportTolerance &&
          root.scrollWidth <= root.clientWidth + viewportTolerance &&
          body.scrollWidth <= body.clientWidth + viewportTolerance &&
          ancestorDoesNotClip
        );
      });
      await trigger.click();
      await responsivePage.waitForFunction(
        (id) =>
          document.querySelector(`[aria-controls="${id}"]`)?.getAttribute("aria-expanded") ===
          "false",
        panelId,
        { timeout: 5_000 },
      );
      return unclipped;
    }

    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 834, height: 1112 },
      { width: 900, height: 1024 },
      { width: 912, height: 1368 },
      { width: 1024, height: 768 },
    ]) {
      await responsivePage.setViewportSize(viewport);
      await responsivePage.evaluate(() => window.scrollTo(0, 0));
      const simulationMenuUnclipped = await checkOpenMenuPanel("Simulação", "site-menu-simulation");
      const settingsMenuUnclipped = await checkOpenMenuPanel("Configurações", "site-menu-settings");
      responsiveMenuChecks[`menuAndBodyUnclippedAt${viewport.width}`] =
        simulationMenuUnclipped && settingsMenuUnclipped;
    }
  } finally {
    await closeAuxiliaryPage(responsivePage);
  }

  let spaNavigationBuildsForwardHistory = false;
  let cancelledBackNavigationPreservesProposal = false;
  let cancelledForwardNavigationPreservesProposal = false;
  const historyPage = configureQaPage(await context.newPage());
  try {
    await historyPage.clock.setFixedTime(fixedDirectTableTime);
    await gotoWithServerRetry(historyPage, `${origin}/app/simulacao`, {
      waitUntil: "domcontentloaded",
    });
    await historyPage.getByRole("heading", { name: "Simulação", exact: true }).waitFor({
      state: "visible",
      timeout: qaNavigationTimeout,
    });
    const spaMarker = `direct-table-spa-${Date.now()}`;
    await historyPage.evaluate((marker) => {
      window.__authenticatedDirectTableSpaMarker = marker;
    }, spaMarker);
    const directTableHubLink = historyPage.locator(`a[href="${directTablePath}"]`).first();
    await directTableHubLink.waitFor({ state: "visible", timeout: 10_000 });
    await directTableHubLink.click();
    await historyPage.waitForURL((url) => url.pathname === directTablePath, {
      timeout: qaNavigationTimeout,
    });
    await waitForDirectInventory(historyPage);
    const markerAfterDirectNavigation = await historyPage.evaluate(
      () => window.__authenticatedDirectTableSpaMarker,
    );

    await historyPage.locator('a.brand-link[href="/app"]').click();
    await historyPage.waitForURL((url) => url.pathname === "/app", {
      timeout: qaNavigationTimeout,
    });
    await historyPage
      .locator("h1")
      .first()
      .waitFor({ state: "visible", timeout: qaNavigationTimeout });
    const markerAfterForwardDestination = await historyPage.evaluate(
      () => window.__authenticatedDirectTableSpaMarker,
    );
    await historyPage.goBack({ waitUntil: "domcontentloaded" });
    await historyPage.waitForURL((url) => url.pathname === directTablePath, {
      timeout: qaNavigationTimeout,
    });
    await waitForDirectInventory(historyPage);
    const historyTopology = await historyPage.evaluate(() => {
      if (!("navigation" in window)) return null;
      const entries = window.navigation.entries();
      const currentIndex = window.navigation.currentEntry?.index;
      const pathnameAt = (index) => {
        const entry = entries.find((candidate) => candidate.index === index);
        return entry ? new URL(entry.url).pathname : null;
      };
      return Number.isInteger(currentIndex)
        ? {
            currentIndex,
            previousPathname: pathnameAt(currentIndex - 1),
            currentPathname: pathnameAt(currentIndex),
            forwardPathname: pathnameAt(currentIndex + 1),
          }
        : null;
    });
    spaNavigationBuildsForwardHistory =
      markerAfterDirectNavigation === spaMarker &&
      markerAfterForwardDestination === spaMarker &&
      historyTopology?.previousPathname === "/app/simulacao" &&
      historyTopology.currentPathname === directTablePath &&
      historyTopology.forwardPathname === "/app";

    await prepareApprovedDirectProposal(historyPage, { navigate: false });
    const protectedProposal = await directProposalFingerprint(historyPage);
    const protectedHistoryIndex = historyTopology?.currentIndex;
    const discardConfirmation =
      "Sair da Tabela Direta descartará a proposta em edição. Deseja continuar?";

    async function cancelHistoryNavigation(direction) {
      const dialogPromise = historyPage.waitForEvent("dialog", { timeout: 5_000 });
      await historyPage.evaluate((navigationDirection) => {
        if (navigationDirection === "back") window.history.back();
        else window.history.forward();
      }, direction);
      const dialog = await dialogPromise;
      const message = dialog.message();
      await dialog.dismiss();
      await historyPage.waitForFunction(
        ({ pathname, historyIndex }) =>
          window.location.pathname === pathname &&
          (!("navigation" in window) || window.navigation.currentEntry?.index === historyIndex),
        { pathname: directTablePath, historyIndex: protectedHistoryIndex },
        { timeout: 10_000 },
      );
      await historyPage.waitForTimeout(100);
      return (
        message === discardConfirmation &&
        (await directProposalFingerprint(historyPage)) === protectedProposal
      );
    }

    cancelledBackNavigationPreservesProposal = await cancelHistoryNavigation("back");
    cancelledForwardNavigationPreservesProposal = await cancelHistoryNavigation("forward");
  } finally {
    await closeAuxiliaryPage(historyPage);
  }

  return {
    fullInventoryCountVisible,
    inventoryOriginVisible,
    firstPageHasOneHundredRows,
    paginationStartsInExpectedState,
    paginationAdvancesOneHundredRows,
    paginationFocusesVisibleFirstUnit,
    startsWithoutSelectedUnit,
    manualUnitSelectionWorks,
    incomeAccepted,
    fourProposalOptionsPresent,
    allProposalOptionsSelectable,
    approvedProposalStatusVisible,
    filterPreservesSelectedUnitAndIncome,
    cancelledUnitChangePreservesProposal,
    belowSixPercentActIsInvalid,
    invalidCompositionDisablesPrint,
    invalidBrowserPrintShowsBlockedNoticeOnly,
    approvedEditedCompositionEnablesPrint,
    printMediaShowsEditedValues,
    printMediaShowsCompleteDynamicComposition,
    printMediaHidesIncomeOptionsAndGuidance,
    printMediaShowsCompleteAudit,
    preKeysDialogWorks,
    postKeysDialogWorks,
    physicalPersonDocumentationWorks,
    legalEntityDocumentationWorks,
    auditOpensWithRejectedAct,
    snapshotFailureFailsClosedWithoutLiveFallback,
    snapshotRetryRestoresInventory,
    mobileComparisonHasNoTruncationOrOverlap,
    ...responsiveMenuChecks,
    spaNavigationBuildsForwardHistory,
    cancelledBackNavigationPreservesProposal,
    cancelledForwardNavigationPreservesProposal,
    directFlowHasNoRuntimeErrors:
      consoleErrors.length === consoleStart && pageErrors.length === pageErrorStart,
  };
}

async function checkFixtureSourceMarker(page, origin, expectedMarker) {
  const checks = {};
  for (const [key, route] of [
    ["dashboard", "/app"],
    ["stageOpportunities", "/app/etapas/oportunidades"],
  ]) {
    await gotoWithServerRetry(page, `${origin}${route}`, { waitUntil: "domcontentloaded" });
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
    const stopSyntheticInventory = await installSyntheticInventoryForVisualCapture(context, origin);
    const page = configureQaPage(await context.newPage());
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
          ...(await inspectRoute(page, origin, route, "light", consoleErrors, pageErrors, {
            waitForArchiveInventory: false,
          })),
        });
        await releaseRenderedRoute(page);
      }
    } finally {
      await stopSyntheticInventory();
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
      const page = configureQaPage(await context.newPage());
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
  directTableValidation,
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
    directTableValidation &&
    Object.values(directTableValidation).every(Boolean) &&
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
    directTableInventoryEvidencePolicy,
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
  let browser = await chromium.launch({ headless: true });
  const routeChecks = [];
  const themeChecks = [];
  const accessibilityChecks = [];
  const screenshots = [];
  let keyboard = null;
  let simulatorValidation = null;
  let directTableValidation = null;
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
      const stopSyntheticInventory = await installSyntheticInventoryForVisualCapture(
        context,
        origin,
      );
      const page = configureQaPage(await context.newPage());
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
          await releaseRenderedRoute(page);
        }

        if (viewport.key === "desktop-1440x900") {
          for (const theme of themes) {
            currentStage = `theme:${theme}`;
            await gotoWithServerRetry(page, `${origin}/app`, { waitUntil: "domcontentloaded" });
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
              await releaseRenderedRoute(page);
            }
          }
          currentStage = "keyboard";
          keyboard = await checkKeyboard(page, origin);
          currentStage = "simulator-validation";
          simulatorValidation = await checkSimulatorValidation(page, origin, httpCredentials);
          await stopSyntheticInventory();
          currentStage = "direct-table-validation";
          const directPage = configureQaPage(await context.newPage());
          const directConsoleErrors = [];
          const directPageErrors = [];
          directPage.on("console", (message) => {
            if (message.type() === "error") directConsoleErrors.push(message.text());
          });
          directPage.on("pageerror", (error) => directPageErrors.push(error.message));
          try {
            directTableValidation = await checkDirectTableValidation(
              directPage,
              origin,
              directConsoleErrors,
              directPageErrors,
            );
          } finally {
            await directPage.close({ runBeforeUnload: false });
          }
          currentStage = "fixture-source-marker";
          fixtureSourceMarker = await checkFixtureSourceMarker(page, origin, expectedSourceMarker);
        }

        if (viewport.key === mobileDarkViewportKey) {
          currentStage = `mobile-dark:${viewport.key}`;
          await gotoWithServerRetry(page, `${origin}/app`, { waitUntil: "domcontentloaded" });
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
            await releaseRenderedRoute(page);
          }
        }
      } finally {
        await stopSyntheticInventory();
        await context.close();
      }

      // Chromium may retain renderer allocations after a context closes.
      // Restart between viewports to keep the exhaustive matrix below the
      // host memory ceiling without reducing coverage.
      await browser.close();
      browser = await chromium.launch({ headless: true });
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
      directTableValidation,
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
      directTableInventoryEvidencePolicy,
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
      directTableValidation,
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
  } catch (error) {
    if (!remoteHomologation && process.env.QA_LOCAL_DIAGNOSTICS === "true") {
      process.stderr.write(
        `${error instanceof Error ? error.stack : "Unknown local QA failure."}\n`,
      );
    }
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
        directTableInventoryEvidencePolicy,
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
