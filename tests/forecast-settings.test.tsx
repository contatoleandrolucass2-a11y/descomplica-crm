import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ForecastSettings } from "@/app/(protected)/app/gestao/previsao/ForecastSettings";
import type { ForecastDocument, ForecastRecord } from "@/lib/crm/forecasts";

describe("Previsão", () => {
  it("starts with three requested columns, empty data and safe loading state", () => {
    const markup = renderToStaticMarkup(<ForecastSettings />);
    for (const label of [
      "Nome do corretor",
      "Previsão",
      "Realizado",
      "Nome da equipe",
      "Inserir linha",
      "Inserir coluna",
      "Salvar",
    ])
      expect(markup).toContain(label);
    expect(markup).not.toContain('type="number"');
    expect(markup).toContain("Aguardando carregamento.");
    expect(markup.toLowerCase()).toContain("readonly");
  });
});

describe.runIf(process.env.FORECAST_SETTINGS_BROWSER === "1")(
  "Previsão no navegador sintético",
  { timeout: 30_000 },
  () => {
    let browser: Browser;
    let page: Page;
    let script: string;
    let css: string;
    let record: ForecastRecord | null;
    let canEdit: boolean;
    let failLoad: boolean;
    let conflict: boolean;
    let puts: Array<ForecastDocument & { expected_revision: number }>;

    beforeAll(async () => {
      const require = createRequire(import.meta.url);
      const vitestRequire = createRequire(require.resolve("vitest/package.json"));
      const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
      const entry = resolve("tests/forecast-settings-memory.tsx").replaceAll("\\", "/");
      const built = await build({
        root: resolve("."),
        configFile: false,
        envFile: false,
        logLevel: "error",
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        resolve: { alias: { "@": resolve(".") } },
        oxc: { jsx: { runtime: "automatic", development: false } },
        plugins: [
          {
            name: "forecast-fixture",
            resolveId(id: string) {
              if (id.endsWith("forecast-settings-memory.tsx")) return entry;
            },
            load(id: string) {
              if (id === entry)
                return `import {createElement} from "react"; import {createRoot} from "react-dom/client"; import "@/app/globals.css"; import {ForecastSettings} from "@/app/(protected)/app/gestao/previsao/ForecastSettings"; createRoot(document.getElementById("root")).render(createElement(ForecastSettings));`;
            },
          },
        ],
        build: {
          write: false,
          minify: false,
          lib: { entry, name: "ForecastQA", formats: ["iife"] },
        },
      });
      const outputs = (Array.isArray(built) ? built : [built]) as Array<{
        output: Array<{ type: string; code?: string; fileName?: string; source?: unknown }>;
      }>;
      const files = outputs.flatMap((output) => output.output);
      script = files
        .filter((file) => file.type === "chunk")
        .map((file) => file.code)
        .join("\n");
      css = files
        .filter((file) => file.fileName?.endsWith(".css"))
        .map((file) => String(file.source))
        .join("\n");
      browser = await chromium.launch({ headless: true });
    }, 60_000);

    afterEach(async () => {
      await page?.context().close();
    });
    afterAll(async () => {
      await browser?.close();
    }, 30_000);

    async function open(
      options: { canEdit?: boolean; failLoad?: boolean; seed?: ForecastRecord } = {},
    ) {
      record = options.seed ?? null;
      canEdit = options.canEdit ?? true;
      failLoad = options.failLoad ?? false;
      conflict = false;
      puts = [];
    const context = await browser.newContext();
    page = await context.newPage();
      page.on("pageerror", (error) => console.error("Forecast fixture:", error.message));
      await page.route("https://forecast.test/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/api/forecasts") {
          if (route.request().method() === "GET")
            return route.fulfill({
              status: failLoad ? 503 : 200,
              json: failLoad
                ? { error: "forecast_unavailable" }
                : { forecast: record, can_edit: canEdit },
            });
          if (conflict) return route.fulfill({ status: 409, json: { error: "revision_conflict" } });
          const body = route.request().postDataJSON();
          puts.push(body);
          const { expected_revision, ...document } = body;
          record = {
            ...document,
            revision: expected_revision + 1,
            updated_at: "2026-10-16T15:00:00Z",
          };
          return route.fulfill({ json: record });
        }
        if (url.pathname === "/fixture.js")
          return route.fulfill({ contentType: "text/javascript", body: script });
        if (url.pathname === "/fixture.css")
          return route.fulfill({ contentType: "text/css", body: css });
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>Previsão QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0"><a href="/other">Outra página</a><div id="root"></div><script src="/fixture.js"></script></body></html>',
        });
      });
      await page.goto("https://forecast.test/");
      if (!failLoad)
        await browserExpect(page.getByRole("status")).toContainText("Tabela compartilhada");
    }

    it("edits shape and values, saves with CAS and restores shared data on reload", async () => {
      await open();
      await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toBeFocused();
      await page.getByLabel("Nome do corretor, linha 1", { exact: true }).fill("Corretor QA");
      await page.getByLabel("Previsão, linha 1", { exact: true }).fill("12");
      await page.getByLabel("Nome da equipe", { exact: true }).fill("Equipe QA");
      await page.getByRole("button", { name: "Inserir coluna", exact: true }).click();
      await browserExpect(page.getByLabel("Nome da coluna 4", { exact: true })).toBeFocused();
      await page.getByLabel("Nome da coluna 4", { exact: true }).fill("Observação");
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await browserExpect(page.getByRole("status")).toHaveText("Previsão salva no CRM.");
      expect(puts[0]?.expected_revision).toBe(0);
      expect(puts[0]?.rows[0]?.cells.forecast).toBe("12");
      await page.reload();
      await browserExpect(page.getByLabel("Nome da equipe", { exact: true })).toHaveValue(
        "Equipe QA",
      );
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor QA");
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("button", { name: "Excluir linha 1", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor QA");
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir coluna 4: Observação", exact: true }).click();
      await browserExpect(page.getByLabel("Nome da coluna 4", { exact: true })).toHaveCount(0);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir linha 1", exact: true }).click();
      await browserExpect(page.getByText("Nenhuma linha cadastrada.")).toBeVisible();
    });

    it("preserves drafts during conflicts and cancelled internal navigation", async () => {
      await open();
      await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
      await page.getByLabel("Nome do corretor, linha 1", { exact: true }).fill("Rascunho QA");
      expect(
        await page.evaluate(() => {
          const event = new Event("beforeunload", { cancelable: true });
          window.dispatchEvent(event);
          return event.defaultPrevented;
        }),
      ).toBe(true);
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("link", { name: "Outra página" }).click();
      expect(new URL(page.url()).pathname).toBe("/");
      conflict = true;
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await browserExpect(page.getByRole("alert")).toContainText("Seu rascunho foi preservado");
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Rascunho QA");
      await browserExpect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
      page.once("dialog", (dialog) => dialog.dismiss());
      await page
        .getByRole("button", { name: "Descartar rascunho e carregar versão salva" })
        .click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Rascunho QA");
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Descartar rascunho e carregar versão salva" })
        .click();
      await browserExpect(page.getByText("Nenhuma linha cadastrada.")).toBeVisible();
    });

    it("fails closed during load failure and retries", async () => {
      await open({ failLoad: true });
      await browserExpect(page.getByRole("alert")).toContainText("Não foi possível carregar");
      await browserExpect(
        page.getByRole("button", { name: "Inserir linha", exact: true }),
      ).toBeDisabled();
      failLoad = false;
      await page.getByRole("button", { name: "Tentar carregar novamente" }).click();
      await browserExpect(
        page.getByRole("button", { name: "Inserir linha", exact: true }),
      ).toBeEnabled();
    });

    it("supports read-only access, keyboard, three themes and mobile overflow", async () => {
      await open({
        canEdit: false,
        seed: {
          title: "Equipe QA",
          revision: 1,
          updated_at: "2026-10-16T15:00:00Z",
          columns: [
            { id: "broker", label: "Nome do corretor" },
            { id: "forecast", label: "Previsão" },
            { id: "actual", label: "Realizado" },
          ],
          rows: [{ id: "qa", cells: { broker: "Corretor QA", forecast: "12", actual: "8" } }],
        },
      });
      await browserExpect(
        page.getByText("Você tem acesso somente à leitura desta previsão."),
      ).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
      expect(
        await page.getByLabel("Nome da equipe", { exact: true }).getAttribute("readonly"),
      ).not.toBeNull();
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate(
          (value) => (globalThis.document.documentElement.dataset.theme = value),
          theme,
        );
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await mkdir("test-results/forecast-preview", { recursive: true });
          await page.screenshot({
            path: `test-results/forecast-preview/previsao-${theme}-${width}.png`,
          });
          expect(
            await page.evaluate(
              () => globalThis.document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
        }
        const results = await new AxeBuilder({ page })
          .include('section[aria-label="Previsão"]')
          .analyze();
        expect(results.violations).toEqual([]);
      }
      await page.getByRole("region", { name: "Tabela de previsão", exact: true }).focus();
      await browserExpect(
        page.getByRole("region", { name: "Tabela de previsão", exact: true }),
      ).toBeFocused();
    });
  },
);
