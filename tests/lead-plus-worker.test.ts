import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

async function until(predicate: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 3000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw Error("Synthetic runtime did not reach the expected state.");
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}
function closed(child: ChildProcess) {
  return new Promise<number | null>((resolve) => child.once("close", resolve));
}

describe("LEAD+ worker supervision", () => {
  it("restarts a crashed worker while preserving the web server and terminates both on shutdown", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lead-supervisor-"));
    const trace = join(directory, "trace");
    await writeFile(trace, "");
    const web = join(directory, "web.mjs");
    const worker = join(directory, "worker.mjs");
    const supervisor = join(directory, "supervisor.mjs");
    await writeFile(
      web,
      `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(trace)}, 'web:'+process.pid+'\\n'); setInterval(()=>{},1000); process.on('SIGTERM',()=>{appendFileSync(${JSON.stringify(trace)},'web-stopped\\n');process.exit(0)});`,
    );
    await writeFile(
      worker,
      `import {appendFileSync} from 'node:fs'; appendFileSync(${JSON.stringify(trace)}, 'worker:'+process.pid+'\\n'); process.exit(1);`,
    );
    const source = await readFile("deploy/runtime/start-services.mjs", "utf8");
    await writeFile(
      supervisor,
      source
        .replace('"/app/server.js"', JSON.stringify(web))
        .replace('"/app/deploy/runtime/lead-plus-worker.mjs"', JSON.stringify(worker))
        .replace(", 5000)", ", 50)"),
    );
    const child = spawn(process.execPath, [supervisor], {
      env: { ...process.env, LEAD_DB_URL: "synthetic-only" },
      stdio: "pipe",
    });
    const completion = closed(child);
    let output = "";
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    try {
      await until(async () => (await readFile(trace, "utf8")).split("worker:").length >= 3);
      const before = await readFile(trace, "utf8");
      expect(before.match(/web:/gu)).toHaveLength(1);
      expect(before).not.toContain("web-stopped");
      expect(child.exitCode).toBeNull();
      expect(output).toContain("without interrupting the CRM");
      child.kill("SIGTERM");
      expect(await completion).toBe(0);
      expect(await readFile(trace, "utf8")).toContain("web-stopped");
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      const contents = await readFile(trace, "utf8");
      for (const match of contents.matchAll(/(?:web|worker):(\d+)/gu)) {
        try {
          process.kill(Number(match[1]), "SIGTERM");
        } catch {
          /* Process already exited. */
        }
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sanitizes startup errors instead of printing private database details", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lead-worker-errors-"));
    const shim = join(directory, "runtime.mjs");
    const worker = join(directory, "worker.mjs");
    const marker = "synthetic-private-database-detail";
    await writeFile(
      shim,
      `export function getLeadPlusStore(){throw Error(${JSON.stringify(marker)})} export async function tickLeadPlus(){}`,
    );
    const source = await readFile("deploy/runtime/lead-plus-worker.mjs", "utf8");
    await writeFile(
      worker,
      source
        .replace(
          '"../../lib/crm/lead-plus/server/runtime.mjs"',
          JSON.stringify(pathToFileURL(shim).href),
        )
        .replace(", 1000)", ", 20)"),
    );
    const child = spawn(process.execPath, [worker], { stdio: "pipe" });
    const completion = closed(child);
    let output = "";
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });
    try {
      await until(() => output.includes("persisted events remain queued"));
      child.kill("SIGTERM");
      expect(await completion).toBe(0);
      expect(output).not.toContain(marker);
      expect(output).not.toContain("Error:");
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await rm(directory, { recursive: true, force: true });
    }
  });
});
