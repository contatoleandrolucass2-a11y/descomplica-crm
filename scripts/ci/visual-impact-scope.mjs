import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { authenticatedVisualRoutes } from "../qa/visual-route-scope.mjs";

const revision = /^[a-f0-9]{40}$/;

export { authenticatedVisualRoutes };

const stageRoutes = authenticatedVisualRoutes.filter((route) => route.startsWith("/app/etapas/"));
const configurationRoutes = authenticatedVisualRoutes.filter((route) =>
  route.startsWith("/app/configuracoes"),
);
const simulatorRoutes = authenticatedVisualRoutes.filter((route) =>
  route.startsWith("/app/simulacao"),
);
const adminRoutes = authenticatedVisualRoutes.filter((route) => route.startsWith("/admin"));

const documentationPath = /^(?:CHANGELOG\.md|WORKLOG\.md|docs\/.*|conhecimento\/.*)$/;
const metaAdsPath =
  /^(?:app\/(?:\(protected\)\/app|api)\/meta-ads\/|lib\/meta-ads\/|public\/(?:canvas|descomplica-ads-compact)\/|scripts\/qa\/meta-ads-frame\.mjs$|tests\/meta-ads[^/]*\.(?:ts|tsx)$)/;
const globalVisualPath =
  /^(?:\.github\/workflows\/|AGENTS\.md$|package\.json$|pnpm-lock\.yaml$|next\.config\.ts$|postcss\.config\.mjs$|proxy\.ts$|app\/(?:layout|globals|_components)\b|app\/\(protected\)\/(?:layout|_components)\b|lib\/(?:auth|authorization|navigation)\/|scripts\/ci\/visual-impact-scope\.mjs$|scripts\/qa\/(?:authenticated-visual|local-authenticated-visual)\.mjs$|tests\/(?:ci-visual-impact-scope|visual-parity-completeness)\.test\.ts$|supabase\/)/;

function addAll(target, values) {
  for (const value of values) target.add(value);
}

function routesForFile(file) {
  if (/^app\/\(protected\)\/app\/etapas\//.test(file)) return stageRoutes;
  if (/^app\/\(protected\)\/app\/ranking\//.test(file)) return ["/app/ranking"];
  if (/^app\/\(protected\)\/app\/canal-de-parcerias\//.test(file)) {
    return ["/app/canal-de-parcerias"];
  }
  if (/^app\/\(protected\)\/app\/configuracoes\/metas\/parcerias\//.test(file)) {
    return ["/app/configuracoes/metas/parcerias"];
  }
  if (/^app\/\(protected\)\/app\/configuracoes\/metas\/pontos\//.test(file)) {
    return ["/app/configuracoes/metas/pontos"];
  }
  if (/^app\/\(protected\)\/app\/configuracoes\/metas\//.test(file)) {
    return configurationRoutes.filter((route) => route.startsWith("/app/configuracoes/metas"));
  }
  if (/^app\/\(protected\)\/app\/configuracoes\//.test(file)) return configurationRoutes;
  if (/^app\/\(protected\)\/app\/simulacao\/tabelao\//.test(file)) {
    return ["/app/simulacao/tabelao"];
  }
  if (/^app\/\(protected\)\/app\/simulacao\//.test(file)) return simulatorRoutes;
  if (/^app\/\(protected\)\/admin\/usuarios\//.test(file)) return ["/admin/usuarios"];
  if (/^app\/\(protected\)\/admin\/paginas\//.test(file)) return ["/admin/paginas"];
  if (/^app\/\(protected\)\/admin\//.test(file)) return adminRoutes;
  if (/^app\/\(protected\)\/app\/(?:_components|read-model-v3)\//.test(file)) {
    return ["/app"];
  }
  if (/^app\/\(protected\)\/app\/(?:page\.tsx|Dashboard)/.test(file)) return ["/app"];
  if (/^(?:lib\/.*dashboard|tests\/dashboard)/.test(file)) return ["/app"];
  if (/^(?:lib\/.*ranking|tests\/(?:ranking|partnership|parcerias))/.test(file)) {
    return ["/app/ranking", "/app/canal-de-parcerias"];
  }
  if (/^(?:lib\/.*simulat|tests\/(?:caixa|associative|simulator|tabelao))/.test(file)) {
    return simulatorRoutes;
  }
  return null;
}

export function classifyVisualPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { mode: "full", routes: authenticatedVisualRoutes, reason: "empty-or-invalid-diff" };
  }

  const selectedRoutes = new Set();
  for (const file of paths) {
    if (typeof file !== "string" || !file) {
      return { mode: "full", routes: authenticatedVisualRoutes, reason: "invalid-path" };
    }
    if (documentationPath.test(file) || metaAdsPath.test(file)) continue;
    if (globalVisualPath.test(file)) {
      return { mode: "full", routes: authenticatedVisualRoutes, reason: `global:${file}` };
    }
    const mappedRoutes = routesForFile(file);
    if (!mappedRoutes) {
      return { mode: "full", routes: authenticatedVisualRoutes, reason: `unmapped:${file}` };
    }
    addAll(selectedRoutes, mappedRoutes);
  }

  if (selectedRoutes.size === 0)
    return { mode: "none", routes: [], reason: "dedicated-or-nonvisual" };
  return {
    mode: "focused",
    routes: authenticatedVisualRoutes.filter((route) => selectedRoutes.has(route)),
    reason: "mapped-routes",
  };
}

export function classifyVisualImpact({ event, base, head, cwd = process.cwd() }) {
  if (["schedule", "workflow_dispatch"].includes(event)) {
    return { mode: "full", routes: authenticatedVisualRoutes, reason: `event:${event}` };
  }
  if (!revision.test(base ?? "") || !revision.test(head ?? "")) {
    return { mode: "full", routes: authenticatedVisualRoutes, reason: "missing-revision" };
  }
  try {
    const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
    const diffBase = event === "pull_request" ? git(["merge-base", base, head]).trim() : base;
    const paths = git(["diff", "--name-only", "--no-renames", "-z", diffBase, head])
      .split("\0")
      .filter(Boolean);
    return classifyVisualPaths(paths);
  } catch {
    return { mode: "full", routes: authenticatedVisualRoutes, reason: "git-error" };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = classifyVisualImpact({
    event: process.env.GITHUB_EVENT_NAME,
    base:
      process.env.GITHUB_EVENT_NAME === "pull_request"
        ? process.env.PR_BASE_SHA
        : process.env.PUSH_BASE_SHA,
    head: process.env.PR_HEAD_SHA || process.env.GITHUB_SHA,
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(process.env.GITHUB_OUTPUT, `visual_mode=${result.mode}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `visual_routes=${JSON.stringify(result.routes)}\n`);
  console.log(
    `Authenticated visual scope: mode=${result.mode} routes=${result.routes.length} reason=${result.reason}`,
  );
}
