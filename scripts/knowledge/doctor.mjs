import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

function resolvePackage(name) {
  try {
    return require.resolve(`${name}/package.json`);
  } catch {
    return require.resolve(name);
  }
}

function supabaseCli() {
  const manifest = require("supabase/package.json");
  return {
    path: path.resolve(path.dirname(resolvePackage("supabase")), manifest.bin.supabase),
    version: manifest.version,
  };
}

function compatibleScanner(output, major, minimumMinor = 0) {
  const match = output.trim().match(/^(?:osv-scanner version: )?v?(\d+)\.(\d+)\.\d+(?:\s|$)/);
  return !!match && Number(match[1]) === major && Number(match[2]) >= minimumMinor;
}

function probe(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 64 * 1024,
  });
  return { status: result.error ? null : result.status, output: result.stdout ?? "" };
}

export function diagnoseResources({
  nodeVersion = process.version,
  userAgent = process.env.npm_config_user_agent ?? "",
  run = probe,
  resolvePackage: resolve = resolvePackage,
  supabaseCli: cliLocation = supabaseCli,
  browserPath = () => require("@playwright/test").chromium.executablePath(),
  exists = existsSync,
} = {}) {
  const checks = [];
  const add = (name, ready, required = true) =>
    checks.push({ name, status: ready ? "ready" : "unavailable", required });
  add("node-24.19.x", /^v24\.19\.\d+$/.test(nodeVersion));
  add("pnpm-11.20.x", /^pnpm\/11\.20\.\d+(?:\s|$)/.test(userAgent));
  for (const name of ["next", "vitest", "typescript", "@axe-core/playwright"]) {
    try {
      add(name, exists(resolve(name)));
    } catch {
      add(name, false);
    }
  }
  try {
    const cli = cliLocation();
    const result = run(process.execPath, [cli.path, "--version"]);
    add("supabase-cli", result.status === 0 && result.output.trim() === cli.version);
  } catch {
    add("supabase-cli", false);
  }
  try {
    add("playwright-chromium", exists(browserPath()));
  } catch {
    add("playwright-chromium", false);
  }
  for (const [command, args, compatible, required] of [
    ["gitleaks", ["version"], (output) => compatibleScanner(output, 8, 19), true],
    ["osv-scanner", ["--version"], (output) => compatibleScanner(output, 2), true],
    ["docker", ["--version"], (output) => /Docker version\s+\d+\./.test(output), false],
  ]) {
    const result = run(command, args);
    add(command, result.status === 0 && compatible(result.output), required);
  }
  return {
    status: checks.some((item) => item.required && item.status !== "ready")
      ? "incomplete"
      : "ready",
    checks,
    scope:
      "Presenca local, Supabase CLI executavel e scanners compativeis; nao comprova testes, daemon Docker, autenticacao de plugins ou telemetria. O CLI Supabase pode consultar atualizacoes.",
    connections:
      "Conferir ferramentas expostas e acesso ao projeto no chat, somente quando pertinentes.",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = diagnoseResources();
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "ready" ? 0 : 1;
}
