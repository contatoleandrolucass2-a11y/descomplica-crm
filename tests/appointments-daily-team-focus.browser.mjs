import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const out = path.join(root, "test-results/appointments-daily-team-focus");
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const entry = path.join(out, "fixture-memory.tsx").replaceAll("\\", "/");
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
      name: "appointments-daily-team-focus",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("fixture-memory.tsx")) return entry;
      },
      load(id) {
        if (id !== entry) return;
        return `import {createRoot} from 'react-dom/client';
import {DailyAppointmentsTeamDetails} from '@/app/(protected)/app/etapas/_components/DailyAppointmentsTeamDetails';
import {AppointmentsComparison} from '@/app/(protected)/app/etapas/_components/AppointmentsComparison';
import '@/app/globals.css';
const brokerRoster=[{key:'a',owner:'Ana Maria Silva',manager:'João Carlos Souza'},{key:'b',owner:'Bia Costa',manager:'João Carlos Souza'}];
const comparison={month:'2026-10',days:[1,2,3,4],description:'Comparativo sintético',series:['selected','previous','year-average','quarter-average'].map((key,index)=>({key,label:'Série '+index,values:[index+1,index+3,null,index+2]}))};
const analysis={version:4,viewKey:'without_canal_imob',brokerCount:2,brokerManagerCount:1,coverageStart:'2026-10-01',referenceDate:'2026-10-31',dimensions:{managers:['João Carlos Souza'],owners:brokerRoster.map(row=>row.owner),companies:['Empresa sintética'],developments:[],stores:[]},facts:[],appointments:[{createdAt:'2026-10-05T12:00:00Z',scheduledAt:null,attendedAt:null,visitPerformed:false,regionalManager:'Regional Carlos Santos',salesManager:'João Carlos Souza',owner:'Ana Maria Silva',accountName:'',accountRanking:'',channel:1,company:'Empresa sintética',registeredBroker:true}]};
createRoot(document.getElementById('root')).render(<main style={{padding:16,zoom:0.6}}><p>QA sintético: foco de equipe por dia</p><DailyAppointmentsTeamDetails analysis={analysis} brokerRoster={brokerRoster} filters={{channel:1}} month='2026-10' buckets={[{key:'2026-10-05',label:'05',total:1},{key:'2026-10-06',label:'06',total:0}]}><button data-appointments-day='2026-10-05'><span data-appointments-track>Barra 05</span><span data-appointments-value data-appointments-team-day="2026-10-05">1</span><span data-appointments-column-label>05</span></button><button data-appointments-day='2026-10-06'><span data-appointments-track>Barra 06</span><span data-appointments-value data-appointments-team-day="2026-10-06">0</span><span data-appointments-column-label>06</span></button></DailyAppointmentsTeamDetails><button>Próximo card</button><section style={{height:450,marginTop:24}}><AppointmentsComparison getComparison={()=>comparison}/></section></main>);`;
      },
    },
  ],
  build: {
    write: false,
    minify: true,
    lib: { entry, formats: ["iife"], name: "DailyTeamFocusQA" },
  },
});
const files = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
const js = files
  .filter((file) => file.type === "chunk")
  .map((file) => file.code)
  .join("\n");
const css = files
  .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
  .map((file) => String(file.source))
  .join("\n");
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    return res.end(js);
  }
  if (req.url === "/fixture.css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    return res.end(css);
  }
  if (req.url === "/favicon.ico") return res.writeHead(204).end();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const evidence = {
  passed: false,
  synthetic: true,
  productionBuildComponents: true,
  cases: [],
  errors: [],
  externalRequests: [],
};
const suffix = process.env.QA_FOCUS_BASELINE ? "before" : "after";
try {
  for (const touch of [false, true]) {
    const page = await browser.newPage({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      hasTouch: touch,
    });
    page.on("pageerror", (error) => evidence.errors.push(error.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        evidence.externalRequests.push(url.origin);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    await page.goto(origin);
    const trigger = page.getByRole("button", { name: "Ver equipe por dia", exact: true });
    await trigger.focus();
    if (touch) await trigger.tap();
    else await trigger.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Equipe — 05/10/2026", exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Fechar equipe do dia", exact: true });
    evidence.cases.push({
      touch,
      focusAfterOpen: await page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent,
      ),
    });
    await page.screenshot({
      path: path.join(out, `${suffix}-${touch ? "touch" : "keyboard"}.png`),
    });
    await expect(close).toBeFocused();
    await expect(dialog.getByRole("cell", { name: "Ana Maria", exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("cell", { name: "João Carlos", exact: true }).first(),
    ).toBeVisible();
    await expect(dialog.getByRole("cell", { name: "Ana Silva", exact: true })).toHaveCount(0);
    await page.keyboard.press("Tab");
    const select = page.getByRole("combobox", { name: "Dia", exact: true });
    await expect(select).toBeFocused();
    await select.selectOption("2026-10-06");
    await expect(select).toBeFocused();
    await expect(
      page.getByRole("dialog", { name: "Equipe — 06/10/2026", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.mouse.move(0, 0);
    await page.getByRole("button", { name: "Próximo card", exact: true }).focus();
    const day = page.locator('[data-appointments-day="2026-10-05"]');
    await day.locator("[data-appointments-track]").hover();
    await expect(dialog).toHaveCount(0);
    await day.locator("[data-appointments-value]").hover();
    await expect(dialog).toBeVisible();
    const before = await dialog.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(Math.abs(before.x + before.width / 2 - viewport.width / 2) <= 1);
    assert.ok(Math.abs(before.y + before.height / 2 - viewport.height / 2) <= 1);
    await dialog.getByRole("heading").hover();
    await expect(dialog).toBeVisible();
    const after = await dialog.boundingBox();
    assert.deepEqual(after, before);
    await page.mouse.move(0, 0);
    await expect(dialog).toHaveCount(0);
    evidence.cases.push({
      touch,
      numericOnlyTrigger: true,
      centeredWithAncestorZoom: true,
      positionStableInsidePopup: true,
      automaticCloseOnPointerExit: true,
    });
    await expect(page.getByRole("button", { name: "Próximo card", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await day.locator("[data-appointments-value]").hover();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("heading").hover();
    await dialog.getByRole("button", { name: "Fechar equipe do dia", exact: true }).focus();
    await page.mouse.move(0, 0);
    await expect(dialog).toHaveCount(0);
    await expect(day).toBeFocused();
    await day.locator("[data-appointments-value]").hover();
    await expect(dialog).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(dialog).toHaveCount(0);
    evidence.cases.push({ touch, hoverPopupFocusRestoredWithoutReopening: true });
    const chart = page.locator("[data-appointments-comparison]");
    const layoutSelect = page.getByRole("combobox", { name: "Layout do gráfico de linhas" });
    await expect(layoutSelect.locator("option")).toHaveCount(5);
    for (const layout of ["straight", "smooth", "steps", "points", "area"]) {
      await layoutSelect.selectOption(layout);
      await expect(chart).toHaveAttribute("data-line-layout", layout);
      await expect(chart.locator("[data-comparison-series]")).toHaveCount(4);
      const painted = await chart
        .locator("[data-comparison-series]")
        .evaluateAll((paths) =>
          paths.every(
            (path) =>
              path.getAttribute("d")?.startsWith("M") && path.getBoundingClientRect().height > 0,
          ),
        );
      assert.equal(painted, true);
    }
    evidence.cases.push({ touch, fiveLineLayouts: true, fourSeriesVisibleWithoutHover: true });
    await page.close();
  }
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.passed = true;
} finally {
  await writeFile(path.join(out, `result-${suffix}.json`), JSON.stringify(evidence, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(JSON.stringify(evidence));
