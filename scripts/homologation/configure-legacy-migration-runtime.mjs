import { randomBytes } from "node:crypto";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { enterRuntimeStateLock } from "./runtime-state-lock.mjs";

const destination = "/etc/descomplica-crm/homologation.env";
const destinationDirectory = path.dirname(destination);
const managedValues = new Map([
  ["LEGACY_MIGRATION_RUNTIME_MODE", "off"],
  ["LEGACY_MIGRATION_ENABLED_MODULES", ""],
]);
const managedLine =
  /^(LEGACY_MIGRATION_RUNTIME_MODE|LEGACY_MIGRATION_ENABLED_MODULES)=[^\r\n]*(?=\r?$)/gmu;

export function transformLegacyMigrationRuntimeEnvironment(contents, command) {
  if (command !== "disable") {
    throw new Error("Legacy migration runtime command must be disable.");
  }
  if (typeof contents !== "string" || contents.includes("\0")) {
    throw new Error("Homologation environment contents are invalid.");
  }

  const occurrences = new Map([...managedValues.keys()].map((name) => [name, 0]));
  for (const match of contents.matchAll(managedLine)) {
    const name = match[1];
    occurrences.set(name, (occurrences.get(name) ?? 0) + 1);
  }
  if ([...occurrences.values()].some((count) => count !== 1)) {
    throw new Error("Homologation environment must contain each legacy migration key once.");
  }

  return contents.replace(managedLine, (_line, name) => `${name}=${managedValues.get(name)}`);
}

async function validateDestination() {
  const directoryMetadata = await lstat(destinationDirectory);
  if (
    !directoryMetadata.isDirectory() ||
    directoryMetadata.isSymbolicLink() ||
    directoryMetadata.uid !== 0 ||
    directoryMetadata.gid !== 0 ||
    (directoryMetadata.mode & 0o022) !== 0
  ) {
    throw new Error("Homologation configuration directory must be root-owned and not writable.");
  }

  const metadata = await lstat(destination);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0 ||
    (metadata.mode & 0o777) !== 0o600
  ) {
    throw new Error("Homologation environment must be root:root mode 0600.");
  }
}

async function assertDestinationUnchanged(expectedContents) {
  await validateDestination();
  if ((await readFile(destination, "utf8")) !== expectedContents) {
    throw new Error("Homologation environment changed during legacy runtime configuration.");
  }
}

async function main(arguments_) {
  if (process.getuid?.() !== 0) {
    throw new Error("Legacy migration runtime configuration requires root.");
  }
  if (arguments_.length !== 1 || arguments_[0] !== "disable") {
    throw new Error("Use exactly: disable.");
  }

  await validateDestination();
  const originalContents = await readFile(destination, "utf8");
  const transformed = transformLegacyMigrationRuntimeEnvironment(originalContents, arguments_[0]);
  const temporary = `${destination}.tmp-${process.pid}-${randomBytes(12).toString("hex")}`;
  let temporaryCreated = false;
  try {
    const handle = await open(temporary, "wx", 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(transformed, "utf8");
      await handle.chown(0, 0);
      await handle.chmod(0o600);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await assertDestinationUnchanged(originalContents);
    await rename(temporary, destination);
    const directory = await open(destinationDirectory, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    await assertDestinationUnchanged(transformed);
  } finally {
    if (temporaryCreated) await rm(temporary, { force: true });
  }

  process.stdout.write("Homologation legacy migration runtime disabled.\n");
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
    process.stderr.write(
      "Homologation legacy migration runtime configuration failed; values not printed.\n",
    );
    process.exitCode = 1;
  });
}
