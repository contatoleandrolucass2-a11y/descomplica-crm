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

async function settleResponsiveLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finiteAnimations = document.getAnimations().filter((animation) => {
      const endTime = Number(animation.effect?.getComputedTiming().endTime);
      return Number.isFinite(endTime) && animation.playState !== "finished";
    });
    await Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => null)));
    await new Promise((resolve) => {
      let previousSample = null;
      let stableSamples = 0;
      let sampledFrames = 0;
      const sample = () => {
        const currentSample = [
          innerWidth,
          document.documentElement.clientWidth,
          document.documentElement.scrollWidth,
        ].join(":");
        stableSamples = currentSample === previousSample ? stableSamples + 1 : 0;
        previousSample = currentSample;
        sampledFrames += 1;
        if (stableSamples >= 2 || sampledFrames >= 12) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });
}

async function openFidLookup(page) {
  const lookupTab = page.getByRole("tab", { name: "Consulta por FID", exact: true });
  await lookupTab.click();
  const fid = page.getByRole("textbox", { name: "Número do FID", exact: true });
  const submit = page.getByRole("button", { name: "Consultar repasse", exact: true });
  await expect(fid).toBeVisible();
  await expect(submit).toBeVisible();
  return { fid, submit };
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
      page.getByRole("heading", { name: "Consulta de repasses", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("M.A.P DE CAMPOS SOLUÇÕES", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resultado da consulta" })).toHaveCount(0);

    const overviewTab = page.getByRole("tab", { name: "Visão geral", exact: true });
    const lookupTab = page.getByRole("tab", { name: "Consulta por FID", exact: true });
    await expect(overviewTab).toBeVisible();
    await expect(lookupTab).toBeVisible();
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await expect(lookupTab).toHaveAttribute("aria-selected", "false");

    checkpoint("overview-local-fixture");
    for (const [heading, stage] of [
      ["Repassado", "repassado"],
      ["Pendência", "pendencia"],
      ["Mais de 20 dias", "mais-de-20-dias"],
      ["Distrato / desistência", "distrato"],
    ]) {
      checkpoint(`overview-heading-${stage}`);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    checkpoint("overview-card-count");
    const boardCards = page.locator(
      'button[aria-label*="Cliente Sintético"][aria-label*="FID 9000000000"]',
    );
    await expect(boardCards).toHaveCount(8);

    checkpoint("overview-filter-controls");
    const search = page.getByRole("searchbox", { name: "Buscar cliente ou FID", exact: true });
    const projectFilter = page.getByRole("combobox", {
      name: "Filtrar por empreendimento",
      exact: true,
    });
    const statusFilter = page.getByRole("combobox", {
      name: "Filtrar por status",
      exact: true,
    });
    await expect(search).toBeVisible();
    await expect(projectFilter).toBeVisible();
    await expect(statusFilter).toBeVisible();

    checkpoint("overview-filters");
    await search.fill("900000000010");
    await expect(boardCards).toHaveCount(1);
    await expect(
      page.locator('button[aria-label*="Cliente Sintético 08"][aria-label*="FID 900000000010"]'),
    ).toBeVisible();
    await search.fill("");
    await expect(boardCards).toHaveCount(8);
    await search.fill("Cliente Sintético 03");
    await expect(boardCards).toHaveCount(1);
    await expect(
      page.locator('button[aria-label*="Cliente Sintético 03"][aria-label*="FID 900000000005"]'),
    ).toBeVisible();
    await search.fill("");
    await expect(boardCards).toHaveCount(8);

    await projectFilter.selectOption({ label: "Residencial Sintético" });
    await expect(boardCards).toHaveCount(4);
    await projectFilter.selectOption({ index: 0 });
    await expect(boardCards).toHaveCount(8);

    for (const status of ["Repassado", "Pendência", "Mais de 20 dias", "Distrato / desistência"]) {
      await statusFilter.selectOption({ label: status });
      await expect(boardCards).toHaveCount(2);
    }
    await statusFilter.selectOption({ index: 0 });
    await expect(boardCards).toHaveCount(8);

    checkpoint("overview-detail");
    const firstCard = page.locator(
      'button[aria-label*="Cliente Sintético 01"][aria-label*="FID 900000000001"]',
    );
    await firstCard.click();
    const detailDialog = page.getByRole("dialog", {
      name: "Detalhes do repasse",
      exact: true,
    });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog).toContainText("900000000001");
    await expect(detailDialog).toContainText("Repasse concluído em ambiente local de QA.");
    const closeDetail = detailDialog.getByRole("button", {
      name: "Fechar detalhes",
      exact: true,
    });
    await expect(closeDetail).toBeFocused();
    await closeDetail.click();
    await expect(detailDialog).toBeHidden();
    await expect(firstCard).toBeFocused();

    checkpoint("overview-keyboard");
    await firstCard.focus();
    await page.keyboard.press("Enter");
    await expect(detailDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailDialog).toBeHidden();
    await expect(firstCard).toBeFocused();

    await overviewTab.focus();
    await page.keyboard.press("Tab");
    await expect(lookupTab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Número do FID", exact: true })).toBeVisible();
    await expect(lookupTab).toHaveAttribute("aria-selected", "true");
    await overviewTab.focus();
    await page.keyboard.press("Enter");
    await expect(boardCards).toHaveCount(8);
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");

    checkpoint("overview-visual-matrix");
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await settleResponsiveLayout(page);
      for (const theme of ["light", "balanced", "dark"]) {
        checkpoint(`visual-${viewport.width}x${viewport.height}-${theme}`);
        await selectTheme(page, theme, viewport.width);
        await settleResponsiveLayout(page);
        activeStage = `overflow-${viewport.width}x${viewport.height}-${theme}`;
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
          return {
            present,
            offenders,
            innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          };
        });
        if (overflow.present) {
          process.stderr.write(
            `[repasse] overflow viewport=${viewport.width}x${viewport.height} theme=${theme} inner=${overflow.innerWidth} scroll=${overflow.scrollWidth} offenders=${JSON.stringify(overflow.offenders)}\n`,
          );
        }
        assert.equal(
          overflow.present,
          false,
          `Repasse overflow at ${viewport.width}x${viewport.height} in ${theme}: ${JSON.stringify(overflow.offenders)}`,
        );
        activeStage = `accessibility-${viewport.width}x${viewport.height}-${theme}`;
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        if (accessibility.violations.length > 0) {
          const targetNodes = accessibility.violations.flatMap((violation) =>
            violation.nodes.slice(0, 6).map((node) => ({ violation, node })),
          );
          const targets = await Promise.all(
            targetNodes.map(async ({ violation, node }) => ({
              rule: violation.id,
              target: node.target,
              data: node.any.map((check) => check.data),
              computed: await page.locator(String(node.target[0])).evaluate((element) => {
                const rootStyle = getComputedStyle(document.documentElement);
                return {
                  theme: document.documentElement.dataset.theme,
                  color: getComputedStyle(element).color,
                  parentColor: getComputedStyle(element.parentElement).color,
                  analyticsInk: rootStyle.getPropertyValue("--analytics-ink").trim(),
                  analyticsMuted: rootStyle.getPropertyValue("--analytics-muted").trim(),
                };
              }),
            })),
          );
          process.stderr.write(
            `[repasse] accessibility viewport=${viewport.width}x${viewport.height} theme=${theme} rules=${accessibility.violations.map((item) => item.id).join(",")} targets=${JSON.stringify(targets)}\n`,
          );
        }
        assert.equal(
          accessibility.violations.length,
          0,
          `Repasse accessibility at ${viewport.width}px in ${theme}: ${accessibility.violations.map((item) => item.id).join(", ")}`,
        );
        activeStage = `screenshot-${viewport.width}x${viewport.height}-${theme}`;
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

    checkpoint("constraint-validation");
    let { fid, submit } = await openFidLookup(page);
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

    checkpoint("not-found-local-fixture");
    await page.goto(`${origin}${route}`);
    ({ fid, submit } = await openFidLookup(page));
    await fid.fill("0");
    await submit.click();
    await expect(page.getByRole("heading", { name: "Nenhum repasse localizado" })).toBeVisible();

    checkpoint("conflict-local-fixture");
    await page.goto(`${origin}${route}`);
    ({ fid, submit } = await openFidLookup(page));
    await fid.fill("900000000002");
    await submit.click();
    await expect(
      page.getByRole("heading", { name: "Cadastro precisa de conferência" }),
    ).toBeVisible();

    checkpoint("unavailable-local-fixture");
    await page.goto(`${origin}${route}`);
    ({ fid, submit } = await openFidLookup(page));
    await fid.fill("900000000003");
    await submit.click();
    await expect(
      page.getByRole("heading", { name: "Não foi possível consultar agora" }),
    ).toBeVisible();

    checkpoint("keyboard");
    await page.goto(`${origin}${route}`);
    ({ fid, submit } = await openFidLookup(page));
    await fid.focus();
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();

    return {
      route,
      sourceRead:
        "local loopback-only synthetic overview and detail adapter; no external source request",
      overview: true,
      filters: true,
      detail: true,
      tabs: true,
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
