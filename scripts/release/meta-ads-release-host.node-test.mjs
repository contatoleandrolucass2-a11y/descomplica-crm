import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import timers from "node:timers/promises";
import { promisify } from "node:util";
import { memoryFilesystem } from "./fixtures/private-release-filesystem.mjs";
import { productionLockPath, withFileLock } from "./production-release-lock.mjs";
import { recoverRelease } from "./production-release-recovery.mjs";
import {
  environmentSha256,
  metaAdsContainerDigestScript,
  metaAdsEnvironmentValues,
  readMetaAdsReleaseSecrets,
  salesforceContainerDigestScript,
  salesforceEnvironmentBackupStore,
  salesforceEnvironmentValues,
  transformMetaAdsReleaseEnvironment,
} from "./salesforce-release-environment.mjs";

const oldSha = "a".repeat(40);
const newSha = "b".repeat(40);
const oldImage = `sha256:${"1".repeat(64)}`;
const newImage = `sha256:${"2".repeat(64)}`;
const priorId = "aaaaaaaa-2222-4333-8444-555555555555";
const backupId = "bbbbbbbb-2222-4333-8444-555555555555";
const parent = "/etc/descomplica-crm";
const envFile = `${parent}/production.env`;
const stateFile = `${parent}/production-release.json`;
const secretDirectory = `${parent}/secrets`;
const secretFiles = [
  `${secretDirectory}/meta-ads-status-bearer`,
  `${secretDirectory}/meta-ads-console-password`,
];
const backupFile = `${parent}/config-backups/${backupId}.json`;
const secrets = { META_ADS_STATUS_SECRET: "a1".repeat(48), META_ADS_CONSOLE_PASSWORD: "aB+/19zZ" };
const before = `IMAGE_TAG=${oldSha}\nSUPABASE_SECRET_KEY=sb_secret_${"fixture".repeat(5)}\nSALESFORCE_INGEST_SECRET=${"s".repeat(48)}\nSALESFORCE_INGEST_ENABLED=true\nSALESFORCE_REFRESH_ENABLED=false\nSALESFORCE_STATUS_SECRET=${"t".repeat(48)}\nSALESFORCE_CONSOLE_PASSWORD=otherVnc\nOTHER="keep $VALUE"\n`;
const after = transformMetaAdsReleaseEnvironment(before, oldSha, newSha, secrets);
const change = {
  backupId,
  beforeSha256: environmentSha256(before),
  afterSha256: environmentSha256(after),
};
const hashes = (values) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, environmentSha256(value)]));

test("Meta Ads host uses private backups, protected full CAS and credential-independent recovery", async (t) => {
  const fs = memoryFilesystem(t);
  const calls = [];
  let runtime;
  const setRuntime = (contents, sha, image) => {
    runtime = {
      sha,
      image,
      sf: hashes(salesforceEnvironmentValues(contents)),
      meta: hashes(metaAdsEnvironmentValues(contents)),
    };
  };
  const reset = () => {
    fs.entries.clear();
    fs.events.length = 0;
    calls.length = 0;
    delete fs.hooks.read;
    delete fs.hooks.sync;
    fs.add(parent, "directory");
    fs.add(envFile, "file", before);
    fs.add(secretDirectory, "directory", "", { mode: 0o710 });
    fs.add(secretFiles[0], "file", secrets.META_ADS_STATUS_SECRET + "\n");
    fs.add(secretFiles[1], "file", secrets.META_ADS_CONSOLE_PASSWORD + "\r\n");
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
    setRuntime(before, oldSha, oldImage);
  };
  const execMock = () => {
    throw new Error("Only isolated execution is allowed");
  };
  execMock[promisify.custom] = async (command, args) => {
    calls.push([command, args]);
    if (command === "git") return { stdout: args[0] === "rev-parse" ? newSha : "" };
    assert.equal(command, "/usr/bin/docker");
    if (args.includes("image"))
      return {
        stdout: args.at(-1).endsWith(newSha) ? `${newImage}\t${newSha}` : `${oldImage}\t${oldSha}`,
      };
    if (args[0] === "ps") return { stdout: "f".repeat(64) };
    if (args[0] === "container") return { stdout: `${runtime.image}\t${runtime.sha}\ttrue` };
    assert.equal(args[0], "exec");
    assert.ok(
      [salesforceContainerDigestScript, metaAdsContainerDigestScript].includes(args.at(-1)),
    );
    return {
      stdout: JSON.stringify(
        args.at(-1) === metaAdsContainerDigestScript ? runtime.meta : runtime.sf,
      ),
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
    metaAds: true,
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
    for (const secret of Object.values(secrets))
      assert.equal(JSON.stringify(calls).includes(secret), false);
  };

  await t.test("prepares a durable schemaVersion2 receipt and verifies actual runtime values", () =>
    withHost(async (host) => {
      assert.deepEqual(await host.prepareEnvironmentChange(prepare, backupId), change);
      const backup = JSON.parse(fs.entries.get(backupFile).data);
      assert.deepEqual(backup, {
        schemaVersion: 2,
        kind: "meta-ads-session",
        ...change,
        before,
        after,
      });
      assert.equal(fs.entries.get(backupFile).metadata.mode, 0o600);
      assert.equal(fs.entries.get(`${parent}/config-backups`).metadata.mode, 0o700);
      const writeIndex = fs.events.findIndex(
        ([event, file]) => event === "write" && file === backupFile,
      );
      const syncIndex = fs.events.findIndex(
        ([event, file]) => event === "sync" && file === backupFile,
      );
      const directorySync = fs.events.findIndex(
        ([event, file]) => event === "sync" && file === `${parent}/config-backups`,
      );
      assert.ok(writeIndex >= 0 && syncIndex > writeIndex && directorySync > syncIndex);
      assert.equal(fs.entries.get(envFile).data.toString(), before);
      await host.bind(binding, async () => {});
      assert.equal(fs.entries.get(envFile).data.toString(), after);
      assert.deepEqual(salesforceEnvironmentValues(before), salesforceEnvironmentValues(after));
      setRuntime(after, newSha, newImage);
      await host.verify(newSha, newImage, { change, restore: false });
    }),
  );

  await t.test("recovers exact pending release after both source secrets are deleted", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      await host.bind(binding, async () => {});
      setRuntime(after, newSha, newImage);
      for (const file of secretFiles) fs.entries.delete(file);
      const state = JSON.parse(fs.entries.get(stateFile).data);
      state.inProgress = {
        deploymentId: backupId,
        expectedDeploymentId: priorId,
        expectedSha: oldSha,
        targetSha: newSha,
        targetImageId: newImage,
        startedAt: new Date(Date.now() - 1000).toISOString(),
        operation: "deploy",
        environmentChange: change,
      };
      fs.entries.get(stateFile).data = Buffer.from(JSON.stringify(state));
      const result = await recoverRelease(backupId, {
        ...host,
        prepare: async (options) => {
          assert.equal(options.operation, "rollback");
          assert.equal(
            (await salesforceEnvironmentBackupStore().read(change)).kind,
            "meta-ads-session",
          );
        },
        up: async (pending, target, beforeStart) => {
          assert.equal(pending.deploymentId, backupId);
          assert.equal(target, oldSha);
          await beforeStart();
          setRuntime(fs.entries.get(envFile).data.toString(), oldSha, oldImage);
        },
      });
      assert.equal(result.status, "recovered");
      assert.equal(result.release.sha, oldSha);
      assert.equal(fs.entries.get(envFile).data.toString(), before);
      assert.equal((await host.readState()).inProgress, null);
      assert.equal(
        fs.events.some(
          ([event, file]) => event === "open" && file.endsWith("salesforce-crm-ingest-bearer"),
        ),
        false,
      );
    }),
  );

  await t.test("requires a held lock and a single explicit configuration request", () =>
    withHost(async (host) => {
      await assert.rejects(
        productionHost({}).prepareEnvironmentChange(prepare, backupId),
        /live release lock/u,
      );
      for (const patch of [
        { metaAds: false },
        { metaAds: "enable" },
        { salesforceIngestion: true },
        { qlikRanking: true },
        { operation: "rollback" },
        { expectedDeploymentId: backupId },
      ])
        await assert.rejects(host.prepareEnvironmentChange({ ...prepare, ...patch }, backupId));
      assert.equal(fs.entries.has(backupFile), false);
    }),
  );

  for (const [component, key] of [
    ["sf", "SALESFORCE_INGEST_SECRET"],
    ...Object.keys(metaAdsEnvironmentValues(before)).map((key) => ["meta", key]),
  ])
    await t.test(`rejects ${key} runtime drift before preparation and after binding`, () =>
      withHost(async (host) => {
        const original = runtime[component][key];
        runtime[component][key] = "0".repeat(64);
        await assert.rejects(host.prepareEnvironmentChange(prepare, backupId), /Effective/u);
        assert.equal(fs.entries.has(backupFile), false);
        runtime[component][key] = original;
        await host.prepareEnvironmentChange(prepare, backupId);
        await host.bind(binding, async () => {});
        setRuntime(after, newSha, newImage);
        runtime[component][key] = "0".repeat(64);
        await assert.rejects(
          host.verify(newSha, newImage, { change, restore: false }),
          /recovery is required/u,
        );
      }),
    );

  await t.test("full CAS preserves unrelated concurrent changes during bind and rollback", () =>
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
      const changedAfter = after + "EXTERNAL=changed\n";
      fs.entries.get(envFile).data = Buffer.from(changedAfter);
      await assert.rejects(
        host.bind(
          {
            ...binding,
            expectedCurrentSha: newSha,
            targetSha: oldSha,
            expectedImageId: oldImage,
            restoreEnvironment: true,
          },
          async () => assert.fail("Unrelated contents cannot be restored"),
        ),
        /compare-and-swap/u,
      );
      assert.equal(fs.entries.get(envFile).data.toString(), changedAfter);
    }),
  );

  await t.test("refuses corrupted receipts and concurrent preparation changes", () =>
    withHost(async (host) => {
      await host.prepareEnvironmentChange(prepare, backupId);
      const saved = Buffer.from(fs.entries.get(backupFile).data);
      await assert.rejects(host.prepareEnvironmentChange(prepare, backupId), { code: "EEXIST" });
      assert.deepEqual(fs.entries.get(backupFile).data, saved);
      const corrupted = JSON.parse(saved);
      corrupted.after += "OTHER_CHANGE=1\n";
      fs.entries.get(backupFile).data = Buffer.from(JSON.stringify(corrupted) + "\n");
      await assert.rejects(
        host.bind(binding, async () => assert.fail("Corrupt backup cannot bind")),
        /digests/u,
      );
      fs.entries.delete(backupFile);
      fs.hooks.sync = async (file) => {
        if (file === backupFile)
          fs.entries.get(envFile).data = Buffer.from(before + "EXTERNAL=1\n");
      };
      await assert.rejects(
        host.prepareEnvironmentChange(prepare, backupId),
        /changed while preparing/u,
      );
    }),
  );

  await t.test(
    "private Meta secrets reject unsafe metadata, malformed bytes and changing inodes",
    () =>
      withHost(async () => {
        assert.deepEqual(await readMetaAdsReleaseSecrets(), secrets);
        for (const file of secretFiles) {
          const entry = fs.entries.get(file);
          for (const patch of [
            { mode: 0o640 },
            { mode: 0o4600 },
            { uid: 1 },
            { gid: 1 },
            { nlink: 2 },
            { isSymbolicLink: () => true },
          ]) {
            const original = entry.metadata;
            entry.metadata = { ...original, ...patch };
            await assert.rejects(readMetaAdsReleaseSecrets());
            entry.metadata = original;
          }
          const original = entry.data;
          for (const value of [
            "short",
            original.toString() + "\n",
            "x".repeat(259),
            Buffer.from([0xff]),
          ]) {
            entry.data = Buffer.from(value);
            await assert.rejects(
              readMetaAdsReleaseSecrets(),
              (error) => !Object.values(secrets).some((value) => error.message.includes(value)),
            );
          }
          entry.data = original;
        }
        fs.hooks.read = async (file) => {
          if (file === secretFiles[0]) fs.add(file, "file", secrets.META_ADS_STATUS_SECRET);
        };
        await assert.rejects(readMetaAdsReleaseSecrets(), /changed while reading/u);
      }),
  );
});
