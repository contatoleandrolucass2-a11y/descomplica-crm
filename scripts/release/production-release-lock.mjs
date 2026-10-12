import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

export const productionLockPath = "/etc/descomplica-crm/.production-image-binding.lock";
export const productionLockPaths = Object.freeze([
  "/etc/descomplica-crm/.production-deploy.lock",
  "/etc/descomplica-crm/.production-release.lock",
  productionLockPath,
]);
const heldLocks = new WeakMap();

export async function validatePrivateDirectory(directory, owner = 0) {
  const info = await lstat(directory);
  if (
    (await realpath(directory)) !== directory ||
    !info.isDirectory() ||
    info.uid !== owner ||
    info.gid !== (owner === 0 ? 0 : process.getgid()) ||
    (info.mode & 0o022) !== 0
  ) {
    throw new Error("Release directory must be real, owned by the operator, and protected.");
  }
}

export function validatePrivateFile(info, owner = 0) {
  if (
    !info.isFile() ||
    info.uid !== owner ||
    info.gid !== (owner === 0 ? 0 : process.getgid()) ||
    info.nlink !== 1 ||
    (info.mode & 0o777) !== 0o600
  ) {
    throw new Error("Release file must be a private regular file (0600, single link).");
  }
}

export function waitForProcess(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error(label)));
    child.once("close", (code, signal) => {
      if (code !== 0 || signal) reject(new Error(label));
      else resolve();
    });
  });
}

// flock acts on the inherited open file description. The parent keeps that
// description alive across the entire transaction, including recovery. There
// is no CLI/environment marker that can claim a lock is already held.
export async function withFileLock(lockPath, action, owner = 0) {
  await validatePrivateDirectory(path.dirname(lockPath), owner);
  let handle;
  try {
    try {
      handle = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600);
      await handle.sync();
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      handle = await open(lockPath, constants.O_RDWR | constants.O_NOFOLLOW);
    }
    validatePrivateFile(await handle.stat(), owner);
    await waitForProcess(
      spawn("/usr/bin/flock", ["--exclusive", "--nonblock", "3"], {
        env: { PATH: "/usr/bin:/bin" },
        stdio: ["ignore", "ignore", "ignore", handle.fd],
      }),
      "Another production operation holds the lock, or flock is unavailable.",
    );
    const token = Object.freeze({});
    heldLocks.set(token, { handle, lockPath, owner });
    try {
      await assertHeldLock(token, lockPath);
      return await action(token);
    } finally {
      heldLocks.delete(token);
    }
  } finally {
    await handle?.close();
  }
}

export async function assertHeldLock(token, expectedPath = productionLockPath) {
  const lock = heldLocks.get(token);
  if (!lock || lock.lockPath !== expectedPath) throw new Error("A live release lock is required.");
  const [opened, current] = await Promise.all([lock.handle.stat(), lstat(lock.lockPath)]);
  if (current.isSymbolicLink() || opened.ino !== current.ino || opened.dev !== current.dev) {
    throw new Error("Release lock inode changed; stop and reconcile.");
  }
  validatePrivateFile(opened, lock.owner);
  validatePrivateFile(current, lock.owner);
  for (const companion of lock.companions ?? []) {
    const entry = heldLocks.get(companion);
    if (!entry) throw new Error("A companion release lock was lost.");
    await assertHeldLock(companion, entry.lockPath);
  }
}

export function inheritedLockDescriptor(token) {
  const lock = heldLocks.get(token);
  if (!lock) throw new Error("A live release lock is required.");
  return lock.handle.fd;
}

export function inheritedLockDescriptors(token) {
  const lock = heldLocks.get(token);
  if (!lock) throw new Error("A live release lock is required.");
  return [lock.handle.fd, ...(lock.companions ?? []).map(inheritedLockDescriptor)];
}

export async function withFileLocks(paths, action, owner = 0) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length) {
    throw new Error("Distinct release lock paths are required.");
  }
  const tokens = [];
  async function acquire(index) {
    return withFileLock(
      paths[index],
      async (token) => {
        tokens.push(token);
        if (index + 1 < paths.length) return acquire(index + 1);
        heldLocks.get(token).companions = tokens.slice(0, -1);
        await assertHeldLock(token, paths[index]);
        return action(token);
      },
      owner,
    );
  }
  return acquire(0);
}

export function withProductionLock(action) {
  if (process.platform !== "linux" || process.getuid?.() !== 0) {
    throw new Error("Production release requires Linux and root.");
  }
  return withFileLocks(productionLockPaths, action);
}
