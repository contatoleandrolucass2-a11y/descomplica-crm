import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildLegacyCanaryRuntimeManifest } from "../scripts/homologation/sync-legacy-canary-runtime.mjs";

describe("homologation legacy canary runtime synchronization", () => {
  it("changes only the source SHA of a synthetic isolated manifest", () => {
    const previousSha = "a".repeat(40);
    const sourceSha = "b".repeat(40);
    expect(
      buildLegacyCanaryRuntimeManifest(
        {
          schemaVersion: 1,
          environment: "isolated-homologation",
          sourceSha: previousSha,
          dataClassification: "synthetic-only",
        },
        sourceSha,
      ),
    ).toEqual({
      schemaVersion: 1,
      environment: "isolated-homologation",
      sourceSha,
      dataClassification: "synthetic-only",
    });
  });

  it("rejects a non-synthetic or malformed runtime", () => {
    expect(() => buildLegacyCanaryRuntimeManifest({}, "b".repeat(40))).toThrow(/contract/u);
    expect(() =>
      buildLegacyCanaryRuntimeManifest(
        {
          schemaVersion: 1,
          environment: "production",
          sourceSha: "a".repeat(40),
          dataClassification: "real",
        },
        "b".repeat(40),
      ),
    ).toThrow(/contract/u);
  });

  it("pins synchronization to root, a clean checkout and the isolated runtime", async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, "../scripts/homologation/sync-legacy-canary-runtime.mjs"),
      "utf8",
    );
    expect(source).toContain("process.getuid?.() !== 0");
    expect(source).toContain('"isolated-homologation"');
    expect(source).toContain('"synthetic-only"');
    expect(source).toContain('"status", "--porcelain=v1"');
    expect(source).not.toContain("SUPABASE_DB_URL");
  });
});
