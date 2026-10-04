import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { AccountMenu } from "../app/(protected)/_components/AccountMenu";
import { AuthorizedNavigation } from "../app/(protected)/_components/AuthorizedNavigation";
import { ThemeSwitch } from "../app/(protected)/_components/ThemeSwitch";
import styles from "../app/(protected)/_components/ProtectedShell.module.css";
// @ts-expect-error Operational ESM script, exercised against the real header below.
import * as navigationQa from "../scripts/qa/archive-navigation.mjs";

function readQaFunction(source: string, name: string, dependencies: Record<string, unknown> = {}) {
  const parsed = ts.createSourceFile(
    "qa.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const declaration = parsed.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  if (!declaration) throw new Error(`Missing QA function: ${name}`);
  // Isolate the actual function without starting the operational script or its network clients.
  return new Function(
    ...Object.keys(dependencies),
    `${declaration.getText(parsed)}; return ${name};`,
  )(...Object.values(dependencies));
}

function accountIdentityEvidencePassed(check: {
  identityDisplayContract?: string;
  identityDisplayReady?: boolean;
  identityTruncationReady?: boolean;
}) {
  if (check.identityDisplayContract === "registered-first-name-v1") {
    return check.identityDisplayReady === true;
  }
  // Retain the historical baseline's gate without treating it as evidence of the new contract.
  return (
    check.identityDisplayContract === undefined &&
    check.identityDisplayReady === undefined &&
    check.identityTruncationReady === true
  );
}

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
  "/app/simulacao/tabelao",
  "/app/simulacao/tabela-investidor",
  "/admin",
  "/admin/usuarios",
  "/admin/paginas",
];

const futureSimulatorRoutes = new Set<string>();
const expectedReleasedProtectedRoutes = expectedProtectedRoutes.filter(
  (route) => !futureSimulatorRoutes.has(route),
);

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
    identityDisplayContract?: string;
    identityDisplayReady?: boolean;
    identityTruncationReady?: boolean;
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
  tabelaoValidation: Record<string, boolean>;
  directTableValidation: Record<string, boolean>;
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

describe("current account display and protected header contract", () => {
  it.runIf(process.env.ACCOUNT_MENU_BROWSER === "1")(
    "keeps the brand hit area separate and rejects hidden, clipped or incorrect account names",
    async () => {
      const require = createRequire(import.meta.url);
      const { parse } = createRequire(require.resolve("next/package.json"))("postcss") as {
        parse: (source: string) => {
          walkRules: (callback: (rule: { selector: string }) => void) => void;
          toString: () => string;
        };
      };
      const stylesheet = parse(
        readFileSync(
          new URL("../app/(protected)/_components/ProtectedShell.module.css", import.meta.url),
          "utf8",
        ),
      );
      stylesheet.walkRules((rule) => {
        rule.selector = rule.selector
          .replace(/:global\(([^)]+)\)/g, "$1")
          .replace(/\.([a-zA-Z][\w-]*)/g, (_, name: string) => `.${styles[name]}`);
      });
      const brand = readFileSync(
        new URL("../public/descomplica-symbol.png", import.meta.url),
      ).toString("base64");
      const pages = [
        ["crm.dashboard", "/app", "Dashboard"],
        ["crm.simulation", "/app/simulacao", "Simulacao"],
        ["crm.ranking", "/app/ranking", "Ranking"],
        ["crm.partnerships", "/app/canal-de-parcerias", "Canal de Parcerias"],
        ["crm.settings", "/app/configuracoes", "Configuracoes"],
      ].map(([key, path, name], sortOrder) => ({
        key: key!,
        path: path!,
        name: name!,
        sortOrder,
        section: "crm",
        description: "Navegacao sintetica",
        parentKey: null,
      }));
      const fixture = (displayName: string, theme = "light") => {
        const accountProps = {
          identity: "qa.header@local.invalid",
          displayName,
          role: "Corretor",
          children: null,
        };
        const markup = renderToStaticMarkup(
          createElement(
            "header",
            {
              className: styles.topbar,
              "data-protected-topbar": true,
            },
            createElement(
              "div",
              { className: styles.topbarInner },
              createElement(
                "a",
                { className: styles.brand, href: "/app", "data-protected-brand": true },
                createElement("img", {
                  className: styles.brandMark,
                  src: `data:image/png;base64,${brand}`,
                  alt: "",
                }),
                createElement("span", { className: styles.brandName }, "escomplica"),
              ),
              createElement(AuthorizedNavigation, { pages }),
              createElement(ThemeSwitch, { canPersist: false }),
              createElement(
                "div",
                { className: styles.actions },
                createElement(AccountMenu, accountProps),
              ),
            ),
          ),
        );
        return `<html data-theme="${theme}"><head><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}${stylesheet}</style></head><body>${markup}</body></html>`;
      };
      const inspectIdentity = readQaFunction(visualHarness, "inspectAccountIdentityDisplay") as (
        expectedFirstName: string,
      ) => { identityDisplayReady: boolean };
      const { assertHeaderGeometry } = navigationQa as {
        assertHeaderGeometry: (page: Page, compact: boolean) => Promise<unknown>;
      };
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        let cases = 0;
        for (const width of [320, 375, 600, 601, 760, 768, 1180, 1181, 1280, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          for (const theme of ["light", "balanced", "dark"]) {
            for (const name of ["Mariana Silva", "AlexandrianaMaximilianaConstantina QA"]) {
              await page.setContent(fixture(name, theme));
              expect(
                await page.evaluate(inspectIdentity, name.split(" ")[0]!),
                `${width}/${theme}/${name}`,
              ).toMatchObject({ identityDisplayReady: true });
              await assertHeaderGeometry(page, width <= 1180);
              cases++;
            }
          }
        }
        expect(cases).toBe(66);
        await page.setViewportSize({ width: 320, height: 568 });
        for (const name of [
          "Mariana",
          "AlexandrianaMaximilianaAna",
          "AlexandrianaMaximilianaConstantina",
        ]) {
          await page.setContent(fixture(`${name} QA`));
          await assertHeaderGeometry(page, true);
          expect(await page.evaluate(inspectIdentity, name)).toMatchObject({
            identityDisplayReady: true,
          });
          const sizing = await page.evaluate(() => {
            const header = document.querySelector<HTMLElement>("[data-protected-topbar]")!;
            const label = document.querySelector<HTMLElement>(
              "[data-session-identity-trigger-label]",
            )!;
            const range = document.createRange();
            range.selectNodeContents(label);
            return {
              width: innerWidth,
              nameLength: label.textContent!.length,
              headerHeight: header.getBoundingClientRect().height,
              labelWidth: label.getBoundingClientRect().width,
              labelHeight: label.getBoundingClientRect().height,
              lines: range.getClientRects().length,
            };
          });
          if (name.length <= 26) expect(sizing.headerHeight).toBeLessThanOrEqual(60);
          process.stdout.write(`[account-header-sizing] ${JSON.stringify(sizing)}\n`);
        }
        for (const mutation of [
          { text: "qa.header@local.invalid" },
          { text: "Maria" },
          { style: "display:none" },
          { style: "visibility:hidden" },
          { parentStyle: "opacity:0" },
          { style: "text-overflow:ellipsis" },
          { style: "width:8px;flex:0 0 8px;max-height:10px;overflow:hidden;white-space:nowrap" },
          { ariaLabel: "Outra conta" },
          { parentStyle: "transform:translateX(2000px)" },
        ]) {
          await page.setContent(fixture("Mariana Silva"));
          await page.locator("[data-session-identity-trigger-label]").evaluate((label, change) => {
            if (change.text) label.textContent = change.text;
            if (change.style) label.setAttribute("style", change.style);
            if (change.parentStyle) label.parentElement!.setAttribute("style", change.parentStyle);
            if (change.ariaLabel) label.parentElement!.setAttribute("aria-label", change.ariaLabel);
          }, mutation);
          expect(
            await page.evaluate(inspectIdentity, "Mariana"),
            JSON.stringify(mutation),
          ).toMatchObject({ identityDisplayReady: false });
        }
      } finally {
        await browser.close();
      }
    },
    90_000,
  );
});

describe("versioned reference parity catalog", () => {
  it("keeps historical evidence separate and requires the new gate for new captures", () => {
    expect(accountIdentityEvidencePassed({ identityTruncationReady: true })).toBe(true);
    expect(
      accountIdentityEvidencePassed({
        identityDisplayContract: "registered-first-name-v1",
        identityDisplayReady: true,
      }),
    ).toBe(true);
    expect(
      accountIdentityEvidencePassed({
        identityDisplayContract: "registered-first-name-v1",
        identityTruncationReady: true,
      }),
    ).toBe(false);
    expect(
      accountIdentityEvidencePassed({
        identityDisplayContract: "unknown",
        identityDisplayReady: true,
      }),
    ).toBe(false);
    expect(
      accountIdentityEvidencePassed({
        identityDisplayReady: true,
        identityTruncationReady: true,
      }),
    ).toBe(false);
    expect(accountIdentityEvidencePassed({})).toBe(false);
  });

  it("requires the whole visible account name in every current route inspection", () => {
    expect(visualHarness).not.toContain("identityTruncationReady");
    expect(visualHarness).toContain('identityDisplayContract: "registered-first-name-v1"');
    expect(visualHarness).toContain("snapshot.identityDisplayReady &&");
    expect(visualHarness).toContain(
      "page.evaluate(inspectAccountIdentityDisplay, expectedAccountFirstName)",
    );
    const parsed = ts.createSourceFile(
      "qa.mjs",
      visualHarness,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const calls: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(parsed) === "inspectRoute")
        calls.push(node);
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.arguments[6]?.getText(parsed)).toContain("expectedAccountFirstName");
    }
  });

  it.each([
    ["  Mariana Silva  ", "Mariana"],
    ["AlexandrianaMaximilianaConstantina QA", "AlexandrianaMaximilianaConstantina"],
    [undefined, "Conta"],
    ["email.alias@example.invalid", "Conta"],
  ])("derives the QA expectation from verified metadata: %s", async (name, expected) => {
    const email = "qa.first-name@local.invalid";
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email, user_metadata: { name } },
        access_token: "synthetic-token",
      }),
    });
    const verify = readQaFunction(visualHarness, "verifyDedicatedLocalQaIdentity", { fetch });
    const result = await verify(
      "http://127.0.0.1:54321",
      "synthetic-key",
      email,
      "synthetic-password",
    );
    expect(result.firstName).toBe(expected);
    expect(result.accountPolicy).toBe("qa.*@local.invalid");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "local-authenticated-visual.mjs",
      "createEphemeralQaUser",
      undefined,
      "AlexandrianaMaximilianaConstantina Visual QA",
    ],
    [
      "local-rls-api.mjs",
      "createEphemeralAccount",
      "master",
      "AlexandrianaMaximilianaConstantina QA",
    ],
    ["local-rls-api.mjs", "createEphemeralAccount", "user", "Mariana QA"],
  ])(
    "gives %s %s %s an explicit synthetic name",
    async (file, functionName, role, expectedName) => {
      const source = readFileSync(new URL(`../scripts/qa/${file}`, import.meta.url), "utf8");
      const createUser = vi.fn().mockResolvedValue({
        data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
        error: null,
      });
      const createAccount = readQaFunction(source, functionName!, {
        randomBytes,
        legalDocumentVersions: { terms: "synthetic", privacy: "synthetic" },
        assertUuid: (id: string) => id,
        fail: (message: string) => {
          throw new Error(message);
        },
      });
      const client = { auth: { admin: { createUser } } };
      if (role) await createAccount(client, role, "fixture-contract");
      else await createAccount(client, "fixture-contract");
      expect(createUser.mock.calls[0]?.[0].user_metadata.name).toBe(expectedName);
      expect(createUser.mock.calls[0]?.[0].user_metadata.legal_acceptance).toMatchObject({
        termsAccepted: true,
        privacyAccepted: true,
      });
    },
  );

  it("prepares the expanded authenticated visual matrix without weakening baseline safety", () => {
    const routeSource = visualHarness.match(/const routes = \[(.*?)\n\];/s)?.[1] ?? "";
    const configuredRoutes = [...routeSource.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(configuredRoutes).toEqual(expectedReleasedProtectedRoutes);

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
      "A matriz aprovou 147 capturas responsivas, 54 capturas de tema, 201 auditorias",
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

    const responsiveScreenshotCount = expectedReleasedProtectedRoutes.length * viewportKeys.length;
    expect(authenticatedResults.routeChecks).toHaveLength(responsiveScreenshotCount);
    expect([...new Set(authenticatedResults.routeChecks.map(({ route }) => route))]).toEqual(
      expectedReleasedProtectedRoutes,
    );
    expect(
      authenticatedResults.routeChecks.every(
        (check) =>
          check.passed &&
          check.pathname === check.route &&
          check.reducedMotion &&
          !check.horizontalOverflow &&
          !check.topbarCollision &&
          accountIdentityEvidencePassed(check) &&
          check.blockedActionDistinct &&
          check.unavailableActionDistinct &&
          check.consoleErrorCount === 0 &&
          check.pageErrorCount === 0,
      ),
    ).toBe(true);

    const themeCheckCount = expectedReleasedProtectedRoutes.length * 4;
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
    const desktopThemeScreenshotCount = 11 * 3;
    const mobileDarkScreenshotCount = expectedReleasedProtectedRoutes.length;
    const themeScreenshotCount = desktopThemeScreenshotCount + mobileDarkScreenshotCount;
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
      expectedReleasedProtectedRoutes.length * expectedZoomLevels.length,
    );
    for (const zoomPercent of expectedZoomLevels) {
      expect(
        authenticatedResults.zoom.routes
          .filter((check) => (check.zoomPercent ?? 200) === zoomPercent)
          .map(({ route }) => route),
      ).toEqual(expectedReleasedProtectedRoutes);
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
    expect(Object.keys(authenticatedResults.tabelaoValidation)).toHaveLength(20);
    expect(authenticatedResults.tabelaoValidation).toMatchObject({
      liveAvailableBeforeLocationReference: true,
      locationReferenceApplied: true,
      locationMetadataFits: true,
      malformedPayloadRecoverable: true,
      malformedPayloadRetryRestoresInventory: true,
      completeLiveSkipsLocationReference: true,
      concurrentResponsesKeepFiltersIndependent: true,
    });
    expect(Object.values(authenticatedResults.tabelaoValidation).every(Boolean)).toBe(true);
    expect(Object.keys(authenticatedResults.directTableValidation)).toHaveLength(49);
    expect(Object.values(authenticatedResults.directTableValidation).every(Boolean)).toBe(true);

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

    const baselineRoot = path.resolve(
      import.meta.dirname,
      "../docs/qa/reference-parity/target-authenticated",
    );
    const baselineFiles = readdirSync(baselineRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
      .map((entry) =>
        path
          .relative(baselineRoot, path.join(entry.parentPath, entry.name))
          .split(path.sep)
          .join("/"),
      )
      .sort();
    const manifestedBaselineFiles = authenticatedResults.baselineUsed.files
      .map(({ path: filePath }) => filePath.replace(/^.*target-authenticated\//, ""))
      .sort();
    expect(baselineFiles).toEqual(manifestedBaselineFiles);

    for (const screenshot of authenticatedResults.screenshots) {
      expect(screenshot.visualComparison.passed).toBe(true);
      expect(["baseline_updated", "baseline_preserved"]).toContain(
        screenshot.visualComparison.reason,
      );
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
  }, 20_000);
});
