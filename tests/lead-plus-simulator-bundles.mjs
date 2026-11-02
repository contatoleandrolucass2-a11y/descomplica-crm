import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const root = process.cwd();
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const base = "d4bb4d91b8a553ae2edf0eaeb876d21e2b59b361";
const touched = new Set([
  "lib/crm/lead-plus/client/WorkspaceApp.tsx",
  "lib/crm/lead-plus/client/SystemScreens.tsx",
  "app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
  "app/(protected)/app/simulacao/_components/archive-investor/AssociativeLearningManual.tsx",
]);
const partial = process.argv.includes("--simulator-after");
const evidence = partial
  ? JSON.parse(
      readFileSync(path.join(root, "test-results/handoff-leads-simulators-bundles.json"), "utf8"),
    )
  : {
      base,
      method:
        "Vite 8.2.4/Rolldown production build, same entry/config, browser laboratory; not Next served/transfer bytes",
      routes: [],
    };
for (const [name, entryFile] of [
  ["Leads", "lib/crm/lead-plus/client/WorkspaceApp.tsx"],
  [
    "Investidor",
    "app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
  ],
]) {
  for (const mode of ["before", "after"]) {
    if (partial && !(name === "Investidor" && mode === "after")) continue;
    if (partial)
      evidence.routes = evidence.routes.filter((row) => !(row.name === name && row.mode === mode));
    const entry = path.join(root, entryFile).replaceAll("\\", "/");
    const result = await build({
      root,
      configFile: false,
      envFile: false,
      logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env": "{}" },
      resolve: { alias: { "@": root } },
      oxc: { jsx: { runtime: "automatic" } },
      plugins: [
        {
          name: "baseline-source",
          enforce: "pre",
          load(id) {
            if (mode !== "before") return;
            const rel = path.relative(root, id.split("?")[0]).replaceAll("\\", "/");
            if (touched.has(rel))
              return execFileSync("git", ["show", `${base}:${rel}`], {
                cwd: root,
                encoding: "utf8",
                maxBuffer: 8 * 1024 * 1024,
              });
          },
        },
      ],
      build: {
        write: false,
        minify: true,
        rolldownOptions: {
          input: entry,
          preserveEntrySignatures: "exports-only",
          output: { format: "es" },
        },
      },
    });
    const output = result.output;
    const chunks = new Map(output.filter((x) => x.type === "chunk").map((x) => [x.fileName, x]));
    const initial = new Set();
    function include(file) {
      if (initial.has(file)) return;
      const chunk = chunks.get(file);
      if (!chunk) return;
      initial.add(file);
      chunk.imports.forEach(include);
    }
    for (const chunk of chunks.values()) if (chunk.isEntry) include(chunk.fileName);
    const initialChunks = [...initial].map((name) => chunks.get(name));
    evidence.routes.push({
      name,
      mode,
      initialJsBytes: initialChunks.reduce((n, x) => n + Buffer.byteLength(x.code), 0),
      initialJsGzipBytes: initialChunks.reduce((n, x) => n + gzipSync(x.code).length, 0),
      totalJsBytes: [...chunks.values()].reduce((n, x) => n + Buffer.byteLength(x.code), 0),
      initialChunks: initialChunks.length,
      deferredChunks: [...chunks.keys()].filter((x) => !initial.has(x)),
      cssBytes: output
        .filter((x) => x.type === "asset" && x.fileName.endsWith(".css"))
        .reduce((n, x) => n + Buffer.byteLength(x.source), 0),
    });
  }
}
mkdirSync(path.join(root, "test-results"), { recursive: true });
evidence.candidate = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  workingTree: true,
  node: process.version,
  sourceHashes: Object.fromEntries(
    [
      ...touched,
      "app/(protected)/app/simulacao/_components/archive-investor/DeferredInvestorLearningManual.tsx",
      "app/(protected)/app/simulacao/_components/archive-investor/InvestorLearningManualContent.tsx",
    ].map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
  ),
};
writeFileSync(
  path.join(root, "test-results/handoff-leads-simulators-bundles.json"),
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
