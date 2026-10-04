import type { TabelaoInventoryItem } from "../../lib/archive-investor/tabelao-inventory.mjs";

export type NumericInput = number | string | null | undefined;
/** calculable means the decision was computed, including a legitimate financial rejection.
 * justified_block means missing evidence or invalid input. real_error takes precedence
 * when the actual result diverges from the independent oracle. None means bank approval.
 */
export type MatrixOutcome = "calculable" | "justified_block" | "real_error";
export interface Inventory extends TabelaoInventoryItem {
  /** Source inventory uses a fraction in [0,1], never a percentage in [0,100]. */
  progress?: number | null;
  completionDate?: string | null;
}
export interface LinearInput {
  development: string;
  product: string;
  stockMatch: boolean;
  policyConfirmed: boolean;
  policyLimit: NumericInput;
  installments: NumericInput;
  entryDate: string;
  constructionEnd: string;
  salePrice: NumericInput;
  bonus: NumericInput;
  discount: NumericInput;
  financing: NumericInput;
  subsidy: NumericInput;
  fgts: NumericInput;
  housingCheck: NumericInput;
  entry: NumericInput;
  signal1: NumericInput;
  signal2: NumericInput;
  signal3: NumericInput;
  annual1: NumericInput;
  annual2: NumericInput;
  annual3: NumericInput;
  annual4: NumericInput;
  annual5: NumericInput;
}
export interface LinearMetrics {
  firstInstallmentDate: string;
  signalDates: string[];
  graceMonths: number;
  validInitialTotal: number;
  annualCorrectedTotal: number;
  realSaleValue: number;
  deductions: number;
  proSoluto: number;
  installmentBalance: number;
  correctedProSoluto: number;
  correctedInstallmentBalance: number;
  correctedWithAnnuals: number;
  preInstallments: number;
  postInstallments: number;
  baseRate: number;
  correctedInstallment: number;
  prePercentage: number;
  postPercentage: number;
}
export interface ApprovalInput {
  tierId: string;
  income: NumericInput;
  realSaleValue: NumericInput;
  proSoluto: NumericInput;
  correctedInstallment?: NumericInput;
  linearInstallment?: NumericInput;
  decreasingInstallment?: NumericInput;
  linearMaximumIncomePayment?: NumericInput;
  decreasingMaximumIncomePayment?: NumericInput;
  proposalValid?: boolean;
  paymentComparisonValid?: boolean;
  installmentComparisonValid?: boolean;
  workEvolutionValid?: boolean;
}
export interface ForecastInput {
  monthlyDates: string[];
  installments: number;
  linearSchedule: Array<{ payment: NumericInput }>;
  decreasingBlocks: Array<{ count: number; correctedInstallment: NumericInput }>;
  income: NumericInput;
  constructionProgress: NumericInput;
  baseDate: string;
  completionDate: string;
  entryPayment?: { kind: string; label?: string; date: string; value: number } | null;
  signals?: Array<{ label?: string; date: string; value: number }>;
  annuals?: Array<{ date: string; value: number; approved?: boolean }>;
}
export interface ForecastOracle {
  normalizedProgress: number | null;
  workEvolutionAvailable: boolean;
  installmentComparisonAvailable: boolean;
  comparisonAvailable: boolean;
  highestLinearPayment: number | null;
  highestDecreasingPayment: number | null;
  highestLinearTotal: number | null;
  highestDecreasingTotal: number | null;
  rows: Array<{
    paymentDate: string;
    constructionProgress: number | null;
    workEvolution: number | null;
    linearTotal: number | null;
    decreasingTotal: number | null;
  }>;
}
export interface ModalityInput {
  familyIncomeCents: number | null;
  firstProperty: boolean | "SIM" | "NAO" | null;
  manualPreference?: "MCMV" | "SBPE" | null;
  propertyValueCents?: number | null;
  mcmvPropertyLimitCents?: number | null;
}
export interface DecreasingInput {
  uncorrectedBalance: number;
  correctedBalance: number;
  installments: number;
  preInstallments: number;
  postInstallments: number;
  firstInstallmentDate: string;
}
export interface MatrixCheck {
  outcome: MatrixOutcome;
  /** All causes remain visible, including expected ranking rejections. */
  causes: string[];
  /** Nonblocking decisions; currently ranking.rejected only. */
  expectedDecisions: string[];
  mismatches: string[];
  comparisons: number;
}
export interface MatrixCounts {
  cases: number;
  comparisons: number;
  calculable: number;
  justified_block: number;
  real_error: number;
}
export interface MatrixAggregate extends MatrixCounts {
  causes: Record<string, number>;
  /** Counts also remain in causes, including when another cause blocks the same case. */
  expectedDecisions: Record<string, number>;
  mismatches: Record<string, number>;
}
export interface MatrixReport {
  contract: string;
  scope: string;
  authority: string;
  progressConvention: string;
  outcomeConvention: string;
  inventory: {
    supplied: number;
    visited: number;
    profilesPerUnit: number;
    /** Distinct consumed-input/profile combinations evaluated in this run. */
    evaluatedProfiles: number;
    /** Identical combinations counted again, with the same comparisons and causes. */
    reusedProfiles: number;
  };
  sections: Record<
    "linear" | "decreasing" | "forecast" | "approval" | "modality" | "appraisal" | "inventory",
    MatrixAggregate
  >;
  totals: MatrixCounts;
}
export const MATRIX_CONTRACT: Readonly<{
  version: string;
  outcomeConvention: string;
  rankingPolicy: string;
  modalityPolicy: string;
  officialFormula: string;
  inventoryProgressUnit: string;
  legacyForecastProgressUnit: string;
  preRate: number;
  postRate: number;
  annualRate: number;
  absoluteMoneyTolerance: number;
  relativeTolerance: number;
  sources: readonly string[];
}>;
export const RANKING_ORACLE: Readonly<Record<string, readonly [number, number, number]>>;
export function discountWeights(pre: number, post: number): number[];
export function syntheticLinearInput(overrides?: Partial<LinearInput>): LinearInput;
export function oracleLinear(
  input: LinearInput,
  today?: string,
): { ok: boolean; causes: string[]; metrics: LinearMetrics | null };
export function syntheticApprovalInput(overrides?: Partial<ApprovalInput>): ApprovalInput;
export function oracleApproval(input: ApprovalInput): {
  status: "pending" | "approved" | "rejected";
  checks: Array<{ available: boolean; value: number | null; limit: number; ok: boolean }>;
};
export function syntheticForecastInput(overrides?: Partial<ForecastInput>): ForecastInput;
export function oracleForecast(input: ForecastInput): ForecastOracle;
export function oracleModality(input: ModalityInput): {
  effectiveModality: "MCMV" | "SBPE" | null;
  eligibleForMcmv: boolean;
  mcmvRange: string | null;
  forced: boolean;
  selectionSource: "automatic" | "manual" | null;
  reasonCodes: string[];
  pending: string[];
};
export function compareMetrics(actual: unknown, expected: object, prefix?: string): string[];
export function checkLinearScenario(input: LinearInput, today?: string): MatrixCheck;
export function checkDecreasingScenario(input: DecreasingInput): MatrixCheck;
export function checkApprovalScenario(input: ApprovalInput): MatrixCheck;
export function checkForecastScenario(input: ForecastInput): MatrixCheck;
export function checkModalityScenario(input: ModalityInput): MatrixCheck;
export function checkAppraisalScenario(input: {
  reportedAppraisal: NumericInput;
  appraisalOverride: NumericInput;
  modality?: "MCMV" | "SBPE";
}): MatrixCheck;
/** Visits every supplied item with three synthetic buyer profiles. No I/O or raw inventory output. */
export function runAssociativeScenarioMatrix(options?: {
  inventory?: readonly Inventory[];
  includeSynthetic?: boolean;
  baseDate?: string;
}): MatrixReport;
