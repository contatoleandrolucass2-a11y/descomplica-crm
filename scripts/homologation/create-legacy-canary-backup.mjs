import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { sha256File, validateBackupProof } from "./auth-mfa-upgrade-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const backupParent = "/var/backups/descomplica-crm";
const dockerExecutable = "/usr/bin/docker";
const dockerSocket = "/var/run/docker.sock";
const dockerEndpoint = `unix://${dockerSocket}`;
const databaseContainer = "supabase_db_descomplica-homologation";
const appContainer = "descomplica-homologation-app";
const expectedHistoryCount = 31;
const safeEnvironment = {
  DOCKER_HOST: dockerEndpoint,
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
};
const configurationSources = [
  "/etc/descomplica-crm/homologation.env",
  "/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret",
  "/etc/descomplica-crm/homologation-access.json",
  "/etc/descomplica-crm/homologation-accounts.json",
  "/etc/nginx/sites-enabled/homolog.descomplicapro.com.br",
  "/etc/nginx/.htpasswd-descomplica-homologation",
  "/var/lib/descomplica-crm-homologation/manifest.json",
  "/srv/descomplica-crm/deploy/homologation/compose.yaml",
];

function fail(message) {
  throw new Error(message);
}

function run(command, arguments_, label, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: safeEnvironment,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    fail(`${label} failed; diagnostics suppressed.`);
  }
  return result.stdout;
}

function docker(arguments_, label, options = {}) {
  return run(dockerExecutable, ["--host", dockerEndpoint, ...arguments_], label, options);
}

async function dockerToFile(arguments_, destination, label) {
  const handle = await open(destination, "wx", 0o600);
  try {
    const result = spawnSync(dockerExecutable, ["--host", dockerEndpoint, ...arguments_], {
      cwd: repositoryRoot,
      env: safeEnvironment,
      stdio: ["ignore", handle.fd, "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) fail(`${label} failed; diagnostics suppressed.`);
    await handle.sync();
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  } finally {
    await handle.close();
  }
}

function psql(database, sql, label) {
  return docker(
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
      "postgres",
      "--dbname",
      database,
    ],
    label,
    { input: sql },
  ).trim();
}

async function assertBoundary() {
  if (process.getuid?.() !== 0) fail("Homologation backup requires root.");
  const sourceSha = run("git", ["rev-parse", "HEAD"], "Git SHA").trim();
  const status = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], "Git worktree");
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || status !== "") {
    fail("Homologation backup requires a clean full-SHA checkout.");
  }
  const socket = await stat(dockerSocket);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o007) !== 0) {
    fail("Approved Docker socket is unavailable or permissive.");
  }
  const manifest = JSON.parse(
    psql(
      "postgres",
      `select jsonb_build_object(
        'historyCount', (select count(*) from supabase_migrations.schema_migrations),
        'candidateCount', (select count(*) from supabase_migrations.schema_migrations where version = '20260828135947'),
        'pageCount', (select count(*) from public.app_pages)
      );`,
      "Homologation database preflight",
    ),
  );
  if (
    manifest.historyCount !== expectedHistoryCount ||
    manifest.candidateCount !== 0 ||
    manifest.pageCount !== 17
  ) {
    fail("Homologation database is not the exact pre-canary baseline.");
  }
  for (const source of configurationSources) {
    const metadata = await stat(source);
    if (!metadata.isFile()) fail("A required homologation configuration artifact is absent.");
  }
  return sourceSha;
}

async function artifact(file, kind) {
  const metadata = await stat(file);
  await chmod(file, 0o600);
  return {
    file: path.basename(file),
    kind,
    bytes: metadata.size,
    sha256: await sha256File(file),
  };
}

async function reservePrivateFile(file) {
  const handle = await open(file, "wx", 0o600);
  await handle.close();
}

function waitForRestoreDatabase(container) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      dockerExecutable,
      [
        "--host",
        dockerEndpoint,
        "exec",
        container,
        "pg_isready",
        "--username",
        "postgres",
        "--dbname",
        "postgres",
      ],
      { env: safeEnvironment, stdio: "ignore" },
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  fail("Isolated restore database did not become ready.");
}

async function proveRestore(databaseDump, databaseImage, backupId) {
  const container = `descomplica-homologation-restore-${backupId.slice(-12)}`;
  const restorePassword = randomBytes(36).toString("base64url");
  try {
    docker(
      [
        "run",
        "--detach",
        "--name",
        container,
        "--network",
        "none",
        "--tmpfs",
        "/var/lib/postgresql/data:rw,nosuid,noexec,size=2g",
        "--env",
        `POSTGRES_PASSWORD=${restorePassword}`,
        databaseImage,
      ],
      "Isolated restore container creation",
    );
    waitForRestoreDatabase(container);
    docker(["exec", container, "createdb", "--username", "postgres", "restore"], "Restore DB");
    docker(["cp", databaseDump, `${container}:/tmp/database.dump`], "Restore copy");
    docker(
      [
        "exec",
        container,
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "--username",
        "supabase_admin",
        "--dbname",
        "restore",
        "/tmp/database.dump",
      ],
      "Isolated database restore",
    );
    const restored = JSON.parse(
      docker(
        [
          "exec",
          container,
          "psql",
          "-X",
          "--no-psqlrc",
          "--quiet",
          "--tuples-only",
          "--no-align",
          "--username",
          "postgres",
          "--dbname",
          "restore",
          "--command",
          `select jsonb_build_object(
            'historyCount', (select count(*) from supabase_migrations.schema_migrations),
            'candidateCount', (select count(*) from supabase_migrations.schema_migrations where version = '20260828135947'),
            'pageCount', (select count(*) from public.app_pages)
          );`,
        ],
        "Isolated restore proof",
      ).trim(),
    );
    const networkMode = docker(
      ["inspect", "--format", "{{.HostConfig.NetworkMode}}", container],
      "Restore network proof",
    ).trim();
    if (
      restored.historyCount !== expectedHistoryCount ||
      restored.candidateCount !== 0 ||
      restored.pageCount !== 17 ||
      networkMode !== "none"
    ) {
      fail("Isolated restore contents or network boundary are invalid.");
    }
    return restored;
  } finally {
    restorePassword.fill?.(0);
    spawnSync(dockerExecutable, ["--host", dockerEndpoint, "rm", "--force", container], {
      env: safeEnvironment,
      stdio: "ignore",
    });
  }
}

async function main() {
  const sourceSha = await assertBoundary();
  await mkdir(backupParent, { recursive: true, mode: 0o700 });
  await chmod(backupParent, 0o700);
  const createdAt = new Date().toISOString();
  const backupId = `${createdAt.replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")}-${randomBytes(6).toString("hex")}`;
  const backupRoot = path.join(backupParent, backupId);
  await mkdir(backupRoot, { mode: 0o700 });
  const databaseDump = path.join(backupRoot, "database.dump");
  const historyFile = path.join(backupRoot, "migration-history.sql");
  const configurationFile = path.join(backupRoot, "homologation-config.tar");
  const imageFile = path.join(backupRoot, "current-image.tar");
  try {
    const databaseImage = docker(
      ["inspect", "--format", "{{.Config.Image}}", databaseContainer],
      "Database image inventory",
    ).trim();
    const appImage = docker(
      ["inspect", "--format", "{{.Image}}", appContainer],
      "Application image inventory",
    ).trim();
    if (!databaseImage || !/^sha256:[0-9a-f]{64}$/u.test(appImage)) {
      fail("Homologation image inventory is invalid.");
    }
    await dockerToFile(
      [
        "exec",
        databaseContainer,
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--username",
        "postgres",
        "--dbname",
        "postgres",
      ],
      databaseDump,
      "Database backup",
    );
    const history = psql(
      "postgres",
      `select coalesce(jsonb_pretty(jsonb_agg(jsonb_build_object('version', version, 'name', name) order by version)), '[]')
       from supabase_migrations.schema_migrations;`,
      "Migration history backup",
    );
    await writeFile(historyFile, `${history}\n`, { mode: 0o600, flag: "wx" });
    await reservePrivateFile(configurationFile);
    run(
      "/usr/bin/tar",
      ["--create", "--file", configurationFile, "--absolute-names", ...configurationSources],
      "Configuration backup",
    );
    await chmod(configurationFile, 0o600);
    await reservePrivateFile(imageFile);
    docker(["image", "save", "--output", imageFile, appImage], "Application image backup");
    await chmod(imageFile, 0o600);

    const restored = await proveRestore(databaseDump, databaseImage, backupId);
    const artifacts = await Promise.all([
      artifact(databaseDump, "database"),
      artifact(historyFile, "migration-history"),
      artifact(configurationFile, "configuration"),
      artifact(imageFile, "image"),
    ]);
    const databaseArtifact = artifacts.find(({ kind }) => kind === "database");
    const proof = {
      schemaVersion: 1,
      environment: "isolated-homologation",
      sourceSha,
      backupId,
      createdAt,
      artifacts,
      restore: {
        result: "passed",
        isolated: true,
        networkCount: 0,
        historyCount: restored.historyCount,
        candidateCount: restored.candidateCount,
        databaseArtifact: databaseArtifact.file,
        databaseSha256: databaseArtifact.sha256,
        testedAt: new Date().toISOString(),
      },
      runtime: { previousImageId: appImage },
    };
    validateBackupProof(proof, {
      expectedSha: sourceSha,
      expectedBackupId: backupId,
      expectedHistoryCount,
    });
    const proofPath = path.join(backupRoot, "restore-proof.json");
    await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    const allFiles = [...artifacts.map(({ file }) => file), "restore-proof.json"];
    const checksumLines = [];
    for (const file of allFiles) {
      checksumLines.push(`${await sha256File(path.join(backupRoot, file))}  ${file}`);
    }
    const checksumPath = path.join(backupRoot, "SHA256SUMS");
    await writeFile(checksumPath, `${checksumLines.join("\n")}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    process.stdout.write(
      `${JSON.stringify({
        environment: "isolated-homologation",
        sourceSha,
        backupId,
        checksumManifest: checksumPath,
        historyCount: restored.historyCount,
        candidateCount: restored.candidateCount,
        restore: "passed",
        secretsPrinted: false,
      })}\n`,
    );
  } catch (error) {
    await rm(backupRoot, { recursive: true, force: true });
    throw error;
  }
}

main().catch(() => {
  process.stderr.write("Homologation legacy canary backup failed; secrets=not-printed.\n");
  process.exitCode = 1;
});
