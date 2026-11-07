import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { appointmentModel } from "./fixtures/appointments-summary.ts";
import { compactAppointmentSummary } from "../lib/crm/stages/appointments-summary.ts";
import { appointmentDetailQueryKey } from "../lib/crm/stages/appointments-detail-contract.ts";

const root = process.cwd();
const out = path.join(root, "test-results/appointments-detail");
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const model = appointmentModel(273);
const compact = compactAppointmentSummary(model.analysis);
const query = {
  view: "all",
  month: "2026-10",
  year: "2026",
  calendarDate: "2026-10-31",
  filters: { channel: 1 },
};
const snapshot = "a".repeat(64);
const rowsFor = (query) =>
  model.analysis.appointments
    .filter(
      (row) =>
        (query.filters.channel === undefined || row.channel === query.filters.channel) &&
        (!query.filters.owner || row.owner === query.filters.owner),
    )
    .map((row) => ({ ...row, daysSinceAppointment: 12 }));
const cursor = (offset) => Buffer.from(JSON.stringify({ offset })).toString("base64url");
const pageFor = (query, requestedCursor, all = false) => {
  const rows = rowsFor(query);
  const offset = requestedCursor
    ? JSON.parse(Buffer.from(requestedCursor, "base64url").toString()).offset
    : 0;
  return {
    status: "ready",
    snapshot,
    total: rows.length,
    offset,
    rows: all ? rows : rows.slice(offset, offset + 50),
    nextCursor: !all && offset + 50 < rows.length ? cursor(offset + 50) : null,
    previousCursor: !all && offset ? cursor(Math.max(0, offset - 50)) : null,
  };
};
const initialSource = {
  snapshot,
  view: "all",
  initialQueryKey: appointmentDetailQueryKey(query),
  initialPage: pageFor(query, null),
};
const entry = path.join(root, "test-results/appointments-detail-memory.tsx").replaceAll("\\", "/");
const fixture = `import {createRoot} from 'react-dom/client';import {AppointmentsDashboard} from '@/app/(protected)/app/etapas/_components/AppointmentsDashboard';import {APPOINTMENTS_CANVAS_DEFAULT_CARDS as defaults} from '@/app/(protected)/app/etapas/_components/appointments-canvas-config';import '@/app/globals.css';
const profile={id:'synthetic-details',userId:'synthetic-user',pageKey:'crm.stage.appointments',scopeKey:'channel.house',name:'Sintético',isDefault:true,version:1,schemaVersion:2,cards:defaults.filter(card=>card.metric==='appointments.details'),createdAt:'2026-10-31T12:00:00Z',updatedAt:'2026-10-31T12:00:00Z'};
globalThis.__profile=profile;const actions={loadDetails:async input=>(await fetch('/details',{method:'POST',body:JSON.stringify(input)})).json(),exportDetails:async input=>(await fetch('/export',{method:'POST',body:JSON.stringify(input)})).json()};
createRoot(document.getElementById('root')).render(<main><AppointmentsDashboard canEditDashboard analysis={null} compactSummary={${JSON.stringify(compact)}} detailSource={${JSON.stringify(initialSource)}} detailActions={actions} calendarDate='2026-10-31' brokerRoster={${JSON.stringify(model.brokerRoster)}} goalsByMonth={${JSON.stringify(model.goalsByMonth)}} initialProfileState={{pageKey:profile.pageKey,scopeKey:profile.scopeKey,profiles:[profile]}} /></main>);`;
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
      name: "appointments-detail-proof",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("appointments-detail-memory.tsx")) return entry;
      },
      load(id) {
        if (id === entry) return fixture;
      },
    },
  ],
  build: {
    write: false,
    minify: true,
    lib: { entry, formats: ["iife"], name: "AppointmentsDetail" },
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
const evidence = {
  passed: false,
  requests: [],
  exports: [],
  errors: [],
  externalRequests: [],
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: true,
  method:
    "Chromium loopback; synthetic 273-row snapshot with 136 House rows; actual Dashboard/compact codec with mocked authorized server transport. Separate unit tests cover canonical loader guards and snapshot identity.",
};
let mode = "ready";
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    return res.end(js);
  }
  if (req.url === "/fixture.css") {
    res.setHeader("Content-Type", "text/css");
    return res.end(css);
  }
  if (req.url === "/details" || req.url === "/export") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(input.snapshot, snapshot);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/details") {
      evidence.requests.push({
        owner: input.query.filters.owner ?? null,
        channel: input.query.filters.channel,
        cursor: input.cursor,
        all: input.all,
      });
      if (mode === "snapshot_changed")
        return res.end(JSON.stringify({ status: "snapshot_changed" }));
      assert.equal(input.all, true);
      const result = pageFor(input.query, input.cursor, input.all);
      setTimeout(
        () => res.end(JSON.stringify(result)),
        input.query.filters.owner === "Corretor A" ? 300 : 25,
      );
      return;
    }
    const rows = rowsFor(input.query);
    evidence.exports.push(rows.length);
    return res.end(
      JSON.stringify({
        status: "ready",
        total: rows.length,
        csv: ["Conta", ...rows.map((row) => row.accountName)].join("\r\n"),
      }),
    );
  }
  if (req.url === "/favicon.ico") return res.writeHead(204).end();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
  });
  await page.clock.install({ time: new Date("2026-10-31T12:00:00Z") });
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      evidence.externalRequests.push(url.origin);
      return route.abort("blockedbyclient");
    }
    if (url.pathname.startsWith("/api/dashboard-profiles")) {
      const original = await page.evaluate(() => globalThis.__profile);
      if (route.request().method() === "GET")
        return route.fulfill({ json: { profiles: [original] } });
      const body = route.request().postDataJSON();
      return route.fulfill({
        json: { profile: { ...original, ...body, version: body.version + 1 } },
      });
    }
    return route.continue();
  });
  await page.goto(origin);
  const table = page.getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(136);
  assert.equal(evidence.requests.length, 1);
  assert.equal(evidence.requests[0].all, true);
  await expect(page.getByRole("button", { name: "Próxima página", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Página anterior", exact: true })).toHaveCount(0);
  await expect(table.locator('td[data-label="Conta"][title="Conta sintética 00271"]')).toHaveText(
    "Conta sintética",
  );
  const viewport = table.locator("..");
  await viewport.focus();
  await page.keyboard.press("End");
  await expect(table.locator("tbody tr").last()).toBeInViewport();
  evidence.scroll = await viewport.evaluate((el) => ({
    client: el.clientHeight,
    scroll: el.scrollHeight,
    top: el.scrollTop,
  }));
  assert(evidence.scroll.top > 0);
  await expect(
    page.getByRole("button", { name: "Exportar CSV completo", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Exibindo todos os/)).toHaveCount(0);
  assert.deepEqual(evidence.exports, []);
  const owner = page.getByRole("combobox", { name: "Responsável da conta", exact: true });
  await owner.selectOption("Corretor A");
  await expect.poll(() => evidence.requests.at(-1)?.owner).toBe("Corretor A");
  await owner.selectOption("Corretor B");
  await expect(table.locator("tbody tr")).toHaveCount(136);
  await expect(table).toContainText("Corretor B");
  await page.waitForTimeout(350);
  await expect(table.locator("tbody tr")).toHaveCount(136);
  await expect(table).toContainText("Corretor B");
  const beforeLayoutRequests = evidence.requests.length;
  const card = page.locator('[data-dashboard-card-id="appointments-details"]');
  const handle = card.getByRole("button", {
    name: "Mover Detalhamento dos agendamentos",
    exact: true,
  });
  const bounds = await handle.boundingBox();
  assert(bounds);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2 + 40, {
    steps: 8,
  });
  await page.waitForTimeout(80);
  assert.equal(evidence.requests.length, beforeLayoutRequests);
  await page.mouse.up();
  await card
    .getByRole("button", { name: "Redimensionar Detalhamento dos agendamentos", exact: true })
    .press("ArrowRight");
  await card.hover();
  await card
    .getByRole("button", { name: "Copiar Detalhamento dos agendamentos", exact: true })
    .press("Enter");
  await expect(page.getByRole("table")).toHaveCount(2);
  await expect(page.getByRole("table").first().locator("tbody tr")).toHaveCount(136);
  await expect(page.getByRole("table").last().locator("tbody tr")).toHaveCount(136);
  await page.waitForTimeout(100);
  assert.equal(evidence.requests.length, beforeLayoutRequests);
  evidence.layout = {
    pointerDrag: "passed",
    keyboardResize: "passed",
    copy: "passed",
    preservedRowsPerCopy: 136,
    additionalRequests: 0,
  };
  mode = "snapshot_changed";
  await owner.selectOption("");
  await page
    .getByRole("combobox", { name: "Empresa", exact: true })
    .selectOption("Empresa sintética");
  await expect(
    page.getByRole("button", { name: "Atualizar dados", exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.screenshot({ path: path.join(out, "snapshot-changed.png"), fullPage: true });
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.passed = true;
  const large = appointmentModel(20_000);
  const first = rowsFor(query).slice(0, 50);
  evidence.payload = {
    records: 20_000,
    beforeBytes: Buffer.byteLength(JSON.stringify(large)),
    afterBytesMockCursor: Buffer.byteLength(
      JSON.stringify({
        ...large,
        analysis: undefined,
        compact: compactAppointmentSummary(large.analysis),
        detailSource: {
          ...initialSource,
          initialPage: { ...initialSource.initialPage, total: 10_000, rows: first },
        },
      }),
    ),
  };
  evidence.sourceHashes = Object.fromEntries(
    await Promise.all(
      [
        "app/(protected)/app/etapas/_components/AppointmentsDashboard.tsx",
        "lib/crm/stages/appointments-summary.ts",
        "lib/crm/stages/appointments-detail-server.ts",
        "lib/crm/stages/appointments-detail-client.ts",
        "lib/crm/stages/appointments-detail-contract.ts",
        "app/(protected)/app/etapas/_components/appointments-actions.ts",
      ].map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(out, "result.json"), JSON.stringify(evidence, null, 2));
}
console.log(JSON.stringify(evidence));
