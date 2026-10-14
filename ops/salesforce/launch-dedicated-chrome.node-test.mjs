import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertNativePrivatePath } from "./test-helpers/native-private-fixture.mjs";

import {
  SALESFORCE_LIGHTNING_URL,
  assertCdpPortAvailable,
  assertInteractiveEnvironment,
  buildChromeArguments,
  chromeExecutableCandidates,
  launchDedicatedChrome,
  parseCdpPort,
  parseLaunchArguments,
  prepareDedicatedProfile,
  protectDedicatedProfileDirectory,
  resolveChromeExecutable,
  resolveChromeProfileDirectory,
  resolveLaunchCdpPort,
  runDedicatedChrome,
  waitForCdp,
} from "./launch-dedicated-chrome.mjs";

test("requires a non-root graphical Linux session without weakening the sandbox", () => {
  assert.throws(
    () =>
      assertInteractiveEnvironment({ platform: "linux", env: { DISPLAY: ":0" }, getuid: () => 0 }),
    /must not run as root/,
  );
  assert.throws(
    () => assertInteractiveEnvironment({ platform: "linux", env: {}, getuid: () => 1000 }),
    /requires DISPLAY or WAYLAND_DISPLAY/,
  );
  assert.doesNotThrow(() =>
    assertInteractiveEnvironment({
      platform: "linux",
      env: { WAYLAND_DISPLAY: "wayland-0" },
      getuid: () => 1000,
    }),
  );
});

test("supervision is explicit and unknown, duplicate or positional CLI arguments fail closed", () => {
  assert.deepEqual(parseLaunchArguments([]), { supervised: false });
  assert.deepEqual(parseLaunchArguments(["--supervised"]), { supervised: true });
  for (const args of [
    ["--no-sandbox"],
    ["--supervised", "--supervised"],
    ["password=synthetic"],
    ["--supervised", "--other"],
  ]) {
    assert.throws(() => parseLaunchArguments(args), /^Error: usage:/);
  }
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./launch-dedicated-chrome.mjs", import.meta.url)),
      "--password=synthetic-secret",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /usage:/);
  assert.doesNotMatch(result.stderr, /synthetic-secret/);
});

function simulatedChrome(overrides = {}) {
  const child = new EventEmitter();
  const signalSource = new EventEmitter();
  const ready = Promise.withResolvers();
  const kills = [];
  let options;
  let unreferenced = false;
  let settled = false;
  child.pid = 123;
  child.kill = (signal) => {
    kills.push(signal);
    return true;
  };
  child.unref = () => {
    unreferenced = true;
  };
  const running = runDedicatedChrome({
    executable: "/usr/bin/google-chrome",
    arguments_: buildChromeArguments({ port: 9333, profileDirectory: "/private/profile" }),
    port: 9333,
    supervised: true,
    signalSource,
    spawnFn: (_command, _args, spawnOptions) => {
      options = spawnOptions;
      return child;
    },
    fetchFn: async () => ({
      ok: true,
      json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/browser/secret" }),
    }),
    onReady: ready.resolve,
    ...overrides,
  });
  // Attach rejection handling immediately, including failures before a test awaits readiness.
  const completed = running.then(
    (value) => {
      settled = true;
      return { value };
    },
    (error) => {
      settled = true;
      return { error };
    },
  );
  return {
    child,
    signalSource,
    ready: ready.promise,
    completed,
    kills,
    get options() {
      return options;
    },
    get unreferenced() {
      return unreferenced;
    },
    get settled() {
      return settled;
    },
  };
}

function assertCleanedUp(simulation) {
  assert.equal(simulation.child.listenerCount("exit"), 0);
  assert.equal(simulation.child.listenerCount("error"), 0);
  assert.equal(simulation.signalSource.listenerCount("SIGTERM"), 0);
  assert.equal(simulation.signalSource.listenerCount("SIGINT"), 0);
  assert.equal(simulation.unreferenced, false);
}

test("supervised Chrome remains attached after readiness and returns only on clean exit", async () => {
  const simulation = simulatedChrome();
  assert.deepEqual(await simulation.ready, { port: 9333 });
  assert.equal(simulation.settled, false);
  assert.deepEqual(simulation.options, {
    detached: false,
    shell: false,
    stdio: "ignore",
    windowsHide: false,
  });
  simulation.child.emit("exit", 0, null);
  assert.deepEqual(await simulation.completed, { value: { port: 9333, exitCode: 0 } });
  assert.deepEqual(simulation.kills, []);
  assertCleanedUp(simulation);
});

test("default Chrome remains detached and preserves unrelated child and process listeners", async () => {
  const simulation = simulatedChrome({ supervised: false });
  const external = () => {};
  simulation.child.on("exit", external);
  simulation.child.on("error", external);
  simulation.signalSource.on("SIGTERM", external);
  assert.deepEqual(await simulation.completed, { value: { port: 9333 } });
  assert.equal(simulation.options.detached, true);
  assert.equal(simulation.options.stdio, "ignore");
  assert.equal(simulation.unreferenced, true);
  assert.deepEqual(simulation.child.listeners("exit"), [external]);
  assert.deepEqual(simulation.child.listeners("error"), [external]);
  assert.deepEqual(simulation.signalSource.listeners("SIGTERM"), [external]);
});

test("an exit racing the ready response is observed before declaring readiness", async () => {
  const response = Promise.withResolvers();
  let notified = false;
  const simulation = simulatedChrome({
    fetchFn: () => response.promise,
    onReady: () => {
      notified = true;
    },
  });
  response.resolve({
    ok: true,
    json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/browser/secret" }),
  });
  simulation.child.emit("exit", 17, null);
  assert.equal((await simulation.completed).error.exitCode, 17);
  assert.equal(notified, false);
  assertCleanedUp(simulation);
});

test("child exit cancels the polling interval and leaves no delayed retry", async () => {
  const sleeping = Promise.withResolvers();
  let pollSignal;
  let attempts = 0;
  const simulation = simulatedChrome({
    fetchFn: async () => {
      attempts += 1;
      return { ok: false };
    },
    sleep: (_milliseconds, signal) => {
      pollSignal = signal;
      sleeping.resolve();
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      );
    },
  });
  await sleeping.promise;
  simulation.child.emit("exit", 9, null);
  assert.equal((await simulation.completed).error.exitCode, 9);
  assert.equal(pollSignal.aborted, true);
  assert.equal(attempts, 1);
  assertCleanedUp(simulation);
});

test("supervised Chrome reports a post-readiness crash with its exit code or signal", async () => {
  for (const [code, signal, expected] of [
    [23, null, 23],
    [null, "SIGKILL", 137],
  ]) {
    const simulation = simulatedChrome();
    await simulation.ready;
    simulation.child.emit("exit", code, signal);
    const { error } = await simulation.completed;
    assert.match(error.message, /exited after CDP was ready/);
    assert.equal(error.exitCode, expected);
    assertCleanedUp(simulation);
  }
});

test("supervised Chrome forwards termination once and waits for the child", async () => {
  for (const signal of ["SIGTERM", "SIGINT"]) {
    const simulation = simulatedChrome();
    await simulation.ready;
    simulation.signalSource.emit(signal);
    simulation.signalSource.emit(signal);
    assert.deepEqual(simulation.kills, [signal]);
    assert.equal(simulation.settled, false);
    simulation.child.emit("exit", null, signal);
    assert.deepEqual(await simulation.completed, { value: { port: 9333, exitCode: 0 } });
    assertCleanedUp(simulation);
  }
});

test("supervised Chrome escalates an unresponsive child without abandoning its lifetime", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const simulation = simulatedChrome();
  await simulation.ready;
  simulation.signalSource.emit("SIGTERM");
  context.mock.timers.tick(5_000);
  assert.deepEqual(simulation.kills, ["SIGTERM", "SIGKILL"]);
  assert.equal(simulation.settled, false);
  simulation.child.emit("exit", null, "SIGKILL");
  assert.equal((await simulation.completed).error.exitCode, 137);
  assertCleanedUp(simulation);
});

test("startup exits cancel an outstanding CDP request and remain failures even with code zero", async () => {
  let requestSignal;
  const simulation = simulatedChrome({
    fetchFn: (_url, { signal }) => {
      requestSignal = signal;
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      );
    },
  });
  simulation.child.emit("exit", 0, null);
  const { error } = await simulation.completed;
  assert.match(error.message, /exited before CDP was ready/);
  assert.equal(error.exitCode, 1);
  assert.equal(requestSignal.aborted, true);
  assertCleanedUp(simulation);
});

test("termination during startup cancels polling and completes after child exit", async () => {
  let requestSignal;
  const simulation = simulatedChrome({
    fetchFn: (_url, { signal }) => {
      requestSignal = signal;
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      );
    },
  });
  simulation.signalSource.emit("SIGTERM");
  assert.equal(requestSignal.aborted, true);
  simulation.child.emit("exit", 0, null);
  assert.deepEqual(await simulation.completed, { value: { port: 9333, exitCode: 0 } });
  assertCleanedUp(simulation);
});

test("spawn errors are sanitized and clean up without rejected background promises", async () => {
  const thrown = simulatedChrome({
    spawnFn: () => {
      throw new Error("password=secret");
    },
  });
  assert.equal((await thrown.completed).error.message, "failed to start dedicated Chrome");
  const emitted = simulatedChrome();
  delete emitted.child.pid;
  emitted.child.emit("error", new Error("cookie=secret; stderr=private"));
  assert.equal((await emitted.completed).error.message, "dedicated Chrome process failed");
  assertCleanedUp(emitted);
});

test("a post-readiness process error terminates Chrome and never exposes its message", async () => {
  const simulation = simulatedChrome();
  await simulation.ready;
  simulation.child.emit("error", new Error("cookie=secret; stderr=private"));
  assert.deepEqual(simulation.kills, ["SIGTERM"]);
  assert.equal(simulation.settled, false);
  simulation.child.emit("exit", 0, null);
  assert.equal((await simulation.completed).error.message, "dedicated Chrome process failed");
  assertCleanedUp(simulation);
});

test("CDP startup timeout terminates and reaps the supervised child before rejecting", async () => {
  const simulation = simulatedChrome({ timeoutMs: -1 });
  // Readiness rejection is handled across the race and cleanup promise continuations.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(simulation.kills, ["SIGTERM"]);
  assert.equal(simulation.settled, false);
  simulation.child.emit("exit", 0, null);
  assert.match((await simulation.completed).error.message, /CDP did not become ready/);
  assertCleanedUp(simulation);
});

test("validates the configurable CDP port", () => {
  assert.equal(parseCdpPort(), 9222);
  assert.equal(parseCdpPort("9333"), 9333);
  assert.throws(() => parseCdpPort(""), /integer/);
  assert.throws(() => parseCdpPort("9222.5"), /integer/);
  assert.throws(() => parseCdpPort("65536"), /integer/);
});

test("keeps the launcher port aligned with the exporter CDP URL", () => {
  assert.equal(resolveLaunchCdpPort({ SALESFORCE_CDP_URL: "http://127.0.0.1:9444" }), 9444);
  assert.equal(
    resolveLaunchCdpPort({
      SALESFORCE_CDP_PORT: "9444",
      SALESFORCE_CDP_URL: "http://localhost:9444",
    }),
    9444,
  );
  assert.throws(
    () =>
      resolveLaunchCdpPort({
        SALESFORCE_CDP_PORT: "9222",
        SALESFORCE_CDP_URL: "http://127.0.0.1:9444",
      }),
    /must use the same port/,
  );
  assert.throws(
    () => resolveLaunchCdpPort({ SALESFORCE_CDP_URL: "http:\/\/[::1]:9222" }),
    /requires an IPv4 loopback HTTP CDP URL/,
  );
});

test("discovers only fixed absolute Chrome locations and requires an absolute override", async () => {
  const candidates = chromeExecutableCandidates({
    platform: "win32",
    env: {
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "relative",
      LOCALAPPDATA: "C:\\Users\\operator\\AppData\\Local",
    },
  });
  assert.deepEqual(candidates, [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\operator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
  ]);
  await assert.rejects(
    resolveChromeExecutable({ override: "google-chrome", platform: "linux", env: {} }),
    /absolute executable path/,
  );
  await assert.rejects(
    resolveChromeExecutable({
      override: "",
      platform: "linux",
      env: {},
      inspectExecutable: async () => undefined,
    }),
    /Chrome executable not found/,
  );
});

test("accepts an absolute executable override after checking the file", async (context) => {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "salesforce-chrome-executable-")),
  );
  context.after(() =>
    import("node:fs/promises").then(({ rm }) => rm(directory, { recursive: true })),
  );
  const executable = path.join(directory, "chrome");
  await writeFile(executable, "synthetic executable");
  await chmod(executable, 0o700);
  assert.equal(
    await resolveChromeExecutable({ override: executable, platform: process.platform, env: {} }),
    executable,
  );
});

test("uses private platform-specific profile defaults and rejects relative overrides", () => {
  assert.equal(
    resolveChromeProfileDirectory({
      platform: "linux",
      env: {},
      homeDirectory: "/home/operator",
    }),
    "/home/operator/.local/state/descomplica-crm/salesforce-chrome",
  );
  assert.equal(
    resolveChromeProfileDirectory({
      platform: "darwin",
      env: {},
      homeDirectory: "/Users/operator",
    }),
    "/Users/operator/Library/Application Support/Descomplica CRM/Salesforce Chrome",
  );
  assert.equal(
    resolveChromeProfileDirectory({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\operator\\AppData\\Local" },
      homeDirectory: "C:\\Users\\operator",
    }),
    "C:\\Users\\operator\\AppData\\Local\\Descomplica CRM\\Salesforce Chrome",
  );
  assert.throws(
    () =>
      resolveChromeProfileDirectory({
        override: "personal-profile",
        platform: "linux",
        env: {},
        homeDirectory: "/home/operator",
      }),
    /absolute path/,
  );
});

test("marks a dedicated profile privately and refuses an existing unmarked profile", async (context) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "salesforce-chrome-profile-")));
  context.after(() => import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true })));
  const dedicated = path.join(root, "dedicated");
  assert.equal(await prepareDedicatedProfile(dedicated), dedicated);
  await assertNativePrivatePath(dedicated, 0o700);
  await assertNativePrivatePath(path.join(dedicated, ".descomplica-salesforce-profile"), 0o600);
  assert.match(
    await readFile(path.join(dedicated, ".descomplica-salesforce-profile"), "utf8"),
    /salesforce chrome profile v1/,
  );

  const personal = path.join(root, "personal");
  await mkdir(personal);
  await writeFile(path.join(personal, "Cookies"), "must not be copied or reused");
  await assert.rejects(prepareDedicatedProfile(personal), /unmarked Chrome profile/);
});

test("hardens the dedicated profile ACL before Windows Chrome can write cookies", async () => {
  const profile = "C:\\Users\\operator\\Salesforce Chrome";
  let hardened;
  await protectDedicatedProfileDirectory(profile, {
    platform: "win32",
    hardenWindowsDirectory: async (directory) => {
      hardened = directory;
    },
  });
  assert.equal(hardened, profile);
});

test("builds a visible loopback-only launch without disabling the sandbox", () => {
  const arguments_ = buildChromeArguments({ port: 9222, profileDirectory: "/private/profile" });
  assert.ok(arguments_.includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(arguments_.includes("--remote-debugging-port=9222"));
  assert.ok(arguments_.includes("--user-data-dir=/private/profile"));
  assert.equal(arguments_.at(-1), SALESFORCE_LIGHTNING_URL);
  assert.equal(
    arguments_.some((argument) => argument.includes("headless")),
    false,
  );
  assert.equal(arguments_.includes("--no-sandbox"), false);
  assert.equal(
    arguments_.some((argument) => argument.includes("cookie")),
    false,
  );
});

test("refuses to attach when the requested CDP port is already occupied", async (context) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.equal(typeof address, "object");
  await assert.rejects(assertCdpPortAvailable(address.port), /is already in use/);
});

test("polls the local version endpoint without returning or logging its debugger token", async () => {
  let attempts = 0;
  const requested = [];
  await waitForCdp({
    port: 9222,
    timeoutMs: 1_000,
    sleep: async () => {},
    fetchFn: async (url) => {
      requested.push(url);
      attempts += 1;
      if (attempts === 1) throw new Error("not ready");
      return {
        ok: true,
        json: async () => ({
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/synthetic-secret-token",
        }),
      };
    },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(requested, [
    "http://127.0.0.1:9222/json/version",
    "http://127.0.0.1:9222/json/version",
  ]);
});

test("rejects CDP metadata that advertises a non-loopback debugger", async () => {
  let currentTime = 0;
  await assert.rejects(
    waitForCdp({
      port: 9222,
      timeoutMs: 1,
      now: () => currentTime,
      sleep: async () => {
        currentTime += 1;
      },
      fetchFn: async () => ({
        ok: true,
        json: async () => ({
          webSocketDebuggerUrl: "ws://192.0.2.10:9222/devtools/browser/token",
        }),
      }),
    }),
    /did not become ready on 127\.0\.0\.1:9222/,
  );
});

test("launches with simulated process and CDP dependencies only", async (context) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "salesforce-chrome-launch-")));
  context.after(() => import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true })));
  const executable = path.join(root, "chrome");
  const profile = path.join(root, "profile");
  await writeFile(executable, "synthetic executable");
  await chmod(executable, 0o700);

  let launch;
  let unreferenced = false;
  const child = new EventEmitter();
  child.kill = () => false;
  child.unref = () => {
    unreferenced = true;
  };
  const result = await launchDedicatedChrome({
    platform: process.platform,
    getuid: () => 1000,
    homeDirectory: root,
    env: {
      DISPLAY: ":99",
      SALESFORCE_CHROME_EXECUTABLE: executable,
      SALESFORCE_CHROME_PROFILE: profile,
      SALESFORCE_CDP_PORT: "9333",
    },
    spawnFn: (command, arguments_, options) => {
      launch = { command, arguments_, options };
      return child;
    },
    fetchFn: async () => ({
      ok: true,
      json: async () => ({
        webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/browser/synthetic-token",
      }),
    }),
  });

  assert.deepEqual(result, { port: 9333 });
  assert.equal(launch.command, executable);
  assert.ok(launch.arguments_.includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(launch.arguments_.includes(`--user-data-dir=${profile}`));
  assert.deepEqual(launch.options, {
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: false,
  });
  assert.equal(unreferenced, true);
});
