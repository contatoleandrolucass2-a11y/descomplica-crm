import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => createElement("img", props),
}));
vi.mock("../app/(protected)/app/simulacao/_components/archive-investor/SiteMenu", () => ({
  SiteMenu: () => null,
}));

import { ArchiveHeader } from "../app/(protected)/app/simulacao/_components/archive-investor/ArchiveHeader";

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
  it("uses the supplied symbol as the first letter of the accessible home link", async () => {
    const markup = renderToStaticMarkup(await ArchiveHeader());
    const brand = markup.match(/<a\b[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    const symbol = brand.match(/<img\b[^>]*>/)?.[0] ?? "";

    expect(brand).toContain('href="/app"');
    expect(brand).toContain('aria-label="Descomplica, início"');
    expect(brand.replace(/<[^>]*>/g, "").trim()).toBe("escomplica");
    expect(brand.match(/<img\b/g)).toHaveLength(1);
    expect(brand).toMatch(/<img\b[^>]*\/>\s*<span\b[^>]*>escomplica<\/span>/);
    expect(symbol).toContain('src="/descomplica-symbol.png"');
    expect(symbol).toContain('alt=""');
    expect(symbol).toContain('aria-hidden="true"');
    expect(existsSync(new URL("../public/descomplica-symbol.png", import.meta.url))).toBe(true);
  });

  it("keeps the symbol unframed and contained instead of restoring the blue badge", () => {
    const brand = declarations("ArchiveHeader.module.css", ".header .brandMark");
    expect(brand["object-fit"]).toBe("contain");
    expect(brand.width).toBe(brand.height);
    expect(brand.filter).toBe("var(--header-brand-shadow)");
    expect(
      Object.keys(brand).filter((property) => /^(background|border|box-shadow)/.test(property)),
    ).toEqual([]);
    const css = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/ArchiveHeader.module.css",
        import.meta.url,
      ),
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

  it("uses near-black navy only for Associativo dark surfaces with readable text", () => {
    const colors = {
      ...content("dark"),
      ...declarations(
        "investor-archive.css",
        ':root[data-theme="dark"] .investor-page-shell.investor-associative-table-page',
      ),
    };
    expect(colors["--inv-color-page"]).toBe("#040d19");
    expect(colors["--inv-color-panel"]).toBe("#091a2c");
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

  it("keeps metallic gold and its darkest stop readable for all guidance states", () => {
    const colors = declarations(
      "investor-archive.css",
      ".investor-page-shell.investor-associative-table-page",
    );
    expect(colors["--associative-gold"]).toBe("#e9bd54");
    const stops = colors["--associative-gold-metal"]!.match(/#[\da-f]{6}/gi)!;
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const background of [...stops, colors["--associative-gold-input"]!])
      expect(contrast(colors["--associative-gold-ink"]!, background)).toBeGreaterThanOrEqual(4.5);
  });

  for (const theme of ["light", "balanced", "dark"]) {
    it(`${theme}: preserves the white symbol contrast treatment without recoloring it`, () => {
      expect(header(theme)["--header-brand-shadow"]).toBe(
        theme === "dark" ? "none" : "drop-shadow(0 0 0.75px #242b3299)",
      );
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
