import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseMasterProvisioningArguments,
  selectMasterProvisioningRequest,
  validateMasterProvisioningManifest,
} from "@/ops/access/master-provisioning-lib.mjs";

const manifestPath = path.join(process.cwd(), "ops/access/master-provisioning.json");
const revision = "a".repeat(40);

describe("source-controlled Master provisioning", () => {
  it("accepts the reviewed manifest without storing an email or credential", async () => {
    const source = await readFile(manifestPath, "utf8");
    const manifest = validateMasterProvisioningManifest(JSON.parse(source));

    expect(manifest.requests).toHaveLength(1);
    expect(source).not.toContain("@");
    expect(source).not.toMatch(/password|token|secret/iu);
    expect(manifest.requests[0]?.targetEmailSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("requires the request to match the selected environment", async () => {
    const manifest = validateMasterProvisioningManifest(
      JSON.parse(await readFile(manifestPath, "utf8")),
    );

    expect(
      selectMasterProvisioningRequest(manifest, "master-production-2026-09-01-01", "production")
        .environment,
    ).toBe("production");
    expect(() =>
      selectMasterProvisioningRequest(manifest, "master-production-2026-09-01-01", "homologation"),
    ).toThrow(/does not match/u);
  });

  it("binds apply to an exact source request and revision", () => {
    const common = [
      "--change-ref",
      "master-production-2026-09-01-01",
      "--database-url-file",
      "/run/secrets/database-url",
      "--environment",
      "production",
      "--expected-sha",
      revision,
    ];

    expect(parseMasterProvisioningArguments(["preflight", ...common]).mode).toBe("preflight");
    expect(
      parseMasterProvisioningArguments([
        "apply",
        ...common,
        "--confirm",
        `promote:master-production-2026-09-01-01:${revision}`,
      ]).mode,
    ).toBe("apply");
    expect(() =>
      parseMasterProvisioningArguments(["apply", ...common, "--confirm", "wrong"]),
    ).toThrow(/confirmation/u);
  });

  it("rejects duplicate or unreviewed authorization entries", () => {
    const request = {
      changeRef: "master-production-2026-09-01-01",
      environment: "production",
      targetEmailSha256: "b".repeat(64),
      termsVersion: "terms-2026-08-24-draft-1",
      privacyVersion: "privacy-2026-08-24-draft-1",
      status: "authorized",
    };

    expect(() =>
      validateMasterProvisioningManifest({ schemaVersion: 1, requests: [request, request] }),
    ).toThrow(/unique/u);
    expect(() =>
      validateMasterProvisioningManifest({
        schemaVersion: 1,
        requests: [{ ...request, status: "pending" }],
      }),
    ).toThrow(/invalid/u);
  });
});
