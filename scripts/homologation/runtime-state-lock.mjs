import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const runtimeStateLockPath = "/etc/descomplica-crm/.homologation-runtime-state.lock";

const configurationDirectory = path.dirname(runtimeStateLockPath);
const lockMarker = "--homologation-runtime-state-lock-held";
const flockPath = "/usr/bin/flock";
const safePath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

async function validateConfigurationDirectory() {
  const metadata = await lstat(configurationDirectory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o022) !== 0
  ) {
    throw new Error("Runtime configuration directory must be root-owned and not writable.");
  }
}

async function ensureRuntimeStateLockFile() {
  await validateConfigurationDirectory();

  let handle;
  let created = false;
  try {
    try {
      handle = await open(runtimeStateLockPath, "wx", 0o600);
      created = true;
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      handle = await open(runtimeStateLockPath, constants.O_RDWR | constants.O_NOFOLLOW);
    }

    if (created) {
      await handle.chown(0, 0);
      await handle.chmod(0o600);
      await handle.sync();
    }

    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.uid !== 0 ||
      metadata.gid !== 0 ||
      metadata.nlink !== 1 ||
      (metadata.mode & 0o777) !== 0o600
    ) {
      throw new Error("Homologation runtime state lock must be root:root mode 0600.");
    }
  } finally {
    await handle?.close();
  }

  const pathMetadata = await lstat(runtimeStateLockPath);
  if (
    !pathMetadata.isFile() ||
    pathMetadata.isSymbolicLink() ||
    pathMetadata.uid !== 0 ||
    pathMetadata.gid !== 0 ||
    pathMetadata.nlink !== 1 ||
    (pathMetadata.mode & 0o777) !== 0o600
  ) {
    throw new Error("Homologation runtime state lock path is invalid.");
  }
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Runtime state lock child stopped by ${signal}.`));
        return;
      }
      if (code !== 0) {
        reject(new Error("Runtime state lock child failed."));
        return;
      }
      resolve();
    });
  });
}

export async function enterRuntimeStateLock({ arguments_, environment = {}, scriptPath }) {
  if (process.getuid?.() !== 0) {
    throw new Error("Homologation runtime state lock requires root.");
  }
  if (!path.isAbsolute(scriptPath)) {
    throw new Error("Homologation runtime state script path must be absolute.");
  }

  if (arguments_[0] === lockMarker) {
    return { delegated: false, arguments_: arguments_.slice(1) };
  }

  await ensureRuntimeStateLockFile();
  const child = spawn(
    flockPath,
    [
      "--exclusive",
      "--timeout",
      "30",
      runtimeStateLockPath,
      process.execPath,
      scriptPath,
      lockMarker,
      ...arguments_,
    ],
    {
      env: { PATH: safePath, ...environment },
      stdio: "inherit",
    },
  );
  await waitForChild(child);
  return { delegated: true, arguments_: [] };
}
