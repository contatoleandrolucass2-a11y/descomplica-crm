import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";

test(
  "Appointment presentation keeps composition, state and centered rows filling the available width across viewports",
  { timeout: 120_000 },
  async () => {
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const root = path.resolve(".");
    const entry = path.resolve("tests/appointments-presentation-memory.tsx").replaceAll("\\", "/");
    const result = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
      resolve: {
        alias: { "@": root, "next/navigation": "\0next/navigation", "next/link": "\0next/link" },
      },
      oxc: { jsx: { runtime: "automatic", development: false } },
      plugins: [
        {
          name: "appointment-presentation-fixture",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("appointments-presentation-memory.tsx")) return entry;
            if (id === "next/navigation" || id === "next/link") return `\0${id}`;
          },
          load(id) {
            if (id === "\0next/navigation")
              return `export const usePathname=()=>'/app/etapas/agendamentos';`;
            if (id === "\0next/link")
              return `import {createElement} from 'react'; export default function Link({prefetch,...props}){return createElement('a',props)}`;
            if (id === entry)
              return `
          import {createRoot} from 'react-dom/client';
          import {useState} from 'react';
          import {DashboardShell} from '@/app/(protected)/_components/DashboardShell';
          import {DashboardCanvas} from '@/lib/dashboard-canvas/ui/dashboard-canvas';
          import {DashboardModal} from '@/lib/dashboard-canvas/ui/configurable/modal';
          import {PAGE_REGISTRY} from '@/lib/navigation/registry';
          import {APPOINTMENTS_CARD_LAYOUT_POLICY} from '@/lib/dashboard-canvas/layout/limits';
          import '@/app/globals.css';
          const metric=['appointments.goal','team.productive','brokers.total','managers.total','visits.total','sales.total','conversion.opportunity-appointment','conversion.appointment-visit','conversion.appointment-sale','appointments.rate','appointments.yesterday','appointments.today'];
          const cards=metric.map((metric,i)=>({id:'kpi'+i,title:'Indicador'+i,metric,type:'kpi',period:'month',groupBy:'entity',entityIds:null,layout:{order:i,columnSpan:2,...(i<6?{width:194}:{}),height:194}}));
          cards.push(...[{id:'funnel',metric:'appointments.funnel-comparison',title:'Funil comparativo',width:1205,height:500},{id:'ranking',metric:'ranking.owner',title:'Ranking por responsável',width:390,height:500},{id:'ranking-manager',metric:'ranking.manager',title:'Ranking por gerente',width:410,height:650},{id:'ranking-regional',metric:'ranking.regional',title:'Ranking regional',width:380,height:550},{id:'details',metric:'appointments.details',title:'Detalhamento',width:1205,height:484}].map((c,i)=>({...c,type:'bars',period:'month',groupBy:'entity',entityIds:null,layout:{order:i+12,columnSpan:12,width:c.width,height:c.height}})));
          window.__cards=JSON.stringify(cards); window.__commits=[];
          const pages=PAGE_REGISTRY.filter(page=>page.pageKey==='crm.dashboard'||page.parentKey==='crm.dashboard').map(page=>({...page,key:page.pageKey}));
          function Fixture(){const[modal,setModal]=useState(false);const[layoutCards,setLayoutCards]=useState(cards);return <><header data-protected-topbar style={{height:48,position:'sticky',top:0,zIndex:20,background:'#102d48',color:'white'}}>Cabeçalho</header><DashboardShell pages={pages}><div data-protected-main-content><main>{window.location.search.includes("unavailable")?<section><h1>Agendamentos</h1><p data-unavailable>Dados indisponíveis. Tente novamente.</p></section>:<div data-appointments-dashboard><h1>Agendamentos</h1><section data-appointments-canvas><DashboardCanvas cards={layoutCards} layoutPolicy={APPOINTMENTS_CARD_LAYOUT_POLICY} gap={8} compactControls cornerResizeHandle onCommit={(next)=>{window.__commits.push(next);setLayoutCards(next)}} renderCard={card=><div><h2>{card.title}</h2>{card.id==='funnel'?<><input aria-label='Estado do funil' defaultValue='preservado'/><button onClick={()=>setModal(true)}>Abrir resumo</button><button onClick={()=>setLayoutCards(current=>current.map(item=>item.id==='funnel'?{...item,layout:{...item.layout,width:900,height:750}}:item))}>Alterar dimensões do funil</button></>:null}</div>}/></section><footer>Rodapé</footer></div>}</main></div></DashboardShell>{modal?<DashboardModal portalToBody title='Resumo centralizado' onClose={()=>setModal(false)}><p>Conteúdo sintético</p></DashboardModal>:null}</>}
          createRoot(document.getElementById('root')).render(<Fixture/>);
        `;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry, name: "AppointmentsPresentationQA", formats: ["iife"] },
      },
    });
    const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
    const script = output
      .filter((item) => item.type === "chunk")
      .map((item) => item.code)
      .join("\n");
    const css = output
      .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
      .map((item) => String(item.source))
      .join("\n");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== "http://appointments-presentation.local.invalid") return route.abort();
        if (url.pathname === "/fixture.js")
          return route.fulfill({ contentType: "text/javascript", body: script });
        if (url.pathname === "/fixture.css")
          return route.fulfill({ contentType: "text/css", body: css });
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>',
        });
      });
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
        { width: 640, height: 450 },
        { width: 1280, height: 900, zoom: 2 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto("http://appointments-presentation.local.invalid/app/etapas/agendamentos");
        if (viewport.zoom)
          await page.evaluate((zoom) => {
            document.body.style.zoom = String(zoom);
          }, viewport.zoom);
        const first = page.locator('[data-dashboard-card-id="kpi0"]');
        await expect(first).toBeVisible();
        await expect
          .poll(() =>
            page
              .locator("[data-dashboard-surface]")
              .evaluate((element) =>
                Number.parseFloat(element.style.getPropertyValue("--dashboard-layout-width")),
              ),
          )
          .toBe(1236);
        const tops = await page
          .locator('[data-dashboard-card-id^="kpi"]')
          .evaluateAll((elements) =>
            elements.map((element) => Math.round(element.getBoundingClientRect().top)),
          );
        assert.equal(new Set(tops.slice(0, 6)).size, 1, "six KPI columns remain together");
        assert.equal(
          new Set(tops.slice(6)).size,
          1,
          "the next six KPI cards retain their second row",
        );
        const fill = await page.locator("[data-dashboard-canvas-grid]").evaluate((grid) => {
          const cards = [...grid.querySelectorAll("[data-dashboard-card-id]")];
          const right = grid.getBoundingClientRect().right;
          const lastFirstRow = cards[5].getBoundingClientRect().right;
          return Math.abs(right - lastFirstRow);
        });
        assert.ok(fill < 2, "overview cards fill the right edge without an unused strip");
        const alignedOverview = await page
          .locator('[data-dashboard-card-id^="ranking"]')
          .evaluateAll((es) =>
            es.map((e) => {
              const r = e.getBoundingClientRect();
              return { width: r.width, height: r.height, top: r.top };
            }),
          );
        assert.equal(alignedOverview.length, 3);
        for (const r of alignedOverview) {
          assert.ok(
            Math.abs(r.width - alignedOverview[0].width) < 2 &&
              Math.abs(r.height - alignedOverview[0].height) < 2 &&
              Math.abs(r.top - alignedOverview[0].top) < 2,
            "heterogeneous saved chart sizes align in the overview",
          );
        }
        await expect(page.getByText("Subir seção", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Descer seção", { exact: true })).toHaveCount(0);
        await page.getByLabel("Estado do funil").fill("estado local mantido");
        await page.evaluate(
          () => (window.__original = document.querySelector('[data-dashboard-card-id="funnel"]')),
        );
        for (const label of ["Ir para a próxima seção", "Ir para a seção anterior"]) {
          const arrow = await page.getByRole("button", { name: label }).boundingBox();
          assert.ok(
            arrow && arrow.y >= 0 && arrow.y + arrow.height <= viewport.height + 1,
            `${label} remains in the viewport without click auto-scrolling at ${JSON.stringify(viewport)}`,
          );
        }
        assert.equal(
          await page.getByRole("button", { name: "Ir para a próxima seção" }).count(),
          1,
          JSON.stringify(
            await page.locator("button[aria-label]").evaluateAll((elements) =>
              elements.map((element) => ({
                label: element.getAttribute("aria-label"),
                height: element.getBoundingClientRect().height,
                display: getComputedStyle(element).display,
              })),
            ),
          ),
        );
        if (viewport.zoom)
          await page.getByRole("button", { name: "Ir para a próxima seção" }).press("Enter");
        else await page.getByRole("button", { name: "Ir para a próxima seção" }).click();
        await page.mouse.move(viewport.width - 2, 4);
        assert.deepEqual(errors, [], JSON.stringify(viewport));
        await expect(
          page.locator("[data-appointments-presented]"),
          JSON.stringify(viewport),
        ).toHaveAttribute("data-dashboard-card-id", "funnel");
        await expect(page.locator("[data-dashboard-card-id]:visible")).toHaveCount(1);
        await expect
          .poll(async () => {
            const box = await page.locator("[data-appointments-presented]").boundingBox();
            return (
              box &&
              box.y >= 48 &&
              box.x >= 40 &&
              box.x + box.width <= viewport.width + 1 &&
              box.y + box.height <= viewport.height + 1
            );
          })
          .toBe(true);
        assert.equal(
          await page.evaluate(
            () => window.__original === document.querySelector("[data-appointments-presented]"),
          ),
          true,
          "the existing React-owned node is reused",
        );
        const presentedBox = await page.locator("[data-appointments-presented]").boundingBox();
        const gridBox = await page.locator("[data-dashboard-canvas-grid]").boundingBox();
        assert.ok(
          Math.abs(presentedBox.x + presentedBox.width / 2 - gridBox.x - gridBox.width / 2) < 2,
          "the whole chart is centered horizontally " +
            JSON.stringify({ viewport, presentedBox, gridBox }),
        );
        assert.ok(
          Math.abs(presentedBox.y + presentedBox.height / 2 - gridBox.y - gridBox.height / 2) < 2,
          "the whole chart is centered vertically below the toolbar",
        );
        await expect(page.getByLabel("Estado do funil")).toHaveValue("estado local mantido");
        if (viewport.width === 844) {
          await page.getByRole("button", { name: "Alterar dimensões do funil" }).click();
          await expect
            .poll(async () => {
              const current = await page.locator("[data-appointments-presented]").boundingBox();
              const frame = await page.locator("[data-dashboard-canvas-grid]").boundingBox();
              return (
                current &&
                frame &&
                Math.abs(current.width - frame.width) < 2 &&
                current.y >= frame.y - 1 &&
                current.y + current.height <= viewport.height + 1 &&
                Math.abs(current.x + current.width / 2 - frame.x - frame.width / 2) < 2
              );
            })
            .toBe(true);
          assert.equal(
            await page.evaluate(
              () => window.__original === document.querySelector("[data-appointments-presented]"),
            ),
            true,
          );
        }
        if (viewport.zoom) await page.getByRole("button", { name: "Abrir resumo" }).press("Enter");
        else await page.getByRole("button", { name: "Abrir resumo" }).click();
        const popup = page.getByRole("dialog", { name: "Resumo centralizado" });
        await expect(popup).toBeVisible();
        const box = await popup.boundingBox();
        assert.ok(
          Math.abs(box.x + box.width / 2 - viewport.width / 2) < 2,
          "popup stays centered horizontally outside zoom",
        );
        assert.ok(
          Math.abs(box.y + box.height / 2 - viewport.height / 2) < 2,
          "popup stays centered vertically outside zoom",
        );
        await page.mouse.move(1, viewport.height - 1);
        assert.deepEqual(
          await popup.boundingBox(),
          box,
          "moving the mouse does not move the popup",
        );
        await page.keyboard.press("Escape");
        await expect(popup).toHaveCount(0);
        await expect(page.locator("[data-appointments-presented]")).toHaveAttribute(
          "data-dashboard-card-id",
          "funnel",
        );
        if (viewport.zoom)
          await page.getByRole("button", { name: "Ir para a próxima seção" }).press("Enter");
        else await page.getByRole("button", { name: "Ir para a próxima seção" }).click();
        await expect(page.locator("[data-appointments-presented]")).toHaveCount(3);
        const rowBoxes = await page.locator("[data-appointments-presented]").evaluateAll((es) =>
          es.map((e) => {
            const r = e.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
            };
          }),
        );
        for (const box of rowBoxes) {
          assert.ok(
            Math.abs(box.y - rowBoxes[0].y) < 2 && Math.abs(box.height - rowBoxes[0].height) < 2,
            "row cards align and have equal height",
          );
          assert.ok(Math.abs(box.width - rowBoxes[0].width) < 2, "row charts have equal widths");
          assert.ok(
            box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
            "row fits viewport",
          );
        }
        assert.ok(
          rowBoxes[2].right - rowBoxes[0].x > viewport.width * 0.7,
          "the row fills available width",
        );
        await page.screenshot({
          path: `test-results/appointments-rows-${viewport.width}-${viewport.height}-${viewport.zoom || 1}.png`,
        });
        if (viewport.zoom)
          await page.getByRole("button", { name: "Ir para a seção anterior" }).press("Enter");
        else await page.getByRole("button", { name: "Ir para a seção anterior" }).click();
        await expect(page.locator("[data-appointments-presented]")).toHaveAttribute(
          "data-dashboard-card-id",
          "funnel",
        );
        if (viewport.zoom)
          await page.getByRole("button", { name: "Ir para a seção anterior" }).press("Enter");
        else await page.getByRole("button", { name: "Ir para a seção anterior" }).click();
        await expect(page.locator("[data-dashboard-card-id]:visible")).toHaveCount(17);
        await expect(page.getByLabel("Estado do funil")).toHaveValue("estado local mantido");
        assert.deepEqual(
          await page.evaluate(() => window.__commits),
          [],
          "presentation does not write card geometry",
        );
      }
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          "http://appointments-presentation.local.invalid/app/etapas/agendamentos?unavailable=1",
        );
        await expect(page.locator("[data-unavailable]")).toBeVisible();
        await expect(page.locator("[data-dashboard-shell]")).not.toHaveAttribute(
          "data-appointments-composition",
          "true",
        );
        const unavailable = await page.locator("[data-unavailable]").evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
            width: rect.width,
            scale: rect.width / element.offsetWidth,
          };
        });
        assert.ok(
          unavailable.fontSize >= 14 && Math.abs(unavailable.scale - 1) < 0.01,
          "unavailable data stays readable without canonical scaling",
        );
        assert.ok(unavailable.width < width, "fallback fits the available viewport");
      }
      // Fitting the page must not change the logical dimensions saved by corner resize.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("http://appointments-presentation.local.invalid/app/etapas/agendamentos");
      await page.getByRole("link", { name: "Agendamentos", exact: true }).focus();
      await page.keyboard.press("Tab");
      await page.getByRole("link", { name: "Agendamentos", exact: true }).focus();
      await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute(
        "data-collapsed",
        "false",
      );
      const resize = page.getByRole("button", { name: "Redimensionar Indicador0", exact: true });
      await page.locator('[data-dashboard-card-id="kpi0"]').hover();
      await expect(resize).toHaveCSS("pointer-events", "auto");
      await resize.hover();
      const resizeBox = await resize.boundingBox();
      const initialCardBox = await page.locator('[data-dashboard-card-id="kpi0"]').boundingBox();
      const scale = await page
        .locator("[data-dashboard-surface]")
        .evaluate((element) => Number(element.dataset.contentScale));
      await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        resizeBox.x + resizeBox.width / 2 + 20,
        resizeBox.y + resizeBox.height / 2 + 15,
        { steps: 3 },
      );
      await page.mouse.up();
      await expect.poll(() => page.evaluate(() => window.__commits.length)).toBe(1);
      const resized = await page.evaluate(
        () => window.__commits[0].find((card) => card.id === "kpi0").layout,
      );
      assert.equal(resized.width, Math.round((initialCardBox.width + 20) / scale));
      assert.equal(resized.height, Math.round(194 + 15 / scale));
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
