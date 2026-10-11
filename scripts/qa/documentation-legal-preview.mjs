import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";
import { checkDocumentationCalculator } from "./documentation-calculator.mjs";
import {
  checkDocumentationHiddenRequiredField,
  fillDocumentationLegalContext,
  legalConfirmationLabel,
  openDocumentationLegalContext,
} from "./documentation-legal-context.mjs";
import { checkAssociativeDocumentationHandoff } from "./associative-motion.mjs";

const calculatorRoute = "/app/simulacao/calcular-documentacao";
const associativeRoute = "/app/simulacao/associativo-fluxo-linear";
const associativeRoot = ".investor-associative-table-page";
const themes = { light: "Claro", balanced: "Médio", dark: "Escuro" };
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

async function setTheme(page, theme) {
  const group = page.getByRole("group", { name: "Aparência da página", exact: true });
  if (page.viewportSize().width <= 600) {
    for (
      let i = 0;
      i < 3 && (await page.locator("html").getAttribute("data-theme")) !== theme;
      i++
    ) {
      await group.locator("[data-theme-cycle-mobile]").click();
    }
  } else await group.getByRole("button", { name: themes[theme], exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

export async function checkDocumentationLegalGeometry(scope) {
  await openDocumentationLegalContext(scope);
  const region = scope.getByRole("region", { name: "Dados fiscais da documentação", exact: true });
  await expect(region).toBeVisible();
  const geometry = await region.evaluate((root) => {
    const inside = (a, b) =>
      a.left >= b.left - 1 &&
      a.right <= b.right + 1 &&
      a.top >= b.top - 1 &&
      a.bottom <= b.bottom + 1;
    const overlaps = (a, b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const region = root.getBoundingClientRect();
    const labels = [...root.querySelectorAll("label")].filter((label) => label.checkVisibility());
    const issues = [];
    for (const [index, label] of labels.entries()) {
      const bounds = label.getBoundingClientRect();
      const control = label.querySelector("input, select");
      const span = label.querySelector("span");
      const name = span?.textContent.trim();
      if (!inside(bounds, region)) issues.push({ name, issue: "field outside region" });
      if (!control || !inside(control.getBoundingClientRect(), bounds))
        issues.push({ name, issue: "control outside field" });
      if (
        control &&
        span &&
        overlaps(control.getBoundingClientRect(), span.getBoundingClientRect())
      )
        issues.push({ name, issue: "label overlaps control" });
      if (span) {
        const range = document.createRange();
        range.selectNodeContents(span);
        if ([...range.getClientRects()].some((rect) => !inside(rect, bounds)))
          issues.push({ name, issue: "label text clipped" });
      }
      for (const other of labels.slice(index + 1)) {
        if (overlaps(bounds, other.getBoundingClientRect()))
          issues.push({ name, issue: "fields overlap" });
      }
    }
    return {
      fields: labels.length,
      issues,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.ok(geometry.fields >= 15, "All fiscal inputs and confirmation must be rendered");
  assert.deepEqual(geometry.issues, [], "Fiscal fields must not overlap or clip their text");
  assert.equal(
    geometry.pageOverflow,
    false,
    "Fiscal fields must not introduce horizontal overflow",
  );
  return geometry;
}

async function checkBreakdownGeometry(scope, selector) {
  const rows = await scope.locator(`${selector} dl > div`).evaluateAll((elements) =>
    elements.map((row) => {
      const bounds = row.getBoundingClientRect();
      const term = row.querySelector("dt").getBoundingClientRect();
      const value = row.querySelector("dd").getBoundingClientRect();
      return {
        name: row.querySelector("dt").textContent,
        contained: [term, value].every(
          (box) => box.left >= bounds.left - 1 && box.right <= bounds.right + 1,
        ),
        collision:
          Math.min(term.right, value.right) - Math.max(term.left, value.left) > 1 &&
          Math.min(term.bottom, value.bottom) - Math.max(term.top, value.top) > 1,
      };
    }),
  );
  assert.ok(rows.length >= 6, "Both registration acts and commercial charges must be visible");
  assert.ok(
    rows.every((row) => row.contained && !row.collision),
    `Breakdown geometry: ${JSON.stringify(rows)}`,
  );
  return rows;
}

async function completeAssociativeProposal(page) {
  await page
    .getByRole("combobox", { name: "Nome do Empreendimento", exact: true })
    .selectOption("Empreendimento QA 01");
  await page.getByRole("button", { name: "Iniciar proposta com QA-0001", exact: true }).click();
  const profile = page.locator(`${associativeRoot} .investor-associative-qualification`);
  await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).fill("500000");
  await profile.getByRole("button", { name: "MCMV", exact: true }).click();
  await profile.getByRole("radio", { name: "Sim", exact: true }).check();
  for (const [label, value] of [
    ["Financiamento", "19000000"],
    ["Subsídio", "0"],
    ["FGTS", "0"],
    ["Cheque Moradia", "0"],
    ["Entrada", "100000"],
    ["Quantidade de parcelas", "84"],
  ]) {
    const field = page
      .locator(`${associativeRoot} input`)
      .and(page.getByLabel(label, { exact: true }));
    await expect(field).toBeEnabled();
    await field.fill(value);
    await field.blur();
  }
  await page
    .getByRole("combobox", { name: "Selecione o Ranking", exact: true })
    .selectOption("bronze");
}

async function checkAssociativeLegalFlow(page, origin) {
  await page.goto(`${origin}${associativeRoute}`, { waitUntil: "networkidle" });
  await completeAssociativeProposal(page);
  const documentation = page.locator(`${associativeRoot} .investor-associative-documentation`);
  const summary = documentation.locator(".investor-associative-documentation-summary");
  const installments = documentation.getByRole("button", { name: "Exibir parcelas", exact: true });
  const confirm = documentation.getByLabel(legalConfirmationLabel, { exact: true });
  await expect(documentation).toHaveClass(/waiting/);
  await expect(summary).toHaveCount(0);
  await expect(installments).toBeDisabled();
  const disclosure = documentation.locator("details[data-documentation-legal]");
  await expect(disclosure).toHaveJSProperty("open", false);
  await expect(disclosure.locator(":scope > summary")).toBeVisible();
  await expect(disclosure.locator(":scope > summary")).toContainText(/dados fiscais/i);
  await expect(disclosure.getByRole("status")).toHaveText("Pendente");
  await expect(documentation.getByLabel("Município do imóvel", { exact: true })).toBeHidden();
  await checkDocumentationHiddenRequiredField(documentation);
  await expect(
    documentation.getByLabel("Tabela de registro conferida", { exact: true }),
  ).toHaveValue("");
  const legalContext = await fillDocumentationLegalContext(documentation, { itbiBase: 230000 });
  await expect(documentation).toHaveClass(/ready/);
  await expect(summary).toContainText("3.432,05");
  await expect(disclosure.getByRole("status")).toHaveText("Confirmado");
  await expect(installments).toBeEnabled();
  await installments.click();
  const dialog = page.locator("#investor-associative-documentation-installments");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(40);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  for (const unsupported of ["OTHER", ""]) {
    await documentation
      .getByLabel("Tabela de registro conferida", { exact: true })
      .selectOption(unsupported);
    await expect(confirm).not.toBeChecked();
    await confirm.check();
    await expect(documentation).toHaveClass(/blocked/);
    await expect(documentation.getByRole("alert")).toContainText(/tabela/i);
    await expect(summary).toHaveCount(0);
    await expect(installments).toBeDisabled();
  }
  await fillDocumentationLegalContext(documentation, { itbiBase: 230000 });
  await expect(summary).toContainText("3.432,05");

  await confirm.uncheck();
  await expect(summary).toHaveCount(0);
  await expect(installments).toBeDisabled();
  await confirm.check();
  await expect(summary).toContainText("3.432,05");
  await documentation.getByLabel("Valor venal do IPTU (R$)", { exact: true }).fill("");
  await confirm.check();
  await expect(documentation).toHaveClass(/blocked/);
  await expect(documentation.getByRole("alert")).toContainText("valor venal do IPTU");
  await expect(summary).toHaveCount(0);
  await documentation.getByLabel("Valor venal do IPTU (R$)", { exact: true }).fill("0");
  await documentation
    .getByLabel("Origem dos recursos do financiamento", { exact: true })
    .selectOption("FGTS");
  await expect(documentation.getByLabel("Primeira transmissão?", { exact: true })).toBeVisible();
  await documentation.getByLabel("Primeira transmissão?", { exact: true }).selectOption("SIM");
  await documentation.getByLabel("Programa habitacional", { exact: true }).selectOption("NONE");
  await confirm.check();
  await expect(documentation).toHaveClass(/blocked/);
  await expect(documentation.getByRole("alert")).toContainText("FGTS fora do MCMV");
  await expect(summary).toHaveCount(0);
  await documentation.getByLabel("Programa habitacional", { exact: true }).selectOption("MCMV");
  await confirm.check();
  await expect(summary).toContainText("3.432,05");
  await expect(summary.getByText("Registro conjunto", { exact: true })).toHaveCount(0);
  await documentation.getByLabel("Município do imóvel", { exact: true }).selectOption("other");
  await confirm.check();
  await expect(documentation.getByRole("alert")).toContainText(
    "somente para o município de São Paulo",
  );
  await expect(summary).toHaveCount(0);
  await fillDocumentationLegalContext(documentation, { itbiBase: 230000 });
  const financing = page
    .locator(`${associativeRoot} input`)
    .and(page.getByLabel("Financiamento", { exact: true }));
  await financing.fill("18900000");
  await financing.blur();
  await expect(confirm).not.toBeChecked();
  await expect(summary).toHaveCount(0);
  await financing.fill("19000000");
  await financing.blur();
  await expect(confirm).not.toBeChecked();
  await confirm.check();
  await expect(summary).toContainText("3.432,05");
  return {
    passed: true,
    legalContext,
    incompleteBlocked: true,
    legalDisclosureInitiallyClosed: true,
    hiddenRequiredFieldRevealed: true,
    explicitZeroIptu: true,
    pendingFgtsBlocked: true,
    mcmvPrecedence: true,
    municipalityBlocked: true,
    confirmationInvalidated: true,
    registryTableRequired: true,
    installments: 40,
  };
}

async function captureFocusedLayouts(page, screen, artifactRoot, matrix, save) {
  const capture = async (locator, name) => {
    // Keep the fixed shell header at the document top when capturing tall fiscal sections.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const clip = await locator.boundingBox();
    assert.ok(clip && clip.x >= 0 && clip.y >= 0, "Screenshot section must have document bounds");
    await page.screenshot({
      path: path.join(artifactRoot, name),
      clip,
      fullPage: true,
      animations: "disabled",
    });
  };
  const scope = page.locator(
    screen === "calculator"
      ? ".documentation-page-shell"
      : `${associativeRoot} .investor-associative-documentation`,
  );
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of [viewport.width > 600 ? "light" : "dark"]) {
      process.stdout.write(`Documentation preview: ${screen} ${viewport.width}px ${theme}\n`);
      await setTheme(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const geometry = await checkDocumentationLegalGeometry(scope);
      const breakdown = await checkBreakdownGeometry(
        scope,
        screen === "calculator"
          ? ".documentation-breakdown"
          : ".investor-associative-documentation-breakdown",
      );
      const accessibility = await new AxeBuilder({ page })
        .include(
          screen === "calculator"
            ? ".documentation-page-shell"
            : `${associativeRoot} .investor-associative-documentation`,
        )
        .analyze();
      assert.deepEqual(
        accessibility.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        })),
        [],
        `${screen}/${theme}/${viewport.width}: accessibility`,
      );
      const prefix = `${screen}-${viewport.width}-${theme}`;
      await capture(
        scope.getByRole("region", { name: "Dados fiscais da documentação", exact: true }),
        `${prefix}-fields.png`,
      );
      await capture(scope, `${prefix}-complete.png`);
      matrix.push({
        viewport,
        theme,
        geometry,
        breakdown,
        accessibilityViolations: 0,
        passed: true,
      });
      await save();
    }
  }
  return matrix;
}

export async function runDocumentationLegalPreview() {
  const root = path.resolve(import.meta.dirname, "../..");
  const artifactRoot = path.join(
    root,
    "test-results/documentation-legal-preview",
    new Date().toISOString().replaceAll(":", "-"),
  );
  await mkdir(artifactRoot, { recursive: true });
  const evidence = {
    environment: "loopback synthetic real-component preview; no auth or RLS services",
    shell:
      "Real ProtectedLayout, navigation, account menu and breadcrumbs; synthetic session boundaries only",
    node: process.version,
    simulatedDate: "2026-10-10",
    passed: false,
    screens: {},
    consoleErrors: [],
    blockedExternalRequests: [],
    unexpectedLocalRequests: [],
  };
  const save = () =>
    writeFile(path.join(artifactRoot, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`Documentation preview artifacts: ${artifactRoot}\n`);
  // Same in-memory Vite/HTTP pattern as associative-page-guide: no env files, dev server or auth.
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path
    .join(root, "scripts/qa/documentation-legal-preview-memory.tsx")
    .replaceAll("\\", "/");
  const pages = [
    ["crm.dashboard", "/app", "Dashboard", "crm", null],
    ["crm.simulation", "/app/simulacao", "Simuladores", "simulation", null],
    ["crm.ranking", "/app/ranking", "Ranking", "crm", null],
    ["crm.partnerships", "/app/canal-de-parcerias", "Canal de Parcerias", "crm", null],
    ["crm.settings", "/app/configuracoes", "Configurações", "crm", null],
    ["crm.simulation.wf16", calculatorRoute, "Documentação", "simulation", "crm.simulation"],
    ["crm.simulation.wf13", associativeRoute, "Associativo", "simulation", "crm.simulation"],
  ].map(([key, route, name, section, parentKey], index) => ({
    key,
    path: route,
    name,
    section,
    parentKey,
    description: "Fixture sintética de navegação",
    permissionKey: "crm.simulators.view",
    sortOrder: (index + 1) * 10,
    isNavigation: true,
    isActive: true,
  }));
  // Render the actual layout; replace only server/session boundaries, as in protected-shell tests.
  const boundaries = new Map([
    ["next/headers", "export async function cookies() { return { get: () => undefined }; }"],
    [
      "@/lib/authorization/enforce",
      "export async function enforceAuthorization() { return { roleKey: 'user', permissions: [], level: 10 }; }",
    ],
    [
      "@/lib/authorization/guards",
      "export async function getCurrentUser() { return { email: 'documentation.qa@nonexistent.invalid', user_metadata: { name: 'QA Documentação' } }; }",
    ],
    ["@/lib/auth/actions/logout", "export const logoutAction = '/qa-logout-disabled';"],
    [
      "@/lib/navigation/pages",
      `export async function getAuthorizedNavigation() { return ${JSON.stringify(pages)}; } export function getDisabledNavigationItems() { return []; }`,
    ],
  ]);
  const virtualBoundaries = new Map(
    [...boundaries].map(([id, source], index) => [
      `\0documentation-session-${index}`,
      { id, source },
    ]),
  );
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
    resolve: {
      alias: [
        ...[...virtualBoundaries].map(([replacement, { id }]) => ({ find: id, replacement })),
        { find: "@", replacement: root },
      ],
    },
    oxc: { jsx: { runtime: "automatic" } },
    plugins: [
      {
        name: "documentation-legal-preview",
        enforce: "pre",
        resolveId(id) {
          if (virtualBoundaries.has(id)) return id;
          if (id.endsWith("documentation-legal-preview-memory.tsx")) return entry;
        },
        load(id) {
          if (virtualBoundaries.has(id)) return virtualBoundaries.get(id).source;
          if (id === entry)
            return `
        import { createRoot } from "react-dom/client";
        import { DocumentationArchive } from "@/app/(protected)/app/simulacao/_components/DocumentationArchive";
        import { AssociativeTableArchive } from "@/app/(protected)/app/simulacao/_components/AssociativeTableArchive";
        import ProtectedLayout from "@/app/(protected)/layout";
        import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
        import "@/app/globals.css";
        import "@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css";
        void (async () => {
          const children = location.pathname === "${calculatorRoute}" ? <DocumentationArchive /> : <AssociativeTableArchive />;
          const shell = await ProtectedLayout({ children });
          createRoot(document.getElementById("root")).render(
            <PathnameContext.Provider value={location.pathname}>{shell}</PathnameContext.Provider>
          );
        })();`;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "DocumentationLegalQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script);
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Documentação QA</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${[
    ...files.keys(),
  ]
    .filter((file) => file.endsWith(".css"))
    .map((file) => `<link rel="stylesheet" href="${file}">`)
    .join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  const snapshot = JSON.parse(buildSyntheticDirectTableQaSnapshot());
  const items = snapshot.items.slice(0, 12);
  const inventory = { ...snapshot, count: items.length, items };
  const publicAssets = new Map(
    await Promise.all(
      [
        ["information-at-mark.png", "image/png"],
        ["boravender-logo192.png", "image/png"],
        ["salesforce-no-type-logo.svg", "image/svg+xml"],
      ].map(async ([name, type]) => [
        `/${name}`,
        { type, body: await readFile(path.join(root, "public", name)) },
      ]),
    ),
  );
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method !== "GET") {
      evidence.unexpectedLocalRequests.push(`${request.method} ${url.pathname}`);
      return void response.writeHead(405).end();
    }
    if (url.pathname === "/favicon.ico") return void response.writeHead(204).end();
    if (publicAssets.has(url.pathname)) {
      const asset = publicAssets.get(url.pathname);
      response.writeHead(200, { "content-type": asset.type }).end(asset.body);
    } else if (["/api/inventory", "/api/inventory/snapshot"].includes(url.pathname))
      response
        .writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        .end(
          JSON.stringify({
            ...inventory,
            sourceKind: url.pathname.endsWith("snapshot") ? "versioned-snapshot" : "live",
          }),
        );
    else if (files.has(url.pathname))
      response
        .writeHead(200, {
          "content-type": url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
        })
        .end(files.get(url.pathname));
    else if ([calculatorRoute, associativeRoute].includes(url.pathname))
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    else {
      evidence.unexpectedLocalRequests.push(url.pathname);
      response.writeHead(404).end();
    }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    evidence.browser = browser.version();
    const context = await browser.newContext({
      viewport: viewports[0],
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.blockedExternalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    for (const screen of ["calculator", "associative"]) {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-10T15:00:00Z"));
      page.setDefaultTimeout(15_000);
      page.on("pageerror", (error) => evidence.consoleErrors.push({ screen, text: error.message }));
      page.on("console", (message) => {
        if (message.type() === "error")
          evidence.consoleErrors.push({
            screen,
            text: message.text(),
            url: message.location().url,
          });
      });
      const result = (evidence.screens[screen] = { passed: false, matrix: [] });
      process.stdout.write(`Documentation preview: ${screen} flow\n`);
      try {
        if (screen === "calculator")
          result.flow = await checkDocumentationCalculator(
            page,
            origin,
            path.join(artifactRoot, "calculator-existing-matrix"),
          );
        else result.flow = await checkAssociativeLegalFlow(page, origin);
        await captureFocusedLayouts(page, screen, artifactRoot, result.matrix, save);
        if (screen === "associative") {
          result.motion = [];
          for (const viewport of viewports.slice(0, 2)) {
            await page.setViewportSize(viewport);
            await setTheme(page, "light");
            await page.emulateMedia({ reducedMotion: "no-preference" });
            await expect(
              page.locator(`${associativeRoot} .investor-associative-documentation`),
            ).toHaveClass(/ready/);
            process.stdout.write(`Documentation preview: painted handoff ${viewport.width}px\n`);
            result.motion.push({ viewport, ...(await checkAssociativeDocumentationHandoff(page)) });
            await save();
          }
        }
        result.passed = true;
      } catch (error) {
        result.error = error.stack ?? String(error);
        await page.screenshot({
          path: path.join(artifactRoot, `${screen}-failure.png`),
          fullPage: true,
          animations: "disabled",
        });
        process.stdout.write(`${screen} failed: ${error.message}\n`);
      } finally {
        await save();
        await page.close();
      }
    }
    evidence.passed =
      Object.values(evidence.screens).every(({ passed }) => passed) &&
      evidence.consoleErrors.length === 0 &&
      evidence.blockedExternalRequests.length === 0 &&
      evidence.unexpectedLocalRequests.length === 0;
    await save();
    process.stdout.write(
      `Documentation preview ${evidence.passed ? "passed" : "FAILED"}: ${path.join(artifactRoot, "result.json")}\n`,
    );
    assert.ok(
      evidence.passed,
      "Documentation legal browser preview failed; inspect result.json and screenshots",
    );
    return { artifactRoot, ...evidence };
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runDocumentationLegalPreview();
