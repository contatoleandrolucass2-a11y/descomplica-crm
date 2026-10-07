import { describe, expect, it } from "vitest";

// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";

const input = {
  selectedUnitId: "synthetic-calendar-unit",
  annualMode: true,
  baseDate: "2026-01-16",
  completionDate: "2028-12-31",
  salePrice: 300_000,
  financing: 200_000,
  income: 80_000,
  entryValue: 1_000,
  installments: 84,
  signals: [0, 0, 0],
  intermediaries: [0, 0, 0, 0, 0],
  approvalTierId: "bronze",
};

type Scenario = {
  entry: number;
  signalTotal: number;
  available: boolean;
  firstInstallmentDate: string;
  linear: {
    correctedProSoluto: number;
    firstInterestDate: string;
    monthlyCorrectionMonths: number;
  };
  approval: { proSolutoRate: number };
};

describe("Associative calendar integration", () => {
  it.each(["2025-12-31", "2028-12-31"])(
    "makes standard plans respect the corrected pro-soluto cap for end date %s",
    (completionDate) => {
      const result = calculateInvestorFlow({ ...input, completionDate });
      expect(result.standardScenarios).toHaveLength(4);
      for (const scenario of result.standardScenarios as Scenario[]) {
        expect(scenario.available).toBe(true);
        expect(scenario.linear.correctedProSoluto).toBeLessThanOrEqual(45_000);
        expect(scenario.approval.proSolutoRate).toBeLessThanOrEqual(0.15);
        expect(scenario.entry + scenario.signalTotal).toBeGreaterThan(55_000);
      }
    },
  );

  it("preserves explicit financial dates in editable and standard plans", () => {
    const result = calculateInvestorFlow({
      ...input,
      firstInterestDate: "2025-10-31",
      firstInstallmentDate: "2026-06-15",
    });
    expect(result.ok).toBe(true);
    expect(result.custom.linear.firstInterestDate).toBe("2025-10-31");
    expect(result.custom.linear.monthlyCorrectionMonths).toBe(7);
    expect(result.context.monthlyDates[0]).toBe("2026-06-15");
    for (const scenario of result.standardScenarios as Scenario[]) {
      expect(scenario.firstInstallmentDate).toBe("2026-06-15");
      expect(scenario.linear.firstInterestDate).toBe("2025-10-31");
      expect(scenario.linear.monthlyCorrectionMonths).toBe(7);
    }
  });

  it.each(["", "2026-02-30"])("does not repair an invalid explicit date %s silently", (date) => {
    const result = calculateInvestorFlow({ ...input, firstInstallmentDate: date });
    expect(result.ok).toBe(false);
    expect(result.custom.linear.ok).toBe(false);
    expect(result.standardScenarios.every((scenario: Scenario) => !scenario.available)).toBe(true);
  });

  it("moves the pre/post boundary by unit end month, never the end day", () => {
    const calculate = (completionDate: string) =>
      calculateInvestorFlow({
        ...input,
        completionDate,
        firstInstallmentDate: "2026-02-15",
      }).custom.linear;
    const early = calculate("2028-12-01");
    const late = calculate("2028-12-31");
    const next = calculate("2029-01-01");
    expect([early.preInstallments, early.postInstallments]).toEqual([34, 50]);
    expect(late.correctedInstallment).toBe(early.correctedInstallment);
    expect([next.preInstallments, next.postInstallments]).toEqual([35, 49]);
    expect(next.correctedInstallment).toBeLessThan(late.correctedInstallment);
  });
});
