import { pathToFileURL } from "node:url";

import { calculateAssociativeLinear } from "../../lib/archive-investor/associative-linear-calculator-rules.mjs";
import { calculateAssociativeDecreasing } from "../../lib/archive-investor/associative-decreasing-calculator-rules.mjs";
import { calculateAssociativeApproval } from "../../lib/archive-investor/associative-approval-rules.mjs";
import {
  buildAssociativeInstallmentMemory,
  buildAssociativePaymentComparison,
} from "../../lib/archive-investor/associative-installment-memory.mjs";
import { calculateInvestorFlow } from "../../lib/archive-investor/investor-calculator-rules.mjs";
import { evaluateFinancingModality } from "../../lib/archive-investor/financing-modality-rules.mjs";
import { resolveAssociativeAppraisal } from "../../lib/archive-investor/associative-documentation-adapter.mjs";
import { buildAssociativeReadyProposal } from "../../lib/archive-investor/associative-ready-proposal.mjs";

// Independent, pinned expectations. Never import production constants into an oracle.
// These are repository contracts, not evidence of current bank eligibility.
export const MATRIX_CONTRACT = Object.freeze({
  version: "associative-scenario-matrix-2",
  outcomeConvention:
    "calculable includes expected ranking rejection; causes retain ranking.rejected and expectedDecisions counts it separately; missing data and invalid proposals remain justified_block; mismatches remain real_error",
  rankingPolicy: "wf13-ranking-2026-08-18",
  modalityPolicy: "MCMV_2026_04_01",
  officialFormula: "wf13-1.3.0",
  inventoryProgressUnit: "fraction [0,1]; outside range is invalid",
  legacyForecastProgressUnit: "[0,1] fraction; (1,100] percent; tested only at the legacy API",
  preRate: 0.005,
  postRate: 0.015,
  annualRate: 0.005,
  absoluteMoneyTolerance: 0.000001,
  relativeTolerance: 0.0000000001,
  sources: [
    "lib/crm/simulators/official/wf13-policy.ts",
    "lib/crm/simulators/official/wf13.ts",
    "lib/archive-investor/financing-modality-rules.mjs",
    "lib/archive-investor/associative-linear-calculator-rules.mjs",
    "lib/archive-investor/associative-decreasing-calculator-rules.mjs",
    "lib/archive-investor/associative-installment-memory.mjs",
    "tests/associative-linear-archive.test.ts",
    "tests/wf13-official.test.ts",
  ],
});

export const RANKING_ORACLE = Object.freeze({
  diamond: [2500, 2000, 5000],
  gold: [2000, 2000, 5000],
  silver: [1800, 1800, 4800],
  bronze: [1500, 1500, 4500],
  steel: [1200, 1000, 4000],
  "not-eligible": [0, 0, 0],
});

const DAY = 86_400_000;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const known = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  !(typeof value === "string" && value.trim() === "") &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;
const cents = (value) => Math.round(Number(value) * 100);
const iso = (date) => date.toISOString().slice(0, 10);

function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && iso(parsed) === value ? parsed : null;
}

function ordinal(value) {
  const parsed = date(value);
  return parsed ? parsed.getUTCFullYear() * 12 + parsed.getUTCMonth() : null;
}

function monthDate(value, offset, day) {
  const parsed = date(value);
  return parsed
    ? iso(
        new Date(
          Date.UTC(
            parsed.getUTCFullYear(),
            parsed.getUTCMonth() + offset,
            day ?? parsed.getUTCDate(),
          ),
        ),
      )
    : "";
}

// Enumerate days backwards, independently of the production month/candidate algorithm.
function lastPaymentDay(value, window) {
  const parsed = date(value);
  if (!parsed) return "";
  for (let delta = window; delta > 0; delta -= 1) {
    const candidate = new Date(parsed.getTime() + delta * DAY);
    if ([5, 10, 15].includes(candidate.getUTCDate())) return iso(candidate);
  }
  return "";
}

function compound(value, rate, count) {
  let result = value;
  for (let index = 0; index < count; index += 1) result *= 1 + rate;
  return result;
}

// A unit payment's present value, by cash-flow discounting, not the PMT formula.
export function discountWeights(pre, post) {
  let discount = 1;
  const weights = [];
  for (let index = 0; index < pre + post; index += 1) {
    discount /= 1 + (index < pre ? 0.005 : 0.015);
    weights.push(discount);
  }
  return weights;
}

export function syntheticLinearInput(overrides = {}) {
  return {
    development: "Synthetic matrix",
    product: "SYN-MATRIX",
    stockMatch: true,
    policyConfirmed: true,
    policyLimit: 84,
    installments: 84,
    entryDate: "2026-10-04",
    constructionEnd: "2029-12-31",
    salePrice: 300000.4,
    bonus: 0,
    discount: 0,
    financing: 240000.34,
    subsidy: 0,
    fgts: 0,
    housingCheck: 0,
    entry: 15000,
    signal1: 0,
    signal2: 0,
    signal3: 0,
    annual1: 0,
    annual2: 0,
    annual3: 0,
    annual4: 0,
    annual5: 0,
    ...overrides,
  };
}

export function oracleLinear(input, today = input.entryDate) {
  const causes = [];
  const entryDate = date(input.entryDate);
  const endDate = date(input.constructionEnd);
  const calculationDate = date(today);
  if (!entryDate || !endDate || !calculationDate) causes.push("date.invalid");
  if (entryDate && endDate && endDate <= entryDate) causes.push("delivery.not_future");
  if (!input.stockMatch || !input.development || !input.product) causes.push("stock.unconfirmed");
  if (!input.policyConfirmed || !known(input.policyLimit) || Number(input.policyLimit) <= 0)
    causes.push("policy.pending");
  const n = Number(input.installments);
  if (!Number.isInteger(n) || n < 1 || n > Number(input.policyLimit))
    causes.push("installments.invalid");
  const monetaryFields = [
    "salePrice",
    "bonus",
    "discount",
    "financing",
    "subsidy",
    "fgts",
    "housingCheck",
    "entry",
    "signal1",
    "signal2",
    "signal3",
    "annual1",
    "annual2",
    "annual3",
    "annual4",
    "annual5",
  ];
  if (monetaryFields.some((key) => !known(input[key]))) causes.push("money.unavailable");
  if (Number(input.salePrice) <= 0) causes.push("sale.invalid");
  if (Number(input.entry) < 150) causes.push("entry.minimum");
  if (Number(input.bonus) + Number(input.discount) > Number(input.salePrice))
    causes.push("discount.exceeded");
  if (
    causes.includes("date.invalid") ||
    causes.includes("money.unavailable") ||
    causes.includes("installments.invalid")
  )
    return { ok: false, causes, metrics: null };

  const signals = [input.signal1, input.signal2, input.signal3].map(Number);
  const usable = signals.map(
    (amount, index) =>
      amount >= 150 && (index === 0 || (signals[index - 1] >= 150 && amount <= signals[index - 1])),
  );
  if (signals.some((amount, index) => amount !== 0 && !usable[index]))
    causes.push("signals.sequence");
  const signalDates = [];
  let previous = input.entryDate;
  let chainValid = true;
  for (let index = 0; index < 3; index += 1) {
    chainValid = chainValid && usable[index];
    previous = chainValid ? lastPaymentDay(previous, 31) : "";
    signalDates.push(previous);
  }
  const graceMonths = signalDates.filter(Boolean).length;
  const first = Number(input.entry) >= 150 ? monthDate(lastPaymentDay(today, 30), graceMonths) : "";
  const annuals = Array.from({ length: 5 }, (_, index) => {
    const dueDate = `${calculationDate.getUTCFullYear() + index}-12-15`;
    const amount = Number(input[`annual${index + 1}`]);
    const valid = amount === 0 || (dueDate >= today && dueDate <= input.constructionEnd);
    if (!valid) causes.push("annual.date");
    const months = Math.max(
      0,
      ordinal(dueDate) - ordinal(today) - Number(15 < calculationDate.getUTCDate()),
    );
    return { dueDate, corrected: valid && amount > 0 ? compound(amount, 0.005, months + 1) : 0 };
  });
  const annualCorrectedTotal = sum(annuals.map((item) => item.corrected));
  const realSaleValue = Number(input.salePrice) - Number(input.bonus) - Number(input.discount);
  const validInitialTotal = Number(input.entry) + sum(signals.filter((_, index) => usable[index]));
  const deductions =
    sum([input.financing, input.subsidy, input.fgts, input.housingCheck].map(Number)) +
    validInitialTotal;
  const proSoluto = Math.max(0, realSaleValue - deductions);
  const installmentBalance = Math.max(0, proSoluto - annualCorrectedTotal);
  if (proSoluto > 0 && annualCorrectedTotal >= proSoluto) causes.push("annual.exhausts_balance");
  const preInstallments = first
    ? Math.min(n, Math.max(0, ordinal(input.constructionEnd) - ordinal(first)))
    : 0;
  const postInstallments = n - preInstallments;
  const baseRate = preInstallments > 0 ? 0.005 : 0.015;
  const correctedInstallmentBalance = compound(installmentBalance, baseRate, graceMonths + 1);
  const weights = discountWeights(preInstallments, postInstallments);
  const correctedInstallment = correctedInstallmentBalance / sum(weights);
  const prePercentage = sum(weights.slice(0, preInstallments)) / sum(weights);
  return {
    ok: causes.length === 0,
    causes,
    metrics: {
      firstInstallmentDate: first,
      signalDates,
      graceMonths,
      validInitialTotal,
      annualCorrectedTotal,
      realSaleValue,
      deductions,
      proSoluto,
      installmentBalance,
      correctedProSoluto: compound(proSoluto, baseRate, graceMonths + 1),
      correctedInstallmentBalance,
      correctedWithAnnuals: correctedInstallmentBalance + annualCorrectedTotal,
      preInstallments,
      postInstallments,
      baseRate,
      correctedInstallment,
      prePercentage,
      postPercentage: 1 - prePercentage,
    },
  };
}

export function oracleApproval(input) {
  const limits = RANKING_ORACLE[input.tierId];
  const hasIncome = known(input.income) && Number(input.income) > 0;
  const comparable = input.installmentComparisonValid !== false;
  const workValid = input.workEvolutionValid ?? input.paymentComparisonValid ?? true;
  const linear =
    input.linearInstallment === undefined ? input.correctedInstallment : input.linearInstallment;
  const decreasing =
    input.decreasingInstallment === undefined
      ? input.correctedInstallment
      : input.decreasingInstallment;
  const maxLinear =
    input.linearMaximumIncomePayment === undefined
      ? input.linearInstallment
      : input.linearMaximumIncomePayment;
  const maxDecreasing =
    input.decreasingMaximumIncomePayment === undefined
      ? input.decreasingInstallment
      : input.decreasingMaximumIncomePayment;
  const availability = [
    known(input.realSaleValue) && Number(input.realSaleValue) > 0 && known(input.proSoluto),
    hasIncome && comparable && known(linear) && known(decreasing),
    hasIncome && workValid && known(maxLinear) && known(maxDecreasing),
  ];
  const amounts = [
    input.proSoluto,
    Math.max(Number(linear), Number(decreasing)),
    Math.max(Number(maxLinear), Number(maxDecreasing)),
  ];
  const bases = [input.realSaleValue, input.income, input.income];
  const checks = limits
    ? limits.map((limit, index) => {
        const available = Boolean(availability[index]);
        const safeCents =
          available &&
          Number.isSafeInteger(cents(amounts[index])) &&
          Number.isSafeInteger(cents(bases[index]));
        return {
          available,
          value: available ? Number(amounts[index]) / Number(bases[index]) : null,
          limit: limit / 10000,
          ok: Boolean(
            safeCents &&
            BigInt(cents(amounts[index])) * 10000n <= BigInt(cents(bases[index])) * BigInt(limit),
          ),
        };
      })
    : [];
  const ready = Boolean(
    limits && input.paymentComparisonValid !== false && availability.every(Boolean),
  );
  return {
    status: !ready
      ? "pending"
      : input.proposalValid !== false &&
          input.tierId !== "not-eligible" &&
          checks.every((item) => item.ok)
        ? "approved"
        : "rejected",
    checks,
  };
}

export function oracleForecast(input) {
  const normalizedProgress =
    known(input.constructionProgress) && Number(input.constructionProgress) <= 100
      ? Number(input.constructionProgress) / (Number(input.constructionProgress) > 1 ? 100 : 1)
      : null;
  const base = ordinal(input.baseDate);
  const end = ordinal(input.completionDate);
  const income = known(input.income) ? Number(input.income) : 0;
  const workEvolutionAvailable =
    normalizedProgress !== null && base !== null && end !== null && income > 0;
  const linear = input.linearSchedule.map((row) =>
    known(row.payment) ? Number(row.payment) : null,
  );
  const decreasing = input.decreasingBlocks.flatMap((block) =>
    Array.from({ length: block.count }, () =>
      known(block.correctedInstallment) ? Number(block.correctedInstallment) : null,
    ),
  );
  const installmentComparisonAvailable =
    Number.isInteger(input.installments) &&
    input.installments > 0 &&
    input.monthlyDates.length === input.installments &&
    input.monthlyDates.every((value) => date(value)) &&
    linear.length === input.installments &&
    decreasing.length === input.installments &&
    linear.every((value) => value !== null) &&
    decreasing.every((value) => value !== null) &&
    income > 0;
  const rows = input.monthlyDates.slice(0, input.installments).map((paymentDate, index) => {
    const month = ordinal(paymentDate);
    const progress =
      normalizedProgress === null || base === null || end === null || month === null
        ? null
        : month >= end
          ? 1
          : normalizedProgress +
            ((1 - normalizedProgress) * Math.max(0, month - base)) / Math.max(1, end - base);
    const signature = base !== null && month !== null && month - base <= 1;
    const workEvolution =
      !signature && workEvolutionAvailable && progress !== null ? income * 0.3 * progress : null;
    return {
      paymentDate,
      constructionProgress: progress,
      workEvolution,
      linearTotal:
        linear[index] != null && (signature || workEvolution !== null)
          ? linear[index] + (workEvolution ?? 0)
          : null,
      decreasingTotal:
        decreasing[index] != null && (signature || workEvolution !== null)
          ? decreasing[index] + (workEvolution ?? 0)
          : null,
    };
  });
  const comparisonAvailable = installmentComparisonAvailable && workEvolutionAvailable;
  return {
    normalizedProgress,
    workEvolutionAvailable,
    installmentComparisonAvailable,
    comparisonAvailable,
    highestLinearPayment:
      linear.length === input.installments &&
      input.monthlyDates.every((value) => date(value)) &&
      linear.every((value) => value !== null) &&
      input.installments > 0
        ? Math.max(...linear)
        : null,
    highestDecreasingPayment:
      decreasing.length === input.installments &&
      input.monthlyDates.every((value) => date(value)) &&
      decreasing.every((value) => value !== null) &&
      input.installments > 0
        ? Math.max(...decreasing)
        : null,
    highestLinearTotal: comparisonAvailable
      ? Math.max(...rows.map((row) => row.linearTotal))
      : null,
    highestDecreasingTotal: comparisonAvailable
      ? Math.max(...rows.map((row) => row.decreasingTotal))
      : null,
    rows,
  };
}

export function oracleModality(input) {
  const positiveCents = (value) => Number.isSafeInteger(value) && value > 0;
  const reasonCodes = [];
  const pending = [];
  if (![true, false, "SIM", "NAO"].includes(input.firstProperty))
    pending.push("first_property.pending");
  if (!positiveCents(input.propertyValueCents) || !positiveCents(input.mcmvPropertyLimitCents))
    pending.push("property_limit.pending");
  if (!positiveCents(input.familyIncomeCents))
    return {
      effectiveModality: null,
      eligibleForMcmv: false,
      mcmvRange: null,
      forced: false,
      selectionSource: null,
      reasonCodes: ["INVALID_INCOME"],
      pending,
    };
  if (input.familyIncomeCents > 1300000) reasonCodes.push("INCOME_ABOVE_MCMV_LIMIT");
  if (input.firstProperty === false || input.firstProperty === "NAO")
    reasonCodes.push("NOT_FIRST_PROPERTY");
  if (
    positiveCents(input.propertyValueCents) &&
    positiveCents(input.mcmvPropertyLimitCents) &&
    input.propertyValueCents > input.mcmvPropertyLimitCents
  )
    reasonCodes.push("PROPERTY_ABOVE_MCMV_LIMIT");
  const band = [
    [320000, "FAIXA_1"],
    [500000, "FAIXA_2"],
    [960000, "FAIXA_3"],
    [1300000, "CLASSE_MEDIA"],
  ].find(([maximum]) => input.familyIncomeCents <= maximum);
  const preference = ["MCMV", "SBPE"].includes(input.manualPreference)
    ? input.manualPreference
    : null;
  const forced = reasonCodes.length > 0;
  return {
    effectiveModality: forced ? "SBPE" : (preference ?? "MCMV"),
    eligibleForMcmv: !forced,
    mcmvRange: band?.[1] ?? null,
    forced,
    selectionSource: forced || !preference ? "automatic" : "manual",
    reasonCodes,
    pending,
  };
}

// Reports contain fixed metric names only. No inputs, exception messages, IDs or per-unit results.
export function compareMetrics(actual, expected, prefix = "") {
  const mismatches = [];
  for (const [key, value] of Object.entries(expected)) {
    const metric = prefix ? `${prefix}.${key}` : key;
    const observed = actual?.[key];
    if (typeof value === "number") {
      const tolerance = Math.max(
        MATRIX_CONTRACT.absoluteMoneyTolerance,
        Math.abs(value) * MATRIX_CONTRACT.relativeTolerance,
      );
      if (
        typeof observed !== "number" ||
        !Number.isFinite(observed) ||
        Math.abs(observed - value) > tolerance
      )
        mismatches.push(metric);
    } else if (Array.isArray(value)) {
      if (!Array.isArray(observed) || observed.length !== value.length) mismatches.push(metric);
      else
        value.forEach((entry, index) => {
          if (entry !== null && typeof entry === "object")
            mismatches.push(...compareMetrics(observed[index], entry, `${metric}.${index}`));
          else if (observed[index] !== entry) mismatches.push(`${metric}.${index}`);
        });
    } else if (observed !== value) mismatches.push(metric);
  }
  return mismatches;
}

function outcome(causes, mismatches, comparisons) {
  const uniqueCauses = [...new Set(causes)];
  const expectedDecisions = uniqueCauses.filter((cause) => cause === "ranking.rejected");
  const blockingCauses = uniqueCauses.filter((cause) => cause !== "ranking.rejected");
  return {
    outcome: mismatches.length
      ? "real_error"
      : blockingCauses.length
        ? "justified_block"
        : "calculable",
    causes: uniqueCauses,
    expectedDecisions,
    mismatches,
    comparisons,
  };
}

export function checkLinearScenario(input, today = input.entryDate) {
  const expected = oracleLinear(input, today);
  const actual = calculateAssociativeLinear(input, { today });
  const metrics = expected.metrics ? compareMetrics(actual, expected.metrics) : [];
  if (actual.ok !== expected.ok) metrics.push("linear.ok");
  return outcome(
    expected.causes,
    metrics,
    expected.metrics ? Object.keys(expected.metrics).length + 1 : 1,
  );
}

export function checkDecreasingScenario(input) {
  const actual = calculateAssociativeDecreasing(input);
  const regular = Math.round(input.installments / 4);
  const counts = [regular, regular, regular, Math.max(0, input.installments - regular * 3)];
  let elapsedPre = 0;
  let elapsedPost = 0;
  const blocks = [0.4, 0.3, 0.2, 0.1].map((share, index) => {
    const pre = Math.max(0, Math.min(counts[index], input.preInstallments - elapsedPre));
    const post = counts[index] - pre;
    const unitPresentValue = sum(discountWeights(pre, post));
    const levelPayment =
      unitPresentValue > 0 ? (input.correctedBalance * share) / unitPresentValue : 0;
    const accumulatedCorrection = compound(compound(1, 0.005, elapsedPre), 0.015, elapsedPost);
    // The pinned four-block contract applies prior correction to pre only in block 2.
    const prePayment = pre > 0 ? levelPayment * (index === 1 ? accumulatedCorrection : 1) : 0;
    const postPayment = post > 0 ? levelPayment * accumulatedCorrection : 0;
    elapsedPre += pre;
    elapsedPost += post;
    return {
      count: counts[index],
      preInstallments: pre,
      postInstallments: post,
      uncorrectedBase: input.uncorrectedBalance * share,
      base: input.correctedBalance * share,
      uncorrectedInstallment:
        counts[index] > 0 ? (input.uncorrectedBalance * share) / counts[index] : 0,
      correctedInstallment: Math.max(prePayment, postPayment),
      prePayment,
      postPayment,
    };
  });
  const ok =
    input.uncorrectedBalance > 0 &&
    input.correctedBalance > 0 &&
    counts.every((count) => count > 0) &&
    sum(counts) === input.installments &&
    input.preInstallments + input.postInstallments === input.installments &&
    [input.installments, input.preInstallments, input.postInstallments].every(Number.isInteger) &&
    Boolean(date(input.firstInstallmentDate));
  return outcome(
    ok ? [] : ["decreasing.four_payable_blocks_required"],
    compareMetrics(actual, { ok, blocks }),
    1 + blocks.length * 9,
  );
}

export function checkApprovalScenario(input) {
  const expected = oracleApproval(input);
  const mismatches = compareMetrics(calculateAssociativeApproval(input), expected);
  const causes = [];
  if (input.proposalValid === false) causes.push("proposal.invalid");
  if (expected.status === "pending") causes.push("approval.unavailable");
  if (
    expected.status === "rejected" &&
    (input.tierId === "not-eligible" || expected.checks.some((check) => !check.ok))
  )
    causes.push("ranking.rejected");
  return outcome(causes, mismatches, 13);
}

export function checkForecastScenario(input) {
  return checkForecastResult(input, buildAssociativePaymentComparison(input));
}

function checkForecastResult(input, actual) {
  const expected = oracleForecast(input);
  // Annual cash payments are intentionally absent from the recurring-income maximum.
  const monthly = actual.rows
    .filter((row) => row.kind === "monthly")
    .map((row) => ({
      ...row,
      linearTotal: row.linearTotal === null ? null : row.linearTotal - row.annualPayment,
      decreasingTotal:
        row.decreasingTotal === null ? null : row.decreasingTotal - row.annualPayment,
    }));
  const mismatches = compareMetrics({ ...actual, rows: monthly }, expected);
  const causes = [];
  if (!expected.workEvolutionAvailable) causes.push("forecast.unavailable");
  if (!expected.installmentComparisonAvailable) causes.push("schedule.unavailable");
  return outcome(causes, mismatches, 8 + expected.rows.length * 5);
}

export function checkModalityScenario(input) {
  const { pending, ...expected } = oracleModality(input);
  const actual = evaluateFinancingModality(input);
  const mismatches = compareMetrics(actual, {
    ...expected,
    ruleVersion: MATRIX_CONTRACT.modalityPolicy,
  });
  return outcome([...pending, ...expected.reasonCodes], mismatches, 8);
}

export function checkAppraisalScenario({
  reportedAppraisal,
  appraisalOverride,
  modality = "MCMV",
}) {
  const expectedAppraisal =
    known(reportedAppraisal) && Number(reportedAppraisal) > 0
      ? Number(reportedAppraisal)
      : known(appraisalOverride) && Number(appraisalOverride) > 0
        ? Number(appraisalOverride)
        : null;
  const resolved = resolveAssociativeAppraisal(reportedAppraisal, appraisalOverride);
  const actual = buildAssociativeReadyProposal({
    grossSaleValue: 340000.03,
    netSaleValue: 230000.01,
    requestedFinancing: 190000.01,
    entry: 1000,
    installments: 84,
    appraisal: resolved,
    modality,
  });
  const mismatches = [];
  if (resolved !== (expectedAppraisal ?? 0)) mismatches.push("appraisal.resolution");
  if (expectedAppraisal === null) {
    if (actual.ok !== false || actual.status !== "blocked" || actual.proposal !== null)
      mismatches.push("appraisal.must_block");
    return outcome(["appraisal.pending"], mismatches, 4);
  }
  const quota = modality === "MCMV" ? 80n : 90n;
  const appraisalLimit = (BigInt(cents(expectedAppraisal)) * quota) / 100n;
  const tableLimit = (34000003n * quota) / 100n;
  const capacity = appraisalLimit < tableLimit ? appraisalLimit : tableLimit;
  const financing = capacity < 19000001n ? capacity : 19000001n;
  const minimum = (financing * 100n + quota - 1n) / quota;
  const contract = minimum > 23000001n ? minimum : 23000001n;
  const balance = 23000001n - financing - 100000n;
  mismatches.push(
    ...compareMetrics(actual.proposal, {
      appraisalLimit: Number(appraisalLimit) / 100,
      financing: Number(financing) / 100,
      contractMinimum: Number(minimum) / 100,
      contractValue: Number(contract) / 100,
      monthlyBalance: Number(balance) / 100,
      averageInstallment: Number(balance / 84n) / 100,
      creditShortfall: Number(19000001n - financing) / 100,
    }),
  );
  return outcome([], mismatches, 8);
}

function emptyAggregate() {
  return {
    cases: 0,
    comparisons: 0,
    calculable: 0,
    justified_block: 0,
    real_error: 0,
    causes: {},
    expectedDecisions: {},
    mismatches: {},
  };
}

function add(aggregate, result) {
  aggregate.cases += 1;
  aggregate.comparisons += result.comparisons;
  aggregate[result.outcome] += 1;
  for (const cause of result.causes) aggregate.causes[cause] = (aggregate.causes[cause] ?? 0) + 1;
  for (const decision of result.expectedDecisions)
    aggregate.expectedDecisions[decision] = (aggregate.expectedDecisions[decision] ?? 0) + 1;
  for (const metric of result.mismatches)
    aggregate.mismatches[metric] = (aggregate.mismatches[metric] ?? 0) + 1;
}

function checked(aggregate, operation) {
  try {
    add(aggregate, operation());
  } catch {
    add(aggregate, outcome([], ["runtime.exception"], 0));
  }
}

export function syntheticForecastInput(overrides = {}) {
  return {
    baseDate: "2026-10-04",
    completionDate: "2029-12-31",
    constructionProgress: 20,
    income: 10000.01,
    installments: 84,
    monthlyDates: Array.from({ length: 84 }, (_, index) => monthDate("2026-10-15", index)),
    linearSchedule: Array.from({ length: 84 }, () => ({ payment: 500.01 })),
    decreasingBlocks: [
      { count: 21, correctedInstallment: 800.03 },
      { count: 21, correctedInstallment: 600.02 },
      { count: 21, correctedInstallment: 400.01 },
      { count: 21, correctedInstallment: 200 },
    ],
    ...overrides,
  };
}

export function syntheticApprovalInput(overrides = {}) {
  return {
    tierId: "bronze",
    income: 10000.4,
    realSaleValue: 300000.4,
    proSoluto: 45000.06,
    linearInstallment: 1000,
    decreasingInstallment: 1000,
    linearMaximumIncomePayment: 4000,
    decreasingMaximumIncomePayment: 4000,
    ...overrides,
  };
}

export function runAssociativeScenarioMatrix({
  inventory = [],
  includeSynthetic = true,
  baseDate = "2026-10-04",
} = {}) {
  if (!Array.isArray(inventory) || !date(baseDate)) throw new TypeError("Invalid matrix options");
  const sections = Object.fromEntries(
    ["linear", "decreasing", "forecast", "approval", "modality", "appraisal", "inventory"].map(
      (key) => [key, emptyAggregate()],
    ),
  );
  if (includeSynthetic) {
    for (let installments = 1; installments <= 84; installments += 1) {
      for (const preInstallments of [
        ...new Set([0, 1, Math.floor(installments / 2), installments]),
      ]) {
        for (const uncorrectedBalance of [0.01, 40990, 45000.06])
          checked(sections.decreasing, () =>
            checkDecreasingScenario({
              uncorrectedBalance,
              correctedBalance: uncorrectedBalance * 1.005,
              installments,
              preInstallments,
              postInstallments: installments - preInstallments,
              firstInstallmentDate: "2026-10-15",
            }),
          );
      }
      for (const entryDate of ["2026-01-31", "2028-02-29", "2026-12-15", "2026-12-31"]) {
        for (const offset of [-1, 0, 1, 36]) {
          for (const count of [0, 1, 2, 3]) {
            const raw = syntheticLinearInput({
              installments,
              entryDate,
              constructionEnd: monthDate(entryDate, offset, 28),
              signal1: count >= 1 ? 150.03 : 0,
              signal2: count >= 2 ? 150.02 : 0,
              signal3: count >= 3 ? 150.01 : 0,
            });
            checked(sections.linear, () => checkLinearScenario(raw));
          }
        }
      }
    }
    for (const entryDate of ["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-31"]) {
      for (const amount of [0, 0.01, 5000, 45000, 50000]) {
        for (const bonus of [0, 100.01])
          checked(sections.linear, () =>
            checkLinearScenario(
              syntheticLinearInput({
                entryDate,
                annual1: amount,
                annual2: amount,
                bonus,
                discount: 99.99,
              }),
            ),
          );
      }
    }
    for (const constructionEnd of ["2027-02-29", "2028-02-30", "2027-04-31", "", "invalid"])
      checked(sections.linear, () =>
        checkLinearScenario(syntheticLinearInput({ constructionEnd })),
      );
    for (const override of [
      { policyConfirmed: false },
      { policyLimit: null },
      { entry: 149.99 },
      { signal1: 149.99 },
      { signal2: 150 },
      { signal1: 150, signal2: 150.01 },
      { discount: 400000 },
    ])
      checked(sections.linear, () => checkLinearScenario(syntheticLinearInput(override)));
    for (const progress of [0, 0.01, 0.5, 1, 20, 99.99, 100, null, undefined, "", -1, 100.01]) {
      for (const offset of [-12, 0, 1, 12, 120]) {
        for (const income of [0, null, 0.01, 10000.4]) {
          checked(sections.forecast, () =>
            checkForecastScenario(
              syntheticForecastInput({
                constructionProgress: progress,
                income,
                completionDate: monthDate(baseDate, offset, 15),
              }),
            ),
          );
        }
      }
    }
    for (const constructionProgress of [null, 0, 15, 100])
      checked(sections.forecast, () =>
        checkForecastScenario(
          syntheticForecastInput({ constructionProgress, completionDate: "2035-12-30" }),
        ),
      );
    for (const modality of ["MCMV", "SBPE"]) {
      for (const reportedAppraisal of [null, 0, 200000.01, 350000.01]) {
        for (const appraisalOverride of [null, 0, 360000.01])
          checked(sections.appraisal, () =>
            checkAppraisalScenario({ reportedAppraisal, appraisalOverride, modality }),
          );
      }
    }
    for (const [tierId, limits] of Object.entries(RANKING_ORACLE)) {
      for (const income of [0.01, 10000.01, 10000.4]) {
        for (let metric = 0; metric < 3; metric += 1) {
          for (const delta of [-1, 0, 1]) {
            const input = syntheticApprovalInput({
              tierId,
              income,
              proSoluto: 0,
              linearInstallment: 0,
              decreasingInstallment: 0,
              linearMaximumIncomePayment: 0,
              decreasingMaximumIncomePayment: 0,
            });
            const boundary = Math.floor(
              (cents(metric === 0 ? input.realSaleValue : income) * limits[metric]) / 10000,
            );
            input[["proSoluto", "linearInstallment", "decreasingMaximumIncomePayment"][metric]] =
              Math.max(0, boundary + delta) / 100;
            checked(sections.approval, () => checkApprovalScenario(input));
          }
        }
      }
    }
    for (const field of [
      "income",
      "proSoluto",
      "realSaleValue",
      "linearInstallment",
      "decreasingInstallment",
      "linearMaximumIncomePayment",
      "decreasingMaximumIncomePayment",
    ]) {
      for (const missing of [null, undefined, "", -1, Number.NaN])
        checked(sections.approval, () =>
          checkApprovalScenario(syntheticApprovalInput({ [field]: missing })),
        );
    }
    for (const familyIncomeCents of [
      null,
      0,
      1,
      320000,
      320001,
      500000,
      500001,
      960000,
      960001,
      1300000,
      1300001,
    ]) {
      for (const firstProperty of [true, false, null]) {
        for (const manualPreference of [null, "MCMV", "SBPE"]) {
          for (const propertyValueCents of [null, 59999999, 60000000, 60000001])
            checked(sections.modality, () =>
              checkModalityScenario({
                familyIncomeCents,
                firstProperty,
                manualPreference,
                propertyValueCents,
                mcmvPropertyLimitCents: 60000000,
              }),
            );
        }
      }
    }
  }

  const profiles = [
    { income: 5000, firstProperty: true, manualPreference: "MCMV", tierId: "gold" },
    { income: 10000, firstProperty: true, manualPreference: "SBPE", tierId: "silver" },
    { income: 13000.01, firstProperty: false, manualPreference: null, tierId: "bronze" },
  ];
  let visited = 0;
  let evaluatedProfiles = 0;
  let reusedProfiles = 0;
  // Cache only this run's exact consumed inputs. Nested Maps keep null, undefined,
  // NaN, infinities and numeric strings distinct; identifiers never affect a case.
  const inventoryCases = new Map();
  for (const item of inventory) {
    visited += 1;
    let cases = inventoryCases;
    for (const value of [
      item.finalWithKit ?? item.finalPrice,
      item.completionDate,
      item.unitBonus,
      item.tableSlack,
      item.appraisal,
      item.progress,
    ]) {
      if (!cases.has(value)) cases.set(value, new Map());
      cases = cases.get(value);
    }
    for (const profile of profiles)
      checked(sections.inventory, () => {
        if (cases.has(profile)) {
          reusedProfiles += 1;
          return cases.get(profile);
        }
        evaluatedProfiles += 1;
        const result = (() => {
          const causes = [];
          const salePrice = item.finalWithKit ?? item.finalPrice;
          if (!known(salePrice) || Number(salePrice) <= 0) causes.push("inventory.price_pending");
          if (!date(item.completionDate)) causes.push("inventory.delivery_pending");
          if (!known(item.unitBonus) || !known(item.tableSlack))
            causes.push("inventory.adjustments_pending");
          if (!known(item.appraisal) || Number(item.appraisal) <= 0)
            causes.push("inventory.appraisal_pending");
          const progressAvailable =
            typeof item.progress === "number" &&
            Number.isFinite(item.progress) &&
            item.progress >= 0 &&
            item.progress <= 1;
          if (item.progress == null) causes.push("inventory.progress_pending");
          else if (!progressAvailable) causes.push("inventory.progress_invalid");
          const modalityInput = {
            familyIncomeCents: cents(profile.income),
            firstProperty: profile.firstProperty,
            manualPreference: profile.manualPreference,
            propertyValueCents: known(salePrice) ? cents(salePrice) : null,
            mcmvPropertyLimitCents: 60000000,
          };
          const modalityCheck = checkModalityScenario(modalityInput);
          const mismatches = [...modalityCheck.mismatches];
          let comparisons = modalityCheck.comparisons;
          if (
            causes.some((cause) =>
              [
                "inventory.price_pending",
                "inventory.delivery_pending",
                "inventory.adjustments_pending",
              ].includes(cause),
            )
          )
            return outcome(causes, mismatches, comparisons);
          // Financing and buyer data are synthetic scenarios, never an inferred bank offer.
          const realSale = Number(salePrice) - Number(item.unitBonus) - Number(item.tableSlack);
          const financing = Math.max(0, Math.floor(realSale * 70) / 100);
          const raw = syntheticLinearInput({
            salePrice,
            bonus: Number(item.unitBonus) + Number(item.tableSlack),
            financing,
            entryDate: baseDate,
            constructionEnd: item.completionDate,
            entry: 150,
          });
          const expected = oracleLinear(raw);
          const flow = calculateInvestorFlow({
            selectedUnitId: "SYN-MATRIX",
            annualMode: true,
            baseDate,
            completionDate: item.completionDate,
            salePrice,
            propertyValue: salePrice,
            unitBonus: item.unitBonus,
            tableSlack: item.tableSlack,
            financing,
            subsidy: 0,
            fgts: 0,
            housingCheck: 0,
            income: profile.income,
            entryValue: 150,
            installments: 84,
            signals: [0, 0, 0],
            intermediaries: [0, 0, 0, 0, 0],
            approvalTierId: profile.tierId,
          });
          causes.push(...expected.causes);
          if (expected.metrics) {
            mismatches.push(...compareMetrics(flow.custom.linear, expected.metrics));
            comparisons += Object.keys(expected.metrics).length;
            const linear = flow.custom.linear;
            const comparisonInput = {
              monthlyDates: flow.context.monthlyDates,
              installments: 84,
              linearSchedule: buildAssociativeInstallmentMemory({
                monthlyDates: flow.context.monthlyDates,
                ...linear,
              }),
              decreasingBlocks: flow.custom.decreasing.blocks,
              constructionProgress: progressAvailable ? item.progress : null,
              income: profile.income,
              baseDate,
              completionDate: item.completionDate,
            };
            const comparison = buildAssociativePaymentComparison(comparisonInput);
            const forecastCheck = checkForecastResult(comparisonInput, comparison);
            causes.push(...forecastCheck.causes);
            mismatches.push(...forecastCheck.mismatches);
            comparisons += forecastCheck.comparisons;
            const approvalCheck = checkApprovalScenario({
              tierId: profile.tierId,
              income: profile.income,
              realSaleValue: realSale,
              proSoluto: expected.metrics.proSoluto,
              proposalValid: flow.ok,
              linearInstallment: comparison.highestLinearPayment,
              decreasingInstallment: comparison.highestDecreasingPayment,
              linearMaximumIncomePayment: comparison.highestLinearTotal,
              decreasingMaximumIncomePayment: comparison.highestDecreasingTotal,
              paymentComparisonValid: comparison.comparisonAvailable,
              installmentComparisonValid: comparison.installmentComparisonAvailable,
              workEvolutionValid: comparison.workEvolutionAvailable,
            });
            causes.push(...approvalCheck.causes);
            mismatches.push(...approvalCheck.mismatches);
            comparisons += approvalCheck.comparisons;
          }
          return outcome(causes, mismatches, comparisons);
        })();
        cases.set(profile, result);
        return result;
      });
  }
  return {
    contract: MATRIX_CONTRACT.version,
    scope: "defined grids; not all possible combinations",
    authority: "repository contracts only; bank approval and live policy evidence pending",
    progressConvention: MATRIX_CONTRACT.inventoryProgressUnit,
    outcomeConvention: MATRIX_CONTRACT.outcomeConvention,
    inventory: {
      supplied: inventory.length,
      visited,
      profilesPerUnit: profiles.length,
      evaluatedProfiles,
      reusedProfiles,
    },
    sections,
    totals: Object.values(sections).reduce(
      (total, section) => {
        for (const key of ["cases", "comparisons", "calculable", "justified_block", "real_error"])
          total[key] += section[key];
        return total;
      },
      { cases: 0, comparisons: 0, calculable: 0, justified_block: 0, real_error: 0 },
    ),
  };
}

// Standalone CLI is synthetic-only. Call the typed function for already-authorized inventory in memory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length > 2) {
    process.stderr.write("No CLI arguments accepted; inventory is in-memory only.\n");
    process.exitCode = 2;
  } else {
    const report = runAssociativeScenarioMatrix();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.totals.real_error > 0 ? 1 : 0;
  }
}
