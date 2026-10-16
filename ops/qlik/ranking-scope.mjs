// Offline requirements only: evidence references are supplied, not authenticated here.
// This module neither approves production mapping nor authorizes collection.
export const RANKING_SCOPE = Object.freeze({
  tenant: "direcional.us.qlikcloud.com",
  candidateAppId: "00171c17-48de-4488-b1f9-dd6dcb0249e2",
  appMappingStatus: "candidate_unverified",
  organization: "DIRECIONAL VENDAS SPC",
});

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => keys.includes(key)) &&
    keys.every((key) => Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"))
  );
}

function identifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function rowCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Checks a proposed manifest, not Qlik data or the truth of its evidence.
 * fieldId/name must come from documented source metadata, never a UI label guess.
 * evidenceRef values must identify reviewed evidence without embedding raw records.
 * Coverage must describe the same selected organization, not app-wide totals.
 */
export function validateRankingScopeRequirements(proposal) {
  const issues = [];
  if (!exactKeys(proposal, ["tenant", "appId", "organizationField", "selection", "coverage"])) {
    issues.push("invalid_manifest");
  } else {
    if (proposal.tenant !== RANKING_SCOPE.tenant) issues.push("tenant_mismatch");
    if (proposal.appId !== RANKING_SCOPE.candidateAppId) issues.push("candidate_app_mismatch");

    const field = proposal.organizationField;
    const fieldValid =
      exactKeys(field, ["id", "name", "evidenceRef"]) &&
      identifier(field.id) &&
      identifier(field.name) &&
      identifier(field.evidenceRef);
    if (!fieldValid) issues.push("organization_field_evidence_required");

    const selection = proposal.selection;
    const selectionValid = exactKeys(selection, ["fieldId", "fieldName", "values", "evidenceRef"]);
    if (!selectionValid) {
      issues.push("exact_organization_selection_required");
    } else {
      if (!fieldValid || selection.fieldId !== field.id || selection.fieldName !== field.name) {
        issues.push("selection_field_mismatch");
      }
      if (!identifier(selection.evidenceRef)) issues.push("selection_evidence_required");
      if (
        !Array.isArray(selection.values) ||
        selection.values.length !== 1 ||
        Object.getOwnPropertyDescriptor(selection.values, "0")?.value !== RANKING_SCOPE.organization
      ) {
        issues.push("exact_organization_selection_required");
      }
    }

    const coverage = proposal.coverage;
    if (
      !exactKeys(coverage, [
        "organization",
        "selectionApplied",
        "complete",
        "paginationComplete",
        "timedOut",
        "broadTotals",
        "receivedRows",
        "totalRows",
        "evidenceRef",
      ])
    ) {
      issues.push("coverage_evidence_required");
    } else {
      if (
        coverage.organization !== RANKING_SCOPE.organization ||
        coverage.selectionApplied !== true
      ) {
        issues.push("coverage_scope_mismatch");
      }
      if (!identifier(coverage.evidenceRef)) issues.push("coverage_evidence_required");
      if (
        coverage.complete !== true ||
        coverage.paginationComplete !== true ||
        coverage.timedOut !== false ||
        coverage.broadTotals !== false ||
        !rowCount(coverage.receivedRows) ||
        !rowCount(coverage.totalRows) ||
        coverage.receivedRows !== coverage.totalRows
      ) {
        issues.push("incomplete_or_broad_coverage");
      }
    }
  }
  return {
    requirementsMet: issues.length === 0,
    issues,
    productionMappingVerified: false,
    collectionAuthorized: false,
  };
}
