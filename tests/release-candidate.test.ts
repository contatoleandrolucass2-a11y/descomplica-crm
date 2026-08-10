import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const markerNames = [
  "20260808235856_grant_imob_ranking_service_role.sql",
  "20260809004414_add_atomic_imob_ranking_publish_rpc.sql",
  "20260809010942_restrict_imob_ranking_rpc_roles.sql",
  "20260809031936_qlik_ranking_developments.sql",
];

describe("release-candidate migration train", () => {
  it("keeps a unique, ordered 26-version manifest", async () => {
    const migrations = (await readdir(path.join(repositoryRoot, "supabase/migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(migrations).toHaveLength(26);
    expect(new Set(migrations.map((name) => name.slice(0, 14))).size).toBe(26);
    expect(migrations).toEqual([...migrations].sort());
    expect(migrations).toEqual(expect.arrayContaining(markerNames));
  });

  it.each(markerNames)("keeps %s as a sanitized executable no-op", async (name) => {
    const sql = await readFile(path.join(repositoryRoot, "supabase/migrations", name), "utf8");
    const executable = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    expect(executable).toBe("do $historical_marker$ begin null; end $historical_marker$;");
  });
});

describe("release-candidate activation defaults", () => {
  it("ships all new runtime capabilities off and without credentials", async () => {
    const example = await readFile(
      path.join(repositoryRoot, "deploy/production.env.example"),
      "utf8",
    );
    expect(example).toContain("CRM_READ_MODEL_V3_SHADOW_ENABLED=false");
    expect(example).toContain("QLIK_RELAY_MODE=off");
    expect(example).toContain("QLIK_RELAY_WRITE_ENABLED=false");
    expect(example).toContain("QLIK_RELAY_KEY_ID=\n");
    expect(example).toContain("QLIK_RELAY_HMAC_SECRET=\n");
    expect(example).toContain("QLIK_RELAY_DATABASE_URL=\n");
    expect(example).toContain("COMMERCIAL_ENGINE_RUNTIME_MODE=off");
    expect(example).toContain("COMMERCIAL_ENGINE_ENABLED_KEYS=\n");
    expect(example).toContain("COMMERCIAL_ENGINE_DATABASE_URL=\n");
  });

  it("keeps CI and runbooks wired to local release gates", async () => {
    const [workflow, runbook, approvals, compose] = await Promise.all([
      readFile(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/release-candidate/RELEASE_RUNBOOK.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/release-candidate/APPROVAL_PACKAGE.md"), "utf8"),
      readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
    ]);
    expect(workflow).toContain("pnpm format:check");
    expect(workflow).toContain("pnpm qa:e2e:release");
    expect(workflow).toContain("pnpm qa:visual:authenticated");
    expect(workflow).toContain("pnpm db:rehearse");
    expect(runbook).toContain("#26 → #27 → #28 → #29 → #30 → #31 → release candidate");
    expect(runbook).toContain("Nunca usar `migration repair`");
    expect(approvals).toContain("Ausência de qualquer autorização significa **não executar**");
    const runtimeEnvironment = compose.match(/\n    environment:\n((?:      .*\n)+)/)?.[1];
    expect(runtimeEnvironment).toBeDefined();
    expect(runtimeEnvironment).toContain("DEPLOYMENT_VERSION: ${IMAGE_TAG:?IMAGE_TAG is required}");
  });
});
