import { cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { sha256File } from "./auth-mfa-upgrade-lib.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const runtimeSupabaseRoot = path.join(runtimeRoot, "supabase");
const manifestPath = path.join(runtimeRoot, "manifest.json");
const candidateFile = "20260828135947_legacy_simulators_discador_master_canary.sql";

function fail(message) {
  throw new Error(message);
}

export function buildLegacyCanaryRuntimeManifest(previous, sourceSha) {
  if (
    previous?.schemaVersion !== 1 ||
    previous?.environment !== "isolated-homologation" ||
    previous?.dataClassification !== "synthetic-only" ||
    !/^[0-9a-f]{40}$/u.test(previous?.sourceSha ?? "") ||
    !/^[0-9a-f]{40}$/u.test(sourceSha)
  ) {
    fail("Homologation runtime manifest contract is invalid.");
  }
  return {
    schemaVersion: 1,
    environment: "isolated-homologation",
    sourceSha,
    dataClassification: "synthetic-only",
  };
}

async function assertSafeTree(root) {
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink() || (!metadata.isDirectory() && !metadata.isFile())) {
    fail("Versioned homologation runtime source contains an unsafe entry.");
  }
  if (!metadata.isDirectory()) return;
  for (const entry of await readdir(root)) await assertSafeTree(path.join(root, entry));
}

async function assertRuntimeBoundary() {
  if (process.getuid?.() !== 0) fail("Runtime synchronization requires root.");
  const { execFileSync } = await import("node:child_process");
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || status !== "") {
    fail("Runtime synchronization requires a clean full-SHA checkout.");
  }
  const runtimeMetadata = await stat(runtimeRoot);
  const manifestMetadata = await stat(manifestPath);
  if (
    !runtimeMetadata.isDirectory() ||
    runtimeMetadata.uid !== 0 ||
    runtimeMetadata.gid !== 0 ||
    (runtimeMetadata.mode & 0o077) !== 0 ||
    !manifestMetadata.isFile() ||
    manifestMetadata.uid !== 0 ||
    manifestMetadata.gid !== 0 ||
    (manifestMetadata.mode & 0o777) !== 0o600
  ) {
    fail("Homologation runtime ownership or permissions are unsafe.");
  }
  const previous = JSON.parse(await readFile(manifestPath, "utf8"));
  return { sourceSha, previous, next: buildLegacyCanaryRuntimeManifest(previous, sourceSha) };
}

async function main() {
  const { sourceSha, previous, next } = await assertRuntimeBoundary();
  const sourceConfig = path.join(repositoryRoot, "deploy/homologation/supabase.config.toml");
  const sourceMigrations = path.join(repositoryRoot, "supabase/migrations");
  const sourceTemplates = path.join(repositoryRoot, "supabase/templates");
  await Promise.all([
    assertSafeTree(sourceConfig),
    assertSafeTree(sourceMigrations),
    assertSafeTree(sourceTemplates),
  ]);
  await stat(path.join(sourceMigrations, candidateFile));

  const staging = path.join(runtimeRoot, `.release-contract-${process.pid}`);
  const backup = path.join(runtimeRoot, `.release-contract-previous-${process.pid}`);
  await mkdir(staging, { mode: 0o700 });
  await mkdir(backup, { mode: 0o700 });
  const targets = [
    {
      source: sourceConfig,
      staged: path.join(staging, "config.toml"),
      target: path.join(runtimeSupabaseRoot, "config.toml"),
      previous: path.join(backup, "config.toml"),
    },
    {
      source: sourceMigrations,
      staged: path.join(staging, "migrations"),
      target: path.join(runtimeSupabaseRoot, "migrations"),
      previous: path.join(backup, "migrations"),
    },
    {
      source: sourceTemplates,
      staged: path.join(staging, "templates"),
      target: path.join(runtimeSupabaseRoot, "templates"),
      previous: path.join(backup, "templates"),
    },
  ];
  let promoted = 0;
  let manifestPromoted = false;
  try {
    for (const target of targets) await cp(target.source, target.staged, { recursive: true });
    await writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    for (const target of targets) {
      await rename(target.target, target.previous);
      try {
        await rename(target.staged, target.target);
      } catch (error) {
        await rename(target.previous, target.target);
        throw error;
      }
      promoted += 1;
    }
    await rename(manifestPath, path.join(backup, "manifest.json"));
    try {
      await rename(path.join(staging, "manifest.json"), manifestPath);
    } catch (error) {
      await rename(path.join(backup, "manifest.json"), manifestPath);
      throw error;
    }
    manifestPromoted = true;
    const [runtimeHash, versionedHash] = await Promise.all([
      sha256File(path.join(runtimeSupabaseRoot, "migrations", candidateFile)),
      sha256File(path.join(sourceMigrations, candidateFile)),
    ]);
    if (runtimeHash !== versionedHash) fail("Runtime migration hash verification failed.");
    process.stdout.write(
      `${JSON.stringify({
        environment: "isolated-homologation",
        previousSha: previous.sourceSha,
        sourceSha,
        candidateVersion: "20260828135947",
        candidateHash: runtimeHash,
        secretsPrinted: false,
      })}\n`,
    );
  } catch (error) {
    if (manifestPromoted) {
      await rm(manifestPath, { force: true });
      await rename(path.join(backup, "manifest.json"), manifestPath);
    }
    for (let index = promoted - 1; index >= 0; index -= 1) {
      const target = targets[index];
      await rm(target.target, { recursive: true, force: true });
      await rename(target.previous, target.target);
    }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(backup, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write("Homologation runtime synchronization failed; secrets=not-printed.\n");
    process.exitCode = 1;
  });
}
