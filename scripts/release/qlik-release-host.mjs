import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  readlink,
  realpath,
  rename,
  statfs,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { isRankingFailureCode } from "../../ops/qlik/ranking-artifact.mjs";
import { assertHeldLock, inheritedLockDescriptors } from "./production-release-lock.mjs";
import { privateJsonStore } from "./private-json-store.mjs";
import { verifyPromotableImage, verifyReleaseBoundary } from "./bind-production-image.mjs";
import { productionHost } from "./production-release-host.mjs";
import { validateQlikState } from "./qlik-release-engine.mjs";
import {
  assertProtectedParents,
  assertQlikDependencies,
  idPattern,
  inspectQlikCredential,
  parseQlikUnit,
  qlikReleaseFiles,
  readProtectedText,
  renderQlikUnit,
  sha256,
} from "./qlik-release-inputs.mjs";

const root = path.resolve(import.meta.dirname, "../..");

export function assertRankingFailureResult(result) {
  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    !["running", "reauth_required", "unavailable"].includes(result.state) ||
    !Object.hasOwn(result, "state") ||
    (Object.keys(result).length !== 1 &&
      !(
        Object.keys(result).length === 2 &&
        Object.hasOwn(result, "code") &&
        result.state !== "running" &&
        isRankingFailureCode(result.code)
      ))
  )
    throw new Error("Invalid Qlik ranking result.");
}
const unit = "descomplica-qlik-browser.service";
const unitPath = `/etc/systemd/system/${unit}`;
const bootLink = `/etc/systemd/system/multi-user.target.wants/${unit}`;
const backupRoot = "/etc/descomplica-crm/qlik-backups";
const profile = "/var/lib/descomplica-qlik/chrome";
const ledgerPath = "/etc/descomplica-crm/qlik-release.json";
const environment = Object.freeze({
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TZ: "UTC",
  GIT_CONFIG_NOSYSTEM: "1",
});

async function syncDirectory(directory) {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function exclusiveText(file, value, mode = 0o600) {
  const handle = await open(
    file,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    mode,
  );
  try {
    await handle.chmod(mode);
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(path.dirname(file));
}

async function privateDirectory(directory) {
  try {
    await mkdir(directory, { mode: 0o700 });
    await syncDirectory(path.dirname(directory));
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  await assertProtectedParents(directory);
  if (((await lstat(directory)).mode & 0o777) !== 0o700)
    throw new Error("Private backup directory required.");
}

export function qlikReleaseHost(lock) {
  const store = privateJsonStore(ledgerPath, (state) => validateQlikState(state, Date.now()));
  let template;
  let identity;
  const startedAt = new Map();
  async function command(
    executable,
    args,
    { timeout = 30000, codes = [0], maximum = 262144, beforeSpawn } = {},
  ) {
    await assertHeldLock(lock);
    const finalCheck = beforeSpawn ? await beforeSpawn() : undefined;
    if (beforeSpawn && typeof finalCheck !== "function")
      throw new Error("Fresh start guard required.");
    if (finalCheck) finalCheck();
    const result = await new Promise((resolve, reject) => {
      let output = "";
      let failed = false;
      const child = spawn(executable, args, {
        cwd: root,
        env: environment,
        stdio: ["ignore", "pipe", "ignore", ...inheritedLockDescriptors(lock)],
      });
      const timer = setTimeout(() => {
        failed = true;
        child.kill("SIGKILL");
      }, timeout);
      child.stdout.on("data", (part) => {
        output += part.toString("utf8");
        if (Buffer.byteLength(output) > maximum) {
          failed = true;
          child.kill("SIGKILL");
        }
      });
      child.once("error", () => {
        clearTimeout(timer);
        reject(new Error("Qlik host command unavailable."));
      });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        if (failed || signal || !codes.includes(code))
          reject(new Error("Qlik host command failed."));
        else resolve({ code, stdout: output });
      });
    });
    await assertHeldLock(lock);
    return result;
  }
  async function getTemplate() {
    if (!template) {
      await assertProtectedParents(root);
      template = await readProtectedText(path.join(root, "ops/qlik/vps", unit));
    }
    return template;
  }
  async function getIdentity() {
    if (!identity) {
      const { stdout } = await command("/usr/bin/id", ["-u", "descomplica-qlik"]);
      const uid = Number(stdout.trim());
      if (!Number.isSafeInteger(uid) || uid <= 0)
        throw new Error("Dedicated Qlik identity required.");
      const info = await lstat(profile);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        info.uid !== uid ||
        (info.mode & 0o777) !== 0o700 ||
        (await realpath(profile)) !== profile
      )
        throw new Error("Dedicated Qlik profile required.");
      identity = uid;
    }
    return identity;
  }
  async function properties(name) {
    const { stdout } = await command("/usr/bin/systemctl", [
      "show",
      name,
      "--property=ActiveState,SubState,MainPID,WorkingDirectory,UnitFileState,DropInPaths,FragmentPath,NeedDaemonReload,User,Group",
    ]);
    return Object.fromEntries(
      stdout
        .trim()
        .split("\n")
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  }
  async function assertBootState(enabled) {
    await assertProtectedParents(path.dirname(unitPath));
    try {
      await lstat(path.dirname(bootLink));
    } catch (error) {
      if (error.code === "ENOENT" && !enabled) return;
      throw error;
    }
    await assertProtectedParents(path.dirname(bootLink));
    let info;
    try {
      info = await lstat(bootLink);
    } catch (error) {
      if (error.code === "ENOENT" && !enabled) return;
      throw error;
    }
    if (
      !enabled ||
      !info.isSymbolicLink() ||
      info.uid !== 0 ||
      info.gid !== 0 ||
      path.resolve(path.dirname(bootLink), await readlink(bootLink)) !== unitPath ||
      (await realpath(bootLink)) !== unitPath
    )
      throw new Error("Qlik boot link differs from the fixed unit.");
  }
  async function inspectOwner() {
    await assertHeldLock(lock);
    await getIdentity();
    await assertProtectedParents(path.dirname(unitPath));
    const contents = await readProtectedText(unitPath, { mode: 0o644 });
    const info = parseQlikUnit(contents, await getTemplate());
    const effective = await properties(unit);
    const deferredReload =
      effective.NeedDaemonReload === "yes" &&
      ["inactive", "failed"].includes(effective.ActiveState) &&
      effective.MainPID === "0" &&
      (await store.read()).inProgress !== null;
    if (
      effective.DropInPaths !== "" ||
      effective.FragmentPath !== unitPath ||
      (effective.NeedDaemonReload !== "no" && !deferredReload) ||
      effective.User !== "descomplica-qlik" ||
      effective.Group !== "descomplica-qlik" ||
      (!deferredReload &&
        effective.WorkingDirectory !== `/srv/descomplica-crm-releases/${info.sha}`) ||
      !["enabled", "disabled"].includes(effective.UnitFileState) ||
      !["active", "inactive", "failed"].includes(effective.ActiveState) ||
      (effective.ActiveState === "active" &&
        (effective.SubState !== "running" || !/^[1-9][0-9]*$/u.test(effective.MainPID)))
    )
      throw new Error("Qlik effective service differs from its approved unit.");
    if (info.ranking) await assertBootState(effective.UnitFileState === "enabled");
    return {
      ...info,
      enabled: effective.UnitFileState === "enabled",
      active: effective.ActiveState === "active",
    };
  }
  function backupDirectory(transaction) {
    const id = transaction.backup?.id;
    if (!idPattern.test(id ?? "") || id !== transaction.deploymentId)
      throw new Error("Qlik backup identity rejected.");
    return path.join(backupRoot, id);
  }
  async function pending(transaction) {
    await assertHeldLock(lock);
    if (!isDeepStrictEqual((await store.read()).inProgress, transaction))
      throw new Error("Qlik pending release changed.");
  }
  async function backup(transaction) {
    await pending(transaction);
    if (root !== `/srv/descomplica-crm-releases/${transaction.targetSha}`)
      throw new Error("Recovery requires the exact pending release checkout.");
    await verifyReleaseBoundary(transaction.targetSha);
    const directory = backupDirectory(transaction);
    await assertProtectedParents(directory);
    const value = JSON.parse(
      await readProtectedText(path.join(directory, "unit.json"), { mode: 0o600, maximum: 16384 }),
    );
    const before = parseQlikUnit(value.before, await getTemplate());
    const after = parseQlikUnit(value.after, await getTemplate());
    const expected = transaction.backup;
    if (
      value.id !== transaction.deploymentId ||
      before.sha !== expected.previousSha ||
      after.sha !== expected.targetSha ||
      before.unitHash !== expected.previousUnitHash ||
      after.unitHash !== expected.targetUnitHash ||
      (transaction.ranking ? !after.ranking : !after.preflight) ||
      value.enabled !== transaction.previousOwner.enabled
    )
      throw new Error("Qlik unit backup does not match the pending release.");
    const expectedKeys = [
      "id",
      "before",
      "after",
      "enabled",
      ...(transaction.ranking ? ["credential"] : []),
    ];
    if (
      Object.keys(value).length !== expectedKeys.length ||
      expectedKeys.some((key) => !Object.hasOwn(value, key))
    )
      throw new Error("Qlik unit backup has unexpected fields.");
    return value;
  }
  async function credentialMatches(value) {
    if (!isDeepStrictEqual(await inspectQlikCredential(), value.credential))
      throw new Error("Qlik credential changed during release.");
  }
  async function rankingArtifact(transaction) {
    const directory = "/run/descomplica-qlik";
    const info = await lstat(directory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== (await getIdentity()) ||
      (info.mode & 0o777) !== 0o700 ||
      (await realpath(directory)) !== directory
    )
      throw new Error("Private Qlik ranking runtime required.");
    const artifact = JSON.parse(
      await readProtectedText(`${directory}/ranking-status.json`, {
        uid: await getIdentity(),
        mode: 0o600,
        maximum: 131072,
      }),
    );
    const observed = Date.parse(artifact.observedAt);
    const state = artifact.result?.state;
    const exactKeys = (value, keys) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key));
    if (
      artifact.schemaVersion !== 1 ||
      artifact.kind !== "qlik_ranking_cycle" ||
      !exactKeys(artifact, ["schemaVersion", "kind", "observedAt", "rankingConnected", "result"]) ||
      typeof artifact.observedAt !== "string" ||
      !Number.isFinite(observed) ||
      new Date(observed).toISOString() !== artifact.observedAt ||
      !(observed >= startedAt.get(transaction.deploymentId)) ||
      observed > Date.now() ||
      !["running", "succeeded", "reauth_required", "unavailable"].includes(state) ||
      typeof artifact.rankingConnected !== "boolean" ||
      artifact.rankingConnected !== (state === "succeeded")
    )
      throw new Error("Fresh Qlik ranking observation required.");
    if (state === "succeeded") {
      const receipt = artifact.result;
      const completed = Date.parse(receipt.completedAt);
      if (
        !exactKeys(receipt, ["state", "batchId", "requestId", "contentSha256", "completedAt"]) ||
        typeof receipt.batchId !== "string" ||
        !idPattern.test(receipt.batchId) ||
        typeof receipt.requestId !== "string" ||
        !idPattern.test(receipt.requestId) ||
        receipt.batchId === receipt.requestId ||
        typeof receipt.contentSha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(receipt.contentSha256) ||
        typeof receipt.completedAt !== "string" ||
        !Number.isFinite(completed) ||
        new Date(completed).toISOString() !== receipt.completedAt ||
        !(completed >= startedAt.get(transaction.deploymentId)) ||
        completed > observed
      )
        throw new Error("Fresh Qlik ranking publication receipt required.");
    } else assertRankingFailureResult(artifact.result);
    return {
      preflightStatus: "disabled",
      rankingStatus: state,
      rankingConnected: artifact.rankingConnected,
    };
  }
  async function stopped() {
    for (const name of [unit, "descomplica-qlik-vnc.service", "descomplica-qlik-console.service"]) {
      const state = await properties(name);
      if (!["inactive", "failed"].includes(state.ActiveState) || state.MainPID !== "0")
        throw new Error("Qlik services must be stopped before changing the owner.");
    }
    const result = await command("/usr/bin/pgrep", ["-u", String(await getIdentity())], {
      codes: [0, 1],
    });
    if (result.code !== 1 || result.stdout !== "")
      throw new Error("Qlik processes still own the profile.");
  }
  async function validateProfileRoot() {
    const info = await lstat(profile);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== (await getIdentity()) ||
      (info.mode & 0o777) !== 0o700 ||
      (await realpath(profile)) !== profile
    )
      throw new Error("Dedicated Qlik profile changed.");
  }
  async function archiveDigest(file) {
    const handle = await open(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.uid !== 0 ||
        info.nlink !== 1 ||
        (info.mode & 0o777) !== 0o600 ||
        info.size > 2147483648
      )
        throw new Error("Qlik profile backup rejected.");
      const hash = createHash("sha256");
      for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
      return { bytes: info.size, sha256: hash.digest("hex") };
    } finally {
      await handle.close();
    }
  }
  async function validateProfileBackup(transaction) {
    const directory = backupDirectory(transaction);
    const receipt = JSON.parse(
      await readProtectedText(path.join(directory, "profile.json"), { mode: 0o600 }),
    );
    const actual = await archiveDigest(path.join(directory, "profile.tar"));
    if (
      receipt.id !== transaction.deploymentId ||
      receipt.bytes !== actual.bytes ||
      receipt.sha256 !== actual.sha256
    )
      throw new Error("Qlik profile backup integrity failed.");
  }
  async function replaceUnit(transaction, restore, beforeWrite) {
    const value = await backup(transaction);
    await stopped();
    const current = await readProtectedText(unitPath, { mode: 0o644 });
    const desired = restore ? value.before : value.after;
    if (current !== value.before && current !== value.after)
      throw new Error("Qlik unit compare-and-swap refused.");
    if (!restore) await validateProfileBackup(transaction);
    if (!restore && transaction.ranking) await credentialMatches(value);
    const temporary = `${unitPath}.${transaction.deploymentId}.${randomUUID()}.tmp`;
    await exclusiveText(temporary, desired, 0o644);
    try {
      await pending(transaction);
      if ((await readProtectedText(unitPath, { mode: 0o644 })) !== current)
        throw new Error("Qlik unit changed before swap.");
      const finalCheck = await beforeWrite();
      if (typeof finalCheck !== "function") throw new Error("Fresh unit guard required.");
      await pending(transaction);
      if ((await readProtectedText(unitPath, { mode: 0o644 })) !== current)
        throw new Error("Qlik unit changed during approval.");
      if (!restore && transaction.ranking) await credentialMatches(value);
      await assertHeldLock(lock);
      finalCheck();
      await rename(temporary, unitPath);
      await syncDirectory(path.dirname(unitPath));
      await command("/usr/bin/systemctl", ["daemon-reload"]);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  return {
    now: Date.now,
    id: randomUUID,
    app: productionHost(lock),
    async readState() {
      try {
        return await store.read();
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async writeState(previous, next) {
      await assertHeldLock(lock);
      await store.compareAndWrite(previous, next);
    },
    inspectOwner,
    async prepare(options, owner, deploymentId) {
      await assertHeldLock(lock);
      if (!/^24\.19\./u.test(process.versions.node)) throw new Error("Node 24.19.x required.");
      await verifyReleaseBoundary(options.targetSha);
      if (root !== `/srv/descomplica-crm-releases/${options.targetSha}`)
        throw new Error("Canonical Qlik release required.");
      await assertProtectedParents(root);
      await verifyPromotableImage(options.targetSha, options.targetImageId);
      for (const relative of qlikReleaseFiles) {
        await assertProtectedParents(path.dirname(path.join(root, relative)));
        const contents = await readProtectedText(path.join(root, relative), { maximum: 1048576 });
        const { stdout } = await command(
          "/usr/bin/git",
          ["show", `${options.targetSha}:${relative}`],
          { maximum: 1048576 },
        );
        if (contents !== stdout)
          throw new Error("Qlik release input differs from the approved commit.");
      }
      await assertQlikDependencies(root);
      await command("/usr/sbin/runuser", [
        "-u",
        "descomplica-qlik",
        "--",
        "/usr/bin/env",
        "-i",
        `PATH=${environment.PATH}`,
        "HOME=/var/lib/descomplica-qlik",
        "/usr/local/bin/node",
        "--input-type=module",
        "-e",
        "if(process.getuid()===0||!/^24\\.19\\./.test(process.versions.node))throw new Error();await import('@playwright/test');const {getBrowserMetadataScript}=await import('./ops/qlik/browser-preflight.mjs');await getBrowserMetadataScript();",
      ]);
      if (!idPattern.test(deploymentId)) throw new Error("Qlik deployment identity rejected.");
      if (!isDeepStrictEqual(await inspectOwner(), owner) || !owner.active)
        throw new Error("Qlik owner changed before backup.");
      await privateDirectory(backupRoot);
      const directory = path.join(backupRoot, deploymentId);
      await mkdir(directory, { mode: 0o700 });
      await syncDirectory(backupRoot);
      const before = await readProtectedText(unitPath, { mode: 0o644 });
      const ranking = options.ranking === true || owner.ranking === true;
      const credential = ranking ? await inspectQlikCredential() : undefined;
      if (ranking) await assertBootState(owner.enabled);
      const after = renderQlikUnit(await getTemplate(), options.targetSha, !ranking, ranking);
      await exclusiveText(
        path.join(directory, "unit.json"),
        JSON.stringify({
          id: deploymentId,
          before,
          after,
          enabled: owner.enabled,
          ...(ranking ? { credential } : {}),
        }),
      );
      await exclusiveText(path.join(directory, unit), after, 0o644);
      await command("/usr/bin/systemd-analyze", ["verify", path.join(directory, unit)]);
      return {
        id: deploymentId,
        previousSha: owner.sha,
        targetSha: options.targetSha,
        previousUnitHash: sha256(before),
        targetUnitHash: sha256(after),
      };
    },
    async quiesce(transaction) {
      const value = await backup(transaction);
      const current = await readProtectedText(unitPath, { mode: 0o644 });
      if (current !== value.before && current !== value.after)
        throw new Error("Qlik unit changed before stop.");
      for (const name of ["descomplica-qlik-console.service", "descomplica-qlik-vnc.service"]) {
        const state = await properties(name);
        if (!["inactive", "failed"].includes(state.ActiveState) || state.MainPID !== "0")
          throw new Error("Private console is in use.");
      }
      await command("/usr/bin/systemctl", ["stop", unit], { timeout: 60000 });
      await stopped();
    },
    async backupProfile(transaction) {
      await backup(transaction);
      await stopped();
      await validateProfileRoot();
      const directory = backupDirectory(transaction);
      const pendingPaths = [profile];
      let bytes = 0;
      let count = 0;
      while (pendingPaths.length) {
        if (++count > 100000) throw new Error("Qlik profile entry limit.");
        const file = pendingPaths.pop();
        const info = await lstat(file);
        if (info.uid !== (await getIdentity())) throw new Error("Unexpected profile owner.");
        if (info.isDirectory())
          pendingPaths.push(...(await readdir(file)).map((name) => path.join(file, name)));
        else if (info.isFile()) bytes += info.size;
        else if (!info.isSymbolicLink()) throw new Error("Unexpected profile special file.");
        if (bytes > 1073741824) throw new Error("Qlik profile exceeds backup limit.");
      }
      const disk = await statfs(directory);
      if (disk.bavail * disk.bsize < bytes * 2 + 2147483648)
        throw new Error("Insufficient backup free space.");
      const archive = path.join(directory, "profile.tar");
      await exclusiveText(archive, "");
      await validateProfileRoot();
      await command(
        "/usr/bin/tar",
        ["--create", "--file", archive, "--directory", path.dirname(profile), "chrome"],
        { timeout: 120000 },
      );
      const handle = await open(archive, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      await stopped();
      const digest = await archiveDigest(archive);
      await exclusiveText(
        path.join(directory, "profile.json"),
        JSON.stringify({ id: transaction.deploymentId, ...digest }),
      );
      await syncDirectory(directory);
    },
    async apply(transaction, beforeWrite) {
      await replaceUnit(transaction, false, beforeWrite);
    },
    async restore(transaction, beforeWrite) {
      await replaceUnit(transaction, true, beforeWrite);
    },
    async setBoot(transaction, beforeBoot, restore = false) {
      if (
        !transaction.ranking ||
        transaction.boot !== (restore ? "restore-pending" : "enable-pending")
      )
        throw new Error("Qlik boot intent required.");
      const value = await backup(transaction);
      const expected = parseQlikUnit(restore ? value.before : value.after, await getTemplate());
      const desired = restore ? value.enabled : true;
      const before = await inspectOwner();
      if (
        before.unitHash !== expected.unitHash ||
        before.active !== !restore ||
        ![value.enabled, true].includes(before.enabled)
      )
        throw new Error("Qlik boot owner mismatch.");
      await assertBootState(before.enabled);
      const approve = async () => {
        const guard = await beforeBoot();
        if (typeof guard !== "function") throw new Error("Fresh boot guard required.");
        await pending(transaction);
        if (
          !isDeepStrictEqual(await inspectOwner(), before) ||
          (await properties(unit)).NeedDaemonReload !== "no"
        )
          throw new Error("Qlik boot owner changed during approval.");
        await assertBootState(before.enabled);
        if (!restore) {
          await credentialMatches(value);
          if (!(await rankingArtifact(transaction)).rankingConnected)
            throw new Error("Qlik boot requires a successful ranking cycle.");
        }
        await assertHeldLock(lock);
        return guard;
      };
      if (before.enabled !== desired) {
        await command("/usr/bin/systemctl", [desired ? "enable" : "disable", unit], {
          beforeSpawn: approve,
        });
        await syncDirectory(path.dirname(bootLink));
        await syncDirectory(path.dirname(unitPath));
      } else (await approve())();
      await pending(transaction);
      await assertBootState(desired);
      if (!isDeepStrictEqual(await inspectOwner(), { ...before, enabled: desired }))
        throw new Error("Qlik boot mutation was not verified.");
    },
    async start(transaction, beforeStart, restore = false) {
      const value = await backup(transaction);
      await stopped();
      if (
        (await readProtectedText(unitPath, { mode: 0o644 })) !==
        (restore ? value.before : value.after)
      )
        throw new Error("Qlik start unit mismatch.");
      const effective = await properties(unit);
      const expected = parseQlikUnit(restore ? value.before : value.after, await getTemplate());
      if (
        effective.NeedDaemonReload !== "no" ||
        effective.WorkingDirectory !== `/srv/descomplica-crm-releases/${expected.sha}`
      )
        throw new Error("Qlik start requires the reloaded approved unit.");
      await pending(transaction);
      await command("/usr/bin/systemctl", ["start", unit], {
        beforeSpawn: async () => {
          const finalCheck = await beforeStart();
          if (typeof finalCheck !== "function") throw new Error("Fresh start guard required.");
          await pending(transaction);
          await stopped();
          const current = await properties(unit);
          if (
            current.NeedDaemonReload !== "no" ||
            current.WorkingDirectory !== `/srv/descomplica-crm-releases/${expected.sha}` ||
            (await readProtectedText(unitPath, { mode: 0o644 })) !==
              (restore ? value.before : value.after)
          )
            throw new Error("Qlik start changed during approval.");
          if (expected.ranking) await credentialMatches(value);
          await assertHeldLock(lock);
          return () => {
            finalCheck();
            startedAt.set(transaction.deploymentId, Date.now());
          };
        },
      });
    },
    async verifyOwner(transaction, restore = false) {
      const value = await backup(transaction);
      const expected = parseQlikUnit(restore ? value.before : value.after, await getTemplate());
      const deadline = expected.ranking
        ? startedAt.get(transaction.deploymentId) + 600_000
        : Infinity;
      const attempts = expected.ranking ? 300 : 90;
      for (let attempt = 0; attempt < attempts && Date.now() < deadline; attempt++) {
        await pending(transaction);
        const current = await inspectOwner();
        if (
          current.sha !== expected.sha ||
          current.unitHash !== expected.unitHash ||
          current.enabled !==
            (transaction.ranking && transaction.boot === "enabled" && !restore
              ? true
              : value.enabled)
        )
          throw new Error("Qlik owner changed during verification.");
        if (current.active) {
          if (current.ranking) {
            try {
              const result = await rankingArtifact(transaction);
              if (Date.now() >= deadline) break;
              if (result.rankingStatus !== "running") return result;
            } catch {
              /* Invalid/stale artifacts never authorize boot or become public output. */
            }
            await delay(Math.min(2000, Math.max(0, deadline - Date.now())));
            continue;
          }
          if (!current.preflight) return { preflightStatus: "disabled" };
          try {
            const file = "/run/descomplica-qlik/ranking-metadata.json";
            const info = await lstat("/run/descomplica-qlik");
            if (
              !info.isDirectory() ||
              info.isSymbolicLink() ||
              info.uid !== (await getIdentity()) ||
              (info.mode & 0o777) !== 0o700
            )
              throw new Error();
            const artifact = JSON.parse(
              await readProtectedText(file, {
                uid: await getIdentity(),
                mode: 0o600,
                maximum: 131072,
              }),
            );
            const observed = Date.parse(artifact.observedAt);
            if (
              artifact.schemaVersion === 1 &&
              artifact.kind === "qlik_metadata_preflight" &&
              artifact.rankingConnected === false &&
              Number.isFinite(observed) &&
              observed >= startedAt.get(transaction.deploymentId) &&
              observed <= Date.now() &&
              ["inspected", "pending", "reauth_required", "unavailable"].includes(
                artifact.result?.status,
              )
            )
              return { preflightStatus: artifact.result.status };
          } catch {
            /* No artifact body or authentication data leaves the private runtime. */
          }
        }
        await delay(Math.min(2000, Math.max(0, deadline - Date.now())));
      }
      throw new Error(
        expected.ranking
          ? "Qlik owner did not confirm a fresh ranking cycle within 10 minutes."
          : "Qlik owner did not confirm a fresh metadata attempt.",
      );
    },
  };
}
