import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const script = path.resolve("scripts/knowledge/obsidian.mjs");
const names = ["CONTEXTO.md", "FERRAMENTAS.md", "ATUALIZACOES.md"];
const temporaryRoots: string[] = [];

vi.setConfig({ testTimeout: 30_000 });

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "crm-knowledge-")));
  temporaryRoots.push(root);
  const repo = path.join(root, "project with spaces");
  const vault = path.join(root, "vault with spaces");
  const docs = path.join(repo, "docs", "knowledge");
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(root, "gitconfig"),
  };
  await writeFile(env.GIT_CONFIG_GLOBAL, "");
  await mkdir(docs, { recursive: true });
  await mkdir(path.join(vault, ".obsidian"), { recursive: true });
  for (const name of names)
    await writeFile(path.join(docs, name), `# ${name}\n\nConhecimento sintetico.\n`);
  const git = (args: string[], cwd = repo) => {
    const result = spawnSync("git", args, { cwd, env, encoding: "utf8", windowsHide: true });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  git(["init", "--initial-branch=main"]);
  git(["config", "user.name", "Knowledge Test"]);
  git(["config", "user.email", "knowledge@example.invalid"]);
  git(["add", "."]);
  git(["commit", "-m", "test: fixture"]);
  const run = (args: string[], cwd = repo) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd,
      env,
      encoding: "utf8",
      windowsHide: true,
    });
  const install = () => {
    const result = run(["install", "--vault", vault]);
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as { worktree: string };
  };
  const base = path.join(vault, "08 Projetos", "DESCOMPLICA-CRM", "Automatico");
  return { root, repo, vault, docs, git, run, install, base, env };
}

describe("local Obsidian project knowledge", () => {
  it("reports an unconfigured host without creating files", async () => {
    const f = await fixture();
    expect(JSON.parse(f.run(["sync"]).stdout).status).toBe("not-configured");
    expect(await readdir(f.vault)).toEqual([".obsidian"]);
    expect(f.run(["context"]).stdout).toContain("CONTEXTO.md");
  });

  it("installs shared hooks, exports only curated notes and is idempotent", async () => {
    const f = await fixture();
    await writeFile(path.join(f.repo, ".env.local"), "DO_NOT_EXPORT=private-canary");
    await writeFile(path.join(f.vault, "Minha nota.md"), "Preservar");
    const { worktree } = f.install();
    const note = path.join(f.base, "Worktrees", worktree, "Estado.md");
    const before = await readFile(note, "utf8");
    expect(JSON.parse(f.run(["sync"]).stdout).status).toBe("unchanged");
    expect(await readFile(note, "utf8")).toBe(before);
    expect(await readdir(path.join(f.base, "Atualizacoes"))).toHaveLength(1);
    expect(await readFile(path.join(f.vault, "Minha nota.md"), "utf8")).toBe("Preservar");
    for (const name of names) {
      const content = await readFile(path.join(f.base, "Worktrees", worktree, name), "utf8");
      expect(content).toContain("Conhecimento sintetico");
      expect(content).not.toContain("private-canary");
    }
    for (const name of ["post-commit", "post-merge", "post-checkout", "post-rewrite"]) {
      expect(await readFile(path.join(f.repo, ".git", "hooks", name), "utf8")).toContain(
        "descomplica-crm-knowledge-v1",
      );
    }
  });

  it("executes the real post-commit hook and keeps new states in history", async () => {
    const f = await fixture();
    const { worktree } = f.install();
    await writeFile(path.join(f.docs, "ATUALIZACOES.md"), "# Aprendizado novo\n");
    f.git(["add", "."]);
    f.git(["commit", "-m", "test: knowledge update"]);
    expect(
      await readFile(path.join(f.base, "Worktrees", worktree, "ATUALIZACOES.md"), "utf8"),
    ).toContain("Aprendizado novo");
    expect(await readdir(path.join(f.base, "Atualizacoes"))).toHaveLength(2);
  });

  it("shares the installation with linked worktrees and supports subdirectories", async () => {
    const f = await fixture();
    const first = f.install();
    const other = path.join(f.root, "second checkout");
    f.git(["worktree", "add", "-b", "other", other]);
    const result = f.run(["sync"], path.join(other, "docs"));
    expect(result.status, result.stderr).toBe(0);
    const second = JSON.parse(result.stdout) as { worktree: string };
    expect(second.worktree).not.toBe(first.worktree);
    expect(await readdir(path.join(f.base, "Worktrees"))).toHaveLength(2);
  });

  it("uses labelled reference documents for an older branch", async () => {
    const f = await fixture();
    const { worktree } = f.install();
    await rename(f.docs, path.join(f.repo, "older-docs"));
    const result = f.run(["sync"]);
    expect(result.status, result.stderr).toBe(0);
    expect(
      await readFile(path.join(f.base, "Worktrees", worktree, "CONTEXTO.md"), "utf8"),
    ).toContain("Referencia instalada");
  });

  it("preserves a manual edit and refuses to overwrite it", async () => {
    const f = await fixture();
    const { worktree } = f.install();
    const target = path.join(f.base, "Worktrees", worktree, "CONTEXTO.md");
    await writeFile(target, (await readFile(target, "utf8")) + "Minha edicao\n");
    const result = f.run(["sync"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preservada");
    expect(await readFile(target, "utf8")).toContain("Minha edicao");
  });

  it("recreates a missing generated document", async () => {
    const f = await fixture();
    const { worktree } = f.install();
    const target = path.join(f.base, "Worktrees", worktree, "CONTEXTO.md");
    await rm(target);
    expect(f.run(["sync"]).status).toBe(0);
    expect(await readFile(target, "utf8")).toContain("Conhecimento sintetico");
  });

  it("rejects possible credentials before changing exported notes", async () => {
    const f = await fixture();
    const { worktree } = f.install();
    const target = path.join(f.base, "Worktrees", worktree, "ATUALIZACOES.md");
    const before = await readFile(target, "utf8");
    const canary = "ghp_" + "x".repeat(30);
    await writeFile(path.join(f.docs, "ATUALIZACOES.md"), canary);
    const result = f.run(["sync"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Possivel credencial");
    expect(result.stderr).not.toContain(canary);
    expect(await readFile(target, "utf8")).toBe(before);
  });

  it("preserves existing Git hooks and custom hook configuration", async () => {
    const f = await fixture();
    const target = path.join(f.repo, ".git", "hooks", "post-commit");
    await writeFile(target, "#!/bin/sh\n# Existing hook\n");
    expect(f.run(["install", "--vault", f.vault]).status).toBe(1);
    expect(await readFile(target, "utf8")).toContain("Existing hook");
    f.git(["config", "core.hooksPath", "custom-hooks"]);
    expect(f.run(["install", "--vault", f.vault]).stderr).toContain("core.hooksPath existente");
  });

  it("rejects a vault inside the repository", async () => {
    const f = await fixture();
    const nested = path.join(f.repo, "vault");
    await mkdir(path.join(nested, ".obsidian"), { recursive: true });
    expect(f.run(["install", "--vault", nested]).stderr).toContain("fora do repositorio");
  });

  it("rejects destination directory links without writing outside the vault", async () => {
    const f = await fixture();
    f.install();
    const outside = path.join(f.root, "outside");
    await mkdir(outside);
    await rename(f.base, path.join(f.root, "preserved-export"));
    await symlink(outside, f.base, process.platform === "win32" ? "junction" : "dir");
    expect(f.run(["sync"]).stderr).toContain("Link simbolico recusado");
    expect(await readdir(outside)).toEqual([]);
  });

  it("does not trust a valid-looking foreign note at a generated destination", async () => {
    const f = await fixture();
    const id = createHash("sha256").update(path.resolve(f.repo)).digest("hex").slice(0, 16);
    const folder = path.join(f.base, "Worktrees", id);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "Estado.md"), "Nota pessoal");
    expect(f.run(["install", "--vault", f.vault]).status).toBe(1);
    expect(await readFile(path.join(folder, "Estado.md"), "utf8")).toBe("Nota pessoal");
  });

  it("serializes simultaneous synchronizations without duplicate history", async () => {
    const f = await fixture();
    f.install();
    await writeFile(path.join(f.docs, "ATUALIZACOES.md"), "# Mudanca concorrente\n");
    const start = () =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [script, "sync"], {
          cwd: f.repo,
          env: f.env,
          windowsHide: true,
        });
        let output = "";
        let error = "";
        child.stdout.on("data", (chunk) => {
          output += chunk;
        });
        child.stderr.on("data", (chunk) => {
          error += chunk;
        });
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolve(JSON.parse(output).status) : reject(new Error(error)),
        );
      });
    expect((await Promise.all([start(), start()])).sort()).toEqual(["synced", "unchanged"]);
    expect(await readdir(path.join(f.base, "Atualizacoes"))).toHaveLength(2);
  });

  it("rejects source directory links instead of exporting their contents", async () => {
    const f = await fixture();
    f.install();
    const outside = path.join(f.root, "outside-documents");
    await rename(f.docs, outside);
    await symlink(outside, f.docs, process.platform === "win32" ? "junction" : "dir");
    expect(f.run(["sync"]).stderr).toContain("Link simbolico recusado");
  });
});
