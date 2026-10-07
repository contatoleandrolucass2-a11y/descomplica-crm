import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const { calculateInvestorFlow } = createRequire(import.meta.url)(
  "../lib/archive-investor/investor-calculator-rules.mjs",
);
const fixture = {
  selectedUnitId: "synthetic-annual-ledger",
  baseDate: "2026-10-05",
  completionDate: "2029-12-31",
  salePrice: 233444.22,
  annualMode: true,
  financing: 190000,
  income: 5000,
  entryValue: 1500,
  installments: "84",
  signals: [0, 0, 0],
  intermediaries: [0, 2450, 2450, 2450, 0],
  approvalTierId: "gold",
};

// Render the actual ledger JSX, so using the wrong engine field fails the regression.
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
let balanceRow: ts.JsxSelfClosingElement | undefined;
function visit(node: ts.Node) {
  if (
    ts.isJsxSelfClosingElement(node) &&
    node.tagName.getText(source) === "AssociativeEditableAccountRow"
  ) {
    const text = node.getText(source);
    if (text.includes('label="Saldo parcelado"') && text.includes("number={18}")) balanceRow = node;
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!balanceRow) throw new Error("Missing associative monthly balance row");
const compiled = ts.transpileModule(`return (${balanceRow.getText(source)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dependencies = {
  React,
  money,
  associativeHelp: (...lines: string[]) => lines.join("\n"),
  AssociativeEditableAccountRow: ({
    calculation,
    meta,
  }: {
    calculation: ReactNode;
    meta: string;
  }) => (
    <div>
      {calculation}
      <p>{meta}</p>
    </div>
  ),
  AssociativeMoneyValue: ({ value }: { value: number }) => <output>{money.format(value)}</output>,
};
const renderBalance = new Function("result", ...Object.keys(dependencies), compiled);

describe("Associativo annual ledger and nominal monthly principal", () => {
  it("subtracts three entered annuals in the displayed balance, not twice in the engine", () => {
    const result = calculateInvestorFlow(fixture);
    expect(result.ok).toBe(true);
    expect(result.context.balanceAfterResources).toBeCloseTo(43444.22, 8);
    expect(result.custom.balanceBeforeCorrection).toBeCloseTo(41944.22, 8);
    expect(result.custom.annualNominalTotal).toBe(7350);
    expect(result.custom.installmentNominalBalance).toBe(34594.22);
    const correctedAnnuals = [14, 26, 38].reduce(
      (sum, months) => sum + 2450 * 1.005 ** (months + 1),
      0,
    );
    expect(result.custom.linear.annualCorrectedTotal).toBeCloseTo(correctedAnnuals, 8);
    expect(result.custom.installmentBalanceBeforeCorrection).toBeCloseTo(34594.22, 8);
    // Interest starts on September 30; the first monthly is October 15, so k = 0.
    expect(result.custom.linear.firstInterestDate).toBe("2026-09-30");
    expect(result.custom.linear.firstInstallmentDate).toBe("2026-10-15");
    expect(result.custom.linear.monthlyCorrectionMonths).toBe(0);
    expect(result.custom.balance).toBeCloseTo(34594.22, 8);
    const html = renderToStaticMarkup(renderBalance(result, ...Object.values(dependencies)));
    expect(html).toContain(`<output>${money.format(34594.22)}</output>`);
    expect(html).toContain(money.format(7350));
    expect(html).toContain(money.format(result.custom.installmentBalanceBeforeCorrection));
    expect(html).not.toContain("NaN");
  });

  it.each([0, 1, 2, 3, 4, 5])(
    "reconciles %i annuals in cents with entry, signals and resources",
    (count) => {
      const annuals = [1000.01, 1000.02, 1000.03, 1000.04, 1000.05].map((value, i) =>
        i < count ? value : 0,
      );
      const result = calculateInvestorFlow({
        ...fixture,
        completionDate: "2031-12-31",
        intermediaries: annuals,
        signals: [500.01, 400.02, 300.03],
        subsidy: 1000,
        fgts: 2000,
        housingCheck: 3000,
      });
      const annualCents = annuals.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
      expect(result.ok).toBe(true);
      expect(result.custom.annualNominalTotal).toBe(annualCents / 100);
      expect(result.custom.installmentNominalBalance).toBe(
        (4344422 - 600000 - 150000 - 120006 - annualCents) / 100,
      );
      expect(Math.round(result.custom.installmentNominalBalance * 100) + annualCents).toBe(
        Math.round(result.custom.balanceBeforeCorrection * 100),
      );
      const monthlyPrincipal = (4344422 - 600000 - 150000 - 120006 - annualCents) / 100;
      expect(result.custom.installmentBalanceBeforeCorrection).toBeCloseTo(monthlyPrincipal, 8);
      expect(result.custom.linear.firstInstallmentDate).toBe("2027-01-15");
      expect(result.custom.linear.monthlyCorrectionMonths).toBe(3);
      expect(result.custom.balance).toBeCloseTo(monthlyPrincipal * 1.005 ** 3, 8);
    },
  );

  it.each([
    { baseDate: "2026-12-16", completionDate: "2029-12-31", intermediaries: [2450, 0, 0, 0, 0] },
    { baseDate: "2026-10-05", completionDate: "2027-12-14", intermediaries: [0, 2450, 0, 0, 0] },
  ])("does not subtract an annual outside the eligible calendar: %j", (patch) => {
    const result = calculateInvestorFlow({ ...fixture, ...patch });
    expect(result.ok).toBe(false);
    expect(result.custom.annualNominalTotal).toBe(0);
    expect(result.custom.installmentNominalBalance).toBeCloseTo(
      result.custom.balanceBeforeCorrection,
      8,
    );
  });

  it("restores the balance when annuals are cleared and blocks annuals covering the entire debt", () => {
    const cleared = calculateInvestorFlow({ ...fixture, intermediaries: [0, 0, 0, 0, 0] });
    expect(cleared.custom.installmentNominalBalance).toBe(41944.22);
    expect(cleared.custom.balance).toBeCloseTo(41944.22, 8);
    const exceeded = calculateInvestorFlow({ ...fixture, intermediaries: [0, 50000, 0, 0, 0] });
    expect(exceeded.ok).toBe(false);
    expect(exceeded.custom.installmentNominalBalance).toBe(0);
  });

  it("preserves a positive monthly principal when only corrected annuals exceed the debt", () => {
    const result = calculateInvestorFlow({
      ...fixture,
      income: 100000,
      intermediaries: [41800, 0, 0, 0, 0],
    });
    expect(result.ok).toBe(true);
    expect(result.custom.linear.annualCorrectedTotal).toBeGreaterThan(41944.22);
    expect(result.custom.annualNominalTotal).toBe(41800);
    expect(result.custom.installmentBalanceBeforeCorrection).toBeCloseTo(144.22, 8);
    expect(result.custom.installmentNominalBalance).toBe(144.22);
    expect(result.custom.balance).toBeCloseTo(144.22, 8);
  });
});
