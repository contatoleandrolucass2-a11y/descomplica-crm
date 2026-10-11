import type { DocumentationInput, DocumentationResult } from "./documentation-calculator-rules.mjs";

export const SP_DOCUMENTATION_POLICY: Readonly<{
  version: string;
  verifiedAt: string;
  itbiFrom: string;
  registrationFrom: string;
  validThrough: string;
  exemptionLimit: number;
  reducedFinancingLimit: number;
  reducedPropertyLimit: number;
  fgtsCombinedLimit: number;
  fgtsCombinedFee: number;
  registrationPdfSha256: string;
  sources: readonly string[];
}>;

export const REGISTRATION_TABLE: readonly (readonly [number, number])[];
export const QUINTO_REGISTRATION_TABLE: readonly (readonly [number, number])[];
export function lookupRegistration(value: number, table?: string): number | null;
export function calculateSpDocumentationCharges(input: {
  salePrice: number;
  financing: number;
  legalContext?: DocumentationInput["legalContext"];
}):
  | { ok: false; errors: string[] }
  | Pick<
      Extract<DocumentationResult, { ok: true }>,
      | "ok"
      | "itbi"
      | "itbiRule"
      | "purchaseRegistration"
      | "lienRegistration"
      | "totalRegistration"
      | "registrationCombined"
      | "registrationRule"
      | "legalPolicyVersion"
      | "legalSources"
      | "legalWarnings"
    >;
