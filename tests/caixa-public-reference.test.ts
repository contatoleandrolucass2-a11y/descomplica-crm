import { describe, expect, it } from "vitest";
import { calculateCaixaPublicReference } from "@/lib/crm/simulators/caixa-public-reference";

describe("independent official CAIXA quick reference", () => {
  // Captured from the live public UI by fill/click/read on 2026-11-05,
  // not produced by calculateCaixaPublicReference. The UI does not quote subsidy.
  it.each([
    [2159, 210000, 121500.67, 647.7, 4.85],
    [2161, 210000, 117973.66, 648.3, 5.12],
    [2849, 210000, 157039.53, 854.7, 5.12],
    [2851, 210000, 152518.29, 855.3, 5.38],
    [3199, 210000, 168000, 939.58, 5.38],
    [3201, 210000, 166819.12, 960.3, 5.64],
    [3499, 210000, 168000, 966.92, 5.64],
    [3501, 210000, 168000, 1022.65, 6.17],
    [3999, 210000, 168000, 1022.65, 6.17],
    [4001, 210000, 168000, 1138.01, 7.23],
    [4999, 210000, 168000, 1138.01, 7.23],
    [5001, 210000, 168000, 1277.54, 8.47],
    [9599, 210000, 168000, 1277.54, 8.47],
    [9601, 210000, 168000, 1508.83, 10.47],
    [12999, 210000, 168000, 1508.83, 10.47],
    [13001, 210000, 168000, 1994.36, 11.49],
    [4000, 209999, 167999.2, 1022.65, 6.17],
    [4000, 210001, 157599.38, 1200, 8.47],
    [4000, 274999, 157599.38, 1200, 8.47],
    [4000, 275001, 157599.38, 1200, 8.47],
    [4000, 399999, 157599.38, 1200, 8.47],
    [4000, 400001, 133034.26, 1200, 10.47],
    [4000, 599999, 133034.26, 1200, 10.47],
    [4000, 600001, 100235.63, 1200, 11.49],
  ])(
    "reproduces the observed one-real boundary %s / %s",
    (income, propertyValue, financing, firstPayment, displayedRate) => {
      const result = calculateCaixaPublicReference({
        birthDate: "1987-01-22",
        asOf: "2026-11-05",
        income,
        propertyValue,
      });
      expect(result).toMatchObject({
        financing,
        firstPayment,
        term: 420,
        subsidyCalculated: false,
      });
      expect(Number(result!.effectiveRate.toFixed(2))).toBe(displayedRate);
    },
  );
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
