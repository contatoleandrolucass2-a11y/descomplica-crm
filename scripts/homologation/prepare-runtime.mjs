import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chown, chmod, cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const stagingRoot = `/var/lib/.descomplica-crm-homologation.tmp-${process.pid}`;
const runtimeSupabase = path.join(stagingRoot, "supabase");
const accessPath = "/etc/descomplica-crm/homologation-access.json";
const htpasswdPath = "/etc/nginx/.htpasswd-descomplica-homologation";
const accessTemporary = `${accessPath}.tmp-${process.pid}`;
const htpasswdTemporary = `${htpasswdPath}.tmp-${process.pid}`;
const origin = "https://homolog.descomplicapro.com.br";

async function mustNotExist(target, label) {
  try {
    await stat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} already exists; use the documented rollback before reprovisioning.`);
}

async function writePrivateFile(destination, contents, mode) {
  await writeFile(destination, contents, { encoding: "utf8", mode, flag: "wx" });
  await chmod(destination, mode);
}

async function main() {
  if (process.getuid?.() !== 0) throw new Error("Homologation runtime preparation requires root.");
  await mustNotExist(runtimeRoot, "Homologation runtime");
  await mustNotExist(stagingRoot, "Homologation runtime staging");
  await mustNotExist(accessPath, "Homologation access file");
  await mustNotExist(htpasswdPath, "Homologation password file");
  await mustNotExist(accessTemporary, "Homologation access staging");
  await mustNotExist(htpasswdTemporary, "Homologation password staging");

  const worktreeStatus = execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  if (worktreeStatus.length !== 0) {
    throw new Error("Homologation runtime requires a clean, fully committed worktree.");
  }

  await mkdir(runtimeSupabase, { recursive: true, mode: 0o700 });
  await cp(
    path.join(repositoryRoot, "deploy/homologation/supabase.config.toml"),
    path.join(runtimeSupabase, "config.toml"),
    { errorOnExist: true },
  );
  await cp(
    path.join(repositoryRoot, "supabase/migrations"),
    path.join(runtimeSupabase, "migrations"),
    {
      recursive: true,
      errorOnExist: true,
    },
  );
  await cp(
    path.join(repositoryRoot, "supabase/templates"),
    path.join(runtimeSupabase, "templates"),
    {
      recursive: true,
      errorOnExist: true,
    },
  );
  // Auth fetches this non-secret template through Kong as an unprivileged
  // process. Restrictive checkout umasks must not turn that fetch into 403.
  await chmod(path.join(runtimeSupabase, "templates/recovery.html"), 0o644);

  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  await writePrivateFile(
    path.join(stagingRoot, "manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        environment: "isolated-homologation",
        sourceSha,
        dataClassification: "synthetic-only",
      },
      null,
      2,
    )}\n`,
    0o600,
  );

  const username = "descomplica-qa";
  const password = `${randomBytes(36).toString("base64url")}aA1!`;
  const passwordHash = spawnSync("openssl", ["passwd", "-6", "-stdin"], {
    input: `${password}\n`,
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  if (passwordHash.error || passwordHash.status !== 0 || !passwordHash.stdout.trim()) {
    throw new Error("Could not create protected homologation access material.");
  }

  await writePrivateFile(htpasswdTemporary, `${username}:${passwordHash.stdout.trim()}\n`, 0o640);
  const nginxGroup = Number(execFileSync("id", ["-g", "www-data"], { encoding: "utf8" }).trim());
  await chown(htpasswdTemporary, 0, nginxGroup);
  await writePrivateFile(
    accessTemporary,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        environment: "isolated-homologation",
        origin,
        username,
        password,
      },
      null,
      2,
    )}\n`,
    0o600,
  );

  let runtimePromoted = false;
  let passwordPromoted = false;
  let accessPromoted = false;
  try {
    await rename(stagingRoot, runtimeRoot);
    runtimePromoted = true;
    await rename(htpasswdTemporary, htpasswdPath);
    passwordPromoted = true;
    await rename(accessTemporary, accessPath);
    accessPromoted = true;
  } catch (error) {
    if (accessPromoted) await rm(accessPath, { force: true });
    if (passwordPromoted) await rm(htpasswdPath, { force: true });
    if (runtimePromoted) await rm(runtimeRoot, { recursive: true, force: true });
    throw error;
  }

  process.stdout.write("Homologation runtime prepared: secrets=private data=synthetic-only\n");
}

try {
  await main();
} catch (error) {
  await rm(stagingRoot, { recursive: true, force: true });
  await rm(accessTemporary, { force: true });
  await rm(htpasswdTemporary, { force: true });
  const message = error instanceof Error ? error.message : "Unknown preparation failure.";
  process.stderr.write(`Homologation runtime preparation failed: ${message}\n`);
  process.exitCode = 1;
}
