import type {
  DocumentationInput,
  DocumentationLegalContext,
} from "@/lib/archive-investor/documentation-calculator-rules.mjs";

export function documentationLegalContext(
  overrides: Partial<DocumentationLegalContext> = {},
): DocumentationLegalContext {
  return {
    municipality: "sao-paulo-sp",
    transactionDate: "2026-10-02",
    financingContractDate: "2026-10-01",
    registrationDate: "2026-10-10",
    registryTable: "ARISP_2",
    specialRegime: "NONE",
    naturalPerson: "SIM",
    residential: "SIM",
    firstAcquisition: "SIM",
    program: "MCMV",
    financingSystem: "SFH",
    funding: "OTHER",
    firstTransfer: "",
    itbiBase: 240000,
    iptuValue: 0,
    basesConfirmed: true,
    ...overrides,
  };
}

export function documentationInput(
  overrides: Partial<DocumentationInput> = {},
  legalOverrides: Partial<DocumentationLegalContext> = {},
): DocumentationInput {
  return {
    businessUnit: "Direcional",
    modality: "MCMV",
    firstProperty: "SIM",
    salePrice: 240000,
    appraisalValue: 250000,
    financing: 192000,
    income: 5000,
    baseDate: "2026-10-02",
    legalContext: documentationLegalContext(legalOverrides),
    ...overrides,
  };
}
