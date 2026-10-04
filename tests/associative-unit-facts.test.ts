import { describe, expect, it } from "vitest";
import { resolveAssociativeConstructionProgress } from "@/lib/archive-investor/associative-unit-facts";

describe("official construction progress for missing inventory facts", () => {
  it.each(["", " ", "-1", "100.0001", "NaN", "Infinity", "1e2", "15%", "0x10"])(
    "does not invent a percentage from %s",
    (value) => expect(resolveAssociativeConstructionProgress(null, value)).toBeNull(),
  );
  it.each([
    ["0", 0],
    ["15", 0.15],
    ["15,25", 0.1525],
    ["15.25", 0.1525],
    ["100", 1],
  ] as const)("accepts the explicit official percentage %s", (value, expected) =>
    expect(resolveAssociativeConstructionProgress(null, value)).toBe(expected),
  );
  it.each([0, 0.15, 1])("keeps the reported percentage %s authoritative", (value) => {
    expect(resolveAssociativeConstructionProgress(value, "90")).toBe(value);
  });
  it.each([undefined, null, NaN, Infinity, -0.01, 1.01])(
    "rejects invalid source %s without a manual fact",
    (value) => {
      expect(resolveAssociativeConstructionProgress(value, "")).toBeNull();
    },
  );
});
