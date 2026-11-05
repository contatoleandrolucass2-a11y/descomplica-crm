import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import AxeBuilder from "@axe-core/playwright";

describe.runIf(process.env.CAIXA_BROWSER === "1")(
  "CAIXA units inline synthetic browser",
  { timeout: 60000 },
  () => {
    let browser: Browser;
    let page: Page;
    let script = "";
    let css = "";
    const unit = {
      id: "synthetic-caixa-1",
      businessUnit: "Riva",
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
      street: "Rua do Teste Fictício",
      streetNumber: "100",
      floor: 2,
      cashBackSlack: 6000,
      classification: "HIS2",
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
                return `import {createElement,useState,useRef} from 'react';import {createRoot} from 'react-dom/client';import '@/app/globals.css';import '@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css';import '@/app/(protected)/app/simulacao/_components/caixa.css';import {CaixaAvailableUnits} from '@/app/(protected)/app/simulacao/_components/CaixaAvailableUnits';import {calculateHousingSimulation} from '@/lib/crm/simulators/caixa';const input={income:6000,propertyValue:300000,birthDate:'1991-03-15',state:'SP',city:'São Paulo',term:420,product:'sbpe',system:'price',nominalRate:5,officialQuickEstimate:!new URLSearchParams(location.search).has('detailed'),propertyCondition:'new',inConstruction:true,asOf:new URLSearchParams(location.search).get('date')||'2026-11-04',ownFunds:0};const result=calculateHousingSimulation(input);function Fixture(){const [open,setOpen]=useState(false);const trigger=useRef(null);return createElement('div',null,createElement('button',{ref:trigger,onClick:()=>setOpen(true),'aria-expanded':open},'Unidades disponíveis'),createElement(CaixaAvailableUnits,{input,result,open,onClose:()=>{setOpen(false);trigger.current?.focus()}}))}createRoot(document.getElementById('root')).render(createElement(Fixture));`;
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
    async function open({
      failure = false,
      width = 1440,
      detailed = false,
      asOf = "2026-11-04",
    } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      page = await context.newPage();
      await page.clock.setFixedTime(new Date(`${asOf}T12:00:00-03:00`));
      const errors: string[] = [];
      const requests: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let fail = failure;
      await page.route("https://caixa-units.test/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/boravender-logo192.png" || path === "/salesforce-no-type-logo.svg")
          return route.fulfill({
            contentType: path.endsWith(".svg") ? "image/svg+xml" : "image/png",
            body: await readFile(resolve(`public${path}`)),
          });
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
      await page.goto(`https://caixa-units.test/?date=${asOf}${detailed ? "&detailed=1" : ""}`);
      await page.addStyleTag({ content: "#root { padding-top:780px }" });
      await browserExpect(
        page.getByRole("region", { name: "Unidades disponíveis", exact: true }),
      ).toHaveCount(0);
      const collapsedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.getByRole("button", { name: "Unidades disponíveis", exact: true }).click();
      await browserExpect(
        page.getByRole("region", { name: "Unidades disponíveis", exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(
        collapsedHeight,
      );
      return { errors, requests };
    }
    it("expands inline after click, requires ranking before live loading, filters approved units", async () => {
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
      ).toContainText("Qtd. de parcelas");
      await browserExpect(
        page.getByRole("region", { name: "Parâmetros de aprovação", exact: true }),
      ).toContainText("APROVADO");
      await browserExpect(
        page.getByRole("region", { name: "Parâmetros de aprovação", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
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
      await page.getByRole("button", { name: "Ocultar unidades", exact: true }).click();
      await browserExpect(
        page.getByRole("region", { name: "Unidades disponíveis", exact: true }),
      ).not.toBeVisible();
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
      const dialog = await page
        .getByRole("region", { name: "Unidades disponíveis", exact: true })
        .boundingBox();
      expect(dialog!.width).toBeLessThanOrEqual(390);
      expect(dialog!.x).toBeGreaterThanOrEqual(0);
      await browserExpect(page.getByRole("dialog")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
    it("never flashes an old approved list when reopening while fresh inventory is pending", async () => {
      const { errors } = await open();
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page.getByRole("button", { name: "Ocultar unidades", exact: true }).click();
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
      await page.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
      for (const theme of ["light", "balanced", "dark"]) {
        await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
        const audit = await new AxeBuilder({ page }).include("#caixa-available-units").analyze();
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
    it("preserves empty annual slots in December and revalidates edits and print actions", async () => {
      const { errors } = await open({ asOf: "2026-12-04" });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      const approval = page.getByRole("region", { name: "Parâmetros de aprovação", exact: true });
      await browserExpect(approval).toContainText("APROVADO");
      await page.getByRole("button", { name: "Inserir Anual", exact: true }).click();
      await browserExpect(
        page.getByRole("spinbutton", { name: "Valor da anual 1", exact: true }),
      ).toHaveValue("0");
      await browserExpect(
        page.getByRole("spinbutton", { name: "Valor da anual 2", exact: true }),
      ).toHaveValue("3000");
      await page.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
      await browserExpect(page.locator('[data-payment-kind="monthly"]')).toHaveCount(84);
      await page.getByRole("button", { name: "Inserir Sinal", exact: true }).click();
      await page.getByRole("spinbutton", { name: "Valor do sinal 1", exact: true }).fill("50000");
      await browserExpect(approval).toContainText("REVISE A PROPOSTA");
      await browserExpect(
        page.getByRole("table", { name: "84 mensais e anuais do fluxo aprovado", exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Imprimir linear", exact: true }),
      ).toBeDisabled();
      await page.getByRole("spinbutton", { name: "Valor do sinal 1", exact: true }).fill("0");
      await browserExpect(approval).toContainText("APROVADO");
      await page.getByRole("button", { name: "Inserir Desconto", exact: true }).click();
      await page.getByRole("spinbutton", { name: "Valor do desconto", exact: true }).fill("1000");
      await browserExpect(
        page.getByText("Não aplicado sem autorização.", { exact: true }),
      ).toBeVisible();
      await page.getByRole("checkbox", { name: "Desconto autorizado", exact: true }).check();
      await browserExpect(approval).toContainText("APROVADO");
      await page
        .getByRole("button", { name: "Proposta pronta - Bora Vender", exact: true })
        .click();
      await browserExpect(
        page.getByRole("region", { name: "Proposta pronta", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("complementary", { name: "Resumo financeiro da documentação", exact: true }),
      ).toContainText("Estimativa automática");
      await page
        .getByRole("button", { name: "Exibir parcelas da documentação", exact: true })
        .click();
      await browserExpect(
        page.getByRole("table", { name: "Cronograma mensal da documentação", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Doc Pessoa Física", exact: true }).click();
      await browserExpect(
        page.getByRole("region", { name: "Documentação Pessoa Física", exact: true }),
      ).toContainText("Dependentes e fator social");
      await page.evaluate(() => {
        window.print = () => window.dispatchEvent(new Event("caixa-print-called"));
      });
      await page.getByRole("button", { name: "Imprimir linear", exact: true }).click();
      await browserExpect(
        page.locator("body > article").filter({ hasText: "Proposta Associativo" }),
      ).toBeAttached();
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      expect(errors).toEqual([]);
    });
    it("captures the inline stock, property, commercial flow and documentation with synthetic data", async () => {
      await mkdir(resolve("private-data/caixa-inline-review"), { recursive: true });
      for (const width of [1280, 1920]) {
        await open({ width });
        await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
        await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
        await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
        await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
        await page
          .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
          .click();
        await browserExpect(
          page.getByRole("complementary", {
            name: "Resumo financeiro da documentação",
            exact: true,
          }),
        ).toContainText("Total da documentação");
        const filterHeight = await page
          .getByLabel("Incorporadora", { exact: true })
          .evaluate((el) => el.getBoundingClientRect().height);
        const rowHeight = await page
          .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
          .evaluate((el) => el.closest("tr")!.getBoundingClientRect().height);
        expect(filterHeight).toBe(36);
        expect(rowHeight).toBeLessThanOrEqual(40);

        await page
          .locator("#caixa-available-units")
          .screenshot({ path: resolve(`private-data/caixa-inline-review/units-${width}.png`) });
        await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
        await page.locator("#caixa-available-units").screenshot({
          path: resolve(`private-data/caixa-inline-review/units-${width}-dark.png`),
        });
        if (width === 1280) await page.context().close();
      }
    });
  },
);
