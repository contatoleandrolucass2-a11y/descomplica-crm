import { describe, expect, it } from "vitest";
import { calculateDocumentation } from "@/lib/archive-investor/documentation-calculator-rules.mjs";

const input = {
  businessUnit: "Direcional",
  modality: "MCMV",
  firstProperty: "SIM",
  salePrice: 240000,
  appraisalValue: 250000,
  financing: 192000,
  income: 5000,
  baseDate: "2026-10-02",
};

describe("documentation replica financial cases from the reference", () => {
  it("preserves the exempt MCMV result, Price installment and first due date", () => {
    expect(calculateDocumentation(input)).toMatchObject({
      ok: true,
      itbi: 0,
      totalRegistration: 2651.99,
      totalCash: 3951.99,
      installments: 40,
      installmentValue: 132.1,
      firstInstallmentDate: "2027-01-15",
    });
  });
  it("uses Riva's 36 installments and SBPE without first-property benefits", () => {
    expect(
      calculateDocumentation({
        ...input,
        businessUnit: "Riva",
        firstProperty: "NAO",
        income: "",
        financing: 201000,
      }),
    ).toMatchObject({
      ok: true,
      effectiveModality: "SBPE",
      itbi: 4175.8,
      totalRegistration: 4710.41,
      totalCash: 10186.21,
      installments: 36,
      installmentValue: 368.26,
    });
  });
  it("accepts the financing ceiling exactly and refuses a cent above it", () => {
    expect(calculateDocumentation({ ...input, financing: 200000 }).ok).toBe(true);
    expect(calculateDocumentation({ ...input, financing: 200000.01 })).toMatchObject({
      ok: false,
      errors: ["Financiamento supera teto de 80% da avaliação bancária."],
    });
  });
  it("requires income for MCMV and preserves the optional SBPE income", () => {
    expect(calculateDocumentation({ ...input, income: "" })).toMatchObject({
      ok: false,
      errors: ["Informe a renda para validar cenário MCMV."],
    });
    expect(calculateDocumentation({ ...input, income: "", modality: "SBPE" }).ok).toBe(true);
  });
  it("preserves the ITBI exemption boundary without rounding it up", () => {
    expect(calculateDocumentation({ ...input, salePrice: 245527.77 })).toMatchObject({
      ok: true,
      itbi: 0,
    });
    expect(calculateDocumentation({ ...input, salePrice: 245527.78 })).toMatchObject({
      ok: true,
      itbi: 4341.63,
    });
  });
  it("switches above the income ceiling and never finances above sale price", () => {
    expect(calculateDocumentation({ ...input, income: 13000.01 })).toMatchObject({
      ok: true,
      effectiveModality: "SBPE",
      modalityForced: true,
    });
    expect(
      calculateDocumentation({ ...input, appraisalValue: 400000, financing: 240000.01 }),
    ).toMatchObject({ ok: false, errors: ["Financiamento não pode superar o valor da venda."] });
  });
});
