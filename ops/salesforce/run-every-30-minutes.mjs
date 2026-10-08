import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;
const MINIMUM_INTERVAL_MS = 60_000;

function log(message, details = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), message, ...details })}\n`,
  );
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function intervalMs() {
  const raw = process.env.SALESFORCE_RUN_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < MINIMUM_INTERVAL_MS) {
    throw new Error("SALESFORCE_RUN_INTERVAL_MS must be an integer >= 60000");
  }
  return parsed;
}

function ingestUrl() {
  const explicit = process.env.SALESFORCE_CRM_INGEST_URL;
  if (explicit) return new URL(explicit);

  const origin = requiredEnvironment("APP_ORIGIN");
  return new URL("/api/ingest/salesforce", origin);
}

function runNode(script, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`export candidate failed: ${signal ?? code}`));
    });
  });
}

async function postSnapshot(url, payload, secret) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`ingest failed with ${response.status}: ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function runOnce() {
  const directory = await mkdtemp(path.join(tmpdir(), "descomplica-salesforce-"));
  const outputPath = path.join(directory, "candidate.json");
  try {
    await runNode(fileURLToPath(new URL("./export-candidate.mjs", import.meta.url)), {
      SALESFORCE_CANDIDATE_OUTPUT: outputPath,
    });
    const candidate = JSON.parse(await readFile(outputPath, "utf8"));
    const payload = candidate.payload;
    if (!payload || payload.schemaVersion !== 2) {
      throw new Error("candidate payload is missing or invalid");
    }
    const result = await postSnapshot(
      ingestUrl(),
      payload,
      requiredEnvironment("SALESFORCE_INGEST_SECRET"),
    );
    log("salesforce snapshot ingested", {
      requestId: payload.requestId,
      status: result?.status ?? null,
      recordCount: result?.recordCount ?? null,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const interval = intervalMs();
  const runContinuously = process.env.SALESFORCE_RUN_ONCE !== "true";
  log("salesforce scheduler started", { intervalMs: interval, runContinuously });

  do {
    const startedAt = Date.now();
    try {
      await runOnce();
    } catch (error) {
      log("salesforce scheduler cycle failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!runContinuously) throw error;
    }

    if (!runContinuously) break;
    const waitMs = Math.max(0, interval - (Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  } while (true);
}

main().catch((error) => {
  log("salesforce scheduler failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
