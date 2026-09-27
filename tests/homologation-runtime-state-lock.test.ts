import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("homologation runtime state serialization", () => {
  it("uses one root-only advisory lock for every runtime state writer", async () => {
    const [lock, binder, appEnvironment, legacyEnvironment] = await Promise.all([
      readFile(path.join(repositoryRoot, "scripts/homologation/runtime-state-lock.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/homologation/bind-runtime-release.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "scripts/homologation/configure-app-env.mjs"), "utf8"),
      readFile(
        path.join(repositoryRoot, "scripts/homologation/configure-legacy-migration-runtime.mjs"),
        "utf8",
      ),
    ]);

    expect(lock).toContain(
      'runtimeStateLockPath = "/etc/descomplica-crm/.homologation-runtime-state.lock"',
    );
    expect(lock).toContain("process.getuid?.() !== 0");
    expect(lock).toContain('const flockPath = "/usr/bin/flock"');
    expect(lock).toContain('"--exclusive"');
    expect(lock).toContain('"--timeout"');
    expect(lock).toContain("metadata.uid !== 0");
    expect(lock).toContain("metadata.gid !== 0");
    expect(lock).toContain("metadata.nlink !== 1");
    expect(lock).toContain("(metadata.mode & 0o777) !== 0o600");
    expect(lock).toContain("constants.O_RDWR | constants.O_NOFOLLOW");

    for (const writer of [binder, appEnvironment, legacyEnvironment]) {
      expect(writer).toContain('import { enterRuntimeStateLock } from "./runtime-state-lock.mjs"');
      expect(writer).toContain("await enterRuntimeStateLock({");
    }
  });

  it("CAS-checks the environment snapshot after slow discovery and verifies the write", async () => {
    const source = await readFile(
      path.join(repositoryRoot, "scripts/homologation/configure-app-env.mjs"),
      "utf8",
    );

    expect(source).toContain("const originalSnapshot = await readEnvironmentSnapshot()");
    expect(source).toContain("await assertEnvironmentSnapshot(originalSnapshot)");
    expect(source).toContain("await assertEnvironmentSnapshot({ exists: true, contents })");
    expect(source.indexOf("const originalSnapshot = await readEnvironmentSnapshot()")).toBeLessThan(
      source.indexOf('"supabase", "status"'),
    );
    expect(source.indexOf('"supabase", "status"')).toBeLessThan(
      source.indexOf("await writeEnvironmentAtomically(contents, originalSnapshot)"),
    );
    expect(source.indexOf("await assertEnvironmentSnapshot(originalSnapshot)")).toBeLessThan(
      source.indexOf("await rename(temporary, destination)"),
    );
    expect(
      source.indexOf("await assertEnvironmentSnapshot({ exists: true, contents })"),
    ).toBeGreaterThan(source.indexOf("await rename(temporary, destination)"));
  });
});
