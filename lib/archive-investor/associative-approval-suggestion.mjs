import { calculateInvestorFlow } from "./investor-calculator-rules.mjs";
import { getAssociativeAnnualLimit } from "./associative-annual-rules.mjs";
import {
  ASSOCIATIVE_APPROVAL_TIERS,
  calculateAssociativeApproval,
} from "./associative-approval-rules.mjs";
import {
  buildAssociativeInstallmentMemory,
  buildAssociativePaymentComparison,
} from "./associative-installment-memory.mjs";

export function assessAssociativeCandidate(input, constructionProgress, flow, candidate) {
  const result = calculateInvestorFlow({
    ...input,
    annualMode: true,
    ...(candidate
      ? {
          entryValue: candidate.entry,
          signals: candidate.signals,
          intermediaries: candidate.annuals,
          installments: candidate.installments,
        }
      : {}),
  });
  const linear = result.custom.linear;
  if (!linear || !result.custom.decreasing?.ok) {
    return { valid: false, approved: false, result, comparison: null, approval: null };
  }
  const comparison = buildAssociativePaymentComparison({
    monthlyDates: result.context.monthlyDates,
    installments: result.custom.desiredInstallments,
    linearSchedule: buildAssociativeInstallmentMemory({
      monthlyDates: result.context.monthlyDates,
      preInstallments: result.custom.preInstallments,
      postInstallments: result.custom.postInstallments,
      adjustedPre: linear.adjustedPre,
      adjustedPost: linear.adjustedPost,
      prePayment: linear.prePayment,
      postPayment: linear.postPayment,
    }),
    decreasingBlocks: result.custom.decreasing.blocks,
    income: result.context.income,
    constructionProgress,
    baseDate: input.baseDate,
    completionDate: input.completionDate,
  });
  const installment =
    flow === "linear" ? comparison.highestLinearPayment : comparison.highestDecreasingPayment;
  const maximumIncomePayment =
    flow === "linear" ? comparison.highestLinearTotal : comparison.highestDecreasingTotal;
  const approval = calculateAssociativeApproval({
    tierId: input.approvalTierId,
    income: result.context.income,
    realSaleValue: result.context.valueReal,
    proSoluto: result.custom.correctedProSoluto,
    linearInstallment: installment,
    decreasingInstallment: installment,
    linearMaximumIncomePayment: maximumIncomePayment,
    decreasingMaximumIncomePayment: maximumIncomePayment,
    proposalValid: result.ok,
    paymentComparisonValid: comparison.comparisonAvailable,
    installmentComparisonValid: comparison.installmentComparisonAvailable,
  });
  const valid = result.ok && comparison.comparisonAvailable;
  return { valid, approved: valid && approval.status === "approved", result, comparison, approval };
}

export function buildAssociativeApprovalSuggestion(input, constructionProgress, flow) {
  if (!["linear", "decreasing"].includes(flow)) return null;
  const tier = ASSOCIATIVE_APPROVAL_TIERS.find((item) => item.id === input.approvalTierId);
  if (!tier || tier.id === "not-eligible") return null;
  if (
    constructionProgress == null ||
    String(constructionProgress).trim() === "" ||
    !Number.isFinite(Number(constructionProgress)) ||
    Number(constructionProgress) < 0 ||
    Number(constructionProgress) > 100
  )
    return null;
  const base = calculateInvestorFlow({ ...input, annualMode: true });
  if (!(base.context.income > 0)) return null;
  const balanceCents = Math.round(base.custom.balanceAfterResources * 100);
  if (!Number.isSafeInteger(balanceCents) || balanceCents <= 15_000) return null;
  const annualLimitCents = Math.round(getAssociativeAnnualLimit(base.context.income) * 100);
  const installments = Math.min(84, base.context.maxInstallments || 84);
  const candidates = [];
  // Each signal count has its own grace period and eligible December payments.
  for (let signalCount = 0; signalCount <= 3; signalCount += 1) {
    const paymentCount = signalCount + 1;
    const maximumPaymentCents = Math.floor((balanceCents - 1) / paymentCount);
    if (maximumPaymentCents < 15_000) continue;
    const calendar = calculateInvestorFlow({
      ...input,
      annualMode: true,
      entryValue: 150,
      signals: Array.from({ length: 3 }, (_, index) => (index < signalCount ? 150 : 0)),
      intermediaries: [],
      installments,
    });
    const annualEligible = calendar.custom.intermediaries.map((annual) => annual.eligible);
    const annualCount = annualEligible.filter(Boolean).length;
    // Annuals reduce monthly principal, not Pro-Soluto. Re-cap them as initial payments grow.
    const maximumAnnualAt = (paymentCents) =>
      annualCount === 0
        ? 0
        : Math.min(
            annualLimitCents,
            Math.floor((balanceCents - paymentCount * paymentCents - 1) / annualCount),
          );
    const candidateAt = (paymentCents, annualCents = maximumAnnualAt(paymentCents)) => ({
      installments,
      entry: paymentCents / 100,
      signals: Array.from({ length: 3 }, (_, index) =>
        index < signalCount ? paymentCents / 100 : 0,
      ),
      signalCount,
      annuals: annualEligible.map((eligible) => (eligible ? annualCents / 100 : 0)),
    });
    const approved = (candidate) =>
      assessAssociativeCandidate(input, constructionProgress, flow, candidate).approved;
    let low = 15_000;
    let high = maximumPaymentCents;
    if (approved(candidateAt(low))) high = low;
    else if (!approved(candidateAt(high))) continue;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (approved(candidateAt(middle))) high = middle;
      else low = middle + 1;
    }
    const paymentCents = low;
    // Once the minimum equal payment is known, use no more annual money than necessary.
    low = 0;
    high = maximumAnnualAt(paymentCents);
    if (high > 0 && approved(candidateAt(paymentCents, 0))) high = 0;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (approved(candidateAt(paymentCents, middle))) high = middle;
      else low = middle + 1;
    }
    const plan = candidateAt(paymentCents, low);
    const assessment = assessAssociativeCandidate(input, constructionProgress, flow, plan);
    if (!assessment.approved) continue;
    candidates.push({
      ...plan,
      approval: assessment.approval,
      signalDates: assessment.result.custom.signals.map((signal) => signal.date),
      annualDates: assessment.result.custom.intermediaries.map((annual) => annual.date),
      installmentBalance: assessment.result.custom.installmentNominalBalance,
      correctedInstallment:
        flow === "linear"
          ? assessment.comparison.highestLinearPayment
          : assessment.comparison.highestDecreasingPayment,
    });
    // Counts are ascending: the first legal R$150 payment is also the lowest total tie.
    if (paymentCents === 15_000) return candidates.at(-1);
  }
  const total = (candidate) =>
    candidate.entry + candidate.signals.reduce((sum, value) => sum + value, 0);
  const largest = (candidate) => Math.max(candidate.entry, ...candidate.signals);
  candidates.sort((left, right) => largest(left) - largest(right) || total(left) - total(right));
  return candidates[0] ?? null;
}
