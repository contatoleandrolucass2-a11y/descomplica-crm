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
}

export async function checkRepasse(page, origin, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const route = "/app/repasse";
  const checks = [];
  let activeStage = "open";
  const checkpoint = (stage) => {
    activeStage = stage;
    process.stdout.write(`[repasse] ${stage}\n`);
  };

  try {
    await page.goto(`${origin}${route}`);
    await expect(page).toHaveURL(`${origin}${route}`);
    await expect(
      page.getByRole("heading", { name: "Consulta de repasse", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("M.A.P DE CAMPOS SOLUÇÕES", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resultado da consulta" })).toHaveCount(0);

    const fid = page.getByRole("textbox", { name: "Número do FID", exact: true });
    const submit = page.getByRole("button", { name: "Consultar repasse", exact: true });
    checkpoint("constraint-validation");
    await fid.fill("ABC");
    assert.equal(await fid.evaluate((input) => input.checkValidity()), false);
    await fid.fill("");
    assert.equal(await fid.evaluate((input) => input.checkValidity()), false);

    checkpoint("ready-local-fixture");
    await fid.fill("900000000001");
    await submit.click();
    await expect(page.getByRole("heading", { name: "Resultado da consulta" })).toBeVisible();
    await expect(page.getByText("Residencial Sintético", { exact: true })).toBeVisible();
    await expect(page.getByText("Cliente Sintético", { exact: true })).toBeVisible();
    await expect(page.getByText(/Data da última atualização:/u)).toBeVisible();
    await expect(page.getByRole("link", { name: "Nova consulta", exact: true })).toBeVisible();

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ["light", "balanced", "dark"]) {
        checkpoint(`visual-${viewport.width}x${viewport.height}-${theme}`);
        await selectTheme(page, theme, viewport.width);
        const overflow = await page.evaluate(() => {
          const present = document.documentElement.scrollWidth > innerWidth + 1;
          const offenders = present
            ? [...document.querySelectorAll("body *")]
                .map((element) => {
                  const rect = element.getBoundingClientRect();
                  return {
                    tag: element.tagName,
                    className: typeof element.className === "string" ? element.className : "",
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                    width: Math.round(rect.width),
                  };
                })
                .filter((item) => item.left < -1 || item.right > innerWidth + 1)
                .slice(0, 8)
            : [];
          return { present, offenders };
        });
        assert.equal(
          overflow.present,
          false,
          `Repasse overflow at ${viewport.width}x${viewport.height} in ${theme}: ${JSON.stringify(overflow.offenders)}`,
        );
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.equal(
          accessibility.violations.length,
          0,
          `Repasse accessibility at ${viewport.width}px in ${theme}: ${accessibility.violations.map((item) => item.id).join(", ")}`,
        );
        await page.screenshot({
          path: path.join(
            outputDirectory,
            `repasse-${viewport.width}x${viewport.height}-${theme}.png`,
          ),
          fullPage: true,
          animations: "disabled",
          mask: [page.locator("[data-session-identity], [data-account-identity]")],
        });
        checks.push({ ...viewport, theme, overflow: false, accessibilityViolations: 0 });
      }
    }

    checkpoint("not-found-local-fixture");
    await page.goto(`${origin}${route}`);
    await fid.fill("0");
    await submit.click();
    await expect(page.getByRole("heading", { name: "Nenhum repasse localizado" })).toBeVisible();

    checkpoint("conflict-local-fixture");
    await page.goto(`${origin}${route}`);
    await fid.fill("900000000002");
    await submit.click();
    await expect(
      page.getByRole("heading", { name: "Cadastro precisa de conferência" }),
    ).toBeVisible();

    checkpoint("unavailable-local-fixture");
    await page.goto(`${origin}${route}`);
    await fid.fill("900000000003");
    await submit.click();
    await expect(
      page.getByRole("heading", { name: "Não foi possível consultar agora" }),
    ).toBeVisible();

    checkpoint("keyboard");
    await page.goto(`${origin}${route}`);
    await fid.focus();
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();

    return {
      route,
      sourceRead: "local loopback-only synthetic adapter; no external source request",
      constraintValidation: true,
      ready: true,
      notFound: true,
      conflict: true,
      unavailable: true,
      keyboard: true,
      checks,
      passed: true,
    };
  } catch (error) {
    const kind =
      error instanceof Error && ["Error", "AssertionError", "TimeoutError"].includes(error.name)
        ? error.name
        : "unknown";
    process.stderr.write(`[repasse] failed-stage=${activeStage} kind=${kind}\n`);
    throw error;
  }
}
