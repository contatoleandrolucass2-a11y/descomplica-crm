import { describe, expect, it, vi } from "vitest";
import { calculateHousingSimulation, type HousingInput } from "@/lib/crm/simulators/caixa";
import * as housingModule from "@/lib/crm/simulators/caixa";
import { optimizeCaixaCommercialFunding } from "@/lib/crm/simulators/caixa-commercial-funding";

const profile: HousingInput = {
  income: 4000,
  propertyValue: 253790,
  appraisalValue: 340000,
  birthDate: "1987-01-22",
  state: "SP",
  city: "São Paulo",
  term: 420,
  product: "mcmv",
  system: "price",
  hasFgts36: true,
  previousSubsidy: false,
  singlePersonFamily: false,
  propertyType: "apartment",
  propertyArea: 25.77,
  officialQuickEstimate: true,
  propertyCondition: "new",
  inConstruction: true,
  constructionMonths: 38,
  ownFunds: 150,
  asOf: "2026-11-05",
};
function housing(input: HousingInput) {
  const result = calculateHousingSimulation(input);
  if (!result.ok) throw Error(result.errors.join("; "));
  return result;
}
function optimize(input = profile) {
  const result = optimizeCaixaCommercialFunding(input, housing(input));
  if (!result) throw Error("No commercial result");
  return result;
}

describe("CAIXA commercial-only base optimization", () => {
  it("maximizes the requested scenario without changing the true sale or appraisal", () => {
    const input = Object.freeze({ ...profile });
    const bank = Object.freeze(housing(input));
    const result = optimizeCaixaCommercialFunding(input, bank);
    expect(result).toEqual({
      baseValue: 261965.1,
      financing: 209572.08,
      rate: 5.5,
      financingQuota: 0.8,
      subsidy: 2099,
      firstPayment: 1200,
    });
    expect(input.propertyValue).toBe(253790);
    expect(input.appraisalValue).toBe(340000);
    expect(bank.financing).toBe(203032);
    const suggested = housing({ ...profile, propertyValue: 261770.43 });
    expect(suggested.financing).toBe(209416.34);
    expect(suggested.firstPayment).toBe(1199.13);
    expect(housing({ ...profile, propertyValue: 340000 }).financing).toBe(164392.59);
  });

  it.each([274999.99, 275000, 275000.01])(
    "honors the municipal band at sale %s",
    (propertyValue) => {
      const input = { ...profile, propertyValue };
      const result = optimize(input);
      expect(result.baseValue).toBeGreaterThanOrEqual(propertyValue);
      expect(result.baseValue).toBeLessThanOrEqual(input.appraisalValue!);
      expect(result.rate).toBe(propertyValue > 275000 ? 7.66 : 5.5);
      expect(result.subsidy).toBe(housing({ ...input, nominalRate: result.rate }).subsidy);
      expect(result.firstPayment).toBeLessThanOrEqual(1200);
    },
  );

  it.each([399999.99, 400000, 400000.01])(
    "checks both sides of the class boundary from %s",
    (propertyValue) => {
      const input = { ...profile, income: 9600, propertyValue, appraisalValue: 400000.1 };
      const result = optimize(input);
      const candidates = Array.from(
        { length: Math.round((input.appraisalValue - propertyValue) * 100) + 1 },
        (_, index) => {
          const baseValue = (Math.round(propertyValue * 100) + index) / 100;
          const candidate = housing({ ...input, propertyValue: baseValue });
          return { baseValue, financing: candidate.financing, rate: candidate.rate };
        },
      ).sort((a, b) => b.financing - a.financing || a.baseValue - b.baseValue || a.rate - b.rate);
      expect(result.baseValue).toBe(candidates[0]!.baseValue);
      expect(result.financing).toBe(candidates[0]!.financing);
    },
  );

  it("never passes the MCMV600000 upper boundary even with a higher appraisal", () => {
    const input = { ...profile, income: 13000, propertyValue: 599999.99, appraisalValue: 700000 };
    const result = optimize(input);
    expect(result.baseValue).toBeGreaterThanOrEqual(599999.99);
    expect(result.baseValue).toBeLessThanOrEqual(600000);
    expect(result.rate).toBe(10);
    expect(result.subsidy).toBe(0);
  });

  it.each([200000, 253790])(
    "keeps appraisal %s at or below sale as the real lower base",
    (appraisalValue) => {
      const input = { ...profile, appraisalValue };
      const bank = housing(input);
      expect(optimize(input)).toEqual({
        baseValue: appraisalValue,
        financing: bank.financing,
        rate: bank.rate,
        financingQuota: bank.financingQuota,
        subsidy: bank.subsidy,
        firstPayment: bank.firstPayment,
      });
    },
  );

  it.each(["price", "sac"] as const)(
    "retains %s quota and the client's approved payment",
    (system) => {
      const input = { ...profile, system, approvedPayment: 800, approvedFinancingQuotaPercent: 60 };
      const result = optimize(input);
      const atBase = housing({ ...input, propertyValue: result.baseValue });
      expect(result.financingQuota).toBe(0.6);
      expect(result.financing).toBeLessThanOrEqual(atBase.quotaFinancing);
      expect(result.financing).toBeLessThanOrEqual(atBase.maximumFinancingByIncome);
      expect(result.firstPayment).toBeLessThanOrEqual(800);
    },
  );

  it("limits funding to the real remaining purchase balance and retains its subsidy", () => {
    const input = {
      ...profile,
      propertyValue: 180000,
      appraisalValue: 270000,
      ownFunds: 50000,
      fgts: 10000,
      confirmedPublicContribution: 5000,
    };
    const bank = housing(input);
    const result = optimize(input);
    expect(result.subsidy).toBe(bank.subsidy);
    expect(result.financing).toBeCloseTo(180000 - 50000 - 10000 - 5000 - bank.subsidy, 2);
    expect(result.baseValue).toBe(180000);
    expect(result.financing).toBeLessThan(180000);
  });

  it("preserves the oldest applicant's term instead of using a younger initial profile", () => {
    const input = { ...profile, birthDate: "1960-01-22" };
    const result = optimize(input);
    const bank = housing({ ...input, propertyValue: result.baseValue });
    expect(bank.term).toBeLessThan(420);
    expect(result.financing).toBeLessThanOrEqual(bank.maximumFinancingByIncome);
    expect(result.firstPayment).toBeLessThanOrEqual(1200);
  });

  it("does not inflate the subsidy when the chosen commercial base changes its investment factor", () => {
    const input = { ...profile, income: 2500, propertyValue: 150000, appraisalValue: 270000 };
    const bank = housing(input);
    const result = optimize(input);
    expect(result.baseValue).toBeGreaterThan(input.propertyValue);
    expect(result.subsidy).toBe(bank.subsidy);
    expect(housing({ ...input, propertyValue: result.baseValue }).subsidy).not.toBe(result.subsidy);
    expect(result.financing).toBeCloseTo(input.propertyValue - input.ownFunds! - result.subsidy, 2);
  });

  it("finds a valid SBPE optimum even when the upper appraisal cannot fit the insurance payment", () => {
    const input: HousingInput = {
      ...profile,
      product: "sbpe",
      nominalRate: 5,
      propertyValue: 150000,
      appraisalValue: 1e10,
    };
    const result = optimize(input);
    expect(result.baseValue).toBeGreaterThanOrEqual(input.propertyValue);
    expect(result.baseValue).toBeLessThan(input.appraisalValue!);
    expect(result.financing).toBeLessThanOrEqual(input.propertyValue - input.ownFunds!);
    expect(result.firstPayment).toBeLessThanOrEqual(1200);
  });

  it("matches an exhaustive cent search around the optimum, including the smallest tied base", () => {
    const result = optimize();
    const values = Array.from({ length: 201 }, (_, offset) => {
      const baseValue = (Math.round(result.baseValue * 100) + offset - 100) / 100;
      return { baseValue, financing: housing({ ...profile, propertyValue: baseValue }).financing };
    }).sort((a, b) => b.financing - a.financing || a.baseValue - b.baseValue);
    expect(result.baseValue).toBe(values[0]!.baseValue);
    expect(result.financing).toBe(values[0]!.financing);
  });

  it("does not optimize without a known appraisal or for another property's bank result", () => {
    const bank = housing(profile);
    const withoutAppraisal = { ...profile };
    delete withoutAppraisal.appraisalValue;
    expect(optimizeCaixaCommercialFunding(withoutAppraisal, bank)).toBeNull();
    expect(optimizeCaixaCommercialFunding({ ...profile, propertyValue: 276000 }, bank)).toBeNull();
  });

  it("bounds engine evaluations for the stock-list scenario without an exhaustive price scan", () => {
    const bank = housing(profile);
    const calculate = vi.spyOn(housingModule, "calculateHousingSimulation");
    try {
      expect(optimizeCaixaCommercialFunding(profile, bank)?.financing).toBe(209572.08);
      expect(calculate.mock.calls.length).toBeLessThanOrEqual(20);
    } finally {
      calculate.mockRestore();
    }
  });

  it.each([2500, 4000, 9600])(
    "matches all cents around rate boundaries with income %s",
    (income) => {
      for (const sale of [150000, 274999.95, 399999.95]) {
        const input = { ...profile, income, propertyValue: sale, appraisalValue: sale + 1 };
        const expected = Array.from({ length: 101 }, (_, offset) => {
          const baseValue = (Math.round(sale * 100) + offset) / 100;
          const candidate = housing({ ...input, propertyValue: baseValue });
          const real = housing({
            ...input,
            nominalRate: candidate.rate,
            middleClass: candidate.middleClass,
          });
          return {
            baseValue,
            financing: Math.min(
              candidate.quotaFinancing,
              candidate.maximumFinancingByIncome,
              Math.round(
                (sale - real.ownFunds - real.fgts - real.subsidy - real.publicContribution) * 100,
              ) / 100,
            ),
          };
        }).sort((a, b) => b.financing - a.financing || a.baseValue - b.baseValue)[0]!;
        const actual = optimize(input);
        expect(actual.baseValue).toBe(expected.baseValue);
        expect(actual.financing).toBe(expected.financing);
      }
    },
  );
});
