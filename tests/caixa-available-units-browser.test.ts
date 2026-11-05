import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import AxeBuilder from "@axe-core/playwright";

describe.runIf(process.env.CAIXA_BROWSER === "1")(
  "CAIXA units modal synthetic browser",
  { timeout: 60000 },
  () => {
    let browser: Browser;
    let page: Page;
    let script = "";
    let css = "";
    const unit = {
      id: "synthetic-caixa-1",
      businessUnit: "Incorporadora fictícia",
      project: "Projeto fictício",
      product: "Apartamento teste",
      status: "Disponível",
      identifier: "TEST-01",
      unitType: "Apartamento",
      finalWithKit: 240000,
      unitBonus: 10000,
      tableSlack: 1000,
      finalPrice: 229000,
      appraisal: 240000,
      city: "São Paulo",
      state: "SP",
      privateArea: 60,
      completionDate: "2030-04-30",
      progress: 0.2,
      constructionStatus: "Em obras",
      plant: "2Q",
      parkingSpaces: 1,
    };
    beforeAll(async () => {
      const require = createRequire(import.meta.url);
      const vitestRequire = createRequire(require.resolve("vitest/package.json"));
      const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
      const entry = resolve("tests/caixa-units-memory.tsx").replaceAll("\\", "/");
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
            name: "caixa-units-fixture",
            resolveId(id: string) {
              if (id.endsWith("caixa-units-memory.tsx")) return entry;
            },
            load(id: string) {
              if (id === entry)
                return `import {createElement} from 'react';import {createRoot} from 'react-dom/client';import '@/app/globals.css';import '@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css';import '@/app/(protected)/app/simulacao/_components/caixa.css';import {CaixaAvailableUnits} from '@/app/(protected)/app/simulacao/_components/CaixaAvailableUnits';import {calculateHousingSimulation} from '@/lib/crm/simulators/caixa';const input={income:6000,propertyValue:300000,birthDate:'1991-03-15',state:'SP',city:'São Paulo',term:420,product:'sbpe',system:'price',nominalRate:5,officialQuickEstimate:!new URLSearchParams(location.search).has('detailed'),propertyCondition:'new',inConstruction:true,asOf:'2026-11-04',ownFunds:0};const result=calculateHousingSimulation(input);createRoot(document.getElementById('root')).render(createElement(CaixaAvailableUnits,{input,result}));`;
            },
          },
        ],
        build: {
          write: false,
          minify: false,
          lib: { entry, name: "CaixaUnitsQA", formats: ["iife"] },
        },
      });
      const output = (Array.isArray(built) ? built : [built]) as Array<{
        output: Array<{ type: string; code?: string; fileName?: string; source?: unknown }>;
      }>;
      const files = output.flatMap((o) => o.output);
      script = files
        .filter((f) => f.type === "chunk")
        .map((f) => f.code)
        .join("\n");
      css = files
        .filter((f) => f.fileName?.endsWith(".css"))
        .map((f) => String(f.source))
        .join("\n");
      browser = await chromium.launch({ headless: true });
    }, 90000);
    afterEach(async () => {
      await page?.context().close();
    });
    afterAll(async () => {
      await browser?.close();
    });
    async function open({ failure = false, width = 1440, detailed = false } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-03:00"));
      const errors: string[] = [];
      const requests: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let fail = failure;
      await page.route("https://caixa-units.test/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/fixture.js")
          return route.fulfill({ contentType: "text/javascript", body: script });
        if (path === "/fixture.css") return route.fulfill({ contentType: "text/css", body: css });
        if (path.startsWith("/api/inventory")) {
          requests.push(path);
          if (path === "/api/inventory" && fail) {
            fail = false;
            return route.fulfill({ status: 503, body: "synthetic unavailable" });
          }
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ count: 1, items: [unit], generatedAt: "2026-11-04T15:00:00Z" }),
          });
        }
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>Unidades CAIXA QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="font-family:Arial;margin:0"><main class="goal-page-shell caixa-page-shell"><h1>CAIXA QA</h1><div id="root"></div></main><script src="/fixture.js"></script></body></html>',
        });
      });
      await page.goto(`https://caixa-units.test/${detailed ? "?detailed=1" : ""}`);
      await page.getByRole("button", { name: "Unidades disponíveis", exact: true }).click();
      await browserExpect(page.getByRole("dialog")).toBeVisible();
      return { errors, requests };
    }
    it("requires ranking before live loading, shows only approved units, filters and restores focus", async () => {
      const { errors, requests } = await open();
      expect(requests).toEqual([]);
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      expect(requests).toContain("/api/inventory");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      await browserExpect(
        page.getByRole("region", { name: "Fluxo de Apartamento teste", exact: true }),
      ).toContainText("84 mensais");
      await browserExpect(
        page.getByText("Dentro do ranking: Linear e Decrescente.", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("heading", { name: "Parâmetros de aprovação", exact: true }),
      ).toBeVisible();
      await page.getByText("Exibir 84 parcelas e anuais", { exact: true }).click();
      await browserExpect(
        page.getByRole("table", { name: "84 mensais e anuais do fluxo aprovado", exact: true }),
      ).toBeVisible();
      await browserExpect(page.locator('[data-payment-kind="monthly"]')).toHaveCount(84);
      await page.getByLabel("Buscar unidade", { exact: true }).fill("nãoexiste");
      await browserExpect(
        page.getByText("Nenhuma unidade atende a este perfil e aos filtros selecionados.", {
          exact: true,
        }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("not-eligible");
      await browserExpect(
        page.getByText("Nenhuma unidade elegível para esta classificação.", { exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByRole("table")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await browserExpect(page.getByRole("dialog")).not.toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Unidades disponíveis", exact: true }),
      ).toBeFocused();
      expect(errors).toEqual([]);
    });
    it("recovers from live inventory failure without snapshot availability, and fits mobile", async () => {
      const { errors } = await open({ failure: true, width: 390 });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("alert")).toContainText(
        "Nenhuma disponibilidade anterior foi utilizada",
      );
      await browserExpect(page.getByRole("table")).toHaveCount(0);
      await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const dialog = await page.getByRole("dialog").boundingBox();
      expect(dialog!.width).toBeLessThanOrEqual(390);
      expect(Math.abs(dialog!.x + dialog!.width / 2 - 195)).toBeLessThan(9);
      expect(errors).toEqual([]);
    });
    it("never flashes an old approved list when reopening while fresh inventory is pending", async () => {
      const { errors } = await open();
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page.getByRole("button", { name: "Fechar", exact: true }).click();
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("https://caixa-units.test/api/inventory", async (route) => {
        await pending;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ count: 1, items: [unit] }),
        });
      });
      await page.getByRole("button", { name: "Unidades disponíveis", exact: true }).click();
      await browserExpect(page.getByRole("status")).toContainText("Conferindo unidades");
      await browserExpect(page.getByRole("table")).toHaveCount(0);
      release();
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      expect(errors).toEqual([]);
    });
    it("explains nontransferable proposal insurance without requesting inventory", async () => {
      const { requests } = await open({ detailed: true });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText(
        "seguros específicos de cada imóvel",
      );
      expect(requests).toEqual([]);
      await browserExpect(page.getByRole("table")).toHaveCount(0);
    });
    it("keeps the approved table and detail accessible across the three themes", async () => {
      await open();
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      await page.getByText("Exibir 84 parcelas e anuais", { exact: true }).click();
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
        const audit = await new AxeBuilder({ page }).include("dialog").analyze();
        expect(
          audit.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          })),
        ).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    });
  },
);
