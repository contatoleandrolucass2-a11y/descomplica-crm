import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

export {
  buildRoutineCompletionsPreview,
  createRoutineCompletionsFixture,
  openRoutineCompletionsPreview,
} from "./routine-completions-preview.mjs";

const roleLabels = [
  "Gerente regional house",
  "Gerente regional imob",
  "Gerente house",
  "Coordenador de vendas",
  "Coordenador de parcerias",
  "Corretor",
];

export async function checkRoutineCompletions(page, origin, outputDirectory, { readerPage } = {}) {
  assert.ok(
    readerPage,
    "Routine completion isolation requires an independently authenticated readerPage",
  );
  assert.notEqual(page.context(), readerPage.context(), "Reader must use an independent context");
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
    "Routine completion QA only runs against isolated loopback",
  );
  assert.equal(process.env.QA_AUTH_FIXTURE_VERIFICATION, "rls-marker-v1");
  assert.match(process.env.QA_AUTH_EMAIL ?? "", /^qa\..+@local\.invalid$/);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(process.env.QA_AUTH_SUPABASE_URL ?? "http://invalid").hostname,
    ),
    "Completion writes require the isolated loopback database",
  );
  const endpoint = `${origin}/api/routines/completions`;
  const errors = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === "error") errors.push(message.text());
  };
  const pages = [page, readerPage];
  const initial = [];
  const lastWritten = new Map();
  const checks = [];
  let activity;
  let week;
  const api = async (target, pathname, body) => {
    const response = await target.evaluate(
      async ({ url, body }) => {
        const result = await fetch(url, {
          cache: "no-store",
          ...(body
            ? {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        });
        return {
          status: result.status,
          cache: result.headers.get("cache-control"),
          data: await result.json(),
        };
      },
      { url: `${origin}${pathname}`, body },
    );
    assert.equal(response.status, 200, `Authenticated routine API ${pathname}`);
    assert.match(response.cache ?? "", /no-store/);
    return response.data;
  };
  const read = async (target) => {
    const snapshot = await api(target, "/api/routines/completions");
    assert.match(snapshot.week_start, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(snapshot.server_now)));
    assert.ok(Date.parse(snapshot.resets_at) > Date.parse(snapshot.server_now));
    assert.ok(Array.isArray(snapshot.completions));
    if (week)
      assert.equal(
        snapshot.week_start,
        week,
        "Week changed during QA; rerun in a stable server week",
      );
    return snapshot;
  };
  const completed = (snapshot) =>
    snapshot.completions.some((item) =>
      Object.entries(activity).every(([key, value]) => item[key] === value),
    );
  const box = (target) =>
    target.getByRole("checkbox", {
      name: `Concluída: ${activity.day}, linha ${activity.row_index + 1}, ${activity.activity_text}`,
      exact: true,
    });
  const put = async (target, value) => {
    const data = await api(target, "/api/routines/completions", {
      ...activity,
      completed: value,
      expected_week_start: week,
    });
    assert.equal(data.week_start, week);
    assert.equal(completed(data), value);
    lastWritten.set(target, value);
  };
  const uiToggle = async (target, value) => {
    await expect(box(target)).toBeEnabled();
    await expect(box(target)).toBeChecked({ checked: !value });
    const responsePromise = target.waitForResponse(
      (response) => response.url() === endpoint && response.request().method() === "PUT",
    );
    await box(target).focus();
    await target.keyboard.press("Space");
    const response = await responsePromise;
    assert.equal(response.status(), 200, "Completion PUT must reach the authenticated backend");
    assert.match(response.headers()["cache-control"] ?? "", /no-store/);
    assert.deepEqual(response.request().postDataJSON(), {
      ...activity,
      completed: value,
      expected_week_start: week,
    });
    const data = await response.json();
    assert.equal(data.week_start, week);
    assert.equal(completed(data), value);
    lastWritten.set(target, value);
    await expect(box(target)).toBeChecked({ checked: value });
    await expect(box(target)).toBeEnabled();
    assert.equal(completed(await read(target)), value);
  };
  for (const target of pages) {
    assert.equal(new URL(target.url()).origin, origin);
    target.on("pageerror", onError);
    target.on("console", onConsole);
  }
  try {
    const shared = await api(page, "/api/routines");
    const readerShared = await api(readerPage, "/api/routines");
    assert.equal(shared.can_edit, true, "Primary session must be an editor");
    assert.equal(
      readerShared.can_edit,
      false,
      "Second session must be a reader, not cloned editor credentials",
    );
    assert.deepEqual(readerShared.routines, shared.routines);
    const record = shared.routines.find((item) => item.role_key === "regional-house");
    assert.ok(record?.revision > 0, "Shared role must already be saved before checking activities");
    const row_index = record.rows.findIndex((row) => row["Segunda-feira"].trim());
    assert.ok(row_index >= 0);
    activity = {
      role_key: record.role_key,
      row_index,
      day: "Segunda-feira",
      activity_text: record.rows[row_index]["Segunda-feira"],
    };
    for (const target of pages) {
      const snapshot = await read(target);
      week ??= snapshot.week_start;
      initial.push(completed(snapshot));
    }
    // Touch only one known activity, retaining both users' initial marks for cleanup.
    for (const target of pages) {
      await put(target, false);
      await target.reload();
    }
    await expect(
      readerPage.getByRole("button", { name: "Salva alterações", exact: true }),
    ).toHaveCount(0);
    await expect(
      readerPage.getByRole("button", { name: "Inserir linha", exact: true }),
    ).toHaveCount(0);
    assert.equal(
      await readerPage
        .locator("textarea")
        .evaluateAll((fields) => fields.length > 0 && fields.every((field) => field.readOnly)),
      true,
    );
    await uiToggle(page, true);
    assert.equal(
      completed(await read(readerPage)),
      false,
      "Editor's mark must not leak to the reader",
    );
    await readerPage.reload();
    await expect(box(readerPage)).not.toBeChecked();
    await uiToggle(readerPage, true);
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(box(page)).toBeChecked();
    await uiToggle(page, false);
    await page.getByRole("button", { name: "Semana", exact: true }).click();
    await expect(box(page)).not.toBeChecked();
    assert.equal(
      completed(await read(readerPage)),
      true,
      "Editor uncheck must not erase reader's mark",
    );
    for (const [index, target] of pages.entries()) {
      await target.reload();
      await expect(box(target)).toBeChecked({ checked: index === 1 });
      for (const mode of ["Semana", "Hoje"]) {
        await target
          .getByRole("group", { name: "Visualização da rotina", exact: true })
          .getByRole("button", { name: mode, exact: true })
          .click();
        await expect(box(target)).toBeChecked({ checked: index === 1 });
        const result = await new AxeBuilder({ page: target })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        assert.deepEqual(
          result.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map(({ target }) => target),
          })),
          [],
          `Completion accessibility: ${index === 0 ? "editor" : "reader"}, ${mode}`,
        );
        checks.push({
          session: index === 0 ? "editor" : "reader",
          mode,
          accessibilityViolations: 0,
        });
      }
    }
    await uiToggle(readerPage, false);
    await readerPage.getByRole("button", { name: "Semana", exact: true }).click();
    await expect(box(readerPage)).not.toBeChecked();
    await uiToggle(readerPage, true);
    await readerPage.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(box(readerPage)).toBeChecked();
    assert.equal(completed(await read(page)), false);
    assert.deepEqual(
      (await api(page, "/api/routines")).routines,
      shared.routines,
      "Personal completions must not change shared text or revisions",
    );
    await mkdir(outputDirectory, { recursive: true });
    await readerPage.screenshot({
      path: path.join(outputDirectory, "rotina-conclusao-leitor.png"),
      fullPage: true,
      animations: "disabled",
      mask: [readerPage.locator("[data-session-identity], [data-account-identity]")],
    });
    assert.deepEqual(errors, [], "Editor and reader must have no console or runtime errors");
    return {
      passed: true,
      distinctReaderUser: true,
      persistence: true,
      keyboard: true,
      sharedTextsUnchanged: true,
      crossViewSynchronization: true,
      week_start: week,
      checks,
      consoleErrors: 0,
      reset:
        "covered separately by synthetic server-clock browser tests; real rollover not exercised",
    };
  } finally {
    try {
      for (const [index, target] of pages.entries()) {
        if (!lastWritten.has(target)) continue;
        const current = await read(target);
        assert.equal(
          completed(current),
          lastWritten.get(target),
          "Concurrent completion write blocks QA cleanup",
        );
        if (completed(current) !== initial[index]) await put(target, initial[index]);
        await target
          .getByRole("group", { name: "Visualização da rotina", exact: true })
          .getByRole("button", { name: "Semana", exact: true })
          .click();
      }
    } finally {
      for (const target of pages) {
        target.off("pageerror", onError);
        target.off("console", onConsole);
      }
    }
  }
}

export async function checkRoutineScrolling(page, region) {
  const topbar = page.locator("[data-protected-topbar]");
  await expect(topbar).toHaveCount(1);
  const heading = region.locator("thead th").nth(1);
  const originalHeading = await heading.elementHandle();
  const table = region.locator("table");
  const insert = page.getByRole("button", { name: "Inserir linha", exact: true });
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
  assert.equal(overflow.overflowX, "visible");
  await checkRoutineOverflow(page, region);
  assert.ok(
    overflow.excessHeight <= 1,
    "Routine must have natural height without internal vertical overflow",
  );
  assert.equal(overflow.scrollTop, 0);
  await checkRoutineCurrentColumn(page);
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
  await checkRoutineCurrentColumn(page);
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
  for (const locator of [
    page.locator("h1"),
    page.getByRole("combobox", { name: "Rotina", exact: true }),
    insert,
  ]) {
    const box = await locator.boundingBox();
    assert.ok(
      box && box.y + box.height <= 0,
      "Title, role selector and header controls must scroll out of the viewport",
    );
  }
  await expect(page.locator("thead")).toHaveCount(1);
  assert.equal(
    await heading.evaluate((element, original) => element === original, originalHeading),
    true,
  );
  await page.evaluate(() => window.scrollTo(document.documentElement.scrollWidth, window.scrollY));
  const horizontal = await heading.boundingBox();
  const offset = await page.evaluate(() => window.scrollX);
  assert.ok(horizontal);
  assert.ok(
    Math.abs(horizontal.x - pinned.x + offset) <= 2,
    "Real day header must follow horizontal page scroll",
  );
  assert.ok(Math.abs(horizontal.y - pinned.y) <= 2);
  await checkRoutineCurrentColumn(page);
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
    await checkRoutineCurrentColumn(page);
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

async function withRoutineMotionModes(page, check, inspect) {
  const originalMotion = await page.evaluate(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "no-preference",
  );
  let phase = "initialize-motion";
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    return await inspect((value) => {
      phase = value;
    });
  } catch (error) {
    // Fixed labels and viewport only: never log DOM, API payloads or identities.
    process.stderr.write(
      `[routine-effects] ${JSON.stringify({
        check,
        phase,
        originalMotion,
        viewport: page.viewportSize(),
        kind: error instanceof assert.AssertionError ? "assertion" : "check-failed",
      })}\n`,
    );
    throw error;
  } finally {
    await page.emulateMedia({ reducedMotion: originalMotion });
  }
}

export async function checkRoutineCurrentColumn(page) {
  const overlay = page.locator("[data-routine-current-column]");
  const today = page.locator("thead [data-today]");
  if (!(await today.count()) || !(await page.locator("tbody tr").count())) {
    await expect(overlay).toHaveCount(0);
    return;
  }
  await expect(overlay).toHaveCount(1);
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(overlay).toHaveCSS("visibility", "visible");
  await expect(overlay).toHaveCSS("pointer-events", "none");
  assert.equal(
    await overlay.evaluate((element) => element.parentElement?.matches('[role="region"]')),
    true,
    "Current column belongs to the table wrapper",
  );
  await expect
    .poll(
      () =>
        overlay.evaluate((element) => {
          const table = element.parentElement.querySelector("table");
          const heading = table.querySelector("thead [data-today]");
          const column = element.getBoundingClientRect();
          const head = heading.getBoundingClientRect();
          const bounds = table.getBoundingClientRect();
          return Math.max(
            Math.abs(column.left - head.left),
            Math.abs(column.width - head.width),
            Math.abs(column.top - head.top),
            Math.abs(column.bottom - bounds.bottom),
          );
        }),
      { message: "One outline follows the current header through the bottom of the table" },
    )
    .toBeLessThanOrEqual(2);
  const effect = await overlay.evaluate((element) => {
    const css = getComputedStyle(element, "::before");
    return {
      background: css.backgroundImage,
      name: css.animationName,
      duration: css.animationDuration,
      iterations: css.animationIterationCount,
      pointer: css.pointerEvents,
      mask: css.maskComposite,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });
  assert.match(effect.background, /conic-gradient/);
  const colors = effect.background.match(/rgba?\([^)]+\)/g) ?? [];
  assert.ok(colors.includes("rgb(255, 255, 255)"), "Column outline includes white");
  assert.ok(
    colors.every(
      (color) =>
        /^rgba?\(255, 255, 255(?:, [\d.]+)?\)$/.test(color) || color === "rgba(0, 0, 0, 0)",
    ),
    "Column outline contains white and transparency only",
  );
  assert.equal(effect.pointer, "none");
  assert.deepEqual(effect.mask.split(", "), ["exclude", "exclude"]);
  if (effect.reduced) assert.equal(effect.name, "none");
  else {
    assert.notEqual(effect.name, "none");
    assert.equal(effect.duration, "4.5s");
    assert.equal(effect.iterations, "infinite");
  }
}

export async function checkRoutineHeaderEffects(page) {
  return withRoutineMotionModes(page, "header", (checkpoint) =>
    checkRoutineHeaderEffectsInMotion(page, checkpoint),
  );
}

async function checkRoutineHeaderEffectsInMotion(page, checkpoint) {
  checkpoint("structure");
  const header = page.locator("header").filter({ has: page.locator("h1") });
  const modes = page.getByRole("group", { name: "Visualização da rotina", exact: true });
  const insert = page.getByRole("button", { name: "Inserir linha", exact: true });
  const save = page.getByRole("button", { name: "Salva alterações", exact: true });
  await expect(
    header.getByRole("group", { name: "Visualização da rotina", exact: true }),
  ).toHaveCount(1);
  await expect(header.getByRole("button", { name: "Inserir linha", exact: true })).toHaveCount(1);
  await expect(page.locator("#routine-table-title, [class*='tableToolbar']")).toHaveCount(0);
  await expect(
    page.locator('section[id^="routine-panel-"]:not([hidden])').locator("h2"),
  ).toHaveCount(0);
  await expect(page.locator("caption")).toContainText("gerente regional house");
  const controls = [modes, insert, save];
  const boxes = [];
  for (const control of controls) {
    checkpoint(`control-geometry-${boxes.length}`);
    await expect(control).toBeVisible();
    assert.equal(await control.evaluate((element) => element.closest("header") !== null), true);
    const box = await control.boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0);
    const viewport = page.viewportSize();
    assert.ok(
      box.x >= -1 && box.x + box.width <= viewport.width + 1,
      "Header control fits viewport",
    );
    assert.equal(
      await control.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      true,
    );
    boxes.push(box);
  }
  for (let index = 1; index < controls.length; index++) {
    checkpoint(`control-order-${index}`);
    const previous = await controls[index - 1].elementHandle();
    assert.equal(
      await controls[index].evaluate(
        (element, before) =>
          Boolean(before.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
        previous,
      ),
      true,
    );
    await previous.dispose();
    const before = boxes[index - 1];
    const after = boxes[index];
    assert.ok(after.y >= before.y - 1, "Controls retain visual reading order");
  }
  checkpoint("control-overlap");
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++) {
      const first = boxes[a],
        second = boxes[b];
      assert.ok(
        Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) <=
          1 ||
          Math.min(first.y + first.height, second.y + second.height) -
            Math.max(first.y, second.y) <=
            1,
        "Header controls must not overlap",
      );
    }
  for (const button of await header.getByRole("button").all()) {
    const effect = await button.evaluate((element) => {
      const css = getComputedStyle(element, "::before");
      return { image: css.backgroundImage, animation: css.animationName };
    });
    assert.equal(effect.image, "none", "Header buttons must not retain a decorative gradient");
    assert.equal(effect.animation, "none");
  }
  for (const [index, heading] of (await page.locator("thead th").all()).entries()) {
    checkpoint(`weekday-effect-${index}`);
    const style = await heading.evaluate((element) => {
      const css = getComputedStyle(element),
        border = getComputedStyle(element, "::before");
      const probe = document.createElement("span");
      probe.style.backgroundColor =
        "color-mix(in srgb, var(--inv-color-accent) 14%, var(--inv-color-panel))";
      element.append(probe);
      const expectedSurface = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        background: css.backgroundImage,
        surface: css.backgroundColor,
        expectedSurface,
        color: css.color,
        image: border.backgroundImage,
        animation: border.animationName,
        theme: document.documentElement.dataset.theme,
      };
    });
    assert.equal(style.background, "none", "Day headers must not use the completion gradient");
    assert.equal(
      style.surface,
      style.expectedSurface,
      "All headers use the former selected-tab blue token",
    );
    assert.equal(style.image, "none", "The column overlay is the only animated header outline");
    assert.equal(style.animation, "none");
    if (style.theme === "dark") assert.equal(style.color, "rgb(255, 255, 255)");
  }
  checkpoint("current-column");
  await checkRoutineCurrentColumn(page);
  checkpoint("footer-motion");
  const footer = page
    .locator("footer")
    .filter({ hasText: "Desenvolvido e gerenciado por Leandro Lucas" });
  await expect(footer).toHaveCount(1);
  const credit = footer.getByText("Desenvolvido e gerenciado por Leandro Lucas", { exact: true });
  const creditColor =
    (await page.locator("html").getAttribute("data-theme")) === "dark"
      ? "rgb(255, 255, 255)"
      : "rgb(24, 53, 79)";
  await expect(credit).toHaveCSS("color", creditColor);
  await expect(credit).toHaveCSS("animation-duration", "0.65s, 4.5s");
  await expect(footer).toHaveCSS("text-align", "right");
  await expect(footer).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(footer).toHaveCSS("border-top-width", "0px");
  const frames = await credit.evaluate((element) =>
    element.getAnimations().map((animation) =>
      animation.effect.getKeyframes().map((frame) => {
        const matrix = frame.transform ? new DOMMatrixReadOnly(frame.transform) : null;
        return {
          x: matrix?.m41,
          y: matrix?.m42,
          opacity: Number(frame.opacity),
          backgroundX: frame.backgroundPositionX,
        };
      }),
    ),
  );
  checkpoint("footer-entry-direction");
  assert.ok(
    frames.some(
      (sequence) =>
        sequence[0].x === 24 &&
        sequence[0].y === 0 &&
        sequence[0].opacity === 0 &&
        sequence.at(-1).x === 0 &&
        sequence.at(-1).y === 0 &&
        sequence.at(-1).opacity === 1,
    ),
    "Credit arrives from right to left",
  );
  checkpoint("footer-shimmer-direction");
  assert.ok(
    frames.some(
      (sequence) => sequence[0].backgroundX === "-150%" && sequence.at(-1).backgroundX === "150%",
    ),
    "Oversized shimmer moves from right to left",
  );
  const today = page.locator('thead [aria-current="date"]');
  await expect(today.getByText("Hoje", { exact: true })).toBeVisible();
  const animations = () =>
    credit.evaluate((element) =>
      [null, "::before", "::after"].map(
        (pseudo) => getComputedStyle(element, pseudo).animationName,
      ),
    );
  assert.ok(
    (await animations()).some((name) => name !== "none"),
    "Footer credit has shimmer",
  );
  checkpoint("reduced-motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    assert.ok(
      (await animations()).every((name) => name === "none"),
      "Reduced motion stops footer shimmer",
    );
    for (const item of [save, ...(await page.locator("thead th:not(:first-child)").all())])
      assert.equal(
        await item.evaluate((element) => getComputedStyle(element, "::before").animationName),
        "none",
      );
    await checkRoutineCurrentColumn(page);
    await expect(credit).toHaveCSS("color", creditColor);
    await expect(credit).toHaveCSS("-webkit-text-fill-color", creditColor);
  } finally {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
}

export async function checkRoutineCellEffects(page, outputDirectory) {
  return withRoutineMotionModes(page, "cells", (checkpoint) =>
    checkRoutineCellEffectsInMotion(page, outputDirectory, checkpoint),
  );
}

export async function checkRoutineCompactLayout(page) {
  const layout = await page.locator("tbody td").evaluateAll((cells) =>
    cells.flatMap((cell) => {
      const input = cell.querySelector('input[type="checkbox"]');
      if (!input) return [];
      const label = input.closest("label");
      const editor = cell.querySelector("textarea");
      const content = editor?.parentElement;
      if (!label || !editor || !content) return [{ valid: false }];
      const checkbox = input.getBoundingClientRect();
      const control = label.getBoundingClientRect();
      const text = editor.getBoundingClientRect();
      const bounds = cell.getBoundingClientRect();
      const daily = cell.closest("table").dataset.view === "day";
      const editorStyle = getComputedStyle(editor);
      const firstLineCenter =
        text.top + parseFloat(editorStyle.paddingTop) + parseFloat(editorStyle.lineHeight) / 2;
      // Touch controls can exceed the textarea's 32px minimum height.
      const alignmentTolerance = Math.max(
        2,
        (control.height - parseFloat(editorStyle.minHeight)) / 2 + 0.5,
      );
      return [
        {
          valid:
            cell.firstElementChild === content &&
            label.parentElement === content &&
            content.firstElementChild === label &&
            content.lastElementChild === editor,
          grid: getComputedStyle(content).display,
          firstTrack: parseFloat(getComputedStyle(content).gridTemplateColumns),
          noOverlap:
            control.right <= text.left + 1 &&
            text.width > 0 &&
            text.right <= bounds.right + 1 &&
            control.left >= bounds.left,
          aligned: daily
            ? Math.abs(checkbox.top + checkbox.height / 2 - firstLineCenter) <= alignmentTolerance
            : control.top - bounds.top >= 0 &&
              control.top - bounds.top <= 12 &&
              control.left - bounds.left <= 12,
        },
      ];
    }),
  );
  assert.ok(layout.length > 0, "Compact layout requires activities with checkboxes");
  for (const cell of layout) {
    assert.equal(cell.valid, true, "Checkbox must precede textarea inside the cell content");
    assert.equal(cell.grid, "grid");
    assert.equal(
      cell.firstTrack,
      await page.evaluate(() => (matchMedia("(pointer: coarse)").matches ? 44 : 28)),
    );
    assert.equal(cell.noOverlap, true, "Checkbox and text must occupy separate grid tracks");
    assert.equal(
      cell.aligned,
      true,
      "Checkbox must be top-left in Semana and aligned with the first text line in Hoje",
    );
  }
}

export async function checkRoutineOverflow(page, region) {
  const metrics = await region.evaluate((element) => {
    const table = element.querySelector("table");
    const style = getComputedStyle(element);
    const bounds = table.getBoundingClientRect();
    return {
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      minWidth: getComputedStyle(table).minWidth,
      day: table.dataset.view === "day",
      tableOverflow: bounds.width > element.clientWidth + 1,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.equal(metrics.overflowX, "visible", "Routine must not own a horizontal scroller");
  assert.equal(metrics.overflowY, "visible", "Routine must not own a vertical scroller");
  assert.equal(metrics.scrollLeft, 0);
  assert.equal(metrics.scrollTop, 0);
  assert.equal(metrics.minWidth, metrics.day ? "0px" : "960px");
  assert.equal(
    metrics.pageOverflow,
    metrics.tableOverflow,
    "Page overflow is allowed only when the routine table exceeds the available width",
  );
  if (metrics.day) assert.equal(metrics.pageOverflow, false, "Hoje must fit the viewport");
  const position = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  try {
    await page.evaluate(() => window.scrollTo(document.documentElement.scrollWidth, scrollY));
    const last = await region.locator("thead th").last().boundingBox();
    assert.ok(
      last && last.x >= -1 && last.x + last.width <= page.viewportSize().width + 1,
      "The last weekday must be fully reachable through page scrolling",
    );
    assert.equal(await region.evaluate((element) => element.scrollLeft), 0);
    if (metrics.tableOverflow) assert.ok(await page.evaluate(() => scrollX > 0));
  } finally {
    await page.evaluate(({ x, y }) => window.scrollTo(x, y), position);
  }
  return metrics;
}

async function checkRoutineNeutralCells(page) {
  const cells = await page.locator("tbody td:not([data-completed])").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      const page = element.closest(".investor-page-shell");
      return {
        color: style.backgroundColor,
        image: style.backgroundImage,
        pageColor: getComputedStyle(page).backgroundColor,
      };
    }),
  );
  assert.ok(cells.length > 0);
  for (const cell of cells) {
    assert.equal(cell.image, "none", "Unchecked cells must never have a gradient");
    assert.equal(cell.color, cell.pageColor, "Unchecked cells must match the page background");
  }
  await expect(page.locator("tbody [data-today]")).toHaveCount(0);
}

async function checkRoutineCellEffectsInMotion(page, outputDirectory, checkpoint) {
  const capture = async (mode) => {
    if (!outputDirectory) return;
    await mkdir(outputDirectory, { recursive: true });
    const theme = await page.locator("html").getAttribute("data-theme");
    await page.screenshot({
      path: path.join(
        outputDirectory,
        `compact-cell-${mode}-${theme}-${page.viewportSize().width}.png`,
      ),
      animations: "disabled",
      mask: [page.locator("[data-session-identity], [data-account-identity]")],
    });
  };
  const settle = () =>
    page.waitForFunction(() =>
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .every((animation) => animation.playState !== "running" && !animation.pending),
    );
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  const values = () =>
    page.locator("tbody textarea").evaluateAll((fields) => fields.map((field) => field.value));
  const initialValues = await values();
  for (const mode of ["Semana", "Hoje"]) {
    checkpoint(`${mode}-neutral`);
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.mouse.move(0, 0);
    await page.evaluate(
      () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
    );
    await settle();
    await checkRoutineCompactLayout(page);
    await checkRoutineNeutralCells(page);
    const target = page
      .locator("tbody td:not([data-completed])")
      .filter({ has: page.locator("textarea") })
      .first();
    const dimensions = () =>
      page
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) =>
            Array.from(row.children).map((cell) => [
              cell.offsetWidth,
              cell.offsetHeight,
              cell.offsetLeft,
              cell.offsetTop,
            ]),
          ),
        );
    const geometry = await dimensions();
    for (const state of ["hover", "focus", "peer-hover"]) {
      checkpoint(`${mode}-${state}`);
      if (state === "hover") await target.hover();
      if (state === "focus") await target.locator("textarea").focus();
      if (state === "peer-hover")
        await page.locator("tbody tr").nth(1).locator("td").first().hover();
      await settle();
      await checkRoutineNeutralCells(page);
      assert.deepEqual(await dimensions(), geometry, "Hover and focus never change table geometry");
      const scale = await target.evaluate((element) =>
        [element, element.querySelector("textarea")].every((node) => {
          const css = getComputedStyle(node);
          return (
            (css.transform === "none" || new DOMMatrixReadOnly(css.transform).a === 1) &&
            (css.scale === "none" || Number(css.scale) === 1)
          );
        }),
      );
      assert.equal(scale, true, "Compact cells must not enlarge on hover or focus");
      if (state !== "hover") {
        await expect(target.locator("textarea")).toBeFocused();
        const focus = await target.evaluate((element) => {
          const css = getComputedStyle(element);
          const luminance = (color) => {
            const channels = color
              .match(/[0-9.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((value) => {
                const channel = value / 255;
                return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const outline = luminance(css.outlineColor);
          const background = luminance(css.backgroundColor);
          return {
            width: parseFloat(css.outlineWidth),
            style: css.outlineStyle,
            contrast:
              (Math.max(outline, background) + 0.05) / (Math.min(outline, background) + 0.05),
          };
        });
        assert.equal(focus.style, "solid");
        assert.ok(focus.width >= 2);
        assert.ok(focus.contrast >= 3, "Neutral cell focus must keep at least 3:1 contrast");
      }
      await capture(`${mode}-${state}`);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    try {
      await expect(target).toHaveCSS("transform", "none");
      await expect(target).toHaveCSS("transition-duration", "0s");
      assert.deepEqual(await dimensions(), geometry, "Reduced motion preserves table layout");
    } finally {
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  }
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  assert.deepEqual(
    await values(),
    initialValues,
    "Hover, focus and view changes never edit routine data",
  );
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

export async function checkRoutineRefreshPosition(page) {
  const earlier = page.locator('textarea[data-row="6"]').first();
  await earlier.focus();
  await earlier.evaluate((field) => field.setSelectionRange(3, 8));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const position = await page.evaluate(() => window.scrollY);
  const last = page.locator("tbody tr").last().locator("td").first();
  const box = await last.boundingBox();
  assert.ok(box && box.y > 0, "Last row is visible at the bottom of the page");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const response = page.waitForResponse(
    (item) => item.url().endsWith("/api/routines") && item.request().method() === "GET",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  assert.ok((await response).ok(), "Background refresh succeeded");
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  assert.ok(
    Math.abs((await page.evaluate(() => window.scrollY)) - position) < 1,
    "Refresh must not jump away from the last rows",
  );
  await expect(earlier).toBeFocused();
  assert.deepEqual(
    await earlier.evaluate((field) => [field.selectionStart, field.selectionEnd]),
    [3, 8],
  );
  await earlier.evaluate((field) => field.blur());
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function checkRoutineSettings(page, origin, outputDirectory, { readerPage } = {}) {
  const target = new URL(origin);
  const database = new URL(process.env.QA_AUTH_SUPABASE_URL ?? "http://invalid");
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
      process.env.QA_AUTH_FIXTURE_VERIFICATION === "rls-marker-v1" &&
      /^qa\..+@local\.invalid$/.test(process.env.QA_AUTH_EMAIL ?? ""),
    "Routine writes require the verified isolated loopback runner and synthetic account",
  );
  if (!readerPage) {
    assert.match(process.env.QA_AUTH_ROUTINE_READER_EMAIL ?? "", /^qa\..+-reader@local\.invalid$/);
    assert.notEqual(
      process.env.QA_AUTH_ROUTINE_READER_EMAIL,
      process.env.QA_AUTH_EMAIL,
      "Routine reader must not reuse the editor account",
    );
    assert.ok(
      process.env.QA_AUTH_ROUTINE_READER_PASSWORD,
      "Routine QA requires the ephemeral reader credentials from the isolated local runner",
    );
  }
  let initialRowsSnapshot;
  let lastWrittenRevision;
  let peerContext;
  let ownedReaderContext;
  let sharedSessionVerified = false;
  let completionChecks;
  const api = async () => {
    const response = await page.request.get(`${origin}/api/routines`);
    assert.equal(response.status(), 200);
    assert.match(response.headers()["cache-control"] ?? "", /no-store/);
    return response.json();
  };
  const put = async (rows) => {
    const snapshot = await api();
    const expected_revision =
      snapshot.routines.find((record) => record.role_key === "regional-house")?.revision ?? 0;
    if (lastWrittenRevision !== undefined)
      assert.equal(
        expected_revision,
        lastWrittenRevision,
        "Unexpected concurrent writer in isolated QA",
      );
    const response = await page.request.put(`${origin}/api/routines`, {
      headers: { origin },
      data: { role_key: "regional-house", rows, expected_revision },
    });
    assert.equal(response.status(), 200, "Real routine PUT must succeed");
    const record = await response.json();
    assert.equal(record.revision, expected_revision + 1);
    lastWrittenRevision = record.revision;
    assert.deepEqual(record.rows, rows);
    return record;
  };
  const saveShared = async () => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${origin}/api/routines` && response.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Salva alterações", exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, "UI save must reach the real backend");
    const record = await response.json();
    lastWrittenRevision = record.revision;
    await expect(page.getByRole("status")).toContainText("Salvo no CRM");
    const snapshot = await api();
    assert.deepEqual(
      snapshot.routines.find((value) => value.role_key === record.role_key),
      record,
    );
    return record;
  };
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
    if (!readerPage) {
      ownedReaderContext = await page.context().browser().newContext({
        viewport: page.viewportSize(),
        reducedMotion: "reduce",
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
        serviceWorkers: "block",
      });
      readerPage = await ownedReaderContext.newPage();
      await readerPage.goto(`${origin}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      const consent = readerPage.getByRole("button", { name: "Aceitar todos", exact: true });
      if (await consent.isVisible()) await consent.click();
      await readerPage.getByLabel("E-mail").fill(process.env.QA_AUTH_ROUTINE_READER_EMAIL);
      await readerPage.getByLabel("Senha").fill(process.env.QA_AUTH_ROUTINE_READER_PASSWORD);
      await Promise.all([
        readerPage.waitForURL((url) => url.origin === origin && url.pathname === "/app", {
          timeout: 90_000,
        }),
        readerPage.getByRole("button", { name: "Entrar", exact: true }).click(),
      ]);
    }
    await page.clock.setFixedTime(new Date("2026-10-12T15:00:00Z"));
    await page.goto(`${origin}/app/gestao`);
    await page.getByRole("link", { name: "Rotina", exact: true }).last().click();
    await expect(page).toHaveURL(`${origin}${route}`);
    const save = page.getByRole("button", { name: "Salva alterações", exact: true });
    await expect(save).toBeEnabled();
    const selector = page.getByRole("combobox", { name: "Rotina", exact: true });
    await expect(selector).toHaveCount(1);
    await expect(selector).toHaveAttribute("id", "routine-role");
    await expect(selector.getByRole("option")).toHaveText(roleLabels);
    await expect(page.getByRole("tab")).toHaveCount(0);
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
    await expect(selector).toHaveValue("regional-house");
    const initialRows = await page.locator("tbody tr").count();
    assert.equal(initialRows, 26, "Complete house routine must retain the reference rows");
    const filled = await page
      .getByRole("textbox")
      .evaluateAll((fields) => fields.filter((field) => field.value.trim().length > 0).length);
    assert.equal(filled, 74, "All reference activities must remain present");

    const initialSnapshot = await api();
    assert.equal(initialSnapshot.can_edit, true);
    initialRowsSnapshot =
      initialSnapshot.routines.find((record) => record.role_key === "regional-house")?.rows ??
      (await page.locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => ({
          ...Object.fromEntries(
            Array.from(row.querySelectorAll("textarea")).map((field) => [
              field.getAttribute("aria-label").split(", linha ")[0],
              field.value,
            ]),
          ),
          Domingo: "",
        })),
      ));
    checkpoint("edit-insert-save-reload");
    const first = page.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true });

    await first.fill("Atividade sintética de validação.");
    await page.getByRole("button", { name: "Inserir linha", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(initialRows + 1);
    const addedLabel = `Terça-feira, linha ${initialRows + 1}`;
    await page
      .getByRole("textbox", { name: addedLabel, exact: true })
      .fill("Nova linha sintética.");
    await saveShared();
    await page.reload();
    await expect(save).toBeEnabled();
    await expect(first).toHaveValue("Atividade sintética de validação.");
    await expect(page.getByRole("textbox", { name: addedLabel, exact: true })).toHaveValue(
      "Nova linha sintética.",
    );

    checkpoint("empty-roles-and-keyboard");
    for (const label of roleLabels.slice(1)) {
      await selector.selectOption({ label });
      await expect(page.getByRole("region", { name: label, exact: true })).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(0);
      await expect(page.locator("[data-routine-current-column]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Inserir linha", exact: true })).toBeVisible();
    }
    await selector.selectOption("regional-house");
    await selector.focus();
    await page.keyboard.press("ArrowDown");
    await expect(selector).toHaveValue("regional-imob");
    await expect(selector).toBeFocused();
    await page.keyboard.press("Home");
    await expect(selector).toHaveValue("regional-house");
    await expect(selector).toBeFocused();

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
    await saveShared();
    const dailyRecord = (await api()).routines.find(
      (record) => record.role_key === "regional-house",
    );
    const sundayRows = structuredClone(dailyRecord.rows);
    sundayRows[0].Domingo = "Domingo legado QA";
    await put(sundayRows);
    await page.reload();
    await expect(save).toBeEnabled();
    await modes.getByRole("button", { name: "Hoje", exact: true }).click();
    await page.clock.setFixedTime(new Date("2026-10-11T15:00:00Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByText("Sem rotina aos domingos.", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await modes.getByRole("button", { name: "Semana", exact: true }).click();
    await first.fill("Conteúdo compartilhado entre sessões QA");
    await saveShared();
    assert.equal(
      (await api()).routines.find((record) => record.role_key === "regional-house").rows[0].Domingo,
      "Domingo legado QA",
    );
    await expect(page.getByRole("textbox", { name: /Domingo/ })).toHaveCount(0);

    checkpoint("shared-session-real-backend");
    let peer = readerPage;
    if (!peer) {
      peerContext = await page
        .context()
        .browser()
        .newContext({
          storageState: await page.context().storageState(),
        });
      peer = await peerContext.newPage();
    }
    await peer.clock.setFixedTime(new Date("2026-10-12T15:00:00Z"));
    await peer.goto(`${origin}${route}`);
    await expect(
      peer.getByRole("textbox", { name: "Segunda-feira, linha 1", exact: true }),
    ).toHaveValue("Conteúdo compartilhado entre sessões QA");
    const peerResponse = await peer.request.get(`${origin}/api/routines`);
    assert.equal(peerResponse.status(), 200);
    assert.deepEqual((await peerResponse.json()).routines, (await api()).routines);
    sharedSessionVerified = true;
    if (readerPage) {
      await expect(peer.getByText("Textos somente para leitura", { exact: true })).toBeVisible();
      await expect(peer.getByRole("button", { name: "Salva alterações" })).toHaveCount(0);
    }

    checkpoint("restore-default-content-before-visual-matrix");
    await put(initialRowsSnapshot);
    await page.clock.setFixedTime(new Date("2026-10-12T15:00:00Z"));
    await page.reload();
    await expect(save).toBeEnabled();
    await expect(page.locator("tbody tr")).toHaveCount(initialRows);
    assert.deepEqual(
      (await api()).routines.find((record) => record.role_key === "regional-house").rows,
      initialRowsSnapshot,
    );
    assert.equal(
      await page
        .locator("textarea")
        .evaluateAll((fields) => fields.filter((field) => field.value.trim()).length),
      74,
    );

    checkpoint("individual-completions-two-authenticated-users");
    completionChecks = await checkRoutineCompletions(page, origin, outputDirectory, { readerPage });

    checkpoint("last-row-background-refresh");
    await checkRoutineRefreshPosition(page);

    for (const width of [1440, 1024, 720, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "balanced", "dark"]) {
        checkpoint(`visual-${width}-${theme}`);
        await selectTheme(page, theme, width);
        await checkRoutineHeaderEffects(page);
        if (width === 1440) await checkRoutineCellEffects(page, outputDirectory);
        const weeklyOverflow = await checkRoutineOverflow(
          page,
          page.getByRole("region", { name: "Tabela de rotina semanal", exact: true }),
        );
        await checkRoutineCompactLayout(page);
        await checkRoutineNeutralCells(page);
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
              cells.every((cell) => getComputedStyle(cell).verticalAlign === "top"),
            ),
          true,
          "Semana cells must align their compact content to the top",
        );
        await expect(page.locator('thead [aria-current="date"]')).toHaveCount(1);
        await expect(page.locator("tbody td[data-today]")).toHaveCount(0);
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

        checkpoint(`weekly-accessibility-${width}-${theme}`);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        process.stdout.write(
          `[routine-accessibility] ${JSON.stringify({ width, theme, mode: "Semana", violations: result.violations.map(({ id }) => id) })}\n`,
        );
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
        checks.push({
          width,
          theme,
          mode: "Semana",
          overflow: weeklyOverflow.pageOverflow,
          overflowOwner: "page",
          accessibilityViolations: 0,
        });
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
        await checkRoutineCompactLayout(page);
        await checkRoutineOverflow(page, daily);
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
      sundayBackendPreserved: true,
      backend: "real",
      completionChecks,
      sharedSessionVerified,
      distinctReaderUser: readerPage
        ? "verified by distinct permissions and isolated completion snapshots"
        : "not supplied; separate session uses same synthetic account",
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
      if (readerPage) await readerPage.clock.setSystemTime(new Date());
    } finally {
      try {
        if (initialRowsSnapshot && lastWrittenRevision !== undefined) {
          const current = (await api()).routines.find(
            (record) => record.role_key === "regional-house",
          );
          assert.equal(
            current?.revision,
            lastWrittenRevision,
            "Concurrent write blocks QA cleanup",
          );
          if (JSON.stringify(current.rows) !== JSON.stringify(initialRowsSnapshot))
            await put(initialRowsSnapshot);
        }
      } finally {
        await peerContext?.close();
        await ownedReaderContext?.close();
      }
    }
  }
}
