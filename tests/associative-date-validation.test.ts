import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { syntheticLinearInput } from "../scripts/qa/associative-scenario-matrix.mjs";

type Result = { ok: boolean; errors: string[] };
const require = createRequire(import.meta.url);
const { calculateAssociativeLinear } =
  require("../lib/archive-investor/associative-linear-calculator-rules.mjs") as {
    calculateAssociativeLinear: (
      input: ReturnType<typeof syntheticLinearInput>,
      options: { today: string },
    ) => Result;
  };
const { calculateAssociativeDecreasing } =
  require("../lib/archive-investor/associative-decreasing-calculator-rules.mjs") as {
    calculateAssociativeDecreasing: (input: Record<string, unknown>) => Result;
  };

const decreasing = (firstInstallmentDate: unknown) =>
  calculateAssociativeDecreasing({
    uncorrectedBalance: 40000,
    correctedBalance: 42000,
    installments: 84,
    preInstallments: 42,
    postInstallments: 42,
    firstInstallmentDate,
  });

describe("Associativo calendar date integrity", () => {
  it.each([
    "2027-02-29",
    "2028-02-30",
    "2027-04-31",
    "2027-13-01",
    "2027-00-01",
    "2027-01-00",
    "2027-2-01",
    "",
    null,
  ])("rejects nonexistent or non-ISO date %s in both engines", (invalid) => {
    expect(decreasing(invalid).ok).toBe(false);
    for (const field of ["entryDate", "constructionEnd"]) {
      expect(
        calculateAssociativeLinear(syntheticLinearInput({ [field]: invalid }), {
          today: "2026-10-04",
        }).ok,
      ).toBe(false);
    }
    if (typeof invalid === "string") {
      expect(calculateAssociativeLinear(syntheticLinearInput(), { today: invalid }).ok).toBe(false);
    }
  });
  it.each(["2028-02-29", "2027-02-28", "2027-04-30", "2027-12-31"])(
    "preserves real calendar date %s",
    (valid) => {
      expect(decreasing(valid).ok).toBe(true);
      expect(
        calculateAssociativeLinear(syntheticLinearInput({ constructionEnd: valid }), {
          today: "2026-10-04",
        }).ok,
      ).toBe(true);
    },
  );
});
