import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { constants } from "node:fs";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { productionLockPath, withFileLock } from "./production-release-lock.mjs";
import {
  assertEnvironmentChangeContents,
  assertSalesforceContainerDigests,
  environmentSha256,
  maximumEnvironmentBytes,
  readSalesforceReleaseSecrets,
  salesforceContainerDigestScript,
  salesforceEnvironmentBackupStore,
  salesforceEnvironmentValues,
  selectEnvironmentChange,
  transformSalesforceReleaseEnvironment,
  validateEnvironmentChange,
} from "./salesforce-release-environment.mjs";

const oldSha = "a".repeat(40);
const newSha = "b".repeat(40);
const backupId = "11111111-2222-4333-8444-555555555555";
const secrets = {
  SUPABASE_SECRET_KEY: `sb_secret_${"fixture".repeat(5)}`,
  SALESFORCE_INGEST_SECRET: "fixture".repeat(8),
};
const before = `# untouched\nIMAGE_TAG=${oldSha}\nOTHER="keep $VALUE"\nSALESFORCE_INGEST_ENABLED=false\nSALESFORCE_REFRESH_ENABLED=false\n`;
const transform = (contents = before, credentials = secrets) =>
  transformSalesforceReleaseEnvironment(contents, oldSha, newSha, credentials);
const after = transform();
const change = {
  backupId,
  beforeSha256: environmentSha256(before),
  afterSha256: environmentSha256(after),
};
const backup = { schemaVersion: 1, ...change, before, after };
const options = { expectedCurrentSha: oldSha, targetSha: newSha };

test("transform changes only the image and four Salesforce keys, preserving other bytes", () => {
  assert.equal(
    after,
    before.replace(oldSha, newSha).replace("INGEST_ENABLED=false", "INGEST_ENABLED=true") +
      `SUPABASE_SECRET_KEY=${secrets.SUPABASE_SECRET_KEY}\nSALESFORCE_INGEST_SECRET=${secrets.SALESFORCE_INGEST_SECRET}\n`,
  );
  for (const newline of ["\n", "\r\n"]) {
    const input = (
      before + 'export SUPABASE_SECRET_KEY="previous"\n  SALESFORCE_INGEST_SECRET = old # comment'
    ).replaceAll("\n", newline);
    const result = transform(input);
    assert.equal(
      result.endsWith(`SALESFORCE_INGEST_SECRET=${secrets.SALESFORCE_INGEST_SECRET}`),
      true,
    );
    assert.equal(result.includes(`OTHER="keep $VALUE"${newline}`), true);
    assert.equal(result.split("SUPABASE_SECRET_KEY=").length, 2);
  }
  assert.equal(transform(before.trimEnd()).includes("false\nSUPABASE_SECRET_KEY="), true);
});

for (const assignment of [
  `IMAGE_TAG=${oldSha}`,
  "export SALESFORCE_INGEST_ENABLED = false",
  " SALESFORCE_REFRESH_ENABLED=false",
  "OTHER=duplicate",
  "OTHER: duplicate",
  "SUPABASE_SECRET_KEY=x\n export SUPABASE_SECRET_KEY = y",
  "SALESFORCE_INGEST_SECRET=x\nSALESFORCE_INGEST_SECRET=y",
  "BARE_KEY",
  "MULTILINE='first\nSECOND=hidden'",
]) {
  test(`ambiguous environment fixture ${assignment.split(/[ =:]/u)[0] || "whitespace"} fails closed`, () => {
    assert.throws(() => transform(`${before}${assignment}\n`), /ambiguous|duplicated|unsupported/u);
  });
}

test("rejects invalid environment sizes, controls, managed interpolation and image SHAs", () => {
  for (const input of [
    before + "\0",
    before + "X=\x01",
    before + "X=\u2028",
    before + "X=\ud800",
    "x".repeat(maximumEnvironmentBytes + 1),
  ]) {
    assert.throws(() => transform(input), /invalid|large/u);
  }
  for (const value of ["$TOKEN", '"${TOKEN}"', "'${TOKEN}'", "abc\\def"]) {
    assert.throws(() => transform(`${before}SUPABASE_SECRET_KEY=${value}\n`), /literals/u);
  }
  assert.throws(() => transform(before.replace(oldSha, newSha)), /expected SHA/u);
  assert.throws(
    () => transformSalesforceReleaseEnvironment(before, oldSha, oldSha, secrets),
    /distinct/u,
  );
  assert.throws(
    () => transformSalesforceReleaseEnvironment(before, oldSha, "short", secrets),
    /exact/u,
  );
});

test("new secrets reject duplicates in shape, short, control, interpolation and dotenv syntax without exposure", () => {
  const invalidValues = [
    "",
    "short",
    "x".repeat(4097),
    `${secrets.SALESFORCE_INGEST_SECRET}\n`,
    `${secrets.SALESFORCE_INGEST_SECRET}\r\n`,
    `abc\t${secrets.SALESFORCE_INGEST_SECRET}`,
    `${secrets.SALESFORCE_INGEST_SECRET}$TOKEN`,
    `"${secrets.SALESFORCE_INGEST_SECRET}"`,
    `${secrets.SALESFORCE_INGEST_SECRET} #comment`,
    `${secrets.SALESFORCE_INGEST_SECRET}\0`,
    `${secrets.SALESFORCE_INGEST_SECRET}\\`,
    secrets.SUPABASE_SECRET_KEY,
  ];
  for (const value of invalidValues) {
    assert.throws(
      () => transform(before, { ...secrets, SALESFORCE_INGEST_SECRET: value }),
      (error) => {
        assert.equal(error.message, "Salesforce release secrets are invalid.");
        return true;
      },
    );
  }
  assert.throws(() => transform(before, { ...secrets, SUPABASE_SECRET_KEY: "not-a-supabase-key" }));
  assert.throws(() => transform(before, { ...secrets, extra: "ignored" }), /shape/u);
});

test("full CAS applies only before, restores before or after, and rejects unrelated edits", () => {
  assert.equal(selectEnvironmentChange(before, backup, change, options), after);
  assert.throws(
    () =>
      selectEnvironmentChange(after, backup, change, { ...options, expectedCurrentSha: newSha }),
    /compare-and-swap/u,
  );
  for (const contents of [before, after]) {
    const currentSha = contents === before ? oldSha : newSha;
    assert.equal(
      selectEnvironmentChange(contents, backup, change, {
        expectedCurrentSha: currentSha,
        targetSha: oldSha,
        restoreEnvironment: true,
      }),
      before,
    );
    assert.throws(
      () =>
        selectEnvironmentChange(`${contents}UNRELATED=changed\n`, backup, change, {
          expectedCurrentSha: currentSha,
          targetSha: oldSha,
          restoreEnvironment: true,
        }),
      /compare-and-swap/u,
    );
  }
  assert.throws(
    () => selectEnvironmentChange(before, backup, change, { ...options, targetSha: oldSha }),
    /SHAs/u,
  );
  assert.throws(
    () =>
      selectEnvironmentChange(before, backup, change, { ...options, restoreEnvironment: false }),
    /explicit/u,
  );
});

test("verification matches complete contents and the four effective container values including Compose empty defaults", () => {
  const priorValues = {
    SUPABASE_SECRET_KEY: "",
    SALESFORCE_INGEST_SECRET: "",
    SALESFORCE_INGEST_ENABLED: "false",
    SALESFORCE_REFRESH_ENABLED: "false",
  };
  assert.deepEqual(salesforceEnvironmentValues(before), priorValues);
  for (const [contents, restore] of [
    [before, true],
    [after, false],
  ]) {
    assertEnvironmentChangeContents(contents, backup, change, restore);
    assert.throws(
      () => assertEnvironmentChangeContents(`${contents}OTHER_CHANGE=x\n`, backup, change, restore),
      /complete/u,
    );
    const values = salesforceEnvironmentValues(contents);
    const hashes = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, environmentSha256(value)]),
    );
    assertSalesforceContainerDigests(contents, hashes);
    for (const key of Object.keys(values)) {
      assert.throws(
        () =>
          assertSalesforceContainerDigests(contents, {
            ...hashes,
            [key]: environmentSha256("different"),
          }),
        /Effective/u,
      );
      assert.throws(
        () => assertSalesforceContainerDigests(contents, { ...hashes, [key]: null }),
        /Effective/u,
      );
    }
    const actual = execFileSync(
      process.execPath,
      ["--input-type=commonjs", "--eval", salesforceContainerDigestScript],
      {
        env: { ...values },
        encoding: "utf8",
      },
    );
    assert.deepEqual(JSON.parse(actual), hashes);
    assert.equal(actual.includes(secrets.SALESFORCE_INGEST_SECRET), false);
  }
  assert.throws(
    () => salesforceEnvironmentValues(before.replace("SALESFORCE_REFRESH_ENABLED=false\n", "")),
    /Compose requires/u,
  );
  assert.throws(
    () => assertEnvironmentChangeContents(before, backup, change, undefined),
    /direction/u,
  );
});

test("descriptor and backup digests bind identity, both snapshots and the restricted transformation", () => {
  for (const patch of [
    { backupId: "../../escape" },
    { backupId: "" },
    { afterSha256: "bad" },
    { afterSha256: change.beforeSha256 },
    { extra: true },
  ]) {
    assert.throws(() => validateEnvironmentChange({ ...change, ...patch }));
  }
  for (const patch of [
    { before: `${before}CHANGED=true\n` },
    { after: `${after}CHANGED=true\n` },
    { backupId: "other" },
  ]) {
    assert.throws(
      () => selectEnvironmentChange(before, { ...backup, ...patch }, change, options),
      /descriptor|digests/u,
    );
  }
  const unrelatedAfter = `${after}UNRELATED=new\n`;
  const forgedChange = { ...change, afterSha256: environmentSha256(unrelatedAfter) };
  assert.throws(
    () =>
      selectEnvironmentChange(
        before,
        { ...backup, ...forgedChange, after: unrelatedAfter },
        forgedChange,
        options,
      ),
    /unrelated transformation/u,
  );
});

// In-memory filesystem exercises ownership, bounded reads and durability ordering on Windows.
// The separate Linux test below also exercises physical permissions, links and fsync.
function memoryFilesystem(t) {
  const directory = path.resolve(os.tmpdir(), "salesforce-release-fixture", "backups");
  const entries = new Map();
  const events = [];
  let nextInode = 1;
  const metadata = (kind, overrides = {}) => ({
    uid: 0,
    gid: 0,
    mode: kind === "directory" ? 0o700 : 0o600,
    nlink: 1,
    ino: nextInode++,
    dev: 1,
    mtimeMs: 1,
    ctimeMs: 1,
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file",
    isSymbolicLink: () => kind === "symlink",
    ...overrides,
  });
  const add = (target, kind, content = "", overrides) => {
    entries.set(target, { data: Buffer.from(content), metadata: metadata(kind, overrides) });
  };
  add(path.dirname(directory), "directory");
  const missing = () => Object.assign(new Error("Fixture not found."), { code: "ENOENT" });
  const info = (target) => {
    const entry = entries.get(target);
    if (!entry) throw missing();
    return { ...entry.metadata, size: entry.data.length };
  };
  const patches = [
    t.mock.method(filesystem, "lstat", async (target) => info(target)),
    t.mock.method(filesystem, "realpath", async (target) => {
      info(target);
      return entries.get(target).alias ?? target;
    }),
    t.mock.method(filesystem, "mkdir", async (target, config) => {
      events.push("mkdir");
      assert.equal(config.mode, 0o700);
      if (entries.has(target))
        throw Object.assign(new Error("Fixture exists."), { code: "EEXIST" });
      add(target, "directory");
    }),
    t.mock.method(filesystem, "open", async (target, flags, mode) => {
      events.push(["open", target, flags]);
      if (flags === "wx" || flags & constants.O_CREAT) {
        assert.ok(flags === "wx" || flags & constants.O_EXCL);
        assert.equal(mode, 0o600);
        if (entries.has(target))
          throw Object.assign(new Error("Fixture exists."), { code: "EEXIST" });
        add(target, "file");
      }
      info(target);
      if (entries.get(target).metadata.isSymbolicLink())
        throw new Error("Symlink fixture rejected.");
      const entry = entries.get(target);
      return {
        fd: 3,
        stat: async () => ({ ...entry.metadata, size: entry.data.length }),
        readFile: async (encoding) =>
          encoding ? entry.data.toString(encoding) : Buffer.from(entry.data),
        read: async (buffer, offset, length, position) => {
          const bytesRead = entry.data.copy(buffer, offset, position, position + length);
          return { bytesRead, buffer };
        },
        writeFile: async (value) => {
          events.push("write");
          entry.data = Buffer.from(value);
        },
        sync: async () => {
          events.push(["sync", target]);
        },
        close: async () => {},
        chown: async (uid, gid) => {
          entry.metadata.uid = uid;
          entry.metadata.gid = gid;
        },
        chmod: async (mode) => {
          entry.metadata.mode = mode;
        },
      };
    }),
    t.mock.method(filesystem, "rename", async (from, to) => {
      events.push(["rename", from, to]);
      if (!entries.has(from)) throw missing();
      entries.set(to, entries.get(from));
      entries.delete(from);
    }),
    t.mock.method(filesystem, "rm", async (target) => {
      entries.delete(target);
    }),
  ];
  syncBuiltinESMExports();
  t.after(() => {
    for (const patch of patches) patch.mock.restore();
    syncBuiltinESMExports();
  });
  return { directory, entries, add, events };
}

test("backup is exclusive, durable, private and round-trips complete snapshots with bounded reads", async (t) => {
  const { directory, entries, events } = memoryFilesystem(t);
  const store = salesforceEnvironmentBackupStore(directory);
  assert.deepEqual(await store.create(backupId, before, after), change);
  assert.deepEqual(await store.read(change), backup);
  const file = path.join(directory, `${backupId}.json`);
  const saved = Buffer.from(entries.get(file).data);
  assert.ok(
    events.findIndex((event) => event[0] === "sync" && event[1] === file) > events.indexOf("write"),
  );
  assert.ok(
    events.findIndex((event) => event[0] === "sync" && event[1] === directory) >
      events.indexOf("write"),
  );
  await assert.rejects(store.create(backupId, before, after), { code: "EEXIST" });
  assert.deepEqual(entries.get(file).data, saved);
  for (const contents of [
    "{private-malformed",
    saved.toString().replace('{"schemaVersion":1,', '{"schemaVersion":0,"schemaVersion":1,'),
    "x".repeat(800000),
  ]) {
    entries.get(file).data = Buffer.from(contents);
    await assert.rejects(store.read(change), (error) => {
      assert.equal(error.message.includes("private-malformed"), false);
      return true;
    });
  }
  entries.get(file).data = Buffer.from([0xff]);
  await assert.rejects(store.read(change), /UTF-8/u);
});

test("backup rejects wrong owner, permissions, hardlinks, symlink paths and invalid digest", async (t) => {
  const { directory, entries } = memoryFilesystem(t);
  const store = salesforceEnvironmentBackupStore(directory);
  await store.create(backupId, before, after);
  const file = path.join(directory, `${backupId}.json`);
  for (const [target, patch] of [
    [directory, { mode: 0o710 }],
    [directory, { uid: 1 }],
    [directory, { gid: 1 }],
    [file, { mode: 0o640 }],
    [file, { mode: 0o4600 }],
    [file, { nlink: 2 }],
    [file, { uid: 1 }],
    [file, { gid: 1 }],
    [file, { isFile: () => false }],
  ]) {
    const original = entries.get(target).metadata;
    entries.get(target).metadata = { ...original, ...patch };
    await assert.rejects(store.read(change));
    entries.get(target).metadata = original;
  }
  entries.get(directory).alias = "/elsewhere";
  await assert.rejects(store.read(change), /directory/u);
  delete entries.get(directory).alias;
  entries.get(file).metadata.isSymbolicLink = () => true;
  await assert.rejects(store.read(change), /Symlink/u);
  entries.get(file).metadata.isSymbolicLink = () => false;
  entries.get(file).data = Buffer.from(
    JSON.stringify({ ...backup, before: `${before}CHANGED=true\n` }) + "\n",
  );
  await assert.rejects(store.read(change), /digests/u);
});

test("credential files accept one terminal newline, reject controls and never participate in restore", async (t) => {
  const { add, entries } = memoryFilesystem(t);
  const directory = "/etc/descomplica-crm/secrets";
  add(path.dirname(directory), "directory");
  add(directory, "directory", "", { mode: 0o710 });
  const supabaseFile = path.join(directory, "salesforce-supabase-secret");
  const bearerFile = path.join(directory, "salesforce-crm-ingest-bearer");
  add(supabaseFile, "file", `${secrets.SUPABASE_SECRET_KEY}\n`);
  add(bearerFile, "file", `${secrets.SALESFORCE_INGEST_SECRET}\r\n`);
  assert.deepEqual(await readSalesforceReleaseSecrets(), secrets);
  entries.get(bearerFile).data = Buffer.from(`${secrets.SALESFORCE_INGEST_SECRET}\n\n`);
  await assert.rejects(readSalesforceReleaseSecrets(), /invalid/u);
  entries.delete(bearerFile);
  entries.delete(supabaseFile);
  assert.equal(
    selectEnvironmentChange(after, backup, change, {
      expectedCurrentSha: newSha,
      targetSha: oldSha,
      restoreEnvironment: true,
    }),
    before,
  );
});

test("host preparation and binder apply/restore retain locks, runtime checks and full CAS with isolated I/O", async (t) => {
  const { entries, add } = memoryFilesystem(t);
  const envFile = "/etc/descomplica-crm/production.env";
  const parent = "/etc/descomplica-crm";
  const secretDirectory = "/etc/descomplica-crm/secrets";
  const oldImage = `sha256:${"1".repeat(64)}`;
  const newImage = `sha256:${"2".repeat(64)}`;
  const priorId = "aaaaaaaa-2222-4333-8444-555555555555";
  const backupFile = path.join("/etc/descomplica-crm/config-backups", `${backupId}.json`);
  add(parent, "directory");
  add(envFile, "file", before);
  add(secretDirectory, "directory", "", { mode: 0o710 });
  const secretFiles = [
    path.join(secretDirectory, "salesforce-supabase-secret"),
    path.join(secretDirectory, "salesforce-crm-ingest-bearer"),
  ];
  add(secretFiles[0], "file", secrets.SUPABASE_SECRET_KEY);
  add(secretFiles[1], "file", secrets.SALESFORCE_INGEST_SECRET);
  add("/var/run/docker.sock", "file", "", { isSocket: () => true, mode: 0o660 });
  add(
    "/etc/descomplica-crm/production-release.json",
    "file",
    JSON.stringify({
      schemaVersion: 1,
      inProgress: null,
      release: {
        deploymentId: priorId,
        sha: oldSha,
        imageId: oldImage,
        deployedAt: "2026-01-01T00:00:00.000Z",
        evidence: "fixture",
      },
    }),
  );
  let runtimeValues = salesforceEnvironmentValues(before);
  let runtimeSha = oldSha;
  let runtimeImage = oldImage;
  let failAfterWrite = false;
  const calls = [];
  const execute = async (command, args) => {
    calls.push([command, args]);
    if (command === "git") {
      if (args[0] === "rev-parse") return { stdout: newSha };
      if (failAfterWrite && entries.get(envFile).data.toString() === after) {
        failAfterWrite = false;
        throw new Error("Synthetic postcondition failure.");
      }
      return { stdout: "" };
    }
    assert.equal(command, "/usr/bin/docker");
    if (args.includes("image")) {
      const target = args.at(-1).endsWith(newSha) ? [newImage, newSha] : [oldImage, oldSha];
      return { stdout: target.join("\t") };
    }
    if (args[0] === "ps") return { stdout: "f".repeat(64) };
    if (args[0] === "container") return { stdout: `${runtimeImage}\t${runtimeSha}\ttrue` };
    assert.equal(args[0], "exec");
    assert.equal(args.at(-1), salesforceContainerDigestScript);
    return {
      stdout: JSON.stringify(
        Object.fromEntries(
          Object.entries(runtimeValues).map(([key, value]) => [key, environmentSha256(value)]),
        ),
      ),
    };
  };
  const execMock = () => {
    throw new Error("Only promisified fixture execution is allowed.");
  };
  execMock[promisify.custom] = execute;
  const originalExec = childProcess.execFile;
  childProcess.execFile = execMock;
  const spawnPatch = t.mock.method(childProcess, "spawn", (command) => {
    assert.equal(command, "/usr/bin/flock");
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ status: "ok", version: runtimeSha }),
  }));
  const uidDescriptor = Object.getOwnPropertyDescriptor(process, "getuid");
  Object.defineProperty(process, "getuid", { configurable: true, value: () => 0 });
  syncBuiltinESMExports();
  t.after(() => {
    childProcess.execFile = originalExec;
    spawnPatch.mock.restore();
    if (uidDescriptor) Object.defineProperty(process, "getuid", uidDescriptor);
    else delete process.getuid;
    syncBuiltinESMExports();
  });
  const { productionHost } = await import("./production-release-host.mjs");
  await withFileLock(productionLockPath, async (lock) => {
    const host = productionHost(lock);
    const prepareOptions = {
      operation: "deploy",
      salesforceIngestion: true,
      expectedDeploymentId: priorId,
      expectedSha: oldSha,
      targetSha: newSha,
    };
    runtimeValues.SUPABASE_SECRET_KEY = "prior-runtime-does-not-match";
    await assert.rejects(
      host.prepareEnvironmentChange(prepareOptions, backupId),
      /Effective container/u,
    );
    assert.equal(entries.has(backupFile), false);
    runtimeValues = salesforceEnvironmentValues(before);
    assert.deepEqual(await host.prepareEnvironmentChange(prepareOptions, backupId), change);
    assert.equal(entries.get(envFile).data.toString(), before);
    const bindOptions = {
      ...options,
      expectedImageId: newImage,
      boundarySha: newSha,
      environmentChange: change,
    };
    let beforeWrites = 0;
    await host.bind(bindOptions, async () => {
      beforeWrites++;
    });
    assert.equal(beforeWrites, 1);
    assert.equal(entries.get(envFile).data.toString(), after);
    runtimeSha = newSha;
    runtimeImage = newImage;
    runtimeValues = salesforceEnvironmentValues(after);
    await host.verify(newSha, newImage, { change, restore: false });
    for (const file of secretFiles) entries.delete(file);
    const restoreOptions = {
      expectedCurrentSha: newSha,
      targetSha: oldSha,
      expectedImageId: oldImage,
      boundarySha: newSha,
      environmentChange: change,
      restoreEnvironment: true,
    };
    await host.bind(restoreOptions, async () => {});
    assert.equal(entries.get(envFile).data.toString(), before);
    await host.bind({ ...restoreOptions, expectedCurrentSha: oldSha }, async () => {});
    runtimeSha = oldSha;
    runtimeImage = oldImage;
    runtimeValues = salesforceEnvironmentValues(before);
    await host.verify(oldSha, oldImage, { change, restore: true });
    failAfterWrite = true;
    await assert.rejects(
      host.bind(bindOptions, async () => {}),
      /worktree status/u,
    );
    assert.equal(entries.get(envFile).data.toString(), before);
    const unrelated = `${before}EXTERNAL=changed\n`;
    await assert.rejects(
      host.bind(bindOptions, async () => {
        entries.get(envFile).data = Buffer.from(unrelated);
      }),
      /changed/u,
    );
    assert.equal(entries.get(envFile).data.toString(), unrelated);
    assert.equal(
      calls.some(([, args]) => args.includes("compose")),
      false,
    );
  });
});

test(
  "physical POSIX backup: mode, single links, exclusive create, corrupt restore and directory fsync",
  {
    skip:
      process.platform !== "linux"
        ? "Physical POSIX checks require Linux; mandatory on CI Ubuntu."
        : false,
  },
  async (t) => {
    const parent = await filesystem.realpath(
      await filesystem.mkdtemp(path.join(os.tmpdir(), "salesforce-env-")),
    );
    await filesystem.chmod(parent, 0o700);
    t.after(() => filesystem.rm(parent, { recursive: true, force: true }));
    const directory = path.join(parent, "backups");
    const store = salesforceEnvironmentBackupStore(directory, process.getuid());
    assert.deepEqual(await store.create(backupId, before, after), change);
    const file = path.join(directory, `${backupId}.json`);
    assert.equal((await filesystem.stat(directory)).mode & 0o777, 0o700);
    assert.equal((await filesystem.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await store.read(change), backup);
    await assert.rejects(store.create(backupId, before, after), { code: "EEXIST" });
    const alias = path.join(directory, "alias");
    await filesystem.link(file, alias);
    await assert.rejects(store.read(change), /single link/u);
    await filesystem.unlink(alias);
    await filesystem.chmod(file, 0o644);
    await assert.rejects(store.read(change), /0600/u);
    await filesystem.chmod(file, 0o600);
    await filesystem.rename(file, alias);
    await filesystem.symlink(alias, file);
    await assert.rejects(store.read(change));
    await filesystem.unlink(file);
    await filesystem.rename(alias, file);
    await filesystem.writeFile(file, "{corrupt private backup");
    await assert.rejects(store.read(change), /JSON is invalid/u);
  },
);
