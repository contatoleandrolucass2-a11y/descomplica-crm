import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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
const helper = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "parkingSpacesLabel",
);
if (!helper) throw new Error("Missing parking formatter");
const fragments: string[] = [];
function visit(node: ts.Node) {
  if (
    ts.isConditionalExpression(node) &&
    ["annualMode", "showParking"].includes(node.condition.getText(source)) &&
    node.whenTrue.getText(source).includes("parkingSpacesLabel(item.parkingSpaces)")
  )
    fragments.push(node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const render = fragments.map(
  (fragment) =>
    new Function(
      "React",
      "item",
      "annualMode",
      "showParking",
      ts.transpileModule(`${helper!.getText(source)}\nreturn (${fragment});`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
      }).outputText,
    ),
);

describe("Associative parking display", () => {
  it("covers both the stock row and selected property description", () =>
    expect(render).toHaveLength(2));
  it.each([0, 1, 2])("preserves the actual parking count %s in both locations", (parkingSpaces) => {
    for (const fragment of render)
      expect(
        renderToStaticMarkup(
          fragment(React, { product: "Unidade sintética", parkingSpaces }, true, true),
        ),
      ).toContain(`VAGA: ${parkingSpaces}`);
  });
  it.each([null, undefined, -1, 1.5, NaN, Infinity, "1", ""])(
    "does not turn missing or invalid parking %s into zero",
    (parkingSpaces) => {
      for (const fragment of render)
        expect(
          renderToStaticMarkup(
            fragment(React, { product: "Unidade sintética", parkingSpaces }, true, true),
          ),
        ).toContain("VAGA: Não informada");
    },
  );
  it("keeps the other simulator variants unchanged", () => {
    for (const fragment of render)
      expect(
        renderToStaticMarkup(
          fragment(React, { product: "Unidade sintética", parkingSpaces: 1 }, false, false),
        ),
      ).not.toContain("VAGA:");
  });
});
