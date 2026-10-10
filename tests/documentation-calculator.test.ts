import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentationArchive } from "../app/(protected)/app/simulacao/_components/DocumentationArchive";
import { DocumentationCalculator } from "../app/(protected)/app/simulacao/_components/archive-investor/DocumentationCalculator";
import { calculateDocumentation } from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import { documentationInput, documentationLegalContext } from "./fixtures/documentation-input";

const input = documentationInput();

describe("documentation financial cases with confirmed SP/2026 legal context", () => {
  it("preserves the exempt MCMV result, Price installment and first due date", () => {
    expect(calculateDocumentation(input)).toMatchObject({
      ok: true,
      itbi: 0,
      totalRegistration: 2235.79,
      totalCash: 3535.79,
      dispatchFee: 300,
      caixaInsurance: 1000,
      installments: 40,
      installmentValue: 118.19,
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
        legalContext: documentationLegalContext({ program: "NONE", firstAcquisition: "NAO" }),
      }),
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
    expect(
      calculateDocumentation(documentationInput({ salePrice: 245527.77 }, { itbiBase: 245527.77 })),
    ).toMatchObject({
      ok: true,
      itbi: 0,
    });
    expect(
      calculateDocumentation(documentationInput({ salePrice: 245527.78 }, { itbiBase: 245527.78 })),
    ).toMatchObject({
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
    ).toMatchObject({
      ok: false,
      errors: [
        "Confira os valores da compra e do financiamento.",
        "Financiamento não pode superar o valor da venda.",
      ],
    });
  });
});

describe("documentation heading composition", () => {
  it("keeps the calculator hero enabled by default and supports an explicit opt-out", () => {
    const defaultMarkup = renderToStaticMarkup(
      createElement(DocumentationCalculator, { baseDate: input.baseDate }),
    );
    const embeddedMarkup = renderToStaticMarkup(
      createElement(DocumentationCalculator, {
        baseDate: input.baseDate,
        showHeroHeading: false,
      }),
    );

    expect(defaultMarkup).toContain("documentation-page-hero");
    expect(defaultMarkup.match(/<h1\b/g)).toHaveLength(1);
    expect(embeddedMarkup).toContain("documentation-page-hero");
    expect(embeddedMarkup).toContain("documentation-flow");
    expect(embeddedMarkup.match(/<h1\b/g)).toBeNull();
  });

  it("renders one page heading when the calculator is embedded in the archive", () => {
    const markup = renderToStaticMarkup(createElement(DocumentationArchive));

    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain("<h1>Calcular documentação</h1>");
  });
});
