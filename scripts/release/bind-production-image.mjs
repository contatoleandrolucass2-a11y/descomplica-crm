import { execFile, spawn } from "node:child_process";
import { isUtf8 } from "node:buffer";
import { constants } from "node:fs";
import { lstat, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const destination = "/etc/descomplica-crm/production.env";
const destinationDirectory = path.dirname(destination);
const lockPath = "/etc/descomplica-crm/.production-image-binding.lock";
const lockMarker = "--production-image-binding-lock-held";
const dockerSocketPath = "/var/run/docker.sock";
const dockerEndpoint = "unix:///var/run/docker.sock";
const dockerExecutable = "/usr/bin/docker";
const flockExecutable = "/usr/bin/flock";
const safeEnvironment = Object.freeze({
  DOCKER_HOST: dockerEndpoint,
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
});
const shaPattern = /^[0-9a-f]{40}$/u;
const imageIdPattern = /^sha256:[0-9a-f]{64}$/u;
const imageTagLinePattern = /^IMAGE_TAG=([^\r\n]*)(?=\r?$)/gmu;
const anyImageTagAssignmentPattern = /^(?:\s*export\s+)?\s*IMAGE_TAG\s*=/u;

function fail(message) {
  throw new Error(message);
}

export function transformProductionImageEnvironment(contents, expectedOldSha, newSha) {
  if (!shaPattern.test(expectedOldSha ?? "") || !shaPattern.test(newSha ?? "")) {
    fail("Production image binding requires exact forty-character Git SHAs.");
  }
  if (typeof contents !== "string" || contents.includes("\0")) {
    fail("Production environment contents are invalid.");
  }

  const matches = [...contents.matchAll(imageTagLinePattern)];
  const assignmentCount = contents
    .split(/\r?\n/u)
    .filter((line) => anyImageTagAssignmentPattern.test(line)).length;
  if (assignmentCount !== 1 || matches.length !== 1 || matches[0][1] !== expectedOldSha) {
    fail("Production IMAGE_TAG does not match the exact expected old SHA once.");
  }
  const match = matches[0];
  const start = match.index;
  const end = start + match[0].length;
  return `${contents.slice(0, start)}IMAGE_TAG=${newSha}${contents.slice(end)}`;
}

export function parseProductionImageBindingArguments(arguments_) {
  if (
    arguments_[0] === "rollback" &&
    arguments_.length === 7 &&
    arguments_[1] === "--expected-current-sha" &&
    arguments_[3] === "--rollback-sha" &&
    arguments_[5] === "--expected-image-id" &&
    shaPattern.test(arguments_[2] ?? "") &&
    shaPattern.test(arguments_[4] ?? "") &&
    imageIdPattern.test(arguments_[6] ?? "")
  ) {
    return {
      operation: "rollback",
      expectedCurrentSha: arguments_[2],
      targetSha: arguments_[4],
      boundarySha: arguments_[2],
      expectedImageId: arguments_[6],
    };
  }
  if (
    arguments_.length !== 6 ||
    arguments_[0] !== "--expected-old-sha" ||
    arguments_[2] !== "--new-sha" ||
    arguments_[4] !== "--expected-image-id" ||
    !shaPattern.test(arguments_[1] ?? "") ||
    !shaPattern.test(arguments_[3] ?? "") ||
    !imageIdPattern.test(arguments_[5] ?? "")
  ) {
    fail(
      "Use exact bind arguments, or rollback with --expected-current-sha, --rollback-sha, and --expected-image-id.",
    );
  }
  return {
    operation: "bind",
    expectedCurrentSha: arguments_[1],
    targetSha: arguments_[3],
    boundarySha: arguments_[3],
    expectedImageId: arguments_[5],
  };
}

async function captured(command, arguments_, label) {
  try {
    return await execFileAsync(command, arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: safeEnvironment,
      maxBuffer: 1024 * 1024,
    });
  } catch {
    fail(label);
  }
}

async function verifyReleaseBoundary(boundarySha) {
  const [{ stdout: headOutput }, { stdout: statusOutput }] = await Promise.all([
    captured("git", ["rev-parse", "HEAD"], "Production release Git SHA is unavailable."),
    captured(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      "Production release worktree status is unavailable.",
    ),
  ]);
  if (headOutput.trim() !== boundarySha || statusOutput !== "") {
    fail("Production image binding requires the exact clean checked-out boundary Git SHA.");
  }
}

async function validateConfigurationDirectory() {
  const metadata = await lstat(destinationDirectory);
  if (
    (await realpath(destinationDirectory)) !== destinationDirectory ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o022) !== 0
  ) {
    fail("Production configuration directory must be real, root-owned, and not writable.");
  }
}

function validateRootPrivateRegularFile(metadata, label) {
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    metadata.nlink !== 1 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    fail(`${label} must be a root:root regular file with mode 0600.`);
  }
}

async function readValidatedEnvironment() {
  await validateConfigurationDirectory();
  const handle = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    validateRootPrivateRegularFile(await handle.stat(), "Production environment");
    const bytes = await handle.readFile();
    const validUtf8 = isUtf8(bytes);
    const contents = bytes.toString("utf8");
    bytes.fill(0);
    if (!validUtf8) {
      fail("Production environment must contain valid UTF-8 without byte loss.");
    }
    return contents;
  } finally {
    await handle.close();
  }
}

async function assertEnvironmentUnchanged(expectedContents) {
  if ((await readValidatedEnvironment()) !== expectedContents) {
    fail("Production environment changed during image binding.");
  }
}

async function validateDockerBoundary() {
  const socket = await lstat(dockerSocketPath);
  if (
    !socket.isSocket() ||
    socket.isSymbolicLink() ||
    socket.uid !== 0 ||
    (socket.mode & 0o007) !== 0
  ) {
    fail("Approved local Docker socket is unavailable or permissive.");
  }
}

async function verifyPromotableImage(newSha, expectedImageId) {
  await validateDockerBoundary();
  const image = `descomplica-crm:${newSha}`;
  const { stdout } = await captured(
    dockerExecutable,
    [
      "--host",
      dockerEndpoint,
      "image",
      "inspect",
      "--format",
      '{{.Id}}\t{{index .Config.Labels "org.opencontainers.image.revision"}}',
      image,
    ],
    "Approved production image inspection failed.",
  );
  const rows = stdout
    .trim()
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length !== 1) fail("Approved production image inspection is ambiguous.");
  const fields = rows[0].split("\t");
  if (fields.length !== 2 || fields[0] !== expectedImageId || fields[1] !== newSha) {
    fail("Production image ID or OCI revision differs from the homologated artifact.");
  }
}

async function writeEnvironmentAtomically(contents) {
  const temporary = `${destination}.tmp-${process.pid}-${process.hrtime.bigint().toString(16)}`;
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
    const directory = await open(destinationDirectory, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    if (temporaryCreated) await rm(temporary, { force: true });
  }
}

async function restoreEnvironmentAfterFailedPostcondition(originalContents, transformedContents) {
  const currentContents = await readValidatedEnvironment();
  if (currentContents === originalContents) return;
  if (currentContents !== transformedContents) {
    fail("Production environment changed while recovering a failed image binding.");
  }
  await writeEnvironmentAtomically(originalContents);
  await assertEnvironmentUnchanged(originalContents);
}

async function ensureLockFile() {
  await validateConfigurationDirectory();
  let handle;
  let created = false;
  try {
    try {
      handle = await open(lockPath, "wx", 0o600);
      created = true;
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      handle = await open(lockPath, constants.O_RDWR | constants.O_NOFOLLOW);
    }
    if (created) {
      await handle.chown(0, 0);
      await handle.chmod(0o600);
      await handle.sync();
    }
    validateRootPrivateRegularFile(await handle.stat(), "Production image binding lock");
  } finally {
    await handle?.close();
  }
  const metadata = await lstat(lockPath);
  if (metadata.isSymbolicLink()) fail("Production image binding lock path is invalid.");
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null || code !== 0) {
        reject(new Error("Production image binding lock child failed."));
        return;
      }
      resolve();
    });
  });
}

async function enterBindingLock(arguments_) {
  if (arguments_[0] === lockMarker) {
    return { delegated: false, arguments_: arguments_.slice(1) };
  }
  await ensureLockFile();
  const process_ = spawn(
    flockExecutable,
    [
      "--exclusive",
      "--timeout",
      "30",
      lockPath,
      process.execPath,
      fileURLToPath(import.meta.url),
      lockMarker,
      ...arguments_,
    ],
    { env: safeEnvironment, stdio: "inherit" },
  );
  await waitForChild(process_);
  return { delegated: true, arguments_: [] };
}

async function main(arguments_) {
  if (process.getuid?.() !== 0) fail("Production image binding requires root.");
  const { operation, expectedCurrentSha, targetSha, boundarySha, expectedImageId } =
    parseProductionImageBindingArguments(arguments_);
  await verifyReleaseBoundary(boundarySha);
  const originalContents = await readValidatedEnvironment();
  const transformedContents = transformProductionImageEnvironment(
    originalContents,
    expectedCurrentSha,
    targetSha,
  );
  await verifyPromotableImage(targetSha, expectedImageId);

  await verifyReleaseBoundary(boundarySha);
  await verifyPromotableImage(targetSha, expectedImageId);
  await assertEnvironmentUnchanged(originalContents);
  try {
    await writeEnvironmentAtomically(transformedContents);
    await verifyReleaseBoundary(boundarySha);
    await verifyPromotableImage(targetSha, expectedImageId);
    await assertEnvironmentUnchanged(transformedContents);
  } catch (error) {
    await restoreEnvironmentAfterFailedPostcondition(originalContents, transformedContents);
    throw error;
  }

  process.stdout.write(
    `Production image ${operation} completed; environment values not printed.\n`,
  );
}

async function dispatch() {
  if (process.getuid?.() !== 0) fail("Production image binding requires root.");
  const state = await enterBindingLock(process.argv.slice(2));
  if (!state.delegated) await main(state.arguments_);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  dispatch().catch(() => {
    process.stderr.write("Production image binding failed; environment values not printed.\n");
    process.exitCode = 1;
  });
}
