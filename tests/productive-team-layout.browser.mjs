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
          const roster=[{key:'a',owner:'Corretor sintético A',manager:'Gerente sintético'},{key:'b',owner:'Corretor sintético B',manager:'Gerente sintético'}];
          const analysis={version:4,viewKey:'all',brokerCount:2,brokerManagerCount:1,coverageStart:'2026-10-01',referenceDate:'2026-10-31',dimensions:{managers:['Gerente sintético'],owners:roster.map(r=>r.owner),companies:['Empresa sintética'],developments:[],stores:[]},facts:[[2,'2026-10-10',0,0,0,1,-1,9,0,0,-1],[4,'2026-10-10',0,0,0,1,-1,4,0,0,-1]],appointments:[{createdAt:'2026-10-10T12:00:00Z',scheduledAt:null,attendedAt:null,visitPerformed:false,regionalManager:'Regional sintético',salesManager:'Gerente sintético',owner:roster[0].owner,accountName:'',accountRanking:'',channel:1,company:'Empresa sintética',registeredBroker:true}]};
          window.mountTeam=(missing=false)=>createRoot(document.getElementById('root')).render(<ProtectedShellFrame shellClassName={shell.shell} contentClassName={shell.mainContent} chrome={<><header data-protected-topbar style={{height:58,boxSizing:'border-box'}}>Descomplica — teste sintético</header><AuthorizedBreadcrumbs pages={pages}/></>} wrapContent={c=><DashboardShell pages={pages}>{c}</DashboardShell>}><main className={analytics.canvasMain}><AnalyticsCanvas kind='stage'><ProductiveTeamDashboard analysis={missing?null:analysis} brokerRoster={missing?null:roster} availableStages={missing?[]:['appointments','visits','folders','sales']} generatedAt='2026-10-31T12:00:00Z' calendarDate='2026-10-31'/></AnalyticsCanvas></main></ProtectedShellFrame>);`;
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
      passed: false,
    };
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ reducedMotion: "no-preference" });
      await page.route("**/*", (r) => r.abort());
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
            await page.setContent(
              `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><style>${css}</style><style>body{margin:0;font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
            );
            await page.evaluate((m) => window.mountTeam(m), missing);
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
          }
        }
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      const trigger = page.getByRole("button", { name: "Abrir detalhes deste indicador" }).first();
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Fechar detalhes do indicador" }).click();
      await expect(trigger).toBeFocused();
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
