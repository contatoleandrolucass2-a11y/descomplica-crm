import { describe, expect, it } from "vitest";
import {
  calculateHousingSimulation,
  getHousingRate,
  getMaximumTerm,
  type HousingInput,
} from "@/lib/crm/simulators/caixa";
import { calculateCaixaPublicReference } from "@/lib/crm/simulators/caixa-public-reference";

const asOf = "2026-11-05";
const thresholds = [2160, 2850, 3200, 3500, 3700, 4000, 5000, 9600, 13000];

describe("CAIXA São Paulo: requested one-real boundaries", () => {
  it.each([
    ["1956-03-04", 118],
    ["1956-03-05", 118],
    ["1956-03-06", 119],
    ["1956-03-15", 119],
  ] as const)("uses completed age months for %s", (birthDate, expected) => {
    expect(getMaximumTerm({ birthDate, asOf })).toBe(expected);
    expect(getMaximumTerm({ birthDate, asOf, inConstruction: true, constructionMonths: 24 })).toBe(
      expected - 24,
    );
    expect(
      calculateCaixaPublicReference({ birthDate, asOf, income: 20000, propertyValue: 500000 })
        ?.term,
    ).toBe(expected);
  });

  it.each([
    [4999, 1138.01, 7.229],
    [5001, 1277.54, 8.4722],
  ] as const)(
    "matches the public UI observed on 05/11/2026 at income %s",
    (income, firstPayment, effectiveRate) => {
      const result = calculateCaixaPublicReference({
        birthDate: "1987-01-22",
        asOf,
        income,
        propertyValue: 210000,
      });
      expect(result).toMatchObject({
        financing: 168000,
        term: 420,
        firstPayment,
        system: "price",
        subsidyCalculated: false,
      });
      expect(result?.effectiveRate).toBeCloseTo(effectiveRate, 8);
    },
  );

  it("matches the observed older applicant without conflating the public calculator with the commercial profile", () => {
    expect(
      calculateCaixaPublicReference({
        birthDate: "1956-03-15",
        asOf,
        income: 20000,
        propertyValue: 500000,
      }),
    ).toMatchObject({
      term: 119,
      financing: 286573.66,
      entry: 213426.34,
      firstPayment: 6000,
      system: "sac",
    });
  });

  it("matches the São Paulo nominal rate table immediately below and above each income threshold", () => {
    const limits = [2160, 2850, 3200, 3500, 4000, 5000, 9600, 13000];
    const rates = [4.25, 4.5, 4.75, 5, 5.5, 6.5, 7.66, 10];
    for (let i = 0; i < limits.length; i++) {
      expect(getHousingRate({ income: limits[i]! - 1, state: "SP", hasFgts36: true })).toBe(
        rates[i],
      );
      expect(getHousingRate({ income: limits[i]!, state: "SP", hasFgts36: true })).toBe(rates[i]);
      if (i < limits.length - 1)
        expect(getHousingRate({ income: limits[i]! + 1, state: "SP", hasFgts36: true })).toBe(
          rates[i + 1],
        );
    }
  });

  it("checks 326592 combinations without claiming official subsidy equivalence", () => {
    let scenarios = 0,
      valid = 0,
      rejected = 0;
    const failures: string[] = [];
    const births = ["2008-11-05", "1987-01-22", "1976-11-06", "1956-03-15", "1946-06-05"];
    for (const income of thresholds.flatMap((x) => [x - 1, x, x + 1]))
      for (const propertyValue of [275000, 400000, 600000].flatMap((x) => [x - 1, x, x + 1]))
        for (let propertyArea = 15; propertyArea <= 70; propertyArea++)
          for (let people = 1; people <= 3; people++)
            for (const dependents of [false, true])
              for (const hasFgts36 of [false, true])
                for (const system of ["price", "sac"] as const) {
                  const birthDate = births[scenarios % births.length]!;
                  scenarios++;
                  const input: HousingInput = {
                    income,
                    propertyValue,
                    birthDate,
                    asOf,
                    state: "SP",
                    city: "São Paulo",
                    term: 420,
                    product: "mcmv",
                    system,
                    propertyType: "apartment",
                    propertyArea,
                    singlePersonFamily: people === 1 && !dependents,
                    hasFgts36,
                    inConstruction: true,
                    propertyCondition: "new",
                    ownFunds: 0,
                    officialQuickEstimate: true,
                  };
                  const result = calculateHousingSimulation(input);
                  if (!result.ok) {
                    rejected++;
                    continue;
                  }
                  valid++;
                  const check = (ok: boolean, reason: string) => {
                    if (!ok && failures.length < 20)
                      failures.push(
                        `${income}/${propertyValue}/${birthDate}/${propertyArea}/${people}/${dependents}/${system}: ${reason}`,
                      );
                  };
                  check(
                    [
                      result.financing,
                      result.subsidy,
                      result.firstPayment,
                      result.entryNeeded,
                    ].every(Number.isFinite),
                    "nonfinite money",
                  );
                  check(
                    result.financing >= 0 && result.subsidy >= 0 && result.subsidy <= 55000,
                    "negative or excess money",
                  );
                  check(
                    result.financing <= result.quotaFinancing + 0.001 &&
                      result.financing <= result.maximumFinancingByIncome + 0.001,
                    "quota/income overflow",
                  );
                  check(
                    result.firstPayment <= result.maximumPaymentByIncome + 0.011,
                    "payment overflow",
                  );
                  check(
                    result.term > 0 && result.term <= 420 && result.term <= getMaximumTerm(input),
                    "invalid term",
                  );
                  check(
                    Math.abs(
                      result.financing + result.subsidy + result.entryNeeded - propertyValue,
                    ) < 0.011,
                    "composition mismatch",
                  );
                }
    expect(scenarios).toBe(326592);
    expect(valid).toBe(279552);
    expect(rejected).toBe(47040);
    expect(failures).toEqual([]);
  }, 180000);
});
