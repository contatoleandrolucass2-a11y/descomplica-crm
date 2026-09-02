import { calculateDocumentation } from "./documentation-calculator-rules.mjs";
import {
  evaluateFinancingModality,
  moneyToCents,
  MCMV_PROPERTY_LIMIT_CENTS,
} from "./financing-modality-rules.mjs";

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateAssociativeDocumentationView(input) {
  const reportedAppraisal = finiteNumber(input.reportedAppraisal);
  const appraisalOverride = finiteNumber(input.appraisalOverride);
  const financing = finiteNumber(input.financing);
  const income = finiteNumber(input.income);
  const appraisalFromReport = reportedAppraisal > 0;
  const appraisalValue = appraisalFromReport ? reportedAppraisal : appraisalOverride;
  const manualPreference = Object.prototype.hasOwnProperty.call(input, "manualModalityPreference")
    ? input.manualModalityPreference
    : input.modality;
  const modalityDecision = evaluateFinancingModality({
    familyIncomeCents: moneyToCents(income),
    firstProperty: input.firstProperty,
    manualPreference,
    propertyValueCents: moneyToCents(input.salePrice),
    mcmvPropertyLimitCents: MCMV_PROPERTY_LIMIT_CENTS,
  });
  const effectiveModality = modalityDecision.effectiveModality ?? "";
  const profileReady = income > 0 && Boolean(effectiveModality) && Boolean(input.firstProperty);
  const result = calculateDocumentation({
    businessUnit: input.businessUnit,
    modality: effectiveModality,
    firstProperty: input.firstProperty,
    salePrice: input.salePrice,
    appraisalValue,
    financing,
    income,
    baseDate: input.baseDate,
    requestedFirstInstallment: "",
  });
  const missingItems = [
    !profileReady ? "Conclua as 3 perguntas do perfil" : "",
    financing <= 0 ? "Informe o financiamento na proposta" : "",
    appraisalValue <= 0 ? "Informe a avaliação bancária" : "",
  ].filter(Boolean);
  const status = result.ok ? "ready" : missingItems.length > 0 ? "waiting" : "blocked";

  return {
    appraisalFromReport,
    appraisalValue,
    missingItems,
    result,
    status,
    statusLabel:
      status === "ready"
        ? "Calculado"
        : status === "waiting"
          ? "Aguardando dados"
          : "Revisar proposta",
    modalityDecision,
  };
}
