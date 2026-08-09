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
];

const manifest = JSON.parse(
  readFileSync(new URL("../docs/qa/reference-parity/manifest.json", import.meta.url), "utf8"),
) as {
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
  passed: boolean;
  credentialsPersisted: boolean;
  worktreeDirtyAtCapture: boolean;
  worktreeFingerprint: string;
  worktreeFingerprintAlgorithm: string;
  identityVerification: { endpoint: string; accountPolicy: string };
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
    consoleErrorCount: number;
    pageErrorCount: number;
  }>;
  themeChecks: Array<{
    route: string;
    theme: string;
    passed: boolean;
    reducedMotion: boolean;
    horizontalOverflow: boolean;
  }>;
  zoom: {
    passed: boolean;
    routes: Array<{
      route: string;
      pathname: string;
      passed: boolean;
      reducedMotion: boolean;
      horizontalOverflow: boolean;
    }>;
  };
  keyboard: Record<string, boolean>;
  simulatorValidation: Record<string, boolean>;
  visualInspectionCoverage: {
    responsiveScreenshots: number;
    themeScreenshots: number;
  };
  screenshots: Array<{
    path: string;
    bytes: number;
    sha256: string;
  }>;
};

describe("versioned reference parity catalog", () => {
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
        kind === "target-before" ? expectedProtectedRoutes.slice(0, 12) : expectedProtectedRoutes;
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
    expect(authenticatedResults.passed).toBe(true);
    expect(authenticatedResults.credentialsPersisted).toBe(false);
    expect(authenticatedResults.identityVerification.endpoint).toMatch(
      /^http:\/\/(127\.0\.0\.1|localhost):\d+$/,
    );
    expect(authenticatedResults.identityVerification.accountPolicy).toBe("qa.*@local.invalid");
    expect(authenticatedResults.fixtureVerification).toEqual({
      contract: "rls-marker-v1",
      assertion: "synthetic marker and exact fixture counts verified through authenticated RLS",
      sourceMarkerPolicy: "QA local synthetic — not production · run <ephemeral-id>",
      sourceMarkerVisible: { dashboard: true, ranking: true },
    });
    expect(authenticatedResults.routeChecks).toHaveLength(72);
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
          check.consoleErrorCount === 0 &&
          check.pageErrorCount === 0,
      ),
    ).toBe(true);

    expect(authenticatedResults.themeChecks).toHaveLength(54);
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

    expect(authenticatedResults.zoom.passed).toBe(true);
    expect(authenticatedResults.zoom.routes).toHaveLength(18);
    expect(authenticatedResults.zoom.routes.map(({ route }) => route)).toEqual(
      expectedProtectedRoutes,
    );
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
      responsiveScreenshots: 72,
      themeScreenshots: 15,
    });
    expect(authenticatedResults.screenshots).toHaveLength(87);
    expect(typeof authenticatedResults.worktreeDirtyAtCapture).toBe("boolean");
    expect(authenticatedResults.worktreeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(authenticatedResults.worktreeFingerprintAlgorithm).toBe(
      "sha256-git-diff-head-and-untracked-v1",
    );

    for (const screenshot of authenticatedResults.screenshots) {
      const contents = readFileSync(
        new URL(`../docs/qa/reference-parity/${screenshot.path}`, import.meta.url),
      );
      expect(contents.byteLength).toBe(screenshot.bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(screenshot.sha256);
    }
  });
});
