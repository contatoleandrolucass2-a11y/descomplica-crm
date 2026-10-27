import { describe, expect, it } from "vitest";
import {
  calculateAge,
  calculateExtraAmortization,
  calculateFgtsTime,
  calculateHousingSimulation,
  calculatePrice,
  calculateSacFirst,
  estimateConstructionInterest,
  getHousingRate,
  getMaximumFinancingQuota,
  getMaximumTerm,
  getMcmvBand,
  getMcmvSubsidyEligibility,
  getMunicipalLimit,
  type HousingInput,
} from "@/lib/crm/simulators/caixa";
import { CAIXA_CITIES } from "@/lib/crm/simulators/caixa-reference-data";

const base: HousingInput = {
  income: 6000,
  propertyValue: 240000,
  birthDate: "1990-10-25",
  asOf: "2026-10-25",
  state: "SP",
  city: "São Paulo",
  term: 420,
  product: "mcmv",
  system: "price",
  propertyCondition: "new",
  ownFunds: 60000,
  mipMonthly: 20,
  dfiMonthly: 15,
  operatingFee: 25,
  confirmedSubsidy: 0,
};
function success(input: { [K in keyof HousingInput]?: HousingInput[K] | undefined } = {}) {
  const result = calculateHousingSimulation(
    Object.fromEntries(
      Object.entries({ ...base, ...input }).filter(([, value]) => value !== undefined),
    ) as unknown as HousingInput,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result;
}

describe("CAIXA mathematics and official policy boundaries, consulted through 27/10/2026", () => {
  it("keeps the 5,571 official municipal limits complete and bounded", () => {
    expect(CAIXA_CITIES).toHaveLength(5571);
    expect(new Set(CAIXA_CITIES.map((city) => `${city.u}|${city.n}`)).size).toBe(5571);
    expect(CAIXA_CITIES.every((city) => city.l >= 210000 && city.l <= 275000)).toBe(true);
  });
  it.each([
    [3200, "Faixa 1"],
    [3200.01, "Faixa 2"],
    [5000, "Faixa 2"],
    [5000.01, "Faixa 3"],
    [9600, "Faixa 3"],
    [9600.01, "Classe Média"],
    [13000, "Classe Média"],
    [13000.01, "SBPE"],
  ])("classifies income %s", (income, band) => expect(getMcmvBand(income as number)).toBe(band));
  it.each([
    [2160, 4.75],
    [2160.01, 5],
    [2850, 5],
    [2850.01, 5.25],
    [3200, 5.25],
    [3200.01, 5.5],
    [3500, 5.5],
    [3500.01, 6],
    [4000, 6],
    [4000.01, 7],
    [5000, 7],
    [5000.01, 8.16],
    [9600, 8.16],
    [9600.01, 10],
    [13000, 10],
  ])("uses annual nominal table boundary %s", (income, rate) =>
    expect(getHousingRate({ income, state: "SP" })).toBe(rate),
  );
  it("applies regional and FGTS discounts only where published", () => {
    expect(getHousingRate({ income: 2160, state: "BA", hasFgts36: true })).toBe(4);
    expect(getHousingRate({ income: 6000, state: "SP", hasFgts36: true })).toBe(7.66);
    expect(getHousingRate({ income: 10000, state: "BA", hasFgts36: true })).toBe(10);
    expect(getHousingRate({ income: 6000, product: "sbpe" })).toBeNaN();
    expect(getHousingRate({ income: 6000, previousSubsidy: true })).toBeNaN();
    expect(
      getHousingRate({
        income: 4000,
        state: "SP",
        city: "São Paulo",
        propertyValue: 275000.01,
      }),
    ).toBe(8.16);
  });
  it("converts nominal monthly and effective annual rates without confusing CET", () => {
    const result = success();
    expect(result.rate).toBe(8.16);
    expect(result.effectiveRate).toBeCloseTo(((1 + 0.0816 / 12) ** 12 - 1) * 100, 10);
    expect(result.financing).toBe(180000);
    expect(result.firstPayment).toBeCloseTo(
      Math.round((calculatePrice(180000, 8.16, 420) + 60) * 100) / 100,
      2,
    );
    expect(result.entryNeeded).toBe(0);
  });
  it("matches independent Price and SAC examples and zero interest", () => {
    expect(calculatePrice(100000, 12, 12)).toBeCloseTo(8884.878867834, 6);
    expect(calculateSacFirst(100000, 12, 12)).toBeCloseTo(9333.333333333, 6);
    expect(calculatePrice(120000, 0, 120)).toBe(1000);
  });
  it("preserves SBPE quotas and does not force a product switch", () => {
    expect(success({ product: "sbpe", nominalRate: 11, system: "sac" }).financingQuota).toBe(0.9);
    expect(success({ product: "sbpe", nominalRate: 11 }).financingQuota).toBe(0.8);
    expect(calculateHousingSimulation({ ...base, income: 13000.01 }).ok).toBe(false);
    expect(calculateHousingSimulation({ ...base, product: "sbpe" }).ok).toBe(false);
  });
  it("uses the lower of purchase and CAIXA appraisal for the quota base", () => {
    expect(
      success({
        product: "sbpe",
        nominalRate: 11,
        system: "sac",
        income: 50000,
        propertyValue: 500000,
        appraisalValue: 450000,
        ownFunds: 0,
      }),
    ).toMatchObject({ quotaBaseValue: 450000, quotaFinancing: 405000, financing: 405000 });
    expect(
      success({
        product: "sbpe",
        nominalRate: 11,
        system: "price",
        income: 50000,
        propertyValue: 500000,
        appraisalValue: 550000,
        ownFunds: 0,
      }).quotaFinancing,
    ).toBe(400000);
  });
  it("accepts a smaller approved quota but never one above the product ceiling", () => {
    expect(
      success({
        product: "sbpe",
        nominalRate: 11,
        system: "sac",
        approvedFinancingQuotaPercent: 75,
      }).financingQuota,
    ).toBe(0.75);
    expect(
      calculateHousingSimulation({
        ...base,
        product: "sbpe",
        nominalRate: 11,
        system: "price",
        approvedFinancingQuotaPercent: 80.01,
      }).ok,
    ).toBe(false);
  });
  it("enforces class middle used-property quota and income limits", () => {
    expect(
      getMaximumFinancingQuota({
        income: 4000,
        propertyValue: 450000,
        propertyCondition: "used",
        state: "SP",
        system: "sac",
      }),
    ).toBe(0.6);
    expect(
      success({ income: 10000, propertyValue: 500000, propertyCondition: "used" }).financingQuota,
    ).toBe(0.6);
    expect(
      success({ income: 10000, propertyValue: 500000, propertyCondition: "new" }).financingQuota,
    ).toBe(0.8);
    expect(
      success({
        income: 10000,
        propertyValue: 500000,
        propertyCondition: "used",
        state: "BA",
        city: "Salvador",
      }).financingQuota,
    ).toBe(0.8);
    expect(success({ propertyValue: 450000 })).toMatchObject({
      middleClass: true,
      rate: 10,
      subsidy: 0,
    });
    expect(
      success({
        income: 3000,
        propertyValue: 300000,
        middleClass: true,
        propertyCondition: "used",
      }),
    ).toMatchObject({ middleClass: true, rate: 10, financingQuota: 0.6 });
    expect(calculateHousingSimulation({ ...base, propertyValue: 600000.01 }).ok).toBe(false);
    expect(
      calculateHousingSimulation({
        ...base,
        income: 3000,
        propertyValue: 300000,
        middleClass: true,
        confirmedSubsidy: 10000,
      }).ok,
    ).toBe(false);
  });
  it("uses the official municipal limit and raises the rate band when the property requires it", () => {
    expect(getMunicipalLimit("São Paulo", "SP")).toBe(275000);
    expect(getMunicipalLimit("Campinas", "SP")).toBe(270000);
    for (const [city, state] of [
      ["Arez", "RN"],
      ["Assú", "RN"],
      ["Barão do Monte Alto", "MG"],
      ["Graccho Cardoso", "SE"],
      ["Santo Antônio de Leverger", "MT"],
      ["São Luiz do Anauá", "RR"],
    ] as const)
      expect(getMunicipalLimit(city, state)).toBe(210000);
    expect(success({ income: 5000, propertyValue: 240000 }).rate).toBe(7);
    expect(success({ income: 4000, propertyValue: 275000 })).toMatchObject({
      rate: 6,
      rateAdjustedByProperty: false,
      municipalLimit: 275000,
    });
    expect(success({ income: 4000, propertyValue: 275000.01 })).toMatchObject({
      rate: 8.16,
      rateAdjustedByProperty: true,
      rateBand: "MCMV Faixa 3 por valor do imóvel",
    });
    expect(success({ income: 4000, propertyValue: 400000 }).rate).toBe(8.16);
    expect(success({ income: 4000, propertyValue: 400000.01 })).toMatchObject({
      middleClass: true,
      rate: 10,
    });
    const result = success({
      income: 4000,
      confirmedSubsidy: undefined,
      mipMonthly: undefined,
      dfiMonthly: undefined,
      operatingFee: undefined,
    });
    expect(result.subsidy).toBe(0);
    expect(result.subsidyConfirmed).toBe(false);
    expect(result.insuranceKnown).toBe(false);
    expect(result.warnings.join(" ")).toContain("Renda potencialmente elegível");
    expect(result.warnings.join(" ")).toContain("sem os seguros ausentes");
  });
  it("distinguishes subsidy eligibility from a confirmed monetary amount", () => {
    expect(
      getMcmvSubsidyEligibility({
        income: 4000,
        propertyValue: 276000,
        product: "mcmv",
      }),
    ).toBe("eligible-review");
    expect(
      getMcmvSubsidyEligibility({
        income: 4000.01,
        propertyValue: 276000,
        product: "mcmv",
      }),
    ).toBe("not-eligible");
    expect(
      getMcmvSubsidyEligibility({
        income: 4000,
        propertyValue: 276000,
        product: "mcmv",
        previousSubsidy: true,
      }),
    ).toBe("not-eligible");
    expect(
      getMcmvSubsidyEligibility({
        income: 4000,
        propertyValue: 276000,
        product: "mcmv",
        confirmedSubsidy: 3500,
      }),
    ).toBe("confirmed");
    expect(
      success({
        income: 4000,
        propertyValue: 276000,
        ownFunds: 0,
        confirmedSubsidy: undefined,
      }),
    ).toMatchObject({ subsidy: 0, subsidyEligibility: "eligible-review" });
  });
  it("keeps public contribution separate and enforces the minimum FGTS complement", () => {
    const subsidyProfile = {
      income: 3000,
      propertyValue: 210000,
      cityLimit: 210000,
    };
    expect(
      calculateHousingSimulation({ ...base, ...subsidyProfile, confirmedSubsidy: 1499.99 }).ok,
    ).toBe(false);
    expect(success({ ...subsidyProfile, confirmedSubsidy: 1500 }).subsidy).toBe(1500);
    expect(
      success({
        income: 3000,
        propertyValue: 210000,
        cityLimit: 210000,
        confirmedSubsidy: 55000,
        confirmedPublicContribution: 30000,
      }).publicContribution,
    ).toBe(30000);
  });
  it("tracks the public quick-calculator parameters without presenting them as confirmed", () => {
    const result = success({
      income: 6000,
      propertyValue: 300000,
      ownFunds: 0,
      approvedPayment: undefined,
      mipMonthly: undefined,
      dfiMonthly: undefined,
      operatingFee: undefined,
      officialQuickEstimate: true,
      birthDate: "1991-03-15",
      asOf: "2026-10-26",
    });
    expect(result.financing).toBeCloseTo(239295.3, -2);
    expect(result.firstPayment).toBe(1800);
    expect(result.effectiveRate).toBeCloseTo(8.4722, 3);
    expect(result).toMatchObject({
      insuranceKnown: false,
      insuranceEstimated: true,
      operatingFeeKnown: false,
      operatingFeeEstimated: true,
    });
  });
  it("uses the public SBPE quick rate when a confirmed individual rate is absent", () => {
    const standard = success({
      product: "sbpe",
      nominalRate: undefined,
      officialQuickEstimate: true,
    });
    expect(standard.rateEstimated).toBe(true);
    expect(standard.effectiveRate).toBeCloseTo(11.49, 10);
    expect(
      success({
        product: "sbpe",
        income: 80000,
        nominalRate: undefined,
        officialQuickEstimate: true,
      }).effectiveRate,
    ).toBeCloseTo(13.4, 10);
  });
  it("applies the automatic 30% income ceiling and never rounds financing upward", () => {
    expect(success({ income: 4000 }).maximumPaymentByIncome).toBe(1200);
    expect(calculateHousingSimulation({ ...base, income: 4000, approvedPayment: 1200.01 }).ok).toBe(
      false,
    );
    const result = success({ approvedPayment: 1000, ownFunds: 0 });
    expect(result.firstPayment).toBeLessThanOrEqual(1000);
    expect(result.financing).toBeLessThanOrEqual(result.maximumFinancingByIncome);
    expect(result.entryNeeded).toBeGreaterThan(0);
    expect(calculateHousingSimulation({ ...base, approvedPayment: 1800.01 }).ok).toBe(false);
    expect(
      calculateHousingSimulation({
        ...base,
        product: "sbpe",
        nominalRate: 11,
        incomeLimitPercent: 25,
        approvedPayment: 1500.01,
      }).ok,
    ).toBe(false);
  });
  it.each([
    { birthDate: "2026-02-30" },
    { birthDate: "2040-01-01" },
    { birthDate: "2010-01-01" },
    { birthDate: "1940-01-01" },
    { term: 420.5 },
    { term: 0 },
    { income: NaN },
    { ownFunds: -1 },
    { confirmedSubsidy: Infinity },
    { city: "" },
    { state: "XX" },
  ])("rejects invalid eligibility inputs %j", (input) =>
    expect(calculateHousingSimulation({ ...base, ...input }).ok).toBe(false),
  );
  it("matches CAIXA calendar-month age limits and clamps excessive terms", () => {
    expect(calculateAge("1990-10-26", "2026-10-25")).toBe(35);
    expect(calculateAge("1990-10-25", "2026-10-25")).toBe(36);
    expect(getMaximumTerm({ birthDate: "1946-04-25", asOf: "2026-10-25" })).toBe(0);
    expect(getMaximumTerm({ birthDate: "1946-05-25", asOf: "2026-10-25" })).toBe(1);
    expect(
      getMaximumTerm({
        birthDate: "1990-01-01",
        asOf: "2026-10-25",
        product: "sbpe",
        system: "price",
      }),
    ).toBe(420);
    expect(
      getMaximumTerm({
        birthDate: "1960-01-01",
        asOf: "2026-10-25",
        inConstruction: true,
        constructionMonths: 24,
      }),
    ).toBe(141);
    const adjusted = success({
      birthDate: "1955-01-22",
      asOf: "2026-10-27",
      term: 420,
    });
    expect(adjusted).toMatchObject({ term: 105, maximumTerm: 105 });
    expect(adjusted.warnings.join(" ")).toContain(
      "Prazo ajustado automaticamente de 420 para 105 meses",
    );
  });
});
describe("CAIXA utilities with synthetic data", () => {
  it("rejects insurance above the cap, impossible subsidy, overflow and exact-age excess", () => {
    expect(calculateHousingSimulation({ ...base, nominalRate: 10.01 }).ok).toBe(false);
    expect(calculateHousingSimulation({ ...base, middleClass: true, nominalRate: 10.01 }).ok).toBe(
      false,
    );
    expect(calculateHousingSimulation({ ...base, city: "Salvador", state: "SP" }).ok).toBe(false);
    expect(calculateHousingSimulation({ ...base, approvedPayment: 50 }).ok).toBe(false);
    expect(
      calculateHousingSimulation({
        ...base,
        income: 3000,
        propertyValue: 210000,
        ownFunds: 20000,
        confirmedSubsidy: 150000,
      }).ok,
    ).toBe(false);
    expect(
      calculateHousingSimulation({
        ...base,
        product: "sbpe",
        nominalRate: 10,
        income: 1e308,
        propertyValue: 1e308,
      }).ok,
    ).toBe(false);
    expect(getMaximumTerm({ birthDate: "1946-05-01", asOf: "2026-10-25" })).toBe(1);
  });
  it("compares extra amortization against a zero-contribution baseline", () => {
    expect(
      calculateExtraAmortization({ balance: 1e308, annualRate: 12, remainingTerm: 420 }).ok,
    ).toBe(false);
    const result = calculateExtraAmortization({
      balance: 100000,
      annualRate: 12,
      remainingTerm: 120,
      contribution: 10000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shortenedTerm).toBeLessThan(120);
    expect(result.interestSavingByTerm).toBeGreaterThan(result.interestSavingByPayment);
    expect(
      calculateExtraAmortization({
        balance: 100000,
        annualRate: 0,
        remainingTerm: 100,
        contribution: 10000,
      }),
    ).toMatchObject({ ok: true, newPayment: 900, shortenedTerm: 90, interestSavingByTerm: 0 });
    expect(
      calculateExtraAmortization({
        balance: 100000,
        annualRate: 12,
        remainingTerm: 120,
        contribution: 0,
      }),
    ).toMatchObject({
      ok: true,
      shortenedTerm: 120,
      eliminatedMonths: 0,
      monthlyReduction: 0,
      interestSavingByTerm: 0,
    });
    expect(
      calculateExtraAmortization({
        balance: 100000,
        annualRate: 12,
        remainingTerm: 120,
        contribution: 100000,
      }),
    ).toMatchObject({ ok: true, newPayment: 0, shortenedTerm: 0 });
  });
  it("deduplicates overlapping jobs and rejects invalid/future periods", () => {
    const periods = [
      { start: "2024-01-01", end: "2026-01-01" },
      { start: "2024-01-01", end: "2026-01-01" },
    ];
    expect(calculateFgtsTime(periods, "2026-10-25")).toMatchObject({
      days: 731,
      overlap: true,
      eligible: false,
    });
    expect(
      calculateFgtsTime([{ start: "2020-01-01", end: "2030-01-01" }], "2026-10-25"),
    ).toMatchObject({ invalid: true, eligible: false });
    expect(calculateFgtsTime([{ start: "2023-02-30" }], "2026-10-25")).toMatchObject({
      invalid: true,
      eligible: false,
    });
    expect(calculateFgtsTime([{ start: "2020-01-01" }], "2026-10-25").eligible).toBe(true);
  });
  it("makes construction progress and TR an explicit scenario, with no hidden 2% cap", () => {
    expect(estimateConstructionInterest({ financing: 1e308, annualRate: 12, months: 420 }).ok).toBe(
      false,
    );
    const result = estimateConstructionInterest({
      financing: 200000,
      annualRate: 12,
      months: 12,
      currentProgress: 50,
      trAnnual: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.installments[0]).toMatchObject({ releasedBalance: 108333.33, interest: 1083.33 });
    expect(result.installments[0]!.correction).toBeCloseTo(
      Math.round(108333.33333333333 * (1.03 ** (1 / 12) - 1) * 100) / 100,
      2,
    );
    expect(result.lastPayment).toBeGreaterThan(result.firstPayment);
    expect(result.installments.at(-1)?.releasedBalance).toBe(200000);
    expect(estimateConstructionInterest({ financing: 200000, annualRate: 12, months: 0 }).ok).toBe(
      false,
    );
    expect(
      estimateConstructionInterest({
        financing: 200000,
        annualRate: 12,
        months: 12,
        currentProgress: 101,
      }).ok,
    ).toBe(false);
  });
});
