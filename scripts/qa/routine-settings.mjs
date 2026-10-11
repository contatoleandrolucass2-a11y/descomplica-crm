import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

const storageKey = "descomplica.crm.settings.routine.v1";
const roleLabels = [
  "Gerente regional house",
  "Gerente regional imob",
  "Gerente house",
  "Coordenador de vendas",
  "Coordenador de parcerias",
  "Corretor",
];

async function selectTheme(page, theme, width) {
  const labels = { light: "Claro", balanced: "Médio", dark: "Escuro" };
  if (width > 600) {
    await page.getByRole("button", { name: labels[theme], exact: true }).click();
  } else {
    const cycle = page.locator("[data-theme-cycle-mobile]");
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
      .every((animation) => animation.playState !== "running" && !animation.pending),
  );
}

export async function checkRoutineSettings(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const route = "/app/gestao/rotina";
  const checks = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  let stage = "management-link";
  const checkpoint = (value) => {
    stage = value;
    process.stdout.write(`[routine-settings] ${stage}\n`);
  };

  try {
    await page.goto(`${origin}/app/gestao`);
    await page.getByRole("link", { name: "Rotina", exact: true }).last().click();
    await expect(page).toHaveURL(`${origin}${route}`);
    const save = page.getByRole("button", { name: "Salvar alterações", exact: true });
    await expect(save).toBeEnabled();
    await expect(page.getByRole("tab")).toHaveCount(6);
    const house = page.getByRole("tab", { name: /^Gerente regional house/ });
    await expect(house).toHaveAttribute("aria-selected", "true");
    const initialRows = await page.locator("tbody tr").count();
    assert.equal(initialRows, 26, "Complete house routine must retain the reference rows");
    const filled = await page
      .getByRole("textbox")
      .evaluateAll((fields) => fields.filter((field) => field.value.trim().length > 0).length);
    assert.equal(filled, 74, "All reference activities must remain present");

    checkpoint("edit-insert-save-reload");
    const first = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });
    const original = await first.inputValue();
    await first.fill("Atividade sintética de validação.");
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(initialRows + 1);
    const addedLabel = `Terça-feira, linha ${initialRows + 1}`;
    await page
      .getByRole("textbox", { name: addedLabel, exact: true })
      .fill("Nova linha sintética.");
    await save.click();
    await page.reload();
    await expect(save).toBeEnabled();
    await expect(first).toHaveValue("Atividade sintética de validação.");
    await expect(page.getByRole("textbox", { name: addedLabel, exact: true })).toHaveValue(
      "Nova linha sintética.",
    );

    checkpoint("empty-roles-and-keyboard");
    for (const label of roleLabels.slice(1)) {
      const tab = page.getByRole("tab", { name: new RegExp(`^${label}`) });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("tbody tr")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Inserir primeira linha", exact: true }),
      ).toBeVisible();
    }
    await house.click();
    await house.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Gerente regional imob/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(house).toBeFocused();
    await expect(house).toHaveAttribute("aria-selected", "true");

    checkpoint("restore-confirmation");
    await first.fill("Ajuste ainda não salvo.");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Restaurar rotina da função ativa", exact: true })
      .click();
    await expect(first).toHaveValue("Ajuste ainda não salvo.");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Restaurar rotina da função ativa", exact: true })
      .click();
    await expect(first).toHaveValue(original);
    await expect(page.locator("tbody tr")).toHaveCount(initialRows);
    await save.click();

    for (const width of [1440, 1024, 720, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "balanced", "dark"]) {
        checkpoint(`visual-${width}-${theme}`);
        await selectTheme(page, theme, width);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `Rotina must not overflow at ${width}px in ${theme}`,
        );
        await expect(page.getByRole("heading", { name: "Rotina", exact: true })).toBeVisible();
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          result.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map(({ target }) => target),
          })),
          [],
          `Rotina accessibility at ${width}px in ${theme}`,
        );
        await page.screenshot({
          path: path.join(outputDirectory, `rotina-${width}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
          mask: [page.locator("[data-session-identity], [data-account-identity]")],
        });
        checks.push({ width, theme, overflow: false, accessibilityViolations: 0 });
      }
    }
    assert.deepEqual(errors, [], "Rotina must not produce runtime errors");
    return {
      route,
      rows: initialRows,
      editing: true,
      insertion: true,
      persistence: true,
      keyboard: true,
      reset: true,
      checks,
      passed: true,
    };
  } catch (error) {
    process.stderr.write(`[routine-settings] failed-stage=${stage}\n`);
    throw error;
  } finally {
    await page.evaluate((key) => window.localStorage.removeItem(key), storageKey).catch(() => {});
  }
}
