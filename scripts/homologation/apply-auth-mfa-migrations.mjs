import { spawnSync } from "node:child_process";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  buildApplicationSql,
  loadCandidateFiles,
  postconditionsSql,
  sha256File,
  validateAllowlist,
  validateBackupProof,
  validateHistoryState,
} from "./auth-mfa-upgrade-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/auth-mfa-migration-allowlist.json",
);
const runtimeManifestPath = "/var/lib/descomplica-crm-homologation/manifest.json";
const dockerSocketPath = "/var/run/docker.sock";
const dockerEndpoint = `unix://${dockerSocketPath}`;
const dockerExecutable = "/usr/bin/docker";
const databaseContainerName = "supabase_db_descomplica-homologation";
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
  const seenFlags = new Set();
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!value || !new Set(["--expected-sha", "--backup-manifest", "--confirm"]).has(flag)) {
      fail("Homologation migration arguments are invalid.");
    }
    if (seenFlags.has(flag)) fail("Homologation migration arguments must not be duplicated.");
    seenFlags.add(flag);
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
    if (confirmation !== "homologation-auth-mfa-only") {
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
    encoding: options.encoding ?? "utf8",
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

function psql(input, label, sensitive = true) {
  return runDocker(
    [
      "exec",
      "-i",
      databaseContainerName,
      "psql",
      "-X",
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
    ],
    { input, label, sensitive },
  );
}

async function assertRootOnlyRegularFile(filePath, label) {
  if ((await realpath(filePath)) !== filePath) fail(`${label} must not be a symlink.`);
  const metadata = await stat(filePath);
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail(`${label} must be a root:root regular file without group/other access.`);
  }
  return metadata;
}

async function verifyBackupManifest(manifestPath, expectedSha, expectedHistoryCount) {
  const resolvedManifest = path.resolve(manifestPath);
  if (path.basename(resolvedManifest) !== "SHA256SUMS") {
    fail("Backup manifest must be named SHA256SUMS.");
  }
  await assertRootOnlyRegularFile(resolvedManifest, "Backup manifest");
  const backupRoot = path.dirname(resolvedManifest);
  if ((await realpath(backupRoot)) !== backupRoot) {
    fail("Backup directory must not be a symlink.");
  }
  const rootMetadata = await stat(backupRoot);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.uid !== 0 ||
    rootMetadata.gid !== 0 ||
    (rootMetadata.mode & 0o777) !== 0o700
  ) {
    fail("Backup directory must be root:root without group/other access.");
  }

  const proofPath = path.join(backupRoot, "restore-proof.json");
  await assertRootOnlyRegularFile(proofPath, "Isolated restore proof");
  const proof = validateBackupProof(JSON.parse(await readFile(proofPath, "utf8")), {
    expectedSha,
    expectedBackupId: path.basename(backupRoot),
    expectedHistoryCount,
  });

  const entries = (await readFile(resolvedManifest, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{64})\s{2}([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line);
      if (!match) fail("Backup checksum manifest contains an invalid entry.");
      return { expectedHash: match[1], fileName: match[2] };
    });
  const expectedFiles = [...proof.artifacts.map(({ file }) => file), "restore-proof.json"].sort();
  const actualFiles = entries.map(({ fileName }) => fileName).sort();
  if (
    new Set(actualFiles).size !== actualFiles.length ||
    JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)
  ) {
    fail("Backup checksum manifest is incomplete or duplicated.");
  }
  const declaredHashes = new Map(
    entries.map(({ fileName, expectedHash }) => [fileName, expectedHash]),
  );
  for (const artifact of proof.artifacts) {
    const filePath = path.join(backupRoot, artifact.file);
    await assertRootOnlyRegularFile(filePath, "Backup artifact");
    const metadata = await stat(filePath);
    if (
      metadata.size !== artifact.bytes ||
      declaredHashes.get(artifact.file) !== artifact.sha256 ||
      (await sha256File(filePath)) !== artifact.sha256
    ) {
      fail("Backup artifact checksum mismatch.");
    }
  }
  if (declaredHashes.get("restore-proof.json") !== (await sha256File(proofPath))) {
    fail("Isolated restore proof checksum mismatch.");
  }
  return proof;
}

async function assertExecutionBoundary(expectedSha) {
  if (process.getuid?.() !== 0) fail("Homologation migration execution requires root.");
  const actualSha = run("git", ["rev-parse", "HEAD"], { label: "Git SHA" }).trim();
  if (actualSha !== expectedSha) fail("Current Git SHA differs from --expected-sha.");
  const worktree = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    label: "Git worktree",
  });
  if (worktree.length !== 0) fail("Homologation migration execution requires a clean worktree.");

  const runtimeManifestStatus = await assertRootOnlyRegularFile(
    runtimeManifestPath,
    "Homologation runtime manifest",
  );
  if ((runtimeManifestStatus.mode & 0o777) !== 0o600) {
    fail("Homologation runtime manifest must have mode 0600.");
  }
  const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, "utf8"));
  if (
    runtimeManifest.environment !== "isolated-homologation" ||
    runtimeManifest.dataClassification !== "synthetic-only"
  ) {
    fail("Runtime manifest is not the isolated synthetic homologation environment.");
  }

  const socket = await lstat(dockerSocketPath);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o007) !== 0) {
    fail("Approved local Docker socket is unavailable or permissive.");
  }
  const containers = runDocker(
    [
      "ps",
      "--filter",
      "label=com.supabase.cli.project=descomplica-homologation",
      "--filter",
      `name=^/${databaseContainerName}$`,
      "--format",
      "{{.Names}}",
    ],
    { label: "Homologation database discovery" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  if (containers.length !== 1 || containers[0] !== databaseContainerName) {
    fail("Expected isolated homologation database container is not running.");
  }
}

function parseHistoryResult(output) {
  const rows = output
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length !== 1) fail("Migration history query returned an unexpected row count.");
  const parsed = JSON.parse(rows[0]);
  if (!Array.isArray(parsed)) fail("Migration history query returned an invalid value.");
  return parsed;
}

function readHistory() {
  return parseHistoryResult(
    psql(
      `begin read only;
select coalesce(jsonb_agg(jsonb_build_object(
  'version', migration.version,
  'name', migration.name,
  'statement_count', coalesce(cardinality(migration.statements), 0),
  'sha256', case
    when migration.version in ('20260824230058', '20260824230100')
      then encode(extensions.digest(convert_to(array_to_string(migration.statements, ''), 'UTF8'), 'sha256'), 'hex')
    else null
  end
) order by migration.version), '[]'::jsonb)
from supabase_migrations.schema_migrations migration;
rollback;`,
      "Read-only homologation migration inventory",
    ),
  );
}

function verifyPostconditions() {
  psql(
    `begin read only;
${postconditionsSql}
rollback;`,
    "Read-only Auth/MFA postconditions",
  );
}

async function main() {
  const arguments_ = parseArguments();
  await assertExecutionBoundary(arguments_.expectedSha);
  const manifest = validateAllowlist(JSON.parse(await readFile(allowlistPath, "utf8")));
  const candidates = await loadCandidateFiles(repositoryRoot, manifest);
  let backupProof = null;
  try {
    const preflight = validateHistoryState(manifest, arguments_.mode, readHistory());
    if (arguments_.mode === "apply") {
      backupProof = await verifyBackupManifest(
        arguments_.backupManifest,
        arguments_.expectedSha,
        manifest.baselineVersions.length,
      );
      const sql = buildApplicationSql(manifest, candidates);
      psql(sql, "Allowlisted Auth/MFA migration application");
      validateHistoryState(manifest, "verify", readHistory());
      verifyPostconditions();
    } else if (arguments_.mode === "verify") {
      verifyPostconditions();
    }

    const summary = {
      environment: "isolated-homologation",
      mode: arguments_.mode,
      sourceSha: arguments_.expectedSha,
      historyCount:
        arguments_.mode === "apply"
          ? manifest.baselineVersions.length + manifest.candidates.length
          : preflight.historyCount,
      pendingVersions: preflight.pendingVersions,
      candidateHashes: Object.fromEntries(
        manifest.candidates.map(({ version, sha256: hash }) => [version, hash]),
      ),
      mutation: arguments_.mode === "apply",
      postconditionsVerified: arguments_.mode !== "dry-run",
      ...(backupProof ? { backupId: backupProof.backupId } : {}),
    };
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    for (const candidate of candidates) candidate.contents.fill(0);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `Homologation Auth/MFA migration gate failed: ${
      error instanceof Error ? error.message : "unknown failure"
    }\n`,
  );
  process.exitCode = 1;
}
