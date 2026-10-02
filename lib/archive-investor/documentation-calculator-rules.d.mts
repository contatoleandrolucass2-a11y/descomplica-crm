export interface DocumentationInput {
  businessUnit: string;
  modality: string;
  firstProperty: string | boolean;
  salePrice: string | number;
  appraisalValue: string | number;
  financing: string | number;
  income: string | number;
  baseDate: string;
  requestedFirstInstallment?: string;
}

export interface DocumentationAuditItem {
  label: string;
  ok: boolean;
}

interface DocumentationResultBase {
  businessUnit: string;
  informedModality: string;
  effectiveModality: string;
  maximumFinancing: number;
  financingRate: number;
  incomeRange: number;
  propertyRange: number;
  normalizations: string[];
  audit: DocumentationAuditItem[];
}

export type DocumentationResult = DocumentationResultBase &
  (
    | { ok: false; errors: string[] }
    | {
        ok: true;
        modalityForced: boolean;
        financingUsage: number;
        financingHeadroom: number;
        itbi: number;
        itbiRule: string;
        purchaseRegistration: number;
        lienRegistration: number;
        totalRegistration: number;
        dispatchFee: number;
        caixaInsurance: number;
        totalCash: number;
        installments: number;
        installmentValue: number;
        firstInstallmentDate: string;
        firstInstallmentCorrected: boolean;
      }
  );

export const OFFICIAL_PARAMETERS: Readonly<{
  itbiExemptionLimit: number;
  reducedItbiBase: number;
  progressiveItbiLimit: number;
  reducedItbiRate: number;
  fullItbiRate: number;
  dispatchFee: number;
  caixaInsurance: number;
  monthlyInterest: number;
  firstPropertyPurchaseRegistrationFactor: number;
  firstPropertyLienRegistrationFactor: number;
  direcionalInstallments: number;
  rivaInstallments: number;
  mcmvFinancingLimit: number;
  sbpeFinancingLimit: number;
  mcmvIncomeLimit: number;
  mcmvPropertyLimit: number;
  validDueDays: readonly number[];
  firstInstallmentWindowDays: number;
}>;
export interface DocumentationIncomeBand {
  label: string;
  minimum: number;
  maximum: number | null;
}
export const DOCUMENTATION_INCOME_BANDS: readonly DocumentationIncomeBand[];
export const REGISTRATION_TABLE: readonly (readonly [number, number])[];
export function getDocumentationIncomeBand(value: string | number): DocumentationIncomeBand | null;
export function calculateDocumentation(input: DocumentationInput): DocumentationResult;
export function buildDocumentationInstallmentSchedule(input: {
  firstInstallmentDate: string;
  installments: number;
  installmentValue: number;
}): { number: number; paymentDate: string; value: number }[];
