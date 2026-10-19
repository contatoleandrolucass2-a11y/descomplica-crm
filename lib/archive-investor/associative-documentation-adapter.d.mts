import type {
  DocumentationInput,
  DocumentationLegalContext,
  DocumentationResult,
} from "./documentation-calculator-rules.mjs";

export interface AssociativeDocumentationInput extends Omit<
  DocumentationInput,
  "appraisalValue" | "legalContext"
> {
  reportedAppraisal?: string | number | null;
  appraisalOverride?: string | number | null;
  manualModalityPreference?: string | null;
  /** Canonical municipality from the selected unit. Missing/unsupported municipalities block estimation. */
  municipality?: string;
  /** Omit for an automatic estimate. Any supplied context is validated by the strict engine. */
  legalContext?: Partial<DocumentationLegalContext> | null | undefined;
}

export interface AssociativeDocumentationEstimate {
  mode: "automatic";
  basesConfirmed: false;
  municipality: string;
  baseDate: string;
  policyVersion: string;
  sourceVerifiedAt: string;
  validFrom: string;
  validThrough: string;
  sources: string[];
  assumptions: string[];
  pending: string[];
  inputs: {
    salePrice: number;
    financing: number;
    appraisalValue: number;
    income: number;
    firstProperty: string;
    naturalPerson: "SIM";
    residential: "SIM";
    program: "MCMV" | "NONE";
    financingSystem: "SFH";
    registryTable: "ARISP_2";
    itbiBase: number;
    iptuValue: null;
  };
}

export interface AssociativeDocumentationView {
  appraisalFromReport: boolean;
  appraisalValue: number;
  missingItems: string[];
  result: DocumentationResult & { estimate?: AssociativeDocumentationEstimate };
  estimate: AssociativeDocumentationEstimate | null;
  status: "ready" | "waiting" | "blocked";
  statusLabel: string;
  modalityDecision: {
    effectiveModality: "MCMV" | "SBPE" | null;
    eligibleForMcmv: boolean;
    mcmvRange: string | null;
    mcmvRangeLabel: string | null;
    forced: boolean;
    selectionSource: "automatic" | "manual" | null;
    reasonCodes: readonly string[];
    ruleVersion: string;
  };
}

export function resolveAssociativeAppraisal(
  reportedAppraisal: unknown,
  appraisalFallback: unknown,
): number;
export function calculateAssociativeDocumentationView(
  input: AssociativeDocumentationInput,
): AssociativeDocumentationView;
