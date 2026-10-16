import { constants } from "node:fs";
import { lstat, open, readdir, readlink, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const qlikReleaseFiles = Object.freeze([
  "ops/qlik/launch-browser.mjs",
  "ops/qlik/browser-login.mjs",
  "ops/qlik/login-credential.mjs",
  "ops/qlik/prepare-login-credential.mjs",
  "ops/qlik/login-attempt.mjs",
  "ops/qlik/credential-vault.mjs",
  "ops/qlik/browser-preflight.mjs",
  "ops/qlik/qix-metadata.mjs",
  "ops/qlik/collection-loop.mjs",
  "ops/qlik/metadata-artifact.mjs",
  "ops/qlik/ranking-cycle.mjs",
  "ops/qlik/browser-ranking.mjs",
  "ops/qlik/qix-ranking.mjs",
  "ops/qlik/ranking-mapping.mjs",
  "ops/qlik/ranking-artifact.mjs",
  "ops/qlik/ranking-credential.mjs",
  "ops/qlik/publish-ranking.mjs",
  "ops/qlik/status-monitor.mjs",
  "lib/crm/qlik/status-contract.ts",
  "lib/crm/qlik/contracts-v2.ts",
  "ops/qlik/vps/descomplica-qlik-browser.service",
  "scripts/release/private-json-store.mjs",
  "scripts/release/production-release-lock.mjs",
  "package.json",
  "pnpm-lock.yaml",
]);
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const shaPattern = /^[a-f0-9]{40}$/u;
export const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
export const qlikCredentialPath = "/etc/descomplica-crm/secrets/qlik-ranking-hmac";
const home = "Environment=HOME=/var/lib/descomplica-qlik\n";
const loginCredentials =
  "LoadCredentialEncrypted=qlik-login:/etc/descomplica-qlik/qlik-login.cred\nSetCredential=qlik-login:{}\n";

// Only metadata leaves this check; systemd delivers the contents to the owner.
export async function inspectQlikCredential() {
  await assertProtectedParents(path.dirname(qlikCredentialPath));
  const info = await lstat(qlikCredentialPath);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.uid !== 0 ||
    info.gid !== 0 ||
    info.nlink !== 1 ||
    (info.mode & 0o7777) !== 0o600 ||
    info.size < 43 ||
    info.size > 130 ||
    (await realpath(qlikCredentialPath)) !== qlikCredentialPath
  )
    throw new Error("Protected Qlik credential required.");
  const current = await lstat(qlikCredentialPath);
  if (
    ["dev", "ino", "size", "mtimeMs", "ctimeMs", "uid", "gid", "mode", "nlink"].some(
      (key) => info[key] !== current[key],
    ) ||
    !current.isFile() ||
    current.isSymbolicLink()
  )
    throw new Error("Qlik credential changed during inspection.");
  return Object.fromEntries(
    ["dev", "ino", "size", "mtimeMs", "ctimeMs"].map((key) => [key, info[key]]),
  );
}

export async function readProtectedText(file, { uid = 0, mode, maximum = 262144 } = {}) {
  const before = await lstat(file);
  const valid = (info) => {
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== uid ||
      info.nlink !== 1 ||
      (info.mode & 0o022) !== 0 ||
      (mode !== undefined && (info.mode & 0o777) !== mode) ||
      info.size > maximum
    )
      throw new Error("Qlik input is not a protected regular file.");
  };
  valid(before);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = await handle.stat();
    valid(opened);
    if (opened.ino !== before.ino || opened.dev !== before.dev)
      throw new Error("Qlik input changed.");
    const buffer = Buffer.alloc(maximum + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    const after = await handle.stat();
    const current = await lstat(file);
    valid(current);
    if (
      used > maximum ||
      used !== after.size ||
      before.ino !== current.ino ||
      before.dev !== current.dev ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      current.mtimeMs !== after.mtimeMs ||
      current.ctimeMs !== after.ctimeMs ||
      current.size !== after.size
    )
      throw new Error("Qlik input changed.");
    return buffer.subarray(0, used).toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function assertProtectedParents(directory) {
  let current = directory;
  while (true) {
    const info = await lstat(current);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== 0 ||
      (info.mode & 0o022) !== 0 ||
      (await realpath(current)) !== current
    )
      throw new Error("Qlik release parent is unsafe.");
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export function renderQlikUnit(template, sha, preflight, ranking = false) {
  if (
    typeof sha !== "string" ||
    !shaPattern.test(sha) ||
    typeof template !== "string" ||
    typeof preflight !== "boolean" ||
    typeof ranking !== "boolean" ||
    (ranking && preflight) ||
    template.split("@RELEASE@").length !== 2 ||
    template.split("Environment=HOME=/var/lib/descomplica-qlik\n").length !== 2 ||
    template.split(home + loginCredentials).length !== 2 ||
    template.includes("QLIK_METADATA_PREFLIGHT") ||
    template.includes("QLIK_RANKING_COLLECTION") ||
    template.replace(loginCredentials, "").includes("LoadCredential") ||
    template.replace(loginCredentials, "").includes("SetCredential")
  )
    throw new Error("Qlik unit template rejected.");
  return template
    .replace("@RELEASE@", `/srv/descomplica-crm-releases/${sha}`)
    .replace(
      home + loginCredentials,
      home +
        loginCredentials +
        (preflight ? "Environment=QLIK_METADATA_PREFLIGHT=enabled\n" : "") +
        (ranking
          ? `Environment=QLIK_RANKING_COLLECTION=enabled\nLoadCredential=qlik-ranking-hmac:${qlikCredentialPath}\n`
          : ""),
    );
}

export function parseQlikUnit(contents, template) {
  const sha = contents.match(
    /^WorkingDirectory=\/srv\/descomplica-crm-releases\/([a-f0-9]{40})$/mu,
  )?.[1];
  if (!sha) throw new Error("Qlik release identity unavailable.");
  for (const preflight of [false, true]) {
    const expected = renderQlikUnit(template, sha, preflight);
    // Older owners and persisted backups differ only by these two reviewed lines.
    if (contents === expected || contents === expected.replace(loginCredentials, ""))
      return { sha, unitHash: sha256(contents), preflight };
  }
  const ranking = renderQlikUnit(template, sha, false, true);
  if (contents === ranking || contents === ranking.replace(loginCredentials, ""))
    return { sha, unitHash: sha256(contents), preflight: false, ranking: true };
  throw new Error("Qlik unit differs from the reviewed template.");
}

// Metadata only: dependencies are never imported as root.
export async function assertQlikDependencies(root) {
  const base = path.join(root, "node_modules");
  await assertProtectedParents(base);
  const within = (value) => value === base || value.startsWith(base + path.sep);
  const pending = [base];
  let count = 0;
  while (pending.length) {
    if (++count > 200000) throw new Error("Dependency tree limit exceeded.");
    const file = pending.pop();
    const info = await lstat(file);
    if (info.uid !== 0) throw new Error("Dependency owner rejected.");
    if (info.isSymbolicLink()) {
      const target = path.resolve(path.dirname(file), await readlink(file));
      if (!within(target) || !within(await realpath(file)))
        throw new Error("External dependency rejected.");
    } else {
      if ((info.mode & 0o022) !== 0) throw new Error("Writable dependency rejected.");
      if (info.isDirectory()) {
        const entries = await readdir(file);
        if (count + pending.length + entries.length > 200000)
          throw new Error("Dependency tree limit exceeded.");
        for (const name of entries) pending.push(path.join(file, name));
      } else if (!info.isFile() || info.nlink !== 1) throw new Error("Shared dependency rejected.");
    }
  }
  for (const name of ["enigma.js", "@playwright/test"]) {
    const manifest = await realpath(path.join(base, name, "package.json"));
    if (!within(manifest)) throw new Error("Dependency manifest escaped release.");
    const value = JSON.parse(await readProtectedText(manifest));
    if (
      value.name !== name ||
      (name === "enigma.js" && value.version !== "2.15.0") ||
      (name === "@playwright/test" && value.version !== "1.62.1")
    )
      throw new Error("Qlik dependency version rejected.");
  }
}
