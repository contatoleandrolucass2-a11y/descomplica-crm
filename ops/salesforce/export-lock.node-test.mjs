import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { test } from "node:test";
import { promisify } from "node:util";

import { acquireExportLock } from "./export-lock.mjs";
import { assertPrivateRegularFile } from "./private-file.mjs";

const execFileAsync = promisify(execFile);

async function outputFor(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-export-lock-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path.join(directory, "candidate.json");
}

test("exclusive private lock prevents another process and releases only its own file", async (t) => {
  const output = await outputFor(t);
  const release = await acquireExportLock(output);
  const lockPath = `${output}.lock`;
  await assertPrivateRegularFile(lockPath);
  const content = await readFile(lockPath, "utf8");
  assert.deepEqual(Object.keys(JSON.parse(content)), ["owner", "pid"]);
  const script = `
    import { acquireExportLock } from ${JSON.stringify(new URL("./export-lock.mjs", import.meta.url).href)};
    try { await acquireExportLock(process.argv[1]); process.exitCode = 9; }
    catch (error) { process.stdout.write(error.code); }
  `;
  const result = await execFileAsync(
    process.execPath,
    ["--input-type=module", "--eval", script, output],
    { windowsHide: true, timeout: 10_000 },
  );
  assert.equal(result.stdout, "SALESFORCE_EXPORT_LOCKED");
  assert.equal(await readFile(lockPath, "utf8"), content);
  await release();
  await release();
  await assert.rejects(stat(lockPath), { code: "ENOENT" });
  const next = await acquireExportLock(output);
  await next();
});

test("ambiguous or old locks are never deleted using PID or TTL heuristics", async (t) => {
  const output = await outputFor(t);
  const lockPath = `${output}.lock`;
  await writeFile(lockPath, "ambiguous owner", { mode: 0o600 });
  await utimes(lockPath, new Date("2000-01-01"), new Date("2000-01-01"));
  await assert.rejects(acquireExportLock(output), { code: "SALESFORCE_EXPORT_LOCKED" });
  assert.equal(await readFile(lockPath, "utf8"), "ambiguous owner");
});

test("release preserves a lock whose ownership token was replaced", async (t) => {
  const output = await outputFor(t);
  const release = await acquireExportLock(output);
  await writeFile(`${output}.lock`, "different-owner");
  await assert.rejects(release(), { code: "SALESFORCE_LOCK_OWNERSHIP" });
  assert.equal(await readFile(`${output}.lock`, "utf8"), "different-owner");
});

test("failed private-file hardening fails closed and cleans up only the acquired file", async (t) => {
  const output = await outputFor(t);
  await assert.rejects(
    acquireExportLock(output, {
      privateFileOptions: {
        platform: "win32",
        hardenWindowsAcl: async () => {
          throw new Error("PRIVATE");
        },
      },
    }),
    { code: "SALESFORCE_LOCK_ERROR" },
  );
  await assert.rejects(stat(`${output}.lock`), { code: "ENOENT" });
});
