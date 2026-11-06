import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";

test(
  "productive team fits desktop with an external rail and preserves card interactions",
  { timeout: 120000 },
  async () => {
    const root = process.cwd(),
      require = createRequire(import.meta.url);
    const viteRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
    const entry = path.join(root, "tests/productive-team-layout-memory.tsx").replaceAll("\\", "/");
    const reference = process.env.TEAM_LAYOUT_REF;
    if (reference && !/^[a-zA-Z0-9_./-]+$/.test(reference)) throw Error("Invalid reference");
    const scopedFiles = new Set([
      "app/(protected)/_components/AuthorizedBreadcrumbs.tsx",
      "app/(protected)/_components/DashboardShell.tsx",
      "app/(protected)/_components/ProtectedShell.module.css",
      "app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard.tsx",
      "app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard.module.css",
      "app/(protected)/app/etapas/_components/AppointmentsDashboard.tsx",
      "lib/crm/stages/productive-team.ts",
    ]);
    const built = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
      oxc: { jsx: { runtime: "automatic", development: false } },
      resolve: { alias: { "@": root } },
      plugins: [
        {
          name: "productive-team-layout-fixture",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("productive-team-layout-memory.tsx")) return entry;
            if (id === "next/link" || id === "next/navigation") return "\0team-" + id;
          },
          load(id) {
            if (id === "\0team-next/link")
              return "import {createElement} from 'react';export default function Link({prefetch,...props}){return createElement('a',props)}";
            if (id === "\0team-next/navigation")
              return "export const usePathname=()=>'/app/equipe-produtiva';";
            if (reference) {
              const rel = path.relative(root, id.split("?")[0]).replaceAll("\\", "/");
              if (scopedFiles.has(rel))
                return execFileSync("git", ["show", `${reference}:${rel}`], {
                  cwd: root,
                  encoding: "utf8",
                });
            }
            if (id === entry)
              return `import {createRoot} from 'react-dom/client';
          import {DashboardShell} from '@/app/(protected)/_components/DashboardShell';
          import {AuthorizedBreadcrumbs} from '@/app/(protected)/_components/AuthorizedBreadcrumbs';
          import {ProtectedShellFrame} from '@/app/(protected)/_components/ProtectedShellFrame';
          import shell from '@/app/(protected)/_components/ProtectedShell.module.css';
          import analytics from '@/app/(protected)/app/_components/analytics/analytics.module.css';
          import {AnalyticsCanvas} from '@/app/(protected)/app/_components/analytics';
          import {ProductiveTeamDashboard} from '@/app/(protected)/app/equipe-produtiva/_components/ProductiveTeamDashboard';
          import {PAGE_REGISTRY} from '@/lib/navigation/registry';import '@/app/globals.css';
          const pages=PAGE_REGISTRY.filter(p=>p.pageKey==='crm.dashboard'||p.parentKey==='crm.dashboard').map(p=>({...p,key:p.pageKey}));
          const roster=[{key:'a',owner:'Corretor sintético A',manager:'Gerente sintético',regionalManager:'Regional Oficial Nacional'},{key:'b',owner:'Corretor sintético B',manager:'Gerente sintético',regionalManager:'Regional Oficial Nacional'}];
          const analysis={version:4,viewKey:'all',brokerCount:2,brokerManagerCount:1,coverageStart:'2026-10-01',referenceDate:'2026-10-31',dimensions:{managers:['Gerente sintético'],owners:roster.map(r=>r.owner),companies:['Empresa sintética'],developments:[],stores:[]},facts:[[2,'2026-10-10',0,0,0,1,-1,9,0,0,-1],[4,'2026-10-10',0,0,0,1,-1,4,0,0,-1]],appointments:[{createdAt:'2026-10-10T12:00:00Z',scheduledAt:null,attendedAt:null,visitPerformed:false,regionalManager:'Regional sintético',salesManager:'Gerente sintético',owner:roster[0].owner,accountName:'',accountRanking:'',channel:1,company:'Empresa sintética',registeredBroker:true}]};
          const largeRoster=Array.from({length:180},(_,index)=>{const slot=179-index;return {key:'large-'+slot,owner:'Corretor sintético '+String(slot).padStart(3,'0')+' com nome completo extenso para conferir a leitura integral',manager:slot<90?'Gerente de Vendas Água':'Gerente de Vendas Zebra',regionalManager:slot<90?'Regional Água':'Regional Zebra'}});
          const largeAnalysis={...analysis,brokerCount:180,brokerManagerCount:2,dimensions:{...analysis.dimensions,managers:['Gerente de Vendas Água','Gerente de Vendas Zebra'],owners:largeRoster.map(r=>r.owner)},facts:largeRoster.flatMap((row,index)=>Number(row.key.slice(6))%2===0?[[2,'2026-10-10',row.manager.endsWith('Água')?0:1,index,0,1,-1,1,0,0,-1]]:[]),appointments:['Água','Zebra'].map(region=>({...analysis.appointments[0],createdAt:'2026-10-01T12:00:00Z',regionalManager:'Regional '+region,salesManager:'Gerente de Vendas '+region,owner:largeRoster.find(r=>r.manager==='Gerente de Vendas '+region).owner}))};
          const groupedRoster=largeRoster.slice(0,30).map((row,index)=>({...row,key:'group-'+index,manager:'Gerente '+String(index).padStart(2,'0'),regionalManager:'Regional Oficial'}));
          const groupedAnalysis={...analysis,brokerCount:30,brokerManagerCount:30,dimensions:{...analysis.dimensions,managers:groupedRoster.map(row=>row.manager),owners:groupedRoster.map(row=>row.owner)},facts:groupedRoster.map((row,index)=>[2,'2026-10-10',index,index,0,1,-1,1,0,0,-1]),appointments:[]};
          const regionalRoster=[{...roster[0],regionalManager:'Ana Maria Almeida'},{...roster[1],regionalManager:'Bruno Carlos Barbosa'},{key:'c',owner:'Corretor sintético C',manager:'Gerente sintético',regionalManager:null},{key:'d',owner:'Corretor sintético D',manager:'Gerente Zebra',regionalManager:null}];
          const regionalAnalysis={...analysis,brokerCount:4,brokerManagerCount:2,dimensions:{...analysis.dimensions,managers:['Gerente sintético','Gerente Zebra'],owners:regionalRoster.map(row=>row.owner)}};
          const decimalRoster=Array.from({length:30},(_,index)=>({key:'decimal-'+index,owner:'Corretor '+String(index).padStart(2,'0'),manager:'Gerente '+Math.floor(index/6),regionalManager:'Regional Oficial'}));
          const decimalAnalysis={...analysis,brokerCount:30,brokerManagerCount:5,dimensions:{...analysis.dimensions,managers:Array.from({length:5},(_,index)=>'Gerente '+index),owners:decimalRoster.map(row=>row.owner)},facts:decimalRoster.flatMap((row,index)=>[[4,'2026-10-10',Math.floor(index/6),index,0,1,-1,1,0,0,-1],...(index<13?[[2,'2026-10-10',Math.floor(index/6),index,0,1,-1,1,0,0,-1]]:[])]),appointments:decimalRoster.slice(0,13).map(row=>({...analysis.appointments[0],owner:row.owner,salesManager:row.manager}))};
          window.mountTeam=(missing=false,large=false)=>createRoot(document.getElementById('root')).render(<ProtectedShellFrame shellClassName={shell.shell} contentClassName={shell.mainContent} chrome={<><header data-protected-topbar style={{height:58,boxSizing:'border-box'}}>Descomplica — teste sintético</header><AuthorizedBreadcrumbs pages={pages}/></>} wrapContent={c=><DashboardShell pages={pages}>{c}</DashboardShell>}><main className={analytics.canvasMain}><AnalyticsCanvas kind='stage'><ProductiveTeamDashboard analysis={missing?null:large==='decimal'?decimalAnalysis:large==='regional'?regionalAnalysis:large==='groups'?groupedAnalysis:large?largeAnalysis:analysis} brokerRoster={missing?null:large==='decimal'?decimalRoster:large==='regional'?regionalRoster:large==='groups'?groupedRoster:large?largeRoster:roster} availableStages={missing?[]:['appointments','visits','folders','sales']} generatedAt='2026-10-31T12:00:00Z' calendarDate='2026-10-31'/></AnalyticsCanvas></main></ProtectedShellFrame>);`;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        lib: { entry, name: "TeamLayoutQa", formats: ["iife"] },
      },
    });
    const output = (Array.isArray(built) ? built : [built]).flatMap((x) => x.output);
    const rawCss = output
      .filter((x) => x.type === "asset" && x.fileName.endsWith(".css"))
      .map((x) => String(x.source))
      .join("\n");
    // Use the production PostCSS dependency's optimizer too: Vite alone does
    // not expose prefix ordering regressions in backdrop-filter declarations.
    const productionRequire = createRequire(require.resolve("@tailwindcss/postcss"));
    const { transform } = productionRequire("lightningcss");
    const css = transform({
      filename: "productive-team-layout.css",
      code: Buffer.from(rawCss),
      minify: true,
    }).code.toString();
    const js = output
      .filter((x) => x.type === "chunk")
      .map((x) => x.code)
      .join("\n");
    const evidenceRoot = path.join(
      root,
      "test-results/productive-team-layout",
      reference ? "reference" : "current",
    );
    await mkdir(evidenceRoot, { recursive: true });
    const evidence = {
      reference: reference ?? "working-tree",
      environment:
        "isolated Chromium; real client components/CSS, synthetic header and reports; network blocked",
      checks: [],
      popupChecks: [],
      summaryChecks: [],
      largeLists: [],
      filteredDetails: false,
      decimalGaugeChecks: [],
      passed: false,
    };
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ reducedMotion: "no-preference" });
      await page.route("**/*", (r) => r.abort());
      const mount = async (theme, missing, large = false) => {
        await page.setContent(
          `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><style>${css}</style><style>body{margin:0;font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
        );
        await page.evaluate(({ missing, large }) => window.mountTeam(missing, large), {
          missing,
          large,
        });
      };
      const assertHeaders = async (table) => {
        await expect(table.getByRole("columnheader")).toHaveText([
          "Gerente Regional",
          "Gerente de Vendas",
          "Responsável",
        ]);
        await expect(table.locator('thead th[scope="col"]')).toHaveCount(3);
      };
      const summaryHeaders = [
        "Gerente Regional",
        "Gerente de Vendas",
        "Qnt de corretores",
        "Equipe produtiva “Agendamentos”",
        "Equipe produtiva “Visitas”",
        "Equipe produtiva “Pastas”",
        "Equipe produtiva “Vendas”",
      ];
      const shortName = (value) => {
        const parts = value.trim().split(/\s+/u);
        return parts.length > 1 ? `${parts[0]} ${parts.at(-1)}` : parts[0];
      };
      const assertCompactNames = async (table) => {
        const rows = await table.locator("tbody tr").evaluateAll((elements) =>
          elements
            .filter((row) => row.children.length === 3)
            .map((row) =>
              Array.from(row.children, (cell) => ({
                text: cell.textContent.trim(),
                full: cell.getAttribute("title") ?? cell.textContent.trim(),
              })),
            ),
        );
        for (const row of rows)
          for (const cell of row) assert.equal(cell.text, shortName(cell.full));
        if (rows.length) {
          const padding = await table
            .locator("tbody td")
            .first()
            .evaluate((cell) => Number.parseFloat(getComputedStyle(cell).paddingTop));
          assert.ok(padding <= 4, `Popup row padding must be compact: ${padding}px`);
        }
      };
      const assertSummary = async (missing, expectedRows = 1) => {
        const summary = page.getByRole("table", {
          name: "Resumo da Equipe Produtiva",
          exact: true,
        });
        await expect(summary.getByRole("columnheader")).toHaveText(summaryHeaders);
        await expect(summary.locator('thead th[scope="col"]')).toHaveCount(7);
        if (missing) {
          await expect(summary.locator("tbody")).toContainText(/indisponível|aguardando/i);
          await expect(summary.locator("tbody tr td:nth-child(7)")).toHaveCount(0);
        } else {
          await expect(summary.locator("tbody tr")).toHaveCount(expectedRows);
          const rows = await summary.locator("tbody tr").evaluateAll((elements) =>
            elements.map((row) =>
              Array.from(row.children, (cell) => ({
                text: cell.textContent.trim(),
                title: cell.getAttribute("title"),
              })),
            ),
          );
          assert.ok(rows.every((row) => row.length === 7));
          const bases = rows.map((row) => Number(row[2].text.replaceAll(".", "")));
          const base = bases.reduce((a, b) => a + b, 0);
          const formatPercent = (value) =>
            new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "%";
          const productive = Array.from({ length: 4 }, (_, stage) =>
            rows.reduce((sum, row, index) => {
              const match = row[stage + 3].title.match(/([\d.]+) de ([\d.]+) corretores/u);
              assert.ok(match);
              const count = Number(match[1].replaceAll(".", ""));
              assert.equal(Number(match[2].replaceAll(".", "")), bases[index]);
              assert.equal(row[stage + 3].text, formatPercent((count / bases[index]) * 100));
              return sum + count;
            }, 0),
          );
          const footer = await summary.locator("tfoot td").allTextContents();
          assert.deepEqual(footer, [
            String(base),
            ...productive.map((count) => formatPercent((count / base) * 100)),
          ]);
          if (expectedRows === 1) {
            assert.deepEqual(footer, ["2", "50%", "50%", "0%", "50%"]);
            assert.ok(rows.every((row) => row[0].text !== "Não informado"));
          }
        }
        const placement = await summary.evaluate((element) => {
          const cards = document.querySelector(
            'section[aria-label="Corretores produtivos por etapa"]',
          );
          return {
            top: element.getBoundingClientRect().top,
            cardsBottom: cards.getBoundingClientRect().bottom,
          };
        });
        assert.ok(placement.top >= placement.cardsBottom - 1);
        return summary;
      };
      const assertDialogFits = async (dialog) => {
        const geometry = await dialog.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: innerWidth,
            height: innerHeight,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        });
        evidence.lastDialogGeometry = geometry;
        if (geometry.top < -1 || geometry.bottom > geometry.height + 1)
          await page.screenshot({ path: path.join(evidenceRoot, "details-failure.png") });
        assert.ok(
          geometry.left >= -1 && geometry.right <= geometry.width + 1,
          JSON.stringify(geometry),
        );
        assert.ok(
          geometry.top >= -1 && geometry.bottom <= geometry.height + 1,
          JSON.stringify(geometry),
        );
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, JSON.stringify(geometry));
        return geometry;
      };
      for (const [width, height] of [
        [1920, 714],
        [1440, 900],
        [1280, 720],
        [1280, 476],
        [960, 600],
        [768, 1024],
        [390, 844],
        [320, 568],
      ]) {
        await page.setViewportSize({ width, height });
        for (const theme of ["light", "balanced", "dark"]) {
          for (const missing of [false, true]) {
            evidence.stage = `layout:${width}:${height}:${theme}:${missing}`;
            await mount(theme, missing);
            const cards = page.getByRole("region", { name: "Corretores produtivos por etapa" });
            await expect(cards.locator("article")).toHaveCount(4);
            await expect
              .poll(() => page.locator("[data-dashboard-surface]").getAttribute("style"))
              .toContain("--dashboard-layout-width");
            const measure = () =>
              page.evaluate(() => {
                const rail = document.querySelector('aside[aria-label="Dashboard"]'),
                  header = document.querySelector("[data-protected-topbar]"),
                  card = document.querySelector("article"),
                  content = document.querySelector("[data-protected-main-content]");
                return {
                  width: innerWidth,
                  height: innerHeight,
                  scrollWidth: document.documentElement.scrollWidth,
                  scrollHeight: document.documentElement.scrollHeight,
                  railTop: rail.getBoundingClientRect().top,
                  headerBottom: header.getBoundingClientRect().bottom,
                  outsideContent: !content.contains(rail),
                  breadcrumbs: document.querySelectorAll('nav[aria-label="Breadcrumb"]').length,
                  duplicateTimestamp: document.querySelectorAll("[data-dashboard-updated-at]")
                    .length,
                  blur: getComputedStyle(card).backdropFilter,
                  frameOpacity: getComputedStyle(card, "::before").opacity,
                  transition: getComputedStyle(card).transitionProperty,
                };
              });
            if (width >= 960)
              await expect
                .poll(async () => {
                  const m = await measure();
                  return m.scrollHeight <= m.height + 1;
                })
                .toBe(true);
            const reading = await measure();
            const summary = await assertSummary(missing);
            await expect(
              page.getByText(
                "Cada corretor é contado uma única vez por etapa no período selecionado.",
                { exact: false },
              ),
            ).toHaveCount(0);
            await expect(
              page.getByText(
                "Cobertura parcial: os indicadores consideram somente as datas disponíveis nos relatórios.",
                { exact: true },
              ),
            ).toHaveCount(0);
            if (width >= 960) {
              await expect(summary).toBeInViewport();
              const cardHeight = await cards
                .locator("article")
                .first()
                .evaluate((element) => element.getBoundingClientRect().height);
              assert.ok(
                cardHeight <= 180,
                `Desktop cards must leave room for the summary: ${cardHeight}px`,
              );
            }
            evidence.summaryChecks.push({ width, height, theme, missing });
            assert.ok(reading.scrollWidth <= width + 1);
            assert.equal(reading.breadcrumbs, 0);
            assert.equal(reading.duplicateTimestamp, 0);
            assert.equal(reading.outsideContent, true);
            assert.ok(Math.abs(reading.railTop - reading.headerBottom) <= 1);
            assert.match(reading.blur, /blur\(12px\)/);
            assert.match(reading.transition, /box-shadow/);
            if (!missing) assert.equal(reading.frameOpacity, "1");
            await page.locator('aside[aria-label="Dashboard"]').hover();
            await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute(
              "data-collapsed",
              "false",
            );
            if (width >= 960)
              await expect
                .poll(async () => {
                  const m = await measure();
                  return m.scrollHeight <= m.height + 1;
                })
                .toBe(true);
            await page.mouse.move(width - 4, 2);
            await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute(
              "data-collapsed",
              "true",
            );
            evidence.checks.push({ width, height, theme, missing, reading });
            if (width === 1280 && height === 720 && !missing)
              await page.screenshot({
                path: path.join(evidenceRoot, `${theme}-1280.png`),
                fullPage: true,
              });
            if (width === 320 || width === 390 || (width === 1280 && height === 720)) {
              await expect(page.locator("table")).toHaveCount(1);
              for (const [index, activity] of [
                "Agendamentos",
                "Visitas",
                "Pastas",
                "Vendas",
              ].entries()) {
                evidence.stage = `popup:${width}:${theme}:${missing}:${activity}`;
                const trigger = cards
                  .locator("article")
                  .nth(index)
                  .getByRole("button", { name: "Abrir detalhes deste indicador", exact: true });
                await trigger.focus();
                await page.keyboard.press("Enter");
                const dialog = page.getByRole("dialog", {
                  name:
                    activity === "Agendamentos"
                      ? "Equipe com agendamento — Agendamentos"
                      : `Equipe Produtiva — ${activity}`,
                  exact: true,
                });
                await expect(dialog).toBeVisible();
                await expect(
                  dialog.getByRole("button", { name: "Fechar detalhes do indicador", exact: true }),
                ).toBeFocused();
                const productive = dialog.getByRole("table", {
                  name: activity === "Agendamentos" ? "Equipe com agendamento" : "Equipe Produtiva",
                  exact: true,
                });
                const unproductive = dialog.getByRole("table", {
                  name:
                    activity === "Agendamentos" ? "Equipe sem agendamento" : "Equipe não Produtiva",
                  exact: true,
                });
                await assertHeaders(productive);
                await assertHeaders(unproductive);
                if (missing) {
                  await expect(productive.locator("tbody")).toHaveText(
                    "Detalhamento nominal indisponível.",
                  );
                  await expect(unproductive.locator("tbody")).toHaveText(
                    "Detalhamento nominal indisponível.",
                  );
                  await expect(
                    dialog.getByText("Nenhum corretor nesta equipe.", { exact: true }),
                  ).toHaveCount(0);
                } else {
                  const expectedProductive = index === 2 ? [] : ["Corretor sintético A"];
                  const expectedUnproductive =
                    index === 2
                      ? ["Corretor sintético A", "Corretor sintético B"]
                      : ["Corretor sintético B"];
                  if (expectedProductive.length) {
                    await expect(productive.locator("tbody tr td:nth-child(3)")).toHaveText(
                      expectedProductive.map(shortName),
                    );
                  } else
                    await expect(productive.locator("tbody")).toHaveText(
                      "Nenhum corretor nesta equipe.",
                    );
                  await expect(unproductive.locator("tbody tr td:nth-child(3)")).toHaveText(
                    expectedUnproductive.map(shortName),
                  );
                  await expect(unproductive.locator("tbody tr td:nth-child(2)")).toHaveText(
                    expectedUnproductive.map(() => "Gerente sintético"),
                  );
                  await expect(unproductive.locator("tbody tr td:nth-child(1)")).toHaveText(
                    expectedUnproductive.map(() => "Regional Nacional"),
                  );
                }
                await assertCompactNames(productive);
                await assertCompactNames(unproductive);
                const geometry = await assertDialogFits(dialog);
                evidence.popupChecks.push({ width, height, theme, missing, activity, geometry });
                if (activity === "Visitas" && !missing && (width === 390 || width === 1280))
                  await page.screenshot({
                    path: path.join(evidenceRoot, `details-${theme}-${width}.png`),
                  });
                await page.keyboard.press("Escape");
                await expect(dialog).not.toBeVisible();
                await expect(trigger).toBeFocused();
                await expect(page.locator("table")).toHaveCount(1);
              }
            }
          }
        }
      }
      for (const width of [1280, 390]) {
        evidence.stage = `large:${width}`;
        await page.setViewportSize({ width, height: 720 });
        await mount("dark", false, true);
        const summary = await assertSummary(false, 2);
        await expect(summary.locator("tbody tr td:nth-child(3)")).toHaveText(["90", "90"]);
        await expect(summary.locator("tbody tr td:nth-child(5)")).toHaveText(["50%", "50%"]);
        const card = page
          .getByRole("region", { name: "Corretores produtivos por etapa" })
          .locator("article")
          .nth(1);
        await expect(card.locator(":scope > p")).toHaveText("90 de 180 corretores com visitas");
        const trigger = card.getByRole("button", {
          name: "Abrir detalhes deste indicador",
          exact: true,
        });
        await trigger.click();
        const dialog = page.getByRole("dialog");
        const productive = dialog.getByRole("table", { name: "Equipe Produtiva", exact: true });
        const unproductive = dialog.getByRole("table", {
          name: "Equipe não Produtiva",
          exact: true,
        });
        for (const table of [productive, unproductive]) {
          await assertHeaders(table);
          await expect(table.locator("tbody tr")).toHaveCount(90);
        }
        await expect(productive.locator("tbody tr td:nth-child(3)").first()).toHaveText(
          "Corretor integral",
        );
        await expect(productive.locator("tbody tr td:nth-child(3)").first()).toHaveAttribute(
          "title",
          "Corretor sintético 000 com nome completo extenso para conferir a leitura integral",
        );
        await expect(productive.locator("tbody tr td:nth-child(3)").last()).toHaveText(
          "Corretor integral",
        );
        await expect(productive.locator("tbody tr td:nth-child(3)").last()).toHaveAttribute(
          "title",
          "Corretor sintético 178 com nome completo extenso para conferir a leitura integral",
        );
        const last = unproductive.locator("tbody tr").last();
        await expect(last.locator("td")).toHaveText([
          "Regional Zebra",
          "Gerente Zebra",
          "Corretor integral",
        ]);
        await expect(last.locator("td").last()).toHaveAttribute(
          "title",
          "Corretor sintético 179 com nome completo extenso para conferir a leitura integral",
        );
        await assertCompactNames(productive);
        await assertCompactNames(unproductive);
        const geometry = await assertDialogFits(dialog);
        assert.ok(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight));
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
        const close = dialog.getByRole("button", {
          name: "Fechar detalhes do indicador",
          exact: true,
        });
        await expect(close).toBeInViewport();
        await page.screenshot({ path: path.join(evidenceRoot, `details-large-${width}.png`) });
        await close.click();
        await expect(trigger).toBeFocused();
        evidence.largeLists.push({
          width,
          productive: 90,
          unproductive: 90,
          lastRowReached: true,
          closeAlwaysVisible: true,
          geometry,
        });
        if (width === 1280) {
          await page
            .locator("#appointment-filter-owner")
            .selectOption(
              "Corretor sintético 002 com nome completo extenso para conferir a leitura integral",
            );
          await expect(card.locator(":scope > p")).toHaveText("1 de 1 corretores com visitas");
          const filteredSummary = page.getByRole("table", {
            name: "Resumo da Equipe Produtiva",
            exact: true,
          });
          await expect(filteredSummary.locator("tbody tr")).toHaveCount(1);
          await expect(filteredSummary.locator("tbody tr td:nth-child(3)")).toHaveText("1");
          await expect(filteredSummary.locator("tbody tr td:nth-child(5)")).toHaveText("100%");
          await trigger.click();
          await expect(
            dialog
              .getByRole("table", { name: "Equipe Produtiva", exact: true })
              .locator("tbody tr td:nth-child(3)"),
          ).toHaveText(["Corretor integral"]);
          await expect(
            dialog
              .getByRole("table", { name: "Equipe não Produtiva", exact: true })
              .locator("tbody"),
          ).toHaveText("Nenhum corretor nesta equipe.");
          await page.keyboard.press("Escape");
          await expect(trigger).toBeFocused();
          evidence.filteredDetails = true;
        }
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await mount("dark", false, "groups");
      const summary = await assertSummary(false, 30);
      {
        const summaryGeometry = await summary.evaluate((element) => {
          let container = element.parentElement;
          while (container && !/(auto|scroll)/.test(getComputedStyle(container).overflowY))
            container = container.parentElement;
          return container
            ? {
                top: container.getBoundingClientRect().top,
                bottom: container.getBoundingClientRect().bottom,
                clientHeight: container.clientHeight,
                scrollHeight: container.scrollHeight,
                role: container.getAttribute("role"),
                tabIndex: container.tabIndex,
                label: container.getAttribute("aria-label"),
              }
            : null;
        });
        assert.ok(summaryGeometry && summaryGeometry.scrollHeight > summaryGeometry.clientHeight);
        assert.equal(summaryGeometry.role, "region");
        assert.ok(summaryGeometry.tabIndex >= 0 && summaryGeometry.label);
        assert.ok(summaryGeometry.top >= 0 && summaryGeometry.bottom <= 721);
        await summary.locator("tbody tr").last().scrollIntoViewIfNeeded();
        await expect(summary.locator("tbody tr").last()).toBeInViewport();
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 720);
        await page.screenshot({ path: path.join(evidenceRoot, "summary-large-1280.png") });
      }
      evidence.summaryChecks.push({ width: 1280, groups: 30, lastRowReached: true });
      await mount("dark", false, "regional");
      const regionalSummary = await assertSummary(false, 2);
      const regionalCells = regionalSummary.locator("tbody tr td:first-child");
      await expect(regionalCells.nth(0).locator("span[title]")).toHaveText([
        "Ana Almeida",
        "/ Bruno Barbosa",
      ]);
      await expect(regionalCells.nth(0).locator("span[title]").nth(0)).toHaveAttribute(
        "title",
        "Ana Maria Almeida",
      );
      await expect(regionalCells.nth(0).locator("span[title]").nth(1)).toHaveAttribute(
        "title",
        "Bruno Carlos Barbosa",
      );
      await expect(regionalCells.nth(0)).toContainText("1 sem vínculo");
      await expect(regionalCells.nth(1)).toHaveText("Vínculo pendente");
      await expect(regionalSummary.locator("tbody tr td:nth-child(3)")).toHaveText(["3", "1"]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 720);
      await page.screenshot({ path: path.join(evidenceRoot, "summary-regional-1280.png") });
      evidence.summaryChecks.push({
        width: 1280,
        multipleRegionals: true,
        partialLink: true,
        pendingLink: true,
      });
      for (const [width, height] of [
        [960, 600],
        [1280, 720],
        [1920, 1080],
      ])
        for (const theme of ["light", "balanced", "dark"]) {
          evidence.stage = `decimal-gauge:${theme}:${width}`;
          await page.setViewportSize({ width, height });
          await mount(theme, false, "decimal");
          const decimalSummary = await assertSummary(false, 5);
          const cards = page
            .getByRole("region", { name: "Corretores produtivos por etapa" })
            .locator("article");
          await expect(cards.locator(':scope > [role="img"] strong')).toHaveText([
            "43,3%",
            "43,3%",
            "0%",
            "100%",
          ]);
          const gauges = await cards.evaluateAll((elements) =>
            elements.map((card) => {
              const box = card.getBoundingClientRect(),
                gauge = card.querySelector(':scope > [role="img"]'),
                strong = gauge.querySelector("strong");
              const outer = gauge.getBoundingClientRect(),
                text = strong.getBoundingClientRect();
              return {
                cardHeight: box.height,
                donutWidth: outer.width,
                text: strong.textContent,
                textWidth: text.width,
                contentInside: Array.from(
                  card.querySelectorAll(':scope > h2, :scope > [role="img"], :scope > p'),
                ).every((child) => {
                  const rect = child.getBoundingClientRect();
                  return (
                    rect.top >= box.top - 1 &&
                    rect.bottom <= box.bottom + 1 &&
                    rect.left >= box.left - 1 &&
                    rect.right <= box.right + 1
                  );
                }),
              };
            }),
          );
          for (const gauge of gauges) {
            assert.ok(
              gauge.textWidth <= gauge.donutWidth * 0.78,
              `${gauge.text} exceeds the donut interior: ${gauge.textWidth}px > ${gauge.donutWidth * 0.78}px`,
            );
            assert.ok(
              gauge.contentInside,
              "Card title, donut and description must fit inside the compact card",
            );
            assert.ok(gauge.cardHeight <= 180);
          }
          const tableGeometry = await decimalSummary.evaluate((table) => {
            const footer = table.querySelector("tfoot").getBoundingClientRect(),
              region = table.parentElement.getBoundingClientRect();
            return {
              rows: table.querySelectorAll("tbody tr").length,
              allRowsVisible: Array.from(table.querySelectorAll("tbody tr")).every((row) => {
                const rect = row.getBoundingClientRect();
                return (
                  rect.top >= region.top && rect.bottom <= footer.top && rect.bottom <= innerHeight
                );
              }),
              footerVisible: footer.top >= region.top && footer.bottom <= innerHeight,
              documentHeight: document.documentElement.scrollHeight,
              documentWidth: document.documentElement.scrollWidth,
            };
          });
          assert.equal(tableGeometry.documentHeight, height);
          assert.equal(tableGeometry.documentWidth, width);
          if (width >= 1280) {
            assert.ok(tableGeometry.allRowsVisible);
            assert.ok(tableGeometry.footerVisible);
          } else {
            await decimalSummary.locator("tbody tr").last().scrollIntoViewIfNeeded();
            await expect(decimalSummary.locator("tbody tr").last()).toBeInViewport();
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), height);
          }
          await page.screenshot({
            path: path.join(evidenceRoot, `decimal-gauge-${theme}-${width}.png`),
          });
          evidence.decimalGaugeChecks.push({ width, height, theme, gauges, tableGeometry });
        }
      evidence.passed = true;
    } finally {
      await browser.close();
      await writeFile(path.join(evidenceRoot, "evidence.json"), JSON.stringify(evidence, null, 2));
      console.log(
        JSON.stringify({ passed: evidence.passed, checks: evidence.checks.length, evidenceRoot }),
      );
    }
  },
);
