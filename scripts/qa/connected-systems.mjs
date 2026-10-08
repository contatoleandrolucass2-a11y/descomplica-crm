import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

export async function checkConnectedSystems(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await page.goto(`${origin}/app/configuracoes`);
  await page
    .locator('[aria-labelledby="settings-areas-title"]')
    .getByRole("link", { name: "Conectar Sistemas", exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/app/configuracoes/conectar-sistemas`);
  await expect(page.getByRole("heading", { name: "Conectar Sistemas", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir Salesforce", exact: true })).toHaveAttribute(
    "href",
    "https://direcional.my.salesforce.com/",
  );
  await expect(page.getByRole("link", { name: "Console de vendas", exact: true })).toHaveAttribute(
    "href",
    "https://direcional.lightning.force.com/lightning",
  );
  await expect(page.locator('[aria-labelledby="reports-title"] tbody a')).toHaveCount(7);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const checks = [];
  for (const theme of ["light", "balanced", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const label = { light: "Claro", balanced: "Médio", dark: "Escuro" }[theme];
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `Conectar Sistemas overflow at ${width}px in ${theme}`);
      const result = await new AxeBuilder({ page }).include("main").analyze();
      assert.deepEqual(
        result.violations.map((item) => item.id),
        [],
        `Conectar Sistemas axe ${theme}/${width}`,
      );
      await page.screenshot({
        path: path.join(outputDirectory, `${theme}-${width}.png`),
        fullPage: true,
      });
      checks.push({ theme, width, overflow, accessibilityViolations: result.violations.length });
    }
  }
  return { route: "/app/configuracoes/conectar-sistemas", checks };
}

async function runSynthetic() {
  const root = path.resolve(import.meta.dirname, "../..");
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path.join(root, "scripts/qa/connected-systems-memory.tsx").replaceAll("\\", "/");
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
        name: "connected-systems-synthetic",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith("connected-systems-memory.tsx")) return entry;
        },
        load(id) {
          if (id === entry)
            return `
          import { createRoot } from "react-dom/client";
          import { ConnectedSystemsPanel } from "@/app/(protected)/app/configuracoes/conectar-sistemas/ConnectedSystemsPanel";
          import { ProtectedShellFrame } from "@/app/(protected)/_components/ProtectedShellFrame";
          import shellStyles from "@/app/(protected)/_components/ProtectedShell.module.css";
          import "@/app/globals.css";
          const root = createRoot(document.getElementById("root"));
          window.qaUnmount = () => root.unmount();
          window.qaRender = (props = {}) => root.render(
            <ProtectedShellFrame shellClassName={shellStyles.shell} contentClassName={shellStyles.mainContent}
              chrome={<header className={shellStyles.topbar}>Descomplica · Ambiente sintético</header>}>
              <ConnectedSystemsPanel key={JSON.stringify(props)} ingestLabel="Configurada" refreshAvailable canRefresh statusConfigured {...props} />
            </ProtectedShellFrame>
          );
          window.qaRender();
        `;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "ConnectedSystemsQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script);
  const css = [...files.keys()].filter((file) => file.endsWith(".css"));
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Conectar Sistemas QA</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css.map((file) => `<link rel="stylesheet" href="${file}">`).join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(html);
      return;
    }
    if (files.has(url.pathname)) {
      response.setHeader(
        "Content-Type",
        url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
      );
      response.end(files.get(url.pathname));
      return;
    }
    response.writeHead(404).end();
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.fallback();
      return route.abort("blockedbyclient");
    });
    await page.addInitScript(() => {
      const original = window.fetch;
      window.qaRequests = [];
      window.fetch = (url, options) => {
        const record = {
          url,
          cache: options?.cache,
          credentials: options?.credentials,
          aborted: false,
        };
        window.qaRequests.push(record);
        options?.signal?.addEventListener("abort", () => {
          record.aborted = true;
        });
        return original(url, options);
      };
    });
    const base = {
      state: "connected",
      checkedAt: "2026-10-08T15:00:00.000Z",
      receivedAt: "2026-10-08T15:00:01.000Z",
      nextRunAt: "2026-10-08T15:30:00.000Z",
      cycle: "succeeded",
      lastExportAt: "2026-10-08T14:58:00.000Z",
      lastPublishedAt: null,
      errorCode: null,
      reports: [
        "opportunities",
        "appointments",
        "visits",
        "folders",
        "sales",
        "brokers",
        "imobAccounts",
      ].map((key, index) => ({ key, rows: index * 1234 })),
    };
    let snapshot = base;
    let statusCode = 200;
    let requests = 0;
    let release;
    let hold = false;
    await page.route("**/api/salesforce/status", async (route) => {
      requests++;
      if (hold)
        await new Promise((resolve) => {
          release = resolve;
        });
      await route.fulfill({ status: statusCode, json: snapshot }).catch(() => {});
    });
    let refreshes = 0;
    await page.route("**/api/refresh/salesforce", async (route) => {
      refreshes++;
      await route.fulfill({ json: { status: "started" } });
    });
    await page.clock.install();
    await page.goto(origin);
    const status = page.locator('[role="status"][data-state]');
    const verify = page.getByRole("button", { name: "Verificar conexão", exact: true });
    await expect(status).toHaveText("Coletor conectado");
    await expect(page.getByText("Sem publicação confirmada", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /Oportunidades/ })).toContainText("0");
    await expect(page.getByRole("row", { name: /Agendamentos/ })).toContainText("1.234");
    await expect(page.locator("tbody tr")).toHaveCount(7);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.qaRequests[0]), {
      url: "/api/salesforce/status",
      cache: "no-store",
      credentials: "same-origin",
      aborted: false,
    });
    await verify.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => requests).toBe(2);
    assert.equal(refreshes, 0, "Checking the session never triggers ingestion");
    await expect(verify).toBeEnabled();
    await page.getByRole("button", { name: "Atualizar Salesforce", exact: true }).click();
    await expect.poll(() => refreshes).toBe(1);
    await expect(page.getByText("Sem publicação confirmada", { exact: true })).toBeVisible();

    const collection = page.locator("dl > div").filter({
      has: page.getByText("Coleta", { exact: true }),
    });
    const publication = page.locator("dl > div").filter({
      has: page.getByText("Última publicação no CRM", { exact: true }),
    });
    await expect(page.getByText("Autenticação manual com MFA", { exact: true })).toBeVisible();
    const collected = {
      ...base,
      cycle: "failed",
      errorCode: "publication_failed",
      lastExportAt: "2026-10-08T15:00:00.000Z",
      lastPublishedAt: "2026-10-08T14:59:00.000Z",
      reports: base.reports.map((report) => ({ ...report, rows: report.rows + 100 })),
    };
    snapshot = collected;
    await verify.click();
    await expect(publication.getByText("Publicação não confirmada", { exact: true })).toBeVisible();
    await expect(collection.locator("dd")).toHaveText("Concluída");
    await expect(page.getByRole("row", { name: /Agendamentos/ })).toContainText("1.334");
    await expect(page.locator('time[datetime="2026-10-08T15:00:00.000Z"]')).toHaveCount(9);
    await expect(publication.locator("time")).toHaveAttribute(
      "datetime",
      collected.lastPublishedAt,
    );
    snapshot = { ...collected, lastPublishedAt: null };
    await verify.click();
    await expect(publication.locator("dd")).toHaveText("Publicação não confirmada");
    await expect(publication.locator("time")).toHaveCount(0);
    snapshot = { ...base, cycle: "failed", errorCode: "export_failed" };
    await verify.click();
    await expect(collection.locator("dd")).toHaveText("Coleta não concluída");
    await expect(publication.getByText("Publicação não confirmada", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("row", { name: /Agendamentos/ })).toContainText("1.234");
    snapshot = base;
    await verify.click();
    await expect(collection.locator("dd")).toHaveText("Concluída");

    const directory = path.join(root, "output/playwright/connected-systems");
    await mkdir(directory, { recursive: true });
    for (const theme of ["light", "balanced", "dark"]) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({
          path: path.join(directory, `${theme}-${width}.png`),
          fullPage: true,
        });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `Overflow: ${theme}/${width} ${JSON.stringify(
            await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  (element) =>
                    element.getBoundingClientRect().right > innerWidth + 1 &&
                    !element.closest("table"),
                )
                .map((element) => ({
                  tag: element.tagName,
                  class: element.className,
                  width: element.getBoundingClientRect().width,
                }))
                .slice(0, 10),
            ),
          )}`,
        );
        const axe = await new AxeBuilder({ page }).include("main").analyze();
        assert.deepEqual(
          axe.violations.map(({ id, nodes }) => ({
            id,
            elements: nodes.map(({ target }) => target),
          })),
          [],
          `Axe: ${theme}/${width}`,
        );
        await page.screenshot({
          path: path.join(directory, `${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      "200% zoom overflow",
    );
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });

    for (const [state, label] of [
      ["waiting", "Sessão não verificada"],
      ["reauth_required", "Reconexão necessária"],
      ["stale", "Confirmação expirada"],
      ["unavailable", "Status indisponível"],
      ["unconfigured", "Status não configurado"],
    ]) {
      snapshot = { ...base, state };
      await verify.click();
      await expect(status).toHaveText(label);
    }
    snapshot = { ...base, lastPublishedAt: "2026-10-08T14:59:00.000Z" };
    await verify.click();
    await expect(page.locator('time[datetime="2026-10-08T14:59:00.000Z"]')).toBeVisible();
    statusCode = 503;
    await verify.click();
    await expect(status).toHaveText("Status indisponível");
    await expect(page.getByText("Sem dados", { exact: true })).toHaveCount(7);
    statusCode = 200;
    for (const invalid of [
      { state: "connected" },
      { ...base, checkedAt: null },
      { ...base, reports: [{ key: "sales", rows: -1 }] },
    ]) {
      snapshot = invalid;
      await verify.click();
      await expect(verify).toBeEnabled();
      await expect(status).toHaveText("Status indisponível");
    }
    snapshot = base;
    await verify.click();
    await expect(status).toHaveText("Coletor conectado");
    await page.clock.pauseAt(new Date());
    snapshot = { ...base, state: "stale" };
    await page.clock.runFor(15_000);
    await expect(status).toHaveText("Confirmação expirada");
    await expect(verify).toBeEnabled();
    hold = true;
    const beforeHold = requests;
    await verify.click();
    await expect.poll(() => requests).toBe(beforeHold + 1);
    await page.clock.runFor(9_000);
    assert.equal(requests, beforeHold + 1, "No overlapping polling");
    await expect(verify).toBeDisabled();
    await page.clock.runFor(1_000);
    await expect(status).toHaveText("Status indisponível");
    hold = false;
    release();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const beforeHidden = requests;
    await page.clock.runFor(60_000);
    assert.equal(requests, beforeHidden, "Hidden tabs do not poll");
    snapshot = base;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(status).toHaveText("Coletor conectado");
    await page.evaluate(() => window.qaRender({ canRefresh: false, statusConfigured: false }));
    await expect(status).toHaveText("Status não configurado");
    await expect(
      page.getByRole("button", { name: "Atualizar Salesforce", exact: true }),
    ).toHaveCount(0);
    hold = true;
    await verify.click();
    await expect(verify).toBeDisabled();
    await page.evaluate(() => window.qaUnmount());
    await expect.poll(() => page.evaluate(() => window.qaRequests.at(-1).aborted)).toBe(true);
    const beforeUnmount = requests;
    await page.clock.runFor(60_000);
    assert.equal(requests, beforeUnmount, "Unmount cancels timers");
    release();
    assert.deepEqual(errors, []);
    process.stdout.write(
      JSON.stringify({
        status: "passed",
        responsiveThemeChecks: 9,
        zoom: "200%",
        states: 6,
        polling: "no overlap; timeout; hidden; cleanup",
        screenshots: directory,
      }) + "\n",
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url &&
  process.argv.includes("--synthetic")
)
  await runSynthetic();
