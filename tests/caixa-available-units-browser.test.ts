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
                return `import {createElement,useState,useRef} from 'react';import {createRoot} from 'react-dom/client';import '@/app/globals.css';import '@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css';import '@/app/(protected)/app/simulacao/_components/caixa.css';import {CaixaAvailableUnits} from '@/app/(protected)/app/simulacao/_components/CaixaAvailableUnits';import {calculateHousingSimulation} from '@/lib/crm/simulators/caixa';const params=new URLSearchParams(location.search);const input={income:6000,propertyValue:300000,birthDate:'1991-03-15',state:'SP',city:'São Paulo',term:420,product:'sbpe',system:'price',nominalRate:5,officialQuickEstimate:!params.has('detailed'),propertyCondition:'new',inConstruction:true,asOf:params.get('date')||'2026-11-04',ownFunds:Number(params.get('ownFunds')||0),...(params.has('mcmv')?{income:4000,propertyValue:275000,birthDate:'1987-01-22',product:'mcmv',nominalRate:undefined,hasFgts36:true,previousSubsidy:false,singlePersonFamily:false,propertyType:'apartment',propertyArea:32}:{})};const result=calculateHousingSimulation(input);function Fixture(){const [open,setOpen]=useState(false);const trigger=useRef(null);return createElement('div',null,createElement('button',{ref:trigger,onClick:()=>setOpen(true),'aria-expanded':open},'Unidades disponíveis'),createElement(CaixaAvailableUnits,{input,result,open,onClose:()=>{setOpen(false);trigger.current?.focus()}}))}createRoot(document.getElementById('root')).render(createElement(Fixture));`;
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
      withoutGross = false,
      mcmvPrice = 0,
      mcmvAppraisal = mcmvPrice,
      ownFunds = 0,
      multipleUnits = false,
    }: {
      failure?: boolean;
      width?: number;
      detailed?: boolean;
      asOf?: string;
      withoutGross?: boolean;
      mcmvPrice?: number;
      mcmvAppraisal?: number;
      ownFunds?: number;
      multipleUnits?: boolean;
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
          const fixtureUnit = mcmvPrice
            ? {
                ...unit,
                finalWithKit: mcmvPrice,
                finalPrice: mcmvPrice,
                unitBonus: 0,
                tableSlack: 0,
                appraisal: mcmvAppraisal,
                privateArea: 25.77,
                completionDate: "2029-12-31",
                progress: 0.15,
              }
            : unit;
          const fallbackUnit = { ...fixtureUnit, finalWithKit: undefined };
          requests.push(path);
          if (path === "/api/inventory" && fail) {
            fail = false;
            return route.fulfill({ status: 503, body: "synthetic unavailable" });
          }
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              count: multipleUnits ? 2 : 1,
              items: multipleUnits
                ? [
                    fixtureUnit,
                    {
                      ...fixtureUnit,
                      id: "synthetic-caixa-2",
                      businessUnit: "Construtora B",
                      project: "Projeto B",
                      product: "Apartamento segundo",
                    },
                  ]
                : [withoutGross ? fallbackUnit : fixtureUnit],
              generatedAt: "2026-11-04T15:00:00Z",
            }),
          });
        }
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>Unidades CAIXA QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="font-family:Arial;margin:0"><main class="goal-page-shell caixa-page-shell"><h1>CAIXA QA</h1><div id="root"></div></main><script src="/fixture.js"></script></body></html>',
        });
      });
      await page.goto(
        `https://caixa-units.test/?date=${asOf}&ownFunds=${ownFunds}${detailed ? "&detailed=1" : ""}${mcmvPrice ? "&mcmv=1" : ""}`,
      );
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
    it("selects the entire row by mouse or keyboard and updates contextual filter totals", async () => {
      const { errors } = await open({ multipleUnits: true });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await browserExpect(page.getByRole("status")).toContainText("2 unidades dentro do ranking");
      const stock = page.getByRole("region", { name: "Estoque SPC", exact: true });
      await stock.getByRole("cell", { name: "Apartamento segundo", exact: true }).click();
      const row = stock.getByRole("row").filter({ hasText: "Apartamento segundo" });
      await browserExpect(row).toHaveAttribute("aria-selected", "true");
      await row.focus();
      await page.keyboard.press("Space");
      await browserExpect(row).toHaveAttribute("aria-selected", "false");
      await page.keyboard.press("Enter");
      await browserExpect(row).toHaveAttribute("aria-selected", "true");
      await stock.getByLabel("Incorporadora", { exact: true }).selectOption("Construtora B");
      await browserExpect(stock.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await browserExpect(
        stock.getByLabel("Nome do Empreendimento", { exact: true }),
      ).toContainText("Todos (1)");
      await browserExpect(
        stock.getByLabel("Nome do Empreendimento", { exact: true }),
      ).not.toContainText("Projeto fictício");
      await stock.getByLabel("Buscar unidade", { exact: true }).fill("inexistente");
      await browserExpect(
        stock.getByLabel("Nome do Empreendimento", { exact: true }),
      ).toContainText("Todos (0)");
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
    it.each([false, true])(
      "recalculates commercial funding after discount and invalidates stale quote, schedule and print (finalPrice-only=%s)",
      async (withoutGross) => {
        const { errors } = await open({ withoutGross });
        await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
        await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
        await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
        await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
        await page
          .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
          .click();
        const ledger = page.getByRole("region", { name: "Composição da proposta", exact: true });
        const approval = page.getByRole("region", { name: "Parâmetros de aprovação", exact: true });
        const fundingRow = ledger
          .getByRole("row")
          .filter({ has: page.getByRole("rowheader", { name: "Financiamento", exact: true }) });
        await browserExpect(fundingRow).toContainText("192.000,00");
        await page.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
        await page
          .getByRole("button", { name: "Proposta pronta - Bora Vender", exact: true })
          .click();
        await page.getByRole("button", { name: "Inserir Desconto", exact: true }).click();
        await page
          .getByRole("spinbutton", { name: "Valor do desconto", exact: true })
          .fill("10000");
        await browserExpect(approval).toContainText("REVISE A PROPOSTA");
        await browserExpect(fundingRow).toContainText("A recalcular");
        await browserExpect(
          page.getByRole("table", { name: "84 mensais e anuais do fluxo aprovado", exact: true }),
        ).toHaveCount(0);
        await browserExpect(
          page.getByRole("region", { name: "Proposta pronta", exact: true }),
        ).toHaveCount(0);
        await browserExpect(
          page.getByRole("button", { name: "Imprimir linear", exact: true }),
        ).toBeDisabled();
        await page.getByRole("checkbox", { name: "Desconto autorizado", exact: true }).check();
        await browserExpect(fundingRow).toContainText("192.000,00");
        await browserExpect(
          ledger.getByRole("row").filter({
            has: page.getByRole("rowheader", { name: "Valor real da venda", exact: true }),
          }),
        ).toContainText("219.000,00");
        await browserExpect(approval).toContainText("APROVADO");
        await browserExpect(
          page.getByRole("region", { name: "Proposta pronta", exact: true }),
        ).toContainText("192.000,00");
        await browserExpect(page.locator('[data-payment-kind="monthly"]')).toHaveCount(84);
        await page.evaluate(() => {
          window.print = () => {};
        });
        await page.getByRole("button", { name: "Imprimir linear", exact: true }).click();
        const printed = page.locator("body > article").filter({ hasText: "Proposta Associativo" });
        await browserExpect(printed).toContainText("192.000,00");
        await browserExpect(printed).toContainText("Cenário comercial");
        await browserExpect(printed).toContainText("compra real R$ 219.000,00");
        await browserExpect(printed).toContainText("base de financiamento R$ 240.000,00");
        await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
        await page
          .getByRole("spinbutton", { name: "Valor do desconto", exact: true })
          .fill("229000");
        await browserExpect(page.getByRole("alert")).toContainText("menor que o valor da venda");
        await browserExpect(fundingRow).toContainText("A recalcular");
        await browserExpect(
          page.getByRole("button", { name: "Imprimir", exact: true }),
        ).toBeDisabled();
        await browserExpect(
          page.getByRole("button", { name: "Exibir parcelas da documentação", exact: true }),
        ).toBeDisabled();
        expect(errors).toEqual([]);
      },
    );
    it("offers a unit with only Linear approved and never prints its rejected Decrescente flow", async () => {
      const { errors } = await open({ asOf: "2026-11-05", mcmvPrice: 260000 });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("gold");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      const approval = page.getByRole("region", { name: "Parâmetros de aprovação", exact: true });
      await browserExpect(approval).toContainText("1 FLUXO APROVADO");
      await browserExpect(approval).toContainText("Linear está dentro da regra selecionada.");
      await browserExpect(
        page.getByRole("button", { name: "Imprimir linear", exact: true }),
      ).toBeEnabled();
      await browserExpect(
        page.getByRole("button", { name: "Imprimir escalonado", exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Inserir Anual", exact: true }).click();
      for (let index = 1; index <= 4; index += 1)
        await browserExpect(
          page.getByRole("spinbutton", { name: `Valor da anual ${index}`, exact: true }),
        ).toHaveValue("2000");
      await page.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
      const schedule = page.getByRole("table", {
        name: "84 mensais e anuais do fluxo aprovado",
        exact: true,
      });
      await browserExpect(
        schedule.getByRole("columnheader", { name: "Decrescente · revisar", exact: true }),
      ).toBeVisible();
      await browserExpect(
        schedule.locator('[data-payment-kind="monthly"]').first().locator("td").nth(2),
      ).toHaveText("—");
      await page
        .getByRole("button", { name: "Proposta pronta - Bora Vender", exact: true })
        .click();
      await browserExpect(
        page.getByRole("region", { name: "Proposta pronta", exact: true }),
      ).toContainText("Linear APROVADO");
      await page.evaluate(() => {
        window.print = () => {};
      });
      await page.getByRole("button", { name: "Imprimir proposta", exact: true }).click();
      const printed = page.locator("body > article").filter({ hasText: "Proposta Associativo" });
      await browserExpect(
        printed.getByRole("heading", { level: 1, includeHidden: true }),
      ).toContainText("Linear");
      await page.getByRole("spinbutton", { name: "Valor da anual 1", exact: true }).fill("2000.01");
      await browserExpect(approval).toContainText("REVISE A PROPOSTA");
      await browserExpect(printed).toHaveCount(0);
      await browserExpect(schedule).toHaveCount(0);
      await browserExpect(
        page.getByRole("region", { name: "Proposta pronta", exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Imprimir linear", exact: true }),
      ).toBeDisabled();
      expect(errors).toEqual([]);
    });
    it("invalidates a stale Decrescente print when annual edits leave only Linear approved", async () => {
      const { errors } = await open({ asOf: "2026-11-05", mcmvPrice: 249000 });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("gold");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      const approval = page.getByRole("region", { name: "Parâmetros de aprovação", exact: true });
      await browserExpect(approval).toContainText(
        "Linear e Decrescente estão dentro da regra selecionada.",
      );
      await page.evaluate(() => {
        window.print = () => {};
      });
      await page.getByRole("button", { name: "Imprimir escalonado", exact: true }).click();
      const printed = page.locator("body > article").filter({ hasText: "Proposta Associativo" });
      await browserExpect(
        printed.getByRole("heading", { level: 1, includeHidden: true }),
      ).toContainText("Escalonado");
      await page.getByRole("button", { name: "Inserir Anual", exact: true }).click();
      await page.getByRole("spinbutton", { name: "Valor da anual 1", exact: true }).fill("0");
      await browserExpect(approval).toContainText("1 FLUXO APROVADO");
      await browserExpect(printed).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Imprimir linear", exact: true }),
      ).toBeEnabled();
      await browserExpect(
        page.getByRole("button", { name: "Imprimir escalonado", exact: true }),
      ).toBeDisabled();
      expect(errors).toEqual([]);
    });
    it("shows the optimized commercial basis separately from the real sale and appraisal", async () => {
      const { errors } = await open({
        asOf: "2026-11-05",
        mcmvPrice: 253790,
        mcmvAppraisal: 340000,
      });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("gold");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      const ledger = page.getByRole("region", { name: "Composição da proposta", exact: true });
      await browserExpect(ledger).toContainText("209.572,08");
      await browserExpect(ledger).toContainText("253.790,00");
      await browserExpect(ledger).toContainText("261.965,10");
      await browserExpect(ledger.getByText(/Cenário comercial/)).not.toBeVisible();
      await browserExpect(ledger.getByRole("row", { name: /^Financiamento/ })).not.toContainText(
        "Cenário comercial",
      );
      for (let index = 1; index <= 4; index++)
        await browserExpect(
          page.getByRole("spinbutton", { name: `Valor da anual ${index}`, exact: true }),
        ).toHaveValue("2000");
      expect(errors).toEqual([]);
    });
    it("keeps a fully covered commercial balance available without imaginary monthly or annual payments", async () => {
      const { errors } = await open({
        asOf: "2026-11-05",
        mcmvPrice: 253790,
        mcmvAppraisal: 340000,
        ownFunds: 45000,
      });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("gold");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      const proposal = page.getByRole("region", {
        name: "Fluxo de Apartamento teste",
        exact: true,
      });
      await browserExpect(proposal).toContainText("Saldo comercial quitado");
      await browserExpect(proposal).toContainText("206.691,00");
      await browserExpect(
        page.getByRole("button", { name: "Imprimir linear", exact: true }),
      ).toBeDisabled();
      await browserExpect(
        page.getByRole("button", { name: "Imprimir escalonado", exact: true }),
      ).toBeDisabled();
      await browserExpect(
        page.getByRole("button", { name: "Inserir Anual", exact: true }),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    });
    it("does not display a bank charge for a purchase entirely covered by own funds", async () => {
      const { errors } = await open({ ownFunds: 229000 });
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("gold");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(page.getByRole("status")).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento teste", exact: true })
        .click();
      const summary = page.getByRole("region", { name: "Saldo comercial quitado", exact: true });
      await browserExpect(summary).toContainText("sem financiamento bancário");
      await browserExpect(summary).not.toContainText("Parcela bancária inicial estimada");
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
        expect(rowHeight).toBeLessThanOrEqual(28);
        const selectedRow = page
          .getByRole("region", { name: "Estoque SPC", exact: true })
          .locator('tr[aria-selected="true"]');
        expect(await selectedRow.evaluate((el) => getComputedStyle(el).animationName)).not.toBe(
          "none",
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
        expect(await selectedRow.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
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
