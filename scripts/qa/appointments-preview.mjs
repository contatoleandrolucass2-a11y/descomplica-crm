import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(root, "test-results/appointments-preview");
const componentDirectory = "app/(protected)/app/etapas/_components";
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const owners = Array.from(
  { length: 24 },
  (_, i) =>
    `Responsável sintético ${String(i + 1).padStart(2, "0")} Nome completo longo para validar leitura integral`,
);
const fixture = {
  version: 4,
  brokerCount: 120,
  brokerManagerCount: 5,
  viewKey: "all",
  coverageStart: "2025-10-01",
  referenceDate: "2026-03-31",
  dimensions: {
    managers: [
      "Ana Gerente sintética com sobrenome extenso",
      "Bruno Gerente sintético",
      "Clara Gerente sintética",
      "Davi Gerente sintético",
      "Eva Gerente sintética",
    ],
    owners,
    companies: ["Empresa sintética"],
    developments: [
      "Empreendimento sintético Jardim das Flores e das Árvores de Nome Extenso",
      "Residencial sintético B",
      "Residencial sintético C",
      "Residencial sintético D",
      "Residencial sintético E",
      "Residencial sintético F",
    ],
    stores: [
      "Loja sintética Centro com descrição extensa",
      "Loja sintética Norte",
      "Loja sintética Sul",
      "Loja sintética Leste",
    ],
  },
  facts: [
    ...Array.from({ length: 31 }, (_, i) => [
      1,
      `2026-03-${String(i + 1).padStart(2, "0")}`,
      i % 5,
      i % 24,
      0,
      1,
      i % 6,
      (i % 4) + 1,
      0,
      0,
      i % 4,
    ]),
    [1, "2026-01-12", 0, 0, 0, 1, 0, 7, 0, 0, 0],
    [1, "2025-10-14", 0, 0, 0, 1, 0, 9, 0, 0, 0],
    [1, "2025-12-22", 0, 0, 0, 1, 0, 13, 0, 0, 0],
    [0, "2026-03-01", 0, 0, 0, 1, 0, 99999, 0, 0, -1],
    [2, "2026-03-31", 0, 0, 0, 1, 0, 33, 0, 0, -1],
    [4, "2026-03-31", 0, 0, 0, 1, 0, 5, 0, 0, -1],
  ],
  appointments: [
    ...Array.from({ length: 31 }, (_, day) =>
      Array.from({ length: (day % 4) + 1 }, (_, record) => ({
        createdAt: `2026-03-${String(day + 1).padStart(2, "0")}T12:${String(record).padStart(2, "0")}:00Z`,
        scheduledAt: day === 30 ? `2026-03-31T15:${String(record).padStart(2, "0")}:00Z` : null,
        attendedAt:
          day === 30 && record % 2 === 0
            ? `2026-03-31T16:${String(record).padStart(2, "0")}:00Z`
            : null,
        visitPerformed: day === 30 && record % 2 === 0,
        regionalManager: `Regional sintético ${(day % 3) + 1}`,
        salesManager: [
          "Ana Gerente sintética com sobrenome extenso",
          "Bruno Gerente sintético",
          "Clara Gerente sintética",
          "Davi Gerente sintético",
          "Eva Gerente sintética",
        ][day % 5],
        owner: owners[day % owners.length],
        accountName: `Conta sintética ${String(day + 1).padStart(2, "0")}`,
        accountRanking: ["Ouro", "Prata", "Bronze"][day % 3],
        channel: 1,
        company: "Empresa sintética",
        registeredBroker: true,
      })),
    ).flat(),
    ...[
      ["2026-01-12", 7],
      ["2025-10-14", 9],
      ["2025-12-22", 13],
    ].flatMap(([date, count]) =>
      Array.from({ length: count }, (_, index) => ({
        createdAt: `${date}T12:${String(index).padStart(2, "0")}:00Z`,
        scheduledAt: null,
        attendedAt: null,
        visitPerformed: false,
        regionalManager: "Regional histórico",
        salesManager: "Ana Gerente sintética com sobrenome extenso",
        owner: owners[0],
        accountName: "Conta histórica",
        accountRanking: "Ouro",
        channel: 1,
        company: "Empresa sintética",
        registeredBroker: true,
      })),
    ),
  ],
};

async function productionCss(viteCss) {
  const buildTime = await stat(path.join(root, ".next/BUILD_ID"));
  for (const name of ["AppointmentsDashboard.tsx", "AppointmentsDashboard.module.css"])
    assert.ok(
      (await stat(path.join(root, componentDirectory, name))).mtimeMs <= buildTime.mtimeMs,
      "Next production build is stale; run pnpm build before production CSS QA",
    );
  const nextRequire = createRequire(require.resolve("next/package.json"));
  const postcss = nextRequire("postcss");
  const cssFiles = (await readdir(path.join(root, ".next/static/chunks"))).filter((name) =>
    name.endsWith(".css"),
  );
  const compiled = (
    await Promise.all(
      cssFiles.map((name) => readFile(path.join(root, ".next/static/chunks", name), "utf8")),
    )
  ).join("\n");
  const viteRules = postcss.parse(viteCss);
  const mappings = new Map();
  const moduleAnchor = compiled.match(/\.([\w-]+)_verticalLabels\b/);
  assert.ok(moduleAnchor, "Compiled AppointmentsDashboard CSS module must exist");
  const modulePrefix = moduleAnchor[1];
  const compiledClass = new RegExp(`\\.(${modulePrefix}_([\\w-]+))\\b`, "g");
  for (const match of compiled.matchAll(compiledClass)) {
    const vite = [...viteCss.matchAll(/\.([\w-]+)\b/g)].find((item) =>
      item[1].includes(`_${match[2]}_`),
    );
    assert.ok(vite, `Vite class for ${match[2]} must exist`);
    mappings.set(vite[1], match[1]);
  }
  assert.ok(mappings.size > 10, "Scoped Next AppointmentsDashboard CSS must exist");
  const transformed = postcss.parse(compiled);
  transformed.walkRules((rule) => {
    for (const [vite, next] of mappings)
      rule.selector = rule.selector.replace(new RegExp(`\\.${next}(?![\\w-])`, "g"), `.${vite}`);
  });
  viteRules.walkRules((rule) => {
    if ([...mappings.keys()].some((name) => rule.selector.includes(`.${name}`))) rule.remove();
  });
  return {
    css: `${viteRules}\n${transformed}`,
    evidence: {
      mode: "Next production CSS; Vite component rules removed",
      buildCompletedAt: buildTime.mtime.toISOString(),
      sha256: createHash("sha256").update(compiled).digest("hex"),
      cssFiles,
    },
  };
}

export async function runAppointmentsPreview() {
  await mkdir(outputRoot, { recursive: true });
  const evidence = {
    environment:
      "Windows local loopback; real component and aggregate logic; synthetic fixture only; all external requests blocked; no authentication, database or Salesforce writes",
    node: process.version,
    passed: false,
    screens: [],
    browserErrors: [],
    externalRequests: [],
    failures: [],
  };
  evidence.sources = await Promise.all(
    [
      `${componentDirectory}/AppointmentsDashboard.tsx`,
      `${componentDirectory}/AppointmentsDashboard.module.css`,
      "lib/crm/stages/appointments.ts",
    ].map(async (file) => ({
      file,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, file)))
        .digest("hex"),
    })),
  );
  const entry = path.join(root, "scripts/qa/appointments-memory.tsx").replaceAll("\\", "/");
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
        name: "appointments-synthetic-preview",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith("appointments-memory.tsx")) return entry;
        },
        load(id) {
          if (id === entry)
            return `import {createRoot} from 'react-dom/client';import {AppointmentsDashboard} from '@/app/(protected)/app/etapas/_components/AppointmentsDashboard';import '@/app/globals.css';const fixture=${JSON.stringify(fixture)};const query=new URLSearchParams(location.search);if(query.has('large'))fixture.facts.forEach(f=>{if(f[0]===1&&f[1].startsWith('2026-03'))f[7]=1000000;});if(query.has('legacy')){fixture.version=1;delete fixture.brokerCount;delete fixture.brokerManagerCount;delete fixture.appointments;delete fixture.dimensions.stores;fixture.facts=fixture.facts.filter(f=>f[0]===1).map(f=>f.slice(0,10));}createRoot(document.getElementById('root')).render(<main style={{padding:'16px',maxWidth:'1600px',margin:'auto'}}><AppointmentsDashboard analysis={query.has('empty')?null:fixture} individualGoal={24} canViewDevelopmentRankings={!query.has('restricted')} generatedAt="2026-03-31T15:00:00Z"/></main>);`;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "AppointmentsQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const cssNames = [...files.keys()].filter((name) => name.endsWith(".css"));
  if (process.argv.includes("--production-css")) {
    const converted = await productionCss(
      cssNames.map((name) => String(files.get(name))).join("\n"),
    );
    for (const name of cssNames) files.delete(name);
    files.set("/appointments-production.css", converted.css);
    evidence.css = converted.evidence;
  } else evidence.css = { mode: "Vite development preview; does not validate production CSS" };
  const script = output.find((file) => file.type === "chunk" && file.isEntry).fileName;
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Agendamentos QA sintético</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${[
    ...files.keys(),
  ]
    .filter((name) => name.endsWith(".css"))
    .map((name) => `<link rel="stylesheet" href="${name}">`)
    .join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (request.method !== "GET") return response.writeHead(405).end();
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
  let browser;
  const check = (condition, message) => {
    if (!condition) evidence.failures.push(message);
  };
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    evidence.browser = browser.version();
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.externalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => evidence.browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") evidence.browserErrors.push(message.text());
    });
    const region = (name) => page.getByRole("region", { name, exact: true });
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin);
      await expect(page.getByRole("heading", { name: "Ranking por responsável" })).toBeVisible();
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate(
          (value) => document.documentElement.setAttribute("data-theme", value),
          theme,
        );
        await page.waitForTimeout(200);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          dailyLabelCollisions: (() => {
            const list = document.querySelector(
              'ol[aria-label="Agendamentos por dia do mês selecionado"]',
            );
            const rects = [...list.children].map((item) => {
              const range = document.createRange();
              range.selectNodeContents(item.querySelector('[class*="columnLabel"]'));
              return range.getBoundingClientRect();
            });
            return rects
              .slice(1)
              .flatMap((rect, index) =>
                rect.left < rects[index].right - 0.5 &&
                rect.top < rects[index].bottom &&
                rect.bottom > rects[index].top
                  ? [index + 1]
                  : [],
              );
          })(),
          horizontalScrollbars: [...document.querySelectorAll("main *")]
            .filter((element) => {
              const css = getComputedStyle(element);
              return (
                /auto|scroll/.test(css.overflowX) && element.scrollWidth > element.clientWidth + 1
              );
            })
            .map((element) => ({ tag: element.tagName, class: element.className })),
          sections: [...document.querySelectorAll("[data-appointments-chart]")].map((element) => ({
            heading: element.querySelector("h2")?.textContent,
            x: element.getBoundingClientRect().x,
            y: element.getBoundingClientRect().y,
            height: element.getBoundingClientRect().height,
            hasVerticalScroll:
              element.querySelector(":scope > div:last-child")?.scrollHeight >
              element.querySelector(":scope > div:last-child")?.clientHeight + 1,
          })),
          scoreSingleRow: (() => {
            const section = [...document.querySelectorAll("[data-appointments-chart]")].find(
              (element) => element.querySelector("h2")?.textContent === "Ranking Score",
            );
            const items = [...(section?.querySelectorAll("ol > li") ?? [])];
            const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
            return items.length > 0 && new Set(tops).size === 1;
          })(),
          scoreLabelWritingModes: (() => {
            const section = [...document.querySelectorAll("[data-appointments-chart]")].find(
              (element) => element.querySelector("h2")?.textContent === "Ranking Score",
            );
            return [...(section?.querySelectorAll('[class*="columnLabel"]') ?? [])].map(
              (element) => getComputedStyle(element).writingMode,
            );
          })(),
          kpiCards: [...document.querySelectorAll("article")]
            .filter((card) => card.querySelector("h2"))
            .map((card) => ({
              label: card.querySelector("h2")?.textContent,
              width: card.getBoundingClientRect().width,
              height: card.getBoundingClientRect().height,
            })),
          metricFontSizes: [...document.querySelectorAll('[class*="metricValue"]')].map(
            (element) => Number.parseFloat(getComputedStyle(element).fontSize),
          ),
          cardTitleFontSizes: [...document.querySelectorAll('article h2')].map((element) =>
            Number.parseFloat(getComputedStyle(element).fontSize),
          ),
          kpiCenters: [...document.querySelectorAll('article[class*="kpiCard"]')].map((card) => {
            const value = card.querySelector("strong");
            const cardRect = card.getBoundingClientRect();
            const valueRect = value?.getBoundingClientRect();
            return {
              label: card.querySelector("h2")?.textContent,
              delta: valueRect
                ? Math.abs(
                    valueRect.left + valueRect.width / 2 - (cardRect.left + cardRect.width / 2),
                  )
                : null,
            };
          }),
          conversionCenters: [...document.querySelectorAll('[class*="conversionPercent"]')].map(
            (value) => {
              const card = value.closest("article");
              const cardRect = card.getBoundingClientRect();
              const valueRect = value.getBoundingClientRect();
              return {
                label: card.querySelector("h2")?.textContent,
                delta: Math.abs(
                  valueRect.left + valueRect.width / 2 - (cardRect.left + cardRect.width / 2),
                ),
              };
            },
          ),
          recency: [...document.querySelectorAll('[class*="recencyCard"]')].map((element) => ({
            heading: element.querySelector("h2")?.textContent,
            x: Math.round(element.getBoundingClientRect().x),
            y: Math.round(element.getBoundingClientRect().y),
            bottom: Math.round(element.getBoundingClientRect().bottom),
          })),
          monthly: (() => {
            const section = [...document.querySelectorAll("[data-appointments-chart]")].find(
              (element) => element.querySelector("h2")?.textContent === "Agendamentos por mês",
            );
            const labels = [...(section?.querySelectorAll('[class*="columnLabel"]') ?? [])];
            return {
              y: Math.round(section?.getBoundingClientRect().y ?? 0),
              labels: labels.map((label) => ({
                text: label.textContent,
                clientWidth: label.clientWidth,
                scrollWidth: label.scrollWidth,
                fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
                whiteSpace: getComputedStyle(label).whiteSpace,
              })),
            };
          })(),
        }));
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const screenshot = path.join(outputRoot, `${theme}-${width}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        const record = {
          width,
          theme,
          geometry,
          violations: axe.violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            targets: nodes.map((node) => node.target),
          })),
          screenshot,
        };
        evidence.screens.push(record);
        check(
          geometry.scrollWidth <= width + 1,
          `Horizontal overflow ${theme}/${width}: ${geometry.scrollWidth}`,
        );
        check(
          !geometry.horizontalScrollbars.length,
          `Horizontal internal scrollbar ${theme}/${width}`,
        );
        check(
          geometry.sections
            .slice(0, 5)
            .every((section) => Math.abs(section.height - geometry.sections[0].height) < 1),
          `Five overview charts have equal heights ${theme}/${width}`,
        );
        check(
          geometry.sections
            .slice(5, 8)
            .every((section) => Math.abs(section.height - geometry.sections[5].height) < 1) &&
            geometry.recency.every(
              (section) => Math.abs(section.bottom - section.y - geometry.sections[5].height) < 1,
            ),
          `Six insight panels have equal heights ${theme}/${width}`,
        );
        check(
          geometry.scoreLabelWritingModes.length > 0 &&
            geometry.scoreLabelWritingModes.every((mode) => mode === "vertical-rl"),
          `Ranking Score labels must run vertically bottom-to-top ${theme}/${width}`,
        );
        check(
          !geometry.dailyLabelCollisions.length,
          `Daily label collisions ${theme}/${width}: ${geometry.dailyLabelCollisions.join(",")}`,
        );
        check(
          !record.violations.length,
          `Axe violations ${theme}/${width}: ${record.violations.map((item) => item.id).join(",")}`,
        );
        check(
          geometry.kpiCenters.every((item) => item.delta !== null && item.delta <= 1),
          `KPI values not centered ${theme}/${width}: ${JSON.stringify(geometry.kpiCenters)}`,
        );
        check(
          geometry.conversionCenters.length === 3 &&
            geometry.conversionCenters.every((item) => item.delta <= 1),
          `Conversion percentages not centered ${theme}/${width}: ${JSON.stringify(geometry.conversionCenters)}`,
        );
        check(
          geometry.kpiCards.length === 12 &&
            geometry.kpiCards.every(
              (card) => Math.abs(card.height - geometry.kpiCards[0].height) < 1,
            ),
          `Twelve KPI cards must have equal heights ${theme}/${width}`,
        );
        check(
          geometry.metricFontSizes.length === 12 &&
            geometry.metricFontSizes.every(
              (size) => Math.abs(size - geometry.metricFontSizes[0]) < 0.1,
            ),
          `KPI numbers must share one font size ${theme}/${width}`,
        );
        check(
          geometry.cardTitleFontSizes.length === 12 &&
            geometry.cardTitleFontSizes.every(
              (size) => Math.abs(size - geometry.cardTitleFontSizes[0]) < 0.1,
            ),
          `KPI titles must share one font size ${theme}/${width}`,
        );
        check(geometry.recency.length === 3, `Three recency panels ${theme}/${width}`);
        check(
          geometry.monthly.labels.length > 0 &&
            geometry.monthly.labels.every(
              (label) =>
                label.scrollWidth <= label.clientWidth + 1 &&
                label.fontSize >= 12.48 &&
                label.whiteSpace === "nowrap",
            ),
          `Monthly labels clipped or too small ${theme}/${width}: ${JSON.stringify(geometry.monthly.labels)}`,
        );
        check(geometry.sections.length === 8, `Eight charts ${theme}/${width}`);
        const score = geometry.sections.find((section) => section.heading === "Ranking Score");
        check(score && !score.hasVerticalScroll, `Ranking Score vertical scroll ${theme}/${width}`);
        check(
          geometry.scoreSingleRow,
          `Ranking Score must keep every bar on one row ${theme}/${width}`,
        );
        if (width >= 1201)
          check(
            new Set(geometry.sections.slice(0, 3).map((section) => section.y)).size === 1 &&
              new Set(geometry.sections.slice(3, 5).map((section) => section.y)).size === 1,
            `Five overview charts use a compact 3 plus 2 layout at ${width}`,
          );
        if (width >= 1024)
          check(
            new Set(geometry.sections.slice(5, 8).map((item) => item.y)).size === 1 &&
              new Set(geometry.recency.map((item) => item.y)).size === 1 &&
              geometry.recency[0].y > geometry.sections[5].y,
            `Six insight panels use a 3 by 2 layout at ${width}`,
          );
        if (width <= 390)
          check(
            geometry.recency.every(
              (item, index, items) => index === 0 || item.y > items[index - 1].y,
            ),
            `Recency panels must stack at ${width}`,
          );
        if (width === 1440) {
          check(
            geometry.sections[6].hasVerticalScroll,
            "Long responsible ranking uses vertical overflow",
          );
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin);
    const daily = region("Evolução de agendamentos por dia");
    await expect(
      page.getByRole("region", { name: "Filtros do painel de agendamentos" }),
    ).toBeVisible();
    await expect(page.locator("article h2")).toHaveCount(12);
    await expect(page.getByText("Cobertura da fonte:")).toHaveCount(0);
    await expect(page.getByText(/agendamentos no período$/)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Último agendamento: até 7 dias" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Último agendamento: de 8 a 14 dias" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Último agendamento: 15 dias ou mais" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /24 de 120 corretores/ })).toBeVisible();
    await expect(daily.getByRole("listitem")).toHaveCount(31);
    const barGeometry = await daily.getByRole("listitem").evaluateAll((items) =>
      items.map((item) => ({
        trackHeight: item.firstElementChild.firstElementChild.getBoundingClientRect().height,
        barHeight:
          item.firstElementChild.firstElementChild.firstElementChild.getBoundingClientRect().height,
        barWidth:
          item.firstElementChild.firstElementChild.firstElementChild.getBoundingClientRect().width,
      })),
    );
    barGeometry.forEach((bar, index) => {
      check(bar.barWidth > 0, `Daily bar ${index + 1} must be visible`);
      check(
        Math.abs(bar.barHeight / bar.trackHeight - ((index % 4) + 1) / 4) < 0.02,
        `Daily bar ${index + 1} height must match exact relative count`,
      );
    });
    const rankingBars = await region("Ranking por responsável")
      .getByRole("listitem")
      .evaluateAll((items) =>
        items.map(
          (item) =>
            item.firstElementChild.lastElementChild.firstElementChild.getBoundingClientRect()
              .height,
        ),
      );
    check(
      rankingBars.every((height) => height > 0),
      "All horizontal ranking bars must have visible height",
    );
    evidence.barGeometry = { daily: barGeometry, ownerBarHeights: rankingBars };
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(6);
    assert.deepEqual(
      await daily
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => item.firstElementChild.getAttribute("aria-label")),
        ),
      Array.from(
        { length: 31 },
        (_, index) =>
          `${String(index + 1).padStart(2, "0")}/03/2026: ${(index % 4) + 1} agendamentos`,
      ),
      "All dates and daily totals must be accessible and chronological",
    );
    assert.deepEqual(
      await region("Agendamentos por semana")
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => item.firstElementChild.getAttribute("aria-label")),
        ),
      [1, 19, 16, 17, 18, 5].map((count, index) => `${index + 1}ª semana: ${count} agendamentos`),
      "Monday-to-Sunday weeks 1 through 6 and exact totals",
    );
    await expect(region("Ranking por responsável").getByRole("listitem")).toHaveCount(24);
    for (const [title, field] of [
      ["Ranking por gerente", 2],
      ["Ranking por responsável", 3],
    ]) {
      const dimension = { 2: "managers", 3: "owners" }[field];
      const totals = new Map();
      for (const fact of fixture.facts.filter(
        (fact) => fact[0] === 1 && fact[1].startsWith("2026-03"),
      )) {
        const label = fixture.dimensions[dimension][fact[field]];
        totals.set(label, (totals.get(label) || 0) + fact[7]);
      }
      const expected = [...totals].sort(
        ([a, ac], [b, bc]) => bc - ac || a.localeCompare(b, "pt-BR"),
      );
      const actual = await region(title).getByRole("listitem").allTextContents();
      expected.forEach(([label, total], index) => {
        check(
          actual[index]?.includes(label),
          `${title}: full label and descending order row ${index + 1}`,
        );
        check(actual[index]?.endsWith(String(total)), `${title}: total row ${index + 1}`);
      });
    }
    const dailyBefore = await daily.innerText();
    await page.getByLabel("Ano", { exact: true }).selectOption("2025");
    await expect(region("Agendamentos por mês").getByRole("listitem")).toHaveCount(2);
    await expect(region("Agendamentos por mês")).toContainText("Outubro");
    await expect(region("Agendamentos por mês")).toContainText("Dezembro");
    assert.equal(await daily.innerText(), dailyBefore, "Exclusive year must preserve daily chart");
    const annualBefore = await region("Agendamentos por mês").innerText();
    const filtersRegion = page.getByRole("region", {
      name: "Filtros do painel de agendamentos",
      exact: true,
    });
    const calendarTrigger = filtersRegion.getByRole("button", { name: "Março de 2026" });
    const filterOrder = await filtersRegion.evaluate((element) => {
      const company = element.querySelector('select[aria-label="Empresa"], select[id$="company"]');
      const calendar = [...element.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Março de 2026"),
      );
      const clear = [...element.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Limpar filtros"),
      );
      return {
        companyRight: company?.getBoundingClientRect().right ?? 0,
        calendarLeft: calendar?.getBoundingClientRect().left ?? 0,
        calendarRight: calendar?.getBoundingClientRect().right ?? 0,
        clearLeft: clear?.getBoundingClientRect().left ?? 0,
      };
    });
    check(
      filterOrder.companyRight <= filterOrder.calendarLeft + 1 &&
        filterOrder.calendarRight <= filterOrder.clearLeft + 1,
      `Calendar and clear controls must follow Empresa: ${JSON.stringify(filterOrder)}`,
    );
    await calendarTrigger.click();
    const calendar = page.getByRole("dialog", { name: "Selecione o período" });
    await expect(calendar).toBeVisible();
    await expect(calendar.getByLabel("Mês do calendário")).toHaveValue("3");
    await expect(calendar.getByLabel("Ano do calendário")).toHaveValue("2026");
    await calendar.getByRole("gridcell", { name: "1 de março de 2026", exact: true }).click();
    await calendar.getByRole("gridcell", { name: "2 de março de 2026", exact: true }).click();
    await expect(calendar.getByText("2 dias selecionados", { exact: true })).toBeVisible();
    await expect(page.locator('p[aria-live="polite"]')).toContainText("3 registros encontrados");
    await expect(daily.getByRole("listitem")).toHaveCount(2);
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(2);
    await calendar.getByRole("button", { name: "Fechar calendário" }).click();
    await expect(calendar).toBeHidden();
    await expect(filtersRegion.getByRole("button", { name: "2 dias selecionados" })).toBeFocused();
    await filtersRegion.getByRole("button", { name: "2 dias selecionados" }).click();
    await expect(calendar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
    await expect(filtersRegion.getByRole("button", { name: "2 dias selecionados" })).toBeFocused();
    await filtersRegion.getByRole("button", { name: "2 dias selecionados" }).click();
    await calendar.getByLabel("Ano do calendário").selectOption("2025");
    await expect(calendar.getByLabel("Mês do calendário")).toHaveValue("10");
    await calendar.getByLabel("Mês do calendário").selectOption("12");
    await expect(
      calendar.getByRole("gridcell", { name: "22 de dezembro de 2025", exact: true }),
    ).toBeEnabled();
    await calendar.getByRole("button", { name: "Selecionar mês inteiro" }).click();
    await calendar.getByRole("button", { name: "Fechar calendário" }).click();
    await expect(filtersRegion.getByRole("button", { name: "Dezembro de 2025" })).toBeVisible();
    assert.equal(
      await region("Agendamentos por mês").innerText(),
      annualBefore,
      "Global calendar month must preserve exclusive annual chart",
    );
    await expect(daily.getByRole("listitem")).toHaveCount(1);
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(1);
    evidence.filters =
      "Calendar defaults to the current source month; supports multiple days, close button, Escape, year/month changes and whole-month selection; exclusive annual chart remains independent";
    await filtersRegion.getByRole("button", { name: "Limpar 1 filtro" }).click();
    await expect(filtersRegion.getByRole("button", { name: "Março de 2026" })).toBeVisible();
    await page.goto(origin);
    await page.getByRole("button", { name: "House", exact: true }).click();
    await page
      .getByLabel("Gerente de Vendas")
      .selectOption("Ana Gerente sintética com sobrenome extenso");
    const managerKpi = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Gerentes cadastrados", exact: true }) });
    await expect(managerKpi.locator("strong")).toHaveText("1");
    await page.getByLabel("Responsável da conta").selectOption(owners[0]);
    await page.getByLabel("Empresa").selectOption("Empresa sintética");
    await expect(page.getByRole("button", { name: "Limpar 4 filtros" })).toBeVisible();
    const composedRow = page.locator("tbody tr").first();
    await composedRow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /Limpar 7 filtros/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Limpar 4 filtros" })).toBeVisible();
    await expect(page.getByLabel("Gerente de Vendas")).toHaveValue(
      "Ana Gerente sintética com sobrenome extenso",
    );
    await expect(page.getByRole("button", { name: "House", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    evidence.dimensionFilters =
      "House, manager, responsible and company compose; selecting one manager scopes the manager KPI to 1; selecting and toggling a full row preserves the four global filters";
    await page.getByRole("button", { name: "Limpar 4 filtros" }).click();
    const firstDay = region("Evolução de agendamentos por dia").getByRole("button").first();
    await firstDay.click();
    await expect(firstDay).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Limpar 1 filtro" })).toBeVisible();
    await expect(page.getByText("1 registros no período")).toBeVisible();
    await page.getByRole("button", { name: "Limpar 1 filtro" }).click();
    const firstRow = page.locator("tbody tr").first();
    await firstRow.focus();
    await page.keyboard.press("Enter");
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: /Limpar \d+ filtros/ })).toBeVisible();
    evidence.crossFilters =
      "Daily column click filters every result; clear restores the page; Enter on a full table row applies its dimensions";
    await page.getByRole("button", { name: /Limpar \d+ filtros/ }).click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const firstChartButton = daily.getByRole("button").first();
    const firstChartBar = firstChartButton.locator('div[class*="column"]').last();
    const chartColorBefore = await firstChartBar.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await firstChartButton.hover();
    await page.waitForTimeout(220);
    const chartColorAfter = await firstChartBar.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    check(chartColorBefore !== chartColorAfter, "Chart bar hover must change color");
    const hoverRow = page.locator("tbody tr").first();
    const rowColorBefore = await hoverRow.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await hoverRow.hover();
    const rowColorAfter = await hoverRow.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    check(rowColorBefore !== rowColorAfter, "Table row hover must change color");
    const tiltCard = page.locator("article").first();
    const tiltBounds = await tiltCard.boundingBox();
    assert.ok(tiltBounds, "First KPI card must have measurable bounds");
    await page.mouse.move(tiltBounds.x + 8, tiltBounds.y + 8);
    check(
      (await tiltCard.evaluate((element) =>
        element.style.getPropertyValue("--card-tilt-y"),
      )) !== "0deg",
      "KPI card must tilt toward the pointer",
    );
    const secondTiltBounds = await page.locator("article").nth(1).boundingBox();
    assert.ok(secondTiltBounds, "Second KPI card must have measurable bounds");
    await page.mouse.move(
      secondTiltBounds.x + secondTiltBounds.width / 2,
      secondTiltBounds.y + secondTiltBounds.height / 2,
    );
    await page.waitForTimeout(50);
    const restedTilt = await tiltCard.evaluate((element) =>
      element.style.getPropertyValue("--card-tilt-y"),
    );
    check(
      restedTilt === "" || restedTilt === "0deg",
      `KPI card must return to rest after pointer leave: ${restedTilt}`,
    );
    evidence.hoverAndMotion =
      "Chart bars and table rows change color on hover; KPI cards tilt toward the pointer and return to rest";
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(origin);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "House", exact: true })).toBeFocused();
    evidence.keyboard =
      "Tab reaches the first global filter; calendar dialog restores focus after close/Escape; chart buttons and rows use native keyboard controls";
    await page.goto(`${origin}/?empty=1`);
    await expect(
      page.getByText(
        "Dados analíticos indisponíveis. Aguardando uma atualização validada da fonte.",
      ),
    ).toBeVisible();
    await page.goto(`${origin}/?legacy=1`);
    await expect(region("Ranking por gerente regional")).toContainText(
      "Dados indisponíveis nesta atualização",
    );
    evidence.states =
      "Null slice shows unavailable state; v1 slice refuses fabricated operational rankings";
    await page.goto(`${origin}/?restricted=1`);
    check(
      (await region("Ranking Score").innerText()).includes(
        "Ranking Score indisponível para seu perfil de acesso",
      ),
      "Restricted account ranking must stay unavailable",
    );
    evidence.largeValues = [];
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/?large=1&legacy=1`);
      await expect(daily.getByRole("listitem")).toHaveCount(31);
      const collisions = await daily.evaluate((element) => {
        const list = element.querySelector("ol");
        const rects = [...list.children].map((item) => {
          const range = document.createRange();
          range.selectNodeContents(item.firstElementChild.lastElementChild);
          const rect = range.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        return rects.flatMap((rect, index) =>
          rects
            .slice(index + 1)
            .flatMap((other, offset) =>
              rect.left < other.right - 0.5 &&
              rect.right > other.left + 0.5 &&
              rect.top < other.bottom - 0.5 &&
              rect.bottom > other.top + 0.5
                ? [[index, index + offset + 1]]
                : [],
            ),
        );
      });
      check(
        !collisions.length,
        `Million-value label collisions at ${width}: ${JSON.stringify(collisions)}`,
      );
      evidence.largeValues.push({ width, countPerDay: 1000000, collisions });
      await page.screenshot({
        path: path.join(outputRoot, `million-${width}.png`),
        fullPage: true,
      });
    }
    // A 720 CSS-pixel viewport at 2dppx models the layout space of a 1440px
    // screen at 200% browser zoom; this is layout emulation, not browser UI zoom.
    const zoomContext = await browser.newContext({
      viewport: { width: 720, height: 450 },
      deviceScaleFactor: 2,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
    });
    await zoomContext.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      evidence.externalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto(origin);
    await expect(zoomPage.getByRole("heading", { name: "Ranking por responsável" })).toBeVisible();
    const zoomOverflow = await zoomPage.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    check(
      zoomOverflow.document <= zoomOverflow.viewport + 1,
      "Horizontal overflow at 200% layout emulation",
    );
    const zoomAxe = await new AxeBuilder({ page: zoomPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    check(!zoomAxe.violations.length, "Axe violations at 200% layout emulation");
    evidence.zoom = {
      method: "1440px screen at 200% layout emulation: 720 CSS px at 2dppx; not browser UI zoom",
      overflow: zoomOverflow,
      violations: zoomAxe.violations.map(({ id }) => id),
    };
    await zoomPage.screenshot({
      path: path.join(outputRoot, "layout-200-percent.png"),
      fullPage: true,
    });
    await zoomContext.close();
    check(!evidence.browserErrors.length, "Browser JavaScript errors");
    check(!evidence.externalRequests.length, "External requests attempted");
    evidence.passed = !evidence.failures.length;
  } catch (error) {
    evidence.failures.push(error.stack);
  } finally {
    await writeFile(path.join(outputRoot, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(
    JSON.stringify({
      passed: evidence.passed,
      screens: evidence.screens.length,
      failures: evidence.failures,
      outputRoot,
    }),
  );
  if (!evidence.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runAppointmentsPreview();
