import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const directory = "app/(protected)/app/etapas/_components";
const baseline = process.argv.includes("--baseline-components");
const out = path.join(
  root,
  "test-results/appointments-comparison-lazy",
  baseline ? "before" : "after",
);
const sourcePaths = [
  `${directory}/AppointmentsDashboard.tsx`,
  `${directory}/AppointmentsComparison.tsx`,
  `${directory}/appointments-comparison.ts`,
  "lib/crm/stages/appointments.ts",
];
const sourceHashes = async () =>
  Promise.all(
    sourcePaths.map(async (file) => ({
      file,
      sha256: createHash("sha256")
        .update(
          baseline && /\/Appointments(?:Dashboard|Comparison)\.tsx$/u.test(file)
            ? execFileSync("git", ["show", `a886403a7be8b828b6040b02f48a67c7f31e915e:${file}`], {
                cwd: root,
              })
            : await readFile(path.join(root, file)),
        )
        .digest("hex"),
    })),
  );
const beforeSources = await sourceHashes();
const owners = ["Corretor sintético Alfa", "Corretor sintético Beta"];
const managers = ["Gerente sintético Alfa", "Gerente sintético Beta"];
const dates = [
  "2026-08-01",
  "2026-08-15",
  "2026-08-31",
  "2026-09-01",
  "2026-09-15",
  "2026-09-30",
  "2026-10-01",
  "2026-10-15",
  "2026-10-31",
];
const analysis = {
  version: 4,
  viewKey: "all",
  brokerCount: 2,
  brokerManagerCount: 2,
  coverageStart: "2026-01-01",
  referenceDate: "2026-10-31",
  dimensions: { managers, owners, companies: ["Empresa sintética"], developments: [], stores: [] },
  facts: dates.map((date, index) => [1, date, index % 2, index % 2, 0, 1, -1, 2, 0, 0, -1]),
  appointments: dates.flatMap((date, index) =>
    Array.from({ length: 2 }, (_, record) => ({
      createdAt: `${date}T12:0${record}:00Z`,
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
const roster = owners.map((owner, index) => ({
  key: `broker-${index}`,
  owner,
  manager: managers[index],
}));
const goals = { "2026-08": 24, "2026-09": 24, "2026-10": 24 };
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const entry = path.join(root, "scripts/qa/appointments-lazy-memory.tsx").replaceAll("\\", "/");
const fixtureSource = `import {useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';import {AppointmentsDashboard} from '@/${directory}/AppointmentsDashboard';import {buildUnmeasuredAppointmentComparison} from '@/${directory}/appointments-comparison';import '@/app/globals.css';
function Fixture(){const[analysis,setAnalysis]=useState(${JSON.stringify(analysis)});const[roster,setRoster]=useState(${JSON.stringify(roster)});const[goals,setGoals]=useState(${JSON.stringify(goals)});const[instance,setInstance]=useState(0);useEffect(()=>{globalThis.__qaExpectedComparison=(month,filters)=>buildUnmeasuredAppointmentComparison(analysis,{month,filters,brokerRoster:roster,goalsByMonth:goals});},[analysis,roster,goals]);return <main style={{padding:8,maxWidth:1440,margin:'auto'}}><aside aria-label="Controles sintéticos" style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>setAnalysis(current=>structuredClone(current))}>QA analysis</button><button onClick={()=>setRoster(current=>current.map(entry=>({...entry})))}>QA roster</button><button onClick={()=>setGoals(current=>({...current,'2026-10':25}))}>QA goals</button><button onClick={()=>setInstance(current=>current+1)}>QA new dashboard instance</button></aside><AppointmentsDashboard key={instance} analysis={analysis} brokerRoster={roster} goalsByMonth={goals} individualGoal={24} calendarDate="2026-10-31" canEditDashboard /></main>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const traceInitialization = "globalThis.__qaComparisonTrace ??= { builds: [], renders: [] };";
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
      name: "appointments-lazy-proof",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("appointments-lazy-memory.tsx")) return entry;
      },
      async load(id) {
        if (id === entry) return fixtureSource;
        const normalized = id.replaceAll("\\", "/");
        if (normalized.endsWith(`/${directory}/appointments-comparison.ts`)) {
          const original = await readFile(id, "utf8");
          assert.ok(original.includes("export function buildAppointmentComparison("));
          return (
            original.replace(
              "export function buildAppointmentComparison(",
              "export function buildUnmeasuredAppointmentComparison(",
            ) +
            `\nexport function buildAppointmentComparison(...args:Parameters<typeof buildUnmeasuredAppointmentComparison>){${traceInitialization}const started=performance.now();const result=buildUnmeasuredAppointmentComparison(...args);globalThis.__qaComparisonTrace.builds.push({result,durationMs:performance.now()-started});return result;}`
          );
        }
        if (
          normalized.endsWith(`/${directory}/AppointmentsDashboard.tsx`) ||
          normalized.endsWith(`/${directory}/AppointmentsComparison.tsx`)
        ) {
          let original = baseline
            ? execFileSync(
                "git",
                [
                  "show",
                  `a886403a7be8b828b6040b02f48a67c7f31e915e:${directory}/${path.basename(id)}`,
                ],
                { cwd: root, encoding: "utf8" },
              )
            : await readFile(id, "utf8");
          if (normalized.endsWith("/AppointmentsComparison.tsx")) {
            const marker = "  const allValues = comparison.series";
            assert.ok(original.includes(marker));
            original = original.replace(
              marker,
              `  ${traceInitialization}globalThis.__qaComparisonTrace.renders.push(comparison);\n${marker}`,
            );
          }
          return original;
        }
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    cssMinify: false,
    lib: { entry, name: "AppointmentsLazyQa", formats: ["iife"] },
  },
});
const files = new Map(
  (Array.isArray(built) ? built : [built])
    .flatMap((result) => result.output)
    .map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
);
const script = [...files.keys()].find((file) => /\.m?js$/u.test(file));
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comparativo lazy sintético</title>${[
  ...files.keys(),
]
  .filter((file) => file.endsWith(".css"))
  .map((file) => `<link rel="stylesheet" href="${file}">`)
  .join("")}</head><body><div id="root"></div><script src="${script}"></script></body></html>`;
let profile = null;
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (
    pathname.startsWith("/api/dashboard-profiles") &&
    ["POST", "PATCH"].includes(request.method)
  ) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (request.method === "PATCH" && (!profile || payload.version !== profile.version))
      return response
        .writeHead(409, { "content-type": "application/json" })
        .end(JSON.stringify({ error: "synthetic_version_conflict" }));
    profile = {
      ...profile,
      ...payload,
      id: "synthetic-lazy-profile",
      userId: "synthetic-user",
      version: (profile?.version ?? 0) + 1,
      createdAt: "2026-10-31T12:00:00Z",
      updatedAt: "2026-10-31T12:00:00Z",
    };
    return response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ profile }));
  }
  if (request.method !== "GET") return response.writeHead(405).end();
  if (pathname === "/api/dashboard-profiles")
    return response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ profiles: profile ? [profile] : [] }));
  if (pathname === "/favicon.ico") return response.writeHead(204).end();
  if (pathname === "/") return response.writeHead(200, { "content-type": "text/html" }).end(html);
  if (files.has(pathname))
    return response
      .writeHead(200, {
        "content-type": pathname.endsWith(".css") ? "text/css" : "text/javascript",
      })
      .end(files.get(pathname));
  response.writeHead(404).end();
});
await mkdir(out, { recursive: true });
const evidence = {
  sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  baselineComponents: baseline,
  environment:
    "Windows/Node24/local Chromium; real Dashboard/Canvas/Comparison/helper with QA-only build counter and synthetic endpoint. No auth, database or external requests. Not a production latency benchmark.",
  sources: beforeSources,
  syntheticAppointmentRecords: analysis.appointments.length,
  checks: [],
  drag: [],
  browserErrors: [],
  externalRequests: [],
  failures: [],
};
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
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
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => evidence.browserErrors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-31T12:00:00Z") });
  const card = () => page.locator('[data-dashboard-card-id="appointments-daily"]');
  const count = () => page.evaluate(() => globalThis.__qaComparisonTrace?.builds.length ?? 0);
  const saved = () =>
    expect(page.locator("[data-dashboard-save-status]")).toContainText("Salvo automaticamente");
  const setModel = async (model) => {
    await card()
      .getByRole("button", { name: "Editar Evolução de agendamentos por dia", exact: true })
      .press("Enter");
    const editor = page.getByRole("dialog", { name: "Editar card", exact: true });
    await editor.getByLabel("Modelo", { exact: true }).selectOption(model);
    await editor.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(editor).toHaveCount(0);
  };
  let month = "2026-10",
    filters = { channel: 1 };
  async function checkResult(name, expectedBuilds) {
    await expect.poll(count).toBe(expectedBuilds);
    const pair = await page.evaluate(
      ({ month, filters }) => ({
        actual: globalThis.__qaComparisonTrace.builds.at(-1).result,
        expected: globalThis.__qaExpectedComparison(month, filters),
        renderUsesLast:
          globalThis.__qaComparisonTrace.renders.at(-1) ===
          globalThis.__qaComparisonTrace.builds.at(-1).result,
      }),
      { month, filters },
    );
    assert.deepEqual(
      pair.actual,
      pair.expected,
      "Cached result must exactly match the uninstrumented pure helper",
    );
    assert.equal(pair.renderUsesLast, true);
    evidence.checks.push({ name, builds: expectedBuilds, wholeResultEqual: true });
  }
  async function dragLine(viewport) {
    await page.setViewportSize(viewport);
    await card().scrollIntoViewIfNeeded();
    await card().hover({ position: { x: 80, y: 25 } });
    const handle = card().getByRole("button", {
      name: "Mover Evolução de agendamentos por dia",
      exact: true,
    });
    await handle.hover();
    const box = await handle.boundingBox();
    assert.ok(box);
    const before = await count();
    let during;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height / 2 + 36, { steps: 4 });
      await expect(
        page.locator('article[aria-hidden="true"] [data-appointments-comparison]'),
      ).toHaveCount(1);
      during = await count();
    } finally {
      await page.mouse.up();
    }
    await expect(card().locator("[data-appointments-comparison]")).toHaveCount(1);
    await saved();
    const after = await count();
    evidence.drag.push({ viewport, before, during, after });
    assert.deepEqual(
      [during, after],
      [before, before],
      "Floating and remounted line must reuse one dashboard-owned comparison",
    );
  }
  await page.goto(origin);
  await saved();
  assert.equal(await count(), 0);
  evidence.checks.push({ name: "bars-remain-lazy", builds: 0 });
  await setModel("line");
  await saved();
  await checkResult("first-line-build", 1);
  await dragLine({ width: 1440, height: 900 });
  await checkResult("actual-pointer-drag-floating-and-remount", 1);
  await setModel("bars");
  await expect(card().locator("[data-appointments-comparison]")).toHaveCount(0);
  assert.equal(await count(), 1);
  await setModel("line");
  await checkResult("line-toggle-remount", 1);
  await card()
    .getByRole("button", { name: "Copiar Evolução de agendamentos por dia", exact: true })
    .press("Enter");
  await saved();
  await expect(page.locator("[data-appointments-comparison]")).toHaveCount(2);
  await checkResult("two-line-copies-share-one-build", 1);
  for (const [button, expected] of [
    ["QA analysis", 2],
    ["QA roster", 3],
    ["QA goals", 4],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await checkResult(`invalidate-${button}`, expected);
  }
  await page.getByRole("button", { name: "Outubro de 2026", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Selecione o período" });
  await dialog.getByLabel("Mês do calendário", { exact: true }).selectOption({ label: "Setembro" });
  month = "2026-09";
  await checkResult("invalidate-month", 5);
  await dialog.getByRole("button", { name: "Selecionar mês inteiro", exact: true }).click();
  await checkResult("month-confirmation-updates-filter-identity", 6);
  await page
    .getByRole("combobox", { name: "Gerente de Vendas", exact: true })
    .selectOption("Gerente sintético Beta");
  filters = { channel: 1, manager: "Gerente sintético Beta" };
  await checkResult("invalidate-filters", 7);
  await dragLine({ width: 390, height: 844 });
  await checkResult("mobile-pointer-drag-reuses-current-inputs", 7);
  await page.screenshot({ path: path.join(out, "mobile-line-copies.png") });
  await page.getByRole("button", { name: "QA new dashboard instance", exact: true }).click();
  month = "2026-10";
  filters = { channel: 1 };
  await saved();
  await checkResult("new-dashboard-instance-has-private-cache", 8);
  assert.deepEqual(evidence.browserErrors, []);
  assert.deepEqual(evidence.externalRequests, []);
  assert.deepEqual(
    await sourceHashes(),
    beforeSources,
    "Sources changed during the proof; rerun a frozen candidate",
  );
  evidence.buildDurationsMs = await page.evaluate(() =>
    globalThis.__qaComparisonTrace.builds.map((call) => call.durationMs),
  );
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.failures.push(error.stack ?? String(error));
  throw error;
} finally {
  await writeFile(path.join(out, "result.json"), JSON.stringify(evidence, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  console.log(
    JSON.stringify({
      passed: evidence.passed,
      checks: evidence.checks.length,
      drag: evidence.drag,
      failures: evidence.failures,
      out,
    }),
  );
}
