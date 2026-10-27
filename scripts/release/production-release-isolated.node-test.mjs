import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readCandidateApproval } from "./production-release-host.mjs";
import { verifyCandidateAncestry } from "./production-release-ancestry.mjs";

const branch = "codex/release-tabelao-drive-links";
const target = "b".repeat(40);

function source(overrides = {}) {
  const reads = [];
  const readJson = async (address) => {
    const url = new URL(address);
    reads.push(url);
    assert.ok(url.searchParams.get("release_check"));
    if (url.pathname.endsWith("/commits/main")) return { sha: "a".repeat(40) };
    if (url.pathname.endsWith(`/git/ref/heads/${branch}`))
      return (
        overrides.branch ?? { ref: `refs/heads/${branch}`, object: { type: "commit", sha: target } }
      );
    if (url.pathname.endsWith("/actions/runs/123"))
      return overrides.run ?? { path: ".github/workflows/ci.yml", run_attempt: 2 };
    if (url.pathname.endsWith("/actions/runs/123/attempts/2/jobs"))
      return overrides.jobs ?? { total_count: 0, jobs: [] };
    throw new Error("Unexpected request");
  };
  return { reads, readJson };
}

test("isolated approval reads main and the exact branch with fresh current-attempt CI evidence", async () => {
  const fixture = source();
  const result = await readCandidateApproval(123, branch, fixture.readJson);
  assert.equal(result.branchSha, target);
  assert.equal(result.branchRef, `refs/heads/${branch}`);
  assert.equal(result.mainSha, "a".repeat(40));
  assert.equal(fixture.reads.length, 4);
  const firstNonce = fixture.reads[0].searchParams.get("release_check");
  await readCandidateApproval(123, branch, fixture.readJson);
  assert.notEqual(fixture.reads[4].searchParams.get("release_check"), firstNonce);
});

test("remote source errors, tags, different refs, workflows and incomplete job pages fail closed", async () => {
  for (const overrides of [
    { branch: { ref: `refs/tags/${branch}`, object: { type: "commit", sha: target } } },
    { branch: { ref: `refs/heads/${branch}`, object: { type: "tag", sha: target } } },
    { run: { path: ".github/workflows/other.yml", run_attempt: 2 } },
    { jobs: { total_count: 101, jobs: [] } },
  ]) {
    await assert.rejects(readCandidateApproval(123, branch, source(overrides).readJson));
  }
  await assert.rejects(
    readCandidateApproval(123, branch, async () => {
      throw new Error("unavailable");
    }),
    /unavailable/u,
  );
  await assert.rejects(
    readCandidateApproval(123, "codex/release-a?x=1", async () => assert.fail("must not fetch")),
  );
});

test("ancestry rejects a sibling release that would omit a newly published commit", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "release-ancestry-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    git("init");
    git("config", "user.name", "Release test");
    git("config", "user.email", "qa@local.invalid");
    await writeFile(path.join(directory, "fixture"), "base\n");
    git("add", ".");
    git("commit", "-m", "Base");
    const base = git("rev-parse", "HEAD");
    git("checkout", "-b", "isolated");
    await writeFile(path.join(directory, "fixture"), "isolated\n");
    git("commit", "-am", "Isolated");
    const published = git("rev-parse", "HEAD");
    git("checkout", "-b", "sibling", base);
    await writeFile(path.join(directory, "other"), "other\n");
    git("add", ".");
    git("commit", "-m", "Other");
    const sibling = git("rev-parse", "HEAD");
    await verifyCandidateAncestry(directory, base, published);
    await assert.rejects(
      verifyCandidateAncestry(directory, published, sibling),
      /reconcile production/u,
    );
    git("merge", "isolated", "--no-edit");
    await verifyCandidateAncestry(directory, published, git("rev-parse", "HEAD"));
    await assert.rejects(verifyCandidateAncestry(directory, "HEAD", target), /exact commit SHAs/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release branches execute the same three production jobs after validate", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /- "codex\/release-\*"/u);
  const expression =
    "if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/codex/release-'))";
  assert.equal(workflow.split(expression).length - 1, 3);
  for (const job of ["release-gates", "isolated-restore", "promotable-image"]) {
    assert.ok(workflow.includes(`  ${job}:\n    ${expression}\n    needs: validate`));
  }
});
