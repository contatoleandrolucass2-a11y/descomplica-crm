import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { transformLegacyMigrationRuntimeEnvironment } from "@/scripts/homologation/configure-legacy-migration-runtime.mjs";

const repositoryRoot = process.cwd();

describe("homologation legacy migration runtime configuration", () => {
  it("disables only the two legacy flags and preserves every other byte", () => {
    const original = [
      "IMAGE_TAG=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "SUPABASE_PUBLISHABLE_KEY=opaque-value-not-to-log",
      "OFFICIAL_SIMULATOR_RUNTIME_MODE=active",
      "OFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13,simulator.wf16",
      "LEGACY_MIGRATION_RUNTIME_MODE=active",
      "LEGACY_MIGRATION_ENABLED_MODULES=simulator.wf16,dialer",
      "UNRELATED=value=with=separators",
      "",
    ].join("\r\n");

    expect(transformLegacyMigrationRuntimeEnvironment(original, "disable")).toBe(
      [
        "IMAGE_TAG=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "SUPABASE_PUBLISHABLE_KEY=opaque-value-not-to-log",
        "OFFICIAL_SIMULATOR_RUNTIME_MODE=active",
        "OFFICIAL_SIMULATOR_ENABLED_KEYS=simulator.wf13,simulator.wf16",
        "LEGACY_MIGRATION_RUNTIME_MODE=off",
        "LEGACY_MIGRATION_ENABLED_MODULES=",
        "UNRELATED=value=with=separators",
        "",
      ].join("\r\n"),
    );
  });

  it("is idempotent when both legacy flags are already disabled", () => {
    const disabled = [
      "OFFICIAL_SIMULATOR_RUNTIME_MODE=active",
      "LEGACY_MIGRATION_RUNTIME_MODE=off",
      "LEGACY_MIGRATION_ENABLED_MODULES=",
      "",
    ].join("\n");

    expect(transformLegacyMigrationRuntimeEnvironment(disabled, "disable")).toBe(disabled);
  });

  it.each([
    ["missing runtime mode", "LEGACY_MIGRATION_ENABLED_MODULES=dialer\n", "disable"],
    ["missing enabled modules", "LEGACY_MIGRATION_RUNTIME_MODE=active\n", "disable"],
    [
      "duplicate runtime mode",
      [
        "LEGACY_MIGRATION_RUNTIME_MODE=active",
        "LEGACY_MIGRATION_RUNTIME_MODE=off",
        "LEGACY_MIGRATION_ENABLED_MODULES=",
        "",
      ].join("\n"),
      "disable",
    ],
    [
      "duplicate enabled modules",
      [
        "LEGACY_MIGRATION_RUNTIME_MODE=active",
        "LEGACY_MIGRATION_ENABLED_MODULES=dialer",
        "LEGACY_MIGRATION_ENABLED_MODULES=simulator.wf16",
        "",
      ].join("\n"),
      "disable",
    ],
    [
      "unknown command",
      "LEGACY_MIGRATION_RUNTIME_MODE=active\nLEGACY_MIGRATION_ENABLED_MODULES=dialer\n",
      "enable",
    ],
  ])("fails closed for %s", (_label, contents, command) => {
    expect(() =>
      transformLegacyMigrationRuntimeEnvironment(contents, command as "disable"),
    ).toThrow();
  });

  it("pins root-only atomic persistence without printing environment values", async () => {
    const source = await readFile(
      path.join(repositoryRoot, "scripts/homologation/configure-legacy-migration-runtime.mjs"),
      "utf8",
    );

    expect(source).toContain('const destination = "/etc/descomplica-crm/homologation.env";');
    expect(source).toContain("process.getuid?.() !== 0");
    expect(source).toContain('arguments_.length !== 1 || arguments_[0] !== "disable"');
    expect(source).toContain("metadata.uid !== 0");
    expect(source).toContain("metadata.gid !== 0");
    expect(source).toContain("(metadata.mode & 0o777) !== 0o600");
    expect(source).toContain('open(temporary, "wx", 0o600)');
    expect(source).toContain("await handle.chown(0, 0)");
    expect(source).toContain("await handle.chmod(0o600)");
    expect(source).toContain("await handle.sync()");
    expect(source).toContain("await rename(temporary, destination)");
    expect(source).toContain('open(destinationDirectory, "r")');
    expect(source).toContain("await directory.sync()");
    expect(source).toContain("if (temporaryCreated) await rm(temporary, { force: true })");
    expect(source).toContain('import { enterRuntimeStateLock } from "./runtime-state-lock.mjs"');
    expect(source).toContain("await assertDestinationUnchanged(originalContents)");
    expect(source).toContain("await assertDestinationUnchanged(transformed)");
    expect(source.indexOf("await assertDestinationUnchanged(originalContents)")).toBeLessThan(
      source.indexOf("await rename(temporary, destination)"),
    );
    expect(source.indexOf("await assertDestinationUnchanged(transformed)")).toBeGreaterThan(
      source.indexOf("await rename(temporary, destination)"),
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
