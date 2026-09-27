import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { enterRuntimeStateLock } from "./runtime-state-lock.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const destination = path.join(runtimeRoot, "manifest.json");
const commandEnvironment = Object.freeze({
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
});

export function transformRuntimeReleaseManifest(contents, expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha ?? "")) {
    throw new Error(
      "Expected release SHA must contain exactly forty lowercase hexadecimal digits.",
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(contents);
  } catch {
    throw new Error("Homologation runtime manifest is invalid.");
  }
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== 1 ||
    manifest.environment !== "isolated-homologation" ||
    manifest.dataClassification !== "synthetic-only" ||
    !/^[0-9a-f]{40}$/u.test(manifest.sourceSha ?? "")
  ) {
    throw new Error("Homologation runtime manifest contract is invalid.");
  }

  return `${JSON.stringify({ ...manifest, sourceSha: expectedSha }, null, 2)}\n`;
}

function parseExpectedSha(arguments_) {
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== "--expected-sha" ||
    !/^[0-9a-f]{40}$/u.test(arguments_[1] ?? "")
  ) {
    throw new Error("Use exactly: --expected-sha <forty-character Git SHA>.");
  }
  return arguments_[1];
}

async function capturedGit(arguments_, label) {
  try {
    return await execFileAsync("git", arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: commandEnvironment,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new Error(label);
  }
}

async function verifyReleaseBoundary(expectedSha) {
  const [{ stdout: headOutput }, { stdout: statusOutput }] = await Promise.all([
    capturedGit(["rev-parse", "HEAD"], "Runtime release Git SHA is unavailable."),
    capturedGit(
      ["status", "--porcelain=v1", "--untracked-files=all"],
      "Runtime release worktree status is unavailable.",
    ),
  ]);
  if (headOutput.trim() !== expectedSha || statusOutput !== "") {
    throw new Error("Runtime release binding requires the exact clean checked-out Git SHA.");
  }
}

async function validateRuntimeStorage() {
  const directoryMetadata = await lstat(runtimeRoot);
  if (
    !directoryMetadata.isDirectory() ||
    directoryMetadata.isSymbolicLink() ||
    directoryMetadata.uid !== 0 ||
    directoryMetadata.gid !== 0 ||
    (directoryMetadata.mode & 0o777) !== 0o700
  ) {
    throw new Error("Homologation runtime directory must be root:root mode 0700.");
  }

  const metadata = await lstat(destination);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    throw new Error("Homologation runtime manifest must be root:root mode 0600.");
  }
}

async function assertManifestUnchanged(expectedContents) {
  await validateRuntimeStorage();
  if ((await readFile(destination, "utf8")) !== expectedContents) {
    throw new Error("Homologation runtime manifest changed during release binding.");
  }
}

async function writeManifestAtomically(contents) {
  const temporary = `${destination}.tmp-${process.pid}-${randomBytes(12).toString("hex")}`;
  let temporaryCreated = false;
  try {
    const handle = await open(temporary, "wx", 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(contents, "utf8");
      await handle.chown(0, 0);
      await handle.chmod(0o600);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, destination);
    const directory = await open(runtimeRoot, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    if (temporaryCreated) await rm(temporary, { force: true });
  }
}

async function restoreManifestAfterFailedPostcondition(originalContents, transformedContents) {
  await assertManifestUnchanged(transformedContents);
  await writeManifestAtomically(originalContents);
  await assertManifestUnchanged(originalContents);
}

async function main(arguments_) {
  if (process.getuid?.() !== 0) {
    throw new Error("Runtime release binding requires root.");
  }
  const expectedSha = parseExpectedSha(arguments_);
  await verifyReleaseBoundary(expectedSha);
  await validateRuntimeStorage();
  const originalContents = await readFile(destination, "utf8");
  const transformed = transformRuntimeReleaseManifest(originalContents, expectedSha);

  await verifyReleaseBoundary(expectedSha);
  await assertManifestUnchanged(originalContents);
  await writeManifestAtomically(transformed);
  try {
    await verifyReleaseBoundary(expectedSha);
    await assertManifestUnchanged(transformed);
  } catch (error) {
    await restoreManifestAfterFailedPostcondition(originalContents, transformed);
    throw error;
  }

  process.stdout.write("Homologation runtime release manifest bound.\n");
}

async function dispatch() {
  const state = await enterRuntimeStateLock({
    arguments_: process.argv.slice(2),
    scriptPath: fileURLToPath(import.meta.url),
  });
  if (!state.delegated) await main(state.arguments_);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  dispatch().catch(() => {
    process.stderr.write("Homologation runtime release binding failed; manifest not printed.\n");
    process.exitCode = 1;
  });
}
