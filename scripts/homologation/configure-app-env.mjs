import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, chown, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const runtimeRoot = "/var/lib/descomplica-crm-homologation";
const configurationDirectory = "/etc/descomplica-crm";
const destination = "/etc/descomplica-crm/homologation.env";
const secretDirectory = "/etc/descomplica-crm/secrets";
const sessionSecretSource = `${secretDirectory}/homologation-auth-session-cookie-secret`;
const officialSimulatorKeys = new Set([
  "simulator.wf13",
  "simulator.wf16",
  "simulator.caixa",
  "simulator.wf14",
  "simulator.wf15",
]);

function singleEnvironmentValue(contents, name) {
  const prefix = `${name}=`;
  const matches = contents
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length));
  if (matches.length > 1) {
    throw new Error(`Duplicate ${name} is not allowed.`);
  }
  return matches[0];
}

export function parseOfficialSimulatorRuntime(contents = "") {
  const mode = (
    singleEnvironmentValue(contents, "OFFICIAL_SIMULATOR_RUNTIME_MODE") ?? "off"
  ).trim();
  const rawKeys = singleEnvironmentValue(contents, "OFFICIAL_SIMULATOR_ENABLED_KEYS") ?? "";
  const keys = rawKeys ? rawKeys.split(",").map((key) => key.trim()) : [];
  if (!new Set(["off", "active"]).has(mode)) {
    throw new Error("Official simulator runtime mode is invalid.");
  }
  if (
    keys.some((key) => !key || !officialSimulatorKeys.has(key)) ||
    new Set(keys).size !== keys.length
  ) {
    throw new Error("Official simulator enabled keys are invalid.");
  }
  if ((mode === "off" && keys.length !== 0) || (mode === "active" && keys.length === 0)) {
    throw new Error("Official simulator mode and enabled keys are inconsistent.");
  }
  return { mode, enabledKeys: keys.join(",") };
}

async function ensureRootDirectory(directory, mode, label) {
  await mkdir(directory, { recursive: true, mode });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory.`);
  }
  await chown(directory, 0, 0);
  await chmod(directory, mode);
}

async function ensureSessionSecret() {
  await ensureRootDirectory(secretDirectory, 0o710, "Runtime secret directory");

  try {
    const metadata = await lstat(sessionSecretSource);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("Runtime session secret must be a regular file.");
    }
    const existing = (await readFile(sessionSecretSource, "utf8")).replace(/\r?\n$/, "");
    if (Buffer.byteLength(existing, "utf8") >= 32 && !/[\r\n\0]/u.test(existing)) {
      await chown(sessionSecretSource, 0, 0);
      await chmod(sessionSecretSource, 0o640);
      return;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Runtime session secret must be a regular file."
    ) {
      throw error;
    }
    // Missing or invalid secret is replaced atomically below. Its value is
    // never included in output or in the environment file.
  }

  const temporary = `${sessionSecretSource}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, `${randomBytes(48).toString("base64url")}\n`, {
      encoding: "utf8",
      mode: 0o640,
      flag: "wx",
    });
    await chown(temporary, 0, 0);
    await chmod(temporary, 0o640);
    await rename(temporary, sessionSecretSource);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function readOfficialSimulatorRuntime() {
  try {
    const metadata = await lstat(destination);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("Homologation environment must be a regular file.");
    }
    return parseOfficialSimulatorRuntime(await readFile(destination, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return parseOfficialSimulatorRuntime();
    }
    throw error;
  }
}

function extractSingleJsonObject(stdout) {
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  const objects = [];

  for (let index = 0; index < stdout.length; index += 1) {
    const character = stdout[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) objects.push(stdout.slice(start, index + 1));
    }
  }

  if (objects.length !== 1 || depth !== 0 || quoted) {
    throw new Error("Supabase status JSON is unavailable or ambiguous.");
  }
  const candidate = objects[0];
  const parsed = JSON.parse(candidate);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Supabase status JSON is invalid.");
  }
  return parsed;
}

async function main() {
  if (process.getuid?.() !== 0) throw new Error("App environment configuration requires root.");
  const imageTag = process.env.IMAGE_TAG;
  if (!/^[0-9a-f]{40}$/.test(imageTag ?? "")) {
    throw new Error("IMAGE_TAG must be a full immutable Git SHA.");
  }

  await ensureRootDirectory(configurationDirectory, 0o750, "Runtime configuration directory");
  const officialSimulatorRuntime = await readOfficialSimulatorRuntime();
  await ensureSessionSecret();

  const { stdout } = await execFileAsync(
    "pnpm",
    ["exec", "supabase", "status", "--output", "json", "--workdir", runtimeRoot],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      env: Object.fromEntries(
        ["PATH", "HOME", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR", "DOCKER_HOST"].flatMap((name) =>
          process.env[name] ? [[name, process.env[name]]] : [],
        ),
      ),
    },
  );
  const status = extractSingleJsonObject(stdout);
  const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (typeof publishableKey !== "string" || !/^[A-Za-z0-9._-]{20,2048}$/.test(publishableKey)) {
    throw new Error("Supabase publishable key is unavailable.");
  }

  const temporary = `${destination}.tmp-${process.pid}`;
  const contents = [
    `IMAGE_TAG=${imageTag}`,
    "SUPABASE_URL=http://kong:8000",
    `SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    "APP_ORIGIN=https://homolog.descomplicapro.com.br",
    `AUTH_SESSION_COOKIE_SECRET_SOURCE=${sessionSecretSource}`,
    `OFFICIAL_SIMULATOR_RUNTIME_MODE=${officialSimulatorRuntime.mode}`,
    `OFFICIAL_SIMULATOR_ENABLED_KEYS=${officialSimulatorRuntime.enabledKeys}`,
    "",
  ].join("\n");
  try {
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await chown(temporary, 0, 0);
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  process.stdout.write("Homologation app environment configured: secrets=not-printed\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await main();
  } catch {
    process.stderr.write("Homologation app environment failed; no diagnostic secrets emitted.\n");
    process.exitCode = 1;
  }
}
