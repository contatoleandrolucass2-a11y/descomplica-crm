import { describe, expect, it } from "vitest";

import { isReadModelV3ShadowEnabled } from "@/lib/crm/read-model-v3/config";

describe("read model v3 shadow gate", () => {
  it("stays disabled when the server variable is absent or ambiguous", () => {
    expect(isReadModelV3ShadowEnabled({})).toBe(false);
    expect(isReadModelV3ShadowEnabled({ CRM_READ_MODEL_V3_SHADOW_ENABLED: "1" })).toBe(false);
    expect(isReadModelV3ShadowEnabled({ CRM_READ_MODEL_V3_SHADOW_ENABLED: "yes" })).toBe(false);
  });

  it("enables only an explicit true value", () => {
    expect(isReadModelV3ShadowEnabled({ CRM_READ_MODEL_V3_SHADOW_ENABLED: " true " })).toBe(true);
  });
});
