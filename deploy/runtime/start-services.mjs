import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
const configurationFile = "/run/secrets/lead-plus-runtime.json";
if (existsSync(configurationFile)) {
  const metadata = statSync(configurationFile);
  if (!metadata.isFile() || metadata.size > 32768)
    throw new Error("Invalid LEAD+ runtime configuration file.");
  let configuration;
  try {
    configuration = JSON.parse(readFileSync(configurationFile, "utf8"));
  } catch {
    throw new Error("Invalid LEAD+ runtime configuration JSON.");
  }
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    throw new Error("Invalid LEAD+ runtime configuration shape.");
  }
  const allowed = new Set([
    "LEAD_DB_URL",
    "LEAD_DB_PROJECT_REF",
    "LEAD_DB_CA_FILE",
    "WHATSAPP_ORGANIZATION_ID",
    "WHATSAPP_APP_ID",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_CREDENTIAL_KEY",
    "META_APP_ID",
    "META_APP_SECRET",
    "META_VERIFY_TOKEN",
    "META_PAGE_ACCESS_TOKEN",
    "META_PAGE_IDS",
    "META_GRAPH_VERSION",
    "META_CALLBACK_URL",
    "META_REQUIRE_FORM_ROUTE",
    "META_FORM_ROUTES_JSON",
  ]);
  for (const [key, value] of Object.entries(configuration)) {
    if (!allowed.has(key) || typeof value !== "string" || value.includes("\0"))
      throw new Error("Unexpected LEAD+ runtime configuration key.");
    process.env[key] = value;
  }
  const validation = spawnSync(process.execPath, ["/app/validate-runtime-env.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (validation.status !== 0) process.exit(1);
}
const children = new Set();
let stopping = false;
let restartTimer;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  for (const child of children) child.kill(signal);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
function start(path, worker = false) {
  if (stopping) return;
  const child = spawn(process.execPath, [path], { stdio: "inherit", env: process.env });
  children.add(child);
  let settled = false;
  function ended(code) {
    if (settled) return;
    settled = true;
    children.delete(child);
    if (stopping) return;
    if (worker) {
      console.error("LEAD+ worker stopped; retrying without interrupting the CRM.");
      restartTimer = setTimeout(() => start(path, true), 5000);
    } else {
      process.exitCode = code || 1;
      stop();
    }
  }
  child.on("error", () => ended(1));
  child.on("exit", (code) => ended(code));
}
start("/app/server.js");
if (process.env.LEAD_DB_URL) start("/app/deploy/runtime/lead-plus-worker.mjs", true);
