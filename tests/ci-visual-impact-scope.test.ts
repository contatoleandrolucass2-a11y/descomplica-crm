import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error Standalone CI module runs directly with Node.
import * as visualScope from "../scripts/ci/visual-impact-scope.mjs";
// @ts-expect-error Standalone CI module runs directly with Node.
import * as projectionScope from "../scripts/ci/appointments-projection-scope.mjs";

const { authenticatedVisualRoutes, classifyVisualImpact, classifyVisualPaths } = visualScope;
const { classifyAppointmentsProjectionPaths, classifyAppointmentsProjectionImpact } =
  projectionScope;

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), "crm-visual-scope-"));
  roots.push(cwd);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.name", "CI fixture");
  git("config", "user.email", "ci@example.invalid");
  git("config", "core.autocrlf", "false");
  git("config", "core.hooksPath", path.join(cwd, "no-hooks"));
  const put = (file: string, value = "fixture\n") => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), value);
  };
  const commit = () => {
    git("add", "--all");
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  put("README.md");
  const base = commit();
  return { cwd, git, put, commit, base };
}

describe("authenticated visual impact scope", () => {
  it("does not run the global matrix for isolated Meta Ads files", () => {
    expect(
      classifyVisualPaths([
        "public/canvas/app.js",
        "public/descomplica-ads-compact/canvas-merge.js",
        "scripts/qa/meta-ads-frame.mjs",
        "tests/meta-ads-dashboard.test.tsx",
        "CHANGELOG.md",
      ]),
    ).toMatchObject({ mode: "none", routes: [] });
  });

  it("selects only mapped routes for isolated page changes", () => {
    expect(
      classifyVisualPaths([
        "app/(protected)/app/ranking/RankingCanvas.module.css",
        "app/(protected)/app/canal-de-parcerias/page.tsx",
      ]),
    ).toEqual({
      mode: "focused",
      routes: ["/app/ranking", "/app/canal-de-parcerias"],
      reason: "mapped-routes",
    });
  });

  it("keeps exclusive appointments styles and components on their own route", () => {
    expect(
      classifyVisualPaths([
        "app/(protected)/app/etapas/_components/AppointmentsDashboard.module.css",
        "app/(protected)/app/etapas/_components/AppointmentsComparison.tsx",
        "lib/crm/stages/appointments.ts",
      ]),
    ).toMatchObject({ mode: "focused", routes: ["/app/etapas/agendamentos"] });
    expect(classifyVisualPaths(["app/(protected)/app/etapas/[stage]/page.tsx"]).routes).toEqual(
      authenticatedVisualRoutes.filter((route: string) => route.startsWith("/app/etapas/")),
    );
  });

  it.each([
    ".github/workflows/ci.yml",
    "app/(protected)/_components/ProtectedShell.module.css",
    "lib/authorization/permissions.ts",
    "scripts/qa/authenticated-visual.mjs",
    "unknown/runtime.ts",
  ])("fails closed to the full matrix for %s", (file) => {
    expect(classifyVisualPaths([file])).toMatchObject({
      mode: "full",
      routes: authenticatedVisualRoutes,
    });
  });

  it("uses the complete pull-request diff, not only the final commit", () => {
    const f = fixture();
    f.put("public/canvas/app.js");
    f.commit();
    f.put("app/(protected)/app/ranking/page.tsx");
    const head = f.commit();
    expect(
      classifyVisualImpact({ event: "pull_request", base: f.base, head, cwd: f.cwd }),
    ).toMatchObject({ mode: "focused", routes: ["/app/ranking"] });
  });

  it("classifies the exact before/head range on main pushes", () => {
    const f = fixture();
    f.put("public/canvas/app.js");
    const head = f.commit();
    expect(classifyVisualImpact({ event: "push", base: f.base, head, cwd: f.cwd })).toMatchObject({
      mode: "none",
      routes: [],
    });
  });

  it("includes removals and both sides of renames in the complete impact", () => {
    const f = fixture();
    const file = "app/(protected)/app/etapas/_components/AppointmentsDashboard.module.css";
    f.put(file);
    const previous = f.commit();
    f.git("rm", file);
    const deleted = f.commit();
    expect(
      classifyVisualImpact({ event: "push", base: previous, head: deleted, cwd: f.cwd }),
    ).toMatchObject({ mode: "focused", routes: ["/app/etapas/agendamentos"] });
    f.put(file);
    const restored = f.commit();
    f.git("mv", file, "unknown-component.css");
    expect(
      classifyVisualImpact({ event: "pull_request", base: restored, head: f.commit(), cwd: f.cwd }),
    ).toMatchObject({ mode: "full", reason: "unmapped:unknown-component.css" });
  }, 15_000);

  it("forces a complete matrix for scheduled, manual or invalid revisions", () => {
    expect(classifyVisualImpact({ event: "schedule" })).toMatchObject({ mode: "full" });
    expect(classifyVisualImpact({ event: "workflow_dispatch" })).toMatchObject({ mode: "full" });
    expect(classifyVisualImpact({ event: "push", base: "missing", head: "missing" })).toMatchObject(
      { mode: "full" },
    );
  });
});

describe("isolated appointments projection benchmark impact", () => {
  it.each([
    "supabase/migrations/20261025180000_appointments_funnels_regional_filter.sql",
    "supabase/migrations/20261102131119_appointments_projection_sets.sql",
    "supabase/tests/appointments_projection_sets.test.sql",
    "tests/appointments-analysis.test.ts",
    "scripts/qa/appointments-projection-benchmark.mjs",
    "scripts/qa/appointments-projection-benchmark.node-test.mjs",
    "lib/crm/dashboard/analysis-contract.ts",
    "supabase/config.toml",
    "scripts/ci/visual-impact-scope.mjs",
    "scripts/ci/appointments-projection-scope.mjs",
    ".github/workflows/ci.yml",
    "package.json",
    "pnpm-lock.yaml",
  ])("requires the SQL benchmark for direct dependency %s", (file) => {
    expect(classifyAppointmentsProjectionPaths([file])).toEqual({
      required: true,
      reason: "direct-projection-dependency",
      dependencies: [file],
    });
  });

  it("does not turn a full visual shell/CSS scope into an unrelated SQL benchmark", () => {
    const files = ["app/(protected)/_components/ProtectedShell.module.css", "WORKLOG.md"];
    expect(classifyVisualPaths(files).mode).toBe("full");
    expect(classifyAppointmentsProjectionPaths(files)).toEqual({
      required: false,
      reason: "outside-projection-dependencies",
      dependencies: [],
    });
    expect(
      classifyAppointmentsProjectionPaths([
        "app/(protected)/app/etapas/_components/AppointmentsDashboard.module.css",
        "lib/crm/repasse/data.ts",
        "docs/audits/handoff-integrado-2026-11-02.md",
      ]).required,
    ).toBe(false);
  });

  it("fails closed for unknown paths, empty diffs, malformed snapshots and missing history", () => {
    expect(classifyAppointmentsProjectionPaths(["unknown/runtime.ts"])).toMatchObject({
      required: true,
      reason: "unmapped-dependency",
    });
    expect(classifyAppointmentsProjectionPaths([]).required).toBe(true);
    expect(
      classifyAppointmentsProjectionImpact({ event: "push", base: "missing", head: "missing" })
        .required,
    ).toBe(true);
    expect(
      classifyAppointmentsProjectionImpact({
        event: "push",
        base: "0".repeat(40),
        head: "1".repeat(40),
        cwd: path.join(tmpdir(), "absent-projection-scope-checkout"),
      }).required,
    ).toBe(true);
    expect(classifyAppointmentsProjectionImpact({ rawDiff: "not-json" })).toMatchObject({
      required: true,
      reason: "invalid-shared-diff",
    });
  });

  it("reuses the visual classifier's complete diff without another Git read", () => {
    const f = fixture();
    const dependency = "supabase/migrations/20261102131119_appointments_projection_sets.sql";
    f.put(dependency);
    f.commit();
    f.put("app/page.css");
    const head = f.commit();
    const options = { event: "pull_request", base: f.base, head, cwd: f.cwd };
    const diff = visualScope.readCandidateDiff(options);
    expect(diff.paths).toContain(dependency);
    const invalidCwd = path.join(f.cwd, "missing-checkout");
    expect(
      classifyAppointmentsProjectionImpact({
        ...options,
        cwd: invalidCwd,
        rawDiff: JSON.stringify(diff),
      }),
    ).toMatchObject({
      required: true,
      reason: "direct-projection-dependency",
      dependencies: [dependency],
    });
    expect(
      classifyAppointmentsProjectionImpact({
        ...options,
        head: f.base,
        rawDiff: JSON.stringify(diff),
      }),
    ).toMatchObject({ required: true, reason: "invalid-shared-diff" });
  }, 15_000);

  it("keeps benchmark opt-in independent of visual mode and uploads sanitized evidence", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain(
      "CI_CANDIDATE_DIFF: ${{ steps.visual_scope.outputs.candidate_diff }}",
    );
    expect(workflow).toContain(
      "if: needs.validate.outputs.appointments_projection_required != 'false'",
    );
    expect(workflow).toContain('CRM_APPOINTMENTS_BENCHMARK_ISOLATED: "true"');
    expect(workflow).toContain(
      "node --test scripts/qa/appointments-projection-benchmark.node-test.mjs",
    );
    expect(workflow).toContain("test-results/appointments-projection");
    expect(workflow.indexOf("- name: Database tests")).toBeLessThan(
      workflow.indexOf("- name: Compare appointments SQL projections"),
    );
  });
});
