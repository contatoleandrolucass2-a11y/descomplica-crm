import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

async function selectTheme(page, theme, width) {
  if (width > 600) {
    const themeLabels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
    await page.getByRole("button", { name: themeLabels[theme], exact: true }).click();
  } else {
    const cycle = page.locator("[data-theme-cycle-mobile]");
    await expect(cycle).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((await page.locator("html").getAttribute("data-theme")) === theme) break;
      await cycle.click();
    }
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.waitForFunction(() =>
    document
      .getAnimations({ subtree: true })
      .filter((animation) => animation instanceof CSSTransition)
      .every((transition) => transition.playState !== "running" && !transition.pending),
  );
}

export async function checkMarketingResources(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const route = "/app/configuracoes/recurso-mkt";
  const checks = [];
  let activeStage = "settings-link";
  const checkpoint = (stage) => {
    activeStage = stage;
    process.stdout.write(`[marketing-resources] ${stage}\n`);
  };
  try {
    checkpoint("settings-link");
    await page.goto(`${origin}/app/configuracoes`);
    checkpoint("settings-loaded");
    await expect(page.locator('[aria-labelledby="settings-areas-title"]')).toBeVisible();
    await page.getByRole("link", { name: "Recurso MKT", exact: true }).click();
    checkpoint("link-clicked");
    await expect(page.getByRole("heading", { name: "Recurso MKT", exact: true })).toBeVisible();
    checkpoint("heading-visible");
    await expect(page).toHaveURL(`${origin}${route}`);
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
        await selectTheme(page, theme, width);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false, `Recurso MKT overflow at ${width}px in ${theme}`);
        await expect(page.getByRole("heading", { name: "Recurso MKT", exact: true })).toBeVisible();
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        const accessibilityViolations = accessibility.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        }));
        if (accessibility.violations.length) {
          checkpoint(
            `accessibility-rules:${accessibility.violations.map((item) => item.id).join(",")}`,
          );
          process.stderr.write(
            `[marketing-resources] accessibility-details=${JSON.stringify(accessibilityViolations)}\n`,
          );
        }
        assert.deepEqual(
          accessibilityViolations,
          [],
          `Recurso MKT accessibility at ${width}px in ${theme}`,
        );
        await page.screenshot({
          path: path.join(outputDirectory, `recurso-mkt-${width}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
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
  } catch (error) {
    const kind =
      error instanceof Error && ["Error", "AssertionError", "TimeoutError"].includes(error.name)
        ? error.name
        : "unknown";
    process.stderr.write(`[marketing-resources] failed-stage=${activeStage} kind=${kind}\n`);
    throw error;
  }
}
