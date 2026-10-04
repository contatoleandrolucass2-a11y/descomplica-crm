import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import {
  checkAssociativeCommissionGeometry,
  checkAssociativeSummaryGeometry,
  checkAssociativeWorkspaceGaps,
  checkAssociativeSelectedGoldPaint,
} from "./associative-compact-layout.mjs";
export {
  assertAssociativeCommissionGeometry,
  assertAssociativeSummaryGaps,
  assertAssociativeWorkspaceGaps,
} from "./associative-compact-layout.mjs";

const root = ".investor-associative-table-page";
const question = ".investor-associative-question";
const activeRow = ".investor-associative-flow-panel li.investor-key-field.is-active";
const timeout = 5_000;
export const associativeGuidanceWidths = [375, 1440];

export function hasGuidanceGoldBorder(paint) {
  return (
    paint.borders.some(isGuidanceGold) ||
    paint.attentionBorder.some((border) => isGuidanceGold(border.color))
  );
}

export function hasGuidanceThemeSurface(paint) {
  return (
    paint.gradient.length === 0 &&
    (paint.background[3] === 0 ||
      paint.background.every((value, index) => value === paint.themeSurface[index]))
  );
}

export function assertAssociativeTransparentFields(fields) {
  assert.ok(fields.length > 0, "Editable fields must be inspected");
  for (const field of fields) {
    assert.equal(
      field.background[3],
      0,
      `${field.label}: empty/filled inputs must share the parent surface`,
    );
    assert.equal(field.gradient.length, 0, `${field.label}: inputs must not have a painted fill`);
  }
}

export function isGuidanceGold([r, g, b, alpha = 255]) {
  return alpha >= 220 && r >= 150 && g >= 90 && r > g && g - b >= 35 && r - g <= 110;
}

export function isGuidanceGoldText(paint) {
  if (paint.textFill[3] !== 0) return isGuidanceGold(paint.textFill);
  return (
    paint.backgroundClip.includes("text") &&
    (paint.gradient.length > 0
      ? paint.gradient.every(isGuidanceGold)
      : isGuidanceGold(paint.background))
  );
}

export function assertAssociativeShimmer({ active, reducedMotion, animations }) {
  if (!active || reducedMotion) {
    assert.equal(animations.length, 0, "Inactive/reduced-motion guidance must not shimmer");
    return;
  }
  assert.ok(animations.length > 0, "Current/required guidance must shimmer");
  for (const animation of animations) {
    assert.match(animation.name, /(?:shine|shimmer)/u, "Only the guidance shimmer may animate");
    assert.equal(animation.duration, 3000, "Guidance shimmer must last exactly 3s");
    assert.equal(animation.iterations, "infinite", "Guidance shimmer must repeat while required");
    assert.equal(animation.playState, "running", "Guidance shimmer must actually run");
    assert.equal(
      animation.edgeHeight,
      2,
      "Shimmer must stay in a 2px edge, never cover field text",
    );
    assert.equal(animation.goldLine, true, "The moving edge must be gold, not white or blue");
    assert.equal(animation.moving, true, "The edge must travel rather than stay static");
    assert.equal(
      animation.visibleDuringCycle,
      true,
      "Guidance shimmer must not remain hidden throughout its cycle",
    );
  }
}

export function assertAssociativeMoneySpacing(measurements) {
  assert.ok(measurements.length > 0, "Money controls must be measured");
  for (const [index, value] of measurements.entries()) {
    assert.ok(
      value.gap >= 8,
      `Money control ${index}: R$ requires >=8px before the value (${value.gap}px)`,
    );
    assert.ok(value.fits, `Money control ${index}: numeric text must fit without clipping`);
    if (value.minimumHeight) {
      assert.ok(
        value.height >= value.minimumHeight,
        `Money control ${index}: mobile/coarse input requires >=44px height`,
      );
    }
  }
}

export function assertAssociativeQuantityGeometry({ quantity, money, minimumHeight = 0 }) {
  assert.ok(money.length > 0, "Quantity requires monetary peers from the same column");
  assert.ok(
    quantity.height >= minimumHeight,
    "Quantity mobile/coarse input requires >=44px height",
  );
  for (const peer of money) {
    for (const property of ["width", "height", "right"]) {
      assert.ok(
        Math.abs(quantity[property] - peer[property]) <= 1,
        `Quantity ${property} must match monetary inputs in the same column`,
      );
    }
  }
}

async function inspectPaint(locator) {
  return locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const style = getComputedStyle(element);
    const frame = getComputedStyle(element, "::after");
    const internal = (css) => {
      const outline = Number.parseFloat(css.outlineWidth) || 0;
      const shadows = css.boxShadow.split(/,(?![^()]*\))/u);
      return (
        (css.outlineStyle === "none" ||
          outline === 0 ||
          Number.parseFloat(css.outlineOffset) <= -outline) &&
        shadows.every((shadow) => shadow.trim() === "none" || shadow.includes("inset"))
      );
    };
    return {
      background: rgba(style.backgroundColor),
      themeSurface: rgba(style.getPropertyValue("--inv-color-panel")),
      foreground: rgba(style.color),
      textFill: rgba(style.webkitTextFillColor || style.color),
      backgroundClip: style.backgroundClip,
      leftBorderWidth: Number.parseFloat(style.borderLeftWidth),
      attentionBorder:
        frame.display !== "none" && !["none", "normal"].includes(frame.content)
          ? ["Top", "Right", "Bottom", "Left"].map((side) => ({
              width: Number.parseFloat(frame[`border${side}Width`]),
              style: frame[`border${side}Style`],
              color: rgba(frame[`border${side}Color`]),
            }))
          : [],
      gradient: (style.backgroundImage.match(/rgba?\([^)]*\)/gu) ?? []).map(rgba),
      outline: {
        style: style.outlineStyle,
        width: style.outlineWidth,
        offset: style.outlineOffset,
      },
      borders: [
        style.borderTopColor,
        style.borderRightColor,
        style.borderBottomColor,
        style.borderLeftColor,
      ].map(rgba),
      contained:
        internal(style) &&
        ["::before", "::after"].every((pseudo) => {
          const css = getComputedStyle(element, pseudo);
          if (["none", "normal"].includes(css.content) || css.display === "none") return true;
          return (
            internal(css) &&
            css.transform === "none" &&
            (Number.parseFloat(css.borderTopWidth) === 0 || css.boxSizing === "border-box") &&
            [css.top, css.right, css.bottom, css.left].every(
              (offset) => offset === "auto" || Number.parseFloat(offset) >= 0,
            )
          );
        }),
    };
  });
}

async function checkCurrentQuestion(page, index) {
  const cards = page.locator(`${root} ${question}`);
  await expect(cards).toHaveCount(3);
  await expect(
    cards.filter({ has: page.locator("input[aria-label='Renda Familiar']") }),
  ).toHaveCount(1);
  await expect(page.locator(`${root} ${question}.current`)).toHaveCount(index === null ? 0 : 1);
  await expect(page.locator(`${root} ${question}[aria-current="step"]`)).toHaveCount(
    index === null ? 0 : 1,
  );
  if (index !== null) {
    await expect(cards.nth(index)).toHaveClass(/\bcurrent\b/u);
    await expect(cards.nth(index)).toHaveAttribute("aria-current", "step");
    assert.ok(
      (await inspectPaint(cards.nth(index))).leftBorderWidth >= 4,
      "Current card must reinforce its gold edge with a >=4px border",
    );
    await expect(page.locator(`${root} ${activeRow}`)).toHaveCount(0);
    await expect
      .poll(
        async () => {
          const paint = await inspectPaint(cards.nth(index));
          return hasGuidanceGoldBorder(paint) && hasGuidanceThemeSurface(paint);
        },
        {
          timeout,
          message: `Current qualification card ${index + 1} needs a gold border with the normal theme surface`,
        },
      )
      .toBe(true);
  }
  for (let i = 0; i < 3; i += 1) {
    if (i === index) continue;
    await expect
      .poll(async () => hasGuidanceGoldBorder(await inspectPaint(cards.nth(i))), {
        timeout,
        message: `Inactive qualification card ${i + 1} must not remain gold`,
      })
      .toBe(false);
  }
  await checkGuidanceShimmer(page);
  if (index !== null) await checkGuidanceContrast(page);
  return { current: index === null ? null : index + 1 };
}

async function checkRequiredRow(page, label) {
  const rows = page.locator(`${root} ${activeRow}`);
  await expect(rows).toHaveCount(1);
  await expect(
    rows
      .getByRole("textbox", { name: label, exact: true })
      .or(rows.getByRole("spinbutton", { name: label, exact: true })),
  ).toBeEnabled();
  await page.mouse.move(0, 0);
  // Remove input focus so the row decoration is tested independently of the focus ring.
  await page.locator(`${root} .investor-associative-qualification`).focus();
  let paint;
  await expect
    .poll(
      async () => {
        paint = await inspectPaint(rows);
        return (
          paint.contained &&
          hasGuidanceThemeSurface(paint) &&
          paint.attentionBorder.length === 4 &&
          paint.attentionBorder.every(
            (border) =>
              border.width >= 2 &&
              !["none", "hidden"].includes(border.style) &&
              isGuidanceGold(border.color),
          )
        );
      },
      {
        timeout,
        message: `${label}: next required row needs only a contained gold border and normal surface`,
      },
    )
    .toBe(true);
  await checkGuidanceContrast(page);
  await checkGuidanceShimmer(page);
  await checkTransparentFields(page);
  return { field: label, ...paint };
}

async function checkTransparentFields(page) {
  const fields = await page
    .locator(
      `${root} .investor-associative-question-money input, ${root} .investor-associative-compact-account input`,
    )
    .evaluateAll((inputs) =>
      inputs
        .filter((input) => input.checkVisibility())
        .map((input) => {
          const style = getComputedStyle(input);
          const rgba = style.backgroundColor.match(/[\d.]+/gu).map(Number);
          return {
            label: input.getAttribute("aria-label"),
            value: input.value,
            background: [...rgba.slice(0, 3), rgba.length === 4 ? rgba[3] * 255 : 255],
            gradient: style.backgroundImage === "none" ? [] : [style.backgroundImage],
          };
        }),
    );
  assertAssociativeTransparentFields(fields);
  return fields;
}

async function checkGuidanceContrast(page) {
  await expect
    .poll(
      async () => {
        const measurements = await inspectAssociativeGuidanceContrast(page);
        return (
          measurements.length > 0 &&
          measurements.every((item) => item.minimumContrast !== null && item.minimumContrast >= 4.5)
        );
      },
      { timeout, message: "Gold guidance text and inputs require at least 4.5:1 contrast" },
    )
    .toBe(true);
}

export async function checkAssociativeMoneySpacing(page) {
  const measurements = await page
    .locator(
      `${root} .investor-associative-question-money, ${root} .investor-associative-flow-panel .investor-associative-line-control`,
    )
    .evaluateAll((controls) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      return controls
        .filter((control) => control.checkVisibility())
        .map((control) => {
          const prefix = control.querySelector(":scope > span");
          const value = control.querySelector(":scope > input, :scope > strong");
          if (!prefix || !value) return { gap: -1, fits: false };
          const prefixRange = document.createRange();
          prefixRange.selectNodeContents(prefix);
          const prefixRight = prefixRange.getBoundingClientRect().right;
          const rect = value.getBoundingClientRect();
          const style = getComputedStyle(value);
          if (value instanceof HTMLInputElement) {
            context.font = style.font;
            const text = value.value || value.placeholder;
            const textWidth =
              context.measureText(text).width +
              Math.max(0, text.length - 1) * (Number.parseFloat(style.letterSpacing) || 0);
            const left =
              rect.left +
              Number.parseFloat(style.borderLeftWidth) +
              Number.parseFloat(style.paddingLeft);
            const right =
              rect.right -
              Number.parseFloat(style.borderRightWidth) -
              Number.parseFloat(style.paddingRight);
            const textLeft = ["right", "end"].includes(style.textAlign)
              ? right - textWidth
              : style.textAlign === "center"
                ? (left + right - textWidth) / 2
                : left;
            return {
              gap: textLeft - prefixRight,
              fits: textWidth <= right - left,
              height: rect.height,
              minimumHeight: innerWidth <= 768 || matchMedia("(pointer: coarse)").matches ? 44 : 0,
            };
          }
          const range = document.createRange();
          range.selectNodeContents(value);
          const text = range.getBoundingClientRect();
          return {
            gap: text.left - prefixRight,
            fits: text.left >= rect.left && text.right <= rect.right + 0.1,
          };
        });
    });
  assertAssociativeMoneySpacing(measurements);
  return measurements;
}

async function checkQuantity(page) {
  const geometry = await page
    .locator(`${root} .investor-associative-flow-panel`)
    .evaluate((panel) => {
      const measure = (input) => {
        const rect = input.getBoundingClientRect();
        return { width: rect.width, height: rect.height, right: rect.right };
      };
      return {
        minimumHeight: innerWidth <= 768 || matchMedia("(pointer: coarse)").matches ? 44 : 0,
        quantity: measure(panel.querySelector('input[aria-label="Quantidade de parcelas"]')),
        money: ["Financiamento", "FGTS", "Entrada"].map((label) =>
          measure(panel.querySelector(`input[aria-label="${label}"]`)),
        ),
      };
    });
  assertAssociativeQuantityGeometry(geometry);
  return geometry;
}

async function checkHover(page, locator, reducedMotion, allowScale = true, actionTarget = locator) {
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion });
  try {
    await actionTarget.hover();
  } catch (error) {
    error.safeHoverDiagnostics = await actionTarget
      .evaluate((element) => {
        const owner =
          element.closest(".investor-key-field, .investor-associative-question") ?? element;
        const rect = element.getBoundingClientRect();
        const point = {
          x: Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2)),
          y: Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2)),
        };
        const hit = document.elementFromPoint(point.x, point.y);
        const style = getComputedStyle(element);
        return {
          targetAttached: element.isConnected,
          targetVisible: element.checkVisibility(),
          targetDisabled: element.matches(":disabled"),
          targetRect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          viewport: { width: innerWidth, height: innerHeight, scrollY },
          pointerEvents: style.pointerEvents,
          hitTag: hit?.tagName ?? null,
          hitWithinTarget: Boolean(hit && element.contains(hit)),
          hitWithinOwner: Boolean(hit && owner.contains(hit)),
        };
      })
      .catch(() => ({ unavailable: true }));
    throw error;
  }
  let motion;
  await expect
    .poll(
      async () => {
        motion = await locator.evaluate((element) => {
          const style = getComputedStyle(element);
          const matrix = new DOMMatrixReadOnly(
            style.transform === "none" ? undefined : style.transform,
          );
          const scaling = style.scale === "none" ? [1, 1] : style.scale.split(" ").map(Number);
          return {
            scaleX: Math.hypot(matrix.a, matrix.b) * scaling[0],
            scaleY: Math.hypot(matrix.c, matrix.d) * (scaling[1] ?? scaling[0]),
            translateX: matrix.e,
            translateY: matrix.f,
            independentTranslate: style.translate,
            animating: element
              .getAnimations({ subtree: true })
              .some((animation) => animation.playState === "running" || animation.pending),
          };
        });
        if (reducedMotion === "reduce" || !allowScale) {
          return (
            !motion.animating &&
            Math.abs(motion.scaleX - 1) < 0.001 &&
            Math.abs(motion.scaleY - 1) < 0.001 &&
            motion.translateX === 0 &&
            motion.translateY === 0 &&
            ["none", "0px", "0px 0px"].includes(motion.independentTranslate)
          );
        }
        return (
          !motion.animating &&
          motion.scaleX > 1 &&
          motion.scaleX <= 1.0401 &&
          motion.scaleY > 1 &&
          motion.scaleY <= 1.0401 &&
          Math.abs(motion.translateX) <= 3 &&
          Math.abs(motion.translateY) <= 3
        );
      },
      { timeout, message: `${reducedMotion}: hover must be moderate, with no motion when reduced` },
    )
    .toBe(true);
  return motion;
}

async function checkGuidanceShimmer(page) {
  const measurements = await page
    .locator(
      `${root} ${question}, ${root} .investor-key-field, ${root} .investor-associative-step-guide`,
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.checkVisibility())
        .map((element) => ({
          label: element.querySelector("input")?.getAttribute("aria-label") ?? element.className,
          active: element.matches(
            ".current, .is-active, .investor-associative-step-guide.guidance",
          ),
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          animations: element
            .getAnimations({ subtree: true })
            .filter((animation) => {
              if (!(animation instanceof CSSAnimation)) return false;
              const target = animation.effect.target;
              // Help icons have their own motion contract; inspect only the guidance owners.
              return (
                target === element ||
                (element.matches(".investor-key-field") &&
                  target === element.querySelector(":scope > .investor-direct-step-content")) ||
                (element.matches(".investor-associative-step-guide") &&
                  target === element.querySelector(":scope > span"))
              );
            })
            .map((animation) => {
              const timing = animation.effect.getTiming();
              const style = getComputedStyle(
                animation.effect.target,
                animation.effect.pseudoElement,
              );
              const opacityFrames = animation.effect
                .getKeyframes()
                .filter((frame) => frame.opacity !== undefined)
                .map((frame) => Number(frame.opacity));
              const maximumOpacity = opacityFrames.length
                ? Math.max(...opacityFrames)
                : Number(style.opacity);
              const colors = (style.backgroundImage.match(/rgba?\([^)]*\)/gu) ?? [])
                .map((color) => color.match(/[\d.]+/gu).map(Number))
                .filter((color) => color.length === 3 || color[3] > 0);
              const positions = animation.effect
                .getKeyframes()
                .map((frame) => frame.backgroundPosition ?? frame.backgroundPositionX);
              return {
                name: animation.animationName,
                duration: timing.duration,
                iterations: timing.iterations === Infinity ? "infinite" : String(timing.iterations),
                playState: animation.playState,
                edgeHeight: Number.parseFloat(style.backgroundSize.split(" ")[1]),
                goldLine:
                  colors.length > 0 &&
                  colors.every(
                    ([r, g, b, a = 1]) => r >= 150 && g >= 90 && r > g && g - b >= 35 && a > 0,
                  ),
                moving: new Set(positions.filter(Boolean)).size > 1,
                visibleDuringCycle:
                  maximumOpacity > 0 && style.display !== "none" && style.visibility === "visible",
              };
            }),
        })),
    );
  assert.ok(measurements.length >= 3, "Guidance animation owners must be present");
  for (const measurement of measurements) {
    try {
      assertAssociativeShimmer(measurement);
    } catch (error) {
      error.message = `${measurement.label}: ${error.message}`;
      throw error;
    }
  }
  return measurements;
}

async function checkReducedGuidanceMotion(page, locator, actionTarget = locator) {
  const normal = await checkGuidanceShimmer(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await checkHover(page, locator, "reduce", true, actionTarget);
  const reduced = await checkGuidanceShimmer(page);
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return { normal, reduced };
}

// Call only on an isolated synthetic page, after initial viewport checks and unit selection.
export async function checkAssociativeGuidance(page, { onState = async () => {} } = {}) {
  let stage = "initial";
  const result = {
    contract: "associative-guidance-gold-border-v4",
    questions: [],
    rows: [],
    passed: false,
  };
  const field = (label) =>
    page.locator(`${root} input`).and(page.getByLabel(label, { exact: true }));
  const qualification = page.locator(`${root} .investor-associative-qualification`);
  const flow = page.locator(`${root} .investor-associative-flow-panel`);
  await expect(qualification).toBeVisible();
  await expect(page.locator(`${root} .investor-stock-table tr[aria-selected="true"]`)).toHaveCount(
    1,
  );
  const previousMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  try {
    stage = "reset";
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // Clear in reverse dependency order so repeated theme checks exercise every gate again.
    for (const label of [
      "Quantidade de parcelas",
      "Entrada",
      "Cheque Moradia",
      "FGTS",
      "Subsídio",
      "Financiamento",
    ]) {
      if (await field(label).isEnabled()) await field(label).fill("");
    }
    await field("Renda Familiar").fill("");
    await expect(qualification.locator('input[type="radio"]:checked')).toHaveCount(0);
    await qualification.focus();
    await page.mouse.move(0, 0);
    await checkAssociativeSelectedGoldPaint(page);
    stage = "profile";
    await onState("profile");
    result.questions.push(await checkCurrentQuestion(page, 0));
    result.currentCardMotion = await checkReducedGuidanceMotion(
      page,
      qualification.locator(`${question}.current`),
    );
    await expect(flow).toHaveAttribute("data-locked", "true");
    await expect(field("Financiamento")).toBeDisabled();
    await expect(qualification.getByRole("button", { name: "SBPE", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(qualification.getByRole("radio", { name: "Sim", exact: true })).toBeDisabled();
    result.moneyBefore = await checkAssociativeMoneySpacing(page);

    stage = "modality";
    await field("Renda Familiar").fill("800000");
    await field("Renda Familiar").blur();
    // A calculated modality is a suggestion, never confirmation of step 2.
    result.questions.push(await checkCurrentQuestion(page, 1));
    await expect(qualification.getByRole("radio", { name: "Sim", exact: true })).toBeDisabled();
    await expect(qualification.getByRole("radio", { name: "Não", exact: true })).toBeDisabled();
    await expect(flow).toHaveAttribute("data-locked", "true");
    await expect(field("Financiamento")).toBeDisabled();
    await onState("modality");
    await qualification.getByRole("button", { name: "SBPE", exact: true }).click();
    await expect(qualification.getByRole("button", { name: "SBPE", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    result.questions.push(await checkCurrentQuestion(page, 2));
    await expect(qualification.getByRole("radio", { name: "Sim", exact: true })).toBeEnabled();
    stage = "first-property";
    await onState("first-property");
    await expect(flow).toHaveAttribute("data-locked", "true");
    await expect(field("Financiamento")).toBeDisabled();
    await qualification.getByRole("radio", { name: "Sim", exact: true }).check();
    await expect(flow).not.toHaveAttribute("data-locked", "true");
    result.questions.push(await checkCurrentQuestion(page, null));

    const steps = [
      ["Financiamento", "10000000", "Subsídio"],
      ["Subsídio", "0", "FGTS"],
      ["FGTS", "0", "Cheque Moradia"],
      ["Cheque Moradia", "0", "Entrada"],
      ["Entrada", "15000", "Quantidade de parcelas"],
    ];
    for (const [label, value, next] of steps) {
      stage = `flow:${label}`;
      if (label === "Financiamento") await onState("financing");
      result.rows.push(await checkRequiredRow(page, label));
      if (label === "Financiamento")
        result.requiredRowMotion = await checkReducedGuidanceMotion(
          page,
          page.locator(`${root} ${activeRow}`),
          field(label),
        );
      await expect(field(next)).toBeDisabled();
      if (label === "Financiamento") {
        await field(label).fill("0");
        await expect(field(next)).toBeDisabled();
        await expect(page.locator(`${root} ${activeRow}`)).toHaveCount(1);
      }
      await field(label).fill(value);
      await expect(field(next)).toBeEnabled();
    }
    result.rows.push(await checkRequiredRow(page, "Quantidade de parcelas"));
    result.moneyAfter = await checkAssociativeMoneySpacing(page);
    result.quantity = await checkQuantity(page);
    stage = "ranking";
    await field("Quantidade de parcelas").fill("1");
    await expect(field("Quantidade de parcelas")).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }),
    ).toHaveCount(0);
    await field("Quantidade de parcelas").fill("84");
    await expect(field("Quantidade de parcelas")).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }),
    ).toHaveValue("");
    result.rankingMotion = await checkGuidanceShimmer(page);
    await expect
      .poll(
        async () => {
          const paint = await inspectPaint(
            page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }),
          );
          return hasGuidanceThemeSurface(paint) && hasGuidanceGoldBorder(paint);
        },
        { timeout, message: "Ranking must keep its theme surface and gold edge" },
      )
      .toBe(true);
    await page
      .getByRole("combobox", { name: "Selecione o Ranking", exact: true })
      .selectOption("gold");
    await expect(page.locator(`${root} ${activeRow}`)).toHaveCount(0);
    result.completedMotion = await checkGuidanceShimmer(page);
    result.filledFields = await checkTransparentFields(page);
    await expect(
      page
        .locator(`${root} .investor-associative-approval-rule > span`)
        .filter({ hasText: /^% Máximo da renda mensal$/u }),
    ).toHaveCount(1);
    await expect(
      page
        .locator(`${root} .investor-associative-approval-rule > span`)
        .filter({ hasText: /% Máximo da renda por anual/u }),
    ).toHaveCount(0);

    result.summary = await checkAssociativeSummaryGeometry(page);
    result.workspace = await checkAssociativeWorkspaceGaps(page);
    stage = "commission";
    const commission = page.locator(`${root} .investor-associative-commission-launcher`);
    await expect(commission).toBeVisible();
    await expect(commission).toHaveAccessibleName("Abrir remuneração comercial");
    await expect
      .poll(
        async () => {
          result.commissionPaint = await inspectPaint(commission.locator("span").first());
          return isGuidanceGoldText(result.commissionPaint);
        },
        {
          timeout,
          message: "Commission symbol must render gold, including text-fill and clipped gradients",
        },
      )
      .toBe(true);
    await checkGuidanceContrast(page);
    result.commission = await checkAssociativeCommissionGeometry(commission);
    await commission.click();
    await expect(page.locator("#investor-associative-commission-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#investor-associative-commission-dialog")).toBeHidden();
    await expect(commission).toBeFocused();
    const hoverCapable = await page.evaluate(() => matchMedia("(hover: hover)").matches);
    result.motion = { hoverCapable };
    for (const [name, locator] of [
      ["modality", qualification.getByRole("button", { name: "SBPE", exact: true })],
      ["firstProperty", qualification.locator(".investor-associative-yes-no label").first()],
      ["commission", commission],
    ]) {
      result.motion[name] = {
        normal: await checkHover(page, locator, "no-preference", hoverCapable),
        reduced: await checkHover(page, locator, "reduce"),
      };
    }
    stage = "complete";
    result.passed = true;
    await onState("complete");
    return result;
  } catch (error) {
    error.associativeGuidance = result;
    error.safeDiagnostics = {
      contract: result.contract,
      stage,
      questionChecks: result.questions.length,
      rowChecks: result.rows.length,
    };
    throw error;
  } finally {
    await page.emulateMedia({ reducedMotion: previousMotion ? "reduce" : "no-preference" });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
}

export async function inspectAssociativeGuidanceContrast(page) {
  return page
    .locator(
      `${root} ${question}.current .investor-associative-question-heading > span, ${root} ${question}.current > small, ${root} ${question}.current input:not([type="radio"]), ${root} ${question}.current .investor-associative-choice-row > button:not([aria-disabled="true"]), ${root} ${question}.current .investor-associative-yes-no label, ${root} ${activeRow} input, ${root} ${activeRow} .investor-direct-step-name strong, ${root} .investor-associative-commission-launcher > span`,
    )
    .evaluateAll((elements) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const rgba = (color) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const luminance = (rgb) =>
        rgb
          .slice(0, 3)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          })
          .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
      return elements
        .filter((element) => element.checkVisibility())
        .map((element, index) => {
          const placeholder = element instanceof HTMLInputElement && !element.value;
          const foregroundStyle = getComputedStyle(element, placeholder ? "::placeholder" : null);
          const foreground = rgba(foregroundStyle.webkitTextFillColor || foregroundStyle.color);
          foreground[3] *= Number.parseFloat(foregroundStyle.opacity);
          const foregrounds =
            foreground[3] === 0 && foregroundStyle.backgroundClip.includes("text")
              ? (foregroundStyle.backgroundImage.match(/rgba?\([^)]*\)/gu) ?? []).map(rgba)
              : [foreground];
          let backgrounds = [];
          for (let parent = element; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.backgroundClip.includes("text")) continue;
            const stops = (style.backgroundImage.match(/rgba?\([^)]*\)/gu) ?? []).map(rgba);
            if (stops.length && stops.every((stop) => stop[3] === 255)) {
              backgrounds = stops;
              break;
            }
            const color = rgba(style.backgroundColor);
            if (color[3] === 255) {
              backgrounds = [color];
              break;
            }
          }
          const ratios = backgrounds.flatMap((color) =>
            foregrounds.map((textColor) => {
              const alpha = textColor[3] / 255;
              const foregroundLuminance = luminance(
                textColor.map((channel, index) =>
                  index < 3 ? channel * alpha + color[index] * (1 - alpha) : 255,
                ),
              );
              const backgroundLuminance = luminance(color);
              return (
                (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
                (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
              );
            }),
          );
          return {
            index,
            placeholder,
            foreground,
            foregrounds,
            backgrounds,
            minimumContrast: ratios.length ? Math.min(...ratios) : null,
          };
        });
    });
}

export async function runAssociativeGuidancePreview(
  url,
  {
    viewports = [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ],
    themes = [
      ["light", "Claro"],
      ["balanced", "Médio"],
      ["dark", "Escuro"],
    ],
  } = {},
) {
  const target = new URL(url);
  assert.ok(
    target.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname),
    "Preview must use loopback HTTP with synthetic data",
  );
  assert.equal(target.pathname, "/app/simulacao/associativo-fluxo-linear");
  const output = path.resolve("test-results/guidance");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const saveResults = () =>
    writeFile(
      path.join(output, "results.json"),
      `${JSON.stringify({ url, node: process.version, platform: process.platform, browser: browser.version(), viewports, themes, results }, null, 2)}\n`,
    );
  try {
    for (const viewport of viewports) {
      const mobile = viewport.width <= 600;
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      await context.route("**/*", (route) => {
        const request = route.request();
        return new URL(request.url()).origin === target.origin && request.method() === "GET"
          ? route.continue()
          : route.abort();
      });
      try {
        // Reuse the selected page across themes, matching the CI stateful journey.
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const pointer = await page.evaluate(() => ({
          coarse: matchMedia("(pointer: coarse)").matches,
          fine: matchMedia("(pointer: fine)").matches,
          hover: matchMedia("(hover: hover)").matches,
          maxTouchPoints: navigator.maxTouchPoints,
        }));
        assert.equal(pointer.coarse, mobile, "Mobile QA must exercise a real coarse pointer");
        assert.equal(pointer.fine, !mobile, "Desktop QA must exercise a fine pointer");
        for (const [theme, label] of themes) {
          const check = {
            width: viewport.width,
            theme,
            pointer,
            passed: false,
            captures: [],
            contrast: {},
          };
          const capture = async (state) => {
            const filename = `${target.port}-${viewport.width}-${theme}-${state}.png`;
            await page.mouse.move(0, 0);
            await page.keyboard.press("Escape");
            const panel = page.locator(
              `${root} ${["profile", "modality", "first-property"].includes(state) ? ".investor-associative-qualification" : ".investor-associative-flow-panel"}`,
            );
            await panel.evaluate((element) => {
              const header = document.querySelector("[data-protected-topbar]");
              window.scrollTo({
                top: Math.max(
                  0,
                  scrollY +
                    element.getBoundingClientRect().top -
                    (header?.getBoundingClientRect().height ?? 0) -
                    12,
                ),
                behavior: "instant",
              });
            });
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            await panel.screenshot({
              path: path.join(output, filename),
              animations: "disabled",
            });
            check.captures.push(filename);
            check.contrast[state] = await inspectAssociativeGuidanceContrast(page);
          };
          try {
            await page
              .getByRole("group", { name: "Aparência da página", exact: true })
              .getByRole("button", { name: label, exact: true })
              .click();
            await page
              .locator(".investor-stock-table tbody tr.selectable")
              .first()
              .getByRole("button")
              .click();
            check.guidance = await checkAssociativeGuidance(page, { onState: capture });
            for (const [state, contrast] of Object.entries(check.contrast)) {
              assert.ok(
                contrast.length > 0 && contrast.every((item) => item.minimumContrast >= 4.5),
                `${state}: gold guidance text requires at least 4.5:1 contrast`,
              );
            }
            check.passed = true;
          } catch (error) {
            check.error = String(error.message);
            check.guidance = error.associativeGuidance;
            try {
              if (await page.locator(`${root} .investor-associative-flow-panel`).count())
                await capture("failure");
            } catch (captureError) {
              check.captureError = String(captureError.message);
            }
          }
          results.push(check);
          await saveResults();
          console.log(
            JSON.stringify({
              width: check.width,
              theme,
              passed: check.passed,
              error: check.error?.split("\n")[0],
              captures: check.captures,
            }),
          );
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  await saveResults();
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const results = await runAssociativeGuidancePreview(process.argv[2]);
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
