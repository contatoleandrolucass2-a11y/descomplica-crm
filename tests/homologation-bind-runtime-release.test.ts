import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { transformRuntimeReleaseManifest } from "@/scripts/homologation/bind-runtime-release.mjs";

const repositoryRoot = process.cwd();
const oldSha = "a".repeat(40);
const expectedSha = "b".repeat(40);

describe("homologation runtime release binding", () => {
  it("updates only sourceSha and preserves every additional manifest field", () => {
    const before = {
      schemaVersion: 1,
      environment: "isolated-homologation",
      sourceSha: oldSha,
      dataClassification: "synthetic-only",
      createdAt: "2026-09-27T00:00:00.000Z",
      nested: { enabled: true, values: [1, "two", null] },
    };

    const transformed = transformRuntimeReleaseManifest(
      `${JSON.stringify(before, null, 2)}\n`,
      expectedSha,
    );
    const after = JSON.parse(transformed);

    expect(after.sourceSha).toBe(expectedSha);
    expect({ ...after, sourceSha: oldSha }).toEqual(before);
    expect(transformed.endsWith("\n")).toBe(true);
  });

  it("is idempotent for the already-bound release", () => {
    const manifest = {
      schemaVersion: 1,
      environment: "isolated-homologation",
      sourceSha: expectedSha,
      dataClassification: "synthetic-only",
    };
    expect(
      JSON.parse(transformRuntimeReleaseManifest(JSON.stringify(manifest), expectedSha)),
    ).toEqual(manifest);
  });

  it.each([
    ["malformed JSON", "{"],
    ["array", "[]"],
    [
      "schema version",
      JSON.stringify({
        schemaVersion: 2,
        environment: "isolated-homologation",
        sourceSha: oldSha,
        dataClassification: "synthetic-only",
      }),
    ],
    [
      "environment",
      JSON.stringify({
        schemaVersion: 1,
        environment: "production",
        sourceSha: oldSha,
        dataClassification: "synthetic-only",
      }),
    ],
    [
      "classification",
      JSON.stringify({
        schemaVersion: 1,
        environment: "isolated-homologation",
        sourceSha: oldSha,
        dataClassification: "real-data",
      }),
    ],
    [
      "current source SHA",
      JSON.stringify({
        schemaVersion: 1,
        environment: "isolated-homologation",
        sourceSha: "short",
        dataClassification: "synthetic-only",
      }),
    ],
  ])("fails closed for an invalid %s", (_label, contents) => {
    expect(() => transformRuntimeReleaseManifest(contents, expectedSha)).toThrow();
  });

  it("fails closed for an invalid expected SHA", () => {
    const manifest = JSON.stringify({
      schemaVersion: 1,
      environment: "isolated-homologation",
      sourceSha: oldSha,
      dataClassification: "synthetic-only",
    });
    expect(() => transformRuntimeReleaseManifest(manifest, "A".repeat(40))).toThrow();
    expect(() => transformRuntimeReleaseManifest(manifest, "short")).toThrow();
  });

  it("pins the root-only clean-worktree atomic persistence contract", async () => {
    const [source, packageJson] = await Promise.all([
      readFile(path.join(repositoryRoot, "scripts/homologation/bind-runtime-release.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    ]);
    const scripts = JSON.parse(packageJson).scripts;

    expect(scripts["homologation:bind-runtime-release"]).toBe(
      "node scripts/homologation/bind-runtime-release.mjs",
    );
    expect(scripts["homologation:backup:legacy-canary-retirement"]).toBe(
      "node scripts/homologation/create-legacy-canary-retirement-backup.mjs",
    );
    expect(scripts["homologation:migrate:legacy-canary-retirement"]).toBe(
      "node scripts/homologation/apply-legacy-canary-retirement.mjs",
    );
    expect(scripts["homologation:configure:legacy-canary-retirement"]).toBe(
      "node scripts/homologation/configure-legacy-migration-runtime.mjs",
    );
    expect(source).toContain('const runtimeRoot = "/var/lib/descomplica-crm-homologation"');
    expect(source).toContain('const destination = path.join(runtimeRoot, "manifest.json")');
    expect(source).toContain("process.getuid?.() !== 0");
    expect(source).toContain('arguments_[0] !== "--expected-sha"');
    expect(source).toContain('["rev-parse", "HEAD"]');
    expect(source).toContain('["status", "--porcelain=v1", "--untracked-files=all"]');
    expect(source.match(/await verifyReleaseBoundary\(expectedSha\)/gu)).toHaveLength(3);
    expect(source).toContain("(directoryMetadata.mode & 0o777) !== 0o700");
    expect(source).toContain("(metadata.mode & 0o777) !== 0o600");
    expect(source).toContain('open(temporary, "wx", 0o600)');
    expect(source).toContain("await handle.chown(0, 0)");
    expect(source).toContain("await handle.chmod(0o600)");
    expect(source).toContain("await handle.sync()");
    expect(source).toContain("await rename(temporary, destination)");
    expect(source).toContain('open(runtimeRoot, "r")');
    expect(source).toContain("await directory.sync()");
    expect(source).toContain("if (temporaryCreated) await rm(temporary, { force: true })");
    expect(source).toContain('import { enterRuntimeStateLock } from "./runtime-state-lock.mjs"');
    expect(source).toContain("await assertManifestUnchanged(originalContents)");
    expect(source).toContain("await assertManifestUnchanged(transformed)");
    expect(source).toContain(
      "await restoreManifestAfterFailedPostcondition(originalContents, transformed)",
    );
    expect(source.indexOf("await assertManifestUnchanged(originalContents)")).toBeLessThan(
      source.indexOf("await writeManifestAtomically(transformed)"),
    );
    expect(source.lastIndexOf("await verifyReleaseBoundary(expectedSha)")).toBeGreaterThan(
      source.indexOf("await writeManifestAtomically(transformed)"),
    );
    expect(source.indexOf("await handle.sync()")).toBeLessThan(
      source.indexOf("await rename(temporary, destination)"),
    );
    expect(source.indexOf("await rename(temporary, destination)")).toBeLessThan(
      source.indexOf("await directory.sync()"),
    );
    expect(source).not.toContain("console.log");
  });
});
