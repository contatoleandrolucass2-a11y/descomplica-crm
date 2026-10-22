import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ForecastSettings } from "@/app/(protected)/app/gestao/previsao/ForecastSettings";
import type { ForecastDocument, ForecastRecord, ForecastSource } from "@/lib/crm/forecasts";
import {
  addForecastGroup,
  createForecastDocument,
  getForecastGroups,
  renameForecastGroup,
} from "@/lib/crm/forecast-grid";

describe("Previsão", () => {
  it("starts with seven comparison groups, ten rows, totals and safe loading state", () => {
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
    expect(markup).toContain("Corretor 10");
    expect(markup.toLowerCase()).toContain("readonly");
  });
});

describe.runIf(process.env.FORECAST_SETTINGS_BROWSER === "1")(
  "Previsão no navegador sintético",
  { timeout: 60_000 },
  () => {
    let browser: Browser;
    let page: Page;
    let script: string;
    let css: string;
    let record: ForecastRecord | null;
    let canEdit: boolean;
    let failLoad: boolean;
    let conflict: boolean;
    let sections: ForecastSource[];
    let gets: string[];
    let puts: Array<
      ForecastDocument & {
        expected_revision: number;
        date: string;
        segment: "house" | "imob";
        manager: string;
      }
    >;

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
    }, 60_000);

    async function open(
      options: {
        canEdit?: boolean;
        failLoad?: boolean;
        seed?: ForecastRecord;
        convertedLegacy?: boolean;
        sections?: ForecastSource[];
        template?: ForecastDocument | null;
      } = {},
    ) {
      record = options.seed ?? null;
      canEdit = options.canEdit ?? true;
      failLoad = options.failLoad ?? false;
      conflict = false;
      puts = [];
      gets = [];
      sections = options.sections ?? [];
      const context = await browser.newContext({ hasTouch: true });
      page = await context.newPage();
      page.on("pageerror", (error) => console.error("Forecast fixture:", error.message));
      await page.route("https://forecast.test/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/api/forecasts") {
          if (route.request().method() === "GET") {
            gets.push(url.search);
            return route.fulfill({
              status: failLoad ? 503 : 200,
              json: failLoad
                ? { error: "forecast_unavailable" }
                : {
                    forecast:
                      url.searchParams.get("segment") === "general" || options.convertedLegacy
                        ? null
                        : record,
                    sections: url.searchParams.get("segment") === "general" ? sections : [],
                    template:
                      url.searchParams.get("segment") === "general"
                        ? (options.template ?? null)
                        : options.convertedLegacy && record
                          ? {
                              title: record.title,
                              columns: record.columns,
                              rows: record.rows.map((row) => ({
                                ...row,
                                cells: Object.fromEntries(
                                  Object.keys(row.cells).map((columnId) => [
                                    columnId,
                                    columnId === "broker" ? row.cells[columnId] : "",
                                  ]),
                                ),
                              })),
                            }
                          : null,
                    can_edit: url.searchParams.get("segment") === "general" ? false : canEdit,
                    period: { start: "2026-10-23", end: "2026-10-25" },
                    selection: {
                      segment: url.searchParams.get("segment"),
                      manager: url.searchParams.get("manager"),
                    },
                  },
            });
          }
          if (conflict) return route.fulfill({ status: 409, json: { error: "revision_conflict" } });
          const body = route.request().postDataJSON();
          puts.push(body);
          const { expected_revision } = body;
          const document = { title: body.title, columns: body.columns, rows: body.rows };
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
        await browserExpect(page.locator('p[role="status"]')).toContainText("Tabela compartilhada");
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
      expect(
        await page
          .getByLabel("Nome do corretor, linha 1", { exact: true })
          .evaluate((element) => getComputedStyle(element).height),
      ).toBe("22px");
      expect(
        await page
          .getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true })
          .evaluate((element) => getComputedStyle(element).height),
      ).toBe("22px");
      expect(await actionPlanInput.evaluate((element) => getComputedStyle(element).height)).toBe(
        "22px",
      );
      await browserExpect(page.getByLabel("Total Previsão, linha 1", { exact: true })).toHaveText(
        "15",
      );
      await browserExpect(page.getByLabel("Total Realizado, linha 1", { exact: true })).toHaveText(
        "8",
      );
      await browserExpect(page.getByLabel("Total geral — Previsão", { exact: true })).toHaveText(
        "15",
      );
      await browserExpect(page.getByLabel("Total geral — Realizado", { exact: true })).toHaveText(
        "15",
      );
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
      await browserExpect(page.getByLabel("Total geral — Realizado", { exact: true })).toHaveText(
        "15,25",
      );
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
      await browserExpect(page.getByLabel("Total geral — Realizado", { exact: true })).toHaveText(
        "15,25",
      );
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
      await browserExpect(page.getByLabel("Total geral — Realizado", { exact: true })).toHaveText(
        "15",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir linha 1", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor QA 2");
      await browserExpect(page.getByLabel("Total geral — Realizado", { exact: true })).toHaveText(
        "7",
      );
      await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 10", { exact: true }),
      ).toBeFocused();
      await browserExpect(
        page.getByLabel("Empreendimento 1 — Previsão, linha 10", { exact: true }),
      ).toHaveValue("");
    });

    it("keeps broker context sticky and highlights only the active coordinate", async () => {
      await open();
      await page.setViewportSize({ width: 720, height: 760 });
      const region = page.getByRole("region", { name: "Tabela de previsão", exact: true });
      const broker = page.getByLabel("Nome do corretor, linha 1", { exact: true });
      const footer = page.getByRole("rowheader", { name: "Total geral", exact: true });
      const before = await broker.boundingBox();
      const footerBefore = await footer.boundingBox();
      await region.evaluate((element) => {
        element.scrollLeft = 560;
      });
      const after = await broker.boundingBox();
      const footerAfter = await footer.boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1);
      expect(footerBefore).not.toBeNull();
      expect(footerAfter).not.toBeNull();
      expect(Math.abs(footerAfter!.x - footerBefore!.x)).toBeLessThanOrEqual(1);

      const forecast = page.getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true });
      const actual = page.getByLabel("Empreendimento 1 — Realizado, linha 1", { exact: true });
      await actual.focus();
      const actualHeader = page.locator("thead tr").nth(1).locator("th").nth(1);
      const forecastHeader = page.locator("thead tr").nth(1).locator("th").nth(0);
      const groupHeader = page.locator("thead tr").first().locator("th").nth(1);
      const [
        activeBackground,
        siblingBackground,
        brokerBackground,
        actualHeaderBackground,
        forecastHeaderBackground,
      ] = await Promise.all([
        actual.evaluate((element) => getComputedStyle(element.closest("td")!).backgroundColor),
        forecast.evaluate((element) => getComputedStyle(element.closest("td")!).backgroundColor),
        broker.evaluate((element) => getComputedStyle(element.closest("th")!).backgroundColor),
        actualHeader.evaluate((element) => getComputedStyle(element).backgroundColor),
        forecastHeader.evaluate((element) => getComputedStyle(element).backgroundColor),
      ]);
      expect(activeBackground).not.toBe(siblingBackground);
      expect(brokerBackground).not.toBe(siblingBackground);
      expect(actualHeaderBackground).not.toBe(forecastHeaderBackground);
      await browserExpect
        .poll(async () => {
          const [currentGroupBackground, currentActualBackground] = await Promise.all([
            groupHeader.evaluate((element) => getComputedStyle(element).backgroundColor),
            actualHeader.evaluate((element) => getComputedStyle(element).backgroundColor),
          ]);
          return currentGroupBackground === currentActualBackground;
        })
        .toBe(true);
      await browserExpect(
        page.getByLabel("Nome do empreendimento 1", { exact: true }),
      ).toBeVisible();
    });

    it("switches segment, manager and weekend without losing an unconfirmed draft", async () => {
      const grid = createForecastDocument();
      const saved = { ...grid, revision: 1, updated_at: "2026-10-20T12:00:00Z" };
      const imobGrid = createForecastDocument();
      const houseGroup = getForecastGroups(saved)[0]!;
      const imobGroup = getForecastGroups(imobGrid)[0]!;
      saved.rows[0]!.cells[houseGroup.forecastId] = "5";
      saved.rows[0]!.cells[houseGroup.actualId] = "2";
      imobGrid.rows[0]!.cells[imobGroup.forecastId] = "7";
      imobGrid.rows[0]!.cells[imobGroup.actualId] = "3";
      const imobSaved = {
        ...imobGrid,
        revision: 1,
        updated_at: "2026-10-20T12:00:00Z",
      };
      await open({
        seed: saved,
        sections: [
          { segment: "house", manager: "amanda", forecast: saved },
          { segment: "imob", manager: "alvaro", forecast: imobSaved },
        ],
      });
      await browserExpect(page.getByRole("button", { name: "House", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(
        await page
          .getByRole("group", { name: "Gerentes house" })
          .getByRole("button")
          .allTextContents(),
      ).toEqual(["Amanda", "Cleber", "Messias", "Sidnei", "Stephanie"]);

      await page
        .getByLabel("Nome do corretor, linha 1", { exact: true })
        .fill("Rascunho protegido");
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("button", { name: "Imob", exact: true }).click();
      await browserExpect(page.getByRole("button", { name: "House", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Rascunho protegido");

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Imob", exact: true }).click();
      await browserExpect(page.getByRole("button", { name: "Imob", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(
        await page
          .getByRole("group", { name: "Gerentes imob" })
          .getByRole("button")
          .allTextContents(),
      ).toEqual(["Álvaro", "Fabricio", "Gustavo", "Jonathan", "Richard", "Thiago", "Thiago TG"]);
      await page.getByRole("button", { name: "Gustavo", exact: true }).click();
      await browserExpect(
        page.getByRole("button", { name: "Gustavo", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await browserExpect.poll(() => gets.at(-1)).toContain("segment=imob&manager=gustavo");

      await page.getByRole("button", { name: "Geral", exact: true }).click();
      await browserExpect(
        page.getByRole("columnheader", { name: "Equipe Origem", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("rowheader", { name: "House", exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByRole("rowheader", { name: "Imob", exact: true })).toBeVisible();
      await browserExpect(page.getByLabel("Total Previsão, House", { exact: true })).toHaveText(
        "5",
      );
      await browserExpect(page.getByLabel("Total Realizado, House", { exact: true })).toHaveText(
        "2",
      );
      await browserExpect(page.getByLabel("Total Previsão, Imob", { exact: true })).toHaveText("7");
      await browserExpect(page.getByLabel("Total Realizado, Imob", { exact: true })).toHaveText(
        "3",
      );
      const generalTable = page.getByRole("region", { name: "Tabela de previsão geral" });
      await browserExpect(
        generalTable.getByLabel("Total geral — Previsão", { exact: true }),
      ).toHaveText("12");
      await browserExpect(
        generalTable.getByLabel("Total geral — Realizado", { exact: true }),
      ).toHaveText("5");
      await mkdir("test-results/forecast-preview", { recursive: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({
        path: "test-results/forecast-preview/previsao-geral-totais-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "test-results/forecast-preview/previsao-geral-totais-mobile.png",
        fullPage: true,
      });
      await browserExpect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Calendário", exact: true }).click();
      await page.getByLabel("Mês do calendário").selectOption({ label: "Outubro" });
      await page.getByLabel("Ano do calendário").selectOption("2026");
      const saturday = page.getByRole("gridcell", {
        name: "sábado, 3 de outubro de 2026, dia validado",
        exact: true,
      });
      await saturday.click();
      await browserExpect(
        page.getByRole("dialog", { name: "Dias validados estimados" }),
      ).toBeVisible();
      await browserExpect(saturday).toHaveAttribute("aria-selected", "true");
      await browserExpect(
        page.getByRole("heading", {
          name: "Previsão Final de semana dia 02/10/2026 até 04/10/2026",
        }),
      ).toBeVisible();
      await browserExpect.poll(() => gets.at(-1)).toContain("date=2026-10-03&segment=general");
    });

    it("shows the latest enterprise structure in General before the period has saves", async () => {
      let template = createForecastDocument(["Corretor de referência"]);
      const firstGroup = getForecastGroups(template)[0]!;
      template = renameForecastGroup(template, firstGroup.id, "Conquista Itaim Paulista");
      await open({ template });

      await page.getByRole("button", { name: "Geral", exact: true }).click();

      await browserExpect(
        page.getByRole("columnheader", { name: "Conquista Itaim Paulista", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("rowheader", { name: "House", exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByRole("rowheader", { name: "Imob", exact: true })).toBeVisible();
      await browserExpect(page.getByLabel("Total Previsão, House", { exact: true })).toHaveText(
        "0",
      );
      await browserExpect(page.getByLabel("Total Realizado, Imob", { exact: true })).toHaveText(
        "0",
      );
      await browserExpect(
        page.getByText("Nenhuma previsão salva para este final de semana.", { exact: true }),
      ).toHaveCount(0);
    });

    it("never labels the previous manager data as a failed new selection", async () => {
      const grid = createForecastDocument();
      grid.rows[0]!.cells.broker = "Dado exclusivo da Amanda";
      await open({
        seed: { ...grid, revision: 1, updated_at: "2026-10-20T12:00:00Z" },
      });
      const previousBroker = page.getByLabel("Nome do corretor, linha 1", { exact: true });
      await browserExpect(previousBroker).toHaveValue("Dado exclusivo da Amanda");
      failLoad = true;
      await page.getByRole("button", { name: "Cleber", exact: true }).click();
      await browserExpect(
        page.getByRole("button", { name: "Cleber", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await browserExpect(page.getByRole("alert")).toContainText("Não foi possível carregar");
      await browserExpect(previousBroker).toBeHidden();
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
      await browserExpect(page.getByLabel("Total geral — Previsão", { exact: true })).toHaveText(
        "17",
      );
      await browserExpect(page.getByLabel("Total geral — Realizado", { exact: true })).toHaveText(
        "15",
      );
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

    it("keeps the compact calendar open and validates only Friday through Sunday", async () => {
      await open();
      const calendarButton = page.getByRole("button", { name: "Calendário", exact: true });
      await calendarButton.click();
      const dialog = page.getByRole("dialog", { name: "Dias validados estimados" });
      await browserExpect(dialog).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Fechar calendário" })).toBeFocused();

      await page.getByLabel("Mês do calendário").selectOption({ label: "Outubro" });
      await page.getByLabel("Ano do calendário").selectOption("2026");
      await browserExpect(dialog.getByText("14 dias validados", { exact: true })).toBeVisible();
      await browserExpect(dialog.getByRole("gridcell", { name: /dia validado$/ })).toHaveCount(14);
      await browserExpect(
        dialog.getByRole("gridcell", {
          name: "segunda-feira, 5 de outubro de 2026",
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect(
        dialog.getByRole("gridcell", {
          name: "quinta-feira, 1 de outubro de 2026",
          exact: true,
        }),
      ).toBeVisible();
      const friday = dialog.getByRole("gridcell", {
        name: "sexta-feira, 2 de outubro de 2026, dia validado",
        exact: true,
      });
      await friday.click();
      await browserExpect(dialog).toBeVisible();
      const saturday = dialog.getByRole("gridcell", {
        name: "sábado, 3 de outubro de 2026, dia validado",
        exact: true,
      });
      await saturday.click();
      await browserExpect(dialog).toBeVisible();
      await browserExpect(saturday).toHaveAttribute("aria-selected", "true");
      await browserExpect(friday).toHaveAttribute("aria-selected", "false");
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        expect(box!.width).toBeLessThanOrEqual(400);
        await mkdir("test-results/forecast-preview", { recursive: true });
        await page.screenshot({
          path: `test-results/forecast-preview/previsao-calendario-${width}.png`,
          fullPage: true,
        });
      }

      await page.getByLabel("Mês do calendário").selectOption({ label: "Setembro" });
      await browserExpect(dialog.getByText("12 dias validados", { exact: true })).toBeVisible();
      await page.getByLabel("Mês do calendário").selectOption({ label: "Outubro" });
      await page.getByLabel("Ano do calendário").selectOption("2025");
      await browserExpect(dialog.getByText("13 dias validados", { exact: true })).toBeVisible();

      await page.keyboard.press("Escape");
      await browserExpect(dialog).toBeHidden();
      await browserExpect(calendarButton).toBeFocused();
    });

    it("supports read-only access, keyboard, three themes and mobile overflow", async () => {
      let seed = addForecastGroup(addForecastGroup(createForecastDocument()));
      const requestedLabels = [
        "Conquista Itaim Paulista",
        "Conquista São Miguel",
        "Terrasse Vila Ema",
        "Conquista Sacomã",
        "Alto Liviero",
        "Raiz home Clube",
        "Conquista Clube Butantã",
        "Mirante Jardim das Esmeraldas",
        "Empreendimentos Riva",
      ];
      getForecastGroups(seed).forEach((group, index) => {
        seed = renameForecastGroup(seed, group.id, requestedLabels[index]!);
      });
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
      await browserExpect(page.getByLabel("Nome do empreendimento 1", { exact: true })).toHaveValue(
        "Conquista\nItaim Paulista",
      );
      await browserExpect(page.getByLabel("Nome do empreendimento 9", { exact: true })).toHaveValue(
        "Empreendimentos\nRiva",
      );
      const groupWidths = await page
        .locator('thead th[scope="colgroup"]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().width),
        );
      expect(groupWidths).toHaveLength(10);
      expect(new Set(groupWidths.slice(0, 9).map((width) => Math.round(width))).size).toBe(1);
      expect(groupWidths[0]).toBeGreaterThanOrEqual(168);
      expect(groupWidths[0]).toBeLessThanOrEqual(170);
      expect(groupWidths[9]).toBeGreaterThanOrEqual(168);
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
      // Insertion schedules focus on the new group name in requestAnimationFrame.
      await browserExpect(
        page.getByLabel("Nome do empreendimento 8", { exact: true }),
      ).toBeFocused();
      const numeric = page.getByLabel("Empreendimento 1 — Previsão, linha 1", { exact: true });
      await numeric.focus();
      await browserExpect(numeric).toBeFocused();
      await page.keyboard.insertText("texto");
      await browserExpect(numeric).toHaveValue("");
      await numeric.fill("12");
      await page.keyboard.press("End");
      await page.keyboard.insertText("abc");
      await browserExpect(numeric).toHaveValue("12");
      const eighthHeading = page.getByLabel("Nome do empreendimento 8", { exact: true });
      await browserExpect(eighthHeading).toBeVisible();
      const eighthName = await eighthHeading.inputValue();
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expectHorizontalTableScroll(width);
        await browserExpect(
          page.getByLabel(`${eighthName} — Realizado, linha 2`, { exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `test-results/forecast-preview/previsao-oito-grupos-${width}.png`,
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: `Mover ${eighthName} para a esquerda`, exact: true })
        .tap();
      await browserExpect(page.getByLabel("Nome do empreendimento 7", { exact: true })).toHaveValue(
        eighthName,
      );
    });

    it("uses only the broker and titles from a previous-period template", async () => {
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
      await browserExpect(legacy).toHaveValue("");
      await browserExpect(legacy).not.toHaveAttribute("aria-invalid", "true");
      await browserExpect(
        page.getByLabel("Nome do corretor, linha 1", { exact: true }),
      ).toHaveValue("Corretor legado QA");
      await browserExpect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
      expect(puts).toHaveLength(0);
      await legacy.fill("6");
      await browserExpect(page.getByLabel("Total geral — Previsão", { exact: true })).toHaveText(
        "6",
      );
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await browserExpect(page.locator('p[role="status"]')).toHaveText("Previsão salva no CRM.");
      expect(puts[0]?.expected_revision).toBe(0);
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
