import { spawnSync } from "node:child_process";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sha256, sha256File } from "./auth-mfa-upgrade-lib.mjs";
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
} from "./legacy-canary-retirement-lib.mjs";
import { enterRuntimeStateLock } from "./runtime-state-lock.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const allowlistPath = path.join(
  repositoryRoot,
  "deploy/homologation/legacy-canary-retirement-allowlist.json",
);
const runtimeManifestPath = "/var/lib/descomplica-crm-homologation/manifest.json";
const homologationEnvironmentPath = "/etc/descomplica-crm/homologation.env";
const dockerSocketPath = "/var/run/docker.sock";
const dockerEndpoint = "unix:///var/run/docker.sock";
const dockerExecutable = "/usr/bin/docker";
const databaseContainer = "supabase_db_descomplica-homologation";
const applicationContainer = "descomplica-homologation-app";
const safeEnvironment = {
  DOCKER_HOST: dockerEndpoint,
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
};

function fail(message) {
  throw new Error(message);
}

export function parseRetirementArguments(arguments_) {
  const [mode, ...rest] = arguments_;
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
      fail("Legacy canary retirement arguments are invalid.");
    }
    if (seen.has(flag)) fail("Legacy canary retirement arguments must not be duplicated.");
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
    if (confirmation !== "homologation-legacy-canary-retirement-only") {
      fail("Apply requires the exact homologation-only retirement confirmation.");
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

async function assertRootOnlyRegularFile(filePath, label) {
  if ((await realpath(filePath)) !== filePath) fail(`${label} must not be a symlink.`);
  const metadata = await stat(filePath);
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail(`${label} must be a root:root regular file with mode 0600.`);
  }
  return metadata;
}

async function verifyBackup(manifestPath, expectedSha, expectedAllowlistSha256, manifest) {
  const resolved = path.resolve(manifestPath);
  if (path.basename(resolved) !== "SHA256SUMS") fail("Backup manifest name is invalid.");
  await assertRootOnlyRegularFile(resolved, "Backup manifest");
  const backupRoot = path.dirname(resolved);
  const rootMetadata = await stat(backupRoot);
  if (
    (await realpath(backupRoot)) !== backupRoot ||
    !rootMetadata.isDirectory() ||
    rootMetadata.uid !== 0 ||
    rootMetadata.gid !== 0 ||
    (rootMetadata.mode & 0o777) !== 0o700
  ) {
    fail("Backup directory must be a root:root directory with mode 0700.");
  }

  const proofPath = path.join(backupRoot, "restore-proof.json");
  await assertRootOnlyRegularFile(proofPath, "Isolated restore proof");
  const proof = validateRetirementBackupProof(JSON.parse(await readFile(proofPath, "utf8")), {
    expectedSha,
    expectedBackupId: path.basename(backupRoot),
    expectedAllowlistSha256,
    manifest,
  });

  const entries = (await readFile(resolved, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{64})\s{2}([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line);
      if (!match) fail("Backup checksum manifest contains an invalid entry.");
      return { hash: match[1], file: match[2] };
    });
  const expectedFiles = [...proof.artifacts.map(({ file }) => file), "restore-proof.json"].sort();
  const actualFiles = entries.map(({ file }) => file).sort();
  if (
    new Set(actualFiles).size !== actualFiles.length ||
    JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)
  ) {
    fail("Backup checksum manifest is incomplete or duplicated.");
  }

  const declared = new Map(entries.map(({ file, hash }) => [file, hash]));
  for (const artifact of proof.artifacts) {
    const artifactPath = path.join(backupRoot, artifact.file);
    const metadata = await assertRootOnlyRegularFile(artifactPath, "Backup artifact");
    if (
      metadata.size !== artifact.bytes ||
      declared.get(artifact.file) !== artifact.sha256 ||
      (await sha256File(artifactPath)) !== artifact.sha256
    ) {
      fail("Backup artifact checksum mismatch.");
    }
  }
  if (declared.get("restore-proof.json") !== (await sha256File(proofPath))) {
    fail("Isolated restore proof checksum mismatch.");
  }
  return proof;
}

async function assertBoundary(mode, expectedSha) {
  const requiresRuntimeShutdown = requiresRetirementRuntimeShutdown(mode);
  if (process.getuid?.() !== 0) fail("Homologation legacy retirement requires root.");
  if (run("git", ["rev-parse", "HEAD"], { label: "Git SHA" }).trim() !== expectedSha) {
    fail("Current Git SHA differs from --expected-sha.");
  }
  if (
    run("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      label: "Git worktree",
    }) !== ""
  ) {
    fail("Homologation legacy retirement requires a clean worktree.");
  }

  const runtimeMetadata = await assertRootOnlyRegularFile(
    runtimeManifestPath,
    "Homologation runtime manifest",
  );
  if ((runtimeMetadata.mode & 0o777) !== 0o600) fail("Runtime manifest mode is invalid.");
  const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, "utf8"));
  if (
    runtimeManifest.environment !== "isolated-homologation" ||
    runtimeManifest.dataClassification !== "synthetic-only" ||
    runtimeManifest.sourceSha !== expectedSha
  ) {
    fail("Runtime manifest does not identify this isolated homologation release.");
  }

  if (requiresRuntimeShutdown) {
    await assertRootOnlyRegularFile(
      homologationEnvironmentPath,
      "Homologation runtime environment",
    );
    validateRetirementRuntimeEnvironment(await readFile(homologationEnvironmentPath, "utf8"));
  }

  const socket = await lstat(dockerSocketPath);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o007) !== 0) {
    fail("Approved local Docker socket is unavailable or permissive.");
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

  if (requiresRuntimeShutdown) {
    validateStoppedRetirementAppInspection(
      runDocker(
        [
          "inspect",
          "--type",
          "container",
          "--format",
          "{{json .Name}}\t{{json .State}}",
          applicationContainer,
        ],
        { label: "Stopped homologation application inspection" },
      ),
    );
  }
}

function readHistory(manifest) {
  const hashedVersions = [
    ...manifest.pinnedHistory.map(({ version }) => version),
    manifest.candidate.version,
  ];
  const sqlVersions = hashedVersions.map((version) => `'${version}'`).join(",");
  const rows = psql(
    `begin read only;
select coalesce(jsonb_agg(jsonb_build_object(
  'version', migration.version,
  'name', migration.name,
  'statement_count', coalesce(cardinality(migration.statements), 0),
  'sha256', case when migration.version in (${sqlVersions})
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
  if (rows.length !== 1) fail("Migration history query returned an unexpected result.");
  const parsed = JSON.parse(rows[0]);
  if (!Array.isArray(parsed)) fail("Migration history query returned an invalid value.");
  return parsed;
}

function verifyPreconditions(manifest) {
  psql(
    `begin read only;\n${buildRetirementPreconditionsSql(manifest)}\nrollback;`,
    "Read-only legacy canary retirement preconditions",
  );
}

function verifyPostconditions(manifest) {
  psql(
    `begin read only;\n${buildRetirementPostconditionsSql(manifest)}\nrollback;`,
    "Read-only legacy canary retirement postconditions",
  );
}

async function main(commandArguments) {
  const arguments_ = parseRetirementArguments(commandArguments);
  await assertBoundary(arguments_.mode, arguments_.expectedSha);
  const allowlistContents = await readFile(allowlistPath);
  const expectedAllowlistSha256 = sha256(allowlistContents);
  const manifest = validateRetirementAllowlist(JSON.parse(allowlistContents.toString("utf8")));
  const candidate = await loadRetirementCandidate(repositoryRoot, manifest);
  let backupProof = null;
  try {
    const preflight = validateRetirementHistory(manifest, arguments_.mode, readHistory(manifest));
    if (arguments_.mode === "dry-run" || arguments_.mode === "apply") {
      verifyPreconditions(manifest);
    }
    if (arguments_.mode === "apply") {
      backupProof = await verifyBackup(
        arguments_.backupManifest,
        arguments_.expectedSha,
        expectedAllowlistSha256,
        manifest,
      );
      psql(
        buildRetirementApplicationSql(manifest, candidate),
        "Allowlisted legacy canary retirement application",
      );
      validateRetirementHistory(manifest, "verify", readHistory(manifest));
      verifyPostconditions(manifest);
    } else if (arguments_.mode === "verify") {
      verifyPostconditions(manifest);
    }

    process.stdout.write(
      `${JSON.stringify({
        environment: "isolated-homologation",
        scope: manifest.scope,
        productionEligible: false,
        mode: arguments_.mode,
        sourceSha: arguments_.expectedSha,
        historyCount:
          arguments_.mode === "apply"
            ? manifest.baselineVersions.length + 1
            : preflight.historyCount,
        pageCount:
          arguments_.mode === "verify" || arguments_.mode === "apply"
            ? manifest.afterPageCount
            : manifest.beforePageCount,
        pendingVersions: arguments_.mode === "dry-run" ? preflight.pendingVersions : [],
        predecessorHashes: Object.fromEntries(
          manifest.pinnedHistory.map(({ version, sha256 }) => [version, sha256]),
        ),
        candidateHash: manifest.candidate.sha256,
        mutation: arguments_.mode === "apply",
        preconditionsVerified: arguments_.mode !== "verify",
        postconditionsVerified: arguments_.mode !== "dry-run",
        ...(backupProof ? { backupId: backupProof.backupId } : {}),
      })}\n`,
    );
  } finally {
    candidate.contents.fill(0);
  }
}

async function dispatch() {
  const state = await enterRuntimeStateLock({
    arguments_: process.argv.slice(2),
    scriptPath: fileURLToPath(import.meta.url),
  });
  if (!state.delegated) await main(state.arguments_);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await dispatch();
  } catch (error) {
    process.stderr.write(
      `Homologation legacy canary retirement gate failed: ${
        error instanceof Error ? error.message : "unknown failure"
      }\n`,
    );
    process.exitCode = 1;
  }
}
