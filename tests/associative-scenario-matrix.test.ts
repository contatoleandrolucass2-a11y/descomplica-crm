import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  MATRIX_CONTRACT,
  RANKING_ORACLE,
  checkAppraisalScenario,
  checkApprovalScenario,
  checkForecastScenario,
  checkLinearScenario,
  compareMetrics,
  discountWeights,
  oracleApproval,
  oracleForecast,
  oracleLinear,
  oracleModality,
  runAssociativeScenarioMatrix,
  syntheticApprovalInput,
  syntheticForecastInput,
  syntheticLinearInput,
  type Inventory,
  type MatrixAggregate,
} from "../scripts/qa/associative-scenario-matrix.mjs";
import {
  calculateWf13,
  wf13InputSchema,
  WF13_FORMULA,
  type Wf13Input,
} from "@/lib/crm/simulators/official/wf13";
import {
  evaluateWf13RankingPolicy,
  WF13_RANKING_POLICY_VERSION,
  WF13_RANKINGS,
} from "@/lib/crm/simulators/official/wf13-policy";
import {
  buildOfficialSimulatorInput,
  officialSimulatorInitialValues,
} from "@/lib/crm/simulators/official/client";
import { calculateAssociativeLinearArchive } from "@/lib/crm/simulators/associative-linear-archive";
import { resolveAssociativeConstructionProgress } from "@/lib/archive-investor/associative-unit-facts";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { buildAssociativePaymentComparison } from "@/lib/archive-investor/associative-installment-memory.mjs";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { buildAssociativeInstallmentMemory } from "@/lib/archive-investor/associative-installment-memory.mjs";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { calculateAssociativeApproval } from "@/lib/archive-investor/associative-approval-rules.mjs";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { buildAssociativeReadyProposal } from "@/lib/archive-investor/associative-ready-proposal.mjs";
import priorGolden from "./fixtures/wf13-reference-golden.json";

// Exact rational arithmetic is local to this oracle. Payment comes from summing
// discounted unit cash flows, independently of the production annuity factors.
type Fraction = { n: bigint; d: bigint };
function fraction(n: bigint, d = 1n): Fraction {
  let a = n < 0n ? -n : n;
  let b = d;
  while (b !== 0n) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
const add = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
const divide = (a: Fraction, b: Fraction) => fraction(a.n * b.d, a.d * b.n);
const money = (value: Fraction) => Number((2n * value.n + value.d) / (2n * value.d)) / 100;
const minor = (value: string) => {
  const [whole = "0", decimals = ""] = (value || "0").split(".");
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"));
};
const month = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;

function officialInput(overrides: Partial<Wf13Input> = {}): Wf13Input {
  return {
    development: "Synthetic matrix",
    product: "SYN-1",
    stockMatch: true,
    ranking: "DIAMANTE",
    entryDate: "2026-08-17",
    constructionEnd: "2029-02-28",
    installments: "84",
    monthlyDueDay: "10",
    income: "1000000",
    salePrice: "300000.01",
    bonus: "0",
    discount: "0",
    cashback: "0",
    cashbackDiscount: "0",
    financing: "270000",
    subsidy: "0",
    fgts: "0",
    housingCheck: "0",
    entry: "150.01",
    signal1: "0",
    signal2: "0",
    signal3: "0",
    signal1Date: "",
    signal2Date: "",
    signal3Date: "",
    annuals: [],
    ...overrides,
  };
}

function officialOracle(input: Wf13Input) {
  const initialDate = [input.entryDate, input.signal1Date, input.signal2Date, input.signal3Date]
    .filter(Boolean)
    .sort()
    .at(-1)!;
  const firstDate = new Date(
    Date.UTC(
      Number(initialDate.slice(0, 4)),
      Number(initialDate.slice(5, 7)),
      Number(input.monthlyDueDay),
    ),
  )
    .toISOString()
    .slice(0, 10);
  const annualDates: string[] = [];
  for (
    let year = Number(input.entryDate.slice(0, 4));
    year <= Number(input.constructionEnd.slice(0, 4));
    year += 1
  ) {
    const candidate = `${year}-12-15`;
    if (candidate >= input.entryDate && candidate <= input.constructionEnd)
      annualDates.push(candidate);
  }
  const annualNominal = input.annuals.reduce(
    (total, value, index) =>
      total + (annualDates[index] && minor(value) * 2n <= minor(input.income) ? minor(value) : 0n),
    0n,
  );
  const sale =
    minor(input.salePrice) -
    minor(input.bonus) -
    minor(input.discount) -
    minor(input.cashbackDiscount);
  const deductions = [
    input.financing,
    input.subsidy,
    input.fgts,
    input.housingCheck,
    input.entry,
    input.signal1,
    input.signal2,
    input.signal3,
  ].reduce((total, value) => total + minor(value), annualNominal);
  const principal = sale > deductions ? sale - deductions : 0n;
  const count = Number(input.installments);
  const pre = Math.max(0, Math.min(count, month(input.constructionEnd) - month(firstDate)));
  const grace = [input.signal1Date, input.signal2Date, input.signal3Date].filter(Boolean).length;
  const rate = pre ? 1005n : 1015n;
  let corrected = fraction(principal);
  for (let index = 0; index <= grace; index += 1)
    corrected = multiply(corrected, fraction(rate, 1000n));
  let discount = fraction(1n);
  let presentValue = fraction(0n);
  for (let index = 0; index < count; index += 1) {
    discount = multiply(discount, fraction(1000n, index < pre ? 1005n : 1015n));
    presentValue = add(presentValue, discount);
  }
  const payment = divide(corrected, presentValue);
  const totalWithAnnuals = add(corrected, fraction(annualNominal * rate, 1000n));
  const limit =
    RANKING_ORACLE[
      Object.keys(RANKING_ORACLE)[
        WF13_RANKINGS.indexOf(input.ranking as (typeof WF13_RANKINGS)[number])
      ]!
    ]!;
  return {
    metrics: {
      realSaleValue: Number(sale) / 100,
      deductions: Number(deductions) / 100,
      proSoluto: Number(principal) / 100,
      correctedProSoluto: money(corrected),
      correctedWithAnnuals: money(totalWithAnnuals),
      correctedInstallment: money(payment),
      preInstallments: pre,
      postInstallments: count - pre,
      firstInstallmentDate: firstDate,
      graceMonths: grace,
      annualNominalTotal: Number(annualNominal) / 100,
    },
    approval: {
      proSoluto: totalWithAnnuals.n * 10000n <= sale * totalWithAnnuals.d * BigInt(limit[0]),
      incomeCommitment: payment.n * 10000n <= minor(input.income) * payment.d * BigInt(limit[1]),
    },
    nominal: {
      baseCents: principal / BigInt(count),
      adjustedCount: Number(principal % BigInt(count)),
    },
  };
}

const completeInventory = (): Inventory => ({
  id: "SYNTHETIC-ONLY",
  project: "Synthetic project",
  product: "Synthetic unit",
  businessUnit: "Riva",
  finalPrice: 300000.4,
  finalWithKit: 300000.4,
  unitBonus: 0,
  tableSlack: 0,
  appraisal: 350000.01,
  progress: 0.15,
  completionDate: "2035-12-30",
});

describe("Associative defined scenario matrix", () => {
  // Keep the budget local to the full 7,285-case grid, including Windows CPU contention.
  it("pins local contracts without claiming bank approval or external policy currency", () => {
    expect(WF13_RANKING_POLICY_VERSION).toBe(MATRIX_CONTRACT.rankingPolicy);
    expect(WF13_FORMULA.version).toBe(MATRIX_CONTRACT.officialFormula);
    expect([WF13_FORMULA.preRate, WF13_FORMULA.postRate, WF13_FORMULA.annualRate]).toEqual([
      0.005, 0.015, 0.005,
    ]);
    const report = runAssociativeScenarioMatrix();
    expect(report.scope).toBe("defined grids; not all possible combinations");
    expect(report.authority).toContain("bank approval and live policy evidence pending");
    expect(report.sections.linear.cases).toBe(5428);
    expect(report.sections.decreasing.cases).toBe(996);
    expect(report.sections.forecast.cases).toBe(244);
    expect(report.sections.approval.cases).toBe(197);
    expect(report.sections.modality.cases).toBe(396);
    expect(report.sections.appraisal.cases).toBe(24);
    expect(report.totals.cases).toBe(7285);
    expect(report.totals.cases).toBe(
      report.totals.calculable + report.totals.justified_block + report.totals.real_error,
    );
    expect(report.totals.real_error).toBe(0);
    for (const [key, section] of Object.entries(report.sections)) {
      expect(section.real_error, key).toBe(0);
      expect(section.mismatches, key).toEqual({});
    }
  }, 30000);

  it.each(["2027-02-29", "2028-02-30", "2027-04-31"])(
    "rejects impossible delivery %s in the raw linear API",
    (constructionEnd) => {
      const result = checkLinearScenario(syntheticLinearInput({ constructionEnd }));
      expect(result.causes).toEqual(["date.invalid"]);
      expect(result.mismatches).toEqual([]);
      expect(result.outcome).toBe("justified_block");
    },
  );

  it.each([
    {
      entryDate: "2026-01-05",
      calculationDate: "2026-01-05",
      dates: {},
      firstInterestDate: "2025-12-31",
      firstInstallmentDate: "2026-01-15",
      correction: 0,
    },
    {
      entryDate: "2026-01-05",
      calculationDate: "2026-02-16",
      dates: {},
      firstInterestDate: "2026-01-31",
      firstInstallmentDate: "2026-03-15",
      correction: 1,
    },
    {
      entryDate: "2026-01-16",
      calculationDate: "2026-01-16",
      dates: { firstInterestDate: "2025-08-20", firstInstallmentDate: "2026-02-05" },
      firstInterestDate: "2025-08-20",
      firstInstallmentDate: "2026-02-05",
      correction: 5,
    },
  ])("pins correction k=$correction to financial dates independently of entry", (scenario) => {
    const raw = {
      ...syntheticLinearInput({
        entryDate: scenario.entryDate,
        constructionEnd: "2035-12-30",
        installments: 36,
      }),
      calculationDate: scenario.calculationDate,
      ...scenario.dates,
    };
    const model = oracleLinear(raw);
    expect(model.ok).toBe(true);
    expect(model.metrics).toMatchObject({
      firstInterestDate: scenario.firstInterestDate,
      firstInstallmentDate: scenario.firstInstallmentDate,
      monthlyCorrectionMonths: scenario.correction,
    });
    expect(model.metrics!.correctedInstallmentBalance).toBeCloseTo(
      45000.06 * 1.005 ** scenario.correction,
      8,
    );
    expect(checkLinearScenario(raw)).toMatchObject({ outcome: "calculable", mismatches: [] });
  });

  it("allows completed construction while retaining date and monthly-order validation", () => {
    const raw = {
      ...syntheticLinearInput({
        entryDate: "2026-01-16",
        constructionEnd: "2025-12-15",
        installments: 36,
      }),
      firstInterestDate: "2025-12-15",
      firstInstallmentDate: "2026-02-05",
    };
    expect(oracleLinear(raw).metrics).toMatchObject({
      preInstallments: 0,
      postInstallments: 36,
      monthlyCorrectionMonths: 1,
    });
    expect(checkLinearScenario(raw)).toMatchObject({ outcome: "calculable", mismatches: [] });
    for (const invalid of [
      { ...raw, firstInstallmentDate: "2026-02-30" },
      { ...raw, firstInterestDate: "2026-02-30" },
      { ...raw, calculationDate: "2026-02-30" },
    ]) {
      expect(oracleLinear(invalid).causes).toContain("date.invalid");
      expect(checkLinearScenario(invalid)).toMatchObject({
        outcome: "justified_block",
        mismatches: [],
      });
    }
    const overlapping = { ...raw, firstInstallmentDate: "2026-01-15" };
    expect(checkLinearScenario(overlapping)).toMatchObject({
      outcome: "justified_block",
      causes: ["monthly.before_entry"],
      mismatches: [],
    });
  });

  it("keeps the wrapper strict and refuses malformed installment counts before schedule allocation", () => {
    for (const installments of [0, 85, -1, 1.5, "1e1", "84x", "", "4294967296"]) {
      const result = calculateInvestorFlow({
        selectedUnitId: "SYN",
        annualMode: true,
        baseDate: "2026-10-04",
        completionDate: "2035-12-30",
        salePrice: 300000,
        financing: 240000,
        entryValue: 15000,
        income: 10000,
        installments,
      });
      expect(result.ok).toBe(false);
      expect(result.context.monthlyDates).toEqual([]);
      expect(result.standardScenarios).toEqual([]);
    }
    for (const completionDate of ["2027-02-29", "2028-02-30", "2027-04-31"]) {
      const result = calculateInvestorFlow({
        selectedUnitId: "SYN",
        annualMode: true,
        baseDate: "2026-10-04",
        completionDate,
        salePrice: 300000,
        financing: 240000,
        entryValue: 15000,
        income: 10000,
        installments: 84,
      });
      expect(result.custom.linear).toBeNull();
      expect(result.ok).toBe(false);
    }
  });

  it("detects numerical, availability and outcome mutations instead of comparing the motor to itself", () => {
    const input = syntheticLinearInput();
    const expected = oracleLinear(input).metrics!;
    expect(
      compareMetrics(
        { ...expected, correctedInstallment: expected.correctedInstallment + 0.01 },
        expected,
      ),
    ).toContain("correctedInstallment");
    expect(compareMetrics({ highestLinearTotal: 0 }, { highestLinearTotal: null })).toEqual([
      "highestLinearTotal",
    ]);
    expect(compareMetrics({ value: Number.NaN }, { value: 0 })).toEqual(["value"]);
    expect(compareMetrics({ value: Number.POSITIVE_INFINITY }, { value: 0 })).toEqual(["value"]);
    expect(compareMetrics({ status: "approved" }, { status: "pending" })).toEqual(["status"]);
  });

  it("recalculates preserved archive inputs with nominal annuals and discounted cash flows", () => {
    const input = syntheticLinearInput({
      entryDate: "2026-08-06",
      constructionEnd: "2032-12-31",
      salePrice: 300000,
      financing: 200000,
      subsidy: 30000,
      fgts: 10000,
      entry: 8000,
      signal1: 1000,
      signal2: 1000,
      annual1: 2350,
      annual2: 2350,
      annual3: 2350,
      annual4: 2350,
      annual5: 2350,
    });
    const model = oracleLinear(input);
    expect(model.metrics!.annualCorrectedTotal).toBeCloseTo(13627.24708159291, 6);
    // P = 50,000 - 5 * 2,350; July interest to November monthly gives k = 3.
    expect(model.metrics!.installmentBalance).toBe(38250);
    expect(model.metrics!.correctedInstallmentBalance).toBeCloseTo(38826.62353125, 6);
    expect(model.metrics!.correctedInstallment).toBeCloseTo(570.710854283148, 6);
    expect(checkLinearScenario(input).mismatches).toEqual([]);
    const form = Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        typeof value === "boolean" ? value : String(value),
      ]),
    ) as Parameters<typeof calculateAssociativeLinearArchive>[0];
    const archive = calculateAssociativeLinearArchive(form, { today: input.entryDate });
    expect(archive.correctedInstallment).toBeCloseTo(model.metrics!.correctedInstallment, 6);
    expect(archive.proSoluto).toBe(50000);
  });

  it.each(priorGolden.map((item) => [item.caseKey, item.input] as const))(
    "checks preserved fixture inputs against today's archive contract: %s",
    (_, raw) => {
      const input = syntheticLinearInput(raw);
      expect(checkLinearScenario(input, "2026-09-13").mismatches).toEqual([]);
      // Historical fixture outputs encode an older formula and remain untouched.
    },
  );

  it("recalculates print commitments as 12.85% and 17.70% while preserving missing unit facts", () => {
    const facts = Object.freeze({ progress: null, appraisal: null });
    const raw = syntheticLinearInput({
      salePrice: 234990,
      financing: 190000,
      entry: 1000,
      installments: 84,
      entryDate: "2026-10-04",
      constructionEnd: "2035-12-30",
    });
    const income = 5000;
    const model = oracleLinear(raw).metrics!;
    const flow = calculateInvestorFlow({
      selectedUnitId: "synthetic-print-regression",
      annualMode: true,
      baseDate: raw.entryDate,
      completionDate: raw.constructionEnd,
      salePrice: raw.salePrice,
      financing: raw.financing,
      subsidy: 0,
      fgts: 0,
      housingCheck: 0,
      income,
      entryValue: raw.entry,
      installments: raw.installments,
      signals: [0, 0, 0],
      intermediaries: [0, 0, 0, 0, 0],
      approvalTierId: "silver",
    });
    expect(flow.ok).toBe(true);
    expect(compareMetrics(flow.custom.linear, model)).toEqual([]);
    expect(model.proSoluto).toBe(43990);
    // September interest to October monthly gives k = 0, independently of ranking correction.
    expect(model.correctedInstallmentBalance).toBeCloseTo(43990, 8);
    expect([model.preInstallments, model.postInstallments]).toEqual([84, 0]);
    expect(model.firstInstallmentDate).toBe("2026-10-15");
    const monthlyDates = Array.from({ length: 84 }, (_, index) =>
      new Date(Date.UTC(2026, 9 + index, 15)).toISOString().slice(0, 10),
    );
    expect(flow.context.monthlyDates).toEqual(monthlyDates);
    const linearSchedule = buildAssociativeInstallmentMemory({
      monthlyDates,
      ...flow.custom.linear,
    });
    const discountedMonths = discountWeights(84, 0);
    const expectedBlocks = [0.4, 0.3, 0.2, 0.1].map((share, index) => {
      const blockPresentValue = discountedMonths
        .slice(index * 21, (index + 1) * 21)
        .reduce((total, value) => total + value, 0);
      return { count: 21, correctedInstallment: (43990 * share) / blockPresentValue };
    });
    const expectedDecreasing = Math.max(
      ...expectedBlocks.map((block) => block.correctedInstallment),
    );
    expect(compareMetrics(flow.custom.decreasing, { ok: true, blocks: expectedBlocks })).toEqual(
      [],
    );
    expect(((model.correctedInstallment / income) * 100).toFixed(2)).toBe("12.85");
    expect(((expectedDecreasing / income) * 100).toFixed(2)).toBe("17.70");

    // These supplied percentages are synthetic hypotheses, not recovered source facts.
    for (const suppliedOfficialPercent of ["", "0", "15", "100"]) {
      const progress = resolveAssociativeConstructionProgress(
        facts.progress,
        suppliedOfficialPercent,
      );
      const hasProgress = suppliedOfficialPercent !== "";
      expect(progress).toBe(hasProgress ? Number(suppliedOfficialPercent) / 100 : null);
      const input = {
        monthlyDates,
        installments: 84,
        income,
        constructionProgress: progress,
        baseDate: raw.entryDate,
        completionDate: raw.constructionEnd,
        linearSchedule,
        decreasingBlocks: flow.custom.decreasing.blocks,
      };
      const forecastModel = oracleForecast({
        ...input,
        linearSchedule: monthlyDates.map(() => ({ payment: model.correctedInstallment })),
        decreasingBlocks: expectedBlocks,
      });
      const comparison = buildAssociativePaymentComparison(input);
      expect(compareMetrics(comparison, forecastModel)).toEqual([]);
      expect(comparison.installmentComparisonAvailable).toBe(true);
      expect(comparison.workEvolutionAvailable).toBe(hasProgress);
      const approvalInput = {
        tierId: "silver",
        income,
        realSaleValue: 234990,
        proSoluto: 43990,
        linearInstallment: comparison.highestLinearPayment,
        decreasingInstallment: comparison.highestDecreasingPayment,
        linearMaximumIncomePayment: comparison.highestLinearTotal,
        decreasingMaximumIncomePayment: comparison.highestDecreasingTotal,
        proposalValid: flow.ok,
        installmentComparisonValid: comparison.installmentComparisonAvailable,
        workEvolutionValid: comparison.workEvolutionAvailable,
        paymentComparisonValid: comparison.comparisonAvailable,
      };
      const approval = calculateAssociativeApproval(approvalInput);
      expect(compareMetrics(approval, oracleApproval(approvalInput))).toEqual([]);
      expect((approval.linearCommitmentRate * 100).toFixed(2)).toBe("12.85");
      expect((approval.decreasingCommitmentRate * 100).toFixed(2)).toBe("17.70");
      expect(approval.status).toBe(hasProgress ? "rejected" : "pending");
      if (!hasProgress) {
        expect(comparison.highestLinearTotal).toBeNull();
        expect(comparison.highestDecreasingTotal).toBeNull();
        expect(approval.annualIncomeRate).toBeNull();
        expect(comparison.rows[2].linearTotal).toBeNull();
      } else {
        const progressAtThirdMonth = progress! + ((1 - progress!) * 2) / 110;
        expect(comparison.rows[2].workEvolution).toBeCloseTo(
          income * 0.3 * progressAtThirdMonth,
          8,
        );
        expect(comparison.highestLinearTotal).toBeGreaterThan(comparison.highestLinearPayment);
        expect(comparison.highestDecreasingTotal).toBeGreaterThan(
          comparison.highestDecreasingPayment,
        );
        expect(approval.annualIncomeRate).toBeCloseTo(
          Math.max(forecastModel.highestLinearTotal!, forecastModel.highestDecreasingTotal!) /
            income,
          8,
        );
      }
      const proposal = buildAssociativeReadyProposal({
        grossSaleValue: raw.salePrice,
        netSaleValue: raw.salePrice,
        requestedFinancing: raw.financing,
        entry: raw.entry,
        installments: raw.installments,
        appraisal: facts.appraisal,
        modality: "MCMV",
      });
      expect(proposal).toMatchObject({ ok: false, status: "blocked", proposal: null });
    }
    expect(facts).toEqual({ progress: null, appraisal: null });
  });

  it("counts expected ranking rejection as calculable without erasing causes", () => {
    const input = syntheticApprovalInput({ tierId: "silver", proSoluto: 60000.08 });
    expect(oracleApproval(input).status).toBe("rejected");
    expect(checkApprovalScenario(input)).toMatchObject({
      outcome: "calculable",
      causes: ["ranking.rejected"],
      expectedDecisions: ["ranking.rejected"],
      mismatches: [],
    });
    const report = runAssociativeScenarioMatrix({
      inventory: [completeInventory()],
      includeSynthetic: false,
    });
    expect(report.contract).toBe("associative-scenario-matrix-3");
    expect(report.outcomeConvention).toContain("calculable includes expected ranking rejection");
    expect(report.sections.inventory).toMatchObject({
      cases: 3,
      calculable: 3,
      justified_block: 0,
      real_error: 0,
      causes: { "ranking.rejected": 3 },
      expectedDecisions: { "ranking.rejected": 3 },
    });
    expect(report.totals.cases).toBe(
      report.totals.calculable + report.totals.justified_block + report.totals.real_error,
    );
  });

  it("keeps invalid proposals and missing facts blocked despite a ranking decision", () => {
    expect(checkApprovalScenario(syntheticApprovalInput({ proposalValid: false }))).toMatchObject({
      outcome: "justified_block",
      causes: ["proposal.invalid"],
      expectedDecisions: [],
      mismatches: [],
    });
    expect(
      checkApprovalScenario(syntheticApprovalInput({ proposalValid: false, proSoluto: 60000 })),
    ).toMatchObject({
      outcome: "justified_block",
      causes: ["proposal.invalid", "ranking.rejected"],
      expectedDecisions: ["ranking.rejected"],
      mismatches: [],
    });
    expect(
      checkApprovalScenario(syntheticApprovalInput({ linearMaximumIncomePayment: null })),
    ).toMatchObject({
      outcome: "justified_block",
      causes: ["approval.unavailable"],
      expectedDecisions: [],
      mismatches: [],
    });
    const report = runAssociativeScenarioMatrix({
      inventory: [{ ...completeInventory(), appraisal: null }],
      includeSynthetic: false,
    });
    expect(report.sections.inventory).toMatchObject({
      cases: 3,
      calculable: 0,
      justified_block: 3,
      real_error: 0,
      causes: { "inventory.appraisal_pending": 3, "ranking.rejected": 3 },
      expectedDecisions: { "ranking.rejected": 3 },
    });
  });

  it.each([null, 0, 15, 100])(
    "transitions missing progress to explicit official value %s",
    (progress) => {
      const input = syntheticForecastInput({
        constructionProgress: progress,
        completionDate: "2035-12-30",
      });
      expect(checkForecastScenario(input).mismatches).toEqual([]);
      const expected = oracleForecast(input);
      const actual = buildAssociativePaymentComparison(input);
      expect(actual.workEvolutionAvailable).toBe(progress !== null);
      expect(actual.highestLinearPayment).toBe(500.01);
      expect(
        actual.rows.slice(0, 2).map((row: { workEvolution: number | null }) => row.workEvolution),
      ).toEqual([null, null]);
      if (progress === null) {
        expect(actual.highestLinearTotal).toBeNull();
        expect(actual.rows[2].linearTotal).toBeNull();
      } else {
        const elapsedMonths = 2;
        const durationMonths = (2035 - 2026) * 12 + 12 - 10;
        const forecastProgress =
          progress / 100 + ((1 - progress / 100) * elapsedMonths) / durationMonths;
        expect(actual.rows[2].workEvolution).toBeCloseTo(10000.01 * 0.3 * forecastProgress, 8);
        expect(actual.highestLinearTotal).toBeCloseTo(expected.highestLinearTotal!, 8);
      }
    },
  );

  it.each(["", "0", "15", "100"])(
    "passes explicit manual percent %s through the unit-facts helper",
    (officialPercent) => {
      const resolved = resolveAssociativeConstructionProgress(null, officialPercent);
      expect(resolved).toBe(officialPercent === "" ? null : Number(officialPercent) / 100);
      expect(resolveAssociativeConstructionProgress(0.2, officialPercent)).toBe(0.2);
      const input = syntheticForecastInput({
        constructionProgress: resolved,
        completionDate: "2035-12-30",
      });
      expect(checkForecastScenario(input).mismatches).toEqual([]);
      expect(oracleForecast(input).workEvolutionAvailable).toBe(officialPercent !== "");
    },
  );

  it.each(Array.from({ length: 84 }, (_, index) => index + 1))(
    "checks complete and missing schedules for %i installments",
    (installments) => {
      const base = syntheticForecastInput();
      const input = syntheticForecastInput({
        installments,
        monthlyDates: base.monthlyDates.slice(0, installments),
        linearSchedule: base.linearSchedule.slice(0, installments),
        decreasingBlocks: [{ count: installments, correctedInstallment: 0 }],
      });
      expect(checkForecastScenario(input)).toMatchObject({ outcome: "calculable", mismatches: [] });
      expect(
        checkForecastScenario({ ...input, linearSchedule: input.linearSchedule.slice(1) }),
      ).toMatchObject({ outcome: "justified_block", mismatches: [] });
      expect(checkForecastScenario({ ...input, decreasingBlocks: [] })).toMatchObject({
        outcome: "justified_block",
        mismatches: [],
      });
    },
  );

  it("keeps annuals and signs out of recurring maxima and charges evolution once per calendar month", () => {
    const input = syntheticForecastInput({
      monthlyDates: ["2026-11-15", "2026-12-15", "2027-01-15"],
      installments: 3,
      linearSchedule: [{ payment: 500 }, { payment: 500 }, { payment: 500 }],
      decreasingBlocks: [{ count: 3, correctedInstallment: 600 }],
      entryPayment: { kind: "entry", date: "2026-10-04", value: 15000 },
      signals: [
        { date: "2026-12-10", value: 1000 },
        { date: "2027-02-05", value: 500 },
      ],
      annuals: [
        { date: "2026-12-15", value: 2000 },
        { date: "2027-02-15", value: 2000 },
      ],
    });
    expect(checkForecastScenario(input).mismatches).toEqual([]);
    const actual = buildAssociativePaymentComparison(input);
    const charged = actual.rows.filter(
      (row: { workEvolution: number | null }) => row.workEvolution !== null,
    );
    const months = charged.map((row: { paymentDate: string }) => row.paymentDate.slice(0, 7));
    expect(months).toEqual(["2027-02", "2026-12", "2027-01"]);
    expect(new Set(months).size).toBe(months.length);
    expect(
      actual.rows.find((row: { paymentDate: string }) => row.paymentDate === "2026-12-15")
        .annualPayment,
    ).toBe(2000);
  });

  it.each(["MCMV", "SBPE"] as const)(
    "requires appraisal, accepts explicit fallback and preserves official priority: %s",
    (modality) => {
      expect(
        checkAppraisalScenario({ reportedAppraisal: null, appraisalOverride: null, modality }),
      ).toMatchObject({
        outcome: "justified_block",
        causes: ["appraisal.pending"],
        mismatches: [],
      });
      for (const reportedAppraisal of [null, 0, 200000.01, 350000.01]) {
        expect(
          checkAppraisalScenario({ reportedAppraisal, appraisalOverride: 360000.01, modality }),
        ).toMatchObject({ outcome: "calculable", mismatches: [] });
      }
    },
  );

  it("keeps missing facts pending independently through per-unit corrections without mutating inventory", () => {
    const missing = Object.freeze({ ...completeInventory(), appraisal: null, progress: null });
    const initial = runAssociativeScenarioMatrix({ inventory: [missing], includeSynthetic: false });
    expect(initial.sections.inventory.causes["inventory.appraisal_pending"]).toBe(3);
    expect(initial.sections.inventory.causes["inventory.progress_pending"]).toBe(3);
    expect(initial.sections.inventory.real_error).toBe(0);
    for (const progress of [0, 0.15, 1]) {
      const withProgress = runAssociativeScenarioMatrix({
        inventory: [{ ...missing, progress }],
        includeSynthetic: false,
      });
      expect(withProgress.sections.inventory.causes["inventory.progress_pending"]).toBeUndefined();
      expect(withProgress.sections.inventory.causes["inventory.appraisal_pending"]).toBe(3);
      const complete = runAssociativeScenarioMatrix({
        inventory: [{ ...missing, progress, appraisal: 360000.01 }],
        includeSynthetic: false,
      });
      expect(complete.sections.inventory.causes["inventory.appraisal_pending"]).toBeUndefined();
      expect(complete.sections.inventory.real_error).toBe(0);
    }
    expect(missing).toMatchObject({ appraisal: null, progress: null });
  });

  it.each([-1, 1.01, 15, 100, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects inventory progress %s instead of interpreting source data as percent",
    (progress) => {
      const report = runAssociativeScenarioMatrix({
        inventory: [{ ...completeInventory(), progress }],
        includeSynthetic: false,
      });
      expect(report.progressConvention).toBe("fraction [0,1]; outside range is invalid");
      expect(report.sections.inventory.causes["inventory.progress_invalid"]).toBe(3);
      expect(report.sections.inventory.causes["forecast.unavailable"]).toBe(3);
      expect(report.sections.inventory.causes["approval.unavailable"]).toBe(3);
      expect(report.sections.inventory.real_error).toBe(0);
    },
  );

  it("visits all 3179 supplied synthetic units in memory and emits only aggregate coverage", () => {
    const inventory = Array.from({ length: 3179 }, (_, index) =>
      Object.freeze({
        ...completeInventory(),
        id: `PRIVATE-ID-${index}`,
        project: "PRIVATE-PROJECT",
        product: "PRIVATE-PRODUCT",
        appraisal: index % 3 === 0 ? null : 350000.01,
        progress: index % 7 === 0 ? null : 0.15,
      }),
    );
    const report = runAssociativeScenarioMatrix({
      inventory: Object.freeze(inventory),
      includeSynthetic: false,
    });
    expect(report.inventory).toEqual({
      supplied: 3179,
      visited: 3179,
      profilesPerUnit: 3,
      evaluatedProfiles: 12,
      reusedProfiles: 9525,
    });
    expect(report.sections.inventory.cases).toBe(9537);
    expect(report.sections.inventory.real_error).toBe(0);
    expect(report.sections.inventory.causes["inventory.appraisal_pending"]).toBe(
      Math.ceil(3179 / 3) * 3,
    );
    expect(report.sections.inventory.causes["inventory.progress_pending"]).toBe(
      Math.ceil(3179 / 7) * 3,
    );
    const serialized = JSON.stringify(report);
    for (const token of [
      "PRIVATE-ID",
      "PRIVATE-PROJECT",
      "PRIVATE-PRODUCT",
      "300000.4",
      "350000.01",
    ])
      expect(serialized).not.toContain(token);
  }, 15000);

  it("reuses only identical consumed inputs and preserves every aggregate against isolated runs", () => {
    const variants: Partial<Inventory>[] = [
      {},
      { finalWithKit: 300001.4 },
      { finalWithKit: null, finalPrice: 300002.4 },
      { finalWithKit: null, finalPrice: null },
      { completionDate: "2029-02-28" },
      { completionDate: "2027-02-29" },
      { unitBonus: 100.01 },
      { unitBonus: null },
      { tableSlack: 99.99 },
      { tableSlack: null },
      { appraisal: 360000.01 },
      { appraisal: null },
      { progress: 0 },
      { progress: 1 },
      { progress: null },
      { progress: Number.NaN },
      { progress: Number.POSITIVE_INFINITY },
      { progress: Number.NEGATIVE_INFINITY },
    ];
    const omittedProgress = completeInventory();
    delete omittedProgress.progress;
    expect(omittedProgress).not.toHaveProperty("progress");
    expect(omittedProgress.progress).toBeUndefined();
    const inventory = [
      ...variants.map((variant) => Object.freeze({ ...completeInventory(), ...variant })),
      Object.freeze(omittedProgress),
    ];
    const report = runAssociativeScenarioMatrix({
      inventory: Object.freeze([
        ...inventory,
        ...inventory.map((item, index) => Object.freeze({ ...item, id: `OTHER-${index}` })),
      ]),
      includeSynthetic: false,
    });
    const expected: MatrixAggregate = {
      cases: 0,
      comparisons: 0,
      calculable: 0,
      justified_block: 0,
      real_error: 0,
      causes: {},
      expectedDecisions: {},
      mismatches: {},
    };
    for (const item of inventory) {
      const isolated = runAssociativeScenarioMatrix({ inventory: [item], includeSynthetic: false });
      expect(isolated.inventory.evaluatedProfiles).toBe(3);
      expect(isolated.inventory.reusedProfiles).toBe(0);
      const section = isolated.sections.inventory;
      for (const field of [
        "cases",
        "comparisons",
        "calculable",
        "justified_block",
        "real_error",
      ] as const)
        expected[field] += section[field] * 2;
      for (const field of ["causes", "expectedDecisions", "mismatches"] as const)
        for (const [key, count] of Object.entries(section[field]))
          expected[field][key] = (expected[field][key] ?? 0) + count * 2;
    }
    expect(report.inventory.evaluatedProfiles).toBe(inventory.length * 3);
    expect(report.inventory.reusedProfiles).toBe(inventory.length * 3);
    expect(report.sections.inventory).toEqual(expected);
    expect(report.sections.inventory.real_error).toBe(0);
  }, 15000);

  it("never fills missing commercial adjustments or sale price with synthetic zero", () => {
    const report = runAssociativeScenarioMatrix({
      inventory: [
        { ...completeInventory(), finalPrice: null, finalWithKit: null },
        { ...completeInventory(), unitBonus: null },
        { ...completeInventory(), tableSlack: null },
      ],
      includeSynthetic: false,
    });
    expect(report.sections.inventory.cases).toBe(9);
    expect(report.sections.inventory.justified_block).toBe(9);
    expect(report.sections.inventory.real_error).toBe(0);
    expect(report.sections.inventory.causes).toMatchObject({
      "inventory.price_pending": 3,
      "inventory.adjustments_pending": 6,
    });
  });

  it("preserves pending evidence even when the modality API defaults to MCMV", () => {
    const model = oracleModality({
      familyIncomeCents: 500000,
      firstProperty: null,
      propertyValueCents: null,
      mcmvPropertyLimitCents: null,
    });
    expect(model.effectiveModality).toBe("MCMV");
    expect(model.pending).toEqual(["first_property.pending", "property_limit.pending"]);
    expect(
      oracleApproval(syntheticApprovalInput({ linearMaximumIncomePayment: null })).status,
    ).toBe("pending");
    expect(
      checkApprovalScenario(syntheticApprovalInput({ linearMaximumIncomePayment: 0 })).mismatches,
    ).toEqual([]);
  });

  it("uses UTC calendar arithmetic consistently across Windows and CI time zones", () => {
    const target = new URL("../scripts/qa/associative-scenario-matrix.mjs", import.meta.url).href;
    const script = `import { oracleLinear, syntheticLinearInput } from ${JSON.stringify(target)}; console.log(JSON.stringify(oracleLinear(syntheticLinearInput({entryDate:'2028-02-29',signal1:150.01}))))`;
    const results = ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"].map((TZ) =>
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, TZ },
        encoding: "utf8",
      }),
    );
    expect(new Set(results).size).toBe(1);
  });

  it("refuses CLI inventory arguments without echoing private contents", () => {
    let failed = false;
    try {
      execFileSync(
        process.execPath,
        [
          fileURLToPath(new URL("../scripts/qa/associative-scenario-matrix.mjs", import.meta.url)),
          "PRIVATE-INVENTORY",
        ],
        { stdio: "pipe" },
      );
    } catch (error) {
      failed = true;
      const result = error as { status: number; stdout: Buffer; stderr: Buffer };
      expect(result.status).toBe(2);
      expect(String(result.stdout)).toBe("");
      expect(String(result.stderr)).toBe(
        "No CLI arguments accepted; inventory is in-memory only.\n",
      );
    }
    expect(failed).toBe(true);
  });
});

describe("Official adapter and exact independent cash-flow oracle", () => {
  it.each(Array.from({ length: 84 }, (_, index) => index + 1))(
    "reconciles cents and nominal remainder for %i installments",
    (installments) => {
      for (const constructionEnd of ["2026-08-31", "2029-02-28", "2035-12-30"]) {
        const input = officialInput({
          installments: String(installments),
          constructionEnd,
          discount: "99.99",
        });
        const model = officialOracle(input);
        const actual = calculateWf13(wf13InputSchema.parse(input), { today: input.entryDate });
        expect(compareMetrics(actual, model.metrics)).toEqual([]);
        expect(actual.nominalSchedule.baseAmount).toBe(Number(model.nominal.baseCents) / 100);
        expect(actual.nominalSchedule.adjustedCount).toBe(model.nominal.adjustedCount);
        expect(actual.nominalSchedule.total).toBe(actual.proSoluto);
        expect(actual.approval.proSoluto.approved).toBe(model.approval.proSoluto);
        expect(actual.approval.incomeCommitment.approved).toBe(model.approval.incomeCommitment);
      }
    },
  );

  it.each(WF13_RANKINGS)("keeps raw rational thresholds exact for %s", (ranking) => {
    const limits = RANKING_ORACLE[Object.keys(RANKING_ORACLE)[WF13_RANKINGS.indexOf(ranking)]!]!;
    for (const delta of [-1n, 0n, 1n]) {
      const proNumerator = 30000001n * BigInt(limits[0]) + delta;
      const incomeNumerator = 1000001n * BigInt(limits[1]) + delta;
      const result = evaluateWf13RankingPolicy({
        ranking,
        proSoluto: { numerator: proNumerator, denominator: 30000001n * 10000n },
        incomeCommitment: { numerator: incomeNumerator, denominator: 1000001n * 10000n },
      });
      expect(result.proSoluto.approved).toBe(delta <= 0n && proNumerator >= 0n);
      expect(result.incomeCommitment.approved).toBe(delta <= 0n && incomeNumerator >= 0n);
      expect(result.status).toBe(
        ranking !== "NÃO ELEGÍVEL" && delta <= 0n ? "APROVADO" : "REPROVADO",
      );
    }
  });

  it("reconciles the current PDF golden through the real official form adapter", () => {
    const values = {
      ...officialSimulatorInitialValues("associativo-fluxo-linear"),
      "simulator-official-context-development": "Synthetic golden",
      "simulator-official-context-product": "SYN-GOLDEN",
      "simulator-official-context-official-match": true,
      "simulator-official-context-effective-date": "2026-08-17",
      "simulator-official-context-construction-end": "2029-02-28",
      "simulator-official-context-income": "4.000,00",
      "simulator-pro-soluto-property-value": "262.500,00",
      "simulator-pro-soluto-bonus": "28.500,00",
      "simulator-pro-soluto-financing": "210.000,00",
      "simulator-entry-entry": "1.000,00",
      "simulator-annuals-1-annual-value": "2.000,00",
      "simulator-annuals-2-annual-value": "2.000,00",
      "simulator-annuals-3-annual-value": "2.000,00",
      "simulator-commercial-policy-ranking": "BRONZE",
    };
    const input = wf13InputSchema.parse(
      buildOfficialSimulatorInput("associativo-fluxo-linear", values),
    );
    const result = calculateWf13(input, { today: "2026-08-17" });
    expect(compareMetrics(result, officialOracle(input).metrics)).toEqual([]);
    expect(result).toMatchObject({
      proSoluto: 17000,
      annualCorrectedTotal: 6506.19,
      correctedProSoluto: 17085,
      correctedWithAnnuals: 23115,
      correctedInstallment: 288.67,
      firstInstallmentDate: "2026-09-15",
    });
    expect(result.formulaVersion).toBe("wf13-1.3.0");
    expect(result.ok).toBe(true);
  });

  it("compares explicit signal dates and annual rounding without equating archive and official formulas", () => {
    const input = officialInput({
      signal1: "150.03",
      signal1Date: "2026-09-10",
      signal2: "150.02",
      signal2Date: "2026-10-10",
      signal3: "150.01",
      signal3Date: "2026-11-10",
      annuals: ["1000.01", "1000.02", "1000.03"],
    });
    const result = calculateWf13(wf13InputSchema.parse(input), { today: input.entryDate });
    expect(compareMetrics(result, officialOracle(input).metrics)).toEqual([]);
    expect(result.firstInstallmentDate).toBe("2026-12-10");
    expect(result.graceMonths).toBe(3);
  });
});
