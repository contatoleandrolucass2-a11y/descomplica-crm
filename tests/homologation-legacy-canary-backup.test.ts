import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("homologation legacy canary backup", () => {
  it("creates four root-only artifacts and verifies an isolated networkless restore", async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, "../scripts/homologation/create-legacy-canary-backup.mjs"),
      "utf8",
    );
    expect(source).toContain("process.getuid?.() !== 0");
    expect(source).toContain('"--network",\n        "none"');
    expect(source).toContain('"--username",\n        "supabase_admin"');
    expect(source).toContain('"database.dump"');
    expect(source).toContain('"migration-history.sql"');
    expect(source).toContain('"homologation-config.tar"');
    expect(source).toContain('"current-image.tar"');
    expect(source).toContain("validateBackupProof(proof");
    expect(source).toContain("await writeFile(checksumPath");
    expect(source).not.toContain("SUPABASE_DB_URL");
    expect(source).not.toContain("console.log");
  });

  it("pins the baseline to 31 migrations, zero candidate and 17 pages", async () => {
    const source = await readFile(
      path.resolve(import.meta.dirname, "../scripts/homologation/create-legacy-canary-backup.mjs"),
      "utf8",
    );
    expect(source).toContain("const expectedHistoryCount = 31");
    expect(source).toContain("manifest.candidateCount !== 0");
    expect(source).toContain("manifest.pageCount !== 17");
    expect(source).toContain("restored.candidateCount !== 0");
    expect(source).toContain("restored.pageCount !== 17");
  });
});
