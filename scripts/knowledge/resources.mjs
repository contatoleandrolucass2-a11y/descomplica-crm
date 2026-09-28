import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const relativeFile = z
  .string()
  .min(1)
  .refine(
    (value) => !path.isAbsolute(value) && !value.includes("\\") && !value.split("/").includes(".."),
  );
const resourceName = z.string().regex(/^crm-[a-z-]+$|^descomplica-[a-z-]+$/);
const manifestSchema = z.object({
  version: z.literal(1),
  skills: z.array(z.string().regex(/^[a-z][a-z0-9-]+$/)).min(1),
  areas: z
    .array(
      z.object({
        name: z.string().min(1),
        agent: resourceName,
        skill: resourceName,
        routes: z.array(relativeFile).min(1),
        evidence: z.array(relativeFile).min(1),
      }),
    )
    .min(1),
});

async function routesIn(root, directory = "app") {
  const routes = [];
  for (const item of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error("Links nao sao aceitos no inventario de rotas.");
    const file = `${directory}/${item.name}`;
    if (item.isDirectory()) routes.push(...(await routesIn(root, file)));
    else if (/^(page|route)\.(tsx?|jsx?)$/.test(item.name)) routes.push(file);
  }
  return routes.sort();
}

export async function checkResources(root) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(path.join(root, "docs/knowledge/recursos.json"), "utf8")),
  );
  const routes = await routesIn(root);
  const skillRoot = path.join(root, ".agents/skills");
  const skills = await readdir(skillRoot, { withFileTypes: true });
  const matrix = await readFile(path.join(root, "docs/knowledge/FERRAMENTAS.md"), "utf8");
  if (new Set(manifest.skills).size !== manifest.skills.length)
    throw new Error("Skill duplicada no inventario.");
  for (const skill of skills) {
    if (skill.isSymbolicLink()) throw new Error("Links nao sao aceitos no inventario de skills.");
    if (skill.isDirectory() && !manifest.skills.includes(skill.name))
      throw new Error(`Skill sem inventario: ${skill.name}`);
  }
  for (const skill of manifest.skills) {
    if (!(await stat(path.join(skillRoot, skill, "SKILL.md")).catch(() => null))?.isFile())
      throw new Error(`Skill ausente: ${skill}`);
    if (!matrix.includes(skill)) throw new Error(`Skill sem referencia na matriz: ${skill}`);
  }
  const owned = new Set();
  for (const area of manifest.areas) {
    for (const route of area.routes) {
      if (owned.has(route)) throw new Error(`Rota com duas areas: ${route}`);
      if (!routes.includes(route)) throw new Error(`Rota removida ou invalida: ${route}`);
      owned.add(route);
    }
    for (const file of [
      `.codex/agents/${area.agent}.toml`,
      `.agents/skills/${area.skill}/SKILL.md`,
      ...area.evidence,
    ]) {
      if (!(await stat(path.join(root, file)).catch(() => null))?.isFile())
        throw new Error(`Recurso ausente: ${file}`);
    }
  }
  const missing = routes.filter((route) => !owned.has(route));
  if (missing.length) throw new Error(`Rotas sem area e verificacao: ${missing.join(", ")}`);
  return {
    status: "ok",
    areas: manifest.areas.length,
    routeFiles: routes.length,
    skills: manifest.skills.length,
    scope:
      "Inventario de recursos; nao comprova execucao de testes, cobertura funcional ou conexao de plugins.",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkResources(process.cwd())
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
