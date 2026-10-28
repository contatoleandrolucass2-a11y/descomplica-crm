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
    async function fillMain() {
      await page.getByLabel("Renda familiar bruta", { exact: false }).fill("600000");
      await page.getByLabel("Valor do imóvel *", { exact: false }).fill("30000000");
      await page.getByLabel("Data de nascimento *", { exact: false }).fill("1991-03-15");
      await page.getByRole("combobox", { name: "Cidade *" }).fill("São Paulo");
      await browserExpect(page.locator(".caixa-city-picker.open")).toBeVisible();
      await page.getByRole("option", { name: "São Paulo SP", exact: true }).click();
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
          await page.waitForTimeout(200);
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
                  if (!/R\$\s*\d/.test(text) || !box.width || !box.height) return [];
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
      await page.setViewportSize({ width: 1440, height: 900 });
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
      await page.getByRole("button", { name: "Salvar na sessão", exact: true }).click();
      await page.getByLabel("Quantidade de proponentes", { exact: true }).fill("2");
      await page.locator(".caixa-history").getByText("Simulações salvas", { exact: false }).click();
      await page.locator(".caixa-history button").first().click();
      await browserExpect(
        page.getByLabel("Quantidade de proponentes", { exact: true }),
      ).toHaveValue("1");
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
      await browserExpect(page.getByText("R$ 3.927,65", { exact: true })).toBeVisible();
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "MCMV Faixa 3 por valor do imóvel",
      );
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText(
        "taxa efetiva de 8,4722% a.a.",
      );
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText("420 meses");
      await browserExpect(page.locator("#caixa-simulation-result")).toContainText("R$ 3.927,65");
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
      for (const width of [1440, 1024, 390, 320]) {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : width === 1024 ? 768 : 844,
        });
        for (const theme of ["light", "balanced", "dark"]) {
          await page.evaluate((selected) => {
            document.documentElement.dataset.theme = selected;
          }, theme);
          await page.waitForTimeout(200);
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
              const content = button.closest(".caixa-workspace-content")!.getBoundingClientRect();
              const form = document.querySelector("form.caixa-form")!.getBoundingClientRect();
              const box = button.getBoundingClientRect();
              return (
                box.left >= content.left &&
                box.right <= content.right &&
                box.right >= content.right - 1 &&
                box.bottom <= form.top
              );
            });
          expect(clearBounds, `${width}/${theme}: Limpar stays above the form at right`).toBe(true);
          if (width === 1024) {
            const geometry = await page.evaluate(() => {
              const rectangle = (selector: string) => {
                const box = document.querySelector(selector)!.getBoundingClientRect();
                return {
                  top: Math.round(box.top),
                  left: Math.round(box.left),
                  width: Math.round(box.width),
                };
              };
              return {
                participants: rectangle(".caixa-participants-field"),
                productSystem: rectangle(".caixa-product-system-field"),
                toggles: Array.from(
                  document.querySelectorAll(".caixa-binary-grid > .caixa-fgts-choice"),
                ).map((element) => Math.round(element.getBoundingClientRect().top)),
                property: rectangle(".caixa-property-condition-group"),
              };
            });
            expect(geometry.participants.width).toBeGreaterThan(geometry.productSystem.width * 0.9);
            expect(new Set(geometry.toggles)).toHaveLength(1);
            expect(geometry.property.top).toBeGreaterThan(geometry.toggles[0] ?? 0);
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
