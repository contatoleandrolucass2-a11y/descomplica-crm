import { constants } from "node:fs";
import { lstat, open, readFile, realpath, rename, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import { salesforceInventorySchema } from "../../lib/crm/salesforce/inventory-contract.ts";
import { throwIfSalesforceAborted } from "./report-request.mjs";

export const inventoryDirectory = "/var/lib/descomplica-salesforce-inventory";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function inventoryPublisherUid() {
  const entries = (await readFile("/etc/passwd", "utf8"))
    .split("\n")
    .map((line) => line.split(":"))
    .filter(([name]) => name === "descomplica-salesforce");
  const uid = Number(entries[0]?.[2]);
  if (entries.length !== 1 || !Number.isSafeInteger(uid) || uid <= 0)
    throw new Error("Inventory publisher identity unavailable");
  return uid;
}

export async function validateInventoryDirectory(directory, owner, group = 0) {
  const metadata = await lstat(directory);
  if (
    (await realpath(directory)) !== directory ||
    !metadata.isDirectory() ||
    metadata.uid !== owner ||
    metadata.gid !== group ||
    (metadata.mode & 0o7777) !== 0o2710
  )
    throw new Error("Inventory directory ownership or mode invalid");
}

export async function readPublishedInventory(directory, owner, group = 0) {
  const handle = await open(
    path.join(directory, "current.json"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.nlink !== 1 ||
      metadata.uid !== owner ||
      metadata.gid !== group ||
      (metadata.mode & 0o7777) !== 0o640 ||
      metadata.size <= 0 ||
      metadata.size > 8 * 1024 * 1024
    )
      throw new Error("Inventory file ownership or size invalid");
    const bytes = await handle.readFile();
    const payload = salesforceInventorySchema.parse(JSON.parse(bytes));
    if (Date.parse(payload.generatedAt) > Date.now() + 5000)
      throw new Error("Inventory timestamp is in the future");
    return { bytes, payload, hash: hash(bytes) };
  } finally {
    await handle.close();
  }
}

async function replace(directory, name, bytes, owner, group) {
  const temporary = path.join(directory, `.${name}-${randomUUID()}.tmp`);
  try {
    const handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o640,
    );
    try {
      await handle.chmod(0o640);
      const metadata = await handle.stat();
      if (metadata.uid !== owner || metadata.gid !== group || metadata.nlink !== 1)
        throw new Error("Inventory writer ownership invalid");
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path.join(directory, name));
    const parent = await open(directory, constants.O_RDONLY);
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

// Called only while exportInventory owns the shared commercial export lock.
// The dedicated collector can write this data directory; the app mounts it read-only.
export async function publishInventory(candidate, options = {}) {
  const directory = options.directory ?? inventoryDirectory;
  const owner = options.owner ?? (await inventoryPublisherUid());
  const group = options.group ?? 0;
  const now = options.now ?? Date.now;
  if (process.getuid?.() !== owner)
    throw new Error("Inventory publisher must run as its dedicated user");
  await validateInventoryDirectory(directory, owner, group);
  const payload = salesforceInventorySchema.parse({ ...candidate, collectionMode: "automatic" });
  const age = now() - Date.parse(payload.generatedAt);
  if (age < 0 || age > 10 * 60_000) throw new Error("Inventory candidate is not fresh");
  const bytes = Buffer.from(JSON.stringify(payload));
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Inventory candidate is too large");
  let previous;
  try {
    previous = await readPublishedInventory(directory, owner, group);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous?.hash === hash(bytes)) return { published: false, hash: previous.hash };
  if (previous && Date.parse(previous.payload.generatedAt) >= Date.parse(payload.generatedAt))
    throw new Error("Inventory candidate does not advance the published collection");
  throwIfSalesforceAborted(options.signal);
  if (previous) {
    await replace(directory, "previous.json", previous.bytes, owner, group);
    if ((await readPublishedInventory(directory, owner, group)).hash !== previous.hash)
      throw new Error("Inventory publication changed concurrently");
  }
  throwIfSalesforceAborted(options.signal);
  await replace(directory, "current.json", bytes, owner, group);
  const installed = await readPublishedInventory(directory, owner, group);
  if (installed.hash !== hash(bytes)) throw new Error("Inventory publication not confirmed");
  return {
    published: true,
    hash: installed.hash,
    generatedAt: payload.generatedAt,
    count: payload.count,
  };
}
