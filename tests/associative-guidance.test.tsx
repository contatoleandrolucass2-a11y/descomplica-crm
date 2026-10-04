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
  assertAssociativeLedgerRow,
  assertAssociativeKeyboardFocus,
  assertAssociativeRejectionPaint,
  assertAssociativeRejectionShimmer,
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
    const field = {
      label: "Financiamento",
      background: [0, 0, 0, 0],
      gradient: [],
      ledger: true,
      borderWidths: [0, 0, 0, 0],
      outlineWidth: 0,
      outlineStyle: "none",
      boxShadow: "none",
      compositionShadow: "none",
    };
    expect(() => assertAssociativeTransparentFields([field])).not.toThrow();
    expect(() => assertAssociativeTransparentFields([])).toThrow();
    expect(() =>
      assertAssociativeTransparentFields([{ ...field, background: [7, 26, 49, 255] }]),
    ).toThrow();
    expect(() => assertAssociativeTransparentFields([{ ...field, gradient: ["gold"] }])).toThrow();
    expect(() =>
      assertAssociativeTransparentFields([{ ...field, outlineWidth: 2.666 }]),
    ).not.toThrow();
    for (const state of [
      "empty",
      "filled",
      "focused",
      "filled-focused",
      "wrapper",
      "wrapper-focused",
    ]) {
      for (const patch of [
        { borderWidths: [0, 1, 0, 0] },
        { borderWidths: [] },
        { outlineWidth: 2, outlineStyle: "solid" },
        { boxShadow: "inset 0 0 0 2px gold" },
        { compositionShadow: "inset 0 0 0 1px cyan" },
      ]) {
        expect(() =>
          assertAssociativeTransparentFields([{ ...field, label: state, ...patch }]),
        ).toThrow();
        // Qualification inputs retain their previous focus contract.
        expect(() =>
          assertAssociativeTransparentFields([{ ...field, ...patch, ledger: false }]),
        ).not.toThrow();
      }
    }
  });

  it("keeps ledger rows on the theme surface without a fixed gold frame", () => {
    const gold = { width: 2, style: "solid", color: [159, 118, 40, 255] };
    const paint = {
      background: [0, 0, 0, 0],
      themeSurface: [10, 43, 71, 255],
      gradient: [],
      contained: true,
      boxShadow: "none",
      fixedBorders: [{ ...gold, width: 0 }],
      attentionBorder: Array.from({ length: 4 }, () => ({ width: 0 })),
    };
    expect(() => assertAssociativeLedgerRow(paint)).not.toThrow();
    expect(() =>
      assertAssociativeLedgerRow({
        ...paint,
        fixedBorders: [{ ...gold, color: [80, 85, 90, 255] }],
      }),
    ).not.toThrow();
    for (const patch of [
      { background: [185, 149, 69, 255] },
      { gradient: [[185, 149, 69, 255]] },
      { contained: false },
      { fixedBorders: [gold] },
      { boxShadow: "inset 0 0 0 2px gold" },
      { attentionBorder: [{ width: 2 }, { width: 0 }, { width: 0 }, { width: 0 }] },
      { attentionBorder: [] },
    ])
      expect(() => assertAssociativeLedgerRow({ ...paint, ...patch })).toThrow();
  });

  it("requires a visible bold label for keyboard focus without underline", () => {
    const focus = { focusVisible: true, decoration: "none", weight: 700, alpha: 255 };
    expect(() => assertAssociativeKeyboardFocus(focus)).not.toThrow();
    for (const patch of [
      { focusVisible: false },
      { decoration: "underline" },
      { weight: 400 },
      { weight: 600 },
      { alpha: 0 },
    ])
      expect(() => assertAssociativeKeyboardFocus({ ...focus, ...patch })).toThrow();
  });

  it("requires a full-area 3s translucent specular sweep only while current/required", () => {
    const animation = {
      name: "associative-pending-shine",
      duration: 3000,
      iterations: "infinite",
      playState: "running",
      visibleDuringCycle: true,
      fullArea: true,
      translucent: true,
      specularBand: true,
      behindText: true,
      pointerSafe: true,
      backgroundCount: 1,
      noRepeat: true,
      goldLine: true,
      moving: true,
    };
    const active = { active: true, reducedMotion: false, animations: [animation] };
    expect(() => assertAssociativeShimmer(active)).not.toThrow();
    expect(() => assertAssociativeShimmer({ ...active, animations: [] })).toThrow(/must shimmer/u);
    for (const patch of [
      { duration: 2600 },
      { duration: 4500 },
      { specularBand: false },
      { iterations: "2" },
      { playState: "paused" },
      { name: "border-pulse" },
      { visibleDuringCycle: false },
      { fullArea: false },
      { translucent: false },
      { behindText: false },
      { pointerSafe: false },
      { backgroundCount: 2 },
      { noRepeat: false },
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

  it("requires one moving translucent sweep behind the entire ledger row", () => {
    const animation = {
      name: "associative-pending-shine",
      duration: 3000,
      iterations: "infinite",
      playState: "running",
      visibleDuringCycle: true,
      fullArea: true,
      translucent: true,
      specularBand: true,
      behindText: true,
      pointerSafe: true,
      goldLine: true,
      moving: true,
      pseudo: "::after",
      fullRowExtent: true,
      backgroundCount: 1,
      noRepeat: true,
    };
    const active = { active: true, reducedMotion: false, ledger: true, animations: [animation] };
    expect(() => assertAssociativeShimmer(active)).not.toThrow();
    for (const patch of [
      { name: "associative-edge-shine" },
      { duration: 2900 },
      { iterations: "2" },
      { playState: "paused" },
      { pseudo: "::before" },
      { fullRowExtent: false },
      { backgroundCount: 2 },
      { backgroundCount: 3 },
      { fullArea: false },
      { translucent: false },
      { behindText: false },
      { pointerSafe: false },
      { noRepeat: false },
      { moving: false },
      { goldLine: false },
      { visibleDuringCycle: false },
    ])
      expect(() =>
        assertAssociativeShimmer({ ...active, animations: [{ ...animation, ...patch }] }),
      ).toThrow();
    expect(() =>
      assertAssociativeShimmer({ ...active, animations: [animation, animation] }),
    ).toThrow();
    expect(() => assertAssociativeShimmer({ ...active, animations: [] })).toThrow();
    for (const patch of [{ active: false }, { reducedMotion: true }]) {
      expect(() => assertAssociativeShimmer({ ...active, ...patch })).toThrow();
      expect(() => assertAssociativeShimmer({ ...active, ...patch, animations: [] })).not.toThrow();
    }
  });

  it("requires the same dark blood-red metallic gradient and white text for rejection surfaces", () => {
    const paint = {
      gradient: [
        [101, 12, 23, 255],
        [157, 24, 40, 255],
        [116, 16, 28, 255],
        [72, 8, 15, 255],
      ],
      foreground: [255, 255, 255, 255],
      textFill: [255, 255, 255, 255],
    };
    expect(() => assertAssociativeRejectionPaint(paint)).not.toThrow();
    for (let index = 0; index < paint.gradient.length; index += 1) {
      for (const color of [
        [255, 82, 100, 255],
        [185, 149, 69, 255],
        [101, 12, 23, 0],
      ]) {
        const gradient = paint.gradient.map((stop, i) => (i === index ? color : stop));
        expect(() => assertAssociativeRejectionPaint({ ...paint, gradient })).toThrow();
      }
    }
    for (const patch of [
      { gradient: [] },
      { gradient: paint.gradient.slice(0, 3) },
      { gradient: [...paint.gradient].reverse() },
      { foreground: [240, 240, 240, 255] },
      { textFill: [0, 0, 0, 0] },
    ])
      expect(() => assertAssociativeRejectionPaint({ ...paint, ...patch })).toThrow();
  });

  it("runs the red footer shimmer for 3s infinitely only while rejected without reduced motion", () => {
    const animation = {
      name: "associative-rejection-shine",
      pseudo: "::after",
      duration: 3000,
      iterations: "infinite",
      playState: "running",
      redLine: true,
      moving: true,
      visibleDuringCycle: true,
    };
    const rejected = { rejected: true, reducedMotion: false, animations: [animation] };
    expect(() => assertAssociativeRejectionShimmer(rejected)).not.toThrow();
    for (const patch of [
      { name: "associative-edge-shine" },
      { pseudo: "::before" },
      { duration: 2600 },
      { iterations: "1" },
      { playState: "paused" },
      { redLine: false },
      { moving: false },
      { visibleDuringCycle: false },
    ])
      expect(() =>
        assertAssociativeRejectionShimmer({
          ...rejected,
          animations: [{ ...animation, ...patch }],
        }),
      ).toThrow();
    for (const animations of [[], [animation, animation]])
      expect(() => assertAssociativeRejectionShimmer({ ...rejected, animations })).toThrow();
    for (const patch of [{ rejected: false }, { reducedMotion: true }]) {
      expect(() => assertAssociativeRejectionShimmer({ ...rejected, ...patch })).toThrow();
      expect(() =>
        assertAssociativeRejectionShimmer({ ...rejected, ...patch, animations: [] }),
      ).not.toThrow();
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

  it("keeps commission beside the last date inside the full-width summary panel", () => {
    const valid = {
      width: 44,
      height: 44,
      minimumTarget: 44,
      insideSummary: false,
      insideTable: false,
      insideCell: false,
      summarySibling: true,
      lastRowIsDecreasing10: true,
      layoutDisplay: "grid",
      columns: [500],
      layoutGap: 0,
      tableGap: 5,
      dateCenterDelta: 0,
      summaryFitsColumn: true,
      insideLayout: true,
      insideWidth: true,
      summaryEdgesAligned: true,
      rightDelta: 4,
      overlaps: false,
      iconOnly: true,
      iconSize: 17,
      borderless: true,
      transparent: true,
    };
    expect(() => assertAssociativeCommissionGeometry(valid)).not.toThrow();
    expect(() =>
      assertAssociativeCommissionGeometry({
        ...valid,
        minimumTarget: 24,
        width: 24,
        height: 24,
        columns: [500],
      }),
    ).not.toThrow();
    for (const patch of [
      { insideSummary: true },
      { insideTable: true },
      { insideCell: true },
      { summarySibling: false },
      { lastRowIsDecreasing10: false },
      { layoutDisplay: "flex" },
      { columns: [] },
      { columns: [500, 24] },
      { layoutGap: 3 },
      { layoutGap: 5 },
      { tableGap: 3 },
      { dateCenterDelta: 1.01 },
      { summaryFitsColumn: false },
      { insideLayout: false },
      { insideWidth: false },
      { summaryEdgesAligned: false },
      { rightDelta: 2.99 },
      { rightDelta: 5.01 },
      { overlaps: true },
      { iconOnly: false },
      { iconSize: 18 },
      { iconSize: 0 },
      { width: 43 },
      { height: 43 },
      { width: 45 },
      { minimumTarget: 18, width: 18, height: 18, columns: [500, 18] },
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

  it("hovers the enabled financing control while measuring its responsive active row", () => {
    const source = readFileSync(
      new URL("../scripts/qa/associative-guidance.mjs", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(
      /checkReducedGuidanceMotion\(\s*page,\s*page\.locator\(`\$\{root\} \$\{activeRow\}`\),\s*field\(label\),\s*\)/u,
    );
    expect(source).toContain("error.safeHoverDiagnostics");
    expect(source).toContain("hitWithinOwner");
  });
});
