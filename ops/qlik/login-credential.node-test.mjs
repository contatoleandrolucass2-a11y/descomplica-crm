import assert from "node:assert/strict";
import { constants } from "node:fs";
import test from "node:test";
import { MAX_LOGIN_BYTES, parseLoginCredential, readLoginCredential } from "./login-credential.mjs";

const DIRECTORY = "/run/credentials/descomplica-qlik-browser.service";
const FILE = `${DIRECTORY}/qlik-login`;
const credentials = { username: "fixture@example.test", password: "synthetic-only-password" };

function fixture({
  text = JSON.stringify(credentials),
  file = {},
  directory = {},
  aclStyle = false,
  aclOutput = (_target, _count, value) => value,
  metadata = (_kind, _path, _count, value) => value,
} = {}) {
  const content = Buffer.isBuffer(text) ? text : Buffer.from(text);
  const calls = [];
  const aclCalls = [];
  const buffers = [];
  const counts = new Map();
  const stat = {
    isFile: () => true,
    isSymbolicLink: () => false,
    uid: aclStyle ? 0 : 997,
    gid: 0,
    nlink: 1,
    mode: aclStyle ? 0o440 : 0o400,
    size: content.length,
    ino: 1,
    dev: 1,
    mtimeMs: 1,
    ctimeMs: 1,
    ...file,
  };
  let offset = 0;
  let closed = false;
  const snapshot = (kind, target, value) => {
    const key = `${kind}:${target}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return metadata(kind, target, count, { ...value });
  };
  const options = {
    platform: "linux",
    uid: 997,
    environment: { CREDENTIALS_DIRECTORY: DIRECTORY },
    run: async (command, args, options) => {
      assert.equal(command, "/usr/bin/getfacl");
      const target = args.at(-1);
      assert.deepEqual(args, [
        "--absolute-names",
        "--omit-header",
        "--numeric",
        "--no-effective",
        "--",
        target,
      ]);
      assert.deepEqual(options, {
        encoding: "utf8",
        env: {},
        shell: false,
        windowsHide: true,
        timeout: 2000,
        killSignal: "SIGKILL",
        maxBuffer: 8192,
      });
      assert.ok([DIRECTORY, FILE].includes(target));
      aclCalls.push(target);
      const permission = target === DIRECTORY ? "r-x" : "r--";
      const value = [
        `user::${permission}`,
        ...(aclStyle ? [`user:997:${permission}`] : []),
        "group::---",
        ...(aclStyle ? [`mask::${permission}`] : []),
        "other::---",
        "",
        "",
      ].join("\n");
      return {
        stdout: aclOutput(target, aclCalls.filter((item) => item === target).length, value),
        stderr: "",
      };
    },
    fs: {
      lstat: async (target) => {
        calls.push(target);
        return snapshot(
          "lstat",
          target,
          target === FILE
            ? stat
            : {
                isDirectory: () => true,
                isSymbolicLink: () => false,
                uid: target === DIRECTORY && !aclStyle ? 997 : 0,
                gid: 0,
                mode: target === DIRECTORY ? (aclStyle ? 0o550 : 0o500) : 0o755,
                ino: 2,
                dev: 1,
                nlink: 2,
                size: 0,
                mtimeMs: 1,
                ctimeMs: 1,
                ...directory,
              },
        );
      },
      realpath: async (target) => target,
      open: async (target, flags) => {
        assert.equal(target, FILE);
        assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        return {
          stat: async () => snapshot("fstat", target, stat),
          read: async (buffer, start, length) => {
            buffers.push(buffer);
            const bytesRead = Math.min(length, content.length - offset, 7);
            content.copy(buffer, start, offset, offset + bytesRead);
            offset += bytesRead;
            return { bytesRead };
          },
          close: async () => {
            closed = true;
          },
        };
      },
    },
  };
  return {
    options,
    calls,
    aclCalls,
    closed: () => closed,
    cleared: () => buffers.every((buffer) => buffer.every((byte) => byte === 0)),
  };
}

for (const aclStyle of [false, true]) {
  test(`reads only the fixed systemd credential with exact ACL, root-owned=${aclStyle}`, async () => {
    const f = fixture({ aclStyle });
    assert.deepEqual(await readLoginCredential(f.options), credentials);
    assert.deepEqual([...new Set(f.calls)], ["/run", "/run/credentials", DIRECTORY, FILE]);
    assert.deepEqual(f.aclCalls, [DIRECTORY, FILE, FILE, DIRECTORY]);
    assert.ok(f.closed() && f.cleared());
  });
}

test("validates exact fields, Unicode, whitespace preservation and bounds", () => {
  for (const value of [
    credentials,
    { username: "unicode@example.test", password: " \u0085\u2028\u2029\u202e\u200d\u200b " },
    {
      username: "usu\u00e1rio@example.test",
      password: ' \ud83d\udd11"\\ \ud83d\udc69\u200d\ud83d\udcbb',
    },
    { username: "x".repeat(320), password: "x".repeat(2048) },
  ])
    assert.deepEqual(parseLoginCredential(Buffer.from(JSON.stringify(value))), value);
  assert.deepEqual(
    parseLoginCredential(Buffer.from('{ "password": "ok", "username": "fixture" }\n')),
    { username: "fixture", password: "ok" },
  );
  for (const value of [
    null,
    [],
    {},
    { ...credentials, extra: true },
    { ...credentials, username: "" },
    { ...credentials, username: " leading" },
    { ...credentials, username: "trailing " },
    { ...credentials, username: "x".repeat(321) },
    { ...credentials, password: "x".repeat(2049) },
    { ...credentials, password: "" },
    { ...credentials, password: 123 },
    ...["\u0000", "\n", "\u007f", "\ud800", "\udfff"].map((password) => ({
      ...credentials,
      password,
    })),
  ])
    assert.throws(
      () => parseLoginCredential(Buffer.from(JSON.stringify(value))),
      /^Error: login_credential_unavailable$/,
    );
  for (const value of [
    Buffer.from([0xff]),
    Buffer.alloc(MAX_LOGIN_BYTES + 1),
    Buffer.from('{"username":"one","username":"two","password":"ok"}'),
    Buffer.from('{"username":"one","password":"ok"}{}'),
    Buffer.from("\ufeff" + JSON.stringify(credentials)),
    Buffer.from("{}"),
    "not a buffer",
  ])
    assert.throws(() => parseLoginCredential(value), /^Error: login_credential_unavailable$/);
});

for (const override of [
  { uid: 0 },
  { uid: null },
  { platform: "win32" },
  { environment: {} },
  { environment: { CREDENTIALS_DIRECTORY: "/tmp/qlik-login" } },
]) {
  test(`rejects unsupported identity/context ${JSON.stringify(override)}`, async () => {
    const f = fixture();
    await assert.rejects(
      readLoginCredential({ ...f.options, ...override }),
      /^Error: login_credential_unavailable$/,
    );
    assert.deepEqual(f.calls, []);
  });
}

for (const file of [
  { uid: 123 },
  { nlink: 2 },
  { mode: 0o440 },
  { mode: 0o644 },
  { mode: 0o4400 },
  { isSymbolicLink: () => true },
  { isFile: () => false },
  { size: 0 },
  { size: MAX_LOGIN_BYTES + 1 },
]) {
  test(`rejects unsafe files ${JSON.stringify(file)}`, async () => {
    await assert.rejects(
      readLoginCredential(fixture({ file }).options),
      /^Error: login_credential_unavailable$/,
    );
  });
}

for (const directory of [
  { uid: 123 },
  { mode: 0o777 },
  { isSymbolicLink: () => true },
  { isDirectory: () => false },
]) {
  test(`rejects unsafe parents ${JSON.stringify(directory)}`, async () => {
    await assert.rejects(
      readLoginCredential(fixture({ directory }).options),
      /^Error: login_credential_unavailable$/,
    );
  });
}

for (const target of [DIRECTORY, FILE]) {
  for (const change of [
    (value) => value + "user:998:r--\n",
    (value) => value + "group:998:r--\n",
    (value) => value.replace("user:997:", "user:998:"),
    (value) => value.replace("group::---", "group::r--"),
    (value) => value.replace("other::---", "other::r--"),
    (value) => value.replace("user:997:r-", "user:997:rw"),
    (value) => value.replace(/mask::[^\n]+/, "mask::rwx"),
    (value) => value + "default:user::r-x\n",
    (value) => value + "other::---\n",
    (value) => "# unexpected\n" + value,
    () => "x".repeat(8193),
    () => "",
  ]) {
    test(`rejects unexpected ACL principal/permission/shape on ${target}`, async () => {
      const f = fixture({
        aclStyle: true,
        aclOutput: (path, _count, value) => (path === target ? change(value) : value),
      });
      await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
    });
  }
  test(`rejects ACL change after read on ${target} and clears memory`, async () => {
    const f = fixture({
      aclStyle: true,
      aclOutput: (path, count, value) =>
        path === target && count === 2 ? value + "user:998:r--\n" : value,
    });
    await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
    assert.ok(f.closed() && f.cleared());
  });
}

for (const [field, value] of Object.entries({
  ino: 99,
  dev: 99,
  uid: 998,
  gid: 998,
  mode: 0o600,
  nlink: 2,
  size: 2,
  mtimeMs: 2,
  ctimeMs: 2,
})) {
  for (const stage of ["open", "read", "path"]) {
    test(`rejects ${field} replacement during ${stage}`, async () => {
      const f = fixture({
        metadata: (kind, target, count, info) =>
          target === FILE &&
          ((stage === "open" && kind === "fstat" && count === 1) ||
            (stage === "read" && kind === "fstat" && count === 2) ||
            (stage === "path" && kind === "lstat" && count === 3))
            ? { ...info, [field]: value }
            : info,
      });
      await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
      assert.ok(f.closed() && f.cleared());
    });
  }
}

test("shared parents may gain unrelated entries but private directory metadata is stable", async () => {
  for (const target of ["/run", "/run/credentials", DIRECTORY]) {
    const f = fixture({
      metadata: (kind, path, count, info) =>
        kind === "lstat" && path === target && count > 1
          ? { ...info, nlink: 99, size: 4096, mtimeMs: 2, ctimeMs: 2 }
          : info,
    });
    if (target === DIRECTORY)
      await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
    else assert.deepEqual(await readLoginCredential(f.options), credentials);
  }
});

test("parent replacement and canonical path changes fail closed", async () => {
  for (const target of ["/run", "/run/credentials", DIRECTORY]) {
    const f = fixture({
      metadata: (kind, path, count, info) =>
        kind === "lstat" && path === target && count > 1 ? { ...info, ino: 99 } : info,
    });
    await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
    const other = fixture();
    let calls = 0;
    other.options.fs.realpath = async (path) =>
      path === target && ++calls > 1 ? "/unrelated" : path;
    await assert.rejects(
      readLoginCredential(other.options),
      /^Error: login_credential_unavailable$/,
    );
  }
});

test("filesystem/getfacl failures never leak diagnostics and bad JSON clears the buffer", async () => {
  for (const field of ["run", "lstat", "open"]) {
    const f = fixture();
    (field === "run" ? f.options : f.options.fs)[field] = async () => {
      throw Object.assign(new Error(credentials.password), {
        stdout: credentials.username,
        stderr: credentials.password,
      });
    };
    await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
  }
  const f = fixture({ text: '{"username":"ok","password":"\\n"}' });
  await assert.rejects(readLoginCredential(f.options), /^Error: login_credential_unavailable$/);
  assert.ok(f.closed() && f.cleared());
  const other = fixture();
  const run = other.options.run;
  other.options.run = async (...args) => ({
    ...(await run(...args)),
    stderr: credentials.password,
  });
  await assert.rejects(readLoginCredential(other.options), /^Error: login_credential_unavailable$/);
});
