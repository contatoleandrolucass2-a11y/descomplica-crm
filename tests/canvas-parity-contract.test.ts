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
  it("maps every released protected page to an approved visual region", () => {
    const releasedPaths = PROTECTED_PAGE_GATES.filter(({ releaseEnabled }) => releaseEnabled).map(
      ({ path }) => path,
    );

    expect(releasedPaths).toHaveLength(23);
    for (const path of releasedPaths) expect(readme).toContain(`\`${path}\``);
    expect(readme).toContain("Existe uma única navbar global");
    expect(readme).toContain("crm.simulators.view");
    expect(readme).toContain("motor, endpoint de cálculo, submissão e aprovação");
  });

  it("keeps every versioned canvas byte-identifiable and marks the unsafe draft superseded", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.policy).toContain("never authority for data");
    expect(manifest.assets).toHaveLength(15);
    expect(new Set(manifest.assets.map(({ path }) => path)).size).toBe(15);

    for (const asset of manifest.assets) {
      const contents = readFileSync(new URL(asset.path, root));
      expect(createHash("sha256").update(contents).digest("hex"), asset.path).toBe(asset.sha256);
      expect(asset.source).toMatch(/^exec-[a-f0-9-]+\.png$/u);
    }

    expect(
      manifest.assets.filter(({ status }) => status === "superseded-do-not-implement"),
    ).toEqual([expect.objectContaining({ path: "reference/hub-simulacao-superseded.webp" })]);
  });
});
