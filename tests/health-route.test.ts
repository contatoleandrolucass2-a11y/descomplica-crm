import { describe, expect, it } from "vitest";

import { getDeploymentVersion } from "@/app/api/health/route";

describe("health release identity", () => {
  it("exposes only a bounded deployment identifier", () => {
    expect(getDeploymentVersion("81968eb-release.1")).toBe("81968eb-release.1");
    expect(getDeploymentVersion("release_candidate-31")).toBe("release_candidate-31");
  });

  it("fails closed for missing or unsafe values", () => {
    expect(getDeploymentVersion(undefined)).toBe("unknown");
    expect(getDeploymentVersion("value with spaces")).toBe("unknown");
    expect(getDeploymentVersion("https://example.invalid/token")).toBe("unknown");
    expect(getDeploymentVersion(`v${"x".repeat(128)}`)).toBe("unknown");
  });
});
