import { describe, expect, it } from "vitest";
import {
  calculateAssociativeDocumentationView,
  type AssociativeDocumentationInput,
} from "@/lib/archive-investor/associative-documentation-adapter.mjs";
import { calculateDocumentation } from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import { REGISTRATION_TABLE } from "@/lib/archive-investor/documentation-sp-policy.mjs";
import { documentationInput, documentationLegalContext } from "./fixtures/documentation-input";

const financialKeys = [
  "itbi",
  "purchaseRegistration",
  "lienRegistration",
  "totalRegistration",
  "totalCash",
  "dispatchFee",
  "caixaInsurance",
  "installments",
  "installmentValue",
  "firstInstallmentDate",
  "firstInstallmentCorrected",
  "maximumFinancing",
  "financingRate",
  "financingUsage",
  "financingHeadroom",
  "effectiveModality",
  "incomeRange",
  "propertyRange",
  "registrationCombined",
] as const;

const profiles = ["Direcional", "Riva"].flatMap((businessUnit) => [
  { businessUnit, modality: "MCMV", firstProperty: "SIM" },
  { businessUnit, modality: "SBPE", firstProperty: "SIM" },
  { businessUnit, modality: "MCMV", firstProperty: "NAO" },
  { businessUnit, modality: "SBPE", firstProperty: "NAO" },
]);

function parity(overrides: Partial<AssociativeDocumentationInput>) {
  const input = {
    ...documentationInput(),
    legalContext: undefined,
    municipality: "sao-paulo-sp",
    reportedAppraisal: 250000,
    ...overrides,
  };
  const view = calculateAssociativeDocumentationView(input);
  // Explicit declarations exist only in this synthetic comparator, never in the automatic path.
  const strict = calculateDocumentation({
    ...input,
    modality: view.modalityDecision.effectiveModality ?? "",
    appraisalValue: input.reportedAppraisal ?? 0,
    legalContext: documentationLegalContext({
      itbiBase: input.salePrice,
      firstAcquisition: input.firstProperty === "SIM" ? "SIM" : "NAO",
      program: view.modalityDecision.effectiveModality === "MCMV" ? "MCMV" : "NONE",
      transactionDate: input.baseDate,
      financingContractDate: input.baseDate,
      registrationDate: input.baseDate,
    }),
  });
  const scenario = JSON.stringify(overrides);
  expect(view.result.ok, scenario).toBe(true);
  expect(strict.ok, scenario).toBe(true);
  if (!view.result.ok || !strict.ok) throw new Error(scenario);
  const automaticValues = Object.fromEntries(
    financialKeys.map((key) => [key, view.result.ok ? view.result[key] : undefined]),
  );
  const strictValues = Object.fromEntries(financialKeys.map((key) => [key, strict[key]]));
  expect(automaticValues, scenario).toEqual(strictValues);
  expect(view.estimate?.basesConfirmed).toBe(false);
  expect(view.estimate?.inputs.iptuValue).toBeNull();
}

describe.each(profiles)(
  "automatic/strict parity $businessUnit/$modality/$firstProperty",
  (profile) => {
    it("matches all 48 ARISP purchase and lien boundaries at the previous, exact and next cent", () => {
      for (const [start] of REGISTRATION_TABLE) {
        for (const delta of [-0.01, 0, 0.01]) {
          const value = Math.round((start + delta) * 100) / 100;
          if (value <= 0) continue;
          parity({
            ...profile,
            salePrice: value,
            financing: Math.max(0.01, Math.round(value * 40) / 100),
            reportedAppraisal: Math.max(1, value * 2),
          });
          parity({
            ...profile,
            salePrice: value * 2,
            financing: value,
            reportedAppraisal: Math.max(1, value * 2),
          });
        }
      }
    });

    it("matches all ITBI, financing and commercial thresholds at adjacent cents", () => {
      for (const threshold of [230520, 245527.77, 275000, 350000, 600000, 725808]) {
        for (const delta of [-0.01, 0, 0.01]) {
          parity({
            ...profile,
            salePrice: Math.round((threshold + delta) * 100) / 100,
            reportedAppraisal: 1000000,
          });
        }
      }
      for (const financing of [100000, 120967.99, 120968, 120968.01, 200000])
        parity({ ...profile, financing });
      for (const income of [
        3199.99, 3200, 3200.01, 4999.99, 5000, 5000.01, 9599.99, 9600, 9600.01, 12999.99, 13000,
        13000.01,
      ])
        parity({ ...profile, income });
    });

    it("matches Price, extras and the first due date for every supported base date, including year rollover", () => {
      for (
        let day = new Date("2026-01-08T00:00:00Z");
        day <= new Date("2026-12-31T00:00:00Z");
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        parity({ ...profile, baseDate: day.toISOString().slice(0, 10) });
      }
    });
  },
);
