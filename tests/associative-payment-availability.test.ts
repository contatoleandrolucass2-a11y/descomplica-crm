import { describe, expect, it } from "vitest";

// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateAssociativeApproval } from "@/lib/archive-investor/associative-approval-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import * as associativeMemory from "@/lib/archive-investor/associative-installment-memory.mjs";

const { buildAssociativeInstallmentMemory, buildAssociativePaymentComparison } = associativeMemory;

const comparisonInput = {
  monthlyDates: ["2026-10-15", "2026-11-15", "2026-12-15"],
  installments: 3,
  linearSchedule: [{ payment: 600 }, { payment: 600 }, { payment: 600 }],
  decreasingBlocks: [{ count: 3, correctedInstallment: 700 }],
  income: 5_000,
  constructionProgress: 20,
  baseDate: "2026-10-04",
  completionDate: "2035-12-30",
};

const approvalInput = {
  tierId: "bronze",
  income: 5_000,
  realSaleValue: 231_990,
  proSoluto: 34_798.5,
  linearInstallment: 750,
  decreasingInstallment: 750,
  linearMaximumIncomePayment: 2_250,
  decreasingMaximumIncomePayment: 2_250,
};

describe("Associative payment and construction availability", () => {
  it("preserves the exact financial oracle without inventing construction progress", () => {
    const flow = calculateInvestorFlow({
      selectedUnitId: "synthetic-financial-review",
      annualMode: true,
      baseDate: "2026-10-04",
      completionDate: "2035-12-30",
      salePrice: 231_990,
      financing: 190_000,
      subsidy: 0,
      fgts: 0,
      housingCheck: 0,
      income: 5_000,
      entryValue: 1_000,
      installments: 84,
      signals: [0, 0, 0],
      intermediaries: [0, 0, 0, 0, 0],
      approvalTierId: "bronze",
    });
    const linear = flow.custom.linear;
    const schedule = buildAssociativeInstallmentMemory({
      monthlyDates: flow.context.monthlyDates,
      preInstallments: linear.preInstallments,
      postInstallments: linear.postInstallments,
      adjustedPre: linear.adjustedPre,
      adjustedPost: linear.adjustedPost,
      prePayment: linear.prePayment,
      postPayment: linear.postPayment,
    });
    const comparison = buildAssociativePaymentComparison({
      ...comparisonInput,
      monthlyDates: flow.context.monthlyDates,
      installments: 84,
      linearSchedule: schedule,
      decreasingBlocks: flow.custom.decreasing.blocks,
      constructionProgress: null,
    });
    const principal = 231_990 - 190_000 - 1_000;
    const correctedPrincipal = principal * 1.005;
    const pmt = (capital: number, count: number) => (capital * 0.005) / (1 - 1.005 ** -count);
    const expectedLinear = pmt(correctedPrincipal, 84);
    const expectedDecreasing = pmt(correctedPrincipal * 0.4, 21);

    expect(flow.ok).toBe(true);
    expect(flow.custom.decreasing.ok).toBe(true);
    expect(linear.proSoluto).toBe(40_990);
    expect(linear.correctedInstallmentBalance).toBeCloseTo(41_194.95, 8);
    expect([linear.preInstallments, linear.postInstallments]).toEqual([84, 0]);
    expect([flow.context.monthlyDates[0], flow.context.monthlyDates.at(-1)]).toEqual([
      "2026-10-15",
      "2033-09-15",
    ]);
    expect(schedule).toHaveLength(84);
    expect(schedule.at(-1).balance).toBe(0);
    expect(comparison.installmentComparisonAvailable).toBe(true);
    expect(comparison.workEvolutionAvailable).toBe(false);
    expect(comparison.comparisonAvailable).toBe(false);
    expect(comparison.highestLinearPayment).toBeCloseTo(expectedLinear, 8);
    expect(comparison.highestDecreasingPayment).toBeCloseTo(expectedDecreasing, 8);
    expect(comparison.highestLinearTotal).toBeNull();
    expect(comparison.highestDecreasingTotal).toBeNull();
    expect(comparison.rows[0].linearTotal).toBeCloseTo(expectedLinear, 8);
    expect(comparison.rows[1].linearTotal).toBeCloseTo(expectedLinear, 8);
    expect(comparison.rows[2].linearTotal).toBeNull();
    expect(comparison.rows[2].decreasingTotal).toBeNull();
    expect(comparison.rows[2].linearIncomeRate).toBeNull();

    const approval = calculateAssociativeApproval({
      ...approvalInput,
      proSoluto: principal,
      linearInstallment: comparison.highestLinearPayment,
      decreasingInstallment: comparison.highestDecreasingPayment,
      linearMaximumIncomePayment: comparison.highestLinearTotal,
      decreasingMaximumIncomePayment: comparison.highestDecreasingTotal,
      installmentComparisonValid: comparison.installmentComparisonAvailable,
      workEvolutionValid: comparison.workEvolutionAvailable,
      paymentComparisonValid: comparison.comparisonAvailable,
    });
    expect(approval.proSolutoRate).toBeCloseTo(0.1766886503728609, 12);
    expect(approval.linearCommitmentRate).toBeCloseTo(0.1203597343063272, 12);
    expect(approval.decreasingCommitmentRate).toBeCloseTo(0.1657079363621542, 12);
    expect(approval.linearMaximumIncomeRate).toBeNull();
    expect(approval.decreasingMaximumIncomeRate).toBeNull();
    expect(approval.annualIncomeRate).toBeNull();
    expect(approval.status).toBe("pending");
    expect(approval.checks).toEqual([
      expect.objectContaining({ id: "pro-soluto", available: true, ok: false }),
      expect.objectContaining({ id: "commitment", available: true, ok: false }),
      expect.objectContaining({ id: "annual-income", available: false, value: null, ok: false }),
    ]);
  });

  it.each([null, undefined, "", Number.NaN, Number.POSITIVE_INFINITY])(
    "keeps missing or invalid progress %s separate from known payments",
    (constructionProgress) => {
      const result = buildAssociativePaymentComparison({
        ...comparisonInput,
        constructionProgress,
      });
      expect(result.normalizedProgress).toBeNull();
      expect(result.installmentComparisonAvailable).toBe(true);
      expect(result.workEvolutionAvailable).toBe(false);
      expect(result.comparisonAvailable).toBe(false);
      expect(result.highestLinearPayment).toBe(600);
      expect(result.highestDecreasingPayment).toBe(700);
      expect(result.highestLinearTotal).toBeNull();
      expect(result.highestDecreasingTotal).toBeNull();
    },
  );

  it("accepts an explicitly supplied synthetic zero and preserves the construction calendar", () => {
    const result = buildAssociativePaymentComparison({
      ...comparisonInput,
      constructionProgress: 0,
    });
    expect(result.normalizedProgress).toBe(0);
    expect(result.comparisonAvailable).toBe(true);
    expect(result.rows[0].workEvolution).toBeNull();
    expect(result.rows[1].workEvolution).toBeNull();
    expect(result.rows[2].workEvolution).toBeCloseTo((1_500 * 2) / 110, 10);
    expect(result.highestLinearTotal).toBeCloseTo(600 + (1_500 * 2) / 110, 10);
  });

  it.each([
    [0, 0],
    [0.2, 0.2],
    [1, 1],
    [1.01, 0.0101],
    [20, 0.2],
    [100, 1],
  ])("preserves supported progress units: %s becomes %s", (constructionProgress, expected) => {
    const result = buildAssociativePaymentComparison({ ...comparisonInput, constructionProgress });
    expect(result.normalizedProgress).toBeCloseTo(expected, 12);
    expect(result.workEvolutionAvailable).toBe(true);
  });

  it.each([-1, 100.0001, 101, 250])(
    "does not clamp invalid progress %s into a known construction percentage",
    (constructionProgress) => {
      const result = buildAssociativePaymentComparison({
        ...comparisonInput,
        constructionProgress,
      });
      expect(result.normalizedProgress).toBeNull();
      expect(result.installmentComparisonAvailable).toBe(true);
      expect(result.workEvolutionAvailable).toBe(false);
      expect(result.comparisonAvailable).toBe(false);
      expect(result.rows[2].constructionProgress).toBeNull();
      expect(result.rows[2].workEvolution).toBeNull();
      expect(result.highestLinearTotal).toBeNull();
    },
  );

  it.each(["2026-09-30", "2026-10-04", "2026-10-05"])(
    "preserves the delivered-property forecast independently of calculator eligibility: %s",
    (completionDate) => {
      const comparison = buildAssociativePaymentComparison({ ...comparisonInput, completionDate });
      expect(comparison.workEvolutionAvailable).toBe(true);
      expect(comparison.comparisonAvailable).toBe(true);
      expect(comparison.rows[0].constructionProgress).toBe(1);
      expect(comparison.rows[1].constructionProgress).toBe(1);
      expect(comparison.rows[2].constructionProgress).toBe(1);
      expect(comparison.rows[0].workEvolution).toBeNull();
      expect(comparison.rows[1].workEvolution).toBeNull();
      expect(comparison.rows[2].workEvolution).toBe(1_500);
      expect(comparison.highestLinearTotal).toBe(2_100);
      expect(comparison.highestDecreasingTotal).toBe(2_200);

      const flow = calculateInvestorFlow({
        selectedUnitId: "synthetic-delivery-boundary",
        annualMode: true,
        baseDate: comparisonInput.baseDate,
        completionDate,
        salePrice: 231_990,
        financing: 190_000,
        income: 5_000,
        entryValue: 1_000,
        installments: 84,
        signals: [0, 0, 0],
        intermediaries: [0, 0, 0, 0, 0],
        approvalTierId: "bronze",
      });
      const eligibleDate = completionDate > comparisonInput.baseDate;
      expect(flow.ok).toBe(eligibleDate);
      expect(flow.custom.linear.ok).toBe(eligibleDate);
      if (!eligibleDate) {
        expect(flow.errors).toContain("Data da obra futura");
        expect(flow.custom.linear.errors).toContain(
          "A data de término da obra deve ser posterior à data vigente.",
        );
      }
      const approval = calculateAssociativeApproval({
        ...approvalInput,
        proposalValid: flow.ok,
        installmentComparisonValid: comparison.installmentComparisonAvailable,
        workEvolutionValid: comparison.workEvolutionAvailable,
        paymentComparisonValid: comparison.comparisonAvailable,
      });
      expect(approval.status).toBe(eligibleDate ? "approved" : "rejected");
    },
  );

  it.each([null, 101])(
    "does not fabricate missing or invalid progress after delivery: %s",
    (constructionProgress) => {
      const result = buildAssociativePaymentComparison({
        ...comparisonInput,
        completionDate: "2026-09-30",
        constructionProgress,
      });
      expect(result.workEvolutionAvailable).toBe(false);
      expect(result.rows[2].constructionProgress).toBeNull();
      expect(result.rows[2].workEvolution).toBeNull();
      expect(result.highestLinearTotal).toBeNull();
    },
  );

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    "keeps monetary installments but no income comparison for income %s",
    (income) => {
      const result = buildAssociativePaymentComparison({ ...comparisonInput, income });
      expect(result.installmentComparisonAvailable).toBe(false);
      expect(result.workEvolutionAvailable).toBe(false);
      expect(result.comparisonAvailable).toBe(false);
      expect(result.highestLinearPayment).toBe(600);
      expect(result.highestDecreasingPayment).toBe(700);
      expect(result.rows[2].linearIncomeRate).toBeNull();
    },
  );

  it.each([
    { monthlyDates: [] },
    { monthlyDates: ["2026-10-15", "2026-11-15", "2026-02-30"] },
    { linearSchedule: [] },
    { linearSchedule: [{ payment: 600 }, { payment: null }, { payment: 600 }] },
    { decreasingBlocks: [] },
    { decreasingBlocks: [{ count: 2, correctedInstallment: 700 }] },
    { installments: 3.5 },
  ])("does not approve incomplete schedules: %j", (partial) => {
    const result = buildAssociativePaymentComparison({ ...comparisonInput, ...partial });
    expect(result.installmentComparisonAvailable).toBe(false);
    expect(result.comparisonAvailable).toBe(false);
    expect(result.highestLinearTotal).toBeNull();
    expect(result.highestDecreasingTotal).toBeNull();
  });

  it.each([{ baseDate: "" }, { completionDate: "" }, { completionDate: "2026-02-30" }])(
    "does not invent a construction forecast without valid dates: %j",
    (partial) => {
      const result = buildAssociativePaymentComparison({ ...comparisonInput, ...partial });
      expect(result.installmentComparisonAvailable).toBe(true);
      expect(result.workEvolutionAvailable).toBe(false);
      expect(result.highestLinearTotal).toBeNull();
    },
  );

  it("propagates unknown construction through annual and upfront totals", () => {
    const result = buildAssociativePaymentComparison({
      ...comparisonInput,
      constructionProgress: null,
      signals: [{ date: "2026-12-10", value: 500 }],
      annuals: [
        { date: "2026-12-15", value: 100 },
        { date: "2027-01-15", value: 100 },
      ],
    });
    expect(result.rows[0].linearTotal).toBeNull();
    expect(
      result.rows.find((row: { paymentDate: string }) => row.paymentDate === "2026-12-15")
        .linearTotal,
    ).toBeNull();
    expect(result.rows.at(-1).linearTotal).toBeNull();
    expect(result.highestLinearPayment).toBe(600);
  });
});

describe("Associative approval nullable metrics", () => {
  it.each(["linearMaximumIncomePayment", "decreasingMaximumIncomePayment"])(
    "does not replace explicit null %s with an installment",
    (field) => {
      const result = calculateAssociativeApproval({ ...approvalInput, [field]: null });
      expect(result.status).toBe("pending");
      expect(result.installmentComparisonAvailable).toBe(true);
      expect(result.annualIncomeRate).toBeNull();
      expect(result.checks[2]).toMatchObject({ available: false, value: null, ok: false });
    },
  );

  it.each(["linearInstallment", "decreasingInstallment"])(
    "does not replace explicit null %s with the legacy corrected installment",
    (field) => {
      const result = calculateAssociativeApproval({
        ...approvalInput,
        correctedInstallment: 750,
        [field]: null,
      });
      expect(result.status).toBe("pending");
      expect(result.commitmentRate).toBeNull();
      expect(result.checks[1]).toMatchObject({ available: false, value: null, ok: false });
    },
  );

  it("preserves omitted legacy maximum-income inputs", () => {
    const result = calculateAssociativeApproval({
      ...approvalInput,
      linearMaximumIncomePayment: undefined,
      decreasingMaximumIncomePayment: undefined,
    });
    expect(result.status).toBe("approved");
    expect(result.annualIncomeRate).toBe(0.15);
  });

  it("preserves omitted legacy installment inputs", () => {
    const result = calculateAssociativeApproval({
      ...approvalInput,
      correctedInstallment: 750,
      linearInstallment: undefined,
      decreasingInstallment: undefined,
    });
    expect(result.status).toBe("approved");
    expect(result.commitmentRate).toBe(0.15);
  });

  it("keeps legacy comparison failure closed while retaining known commitments", () => {
    const result = calculateAssociativeApproval({
      ...approvalInput,
      paymentComparisonValid: false,
    });
    expect(result.status).toBe("pending");
    expect(result.commitmentRate).toBe(0.15);
    expect(result.annualIncomeRate).toBeNull();
  });

  it.each([{ installmentComparisonValid: false }, { workEvolutionValid: false }])(
    "cannot approve when an explicit availability flag fails: %j",
    (flags) => {
      expect(calculateAssociativeApproval({ ...approvalInput, ...flags }).status).toBe("pending");
    },
  );

  it.each([null, undefined, "", Number.NaN, Number.POSITIVE_INFINITY])(
    "does not approve an unknown pro-soluto %s",
    (proSoluto) => {
      const result = calculateAssociativeApproval({ ...approvalInput, proSoluto });
      expect(result.proSolutoRate).toBeNull();
      expect(result.checks[0]).toMatchObject({ available: false, value: null, ok: false });
      expect(result.status).toBe("pending");
    },
  );

  it("keeps the exact Bronze boundaries and rejects one cent above", () => {
    expect(calculateAssociativeApproval(approvalInput).status).toBe("approved");
    for (const field of [
      "proSoluto",
      "linearInstallment",
      "decreasingInstallment",
      "linearMaximumIncomePayment",
      "decreasingMaximumIncomePayment",
    ] as const) {
      expect(
        calculateAssociativeApproval({ ...approvalInput, [field]: approvalInput[field] + 0.01 })
          .status,
      ).toBe("rejected");
    }
  });
});
