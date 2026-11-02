import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readCandidateDiff } from "./visual-impact-scope.mjs";

// This is the isolated SQL harness's dependency set, not a second visual plan.
// A full visual matrix caused by a shell/CSS change does not require SQL timing.
const directDependency =
  /^(?:supabase\/migrations\/[^/]*appointments[^/]*\.sql$|supabase\/tests\/appointments[^/]*\.sql$|tests\/appointments[^/]*\.(?:ts|tsx)$|scripts\/qa\/appointments-projection-benchmark(?:\.node-test)?\.mjs$|lib\/crm\/dashboard\/analysis-contract\.ts$|supabase\/config\.toml$|scripts\/ci\/[^/]+\.mjs$|tests\/ci-[^/]*\.test\.ts$|\.github\/workflows\/ci\.yml$|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|\.nvmrc$)/;
const unrelatedDependency =
  /^(?:app\/|lib\/|public\/|docs\/|conhecimento\/|e2e\/|tests\/|ops\/|scripts\/(?:qa|release|knowledge|pages|homologation)\/|\.github\/(?:workflows|ISSUE_TEMPLATE)\/|(?:AGENTS|README|WORKLOG|CHANGELOG|MIGRATION_PLAN)\.md$)/;

export function classifyAppointmentsProjectionPaths(paths) {
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.some((file) => typeof file !== "string" || !file)
  ) {
    return { required: true, reason: "empty-or-invalid-diff", dependencies: [] };
  }
  const direct = paths.filter((file) => directDependency.test(file));
  const unknown = paths.filter(
    (file) => !directDependency.test(file) && !unrelatedDependency.test(file),
  );
  if (direct.length)
    return { required: true, reason: "direct-projection-dependency", dependencies: direct };
  if (unknown.length)
    return { required: true, reason: "unmapped-dependency", dependencies: unknown };
  return { required: false, reason: "outside-projection-dependencies", dependencies: [] };
}

export function classifyIsolatedSqlImpact(options, classifyPaths) {
  let diff;
  if (options.rawDiff !== undefined) {
    try {
      diff = JSON.parse(options.rawDiff);
      if (
        !diff ||
        diff.event !== (options.event ?? null) ||
        diff.base !== (options.base ?? null) ||
        diff.head !== (options.head ?? null) ||
        !["ready", "unavailable"].includes(diff.status) ||
        (diff.status === "ready" &&
          (!["pull_request", "push"].includes(diff.event) ||
            !/^[a-f0-9]{40}$/u.test(diff.base ?? "") ||
            !/^[a-f0-9]{40}$/u.test(diff.head ?? "")))
      )
        throw new Error("Invalid candidate diff snapshot");
    } catch {
      return { required: true, reason: "invalid-shared-diff", dependencies: [] };
    }
  } else diff = readCandidateDiff(options);
  if (diff.status !== "ready") {
    const cause = ["missing-revision", "git-error"].includes(diff.reason)
      ? diff.reason
      : ["schedule", "workflow_dispatch"].includes(options.event)
        ? `event-${options.event}`
        : "unavailable";
    return { required: true, reason: `candidate-diff-${cause}`, dependencies: [] };
  }
  return classifyPaths(diff.paths);
}

export function classifyAppointmentsProjectionImpact(options) {
  return classifyIsolatedSqlImpact(options, classifyAppointmentsProjectionPaths);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = classifyAppointmentsProjectionImpact({
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
  console.log(JSON.stringify({ check: "appointments-projection-benchmark", ...result }));
}
