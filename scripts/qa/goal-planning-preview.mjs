import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "../..");
const outputRoot = path.join(root, "test-results/goal-planning-preview");
const goalsPath = "/app/configuracoes/metas";
const fixture = {
  profileKey: "dv",
  effectiveMonth: "2026-10-01",
  opportunities: 108,
  appointments: 12,
  visits: 5,
  folders: 4,
  approvedFolders: 1,
  sales: 1,
  opportunitiesRate: 896,
  appointmentsRate: 242,
  visitsRate: 135,
  foldersRate: 292,
  approvedFoldersRate: 126,
  brokerMinimumMonth1: 4,
  brokerMinimumMonth2: 6,
  brokerMinimumMonth3: 8,
  brokerMinimumMonth4Plus: 10,
  brokerWeeklyAppointments: 6,
  brokerWeeklyVisits: 2,
  brokerWeeklyFolders: 1,
  productiveTeamAppointments: 100,
  productiveTeamVisits: 100,
  productiveTeamFolders: 100,
  productiveTeamSales: 60,
  updatedAt: "2026-10-15T12:00:00Z",
};

export async function runGoalPlanningPreview() {
  await mkdir(outputRoot, { recursive: true });
  const evidence = {
    environment:
      "loopback synthetic real GoalPlanning and ProtectedLayout; no auth or remote writes",
    node: process.version,
    today: "2026-10-15",
    passed: false,
    screens: [],
    consoleErrors: [],
    blockedExternalRequests: [],
    unexpectedRequests: [],
  };
  const require = createRequire(import.meta.url);
  const vitestRequire = createRequire(require.resolve("vitest/package.json"));
  const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
  const entry = path.join(root, "scripts/qa/goal-planning-memory.tsx").replaceAll("\\", "/");
  const pages = [
    ["crm.dashboard", "/app", "Dashboard", "crm", null],
    ["crm.management", "/app/gestao", "Gestão", "management", null],
    ["crm.settings", "/app/configuracoes", "Configurações", "settings", null],
    ["crm.settings.goals", goalsPath, "Metas do funil", "settings", "crm.settings"],
    [
      "crm.settings.partnerships",
      `${goalsPath}/parcerias`,
      "Parcerias",
      "settings",
      "crm.settings",
    ],
  ].map(([key, route, name, section, parentKey], index) => ({
    key,
    path: route,
    name,
    section,
    parentKey,
    description: "Navegação QA sintética",
    sortOrder: index * 10,
    isNavigation: true,
    isActive: true,
  }));
  const boundaries = new Map([
    ["next/headers", "export async function cookies(){return {get:()=>undefined}}"],
    [
      "@/lib/authorization/enforce",
      "export async function enforceAuthorization(){return {roleKey:'user',permissions:[],level:10}}",
    ],
    [
      "@/lib/authorization/guards",
      "export async function getCurrentUser(){return {email:'goals.qa@nonexistent.invalid',user_metadata:{name:'QA Metas'}}}",
    ],
    ["@/lib/auth/actions/logout", "export const logoutAction='/qa-logout-disabled'"],
    [
      "@/lib/navigation/pages",
      `export async function getAuthorizedNavigation(){return ${JSON.stringify(pages)}} export function getDisabledNavigationItems(){return []}`,
    ],
  ]);
  const virtual = new Map(
    [...boundaries].map(([id, source], i) => [`\0goals-boundary-${i}`, { id, source }]),
  );
  const actionId = "\0goals-safe-action";
  const built = await build({
    root,
    configFile: false,
    envFile: false,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
    resolve: {
      alias: [
        ...[...virtual].map(([replacement, { id }]) => ({ find: id, replacement })),
        { find: "@", replacement: root },
      ],
    },
    oxc: { jsx: { runtime: "automatic" } },
    plugins: [
      {
        name: "goal-planning-synthetic-preview",
        enforce: "pre",
        resolveId(id, importer) {
          if (virtual.has(id) || id === actionId) return id;
          if (id === "../actions" && importer?.replaceAll("\\", "/").endsWith("/GoalPlanning.tsx"))
            return actionId;
          if (id.endsWith("goal-planning-memory.tsx")) return entry;
        },
        load(id) {
          if (virtual.has(id)) return virtual.get(id).source;
          if (id === actionId)
            return "export async function prepareFunnelGoalsDraftAction(){return {status:'error',message:'QA sintético: persistência desabilitada.'}}";
          if (id === entry)
            return `
          import {createRoot} from 'react-dom/client';
          import ProtectedLayout from '@/app/(protected)/layout';
          import {GoalPlanning} from '@/app/(protected)/app/configuracoes/metas/_components/GoalPlanning';
          import {PathnameContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
          import '@/app/globals.css';
          void(async()=>{
            const profile=location.pathname.endsWith('/parcerias')?'partnerships':'dv';
            const empty=new URLSearchParams(location.search).has('empty');
            const values=empty?null:{...${JSON.stringify(fixture)},profileKey:profile};
            const content=<main><GoalPlanning profile={profile} initialValues={values} canManageDraft={!empty} revision={0} today="2026-10-15" /></main>;
            const shell=await ProtectedLayout({children:content});
            createRoot(document.getElementById('root')).render(<PathnameContext.Provider value={location.pathname}>{shell}</PathnameContext.Provider>);
          })();`;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      cssMinify: false,
      lib: { entry, name: "GoalPlanningQa", formats: ["iife"] },
    },
  });
  const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
  const files = new Map(
    output.map((file) => [`/${file.fileName}`, file.type === "chunk" ? file.code : file.source]),
  );
  const script = output.find((file) => file.type === "chunk" && file.isEntry)?.fileName;
  assert.ok(script);
  const html = `<!doctype html><html lang="pt-BR" data-theme="light"><head><title>Metas QA sintético</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${[
    ...files.keys(),
  ]
    .filter((file) => file.endsWith(".css"))
    .map((file) => `<link rel="stylesheet" href="${file}">`)
    .join("")}</head><body><div id="root"></div><script src="/${script}"></script></body></html>`;
  for (const name of ["descomplica-wordmark-light.svg", "descomplica-wordmark-dark.svg"]) {
    files.set(`/brand/${name}`, await readFile(path.join(root, "public/brand", name)));
  }
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (request.method !== "GET") {
      evidence.unexpectedRequests.push(`${request.method} ${pathname}`);
      response.writeHead(405).end();
    } else if (pathname === "/favicon.ico") response.writeHead(204).end();
    else if (files.has(pathname))
      response
        .writeHead(200, {
          "content-type": pathname.endsWith(".svg")
            ? "image/svg+xml"
            : pathname.endsWith(".css")
              ? "text/css"
              : "text/javascript",
        })
        .end(files.get(pathname));
    else if ([goalsPath, `${goalsPath}/parcerias`].includes(pathname))
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    else {
      evidence.unexpectedRequests.push(pathname);
      response.writeHead(404).end();
    }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
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
      evidence.blockedExternalRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") evidence.consoleErrors.push(message.text());
    });
    for (const profile of ["dv", "partnerships"]) {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${origin}${goalsPath}${profile === "partnerships" ? "/parcerias" : ""}`);
        await expect(
          page.getByRole("heading", { name: "Planejamento de metas", exact: true }),
        ).toBeVisible();
        if (width === 1440 && profile === "dv") {
          const management = page.getByRole("button", { name: "Gestão", exact: true });
          await management.click();
          const meta = page
            .locator('[data-navigation-panel-for="crm.management"] a')
            .filter({ hasText: "Meta" });
          await expect(meta).toBeVisible();
          await expect(meta).toHaveAttribute("href", goalsPath);
          await meta.click();
          await expect(
            page.getByRole("heading", { name: "Planejamento de metas", exact: true }),
          ).toBeVisible();
          evidence.navigation = "Gestão > Meta clicked; authorized fixture route displayed";
        }
        if (profile === "partnerships") {
          await expect(page.locator(".goal-rate-card")).toHaveCount(3);
          await expect(
            page.locator(
              ".goal-broker-production-panel .goal-productivity-fields input:not([type=hidden])",
            ),
          ).toHaveCount(2);
          await expect(page.locator(".goal-productive-card")).toHaveCount(3);
          if (width === 1440) {
            const columns = await page.evaluate(() => {
              const count = (selector) =>
                getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(" ")
                  .length;
              return {
                weekly: count(".goal-broker-production-panel .goal-productivity-fields"),
                productive: count(".goal-productive-grid"),
              };
            });
            assert.deepEqual(
              columns,
              { weekly: 2, productive: 3 },
              "Partnerships must not reserve empty columns",
            );
            evidence.partnershipColumns = columns;
          }
        }
        for (const theme of ["light", "balanced", "dark"]) {
          const labels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
          const desktopTheme = page.getByRole("button", { name: labels[theme], exact: true });
          if (await desktopTheme.isVisible()) {
            await desktopTheme.click();
          } else {
            for (let attempt = 0; attempt < 3; attempt += 1) {
              if ((await page.locator("html").getAttribute("data-theme")) === theme) break;
              await page.locator("[data-theme-cycle-mobile]").click();
            }
          }
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const overflow = await page.evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          const screenshot = path.join(
            outputRoot,
            `${profile === "dv" ? "goals" : "partnerships"}-${theme}-${width}.png`,
          );
          await page.screenshot({ path: screenshot, fullPage: true });
          if (profile === "dv" && width === 1440 && theme === "dark") {
            await page.screenshot({
              path: path.join(outputRoot, "goals-dark-desktop.png"),
              fullPage: false,
            });
          }
          evidence.screens.push({
            width,
            profile,
            theme,
            overflow,
            violations: axe.violations.map(({ id, impact, nodes }) => ({
              id,
              impact,
              nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
            })),
            screenshot,
          });
        }
        await page
          .getByRole("spinbutton", { name: "Meta mensal de vendas", exact: true })
          .fill("2");
        await expect(page.locator(".goal-premium-stage output").first()).toHaveText(
          profile === "dv" ? "215" : "10",
        );
        evidence.interactions ??= [];
        evidence.interactions.push({
          width,
          profile,
          sales: 2,
          opportunities: await page.locator(".goal-premium-stage output").first().textContent(),
        });
        await page
          .getByRole("combobox", { name: "Selecionar mês", exact: true })
          .selectOption("10");
        await expect(
          page.getByRole("combobox", { name: "Selecionar mês", exact: true }),
        ).toHaveValue("10");
        await expect(page.locator(".goal-calendar-heading")).toContainText(/novembro/i);
      }
    }
    for (const interaction of evidence.interactions)
      assert.equal(
        interaction.opportunities,
        interaction.profile === "dv" ? "215" : "10",
        "Sales=2 projected first-stage volume",
      );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}${goalsPath}?empty=1`);
      await expect(
        page.getByText(
          "Metas ainda não configuradas. Preencha os campos para planejar; nenhum valor demonstrativo foi aplicado.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("spinbutton", { name: "Meta mensal de vendas", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".goal-premium-stage output")).toHaveText([
        "—",
        "—",
        "—",
        "—",
        "—",
        "—",
      ]);
      await expect(
        page.getByRole("button", { name: "Salvar rascunho de metas", exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path: path.join(outputRoot, `unconfigured-readonly-${width}.png`),
        fullPage: true,
      });
    }
    evidence.unconfiguredReadOnly =
      "1440/390: no fabricated values; disabled fields; no save button";
    assert.deepEqual(evidence.consoleErrors, [], "Browser errors");
    assert.deepEqual(evidence.unexpectedRequests, [], "Unexpected local requests");
    assert.deepEqual(evidence.blockedExternalRequests, [], "External requests must not be needed");
    for (const screen of evidence.screens) {
      assert.ok(
        screen.overflow.scrollWidth <= screen.overflow.width + 1,
        `Horizontal overflow: ${screen.theme}/${screen.width}`,
      );
      assert.deepEqual(screen.violations, [], `Axe violations: ${screen.theme}/${screen.width}`);
    }
    evidence.passed = true;
  } finally {
    await writeFile(path.join(outputRoot, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  process.stdout.write(
    `${JSON.stringify({ passed: evidence.passed, screens: evidence.screens.length, outputRoot })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runGoalPlanningPreview();
