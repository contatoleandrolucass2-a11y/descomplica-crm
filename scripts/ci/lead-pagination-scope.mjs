import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { classifyIsolatedSqlImpact } from "./appointments-projection-scope.mjs";

const direct =
  /^(?:lib\/crm\/lead-plus\/server\/|lib\/crm\/lead-plus\/client\/(?:ConnectedCRM\.tsx|api\.ts|useLeadList\.ts)$|tests\/lead-plus-(?:pagination|read-scope)[^/]*\.(?:ts|mjs)$|scripts\/ci\/[^/]+\.mjs$|tests\/ci-[^/]*\.test\.ts$|lib\/(?:auth|authorization)\/|supabase\/config\.toml$|\.github\/workflows\/ci\.yml$|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|\.nvmrc$)/;
const unrelated =
  /^(?:app\/|lib\/|public\/|docs\/|conhecimento\/|e2e\/|tests\/|ops\/|supabase\/(?:migrations|tests)\/|scripts\/(?:qa|release|knowledge|pages|homologation)\/|\.github\/(?:workflows|ISSUE_TEMPLATE)\/|(?:AGENTS|README|WORKLOG|CHANGELOG|MIGRATION_PLAN)\.md$)/;

export function classifyLeadPaginationPaths(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.some((p) => typeof p !== "string" || !p))
    return { required: true, reason: "empty-or-invalid-diff", dependencies: [] };
  const dependencies = paths.filter((p) => direct.test(p));
  if (dependencies.length)
    return { required: true, reason: "direct-lead-pagination-dependency", dependencies };
  const unknown = paths.filter((p) => !unrelated.test(p));
  return unknown.length
    ? { required: true, reason: "unmapped-dependency", dependencies: unknown }
    : { required: false, reason: "outside-lead-pagination-dependencies", dependencies: [] };
}

export function classifyLeadPaginationImpact(options) {
  return classifyIsolatedSqlImpact(options, classifyLeadPaginationPaths);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = classifyLeadPaginationImpact({
    event: process.env.GITHUB_EVENT_NAME,
    base:
      process.env.GITHUB_EVENT_NAME === "pull_request"
        ? process.env.PR_BASE_SHA
        : process.env.PUSH_BASE_SHA,
    head: process.env.PR_HEAD_SHA || process.env.GITHUB_SHA,
    rawDiff: process.env.CI_CANDIDATE_DIFF,
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `required=${result.required}\nreason=${result.reason}\ndependencies=${JSON.stringify(result.dependencies)}\n`,
  );
  console.log(JSON.stringify({ check: "lead-pagination-postgres", ...result }));
}
