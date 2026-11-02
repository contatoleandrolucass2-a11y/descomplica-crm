import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
const root = process.cwd();
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const entry = path.join(root, "test-results/qa-profile-scope-memory.tsx").replaceAll("\\", "/");
const fixture = `import {createRoot} from 'react-dom/client';
import {AppointmentsDashboard} from '@/app/(protected)/app/etapas/_components/AppointmentsDashboard';
import {APPOINTMENTS_CANVAS_DEFAULT_CARDS as defaults} from '@/app/(protected)/app/etapas/_components/appointments-canvas-config';import '@/app/globals.css';
const analysis={version:2,viewKey:'all',coverageStart:'2026-10-01',referenceDate:'2026-10-31',dimensions:{managers:['Gerente sintético'],owners:['Responsável sintético'],companies:[],developments:[],stores:[]},facts:[[1,'2026-10-31',0,0,-1,1,-1,1,0,0,-1],[1,'2026-10-31',0,0,-1,0,-1,1,0,0,-1]]};
const profile={id:'profile-house',userId:'user-synthetic',pageKey:'crm.stage.appointments',scopeKey:'channel.house',name:'Sintético',isDefault:true,version:1,schemaVersion:2,cards:defaults.slice(0,2).map((card,index)=>({...card,id:'saved-v1-'+index,title:'Inicial V1 '+index})),createdAt:'2026-11-02T12:00:00Z',updatedAt:'2026-11-02T12:00:00Z'};
globalThis.__profile=profile;createRoot(document.getElementById('root')).render(<AppointmentsDashboard analysis={analysis} calendarDate="2026-10-31" canEditDashboard initialProfileState={{pageKey:profile.pageKey,scopeKey:profile.scopeKey,profiles:[profile]}}/>);`;
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
      name: "scope-review",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("qa-profile-scope-memory.tsx")) return entry;
      },
      load(id) {
        if (id === entry) return fixture;
      },
    },
  ],
  build: { write: false, minify: true, lib: { entry, formats: ["iife"], name: "ScopeReview" } },
});
const files = (Array.isArray(built) ? built : [built]).flatMap((x) => x.output);
const js = files
  .filter((f) => f.type === "chunk")
  .map((f) => f.code)
  .join("\n");
const css = files
  .filter((f) => f.type === "asset" && f.fileName.endsWith(".css"))
  .map((f) => String(f.source))
  .join("\n");
const server = createServer((req, res) => {
  res.setHeader("cache-control", "no-store");
  if (req.url === "/fixture.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(js);
  } else if (req.url === "/fixture.css") {
    res.setHeader("content-type", "text/css");
    res.end(css);
  } else {
    res.setHeader("content-type", "text/html");
    res.end(
      '<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true });
const evidence = { passed: false, reads: [], patchVersions: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  await page.route("**/api/dashboard-profiles**", async (route) => {
    const req = route.request();
    const original = await page.evaluate(() => globalThis.__profile);
    if (req.method() === "GET") {
      const scope = new URL(req.url()).searchParams.get("scopeKey");
      evidence.reads.push(scope);
      const profile = {
        ...original,
        id: scope === "channel.house" ? "profile-house" : "profile-partnerships",
        scopeKey: scope,
        version: 2,
        cards: original.cards.map((c, i) => ({
          ...c,
          id: "saved-v2-" + i,
          title: "Servidor V2 " + i,
        })),
      };
      await route.fulfill({ json: { profiles: [profile] } });
    } else if (req.method() === "PATCH") {
      const body = req.postDataJSON();
      evidence.patchVersions.push(body.version);
      await route.fulfill({
        json: { profile: { ...original, version: body.version + 1, cards: body.cards } },
      });
    } else throw new Error("Unexpected write " + req.method());
  });
  await page.goto("http://127.0.0.1:" + server.address().port);
  await expect(page.locator('[data-dashboard-card-id="saved-v1-0"]')).toBeVisible();
  assert.deepEqual(evidence.reads, []);
  await page.getByRole("button", { name: "Imob", exact: true }).click();
  await expect(page.locator('[data-dashboard-card-id="saved-v2-0"]')).toBeVisible();
  await page.getByRole("button", { name: "House", exact: true }).click();
  await expect(page.locator('[data-dashboard-card-id="saved-v2-0"]')).toBeVisible();
  assert.deepEqual(evidence.reads, ["channel.partnerships", "channel.house"]);
  await page
    .getByRole("button", { name: "Redimensionar Servidor V2 0", exact: true })
    .press("ArrowRight");
  await expect.poll(() => evidence.patchVersions.length).toBe(1);
  assert.deepEqual(evidence.patchVersions, [2]);
  assert.deepEqual(evidence.errors, []);
  evidence.passed = true;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile("test-results/qa-profile-scope-review.json", JSON.stringify(evidence, null, 2));
}
console.log(JSON.stringify(evidence));
