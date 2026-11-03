import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { appointmentModel } from "./fixtures/appointments-summary.ts";
import { compactAppointmentSummary } from "../lib/crm/stages/appointments-summary.ts";
import { analyzeAppointments, saoPauloDate } from "../lib/crm/stages/appointments.ts";
import { appointmentDetailQueryKey } from "../lib/crm/stages/appointments-detail-contract.ts";

const root = process.cwd();
const out = path.join(root, "test-results/appointments-metas");
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const model = appointmentModel(273);
let house = 0;
for (const row of model.analysis.appointments) {
  if (row.channel !== 1) continue;
  row.createdAt = house < 40 ? "2026-10-05T15:00:00Z" : "2026-10-19T15:00:00Z";
  row.scheduledAt = "2026-10-20T15:30:00Z";
  row.visitPerformed = house >= 84;
  row.attendedAt = row.visitPerformed ? "2026-10-20T15:40:00Z" : null;
  house++;
}
assert.equal(house, 136);
for (let i = 0; i < 7; i++)
  model.analysis.appointments.push({
    ...model.analysis.appointments[1],
    createdAt: "2026-09-05T15:00:00Z",
    accountName: `Setembro sintético ${i}`,
  });
const query = {
  view: "all",
  month: "2026-10",
  year: "2026",
  calendarDate: "2026-10-31",
  filters: { channel: 1 },
};
const snapshot = "a".repeat(64);
function rowsFor(query) {
  const reading = analyzeAppointments(model.analysis, {
    month: query.month,
    year: query.year,
    calendarDate: query.calendarDate,
    filters: query.filters,
    brokerRoster: model.brokerRoster,
    goalsByMonth: model.goalsByMonth,
  });
  const rows = reading.details ?? [];
  return query.subset === "overdue"
    ? rows.filter(
        (row) =>
          !row.visitPerformed &&
          row.scheduledAt !== null &&
          saoPauloDate(row.scheduledAt) < query.calendarDate,
      )
    : rows;
}
function pageFor(query, all) {
  const rows = rowsFor(query);
  return {
    status: "ready",
    snapshot,
    total: rows.length,
    offset: 0,
    rows: all ? rows : rows.slice(0, 50),
    previousCursor: null,
    nextCursor: !all && rows.length > 50 ? "synthetic-partial" : null,
  };
}
assert.equal(rowsFor(query).length, 136);
assert.equal(rowsFor({ ...query, subset: "overdue" }).length, 84);
const compact = compactAppointmentSummary(model.analysis);
const source = {
  snapshot,
  view: "all",
  initialQueryKey: appointmentDetailQueryKey(query),
  initialPage: pageFor(query, false),
};
const entry = path.join(out, "fixture-memory.tsx").replaceAll("\\", "/");
const fixture = `import {createRoot} from 'react-dom/client';
import {AppointmentsDashboard} from '@/app/(protected)/app/etapas/_components/AppointmentsDashboard';
import {APPOINTMENTS_CANVAS_DEFAULT_CARDS as defaults} from '@/app/(protected)/app/etapas/_components/appointments-canvas-config';
import '@/app/globals.css';
const metrics=['appointments.daily','appointments.weekly','appointments.monthly','appointments.details','appointments.overdue'];
const cards=metrics.map((metric,order)=>{const card=structuredClone(defaults.find(card=>card.metric===metric));card.layout={...card.layout,columnSpan:12,height:500,order};if(metric==='appointments.daily')card.type='line';return card});
const profile={id:'synthetic-metas',userId:'synthetic-user',pageKey:'crm.stage.appointments',scopeKey:'channel.house',name:'QA sintético',isDefault:true,version:1,schemaVersion:2,cards,createdAt:'2026-10-31T12:00:00Z',updatedAt:'2026-10-31T12:00:00Z'};
globalThis.__profile=profile;
const actions={loadDetails:async input=>(await fetch('/details',{method:'POST',body:JSON.stringify(input)})).json(),exportDetails:async()=>{throw Error('Exportação não deve ser acionada pela UI')}};
createRoot(document.getElementById('root')).render(<><p role='note'>Ambiente de QA — dados sintéticos, sem conexão com produção</p><main><AppointmentsDashboard canEditDashboard analysis={null} compactSummary={${JSON.stringify(compact)}} detailSource={${JSON.stringify(source)}} detailActions={actions} calendarDate='2026-10-31' brokerRoster={${JSON.stringify(model.brokerRoster)}} goalsByMonth={${JSON.stringify(model.goalsByMonth)}} initialProfileState={{pageKey:profile.pageKey,scopeKey:profile.scopeKey,profiles:[profile]}} /></main></>);`;
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
      name: "appointments-metas-qa",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("fixture-memory.tsx")) return entry;
      },
      load(id) {
        if (id === entry) return fixture;
      },
    },
  ],
  build: {
    write: false,
    minify: true,
    lib: { entry, formats: ["iife"], name: "AppointmentsMetasQA" },
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
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: true,
  method:
    "Chromium local com componentes/CSS reais, dados e perfil sintéticos; transporte autorizado simulado. Sem conexão com produção. Testes backend separados validam autorização e filtro canônico.",
  checks: [],
  requests: [],
  errors: [],
  externalRequests: [],
};
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    return res.end(js);
  }
  if (req.url === "/fixture.css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    return res.end(css);
  }
  if (req.url === "/details") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(input.snapshot, snapshot);
    assert.equal(input.all, true);
    assert.equal(input.cursor, null);
    evidence.requests.push({
      subset: input.query.subset ?? "general",
      filters: input.query.filters,
    });
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(pageFor(input.query, true)));
  }
  if (req.url === "/favicon.ico") return res.writeHead(204).end();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
function intersects(a, b) {
  return (
    Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
    Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height)
  );
}
try {
  for (const theme of ["light", "medium", "dark"])
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const page = await browser.newPage({ viewport });
      await page.clock.install({ time: new Date("2026-10-31T12:00:00Z") });
      page.on("pageerror", (error) => evidence.errors.push(error.message));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {
          evidence.externalRequests.push(url.origin);
          return route.abort("blockedbyclient");
        }
        if (url.pathname.startsWith("/api/dashboard-profiles")) {
          const profile = await page.evaluate(() => globalThis.__profile);
          if (route.request().method() === "GET")
            return route.fulfill({ json: { profiles: [profile] } });
          const body = route.request().postDataJSON();
          return route.fulfill({
            json: { profile: { ...profile, ...body, version: body.version + 1 } },
          });
        }
        return route.continue();
      });
      await page.goto(origin);
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      const weekly = page.locator('[data-dashboard-card-id="appointments-weekly"]');
      await weekly.scrollIntoViewIfNeeded();
      const weeklyLine = weekly.locator("[data-dashboard-goal-line]");
      await expect(weeklyLine).toHaveAttribute(
        "aria-label",
        "Meta semanal: linha horizontal em 96 agendamentos",
      );
      await expect(weekly.locator("[data-appointments-reference-summary]")).toHaveText(
        "Meta semanal 96",
      );
      const pathBefore = await weeklyLine.locator("path").getAttribute("d");
      assert.match(pathBefore, /^M0,[\d.]+ H100$/);
      assert.ok(!pathBefore.includes("V"));
      await weekly.getByRole("button", { name: /2ª semana: 40 agendamentos/ }).click();
      await expect(weeklyLine).toHaveAttribute(
        "aria-label",
        "Meta semanal: linha horizontal em 96 agendamentos",
      );
      await weekly.getByRole("button", { name: /2ª semana: 40 agendamentos/ }).click();
      const monthly = page.locator('[data-dashboard-card-id="appointments-monthly"]');
      await monthly.scrollIntoViewIfNeeded();
      await expect(monthly.locator("[data-dashboard-goal-line]")).toHaveAttribute(
        "aria-label",
        "Meta de agendamentos: linha horizontal em 2 agendamentos",
      );
      const summary = monthly.locator("[data-appointments-reference-summary]");
      await expect(summary).toHaveText("Meta de agendamentos 2");
      const summaryGeometry = await summary.evaluate((el) => {
        const previous = el.previousElementSibling;
        return { below: el.getBoundingClientRect().top >= previous.getBoundingClientRect().bottom };
      });
      assert.ok(summaryGeometry.below);
      const comparison = page.locator('[data-dashboard-card-id="appointments-daily"]');
      await comparison.scrollIntoViewIfNeeded();
      const averagePoints = comparison
        .locator('[data-comparison-series="year-average"]')
        .locator("..")
        .locator("circle");
      await expect(averagePoints).toHaveCount(31);
      const labels = await averagePoints.evaluateAll((elements) =>
        elements.map((el) => el.getAttribute("aria-label")),
      );
      assert.ok(labels.every((label) => /: [\d.]+$/.test(label)));
      await expect(averagePoints.nth(4)).toHaveAttribute("aria-label", /dia 5: 5$/);
      await averagePoints.nth(4).focus();
      await expect(comparison.getByRole("tooltip")).toHaveText("5");
      await comparison.getByText("Ver valores e cobertura", { exact: true }).click();
      await expect(comparison.locator("tbody tr").nth(4).locator("td").last()).toHaveText("5");
      const tables = [];
      for (const [id, count] of [
        ["appointments-details", 136],
        ["appointments-overdue", 84],
      ]) {
        const card = page.locator(`[data-dashboard-card-id="${id}"]`);
        await card.scrollIntoViewIfNeeded();
        await expect(card.locator("tbody tr")).toHaveCount(count);
        await expect(
          card.getByRole("button", { name: "Exportar CSV completo", exact: true }),
        ).toHaveCount(0);
        await expect(card.getByText(/Exibindo todos os/)).toHaveCount(0);
        await expect(card.getByRole("button", { name: "Próxima página", exact: true })).toHaveCount(
          0,
        );
        if (id === "appointments-overdue") {
          await expect(
            card.getByRole("columnheader", {
              name: "Data prevista de comparecimento",
              exact: true,
            }),
          ).toBeVisible();
          await expect(card.locator("tbody tr").first()).toContainText("20/10/2026");
          await expect(card.locator("tbody tr").first().locator("td").nth(4)).toHaveText("Não");
        }
        const countText = card.getByText(`${count} registros no período`, { exact: true });
        await countText.scrollIntoViewIfNeeded();
        await countText.hover();
        await expect(countText).toBeVisible();
        await expect(countText).toBeInViewport();
        const countBox = await countText.boundingBox();
        assert.ok(countBox);
        const controls = card.locator('button[aria-label^="Copiar"]');
        const controlsBox = await controls.locator("..").boundingBox();
        assert.ok(controlsBox);
        assert.ok(!intersects(countBox, controlsBox));
        const scroll = card.locator('[role="region"]').last();
        await scroll.focus();
        await page.keyboard.press("End");
        await expect(card.locator("tbody tr").last()).toBeInViewport();
        const metrics = await scroll.evaluate((el) => ({
          top: el.scrollTop,
          height: el.scrollHeight,
          client: el.clientHeight,
        }));
        assert.ok(metrics.top > 0);
        tables.push({
          id,
          count,
          scroll: metrics,
          countVisibleOnHover: true,
          noControlOverlap: true,
        });
        if (theme === "dark")
          await card.screenshot({ path: path.join(out, `sintetico-${id}-${viewport.width}.png`) });
      }
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(overflow.documentWidth <= overflow.width);
      evidence.checks.push({
        theme,
        viewport,
        weeklyTarget: 96,
        weeklyTargetStableAfterWeekSelection: true,
        weeklyPath: pathBefore,
        monthlyTarget: 2,
        monthlySummaryBelowMaximum: true,
        annualAverageDayFive: 5,
        tooltipOnlyNumeric: true,
        tables,
        overflow,
      });
      if (theme === "dark") {
        await weekly.screenshot({ path: path.join(out, `sintetico-weekly-${viewport.width}.png`) });
        await monthly.screenshot({
          path: path.join(out, `sintetico-monthly-${viewport.width}.png`),
        });
      }
      await page.close();
    }
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.externalRequests, []);
  evidence.passed = true;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(path.join(out, "result.json"), JSON.stringify(evidence, null, 2));
}
console.log(
  JSON.stringify({
    passed: evidence.passed,
    checks: evidence.checks.length,
    errors: evidence.errors,
    externalRequests: evidence.externalRequests,
  }),
);
