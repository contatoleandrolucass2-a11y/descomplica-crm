import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CaixaClient } from "@/app/(protected)/app/simulacao/_components/CaixaClient";
import { CaixaArchive } from "@/app/(protected)/app/simulacao/_components/CaixaArchive";

type AxeAudit = Awaited<ReturnType<AxeBuilder["analyze"]>>;
function axeFailureDetails(violations: AxeAudit["violations"]) {
  return violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
      checks: [...node.any, ...node.all, ...node.none].map((check) => ({
        id: check.id,
        data: check.data,
      })),
    })),
  }));
}
function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${color}`);
    const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const first = luminance(foreground),
    second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("CAIXA dedicated client", () => {
  it("preserves the reference form and makes unknown financial parameters explicit", () => {
    const markup = renderToStaticMarkup(<CaixaArchive />);
    expect(markup.match(/<main\b/g)).toHaveLength(1);
    expect(markup).toContain('data-canvas-layout="caixa"');
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
      "Simular MCMV Classe Média (sem subsídio)",
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
                return `import {createElement} from "react";import {createRoot} from "react-dom/client";import "@/app/globals.css";import "@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css";import {CaixaArchive} from "@/app/(protected)/app/simulacao/_components/CaixaArchive";createRoot(document.getElementById("root")).render(createElement(CaixaArchive));`;
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
          body: '<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>CAIXA QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
        });
      });
      await page.goto("https://caixa.test/");
      await browserExpect(
        page.getByRole("heading", { name: "Simulação CAIXA", exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByRole("main")).toHaveCount(1);
      await browserExpect(page.locator('main[data-canvas-layout="caixa"]')).toHaveCount(1);
    }
    async function fillMain() {
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("600000");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("30000000");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1991-03-15");
      await page.getByRole("combobox", { name: "Cidade *" }).fill("São Paulo");
      await browserExpect(page.locator(".caixa-city-picker.open")).toBeVisible();
      await page.getByRole("option", { name: "São Paulo SP", exact: true }).click();
      await page.getByText("Parâmetros confirmados e valores opcionais", { exact: true }).click();
      await page.getByLabel("Condição do imóvel", { exact: false }).selectOption("new");
    }
    async function auditCurrentTab(name: string) {
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((selected) => {
            document.documentElement.dataset.theme = selected;
          }, theme);
          await page.screenshot({
            path: resolve(directory, `caixa-${name}-${width}-${theme}.png`),
            fullPage: true,
          });
          const dimensions = await page.evaluate(() => ({
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
            overflow: [...document.querySelectorAll("*")]
              .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 12)
              .map((element) => ({
                tag: element.tagName,
                class: element.className,
                width: element.getBoundingClientRect().width,
              })),
          }));
          expect(
            dimensions.scroll <= dimensions.width,
            `${name}/${width}/${theme}: ${JSON.stringify(dimensions)}`,
          ).toBe(true);
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(axeFailureDetails(axe.violations), `${name}/${width}/${theme}`).toEqual([]);
          if (name === "diagnostico") {
            const selected = await page
              .locator(".caixa-diagnosis-subfilters > .active")
              .evaluate((button) => {
                const style = getComputedStyle(button);
                return {
                  color: style.color,
                  background: style.backgroundColor,
                  transitions: style.transitionProperty.split(",").map((value) => value.trim()),
                };
              });
            expect(selected.color).toBe("rgb(255, 255, 255)");
            expect(selected.background).toBe("rgb(8, 117, 131)");
            expect(
              contrastRatio(selected.color, selected.background),
              JSON.stringify(selected),
            ).toBeGreaterThanOrEqual(4.5);
            expect(selected.transitions).not.toContain("color");
            expect(selected.transitions).not.toContain("background-color");
          }
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
      });
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
      await auditCurrentTab("resultado");
      await page
        .getByRole("checkbox", { name: "Simular MCMV Classe Média (sem subsídio)", exact: true })
        .check();
      await page.getByRole("button", { name: "Calcular simulação", exact: true }).click();
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "MCMV Classe Média",
      );
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
      await auditCurrentTab("documentos");
      await page.getByRole("button", { name: "04 Diagnóstico", exact: true }).click();
      await page.getByRole("button", { name: "Reprovado", exact: true }).click();
      await page.getByRole("button", { name: "Pontuação (rating)", exact: true }).click();
      await browserExpect(page.getByRole("heading", { name: /pontuação/i })).toBeVisible();
      await auditCurrentTab("diagnostico");
      await page.getByRole("button", { name: "+ Utilitários", exact: true }).click();
      await page.getByRole("button", { name: "Tempo de FGTS", exact: true }).click();
      await page.getByLabel("Data início", { exact: true }).fill("2020-01-01");
      await page.getByLabel("Data fim (vazio = atual)", { exact: true }).fill("2024-01-01");
      await page.getByRole("button", { name: "Calcular tempo de FGTS", exact: true }).click();
      await browserExpect(
        page.getByRole("heading", { name: "36 MESES ATINGIDOS NA ESTIMATIVA", exact: true }),
      ).toBeVisible();
      await browserExpect(page.locator(".caixa-fgts-result.eligible")).toBeVisible();
      await page
        .getByRole("button", { name: "Adicionar período de trabalho", exact: true })
        .click();
      await page.getByRole("button", { name: "Calcular tempo de FGTS", exact: true }).click();
      await browserExpect(
        page.getByRole("button", { name: "Remover", exact: true }).first(),
      ).toBeEnabled();
      await auditCurrentTab("utilitarios");
      expect(errors).toEqual([]);
    });
    it("has no horizontal overflow and passes axe in three themes on desktop and mobile", async () => {
      await open();
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [1440, 1024, 390, 320]) {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : width === 1024 ? 768 : 844,
        });
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((selected) => {
            document.documentElement.dataset.theme = selected;
          }, theme);
          await page.screenshot({
            path: resolve(directory, `caixa-${width}-${theme}.png`),
            fullPage: true,
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${width}/${theme}`,
          ).toBe(true);
          const formBounds = await page.locator("form.caixa-form").evaluate((form) => {
            const box = form.getBoundingClientRect();
            return Array.from(form.children).map((child) => {
              const bounds = child.getBoundingClientRect();
              return {
                class: child.className,
                contained: bounds.left >= box.left - 1 && bounds.right <= box.right + 1,
              };
            });
          });
          expect(
            formBounds.filter((child) => !child.contained),
            `${width}/${theme}`,
          ).toEqual([]);
          const clearBounds = await page
            .getByRole("button", { name: "Limpar", exact: true })
            .evaluate((button) => {
              const form = button.closest("form")!.getBoundingClientRect();
              const box = button.getBoundingClientRect();
              return box.left >= form.left && box.right <= form.right;
            });
          expect(clearBounds, `${width}/${theme}: Limpar stays inside the form`).toBe(true);
          const inactiveButtons = await page
            .locator('.caixa-toggle button[aria-pressed="false"]')
            .evaluateAll((buttons) =>
              buttons.map((button) => {
                const style = getComputedStyle(button);
                return {
                  color: style.color,
                  background: style.backgroundColor,
                  transitions: style.transitionProperty.split(",").map((value) => value.trim()),
                };
              }),
            );
          expect(inactiveButtons).toHaveLength(4);
          for (const inactive of inactiveButtons) {
            expect(inactive.color, `${width}/${theme}`).toBe(
              theme === "dark" ? "rgb(169, 191, 210)" : "rgb(64, 84, 108)",
            );
            expect(inactive.background, `${width}/${theme}`).toBe(
              theme === "dark" ? "rgb(16, 42, 66)" : "rgb(255, 255, 255)",
            );
            expect(
              contrastRatio(inactive.color, inactive.background),
              `${width}/${theme}: ${JSON.stringify(inactive)}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(inactive.transitions).not.toContain("color");
            expect(inactive.transitions).not.toContain("background-color");
          }
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(axeFailureDetails(axe.violations), `${width}/${theme}`).toEqual([]);
        }
      }
      expect(errors).toEqual([]);
    });
  },
);
