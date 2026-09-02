export const ASSOCIATIVE_APPROVAL_TIERS = [
  { id: "diamond", label: "Diamante", proSolutoRate: 0.25, commitmentRate: 0.2, annualIncomeLimitRate: 0.5 },
  { id: "gold", label: "Ouro", proSolutoRate: 0.2, commitmentRate: 0.2, annualIncomeLimitRate: 0.5 },
  { id: "silver", label: "Prata", proSolutoRate: 0.18, commitmentRate: 0.18, annualIncomeLimitRate: 0.48 },
  { id: "bronze", label: "Bronze", proSolutoRate: 0.15, commitmentRate: 0.15, annualIncomeLimitRate: 0.45 },
  { id: "steel", label: "Aço", proSolutoRate: 0.12, commitmentRate: 0.1, annualIncomeLimitRate: 0.4 },
  { id: "not-eligible", label: "Não Elegível", proSolutoRate: 0, commitmentRate: 0, annualIncomeLimitRate: 0 },
];

function nonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function moneyCents(value) {
  return Math.round(nonNegativeNumber(value) * 100);
}

export function distributeAssociativeApprovalPayment(total, {
  minimumEntry = 0,
  minimumSignals = [],
} = {}) {
  const entryFloorCents = Math.max(15_000, moneyCents(minimumEntry));
  const signalFloorCents = Array.from({ length: 3 }, (_, index) => moneyCents(minimumSignals[index]));
  const floorTotalCents = entryFloorCents + signalFloorCents.reduce((sum, value) => sum + value, 0);
  const totalCents = Math.max(moneyCents(total), floorTotalCents);
  const preferredPaymentCount = totalCents < 30_000 ? 1 : totalCents < 45_000 ? 2 : totalCents < 60_000 ? 3 : 4;
  const lastRequiredSignal = signalFloorCents.reduce((latest, value, index) => value > 0 ? index : latest, -1);
  const requiredPaymentCount = Math.max(1, lastRequiredSignal + 2);

  let paymentCount = Math.max(preferredPaymentCount, requiredPaymentCount);
  let floors = [];
  while (paymentCount >= requiredPaymentCount) {
    floors = [
      entryFloorCents,
      ...signalFloorCents.map((value, index) => index < paymentCount - 1 ? Math.max(value, 15_000) : value),
    ];
    if (floors.reduce((sum, value) => sum + value, 0) <= totalCents) break;
    paymentCount -= 1;
  }

  const activeFloors = floors.slice(0, paymentCount);
  const activeFloorTotal = activeFloors.reduce((sum, value) => sum + value, 0);
  const additionalCents = Math.max(0, totalCents - activeFloorTotal);
  const baseAdditionalCents = Math.floor(additionalCents / paymentCount);
  const remainderCents = additionalCents - (baseAdditionalCents * paymentCount);
  const payments = activeFloors.map((floor, index) => (
    floor + baseAdditionalCents + (index === 0 ? remainderCents : 0)
  ));
  const signals = Array.from({ length: 3 }, (_, index) => (
    index < paymentCount - 1 ? payments[index + 1] / 100 : signalFloorCents[index] / 100
  ));

  return {
    entry: payments[0] / 100,
    signals,
    signalCount: signals.reduce((latest, value, index) => value > 0 ? index + 1 : latest, 0),
  };
}

export function calculateAssociativeProSolutoSuggestion({
  realSaleValue,
  proSoluto,
  limitRate,
  currentEntry = 0,
  currentSignals = [],
}) {
  const safeSaleValue = nonNegativeNumber(realSaleValue);
  const safeProSoluto = nonNegativeNumber(proSoluto);
  const safeLimitRate = nonNegativeNumber(limitRate);
  const maximumProSoluto = safeSaleValue * safeLimitRate;
  const additionalCents = Math.max(0, Math.ceil(((safeProSoluto - maximumProSoluto) * 100) - 1e-7));
  const currentPaymentCents = moneyCents(currentEntry)
    + currentSignals.reduce((total, value) => total + moneyCents(value), 0);
  const requiredPaymentTotal = Math.max(150, (currentPaymentCents + additionalCents) / 100);

  return {
    requiredAdditional: additionalCents / 100,
    requiredPaymentTotal,
    maximumProSoluto,
    ...distributeAssociativeApprovalPayment(requiredPaymentTotal, {
      minimumEntry: currentEntry,
      minimumSignals: currentSignals,
    }),
  };
}

export function findAssociativeApprovalPayment({
  currentEntry = 0,
  currentSignals = [],
  maximumAdditional = 0,
  evaluate,
}) {
  if (typeof evaluate !== "function") return null;
  const currentPaymentCents = moneyCents(currentEntry)
    + currentSignals.reduce((total, value) => total + moneyCents(value), 0);
  const maximumPaymentCents = currentPaymentCents + moneyCents(maximumAdditional);
  const distributionAt = (totalCents) => distributeAssociativeApprovalPayment(totalCents / 100, {
    minimumEntry: currentEntry,
    minimumSignals: currentSignals,
  });

  if (!evaluate(distributionAt(maximumPaymentCents))) return null;

  let minimumCents = Math.max(15_000, currentPaymentCents);
  let maximumCents = Math.max(minimumCents, maximumPaymentCents);
  while (minimumCents < maximumCents) {
    const candidateCents = Math.floor((minimumCents + maximumCents) / 2);
    if (evaluate(distributionAt(candidateCents))) maximumCents = candidateCents;
    else minimumCents = candidateCents + 1;
  }

  return {
    requiredAdditional: Math.max(0, minimumCents - currentPaymentCents) / 100,
    requiredPaymentTotal: minimumCents / 100,
    ...distributionAt(minimumCents),
  };
}

function normalizeCandidateEvaluation(result) {
  if (typeof result === "boolean") return { valid: result, approved: result };
  return {
    valid: Boolean(result?.valid),
    approved: Boolean(result?.valid && result?.approved),
  };
}

function distributeAssociativeAnnuals(totalCents, eligibleSlots, maximumPerAnnualCents, minimumAnnuals = []) {
  const eligibleIndexes = eligibleSlots
    .map((eligible, index) => eligible ? index : -1)
    .filter((index) => index >= 0);
  const annualCents = Array.from({ length: eligibleSlots.length }, (_, index) => moneyCents(minimumAnnuals[index]));
  if (eligibleIndexes.length === 0 || maximumPerAnnualCents <= 0) return annualCents.map((value) => value / 100);

  const floorTotalCents = annualCents.reduce((sum, value) => sum + value, 0);
  const maximumTotalCents = annualCents.reduce((sum, value, index) => (
    sum + (eligibleSlots[index] ? Math.max(value, maximumPerAnnualCents) : value)
  ), 0);
  let remainderCents = Math.max(0, Math.min(Math.max(totalCents, floorTotalCents), maximumTotalCents) - floorTotalCents);
  let availableIndexes = eligibleIndexes.filter((index) => annualCents[index] < maximumPerAnnualCents);
  while (remainderCents > 0 && availableIndexes.length > 0) {
    const baseAdditionalCents = Math.max(1, Math.floor(remainderCents / availableIndexes.length));
    for (const index of availableIndexes) {
      if (remainderCents <= 0) break;
      const headroomCents = maximumPerAnnualCents - annualCents[index];
      const addedCents = Math.min(headroomCents, baseAdditionalCents, remainderCents);
      annualCents[index] += addedCents;
      remainderCents -= addedCents;
    }
    availableIndexes = availableIndexes.filter((index) => annualCents[index] < maximumPerAnnualCents);
  }
  const annuals = annualCents.map((value) => value / 100);
  return annuals;
}

export function findAssociativeApprovalPlan({
  maximumInstallments = 84,
  currentAnnuals = [],
  annualEligible = [],
  annualMaximum = 0,
  currentEntry = 0,
  currentSignals = [],
  maximumPaymentAdditional = 0,
  evaluate,
}) {
  if (typeof evaluate !== "function") return null;

  const safeMaximumInstallments = Math.max(1, Math.min(84, Math.floor(nonNegativeNumber(maximumInstallments) || 84)));
  const eligibleSlots = Array.from(
    { length: Math.max(currentAnnuals.length, annualEligible.length) },
    (_, index) => Boolean(annualEligible[index]),
  );
  const annualMaximumCents = moneyCents(annualMaximum);
  const currentAnnualValues = eligibleSlots.map((_, index) => moneyCents(currentAnnuals[index]) / 100);
  const currentAnnualTotalCents = currentAnnualValues.reduce((total, value) => total + moneyCents(value), 0);
  const maximumAnnualTotalCents = currentAnnualValues.reduce((sum, value, index) => (
    sum + (eligibleSlots[index] ? Math.max(moneyCents(value), annualMaximumCents) : moneyCents(value))
  ), 0);
  const currentPaymentCents = moneyCents(currentEntry)
    + currentSignals.reduce((total, value) => total + moneyCents(value), 0);
  const maximumPaymentCents = currentPaymentCents + moneyCents(maximumPaymentAdditional);

  const candidateAt = ({ installments, annualTotalCents, paymentTotalCents }) => ({
    installments,
    annuals: annualTotalCents === currentAnnualTotalCents
      ? currentAnnualValues
      : distributeAssociativeAnnuals(annualTotalCents, eligibleSlots, annualMaximumCents, currentAnnualValues),
    ...distributeAssociativeApprovalPayment(paymentTotalCents / 100, {
      minimumEntry: currentEntry,
      minimumSignals: currentSignals,
    }),
  });
  const inspect = (candidate) => normalizeCandidateEvaluation(evaluate(candidate));
  const maximumInstallmentCandidate = candidateAt({
    installments: safeMaximumInstallments,
    annualTotalCents: currentAnnualTotalCents,
    paymentTotalCents: currentPaymentCents,
  });
  const maximumInstallmentEvaluation = inspect(maximumInstallmentCandidate);
  if (maximumInstallmentEvaluation.approved) return maximumInstallmentCandidate;

  let selectedAnnualTotalCents = currentAnnualTotalCents;
  if (maximumAnnualTotalCents > currentAnnualTotalCents) {
    let validMinimum = currentAnnualTotalCents;
    let validMaximum = maximumAnnualTotalCents;
    const maximumAnnualCandidate = candidateAt({
      installments: safeMaximumInstallments,
      annualTotalCents: validMaximum,
      paymentTotalCents: currentPaymentCents,
    });
    if (!inspect(maximumAnnualCandidate).valid) {
      while (validMinimum < validMaximum) {
        const candidateTotal = Math.ceil((validMinimum + validMaximum) / 2);
        const candidate = candidateAt({
          installments: safeMaximumInstallments,
          annualTotalCents: candidateTotal,
          paymentTotalCents: currentPaymentCents,
        });
        if (inspect(candidate).valid) validMinimum = candidateTotal;
        else validMaximum = candidateTotal - 1;
      }
      selectedAnnualTotalCents = validMinimum;
    } else {
      selectedAnnualTotalCents = validMaximum;
    }

    const selectedAnnualCandidate = candidateAt({
      installments: safeMaximumInstallments,
      annualTotalCents: selectedAnnualTotalCents,
      paymentTotalCents: currentPaymentCents,
    });
    if (inspect(selectedAnnualCandidate).approved) {
      let minimumCents = currentAnnualTotalCents;
      let maximumCents = selectedAnnualTotalCents;
      while (minimumCents < maximumCents) {
        const candidateTotal = Math.floor((minimumCents + maximumCents) / 2);
        const candidate = candidateAt({
          installments: safeMaximumInstallments,
          annualTotalCents: candidateTotal,
          paymentTotalCents: currentPaymentCents,
        });
        if (inspect(candidate).approved) maximumCents = candidateTotal;
        else minimumCents = candidateTotal + 1;
      }
      return candidateAt({
        installments: safeMaximumInstallments,
        annualTotalCents: minimumCents,
        paymentTotalCents: currentPaymentCents,
      });
    }
  }

  const paymentRanges = [
    [Math.max(15_000, currentPaymentCents), 29_999],
    [Math.max(30_000, currentPaymentCents), 44_999],
    [Math.max(45_000, currentPaymentCents), 59_999],
    [Math.max(60_000, currentPaymentCents), maximumPaymentCents],
  ].filter(([minimum, maximum]) => minimum <= maximum && minimum <= maximumPaymentCents)
    .map(([minimum, maximum]) => [minimum, Math.min(maximum, maximumPaymentCents)]);

  for (const [rangeMinimum, rangeMaximum] of paymentRanges) {
    let validMinimum = rangeMinimum;
    let validMaximum = rangeMaximum;
    const rangeMaximumCandidate = candidateAt({
      installments: safeMaximumInstallments,
      annualTotalCents: selectedAnnualTotalCents,
      paymentTotalCents: rangeMaximum,
    });
    if (!inspect(rangeMaximumCandidate).valid) {
      while (validMinimum < validMaximum) {
        const candidateTotal = Math.ceil((validMinimum + validMaximum) / 2);
        const candidate = candidateAt({
          installments: safeMaximumInstallments,
          annualTotalCents: selectedAnnualTotalCents,
          paymentTotalCents: candidateTotal,
        });
        if (inspect(candidate).valid) validMinimum = candidateTotal;
        else validMaximum = candidateTotal - 1;
      }
      if (!inspect(candidateAt({
        installments: safeMaximumInstallments,
        annualTotalCents: selectedAnnualTotalCents,
        paymentTotalCents: validMinimum,
      })).valid) continue;
    } else {
      validMinimum = validMaximum;
    }

    const validRangeMaximum = validMinimum;
    const validRangeCandidate = candidateAt({
      installments: safeMaximumInstallments,
      annualTotalCents: selectedAnnualTotalCents,
      paymentTotalCents: validRangeMaximum,
    });
    if (!inspect(validRangeCandidate).approved) continue;

    let minimumCents = rangeMinimum;
    let maximumCents = validRangeMaximum;
    while (minimumCents < maximumCents) {
      const candidateTotal = Math.floor((minimumCents + maximumCents) / 2);
      const candidate = candidateAt({
        installments: safeMaximumInstallments,
        annualTotalCents: selectedAnnualTotalCents,
        paymentTotalCents: candidateTotal,
      });
      if (inspect(candidate).approved) maximumCents = candidateTotal;
      else minimumCents = candidateTotal + 1;
    }
    return candidateAt({
      installments: safeMaximumInstallments,
      annualTotalCents: selectedAnnualTotalCents,
      paymentTotalCents: minimumCents,
    });
  }

  return null;
}

export function calculateAssociativeApproval({
  tierId,
  income,
  realSaleValue,
  proSoluto,
  correctedInstallment,
  linearInstallment,
  decreasingInstallment,
  linearMaximumIncomePayment,
  decreasingMaximumIncomePayment,
  proposalValid = true,
  paymentComparisonValid = true,
}) {
  const tier = ASSOCIATIVE_APPROVAL_TIERS.find((item) => item.id === tierId) ?? null;
  const safeIncome = nonNegativeNumber(income);
  const safeSaleValue = nonNegativeNumber(realSaleValue);
  const safeProSoluto = nonNegativeNumber(proSoluto);
  const safeLinearInstallment = nonNegativeNumber(linearInstallment ?? correctedInstallment);
  const safeDecreasingInstallment = nonNegativeNumber(decreasingInstallment ?? correctedInstallment);
  const safeInstallment = Math.max(safeLinearInstallment, safeDecreasingInstallment);
  const safeLinearMaximumIncomePayment = nonNegativeNumber(linearMaximumIncomePayment ?? linearInstallment);
  const safeDecreasingMaximumIncomePayment = nonNegativeNumber(decreasingMaximumIncomePayment ?? decreasingInstallment);
  const proSolutoRate = safeSaleValue > 0 ? safeProSoluto / safeSaleValue : 0;
  const commitmentRate = safeIncome > 0 ? safeInstallment / safeIncome : 0;
  const linearCommitmentRate = safeIncome > 0 ? safeLinearInstallment / safeIncome : 0;
  const decreasingCommitmentRate = safeIncome > 0 ? safeDecreasingInstallment / safeIncome : 0;
  const linearMaximumIncomeRate = safeIncome > 0 ? safeLinearMaximumIncomePayment / safeIncome : 0;
  const decreasingMaximumIncomeRate = safeIncome > 0 ? safeDecreasingMaximumIncomePayment / safeIncome : 0;
  const annualIncomeRate = Math.max(linearMaximumIncomeRate, decreasingMaximumIncomeRate);
  const checks = tier ? [
    { id: "pro-soluto", value: proSolutoRate, limit: tier.proSolutoRate, ok: proSolutoRate <= tier.proSolutoRate },
    { id: "commitment", value: commitmentRate, limit: tier.commitmentRate, ok: commitmentRate <= tier.commitmentRate },
    { id: "annual-income", value: annualIncomeRate, limit: tier.annualIncomeLimitRate, ok: annualIncomeRate <= tier.annualIncomeLimitRate },
  ] : [];
  const ready = Boolean(tier && safeIncome > 0 && safeSaleValue > 0 && paymentComparisonValid);
  const approved = ready && proposalValid && tier.id !== "not-eligible" && checks.every((check) => check.ok);

  return {
    tier,
    status: !ready ? "pending" : approved ? "approved" : "rejected",
    proSolutoRate,
    commitmentRate,
    linearCommitmentRate,
    decreasingCommitmentRate,
    linearMaximumIncomeRate,
    decreasingMaximumIncomeRate,
    annualIncomeRate,
    proposalValid: Boolean(proposalValid),
    paymentComparisonValid: Boolean(paymentComparisonValid),
    checks,
  };
}
