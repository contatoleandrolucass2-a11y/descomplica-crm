import { describe, expect, it } from "vitest";
// @ts-expect-error — módulo de regras compartilhado com o componente legado em JavaScript.
import * as associativeDocumentationAdapter from "@/lib/archive-investor/associative-documentation-adapter.mjs";
import { documentationInput, documentationLegalContext } from "./fixtures/documentation-input";

const { resolveAssociativeAppraisal, calculateAssociativeDocumentationView } =
  associativeDocumentationAdapter;

describe("resolveAssociativeAppraisal", () => {
  it("sempre prioriza a avaliação oficial da unidade", () => {
    expect(resolveAssociativeAppraisal(340_000, 999_999)).toBe(340_000);
  });

  it("aceita preenchimento manual somente quando a fonte oficial não traz avaliação", () => {
    expect(resolveAssociativeAppraisal(null, 350_000)).toBe(350_000);
    expect(resolveAssociativeAppraisal(0, 350_000)).toBe(350_000);
  });

  it("não aceita valores ausentes, inválidos ou negativos", () => {
    expect(resolveAssociativeAppraisal(undefined, undefined)).toBe(0);
    expect(resolveAssociativeAppraisal(Number.NaN, "inválido")).toBe(0);
    expect(resolveAssociativeAppraisal(-1, -2)).toBe(0);
  });
});

describe("calculateAssociativeDocumentationView legal readiness", () => {
  const input = {
    ...documentationInput(),
    reportedAppraisal: 250000,
    appraisalOverride: 0,
    manualModalityPreference: "MCMV",
  };

  it("does not mark complete financial data ready without legal context", () => {
    const view = calculateAssociativeDocumentationView({ ...input, legalContext: undefined });
    expect(view).toMatchObject({ status: "waiting", result: { ok: false } });
    expect(view.missingItems).toContain("Confira e confirme os dados fiscais da documentação");
    expect(view.result.errors.length).toBeGreaterThan(0);
    expect(view.result).not.toHaveProperty("totalCash");
  });

  it("requires both appraisal and fiscal confirmation to recover the calculation", () => {
    const missing = {
      ...input,
      reportedAppraisal: 0,
      appraisalOverride: 0,
      legalContext: undefined,
    };
    expect(calculateAssociativeDocumentationView(missing)).toMatchObject({ status: "waiting" });
    expect(
      calculateAssociativeDocumentationView({ ...missing, appraisalOverride: 250000 }),
    ).toMatchObject({
      status: "waiting",
      result: { ok: false },
    });
    expect(
      calculateAssociativeDocumentationView({
        ...missing,
        appraisalOverride: 250000,
        legalContext: documentationLegalContext(),
      }),
    ).toMatchObject({
      status: "ready",
      appraisalFromReport: false,
      appraisalValue: 250000,
      result: { ok: true, itbi: 0, totalRegistration: 2235.79, totalCash: 3535.79 },
    });
  });

  it("keeps invalid confirmed conditions blocked and publishes their errors", () => {
    for (const legalContext of [
      documentationLegalContext({ municipality: "other" }),
      documentationLegalContext({ registrationDate: "2027-01-01" }),
      documentationLegalContext({ iptuValue: "" }),
    ]) {
      const view = calculateAssociativeDocumentationView({ ...input, legalContext });
      expect(view).toMatchObject({ status: "blocked", missingItems: [], result: { ok: false } });
      expect(view.result.errors.length).toBeGreaterThan(0);
      expect(view.result).not.toHaveProperty("totalCash");
    }
  });

  it("forwards legal declarations without inferring them from the commercial profile", () => {
    const view = calculateAssociativeDocumentationView({
      ...input,
      legalContext: documentationLegalContext({
        program: "NONE",
        firstAcquisition: "NAO",
        financingSystem: "SFI",
      }),
    });
    expect(view).toMatchObject({
      status: "ready",
      result: { ok: true, effectiveModality: "MCMV", itbi: 7200, totalRegistration: 4471.57 },
    });
  });

  it("clears readiness when confirmation is withdrawn and restores it only after confirmation", () => {
    const initial = calculateAssociativeDocumentationView(input);
    expect(initial.status).toBe("ready");
    const pending = calculateAssociativeDocumentationView({
      ...input,
      legalContext: documentationLegalContext({ basesConfirmed: false }),
    });
    expect(pending).toMatchObject({ status: "waiting", result: { ok: false } });
    expect(pending.result).not.toHaveProperty("totalCash");
    expect(calculateAssociativeDocumentationView(input)).toEqual(initial);
  });
});
