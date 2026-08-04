import { describe, expect, it } from "vitest";

import { isThemeMode, THEME_MODES } from "../lib/interface/theme";

describe("protected interface shell", () => {
  it("keeps the three migrated appearance modes", () => {
    expect(THEME_MODES.map((theme) => theme.key)).toEqual(["light", "balanced", "dark"]);
  });

  it("rejects persisted values outside the appearance catalog", () => {
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("medium")).toBe(false);
    expect(isThemeMode({ key: "dark" })).toBe(false);
  });
});
