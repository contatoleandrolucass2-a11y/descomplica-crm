import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const revision = /^[a-f0-9]{40}$/;
const sourceDependency =
  /^(?:lib\/archive-investor\/|scripts\/verify-documentation-sources\.mjs$|tests\/(?:documentation-sources|associative-documentation-parity)\.test\.ts$|docs\/runbooks\/documentation-fees-sp\.md$|package\.json$|pnpm-lock\.yaml$)/;

export function documentationSourceVerificationRequired({
  event,
  base,
  head,
  cwd = process.cwd(),
}) {
  if (
    !["pull_request", "push"].includes(event) ||
    !revision.test(base ?? "") ||
    !revision.test(head ?? "")
  )
    return true;
  try {
    const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
    const diffBase = event === "pull_request" ? git(["merge-base", base, head]).trim() : base;
    const paths = git(["diff", "--name-only", "--no-renames", "-z", diffBase, head])
      .split("\0")
      .filter(Boolean);
    return paths.length === 0 || paths.some((file) => sourceDependency.test(file));
  } catch {
    return true;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const required = documentationSourceVerificationRequired({
    event: process.env.GITHUB_EVENT_NAME,
    base:
      process.env.GITHUB_EVENT_NAME === "pull_request"
        ? process.env.PR_BASE_SHA
        : process.env.PUSH_BASE_SHA,
    head: process.env.PR_HEAD_SHA || process.env.GITHUB_SHA,
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(process.env.GITHUB_OUTPUT, `required=${required}\n`);
  console.log(`Documentation fee source verification: ${required ? "required" : "outside-impact"}`);
}
