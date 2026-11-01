import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";

// Real shell components and CSS; synthetic navigation transport, no backend.
test(
  "Canvas interactions preserve logical geometry with sidebar zoom and keyboard focus",
  { timeout: 120_000 },
  async () => {
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const root = path.resolve(".");
    const entry = path.resolve("tests/dashboard-navigation-memory.tsx").replaceAll("\\", "/");
    const built = await build({
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
          name: "dashboard-navigation-fixture",
          enforce: "pre",
          resolveId(id) {
            if (id.endsWith("dashboard-navigation-memory.tsx")) return entry;
            if (id === "next/link" || id === "next/navigation") return `\0${id}`;
          },
          load(id) {
            if (id === "\0next/navigation")
              return `
          import { useSyncExternalStore } from "react";
          const subscribe = (listener) => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); };
          export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);
        `;
            if (id === "\0next/link")
              return `
          import { createElement } from "react";
          export default function Link({href, prefetch, onClick, children, ...props}) {
            return createElement("a", {...props, href, onClick(event) { onClick?.(event); event.preventDefault(); history.pushState(null, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }}, children);
          }
        `;
            if (id === entry)
              return `
          import { createRoot } from "react-dom/client";
          import { useEffect, useState } from "react";
          import { DashboardCanvas } from "@/lib/dashboard-canvas/ui/dashboard-canvas";
          import { APPOINTMENTS_CARD_LAYOUT_POLICY } from "@/lib/dashboard-canvas/layout/limits";
          import { DashboardShell, useDashboardSidebar } from "@/app/(protected)/_components/DashboardShell";
          import { AuthorizedNavigation } from "@/app/(protected)/_components/AuthorizedNavigation";
          import { PAGE_REGISTRY } from "@/lib/navigation/registry";
          import "@/app/globals.css";
          const pages = PAGE_REGISTRY.filter(page => page.pageKey === "crm.dashboard" || page.parentKey === "crm.dashboard").map(page => ({...page, key: page.pageKey}));
          const baseCards = [
            {id:"fixed",title:"Fixo",type:"bars",metric:"appointments.total",period:"month",groupBy:"day",entityIds:null,layout:{order:0,columnSpan:4,height:240,width:320}},
            {id:"fluid",title:"Fluido",type:"bars",metric:"appointments.total",period:"month",groupBy:"day",entityIds:null,layout:{order:1,columnSpan:6,height:240}},
            {id:"other",title:"Outro",type:"bars",metric:"appointments.total",period:"month",groupBy:"day",entityIds:null,layout:{order:2,columnSpan:3,height:240,width:280}},
          ];
          function Content() {
            const sidebar = useDashboardSidebar();
            const [cards,setCards] = useState(baseCards);
            useEffect(() => { sidebar?.setUpdatedAt("01/11/26, 09:00"); window.__commits=[];window.__downs=[];const listen=e=>{const button=e.target.closest('button[aria-label]');if(!button||!/^Redimensionar|^Mover /.test(button.getAttribute('aria-label')))return;const article=button.closest('[data-dashboard-card-id]');window.__downs.push({label:button.getAttribute('aria-label'),scale:document.querySelector('[data-dashboard-surface]').dataset.contentScale,active:document.activeElement.getAttribute('aria-label'),width:article.getBoundingClientRect().width});};document.addEventListener('pointerdown',listen,true);return()=>document.removeEventListener('pointerdown',listen,true); }, [sidebar]);
            return <main data-test-content tabIndex={-1} style={{padding:8,minWidth:0}}><h1>Fixture de interação</h1><DashboardCanvas cards={cards} layoutPolicy={APPOINTMENTS_CARD_LAYOUT_POLICY} compactControls cornerResizeHandle gap={8} renderCard={card=><p>{card.title}</p>} onCommit={(next,reason)=>{window.__commits.push({reason,cards:next});setCards(next);}} /><output data-state hidden>{JSON.stringify(cards)}</output></main>;
          }
          createRoot(document.getElementById("root")).render(<><AuthorizedNavigation pages={pages} /><DashboardShell pages={pages}><Content /></DashboardShell></>);
        `;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry, name: "DashboardNavigationQA", formats: ["iife"] },
      },
    });
    const files = (Array.isArray(built) ? built : [built]).flatMap((output) => output.output);
    const script = files
      .filter((file) => file.type === "chunk")
      .map((file) => file.code)
      .join("\n");
    const css = files
      .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
      .map((file) => String(file.source))
      .join("\n");
    assert.ok(script.length && css.length);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
        console.error(error.stack);
      });
      const handleRoute = (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== "http://dashboard.local.invalid") return route.abort();
        if (url.pathname === "/fixture.js")
          return route.fulfill({ contentType: "text/javascript", body: script });
        if (url.pathname === "/fixture.css")
          return route.fulfill({ contentType: "text/css", body: css });
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>',
        });
      };
      await page.route("**/*", handleRoute);
      await page.goto("http://dashboard.local.invalid/app/etapas/agendamentos");
      assert.deepEqual(errors, [], "The real shell must render without browser errors");
      const navigation = page.getByRole("navigation", { name: "Páginas do Dashboard" });
      const labels = [
        "Visão Geral",
        "Oportunidades",
        "Agendamentos",
        "Visitas",
        "Pastas",
        "Vendas",
        "Repasse",
      ];
      await expect(navigation.getByRole("link")).toHaveCount(7);
      await expect(navigation.getByRole("link")).toHaveText(labels);
      await expect(page.locator('#authorized-navigation a[href="/app"]')).toHaveText(/Dashboard/);
      await expect(
        page.locator('[aria-controls="authorized-navigation-crm-dashboard"]'),
      ).toHaveCount(0);
      const content = page.locator("[data-test-content]");
      const evidence = {
        environment:
          "Chromium synthetic fixture; real DashboardShell and DashboardCanvas; no backend",
        scenarios: [],
      };
      await page.setViewportSize({ width: 1440, height: 900 });
      const shell = page.locator("[data-dashboard-shell]");
      const navLink = page.getByRole("link", { name: "Agendamentos", exact: true });
      const state = async () => JSON.parse(await page.locator("[data-state]").textContent());
      const cardRect = async (id) =>
        page.locator('[data-dashboard-card-id="' + id + '"]').boundingBox();
      for (const mode of ["mouse", "keyboard-focus"]) {
        for (const id of ["fixed", "fluid"]) {
          await page.reload();
          await content.focus();
          await expect(shell).toHaveAttribute("data-collapsed", "true");
          const initial = await state();
          const before = await cardRect(id);
          if (mode === "mouse") await navLink.hover();
          else {
            await page.keyboard.press("Tab");
            await navLink.focus();
          }
          await expect(shell).toHaveAttribute("data-collapsed", "false");
          const handle = page.getByRole("button", {
            name: "Redimensionar " + (id === "fixed" ? "Fixo" : "Fluido"),
            exact: true,
          });
          await page.locator('[data-dashboard-card-id="' + id + '"]').hover();
          await handle.hover();
          const preDown = await cardRect(id);
          const handleBounds = await handle.boundingBox();
          const beforeCollapsed = await shell.getAttribute("data-collapsed");
          await page.mouse.move(
            handleBounds.x + handleBounds.width / 2,
            handleBounds.y + handleBounds.height / 2,
          );
          await page.mouse.down();
          const afterDownCollapsed = await shell.getAttribute("data-collapsed");
          await page.mouse.move(
            handleBounds.x + handleBounds.width / 2 + 20,
            handleBounds.y + handleBounds.height / 2 + 15,
            { steps: 3 },
          );
          await page.mouse.up();
          await expect.poll(() => page.evaluate(() => window.__commits.length)).toBe(1);
          const saved = (await state()).find((c) => c.id === id);
          const down = await page.evaluate(() => window.__downs.at(-1));
          await content.focus();
          await expect(shell).toHaveAttribute("data-collapsed", "true");
          const final = await cardRect(id);
          const zoom = Number(down.scale);
          const expectedWidth = Math.round(before.width + 20 / zoom);
          const expectedHeight = Math.round(before.height + 15 / zoom);
          assert.equal(
            saved.layout.width,
            expectedWidth,
            "Viewport movement must convert to logical width",
          );
          assert.equal(
            saved.layout.height,
            expectedHeight,
            "Viewport movement must convert to logical height",
          );
          assert.deepEqual(
            (await state()).map((c) => c.id),
            initial.map((c) => c.id),
            "Resize preserves order",
          );
          evidence.scenarios.push({
            mode,
            kind: "resize",
            id,
            before,
            preDown,
            beforeCollapsed,
            afterDownCollapsed,
            down,
            savedLayout: saved.layout,
            final,
            expectedWidth,
            expectedHeight,
            matchesExpected: true,
            sameOrder: true,
          });
        }
      }
      for (const mode of ["mouse", "keyboard-focus"]) {
        await page.reload();
        await content.focus();
        await expect(shell).toHaveAttribute("data-collapsed", "true");
        const initial = await state();
        const before = await cardRect("fluid");
        if (mode === "mouse") await navLink.hover();
        else {
          await page.keyboard.press("Tab");
          await navLink.focus();
        }
        await expect(shell).toHaveAttribute("data-collapsed", "false");
        const handle = page.getByRole("button", { name: "Mover Fluido", exact: true });
        await page.locator('[data-dashboard-card-id="fluid"]').hover();
        await handle.hover();
        const hb = await handle.boundingBox();
        const preDown = await cardRect("fluid");
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        const ghost = await page.locator("[data-dashboard-drag-overlay]").count();
        const floating = await page.locator("article").evaluateAll((nodes) =>
          nodes
            .filter((e) => getComputedStyle(e).position === "fixed")
            .map((e) => ({
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
              left: e.getBoundingClientRect().left,
              top: e.getBoundingClientRect().top,
            })),
        );
        assert.equal(floating.length, 1);
        for (const [ghostKey, cardKey] of [
          ["width", "width"],
          ["height", "height"],
          ["left", "x"],
          ["top", "y"],
        ])
          assert.ok(
            Math.abs(floating[0][ghostKey] - preDown[cardKey]) < 1,
            "Ghost " + ghostKey + " matches the source under zoom",
          );
        await page.mouse.up();
        await content.focus();
        await expect(shell).toHaveAttribute("data-collapsed", "true");
        assert.deepEqual(
          (await state()).map((c) => c.id),
          initial.map((c) => c.id),
          "Stationary drag preserves order",
        );
        evidence.scenarios.push({
          mode,
          kind: "drag-no-move",
          before,
          preDown,
          down: await page.evaluate(() => window.__downs.at(-1)),
          floating,
          ghost,
          sameOrder:
            (await state()).map((c) => c.id).join(",") === initial.map((c) => c.id).join(","),
          savedLayouts: (await state()).map((c) => ({ id: c.id, layout: c.layout })),
        });
        await page.reload();
        await content.focus();
        if (mode === "keyboard-focus") {
          await page.keyboard.press("Tab");
          await navLink.focus();
        }
        await page.locator('[data-dashboard-card-id="fluid"]').hover();
        await handle.hover();
        const start = await handle.boundingBox();
        const source = await cardRect("fluid");
        const target = await cardRect("other");
        const origin = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
        const destination = { x: target.x + target.width - 10, y: target.y + target.height / 2 };
        await page.mouse.move(origin.x, origin.y);
        await page.mouse.down();
        await page.mouse.move(destination.x, destination.y, { steps: 3 });
        const moved = await page.locator("article").evaluateAll((nodes) =>
          nodes
            .filter((e) => getComputedStyle(e).position === "fixed")
            .map((e) => ({
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
              left: e.getBoundingClientRect().left,
              top: e.getBoundingClientRect().top,
            })),
        );
        assert.equal(moved.length, 1);
        assert.ok(Math.abs(moved[0].width - source.width) < 1);
        assert.ok(Math.abs(moved[0].height - source.height) < 1);
        assert.ok(Math.abs(moved[0].left - (source.x + destination.x - origin.x)) < 1);
        assert.ok(Math.abs(moved[0].top - (source.y + destination.y - origin.y)) < 1);
        await page.mouse.up();
        const reordered = await state();
        assert.deepEqual(
          reordered.map((c) => c.id),
          ["fixed", "other", "fluid"],
        );
        for (const card of reordered) {
          const original = initial.find((c) => c.id === card.id);
          assert.deepEqual(
            { ...card.layout, order: original.layout.order },
            original.layout,
            "Drag preserves fixed/fluid dimensions",
          );
        }
        evidence.scenarios.push({
          mode,
          kind: "drag-move",
          source,
          destination,
          floating: moved,
          savedLayouts: reordered.map((c) => ({ id: c.id, layout: c.layout })),
        });
      }
      for (const id of ["fixed", "fluid"]) {
        await page.reload();
        await content.focus();
        await expect(shell).toHaveAttribute("data-collapsed", "true");
        const before = await cardRect(id);
        await page.keyboard.press("Tab");
        await navLink.focus();
        await expect(shell).toHaveAttribute("data-collapsed", "false");
        const handle = page.getByRole("button", {
          name: "Redimensionar " + (id === "fixed" ? "Fixo" : "Fluido"),
          exact: true,
        });
        await handle.focus();
        await handle.press("ArrowRight");
        const saved = (await state()).find((c) => c.id === id);
        assert.equal(
          saved.layout.width,
          Math.round(before.width + 1),
          "Keyboard resize uses logical pixels",
        );
        evidence.scenarios.push({
          mode: "keyboard",
          kind: "resize-arrow",
          id,
          collapsed: await shell.getAttribute("data-collapsed"),
          savedLayout: saved.layout,
          expectedWidth: Math.round(before.width + 1),
          matchesExpected: saved.layout.width === Math.round(before.width + 1),
        });
      }
      await mkdir("test-results/appointments-compact-sidebar", { recursive: true });
      await writeFile(
        "test-results/appointments-compact-sidebar/pointer-review.json",
        JSON.stringify(evidence, null, 2),
      );
      console.log(`${evidence.scenarios.length} focused geometry scenarios passed`);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
