import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const directory = path.join(root, "test-results/dashboard-report");
const themes = ["light", "balanced", "dark"];
const widths = [320, 390, 768, 1440, 1920];
const views = ["all", "with_canal_imob", "without_canal_imob"];
const stages = ["opportunities", "appointments", "visits", "folders", "sales"];
const sourceFiles = [
  "app/(protected)/app/_components/DashboardReport.tsx",
  "app/(protected)/app/_components/DashboardAutoRefresh.tsx",
  "app/(protected)/app/_components/DashboardReport.module.css",
  "app/(protected)/app/_components/DashboardPulse.tsx",
  "app/(protected)/app/_components/DashboardPulse.module.css",
  "app/(protected)/app/_components/DashboardComparisons.tsx",
  "app/(protected)/app/_components/DashboardComparisons.module.css",
  "app/(protected)/app/_components/DashboardFilters.tsx",
  "app/(protected)/app/_components/DashboardFilters.module.css",
  "app/(protected)/app/_components/DashboardMonthlyHistory.tsx",
  "app/(protected)/app/_components/DashboardMonthlyHistory.module.css",
  "app/(protected)/app/_components/analytics/analytics.module.css",
  "app/(protected)/app/_components/analytics/Charts.tsx",
  "app/(protected)/app/_components/analytics/DataDisplay.tsx",
  "app/(protected)/app/_components/analytics/DataState.tsx",
  "app/(protected)/app/_components/SalesforceRefreshButton.tsx",
  "app/(protected)/_components/ProtectedShellFrame.tsx",
  "app/(protected)/_components/ProtectedShell.module.css",
  "app/globals.css",
  "lib/crm/dashboard/presentation.ts",
  "lib/crm/dashboard/catalog.ts",
  "lib/crm/dashboard/analysis-contract.ts",
  "lib/crm/dashboard/analysis.ts",
  "lib/crm/dashboard/management-goals.ts",
];
const sections = ["Convers\u00e3o por etapa", "Funis comerciais", "Ritmo"];

// Only generated values enter this harness. No environment files, auth or data loaders.
function syntheticDashboard() {
  const monthly = [2000, 1000, 500, 250, 100];
  const weekly = [200, 70, 35, 14, 7];
  const daily = [20, 5, 2, 1, 0];
  const goals = [2400, 1600, 800, 500, 200];
  return {
    id: 1,
    snapshotKey: "qa-synthetic-dashboard-report",
    referenceDate: "2026-10-13",
    generatedAt: "2026-10-13T15:00:00.000Z",
    updatedAt: "2026-10-13T15:00:00.000Z",
    timezone: "America/Sao_Paulo",
    source: "QA SYNTHETIC ONLY",
    goalsAvailable: true,
    salesValue: Object.fromEntries(
      views.map((view) => [view, { month: 42000000, week: 2940000, today: 0 }]),
    ),
    metrics: Object.fromEntries(
      views.map((view) => [
        view,
        Object.fromEntries(
          stages.map((stage, index) => [
            stage,
            {
              currentMonth: monthly[index],
              currentWeek: weekly[index],
              currentToday: daily[index],
              goalMonth: goals[index],
              goalWeek: goals[index] / 4,
              goalToday: goals[index] / 20,
              previousMonth: monthly[index] * 0.8,
              yearClosedMonthsAverage: monthly[index] * 0.6,
              lastThreeClosedMonthsAverage: monthly[index] * 0.7,
              previousFourteenDays: weekly[index] * 2,
              lastFourteenDays: weekly[index] * 3,
              previousSevenDays: weekly[index] * 0.8,
              lastSevenDays: weekly[index],
              previousWeek: weekly[index] * 0.6,
              yesterday: daily[index] * 2,
            },
          ]),
        ),
      ]),
    ),
    topDevelopments: Object.fromEntries(
      views.map((view) => [view, [{ rank: 1, name: "Empreendimento sintetico Alfa", total: 17 }]]),
    ),
  };
}

function syntheticAnalysis() {
  const facts = [];
  for (let month = 1; month <= 10; month += 1) {
    const date = `2026-${String(month).padStart(2, "0")}-${month === 10 ? "13" : "15"}`;
    for (let owner = 0; owner < 2; owner += 1) {
      for (const [stage, multiplier] of [10, 6, 3, 2, 1].entries()) {
        const count = (month === 10 ? 2 : month) * (owner + 1) * multiplier;
        facts.push([
          stage,
          date,
          owner,
          owner,
          owner,
          owner,
          owner,
          count,
          stage === 4 ? count * 250000 : 0,
          stage === 3 ? count / 2 : 0,
        ]);
      }
    }
  }
  return {
    version: 1,
    viewKey: "all",
    coverageStart: "2026-01-01",
    referenceDate: "2026-10-13",
    dimensions: {
      managers: ["Gerencia sintetica Alfa", "Gerencia sintetica Beta"],
      owners: ["Responsavel sintetico Alfa", "Responsavel sintetico Beta"],
      companies: ["Empresa sintetica Alfa", "Empresa sintetica Beta"],
      developments: ["Empreendimento sintetico Alfa", "Empreendimento sintetico Beta"],
    },
    facts,
  };
}

function scenarios() {
  const dashboard = syntheticDashboard();
  const complete = {
    dashboard,
    selectedView: "all",
    selectedPeriod: "month",
    authorizedViews: views,
    canViewStages: true,
    canViewRanking: true,
    canRefresh: true,
    team: {
      brokers: 12,
      managers: [
        { name: "Gerencia sintetica Alfa", total: 7 },
        { name: "Gerencia sintetica Beta", total: 5 },
      ],
    },
  };
  const zero = structuredClone(complete);
  for (const metrics of Object.values(zero.dashboard.metrics)) {
    for (const metric of Object.values(metrics)) {
      for (const key of Object.keys(metric)) metric[key] = 0;
    }
  }
  for (const view of views) zero.dashboard.salesValue[view] = { month: 0, week: 0, today: 0 };
  zero.dashboard.topDevelopments = {};
  zero.team = { brokers: 0, managers: [] };
  const noGoals = structuredClone(complete);
  noGoals.dashboard.goalsAvailable = false;
  for (const metrics of Object.values(noGoals.dashboard.metrics)) {
    for (const metric of Object.values(metrics)) {
      for (const key of Object.keys(metric)) {
        if (!key.startsWith("current") && !key.startsWith("goal")) metric[key] = null;
      }
    }
  }
  const large = structuredClone(complete);
  for (const metrics of Object.values(large.dashboard.metrics)) {
    for (const metric of Object.values(metrics)) metric.currentMonth = 9876543.2;
  }
  const overCapacity = structuredClone(complete);
  overCapacity.dashboard.metrics.all.visits.currentMonth = 45;
  overCapacity.dashboard.metrics.all.folders.currentMonth = 102;
  return {
    complete,
    analysis: { ...complete, today: "2026-10-13" },
    zero,
    large,
    "over-capacity": overCapacity,
    "no-goals": noGoals,
    unavailable: {
      ...complete,
      dashboard: null,
      team: null,
      teamUnavailableReason: "Equipe sintetica indisponivel para esta visao.",
      canRefresh: false,
    },
    restricted: {
      ...complete,
      selectedView: "with_canal_imob",
      authorizedViews: ["with_canal_imob"],
      canViewStages: false,
      canViewRanking: false,
      canRefresh: false,
    },
  };
}

async function sourceHashes() {
  return Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
  );
}

async function bundle() {
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path.join(root, "scripts/qa/dashboard-report-memory.tsx").replaceAll("\\", "/");
  const link = "\0dashboard-report-next-link";
  const navigation = "\0dashboard-report-next-navigation";
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
        name: "dashboard-report-synthetic",
        enforce: "pre",
        resolveId(id) {
          if (id === "next/link") return link;
          if (id === "next/navigation") return navigation;
          if (id.endsWith("dashboard-report-memory.tsx")) return entry;
          if (id === "server-only" || id.startsWith("@supabase/")) {
            throw new Error(`Server dependency is forbidden in the synthetic harness: ${id}`);
          }
        },
        load(id) {
          if (id === link)
            return `import { createElement } from "react";
              export default function Link({ href, prefetch, replace, scroll, ...props }) {
                return createElement("a", { ...props, href });
              }`;
          if (id === navigation)
            return `const router = { refresh() {
              window.qaRefreshes = (window.qaRefreshes || 0) + 1;
              if (!window.qaDeferRefresh) window.qaApplyPublished?.();
            }, replace(url, options) {
              window.qaReplacements.push({url, options});
              queueMicrotask(() => window.qaNavigate(url));
            } };
            export function useRouter() { return router; }
            export function useSearchParams() { return new URLSearchParams(window.location.search); }`;
          if (id === entry)
            return `
              import { createRoot } from "react-dom/client";
              import { flushSync } from "react-dom";
              import { DashboardReport } from "@/app/(protected)/app/_components/DashboardReport";
              import { analyzeDashboard, applyDashboardAnalysis, emptyDashboardFilters, parseDashboardFilters, DASHBOARD_FILTER_KEYS } from "@/lib/crm/dashboard/analysis";
              import { dashboardAnalysisSliceSchema } from "@/lib/crm/dashboard/analysis-contract";
              import { ProtectedShellFrame } from "@/app/(protected)/_components/ProtectedShellFrame";
              import shellStyles from "@/app/(protected)/_components/ProtectedShell.module.css";
              import analyticsStyles from "@/app/(protected)/app/_components/analytics/analytics.module.css";
              import "@/app/globals.css";
              const fixtures = ${JSON.stringify(scenarios())};
              const analysisSlice = dashboardAnalysisSliceSchema.parse(${JSON.stringify(syntheticAnalysis())});
              const root = createRoot(document.getElementById("root"));
              window.qaRefreshes = 0;
              window.qaReplacements = [];
              window.qaRender = (scenario = "complete", overrides = {}) => {
                if (!Object.hasOwn(fixtures, scenario)) throw new Error("Unknown synthetic scenario");
                const props = { ...structuredClone(fixtures[scenario]), ...overrides };
                if (scenario === "analysis") {
                  props.filters = overrides.filters ?? emptyDashboardFilters();
                  props.analysis = analyzeDashboard(analysisSlice, props.filters);
                  props.dashboard = applyDashboardAnalysis(props.dashboard, props.analysis, props.selectedView);
                }
                window.qaCurrentProps = props;
                flushSync(() => root.render(
                  <ProtectedShellFrame shellClassName={shellStyles.shell} contentClassName={shellStyles.mainContent}
                    chrome={<header className={shellStyles.topbar}>Descomplica / QA SINTETICO</header>}>
                    <main className={analyticsStyles.canvasMain}>
                      <DashboardReport key={scenario} {...props} />
                    </main>
                  </ProtectedShellFrame>
                ));
                document.documentElement.dataset.scenario = scenario;
              };
              window.qaNavigate = (href) => {
                const next = new URL(href, location.href);
                if (next.origin !== location.origin || next.pathname !== "/app") throw new Error("Nonlocal harness navigation");
                const filters = parseDashboardFilters(Object.fromEntries(DASHBOARD_FILTER_KEYS.map(key => [key, next.searchParams.getAll(key)])));
                history.replaceState(null, "", next);
                window.qaRender(document.documentElement.dataset.scenario, {
                  ...window.qaCurrentProps, filters,
                  selectedPeriod: next.searchParams.get("period") || "month",
                });
              };
              window.qaApplyPublished = () => {
                if (!window.qaNextDashboard) return;
                window.qaRender(document.documentElement.dataset.scenario, {
                  ...window.qaCurrentProps, dashboard: window.qaNextDashboard,
                });
              };
              const query = new URLSearchParams(location.search);
              const scenario = query.get("scenario") || "complete";
              const overrides = {};
              if (["month", "week", "today"].includes(query.get("period"))) overrides.selectedPeriod = query.get("period");
              if (fixtures[scenario]?.authorizedViews.includes(query.get("view"))) overrides.selectedView = query.get("view");
              if (${JSON.stringify(themes)}.includes(query.get("theme"))) document.documentElement.dataset.theme = query.get("theme");
              if (scenario === "analysis") overrides.filters = parseDashboardFilters(Object.fromEntries(DASHBOARD_FILTER_KEYS.map(key => [key, query.getAll(key)])));
              window.qaRender(scenario, overrides);
            `;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "DashboardReportQa", formats: ["es"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script, "Synthetic bundle entry is required");
  const css = [...files.keys()].filter((file) => file.endsWith(".css"));
  assert.ok(css.length, "Real component, shell and global CSS must be bundled");
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>Dashboard QA sintetico</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">${css.map((file) => `<link rel="stylesheet" href="${file}">`).join("")}</head><body><div id="root"></div><script type="module" src="/${script}"></script></body></html>`;
  return { files, html };
}

export async function startServer() {
  const sources = await sourceHashes();
  const { files, html } = await bundle();
  assert.deepEqual(await sourceHashes(), sources, "Product changed during bundling; rerun QA");
  const requests = [];
  const refreshes = [];
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'",
    );
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.headers.host !== new URL(origin).host) return response.writeHead(403).end();
    const url = new URL(request.url, origin);
    if (request.method === "POST" && url.pathname === "/api/refresh/salesforce") {
      refreshes.push({ method: request.method, pathname: url.pathname });
      response.setHeader("Content-Type", "application/json");
      return response.end(JSON.stringify({ status: "started" }));
    }
    if (!["GET", "HEAD"].includes(request.method)) return response.writeHead(405).end();
    if (url.pathname === "/api/dashboard/status") {
      response.setHeader("Content-Type", "application/json");
      const { generatedAt, updatedAt } = syntheticDashboard();
      return response.end(JSON.stringify({ generatedAt, updatedAt }));
    }
    if (url.pathname === "/" || url.pathname === "/app") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.end(html);
    }
    if (files.has(url.pathname)) {
      response.setHeader(
        "Content-Type",
        url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
      );
      return response.end(files.get(url.pathname));
    }
    requests.push({ method: request.method, pathname: url.pathname });
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    requests,
    refreshes,
    sources,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

export async function observeDashboardStatusReads(page) {
  await page.evaluate(() => {
    window.qaStatusReadsCompleted = 0;
    const fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      if (new URL(response.url).pathname === "/api/dashboard/status") {
        const json = response.json.bind(response);
        response.json = async () => {
          const value = await json();
          window.qaStatusReadsCompleted += 1;
          return value;
        };
      }
      return response;
    };
  });
  return async (reads) => {
    // The next browser task follows the JSON consumer's continuation and finally.
    await expect.poll(() => page.evaluate(() => window.qaStatusReadsCompleted)).toBe(reads);
  };
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const colors = [...document.querySelectorAll("body *")].map(
          (element) => getComputedStyle(element).color,
        );
        if (!colors.length) return 1;
        return document.getAnimations().filter((animation) => animation.playState === "running")
          .length;
      }),
    )
    .toBe(0);
}

export async function checkStructure(page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Relat\u00f3rio completo da equipe.",
  );
  for (const name of sections) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${name}`, "i") })).toHaveCount(1);
  }
  await expect(page.locator("main")).not.toContainText(/NaN|Infinity|undefined/);
  await expect(page.locator("main dt").filter({ hasText: /^Fonte$/ })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Salesforce Analytics Reports API");
  await expect(page.locator('[aria-labelledby="report-pulse-title"] li[data-stage]')).toHaveCount(
    5,
  );
  await expect(page.locator('[aria-labelledby="report-pulse-title"] figure')).toHaveCount(5);
  await expect(
    page.locator('[aria-labelledby="report-monthly-title"] article[data-tone]'),
  ).toHaveCount(13);
  const funnels = page.locator(
    '[aria-labelledby="report-monthly-title"] figure[aria-label^="Funil mensal:"]',
  );
  await expect(funnels).toHaveCount(13);
  for (const [group, labels] of [
    ["goals", ["Meta mês", "Meta esperada até hoje", "Mês atual"]],
    ["periods", ["Mês", "Semana anterior", "Esta semana", "Ontem", "Hoje"]],
    [
      "history",
      ["Média do ano", "Média dos últimos 3 meses", "Mês anterior", "Mês", "Média venda"],
    ],
  ]) {
    const region = page.locator(`[aria-labelledby="report-${group}-title"]`);
    await expect(region.locator("article[data-tone]")).toHaveCount(labels.length);
    await expect(region.locator("h3:visible")).toHaveText(labels);
    await expect(region.locator('figure[aria-label^="Funil mensal:"]')).toHaveCount(labels.length);
  }
  for (const funnel of await funnels.all()) {
    await expect(funnel).toHaveAccessibleName(/^Funil mensal: /);
    await expect(funnel.locator("dt")).toHaveText([
      "Oportunidades",
      "Agendamentos",
      "Visitas",
      "Pastas",
      "Pastas aprovadas",
      "Vendas",
    ]);
    await expect(funnel.locator('[data-stage="approved-folders"] dd')).toHaveText("Indisponível");
    const steps = await funnel.locator("[data-stage]").evaluateAll((entries) =>
      entries.map((entry) => ({
        width: entry.getBoundingClientRect().width,
        shape: getComputedStyle(entry, "::before").clipPath,
        fill: getComputedStyle(entry, "::before").backgroundColor,
      })),
    );
    assert.equal(new Set(steps.map(({ fill }) => fill)).size, 6, "Six distinct funnel steps");
    for (let index = 0; index < steps.length; index++) {
      assert.match(steps[index].shape, /^polygon\(/, "Trapezoidal funnel, not a plain list");
      if (index > 0) assert.ok(steps[index].width < steps[index - 1].width, "Narrowing funnel");
    }
  }
  await expect(
    page.locator("#report-operational-title, #report-diagnosis-title, #report-team-title"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Ver histórico mensal:/ })).toHaveCount(3);
  for (const name of ["Mês", "Semana", "Hoje"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="/etapas/"]')).toHaveCount(0);
}

async function checkLayout(page) {
  const problems = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth + 1)
      problems.push("document horizontal overflow");
    for (const region of document.querySelectorAll(
      "main section[aria-labelledby], main details[open]",
    )) {
      if (region.scrollWidth > region.clientWidth + 1)
        problems.push(
          `${region.getAttribute("aria-labelledby") || "open disclosure"}: horizontal overflow`,
        );
    }
    for (const element of document.querySelectorAll(
      "main h1, main h2, main h3, main a, main button, main summary, main dt, main dd, main td",
    )) {
      if (!element.checkVisibility()) continue;
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      const clipped =
        element.scrollWidth > element.clientWidth + 2 &&
        getComputedStyle(element).display !== "inline";
      if (clipped)
        problems.push(`${element.tagName}: ${element.textContent.trim()} (clipped text)`);
    }
    const cards = [...document.querySelectorAll("main article, main li[data-stage]")].filter(
      (card) => card.checkVisibility(),
    );
    for (let index = 0; index < cards.length; index++) {
      const first = cards[index].getBoundingClientRect();
      for (const other of cards.slice(index + 1)) {
        const second = other.getBoundingClientRect();
        if (
          Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
          Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1
        ) {
          problems.push(
            `Overlapping cards: ${cards[index].querySelector("h3")?.textContent} / ${other.querySelector("h3")?.textContent}`,
          );
        }
      }
    }
    return problems;
  });
  assert.deepEqual(problems, [], "Horizontal overflow or clipped labels/cards");
  return page.evaluate(() => ({
    viewportWidth: innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollHeight: document.body.scrollHeight,
  }));
}

export async function captureDashboardScreenshot(page, { path, section, dialog = false } = {}) {
  if (dialog) {
    // Modal dialogs belong to the current viewport, not a stitched full document.
    await expect(page.locator("dialog[open]")).toBeVisible();
    return page.screenshot({ path, fullPage: false });
  }
  // Locator screenshots scroll their targets into view and displace sticky chrome
  // in subsequent full-page captures. Keep native CSS and capture from document zero.
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
  const header = page.locator("[data-protected-shell] > header");
  await expect(header).toHaveCSS("position", "sticky");
  const headerBox = await header.boundingBox();
  assert.ok(
    headerBox && Math.abs(headerBox.y) <= 1,
    "Native sticky header must be at document top",
  );
  const clip = section ? await section.boundingBox() : undefined;
  if (section)
    assert.ok(clip && clip.width > 0 && clip.height > 0, "Visible section bounds required");
  return page.screenshot({ path, fullPage: true, ...(clip ? { clip } : {}) });
}

export async function verifyMonthlyHistory(page, { title, months, sales, screenshot } = {}) {
  const trigger = page.getByRole("button", { name: `Ver histórico mensal: ${title}`, exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `${title}: histórico mensal`, exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Fechar histórico mensal", exact: true });
  await expect(close).toBeFocused();
  await expect(
    dialog.getByRole("heading", { name: `Meses considerados (${months.length})`, exact: true }),
  ).toBeVisible();
  assert.deepEqual(
    await dialog
      .locator("section ul time")
      .evaluateAll((nodes) => nodes.map((node) => node.dateTime)),
    months,
  );
  await expect(dialog.getByRole("figure")).toHaveCount(months.length ? 5 : 0);
  if (sales) {
    await expect(
      dialog.getByRole("figure", { name: "Vendas", exact: true }).locator("li > span"),
    ).toHaveText(
      sales.map((value) =>
        new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value),
      ),
    );
  }
  for (const key of ["Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    await expect(close).toBeFocused();
  }
  const layout = await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const clipped = [...element.querySelectorAll("h2,h3,button,time,span,figcaption")]
      .filter(
        (node) =>
          node.checkVisibility() && node.clientWidth && node.scrollWidth > node.clientWidth + 2,
      )
      .map((node) => node.textContent);
    return {
      left: box.left,
      right: box.right,
      viewport: innerWidth,
      overflow: element.scrollWidth > element.clientWidth + 1,
      clipped,
    };
  });
  assert.ok(
    layout.left >= 0 && layout.right <= layout.viewport + 1,
    "History dialog must fit viewport",
  );
  assert.equal(layout.overflow, false, "History dialog horizontal overflow");
  assert.deepEqual(layout.clipped, [], "History dialog clipped labels");
  const axe = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  assert.deepEqual(
    axe.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
    [],
    "History dialog axe",
  );
  if (screenshot) await captureDashboardScreenshot(page, { path: screenshot, dialog: true });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  return { months, focusReturned: true, escapeClosed: true, layout };
}

export async function verifyFilterDismissal(page) {
  const summaries = page.locator('summary[aria-labelledby^="filter-"]');
  await expect(summaries).toHaveCount(4);
  const before = await page.evaluate(() => ({
    url: location.href,
    filters: window.qaCurrentProps.filters,
  }));
  for (const summary of await summaries.all()) {
    const menu = summary.locator("..");
    await summary.click();
    await expect(menu).toHaveAttribute("open", "");
    await checkLayout(page);
    await page.getByRole("heading", { level: 1 }).click();
    await expect(menu).not.toHaveAttribute("open", "");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(summary).toBeFocused();
  }
  await summaries.nth(0).click();
  await summaries.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(summaries.nth(0).locator("..")).not.toHaveAttribute("open", "");
  await expect(summaries.nth(1).locator("..")).toHaveAttribute("open", "");
  await summaries.nth(2).focus();
  await expect(summaries.nth(1).locator("..")).not.toHaveAttribute("open", "");
  assert.deepEqual(
    await page.evaluate(() => ({ url: location.href, filters: window.qaCurrentProps.filters })),
    before,
  );
  return {
    outsidePointer: 4,
    escape: 4,
    focusReturn: true,
    exclusiveMenu: true,
    focusOutside: true,
  };
}

export async function verifySaleNormalization(page) {
  const values = () =>
    page.getByRole("figure", { name: "Funil mensal: Média venda", exact: true }).locator("dd");
  await expect(values()).toHaveText(["10", "6", "3", "2", "Indisponível", "1"]);
  const original = await page.evaluate(() => window.qaCurrentProps);
  try {
    for (const sales of [0, null]) {
      await page.evaluate((sales) => {
        const props = structuredClone(window.qaCurrentProps);
        props.dashboard.metrics.all.sales.yearClosedMonthsAverage = sales;
        window.qaRender("complete", props);
      }, sales);
      await expect(values()).toHaveText(Array(6).fill("Indisponível"));
      await expect(page.locator("main")).not.toContainText(/NaN|Infinity/);
    }
  } finally {
    await page.evaluate((props) => window.qaRender("analysis", props), original);
  }
  return { perSale: [10, 6, 3, 2, null, 1], zeroAndMissingSales: "unavailable" };
}

export async function verifyAnalysisInteractions(page) {
  await page.evaluate(() => {
    history.replaceState(null, "", "/app?scenario=analysis&view=all&period=week");
    window.qaReplacements = [];
    window.qaRender("analysis", { selectedPeriod: "week" });
  });
  const value = (label, stage) =>
    page
      .getByRole("figure", { name: `Funil mensal: ${label}`, exact: true })
      .locator(`[data-stage="${stage}"] dd`);
  const select = async (key, label) => {
    const summary = page.locator(`summary[aria-labelledby="filter-${key} value-${key}"]`);
    const menu = summary.locator("..");
    if (!(await menu.evaluate((element) => element.open))) await summary.click();
    await page.getByRole("checkbox", { name: label, exact: true }).check();
    await expect(page.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
    if (await menu.evaluate((element) => element.open)) await summary.click();
  };
  await expect(value("Meta mês", "appointments")).toHaveText("54");
  await expect(value("Meta mês", "visits")).toHaveText("16");
  await expect(value("Meta mês", "sales")).toHaveText("2");
  await expect(value("Meta esperada até hoje", "sales")).toHaveText("0,8");
  await expect(value("Mês atual", "sales")).toHaveText("6");
  await expect(value("Média do ano", "sales")).toHaveText("15");
  await expect(value("Média dos últimos 3 meses", "sales")).toHaveText("24");
  await expect(value("Mês anterior", "sales")).toHaveText("27");
  await verifySaleNormalization(page);
  for (const [label, sales] of [
    ["Mês (Períodos do mês)", "6"],
    ["Semana anterior", "0"],
    ["Esta semana", "6"],
    ["Ontem", "0"],
    ["Hoje", "6"],
    ["Mês (Histórico)", "6"],
  ]) {
    await expect(value(label, "sales")).toHaveText(sales);
  }
  const year = Array.from(
    { length: 9 },
    (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
  );
  await verifyMonthlyHistory(page, {
    title: "Média do ano",
    months: year,
    sales: [3, 6, 9, 12, 15, 18, 21, 24, 27],
  });
  await verifyMonthlyHistory(page, {
    title: "Média dos últimos 3 meses",
    months: year.slice(-3),
    sales: [21, 24, 27],
  });
  await verifyMonthlyHistory(page, { title: "Mês anterior", months: year.slice(-1), sales: [27] });
  await select("owner", "Responsavel sintetico Alfa");
  await expect(value("Meta mês", "appointments")).toHaveText("27");
  await expect(value("Meta mês", "visits")).toHaveText("8");
  await expect(value("Meta mês", "folders")).toHaveText("4");
  await expect(value("Meta mês", "sales")).toHaveText("1");
  await expect(value("Meta esperada até hoje", "sales")).toHaveText("0,4");
  await expect(value("Mês atual", "sales")).toHaveText("2");
  await expect(value("Média do ano", "sales")).toHaveText("5");
  await expect(value("Mês anterior", "sales")).toHaveText("9");
  await expect(value("Média venda", "sales")).toHaveText("1");
  await expect(value("Média venda", "opportunities")).toHaveText("10");
  const firstNavigation = await page.evaluate(() => window.qaReplacements.at(-1));
  const query = new URL(firstNavigation.url, "http://127.0.0.1").searchParams;
  assert.deepEqual(query.getAll("owner"), ["Responsavel sintetico Alfa"]);
  assert.equal(query.get("view"), "all");
  assert.equal(query.has("period"), false);
  assert.deepEqual(firstNavigation.options, { scroll: false });
  await verifyMonthlyHistory(page, {
    title: "Média do ano",
    months: year,
    sales: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  });
  await select("owner", "Responsavel sintetico Beta");
  await expect(value("Meta mês", "sales")).toHaveText("2");
  await expect(value("Mês atual", "sales")).toHaveText("6");
  await select("manager", "Gerencia sintetica Beta");
  await expect(value("Meta mês", "sales")).toHaveText("1");
  await expect(value("Mês atual", "sales")).toHaveText("4");
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(value("Meta mês", "sales")).toHaveText("2");
  await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toBeDisabled();
  await select("company", "Empresa sintetica Alfa");
  await expect(value("Mês atual", "sales")).toHaveText("2");
  await select("channel", "SPC - CANAL IMOB PJ");
  await expect(value("Meta mês", "sales")).toHaveText("1");
  await expect(value("Mês atual", "sales")).toHaveText("2");
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(value("Mês atual", "sales")).toHaveText("6");
  assert.deepEqual(await page.evaluate(() => window.qaCurrentProps.filters), {
    channel: [],
    manager: [],
    owner: [],
    company: [],
  });
  return {
    months: year,
    recalculatedBrokerCounts: [2, 1, 2, 1, 2, 1, 2],
    navigation: firstNavigation,
  };
}

async function keyboardDetails(page) {
  const details = page.locator("main details");
  const count = await details.count();
  assert.ok(count > 0, "Filters and conversion details remain keyboard accessible");
  for (let index = 0; index < count; index++) {
    const disclosure = details.nth(index);
    const summary = disclosure.locator(":scope > summary");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(disclosure).not.toHaveAttribute("open", "");
  }
}

async function run() {
  assert.match(process.version, /^v24\.19\./, "Use Node 24.19.x");
  const server = await startServer();
  if (process.argv.includes("--serve")) {
    process.stdout.write(
      `Synthetic dashboard: ${server.origin}\nScenarios: ?scenario=unavailable|zero|no-goals|restricted; themes: ?theme=balanced|dark\n`,
    );
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
    await server.close();
    return;
  }
  await mkdir(directory, { recursive: true });
  const report = {
    status: "running",
    startedAt: new Date().toISOString(),
    command: "node scripts/qa/dashboard-report.mjs",
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    branch: execFileSync("git", ["branch", "--show-current"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    sources: server.sources,
    themeSamples: {},
    checks: [],
    consoleErrors: [],
    pageErrors: [],
    blockedRequests: [],
    limitations: [
      "Synthetic component only; no authenticated route, API, RLS, CI, deployment or reference pixel baseline validated.",
    ],
  };
  let browser;
  let page;
  const check = async (name, action) => {
    process.stdout.write(`Checking ${name}\n`);
    try {
      const details = await action();
      report.checks.push({ name, status: "passed", ...(details ? { details } : {}) });
    } catch (error) {
      report.checks.push({ name, status: "failed", error: error.message });
    }
  };
  try {
    browser = await chromium.launch({ headless: true });
    report.environment.browser = browser.version();
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === server.origin) return route.continue();
      report.blockedRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket(/.*/, (socket) => {
      report.blockedRequests.push(socket.url());
      socket.close();
    });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    await page.goto(server.origin);
    await checkStructure(page);
    for (const scenario of ["complete", "unavailable", "analysis"]) {
      await page.evaluate((name) => window.qaRender(name), scenario);
      for (const theme of themes) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        for (const width of widths) {
          const label = `${scenario}/${theme}/${width}`;
          process.stdout.write(`Viewport ${label}\n`);
          await page.setViewportSize({ width, height: 900 });
          await settle(page);
          if (scenario === "complete" && width === 1440) {
            report.themeSamples[theme] = await page.evaluate(() => {
              const card = document.querySelector(
                '[aria-labelledby="report-pulse-title"] li[data-stage]',
              );
              return {
                background: getComputedStyle(card).backgroundColor,
                color: getComputedStyle(card).color,
              };
            });
          }
          await check(`${label}/structure`, () => checkStructure(page));
          await check(`${label}/layout`, () => checkLayout(page));
          await check(`${label}/axe`, async () => {
            const axe = await new AxeBuilder({ page }).include("main").analyze();
            const violations = axe.violations.filter(
              ({ impact }) => impact === "serious" || impact === "critical",
            );
            assert.deepEqual(
              violations.map(({ id, impact, nodes }) => ({
                id,
                impact,
                nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
              })),
              [],
              `Axe ${label}`,
            );
            return { violations: axe.violations.map(({ id, impact }) => ({ id, impact })) };
          });
          await captureDashboardScreenshot(page, {
            path: path.join(directory, `${scenario}-${theme}-${width}.png`),
          });
          if (scenario === "analysis") {
            await check(`${label}/filter-dismissal`, () => verifyFilterDismissal(page));
            await check(`${label}/history-popup`, () =>
              verifyMonthlyHistory(page, {
                title: "Média do ano",
                months: Array.from(
                  { length: 9 },
                  (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
                ),
                sales: [3, 6, 9, 12, 15, 18, 21, 24, 27],
                screenshot: path.join(directory, `analysis-history-${theme}-${width}.png`),
              }),
            );
          }
          if (scenario === "complete" && [320, 1440, 1920].includes(width)) {
            for (const section of ["pulse"]) {
              await captureDashboardScreenshot(page, {
                section: page.locator(`[aria-labelledby="report-${section}-title"]`),
                path: path.join(directory, `${section}-${theme}-${width}.png`),
              });
            }
          }
          if (scenario === "complete" && width !== 768)
            await captureDashboardScreenshot(page, {
              section: page.locator('[aria-labelledby="report-monthly-title"]'),
              path: path.join(directory, `funnels-${theme}-${width}.png`),
            });
        }
      }
    }
    await check("themes/distinct-surfaces", () => {
      assert.equal(
        new Set(Object.values(report.themeSamples).map(({ background }) => background)).size,
        3,
      );
    });
    await check("analysis/filters-history-goals-navigation", () =>
      verifyAnalysisInteractions(page),
    );
    await page.evaluate(() => window.qaRender("complete"));
    await check("keyboard/details", () => keyboardDetails(page));
    await check("ranking/removed-from-dashboard", async () => {
      const ranking = page
        .locator("main details")
        .filter({ hasText: "Empreendimento sintetico Alfa" });
      await expect(ranking).toHaveCount(0);
      await expect(
        page.locator("#report-team-title, #report-diagnosis-title, #report-operational-title"),
      ).toHaveCount(0);
    });
    await check("refresh/synthetic-only", async () => {
      await page.getByRole("button", { name: /atualizar/i }).click();
      await expect(
        page.getByText(
          "Atualiza\u00e7\u00e3o solicitada. Os dados ser\u00e3o renovados ap\u00f3s a ingest\u00e3o.",
          { exact: true },
        ),
      ).toBeVisible();
      assert.equal(server.refreshes.length, 1);
      return {
        localSyntheticPosts: server.refreshes.length,
        routerRefreshes: await page.evaluate(() => window.qaRefreshes),
      };
    });
    await page.evaluate(() => window.qaRender("restricted"));
    await check("permissions/restricted", async () => {
      await expect(page.locator("main")).not.toContainText("Empreendimento sintetico Alfa");
      await expect(page.locator('a[href*="/etapas/"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: /atualizar/i })).toHaveCount(0);
      for (const href of await page
        .locator("main a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
        const url = new URL(href, "http://127.0.0.1");
        if (url.searchParams.has("view"))
          assert.equal(url.searchParams.get("view"), "with_canal_imob");
      }
    });
    for (const scenario of ["zero", "no-goals", "large", "over-capacity"]) {
      await page.evaluate((name) => window.qaRender(name), scenario);
      await check(`${scenario}/structure`, () => checkStructure(page));
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await check(`${scenario}/${width}/layout`, () => checkLayout(page));
      }
      if (scenario === "large")
        await check("large/exact-values", async () => {
          await expect(
            page.locator(
              '[aria-labelledby="report-pulse-title"] [data-stage="sales"] dl > div:first-child dd',
            ),
          ).toHaveText("9.876.543,2");
        });
      if (scenario === "over-capacity")
        await check("over-capacity/exact-ratio", async () => {
          const figure = page.locator(
            '[aria-labelledby="report-pulse-title"] li[data-stage="folders"] figure',
          );
          await expect(figure).toHaveAttribute("data-overflow", "true");
          await expect(figure.locator("strong")).toHaveText("226,7%");
          await expect(figure).toHaveAccessibleName(/226,7%.*acima de 100%/);
          await expect(figure.locator("circle")).toHaveCount(3);
        });
      await settle(page);
      await captureDashboardScreenshot(page, { path: path.join(directory, `${scenario}.png`) });
    }
    await check("refresh/automatic-published-snapshot", async () => {
      const waitForStatusReads = await observeDashboardStatusReads(page);
      let statusReads = 0;
      let currentVersion = {
        generatedAt: "2026-10-13T15:00:00.000Z",
        updatedAt: "2026-10-13T15:00:00.000Z",
      };
      await page.route("**/api/dashboard/status", (route) => {
        statusReads += 1;
        return route.fulfill({ json: currentVersion });
      });
      const now = new Date("2026-10-14T15:00:00.000Z");
      await page.clock.install({ time: now });
      await page.clock.pauseAt(now);
      await page.evaluate(() => {
        window.qaNextDashboard = undefined;
        window.qaRefreshes = 0;
        window.qaRender("complete", { canRefresh: false, selectedPeriod: "week" });
        window.dispatchEvent(new Event("focus"));
      });
      await expect.poll(() => statusReads).toBeGreaterThan(0);
      await waitForStatusReads(statusReads);
      await expect.poll(() => page.evaluate(() => window.qaRefreshes)).toBe(0);
      await page.evaluate(() => {
        window.qaDeferRefresh = true;
        const next = structuredClone(window.qaCurrentProps.dashboard);
        next.generatedAt = "2026-10-14T15:03:00.000Z";
        next.updatedAt = "2026-10-14T15:03:05.000Z";
        next.metrics.all.sales.currentWeek = 321;
        window.qaNextDashboard = next;
      });
      currentVersion = {
        generatedAt: "2026-10-14T15:03:00.000Z",
        updatedAt: "2026-10-14T15:03:05.000Z",
      };
      const sales = page.locator(
        '[aria-labelledby="report-pulse-title"] [data-stage="sales"] dl > div:first-child dd',
      );
      await page.clock.runFor(30_100);
      await expect.poll(() => page.evaluate(() => window.qaRefreshes)).toBe(1);
      await waitForStatusReads(statusReads);
      await expect(sales).toHaveText("7");
      for (const event of ["focus", "online", "focus"]) {
        const previousReads = statusReads;
        await page.evaluate((type) => window.dispatchEvent(new Event(type)), event);
        await expect.poll(() => statusReads).toBeGreaterThan(previousReads);
        await waitForStatusReads(statusReads);
      }
      await expect.poll(() => page.evaluate(() => window.qaRefreshes)).toBe(1);
      const beforePublishedProps = statusReads;
      await page.evaluate(() => {
        window.qaDeferRefresh = false;
        window.qaApplyPublished();
      });
      await expect(sales).toHaveText("321");
      await expect.poll(() => statusReads).toBeGreaterThan(beforePublishedProps);
      await waitForStatusReads(statusReads);
      const beforeUnchangedPoll = statusReads;
      await page.clock.runFor(30_100);
      await expect.poll(() => statusReads).toBeGreaterThan(beforeUnchangedPoll);
      await waitForStatusReads(statusReads);
      await expect.poll(() => page.evaluate(() => window.qaRefreshes)).toBe(1);
      assert.equal(await page.evaluate(() => window.qaCurrentProps.selectedPeriod), "week");
      // A corrected publication must refresh even if its source generation date is reused.
      currentVersion = { ...currentVersion, updatedAt: "2026-10-14T15:04:00.000Z" };
      await page.evaluate(() => {
        window.qaNextDashboard.updatedAt = "2026-10-14T15:04:00.000Z";
        window.qaNextDashboard.metrics.all.sales.currentWeek = 322;
        window.dispatchEvent(new Event("focus"));
      });
      await expect(sales).toHaveText("322");
      await expect.poll(() => page.evaluate(() => window.qaRefreshes)).toBe(2);
      await page.clock.resume();
      return { statusReads, routerRefreshes: 2, finalWeeklySales: 322, period: "week" };
    });
    await check("browser/errors-and-network", () => {
      assert.deepEqual(report.pageErrors, [], "pageerror");
      assert.deepEqual(report.consoleErrors, [], "console.error");
      assert.deepEqual(report.blockedRequests, [], "External requests attempted");
      assert.deepEqual(server.requests, [], "Unknown local requests attempted");
    });
    await check("sources/unchanged", async () => {
      assert.deepEqual(
        await sourceHashes(),
        report.sources,
        "Product changed during QA; rerun against current files",
      );
    });
    report.status = report.checks.some(({ status }) => status === "failed") ? "failed" : "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error.stack;
    if (page)
      await page
        .screenshot({ path: path.join(directory, "failure.png"), fullPage: false })
        .catch(() => {});
  } finally {
    await browser?.close();
    await server.close();
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(
      JSON.stringify(
        {
          status: report.status,
          checks: report.checks.length,
          failures: report.checks.filter(({ status }) => status === "failed"),
          error: report.error,
          report: path.join(directory, "report.json"),
        },
        null,
        2,
      ) + "\n",
    );
    if (report.status !== "passed") process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await run();
