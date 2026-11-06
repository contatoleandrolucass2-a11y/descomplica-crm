import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
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
      "Simulador CAIXA",
      "Renda familiar bruta",
      "Limite de parcela (30%)",
      "Prestação aprovada",
      "Valor do imóvel",
      "Recursos próprios",
      "Quantidade de proponentes",
      "Data de nascimento",
      "Cidade",
      "Estado",
      "Prazo em meses",
      "Produto",
      "Sistema",
      "Tem 36+ meses de FGTS?",
      "Já recebeu subsídio?",
      "Tem fator social? (informativo)",
      "Imóvel na planta?",
      "Condição do imóvel",
      "Limite aplicável",
      "Avaliação confirmada pela CAIXA",
      "Desconto complemento FGTS confirmado",
      "Aporte MCMV Cidades confirmado",
      "Cota aprovada pela CAIXA",
      "Seguro MIP",
      "Seguro DFI",
      "Simulador Associativo",
      "Calcular documentação",
      "Simulação CAIXA",
      "Tabela Direta",
      "Tabela Investidor",
      "Tabelão",
    ])
      expect(markup).toContain(label);
    expect(markup).not.toContain("Resumo financeiro");
    expect(markup).not.toContain("Cálculo temporariamente indisponível");
    expect(markup).not.toContain("Limite municipal confirmado do imóvel");
    expect(markup).not.toContain("Teto indicativo de renda (%)");
    expect(markup).not.toContain("Calcular simulação");
    expect(markup).not.toContain("Acesso liberado para todos os perfis autorizados");
    expect(markup).not.toContain("Preencha os campos obrigatórios");
    expect(markup).not.toContain("Não substitui proposta bancária");
    expect(markup).not.toContain('href="https://simuladorhabitacao.caixa.gov.br/"');
    expect(markup).toContain('aria-label="01 Documentos"');
    expect(markup).toContain('aria-label="02 Diagnóstico"');
    expect(markup).toContain('aria-label="03 Utilitários"');
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
      await page.clock.setFixedTime(new Date("2026-10-25T12:00:00-03:00"));
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
      await browserExpect(page.locator(".caixa-tool-sidebar a.active")).toContainText(
        "Simulação CAIXA",
      );
      await browserExpect(page.getByRole("main")).toHaveCount(1);
      await browserExpect(page.locator('main[data-canvas-layout="caixa"]')).toHaveCount(1);
    }
    async function resizeViewport(width: number, height: number) {
      await page.setViewportSize({ width, height });
      // ResizeObserver updates the responsive canvas in a later rendering turn.
      // Measure only after the visible canvas matches the new workspace width.
      await browserExpect
        .poll(
          async () =>
            page.evaluate(() => {
              const workspace = document.querySelector<HTMLElement>(".caixa-workspace")!;
              const surface = document.querySelector<HTMLElement>(".caixa-content-surface")!;
              const actual = parseFloat(
                getComputedStyle(surface).getPropertyValue("--caixa-content-width"),
              );
              return Math.abs(actual - Math.max(1, workspace.clientWidth - 44)) < 1;
            }),
          { message: "Responsive canvas settles before measuring controls" },
        )
        .toBe(true);
    }
    async function fillMain() {
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("600000");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("30000000");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1991-03-15");
      await page.getByRole("combobox", { name: "Cidade *" }).fill("São Paulo");
      await browserExpect(page.locator(".caixa-city-picker.open")).toBeVisible();
      await page.getByRole("option", { name: "São Paulo SP", exact: true }).click();
    }
    it("keeps all twenty-one controls legible in a complete desktop input screen", async () => {
      await open();
      await fillMain();
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("400000");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("27500000");
      await page.getByLabel("Tipo da unidade *", { exact: false }).selectOption("apartment");
      await page.getByLabel("Área oficial da unidade", { exact: false }).fill("60.07");
      await page.getByLabel("Possui dependentes?", { exact: false }).selectOption("yes");
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [1200, 1280, 1440, 1920]) {
        await resizeViewport(width, 900);
        for (const expanded of [false, true]) {
          if (expanded) await page.locator(".caixa-tool-sidebar").hover();
          else await page.getByRole("heading", { name: "Simulador CAIXA", exact: true }).hover();
          const layout = await page.evaluate(() => {
            const fields = [...document.querySelectorAll(".caixa-full-form .caixa-field")].filter(
              (element) => element.getBoundingClientRect().width > 0,
            );
            const zoom =
              Number(getComputedStyle(document.querySelector(".caixa-content-surface")!).zoom) || 1;
            return {
              fields: fields.map((field) => {
                const control = field.querySelector("input, select, button")!;
                const bounds = control.getBoundingClientRect();
                const style = getComputedStyle(control);
                const group = field.getBoundingClientRect();
                const contained = [
                  ...field.querySelectorAll(
                    ":scope > span, :scope > small, input, select, .caixa-toggle",
                  ),
                ].every((element) => {
                  const rect = element.getBoundingClientRect();
                  return (
                    rect.left >= group.left - 0.5 &&
                    rect.right <= group.right + 0.5 &&
                    rect.top >= group.top - 0.5 &&
                    rect.bottom <= group.bottom + 0.5
                  );
                });
                return {
                  label: field.querySelector("span")?.textContent,
                  top: Math.round(field.getBoundingClientRect().top),
                  height: bounds.height / zoom,
                  groupHeight: group.height / zoom,
                  background: style.backgroundColor,
                  select: control.tagName === "SELECT",
                  border: parseFloat(
                    getComputedStyle(
                      field.querySelector(
                        ".caixa-toggle-card, .caixa-city-picker, .caixa-field-control > *",
                      )!,
                    ).borderTopWidth,
                  ),
                  titleOutside:
                    field.querySelector(":scope > span")!.getBoundingClientRect().bottom <=
                    field
                      .querySelector(
                        ".caixa-toggle-card, .caixa-city-picker, .caixa-field-control",
                      )!
                      .getBoundingClientRect().top +
                      0.5,
                  hintsOutside: [...field.querySelectorAll(":scope > small")].every(
                    (hint) =>
                      hint.getBoundingClientRect().top >=
                      field
                        .querySelector(
                          ".caixa-toggle-card, .caixa-city-picker, .caixa-field-control",
                        )!
                        .getBoundingClientRect().bottom -
                        0.5,
                  ),
                  contained,
                };
              }),
              buttons: [...document.querySelectorAll(".caixa-toggle button")].map((button) => {
                const style = getComputedStyle(button);
                return {
                  pressed: button.getAttribute("aria-pressed"),
                  borderWidth: parseFloat(style.borderTopWidth),
                  borderStyle: style.borderTopStyle,
                  borderColor: style.borderTopColor,
                  height: button.getBoundingClientRect().height / zoom,
                };
              }),
              rows: new Set(fields.map((field) => Math.round(field.getBoundingClientRect().top)))
                .size,
              overflow: document.documentElement.scrollWidth > innerWidth,
              parametersAfterTools: !!(
                document
                  .querySelector(".caixa-tabs-bottom")!
                  .compareDocumentPosition(document.querySelector(".caixa-confirmed-parameters")!) &
                Node.DOCUMENT_POSITION_FOLLOWING
              ),
            };
          });
          await page.screenshot({
            path: resolve(directory, `caixa-complete-${width}-${expanded}.png`),
          });
          await writeFile(
            resolve(directory, `caixa-complete-${width}-${expanded}.json`),
            JSON.stringify(layout, null, 2),
          );
          const context = `${width}/${expanded}`;
          expect(layout.fields, `${context}: includes the three subsidy fields`).toHaveLength(21);
          expect(layout.rows, `${context}: four readable groups of controls`).toBe(4);
          const screen = await page.evaluate(() => ({
            lastField: Math.max(
              ...[...document.querySelectorAll(".caixa-full-form .caixa-field")].map(
                (el) => el.getBoundingClientRect().bottom,
              ),
            ),
            resultTop: document.querySelector("#caixa-simulation-result")!.getBoundingClientRect()
              .top,
            height: innerHeight,
          }));
          expect(screen.lastField).toBeLessThan(screen.height);
          expect(screen.resultTop).toBeGreaterThanOrEqual(screen.lastField);
          expect(layout.overflow, `${context}: no horizontal overflow`).toBe(false);
          expect(
            layout.parametersAfterTools,
            `${context}: optional parameters at the page end`,
          ).toBe(true);
          for (const field of layout.fields) {
            expect(field.border, `${context}: input border ${field.label}`).toBeGreaterThan(0);
            expect(
              field.contained,
              `${context}: label, answer and context inside ${field.label}`,
            ).toBe(true);
            expect(field.height, `${context}: compact ${field.label}`).toBeLessThanOrEqual(36.5);
            expect(field.height, `${context}: readable ${field.label}`).toBeGreaterThanOrEqual(
              27.5,
            );
            expect(field.titleOutside, `${context}: title above input ${field.label}`).toBe(true);
            expect(field.hintsOutside, `${context}: guidance below input ${field.label}`).toBe(
              true,
            );
            if (field.select)
              expect(field.background, `${context}: transparent ${field.label}`).toBe(
                "rgba(0, 0, 0, 0)",
              );
          }
          expect(layout.buttons.filter((button) => button.pressed === "true")).toHaveLength(4);
          expect(layout.buttons.filter((button) => button.pressed === "false")).toHaveLength(4);
          for (const button of layout.buttons) {
            expect(button.borderWidth, `${context}: visible border in both states`).toBeGreaterThan(
              0,
            );
            expect(button.borderStyle).toBe("solid");
            expect(button.borderColor).not.toBe("rgba(0, 0, 0, 0)");
            expect(button.height, `${context}: compact choices`).toBeLessThanOrEqual(36.5);
          }
        }
      }
      for (const width of [1280, 1920]) {
        await resizeViewport(width, 900);
        await page.getByRole("heading", { name: "Simulador CAIXA", exact: true }).hover();
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
          await page.screenshot({
            animations: "disabled",
            path: resolve(directory, `caixa-grouped-${width}-${theme}.png`),
          });
        }
      }
      await resizeViewport(390, 844);
      await page.screenshot({
        animations: "disabled",
        path: resolve(directory, "caixa-grouped-390-dark.png"),
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await resizeViewport(1440, 900);
      await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
      await page.getByRole("heading", { name: "Simulador CAIXA", exact: true }).hover();
      await browserExpect(page.locator(".caixa-workspace")).toHaveAttribute(
        "data-sidebar-collapsed",
        "true",
      );
      const result = page.locator("#caixa-simulation-result");
      await browserExpect(result.getByRole("button", { name: "Copiar", exact: true })).toHaveCount(
        0,
      );
      await browserExpect(result.getByRole("link", { name: "WhatsApp", exact: true })).toHaveCount(
        0,
      );
      await browserExpect(
        result.getByRole("button", { name: "Salvar na sessão", exact: true }),
      ).toHaveCount(0);
      await browserExpect(result.locator(".caixa-result-rate")).toContainText(
        "Perfil informado · Juros:",
      );
      const audit = result.locator(".caixa-result-audit:not(.caixa-construction-details)");
      await browserExpect(audit).not.toHaveAttribute("open", "");
      await browserExpect(
        audit.getByRole("heading", { name: "Calculadora rápida oficial", exact: true }),
      ).not.toBeVisible();
      await audit.getByText("Auditoria do cálculo", { exact: true }).click();
      await browserExpect(audit).toHaveAttribute("open", "");
      await browserExpect(
        audit.getByRole("heading", { name: "Calculadora rápida oficial", exact: true }),
      ).toBeVisible();
      await browserExpect(audit).toContainText("não calcula subsídio");
      await browserExpect(audit).toContainText("60.07 m²");
      await page.getByLabel("Área oficial da unidade", { exact: false }).fill("50");
      await page.getByLabel("Possui dependentes?", { exact: false }).selectOption("no");
      // The reduced automatic complement is below 1500; the full CAIXA simulator
      // suppresses it after the unipersonal reducer (observed on 2026-11-05).
      const subsidyRow = result.locator(".caixa-result-composition dl > div").filter({
        has: page.locator("dt", { hasText: /^Subsídio$/ }),
      });
      await browserExpect(subsidyRow.locator("dd")).toHaveText("R$ 0,00");
      await browserExpect(result.getByRole("alert")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
    it("expands ranked units below the financial summary in the page flow", async () => {
      await open();
      await browserExpect(
        page.getByRole("button", { name: "Unidades disponíveis", exact: true }),
      ).toHaveCount(0);
      await fillMain();
      const unit = {
        id: "synthetic-caixa-summary-unit",
        businessUnit: "Incorporadora fictícia",
        project: "Projeto fictício",
        product: "Apartamento integrado",
        status: "Disponível",
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
      await page.route("**/api/inventory**", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ count: 1, items: [unit] }),
        }),
      );
      await page.getByRole("button", { name: "Unidades disponíveis", exact: true }).click();
      const region = page.getByRole("region", { name: "Unidades disponíveis", exact: true });
      await browserExpect(region).toBeVisible();
      await browserExpect(page.getByRole("dialog")).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Unidades disponíveis", exact: true }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(
        await region.evaluate(
          (element) =>
            !!(
              document.querySelector("#caixa-simulation-result")!.compareDocumentPosition(element) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
      ).toBe(true);
      expect(await region.evaluate((element) => getComputedStyle(element).position)).not.toBe(
        "fixed",
      );
      await page.getByLabel("Ranking do cliente", { exact: true }).selectOption("diamond");
      await page.getByLabel("Primeiro imóvel?", { exact: true }).selectOption("yes");
      await browserExpect(region).toContainText("1 unidade dentro do ranking");
      await page
        .getByRole("button", { name: "Exibir fluxo de Apartamento integrado", exact: true })
        .click();
      await region.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
      await browserExpect(
        region
          .getByRole("table", { name: "84 mensais e anuais do fluxo aprovado", exact: true })
          .locator("tbody tr"),
      ).toHaveCount(84);
      await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
      const audit = await new AxeBuilder({ page }).include("#caixa-available-units").analyze();
      expect(axeFailureDetails(audit.violations)).toEqual([]);
      await resizeViewport(390, 844);
      const mobileBounds = await region.boundingBox();
      expect(mobileBounds!.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByRole("button", { name: "Unidades disponíveis", exact: true }).click();
      await browserExpect(region).not.toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Unidades disponíveis", exact: true }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Unidades disponíveis", exact: true }).click();
      await browserExpect(region).toBeVisible();
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("");
      await browserExpect(region).toHaveCount(0);
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("600000");
      await browserExpect(
        page.getByRole("button", { name: "Unidades disponíveis", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      await browserExpect(region).toHaveCount(0);
      expect(errors).toEqual([]);
    });
    it("keeps short choice labels unbroken with the protected-shell typography", async () => {
      await open();
      await page.addStyleTag({
        content: ".caixa-page-shell{letter-spacing:.05em;font-weight:700}",
      });
      for (const width of [320, 375, 390, 1200, 1280, 1440]) {
        await resizeViewport(width, 900);
        const choices = await page
          .locator(".caixa-full-form .caixa-toggle button")
          .evaluateAll((buttons) =>
            buttons.map((button) => {
              const style = getComputedStyle(button);
              const range = document.createRange();
              range.selectNodeContents(button);
              return {
                text: button.textContent,
                lines: range.getClientRects().length,
                whiteSpace: style.whiteSpace,
                fits: button.scrollWidth <= button.clientWidth,
              };
            }),
          );
        expect(choices).toHaveLength(8);
        if (width === 320) {
          const date = await page.locator('.caixa-full-form input[type="date"]').boundingBox();
          expect(date!.width, "complete date including the calendar target").toBeGreaterThan(190);
          const choicesContained = await page
            .locator(".caixa-full-form .caixa-toggle button")
            .evaluateAll((buttons) =>
              buttons.every((button) => {
                const control = button.getBoundingClientRect();
                const field = button.closest(".caixa-field")!.getBoundingClientRect();
                return control.left >= field.left && control.right <= field.right;
              }),
            );
          expect(choicesContained).toBe(true);
          await page.screenshot({
            fullPage: true,
            animations: "disabled",
            path: resolve("private-data/caixa-qa/caixa-320-contained.png"),
          });
        }
        for (const choice of choices) {
          expect(choice.lines, `${width}: ${choice.text}`).toBe(1);
          expect(choice.whiteSpace).toBe("nowrap");
          expect(choice.fits).toBe(true);
        }
        if (width >= 1200) {
          const label = await page.locator(".caixa-participants-field>span").evaluate((span) => ({
            nowrap: getComputedStyle(span).whiteSpace,
            fits: span.scrollWidth <= span.clientWidth,
            font: getComputedStyle(span).fontSize,
            width: span.clientWidth,
            scroll: span.scrollWidth,
          }));
          expect(label.nowrap).toBe("nowrap");
          expect(label.fits, `${width}: ${JSON.stringify(label)}`).toBe(true);
        }
      }
      expect(errors).toEqual([]);
    });
    it("wraps full choice legends inside their outlined groups across breakpoints", async () => {
      await open();
      await page.addStyleTag({
        content:
          ".caixa-page-shell{letter-spacing:1px;font-weight:700}.caixa-page-shell .caixa-full-form .caixa-field>span{letter-spacing:1px!important;font-weight:700}",
      });
      await page.evaluate(() => document.fonts.ready);
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [375, 390, 768, 1024, 1200]) {
        await resizeViewport(width, 1100);
        for (const theme of ["light", "dark"]) {
          await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
          const groups = await page
            .locator(".caixa-full-form .caixa-fgts-choice")
            .evaluateAll((fields) =>
              fields.map((field) => {
                const group = field.getBoundingClientRect();
                const label = field.querySelector(":scope > span")!;
                const range = document.createRange();
                range.selectNodeContents(label);
                const texts = [...range.getClientRects()];
                const controls = [...field.querySelectorAll("button")].map((button) => {
                  const text = document.createRange();
                  text.selectNodeContents(button);
                  return {
                    rect: button.getBoundingClientRect().toJSON(),
                    lines: text.getClientRects().length,
                    whiteSpace: getComputedStyle(button).whiteSpace,
                  };
                });
                return {
                  label: label.textContent,
                  border: parseFloat(
                    getComputedStyle(
                      field.querySelector(
                        ".caixa-toggle-card, .caixa-city-picker, .caixa-field-control > *",
                      )!,
                    ).borderTopWidth,
                  ),
                  titleOutside:
                    field.querySelector(":scope > span")!.getBoundingClientRect().bottom <=
                    field
                      .querySelector(
                        ".caixa-toggle-card, .caixa-city-picker, .caixa-field-control",
                      )!
                      .getBoundingClientRect().top +
                      0.5,
                  hintsOutside: [...field.querySelectorAll(":scope > small")].every(
                    (hint) =>
                      hint.getBoundingClientRect().top >=
                      field
                        .querySelector(
                          ".caixa-toggle-card, .caixa-city-picker, .caixa-field-control",
                        )!
                        .getBoundingClientRect().bottom -
                        0.5,
                  ),
                  wrap: getComputedStyle(label).whiteSpace,
                  font: getComputedStyle(label).fontSize,
                  letterSpacing: getComputedStyle(label).letterSpacing,
                  overflowRight: Math.max(...texts.map((rect) => rect.right)) - group.right,
                  contained: texts.every(
                    (rect) =>
                      rect.left >= group.left &&
                      rect.right <= group.right &&
                      rect.top >= group.top &&
                      rect.bottom <= group.bottom,
                  ),
                  controlsInside: controls.every(
                    ({ rect }) =>
                      rect.x >= group.x &&
                      rect.right <= group.right &&
                      rect.y >= group.y &&
                      rect.bottom <= group.bottom,
                  ),
                  controls,
                };
              }),
            );
          await page.screenshot({
            animations: "disabled",
            fullPage: true,
            path: resolve(directory, `caixa-mobile-groups-${width}-${theme}.png`),
          });
          await writeFile(
            resolve(directory, `caixa-mobile-groups-${width}-${theme}.json`),
            JSON.stringify(groups, null, 2),
          );
          expect(groups).toHaveLength(4);
          for (const group of groups) {
            expect(group.border).toBeGreaterThan(0);
            expect(group.wrap, `${width}/${theme}: ${group.label}`).toBe("normal");
            expect(parseFloat(group.font)).toBeGreaterThanOrEqual(11);
            expect(group.letterSpacing).toBe("1px");
            expect(group.contained, `${width}/${theme}: full label ${group.label}`).toBe(true);
            expect(group.controlsInside, `${width}/${theme}: controls ${group.label}`).toBe(true);
            for (const control of group.controls) {
              expect(control.lines).toBe(1);
              expect(control.whiteSpace).toBe("nowrap");
            }
          }
        }
      }
      expect(errors).toEqual([]);
    });
    it("fits maximum currency values in readable desktop groups", async () => {
      await open();
      await fillMain();
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const input of await page
        .locator(".caixa-primary-grid .caixa-money-input input")
        .all()) {
        await input.fill("999999999");
        await browserExpect(input).toHaveValue("9.999.999,99");
      }
      for (const width of [1200, 1280, 1440, 1920]) {
        await resizeViewport(width, 900);
        for (const expanded of [false, true]) {
          if (expanded) await page.locator(".caixa-tool-sidebar").hover();
          else await page.getByRole("heading", { name: "Simulador CAIXA", exact: true }).hover();
          const layout = await page.evaluate(() => {
            const controls = [
              ...document.querySelectorAll(
                ".caixa-full-form input, .caixa-full-form select, .caixa-full-form .caixa-toggle",
              ),
            ].filter(
              (element) => !element.closest(".caixa-confirmed-parameters, .caixa-subsidy-inputs"),
            );
            const currency = [
              ...document.querySelectorAll<HTMLInputElement>(
                ".caixa-primary-grid .caixa-money-input input",
              ),
            ].map((input) => {
              const style = getComputedStyle(input);
              const context = document.createElement("canvas").getContext("2d")!;
              context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
              return {
                text: context.measureText(input.value).width,
                space:
                  input.clientWidth -
                  parseFloat(style.paddingLeft) -
                  parseFloat(style.paddingRight),
              };
            });
            return {
              fieldTops: controls.map((element) => ({
                name:
                  element.getAttribute("aria-label") ??
                  element.closest(".caixa-field")?.querySelector("span")?.textContent,
                top: element.closest(".caixa-field")!.getBoundingClientRect().top,
              })),
              rows: new Set(
                controls.map((element) =>
                  Math.round(element.closest(".caixa-field")!.getBoundingClientRect().top),
                ),
              ).size,
              currency,
              participantsWidth: document
                .querySelector(".caixa-participant-control")!
                .getBoundingClientRect().width,
              buttonWidths: [...document.querySelectorAll(".caixa-toggle button")].map(
                (element) => element.getBoundingClientRect().width,
              ),
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          await page.screenshot({
            path: resolve(directory, `caixa-two-rows-${width}-${expanded}.png`),
          });
          await writeFile(
            resolve(directory, `caixa-two-rows-${width}-${expanded}.json`),
            JSON.stringify(layout, null, 2),
          );
          expect(layout.rows, `${width}/${expanded}: main controls use three readable rows`).toBe(
            3,
          );
          expect(layout.overflow).toBe(false);
          expect(layout.participantsWidth).toBeLessThanOrEqual(64);
          for (const value of layout.currency) expect(value.text).toBeLessThanOrEqual(value.space);
          for (const buttonWidth of layout.buttonWidths)
            expect(buttonWidth).toBeLessThanOrEqual(64);
        }
      }
    });
    it("fills the viewport edge and resizes content on sidebar hover and keyboard focus", async () => {
      await open();
      const workspace = page.locator(".caixa-workspace");
      const sidebar = page.locator(".caixa-tool-sidebar");
      const content = page.locator(".caixa-workspace-content");
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "true");
      const closed = await content.boundingBox();
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox).not.toBeNull();
      expect(sidebarBox!.x).toBeCloseTo(0, 0);
      expect(sidebarBox!.y).toBeGreaterThanOrEqual(0);
      expect(sidebarBox!.y).toBeLessThan(90);
      expect(sidebarBox!.y + sidebarBox!.height).toBeCloseTo(900, 0);
      await sidebar.hover();
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "false");
      await browserExpect
        .poll(async () => (await content.boundingBox())!.width)
        .toBeLessThan(closed!.width - 100);
      await browserExpect(
        page.getByRole("navigation", { name: "Simuladores disponíveis" }).getByRole("link"),
      ).toHaveCount(6);
      await page.mouse.move(1400, 80);
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "true");
      await browserExpect
        .poll(async () => (await content.boundingBox())!.width)
        .toBeCloseTo(closed!.width, 0);
      await page.keyboard.press("Tab");
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "false");
      await page.getByRole("button", { name: "Limpar", exact: true }).focus();
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "true");
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
      const darkSidebar = await sidebar.boundingBox();
      expect(darkSidebar!.x).toBeCloseTo(0, 0);
      expect(darkSidebar!.y + darkSidebar!.height).toBeCloseTo(900, 0);
      for (const link of await sidebar.getByRole("link").all()) {
        await browserExpect(link).toBeVisible();
        await browserExpect(link.locator("svg").first()).toBeVisible();
      }
      await browserExpect(
        page.getByRole("heading", { name: "Simulador CAIXA", exact: true }),
      ).toHaveText("Simulador Caixa");
      expect(errors).toEqual([]);
    });
    it("centers monthly installments and prints the complete schedule with keyboard dismissal", async () => {
      await open();
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      const fontFamilies = await page.evaluate(() => ({
        main: getComputedStyle(document.querySelector("main")!).fontFamily,
        label: getComputedStyle(document.querySelector(".caixa-field > span")!).fontFamily,
      }));
      await writeFile(
        resolve(directory, "caixa-font-families.json"),
        JSON.stringify(fontFamilies, null, 2),
      );
      await fillMain();
      await page.getByRole("button", { name: "Exibir parcelas", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await browserExpect(dialog).toBeVisible();
      await browserExpect(dialog.locator("tbody tr")).toHaveCount(420);
      for (const width of [1440, 1024, 768, 390, 320]) {
        await resizeViewport(width, 900);
        const bounds = await dialog.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width / 2, `${width}: centered horizontally`).toBeCloseTo(
          width / 2,
          0,
        );
        expect(bounds!.y + bounds!.height / 2, `${width}: centered vertically`).toBeCloseTo(450, 0);
        expect(bounds!.width).toBeLessThanOrEqual(width);
        expect(bounds!.height).toBeLessThanOrEqual(900);
        const header = dialog.locator("header");
        await browserExpect(header).toBeVisible();
        for (const element of [
          header,
          dialog.getByRole("button", { name: "Imprimir", exact: true }),
          dialog.getByRole("button", { name: "Fechar", exact: true }),
        ]) {
          const child = await element.boundingBox();
          expect(child, `${width}: visible header and actions`).not.toBeNull();
          expect(child!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
          expect(child!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
          expect(child!.x + child!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
          expect(child!.y + child!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
        }
        for (const button of await dialog.getByRole("button").all()) {
          const lines = await button.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
          });
          expect(lines, `${width}: action labels remain readable on one line`).toBe(1);
        }
        await page.screenshot({ path: resolve(directory, `caixa-parcelas-${width}.png`) });
      }
      await page.evaluate(() => {
        window.print = () => document.documentElement.setAttribute("data-print-called", "true");
      });
      await dialog.getByRole("button", { name: "Imprimir", exact: true }).click();
      await browserExpect(page.locator("html")).toHaveAttribute("data-print-called", "true");
      await page.emulateMedia({ media: "print" });
      await browserExpect(dialog).toBeVisible();
      await browserExpect(dialog.locator("tbody tr").last()).toBeVisible();
      await browserExpect(page.locator(".caixa-content-toolbar")).toBeHidden();
      const printLayout = await dialog.evaluate((element) => {
        const scroll = element.querySelector(".caixa-installments-scroll")!;
        const style = getComputedStyle(scroll);
        return {
          scrollHeight: scroll.scrollHeight,
          clientHeight: scroll.clientHeight,
          overflowY: style.overflowY,
          maxHeight: style.maxHeight,
        };
      });
      expect(printLayout.maxHeight).toBe("none");
      expect(printLayout.overflowY).toBe("visible");
      expect(printLayout.scrollHeight).toBeLessThanOrEqual(printLayout.clientHeight + 1);
      await page.emulateMedia({ media: "screen" });
      await page.keyboard.press("Escape");
      await browserExpect(dialog).not.toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Exibir parcelas", exact: true }),
      ).toBeFocused();
      expect(errors).toEqual([]);
    });
    it("keeps touch menu access without shrinking mobile form content", async () => {
      await open();
      await resizeViewport(390, 844);
      const workspace = page.locator(".caixa-workspace");
      const before = await page.locator(".caixa-workspace-content").boundingBox();
      await page.getByRole("button", { name: "Expandir menu de simulação", exact: true }).click();
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "false");
      expect((await page.locator(".caixa-workspace-content").boundingBox())!.width).toBeCloseTo(
        before!.width,
        0,
      );
      await page.getByRole("button", { name: "Recolher menu de simulação", exact: true }).click();
      await browserExpect(workspace).toHaveAttribute("data-sidebar-collapsed", "true");
      await browserExpect(page.locator(".caixa-tool-sidebar").getByRole("link")).toHaveCount(6);
      for (const link of await page.locator(".caixa-tool-sidebar").getByRole("link").all()) {
        await browserExpect(link).toBeVisible();
        await browserExpect(link.locator("svg").first()).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
    });
    async function auditCurrentTab(name: string) {
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [1440, 390]) {
        await resizeViewport(width, width === 1440 ? 900 : 844);
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((selected) => {
            document.documentElement.dataset.theme = selected;
          }, theme);
          await page.waitForTimeout(200);
          const pageColors = await page.evaluate(() => {
            const probe = document.createElement("div");
            probe.style.background = "var(--analytics-surface)";
            document.body.append(probe);
            const expected = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return {
              actual: getComputedStyle(document.querySelector(".caixa-page-shell")!)
                .backgroundColor,
              expected,
            };
          });
          expect(pageColors.actual, `${width}/${theme}: system page color`).toBe(
            pageColors.expected,
          );
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
            expect(selected.transitions).toContain("background-color");
          }
          if (name === "resultado") {
            await browserExpect(page.locator(".caixa-construction-details")).not.toHaveAttribute(
              "open",
              "",
            );
            const amounts = await page
              .locator(
                ".caixa-result-plan-line > span, .caixa-result-plan-total > strong, .caixa-result-composition dd, .caixa-metric > strong",
              )
              .evaluateAll((elements) =>
                elements.flatMap((element) => {
                  const text = element.textContent ?? "";
                  const box = element.getBoundingClientRect();
                  if (
                    !/R\$\s*\d/.test(text) ||
                    !box.width ||
                    !box.height ||
                    !element.checkVisibility()
                  )
                    return [];
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  const fragments = Array.from(range.getClientRects()).filter(
                    (rect) => rect.width > 0,
                  );
                  const bounds = range.getBoundingClientRect();
                  return [
                    {
                      text,
                      lines: new Set(fragments.map((rect) => Math.round(rect.top))).size,
                      contained: bounds.left >= box.left - 1 && bounds.right <= box.right + 1,
                      textOverflow: getComputedStyle(element).textOverflow,
                    },
                  ];
                }),
              );
            expect(amounts.some((amount) => amount.text.includes("239.287,18"))).toBe(true);
            expect(amounts.some((amount) => amount.text.includes("60.712,82"))).toBe(true);
            expect(
              amounts.filter(
                (amount) =>
                  amount.lines !== 1 || !amount.contained || amount.textOverflow === "ellipsis",
              ),
              `${name}/${width}/${theme}: ${JSON.stringify(amounts)}`,
            ).toEqual([]);
          }
          if (theme === "dark" && name === "documentos") {
            const action = await page
              .getByRole("button", {
                name: "Editar perfis",
                exact: true,
              })
              .evaluate((button) => {
                const style = getComputedStyle(button);
                return {
                  color: style.color,
                  background: style.backgroundColor,
                  image: style.backgroundImage,
                };
              });
            expect(action).toEqual({
              color: "rgb(10, 43, 71)",
              background: "rgb(92, 229, 241)",
              image: "none",
            });
            expect(
              contrastRatio(action.color, action.background),
              JSON.stringify(action),
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
      await resizeViewport(1440, 900);
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
      });
    }
    it("recalculates automatically and preserves all reference tabs", async () => {
      await open();
      await fillMain();
      await browserExpect(
        page.getByRole("heading", { name: "Resumo financeiro", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("Não aplicável neste cenário", { exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByText(/seguros de referência/).first()).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Salvar na sessão", exact: true }),
      ).toHaveCount(0);
      await page.getByLabel("Quantidade de proponentes", { exact: true }).fill("2");
      await browserExpect(
        page.getByLabel("Quantidade de proponentes", { exact: true }),
      ).toHaveValue("2");
      await browserExpect(
        page.getByRole("heading", { name: "Resumo financeiro", exact: true }),
      ).toBeVisible();
      await page.getByLabel("Quantidade de proponentes", { exact: true }).fill("1");
      await auditCurrentTab("resultado");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("45000000");
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "MCMV Classe Média",
      );
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("");
      await browserExpect(
        page.getByRole("heading", { name: "Resumo financeiro", exact: true }),
      ).toHaveCount(0);
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("700000");
      await browserExpect(
        page.getByRole("heading", { name: "Resumo financeiro", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "01 Documentos", exact: true }).click();
      await page.getByLabel("Tipo de vínculo / renda", { exact: false }).selectOption("clt");
      await page.getByLabel("Renda mensal bruta", { exact: true }).fill("650000");
      await page.getByRole("button", { name: "Voltar ao simulador", exact: true }).click();
      await page.getByRole("button", { name: "01 Documentos", exact: true }).click();
      await browserExpect(page.getByLabel("Tipo de vínculo / renda", { exact: false })).toHaveValue(
        "clt",
      );
      await browserExpect(page.getByLabel("Renda mensal bruta", { exact: true })).toHaveValue(
        "6.500,00",
      );
      await page.getByRole("button", { name: "Gerar documentos da Fase 1", exact: true }).click();
      await browserExpect(page.getByText("Contracheques", { exact: true })).toBeVisible();
      await page
        .getByRole("button", { name: "Ir para Fase 2 — fechar venda", exact: true })
        .click();
      await browserExpect(
        page.getByText("Certidão de estado civil", { exact: true }),
      ).toBeVisible();
      await auditCurrentTab("documentos");
      await page.getByRole("button", { name: "02 Diagnóstico", exact: true }).click();
      await page.getByRole("button", { name: "Reprovado", exact: true }).click();
      await page.getByRole("button", { name: "Pontuação (rating)", exact: true }).click();
      await browserExpect(page.getByRole("heading", { name: /pontuação/i })).toBeVisible();
      await auditCurrentTab("diagnostico");
      await page.getByRole("button", { name: "03 Utilitários", exact: true }).click();
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
    it("automates municipal limit, property condition, rate band and age term", async () => {
      await open();
      const condition = page.locator(".caixa-property-condition-group select");
      await browserExpect(condition).toBeDisabled();
      await browserExpect(condition).toHaveValue("new");
      await page
        .getByRole("group", { name: "Imóvel na planta?" })
        .getByRole("button", { name: "Não", exact: true })
        .click();
      await browserExpect(condition).toBeEnabled();
      await browserExpect(condition).toHaveValue("");
      await browserExpect(condition).toHaveAttribute("required", "");
      await condition.selectOption("used");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("45000000");
      await page.getByText("Parâmetros confirmados e valores opcionais", { exact: true }).click();
      const confirmedParameters = page.locator(".caixa-confirmed-parameters");
      await browserExpect(
        confirmedParameters.getByLabel("Desconto complemento FGTS confirmado", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        confirmedParameters
          .locator("label")
          .filter({ hasText: "Cota aprovada pela CAIXA (%)" })
          .locator("input"),
      ).toHaveAttribute("max", "60");
      await page
        .getByRole("group", { name: "Imóvel na planta?" })
        .getByRole("button", { name: "Sim", exact: true })
        .click();
      await browserExpect(condition).toBeDisabled();
      await browserExpect(condition).toHaveValue("new");

      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("400000");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("27600000");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1955-01-22");
      await page.getByRole("combobox", { name: "Cidade *" }).fill("São Paulo");
      await browserExpect(page.locator(".caixa-city-picker.open")).toBeVisible();
      await page.getByRole("option", { name: "São Paulo SP", exact: true }).click();
      await browserExpect(page.locator(".caixa-property-field .caixa-field-insight")).toContainText(
        "275.000,00",
      );
      await browserExpect(page.locator(".caixa-income-field .caixa-field-insight")).toContainText(
        "1.200,00",
      );
      await browserExpect(page.locator(".caixa-term-field input")).toHaveValue("105");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1987-01-22");
      await browserExpect(page.locator(".caixa-term-field input")).toHaveValue("420");
      await page.locator(".caixa-term-field input").fill("240");
      await browserExpect(page.locator(".caixa-term-field input")).toHaveValue("240");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1986-01-22");
      await browserExpect(page.locator(".caixa-term-field input")).toHaveValue("420");
      const subsidyInputs = page.locator(".caixa-subsidy-inputs");
      await subsidyInputs.locator("select").nth(0).selectOption("apartment");
      await subsidyInputs.locator('input[type="number"]').fill("50");
      await subsidyInputs.locator("select").nth(1).selectOption("yes");
      // Independent formula: Frenda=1900, FDr=2.07, FDfin=0.1503443004,
      // FUH=5.5 (50m² apartment), Fpop=1.2, nominal rate=8.16 (no FGTS discount).
      // Raw complement=2456.023850; the verified final truncation gives 2456.
      await browserExpect(page.getByText("R$ 2.456,00", { exact: true })).toBeVisible();
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "MCMV Faixa 3 por valor do imóvel",
      );
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "taxa efetiva de 8,4722% a.a.",
      );
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText("420 meses");
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText("R$ 2.456,00");
      expect(errors).toEqual([]);
    });
    it("applies the SBPE SAC ceiling and removes MCMV-only values", async () => {
      await open();
      await fillMain();
      await page.locator(".caixa-product-system-field select").nth(0).selectOption("sbpe");
      await page.locator(".caixa-product-system-field select").nth(1).selectOption("sac");
      await browserExpect(
        page.getByLabel("Desconto complemento FGTS confirmado", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText("90,00% sobre");
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "taxa efetiva de 11,4900% a.a. (estimada)",
      );
      expect(errors).toEqual([]);
    });
    it("has no horizontal overflow and passes axe in three themes on desktop and mobile", async () => {
      await open();
      const directory = resolve("private-data/caixa-qa");
      await mkdir(directory, { recursive: true });
      for (const width of [1440, 1024, 768, 390, 320]) {
        await resizeViewport(width, width === 1440 ? 900 : width === 1024 ? 768 : 844);
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((selected) => {
            document.documentElement.dataset.theme = selected;
          }, theme);
          await page.waitForTimeout(200);
          await page.screenshot({
            path: resolve(directory, `caixa-${width}-${theme}.png`),
            fullPage: true,
          });
          const overflow = await page.evaluate(() => ({
            viewport: innerWidth,
            document: document.documentElement.scrollWidth,
            elements: [...document.querySelectorAll("form *, .caixa-content-toolbar *")]
              .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 8)
              .map((element) => ({
                tag: element.tagName,
                class: element.className,
                right: element.getBoundingClientRect().right,
                text: element.textContent?.slice(0, 60),
              })),
          }));
          expect(
            overflow.document <= overflow.viewport,
            `${width}/${theme}: ${JSON.stringify(overflow)}`,
          ).toBe(true);
          const formBounds = await page.locator("form.caixa-form").evaluate((form) => {
            // The mobile label must fit without relying on the local fallback font.
            const box = form.getBoundingClientRect();
            const renderedChildren = Array.from(form.children).flatMap((child) =>
              getComputedStyle(child).display === "contents"
                ? Array.from(child.querySelectorAll(".caixa-field"))
                : [child],
            );
            return renderedChildren.map((child) => {
              const bounds = child.getBoundingClientRect();
              return {
                class: child.className,
                contained: bounds.left >= box.left - 1 && bounds.right <= box.right + 1,
              };
            });
          });
          if (width === 390) {
            for (const optional of await page
              .locator(".caixa-primary-grid > .caixa-field > span > small")
              .all()) {
              await browserExpect(optional).toBeHidden();
            }
          }
          expect(
            formBounds.filter((child) => !child.contained),
            `${width}/${theme}`,
          ).toEqual([]);
          const clearBounds = await page
            .getByRole("button", { name: "Limpar", exact: true })
            .evaluate((button) => {
              const content = button.closest(".caixa-workspace-content")!.getBoundingClientRect();
              const form = document.querySelector("form.caixa-form")!.getBoundingClientRect();
              const box = button.getBoundingClientRect();
              return (
                box.left >= content.left &&
                box.right <= content.right &&
                content.right - box.right <= 20 &&
                box.bottom <= form.top
              );
            });
          expect(clearBounds, `${width}/${theme}: Limpar stays above the form at right`).toBe(true);
          const fields = await page
            .locator(
              'form.caixa-form input:is([type="text"], [type="date"], [type="number"]), form.caixa-form select, .caixa-money-input',
            )
            .evaluateAll((elements) =>
              elements
                .filter((element) => element.getBoundingClientRect().height > 0)
                .map((element) => ({
                  label:
                    element.getAttribute("aria-label") ?? element.closest("label")?.textContent,
                  background: getComputedStyle(element).backgroundColor,
                  height: element.getBoundingClientRect().height,
                })),
            );
          for (const field of fields) {
            expect(field.background, `${width}/${theme}: transparent ${field.label}`).toBe(
              "rgba(0, 0, 0, 0)",
            );
            expect(field.height, `${width}/${theme}: compact ${field.label}`).toBeLessThanOrEqual(
              48,
            );
          }
          if (width >= 1100) {
            const rows = await page
              .locator(
                ".caixa-binary-grid > .caixa-field, .caixa-property-condition-group > .caixa-field",
              )
              .evaluateAll((elements) =>
                elements.map((element) => Math.round(element.getBoundingClientRect().top)),
              );
            expect(
              new Set(rows),
              `${width}/${theme}: financing options remain on one row`,
            ).toHaveLength(1);
          }
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
            expect(
              contrastRatio(inactive.color, inactive.background),
              `${width}/${theme}: ${JSON.stringify(inactive)}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(inactive.transitions).not.toContain("color");
            expect(inactive.transitions).toContain("background-color");
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
