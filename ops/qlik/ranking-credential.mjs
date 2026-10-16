import * as filesystem from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const DIRECTORY = "/run/credentials/descomplica-qlik-browser.service";
const FILE = `${DIRECTORY}/qlik-ranking-hmac`;
const executeFile = promisify(execFile);
const METADATA = ["ino", "dev", "uid", "gid", "mode", "nlink", "size", "mtimeMs", "ctimeMs"];
const SHARED_DIRECTORY_METADATA = ["ino", "dev", "uid", "gid", "mode"];

function unchanged(before, after, fields = METADATA) {
  if (fields.some((key) => before[key] !== after[key])) throw new Error();
}

export async function readRankingCredential({
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
      throw new Error();
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
        throw new Error();
      directories.set(directory, info);
    }
    // A root-owned systemd ACL uses the group mode bits as its ACL mask.
    // Never accept that mask without checking every principal and permission.
    const acl = async (target, info, isDirectory) => {
      const permission = isDirectory ? "r-x" : "r--";
      const mode = isDirectory ? 0o500 : 0o400;
      const extended = info.uid === 0 && (info.mode & 0o7777) === (mode | (mode >> 3));
      if (!extended && !(info.uid === uid && (info.mode & 0o7777) === mode)) throw new Error();
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
        throw new Error();
      const entries = stdout
        .split("\n")
        .filter((line) => line !== "")
        .sort();
      if (
        entries.length !== expected.length ||
        entries.some((entry, index) => entry !== expected[index])
      )
        throw new Error();
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
        info.size < 43 ||
        info.size > 130
      )
        throw new Error();
    };
    const before = await fs.lstat(FILE);
    valid(before);
    await acl(FILE, before, false);
    handle = await fs.open(FILE, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    valid(opened);
    unchanged(before, opened);
    buffer = Buffer.alloc(131);
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
      if (!current.isDirectory() || current.isSymbolicLink()) throw new Error();
      unchanged(info, current, directory === DIRECTORY ? METADATA : SHARED_DIRECTORY_METADATA);
      if ((await fs.realpath(directory)) !== directory) throw new Error();
    }
    const after = await handle.stat();
    const current = await fs.lstat(FILE);
    valid(after);
    valid(current);
    unchanged(before, after);
    unchanged(before, current);
    if (used !== after.size) throw new Error();
    const value = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used)).trim();
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(value)) throw new Error();
    return value;
  } catch {
    throw new Error("ranking_credential_unavailable");
  } finally {
    buffer?.fill(0);
    await handle?.close().catch(() => {});
  }
}
