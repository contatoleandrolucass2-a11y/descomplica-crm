import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export const localUrlPatterns = [
  "http://127.0.0.1:*/*",
  "http://localhost:*/*",
  "ws://127.0.0.1:*/*",
  "ws://localhost:*/*",
];

export const servers = {
  next: {
    package: "next-devtools-mcp",
    version: "0.4.0",
    tools: ["nextjs_index", "nextjs_call", "nextjs_docs"],
    args: [],
  },
  chrome: {
    package: "chrome-devtools-mcp",
    version: "1.10.1",
    tools: [
      "list_pages",
      "new_page",
      "navigate_page",
      "close_page",
      "list_console_messages",
      "get_console_message",
      "list_network_requests",
      "get_network_request",
      "performance_start_trace",
      "performance_stop_trace",
      "performance_analyze_insight",
    ],
    args: [
      "--headless",
      "--isolated",
      "--no-performance-crux",
      "--no-usage-statistics",
      "--redact-network-headers",
      "--no-javascript-evaluation",
      "--no-category-input",
      "--no-category-emulation",
      "--no-category-memory",
      "--no-category-extensions",
      "--no-category-experimental-third-party",
      "--no-category-experimental-webmcp",
      "--no-category-pwa",
      ...localUrlPatterns.map((pattern) => `--allowed-url-pattern=${pattern}`),
    ],
  },
};

// Allow only OS/runtime essentials; never inherit app tokens, proxies or Node hooks.
const environmentKeys = new Set([
  "PATH",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
  "LANG",
  "LC_ALL",
  "TZ",
]);

export function devtoolsEnvironment(source = process.env) {
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key, value]) => environmentKeys.has(key.toUpperCase()) && typeof value === "string",
    ),
  );
  return {
    ...env,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_DEVTOOLS_HOST: "127.0.0.1",
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
    CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
  };
}

export function resolveRuntime({
  version = process.version,
  executable = process.execPath,
  platform = process.platform,
  env = process.env,
  exists = existsSync,
  probe = spawnSync,
} = {}) {
  if (/^v24\.19\.\d+$/.test(version)) return executable;
  if (platform === "win32" && env.LOCALAPPDATA) {
    const bundled = path.win32.join(
      env.LOCALAPPDATA,
      "Codex",
      "runtimes",
      "node-v24.19.0-win-x64",
      "node.exe",
    );
    if (exists(bundled)) {
      const result = probe(bundled, ["--version"], {
        encoding: "utf8",
        env: devtoolsEnvironment(env),
        shell: false,
        windowsHide: true,
        timeout: 5_000,
      });
      if (result.status === 0 && /^v24\.19\.\d+$/.test(result.stdout.trim())) return bundled;
    }
  }
  throw new Error("Devtools requer Node 24.19.x no PATH ou o runtime bundled do Codex no Windows.");
}

export function resolveServer(name) {
  const server = Object.hasOwn(servers, name) ? servers[name] : undefined;
  if (!server)
    throw new Error(
      "Uso: node scripts/knowledge/devtools.mjs <next|chrome> (sem argumentos adicionais).",
    );
  const manifestPath = require.resolve(`${server.package}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== server.version || !manifest.bin?.[server.package]) {
    throw new Error(
      `Instale ${server.package}@${server.version} com pnpm install --frozen-lockfile.`,
    );
  }
  return { ...server, bin: path.resolve(path.dirname(manifestPath), manifest.bin[server.package]) };
}

export function launchServer(name) {
  const server = resolveServer(name);
  const runtime = resolveRuntime();
  const env = devtoolsEnvironment();
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  env[pathKey] = [path.dirname(runtime), env[pathKey]].filter(Boolean).join(path.delimiter);
  const child = spawn(runtime, [server.bin, ...server.args], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.once("exit", stop);
  child.once("error", () => {
    console.error(`Falha ao iniciar ${server.package}; confira o runtime e pnpm install.`);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    process.removeListener("exit", stop);
    process.exitCode = code ?? 1;
  });
  return child;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Use apenas next ou chrome; flags extras nao sao permitidas.");
    launchServer(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
