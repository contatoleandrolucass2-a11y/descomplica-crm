import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { assertApprovedCandidate } from "../../../scripts/release/production-release-policy.mjs";
import {
  assertHeldLock,
  inheritedLockDescriptor,
  withFileLock,
} from "../../../scripts/release/production-release-lock.mjs";
import { privateJsonStore } from "../../../scripts/release/private-json-store.mjs";

export const collector = "descomplica-salesforce-collector.service";
export const monitor = "descomplica-salesforce-monitor.service";
export const browser = "descomplica-salesforce-browser.service";
export const stateDirectory = "/var/lib/descomplica-salesforce-collector-install";
const lockPath = `${stateDirectory}/installation.lock`;
const unitPath = `/etc/systemd/system/${collector}`;
const stagedUnitPath = `${unitPath}.collector-install-staged`;
const sourcePath = `ops/salesforce/vps/${collector}`;
const node = "/usr/local/bin/node";
const user = "descomplica-salesforce";
const dataDirectory = `/var/lib/${user}`;
const repository = "contatoleandrolucass2-a11y/descomplica-crm";
const api = `https://api.github.com/repos/${repository}`;
const shaPattern = /^[0-9a-f]{40}$/u;
const digest = (value) => createHash("sha256").update(value).digest("hex");

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseArguments(args) {
  const [operation, sha, run] = args;
  requireCondition(
    ["prepare", "activate", "rollback"].includes(operation) &&
      shaPattern.test(sha ?? "") &&
      args.length === (operation === "prepare" ? 3 : 2),
    "Usage: install-collector.mjs prepare SHA CI_RUN_ID | activate SHA | rollback SHA",
  );
  const runId = Number(run);
  if (operation === "prepare")
    requireCondition(
      /^[1-9][0-9]*$/u.test(run) && Number.isSafeInteger(runId),
      "Invalid CI run ID.",
    );
  return { operation, sha, ...(operation === "prepare" ? { runId } : {}) };
}

export function releasePath(sha) {
  requireCondition(shaPattern.test(sha), "An exact Git SHA is required.");
  return `/srv/descomplica-crm-releases/${sha}`;
}

export function renderUnit(template, sha) {
  template = template.replace(/\r\n/gu, "\n");
  requireCondition(
    template.includes("WorkingDirectory=@RELEASE@\n") &&
      template.match(/@RELEASE@/gu)?.length === 1,
    "Unexpected collector template.",
  );
  return template.replace("@RELEASE@", releasePath(sha));
}

export function assertHost(platform, uid, version) {
  requireCondition(
    platform === "linux" && uid === 0,
    "Collector installation requires Linux root.",
  );
  requireCondition(/^24\.19\.\d+$/u.test(version), "Node 24.19.x is required.");
}

export function assertFileMetadata(info, { owner = 0, privateFile = false, links = 1 } = {}) {
  requireCondition(
    info.isFile() &&
      !info.isSymbolicLink() &&
      info.uid === owner &&
      info.nlink === links &&
      (privateFile ? (info.mode & 0o7777) === 0o600 : (info.mode & 0o7022) === 0),
    "Expected a protected regular file with one link and the correct owner.",
  );
}

export function assertSecret(value) {
  requireCondition(
    typeof value === "string" && /^[A-Za-z0-9._~+/-]{32,4096}={0,2}(?:\r?\n)?$/u.test(value),
    "Private credential format is invalid.",
  );
}

function assertMonitor(snapshot) {
  requireCondition(
    snapshot &&
      ["enabled", "disabled"].includes(snapshot.enabled) &&
      ["active", "inactive"].includes(snapshot.active) &&
      snapshot.sub === (snapshot.active === "active" ? "running" : "dead") &&
      /^[0-9a-f]{64}$/u.test(snapshot.fingerprint),
    "Monitor must have a stable enabled/disabled and running/dead baseline.",
  );
}

export function validateState(state) {
  requireCondition(
    state?.schemaVersion === 1 &&
      shaPattern.test(state.sha) &&
      Number.isSafeInteger(state.runId) &&
      state.runId > 0 &&
      ["prepared", "installing", "switching", "active", "rolling-back", "rolled-back"].includes(
        state.phase,
      ) &&
      typeof state.monitorTouched === "boolean" &&
      typeof state.unit === "string" &&
      state.unit.length < 8192 &&
      state.unit.includes(`WorkingDirectory=${releasePath(state.sha)}\n`) &&
      state.backup?.collector === null,
    "Invalid private installation state; preserve it for recovery.",
  );
  assertMonitor(state.backup.monitor);
  return state;
}

// IO is injected so failure/recovery contracts run on Windows without host mutations.
export async function installCollector(options, io) {
  const { operation, sha } = options;
  assertHost(io.platform, io.uid, io.version);
  releasePath(sha);
  requireCondition(["prepare", "activate", "rollback"].includes(operation), "Unknown operation.");
  let stage = "lock";
  try {
    return await io.withLock(async () => {
      stage = "state";
      let state = await io.readState();
      const save = async (next) => {
        validateState(next);
        await io.writeState(state, next);
        state = next;
      };
      const ownUnit = async () => {
        const actual = await io.readUnit(state.unit);
        requireCondition(actual === null || actual === state.unit, "Collector unit CAS mismatch.");
        await io.assertCollectorConfiguration(actual !== null);
        return actual;
      };
      if (operation === "prepare") {
        stage = "prepare";
        requireCondition(
          state === null,
          "First installation only; private installation state already exists.",
        );
        const template = await io.verifyRelease(sha);
        assertApprovedCandidate(await io.approval(options.runId), sha);
        requireCondition((await io.readUnit()) === null, "Collector already exists.");
        await io.assertCollectorAbsent();
        const baseline = await io.monitorSnapshot();
        assertMonitor(baseline);
        await save({
          schemaVersion: 1,
          sha,
          runId: options.runId,
          phase: "prepared",
          monitorTouched: false,
          unit: renderUnit(template, sha),
          backup: { collector: null, monitor: baseline },
        });
        return state.phase;
      }
      validateState(state);
      requireCondition(state.sha === sha, "Installation state belongs to another SHA.");
      if (operation === "activate") {
        stage = "preflight";
        requireCondition(
          state.phase === "prepared",
          "Activation requires prepared state; use rollback after failure.",
        );
        requireCondition(
          renderUnit(await io.verifyRelease(sha), sha) === state.unit,
          "Prepared unit changed.",
        );
        await io.preflight(sha);
        assertApprovedCandidate(await io.approval(state.runId), sha);
        requireCondition((await ownUnit()) === null, "Collector already exists.");
        await io.assertCollectorAbsent();
        requireCondition(
          isDeepStrictEqual(await io.monitorSnapshot(), state.backup.monitor),
          "Monitor baseline changed.",
        );
        await save({ ...state, phase: "installing" });
        stage = "install-unit";
        await io.compareUnit(null, state.unit);
        await io.verifyUnit();
        await io.systemctl("daemon-reload");
        await ownUnit();
        requireCondition(
          isDeepStrictEqual(await io.monitorSnapshot(), state.backup.monitor),
          "Monitor baseline changed.",
        );
        await save({ ...state, phase: "switching", monitorTouched: true });
        stage = "switch-monitor";
        await io.systemctl("stop", monitor);
        await io.systemctl("disable", monitor);
        await io.assertService(monitor, "disabled", "inactive");
        await ownUnit();
        stage = "start-collector";
        await io.systemctl("enable", collector);
        await io.systemctl("start", collector);
        let mainPid;
        for (let observation = 0; observation < 3; observation++) {
          if (observation > 0) await io.wait(1000);
          const view = await io.show(collector);
          requireCondition(
            view.LoadState === "loaded" &&
              view.UnitFileState === "enabled" &&
              view.ActiveState === "active" &&
              view.SubState === "running" &&
              /^[1-9][0-9]*$/u.test(view.MainPID) &&
              Number.isSafeInteger(Number(view.MainPID)) &&
              view.NRestarts === "0" &&
              (mainPid === undefined || mainPid === view.MainPID),
            "Collector did not remain stable during activation.",
          );
          mainPid = view.MainPID;
          await io.assertService(monitor, "disabled", "inactive");
        }
        await save({ ...state, phase: "active" });
        return state.phase;
      }

      stage = "rollback";
      const installed = await ownUnit();
      if (state.phase === "rolled-back") {
        requireCondition(installed === null, "Collector reappeared after rollback.");
        await io.assertCollectorAbsent();
        requireCondition(
          isDeepStrictEqual(await io.monitorSnapshot(), state.backup.monitor),
          "Monitor changed after rollback.",
        );
        return state.phase;
      }
      await save({ ...state, phase: "rolling-back" });
      if (installed !== null) {
        await io.systemctl("disable", collector);
        await io.systemctl("stop", collector);
        const view = await io.show(collector);
        requireCondition(
          view.LoadState === "loaded" &&
            view.UnitFileState === "disabled" &&
            view.FragmentPath === unitPath &&
            view.DropInPaths === "" &&
            view.NeedDaemonReload === "no" &&
            view.MainPID === "0" &&
            ((view.ActiveState === "inactive" && view.SubState === "dead") ||
              (view.ActiveState === "failed" && view.SubState === "failed")),
          "Collector is not confirmed stopped before failure reset.",
        );
        // systemd may unload an inactive unit between show and reset-failed.
        if (view.ActiveState === "failed") await io.systemctl("reset-failed", collector);
        await io.assertService(collector, "disabled", "inactive");
        await io.compareUnit(state.unit, null);
      } else {
        await io.assertCollectorStopped();
      }
      await io.systemctl("daemon-reload");
      const currentMonitor = await io.monitorSnapshot();
      requireCondition(
        currentMonitor.fingerprint === state.backup.monitor.fingerprint,
        "Monitor configuration changed; recovery remains pending.",
      );
      if (state.monitorTouched) {
        await io.systemctl(
          state.backup.monitor.enabled === "enabled" ? "enable" : "disable",
          monitor,
        );
        await io.systemctl(state.backup.monitor.active === "active" ? "start" : "stop", monitor);
      }
      requireCondition(
        isDeepStrictEqual(await io.monitorSnapshot(), state.backup.monitor),
        "Monitor restoration not confirmed.",
      );
      await io.assertCollectorAbsent();
      await save({ ...state, phase: "rolled-back" });
      return state.phase;
    });
  } catch (error) {
    error.collectorStage = stage;
    throw error;
  }
}

export async function liveApproval(runId, json) {
  requireCondition(Number.isSafeInteger(runId) && runId > 0, "Exact CI run ID required.");
  const nonce = randomUUID();
  const main = await json(`${api}/commits/main?collector_check=${nonce}`);
  const run = await json(`${api}/actions/runs/${runId}?collector_check=${nonce}`);
  requireCondition(
    run.id === runId &&
      run.path === ".github/workflows/ci.yml" &&
      run.repository?.full_name === repository &&
      run.head_repository?.full_name === repository &&
      Number.isSafeInteger(run.run_attempt) &&
      run.run_attempt > 0,
    "CI evidence is not from the expected repository, workflow and attempt.",
  );
  const result = await json(
    `${api}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100&collector_check=${nonce}`,
  );
  requireCondition(
    Array.isArray(result.jobs) &&
      result.total_count === result.jobs.length &&
      result.jobs.every((job) => job.run_id === runId),
    "CI job evidence is incomplete or belongs to another run.",
  );
  const candidate = { mainSha: main.sha, run, jobs: result.jobs };
  assertApprovedCandidate(candidate, main.sha);
  return candidate;
}

async function json(url) {
  const response = await fetch(url, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent": "descomplica-salesforce-install",
      "Cache-Control": "no-cache, no-store",
    },
  });
  requireCondition(response.ok, "Live CI evidence unavailable; installation blocked.");
  return response.json();
}

async function protectedDirectory(directory, owner = 0, privateDirectory = false) {
  const info = await fs.lstat(directory);
  requireCondition(
    info.isDirectory() &&
      info.uid === owner &&
      (await fs.realpath(directory)) === directory &&
      (privateDirectory ? (info.mode & 0o7777) === 0o700 : (info.mode & 0o7022) === 0),
    "Directory must be real, protected and owned by the expected account.",
  );
}

async function protectedParents(filename, owner = 0) {
  let parent = path.posix.dirname(filename);
  while (parent !== "/") {
    await protectedDirectory(parent, owner);
    parent = path.posix.dirname(parent);
  }
}

async function readProtected(filename, options = {}) {
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    assertFileMetadata(await handle.stat(), options);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function readCollectorUnit(expected, fileSystem = fs) {
  let handle;
  try {
    handle = await fileSystem.open(unitPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  try {
    const info = await handle.stat();
    const stagedPair = info.nlink === 2 && typeof expected === "string";
    if (stagedPair) {
      // A crash between link and unlink leaves exactly this identifiable pair.
      const staged = await fileSystem.lstat(stagedUnitPath);
      assertFileMetadata(info, { links: 2 });
      assertFileMetadata(staged, { links: 2 });
      requireCondition(
        staged.ino === info.ino && staged.dev === info.dev,
        "Collector staging link does not belong to this installation.",
      );
    } else {
      assertFileMetadata(info);
    }
    requireCondition(info.size <= 8192, "Collector unit is too large.");
    const contents = await handle.readFile("utf8");
    if (stagedPair) requireCondition(contents === expected, "Collector staging contents changed.");
    return contents;
  } finally {
    await handle.close();
  }
}

async function maybeUnit(expected) {
  await protectedParents(unitPath);
  return readCollectorUnit(expected);
}

async function syncDirectory(directory) {
  const handle = await fs.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

// First install uses link's no-replace semantics; rollback removes only our exact bytes.
async function compareUnit(expected, next) {
  requireCondition((await maybeUnit(expected)) === expected, "Collector unit CAS mismatch.");
  if (next === null) {
    await fs.unlink(unitPath);
  } else {
    requireCondition(expected === null, "Unit upgrades are not supported.");
    let created = false;
    try {
      const handle = await fs.open(stagedUnitPath, "wx", 0o644);
      created = true;
      try {
        await handle.writeFile(next);
        await handle.chmod(0o644);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.link(stagedUnitPath, unitPath);
    } finally {
      if (created) await fs.rm(stagedUnitPath, { force: true });
    }
  }
  await syncDirectory(path.posix.dirname(unitPath));
  requireCondition((await maybeUnit()) === next, "Collector unit write was not confirmed.");
}

async function verifyDependencies(directory) {
  const root = `${directory}/node_modules`;
  await protectedDirectory(root);
  const visit = async (current) => {
    for (const name of await fs.readdir(current)) {
      const filename = `${current}/${name}`;
      const info = await fs.lstat(filename);
      if (info.isSymbolicLink()) {
        const resolved = await fs.realpath(filename);
        requireCondition(
          info.uid === 0 && resolved.startsWith(`${root}/`),
          "Dependencies must use release-local copies, not external stores.",
        );
      } else if (info.isDirectory()) {
        await protectedDirectory(filename);
        await visit(filename);
      } else {
        assertFileMetadata(info);
      }
    }
  };
  await visit(root);
}

export async function collectorPreflight(sha, io) {
  requireCondition(
    /^v24\.19\.\d+$/u.test((await io.run(node, ["--version"])).trim()),
    "Service Node must be 24.19.x.",
  );
  const uid = Number((await io.run("/usr/bin/id", ["-u", user])).trim());
  requireCondition(Number.isSafeInteger(uid) && uid > 0, "Dedicated nonroot user is missing.");
  await io.run("/usr/sbin/runuser", ["-u", user, "--", "/usr/bin/install", "--version"]);
  await io.directory(dataDirectory, uid, true);
  await io.parents(dataDirectory);
  const input = "/srv/descomplica-n8n/salesforce-test.token";
  await io.parents(input);
  const inputValue = (await io.read(input, { privateFile: true })).toString("utf8");
  const statusValue = (
    await io.read(`${dataDirectory}/status-bearer`, { owner: uid, privateFile: true })
  ).toString("utf8");
  assertSecret(inputValue);
  assertSecret(statusValue);
  requireCondition(
    inputValue.trim() !== statusValue.trim(),
    "Collector credentials must be distinct.",
  );
  const browserBefore = await io.show(browser);
  requireCondition(
    browserBefore.ActiveState === "active" && browserBefore.SubState === "running",
    "Existing browser must already be active.",
  );
  const directory = releasePath(sha);
  await io.dependencies(directory);
  const probe = [
    "if (!/^24\\.19\\.\\d+$/.test(process.versions.node)) throw new Error('node');",
    "await import('@playwright/test'); await import('zod');",
    "await import('./ops/salesforce/run-every-30-minutes.mjs');",
    "const r = await fetch('http://127.0.0.1:9222/json/version', {redirect:'error', signal:AbortSignal.timeout(5000)});",
    "if (!r.ok) throw new Error('browser'); const u = new URL((await r.json()).webSocketDebuggerUrl);",
    "if (u.protocol !== 'ws:' || u.hostname !== '127.0.0.1' || u.port !== '9222' || !u.pathname.startsWith('/devtools/browser/')) throw new Error('cdp');",
  ].join("\n");
  await io.run(
    "/usr/sbin/runuser",
    ["-u", user, "--", node, "--input-type=module", "--eval", probe],
    { cwd: directory },
  );
  requireCondition(
    isDeepStrictEqual(await io.show(browser), browserBefore),
    "Browser changed during preflight.",
  );
}

export function createHostIO() {
  let lock;
  const environment = {
    PATH: "/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    LANG: "C",
    LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  };
  const run = async (command, args, { cwd, allowed = [0] } = {}) => {
    if (lock) await assertHeldLock(lock, lockPath);
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: environment,
        stdio: ["ignore", "pipe", "ignore", ...(lock ? [inheritedLockDescriptor(lock)] : [])],
      });
      const chunks = [];
      let size = 0;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, 120_000);
      child.stdout.on("data", (chunk) => {
        size += chunk.length;
        if (size > 32 * 1024 * 1024) child.kill("SIGKILL");
        else chunks.push(chunk);
      });
      child.once("error", () => {
        clearTimeout(timeout);
        reject(new Error("Required host command unavailable."));
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        if (timedOut || size > 32 * 1024 * 1024 || !allowed.includes(code))
          reject(
            new Error(`Host command failed: ${path.posix.basename(command)}. Output withheld.`),
          );
        else resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
  };
  const show = async (name) => {
    const output = await run(
      "/usr/bin/systemctl",
      [
        "show",
        name,
        "--no-pager",
        "--property=LoadState,ActiveState,SubState,UnitFileState,FragmentPath,DropInPaths,NeedDaemonReload,MainPID,NRestarts",
      ],
      { allowed: [0, 1, 4] },
    );
    const result = Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );
    requireCondition(
      [
        "LoadState",
        "ActiveState",
        "SubState",
        "UnitFileState",
        "FragmentPath",
        "DropInPaths",
      ].every((key) => Object.hasOwn(result, key)),
      "Incomplete systemd observation.",
    );
    return result;
  };
  const assertCollectorConfiguration = async (exists) => {
    const view = await show(collector);
    requireCondition(
      !view.DropInPaths && ["", unitPath].includes(view.FragmentPath),
      "Unexpected collector override or fragment.",
    );
    if (exists)
      requireCondition(
        ["loaded", "not-found"].includes(view.LoadState),
        "Collector is masked or invalid.",
      );
  };
  const assertCollectorAbsent = async () => {
    const view = await show(collector);
    requireCondition(
      view.LoadState === "not-found" &&
        view.ActiveState === "inactive" &&
        !view.FragmentPath &&
        !view.DropInPaths &&
        !view.UnitFileState,
      "Collector already exists or has unresolved systemd state.",
    );
    for (const directory of ["/etc/systemd/system", "/run/systemd/system"]) {
      const inspect = async (current) => {
        for (const name of await fs.readdir(current)) {
          requireCondition(
            name !== collector && name !== `${collector}.d`,
            "Collector unit or enablement already exists.",
          );
          const filename = `${current}/${name}`;
          if ((await fs.lstat(filename)).isDirectory() && /\.(wants|requires)$/u.test(name))
            await inspect(filename);
        }
      };
      await inspect(directory);
    }
  };
  const store = privateJsonStore(`${stateDirectory}/state.json`, validateState);
  return {
    platform: process.platform,
    uid: process.getuid?.(),
    version: process.versions.node,
    show,
    wait,
    async withLock(action) {
      await protectedParents(stateDirectory);
      try {
        await fs.mkdir(stateDirectory, { mode: 0o700 });
        await syncDirectory("/var/lib");
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      await protectedDirectory(stateDirectory, 0, true);
      return withFileLock(lockPath, async (token) => {
        lock = token;
        try {
          return await action();
        } finally {
          lock = undefined;
        }
      });
    },
    async readState() {
      try {
        return await store.read();
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async writeState(expected, next) {
      await assertHeldLock(lock, lockPath);
      await store.compareAndWrite(expected, next);
    },
    readUnit: maybeUnit,
    async compareUnit(expected, next) {
      await assertHeldLock(lock, lockPath);
      await compareUnit(expected, next);
    },
    approval: (id) => liveApproval(id, json),
    assertCollectorAbsent,
    assertCollectorConfiguration,
    async assertCollectorStopped() {
      const view = await show(collector);
      requireCondition(
        view.ActiveState === "inactive" && ["", "disabled"].includes(view.UnitFileState),
        "Collector is not confirmed stopped and disabled.",
      );
    },
    async monitorSnapshot() {
      const view = await show(monitor);
      requireCondition(
        view.LoadState === "loaded" && view.NeedDaemonReload === "no" && view.DropInPaths === "",
        "Monitor must be loaded without pending changes or overrides.",
      );
      const fragment = `/etc/systemd/system/${monitor}`;
      requireCondition(view.FragmentPath === fragment, "Unexpected monitor fragment.");
      await protectedParents(fragment);
      const contents = await readProtected(fragment);
      const envPath = "/etc/descomplica-salesforce/monitor.env";
      await protectedParents(envPath);
      const env = await readProtected(envPath);
      const snapshot = {
        enabled: view.UnitFileState,
        active: view.ActiveState,
        sub: view.SubState,
        fingerprint: digest(Buffer.concat([contents, Buffer.from("\0"), env])),
      };
      assertMonitor(snapshot);
      return snapshot;
    },
    async assertService(name, enabled, active) {
      const view = await show(name);
      requireCondition(
        view.UnitFileState === enabled &&
          view.ActiveState === active &&
          view.SubState === (active === "active" ? "running" : "dead"),
        "Service transition was not confirmed.",
      );
    },
    async systemctl(operation, name) {
      requireCondition(
        (operation === "daemon-reload" && name === undefined) ||
          (["enable", "disable", "start", "stop"].includes(operation) &&
            [collector, monitor].includes(name)) ||
          (operation === "reset-failed" && name === collector),
        "Service operation is outside collector installation scope.",
      );
      await run("/usr/bin/systemctl", [operation, ...(name ? [name] : [])]);
    },
    async verifyUnit() {
      await run("/usr/bin/systemd-analyze", ["verify", unitPath]);
    },
    async verifyRelease(sha) {
      const directory = releasePath(sha);
      await protectedParents(directory);
      await protectedDirectory(directory);
      requireCondition(
        fileURLToPath(import.meta.url) === `${directory}/ops/salesforce/vps/install-collector.mjs`,
        "Run the installer from the exact immutable release.",
      );
      const git = (args) =>
        run("/usr/bin/git", ["-c", "core.fsmonitor=false", "-C", directory, ...args]);
      requireCondition((await git(["rev-parse", "HEAD"])).trim() === sha, "Release SHA mismatch.");
      requireCondition(
        (await git(["status", "--porcelain=v1", "--untracked-files=all"])).trim() === "",
        "Release checkout is dirty.",
      );
      const gitDirectory = (
        await git(["rev-parse", "--path-format=absolute", "--git-common-dir"])
      ).trim();
      await protectedParents(gitDirectory);
      await protectedDirectory(gitDirectory);
      const entries = (await git(["ls-tree", "-rz", sha])).split("\0").filter(Boolean);
      for (const entry of entries) {
        const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/u.exec(entry);
        requireCondition(
          match && !match[3].split("/").includes(".."),
          "Unsupported tracked release entry.",
        );
        const filename = `${directory}/${match[3]}`;
        await protectedParents(filename);
        const bytes = await readProtected(filename);
        const blob = createHash("sha1")
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest("hex");
        requireCondition(blob === match[2], "Release file differs from committed code.");
      }
      return (await readProtected(`${directory}/${sourcePath}`)).toString("utf8");
    },
    preflight: (sha) =>
      collectorPreflight(sha, {
        run,
        show,
        directory: protectedDirectory,
        parents: protectedParents,
        read: readProtected,
        dependencies: verifyDependencies,
      }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await installCollector(parseArguments(process.argv.slice(2)), createHostIO());
    process.stdout.write(`Collector installation: ${result}.\n`);
  } catch (error) {
    const stage = [
      "lock",
      "state",
      "prepare",
      "preflight",
      "install-unit",
      "switch-monitor",
      "start-collector",
      "rollback",
    ].includes(error.collectorStage)
      ? error.collectorStage
      : "arguments-or-host";
    process.stderr.write(
      `Collector installation failed at ${stage}. Preserve the private state and credentials; reconcile or run rollback with the same SHA.\n`,
    );
    process.exitCode = 1;
  }
}
