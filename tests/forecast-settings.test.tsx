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
import { createForecastDocument, getForecastGroups } from "@/lib/crm/forecast-grid";

describe("Previsão", () => {
  it("starts with seven comparison groups, two rows, totals and safe loading state", () => {
    const markup = renderToStaticMarkup(<ForecastSettings />);
    for (const label of [
      "Nome do corretor",
      "Previsão",
      "Realizado",
      "Empreendimento 7",
      "Total geral",
      "Inserir linha",
      "Inserir coluna",
      "Calendário",
      "Salvar",
      "Plano de ação",
    ])
      expect(markup).toContain(label);
    expect(markup).not.toContain("Acompanhe a previsão e o realizado da equipe.");
    expect(markup).not.toContain("Cada empreendimento reúne Previsão e Realizado.");
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
      options: {
        canEdit?: boolean;
        failLoad?: boolean;
        seed?: ForecastRecord;
        convertedLegacy?: boolean;
      } = {},
    ) {
      record = options.seed ?? null;
      canEdit = options.canEdit ?? true;
      failLoad = options.failLoad ?? false;
      conflict = false;
      puts = [];
      const context = await browser.newContext({ hasTouch: true });
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
        await browserExpect(page.locator('p[role="status"]')).toContainText(
          options.convertedLegacy ? "Alterações não salvas" : "Tabela compartilhada",
        );
    }

    async function expectHorizontalTableScroll(width: number) {
      const dimensions = await page
        .getByRole("region", { name: "Tabela de previsão", exact: true })
        .evaluate((element) => ({
          scroll: element.scrollWidth,
          client: element.clientWidth,
          overflowX: getComputedStyle(element).overflowX,
        }));
      expect(dimensions.overflowX, `viewport=${width}; ${JSON.stringify(dimensions)}`).toBe("auto");
      expect(dimensions.scroll, `viewport=${width}; ${JSON.stringify(dimensions)}`).toBeGreaterThan(
        dimensions.client,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }

    it("edits grouped comparisons, preserves rows during insertion and saves with CAS", async () => {
      await open();
      await page.setViewportSize({ width: 390, height: 844 });
      await expectHorizontalTableScroll(390);
      await browserExpect(
        page.getByLabel("Nome do empreendimento 7", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Nome do corretor, linha 1", { exact: true }).fill("Corretor QA");
      await page.getByLabel("Nome do corretor, linha 2", { exact: true }).fill("Corretor QA 2");
      await page.getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true }).fill("12");
      await page.getByLabel("Empreendimento 1 — Realizado, linha 1", { exact: true }).fill("8");
      await page.getByLabel("Empreendimento 2 — Previsão, linha 1", { exact: true }).fill("3");
      await page.getByLabel("Empreendimento 1 — Realizado, linha 2", { exact: true }).fill("7");
      const actionPlan = "Retomar contatos e revisar a abordagem comercial nesta semana.";
      const actionPlanInput = page.getByLabel("Plano de ação, linha 1", { exact: true });
      await actionPlanInput.fill(actionPlan);
      await browserExpect(actionPlanInput).toHaveAttribute("cols", "60");
      await browserExpect(page.getByLabel("Total, linha 1", { exact: true })).toHaveText("23");
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("30");
      await browserExpect(page.locator('tfoot output[aria-label="Total geral"]')).toHaveText("30");
      expect(
        await page
          .getByLabel("Nome do corretor, linha 1", { exact: true })
          .evaluate((element) => getComputedStyle(element).textAlign),
      ).toBe("right");
      await mkdir("test-results/forecast-preview", { recursive: true });
      await page.screenshot({ path: "test-results/forecast-preview/previsao-editavel-390.png" });
      await page.getByRole("button", { name: "Inserir coluna", exact: true }).tap();
      await browserExpect(
        page.getByLabel("Nome do empreendimento 8", { exact: true }),
      ).toBeFocused();
      await page.getByLabel("Nome do empreendimento 8", { exact: true }).fill("Residencial QA");
      await browserExpect(
        page.getByLabel("Residencial QA — Previsão, linha 2", { exact: true }),
      ).toHaveValue("");
      await browserExpect(
        page.getByLabel("Residencial QA — Realizado, linha 2", { exact: true }),
      ).toHaveValue("");
      await page.getByLabel("Residencial QA — Realizado, linha 2", { exact: true }).fill("0.25");
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("30,25");
      await page
        .getByRole("button", { name: "Mover Empreendimento 1 para a direita", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await browserExpect(page.getByLabel("Nome do empreendimento 1", { exact: true })).toHaveValue(
        "Empreendimento 2",
      );
      await browserExpect(page.getByLabel("Nome do empreendimento 2", { exact: true })).toHaveValue(
        "Empreendimento 1",
      );
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true }),
      ).toHaveValue("12");
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Realizado, linha 2", { exact: true }),
      ).toHaveValue("7");
      await expectHorizontalTableScroll(390);
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await browserExpect(page.locator('p[role="status"]')).toHaveText("Previsão salva no CRM.");
      expect(puts[0]?.expected_revision).toBe(0);
      const saved = puts[0]!;
      const groups = getForecastGroups(saved);
      expect(groups).toHaveLength(8);
      expect(groups[1]?.label).toBe("Empreendimento 1");
      expect(saved.rows[0]?.cells[groups[1]!.forecastId]).toBe("12");
      expect(saved.rows[1]?.cells[groups[7]!.actualId]).toBe("0.25");
      expect(saved.columns.at(-1)).toEqual({ id: "action_plan", label: "Plano de ação" });
      expect(saved.rows[0]?.cells.action_plan).toBe(actionPlan);
      await page.reload();
      await browserExpect(page.getByLabel("Nome do empreendimento 8", { exact: true })).toHaveValue(
        "Residencial QA",
      );
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("30,25");
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor QA");
      await browserExpect(page.getByLabel("Plano de ação, linha 1", { exact: true })).toHaveValue(
        actionPlan,
      );
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("button", { name: "Excluir linha 1", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor QA");
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir Residencial QA", exact: true }).click();
      await browserExpect(page.getByLabel("Nome do empreendimento 8", { exact: true })).toHaveCount(
        0,
      );
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("30");
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir linha 1", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor QA 2");
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("7");
      await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 2", { exact: true }),
      ).toBeFocused();
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Previsão, linha 2", { exact: true }),
      ).toHaveValue("");
    });

    it("drags the complete desktop group with both columns and every row value", async () => {
      const seed = createForecastDocument();
      const groups = getForecastGroups(seed);
      seed.rows[0]!.cells[groups[0]!.forecastId] = "12";
      seed.rows[0]!.cells[groups[0]!.actualId] = "8";
      seed.rows[1]!.cells[groups[0]!.forecastId] = "5";
      seed.rows[1]!.cells[groups[0]!.actualId] = "7";
      await open({ seed: { ...seed, revision: 2, updated_at: "2026-10-16T15:00:00Z" } });
      await page.setViewportSize({ width: 1440, height: 900 });
      const target = page
        .locator("thead th")
        .filter({ has: page.getByLabel("Nome do empreendimento 3", { exact: true }) });
      await page.getByTitle("Arrastar Empreendimento 1", { exact: true }).dragTo(target);
      await browserExpect(page.getByLabel("Nome do empreendimento 3", { exact: true })).toHaveValue(
        "Empreendimento 1",
      );
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true }),
      ).toHaveValue("12");
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Realizado, linha 1", { exact: true }),
      ).toHaveValue("8");
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Previsão, linha 2", { exact: true }),
      ).toHaveValue("5");
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Realizado, linha 2", { exact: true }),
      ).toHaveValue("7");
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("32");
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await browserExpect(page.locator('p[role="status"]')).toHaveText("Previsão salva no CRM.");
      expect(getForecastGroups(puts[0]!)[2]?.id).toBe(groups[0]!.id);
      expect(puts[0]!.rows).toEqual(seed.rows);
    });

    it("preserves drafts during conflicts and cancelled internal navigation", async () => {
      await open();
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
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).not.toHaveValue("Rascunho QA");
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

    it("shows only Thursday through Sunday as validated calendar days and restores focus", async () => {
      await open();
      const calendarButton = page.getByRole("button", { name: "Calendário", exact: true });
      await calendarButton.click();
      const dialog = page.getByRole("dialog", { name: "Dias validados estimados" });
      await browserExpect(dialog).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Fechar calendário" })).toBeFocused();

      await page.getByLabel("Mês do calendário").selectOption({ label: "Outubro" });
      await page.getByLabel("Ano do calendário").selectOption("2026");
      await browserExpect(dialog.getByText("19 dias validados", { exact: true })).toBeVisible();
      await browserExpect(dialog.getByRole("gridcell", { name: /dia validado$/ })).toHaveCount(19);
      await browserExpect(
        dialog.getByRole("gridcell", {
          name: "segunda-feira, 5 de outubro de 2026",
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect(
        dialog.getByRole("gridcell", {
          name: "quinta-feira, 1 de outubro de 2026, dia validado",
          exact: true,
        }),
      ).toBeVisible();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        await mkdir("test-results/forecast-preview", { recursive: true });
        await page.screenshot({
          path: `test-results/forecast-preview/previsao-calendario-${width}.png`,
          fullPage: true,
        });
      }

      await page.getByLabel("Mês do calendário").selectOption({ label: "Setembro" });
      await browserExpect(dialog.getByText("16 dias validados", { exact: true })).toBeVisible();
      await page.getByLabel("Mês do calendário").selectOption({ label: "Outubro" });
      await page.getByLabel("Ano do calendário").selectOption("2025");
      await browserExpect(dialog.getByText("18 dias validados", { exact: true })).toBeVisible();

      await page.keyboard.press("Escape");
      await browserExpect(dialog).toBeHidden();
      await browserExpect(calendarButton).toBeFocused();
    });

    it("supports read-only access, keyboard, three themes and mobile overflow", async () => {
      const seed = createForecastDocument();
      const groups = getForecastGroups(seed);
      seed.rows[0]!.cells.broker = "Corretor QA";
      seed.rows[0]!.cells[groups[0]!.forecastId] = "12";
      seed.rows[0]!.cells[groups[0]!.actualId] = "8";
      seed.rows[0]!.cells.action_plan = "Manter cadência sintética de acompanhamento.";
      await open({
        canEdit: false,
        seed: {
          ...seed,
          revision: 1,
          updated_at: "2026-10-16T15:00:00Z",
        },
      });
      await browserExpect(
        page.getByText("Você tem acesso somente à leitura desta previsão."),
      ).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
      expect(
        await page.getByLabel("Nome do empreendimento 1", { exact: true }).getAttribute("readonly"),
      ).not.toBeNull();
      await browserExpect(page.getByLabel("Plano de ação, linha 1", { exact: true })).toHaveValue(
        "Manter cadência sintética de acompanhamento.",
      );
      await browserExpect(
        page.getByLabel("Plano de ação, linha 1", { exact: true }),
      ).toHaveAttribute("readonly", "");
      const topLevelHeadings = await page
        .locator("thead tr")
        .first()
        .locator("th")
        .allTextContents();
      expect(topLevelHeadings.slice(-2).map((value) => value.trim())).toEqual([
        "Total",
        "Plano de ação",
      ]);
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate(
          (value) => (globalThis.document.documentElement.dataset.theme = value),
          theme,
        );
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await expectHorizontalTableScroll(width);
          await mkdir("test-results/forecast-preview", { recursive: true });
          await page.screenshot({
            path: `test-results/forecast-preview/previsao-${theme}-${width}.png`,
            fullPage: true,
          });
          if (theme === "light" && (width === 1440 || width === 390)) {
            const tableRegion = page.getByRole("region", {
              name: "Tabela de previsão",
              exact: true,
            });
            await tableRegion.evaluate((element) => {
              element.scrollLeft = element.scrollWidth;
            });
            const regionBox = await tableRegion.boundingBox();
            const actionHeadingBox = await page
              .getByRole("columnheader", { name: "Plano de ação", exact: true })
              .boundingBox();
            expect(regionBox).not.toBeNull();
            expect(actionHeadingBox).not.toBeNull();
            expect(actionHeadingBox!.x + actionHeadingBox!.width).toBeLessThanOrEqual(
              regionBox!.x + regionBox!.width + 1,
            );
            expect(actionHeadingBox!.x).toBeGreaterThanOrEqual(regionBox!.x - 1);
            await page.screenshot({
              path: `test-results/forecast-preview/previsao-total-plano-${width}.png`,
              fullPage: true,
            });
            await tableRegion.evaluate((element) => {
              element.scrollLeft = 0;
            });
          }
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

    it("rejects text in numeric cells and keeps eight groups usable at narrow widths", async () => {
      await open();
      await page.getByRole("button", { name: "Inserir coluna", exact: true }).click();
      const numeric = page.getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true });
      await numeric.focus();
      await page.keyboard.insertText("texto");
      await browserExpect(numeric).toHaveValue("");
      await numeric.fill("12");
      await page.keyboard.press("End");
      await page.keyboard.insertText("abc");
      await browserExpect(numeric).toHaveValue("12");
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expectHorizontalTableScroll(width);
        await browserExpect(
          page.getByLabel("Empreendimento 8 — Realizado, linha 2", { exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `test-results/forecast-preview/previsao-oito-grupos-${width}.png`,
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: "Mover Empreendimento 8 para a esquerda", exact: true })
        .tap();
      await browserExpect(page.getByLabel("Nome do empreendimento 7", { exact: true })).toHaveValue(
        "Empreendimento 8",
      );
    });

    it("preserves legacy text for correction without silently saving or dropping it", async () => {
      await open({
        convertedLegacy: true,
        seed: {
          title: "Legado QA",
          revision: 3,
          updated_at: "2026-10-16T15:00:00Z",
          columns: [
            { id: "broker", label: "Nome antigo personalizado" },
            { id: "forecast", label: "Previsão" },
            { id: "actual", label: "Realizado" },
          ],
          rows: [
            {
              id: "legacy",
              cells: { broker: "Corretor legado QA", forecast: "revisar", actual: "4" },
            },
          ],
        },
      });
      const legacy = page.getByLabel("Legado QA — Previsão, linha 1", { exact: true });
      await browserExpect(legacy).toHaveValue("revisar");
      await browserExpect(legacy).toHaveAttribute("aria-invalid", "true");
      await browserExpect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
      expect(puts).toHaveLength(0);
      await legacy.fill("6");
      await browserExpect(page.getByLabel("Total geral", { exact: true })).toHaveText("10");
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await browserExpect(page.locator('p[role="status"]')).toHaveText("Previsão salva no CRM.");
      expect(puts[0]?.expected_revision).toBe(3);
      await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 2", { exact: true }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Excluir linha 2", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toBeFocused();
    });
  },
);
