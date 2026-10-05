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
  parse(readFileSync(file, "utf8")).walkRules((rule) => {
    if (rule.selector === selector)
      rule.walkDecls(({ prop, value }) => {
        values[prop] = value;
      });
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
      expect(stylesheet).toContain("var(--analytics-cyan)");
    }
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
