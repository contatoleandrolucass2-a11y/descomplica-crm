import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import * as navigationQa from "../scripts/qa/archive-navigation.mjs";
import { ProtectedShellFrame } from "../app/(protected)/_components/ProtectedShellFrame";

const {
  archiveNavigationPassed,
  archiveNavigationRoutes,
  archiveNavigationViewports,
  archiveRootNavigationContract,
  parseArchivePreviewOrigin,
} = navigationQa as {
  archiveNavigationPassed: (result: unknown, options?: { scope: string }) => boolean;
  archiveNavigationRoutes: string[];
  archiveNavigationViewports: { width: number; height: number }[];
  archiveRootNavigationContract: { name: string; tag: string; href: string | null }[];
  parseArchivePreviewOrigin: (value: string) => string;
};

function completeResult() {
  return {
    contract: "archive-navigation-v1",
    shellContract: "unified-protected-shell-v1",
    scope: "header-and-content",
    checks: archiveNavigationRoutes.flatMap((route) =>
      archiveNavigationViewports.map(({ width }) => ({
        route,
        width,
        passed: true,
        singleProtectedTopbar: true,
        exactAuthorizedRootNavigation: true,
        exactAuthorizedAccountNavigation: true,
        mainSurfaceChanges: true,
        themes: { light: true, balanced: true, dark: true },
      })),
    ),
  };
}

describe("archive navigation evidence gate", () => {
  it("keeps the global topbar above the privacy shortcut but below the consent panel", () => {
    const header = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
      "utf8",
    );
    const privacy = readFileSync(
      new URL("../app/_components/CookieConsentBanner.module.css", import.meta.url),
      "utf8",
    );
    const headerLayer = Number(header.match(/\.topbar\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]);
    const shortcutLayer = Number(
      privacy.match(/\.preferencesButton\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1],
    );
    const panelLayer = Number(privacy.match(/\.banner\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]);
    expect(headerLayer).toBeGreaterThan(shortcutLayer);
    expect(headerLayer).toBeLessThan(panelLayer);
  });

  it("keeps every root keyboard ring inside the unified topbar", () => {
    const header = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
      "utf8",
    );
    const rule = header.match(
      /\.topbar \[data-navigation-root-control\]:focus-visible\s*\{([\s\S]*?)\}/u,
    )?.[1];

    expect(rule).toContain("outline: 2px solid var(--header-accent) !important");
    expect(rule).toContain("outline-offset: -2px !important");
  });

  it("renders one protected shell topbar on archive routes", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ProtectedShellFrame,
        {
          chrome: createElement("header", { "data-protected-topbar": true }, "Navegação"),
          shellClassName: "protected-shell",
        },
        createElement("main", null, "Conteúdo do simulador"),
      ),
    );

    expect(markup.match(/<header\b/g)).toHaveLength(1);
    expect(markup).toContain("data-protected-topbar");
    expect(markup).toContain("Conteúdo do simulador");
    expect(markup).toContain("data-protected-shell");
  });

  it("does not render a local ArchiveHeader or SiteMenu in any archive surface", () => {
    const sources = [
      "AssociativeTableArchive.tsx",
      "DirectTableArchive.tsx",
      "DocumentationArchive.tsx",
      "InvestorTableArchive.tsx",
      "TabelaoArchive.tsx",
      "SimulatorWorkspace.tsx",
    ].map((file) =>
      readFileSync(
        new URL(`../app/(protected)/app/simulacao/_components/${file}`, import.meta.url),
        "utf8",
      ),
    );

    for (const source of sources) {
      expect(source).not.toMatch(/ArchiveHeader|SiteMenu/);
      expect(source).not.toMatch(/<header\b/);
    }
  });

  it("binds the visual gate to the unified protected shell and its exact navigation contract", () => {
    const gate = readFileSync(
      new URL("../scripts/qa/archive-navigation.mjs", import.meta.url),
      "utf8",
    );
    const compact = readFileSync(
      new URL("../scripts/qa/associative-compact-layout.mjs", import.meta.url),
      "utf8",
    );

    expect(gate).toContain('shellContract: "unified-protected-shell-v1"');
    expect(gate).toContain("await ensureArchiveNavigationOpen(page);");
    expect(gate).toContain('"Metas de parcerias", "/app/configuracoes/metas/parcerias"');
    expect(gate).toContain("exactAuthorizedRootNavigation");
    expect(gate).toContain("exactAuthorizedAccountNavigation");
    expect(gate).not.toContain("checkCompactArchiveHeader");
    expect(compact).toContain("checkProtectedTopbar");
    expect(compact).toContain("titleContentInset");
    expect(compact).not.toContain("Title must sit close to the menu divider");
    expect(compact).toContain('"Virtual row height must match CSS"');
    expect(compact).toContain('"Entire hovered row must be gold with dark readable text"');
  });

  it("keeps the five authorized roots in the approved visual and keyboard order", () => {
    expect(archiveRootNavigationContract).toEqual([
      { name: "Dashboard", tag: "BUTTON", href: null },
      { name: "Simulação", tag: "BUTTON", href: null },
      { name: "Ranking", tag: "A", href: "/app/ranking" },
      { name: "Canal de Parcerias", tag: "A", href: "/app/canal-de-parcerias" },
      { name: "Configurações", tag: "BUTTON", href: null },
    ]);
  });

  it("uses real keyboard traversal and keeps failure diagnostics sanitized", () => {
    const gate = readFileSync(
      new URL("../scripts/qa/archive-navigation.mjs", import.meta.url),
      "utf8",
    );

    expect(gate).not.toContain("await simulation.focus();");
    expect(gate).toContain('await page.keyboard.press("Tab");');
    expect(gate).toContain("assertNavigationControlFocused");
    expect(gate).toContain(
      'button[data-navigation-root-control][aria-controls="authorized-navigation-crm-dashboard"]',
    );
    expect(gate).toContain('kind: "protected-topbar-geometry"');
    expect(gate).toContain("rootControlCount");
  });

  it("requires complete route/viewport/theme evidence independently of the historical manifest", () => {
    expect(archiveNavigationPassed(completeResult())).toBe(true);
    expect(archiveNavigationPassed(null)).toBe(false);
    expect(
      archiveNavigationPassed({
        contract: "archive-navigation-v1",
        shellContract: "unified-protected-shell-v1",
        checks: [],
      }),
    ).toBe(false);
  });

  it("rejects historical evidence that predates the unified protected-shell contract", () => {
    const historical = completeResult();
    delete (historical as { shellContract?: string }).shellContract;
    expect(archiveNavigationPassed(historical)).toBe(false);

    const missingRootAuthorization = completeResult();
    missingRootAuthorization.checks[0]!.exactAuthorizedRootNavigation = false;
    expect(archiveNavigationPassed(missingRootAuthorization)).toBe(false);

    const missingAccountAuthorization = completeResult();
    missingAccountAuthorization.checks[0]!.exactAuthorizedAccountNavigation = false;
    expect(archiveNavigationPassed(missingAccountAuthorization)).toBe(false);
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
