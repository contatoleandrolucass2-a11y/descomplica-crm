import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import * as devtools from "../scripts/knowledge/devtools.mjs";
// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import { checkServer } from "../scripts/knowledge/devtools-check.mjs";

const {
  devtoolsEnvironment,
  localUrlPatterns,
  projectRoot,
  resolveRuntime,
  resolveServer,
  servers,
} = devtools;

it("drops secrets, remote host overrides, proxy settings and runtime injection", () => {
  const env = devtoolsEnvironment({
    Path: "C:\\runtime",
    SystemRoot: "C:\\Windows",
    HOME: "/home/test",
    TEMP: "/tmp",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-secret",
    OPENAI_API_KEY: "synthetic-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://remote.invalid",
    HTTP_PROXY: "http://proxy.invalid",
    HTTPS_PROXY: "http://proxy.invalid",
    NODE_OPTIONS: "--require=untrusted.cjs",
    NODE_EXTRA_CA_CERTS: "/tmp/untrusted.pem",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    NEXT_DEVTOOLS_HOST: "remote.invalid",
    NEXT_TELEMETRY_DISABLED: "0",
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "0",
    CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "0",
  });
  expect(env).toEqual({
    Path: "C:\\runtime",
    SystemRoot: "C:\\Windows",
    HOME: "/home/test",
    TEMP: "/tmp",
    NEXT_DEVTOOLS_HOST: "127.0.0.1",
    NEXT_TELEMETRY_DISABLED: "1",
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
    CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
  });
});

it.each(["linux", "win32"])("uses the required runtime on %s", (platform) => {
  expect(resolveRuntime({ version: "v24.19.1", executable: "/runtime/node", platform })).toBe(
    "/runtime/node",
  );
});

it("probes the bundled Windows fallback without shell or inherited secrets", () => {
  const calls: unknown[][] = [];
  const result = resolveRuntime({
    version: "v25.7.0",
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Test User\\AppData\\Local", NODE_OPTIONS: "unsafe" },
    exists: () => true,
    probe: (...args: unknown[]) => {
      calls.push(args);
      return { status: 0, stdout: "v24.19.0\n" };
    },
  });
  expect(result).toBe(
    "C:\\Users\\Test User\\AppData\\Local\\Codex\\runtimes\\node-v24.19.0-win-x64\\node.exe",
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]?.[2]).toMatchObject({ shell: false, windowsHide: true, timeout: 5_000 });
  expect((calls[0]?.[2] as { env: object }).env).not.toHaveProperty("NODE_OPTIONS");
});

it("fails closed when the required runtime is missing or incompatible", () => {
  expect(() => resolveRuntime({ version: "v25.7.0", platform: "linux" })).toThrow("24.19.x");
  expect(() => resolveRuntime({ version: "v22.0.0", platform: "win32", env: {} })).toThrow(
    "24.19.x",
  );
  expect(() =>
    resolveRuntime({
      version: "v25.7.0",
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Local" },
      exists: () => true,
      probe: () => ({ status: 0, stdout: "v25.7.0" }),
    }),
  ).toThrow("24.19.x");
});

it.each([
  "http://127.0.0.1:3000/a",
  "http://localhost:4000/",
  "ws://127.0.0.1:3000/_next/webpack-hmr",
  "ws://localhost:3000/hmr",
])("allows development loopback: %s", (url) => {
  expect(localUrlPatterns.some((pattern: string) => new URLPattern(pattern).test(url))).toBe(true);
});

it.each([
  "https://example.com/",
  "http://localhost.evil.invalid:3000/",
  "http://127.0.0.1.evil.invalid/",
  "http://localhost@evil.invalid/",
  "http://192.168.0.2:3000/",
  "http://0.0.0.0:3000/",
  "file:///etc/passwd",
  "data:text/html,private",
  "javascript:alert(1)",
  "chrome://extensions/",
])("rejects non-loopback and special URLs: %s", (url) => {
  expect(localUrlPatterns.some((pattern: string) => new URLPattern(pattern).test(url))).toBe(false);
});

it("resolves the exact local bins and rejects unknown servers", () => {
  const manifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  for (const name of ["next", "chrome"]) {
    const server = resolveServer(name);
    expect(manifest.devDependencies[server.package]).toBe(server.version);
    expect(readFileSync(server.bin, "utf8")).toContain("#!/usr/bin/env node");
  }
  expect(() => resolveServer("toString")).toThrow("Uso:");
  expect(() => resolveServer("unknown")).toThrow("Uso:");
});

it("the published Chrome parser accepts all hardening flags", async () => {
  const server = resolveServer("chrome");
  const moduleUrl = pathToFileURL(
    path.resolve(path.dirname(server.bin), "../config/mcp-options.js"),
  );
  const { parseArguments } = await import(moduleUrl.href);
  const args = parseArguments(server.version, [process.execPath, server.bin, ...server.args], {});
  expect(args).toMatchObject({
    headless: true,
    isolated: true,
    performanceCrux: false,
    usageStatistics: false,
    redactNetworkHeaders: true,
    javascriptEvaluation: false,
    categoryInput: false,
    categoryEmulation: false,
    categoryMemory: false,
    categoryExtensions: false,
    categoryExperimentalThirdParty: false,
    categoryExperimentalWebmcp: false,
    categoryPwa: false,
    allowedUrlPattern: localUrlPatterns,
  });
  for (const key of [
    "autoConnect",
    "browserUrl",
    "wsEndpoint",
    "wsHeaders",
    "userDataDir",
    "proxyServer",
    "acceptInsecureCerts",
    "chromeArg",
    "config",
  ]) {
    expect(args[key]).toBeUndefined();
  }
});

it("keeps the project config restricted to the verified tool allowlists", () => {
  const config = readFileSync(path.join(projectRoot, ".codex/config.toml"), "utf8");
  const sections = config.split(/(?=\[mcp_servers\.)/).slice(1);
  expect(sections).toHaveLength(2);
  for (const [index, name] of ["next", "chrome"].entries()) {
    const section = sections[index]!;
    expect(section).toContain(`[mcp_servers.${name}-devtools]`);
    expect(section).toContain('command = "node"');
    expect(section).toContain(`args = ["scripts/knowledge/devtools.mjs", "${name}"]`);
    expect(section).toContain("startup_timeout_sec = 30");
    // The allowlists deliberately use JSON-compatible TOML arrays.
    const list = section.match(/enabled_tools\s*=\s*(\[[\s\S]*?\])/)?.[1];
    expect(JSON.parse(list!)).toEqual(servers[name].tools);
  }
  expect(config).not.toMatch(/^\s*(approval_policy|sandbox_mode|trust_level|env_vars|cwd)\s*=/m);
});

it.each(["next", "chrome"])(
  "boots %s and negotiates initialize/tools/list without a browser or dev server",
  async (name) => {
    const result = await checkServer(name);
    expect(result.version).toBe(servers[name].version);
    expect(result.enabledTools).toEqual(servers[name].tools);
    if (name === "next")
      expect(result.docs).toMatchObject({ status: "use_bundled_docs", docsAvailable: true });
    if (name === "chrome") {
      expect(result.availableTools).not.toEqual(expect.arrayContaining(["evaluate_script"]));
      expect(
        result.availableTools.some((tool: string) => /webmcp|extension|third_party/.test(tool)),
      ).toBe(false);
    }
  },
  45_000,
);
