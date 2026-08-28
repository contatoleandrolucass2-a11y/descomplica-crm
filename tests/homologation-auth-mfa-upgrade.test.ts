import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildApplicationSql,
  loadCandidateFiles,
  validateAllowlist,
  validateBackupProof,
  validateHistoryState,
} from "../scripts/homologation/auth-mfa-upgrade-lib.mjs";
import type { MigrationHistoryRow } from "../scripts/homologation/auth-mfa-upgrade-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/auth-mfa-migration-allowlist.json",
);

async function loadManifest() {
  return validateAllowlist(JSON.parse(await readFile(allowlistPath, "utf8")));
}

describe("homologation Auth/MFA migration gate", () => {
  const backupNow = Date.parse("2026-08-27T00:30:00.000Z");
  const backupProof = {
    schemaVersion: 1,
    environment: "isolated-homologation",
    sourceSha: "a".repeat(40),
    backupId: "20260827T000000Z-123456789abc",
    createdAt: "2026-08-27T00:00:00.000Z",
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
      historyCount: 29,
      candidateCount: 0,
      databaseArtifact: "database.dump",
      databaseSha256: "1".repeat(64),
      testedAt: "2026-08-27T00:20:00.000Z",
    },
  };

  it("pins exactly the two candidate files and their content hashes", async () => {
    const manifest = await loadManifest();
    const candidates = await loadCandidateFiles(repositoryRoot, manifest);
    try {
      expect(candidates.map(({ version }) => version)).toEqual([
        "20260824230058",
        "20260824230100",
      ]);
      expect(candidates.map(({ sha256 }) => sha256)).toEqual(
        manifest.candidates.map(({ sha256 }) => sha256),
      );
    } finally {
      for (const candidate of candidates) candidate.contents.fill(0);
    }
  });

  it("reports only the two allowlisted candidates from the exact baseline", async () => {
    const manifest = await loadManifest();
    expect(
      validateHistoryState(
        manifest,
        "dry-run",
        manifest.baselineVersions.map((version) => ({ version })),
      ),
    ).toEqual({
      historyCount: manifest.baselineVersions.length,
      pendingVersions: ["20260824230058", "20260824230100"],
    });
  });

  it("fails closed for extra, missing, or partially applied history", async () => {
    const manifest = await loadManifest();
    const firstCandidate = manifest.candidates[0];
    expect(firstCandidate).toBeDefined();
    if (!firstCandidate) throw new Error("candidate fixture is missing");
    const baseline = manifest.baselineVersions.map((version) => ({ version }));
    expect(() => validateHistoryState(manifest, "dry-run", baseline.slice(1))).toThrow(
      /exact approved baseline/u,
    );
    expect(() =>
      validateHistoryState(manifest, "dry-run", [...baseline, { version: "20260825000000" }]),
    ).toThrow(/exact approved baseline/u);
    expect(() =>
      validateHistoryState(manifest, "dry-run", [
        ...baseline,
        {
          version: firstCandidate.version,
          name: firstCandidate.name,
          statement_count: 1,
          sha256: firstCandidate.sha256,
        },
      ]),
    ).toThrow(/exact approved baseline/u);
  });

  it("rejects repository migrations outside the explicit inventory", async () => {
    const manifest = await loadManifest();
    const invalidManifest = {
      ...manifest,
      nonDeployableRepositoryVersions: manifest.nonDeployableRepositoryVersions.slice(1),
    };
    await expect(loadCandidateFiles(repositoryRoot, invalidManifest)).rejects.toThrow(
      /Repository migration inventory/u,
    );
  });

  it("requires a fresh typed backup and isolated restore proof", () => {
    expect(
      validateBackupProof(backupProof, {
        expectedSha: "a".repeat(40),
        expectedBackupId: backupProof.backupId,
        expectedHistoryCount: 29,
        now: backupNow,
      }).artifacts.map(({ kind }) => kind),
    ).toEqual(["database", "migration-history", "configuration", "image"]);
    expect(() =>
      validateBackupProof(
        { ...backupProof, restore: { ...backupProof.restore, networkCount: 1 } },
        {
          expectedSha: "a".repeat(40),
          expectedBackupId: backupProof.backupId,
          expectedHistoryCount: 29,
          now: backupNow,
        },
      ),
    ).toThrow(/isolated restore proof/u);
    expect(() =>
      validateBackupProof(
        { ...backupProof, createdAt: "2026-08-25T00:00:00.000Z" },
        {
          expectedSha: "a".repeat(40),
          expectedBackupId: backupProof.backupId,
          expectedHistoryCount: 29,
          now: backupNow,
        },
      ),
    ).toThrow(/fresh/u);
  });

  it("verifies stored candidate names, statement count, and hashes", async () => {
    const manifest = await loadManifest();
    const history: MigrationHistoryRow[] = [
      ...manifest.baselineVersions.map((version) => ({ version })),
      ...manifest.candidates.map((candidate) => ({
        version: candidate.version,
        name: candidate.name,
        statement_count: 1,
        sha256: candidate.sha256,
      })),
    ];
    expect(validateHistoryState(manifest, "verify", history).pendingVersions).toEqual([]);
    history.at(-1)!.sha256 = "0".repeat(64);
    expect(() => validateHistoryState(manifest, "verify", history)).toThrow(
      /history hash mismatch/u,
    );
  });

  it("builds two atomic transactions under one non-blocking advisory lock", async () => {
    const manifest = await loadManifest();
    const candidates = await loadCandidateFiles(repositoryRoot, manifest);
    try {
      const sql = buildApplicationSql(manifest, candidates);
      expect(sql.match(/^begin;$/gmu)).toHaveLength(2);
      expect(sql.match(/^commit;$/gmu)).toHaveLength(2);
      expect(sql).toContain("pg_try_advisory_lock(2026082423, 49)");
      expect(sql).toContain("pg_advisory_unlock(2026082423, 49)");
      expect(sql.match(/insert into supabase_migrations\.schema_migrations/gmu)).toHaveLength(2);
      expect(sql).toContain("approved seventeen-page catalog postcondition failed");
      expect(sql).not.toContain("migration repair");
      expect(sql).not.toContain("--include-all");
    } finally {
      for (const candidate of candidates) candidate.contents.fill(0);
    }
  });
});
