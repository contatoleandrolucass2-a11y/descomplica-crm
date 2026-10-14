import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CREDENTIAL_PURPOSE,
  createCredentialVault,
  credentialStatus,
} from "./credential-vault.mjs";

const pair = generateKeyPairSync("rsa", { modulusLength: 4096 });
const publicPem = pair.publicKey.export({ type: "spki", format: "pem" });
const input = { username: "qa-qlik@example.test", password: "test-only-Strong-secret-8271" };
const actor = { platform: "linux", uid: 23456, gid: 23456, username: "descomplica-qlik" };

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "qlik-vault-test-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const paths = { keyDirectory: path.join(root, "keys"), home: path.join(root, "home") };
  paths.directory = path.join(paths.home, "credentials");
  paths.publicKey = path.join(paths.keyDirectory, "vault-public.pem");
  await fs.mkdir(paths.keyDirectory);
  await fs.mkdir(paths.directory, { recursive: true });
  await fs.writeFile(paths.publicKey, publicPem);
  const overrides = new Map();
  const events = [];
  // Model Linux ownership/modes on Windows; retain real file types, inodes and link counts.
  const metadata = (name, info) => {
    const owned =
      name === paths.home ||
      name === paths.directory ||
      name.startsWith(paths.directory + path.sep);
    const mode = info.isDirectory()
      ? owned
        ? 0o700
        : name === paths.keyDirectory
          ? 0o750
          : 0o755
      : name === paths.publicKey
        ? 0o644
        : 0o600;
    return Object.assign(
      Object.create(Object.getPrototypeOf(info)),
      info,
      {
        uid: owned ? actor.uid : 0,
        gid: owned || name === paths.keyDirectory ? actor.gid : 0,
        mode: (info.mode & ~0o777) | mode,
      },
      overrides.get(name),
    );
  };
  const io = {
    ...fs,
    lstat: async (name) => metadata(name, await fs.lstat(name)),
    open: async (name, ...args) => {
      events.push(["open", name]);
      if (name === paths.directory)
        return {
          stat: async () => metadata(name, await fs.lstat(name)),
          sync: async () => events.push(["directory-sync"]),
          close: async () => {},
        };
      const handle = await fs.open(name, ...args);
      return {
        stat: async () => metadata(name, await handle.stat()),
        read: (...values) => handle.read(...values),
        writeFile: (...values) => handle.writeFile(...values),
        sync: async () => {
          events.push(["file-sync"]);
          await handle.sync();
        },
        close: () => handle.close(),
      };
    },
    link: async (...args) => {
      events.push(["publish"]);
      return fs.link(...args);
    },
  };
  const vault = createCredentialVault({
    paths,
    io,
    currentIdentity: () => actor,
    anchorDirectory: (_handle, directory) => directory,
  });
  return {
    ...vault,
    paths,
    io,
    overrides,
    events,
    file: path.join(paths.directory, "qlik.enc.json"),
  };
}

function decrypt(envelope, purpose = CREDENTIAL_PURPOSE) {
  const aad = Buffer.from(purpose);
  const key = privateDecrypt(
    {
      key: pair.privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
      oaepLabel: Buffer.from(CREDENTIAL_PURPOSE),
    },
    Buffer.from(envelope.encryptedKey, "base64"),
  );
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}

test("encrypts roundtrip with tenant AAD, exposes only saved status and syncs before publication", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.credentialStatus(), { saved: false });
  assert.deepEqual(await f.saveCredentials(input), { saved: true });
  assert.deepEqual(await f.credentialStatus(), { saved: true });
  const raw = await fs.readFile(f.file, "utf8");
  assert.ok(!raw.includes(input.username) && !raw.includes(input.password));
  const envelope = JSON.parse(raw);
  assert.deepEqual(decrypt(envelope), input);
  assert.throws(() => decrypt(envelope, "another-tenant"));
  assert.throws(() => decrypt({ ...envelope, tag: Buffer.alloc(16).toString("base64") }));
  assert.equal(Buffer.from(envelope.encryptedKey, "base64").length, 512);
  assert.equal(Buffer.from(envelope.iv, "base64").length, 12);
  assert.ok(
    f.events.findIndex(([event]) => event === "file-sync") <
      f.events.findIndex(([event]) => event === "publish"),
  );
  assert.equal(f.events.filter(([event]) => event === "directory-sync").length, 1);
  assert.ok(
    f.events
      .filter(([event]) => event === "open")
      .every(([, name]) => !name.endsWith("private.pem")),
  );
  assert.deepEqual(await fs.readdir(f.paths.directory), ["qlik.enc.json"]);
});

test("status rejects incomplete or malformed encrypted envelopes", async (t) => {
  const f = await fixture(t);
  await f.saveCredentials(input);
  const valid = JSON.parse(await fs.readFile(f.file, "utf8"));
  for (const field of ["encryptedKey", "iv", "tag", "ciphertext"]) {
    for (const value of [undefined, "", "!invalid-base64", Buffer.alloc(1).toString("base64")]) {
      if (field === "ciphertext" && value === "AA==") continue;
      await fs.writeFile(f.file, JSON.stringify({ ...valid, [field]: value }));
      await assert.rejects(f.credentialStatus(), { code: "vault_unavailable" });
    }
  }
});

test("concurrent initial saves elect one winner; overwrites return credential_exists", async (t) => {
  const f = await fixture(t);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => f.saveCredentials(input)),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  for (const result of results.filter((item) => item.status === "rejected"))
    assert.equal(result.reason.code, "credential_exists");
  const before = await fs.readFile(f.file);
  await assert.rejects(f.saveCredentials({ ...input, password: "changed" }), {
    code: "credential_exists",
  });
  assert.deepEqual(await fs.readFile(f.file), before);
  assert.deepEqual(await fs.readdir(f.paths.directory), ["qlik.enc.json"]);
});

test("rejects invalid, oversized, control-character and unexpected input without I/O", async (t) => {
  const f = await fixture(t);
  for (const value of [
    null,
    [],
    {},
    { ...input, extra: true },
    { ...input, username: "" },
    { ...input, username: "x".repeat(321) },
    { ...input, password: "x".repeat(2049) },
    { ...input, username: " space" },
    { ...input, password: "" },
    { ...input, password: "a\nb" },
    { ...input, password: "\ud800" },
    {
      username: "ok",
      get password() {
        throw new Error("getter must not run");
      },
    },
  ]) {
    await assert.rejects(f.saveCredentials(value), { code: "invalid_credentials" });
  }
  assert.deepEqual(f.events, []);
  assert.deepEqual(
    await f.saveCredentials({ username: "x".repeat(320), password: "x".repeat(2048) }),
    { saved: true },
  );
});

test("rejects unsafe path ownership, permissions and symlinks before publication", async (t) => {
  const f = await fixture(t);
  for (const [name, override] of [
    [f.paths.keyDirectory, { uid: actor.uid }],
    [f.paths.keyDirectory, { mode: 0o777 }],
    [f.paths.home, { uid: 0 }],
    [f.paths.directory, { mode: 0o750 }],
    [f.paths.publicKey, { uid: actor.uid }],
    [f.paths.publicKey, { mode: 0o666 }],
    [f.paths.publicKey, { isSymbolicLink: () => true }],
    [f.paths.directory, { isSymbolicLink: () => true }],
  ]) {
    f.overrides.set(name, override);
    await assert.rejects(f.saveCredentials(input), { code: "vault_unavailable" });
    f.overrides.clear();
  }
  assert.ok(!f.events.some(([event]) => event === "publish"));
});

test("existing symlink is never replaced and status fails closed", async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.paths.home, "outside");
  await fs.mkdir(outside);
  await fs.symlink(outside, f.file, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(f.saveCredentials(input), { code: "credential_exists" });
  await assert.rejects(f.credentialStatus(), { code: "vault_unavailable" });
  assert.equal((await fs.lstat(f.file)).isSymbolicLink(), true);
  assert.deepEqual(await fs.readdir(outside), []);
});

test("rejects a hardlinked public key and insufficient RSA key size", async (t) => {
  const f = await fixture(t);
  const alias = path.join(f.paths.keyDirectory, "alias.pem");
  await fs.link(f.paths.publicKey, alias);
  await assert.rejects(f.saveCredentials(input), { code: "vault_unavailable" });
  await fs.unlink(alias);
  const weak = generateKeyPairSync("rsa", { modulusLength: 2048 });
  await fs.writeFile(f.paths.publicKey, weak.publicKey.export({ type: "spki", format: "pem" }));
  await assert.rejects(f.saveCredentials(input), { code: "vault_unavailable" });
});

test("failure before exclusive publication leaves no credential or temporary file", async (t) => {
  const f = await fixture(t);
  f.io.link = async () => {
    throw Object.assign(new Error("private details"), { code: "EIO" });
  };
  await assert.rejects(f.saveCredentials(input), {
    code: "vault_unavailable",
    message: "vault_unavailable",
  });
  assert.deepEqual(await fs.readdir(f.paths.directory), []);
  assert.deepEqual(await f.credentialStatus(), { saved: false });
});

test("production status fails closed outside the dedicated Linux identity", async () => {
  if (process.platform === "linux" && os.userInfo().username === "descomplica-qlik") return;
  await assert.rejects(credentialStatus(), { code: "vault_unavailable" });
});

test("installer pins approved SHA, refuses existing state, restricts keys and enables no consumer", () => {
  const script = readFileSync(
    new URL("./vps/install-credential-vault.sh", import.meta.url),
    "utf8",
  );
  assert.match(script, /APPROVED_RELEASE_SHA/);
  assert.match(script, /git -C "\$release" show "\$1:\$relative"/);
  assert.match(script, /Existing vault state; inspect manually/);
  assert.match(script, /rsa_keygen_bits:4096/);
  assert.match(script, /chmod 0600 "\$staging\/private.pem"/);
  assert.match(script, /chmod 0644 "\$staging\/vault-public.pem"/);
  assert.match(script, /chmod 0750 "\$vault"/);
  assert.match(script, /runuser -u descomplica-qlik -- \/usr\/bin\/mkdir -m 0700/);
  assert.doesNotMatch(script, /systemctl|apt-get|--no-sandbox|cat .*pem/);
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
  if (existsSync(bash)) {
    const result = spawnSync(bash, ["-n"], { input: script, encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
  }
});
