import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertAssociativeMoneySpacing,
  assertAssociativeQuantityGeometry,
  assertAssociativeSummaryGaps,
  isGuidanceGold,
  isGuidanceGoldText,
} from "../scripts/qa/associative-guidance.mjs";

describe("Associativo guidance regression gates", () => {
  it("accepts gold and rejects blue, green and transparent surfaces", () => {
    expect(isGuidanceGold([233, 189, 84, 255])).toBe(true);
    for (const color of [
      [102, 228, 236, 255],
      [25, 180, 100, 255],
      [233, 189, 84, 0],
    ]) {
      expect(isGuidanceGold(color)).toBe(false);
    }
  });

  it("requires at least 8px between R$ and the numeric text, without clipping", () => {
    expect(() => assertAssociativeMoneySpacing([{ gap: 8, fits: true }])).not.toThrow();
    expect(() => assertAssociativeMoneySpacing([{ gap: 7.99, fits: true }])).toThrow(/>=8px/u);
    expect(() => assertAssociativeMoneySpacing([{ gap: 12, fits: false }])).toThrow(/clipping/u);
    expect(() => assertAssociativeMoneySpacing([])).toThrow(/measured/u);
    expect(() =>
      assertAssociativeMoneySpacing([{ gap: 8, fits: true, height: 43, minimumHeight: 44 }]),
    ).toThrow(/>=44px/u);
    expect(() =>
      assertAssociativeMoneySpacing([{ gap: 8, fits: true, height: 44, minimumHeight: 44 }]),
    ).not.toThrow();
  });

  it("rejects a blue clipped glyph even when computed color is gold", () => {
    const paint = {
      foreground: [233, 189, 84, 255],
      textFill: [0, 0, 0, 0],
      backgroundClip: "text",
      background: [0, 0, 0, 0],
      gradient: [
        [102, 228, 236, 255],
        [7, 139, 159, 255],
      ],
    };
    expect(isGuidanceGoldText(paint)).toBe(false);
    expect(isGuidanceGoldText({ ...paint, gradient: [paint.foreground] })).toBe(true);
    expect(isGuidanceGoldText({ ...paint, textFill: paint.foreground })).toBe(true);
    expect(isGuidanceGoldText({ ...paint, gradient: [] })).toBe(false);
    expect(
      isGuidanceGoldText({ ...paint, backgroundClip: "border-box", gradient: [paint.foreground] }),
    ).toBe(false);
  });

  it("rejects a narrower, taller or shifted quantity field", () => {
    const input = { width: 112, height: 28, right: 600 };
    expect(() =>
      assertAssociativeQuantityGeometry({ quantity: input, money: [input] }),
    ).not.toThrow();
    for (const property of ["width", "height", "right"]) {
      expect(() =>
        assertAssociativeQuantityGeometry({
          quantity: { ...input, [property]: input[property as keyof typeof input] + 2 },
          money: [input],
        }),
      ).toThrow(/must match/u);
    }
    expect(() =>
      assertAssociativeQuantityGeometry({ quantity: input, money: [input], minimumHeight: 44 }),
    ).toThrow(/>=44px/u);
  });

  it("separates Linear while keeping all four decreasing blocks together", () => {
    expect(() =>
      assertAssociativeSummaryGaps({ separation: 8, decreasingGaps: [0, 0, 0] }),
    ).not.toThrow();
    for (const separation of [0, 3, 13]) {
      expect(() => assertAssociativeSummaryGaps({ separation, decreasingGaps: [0, 0, 0] })).toThrow(
        /4-12px/u,
      );
    }
    expect(() =>
      assertAssociativeSummaryGaps({ separation: 8, decreasingGaps: [0, 8, 0] }),
    ).toThrow(/together/u);
    expect(() => assertAssociativeSummaryGaps({ separation: 8, decreasingGaps: [0, 0] })).toThrow(
      /four/u,
    );
  });

  it("runs guidance after initial geometry and selected-unit checks", () => {
    const source = readFileSync(
      new URL("../scripts/qa/archive-navigation.mjs", import.meta.url),
      "utf8",
    );
    const guidance = source.indexOf("await checkAssociativeGuidance(page)");
    expect(guidance).toBeGreaterThan(source.indexOf("await checkAssociativeInitialViewport(page)"));
    expect(guidance).toBeGreaterThan(source.indexOf("await checkAssociativeSelectedGold(page)"));
    expect(source).toContain(
      "check.associativeGuidance[theme] = await checkAssociativeGuidance(page)",
    );
    expect(source).toContain("if (associativeGuidanceWidths.includes(viewport.width))");
    expect(source).toContain("Guidance widths must be exercised by the archive navigation matrix");
  });
});
