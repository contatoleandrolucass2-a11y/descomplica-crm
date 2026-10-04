import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

// These DOM expectations are independent of the production presentation helpers.
export function readTabelaoLayout() {
  const shell = document.querySelector(".tabelao-page-shell");
  const hero = shell?.querySelector(".investor-compact-hero");
  const title = hero?.querySelector("h1");
  const hint = hero?.querySelector(".investor-hero-title > .investor-info-hint");
  const titleBox = title?.getBoundingClientRect();
  const hintBox = hint?.getBoundingClientRect();
  const resources = shell?.querySelector(".tabelao-resources");
  const actions = [...(resources?.querySelectorAll(":scope > button, :scope > a") ?? [])];
  const expectedActions = [
    "Aprenda +",
    "Política comercial",
    "Imprimir",
    "Bora Vender",
    "Salesforce",
  ];
  const safeLink = (link, href) =>
    link?.tagName === "A" &&
    link.getAttribute("href") === href &&
    link.target === "_blank" &&
    link.relList.contains("noopener") &&
    link.relList.contains("noreferrer");
  const table = shell?.querySelector(".investor-stock-table");
  const columns = [
    ["region", "Região", "tabelao-stock-col-region"],
    ["business", "Empresa", "investor-stock-col-business"],
    ["project", "Empreendimento", "tabelao-stock-col-project"],
    ["address", "Endereço", "tabelao-stock-col-address", "Logradouro da obra / Número / Bairro"],
    ["area", "Metragem", "investor-stock-col-area"],
    ["delivery", "Entrega", "investor-stock-col-date", "Data de entrega"],
    ["plant", "Planta", "investor-stock-col-plant"],
    ["parking", "Vagas", "tabelao-stock-col-parking", "Quantidade de vagas"],
    ["quantity", "Estoque", "tabelao-stock-col-quantity", "Unidades no estoque publicado"],
    ["progress", "% obra", "tabelao-stock-col-progress", "Total do andamento da obra (%)"],
    ["description", "Limitador", "tabelao-stock-col-description", "Outras descrições"],
    ["cashback", "Volta ao Caixa", "tabelao-stock-col-cashback", "Folga volta ao caixa"],
    ["appraisal", "Avaliação", "tabelao-stock-col-appraisal", "Valor de avaliação bancária"],
    ["price", "Valor do Imóvel", "investor-stock-col-price", "Menor valor do imóvel"],
  ];
  const headers = [...(table?.querySelectorAll("thead th") ?? [])];
  const cols = [...(table?.querySelectorAll("colgroup col") ?? [])];
  const cells = [...(table?.querySelectorAll("tbody th, tbody td") ?? [])];
  const prices = [...(table?.querySelectorAll('[headers~="tabelao-price"]') ?? [])];
  const addressLinks = [...(table?.querySelectorAll('[headers~="tabelao-address"] a') ?? [])];
  const priceColor =
    document.documentElement.dataset.theme === "dark" ? "rgb(245, 207, 112)" : "rgb(128, 96, 0)";
  return {
    compactHeader:
      hero != null &&
      hero.querySelectorAll("h1").length === 1 &&
      title.textContent.trim() === "Simulador Tabelão" &&
      hero.querySelector(".documentation-breadcrumb, .goal-kicker, .investor-hero-guide small") ==
        null &&
      hero.querySelector(".investor-guided-start")?.textContent.trim() ===
        "Iniciar passo a passo" &&
      hintBox?.width > 0 &&
      hintBox.left >= titleBox.right - 1 &&
      Math.abs((hintBox.top + hintBox.bottom - titleBox.top - titleBox.bottom) / 2) <= 2,
    resourceOrder:
      actions.length === expectedActions.length &&
      actions.every((action, index) => action.textContent.trim() === expectedActions[index]) &&
      Boolean(table?.compareDocumentPosition(resources) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      Boolean(
        resources?.compareDocumentPosition(shell.querySelector(".investor-page-footer")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    resourceIconsAndFit:
      actions.length === 5 &&
      actions.every((action) => {
        const box = action.getBoundingClientRect();
        const icon = action.querySelector("svg.lucide[aria-hidden='true']");
        const range = document.createRange();
        range.selectNodeContents(action.querySelector("span") ?? action);
        return (
          icon?.getBoundingClientRect().width > 0 &&
          box.height >= 44 &&
          box.left >= 0 &&
          box.right <= innerWidth + 1 &&
          [...range.getClientRects()].every(
            (rect) =>
              rect.left >= box.left - 1 &&
              rect.right <= box.right + 1 &&
              rect.top >= box.top - 1 &&
              rect.bottom <= box.bottom + 1,
          )
        );
      }),
    policyDisabled:
      actions[1]?.tagName === "BUTTON" &&
      actions[1].disabled === true &&
      !actions[1].hasAttribute("href"),
    resourceLinks:
      safeLink(actions[3], "https://boravender.app.br/login") &&
      safeLink(actions[4], "https://direcional.my.site.com/vendas/s/"),
    columnsAndAria:
      headers.length === columns.length &&
      cols.length === columns.length &&
      columns.every(
        ([id, label, className, ariaLabel], index) =>
          headers[index].id === `tabelao-${id}` &&
          headers[index].textContent.trim() === label &&
          headers[index].scope === "col" &&
          cols[index].className === className &&
          (ariaLabel === undefined || headers[index].getAttribute("aria-label") === ariaLabel),
      ),
    bodyAlignment:
      cells.length > 0 &&
      cells.every((cell) => {
        const index = columns.findIndex(([id]) => cell.headers.split(/\s+/)[0] === `tabelao-${id}`);
        if (index < 0 || !headers[index]) return false;
        const box = cell.getBoundingClientRect();
        const headerBox = headers[index].getBoundingClientRect();
        return (
          cell.dataset.label === columns[index][1] &&
          Math.abs(box.left - headerBox.left) <= 1 &&
          Math.abs(box.width - headerBox.width) <= 1
        );
      }),
    goldBoldPrices:
      prices.length > 0 &&
      prices.every((cell) => {
        const style = getComputedStyle(cell);
        return style.color === priceColor && Number(style.fontWeight) >= 700;
      }),
    mapsLinks:
      addressLinks.length > 0 &&
      addressLinks.every((link) => {
        const url = new URL(link.href);
        return (
          safeLink(link, link.href) &&
          link.classList.contains("tabelao-address-link") &&
          link.classList.contains("tabelao-stock-wrapped-text") &&
          url.origin === "https://www.google.com" &&
          url.pathname === "/maps/search/" &&
          url.searchParams.get("api") === "1" &&
          Boolean(url.searchParams.get("query")) &&
          link.textContent.trim() === link.closest("td").title
        );
      }),
  };
}

export async function checkTabelaoLayout(page) {
  const checks = await page.evaluate(readTabelaoLayout);
  const originalTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  try {
    for (const theme of ["light", "balanced", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      // Theme transitions must finish before inspecting the actual rendered color.
      await page.waitForFunction(() =>
        [...document.getAnimations()].every(
          (animation) =>
            animation.constructor.name !== "CSSTransition" || animation.playState === "finished",
        ),
      );
      checks[`goldBoldPrices_${theme}`] = (await page.evaluate(readTabelaoLayout)).goldBoldPrices;
    }
  } finally {
    await page.evaluate((theme) => {
      if (theme === null) document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", theme);
    }, originalTheme);
  }

  const learn = page
    .locator(".tabelao-resources")
    .getByRole("button", { name: "Aprenda +", exact: true });
  await learn.click();
  const guide = page.locator("#investor-guided-tour");
  await guide.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.activeElement === document.querySelector("#investor-guided-tour"),
  );
  checks.footerOpensTour = await guide
    .getByRole("heading", { name: "Consulte todas as tipologias", exact: true })
    .isVisible();
  await page.keyboard.press("Escape");
  await guide.waitFor({ state: "hidden" });
  checks.footerTourReturnsFocus = await learn.evaluate(
    (element) => document.activeElement === element,
  );
  await learn.click();
  await guide.waitFor({ state: "visible" });
  await guide.getByRole("button", { name: "Próximo", exact: true }).click();
  await guide.getByRole("button", { name: "Próximo", exact: true }).click();
  await guide.getByRole("button", { name: "Concluir guia", exact: true }).click();
  await guide.waitFor({ state: "hidden" });
  checks.footerTourCompletionReturnsFocus = await learn.evaluate(
    (element) => document.activeElement === element,
  );

  checks.printInvoked = await page
    .locator(".tabelao-resources")
    .getByRole("button", { name: "Imprimir", exact: true })
    .evaluate((button) => {
      const original = window.print;
      let calls = 0;
      window.print = () => {
        calls += 1;
      };
      try {
        button.click();
        return calls === 1;
      } finally {
        window.print = original;
      }
    });
  try {
    await page.emulateMedia({ media: "print" });
    // Print media can leave min-width in a transition until the next rendered frame.
    const printLayout = await page.waitForFunction(
      () => {
        const shell = document.querySelector(".tabelao-page-shell");
        const table = shell.querySelector(".investor-stock-table");
        const results = shell.querySelector(".investor-stock-results");
        const panel = shell.querySelector(".investor-stock-panel");
        const rows = [...table.querySelectorAll("tr[data-inventory-unit-id]")];
        return (
          [
            ".tabelao-resources",
            ".investor-hero-guide",
            ".investor-info-hint",
            ".investor-stock-filters",
          ].every((selector) =>
            [...shell.querySelectorAll(selector)].every(
              (element) => getComputedStyle(element).display === "none",
            ),
          ) &&
          panel.checkVisibility() &&
          shell.querySelector(".investor-compact-hero").checkVisibility() &&
          rows.length > 0 &&
          rows.every((row) => row.checkVisibility() && row.getBoundingClientRect().height > 0) &&
          getComputedStyle(table).display === "table" &&
          getComputedStyle(table).minWidth === "0px" &&
          getComputedStyle(results).overflowX === "visible" &&
          [...table.querySelectorAll("thead th")].every(
            (cell) => getComputedStyle(cell).transform === "none",
          )
        );
      },
      undefined,
      { timeout: 5_000 },
    );
    checks.printLayout = await printLayout.jsonValue();
    await printLayout.dispose();
    for (const theme of ["light", "balanced", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await page.waitForFunction(() =>
        [...document.getAnimations()].every(
          (animation) =>
            animation.constructor.name !== "CSSTransition" || animation.playState === "finished",
        ),
      );
      checks[`printReadable_${theme}`] = await page.evaluate(() => {
        const shell = document.querySelector(".tabelao-page-shell");
        const table = shell.querySelector(".investor-stock-table");
        const cells = [...table.querySelectorAll("th, td")];
        const prices = [...table.querySelectorAll('[headers~="tabelao-price"]')];
        const walker = document.createTreeWalker(
          shell.querySelector(".investor-main"),
          NodeFilter.SHOW_TEXT,
        );
        const visibleText = [];
        while (walker.nextNode()) {
          const element = walker.currentNode.parentElement;
          if (walker.currentNode.textContent.trim() && element?.checkVisibility()) {
            visibleText.push(element);
          }
        }
        const contrastOnWhite = (color) => {
          const rgb = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
          if (!rgb) return 0;
          const linear = rgb.slice(1).map((channel) => {
            const value = Number(channel) / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05);
        };
        return (
          getComputedStyle(shell).backgroundColor === "rgb(255, 255, 255)" &&
          visibleText.length > cells.length &&
          visibleText.every((element) => contrastOnWhite(getComputedStyle(element).color) >= 4.5) &&
          cells.every((cell) => getComputedStyle(cell).backgroundColor === "rgb(255, 255, 255)") &&
          prices.length > 0 &&
          prices.every((cell) => getComputedStyle(cell).color === "rgb(128, 96, 0)")
        );
      });
    }
  } finally {
    await page.emulateMedia({ media: null });
    await page.evaluate((theme) => {
      if (theme === null) document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", theme);
    }, originalTheme);
  }
  return checks;
}

export function buildTabelaoMapsFixture() {
  const base = {
    businessUnit: "Direcional",
    project: "QA Maps",
    product: "Apartamento QA",
    plant: "Tipo 2Q",
    privateArea: 45,
    finalWithKit: 210_000,
    unitBonus: 5_000,
    tableSlack: 5_000,
    cashBackSlack: 2_000,
    appraisal: 230_000,
    progress: 0.5,
    classification: "HIS-2",
    completionDate: "2027-06-01",
    street: "Rua QA & Teste",
    streetNumber: "10",
    neighborhood: "Vila QA",
    city: "São Paulo",
    state: "SP",
    postalCode: "01001000",
  };
  return [
    { ...base, id: "qa-maps-1", parkingSpaces: 0 },
    { ...base, id: "qa-maps-2", parkingSpaces: 1, finalWithKit: 220_000 },
    {
      ...base,
      id: "qa-maps-3",
      parkingSpaces: 2,
      finalWithKit: 230_000,
      city: "Campinas",
      postalCode: "13010000",
    },
    { ...base, id: "qa-maps-4", parkingSpaces: 3, finalWithKit: 240_000, postalCode: "01002000" },
    { ...base, id: "qa-maps-5", parkingSpaces: 4, finalWithKit: 250_000, city: "Santos" },
    {
      ...base,
      id: "qa-maps-6",
      parkingSpaces: 5,
      finalWithKit: 260_000,
      street: null,
      streetNumber: null,
      neighborhood: null,
      city: null,
      state: null,
      postalCode: null,
    },
  ];
}

export async function checkTabelaoMapsFixture(page) {
  const items = buildTabelaoMapsFixture();
  const inventoryPattern = /\/api\/inventory(?:\/snapshot)?(?:\?.*)?$/;
  const inventoryHandler = (route) => {
    const rows = new URL(route.request().url()).pathname.endsWith("/snapshot") ? [] : items;
    return route.fulfill({
      json: { source: "QA Maps synthetic", count: rows.length, items: rows },
    });
  };
  const regionsPattern = "**/api/inventory/regions*";
  const regionsHandler = (route) =>
    route.fulfill({ json: syntheticRegions(route.request().url()) });
  await page.route(inventoryPattern, inventoryHandler);
  await page.route(regionsPattern, regionsHandler);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('tr[data-inventory-unit-id="qa-maps-6"]').waitFor({ state: "attached" });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("tr[data-inventory-unit-id]")].every(
        (row) => row.dataset.inventoryRegion !== "Localizando",
      ),
    );
    return await page.evaluate(() => {
      const row = (id) => document.querySelector(`tr[data-inventory-unit-id="qa-maps-${id}"]`);
      const address = (id) => row(id)?.querySelector('[headers~="tabelao-address"]');
      const expectedQueries = [
        [1, "Rua QA & Teste, 10, Vila QA, São Paulo, SP, 01001000", 2],
        [3, "Rua QA & Teste, 10, Vila QA, Campinas, SP, 13010000", 1],
        [4, "Rua QA & Teste, 10, Vila QA, São Paulo, SP, 01002000", 1],
        [5, "Rua QA & Teste, 10, Vila QA, Santos, SP, 01001000", 1],
      ];
      return {
        sameDestinationMerged: address(1)?.rowSpan === 2 && address(2) == null,
        distinctDestinationsPreserved: expectedQueries.every(([id, query, span]) => {
          const cell = address(id);
          const link = cell?.querySelector("a.tabelao-address-link");
          if (!link) return false;
          const url = new URL(link.href);
          return (
            cell.rowSpan === span &&
            link.textContent.trim() === "Rua QA & Teste / 10 / Vila QA" &&
            url.origin === "https://www.google.com" &&
            url.pathname === "/maps/search/" &&
            url.searchParams.get("api") === "1" &&
            url.searchParams.get("query") === query &&
            link.target === "_blank" &&
            link.relList.contains("noopener") &&
            link.relList.contains("noreferrer")
          );
        }),
        missingAddressHasNoLink:
          address(6)?.querySelector("a") == null &&
          address(6)?.querySelector("span.tabelao-stock-wrapped-text")?.textContent ===
            "Não informado / Não informado / Não informado",
        allRowsPreserved: document.querySelectorAll("tr[data-inventory-unit-id]").length === 6,
      };
    });
  } finally {
    await page.unroute(inventoryPattern, inventoryHandler);
    await page.unroute(regionsPattern, regionsHandler);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("tr[data-inventory-unit-id]").first().waitFor({ state: "attached" });
  }
}

function syntheticRegions(url) {
  const postalCodes = new URL(url).searchParams.get("postalCodes")?.split(",") ?? [];
  return {
    results: postalCodes.map((postalCode) => ({
      postalCode,
      source: "viacep+localizasampa+geosampa",
      status: "unconfirmed",
      region: null,
      reason: "postal-code-not-found",
      municipality: null,
      state: null,
      districts: [],
      checkedAt: "2026-10-02T12:00:00.000Z",
    })),
  };
}

async function runSyntheticLayout() {
  const root = path.resolve(import.meta.dirname, "../..");
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path.join(root, "scripts/qa/tabelao-qa-memory-entry.tsx").replaceAll("\\", "/");
  const header = "\0tabelao-qa-header";
  // Only the server-owned navigation is replaced; archive, widgets, table and CSS stay real.
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    resolve: { alias: { "@": root } },
    oxc: { jsx: { runtime: "automatic" } },
    plugins: [
      {
        name: "tabelao-qa-memory-entry",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith("tabelao-qa-memory-entry.tsx")) return entry;
          if (id.replaceAll("\\", "/").endsWith("/ArchiveHeader")) return header;
        },
        load(id) {
          if (id === header) return "export function ArchiveHeader() { return null; }";
          if (id === entry)
            return `
          import { createRoot } from "react-dom/client";
          import ${JSON.stringify(path.join(root, "app/globals.css").replaceAll("\\", "/"))};
          import { TabelaoArchive } from ${JSON.stringify(path.join(root, "app/(protected)/app/simulacao/_components/TabelaoArchive.tsx").replaceAll("\\", "/"))};
          (async () => createRoot(document.getElementById("root")).render(await TabelaoArchive()))();
        `;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "TabelaoQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script, "Synthetic bundle entry is required");
  const styles = [...files.keys()].filter((name) => name.endsWith(".css"));
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles.map((name) => `<link rel="stylesheet" href="${name}">`).join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  const items = buildTabelaoMapsFixture();
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/inventory")) {
      const rows = url.pathname.endsWith("/snapshot") ? [] : items;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          url.pathname === "/api/inventory/regions"
            ? syntheticRegions(url.href)
            : { source: "QA synthetic", count: rows.length, items: rows },
        ),
      );
      return;
    }
    const content = files.get(url.pathname);
    if (content !== undefined) {
      response.setHeader(
        "Content-Type",
        url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
      );
      response.end(content);
      return;
    }
    if (url.pathname === "/" || url.pathname === "/app/simulacao/tabelao") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(html);
      return;
    }
    response.writeHead(404).end();
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await runLayoutBrowser(origin);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runLayoutBrowser(origin) {
  const { chromium } = await import("@playwright/test");
  const ts = await import("typescript");
  const qaSource = ts.createSourceFile(
    "authenticated-visual.mjs",
    await readFile(new URL("./authenticated-visual.mjs", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
  );
  const layoutFunction = qaSource.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "readTabelaoCompactLayout",
  );
  assert.ok(layoutFunction, "Existing compact-layout oracle must remain available");
  const readCompactLayout = runInNewContext(`(${layoutFunction.getText(qaSource)})`);
  const items = buildTabelaoMapsFixture();
  let browser;
  try {
    process.stdout.write(`Tabelao QA: browser at ${origin}\n`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    page.setDefaultTimeout(15_000);
    const errors = [];
    const failures = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/inventory/regions")
        return route.fulfill({ json: syntheticRegions(url.href) });
      if (["/api/inventory", "/api/inventory/snapshot"].includes(url.pathname)) {
        const rows = url.pathname.endsWith("/snapshot") ? [] : items;
        return route.fulfill({ json: { source: "QA synthetic", count: rows.length, items: rows } });
      }
      return route.continue();
    });
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [768, 1024],
      [375, 812],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}/app/simulacao/tabelao`);
      await page.locator('tr[data-inventory-unit-id="qa-maps-6"]').waitFor({ state: "attached" });
      await page.waitForFunction(() =>
        [...document.querySelectorAll("tr[data-inventory-unit-id]")].every(
          (row) => row.dataset.inventoryRegion !== "Localizando",
        ),
      );
      const layout = await checkTabelaoLayout(page);
      const compact = await page.evaluate(readCompactLayout);
      const { columns, ...compactChecks } = compact;
      assert.equal(columns.length, 6);
      process.stdout.write(
        `${width}x${height}: ${JSON.stringify({ ...layout, ...compactChecks })}\n`,
      );
      for (const [name, passed] of Object.entries({ ...layout, ...compactChecks })) {
        if (passed !== true) failures.push(`${width}x${height}: ${name}`);
      }
      if (!layout.goldBoldPrices) {
        process.stdout.write(
          `Price style: ${JSON.stringify(
            await page
              .locator(".investor-stock-price")
              .first()
              .evaluate((cell) => {
                const style = getComputedStyle(cell);
                return { color: style.color, fontWeight: style.fontWeight };
              }),
          )}\n`,
        );
      }
    }
    const maps = await checkTabelaoMapsFixture(page);
    process.stdout.write(`Maps: ${JSON.stringify(maps)}\n`);
    for (const [name, passed] of Object.entries(maps)) {
      if (passed !== true) failures.push(`Maps: ${name}`);
    }
    assert.deepEqual(errors, [], "Browser errors");
    assert.deepEqual(failures, [], "Layout acceptance failures");
    process.stdout.write("Synthetic Tabelao layout passed; no snapshots or baseline changes.\n");
  } finally {
    await browser?.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--synthetic") await runSyntheticLayout();
  else {
    assert.equal(args.length, 2, "Usage: --synthetic OR --origin http://127.0.0.1:PORT");
    assert.equal(args[0], "--origin");
    const url = new URL(args[1]);
    assert.ok(
      url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash,
      "The fixture preview must use an HTTP loopback origin",
    );
    await runLayoutBrowser(url.origin);
  }
}
