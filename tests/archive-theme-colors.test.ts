import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
  parse: (css: string) => {
    walkRules: (
      callback: (rule: {
        selector: string;
        walkDecls: (callback: (declaration: { prop: string; value: string }) => void) => void;
      }) => void,
    ) => void;
  };
};

function declarationsAt(file: URL, selector: string) {
  const values: Record<string, string> = {};
  const css = readFileSync(file, "utf8");
  parse(css).walkRules((rule) => {
    if (rule.selector === selector)
      rule.walkDecls(({ prop, value }) => {
        values[prop] = value;
      });
  });
  expect(Object.keys(values).length, selector).toBeGreaterThan(0);
  return values;
}

function declarations(file: string, selector: string) {
  return declarationsAt(
    new URL(
      `../app/(protected)/app/simulacao/_components/archive-investor/${file}`,
      import.meta.url,
    ),
    selector,
  );
}

function shellDeclarations(selector: string) {
  return declarationsAt(
    new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
    selector,
  );
}

const content = (theme: string) => ({
  ...declarations("investor-theme-tokens.css", ".investor-page-shell"),
  ...(theme === "light"
    ? {}
    : declarations(
        "investor-theme-tokens.css",
        `:root[data-theme="${theme}"] .investor-page-shell`,
      )),
});
const header = (theme: string) => ({
  ...shellDeclarations(".topbar"),
  ...(theme === "light" ? {} : shellDeclarations(`:global(:root[data-theme="${theme}"]) .topbar`)),
});

function rgb(hex: string) {
  expect(hex).toMatch(/^#[\da-f]{6}$/i);
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex).map((v) =>
      v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("archive theme color contract", () => {
  it("uses the approved full horizontal wordmark in the accessible global home link", () => {
    const layout = readFileSync(new URL("../app/(protected)/layout.tsx", import.meta.url), "utf8");
    const mark = readFileSync(
      new URL("../app/(protected)/_components/DescomplicaBrandMark.tsx", import.meta.url),
      "utf8",
    );
    const lightWordmark = readFileSync(
      new URL("../public/brand/descomplica-wordmark-light.svg", import.meta.url),
      "utf8",
    );
    const darkWordmark = readFileSync(
      new URL("../public/brand/descomplica-wordmark-dark.svg", import.meta.url),
      "utf8",
    );

    expect(layout).toContain("href={navigationHome.path}");
    expect(layout).toContain('aria-label="Descomplica, início"');
    expect(layout).toContain("<DescomplicaBrandMark");
    expect(layout).not.toContain("brandName");
    expect(layout).toContain("data-protected-brand");
    expect(mark).toContain('src="/brand/descomplica-wordmark-light.svg"');
    expect(mark).toContain('src="/brand/descomplica-wordmark-dark.svg"');
    expect(mark).toContain('aria-hidden="true"');
    for (const wordmark of [lightWordmark, darkWordmark]) {
      expect(wordmark).toContain('viewBox="273 211 1671 285"');
      expect(wordmark).toContain('fill="#d41424"');
    }
    expect(lightWordmark).toContain('fill="#252e38"');
    expect(darkWordmark).toContain('fill="#ffffff"');
  });

  it("keeps the horizontal wordmark unframed at its approved aspect ratio", () => {
    const brand = shellDeclarations(".brandMark");
    expect(Number.parseFloat(brand.width!) / Number.parseFloat(brand.height!)).toBeGreaterThan(5);
    expect(brand["line-height"]).toBe("0");
    expect(
      Object.keys(brand).filter((property) =>
        /^(background|border|box-shadow|filter)$/.test(property),
      ),
    ).toEqual([]);
    const css = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
      "utf8",
    );
    parse(css).walkRules(({ selector }) => {
      expect(selector).not.toContain(".brandMark > span");
      expect(selector).not.toContain(".brandDot");
    });
  });

  it("preserves the original navy dark surfaces", () => {
    const colors = content("dark");
    expect(colors["--inv-color-page"]).toBe("#061f35");
    expect(colors["--inv-color-panel"]).toBe("#0a2b47");
    expect(colors["--inv-color-panel-strong"]).toBe("#0c3655");
    expect(header("dark")["--header-bg"]).toBe("#071a31");
  });

  it("inherits the Tabelao palette with only local decorative overrides", () => {
    const overrides = declarations(
      "investor-archive.css",
      ':root[data-theme="dark"] .investor-page-shell.investor-associative-table-page',
    );
    expect(overrides["--associative-money-ink"]).toBe("#e9bd54");
    expect(Object.keys(overrides).every((key) => key.startsWith("--associative-"))).toBe(true);
    const colors = {
      ...content("dark"),
      ...overrides,
    };
    expect(colors["--inv-color-page"]).toBe("#061f35");
    expect(colors["--inv-color-panel"]).toBe("#0a2b47");
    for (const background of ["page", "panel", "panel-muted", "panel-strong", "input"])
      for (const foreground of [
        "text",
        "muted",
        "accent",
        "alternate",
        "success",
        "danger",
        "warning",
      ])
        expect(
          contrast(colors[`--inv-color-${foreground}`]!, colors[`--inv-color-${background}`]!),
          `Associativo dark: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
  });

  it("uses a darker antique gold stock selection with readable text", () => {
    const colors = declarations(
      "investor-archive.css",
      ".investor-page-shell.investor-associative-table-page",
    );
    expect(colors["--associative-gold"]).toBe("#b99545");
    const stops = colors["--associative-gold-metal"]!.match(/#[\da-f]{6}/gi)!;
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const background of stops) {
      expect(rgb(background)[0]).toBeLessThanOrEqual(214 / 255);
      expect(contrast(colors["--associative-gold-ink"]!, background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const theme of ["light", "balanced", "dark"])
      expect(
        contrast(colors["--associative-gold-edge"]!, content(theme)["--inv-color-panel"]!),
      ).toBeGreaterThanOrEqual(3);
  });

  it("reuses stock gold for both profile selections without changing theme tokens", () => {
    const selection = declarations(
      "investor-archive.css",
      '.investor-page-shell.investor-associative-table-page .investor-associative-choice-row > :is(button[aria-pressed="true"], label:has(input:checked)):not(:disabled):not([aria-disabled="true"]):not(:has(input:disabled))',
    );
    expect(selection.color).toBe("var(--inv-color-text)");
    expect(selection.background).toBe(
      "var(--associative-pending-sheen), var(--associative-selection-metal)",
    );
    expect(selection["border-color"]).toBe("var(--associative-gold-edge)");
  });

  it("preserves text contrast under the pending sweep in every theme", () => {
    const colors = declarations(
      "investor-archive.css",
      ".investor-page-shell.investor-associative-table-page",
    );
    expect(colors["--associative-pending-sheen"]!.match(/[\d.]+%/gu)).toEqual([
      "46%",
      "48%",
      "49.6%",
      "50.4%",
      "52%",
      "54%",
    ]);
    expect(colors["--associative-sheen-core-strength"]).toBe("70%");
    for (const theme of ["light", "balanced", "dark"]) {
      const themeColors = content(theme);
      const effects = {
        ...colors,
        ...(theme === "dark"
          ? declarations(
              "investor-archive.css",
              ':root[data-theme="dark"] .investor-page-shell.investor-associative-table-page',
            )
          : {}),
      };
      for (const surface of ["page", "panel", "panel-muted", "panel-strong", "input"]) {
        for (const [colorToken, strengthToken] of [
          ["--associative-sheen-gold", "--associative-sheen-strength"],
          ["--associative-sheen-core", "--associative-sheen-core-strength"],
        ] as const) {
          const gold = rgb(effects[colorToken]!);
          const alpha = Number.parseFloat(effects[strengthToken]!) / 100;
          const mixed = rgb(themeColors[`--inv-color-${surface}`]!).map((channel, i) =>
            Math.round((channel * (1 - alpha) + gold[i]! * alpha) * 255),
          );
          // In dark mode the opaque glyph halo, verified in Chromium pixels, is the text backdrop.
          const background =
            theme === "dark"
              ? "#061f35"
              : `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
          if (theme === "dark")
            expect(effects["--associative-text-halo"]!.match(/#061f35/g)).toHaveLength(8);
          for (const foreground of ["text", "muted", "accent"])
            expect(
              contrast(themeColors[`--inv-color-${foreground}`]!, background),
              `${theme}: ${foreground} over pending ${surface}`,
            ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("keeps selected text readable across the gold-to-theme gradient and moving specular band", () => {
    const base = declarations(
      "investor-archive.css",
      ".investor-page-shell.investor-associative-table-page",
    );
    for (const theme of ["light", "balanced", "dark"]) {
      const palette = content(theme);
      const effects = {
        ...base,
        ...(theme === "dark"
          ? declarations(
              "investor-archive.css",
              ':root[data-theme="dark"] .investor-page-shell.investor-associative-table-page',
            )
          : {}),
      };
      for (let step = 0; step <= 20; step += 1) {
        const gold = rgb(effects["--associative-selection-gold"]!);
        const normal = rgb(palette["--inv-color-panel"]!);
        const surface = gold.map(
          (channel, i) => channel * (1 - step / 20) + (normal[i]! * step) / 20,
        );
        for (const [color, strength] of [
          ["--associative-sheen-core", "--associative-sheen-core-strength"],
          ["--associative-sheen-gold", "--associative-sheen-strength"],
          ["--associative-sheen-gold", "0"],
        ] as const) {
          const sheen = rgb(effects[color]!);
          const alpha = Number.parseFloat(effects[strength] ?? "0") / 100;
          const painted = `#${surface
            .map((channel, i) =>
              Math.round((channel * (1 - alpha) + sheen[i]! * alpha) * 255)
                .toString(16)
                .padStart(2, "0"),
            )
            .join("")}`;
          expect(effects["--associative-selection-gold"]).toBe("#b99545");
          expect(
            contrast(palette["--inv-color-text"]!, theme === "dark" ? "#061f35" : painted),
            `${theme}: selection ${step}, ${color}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("keeps the WF16 dark composition readable on its navy result surface", () => {
    const dark = declarations(
      "investor-archive.css",
      ':root[data-theme="dark"] .documentation-page-shell',
    );
    const surface = "#0f2d41";
    const selectors = [
      [".documentation-breakdown h3", "--doc-rank-text"],
      [".documentation-breakdown dd", "--doc-rank-text"],
      [".documentation-breakdown dt", "--doc-rank-muted"],
      [".documentation-breakdown-total dt", "--doc-rank-accent"],
      [".documentation-breakdown-total dd", "--doc-rank-text"],
    ] as const;

    for (const [suffix, token] of selectors) {
      const selector = `:root[data-theme="dark"] .documentation-page-shell ${suffix}`;
      expect(declarations("documentation-accessibility.css", selector).color).toBe(`var(${token})`);
      expect(contrast(dark[token]!, surface), selector).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      readFileSync(
        new URL(
          "../app/(protected)/app/simulacao/_components/archive-investor/documentation-accessibility.css",
          import.meta.url,
        ),
        "utf8",
      ),
    ).toContain("color: var(--doc-rank-text) !important");

    const visualHarness = readFileSync(
      new URL("../scripts/qa/documentation-calculator.mjs", import.meta.url),
      "utf8",
    );
    const darkColorWait = visualHarness.indexOf(
      "message: `Documentation must settle on the final dark contrast colors at ${width}px`",
    );
    expect(darkColorWait).toBeGreaterThan(-1);
    expect(visualHarness).toContain('if (theme === "dark")');
    expect(visualHarness).toContain(".poll(");
    expect(visualHarness).toContain('surface: "rgb(15, 45, 65)"');
    expect(visualHarness).toContain('heading: "rgb(244, 251, 255)"');
    expect(visualHarness).toContain('term: "rgb(180, 202, 216)"');
    expect(visualHarness).toContain('totalTerm: "rgb(34, 184, 197)"');
    expect(darkColorWait).toBeLessThan(visualHarness.indexOf("const accessibility ="));
    expect(visualHarness).not.toContain("document.styleSheets");
    expect(visualHarness).not.toContain("Documentation dark contrast contract:");
  });

  it("keeps blood-red metallic rejection readable even at the brightest sheen", () => {
    const colors = declarations(
      "investor-archive.css",
      ".investor-page-shell.investor-associative-table-page",
    );
    const stops = colors["--associative-rejected-metal"]!.match(/#[\da-f]{6}/gi)!;
    expect(stops).toEqual(["#650c17", "#9d1828", "#74101c", "#48080f"]);
    for (const stop of stops) {
      expect(contrast("#ffffff", stop)).toBeGreaterThanOrEqual(4.5);
      const sheen = rgb(stop).map((channel, i) =>
        Math.round((channel * 0.76 + [1, 82 / 255, 100 / 255][i]! * 0.24) * 255),
      );
      const mixed = `#${sheen.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
      expect(contrast("#ffffff", mixed)).toBeGreaterThanOrEqual(4.5);
    }
  });

  for (const theme of ["light", "balanced", "dark"]) {
    it(`${theme}: selects the approved wordmark variant`, () => {
      expect(header(theme)["--header-text"]).toBe(theme === "dark" ? "#f3fbff" : "#182a40");
      expect(shellDeclarations(".brand").color).toBe("var(--header-text)");
      expect(shellDeclarations(".brandMark [data-brand-wordmark-dark]").display).toBe("none");
      if (theme === "dark") {
        expect(
          shellDeclarations(
            ':global(:root[data-theme="dark"]) .brandMark [data-brand-wordmark-light]',
          ).display,
        ).toBe("none");
        expect(
          shellDeclarations(
            ':global(:root[data-theme="dark"]) .brandMark [data-brand-wordmark-dark]',
          ).display,
        ).toBe("block");
      }
    });

    it(`${theme}: uses blue accents and positive states, without green theme tokens`, () => {
      const colors = content(theme);
      const navigation = header(theme);
      for (const hex of [
        colors["--inv-color-accent"],
        colors["--inv-color-success"],
        navigation["--header-accent"],
      ]) {
        const [r, g, b] = rgb(hex!);
        expect(b!, hex).toBeGreaterThan(g!);
        expect(b!, hex).toBeGreaterThan(r!);
      }
      for (const hex of Object.values({ ...colors, ...navigation }).filter((value) =>
        /^#[\da-f]{6}$/i.test(value),
      )) {
        const [r, g, b] = rgb(hex);
        expect(g! > r! && g! > b!, hex).toBe(false);
      }
    });

    it(`${theme}: keeps text contrast at least 4.5:1 on all theme surfaces`, () => {
      const colors = content(theme);
      for (const foreground of [
        "text",
        "muted",
        "accent",
        "alternate",
        "success",
        "danger",
        "warning",
      ])
        for (const background of ["page", "panel", "panel-muted", "panel-strong", "input"])
          expect(
            contrast(colors[`--inv-color-${foreground}`]!, colors[`--inv-color-${background}`]!),
            `${theme}: ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
      const navigation = header(theme);
      for (const foreground of ["text", "muted", "accent"])
        for (const background of ["bg", "hover", "active", "selected"])
          expect(
            contrast(navigation[`--header-${foreground}`]!, navigation[`--header-${background}`]!),
            `${theme}: header ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
