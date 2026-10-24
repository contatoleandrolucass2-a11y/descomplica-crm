import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, expect as browserExpect } from "@playwright/test";
import { expect, it } from "vitest";

const rows = [
  {
    stage: "sales",
    date: "2026-10-13",
    channel: "DIRECIONAL VENDAS SPC",
    manager: "Gerente Alfa",
    owner: "Corretor Um",
    company: "Empresa Um",
    development: "Empreendimento Um",
    quantity: 2,
  },
  {
    stage: "sales",
    date: "2026-10-14",
    channel: "DIRECIONAL VENDAS SPC",
    manager: "Gerente Beta",
    owner: "Corretor Dois",
    company: "Empresa Dois",
    development: "Empreendimento Dois com nome longo e legível",
    quantity: 3,
  },
];

it.runIf(process.env.DASHBOARD_STAGE_DETAILS_BROWSER === "1")(
  "opens, filters and closes the stage detail dialog without horizontal page overflow in all themes",
  async () => {
    const require = createRequire(import.meta.url);
    const vitestRequire = createRequire(require.resolve("vitest/package.json"));
    const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
    const root = resolve(".");
    const entry = resolve("tests/dashboard-stage-details-memory.tsx").replaceAll("\\", "/");
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
          name: "dashboard-stage-details-fixture",
          resolveId(id: string) {
            if (id.endsWith("dashboard-stage-details-memory.tsx")) return entry;
          },
          load(id: string) {
            if (id !== entry) return;
            return `
              import { createElement } from "react";
              import { createRoot } from "react-dom/client";
              import "@/app/globals.css";
              import { DashboardStageDetailsProvider, DashboardStageDetailTrigger } from "@/app/(protected)/app/_components/DashboardStageDetails";
              const rows = ${JSON.stringify(rows)};
              createRoot(document.getElementById("root")).render(
                createElement(DashboardStageDetailsProvider, { rows },
                  createElement("div", { style: { position: "relative", width: "300px", height: "100px" } },
                    createElement(DashboardStageDetailTrigger, {
                      stage: "sales", stageLabel: "Vendas", cardLabel: "Mês atual",
                      period: { label: "Registros realizados no período", start: "2026-10-01", end: "2026-10-31" }
                    }),
                    createElement("span", null, "Vendas 5")
                  )
                )
              );`;
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry, name: "StageDetailsQa", formats: ["iife"] },
      },
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
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setContent(
        '<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
      );
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: script });
      const trigger = page.getByRole("button", { name: "Abrir detalhes de Vendas: Mês atual" });
      const dialog = page.getByRole("dialog");
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          await trigger.click();
          await browserExpect(dialog).toBeVisible();
          await browserExpect(dialog.getByText("5 registros no recorte")).toBeVisible();
          await dialog.getByLabel("Gerente de vendas").selectOption("Gerente Alfa");
          await browserExpect(dialog.getByText("2 registros no recorte")).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
          await page.keyboard.press("Escape");
          await browserExpect(dialog).not.toBeVisible();
          await browserExpect(trigger).toBeFocused();
        }
      }
      await trigger.click();
      await page.mouse.click(1, 1);
      await browserExpect(dialog).not.toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  180_000,
);
