import { describe, expect, it } from "vitest";
import { calculateMcmvSubsidy } from "@/lib/crm/simulators/caixa";

// Independently observed in the authenticated full CAIXA simulator on 2026-11-05.
// São Paulo/SP; new property 275000; birth 1987-01-22; FGTS >= 3 years;
// multiple buyers and/or dependents; no prior subsidy; FGTS-linked development.
// That UI does not ask area. Area32 supplies FUH=0 in our MFOM contract; these
// fixtures do not establish official equivalence for larger areas or insurance.
const profile = {
  propertyValue: 275000,
  city: "São Paulo",
  state: "SP",
  propertyType: "apartment" as const,
  propertyArea: 32,
  propertyCondition: "new" as const,
  inConstruction: true,
  singlePersonFamily: false,
  nominalRate: 5.5,
};

describe("CAIXA full simulator: observed São Paulo subsidy", () => {
  it.each([
    [3700, 2164],
    [3750, 2153],
    [3900, 2119],
    [3999, 2099],
    [4000, 2099],
  ])("reproduces the observed subsidy at income %s", (income, amount) => {
    expect(calculateMcmvSubsidy({ ...profile, income })).toMatchObject({
      amount,
      incomeFactor: 1900,
    });
  });

  it.each([
    [3200, 4.75, 1764],
    [3250, 5, 1564],
    [3265, 5, 1502],
    [3266, 5, 0],
    [3300, 5, 0],
    [4000, 5.5, 0],
  ])("reproduces the observed unipersonal subsidy at income %s", (income, nominalRate, amount) => {
    expect(
      calculateMcmvSubsidy({ ...profile, income, nominalRate, singlePersonFamily: true })?.amount,
    ).toBe(amount);
  });

  it("caps only the income factor and retains actual income in financing capacity", () => {
    const lower = calculateMcmvSubsidy({ ...profile, income: 3700 })!;
    const upper = calculateMcmvSubsidy({ ...profile, income: 3900 })!;
    expect(lower.incomeFactor).toBe(upper.incomeFactor);
    expect(upper.financingFactor).toBeLessThan(lower.financingFactor);
    expect(upper.amount).toBeLessThan(lower.amount);
  });

  it("does not extrapolate the income parabola upwards after its minimum", () => {
    for (const income of [3699, 3700, 3701, 3999, 4000]) {
      const value = calculateMcmvSubsidy({ ...profile, income })!;
      expect(value.amount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(value.amount)).toBe(true);
      if (income >= 3700) expect(value.incomeFactor).toBe(1900);
    }
    expect(calculateMcmvSubsidy({ ...profile, income: 4001 })).toBeNull();
  });

  it("preserves the MFOM area factor without calling larger areas official fixtures", () => {
    const small = calculateMcmvSubsidy({ ...profile, income: 4000, propertyArea: 15 })!;
    const start = calculateMcmvSubsidy({ ...profile, income: 4000, propertyArea: 39 })!;
    const end = calculateMcmvSubsidy({ ...profile, income: 4000, propertyArea: 59 })!;
    const large = calculateMcmvSubsidy({ ...profile, income: 4000, propertyArea: 70 })!;
    expect(small.amount).toBe(start.amount);
    expect(end.amount).toBe(large.amount);
    expect(end.housingFactor).toBe(10);
    expect(end.amount).toBeGreaterThan(start.amount);
  });
});
