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

export async function checkRoutineScrolling(page, region) {
  const topbar = page.locator("[data-protected-topbar]");
  await expect(topbar).toHaveCount(1);
  const heading = region.locator("thead th").nth(1);
  const originalHeading = await heading.elementHandle();
  const table = region.locator("table");
  const insert = region.getByRole("button", { name: "Inserir linha", exact: true });
  assert.equal(await insert.evaluate((element) => element.closest("table") === null), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await region.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const overflow = await region.evaluate((element) => ({
    maxHeight: getComputedStyle(element).maxHeight,
    overflowX: getComputedStyle(element).overflowX,
    excessHeight: element.scrollHeight - element.clientHeight,
    scrollTop: element.scrollTop,
  }));
  assert.equal(overflow.maxHeight, "none");
  assert.equal(overflow.overflowX, "auto");
  assert.ok(
    overflow.excessHeight <= 1,
    "Routine must have natural height without internal vertical overflow",
  );
  assert.equal(overflow.scrollTop, 0);
  const initial = await heading.boundingBox();
  assert.ok(initial);
  await page.evaluate((y) => window.scrollTo(0, y + 400), initial.y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const header = await heading.boundingBox();
      const menu = await topbar.boundingBox();
      return header && menu ? Math.abs(header.y - menu.y - menu.height) : Infinity;
    })
    .toBeLessThanOrEqual(2);
  const pinned = await heading.boundingBox();
  const menu = await topbar.boundingBox();
  assert.ok(pinned && menu);
  assert.ok(
    pinned.y >= menu.y + menu.height - 2,
    "Day headers must not overlap the protected menu",
  );
  assert.equal(
    await topbar.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.bottom - 1));
    }),
    true,
    "Protected menu must remain above the table",
  );
  for (const locator of [page.locator("h1"), page.getByRole("tablist"), insert.locator("../..")]) {
    const box = await locator.boundingBox();
    assert.ok(
      box && box.y + box.height <= 0,
      "Title, tabs and toolbar must scroll out of the viewport",
    );
  }
  await expect(page.locator("thead")).toHaveCount(1);
  assert.equal(
    await heading.evaluate((element, original) => element === original, originalHeading),
    true,
  );
  await region.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  const horizontal = await heading.boundingBox();
  const offset = await region.evaluate((element) => element.scrollLeft);
  assert.ok(horizontal);
  assert.ok(
    Math.abs(horizontal.x - pinned.x + offset) <= 2,
    "Real day header must follow horizontal table scroll",
  );
  assert.ok(Math.abs(horizontal.y - pinned.y) <= 2);
  const lastHeading = await region.locator("thead th").last().boundingBox();
  const lastCell = await region.locator("tbody tr").first().locator("td").last().boundingBox();
  assert.ok(lastHeading && lastCell);
  assert.ok(
    Math.abs(lastHeading.x - lastCell.x) <= 2,
    "Day header must stay aligned with its column",
  );

  // A synthetic tail lets the table boundary reach the menu even at the end of the page.
  const tail = await page.evaluateHandle(() => {
    const element = document.createElement("div");
    element.setAttribute("aria-hidden", "true");
    element.style.height = `${innerHeight}px`;
    document.body.append(element);
    return element;
  });
  try {
    await table.evaluate((element) =>
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().bottom - 80),
    );
    await expect
      .poll(async () => {
        const header = await heading.boundingBox();
        const bounds = await table.boundingBox();
        return header && bounds
          ? Math.abs(header.y + header.height - bounds.y - bounds.height)
          : Infinity;
      })
      .toBeLessThanOrEqual(2);
    await page.evaluate(() => window.scrollBy(0, 100));
    await expect
      .poll(async () => {
        const header = await heading.boundingBox();
        return header ? header.y + header.height : Infinity;
      })
      .toBeLessThanOrEqual(0);
  } finally {
    await tail.evaluate((element) => element.remove());
    await tail.dispose();
    await originalHeading.dispose();
    await page.evaluate(() => window.scrollTo(0, 0));
    await region.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
}

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
    await page.clock.setFixedTime(new Date("2026-10-12T15:00:00Z"));
    await page.goto(`${origin}/app/gestao`);
    await page.getByRole("link", { name: "Rotina", exact: true }).last().click();
    await expect(page).toHaveURL(`${origin}${route}`);
    const save = page.getByRole("button", { name: "Salva alterações", exact: true });
    await expect(save).toBeEnabled();
    await expect(page.getByRole("tab")).toHaveText(roleLabels);
    const modes = page.getByRole("group", { name: "Visualização da rotina", exact: true });
    await expect(modes.getByRole("button", { name: "Semana", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("thead th")).toHaveCount(7);
    await expect(page.locator("caption")).toHaveText(
      "Rotina semanal editável para gerente regional house.",
    );
    await expect(page.getByRole("textbox", { name: /Domingo/ })).toHaveCount(0);
    const house = page.getByRole("tab", { name: "Gerente regional house", exact: true });
    await expect(house).toHaveAttribute("aria-selected", "true");
    const initialRows = await page.locator("tbody tr").count();
    assert.equal(initialRows, 26, "Complete house routine must retain the reference rows");
    const filled = await page
      .getByRole("textbox")
      .evaluateAll((fields) => fields.filter((field) => field.value.trim().length > 0).length);
    assert.equal(filled, 74, "All reference activities must remain present");

    checkpoint("edit-insert-save-reload");
    const first = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });

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
      const tab = page.getByRole("tab", { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("tbody tr")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Inserir linha", exact: true })).toBeVisible();
    }
    await house.click();
    await house.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Gerente regional imob/ })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(house).toBeFocused();
    await expect(house).toHaveAttribute("aria-selected", "true");

    checkpoint("daily-mode-and-sunday-storage");
    await modes.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(modes.getByRole("button", { name: "Hoje", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("region", { name: "Tabela de rotina do dia", exact: true }),
    ).toBeVisible();
    await expect(page.locator("thead th")).toHaveCount(2);
    await expect(page.locator("caption")).toHaveText(
      "Rotina do dia editável para gerente regional house.",
    );
    await expect(first).toHaveValue("Atividade sintética de validação.");
    await first.fill("");
    await expect(first).toBeVisible();
    await first.fill("Atividade diária sintética.");
    await save.click();
    await page.evaluate((key) => {
      const value = JSON.parse(localStorage.getItem(key));
      value["regional-house"][0].Domingo = "Domingo legado QA";
      localStorage.setItem(key, JSON.stringify(value));
    }, storageKey);
    await page.reload();
    await expect(save).toBeEnabled();
    await modes.getByRole("button", { name: "Hoje", exact: true }).click();
    await page.clock.setFixedTime(new Date("2026-10-11T15:00:00Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByText("Sem rotina aos domingos.", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await modes.getByRole("button", { name: "Semana", exact: true }).click();
    await save.click();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key))["regional-house"][0].Domingo,
        storageKey,
      ),
      "Domingo legado QA",
    );
    await expect(page.getByRole("textbox", { name: /Domingo/ })).toHaveCount(0);
    await page.evaluate((key) => localStorage.removeItem(key), storageKey);
    await page.clock.setFixedTime(new Date("2026-10-12T15:00:00Z"));
    await page.reload();
    await expect(save).toBeEnabled();
    await expect(page.locator("tbody tr")).toHaveCount(initialRows);

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
        await expect(
          page.getByRole("heading", { name: "Rotina semanal e diária", exact: true }),
        ).toBeVisible();
        await expect(page.locator("h1")).toHaveCSS("font-size", width <= 760 ? "24px" : "32px");
        await expect(page.locator("h1")).toHaveCSS("font-weight", "400");
        assert.equal(
          await page
            .locator("textarea")
            .evaluateAll((fields) =>
              fields.every((field) => getComputedStyle(field).textAlign === "center"),
            ),
          true,
          "Semana editors must remain centered",
        );
        assert.equal(
          await page
            .locator("tbody td")
            .evaluateAll((cells) =>
              cells.every((cell) => getComputedStyle(cell).verticalAlign === "middle"),
            ),
          true,
          "Semana cells must remain vertically centered",
        );
        await expect(page.locator('thead [aria-current="date"]')).toHaveCount(1);
        await expect(page.locator("tbody td[data-today]")).toHaveCount(initialRows);
        const editorStyle = await page
          .locator("textarea")
          .first()
          .evaluate((field) => {
            const css = getComputedStyle(field);
            return {
              radius: css.borderRadius,
              background: css.backgroundColor,
              resize: css.resize,
            };
          });
        assert.deepEqual(
          editorStyle,
          {
            radius: "0px",
            background: "rgba(0, 0, 0, 0)",
            resize: "none",
          },
          "Routine editors must remain continuous spreadsheet cells under global styles",
        );
        await expect(
          page.locator(".simulation-canvas-eyebrow, .simulation-canvas-status"),
        ).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Restaurar/ })).toHaveCount(0);
        await expect
          .poll(() =>
            page
              .locator("textarea")
              .evaluateAll((fields) =>
                fields.every((field) => field.scrollHeight <= field.clientHeight + 1),
              ),
          )
          .toBe(true);
        if (width < 960) {
          const scroll = page.getByRole("region", {
            name: "Tabela de rotina semanal",
            exact: true,
          });
          const scrolling = await scroll.evaluate((element) => {
            element.scrollLeft = element.scrollWidth;
            const reachedEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
            element.scrollLeft = 0;
            return reachedEnd;
          });
          assert.equal(scrolling, true, "Every weekday must remain reachable within the table");
        }
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
        checks.push({ width, theme, mode: "Semana", overflow: false, accessibilityViolations: 0 });
        checkpoint(`window-scroll-${width}-${theme}`);
        const weekly = page.getByRole("region", { name: "Tabela de rotina semanal", exact: true });
        await checkRoutineScrolling(page, weekly);
        checkpoint(`daily-layout-${width}-${theme}`);
        await modes.getByRole("button", { name: "Hoje", exact: true }).click();
        const daily = page.getByRole("region", { name: "Tabela de rotina do dia", exact: true });
        await expect
          .poll(() => daily.evaluate((element) => [element.scrollTop, element.scrollLeft]))
          .toEqual([0, 0]);
        await expect(daily.locator("thead th")).toHaveCount(2);
        await expect
          .poll(() =>
            daily
              .locator("textarea")
              .evaluateAll((fields) =>
                fields.every((field) => getComputedStyle(field).textAlign === "left"),
              ),
          )
          .toBe(true);
        const dailySize = () =>
          daily.evaluate((element) => ({
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
        process.stdout.write(
          `[routine-daily-size-initial] ${JSON.stringify({ width, theme, ...(await dailySize()) })}\n`,
        );
        await expect
          .poll(
            async () => {
              const size = await dailySize();
              return size.scrollWidth > size.width + 1;
            },
            { message: "Daily mode must fit without horizontal scroll" },
          )
          .toBe(false);
        process.stdout.write(
          `[routine-daily-size-settled] ${JSON.stringify({ width, theme, ...(await dailySize()) })}\n`,
        );
        checkpoint(`daily-accessibility-${width}-${theme}`);
        await page.waitForFunction(() =>
          document.documentElement
            .getAnimations({ subtree: true })
            .filter((animation) => animation instanceof CSSTransition)
            .every((animation) => animation.playState !== "running" && !animation.pending),
        );
        const dailyAxe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        process.stdout.write(
          `[routine-accessibility] ${JSON.stringify({ width, theme, violations: dailyAxe.violations.map(({ id }) => id) })}\n`,
        );
        assert.deepEqual(
          dailyAxe.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map(({ target }) => target),
          })),
          [],
          `Daily routine accessibility at ${width}px in ${theme}`,
        );
        await page.screenshot({
          path: path.join(outputDirectory, `rotina-hoje-${width}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
          mask: [page.locator("[data-session-identity], [data-account-identity]")],
        });
        checks.push({ width, theme, mode: "Hoje", overflow: false, accessibilityViolations: 0 });
        await modes.getByRole("button", { name: "Semana", exact: true }).click();
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
      modes: true,
      sundayStoragePreserved: true,
      checks,
      passed: true,
    };
  } catch (error) {
    process.stderr.write(`[routine-settings] failed-stage=${stage}\n`);
    throw error;
  } finally {
    try {
      // Playwright clocks are context-wide; restore advancing time for later checks.
      await page.clock.setSystemTime(new Date());
    } finally {
      await page.evaluate((key) => window.localStorage.removeItem(key), storageKey).catch(() => {});
    }
  }
}
