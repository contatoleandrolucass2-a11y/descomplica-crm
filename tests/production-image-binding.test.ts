import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseProductionImageBindingArguments,
  transformProductionImageEnvironment,
} from "@/scripts/release/bind-production-image.mjs";

const repositoryRoot = process.cwd();
const previousSha = "a".repeat(40);
const releaseSha = "b".repeat(40);
const previousImageId = `sha256:${"c".repeat(64)}`;
const releaseImageId = `sha256:${"d".repeat(64)}`;

describe("production image binding", () => {
  it("replaces exactly the expected IMAGE_TAG and preserves every other byte", () => {
    const original = [
      "APP_ORIGIN=https://crm.descomplicapro.com.br",
      `IMAGE_TAG=${previousSha}`,
      "SUPABASE_PUBLISHABLE_KEY=opaque-value-not-to-log",
      "LEGACY_MIGRATION_RUNTIME_MODE=off",
      "LEGACY_MIGRATION_ENABLED_MODULES=",
      "UNRELATED=value=with=separators",
      "",
    ].join("\r\n");

    expect(transformProductionImageEnvironment(original, previousSha, releaseSha)).toBe(
      [
        "APP_ORIGIN=https://crm.descomplicapro.com.br",
        `IMAGE_TAG=${releaseSha}`,
        "SUPABASE_PUBLISHABLE_KEY=opaque-value-not-to-log",
        "LEGACY_MIGRATION_RUNTIME_MODE=off",
        "LEGACY_MIGRATION_ENABLED_MODULES=",
        "UNRELATED=value=with=separators",
        "",
      ].join("\r\n"),
    );
  });

  it("supports a proven reverse CAS without changing unrelated configuration", () => {
    const failedRelease = `IMAGE_TAG=${releaseSha}\nUNCHANGED=secret-value\n`;
    expect(transformProductionImageEnvironment(failedRelease, releaseSha, previousSha)).toBe(
      `IMAGE_TAG=${previousSha}\nUNCHANGED=secret-value\n`,
    );
  });

  it("parses only the exact normal bind and proven rollback argument contracts", () => {
    expect(
      parseProductionImageBindingArguments([
        "--expected-old-sha",
        previousSha,
        "--new-sha",
        releaseSha,
        "--expected-image-id",
        releaseImageId,
      ]),
    ).toEqual({
      operation: "bind",
      expectedCurrentSha: previousSha,
      targetSha: releaseSha,
      boundarySha: releaseSha,
      expectedImageId: releaseImageId,
    });
    expect(
      parseProductionImageBindingArguments([
        "rollback",
        "--expected-current-sha",
        releaseSha,
        "--rollback-sha",
        previousSha,
        "--expected-image-id",
        previousImageId,
      ]),
    ).toEqual({
      operation: "rollback",
      expectedCurrentSha: releaseSha,
      targetSha: previousSha,
      boundarySha: releaseSha,
      expectedImageId: previousImageId,
    });
  });

  it.each([
    ["reordered normal flags", ["--new-sha", releaseSha]],
    ["missing expected image ID", ["--expected-old-sha", previousSha]],
    [
      "rollback target used as boundary",
      [
        "rollback",
        "--expected-current-sha",
        previousSha,
        "--rollback-sha",
        releaseSha,
        "--expected-image-id",
        "sha256:short",
      ],
    ],
  ])("rejects %s", (_label, arguments_) => {
    expect(() => parseProductionImageBindingArguments(arguments_)).toThrow();
  });

  it.each([
    ["missing IMAGE_TAG", "OTHER=value\n", previousSha, releaseSha],
    [
      "duplicate IMAGE_TAG",
      `IMAGE_TAG=${previousSha}\nIMAGE_TAG=${previousSha}\n`,
      previousSha,
      releaseSha,
    ],
    ["unexpected current SHA", `IMAGE_TAG=${releaseSha}\n`, previousSha, releaseSha],
    ["export syntax", `export IMAGE_TAG=${previousSha}\n`, previousSha, releaseSha],
    [
      "canonical plus exported duplicate",
      `IMAGE_TAG=${previousSha}\nexport IMAGE_TAG=${previousSha}\n`,
      previousSha,
      releaseSha,
    ],
    [
      "canonical plus whitespace duplicate",
      `IMAGE_TAG=${previousSha}\n  IMAGE_TAG = ${previousSha}\n`,
      previousSha,
      releaseSha,
    ],
    ["invalid current SHA", `IMAGE_TAG=${previousSha}\n`, "short", releaseSha],
    ["invalid target SHA", `IMAGE_TAG=${previousSha}\n`, previousSha, "B".repeat(40)],
    ["NUL byte", `IMAGE_TAG=${previousSha}\0\n`, previousSha, releaseSha],
  ])("fails closed for %s", (_label, contents, expectedCurrent, target) => {
    expect(() => transformProductionImageEnvironment(contents, expectedCurrent, target)).toThrow();
  });

  it("pins root-only CAS, same-image proof, atomic durability, and rollback contracts", async () => {
    const [source, packageJson] = await Promise.all([
      readFile(path.join(repositoryRoot, "scripts/release/bind-production-image.mjs"), "utf8"),
      readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    ]);
    const scripts = JSON.parse(packageJson).scripts;

    expect(scripts["release:bind-production-image"]).toBe(
      "node scripts/release/bind-production-image.mjs",
    );
    expect(source).toContain('const destination = "/etc/descomplica-crm/production.env"');
    expect(source).toContain(
      'const lockPath = "/etc/descomplica-crm/.production-image-binding.lock"',
    );
    expect(source).toContain("process.getuid?.() !== 0");
    expect(source).toContain('arguments_[0] !== "--expected-old-sha"');
    expect(source).toContain('arguments_[2] !== "--new-sha"');
    expect(source).toContain('arguments_[4] !== "--expected-image-id"');
    expect(source).toContain('arguments_[0] === "rollback"');
    expect(source).toContain('arguments_[1] === "--expected-current-sha"');
    expect(source).toContain('arguments_[3] === "--rollback-sha"');
    expect(source).toContain('["rev-parse", "HEAD"]');
    expect(source).toContain('["status", "--porcelain=v1", "--untracked-files=all"]');
    expect(source).toContain("constants.O_NOFOLLOW");
    expect(source).toContain("metadata.nlink !== 1");
    expect(source).toContain("(metadata.mode & 0o777) !== 0o600");
    expect(source).toContain('"image",\n      "inspect"');
    expect(source).toContain("org.opencontainers.image.revision");
    expect(source).toContain("fields[0] !== expectedImageId || fields[1] !== newSha");
    expect(source).toContain('open(temporary, "wx", 0o600)');
    expect(source).toContain("await handle.chown(0, 0)");
    expect(source).toContain("await handle.chmod(0o600)");
    expect(source).toContain("await handle.sync()");
    expect(source).toContain("await rename(temporary, destination)");
    expect(source).toContain('open(destinationDirectory, "r")');
    expect(source).toContain("await directory.sync()");
    expect(source).toContain("await assertEnvironmentUnchanged(originalContents)");
    expect(source).toContain("await assertEnvironmentUnchanged(transformedContents)");
    expect(source).toContain("restoreEnvironmentAfterFailedPostcondition");
    expect(source).toContain('"--exclusive"');
    expect(source).toContain('"--timeout"');
    expect(source.indexOf("await handle.sync()")).toBeLessThan(
      source.indexOf("await rename(temporary, destination)"),
    );
    expect(source.indexOf("await rename(temporary, destination)")).toBeLessThan(
      source.indexOf("await directory.sync()"),
    );
    expect(source).not.toContain("console.log");
  });
});
