import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PROTECTED_PAGE_GATES } from "@/lib/authorization/page-gates";

interface CanvasAsset {
  path: string;
  sha256: string;
  source: string;
  status: string;
}

const root = new URL("../docs/qa/canvas-parity/", import.meta.url);
const readme = readFileSync(new URL("README.md", root), "utf8");
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8")) as {
  schemaVersion: number;
  policy: string;
  assets: CanvasAsset[];
};

describe("approved canvas parity contract", () => {
  it("preserves every approved canvas and routes Repasse to its dedicated visual contract", () => {
    const releasedPaths = PROTECTED_PAGE_GATES.filter(({ releaseEnabled }) => releaseEnabled).map(
      ({ path }) => path,
    );
    const canvasPaths = releasedPaths.filter(
      (path) => !["/app/repasse", "/app/configuracoes/conectar-sistemas"].includes(path),
    );
    const repasseReadme = readFileSync(new URL("../repasse/README.md", root), "utf8");
    const systemsReadme = readFileSync(new URL("../connected-systems/README.md", root), "utf8");

    expect(releasedPaths).toHaveLength(28);
    expect(canvasPaths).toHaveLength(26);
    for (const path of canvasPaths) expect(readme).toContain(`\`${path}\``);
    expect(repasseReadme).toContain("`/app/repasse`");
    expect(repasseReadme).toContain("Claro, Médio e Escuro");
    expect(systemsReadme).toContain("`/app/configuracoes/conectar-sistemas`");
    expect(systemsReadme).toContain("Claro, Médio e Escuro");
    expect(readme).toContain("Existe uma única navbar global");
    expect(readme).toContain("crm.simulators.view");
    expect(readme).toContain("motor, endpoint de cálculo, submissão e aprovação");
  });

  it("keeps every versioned canvas byte-identifiable and marks the unsafe draft superseded", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.policy).toContain("never authority for data");
    expect(manifest.assets).toHaveLength(17);
    expect(new Set(manifest.assets.map(({ path }) => path)).size).toBe(17);
    const liveReferences = new Map([
      [
        "reference/metas-dv-live-2026-10-15.webp",
        "https://descomplicapro.com.br/configuracoes/metas",
      ],
      [
        "reference/metas-parcerias-live-2026-10-15.webp",
        "https://descomplicapro.com.br/configuracoes/metas/parcerias",
      ],
    ]);
    expect(
      manifest.assets
        .filter(({ status }) => status === "authoritative-live-reference")
        .map(({ path }) => path)
        .sort(),
    ).toEqual([...liveReferences.keys()].sort());

    for (const asset of manifest.assets) {
      const contents = readFileSync(new URL(asset.path, root));
      expect(createHash("sha256").update(contents).digest("hex"), asset.path).toBe(asset.sha256);
      if (liveReferences.has(asset.path)) {
        expect(asset.source).toBe(liveReferences.get(asset.path));
      } else {
        expect(asset.source).toMatch(/^exec-[a-f0-9-]+\.png$/u);
      }
    }

    expect(
      manifest.assets.filter(({ status }) => status === "superseded-do-not-implement"),
    ).toEqual([expect.objectContaining({ path: "reference/hub-simulacao-superseded.webp" })]);
  });
});
