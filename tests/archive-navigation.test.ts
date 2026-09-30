import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import * as navigationQa from "../scripts/qa/archive-navigation.mjs";

const {
  archiveNavigationPassed,
  archiveNavigationRoutes,
  archiveNavigationViewports,
  parseArchivePreviewOrigin,
} = navigationQa as {
  archiveNavigationPassed: (result: unknown, options?: { scope: string }) => boolean;
  archiveNavigationRoutes: string[];
  archiveNavigationViewports: { width: number; height: number }[];
  parseArchivePreviewOrigin: (value: string) => string;
};

function completeResult() {
  return {
    contract: "archive-navigation-v1",
    scope: "header-and-content",
    checks: archiveNavigationRoutes.flatMap((route) =>
      archiveNavigationViewports.map(({ width }) => ({
        route,
        width,
        passed: true,
        mainSurfaceChanges: true,
        themes: { light: true, balanced: true, dark: true },
      })),
    ),
  };
}

describe("archive navigation evidence gate", () => {
  it("keeps navigation above the privacy shortcut but below the consent panel", () => {
    const header = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/ArchiveHeader.module.css",
        import.meta.url,
      ),
      "utf8",
    );
    const privacy = readFileSync(
      new URL("../app/_components/CookieConsentBanner.module.css", import.meta.url),
      "utf8",
    );
    const headerLayer = Number(header.match(/\.header\.header\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]);
    const shortcutLayer = Number(
      privacy.match(/\.preferencesButton\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1],
    );
    const panelLayer = Number(privacy.match(/\.banner\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]);
    expect(headerLayer).toBeGreaterThan(shortcutLayer);
    expect(headerLayer).toBeLessThan(panelLayer);
  });
  it("requires complete route/viewport/theme evidence independently of the historical manifest", () => {
    expect(archiveNavigationPassed(completeResult())).toBe(true);
    expect(archiveNavigationPassed(null)).toBe(false);
    expect(archiveNavigationPassed({ contract: "archive-navigation-v1", checks: [] })).toBe(false);
  });

  it("rejects omitted and duplicated breakpoint evidence even if all recorded checks passed", () => {
    const missing = completeResult();
    missing.checks = missing.checks.filter(({ width }) => width !== 1180);
    expect(archiveNavigationPassed(missing)).toBe(false);
    const duplicate = completeResult();
    duplicate.checks[1] = duplicate.checks[0]!;
    expect(archiveNavigationPassed(duplicate)).toBe(false);
  });

  it("rejects a failing interaction or a missing theme", () => {
    const failing = completeResult();
    failing.checks[0]!.passed = false;
    expect(archiveNavigationPassed(failing)).toBe(false);
    const missingTheme = completeResult();
    missingTheme.checks[0]!.themes.balanced = false;
    expect(archiveNavigationPassed(missingTheme)).toBe(false);
    const unchangedSurface = completeResult();
    unchangedSurface.checks[0]!.mainSurfaceChanges = false;
    expect(archiveNavigationPassed(unchangedSurface)).toBe(false);
  });

  it("does not accept header-only preview evidence as a complete CI gate", () => {
    const partial = { ...completeResult(), scope: "header-only" };
    expect(archiveNavigationPassed(partial, { scope: "header-only" })).toBe(true);
    expect(archiveNavigationPassed(partial)).toBe(false);
  });
});

describe("archive preview isolation", () => {
  it("accepts only an unprivileged HTTP loopback origin", () => {
    expect(parseArchivePreviewOrigin("http://127.0.0.1:61487")).toBe("http://127.0.0.1:61487");
    for (const origin of [
      "https://crm.descomplicapro.com.br",
      "http://example.com:61487",
      "http://127.0.0.1",
      "http://127.0.0.1:80",
      "http://user:secret@127.0.0.1:61487",
      "http://127.0.0.1:61487/app",
      "http://127.0.0.1:61487?remote=true",
    ])
      expect(() => parseArchivePreviewOrigin(origin)).toThrow();
  });
});
