import { calculateHousingSimulation, type HousingInput, type HousingResult } from "./caixa";
import {
  getAssociativeAnnualEligibility,
  getAssociativeAnnualLimit,
} from "../../archive-investor/associative-annual-rules.mjs";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import { assessAssociativeCandidate } from "../../archive-investor/associative-approval-suggestion.mjs";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import { ASSOCIATIVE_APPROVAL_TIERS } from "../../archive-investor/associative-approval-rules.mjs";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import { isInvestorEligibleUnit } from "../../archive-investor/investor-filter-options.mjs";
import { resolveInvestorRegion } from "../../archive-investor/investor-region.mjs";
import { CAIXA_CITIES } from "./caixa-reference-data";
// @ts-expect-error -- Canonical archive module has no TypeScript declaration.
import * as associativeMemory from "../../archive-investor/associative-installment-memory.mjs";

export const CAIXA_UNIT_RANKINGS = ASSOCIATIVE_APPROVAL_TIERS as readonly {
  id: string;
  label: string;
}[];
export type CaixaUnit = {
  id: string;
  businessUnit: string;
  project: string;
  product: string;
  status?: string | null;
  identifier?: string | null;
  plant?: string | null;
  unitType?: string | null;
  constructionStatus?: string | null;
  completionDate?: string | null;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  postalCode?: string | null;
  finalPrice?: number | null;
  finalWithKit?: number | null;
  unitBonus?: number | null;
  tableSlack?: number | null;
  appraisal?: number | null;
  privateArea?: number | null;
  parkingSpaces?: number | null;
  progress?: number | null;
};
type SuccessfulHousing = Extract<HousingResult, { ok: true }>;
type FlowAssessment = {
  valid: boolean;
  approved: boolean;
  comparison: { highestLinearPayment: number; highestDecreasingPayment: number } | null;
  result: {
    context: { monthlyDates: string[]; income: number; valueReal: number };
    custom: {
      correctedProSoluto: number;
      installmentNominalBalance: number;
      desiredInstallments: number;
      preInstallments: number;
      postInstallments: number;
      linear: {
        adjustedPre: number;
        adjustedPost: number;
        prePayment: number;
        postPayment: number;
      };
      decreasing: { blocks: unknown[] };
      intermediaries: {
        index: number;
        date: string;
        value: number;
        approved: boolean;
        correctedValue: number;
      }[];
    };
  };
  approval: {
    proSolutoRate: number;
    linearCommitmentRate: number;
    linearMaximumIncomeRate: number;
    tier: { proSolutoRate: number; commitmentRate: number; annualIncomeLimitRate: number };
  } | null;
};
export type CaixaUnitFlowDetails = {
  purchaseValue: number;
  approvalRows: { label: string; linear: number; decreasing: number; limit: number }[];
  schedule: {
    kind: string;
    label: string;
    paymentDate: string;
    installment: number | null;
    linearPayment: number;
    decreasingPayment: number;
    workEvolution: number | null;
    annualPayment: number;
    linearTotal: number;
    decreasingTotal: number;
  }[];
};
export type CaixaAvailableUnit = {
  unit: CaixaUnit;
  region: string;
  price: number;
  financing: number;
  subsidy: number;
  fgts: number;
  publicContribution: number;
  entry: number;
  installments: 84;
  annuals: { date: string; amount: number }[];
  linearPayment: number;
  decreasingPayment: number;
  proSoluto: number;
  details?: CaixaUnitFlowDetails;
};
export type CaixaUnitAssessment =
  | { status: "approved"; value: CaixaAvailableUnit }
  | { status: "rejected" | "unavailable"; reason: string };
const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const knownMoney = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const canonicalCities = new Map(
  CAIXA_CITIES.map((city) => [`${city.u}|${normalize(city.n.trim())}`, city.n]),
);
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function constructionMonths(baseDate: string, completionDate: string) {
  if (completionDate <= baseDate) return 0;
  const base = new Date(`${baseDate}T12:00:00Z`);
  const end = new Date(`${completionDate}T12:00:00Z`);
  return (
    (end.getUTCFullYear() - base.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    base.getUTCMonth() +
    (end.getUTCDate() > base.getUTCDate() ? 1 : 0)
  );
}

export function caixaUnitEntry(ownFunds: number | undefined) {
  return Math.max(150, knownMoney(ownFunds) ? ownFunds : 0);
}

export function caixaCommercialPrice(unit: CaixaUnit): number | null {
  if (unit.finalWithKit != null) {
    if (!positive(unit.finalWithKit) || !knownMoney(unit.unitBonus) || !knownMoney(unit.tableSlack))
      return null;
    const cents =
      Math.round(unit.finalWithKit * 100) -
      Math.round(unit.unitBonus * 100) -
      Math.round(unit.tableSlack * 100);
    return cents > 0 ? cents / 100 : null;
  }
  return positive(unit.finalPrice) ? unit.finalPrice : null;
}

export function caixaAutomaticAnnuals(
  income: number,
  baseDate: string,
  completionDate: string,
  balance: number,
) {
  const dates = getAssociativeAnnualEligibility({ baseDate, completionDate, entryDate: baseDate });
  const count = dates.filter((d) => d.eligible).length;
  // Preserve at least one cent for the 84 monthly payments; never over-allocate annual principal.
  const availableCents = Math.max(0, Math.floor(balance * 100 + 1e-7) - 1);
  const cents = count
    ? Math.min(
        Math.round(getAssociativeAnnualLimit(income) * 100),
        Math.floor(availableCents / count),
      )
    : 0;
  return dates.map((d) => ({ date: d.date, amount: d.eligible ? cents / 100 : 0 }));
}

export function assessCaixaAvailableUnit(
  unit: CaixaUnit,
  input: HousingInput,
  capacity: Pick<SuccessfulHousing, "maximumFinancingByIncome">,
  ranking: string,
  baseDate: string,
  firstProperty: boolean,
  options: { includeDetails?: boolean } = {},
): CaixaUnitAssessment {
  if (!CAIXA_UNIT_RANKINGS.some((t) => t.id === ranking) || ranking === "not-eligible")
    return { status: "rejected", reason: "Ranking não elegível." };
  if (!isInvestorEligibleUnit(unit))
    return { status: "rejected", reason: "Unidade não residencial." };
  // The live report can also contain mirrored reservations; only an explicitly available unit is offered.
  if (typeof unit.status !== "string" || normalize(unit.status.trim()) !== "disponivel")
    return { status: "unavailable", reason: "Disponibilidade da unidade não confirmada." };
  if (!validDate(baseDate)) return { status: "unavailable", reason: "Data-base inválida." };
  if (!input.officialQuickEstimate)
    return {
      status: "unavailable",
      reason: "Seguros oficiais específicos de cada unidade não disponíveis.",
    };
  if (input.product !== "sbpe" && !firstProperty)
    return {
      status: "rejected",
      reason: "Confirme a modalidade para um cliente que já possui imóvel.",
    };
  const price = caixaCommercialPrice(unit);
  const progress = unit.progress;
  const typeText = normalize(
    typeof unit.unitType === "string" && unit.unitType ? unit.unitType : unit.product,
  );
  const propertyType = typeText.startsWith("apartamento")
    ? "apartment"
    : typeText.startsWith("casa")
      ? "house"
      : null;
  if (
    !price ||
    !unit.completionDate ||
    !validDate(unit.completionDate) ||
    typeof unit.city !== "string" ||
    !unit.city.trim() ||
    typeof unit.state !== "string" ||
    !unit.state.trim() ||
    !positive(unit.appraisal) ||
    !positive(unit.privateArea) ||
    !propertyType ||
    !knownMoney(progress) ||
    progress > 1
  ) {
    return { status: "unavailable", reason: "Dados oficiais da unidade incompletos." };
  }
  const state = unit.state.trim().toUpperCase();
  const city = canonicalCities.get(`${state}|${normalize(unit.city.trim())}`);
  if (!city)
    return { status: "unavailable", reason: "Município oficial da unidade não identificado." };
  const construction = normalize(
    typeof unit.constructionStatus === "string" ? unit.constructionStatus : "",
  );
  const inConstruction = unit.completionDate > baseDate;
  // Future completion identifies a new construction. Delivered units need an explicit new/used fact.
  const propertyCondition = construction.includes("usad")
    ? "used"
    : inConstruction || construction.includes("novo") || construction.includes("nova")
      ? "new"
      : null;
  if (!propertyCondition)
    return { status: "unavailable", reason: "Condição do imóvel não confirmada no estoque." };
  if (propertyCondition === "used" && inConstruction)
    return { status: "unavailable", reason: "Condição e prazo de obra incompatíveis." };
  const entry = caixaUnitEntry(input.ownFunds);
  // These parameters belong to the originally simulated property and cannot be transplanted.
  const originalRate = input.nominalRate;
  const profile = { ...input };
  for (const field of [
    "appraisalValue",
    "confirmedSubsidy",
    "cityLimit",
    "populationFactor",
    "mipMonthly",
    "dfiMonthly",
    "propertyArea",
    "propertyType",
    "constructionMonths",
    "nominalRate",
    "confirmedPublicContribution",
  ] as const)
    delete profile[field];
  const housing = calculateHousingSimulation({
    ...profile,
    ...(input.product === "sbpe" && originalRate !== undefined
      ? { nominalRate: originalRate }
      : {}),
    propertyValue: price,
    appraisalValue: unit.appraisal,
    city,
    state,
    propertyType,
    propertyArea: unit.privateArea,
    propertyCondition,
    inConstruction,
    constructionMonths: constructionMonths(baseDate, unit.completionDate),
    ownFunds: entry,
    asOf: baseDate,
  });
  if (!housing.ok || housing.subsidyEligibility === "eligible-review")
    return { status: "unavailable", reason: "Enquadramento CAIXA da unidade não calculável." };
  const financing =
    Math.floor(Math.min(housing.financing, capacity.maximumFinancingByIncome) * 100) / 100;
  const remaining =
    price - financing - housing.subsidy - housing.fgts - housing.publicContribution - entry;
  const annuals = caixaAutomaticAnnuals(input.income, baseDate, unit.completionDate, remaining);
  const flowInput = {
    selectedUnitId: unit.id,
    baseDate,
    entryDate: baseDate,
    completionDate: unit.completionDate,
    salePrice: price,
    // price already resolves kit, bonus and table slack, including finalPrice-only reports.
    propertyValue: price,
    unitBonus: 0,
    tableSlack: 0,
    discountAuthorized: false,
    financing,
    subsidy: housing.subsidy,
    fgts: housing.fgts,
    housingCheck: housing.publicContribution,
    entryValue: entry,
    installments: 84,
    annualMode: true,
    income: input.income,
    signals: [0, 0, 0],
    intermediaries: annuals.map((a) => a.amount),
    approvalTierId: ranking,
  };
  const linear = assessAssociativeCandidate(flowInput, progress, "linear") as FlowAssessment;
  const decreasing = assessAssociativeCandidate(
    flowInput,
    progress,
    "decreasing",
  ) as FlowAssessment;
  if (
    Math.round(linear.result.context.valueReal * 100) !== Math.round(price * 100) ||
    Math.round(decreasing.result.context.valueReal * 100) !== Math.round(price * 100)
  )
    return {
      status: "unavailable",
      reason: "A base comercial diverge do valor de compra usado na CAIXA.",
    };
  if (!linear.valid || !decreasing.valid)
    return { status: "unavailable", reason: "Calendário ou fluxo comercial incompleto." };
  if (!linear.approved || !decreasing.approved || !linear.comparison || !decreasing.comparison)
    return { status: "rejected", reason: "Fora dos limites do ranking." };
  let details: CaixaUnitFlowDetails | undefined;
  if (options.includeDetails && linear.approval && decreasing.approval) {
    const canonical = linear.result;
    const comparison = associativeMemory.buildAssociativePaymentComparison({
      monthlyDates: canonical.context.monthlyDates,
      installments: canonical.custom.desiredInstallments,
      linearSchedule: associativeMemory.buildAssociativeInstallmentMemory({
        monthlyDates: canonical.context.monthlyDates,
        preInstallments: canonical.custom.preInstallments,
        postInstallments: canonical.custom.postInstallments,
        adjustedPre: canonical.custom.linear.adjustedPre,
        adjustedPost: canonical.custom.linear.adjustedPost,
        prePayment: canonical.custom.linear.prePayment,
        postPayment: canonical.custom.linear.postPayment,
      }),
      decreasingBlocks: canonical.custom.decreasing.blocks,
      income: input.income,
      constructionProgress: progress,
      baseDate,
      completionDate: unit.completionDate,
      entryPayment: { kind: "entry", label: "Entrada", paymentDate: baseDate, value: entry },
      signals: [],
      annuals: canonical.custom.intermediaries
        .filter((annual) => annual.value > 0 && annual.approved && annual.correctedValue > 0)
        .map((annual) => ({
          index: annual.index,
          paymentDate: annual.date,
          correctedValue: annual.correctedValue,
          approved: true,
        })),
    }) as { rows: CaixaUnitFlowDetails["schedule"] };
    details = {
      purchaseValue: canonical.context.valueReal,
      approvalRows: [
        {
          label: "Pró-soluto",
          linear: linear.approval.proSolutoRate,
          decreasing: decreasing.approval.proSolutoRate,
          limit: linear.approval.tier.proSolutoRate,
        },
        {
          label: "Comprometimento da renda",
          linear: linear.approval.linearCommitmentRate,
          decreasing: decreasing.approval.linearCommitmentRate,
          limit: linear.approval.tier.commitmentRate,
        },
        {
          label: "Máximo da renda mensal",
          linear: linear.approval.linearMaximumIncomeRate,
          decreasing: decreasing.approval.linearMaximumIncomeRate,
          limit: linear.approval.tier.annualIncomeLimitRate,
        },
      ],
      schedule: comparison.rows,
    };
  }
  return {
    status: "approved",
    value: {
      unit,
      region: resolveInvestorRegion(unit),
      price,
      financing,
      subsidy: housing.subsidy,
      fgts: housing.fgts,
      publicContribution: housing.publicContribution,
      entry,
      installments: 84,
      annuals: annuals.filter((a) => a.amount > 0),
      linearPayment: linear.comparison.highestLinearPayment,
      decreasingPayment: decreasing.comparison.highestDecreasingPayment,
      proSoluto: linear.result.custom.correctedProSoluto,
      ...(details ? { details } : {}),
    },
  };
}
