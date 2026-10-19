import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { expect, it } from "vitest";

it.runIf(process.env.DASHBOARD_FILTERS_BROWSER === "1").each([
  { device: "desktop", mode: "immediate", mobile: false, serverlike: false },
  { device: "desktop", mode: "pending", mobile: false, serverlike: true },
  { device: "mobile", mode: "immediate", mobile: true, serverlike: false },
  { device: "mobile", mode: "pending", mobile: true, serverlike: true },
])(
  "$device / $mode: dismisses dashboard filters without losing selections or keyboard focus",
  async ({ mobile, serverlike }) => {
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const root = resolve(".");
    const entry = resolve("tests/dashboard-filters-memory.tsx").replaceAll("\\", "/");
    const navigation = "\0dashboard-filters-navigation";
    const built = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      resolve: { alias: { "@": root } },
      oxc: { jsx: { runtime: "automatic", development: false } },
      plugins: [
        {
          name: "dashboard-filters-fixture",
          enforce: "pre",
          resolveId(id: string) {
            if (id.endsWith("dashboard-filters-memory.tsx")) return entry;
            if (id === "next/navigation") return navigation;
          },
          load(id: string) {
            if (id === navigation)
              return `
          export const useRouter = () => ({ replace: (url) => window.updateFilters(url) });
          export const useSearchParams = () => new URLSearchParams(window.filterQuery);
        `;
            if (id === entry)
              return `
          import { createElement, StrictMode, useState, startTransition } from "react";
          import { createRoot } from "react-dom/client";
          import { DashboardFilters } from "@/app/(protected)/app/_components/DashboardFilters";
          const options = { channel: ["Canal A", "Canal B", "Direcional", "SPC"], manager: ["Gerente A"], owner: ["Responsavel A"], company: ["-", "Empresa A"] };
          for (const key of Object.keys(options)) {
            options[key].push(...Array.from({ length: 500 }, (_, index) => key + " synthetic " + index));
          }
          function Fixture() {
            const [query, setQuery] = useState("keep=value&period=old");
            const [mounted, setMounted] = useState(true);
            const [dark, setDark] = useState(false);
            window.filterQuery = query;
            window.updateFilters = async (url) => {
              if (window.deferNavigation) await new Promise(resolve => { window.finishNavigation = resolve; });
              else if (window.serverlike) await new Promise(resolve => setTimeout(resolve, 250));
              startTransition(() => setQuery(url.split("?")[1]));
            };
            window.unmountFilters = () => setMounted(false);
            const params = new URLSearchParams(query);
            const values = Object.fromEntries(Object.keys(options).map(key => [key, params.getAll(key)]));
            return createElement("main", { "data-theme": dark ? "dark" : "light", style: { color: dark ? "#fff" : "#222", background: dark ? "#222" : "#fff" } },
              mounted && createElement(DashboardFilters, { values, options, available: true }),
              createElement("button", { id: "outside" }, "Outside"),
              createElement("div", { id: "outside-static" }, "Outside static"),
              createElement("button", { id: "theme", onClick: () => { setDark(!dark); document.documentElement.dataset.theme = dark ? "light" : "dark"; } }, "Theme"),
              createElement("output", null, query));
          }
          createRoot(document.getElementById("root")).render(createElement(StrictMode, null, createElement(Fixture)));
        `;
          },
        },
      ],
      build: { write: false, minify: false, lib: { entry, name: "FiltersQa", formats: ["iife"] } },
    });
    type BundleFile =
      | { type: "chunk"; code: string }
      | { type: "asset"; fileName: string; source: string | Uint8Array };
    const outputs = (Array.isArray(built) ? built : [built]) as Array<{ output: BundleFile[] }>;
    const files = outputs.flatMap((output) => output.output);
    const script = files.flatMap((file) => (file.type === "chunk" ? [file.code] : [])).join("\n");
    const css = files
      .flatMap((file) =>
        file.type === "asset" && file.fileName.endsWith(".css") ? [String(file.source)] : [],
      )
      .join("\n");
    const browser = await chromium.launch({
      ...(process.env.DASHBOARD_FILTERS_CHANNEL
        ? { channel: process.env.DASHBOARD_FILTERS_CHANNEL }
        : {}),
      headless: process.env.DASHBOARD_FILTERS_HEADED !== "1",
      args:
        process.env.DASHBOARD_FILTERS_ACCESSIBILITY === "1"
          ? ["--force-renderer-accessibility"]
          : [],
    });
    try {
      const context = await browser.newContext({
        viewport: { width: mobile ? 390 : 1440, height: 900 },
        hasTouch: mobile,
        isMobile: mobile,
      });
      const page = await context.newPage();
      await context.route("**/*", (route) => route.abort());
      page.setDefaultTimeout(10_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
      page.on("crash", () => errors.push("Browser page crashed"));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setContent(
        '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
      );
      await page.addStyleTag({ content: css });
      await page.addStyleTag({
        content:
          "#outside { margin-top: 400px; } :root { --analytics-surface: white; --analytics-line: #888; --analytics-muted: #555; --analytics-cyan-strong: #008f88; } :root[data-theme=dark] { --analytics-surface: #222; --analytics-muted: #bbb; }",
      });
      await page.evaluate((pending) => {
        Object.assign(window, { serverlike: pending });
      }, serverlike);
      await page.addScriptTag({ content: script });
      await page.waitForFunction(() => document.querySelector("button[aria-controls]") !== null);
      await browserExpect(page.locator("details, fieldset")).toHaveCount(0);
      expect(errors).toEqual([]);
      const triggers = page.locator("button[aria-controls]");
      const menus = page.locator("div:has(> button[aria-controls])");
      const channel = menus.nth(0);
      const manager = menus.nth(1);
      const trigger = channel.locator("button[aria-controls]");
      const outside = page.locator("#outside");
      // Dismiss with a checkbox focused, not only with the trigger focused.
      // Moving focus during pointerdown re-enters the document's focusin handler.
      for (let index = 0; index < 4; index++) {
        const menu = menus.nth(index);
        const summary = menu.locator("button[aria-controls]");
        await browserExpect(summary).toHaveAttribute(
          "aria-controls",
          `filter-panel-${["channel", "manager", "owner", "company"][index]}`,
        );
        await summary.click();
        await browserExpect(menu.getByRole("checkbox")).toHaveCount([504, 501, 501, 502][index]!);
        await menu.getByRole("checkbox").first().focus();
        await summary.evaluate((element) => {
          element.dataset.focusCalls = "0";
          const original = element.focus.bind(element);
          element.focus = (...args) => {
            element.dataset.focusCalls = String(Number(element.dataset.focusCalls) + 1);
            original(...args);
          };
        });
        if (mobile) await outside.tap();
        else await outside.click();
        await browserExpect(summary).toHaveAttribute("aria-expanded", "false");
        await browserExpect(menu.locator('[role="group"]')).toBeHidden();
        await browserExpect(outside).toBeFocused();
        await browserExpect(summary).toHaveAttribute("data-focus-calls", "0");
        await summary.click();
        await menu.getByRole("checkbox").first().focus();
        await page.keyboard.press("Escape");
        await browserExpect(summary).toHaveAttribute("aria-expanded", "false");
        await browserExpect(summary).toBeFocused();
        await summary.click();
        await menu.getByRole("checkbox").first().focus();
        await page.locator("#outside-static").click();
        await browserExpect(summary).toHaveAttribute("aria-expanded", "false");
        await summary.click();
        await menu.getByRole("checkbox").last().focus();
        await page.keyboard.press("Tab");
        await browserExpect(summary).toHaveAttribute("aria-expanded", "false");
        const next = index < 3 ? triggers.nth(index + 1) : outside;
        await browserExpect(next).toBeFocused();
        if (index < 3) {
          await page.keyboard.press("Enter");
          await browserExpect(triggers.nth(index + 1)).toHaveAttribute("aria-expanded", "true");
          await browserExpect(page.locator('button[aria-expanded="true"]')).toHaveCount(1);
          await page.keyboard.press("Escape");
        }
      }
      await browserExpect(page.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
      await trigger.focus();
      await page.keyboard.press("Enter");
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Tab");
      await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeFocused();
      await page.keyboard.press("Space");
      await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeChecked();
      await page.getByRole("checkbox", { name: "Canal B" }).click();
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "true");
      await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeChecked();
      await browserExpect(page.getByRole("checkbox", { name: "Canal B" })).toBeChecked();
      await browserExpect(page.locator("output")).toHaveText(
        "keep=value&channel=Canal+A&channel=Canal+B",
      );
      await page.keyboard.press("Escape");
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "false");
      await browserExpect(trigger).toBeFocused();
      await trigger.click();
      if (mobile) await outside.tap();
      else await outside.click();
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "false");
      await browserExpect(outside).toBeFocused();
      await trigger.click();
      if (mobile) {
        await manager.locator("button[aria-controls]").focus();
        await page.keyboard.press("Enter");
      } else {
        await manager.locator("button[aria-controls]").click();
      }
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "false");
      await browserExpect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true");
      await browserExpect(triggers.nth(1)).toBeFocused();
      if (mobile) {
        // The preceding trigger stays above the open panel and is reachable by touch.
        await trigger.tap();
        await browserExpect(triggers.nth(1)).toHaveAttribute("aria-expanded", "false");
        await browserExpect(trigger).toHaveAttribute("aria-expanded", "true");
        await browserExpect(page.locator('button[aria-expanded="true"]')).toHaveCount(1);
      }
      await page.keyboard.press("Escape");
      await trigger.click();
      await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeChecked();
      await page.getByRole("checkbox", { name: "Canal B" }).click();
      await browserExpect(page.getByRole("checkbox", { name: "Canal B" })).not.toBeChecked();
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "true");
      await browserExpect(page.locator("output")).toHaveText("keep=value&channel=Canal+A");
      await outside.focus();
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "false");
      // Click events without pointer/focus still enforce a single controlled panel.
      await trigger.dispatchEvent("click");
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "true");
      await triggers.nth(1).dispatchEvent("click");
      await browserExpect(trigger).toHaveAttribute("aria-expanded", "false");
      await browserExpect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true");
      await outside.click();
      const companyTrigger = triggers.nth(3);
      const company = page.locator("#filter-panel-company");
      const dash = company.getByRole("checkbox", { name: "-", exact: true });
      for (let cycle = 0; cycle < 8; cycle++) {
        await companyTrigger.focus();
        await page.keyboard.press(cycle % 2 ? "Space" : "Enter");
        await browserExpect(companyTrigger).toHaveAttribute("aria-expanded", "true");
        await page.evaluate(
          (defer) => Object.assign(window, { deferNavigation: defer }),
          serverlike,
        );
        await dash.click();
        if (serverlike) {
          await browserExpect(page.locator('[aria-busy="true"]')).toHaveCount(1);
          await browserExpect(dash).toBeDisabled();
        }
        await page.locator("#theme").click();
        await browserExpect(companyTrigger).toHaveAttribute("aria-expanded", "false");
        if (serverlike) {
          await page.evaluate("window.deferNavigation = false; window.finishNavigation()");
        }
        await browserExpect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await browserExpect(page.locator("main")).toHaveAttribute(
          "data-theme",
          cycle % 2 ? "light" : "dark",
        );
        await companyTrigger.click();
        await browserExpect(dash).toBeChecked();
        await dash.press("Space");
        await browserExpect(dash).not.toBeChecked();
        await browserExpect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await company.getByRole("checkbox").last().focus();
        await page.keyboard.press("Tab");
        await browserExpect(outside).toBeFocused();
        await browserExpect(companyTrigger).toHaveAttribute("aria-expanded", "false");
        await browserExpect(page.locator("output")).toHaveText("keep=value&channel=Canal+A");
        await trigger.click();
        for (const name of ["Direcional", "SPC"]) {
          const checkbox = channel.getByRole("checkbox", { name, exact: true });
          await checkbox.click();
          await browserExpect(checkbox).toBeChecked();
          await checkbox.press("Space");
          await browserExpect(checkbox).not.toBeChecked();
        }
        await page.keyboard.press("Escape");
        await browserExpect(trigger).toBeFocused();
        await browserExpect(page.locator("output")).toHaveText("keep=value&channel=Canal+A");
      }
      await page.evaluate("window.unmountFilters()");
      await browserExpect(menus).toHaveCount(0);
      await outside.click();
      await page.keyboard.press("Escape");
      await browserExpect(outside).toBeFocused();
      expect(errors).toEqual([]);
      await context.close();
    } finally {
      await browser.close();
    }
  },
  240_000,
);
