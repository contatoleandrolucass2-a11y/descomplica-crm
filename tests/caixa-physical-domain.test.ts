import { describe, expect, it } from "vitest";
import { calculateHousingSimulation, type HousingInput } from "@/lib/crm/simulators/caixa";

const thresholds = [2160, 2850, 3200, 3500, 4000, 5000, 9600, 13000];
const incomes = thresholds.flatMap((value) => [value - 0.01, value, value + 0.01]);
const base: HousingInput = {
  income: 4000,
  propertyValue: 275000,
  birthDate: "1991-11-04",
  asOf: "2026-11-04",
  city: "São Paulo",
  state: "SP",
  product: "mcmv",
  system: "price",
  term: 420,
  hasFgts36: true,
  inConstruction: true,
  propertyCondition: "new",
  propertyType: "apartment",
  propertyArea: 39,
  singlePersonFamily: false,
  ownFunds: 0,
  officialQuickEstimate: true,
};

describe("CAIXA requested physical domain and financial boundaries", () => {
  it.each([
    ["apartment", 39, 59],
    ["house", 46, 66],
  ] as const)(
    "checks decimal area boundaries and saturation for %s",
    (propertyType, minimum, maximum) => {
      const results = [
        15,
        minimum - 0.01,
        minimum,
        minimum + 0.01,
        maximum - 0.01,
        maximum,
        maximum + 0.01,
        70,
      ].map((propertyArea) => calculateHousingSimulation({ ...base, propertyType, propertyArea }));
      expect(results.every((result) => result.ok)).toBe(true);
      const values = results.map((result) => (result.ok ? result.subsidy : -1));
      expect(values[0]).toBe(values[2]);
      expect(values[5]).toBe(values[6]);
      expect(values[5]).toBe(values[7]);
      for (let index = 1; index < values.length; index++)
        expect(values[index]).toBeGreaterThanOrEqual(values[index - 1]!);
    },
  );
  it("checks 1–3 people, every integer area 15–70m², ages18–80 and both social-factor states at all income boundaries", () => {
    let scenarios = 0,
      calculated = 0,
      refused = 0;
    const failures: string[] = [];
    for (const income of incomes)
      for (let age = 18; age <= 80; age++)
        for (let people = 1; people <= 3; people++) {
          let previousSubsidy = -1;
          for (let area = 15; area <= 70; area++) {
            const input = {
              ...base,
              income,
              birthDate: `${2026 - age}-11-04`,
              propertyArea: area,
              singlePersonFamily: people === 1,
            };
            const plain = calculateHousingSimulation({ ...input, socialFactor: false });
            const social = calculateHousingSimulation({ ...input, socialFactor: true });
            scenarios += 2;
            const tag = `${income}/${age}/${people}/${area}`;
            const record = (ok: boolean, message: string) => {
              if (!ok && failures.length < 12) failures.push(`${tag}: ${message}`);
            };
            record(plain.ok === social.ok, "informational social flag changes eligibility");
            if (!plain.ok || !social.ok) {
              refused += 2;
              record(!plain.ok && plain.errors.length > 0, "failure without explanation");
              if (income > 13000) record(!plain.ok, "income above MCMV accepted");
              continue;
            }
            calculated += 2;
            record(
              plain.financing === social.financing &&
                plain.subsidy === social.subsidy &&
                plain.rate === social.rate,
              "informational social flag changes money/rate",
            );
            record(
              [
                plain.financing,
                plain.subsidy,
                plain.firstPayment,
                plain.entryNeeded,
                plain.insurance,
              ].every(Number.isFinite),
              "nonfinite result",
            );
            record(
              plain.financing >= 0 && plain.subsidy >= 0 && plain.entryNeeded >= 0,
              "negative money",
            );
            record(
              plain.financing <= plain.quotaFinancing + 0.001 &&
                plain.financing <= plain.maximumFinancingByIncome + 0.001,
              "financing exceeds a quota/capacity",
            );
            record(
              plain.firstPayment <= plain.maximumPaymentByIncome + 0.011,
              "payment exceeds income ceiling",
            );
            record(
              plain.term <= plain.maximumTerm && plain.term > 0 && plain.term <= 420,
              "term beyond age/program",
            );
            record(
              Math.abs(plain.financing + plain.subsidy + plain.entryNeeded - plain.propertyValue) <
                0.011,
              "composition does not reconcile",
            );
            record(income <= 4000 || plain.subsidy === 0, "subsidy outside income eligibility");
            record(
              plain.subsidy + 0.001 >= previousSubsidy,
              "larger eligible area reduces subsidy",
            );
            previousSubsidy = plain.subsidy;
          }
        }
    expect(scenarios).toBe(508032);
    expect(calculated).toBeGreaterThan(400000);
    expect(refused).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  }, 180000);

  it("exercises configured nominal rates, zero rate and invalid interest without substituting a public-reference offer", () => {
    for (const nominalRate of [
      0, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 6, 6.5, 7, 7.66, 8.16, 10, 11.49, 13.4,
    ]) {
      for (const system of ["price", "sac"] as const) {
        const result = calculateHousingSimulation({
          ...base,
          income: 15000,
          product: "sbpe",
          nominalRate,
          system,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(result.rate).toBe(nominalRate);
        expect(result.firstPayment).toBeLessThanOrEqual(4500.01);
        expect(result.financingQuota).toBe(system === "sac" ? 0.9 : 0.8);
        expect(result.subsidy).toBe(0);
      }
    }
    for (const nominalRate of [-0.01, NaN, Infinity, 100.01])
      expect(calculateHousingSimulation({ ...base, nominalRate }).ok).toBe(false);
  });
});
