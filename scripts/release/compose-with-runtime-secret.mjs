import { spawn } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dockerEnvironment = {
  DOCKER_HOST: "unix:///var/run/docker.sock",
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
};

const environments = {
  homologation: {
    compose: path.join(repositoryRoot, "deploy/homologation/compose.yaml"),
    environment: "/etc/descomplica-crm/homologation.env",
    environmentGroup: "root",
    environmentMode: 0o600,
    secret: "/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret",
    inventorySecret: "/etc/descomplica-crm/secrets/homologation-inventory-source-auth",
  },
  production: {
    compose: path.join(repositoryRoot, "compose.yaml"),
    environment: "/etc/descomplica-crm/production.env",
    environmentGroup: "root",
    environmentMode: 0o600,
    secret: "/etc/descomplica-crm/secrets/production-auth-session-cookie-secret",
    inventorySecret: "/etc/descomplica-crm/secrets/production-inventory-source-auth",
  },
};

const allowedInvocations = new Map([
  ["config", ["--quiet"]],
  ["down", ["--remove-orphans"]],
  ["ps", []],
  ["stop", []],
  ["up", ["-d", "--no-build", "--remove-orphans"]],
]);

function fail(message) {
  throw new Error(message);
}

async function groupId(name) {
  const groups = await readFile("/etc/group", "utf8");
  const match = groups
    .split(/\r?\n/u)
    .map((line) => line.split(":"))
    .find(([groupName]) => groupName === name);
  const id = Number(match?.[2]);
  if (!Number.isSafeInteger(id) || id < 0) fail(`Required group ${name} is unavailable.`);
  return id;
}

async function validateOwnedFile(filePath, expectedMode, expectedGroup, label) {
  if ((await realpath(filePath)) !== filePath) fail(`${label} path must not be a symlink.`);
  const metadata = await stat(filePath);
  if (
    !metadata.isFile() ||
    metadata.uid !== 0 ||
    metadata.gid !== expectedGroup ||
    (metadata.mode & 0o777) !== expectedMode
  ) {
    fail(`${label} ownership or mode is invalid.`);
  }
}

function declaredSecretSource(contents, name) {
  const prefix = `${name}=`;
  const matches = contents.split(/\r?\n/u).filter((line) => line.startsWith(prefix));
  return matches.length === 1 ? matches[0].slice(matches[0].indexOf("=") + 1) : null;
}

async function main() {
  if (process.getuid?.() !== 0) fail("Runtime Compose wrapper requires root.");
  const [environmentName, command, ...arguments_] = process.argv.slice(2);
  const configuration = environments[environmentName];
  const allowedArguments = allowedInvocations.get(command);
  if (!configuration || !command || !allowedArguments) {
    fail("Runtime Compose invocation is not allowed.");
  }
  if (
    arguments_.length !== allowedArguments.length ||
    arguments_.some((argument, index) => argument !== allowedArguments[index])
  ) {
    fail("Runtime Compose arguments are not allowlisted.");
  }

  const secretDirectory = "/etc/descomplica-crm/secrets";
  if ((await realpath(secretDirectory)) !== secretDirectory) {
    fail("Runtime secret directory must not be a symlink.");
  }
  const directoryMetadata = await stat(secretDirectory);
  if (
    !directoryMetadata.isDirectory() ||
    directoryMetadata.uid !== 0 ||
    directoryMetadata.gid !== 0 ||
    (directoryMetadata.mode & 0o777) !== 0o710
  ) {
    fail("Runtime secret directory must be root-owned with mode 0710.");
  }
  await validateOwnedFile(
    configuration.environment,
    configuration.environmentMode,
    await groupId(configuration.environmentGroup),
    "Runtime environment file",
  );
  const environmentContents = await readFile(configuration.environment, "utf8");
  if (
    declaredSecretSource(environmentContents, "AUTH_SESSION_COOKIE_SECRET_SOURCE") !==
      configuration.secret ||
    declaredSecretSource(environmentContents, "CRM_INVENTORY_SOURCE_AUTH_SOURCE") !==
      configuration.inventorySecret
  ) {
    fail("Runtime environment does not declare the approved secret source.");
  }
  await validateOwnedFile(configuration.secret, 0o640, 0, "Runtime secret file");
  await validateOwnedFile(configuration.inventorySecret, 0o640, 0, "Inventory source secret file");
  const secretBytes = await readFile(configuration.secret);
  const contentLength =
    secretBytes.at(-1) === 0x0a
      ? secretBytes.at(-2) === 0x0d
        ? secretBytes.length - 2
        : secretBytes.length - 1
      : secretBytes.length;
  const invalidContent = secretBytes
    .subarray(0, contentLength)
    .some((byte) => byte === 0x00 || byte === 0x0a || byte === 0x0d);
  if (contentLength < 32 || invalidContent) {
    secretBytes.fill(0);
    fail("Runtime secret content is invalid.");
  }
  secretBytes.fill(0);

  const child = spawn(
    "/usr/bin/docker",
    [
      "compose",
      "--env-file",
      configuration.environment,
      "-f",
      configuration.compose,
      command,
      ...arguments_,
    ],
    {
      cwd: repositoryRoot,
      env: dockerEnvironment,
      stdio: "inherit",
    },
  );
  child.once("error", () => {
    process.stderr.write("Docker Compose failed to start; secret not printed.\n");
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (code !== 0) {
      process.stderr.write(
        `Docker Compose failed (${signal ?? code ?? "unknown"}); secret not printed.\n`,
      );
      process.exitCode = code ?? 1;
    }
  });
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Runtime Compose wrapper failed."}\n`,
  );
  process.exitCode = 1;
}
