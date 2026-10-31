import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";

// Real shell components and CSS; synthetic navigation transport, no backend.
test(
  "Dashboard navigation: automatic hover, keyboard, touch, timestamp and responsive themes",
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
          import { useEffect } from "react";
          import { DashboardShell, useDashboardSidebar } from "@/app/(protected)/_components/DashboardShell";
          import { AuthorizedNavigation } from "@/app/(protected)/_components/AuthorizedNavigation";
          import { PAGE_REGISTRY } from "@/lib/navigation/registry";
          import "@/app/globals.css";
          const pages = PAGE_REGISTRY.filter(page => page.pageKey === "crm.dashboard" || page.parentKey === "crm.dashboard").map(page => ({...page, key: page.pageKey}));
          function Content() {
            const sidebar = useDashboardSidebar();
            useEffect(() => { sidebar?.setUpdatedAt("31/10/26, 07:33"); }, [sidebar]);
            return <main data-test-content tabIndex={-1}><h1>Conteúdo sintético</h1><p>Dashboard autorizado</p></main>;
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
      const screenshotDirectory = process.env.DASHBOARD_QA_SCREENSHOTS;
      if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
        for (const width of [320, 390, 760, 768, 1180, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          const shell = page.locator("[data-dashboard-shell]");
          const sidebar = page.getByRole("complementary", { name: "Dashboard", exact: true });
          const appointments = navigation.getByRole("link", { name: "Agendamentos", exact: true });
          const timestamp = page.locator("[data-dashboard-updated-at]");
          await page.mouse.move(width - 10, 450);
          await content.click();
          await expect(shell).toHaveAttribute("data-collapsed", "true");
          await expect(page.getByRole("button", { name: /navegação do Dashboard/ })).toHaveCount(0);
          await expect(sidebar.getByText("Atualizado em", { exact: true })).toHaveCount(0);
          await expect(timestamp).toHaveText("Atualizado em31/10/26, 07:33");
          await expect(timestamp).toBeVisible();
          await expect(sidebar).toHaveCSS("width", "50px");
          const collapsedContent = await content.boundingBox();
          if (screenshotDirectory && (width === 390 || width === 1440)) {
            await page.screenshot({
              path: path.join(screenshotDirectory, `${theme}-${width}-collapsed.png`),
            });
          }
          await appointments.hover();
          await expect(shell).toHaveAttribute("data-collapsed", "false");
          await expect(sidebar).toHaveCSS("width", "150px");
          await expect(appointments.locator("span").last()).toBeVisible();
          const expandedContent = await content.boundingBox();
          if (width > 760)
            assert.ok(
              collapsedContent.width > expandedContent.width,
              "Leaving sidebar releases content width",
            );
          else
            assert.equal(
              collapsedContent.width,
              expandedContent.width,
              "Mobile expansion overlays without squeezing content",
            );
          if (screenshotDirectory && (width === 390 || width === 1440)) {
            await page.screenshot({
              path: path.join(screenshotDirectory, `${theme}-${width}-expanded.png`),
            });
          }
          await appointments.click();
          await page.mouse.move(width - 10, 450);
          await expect(shell).toHaveAttribute("data-collapsed", "true");
          await expect(sidebar).toHaveCSS("width", "50px");
          // Keyboard focus expands labels even with the pointer outside. Mouse
          // focus must not keep the navigation pinned after pointerleave.
          await page.keyboard.press("Tab");
          await appointments.focus();
          await expect(shell).toHaveAttribute("data-collapsed", "false");
          await expect(appointments.locator("span").last()).toBeVisible();
          await page.keyboard.press("Enter");
          await expect(appointments).toHaveAttribute("aria-current", "page");
          await content.focus();
          await expect(shell).toHaveAttribute("data-collapsed", "true");
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            true,
            `${theme}/${width}: overflow`,
          );
          const timestampBounds = await timestamp.boundingBox();
          const contentBounds = await content.boundingBox();
          assert.ok(
            timestampBounds.x >= contentBounds.x,
            "Timestamp belongs to content, outside sidebar",
          );
          assert.ok(
            timestampBounds.x + timestampBounds.width <= width + 1,
            "Timestamp fits viewport",
          );
        }
      }
      await navigation.getByRole("link", { name: "Visitas", exact: true }).hover();
      await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute(
        "data-collapsed",
        "false",
      );
      await navigation.getByRole("link", { name: "Visitas", exact: true }).click();
      await expect(page.locator("[data-dashboard-shell]")).toHaveCount(0);
      await page.mouse.move(1400, 450);
      await page.goBack();
      await expect(page.locator("[data-dashboard-shell]")).toHaveAttribute(
        "data-collapsed",
        "true",
      );
      await expect(page.locator("[data-dashboard-updated-at]")).toBeVisible();
      for (const pathname of [
        "/app",
        "/app/etapas/oportunidades",
        "/app/etapas/visitas",
        "/app/etapas/pastas",
        "/app/etapas/vendas",
        "/app/repasse",
        "/app/meta-ads",
        "/app/etapas/agendamentos/detalhe",
      ]) {
        await page.evaluate((pathname) => {
          history.pushState(null, "", pathname);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, pathname);
        await expect(page.locator("[data-dashboard-shell]")).toHaveCount(0);
        await expect(
          page.locator('[aria-controls="authorized-navigation-crm-dashboard"]'),
        ).toHaveCount(1);
        await expect(content).toBeVisible();
      }
      const touchContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      try {
        const touchPage = await touchContext.newPage();
        await touchPage.route("**/*", handleRoute);
        await touchPage.goto("http://dashboard.local.invalid/app/etapas/agendamentos");
        const touchNavigation = touchPage.getByRole("navigation", { name: "Páginas do Dashboard" });
        await touchNavigation.getByRole("link", { name: "Agendamentos", exact: true }).tap();
        await expect(touchPage.locator("[data-dashboard-shell]")).toHaveAttribute(
          "data-collapsed",
          "true",
        );
        await expect(touchPage.locator("[data-dashboard-updated-at]")).toBeVisible();
        await touchNavigation.getByRole("link", { name: "Visitas", exact: true }).tap();
        await expect(touchPage).toHaveURL("http://dashboard.local.invalid/app/etapas/visitas");
        await expect(touchPage.locator("[data-dashboard-shell]")).toHaveCount(0);
      } finally {
        await touchContext.close();
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
