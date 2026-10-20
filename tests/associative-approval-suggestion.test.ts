import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildAssociativeApprovalSuggestion: build,
  assessAssociativeCandidate: assess,
} = require("../lib/archive-investor/associative-approval-suggestion.mjs");
const { calculateInvestorFlow } = require("../lib/archive-investor/investor-calculator-rules.mjs");

const input = {
  selectedUnitId: "synthetic-adjustment-regression",
  annualMode: true,
  baseDate: "2026-10-20",
  entryDate: "2026-10-20",
  completionDate: "2029-12-31",
  salePrice: 276900,
  discountAuthorized: true,
  discount: 27000,
  financing: 126633.61,
  subsidy: 23035,
  housingCheck: 16000,
  income: 2550,
  entryValue: 150,
  installments: 84,
  signals: [0, 0, 0],
  intermediaries: [0, 0, 0, 0, 0],
  approvalTierId: "silver",
};
const cents = (amount: number) => Math.round(amount * 100);

describe("Associativo adjustment uses the proposal being edited", () => {
  it("uses only the annual amount needed after reaching the minimum entry", () => {
    const small = {
      ...input,
      salePrice: 100000,
      financing: 94200,
      discount: 0,
      subsidy: 0,
      housingCheck: 0,
      income: 500,
    };
    const suggestion = build(small, 15, "linear");
    expect(suggestion.entry).toBe(150);
    expect(suggestion.signals).toEqual([0, 0, 0]);
    expect(suggestion.annuals).toEqual([33.29, 33.29, 33.29, 33.29, 0]);
    expect(suggestion.approval.status).toBe("approved");
    expect(cents(suggestion.correctedInstallment)).toBe(9000);
    expect(
      assess(small, 15, "linear", {
        ...suggestion,
        annuals: [33.28, 33.28, 33.28, 33.28, 0],
      }).approved,
    ).toBe(false);
  });

  // Independent annuity/cent enumeration established these calendar-specific boundaries.
  it.each([
    [0, 50996.64, 50996.64],
    [1, 51265.26, 25632.63],
    [2, 52809.36, 17603.12],
    [3, 53078.92, 13269.73],
  ])("uses the minimum total for a calendar with %i signals", (signalCount, total, largest) => {
    const candidate = {
      entry: largest,
      signals: Array.from({ length: 3 }, (_, index) => (index < signalCount ? largest : 0)),
      annuals: [signalCount < 2 ? 1275 : 0, 1275, 1275, 1275, 0],
      installments: 84,
    };
    expect(Math.max(candidate.entry, ...candidate.signals)).toBe(largest);
    expect(
      cents(candidate.entry) + candidate.signals.reduce((sum, value) => sum + cents(value), 0),
    ).toBe(cents(total));
    expect(assess(input, 15, "linear", candidate).approved).toBe(true);
    expect(
      assess(input, 15, "linear", {
        ...candidate,
        entry: (cents(largest) - 1) / 100,
        signals: candidate.signals.map((value) => (value > 0 ? (cents(value) - 1) / 100 : 0)),
      }).approved,
    ).toBe(false);
  });

  it.each([5000, 12000])(
    "finds equal minimum payments without excessive annuals for income %i",
    (income) => {
      const small = {
        ...input,
        salePrice: 100000,
        financing: 81889.55,
        discount: 0,
        subsidy: 0,
        housingCheck: 0,
        income,
      };
      for (const flow of ["linear", "decreasing"]) {
        const suggestion = build(small, 15, flow);
        expect(suggestion.entry).toBe(150);
        expect(suggestion.signals).toEqual([150, 0, 0]);
        expect(suggestion.annuals).toEqual([0, 0, 0, 0, 0]);
        expect(suggestion.approval.status).toBe("approved");
      }
    },
  );

  it.each(["linear", "decreasing"])(
    "approves %s at the binding limit and preserves the ledger",
    (flow) => {
      const snapshot = structuredClone(input);
      const frozen = Object.freeze({
        ...input,
        signals: Object.freeze([...input.signals]),
        intermediaries: Object.freeze([...input.intermediaries]),
      });
      const suggestion = build(frozen, 15, flow);
      expect(suggestion).not.toBeNull();
      expect(suggestion.approval.status).toBe("approved");
      expect(suggestion.signalCount).toBe(3);
      expect(suggestion.entry).toBeLessThan(15000);
      expect(suggestion.signals).toEqual([suggestion.entry, suggestion.entry, suggestion.entry]);
      expect(suggestion.installmentBalance).toBeGreaterThan(20000);
      expect(cents(suggestion.correctedInstallment)).toBe(45900);
      expect(suggestion.annuals).toEqual([0, 1275, 1275, 1275, 0]);
      expect(suggestion.signalDates).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);

      const applied = calculateInvestorFlow({
        ...input,
        entryValue: suggestion.entry,
        signals: suggestion.signals,
        intermediaries: suggestion.annuals,
        installments: suggestion.installments,
      });
      expect(applied.ok).toBe(true);
      expect(applied.context.valueReal).toBe(249900);
      expect(applied.custom.balanceAfterResources).toBeCloseTo(84231.39, 2);
      const upfront =
        cents(suggestion.entry) +
        suggestion.signals.reduce((sum: number, value: number) => sum + cents(value), 0);
      const annuals = suggestion.annuals.reduce(
        (sum: number, value: number) => sum + cents(value),
        0,
      );
      expect(upfront + annuals + cents(applied.custom.installmentNominalBalance)).toBe(8423139);
      expect(applied.custom.installmentNominalBalance).toBe(suggestion.installmentBalance);
      expect(assess(input, 15, flow, suggestion).approval).toEqual(suggestion.approval);
      expect(
        assess(input, 15, flow, {
          ...suggestion,
          entry: (cents(suggestion.entry) - 1) / 100,
          signals: suggestion.signals.map((value: number) => (cents(value) - 1) / 100),
        }).approved,
      ).toBe(false);
      expect(input).toEqual(snapshot);
    },
  );

  it("does not keep an excessive old adjustment as the minimum input", () => {
    const previous = {
      ...input,
      entryValue: 19700.99,
      signals: [19700.97, 19700.97, 19700.97],
      intermediaries: [1275, 1275, 1275, 1275, 0],
    };
    const suggestion = build(previous, 15, "linear");
    expect(suggestion).toEqual(build(input, 15, "linear"));
  });

  it.each(["linear", "decreasing"])(
    "preserves discounts, resources and property adjustments in %s",
    (flow) => {
      const adjusted = {
        ...input,
        propertyValue: 282000,
        unitBonus: 3000,
        tableSlack: 2100,
        fgts: 1700,
      };
      const suggestion = build(adjusted, 15, flow);
      const actual = assess(adjusted, 15, flow, suggestion);
      expect(actual.approved).toBe(true);
      expect(actual.result.context.valueReal).toBe(249900);
      expect(actual.result.custom.balanceAfterResources).toBeCloseTo(82531.39, 2);
      expect(actual.approval).toEqual(suggestion.approval);
    },
  );

  it("fails closed without eligible classification or valid income", () => {
    expect(build({ ...input, approvalTierId: "not-eligible" }, 15, "linear")).toBeNull();
    expect(build({ ...input, income: 0 }, 15, "linear")).toBeNull();
    expect(build(input, null, "linear")).toBeNull();
    expect(build(input, 15, "unknown")).toBeNull();
  });
});
