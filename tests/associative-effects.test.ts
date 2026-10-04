import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  checkAssociativeCommissionGeometry,
  checkAssociativeSelectedGoldPaint,
} from "../scripts/qa/associative-compact-layout.mjs";

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
      "associative-selection-shine 3s ease-in-out infinite",
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
      expect(style.animation).toBe("associative-pending-shine 3s ease-in-out infinite");
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

  it("keeps rejection separate at three seconds", () => {
    const rejection = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-rejection-shine "),
    );
    expect(rejection?.selector).toContain("footer.rejected::after");
    expect(values(rejection!).animation).toBe(
      "associative-rejection-shine 3s ease-in-out infinite",
    );
  });

  it("gives enabled buttons and radio labels a masked rim without changing geometry", () => {
    const active = rules.find((rule) =>
      values(rule).animation?.startsWith("associative-specular-orbit "),
    );
    expect(active?.selector).toContain(scope);
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
                <section class="investor-associative-question current"><div class="investor-associative-question-heading"><span>Renda familiar</span></div><div class="investor-associative-question-money"><span>R$</span><input aria-label="Renda familiar" value="10.000,00"></div><small>Pendente</small></section>
                <div class="investor-associative-results-stack"><section class="investor-associative-approval">Aprovacao</section>
                  <div class="investor-associative-payment-summary-layout"><section class="investor-associative-payment-summary"><header><div><div><strong>Resumo das parcelas</strong><small>Dados sinteticos</small></div></div></header><div class="investor-associative-payment-table" role="table">
                    ${["Linear", "Decrescente 40%", "Decrescente 30%", "Decrescente 20%", "Decrescente 10%"].map((label, i) => `<div class="investor-associative-payment-table-row ${i ? "is-decreasing" : "is-linear"}" role="row"><strong role="rowheader">${label}</strong><span role="cell" data-label="Quantidade">12</span><span role="cell" data-label="Sem correcao">R$ 1.000</span><span role="cell" data-label="Com correcao">R$ 1.100</span><time role="cell" data-label="Primeira mensal">15/09/2032</time><span role="cell" data-label="Ultima mensal" class="investor-associative-payment-last-date"><time>15/09/2033</time></span></div>`).join("")}
                  </div></section><button class="investor-associative-commission-launcher" aria-label="Abrir remuneracao"><span aria-hidden="true">$</span></button></div>
                </div>
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
                ).toBe("3s");
              }
              expect(
                await page
                  .locator("#inactive")
                  .evaluate((element) => getComputedStyle(element).animationName),
              ).toBe("none");
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
              for (const action of await page
                .locator(
                  ".investor-associative-resource-actions :is(button,a), #profile, .investor-associative-commission-launcher",
                )
                .all()) {
                await action.hover();
                expect(
                  await action.evaluate(
                    (element) => getComputedStyle(element, "::before").animationName,
                  ),
                ).toBe("associative-specular-orbit");
                await page.mouse.move(0, 0);
                await page.keyboard.press("Tab");
                await action.focus();
                expect(
                  await action.evaluate(
                    (element) => getComputedStyle(element, "::before").animationName,
                  ),
                ).toBe("associative-specular-orbit");
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
                ).toBe("3s");
              }
              await page
                .locator("#fixture-dialog")
                .evaluate((element) => (element as HTMLDialogElement).close());
              for (const selector of [
                "#disabled",
                "#aria-disabled",
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
              const during = await capture(1500);
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
              const bands = [0, 0];
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
                  if (delta >= 60) bands[y < during.info.height / 2 ? 0 : 1]! += 1;
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
                bands.every((count) => count > during.info.width),
                `${width}/${theme}: both interior halves must change`,
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
