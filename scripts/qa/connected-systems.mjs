import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

export async function checkConnectedSystems(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await page.goto(`${origin}/app/configuracoes`);
  await page
    .locator('[aria-labelledby="settings-areas-title"]')
    .getByRole("link", { name: "Conectar Sistemas", exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/app/configuracoes/conectar-sistemas`);
  await expect(page.getByRole("heading", { name: "Conectar Sistemas", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir Salesforce", exact: true })).toHaveAttribute(
    "href",
    "https://direcional.my.salesforce.com/",
  );
  await expect(page.getByRole("link", { name: "Console de vendas", exact: true })).toHaveAttribute(
    "href",
    "https://direcional.lightning.force.com/lightning",
  );
  await expect(page.locator('[aria-labelledby="reports-title"] a')).toHaveCount(7);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const checks = [];
  for (const theme of ["light", "balanced", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const label = { light: "Claro", balanced: "Médio", dark: "Escuro" }[theme];
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `Conectar Sistemas overflow at ${width}px in ${theme}`);
      const result = await new AxeBuilder({ page }).include("main").analyze();
      assert.deepEqual(
        result.violations.map((item) => item.id),
        [],
        `Conectar Sistemas axe ${theme}/${width}`,
      );
      await page.screenshot({
        path: path.join(outputDirectory, `${theme}-${width}.png`),
        fullPage: true,
      });
      checks.push({ theme, width, overflow, accessibilityViolations: result.violations.length });
    }
  }
  return { route: "/app/configuracoes/conectar-sistemas", checks };
}
