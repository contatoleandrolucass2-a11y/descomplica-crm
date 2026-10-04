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
    const accountMenu = readFileSync(
      new URL("../app/(protected)/_components/AccountMenu.tsx", import.meta.url),
      "utf8",
    );
    const privacyStylesheet = readFileSync(
      new URL("../app/_components/CookieConsentBanner.module.css", import.meta.url),
      "utf8",
    );
    const investorStylesheet = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
        import.meta.url,
      ),
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
    expect(shellStylesheet).toMatch(
      /\.topbar :is\(a, button\):focus-visible \{[\s\S]*outline: 2px solid var\(--header-accent\)/,
    );
    expect(shellStylesheet).toMatch(/\.actions \{[\s\S]*min-width: 0/);
    expect(shellStylesheet).toMatch(/\.accountTrigger \{[\s\S]*width: 44px[\s\S]*height: 44px/);
    expect(shellStylesheet).toMatch(/\.accountAvatar \{[\s\S]*border-radius: 999px/);
    expect(shellStylesheet).toMatch(/\.accountTriggerIdentity \{[\s\S]*text-overflow: ellipsis/);
    expect(shellStylesheet).toMatch(
      /@media \(max-width: 1180px\) \{[\s\S]*\.accountTriggerIdentity \{[\s\S]*display: none/,
    );
    expect(accountMenu).toContain("getIdentityInitials(identity)");
    expect(accountMenu).toContain("<ChevronDown");
    expect(accountMenu).toContain("aria-label={`Conta de ${identity}`}");
    expect(shellStylesheet).toMatch(/\.accountProfile \{[\s\S]*overflow-wrap: anywhere/);
    expect(shellStylesheet).toContain("@media (max-width: 1180px)");
    expect(shellStylesheet).toMatch(
      /@media \(min-width: 1181px\) and \(max-width: 1500px\) \{[\s\S]*\.navigationLink,[\s\S]*\.navigationTrigger \{[\s\S]*padding-inline: 5px/,
    );
    expect(shellStylesheet).toMatch(
      /@media \(max-width: 1180px\) \{[\s\S]*\.topbarInner \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 44px auto 44px[\s\S]*\.navigationRoot \{[\s\S]*grid-column: 2[\s\S]*\.actions \{[\s\S]*grid-column: 4[\s\S]*\.themeSwitch \{[\s\S]*grid-column: 3/,
    );
    expect(shellStylesheet).toMatch(
      /@media \(max-width: 600px\) \{[\s\S]*\.topbarInner \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 44px[\s\S]*\.navigationRoot \{[\s\S]*grid-column: 2[\s\S]*grid-row: 1[\s\S]*\.actions \{[\s\S]*grid-column: 2[\s\S]*grid-row: 2[\s\S]*\.themeSwitch \{[\s\S]*grid-column: 1[\s\S]*grid-row: 2/,
    );
    expect(analyticsStylesheet).toMatch(
      /\.pageHeader :focus-visible,[\s\S]*outline-color: #7ceaf5/,
    );
    expect(privacyStylesheet).toMatch(
      /@media \(max-width: 520px\) \{[\s\S]*\.preferencesButton \{[\s\S]*position: static;[\s\S]*width: calc\(100% - 1rem\)/,
    );
    expect(investorStylesheet).toMatch(
      /\.investor-page-shell\.investor-associative-table-page \{[\s\S]*min-height: 0/,
    );
    expect(investorStylesheet).toMatch(
      /@media \(max-width:360px\) \{[\s\S]*\.documentation-values-panel \.documentation-money-field > \.documentation-money-heading \{[\s\S]*grid-template-columns:minmax\(0,1fr\)/,
    );
    expect(investorStylesheet).toMatch(
      /\.documentation-values-panel \.documentation-money-field > \.documentation-money-heading \.documentation-money-heading-meta small \{[\s\S]*overflow-wrap:anywhere;[\s\S]*white-space:normal/,
    );
  });
});
