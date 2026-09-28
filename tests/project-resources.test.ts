import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";

// @ts-expect-error Operational ESM script, also exercised directly by the CLI.
import { checkResources } from "../scripts/knowledge/resources.mjs";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "crm-resources-"));
  roots.push(root);
  const manifest = {
    version: 1,
    skills: ["descomplica-validacao"],
    areas: [
      {
        name: "Conta",
        agent: "crm-seguranca",
        skill: "descomplica-validacao",
        routes: ["app/page.tsx"],
        evidence: ["tests/account.test.ts"],
      },
    ],
  };
  for (const file of [
    "app/page.tsx",
    ".codex/agents/crm-seguranca.toml",
    ".agents/skills/descomplica-validacao/SKILL.md",
    "tests/account.test.ts",
    "docs/knowledge/recursos.json",
    "docs/knowledge/FERRAMENTAS.md",
  ]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(
      path.join(root, file),
      file.endsWith("recursos.json") ? JSON.stringify(manifest) : "descomplica-validacao",
    );
  }
  return { root, manifest };
}

it("maps every current page and route handler to existing project resources", async () => {
  const result = await checkResources(process.cwd());
  expect(result.status).toBe("ok");
  expect(result.areas).toBeGreaterThan(0);
  expect(result.skills).toBeGreaterThanOrEqual(11);
});

it("rejects new routes without an owner and verification references", async () => {
  const { root } = await fixture();
  expect((await checkResources(root)).routeFiles).toBe(1);
  await mkdir(path.join(root, "app/new"));
  await writeFile(path.join(root, "app/new/page.tsx"), "fixture");
  await expect(checkResources(root)).rejects.toThrow("Rotas sem area");
});

it("rejects removed routes, duplicate ownership and missing resources", async () => {
  const { root, manifest } = await fixture();
  const file = path.join(root, "docs/knowledge/recursos.json");
  const original = await readFile(file, "utf8");
  manifest.areas.push(manifest.areas[0]!);
  await writeFile(file, JSON.stringify(manifest));
  await expect(checkResources(root)).rejects.toThrow("duas areas");
  await writeFile(file, original);
  await rm(path.join(root, "tests/account.test.ts"));
  await expect(checkResources(root)).rejects.toThrow("Recurso ausente");
  await rm(path.join(root, "app/page.tsx"));
  await expect(checkResources(root)).rejects.toThrow("Rota removida");
});

it("refuses resource references outside the checkout", async () => {
  const { root, manifest } = await fixture();
  manifest.areas[0]!.evidence = ["../secret"];
  await writeFile(path.join(root, "docs/knowledge/recursos.json"), JSON.stringify(manifest));
  await expect(checkResources(root)).rejects.toThrow();
});

it("rejects an installed skill omitted from the inventory or automatic matrix", async () => {
  const { root, manifest } = await fixture();
  await mkdir(path.join(root, ".agents/skills/caveman"));
  await writeFile(path.join(root, ".agents/skills/caveman/SKILL.md"), "fixture");
  await expect(checkResources(root)).rejects.toThrow("Skill sem inventario: caveman");
  manifest.skills.push("caveman");
  await writeFile(path.join(root, "docs/knowledge/recursos.json"), JSON.stringify(manifest));
  await expect(checkResources(root)).rejects.toThrow("Skill sem referencia na matriz: caveman");
  await writeFile(path.join(root, "docs/knowledge/FERRAMENTAS.md"), manifest.skills.join("\n"));
  expect((await checkResources(root)).skills).toBe(2);
  await rm(path.join(root, ".agents/skills/caveman/SKILL.md"));
  await expect(checkResources(root)).rejects.toThrow("Skill ausente: caveman");
});
