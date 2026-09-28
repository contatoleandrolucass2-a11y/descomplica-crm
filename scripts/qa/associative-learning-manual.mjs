import assert from "node:assert/strict";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

export async function checkAssociativeLearningManual(page, artifactRoot, setTheme) {
  const originalViewport = page.viewportSize();
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  const trigger = page.getByRole("button", { name: "Aprenda", exact: true });
  const dialog = page.getByRole("dialog", { name: "Aprenda Associativo", exact: true });
  const policy = dialog.getByRole("tab", { name: "Política", exact: true });
  const faq = dialog.getByRole("tab", { name: "Perguntas", exact: true });
  const close = dialog.getByRole("button", { name: "Fechar manual da Associativo" });
  let captures = 0;

  try {
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
      { width: 812, height: 375 },
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ["light", "balanced", "dark"]) {
        await setTheme(page, theme);
        await trigger.click();
        await policy.click();
        await expect(policy).toBeFocused();
        await expect(policy).toHaveAttribute("aria-selected", "true");
        await expect(dialog.getByRole("tabpanel")).toHaveCount(1);

        for (const [key, tab] of [
          ["policy", policy],
          ["faq", faq],
        ]) {
          await tab.click();
          const panel = dialog.getByRole("tabpanel");
          await expect(panel).toBeVisible();
          assert.equal(new URL(page.url()).hash, `#investor-associative-learning-${key}`);
          const geometry = await dialog.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const panel = element.querySelector('[role="tabpanel"]:not([hidden])');
            const tabs = [...element.querySelectorAll('[role="tab"]')];
            return {
              fits:
                rect.left >= 0 &&
                rect.top >= 0 &&
                rect.right <= innerWidth &&
                rect.bottom <= innerHeight,
              overflow: panel.scrollWidth > panel.clientWidth + 1,
              targets: tabs.every(
                (tab) =>
                  tab.getBoundingClientRect().height >= 44 &&
                  tab.getBoundingClientRect().width >= 44,
              ),
              distinct:
                getComputedStyle(tabs[0]).backgroundColor !==
                getComputedStyle(tabs[1]).backgroundColor,
            };
          });
          assert.deepEqual(geometry, {
            fits: true,
            overflow: false,
            targets: true,
            distinct: true,
          });
          if (key === "faq") {
            const first = panel.locator("summary").first();
            await first.click();
            await expect(panel.locator("details[open]").first().locator("p")).toBeVisible();
          }
          const accessibility = await new AxeBuilder({ page })
            .include("#investor-learning-dialog")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          assert.deepEqual(
            accessibility.violations.map(({ id, nodes }) => ({
              id,
              nodes: nodes.map(({ target }) => target),
            })),
            [],
          );
          await page.screenshot({
            path: path.join(
              artifactRoot,
              `associative-manual-${key}-${theme}-${viewport.width}x${viewport.height}.png`,
            ),
          });
          captures++;
          const before = await policy.boundingBox();
          await panel.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          assert.deepEqual(
            await policy.boundingBox(),
            before,
            "Tabs must remain visible while reading",
          );
          await expect(close).toBeInViewport();
          if (key === "faq") await panel.locator("details[open] summary").first().click();
        }

        await faq.press("Home");
        await expect(policy).toBeFocused();
        await policy.press("ArrowLeft");
        await expect(faq).toBeFocused();
        await faq.press("ArrowRight");
        await expect(policy).toBeFocused();
        await policy.press("End");
        await expect(faq).toBeFocused();
        await faq.press("Tab");
        await expect(dialog.getByRole("tabpanel")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        await expect.poll(() => new URL(page.url()).hash).toBe("");
        await trigger.click();
        await close.click();
        await expect(trigger).toBeFocused();
      }
    }
    // Existing anchors must still open the requested topic in an already mounted manual.
    await page.evaluate(() => {
      window.location.hash = "investor-associative-learning-policy";
    });
    await expect(dialog).toBeVisible();
    await expect(policy).toHaveAttribute("aria-selected", "true");
    await page.evaluate(() => {
      window.location.hash = "investor-associative-learning-faq";
    });
    await expect(faq).toHaveAttribute("aria-selected", "true");
    await close.click();
    process.stdout.write(
      `Associative manual QA: ${captures} captures, 5 viewports, 3 themes, keyboard, focus, anchors and axe passed.\n`,
    );
    return true;
  } finally {
    if (await dialog.isVisible()) await close.click();
    await page.setViewportSize(originalViewport);
    await setTheme(page, originalTheme || "light");
  }
}
