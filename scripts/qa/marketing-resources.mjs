import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

export async function checkMarketingResources(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const route = "/app/configuracoes/recurso-mkt";
  const checks = [];
  const checkpoint = (stage) => process.stdout.write(`[marketing-resources] ${stage}\n`);
  checkpoint("settings-link");
  await page.goto(`${origin}/app/configuracoes`);
  await page.getByRole("link", { name: "Recurso MKT", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recurso MKT", exact: true })).toBeVisible();
  assert.equal(new URL(page.url()).pathname, route);
  checkpoint("reference-values");
  const fund = page.getByRole("textbox", {
    name: "Fundo de investimento de Marketing",
    exact: true,
  });
  const cost = page.getByRole("textbox", { name: "Custo venda", exact: true });
  const expectation = page.getByRole("status", { name: "Expectativa de vendas" });
  await expect(fund).toHaveValue("2.500,00");
  await expect(cost).toHaveValue("1.000,00");
  await expect(expectation).toHaveText("2,00");
  const table = page.getByRole("table");
  for (const [role, percentage, amount] of [
    ["Corretor", "40%", "1.000,00"],
    ["Gerente", "30%", "750,00"],
    ["Regional", "20%", "500,00"],
    ["Diretor", "10%", "250,00"],
  ]) {
    const row = table
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: role, exact: true }) });
    await expect(row).toContainText(percentage);
    await expect(row).toContainText(amount);
  }
  await expect(table.getByRole("listitem")).toHaveCount(5);
  checkpoint("recalculation-errors-reset");
  await fund.fill("5.000,00");
  await expect(expectation).toHaveText("5,00");
  await cost.fill("2.000,00");
  await expect(expectation).toHaveText("2,00");
  await cost.fill("0");
  await expect(cost).toHaveAttribute("aria-invalid", "true");
  await expect(expectation).toHaveText("Não informado");
  await fund.fill("");
  await expect(table).toContainText("Não informado");
  await page.getByRole("button", { name: "Restaurar valores iniciais", exact: true }).click();
  await expect(fund).toHaveValue("2.500,00");
  await expect(cost).toHaveValue("1.000,00");

  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "balanced", "dark"]) {
      checkpoint(`visual-${width}-${theme}`);
      const themeLabels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
      await page.getByRole("button", { name: themeLabels[theme], exact: true }).click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, `Recurso MKT overflow at ${width}px in ${theme}`);
      await expect(page.getByRole("heading", { name: "Recurso MKT", exact: true })).toBeVisible();
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      if (accessibility.violations.length) {
        checkpoint(
          `accessibility-rules:${accessibility.violations.map((item) => item.id).join(",")}`,
        );
      }
      assert.equal(
        accessibility.violations.length,
        0,
        `Recurso MKT accessibility at ${width}px in ${theme}: ${accessibility.violations.map((item) => item.id).join(", ")}`,
      );
      await page.screenshot({
        path: path.join(outputDirectory, `recurso-mkt-${width}-${theme}.png`),
        fullPage: true,
        mask: [page.locator("[data-session-identity], [data-account-identity]")],
      });
      checks.push({ width, theme, overflow: false, accessibilityViolations: 0 });
    }
  }
  checkpoint("keyboard");
  await fund.focus();
  await page.keyboard.press("Tab");
  await expect(cost).toBeFocused();
  return {
    route,
    referenceValues: true,
    recalculation: true,
    invalidInputs: true,
    reset: true,
    keyboard: true,
    checks,
    passed: true,
  };
}
