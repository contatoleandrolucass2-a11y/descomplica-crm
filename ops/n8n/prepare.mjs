import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT = "descomplica-n8n-crm";
export const DESTINATION = "/srv/descomplica-n8n";
// Official release verified 2026-10-12:
// https://github.com/n8n-io/n8n/releases/tag/n8n%402.42.7
export const IMAGES = Object.freeze({
  N8N_IMAGE: "n8nio/n8n:2.42.7",
  POSTGRES_IMAGE: "docker.io/library/postgres:17",
  RUNNERS_IMAGE: "n8nio/runners:2.42.7",
});

function command(program, args) {
  try {
    return execFileSync(program, args, {
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    // Never echo Docker output or inherited environment into an error/log.
    throw new Error(`Required local inspection failed: ${program}`);
  }
}

function exists(io, path) {
  try {
    io.lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function resolveImage(image, docker) {
  const [record] = JSON.parse(docker(["image", "inspect", image]));
  if (
    !record?.RepoTags?.includes(image) &&
    !(image === IMAGES.POSTGRES_IMAGE && record?.RepoTags?.includes("postgres:17"))
  ) {
    throw new Error("Expected official image tag is missing");
  }
  const repository = image.slice(0, image.lastIndexOf(":"));
  const aliases =
    repository === "docker.io/library/postgres"
      ? ["docker.io/library/postgres", "postgres"]
      : [repository];
  const digests = record.RepoDigests?.filter((value) =>
    aliases.some(
      (repo) =>
        value.startsWith(`${repo}@sha256:`) && /^[a-f0-9]{64}$/.test(value.split("@sha256:")[1]),
    ),
  );
  if (digests?.length !== 1) throw new Error("Official image digest missing or ambiguous");
  const pinned = `${repository}@${digests[0].split("@")[1]}`;
  const [resolved] = JSON.parse(docker(["image", "inspect", pinned]));
  if (!/^sha256:[a-f0-9]{64}$/.test(record.Id) || record.Id !== resolved?.Id) {
    throw new Error("Digest does not resolve to the local tagged image");
  }
  return pinned;
}

// Dependencies are injectable only for synthetic tests; the CLI accepts no options.
export function prepare({
  platform = process.platform,
  uid = process.getuid?.(),
  nodeVersion = process.versions.node,
  io = fs,
  run = command,
  random = randomBytes,
} = {}) {
  if (platform !== "linux" || uid !== 0) throw new Error("Linux root required");
  if (!/^24\.19\./.test(nodeVersion)) throw new Error("Node 24.19.x required");
  if (exists(io, DESTINATION)) throw new Error("Destination already exists; refusing reuse");
  const parent = io.lstatSync("/srv");
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== 0 || parent.mode & 0o022) {
    throw new Error("/srv must be a root-owned non-writable real directory");
  }
  for (const path of ["/.git", "/srv/.git"]) {
    if (exists(io, path)) throw new Error("Destination must be outside Git");
  }
  // Explicit local daemon prevents DOCKER_HOST/context selecting another machine.
  const docker = (args) => run("docker", ["--host", "unix:///var/run/docker.sock", ...args]);
  for (const [kind, format] of [
    ["container", "{{.Names}}"],
    ["volume", "{{.Name}}"],
    ["network", "{{.Name}}"],
  ]) {
    const prefix = [kind, "ls", ...(kind === "container" ? ["--all"] : [])];
    const names = docker([...prefix, "--format", format])
      .split(/\r?\n/)
      .filter(Boolean);
    if (
      names.some(
        (name) =>
          name === PROJECT || name.startsWith(`${PROJECT}-`) || name.startsWith(`${PROJECT}_`),
      )
    ) {
      throw new Error(`Project ${kind} already exists`);
    }
    if (
      docker([
        ...prefix,
        "--filter",
        `label=com.docker.compose.project=${PROJECT}`,
        "--quiet",
      ]).trim()
    ) {
      throw new Error(`Project ${kind} label already exists`);
    }
  }
  // Includes IPv4/IPv6, wildcard and non-loopback listeners; failure is fatal.
  if (run("ss", ["-H", "-ltn", "sport = :5678"]).trim()) throw new Error("TCP port 5678 occupied");
  // Also catch published ports when Docker uses NAT without a userspace listener.
  const containers = docker(["container", "ls", "--all", "--format", "json"])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (containers.length) {
    if (containers.some((item) => !/^[a-f0-9]+$/.test(item.ID)))
      throw new Error("Invalid Docker inventory");
    const records = docker([
      "container",
      "inspect",
      "--format",
      "{{json .HostConfig.PortBindings}}",
      ...containers.map((item) => item.ID),
    ])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if (
      records.length !== containers.length ||
      records.some(
        (record) => record !== null && (typeof record !== "object" || Array.isArray(record)),
      )
    ) {
      throw new Error("Incomplete Docker port inspection");
    }
    if (
      records.some((record) =>
        Object.values(record ?? {}).some((bindings) =>
          bindings?.some((binding) => binding.HostPort === "5678"),
        ),
      )
    ) {
      throw new Error("TCP port 5678 reserved by Docker");
    }
  }
  const images = Object.entries(IMAGES).map(
    ([key, image]) => `${key}=${resolveImage(image, docker)}`,
  );
  const template = io.readFileSync(new URL("./compose.yaml", import.meta.url), "utf8");
  const secrets = ["POSTGRES_PASSWORD", "N8N_ENCRYPTION_KEY", "N8N_RUNNERS_AUTH_TOKEN"].map(
    (key) => `${key}=${random(32).toString("hex")}`,
  );
  // Atomic mkdir is also the bootstrap lock. Partial failure deliberately leaves
  // the directory in place for manual inspection; a retry never overwrites it.
  io.mkdirSync(DESTINATION, { mode: 0o700 });
  io.writeFileSync(`${DESTINATION}/.env`, [...images, ...secrets, ""].join("\n"), {
    mode: 0o600,
    flag: "wx",
  });
  io.writeFileSync(`${DESTINATION}/compose.yaml`, template, { mode: 0o600, flag: "wx" });
  return { directory: DESTINATION, project: PROJECT, started: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw new Error("No CLI arguments accepted");
    prepare();
    console.log("Prepared /srv/descomplica-n8n only. Docker was not started.");
    console.log(
      "After authorized startup: SSH -L 5678:127.0.0.1:5678; open http://localhost:5678 and create owner before public exposure.",
    );
  } catch (error) {
    console.error(`Preparation refused: ${error.message}`);
    process.exitCode = 1;
  }
}
