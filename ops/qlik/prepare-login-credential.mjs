import * as filesystem from "node:fs/promises";
import { constants as flags } from "node:fs";
import { execFile, spawn } from "node:child_process";
import {
  constants,
  createDecipheriv,
  createPrivateKey,
  privateDecrypt,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { CREDENTIAL_PURPOSE } from "./credential-vault.mjs";
import { MAX_LOGIN_BYTES, parseLoginCredential } from "./login-credential.mjs";

const VAULT = "/etc/descomplica-qlik";
const HOME = "/var/lib/descomplica-qlik";
const SOURCE = `${HOME}/credentials`;
const TARGET = "qlik-login.cred";
const MAX_ENCRYPTED_BYTES = 65_536;
const METADATA = ["ino", "dev", "uid", "gid", "mode", "nlink", "size", "mtimeMs", "ctimeMs"];
const DIRECTORY_IDENTITY = ["ino", "dev", "uid", "gid", "mode"];
const executeFile = promisify(execFile);
const failed = () => new Error("login_credential_prepare_failed");
const decoder = () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function unchanged(before, after, fields = METADATA) {
  if (fields.some((key) => before[key] !== after[key])) throw failed();
}

async function serviceIdentity() {
  const result = {};
  for (const field of ["uid", "gid"]) {
    const { stdout, stderr } = await executeFile(
      "/usr/bin/id",
      [field === "uid" ? "-u" : "-g", "descomplica-qlik"],
      { encoding: "utf8", env: {}, shell: false, timeout: 2000, maxBuffer: 128 },
    );
    if (stderr !== "" || !/^[1-9][0-9]*\n$/.test(stdout)) throw failed();
    result[field] = Number(stdout.trim());
  }
  return result;
}

// No secrets in argv, environment, stderr, files or exceptions. Both directions use pipes.
function systemdCreds(operation, input, spawnProcess) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let diagnosticBytes = 0;
    let bad = false;
    let settled = false;
    let child;
    let timer;
    const clear = () => {
      for (const chunk of chunks) chunk.fill(0);
    };
    const finish = (success) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (success) {
        const output = Buffer.concat(chunks, size);
        clear();
        resolve(output);
      } else {
        clear();
        reject(failed());
      }
    };
    const abort = () => {
      bad = true;
      clear();
      child?.kill("SIGKILL");
    };
    try {
      child = spawnProcess(
        "/usr/bin/systemd-creds",
        [
          operation,
          "--name=qlik-login",
          ...(operation === "encrypt" ? ["--with-key=host"] : []),
          "-",
          "-",
        ],
        {
          env: {},
          shell: false,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      timer = setTimeout(abort, 15_000);
      child.on("error", () => finish(false));
      child.on("close", (code, signal) => finish(!bad && code === 0 && !signal && size > 0));
      child.stdin.on("error", abort);
      child.stdout.on("error", abort);
      child.stderr.on("error", abort);
      child.stderr.on("data", (chunk) => {
        diagnosticBytes += chunk.length;
        chunk.fill(0);
        // First host-key setup may warn even on success. Discard bounded diagnostics;
        // exit status and the authenticated plaintext roundtrip remain authoritative.
        if (diagnosticBytes > 8192) abort();
      });
      child.stdout.on("data", (chunk) => {
        size += chunk.length;
        if (
          settled ||
          bad ||
          size > (operation === "encrypt" ? MAX_ENCRYPTED_BYTES : MAX_LOGIN_BYTES)
        ) {
          chunk.fill(0);
          abort();
          return;
        }
        chunks.push(chunk);
      });
      child.stdin.end(input);
    } catch {
      abort();
      finish(false);
    }
  });
}

// Only fixtures can replace I/O and identity. The production export and CLI have fixed paths.
export function createLoginCredentialPreparer({
  fs = filesystem,
  currentIdentity = () => ({ platform: process.platform, uid: process.getuid?.() }),
  getServiceIdentity = serviceIdentity,
  spawnProcess = spawn,
  runCreds = (operation, input) => systemdCreds(operation, input, spawnProcess),
  anchorDirectory = (handle) => `/proc/self/fd/${handle.fd}`,
} = {}) {
  async function prepareLoginCredential() {
    const directories = new Map();
    const buffers = [];
    let temporary;
    let temporaryCreated = false;
    let temporaryHandle;
    try {
      const actor = currentIdentity();
      if (actor.platform !== "linux" || actor.uid !== 0) throw failed();
      const service = await getServiceIdentity();
      if (![service.uid, service.gid].every((value) => Number.isSafeInteger(value) && value > 0))
        throw failed();
      const directorySafe = (name, info) => {
        const owned = name === HOME || name === SOURCE;
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          info.uid !== (owned ? service.uid : 0) ||
          (info.mode & 0o7022) !== 0 ||
          (owned && ((info.mode & 0o7777) !== 0o700 || info.gid !== service.gid)) ||
          (name === VAULT && ((info.mode & 0o7777) !== 0o750 || info.gid !== service.gid))
        )
          throw failed();
      };
      const openDirectory = async (name) => {
        if (directories.has(name)) return directories.get(name);
        const parent = path.posix.dirname(name);
        const parentEntry = name === "/" ? undefined : await openDirectory(parent);
        const before = await fs.lstat(name);
        directorySafe(name, before);
        if ((await fs.realpath(name)) !== name) throw failed();
        const anchored = parentEntry
          ? path.posix.join(parentEntry.anchor, path.posix.basename(name))
          : "/";
        const handle = await fs.open(
          anchored,
          flags.O_RDONLY | flags.O_DIRECTORY | flags.O_NOFOLLOW | flags.O_NONBLOCK,
        );
        const entry = { handle, before, anchor: anchorDirectory(handle, name) };
        directories.set(name, entry);
        const opened = await handle.stat();
        directorySafe(name, opened);
        unchanged(before, opened);
        return entry;
      };
      const checkDirectories = async () => {
        for (const [name, { handle, before }] of directories) {
          const fields = name === HOME || name === SOURCE ? METADATA : DIRECTORY_IDENTITY;
          const current = await fs.lstat(name);
          const opened = await handle.stat();
          directorySafe(name, current);
          directorySafe(name, opened);
          unchanged(before, current, fields);
          unchanged(before, opened, fields);
          if ((await fs.realpath(name)) !== name) throw failed();
        }
      };
      const fileSafe = (info, uid, maximum) => {
        if (
          !info.isFile() ||
          info.isSymbolicLink() ||
          info.uid !== uid ||
          (info.mode & 0o7777) !== 0o600 ||
          info.nlink !== 1 ||
          info.size < 1 ||
          info.size > maximum
        )
          throw failed();
      };
      const readChecked = async (directory, filename, uid, maximum) => {
        const entry = await openDirectory(directory);
        const file = `${entry.anchor}/${filename}`;
        const before = await fs.lstat(file);
        fileSafe(before, uid, maximum);
        const handle = await fs.open(file, flags.O_RDONLY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
        try {
          const opened = await handle.stat();
          fileSafe(opened, uid, maximum);
          unchanged(before, opened);
          const buffer = Buffer.alloc(maximum + 1);
          buffers.push(buffer);
          let used = 0;
          while (used < buffer.length) {
            const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
            if (!bytesRead) break;
            used += bytesRead;
          }
          const after = await handle.stat();
          const current = await fs.lstat(file);
          fileSafe(after, uid, maximum);
          fileSafe(current, uid, maximum);
          unchanged(before, after);
          unchanged(before, current);
          if (used !== after.size) throw failed();
          await checkDirectories();
          return buffer.subarray(0, used);
        } finally {
          await handle.close();
        }
      };
      const keep = (buffer) => {
        if (!Buffer.isBuffer(buffer)) throw failed();
        buffers.push(buffer);
        return buffer;
      };
      const vault = await openDirectory(VAULT);
      const destination = `${vault.anchor}/${TARGET}`;
      let existing = false;
      try {
        await fs.lstat(destination);
        existing = true;
      } catch (failure) {
        if (failure.code !== "ENOENT") throw failure;
      }
      if (existing) {
        const before = await fs.lstat(destination);
        const encrypted = await readChecked(VAULT, TARGET, 0, MAX_ENCRYPTED_BYTES);
        const plaintext = keep(await runCreds("decrypt", encrypted));
        parseLoginCredential(plaintext);
        unchanged(before, await fs.lstat(destination));
        await checkDirectories();
        return { status: "login_credential_exists" };
      }

      const raw = await readChecked(SOURCE, "qlik.enc.json", service.uid, 32_768);
      const envelope = JSON.parse(decoder().decode(raw));
      const fields = [
        "version",
        "purpose",
        "algorithm",
        "keyAlgorithm",
        "encryptedKey",
        "iv",
        "tag",
        "ciphertext",
      ];
      if (
        !envelope ||
        typeof envelope !== "object" ||
        Array.isArray(envelope) ||
        Object.keys(envelope).length !== fields.length ||
        fields.some((field) => !Object.hasOwn(envelope, field)) ||
        envelope.version !== 1 ||
        envelope.purpose !== CREDENTIAL_PURPOSE ||
        envelope.algorithm !== "AES-256-GCM" ||
        envelope.keyAlgorithm !== "RSA-OAEP-SHA256"
      )
        throw failed();
      const base64 = (name, length, maximum = length) => {
        const value = envelope[name];
        if (typeof value !== "string" || !value || value.length > 24_000) throw failed();
        const decoded = keep(Buffer.from(value, "base64"));
        if (
          decoded.toString("base64") !== value ||
          decoded.length < (length ?? 1) ||
          decoded.length > maximum
        )
          throw failed();
        return decoded;
      };
      const encryptedKey = base64("encryptedKey", 512);
      const iv = base64("iv", 12);
      const tag = base64("tag", 16);
      const ciphertext = base64("ciphertext", undefined, MAX_LOGIN_BYTES);
      const pem = await readChecked(VAULT, "private.pem", 0, 8192);
      const privateKey = createPrivateKey({ key: pem, format: "pem" });
      if (
        privateKey.asymmetricKeyType !== "rsa" ||
        privateKey.asymmetricKeyDetails?.modulusLength !== 4096
      )
        throw failed();
      const aad = Buffer.from(CREDENTIAL_PURPOSE, "utf8");
      const key = keep(
        privateDecrypt(
          {
            key: privateKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
            oaepLabel: aad,
          },
          encryptedKey,
        ),
      );
      if (key.length !== 32) throw failed();
      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      const partial = keep(decipher.update(ciphertext));
      const final = keep(decipher.final());
      const plaintext = keep(Buffer.concat([partial, final]));
      parseLoginCredential(plaintext);
      const encrypted = keep(await runCreds("encrypt", plaintext));
      if (!encrypted.length || encrypted.length > MAX_ENCRYPTED_BYTES) throw failed();
      const verified = keep(await runCreds("decrypt", encrypted));
      parseLoginCredential(verified);
      if (!verified.equals(plaintext)) throw failed();
      await checkDirectories();

      temporary = `${vault.anchor}/.qlik-login-${randomUUID()}.tmp`;
      temporaryHandle = await fs.open(
        temporary,
        flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW | flags.O_NONBLOCK,
        0o600,
      );
      temporaryCreated = true;
      const before = await temporaryHandle.stat();
      if (
        !before.isFile() ||
        before.uid !== 0 ||
        (before.mode & 0o7777) !== 0o600 ||
        before.nlink !== 1
      )
        throw failed();
      await temporaryHandle.writeFile(encrypted);
      await temporaryHandle.sync();
      const after = await temporaryHandle.stat();
      fileSafe(after, 0, MAX_ENCRYPTED_BYTES);
      unchanged(before, after, DIRECTORY_IDENTITY);
      if (after.size !== encrypted.length) throw failed();
      unchanged(after, await fs.lstat(temporary));
      await checkDirectories();
      // Hard-link publication is exclusive and atomic, including against a concurrent creator.
      await fs.link(temporary, destination);
      await fs.unlink(temporary);
      temporary = undefined;
      await vault.handle.sync();
      const installed = await fs.lstat(destination);
      fileSafe(installed, 0, MAX_ENCRYPTED_BYTES);
      unchanged(after, installed, [...DIRECTORY_IDENTITY, "size", "mtimeMs"]);
      await checkDirectories();
      return { status: "login_credential_prepared" };
    } catch {
      throw failed();
    } finally {
      for (const buffer of buffers) buffer.fill(0);
      await temporaryHandle?.close().catch(() => {});
      if (temporary && temporaryCreated) await fs.unlink(temporary).catch(() => {});
      for (const { handle } of [...directories.values()].reverse())
        await handle.close().catch(() => {});
    }
  }
  return { prepareLoginCredential };
}

export const prepareLoginCredential = createLoginCredentialPreparer().prepareLoginCredential;

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw failed();
    const result = await prepareLoginCredential();
    process.stdout.write(`${result.status}\n`);
  } catch {
    process.stderr.write("login_credential_prepare_failed\n");
    process.exitCode = 1;
  }
}
