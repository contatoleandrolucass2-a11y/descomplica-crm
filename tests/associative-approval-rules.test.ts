import { describe, expect, it } from "vitest";

// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import * as approvalRules from "@/lib/archive-investor/associative-approval-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error -- Existing archive module has no TypeScript declaration.
import * as paymentMemory from "@/lib/archive-investor/associative-installment-memory.mjs";

const {
  calculateAssociativeApproval,
  distributeAssociativeApprovalPayment,
  findAssociativeApprovalPlan,
} = approvalRules;
const { buildAssociativeInstallmentMemory, buildAssociativePaymentComparison } = paymentMemory;

type Candidate = {
  entry: number;
  signals: number[];
  installments: number;
  annuals: number[];
};

const paymentCents = ({ entry, signals }: Pick<Candidate, "entry" | "signals">) =>
  Math.round(entry * 100) + signals.reduce((sum, value) => sum + Math.round(value * 100), 0);

describe("Associative approval signal limit", () => {
  it.each([
    [0, 1200.01, [0, 0, 0]],
    [1, 600.01, [600, 0, 0]],
    [2, 400.01, [400, 400, 0]],
    [3, 300.01, [300, 300, 300]],
    [undefined, 300.01, [300, 300, 300]],
  ])("distributes additions with maximumSignalCount %s", (maximumSignalCount, entry, signals) => {
    const payment = distributeAssociativeApprovalPayment(1200.01, { maximumSignalCount });

    expect(payment).toEqual({ entry, signals, signalCount: maximumSignalCount ?? 3 });
    expect(paymentCents(payment)).toBe(120001);
  });

  it.each([0, 1, 2])("preserves existing signals outside maximum %s", (maximumSignalCount) => {
    const minimumSignals = [200, 300, 400];
    const payment = distributeAssociativeApprovalPayment(2000.01, {
      minimumEntry: 500,
      minimumSignals,
      maximumSignalCount,
    });

    expect(payment.entry).toBeGreaterThanOrEqual(500);
    expect(payment.signals.slice(maximumSignalCount)).toEqual(
      minimumSignals.slice(maximumSignalCount),
    );
    minimumSignals.forEach((value, index) => {
      expect(payment.signals[index]).toBeGreaterThanOrEqual(value);
    });
    expect(payment.signalCount).toBe(3);
    expect(paymentCents(payment)).toBe(200001);
    expect(minimumSignals).toEqual([200, 300, 400]);
  });

  it.each([0, 1, 2, 3, undefined])(
    "finds the minimum additional payment within maximum %s",
    (maximumSignalCount) => {
      const limit = maximumSignalCount ?? 3;
      const evaluate = (candidate: Candidate) => {
        expect(candidate.signals.slice(limit)).toEqual(Array(3 - limit).fill(0));
        return { valid: true, approved: paymentCents(candidate) >= 100001 };
      };
      const plan = findAssociativeApprovalPlan({
        maximumInstallments: 60,
        currentEntry: 150,
        currentSignals: [0, 0, 0],
        currentAnnuals: [200, 0],
        maximumSignalCount,
        maximumPaymentAdditional: 10000,
        evaluate,
      });

      expect(plan).not.toBeNull();
      expect(plan.installments).toBe(60);
      expect(plan.annuals).toEqual([200, 0]);
      expect(plan.signalCount).toBe(limit);
      expect(paymentCents(plan)).toBe(100001);
      expect(evaluate(plan).approved).toBe(true);
      expect(evaluate({ ...plan, entry: plan.entry - 0.01 }).approved).toBe(false);
    },
  );

  it.each([0, 1, 2])(
    "keeps a later existing signal invalid with maximum %s",
    (maximumSignalCount) => {
      const currentSignals = [0, 0, 200];
      let evaluated = 0;
      const plan = findAssociativeApprovalPlan({
        currentEntry: 150,
        currentSignals,
        maximumSignalCount,
        maximumPaymentAdditional: 10000,
        evaluate: (candidate: Candidate) => {
          evaluated += 1;
          expect(candidate.signals.slice(maximumSignalCount)).toEqual(
            currentSignals.slice(maximumSignalCount),
          );
          return {
            valid: candidate.signals.slice(maximumSignalCount).every((value) => value === 0),
            approved: true,
          };
        },
      });

      expect(evaluated).toBeGreaterThan(0);
      expect(plan).toBeNull();
      expect(currentSignals).toEqual([0, 0, 200]);
    },
  );

  it.each([
    [299.99, 0],
    [300, 1],
    [449.99, 1],
    [450, 2],
    [599.99, 2],
    [600, 3],
  ])("preserves the default distribution threshold at %s", (total, signalCount) => {
    const payment = distributeAssociativeApprovalPayment(total);
    expect(payment.signalCount).toBe(signalCount);
    expect(paymentCents(payment)).toBe(Math.round(total * 100));
    expect(payment).toEqual(distributeAssociativeApprovalPayment(total, { maximumSignalCount: 3 }));
  });

  it.each([
    [0, "2026-10-15"],
    [1, "2026-11-15"],
    [2, "2026-12-15"],
  ] as const)(
    "approves with maximum %s and fixed first monthly %s",
    (maximumSignalCount, firstInstallmentDate) => {
      const calculate = (candidate: Candidate) =>
        calculateInvestorFlow({
          selectedUnitId: "synthetic-approval-signal-limit",
          annualMode: true,
          baseDate: "2026-10-04",
          completionDate: "2035-12-30",
          firstInstallmentDate,
          salePrice: 231990,
          financing: 190000,
          income: 5000,
          approvalTierId: "bronze",
          entryValue: candidate.entry,
          signals: candidate.signals,
          installments: candidate.installments,
          intermediaries: candidate.annuals,
        });
      const evaluate = (candidate: Candidate) => {
        const flow = calculate(candidate);
        const linear = flow.custom.linear;
        const comparison = buildAssociativePaymentComparison({
          monthlyDates: flow.context.monthlyDates,
          installments: candidate.installments,
          linearSchedule: buildAssociativeInstallmentMemory({
            monthlyDates: flow.context.monthlyDates,
            preInstallments: linear.preInstallments,
            postInstallments: linear.postInstallments,
            adjustedPre: linear.adjustedPre,
            adjustedPost: linear.adjustedPost,
            prePayment: linear.prePayment,
            postPayment: linear.postPayment,
          }),
          decreasingBlocks: flow.custom.decreasing.blocks,
          income: 5000,
          constructionProgress: 20,
          baseDate: "2026-10-04",
          completionDate: "2035-12-30",
        });
        const approval = calculateAssociativeApproval({
          tierId: "bronze",
          income: 5000,
          realSaleValue: flow.context.valueReal,
          proSoluto: flow.custom.correctedProSoluto,
          linearInstallment: comparison.highestLinearPayment,
          decreasingInstallment: comparison.highestDecreasingPayment,
          linearMaximumIncomePayment: comparison.highestLinearTotal,
          decreasingMaximumIncomePayment: comparison.highestDecreasingTotal,
          proposalValid: flow.ok,
          paymentComparisonValid: comparison.comparisonAvailable,
        });
        return {
          valid: flow.ok && comparison.comparisonAvailable,
          approved: approval.status === "approved",
        };
      };
      expect(evaluate({ entry: 150, signals: [0, 0, 0], installments: 84, annuals: [] })).toEqual({
        valid: true,
        approved: false,
      });
      const plan = findAssociativeApprovalPlan({
        currentEntry: 150,
        currentSignals: [0, 0, 0],
        maximumSignalCount,
        maximumPaymentAdditional: 10000,
        evaluate,
      });

      expect(plan).not.toBeNull();
      expect(plan.entry).toBeGreaterThan(150);
      expect(plan.signals.slice(maximumSignalCount)).toEqual(Array(3 - maximumSignalCount).fill(0));
      expect(plan.signalCount).toBe(maximumSignalCount);
      expect(evaluate(plan)).toEqual({ valid: true, approved: true });
      expect(evaluate({ ...plan, entry: plan.entry - 0.01 }).approved).toBe(false);
      expect(calculate(plan).context.monthlyDates[0]).toBe(firstInstallmentDate);
      const lateSignals = [...plan.signals];
      lateSignals[maximumSignalCount] = 150;
      expect(calculate({ ...plan, signals: lateSignals }).ok).toBe(false);
    },
  );
});
