import { describe, expect, it } from "vitest";

import { isHomologationMode, isPublicSignupEnabled } from "../lib/homologation/config";

describe("isolated homologation configuration", () => {
  it("requires an explicit homologation flag", () => {
    expect(isHomologationMode({})).toBe(false);
    expect(isHomologationMode({ HOMOLOGATION_MODE: "true" })).toBe(true);
    expect(isHomologationMode({ HOMOLOGATION_MODE: "TRUE" })).toBe(true);
    expect(isHomologationMode({ HOMOLOGATION_MODE: "1" })).toBe(false);
  });

  it("preserves signup unless an environment explicitly disables it", () => {
    expect(isPublicSignupEnabled({})).toBe(true);
    expect(isPublicSignupEnabled({ PUBLIC_SIGNUP_ENABLED: "true" })).toBe(true);
    expect(isPublicSignupEnabled({ PUBLIC_SIGNUP_ENABLED: "false" })).toBe(false);
    expect(isPublicSignupEnabled({ PUBLIC_SIGNUP_ENABLED: "FALSE" })).toBe(false);
  });
});
