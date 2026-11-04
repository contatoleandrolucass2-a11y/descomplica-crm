import { describe, expect, it } from "vitest";
import { calculateCaixaPublicReference } from "@/lib/crm/simulators/caixa-public-reference";

describe("independent official CAIXA quick reference", () => {
  it.each([
    ["1987-01-22", 4000, 210000, 168000, 420],
    ["1987-01-22", 4000, 210000.01, 157599.38, 420],
    ["1991-03-15", 3000, 210000, 161859.07, 420],
    ["1956-03-15", 20000, 500000, 286573.66, 119],
  ])(
    "matches official boundary case %s / %s / %s",
    (birthDate, income, propertyValue, financing, term) => {
      expect(
        calculateCaixaPublicReference({ birthDate, income, propertyValue, asOf: "2026-11-04" }),
      ).toMatchObject({ financing, term });
    },
  );
  it("matches the public UI observed on 2026-11-04, without mixing profile discounts or subsidy", () => {
    expect(
      calculateCaixaPublicReference({
        income: 4000,
        propertyValue: 275000,
        birthDate: "1987-01-22",
        asOf: "2026-11-04",
      }),
    ).toMatchObject({
      financing: 157599.38,
      entry: 117400.62,
      firstPayment: 1200,
      term: 420,
      system: "price",
      effectiveRate: 8.4722,
      subsidyCalculated: false,
    });
    expect(
      calculateCaixaPublicReference({
        income: 6000,
        propertyValue: 300000,
        birthDate: "1991-03-15",
        asOf: "2026-11-04",
      }),
    ).toMatchObject({
      financing: 239295.3,
      entry: 60704.7,
      firstPayment: 1800,
      term: 420,
      system: "price",
    });
  });
  it("uses both public table boundaries, not municipal limits", () => {
    const input = { income: 4000, birthDate: "1991-03-15", asOf: "2026-11-04" };
    expect(calculateCaixaPublicReference({ ...input, propertyValue: 210000 })?.effectiveRate).toBe(
      6.1678,
    );
    expect(
      calculateCaixaPublicReference({ ...input, propertyValue: 210000.01 })?.effectiveRate,
    ).toBe(8.4722);
    expect(calculateCaixaPublicReference({ ...input, propertyValue: 600000.01 })?.system).toBe(
      "sac",
    );
  });
  it("rejects invalid dates, impossible ages and unsafe values instead of showing a stale result", () => {
    const input = {
      income: 4000,
      propertyValue: 275000,
      birthDate: "1991-03-15",
      asOf: "2026-11-04",
    };
    for (const patch of [
      { birthDate: "1991-02-31" },
      { birthDate: "2010-01-01" },
      { birthDate: "1900-01-01" },
      { income: NaN },
      { propertyValue: -1 },
    ])
      expect(calculateCaixaPublicReference({ ...input, ...patch })).toBeNull();
  });
});
