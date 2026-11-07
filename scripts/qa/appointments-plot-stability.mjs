import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(
  root,
  "test-results/appointments-plot-stability",
  process.argv.includes("--before-fix") ? "before" : "after",
);
const require = createRequire(import.meta.url);
const vite = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const dir = "app/(protected)/app/etapas/_components";
const entry = path.join(root, "scripts/qa/appointments-stability-memory.tsx").replaceAll("\\", "/");
// Production reproduction: 31 days, max22, saved1159×284, rendered313px, fontScale0.75.
const buckets = Array.from({ length: 31 }, (_, i) => ({
  key: `2026-10-${String(i + 1).padStart(2, "0")}`,
  label: String(i + 1).padStart(2, "0"),
  total:
    i === 28
      ? 22
      : [
          4, 2, 4, 0, 3, 0, 1, 1, 5, 4, 0, 1, 1, 2, 0, 11, 3, 0, 1, 7, 7, 8, 5, 5, 1, 12, 9, 6, 22,
          6, 0,
        ][i],
  goal: i % 7 === 0 ? 0 : i % 3 === 0 ? 20 : 40,
}));
const source = `import {createRoot} from 'react-dom/client';import {useState} from 'react';import {ExpandedDashboardCardContent} from '@/lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas';import {Chart} from '@/${dir}/AppointmentsDashboard';import {AppointmentsColumns} from '@/${dir}/AppointmentsColumns';import {DashboardBarHeightControlContext} from '@/lib/dashboard-canvas/ui/configurable/bar-height-controls';import styles from '@/${dir}/AppointmentsDashboard.module.css';import '@/app/globals.css';function App(){const [cap,setCap]=useState(Number(localStorage.getItem('cap')||80));return <main style={{marginLeft:52,width:"calc(100vw - 77px)"}} className={styles.configurableCanvas}><article data-test-card style={{boxSizing:'border-box',border:'1px solid transparent',padding:1,width:1159,maxWidth:'100%',height:284}}><div data-dashboard-card-content style={{height:'100%'}}><DashboardBarHeightControlContext.Provider value={{value:cap,editable:true,onCommit:value=>{localStorage.setItem('cap',String(value));setCap(value)}}}><ExpandedDashboardCardContent preservePresentation card={{id:"daily",type:"bar",metric:"appointments.daily",layout:{order:0,width:1159,height:284,columnSpan:12},presentation:{barMaxHeight:cap,fontScale:0.75,barScale:1,textAlign:"center"}}}><Chart title="Evolução de agendamentos por dia"><AppointmentsColumns buckets={${JSON.stringify(buckets)}} label="Agendamentos por dia" daily /></Chart></ExpandedDashboardCardContent></DashboardBarHeightControlContext.Provider></div></article></main>}createRoot(document.getElementById('root')).render(<App/>);`;
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
      name: "stability-real-wrapper",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("appointments-stability-memory.tsx")) return entry;
      },
      async load(id) {
        if (id === entry) return source;
        if (id.replaceAll("\\", "/").endsWith("/AppointmentsDashboard.tsx"))
          return (await readFile(id, "utf8")) + "\nexport { Chart };";
      },
    },
  ],
  build: { write: false, minify: false, lib: { entry, name: "StabilityQa", formats: ["iife"] } },
});
const files = new Map(
  (Array.isArray(built) ? built : [built])
    .flatMap((result) => result.output)
    .map((f) => ["/" + f.fileName, f.type === "chunk" ? f.code : f.source]),
);
const js = [...files.keys()].find((n) => /\.m?js$/u.test(n));
const css = [...files.keys()].filter((n) => n.endsWith(".css"));
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css.map((c) => `<link rel="stylesheet" href="${c}">`).join("")}</head><body><div id="root"></div><script src="${js}"></script></body></html>`,
    );
  } else if (files.has(req.url)) {
    res.setHeader("Content-Type", req.url.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(files.get(req.url));
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(out, { recursive: true });
const evidence = {
  capturedAt: new Date().toISOString(),
  sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  environment:
    "Windows local Chromium; real Chart/Columns/CSS/context; synthetic buckets only; no database/auth/remote writes",
  sources: await Promise.all(
    [
      "AppointmentsColumns.tsx",
      "AppointmentsDashboard.tsx",
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
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : (evidence.externalRequests.push(route.request().url()), route.abort()),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => evidence.browserErrors.push(error.message));
  await page.goto(origin);
  for (const cap of [80, 1000]) {
    // Seed only this isolated fixture's previously saved presentation.
    await page.evaluate((value) => localStorage.setItem("cap", String(value)), cap);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await page.locator("[data-appointments-track]").first().waitFor();
      const frames = await page.evaluate(async () => {
        const frames = [];
        for (let i = 0; i < 60; i++) {
          await new Promise(requestAnimationFrame);
          const track = document.querySelector("[data-appointments-track]");
          const refs = document.querySelector("[data-appointments-references]");
          const bars = [...document.querySelectorAll("[data-appointments-bar]")];
          const card = document.querySelector("[data-test-card]");
          frames.push({
            track: track.getBoundingClientRect().height,
            refs: refs.getBoundingClientRect().height,
            max: Math.max(...bars.map((b) => b.getBoundingClientRect().height)),
            top: Number(
              document.querySelector("[data-appointments-plot]").dataset.appointmentsRenderedMax,
            ),
            solidReferences: document.querySelectorAll("[data-dashboard-bar-top-line]").length,
            notice: [...document.querySelectorAll("p")].some(
              (p) =>
                (p.textContent.includes("Meta fora da área") ||
                  p.hasAttribute("data-appointments-overflow-notice")) &&
                getComputedStyle(p).visibility !== "hidden",
            ),
            cardHeight: card.getBoundingClientRect().height,
          });
        }
        return frames;
      });
      const settled = frames.slice(10);
      const range = (key) =>
        Math.max(...settled.map((f) => f[key])) - Math.min(...settled.map((f) => f[key]));
      const failures = [];
      if (range("track") > 0.5 || range("max") > 0.5)
        failures.push("Plot/bar oscillates across settled frames");
      if (settled.some((f) => Math.abs(f.track - f.refs) > 1))
        failures.push("Reference layer height disagrees with tracks");
      if (settled.some((f) => Math.abs(f.top - f.max) > 1))
        failures.push("Rendered scale does not align with tallest bar");
      if (settled.some((f) => f.solidReferences !== 0))
        failures.push("Removed solid reference reappeared");
      if (settled.some((f) => f.cardHeight !== 284)) failures.push("Card height changed");
      const screenshot = path.join(out, `cap-${cap}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshot });
      evidence.cases.push({ cap, viewport, frames, failures, screenshot });
      evidence.failures.push(...failures.map((f) => `cap${cap}/${viewport.width}: ${f}`));
      assert.equal(
        await page.locator("[data-appointments-plot]").getAttribute("data-pixel-height"),
        String(cap),
      );
      assert.equal(
        await page.getByLabel("Altura máxima das torres (px)", { exact: true }).count(),
        0,
      );
    }
  }
} catch (error) {
  evidence.failures.push(error.stack ?? String(error));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  if (evidence.browserErrors.length) evidence.failures.push("Browser JavaScript errors");
  if (evidence.externalRequests.length) evidence.failures.push("Unexpected external requests");
  evidence.passed = evidence.failures.length === 0;
  await writeFile(path.join(out, "result.json"), JSON.stringify(evidence, null, 2));
}
console.log(
  JSON.stringify({
    passed: evidence.passed,
    cases: evidence.cases.length,
    failures: evidence.failures,
    out,
  }),
);
if (!evidence.passed) process.exitCode = 1;
