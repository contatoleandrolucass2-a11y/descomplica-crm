import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

// The new page has its own behavioral matrix; historical image baselines stay intact.
export async function checkDocumentationCalculator(page, origin, outputDirectory) {
  const route = "/app/simulacao/calcular-documentacao";
  await page.goto(`${origin}${route}`);
  await expect(
    page.getByRole("heading", { name: "Calcular documentação", exact: true }),
  ).toBeVisible();
  const form = page.locator("#documentation-calculator-form");
  await expect(form.locator(".documentation-profile-panel")).toHaveClass(/\bis-active\b/);
  await expect(form.locator(".documentation-choice-group.current")).toHaveCount(1);
  await expect(form.locator(".documentation-choice-group.locked")).toHaveCount(2);
  await expect(form.locator(".documentation-money-field.primary.locked")).toHaveCount(1);
  await expect(page.locator(".documentation-flow li.pending.active")).toHaveCount(1);
  await expect(form.getByRole("radio", { name: "até 80% MCMV", exact: true })).toBeDisabled();
  await expect(form.getByRole("textbox", { name: "Valor do imóvel", exact: true })).toBeDisabled();
  await form.getByRole("button", { name: "Informações sobre Construtora", exact: true }).click();
  await expect(form.getByRole("dialog", { name: "Instruções sobre Construtora" })).toHaveText(
    "Em construção",
  );
  await page.keyboard.press("Escape");
  await expect(form.getByRole("dialog")).toHaveCount(0);

  await form.getByRole("radio", { name: "Direcional", exact: true }).check();
  await form.getByRole("radio", { name: "até 80% MCMV", exact: true }).check();
  await form.getByRole("radio", { name: "Sim", exact: true }).check();
  await expect(form.locator(".documentation-profile-panel")).toHaveClass(/\bis-complete\b/);
  await expect(form.locator(".documentation-values-panel")).toHaveClass(/\bis-active\b/);
  await expect(form.locator(".documentation-choice-group.complete")).toHaveCount(3);
  await form.getByRole("textbox", { name: "Valor do imóvel", exact: true }).fill("24000000");
  await form.getByRole("textbox", { name: "Avaliação bancária", exact: true }).fill("25000000");
  await form.getByRole("textbox", { name: "Financiamento", exact: true }).fill("19200000");
  const submit = form.getByRole("button", { name: /^Calcular documentação Data/ });
  await expect(submit).toBeDisabled();
  await form.getByRole("textbox", { name: "Renda familiar", exact: true }).fill("500000");
  await submit.click();
  const result = page.locator("#resultado-documentacao");
  await expect(form.locator(".documentation-values-panel")).toHaveClass(/\bis-complete\b/);
  await expect(form.locator(".documentation-money-field.primary.complete")).toHaveCount(1);
  await expect(page.locator(".documentation-flow li.complete")).toHaveCount(3);
  await expect(result.getByRole("heading", { name: "Resumo financeiro" })).toBeVisible();
  await expect(result.locator(".documentation-plan-line")).toContainText("40x Parcelas de");
  await expect(result.locator(".documentation-plan-total")).toContainText("3.951,99");
  await expect(result.locator(".documentation-plan-line")).toContainText("132,10");
  await result.getByText("Auditoria do cálculo", { exact: true }).click();
  await expect(result.locator(".documentation-audit li.ok")).toHaveCount(7);

  await form.getByRole("textbox", { name: "Financiamento", exact: true }).fill("20100000");
  await expect(result).toHaveCount(0);
  await submit.click();
  await expect(result.getByRole("alert")).toContainText(
    "Financiamento supera teto de 80% da avaliação bancária.",
  );
  await expect(result.locator(".documentation-limit")).toContainText("200.000,00");
  await form.getByRole("radio", { name: "Riva", exact: true }).check();
  await form.getByRole("radio", { name: "Não", exact: true }).check();
  await expect(form.getByRole("radio", { name: /^até 90% SBPE/ })).toBeChecked();
  await expect(form.getByRole("radio", { name: "até 80% MCMV", exact: true })).toBeDisabled();
  await form.getByRole("textbox", { name: "Renda familiar", exact: true }).fill("");
  await submit.click();
  await expect(result.locator(".documentation-plan-line")).toContainText("36x Parcelas de");
  await expect(result.locator(".documentation-breakdown")).toContainText("10.186,21");
  await expect(result.getByRole("button", { name: "Imprimir" })).toBeVisible();

  const matrix = [];
  await mkdir(outputDirectory, { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "balanced", "dark"]) {
      const themeLabels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
      await page.getByRole("button", { name: themeLabels[theme], exact: true }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
      const profile = form.locator(".documentation-profile-panel");
      const panelBounds = await profile.boundingBox();
      const headingBounds = await profile.getByRole("heading").boundingBox();
      assert.ok(headingBounds.x >= panelBounds.x, `Profile content clipped at ${width}px/${theme}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, `Documentation overflow at ${width}px/${theme}`);
      let financingHeadingNoCollision = true;
      if (width === 320) {
        const financingHeading = await form
          .getByRole("textbox", { name: "Financiamento", exact: true })
          .locator(
            "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' documentation-money-field ')][1]",
          )
          .evaluate((field) => {
            const heading = field.querySelector(".documentation-money-heading");
            const label = heading?.querySelector(":scope > strong");
            const metadata = heading?.querySelector(".documentation-money-heading-meta");
            const note = metadata?.querySelector(":scope > small");
            if (!heading || !label || !metadata || !note) return false;
            const headingBounds = heading.getBoundingClientRect();
            const labelBounds = label.getBoundingClientRect();
            const metadataBounds = metadata.getBoundingClientRect();
            const noteBounds = note.getBoundingClientRect();
            const textCollides =
              labelBounds.left < noteBounds.right &&
              labelBounds.right > noteBounds.left &&
              labelBounds.top < noteBounds.bottom &&
              labelBounds.bottom > noteBounds.top;
            const checks = {
              grid: getComputedStyle(heading).display === "grid",
              rowsSeparated: metadataBounds.top >= labelBounds.bottom - 1,
              labelVisible: labelBounds.width > 0,
              noteVisible: noteBounds.width > 0,
              textDoesNotCollide: !textCollides,
              labelContained:
                labelBounds.left >= headingBounds.left - 1 &&
                labelBounds.right <= headingBounds.right + 1,
              noteContained:
                noteBounds.left >= headingBounds.left - 1 &&
                noteBounds.right <= headingBounds.right + 1,
            };
            const round = (value) => Math.round(value * 100) / 100;
            return {
              passed: Object.values(checks).every(Boolean),
              checks,
              bounds: Object.fromEntries(
                Object.entries({
                  heading: headingBounds,
                  label: labelBounds,
                  metadata: metadataBounds,
                  note: noteBounds,
                }).map(([name, rect]) => [
                  name,
                  {
                    x: round(rect.x),
                    y: round(rect.y),
                    width: round(rect.width),
                    height: round(rect.height),
                  },
                ]),
              ),
            };
          });
        financingHeadingNoCollision = financingHeading.passed;
        assert.ok(
          financingHeadingNoCollision,
          `Financing label and percentage must not collide at ${width}px/${theme}: ${JSON.stringify(financingHeading)}`,
        );
      }
      if (width === 768 && theme === "dark") {
        await expect
          .poll(
            () =>
              result.locator(".documentation-breakdown").evaluate((node) => {
                const color = (selector) => {
                  const element = node.querySelector(selector);
                  return element ? getComputedStyle(element).color : null;
                };
                return {
                  rootTheme: document.documentElement.dataset.theme ?? null,
                  surface: getComputedStyle(node).backgroundColor,
                  heading: color("h3"),
                  term: color("dt"),
                  value: color("dd"),
                  totalTerm: color(".documentation-breakdown-total dt"),
                  totalValue: color(".documentation-breakdown-total dd"),
                };
              }),
            {
              message: "Documentation must settle on the final dark contrast colors at 768px",
              timeout: 5_000,
            },
          )
          .toEqual({
            rootTheme: "dark",
            surface: "rgb(15, 45, 65)",
            heading: "rgb(244, 251, 255)",
            term: "rgb(180, 202, 216)",
            value: "rgb(244, 251, 255)",
            totalTerm: "rgb(34, 184, 197)",
            totalValue: "rgb(244, 251, 255)",
          });
      }
      const accessibility = await new AxeBuilder({ page })
        .include(".documentation-page-shell")
        .analyze();
      assert.deepEqual(
        accessibility.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        })),
        [],
        `Documentation accessibility at ${width}px/${theme}`,
      );
      await page.screenshot({
        path: path.join(outputDirectory, `documentation-${theme}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      matrix.push({
        width,
        theme,
        overflow,
        financingHeadingNoCollision,
        accessibilityViolations: 0,
      });
    }
  }
  // Browser zoom reflows the CSS viewport; CSS zoom alone does not update media queries.
  await page.setViewportSize({ width: 720, height: 450 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  );
  await page.screenshot({
    path: path.join(outputDirectory, "documentation-zoom-200.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ media: "print" });
  await expect(result).toBeVisible();
  await page.screenshot({
    path: path.join(outputDirectory, "documentation-print.png"),
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  return {
    passed: true,
    sequentialUnlock: true,
    mcmvIncomeRequired: true,
    goldenMcmv: true,
    financingLimit: true,
    automaticSbpe: true,
    rivaWithoutIncome: true,
    staleResultCleared: true,
    hintsKeyboard: true,
    audit: true,
    printSurface: true,
    zoom200: { passed: true, method: "Equivalent 720x450 CSS layout for a 1440x900 viewport" },
    matrix,
  };
}
