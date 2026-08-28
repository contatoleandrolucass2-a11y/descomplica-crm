import { spawnSync } from "node:child_process";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { sha256File, validateBackupProof } from "./auth-mfa-upgrade-lib.mjs";
import {
  buildLegacyCanaryApplicationSql,
  legacyCanaryPostconditionsSql,
  loadLegacyCanaryCandidate,
  validateLegacyCanaryAllowlist,
  validateLegacyCanaryHistory,
} from "./legacy-canary-upgrade-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/legacy-canary-migration-allowlist.json",
);
const runtimeManifestPath = "/var/lib/descomplica-crm-homologation/manifest.json";
const dockerSocketPath = "/var/run/docker.sock";
const dockerEndpoint = `unix://${dockerSocketPath}`;
const dockerExecutable = "/usr/bin/docker";
const databaseContainer = "supabase_db_descomplica-homologation";
const safeEnvironment = {
  DOCKER_HOST: dockerEndpoint,
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
};

function fail(message) {
  throw new Error(message);
}

function parseArguments() {
  const [mode, ...rest] = process.argv.slice(2);
  if (!new Set(["dry-run", "apply", "verify"]).has(mode)) {
    fail("Use dry-run, apply, or verify with --expected-sha <commit>.");
  }
  let expectedSha = null;
  let backupManifest = null;
  let confirmation = null;
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!value || !new Set(["--expected-sha", "--backup-manifest", "--confirm"]).has(flag)) {
      fail("Legacy canary migration arguments are invalid.");
    }
    if (seen.has(flag)) fail("Legacy canary migration arguments must not be duplicated.");
    seen.add(flag);
    if (flag === "--expected-sha") expectedSha = value;
    if (flag === "--backup-manifest") backupManifest = value;
    if (flag === "--confirm") confirmation = value;
  }
  if (!/^[0-9a-f]{40}$/u.test(expectedSha ?? "")) {
    fail("--expected-sha must be the exact forty-character Git commit.");
  }
  if (mode === "apply") {
    if (!backupManifest || !path.isAbsolute(backupManifest)) {
      fail("Apply requires an absolute --backup-manifest path.");
    }
    if (confirmation !== "homologation-legacy-canary-only") {
      fail("Apply requires the exact homologation-only confirmation.");
    }
  } else if (backupManifest || confirmation) {
    fail("Backup and confirmation arguments are accepted only in apply mode.");
  }
  return { mode, expectedSha, backupManifest };
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: safeEnvironment,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    if (options.sensitive) fail(`${options.label} failed; sensitive diagnostics suppressed.`);
    const diagnostic = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
      .trim()
      .split("\n")
      .slice(-8)
      .join("\n")
      .slice(-1_200);
    fail(`${options.label} failed.${diagnostic ? `\n${diagnostic}` : ""}`);
  }
  return result.stdout;
}

function runDocker(arguments_, options = {}) {
  return run(dockerExecutable, ["--host", dockerEndpoint, ...arguments_], options);
}

function psql(input, label) {
  return runDocker(
    [
      "exec",
      "-i",
      databaseContainer,
      "psql",
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--username",
      "supabase_admin",
      "--dbname",
      "postgres",
    ],
    { input, label, sensitive: true },
  );
}

async function assertRootOnlyFile(filePath, label) {
  if ((await realpath(filePath)) !== filePath) fail(`${label} must not be a symlink.`);
  const metadata = await stat(filePath);
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail(`${label} must be root:root mode 0600.`);
  }
  return metadata;
}

async function verifyBackup(manifestPath, expectedSha, expectedHistoryCount) {
  const resolved = path.resolve(manifestPath);
  if (path.basename(resolved) !== "SHA256SUMS") fail("Backup manifest name is invalid.");
  await assertRootOnlyFile(resolved, "Backup manifest");
  const backupRoot = path.dirname(resolved);
  const rootMetadata = await stat(backupRoot);
  if (
    (await realpath(backupRoot)) !== backupRoot ||
    !rootMetadata.isDirectory() ||
    rootMetadata.uid !== 0 ||
    rootMetadata.gid !== 0 ||
    (rootMetadata.mode & 0o777) !== 0o700
  ) {
    fail("Backup directory must be root:root mode 0700.");
  }
  const proofPath = path.join(backupRoot, "restore-proof.json");
  await assertRootOnlyFile(proofPath, "Isolated restore proof");
  const proof = validateBackupProof(JSON.parse(await readFile(proofPath, "utf8")), {
    expectedSha,
    expectedBackupId: path.basename(backupRoot),
    expectedHistoryCount,
  });
  const entries = (await readFile(resolved, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{64})\s{2}([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line);
      if (!match) fail("Backup checksum manifest is invalid.");
      return { hash: match[1], file: match[2] };
    });
  const expectedFiles = [...proof.artifacts.map(({ file }) => file), "restore-proof.json"].sort();
  if (
    new Set(entries.map(({ file }) => file)).size !== entries.length ||
    JSON.stringify(entries.map(({ file }) => file).sort()) !== JSON.stringify(expectedFiles)
  ) {
    fail("Backup checksum manifest is incomplete.");
  }
  for (const entry of entries) {
    const filePath = path.join(backupRoot, entry.file);
    const metadata = await assertRootOnlyFile(filePath, "Backup artifact");
    const proofArtifact = proof.artifacts.find(({ file }) => file === entry.file);
    if (
      (proofArtifact && metadata.size !== proofArtifact.bytes) ||
      (await sha256File(filePath)) !== entry.hash ||
      (proofArtifact && proofArtifact.sha256 !== entry.hash)
    ) {
      fail("Backup artifact checksum mismatch.");
    }
  }
  return proof;
}

async function assertBoundary(expectedSha) {
  if (process.getuid?.() !== 0) fail("Homologation legacy migration requires root.");
  if (run("git", ["rev-parse", "HEAD"], { label: "Git SHA" }).trim() !== expectedSha) {
    fail("Current Git SHA differs from --expected-sha.");
  }
  if (
    run("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      label: "Git worktree",
    }) !== ""
  ) {
    fail("Homologation legacy migration requires a clean worktree.");
  }
  const manifestMetadata = await assertRootOnlyFile(runtimeManifestPath, "Runtime manifest");
  if ((manifestMetadata.mode & 0o777) !== 0o600) fail("Runtime manifest mode is invalid.");
  const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, "utf8"));
  if (
    runtimeManifest.environment !== "isolated-homologation" ||
    runtimeManifest.dataClassification !== "synthetic-only" ||
    runtimeManifest.sourceSha !== expectedSha
  ) {
    fail("Runtime manifest does not identify this isolated homologation release.");
  }
  const socket = await lstat(dockerSocketPath);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o007) !== 0) {
    fail("Approved Docker socket is unavailable or permissive.");
  }
  const discovered = runDocker(
    [
      "ps",
      "--filter",
      "label=com.supabase.cli.project=descomplica-homologation",
      "--filter",
      `name=^/${databaseContainer}$`,
      "--format",
      "{{.Names}}",
    ],
    { label: "Homologation database discovery" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  if (discovered.length !== 1 || discovered[0] !== databaseContainer) {
    fail("Expected isolated homologation database is not running.");
  }
}

function readHistory() {
  const output = psql(
    `begin read only;
select coalesce(jsonb_agg(jsonb_build_object(
  'version', migration.version,
  'name', migration.name,
  'statement_count', coalesce(cardinality(migration.statements), 0),
  'sha256', case when migration.version in ('20260824230058', '20260824230100', '20260828135947')
    then encode(extensions.digest(convert_to(array_to_string(migration.statements, ''), 'UTF8'), 'sha256'), 'hex')
    else null end
) order by migration.version), '[]'::jsonb)
from supabase_migrations.schema_migrations migration;
rollback;`,
    "Read-only homologation migration inventory",
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  if (output.length !== 1) fail("Migration history query returned an unexpected result.");
  const parsed = JSON.parse(output[0]);
  if (!Array.isArray(parsed)) fail("Migration history query returned an invalid value.");
  return parsed;
}

function verifyPostconditions() {
  psql(
    `begin read only;\n${legacyCanaryPostconditionsSql}\nrollback;`,
    "Read-only legacy canary postconditions",
  );
}

async function main() {
  const arguments_ = parseArguments();
  await assertBoundary(arguments_.expectedSha);
  const manifest = validateLegacyCanaryAllowlist(JSON.parse(await readFile(allowlistPath, "utf8")));
  const candidate = await loadLegacyCanaryCandidate(repositoryRoot, manifest);
  let backupProof = null;
  try {
    const preflight = validateLegacyCanaryHistory(manifest, arguments_.mode, readHistory());
    if (arguments_.mode === "apply") {
      backupProof = await verifyBackup(
        arguments_.backupManifest,
        arguments_.expectedSha,
        manifest.baselineVersions.length,
      );
      psql(
        buildLegacyCanaryApplicationSql(manifest, candidate),
        "Allowlisted legacy canary migration application",
      );
      validateLegacyCanaryHistory(manifest, "verify", readHistory());
      verifyPostconditions();
    } else if (arguments_.mode === "verify") {
      verifyPostconditions();
    }
    process.stdout.write(
      `${JSON.stringify({
        environment: "isolated-homologation",
        mode: arguments_.mode,
        sourceSha: arguments_.expectedSha,
        historyCount:
          arguments_.mode === "apply"
            ? manifest.baselineVersions.length + 1
            : preflight.historyCount,
        pendingVersions: preflight.pendingVersions,
        candidateHash: manifest.candidate.sha256,
        mutation: arguments_.mode === "apply",
        postconditionsVerified: arguments_.mode !== "dry-run",
        ...(backupProof ? { backupId: backupProof.backupId } : {}),
      })}\n`,
    );
  } finally {
    candidate.contents.fill(0);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `Homologation legacy canary migration gate failed: ${
      error instanceof Error ? error.message : "unknown failure"
    }\n`,
  );
  process.exitCode = 1;
}
