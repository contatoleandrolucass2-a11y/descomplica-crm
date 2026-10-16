import assert from "node:assert/strict";
import { test } from "node:test";
import { RANKING_SCOPE, validateRankingScopeRequirements } from "./ranking-scope.mjs";

// Synthetic metadata references only. No real Qlik field mapping or records.
function proposal() {
  return {
    tenant: "direcional.us.qlikcloud.com",
    appId: "00171c17-48de-4488-b1f9-dd6dcb0249e2",
    organizationField: {
      id: "synthetic-field-1",
      name: "SyntheticOrganization",
      evidenceRef: "fixture:field",
    },
    selection: {
      fieldId: "synthetic-field-1",
      fieldName: "SyntheticOrganization",
      values: ["DIRECIONAL VENDAS SPC"],
      evidenceRef: "fixture:selection",
    },
    coverage: {
      organization: "DIRECIONAL VENDAS SPC",
      selectionApplied: true,
      complete: true,
      paginationComplete: true,
      timedOut: false,
      broadTotals: false,
      receivedRows: 2,
      totalRows: 2,
      evidenceRef: "fixture:coverage",
    },
  };
}

function rejects(value, issue) {
  const result = validateRankingScopeRequirements(value);
  assert.equal(result.requirementsMet, false);
  assert.ok(result.issues.includes(issue));
  assert.equal(result.productionMappingVerified, false);
  assert.equal(result.collectionAuthorized, false);
}

test("fixed candidate contract never asserts production mapping or collection approval", () => {
  assert.ok(Object.isFrozen(RANKING_SCOPE));
  assert.equal(RANKING_SCOPE.appMappingStatus, "candidate_unverified");
  assert.deepEqual(validateRankingScopeRequirements(proposal()), {
    requirementsMet: true,
    issues: [],
    productionMappingVerified: false,
    collectionAuthorized: false,
  });
});

test("rejects absent, malformed and extra manifest properties", () => {
  for (const value of [undefined, null, [], {}, "label", { ...proposal(), activate: true }]) {
    rejects(value, "invalid_manifest");
  }
  const value = proposal();
  Object.defineProperty(value, "tenant", {
    get() {
      throw new Error("must not execute");
    },
  });
  rejects(value, "invalid_manifest");
});

test("requires the fixed tenant and candidate app exactly", () => {
  for (const tenant of ["other.qlikcloud.com", "https://direcional.us.qlikcloud.com", ""]) {
    rejects({ ...proposal(), tenant }, "tenant_mismatch");
  }
  rejects({ ...proposal(), appId: "another-app" }, "candidate_app_mismatch");
});

test("display label alone is not organization field evidence", () => {
  for (const field of [
    null,
    { name: RANKING_SCOPE.organization },
    { id: "x", name: "Organization", evidenceRef: "" },
  ]) {
    rejects({ ...proposal(), organizationField: field }, "organization_field_evidence_required");
  }
});

test("rejects missing, partial, alternative and multiple organization selections", () => {
  for (const values of [
    undefined,
    [],
    ["DIRECIONAL"],
    ["OTHER"],
    [RANKING_SCOPE.organization, "OTHER"],
    [RANKING_SCOPE.organization, RANKING_SCOPE.organization],
    [` ${RANKING_SCOPE.organization}`],
    [RANKING_SCOPE.organization.toLowerCase()],
  ]) {
    const value = proposal();
    value.selection.values = values;
    rejects(value, "exact_organization_selection_required");
  }
  rejects({ ...proposal(), selection: null }, "exact_organization_selection_required");
});

test("selection must match both documented field identity and name", () => {
  for (const key of ["fieldId", "fieldName"]) {
    const value = proposal();
    value.selection[key] = "different-field";
    rejects(value, "selection_field_mismatch");
  }
  const value = proposal();
  value.selection.evidenceRef = "";
  rejects(value, "selection_evidence_required");
});

test("rejects accessors in selection values without executing them", () => {
  const value = proposal();
  Object.defineProperty(value.selection.values, "0", {
    get() {
      throw new Error("must not execute");
    },
  });
  rejects(value, "exact_organization_selection_required");
});

test("rejects incomplete pagination, timeouts, broad totals and non-boolean flags", () => {
  for (const [key, invalid] of [
    ["complete", false],
    ["paginationComplete", false],
    ["timedOut", true],
    ["broadTotals", true],
    ["complete", "true"],
    ["paginationComplete", 1],
    ["timedOut", undefined],
  ]) {
    const value = proposal();
    value.coverage[key] = invalid;
    rejects(value, "incomplete_or_broad_coverage");
  }
});

test("requires scoped coverage evidence, not only selected filter evidence", () => {
  rejects({ ...proposal(), coverage: null }, "coverage_evidence_required");
  for (const [key, invalid] of [
    ["organization", "ALL"],
    ["selectionApplied", false],
  ]) {
    const value = proposal();
    value.coverage[key] = invalid;
    rejects(value, "coverage_scope_mismatch");
  }
  const value = proposal();
  value.coverage.evidenceRef = "";
  rejects(value, "coverage_evidence_required");
});

test("requires matching safe nonnegative counts; complete empty scope is not a timeout", () => {
  for (const count of [-1, 1, 2.5, "2", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const value = proposal();
    value.coverage.receivedRows = count;
    rejects(value, "incomplete_or_broad_coverage");
  }
  const value = proposal();
  value.coverage.receivedRows = value.coverage.totalRows = 0;
  assert.equal(validateRankingScopeRequirements(value).requirementsMet, true);
});

test("returns fixed diagnostics only and does not mutate the proposal", () => {
  const value = proposal();
  const original = structuredClone(value);
  const result = validateRankingScopeRequirements(value);
  assert.deepEqual(value, original);
  assert.equal(JSON.stringify(result).includes("fixture:"), false);
});
