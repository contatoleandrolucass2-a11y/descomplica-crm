import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error Standalone CI module runs directly with Node.
import * as visualScope from "../scripts/ci/visual-impact-scope.mjs";

const { authenticatedVisualRoutes, classifyVisualImpact, classifyVisualPaths } = visualScope;

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
