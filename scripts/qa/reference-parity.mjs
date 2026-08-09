import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "@playwright/test";
import sharp from "sharp";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(repositoryRoot, "docs/qa/reference-parity");
const manifestPath = path.join(outputRoot, "manifest.json");
const resultsPath = path.join(outputRoot, "results.json");
const captureCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const captureDiffPathspec = [".", ":(exclude)docs/qa/reference-parity/**"];
const worktreeDiff = execFileSync(
  "git",
  ["diff", "HEAD", "--binary", "--", ...captureDiffPathspec],
  {
    cwd: repositoryRoot,
    maxBuffer: 100 * 1024 * 1024,
  },
);
const untrackedFiles = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
  cwd: repositoryRoot,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.startsWith("docs/qa/reference-parity/"))
  .sort();
const worktreeHash = createHash("sha256");
worktreeHash.update("head-diff\0").update(worktreeDiff);
for (const file of untrackedFiles) {
  worktreeHash.update("untracked\0").update(file).update("\0");
  worktreeHash.update(readFileSync(path.join(repositoryRoot, file)));
}
const captureProvenance = {
  captureCommit,
  worktreeDirtyAtCapture: worktreeDiff.length > 0 || untrackedFiles.length > 0,
  worktreeFingerprint: worktreeHash.digest("hex"),
  worktreeFingerprintAlgorithm: "sha256-git-diff-head-and-untracked-v1",
};

const referenceOrigin = "https://descomplicapro.com.br";
const referenceRoutes = [
  { key: "dashboard", route: "/" },
  { key: "etapas-oportunidades", route: "/etapas/oportunidades" },
  { key: "etapas-agendamentos", route: "/etapas/agendamentos" },
  { key: "etapas-visitas", route: "/etapas/visitas" },
  { key: "etapas-pastas", route: "/etapas/pastas" },
  { key: "etapas-vendas", route: "/etapas/vendas" },
  { key: "ranking", route: "/ranking" },
  { key: "canal-de-parcerias", route: "/canal-de-parcerias" },
  { key: "configuracoes", route: "/configuracoes" },
  { key: "configuracoes-metas", route: "/configuracoes/metas" },
  {
    key: "configuracoes-metas-parcerias",
    route: "/configuracoes/metas/parcerias",
  },
  { key: "configuracoes-metas-pontos", route: "/configuracoes/metas/pontos" },
  { key: "simulacao", route: "/simulacao" },
  {
    key: "simulacao-associativo-fluxo-linear",
    route: "/simulacao/associativo-fluxo-linear",
  },
  {
    key: "simulacao-calcular-documentacao",
    route: "/simulacao/calcular-documentacao",
  },
  { key: "simulacao-caixa", route: "/simulacao/caixa" },
  { key: "simulacao-tabela-direta", route: "/simulacao/tabela-direta" },
  {
    key: "simulacao-tabela-investidor",
    route: "/simulacao/tabela-investidor",
  },
];

const protectedRoutes = [
  "/app",
  "/app/etapas/oportunidades",
  "/app/etapas/agendamentos",
  "/app/etapas/visitas",
  "/app/etapas/pastas",
  "/app/etapas/vendas",
];

const viewports = [
  { key: "desktop-1440x900", width: 1440, height: 900 },
  { key: "notebook-1280x720", width: 1280, height: 720 },
  { key: "tablet-768x1024", width: 768, height: 1024 },
  { key: "mobile-390x844", width: 390, height: 844 },
];

const safeReferenceLabels = [
  "D",
  "Dashboard",
  "Etapas",
  "Oportunidades",
  "Agendamentos",
  "Visitas",
  "Pastas",
  "Vendas",
  "Ranking",
  "Canal de Parcerias",
  "Configurações",
  "Metas",
  "Pontos",
  "Simulação",
  "Simulações",
  "Claro",
  "Equilibrado",
  "Escuro",
];

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function saveLosslessWebp(buffer, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    await sharp(buffer).webp({ lossless: true, effort: 6 }).toFile(temporary);
    const contents = await readFile(temporary);
    const metadata = await stat(temporary);
    await rename(temporary, destination);
    return {
      bytes: metadata.size,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  } finally {
    await rm(temporary, { force: true });
  }
}

async function persistRun(kind, captures, result) {
  await mkdir(outputRoot, { recursive: true });
  const manifest = await readJson(manifestPath, {
    schemaVersion: 1,
    policy: "Only sanitized or unauthenticated captures may be versioned.",
    captures: [],
  });
  const results = await readJson(resultsPath, { schemaVersion: 1 });
  manifest.captures = [...manifest.captures.filter((entry) => entry.kind !== kind), ...captures];
  results[kind] = result;
  const manifestTemporary = `${manifestPath}.tmp-${process.pid}`;
  const resultsTemporary = `${resultsPath}.tmp-${process.pid}`;
  try {
    await Promise.all([
      writeFile(manifestTemporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
      writeFile(resultsTemporary, `${JSON.stringify(results, null, 2)}\n`, "utf8"),
    ]);
    await rename(manifestTemporary, manifestPath);
    await rename(resultsTemporary, resultsPath);
  } finally {
    await Promise.all([
      rm(manifestTemporary, { force: true }),
      rm(resultsTemporary, { force: true }),
    ]);
  }
}

async function installCanonicalCaptureCss(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0ms !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
      .codex-qa-mask {
        position: absolute !important;
        z-index: 2147483646 !important;
        box-sizing: border-box !important;
        border: 1px solid #2f5b72 !important;
        border-radius: 4px !important;
        background: #173953 !important;
        opacity: 1 !important;
        pointer-events: none !important;
      }
    `,
  });
}

async function redactReference(page) {
  return page.evaluate((safeLabels) => {
    for (const field of document.querySelectorAll("input, textarea")) {
      field.value = "";
      field.setAttribute("placeholder", "");
    }

    const root = document.createElement("div");
    root.id = "codex-qa-redactions";
    root.setAttribute("aria-hidden", "true");
    document.body.append(root);

    const rectangles = [];
    const addRectangle = (rectangle, padding = 2) => {
      if (
        rectangle.width < 2 ||
        rectangle.height < 2 ||
        rectangle.bottom < 0 ||
        rectangle.top > window.innerHeight ||
        rectangle.right < 0 ||
        rectangle.left > window.innerWidth
      ) {
        return;
      }
      const left = Math.max(0, rectangle.left - padding);
      const top = Math.max(0, rectangle.top - padding);
      const right = Math.min(document.documentElement.scrollWidth, rectangle.right + padding);
      const bottom = Math.min(document.documentElement.scrollHeight, rectangle.bottom + padding);
      rectangles.push({
        top: top + window.scrollY,
        left: left + window.scrollX,
        width: right - left,
        height: bottom - top,
      });
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const parent = node.parentElement;
      if (text && parent && !parent.closest("#codex-qa-redactions, script, style, noscript")) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const textRectangles = [...range.getClientRects()];
        const safeTopbarLabel =
          safeLabels.includes(text) &&
          parent.closest("header, nav") !== null &&
          textRectangles.length > 0 &&
          textRectangles.every((rectangle) => rectangle.top >= 0 && rectangle.bottom <= 96);
        if (!safeTopbarLabel) {
          if (textRectangles.length > 0) {
            for (const rectangle of textRectangles) addRectangle(rectangle);
          } else {
            addRectangle(parent.getBoundingClientRect());
          }
        }
      }
      node = walker.nextNode();
    }

    const visualSelector = [
      "svg",
      "canvas",
      "img",
      "picture",
      "video",
      "iframe",
      "frame",
      "object",
      "embed",
      "table",
      "progress",
      "meter",
      "button",
      "input",
      "select",
      "textarea",
      "[contenteditable='true']",
      "[role='img']",
      "[role='progressbar']",
      "[aria-valuenow]",
      "[aria-checked]",
      "[aria-pressed]",
      "[role='switch']",
      "[class*='badge' i]",
      "[class*='chart' i]",
      "[class*='dot' i]",
      "[class*='funnel' i]",
      "[class*='gauge' i]",
      "[class*='donut' i]",
      "[class*='ranking' i]",
      "[class*='status' i]",
      "[class*='switch' i]",
      "[class*='toggle' i]",
    ].join(",");
    for (const element of document.querySelectorAll(visualSelector)) {
      addRectangle(element.getBoundingClientRect());
    }

    const maximumMaskCandidateArea = window.innerWidth * window.innerHeight * 0.85;
    for (const element of document.body.querySelectorAll("*")) {
      if (element.closest("#codex-qa-redactions, script, style, noscript")) continue;
      const rectangle = element.getBoundingClientRect();
      if (rectangle.width * rectangle.height > maximumMaskCandidateArea) continue;
      const style = getComputedStyle(element);
      const before = getComputedStyle(element, "::before");
      const after = getComputedStyle(element, "::after");
      const hasOpaqueBackground = (candidate) =>
        !["rgba(0, 0, 0, 0)", "transparent"].includes(candidate.backgroundColor);
      const hasGeneratedContent = (pseudo) =>
        !["none", "normal", '""', "''"].includes(pseudo.content) ||
        pseudo.backgroundImage !== "none" ||
        (hasOpaqueBackground(pseudo) && !["none", "normal"].includes(pseudo.content));
      if (
        element.shadowRoot ||
        element.localName.includes("-") ||
        style.backgroundImage !== "none" ||
        (rectangle.top >= 96 && hasOpaqueBackground(style)) ||
        style.transform !== "none" ||
        style.clipPath !== "none" ||
        style.maskImage !== "none" ||
        hasGeneratedContent(before) ||
        hasGeneratedContent(after)
      ) {
        addRectangle(rectangle);
      }
    }

    for (const rectangle of rectangles) {
      const mask = document.createElement("div");
      mask.className = "codex-qa-mask";
      mask.style.top = `${rectangle.top}px`;
      mask.style.left = `${rectangle.left}px`;
      mask.style.width = `${rectangle.width}px`;
      mask.style.height = `${rectangle.height}px`;
      root.append(mask);
    }
    return rectangles.length;
  }, safeReferenceLabels);
}

function configureNetwork(context, allowedOrigin) {
  return context.route("**/*", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      await route.abort("blockedbyclient");
      return;
    }
    const requestUrl = new URL(route.request().url());
    if (
      requestUrl.protocol === "data:" ||
      requestUrl.protocol === "blob:" ||
      requestUrl.origin === allowedOrigin
    ) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
}

async function waitForDomStability(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        let quietTimer;
        const maximumTimer = setTimeout(() => {
          observer.disconnect();
          reject(new Error("DOM did not become stable before capture."));
        }, 5_000);
        const finish = () => {
          clearTimeout(maximumTimer);
          observer.disconnect();
          resolve();
        };
        const scheduleFinish = () => {
          clearTimeout(quietTimer);
          quietTimer = setTimeout(finish, 300);
        };
        const observer = new MutationObserver(scheduleFinish);
        observer.observe(document.body, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
        scheduleFinish();
      }),
  );
}

async function beginMutationAudit(page) {
  await page.evaluate(() => {
    globalThis.__codexQaMutationObserver?.disconnect();
    globalThis.__codexQaMutationCount = 0;
    globalThis.__codexQaMutationObserver = new MutationObserver((mutations) => {
      const relevantMutations = mutations.filter(
        (mutation) =>
          !(
            mutation.type === "attributes" &&
            mutation.attributeName === "style" &&
            (mutation.target instanceof HTMLInputElement ||
              mutation.target instanceof HTMLTextAreaElement)
          ),
      );
      globalThis.__codexQaMutationCount += relevantMutations.length;
    });
    globalThis.__codexQaMutationObserver.observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  });
}

async function endMutationAudit(page) {
  return page.evaluate(() => {
    globalThis.__codexQaMutationObserver?.disconnect();
    return globalThis.__codexQaMutationCount ?? 0;
  });
}

async function readAnonymousSurface(page) {
  return page.evaluate(() => {
    const content = document.body.innerText;
    const commercialMarkers = [
      "Oportunidades",
      "Agendamentos",
      "Visitas",
      "Pastas",
      "Vendas",
      "Valor vendido",
      "Ranking",
      "Empreendimento",
      "Conversão",
      "R$",
    ];
    return {
      commercialContentCount: commercialMarkers.filter((marker) => content.includes(marker)).length,
      loginSurfacePresent:
        document.querySelector('form input[type="email"]') !== null &&
        document.querySelector('form input[type="password"]') !== null &&
        document.querySelector('form button[type="submit"]') !== null,
    };
  });
}

async function captureReference() {
  const browser = await chromium.launch();
  const browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "pt-BR",
    timezoneId: "UTC",
    serviceWorkers: "block",
  });
  await configureNetwork(context, referenceOrigin);
  const pendingScreenshots = [];
  const routeResults = [];

  for (const item of referenceRoutes) {
    const page = await context.newPage();
    let consoleErrorCount = 0;
    let pageErrorCount = 0;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrorCount += 1;
    });
    page.on("pageerror", () => {
      pageErrorCount += 1;
    });

    const response = await page.goto(`${referenceOrigin}${item.route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);
    await installCanonicalCaptureCss(page);
    await redactReference(page);
    await waitForDomStability(page);
    const redactionCount = await redactReference(page);
    const finalUrl = new URL(page.url());
    const routeResult = {
      route: item.route,
      status: response?.status() ?? null,
      finalOrigin: finalUrl.origin,
      finalPath: finalUrl.pathname,
      hasUnexpectedLocationSuffix: finalUrl.search !== "" || finalUrl.hash !== "",
      redactionCount,
      consoleErrorCount,
      pageErrorCount,
    };
    if (
      routeResult.status !== 200 ||
      routeResult.finalOrigin !== referenceOrigin ||
      routeResult.finalPath !== item.route ||
      routeResult.hasUnexpectedLocationSuffix ||
      routeResult.redactionCount === 0 ||
      routeResult.consoleErrorCount !== 0 ||
      routeResult.pageErrorCount !== 0
    ) {
      await page.close();
      await browser.close();
      throw new Error(
        `Reference route validation failed before screenshots were persisted ` +
          `(route=${item.route}, status=${routeResult.status}, ` +
          `location=${routeResult.finalOrigin}${routeResult.finalPath}, ` +
          `suffix=${routeResult.hasUnexpectedLocationSuffix}, masks=${routeResult.redactionCount}, ` +
          `console=${routeResult.consoleErrorCount}, page=${routeResult.pageErrorCount}).`,
      );
    }
    await beginMutationAudit(page);
    const screenshot = await page.screenshot({ type: "png" });
    const postCaptureMutationCount = await endMutationAudit(page);
    const postCaptureUrl = new URL(page.url());
    routeResult.consoleErrorCount = consoleErrorCount;
    routeResult.pageErrorCount = pageErrorCount;
    routeResult.postCaptureMutationCount = postCaptureMutationCount;
    routeResult.postCaptureLocationStable =
      postCaptureUrl.origin === routeResult.finalOrigin &&
      postCaptureUrl.pathname === routeResult.finalPath &&
      postCaptureUrl.search === "" &&
      postCaptureUrl.hash === "";
    if (
      routeResult.consoleErrorCount !== 0 ||
      routeResult.pageErrorCount !== 0 ||
      routeResult.postCaptureMutationCount !== 0 ||
      !routeResult.postCaptureLocationStable
    ) {
      await page.close();
      await browser.close();
      throw new Error("Reference route changed while its screenshot was in memory.");
    }
    pendingScreenshots.push({ item, redactionCount, screenshot });
    routeResults.push(routeResult);
    await page.close();
  }

  await browser.close();
  const captures = [];
  for (const pending of pendingScreenshots) {
    const relativePath = `reference/${pending.item.key}-1440x900.webp`;
    const file = await saveLosslessWebp(pending.screenshot, path.join(outputRoot, relativePath));
    captures.push({
      kind: "reference",
      route: pending.item.route,
      origin: referenceOrigin,
      ...captureProvenance,
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      theme: "light",
      reducedMotion: true,
      zoom: 1,
      browser: `Chromium ${browserVersion}`,
      sanitized: true,
      redaction: "opaque-solid-mask",
      redactionCount: pending.redactionCount,
      path: relativePath,
      ...file,
    });
  }

  await persistRun("reference", captures, {
    passed: true,
    capturedAt: new Date().toISOString(),
    provenance: captureProvenance,
    routeCount: routeResults.length,
    routes: routeResults,
    notes: [
      "All non-whitelisted text and analytical visuals were covered before pixels left browser memory.",
      "Raw PNG, HTML, network bodies, cookies, HAR, trace and video were not written to disk.",
    ],
  });
}

async function captureAnonymousBoundary() {
  const requestedOrigin = process.env.QA_TARGET_ORIGIN;
  const label = process.env.QA_TARGET_LABEL;
  if (!requestedOrigin) throw new Error("QA_TARGET_ORIGIN is required.");
  if (label !== "target-before" && label !== "target-after") {
    throw new Error("QA_TARGET_LABEL must be target-before or target-after.");
  }
  let parsedOrigin;
  try {
    parsedOrigin = new URL(requestedOrigin);
  } catch {
    throw new Error("Invalid QA_TARGET_ORIGIN.");
  }
  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== "/" ||
    parsedOrigin.search ||
    parsedOrigin.hash
  ) {
    throw new Error("QA_TARGET_ORIGIN must be an HTTP(S) origin without credentials or a path.");
  }
  const origin = parsedOrigin.origin;

  const browser = await chromium.launch();
  const browserVersion = browser.version();
  const routeResults = [];
  for (const route of protectedRoutes) {
    const requestContext = await browser.newContext({ serviceWorkers: "block" });
    try {
      const response = await requestContext.request.get(`${origin}${route}`, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      const responseHeaders = response.headers();
      const redirectLocation = responseHeaders.location
        ? new URL(responseHeaders.location, origin)
        : null;
      routeResults.push({
        route,
        status: response.status(),
        redirectsToLogin:
          redirectLocation?.origin === origin &&
          redirectLocation.pathname === "/login" &&
          redirectLocation.search === "" &&
          redirectLocation.hash === "",
        securityHeadersPresent:
          responseHeaders["content-security-policy"]?.includes("frame-ancestors 'none'") === true &&
          responseHeaders["x-frame-options"] === "DENY" &&
          responseHeaders["x-content-type-options"] === "nosniff",
      });
    } finally {
      await requestContext.close();
    }
  }

  if (
    !routeResults.every(
      (entry) => entry.status === 307 && entry.redirectsToLogin && entry.securityHeadersPresent,
    )
  ) {
    await browser.close();
    throw new Error("Anonymous route boundary failed before screenshots were captured.");
  }

  const pendingScreenshots = [];
  const viewportResults = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "pt-BR",
      timezoneId: "UTC",
      serviceWorkers: "block",
    });
    await configureNetwork(context, new URL(origin).origin);
    const page = await context.newPage();
    let consoleErrorCount = 0;
    let pageErrorCount = 0;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrorCount += 1;
    });
    page.on("pageerror", () => {
      pageErrorCount += 1;
    });
    const response = await page.goto(`${origin}/app`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await installCanonicalCaptureCss(page);
    await waitForDomStability(page);
    await page.locator("input").evaluateAll((fields) => {
      for (const field of fields) field.value = "";
    });
    const surfaceValidation = await readAnonymousSurface(page);
    const finalUrl = new URL(page.url());
    const finalResponseHeaders = response ? await response.allHeaders() : {};
    const viewportResult = {
      viewport: viewport.key,
      finalOrigin: finalUrl.origin,
      finalPath: finalUrl.pathname,
      hasUnexpectedLocationSuffix: finalUrl.search !== "" || finalUrl.hash !== "",
      status: response?.status() ?? null,
      finalSecurityHeadersPresent:
        finalResponseHeaders["content-security-policy"]?.includes("frame-ancestors 'none'") ===
          true &&
        finalResponseHeaders["x-frame-options"] === "DENY" &&
        finalResponseHeaders["x-content-type-options"] === "nosniff",
      ...surfaceValidation,
      consoleErrorCount,
      pageErrorCount,
    };
    if (
      viewportResult.finalOrigin !== origin ||
      viewportResult.finalPath !== "/login" ||
      viewportResult.hasUnexpectedLocationSuffix ||
      viewportResult.status !== 200 ||
      !viewportResult.finalSecurityHeadersPresent ||
      !viewportResult.loginSurfacePresent ||
      viewportResult.commercialContentCount !== 0 ||
      viewportResult.consoleErrorCount !== 0 ||
      viewportResult.pageErrorCount !== 0
    ) {
      await context.close();
      await browser.close();
      throw new Error("Anonymous viewport boundary failed before screenshots were captured.");
    }
    await beginMutationAudit(page);
    const screenshot = await page.screenshot({ type: "png" });
    const postCaptureMutationCount = await endMutationAudit(page);
    const postCaptureSurface = await readAnonymousSurface(page);
    const postCaptureUrl = new URL(page.url());
    viewportResult.consoleErrorCount = consoleErrorCount;
    viewportResult.pageErrorCount = pageErrorCount;
    viewportResult.postCaptureMutationCount = postCaptureMutationCount;
    viewportResult.postCaptureValidated =
      postCaptureUrl.origin === viewportResult.finalOrigin &&
      postCaptureUrl.pathname === viewportResult.finalPath &&
      postCaptureUrl.search === "" &&
      postCaptureUrl.hash === "" &&
      postCaptureSurface.commercialContentCount === 0 &&
      postCaptureSurface.loginSurfacePresent;
    if (
      viewportResult.consoleErrorCount !== 0 ||
      viewportResult.pageErrorCount !== 0 ||
      viewportResult.postCaptureMutationCount !== 0 ||
      !viewportResult.postCaptureValidated
    ) {
      await context.close();
      await browser.close();
      throw new Error(
        `Anonymous login surface changed while its screenshot was in memory ` +
          `(mutations=${viewportResult.postCaptureMutationCount}, ` +
          `surface=${viewportResult.postCaptureValidated}, ` +
          `console=${viewportResult.consoleErrorCount}, page=${viewportResult.pageErrorCount}).`,
      );
    }
    pendingScreenshots.push({ screenshot, viewport });
    viewportResults.push(viewportResult);
    await context.close();
  }
  await browser.close();

  const captures = [];
  for (const pending of pendingScreenshots) {
    const relativePath = `${label}/anonymous-app-${pending.viewport.key}.webp`;
    const file = await saveLosslessWebp(pending.screenshot, path.join(outputRoot, relativePath));
    captures.push({
      kind: label,
      route: "/app",
      origin,
      ...captureProvenance,
      viewport: {
        width: pending.viewport.width,
        height: pending.viewport.height,
        deviceScaleFactor: 1,
      },
      theme: "light",
      reducedMotion: true,
      zoom: 1,
      browser: `Chromium ${browserVersion}`,
      sanitized: true,
      redaction: "not-required-empty-login",
      redactionCount: 0,
      path: relativePath,
      ...file,
    });
  }

  await persistRun(label, captures, {
    passed: true,
    capturedAt: new Date().toISOString(),
    origin,
    provenance: captureProvenance,
    routes: routeResults,
    viewports: viewportResults,
    notes: [
      "No cookies or storage state were supplied.",
      "Screenshots contain the empty login surface only.",
    ],
  });
}

const command = process.argv[2] ?? "reference";
if (command === "reference") {
  await captureReference();
} else if (command === "boundary") {
  await captureAnonymousBoundary();
} else {
  throw new Error(`Unknown command: ${command}`);
}
