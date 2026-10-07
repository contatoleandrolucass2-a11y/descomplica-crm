import { describe, expect, it } from "vitest";

// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateAssociativeLinear } from "@/lib/archive-investor/associative-linear-calculator-rules.mjs";

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
  signalLimit: number;
  entry: number;
  signalTotal: number;
  available: boolean;
  firstInstallmentDate: string;
  linear: {
    ok: boolean;
    errors: string[];
    calculationDate: string;
    baseSignalDate: string;
    signalDates: string[];
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

  it("reproduces a historical calculation with an independent entry date", () => {
    const dates = {
      entryDate: "2026-01-20",
      firstInterestDate: "2025-12-31",
      firstInstallmentDate: "2026-02-15",
    };
    const result = calculateInvestorFlow({ ...input, ...dates });
    const historical = calculateAssociativeLinear(
      {
        development: "Estoque selecionado",
        product: input.selectedUnitId,
        stockMatch: true,
        policyConfirmed: true,
        policyLimit: 84,
        installments: input.installments,
        calculationDate: input.baseDate,
        constructionEnd: input.completionDate,
        ...dates,
        salePrice: input.salePrice,
        bonus: 0,
        discount: 0,
        financing: input.financing,
        subsidy: 0,
        fgts: 0,
        housingCheck: 0,
        entry: input.entryValue,
        signal1: 0,
        signal2: 0,
        signal3: 0,
        annual1: 0,
        annual2: 0,
        annual3: 0,
        annual4: 0,
        annual5: 0,
      },
      { today: input.baseDate },
    );
    expect(result.ok).toBe(true);
    expect(result.custom.linear).toEqual(historical);
    expect(result.custom.linear).toMatchObject({
      calculationDate: "2026-01-16",
      firstInterestDate: "2025-12-31",
      firstInstallmentDate: "2026-02-15",
      monthlyCorrectionMonths: 1,
    });
    expect(result.context.monthlyDates[0]).toBe("2026-02-15");
    expect(result).toEqual(
      calculateInvestorFlow({ ...input, ...dates, entryDate: input.baseDate }),
    );
  });

  it.each([null, undefined])("defaults entry date %s to the calculation date", (entryDate) => {
    expect(calculateInvestorFlow({ ...input, entryDate })).toEqual(calculateInvestorFlow(input));
  });

  it.each(["", "2026-02-30"])("rejects explicit entry date %s in all plans", (entryDate) => {
    const result = calculateInvestorFlow({ ...input, entryDate });
    expect(result.ok).toBe(false);
    expect(result.custom.linear.ok).toBe(false);
    expect(result.custom.linear.errors).toContain("Informe uma data vigente válida.");
    expect(result.context.signalBaseDate).toBe("");
    expect(result.custom.signals.map((signal: { date: string }) => signal.date)).toEqual([
      "",
      "",
      "",
    ]);
    expect(result.standardScenarios).toHaveLength(4);
    for (const scenario of result.standardScenarios as Scenario[]) {
      expect(scenario.available).toBe(false);
      expect(scenario.linear.ok).toBe(false);
      expect(scenario.linear.errors).toContain("Informe uma data vigente válida.");
    }
  });

  it("anchors custom signals and all four standard plans to entry while preserving calculation dates", () => {
    const result = calculateInvestorFlow({
      ...input,
      entryDate: "2026-02-20",
      firstInstallmentDate: "2026-06-15",
      signals: [1_000, 900, 800],
    });
    const signalDates = ["2026-03-15", "2026-04-15", "2026-05-15"];
    expect(result.ok).toBe(true);
    expect(result.context.signalBaseDate).toBe(signalDates[0]);
    expect(result.custom.linear.signalDates).toEqual(signalDates);
    expect(result.custom.signals.map((signal: { date: string }) => signal.date)).toEqual(
      signalDates,
    );
    expect(result.standardScenarios).toHaveLength(4);
    for (const scenario of result.standardScenarios as Scenario[]) {
      expect(scenario.available).toBe(true);
      expect(scenario.linear).toMatchObject({
        calculationDate: input.baseDate,
        baseSignalDate: signalDates[0],
        firstInterestDate: "2025-12-31",
        monthlyCorrectionMonths: 5,
      });
      expect(scenario.firstInstallmentDate).toBe("2026-06-15");
      expect(scenario.linear.signalDates).toEqual(
        scenario.signalLimit > 0 ? signalDates : ["", "", ""],
      );
    }
  });

  it.each(["2026-02-15", "2026-02-16"])(
    "rejects a first monthly payment on or before independent entry %s",
    (entryDate) => {
      const result = calculateInvestorFlow({
        ...input,
        entryDate,
        firstInstallmentDate: "2026-02-15",
      });
      expect(result.ok).toBe(false);
      expect(result.custom.linear.errors).toContain(
        "A primeira mensal deve ser posterior à entrada.",
      );
      expect(result.standardScenarios).toHaveLength(4);
      for (const scenario of result.standardScenarios as Scenario[]) {
        expect(scenario.available).toBe(false);
        expect(scenario.linear.errors).toContain("A primeira mensal deve ser posterior à entrada.");
      }
    },
  );

  it.each(["2026-05-10", "2026-05-15"])(
    "rejects monthly date %s before the entry-anchored signal sequence ends",
    (firstInstallmentDate) => {
      const result = calculateInvestorFlow({
        ...input,
        entryDate: "2026-02-20",
        firstInstallmentDate,
        signals: [1_000, 900, 800],
      });
      expect(result.ok).toBe(false);
      expect(result.custom.linear.errors).toContain(
        "A primeira mensal deve ser posterior ao último sinal.",
      );
      expect(result.standardScenarios).toHaveLength(4);
      for (const scenario of result.standardScenarios as Scenario[]) {
        expect(scenario.available).toBe(scenario.signalLimit === 0);
        if (scenario.signalLimit > 0)
          expect(scenario.linear.errors).toContain(
            "A primeira mensal deve ser posterior ao último sinal.",
          );
      }
    },
  );

  it.each(["2026-02-20", "", "2026-02-30"])(
    "ignores entry date %s outside Associativo",
    (entryDate) => {
      const investor = { ...input, annualMode: false, entryValue: 30_000, installments: 18 };
      expect(calculateInvestorFlow({ ...investor, entryDate })).toEqual(
        calculateInvestorFlow(investor),
      );
    },
  );

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
