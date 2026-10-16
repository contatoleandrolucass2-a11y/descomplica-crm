import assert from "node:assert/strict";
import test from "node:test";
import { constants } from "node:fs";
import { readRankingCredential } from "./ranking-credential.mjs";

const DIRECTORY = "/run/credentials/descomplica-qlik-browser.service";
const FILE = `${DIRECTORY}/qlik-ranking-hmac`;
const secret = "q".repeat(43);
function fixture({
  text = secret,
  file = {},
  directory = {},
  error = false,
  aclStyle = false,
  aclOutput = (_target, _count, value) => value,
  metadata = (_kind, _path, _count, value) => value,
} = {}) {
  const content = Buffer.from(text);
  const calls = [];
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
  let readBuffer;
  const aclCalls = [];
  const counts = new Map();
  const snapshot = (kind, path, value) => {
    const key = `${kind}:${path}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return metadata(kind, path, count, { ...value });
  };
  return {
    calls,
    aclCalls,
    closed: () => closed,
    cleared: () => readBuffer?.every((byte) => byte === 0),
    options: {
      uid: 997,
      platform: "linux",
      environment: { CREDENTIALS_DIRECTORY: DIRECTORY },
      run: async (command, args, options) => {
        assert.equal(command, "/usr/bin/getfacl");
        const target = args.at(-1);
        assert.ok([DIRECTORY, FILE].includes(target));
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
          stdout: aclOutput(target, aclCalls.filter((p) => p === target).length, value),
          stderr: "",
        };
      },
      fs: {
        lstat: async (path) => {
          calls.push(path);
          if (error) throw new Error(secret);
          return snapshot(
            "lstat",
            path,
            path === FILE
              ? stat
              : {
                  isDirectory: () => true,
                  isSymbolicLink: () => false,
                  uid: path === DIRECTORY && !aclStyle ? 997 : 0,
                  gid: 0,
                  mode: path === DIRECTORY ? (aclStyle ? 0o550 : 0o500) : 0o755,
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
        realpath: async (path) => path,
        open: async (path, flags) => {
          assert.equal(path, FILE);
          assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          return {
            stat: async () => snapshot("fstat", FILE, stat),
            read: async (buffer, targetOffset, length) => {
              readBuffer = buffer;
              const bytesRead = Math.min(length, content.length - offset, 7);
              content.copy(buffer, targetOffset, offset, offset + bytesRead);
              offset += bytesRead;
              return { bytesRead };
            },
            close: async () => {
              closed = true;
            },
          };
        },
      },
    },
  };
}

test("reads only the fixed systemd credential and clears the transient buffer", async () => {
  const f = fixture({ text: secret + "\n" });
  assert.equal(await readRankingCredential(f.options), secret);
  assert.equal(f.closed(), true);
  assert.equal(f.cleared(), true);
  assert.deepEqual([...new Set(f.calls)], ["/run", "/run/credentials", DIRECTORY, FILE]);
});

for (const override of [
  { uid: 0 },
  { uid: null },
  { platform: "win32" },
  { environment: {} },
  { environment: { CREDENTIALS_DIRECTORY: "/tmp" } },
]) {
  test(`rejects unsupported credential context ${JSON.stringify(override)}`, async () => {
    const f = fixture();
    await assert.rejects(
      readRankingCredential({ ...f.options, ...override }),
      /ranking_credential_unavailable/,
    );
    assert.equal(f.calls.length, 0);
  });
}

for (const file of [
  { uid: 123 },
  { nlink: 2 },
  { mode: 0o440 },
  { mode: 0o644 },
  { isSymbolicLink: () => true },
  { isFile: () => false },
  { size: 131 },
]) {
  test(`rejects unsafe credential file ${JSON.stringify(file)}`, async () => {
    await assert.rejects(
      readRankingCredential(fixture({ file }).options),
      /ranking_credential_unavailable/,
    );
  });
}

for (const directory of [{ uid: 123 }, { mode: 0o777 }, { isSymbolicLink: () => true }]) {
  test(`rejects unsafe credential directory ${JSON.stringify(directory)}`, async () => {
    await assert.rejects(
      readRankingCredential(fixture({ directory }).options),
      /ranking_credential_unavailable/,
    );
  });
}

for (const text of ["short", "!".repeat(43), "a".repeat(131), "a".repeat(42) + "\u0000"]) {
  test("rejects invalid secret bytes without exposing them", async () => {
    await assert.rejects(
      readRankingCredential(fixture({ text }).options),
      /^Error: ranking_credential_unavailable$/,
    );
  });
}

test("filesystem error text never propagates", async () => {
  await assert.rejects(
    readRankingCredential(fixture({ error: true }).options),
    /^Error: ranking_credential_unavailable$/,
  );
});

test("accepts the systemd 255 root-owned ACL and checks it before and after reading", async () => {
  const f = fixture({ aclStyle: true });
  assert.equal(await readRankingCredential(f.options), secret);
  assert.deepEqual(f.aclCalls, [DIRECTORY, FILE, FILE, DIRECTORY]);
  assert.equal(f.closed(), true);
  assert.equal(f.cleared(), true);
});

test("the owner-only fallback also requires an exact base ACL", async () => {
  const f = fixture();
  assert.equal(await readRankingCredential(f.options), secret);
  assert.deepEqual(f.aclCalls, [DIRECTORY, FILE, FILE, DIRECTORY]);
});

for (const target of [DIRECTORY, FILE]) {
  for (const [name, change] of [
    ["another user", (value) => value + "user:998:r--\n"],
    ["another group", (value) => value + "group:998:r--\n"],
    ["wrong dedicated user", (value) => value.replace("user:997:", "user:998:")],
    ["owning group access", (value) => value.replace("group::---", "group::r--")],
    ["other access", (value) => value.replace("other::---", "other::r--")],
    ["write permission", (value) => value.replace("user:997:r-", "user:997:rw")],
    ["wrong mask", (value) => value.replace(/mask::[^\n]+/, "mask::rwx")],
    ["default ACL", (value) => value + "default:user::r-x\n"],
    ["duplicate entry", (value) => value + "other::---\n"],
    ["unexpected header", (value) => "# unexpected\n" + value],
    ["oversized output", () => "x".repeat(8193)],
    ["missing ACL", () => ""],
  ]) {
    test(`rejects ${name} on ${target === FILE ? "file" : "directory"}`, async () => {
      const f = fixture({
        aclStyle: true,
        aclOutput: (path, _count, value) => (path === target ? change(value) : value),
      });
      await assert.rejects(
        readRankingCredential(f.options),
        /^Error: ranking_credential_unavailable$/,
      );
    });
  }
  test(`rejects changed ACL after reading on ${target === FILE ? "file" : "directory"}`, async () => {
    const f = fixture({
      aclStyle: true,
      aclOutput: (path, count, value) =>
        path === target && count === 2 ? value + "user:998:r--\n" : value,
    });
    await assert.rejects(
      readRankingCredential(f.options),
      /^Error: ranking_credential_unavailable$/,
    );
    assert.equal(f.closed(), true);
    assert.equal(f.cleared(), true);
  });
}

for (const [name, patch] of [
  ["inode", { ino: 99 }],
  ["device", { dev: 99 }],
  ["owner", { uid: 998 }],
  ["group", { gid: 998 }],
  ["mode", { mode: 0o600 }],
  ["link count", { nlink: 2 }],
  ["size", { size: 44 }],
  ["mtime", { mtimeMs: 2 }],
  ["ctime", { ctimeMs: 2 }],
]) {
  for (const stage of ["open", "read", "path"]) {
    test(`rejects ${name} mutation at ${stage}`, async () => {
      const f = fixture({
        metadata: (kind, path, count, value) => {
          const changed =
            path === FILE &&
            ((stage === "open" && kind === "fstat" && count === 1) ||
              (stage === "read" && kind === "fstat" && count === 2) ||
              (stage === "path" && kind === "lstat" && count === 3));
          return changed ? { ...value, ...patch } : value;
        },
      });
      await assert.rejects(
        readRankingCredential(f.options),
        /^Error: ranking_credential_unavailable$/,
      );
      assert.equal(f.closed(), true);
      if (stage !== "open") assert.equal(f.cleared(), true);
    });
  }
}

for (const target of ["/run", "/run/credentials", DIRECTORY, FILE]) {
  test(`rejects path replacement during getfacl for ${target}`, async () => {
    const f = fixture({
      metadata: (kind, path, count, value) =>
        kind === "lstat" && path === target && count >= 2 ? { ...value, ino: 99 } : value,
    });
    await assert.rejects(
      readRankingCredential(f.options),
      /^Error: ranking_credential_unavailable$/,
    );
  });
}

for (const code of ["ENOENT", "ETIMEDOUT", "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"]) {
  test(`getfacl ${code} fails closed without exposing subprocess errors`, async () => {
    const f = fixture();
    f.options.run = async () => {
      throw Object.assign(new Error(secret), { code, stdout: secret, stderr: secret });
    };
    await assert.rejects(
      readRankingCredential(f.options),
      /^Error: ranking_credential_unavailable$/,
    );
  });
}

test("getfacl stderr is rejected without echo", async () => {
  const f = fixture();
  const run = f.options.run;
  f.options.run = async (...args) => ({ ...(await run(...args)), stderr: secret });
  await assert.rejects(readRankingCredential(f.options), /^Error: ranking_credential_unavailable$/);
});

test("fallback rejects an extra masked principal", async () => {
  const f = fixture({ aclOutput: (_path, _count, value) => value + "user:998:---\nmask::---\n" });
  await assert.rejects(readRankingCredential(f.options), /^Error: ranking_credential_unavailable$/);
});

for (const target of ["/run", "/run/credentials"]) {
  test(`unrelated entry changes in ${target} preserve a valid private credential`, async () => {
    const f = fixture({
      aclStyle: true,
      metadata: (kind, path, count, value) =>
        kind === "lstat" && path === target && count > 1
          ? { ...value, nlink: 99, size: 4096, mtimeMs: 2, ctimeMs: 2 }
          : value,
    });
    assert.equal(await readRankingCredential(f.options), secret);
    assert.deepEqual(f.aclCalls, [DIRECTORY, FILE, FILE, DIRECTORY]);
    assert.equal(f.closed(), true);
    assert.equal(f.cleared(), true);
  });

  for (const patch of [
    { ino: 99 },
    { dev: 99 },
    { uid: 997 },
    { gid: 99 },
    { mode: 0o777 },
    { isDirectory: () => false },
    { isSymbolicLink: () => true },
  ]) {
    test(`shared parent ${target} still requires stable identity, permissions and directory type ${JSON.stringify(patch)}`, async () => {
      const f = fixture({
        metadata: (kind, path, count, value) =>
          kind === "lstat" && path === target && count > 1 ? { ...value, ...patch } : value,
      });
      await assert.rejects(
        readRankingCredential(f.options),
        /^Error: ranking_credential_unavailable$/,
      );
      assert.equal(f.closed(), true);
      assert.equal(f.cleared(), true);
    });
  }

  test(`shared parent ${target} still requires its canonical realpath after reading`, async () => {
    const f = fixture();
    let calls = 0;
    f.options.fs.realpath = async (path) => (path === target && ++calls > 1 ? "/unrelated" : path);
    await assert.rejects(
      readRankingCredential(f.options),
      /^Error: ranking_credential_unavailable$/,
    );
    assert.equal(f.cleared(), true);
  });
}

for (const key of ["nlink", "size", "mtimeMs", "ctimeMs"]) {
  test(`private credential directory retains strict ${key} stability`, async () => {
    const f = fixture({
      metadata: (kind, path, count, value) =>
        kind === "lstat" && path === DIRECTORY && count >= 3 ? { ...value, [key]: 99 } : value,
    });
    await assert.rejects(
      readRankingCredential(f.options),
      /^Error: ranking_credential_unavailable$/,
    );
    assert.equal(f.closed(), true);
    assert.equal(f.cleared(), true);
  });
}
