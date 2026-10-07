import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import {
  SALESFORCE_LIGHTNING_URL,
  assertCdpPortAvailable,
  assertInteractiveEnvironment,
  buildChromeArguments,
  chromeExecutableCandidates,
  launchDedicatedChrome,
  parseCdpPort,
  prepareDedicatedProfile,
  protectDedicatedProfileDirectory,
  resolveChromeExecutable,
  resolveChromeProfileDirectory,
  resolveLaunchCdpPort,
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
    resolveChromeExecutable({ override: "", platform: "linux", env: {} }),
    /Chrome executable not found/,
  );
});

test("accepts an absolute executable override after checking the file", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "salesforce-chrome-executable-"));
  context.after(() =>
    import("node:fs/promises").then(({ rm }) => rm(directory, { recursive: true })),
  );
  const executable = path.join(directory, "chrome");
  await writeFile(executable, "synthetic executable");
  await chmod(executable, 0o700);
  assert.equal(
    await resolveChromeExecutable({ override: executable, platform: "linux", env: {} }),
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
  const root = await mkdtemp(path.join(tmpdir(), "salesforce-chrome-profile-"));
  context.after(() => import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true })));
  const dedicated = path.join(root, "dedicated");
  assert.equal(await prepareDedicatedProfile(dedicated), dedicated);
  assert.equal((await stat(dedicated)).mode & 0o777, 0o700);
  assert.equal(
    (await stat(path.join(dedicated, ".descomplica-salesforce-profile"))).mode & 0o777,
    0o600,
  );
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
  const root = await mkdtemp(path.join(tmpdir(), "salesforce-chrome-launch-"));
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
    platform: "linux",
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
