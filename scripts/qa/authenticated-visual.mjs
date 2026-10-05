import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { checkDocumentationCalculator } from "./documentation-calculator.mjs";
import {
  checkTabelaoLayout,
  checkTabelaoMapsFixture,
  readTabelaoLayout,
} from "./tabelao-layout.mjs";

import {
  buildTabelaoExclusiveInventory,
  sortTabelaoInventory,
} from "../../lib/archive-investor/tabelao-inventory.mjs";
import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";
import { checkAssociativeLearningManual } from "./associative-learning-manual.mjs";
import {
  archiveNavigationActionTimeout,
  archiveNavigationPassed,
  checkArchiveMenuPanel,
  checkArchiveNavigation,
} from "./archive-navigation.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(repositoryRoot, "docs/qa/reference-parity");
const baselineScreenshotRoot = path.join(outputRoot, "target-authenticated");
const approvedCanvasRoot = path.join(repositoryRoot, "docs/qa/canvas-parity/reference");
const simulatorCanaryBaselineRoot = path.join(outputRoot, "target-authenticated-canary");
const baselineResultsPath = path.join(outputRoot, "authenticated-results.json");
const artifactRoot = path.join(repositoryRoot, "test-results/authenticated-visual");
const candidateScreenshotRoot = path.join(artifactRoot, "candidate");
const candidateResultsPath = path.join(artifactRoot, "candidate-results.json");
const archiveNavigationResultsPath = path.join(artifactRoot, "archive-navigation-results.json");
const visualDifferenceThreshold = 0.01;
const visualChannelTolerance = 16;
const approvedCanvasColorDistanceThreshold = 18;
const approvedCanvasEdgeDistanceThreshold = 39;
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
const inventoryRoutePattern = /\/api\/inventory(?:\/snapshot)?(?:\?.*)?$/;
const syntheticDirectTableSnapshot = (() => {
  const contents = buildSyntheticDirectTableQaSnapshot();
  return JSON.stringify({
    ...JSON.parse(contents),
    sourceKind: "versioned-snapshot",
    snapshotReferenceDate: "2026-09-05",
    snapshotSha256: createHash("sha256").update(contents).digest("hex"),
  });
})();
const syntheticTabelaoInventory = sortTabelaoInventory(
  buildTabelaoExclusiveInventory(JSON.parse(syntheticDirectTableSnapshot).items),
  "project",
);
const syntheticTabelaoLastInventoryId = syntheticTabelaoInventory.at(-1)?.id;
const syntheticTabelaoCountLabel = `${syntheticTabelaoInventory.length} opções exclusivas · 6 empreendimentos`;

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
  "/app/simulacao/calcular-documentacao",
  "/app/simulacao/caixa",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabelao",
  "/app/simulacao/tabela-investidor",
  "/admin",
  "/admin/usuarios",
  "/admin/paginas",
];

const approvedCanvasByRoute = new Map([
  ["/app", { asset: "dashboard-oportunidades.webp", region: "left" }],
  ["/app/etapas/oportunidades", { asset: "dashboard-oportunidades.webp", region: "right" }],
  ["/app/etapas/agendamentos", { asset: "agendamentos-visitas.webp", region: "left" }],
  ["/app/etapas/visitas", { asset: "agendamentos-visitas.webp", region: "right" }],
  ["/app/etapas/pastas", { asset: "pastas-vendas.webp", region: "left" }],
  ["/app/etapas/vendas", { asset: "pastas-vendas.webp", region: "right" }],
  ["/app/ranking", { asset: "ranking-canal-parcerias.webp", region: "left" }],
  ["/app/canal-de-parcerias", { asset: "ranking-canal-parcerias.webp", region: "right" }],
  ["/app/configuracoes", { asset: "configuracoes-metas-funil.webp", region: "left" }],
  ["/app/configuracoes/metas", { asset: "configuracoes-metas-funil.webp", region: "right" }],
  ["/app/configuracoes/metas/parcerias", { asset: "metas-parcerias-pontos.webp", region: "left" }],
  ["/app/configuracoes/metas/pontos", { asset: "metas-parcerias-pontos.webp", region: "right" }],
  ["/app/simulacao", { asset: "hub-simulacao-associativo.webp", region: "left" }],
  [
    "/app/simulacao/associativo-fluxo-linear",
    { asset: "hub-simulacao-associativo.webp", region: "right" },
  ],
  ["/app/simulacao/calcular-documentacao", { asset: "documentacao-caixa.webp", region: "left" }],
  ["/app/simulacao/caixa", { asset: "documentacao-caixa.webp", region: "right" }],
  ["/app/simulacao/tabela-direta", { asset: "tabela-direta-investidor.webp", region: "left" }],
  ["/app/simulacao/tabela-investidor", { asset: "tabela-direta-investidor.webp", region: "right" }],
  ["/app/simulacao/tabelao", { asset: "tabelao-administracao.webp", region: "left" }],
  ["/admin", { asset: "tabelao-administracao.webp", region: "right" }],
  ["/admin/usuarios", { asset: "usuarios-catalogo-paginas.webp", region: "left" }],
  ["/admin/paginas", { asset: "usuarios-catalogo-paginas.webp", region: "right" }],
]);

if (approvedCanvasByRoute.size !== routes.length) {
  throw new Error("Every protected visual route must map to one approved canvas region.");
}

const canvasDensityLimitByRoute = new Map([
  ["/app/etapas/agendamentos", 1500],
  ["/app/etapas/visitas", 1500],
  ["/app/etapas/pastas", 1350],
  ["/app/etapas/vendas", 1350],
  ["/app/simulacao/calcular-documentacao", 1200],
  ["/app/simulacao/caixa", 1200],
]);
const defaultCanvasDensityLimit = 1125;

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
  "/app/simulacao/tabelao",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
]);
const dedicatedSimulatorRoutes = new Set([
  ...archiveSimulatorRoutes,
  "/app/simulacao/calcular-documentacao",
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

  if (enabledKeys.includes("simulator.caixa")) {
    throw new Error("Authenticated visual QA refuses to enable the CAIXA visual-only journey.");
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
  if (runtimeKey && enabledSimulatorRoutes.has(route) && !archiveSimulatorRoutes.has(route)) {
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
const themeLabels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
const desktopThemeCaptureRoutes = new Set(routes);
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
    if (context.isClosed()) return;
    try {
      await context.unroute(inventoryRoutePattern, handler);
    } catch (error) {
      // Preserve the original capture failure when Chromium has already
      // closed the context (for example after an external OOM kill).
      if (!context.isClosed()) throw error;
    }
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
  const registeredName = session.user?.user_metadata?.name;
  const name = typeof registeredName === "string" ? registeredName.trim() : "";
  const firstName = name && !name.includes("@") ? name.split(/\s+/u)[0] : "Conta";
  return { endpoint: supabaseUrl, accountPolicy: "qa.*@local.invalid", firstName };
}

function inspectAccountIdentityDisplay(expectedFirstName) {
  const label = document.querySelector("[data-session-identity-trigger-label]");
  const trigger = document.querySelector("[data-session-identity]");
  const avatar = document.querySelector("[data-session-avatar]");
  if (
    !(label instanceof HTMLElement) ||
    !(trigger instanceof HTMLButtonElement) ||
    !(avatar instanceof HTMLElement)
  ) {
    return { identityDisplayContract: "compact-account-avatar-v2", identityDisplayReady: false };
  }
  const labelBox = label.getBoundingClientRect();
  const triggerBox = trigger.getBoundingClientRect();
  const style = getComputedStyle(label);
  const avatarBox = avatar.getBoundingClientRect();
  const identityNameMatches =
    typeof expectedFirstName === "string" &&
    expectedFirstName.length > 0 &&
    label.textContent?.trim() === expectedFirstName;
  const identityCompact =
    labelBox.width <= 1 &&
    labelBox.height <= 1 &&
    style.position === "absolute" &&
    style.overflow === "hidden" &&
    avatarBox.width > 0 &&
    avatarBox.height > 0 &&
    avatarBox.left >= triggerBox.left - 1 &&
    avatarBox.right <= triggerBox.right + 1 &&
    triggerBox.left >= -1 &&
    triggerBox.right <= innerWidth + 1 &&
    triggerBox.top >= -1 &&
    triggerBox.bottom <= innerHeight + 1;
  const identityAccessibleNameMatches = Boolean(
    identityNameMatches && trigger.getAttribute("aria-label")?.includes(expectedFirstName),
  );
  return {
    identityDisplayContract: "compact-account-avatar-v2",
    identityNameMatches,
    identityCompact,
    identityAvatarVisible: avatarBox.width > 0 && avatarBox.height > 0,
    identityAccessibleNameMatches,
    identityDisplayReady: identityNameMatches && identityCompact && identityAccessibleNameMatches,
  };
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

function meanAbsolutePixelDistance(actual, expected) {
  if (actual.length !== expected.length || actual.length === 0) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < actual.length; index += 1) {
    distance += Math.abs(actual[index] - expected[index]);
  }
  return distance / actual.length;
}

async function normalizeCanvasReference(input, extract, edge) {
  let pipeline = sharp(input);
  if (extract) pipeline = pipeline.extract(extract);
  pipeline = pipeline.resize(edge ? 128 : 96, edge ? 96 : 64, { fit: "fill" });
  if (edge) {
    pipeline = pipeline.grayscale().convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
      scale: 1,
      offset: 0,
    });
  } else {
    pipeline = pipeline.removeAlpha();
  }
  return pipeline.raw().toBuffer();
}

async function compareApprovedCanvas(buffer, approvedCanvas) {
  const referencePath = path.join(approvedCanvasRoot, approvedCanvas.asset);
  const reference = await readFile(referencePath);
  const metadata = await sharp(reference).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Approved canvas has no dimensions: ${approvedCanvas.asset}`);
  }
  const separatorInset = Math.min(2, Math.floor(metadata.width / 8));
  const half = Math.floor(metadata.width / 2);
  const left =
    approvedCanvas.region === "left" ? 0 : Math.ceil(metadata.width / 2) + separatorInset;
  const width = approvedCanvas.region === "left" ? half - separatorInset : metadata.width - left;
  const extract = { left, top: 0, width, height: metadata.height };
  const [actualColor, expectedColor, actualEdges, expectedEdges] = await Promise.all([
    normalizeCanvasReference(buffer, null, false),
    normalizeCanvasReference(reference, extract, false),
    normalizeCanvasReference(buffer, null, true),
    normalizeCanvasReference(reference, extract, true),
  ]);
  const colorDistance = meanAbsolutePixelDistance(actualColor, expectedColor);
  const edgeDistance = meanAbsolutePixelDistance(actualEdges, expectedEdges);
  const passed =
    colorDistance <= approvedCanvasColorDistanceThreshold &&
    edgeDistance <= approvedCanvasEdgeDistanceThreshold;
  return {
    passed,
    reason: passed ? "approved_canvas_structure_within_threshold" : "approved_canvas_drift",
    asset: `docs/qa/canvas-parity/reference/${approvedCanvas.asset}`,
    region: approvedCanvas.region,
    referenceSha256: createHash("sha256").update(reference).digest("hex"),
    colorDistance,
    colorDistanceThreshold: approvedCanvasColorDistanceThreshold,
    edgeDistance,
    edgeDistanceThreshold: approvedCanvasEdgeDistanceThreshold,
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
      if ((response?.status() ?? 200) >= 500) {
        throw new Error("Authenticated route returned a transient server error.");
      }
      await page
        .locator("h1")
        .first()
        .waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        expectedTheme,
        { timeout: qaRouteBootstrapTimeout },
      );
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await releaseRenderedRoute(page).catch(() => undefined);
        await page.waitForTimeout((attempt + 1) * 1_000);
        // A failed RSC response can report console/page errors after page.goto
        // settles. Clear them after teardown/backoff so the next successful
        // attempt is evaluated only against its own diagnostics.
        consoleErrors.length = consoleAttemptStart;
        pageErrors.length = pageAttemptStart;
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
  { waitForArchiveInventory = true, expectedAccountFirstName } = {},
) {
  const approvedCanvas = approvedCanvasByRoute.get(route);
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
    await page
      .locator(
        ".investor-stock-table tbody tr.selectable, .investor-stock-table tbody tr[data-inventory-unit-id]",
      )
      .first()
      .waitFor({
        state: "visible",
        timeout: 25_000,
      });
  }
  const isSimulatorWorkspace =
    route.startsWith("/app/simulacao/") && !dedicatedSimulatorRoutes.has(route);
  const expectsEnabledSimulatorAction = enabledSimulatorRoutes.has(route);
  const accountTrigger = page.locator(
    'header button[data-session-identity][aria-controls="protected-account-menu"]',
  );
  const accountPanel = page.locator("#protected-account-menu");
  await accountTrigger.waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (
      (await accountTrigger.getAttribute("aria-expanded")) === "true" &&
      (await accountPanel.isVisible())
    ) {
      break;
    }

    await accountTrigger.click();
    try {
      await page.waitForFunction(
        () => {
          const trigger = document.querySelector(
            'header button[data-session-identity][aria-controls="protected-account-menu"]',
          );
          const panel = document.querySelector("#protected-account-menu");
          return trigger?.getAttribute("aria-expanded") === "true" && panel?.hidden === false;
        },
        undefined,
        { timeout: 3_000 },
      );
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(100);
    }
  }
  await accountPanel.waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
  const snapshot = await page.evaluate(
    ({ simulatorWorkspace, maxDesktopHeight }) => {
      const text = document.body.innerText;
      const root = document.documentElement;
      const simulatorForm = simulatorWorkspace ? document.querySelector("main form") : null;
      const archiveSimulator = [
        "/app/simulacao/associativo-fluxo-linear",
        "/app/simulacao/tabelao",
        "/app/simulacao/tabela-direta",
        "/app/simulacao/tabela-investidor",
      ].includes(window.location.pathname);
      const topbarInner = document.querySelector("header > div");
      const brand = topbarInner?.firstElementChild;
      const navigation = document.querySelector('header nav[aria-label="Navegação principal"]');
      const mobileNavigationTrigger = document.querySelector(
        'header button[aria-controls="authorized-navigation"]',
      );
      const navigationSurface = navigation?.getClientRects().length
        ? navigation
        : mobileNavigationTrigger;
      const identity = document.querySelector("[data-session-identity]");
      const identityLabel = document.querySelector("[data-session-identity-label]");
      const accountPanel = document.querySelector("#protected-account-menu");
      const accountLink = accountPanel?.querySelector('a[href="/conta/seguranca"]');
      const themeSwitch = document.querySelector(
        '[role="group"][aria-label="Aparência da página"]',
      );
      const actions = identity?.parentElement?.parentElement;
      const actionChildren = [brand, navigationSurface, themeSwitch, identity, accountPanel].filter(
        (element) => element instanceof HTMLElement,
      );
      const elementLabel = (element, index) => {
        if (element === brand) return "brand";
        if (element === navigationSurface) return "navigation";
        if (element === identity) return "accountTrigger";
        if (element === accountPanel) return "accountPanel";
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
          first.getClientRects().length === 0 ||
          second.getClientRects().length === 0 ||
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
      const accountPanelBox = accountPanel?.getBoundingClientRect();
      const identityLabelBox = identityLabel?.getBoundingClientRect();
      const identityStyle = identityLabel ? getComputedStyle(identityLabel) : null;
      const navigationSurfaceBox = navigationSurface?.getBoundingClientRect();
      const navigationVisible = Boolean(navigation?.getClientRects().length);
      const themeButtons = themeSwitch ? [...themeSwitch.querySelectorAll("button")] : [];
      const blockedAction = simulatorForm?.querySelector('[data-cta-state="blocked"]');
      const associativeStock = document.querySelector(
        ".investor-associative-table-page .investor-stock-panel",
      );
      const stockFilters = associativeStock?.querySelector(".investor-stock-filters");
      const filterTitle = associativeStock?.querySelector(".investor-stock-title-row");
      const clearFilters = associativeStock?.querySelector(
        ".investor-stock-header-actions > button",
      );
      const firstFilter = stockFilters?.querySelector(":scope > label");
      const stockSync = associativeStock?.querySelector(".investor-stock-sync");
      const associativeClosing = document.querySelector(
        ".investor-associative-table-page .investor-page-closing",
      );
      const associativeDisclaimer = associativeClosing?.querySelector(".simulation-disclaimer");
      const associativeFooter = associativeClosing?.querySelector(".investor-page-footer");
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
        pageScrollHeight: Math.max(root.scrollHeight, document.body.scrollHeight),
        canvasDensityReady:
          root.clientWidth !== 1440 ||
          Math.max(root.scrollHeight, document.body.scrollHeight) <= maxDesktopHeight,
        hasBrokenValue: /\b(?:NaN|undefined)\b/.test(text),
        protectedShellPresent: navigation instanceof HTMLElement,
        loginPresent: Boolean(document.querySelector('input[name="password"]')),
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        topbarCollision: topbarCollisionPairs.length > 0,
        topbarCollisionPairs,
        navigationGeometryReady: Boolean(
          navigation instanceof HTMLElement &&
          navigation.id === "authorized-navigation" &&
          navigation.getAttribute("aria-label") === "Navegação principal" &&
          navigationSurface instanceof HTMLElement &&
          navigationSurfaceBox &&
          navigationSurfaceBox.width > 0 &&
          navigationSurfaceBox.height > 0 &&
          navigationSurfaceBox.left >= -1 &&
          navigationSurfaceBox.right <= innerWidth + 1 &&
          navigationSurfaceBox.top >= -1 &&
          navigationSurfaceBox.bottom <= innerHeight + 1 &&
          navigationSurface.scrollWidth <= navigationSurface.clientWidth + 1 &&
          (navigationVisible ||
            (mobileNavigationTrigger instanceof HTMLButtonElement &&
              mobileNavigationTrigger.getAttribute("aria-expanded") === "false" &&
              navigation.getAttribute("data-open") === "false")),
        ),
        accountMenuReady: Boolean(
          identity instanceof HTMLButtonElement &&
          accountPanel instanceof HTMLElement &&
          identityLabel instanceof HTMLElement &&
          accountLink instanceof HTMLElement &&
          identity.getAttribute("aria-controls") === accountPanel.id &&
          identity.getAttribute("aria-expanded") === "true" &&
          !accountPanel.hidden &&
          accountPanel.textContent?.includes("Conta conectada") &&
          identityLabel.textContent?.trim() &&
          identityStyle?.overflowWrap === "anywhere" &&
          accountPanelBox &&
          accountPanelBox.width > 0 &&
          accountPanelBox.height > 0 &&
          accountPanelBox.left >= -1 &&
          accountPanelBox.right <= innerWidth + 1 &&
          accountPanelBox.top >= -1 &&
          accountPanelBox.bottom <= innerHeight + 1 &&
          accountPanel.scrollWidth <= accountPanel.clientWidth + 1 &&
          identityLabelBox &&
          identityLabelBox.width > 0 &&
          identityLabelBox.left >= accountPanelBox.left - 1 &&
          identityLabelBox.right <= accountPanelBox.right + 1 &&
          identityLabel.scrollWidth <= identityLabel.clientWidth + 1 &&
          accountLink.getClientRects().length > 0,
        ),
        themeControlsVisible:
          (root.clientWidth > 600 &&
            ["Claro", "Médio", "Escuro"].every((label) =>
              themeButtons.some(
                (button) =>
                  button.textContent?.trim() === label && button.getClientRects().length > 0,
              ),
            )) ||
          (root.clientWidth <= 600 &&
            themeButtons.filter((button) => button.getClientRects().length > 0).length === 1 &&
            themeButtons.some(
              (button) =>
                button.hasAttribute("data-theme-cycle-mobile") &&
                button.getAttribute("aria-label")?.startsWith("Tema atual:"),
            )),
        associativeStockControlsPresent:
          window.location.pathname !== "/app/simulacao/associativo-fluxo-linear" ||
          Boolean(
            associativeStock &&
            stockFilters &&
            filterTitle &&
            clearFilters &&
            firstFilter &&
            stockSync,
          ),
        associativeStockCollision:
          rectanglesOverlap(filterTitle, clearFilters) ||
          rectanglesOverlap(stockSync, clearFilters) ||
          rectanglesOverlap(clearFilters, firstFilter) ||
          rectanglesOverlap(stockSync, stockFilters),
        associativeStockTouchTargetReady:
          !associativeStock ||
          root.clientWidth > 760 ||
          (clearFilters?.getBoundingClientRect().height ?? 0) >= 44,
        associativeClosingAligned:
          window.location.pathname !== "/app/simulacao/associativo-fluxo-linear" ||
          Boolean(
            associativeClosing &&
            associativeDisclaimer &&
            associativeFooter &&
            (root.clientWidth <= 760
              ? associativeFooter.getBoundingClientRect().top >=
                associativeDisclaimer.getBoundingClientRect().bottom
              : Math.abs(
                  associativeFooter.getBoundingClientRect().top -
                    associativeDisclaimer.getBoundingClientRect().top,
                ) <= 1),
          ),
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
    },
    {
      simulatorWorkspace: isSimulatorWorkspace,
      maxDesktopHeight: canvasDensityLimitByRoute.get(route) ?? defaultCanvasDensityLimit,
    },
  );
  Object.assign(
    snapshot,
    await page.evaluate(inspectAccountIdentityDisplay, expectedAccountFirstName),
  );
  await accountTrigger.click();
  await accountPanel.waitFor({ state: "hidden", timeout: qaRouteBootstrapTimeout });

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
    snapshot.navigationGeometryReady &&
    snapshot.canvasDensityReady &&
    snapshot.accountMenuReady &&
    snapshot.identityDisplayReady &&
    snapshot.themeControlsVisible &&
    snapshot.associativeStockControlsPresent &&
    !snapshot.associativeStockCollision &&
    snapshot.associativeStockTouchTargetReady &&
    snapshot.associativeClosingAligned &&
    simulatorStatePassed &&
    snapshot.unavailableActionDistinct &&
    consoleErrors.length === consoleStart &&
    pageErrors.length === pageErrorStart;

  return {
    route,
    approvedCanvas,
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
      const themeSwitch = page.getByRole("group", {
        name: "Aparência da página",
        exact: true,
      });
      await themeSwitch.waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
      if ((page.viewportSize()?.width ?? 1440) <= 600) {
        const cycle = themeSwitch.locator("[data-theme-cycle-mobile]");
        await cycle.waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
        for (let cycleAttempt = 0; cycleAttempt < themes.length; cycleAttempt += 1) {
          const current = await page.evaluate(() => document.documentElement.dataset.theme);
          if (current === theme) break;
          await cycle.click({ timeout: qaRouteBootstrapTimeout });
        }
      } else {
        for (const label of Object.values(themeLabels)) {
          await themeSwitch
            .getByRole("button", { name: label, exact: true })
            .waitFor({ state: "visible", timeout: qaRouteBootstrapTimeout });
        }
        await themeSwitch
          .getByRole("button", { name: themeLabels[theme], exact: true })
          .click({ timeout: qaRouteBootstrapTimeout });
      }
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
  const disclosure = page
    .locator('header button[data-navigation-root-control][aria-controls^="authorized-navigation-"]')
    .first();
  const disclosurePanelId = await disclosure.getAttribute("aria-controls");
  if (!disclosurePanelId) throw new Error("Navigation disclosure panel is missing.");
  const disclosurePanel = page.locator(`#${disclosurePanelId}`);
  await disclosure.focus();
  await page.keyboard.press("Enter");
  const opened =
    (await disclosure.getAttribute("aria-expanded")) === "true" &&
    (await disclosurePanel.isVisible());
  await page.keyboard.press("Escape");
  const closed =
    (await disclosure.getAttribute("aria-expanded")) === "false" &&
    (await disclosurePanel.isHidden());
  const focusReturned = await disclosure.evaluate((element) => document.activeElement === element);

  const accountTrigger = page.locator(
    'header button[data-session-identity][aria-controls="protected-account-menu"]',
  );
  const accountPanel = page.locator("#protected-account-menu");
  await accountTrigger.focus();
  await page.keyboard.press("Enter");
  const accountOpened =
    (await accountTrigger.getAttribute("aria-expanded")) === "true" &&
    (await accountPanel.isVisible());
  await page.keyboard.press("Escape");
  const accountClosed =
    (await accountTrigger.getAttribute("aria-expanded")) === "false" &&
    (await accountPanel.isHidden());
  const accountFocusReturned = await accountTrigger.evaluate(
    (element) => document.activeElement === element,
  );

  // The account trigger is the last control in the sticky topbar. Walk backward
  // to prove the keyboard sequence remains connected to the preceding theme/nav
  // controls instead of depending on whether the current page has a later CTA.
  await page.keyboard.press("Shift+Tab");
  const tabReachedInteractive = await page.evaluate(() =>
    document.activeElement?.matches("a, button, input, select, textarea"),
  );

  return {
    opened: Boolean(opened),
    closed: Boolean(closed),
    focusReturned,
    accountOpened: Boolean(accountOpened),
    accountClosed: Boolean(accountClosed),
    accountFocusReturned,
    tabReachedInteractive,
  };
}

async function checkDeferredInventory(page, origin, proposalStarted = false) {
  let releaseLiveInventory;
  const liveInventoryGate = new Promise((resolve) => {
    releaseLiveInventory = resolve;
  });
  const liveInventoryUrl = `${origin}/api/inventory`;
  const source = JSON.parse(syntheticDirectTableSnapshot);
  const liveItems = proposalStarted
    ? source.items.filter((item) => item.id !== "qa-stock-0001")
    : source.items;
  const deferredLiveInventory = async (route) => {
    await liveInventoryGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...source,
        items: liveItems,
        count: liveItems.length,
        sourceKind: "live",
        generatedAt: "2026-09-28T12:00:00.000Z",
      }),
    });
  };
  await page.route(liveInventoryUrl, deferredLiveInventory);
  // Release on failures too, so a failed assertion cannot leave a pending route.
  try {
    await gotoWithServerRetry(page, `${origin}/app/simulacao/associativo-fluxo-linear`, {
      waitUntil: "domcontentloaded",
    });
    const projectFilter = page.getByRole("combobox", {
      name: "Nome do Empreendimento",
      exact: true,
    });
    await projectFilter.selectOption("Empreendimento QA 01");
    if (proposalStarted) {
      const unit = page.getByRole("button", { name: "Iniciar proposta com QA-0001", exact: true });
      await unit.click();
      const income = page.getByRole("textbox", { name: "Renda Familiar", exact: true });
      await income.fill("500000");
      await page.getByRole("button", { name: "MCMV", exact: true }).click();
      await page.getByRole("radio", { name: "Sim", exact: true }).check();
      const financing = page.getByRole("textbox", { name: "Financiamento", exact: true });
      await financing.fill("19000000");
      const before = [await income.inputValue(), await financing.inputValue()];
      const responsePromise = page.waitForResponse(liveInventoryUrl);
      releaseLiveInventory();
      await (await responsePromise).finished();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      return (
        (await unit.getAttribute("aria-pressed")) === "true" &&
        (await income.isVisible()) &&
        (await financing.isVisible()) &&
        JSON.stringify(before) ===
          JSON.stringify([await income.inputValue(), await financing.inputValue()]) &&
        (await page.locator(".investor-stock-sync").innerText()).includes("Arquivo")
      );
    }
    await page
      .getByRole("combobox", { name: "Ordenar unidades por valor do imóvel", exact: true })
      .selectOption("desc");
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await projectFilter.selectOption("Empreendimento QA 01");
    releaseLiveInventory();
    await page.waitForFunction(() =>
      document.querySelector(".investor-stock-sync")?.textContent?.includes("Atualizado"),
    );
    return (await projectFilter.inputValue()) === "Empreendimento QA 01";
  } finally {
    releaseLiveInventory();
    await page.unroute(liveInventoryUrl, deferredLiveInventory);
  }
}

async function checkSimulatorValidation(page, origin, httpCredentials) {
  const lateLivePreservesProposal = await checkDeferredInventory(page, origin, true);
  const liveRefreshAfterFiltering = await checkDeferredInventory(page, origin);
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

  // Use the project that contains the synthetic ready-proposal reference.
  // Both protected inventory endpoints are intercepted by the same isolated
  // fixture, so no mutable live feed or commercial field enters this evidence.
  const projectFilter = page.getByRole("combobox", {
    name: "Nome do Empreendimento",
    exact: true,
  });
  await projectFilter.selectOption("Empreendimento QA 01");
  await page.waitForFunction(
    () => document.querySelector(".investor-stock-table")?.getAttribute("aria-rowcount") === "552",
  );
  await page
    .getByRole("region", { name: "Estoque completo de unidades", exact: true })
    .evaluate((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
  const readyProposalUnitButton = page.getByRole("button", {
    name: "Iniciar proposta com QA-0001",
    exact: true,
  });
  await readyProposalUnitButton.waitFor({
    state: "visible",
  });
  await readyProposalUnitButton.click();
  await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).fill("500000");
  await page.getByRole("button", { name: "MCMV", exact: true }).click();
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
  await rankingSelect.selectOption("gold");

  const proposalInputs = [
    page.getByRole("textbox", { name: "Renda Familiar", exact: true }),
    financingInput,
    subsidyInput,
    fgtsInput,
    housingCheckInput,
    entryInput,
    installmentsInput,
  ];
  const proposalBeforeFiltering = await Promise.all(
    proposalInputs.map((input) => input.inputValue()),
  );
  await projectFilter.selectOption("Empreendimento QA 02");
  await page.waitForFunction(
    () => !document.querySelector('.investor-stock-unit-button[aria-pressed="true"]'),
  );
  const filteredProposalValues = await Promise.all(
    proposalInputs.map((input) => input.inputValue()),
  );
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await page
    .getByRole("button", { name: "Iniciar proposta com QA-0001", exact: true })
    .waitFor({ state: "visible" });
  const filterPreservesAssociativeProposal =
    JSON.stringify(proposalBeforeFiltering) === JSON.stringify(filteredProposalValues) &&
    JSON.stringify(proposalBeforeFiltering) ===
      JSON.stringify(await Promise.all(proposalInputs.map((input) => input.inputValue()))) &&
    (await page
      .getByRole("button", { name: "Iniciar proposta com QA-0001", exact: true })
      .getAttribute("aria-pressed")) === "true" &&
    (await rankingSelect.inputValue()) === "gold";

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
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-associative-ready-proposal")
      ?.textContent?.includes("PROPOSTA PRONTA"),
  );
  const readyProposalAppraisalAutomatic = await readyProposalDialog.evaluate((dialog) => {
    const appraisal = dialog.querySelector(".investor-associative-ready-proposal-appraisal-value");
    const appraisalInput = dialog.querySelector(
      'input[aria-label="Avaliação bancária da proposta"]',
    );
    return (
      appraisal?.querySelector("small")?.textContent?.trim() === "Automática" &&
      appraisal?.querySelector("b")?.textContent?.trim() === "R$" &&
      appraisal?.querySelector("strong")?.textContent?.trim() === "350.000,00" &&
      appraisal?.getAttribute("aria-label")?.replace(/\s+/g, " ") ===
        "Avaliação bancária automática: R$ 350.000,00" &&
      appraisalInput === null
    );
  });
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
      !(dialog.textContent || "").includes("Comissão apartada") &&
      !dialog.querySelector("[data-model='separated-commission']") &&
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
  await entryInput.fill("1500000");
  await page.getByRole("button", { name: "Abrir remuneração comercial", exact: true }).click();
  const commissionDialog = page.getByRole("dialog", {
    name: "Comissão + Prêmio da venda",
    exact: true,
  });
  await commissionDialog
    .getByRole("combobox", { name: "Canal de venda", exact: true })
    .selectOption("Imobiliária");
  await commissionDialog
    .getByRole("combobox", { name: "Classificação", exact: true })
    .selectOption("Ouro");
  await commissionDialog
    .getByRole("button", { name: "Fechar comissão e prêmio", exact: true })
    .click();
  await readyProposalButton.click();
  await readyProposalDialogElement.waitFor({ state: "visible" });
  const readyProposalSeparatedCommissionVisible = await readyProposalDialog.evaluate((dialog) => {
    const rowFor = (label) =>
      [...dialog.querySelectorAll("tbody tr")].find(
        (row) => row.querySelector("th")?.textContent?.trim() === label,
      );
    const valueFor = (label, model) =>
      rowFor(label)?.querySelector(`[data-model='${model}']`)?.textContent?.trim();
    return (
      dialog.classList.contains("has-separated-commission") &&
      (dialog.textContent || "").includes("Comissão apartada") &&
      valueFor("Desconto", "proposal-invoiced") === "102.500,00" &&
      valueFor("Desconto", "separated-commission") === "88.150,00" &&
      valueFor("Sinal COM / prêmio", "proposal-invoiced") === "" &&
      valueFor("Sinal COM / prêmio", "separated-commission") === "14.350,00"
    );
  });
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
      const responsiveMeasurement = await snapshotPage.locator("dialog").evaluate((dialog) => {
        const dialogBox = dialog.getBoundingClientRect();
        const tableRegion = dialog.querySelector(".investor-associative-ready-proposal-table-wrap");
        const rowLabels = [
          ...dialog.querySelectorAll(".investor-associative-ready-proposal-sheet th"),
        ];
        const rows = [
          ...dialog.querySelectorAll(".investor-associative-ready-proposal-sheet tbody tr"),
        ];
        const usesCompactDesktopSize =
          window.innerWidth < 481 ||
          (Math.abs(dialogBox.width - Math.min(1180, window.innerWidth - 28)) <= 8 &&
            rows.every((row) => row.getBoundingClientRect().height <= 25));
        return {
          passed:
            dialogBox.left >= 0 &&
            dialogBox.right <= window.innerWidth &&
            dialogBox.top >= 0 &&
            dialogBox.bottom <= window.innerHeight &&
            dialog.scrollWidth <= dialog.clientWidth + 1 &&
            tableRegion &&
            tableRegion.scrollWidth <= tableRegion.clientWidth + 1 &&
            rowLabels.every((label) => label.scrollWidth <= label.clientWidth + 1) &&
            usesCompactDesktopSize,
          dialogOverflow: dialog.scrollWidth - dialog.clientWidth,
          tableOverflow: tableRegion ? tableRegion.scrollWidth - tableRegion.clientWidth : null,
          truncatedLabels: rowLabels
            .filter((label) => label.scrollWidth > label.clientWidth + 1)
            .map((label) => label.textContent?.trim()),
          width: dialogBox.width,
          maximumRowHeight: Math.max(...rows.map((row) => row.getBoundingClientRect().height)),
        };
      });
      readyProposalResponsiveChecks.push(responsiveMeasurement.passed);
      process.stdout.write(
        `Ready proposal QA: ${viewport.key} measured ${JSON.stringify(responsiveMeasurement)}\n`,
      );
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

  await projectFilter.selectOption("Todos");
  await page.waitForFunction(
    () => document.querySelector(".investor-stock-table")?.getAttribute("aria-rowcount") === "3302",
  );
  await projectFilter.selectOption("Empreendimento QA 01");
  await page.waitForFunction(
    () => document.querySelector(".investor-stock-table")?.getAttribute("aria-rowcount") === "552",
  );
  await page
    .getByRole("region", { name: "Estoque completo de unidades", exact: true })
    .evaluate((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
  const missingAppraisalUnitButton = page.getByRole("button", {
    name: "Iniciar proposta com QA-0007",
    exact: true,
  });
  await missingAppraisalUnitButton.waitFor({ state: "visible" });
  await missingAppraisalUnitButton.click();
  await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).fill("500000");
  await page.getByRole("button", { name: "MCMV", exact: true }).click();
  await page.getByRole("radio", { name: "Sim", exact: true }).check();
  await page.getByRole("textbox", { name: "Financiamento", exact: true }).fill("19000000");
  await page.getByRole("textbox", { name: "Subsídio", exact: true }).fill("0");
  await page.getByRole("textbox", { name: "FGTS", exact: true }).fill("0");
  await page.getByRole("textbox", { name: "Cheque Moradia", exact: true }).fill("0");
  await page.getByRole("textbox", { name: "Entrada", exact: true }).fill("100000");
  await page.locator('input[name="quantidade-de-parcelas"]').fill("84");
  await page
    .getByRole("combobox", { name: "Selecione o Ranking", exact: true })
    .selectOption("gold");
  await readyProposalButton.click();
  await readyProposalDialogElement.waitFor({ state: "visible" });
  const fallbackAppraisalInput = readyProposalDialog.getByRole("textbox", {
    name: "Avaliação bancária da proposta",
    exact: true,
  });
  await fallbackAppraisalInput.fill("35000000");
  await page.waitForFunction(() =>
    document
      .querySelector("#investor-associative-ready-proposal")
      ?.textContent?.includes("PROPOSTA PRONTA"),
  );
  const readyProposalAppraisalFallback =
    (await fallbackAppraisalInput.inputValue()) === "350.000,00" &&
    (await readyProposalDialog
      .locator(".investor-associative-ready-proposal-appraisal-value")
      .count()) === 0;
  process.stdout.write(
    `Ready proposal appraisal QA: automatic=${readyProposalAppraisalAutomatic} fallback=${readyProposalAppraisalFallback}\n`,
  );
  await readyProposalDialog
    .getByRole("button", { name: "Fechar proposta pronta", exact: true })
    .click();
  await readyProposalDialogElement.waitFor({ state: "hidden" });

  const learningManualAccessible = await checkAssociativeLearningManual(page, artifactRoot);

  return {
    ...initialChecks,
    learningManualAccessible,
    lateLivePreservesProposal,
    liveRefreshAfterFiltering,
    filterPreservesAssociativeProposal,
    financingFocusedAfterProfile,
    optionalPaymentsUnlockedAfterProfile,
    readyProposalButtonEnabled,
    readyProposalButtonPlacedAfterInstallments,
    releaseStatusUsesSingleDesktopRow,
    readyProposalAppraisalAutomatic,
    readyProposalAppraisalFallback,
    readyProposalDialogComplete,
    readyProposalDesktopFits,
    readyProposalHelpAccessible,
    readyProposalSeparatedCommissionVisible,
    readyProposalResponsive,
  };
}

function buildTabelaoCompactFixture() {
  const project = "Residencial QA Alameda das Flores do Horizonte";
  const street = "Avenida QA das Palmeiras e Jardins do Horizonte";
  const classification = "Programa residencial especial";
  const items = Array.from({ length: 10 }, (_, index) => ({
    id: `qa-compact-${index + 1}`,
    identifier: String(index + 1),
    businessUnit: index < 7 ? "Incorporadora QA A" : "Incorporadora QA B",
    project: index < 9 ? project : "Residencial QA Outro Horizonte",
    product: `Apartamento QA ${index + 1}`,
    plant: `Tipo ${String(index + 1).padStart(2, "0")}`,
    privateArea: 42 + index,
    finalWithKit: 300_000 + index * 1_000,
    unitBonus: 10_000,
    tableSlack: 5_000,
    cashBackSlack: 3_000,
    appraisal: 330_000,
    completionDate: "2027-12-01",
    progress: 0.5,
    street: index === 2 ? `${street} II` : index === 1 ? ` ${street} ` : street,
    streetNumber: "1234",
    neighborhood: "Bairro QA Jardim Central",
    region: index === 2 || index === 3 ? "Zona Norte" : "Zona Sul",
    parkingSpaces: index === 2 || index === 3 ? 1 : 0,
    classification:
      index < 3
        ? index === 1
          ? ` ${classification} `
          : classification
        : index === 3
          ? classification.toLowerCase()
          : index === 4
            ? ""
            : index === 5
              ? "0"
              : null,
  }));
  // The more expensive unit must affect stock quantity, never replace the winning plant.
  items.push({ ...items[0], id: "qa-compact-expensive", finalWithKit: 900_000 });
  return items;
}

async function checkTabelaoRegionParkingFixture(page) {
  const base = {
    businessUnit: "Incorporadora QA",
    product: "Unidade QA",
    plant: "Tipo 2Q",
    privateArea: 42,
    finalWithKit: 300_000,
    unitBonus: 10_000,
    tableSlack: 5_000,
    cashBackSlack: 10_000,
    appraisal: 350_000,
    progress: 0.5,
    completionDate: "2029-12-31",
    classification: "QA",
    street: "Rua QA",
    streetNumber: "100",
    neighborhood: "Bairro QA",
  };
  const items = [
    ...[0, 1, 2, null].map((parkingSpaces, index) => ({
      ...base,
      id: `qa-parking-a${index}`,
      project: "Projeto A",
      postalCode: "01001000",
      parkingSpaces,
      finalWithKit: 300_000 + index * 10_000,
    })),
    {
      ...base,
      id: "qa-parking-expensive",
      project: "Projeto A",
      postalCode: "01001000",
      parkingSpaces: 1,
      finalWithKit: 500_000,
    },
    { ...base, id: "qa-parking-b", project: "Projeto B", postalCode: "02001000", parkingSpaces: 1 },
    { ...base, id: "qa-parking-c", project: "Projeto C", postalCode: "03001000", parkingSpaces: 0 },
  ];
  let releaseRegions;
  const gate = new Promise((resolve) => {
    releaseRegions = resolve;
  });
  const requested = [];
  let regionRequestCount = 0;
  const inventoryHandler = (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: items.length, items }),
    });
  const regionHandler = async (route) => {
    const postalCodes = new URL(route.request().url()).searchParams.get("postalCodes").split(",");
    requested.push(...postalCodes);
    regionRequestCount += 1;
    await gate;
    const results = postalCodes.map((postalCode) => {
      const region =
        postalCode === "01001000" ? "Centro" : postalCode === "02001000" ? "Zona Norte" : null;
      return {
        postalCode,
        region,
        status: region ? "confirmed" : "unconfirmed",
        reason: region ? "single-region-for-postal-code" : "ambiguous-postal-code",
        municipality: "São Paulo",
        state: "SP",
        districts: ["Distrito QA"],
        checkedAt: "2026-10-01T12:00:00.000Z",
        source: "viacep+localizasampa+geosampa",
      };
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results }),
    });
  };
  await page.route("**/api/inventory", inventoryHandler);
  await page.route("**/api/inventory/regions?*", regionHandler);
  let passed = true;
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 6,
    );
    const filters = page.locator(".investor-stock-filters");
    const parking = filters.locator('select[name="parkingSpaces"]');
    passed &&=
      JSON.stringify(
        await parking
          .locator("option")
          .evaluateAll((options) => options.map((option) => option.value)),
      ) === JSON.stringify(["", "0", "1", "2", "unknown"]);
    await filters.locator('select[name="region"]').selectOption("localizando");
    await filters.locator('select[name="project"]').selectOption("projeto a");
    await parking.selectOption("1");
    await filters.locator('select[name="priceOrder"]').selectOption("desc");
    await page.waitForFunction(
      () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 1,
    );
    passed &&= await page.locator('tr[data-inventory-unit-id="qa-parking-a1"]').isVisible();
    passed &&= (await page.locator(".tabelao-stock-quantity").textContent()).trim() === "2";
    releaseRegions();
    await page
      .getByText("Nenhuma opção encontrada com esses filtros.", { exact: true })
      .last()
      .waitFor();
    passed &&= (await filters.locator('select[name="region"]').inputValue()) === "localizando";
    passed &&=
      (await filters.locator('select[name="region"] option:checked').textContent()).trim() ===
      "Localizando (0)";
    passed &&= (await parking.inputValue()) === "1";
    passed &&= (await filters.locator('select[name="project"]').inputValue()) === "projeto a";
    passed &&= (await filters.locator('select[name="priceOrder"]').inputValue()) === "desc";
    await filters.locator('select[name="region"]').selectOption("");
    await page.locator('tr[data-inventory-unit-id="qa-parking-a1"]').waitFor();
    passed &&=
      (await page.locator("tr[data-inventory-unit-id]").getAttribute("data-inventory-region")) ===
      "Centro";
    passed &&=
      (await page.locator(".investor-stock-price").textContent()).replace(/\D/g, "") === "29500000";
    await filters.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await filters.locator('select[name="region"]').selectOption("zona norte");
    await page.locator('tr[data-inventory-unit-id="qa-parking-b"]').waitFor();
    passed &&= (await page.locator("tr[data-inventory-unit-id]").count()) === 1;
    await filters.locator('select[name="region"]').selectOption("localizacao indisponivel");
    await page.locator('tr[data-inventory-unit-id="qa-parking-c"]').waitFor();
    passed &&= (await page.locator("tr[data-inventory-unit-id]").count()) === 1;
    await filters.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 6,
    );
    passed &&= requested.length === 3 && new Set(requested).size === 3 && regionRequestCount === 1;
    passed &&= !(await page.locator(".investor-stock-panel").textContent()).includes(
      "Não confirmada",
    );
    process.stdout.write(`Tabelão QA: regiões assíncronas e vagas ${passed}\n`);
    return passed;
  } finally {
    releaseRegions();
    await page.unroute("**/api/inventory/regions?*", regionHandler);
    await page.unroute("**/api/inventory", inventoryHandler);
  }
}

function readTabelaoCompactLayout() {
  const results = document.querySelector(".investor-stock-results");
  const table = document.querySelector(".investor-stock-table");
  const resultBox = results?.getBoundingClientRect();
  const tableBox = table?.getBoundingClientRect();
  const panelBox = results?.closest(".investor-stock-panel")?.getBoundingClientRect();
  const expectedHeaders = [
    "Região",
    "Empresa",
    "Empreendimento",
    "Endereço",
    "Metragem",
    "Entrega",
    "Planta",
    "Vagas",
    "Estoque",
    "Valor do Imóvel",
    "Volta ao Caixa",
    "Avaliação",
    "% obra",
    "Limitador",
  ];
  const headers = [...table.querySelectorAll("thead th")];
  const expectedFilters = [
    ["businessUnit", "Empresa"],
    ["project", "Nome do empreendimento"],
    ["region", "Região"],
    ["plant", "Planta"],
    ["parkingSpaces", "Quantidade de vagas"],
    ["price", "Valor do imóvel"],
    ["priceOrder", "Ordenar valor"],
  ];
  const columns = [
    ["tabelao-region", ".tabelao-region-vertical, .tabelao-stock-wrapped-text", 0.045],
    ["tabelao-project", ".investor-stock-product-text", 0.11],
    ["tabelao-address", ".tabelao-stock-wrapped-text", 0.12],
    ["tabelao-plant", ".tabelao-stock-plant-text", 0.065],
    ["tabelao-parking", ".tabelao-stock-wrapped-text", 0.04],
    ["tabelao-description", ".tabelao-stock-wrapped-text", 0.07],
  ].map(([id, selector, proportion]) => {
    const header = document.getElementById(id);
    const cells = [...document.querySelectorAll(`[headers~="${id}"]`)];
    return {
      id,
      width: header?.getBoundingClientRect().width ?? 0,
      fontSize: cells[0] ? getComputedStyle(cells[0]).fontSize : null,
      bounded:
        cells.length > 0 &&
        cells.every((cell) => {
          const wrapper = cell.querySelector(selector);
          const style = getComputedStyle(cell);
          const contentWidth =
            cell.clientWidth -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight);
          return (
            wrapper != null &&
            wrapper.getBoundingClientRect().width > 0 &&
            wrapper.getBoundingClientRect().width <= contentWidth + 1 &&
            Math.abs(header.getBoundingClientRect().width - tableBox.width * proportion) <= 2
          );
        }),
      wrapsWithoutClipping:
        cells.length > 0 &&
        cells.every((cell) => {
          const wrapper = cell.querySelector(selector);
          if (!wrapper) return false;
          const range = document.createRange();
          range.selectNodeContents(wrapper);
          const box = wrapper.getBoundingClientRect();
          const cellBox = cell.getBoundingClientRect();
          const style = getComputedStyle(wrapper);
          return (
            (wrapper.matches(".tabelao-region-vertical") ||
              (style.whiteSpace === (id === "tabelao-plant" ? "pre-line" : "normal") &&
                style.overflowWrap === "anywhere")) &&
            style.textOverflow !== "ellipsis" &&
            style.webkitLineClamp === "none" &&
            style.overflowX === "visible" &&
            style.overflowY === "visible" &&
            wrapper.scrollWidth <= wrapper.clientWidth + 1 &&
            wrapper.scrollHeight <= wrapper.clientHeight + 1 &&
            box.top >= cellBox.top - 1 &&
            box.bottom <= cellBox.bottom + 1 &&
            [...range.getClientRects()].every(
              (rect) =>
                rect.left >= box.left - 1 &&
                rect.right <= box.right + 1 &&
                rect.top >= box.top - 1 &&
                rect.bottom <= box.bottom + 1,
            )
          );
        }),
    };
  });
  return {
    columns,
    localizedLabels:
      headers.length === expectedHeaders.length &&
      headers.every((header, index) => header.textContent.trim() === expectedHeaders[index]) &&
      [
        ["tabelao-delivery", "Data de entrega"],
        ["tabelao-cashback", "Folga volta ao caixa"],
        ["tabelao-appraisal", "Valor de avaliação bancária"],
        ["tabelao-address", "Logradouro da obra / Número / Bairro"],
      ].every(([id, label]) => document.getElementById(id).getAttribute("aria-label") === label),
    localizedFilters:
      document.querySelectorAll(".investor-stock-filters select").length === 7 &&
      expectedFilters.every(([name, label]) => {
        const select = document.querySelector(`.investor-stock-filters select[name="${name}"]`);
        return (
          select?.closest("label")?.querySelector("span")?.textContent.trim() === label &&
          select.getAttribute("aria-label") ===
            (name === "priceOrder" ? "Ordenar unidades por valor do imóvel" : label)
        );
      }),
    columnsAligned: [...table.querySelectorAll("tbody th, tbody td")].every((cell) => {
      const header = document.getElementById(cell.headers.split(/\s+/)[0]);
      if (!header) return false;
      const cellBox = cell.getBoundingClientRect();
      const headerBox = header.getBoundingClientRect();
      return (
        Math.abs(cellBox.left - headerBox.left) <= 1 &&
        Math.abs(cellBox.width - headerBox.width) <= 1
      );
    }),
    compactFrameInsidePanel:
      resultBox != null &&
      panelBox != null &&
      resultBox.left >= panelBox.left &&
      resultBox.right <= panelBox.right,
    compactFrameFitsTable:
      results != null &&
      table != null &&
      results.clientWidth <= table.getBoundingClientRect().width + 1,
    compactColumnWidths: columns.every((column) => column.bounded),
    compactTextFullyVisible: columns.every((column) => column.wrapsWithoutClipping),
    readableText: [...table.querySelectorAll("th, td")].every(
      (cell) => getComputedStyle(cell).fontSize === "11px",
    ),
    headersSingleLine: [...table.querySelectorAll("thead th")].every((header) => {
      const style = getComputedStyle(header);
      const range = document.createRange();
      range.selectNodeContents(header);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      const box = header.getBoundingClientRect();
      return (
        style.whiteSpace === "nowrap" &&
        style.textTransform === "none" &&
        style.fontSize === "11px" &&
        rects.length === 1 &&
        rects[0].left >= box.left - 1 &&
        rects[0].right <= box.right + 1 &&
        rects[0].top >= box.top - 1 &&
        rects[0].bottom <= box.bottom + 1
      );
    }),
    adjustedColumnProportions: [
      ["tabelao-region", 0.045],
      ["tabelao-area", 0.06],
      ["tabelao-plant", 0.065],
      ["tabelao-parking", 0.04],
      ["tabelao-quantity", 0.05],
    ].every(
      ([id, proportion]) =>
        Math.abs(
          document.getElementById(id).getBoundingClientRect().width - tableBox.width * proportion,
        ) <= 2,
    ),
    desktopFitsWithoutHorizontalScroll:
      innerWidth < 1280 ||
      (results.scrollWidth <= results.clientWidth + 1 &&
        tableBox.width <= results.clientWidth + 1 &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    desktopLimitadorVisible:
      innerWidth < 1280 ||
      (results.scrollLeft === 0 &&
        [...table.querySelectorAll('#tabelao-description, [headers~="tabelao-description"]')].every(
          (cell) => {
            const box = cell.getBoundingClientRect();
            return (
              box.width > 0 &&
              box.left >= resultBox.left - 1 &&
              box.right <= resultBox.right + 1 &&
              box.right <= document.documentElement.clientWidth
            );
          },
        )),
  };
}

function readTabelaoVerticalRegions() {
  const cells = [...document.querySelectorAll('[headers~="tabelao-region"]')];
  const regions = new Set();
  const valid =
    cells.length > 0 &&
    cells.every((cell) => {
      const region = cell.closest("tr")?.dataset.inventoryRegion;
      if (!["Zona Leste", "Zona Sul", "Zona Norte", "Zona Oeste", "Centro"].includes(region))
        return false;
      regions.add(region);
      const wrapper = cell.querySelector(".tabelao-region-vertical");
      const accessible = cell.querySelector(".sr-only");
      if (
        !wrapper ||
        wrapper.getAttribute("aria-hidden") !== "true" ||
        accessible?.textContent !== region
      )
        return false;
      const words = [...wrapper.children];
      const expected = region.split(" ");
      const cellBox = cell.getBoundingClientRect();
      return (
        words.length === expected.length &&
        words.every((word, index) => {
          const style = getComputedStyle(word);
          const box = word.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(word);
          const previousText = document.createRange();
          if (index > 0) previousText.selectNodeContents(words[index - 1]);
          return (
            word.textContent === expected[index] &&
            style.writingMode === "vertical-lr" &&
            style.textOrientation === "upright" &&
            style.transform === "none" &&
            box.height > box.width &&
            box.top >= cellBox.top - 1 &&
            box.bottom <= cellBox.bottom + 1 &&
            box.left >= cellBox.left - 1 &&
            box.right <= cellBox.right + 1 &&
            (index === 0 ||
              range.getBoundingClientRect().left >=
                previousText.getBoundingClientRect().right - 1) &&
            // Glyph ink can exceed the inline line box; the visible cell remains the boundary.
            [...range.getClientRects()].every(
              (rect) =>
                rect.top >= cellBox.top - 1 &&
                rect.bottom <= cellBox.bottom + 1 &&
                rect.left >= cellBox.left - 1 &&
                rect.right <= cellBox.right + 1,
            )
          );
        })
      );
    });
  return valid && regions.size === 5;
}

function readTabelaoPinnedHeader() {
  const table = document.querySelector(".investor-stock-table");
  const results = document.querySelector(".investor-stock-results");
  const navigation = document.querySelector("[data-protected-topbar]");
  const headers = [...(table?.querySelectorAll("thead th") ?? [])];
  const navigationBox = navigation?.getBoundingClientRect();
  const tableBox = table?.getBoundingClientRect();
  const frameBox = results?.getBoundingClientRect();
  const clientLeft = frameBox.left + results.clientLeft;
  const clientRight = clientLeft + results.clientWidth;
  const visibleTop = Math.max(0, navigationBox?.bottom ?? 0);
  return (
    navigationBox != null &&
    headers.length === 14 &&
    window.scrollY > 0 &&
    tableBox.top < visibleTop &&
    results.scrollTop === 0 &&
    headers.every((header) => {
      const box = header.getBoundingClientRect();
      if (Math.abs(box.top - visibleTop) > 2 || box.bottom > tableBox.bottom + 1) return false;
      const left = Math.max(box.left, clientLeft, 0);
      const right = Math.min(box.right, clientRight, innerWidth);
      if (right <= left) return true;
      const hit = document.elementFromPoint((left + right) / 2, box.top + box.height / 2);
      return hit === header || header.contains(hit);
    })
  );
}

async function checkTabelaoHeaderScrolling(page) {
  let pinned = true;
  for (const fraction of [0.25, 0.65]) {
    await page.evaluate(async (position) => {
      const tableBox = document.querySelector(".investor-stock-table").getBoundingClientRect();
      window.scrollTo(0, scrollY + tableBox.top + tableBox.height * position);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, fraction);
    pinned = (await page.evaluate(readTabelaoPinnedHeader)) && pinned;
  }
  await page.locator(".investor-stock-results").evaluate(async (results) => {
    results.scrollLeft = results.scrollWidth - results.clientWidth;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  pinned = (await page.evaluate(readTabelaoPinnedHeader)) && pinned;
  await page.evaluate(async () => {
    document.querySelector(".investor-stock-results").scrollLeft = 0;
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const reset = await page.evaluate(() => {
    const table = document.querySelector(".investor-stock-table");
    const top = table.tHead.getBoundingClientRect().top;
    return [...table.querySelectorAll("thead th")].every(
      (header) => Math.abs(header.getBoundingClientRect().top - top) <= 2,
    );
  });
  return pinned && reset;
}

async function checkTabelaoRegionOrderFixture(page, viewports) {
  const regions = ["Zona Leste", "Zona Sul", "Zona Norte", "Zona Oeste", "Centro"];
  const projects = ["Álamo", "Projeto 2", "Projeto 10"];
  const base = buildTabelaoCompactFixture()[0];
  const orderedItems = regions.flatMap((region, regionIndex) =>
    projects.flatMap((project, projectIndex) =>
      [0, 1].map((priceIndex) => ({
        ...base,
        id: `qa-region-${regionIndex}-${projectIndex}-${priceIndex}`,
        businessUnit: "Incorporadora QA",
        project,
        plant: `Tipo ${regionIndex + 1}.${priceIndex + 1}`,
        postalCode: `0100100${regionIndex + 1}`,
        finalWithKit: 300_000 + priceIndex * 10_000,
        // Misleading legacy labels must not override the authenticated resolution.
        region: regions[(regionIndex + 1) % regions.length],
      })),
    ),
  );
  const inventoryHandler = (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: orderedItems.length, items: [...orderedItems].reverse() }),
    });
  const regionHandler = (route) => {
    const postalCodes = new URL(route.request().url()).searchParams.get("postalCodes").split(",");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: postalCodes.map((postalCode) => ({
          postalCode,
          region: regions[Number(postalCode.at(-1)) - 1],
          status: "confirmed",
          reason: "single-region-for-postal-code",
          municipality: "São Paulo",
          state: "SP",
          districts: ["Distrito QA"],
          checkedAt: "2026-10-02T12:00:00.000Z",
          source: "viacep+localizasampa+geosampa",
        })),
      }),
    });
  };
  await page.route("**/api/inventory", inventoryHandler);
  await page.route("**/api/inventory/regions?*", regionHandler);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction((count) => {
      const rows = [...document.querySelectorAll("tr[data-inventory-unit-id]")];
      return (
        rows.length === count &&
        rows.every((row) =>
          ["Zona Leste", "Zona Sul", "Zona Norte", "Zona Oeste", "Centro"].includes(
            row.dataset.inventoryRegion,
          ),
        )
      );
    }, orderedItems.length);
    const filters = page.locator(".investor-stock-filters");
    const readOrder = () =>
      page
        .locator("tr[data-inventory-unit-id]")
        .evaluateAll((rows) => rows.map((row) => row.dataset.inventoryUnitId));
    const expectedAsc = orderedItems.map((item) => item.id);
    const expectedDesc = regions.flatMap((_, regionIndex) =>
      projects.flatMap((_, projectIndex) =>
        [1, 0].map((priceIndex) => `qa-region-${regionIndex}-${projectIndex}-${priceIndex}`),
      ),
    );
    const regionFacets = await filters
      .locator('select[name="region"] option')
      .evaluateAll((options) =>
        options.filter((option) => option.value).map((option) => option.textContent.trim()),
      );
    let ordered = JSON.stringify(await readOrder()) === JSON.stringify(expectedAsc);
    ordered &&=
      JSON.stringify(regionFacets) === JSON.stringify(regions.map((region) => `${region} (6)`));
    ordered &&= await page.locator(".tabelao-project-group").evaluateAll(
      (groups) =>
        groups.length === 15 &&
        groups.every((group) => {
          const rows = [...group.rows];
          return (
            rows.length === 2 &&
            new Set(rows.map((row) => row.dataset.inventoryRegion)).size === 1 &&
            [...group.querySelectorAll('th[scope="rowgroup"]')].every((cell) => cell.rowSpan === 2)
          );
        }),
    );
    await filters.locator('select[name="priceOrder"]').selectOption("desc");
    ordered &&= JSON.stringify(await readOrder()) === JSON.stringify(expectedDesc);
    await filters.locator('select[name="region"]').selectOption("zona sul");
    ordered &&= JSON.stringify(await readOrder()) === JSON.stringify(expectedDesc.slice(6, 12));
    await filters.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    ordered &&= JSON.stringify(await readOrder()) === JSON.stringify(expectedAsc);
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const vertical = await page.evaluate(readTabelaoVerticalRegions);
      const layout = await page.evaluate(readTabelaoCompactLayout);
      const sticky = await checkTabelaoHeaderScrolling(page);
      const passed =
        vertical &&
        sticky &&
        layout.compactColumnWidths &&
        layout.compactTextFullyVisible &&
        layout.columnsAligned &&
        layout.readableText &&
        layout.localizedLabels &&
        layout.localizedFilters &&
        layout.headersSingleLine &&
        layout.adjustedColumnProportions &&
        layout.desktopFitsWithoutHorizontalScroll &&
        layout.desktopLimitadorVisible;
      ordered = passed && ordered;
      process.stdout.write(
        `Tabelão QA: regiões verticais e cabeçalho ${viewport.key} ${JSON.stringify({ vertical, sticky, ...layout })}\n`,
      );
    }
    process.stdout.write(`Tabelão QA: regiões, projetos homônimos e preços ${ordered}\n`);
    return ordered;
  } finally {
    await page.unroute("**/api/inventory/regions?*", regionHandler);
    await page.unroute("**/api/inventory", inventoryHandler);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
}

function readTabelaoMergedRows() {
  return [...document.querySelectorAll(".tabelao-project-group")].map((group) => {
    const rows = [...group.rows];
    const headers = [...group.querySelectorAll('th[scope="rowgroup"]')];
    const readRuns = (column) =>
      rows.flatMap((row, index) =>
        [...row.querySelectorAll(`td[headers~="${column}"]`)].map((cell) => ({
          start: index,
          span: cell.rowSpan,
          text: cell.textContent.trim(),
          title: cell.title,
          headersValid:
            cell.colSpan === 1 &&
            cell.headers.split(/\s+/).every((id) => document.getElementById(id)) &&
            headers.every((header) => cell.headers.split(/\s+/).includes(header.id)),
        })),
      );
    return {
      ids: rows.map((row) => row.dataset.inventoryUnitId),
      identity: rows.map((row) => [
        row.dataset.inventoryBusinessUnit,
        row.dataset.inventoryProject,
      ]),
      plants: rows.map((row) =>
        row.querySelector('[headers~="tabelao-plant"]').textContent.trim().replace(/\s+/g, " "),
      ),
      prices: rows.map((row) =>
        row.querySelector('[headers~="tabelao-price"]').textContent.replace(/\D/g, ""),
      ),
      quantities: rows.map((row) =>
        Number(row.querySelector(".tabelao-stock-quantity").textContent.trim()),
      ),
      ariaRows: rows.map((row) => Number(row.getAttribute("aria-rowindex"))),
      groupHeadersValid:
        headers.length === 2 && headers.every((header) => header.rowSpan === rows.length),
      address: readRuns("tabelao-address"),
      description: readRuns("tabelao-description"),
    };
  });
}

async function checkTabelaoTypographyFixture(page, viewports) {
  const cases = [
    {
      raw: "TIPO 2Q",
      plant: "Tipo\n2Q",
      option: "Tipo 2Q",
      value: "tipo 2q",
      twoLines: true,
      description: "HIS-2 - ADAPTAVEL PCD/PNE",
      displayedDescription: "HIS-2 - adaptável PCD/PNE",
    },
    {
      raw: "Terreo 1Q PCD",
      plant: "Térreo\n1Q PCD",
      option: "Térreo 1Q PCD",
      value: "terreo 1q pcd",
      twoLines: true,
      description: "R2V",
      displayedDescription: "R2V",
    },
    {
      raw: "TERREO 2Q C/AP",
      plant: "Térreo\n2Q C/AP",
      option: "Térreo 2Q C/AP",
      value: "terreo 2q c/ap",
      twoLines: true,
      description: "R2-V - UNIDADE ADAPTAVEL PCD",
      displayedDescription: "R2-V - unidade adaptável PCD",
    },
    {
      raw: "TIPO 2Q ADAPTAVEL PCD",
      plant: "Tipo\n2Q adaptável PCD",
      option: "Tipo 2Q adaptável PCD",
      value: "tipo 2q adaptavel pcd",
      twoLines: false,
      description: "UNIDADE ADAPTAVEL PARA PCD",
      displayedDescription: "Unidade adaptável para PCD",
    },
    {
      raw: "VAGA",
      plant: "Vaga",
      option: "Vaga",
      value: "vaga",
      twoLines: false,
      description: "VAGA AVULSA",
      displayedDescription: "Vaga avulsa",
    },
    {
      raw: "TIPO 1Q",
      plant: "Tipo\n1Q",
      option: "Tipo 1Q",
      value: "tipo 1q",
      twoLines: true,
      description: "HMP / 2Q / 1Q / AP / QA",
      displayedDescription: "HMP / 2Q / 1Q / AP / QA",
    },
    {
      raw: "TERREO 2Q C/ AP",
      plant: "Térreo\n2Q C/ AP",
      option: "Térreo 2Q C/ AP",
      value: "terreo 2q c/ ap",
      twoLines: true,
      description: "R2V-Adaptavel",
      displayedDescription: "R2V-adaptável",
    },
  ];
  const items = cases.map((entry, index) => ({
    ...buildTabelaoCompactFixture()[0],
    id: `qa-typography-${index}`,
    businessUnit: "RIVA QA",
    project: "Condomínio São Miguel QA",
    street: "Rua Caetano José Batista",
    streetNumber: "149",
    neighborhood: "Brooklin",
    plant: entry.raw,
    classification: entry.description,
    finalWithKit: 300_000 + index * 10_000,
  }));
  const handler = (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: items.length, items }),
    });
  await page.route("**/api/inventory", handler);
  let passed = true;
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('tr[data-inventory-unit-id="qa-typography-6"]').waitFor();
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const layout = await page.evaluate(readTabelaoCompactLayout);
      const presentation = await page.evaluate((expected) => {
        const rows = [...document.querySelectorAll("tr[data-inventory-unit-id]")];
        const options = [
          ...document.querySelectorAll('.investor-stock-filters select[name="plant"] option'),
        ].filter((option) => option.value);
        const properNames =
          document.querySelector('[headers="tabelao-business"]')?.textContent.trim() ===
            "RIVA QA" &&
          document.querySelector(".investor-stock-product-text")?.textContent ===
            "Condomínio São Miguel QA" &&
          document.querySelector('[headers~="tabelao-address"]')?.textContent.trim() ===
            "Rua Caetano José Batista / 149 / Brooklin";
        return (
          properNames &&
          rows.length === expected.length &&
          options.length === expected.length &&
          expected.every((entry, index) => {
            const row = rows[index];
            const cell = row.querySelector('[headers~="tabelao-plant"]');
            const span = cell.querySelector(".tabelao-stock-plant-text");
            const box = span?.getBoundingClientRect();
            const cellBox = cell.getBoundingClientRect();
            if (
              !span ||
              row.dataset.inventoryUnitId !== `qa-typography-${index}` ||
              span.textContent !== entry.plant ||
              getComputedStyle(span).whiteSpace !== "pre-line" ||
              getComputedStyle(span).fontSize !== "11px"
            )
              return false;
            const text = span.firstChild;
            if (text?.nodeType !== Node.TEXT_NODE) return false;
            const range = document.createRange();
            // Count actual glyph lines, excluding the preserved newline's zero-width rectangle.
            const lineTops = new Set();
            for (let offset = 0; offset < text.length; offset += 1) {
              if (/\s/.test(text.textContent[offset])) continue;
              range.setStart(text, offset);
              range.setEnd(text, offset + 1);
              const rect = range.getBoundingClientRect();
              lineTops.add(Math.round(rect.top * 10) / 10);
              if (
                rect.left < cellBox.left - 1 ||
                rect.right > cellBox.right + 1 ||
                rect.top < cellBox.top - 1 ||
                rect.bottom > cellBox.bottom + 1
              )
                return false;
            }
            const option = options.find((candidate) => candidate.value === entry.value);
            return (
              (!entry.twoLines || lineTops.size === 2) &&
              box.top >= cellBox.top - 1 &&
              box.bottom <= cellBox.bottom + 1 &&
              span.scrollWidth <= span.clientWidth + 1 &&
              span.scrollHeight <= span.clientHeight + 1 &&
              option?.textContent.trim() === `${entry.option} (1)` &&
              cell.title === entry.option &&
              row.querySelector('[headers~="tabelao-description"]')?.textContent.trim() ===
                entry.displayedDescription
            );
          })
        );
      }, cases);
      passed =
        presentation &&
        layout.readableText &&
        layout.headersSingleLine &&
        layout.adjustedColumnProportions &&
        layout.localizedLabels &&
        layout.localizedFilters &&
        layout.compactTextFullyVisible &&
        layout.desktopFitsWithoutHorizontalScroll &&
        layout.desktopLimitadorVisible &&
        passed;
      process.stdout.write(
        `Tabelão QA: tipografia e português ${viewport.key} ${JSON.stringify({ presentation, ...layout })}\n`,
      );
    }
    const filter = page.locator('.investor-stock-filters select[name="plant"]');
    for (const [index, entry] of cases.entries()) {
      await filter.selectOption(entry.value);
      await page.waitForFunction(
        () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 1,
      );
      passed =
        (await page
          .locator("tr[data-inventory-unit-id]")
          .getAttribute("data-inventory-unit-id")) === `qa-typography-${index}` && passed;
      passed = (await filter.inputValue()) === entry.value && passed;
    }
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 7,
    );
    process.stdout.write(`Tabelão QA: apresentação e valores originais dos filtros ${passed}\n`);
    return passed;
  } finally {
    await page.unroute("**/api/inventory", handler);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
}

async function checkTabelaoCompactFixture(page) {
  const items = buildTabelaoCompactFixture();
  const byId = new Map(items.map((item) => [item.id, item]));
  const checks = [];
  const verify = async (idsByGroup, expectedSpans) => {
    await page.waitForFunction(
      (expectedGroups) => {
        const actualGroups = [...document.querySelectorAll(".tabelao-project-group")].map((group) =>
          [...group.rows].map((row) => row.dataset.inventoryUnitId),
        );
        return JSON.stringify(actualGroups) === JSON.stringify(expectedGroups);
      },
      idsByGroup.map((ids) => ids.map((id) => `qa-compact-${id}`)),
    );
    const groups = await page.evaluate(readTabelaoMergedRows);
    const layout = await page.evaluate(readTabelaoCompactLayout);
    let rowIndex = 2;
    const passed =
      groups.length === idsByGroup.length &&
      groups.every((group, groupIndex) => {
        const expectedIds = idsByGroup[groupIndex].map((id) => `qa-compact-${id}`);
        const expectedItems = expectedIds.map((id) => byId.get(id));
        const rowsPreserved =
          JSON.stringify(group.ids) === JSON.stringify(expectedIds) &&
          group.groupHeadersValid &&
          group.ariaRows.every((index) => index === rowIndex++) &&
          expectedItems.every(
            (item, index) =>
              group.identity[index][0] === item.businessUnit &&
              group.identity[index][1] === item.project &&
              group.plants[index] === item.plant &&
              group.prices[index] === String((item.finalWithKit - 15_000) * 100) &&
              group.quantities[index] === (item.id === "qa-compact-1" ? 2 : 1),
          );
        const mergedColumns = ["address", "description"].every((column, columnIndex) => {
          const expectedLabels = expectedItems.map((item) =>
            column === "address"
              ? `${item.street.trim()} / ${item.streetNumber} / ${item.neighborhood}`
              : item.classification?.trim() && item.classification.trim() !== "0"
                ? "Programa residencial especial"
                : "Não informado",
          );
          const groupingLabels =
            column === "address"
              ? expectedLabels
              : expectedItems.map((item) =>
                  item.classification?.trim() && item.classification.trim() !== "0"
                    ? item.classification.trim()
                    : "Não informado",
                );
          const cells = group[column];
          let nextStart = 0;
          return (
            JSON.stringify(cells.map((cell) => cell.span)) ===
              JSON.stringify(expectedSpans[groupIndex][columnIndex]) &&
            cells.every((cell) => {
              const startsHere = cell.start === nextStart;
              nextStart += cell.span;
              return (
                startsHere &&
                cell.headersValid &&
                cell.title === cell.text &&
                expectedLabels.slice(cell.start, nextStart).every((label) => label === cell.text) &&
                (nextStart === groupingLabels.length ||
                  groupingLabels[nextStart] !== groupingLabels[cell.start])
              );
            }) &&
            nextStart === expectedLabels.length
          );
        });
        return rowsPreserved && mergedColumns;
      }) &&
      (await page.locator(".investor-stock-table").getAttribute("aria-rowcount")) ===
        String(idsByGroup.flat().length + 1) &&
      layout.compactColumnWidths &&
      layout.columnsAligned &&
      layout.compactTextFullyVisible &&
      layout.compactFrameFitsTable &&
      layout.compactFrameInsidePanel &&
      layout.readableText &&
      layout.localizedLabels &&
      layout.localizedFilters &&
      layout.headersSingleLine &&
      layout.adjustedColumnProportions;
    checks.push(passed);
  };
  await verify(
    [[1, 2, 3, 4, 5, 6, 7], [8, 9], [10]],
    [
      [
        [2, 1, 4],
        [3, 1, 3],
      ],
      [[2], [2]],
      [[1], [1]],
    ],
  );
  const panel = page.locator(".investor-stock-filters");
  await panel.locator('select[name="priceOrder"]').selectOption("desc");
  await verify(
    [[7, 6, 5, 4, 3, 2, 1], [9, 8], [10]],
    [
      [
        [4, 1, 2],
        [3, 1, 3],
      ],
      [[2], [2]],
      [[1], [1]],
    ],
  );
  await panel.locator('select[name="parkingSpaces"]').selectOption("0");
  await verify(
    [[7, 6, 5, 2, 1], [9, 8], [10]],
    [
      [[5], [3, 2]],
      [[2], [2]],
      [[1], [1]],
    ],
  );
  await panel.locator('select[name="plant"]').selectOption("tipo 02");
  await verify([[2]], [[[1], [1]]]);
  await panel.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await verify(
    [[1, 2, 3, 4, 5, 6, 7], [8, 9], [10]],
    [
      [
        [2, 1, 4],
        [3, 1, 3],
      ],
      [[2], [2]],
      [[1], [1]],
    ],
  );
  return checks.length === 5 && checks.every(Boolean);
}

async function checkTabelaoValidation(page, origin) {
  const route = "/app/simulacao/tabelao";
  const url = `${origin}${route}`;
  const requiredViewports = [
    { key: "desktop-1440x900", width: 1440, height: 900, rowHeight: 32, targetSize: 24 },
    { key: "desktop-1280x800", width: 1280, height: 800, rowHeight: 32, targetSize: 24 },
    { key: "tablet-1024x768", width: 1024, height: 768, rowHeight: 44, targetSize: 44 },
    { key: "tablet-768x1024", width: 768, height: 1024, rowHeight: 44, targetSize: 44 },
    { key: "mobile-375x812", width: 375, height: 812, rowHeight: 44, targetSize: 44 },
  ];
  const viewportChecks = [];

  for (const viewport of requiredViewports) {
    process.stdout.write(`Tabelão QA: iniciando ${viewport.key}\n`);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await gotoWithServerRetry(page, url, { waitUntil: "domcontentloaded" });
    await page
      .locator(".investor-stock-sync")
      .getByText(syntheticTabelaoCountLabel, { exact: true })
      .waitFor({ state: "visible", timeout: qaNavigationTimeout });
    await page.locator('tr[data-inventory-unit-id="qa-stock-0001"]').waitFor({
      state: "visible",
      timeout: qaNavigationTimeout,
    });

    const initial = await page.evaluate(
      ({ rowHeight, targetSize, count }) => {
        const root = document.documentElement;
        const results = document.querySelector(".investor-stock-results");
        const table = document.querySelector(".investor-stock-table");
        const firstRow = document.querySelector("tr[data-inventory-unit-id]");
        const controls = [...document.querySelectorAll(".investor-stock-filters select")];
        const columnHeaders = [...document.querySelectorAll(".investor-stock-table thead th")];
        const columnLabels = columnHeaders.map((column) => column.textContent.trim());
        const rowBox = firstRow?.getBoundingClientRect();
        const headingBox = document
          .querySelector(".investor-stock-panel > .investor-section-heading")
          ?.getBoundingClientRect();
        const syncBox = document.querySelector(".investor-stock-sync")?.getBoundingClientRect();
        const tableStyle = table == null ? null : getComputedStyle(table);
        const tableFillsAvailableWidth =
          results != null &&
          table != null &&
          Math.abs(table.getBoundingClientRect().width - results.clientWidth) <= 2 &&
          table.scrollWidth <= results.clientWidth + 2;
        const fullTextVisible = [
          ...document.querySelectorAll(
            ".investor-stock-table tbody th, .investor-stock-table tbody td",
          ),
        ].every((cell) => cell.scrollWidth <= cell.clientWidth + 1);
        let horizontalOverflowHandled = false;
        if (results != null) {
          const maximumScroll = results.scrollWidth - results.clientWidth;
          results.scrollLeft = maximumScroll;
          horizontalOverflowHandled =
            maximumScroll <= 1 || Math.abs(results.scrollLeft - maximumScroll) <= 1;
          results.scrollLeft = 0;
        }
        return {
          title: document.querySelector("h1")?.textContent?.trim() === "Simulador Tabelão",
          columns:
            columnLabels.length === 14 &&
            [
              "Região",
              "Empresa",
              "Empreendimento",
              "Endereço",
              "Metragem",
              "Entrega",
              "Planta",
              "Vagas",
              "Estoque",
              "Valor do Imóvel",
              "Volta ao Caixa",
              "Avaliação",
              "% obra",
              "Limitador",
            ].every((label, index) => columnLabels[index] === label),
          filtersPresent:
            controls.length === 7 &&
            controls.every(
              (control) =>
                !control.disabled &&
                control.labels.length > 0 &&
                control.getBoundingClientRect().height >= targetSize - 1,
            ),
          filterHeadingClear:
            document.querySelector(".investor-filter-heading > button").getBoundingClientRect()
              .bottom <=
            document.querySelector(".investor-stock-filters > label").getBoundingClientRect().top,
          rowCount: table?.getAttribute("aria-rowcount") === String(count + 1),
          noRootOverflow: root.scrollWidth <= root.clientWidth + 1,
          noHeaderOverlap:
            headingBox != null &&
            syncBox != null &&
            syncBox.bottom <= headingBox.bottom + 1 &&
            headingBox.bottom <=
              (document.querySelector(".investor-stock-filters")?.getBoundingClientRect().top ??
                0) +
                1 &&
            (document.querySelector(".investor-stock-filters")?.getBoundingClientRect().bottom ??
              Infinity) <=
              (results?.getBoundingClientRect().top ?? 0) + 1,
          rowHeight: rowBox != null && rowBox.height >= rowHeight - 2,
          quantityColumn:
            columnLabels.indexOf("Estoque") === 8 &&
            columnLabels.indexOf("Valor do Imóvel") === 9 &&
            columnLabels.indexOf("Volta ao Caixa") === 10 &&
            columnLabels.indexOf("Avaliação") === 11 &&
            columnLabels.indexOf("% obra") === 12 &&
            columnLabels.indexOf("Limitador") === 13 &&
            Number(
              firstRow
                ?.querySelector(".tabelao-stock-quantity")
                ?.textContent.trim()
                .replaceAll(".", ""),
            ) > 0 &&
            table.querySelectorAll(".investor-stock-unit-button").length === 0,
          detailColumns:
            firstRow?.querySelector(".tabelao-stock-money")?.textContent.trim().length > 0 &&
            firstRow?.querySelector(".tabelao-stock-progress")?.textContent.trim() === "50%" &&
            firstRow?.querySelectorAll(".tabelao-stock-long-text").length === 3,
          allRowsRendered: table?.querySelectorAll("tr[data-inventory-unit-id]").length === count,
          noInternalVerticalScroll:
            results != null &&
            results.scrollHeight <= results.clientHeight + 2 &&
            getComputedStyle(results).maxHeight === "none",
          proportionalColumnWidths:
            tableStyle?.tableLayout === "fixed" &&
            (innerWidth < 1280 || tableFillsAvailableWidth) &&
            [...table.querySelectorAll("colgroup col")].length === 14,
          headersMatchRows:
            firstRow != null &&
            columnHeaders.every(
              (header) =>
                getComputedStyle(header).fontSize ===
                getComputedStyle(firstRow.querySelector("td")).fontSize,
            ),
          cellsCentered: [...table.querySelectorAll("th, td")].every((cell) => {
            const style = getComputedStyle(cell);
            const wrapper = cell.querySelector(
              ".investor-stock-product-text, .tabelao-stock-wrapped-text",
            );
            return (
              style.textAlign === "center" &&
              style.verticalAlign === "middle" &&
              (wrapper == null || getComputedStyle(wrapper).textAlign === "center")
            );
          }),
          headersFullyVisible: columnHeaders.every((header) => {
            const range = document.createRange();
            range.selectNodeContents(header);
            const box = header.getBoundingClientRect();
            return [...range.getClientRects()].every(
              (rect) =>
                rect.left >= box.left - 1 &&
                rect.right <= box.right + 1 &&
                rect.top >= box.top - 1 &&
                rect.bottom <= box.bottom + 1,
            );
          }),
          fullTextVisible,
          horizontalOverflowHandled,
        };
      },
      { ...viewport, count: syntheticTabelaoInventory.length },
    );

    const compactLayout = await page.evaluate(readTabelaoCompactLayout);
    Object.assign(initial, await page.evaluate(readTabelaoLayout));
    initial.compactColumnWidths = compactLayout.compactColumnWidths;
    initial.columnsAligned = compactLayout.columnsAligned;
    initial.compactTextFullyVisible = compactLayout.compactTextFullyVisible;
    initial.compactFrameFitsTable = compactLayout.compactFrameFitsTable;
    initial.compactFrameInsidePanel = compactLayout.compactFrameInsidePanel;
    initial.readableText = compactLayout.readableText;
    initial.localizedLabels = compactLayout.localizedLabels;
    initial.localizedFilters = compactLayout.localizedFilters;
    initial.headersSingleLine = compactLayout.headersSingleLine;
    initial.adjustedColumnProportions = compactLayout.adjustedColumnProportions;
    initial.desktopFitsWithoutHorizontalScroll = compactLayout.desktopFitsWithoutHorizontalScroll;
    initial.desktopLimitadorVisible = compactLayout.desktopLimitadorVisible;
    const results = page.locator(".investor-stock-results");
    await page.locator("tr[data-inventory-unit-id]").last().scrollIntoViewIfNeeded();
    await page.waitForFunction(
      (expectedLastId) =>
        [...document.querySelectorAll("tr[data-inventory-unit-id]")]
          .at(-1)
          ?.getAttribute("data-inventory-unit-id") === expectedLastId,
      syntheticTabelaoLastInventoryId,
      { timeout: 10_000 },
    );
    const bottom = await page.evaluate(
      ({ expectedLastId, count }) => {
        const rows = [...document.querySelectorAll("tr[data-inventory-unit-id]")];
        const last = rows.at(-1);
        const results = document.querySelector(".investor-stock-results");
        return {
          lastId: last?.getAttribute("data-inventory-unit-id") === expectedLastId,
          lastAriaRow: last?.getAttribute("aria-rowindex") === String(count + 1),
          scrolledToBottom:
            results != null && results.scrollTop + results.clientHeight >= results.scrollHeight - 3,
        };
      },
      { expectedLastId: syntheticTabelaoLastInventoryId, count: syntheticTabelaoInventory.length },
    );
    let filtersWorking = true;
    const filterPanel = page.locator(".investor-stock-filters");
    for (const dimension of [
      "businessUnit",
      "project",
      "region",
      "plant",
      "parkingSpaces",
      "price",
    ]) {
      const select = filterPanel.locator(`select[name="${dimension}"]`);
      const option = await select
        .locator("option")
        .nth(1)
        .evaluate((element) => ({
          value: element.value,
          count: Number(element.textContent.match(/\(([\d.]+)\)$/)?.[1].replaceAll(".", "")),
        }));
      await select.selectOption(option.value);
      await page.waitForFunction(
        (expected) =>
          document.querySelector(".investor-stock-table")?.getAttribute("aria-rowcount") ===
          String(expected + 1),
        option.count,
      );
      filtersWorking &&= await results.evaluate((element) => element.scrollTop === 0);
      const selectedRows = await page.locator("tr[data-inventory-unit-id]").evaluateAll((rows) =>
        rows.map((row) => ({
          businessUnit: row.getAttribute("data-inventory-business-unit"),
          project: row.getAttribute("data-inventory-project"),
          plant: row.querySelector(".investor-stock-plant")?.textContent.trim(),
          region: row.getAttribute("data-inventory-region"),
          parkingSpaces: row.getAttribute("data-inventory-parking-spaces"),
          price: row.querySelector(".investor-stock-price")?.textContent.replace(/\D/g, ""),
        })),
      );
      const normalize = (value) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      filtersWorking &&=
        selectedRows.length === option.count &&
        selectedRows.every((row) =>
          dimension === "price"
            ? row.price === option.value
            : normalize(row[dimension]) === option.value,
        );
    }
    await filterPanel.locator('select[name="priceOrder"]').selectOption("desc");
    filtersWorking &&=
      (await filterPanel.locator('select[name="priceOrder"]').inputValue()) === "desc";
    await filterPanel.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await page
      .locator(".investor-stock-sync")
      .getByText(syntheticTabelaoCountLabel, { exact: true })
      .waitFor({ state: "visible" });
    filtersWorking &&= await filterPanel
      .locator("select")
      .evaluateAll((controls) =>
        controls.every((control) => control.value === (control.name === "priceOrder" ? "asc" : "")),
      );
    filtersWorking &&= await results.evaluate((element) => element.scrollTop === 0);
    viewportChecks.push({ key: viewport.key, ...initial, ...bottom, filtersWorking });
    process.stdout.write(`Tabelão QA: concluiu ${viewport.key}\n`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoWithServerRetry(page, url, { waitUntil: "domcontentloaded" });
  await page
    .locator(".investor-stock-sync")
    .getByText(syntheticTabelaoCountLabel, { exact: true })
    .waitFor({ state: "visible", timeout: qaNavigationTimeout });

  const guideLauncher = page.getByRole("button", {
    name: "Iniciar passo a passo",
    exact: true,
  });
  await guideLauncher.click();
  const guide = page.locator("#investor-guided-tour");
  await guide.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector("#investor-guided-tour"),
    undefined,
    { timeout: 10_000 },
  );
  process.stdout.write("Tabelão QA: guia aberto com foco\n");
  const spotlightSized = await page.locator(".investor-tour-spotlight").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  let placementClassApplied = false;
  for (let step = 1; step < 3; step += 1) {
    await guide.getByRole("button", { name: "Próximo", exact: true }).click();
    await page.waitForTimeout(80);
    placementClassApplied ||= await guide.evaluate(
      (element) => element.classList.contains("at-top") || element.classList.contains("at-left"),
    );
  }
  const guideReachedLastStep = await guide
    .getByRole("heading", { name: "Confira a unidade correta", exact: true })
    .isVisible();
  await guide.getByRole("button", { name: "Concluir guia", exact: true }).click();
  await guide.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector(".investor-guided-start"),
    undefined,
    { timeout: 10_000 },
  );
  const guideCompletionReturnedFocus = await guideLauncher.evaluate(
    (element) => document.activeElement === element,
  );
  await guideLauncher.click();
  await guide.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector("#investor-guided-tour"),
    undefined,
    { timeout: 10_000 },
  );
  await page.keyboard.press("Escape");
  await guide.waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector(".investor-guided-start"),
    undefined,
    { timeout: 10_000 },
  );
  const guideEscapeReturnedFocus = await guideLauncher.evaluate(
    (element) => document.activeElement === element,
  );
  process.stdout.write("Tabelão QA: guia concluído e Escape verificado\n");

  const rendered = await page.locator("tr[data-inventory-unit-id]").evaluateAll((rows) =>
    rows.map((row) => ({
      id: row.getAttribute("data-inventory-unit-id"),
      project: row.getAttribute("data-inventory-project"),
      projectLabel: row
        .closest("tbody")
        ?.querySelector(".investor-stock-product-text")
        ?.textContent?.trim(),
      plant: row.querySelector(".investor-stock-plant")?.textContent?.trim().replace(/\s+/g, " "),
      businessUnit: row.getAttribute("data-inventory-business-unit"),
      region: row.getAttribute("data-inventory-region"),
      parkingSpaces: row.getAttribute("data-inventory-parking-spaces"),
      price: row.querySelector(".investor-stock-price")?.textContent?.trim(),
      priceCents: Number(
        row.querySelector(".investor-stock-price")?.textContent?.replace(/\D/g, ""),
      ),
      availableUnits: Number(
        row.querySelector(".tabelao-stock-quantity")?.textContent.trim().replaceAll(".", ""),
      ),
    })),
  );
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const exclusiveRows =
    rendered.length === syntheticTabelaoInventory.length &&
    new Set(
      rendered.map((row) =>
        JSON.stringify([row.businessUnit, row.project, row.plant, row.parkingSpaces]),
      ),
    ).size === rendered.length &&
    rendered.every(
      (row, index) =>
        row.id === syntheticTabelaoInventory[index].id &&
        row.projectLabel === syntheticTabelaoInventory[index].project &&
        row.plant === syntheticTabelaoInventory[index].plant &&
        row.parkingSpaces === String(syntheticTabelaoInventory[index].parkingSpaces ?? "unknown") &&
        row.availableUnits === syntheticTabelaoInventory[index].availableUnits,
    );
  const netPrices = rendered.every(
    (row, index) => row.price === currency.format(syntheticTabelaoInventory[index].minimumPrice),
  );
  const projectCollator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  const regionOrder = ["Zona Leste", "Zona Sul", "Zona Norte", "Zona Oeste", "Centro"];
  const rankRegion = (region) => {
    const index = regionOrder.indexOf(region);
    return index < 0 ? regionOrder.length : index;
  };
  const normalizeGroupName = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/\s+/g, " ")
      .trim();
  const compareGroupNames = (left, right) => {
    const leftName = normalizeGroupName(left);
    const rightName = normalizeGroupName(right);
    return (
      projectCollator.compare(leftName, rightName) ||
      (leftName < rightName ? -1 : leftName > rightName ? 1 : 0)
    );
  };
  const compareRegions = (left, right) =>
    rankRegion(left) - rankRegion(right) ||
    projectCollator.compare(String(left ?? ""), String(right ?? ""));
  const groupedProjects = rendered.every((row, index, rows) => {
    if (index === 0) return true;
    const previous = rows[index - 1];
    const groupOrder =
      compareRegions(previous.region, row.region) ||
      compareGroupNames(previous.project, row.project) ||
      compareGroupNames(previous.businessUnit, row.businessUnit);
    return (
      groupOrder < 0 ||
      (groupOrder === 0 &&
        Number.isFinite(previous.priceCents) &&
        Number.isFinite(row.priceCents) &&
        previous.priceCents <= row.priceCents)
    );
  });

  const referencePayload = JSON.parse(syntheticDirectTableSnapshot);
  const livePayload = {
    ...referencePayload,
    source: "QA synthetic live inventory",
    generatedAt: "2026-09-26T12:00:00.000Z",
    sourceKind: "live",
    items: referencePayload.items.map((item) => ({
      ...item,
      street: null,
      streetNumber: null,
      neighborhood: null,
    })),
  };
  const protectedReferencePayload = {
    ...referencePayload,
    sourceKind: "versioned-snapshot",
    snapshotReferenceDate: "2026-09-05",
  };
  let releaseLocationReference;
  const locationReferenceGate = new Promise((resolve) => {
    releaseLocationReference = resolve;
  });
  const liveLocationHandler = async (interceptedRoute) =>
    interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(livePayload),
    });
  const protectedLocationHandler = async (interceptedRoute) => {
    await locationReferenceGate;
    await interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(protectedReferencePayload),
    });
  };
  let liveAvailableBeforeLocationReference = false;
  let locationReferenceApplied = false;
  let locationMetadataFits = false;
  await page.route("**/api/inventory", liveLocationHandler);
  await page.route("**/api/inventory/snapshot*", protectedLocationHandler);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator(".investor-stock-sync")
      .getByText(syntheticTabelaoCountLabel, { exact: true })
      .waitFor({ state: "visible", timeout: qaNavigationTimeout });
    liveAvailableBeforeLocationReference =
      (await page.locator("tr[data-inventory-unit-id]").count()) ===
        syntheticTabelaoInventory.length &&
      (await page.getByText(/Endereços complementados pela referência/u).count()) === 0;
    releaseLocationReference();
    await page
      .getByText("Endereços complementados pela referência 05/09/2026", { exact: true })
      .waitFor({ state: "visible", timeout: qaNavigationTimeout });
    const firstWinner = syntheticTabelaoInventory[0];
    const firstReference = referencePayload.items.find((item) => item.id === firstWinner.id);
    const expectedAddress = [
      firstReference.street,
      firstReference.streetNumber,
      firstReference.neighborhood,
    ].join(" / ");
    locationReferenceApplied =
      (
        await page
          .locator(`tr[data-inventory-unit-id="${firstWinner.id}"] td[data-label="Endereço"]`)
          .textContent()
      )?.trim() === expectedAddress;
    locationMetadataFits = await page.evaluate(() => {
      const heading = document.querySelector(".investor-stock-panel > .investor-section-heading");
      const sync = document.querySelector(".investor-stock-sync");
      const filters = document.querySelector(".investor-stock-filters");
      const headingBox = heading?.getBoundingClientRect();
      const syncBox = sync?.getBoundingClientRect();
      const filtersBox = filters?.getBoundingClientRect();
      return (
        headingBox != null &&
        syncBox != null &&
        filtersBox != null &&
        sync?.querySelectorAll("small").length === 3 &&
        syncBox.top >= headingBox.top - 1 &&
        syncBox.bottom <= headingBox.bottom + 1 &&
        headingBox.bottom <= filtersBox.top + 1
      );
    });
    process.stdout.write("Tabelão QA: complemento de endereço não bloqueante verificado\n");
  } finally {
    releaseLocationReference();
    await page.unroute("**/api/inventory/snapshot*", protectedLocationHandler);
    await page.unroute("**/api/inventory", liveLocationHandler);
  }

  const completeLivePayload = { ...livePayload, items: referencePayload.items };
  const malformedPayloads = [
    { name: "items-object", payload: { ...completeLivePayload, items: {} } },
    {
      name: "count-mismatch",
      payload: { ...completeLivePayload, count: completeLivePayload.count + 1 },
    },
    ...[
      ["plant", 42],
      ["streetNumber", { value: "123" }],
      ["completionDate", 20291231],
    ].map(([field, value]) => ({
      name: `${field}-invalid-type`,
      payload: {
        ...completeLivePayload,
        items: completeLivePayload.items.map((item, index) =>
          index === 0 ? { ...item, [field]: value } : item,
        ),
      },
    })),
  ];
  let currentPayload = completeLivePayload;
  let payloadRequestCount = 0;
  let completeLiveSnapshotRequests = 0;
  let malformedPayloadPageErrors = 0;
  const recordMalformedPageError = () => {
    malformedPayloadPageErrors += 1;
  };
  const payloadHandler = async (interceptedRoute) => {
    payloadRequestCount += 1;
    await interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(currentPayload),
    });
  };
  const unexpectedSnapshotHandler = async (interceptedRoute) => {
    completeLiveSnapshotRequests += 1;
    await interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: syntheticDirectTableSnapshot,
    });
  };
  let malformedPayloadRecoverable = true;
  let malformedPayloadRetryRestoresInventory = true;
  let completeLiveSkipsLocationReference = true;
  page.on("pageerror", recordMalformedPageError);
  await page.route("**/api/inventory", payloadHandler);
  await page.route("**/api/inventory/snapshot*", unexpectedSnapshotHandler);
  try {
    for (const malformed of malformedPayloads) {
      currentPayload = malformed.payload;
      await page.reload({ waitUntil: "domcontentloaded" });
      const invalidPayloadMessage = page.getByText(
        "Arquivo oficial do estoque indisponível. Nenhuma fonte alternativa foi usada.",
        { exact: false },
      );
      await invalidPayloadMessage.waitFor({ state: "visible" });
      const retry = page.getByRole("button", { name: "Tentar novamente", exact: true });
      const recoverable =
        (await retry.isVisible()) &&
        (await retry.isEnabled()) &&
        (await page.locator("tr[data-inventory-unit-id]").count()) === 0 &&
        (await page.getByText("Carregando unidades do estoque…", { exact: true }).count()) === 0 &&
        malformedPayloadPageErrors === 0;
      malformedPayloadRecoverable &&= recoverable;

      currentPayload = completeLivePayload;
      const requestsBeforeRetry = payloadRequestCount;
      await retry.click();
      await page
        .locator(".investor-stock-sync")
        .getByText(syntheticTabelaoCountLabel, { exact: true })
        .waitFor({ state: "visible", timeout: qaNavigationTimeout });
      const restored =
        payloadRequestCount > requestsBeforeRetry &&
        (await invalidPayloadMessage.count()) === 0 &&
        (await page.locator("tr[data-inventory-unit-id]").count()) ===
          syntheticTabelaoInventory.length &&
        (await page.locator('.investor-stock-filters select[name="project"]').isEnabled()) &&
        malformedPayloadPageErrors === 0;
      malformedPayloadRetryRestoresInventory &&= restored;
      completeLiveSkipsLocationReference &&=
        completeLiveSnapshotRequests === 0 &&
        (await page.getByText(/Endereços complementados pela referência/u).count()) === 0 &&
        (
          await page
            .locator(
              `tr[data-inventory-unit-id="${syntheticTabelaoInventory[0].id}"] td[data-label="Endereço"]`,
            )
            .textContent()
        )?.trim() ===
          ["street", "streetNumber", "neighborhood"]
            .map((field) => syntheticTabelaoInventory[0][field])
            .join(" / ");
      process.stdout.write(
        `Tabelão QA: payload ${malformed.name} ${JSON.stringify({ recoverable, restored })}\n`,
      );
    }
  } finally {
    await page.unroute("**/api/inventory", payloadHandler);
    await page.unroute("**/api/inventory/snapshot*", unexpectedSnapshotHandler);
    page.off("pageerror", recordMalformedPageError);
  }

  // Reuse the synthetic login in two tabs; keep both live and reference requests in flight.
  const concurrentPages = [];
  let concurrentPageErrors = 0;
  let concurrentResponsesKeepFiltersIndependent = true;
  async function concurrentSelectionMatches(state, enriched) {
    return state.page.evaluate(
      ({ project, order, expectedRows, enriched }) => {
        const rows = [...document.querySelectorAll("tr[data-inventory-unit-id]")];
        return (
          document.querySelector('select[name="project"]')?.value === project &&
          document.querySelector('select[name="priceOrder"]')?.value === order &&
          document.querySelector(".investor-stock-table")?.getAttribute("aria-rowcount") ===
            String(expectedRows.length + 1) &&
          rows.length === expectedRows.length &&
          rows.every((row, index) => {
            const expected = expectedRows[index];
            return (
              row.getAttribute("data-inventory-unit-id") === expected.id &&
              row.querySelector(".investor-stock-price")?.textContent.trim() === expected.price &&
              (!enriched ||
                row.querySelector('td[data-label="Endereço"]')?.textContent.trim() ===
                  expected.address)
            );
          })
        );
      },
      { project: state.project, order: state.order, expectedRows: state.expectedRows, enriched },
    );
  }
  try {
    for (const index of [0, 1]) {
      const items = referencePayload.items.slice(0, 4).map((item, itemIndex) => ({
        ...item,
        id: `qa-concurrent-${index}-${itemIndex}`,
        identifier: `QA-CONCURRENT-${index}-${itemIndex}`,
        businessUnit: "Incorporadora QA",
        project: `Empreendimento concorrente ${Math.floor(itemIndex / 2) + 1}`,
        plant: `Planta ${itemIndex % 2}`,
        finalWithKit: 250_000 + itemIndex * 10_000,
        unitBonus: 0,
        tableSlack: 0,
        street: `Rua concorrente ${index}`,
        streetNumber: String(itemIndex + 1),
        neighborhood: "Bairro QA",
      }));
      const state = {
        page: configureQaPage(await page.context().newPage()),
        liveGate: Promise.withResolvers(),
        referenceGate: Promise.withResolvers(),
        project: `empreendimento concorrente ${index + 1}`,
        order: index === 0 ? "desc" : "asc",
        expectedRows: items
          .filter(
            (item) => item.project.toLowerCase() === `empreendimento concorrente ${index + 1}`,
          )
          .sort((left, right) => (index === 0 ? -1 : 1) * (left.finalWithKit - right.finalWithKit))
          .map((item) => ({
            id: item.id,
            price: currency.format(item.finalWithKit),
            address: [item.street, item.streetNumber, item.neighborhood].join(" / "),
          })),
      };
      concurrentPages.push(state);
      state.page.on("pageerror", () => {
        concurrentPageErrors += 1;
      });
      await state.page.route("**/api/inventory", async (interceptedRoute) => {
        await state.liveGate.promise;
        await interceptedRoute.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({
            ...livePayload,
            count: items.length,
            items: items.map((item) => ({
              ...item,
              street: null,
              streetNumber: null,
              neighborhood: null,
            })),
          }),
        });
      });
      await state.page.route("**/api/inventory/snapshot*", async (interceptedRoute) => {
        await state.referenceGate.promise;
        await interceptedRoute.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({ ...protectedReferencePayload, count: items.length, items }),
        });
      });
    }
    await Promise.all(
      concurrentPages.map(async (state) => {
        await Promise.all([
          state.page.waitForRequest(
            (request) => new URL(request.url()).pathname === "/api/inventory",
          ),
          gotoWithServerRetry(state.page, url, { waitUntil: "domcontentloaded" }),
        ]);
        await state.page
          .getByText("Carregando unidades do estoque…", { exact: true })
          .waitFor({ state: "visible" });
      }),
    );
    // Resolve the second tab first, and set its filters while the first tab is still loading.
    for (const index of [1, 0]) {
      const state = concurrentPages[index];
      const referenceRequested = state.page.waitForRequest(
        (request) => new URL(request.url()).pathname === "/api/inventory/snapshot",
      );
      state.liveGate.resolve();
      await referenceRequested;
      await state.page
        .getByText("4 opções exclusivas · 2 empreendimentos", { exact: true })
        .waitFor({ state: "visible" });
      await state.page
        .locator('.investor-stock-filters select[name="project"]')
        .selectOption(state.project);
      await state.page
        .locator('.investor-stock-filters select[name="priceOrder"]')
        .selectOption(state.order);
      concurrentResponsesKeepFiltersIndependent &&= await concurrentSelectionMatches(state, false);
      if (index === 1) {
        concurrentResponsesKeepFiltersIndependent &&=
          (await concurrentPages[0].page
            .getByText("Carregando unidades do estoque…", { exact: true })
            .isVisible()) &&
          (await concurrentPages[0].page.locator('select[name="project"]').inputValue()) === "";
      }
    }
    for (const index of [1, 0]) {
      concurrentPages[index].referenceGate.resolve();
      await concurrentPages[index].page
        .getByText("Endereços complementados pela referência 05/09/2026", { exact: true })
        .waitFor({ state: "visible" });
      for (const [pageIndex, state] of concurrentPages.entries()) {
        concurrentResponsesKeepFiltersIndependent &&= await concurrentSelectionMatches(
          state,
          index === 0 || pageIndex === 1,
        );
      }
    }
    await concurrentPages[0].page
      .getByRole("button", { name: "Limpar filtros", exact: true })
      .click();
    await concurrentPages[0].page
      .getByText("4 opções exclusivas · 2 empreendimentos", { exact: true })
      .waitFor({ state: "visible" });
    concurrentResponsesKeepFiltersIndependent &&=
      (await concurrentPages[0].page.locator('select[name="project"]').inputValue()) === "" &&
      (await concurrentPages[0].page.locator("tr[data-inventory-unit-id]").count()) === 4 &&
      (await concurrentSelectionMatches(concurrentPages[1], true)) &&
      concurrentPageErrors === 0;
    process.stdout.write(
      `Tabelão QA: filtros independentes sob respostas concorrentes ${concurrentResponsesKeepFiltersIndependent}\n`,
    );
  } finally {
    for (const state of concurrentPages) {
      state.liveGate.resolve();
      state.referenceGate.resolve();
    }
    await Promise.all(
      concurrentPages.map(async (state) => {
        await state.page.unrouteAll({ behavior: "wait" });
        await state.page.close({ runBeforeUnload: false });
      }),
    );
  }

  // More than the former 60-row window, with multiple plants per project and one unpriced unit.
  const stressItems = Array.from({ length: 130 }, (_, index) =>
    [0, 1].map((variant) => ({
      ...syntheticTabelaoInventory[0],
      id: `qa-tabelao-${index}-${variant}`,
      identifier: `${index}-${variant}`,
      businessUnit: "Incorporadora QA",
      project: `Empreendimento QA ${Math.floor(index / 50)}`,
      plant: `Planta ${String(index).padStart(3, "0")}`,
      finalWithKit: 300_000 + index * 1_000 + variant * 10_000,
      unitBonus: 10_000,
      tableSlack: 5_000,
    })),
  ).flat();
  stressItems.push({ ...stressItems[0], id: "qa-tabelao-unpriced", finalWithKit: null });
  const stressHandler = async (interceptedRoute) =>
    interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        source: "QA synthetic grouped inventory",
        count: stressItems.length,
        items: stressItems,
      }),
    });
  await page.route("**/api/inventory", stressHandler);
  try {
    for (const viewport of requiredViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page
        .locator('tr[data-inventory-unit-id="qa-tabelao-129-0"]')
        .waitFor({ state: "attached" });
      const expansiveGroups = await page.evaluate(() => {
        const results = document.querySelector(".investor-stock-results");
        const groups = [...document.querySelectorAll(".tabelao-project-group")];
        const rows = [...document.querySelectorAll("tr[data-inventory-unit-id]")];
        return (
          groups.length === 3 &&
          rows.length === 130 &&
          groups.every((group, index) => {
            const headers = [...group.querySelectorAll('th[scope="rowgroup"]')];
            return (
              group.rows.length === [50, 50, 30][index] &&
              headers.length === 2 &&
              headers.every(
                (header) =>
                  header.rowSpan === group.rows.length &&
                  header.scrollWidth <= header.clientWidth + 1,
              )
            );
          }) &&
          rows.every(
            (row, index) =>
              Number(row.querySelector(".tabelao-stock-quantity").textContent.trim()) ===
                (index === 0 ? 3 : 2) &&
              row.getAttribute("aria-rowindex") === String(index + 2) &&
              [...row.querySelectorAll("td")].every((cell) =>
                cell.headers.split(" ").every((id) => document.getElementById(id)),
              ),
          ) &&
          results.scrollHeight <= results.clientHeight + 2 &&
          document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        );
      });
      await page.locator('tr[data-inventory-unit-id="qa-tabelao-129-0"]').scrollIntoViewIfNeeded();
      const lastRowReachable = await page
        .locator('tr[data-inventory-unit-id="qa-tabelao-129-0"]')
        .evaluate((row) => {
          const box = row.getBoundingClientRect();
          return box.top >= 0 && box.bottom <= innerHeight + 1 && window.scrollY > 0;
        });
      const headerFollowsPageScroll = await checkTabelaoHeaderScrolling(page);
      const panel = page.locator(".investor-stock-filters");
      await panel.locator('select[name="priceOrder"]').selectOption("desc");
      await page.waitForFunction(
        () =>
          document
            .querySelector("tr[data-inventory-unit-id]")
            ?.getAttribute("data-inventory-unit-id") === "qa-tabelao-49-0",
      );
      await panel.locator('select[name="plant"]').selectOption("planta 000");
      await page.waitForFunction(
        () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 1,
      );
      const filteredMerge = await page.evaluate(() => {
        const headers = [...document.querySelectorAll('th[scope="rowgroup"]')];
        return (
          headers.length === 2 &&
          headers.every((header) => header.rowSpan === 1) &&
          document.querySelector(".tabelao-stock-quantity").textContent.trim() === "3"
        );
      });
      await panel.getByRole("button", { name: "Limpar filtros", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll("tr[data-inventory-unit-id]").length === 130,
      );
      const restoredMerge = await page
        .locator('th[scope="rowgroup"]')
        .evaluateAll(
          (headers) =>
            headers.length === 6 &&
            headers.map((header) => header.rowSpan).join(",") === "50,50,50,50,30,30",
        );
      viewportChecks.push({
        key: `grouped-${viewport.key}`,
        expansiveGroups,
        lastRowReachable,
        headerFollowsPageScroll,
        filteredMerge,
        restoredMerge,
      });
    }
  } finally {
    await page.unroute("**/api/inventory", stressHandler);
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  const compactItems = buildTabelaoCompactFixture();
  const compactHandler = async (interceptedRoute) =>
    interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        source: "QA compact synthetic inventory",
        count: compactItems.length,
        items: compactItems,
      }),
    });
  await page.route("**/api/inventory", compactHandler);
  try {
    for (const viewport of requiredViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page
        .locator('tr[data-inventory-unit-id="qa-compact-10"]')
        .waitFor({ state: "attached" });
      const layout = await page.evaluate(readTabelaoCompactLayout);
      viewportChecks.push({
        key: `compact-${viewport.key}`,
        compactColumnWidths: layout.compactColumnWidths,
        compactTextFullyVisible: layout.compactTextFullyVisible,
        compactFrameFitsTable: layout.compactFrameFitsTable,
        compactFrameInsidePanel: layout.compactFrameInsidePanel,
        readableText: layout.readableText,
        localizedLabels: layout.localizedLabels,
        localizedFilters: layout.localizedFilters,
        headersSingleLine: layout.headersSingleLine,
        adjustedColumnProportions: layout.adjustedColumnProportions,
        desktopFitsWithoutHorizontalScroll: layout.desktopFitsWithoutHorizontalScroll,
        desktopLimitadorVisible: layout.desktopLimitadorVisible,
        consecutiveDisplayedValuesOnly: await checkTabelaoCompactFixture(page),
      });
    }
  } finally {
    await page.unroute("**/api/inventory", compactHandler);
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  const emptyHandler = async (interceptedRoute) => {
    await interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ source: "QA empty", count: 0, items: [] }),
    });
  };
  await page.route("**/api/inventory", emptyHandler);
  await page.reload({ waitUntil: "domcontentloaded" });
  const emptyMessage = page
    .locator("td")
    .getByText("Nenhuma unidade com dados válidos para comparar.", {
      exact: true,
    });
  await emptyMessage.waitFor({ state: "visible" });
  const emptyStateVisible = await emptyMessage.isVisible();
  process.stdout.write("Tabelão QA: estado vazio verificado\n");
  await page.unroute("**/api/inventory", emptyHandler);

  const errorHandler = async (interceptedRoute) => {
    await interceptedRoute.fulfill({
      status: 503,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ error: "qa_inventory_unavailable" }),
    });
  };
  await page.route("**/api/inventory", errorHandler);
  await page.reload({ waitUntil: "domcontentloaded" });
  const errorMessage = page.getByText(
    "Arquivo oficial do estoque indisponível. Nenhuma fonte alternativa foi usada.",
    { exact: false },
  );
  await errorMessage.waitFor({ state: "visible" });
  const retryButton = page.getByRole("button", { name: "Tentar novamente", exact: true });
  const errorStateAccessible =
    (await retryButton.isVisible()) &&
    (await retryButton.evaluate((element) => element.getBoundingClientRect().height >= 43));
  await page.unroute("**/api/inventory", errorHandler);
  await retryButton.click();
  await page
    .locator(".investor-stock-sync")
    .getByText(syntheticTabelaoCountLabel, { exact: true })
    .waitFor({ state: "visible", timeout: qaNavigationTimeout });
  process.stdout.write("Tabelão QA: erro e recuperação verificados\n");

  let releaseLoadingRequest;
  const loadingGate = new Promise((resolve) => {
    releaseLoadingRequest = resolve;
  });
  const loadingHandler = async (interceptedRoute) => {
    await loadingGate;
    await interceptedRoute.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: syntheticDirectTableSnapshot,
    });
  };
  await page.route("**/api/inventory", loadingHandler);
  const loadingReload = page.reload({ waitUntil: "domcontentloaded" });
  const loadingMessage = page.getByText("Carregando unidades do estoque…", { exact: true });
  await loadingMessage.waitFor({ state: "visible" });
  const loadingStateVisible = await loadingMessage.isVisible();
  releaseLoadingRequest();
  await loadingReload;
  await page.unroute("**/api/inventory", loadingHandler);
  await page
    .locator(".investor-stock-sync")
    .getByText(syntheticTabelaoCountLabel, { exact: true })
    .waitFor({ state: "visible", timeout: qaNavigationTimeout });

  const cookiePreferencesTrigger = page.getByRole("button", {
    name: "Preferências de cookies",
    exact: true,
  });
  const cookiePreferencesBanner = page.locator('aside[aria-labelledby="cookie-consent-title"]');
  const waitForCookiePreferencesClosed = async () => {
    await cookiePreferencesBanner.waitFor({ state: "hidden", timeout: qaNavigationTimeout });
    await cookiePreferencesTrigger.waitFor({
      state: "visible",
      timeout: qaNavigationTimeout,
    });
    await expect
      .poll(
        async () => {
          const triggerCount = await cookiePreferencesTrigger.count();
          return {
            bannerHidden: !(await cookiePreferencesBanner.isVisible()),
            triggerCount,
            triggerVisible: triggerCount === 1 && (await cookiePreferencesTrigger.isVisible()),
          };
        },
        {
          timeout: qaNavigationTimeout,
          message: "Cookie preferences must close into one visible trigger",
        },
      )
      .toEqual({ bannerHidden: true, triggerCount: 1, triggerVisible: true });
  };
  await waitForCookiePreferencesClosed();
  await cookiePreferencesTrigger.scrollIntoViewIfNeeded();
  const cookieTriggerSafe =
    (await cookiePreferencesTrigger.count()) === 1 &&
    (await cookiePreferencesTrigger.isVisible()) &&
    (await cookiePreferencesTrigger.isEnabled()) &&
    (await cookiePreferencesTrigger.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return (
        element instanceof HTMLButtonElement &&
        element.type === "button" &&
        element.hasAttribute("data-qa-visual-volatile") &&
        box.width >= 44 &&
        box.height >= 44 &&
        box.left >= 0 &&
        box.right <= innerWidth &&
        box.top >= 0 &&
        box.bottom <= innerHeight
      );
    }));
  let cookiePreferencesSafe = false;
  if (cookieTriggerSafe) {
    await cookiePreferencesTrigger.click();
    await cookiePreferencesBanner.waitFor({ state: "visible", timeout: qaNavigationTimeout });
    const lockedSecurityCategories = await cookiePreferencesBanner.evaluate((banner) =>
      ["Essenciais", "Segurança"].every((label) => {
        const category = [...banner.querySelectorAll("label")].find(
          (candidate) => candidate.querySelector("strong")?.textContent?.trim() === label,
        );
        const checkbox = category?.querySelector('input[type="checkbox"]');
        return checkbox instanceof HTMLInputElement && checkbox.checked && checkbox.disabled;
      }),
    );
    const closePreferences = cookiePreferencesBanner.getByRole("button", {
      name: "Fechar preferências",
      exact: true,
    });
    const closeControlSafe =
      (await closePreferences.count()) === 1 &&
      (await closePreferences.isVisible()) &&
      (await closePreferences.isEnabled());
    let cookiePreferencesClosed = false;
    if (closeControlSafe) {
      await closePreferences.click();
      await waitForCookiePreferencesClosed();
      cookiePreferencesClosed = true;
    }
    cookiePreferencesSafe = lockedSecurityCategories && closeControlSafe && cookiePreferencesClosed;
  }
  const responsiveGrid = viewportChecks.every((check) =>
    Object.entries(check)
      .filter(([key]) => key !== "key")
      .every(([, value]) => value === true),
  );
  process.stdout.write(`Tabelão QA: ${JSON.stringify(viewportChecks)}\n`);
  const regionParkingFlow = await checkTabelaoRegionParkingFixture(page);
  let regionOrderAndLayout = await checkTabelaoRegionOrderFixture(page, requiredViewports);
  let typographyAndLabels = await checkTabelaoTypographyFixture(page, requiredViewports);
  const layoutAndResources = await checkTabelaoLayout(page);
  const mapsDestinations = await checkTabelaoMapsFixture(page);
  typographyAndLabels &&= Object.values(layoutAndResources).every(Boolean);
  regionOrderAndLayout &&= Object.values(mapsDestinations).every(Boolean);
  process.stdout.write(`Tabelão QA: layout e recursos ${JSON.stringify(layoutAndResources)}\n`);
  process.stdout.write(`Tabelão QA: destinos Maps ${JSON.stringify(mapsDestinations)}\n`);

  return {
    responsiveGrid: responsiveGrid && typographyAndLabels,
    spotlightSized,
    placementClassApplied,
    guideReachedLastStep,
    guideCompletionReturnedFocus,
    guideEscapeReturnedFocus,
    exclusiveRows: exclusiveRows && regionParkingFlow,
    netPrices,
    groupedProjects: groupedProjects && regionOrderAndLayout,
    liveAvailableBeforeLocationReference,
    locationReferenceApplied,
    locationMetadataFits,
    malformedPayloadRecoverable,
    malformedPayloadRetryRestoresInventory,
    completeLiveSkipsLocationReference,
    concurrentResponsesKeepFiltersIndependent,
    emptyStateVisible,
    errorStateAccessible,
    loadingStateVisible,
    cookieBannerHidden: cookiePreferencesSafe,
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
      .locator('.investor-direct-ready-options button[aria-disabled="false"]')
      .first()
      .click();
    await auxiliaryPage
      .locator(
        '.investor-direct-table-compact-account .investor-direct-credit-result[role="status"] strong',
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
  const inventoryResults = page.getByRole("region", {
    name: "Estoque completo de unidades",
    exact: true,
  });
  const allInventoryRowsInSingleScroll =
    (await inventoryRows.count()) > 0 &&
    (await inventoryRows.count()) < 3_301 &&
    (await page.locator(".investor-stock-table").getAttribute("aria-rowcount")) === "3302";
  const startsWithoutSelectedUnit = (await selectedUnitButtons.count()) === 0;
  const inventoryHeaderText = (await inventoryStatus.innerText()).replace(/\s+/g, " ");
  const fullInventoryCountVisible = inventoryHeaderText.includes("3.301 unidades");
  const inventoryOriginVisible = inventoryHeaderText.includes(
    "Arquivo ESTOQUE SPC.xlsx · referência 05/09/2026",
  );
  const paginationControlsRemoved =
    (await page.getByRole("navigation", { name: "Paginação do estoque completo" }).count()) === 0;
  const stockUsesSingleScrollbar = await inventoryResults.evaluate((element) => {
    if (!(element instanceof HTMLElement)) return false;
    return element.scrollHeight > element.clientHeight;
  });
  await inventoryResults.evaluate((element) => {
    if (element instanceof HTMLElement) element.scrollTop = element.scrollHeight;
  });
  const lastInventoryRow = page.locator('.investor-stock-table tbody tr[aria-rowindex="3302"]');
  await lastInventoryRow.waitFor({ timeout: qaNavigationTimeout });
  const scrollReachesLastInventoryRow = await lastInventoryRow.evaluate((row) => {
    const results = row.closest(".investor-stock-results");
    if (!(results instanceof HTMLElement)) return false;
    const rowRect = row.getBoundingClientRect();
    const resultsRect = results.getBoundingClientRect();
    return (
      row.getAttribute("aria-rowindex") === "3302" &&
      rowRect.bottom <= resultsRect.bottom + 1 &&
      rowRect.bottom >= resultsRect.top
    );
  });
  await inventoryResults.evaluate((element) => {
    if (element instanceof HTMLElement) element.scrollTop = 0;
  });

  const firstSelectableRow = page.locator(".investor-stock-table tbody tr.selectable").first();
  await firstSelectableRow.click();
  await page.waitForFunction(() => {
    const target = document.querySelector(
      ".investor-property-summary.investor-guided-scroll-target",
    );
    if (!(target instanceof HTMLElement)) return false;
    const rectangle = target.getBoundingClientRect();
    return rectangle.top >= 0 && rectangle.top < window.innerHeight;
  });
  const manualUnitSelectionWorks =
    (await selectedUnitButtons.count()) === 1 &&
    (await firstSelectableRow.getAttribute("aria-selected")) === "true" &&
    (await page
      .getByRole("article", { name: "Descrição do imóvel usado na proposta", exact: true })
      .isVisible());
  const unitSelectionStartsGuidedJourney = await page
    .getByRole("article", { name: "Descrição do imóvel usado na proposta", exact: true })
    .evaluate((target) => {
      const rectangle = target.getBoundingClientRect();
      return (
        target === document.activeElement &&
        rectangle.top >= 0 &&
        rectangle.top < window.innerHeight
      );
    });

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
  const optionPaymentRowChecks = [];
  const optionResultLayoutChecks = [];
  const optionReadyAnswerChecks = [];
  for (let index = 0; index < (await proposalOptions.count()); index += 1) {
    const option = proposalOptions.nth(index);
    const available =
      (await option.isVisible()) &&
      (await option.isEnabled()) &&
      (await option.getAttribute("aria-disabled")) === "false";
    const scrollBeforeSelection = await page.evaluate(() => window.scrollY);
    await option.click();
    const readyAnswer = page.locator(".investor-direct-comparison-card").first();
    await readyAnswer.waitFor({ state: "visible", timeout: 10_000 });
    optionReadyAnswerChecks.push(
      await option.evaluate((button, initialScrollY) => {
        const answer = document.querySelector(".investor-direct-comparison-card");
        const flow = document.querySelector(".investor-direct-flow-panel");
        const answerRectangle = answer?.getBoundingClientRect();
        return (
          button === document.activeElement &&
          Math.abs(window.scrollY - initialScrollY) <= 2 &&
          answerRectangle instanceof DOMRect &&
          answerRectangle.top >= 0 &&
          answerRectangle.top < window.innerHeight &&
          flow !== document.activeElement
        );
      }, scrollBeforeSelection),
    );
    optionSelectionChecks.push(
      available &&
        (await option.getAttribute("aria-pressed")) === "true" &&
        (await page
          .locator('.investor-direct-ready-options button[aria-pressed="true"]')
          .count()) === 1,
    );
    optionPaymentRowChecks.push(
      await page
        .locator(".investor-direct-comparison-card")
        .first()
        .evaluate((card, optionIndex) => {
          const parseAmount = (value) =>
            Number(
              value
                .replace(/[^\d,.-]/g, "")
                .replace(/\./g, "")
                .replace(",", "."),
            );
          const rows = [...card.querySelectorAll(".investor-direct-comparison-ledger-row")].map(
            (row) => ({
              label:
                row
                  .querySelector(".investor-direct-comparison-ledger-label strong")
                  ?.textContent?.trim() ?? "",
              value: parseAmount(
                row.querySelector(".investor-direct-comparison-ledger-value")?.textContent ?? "",
              ),
              invalid: row.classList.contains("is-invalid"),
            }),
          );
          const individualLabels = rows
            .map((row) => row.label)
            .filter((label) => /^(Sinal|Intermediária) \d+$/u.test(label));
          const amountFor = (label) => rows.find((row) => row.label === label)?.value ?? 0;
          const signals = rows.filter((row) => /^Sinal \d+$/u.test(row.label));
          const intermediaries = rows.filter((row) => /^Intermediária \d+$/u.test(row.label));
          const expectedSignalLabels =
            optionIndex === 1 || optionIndex === 3 ? ["Sinal 1", "Sinal 2", "Sinal 3"] : [];
          const intermediaryLabels = intermediaries.map((row) => row.label);
          const expectsIntermediaries = optionIndex === 2 || optionIndex === 3;
          const intermediariesAreConsecutive = intermediaryLabels.every(
            (label, intermediaryIndex) => label === `Intermediária ${intermediaryIndex + 1}`,
          );
          const expectedLabels = [...expectedSignalLabels, ...intermediaryLabels];
          const labelsMatch =
            JSON.stringify(signals.map((row) => row.label)) ===
              JSON.stringify(expectedSignalLabels) &&
            (expectsIntermediaries
              ? intermediaryLabels.length > 0
              : intermediaryLabels.length === 0) &&
            intermediariesAreConsecutive &&
            JSON.stringify(individualLabels) === JSON.stringify(expectedLabels);
          const reconciled =
            amountFor("Valor real da venda") -
            amountFor("Ato") -
            signals.reduce((total, row) => total + row.value, 0) -
            intermediaries.reduce((total, row) => total + row.value, 0) -
            amountFor("Saldo parcelado pré-chaves") -
            amountFor("Saldo financiado");
          return (
            labelsMatch &&
            [...signals, ...intermediaries].every((row) => row.value > 0 && !row.invalid) &&
            Math.abs(reconciled) <= 0.02
          );
        }, index),
    );
    optionResultLayoutChecks.push(
      await page
        .locator(".investor-direct-comparison-card")
        .first()
        .evaluate((card) => {
          const heading = card.querySelector(".investor-direct-comparison-heading");
          const optionLine = heading?.querySelector(".investor-direct-comparison-option-line");
          const infoTrigger = optionLine?.querySelector(".investor-info-trigger");
          const rows = [...card.querySelectorAll(".investor-direct-comparison-ledger-row")];
          const resultRow = rows.at(-1);
          const resultStatus = resultRow?.querySelector(
            ".investor-direct-comparison-result-value .investor-direct-credit-result",
          );
          const resultLabel = resultStatus?.querySelector("strong")?.textContent?.trim() ?? "";
          const resultCommitment = resultStatus?.querySelector("small")?.textContent?.trim() ?? "";
          const headingRect = heading?.getBoundingClientRect();
          const optionLineRect = optionLine?.getBoundingClientRect();
          const infoTriggerRect = infoTrigger?.getBoundingClientRect();
          const infoHitArea =
            infoTrigger instanceof HTMLElement ? getComputedStyle(infoTrigger, "::before") : null;
          return (
            heading instanceof HTMLElement &&
            optionLine instanceof HTMLElement &&
            infoTrigger instanceof HTMLButtonElement &&
            headingRect !== undefined &&
            optionLineRect !== undefined &&
            infoTriggerRect !== undefined &&
            Math.abs(headingRect.height - 23) <= 1 &&
            Math.abs(infoTriggerRect.height - 23) <= 1 &&
            optionLineRect.top >= headingRect.top - 1 &&
            optionLineRect.bottom <= headingRect.bottom + 1 &&
            infoHitArea?.width === "44px" &&
            infoHitArea.height === "44px" &&
            heading.querySelector(".investor-direct-credit-status") === null &&
            resultRow
              ?.querySelector(".investor-direct-comparison-ledger-label strong")
              ?.textContent?.trim() === "Resultado da proposta" &&
            resultStatus instanceof HTMLElement &&
            resultStatus.getAttribute("role") === null &&
            resultStatus.getAttribute("aria-live") === null &&
            resultStatus.parentElement?.getAttribute("aria-colspan") === "3" &&
            /^(APROVADO|REPROVADO|AJUSTE NECESSÁRIO|PENDENTE)$/u.test(resultLabel) &&
            (resultCommitment === "" || /^\d+,\d+% da renda$/u.test(resultCommitment))
          );
        }),
    );
  }
  const allProposalOptionsSelectable =
    optionSelectionChecks.length === 4 && optionSelectionChecks.every(Boolean);
  const individualProposalPaymentsRendered =
    optionPaymentRowChecks.length === 4 && optionPaymentRowChecks.every(Boolean);
  const proposalResultMovedToLedger =
    optionResultLayoutChecks.length === 4 && optionResultLayoutChecks.every(Boolean);
  const optionSelectionStaysOnReadyAnswer =
    optionReadyAnswerChecks.length === 4 && optionReadyAnswerChecks.every(Boolean);
  const summaryInfoButton = page.getByRole("button", {
    name: /Informações sobre resumo da opção \d/u,
  });
  const summaryRemovedFromCard =
    (await page.locator(".investor-direct-comparison-heading p").count()) === 0 &&
    (await summaryInfoButton.count()) === 1;
  await summaryInfoButton.click();
  const summaryInfoNote = page.getByRole("note", { name: "Composição da opção selecionada" });
  const summaryInfoText = (await summaryInfoNote.textContent())?.replace(/\s+/g, " ").trim() ?? "";
  const selectedOptionSummaryOnlyInInfo =
    summaryRemovedFromCard &&
    (await summaryInfoNote.isVisible()) &&
    summaryInfoText.includes("Ato de 6,0%") &&
    summaryInfoText.includes("3 sinais somam 4,0%") &&
    summaryInfoText.includes("intermediárias somam");
  const contextualHelpUsesTopLayer = await summaryInfoNote.evaluate((note) => {
    const rectangle = note.getBoundingClientRect();
    const center = document.elementFromPoint(
      rectangle.left + rectangle.width / 2,
      rectangle.top + Math.min(rectangle.height / 2, 24),
    );
    return (
      note.matches(":popover-open") &&
      (center === note || note.contains(center)) &&
      rectangle.left >= -1 &&
      rectangle.right <= window.innerWidth + 1 &&
      rectangle.top >= -1 &&
      rectangle.bottom <= window.innerHeight + 1
    );
  });
  await page.keyboard.press("Escape");
  await proposalOptions.first().click();

  const proposalStatus = page.locator(
    '.investor-direct-table-compact-account .investor-direct-credit-result[role="status"][aria-live="polite"][aria-atomic="true"]',
  );
  const approvedProposalStatusVisible =
    (await proposalStatus.isVisible()) &&
    (await proposalStatus.locator("strong").textContent())?.trim() === "APROVADO";

  const paymentRulesTrigger = page.getByRole("button", {
    name: "Informações sobre regra de parcelamento",
    exact: true,
  });
  const paymentRulesLabelVisible = await page
    .locator(".investor-direct-rule-help")
    .getByText("Regra", { exact: true })
    .isVisible();
  await paymentRulesTrigger.click();
  const paymentRulesNote = page.getByRole("note", { name: "Regras de parcelamento" });
  await paymentRulesNote.waitFor({ state: "visible", timeout: 2_000 });
  const paymentRulesText =
    (await paymentRulesNote.textContent())?.replace(/\s+/g, " ").trim() ?? "";
  const paymentRulesAreConciseAndCompact =
    paymentRulesLabelVisible &&
    (await paymentRulesNote.evaluate((note) => note.matches(":popover-open"))) &&
    [
      "1. Entrada:",
      "2. Sinais:",
      "3. Intermediárias:",
      "4. Parcelas pré-chaves:",
      "5. Parcelas pós-chaves:",
      "6. Renda:",
      "dentro do saldo pré-chaves",
      "coincidir com uma mensal",
    ].every((expected) => paymentRulesText.includes(expected)) &&
    !paymentRulesText.includes("Imagine") &&
    (await paymentRulesNote.evaluate((note) => {
      const rectangle = note.getBoundingClientRect();
      return rectangle.width <= 421 && rectangle.height <= 421;
    }));
  await page.keyboard.press("Escape");
  await paymentRulesNote.waitFor({ state: "hidden", timeout: 2_000 });

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

  const actInput = page.getByRole("textbox", { name: "Valor do ato", exact: true });
  const presetSignalValues = await page
    .locator('input[aria-label^="Valor do sinal "]')
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  const presetIntermediaryValues = await page
    .locator('input[aria-label^="Valor da intermediária "]')
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  const readyOptionalPaymentInputs =
    presetSignalValues.length === 3 && presetIntermediaryValues.length > 0;

  await incomeInput.fill("9000000");
  const optionalPaymentsPersistAfterIncomeChange =
    JSON.stringify(
      await page
        .locator('input[aria-label^="Valor do sinal "]')
        .evaluateAll((inputs) => inputs.map((input) => input.value)),
    ) === JSON.stringify(presetSignalValues) &&
    JSON.stringify(
      await page
        .locator('input[aria-label^="Valor da intermediária "]')
        .evaluateAll((inputs) => inputs.map((input) => input.value)),
    ) === JSON.stringify(presetIntermediaryValues);

  await proposalOptions.nth(2).click();
  await proposalOptions.last().click();
  const optionSwitchReloadsReadyPreset =
    JSON.stringify(
      await page
        .locator('input[aria-label^="Valor do sinal "]')
        .evaluateAll((inputs) => inputs.map((input) => input.value)),
    ) === JSON.stringify(presetSignalValues) &&
    JSON.stringify(
      await page
        .locator('input[aria-label^="Valor da intermediária "]')
        .evaluateAll((inputs) => inputs.map((input) => input.value)),
    ) === JSON.stringify(presetIntermediaryValues);

  const intermediaryAdjustmentInput = page
    .locator('input[aria-label^="Valor da intermediária "]')
    .last();

  await proposalStatus.getByText("APROVADO", { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });

  const actBeforeInvalidState = await actInput.inputValue();
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
      (await snapshotPage.locator(".investor-stock-table").getAttribute("aria-rowcount")) ===
        "3302" &&
      (await snapshotPage.locator(".investor-stock-table tbody tr.selectable").count()) > 0 &&
      (await snapshotPage
        .getByRole("navigation", { name: "Paginação do estoque completo", exact: true })
        .count()) === 0;
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
    await responsivePage.mouse.move(0, 0);
    await responsivePage.keyboard.press("Escape");
    const mobileInfoDialog = mobileComparison.locator(
      ".investor-direct-comparison-heading .investor-info-dialog",
    );
    await mobileComparison
      .locator(".investor-direct-comparison-heading .investor-info-trigger")
      .click();
    await mobileInfoDialog.waitFor({ state: "visible", timeout: 2_000 });
    const mobileInfoDialogDiagnostics = await mobileInfoDialog.evaluate((dialog) => {
      const root = document.documentElement;
      const body = document.body;
      const rectangle = dialog.getBoundingClientRect();
      return {
        bounds: {
          left: rectangle.left,
          right: rectangle.right,
          top: rectangle.top,
          bottom: rectangle.bottom,
          width: rectangle.width,
          height: rectangle.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
        dialogFitsWidth: dialog.scrollWidth <= dialog.clientWidth + 1,
        dialogFitsHeight: dialog.scrollHeight <= dialog.clientHeight + 1,
        rootFits: root.scrollWidth <= root.clientWidth + 1,
        bodyFits: body.scrollWidth <= body.clientWidth + 1,
      };
    });
    const mobileInfoDialogFitsViewport =
      mobileInfoDialogDiagnostics.bounds.left >= -1 &&
      mobileInfoDialogDiagnostics.bounds.right <=
        mobileInfoDialogDiagnostics.bounds.viewportWidth + 1 &&
      mobileInfoDialogDiagnostics.bounds.top >= -1 &&
      mobileInfoDialogDiagnostics.bounds.bottom <=
        mobileInfoDialogDiagnostics.bounds.viewportHeight + 1 &&
      mobileInfoDialogDiagnostics.dialogFitsWidth &&
      mobileInfoDialogDiagnostics.dialogFitsHeight &&
      mobileInfoDialogDiagnostics.rootFits &&
      mobileInfoDialogDiagnostics.bodyFits;
    if (!mobileInfoDialogFitsViewport) {
      console.log(`Mobile info dialog diagnostics: ${JSON.stringify(mobileInfoDialogDiagnostics)}`);
    }
    await responsivePage.keyboard.press("Escape");
    await mobileInfoDialog.waitFor({ state: "hidden", timeout: 2_000 });
    const mobileComparisonDiagnostics = await mobileComparison.evaluate((card, infoDialogFits) => {
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
      const measurementCanvas = document.createElement("canvas");
      const measurementContext = measurementCanvas.getContext("2d");
      const measureText = (element, text) => {
        if (!(element instanceof HTMLElement) || !measurementContext)
          return Number.POSITIVE_INFINITY;
        measurementContext.font = getComputedStyle(element).font;
        return measurementContext.measureText(text).width;
      };
      const rowDiagnostics = rows.map((row) => {
        const isResultRow = row.classList.contains("investor-direct-comparison-result-row");
        const cells = [
          row.querySelector(".investor-direct-comparison-ledger-label"),
          row.querySelector(
            isResultRow
              ? ".investor-direct-comparison-result-value"
              : ".investor-direct-comparison-ledger-operator",
          ),
          isResultRow ? null : row.querySelector(".investor-direct-comparison-ledger-currency"),
          isResultRow ? null : row.querySelector(".investor-direct-comparison-ledger-value"),
          row.querySelector(".investor-direct-comparison-ledger-help"),
        ].filter((element) => element instanceof HTMLElement);
        const label = row.querySelector(".investor-direct-comparison-ledger-label strong");
        const value = row.querySelector(
          isResultRow
            ? ".investor-direct-comparison-result-value"
            : ".investor-direct-comparison-ledger-value",
        );
        const valueContent = isResultRow
          ? row.querySelector(".investor-direct-credit-result")
          : value;
        const labelStyle = label ? getComputedStyle(label) : null;
        const valueStyle = value ? getComputedStyle(value) : null;
        const resultStrong = isResultRow ? valueContent?.querySelector("strong") : null;
        const resultSmall = isResultRow ? valueContent?.querySelector("small") : null;
        const resultGap =
          isResultRow && valueContent instanceof HTMLElement
            ? Number.parseFloat(getComputedStyle(valueContent).columnGap) || 0
            : 0;
        const worstResultWidth = isResultRow
          ? measureText(resultStrong, "AJUSTE NECESSÁRIO") +
            resultGap +
            measureText(resultSmall, "999,99% da renda")
          : 0;
        const labelRect = label?.parentElement?.getBoundingClientRect();
        const valueRect = value?.getBoundingClientRect();
        const helpRect = cells.at(-1)?.getBoundingClientRect();
        const cellsOrdered = isResultRow
          ? Boolean(
              labelRect &&
              valueRect &&
              helpRect &&
              labelRect.bottom <= valueRect.top + 1 &&
              valueRect.right <= helpRect.left + 1,
            )
          : orderedWithoutOverlap(cells);
        const checks = {
          rowFits: row.scrollWidth <= row.clientWidth + 1,
          cellCount: cells.length === (isResultRow ? 3 : 5),
          cellOrder: cellsOrdered,
          labelFits: fitsOwnBox(label),
          valueFits: fitsOwnBox(value),
          valueContentFits: fitsOwnBox(valueContent),
          resultWorstCaseFits:
            !isResultRow ||
            (valueContent instanceof HTMLElement &&
              worstResultWidth <= valueContent.clientWidth + 1),
          labelNotEllipsized: labelStyle?.textOverflow !== "ellipsis",
          labelWraps: labelStyle?.whiteSpace === "normal",
          valueNotEllipsized: valueStyle?.textOverflow !== "ellipsis",
          valueWraps: valueStyle?.whiteSpace === "normal",
        };
        return {
          label: label?.textContent?.trim() ?? "",
          passed: Object.values(checks).every(Boolean),
          checks,
          rowWidth: [row.clientWidth, row.scrollWidth],
          valueWidth: value instanceof HTMLElement ? [value.clientWidth, value.scrollWidth] : null,
          valueContentWidth:
            valueContent instanceof HTMLElement
              ? [valueContent.clientWidth, valueContent.scrollWidth]
              : null,
          worstResultWidth: isResultRow ? Math.ceil(worstResultWidth) : null,
        };
      });
      const checks = {
        infoDialogFitsViewport: infoDialogFits,
        windowWidth: window.innerWidth === 375,
        rootFits: root.scrollWidth <= root.clientWidth + 1,
        bodyFits: body.scrollWidth <= body.clientWidth + 1,
        cardLeftFits: cardRect.left >= -1,
        cardRightFits: cardRect.right <= window.innerWidth + 1,
        cardContentFits: card.scrollWidth <= card.clientWidth + 1,
        rowCount: rows.length >= 8,
        rowsPass: rowDiagnostics.every((row) => row.passed),
      };
      return {
        passed: Object.values(checks).every(Boolean),
        checks,
        cardWidth: [card.clientWidth, card.scrollWidth],
        failedRows: rowDiagnostics.filter((row) => !row.passed),
      };
    }, mobileInfoDialogFitsViewport);
    mobileComparisonHasNoTruncationOrOverlap = mobileComparisonDiagnostics.passed;
    if (!mobileComparisonHasNoTruncationOrOverlap) {
      process.stdout.write(
        `Mobile comparison diagnostics: ${JSON.stringify(mobileComparisonDiagnostics)}\n`,
      );
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
      const simulationMenuUnclipped = await checkArchiveMenuPanel(
        responsivePage,
        "Simulação",
        "authorized-navigation-crm-simulation",
      );
      const settingsMenuUnclipped = await checkArchiveMenuPanel(
        responsivePage,
        "Configurações",
        "authorized-navigation-crm-settings",
      );
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
    await historyPage.getByRole("heading", { name: "Hub de Simulação", exact: true }).waitFor({
      state: "visible",
      timeout: qaNavigationTimeout,
    });
    const spaMarker = `direct-table-spa-${Date.now()}`;
    await historyPage.evaluate((marker) => {
      window.__authenticatedDirectTableSpaMarker = marker;
    }, spaMarker);
    const directTableHubLink = historyPage
      .locator("[data-protected-main-content]")
      .locator(`a[href="${directTablePath}"]`)
      .first();
    await directTableHubLink.waitFor({ state: "visible", timeout: 10_000 });
    await directTableHubLink.click();
    await historyPage.waitForURL((url) => url.pathname === directTablePath, {
      timeout: qaNavigationTimeout,
    });
    await waitForDirectInventory(historyPage);
    const markerAfterDirectNavigation = await historyPage.evaluate(
      () => window.__authenticatedDirectTableSpaMarker,
    );

    await historyPage.locator('[data-protected-brand][href="/app"]').click();
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
    allInventoryRowsInSingleScroll,
    paginationControlsRemoved,
    stockUsesSingleScrollbar,
    scrollReachesLastInventoryRow,
    startsWithoutSelectedUnit,
    manualUnitSelectionWorks,
    unitSelectionStartsGuidedJourney,
    incomeAccepted,
    fourProposalOptionsPresent,
    allProposalOptionsSelectable,
    individualProposalPaymentsRendered,
    proposalResultMovedToLedger,
    optionSelectionStaysOnReadyAnswer,
    selectedOptionSummaryOnlyInInfo,
    contextualHelpUsesTopLayer,
    paymentRulesAreConciseAndCompact,
    readyOptionalPaymentInputs,
    optionalPaymentsPersistAfterIncomeChange,
    optionSwitchReloadsReadyPreset,
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

async function checkZoom(
  origin,
  email,
  password,
  browser,
  httpCredentials,
  expectedAccountFirstName,
) {
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
            expectedAccountFirstName,
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
  tabelaoValidation,
  directTableValidation,
  archiveNavigation,
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
    screenshots.filter(({ approvedCanvasComparison }) => approvedCanvasComparison).length ===
      routes.length &&
    screenshots
      .filter(({ approvedCanvasComparison }) => approvedCanvasComparison)
      .every(({ approvedCanvasComparison }) => approvedCanvasComparison.passed) &&
    keyboard &&
    Object.values(keyboard).every(Boolean) &&
    simulatorValidation &&
    Object.values(simulatorValidation).every(Boolean) &&
    tabelaoValidation &&
    Object.values(tabelaoValidation).every(Boolean) &&
    directTableValidation &&
    Object.values(directTableValidation).every(Boolean) &&
    archiveNavigationPassed(archiveNavigation) &&
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
  const { firstName: expectedAccountFirstName, ...identityVerification } =
    await verifyDedicatedLocalQaIdentity(supabaseUrl, publishableKey, email, password);
  let browser = await chromium.launch({ headless: true });
  const routeChecks = [];
  const themeChecks = [];
  const accessibilityChecks = [];
  const screenshots = [];
  let keyboard = null;
  let simulatorValidation = null;
  let tabelaoValidation = null;
  let directTableValidation = null;
  let archiveNavigation = null;
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
          const check = await inspectRoute(
            page,
            origin,
            route,
            "light",
            consoleErrors,
            pageErrors,
            {
              expectedAccountFirstName,
            },
          );
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
          currentStage = "documentation-calculator";
          const documentationPage = configureQaPage(await context.newPage());
          try {
            const documentation = await checkDocumentationCalculator(
              documentationPage,
              origin,
              path.join(artifactRoot, "documentation"),
            );
            await writeFile(
              path.join(artifactRoot, "documentation-results.json"),
              JSON.stringify(documentation, null, 2),
            );
          } finally {
            await documentationPage.close({ runBeforeUnload: false });
          }
          currentStage = "archive-navigation";
          const navigationPage = configureQaPage(await context.newPage());
          navigationPage.setDefaultTimeout(archiveNavigationActionTimeout);
          const navigationProvenance = getCaptureProvenance();
          const candidateProgress = JSON.parse(await readFile(candidateResultsPath, "utf8"));
          archiveNavigation = {
            contract: "archive-navigation-v1",
            scope: "header-and-content",
            checks: [],
            passed: false,
          };
          const persistNavigationProgress = async () => {
            const capturedAt = new Date().toISOString();
            await writeJsonAtomically(archiveNavigationResultsPath, {
              ...navigationProvenance,
              capturedAt,
              environment: environmentLabel,
              data: "synthetic local-only fixtures; never production runtime",
              ...archiveNavigation,
            });
            await writeJsonAtomically(candidateResultsPath, {
              ...candidateProgress,
              capturedAt,
              failure: { stage: currentStage, kind: "sanitized" },
              archiveNavigation,
              passed: false,
            });
          };
          try {
            await persistNavigationProgress();
            archiveNavigation = await checkArchiveNavigation(navigationPage, origin, {
              openRoute: (destination, activePage) =>
                gotoWithServerRetry(activePage, destination, { waitUntil: "domcontentloaded" }),
              pageFactory: async () => {
                const freshPage = configureQaPage(await context.newPage());
                freshPage.setDefaultTimeout(archiveNavigationActionTimeout);
                return freshPage;
              },
              onCheck: async (check, activePage) => {
                archiveNavigation.checks.push(check);
                currentStage = `archive-navigation:${check.route}:${check.width}:${check.failedStage ?? "complete"}`;
                await persistNavigationProgress();
                process.stderr.write(
                  `[archive-navigation] ${check.route} ${check.width}px: ${check.passed ? "passed" : `failed (${check.failedStage})`}\n`,
                );
                if (check.passed) return;

                // Persist structural evidence first, even if screenshot capture fails or is unsafe.
                const safeFixtureCapture =
                  process.env.CI === "true" &&
                  !remoteHomologation &&
                  fixtureVerification === "rls-marker-v1" &&
                  identityVerification.accountPolicy === "qa.*@local.invalid" &&
                  activePage.url() === `${origin}${check.route}`;
                check.failureScreenshot = {
                  status: "skipped",
                  reason: "requires-verified-local-ci-fixture-on-expected-route",
                };
                if (safeFixtureCapture) {
                  try {
                    const buffer = await activePage.screenshot({
                      fullPage: false,
                      animations: "allow",
                      timeout: archiveNavigationActionTimeout,
                    });
                    check.failureScreenshot = {
                      status: "saved",
                      ...(await saveLosslessWebp(
                        buffer,
                        path.join(
                          candidateScreenshotRoot,
                          `archive-navigation-failure-${routeKey(check.route)}-${check.width}x${check.height}.webp`,
                        ),
                      )),
                    };
                  } catch {
                    check.failureScreenshot = { status: "unavailable", kind: "sanitized" };
                  }
                }
                await persistNavigationProgress();
              },
            });
            await persistNavigationProgress();
            if (!archiveNavigationPassed(archiveNavigation)) {
              throw new Error(
                "Archive navigation QA failed. Inspect archive-navigation-results.json.",
              );
            }
          } finally {
            await navigationPage.close({ runBeforeUnload: false });
          }
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
                { expectedAccountFirstName },
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
                const approvedCanvasComparison =
                  theme === "dark"
                    ? await compareApprovedCanvas(buffer, approvedCanvasByRoute.get(route))
                    : undefined;
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
                  ...(approvedCanvasComparison ? { approvedCanvasComparison } : {}),
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
          currentStage = "tabelao-validation";
          tabelaoValidation = await checkTabelaoValidation(page, origin);
          await stopSyntheticInventory();
          currentStage = "direct-table-validation";
          const directPage = configureQaPage(await context.newPage());
          const directConsoleErrors = [];
          const directPageErrors = [];
          directPage.on("console", (message) => {
            if (message.type() === "error") {
              directConsoleErrors.push(message.text());
              console.log(`Direct table console error: ${message.text()}`);
            }
          });
          directPage.on("pageerror", (error) => {
            directPageErrors.push(error.message);
            console.log(`Direct table page error: ${error.message}`);
          });
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
              { expectedAccountFirstName },
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
    const zoom = await checkZoom(
      origin,
      email,
      password,
      browser,
      httpCredentials,
      expectedAccountFirstName,
    );
    const functionalPassed = functionalChecksPassed({
      routeChecks,
      themeChecks,
      accessibilityChecks,
      screenshots,
      keyboard,
      simulatorValidation,
      tabelaoValidation,
      directTableValidation,
      archiveNavigation,
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
      tabelaoValidation,
      directTableValidation,
      archiveNavigation,
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
        approvedCanvasComparisons: routes.length,
        approvedCanvasColorDistanceThreshold,
        approvedCanvasEdgeDistanceThreshold,
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
        archiveNavigation,
        passed: false,
      });
    }
    throw new Error("Authenticated visual QA failed. Inspect candidate diagnostics.");
  } finally {
    await browser.close();
  }
}

await run();
