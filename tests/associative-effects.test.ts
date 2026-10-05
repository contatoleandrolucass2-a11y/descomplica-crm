import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  checkAssociativeCommissionGeometry,
  checkAssociativeSelectedGoldPaint,
} from "../scripts/qa/associative-compact-layout.mjs";
import { checkGuidanceShimmer } from "../scripts/qa/associative-guidance.mjs";
import { synchronizeAssociativeMotion } from "../app/(protected)/app/simulacao/_components/archive-investor/associative-motion";

const require = createRequire(import.meta.url);
type Rule = {
  selector: string;
  parent: { name?: string; params?: string };
  nodes: { prop?: string; value?: string; important?: boolean }[];
};
const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
  parse: (source: string) => { walkRules: (callback: (rule: Rule) => void) => void };
};
const source = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
    import.meta.url,
  ),
  "utf8",
);
const rules: Rule[] = [];
parse(source).walkRules((rule) => rules.push(rule));
const values = (rule: Rule) =>
  Object.fromEntries(
    rule.nodes.filter((node) => node.prop).map(({ prop, value }) => [prop!, value]),
  );
const scope = ".investor-page-shell.investor-associative-table-page";

describe("Associative decorative effects boundaries", () => {
  it("uses one selected-row gradient instead of restarting gold in every cell", () => {
    const selection = rules.find(
      (rule) =>
        values(rule).animation?.startsWith("associative-selection-shine") &&
        rule.selector.includes("tr.selectable.selected"),
    );
    expect(values(selection!)["background-size"]).toBe("280% 100%, 100% 100%");
    expect(values(selection!).animation).toBe(
      "associative-selection-shine 4.5s ease-in-out infinite",
    );
    const cells = rules.find((rule) =>
      rule.selector.includes("tr.selectable:is(:hover, :focus-within, .selected) > td"),
    );
    expect(values(cells!).background).toBe("transparent");
  });

  it("sweeps the entire pending area behind content without intercepting input", () => {
    const animated = rules.filter((rule) =>
      values(rule).animation?.startsWith("associative-pending-shine "),
    );
    expect(animated).toHaveLength(4);
    for (const rule of animated) {
      expect(rule.selector).toContain(scope);
      const style = values(rule);
      expect(style.animation).toBe("associative-pending-shine 4.5s ease-in-out infinite");
      expect(style["background-size"]).toBe("280% 100%");
      expect(style.background ?? style["background-image"]).toBe(
        "var(--associative-pending-sheen)",
      );
      if (rule.selector.includes("::after") && !rule.selector.includes("question.current")) {
        expect(style["pointer-events"]).toBe("none");
        expect(style["z-index"]).toBe("0");
      }
    }
  });

  it("keeps rejection separate at 4.5 seconds", () => {
    const rejection = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-rejection-shine "),
    );
    expect(rejection?.selector).toContain("footer.rejected::after");
    expect(values(rejection!).animation).toBe(
      "associative-rejection-shine 4.5s ease-in-out infinite",
    );
  });

  it("preserves the 24%-76% travel window for the existing sweeps", () => {
    for (const name of [
      "associative-pending-shine",
      "associative-selection-shine",
      "associative-rejection-shine",
    ]) {
      const frames = rules.filter((rule) => rule.parent.params === name);
      expect(frames.map((frame) => frame.selector)).toEqual(["0%, 24%", "76%, 100%"]);
      const selection = name === "associative-selection-shine";
      expect(values(frames[0]!)["background-position"]).toBe(
        selection ? "150% 50%, 0 0" : "150% 50%",
      );
      expect(values(frames[1]!)["background-position"]).toBe(
        selection
          ? "-50% 50%, 0 0"
          : name === "associative-rejection-shine"
            ? "-90% 50%"
            : "-50% 50%",
      );
    }
  });

  it("loops enabled guide and payment action rims without requiring hover", () => {
    const loop = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-loop-orbit "),
    );
    expect(loop?.selector).toContain(scope);
    expect(loop?.selector).toContain(".investor-guided-start");
    expect(loop?.selector).toContain(".investor-associative-payment-actions-bar > button");
    expect(loop?.selector).toContain(":not(:disabled)");
    expect(loop?.selector).toContain(':not([aria-disabled="true"])');
    expect(loop?.selector).toMatch(/::before$/u);
    expect(loop?.selector).not.toMatch(/:hover|:focus/u);
    expect(values(loop!)).toMatchObject({
      opacity: "1",
      animation: "associative-loop-orbit 4.5s linear infinite",
    });
  });

  it("gives enabled buttons and radio labels a masked rim without changing geometry", () => {
    const active = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-specular-orbit "),
    );
    expect(active?.selector).toContain(scope);
    expect(values(active!).animation).toBe("associative-specular-orbit 4.5s linear infinite");
    for (const state of [
      ":hover",
      ":focus-visible",
      ":has(input:focus-visible)",
      ":not(:disabled)",
      ':not([aria-disabled="true"])',
      ":not(:has(input:disabled))",
    ])
      expect(active?.selector).toContain(state);
    const rim = rules.find((rule) => values(rule)["mask-composite"] === "exclude");
    expect(rim?.selector).toContain(scope);
    expect(values(rim!)).toMatchObject({
      position: "absolute",
      inset: "0",
      "pointer-events": "none",
      opacity: "0",
    });
    expect(values(rim!).transform).toBeUndefined();
    expect(values(rim!).scale).toBeUndefined();
  });

  it("disables decorative motion while retaining a visible keyboard focus", () => {
    const reduced = rules.filter(
      (rule) => rule.parent.params === "(prefers-reduced-motion: reduce)",
    );
    const pending = reduced.find(
      (rule) =>
        rule.selector.startsWith(scope) && rule.selector.includes("question.current::after"),
    );
    expect(values(pending!)).toMatchObject({ animation: "none", "background-image": "none" });
    const specular = reduced.find(
      (rule) =>
        rule.selector.startsWith(scope) &&
        rule.selector.includes("a[href]") &&
        rule.selector.endsWith("::before"),
    );
    expect(values(specular!).animation).toBe("none");
    const label = rules.find(
      (rule) =>
        rule.selector ===
        `${scope} .investor-associative-compact-account li:has(input:focus-visible) .investor-direct-step-name strong`,
    );
    expect(values(label!)).toMatchObject({
      "text-decoration": "none",
      "font-weight": "700",
      color: "var(--inv-color-accent)",
    });
    expect(label?.nodes.find((node) => node.prop === "font-weight")?.important).toBe(true);
  });
});

describe("Associative CSS browser fixtures", () => {
  it.runIf(process.env.ASSOCIATIVE_EFFECTS_BROWSER === "1")(
    "measures the painted documentation handoff across themes, breakpoints and repeated cycles",
    async () => {
      const { checkAssociativeDocumentationHandoff } = await import(
        new URL("../scripts/qa/associative-motion.mjs", import.meta.url).href
      );
      const tokens = readFileSync(
        new URL(
          "../app/(protected)/app/simulacao/_components/archive-investor/investor-theme-tokens.css",
          import.meta.url,
        ),
        "utf8",
      );
      const browser = await chromium.launch({ headless: true });
      const output = "test-results/associative-effects";
      mkdirSync(output, { recursive: true });
      try {
        for (const width of [375, 1440, 320, 560, 561]) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            reducedMotion: "no-preference",
          });
          try {
            const page = await context.newPage();
            for (const theme of width === 375 || width === 1440
              ? ["light", "balanced", "dark"]
              : ["dark"]) {
              await page.setContent(`<html data-theme="${theme}"><body><div class="investor-page-shell investor-associative-table-page">
                <div class="investor-associative-documentation-summary" data-associative-motion-group="documentation">
                  <section class="investor-associative-documentation-plan"><small>Plano sugerido</small><p><strong>24x Parcelas de</strong> <span>R$ 500,00</span></p><small>1a parcela para <b>15/11/2026</b></small><div><small>Total da documentacao</small><strong>R$ 12.000,00</strong></div></section>
                  <section class="investor-associative-documentation-breakdown"><header><h4>Composicao</h4></header><dl>${["ITBI", "Registro total", "Despachante", "Seguro Caixa", "Total da documentacao"].map((label, index) => `<div class="${index === 4 ? "total" : ""}"><dt>${label}</dt><dd>R$ 2.000,00</dd></div>`).join("")}</dl></section>
                </div></div></body></html>`);
              await page.addStyleTag({ content: tokens + source.replace(/^@import[^;]+;/gm, "") });
              await page.addStyleTag({
                content:
                  "body{margin:0;padding:12px}.investor-page-shell{max-width:744px;margin:auto}",
              });
              await page.addScriptTag({
                content: `(${synchronizeAssociativeMotion.toString()})(document.querySelector('.investor-associative-table-page'))`,
              });
              await page.evaluate(
                () =>
                  new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                  ),
              );
              const report = await checkAssociativeDocumentationHandoff(page);
              console.info(JSON.stringify({ width, theme, ...report }));
              expect(report.cycles.every((cycle: { gapMs: number }) => cycle.gapMs === 0)).toBe(
                true,
              );
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
              ).toBeLessThanOrEqual(width);
              const cards = page.locator(".investor-associative-documentation-summary > section");
              const before = await cards.evaluateAll((elements) =>
                elements.map((element) => ({
                  width: element.getBoundingClientRect().width,
                  height: element.getBoundingClientRect().height,
                })),
              );
              await cards.evaluateAll((elements) => {
                for (const element of elements)
                  for (const animation of element.getAnimations({ subtree: true })) {
                    animation.pause();
                    animation.currentTime = 4500;
                  }
              });
              await page.screenshot({
                path: `${output}/${width}-${theme}-documentation-handoff.png`,
                animations: "allow",
              });
              // A clock-correct but clipped/delayed shine must fail the painted-pixel contract.
              if (width === 1440 && theme === "dark") {
                const regression = await page.addStyleTag({
                  content: `${scope} .investor-associative-documentation-summary > section::after { animation: associative-documentation-shine 9s ease-in-out infinite; background-size: 280% 100%; opacity: 0; } ${scope} .investor-associative-documentation-summary > section:nth-child(2)::after { animation-delay: 4.5s; } @keyframes associative-documentation-shine { 0%,12% { background-position:150% 50%;opacity:1; } 38% { background-position:-50% 50%;opacity:1; } 50%,100% { background-position:-50% 50%;opacity:0; } }`,
                });
                await cards.evaluateAll((elements) => {
                  for (const element of elements)
                    for (const animation of element.getAnimations({ subtree: true })) {
                      animation.play();
                      animation.startTime = 0;
                    }
                });
                await expect(checkAssociativeDocumentationHandoff(page)).rejects.toThrow(
                  "Invisible documentation handoff gap",
                );
                await regression.evaluate((element) => element.parentNode?.removeChild(element));
              }
              await page.emulateMedia({ reducedMotion: "reduce" });
              await page.evaluate(
                () =>
                  new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                  ),
              );
              await expect
                .poll(() =>
                  cards.evaluateAll((elements) =>
                    elements.map((element) => ({
                      opacity: getComputedStyle(element, "::after").opacity,
                      animations: element.getAnimations({ subtree: true }).length,
                    })),
                  ),
                )
                .toEqual([
                  { opacity: "0", animations: 0 },
                  { opacity: "0", animations: 0 },
                ]);
              expect(
                await cards.evaluateAll((elements) =>
                  elements.map((element) => ({
                    width: element.getBoundingClientRect().width,
                    height: element.getBoundingClientRect().height,
                  })),
                ),
              ).toEqual(before);
              await page.emulateMedia({ reducedMotion: "no-preference" });
            }
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    },
    600_000,
  );

  // The unit CI job has no browser installation; explicitly enable this focused visual fixture.
  it.runIf(process.env.ASSOCIATIVE_EFFECTS_BROWSER === "1")(
    "checks three themes at desktop/mobile: selection, actions, motion, input band and dollar geometry",
    async () => {
      const tokens = readFileSync(
        new URL(
          "../app/(protected)/app/simulacao/_components/archive-investor/investor-theme-tokens.css",
          import.meta.url,
        ),
        "utf8",
      );
      const css = tokens + source.replace(/^@import[^;]+;/gm, "");
      const output = "test-results/associative-effects";
      mkdirSync(output, { recursive: true });
      const browser = await chromium.launch({ headless: true });
      try {
        for (const width of [375, 1440]) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            isMobile: width === 375,
            hasTouch: width === 375,
          });
          try {
            const page = await context.newPage();
            for (const theme of ["light", "balanced", "dark"]) {
              await page.setContent(`<html data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
              <button data-protected-topbar>Global</button>
              <div class="investor-page-shell investor-associative-table-page"><main class="investor-main">
                <table class="investor-stock-table"><tbody><tr class="selectable selected" aria-selected="true"><td><button class="investor-stock-unit-button">101</button></td><td><span class="investor-stock-product-text">Unidade sintetica</span></td><td><strong class="investor-stock-price">R$ 300.000</strong></td></tr></tbody></table>
                <section class="investor-associative-unit-facts"><div><h3>Dados oficiais ausentes</h3><p>Confirme os dados da unidade.</p></div><div class="investor-associative-unit-fact"><label for="progress">Evolucao da obra (%)</label><input id="progress" type="number" min="0" max="100" value="0"><small role="status">Percentual informado: 0%</small></div><div class="investor-associative-unit-fact"><label for="appraisal">Avaliacao bancaria</label><input id="appraisal" value="300.000,00"><small role="status">Avaliacao informada.</small></div></section>
                <div class="investor-associative-choice-row"><button id="profile" aria-pressed="true">SBPE</button><button id="inactive" aria-pressed="false">Alternativa</button><label id="radio"><input type="radio" checked><span>Sim</span></label><button id="disabled" aria-pressed="true" disabled>Desabilitado</button><button id="aria-disabled" aria-disabled="true">Indisponivel</button></div>
                <section class="investor-associative-question">Perfil concluido</section><section class="investor-associative-question">Modalidade concluida</section>
                <section class="investor-associative-question current"><div class="investor-associative-question-heading"><span>Renda familiar</span></div><div class="investor-associative-question-money"><span>R$</span><input aria-label="Renda familiar" value="10.000,00"></div><small>Pendente</small></section>
                <section class="investor-flow-panel investor-associative-flow-panel"><div class="investor-flow-form">
                <div class="investor-associative-results-stack"><section class="investor-associative-approval">Aprovacao</section>
                  <div class="investor-associative-payment-summary-layout"><section class="investor-associative-payment-summary"><header><div><div><strong>Resumo das parcelas</strong><small>Dados sinteticos</small></div></div></header><div class="investor-associative-payment-table" role="table">
                    ${["Linear", "Decrescente 40%", "Decrescente 30%", "Decrescente 20%", "Decrescente 10%"].map((label, i) => `<div class="investor-associative-payment-table-row ${i ? "is-decreasing" : "is-linear"}" role="row"><strong role="rowheader">${label}</strong><span role="cell" data-label="Quantidade">12</span><span role="cell" data-label="Sem correcao">R$ 1.000</span><span role="cell" data-label="Com correcao">R$ 1.100</span><time role="cell" data-label="Primeira mensal">15/09/2032</time><span role="cell" data-label="Ultima mensal" class="investor-associative-payment-last-date"><time>15/09/2033</time></span></div>`).join("")}
                  </div></section><button class="investor-associative-commission-launcher" aria-label="Abrir remuneracao"><span aria-hidden="true">$</span></button></div>
                </div></div></section>
                <button class="investor-guided-start" id="guide">Guia</button><button class="investor-guided-start" id="guide-disabled" disabled>Guia indisponivel</button>
                <div class="investor-associative-payment-actions-bar"><button id="payment-action">Parcelas</button><button id="payment-disabled" disabled>Indisponivel</button><button id="payment-aria-disabled" aria-disabled="true">Indisponivel</button></div>
                <section class="investor-direct-resource-actions investor-associative-resource-actions"><button>Aprenda +</button><button>Doc Pessoa Fisica</button><button>Imprimir</button><a href="#bora">Bora Vendas</a><a href="#salesforce">Salesforce</a></section>
                <dialog id="fixture-dialog"><button>Fechar modal</button><a href="#secondary">Acao secundaria</a></dialog>
              </main></div><div class="investor-page-shell investor-standard-table-page"><button id="other-simulator">Outro simulador</button></div></body></html>`);
              await page.addStyleTag({ content: css });
              await page.addStyleTag({
                content:
                  "body{margin:0}.investor-page-shell{max-width:744px;margin:auto}.investor-main{padding:12px!important}.investor-stock-table{min-width:0!important;width:100%}.investor-associative-question{margin-block:12px}.investor-associative-approval{min-height:24px}",
              });
              await page.emulateMedia({ reducedMotion: "no-preference" });
              await page.mouse.move(0, 0);
              const selected = page.locator("tr.selected");
              // Inspect the actual computed row surface; its transparent cells must not split the gradient.
              await checkAssociativeSelectedGoldPaint(page);
              for (const selector of ["tr.selected", "#profile", "#radio"]) {
                expect(
                  await page
                    .locator(selector)
                    .evaluate((element) => getComputedStyle(element).animationDuration),
                ).toBe("4.5s");
              }
              expect(
                await page
                  .locator("#inactive")
                  .evaluate((element) => getComputedStyle(element).animationName),
              ).toBe("none");
              for (const selector of ["#guide", "#payment-action"]) {
                const loop = await page.locator(selector).evaluate((element) => {
                  const style = getComputedStyle(element, "::before");
                  return {
                    hovered: element.matches(":hover, :focus-visible"),
                    name: style.animationName,
                    duration: style.animationDuration,
                    iterations: style.animationIterationCount,
                    playState: style.animationPlayState,
                    opacity: style.opacity,
                    pointerEvents: style.pointerEvents,
                  };
                });
                expect(loop).toEqual({
                  hovered: false,
                  name: "associative-loop-orbit",
                  duration: "4.5s",
                  iterations: "infinite",
                  playState: "running",
                  opacity: "1",
                  pointerEvents: "none",
                });
              }
              const current = page.locator(".investor-associative-question.current");
              // Give the same owner an independent decorative sequence: pending QA must count only its sweep.
              await current.evaluate((element) =>
                element.classList.add("investor-property-summary"),
              );
              expect(
                await current.evaluate((element) =>
                  element
                    .getAnimations({ subtree: true })
                    .map((animation) => (animation as CSSAnimation).animationName),
                ),
              ).toContain("associative-property-orbit");
              const guidance = await checkGuidanceShimmer(page);
              expect(guidance.find((measurement) => measurement.active)?.animations).toHaveLength(
                1,
              );
              await current.evaluate((element) =>
                element.classList.remove("investor-property-summary"),
              );
              await expect
                .poll(() =>
                  page
                    .locator(".investor-associative-commission-launcher")
                    .evaluate((element) => getComputedStyle(element).backgroundColor),
                )
                .toBe("rgba(0, 0, 0, 0)");
              const geometry = await checkAssociativeCommissionGeometry(
                page.locator(".investor-associative-commission-launcher"),
              );
              expect(geometry.dateCenterDelta).toBeLessThanOrEqual(1);
              expect(geometry.summaryGap).toBeCloseTo(4);
              expect(
                geometry.outsideSummary && geometry.insideFlow && geometry.insideViewport,
              ).toBe(true);
              expect(geometry.summaryEdgesAligned).toBe(true);
              for (const action of await page
                .locator(
                  ".investor-associative-resource-actions :is(button,a), #profile, #guide, #payment-action, .investor-associative-commission-launcher",
                )
                .all()) {
                const expectedEffect = await action.evaluate((element) =>
                  element.matches(
                    ".investor-guided-start, .investor-associative-payment-actions-bar > button",
                  )
                    ? "associative-loop-orbit"
                    : "associative-specular-orbit",
                );
                await action.hover();
                expect(
                  await action.evaluate(
                    (element) => getComputedStyle(element, "::before").animationName,
                  ),
                ).toBe(expectedEffect);
                expect(
                  await action.evaluate(
                    (element) => getComputedStyle(element, "::before").animationDuration,
                  ),
                ).toBe("4.5s");
                await page.mouse.move(0, 0);
                await page.keyboard.press("Tab");
                await action.focus();
                expect(
                  await action.evaluate(
                    (element) => getComputedStyle(element, "::before").animationName,
                  ),
                ).toBe(expectedEffect);
              }
              await page
                .locator("#fixture-dialog")
                .evaluate((element) => (element as HTMLDialogElement).showModal());
              for (const action of await page.locator("#fixture-dialog :is(button,a)").all()) {
                await action.hover();
                expect(
                  await action.evaluate(
                    (element) => getComputedStyle(element, "::before").animationDuration,
                  ),
                ).toBe("4.5s");
              }
              await page
                .locator("#fixture-dialog")
                .evaluate((element) => (element as HTMLDialogElement).close());
              for (const selector of [
                "#disabled",
                "#aria-disabled",
                "#guide-disabled",
                "#payment-disabled",
                "#payment-aria-disabled",
                "[data-protected-topbar]",
                "#other-simulator",
              ]) {
                await page.locator(selector).hover();
                expect(
                  await page
                    .locator(selector)
                    .evaluate((element) => getComputedStyle(element, "::before").animationName),
                ).toBe("none");
              }
              const capture = async (time: number) => {
                await selected.evaluate((element, currentTime) => {
                  for (const animation of element.getAnimations()) {
                    if (
                      !(animation instanceof CSSAnimation) ||
                      animation.animationName !== "associative-selection-shine" ||
                      (animation.effect as KeyframeEffect).target !== element
                    )
                      continue;
                    animation.pause();
                    animation.currentTime = currentTime;
                  }
                }, time);
                return sharp(
                  await selected.screenshot({
                    animations: "allow",
                    path: `${output}/${width}-${theme}-sweep-${time}.png`,
                  }),
                )
                  .ensureAlpha()
                  .raw()
                  .toBuffer({ resolveWithObject: true });
              };
              const before = await capture(0);
              const leading = await capture(2150);
              const during = await capture(2250);
              const trailing = await capture(2350);
              const textRects = await selected.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                const rectangles = [];
                while (walker.nextNode()) {
                  if (!walker.currentNode.textContent?.trim()) continue;
                  const range = document.createRange();
                  range.selectNodeContents(walker.currentNode);
                  const rect = range.getBoundingClientRect();
                  rectangles.push({
                    left: rect.left - bounds.left,
                    right: rect.right - bounds.left,
                    top: rect.top - bounds.top,
                    bottom: rect.bottom - bounds.top,
                  });
                }
                return rectangles;
              });
              expect(during.info).toEqual(before.info);
              expect(leading.info).toEqual(before.info);
              expect(trailing.info).toEqual(before.info);
              const bands = [0, 0];
              const sampleBands = [
                [0, 0],
                [0, 0],
                [0, 0],
              ];
              const samples = [leading, during, trailing];
              let maximumDelta = 0;
              let glyphPixels = 0;
              let protectedGlyphPixels = 0;
              for (let y = 2; y < during.info.height - 2; y += 1) {
                for (let x = 2; x < during.info.width - 2; x += 1) {
                  const offset = (y * during.info.width + x) * 4;
                  const delta = [0, 1, 2].reduce(
                    (total, channel) =>
                      total +
                      Math.abs(during.data[offset + channel]! - before.data[offset + channel]!),
                    0,
                  );
                  maximumDelta = Math.max(maximumDelta, delta);
                  const half = y < during.info.height / 2 ? 0 : 1;
                  let swept = false;
                  for (const [index, sample] of samples.entries()) {
                    const sampleDelta = [0, 1, 2].reduce(
                      (total, channel) =>
                        total +
                        Math.abs(sample.data[offset + channel]! - before.data[offset + channel]!),
                      0,
                    );
                    if (sampleDelta >= 60) {
                      sampleBands[index]![half]! += 1;
                      swept = true;
                    }
                  }
                  if (swept) bands[half]! += 1;
                  if (
                    theme === "dark" &&
                    textRects.some(
                      (rect) =>
                        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
                    ) &&
                    [243, 251, 255].every(
                      (channel, i) => Math.abs(during.data[offset + i]! - channel) <= 10,
                    )
                  ) {
                    glyphPixels += 1;
                    let darkHalo = false;
                    for (let dy = -2; dy <= 2; dy += 1)
                      for (let dx = -2; dx <= 2; dx += 1) {
                        const adjacent = ((y + dy) * during.info.width + x + dx) * 4;
                        if (
                          [6, 31, 53].every(
                            (channel, i) => Math.abs(during.data[adjacent + i]! - channel) <= 12,
                          )
                        )
                          darkHalo = true;
                      }
                    if (darkHalo) protectedGlyphPixels += 1;
                  }
                }
              }
              // Light surfaces have less luminance headroom; require >=30 RGB levels/channel,
              // and >=50 in dark mode, well above the former 14% translucent sweep.
              expect(
                maximumDelta,
                `${width}/${theme}: sweep must be strongly visible`,
              ).toBeGreaterThan(theme === "dark" ? 150 : 90);
              expect(
                sampleBands.every((sample) => sample.every((count) => count > 10)),
                `${width}/${theme}: the narrow band must reach both interior halves in each frame`,
              ).toBe(true);
              // The thin band covers less area per frame; retain the coverage gate over its travel.
              expect(
                bands.every((count) => count > during.info.width),
                `${width}/${theme}: both interior halves must change across the sweep`,
              ).toBe(true);
              if (theme === "dark") {
                expect(glyphPixels, "Dark sweep must retain visible text glyphs").toBeGreaterThan(
                  5,
                );
                expect(
                  protectedGlyphPixels / glyphPixels,
                  "Rendered glyphs must retain their dark protective halo",
                ).toBeGreaterThan(0.9);
              }
              await page
                .locator("#profile")
                .evaluate((element) => element.setAttribute("aria-pressed", "false"));
              await selected.evaluate((element) => {
                element.classList.remove("selected");
                element.setAttribute("aria-selected", "false");
              });
              expect(
                await page
                  .locator("#profile")
                  .evaluate((element) => getComputedStyle(element).animationName),
              ).toBe("none");
              expect(
                await page
                  .locator("tr.selectable")
                  .evaluate((element) => getComputedStyle(element).animationName),
              ).toBe("none");
              await page.emulateMedia({ reducedMotion: "reduce" });
              for (const selector of ["#guide", "#payment-action"]) {
                expect(
                  await page
                    .locator(selector)
                    .evaluate((element) =>
                      element
                        .getAnimations({ subtree: true })
                        .filter((animation) => animation instanceof CSSAnimation),
                    ),
                ).toEqual([]);
              }
              await page.locator("#radio").hover();
              expect(
                await page.locator("#radio").evaluate((element) =>
                  element.getAnimations({ subtree: true }).map((animation) => ({
                    name: (animation as CSSAnimation).animationName,
                    target: (animation.effect as KeyframeEffect).pseudoElement,
                  })),
                ),
              ).toEqual([]);
              expect(
                await page
                  .locator(".investor-associative-question.current")
                  .evaluate((element) => element.getAnimations({ subtree: true }).length),
              ).toBe(0);
              for (const input of await page
                .locator(".investor-associative-unit-fact input")
                .all()) {
                const style = await input.evaluate((element) => ({
                  background: getComputedStyle(element).backgroundColor,
                  align: getComputedStyle(element).textAlign,
                  height: element.getBoundingClientRect().height,
                }));
                expect(style.background).toBe("rgba(0, 0, 0, 0)");
                expect(style.align).toBe("right");
                expect(style.height).toBeGreaterThanOrEqual(width === 375 ? 44 : 34);
              }
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              ).toBe(true);
              await page.screenshot({
                path: `${output}/${width}-${theme}.png`,
                fullPage: true,
                animations: "disabled",
              });
            }
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
