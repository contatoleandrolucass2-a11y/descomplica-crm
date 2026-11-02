import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const documentationPath = /^(?:CHANGELOG\.md|WORKLOG\.md|docs\/knowledge\/[A-Za-z0-9_-]+\.md)$/;
const revision = /^[a-f0-9]{40}$/;

export function classifyDocumentationScope({ event, base, head, cwd = process.cwd() }) {
  // Documentation main commits are deliberately not deployable application
  // candidates: the release policy continues to require all four successful jobs.
  if (
    !["pull_request", "push"].includes(event) ||
    !revision.test(base ?? "") ||
    !revision.test(head ?? "")
  ) {
    return false;
  }
  try {
    const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
    // Evaluate the entire PR, not only the last commit; renames expose both paths.
    const mergeBase = event === "pull_request" ? git(["merge-base", base, head]).trim() : base;
    const paths = git(["diff", "--name-only", "--no-renames", "-z", mergeBase, head])
      .split("\0")
      .filter(Boolean);
    if (!paths.length || paths.some((file) => !documentationPath.test(file))) return false;
    // Markdown symlinks/submodules are not prose: reject type changes in either tree.
    for (const ref of [mergeBase, head]) {
      const entries = git(["ls-tree", "-z", ref, "--", ...paths])
        .split("\0")
        .filter(Boolean);
      if (entries.some((entry) => !entry.startsWith("100644 blob "))) return false;
    }
    return true;
  } catch {
    // Missing history, malformed input or git errors select full validation.
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const documentationOnly = classifyDocumentationScope({
    event: process.env.GITHUB_EVENT_NAME,
    base:
      process.env.GITHUB_EVENT_NAME === "pull_request"
        ? process.env.PR_BASE_SHA
        : process.env.PUSH_BASE_SHA,
    head: process.env.PR_HEAD_SHA || process.env.GITHUB_SHA,
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(process.env.GITHUB_OUTPUT, `documentation_only=${documentationOnly}\n`);
  console.log(
    documentationOnly
      ? "Documentation-only change: targeted validation; not an application release candidate."
      : "Full validation required.",
  );
}
