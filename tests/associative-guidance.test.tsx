import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertAssociativeMoneySpacing,
  assertAssociativeCommissionGeometry,
  assertAssociativeQuantityGeometry,
  assertAssociativeShimmer,
  assertAssociativeSummaryGaps,
  assertAssociativeWorkspaceGaps,
  hasGuidanceGoldBorder,
  hasGuidanceThemeSurface,
  assertAssociativeTransparentFields,
  isGuidanceGoldText,
} from "../scripts/qa/associative-guidance.mjs";

describe("Associativo guidance regression gates", () => {
  it("matches the 22-28px central gap to equal flow padding on desktop", () => {
    const valid = { sideBySide: true, gap: 28, paddingLeft: 28, paddingRight: 28 };
    expect(() => assertAssociativeWorkspaceGaps(valid)).not.toThrow();
    expect(() =>
      assertAssociativeWorkspaceGaps({
        sideBySide: false,
        gap: -300,
        paddingLeft: 12,
        paddingRight: 12,
      }),
    ).not.toThrow();
    for (const patch of [{ gap: 21 }, { gap: 29 }, { paddingLeft: 25 }, { paddingRight: 25 }]) {
      expect(() => assertAssociativeWorkspaceGaps({ ...valid, ...patch })).toThrow();
    }
  });
  it("requires a gold border and rejects silver, blue, green and transparent edges", () => {
    const gold = [159, 118, 40, 255];
    expect(hasGuidanceGoldBorder({ borders: [gold], attentionBorder: [] })).toBe(true);
    expect(hasGuidanceGoldBorder({ borders: [], attentionBorder: [{ color: gold }] })).toBe(true);
    for (const color of [
      [205, 213, 224, 255],
      [102, 228, 236, 255],
      [25, 180, 100, 255],
      [80, 85, 90, 255],
      [233, 189, 84, 0],
    ]) {
      expect(hasGuidanceGoldBorder({ borders: [color], attentionBorder: [] })).toBe(false);
    }
  });

  it("keeps the theme surface and rejects gold or darker input fills", () => {
    const theme = [10, 43, 71, 255];
    const paint = { background: theme, themeSurface: theme, gradient: [] };
    expect(hasGuidanceThemeSurface(paint)).toBe(true);
    expect(hasGuidanceThemeSurface({ ...paint, background: [0, 0, 0, 0] })).toBe(true);
    for (const background of [
      [185, 149, 69, 255],
      [7, 26, 49, 255],
    ])
      expect(hasGuidanceThemeSurface({ ...paint, background })).toBe(false);
    expect(hasGuidanceThemeSurface({ ...paint, gradient: [[185, 149, 69, 255]] })).toBe(false);
    const field = { label: "Financiamento", background: [0, 0, 0, 0], gradient: [] };
    expect(() => assertAssociativeTransparentFields([field])).not.toThrow();
    expect(() => assertAssociativeTransparentFields([])).toThrow();
    expect(() =>
      assertAssociativeTransparentFields([{ ...field, background: [7, 26, 49, 255] }]),
    ).toThrow();
    expect(() => assertAssociativeTransparentFields([{ ...field, gradient: ["gold"] }])).toThrow();
  });

  it("requires exactly 3s infinite shimmer only while current/required", () => {
    const animation = {
      name: "associative-edge-shine",
      duration: 3000,
      iterations: "infinite",
      playState: "running",
      visibleDuringCycle: true,
      edgeHeight: 2,
      goldLine: true,
      moving: true,
    };
    const active = { active: true, reducedMotion: false, animations: [animation] };
    expect(() => assertAssociativeShimmer(active)).not.toThrow();
    expect(() => assertAssociativeShimmer({ ...active, animations: [] })).toThrow(/must shimmer/u);
    for (const patch of [
      { duration: 2600 },
      { iterations: "2" },
      { playState: "paused" },
      { name: "border-pulse" },
      { visibleDuringCycle: false },
      { edgeHeight: 25 },
      { goldLine: false },
      { moving: false },
    ]) {
      expect(() =>
        assertAssociativeShimmer({ ...active, animations: [{ ...animation, ...patch }] }),
      ).toThrow();
    }
    for (const patch of [{ active: false }, { reducedMotion: true }]) {
      expect(() => assertAssociativeShimmer({ ...active, ...patch })).toThrow(/must not shimmer/u);
      expect(() => assertAssociativeShimmer({ ...active, ...patch, animations: [] })).not.toThrow();
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

  it("keeps the commission gold and rejects a blue clipped glyph despite computed color", () => {
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
    expect(isGuidanceGoldText({ ...paint, textFill: [205, 213, 224, 255] })).toBe(false);
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
    const rules = {
      linearBottomRule: { width: 1, style: "solid", alpha: 255 },
      decreasingTopRule: { width: 1, style: "solid", alpha: 255 },
    };
    expect(() =>
      assertAssociativeSummaryGaps({ ...rules, separation: 8, decreasingGaps: [0, 0, 0] }),
    ).not.toThrow();
    for (const separation of [0, 3, 13]) {
      expect(() =>
        assertAssociativeSummaryGaps({ ...rules, separation, decreasingGaps: [0, 0, 0] }),
      ).toThrow(/4-12px/u);
    }
    expect(() =>
      assertAssociativeSummaryGaps({ ...rules, separation: 8, decreasingGaps: [0, 8, 0] }),
    ).toThrow(/together/u);
    expect(() =>
      assertAssociativeSummaryGaps({ ...rules, separation: 8, decreasingGaps: [0, 0] }),
    ).toThrow(/four/u);
    for (const name of ["linearBottomRule", "decreasingTopRule"]) {
      for (const rule of [
        { width: 0, style: "solid", alpha: 255 },
        { width: 1, style: "none", alpha: 255 },
        { width: 1, style: "solid", alpha: 0 },
      ]) {
        expect(() =>
          assertAssociativeSummaryGaps({
            ...rules,
            [name]: rule,
            separation: 8,
            decreasingGaps: [0, 0, 0],
          }),
        ).toThrow(/separating rule/u);
      }
    }
  });

  it("keeps the 18px commission icon beside the last date with a 44px coarse target", () => {
    const valid = {
      width: 44,
      height: 44,
      minimumTarget: 44,
      insideSummary: true,
      insideLastRow: true,
      insideWidth: true,
      dateGap: 6,
      centerDelta: 0,
      overlaps: false,
      iconOnly: true,
      iconSize: 18,
      borderless: true,
      transparent: true,
    };
    expect(() => assertAssociativeCommissionGeometry(valid)).not.toThrow();
    expect(() =>
      assertAssociativeCommissionGeometry({ ...valid, minimumTarget: 18, width: 18, height: 18 }),
    ).not.toThrow();
    for (const patch of [
      { insideSummary: false },
      { insideLastRow: false },
      { insideWidth: false },
      { dateGap: -1 },
      { dateGap: 17 },
      { centerDelta: 3 },
      { overlaps: true },
      { iconOnly: false },
      { iconSize: 24 },
      { width: 43 },
      { height: 43 },
      { borderless: false },
      { transparent: false },
    ]) {
      expect(() => assertAssociativeCommissionGeometry({ ...valid, ...patch })).toThrow();
    }
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
