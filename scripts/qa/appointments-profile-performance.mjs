// Reproducible loopback-only laboratory proof, with synthetic profiles and no CRM session.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const base = process.argv[2] ?? "d4bb4d91b8a553ae2edf0eaeb876d21e2b59b361";
assert.match(base, /^[a-f0-9]{40}$/u);
const file = "lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas.tsx";
const afterSource = await readFile(path.join(root, file), "utf8");
const beforeSource = execFileSync("git", ["show", `${base}:${file}`], {
  cwd: root,
  encoding: "utf8",
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const out = path.join(root, "test-results/appointments-profile-performance");
await mkdir(out, { recursive: true });
const cards = (saved) =>
  [0, 1, 2].map((index) => ({
    id: `${saved ? "saved" : "default"}-${index}`,
    type: "kpi",
    metric: "sales.total",
    title: `${saved ? "Salvo" : "Padrão"} ${index}`,
    period: "month",
    groupBy: "entity",
    entityIds: null,
    layout: { order: index, columnSpan: saved ? 12 : 4, height: saved ? 320 : 168 },
  }));
const profile = {
  id: "synthetic-profile",
  userId: "synthetic-user",
  pageKey: "crm.stage.appointments",
  scopeKey: "channel.house",
  name: "Sintético",
  isDefault: true,
  version: 1,
  schemaVersion: 2,
  cards: cards(true),
  createdAt: "2026-11-02T12:00:00Z",
  updatedAt: "2026-11-02T12:00:00Z",
};
const catalog = { metrics: [{ key: "sales.total", label: "Vendas", defaultType: "kpi" }] };
const entry = path.join(root, "scripts/qa/profile-performance-memory.tsx").replaceAll("\\", "/");
const fixture = `import {useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {ConfigurableDashboardCanvas} from '@/lib/dashboard-canvas/ui/configurable';import '@/app/globals.css';
function Fixture(){useEffect(()=>{requestAnimationFrame(()=>{globalThis.__firstCards=[...document.querySelectorAll('[data-dashboard-card-id]')].map(el=>el.dataset.dashboardCardId);performance.mark('useful-content');});},[]);return <main style={{maxWidth:1200,margin:'auto'}}><h1>Agendamentos — fixture de layout</h1><ConfigurableDashboardCanvas initialCards={${JSON.stringify(cards(false))}} catalog={${JSON.stringify(catalog)}} pageKey="crm.stage.appointments" scopeKey="channel.house" initialProfileState={{pageKey:'crm.stage.appointments',scopeKey:'channel.house',profiles:[${JSON.stringify(profile)}]}} renderCard={()=> <p>Valores sintéticos do mesmo recorte</p>} editable={false} exportContext={{title:'Fixture'}} /><p id="footer">Fim do painel sintético</p></main>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const report = {
  base,
  candidateHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  candidateWorkingTree: true,
  node: process.version,
  source: file,
  hashes: { before: hash(beforeSource), after: hash(afterSource) },
  method:
    "Synthetic loopback profile: 200ms API delay; Chromium desktop 1440x900, no throttling, no-store, three initial/repeated navigation pairs per revision. Lab LCP/CLS only; no real-user INP or page latency claim.",
  variants: {},
};
const browser = await chromium.launch({ headless: true });
try {
  for (const [variant, source] of [
    ["before", beforeSource],
    ["after", afterSource],
  ]) {
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
          name: "profile-performance-fixture",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("profile-performance-memory.tsx")) return entry;
          },
          load(id) {
            if (id === entry) return fixture;
            if (id.replaceAll("\\", "/") === path.join(root, file).replaceAll("\\", "/"))
              return source;
          },
        },
      ],
      build: { write: false, minify: true, lib: { entry, formats: ["iife"], name: "Fixture" } },
    });
    const files = (Array.isArray(built) ? built : [built]).flatMap((output) => output.output);
    const js = files
      .filter((f) => f.type === "chunk")
      .map((f) => f.code)
      .join("\n");
    const css = files
      .filter((f) => f.type === "asset" && f.fileName.endsWith(".css"))
      .map((f) => String(f.source))
      .join("\n");
    let profileReads = 0;
    const server = createServer((request, response) => {
      response.setHeader("Cache-Control", "no-store");
      if (request.url?.startsWith("/api/dashboard-profiles")) {
        profileReads++;
        setTimeout(() => {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ profiles: [profile] }));
        }, 200);
      } else if (request.url === "/fixture.js") {
        response.setHeader("Content-Type", "text/javascript");
        response.end(js);
      } else if (request.url === "/fixture.css") {
        response.setHeader("Content-Type", "text/css");
        response.end(css);
      } else {
        response.setHeader("Content-Type", "text/html");
        response.end(
          `<!doctype html><html lang="pt-BR"><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>globalThis.__metrics={cls:0,lcp:null};new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)__metrics.cls+=entry.value;}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>{for(const entry of list.getEntries())__metrics.lcp=entry.startTime;}).observe({type:'largest-contentful-paint',buffered:true});</script><script src="/fixture.js"></script></body></html>`,
        );
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const samples = [];
      for (let pair = 0; pair < 3; pair++) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        try {
          const page = await context.newPage();
          const external = [];
          page.on("request", (request) => {
            if (!request.url().startsWith("http://127.0.0.1:")) external.push(request.url());
          });
          for (const navigation of ["initial", "repeated"]) {
            const readsBefore = profileReads;
            await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "load" });
            await page.waitForSelector('[data-dashboard-card-id="saved-0"]');
            // Allow the delayed baseline profile and layout observer to settle equally.
            await page.waitForTimeout(400);
            const sample = await page.evaluate(() => ({
              ...globalThis.__metrics,
              firstCards: globalThis.__firstCards,
              usefulContentMs: performance.getEntriesByName("useful-content")[0]?.startTime,
              resources: performance
                .getEntriesByType("resource")
                .map((r) => ({
                  name: new URL(r.name).pathname,
                  transferSize: r.transferSize,
                  decodedBodySize: r.decodedBodySize,
                })),
            }));
            sample.navigation = navigation;
            sample.pair = pair;
            sample.profileRequests = profileReads - readsBefore;
            assert.equal(sample.profileRequests, variant === "before" ? 1 : 0);
            assert.equal(sample.firstCards[0], variant === "before" ? "default-0" : "saved-0");
            samples.push(sample);
          }
          assert.deepEqual(external, []);
          if (pair === 0)
            await page.screenshot({ path: path.join(out, `${variant}.png`), fullPage: true });
        } finally {
          await context.close();
        }
      }
      report.variants[variant] = {
        compiledJsBytes: Buffer.byteLength(js),
        compiledCssBytes: Buffer.byteLength(css),
        samples,
      };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
  assert.equal(
    hash(await readFile(path.join(root, file), "utf8")),
    report.hashes.after,
    "Candidate changed during proof",
  );
  report.passed = true;
} finally {
  await browser.close();
  await writeFile(path.join(out, "result.json"), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify({
    passed: report.passed,
    out,
    variants: Object.fromEntries(
      Object.entries(report.variants).map(([key, value]) => [
        key,
        {
          profileRequests: value.samples.map((s) => s.profileRequests),
          cls: value.samples.map((s) => s.cls),
        },
      ]),
    ),
  }),
);
