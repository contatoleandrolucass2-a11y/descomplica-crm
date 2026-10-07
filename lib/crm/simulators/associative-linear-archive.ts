// @ts-expect-error -- The canonical archive module has no TypeScript declaration.
import { calculateAssociativeLinear } from "../../archive-investor/associative-linear-calculator-rules.mjs";

export type AssociativeLinearForm = {
  development: string;
  product: string;
  stockMatch: boolean;
  policyConfirmed: boolean;
  policyLimit: string;
  installments: string;
  entryDate: string;
  constructionEnd: string;
  calculationDate?: string;
  firstInterestDate?: string;
  firstInstallmentDate?: string;
  salePrice: string;
  bonus: string;
  discount: string;
  financing: string;
  subsidy: string;
  fgts: string;
  housingCheck: string;
  entry: string;
  signal1: string;
  signal2: string;
  signal3: string;
  annual1: string;
  annual2: string;
  annual3: string;
  annual4: string;
  annual5: string;
};

type AnnualSchedule = {
  index: number;
  amount: number;
  dueDate: string;
  months: number;
  corrected: number;
  valid: boolean;
  reason: string;
};

export type AssociativeLinearArchiveResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  calculationDate: string;
  firstInstallmentDate: string;
  firstInterestDate: string;
  monthlyCorrectionMonths: number;
  graceMonths: number;
  validInitialTotal: number;
  annualSchedule: AnnualSchedule[];
  annualCorrectedTotal: number;
  annualNominalTotal: number;
  proSoluto: number;
  installmentBalance: number;
  correctedInstallmentBalance: number;
  installments: number;
  preInstallments: number;
  postInstallments: number;
  preVariable: number;
  postVariable: number;
  prePercentage: number;
  postPercentage: number;
  prePeriodTotal: number;
  postPeriodTotal: number;
  adjustedPre: number;
  adjustedPost: number;
  prePayment: number;
  postPayment: number;
  correctedInstallment: number;
  installmentOverSale: number;
  proSolutoOverSale: number;
  audit: Array<{ label: string; ok: boolean }>;
};

export function calculateAssociativeLinearArchive(
  raw: AssociativeLinearForm,
  options: { today?: string } = {},
): AssociativeLinearArchiveResult {
  return calculateAssociativeLinear(raw, options) as AssociativeLinearArchiveResult;
}
