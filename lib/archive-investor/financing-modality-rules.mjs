export const MCMV_RULE_VERSION = "MCMV_2026_04_01";
export const MCMV_INCOME_LIMIT_CENTS = 1_300_000;
export const MCMV_PROPERTY_LIMIT_CENTS = 60_000_000;

export const MCMV_INCOME_BANDS = Object.freeze([
  Object.freeze({ id: "FAIXA_1", label: "Faixa 1", minimumCents: 1, maximumCents: 320_000 }),
  Object.freeze({ id: "FAIXA_2", label: "Faixa 2", minimumCents: 320_001, maximumCents: 500_000 }),
  Object.freeze({ id: "FAIXA_3", label: "Faixa 3", minimumCents: 500_001, maximumCents: 960_000 }),
  Object.freeze({ id: "CLASSE_MEDIA", label: "Classe Média", minimumCents: 960_001, maximumCents: MCMV_INCOME_LIMIT_CENTS }),
]);

function validPositiveCents(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function normalizeFirstProperty(value) {
  if (value === true || value === "SIM") return true;
  if (value === false || value === "NAO") return false;
  return null;
}

function normalizeManualPreference(value) {
  if (value === "MCMV") return "MCMV";
  if (value === "SBPE") return "SBPE";
  return null;
}

export function moneyToCents(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  if (typeof value !== "string") return null;
  let normalized = value.trim().replace(/^R\$\s*/i, "").replace(/[\s\u00a0]/g, "");
  if (!normalized) return null;
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function evaluateFinancingModality({
  familyIncomeCents,
  firstProperty,
  manualPreference = null,
  propertyValueCents = null,
  mcmvPropertyLimitCents = null,
}) {
  const normalizedFirstProperty = normalizeFirstProperty(firstProperty);
  const normalizedPreference = normalizeManualPreference(manualPreference);
  if (!validPositiveCents(familyIncomeCents)) {
    return Object.freeze({
      effectiveModality: null,
      eligibleForMcmv: false,
      mcmvRange: null,
      mcmvRangeLabel: null,
      forced: false,
      selectionSource: null,
      reasonCodes: Object.freeze(["INVALID_INCOME"]),
      ruleVersion: MCMV_RULE_VERSION,
    });
  }

  const band = MCMV_INCOME_BANDS.find(({ maximumCents }) => familyIncomeCents <= maximumCents) ?? null;
  const reasons = [];
  if (familyIncomeCents > MCMV_INCOME_LIMIT_CENTS) reasons.push("INCOME_ABOVE_MCMV_LIMIT");
  if (normalizedFirstProperty === false) reasons.push("NOT_FIRST_PROPERTY");
  if (
    validPositiveCents(propertyValueCents)
    && validPositiveCents(mcmvPropertyLimitCents)
    && propertyValueCents > mcmvPropertyLimitCents
  ) reasons.push("PROPERTY_ABOVE_MCMV_LIMIT");

  const forced = reasons.length > 0;
  const effectiveModality = forced ? "SBPE" : normalizedPreference ?? "MCMV";
  return Object.freeze({
    effectiveModality,
    eligibleForMcmv: !forced,
    mcmvRange: band?.id ?? null,
    mcmvRangeLabel: band?.label ?? null,
    forced,
    selectionSource: forced || !normalizedPreference ? "automatic" : "manual",
    reasonCodes: Object.freeze(reasons),
    ruleVersion: MCMV_RULE_VERSION,
  });
}
