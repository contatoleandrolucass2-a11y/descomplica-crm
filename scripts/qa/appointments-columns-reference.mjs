import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, "test-results/appointments-columns-reference");
const require = createRequire(import.meta.url);
const vite = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const dir = "app/(protected)/app/etapas/_components";
const entry = path.join(root, "scripts/qa/appointments-reference-memory.tsx").replaceAll("\\", "/");
const source = `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {AppointmentsColumns} from '@/${dir}/AppointmentsColumns';import {DashboardBarHeightControlContext} from '@/lib/dashboard-canvas/ui/configurable/bar-height-controls';import styles from '@/${dir}/AppointmentsDashboard.module.css';import '@/app/globals.css';function App(){const [month,setMonth]=useState('2026-10');const [mode,setMode]=useState('normal');const [cap,setCap]=useState(localStorage.getItem('cap')?Number(localStorage.getItem('cap')):undefined);const count=month==='2026-10'?31:30;const buckets=mode==='empty'?[]:Array.from({length:count},(_,i)=>({key:month+'-'+String(i+1).padStart(2,'0'),label:String(i+1).padStart(2,'0'),total:mode==='zero'?0:mode==='updated'&&i===14?99:i===28?22:i%7,goal:i%2?40:0}));return <main style={{padding:16}} className={styles.configurableCanvas}><nav style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}><button onClick={()=>setMonth('2026-11')}>Novembro</button><button onClick={()=>setMode('zero')}>Zeros</button><button onClick={()=>setMode('normal')}>Normal</button><button onClick={()=>setMode('updated')}>Atualizar totais</button><button onClick={()=>setMode('missing')}>Sem coorte</button><button onClick={()=>setMode('empty')}>Vazio</button></nav><article data-test-card style={{boxSizing:'border-box',padding:12,border:'1px solid var(--analytics-line)',height:500,background:'var(--analytics-surface)'}}><div className={styles.cardBody}><DashboardBarHeightControlContext.Provider value={{value:cap,editable:true,onCommit:value=>{value===undefined?localStorage.removeItem('cap'):localStorage.setItem('cap',String(value));setCap(value)}}}><AppointmentsColumns buckets={buckets} label="Agendamentos por dia" daily reference={{value:mode==='missing'?null:20,label:'Corretores'}}/></DashboardBarHeightControlContext.Provider></div></article></main>}createRoot(document.getElementById('root')).render(<App/>);`;
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
      name: "appointments-reference-memory",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("appointments-reference-memory.tsx")) return entry;
      },
      load(id) {
        if (id === entry) return source;
      },
    },
  ],
  build: { write: false, minify: false, lib: { entry, name: "ReferenceQa", formats: ["iife"] } },
});
const files = new Map(
  (Array.isArray(built) ? built : [built])
    .flatMap((result) => result.output)
    .map((file) => ["/" + file.fileName, file.type === "chunk" ? file.code : file.source]),
);
const js = [...files.keys()].find((name) => /\.m?js$/u.test(name));
const css = [...files.keys()].filter((name) => name.endsWith(".css"));
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css.map((name) => `<link rel="stylesheet" href="${name}">`).join("")}</head><body><div id="root"></div><script src="${js}"></script></body></html>`,
    );
  } else if (files.has(req.url)) {
    res.setHeader("Content-Type", req.url.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(files.get(req.url));
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(out, { recursive: true });
const evidence = {
  capturedAt: new Date().toISOString(),
  environment:
    "Windows/Chromium; real Columns/CSS/control context, synthetic data, no auth/remote writes",
  sources: await Promise.all(
    [
      "AppointmentsColumns.tsx",
      "AppointmentsColumnsOverrides.module.css",
      "AppointmentsDashboard.module.css",
    ].map(async (file) => ({
      file,
      sha256: createHash("sha256")
        .update(await readFile(path.join(root, dir, file)))
        .digest("hex"),
    })),
  ),
  cases: [],
  browserErrors: [],
  externalRequests: [],
  failures: [],
};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : (evidence.externalRequests.push(route.request().url()), route.abort()),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => evidence.browserErrors.push(error.message));
  await page.goto(origin);
  const facts = () =>
    page.evaluate(() => {
      const host = document.querySelector("[data-appointments-plot]");
      const track = document.querySelector("[data-appointments-track]");
      const bars = [...document.querySelectorAll("[data-appointments-bar]")];
      const refs = document.querySelectorAll("[data-dashboard-goal-line]");
      return {
        track: track?.getBoundingClientRect().height,
        max: Math.max(...bars.map((bar) => bar.getBoundingClientRect().height)),
        declaredMax: Number(host?.dataset.appointmentsRenderedMax),
        refs: refs.length,
        paths: document.querySelectorAll("[data-appointments-goal-line]").length,
        solid: document.querySelectorAll("[data-dashboard-bar-top-line]").length,
        height: document.querySelector("[data-test-card]").getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > innerWidth,
        weekends: [...document.querySelectorAll("[data-appointments-weekend]")].map((node) => ({
          day: node.textContent,
          width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height,
          columnWidth: node.closest("li").getBoundingClientRect().width,
        })),
      };
    });
  for (const theme of ["light", "balanced", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    for (const width of [1440, 844, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(
        () =>
          Number(
            document.querySelector("[data-appointments-plot]")?.dataset.appointmentsRenderedMax,
          ) > 0,
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const current = await facts();
      evidence.cases.push({ theme, width, ...current });
      assert.equal(current.refs, 1);
      assert.equal(current.paths, 1);
      assert.equal(current.solid, 0);
      assert.equal(current.overflow, false);
      assert.equal(current.height, 500);
      assert.ok(Math.abs(current.max - current.declaredMax) < 1);
      assert.ok(current.track - current.max >= 19 && current.track - current.max <= 40);
      assert.equal(current.weekends.length, 9);
      assert.ok(
        current.weekends.every(
          (day) => Math.abs(day.width - day.height) < 1 && day.width <= day.columnWidth + 1,
        ),
      );
      assert.ok(current.weekends.every((day) => day.width >= 14));
      await page.screenshot({ path: path.join(out, `${theme}-${width}.png`) });
    }
  }
  await page.locator('[data-appointments-day="2026-10-31"]').focus();
  assert.ok(
    await page.locator("[data-appointments-scroll-viewport]").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const last = element
        .querySelector('[data-appointments-day="2026-10-31"]')
        .getBoundingClientRect();
      return (
        element.scrollLeft > 0 && last.left >= bounds.left - 1 && last.right <= bounds.right + 1
      );
    }),
  );
  await page.screenshot({ path: path.join(out, "dark-320-end-of-month.png") });
  await page.getByRole("button", { name: "Novembro", exact: true }).click();
  assert.equal(
    await page.locator('[data-appointments-weekend="domingo"]').first().textContent(),
    "01",
  );
  assert.equal(await page.locator("[data-appointments-column-label]").count(), 30);
  await page.getByRole("button", { name: "Atualizar totais", exact: true }).click();
  assert.match(await page.locator("[data-appointments-plot]").textContent(), /Máximo 99/u);
  await page.getByLabel("Altura máxima das torres (px)", { exact: true }).fill("80");
  await page.getByLabel("Altura máxima das torres (px)", { exact: true }).press("Enter");
  await page.reload();
  await page.waitForFunction(
    () =>
      Math.abs(
        Number(
          document.querySelector("[data-appointments-plot]")?.dataset.appointmentsRenderedMax,
        ) - 80,
      ) < 1,
  );
  assert.equal(
    await page.getByLabel("Altura máxima das torres (px)", { exact: true }).inputValue(),
    "80",
  );
  await page.locator("[data-appointments-plot]").hover();
  await page.getByRole("button", { name: "Usar altura automática das torres" }).click();
  await page.getByRole("button", { name: "Zeros", exact: true }).click();
  assert.equal((await facts()).max, 0);
  await page.getByRole("button", { name: "Sem coorte", exact: true }).click();
  assert.equal(await page.locator("[data-dashboard-goal-line]").count(), 0);
  assert.match(await page.locator("[data-test-card]").textContent(), /Corretores indisponível/u);
  await page.getByRole("button", { name: "Vazio", exact: true }).click();
  assert.match(await page.locator("[data-test-card]").textContent(), /Nenhum agendamento/u);
  evidence.interactions = [
    "month changes weekend dates",
    "keyboard focus reveals last day in accessible horizontal plot",
    "daily values recalculate maximum",
    "pixel cap persists",
    "zero data",
    "missing cohort",
    "empty data",
  ];
} catch (error) {
  evidence.failures.push(error.stack ?? String(error));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  if (evidence.browserErrors.length) evidence.failures.push("Browser JavaScript errors");
  if (evidence.externalRequests.length) evidence.failures.push("Unexpected external requests");
  evidence.passed = evidence.failures.length === 0;
  await writeFile(path.join(out, "result.json"), JSON.stringify(evidence, null, 2));
}
console.log(
  JSON.stringify({
    passed: evidence.passed,
    cases: evidence.cases.length,
    interactions: evidence.interactions,
    failures: evidence.failures,
    out,
  }),
);
if (!evidence.passed) process.exitCode = 1;
