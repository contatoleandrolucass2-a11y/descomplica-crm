import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const expectedReferenceRoutes = [
  "/",
  "/etapas/oportunidades",
  "/etapas/agendamentos",
  "/etapas/visitas",
  "/etapas/pastas",
  "/etapas/vendas",
  "/ranking",
  "/canal-de-parcerias",
  "/configuracoes",
  "/configuracoes/metas",
  "/configuracoes/metas/parcerias",
  "/configuracoes/metas/pontos",
  "/simulacao",
  "/simulacao/associativo-fluxo-linear",
  "/simulacao/calcular-documentacao",
  "/simulacao/caixa",
  "/simulacao/tabela-direta",
  "/simulacao/tabela-investidor",
];

const expectedProtectedRoutes = [
  "/app",
  "/app/etapas/oportunidades",
  "/app/etapas/agendamentos",
  "/app/etapas/visitas",
  "/app/etapas/pastas",
  "/app/etapas/vendas",
  "/app/ranking",
  "/app/canal-de-parcerias",
  "/app/configuracoes",
  "/app/configuracoes/metas",
  "/app/configuracoes/metas/parcerias",
  "/app/configuracoes/metas/pontos",
  "/app/simulacao",
  "/app/simulacao/associativo-fluxo-linear",
  "/app/simulacao/calcular-documentacao",
  "/app/simulacao/caixa",
  "/app/simulacao/tabela-direta",
  "/app/simulacao/tabela-investidor",
  "/admin",
  "/admin/usuarios",
  "/admin/paginas",
];

const expectedExpandedViewports = [
  { key: "desktop-1440x900", width: 1440, height: 900 },
  { key: "notebook-1280x720", width: 1280, height: 720 },
  { key: "tablet-1024x768", width: 1024, height: 768 },
  { key: "tablet-768x1024", width: 768, height: 1024 },
  { key: "mobile-390x844", width: 390, height: 844 },
  { key: "mobile-375x812", width: 375, height: 812 },
  { key: "mobile-320x568", width: 320, height: 568 },
];
const expectedZoomLevels = [80, 100, 125, 150, 200];
const visualHarness = readFileSync(
  new URL("../scripts/qa/authenticated-visual.mjs", import.meta.url),
  "utf8",
);
const referenceQaReadme = readFileSync(
  new URL("../docs/qa/reference-parity/README.md", import.meta.url),
  "utf8",
);

const manifest = JSON.parse(
  readFileSync(new URL("../docs/qa/reference-parity/manifest.json", import.meta.url), "utf8"),
) as {
  schemaVersion: number;
  captures: Array<{
    kind: string;
    route: string;
    sanitized: boolean;
    redactionCount: number;
    sha256: string;
    path: string;
    worktreeDirtyAtCapture?: boolean;
    worktreeFingerprint?: string;
    worktreeFingerprintAlgorithm?: string;
  }>;
};

const results = JSON.parse(
  readFileSync(new URL("../docs/qa/reference-parity/results.json", import.meta.url), "utf8"),
) as Record<
  string,
  {
    passed: boolean;
    routes: Array<{
      route: string;
      securityHeadersPresent?: boolean;
      finalOrigin?: string;
      finalPath?: string;
      hasUnexpectedLocationSuffix?: boolean;
      consoleErrorCount?: number;
      pageErrorCount?: number;
      postCaptureMutationCount?: number;
      postCaptureLocationStable?: boolean;
    }>;
    viewports?: Array<{
      finalPath: string;
      finalSecurityHeadersPresent: boolean;
      commercialContentCount: number;
      loginSurfacePresent: boolean;
      consoleErrorCount: number;
      pageErrorCount: number;
      postCaptureMutationCount: number;
      postCaptureValidated: boolean;
    }>;
  }
>;

const authenticatedResults = JSON.parse(
  readFileSync(
    new URL("../docs/qa/reference-parity/authenticated-results.json", import.meta.url),
    "utf8",
  ),
) as {
  schemaVersion: number;
  passed: boolean;
  mode: string;
  captureCommit: string;
  credentialsPersisted: boolean;
  storageStatePersisted: boolean;
  worktreeDirtyAtCapture: boolean;
  worktreeFingerprint: string;
  worktreeFingerprintAlgorithm: string;
  identityVerification: { endpoint: string; accountPolicy: string };
  viewports: Array<{ key: string; width: number; height: number }>;
  fixtureVerification: {
    contract: string;
    assertion: string;
    sourceMarkerPolicy: string;
    sourceMarkerVisible: Record<string, boolean>;
  };
  routeChecks: Array<{
    route: string;
    pathname: string;
    passed: boolean;
    reducedMotion: boolean;
    horizontalOverflow: boolean;
    topbarCollision: boolean;
    identityTruncationReady: boolean;
    blockedActionDistinct: boolean;
    unavailableActionDistinct: boolean;
    consoleErrorCount: number;
    pageErrorCount: number;
  }>;
  themeChecks: Array<{
    route: string;
    viewport?: string;
    theme: string;
    passed: boolean;
    reducedMotion: boolean;
    horizontalOverflow: boolean;
  }>;
  accessibilityChecks: Array<{
    route: string;
    viewport: string;
    theme: string;
    violations: Array<{ id: string; affectedNodes: number }>;
    passed: boolean;
  }>;
  zoom: {
    method?: string;
    levels?: Array<{
      percent: number;
      width: number;
      height: number;
      deviceScaleFactor: number;
    }>;
    passed: boolean;
    routes: Array<{
      route: string;
      viewport?: string;
      zoomPercent?: number;
      pathname: string;
      passed: boolean;
      reducedMotion: boolean;
      horizontalOverflow: boolean;
    }>;
  };
  keyboard: Record<string, boolean>;
  simulatorValidation: Record<string, boolean>;
  baselineIntegrity: {
    trackedFilesRequired: boolean;
    committedAtStart: boolean;
    unchangedDuringCapture: boolean;
  };
  baselinePromotion: {
    requested: boolean;
    performed: boolean;
    method: string;
    previousBaselineManifestSha256: string;
    previousBaselineResultSha256: string;
  };
  baselineUsed: {
    fileCount: number;
    manifestSha256: string;
    files: Array<{
      path: string;
      tracked: boolean;
      bytes: number;
      sha256: string;
    }>;
  };
  visualInspectionCoverage: {
    responsiveScreenshots: number;
    themeScreenshots: number;
    accessibilityAudits: number;
    baselineComparisons: number;
    changedPixelRatioThreshold: number;
    channelTolerance: number;
  };
  screenshots: Array<{
    path: string;
    bytes: number;
    sha256: string;
    visualComparison: {
      passed: boolean;
      reason: string;
      changedPixelRatio: number | null;
      baselineUsed: { path: string; tracked: boolean; bytes: number | null; sha256: string | null };
    };
    previousBaselineComparison: {
      passed: boolean;
      reason: string;
      changedPixelRatio: number;
      baselineUsed: { path: string; tracked: boolean; bytes: number; sha256: string };
    };
  }>;
};

describe("versioned reference parity catalog", () => {
  it("prepares the expanded authenticated visual matrix without weakening baseline safety", () => {
    const viewportSource = visualHarness.match(/const viewports = \[(.*?)\n\];/s)?.[1] ?? "";
    const configuredViewports = [
      ...viewportSource.matchAll(/\{ key: "([^"]+)", width: (\d+), height: (\d+) \}/g),
    ].map((match) => ({ key: match[1], width: Number(match[2]), height: Number(match[3]) }));
    expect(configuredViewports).toEqual(expectedExpandedViewports);

    const zoomSource = visualHarness.match(/const zoomLevels = \[(.*?)\n\];/s)?.[1] ?? "";
    const configuredZoomLevels = [...zoomSource.matchAll(/percent: (\d+)/g)].map((match) =>
      Number(match[1]),
    );
    expect(configuredZoomLevels).toEqual(expectedZoomLevels);

    expect(visualHarness).toContain('const mobileDarkViewportKey = "mobile-390x844"');
    expect(visualHarness).toContain('matrix: "mobile-dark"');
    expect(visualHarness).toContain('kind: "mobile-dark"');
    expect(visualHarness).toContain("...adminRoutes");
    for (const route of ["/admin", "/admin/usuarios", "/admin/paginas"]) {
      expect(visualHarness).toContain(`"${route}"`);
    }

    expect(visualHarness).toContain('if (argv.length === 0) return "verify"');
    expect(visualHarness).toContain(
      'if (argv.length === 1 && argv[0] === "--update-baseline") return "update-baseline"',
    );
    expect(visualHarness).toContain('if (remoteHomologation && mode !== "verify")');
    expect(visualHarness).toContain('method: "same-filesystem transactional rename with rollback"');
    expect(referenceQaReadme).toContain("Matriz autenticada aprovada no SHA de fechamento");
    expect(referenceQaReadme).toContain(
      "A matriz aprovou 147 capturas responsivas, 45 capturas de tema, 192 auditorias",
    );
  });

  it("catalogs exactly the eighteen live reference pages in both documents", () => {
    const inventory = readFileSync(new URL("../docs/CRM_INVENTORY.md", import.meta.url), "utf8");
    const matrix = readFileSync(
      new URL("../docs/REFERENCE_PARITY_MATRIX.md", import.meta.url),
      "utf8",
    );

    expect(inventory.match(/^\| REF-\d{2} \|/gm)).toHaveLength(18);
    expect(matrix.match(/^\| REF-\d{2} \|/gm)).toHaveLength(18);
    for (const route of expectedReferenceRoutes) expect(inventory).toContain(`\`${route}\``);
  });

  it("has one sanitized baseline with a valid hash for every reference route", () => {
    const captures = manifest.captures.filter((capture) => capture.kind === "reference");

    expect(captures.map((capture) => capture.route)).toEqual(expectedReferenceRoutes);
    expect(captures.every((capture) => capture.sanitized)).toBe(true);
    expect(captures.every((capture) => capture.redactionCount > 0)).toBe(true);
    expect(captures.every((capture) => /^[a-f0-9]{64}$/.test(capture.sha256))).toBe(true);
    expect(captures.every((capture) => typeof capture.worktreeDirtyAtCapture === "boolean")).toBe(
      true,
    );
    expect(
      captures.every((capture) => /^[a-f0-9]{64}$/.test(capture.worktreeFingerprint ?? "")),
    ).toBe(true);
    expect(
      captures.every(
        (capture) =>
          capture.worktreeFingerprintAlgorithm === "sha256-git-diff-head-and-untracked-v1",
      ),
    ).toBe(true);
    for (const capture of captures) {
      const contents = readFileSync(
        new URL(`../docs/qa/reference-parity/${capture.path}`, import.meta.url),
      );
      expect(createHash("sha256").update(contents).digest("hex")).toBe(capture.sha256);
    }
  });

  it("records exact, stable and error-free reference routes", () => {
    const result = results.reference!;
    expect(result.passed).toBe(true);
    expect(result.routes.map((route) => route.route)).toEqual(expectedReferenceRoutes);
    expect(
      result.routes.every(
        (route) =>
          route.finalOrigin === "https://descomplicapro.com.br" &&
          route.finalPath === route.route &&
          route.hasUnexpectedLocationSuffix === false &&
          route.consoleErrorCount === 0 &&
          route.pageErrorCount === 0 &&
          route.postCaptureMutationCount === 0 &&
          route.postCaptureLocationStable === true,
      ),
    ).toBe(true);
  });

  it("records the anonymous boundary before and after in all required viewports", () => {
    for (const kind of ["target-before", "target-after"]) {
      const result = results[kind]!;
      expect(result.passed).toBe(true);
      const expectedRoutes =
        kind === "target-before"
          ? expectedProtectedRoutes.slice(0, 12)
          : expectedReferenceRoutes.map((route) => (route === "/" ? "/app" : `/app${route}`));
      expect(result.routes.map((route) => route.route)).toEqual(expectedRoutes);
      expect(result.routes.every((route) => route.securityHeadersPresent)).toBe(true);
      expect(result.viewports).toHaveLength(4);
      expect(
        result.viewports?.every(
          (viewport) =>
            viewport.finalPath === "/login" &&
            viewport.finalSecurityHeadersPresent &&
            viewport.commercialContentCount === 0 &&
            viewport.loginSurfacePresent &&
            viewport.consoleErrorCount === 0 &&
            viewport.pageErrorCount === 0 &&
            viewport.postCaptureMutationCount === 0 &&
            viewport.postCaptureValidated,
        ),
      ).toBe(true);
    }
  });

  it("records complete authenticated local QA without persisting credentials", () => {
    expect(authenticatedResults.schemaVersion).toBe(2);
    expect(authenticatedResults.passed).toBe(true);
    expect(authenticatedResults.mode).toBe("update-baseline");
    expect(authenticatedResults.captureCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(authenticatedResults.credentialsPersisted).toBe(false);
    expect(authenticatedResults.storageStatePersisted).toBe(false);
    expect(authenticatedResults.identityVerification.endpoint).toMatch(
      /^http:\/\/(127\.0\.0\.1|localhost):\d+$/,
    );
    expect(authenticatedResults.identityVerification.accountPolicy).toBe("qa.*@local.invalid");
    expect(authenticatedResults.fixtureVerification).toEqual({
      contract: "rls-marker-v1",
      assertion: "synthetic marker and exact fixture counts verified through authenticated RLS",
      sourceMarkerPolicy: "QA local synthetic — not production · run <ephemeral-id>",
      sourceMarkerVisible: { dashboard: true, stageOpportunities: true },
    });
    const viewportKeys = authenticatedResults.viewports.map(({ key }) => key);
    expect(viewportKeys).toEqual(expectedExpandedViewports.map(({ key }) => key));

    const responsiveScreenshotCount = expectedProtectedRoutes.length * viewportKeys.length;
    expect(authenticatedResults.routeChecks).toHaveLength(responsiveScreenshotCount);
    expect([...new Set(authenticatedResults.routeChecks.map(({ route }) => route))]).toEqual(
      expectedProtectedRoutes,
    );
    expect(
      authenticatedResults.routeChecks.every(
        (check) =>
          check.passed &&
          check.pathname === check.route &&
          check.reducedMotion &&
          !check.horizontalOverflow &&
          !check.topbarCollision &&
          check.identityTruncationReady &&
          check.blockedActionDistinct &&
          check.unavailableActionDistinct &&
          check.consoleErrorCount === 0 &&
          check.pageErrorCount === 0,
      ),
    ).toBe(true);

    const themeCheckCount = expectedProtectedRoutes.length * 4;
    expect(authenticatedResults.themeChecks).toHaveLength(themeCheckCount);
    expect([...new Set(authenticatedResults.themeChecks.map(({ theme }) => theme))]).toEqual([
      "light",
      "balanced",
      "dark",
    ]);
    expect(
      authenticatedResults.themeChecks.every(
        (check) => check.passed && check.reducedMotion && !check.horizontalOverflow,
      ),
    ).toBe(true);
    const themeScreenshotCount = 45;
    const visualEvidenceCount = responsiveScreenshotCount + themeScreenshotCount;
    expect(authenticatedResults.accessibilityChecks).toHaveLength(visualEvidenceCount);
    expect(
      authenticatedResults.accessibilityChecks.every(
        (check) => check.passed && check.violations.length === 0,
      ),
    ).toBe(true);

    expect(authenticatedResults.zoom.passed).toBe(true);
    const capturedZoomLevels = authenticatedResults.zoom.levels?.map(({ percent }) => percent);
    expect(capturedZoomLevels).toEqual(expectedZoomLevels);
    expect(authenticatedResults.zoom.routes).toHaveLength(
      expectedProtectedRoutes.length * expectedZoomLevels.length,
    );
    for (const zoomPercent of expectedZoomLevels) {
      expect(
        authenticatedResults.zoom.routes
          .filter((check) => (check.zoomPercent ?? 200) === zoomPercent)
          .map(({ route }) => route),
      ).toEqual(expectedProtectedRoutes);
    }
    expect(
      authenticatedResults.zoom.routes.every(
        (check) =>
          check.passed &&
          check.pathname === check.route &&
          check.reducedMotion &&
          !check.horizontalOverflow,
      ),
    ).toBe(true);
    expect(Object.values(authenticatedResults.keyboard).every(Boolean)).toBe(true);
    expect(Object.values(authenticatedResults.simulatorValidation).every(Boolean)).toBe(true);

    expect(authenticatedResults.visualInspectionCoverage).toEqual({
      responsiveScreenshots: responsiveScreenshotCount,
      themeScreenshots: themeScreenshotCount,
      accessibilityAudits: visualEvidenceCount,
      baselineComparisons: visualEvidenceCount,
      changedPixelRatioThreshold: 0.01,
      channelTolerance: 16,
    });
    expect(authenticatedResults.screenshots).toHaveLength(visualEvidenceCount);
    expect(authenticatedResults.worktreeDirtyAtCapture).toBe(false);
    expect(authenticatedResults.worktreeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(authenticatedResults.worktreeFingerprintAlgorithm).toBe(
      "sha256-git-diff-head-and-untracked-v1",
    );
    expect(authenticatedResults.baselineIntegrity).toEqual({
      trackedFilesRequired: true,
      committedAtStart: true,
      unchangedDuringCapture: true,
    });
    expect(authenticatedResults.baselinePromotion).toMatchObject({
      requested: true,
      performed: true,
      method: "same-filesystem transactional rename with rollback",
    });
    expect(authenticatedResults.baselinePromotion.previousBaselineManifestSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(authenticatedResults.baselinePromotion.previousBaselineResultSha256).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(authenticatedResults.baselineUsed.fileCount).toBe(visualEvidenceCount);
    expect(authenticatedResults.baselineUsed.files).toHaveLength(visualEvidenceCount);
    expect(authenticatedResults.baselineUsed.manifestSha256).toMatch(/^[a-f0-9]{64}$/);

    for (const screenshot of authenticatedResults.screenshots) {
      expect(screenshot.visualComparison.passed).toBe(true);
      expect(screenshot.visualComparison.reason).toBe("baseline_updated");
      expect(screenshot.visualComparison.changedPixelRatio).toBeLessThanOrEqual(0.01);
      expect(screenshot.visualComparison.baselineUsed).toMatchObject({
        path: `docs/qa/reference-parity/${screenshot.path}`,
        tracked: true,
        bytes: screenshot.bytes,
        sha256: screenshot.sha256,
      });
      expect(screenshot.previousBaselineComparison.reason).toMatch(
        /^(within_threshold|pixel_drift|dimensions_changed|baseline_not_tracked)$/,
      );
      if (screenshot.previousBaselineComparison.reason === "baseline_not_tracked") {
        expect(screenshot.previousBaselineComparison.changedPixelRatio).toBeNull();
        expect(screenshot.previousBaselineComparison.baselineUsed.tracked).toBe(false);
      } else {
        expect(screenshot.previousBaselineComparison.changedPixelRatio).toBeGreaterThanOrEqual(0);
        expect(screenshot.previousBaselineComparison.changedPixelRatio).toBeLessThanOrEqual(1);
        expect(screenshot.previousBaselineComparison.baselineUsed.tracked).toBe(true);
      }
      expect(screenshot.previousBaselineComparison.baselineUsed.path).toBe(
        `docs/qa/reference-parity/${screenshot.path}`,
      );
      const contents = readFileSync(
        new URL(`../docs/qa/reference-parity/${screenshot.path}`, import.meta.url),
      );
      expect(contents.byteLength).toBe(screenshot.bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(screenshot.sha256);
    }
  });
});
