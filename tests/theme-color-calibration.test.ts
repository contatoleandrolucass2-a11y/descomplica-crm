import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type CssRule = {
  selector: string;
  walkDecls: (callback: (declaration: { prop: string; value: string }) => void) => void;
};
const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
  parse: (css: string) => {
    walkRules: (callback: (rule: CssRule) => void) => void;
    walkAtRules: (
      name: string,
      callback: (rule: {
        params: string;
        walkRules: (callback: (rule: CssRule) => void) => void;
      }) => void,
    ) => void;
  };
};

function declarationsAt(file: URL, selector: string) {
  const values: Record<string, string> = {};
  parse(readFileSync(file, "utf8")).walkRules((rule) => {
    if (rule.selector === selector)
      rule.walkDecls(({ prop, value }) => {
        values[prop] = value;
      });
  });
  expect(Object.keys(values).length, selector).toBeGreaterThan(0);
  return values;
}

function declarationsIncluding(file: URL, selector: string) {
  const values: Record<string, string> = {};
  parse(readFileSync(file, "utf8")).walkRules((rule) => {
    if (
      rule.selector
        .split(",")
        .map((candidate) => candidate.trim())
        .includes(selector)
    ) {
      rule.walkDecls(({ prop, value }) => {
        values[prop] = value;
      });
    }
  });
  expect(Object.keys(values).length, selector).toBeGreaterThan(0);
  return values;
}

function rgb(hex: string) {
  expect(hex).toMatch(/^#[\da-f]{6}$/i);
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

const globals = new URL("../app/globals.css", import.meta.url);
const shell = new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url);
const ranking = new URL("../app/(protected)/app/ranking/RankingCanvas.module.css", import.meta.url);
const partnerships = new URL(
  "../app/(protected)/app/canal-de-parcerias/PartnershipsCanvas.module.css",
  import.meta.url,
);

const globalTheme = (theme: "light" | "balanced" | "dark") => ({
  ...declarationsAt(globals, ":root"),
  ...(theme === "light" ? {} : declarationsAt(globals, `:root[data-theme="${theme}"]`)),
});

const shellTheme = (theme: "light" | "balanced" | "dark") => ({
  ...declarationsAt(shell, ".topbar"),
  ...(theme === "light"
    ? {}
    : declarationsAt(shell, `:global(:root[data-theme="${theme}"]) .topbar`)),
});

describe("three-theme color calibration", () => {
  it("makes Claro, Médio and Escuro perceptibly different without changing the approved navy", () => {
    const light = globalTheme("light");
    const balanced = globalTheme("balanced");
    const dark = globalTheme("dark");

    expect(light["--analytics-page"]).toBe("#f3f6fa");
    expect(balanced["--analytics-page"]).toBe("#d9e1eb");
    expect(dark["--analytics-page"]).toBe("#061f35");
    expect(shellTheme("dark")["--header-bg"]).toBe("#071a31");

    expect(luminance(light["--analytics-page"]!)).toBeGreaterThan(
      luminance(balanced["--analytics-page"]!),
    );
    expect(luminance(balanced["--analytics-page"]!)).toBeGreaterThan(
      luminance(dark["--analytics-page"]!),
    );
  });

  for (const theme of ["light", "balanced", "dark"] as const) {
    it(`${theme}: keeps text, states and navigation readable on every calibrated surface`, () => {
      const colors = globalTheme(theme);
      const foregrounds = [
        "--analytics-ink",
        "--analytics-muted",
        "--analytics-cyan-strong",
        "--analytics-positive-ink",
        "--analytics-warning-ink",
        "--analytics-danger-ink",
      ];
      const backgrounds = [
        "--analytics-page",
        "--analytics-surface",
        "--analytics-surface-muted",
        "--analytics-surface-strong",
      ];

      for (const foreground of foregrounds)
        for (const background of backgrounds)
          expect(
            contrast(colors[foreground]!, colors[background]!),
            `${theme}: ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);

      const header = shellTheme(theme);
      for (const foreground of ["--header-text", "--header-muted", "--header-accent"])
        for (const background of [
          "--header-bg",
          "--header-hover",
          "--header-active",
          "--header-selected",
        ])
          expect(
            contrast(header[foreground]!, header[background]!),
            `${theme}: ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: uses blue for highlights while keeping warning and danger distinct`, () => {
      const colors = globalTheme(theme);
      for (const token of [
        "--analytics-cyan",
        "--analytics-cyan-strong",
        "--analytics-lime",
        "--analytics-positive",
      ]) {
        const [red, green, blue] = rgb(colors[token]!);
        expect(blue!, `${theme}: ${token}`).toBeGreaterThan(green!);
        expect(blue!, `${theme}: ${token}`).toBeGreaterThan(red!);
      }
      expect(colors["--analytics-warning"]).not.toBe(colors["--analytics-positive"]);
      expect(colors["--analytics-danger"]).not.toBe(colors["--analytics-positive"]);
    });
  }

  it("lets Ranking, Canal and Configurações inherit the global theme instead of forcing dark mode", () => {
    for (const path of [
      "../app/(protected)/app/ranking/RankingCanvas.module.css",
      "../app/(protected)/app/canal-de-parcerias/PartnershipsCanvas.module.css",
      "../app/(protected)/app/configuracoes/ConfigurationCanvas.module.css",
    ]) {
      const stylesheet = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(stylesheet).not.toMatch(/^\s*--analytics-/m);
      expect(stylesheet).not.toContain("color-scheme: dark");
      expect(stylesheet).toContain("var(--analytics-page)");
      expect(stylesheet).toContain(
        path.includes("/ranking/") ? "var(--analytics-cyan-strong)" : "var(--analytics-cyan)",
      );
    }
  });

  it("preserves the existing Canal surfaces in Claro and Médio", () => {
    for (const stylesheet of [partnerships]) {
      expect(declarationsAt(stylesheet, '.canvas article[data-tone="navy"]')).toMatchObject({
        "border-color": "var(--analytics-line)",
        background: "var(--analytics-navy)",
      });
      for (const theme of ["light", "balanced"]) {
        expect(
          declarationsIncluding(
            stylesheet,
            `:global(:root[data-theme="${theme}"]) .canvas article[data-tone="navy"]`,
          ),
        ).toMatchObject({
          "border-color": "var(--analytics-line)",
          color: "var(--analytics-ink)",
        });
      }
    }

    for (const theme of ["light", "balanced"]) {
      expect(
        declarationsIncluding(
          partnerships,
          `:global(:root[data-theme="${theme}"]) .canvas article[data-tone="navy"]`,
        ).background,
      ).toBe("var(--analytics-surface-strong)");
      expect(
        declarationsIncluding(
          partnerships,
          `:global(:root[data-theme="${theme}"]) .canvas .featuredPodium`,
        ),
      ).toMatchObject({
        "border-color": "var(--analytics-cyan-strong)",
        "box-shadow": "inset 0 3px 0 var(--analytics-cyan-strong)",
      });
    }
  });

  it("keeps partnership ranking surfaces and controls on accessible semantic tokens", () => {
    expect(declarationsAt(ranking, ".canvas")).toMatchObject({
      background: "var(--analytics-page)",
      color: "var(--analytics-ink)",
      "min-width": "0",
    });
    expect(declarationsAt(ranking, ".canvas .podiumEntry")).toMatchObject({
      "border-color": "var(--analytics-line)",
      background: "var(--analytics-surface)",
      color: "var(--analytics-ink)",
      "border-radius": "0.5rem",
      "box-shadow": "none",
    });
    expect(declarationsAt(ranking, ".canvas :is(input, select, button)")).toMatchObject({
      border: "1px solid var(--analytics-line)",
      background: "var(--analytics-surface-muted)",
      color: "var(--analytics-muted)",
      "min-height": "2.75rem",
      "max-width": "100%",
    });
    expect(declarationsAt(ranking, ".canvas :disabled").opacity).toBe("1");
    expect(declarationsAt(ranking, ".canvas :focus-visible")).toMatchObject({
      outline: "2px solid var(--analytics-cyan-strong)",
      "outline-offset": "3px",
    });
    expect(declarationsAt(ranking, ".quarters label")).toMatchObject({
      "min-height": "2.75rem",
      color: "var(--analytics-muted)",
    });
    expect(declarationsAt(ranking, '.quarters input[type="checkbox"]')).toMatchObject({
      appearance: "auto",
      width: "1.125rem",
      height: "1.125rem",
      "min-height": "1.125rem",
    });
    for (const theme of ["light", "balanced", "dark"] as const) {
      const colors = globalTheme(theme);
      expect(
        contrast(colors["--analytics-ink"]!, colors["--analytics-surface"]!),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colors["--analytics-muted"]!, colors["--analytics-surface-muted"]!),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colors["--analytics-cyan-strong"]!, colors["--analytics-page"]!),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps ranking grids responsive and controls wrapping without clipping text", () => {
    const css = readFileSync(ranking, "utf8");
    const mobile: Record<string, Record<string, string>> = {};
    parse(css).walkAtRules("media", (media) => {
      if (media.params !== "(max-width: 47.99rem)") return;
      media.walkRules((rule) => {
        for (const selector of rule.selector.split(",").map((value) => value.trim())) {
          rule.walkDecls(({ prop, value }) => {
            (mobile[selector] ??= {})[prop] = value;
          });
        }
      });
    });
    for (const selector of [".monthInputs", ".podiumGrid", ".sourceMeta", ".summary"]) {
      expect(mobile[selector]?.["grid-template-columns"], selector).toBe("minmax(0, 1fr)");
    }
    expect(declarationsIncluding(ranking, ".quarters")["flex-wrap"]).toBe("wrap");
    expect(
      declarationsAt(ranking, ".canvas :is(h1, h2, h3, p, dt, dd, label)")["overflow-wrap"],
    ).toBe("anywhere");
    expect(declarationsAt(ranking, ".search")["max-width"]).toBe("100%");
  });

  it("keeps the documentation canvas header on the accessible global foreground tokens", () => {
    const stylesheet = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(stylesheet).toMatch(
      /\.documentation-page-shell\[data-canvas-layout="documentation"\] > \.simulation-canvas-header \{[\s\S]*--canvas-text: var\(--analytics-ink\);[\s\S]*--canvas-muted: var\(--analytics-muted\);/,
    );
  });
});
