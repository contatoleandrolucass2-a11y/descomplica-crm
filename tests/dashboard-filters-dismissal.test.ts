import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
import { expect, it } from "vitest";

it.runIf(process.env.DASHBOARD_FILTERS_BROWSER === "1")(
  "dismisses dashboard filters without losing selections or keyboard focus",
  async () => {
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
          import { createElement, StrictMode, useState } from "react";
          import { createRoot } from "react-dom/client";
          import { DashboardFilters } from "@/app/(protected)/app/_components/DashboardFilters";
          const options = { channel: ["Canal A", "Canal B"], manager: ["Gerente A"], owner: [], company: [] };
          function Fixture() {
            const [query, setQuery] = useState("keep=value&period=old");
            const [mounted, setMounted] = useState(true);
            window.filterQuery = query;
            window.updateFilters = (url) => setQuery(url.split("?")[1]);
            window.unmountFilters = () => setMounted(false);
            const params = new URLSearchParams(query);
            const values = Object.fromEntries(Object.keys(options).map(key => [key, params.getAll(key)]));
            return createElement("main", null,
              mounted && createElement(DashboardFilters, { values, options, available: true }),
              createElement("button", { id: "outside" }, "Outside"),
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
    const browser = await chromium.launch({ headless: true });
    try {
      for (const mobile of [false, true]) {
        const context = await browser.newContext({
          viewport: { width: mobile ? 390 : 1440, height: 900 },
          hasTouch: mobile,
          isMobile: mobile,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10_000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
        await page.setContent(
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
        );
        await page.addStyleTag({ content: css });
        await page.addStyleTag({ content: "#outside { margin-top: 400px; }" });
        await page.addScriptTag({ content: script });
        await page.waitForFunction(() => document.querySelector("details") !== null);
        expect(errors).toEqual([]);
        const menus = page.locator("details");
        const channel = menus.nth(0);
        const manager = menus.nth(1);
        const trigger = channel.locator("summary");
        const outside = page.locator("#outside");
        await trigger.focus();
        await page.keyboard.press("Enter");
        await browserExpect(channel).toHaveAttribute("open", "");
        await page.keyboard.press("Tab");
        await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeFocused();
        await page.keyboard.press("Space");
        await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeChecked();
        await page.getByRole("checkbox", { name: "Canal B" }).click();
        await browserExpect(channel).toHaveAttribute("open", "");
        await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeChecked();
        await browserExpect(page.getByRole("checkbox", { name: "Canal B" })).toBeChecked();
        await browserExpect(page.locator("output")).toHaveText(
          "keep=value&channel=Canal+A&channel=Canal+B",
        );
        await page.keyboard.press("Escape");
        await browserExpect(channel).not.toHaveAttribute("open");
        await browserExpect(trigger).toBeFocused();
        await trigger.click();
        if (mobile) await outside.tap();
        else await outside.click();
        await browserExpect(channel).not.toHaveAttribute("open");
        await browserExpect(outside).toBeFocused();
        await trigger.click();
        if (mobile) {
          await manager.locator("summary").focus();
          await page.keyboard.press("Enter");
        } else {
          await manager.locator("summary").click();
        }
        await browserExpect(channel).not.toHaveAttribute("open");
        await browserExpect(manager).toHaveAttribute("open", "");
        await browserExpect(manager.locator("summary")).toBeFocused();
        await page.keyboard.press("Escape");
        await trigger.click();
        await browserExpect(page.getByRole("checkbox", { name: "Canal A" })).toBeChecked();
        await page.getByRole("checkbox", { name: "Canal B" }).click();
        await browserExpect(page.getByRole("checkbox", { name: "Canal B" })).not.toBeChecked();
        await browserExpect(channel).toHaveAttribute("open", "");
        await browserExpect(page.locator("output")).toHaveText("keep=value&channel=Canal+A");
        await outside.focus();
        await browserExpect(channel).not.toHaveAttribute("open");
        // Programmatic opening also exercises exclusivity without pointer/focus dismissal.
        await channel.evaluate((element: HTMLDetailsElement) => {
          element.open = true;
        });
        await browserExpect(channel).toHaveAttribute("open", "");
        await manager.evaluate((element: HTMLDetailsElement) => {
          element.open = true;
        });
        await browserExpect(channel).not.toHaveAttribute("open");
        await browserExpect(manager).toHaveAttribute("open", "");
        await page.evaluate("window.unmountFilters()");
        await browserExpect(menus).toHaveCount(0);
        await outside.click();
        await page.keyboard.press("Escape");
        await browserExpect(outside).toBeFocused();
        expect(errors).toEqual([]);
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
  120_000,
);
