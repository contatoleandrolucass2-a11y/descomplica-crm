import { describe, expect, it } from "vitest";

// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { buildAssociativeSignalDates } from "@/lib/archive-investor/associative-linear-calculator-rules.mjs";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { calculateAssociativeLinear } from "@/lib/archive-investor/associative-linear-calculator-rules.mjs";
// @ts-expect-error -- Existing archive API has no TypeScript declaration.
import { calculateAssociativeDecreasing } from "@/lib/archive-investor/associative-decreasing-calculator-rules.mjs";

// Mathematical reconstruction: docs/audits/associativo-formulas-salesforce-2026-10-07.md.
// These policy rates and all inputs are synthetic. No Salesforce records are fixtures.
// Raw API precision is checked separately from rounding the displayed amount to cents;
// the source comparison tolerance of R$ 0.05 is not a rounding increment.
const PRE_RATE = 0.005;
const POST_RATE = 0.015;
const WEIGHTS = [0.4, 0.3, 0.2, 0.1] as const;
const EXPLICIT_DATES = {
  firstInterestDate: "2025-12-15",
  firstInstallmentDate: "2026-02-15",
};

const SYNTHETIC = {
  development: "Synthetic parity development",
  product: "SYN-PARITY-UNIT",
  stockMatch: true,
  policyConfirmed: true,
  policyLimit: 84,
  installments: 38,
  entryDate: "2026-01-16",
  calculationDate: "2026-01-16",
  constructionEnd: "2029-02-20",
  salePrice: 300_000.37,
  bonus: 1_000.11,
  discount: 500.07,
  financing: 200_000.03,
  subsidy: 1_000.05,
  fgts: 2_000.04,
  housingCheck: 500.02,
  entry: 10_000.05,
  signal1: 0,
  signal2: 0,
  signal3: 0,
  annual1: 0,
  annual2: 0,
  annual3: 0,
  annual4: 0,
  annual5: 0,
};

type LinearInput = typeof SYNTHETIC & {
  firstInterestDate?: string;
  firstInstallmentDate?: string;
};
type Block = {
  count: number;
  preInstallments: number;
  postInstallments: number;
  correctedInstallment: number;
  firstInstallmentDate: string;
  lastInstallmentDate: string;
};

const input = (overrides: Partial<LinearInput> = {}): LinearInput => ({
  ...SYNTHETIC,
  ...overrides,
});

describe("shared entry-to-signal calendar", () => {
  it.each([
    ["2026-01-16", ["2026-02-15", "2026-03-15", "2026-04-15"]],
    ["2025-12-31", ["2026-01-15", "2026-02-15", "2026-03-15"]],
    ["2026-02-28", ["2026-03-15", "2026-04-15", "2026-05-15"]],
    ["", ["", "", ""]],
    ["2026-02-30", ["", "", ""]],
  ])("preserves canonical signals for entry %s", (entryDate, expected) => {
    expect(buildAssociativeSignalDates(entryDate)).toEqual(expected);
  });

  it("only offers signals strictly before a fixed first monthly", () => {
    const dates = buildAssociativeSignalDates("2026-01-16") as string[];
    expect(dates.filter((date) => date < "2026-02-15")).toHaveLength(0);
    expect(dates.filter((date) => date < "2026-03-15")).toHaveLength(1);
    expect(dates.filter((date) => date < "2026-04-15")).toHaveLength(2);
    expect(dates.filter((date) => date < "2026-05-15")).toHaveLength(3);
    const calculated = calculateAssociativeLinear(
      input({
        signal1: 150,
        signal2: 150,
        signal3: 150,
        firstInstallmentDate: "2026-05-15",
      }),
    );
    expect(calculated.ok).toBe(true);
    expect(calculated.signalDates).toEqual(dates);
  });
});
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const cents = (value: number) => Math.round(value * 100);

function nominalPrincipal(raw: LinearInput) {
  return (
    raw.salePrice -
    sum([
      raw.bonus,
      raw.discount,
      raw.financing,
      raw.subsidy,
      raw.fgts,
      raw.housingCheck,
      raw.entry,
      raw.signal1,
      raw.signal2,
      raw.signal3,
      raw.annual1,
      raw.annual2,
      raw.annual3,
      raw.annual4,
      raw.annual5,
    ])
  );
}

// Accumulate one discounted unit payment per month. No PMT, annuity factor,
// phase allocation or calculator output participates in the expected values.
function discounts(installments: number, preInstallments: number) {
  let discountedUnit = 1;
  return Array.from({ length: installments }, (_, index) => {
    discountedUnit /= 1 + (index < preInstallments ? PRE_RATE : POST_RATE);
    return discountedUnit;
  });
}

function monthlyOracle(principal: number, installments: number, pre: number, correction: number) {
  let corrected = principal;
  for (let month = 0; month < correction; month += 1) {
    corrected *= 1 + (pre > 0 ? PRE_RATE : POST_RATE);
  }
  const factors = discounts(installments, pre);
  return { corrected, factors, payment: corrected / sum(factors) };
}

function expectLinearValue(raw: LinearInput, pre: number, correction: number) {
  const expected = monthlyOracle(nominalPrincipal(raw), raw.installments, pre, correction);
  const actual = calculateAssociativeLinear(raw, { today: raw.calculationDate });

  expect(actual.errors).toEqual([]);
  expect(actual.ok).toBe(true);
  expect(actual.preInstallments).toBe(pre);
  expect(actual.postInstallments).toBe(raw.installments - pre);
  expect(actual.installmentBalance).toBeCloseTo(nominalPrincipal(raw), 8);
  expect(actual.correctedInstallmentBalance).toBeCloseTo(expected.corrected, 6);
  expect(actual.correctedInstallment).toBeCloseTo(expected.payment, 8);
  expect(cents(actual.correctedInstallment)).toBe(cents(expected.payment));
  expect(sum(expected.factors.map((factor) => factor * actual.correctedInstallment))).toBeCloseTo(
    expected.corrected,
    6,
  );
  return actual;
}

// Literal partitions also pin the order of remainder allocation, independently
// of the implementation's partition helper and the source's visual segments.
const PARTITIONS = [
  { installments: 4, counts: [1, 1, 1, 1] },
  { installments: 5, counts: [2, 1, 1, 1] },
  { installments: 6, counts: [2, 2, 1, 1] },
  { installments: 7, counts: [2, 2, 2, 1] },
  { installments: 36, counts: [9, 9, 9, 9] },
  { installments: 37, counts: [10, 9, 9, 9] },
  { installments: 38, counts: [10, 10, 9, 9] },
  { installments: 39, counts: [10, 10, 10, 9] },
  { installments: 40, counts: [10, 10, 10, 10] },
  { installments: 69, counts: [18, 17, 17, 17] },
  { installments: 84, counts: [21, 21, 21, 21] },
];

function decreasingInput(installments: number, preInstallments: number) {
  return {
    uncorrectedBalance: 48_000.17,
    correctedBalance: 53_217.83,
    installments,
    preInstallments,
    postInstallments: installments - preInstallments,
    firstInstallmentDate: "2026-02-15",
  };
}

function dateAt(index: number) {
  return new Date(Date.UTC(2026, 1 + index, 15)).toISOString().slice(0, 10);
}

function expectDecreasingValue(installments: number, pre: number, counts: readonly number[]) {
  const raw = decreasingInput(installments, pre);
  const actual = calculateAssociativeDecreasing(raw);
  const factors = discounts(installments, pre);
  const blocks: Block[] = actual.blocks;

  expect(actual.errors).toEqual([]);
  expect(actual.ok).toBe(true);
  expect(blocks.map((block) => block.count)).toEqual(counts);
  let start = 0;
  let totalPresentValue = 0;
  for (const [index, count] of counts.entries()) {
    const block = blocks[index]!;
    const blockFactors = factors.slice(start, start + count);
    const principal = raw.correctedBalance * WEIGHTS[index]!;
    const expectedPayment = principal / sum(blockFactors);
    const expectedPre = blockFactors.filter((_, offset) => start + offset < pre).length;

    expect(block.preInstallments, `block ${index + 1}: pre periods`).toBe(expectedPre);
    expect(block.postInstallments, `block ${index + 1}: post periods`).toBe(count - expectedPre);
    expect(block.firstInstallmentDate).toBe(dateAt(start));
    expect(block.lastInstallmentDate).toBe(dateAt(start + count - 1));
    expect(block.correctedInstallment, `block ${index + 1}: payment`).toBeCloseTo(
      expectedPayment,
      8,
    );
    expect(cents(block.correctedInstallment)).toBe(cents(expectedPayment));
    const presentValue = sum(blockFactors.map((factor) => block.correctedInstallment * factor));
    expect(presentValue, `block ${index + 1}: present value`).toBeCloseTo(principal, 6);
    totalPresentValue += presentValue;
    start += count;
  }
  expect(start).toBe(installments);
  expect(totalPresentValue).toBeCloseTo(raw.correctedBalance, 6);
  return blocks;
}

describe("Salesforce audit: linear present value with explicit financial dates", () => {
  it.each([
    { phase: "all pre", installments: 36, pre: 36, constructionEnd: "2029-02-20" },
    { phase: "mixed", installments: 38, pre: 19, constructionEnd: "2027-09-20" },
    {
      phase: "all post in delivery month",
      installments: 24,
      pre: 0,
      constructionEnd: "2026-02-20",
    },
    { phase: "all post before entry", installments: 24, pre: 0, constructionEnd: "2025-12-31" },
  ])("conserves VP for $phase", ({ installments, pre, constructionEnd }) => {
    const raw = input({ ...EXPLICIT_DATES, installments, constructionEnd });
    const actual = expectLinearValue(raw, pre, 1);
    expect(actual.firstInstallmentDate).toBe(EXPLICIT_DATES.firstInstallmentDate);
  });

  it.each([
    { firstInterestDate: "2026-02-01", firstInstallmentDate: "2026-02-15", correction: 0 },
    { firstInterestDate: "2026-01-20", firstInstallmentDate: "2026-02-05", correction: 0 },
    { firstInterestDate: "2025-12-20", firstInstallmentDate: "2026-02-05", correction: 1 },
    { firstInterestDate: "2025-10-20", firstInstallmentDate: "2026-02-10", correction: 3 },
    { firstInterestDate: "2025-08-05", firstInstallmentDate: "2026-02-15", correction: 5 },
  ])(
    "uses k=$correction between $firstInterestDate and $firstInstallmentDate",
    ({ firstInterestDate, firstInstallmentDate, correction }) => {
      const raw = input({ firstInterestDate, firstInstallmentDate, installments: 36 });
      const actual = expectLinearValue(raw, 36, correction);
      expect(actual.firstInstallmentDate).toBe(firstInstallmentDate);
      expect(actual.monthlyCorrectionMonths).toBe(correction);
    },
  );

  it("keeps explicit correction independent of signal count and calculation day", () => {
    for (const calculationDate of ["2026-01-16", "2026-02-16"]) {
      for (const signals of [
        [0, 0, 0],
        [600, 400, 200],
      ]) {
        const raw = input({
          firstInterestDate: "2026-01-05",
          firstInstallmentDate: "2026-05-15",
          installments: 36,
          constructionEnd: "2030-02-20",
          calculationDate,
          signal1: signals[0]!,
          signal2: signals[1]!,
          signal3: signals[2]!,
          salePrice: SYNTHETIC.salePrice + sum(signals),
        });
        const actual = expectLinearValue(raw, 36, 3);
        expect(actual.monthlyCorrectionMonths).toBe(3);
        expect(actual.firstInstallmentDate).toBe("2026-05-15");
      }
    }
  });

  it.each(["2026-02-05", "2026-02-10", "2026-02-15"])(
    "treats the entire delivery month as post for first payment %s",
    (firstInstallmentDate) => {
      for (const constructionEnd of ["2026-02-01", "2026-02-15", "2026-02-28"]) {
        const actual = expectLinearValue(
          input({ ...EXPLICIT_DATES, firstInstallmentDate, constructionEnd, installments: 24 }),
          0,
          1,
        );
        expect(actual.firstInstallmentDate).toBe(firstInstallmentDate);
        expect(actual.baseRate).toBe(POST_RATE);
      }
    },
  );

  it("adds one pre period only when delivery moves to the next calendar month", () => {
    expectLinearValue(input({ ...EXPLICIT_DATES, constructionEnd: "2026-02-28" }), 0, 1);
    expectLinearValue(input({ ...EXPLICIT_DATES, constructionEnd: "2026-03-01" }), 1, 1);
  });
});

describe("Salesforce audit: nominal annuals form the monthly principal", () => {
  it("deducts resources, signals and nominal annuals exactly once before correcting P", () => {
    const raw = input({
      firstInterestDate: "2026-01-10",
      firstInstallmentDate: "2026-05-15",
      constructionEnd: "2029-05-20",
      signal1: 600.13,
      signal2: 400.12,
      signal3: 200.11,
      annual1: 1_000.13,
      annual2: 2_000.27,
      annual3: 3_000.39,
    });
    expect(nominalPrincipal(raw)).toBeCloseTo(77_798.85, 8);
    expectLinearValue(raw, 36, 3);
  });

  it("keeps equal nominal annual totals in different years on the same monthly base", () => {
    const firstYear = input({ ...EXPLICIT_DATES, annual1: 6_000.17 });
    const thirdYear = input({ ...EXPLICIT_DATES, annual3: 6_000.17 });
    const early = expectLinearValue(firstYear, 36, 1);
    const late = expectLinearValue(thirdYear, 36, 1);

    expect(late.annualCorrectedTotal).toBeGreaterThan(early.annualCorrectedTotal);
    expect(early.annualCorrectedTotal).toBeGreaterThan(6_000.17);
    expect(late.correctedInstallmentBalance).toBeCloseTo(early.correctedInstallmentBalance, 8);
    expect(late.correctedInstallment).toBeCloseTo(early.correctedInstallment, 8);
  });
});

describe("Associative default calendar: first interest follows calculation date", () => {
  it.each([
    { signals: [0, 0, 0], correction: 1, first: "2026-02-15" },
    { signals: [600, 0, 0], correction: 2, first: "2026-03-15" },
    { signals: [600, 400, 0], correction: 3, first: "2026-04-15" },
    { signals: [600, 400, 200], correction: 4, first: "2026-05-15" },
  ])(
    "derives k=$correction from default dates and scheduled signals",
    ({ signals, correction, first }) => {
      const raw = input({
        installments: 36,
        constructionEnd: "2030-02-20",
        signal1: signals[0]!,
        signal2: signals[1]!,
        signal3: signals[2]!,
      });
      const actual = expectLinearValue(raw, 36, correction);
      expect(actual.firstInstallmentDate).toBe(first);
      expect(actual.firstInterestDate).toBe("2025-12-31");
      expect(actual.monthlyCorrectionMonths).toBe(correction);
      expect(actual.graceMonths).toBe(correction - 1);
    },
  );

  it("uses k=0 when the generated first monthly is in the calculation month", () => {
    const actual = expectLinearValue(
      input({
        entryDate: "2026-01-05",
        calculationDate: "2026-01-05",
        constructionEnd: "2030-02-20",
        installments: 36,
      }),
      36,
      0,
    );
    expect(actual.firstInterestDate).toBe("2025-12-31");
    expect(actual.firstInstallmentDate).toBe("2026-01-15");
    expect(actual.monthlyCorrectionMonths).toBe(0);
  });

  it("anchors default interest to calculation date, not the earlier entry date", () => {
    const actual = expectLinearValue(
      input({
        entryDate: "2026-01-05",
        calculationDate: "2026-02-16",
        constructionEnd: "2030-02-20",
        installments: 36,
      }),
      36,
      1,
    );
    expect(actual.firstInterestDate).toBe("2026-01-31");
    expect(actual.firstInstallmentDate).toBe("2026-03-15");
    expect(actual.monthlyCorrectionMonths).toBe(1);
  });
});

describe("Associative explicit dates: monthly payment must follow entry and all signals", () => {
  it.each([
    { entryDate: "2026-01-15", firstInstallmentDate: "2026-01-15", signal1: 0, signal2: 0 },
    { entryDate: "2026-01-16", firstInstallmentDate: "2026-01-15", signal1: 0, signal2: 0 },
    { entryDate: "2026-01-16", firstInstallmentDate: "2026-02-05", signal1: 600, signal2: 0 },
    { entryDate: "2026-01-16", firstInstallmentDate: "2026-02-15", signal1: 600, signal2: 0 },
    { entryDate: "2026-01-16", firstInstallmentDate: "2026-03-10", signal1: 600, signal2: 400 },
    { entryDate: "2026-01-16", firstInstallmentDate: "2026-03-15", signal1: 600, signal2: 400 },
  ])(
    "rejects overlapping monthly date $firstInstallmentDate with entry $entryDate and signals $signal1/$signal2",
    (overrides) => {
      const actual = calculateAssociativeLinear(input({ ...EXPLICIT_DATES, ...overrides }));
      expect(actual.ok).toBe(false);
      expect(actual.errors).toEqual(
        expect.arrayContaining([expect.stringMatching(/primeira mensal.*posterior/u)]),
      );
    },
  );

  it.each([
    "entryDate",
    "calculationDate",
    "constructionEnd",
    "firstInterestDate",
    "firstInstallmentDate",
  ])("rejects an impossible %s even with explicit monthly dates", (field) => {
    const actual = calculateAssociativeLinear(input({ ...EXPLICIT_DATES, [field]: "2026-02-30" }));
    expect(actual.ok).toBe(false);
    expect(actual.errors.length).toBeGreaterThan(0);
  });

  it("rejects a monthly date outside the supported payment days", () => {
    const actual = calculateAssociativeLinear(
      input({ ...EXPLICIT_DATES, firstInstallmentDate: "2026-02-16" }),
    );
    expect(actual.ok).toBe(false);
    expect(actual.errors.length).toBeGreaterThan(0);
  });
});

describe("Salesforce audit: balanced decreasing blocks and accumulated present value", () => {
  it.each(PARTITIONS)(
    "partitions n=$installments with the remainder first",
    ({ installments, counts }) => {
      const actual = calculateAssociativeDecreasing(decreasingInput(installments, installments));
      const blocks: Block[] = actual.blocks;
      expect(actual.errors).toEqual([]);
      expect(actual.ok).toBe(true);
      expect(blocks.map((block) => block.count)).toEqual(counts);
      expect(sum(blocks.map((block) => block.count))).toBe(installments);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    },
  );

  it.each([0, 1, 2, 3])("capitalizes the elapsed pre months of block index %i", (index) => {
    const raw = decreasingInput(36, 36);
    const actual = calculateAssociativeDecreasing(raw);
    const block: Block = actual.blocks[index];
    const blockFactors = discounts(36, 36).slice(index * 9, (index + 1) * 9);
    const weightedPrincipal = raw.correctedBalance * WEIGHTS[index]!;
    expect(actual.ok).toBe(true);
    expect(block.correctedInstallment).toBeCloseTo(weightedPrincipal / sum(blockFactors), 8);
    expect(block.correctedInstallment * sum(blockFactors)).toBeCloseTo(weightedPrincipal, 6);
  });

  it.each(PARTITIONS)(
    "reconciles VP, dates and quantities for n=$installments",
    ({ installments, counts }) => {
      for (const pre of [0, Math.floor(installments / 2), installments]) {
        expectDecreasingValue(installments, pre, counts);
      }
    },
  );

  it.each([8, 9, 10, 17, 18, 19, 26, 27, 28])(
    "preserves each block's VP around phase boundaries with m=%i",
    (pre) => {
      expectDecreasingValue(36, pre, [9, 9, 9, 9]);
    },
  );

  it("allows block 2 to exceed block 1 when post interest outweighs the smaller weight", () => {
    const blocks = expectDecreasingValue(84, 0, [21, 21, 21, 21]);
    expect(blocks[1]!.correctedInstallment).toBeGreaterThan(blocks[0]!.correctedInstallment);
  });
});
