import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const rules = createRequire(import.meta.url)(
  "../lib/archive-investor/associative-approval-rules.mjs",
);
const source = ts.createSourceFile(
  "InvestorCalculator.tsx",
  readFileSync(
    new URL(
      "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const declaration = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "AssociativeApprovalPanel",
);
if (!declaration) throw new Error("Missing actual approval panel");
const compiled = ts.transpileModule(
  `${declaration.getText(source)}; return AssociativeApprovalPanel;`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
const dependencies = {
  React,
  useRef: () => ({ current: null }),
  useState: () => [{}, () => {}],
  calculateAssociativeApproval: rules.calculateAssociativeApproval,
  ASSOCIATIVE_APPROVAL_TIERS: rules.ASSOCIATIVE_APPROVAL_TIERS,
  money: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
  percent: new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 }),
  formatPaymentDate: (date: string) => date || "",
  InvestorInfoHint: () => null,
};
const Panel = new Function(...Object.keys(dependencies), compiled)(
  ...Object.values(dependencies),
) as (props: Record<string, unknown>) => ReactNode;
const props = {
  tierId: "gold",
  onTierChange: () => {},
  income: 5000,
  realSaleValue: 231990,
  proSoluto: 40990,
  linearInstallment: 601.8,
  decreasingInstallment: 828.54,
  linearMaximumIncomePayment: null,
  decreasingMaximumIncomePayment: null,
  comparisonReady: false,
  installmentComparisonReady: true,
  comparisonUnavailableReason: "Andamento da obra não informado no estoque desta unidade.",
  proposalValid: true,
  financingReady: true,
  entryPending: false,
  entryRejected: false,
  currentSignalPayments: [],
  currentAnnualPayments: [],
  releaseStatus: { repasse: { status: "released", reason: "Sinais abaixo de 5% do VGV." } },
};

describe("Associativo approval rendering with partial calculation", () => {
  it("fails closed even when a ready flag contradicts missing amounts", () => {
    const html = renderToStaticMarkup(Panel({ ...props, comparisonReady: true }));
    expect(html).toContain("PENDENTE");
    expect(html).not.toContain(">APROVADO<");
    expect(html).not.toContain(">REPROVADO<");
    expect(html.match(/Não calculado: dados incompletos/g)).toHaveLength(2);
  });

  it("shows known commitment, unknown maximum as unavailable, and blocks approval", () => {
    const html = renderToStaticMarkup(Panel(props));
    expect(html).toContain("12,04%");
    expect(html).toContain("16,57%");
    expect(html.match(/Não calculado: dados incompletos/g)).toHaveLength(2);
    expect(html).toContain("Andamento da obra não informado");
    expect(html).toContain("PENDENTE");
    expect(html).not.toContain(">APROVADO<");
    expect(html).not.toContain(">0%<");
    expect(html).not.toContain("Aguarde o cálculo");
    expect(html).not.toContain("failed-value");
  });

  it("does not turn a valid zero installment into an unavailable metric", () => {
    const html = renderToStaticMarkup(
      Panel({ ...props, linearInstallment: 0, decreasingInstallment: 0 }),
    );
    expect(html.match(/>0%</g)).toHaveLength(2);
    expect(html.match(/Não calculado: dados incompletos/g)).toHaveLength(2);
  });

  it("shows both maximum rates and approval only with complete validated data", () => {
    const html = renderToStaticMarkup(
      Panel({
        ...props,
        comparisonReady: true,
        linearMaximumIncomePayment: 2101.8,
        decreasingMaximumIncomePayment: 2328.54,
      }),
    );
    expect(html).toContain("42,04%");
    expect(html).toContain("46,57%");
    expect(html).toContain(">APROVADO<");
    expect(html).not.toContain("PENDENTE");
    expect(html).not.toContain("Não calculado");
  });
});
