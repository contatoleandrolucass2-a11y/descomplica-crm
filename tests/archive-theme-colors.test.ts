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

function declarations(file: string, selector: string) {
  const values: Record<string, string> = {};
  const css = readFileSync(
    new URL(
      `../app/(protected)/app/simulacao/_components/archive-investor/${file}`,
      import.meta.url,
    ),
    "utf8",
  );
  parse(css).walkRules((rule) => {
    if (rule.selector === selector)
      rule.walkDecls(({ prop, value }) => {
        values[prop] = value;
      });
  });
  expect(Object.keys(values).length, selector).toBeGreaterThan(0);
  return values;
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
  ...declarations("ArchiveHeader.module.css", ".header.header"),
  ...(theme === "light"
    ? {}
    : declarations(
        "ArchiveHeader.module.css",
        `:global(:root[data-theme="${theme}"]) .header.header`,
      )),
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
  it("preserves the original navy dark surfaces", () => {
    const colors = content("dark");
    expect(colors["--inv-color-page"]).toBe("#061f35");
    expect(colors["--inv-color-panel"]).toBe("#0a2b47");
    expect(colors["--inv-color-panel-strong"]).toBe("#0c3655");
    expect(header("dark")["--header-bg"]).toBe("#071a31");
  });

  for (const theme of ["light", "balanced", "dark"]) {
    it(`${theme}: uses blue accents, positive states and brand, without green theme tokens`, () => {
      const colors = content(theme);
      const navigation = header(theme);
      const brand = declarations("ArchiveHeader.module.css", ".header .brandMark");
      const corner = declarations("ArchiveHeader.module.css", ".header .brandMark > span");
      for (const hex of [
        colors["--inv-color-accent"],
        colors["--inv-color-success"],
        navigation["--header-accent"],
        brand.background,
        corner.background,
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
