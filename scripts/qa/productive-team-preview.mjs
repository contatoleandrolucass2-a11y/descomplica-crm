import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(root, "test-results/productive-team-preview");
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const roster = [
  { key: "broker-a", owner: "Corretor sintético A", manager: "Gerente sintético A" },
  { key: "broker-b", owner: "Corretor sintético B", manager: "Gerente sintético B" },
];
const fixture = {
  version: 4,
  viewKey: "all",
  brokerCount: 2,
  brokerManagerCount: 2,
  coverageStart: "2026-10-01",
  referenceDate: "2026-10-31",
  dimensions: {
    managers: roster.map((row) => row.manager),
    owners: roster.map((row) => row.owner),
    companies: ["Empresa sintética"],
    developments: [],
    stores: [],
  },
  facts: [
    [1, "2026-10-10", 0, 0, 0, 1, -1, 9, 0, 0, -1],
    [1, "2026-10-11", 1, 1, 0, 1, -1, 3, 0, 0, -1],
    [2, "2026-10-10", 0, 0, 0, 1, -1, 7, 0, 0, -1],
    [4, "2026-10-11", 1, 1, 0, 1, -1, 4, 0, 0, -1],
    [2, "2026-10-10", 0, 0, 0, 0, -1, 2, 0, 0, -1],
  ],
  appointments: roster.map((broker, index) => ({
    createdAt: `2026-10-${index + 10}T12:00:00Z`,
    scheduledAt: null,
    attendedAt: null,
    visitPerformed: false,
    regionalManager: `Regional sintético ${index === 0 ? "A" : "B"}`,
    salesManager: broker.manager,
    owner: broker.owner,
    accountName: "",
    accountRanking: "",
    channel: 1,
    company: "Empresa sintética",
    registeredBroker: true,
  })),
};
const evidence = {
  passed: false,
  branch: execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  environment:
    "Local Windows; synthetic Vite preview; not authenticated Next runtime or production CSS",
  source: "app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard.tsx",
  screens: [],
  interactions: [],
  errors: [],
  externalRequests: [],
};
await mkdir(outputRoot, { recursive: true });
const entry = path.join(root, "scripts/qa/productive-team-memory.tsx").replaceAll("\\", "/");
const built = await build({
  root,
  configFile: false,
  envFile: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
  resolve: {
    alias: { "@": root, "next/navigation": "\0next/navigation", "next/link": "\0next/link" },
  },
  oxc: { jsx: { runtime: "automatic" } },
  css: {
    modules: {
      generateScopedName: (name, filename) =>
        `${path.basename(filename, ".css").replaceAll(".", "_")}_${name}_qa`,
    },
  },
  plugins: [
    {
      name: "productive-team-synthetic-preview",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("productive-team-memory.tsx")) return entry;
        if (id === "next/navigation" || id === "next/link") return `\0${id}`;
      },
      load(id) {
        if (id === "\0next/navigation")
          return "export const usePathname = () => '/app/equipe-produtiva';";
        if (id === "\0next/link")
          return "import {createElement} from 'react';export default function Link({prefetch,...props}) {return createElement('a',props);}";
        if (id === entry)
          return `import {createRoot} from 'react-dom/client';import {ProductiveTeamDashboard} from '@/app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard';import {DashboardShell} from '@/app/(protected)/_components/DashboardShell';import {PAGE_REGISTRY} from '@/lib/navigation/registry';import '@/app/globals.css';const fixture=${JSON.stringify(fixture)};const roster=${JSON.stringify(roster)};const pages=PAGE_REGISTRY.map(page=>({...page,key:page.pageKey}));const query=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(<DashboardShell pages={pages}><main style={{padding:'16px',maxWidth:'1600px',margin:'auto'}}><ProductiveTeamDashboard analysis={query.has('empty')?null:fixture} brokerRoster={roster} availableStages={query.has('missing')?['appointments','visits','sales']:['appointments','visits','folders','sales']} generatedAt="2026-10-31T15:00:00Z" calendarDate="2026-10-31"/></main></DashboardShell>);`;
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    cssMinify: false,
    lib: { entry, name: "ProductiveTeamQa", formats: ["iife"] },
  },
});
const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
const files = new Map(
  output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
);
const script = output.find((file) => file.type === "chunk" && file.isEntry).fileName;
const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Equipe Produtiva QA sintético</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${[
  ...files.keys(),
]
  .filter((name) => name.endsWith(".css"))
  .map((name) => `<link rel="stylesheet" href="${name}">`)
  .join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/")
    return response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  if (pathname === "/favicon.ico") return response.writeHead(204).end();
  if (files.has(pathname))
    return response
      .writeHead(200, {
        "content-type": pathname.endsWith(".css") ? "text/css" : "text/javascript",
      })
      .end(files.get(pathname));
  response.writeHead(404).end();
});
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  evidence.browser = browser.version();
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    evidence.externalRequests.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  page.setDefaultTimeout(12_000);
  const cards = () => page.getByRole("region", { name: "Corretores produtivos por etapa" });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    for (const theme of ["light", "balanced", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await expect(
        page.getByRole("heading", { name: "Equipe Produtiva", exact: true }),
      ).toBeVisible();
      await expect(cards().getByRole("heading")).toHaveCount(4);
      await expect(cards()).toContainText("1 de 2 corretores com visitas");
      await expect(cards()).toContainText("0 de 2 corretores com pastas");
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(
        geometry.scrollWidth <= geometry.width + 1,
        `No horizontal overflow ${theme}/${width}`,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((row) => ({
          id: row.id,
          targets: row.nodes.map((node) => node.target),
        })),
        [],
        `axe ${theme}/${width}`,
      );
      await page.screenshot({
        path: path.join(outputRoot, `${theme}-${width}.png`),
        fullPage: true,
      });
      evidence.screens.push({ theme, width, geometry, axeViolations: 0 });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin);
  await page.getByLabel("Gerente de Vendas").selectOption("Gerente sintético A");
  await expect(cards()).toContainText("1 de 1 corretores com visitas");
  await expect(cards()).toContainText("0 de 1 corretores com vendas");
  await page.getByRole("button", { name: /Limpar/ }).click();
  await page.getByLabel("Responsável da conta").selectOption(roster[1].owner);
  await expect(cards()).toContainText("1 de 1 corretores com vendas");
  await page.getByRole("button", { name: /Limpar/ }).click();
  await page.getByLabel("Gerente Regional").selectOption("Regional sintético A");
  await expect(cards()).toContainText("Vínculo regional indisponível para o período selecionado.");
  await page.getByRole("button", { name: /Limpar/ }).click();
  await page.getByLabel("Empresa").selectOption("Empresa sintética");
  await expect(cards()).toContainText(
    "Cadastro de corretores indisponível para este canal ou empresa.",
  );
  await page.getByRole("button", { name: /Limpar/ }).click();
  await page.getByRole("button", { name: "Imob", exact: true }).click();
  await expect(cards()).toContainText(
    "Cadastro de corretores indisponível para este canal ou empresa.",
  );
  await page.getByRole("button", { name: /Limpar/ }).click();
  const period = page.getByRole("button", { name: "Outubro de 2026", exact: true });
  await period.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Fechar calendário" })).toBeFocused();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(cards()).toContainText("0 de 2 corretores com visitas");
  await page.getByRole("button", { name: /Limpar/ }).click();
  await expect(cards()).toContainText("1 de 2 corretores com visitas");
  evidence.interactions.push(
    "manager",
    "owner",
    "regional-unavailable",
    "company-unavailable",
    "channel-unavailable",
    "period-keyboard",
    "clear",
  );
  evidence.zoomMethod =
    "CSS viewport equivalents with deviceScaleFactor on a 1440×900 physical canvas";
  evidence.zoomChecks = [];
  for (const level of [
    { percent: 80, width: 1800, height: 1125, deviceScaleFactor: 0.8 },
    { percent: 100, width: 1440, height: 900, deviceScaleFactor: 1 },
    { percent: 125, width: 1152, height: 720, deviceScaleFactor: 1.25 },
    { percent: 150, width: 960, height: 600, deviceScaleFactor: 1.5 },
    { percent: 200, width: 720, height: 450, deviceScaleFactor: 2 },
  ]) {
    const zoomContext = await browser.newContext({
      viewport: { width: level.width, height: level.height },
      deviceScaleFactor: level.deviceScaleFactor,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    try {
      await zoomContext.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        evidence.externalRequests.push(route.request().url());
        return route.abort("blockedbyclient");
      });
      const zoomPage = await zoomContext.newPage();
      zoomPage.on("pageerror", (error) => evidence.errors.push(error.message));
      await zoomPage.goto(origin);
      await expect(
        zoomPage.getByRole("heading", { name: "Equipe Produtiva", exact: true }),
      ).toBeVisible();
      await expect(
        zoomPage
          .getByRole("region", { name: "Corretores produtivos por etapa" })
          .getByRole("heading"),
      ).toHaveCount(4);
      let geometry;
      await expect
        .poll(
          async () => {
            geometry = await zoomPage.evaluate(() => {
              const shell = document.querySelector("[data-dashboard-shell]");
              const surface = document.querySelector("[data-dashboard-surface]");
              return {
                width: innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                shellWidth: shell.clientWidth,
                railWidth: Number.parseFloat(
                  getComputedStyle(shell).getPropertyValue("--dashboard-sidebar-rail"),
                ),
                layoutWidth: Number.parseFloat(
                  getComputedStyle(surface).getPropertyValue("--dashboard-layout-width"),
                ),
                deviceScaleFactor: devicePixelRatio,
                narrowMediaQuery: matchMedia("(max-width: 760px)").matches,
              };
            });
            return (
              Math.abs(
                geometry.layoutWidth - Math.max(1, geometry.shellWidth - geometry.railWidth),
              ) <= 1 && geometry.scrollWidth <= geometry.width + 1
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);
      assert.equal(geometry.width, level.width, "Equivalent zoom changes the CSS viewport");
      assert.equal(
        geometry.narrowMediaQuery,
        level.width <= 760,
        "Equivalent zoom evaluates responsive media queries",
      );
      assert.ok(Math.abs(geometry.deviceScaleFactor - level.deviceScaleFactor) < 0.001);
      const screenshot = await zoomPage.screenshot({
        path: path.join(outputRoot, `zoom-${level.percent}.png`),
        fullPage: false,
      });
      const metadata = await sharp(screenshot).metadata();
      assert.equal(metadata.width, 1440, "Physical screenshot width");
      assert.equal(metadata.height, 900, "Physical screenshot height");
      evidence.zoomChecks.push({
        ...level,
        geometry,
        screenshot: { width: metadata.width, height: metadata.height },
      });
    } finally {
      await zoomContext.close();
    }
  }
  evidence.interactions.push("zoom-equivalent-80-100-125-150-200");
  await page.goto(`${origin}?missing`);
  await expect(cards()).toContainText("Relatório indisponível para esta etapa.");
  await expect(cards()).not.toContainText("0 de 2 corretores com pastas");
  await page.goto(`${origin}?empty`);
  await expect(page.getByRole("status")).toContainText("Aguardando coleta confirmada");
  await expect(cards()).not.toContainText("0%");
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.interactions.push("source-absent-vs-zero");
  evidence.passed = true;
} catch (error) {
  evidence.failure = error.stack ?? String(error);
  throw error;
} finally {
  await writeFile(path.join(outputRoot, "evidence.json"), JSON.stringify(evidence, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  console.log(
    JSON.stringify(
      {
        passed: evidence.passed,
        screens: evidence.screens.length,
        interactions: evidence.interactions,
        evidence: path.join(outputRoot, "evidence.json"),
        failure: evidence.failure,
      },
      null,
      2,
    ),
  );
}
