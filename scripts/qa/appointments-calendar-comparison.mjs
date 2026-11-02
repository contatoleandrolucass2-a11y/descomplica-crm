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
const output = path.join(root, "test-results/appointments-calendar-comparison");
const directory = "app/(protected)/app/etapas/_components";
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const entry = path.join(root, "scripts/qa/appointments-calendar-memory.tsx").replaceAll("\\", "/");
const sourcePaths = [
  ...[
    "AppointmentsDashboard.tsx",
    "AppointmentsColumns.tsx",
    "AppointmentsComparison.tsx",
    "AppointmentsComparison.module.css",
    "AppointmentsDashboard.module.css",
    "appointments-comparison.ts",
    "appointments-canvas-config.ts",
  ].map((file) => `${directory}/${file}`),
  "lib/crm/stages/appointments.ts",
  "lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas.tsx",
  "lib/dashboard-canvas/ui/configurable/bar-height-controls.tsx",
];
async function sourceHashes() {
  return Promise.all(
    sourcePaths.map(async (file) => ({
      file,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex"),
    })),
  );
}
const beforeSources = await sourceHashes();

function fixture(leap = false) {
  const days = leap
    ? [
        ["2024-02-29", 7],
        ["2024-03-29", 5],
        ["2024-03-31", 9],
      ]
    : [
        ["2026-01-01", 9],
        ...Array.from({ length: 31 }, (_, index) => [
          `2026-07-${String(index + 1).padStart(2, "0")}`,
          1 + (index % 5),
        ]),
        ...Array.from({ length: 30 }, (_, index) => [
          `2026-09-${String(index + 1).padStart(2, "0")}`,
          2 + (index % 3),
        ]),
        ...Array.from({ length: 31 }, (_, index) => [
          `2026-10-${String(index + 1).padStart(2, "0")}`,
          1 + (index % 4),
        ]),
      ];
  const owners = ["Corretor sintético Alfa", "Corretor sintético Beta"];
  const managers = ["Gerente sintético Alfa", "Gerente sintético Beta"];
  return {
    version: 4,
    brokerCount: 2,
    brokerManagerCount: 2,
    viewKey: "all",
    coverageStart: leap ? "2024-02-01" : "2026-01-01",
    referenceDate: leap ? "2024-03-31" : "2026-10-31",
    dimensions: {
      managers,
      owners,
      companies: ["Empresa sintética"],
      developments: [],
      stores: [],
    },
    facts: days.map(([date, total], index) => [
      1,
      date,
      index % 2,
      index % 2,
      0,
      1,
      -1,
      total,
      0,
      0,
      -1,
    ]),
    appointments: days.flatMap(([date, total], index) =>
      Array.from({ length: total }, (_, record) => ({
        createdAt: `${date}T12:${String(record).padStart(2, "0")}:00Z`,
        scheduledAt: null,
        attendedAt: null,
        visitPerformed: false,
        regionalManager: "Regional sintético",
        salesManager: managers[index % 2],
        owner: owners[index % 2],
        accountName: "Conta sintética",
        accountRanking: "Ouro",
        channel: 1,
        company: "Empresa sintética",
        registeredBroker: true,
      })),
    ),
  };
}

const fixtures = { calendar: fixture(), leap: fixture(true) };
const source = `
import {createRoot} from 'react-dom/client';
import {AppointmentsDashboard} from '@/${directory}/AppointmentsDashboard';
import '@/app/globals.css';
const leap=new URLSearchParams(location.search).has('leap');
const analysis=${JSON.stringify(fixtures)}[leap?'leap':'calendar'];
const roster=analysis.dimensions.owners.map((owner,index)=>({key:'broker-'+index,owner,manager:analysis.dimensions.managers[index]}));
createRoot(document.getElementById('root')).render(<main style={{padding:8,maxWidth:1440,margin:'auto'}}>
<AppointmentsDashboard analysis={analysis} brokerRoster={roster} individualGoal={24}
  goalsByMonth={{'2026-10':24,'2026-11':24,'2024-03':24}}
  calendarDate={leap?'2024-03-31':'2026-11-01'} generatedAt={analysis.referenceDate+'T15:00:00Z'}
  canEditDashboard canViewDevelopmentRankings />
</main>);`;

const built = await build({
  root,
  configFile: false,
  envFile: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
  resolve: { alias: { "@": root } },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [
    {
      name: "appointments-calendar-comparison-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("appointments-calendar-memory.tsx")) return entry;
      },
      load(id) {
        if (id === entry) return source;
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    cssMinify: false,
    lib: { entry, name: "AppointmentsCalendarQa", formats: ["iife"] },
  },
});
const files = new Map(
  (Array.isArray(built) ? built : [built])
    .flatMap((result) => result.output)
    .map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
);
const script = [...files.keys()].find((name) => /\.m?js$/u.test(name));
const css = [...files.keys()].filter((name) => name.endsWith(".css"));
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendário e comparativo sintéticos</title>${css.map((name) => `<link rel="stylesheet" href="${name}">`).join("")}</head><body><div id="root"></div><script src="${script}"></script></body></html>`;
const profiles = [];
const writes = [];
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (
    pathname.startsWith("/api/dashboard-profiles") &&
    ["POST", "PATCH"].includes(request.method)
  ) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const previous = profiles.find((profile) => pathname.endsWith(`/${profile.id}`));
    if (request.method === "PATCH" && (!previous || payload.version !== previous.version)) {
      return response
        .writeHead(previous ? 409 : 404, { "content-type": "application/json" })
        .end(JSON.stringify({ error: "synthetic_version_conflict" }));
    }
    const profile = {
      ...previous,
      ...payload,
      id: previous?.id ?? "synthetic-calendar-profile",
      userId: "synthetic-user",
      version: (previous?.version ?? 0) + 1,
      createdAt: previous?.createdAt ?? "2026-11-01T12:00:00Z",
      updatedAt: "2026-11-01T12:00:00Z",
    };
    profiles.splice(0, profiles.length, profile);
    writes.push({ method: request.method, version: profile.version });
    return response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ profile }));
  }
  if (request.method !== "GET") return response.writeHead(405).end();
  if (pathname === "/api/dashboard-profiles")
    return response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ profiles }));
  if (pathname === "/favicon.ico") return response.writeHead(204).end();
  if (pathname === "/")
    return response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  if (files.has(pathname))
    return response
      .writeHead(200, {
        "content-type": pathname.endsWith(".css") ? "text/css" : "text/javascript",
      })
      .end(files.get(pathname));
  response.writeHead(404).end();
});

await mkdir(output, { recursive: true });
const evidence = {
  capturedAt: new Date().toISOString(),
  sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  environment:
    "Local Chromium, real React components and Vite CSS, synthetic profile endpoint only. No authentication/database/Salesforce writes; not Next production CSS or physical handset.",
  node: process.version,
  sources: beforeSources,
  checks: [],
  screens: [],
  browserErrors: [],
  externalRequests: [],
  failures: [],
};
const record = (name, details = {}) => evidence.checks.push({ name, ...details });
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  evidence.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : (evidence.externalRequests.push(route.request().url()), route.abort("blockedbyclient")),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => evidence.browserErrors.push(error.message));
  await page.clock.install({ time: new Date("2026-11-01T12:00:00Z") });
  const daily = () => page.locator('[data-dashboard-card-id="appointments-daily"]');
  const saved = () =>
    expect(page.locator("[data-dashboard-save-status]")).toContainText("Salvo automaticamente");
  const chooseMonth = async (name) => {
    await page
      .getByRole("button", { name: /de 2026/u })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Selecione o período" });
    await dialog.getByLabel("Mês do calendário", { exact: true }).selectOption({ label: name });
    await dialog.getByRole("button", { name: "Selecionar mês inteiro", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  await page.goto(origin);
  await saved();
  await expect(page.getByRole("button", { name: "Novembro de 2026", exact: true })).toBeVisible();
  await expect(daily()).toContainText("Período sem cobertura disponível.");
  await page.getByRole("button", { name: "Novembro de 2026", exact: true }).click();
  const currentDay = page
    .getByRole("dialog", { name: "Selecione o período" })
    .locator('[aria-current="date"]');
  await expect(currentDay).toHaveCount(1);
  await expect(currentDay).toHaveAttribute("aria-label", "1 de novembro de 2026");
  await expect(currentDay).toBeDisabled();
  await page.getByRole("button", { name: "Fechar calendário", exact: true }).click();
  record("current-calendar-month-despite-stale-october-snapshot", {
    ariaCurrent: "2026-11-01",
    disabledBecauseOutsideDataCoverage: true,
  });
  await expect(page.locator('[data-dashboard-card-id="appointments-today"]')).toContainText(
    "Indisponível",
  );
  await expect(
    page.locator('[data-dashboard-card-id="appointments-yesterday"] strong').first(),
  ).toHaveText("3");
  record("today-outside-snapshot-is-unavailable-while-yesterday-uses-covered-october31");
  await chooseMonth("Outubro");
  await expect(page.getByRole("button", { name: "Outubro de 2026", exact: true })).toBeVisible();
  await expect(daily().locator("[data-appointments-bar]")).toHaveCount(31);
  record("manual-month-selection-restores-covered-october-data");

  const measureColumns = async () =>
    daily().evaluate((element) => {
      const tracks = [...element.querySelectorAll("[data-appointments-track]")];
      const bars = [...element.querySelectorAll("[data-appointments-bar]")];
      const reference = element.querySelector("[data-appointments-references]");
      const track = tracks[0]?.getBoundingClientRect();
      const layer = reference?.getBoundingClientRect();
      return {
        firstDay: element
          .querySelector("[data-appointments-day]")
          ?.getAttribute("data-appointments-day"),
        tracks: tracks.length,
        trackHeight: track?.height ?? 0,
        referenceWidth: layer?.width ?? 0,
        referenceHeight: layer?.height ?? 0,
        maxBar: Math.max(0, ...bars.map((bar) => bar.getBoundingClientRect().height)),
        renderedMax: Number(
          element
            .querySelector("[data-appointments-plot]")
            ?.getAttribute("data-appointments-rendered-max") ?? 0,
        ),
      };
    });
  const octoberBeforeTransition = await measureColumns();
  await chooseMonth("Julho");
  await expect(daily().locator("[data-appointments-day]").first()).toHaveAttribute(
    "data-appointments-day",
    "2026-07-01",
  );
  const monthTransitionFrames = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await daily().scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    monthTransitionFrames.push({ viewport, ...(await measureColumns()) });
  }
  evidence.sameLengthMonthTransition = {
    octoberBeforeTransition,
    julyAfterTransition: monthTransitionFrames,
  };
  const badMonthFrames = monthTransitionFrames.filter(
    (frame) =>
      frame.tracks !== 31 ||
      frame.trackHeight <= 0 ||
      frame.referenceWidth <= 0 ||
      frame.maxBar <= 0 ||
      Math.abs(frame.trackHeight - frame.referenceHeight) > 1 ||
      Math.abs(frame.maxBar - frame.renderedMax) > 1,
  );
  assert.deepEqual(
    badMonthFrames,
    [],
    "31-day month change followed by resize must keep real track nodes and aligned positive bars/references.",
  );
  record("same-length-31day-month-transition-keeps-measured-tracks-and-references-on-resize");
  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseMonth("Outubro");

  await daily().getByLabel("Tipo do gráfico diário", { exact: true }).selectOption("line");
  await saved();
  await expect(daily().locator("[data-comparison-series]")).toHaveCount(3);
  await expect
    .poll(() => profiles[0].cards.find((card) => card.id === "appointments-daily").type)
    .toBe("line");
  record("single-type-selection-saved-as-existing-profile-type");
  await page.reload();
  await saved();
  await expect(daily().getByLabel("Tipo do gráfico diário", { exact: true })).toHaveValue("line");
  await expect
    .poll(async () =>
      (await daily().locator('[data-comparison-series="selected"]').getAttribute("d")).trim(),
    )
    .toBe("");
  assert.equal(
    await daily()
      .locator('[data-comparison-series="selected"]')
      .evaluate((element) => element.parentElement.querySelectorAll("circle").length),
    0,
  );
  await expect(daily().locator('[data-comparison-series="previous"]')).not.toHaveAttribute("d", "");
  record("type-survives-reload-current-month-remains-null-while-previous-month-has-data");
  await chooseMonth("Outubro");

  // Seed a custom saved layout on the synthetic server, never in a real account.
  const seeded = structuredClone(profiles[0].cards).map((card, index) => ({
    ...card,
    layout: {
      ...card.layout,
      width:
        card.metric === "appointments.funnel-comparison" || card.id === "appointments-daily"
          ? 1100
          : 320 + index,
      height: 280 + index,
    },
    presentation: {
      textAlign: "center",
      verticalAlign: "center",
      ...card.presentation,
      barScale: 1.2,
      barMaxHeight: 88,
    },
  }));
  [seeded[4], seeded[5]] = [seeded[5], seeded[4]];
  seeded.forEach((card, index) => {
    card.layout.order = index;
  });
  profiles[0] = {
    ...profiles[0],
    cards: structuredClone(seeded),
    version: profiles[0].version + 1,
  };
  await page.reload();
  await saved();
  await expect.poll(() => daily().evaluate((element) => element.style.height)).toBe("293px");
  await daily()
    .getByRole("button", { name: "Mais ferramentas do painel", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Gráficos: 500 px e escala automática", exact: true })
    .click();
  await saved();
  await expect
    .poll(() => profiles[0].cards.find((card) => card.id === "appointments-daily").layout.height)
    .toBe(500);
  const applied = structuredClone(profiles[0].cards);
  const firstChart = seeded.findIndex((card) => card.id === "appointments-daily");
  for (const before of seeded) {
    const after = applied.find((card) => card.id === before.id);
    assert.equal(after.layout.width, before.layout.width);
    assert.equal(after.layout.order, before.layout.order);
    if (
      before.layout.order >= firstChart &&
      before.metric !== "appointments.details" &&
      before.metric !== "appointments.overdue"
    ) {
      assert.equal(after.layout.height, 500);
      assert.equal(after.presentation.barMaxHeight, undefined);
      assert.equal(after.presentation.barScale, undefined);
    } else assert.deepEqual(after, before);
  }
  record("500px-preset-preserves-width-order-kpis-funnel-both-tables-and-removes-only-chart-caps");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await saved();
  await expect.poll(() => profiles[0].cards).toEqual(seeded);
  record("undo-restores-full-layout-and-previous-chart-caps");
  await page
    .getByRole("button", { name: "Gráficos: 500 px e escala automática", exact: true })
    .click();
  await saved();
  await expect
    .poll(() => profiles[0].cards.find((card) => card.id === "appointments-daily").layout.height)
    .toBe(500);
  await page.getByRole("button", { name: "Fechar ferramentas do painel", exact: true }).click();
  await chooseMonth("Outubro");
  for (const theme of ["light", "balanced", "dark"])
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await daily().scrollIntoViewIfNeeded();
      await expect(daily().locator("[data-comparison-series]")).toHaveCount(3);
      const axes = await daily().evaluate((element) => {
        const svg = element.querySelector("[data-appointments-comparison] svg");
        const plot = svg.getBoundingClientRect();
        const ticks = [...element.querySelectorAll("[data-comparison-day]")].map((tick) => {
          const day = Number(tick.dataset.comparisonDay);
          const box = tick.getBoundingClientRect();
          const expected = plot.left + ((8 + ((day - 1) / 30) * 704) / 720) * plot.width;
          const actual = box.left + box.width / 2;
          return { day, expected, actual, delta: Math.abs(actual - expected) };
        });
        const labels = [...svg.parentElement.querySelectorAll(":scope > span")].map(
          (label, index) => {
            const value = index === 0 ? Number(label.textContent.replace(",", ".")) : 0;
            const maximum = Number(
              svg.parentElement.querySelector(":scope > span").textContent.replace(",", "."),
            );
            const expected =
              plot.top +
              ((292 - (value / (Math.max(1, maximum) * 1.08)) * 284) / 300) * plot.height;
            const box = label.getBoundingClientRect();
            const actual = box.top + box.height / 2;
            return { value, expected, actual, delta: Math.abs(actual - expected) };
          },
        );
        return { ticks, labels };
      });
      assert.deepEqual(
        axes.ticks.map(({ day }) => day),
        Array.from({ length: 31 }, (_, index) => index + 1),
      );
      assert.ok(
        axes.ticks.every(({ delta }) => delta <= 1),
        `X-axis label mismatch: ${JSON.stringify(axes)}`,
      );
      assert.equal(axes.labels.length, 2);
      assert.ok(
        axes.labels.every(({ delta }) => delta <= 1),
        `Y-axis label mismatch: ${JSON.stringify(axes)}`,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      const axe = await new AxeBuilder({ page })
        .include('[data-dashboard-card-id="appointments-daily"]')
        .analyze();
      const serious = axe.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact),
      );
      assert.deepEqual(
        serious.map((item) => item.id),
        [],
      );
      const screenshot = path.join(output, `comparison-${theme}-${viewport.width}.png`);
      await page.screenshot({ path: screenshot });
      evidence.screens.push({
        theme,
        viewport,
        screenshot,
        seriousAxeViolations: serious.length,
        axes,
      });
    }
  record("three-themes-desktop-mobile-line-layout-without-page-overflow-or-serious-axe");
  record("x-day-labels-and-y-value-labels-match-svg-coordinates-within-one-pixel");
  await context.close();

  profiles.length = 0;
  const leapContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await leapContext.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : (evidence.externalRequests.push(route.request().url()), route.abort("blockedbyclient")),
  );
  const leapPage = await leapContext.newPage();
  leapPage.on("pageerror", (error) => evidence.browserErrors.push(error.message));
  await leapPage.clock.install({ time: new Date("2024-03-31T12:00:00Z") });
  await leapPage.goto(`${origin}?leap`);
  await expect(leapPage.locator("[data-dashboard-save-status]")).toContainText(
    "Salvo automaticamente",
  );
  const leapDaily = leapPage.locator('[data-dashboard-card-id="appointments-daily"]');
  await leapDaily.getByLabel("Tipo do gráfico diário", { exact: true }).selectOption("line");
  await expect(leapDaily.locator("[data-comparison-series]")).toHaveCount(3);
  await leapDaily.getByText("Ver valores e cobertura", { exact: true }).click();
  const rows = leapDaily.locator("tbody tr");
  await expect(rows.nth(28).locator("td").nth(1)).toHaveText("7");
  await expect(rows.nth(28).locator("td").nth(2)).toHaveText("6");
  await expect(rows.nth(29).locator("td").nth(1)).toHaveText("Sem cobertura");
  await expect(rows.nth(30).locator("td").nth(1)).toHaveText("Sem cobertura");
  await expect(rows.nth(30).locator("td").nth(2)).toHaveText("9");
  assert.equal(
    await leapDaily
      .locator('[data-comparison-series="previous"]')
      .evaluate((element) => element.parentElement.querySelectorAll("circle").length),
    29,
  );
  record("leap-day-29-is-real-day30-31-unknown-and-excluded-from-average-denominator");
  await leapContext.close();
  assert.deepEqual(evidence.browserErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(
    await sourceHashes(),
    beforeSources,
    "Source files changed while QA was running; rerun the immutable candidate.",
  );
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.failures.push(error.stack ?? String(error));
  throw error;
} finally {
  await writeFile(path.join(output, "result.json"), JSON.stringify(evidence, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  console.log(
    JSON.stringify({
      passed: evidence.passed,
      checks: evidence.checks.length,
      screens: evidence.screens.length,
      failures: evidence.failures,
      output,
    }),
  );
}
