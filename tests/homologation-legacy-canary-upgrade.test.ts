import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildLegacyCanaryApplicationSql,
  legacyCanaryPostconditionsSql,
  loadLegacyCanaryCandidate,
  validateLegacyCanaryAllowlist,
  validateLegacyCanaryHistory,
  type LegacyCanaryMigrationRow,
} from "../scripts/homologation/legacy-canary-upgrade-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/legacy-canary-migration-allowlist.json",
);

async function manifest() {
  return validateLegacyCanaryAllowlist(JSON.parse(await readFile(allowlistPath, "utf8")));
}

describe("homologation legacy canary migration gate", () => {
  it("allowlists one exact candidate over the deployed Auth/MFA history", async () => {
    const value = await manifest();
    expect(value.baselineVersions).toHaveLength(31);
    expect(value.candidate).toMatchObject({
      version: "20260828135947",
      name: "legacy_simulators_discador_master_canary",
    });
    expect(value.nonDeployableRepositoryVersions).toHaveLength(10);
    expect(value.foundationCandidates).toHaveLength(2);
    const candidate = await loadLegacyCanaryCandidate(repositoryRoot, value);
    try {
      expect(candidate.contents.byteLength).toBeGreaterThan(1_000);
    } finally {
      candidate.contents.fill(0);
    }
  });

  it("accepts only the exact 31-to-32 transition and stored candidate hash", async () => {
    const value = await manifest();
    const foundationByVersion = new Map(
      value.foundationCandidates.map((candidate) => [candidate.version, candidate]),
    );
    const baseline: LegacyCanaryMigrationRow[] = value.baselineVersions.map((version) => {
      const foundation = foundationByVersion.get(version);
      return foundation
        ? {
            version,
            name: foundation.name,
            statement_count: 1,
            sha256: foundation.sha256,
          }
        : { version };
    });
    expect(validateLegacyCanaryHistory(value, "dry-run", baseline)).toEqual({
      historyCount: 31,
      pendingVersions: ["20260828135947"],
    });
    const applied: LegacyCanaryMigrationRow[] = [
      ...baseline,
      {
        version: value.candidate.version,
        name: value.candidate.name,
        statement_count: 1,
        sha256: value.candidate.sha256,
      },
    ];
    expect(validateLegacyCanaryHistory(value, "verify", applied)).toEqual({
      historyCount: 32,
      pendingVersions: [],
    });
    expect(() => validateLegacyCanaryHistory(value, "dry-run", applied)).toThrow(
      /exact legacy canary gate/u,
    );
    expect(() =>
      validateLegacyCanaryHistory(value, "verify", [
        ...baseline,
        { ...applied.at(-1)!, sha256: "0".repeat(64) },
      ]),
    ).toThrow(/history hash/u);
  });

  it("wraps migration and history registration atomically with exact postconditions", async () => {
    const value = await manifest();
    const candidate = await loadLegacyCanaryCandidate(repositoryRoot, value);
    try {
      const sql = buildLegacyCanaryApplicationSql(value, candidate);
      expect(sql).toContain("begin;");
      expect(sql).toContain("homologation migration history changed after preflight");
      expect(sql).toContain("insert into supabase_migrations.schema_migrations");
      expect(sql).toContain(legacyCanaryPostconditionsSql);
      expect(sql).toContain("commit;");
      expect(sql.indexOf("begin;")).toBeLessThan(
        sql.indexOf("insert into supabase_migrations.schema_migrations"),
      );
      expect(sql.indexOf("insert into supabase_migrations.schema_migrations")).toBeLessThan(
        sql.indexOf("commit;"),
      );
    } finally {
      candidate.contents.fill(0);
    }
  });

  it("keeps the remote executor pinned to root-only synthetic homologation", async () => {
    const executor = await readFile(
      path.join(repositoryRoot, "scripts/homologation/apply-legacy-canary-migration.mjs"),
      "utf8",
    );
    expect(executor).toContain("process.getuid?.() !== 0");
    expect(executor).toContain("isolated-homologation");
    expect(executor).toContain("synthetic-only");
    expect(executor).toContain("homologation-legacy-canary-only");
    expect(executor).toContain("supabase_db_descomplica-homologation");
    expect(executor).toContain('"--username",\n      "supabase_admin"');
    expect(executor).not.toContain("SUPABASE_DB_URL");
    expect(executor).not.toContain("supabase db push");
  });

  it("checks only the Auth/MFA-owned RLS tables instead of hardening legacy tables", () => {
    expect(legacyCanaryPostconditionsSql).toContain("legal_acceptance_requirements");
    expect(legacyCanaryPostconditionsSql).toContain("relation.relforcerowsecurity");
    expect(legacyCanaryPostconditionsSql).not.toContain("namespace.nspname = 'public'");
  });
});
