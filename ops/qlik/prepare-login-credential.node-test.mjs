import assert from "node:assert/strict";
import { constants as flags } from "node:fs";
import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { CREDENTIAL_PURPOSE } from "./credential-vault.mjs";
import { createLoginCredentialPreparer } from "./prepare-login-credential.mjs";

const VAULT = "/etc/descomplica-qlik";
const HOME = "/var/lib/descomplica-qlik";
const SOURCE = `${HOME}/credentials`;
const ENVELOPE = `${SOURCE}/qlik.enc.json`;
const PRIVATE_KEY = `${VAULT}/private.pem`;
const TARGET = `${VAULT}/qlik-login.cred`;
const input = { username: "fixture@example.test", password: "synthetic-only-password" };
const pair = generateKeyPairSync("rsa", { modulusLength: 4096 });
const pem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
const encryptedFixture = Buffer.from("synthetic-systemd-encrypted\n");
const failure = (code) =>
  Object.assign(new Error("synthetic-diagnostic-never-propagated"), { code });

function encryptEnvelope(
  plaintext = JSON.stringify(input),
  { purpose = CREDENTIAL_PURPOSE, label = purpose, aad = purpose } = {},
) {
  const key = randomBytes(32);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
      version: 1,
      purpose,
      algorithm: "AES-256-GCM",
      keyAlgorithm: "RSA-OAEP-SHA256",
      encryptedKey: publicEncrypt(
        {
          key: pair.publicKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
          oaepLabel: Buffer.from(label),
        },
        key,
      ).toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  } finally {
    key.fill(0);
  }
}
const validEnvelope = encryptEnvelope();

function fixture({
  plaintext = JSON.stringify(input),
  envelope = validEnvelope,
  existing = false,
  metadata = (_kind, _name, _count, info) => info,
} = {}) {
  const entries = new Map();
  const overrides = new Map();
  const events = [];
  const observedBuffers = [];
  const counts = new Map();
  const descriptors = new Map();
  let nextDescriptor = 10;
  const resolve = (name) => {
    const match = /^\/proc\/self\/fd\/(\d+)(\/.*)?$/.exec(name);
    if (!match) return name;
    const parent = descriptors.get(Number(match[1]));
    assert.ok(parent);
    return (parent === "/" ? "" : parent) + (match[2] ?? "") || "/";
  };
  let inode = 1;
  const entry = (type, uid, gid, mode, data = Buffer.alloc(0)) => ({
    type,
    uid,
    gid,
    mode,
    data,
    ino: inode++,
    dev: 1,
    nlink: 1,
    mtimeMs: 1,
    ctimeMs: 1,
  });
  for (const name of ["/", "/etc", VAULT, "/var", "/var/lib", HOME, SOURCE]) {
    const owned = [HOME, SOURCE].includes(name);
    entries.set(
      name,
      entry(
        "directory",
        owned ? 997 : 0,
        owned || name === VAULT ? 997 : 0,
        owned ? 0o700 : name === VAULT ? 0o750 : 0o755,
      ),
    );
  }
  entries.set(PRIVATE_KEY, entry("file", 0, 997, 0o600, Buffer.from(pem)));
  entries.set(ENVELOPE, entry("file", 997, 997, 0o600, Buffer.from(JSON.stringify(envelope))));
  if (existing) entries.set(TARGET, entry("file", 0, 0, 0o600, Buffer.from(encryptedFixture)));
  const snapshot = (kind, name, item) => {
    const key = `${kind}:${name}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return metadata(kind, name, count, {
      ...item,
      size: item.data.length,
      isFile: () => item.type === "file",
      isDirectory: () => item.type === "directory",
      isSymbolicLink: () => item.type === "symlink",
      ...overrides.get(name),
    });
  };
  const io = {
    lstat: async (name) => {
      events.push(["lstat", name]);
      name = resolve(name);
      if (!entries.has(name)) throw failure("ENOENT");
      return snapshot("lstat", name, entries.get(name));
    },
    realpath: async (name) => resolve(name),
    open: async (name, openFlags, mode) => {
      events.push(["open", name, openFlags, mode]);
      name = resolve(name);
      if (openFlags & flags.O_EXCL) {
        assert.equal(mode, 0o600);
        assert.equal(
          openFlags,
          flags.O_WRONLY | flags.O_CREAT | flags.O_EXCL | flags.O_NOFOLLOW | flags.O_NONBLOCK,
        );
        if (entries.has(name)) throw failure("EEXIST");
        entries.set(name, entry("file", 0, 0, mode));
      }
      const item = entries.get(name);
      if (!item) throw failure("ENOENT");
      if (item.type === "directory")
        assert.equal(
          openFlags,
          flags.O_RDONLY | flags.O_DIRECTORY | flags.O_NOFOLLOW | flags.O_NONBLOCK,
        );
      else if (!(openFlags & flags.O_EXCL))
        assert.equal(openFlags, flags.O_RDONLY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
      let offset = 0;
      const fd = nextDescriptor++;
      descriptors.set(fd, name);
      return {
        fd,
        stat: async () => snapshot("fstat", name, item),
        read: async (buffer, start, length) => {
          observedBuffers.push(buffer);
          const bytesRead = Math.min(length, item.data.length - offset, 137);
          item.data.copy(buffer, start, offset, offset + bytesRead);
          offset += bytesRead;
          return { bytesRead };
        },
        writeFile: async (buffer) => {
          events.push(["write", name]);
          item.data = Buffer.from(buffer);
          item.mtimeMs++;
          item.ctimeMs++;
        },
        sync: async () =>
          events.push([item.type === "directory" ? "directory-sync" : "file-sync", name]),
        close: async () => {
          descriptors.delete(fd);
          events.push(["close", name]);
        },
      };
    },
    link: async (source, destination) => {
      events.push(["link", source, destination]);
      source = resolve(source);
      destination = resolve(destination);
      if (entries.has(destination)) throw failure("EEXIST");
      const item = entries.get(source);
      item.nlink++;
      item.ctimeMs++;
      entries.set(destination, item);
    },
    unlink: async (name) => {
      events.push(["unlink", name]);
      name = resolve(name);
      const item = entries.get(name);
      if (!item) throw failure("ENOENT");
      item.nlink--;
      item.ctimeMs++;
      entries.delete(name);
    },
  };
  const options = {
    fs: io,
    currentIdentity: () => ({ platform: "linux", uid: 0 }),
    getServiceIdentity: async () => ({ uid: 997, gid: 997 }),
    anchorDirectory: (_handle, name) => name,
    runCreds: async (operation, buffer) => {
      events.push([operation]);
      observedBuffers.push(buffer);
      assert.ok(Buffer.isBuffer(buffer));
      if (operation === "encrypt") {
        assert.equal(buffer.toString("utf8"), plaintext);
        const output = Buffer.from(encryptedFixture);
        observedBuffers.push(output);
        return output;
      }
      assert.deepEqual(buffer, encryptedFixture);
      const output = Buffer.from(plaintext);
      observedBuffers.push(output);
      return output;
    },
  };
  return {
    options,
    entries,
    descriptors,
    events,
    overrides,
    prepare: (changes = {}) =>
      createLoginCredentialPreparer({ ...options, ...changes }).prepareLoginCredential(),
    cleared: () =>
      observedBuffers.length > 0 &&
      observedBuffers.every((buffer) => buffer.every((byte) => byte === 0)),
  };
}

test("converts only the synthetic RSA/AES envelope, verifies systemd roundtrip and publishes exclusively with fsync", async () => {
  const f = fixture();
  assert.deepEqual(await f.prepare(), { status: "login_credential_prepared" });
  const installed = f.entries.get(TARGET);
  assert.deepEqual(installed.data, encryptedFixture);
  assert.equal(installed.uid, 0);
  assert.equal(installed.mode, 0o600);
  assert.equal(installed.nlink, 1);
  assert.ok(!installed.data.includes(input.password));
  assert.ok(
    f.events.findIndex(([event]) => event === "file-sync") <
      f.events.findIndex(([event]) => event === "link"),
  );
  assert.ok(
    f.events.findIndex(([event]) => event === "link") <
      f.events.findIndex(([event]) => event === "directory-sync"),
  );
  assert.deepEqual(
    f.events.filter(([event]) => ["encrypt", "decrypt"].includes(event)),
    [["encrypt"], ["decrypt"]],
  );
  assert.ok(f.cleared());
  assert.equal(
    [...f.entries.keys()].some((name) => name.includes(".tmp")),
    false,
  );
});

test("Unicode ZWJ/bidi, password spaces and original JSON bytes survive the authenticated roundtrip", async () => {
  const plaintext =
    JSON.stringify(
      {
        password: " \ud83d\udc69\u200d\ud83d\udcbb\u202e\u0085\u2028\u2029 ",
        username: "usu\u00e1rio@example.test",
      },
      null,
      2,
    ) + "\n";
  const f = fixture({ plaintext, envelope: encryptEnvelope(plaintext) });
  assert.deepEqual(await f.prepare(), { status: "login_credential_prepared" });
  assert.ok(f.cleared());
});

test("valid existing credential is decrypted/validated without reading the old vault or rewriting", async () => {
  const f = fixture({ existing: true });
  f.entries.delete(ENVELOPE);
  f.entries.delete(PRIVATE_KEY);
  const before = f.entries.get(TARGET);
  assert.deepEqual(await f.prepare(), { status: "login_credential_exists" });
  assert.equal(f.entries.get(TARGET), before);
  assert.equal(
    f.events.some(([event]) => ["write", "link", "encrypt"].includes(event)),
    false,
  );
  assert.equal(
    f.events.some(
      ([event, name]) => event === "open" && [SOURCE, PRIVATE_KEY, ENVELOPE].includes(name),
    ),
    false,
  );
  assert.ok(f.cleared());
});

test("production directory anchors use pinned descriptors and close every handle", async () => {
  const f = fixture();
  assert.deepEqual(await f.prepare({ anchorDirectory: undefined }), {
    status: "login_credential_prepared",
  });
  assert.ok(
    f.events.some(([event, name]) => event === "open" && name.startsWith("/proc/self/fd/")),
  );
  assert.equal(f.descriptors.size, 0);
  assert.ok(f.cleared());
});

test("existing credential replacement during systemd validation fails without overwriting", async () => {
  const f = fixture({ existing: true });
  const run = f.options.runCreds;
  await assert.rejects(
    f.prepare({
      runCreds: async (...args) => {
        const output = await run(...args);
        f.entries.get(TARGET).ino++;
        return output;
      },
    }),
    /^Error: login_credential_prepare_failed$/,
  );
  assert.equal(
    f.events.some(([event]) => ["write", "link", "encrypt"].includes(event)),
    false,
  );
  assert.ok(f.cleared());
});

test("unsupported OS/root/service identities fail before credential I/O", async () => {
  for (const actor of [
    { platform: "win32", uid: 0 },
    { platform: "linux", uid: 997 },
    { platform: "linux", uid: undefined },
  ]) {
    const f = fixture();
    await assert.rejects(
      f.prepare({ currentIdentity: () => actor }),
      /^Error: login_credential_prepare_failed$/,
    );
    assert.deepEqual(f.events, []);
  }
  for (const service of [
    { uid: 0, gid: 997 },
    { uid: 997, gid: 0 },
    { uid: 997.1, gid: 997 },
    { uid: undefined, gid: 997 },
  ]) {
    const f = fixture();
    await assert.rejects(
      f.prepare({ getServiceIdentity: async () => service }),
      /^Error: login_credential_prepare_failed$/,
    );
    assert.deepEqual(f.events, []);
  }
});

test("unsafe parent, source, private-key and destination metadata fail closed", async () => {
  for (const [name, patches] of [
    ["/", [{ uid: 997 }, { mode: 0o777 }, { isSymbolicLink: () => true }]],
    ["/etc", [{ uid: 997 }, { mode: 0o775 }]],
    [VAULT, [{ uid: 997 }, { gid: 0 }, { mode: 0o755 }, { isDirectory: () => false }]],
    ["/var", [{ uid: 997 }, { mode: 0o777 }]],
    [HOME, [{ uid: 0 }, { gid: 0 }, { mode: 0o750 }]],
    [SOURCE, [{ uid: 0 }, { mode: 0o750 }, { isSymbolicLink: () => true }]],
    ...[ENVELOPE, PRIVATE_KEY, TARGET].map((name) => [
      name,
      [
        { uid: name === ENVELOPE ? 0 : 997 },
        { mode: 0o640 },
        { mode: 0o4600 },
        { nlink: 2 },
        { isSymbolicLink: () => true },
        { isFile: () => false },
        { size: 0 },
        { size: 100_000 },
      ],
    ]),
  ]) {
    for (const patch of patches) {
      const f = fixture({ existing: name === TARGET });
      f.overrides.set(name, patch);
      await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
      assert.equal(
        f.events.some(([event]) => event === "write"),
        false,
      );
    }
  }
});

test("source/key inode, permissions and contents must stay stable across open and read", async () => {
  for (const name of [ENVELOPE, PRIVATE_KEY]) {
    for (const field of [
      "ino",
      "dev",
      "uid",
      "gid",
      "mode",
      "nlink",
      "size",
      "mtimeMs",
      "ctimeMs",
    ]) {
      for (const stage of ["open", "read", "path"]) {
        const f = fixture({
          metadata: (kind, target, count, info) =>
            name === target &&
            ((stage === "open" && kind === "fstat" && count === 1) ||
              (stage === "read" && kind === "fstat" && count === 2) ||
              (stage === "path" && kind === "lstat" && count === 2))
              ? { ...info, [field]: 999_999 }
              : info,
        });
        await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
        assert.equal(f.entries.has(TARGET), false);
      }
    }
  }
});

test("parent replacement/noncanonical realpath and concurrent source changes prevent publication", async () => {
  for (const target of ["/", "/etc", VAULT, "/var", "/var/lib", HOME, SOURCE]) {
    const f = fixture({
      metadata: (kind, name, count, info) =>
        kind === "lstat" && name === target && count > 1 ? { ...info, ino: 99 } : info,
    });
    await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
    assert.equal(f.entries.has(TARGET), false);
    const other = fixture();
    other.options.fs.realpath = async (name) => (name === target ? "/unrelated" : name);
    await assert.rejects(other.prepare(), /^Error: login_credential_prepare_failed$/);
  }
  const f = fixture();
  const run = f.options.runCreds;
  await assert.rejects(
    f.prepare({
      runCreds: async (...args) => {
        const result = await run(...args);
        f.overrides.set(SOURCE, { ctimeMs: 2 });
        return result;
      },
    }),
    /^Error: login_credential_prepare_failed$/,
  );
  assert.ok(f.cleared());
});

test("validates envelope identity, canonical base64, field sizes, OAEP label and GCM AAD/tag", async () => {
  const invalid = [
    null,
    [],
    {},
    { ...validEnvelope, extra: true },
    ...Object.entries({
      version: 2,
      purpose: "other-tenant",
      algorithm: "AES-128-GCM",
      keyAlgorithm: "RSA-OAEP-SHA1",
    }).map(([field, value]) => ({ ...validEnvelope, [field]: value })),
    ...["encryptedKey", "iv", "tag", "ciphertext"].flatMap((field) =>
      [undefined, "!", "AA==", "", validEnvelope[field] + "\n"].map((value) => ({
        ...validEnvelope,
        [field]: value,
      })),
    ),
    encryptEnvelope(undefined, { label: "other-tenant" }),
    encryptEnvelope(undefined, { aad: "other-tenant" }),
    { ...validEnvelope, tag: Buffer.alloc(16).toString("base64") },
  ];
  for (const envelope of invalid) {
    const f = fixture({ envelope });
    await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
    assert.equal(f.entries.has(TARGET), false);
    assert.equal(
      f.events.some(([event]) => event === "encrypt"),
      false,
    );
  }
});

test("invalid plaintext and private keys are never delivered to systemd", async () => {
  for (const plaintext of [
    '{"username":"ok","password":"\\n"}',
    '{"username":"ok","password":"ok","extra":1}',
    JSON.stringify({ ...input, password: "x".repeat(2049) }),
    '{"username":"a","password":"b","password":"c"}',
  ]) {
    const f = fixture({ plaintext, envelope: encryptEnvelope(plaintext) });
    await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
    assert.equal(
      f.events.some(([event]) => event === "encrypt"),
      false,
    );
    assert.ok(f.cleared());
  }
  const wrong = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  for (const value of [wrong, "invalid-pem"]) {
    const f = fixture();
    f.entries.get(PRIVATE_KEY).data = Buffer.from(value);
    await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
    assert.equal(
      f.events.some(([event]) => event === "encrypt"),
      false,
    );
    assert.ok(f.cleared());
  }
});

test("failed systemd operation/roundtrip cannot write and never exports diagnostics", async () => {
  for (const existing of [false, true]) {
    for (const output of [
      undefined,
      Buffer.alloc(0),
      Buffer.alloc(65_537),
      Buffer.from("not-json"),
    ]) {
      const f = fixture({ existing });
      await assert.rejects(
        f.prepare({
          runCreds: async () => {
            if (output === undefined)
              throw Object.assign(failure("ERR_TEST"), {
                stdout: input.password,
                stderr: input.username,
              });
            return output;
          },
        }),
        /^Error: login_credential_prepare_failed$/,
      );
      assert.equal(
        f.events.some(([event]) => event === "write"),
        false,
      );
    }
  }
  const f = fixture();
  const run = f.options.runCreds;
  await assert.rejects(
    f.prepare({
      runCreds: async (operation, buffer) =>
        operation === "encrypt"
          ? run(operation, buffer)
          : Buffer.from(JSON.stringify({ ...input, password: "changed" })),
    }),
    /^Error: login_credential_prepare_failed$/,
  );
  assert.equal(f.entries.has(TARGET), false);
});

test("publication races preserve the winner; write/fsync/link errors clean only our temporary file", async () => {
  for (const operation of ["writeFile", "sync", "link", "race"]) {
    const f = fixture();
    if (["link", "race"].includes(operation))
      f.options.fs.link = async (_source, destination) => {
        if (operation === "race")
          f.entries.set(destination, { data: Buffer.from("winning-encrypted-file") });
        throw failure("EEXIST");
      };
    else {
      const open = f.options.fs.open;
      f.options.fs.open = async (...args) => {
        const handle = await open(...args);
        if (args[0].includes(".tmp"))
          handle[operation] = async () => {
            throw failure("EIO");
          };
        return handle;
      };
    }
    await assert.rejects(f.prepare(), /^Error: login_credential_prepare_failed$/);
    assert.equal(
      [...f.entries.keys()].some((name) => name.includes(".tmp")),
      false,
    );
    assert.ok(f.cleared());
    if (operation === "race")
      assert.equal(f.entries.get(TARGET).data.toString(), "winning-encrypted-file");
    else assert.equal(f.entries.has(TARGET), false);
  }
});

function fakeSpawn({ fail = "", failOperation, diagnosticSize = 128, onSpawn = () => {} } = {}) {
  const seen = [];
  const chunks = [];
  const spawnProcess = (command, args, options) => {
    assert.equal(command, "/usr/bin/systemd-creds");
    assert.deepEqual(args, [
      args[0],
      "--name=qlik-login",
      ...(args[0] === "encrypt" ? ["--with-key=host"] : []),
      "-",
      "-",
    ]);
    assert.deepEqual(options, {
      env: {},
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    seen.push(args[0]);
    const child = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    let killed = false;
    child.kill = (signal) => {
      assert.equal(signal, "SIGKILL");
      killed = true;
      queueMicrotask(() => child.emit("close", null, signal));
    };
    child.stdin.end = (buffer) => {
      chunks.push(buffer);
      queueMicrotask(() => {
        onSpawn();
        const activeFail = !failOperation || failOperation === args[0] ? fail : "";
        if (activeFail === "hang") return;
        const output = Buffer.from(
          args[0] === "encrypt" ? encryptedFixture : JSON.stringify(input),
        );
        chunks.push(output);
        if (["warning", "stderr-exit", "stderr-overflow"].includes(activeFail)) {
          const diagnostic = Buffer.alloc(
            activeFail === "stderr-overflow" ? 8193 : diagnosticSize,
            7,
          );
          chunks.push(diagnostic);
          child.stderr.emit("data", diagnostic.subarray(0, Math.min(4096, diagnostic.length)));
          if (diagnostic.length > 4096) child.stderr.emit("data", diagnostic.subarray(4096));
        }
        if (activeFail === "spawn") child.emit("error", failure("ENOENT"));
        else if (activeFail === "stdin") child.stdin.emit("error", failure("EPIPE"));
        else if (activeFail === "overflow") {
          const oversized = Buffer.alloc(65_537, 7);
          chunks.push(oversized);
          child.stdout.emit("data", oversized);
        } else child.stdout.emit("data", output);
        if (!killed)
          child.emit("close", ["exit", "stderr-exit"].includes(activeFail) ? 1 : 0, null);
        if (["spawn", "stdin", "overflow"].includes(activeFail)) output.fill(0);
      });
    };
    return child;
  };
  return {
    spawnProcess,
    seen,
    cleared: () => chunks.every((chunk) => chunk.every((byte) => byte === 0)),
  };
}

test("systemd subprocess uses fixed binary/argv and pipes, with no inherited environment", async () => {
  const f = fixture();
  const process = fakeSpawn();
  assert.deepEqual(await f.prepare({ runCreds: undefined, spawnProcess: process.spawnProcess }), {
    status: "login_credential_prepared",
  });
  assert.deepEqual(process.seen, ["encrypt", "decrypt"]);
  assert.ok(process.cleared());
});

test("bounded warnings with exit zero are discarded and zeroed; roundtrip stays mandatory", async () => {
  for (const diagnosticSize of [128, 8192]) {
    const f = fixture();
    const process = fakeSpawn({ fail: "warning", diagnosticSize });
    assert.deepEqual(await f.prepare({ runCreds: undefined, spawnProcess: process.spawnProcess }), {
      status: "login_credential_prepared",
    });
    assert.deepEqual(process.seen, ["encrypt", "decrypt"]);
    assert.ok(f.cleared() && process.cleared());
  }
});

for (const fail of ["spawn", "stdin", "stderr-exit", "stderr-overflow", "overflow", "exit"]) {
  test(`systemd ${fail} fails closed with fixed errors and cleared buffers`, async () => {
    const f = fixture();
    const process = fakeSpawn({ fail });
    await assert.rejects(
      f.prepare({ runCreds: undefined, spawnProcess: process.spawnProcess }),
      /^Error: login_credential_prepare_failed$/,
    );
    assert.equal(f.entries.has(TARGET), false);
    assert.ok(f.cleared() && process.cleared());
  });
}

test("decryption exit failure or stderr abuse after successful encryption prevents publication", async () => {
  for (const fail of ["stderr-exit", "stderr-overflow"]) {
    const f = fixture();
    const process = fakeSpawn({ fail, failOperation: "decrypt" });
    await assert.rejects(
      f.prepare({ runCreds: undefined, spawnProcess: process.spawnProcess }),
      /^Error: login_credential_prepare_failed$/,
    );
    assert.deepEqual(process.seen, ["encrypt", "decrypt"]);
    assert.equal(f.entries.has(TARGET), false);
    assert.ok(f.cleared() && process.cleared());
  }
});

test("systemd timeout kills the child before rejecting and clears input buffers", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  const ready = Promise.withResolvers();
  const process = fakeSpawn({ fail: "hang", onSpawn: ready.resolve });
  const pending = f.prepare({ runCreds: undefined, spawnProcess: process.spawnProcess });
  const rejected = assert.rejects(pending, /^Error: login_credential_prepare_failed$/);
  await ready.promise;
  t.mock.timers.tick(15_000);
  await rejected;
  assert.equal(f.entries.has(TARGET), false);
  assert.ok(f.cleared() && process.cleared());
});

test("CLI rejects path/argument overrides with only the fixed code before I/O", () => {
  const file = fileURLToPath(new URL("./prepare-login-credential.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [file, "--source=/untrusted"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "login_credential_prepare_failed\n");
});
