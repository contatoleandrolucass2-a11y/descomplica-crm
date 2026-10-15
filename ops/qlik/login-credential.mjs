import * as filesystem from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const DIRECTORY = "/run/credentials/descomplica-qlik-browser.service";
const FILE = `${DIRECTORY}/qlik-login`;
export const MAX_LOGIN_BYTES = 16_384;
const executeFile = promisify(execFile);
const METADATA = ["ino", "dev", "uid", "gid", "mode", "nlink", "size", "mtimeMs", "ctimeMs"];
const SHARED_METADATA = ["ino", "dev", "uid", "gid", "mode"];
const unavailable = () => new Error("login_credential_unavailable");

function unchanged(before, after, fields = METADATA) {
  if (fields.some((key) => before[key] !== after[key])) throw unavailable();
}

// Shared by the root converter and the service reader; never coerce or trim secrets.
export function parseLoginCredential(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_LOGIN_BYTES)
      throw unavailable();
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
    const value = JSON.parse(text);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 2 ||
      !Object.hasOwn(value, "username") ||
      !Object.hasOwn(value, "password")
    )
      throw unavailable();
    // Two string fields have exactly four JSON string tokens. Reject duplicate keys too.
    if ([...text.matchAll(/"(?:[^"\\]|\\.)*"/gu)].length !== 4) throw unavailable();
    for (const [name, limit] of [
      ["username", 320],
      ["password", 2048],
    ]) {
      const item = value[name];
      if (
        typeof item !== "string" ||
        !item.length ||
        item.length > limit ||
        !item.isWellFormed() ||
        /[\u0000-\u001f\u007f]/u.test(item)
      )
        throw unavailable();
    }
    if (value.username.trim() !== value.username) throw unavailable();
    return { username: value.username, password: value.password };
  } catch {
    throw unavailable();
  }
}

export async function readLoginCredential({
  fs = filesystem,
  environment = process.env,
  platform = process.platform,
  uid = process.getuid?.(),
  run = executeFile,
} = {}) {
  let handle;
  let buffer;
  try {
    if (
      platform !== "linux" ||
      !Number.isInteger(uid) ||
      uid <= 0 ||
      environment.CREDENTIALS_DIRECTORY !== DIRECTORY
    )
      throw unavailable();
    const directories = new Map();
    for (const directory of ["/run", "/run/credentials", DIRECTORY]) {
      const info = await fs.lstat(directory);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        ![0, uid].includes(info.uid) ||
        (info.mode & 0o022) !== 0 ||
        (await fs.realpath(directory)) !== directory
      )
        throw unavailable();
      directories.set(directory, info);
    }
    // Match the ranking credential: root-owned systemd ACL or exact owner-only ACL.
    const acl = async (target, info, isDirectory) => {
      const permission = isDirectory ? "r-x" : "r--";
      const mode = isDirectory ? 0o500 : 0o400;
      const extended = info.uid === 0 && (info.mode & 0o7777) === (mode | (mode >> 3));
      if (!extended && !(info.uid === uid && (info.mode & 0o7777) === mode)) throw unavailable();
      const expected = [
        `user::${permission}`,
        ...(extended ? [`user:${uid}:${permission}`] : []),
        "group::---",
        ...(extended ? [`mask::${permission}`] : []),
        "other::---",
      ].sort();
      const { stdout, stderr } = await run(
        "/usr/bin/getfacl",
        ["--absolute-names", "--omit-header", "--numeric", "--no-effective", "--", target],
        {
          encoding: "utf8",
          env: {},
          shell: false,
          windowsHide: true,
          timeout: 2000,
          killSignal: "SIGKILL",
          maxBuffer: 8192,
        },
      );
      if (typeof stdout !== "string" || Buffer.byteLength(stdout) > 8192 || stderr !== "")
        throw unavailable();
      const entries = stdout.split("\n").filter(Boolean).sort();
      if (
        entries.length !== expected.length ||
        entries.some((entry, index) => entry !== expected[index])
      )
        throw unavailable();
      unchanged(info, await fs.lstat(target));
    };
    await acl(DIRECTORY, directories.get(DIRECTORY), true);
    const valid = (info) => {
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        ![0, uid].includes(info.uid) ||
        info.nlink !== 1 ||
        !(
          (info.uid === uid && (info.mode & 0o7777) === 0o400) ||
          (info.uid === 0 && (info.mode & 0o7777) === 0o440)
        ) ||
        info.size < 1 ||
        info.size > MAX_LOGIN_BYTES
      )
        throw unavailable();
    };
    const before = await fs.lstat(FILE);
    valid(before);
    await acl(FILE, before, false);
    handle = await fs.open(FILE, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    valid(opened);
    unchanged(before, opened);
    buffer = Buffer.alloc(MAX_LOGIN_BYTES + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    await acl(FILE, before, false);
    await acl(DIRECTORY, directories.get(DIRECTORY), true);
    for (const [directory, info] of directories) {
      const current = await fs.lstat(directory);
      if (!current.isDirectory() || current.isSymbolicLink()) throw unavailable();
      unchanged(info, current, directory === DIRECTORY ? METADATA : SHARED_METADATA);
      if ((await fs.realpath(directory)) !== directory) throw unavailable();
    }
    const after = await handle.stat();
    const current = await fs.lstat(FILE);
    valid(after);
    valid(current);
    unchanged(before, after);
    unchanged(before, current);
    if (used !== after.size) throw unavailable();
    return parseLoginCredential(buffer.subarray(0, used));
  } catch {
    throw unavailable();
  } finally {
    buffer?.fill(0);
    await handle?.close().catch(() => {});
  }
}
