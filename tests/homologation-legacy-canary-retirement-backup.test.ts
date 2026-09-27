import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

import { sha256 } from "../scripts/homologation/auth-mfa-upgrade-lib.mjs";
import {
  assertExactSecurityContract,
  assertHeadBoundBytes,
  collectRequiredConfigurationSources,
  finalizeBackupDurability,
  openPrivateBackupParent,
} from "../scripts/homologation/create-legacy-canary-retirement-backup.mjs";
import {
  validateRetirementAllowlist,
  validateRetirementBackupProof,
} from "../scripts/homologation/legacy-canary-retirement-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(
  repositoryRoot,
  "scripts/homologation/create-legacy-canary-retirement-backup.mjs",
);
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/legacy-canary-retirement-allowlist.json",
);

const ownerBoundary = {
  expectedUid: process.getuid?.() ?? 0,
  expectedGid: process.getgid?.() ?? 0,
};

async function loadManifest() {
  return validateRetirementAllowlist(JSON.parse(await readFile(allowlistPath, "utf8")));
}

describe("homologation legacy canary retirement backup", () => {
  it("requires the complete critical source set and safely archives the approved Nginx target", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "retirement-config-"));
    const available = path.join(root, "available");
    const enabled = path.join(root, "enabled");
    const environment = path.join(root, "homologation.env");
    const inventory = path.join(root, "inventory.json");
    const credential = path.join(root, "credential");
    const target = path.join(available, "homologation.conf");
    const link = path.join(enabled, "homologation.conf");
    await mkdir(available);
    await mkdir(enabled);
    await writeFile(environment, "MODE=isolated\n", { mode: 0o640 });
    await writeFile(inventory, "{}\n", { mode: 0o640 });
    await writeFile(credential, "user:hash\n", { mode: 0o640 });
    await writeFile(target, "server {}\n", { mode: 0o640 });
    await symlink("../available/homologation.conf", link);

    const specifications = [
      { file: environment },
      { file: inventory },
      { file: credential, expectedMode: 0o640 },
      { file: link, symlinkTargetRoot: available },
    ];
    try {
      await expect(
        collectRequiredConfigurationSources(specifications, ownerBoundary),
      ).resolves.toEqual([environment, inventory, credential, link, target]);
      await expect(
        collectRequiredConfigurationSources(
          [{ file: environment, allowedGids: [ownerBoundary.expectedGid] }],
          { ...ownerBoundary, expectedGid: ownerBoundary.expectedGid + 1 },
        ),
      ).resolves.toEqual([environment]);

      await rm(inventory);
      await expect(
        collectRequiredConfigurationSources(specifications, ownerBoundary),
      ).rejects.toThrow(/required homologation configuration artifact is absent/u);

      await expect(
        collectRequiredConfigurationSources([{ file: link }], ownerBoundary),
      ).rejects.toThrow(/no approved target root/u);

      await chmod(credential, 0o600);
      await expect(
        collectRequiredConfigurationSources(
          [{ file: credential, expectedMode: 0o640 }],
          ownerBoundary,
        ),
      ).rejects.toThrow(/approved owner-controlled regular file/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("opens only a real owner-controlled 0700 backup parent and rejects aliases or permissive paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "retirement-parent-"));
    const privateParent = path.join(root, "private");
    const permissiveParent = path.join(root, "permissive");
    const alias = path.join(root, "alias");
    try {
      const handle = await openPrivateBackupParent(privateParent, ownerBoundary);
      await handle.close();

      await mkdir(permissiveParent, { mode: 0o700 });
      await chmod(permissiveParent, 0o755);
      await expect(openPrivateBackupParent(permissiveParent, ownerBoundary)).rejects.toThrow(
        /real owner-controlled directory with mode 0700/u,
      );

      await symlink(privateParent, alias);
      await expect(openPrivateBackupParent(alias, ownerBoundary)).rejects.toThrow(
        /real owner-controlled directory with mode 0700/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fsyncs every final artifact before the backup directory and parent boundary", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "retirement-durable-"));
    const backupRoot = path.join(root, "backup");
    const artifact = path.join(backupRoot, "artifact.bin");
    await mkdir(backupRoot, { mode: 0o700 });
    await writeFile(artifact, "durable\n", { mode: 0o600 });
    const parentHandle = await openPrivateBackupParent(root, ownerBoundary);
    try {
      await expect(
        finalizeBackupDurability([artifact], backupRoot, parentHandle),
      ).resolves.toBeUndefined();
      await rm(artifact);
      await expect(
        finalizeBackupDurability([artifact], backupRoot, parentHandle),
      ).rejects.toThrow();
    } finally {
      await parentHandle.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("binds the exact loaded allowlist and candidate bytes to the immutable commit", () => {
    const candidate = Buffer.from("select 1;\n", "utf8");
    const expectedSha256 = sha256(candidate);
    expect(
      assertHeadBoundBytes({
        label: "candidate",
        loaded: candidate,
        committed: Buffer.from(candidate),
        expectedSha256,
      }),
    ).toEqual({ bytes: candidate.length, sha256: expectedSha256 });
    expect(() =>
      assertHeadBoundBytes({
        label: "candidate",
        loaded: candidate,
        committed: Buffer.from("select 2;\n", "utf8"),
        expectedSha256,
      }),
    ).toThrow(/immutable release commit/u);
    expect(() =>
      assertHeadBoundBytes({
        label: "candidate",
        loaded: candidate,
        committed: Buffer.from(candidate),
        expectedSha256: "0".repeat(64),
      }),
    ).toThrow(/immutable release commit/u);
  });

  it("rejects any role, owner, or ACL contract drift", () => {
    const expectedSerialized = JSON.stringify({ roles: ["postgres"], grants: ["anon=r"] });
    const expected = {
      serialized: expectedSerialized,
      sha256: sha256(Buffer.from(expectedSerialized)),
    };
    expect(assertExactSecurityContract(expected, { ...expected }, "Security contract")).toBe(
      expected.sha256,
    );

    const driftedSerialized = JSON.stringify({ roles: ["postgres"], grants: [] });
    expect(() =>
      assertExactSecurityContract(
        expected,
        {
          serialized: driftedSerialized,
          sha256: sha256(Buffer.from(driftedSerialized)),
        },
        "Security contract",
      ),
    ).toThrow(/differs from the source database/u);
  });

  it("requires release-bound candidate, security, and 33/17 rehearsal evidence", async () => {
    const manifest = await loadManifest();
    const allowlistSha256 = sha256(await readFile(allowlistPath));
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
          sha256: allowlistSha256,
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
          statementCount: canary.statementCount,
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
      expectedSha: proof.sourceSha,
      expectedBackupId: proof.backupId,
      expectedAllowlistSha256: allowlistSha256,
      manifest,
      now: Date.parse("2026-09-27T00:30:00.000Z"),
    };

    expect(validateRetirementBackupProof(proof, context).backupId).toBe(proof.backupId);
    expect(() =>
      validateRetirementBackupProof({ ...proof, rehearsal: undefined }, context),
    ).toThrow(/rehearsal proof is absent or invalid/u);
    expect(() =>
      validateRetirementBackupProof(
        {
          ...proof,
          rehearsal: {
            ...proof.rehearsal,
            candidate: { ...proof.rehearsal.candidate, sha256: "0".repeat(64) },
          },
        },
        context,
      ),
    ).toThrow(/rehearsal proof is absent or invalid/u);
    expect(() =>
      validateRetirementBackupProof(
        {
          ...proof,
          restore: { ...proof.restore, restoredDatabaseAclSha256: "0".repeat(64) },
        },
        context,
      ),
    ).toThrow(/role, owner, and ACL contract/u);
  });

  it("exercises identity, configuration, image, owner, and ACL restore paths under one lock", async () => {
    const source = await readFile(scriptPath, "utf8");
    expect(source).toMatch(/"pg_dumpall",\s*"--globals-only"/u);
    expect(source).toContain('"Identity archive restore"');
    expect(source).toContain('"--extract", "--file", configurationFile');
    expect(source).toContain('["image", "load", "--input", imageFile]');
    expect(source).toMatch(/"pg_restore",\s*"--exit-on-error",\s*"--username",\s*"postgres"/u);
    expect(source).not.toContain('"--no-owner"');
    expect(source).not.toContain('"--no-privileges"');
    expect(source).not.toContain('"--no-role-passwords"');
    expect(source).toMatch(
      /file: "\/etc\/nginx\/\.htpasswd-descomplica-homologation",\s+allowedGids: Object\.freeze\(\[33\]\),\s+expectedMode: 0o640/u,
    );
    expect(source).toMatch(
      /file: "\/etc\/descomplica-crm\/homologation\.env", expectedMode: 0o600/u,
    );
    expect(source).toMatch(
      /file: "\/etc\/descomplica-crm\/secrets\/homologation-auth-session-cookie-secret",\s+expectedMode: 0o640/u,
    );
    expect(source.indexOf('"Identity archive restore"')).toBeLessThan(
      source.indexOf('"Prepared restore role contract"'),
    );
    expect(source).toContain("enterRuntimeStateLock");
  });
});
