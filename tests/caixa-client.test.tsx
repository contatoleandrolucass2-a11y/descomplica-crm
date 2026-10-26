import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CaixaClient } from "@/app/(protected)/app/simulacao/_components/CaixaClient";

describe("CAIXA dedicated client", () => {
  it("preserves the reference form and makes unknown financial parameters explicit", () => {
    const markup = renderToStaticMarkup(<CaixaClient baseDate="2026-10-25" />);
    for (const label of [
      "Crédito habitacional",
      "Simulação CAIXA",
      "Cliente e imóvel",
      "Renda familiar bruta",
      "Prestação aprovada",
      "Valor do imóvel",
      "Recursos próprios",
      "Qnt de proponentes",
      "Data de nascimento",
      "Cidade",
      "Estado",
      "Prazo em meses",
      "Produto",
      "Sistema",
      "Tem 36+ meses de FGTS?",
      "Já recebeu subsídio?",
      "Tem Fator Social?",
      "Imóvel na planta?",
      "Calcular simulação",
      "Subsídio confirmado pela CAIXA",
      "Seguro MIP",
      "Seguro DFI",
      "Teto indicativo de renda",
      "Não substitui proposta bancária",
    ])
      expect(markup).toContain(label);
    expect(markup).not.toContain("Resumo financeiro");
    expect(markup).not.toContain("Cálculo temporariamente indisponível");
    expect(markup).toContain('href="https://simuladorhabitacao.caixa.gov.br/"');
  });

  it("keeps documents, diagnosis and utilities complete and locally scoped", () => {
    const documents = renderToStaticMarkup(
      <CaixaClient baseDate="2026-10-25" initialTab="documentos" />,
    );
    for (const label of [
      "Documentos necessários",
      "Fase 1",
      "Fase 2",
      "Tipo de vínculo / renda",
      "Vai usar o FGTS?",
      "Declara IR?",
      "Gerar documentos da Fase 1",
    ])
      expect(documents).toContain(label);
    const diagnosis = renderToStaticMarkup(
      <CaixaClient baseDate="2026-10-25" initialTab="diagnostico" />,
    );
    for (const label of [
      "Qual foi o resultado?",
      "Aprovado",
      "Condicionado",
      "Documentação pendente",
      "Reprovado",
      "não consulta cadastros",
    ])
      expect(diagnosis).toContain(label);
    const utilities = renderToStaticMarkup(
      <CaixaClient baseDate="2026-10-25" initialTab="utilitarios" />,
    );
    for (const label of [
      "Amortização",
      "Tempo de FGTS",
      "Saldo devedor atual",
      "Valor a amortizar",
      "Carregar última simulação",
    ])
      expect(utilities).toContain(label);
  });
});

describe.runIf(process.env.CAIXA_BROWSER === "1")(
  "CAIXA synthetic browser",
  { timeout: 90_000 },
  () => {
    let browser: Browser;
    let page: Page;
    let script: string;
    let css: string;
    const errors: string[] = [];
    beforeAll(async () => {
      const require = createRequire(import.meta.url);
      const vitestRequire = createRequire(require.resolve("vitest/package.json"));
      const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
      const entry = resolve("tests/caixa-memory.tsx").replaceAll("\\", "/");
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
            name: "caixa-fixture",
            resolveId(id: string) {
              if (id.endsWith("caixa-memory.tsx")) return entry;
            },
            load(id: string) {
              if (id === entry)
                return `import {createElement} from "react";import {createRoot} from "react-dom/client";import {CaixaClient} from "@/app/(protected)/app/simulacao/_components/CaixaClient";import "@/app/(protected)/app/simulacao/_components/caixa.css";createRoot(document.getElementById("root")).render(createElement(CaixaClient,{baseDate:"2026-10-25"}));`;
            },
          },
        ],
        build: { write: false, minify: false, lib: { entry, name: "CaixaQA", formats: ["iife"] } },
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
    }, 90_000);
    afterEach(async () => {
      await page?.context().close();
    });
    afterAll(async () => {
      await browser?.close();
    }, 60_000);
    async function open() {
      errors.length = 0;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("https://caixa.test/**", (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/fixture.js")
          return route.fulfill({ contentType: "text/javascript", body: script });
        if (url.pathname === "/fixture.css")
          return route.fulfill({ contentType: "text/css", body: css });
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>CAIXA QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0;font-family:Arial,sans-serif"><main id="root" class="caixa-page-shell"></main><script src="/fixture.js"></script></body></html>',
        });
      });
      await page.goto("https://caixa.test/");
      await browserExpect(
        page.getByRole("heading", { name: "Simulação CAIXA", exact: true }),
      ).toBeVisible();
    }
    async function fillMain() {
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("600000");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("30000000");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1991-03-15");
      await page.getByRole("combobox", { name: "Cidade *" }).fill("São Paulo");
      await page.getByRole("option", { name: "São Paulo SP", exact: true }).click();
      await page.getByText("Parâmetros confirmados e valores opcionais", { exact: true }).click();
      await page.getByLabel("Condição do imóvel", { exact: false }).selectOption("new");
    }
    it("calculates, invalidates stale output and preserves all reference tabs", async () => {
      await open();
      await fillMain();
      await page.getByRole("button", { name: "Calcular simulação", exact: true }).click();
      await browserExpect(
        page.getByRole("heading", { name: "Resumo financeiro", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("A confirmar · não incluído", { exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByText(/seguros não confirmados/).first()).toBeVisible();
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("700000");
      await browserExpect(
        page.getByRole("heading", { name: "Resumo financeiro", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "03 Documentos", exact: true }).click();
      await page.getByLabel("Tipo de vínculo / renda", { exact: false }).selectOption("clt");
      await page.getByRole("button", { name: "Gerar documentos da Fase 1", exact: true }).click();
      await browserExpect(page.getByText("Contracheques", { exact: true })).toBeVisible();
      await page
        .getByRole("button", { name: "Ir para Fase 2 — fechar venda", exact: true })
        .click();
      await browserExpect(
        page.getByText("Certidão de estado civil", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "04 Diagnóstico", exact: true }).click();
      await page.getByRole("button", { name: "Reprovado", exact: true }).click();
      await page.getByRole("button", { name: "Pontuação (rating)", exact: true }).click();
      await browserExpect(page.getByRole("heading", { name: /pontuação/i })).toBeVisible();
      await page.getByRole("button", { name: "+ Utilitários", exact: true }).click();
      await page.getByRole("button", { name: "Tempo de FGTS", exact: true }).click();
      await page.getByLabel("Data início", { exact: true }).fill("2020-01-01");
      await page.getByLabel("Data fim (vazio = atual)", { exact: true }).fill("2024-01-01");
      await page.getByRole("button", { name: "Calcular tempo de FGTS", exact: true }).click();
      await browserExpect(
        page.getByRole("heading", { name: "36 MESES ATINGIDOS NA ESTIMATIVA", exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
    it("has no horizontal overflow and passes axe in three themes on desktop and mobile", async () => {
      await open();
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((selected) => {
            document.documentElement.dataset.theme = selected;
          }, theme);
          await page.screenshot({path: resolve(directory, `caixa-${width}-${theme}.png`), fullPage:true});
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${width}/${theme}`,
          ).toBe(true);
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(
            axe.violations.map((violation) => ({
              id: violation.id,
              nodes: violation.nodes.map((node) => node.target),
            })),
            `${width}/${theme}`,
          ).toEqual([]);
          await page.screenshot({
            path: resolve(directory, `caixa-${width}-${theme}.png`),
            fullPage: true,
          });
        }
      }
      expect(errors).toEqual([]);
    });
  },
);
