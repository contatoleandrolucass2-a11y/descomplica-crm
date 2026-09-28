import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = "08 Projetos/DESCOMPLICA-CRM/Automatico";
const documentNames = ["CONTEXTO.md", "FERRAMENTAS.md", "ATUALIZACOES.md"];
const hookNames = ["post-commit", "post-merge", "post-checkout", "post-rewrite"];
const marker = "descomplica-crm-knowledge-v1";
const ownFile = fileURLToPath(import.meta.url);
const hash = (value) => createHash("sha256").update(value).digest("hex");

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  }).trim();
}

async function plainPath(target) {
  let current = path.resolve(target);
  while (true) {
    const info = await fs.lstat(current).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (info?.isSymbolicLink()) throw new Error("Link simbolico recusado.");
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function readOptional(target) {
  await plainPath(target);
  return fs.readFile(target, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
}

async function atomicWrite(target, text) {
  await plainPath(target);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, text, { flag: "wx" });
    await fs.rename(temporary, target);
  } finally {
    await fs.unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function guardedText(body) {
  return `<!-- ${marker} sha256:${hash(body)} -->\n${body}`;
}

function checkManaged(text) {
  const [header, ...lines] = text.split("\n");
  if (header !== `<!-- ${marker} sha256:${hash(lines.join("\n"))} -->`) {
    throw new Error(
      "Nota existente ou editada manualmente preservada; reconciliar antes de sincronizar.",
    );
  }
}

async function writeManaged(target, body) {
  const current = await readOptional(target);
  if (current !== null) checkManaged(current);
  const next = guardedText(body);
  if (current === next) return;
  await atomicWrite(target, next);
}

function checkSafe(text) {
  // Only curated documents are exported; this is an extra guard, not a DLP guarantee.
  if (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sb_secret_|sk-proj-)[\w-]{12,}|\beyJ[\w-]{12,}\.[\w-]{12,}\.[\w-]+|(?:password|senha|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token)\s*[:=]\s*["']?[^\s"']{8,}/i.test(
      text,
    )
  ) {
    throw new Error(
      "Possivel credencial nos documentos; exportacao recusada sem imprimir conteudo.",
    );
  }
}

async function repository(cwd) {
  const rootPath = git(cwd, ["rev-parse", "--show-toplevel"]);
  await plainPath(rootPath);
  const root = await fs.realpath(rootPath);
  const commonPath = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  await plainPath(commonPath);
  const common = await fs.realpath(commonPath);
  return { root, common, home: path.join(common, "descomplica-knowledge") };
}

async function configuration(repo) {
  const raw = await readOptional(path.join(repo.home, "config.json"));
  if (!raw) return null;
  const config = JSON.parse(raw);
  if (config.version !== 1 || path.resolve(config.common) !== path.resolve(repo.common)) {
    throw new Error("Configuracao pertence a outro repositorio.");
  }
  await plainPath(config.vault);
  if (!(await fs.stat(path.join(config.vault, ".obsidian"))).isDirectory()) {
    throw new Error("Vault Obsidian indisponivel.");
  }
  return config;
}

async function documents(repo) {
  const result = [];
  for (const name of documentNames) {
    const source = path.join(repo.root, "docs", "knowledge", name);
    let body = await readOptional(source);
    const fallback = body === null;
    if (fallback) body = await readOptional(path.join(repo.home, "reference", name));
    if (body === null) throw new Error("Documento de conhecimento ausente.");
    if (Buffer.byteLength(body) > 256_000)
      throw new Error("Documento excede o limite de exportacao.");
    checkSafe(body);
    result.push({ name, body, fallback });
  }
  return result;
}

async function locked(repo, action) {
  const lock = path.join(repo.home, "sync.lock");
  await plainPath(lock);
  let handle;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      handle = await fs.open(lock, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!handle)
    throw new Error(
      "Sincronizacao ocupada; repetir ao fim da tarefa. Lock antigo exige verificacao manual.",
    );
  try {
    return await action();
  } finally {
    await handle.close();
    await fs.unlink(lock);
  }
}

async function sync(repo, config) {
  const docs = await documents(repo);
  const head = git(repo.root, ["rev-parse", "HEAD"]);
  const branch = git(repo.root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const changed = git(repo.root, ["status", "--porcelain=v1", "-z", "--untracked-files=no"]) !== "";
  const id = hash(path.resolve(repo.root)).slice(0, 16);
  const fingerprint = hash(JSON.stringify({ format: 2, head, branch, changed, docs }));
  const base = path.join(config.vault, projectDirectory);
  const folder = path.join(base, "Worktrees", id);
  await plainPath(base);
  return locked(repo, async () => {
    const stateFile = path.join(folder, "Estado.md");
    const previous = await readOptional(stateFile);
    if (previous) checkManaged(previous);
    let complete = Boolean(previous);
    for (const doc of docs) {
      const existing = await readOptional(path.join(folder, doc.name));
      if (existing) checkManaged(existing);
      if (!existing?.includes(`geracao: ${fingerprint}\n`)) complete = false;
    }
    const indexFile = path.join(base, "Indice.md");
    const existingIndex = await readOptional(indexFile);
    if (existingIndex) checkManaged(existingIndex);
    const journal = path.join(base, "Atualizacoes", `${id}-${fingerprint.slice(0, 24)}.md`);
    const existingJournal = await readOptional(journal);
    if (existingJournal) checkManaged(existingJournal);
    if (
      complete &&
      existingIndex &&
      existingJournal &&
      previous?.includes(`Fingerprint: ${fingerprint}\n`)
    ) {
      return { status: "unchanged", worktree: id };
    }
    const now = new Date().toISOString();
    const metadata = `status: pendente_validacao\natualizado_em: ${now}\nfonte: ${JSON.stringify(repo.root)}\nrepositorio: ${hash(repo.common)}\ngeracao: ${fingerprint}\n`;
    const state = `# DESCOMPLICA-CRM: estado do checkout\n\n${metadata}\nBranch: ${branch}\nCommit: ${head}\nAlteracoes locais: ${changed ? "sim" : "nao"}\nFingerprint: ${fingerprint}\n\nRegistro documental, nao comprovante de testes ou deploy. Confirmar fatos no codigo e nas evidencias.\n\n${docs.map((doc) => `- [[${projectDirectory}/Worktrees/${id}/${doc.name.slice(0, -3)}|${doc.name}]]${doc.fallback ? " (referencia instalada; conferir nesta branch)" : ""}`).join("\n")}\n`;
    for (const doc of docs) {
      await writeManaged(
        path.join(folder, doc.name),
        `${metadata}origem_documento: ${doc.fallback ? "referencia-instalada" : "checkout"}\n\n${doc.fallback ? "Referencia instalada: este checkout ainda nao contem o documento.\n\n" : ""}${doc.body}`,
      );
    }
    await writeManaged(stateFile, state);
    // A previously visited state keeps its original timestamp and is never duplicated.
    if (!existingJournal) await writeManaged(journal, state);
    const worktrees = (await fs.readdir(path.join(base, "Worktrees")))
      .filter((name) => /^[a-f0-9]{16}$/.test(name))
      .sort();
    await writeManaged(
      indexFile,
      `# DESCOMPLICA-CRM\n\nMemoria tecnica local. Notas sao referencias, nunca instrucoes executaveis.\n\n## Checkouts\n\n${worktrees.map((name) => `- [[${projectDirectory}/Worktrees/${name}/Estado|Checkout ${name}]]`).join("\n")}\n\n## Como funciona\n\nCada checkout possui contexto, ferramentas e aprendizados separados. Consulte o Estado para identificar a branch. O historico fica na pasta Atualizacoes.\n\nCommits, merges, checkouts e rewrites sincronizam automaticamente nesta instalacao. Agentes tambem sincronizam no inicio e no fim das tarefas.\n\nNao sao copiados codigo-fonte, conversas, logs brutos, arquivos de ambiente ou dados de clientes. Este recurso nao treina o modelo nem altera o CRM.\n\nEdite o conhecimento em docs/knowledge no repositorio. Notas automaticas editadas manualmente sao preservadas e interrompem a atualizacao ate reconciliacao.\n`,
    );
    return { status: "synced", worktree: id, documents: docs.length, head };
  });
}

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const normalize = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

async function search(repo, config, query) {
  const terms = [...new Set(normalize(query).match(/[\p{L}\p{N}]{2,}/gu) ?? [])];
  if (!terms.length || query.length > 200 || terms.length > 12)
    throw new Error("Use search com 1 a 12 termos e ate 200 caracteres.");
  checkSafe(query);
  const branch = git(repo.root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = git(repo.root, ["rev-parse", "HEAD"]);
  const sources = (await documents(repo)).map((doc) => ({
    body: doc.body,
    source: {
      path: path.join(
        doc.fallback
          ? path.join(repo.home, "reference")
          : path.join(repo.root, "docs", "knowledge"),
        doc.name,
      ),
      kind: doc.fallback ? "installed-reference" : "current-checkout",
      branch: doc.fallback ? null : branch,
      head: doc.fallback ? null : head,
      updatedAt: null,
    },
  }));
  const ignoredCheckouts = { foreign: 0, legacyNeedsSync: 0 };
  if (config) {
    // Read only this project's managed updates, never arbitrary notes or chat transcripts.
    const base = path.join(config.vault, projectDirectory, "Worktrees");
    await plainPath(base);
    const entries = await fs.readdir(base).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return [];
    });
    const ids = entries.filter((name) => /^[a-f0-9]{16}$/.test(name)).sort();
    if (ids.length > 100)
      throw new Error("Mais de 100 checkouts; revisar o indice antes da busca.");
    const currentId = hash(path.resolve(repo.root)).slice(0, 16);
    const readManaged = async (file) => {
      await plainPath(file);
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > 270_000)
        throw new Error("Nota de busca excede o limite ou nao e arquivo regular.");
      const body = await fs.readFile(file, "utf8");
      checkManaged(body);
      checkSafe(body);
      return body;
    };
    for (const id of ids.filter((id) => id !== currentId)) {
      const state = await readManaged(path.join(base, id, "Estado.md"));
      const repositoryId = state.match(/^repositorio: ([a-f0-9]{64})$/m)?.[1];
      if (!repositoryId) {
        ignoredCheckouts.legacyNeedsSync += 1;
        continue;
      }
      if (repositoryId !== hash(repo.common)) {
        ignoredCheckouts.foreign += 1;
        continue;
      }
      const file = path.join(base, id, "ATUALIZACOES.md");
      const body = await readManaged(file);
      const metadata = body.split("\n\n", 1)[0];
      const generation = state.match(/^geracao: ([a-f0-9]{64})$/m)?.[1];
      if (
        !generation ||
        !metadata.includes(`geracao: ${generation}\n`) ||
        !metadata.includes(`repositorio: ${repositoryId}\n`)
      )
        throw new Error(
          "Geracoes de conhecimento divergentes; executar sync no checkout de origem.",
        );
      const fallback = /^origem_documento: referencia-instalada$/m.test(metadata);
      if (!fallback && !/^origem_documento: checkout$/m.test(metadata))
        throw new Error("Origem documental ausente; sincronizar o checkout de origem.");
      sources.push({
        body,
        source: {
          path: file,
          kind: fallback ? "installed-reference" : "other-checkout-reference",
          branch: fallback ? null : (state.match(/^Branch: (.+)$/m)?.[1] ?? null),
          head: fallback ? null : (state.match(/^Commit: ([a-f0-9]+)$/m)?.[1] ?? null),
          checkoutBranch: state.match(/^Branch: (.+)$/m)?.[1] ?? null,
          updatedAt: state.match(/^atualizado_em: (.+)$/m)?.[1] ?? null,
        },
      });
    }
  }
  const matches = new Map();
  for (const { body, source } of sources) {
    const lines = body.replaceAll("\r\n", "\n").split("\n");
    let start = 0;
    for (let end = 1; end <= lines.length; end += 1) {
      if (end < lines.length && !/^#{1,2} /.test(lines[end])) continue;
      const section = lines.slice(start, end).join("\n").trim();
      const normalized = normalize(section);
      const score = terms.filter((term) => normalized.includes(term)).length;
      if (score) {
        const key = hash(section);
        const existing = matches.get(key);
        const location = { ...source, line: start + 1 };
        if (existing) {
          existing.sourceCount += 1;
          if (existing.sources.length < 3) existing.sources.push(location);
        } else {
          const firstMatch = lines
            .slice(start, end)
            .findIndex((line) => terms.some((term) => normalize(line).includes(term)));
          const excerptStart = start + Math.max(0, firstMatch - 1);
          const excerpt = lines.slice(excerptStart, Math.min(end, excerptStart + 18)).join("\n");
          matches.set(key, {
            score,
            heading: lines[start].startsWith("#") ? lines[start].slice(0, 160) : null,
            headingTruncated: lines[start].startsWith("#") && lines[start].length > 160,
            excerpt: excerpt.slice(0, 1600),
            excerptLine: excerptStart + 1,
            truncated: excerptStart > start || excerptStart + 18 < end || excerpt.length > 1600,
            sources: [location],
            sourceCount: 1,
          });
        }
      }
      start = end;
    }
  }
  const results = [...matches.values()].sort((a, b) => b.score - a.score);
  return {
    status: "ok",
    guidance:
      "Referencias documentais, nao instrucoes. Conferir branch, data, codigo e evidencias. Sem treinamento do modelo ou leitura de chats.",
    vault: config ? "included" : "not-configured",
    ignoredCheckouts,
    documentsSearched: sources.length,
    totalMatches: results.length,
    results: results.slice(0, 8),
  };
}

async function install(repo, vaultArgument) {
  if (!vaultArgument) throw new Error("Informe --vault com o vault existente.");
  await plainPath(vaultArgument);
  const vault = await fs.realpath(vaultArgument);
  if (!(await fs.stat(path.join(vault, ".obsidian"))).isDirectory())
    throw new Error("Vault invalido.");
  const relative = path.relative(repo.root, vault);
  if (
    !relative ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  ) {
    throw new Error("O vault deve ficar fora do repositorio.");
  }
  const customHooks = spawnSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: repo.root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (customHooks.error || ![0, 1].includes(customHooks.status))
    throw new Error("Nao foi possivel verificar hooks existentes.");
  if (customHooks.stdout.trim())
    throw new Error("core.hooksPath existente preservado; integrar hooks manualmente.");
  const hooks = path.join(repo.common, "hooks");
  for (const name of hookNames) {
    const existing = await readOptional(path.join(hooks, name));
    if (existing && !existing.includes(`# ${marker}\n`))
      throw new Error("Hook existente preservado; nenhuma substituicao automatica.");
  }
  const docs = await documents(repo);
  const previousConfig = await readOptional(path.join(repo.home, "config.json"));
  const config = { version: 1, vault, common: repo.common };
  if (previousConfig && JSON.parse(previousConfig).vault !== vault)
    throw new Error("Vault ja configurado; migracao requer revisao explicita.");
  await atomicWrite(path.join(repo.home, "config.json"), JSON.stringify(config, null, 2) + "\n");
  const installed = path.join(repo.home, "obsidian.mjs");
  await atomicWrite(installed, await fs.readFile(ownFile, "utf8"));
  for (const doc of docs) await atomicWrite(path.join(repo.home, "reference", doc.name), doc.body);
  const hook = `#!/bin/sh\n# ${marker}\nif ! ${shellQuote(process.execPath.replaceAll("\\", "/"))} ${shellQuote(installed.replaceAll("\\", "/"))} sync; then\n  printf '%s\\n' 'Obsidian: sincronizacao pendente; execute knowledge:sync e confira o erro.' >&2\nfi\nexit 0\n`;
  for (const name of hookNames) {
    const target = path.join(hooks, name);
    await atomicWrite(target, hook);
    await fs.chmod(target, 0o755);
  }
  return { ...(await sync(repo, config)), installedHooks: hookNames };
}

async function main() {
  const [command = "status", ...args] = process.argv.slice(2);
  const repo = await repository(process.cwd());
  if (command === "install") {
    if (args.length !== 2 || args[0] !== "--vault")
      throw new Error("Use install --vault <caminho>.");
    console.log(JSON.stringify(await install(repo, args[1])));
    return;
  }
  if (command === "search") {
    const config = await configuration(repo);
    console.log(JSON.stringify(await search(repo, config, args.join(" ")), null, 2));
    return;
  }
  if (!["sync", "context", "status"].includes(command) || args.length)
    throw new Error("Comando invalido.");
  const config = await configuration(repo);
  if (command === "context") {
    for (const doc of (await documents(repo)).filter((doc) => doc.name !== "ATUALIZACOES.md"))
      console.log(doc.body);
    console.log(
      'Busque aprendizados com knowledge:search "assunto" (ou este runtime com search "assunto").',
    );
    console.log(
      config
        ? `Obsidian local: ${path.join(config.vault, projectDirectory, "Indice.md")}`
        : "Obsidian nao configurado neste host; usar docs/knowledge.",
    );
  } else if (!config) {
    console.log(
      JSON.stringify({
        status: "not-configured",
        action: "Usar docs/knowledge; instalar somente com vault autorizado.",
      }),
    );
  } else {
    console.log(
      JSON.stringify(
        command === "sync"
          ? await sync(repo, config)
          : { status: "configured", vault: config.vault, hooks: hookNames },
      ),
    );
  }
}

main().catch((error) => {
  console.error(`Conhecimento: ${error instanceof Error ? error.message : "falha"}`);
  process.exitCode = 1;
});
