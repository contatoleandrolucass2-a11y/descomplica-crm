import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isThemeMode, THEME_MODES } from "../lib/interface/theme";

describe("protected interface shell", () => {
  it("keeps the three migrated appearance modes", () => {
    expect(THEME_MODES.map((theme) => theme.key)).toEqual(["light", "balanced", "dark"]);
  });

  it("rejects persisted values outside the appearance catalog", () => {
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("medium")).toBe(false);
    expect(isThemeMode({ key: "dark" })).toBe(false);
  });

  it("defines semantic analytical tokens for all three themes and reduced motion", () => {
    const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const shellStylesheet = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
      "utf8",
    );
    const analyticsStylesheet = readFileSync(
      new URL("../app/(protected)/app/_components/analytics/analytics.module.css", import.meta.url),
      "utf8",
    );

    expect(stylesheet).toContain(":root {");
    expect(stylesheet).toContain(':root[data-theme="balanced"]');
    expect(stylesheet).toContain(':root[data-theme="dark"]');
    expect(stylesheet.match(/--analytics-navy:/g)).toHaveLength(2);
    expect(stylesheet.match(/--analytics-cyan:/g)).toHaveLength(2);
    expect(stylesheet.match(/--analytics-lime:/g)).toHaveLength(2);
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("transition-duration: 0.01ms !important");
    expect(stylesheet).toContain("animation-duration: 0.01ms !important");
    expect(stylesheet).toContain("--focus-ring: #006f85");
    expect(stylesheet).toContain("--focus-ring: #7ceaf5");
    expect(stylesheet).toContain("outline: 3px solid var(--focus-ring)");
    expect(shellStylesheet).toMatch(/\.topbar :focus-visible \{\s*outline-color: #7ceaf5/);
    expect(analyticsStylesheet).toMatch(
      /\.pageHeader :focus-visible,[\s\S]*outline-color: #7ceaf5/,
    );
  });
});
