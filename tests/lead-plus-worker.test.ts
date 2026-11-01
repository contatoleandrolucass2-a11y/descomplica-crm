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

describe("LEAD+ private runtime configuration", () => {
  async function fixture(contents: string) {
    const directory = await mkdtemp(join(tmpdir(), "lead-runtime-json-"));
    const configuration = join(directory, "runtime.json");
    const observed = join(directory, "observed.json");
    const validation = join(directory, "validated");
    const web = join(directory, "web.mjs");
    const worker = join(directory, "worker.mjs");
    const validator = join(directory, "validator.mjs");
    const supervisor = join(directory, "supervisor.mjs");
    await writeFile(configuration, contents, { mode: 0o600 });
    await writeFile(
      validator,
      `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(validation)}, process.env.META_FORM_ROUTES_JSON || '');`,
    );
    await writeFile(
      web,
      `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(observed)},JSON.stringify({routes:process.env.META_FORM_ROUTES_JSON,crm:process.env.SUPABASE_URL,ads:process.env.META_ADS_ACCESS_TOKEN})); setInterval(()=>{},1000);process.on('SIGTERM',()=>process.exit(0));`,
    );
    await writeFile(worker, "setInterval(()=>{},1000);process.on('SIGTERM',()=>process.exit(0));");
    const source = await readFile("deploy/runtime/start-services.mjs", "utf8");
    await writeFile(
      supervisor,
      source
        .replace('"/run/secrets/lead-plus-runtime.json"', JSON.stringify(configuration))
        .replace('"/app/validate-runtime-env.mjs"', JSON.stringify(validator))
        .replace('"/app/server.js"', JSON.stringify(web))
        .replace('"/app/deploy/runtime/lead-plus-worker.mjs"', JSON.stringify(worker)),
    );
    const child = spawn(process.execPath, [supervisor], {
      env: {
        ...process.env,
        LEAD_DB_URL: "",
        SUPABASE_URL: "https://crm-auth.example.test",
        META_ADS_ACCESS_TOKEN: "existing-metrics-token",
      },
      stdio: "pipe",
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream?.on("data", (chunk) => {
        output += String(chunk);
      });
    }
    const completion = closed(child);
    return {
      directory,
      observed,
      validation,
      child,
      completion,
      output: () => output,
      cleanup: async () => {
        if (child.exitCode === null) {
          child.kill("SIGTERM");
          await completion;
        }
        await rm(directory, { recursive: true, force: true });
      },
    };
  }

  it("preserves structured form routes in validation and child environment without logging secrets", async () => {
    const routes = JSON.stringify([
      {
        page_id: "123",
        form_id: "456",
        roles: ["admin", "superintendent", "manager"],
        product: 'Residencial "Teste"',
      },
    ]);
    const marker = "synthetic-private-json-token";
    const runtime = await fixture(
      JSON.stringify({
        LEAD_DB_URL: "postgresql://synthetic-only",
        META_FORM_ROUTES_JSON: routes,
        META_PAGE_ACCESS_TOKEN: marker,
      }),
    );
    try {
      await until(async () => {
        try {
          await readFile(runtime.observed);
          return true;
        } catch {
          return false;
        }
      });
      expect(await readFile(runtime.validation, "utf8")).toBe(routes);
      const observed = JSON.parse(await readFile(runtime.observed, "utf8"));
      expect(observed.routes).toBe(routes);
      expect(observed.crm).toBe("https://crm-auth.example.test");
      expect(observed.ads).toBe("existing-metrics-token");
      expect(runtime.output()).not.toContain(marker);
      expect(runtime.output()).not.toContain(routes);
      runtime.child.kill("SIGTERM");
      expect(await runtime.completion).toBe(0);
    } finally {
      await runtime.cleanup();
    }
  });

  it("rejects malformed JSON before spawning services without echoing its contents", async () => {
    const marker = "synthetic-malformed-private-marker";
    const runtime = await fixture(`{"META_PAGE_ACCESS_TOKEN":"${marker}",`);
    try {
      expect(await runtime.completion).toBe(1);
      expect(runtime.output()).toContain("Invalid LEAD+ runtime configuration JSON");
      expect(runtime.output()).not.toContain(marker);
      await expect(readFile(runtime.observed)).rejects.toThrow();
      await expect(readFile(runtime.validation)).rejects.toThrow();
    } finally {
      await runtime.cleanup();
    }
  });

  it.each(["SUPABASE_URL", "META_ADS_ACCESS_TOKEN"])(
    "rejects %s overrides before validation or service startup",
    async (key) => {
      const marker = "synthetic-disallowed-override-marker";
      const runtime = await fixture(JSON.stringify({ [key]: marker }));
      try {
        expect(await runtime.completion).toBe(1);
        expect(runtime.output()).toContain("Unexpected LEAD+ runtime configuration key");
        expect(runtime.output()).not.toContain(marker);
        await expect(readFile(runtime.observed)).rejects.toThrow();
        await expect(readFile(runtime.validation)).rejects.toThrow();
      } finally {
        await runtime.cleanup();
      }
    },
  );
});
