import {
  evaluateFinancingModality,
  moneyToCents,
  MCMV_PROPERTY_LIMIT_CENTS,
} from "./financing-modality-rules.mjs";
import {
  calculateSpDocumentationCharges,
  REGISTRATION_TABLE,
  lookupRegistration,
  SP_DOCUMENTATION_POLICY,
} from "./documentation-sp-policy.mjs";
export { REGISTRATION_TABLE } from "./documentation-sp-policy.mjs";

export const OFFICIAL_PARAMETERS = Object.freeze({
  itbiExemptionLimit: SP_DOCUMENTATION_POLICY.exemptionLimit,
  reducedItbiBase: SP_DOCUMENTATION_POLICY.reducedFinancingLimit,
  progressiveItbiLimit: SP_DOCUMENTATION_POLICY.reducedPropertyLimit,
  reducedItbiRate: 0.005,
  fullItbiRate: 0.03,
  dispatchFee: 300,
  caixaInsurance: 1000,
  monthlyInterest: 0.015,
  direcionalInstallments: 40,
  rivaInstallments: 36,
  mcmvFinancingLimit: 0.8,
  sbpeFinancingLimit: 0.9,
  mcmvIncomeLimit: 13000,
  mcmvPropertyLimit: MCMV_PROPERTY_LIMIT_CENTS / 100,
  validDueDays: Object.freeze([5, 10, 15]),
  firstInstallmentWindowDays: 120,
});

export const DOCUMENTATION_INCOME_BANDS = Object.freeze([
  // Portaria MCID n.º 333/2026: limites urbanos vigentes.
  // https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/sobre-o-minha-casa-minha-vida-1
  Object.freeze({ label: "Faixa 1", minimum: 0.01, maximum: 3200 }),
  Object.freeze({ label: "Faixa 2", minimum: 3200.01, maximum: 5000 }),
  Object.freeze({ label: "Faixa 3", minimum: 5000.01, maximum: 9600 }),
  Object.freeze({ label: "Faixa 4", minimum: 9600.01, maximum: 13000 }),
]);

function normalizeText(value) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/\s+/g, " ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
    : "";
}

function normalizeBusinessUnit(value) {
  const normalized = normalizeText(value);
  if (normalized === "DIRECIONAL") return "Direcional";
  if (normalized === "RIVA") return "Riva";
  return "";
}

function normalizeModality(value) {
  const normalized = normalizeText(value);
  if (normalized === "MCMV" || normalized === "MINHA CASA MINHA VIDA") return "MCMV";
  if (normalized === "SBPE") return "SBPE";
  return "";
}

function normalizeFirstProperty(value) {
  if (value === true) return "SIM";
  if (value === false) return "NAO";
  const normalized = normalizeText(value);
  return normalized === "SIM" || normalized === "NAO" ? normalized : "";
}

function parseFinancialValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== "string") return Number.NaN;
  let normalized = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/[\s\u00a0]/g, "");
  if (!normalized) return 0;
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getDocumentationIncomeBand(value) {
  const income = parseFinancialValue(value);
  if (!(Number.isFinite(income) && income > 0)) return null;
  const band = DOCUMENTATION_INCOME_BANDS.find(({ maximum }) => income <= maximum);
  return band || Object.freeze({ label: "Acima da Faixa 4", minimum: 13000.01, maximum: null });
}

function parseDateValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  let parts;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) parts = trimmed.split("-").map(Number);
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number);
    parts = [year, month, day];
  } else return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addUtcMonthsClamped(date, months) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result;
}

export function buildDocumentationInstallmentSchedule({
  firstInstallmentDate,
  installments,
  installmentValue,
}) {
  const firstDate = parseDateValue(firstInstallmentDate);
  const count = Number(installments);
  const value = parseFinancialValue(installmentValue);
  if (!firstDate || !Number.isInteger(count) || count < 1 || !(Number.isFinite(value) && value > 0))
    return [];
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    paymentDate: toIsoDate(addUtcMonthsClamped(firstDate, index)),
    value: roundMoney(value),
  }));
}

function highestValidDueDate(baseDate) {
  const limit = addUtcDays(baseDate, OFFICIAL_PARAMETERS.firstInstallmentWindowDays);
  let selected = null;
  for (
    let cursor = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
    cursor <= limit;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    for (const day of OFFICIAL_PARAMETERS.validDueDays) {
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
      if (candidate >= baseDate && candidate <= limit && (!selected || candidate > selected))
        selected = candidate;
    }
  }
  return selected;
}

function chooseFirstInstallmentDate(baseDate, requestedValue) {
  const fallback = highestValidDueDate(baseDate);
  const requested = parseDateValue(requestedValue);
  const limit = addUtcDays(baseDate, OFFICIAL_PARAMETERS.firstInstallmentWindowDays);
  const requestedIsValid =
    requested &&
    requested >= baseDate &&
    requested <= limit &&
    OFFICIAL_PARAMETERS.validDueDays.includes(requested.getUTCDate());
  return {
    date: toIsoDate(requestedIsValid ? requested : fallback),
    corrected: Boolean(requestedValue) && !requestedIsValid,
  };
}

function priceInstallment(principal, periods) {
  if (principal <= 0) return 0;
  const rate = OFFICIAL_PARAMETERS.monthlyInterest;
  const factor = Math.pow(1 + rate, periods);
  return principal * ((rate * factor) / (factor - 1));
}

function incomeRange(income) {
  if (income <= 5000) return 2;
  if (income <= 9600) return 3;
  if (income <= OFFICIAL_PARAMETERS.mcmvIncomeLimit) return 4;
  return 0;
}

function propertyRange(salePrice) {
  if (salePrice <= 275000) return 2;
  if (salePrice <= 350000) return 3;
  if (salePrice <= OFFICIAL_PARAMETERS.mcmvPropertyLimit) return 4;
  return 99;
}

function registrationTableIsValid() {
  return (
    REGISTRATION_TABLE.length === 48 &&
    REGISTRATION_TABLE.every(
      ([start, fee], index) =>
        Number.isFinite(start) &&
        Number.isFinite(fee) &&
        start > 0 &&
        fee > 0 &&
        (index === 0 || start > REGISTRATION_TABLE[index - 1][0]),
    )
  );
}

export function calculateDocumentation(input) {
  const businessUnit = normalizeBusinessUnit(input.businessUnit);
  const informedModality = normalizeModality(input.modality);
  const firstProperty = normalizeFirstProperty(input.firstProperty);
  const salePrice = parseFinancialValue(input.salePrice);
  const appraisalValue = parseFinancialValue(input.appraisalValue);
  const financing = parseFinancialValue(input.financing);
  const income = parseFinancialValue(input.income);
  const modalityDecision = evaluateFinancingModality({
    familyIncomeCents: moneyToCents(income),
    firstProperty,
    manualPreference: informedModality,
    propertyValueCents: moneyToCents(salePrice),
    mcmvPropertyLimitCents: MCMV_PROPERTY_LIMIT_CENTS,
  });
  const effectiveModality =
    modalityDecision.effectiveModality ?? (firstProperty === "NAO" ? "SBPE" : informedModality);
  const baseDate = parseDateValue(input.baseDate);
  const tableIsValid = registrationTableIsValid();
  const mcmvIncomeRange = Number.isFinite(income) && income > 0 ? incomeRange(income) : 0;
  const mcmvPropertyRange =
    Number.isFinite(salePrice) && salePrice > 0 ? propertyRange(salePrice) : 0;
  const mcmvEligible =
    effectiveModality !== "MCMV" ||
    (income <= OFFICIAL_PARAMETERS.mcmvIncomeLimit &&
      salePrice <= OFFICIAL_PARAMETERS.mcmvPropertyLimit);
  const normalizations = [];
  if (typeof input.businessUnit === "string" && input.businessUnit !== businessUnit)
    normalizations.push("unidade_negocio");
  if (typeof input.modality === "string" && normalizeText(input.modality) !== informedModality)
    normalizations.push("modalidade");
  if (
    typeof input.firstProperty === "boolean" ||
    (typeof input.firstProperty === "string" && input.firstProperty !== firstProperty)
  )
    normalizations.push("primeiro_imovel");
  const errors = [];
  const legalCharges = calculateSpDocumentationCharges({
    salePrice,
    financing,
    legalContext: input.legalContext,
  });
  if (!legalCharges.ok) errors.push(...legalCharges.errors);

  if (!["Direcional", "Riva"].includes(businessUnit)) errors.push("Selecione Direcional ou Riva.");
  if (!["MCMV", "SBPE"].includes(informedModality)) errors.push("Selecione MCMV ou SBPE.");
  if (!["SIM", "NAO"].includes(firstProperty)) errors.push("Informe se é o primeiro imóvel.");
  if (!(Number.isFinite(salePrice) && salePrice > 0))
    errors.push("Valor da venda deve ser numérico e maior que zero.");
  if (!(Number.isFinite(appraisalValue) && appraisalValue > 0))
    errors.push("Avaliação bancária deve ser numérica e maior que zero.");
  if (!(Number.isFinite(financing) && financing > 0))
    errors.push("Valor do financiamento deve ser numérico e maior que zero.");
  if (input.income !== "" && input.income != null && !Number.isFinite(income))
    errors.push("Renda deve ser numérica.");
  if (effectiveModality === "MCMV" && !(income > 0))
    errors.push("Informe a renda para validar cenário MCMV.");
  if (effectiveModality === "MCMV" && income > 0 && !mcmvEligible)
    errors.push("Renda ou valor do imóvel incompatível com o enquadramento MCMV.");
  if (!baseDate) errors.push("Informe data-base válida.");
  if (!tableIsValid) errors.push("Tabela local de registro ausente ou incompleta.");

  const financingRate =
    effectiveModality === "MCMV"
      ? OFFICIAL_PARAMETERS.mcmvFinancingLimit
      : OFFICIAL_PARAMETERS.sbpeFinancingLimit;
  const appraisalFinancingLimit =
    Number.isFinite(appraisalValue) && appraisalValue > 0
      ? roundMoney(appraisalValue * financingRate)
      : 0;
  const maximumFinancing =
    appraisalFinancingLimit > 0 && salePrice > 0
      ? Math.min(appraisalFinancingLimit, roundMoney(salePrice))
      : appraisalFinancingLimit;
  if (financing > salePrice && salePrice > 0)
    errors.push("Financiamento não pode superar o valor da venda.");
  if (financing > appraisalFinancingLimit && appraisalFinancingLimit > 0)
    errors.push(
      `Financiamento supera teto de ${Math.round(financingRate * 100)}% da avaliação bancária.`,
    );

  const purchaseRegistrationBase =
    tableIsValid && salePrice > 0 ? lookupRegistration(salePrice) : null;
  const lienRegistrationBase = tableIsValid && financing > 0 ? lookupRegistration(financing) : null;
  if (salePrice > 0 && purchaseRegistrationBase == null)
    errors.push("Faixa de registro da compra e venda não localizada.");
  if (financing > 0 && lienRegistrationBase == null)
    errors.push("Faixa de registro da alienação não localizada.");

  const audit = [
    { label: "Condições legais e vigência de ITBI/registro", ok: legalCharges.ok },
    { label: "UDN", ok: ["Direcional", "Riva"].includes(businessUnit) },
    { label: "Modalidade efetiva", ok: ["MCMV", "SBPE"].includes(effectiveModality) },
    {
      label: "Valores financeiros",
      ok:
        Number.isFinite(salePrice) &&
        salePrice > 0 &&
        Number.isFinite(appraisalValue) &&
        appraisalValue > 0 &&
        Number.isFinite(financing) &&
        financing > 0,
    },
    {
      label: "Teto do financiamento",
      ok: financing > 0 && financing <= maximumFinancing && financing <= salePrice,
    },
    { label: "Enquadramento MCMV", ok: mcmvEligible },
    { label: "Data-base", ok: Boolean(baseDate) },
    {
      label: "Tabela local de registro",
      ok: tableIsValid && purchaseRegistrationBase != null && lienRegistrationBase != null,
    },
  ];

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      businessUnit,
      informedModality,
      effectiveModality,
      modalityDecision,
      maximumFinancing,
      financingRate,
      incomeRange: mcmvIncomeRange,
      propertyRange: mcmvPropertyRange,
      normalizations,
      audit,
    };
  }

  const {
    itbi: itbiValue,
    purchaseRegistration,
    lienRegistration,
    totalRegistration,
  } = legalCharges;
  const totalCash = roundMoney(
    OFFICIAL_PARAMETERS.dispatchFee +
      itbiValue +
      totalRegistration +
      OFFICIAL_PARAMETERS.caixaInsurance,
  );
  const installments =
    businessUnit === "Direcional"
      ? OFFICIAL_PARAMETERS.direcionalInstallments
      : OFFICIAL_PARAMETERS.rivaInstallments;
  const installmentValue = roundMoney(priceInstallment(totalCash, installments));
  const firstInstallment = chooseFirstInstallmentDate(baseDate, input.requestedFirstInstallment);

  return {
    ok: true,
    businessUnit,
    informedModality,
    effectiveModality,
    modalityDecision,
    modalityForced: informedModality !== effectiveModality,
    financingRate,
    maximumFinancing,
    financingUsage: financing / appraisalValue,
    financingHeadroom: maximumFinancing - financing,
    incomeRange: mcmvIncomeRange,
    propertyRange: mcmvPropertyRange,
    normalizations,
    itbi: itbiValue,
    itbiRule: legalCharges.itbiRule,
    registrationRule: legalCharges.registrationRule,
    registrationCombined: legalCharges.registrationCombined,
    legalPolicyVersion: legalCharges.legalPolicyVersion,
    legalWarnings: legalCharges.legalWarnings,
    legalSources: legalCharges.legalSources,
    purchaseRegistration,
    lienRegistration,
    totalRegistration,
    dispatchFee: OFFICIAL_PARAMETERS.dispatchFee,
    caixaInsurance: OFFICIAL_PARAMETERS.caixaInsurance,
    totalCash,
    installments,
    installmentValue,
    firstInstallmentDate: firstInstallment.date,
    firstInstallmentCorrected: firstInstallment.corrected,
    audit,
  };
}
