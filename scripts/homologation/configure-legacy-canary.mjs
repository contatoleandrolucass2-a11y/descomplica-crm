import { chmod, chown, lstat, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const destination = "/etc/descomplica-crm/homologation.env";
const legacyKeys =
  "simulator.wf16,simulator.caixa,simulator.wf14,simulator.wf15,simulator.tabelao,dialer,dialer.weekend-forecast";
const simulatorKeys = "simulator.wf13,simulator.wf16,simulator.caixa,simulator.wf14,simulator.wf15";
const managedNames = new Set([
  "LEGACY_MIGRATION_RUNTIME_MODE",
  "LEGACY_MIGRATION_ENABLED_MODULES",
  "OFFICIAL_SIMULATOR_RUNTIME_MODE",
  "OFFICIAL_SIMULATOR_ENABLED_KEYS",
]);

export function transformLegacyCanaryEnvironment(contents, mode) {
  if (!new Set(["enable", "disable"]).has(mode)) {
    throw new Error("Legacy canary mode must be enable or disable.");
  }
  const seen = new Set();
  const retained = [];
  for (const line of contents.replace(/\r\n/gu, "\n").split("\n")) {
    const separator = line.indexOf("=");
    const name = separator < 0 ? "" : line.slice(0, separator);
    if (!managedNames.has(name)) {
      retained.push(line);
      continue;
    }
    if (seen.has(name)) throw new Error("Homologation environment has a duplicate managed key.");
    seen.add(name);
  }
  while (retained.at(-1) === "") retained.pop();
  const enabled = mode === "enable";
  return `${[
    ...retained,
    `OFFICIAL_SIMULATOR_RUNTIME_MODE=${enabled ? "active" : "off"}`,
    `OFFICIAL_SIMULATOR_ENABLED_KEYS=${enabled ? simulatorKeys : ""}`,
    `LEGACY_MIGRATION_RUNTIME_MODE=${enabled ? "active" : "off"}`,
    `LEGACY_MIGRATION_ENABLED_MODULES=${enabled ? legacyKeys : ""}`,
    "",
  ].join("\n")}`;
}

async function validateDestination() {
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

async function main() {
  if (process.getuid?.() !== 0) throw new Error("Legacy canary configuration requires root.");
  const mode = process.argv[2];
  await validateDestination();
  const contents = await readFile(destination, "utf8");
  const transformed = transformLegacyCanaryEnvironment(contents, mode);
  const temporary = `${destination}.tmp-${process.pid}`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(transformed, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await chown(temporary, 0, 0);
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
    const directory = await open(path.dirname(destination), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
  process.stdout.write(
    `Homologation legacy canary ${mode === "enable" ? "enabled" : "disabled"}.\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write("Homologation legacy canary configuration failed; values not printed.\n");
    process.exitCode = 1;
  });
}
