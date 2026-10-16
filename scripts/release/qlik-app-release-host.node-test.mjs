import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import timers from "node:timers/promises";
import { promisify } from "node:util";
import { productionLockPath, withFileLock } from "./production-release-lock.mjs";
import { memoryFilesystem } from "./fixtures/private-release-filesystem.mjs";
import {
  environmentSha256,
  qlikContainerDigestScript,
  qlikEnvironmentValues,
  readQlikReleaseSecret,
  salesforceContainerDigestScript,
  salesforceEnvironmentBackupStore,
  salesforceEnvironmentValues,
  selectEnvironmentChange,
  transformQlikReleaseEnvironment,
  transformSalesforceReleaseEnvironment,
} from "./salesforce-release-environment.mjs";

const oldSha = "a".repeat(40);
const newSha = "b".repeat(40);
const oldImage = `sha256:${"1".repeat(64)}`;
const newImage = `sha256:${"2".repeat(64)}`;
const priorId = "aaaaaaaa-2222-4333-8444-555555555555";
const backupId = "bbbbbbbb-2222-4333-8444-555555555555";
const sfBackupId = "cccccccc-2222-4333-8444-555555555555";
const secret = "synthetic-qlik-" + "q".repeat(43);
const sfSecret = "synthetic-salesforce-" + "s".repeat(32);
const supabaseSecret = `sb_secret_${"fixture".repeat(5)}`;
const parent = "/etc/descomplica-crm";
const envFile = `${parent}/production.env`;
const stateFile = `${parent}/production-release.json`;
const secretDirectory = `${parent}/secrets`;
const secretFile = path.join(secretDirectory, "qlik-ranking-hmac");
const backupDirectory = `${parent}/config-backups`;
const backupFile = path.join(backupDirectory, `${backupId}.json`);
const before = `# preserve legacy integrations\nIMAGE_TAG=${oldSha}\nSUPABASE_SECRET_KEY=${supabaseSecret}\nSALESFORCE_INGEST_SECRET=${sfSecret}\nSALESFORCE_INGEST_ENABLED=true\nSALESFORCE_REFRESH_ENABLED=false\nQLIK_RELAY_MODE=shadow\nQLIK_RELAY_HMAC_SECRET=legacy-relay-distinct\nOTHER="keep $VALUE"\n`;
const after = transformQlikReleaseEnvironment(before, oldSha, newSha, secret);
const change = {
  backupId,
  beforeSha256: environmentSha256(before),
  afterSha256: environmentSha256(after),
};
const hashes = (values) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, environmentSha256(value)]));

test("Qlik production host: isolated private backup, CAS, restore and runtime checks", async (t) => {
  const fs = memoryFilesystem(t);
  const calls = [];
  let runtime;
  let failAfterWrite = false;
  function reset() {
    fs.entries.clear();
    fs.events.length = 0;
    calls.length = 0;
    delete fs.hooks.sync;
    delete fs.hooks.read;
    failAfterWrite = false;
    fs.add(parent, "directory");
    fs.add(envFile, "file", before);
    fs.add(secretDirectory, "directory", "", { mode: 0o710 });
    fs.add(secretFile, "file", `${secret}\r\n`);
    fs.add("/var/run/docker.sock", "file", "", { isSocket: () => true, mode: 0o660 });
    fs.add(
      stateFile,
      "file",
      JSON.stringify({
        schemaVersion: 1,
        inProgress: null,
        release: {
          deploymentId: priorId,
          sha: oldSha,
          imageId: oldImage,
          deployedAt: "2026-01-01T00:00:00.000Z",
          evidence: "synthetic fixture",
        },
      }),
    );
    runtime = {
      sha: oldSha,
      image: oldImage,
      sf: hashes(salesforceEnvironmentValues(before)),
      qlik: hashes(qlikEnvironmentValues(before)),
    };
  }
  const execMock = () => {
    throw new Error("Only isolated promisified calls are allowed");
  };
  execMock[promisify.custom] = async (command, args) => {
    calls.push([command, args]);
    if (command === "git") {
      if (args[0] === "rev-parse") return { stdout: newSha };
      if (failAfterWrite && fs.entries.get(envFile).data.toString() === after) {
        failAfterWrite = false;
        throw new Error("Synthetic postcondition failure");
      }
      return { stdout: "" };
    }
    assert.equal(command, "/usr/bin/docker");
    if (args.includes("image"))
      return {
        stdout: args.at(-1).endsWith(newSha) ? `${newImage}\t${newSha}` : `${oldImage}\t${oldSha}`,
      };
    if (args[0] === "ps") return { stdout: "f".repeat(64) };
    if (args[0] === "container") return { stdout: `${runtime.image}\t${runtime.sha}\ttrue` };
    assert.equal(args[0], "exec");
    assert.ok([salesforceContainerDigestScript, qlikContainerDigestScript].includes(args.at(-1)));
    return {
      stdout: JSON.stringify(args.at(-1) === qlikContainerDigestScript ? runtime.qlik : runtime.sf),
    };
  };
  const originalExec = childProcess.execFile;
  childProcess.execFile = execMock;
  const spawn = t.mock.method(childProcess, "spawn", (command) => {
    assert.equal(command, "/usr/bin/flock");
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ status: "ok", version: runtime.sha }),
  }));
  const delay = t.mock.method(timers, "setTimeout", async () => {});
  const uid = Object.getOwnPropertyDescriptor(process, "getuid");
  Object.defineProperty(process, "getuid", { configurable: true, value: () => 0 });
  syncBuiltinESMExports();
  t.after(() => {
    childProcess.execFile = originalExec;
    spawn.mock.restore();
    delay.mock.restore();
    if (uid) Object.defineProperty(process, "getuid", uid);
    else delete process.getuid;
    syncBuiltinESMExports();
  });
  const { productionHost } = await import("./production-release-host.mjs");
  const prepare = {
    operation: "deploy",
    qlikRanking: true,
    expectedDeploymentId: priorId,
    expectedSha: oldSha,
    targetSha: newSha,
  };
  const binding = {
    expectedCurrentSha: oldSha,
    targetSha: newSha,
    expectedImageId: newImage,
    boundarySha: newSha,
    environmentChange: change,
  };
  const withHost = async (action) => {
    reset();
    await withFileLock(productionLockPath, (lock) => action(productionHost(lock)));
    assert.equal(
      calls.some(([, args]) => args.includes("compose")),
      false,
    );
    assert.equal(JSON.stringify(calls).includes(secret), false);
    assert.equal(JSON.stringify(calls).includes(sfSecret), false);
  };

  await t.test(
    "prepares durable v2 receipt and restores exact legacy environment without source credentials",
    () =>
      withHost(async (host) => {
        assert.deepEqual(await host.prepareEnvironmentChange(prepare, backupId), change);
        const backup = JSON.parse(fs.entries.get(backupFile).data.toString());
        assert.deepEqual(backup, {
          schemaVersion: 2,
          kind: "qlik-ranking-v2",
          ...change,
          before,
          after,
        });
        assert.equal(fs.entries.get(backupDirectory).metadata.mode, 0o700);
        assert.equal(fs.entries.get(backupFile).metadata.mode, 0o600);
        const writeIndex = fs.events.findIndex(
          ([event, target]) => event === "write" && target === backupFile,
        );
        const syncIndex = fs.events.findIndex(
          ([event, target]) => event === "sync" && target === backupFile,
        );
        const dirSyncIndex = fs.events.findIndex(
          ([event, target]) => event === "sync" && target === backupDirectory,
        );
        assert.ok(writeIndex >= 0 && syncIndex > writeIndex && dirSyncIndex > syncIndex);
        assert.equal(fs.entries.get(envFile).data.toString(), before);
        let callbacks = 0;
        await host.bind(binding, async () => {
          callbacks++;
        });
        assert.equal(callbacks, 1);
        assert.equal(fs.entries.get(envFile).data.toString(), after);
        assert.deepEqual(salesforceEnvironmentValues(after), salesforceEnvironmentValues(before));
        runtime = {
          sha: newSha,
          image: newImage,
          sf: hashes(salesforceEnvironmentValues(after)),
          qlik: hashes(qlikEnvironmentValues(after)),
        };
        await host.verify(newSha, newImage, { change, restore: false });
        fs.entries.delete(secretFile);
        const restore = {
          ...binding,
          expectedCurrentSha: newSha,
          targetSha: oldSha,
          expectedImageId: oldImage,
          restoreEnvironment: true,
        };
        await host.bind(restore, async () => {});
        await host.bind({ ...restore, expectedCurrentSha: oldSha }, async () => {});
        assert.equal(fs.entries.get(envFile).data.toString(), before);
        runtime = {
          sha: oldSha,
          image: oldImage,
          sf: hashes(salesforceEnvironmentValues(before)),
          qlik: hashes(qlikEnvironmentValues(before)),
        };
        await host.verify(oldSha, oldImage, { change, restore: true });
      }),
  );

  await t.test("refuses preparation without its live lock", () =>
    withHost(async () => {
      await assert.rejects(
        productionHost({}).prepareEnvironmentChange(prepare, backupId),
        /live release lock/u,
      );
      assert.equal(fs.entries.has(backupFile), false);
    }),
  );

  await t.test("requires explicit Qlik deploy and the unchanged previous receipt", () =>
    withHost(async (host) => {
      for (const patch of [
        { operation: "rollback" },
        { qlikRanking: false },
        { salesforceIngestion: true },
        { expectedDeploymentId: backupId },
        { expectedSha: newSha },
      ]) {
        await assert.rejects(host.prepareEnvironmentChange({ ...prepare, ...patch }, backupId));
        assert.equal(fs.entries.has(backupFile), false);
      }
    }),
  );

  for (const [component, key] of [
    ["sf", "SUPABASE_SECRET_KEY"],
    ["sf", "SALESFORCE_INGEST_SECRET"],
    ["sf", "SALESFORCE_INGEST_ENABLED"],
    ["sf", "SALESFORCE_REFRESH_ENABLED"],
    ["qlik", "QLIK_RANKING_V2_ENABLED"],
    ["qlik", "QLIK_RANKING_V2_HMAC_SECRET"],
  ]) {
    await t.test(`rejects ${key} runtime drift before backup and after binding`, () =>
      withHost(async (host) => {
        const original = runtime[component];
        runtime[component] = { ...original, [key]: "0".repeat(64) };
        await assert.rejects(host.prepareEnvironmentChange(prepare, backupId), /Effective/u);
        assert.equal(fs.entries.has(backupFile), false);
        runtime[component] = original;
        await host.prepareEnvironmentChange(prepare, backupId);
        await host.bind(binding, async () => {});
        runtime = {
          sha: newSha,
          image: newImage,
          sf: hashes(salesforceEnvironmentValues(after)),
          qlik: hashes(qlikEnvironmentValues(after)),
        };
        runtime[component][key] = "0".repeat(64);
        await assert.rejects(
          host.verify(newSha, newImage, { change, restore: false }),
          /recovery is required/u,
        );
      }),
    );
  }

  await t.test("backup create is exclusive and corrupted hashes prevent any bind", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      const saved = Buffer.from(fs.entries.get(backupFile).data);
      await assert.rejects(host.prepareEnvironmentChange(prepare, backupId), { code: "EEXIST" });
      assert.deepEqual(fs.entries.get(backupFile).data, saved);
      const backup = JSON.parse(saved);
      backup.after += "UNRELATED=true\n";
      fs.entries.get(backupFile).data = Buffer.from(JSON.stringify(backup) + "\n");
      await assert.rejects(
        host.bind(binding, async () => assert.fail("Must not reach write callback")),
        /digests/u,
      );
      assert.equal(fs.entries.get(envFile).data.toString(), before);
    }),
  );

  await t.test("v2 backup read rejects permissive modes, owners, links and path aliases", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      const store = salesforceEnvironmentBackupStore();
      for (const [target, patch] of [
        [backupFile, { mode: 0o640 }],
        [backupFile, { uid: 1 }],
        [backupFile, { nlink: 2 }],
        [backupFile, { isSymbolicLink: () => true }],
        [backupDirectory, { mode: 0o710 }],
        [backupDirectory, { gid: 1 }],
      ]) {
        const metadata = fs.entries.get(target).metadata;
        fs.entries.get(target).metadata = { ...metadata, ...patch };
        await assert.rejects(store.read(change));
        fs.entries.get(target).metadata = metadata;
      }
      fs.entries.get(backupDirectory).alias = "/synthetic-elsewhere";
      await assert.rejects(store.read(change));
    }),
  );

  for (const target of [envFile, stateFile]) {
    await t.test(`detects concurrent ${path.basename(target)} change while persisting backup`, () =>
      withHost(async (host) => {
        fs.hooks.sync = async (file) => {
          if (file !== backupFile) return;
          if (target === envFile)
            fs.entries.get(target).data = Buffer.from(before + "EXTERNAL=1\n");
          else {
            const ledger = JSON.parse(fs.entries.get(target).data);
            ledger.release.evidence = "concurrent fixture";
            fs.entries.get(target).data = Buffer.from(JSON.stringify(ledger));
          }
        };
        await assert.rejects(
          host.prepareEnvironmentChange(prepare, backupId),
          /changed while preparing/u,
        );
        assert.equal(
          fs.events.some(([event]) => event === "rename"),
          false,
        );
      }),
    );
  }

  await t.test("full CAS refuses callback edits and does not undo unrelated bytes", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      const external = before + "EXTERNAL=changed\n";
      await assert.rejects(
        host.bind(binding, async () => {
          fs.entries.get(envFile).data = Buffer.from(external);
        }),
        /changed/u,
      );
      assert.equal(fs.entries.get(envFile).data.toString(), external);
      assert.equal(
        fs.events.some(([event]) => event === "rename"),
        false,
      );
    }),
  );

  await t.test("restore refuses unrelated current bytes instead of overwriting them", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      await host.bind(binding, async () => {});
      const external = after + "EXTERNAL=changed\n";
      fs.entries.get(envFile).data = Buffer.from(external);
      await assert.rejects(
        host.bind(
          {
            ...binding,
            expectedCurrentSha: newSha,
            targetSha: oldSha,
            expectedImageId: oldImage,
            restoreEnvironment: true,
          },
          async () => assert.fail("No restore write authorized"),
        ),
        /compare-and-swap/u,
      );
      assert.equal(fs.entries.get(envFile).data.toString(), external);
    }),
  );

  await t.test("failed bind postcondition restores exact pre-Qlik bytes", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      failAfterWrite = true;
      await assert.rejects(
        host.bind(binding, async () => {}),
        /worktree status/u,
      );
      assert.equal(fs.entries.get(envFile).data.toString(), before);
      assert.equal(
        fs.events.filter(([event, target]) => event === "rename" && target === envFile).length,
        2,
      );
    }),
  );

  await t.test("private Qlik secret validates modes, ownership, links and bounded UTF-8", () =>
    withHost(async () => {
      assert.equal(await readQlikReleaseSecret(), secret);
      for (const patch of [
        { mode: 0o640 },
        { mode: 0o4600 },
        { uid: 1 },
        { gid: 1 },
        { nlink: 2 },
        { isSymbolicLink: () => true },
      ]) {
        const metadata = fs.entries.get(secretFile).metadata;
        fs.entries.get(secretFile).metadata = { ...metadata, ...patch };
        await assert.rejects(readQlikReleaseSecret());
        fs.entries.get(secretFile).metadata = metadata;
      }
      for (const value of [secret + "\n\n", "short", "q".repeat(131), Buffer.from([0xff])]) {
        fs.entries.get(secretFile).data = Buffer.from(value);
        await assert.rejects(readQlikReleaseSecret(), (error) => !error.message.includes(secret));
      }
    }),
  );

  await t.test("private secret inode replacement during read is rejected", () =>
    withHost(async () => {
      fs.hooks.read = async (file) => {
        if (file === secretFile) fs.add(secretFile, "file", secret);
      };
      await assert.rejects(readQlikReleaseSecret(), /changed while reading/u);
    }),
  );

  await t.test("legacy Salesforce v1 backup still restores without changing Qlik keys", () =>
    withHost(async () => {
      const sfBefore = `${before}QLIK_RANKING_V2_ENABLED=true\nQLIK_RANKING_V2_HMAC_SECRET=${secret}\n`;
      const sfAfter = transformSalesforceReleaseEnvironment(sfBefore, oldSha, newSha, {
        SUPABASE_SECRET_KEY: supabaseSecret,
        SALESFORCE_INGEST_SECRET: sfSecret,
      });
      const store = salesforceEnvironmentBackupStore();
      const descriptor = await store.create(sfBackupId, sfBefore, sfAfter);
      const backup = await store.read(descriptor);
      assert.equal(backup.schemaVersion, 1);
      assert.equal(Object.hasOwn(backup, "kind"), false);
      assert.deepEqual(qlikEnvironmentValues(sfAfter), qlikEnvironmentValues(sfBefore));
      fs.entries.delete(secretFile);
      assert.equal(
        selectEnvironmentChange(sfAfter, backup, descriptor, {
          expectedCurrentSha: newSha,
          targetSha: oldSha,
          restoreEnvironment: true,
        }),
        sfBefore,
      );
    }),
  );
});

test(
  "Qlik v2 physical backup uses private modes, exclusive creation and rejects hardlinks",
  {
    skip: process.platform !== "linux" ? "Physical POSIX permissions require Linux CI." : false,
  },
  async (t) => {
    const directory = await filesystem.realpath(
      await filesystem.mkdtemp(path.join(os.tmpdir(), "qlik-app-env-")),
    );
    await filesystem.chmod(directory, 0o700);
    t.after(() => filesystem.rm(directory, { recursive: true, force: true }));
    const store = salesforceEnvironmentBackupStore(
      path.join(directory, "backups"),
      process.getuid(),
    );
    assert.deepEqual(await store.create(backupId, before, after, "qlik-ranking-v2"), change);
    const file = path.join(directory, "backups", `${backupId}.json`);
    assert.equal((await filesystem.stat(file)).mode & 0o7777, 0o600);
    assert.equal((await filesystem.stat(path.dirname(file))).mode & 0o7777, 0o700);
    assert.equal((await store.read(change)).kind, "qlik-ranking-v2");
    await assert.rejects(store.create(backupId, before, after, "qlik-ranking-v2"), {
      code: "EEXIST",
    });
    await filesystem.link(file, path.join(directory, "alias"));
    await assert.rejects(store.read(change), /single link/u);
  },
);
