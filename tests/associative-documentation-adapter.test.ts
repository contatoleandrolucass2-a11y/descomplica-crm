import { describe, expect, it } from "vitest";
import * as associativeDocumentationAdapter from "@/lib/archive-investor/associative-documentation-adapter.mjs";
import { calculateDocumentation } from "@/lib/archive-investor/documentation-calculator-rules.mjs";
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

  it("does not infer a municipality when legal context and selected city are absent", () => {
    const view = calculateAssociativeDocumentationView({ ...input, legalContext: undefined });
    expect(view).toMatchObject({ status: "waiting", result: { ok: false } });
    expect(view.missingItems).toContain("Selecione uma unidade com município identificado");
    if (view.result.ok) throw new Error("Expected blocked result");
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
      if (view.result.ok) throw new Error("Expected blocked result");
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

describe("automatic Associativo documentation estimates", () => {
  const input = {
    ...documentationInput(),
    legalContext: undefined,
    municipality: "sao-paulo-sp",
    reportedAppraisal: 250000,
    appraisalOverride: 0,
  };

  it("estimates the ARISP golden case without manufacturing fiscal confirmation", () => {
    const original = structuredClone(input);
    const view = calculateAssociativeDocumentationView(input);
    expect(view).toMatchObject({
      status: "ready",
      statusLabel: "Estimativa automática",
      estimate: {
        mode: "automatic",
        basesConfirmed: false,
        policyVersion: "sp-capital-2026.1",
        sourceVerifiedAt: "2026-10-22",
        inputs: { iptuValue: null, registryTable: "ARISP_2", itbiBase: 240000 },
      },
      result: {
        ok: true,
        itbi: 0,
        purchaseRegistration: 1273.71,
        lienRegistration: 962.08,
        totalRegistration: 2235.79,
        totalCash: 3535.79,
        dispatchFee: 300,
        caixaInsurance: 1000,
        installments: 40,
        installmentValue: 118.19,
        firstInstallmentDate: "2027-01-15",
      },
    });
    expect(view.estimate?.assumptions.join(" ")).toContain("IPTU ausente, não confirmado");
    expect(view.estimate?.sources).toContain(
      "https://arisp.com.br/wp-content/uploads/2026/01/2.pdf",
    );
    expect(view.result.audit.some(({ ok }) => !ok)).toBe(true);
    expect(input).toEqual(original);
    const strictInput = documentationInput();
    delete strictInput.legalContext;
    expect(calculateDocumentation(strictInput).ok).toBe(false);
  });

  it.each([
    [245527.77, 0],
    [245527.78, 4341.63],
    [725808, 18750.04],
    [725808.01, 21774.24],
  ])("preserves the ITBI boundary at %s", (salePrice, itbi) => {
    expect(
      calculateAssociativeDocumentationView({ ...input, salePrice, reportedAppraisal: 1000000 })
        .result,
    ).toMatchObject({ ok: true, itbi });
  });

  it("preserves proportional first-acquisition SFH and Riva Price payments", () => {
    const sfh = calculateAssociativeDocumentationView({
      ...input,
      manualModalityPreference: "SBPE",
    });
    expect(sfh.result).toMatchObject({
      ok: true,
      effectiveModality: "SBPE",
      purchaseRegistration: 1528.45,
      lienRegistration: 962.08,
      totalRegistration: 2490.53,
    });
    expect(sfh.estimate?.inputs).toMatchObject({ program: "NONE", financingSystem: "SFH" });
    expect(
      calculateAssociativeDocumentationView({
        ...input,
        businessUnit: "Riva",
        firstProperty: false,
        financing: 201000,
      }).result,
    ).toMatchObject({
      ok: true,
      effectiveModality: "SBPE",
      itbi: 4175.8,
      totalRegistration: 4887.35,
      totalCash: 10363.15,
      installments: 36,
      installmentValue: 374.65,
    });
  });

  it.each(["", "other", "campinas-sp", "sao-paulo-rj", "SP"])(
    "does not apply capital policy to municipality %s",
    (municipality) => {
      const view = calculateAssociativeDocumentationView({ ...input, municipality });
      expect(view.result.ok).toBe(false);
      expect(view.result).not.toHaveProperty("totalCash");
      expect(view.estimate?.basesConfirmed).toBe(false);
    },
  );

  it.each(["2026-01-07", "2027-01-01", "2026-02-29", "2026-04-31", ""])(
    "blocks absent or invalid policy date %s",
    (baseDate) => {
      expect(calculateAssociativeDocumentationView({ ...input, baseDate }).result.ok).toBe(false);
    },
  );

  it.each(["2026-01-08", "2026-12-31"])("accepts inclusive policy date %s", (baseDate) => {
    expect(calculateAssociativeDocumentationView({ ...input, baseDate }).result.ok).toBe(true);
  });

  it.each([null, {}, { basesConfirmed: false }, documentationLegalContext({ iptuValue: "" })])(
    "keeps supplied incomplete fiscal context strict: %j",
    (legalContext) => {
      const view = calculateAssociativeDocumentationView({ ...input, legalContext });
      expect(view.result.ok).toBe(false);
      expect(view.result).not.toHaveProperty("totalCash");
      expect(view.estimate).toBeNull();
    },
  );

  it("does not retain an earlier estimate after invalid input or a different municipality", () => {
    const first = calculateAssociativeDocumentationView(input);
    for (const change of [
      { municipality: "other" },
      { financing: 200000.01 },
      { income: 0 },
      { firstProperty: "" },
      { salePrice: 240000.001 },
      { reportedAppraisal: 0 },
    ]) {
      expect(calculateAssociativeDocumentationView({ ...input, ...change }).result.ok).toBe(false);
    }
    expect(calculateAssociativeDocumentationView({ ...input, financing: 200000 }).result.ok).toBe(
      true,
    );
    expect(calculateAssociativeDocumentationView(input)).toEqual(first);
  });

  it.each(["MCMV", "SBPE"])(
    "matches strict-engine money and dates under equivalent explicit assumptions (%s)",
    (modality) => {
      for (const salePrice of [
        230520, 230520.01, 245527.77, 245527.78, 350000, 600000, 600000.01,
      ]) {
        const automatic = calculateAssociativeDocumentationView({ ...input, modality, salePrice });
        const strict = calculateDocumentation(
          documentationInput(
            { modality, salePrice },
            {
              itbiBase: salePrice,
              program: automatic.modalityDecision.effectiveModality === "MCMV" ? "MCMV" : "NONE",
            },
          ),
        );
        expect(automatic.result.ok).toBe(true);
        expect(strict.ok).toBe(true);
        if (!automatic.result.ok || !strict.ok) throw new Error("Expected comparable results");
        for (const key of [
          "itbi",
          "purchaseRegistration",
          "lienRegistration",
          "totalRegistration",
          "totalCash",
          "installments",
          "installmentValue",
          "firstInstallmentDate",
          "maximumFinancing",
        ] as const)
          expect(automatic.result[key], `${modality}/${salePrice}/${key}`).toEqual(strict[key]);
      }
    },
  );
});
