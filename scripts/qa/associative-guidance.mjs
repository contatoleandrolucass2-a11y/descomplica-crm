import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { checkAssociativeMotion } from "./associative-motion.mjs";
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
    if (field.ledger) {
      assert.ok(
        field.borderWidths.length === 4 && field.borderWidths.every((width) => width === 0),
        `${field.label}: ledger inputs must have no border, including focused/filled states`,
      );
      assert.ok(
        field.outlineWidth === 0 || field.outlineStyle === "none",
        `${field.label}: ledger inputs must have no outline, including focused/filled states`,
      );
      assert.equal(field.boxShadow, "none", `${field.label}: ledger inputs must have no shadow`);
      assert.equal(
        field.compositionShadow,
        "none",
        `${field.label}: the surrounding composition must not restore a focus frame`,
      );
    }
  }
}

export function assertAssociativeLedgerRow(paint) {
  assert.ok(hasGuidanceThemeSurface(paint), "Ledger row must retain its normal theme surface");
  assert.ok(paint.contained, "Ledger row decoration must stay within the full row");
  assert.ok(
    paint.fixedBorders.every(
      (border) =>
        border.width === 0 ||
        ["none", "hidden"].includes(border.style) ||
        !isGuidanceGold(border.color),
    ),
    "Ledger row must not retain a fixed gold border or outline",
  );
  assert.equal(paint.boxShadow, "none", "Ledger row must not retain a fixed shadow");
  assert.ok(
    paint.attentionBorder.length === 4 &&
      paint.attentionBorder.every((border) => border.width === 0),
    "Ledger ::after must have no fixed border",
  );
}

export function assertAssociativeKeyboardFocus(focus) {
  assert.ok(focus.focusVisible, "Ledger input must receive keyboard-visible focus");
  assert.ok(
    focus.decoration === "none" && focus.weight >= 700 && focus.alpha === 255,
    "Keyboard focus must emphasize the visible ledger label without underline or input frame",
  );
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

export function assertAssociativeShimmer({ active, reducedMotion, animations, ledger = false }) {
  if (!active || reducedMotion) {
    assert.equal(animations.length, 0, "Inactive/reduced-motion guidance must not shimmer");
    return;
  }
  assert.ok(animations.length > 0, "Current/required guidance must shimmer");
  if (ledger) assert.equal(animations.length, 1, "Ledger must animate only its full-row ::after");
  for (const animation of animations) {
    assert.equal(
      animation.name,
      "associative-pending-shine",
      "Only the pending shimmer may animate",
    );
    assert.equal(animation.duration, 4500, "Guidance shimmer must last exactly 4.5s");
    assert.equal(animation.iterations, "infinite", "Guidance shimmer must repeat while required");
    assert.equal(animation.playState, "running", "Guidance shimmer must actually run");
    assert.equal(
      animation.fullArea,
      true,
      "Shimmer must span the full area, not narrow edge lines",
    );
    assert.equal(animation.goldLine, true, "The moving sweep must have warm gold shoulders");
    assert.equal(
      animation.specularBand,
      true,
      "The sweep must include a distinct pale specular band",
    );
    assert.equal(
      animation.translucent,
      true,
      "The sweep must remain translucent without a fixed gold fill",
    );
    assert.equal(animation.behindText, true, "The sweep must paint behind the text");
    assert.equal(animation.pointerSafe, true, "Decorative layers must not intercept input");
    assert.equal(animation.backgroundCount, 1, "Guidance requires one full-area gradient");
    assert.equal(animation.noRepeat, true, "The sweep must not tile across the input");
    if (ledger) {
      assert.equal(animation.pseudo, "::after");
      assert.equal(animation.fullRowExtent, true, "Ledger shimmer must cover the full row extent");
    }
    assert.equal(animation.moving, true, "The sweep must travel rather than stay static");
    assert.equal(
      animation.visibleDuringCycle,
      true,
      "Guidance shimmer must not remain hidden throughout its cycle",
    );
  }
}

export function assertAssociativeRejectionPaint(paint) {
  assert.deepEqual(
    paint.gradient,
    [
      [101, 12, 23, 255],
      [157, 24, 40, 255],
      [116, 16, 28, 255],
      [72, 8, 15, 255],
    ],
    "Rejection must use the four dark metallic blood-red stops",
  );
  assert.deepEqual(paint.foreground, [255, 255, 255, 255], "Rejection text must remain white");
  assert.deepEqual(paint.textFill, [255, 255, 255, 255], "Rejection text fill must remain white");
}

export function assertAssociativeRejectionShimmer({ rejected, reducedMotion, animations }) {
  if (!rejected || reducedMotion) {
    assert.equal(animations.length, 0, "Non-rejected/reduced-motion footer must not shimmer");
    return;
  }
  assert.equal(animations.length, 1, "Rejected footer must have one red shimmer");
  const animation = animations[0];
  assert.equal(animation.name, "associative-rejection-shine");
  assert.equal(animation.pseudo, "::after");
  assert.equal(animation.duration, 4500, "Rejection shimmer must last exactly 4.5s");
  assert.equal(animation.iterations, "infinite");
  assert.equal(animation.playState, "running");
  assert.equal(animation.redLine, true, "Rejection shimmer must be red");
  assert.equal(animation.moving, true, "Rejection shimmer must travel");
  assert.equal(animation.visibleDuringCycle, true, "Rejection shimmer must be visible");
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
    const borderPaint = (css) =>
      ["Top", "Right", "Bottom", "Left"].map((side) => ({
        width: Number.parseFloat(css[`border${side}Width`]),
        style: css[`border${side}Style`],
        color: rgba(css[`border${side}Color`]),
      }));
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
      boxShadow: style.boxShadow,
      fixedBorders: [
        style,
        ...["::before", "::after"]
          .map((pseudo) => getComputedStyle(element, pseudo))
          .filter((css) => css.display !== "none" && !["none", "normal"].includes(css.content)),
      ].flatMap((css) => [
        ...borderPaint(css),
        {
          width: Number.parseFloat(css.outlineWidth),
          style: css.outlineStyle,
          color: rgba(css.outlineColor),
        },
      ]),
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
        try {
          assertAssociativeLedgerRow(paint);
          return true;
        } catch {
          return false;
        }
      },
      {
        timeout,
        message: `${label}: next required row needs a normal surface with no fixed gold frame`,
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
        .flatMap((input) => {
          const ledger = Boolean(input.closest(".investor-associative-compact-account"));
          const wrapper = input.closest(
            ".investor-associative-line-control, .investor-associative-installment-control",
          );
          return (ledger && wrapper ? [input, wrapper] : [input]).map((element) => {
            const style = getComputedStyle(element);
            const rgba = style.backgroundColor.match(/[\d.]+/gu).map(Number);
            return {
              label: `${input.getAttribute("aria-label")}${element === input ? "" : " wrapper"}`,
              value: input.value,
              background: [...rgba.slice(0, 3), rgba.length === 4 ? rgba[3] * 255 : 255],
              gradient: style.backgroundImage === "none" ? [] : [style.backgroundImage],
              ledger,
              borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ].map(Number.parseFloat),
              outlineWidth: Number.parseFloat(style.outlineWidth),
              outlineStyle: style.outlineStyle,
              boxShadow: style.boxShadow,
              compositionShadow: ledger
                ? getComputedStyle(input.closest(".investor-direct-step-composition")).boxShadow
                : "none",
            };
          });
        }),
    );
  assertAssociativeTransparentFields(fields);
  return fields;
}

async function checkLedgerKeyboardFocus(page, input) {
  // Establish keyboard modality before focusing each empty/filled ledger input.
  await page.keyboard.press("Tab");
  await input.focus();
  await expect(input).toBeFocused();
  const focus = await input.evaluate((element) => {
    const label = element.closest("li").querySelector(".investor-direct-step-name strong");
    const style = getComputedStyle(label);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    context.fillStyle = style.color;
    context.fillRect(0, 0, 1, 1);
    return {
      focusVisible: element.matches(":focus-visible"),
      decoration: style.textDecorationLine,
      weight: Number.parseFloat(style.fontWeight),
      alpha: context.getImageData(0, 0, 1, 1).data[3],
    };
  });
  assertAssociativeKeyboardFocus(focus);
  await checkTransparentFields(page);
  await checkGuidanceContrast(page);
  return focus;
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

async function checkHover(page, locator, reducedMotion, actionTarget = locator) {
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
            specularEnabled:
              element.matches(
                "button, a[href], summary, .investor-associative-choice-row > label",
              ) && !element.matches(':disabled, [aria-disabled="true"], :has(input:disabled)'),
            animations: element
              .getAnimations({ subtree: true })
              .filter((animation) => animation.effect.target === element)
              .filter((animation) => animation.playState === "running" || animation.pending)
              .map((animation) => ({
                name: animation.animationName,
                pseudo: animation.effect.pseudoElement,
                duration: animation.effect.getTiming().duration,
              })),
          };
        });
        const allowedAnimations =
          reducedMotion === "reduce"
            ? motion.animations.length === 0
            : motion.animations.every(
                ({ name, pseudo, duration }) =>
                  duration === 4500 &&
                  ((name === "associative-specular-orbit" && pseudo === "::before") ||
                    (name === "associative-selection-shine" && !pseudo)),
              ) &&
              motion.animations.filter(({ name }) => name === "associative-specular-orbit")
                .length === (motion.specularEnabled ? 1 : 0);
        return (
          allowedAnimations &&
          Math.abs(motion.scaleX - 1) < 0.001 &&
          Math.abs(motion.scaleY - 1) < 0.001 &&
          motion.translateX === 0 &&
          motion.translateY === 0 &&
          ["none", "0px", "0px 0px"].includes(motion.independentTranslate)
        );
      },
      {
        timeout,
        message: `${reducedMotion}: hover must keep dimensions stable; only the specular rim may animate`,
      },
    )
    .toBe(true)
    .catch((error) => {
      error.message += `\nMeasured motion: ${JSON.stringify(motion)}`;
      throw error;
    });
  return motion;
}

export async function checkGuidanceShimmer(page) {
  const measurements = await page
    .locator(
      `${root} ${question}, ${root} .investor-key-field, ${root} .investor-associative-step-guide, ${root} .investor-associative-approval > footer`,
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
          ledger: element.matches(".investor-associative-compact-account li.investor-key-field"),
          rejectionFooter: element.matches(".investor-associative-approval > footer"),
          rejected: element.matches("footer.rejected"),
          animations: element
            .getAnimations({ subtree: true })
            .filter((animation) => {
              if (!(animation instanceof CSSAnimation)) return false;
              if (
                !["associative-pending-shine", "associative-rejection-shine"].includes(
                  animation.animationName,
                )
              )
                return false;
              const target = animation.effect.target;
              // Decorative sequences and help icons have separate motion contracts.
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
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 1;
              const context = canvas.getContext("2d", { willReadFrequently: true });
              const colors = (
                style.backgroundImage.match(/(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/gu) ?? []
              )
                .map((color) => {
                  context.clearRect(0, 0, 1, 1);
                  context.fillStyle = color;
                  context.fillRect(0, 0, 1, 1);
                  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
                  return [r, g, b, a / 255];
                })
                .filter((color) => color[3] > 0);
              const positions = animation.effect
                .getKeyframes()
                .map((frame) => frame.backgroundPosition ?? frame.backgroundPositionX);
              const sizes = style.backgroundSize
                .split(",")
                .map((size) => size.trim().split(/\s+/u));
              const isRowOwner =
                animation.effect.target === element && element.matches("li.investor-key-field");
              return {
                name: animation.animationName,
                duration: timing.duration,
                iterations: timing.iterations === Infinity ? "infinite" : String(timing.iterations),
                playState: animation.playState,
                pseudo: animation.effect.pseudoElement,
                fullArea: sizes.length === 1 && sizes[0][1] === "100%",
                translucent:
                  colors.length > 0 && colors.every((color) => color[3] > 0 && color[3] < 1),
                specularBand: colors.some(([r, g, b]) => r >= 240 && g >= 225 && b >= 175),
                behindText: !animation.effect.pseudoElement || Number(style.zIndex) <= 0,
                pointerSafe: !animation.effect.pseudoElement || style.pointerEvents === "none",
                backgroundCount: (style.backgroundImage.match(/linear-gradient\(/gu) ?? []).length,
                noRepeat: style.backgroundRepeat
                  .split(",")
                  .every((repeat) => repeat.trim() === "no-repeat"),
                fullRowExtent:
                  isRowOwner &&
                  style.transform === "none" &&
                  [style.top, style.right, style.bottom, style.left].every(
                    (offset) => Number.parseFloat(offset) === 0,
                  ) &&
                  Math.abs(Number.parseFloat(style.width) - element.clientWidth) <= 1 &&
                  Math.abs(Number.parseFloat(style.height) - element.clientHeight) <= 1,
                goldLine:
                  colors.length > 0 &&
                  colors.some(
                    ([r, g, b, a = 1]) => r >= 150 && g >= 90 && r > g && g - b >= 35 && a > 0,
                  ),
                redLine:
                  colors.length > 0 &&
                  colors.every(
                    ([r, g, b, a = 1]) => r >= 150 && r > g * 1.5 && r > b * 1.5 && a > 0,
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
      if (measurement.rejectionFooter) assertAssociativeRejectionShimmer(measurement);
      else assertAssociativeShimmer(measurement);
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
  await checkHover(page, locator, "reduce", actionTarget);
  const reduced = await checkGuidanceShimmer(page);
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return { normal, reduced };
}

async function checkGuidancePixels(locator) {
  const captureAt = async (time) => {
    const count = await locator.evaluate((element, currentTime) => {
      const animations = element
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation instanceof CSSAnimation &&
            animation.effect.target === element &&
            animation.animationName === "associative-pending-shine",
        );
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = currentTime;
      }
      return animations.length;
    }, time);
    assert.equal(count, 1, `Pixel proof at ${time}ms requires one pending sweep (found ${count})`);
    return sharp(await locator.screenshot({ caret: "hide", animations: "allow" }))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  };
  try {
    const before = await captureAt(0);
    const during = await captureAt(2250);
    assert.deepEqual(before.info, during.info, "A sweep must not resize its field");
    const { width, height, channels } = before.info;
    const bands = [0, 0];
    for (let y = 4; y < height - 4; y += 1) {
      for (let x = 4; x < width - 4; x += 1) {
        const offset = (y * width + x) * channels;
        const delta = [0, 1, 2].reduce(
          (sum, channel) =>
            sum + Math.abs(before.data[offset + channel] - during.data[offset + channel]),
          0,
        );
        if (delta >= 6) bands[y < height / 2 ? 0 : 1] += 1;
      }
    }
    assert.ok(
      bands.every((count) => count > 10),
      "The gold sweep must visibly change both interior halves, not only borders",
    );
    return { width, height, changedPixels: bands, passed: true };
  } finally {
    await locator.evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        if (
          animation instanceof CSSAnimation &&
          animation.effect.target === element &&
          animation.animationName === "associative-pending-shine"
        )
          animation.play();
      }
    });
  }
}

// Call only on an isolated synthetic page, after initial viewport checks and unit selection.
export async function checkAssociativeGuidance(page, { onState = async () => {} } = {}) {
  let stage = "initial";
  const result = {
    contract: "associative-guidance-full-area-continuity-v8",
    questions: [],
    rows: [],
    keyboardFocus: [],
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
    // A fresh journey must not depend on editing income destroying an existing proposal.
    const currentTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload({ waitUntil: "networkidle" });
    const themeGroup = page.getByRole("group", {
      name: "Aparência da página",
      exact: true,
    });
    if ((page.viewportSize()?.width ?? 1440) <= 600) {
      const cycle = themeGroup.locator("[data-theme-cycle-mobile]");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if ((await page.locator("html").getAttribute("data-theme")) === currentTheme) break;
        await cycle.click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", currentTheme);
    } else {
      await themeGroup
        .getByRole("button", {
          name: { light: "Claro", balanced: "Médio", dark: "Escuro" }[currentTheme],
          exact: true,
        })
        .click();
    }
    await page
      .locator(`${root} .investor-stock-table tbody tr.selectable`)
      .first()
      .getByRole("button")
      .click();
    await expect(qualification).toBeVisible();
    await expect(qualification.locator('input[type="radio"]:checked')).toHaveCount(0);
    await qualification.focus();
    await page.mouse.move(0, 0);
    await checkAssociativeSelectedGoldPaint(page);
    stage = "profile";
    await onState("profile");
    result.questions.push(await checkCurrentQuestion(page, 0));
    result.profilePixels = await checkGuidancePixels(qualification.locator(`${question}.current`));
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
        result.rowPixels = await checkGuidancePixels(page.locator(`${root} ${activeRow}`));
      if (label === "Financiamento")
        result.requiredRowMotion = await checkReducedGuidanceMotion(
          page,
          page.locator(`${root} ${activeRow}`),
          field(label),
        );
      await expect(field(next)).toBeDisabled();
      result.keyboardFocus.push(await checkLedgerKeyboardFocus(page, field(label)));
      if (label === "Financiamento") {
        await field(label).fill("0");
        await expect(field(next)).toBeDisabled();
        await expect(page.locator(`${root} ${activeRow}`)).toHaveCount(1);
      }
      await field(label).fill(value);
      result.keyboardFocus.push(await checkLedgerKeyboardFocus(page, field(label)));
      await expect(field(next)).toBeEnabled();
    }
    result.rows.push(await checkRequiredRow(page, "Quantidade de parcelas"));
    result.keyboardFocus.push(
      await checkLedgerKeyboardFocus(page, field("Quantidade de parcelas")),
    );
    result.moneyAfter = await checkAssociativeMoneySpacing(page);
    result.quantity = await checkQuantity(page);
    stage = "ranking";
    await field("Quantidade de parcelas").fill("1");
    await expect(field("Quantidade de parcelas")).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }),
    ).toHaveCount(0);
    await field("Quantidade de parcelas").fill("84");
    result.keyboardFocus.push(
      await checkLedgerKeyboardFocus(page, field("Quantidade de parcelas")),
    );
    await expect(field("Quantidade de parcelas")).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }),
    ).toHaveValue("");
    result.rankingMotion = await checkGuidanceShimmer(page);
    result.rankingPixels = await checkGuidancePixels(
      page.locator(`${root} .investor-associative-approval-editable`),
    );
    await expect
      .poll(
        async () => {
          const paint = await inspectPaint(
            page.getByRole("combobox", { name: "Selecione o Ranking", exact: true }),
          );
          return (
            hasGuidanceThemeSurface(paint) &&
            paint.background[3] === 0 &&
            hasGuidanceGoldBorder(paint)
          );
        },
        {
          timeout,
          message: "Ranking must keep its gold edge and a transparent select above the sheen",
        },
      )
      .toBe(true);
    await onState("ranking");
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
    await onState("summary");
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
        normal: await checkHover(page, locator, "no-preference"),
        reduced: await checkHover(page, locator, "reduce"),
      };
    }
    stage = "footer-effects";
    const footerActions = page
      .locator(`${root} .investor-associative-resource-actions`)
      .locator(":scope > button, :scope > a[href], :scope > .investor-learning-manual > button");
    await expect(footerActions).toHaveCount(5);
    result.footerEffects = [];
    for (const action of await footerActions.all()) {
      result.footerEffects.push({
        name: (await action.getAttribute("aria-label")) || (await action.innerText()).trim(),
        normal: await checkHover(page, action, "no-preference"),
        reduced: await checkHover(page, action, "reduce"),
      });
    }
    stage = "rejection";
    result.rejection = await checkRejection(page);
    stage = "sequenced-motion";
    result.sequencedMotion = await checkAssociativeMotion(page);
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

async function checkRejection(page) {
  const ranking = page.getByRole("combobox", { name: "Selecione o Ranking", exact: true });
  const previousRanking = await ranking.inputValue();
  const financing = page
    .locator(`${root} input`)
    .and(page.getByLabel("Financiamento", { exact: true }));
  const previousFinancing = await financing.inputValue();
  const footer = page.locator(`${root} .investor-associative-approval > footer`);
  const previousMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // An eligible ranking with insufficient financing exercises the actual adjustment button.
    await financing.fill("100");
    await ranking.selectOption("gold");
    await expect(footer).toHaveClass(/\brejected\b/u);
    const trigger = footer.locator(".investor-associative-approval-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleName(/REPROVADO/u);
    const failedCells = page.locator(`${root} .investor-associative-approval .failed-value`);
    await expect(failedCells.first()).toBeVisible();
    const paints = [];
    for (const cell of await failedCells.all()) {
      await expect(cell.locator(":scope > span")).toHaveCount(1);
      await expect(cell.locator(":scope > span")).toHaveText((await cell.innerText()).trim());
    }
    const surfaces = page.locator(
      `${root} .investor-associative-approval > footer.rejected, ${root} .investor-associative-approval .investor-associative-flow-status.rejected, ${root} .investor-associative-approval .failed-value > span`,
    );
    await expect(page.locator(`${root} .investor-associative-flow-status.rejected`)).toHaveCount(2);
    for (const surface of await surfaces.all()) {
      const paint = await inspectPaint(surface);
      assertAssociativeRejectionPaint(paint);
      paints.push(paint);
    }
    for (const text of await trigger.locator("span, small, strong").all()) {
      const paint = await inspectPaint(text);
      assert.deepEqual(
        paint.foreground,
        [255, 255, 255, 255],
        "Rejection trigger text must remain white",
      );
      assert.deepEqual(
        paint.textFill,
        [255, 255, 255, 255],
        "Rejection trigger text fill must remain white",
      );
    }
    await checkGuidanceContrast(page);
    const normal = await checkGuidanceShimmer(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await checkGuidanceShimmer(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ranking.selectOption("");
    await expect(footer).toHaveCount(0);
    const cleared = await checkGuidanceShimmer(page);
    return { paints, normal, reduced, cleared };
  } finally {
    await financing.fill(previousFinancing);
    await ranking.selectOption(previousRanking);
    await page.emulateMedia({ reducedMotion: previousMotion ? "reduce" : "no-preference" });
  }
}

export async function inspectAssociativeGuidanceContrast(page) {
  const focusedLedger = `${root} .investor-associative-compact-account li:has(input:focus-visible)`;
  return page
    .locator(
      `${root} ${question}.current .investor-associative-question-heading > span, ${root} ${question}.current > small, ${root} ${question}.current input:not([type="radio"]), ${root} ${question}.current .investor-associative-choice-row > button:not([aria-disabled="true"]), ${root} ${question}.current .investor-associative-yes-no label, ${root} ${activeRow} input, ${root} ${activeRow} .investor-direct-step-name strong, ${focusedLedger} input, ${focusedLedger} .investor-direct-step-name strong, ${root} .investor-associative-commission-launcher > span, ${root} .investor-associative-approval > footer.rejected :is(span, small, strong), ${root} .investor-associative-flow-status.rejected, ${root} .investor-associative-approval .failed-value > span`,
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
          const haloShadows =
            foregroundStyle.textShadow.match(/rgb\(6, 31, 53\) -?[01]px -?[01]px 0px/gu) ?? [];
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
          // Eight opaque, zero-blur shadows form the glyph backdrop during the dark sweep.
          // Its rendered coverage is checked by the opt-in associative-effects Chromium fixture.
          const protectedHalo = haloShadows.length === 8;
          if (protectedHalo) backgrounds = [[6, 31, 53, 255]];
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
            protectedHalo,
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
            // Oversized locator captures reset Chromium's touch emulation when resizing back.
            await page.screenshot({
              path: path.join(output, filename),
              animations: "disabled",
              fullPage: false,
            });
            assert.equal(
              await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
              mobile,
              "Evidence capture must preserve the pointer mode",
            );
            check.captures.push(filename);
            check.contrast[state] = await inspectAssociativeGuidanceContrast(page);
          };
          try {
            const themeGroup = page.getByRole("group", {
              name: "Aparência da página",
              exact: true,
            });
            if (mobile) {
              const cycle = themeGroup.locator("[data-theme-cycle-mobile]");
              for (let attempt = 0; attempt < 3; attempt += 1) {
                if ((await page.locator("html").getAttribute("data-theme")) === theme) break;
                await cycle.click();
              }
              await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            } else {
              await themeGroup.getByRole("button", { name: label, exact: true }).click();
            }
            await page
              .locator(".investor-stock-table tbody tr.selectable")
              .first()
              .getByRole("button")
              .click();
            check.guidance = await checkAssociativeGuidance(page, { onState: capture });
            check.finalPointer = await page.evaluate(() => ({
              coarse: matchMedia("(pointer: coarse)").matches,
              maxTouchPoints: navigator.maxTouchPoints,
            }));
            assert.equal(check.finalPointer.coarse, mobile);
            assert.equal(check.finalPointer.maxTouchPoints > 0, mobile);
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
