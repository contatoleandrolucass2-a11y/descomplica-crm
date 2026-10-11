import { describe, expect, it } from "vitest";
import {
  calculateDocumentation,
  type DocumentationInput,
  type DocumentationLegalContext,
  type DocumentationResult,
} from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import { documentationInput, documentationLegalContext } from "./fixtures/documentation-input";

function accepted(input: DocumentationInput) {
  const result = calculateDocumentation(input);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.errors.join("; "));
  expect(result.audit.every(({ ok }) => ok)).toBe(true);
  expect(result.registrationCombined).toBe(false);
  return result;
}

function rejected(result: DocumentationResult, error?: RegExp) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Incomplete legal context produced a payable estimate");
  expect(result.errors.length).toBeGreaterThan(0);
  if (error) expect(result.errors.join("; ")).toMatch(error);
  expect(result).not.toHaveProperty("totalCash");
  expect(result).not.toHaveProperty("itbi");
  expect(result).not.toHaveProperty("totalRegistration");
}

// Golden values: Prefeitura ITBI 2513/2517 and ARISP Tabela II/2026, ISS 2%.
// https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513
// https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2517
// https://arisp.com.br/wp-content/uploads/2026/01/2.pdf
describe("SP/2026 legal context must be complete before calculation", () => {
  it("rejects legacy input without legal declarations", () => {
    const input = documentationInput();
    delete input.legalContext;
    rejected(calculateDocumentation(input));
  });

  const requiredFields = [
    "municipality",
    "transactionDate",
    "financingContractDate",
    "registrationDate",
    "registryTable",
    "specialRegime",
    "naturalPerson",
    "residential",
    "firstAcquisition",
    "program",
    "financingSystem",
    "funding",
    "itbiBase",
    "iptuValue",
    "basesConfirmed",
  ] as const;
  it.each(requiredFields)("rejects omitted %s without inferring a default", (field) => {
    const context: Partial<DocumentationLegalContext> = documentationLegalContext();
    delete context[field];
    rejected(
      calculateDocumentation(
        documentationInput({
          legalContext: context as DocumentationLegalContext,
        }),
      ),
    );
  });

  it.each([
    { municipality: "" },
    { municipality: "other" },
    { naturalPerson: "" },
    { residential: "" },
    { firstAcquisition: "" },
    { program: "" },
    { financingSystem: "" },
    { funding: "" },
    { specialRegime: "" },
    { registryTable: "" },
    { basesConfirmed: false },
  ] satisfies Partial<DocumentationLegalContext>[])(
    "rejects unanswered declaration %j",
    (context) => {
      rejected(calculateDocumentation(documentationInput({}, context)));
    },
  );

  it.each(["", "   ", "invalid", -0.01, Number.NaN, Number.POSITIVE_INFINITY, 123.456])(
    "rejects invalid monetary base %s for both ITBI and IPTU",
    (value) => {
      rejected(calculateDocumentation(documentationInput({}, { itbiBase: value })), /ITBI/);
      rejected(calculateDocumentation(documentationInput({}, { iptuValue: value })), /IPTU/);
    },
  );

  it("requires positive ITBI but accepts explicitly declared zero IPTU", () => {
    rejected(calculateDocumentation(documentationInput({}, { itbiBase: 0 })), /ITBI/);
    expect(accepted(documentationInput({}, { iptuValue: 0 })).itbi).toBe(0);
    expect(accepted(documentationInput({}, { iptuValue: "0,00" })).itbi).toBe(0);
    expect(accepted(documentationInput({}, { itbiBase: "R$ 240.000,00" })).itbi).toBe(0);
  });

  it("requires first transfer only when the loan funding is FGTS", () => {
    const context: Partial<DocumentationLegalContext> = documentationLegalContext();
    delete context.firstTransfer;
    accepted(documentationInput({ legalContext: context as DocumentationLegalContext }));
    rejected(calculateDocumentation(documentationInput({}, { funding: "FGTS" })), /primeira venda/);
    accepted(documentationInput({}, { funding: "FGTS", firstTransfer: "NAO" }));
    accepted(documentationInput({}, { funding: "FGTS", firstTransfer: "SIM" }));
  });

  it.each([
    { naturalPerson: "NAO" },
    { residential: "NAO" },
    { financingSystem: "SFI" },
    { program: "MCMV_FAR_FDS", funding: "FGTS", firstTransfer: "SIM" },
  ] satisfies Partial<DocumentationLegalContext>[])(
    "blocks contradictory MCMV declarations %j",
    (context) => {
      rejected(calculateDocumentation(documentationInput({}, context)), /MCMV|FAR\/FDS/);
    },
  );

  it("blocks special regimes until their individual benefits are reviewed", () => {
    rejected(
      calculateDocumentation(documentationInput({}, { specialRegime: "OTHER" })),
      /FMH.*COHAB.*CDHU.*ZEIS/,
    );
  });

  it("blocks an unverified registry table instead of assuming ARISP for the city", () => {
    rejected(calculateDocumentation(documentationInput({}, { registryTable: "OTHER" })), /tabela/i);
  });
});

describe("SP/2026 effective dates and municipality", () => {
  it.each([
    ["2026-01-01", "2026-01-08"],
    ["2026-12-31", "2026-12-31"],
  ])(
    "accepts transmission %s and registration %s at inclusive boundaries",
    (transactionDate, registrationDate) => {
      accepted(
        documentationInput(
          {},
          { transactionDate, financingContractDate: transactionDate, registrationDate },
        ),
      );
    },
  );

  it.each(["2025-12-31", "2027-01-01", "2026-02-29", "2026-04-31", "", "not-a-date"])(
    "blocks invalid or unvalidated transmission date %s",
    (transactionDate) => {
      rejected(calculateDocumentation(documentationInput({}, { transactionDate })), /ITBI/);
    },
  );

  it.each(["2026-01-07", "2025-12-31", "2027-01-01", "2026-02-29", "2026-04-31", ""])(
    "blocks invalid or unvalidated registration date %s",
    (registrationDate) => {
      rejected(
        calculateDocumentation(
          documentationInput(
            {},
            {
              transactionDate: "2026-01-01",
              financingContractDate: "2026-01-01",
              registrationDate,
            },
          ),
        ),
        /Registro/,
      );
    },
  );

  it("rejects registration before transmission even within the valid year", () => {
    rejected(
      calculateDocumentation(
        documentationInput(
          {},
          {
            transactionDate: "2026-10-10",
            registrationDate: "2026-10-09",
          },
        ),
      ),
      /anterior/,
    );
  });

  it.each(["2025-12-31", "2027-01-01", "2026-02-29", "2026-04-31", "", "not-a-date"])(
    "blocks invalid or unvalidated financing contract date %s independently",
    (financingContractDate) => {
      rejected(
        calculateDocumentation(documentationInput({}, { financingContractDate })),
        /contrato de financiamento/,
      );
    },
  );

  it("accepts contract on or before transmission and rejects one day after it", () => {
    accepted(documentationInput({}, { financingContractDate: "2026-10-01" }));
    accepted(documentationInput({}, { financingContractDate: "2026-10-02" }));
    rejected(
      calculateDocumentation(
        documentationInput(
          {},
          {
            financingContractDate: "2026-10-03",
          },
        ),
      ),
      /posterior.*transmissão/,
    );
  });

  it("keeps the commercial base date separate from legal validity", () => {
    accepted(documentationInput({ baseDate: "2027-01-01" }));
    rejected(calculateDocumentation(documentationInput({}, { transactionDate: "2027-01-01" })));
  });
});

describe("SP/2026 ITBI eligibility and thresholds", () => {
  it.each([
    { program: "NONE", firstAcquisition: "SIM" },
    { program: "MCMV", firstAcquisition: "NAO" },
    { program: "MCMV_FAR_FDS", firstAcquisition: "NAO" },
  ] satisfies Partial<DocumentationLegalContext>[])(
    "exempts first acquisition OR MCMV: %j",
    (context) => {
      expect(
        accepted(documentationInput({ firstProperty: "NAO", modality: "SBPE" }, context)).itbi,
      ).toBe(0);
    },
  );

  it.each([
    { firstAcquisition: "NAO" },
    { naturalPerson: "NAO" },
    { residential: "NAO" },
  ] satisfies Partial<DocumentationLegalContext>[])(
    "denies exemption when a legal condition is absent: %j",
    (context) => {
      expect(accepted(documentationInput({}, { program: "NONE", ...context })).itbi).toBe(4175.8);
    },
  );

  it.each([
    [245527.76, 0],
    [245527.77, 0],
    [245527.78, 4341.63],
  ])("applies the exemption threshold at property/base %s", (value, itbi) => {
    expect(accepted(documentationInput({ salePrice: value }, { itbiBase: value })).itbi).toBe(itbi);
  });

  it("does not exempt a cheap sale with a higher confirmed ITBI base", () => {
    expect(accepted(documentationInput({}, { itbiBase: 245527.78 })).itbi).toBe(4341.63);
  });

  it.each([239999.99, 230000])(
    "blocks an ITBI base below sale price without a reviewed exception: %s",
    (itbiBase) => {
      rejected(calculateDocumentation(documentationInput({}, { itbiBase })), /ITBI/);
    },
  );

  it.each(["SFH", "PAR", "HIS", "CONSORCIO"] as const)(
    "applies the reduced financed bracket to %s",
    (financingSystem) => {
      expect(
        accepted(
          documentationInput(
            {},
            {
              program: "NONE",
              firstAcquisition: "NAO",
              financingSystem,
            },
          ),
        ).itbi,
      ).toBe(4175.8);
    },
  );

  it("charges 3% on SFI without importing the commercial MCMV choice", () => {
    expect(
      accepted(
        documentationInput(
          {},
          {
            program: "NONE",
            firstAcquisition: "NAO",
            financingSystem: "SFI",
          },
        ),
      ).itbi,
    ).toBe(7200);
  });

  it.each([
    [100000, 4700],
    [120967.99, 4175.8],
    [120968, 4175.8],
    [120968.01, 4175.8],
    [200000, 4175.8],
  ])("caps the reduced financed base for financing %s", (financing, itbi) => {
    expect(
      accepted(
        documentationInput(
          { financing },
          {
            program: "NONE",
            firstAcquisition: "NAO",
          },
        ),
      ).itbi,
    ).toBe(itbi);
  });

  it.each([
    [725807.99, 18750.04],
    [725808, 18750.04],
    [725808.01, 21774.24],
  ])("applies the reduced-property ceiling at %s without rounding eligibility", (value, itbi) => {
    expect(
      accepted(
        documentationInput(
          {
            salePrice: value,
            appraisalValue: 1000000,
            modality: "SBPE",
          },
          { program: "NONE", firstAcquisition: "NAO", itbiBase: value },
        ),
      ).itbi,
    ).toBe(itbi);
  });

  it("uses the confirmed tax base rather than bank appraisal", () => {
    expect(
      accepted(
        documentationInput(
          { appraisalValue: 900000 },
          {
            itbiBase: 300000,
            program: "NONE",
            firstAcquisition: "NAO",
          },
        ),
      ).itbi,
    ).toBe(5975.8);
  });
});

describe("SP/2026 registration bases, discount precedence and pending regimes", () => {
  it.each([
    [2306, 260.39],
    [180000, 1924.63],
    [240000, 2548.04],
  ])("uses the confirmed 5th registry published total for %s", (salePrice, fee) => {
    expect(
      accepted(
        documentationInput(
          { salePrice, appraisalValue: salePrice * 2, financing: 1, modality: "SBPE" },
          {
            registryTable: "QUINTO_SP_2026",
            itbiBase: salePrice,
            program: "NONE",
            firstAcquisition: "NAO",
          },
        ),
      ),
    ).toMatchObject({ purchaseRegistration: fee, lienRegistration: 260.39 });
  });

  it("keeps exact MCMV cent values distinct between confirmed registry publications", () => {
    const arisp = accepted(documentationInput({ financing: 180000 }));
    const quinto = accepted(
      documentationInput({ financing: 180000 }, { registryTable: "QUINTO_SP_2026" }),
    );
    expect(arisp).toMatchObject({
      purchaseRegistration: 1273.71,
      lienRegistration: 962.08,
      totalRegistration: 2235.79,
      totalCash: 3535.79,
    });
    expect(quinto).toMatchObject({
      purchaseRegistration: 1274.02,
      lienRegistration: 962.32,
      totalRegistration: 2236.34,
      totalCash: 3536.34,
    });
    expect(
      Math.round(quinto.totalRegistration * 100) - Math.round(arisp.totalRegistration * 100),
    ).toBe(55);
    rejected(calculateDocumentation(documentationInput({}, { registryTable: "OTHER" })));
    expect(accepted(documentationInput({ financing: 180000 }))).toEqual(arisp);
  });

  it.each([
    [2306, 260.32],
    [2306.01, 417.73],
    [192100, 1924.16],
    [192100.01, 2339.94],
    [230520, 2339.94],
    [230520.01, 2547.41],
    [268940, 2547.41],
    [268940.01, 2756.07],
    [384200, 2981.18],
    [384200.01, 3324.04],
    [142154000, 221195.52],
    [142154000.01, 234080.84],
  ])("uses the published registration bracket for %s", (salePrice, purchaseRegistration) => {
    expect(
      accepted(
        documentationInput(
          {
            salePrice,
            appraisalValue: salePrice * 2,
            financing: 1,
            modality: "SBPE",
          },
          { itbiBase: salePrice, program: "NONE", firstAcquisition: "NAO" },
        ),
      ),
    ).toMatchObject({
      purchaseRegistration,
      lienRegistration: 260.32,
      registrationCombined: false,
    });
  });

  it.each([
    [300000, 300000, 0, 2756.07],
    [240000, 310000, 0, 2905.45],
    [240000, 240000, 350000, 2981.18],
  ])(
    "uses max(sale=%s, ITBI=%s, IPTU=%s), with a separate lien base",
    (salePrice, itbiBase, iptuValue, fee) => {
      expect(
        accepted(
          documentationInput(
            { salePrice, appraisalValue: 900000 },
            {
              itbiBase,
              iptuValue,
              program: "NONE",
              firstAcquisition: "NAO",
            },
          ),
        ),
      ).toMatchObject({ purchaseRegistration: fee, lienRegistration: 1924.16 });
    },
  );

  it.each([
    { program: "MCMV", funding: "OTHER", firstTransfer: "" },
    { program: "NONE", funding: "FGTS", firstTransfer: "NAO" },
    { program: "MCMV", funding: "FGTS", firstTransfer: "SIM" },
  ] satisfies Partial<DocumentationLegalContext>[])(
    "applies one 50% reduction to both acts for %j",
    (context) => {
      expect(accepted(documentationInput({}, context))).toMatchObject({
        purchaseRegistration: 1273.71,
        lienRegistration: 962.08,
        totalRegistration: 2235.79,
        registrationCombined: false,
      });
    },
  );

  it("charges 25% for FAR/FDS without accumulating the SFH discount", () => {
    expect(accepted(documentationInput({}, { program: "MCMV_FAR_FDS" }))).toMatchObject({
      purchaseRegistration: 636.85,
      lienRegistration: 481.04,
      totalRegistration: 1117.89,
      registrationCombined: false,
    });
  });

  it.each([230519.99, 230520])(
    "gives MCMV precedence over the FGTS table reference at %s",
    (salePrice) => {
      expect(
        accepted(
          documentationInput(
            { salePrice },
            {
              itbiBase: salePrice,
              funding: "FGTS",
              firstTransfer: "SIM",
            },
          ),
        ),
      ).toMatchObject({
        registrationCombined: false,
        purchaseRegistration: 1169.97,
        lienRegistration: 962.08,
        totalRegistration: 2132.05,
        totalCash: 3432.05,
      });
    },
  );

  it.each([230519.99, 230520])(
    "blocks pending FGTS first transfers outside MCMV at %s",
    (salePrice) => {
      rejected(
        calculateDocumentation(
          documentationInput(
            { salePrice },
            {
              itbiBase: salePrice,
              program: "NONE",
              funding: "FGTS",
              firstTransfer: "SIM",
            },
          ),
        ),
        /FGTS/,
      );
    },
  );

  it.each([
    { itbiBase: 230520.01 },
    { iptuValue: 230520.01 },
    { firstTransfer: "NAO" },
  ] satisfies Partial<DocumentationLegalContext>[])(
    "uses ordinary FGTS 50% only outside the pending first-transfer bracket: %j",
    (context) => {
      const result = accepted(
        documentationInput(
          { salePrice: 230520 },
          {
            itbiBase: 230520,
            program: "NONE",
            funding: "FGTS",
            firstTransfer: "SIM",
            ...context,
          },
        ),
      );
      expect(result.registrationCombined).toBe(false);
      expect(result.lienRegistration).toBe(962.08);
      expect(result.totalRegistration).toBe(context.firstTransfer === "NAO" ? 2132.05 : 2235.79);
    },
  );

  it("keeps the MCMV benefit independent from the first buyer acquisition", () => {
    expect(
      accepted(
        documentationInput(
          { salePrice: 230520, firstProperty: "NAO" },
          {
            itbiBase: 230520,
            firstAcquisition: "NAO",
            funding: "FGTS",
            firstTransfer: "SIM",
          },
        ),
      ),
    ).toMatchObject({ registrationCombined: false, totalRegistration: 2132.05 });
  });

  it("also blocks pending FGTS first transfer for a buyer with prior acquisitions", () => {
    rejected(
      calculateDocumentation(
        documentationInput(
          { salePrice: 230520, firstProperty: "NAO" },
          {
            itbiBase: 230520,
            firstAcquisition: "NAO",
            program: "NONE",
            funding: "FGTS",
            firstTransfer: "SIM",
          },
        ),
      ),
      /FGTS/,
    );
  });

  it("preserves FAR/FDS precedence below the FGTS reference limit", () => {
    expect(
      accepted(
        documentationInput(
          { salePrice: 230520 },
          {
            itbiBase: 230520,
            program: "MCMV_FAR_FDS",
          },
        ),
      ),
    ).toMatchObject({
      registrationCombined: false,
      purchaseRegistration: 584.99,
      lienRegistration: 481.04,
      totalRegistration: 1066.03,
    });
  });

  it.each([{ itbiBase: 240000.01 }, { iptuValue: 240000.01 }])(
    "blocks proportional SFH when the registration base exceeds sale price: %j",
    (context) => {
      rejected(
        calculateDocumentation(
          documentationInput(
            {},
            {
              program: "NONE",
              funding: "OTHER",
              ...context,
            },
          ),
        ),
        /SFH/,
      );
    },
  );

  it("applies the first-acquisition SFH reduction only to the financed purchase proportion", () => {
    const sfh = accepted(documentationInput({}, { program: "NONE" }));
    expect(sfh).toMatchObject({
      purchaseRegistration: 1528.45,
      lienRegistration: 962.08,
      totalRegistration: 2490.53,
    });
    expect(sfh.registrationRule).toContain("Proporção = financiamento / preço");
    expect(sfh.registrationRule).toContain("estimativa arredondada ao centavo no fim de cada ato");
    expect(sfh.registrationRule).toContain("Confirme o critério de arredondamento do cartório");
    expect(
      accepted(documentationInput({}, { program: "NONE", financingSystem: "SFI" })),
    ).toMatchObject({
      purchaseRegistration: 2547.41,
      lienRegistration: 1924.16,
      totalRegistration: 4471.57,
    });
  });
});

describe("legal policy transitions and evidence", () => {
  it("does not reuse benefits or totals after a valid-invalid-valid transition", () => {
    const input = documentationInput();
    const original = structuredClone(input);
    const first = accepted(input);
    const withoutLegalContext = { ...input };
    delete withoutLegalContext.legalContext;
    rejected(calculateDocumentation(withoutLegalContext));
    rejected(calculateDocumentation(documentationInput({}, { municipality: "other" })));
    const sfi = accepted(
      documentationInput(
        {},
        {
          program: "NONE",
          firstAcquisition: "NAO",
          financingSystem: "SFI",
        },
      ),
    );
    expect(sfi).toMatchObject({ itbi: 7200, totalRegistration: 4471.57, totalCash: 12971.57 });
    expect(accepted(input)).toEqual(first);
    expect(input).toEqual(original);
  });

  it("reports version, official sources, caveats and successful legal audit", () => {
    const result = accepted(documentationInput());
    expect(result.legalPolicyVersion).toBe("sp-capital-2026.1");
    expect(result.legalSources).toEqual(
      expect.arrayContaining([
        "https://prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2513",
        "https://arisp.com.br/wp-content/uploads/2026/01/2.pdf",
      ]),
    );
    expect(result.legalSources.some((url) => url.endsWith("/itbi/2517"))).toBe(true);
    expect(result.legalWarnings.join(" ")).toMatch(/guia.*Prefeitura/);
    expect(result.legalWarnings.join(" ")).toContain("08/01/2026");
    expect(result.registrationRule).toContain("50%");
  });
});
