import * as fs from "node:fs/promises";
import { constants as flags } from "node:fs";
import {
  constants,
  createCipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { userInfo } from "node:os";
import path from "node:path";

export const CREDENTIAL_PURPOSE =
  "descomplica-qlik:credentials:v1:https://direcional.us.qlikcloud.com/";
const PATHS = Object.freeze({
  keyDirectory: "/etc/descomplica-qlik",
  publicKey: "/etc/descomplica-qlik/vault-public.pem",
  home: "/var/lib/descomplica-qlik",
  directory: "/var/lib/descomplica-qlik/credentials",
});
const FILE = "qlik.enc.json";
const MAX_ENVELOPE_BYTES = 32_768;
const error = (code) => Object.assign(new Error(code), { code });
const identity = () => ({
  platform: process.platform,
  uid: process.getuid?.(),
  gid: process.getgid?.(),
  username: userInfo().username,
});

function validBase64(value, expectedBytes) {
  if (typeof value !== "string" || !value || value.length > 24_000) return false;
  const decoded = Buffer.from(value, "base64");
  return (
    decoded.toString("base64") === value &&
    (expectedBytes
      ? decoded.length === expectedBytes
      : decoded.length > 0 && decoded.length <= 16_384)
  );
}

function validate(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    throw error("invalid_credentials");
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 2 || !keys.includes("username") || !keys.includes("password"))
    throw error("invalid_credentials");
  for (const [name, limit] of [
    ["username", 320],
    ["password", 2048],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(input, name);
    const value = descriptor?.value;
    if (
      typeof value !== "string" ||
      !value.length ||
      value.length > limit ||
      !value.isWellFormed() ||
      /[\u0000-\u001f\u007f]/u.test(value)
    )
      throw error("invalid_credentials");
  }
  if (input.username.trim() !== input.username) throw error("invalid_credentials");
  return { username: input.username, password: input.password };
}

// Injection is for isolated tests. Production exports below always use fixed paths and OS identity.
export function createCredentialVault({
  paths = PATHS,
  io = fs,
  currentIdentity = identity,
  anchorDirectory = (handle) => `/proc/self/fd/${handle.fd}`,
} = {}) {
  function fileSafe(info, uid, mode) {
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== uid ||
      (info.mode & 0o777) !== mode ||
      info.nlink !== 1
    )
      throw error("vault_unavailable");
  }

  async function inspectPaths() {
    const actor = currentIdentity();
    if (
      actor.platform !== "linux" ||
      !Number.isInteger(actor.uid) ||
      actor.uid <= 0 ||
      !Number.isInteger(actor.gid) ||
      actor.gid <= 0 ||
      actor.username !== "descomplica-qlik"
    )
      throw error("vault_unavailable");
    for (const directory of [paths.keyDirectory, paths.directory]) {
      for (let current = directory; ; current = path.dirname(current)) {
        const info = await io.lstat(current);
        const owned = current === paths.home || current === paths.directory;
        if (
          !info.isDirectory() ||
          info.isSymbolicLink() ||
          info.uid !== (owned ? actor.uid : 0) ||
          (info.mode & 0o022) !== 0
        )
          throw error("vault_unavailable");
        if (owned && ((info.mode & 0o777) !== 0o700 || info.gid !== actor.gid))
          throw error("vault_unavailable");
        if (
          current === paths.keyDirectory &&
          ((info.mode & 0o777) !== 0o750 || info.gid !== actor.gid)
        )
          throw error("vault_unavailable");
        if (path.dirname(current) === current) break;
      }
      if ((await io.realpath(directory)) !== directory) throw error("vault_unavailable");
    }
    return actor;
  }

  async function openChecked(file, uid, mode, maximum) {
    const before = await io.lstat(file);
    fileSafe(before, uid, mode);
    const handle = await io.open(file, flags.O_RDONLY | flags.O_NOFOLLOW);
    try {
      const after = await handle.stat();
      fileSafe(after, uid, mode);
      if (before.dev !== after.dev || before.ino !== after.ino || after.size > maximum)
        throw error("vault_unavailable");
      const buffer = Buffer.alloc(maximum + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > maximum || bytesRead !== after.size) throw error("vault_unavailable");
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async function directoryHandle(actor) {
    const before = await io.lstat(paths.directory);
    const handle = await io.open(
      paths.directory,
      flags.O_RDONLY | flags.O_DIRECTORY | flags.O_NOFOLLOW,
    );
    const after = await handle.stat();
    if (
      !after.isDirectory() ||
      after.uid !== actor.uid ||
      after.gid !== actor.gid ||
      (after.mode & 0o777) !== 0o700 ||
      after.ino !== before.ino ||
      after.dev !== before.dev
    ) {
      await handle.close();
      throw error("vault_unavailable");
    }
    return handle;
  }

  async function saveCredentials(input) {
    const credentials = validate(input);
    let directory;
    let temporary;
    let temporaryCreated = false;
    let key;
    let plaintext;
    try {
      const actor = await inspectPaths();
      directory = await directoryHandle(actor);
      const anchor = anchorDirectory(directory, paths.directory);
      const destination = path.join(anchor, FILE);
      try {
        await io.lstat(destination);
        throw error("credential_exists");
      } catch (failure) {
        if (failure.code !== "ENOENT") throw failure;
      }
      const pem = await openChecked(paths.publicKey, 0, 0o644, 4096);
      if (!pem.toString("ascii").startsWith("-----BEGIN PUBLIC KEY-----"))
        throw error("vault_unavailable");
      const publicKey = createPublicKey(pem);
      if (
        publicKey.asymmetricKeyType !== "rsa" ||
        publicKey.asymmetricKeyDetails?.modulusLength !== 4096
      )
        throw error("vault_unavailable");
      key = randomBytes(32);
      const iv = randomBytes(12);
      const aad = Buffer.from(CREDENTIAL_PURPOSE, "utf8");
      plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
      const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const envelope = JSON.stringify({
        version: 1,
        purpose: CREDENTIAL_PURPOSE,
        algorithm: "AES-256-GCM",
        keyAlgorithm: "RSA-OAEP-SHA256",
        encryptedKey: publicEncrypt(
          {
            key: publicKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
            oaepLabel: aad,
          },
          key,
        ).toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      });
      temporary = path.join(anchor, `.qlik-${randomUUID()}.tmp`);
      const handle = await io.open(
        temporary,
        flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW,
        0o600,
      );
      temporaryCreated = true;
      try {
        fileSafe(await handle.stat(), actor.uid, 0o600);
        await handle.writeFile(envelope, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      // link() publishes atomically and refuses every existing destination, including symlinks.
      await io.link(temporary, destination);
      await io.unlink(temporary);
      temporary = undefined;
      await directory.sync();
      return { saved: true };
    } catch (failure) {
      if (failure.code === "credential_exists" || failure.code === "EEXIST")
        throw error("credential_exists");
      throw error("vault_unavailable");
    } finally {
      key?.fill(0);
      plaintext?.fill(0);
      if (temporary && temporaryCreated) await io.unlink(temporary).catch(() => {});
      await directory?.close();
    }
  }

  async function credentialStatus() {
    let directory;
    try {
      const actor = await inspectPaths();
      directory = await directoryHandle(actor);
      const file = path.join(anchorDirectory(directory, paths.directory), FILE);
      let buffer;
      try {
        buffer = await openChecked(file, actor.uid, 0o600, MAX_ENVELOPE_BYTES);
      } catch (failure) {
        if (failure.code === "ENOENT") return { saved: false };
        throw failure;
      }
      const envelope = JSON.parse(buffer.toString("utf8"));
      if (
        envelope.version !== 1 ||
        envelope.purpose !== CREDENTIAL_PURPOSE ||
        envelope.algorithm !== "AES-256-GCM" ||
        envelope.keyAlgorithm !== "RSA-OAEP-SHA256" ||
        !validBase64(envelope.encryptedKey, 512) ||
        !validBase64(envelope.iv, 12) ||
        !validBase64(envelope.tag, 16) ||
        !validBase64(envelope.ciphertext)
      )
        throw error("vault_unavailable");
      return { saved: true };
    } catch {
      throw error("vault_unavailable");
    } finally {
      await directory?.close();
    }
  }

  return { saveCredentials, credentialStatus };
}

const vault = createCredentialVault();
export const saveCredentials = vault.saveCredentials;
export const credentialStatus = vault.credentialStatus;
