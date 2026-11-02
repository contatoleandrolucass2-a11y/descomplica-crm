import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Standalone QA module runs directly with Node.
import * as visualRouteScope from "../scripts/qa/visual-route-scope.mjs";

const {
  authenticatedVisualRoutes,
  selectVisualRoutes,
  buildVisualCheckPlan,
  readVisualCheckPlan,
  createVisualCheckRunner,
  visualCheckResultsPassed,
} = visualRouteScope;
// @ts-expect-error Standalone classifier runs directly with Node.
import { classifyVisualPaths } from "../scripts/ci/visual-impact-scope.mjs";

describe("authenticated visual route selection", () => {
  it("uses every protected route when no focused scope is provided", () => {
    expect(selectVisualRoutes()).toEqual(authenticatedVisualRoutes);
    expect(selectVisualRoutes()).not.toBe(authenticatedVisualRoutes);
  });

  it("keeps canonical order for a valid focused scope", () => {
    expect(selectVisualRoutes(JSON.stringify(["/app/ranking", "/app"]))).toEqual([
      "/app",
      "/app/ranking",
    ]);
  });

  it.each(["not-json", "[]", JSON.stringify(["/unknown"]), JSON.stringify(["/app", "/app"])])(
    "fails closed for invalid focused scope %s",
    (raw) => {
      expect(() => selectVisualRoutes(raw)).toThrow(/QA_VISUAL_ROUTES/);
    },
  );
});

describe("complete visual functional impact contract", () => {
  it("executes only required dependencies, reports NA and rejects missing results", async () => {
    const impact = classifyVisualPaths([
      "app/(protected)/app/etapas/_components/AppointmentsDashboard.module.css",
    ]);
    const plan = readVisualCheckPlan(
      JSON.stringify(buildVisualCheckPlan(impact.routes)),
      impact.routes,
    );
    const { run, results } = createVisualCheckRunner(plan);
    const executed: string[] = [];
    expect(visualCheckResultsPassed(plan, results)).toBe(false);
    for (const check of plan.checks) {
      await run(check.id, async () => {
        executed.push(check.id);
        return { passed: true };
      });
    }
    expect(executed).toEqual(["keyboard"]);
    expect(results.simulatorValidation.status).toBe("not_applicable");
    expect(results.fixtureSourceMarker.status).toBe("not_applicable");
    expect(visualCheckResultsPassed(plan, results)).toBe(true);
    delete results.keyboard;
    expect(visualCheckResultsPassed(plan, results)).toBe(false);
  });

  it.each([
    ["app/(protected)/app/simulacao/_components/Investor.tsx", "focused"],
    ["app/(protected)/app/_components/analytics/Charts.tsx", "full"],
    ["lib/authorization/permissions.ts", "full"],
    ["unknown/runtime.ts", "full"],
  ])("keeps the classifier/executor/gate aligned for %s", async (file, expectedMode) => {
    const impact = classifyVisualPaths([file]);
    expect(impact.mode).toBe(expectedMode);
    const plan = buildVisualCheckPlan(impact.routes);
    const { run, results } = createVisualCheckRunner(plan);
    for (const check of plan.checks) await run(check.id, async () => ({ passed: true }));
    expect(visualCheckResultsPassed(plan, results)).toBe(true);
    const required = plan.checks.find((check: { required: boolean }) => check.required);
    results[required.id].status = "not_applicable";
    expect(visualCheckResultsPassed(plan, results)).toBe(false);
  });

  it("retains the whole navigation contract for a shared simulator dependency", () => {
    const plan = buildVisualCheckPlan(["/app/simulacao/tabela-direta"]);
    expect(
      plan.checks.find((check: { id: string }) => check.id === "archiveNavigation"),
    ).toMatchObject({
      required: true,
      dependencies: expect.arrayContaining([
        "/app/simulacao/tabela-investidor",
        "/app/simulacao/tabelao",
      ]),
    });
  });

  it("cannot turn execution errors or false assertions into success", async () => {
    const plan = buildVisualCheckPlan(["/app"]);
    const { run, results } = createVisualCheckRunner(plan);
    await expect(
      run("keyboard", async () => {
        throw new Error("fixture failure");
      }),
    ).rejects.toThrow("fixture failure");
    expect(results.keyboard.status).toBe("failed");
    await run("keyboard", async () => ({ passed: false }));
    expect(visualCheckResultsPassed(plan, results)).toBe(false);
    expect(() => readVisualCheckPlan(JSON.stringify({ ...plan, checks: [] }), plan.routes)).toThrow(
      /disagrees/,
    );
  });

  it("the actual aggregate rejects a missing mandatory check even with all captures approved", async () => {
    const visualRoutes = ["/app/etapas/agendamentos"];
    const functionalPlan = buildVisualCheckPlan(visualRoutes);
    const { run, results } = createVisualCheckRunner(functionalPlan);
    await run("keyboard", async () => ({ passed: true }));
    const script = readFileSync("scripts/qa/authenticated-visual.mjs", "utf8");
    const aggregateSource = script.slice(
      script.indexOf("function functionalChecksPassed("),
      script.indexOf("function createPromotedResult("),
    );
    const aggregate = new Function(
      "visualRoutes",
      "viewports",
      "themes",
      "desktopThemeCaptureRoutes",
      "zoomLevels",
      "functionalPlan",
      "visualCheckResultsPassed",
      `${aggregateSource}; return functionalChecksPassed;`,
    )(
      visualRoutes,
      ["desktop"],
      ["light", "balanced", "dark"],
      new Set(visualRoutes),
      [100],
      functionalPlan,
      visualCheckResultsPassed,
    );
    const check = { passed: true };
    const captures = Array.from({ length: 5 }, (_, index) =>
      index === 0 ? { approvedCanvasComparison: check } : {},
    );
    const evidence = {
      routeChecks: [check],
      themeChecks: [check, check, check, check],
      accessibilityChecks: Array(5).fill(check),
      screenshots: captures,
      functionalChecks: results,
      zoom: { routes: [check], passed: true },
    };
    expect(aggregate(evidence)).toBe(true);
    results.keyboard.status = "not_applicable";
    expect(aggregate(evidence)).toBe(false);
    delete results.keyboard;
    expect(aggregate(evidence)).toBe(false);
  });

  it("keeps baseline generation intentional and pinned to the reviewed SHA", () => {
    const workflow = readFileSync(".github/workflows/ranking-visual-candidate.yml", "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).toContain("ref: ${{ inputs.candidate_sha }}");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"');
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("passes the exact plan and selected routes through the isolated runner boundary", () => {
    const runner = readFileSync("scripts/qa/local-authenticated-visual.mjs", "utf8");
    const childEnvironment = runner.slice(
      runner.indexOf("const childEnvironment = {"),
      runner.indexOf(
        "return new Promise((resolve, reject)",
        runner.indexOf("const childEnvironment = {"),
      ),
    );
    expect(childEnvironment).toContain('"QA_VISUAL_PLAN"');
    expect(childEnvironment).toContain('"QA_VISUAL_ROUTES"');
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(
      workflow.match(/QA_VISUAL_PLAN: \$\{\{ needs.validate.outputs.visual_plan \}\}/g),
    ).toHaveLength(2);
  });
});
