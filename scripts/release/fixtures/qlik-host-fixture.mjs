import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import realFilesystem from "node:fs/promises";
import realPath from "node:path";
import os from "node:os";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";

// Only this child process installs module mocks. Production modules are imported
// afterwards; all filesystem calls are confined to a private temporary root.
const scenario = process.argv[2];
const temporary = await realFilesystem.realpath(
  await realFilesystem.mkdtemp(realPath.join(os.tmpdir(), "qlik-host-fixture-")),
);
const posix = realPath.posix;
const targetSha = "b".repeat(40);
const previousSha = "a".repeat(40);
const deploymentId = "12345678-1234-4abc-8abc-123456789abc";
const targetImageId = `sha256:${"c".repeat(64)}`;
const releaseRoot = `/srv/descomplica-crm-releases/${targetSha}`;
const releaseModuleDirectory = fileURLToPath(new URL("../", import.meta.url)).replace(
  /[\\/]$/u,
  "",
);
const unit = "descomplica-qlik-browser.service";
const unitPath = `/etc/systemd/system/${unit}`;
const profile = "/var/lib/descomplica-qlik/chrome";
const runtime = "/run/descomplica-qlik";
const artifactPath = `${runtime}/ranking-metadata.json`;
const backupDirectory = `/etc/descomplica-crm/qlik-backups/${deploymentId}`;
const uid = 4242;
const lock = Object.freeze({ fixture: true });
const events = [];
const commandErrors = [];
const metadata = new Map();
const approved = new Map();
const digest = (value) => createHash("sha256").update(value).digest("hex");
let lockHeld = true;
let lockChecks = 0;
let delayCalls = 0;
let browserActive = true;
const enabled = false;
let processesRemain = false;
let consoleActive = false;
let effectiveOverrides = {};
let daemonReload = false;
let liveGuard = null;
let profileSwapped = false;
let profileWalks = 0;

function freshnessGuard(label) {
  let calls = 0;
  return () => {
    assert.equal(++calls, 1, "Freshness guard must run exactly once");
    liveGuard = label;
    events.push(`guard:${label}`);
    queueMicrotask(() => {
      liveGuard = null;
    });
  };
}

async function unitTemporaryNames() {
  return (await realFilesystem.readdir(physical(posix.dirname(unitPath))))
    .filter((name) => name.startsWith(`${unit}.${deploymentId}.`) && name.endsWith(".tmp"))
    .sort();
}

async function replaceProfileRoot() {
  const target = `${profile}-original`;
  await realFilesystem.rename(physical(profile), physical(target));
  await realFilesystem.symlink(
    physical(target),
    physical(profile),
    process.platform === "win32" ? "junction" : "dir",
  );
  profileSwapped = true;
  assert.equal((await realFilesystem.lstat(physical(profile))).isSymbolicLink(), true);
}

function physical(file) {
  assert.equal(typeof file, "string");
  assert.equal(posix.normalize(file), file, `Noncanonical fixture path: ${file}`);
  assert.ok(
    file === "/" ||
      ["/etc", "/srv", "/var", "/run"].some((base) => file === base || file.startsWith(base + "/")),
    `Forbidden filesystem path: ${file}`,
  );
  const result = realPath.join(temporary, ...file.split("/"));
  assert.ok(result === temporary || result.startsWith(temporary + realPath.sep));
  return result;
}

async function ensureDirectory(directory, mode = 0o755, owner = 0) {
  await realFilesystem.mkdir(physical(directory), { recursive: true, mode: 0o700 });
  for (let current = directory; ; current = posix.dirname(current)) {
    if (!metadata.has(current)) metadata.set(current, { mode: 0o755, uid: 0, gid: 0 });
    if (current === "/") break;
  }
  metadata.set(directory, { mode, uid: owner, gid: owner });
}

async function put(file, contents, mode = 0o600, owner = 0) {
  if (!metadata.has(posix.dirname(file))) await ensureDirectory(posix.dirname(file));
  await realFilesystem.writeFile(physical(file), contents, { mode: 0o600 });
  metadata.set(file, { mode, uid: owner, gid: owner });
}

function protectedStat(info, file) {
  assert.ok(metadata.has(file), `Missing synthetic ownership for ${file}`);
  const synthetic = metadata.get(file);
  return Object.assign(Object.create(Object.getPrototypeOf(info)), info, synthetic, {
    mode: (info.mode & ~0o7777) | synthetic.mode,
  });
}

const filesystem = {
  lstat: async (file) => protectedStat(await realFilesystem.lstat(physical(file)), file),
  realpath: async (file) => {
    const resolved = await realFilesystem.realpath(physical(file));
    const relative = realPath.relative(temporary, resolved);
    assert.ok(relative !== ".." && !relative.startsWith(".." + realPath.sep));
    return metadata.get(file)?.redirect ?? "/" + relative.split(realPath.sep).join("/");
  },
  mkdir: async (file, options) => {
    const result = await realFilesystem.mkdir(physical(file), options);
    metadata.set(file, { mode: options?.mode ?? 0o755, uid: 0, gid: 0 });
    events.push(`mkdir:${file}`);
    return result;
  },
  readdir: async (file) => {
    if (file === profile) profileWalks++;
    return realFilesystem.readdir(physical(file));
  },
  readlink: async (file) => realFilesystem.readlink(physical(file)),
  statfs: async (file) => {
    physical(file);
    return { bavail: 8 * 1024 * 1024, bsize: 4096 };
  },
  rename: async (from, to) => {
    if (to === unitPath) {
      assert.ok(
        ["apply", "restore"].includes(liveGuard),
        "Unit swap must immediately follow a synchronous guard",
      );
      assert.equal(events.at(-1), `guard:${liveGuard}`);
    }
    events.push(`rename:${to}`);
    await realFilesystem.rename(physical(from), physical(to));
    metadata.set(to, metadata.get(from));
    metadata.delete(from);
  },
  unlink: async (file) => {
    await realFilesystem.unlink(physical(file));
    metadata.delete(file);
  },
  rm: async (file, options) => {
    assert.ok(file !== "/" && file.endsWith(".tmp"), "Only ledger temporary cleanup is permitted");
    await realFilesystem.rm(physical(file), options);
    metadata.delete(file);
  },
  open: async (file, flags, mode) => {
    if (
      file === `${backupDirectory}/profile.tar` &&
      scenario === "profile-root-symlink-before-tar" &&
      !profileSwapped
    )
      await replaceProfileRoot();
    const destination = physical(file);
    let info;
    try {
      info = await realFilesystem.lstat(destination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (info?.isDirectory()) {
      return {
        sync: async () => {
          events.push(`sync-directory:${file}`);
        },
        close: async () => {},
      };
    }
    const handle = await realFilesystem.open(destination, flags, mode);
    if (!info)
      metadata.set(file, {
        mode: scenario === "unit-umask" ? (mode ?? 0o600) & ~0o077 : (mode ?? 0o600),
        uid: 0,
        gid: 0,
      });
    return {
      stat: async () => protectedStat(await handle.stat(), file),
      read: (...args) => handle.read(...args),
      readFile: (...args) => handle.readFile(...args),
      writeFile: async (...args) => {
        events.push(`write:${file}`);
        return handle.writeFile(...args);
      },
      sync: async () => {
        events.push(`sync-file:${file}`);
        if (
          process.platform === "win32" &&
          (flags === "r" || (typeof flags === "number" && (flags & 3) === 0))
        )
          return;
        await handle.sync();
      },
      chmod: async (value) => {
        await handle.chmod(value);
        metadata.get(file).mode = value;
        events.push(`chmod:${file}:${value.toString(8)}`);
      },
      createReadStream: (...args) => handle.createReadStream(...args),
      close: () => handle.close(),
    };
  },
};

const template =
  "[Service]\nUser=descomplica-qlik\nWorkingDirectory=@RELEASE@\nEnvironment=HOME=/var/lib/descomplica-qlik\nExecStart=/usr/local/bin/node ops/qlik/launch-browser.mjs\n";
const beforeUnit = template.replace("@RELEASE@", `/srv/descomplica-crm-releases/${previousSha}`);
const afterUnit = template
  .replace("@RELEASE@", releaseRoot)
  .replace(
    "Environment=HOME=/var/lib/descomplica-qlik\n",
    "Environment=HOME=/var/lib/descomplica-qlik\nEnvironment=QLIK_METADATA_PREFLIGHT=enabled\n",
  );

async function artifact() {
  const status = scenario.startsWith("status-") ? scenario.slice(7) : "inspected";
  const observedAt = new Date(
    Date.now() +
      (scenario === "artifact-stale" ? -60000 : scenario === "artifact-future" ? 60000 : 0),
  ).toISOString();
  await put(
    artifactPath,
    JSON.stringify({
      schemaVersion: 1,
      kind: "qlik_metadata_preflight",
      observedAt,
      rankingConnected: scenario === "artifact-connected",
      result: { status },
    }),
    scenario === "artifact-mode" ? 0o644 : 0o600,
    scenario === "artifact-owner" ? 0 : uid,
  );
}

async function emulate(executable, args) {
  if (executable === "/usr/bin/id") {
    assert.deepEqual(args, ["-u", "descomplica-qlik"]);
    return { stdout: `${uid}\n` };
  }
  if (executable === "/usr/bin/git") {
    assert.equal(args[0], "show");
    assert.equal(args.length, 2);
    const key = args[1].slice(targetSha.length + 1);
    assert.equal(args[1], `${targetSha}:${key}`);
    assert.ok(approved.has(key));
    return { stdout: approved.get(key) };
  }
  if (executable === "/usr/sbin/runuser") {
    assert.deepEqual(args.slice(0, 6), [
      "-u",
      "descomplica-qlik",
      "--",
      "/usr/bin/env",
      "-i",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    ]);
    assert.ok(args.includes("--input-type=module"));
    assert.ok(args.at(-1).includes("getBrowserMetadataScript"));
    return {};
  }
  if (executable === "/usr/bin/systemd-analyze") {
    assert.deepEqual(args, ["verify", `${backupDirectory}/${unit}`]);
    assert.equal(await realFilesystem.readFile(physical(args[1]), "utf8"), afterUnit);
    return {};
  }
  if (executable === "/usr/bin/pgrep") {
    assert.deepEqual(args, ["-u", String(uid)]);
    return { code: processesRemain ? 0 : 1, stdout: processesRemain ? "7001\n" : "" };
  }
  if (executable === "/usr/bin/tar") {
    assert.deepEqual(args, [
      "--create",
      "--file",
      `${backupDirectory}/profile.tar`,
      "--directory",
      posix.dirname(profile),
      "chrome",
    ]);
    assert.equal(browserActive, false);
    assert.equal(processesRemain, false);
    // Archive bytes are real and hashed by the host; tar serialization itself is
    // deliberately emulated, never executed or represented as a tar validation.
    const data = await realFilesystem.readFile(physical(`${profile}/Preferences`));
    await realFilesystem.writeFile(
      physical(args[2]),
      Buffer.concat([Buffer.from("SYNTHETIC-TAR\n"), data]),
    );
    return {};
  }
  if (executable === "/usr/bin/systemctl") {
    const [verb, name] = args;
    if (verb === "show") {
      assert.ok(
        [unit, "descomplica-qlik-console.service", "descomplica-qlik-vnc.service"].includes(name),
      );
      const active = name === unit ? browserActive : consoleActive;
      const contents = await realFilesystem.readFile(physical(unitPath), "utf8");
      return {
        stdout:
          Object.entries({
            ActiveState: active ? "active" : "inactive",
            SubState: active ? "running" : "dead",
            MainPID: active ? "7001" : "0",
            WorkingDirectory: contents.match(/^WorkingDirectory=(.+)$/mu)[1],
            UnitFileState: enabled ? "enabled" : "disabled",
            DropInPaths: "",
            FragmentPath: unitPath,
            NeedDaemonReload: daemonReload ? "yes" : "no",
            User: "descomplica-qlik",
            Group: "descomplica-qlik",
            ...effectiveOverrides,
          })
            .map(([key, value]) => `${key}=${value}`)
            .join("\n") + "\n",
      };
    }
    if (verb === "daemon-reload") {
      assert.equal(args.length, 1);
      daemonReload = false;
      return {};
    }
    assert.deepEqual(args, [verb, unit]);
    if (verb === "stop") {
      browserActive = false;
      return {};
    }
    if (verb === "start") {
      browserActive = true;
      await artifact();
      return {};
    }
  }
  assert.fail(`External command is not permitted in this fixture: ${executable} ${args.join(" ")}`);
}

function spawn(executable, args, options) {
  assert.equal(lockHeld, true);
  assert.equal(options.cwd, releaseRoot);
  assert.deepEqual(options.stdio, ["ignore", "pipe", "ignore", 91, 92, 93]);
  assert.deepEqual(Object.keys(options.env).sort(), ["GIT_CONFIG_NOSYSTEM", "PATH", "TZ"]);
  if (executable === "/usr/bin/systemctl" && args[0] === "start") {
    assert.ok(
      ["start", "recovery-start"].includes(liveGuard),
      "Start must immediately follow a synchronous guard",
    );
    assert.equal(events.at(-1), `guard:${liveGuard}`);
  }
  events.push(`command:${executable}:${args[0]}`);
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.kill = () => {
    child.emit("close", null, "SIGKILL");
  };
  queueMicrotask(async () => {
    try {
      const result = await emulate(executable, args);
      if (result.stdout) child.stdout.emit("data", Buffer.from(result.stdout));
      child.emit("close", result.code ?? 0, null);
    } catch (error) {
      commandErrors.push(error.message);
      child.emit("error", error);
    }
  });
  return child;
}

async function install() {
  await ensureDirectory(releaseRoot);
  await ensureDirectory("/etc/systemd/system");
  await ensureDirectory("/etc/descomplica-crm", 0o700);
  await ensureDirectory(profile, 0o700, uid);
  await ensureDirectory(runtime, 0o700, uid);
  await put(`${profile}/Preferences`, '{"synthetic":true}', 0o600, uid);
  await put(unitPath, beforeUnit, 0o644);
  const files = [
    "ops/qlik/launch-browser.mjs",
    "ops/qlik/browser-preflight.mjs",
    "ops/qlik/qix-metadata.mjs",
    "ops/qlik/collection-loop.mjs",
    "ops/qlik/metadata-artifact.mjs",
    `ops/qlik/vps/${unit}`,
    "package.json",
    "pnpm-lock.yaml",
  ];
  for (const relative of files) {
    const value = relative.endsWith(".service") ? template : `synthetic approved ${relative}\n`;
    approved.set(relative, value);
    await put(`${releaseRoot}/${relative}`, value, 0o644);
  }
  for (const [name, version] of [
    ["enigma.js", "2.15.0"],
    ["@playwright/test", "1.62.1"],
  ]) {
    await put(
      `${releaseRoot}/node_modules/${name}/package.json`,
      JSON.stringify({ name, version }),
      0o644,
    );
  }
  mock.module("node:fs/promises", { exports: { default: filesystem, ...filesystem } });
  const path = {
    ...posix,
    resolve: (...parts) =>
      parts.length === 2 && parts[0] === releaseModuleDirectory && parts[1] === "../.."
        ? releaseRoot
        : posix.resolve(...parts),
  };
  mock.module("node:path", { exports: { default: path, ...path } });
  mock.module("node:child_process", { exports: { spawn } });
  mock.module("node:timers/promises", {
    exports: {
      setTimeout: async (ms) => {
        assert.equal(ms, 2000);
        delayCalls++;
      },
    },
  });
  mock.module(new URL("../production-release-lock.mjs", import.meta.url), {
    exports: {
      assertHeldLock: async (value) => {
        lockChecks++;
        events.push("lock-check");
        assert.equal(value, lock);
        if (!lockHeld) throw new Error("Synthetic lock lost");
      },
      inheritedLockDescriptors: (value) => {
        assert.equal(value, lock);
        return [91, 92, 93];
      },
      validatePrivateDirectory: async (directory, owner = 0) => {
        const info = await filesystem.lstat(directory);
        assert.ok(
          info.isDirectory() &&
            !info.isSymbolicLink() &&
            info.uid === owner &&
            (info.mode & 0o022) === 0,
        );
        assert.equal(await filesystem.realpath(directory), directory);
      },
      validatePrivateFile: (info, owner = 0) => {
        assert.ok(
          info.isFile() && info.uid === owner && info.nlink === 1 && (info.mode & 0o777) === 0o600,
        );
      },
    },
  });
  mock.module(new URL("../bind-production-image.mjs", import.meta.url), {
    exports: {
      verifyReleaseBoundary: async (value) => {
        assert.equal(value, targetSha);
        events.push("boundary");
      },
      verifyPromotableImage: async (value, image) => {
        assert.equal(value, targetSha);
        assert.equal(image, targetImageId);
        events.push("image");
      },
    },
  });
  mock.module(new URL("../production-release-host.mjs", import.meta.url), {
    exports: {
      productionHost: (value) => {
        assert.equal(value, lock);
        return Object.freeze({
          observe: () => assert.fail("CRM observation not delegated"),
          candidate: () => assert.fail("CRM candidate not delegated"),
        });
      },
    },
  });
}

async function run() {
  await install();
  const { qlikReleaseHost } = await import("../qlik-release-host.mjs");
  let host = qlikReleaseHost(lock);
  assert.equal(await host.readState(), null);
  const owner = await host.inspectOwner();
  assert.deepEqual(owner, {
    sha: previousSha,
    unitHash: digest(beforeUnit),
    preflight: false,
    enabled: false,
    active: true,
  });
  const options = {
    operation: "qlik-deploy",
    expectedDeploymentId: "87654321-1234-4abc-8abc-123456789abc",
    expectedSha: previousSha,
    expectedOwnerSha: previousSha,
    targetSha,
    targetImageId,
    ciRunId: 123,
  };

  const early = {
    "input-mismatch": async () => {
      await put(`${releaseRoot}/package.json`, "tampered");
    },
    "unsafe-parent": async () => {
      metadata.get("/srv").mode = 0o777;
    },
    "unsafe-profile": async () => {
      metadata.get(profile).uid = 0;
      host = qlikReleaseHost(lock);
    },
    "unit-mismatch": async () => {
      await put(unitPath, beforeUnit + "# tampered\n", 0o644);
    },
    "effective-unit": async () => {
      effectiveOverrides = { DropInPaths: "/etc/unreviewed.conf" };
    },
  };
  if (early[scenario]) {
    await early[scenario]();
    await assert.rejects(
      host.prepare(options, owner, deploymentId),
      /Qlik|protected regular file/u,
    );
    assert.equal(
      events.some((event) => event === "command:/usr/bin/systemctl:stop"),
      false,
    );
    return;
  }
  const backup = await host.prepare(options, owner, deploymentId);
  assert.deepEqual(backup, {
    id: deploymentId,
    previousSha,
    targetSha,
    previousUnitHash: digest(beforeUnit),
    targetUnitHash: digest(afterUnit),
  });
  const saved = JSON.parse(
    await realFilesystem.readFile(physical(`${backupDirectory}/unit.json`), "utf8"),
  );
  assert.deepEqual(saved, {
    id: deploymentId,
    before: beforeUnit,
    after: afterUnit,
    enabled: false,
  });
  assert.equal(metadata.get(`${backupDirectory}/unit.json`).mode, 0o600);
  const transaction = {
    deploymentId,
    expectedDeploymentId: options.expectedDeploymentId,
    expectedSha: previousSha,
    targetSha,
    targetImageId,
    ciRunId: 123,
    startedAt: new Date(Date.now() - 120000).toISOString(),
    previousOwner: owner,
    backup,
    operation: "qlik-deploy",
    phase: "prepared",
  };
  let state = { schemaVersion: 1, baseline: owner, release: null, inProgress: transaction };
  await host.writeState(null, state);
  assert.deepEqual(await host.readState(), state);
  events.push("pending");

  if (scenario === "pending-mismatch") {
    await host.writeState(state, { ...state, inProgress: { ...transaction, phase: "recovering" } });
    await assert.rejects(host.quiesce(transaction), /Qlik pending release changed/u);
    return;
  }
  if (scenario === "backup-identity") {
    await assert.rejects(
      host.quiesce({ ...transaction, backup: { ...backup, id: "../../escape" } }),
      /Qlik pending release changed|Qlik backup identity rejected/u,
    );
    return;
  }
  if (scenario === "backup-unit-hash") {
    saved.after = saved.after.replace(targetSha, "d".repeat(40));
    await put(`${backupDirectory}/unit.json`, JSON.stringify(saved));
    await assert.rejects(host.quiesce(transaction), /Qlik unit backup does not match/u);
    return;
  }
  if (scenario === "lost-lock") {
    lockHeld = false;
    await assert.rejects(host.quiesce(transaction), /Synthetic lock lost/u);
    assert.equal(browserActive, true);
    return;
  }
  if (scenario === "console-active") {
    consoleActive = true;
    await assert.rejects(host.quiesce(transaction), /Private console is in use/u);
    assert.equal(browserActive, true);
    return;
  }
  if (scenario === "owner-process") {
    processesRemain = true;
    await assert.rejects(host.quiesce(transaction), /Qlik processes still own the profile/u);
    await assert.rejects(realFilesystem.access(physical(`${backupDirectory}/profile.tar`)), {
      code: "ENOENT",
    });
    return;
  }
  await host.quiesce(transaction);
  assert.equal(browserActive, false);
  if (scenario.startsWith("profile-root-")) {
    if (scenario === "profile-root-symlink") await replaceProfileRoot();
    if (scenario === "profile-root-owner") metadata.get(profile).uid = 0;
    if (scenario === "profile-root-mode") metadata.get(profile).mode = 0o755;
    if (scenario === "profile-root-realpath")
      metadata.get(profile).redirect = `${profile}-different`;
    await assert.rejects(host.backupProfile(transaction), /Dedicated Qlik profile changed/u);
    assert.equal(events.includes("command:/usr/bin/tar:--create"), false);
    assert.equal(profileWalks, scenario === "profile-root-symlink-before-tar" ? 1 : 0);
    assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), beforeUnit);
    return;
  }
  await host.backupProfile(transaction);
  const archive = await realFilesystem.readFile(physical(`${backupDirectory}/profile.tar`));
  const receipt = JSON.parse(
    await realFilesystem.readFile(physical(`${backupDirectory}/profile.json`), "utf8"),
  );
  assert.deepEqual(receipt, { id: deploymentId, bytes: archive.length, sha256: digest(archive) });
  assert.ok(archive.includes(Buffer.from('{"synthetic":true}')));
  assert.equal(metadata.get(`${backupDirectory}/profile.tar`).mode, 0o600);
  const previous = structuredClone(state);
  state = { ...state, inProgress: { ...transaction, phase: "profile-backed-up" } };
  await host.writeState(previous, state);
  const pending = state.inProgress;
  async function rejectCallbackMutation(stage) {
    const reason = scenario.slice(stage.length + 1);
    const priorUnit = stage === "apply" ? beforeUnit : afterUnit;
    const changedUnit = priorUnit + "# changed inside approval callback\n";
    const renames = events.filter((event) => event === `rename:${unitPath}`).length;
    let callbacks = 0;
    let guards = 0;
    const approval = async () => {
      callbacks++;
      if (reason === "race-unit") await put(unitPath, changedUnit, 0o644);
      if (reason === "race-ledger")
        await host.writeState(state, { ...state, inProgress: { ...pending, phase: "recovering" } });
      if (reason === "race-lock") lockHeld = false;
      if (reason === "race-reload") effectiveOverrides.NeedDaemonReload = "yes";
      if (reason === "race-directory")
        effectiveOverrides.WorkingDirectory = `/srv/descomplica-crm-releases/${previousSha}`;
      if (reason === "race-process") processesRemain = true;
      if (reason === "guard-missing") return undefined;
      return () => {
        guards++;
        if (reason === "guard-expired") throw new Error("Synthetic freshness expired");
        assert.fail("Guard ran before rejecting changed local authority");
      };
    };
    const expected =
      reason === "race-ledger"
        ? /Qlik pending release changed/u
        : reason === "race-lock"
          ? /Synthetic lock lost/u
          : reason === "race-process"
            ? /Qlik processes still own the profile/u
            : reason === "guard-expired"
              ? /Synthetic freshness expired/u
              : reason === "guard-missing"
                ? /Fresh (unit|start) guard required/u
                : /Qlik (unit|start) changed during approval/u;
    await assert.rejects(host[stage](pending, approval), expected);
    assert.equal(callbacks, 1);
    assert.equal(guards, reason === "guard-expired" ? 1 : 0);
    assert.equal(events.filter((event) => event === `rename:${unitPath}`).length, renames);
    assert.equal(events.includes("command:/usr/bin/systemctl:start"), false);
    assert.equal(browserActive, false);
    assert.equal(
      await realFilesystem.readFile(physical(unitPath), "utf8"),
      reason === "race-unit" ? changedUnit : priorUnit,
    );
    if (stage === "apply") assert.deepEqual(await unitTemporaryNames(), []);
  }
  if (scenario.startsWith("apply-race-") || scenario.startsWith("apply-guard-")) {
    await rejectCallbackMutation("apply");
    return;
  }
  if (scenario === "archive-corrupt" || scenario === "unsafe-archive") {
    if (scenario === "archive-corrupt")
      await realFilesystem.appendFile(physical(`${backupDirectory}/profile.tar`), "tampered");
    else metadata.get(`${backupDirectory}/profile.tar`).mode = 0o644;
    await assert.rejects(
      host.apply(pending, () => assert.fail("Callback before backup validation")),
      /Qlik profile backup (integrity failed|rejected)/u,
    );
    assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), beforeUnit);
    return;
  }
  if (scenario === "apply-callback") {
    await assert.rejects(
      host.apply(pending, async () => {
        throw new Error("Synthetic approval refused");
      }),
      /Synthetic approval refused/u,
    );
    assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), beforeUnit);
    assert.deepEqual(await unitTemporaryNames(), []);
    return;
  }
  await host.apply(pending, async () => {
    assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), beforeUnit);
    assert.equal(browserActive, false);
    assert.deepEqual(await host.readState(), state);
    events.push("apply-callback");
    return freshnessGuard("apply");
  });
  assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), afterUnit);
  assert.equal(metadata.get(unitPath).mode, 0o644);
  if (scenario === "start-reload" || scenario === "start-directory") {
    effectiveOverrides =
      scenario === "start-reload"
        ? { NeedDaemonReload: "yes" }
        : { WorkingDirectory: `/srv/descomplica-crm-releases/${previousSha}` };
    await assert.rejects(
      host.start(pending, () => assert.fail("Start callback must not run")),
      /Qlik start requires the reloaded approved unit/u,
    );
    assert.equal(browserActive, false);
    assert.equal(events.includes("command:/usr/bin/systemctl:start"), false);
    return;
  }
  if (scenario === "deferred-reload") {
    effectiveOverrides = {
      NeedDaemonReload: "yes",
      WorkingDirectory: `/srv/descomplica-crm-releases/${previousSha}`,
    };
    assert.equal((await host.inspectOwner()).active, false);
    effectiveOverrides.MainPID = "7001";
    await assert.rejects(host.inspectOwner(), /Qlik effective service differs/u);
    effectiveOverrides.MainPID = "0";
    const cleared = { ...state, inProgress: null };
    await host.writeState(state, cleared);
    await assert.rejects(host.inspectOwner(), /Qlik effective service differs/u);
    return;
  }
  if (scenario === "start-callback") {
    await assert.rejects(
      host.start(pending, async () => {
        throw new Error("Synthetic start refused");
      }),
      /Synthetic start refused/u,
    );
    assert.equal(browserActive, false);
    assert.equal(events.includes("command:/usr/bin/systemctl:start"), false);
    return;
  }
  if (scenario.startsWith("start-race-") || scenario.startsWith("start-guard-")) {
    await rejectCallbackMutation("start");
    return;
  }
  await host.start(pending, async () => {
    assert.equal(browserActive, false);
    assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), afterUnit);
    events.push("start-callback");
    return freshnessGuard("start");
  });
  if (scenario.startsWith("artifact-")) {
    if (scenario === "artifact-stale") {
      const stale = JSON.parse(await realFilesystem.readFile(physical(artifactPath), "utf8"));
      assert.ok(
        Date.parse(stale.observedAt) > Date.parse(pending.startedAt),
        "Artifact is newer than intent but predates start",
      );
    }
    await assert.rejects(
      host.verifyOwner(pending),
      /Qlik owner did not confirm a fresh metadata attempt/u,
    );
    assert.equal(delayCalls, 90);
    return;
  }
  assert.deepEqual(await host.verifyOwner(pending), {
    preflightStatus: scenario.startsWith("status-") ? scenario.slice(7) : "inspected",
  });
  const milestones = [
    "pending",
    "command:/usr/bin/systemctl:stop",
    "command:/usr/bin/tar:--create",
    "apply-callback",
    "guard:apply",
    `rename:${unitPath}`,
    "command:/usr/bin/systemctl:daemon-reload",
    "start-callback",
    "guard:start",
    "command:/usr/bin/systemctl:start",
  ];
  let last = -1;
  for (const event of milestones) {
    const index = events.indexOf(event);
    assert.ok(index > last, `Wrong order: ${event}`);
    last = index;
  }

  if (scenario === "recovery" || scenario === "recovery-residue") {
    host = qlikReleaseHost(lock);
    assert.deepEqual(await host.readState(), state);
    const recoveredState = { ...state, inProgress: { ...pending, phase: "recovering" } };
    await host.writeState(state, recoveredState);
    const recovering = recoveredState.inProgress;
    await host.quiesce(recovering);
    const residualPaths =
      scenario === "recovery-residue"
        ? [
            `${unitPath}.${deploymentId}.tmp`,
            `${unitPath}.${deploymentId}.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.tmp`,
          ]
        : [];
    for (const file of residualPaths) await put(file, "synthetic crash residue\n", 0o644);
    const residualNames = await unitTemporaryNames();
    await host.restore(recovering, async () => {
      assert.equal(browserActive, false);
      events.push("restore-callback");
      return freshnessGuard("restore");
    });
    await host.start(
      recovering,
      async () => {
        assert.equal(await realFilesystem.readFile(physical(unitPath), "utf8"), beforeUnit);
        return freshnessGuard("recovery-start");
      },
      true,
    );
    assert.deepEqual(await host.verifyOwner(recovering, true), { preflightStatus: "disabled" });
    assert.deepEqual(await unitTemporaryNames(), residualNames);
    for (const file of residualPaths)
      assert.equal(
        await realFilesystem.readFile(physical(file), "utf8"),
        "synthetic crash residue\n",
      );
    assert.equal(
      await realFilesystem.readFile(physical(`${profile}/Preferences`), "utf8"),
      '{"synthetic":true}',
    );
    assert.deepEqual(
      await realFilesystem.readFile(physical(`${backupDirectory}/profile.tar`)),
      archive,
    );
    assert.equal(events.filter((event) => event.startsWith("command:/usr/bin/tar:")).length, 1);
  }
}

let passed = false;
globalThis.fetch = async () => assert.fail("Network access is forbidden in host fixtures");
try {
  await run();
  assert.deepEqual(commandErrors, []);
  passed = true;
} finally {
  mock.restoreAll();
  await realFilesystem.rm(temporary, { recursive: true, force: true });
}
await assert.rejects(realFilesystem.access(temporary), { code: "ENOENT" });
process.stdout.write(
  JSON.stringify({ scenario, passed, temporaryRemoved: true, realExternalCommands: 0, lockChecks }),
);
