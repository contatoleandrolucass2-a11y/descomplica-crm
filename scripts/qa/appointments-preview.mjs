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
  version: 2,
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
  for (const match of compiled.matchAll(/\.([\w-]*AppointmentsDashboard[\w-]*__([\w-]+))\b/g)) {
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
            return `import {createRoot} from 'react-dom/client';import {AppointmentsDashboard} from '@/app/(protected)/app/etapas/_components/AppointmentsDashboard';import '@/app/globals.css';const fixture=${JSON.stringify(fixture)};const query=new URLSearchParams(location.search);if(query.has('large'))fixture.facts.forEach(f=>{if(f[0]===1&&f[1].startsWith('2026-03'))f[7]=1000000;});if(query.has('legacy')){fixture.version=1;delete fixture.dimensions.stores;fixture.facts=fixture.facts.map(f=>f.slice(0,10));}createRoot(document.getElementById('root')).render(<main style={{padding:'16px',maxWidth:'1600px',margin:'auto'}}><AppointmentsDashboard analysis={query.has('empty')?null:fixture} canViewDevelopmentRankings={!query.has('restricted')} generatedAt="2026-03-31T15:00:00Z"/></main>);`;
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
              range.selectNodeContents(item.lastElementChild);
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
          sections: [...document.querySelectorAll("section")].map((element) => ({
            heading: element.querySelector("h2")?.textContent,
            x: element.getBoundingClientRect().x,
            y: element.getBoundingClientRect().y,
            height: element.getBoundingClientRect().height,
            hasVerticalScroll:
              element.querySelector(":scope > div:last-child")?.scrollHeight >
              element.querySelector(":scope > div:last-child")?.clientHeight + 1,
          })),
          labelWritingModes: [
            ...document.querySelectorAll('[class*="columnValue"], [class*="columnLabel"]'),
          ].map((element) => getComputedStyle(element).writingMode),
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
          geometry.sections.every(
            (section) => Math.abs(section.height - geometry.sections[0].height) < 1,
          ),
          `Uniform chart heights ${theme}/${width}`,
        );
        check(
          geometry.labelWritingModes.every((mode) => mode === "horizontal-tb"),
          `Horizontal chart labels ${theme}/${width}`,
        );
        check(
          !geometry.dailyLabelCollisions.length,
          `Daily label collisions ${theme}/${width}: ${geometry.dailyLabelCollisions.join(",")}`,
        );
        check(
          !record.violations.length,
          `Axe violations ${theme}/${width}: ${record.violations.map((item) => item.id).join(",")}`,
        );
        check(geometry.sections.length === 7, `Seven charts ${theme}/${width}`);
        if (width === 1440)
          check(
            geometry.sections[0].y === geometry.sections[1].y &&
              geometry.sections[1].y === geometry.sections[2].y,
            "Three charts side by side at 1440",
          );
        if (width === 1440) {
          check(geometry.sections[0].hasVerticalScroll, "Daily chart uses vertical overflow");
          check(
            geometry.sections[4].hasVerticalScroll,
            "Long responsible ranking uses vertical overflow",
          );
        }
      }
    }
    const daily = region("Agendamentos por dia");
    await expect(daily.getByRole("listitem")).toHaveCount(31);
    const barGeometry = await daily.getByRole("listitem").evaluateAll((items) =>
      items.map((item) => ({
        trackHeight: item.firstElementChild.getBoundingClientRect().height,
        barHeight: item.firstElementChild.firstElementChild.getBoundingClientRect().height,
        barWidth: item.firstElementChild.firstElementChild.getBoundingClientRect().width,
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
        items.map((item) => item.lastElementChild.firstElementChild.getBoundingClientRect().height),
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
        .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label"))),
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
        .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label"))),
      [1, 19, 16, 17, 18, 5].map((count, index) => `${index + 1}ª semana: ${count} agendamentos`),
      "Monday-to-Sunday weeks 1 through 6 and exact totals",
    );
    await expect(region("Ranking por responsável").getByRole("listitem")).toHaveCount(24);
    for (const [title, field] of [
      ["Ranking por gerente", 2],
      ["Ranking por responsável", 3],
      ["Agendamentos por loja", 10],
      ["Ranking por empreendimento", 6],
    ]) {
      const dimension = { 2: "managers", 3: "owners", 10: "stores", 6: "developments" }[field];
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
    await page.getByLabel("Período dos gráficos e rankings").fill("2026-01");
    assert.equal(
      await region("Agendamentos por mês").innerText(),
      annualBefore,
      "Global month must preserve exclusive annual chart",
    );
    await expect(daily.getByRole("listitem")).toHaveCount(1);
    await expect(region("Agendamentos por semana").getByRole("listitem")).toHaveCount(1);
    evidence.filters =
      "2025 exclusive year keeps daily March unchanged; global January keeps annual 2025 unchanged; zero months/weeks absent";
    await page.goto(origin);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Período dos gráficos e rankings")).toBeFocused();
    // Chromium month inputs contain native month/year segments and a calendar button.
    // Traverse those native stops before checking the next application control.
    let tabStops = 0;
    while (
      !(await page
        .getByLabel("Ano", { exact: true })
        .evaluate((element) => element === document.activeElement)) &&
      tabStops < 5
    ) {
      await page.keyboard.press("Tab");
      tabStops++;
    }
    await expect(page.getByLabel("Ano", { exact: true })).toBeFocused();
    evidence.keyboard = `Tab reaches period then exclusive year after ${tabStops} native month-input stops`;
    await page.goto(`${origin}/?empty=1`);
    await expect(
      page.getByText(
        "Dados analíticos indisponíveis. Aguardando uma atualização validada da fonte.",
      ),
    ).toBeVisible();
    await page.goto(`${origin}/?legacy=1`);
    await expect(region("Ranking por empreendimento")).toContainText(
      "Nome do empreendimento indisponível nesta atualização",
    );
    evidence.states =
      "Null slice shows unavailable state; v1 slice refuses fabricated development ranking";
    await page.goto(`${origin}/?restricted=1`);
    check(
      !(await region("Agendamentos por loja").innerText()).includes("Loja sintética"),
      "Restricted store chart must not disclose fixture store names",
    );
    check(
      !(await region("Ranking por empreendimento").innerText()).includes("Residencial sintético"),
      "Restricted development chart must not disclose fixture development names",
    );
    evidence.largeValues = [];
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/?large=1`);
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
