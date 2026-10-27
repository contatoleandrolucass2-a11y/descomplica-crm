import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import * as navigationQa from "../scripts/qa/archive-navigation.mjs";
import { ProtectedShellFrame } from "../app/(protected)/_components/ProtectedShellFrame";
import {
  buildNavigationGroups,
  getPrimaryNavigation,
  type NavigationItem,
} from "../lib/navigation/presentation";

const {
  archiveMenuPanelPassed,
  archiveNavigationHorizontalFit,
  archiveNavigationPassed,
  archiveNavigationRoutes,
  archiveNavigationViewports,
  archiveRootNavigationContract,
  archiveManagementNavigationContract,
  parseArchivePreviewOrigin,
} = navigationQa as {
  archiveMenuPanelPassed: (measurement: unknown) => boolean;
  archiveNavigationHorizontalFit: (measurement: unknown) => boolean;
  archiveNavigationPassed: (result: unknown, options?: { scope: string }) => boolean;
  archiveNavigationRoutes: string[];
  archiveNavigationViewports: { width: number; height: number }[];
  archiveRootNavigationContract: { name: string; tag: string; href: string | null }[];
  archiveManagementNavigationContract: string[][];
  parseArchivePreviewOrigin: (value: string) => string;
};

function completeMenuPanelMeasurement(compact: boolean) {
  return {
    compact,
    common: {
      visible: true,
      expanded: true,
      controlPresent: true,
      panelHasSize: true,
      panelInsideViewportHorizontally: true,
      controlInsideViewportHorizontally: true,
      navigationHasNoHorizontalOverflow: true,
      documentHasNoHorizontalOverflow: true,
      bodyHasNoHorizontalOverflow: true,
      horizontalAncestorsFit: true,
    },
    desktop: {
      panelInsideViewportVertically: true,
      controlInsideViewportVertically: true,
      panelHasNoHorizontalOverflow: true,
      panelHasNoVerticalOverflow: true,
      verticalAncestorsFit: true,
    },
    compactDrawer: {
      verticalScrollAncestorCount: 1,
      panelEdges: { topReachable: true, bottomReachable: true },
      items: [
        {
          horizontallyContained: true,
          noOwnHorizontalOverflow: true,
          verticallyReachable: true,
          pageScrollStable: true,
          scrollContainerUsedWhenNeeded: true,
        },
      ],
    },
  };
}

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

function desktopNavigationMeasurement() {
  return {
    compact: false,
    viewportWidth: 1181,
    navigation: { left: 186, right: 840, scrollWidth: 668, clientWidth: 654 },
    rootControls: [{ left: 539, right: 607, scrollWidth: 66, clientWidth: 66 }],
    panels: [
      {
        left: 539,
        right: 854,
        scrollWidth: 315,
        clientWidth: 315,
        horizontalAncestorsFit: true,
      },
    ],
  };
}

describe("archive navigation evidence gate", () => {
  it("accepts the 1181px desktop disclosure extending beyond its nav track inside the viewport", () => {
    expect(archiveNavigationHorizontalFit(desktopNavigationMeasurement())).toBe(true);
  });

  it("rejects root overflow and unexplained nav overflow even with a fitting desktop disclosure", () => {
    const measurement = desktopNavigationMeasurement();
    const control = measurement.rootControls[0]!;
    expect(
      archiveNavigationHorizontalFit({
        ...measurement,
        rootControls: [{ ...control, right: measurement.navigation.right + 2 }],
      }),
    ).toBe(false);
    expect(
      archiveNavigationHorizontalFit({
        ...measurement,
        rootControls: [{ ...control, scrollWidth: control.clientWidth + 2 }],
      }),
    ).toBe(false);
    expect(
      archiveNavigationHorizontalFit({
        ...measurement,
        navigation: { ...measurement.navigation, scrollWidth: 670 },
      }),
    ).toBe(false);
    expect(archiveNavigationHorizontalFit({ ...measurement, panels: [] })).toBe(false);
  });

  it("rejects desktop disclosure viewport overflow, truncated text and clipping ancestors", () => {
    const measurement = desktopNavigationMeasurement();
    const panel = measurement.panels[0]!;
    for (const invalidPanel of [
      { ...panel, right: measurement.viewportWidth + 2 },
      { ...panel, scrollWidth: panel.clientWidth + 2 },
      { ...panel, horizontalAncestorsFit: false },
    ]) {
      expect(archiveNavigationHorizontalFit({ ...measurement, panels: [invalidPanel] })).toBe(
        false,
      );
    }
  });

  it("keeps compact navigation constrained to its scroll container", () => {
    expect(
      archiveNavigationHorizontalFit({ ...desktopNavigationMeasurement(), compact: true }),
    ).toBe(false);
    const compact = {
      compact: true,
      viewportWidth: 375,
      navigation: { left: 0, right: 375, scrollWidth: 375, clientWidth: 375 },
      rootControls: [{ left: 20, right: 355, scrollWidth: 335, clientWidth: 335 }],
      panels: [
        {
          left: 20,
          right: 355,
          scrollWidth: 335,
          clientWidth: 333,
          horizontalAncestorsFit: true,
        },
      ],
    };
    expect(archiveNavigationHorizontalFit(compact)).toBe(true);
    expect(
      archiveNavigationHorizontalFit({
        ...compact,
        panels: [{ ...compact.panels[0]!, scrollWidth: 337 }],
      }),
    ).toBe(false);
    expect(
      archiveNavigationHorizontalFit({
        ...compact,
        navigation: { ...compact.navigation, scrollWidth: 377 },
      }),
    ).toBe(false);
  });

  it("keeps the global topbar below the consent panel without a fixed privacy shortcut", () => {
    const header = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
      "utf8",
    );
    const privacy = readFileSync(
      new URL("../app/_components/CookieConsentBanner.module.css", import.meta.url),
      "utf8",
    );
    const headerLayer = Number(header.match(/\.topbar\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]);
    const panelLayer = Number(privacy.match(/\.banner\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]);
    expect(headerLayer).toBeLessThan(panelLayer);
    expect(privacy).not.toContain(".preferencesButton");
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
    expect(gate).toContain('"/app/configuracoes/metas/parcerias"');
    expect(gate).toContain('"Rotina", "/app/gestao/rotina"');
    expect(gate).toContain('["Repasse", "/app/repasse"]');
    expect(gate).toContain('["Integrações", "/app/configuracoes/conectar-sistemas"]');
    expect(gate).toContain('main[data-simulation-hub] a[href="${destination}"]');
    expect(gate).not.toContain("authorized-navigation-crm-simulation");
    expect(gate).not.toContain("authorized-navigation-crm-settings");
    expect(gate).toContain("exactAuthorizedRootNavigation");
    expect(gate).toContain("exactAuthorizedAccountNavigation");
    expect(gate).toContain("width: 1280, height: 720");
    expect(gate).toContain('matchMedia("(max-width: 1180px)")');
    expect(gate).toContain("scrollWithinVerticalAncestors");
    expect(gate).not.toContain("element.scrollIntoView");
    expect(gate).toContain("scrollContainerUsedWhenNeeded");
    expect(gate).not.toContain("checkCompactArchiveHeader");
    expect(compact).toContain("checkProtectedTopbar");
    expect(compact).toContain("titleContentInset");
    expect(compact).not.toContain("Title must sit close to the menu divider");
    expect(compact).toContain('"Virtual row height must match CSS"');
    expect(compact).toContain('"Entire hovered row must be gold with dark readable text"');
  });

  it("matches the exact Gestão visual contract including Previsão and Meta", () => {
    const management: NavigationItem = {
      key: "crm.management",
      path: "/app/gestao",
      name: "Gestão",
      description: "Gestão autorizada",
      section: "management",
      parentKey: null,
      sortOrder: 10,
    };
    const routine: NavigationItem = {
      ...management,
      key: "crm.management.routine",
      path: "/app/gestao/rotina",
      name: "Rotina",
      parentKey: management.key,
      sortOrder: 10,
    };
    const forecast: NavigationItem = {
      ...routine,
      key: "crm.management.forecast",
      path: "/app/gestao/previsao",
      name: "Previsão",
      sortOrder: 15,
    };
    const goals: NavigationItem = {
      ...management,
      key: "crm.settings.goals",
      path: "/app/configuracoes/metas",
      name: "Metas do funil",
      section: "settings",
      parentKey: "crm.settings",
      sortOrder: 20,
    };
    const group = buildNavigationGroups(
      getPrimaryNavigation([management, routine, forecast, goals]),
    )[0]!;
    expect(archiveManagementNavigationContract).toEqual([
      ["Visão geral", management.path],
      ...group.children.map((page) => [page.name, page.path]),
    ]);
    expect(archiveManagementNavigationContract).toEqual([
      ["Visão geral", "/app/gestao"],
      ["Rotina", "/app/gestao/rotina"],
      ["Previsão", "/app/gestao/previsao"],
      ["Meta", "/app/configuracoes/metas"],
    ]);
  });

  it("keeps the nine authorized roots in the approved visual and keyboard order", () => {
    expect(archiveRootNavigationContract).toEqual([
      { name: "Dashboard", tag: "BUTTON", href: null },
      { name: "Lead", tag: "BUTTON", href: null },
      { name: "Meta Ads", tag: "A", href: "/app/meta-ads" },
      { name: "Simulação", tag: "A", href: "/app/simulacao" },
      { name: "Ranking", tag: "A", href: "/app/ranking" },
      { name: "Canal de Parcerias", tag: "A", href: "/app/canal-de-parcerias" },
      { name: "Gestão", tag: "BUTTON", href: null },
      { name: "Links Úteis", tag: "BUTTON", href: null },
      { name: "Administração", tag: "BUTTON", href: null },
    ]);
  });

  it("accepts compact drawer content only when panel edges and items are scroll-reachable", () => {
    const measurement = completeMenuPanelMeasurement(true);
    expect(archiveMenuPanelPassed(measurement)).toBe(true);

    expect(
      archiveMenuPanelPassed({
        ...measurement,
        compactDrawer: { ...measurement.compactDrawer, verticalScrollAncestorCount: 0 },
      }),
    ).toBe(false);
    expect(
      archiveMenuPanelPassed({
        ...measurement,
        compactDrawer: {
          ...measurement.compactDrawer,
          panelEdges: { ...measurement.compactDrawer.panelEdges, topReachable: false },
        },
      }),
    ).toBe(false);
    expect(
      archiveMenuPanelPassed({
        ...measurement,
        compactDrawer: {
          ...measurement.compactDrawer,
          items: [
            {
              ...measurement.compactDrawer.items[0],
              scrollContainerUsedWhenNeeded: false,
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it("rejects horizontal clipping at every width and preserves desktop containment", () => {
    const compact = completeMenuPanelMeasurement(true);
    expect(
      archiveMenuPanelPassed({
        ...compact,
        common: { ...compact.common, horizontalAncestorsFit: false },
      }),
    ).toBe(false);
    expect(
      archiveMenuPanelPassed({
        ...compact,
        compactDrawer: {
          ...compact.compactDrawer,
          items: [
            {
              ...compact.compactDrawer.items[0],
              noOwnHorizontalOverflow: false,
            },
          ],
        },
      }),
    ).toBe(false);

    const desktop = completeMenuPanelMeasurement(false);
    expect(archiveMenuPanelPassed(desktop)).toBe(true);
    expect(
      archiveMenuPanelPassed({
        ...desktop,
        desktop: { ...desktop.desktop, panelInsideViewportVertically: false },
      }),
    ).toBe(false);
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
    expect(gate).toContain('a[data-navigation-root-control][href="/app/simulacao"]');
    expect(gate).toContain(
      'button[data-navigation-root-control][aria-controls="authorized-navigation-crm-useful_links"]',
    );
    expect(gate).toContain(
      'button[data-navigation-root-control][aria-controls="authorized-navigation-admin-home"]',
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
