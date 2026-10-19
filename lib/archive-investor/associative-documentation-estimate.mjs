import { OFFICIAL_PARAMETERS as parameters } from "./documentation-calculator-rules.mjs";
import {
  lookupRegistration,
  SP_DOCUMENTATION_POLICY as policy,
} from "./documentation-sp-policy.mjs";
import {
  evaluateFinancingModality,
  moneyToCents,
  MCMV_PROPERTY_LIMIT_CENTS,
} from "./financing-modality-rules.mjs";

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const financialValue = (value) => {
  const cents = moneyToCents(value);
  if (!Number.isSafeInteger(cents)) return Number.NaN;
  if (typeof value === "number" && Math.abs(value * 100 - cents) > 0.0001) return Number.NaN;
  return cents / 100;
};

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

// This path has no fiscal declarations. Its assumptions must never enter the strict engine.
export function calculateAssociativeDocumentationEstimate(input) {
  const salePrice = financialValue(input.salePrice);
  const financing = financialValue(input.financing);
  const appraisalValue = financialValue(input.appraisalValue);
  const income = financialValue(input.income);
  const firstProperty =
    input.firstProperty === true
      ? "SIM"
      : input.firstProperty === false
        ? "NAO"
        : input.firstProperty;
  const businessUnit =
    typeof input.businessUnit === "string" ? input.businessUnit.trim().toUpperCase() : "";
  const normalizedBusinessUnit =
    businessUnit === "DIRECIONAL" ? "Direcional" : businessUnit === "RIVA" ? "Riva" : "";
  const modalityDecision = evaluateFinancingModality({
    familyIncomeCents: moneyToCents(income),
    firstProperty,
    manualPreference: input.modality,
    propertyValueCents: moneyToCents(salePrice),
    mcmvPropertyLimitCents: MCMV_PROPERTY_LIMIT_CENTS,
  });
  const effectiveModality = modalityDecision.effectiveModality ?? "";
  const mcmv = effectiveModality === "MCMV";
  const financingRate = mcmv ? parameters.mcmvFinancingLimit : parameters.sbpeFinancingLimit;
  const maximumFinancing =
    appraisalValue > 0 && salePrice > 0
      ? Math.min(round(appraisalValue * financingRate), salePrice)
      : 0;
  const baseDate = parseDate(input.baseDate);
  const assumptions = [
    "Pessoa física e imóvel residencial são premissas desta simulação, não declarações fiscais.",
    "Primeira aquisição e programa habitacional são estimados a partir do perfil comercial; dependem do contrato.",
    "SFH estimado; origem dos recursos, benefícios especiais e primeira transmissão pendentes de conferência.",
    "Preço de venda usado como base estimada de ITBI e registro. IPTU ausente, não confirmado e não considerado como zero declarado.",
    "Data-base usada como referência estimada de transmissão, financiamento e registro; datas contratuais pendentes.",
    "Tabela referencial ARISP/2026, ISS de 2% sobre o Oficial; cartório e ISS efetivos não confirmados.",
  ];
  const estimate = {
    mode: "automatic",
    basesConfirmed: false,
    municipality: input.municipality ?? "",
    baseDate: input.baseDate,
    policyVersion: policy.version,
    sourceVerifiedAt: policy.verifiedAt,
    validFrom: policy.registrationFrom,
    validThrough: policy.validThrough,
    sources: [...policy.sources],
    assumptions,
    inputs: {
      salePrice,
      financing,
      appraisalValue,
      income,
      firstProperty,
      naturalPerson: "SIM",
      residential: "SIM",
      program: mcmv ? "MCMV" : "NONE",
      financingSystem: "SFH",
      registryTable: "ARISP_2",
      itbiBase: salePrice,
      iptuValue: null,
    },
    pending: [
      "IPTU e base fiscal",
      "Datas e condições contratuais",
      "Enquadramento e benefícios",
      "Cartório e ISS",
    ],
  };
  const errors = [];
  if (input.municipality !== "sao-paulo-sp")
    errors.push(
      "Estimativa disponível somente para o município de São Paulo. Selecione uma unidade com município identificado; outras cidades precisam de política validada.",
    );
  if (
    !baseDate ||
    input.baseDate < policy.itbiFrom ||
    input.baseDate < policy.registrationFrom ||
    input.baseDate > policy.validThrough
  )
    errors.push(
      `Data-base fora da vigência validada: ${policy.registrationFrom} a ${policy.validThrough}.`,
    );
  if (!normalizedBusinessUnit) errors.push("Selecione Direcional ou Riva.");
  if (!["SIM", "NAO"].includes(firstProperty) || !(income > 0) || !effectiveModality)
    errors.push("Conclua as 3 perguntas do perfil.");
  for (const [value, label] of [
    [salePrice, "Venda"],
    [financing, "Financiamento"],
    [appraisalValue, "Avaliação bancária"],
  ]) {
    if (!(value > 0)) errors.push(`${label}: informe valor positivo com até duas casas decimais.`);
  }
  if (financing > salePrice && salePrice > 0)
    errors.push("Financiamento não pode superar o valor da venda.");
  if (appraisalValue > 0 && financing > round(appraisalValue * financingRate))
    errors.push(
      `Financiamento supera teto de ${Math.round(financingRate * 100)}% da avaliação bancária.`,
    );
  const purchaseFee = lookupRegistration(salePrice);
  const lienFee = lookupRegistration(financing);
  if (purchaseFee == null || lienFee == null)
    errors.push("Faixa de registro não localizada para os valores informados.");
  const audit = [
    { label: "Dados e vigência da estimativa automática", ok: errors.length === 0 },
    { label: "Bases fiscais e condições contratuais confirmadas (pendente)", ok: false },
  ];
  const common = {
    businessUnit: normalizedBusinessUnit,
    informedModality: input.modality,
    effectiveModality,
    modalityDecision,
    maximumFinancing,
    financingRate,
    incomeRange:
      income > 0 && income <= 5000
        ? 2
        : income <= 9600
          ? 3
          : income <= parameters.mcmvIncomeLimit
            ? 4
            : 0,
    propertyRange:
      salePrice > 0 && salePrice <= 275000
        ? 2
        : salePrice <= 350000
          ? 3
          : salePrice <= parameters.mcmvPropertyLimit
            ? 4
            : 99,
    normalizations: [],
    audit,
    estimate,
  };
  if (errors.length) return { ...common, ok: false, errors };

  const exempt =
    (firstProperty === "SIM" || mcmv) &&
    moneyToCents(salePrice) <= moneyToCents(policy.exemptionLimit);
  const reduced = salePrice <= policy.reducedPropertyLimit;
  const financedBase = reduced ? Math.min(financing, salePrice, policy.reducedFinancingLimit) : 0;
  const itbi = exempt
    ? 0
    : round(
        financedBase * parameters.reducedItbiRate +
          (salePrice - financedBase) * parameters.fullItbiRate,
      );
  const purchaseRegistration = mcmv
    ? round(purchaseFee * 0.5)
    : firstProperty === "SIM"
      ? round(purchaseFee * (1 - (0.5 * financing) / salePrice))
      : purchaseFee;
  const lienRegistration = mcmv || firstProperty === "SIM" ? round(lienFee * 0.5) : lienFee;
  const totalRegistration = round(purchaseRegistration + lienRegistration);
  const totalCash = round(
    parameters.dispatchFee + itbi + totalRegistration + parameters.caixaInsurance,
  );
  const installments =
    normalizedBusinessUnit === "Direcional"
      ? parameters.direcionalInstallments
      : parameters.rivaInstallments;
  const factor = Math.pow(1 + parameters.monthlyInterest, installments);
  const installmentValue = round(
    totalCash * ((parameters.monthlyInterest * factor) / (factor - 1)),
  );
  let firstInstallmentDate;
  for (let offset = 0; offset <= parameters.firstInstallmentWindowDays; offset += 1) {
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() + offset);
    if (parameters.validDueDays.includes(date.getUTCDate()))
      firstInstallmentDate = date.toISOString().slice(0, 10);
  }
  return {
    ...common,
    ok: true,
    modalityForced: input.modality !== effectiveModality,
    financingUsage: financing / appraisalValue,
    financingHeadroom: maximumFinancing - financing,
    itbi,
    itbiRule: exempt
      ? "Isenção SP/2026 estimada pelo perfil; depende de comprovação e declaração de isenção."
      : reduced
        ? "SP/2026 estimado: 0,5% sobre financiamento até R$ 120.968,00 e 3% sobre o restante da base estimada."
        : "SP/2026 estimado: 3% sobre a base estimada, sem alíquota reduzida.",
    registrationRule: mcmv
      ? "ARISP/2026 referencial: redução estimada de 50% por ato no MCMV, sem acumular benefícios."
      : firstProperty === "SIM"
        ? "ARISP/2026 referencial, primeira aquisição SFH estimada: redução de 50% na proporção financiada da compra e de 50% na garantia; arredondamento ao centavo no fim de cada ato."
        : "ARISP/2026 referencial: compra e garantia sem redução estimada.",
    registrationCombined: false,
    legalPolicyVersion: policy.version,
    legalSources: [...policy.sources],
    legalWarnings: [
      "Estimativa automática, sem confirmação fiscal ou aprovação bancária. Não substitui guia da Prefeitura ou orçamento do cartório.",
      ...assumptions,
      "Certidões, averbações e outros atos não estão incluídos. Benefícios especiais, FAR/FDS e recursos FGTS fora do MCMV exigem análise específica.",
    ],
    purchaseRegistration,
    lienRegistration,
    totalRegistration,
    dispatchFee: parameters.dispatchFee,
    caixaInsurance: parameters.caixaInsurance,
    totalCash,
    installments,
    installmentValue,
    firstInstallmentDate,
    firstInstallmentCorrected: false,
  };
}
