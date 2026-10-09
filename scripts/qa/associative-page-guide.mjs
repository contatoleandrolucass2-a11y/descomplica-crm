import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import { buildSyntheticDirectTableQaSnapshot } from "./direct-table-snapshot-fixture.mjs";

const rootSelector = ".investor-associative-table-page";
const guideId = "associative-page-guide";
const routePath = "/app/simulacao/associativo-fluxo-linear";
const viewports = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
];

async function readProposalState(page) {
  return page.locator(rootSelector).evaluate((root, id) => {
    const outsideGuide = (element) => !element.closest(`#${id}`);
    return {
      fields: [...root.querySelectorAll("input, select, textarea")]
        .filter(outsideGuide)
        .map((element) => ({
          label: element.getAttribute("aria-label") || element.name || element.id,
          type: element.type,
          value: element.value,
          checked: element.checked,
          disabled: element.disabled,
          readOnly: element.readOnly,
        })),
      choices: [...root.querySelectorAll("button[aria-pressed]")]
        .filter(outsideGuide)
        .filter((element) => !element.classList.contains("investor-stock-unit-button"))
        .map((element) => ({
          label: element.getAttribute("aria-label") || element.textContent.trim(),
          pressed: element.getAttribute("aria-pressed"),
        })),
      // The selected row can leave the virtualized stock window during guide scrolling.
      unit: root.querySelector(".investor-property-summary")?.textContent ?? null,
      ledger: root.querySelector(".investor-associative-ledger")?.textContent ?? null,
    };
  }, guideId);
}

export async function assertAssociativePageGuideGeometry(dialog) {
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const fits = (box) =>
      box.width > 0 &&
      box.height > 0 &&
      box.left >= -1 &&
      box.top >= -1 &&
      box.right <= innerWidth + 1 &&
      box.bottom <= innerHeight + 1;
    const reachable = (control) => {
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return fits(box) && (hit === control || control.contains(hit));
    };
    return {
      fitsViewport: fits(rect),
      noDialogOverflow: element.scrollWidth <= element.clientWidth + 1,
      noPageOverflow:
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.body.scrollWidth <= innerWidth + 1,
      controlsReachable: [...element.querySelectorAll("button:not(:disabled)")].every(reachable),
      nonModal: element.getAttribute("aria-modal") !== "true" && !element.matches(":modal"),
    };
  });
  assert.deepEqual(
    geometry,
    {
      fitsViewport: true,
      noDialogOverflow: true,
      noPageOverflow: true,
      controlsReachable: true,
      nonModal: true,
    },
    "The non-modal guide and navigation must remain visible without horizontal overflow",
  );
}

async function setTheme(page, theme) {
  const group = page.getByRole("group", { name: "Aparência da página", exact: true });
  if (page.viewportSize().width <= 600) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await page.locator("html").getAttribute("data-theme")) === theme) break;
      await group.locator("[data-theme-cycle-mobile]").click();
    }
  } else {
    await group
      .getByRole("button", {
        name: { light: "Claro", balanced: "Médio", dark: "Escuro" }[theme],
        exact: true,
      })
      .click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function fillSyntheticProposal(page) {
  await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).fill("500000");
  await page.getByRole("button", { name: "MCMV", exact: true }).click();
  await page.getByRole("radio", { name: "Sim", exact: true }).check();
  for (const [name, value] of [
    ["Financiamento", "19000000"],
    ["Subsídio", "0"],
    ["FGTS", "0"],
    ["Cheque Moradia", "0"],
    ["Entrada", "100000"],
  ]) {
    const field = page.getByRole("textbox", { name, exact: true });
    await expect(field).toBeEnabled();
    await field.fill(value);
    await field.press("Tab");
  }
  await page.locator('input[name="quantidade-de-parcelas"]').fill("84");
  await page
    .getByRole("combobox", { name: "Selecione o Ranking", exact: true })
    .selectOption("gold");
  for (const [button, name, value] of [
    ["Inserir Sinal", "Sinal 1", "123450"],
    ["Inserir Anual", "Anual 1", "100000"],
    ["Inserir Desconto", "Desconto", "10000"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    const field = page.getByRole("textbox", { name, exact: true });
    await field.fill(value);
    await field.press("Tab");
  }
  await expect(page.locator(".investor-associative-ledger")).toBeVisible();
}

// The caller must provide the real exported step catalog and a synthetic, isolated page.
export async function checkAssociativePageGuide(
  page,
  artifactRoot,
  steps,
  { viewportMatrix = viewports, themes = ["light", "balanced", "dark"] } = {},
) {
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(page.url()).hostname),
    "Page guide QA requires a loopback synthetic page",
  );
  assert.ok(
    Array.isArray(steps) && steps.length > 1,
    "The complete exported guide catalog is required",
  );
  assert.equal(new Set(steps.map((step) => step.id)).size, steps.length, "Step IDs must be unique");
  const initialViewport = page.viewportSize();
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const launcher = page.getByRole("button", { name: "Guia passo a passo", exact: true });
  const dialog = page.getByRole("dialog", { name: "Guia passo a passo da página", exact: true });
  const previous = dialog.getByRole("button", { name: "Anterior", exact: true });
  const next = dialog.getByRole("button", { name: "Próximo", exact: true });
  const finish = dialog.getByRole("button", { name: "Concluir guia", exact: true });
  const close = dialog.getByRole("button", { name: "Fechar guia", exact: true });
  const checks = [];
  let checkpoint = "initial";
  const workspace = page.locator(`${rootSelector} .investor-workspace`);
  let closedPadding;

  async function assertPreserved(before) {
    assert.ok(
      isDeepStrictEqual(await readProposalState(page), before),
      `${checkpoint}: guide navigation changed proposal inputs, selected unit or stock filters`,
    );
  }

  async function assertStep(index, before) {
    const step = steps[index];
    await expect(dialog).toHaveAttribute("id", guideId);
    await expect(dialog).toHaveAttribute("data-step-id", step.id);
    await expect(
      dialog.getByText(`Passo ${index + 1} de ${steps.length}`, { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("heading", { name: step.title, exact: true })).toBeVisible();
    await expect(dialog.locator("#associative-page-guide-description")).toHaveText(
      step.description,
    );
    const readTarget = () =>
      page.locator(rootSelector).evaluate((root, step) => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden"
          );
        };
        const exact = [...root.querySelectorAll(step.selector)].find(visible);
        const highlighted = root.querySelector(".associative-guide-active-target");
        const fallbackSelectors = [
          step.fallback,
          '[data-tour="proposal"]',
          ".investor-stock-panel",
        ].filter(Boolean);
        const fallback = fallbackSelectors
          .map((selector) => [...root.querySelectorAll(selector)].find(visible))
          .find(Boolean);
        return {
          missing: !exact,
          correctTarget: Boolean(highlighted) && highlighted === (exact ?? fallback),
        };
      }, step);
    await expect
      .poll(async () => (await readTarget()).correctTarget, {
        message: `${checkpoint}: guide must point to the target or its preceding section`,
      })
      .toBe(true);
    const target = await readTarget();
    const unavailable = dialog.locator(".associative-page-guide-unavailable");
    if (target.missing) {
      await expect(unavailable).toBeVisible();
      if (step.unavailable) await expect(unavailable).toHaveText(step.unavailable);
      else await expect(unavailable).toContainText("etapas anteriores");
    } else await expect(unavailable).toHaveCount(0);
    await assertAssociativePageGuideGeometry(dialog);
    await assertPreserved(before);
  }

  async function open(before) {
    closedPadding = await workspace.evaluate((element) => getComputedStyle(element).paddingBottom);
    await launcher.focus();
    await launcher.press("Enter");
    await assertStep(0, before);
    assert.ok(
      await dialog.evaluate((element) => element.contains(document.activeElement)),
      "Opening the guide must move keyboard focus into it",
    );
    await expect(previous).toBeDisabled();
  }

  async function assertClosed(before) {
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeFocused();
    await expect
      .poll(() => workspace.evaluate((element) => getComputedStyle(element).paddingBottom), {
        message: "Closing the guide must restore the previous page spacing",
      })
      .toBe(closedPadding);
    await assertPreserved(before);
  }

  async function closeWithEscape(before) {
    await page.keyboard.press("Escape");
    await assertClosed(before);
  }

  async function walk(scenario) {
    const before = await readProposalState(page);
    await open(before);
    await next.press("Enter");
    await assertStep(1, before);
    await previous.press("Enter");
    await assertStep(0, before);
    await next.click();
    await closeWithEscape(before);
    await open(before);
    for (let index = 0; index < steps.length; index += 1) {
      checkpoint = `${scenario}:step-${index + 1}`;
      await assertStep(index, before);
      if (index === 0 || index === steps.length - 1) {
        const accessibility = await new AxeBuilder({ page })
          .include(`#${guideId}`)
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          accessibility.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map(({ target }) => target),
          })),
          [],
          `${checkpoint}: guide accessibility`,
        );
        if (artifactRoot)
          await page.screenshot({ path: path.join(artifactRoot, `${scenario}-${index + 1}.png`) });
      }
      if (index < steps.length - 1) {
        await expect(finish).toHaveCount(0);
        await next.click();
      }
    }
    await expect(next).toHaveCount(0);
    await finish.click();
    await assertClosed(before);
    await open(before);
    await close.click();
    await assertClosed(before);
    checks.push({
      scenario,
      stepsVisited: steps.length,
      preserved: true,
      keyboard: true,
      geometry: true,
      axe: true,
    });
  }

  try {
    if (artifactRoot) await mkdir(artifactRoot, { recursive: true });
    for (const viewport of viewportMatrix) {
      await page.setViewportSize(viewport);
      for (const theme of themes) {
        const scenario = `${viewport.width}x${viewport.height}-${theme}`;
        checkpoint = `${scenario}:load`;
        await page.reload({ waitUntil: "networkidle" });
        await setTheme(page, theme);
        const project = page.getByRole("combobox", { name: "Nome do Empreendimento", exact: true });
        await expect(project).toBeEnabled();
        await project.selectOption("Empreendimento QA 01");
        await page
          .getByRole("combobox", { name: "Ordenar unidades por valor do imóvel", exact: true })
          .selectOption("desc");
        await expect(page.locator(".investor-property-summary")).toHaveCount(0);
        await expect(
          page.locator(".investor-stock-panel").getByRole("button", {
            name: "Guia passo a passo",
            exact: true,
          }),
        ).toHaveCount(1);
        await launcher.scrollIntoViewIfNeeded();
        assert.ok(
          await launcher.evaluate((element) => {
            const panel = element.closest(".investor-stock-panel").getBoundingClientRect();
            const rect = element.getBoundingClientRect();
            const results = element
              .closest(".investor-stock-panel")
              .querySelector(".investor-stock-results")
              .getBoundingClientRect();
            return (
              rect.left >= panel.left &&
              rect.right <= panel.right + 1 &&
              rect.top >= results.bottom - 1 &&
              rect.bottom <= panel.bottom + 1 &&
              panel.right - rect.right <= 32
            );
          }),
          "Guide launcher must sit inside the stock panel, below the stock, aligned right",
        );
        await walk(`${scenario}-no-unit`);

        checkpoint = `${scenario}:interact-with-open-guide`;
        const noUnit = await readProposalState(page);
        await open(noUnit);
        const inventoryStep = steps.findIndex((step) => step.id === "inventory");
        assert.ok(inventoryStep > 0, "The full guide must contain the stock selection step");
        for (let index = 1; index <= inventoryStep; index += 1) {
          await next.click();
          await assertStep(index, noUnit);
        }
        await project.click();
        await expect(project).toBeFocused();
        await assertStep(inventoryStep, noUnit);
        await project.press("Tab");
        assert.equal(
          await dialog.evaluate((element) => element.contains(document.activeElement)),
          false,
          "A non-modal guide must not trap keyboard focus inside itself",
        );
        const unit = page.getByRole("button", {
          name: "Iniciar proposta com QA-0001",
          exact: true,
        });
        await unit.evaluate((element) => element.scrollIntoView({ block: "start" }));
        await unit.click();
        await expect(unit).toHaveAttribute("aria-pressed", "true");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText(`Passo ${inventoryStep + 1} de ${steps.length}`, { exact: true }),
        ).toBeVisible();
        await assertAssociativePageGuideGeometry(dialog);
        // Escape must work while focus belongs to the page outside the guide.
        await page.getByRole("textbox", { name: "Renda Familiar", exact: true }).click();
        await closeWithEscape(await readProposalState(page));
        checkpoint = `${scenario}:fill-proposal`;
        await fillSyntheticProposal(page);
        await walk(`${scenario}-filled-proposal`);
        process.stdout.write(
          `Associative page guide QA: ${scenario}, both proposal states passed.\n`,
        );
      }
    }
    return {
      passed: true,
      steps: steps.length,
      matrix: { viewports: viewportMatrix, themes },
      checks,
    };
  } catch (error) {
    process.stderr.write(`Associative page guide QA failed at ${checkpoint}.\n`);
    const geometry = (await dialog.count())
      ? await dialog.evaluate((element) => {
          const style = getComputedStyle(element);
          const ancestors = [];
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const css = getComputedStyle(parent);
            if (css.transform !== "none" || css.filter !== "none" || css.contain !== "none") {
              ancestors.push({
                className: parent.className,
                transform: css.transform,
                filter: css.filter,
                contain: css.contain,
              });
            }
          }
          return {
            className: element.className,
            pageScroll: {
              top: document.scrollingElement.scrollTop,
              maximum:
                document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
            },
            unit: document
              .querySelector('[aria-label="Iniciar proposta com QA-0001"]')
              ?.getBoundingClientRect()
              .toJSON(),
            rect: element.getBoundingClientRect().toJSON(),
            position: style.position,
            top: style.top,
            bottom: style.bottom,
            left: style.left,
            right: style.right,
            transform: style.transform,
            ancestors,
          };
        })
      : null;
    process.stderr.write(`Guide geometry: ${JSON.stringify(geometry)}\n`);
    if (artifactRoot) {
      await page.screenshot({ path: path.join(artifactRoot, "failure.png") });
      await writeFile(
        path.join(artifactRoot, "result.json"),
        `${JSON.stringify(
          {
            passed: false,
            checkpoint,
            geometry,
            checks,
            error: error.message,
            environment: "loopback synthetic component preview; no auth/RLS proof",
          },
          null,
          2,
        )}\n`,
      );
    }
    throw error;
  } finally {
    if (await dialog.isVisible()) await close.click();
    await page.setViewportSize(initialViewport);
    if (initialTheme) await setTheme(page, initialTheme);
  }
}

export async function runSyntheticAssociativePageGuide(options) {
  const startedAt = performance.now();
  const root = path.resolve(import.meta.dirname, "../..");
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path
    .join(root, "scripts/qa/associative-page-guide-memory.tsx")
    .replaceAll("\\", "/");
  // Reuse the existing in-memory component preview pattern; never load environment files.
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": root } },
    oxc: { jsx: { runtime: "automatic" } },
    plugins: [
      {
        name: "associative-page-guide-synthetic",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith("associative-page-guide-memory.tsx")) return entry;
        },
        load(id) {
          if (id === entry)
            return `
          import { createRoot } from "react-dom/client";
          import { AssociativeTableArchive } from "@/app/(protected)/app/simulacao/_components/AssociativeTableArchive";
          import { ASSOCIATIVE_PAGE_GUIDE_STEPS } from "@/app/(protected)/app/simulacao/_components/archive-investor/associative-page-guide-content";
          import { ProtectedShellFrame } from "@/app/(protected)/_components/ProtectedShellFrame";
          import { ThemeSwitch } from "@/app/(protected)/_components/ThemeSwitch";
          import shellStyles from "@/app/(protected)/_components/ProtectedShell.module.css";
          import "@/app/globals.css";
          import "@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css";
          window.qaPageGuideSteps = ASSOCIATIVE_PAGE_GUIDE_STEPS;
          createRoot(document.getElementById("root")).render(
            <ProtectedShellFrame shellClassName={shellStyles.shell} contentClassName={shellStyles.mainContent}
              chrome={<header className={shellStyles.topbar} data-protected-topbar>QA sintetico<ThemeSwitch canPersist={false} /></header>}>
              <AssociativeTableArchive />
            </ProtectedShellFrame>
          );
        `;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "AssociativePageGuideQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script, "Synthetic component bundle must be available");
  const css = [...files.keys()].filter((file) => file.endsWith(".css"));
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Associativo QA</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css.map((file) => `<link rel="stylesheet" href="${file}">`).join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  const snapshot = JSON.parse(buildSyntheticDirectTableQaSnapshot());
  // A small slice exercises filters and selection without the unrelated full-stock matrix.
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
    if (request.method !== "GET") return void response.writeHead(405).end();
    if (url.pathname === "/favicon.ico") return void response.writeHead(204).end();
    if (publicAssets.has(url.pathname)) {
      const asset = publicAssets.get(url.pathname);
      response.writeHead(200, { "content-type": asset.type }).end(asset.body);
    } else if (["/api/inventory", "/api/inventory/snapshot"].includes(url.pathname)) {
      response
        .writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        .end(
          JSON.stringify({
            ...inventory,
            sourceKind: url.pathname.endsWith("snapshot") ? "versioned-snapshot" : "live",
          }),
        );
    } else if (files.has(url.pathname)) {
      response
        .writeHead(200, {
          "content-type": url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
        })
        .end(files.get(url.pathname));
    } else if (url.pathname === routePath) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    } else response.writeHead(404).end();
  });
  const artifactRoot = path.join(
    root,
    "test-results/associative-page-guide",
    new Date().toISOString().replaceAll(":", "-"),
  );
  process.stdout.write(`Associative page guide artifacts: ${artifactRoot}\n`);
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    let externalRequests = 0;
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      externalRequests += 1;
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push({ text: message.text(), url: message.location().url });
    });
    await page.goto(`${origin}${routePath}`, { waitUntil: "networkidle" });
    const steps = await page.evaluate(() => window.qaPageGuideSteps);
    const result = await checkAssociativePageGuide(page, artifactRoot, steps, options);
    const evidence = {
      environment:
        "loopback component preview; real archive and styles; synthetic inventory; no auth/RLS proof",
      browser: browser.version(),
      node: process.version,
      elapsedMs: Math.round(performance.now() - startedAt),
      ...result,
      passed: result.passed && errors.length === 0 && externalRequests === 0,
      consoleErrors: errors,
      blockedExternalRequests: externalRequests,
    };
    await writeFile(
      path.join(artifactRoot, "result.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    assert.deepEqual(errors, [], "Synthetic guide preview console/page errors");
    assert.equal(externalRequests, 0, "Guide must not request external services");
    return evidence;
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
