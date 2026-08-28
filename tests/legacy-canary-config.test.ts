import { describe, expect, it } from "vitest";

import { transformLegacyCanaryEnvironment } from "@/scripts/homologation/configure-legacy-canary.mjs";

describe("homologation legacy canary configuration", () => {
  it("updates only non-secret runtime gates", () => {
    const original = [
      "IMAGE_TAG=a".padEnd(50, "a"),
      "SUPABASE_PUBLISHABLE_KEY=opaque-value-not-to-log",
      "OFFICIAL_SIMULATOR_RUNTIME_MODE=off",
      "OFFICIAL_SIMULATOR_ENABLED_KEYS=",
      "",
    ].join("\n");
    const enabled = transformLegacyCanaryEnvironment(original, "enable");
    expect(enabled).toContain("SUPABASE_PUBLISHABLE_KEY=opaque-value-not-to-log");
    expect(enabled).toContain("OFFICIAL_SIMULATOR_RUNTIME_MODE=active");
    expect(enabled).toContain("LEGACY_MIGRATION_RUNTIME_MODE=active");
    const disabled = transformLegacyCanaryEnvironment(enabled, "disable");
    expect(disabled).toContain("OFFICIAL_SIMULATOR_RUNTIME_MODE=off");
    expect(disabled).toContain("LEGACY_MIGRATION_RUNTIME_MODE=off");
    expect(disabled).not.toContain("=active");
  });

  it("rejects duplicates and unknown modes", () => {
    expect(() =>
      transformLegacyCanaryEnvironment(
        "LEGACY_MIGRATION_RUNTIME_MODE=off\nLEGACY_MIGRATION_RUNTIME_MODE=off\n",
        "enable",
      ),
    ).toThrow(/duplicate/u);
    expect(() => transformLegacyCanaryEnvironment("", "invalid" as "enable")).toThrow(
      /enable or disable/u,
    );
  });
});
