import assert from "node:assert/strict";
import { expect } from "@playwright/test";

const root = ".investor-associative-table-page";
const groups = [
  {
    selector: ".investor-property-summary, .investor-property-summary > dl > div",
    name: "associative-property-orbit",
    count: 10,
    pseudo: "::before",
  },
  {
    selector:
      ".investor-associative-payment-summary.is-ready .investor-associative-payment-table-row",
    name: "associative-installment-orbit",
    count: 5,
    pseudo: "::before",
  },
  {
    selector: ".investor-associative-documentation-summary > section",
    name: "associative-documentation-shine",
    count: 2,
    pseudo: "::after",
  },
];

/** Run against the real completed synthetic proposal, not a replacement HTML fixture. */
export async function checkAssociativeMotion(page) {
  const previousMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const result = { contract: "associative-sequenced-motion-v1", groups: [], passed: false };
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.mouse.move(0, 0);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const loops = page.locator(
      `${root} :is(.investor-guided-start, .investor-associative-payment-actions-bar > button):not(:disabled):not([aria-disabled="true"])`,
    );
    assert.ok(
      (await loops.count()) >= 4,
      "Both guide CTAs and optional-payment actions must be inspected",
    );
    result.loops = await loops.evaluateAll((elements) =>
      elements.map((element) => {
        const animation = element
          .getAnimations({ subtree: true })
          .find(
            (item) =>
              item.animationName === "associative-loop-orbit" && item.effect.target === element,
          );
        return {
          name: element.textContent.trim(),
          duration: animation?.effect.getTiming().duration,
          iterations: String(animation?.effect.getTiming().iterations),
          start: animation?.startTime,
          opacity: getComputedStyle(element, "::before").opacity,
        };
      }),
    );
    assert.ok(
      result.loops.every(
        (item) => item.duration === 4500 && item.iterations === "Infinity" && item.opacity === "1",
      ),
      "Enabled CTAs must loop without hover",
    );
    const selected = await page
      .locator(`${root} .investor-stock-table tr.selected`)
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .find(
              (animation) =>
                animation.animationName === "associative-selection-shine" &&
                animation.effect.target === element,
            )?.startTime,
      );
    assert.ok(
      typeof selected === "number" && result.loops.every((item) => item.start === selected),
      "Selected row and continuously animated CTAs share one clock",
    );
    for (const loop of await loops.all()) {
      await loop.hover();
      await loop.focus();
      const current = await loop.evaluate((element) => {
        const animation = element
          .getAnimations({ subtree: true })
          .find(
            (item) =>
              item.animationName === "associative-loop-orbit" && item.effect.target === element,
          );
        return {
          start: animation?.startTime,
          name: getComputedStyle(element, "::before").animationName,
        };
      });
      assert.deepEqual(
        current,
        { start: selected, name: "associative-loop-orbit" },
        "Hover and keyboard focus must preserve the continuous CTA clock",
      );
    }
    await page.mouse.move(0, 0);

    for (const group of groups) {
      const locator = page.locator(
        group.selector
          .split(", ")
          .map((selector) => `${root} ${selector}`)
          .join(", "),
      );
      await expect(locator).toHaveCount(group.count);
      const samples = await locator.evaluateAll(async (elements, config) => {
        const animations = elements.map((element) =>
          element
            .getAnimations({ subtree: true })
            .find(
              (animation) =>
                animation.animationName === config.name && animation.effect.target === element,
            ),
        );
        if (animations.some((animation) => !animation)) return { missing: true };
        const saved = animations.map((animation) => ({
          startTime: animation.startTime,
          playState: animation.playState,
          currentTime: animation.currentTime,
        }));
        const samples = [];
        try {
          for (const animation of animations) animation.pause();
          for (const cycle of [0, 1]) {
            for (let slot = 0; slot < config.count; slot++) {
              for (const fraction of [0.15, 0.5, 0.85]) {
                const time = (cycle * config.count + slot + fraction) * 4500;
                for (const animation of animations) animation.currentTime = time;
                await new Promise((resolve) => requestAnimationFrame(resolve));
                samples.push({
                  cycle,
                  slot,
                  fraction,
                  active: elements
                    .map((element, index) =>
                      Number(getComputedStyle(element, config.pseudo).opacity) > 0.01 ? index : -1,
                    )
                    .filter((index) => index !== -1),
                });
              }
            }
          }
          return {
            starts: saved.map((item) => item.startTime),
            timings: animations.map((animation) => ({
              duration: animation.effect.getTiming().duration,
              delay: animation.effect.getTiming().delay,
            })),
            samples,
          };
        } finally {
          animations.forEach((animation, index) => {
            if (saved[index].playState === "paused")
              animation.currentTime = saved[index].currentTime;
            else {
              animation.play();
              animation.startTime = saved[index].startTime;
            }
          });
        }
      }, group);
      assert.ok(!samples.missing, `${group.name}: all expected effects must exist`);
      assert.ok(
        samples.starts.every((value) => value === samples.starts[0]),
        `${group.name}: group clocks must match`,
      );
      samples.timings.forEach((timing, index) =>
        assert.deepEqual(timing, { duration: group.count * 4500, delay: index * 4500 }),
      );
      samples.samples.forEach((sample) =>
        assert.deepEqual(
          sample.active,
          [sample.slot],
          `${group.name}: exactly one target at cycle ${sample.cycle}, slot ${sample.slot}`,
        ),
      );
      result.groups.push({
        name: group.name,
        targets: group.count,
        samples: samples.samples.length,
      });
    }

    const filters = page.locator(`${root} .investor-stock-filters > label`);
    await expect(filters).toHaveCount(6);
    result.filters = [];
    for (const filter of await filters.all()) {
      const select = filter.locator("select");
      const measure = () =>
        select.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x + scrollX,
            y: rect.y + scrollY,
            width: rect.width,
            height: rect.height,
          };
        });
      const before = await measure();
      await select.focus();
      const style = await filter.evaluate((element) => ({
        name: getComputedStyle(element, "::before").animationName,
        duration: getComputedStyle(element, "::before").animationDuration,
        pointerEvents: getComputedStyle(element, "::before").pointerEvents,
        position: getComputedStyle(element, "::before").position,
      }));
      assert.deepEqual(style, {
        name: "associative-specular-orbit",
        duration: "4.5s",
        pointerEvents: "none",
        position: "relative",
      });
      assert.deepEqual(
        await measure(),
        before,
        "Filter focus must not shift or resize its native select",
      );
      result.filters.push(style);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const remaining = await page.locator(root).evaluate((element) =>
      element
        .getAnimations({ subtree: true })
        .filter((animation) =>
          /^associative-(pending|selection|rejection|loop|property|installment|documentation|specular)-/.test(
            animation.animationName,
          ),
        )
        .map((animation) => animation.animationName),
    );
    assert.deepEqual(
      remaining,
      [],
      "Reduced motion disables all new and existing decorative loops",
    );
    result.passed = true;
    return result;
  } finally {
    await page.emulateMedia({ reducedMotion: previousMotion ? "reduce" : "no-preference" });
    await page.mouse.move(0, 0);
  }
}
