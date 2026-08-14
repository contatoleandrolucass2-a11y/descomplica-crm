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
  it("keeps a unique, ordered 32-version manifest", async () => {
    const migrations = (await readdir(path.join(repositoryRoot, "supabase/migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(migrations).toHaveLength(32);
    expect(new Set(migrations.map((name) => name.slice(0, 14))).size).toBe(32);
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
    const [workflow, runbook, approvals, compose, visualHarness] = await Promise.all([
      readFile(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/release-candidate/RELEASE_RUNBOOK.md"), "utf8"),
      readFile(path.join(repositoryRoot, "docs/release-candidate/APPROVAL_PACKAGE.md"), "utf8"),
      readFile(path.join(repositoryRoot, "compose.yaml"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/qa/authenticated-visual.mjs"), "utf8"),
    ]);
    expect(workflow).toContain("pnpm format:check");
    expect(workflow).toContain("pnpm qa:e2e:release");
    expect(workflow).toContain("pnpm qa:visual:authenticated");
    expect(workflow).toContain("pnpm db:rehearse");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("raw CLI output was withheld");
    expect(runbook).toContain("#26 → #27 → #28 → #29 → #30 → #31 → #32 → #33 → novo incremento");
    expect(runbook).toContain("Nunca usar `migration repair`");
    expect(approvals).toContain("Ausência de qualquer resposta ou autorização mantém o gate");
    const runtimeEnvironment = compose.match(/\n    environment:\n((?:      .*\n)+)/)?.[1];
    expect(runtimeEnvironment).toBeDefined();
    expect(runtimeEnvironment).toContain("DEPLOYMENT_VERSION: ${IMAGE_TAG:?IMAGE_TAG is required}");
    expect(visualHarness).toContain(
      'const artifactRoot = path.join(repositoryRoot, "test-results/authenticated-visual")',
    );
    expect(visualHarness).toContain("function baselineMatchesHead()");
    expect(visualHarness).toContain('argv[0] === "--update-baseline"');
  });
});

describe("representative production restore evidence", () => {
  it("records the read-only restore, future train and clean rollback", async () => {
    const evidence = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "docs/release-candidate/production-restore-results.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(evidence).toMatchObject({
      remoteMutation: false,
      representativeRemoteRestore: true,
      remoteCurrent: {
        restore: "passed",
        migrationHistoryEntries: 17,
        lastMigration: "20260809031936",
      },
      futureSequenceResult: "passed",
      rollback: {
        result: "passed",
        remoteSchemaPresent: true,
        remoteDataLoaded: true,
        futureObjectsAbsent: true,
      },
      cleanup: {
        containerRemoved: true,
        plaintextShredded: true,
        encryptedBackupPreserved: true,
      },
      authorization: {
        remoteMigration: false,
        cutover: false,
        productionDeploy: false,
      },
    });
    expect(evidence.futureSequence).toHaveLength(10);
  });
});

describe("isolated restore evidence", () => {
  it("proves a clean local cross-cluster restore without authorizing remote work", async () => {
    const evidence = JSON.parse(
      await readFile(
        path.join(repositoryRoot, "docs/release-candidate/isolated-restore-results.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(evidence).toMatchObject({
      schemaVersion: 2,
      remoteMutation: false,
      representativeRemoteRestore: false,
      remoteMigrationHistoryRehearsed: false,
      cutoverAuthorized: false,
      dockerTransport: "local-unix",
      independentSourceAndTargetProjects: true,
      independentSourceAndTargetContainers: true,
      worktreeDirtyAtRehearsal: false,
      migrationCount: 27,
      pgTapFiles: 18,
      pgTapTests: 885,
      sourceValidation: {
        pgTapTests: 885,
        databaseLint: "passed",
        securityAdvisors: "passed",
        performanceAdvisors: "passed",
      },
      restoredValidation: {
        pgTapTests: 885,
        databaseLint: "passed",
        securityAdvisors: "passed",
        performanceAdvisors: "passed",
      },
      reset: "passed",
      logicalBackup: "passed",
      logicalRestore: "passed",
      ownersPreserved: true,
      effectivePrivilegesPreserved: true,
      aclFingerprintMode: "effective-privileges-owner-implicit-grantor-independent",
      aclGrantorsCompared: false,
      targetAclMutationApplied: false,
      fingerprintMatch: true,
      sourcePostValidationNonSequenceFingerprintMatch: true,
      postValidationNonSequenceFingerprintMatch: true,
      objectCounts: {
        roles: 2,
        tables: 57,
        schemas: 4,
        policies: 25,
        functions: 88,
        relations: 62,
        sequences: 5,
      },
      failClosed: {
        relay_gates: 0,
        relay_role_safe: true,
        commercial_gates: 0,
        relay_credentials: 0,
        commercial_policies: 0,
        mapping_authorities: 0,
        commercial_role_safe: true,
        commercial_executions: 0,
      },
    });

    for (const key of [
      "captureCommit",
      "worktreeFingerprint",
      "migrationManifestSha256",
      "logicalBackupSha256",
      "canonicalFingerprintSha256",
    ]) {
      expect(evidence[key]).toMatch(key === "captureCommit" ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/);
    }
    expect(evidence.logicalBackupBytes).toEqual(expect.any(Number));
    expect(evidence.logicalBackupBytes).toBeGreaterThan(0);
    expect(Object.values(evidence.componentSha256 as Record<string, string>)).not.toHaveLength(0);
    expect(
      Object.values(evidence.componentSha256 as Record<string, string>).every((hash) =>
        /^[a-f0-9]{64}$/.test(hash),
      ),
    ).toBe(true);
  });
});
