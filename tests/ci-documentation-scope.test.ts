import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error The standalone CI script runs directly with Node.
import { classifyDocumentationScope } from "../scripts/ci/documentation-scope.mjs";
// @ts-expect-error The standalone CI script runs directly with Node.
import { documentationSourceVerificationRequired } from "../scripts/ci/documentation-source-scope.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), "crm-ci-scope-"));
  roots.push(cwd);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.name", "CI fixture");
  git("config", "user.email", "ci@example.invalid");
  git("config", "core.autocrlf", "false");
  git("config", "core.hooksPath", path.join(cwd, "no-hooks"));
  const put = (file: string, text = "# Fixture\n") => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), text);
  };
  const commit = () => {
    git("add", "--all");
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  put("WORKLOG.md");
  put("app/runtime.ts", "export const value = 1;\n");
  const base = commit();
  const classify = (head: string, event = "pull_request") =>
    classifyDocumentationScope({ cwd, base, head, event });
  return { cwd, git, put, commit, base, classify };
}

describe("documentation-only CI selection", () => {
  it("accepts only the curated Markdown allowlist on PRs", () => {
    const f = fixture();
    f.put("docs/knowledge/ATUALIZACOES.md");
    f.put("CHANGELOG.md");
    expect(f.classify(f.commit())).toBe(true);
  });

  it("classifies the complete push range as documentation without making it deployable", () => {
    const f = fixture();
    f.put("WORKLOG.md", "# New note\n");
    const head = f.commit();
    expect(f.classify(head, "push")).toBe(true);
    expect(f.classify(head, "workflow_dispatch")).toBe(false);
  });

  it.each([
    "AGENTS.md",
    ".github/workflows/ci.yml",
    "pnpm-lock.yaml",
    "docs/runbooks/security.md",
    "docs/knowledge/recursos.json",
    "docs/knowledge/nested/example.md",
  ])("requires full validation for %s", (file) => {
    const f = fixture();
    f.put(file);
    expect(f.classify(f.commit())).toBe(false);
  });

  it("includes earlier runtime changes even if the final commit is prose", () => {
    const f = fixture();
    f.put("app/runtime.ts", "export const value = 2;\n");
    f.commit();
    f.put("WORKLOG.md", "# Release note\n");
    const head = f.commit();
    expect(f.classify(head)).toBe(false);
    expect(f.classify(head, "push")).toBe(false);
  });

  it("rejects renamed runtime files and deletions outside the allowlist", () => {
    const f = fixture();
    f.git("mv", "app/runtime.ts", "CHANGELOG.md");
    expect(f.classify(f.commit())).toBe(false);
  });

  it("rejects symlink modes even when the filename ends with Markdown", () => {
    const f = fixture();
    f.put("CHANGELOG.md", "app/runtime.ts");
    const blob = f.git("hash-object", "-w", "CHANGELOG.md");
    f.git("update-index", "--add", "--cacheinfo", `120000,${blob},CHANGELOG.md`);
    f.git("commit", "--quiet", "-m", "symlink");
    expect(f.classify(f.git("rev-parse", "HEAD"))).toBe(false);
  });

  it("fails closed with no changes or missing revisions", () => {
    const f = fixture();
    expect(f.classify(f.base)).toBe(false);
    expect(f.classify("missing")).toBe(false);
    expect(f.classify("0".repeat(40))).toBe(false);
  });

  it("verifies official sources for an earlier dependency change followed by prose", () => {
    const f = fixture();
    f.put("lib/archive-investor/official-fees.ts", "export const fixture = 1;\n");
    f.commit();
    f.put("WORKLOG.md", "# Source change recorded\n");
    const head = f.commit();
    for (const event of ["pull_request", "push"]) {
      expect(
        documentationSourceVerificationRequired({ cwd: f.cwd, base: f.base, head, event }),
      ).toBe(true);
    }
    expect(documentationSourceVerificationRequired({ event: "schedule" })).toBe(true);
    expect(documentationSourceVerificationRequired({ event: "push", base: "missing", head })).toBe(
      true,
    );
  });

  it("does not fetch official fee sources for an unrelated complete candidate", () => {
    const f = fixture();
    f.put("WORKLOG.md", "# Documentation-only note\n");
    expect(
      documentationSourceVerificationRequired({
        cwd: f.cwd,
        base: f.base,
        head: f.commit(),
        event: "push",
      }),
    ).toBe(false);
  });

  it("preserves full production jobs and declares scope output in the workflow", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain("PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
    expect(workflow).toContain("PUSH_BASE_SHA: ${{ github.event.before }}");
    for (const name of ["release-gates", "isolated-restore", "promotable-image"]) {
      expect(workflow).toContain(
        `  ${name}:\n    if: needs.validate.outputs.documentation_only != 'true'`,
      );
    }
    for (const name of ["isolated-restore", "promotable-image"]) {
      const job = workflow.split(`  ${name}:`)[1]!.split("    needs:")[0]!;
      expect(job).toContain(
        "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'",
      );
    }
  });
});
