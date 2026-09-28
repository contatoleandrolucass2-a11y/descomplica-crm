import { describe, expect, it } from "vitest";

// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateAssociativeApproval } from "@/lib/archive-investor/associative-approval-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { buildAssociativePaymentComparison } from "@/lib/archive-investor/associative-installment-memory.mjs";

const synthetic = {
  selectedUnitId: "synthetic-A",
  baseDate: "2026-09-28",
  completionDate: "2028-12-31",
  salePrice: 300_000,
  annualMode: true,
  financing: 240_000,
  subsidy: 0,
  fgts: 0,
  housingCheck: 0,
  income: 10_000,
  entryValue: 15_000,
  installments: "84",
  signals: [0, 0, 0],
  intermediaries: [0, 0, 0, 0, 0],
  approvalTierId: "bronze",
};

type AuditItem = { id: string; ok: boolean };
type Signal = { date: string; value: number; index: number };
type ComparisonRow = {
  kind: string;
  paymentDate: string;
  constructionProgress: number | null;
  workEvolution: number | null;
  linearTotal: number;
  decreasingTotal: number;
};

describe("Associative audit regressions with synthetic inputs", () => {
  it.each(["1", "84", 1, 84])("accepts the integer boundary %s", (installments) => {
    const result = calculateInvestorFlow({ ...synthetic, installments });

    expect(result.audit.find((item: AuditItem) => item.id === "installments")?.ok).toBe(true);
    expect(result.context.monthlyDates).toHaveLength(Number(installments));
    expect(result.custom.desiredInstallments).toBe(Number(installments));
  });

  it.each(["4294967296", "85", "1e1", "84x", "84.5", "84,0", "", "-1", "0"])(
    "rejects invalid installment input %s before building its schedule",
    (installments) => {
      const result = calculateInvestorFlow({ ...synthetic, installments });

      expect(result.ok).toBe(false);
      expect(result.audit.find((item: AuditItem) => item.id === "installments")?.ok).toBe(false);
      expect(result.context.monthlyDates).toEqual([]);
      expect(result.standardScenarios).toEqual([]);
    },
  );

  it("accepts exactly 15% in cents and rejects one cent above Bronze", () => {
    const calculate = (financing: number) => {
      const result = calculateInvestorFlow({ ...synthetic, salePrice: 300_000.4, financing });
      return calculateAssociativeApproval({
        tierId: "bronze",
        income: synthetic.income,
        realSaleValue: result.context.valueReal,
        proSoluto: result.custom.balanceBeforeCorrection,
        linearInstallment: result.custom.installmentValue,
        decreasingInstallment: result.custom.installmentValue,
        linearMaximumIncomePayment: result.custom.installmentValue + 3_000,
        decreasingMaximumIncomePayment: result.custom.installmentValue + 3_000,
        proposalValid: result.ok,
        paymentComparisonValid: true,
      });
    };

    expect(calculate(240_000.34).status).toBe("approved");
    expect(
      calculate(240_000.33).checks.find((item: AuditItem) => item.id === "pro-soluto")?.ok,
    ).toBe(false);
    expect(calculate(240_000.33).status).toBe("rejected");
  });

  it.each([
    ["commitment", "linearInstallment", 1_500.06, 1_500.07],
    ["commitment", "decreasingInstallment", 1_500.06, 1_500.07],
    ["annual-income", "linearMaximumIncomePayment", 4_500.18, 4_500.19],
    ["annual-income", "decreasingMaximumIncomePayment", 4_500.18, 4_500.19],
  ] as const)("compares %s / %s in cents", (id, field, exact, above) => {
    const input = {
      tierId: "bronze",
      income: 10_000.4,
      realSaleValue: 300_000.4,
      proSoluto: 45_000.06,
      linearInstallment: 1_000,
      decreasingInstallment: 1_000,
      linearMaximumIncomePayment: 4_000,
      decreasingMaximumIncomePayment: 4_000,
    };
    expect(calculateAssociativeApproval({ ...input, [field]: exact }).status).toBe("approved");
    const rejected = calculateAssociativeApproval({ ...input, [field]: above });
    expect(rejected.status).toBe("rejected");
    expect(rejected.checks.find((item: AuditItem) => item.id === id)?.ok).toBe(false);
  });

  it.each(["linearMaximumIncomePayment", "decreasingMaximumIncomePayment"])(
    "does not round a fractional-cent annual-income limit upward for %s",
    (field) => {
      const input = {
        tierId: "bronze",
        income: 10_000.01,
        realSaleValue: 300_000,
        proSoluto: 45_000,
        linearInstallment: 1_000,
        decreasingInstallment: 1_000,
        linearMaximumIncomePayment: 4_000,
        decreasingMaximumIncomePayment: 4_000,
      };
      // 45% of R$ 10,000.01 is R$ 4,500.0045, below R$ 4,500.01.
      expect(calculateAssociativeApproval({ ...input, [field]: 4_500 }).status).toBe("approved");
      const rejected = calculateAssociativeApproval({ ...input, [field]: 4_500.01 });
      expect(rejected.status).toBe("rejected");
      expect(rejected.checks.find((item: AuditItem) => item.id === "annual-income")?.ok).toBe(
        false,
      );
    },
  );

  it("uses the existing archive signal sequence in wrapper and linear result", () => {
    const result = calculateInvestorFlow({
      ...synthetic,
      baseDate: "2026-01-05",
      signals: [1_000, 1_000, 1_000],
    });

    expect(result.custom.linear.signalDates).toEqual(["2026-02-05", "2026-03-05", "2026-04-05"]);
    expect(result.custom.signals.map((signal: Signal) => signal.date)).toEqual(
      result.custom.linear.signalDates,
    );
    expect(result.context.signalBaseDate).toBe(result.custom.linear.baseSignalDate);
  });

  it("preserves the investor calendar outside annual mode", () => {
    const result = calculateInvestorFlow({
      ...synthetic,
      annualMode: false,
      baseDate: "2026-01-05",
      entryValue: 30_000,
      installments: "18",
      signals: [1_000, 1_000, 1_000],
    });

    expect(result.ok).toBe(true);
    expect(result.custom.signals.map((signal: Signal) => signal.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  it.each(["2027-02-29", "2028-02-30", "2027-04-31", "2027-13-01"])(
    "rejects impossible completion date %s",
    (completionDate) => {
      const result = calculateInvestorFlow({ ...synthetic, completionDate });
      expect(result.ok).toBe(false);
      expect(result.audit.find((item: AuditItem) => item.id === "context")?.ok).toBe(false);
      expect(result.custom.linear).toBeNull();
      expect(result.standardScenarios).toEqual([]);
    },
  );

  it("rejects an impossible base date and accepts leap day in a leap year", () => {
    expect(calculateInvestorFlow({ ...synthetic, baseDate: "2026-02-29" }).ok).toBe(false);
    const result = calculateInvestorFlow({ ...synthetic, completionDate: "2028-02-29" });
    expect(result.ok).toBe(true);
    expect(result.context.deadline).toBe("2028-02-29");
  });

  it("charges work evolution in November and December during signals, once per month", () => {
    const flow = calculateInvestorFlow({
      ...synthetic,
      completionDate: "2027-09-30",
      signals: [1_000, 1_000, 1_000],
    });
    expect(flow.context.monthlyDates[0]).toBe("2027-01-15");
    const comparison = buildAssociativePaymentComparison({
      monthlyDates: flow.context.monthlyDates,
      installments: 84,
      linearSchedule: Array.from({ length: 84 }, () => ({ payment: 500 })),
      decreasingBlocks: [{ count: 84, correctedInstallment: 600 }],
      income: 10_000,
      constructionProgress: 20,
      baseDate: synthetic.baseDate,
      completionDate: "2027-09-30",
      entryPayment: { kind: "entry", label: "Entrada", date: synthetic.baseDate, value: 15_000 },
      signals: flow.custom.signals.map((signal: Signal) => ({
        label: `Sinal ${signal.index}`,
        date: signal.date,
        value: signal.value,
      })),
      annuals: [
        { date: "2026-12-15", value: 500 },
        { date: "2027-01-10", value: 500 },
        { date: "2027-02-15", value: 500 },
      ],
    });
    const rows: ComparisonRow[] = comparison.rows;
    expect(
      rows
        .filter((row) => row.paymentDate < "2026-11-01")
        .every((row) => row.workEvolution == null),
    ).toBe(true);
    for (const [month, amount] of [
      ["2026-11", 1_000],
      ["2026-12", 1_200],
      ["2027-01", 1_400],
    ] as const) {
      const charges = rows.filter(
        (row) => row.paymentDate.startsWith(month) && row.workEvolution != null,
      );
      expect(charges).toHaveLength(1);
      expect(charges[0]?.workEvolution).toBeCloseTo(amount, 8);
    }
    expect(rows.find((row) => row.paymentDate === "2027-02-15")?.linearTotal).toBeCloseTo(2_600, 8);
    expect(rows.find((row) => row.paymentDate === "2027-02-15")?.decreasingTotal).toBeCloseTo(
      2_700,
      8,
    );
    expect(rows.find((row) => row.paymentDate === "2027-09-15")?.workEvolution).toBe(3_000);
    expect(rows.find((row) => row.paymentDate === "2027-10-15")?.constructionProgress).toBe(1);
    expect(rows.find((row) => row.paymentDate === "2027-10-15")?.workEvolution).toBe(3_000);
    expect(comparison.highestLinearTotal).toBe(3_500);
    expect(comparison.highestDecreasingTotal).toBe(3_600);
  });

  it("charges an annual-only month while preserving unavailable progress", () => {
    const input = {
      income: 10_000,
      constructionProgress: 20,
      baseDate: synthetic.baseDate,
      completionDate: "2027-09-30",
      annuals: [{ date: "2026-12-15", value: 500 }],
    };
    const row = buildAssociativePaymentComparison(input).rows[0];
    expect(row.workEvolution).toBeCloseTo(1_200, 8);
    expect(row.linearTotal).toBeCloseTo(1_700, 8);
    expect(row.decreasingTotal).toBeCloseTo(1_700, 8);
    expect(
      buildAssociativePaymentComparison({ ...input, constructionProgress: null }).rows[0]
        .workEvolution,
    ).toBeNull();
    expect(
      buildAssociativePaymentComparison({ ...input, income: 0 }).rows[0].workEvolution,
    ).toBeNull();
  });
});
