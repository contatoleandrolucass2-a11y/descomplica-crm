import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseRetirementArguments } from "../scripts/homologation/apply-legacy-canary-retirement.mjs";
import {
  buildRetirementApplicationSql,
  buildRetirementPostconditionsSql,
  buildRetirementPreconditionsSql,
  loadRetirementCandidate,
  requiresRetirementRuntimeShutdown,
  validateRetirementAllowlist,
  validateRetirementBackupProof,
  validateRetirementHistory,
  validateRetirementRuntimeEnvironment,
  validateStoppedRetirementAppInspection,
} from "../scripts/homologation/legacy-canary-retirement-lib.mjs";
import type {
  RetirementAllowlist,
  RetirementHistoryRow,
} from "../scripts/homologation/legacy-canary-retirement-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/legacy-canary-retirement-allowlist.json",
);

async function loadRawManifest() {
  return JSON.parse(await readFile(allowlistPath, "utf8"));
}

async function loadManifest() {
  return validateRetirementAllowlist(await loadRawManifest());
}

function exactHistory(manifest: RetirementAllowlist, includeCandidate = false) {
  const pinned = new Map(manifest.pinnedHistory.map((migration) => [migration.version, migration]));
  const rows: RetirementHistoryRow[] = manifest.baselineVersions.map((version) => {
    const migration = pinned.get(version);
    return migration
      ? {
          version,
          name: migration.name,
          statement_count: migration.statementCount,
          sha256: migration.sha256,
        }
      : { version };
  });
  if (includeCandidate) {
    rows.push({
      version: manifest.candidate.version,
      name: manifest.candidate.name,
      statement_count: 1,
      sha256: manifest.candidate.sha256,
    });
  }
  return rows;
}

describe("homologation legacy canary retirement gate", () => {
  it("pins the exact 32-migration canary state and the 20260926 roll-forward", async () => {
    const manifest = await loadManifest();
    expect(manifest.productionEligible).toBe(false);
    expect(manifest.baselineVersions).toHaveLength(32);
    expect(manifest.pinnedHistory).toEqual([
      {
        version: "20260824230058",
        name: "auth_mfa_legal_foundation",
        statementCount: 1,
        sha256: "b601be966e6213778def6d9704117feeb45ee129fca5c01f7e16e67ba5c5c164",
      },
      {
        version: "20260824230100",
        name: "role_isolation_net_fail_closed",
        statementCount: 1,
        sha256: "dfbe850624b5b9448970812cc5bf28d8a2a2f971442154f41a10544ccd43af1b",
      },
      {
        version: "20260828135947",
        name: "legacy_simulators_discador_master_canary",
        statementCount: 1,
        sha256: "e754814a5348b6ef4b805bc20fd3da1866f4724924d24473017c9cf1ae31bde6",
      },
    ]);
    expect(manifest.candidate.version).toBe("20260926120000");

    const candidate = await loadRetirementCandidate(repositoryRoot, manifest);
    try {
      expect(candidate.sha256).toBe(manifest.candidate.sha256);
      expect(
        path.join(repositoryRoot, "deploy/homologation/migrations", candidate.file),
      ).not.toContain("supabase/migrations");
    } finally {
      candidate.contents.fill(0);
    }
  });

  it("rejects production history, drift, partial application, and predecessor hash changes", async () => {
    const manifest = await loadManifest();
    const baseline = exactHistory(manifest);
    expect(validateRetirementHistory(manifest, "dry-run", baseline)).toEqual({
      historyCount: 32,
      pendingVersions: [manifest.candidate.version],
    });

    expect(() => validateRetirementHistory(manifest, "dry-run", baseline.slice(0, -1))).toThrow(
      /exact canary retirement gate/u,
    );
    expect(() =>
      validateRetirementHistory(manifest, "dry-run", [
        ...baseline,
        { version: manifest.candidate.version },
      ]),
    ).toThrow(/exact canary retirement gate/u);
    expect(() =>
      validateRetirementHistory(manifest, "dry-run", [...baseline, { version: "20260927000000" }]),
    ).toThrow(/exact canary retirement gate/u);

    const changedHash = exactHistory(manifest);
    changedHash.at(-1)!.sha256 = "0".repeat(64);
    expect(() => validateRetirementHistory(manifest, "apply", changedHash)).toThrow(
      /Hash-pinned predecessor mismatch/u,
    );
  });

  it("accepts only a hash-pinned 33-migration verified result", async () => {
    const manifest = await loadManifest();
    const applied = exactHistory(manifest, true);
    expect(validateRetirementHistory(manifest, "verify", applied)).toEqual({
      historyCount: 33,
      pendingVersions: [],
    });
    applied.at(-1)!.statement_count = 2;
    expect(() => validateRetirementHistory(manifest, "verify", applied)).toThrow(
      /candidate history hash/u,
    );
  });

  it("fails closed when allowlist scope, date, counts, or predecessor pins change", async () => {
    const raw = await loadRawManifest();
    expect(() => validateRetirementAllowlist({ ...raw, productionEligible: true })).toThrow(
      /allowlist is invalid/u,
    );
    expect(() => validateRetirementAllowlist({ ...raw, beforePageCount: 23 })).toThrow(
      /allowlist is invalid/u,
    );
    expect(() =>
      validateRetirementAllowlist({
        ...raw,
        pinnedHistory: raw.pinnedHistory.slice(1),
      }),
    ).toThrow(/incomplete or reordered/u);
    expect(() =>
      validateRetirementAllowlist({
        ...raw,
        candidate: {
          ...raw.candidate,
          version: "20260927120000",
          file: "20260927120000_retire_legacy_simulators_discador_canary.sql",
        },
      }),
    ).toThrow(/not dated 20260926/u);
  });

  it("rejects candidate tampering and extra homologation-only SQL", async () => {
    const manifest = await loadManifest();
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "legacy-retirement-"));
    const migrationRoot = path.join(temporaryRoot, "deploy/homologation/migrations");
    await mkdir(migrationRoot, { recursive: true });
    const source = path.join(
      repositoryRoot,
      "deploy/homologation/migrations",
      manifest.candidate.file,
    );
    const target = path.join(migrationRoot, manifest.candidate.file);
    try {
      await copyFile(source, target);
      await writeFile(path.join(migrationRoot, "20260926130000_unapproved.sql"), "select 1;\n");
      await expect(loadRetirementCandidate(temporaryRoot, manifest)).rejects.toThrow(
        /SQL inventory/u,
      );
      await rm(path.join(migrationRoot, "20260926130000_unapproved.sql"));
      await writeFile(target, "select 1;\n");
      await expect(loadRetirementCandidate(temporaryRoot, manifest)).rejects.toThrow(
        /candidate hash/u,
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("requires a restored 32/24 backup with the exact canary proof", async () => {
    const manifest = await loadManifest();
    const now = Date.parse("2026-09-27T00:30:00.000Z");
    const canary = manifest.pinnedHistory.at(-1)!;
    const proof = {
      schemaVersion: 1,
      environment: "isolated-homologation",
      sourceSha: "a".repeat(40),
      backupId: "20260927T000000Z-123456789abc",
      createdAt: "2026-09-27T00:00:00.000Z",
      sourceInputs: {
        allowlist: {
          file: "deploy/homologation/legacy-canary-retirement-allowlist.json",
          bytes: 2048,
          sha256: "9".repeat(64),
        },
        candidate: {
          file: `deploy/homologation/migrations/${manifest.candidate.file}`,
          bytes: 4096,
          sha256: manifest.candidate.sha256,
        },
      },
      artifacts: [
        { file: "database.dump", kind: "database", bytes: 8192, sha256: "1".repeat(64) },
        {
          file: "migration-history.sql",
          kind: "migration-history",
          bytes: 1024,
          sha256: "2".repeat(64),
        },
        {
          file: "homologation-config.tar",
          kind: "configuration",
          bytes: 4096,
          sha256: "3".repeat(64),
        },
        {
          file: "current-image.tar",
          kind: "image",
          bytes: 2 * 1024 * 1024,
          sha256: "4".repeat(64),
        },
      ],
      restore: {
        result: "passed",
        isolated: true,
        networkCount: 0,
        historyCount: 32,
        candidateCount: 0,
        pageCount: 24,
        preconditionsVerified: true,
        legacyCanary: {
          version: canary.version,
          name: canary.name,
          statementCount: 1,
          sha256: canary.sha256,
        },
        databaseArtifact: "database.dump",
        databaseSha256: "1".repeat(64),
        identityArchiveSha256: "5".repeat(64),
        identityArchiveRestored: true,
        configurationArchiveRestored: true,
        imageArchiveRestored: true,
        restoredImageId: `sha256:${"6".repeat(64)}`,
        databaseImageId: `sha256:${"a".repeat(64)}`,
        rolesPrepared: true,
        ownersAndPrivilegesRestored: true,
        sourceRoleContractSha256: "7".repeat(64),
        restoredIdentityContractSha256: "7".repeat(64),
        restoredRoleContractSha256: "7".repeat(64),
        sourceDatabaseAclSha256: "8".repeat(64),
        restoredDatabaseAclSha256: "8".repeat(64),
        testedAt: "2026-09-27T00:20:00.000Z",
      },
      rehearsal: {
        result: "passed",
        networkCount: 0,
        historyCount: 33,
        candidateCount: 1,
        pageCount: 17,
        postconditionsVerified: true,
        candidate: {
          version: manifest.candidate.version,
          name: manifest.candidate.name,
          sha256: manifest.candidate.sha256,
        },
      },
    };
    const context = {
      expectedSha: "a".repeat(40),
      expectedBackupId: proof.backupId,
      expectedAllowlistSha256: "9".repeat(64),
      manifest,
      now,
    };
    expect(validateRetirementBackupProof(proof, context).backupId).toBe(proof.backupId);
    expect(() =>
      validateRetirementBackupProof(
        { ...proof, restore: { ...proof.restore, pageCount: 17 } },
        context,
      ),
    ).toThrow(/exact legacy canary baseline/u);
    expect(() =>
      validateRetirementBackupProof(
        {
          ...proof,
          restore: {
            ...proof.restore,
            legacyCanary: { ...proof.restore.legacyCanary, sha256: "0".repeat(64) },
          },
        },
        context,
      ),
    ).toThrow(/exact legacy canary baseline/u);
    expect(() =>
      validateRetirementBackupProof({ ...proof, rehearsal: undefined }, context),
    ).toThrow(/rehearsal proof is absent or invalid/u);
  });

  it("requires both an absolute backup manifest and the exact apply confirmation", () => {
    const expectedSha = "a".repeat(40);
    expect(() => parseRetirementArguments(["apply", "--expected-sha", expectedSha])).toThrow(
      /absolute --backup-manifest/u,
    );
    expect(() =>
      parseRetirementArguments([
        "apply",
        "--expected-sha",
        expectedSha,
        "--backup-manifest",
        "/tmp/SHA256SUMS",
        "--confirm",
        "yes",
      ]),
    ).toThrow(/exact homologation-only retirement confirmation/u);
  });

  it("accepts only one exact disabled legacy runtime contract", () => {
    expect(requiresRetirementRuntimeShutdown("apply")).toBe(true);
    expect(requiresRetirementRuntimeShutdown("dry-run")).toBe(false);
    expect(requiresRetirementRuntimeShutdown("verify")).toBe(false);
    expect(() => requiresRetirementRuntimeShutdown("invalid" as never)).toThrow(
      /Unknown legacy canary retirement mode/u,
    );

    expect(
      validateRetirementRuntimeEnvironment(
        [
          "APP_ENV=homologation",
          "LEGACY_MIGRATION_RUNTIME_MODE=off",
          "LEGACY_MIGRATION_ENABLED_MODULES=",
          "# LEGACY_MIGRATION_RUNTIME_MODE=full",
          "",
        ].join("\r\n"),
      ),
    ).toEqual({ runtimeMode: "off", enabledModules: [] });

    const invalid = [
      "LEGACY_MIGRATION_ENABLED_MODULES=\n",
      "LEGACY_MIGRATION_RUNTIME_MODE=off\n",
      "LEGACY_MIGRATION_RUNTIME_MODE=full\nLEGACY_MIGRATION_ENABLED_MODULES=\n",
      "LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_ENABLED_MODULES=wf14\n",
      "LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_ENABLED_MODULES=\n",
      "LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_ENABLED_MODULES=\nLEGACY_MIGRATION_ENABLED_MODULES=\n",
      " LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_ENABLED_MODULES=\n",
      "export LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_ENABLED_MODULES=\n",
      "LEGACY_MIGRATION_RUNTIME_MODE =off\nLEGACY_MIGRATION_ENABLED_MODULES=\n",
      "LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_ENABLED_MODULES=\0\n",
    ];
    for (const contents of invalid) {
      expect(() => validateRetirementRuntimeEnvironment(contents)).toThrow();
    }
  });

  it("accepts only the exact stopped homologation application container", () => {
    const stoppedState = {
      Status: "exited",
      Running: false,
      Paused: false,
      Restarting: false,
      Dead: false,
      ExitCode: 0,
    };
    const inspection = `${JSON.stringify("/descomplica-homologation-app")}\t${JSON.stringify(
      stoppedState,
    )}\n`;
    expect(validateStoppedRetirementAppInspection(inspection)).toEqual({
      name: "/descomplica-homologation-app",
      status: "exited",
    });

    const invalid = [
      "",
      `${inspection}${inspection}`,
      `not-json\t${JSON.stringify(stoppedState)}`,
      `${JSON.stringify("/production-app")}\t${JSON.stringify(stoppedState)}`,
      `${JSON.stringify("/descomplica-homologation-app")}\t${JSON.stringify({
        ...stoppedState,
        Status: "running",
        Running: true,
      })}`,
      `${JSON.stringify("/descomplica-homologation-app")}\t${JSON.stringify({
        ...stoppedState,
        Status: "created",
      })}`,
      `${JSON.stringify("/descomplica-homologation-app")}\t${JSON.stringify({
        ...stoppedState,
        Paused: true,
      })}`,
      `${JSON.stringify("/descomplica-homologation-app")}\t${JSON.stringify({
        ...stoppedState,
        Restarting: true,
      })}`,
      `${JSON.stringify("/descomplica-homologation-app")}\t${JSON.stringify({
        ...stoppedState,
        Dead: true,
      })}`,
    ];
    for (const output of invalid) {
      expect(() => validateStoppedRetirementAppInspection(output)).toThrow();
    }
  });

  it("pins execution to root, a clean commit, and the local synthetic homologation container", async () => {
    const runner = await readFile(
      path.join(repositoryRoot, "scripts/homologation/apply-legacy-canary-retirement.mjs"),
      "utf8",
    );
    expect(runner).toContain("process.getuid?.() !== 0");
    expect(runner).toContain('"status", "--porcelain=v1", "--untracked-files=all"');
    expect(runner).toContain("Current Git SHA differs from --expected-sha");
    expect(runner).toContain("isolated-homologation");
    expect(runner).toContain("synthetic-only");
    expect(runner).toContain("runtimeManifest.sourceSha !== expectedSha");
    expect(runner).toContain("unix:///var/run/docker.sock");
    expect(runner).toContain("supabase_db_descomplica-homologation");
    expect(runner).toContain("/etc/descomplica-crm/homologation.env");
    expect(runner).toContain("(await realpath(filePath)) !== filePath");
    expect(runner).toContain("metadata.uid !== 0");
    expect(runner).toContain("metadata.gid !== 0");
    expect(runner).toContain("(metadata.mode & 0o777) !== 0o600");
    expect(runner).toContain("async function assertBoundary(mode, expectedSha)");
    expect(runner).toContain(
      "const requiresRuntimeShutdown = requiresRetirementRuntimeShutdown(mode)",
    );
    expect(runner.match(/if \(requiresRuntimeShutdown\)/gu)).toHaveLength(2);
    expect(runner).toContain(
      "await assertRootOnlyRegularFile(\n      homologationEnvironmentPath,",
    );
    expect(runner).toContain('"{{json .Name}}\\t{{json .State}}"');
    expect(runner).toContain("descomplica-homologation-app");
    expect(runner).toContain("await assertBoundary(arguments_.mode, arguments_.expectedSha)");
    expect(runner).toContain('"--username",\n      "supabase_admin"');
    expect(runner).toContain(
      'pendingVersions: arguments_.mode === "dry-run" ? preflight.pendingVersions : []',
    );
    expect(runner).not.toContain("SUPABASE_DB_URL");
    expect(runner).not.toContain("supabase db push");
    expect(runner).not.toContain("production-db");
  });

  it("builds one atomic 32-to-33 roll-forward with exact 24-to-17 guards", async () => {
    const manifest = await loadManifest();
    const candidate = await loadRetirementCandidate(repositoryRoot, manifest);
    try {
      const preconditions = buildRetirementPreconditionsSql(manifest);
      const postconditions = buildRetirementPostconditionsSql(manifest);
      const sql = buildRetirementApplicationSql(manifest, candidate);

      expect(preconditions).toContain(manifest.beforePageCatalogSha256);
      expect(preconditions).toContain("v_count <> 24");
      expect(postconditions).toContain(manifest.afterPageCatalogSha256);
      expect(postconditions).toContain("v_count <> 17");
      expect(sql.match(/^begin;$/gmu)).toHaveLength(1);
      expect(sql.match(/^commit;$/gmu)).toHaveLength(1);
      expect(sql).toContain("pg_try_advisory_lock(2026092612, 0)");
      expect(sql).toContain("supabase_migrations.schema_migrations,");
      expect(sql).toContain("in share row exclusive mode;");
      expect(sql.match(/insert into supabase_migrations\.schema_migrations/gmu)).toHaveLength(1);
      expect(sql).toContain("hash-pinned predecessor changed after retirement preflight");
      for (const migration of manifest.pinnedHistory) {
        expect(sql).toContain(migration.sha256);
      }
      expect(sql).toContain("v_deleted_total <> 7");
      expect(sql).toContain("v_deleted <> 1");
      expect(sql).toContain("approved seventeen-page catalog postcondition failed");
      expect(sql).not.toMatch(/delete\s+from\s+supabase_migrations/iu);
      expect(sql).not.toMatch(/update\s+supabase_migrations/iu);
      expect(sql).not.toMatch(/migration\s+repair/iu);
    } finally {
      candidate.contents.fill(0);
    }
  });
});
