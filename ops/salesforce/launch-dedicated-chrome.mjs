import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { safeCdpEndpoint } from "./browser-session.mjs";
import { hardenWindowsPrivateDirectory } from "./private-file.mjs";

export const DEFAULT_CDP_PORT = 9222;
export const SALESFORCE_LIGHTNING_URL =
  "https://direcional.lightning.force.com/lightning/page/home";

const PROFILE_MARKER = ".descomplica-salesforce-profile";
const PROFILE_MARKER_CONTENT = "descomplica-crm salesforce chrome profile v1\n";

function pathsFor(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function isAbsoluteForPlatform(value, platform) {
  return typeof value === "string" && pathsFor(platform).isAbsolute(value);
}

export function assertInteractiveEnvironment({
  platform = process.platform,
  env = process.env,
  getuid = process.getuid,
} = {}) {
  if (!["darwin", "linux", "win32"].includes(platform)) {
    throw new Error(`unsupported platform for dedicated Chrome: ${platform}`);
  }
  if (platform !== "linux") return;
  if (typeof getuid === "function" && getuid() === 0) {
    throw new Error(
      "dedicated Chrome must not run as root; --no-sandbox is intentionally unsupported",
    );
  }
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) {
    throw new Error("headed Chrome requires DISPLAY or WAYLAND_DISPLAY on Linux");
  }
}

export function parseCdpPort(value = DEFAULT_CDP_PORT) {
  const normalized = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(normalized) || normalized < 1024 || normalized > 65_535) {
    throw new Error("SALESFORCE_CDP_PORT must be an integer from 1024 to 65535");
  }
  return normalized;
}

export function resolveLaunchCdpPort(environment = process.env) {
  const configuredPort = environment.SALESFORCE_CDP_PORT?.trim();
  const configuredEndpoint = environment.SALESFORCE_CDP_URL?.trim();
  let endpointPort;
  if (configuredEndpoint) {
    const endpoint = new URL(safeCdpEndpoint(configuredEndpoint));
    if (endpoint.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(endpoint.hostname)) {
      throw new Error("dedicated Chrome launcher requires an IPv4 loopback HTTP CDP URL");
    }
    endpointPort = endpoint.port || "80";
  }
  if (
    configuredPort &&
    endpointPort &&
    parseCdpPort(configuredPort) !== parseCdpPort(endpointPort)
  ) {
    throw new Error("SALESFORCE_CDP_PORT and SALESFORCE_CDP_URL must use the same port");
  }
  return parseCdpPort(configuredPort || endpointPort || DEFAULT_CDP_PORT);
}

export function chromeExecutableCandidates({
  platform = process.platform,
  env = process.env,
  homeDirectory = os.homedir(),
} = {}) {
  const pathApi = pathsFor(platform);
  if (platform === "linux") {
    return [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/opt/google/chrome/chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
  }
  if (platform === "darwin") {
    const candidates = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
    if (isAbsoluteForPlatform(homeDirectory, platform)) {
      candidates.push(
        pathApi.join(
          homeDirectory,
          "Applications",
          "Google Chrome.app",
          "Contents",
          "MacOS",
          "Google Chrome",
        ),
      );
    }
    return candidates;
  }
  if (platform === "win32") {
    return [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA]
      .filter((root) => isAbsoluteForPlatform(root, platform))
      .map((root) => pathApi.join(root, "Google", "Chrome", "Application", "chrome.exe"));
  }
  throw new Error(`unsupported platform for dedicated Chrome: ${platform}`);
}

async function usableExecutable(candidate, platform) {
  try {
    const resolved = await realpath(candidate);
    const file = await stat(resolved);
    if (!file.isFile()) return undefined;
    await access(resolved, platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return resolved;
  } catch {
    return undefined;
  }
}

export async function resolveChromeExecutable({
  override,
  platform = process.platform,
  env = process.env,
  homeDirectory = os.homedir(),
  inspectExecutable = usableExecutable,
} = {}) {
  const configuredValue = override ?? env.SALESFORCE_CHROME_EXECUTABLE;
  const configured =
    typeof configuredValue === "string" && configuredValue.trim() === ""
      ? undefined
      : configuredValue;
  if (configured !== undefined) {
    if (!isAbsoluteForPlatform(configured, platform)) {
      throw new Error("SALESFORCE_CHROME_EXECUTABLE must be an absolute executable path");
    }
    const executable = await inspectExecutable(configured, platform);
    if (!executable) {
      throw new Error("SALESFORCE_CHROME_EXECUTABLE is not an executable file");
    }
    return executable;
  }

  for (const candidate of chromeExecutableCandidates({ platform, env, homeDirectory })) {
    const executable = await inspectExecutable(candidate, platform);
    if (executable) return executable;
  }
  throw new Error(
    "Chrome executable not found; set SALESFORCE_CHROME_EXECUTABLE to an absolute path",
  );
}

export function resolveChromeProfileDirectory({
  override,
  platform = process.platform,
  env = process.env,
  homeDirectory = os.homedir(),
} = {}) {
  const pathApi = pathsFor(platform);
  const configuredValue = override ?? env.SALESFORCE_CHROME_PROFILE;
  const configured =
    typeof configuredValue === "string" && configuredValue.trim() === ""
      ? undefined
      : configuredValue;
  if (configured !== undefined) {
    if (!isAbsoluteForPlatform(configured, platform)) {
      throw new Error("SALESFORCE_CHROME_PROFILE must be an absolute path");
    }
    const normalized = pathApi.normalize(configured);
    if (normalized === pathApi.parse(normalized).root) {
      throw new Error("SALESFORCE_CHROME_PROFILE must not be a filesystem root");
    }
    return normalized;
  }

  if (!isAbsoluteForPlatform(homeDirectory, platform)) {
    throw new Error("an absolute home directory is required for the dedicated Chrome profile");
  }
  if (platform === "win32") {
    const localAppData = isAbsoluteForPlatform(env.LOCALAPPDATA, platform)
      ? env.LOCALAPPDATA
      : pathApi.join(homeDirectory, "AppData", "Local");
    return pathApi.join(localAppData, "Descomplica CRM", "Salesforce Chrome");
  }
  if (platform === "darwin") {
    return pathApi.join(
      homeDirectory,
      "Library",
      "Application Support",
      "Descomplica CRM",
      "Salesforce Chrome",
    );
  }
  if (platform === "linux") {
    const stateRoot = isAbsoluteForPlatform(env.XDG_STATE_HOME, platform)
      ? env.XDG_STATE_HOME
      : pathApi.join(homeDirectory, ".local", "state");
    return pathApi.join(stateRoot, "descomplica-crm", "salesforce-chrome");
  }
  throw new Error(`unsupported platform for dedicated Chrome: ${platform}`);
}

export async function protectDedicatedProfileDirectory(
  profileDirectory,
  { platform = process.platform, hardenWindowsDirectory = hardenWindowsPrivateDirectory } = {},
) {
  if (platform === "win32") {
    await hardenWindowsDirectory(profileDirectory);
  } else {
    await chmod(profileDirectory, 0o700);
  }
}

export async function prepareDedicatedProfile(
  profileDirectory,
  { platform = process.platform, hardenWindowsDirectory = hardenWindowsPrivateDirectory } = {},
) {
  if (!isAbsoluteForPlatform(profileDirectory, platform)) {
    throw new Error("dedicated Chrome profile must be an absolute path");
  }
  await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
  const profile = await lstat(profileDirectory);
  if (!profile.isDirectory() || profile.isSymbolicLink()) {
    throw new Error("dedicated Chrome profile must be a real directory");
  }
  await protectDedicatedProfileDirectory(profileDirectory, {
    platform,
    hardenWindowsDirectory,
  });

  const entries = await readdir(profileDirectory);
  const markerPath = pathsFor(platform).join(profileDirectory, PROFILE_MARKER);
  if (!entries.includes(PROFILE_MARKER)) {
    if (entries.length > 0) {
      throw new Error("refusing to use an existing unmarked Chrome profile");
    }
    await writeFile(markerPath, PROFILE_MARKER_CONTENT, { flag: "wx", mode: 0o600 });
  }
  const marker = await lstat(markerPath);
  if (!marker.isFile() || marker.isSymbolicLink()) {
    throw new Error("dedicated Chrome profile marker is invalid");
  }
  if ((await readFile(markerPath, "utf8")) !== PROFILE_MARKER_CONTENT) {
    throw new Error("dedicated Chrome profile marker is invalid");
  }
  if (platform !== "win32") {
    await chmod(markerPath, 0o600);
  }
  return realpath(profileDirectory);
}

export function buildChromeArguments({ port, profileDirectory } = {}) {
  const cdpPort = parseCdpPort(port);
  if (!path.isAbsolute(profileDirectory)) {
    throw new Error("dedicated Chrome profile must be an absolute path");
  }
  return [
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDirectory}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    SALESFORCE_LIGHTNING_URL,
  ];
}

export async function assertCdpPortAvailable(port = DEFAULT_CDP_PORT) {
  const cdpPort = parseCdpPort(port);
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "127.0.0.1", port: cdpPort, exclusive: true }, resolve);
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EADDRINUSE") {
      throw new Error(`SALESFORCE_CDP_PORT ${cdpPort} is already in use`);
    }
    throw error;
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
}

function isExpectedDebuggerUrl(value, port) {
  try {
    const endpoint = new URL(value);
    return (
      endpoint.protocol === "ws:" &&
      endpoint.hostname === "127.0.0.1" &&
      endpoint.port === String(port) &&
      endpoint.username === "" &&
      endpoint.password === "" &&
      endpoint.pathname.startsWith("/devtools/browser/")
    );
  } catch {
    return false;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForCdp({
  port = DEFAULT_CDP_PORT,
  timeoutMs = 30_000,
  intervalMs = 250,
  fetchFn = globalThis.fetch,
  sleep = delay,
  now = Date.now,
} = {}) {
  const cdpPort = parseCdpPort(port);
  const startedAt = now();
  const versionUrl = `http://127.0.0.1:${cdpPort}/json/version`;

  while (now() - startedAt <= timeoutMs) {
    try {
      const response = await fetchFn(versionUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(1_000, Math.max(timeoutMs, 1))),
      });
      if (response.ok) {
        const metadata = await response.json();
        if (isExpectedDebuggerUrl(metadata?.webSocketDebuggerUrl, cdpPort)) return;
      }
    } catch {
      // Chrome is still starting. Never log the endpoint response or debugger token.
    }
    if (now() - startedAt >= timeoutMs) break;
    await sleep(intervalMs);
  }
  throw new Error(`Chrome CDP did not become ready on 127.0.0.1:${cdpPort}`);
}

export async function launchDedicatedChrome({
  env = process.env,
  platform = process.platform,
  getuid = process.getuid,
  homeDirectory = os.homedir(),
  spawnFn = spawn,
  fetchFn = globalThis.fetch,
  sleep,
  now,
  timeoutMs,
} = {}) {
  assertInteractiveEnvironment({ platform, env, getuid });
  const port = resolveLaunchCdpPort(env);
  const executable = await resolveChromeExecutable({ platform, env, homeDirectory });
  const requestedProfile = resolveChromeProfileDirectory({ platform, env, homeDirectory });
  const profileDirectory = await prepareDedicatedProfile(requestedProfile, { platform });
  const arguments_ = buildChromeArguments({ port, profileDirectory });
  await assertCdpPortAvailable(port);

  let child;
  try {
    child = spawnFn(executable, arguments_, {
      detached: true,
      shell: false,
      stdio: "ignore",
      windowsHide: false,
    });
  } catch {
    throw new Error("failed to start dedicated Chrome");
  }

  const failed = new Promise((_, reject) => {
    child.once("error", () => reject(new Error("failed to start dedicated Chrome")));
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `dedicated Chrome exited before CDP was ready (${signal ? "signal" : `code ${code}`})`,
        ),
      );
    });
  });

  try {
    await Promise.race([waitForCdp({ port, timeoutMs, fetchFn, sleep, now }), failed]);
  } catch (error) {
    child.kill();
    throw error;
  }
  child.removeAllListeners("error");
  child.removeAllListeners("exit");
  child.unref();
  return { port };
}

async function main() {
  try {
    const { port } = await launchDedicatedChrome();
    console.log(
      `Chrome dedicado pronto em http://127.0.0.1:${port}. Conclua o login e o MFA na janela aberta.`,
    );
  } catch (error) {
    console.error(
      `Falha ao iniciar o Chrome dedicado: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
