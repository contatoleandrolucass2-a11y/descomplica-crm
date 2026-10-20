import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssociativePrintSheet } from "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator";

const source = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
    import.meta.url,
  ),
  "utf8",
);
const styles = readFileSync(
  new URL(
    "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
    import.meta.url,
  ),
  "utf8",
);
const { calculateInvestorFlow } = createRequire(import.meta.url)(
  "../lib/archive-investor/investor-calculator-rules.mjs",
);
const printProps = {
  businessUnit: "Direcional",
  project: "Residencial Exemplo",
  unit: "Bloco 01 - 101",
  baseDate: "2026-10-19",
  income: 4_000,
  valueReal: 238_500,
  financing: 210_000,
  subsidy: 0,
  fgts: 0,
  housingCheck: 0,
  balanceAfterResources: 28_500,
  entry: { date: "2026-10-19", value: 1_000 },
  signals: [
    { index: 1, date: "2026-11-19", value: 500, approved: true },
    { index: 2, date: "2026-12-19", value: 600, approved: true },
  ],
  annuals: [
    {
      index: 1,
      date: "2027-10-19",
      value: 1_000,
      correctedValue: 1_080,
      approved: true,
    },
    {
      index: 2,
      date: "2028-10-19",
      value: 1_000,
      correctedValue: 1_166.4,
      approved: true,
    },
  ],
  installments: 84,
  linearUncorrected: 296.43,
  linearCorrected: 427.5,
  linearFirstDate: "2026-11-15",
  linearLastDate: "2033-10-15",
  blocks: [
    {
      label: "40%",
      count: 21,
      uncorrectedInstallment: 474.29,
      correctedInstallment: 503.31,
      firstInstallmentDate: "2026-11-15",
      lastInstallmentDate: "2028-07-15",
    },
    {
      label: "30%",
      count: 21,
      uncorrectedInstallment: 355.71,
      correctedInstallment: 442.27,
      firstInstallmentDate: "2028-08-15",
      lastInstallmentDate: "2030-04-15",
    },
    {
      label: "20%",
      count: 21,
      uncorrectedInstallment: 237.14,
      correctedInstallment: 399.93,
      firstInstallmentDate: "2030-05-15",
      lastInstallmentDate: "2032-01-15",
    },
    {
      label: "10%",
      count: 21,
      uncorrectedInstallment: 118.57,
      correctedInstallment: 272.68,
      firstInstallmentDate: "2032-02-15",
      lastInstallmentDate: "2033-10-15",
    },
  ],
};

describe("impressão A4 do Associativo", () => {
  it("oferece ações independentes para linear e escalonado", () => {
    expect(source).toContain(">Imprimir linear</button>");
    expect(source).toContain(">Imprimir escalonado</button>");
    expect(source).toContain('printAssociativeFlow("linear")');
    expect(source).toContain('printAssociativeFlow("decreasing")');
    expect(source).toContain("disabled={!associativePaymentSummaryAvailable}");
  });

  it("mantém entrada, sinais e anuais em linhas independentes", () => {
    expect(source).toContain("label: `Sinal ${payment.index}`");
    expect(source).toContain("label: `Anual ${payment.index}`");
    expect(source).toContain('label: "Entrada"');
    expect(source).toContain("label: `Mensais - Escalonado ${block.label}`");
    expect(source).toContain('label: "Mensais - Linear 100%"');
  });

  it("renderiza somente o fluxo selecionado com pagamentos independentes", () => {
    const linear = renderToStaticMarkup(
      createElement(AssociativePrintSheet, { ...printProps, mode: "linear" }),
    );
    const escalonado = renderToStaticMarkup(
      createElement(AssociativePrintSheet, { ...printProps, mode: "decreasing" }),
    );

    expect(linear).toContain("Associativo - Fluxo linear");
    expect(linear).toContain("Mensais - Linear 100%");
    expect(linear).not.toContain("Mensais - Escalonado 40%");
    expect(linear.match(/Saldo após recursos/gu)).toHaveLength(1);
    expect(linear).not.toContain("Total das parcelas");
    expect(linear).toContain("Total com correção");
    expect(escalonado).toContain("Associativo - Fluxo escalonado");
    expect(escalonado).not.toContain("Mensais - Linear 100%");
    for (const label of ["Sinal 1", "Sinal 2", "Anual 1", "Anual 2"]) {
      expect(linear).toContain(label);
      expect(escalonado).toContain(label);
    }
    for (const percentage of ["40%", "30%", "20%", "10%"]) {
      expect(escalonado).toContain(`Mensais - Escalonado ${percentage}`);
    }
  });

  it("usa somente os quatro blocos oficiais calculados pelo motor", () => {
    const result = calculateInvestorFlow({
      selectedUnitId: "print-fixture",
      baseDate: "2026-10-19",
      completionDate: "2030-01-01",
      salePrice: 238_500,
      financing: 210_000,
      income: 4_000,
      entryValue: 1_000,
      installments: "84",
      annualMode: true,
      signals: [0, 0, 0],
      intermediaries: [0, 0, 0, 0, 0],
      approvalTierId: "gold",
    });

    expect(result.custom.decreasing.ok).toBe(true);
    expect(result.custom.decreasing.blocks.map((block: { label: string }) => block.label)).toEqual([
      "40%",
      "30%",
      "20%",
      "10%",
    ]);
    expect(
      result.custom.decreasing.blocks.reduce(
        (total: number, block: { count: number }) => total + block.count,
        0,
      ),
    ).toBe(84);
  });

  it("isola uma folha A4 e preserva cores na impressão", () => {
    expect(styles).toMatch(/\.investor-associative-print-sheet\s*\{\s*display:\s*none;/u);
    expect(styles).toMatch(/@page\s*\{[\s\S]*?size:\s*A4 portrait;/u);
    expect(styles).toContain("body:has(.investor-associative-print-sheet) *");
    expect(styles).toContain("position: fixed;");
    expect(styles).toContain(
      ".investor-page-shell .investor-direct-resource-actions.investor-associative-resource-actions {\n  grid-template-columns:repeat(6,minmax(0,1fr));",
    );
    expect(styles).toContain("width: 190mm;");
    expect(styles).toContain("min-height: 277mm;");
    expect(styles).toContain("print-color-adjust: exact;");
  });
});
