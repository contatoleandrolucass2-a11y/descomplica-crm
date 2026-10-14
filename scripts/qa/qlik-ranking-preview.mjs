import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Script } from "node:vm";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const { build } = await import(pathToFileURL(vitestRequire.resolve("vite")).href);
const entry = path.join(root, "scripts/qa/qlik-ranking-preview-memory.tsx").replaceAll("\\", "/");
const guard = "\0qlik-preview-guard";
const link = "\0qlik-preview-link";

// In-memory QA-only guard. The production page and its real guard stay untouched.
const built = await build({
  root,
  configFile: false,
  envFile: false,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: { "@": root } },
  oxc: { jsx: { runtime: "automatic" } },
  ssr: { noExternal: true },
  plugins: [
    {
      name: "qlik-ranking-preview-only",
      enforce: "pre",
      resolveId(id) {
        const normalized = id.replaceAll("\\", "/");
        if (
          normalized === "@/lib/authorization/enforce" ||
          normalized === `${root.replaceAll("\\", "/")}/lib/authorization/enforce`
        )
          return guard;
        if (id === "next/link") return link;
        if (id.endsWith("qlik-ranking-preview-memory.tsx")) return entry;
        if (
          id === "server-only" ||
          id.startsWith("@supabase/") ||
          /\/lib\/(?:auth|authorization|crm)\//.test(normalized)
        ) {
          throw new Error(`Data/auth dependency forbidden in preview: ${id}`);
        }
      },
      load(id) {
        if (id === guard)
          return `export async function enforcePermission(key) {
        if (key !== "crm.ranking.view") throw new Error("Unexpected preview permission");
      }`;
        if (id === link)
          return `import { createElement } from "react";
        export default function Link({ href, prefetch, ...props }) {
          return createElement("a", { ...props, href });
        }`;
        if (id === entry)
          return `
        import { renderToStaticMarkup } from "react-dom/server";
        import RankingPage from "@/app/(protected)/app/ranking/page";
        import "@/app/globals.css";
        export async function renderPreview() {
          return renderToStaticMarkup(await RankingPage());
        }
      `;
      },
    },
  ],
  build: {
    ssr: entry,
    ssrEmitAssets: true,
    write: false,
    minify: false,
    cssMinify: false,
    cssCodeSplit: false,
    rollupOptions: { output: { format: "cjs", codeSplitting: false } },
  },
});
const output = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output);
const chunk = output.find((file) => file.type === "chunk" && file.isEntry);
assert.ok(chunk, "Missing SSR entry");
const previewModule = { exports: {} };
const evaluate = new Script(
  `(function(exports, require, module, __filename, __dirname) { ${chunk.code}\n})`,
  { filename: entry },
).runInThisContext();
evaluate(previewModule.exports, require, previewModule, entry, path.dirname(entry));
const markup = await previewModule.exports.renderPreview();
assert.ok(markup.includes("Top 10 empreendimentos") && markup.includes("CANAL IMOB"));
assert.ok(!markup.includes("R$"), "Preview must not contain financial fixtures");
const assets = new Map(
  output.filter((file) => file.type === "asset").map((file) => [`/${file.fileName}`, file.source]),
);
const css = [...assets.keys()].filter((file) => file.endsWith(".css"));
assert.ok(css.length, "Missing real stylesheet output");

if (process.argv.includes("--check")) {
  console.log("Ranking preview SSR + real CSS OK; no data/auth/browser calls.");
} else {
  const portIndex = process.argv.indexOf("--port");
  const port = portIndex < 0 ? 0 : Number(process.argv[portIndex + 1]);
  assert.ok(Number.isInteger(port) && port >= 0 && port <= 65535, "Invalid port");
  const server = createServer((request, response) => {
    const host = `127.0.0.1:${server.address().port}`;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    if (request.headers.host !== host) return response.writeHead(403).end();
    if (!["GET", "HEAD"].includes(request.method)) return response.writeHead(405).end();
    const url = new URL(request.url, `http://${host}`);
    if (["/", "/app/ranking"].includes(url.pathname)) {
      const requested = url.searchParams.get("theme");
      const theme = ["light", "balanced", "dark"].includes(requested) ? requested : "light";
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      const html = `<!doctype html><html lang="pt-BR" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ranking QA local - sem dados reais</title><link rel="icon" href="data:,">${css.map((file) => `<link rel="stylesheet" href="${file}">`).join("")}</head><body>${markup}</body></html>`;
      return response.end(request.method === "HEAD" ? undefined : html);
    }
    if (assets.has(url.pathname)) {
      response.setHeader(
        "Content-Type",
        url.pathname.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream",
      );
      return response.end(request.method === "HEAD" ? undefined : assets.get(url.pathname));
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(`Ranking QA: http://127.0.0.1:${server.address().port}/app/ranking`);
  console.log("Themes: ?theme=light | balanced | dark. SSR only; no login, data or browser.");
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
}
