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
import { openDocumentationLegalContext } from "./documentation-legal-context.mjs";
import { checkAssociativeDocumentationHandoff } from "./associative-motion.mjs";
import { calculateAssociativeDocumentationView } from "../../lib/archive-investor/associative-documentation-adapter.mjs";
import { checkAssociativeCalculationContinuity } from "./associative-calculation-continuity.mjs";
import { checkAssociativeGuidance } from "./associative-guidance.mjs";

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
  await expect(
    page
      .locator(`${associativeRoot} .investor-property-summary dt`)
      .filter({ hasText: /^Status no Salesforce$/i }),
  ).toHaveCount(0);
  await expect(
    page.locator(
      `${associativeRoot} .investor-associative-calendar, ${associativeRoot} input[type="date"]`,
    ),
  ).toHaveCount(0);
  const documentation = page.locator(`${associativeRoot} .investor-associative-documentation`);
  const summary = documentation.locator(".investor-associative-documentation-summary");
  const installments = documentation.getByRole("button", { name: "Exibir parcelas", exact: true });
  const field = (label) =>
    page.locator(`${associativeRoot} input`).and(page.getByLabel(label, { exact: true }));
  const profile = page.locator(`${associativeRoot} .investor-associative-qualification`);
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const input = {
    businessUnit: "Direcional",
    municipality: "sao-paulo-sp",
    reportedAppraisal: 350000,
    salePrice: 230000,
    financing: 190000,
    income: 5000,
    firstProperty: "SIM",
    modality: "MCMV",
    manualModalityPreference: "MCMV",
    baseDate: "2026-10-10",
  };
  const checks = [];
  async function assertAutomatic(label) {
    const view = calculateAssociativeDocumentationView(input);
    assert.equal(view.result.ok, true, label);
    assert.ok(view.estimate, "Automatic path must expose estimate metadata");
    await expect(documentation).toHaveClass(/ready/);
    await expect(
      documentation.locator("[data-documentation-legal], select, input[type=checkbox]"),
    ).toHaveCount(0);
    await expect(
      documentation.getByRole("region", { name: "Dados fiscais da documentação", exact: true }),
    ).toHaveCount(0);
    await expect(documentation.getByRole("note")).toContainText("Estimativa automática");
    for (const [term, key] of [
      ["ITBI", "itbi"],
      ["Registro de compra e venda", "purchaseRegistration"],
      ["Registro da alienação fiduciária", "lienRegistration"],
      ["Despachante", "dispatchFee"],
      ["Seguro Caixa", "caixaInsurance"],
    ]) {
      await expect(
        documentation
          .locator("dl > div")
          .filter({ has: page.getByText(term, { exact: true }) })
          .locator("dd"),
      ).toHaveText(money.format(view.result[key]));
    }
    await expect(summary).toContainText(money.format(view.result.totalCash));
    await expect(summary).toContainText(money.format(view.result.installmentValue));
    await expect(installments).toBeEnabled();
    checks.push({ label, totalCash: view.result.totalCash, estimate: view.estimate });
    return view.result;
  }
  const initial = await assertAutomatic("initial-mcmv");
  assert.equal(initial.totalCash, 3432.05, "MCMV/ARISP reference must remain unchanged");
  await expect(documentation.locator("input")).toHaveCount(0);
  await expect(summary.getByText("Registro conjunto", { exact: true })).toHaveCount(0);
  await installments.click();
  const dialog = page.locator("#investor-associative-documentation-installments");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(40);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await profile.getByRole("button", { name: "SBPE", exact: true }).click();
  input.modality = "SBPE";
  input.manualModalityPreference = "SBPE";
  const manualSbpe = await assertAutomatic("manual-modality-recalculation");
  assert.equal(manualSbpe.effectiveModality, "SBPE");
  assert.notEqual(manualSbpe.totalCash, initial.totalCash);
  await profile.getByRole("button", { name: "MCMV", exact: true }).click();
  input.modality = "MCMV";
  input.manualModalityPreference = "MCMV";
  await assertAutomatic("manual-modality-restored");

  await field("Financiamento").fill("10000000");
  await field("Financiamento").blur();
  input.financing = 100000;
  const reducedFinancing = await assertAutomatic("financing-recalculation");
  assert.notEqual(reducedFinancing.totalCash, initial.totalCash);
  await field("Financiamento").fill("19000000");
  await field("Financiamento").blur();
  input.financing = 190000;
  await assertAutomatic("financing-restored");

  await profile.getByRole("radio", { name: "Não", exact: true }).check();
  input.firstProperty = "NAO";
  await assertAutomatic("first-property-recalculation");
  await field("Renda Familiar").fill("1400000");
  await field("Renda Familiar").blur();
  input.income = 14000;
  const sbpe = await assertAutomatic("income-forces-sbpe");
  assert.equal(sbpe.effectiveModality, "SBPE");
  assert.notEqual(sbpe.totalCash, initial.totalCash);
  await field("Renda Familiar").fill("500000");
  await field("Renda Familiar").blur();
  await profile.getByRole("radio", { name: "Sim", exact: true }).check();
  await profile.getByRole("button", { name: "MCMV", exact: true }).click();
  input.income = 5000;
  input.firstProperty = "SIM";
  await assertAutomatic("profile-restored");

  await page.getByRole("button", { name: "Iniciar proposta com QA-0007", exact: true }).click();
  await expect(documentation).toHaveClass(/waiting/);
  await expect(summary).toHaveCount(0);
  await expect(installments).toBeDisabled();
  await expect(
    documentation.locator("[data-documentation-legal], select, input[type=checkbox]"),
  ).toHaveCount(0);
  await field("Avaliação bancária oficial da unidade").fill("35000000");
  await field("Avaliação bancária oficial da unidade").blur();
  input.salePrice = 256000;
  input.reportedAppraisal = null;
  input.appraisalOverride = 350000;
  const changedUnit = await assertAutomatic("unit-recalculation");
  assert.notEqual(changedUnit.totalCash, initial.totalCash);

  await page
    .getByRole("combobox", { name: "Nome do Empreendimento", exact: true })
    .selectOption("Empreendimento QA 02");
  await page.getByRole("button", { name: "Iniciar proposta com QA-0002", exact: true }).click();
  await expect(documentation).not.toHaveClass(/ready/);
  await expect(summary).toHaveCount(0);
  await expect(installments).toBeDisabled();
  await expect(
    documentation.locator("[data-documentation-legal], select, input[type=checkbox]"),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Nome do Empreendimento", exact: true })
    .selectOption("Empreendimento QA 01");
  await page.getByRole("button", { name: "Iniciar proposta com QA-0001", exact: true }).click();
  input.salePrice = 230000;
  input.reportedAppraisal = 350000;
  input.appraisalOverride = 0;
  await assertAutomatic("unit-restored");
  await expect(documentation.locator("input")).toHaveCount(0);
  return {
    passed: true,
    checks,
    automatic: true,
    fiscalInputs: 0,
    confirmationRequired: false,
    mcmvPrecedence: true,
    municipalityBlocked: true,
    missingAppraisalBlocked: true,
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
      let geometry;
      if (screen === "calculator") geometry = await checkDocumentationLegalGeometry(scope);
      else {
        await expect(scope.locator("input, select, [data-documentation-legal]")).toHaveCount(0);
        await expect(scope.getByRole("note")).toBeVisible();
        geometry = await scope.evaluate((element) => ({
          fields: element.querySelectorAll("input, select").length,
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        }));
        assert.equal(geometry.pageOverflow, false, "Automatic estimate must not overflow");
      }
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
      if (screen === "calculator") {
        await capture(
          scope.getByRole("region", { name: "Dados fiscais da documentação", exact: true }),
          `${prefix}-fields.png`,
        );
      } else await capture(scope.getByRole("note"), `${prefix}-estimate.png`);
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

async function checkAssociativePrintEstimate(page, artifactRoot) {
  const checks = [];
  await page.setViewportSize(viewports[0]);
  for (const theme of Object.keys(themes)) {
    await setTheme(page, theme);
    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    try {
      const note = page
        .locator(`${associativeRoot} .investor-associative-documentation`)
        .getByRole("note");
      await expect(note).toBeVisible();
      await expect(note).toContainText("Estimativa automática");
      await expect(note).toContainText("prefeitura, do banco e do cartório");
      const paint = await note.evaluate((element) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const rgba = (color) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data];
        };
        const style = getComputedStyle(element);
        const foreground = rgba(style.webkitTextFillColor || style.color);
        let background = [255, 255, 255, 255];
        let opaque = true;
        for (let parent = element; parent; parent = parent.parentElement) {
          const parentStyle = getComputedStyle(parent);
          opaque = opaque && Number(parentStyle.opacity) === 1;
          const color = rgba(parentStyle.backgroundColor);
          if (color[3] === 255) {
            background = color;
            break;
          }
        }
        const luminance = (color) =>
          color.slice(0, 3).reduce((sum, value, index) => {
            const channel = value / 255;
            return (
              sum +
              [0.2126, 0.7152, 0.0722][index] *
                (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
            );
          }, 0);
        const light = luminance(foreground);
        const dark = luminance(background);
        const bounds = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          foreground,
          background,
          opaque,
          contrast: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05),
          clipped: [...range.getClientRects()].some(
            (rect) =>
              rect.left < bounds.left - 1 ||
              rect.right > bounds.right + 1 ||
              rect.bottom > bounds.bottom + 1,
          ),
        };
      });
      assert.equal(paint.foreground[3], 255, "Printed estimate text must be opaque");
      assert.deepEqual(
        paint.foreground,
        [0, 0, 0, 255],
        "Print must retain black estimate text without background ink",
      );
      assert.deepEqual(
        paint.background,
        [255, 255, 255, 255],
        "Printed estimate must use a white background in every theme",
      );
      assert.equal(paint.opaque, true, "Printed estimate must not fade into the paper");
      assert.equal(paint.clipped, false, "Printed estimate must not clip");
      assert.ok(paint.contrast >= 4.5, `Printed estimate contrast: ${paint.contrast}`);
      await note.screenshot({
        path: path.join(artifactRoot, `associative-print-${theme}-estimate.png`),
        animations: "disabled",
      });
      checks.push({ theme, media: "print", visible: true, ...paint });
    } finally {
      await page.emulateMedia({ media: "screen" });
    }
  }
  return checks;
}

export async function runDocumentationLegalPreview({
  printOnly = false,
  associativeOnly = false,
} = {}) {
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
    scope: printOnly
      ? "associative-flow-and-print"
      : associativeOnly
        ? "associative-preview"
        : "full-documentation-preview",
    notExecuted: printOnly
      ? ["standalone", "screen-geometry", "motion", "guidance", "continuity"]
      : associativeOnly
        ? ["standalone"]
        : [],
    passed: false,
    screens: {},
    consoleErrors: [],
    blockedExternalRequests: [],
    unexpectedLocalRequests: [],
    syntheticPresence: { requests: 0, persisted: false },
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
  const items = snapshot.items.slice(0, 12).map((item) => ({
    ...item,
    city: item.project === "Empreendimento QA 01" ? "São Paulo" : item.city,
  }));
  const inventory = { ...snapshot, count: items.length, items };
  const publicAssets = new Map(
    await Promise.all(
      [
        ["information-at-mark.png", "image/png"],
        ["boravender-logo192.png", "image/png"],
        ["salesforce-no-type-logo.svg", "image/svg+xml"],
        ["brand/descomplica-wordmark-light.svg", "image/svg+xml"],
        ["brand/descomplica-wordmark-dark.svg", "image/svg+xml"],
      ].map(async ([name, type]) => [
        `/${name}`,
        { type, body: await readFile(path.join(root, "public", name)) },
      ]),
    ),
  );
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    // The preview's synthetic session has no database or persisted presence.
    if (
      url.pathname === "/api/presence" &&
      request.method === "POST" &&
      !url.search &&
      request.headers.origin === `http://127.0.0.1:${server.address().port}` &&
      !request.headers["transfer-encoding"] &&
      Number(request.headers["content-length"] ?? 0) === 0
    ) {
      evidence.syntheticPresence.requests += 1;
      return void response.writeHead(204, { "cache-control": "no-store" }).end();
    }
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
    for (const screen of printOnly || associativeOnly
      ? ["associative"]
      : ["calculator", "associative"]) {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-10T15:00:00Z"));
      page.setDefaultTimeout(15_000);
      page.on("pageerror", (error) => evidence.consoleErrors.push({ screen, text: error.message }));
      const consoleMessages = new Map();
      page.on("console", (message) => {
        if (message.type() === "error") {
          const entry = {
            screen,
            text: message.text(),
            url: message.location().url,
          };
          consoleMessages.set(message, entry);
          evidence.consoleErrors.push(entry);
        }
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
        if (printOnly) {
          result.printEstimate = await checkAssociativePrintEstimate(page, artifactRoot);
          result.passed = true;
          continue;
        }
        await captureFocusedLayouts(page, screen, artifactRoot, result.matrix, save);
        if (screen === "associative") {
          result.printEstimate = await checkAssociativePrintEstimate(page, artifactRoot);
          await save();
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
          await page.setViewportSize(viewports[0]);
          for (const [name, check] of [
            ["guidance", () => checkAssociativeGuidance(page)],
            [
              "continuity",
              () =>
                checkAssociativeCalculationContinuity(page, {
                  onExpectedConsoleError(message) {
                    const entry = consoleMessages.get(message);
                    assert.ok(entry, "Injected 503 must match an observed console event");
                    evidence.consoleErrors.splice(evidence.consoleErrors.indexOf(entry), 1);
                  },
                }),
            ],
          ]) {
            process.stdout.write(`Documentation preview: ${name}\n`);
            try {
              result[name] = await check();
            } catch (error) {
              result[name] = { passed: false, error: error.stack ?? String(error) };
            }
            await save();
          }
          assert.equal(result.guidance.passed, true, result.guidance.error);
          assert.equal(result.continuity.passed, true, result.continuity.error);
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
  await runDocumentationLegalPreview({
    printOnly: process.argv.includes("--print-only"),
    associativeOnly: process.argv.includes("--associative-only"),
  });
