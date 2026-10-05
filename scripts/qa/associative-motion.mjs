import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import sharp from "sharp";

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
];

/** Measure painted pixels, including clipping and transparent gradient stops. */
export async function checkAssociativeDocumentationHandoff(page) {
  const summary = page.locator(`${root} .investor-associative-documentation-summary`);
  const cards = summary.locator(":scope > section");
  await expect(cards).toHaveCount(2);
  await summary.scrollIntoViewIfNeeded();
  const saved = await summary.evaluateHandle((summary) =>
    [...summary.querySelectorAll(":scope > section")].map((element) => {
      const animation = element
        .getAnimations({ subtree: true })
        .find(
          (item) =>
            item.animationName === "associative-documentation-shine" &&
            item.effect.target === element,
        );
      if (!animation) throw new Error("Documentation shine missing");
      const state = {
        animation,
        startTime: animation.startTime,
        currentTime: animation.currentTime,
        playState: animation.playState,
      };
      animation.pause();
      return state;
    }),
  );
  // Freeze unrelated paint (for example, a breathing help icon) during pixel comparisons.
  const otherAnimations = await page.evaluateHandle(() =>
    document
      .getAnimations()
      .filter(
        (animation) =>
          animation.animationName !== "associative-documentation-shine" &&
          ["running", "paused"].includes(animation.playState),
      )
      .map((animation) => {
        const state = {
          animation,
          startTime: animation.startTime,
          currentTime: animation.currentTime,
          playState: animation.playState,
        };
        animation.pause();
        return state;
      }),
  );
  let hidden;
  try {
    const clocks = await saved.evaluate((states) => states.map(({ startTime }) => startTime));
    assert.ok(
      typeof clocks[0] === "number" && clocks[0] === clocks[1],
      "Documentation clocks must match",
    );
    const bounds = await cards.evaluateAll((elements) => {
      const parent = elements[0].parentElement.getBoundingClientRect();
      return elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const textRects = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          for (const text of range.getClientRects())
            textRects.push({
              left: text.left - parent.left - 2,
              right: text.right - parent.left + 2,
              top: text.top - parent.top - 2,
              bottom: text.bottom - parent.top + 2,
            });
        }
        return {
          x: rect.left - parent.left,
          y: rect.top - parent.top,
          width: rect.width,
          height: rect.height,
          textRects,
        };
      });
    });
    const clip = await summary.boundingBox();
    assert.ok(clip, "Documentation cards must be visible");
    const capture = async () =>
      sharp(await page.screenshot({ clip, animations: "allow", scale: "css" }))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    hidden = await page.addStyleTag({
      content: `${root} .investor-associative-documentation-summary > section::after { background-image: none !important; }`,
    });
    const baseline = await capture();
    await hidden.evaluate((element) => element.remove());
    hidden = undefined;
    const masks = bounds.map((rect) => {
      const offsets = [];
      for (let y = Math.ceil(rect.y + 2); y < Math.floor(rect.y + rect.height - 2); y++) {
        for (let x = Math.ceil(rect.x + 2); x < Math.floor(rect.x + rect.width - 2); x++) {
          if (
            !rect.textRects.some(
              (text) => x >= text.left && x <= text.right && y >= text.top && y <= text.bottom,
            )
          )
            offsets.push((y * baseline.info.width + x) * baseline.info.channels);
        }
      }
      return offsets;
    });
    const sample = async (time) => {
      await saved.evaluate((states, time) => {
        for (const { animation } of states) animation.currentTime = time;
      }, time);
      const frame = await capture();
      assert.deepEqual(frame.info, baseline.info, "Documentation geometry must remain stable");
      const painted = masks.map((offsets) => {
        let pixels = 0;
        for (const offset of offsets) {
          if (
            Math.max(
              Math.abs(frame.data[offset] - baseline.data[offset]),
              Math.abs(frame.data[offset + 1] - baseline.data[offset + 1]),
              Math.abs(frame.data[offset + 2] - baseline.data[offset + 2]),
            ) >= 8
          )
            pixels++;
        }
        return pixels;
      });
      return { time, painted, visible: painted.map((pixels) => pixels >= 8) };
    };
    const cycles = [];
    const frameMs = 1000 / 60;
    const stepMs = 450;
    for (const cycle of [0, 1]) {
      const samples = [];
      for (let time = cycle * 9000; time < (cycle + 1) * 9000; time += stepMs)
        samples.push(await sample(time));
      const first = [0, 1].map((index) => samples.find((item) => item.visible[index]));
      const last = [0, 1].map((index) => samples.findLast((item) => item.visible[index]));
      assert.ok(
        first.every(Boolean) && last.every(Boolean),
        "Both documentation cards must visibly shine",
      );
      assert.ok(
        first[0].time < first[1].time && last[0].time < last[1].time,
        `Shine must travel from Plano sugerido to Composicao: ${JSON.stringify({ first, last })}`,
      );
      // Refine the actual painted boundaries to less than one 60 Hz frame.
      let leftVisible = last[0].time;
      let leftInvisible = leftVisible + stepMs;
      let rightInvisible = first[1].time - stepMs;
      let rightVisible = first[1].time;
      while (leftInvisible - leftVisible > frameMs / 2) {
        const middle = (leftVisible + leftInvisible) / 2;
        if ((await sample(middle)).visible[0]) leftVisible = middle;
        else leftInvisible = middle;
      }
      while (rightVisible - rightInvisible > frameMs / 2) {
        const middle = (rightVisible + rightInvisible) / 2;
        if ((await sample(middle)).visible[1]) rightVisible = middle;
        else rightInvisible = middle;
      }
      const gapMs = Math.max(0, rightVisible - leftVisible);
      const handoff = {
        cycle,
        lastLeftVisibleMs: leftVisible,
        firstRightVisibleMs: rightVisible,
        gapMs,
        samples: samples.length,
      };
      assert.ok(
        gapMs <= frameMs,
        `Invisible documentation handoff gap exceeds one frame: ${JSON.stringify(handoff)}`,
      );
      assert.ok(
        samples
          .filter((item) => item.time >= first[0].time && item.time <= last[1].time)
          .every((item) => item.visible.some(Boolean)),
        "Documentation sweep must not disappear between cards",
      );
      cycles.push(handoff);
    }
    return {
      contract: "associative-documentation-painted-handoff-v1",
      frameMs,
      cycles,
      passed: true,
    };
  } finally {
    if (hidden) await hidden.evaluate((element) => element.remove());
    await saved.evaluate((states) => {
      for (const { animation, startTime, currentTime, playState } of states) {
        if (playState === "paused") animation.currentTime = currentTime;
        else {
          animation.play();
          animation.startTime = startTime;
        }
      }
    });
    await saved.dispose();
    await otherAnimations.evaluate((states) => {
      for (const { animation, startTime, currentTime, playState } of states) {
        if (playState === "paused") animation.currentTime = currentTime;
        else {
          animation.play();
          animation.startTime = startTime;
        }
      }
    });
    await otherAnimations.dispose();
  }
}

/** Run against the real completed synthetic proposal, not a replacement HTML fixture. */
export async function checkAssociativeMotion(page) {
  const previousMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const result = { contract: "associative-sequenced-motion-v1", groups: [], passed: false };
  try {
    const headings = await page
      .locator(`${root} .investor-section-heading`)
      .evaluateAll((elements) =>
        elements.map((element) => {
          const badge = element.querySelector(":scope > span")?.getBoundingClientRect();
          const copy = element.querySelector(":scope > div")?.getBoundingClientRect();
          return {
            fits: !badge || !copy || badge.right <= copy.left,
            text: element.textContent.trim().slice(0, 80),
          };
        }),
      );
    assert.ok(
      headings.every((heading) => heading.fits),
      `Section badges must not overlap their headings: ${JSON.stringify(headings)}`,
    );
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
    result.documentationHandoff = await checkAssociativeDocumentationHandoff(page);

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
