import { randomUUID } from "node:crypto";
import { lstat, open, readFile, unlink } from "node:fs/promises";
import process from "node:process";

import { hardenPrivateRegularFile } from "./private-file.mjs";
import { SalesforceCollectionError } from "./report-request.mjs";

export async function acquireExportLock(candidateOutput, options = {}) {
  const lockPath = `${candidateOutput}.lock`;
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    throw new SalesforceCollectionError(
      error?.code === "EEXIST" ? "SALESFORCE_EXPORT_LOCKED" : "SALESFORCE_LOCK_ERROR",
    );
  }
  let owned;
  const owner = JSON.stringify({ owner: randomUUID(), pid: process.pid });
  let released = false;
  const sameFile = async () => {
    if (!owned) return false;
    const current = await lstat(lockPath);
    return (
      current.isFile() &&
      !current.isSymbolicLink() &&
      current.dev === owned.dev &&
      current.ino === owned.ino
    );
  };
  try {
    owned = await handle.stat();
    await hardenPrivateRegularFile(lockPath, options.privateFileOptions);
    await handle.writeFile(owner, "utf8");
    await handle.sync();
  } catch {
    try {
      if (await sameFile()) await unlink(lockPath);
    } catch {
      // Ambiguous ownership or cleanup failures leave the lock closed for manual inspection.
    } finally {
      await handle.close();
    }
    throw new SalesforceCollectionError("SALESFORCE_LOCK_ERROR");
  }

  return async () => {
    if (released) return;
    try {
      if (!(await sameFile()) || (await readFile(lockPath, "utf8")) !== owner) {
        throw new SalesforceCollectionError("SALESFORCE_LOCK_OWNERSHIP");
      }
      await unlink(lockPath);
      released = true;
    } catch (error) {
      if (error instanceof SalesforceCollectionError) throw error;
      throw new SalesforceCollectionError("SALESFORCE_LOCK_ERROR");
    } finally {
      await handle.close();
    }
  };
}
