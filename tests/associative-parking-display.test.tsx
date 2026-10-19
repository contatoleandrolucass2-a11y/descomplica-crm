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
const helpers = source.statements.filter(
  (node) =>
    ts.isFunctionDeclaration(node) &&
    ["parkingSpacesValue", "parkingSpacesLabel"].includes(node.name?.text ?? ""),
);
if (helpers.length !== 2) throw new Error("Missing parking formatters");
const fragments = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isConditionalExpression(node)) {
    const fragment = node.getText(source);
    if (fragment.includes("investor-stock-parking-heading")) fragments.set("header", fragment);
    if (fragment.includes("parkingSpacesValue(item.parkingSpaces)"))
      fragments.set("stock", fragment);
    if (fragment.includes("parkingSpacesLabel(item.parkingSpaces)"))
      fragments.set("summary", fragment);
  }
  ts.forEachChild(node, visit);
}
visit(source);
type ParkingFragment = (
  react: typeof React,
  item: { product?: string; parkingSpaces?: unknown },
  annualMode: boolean,
  showParking: boolean,
) => React.ReactNode;
const render = Object.fromEntries(
  [...fragments].map(([location, fragment]) => [
    location,
    new Function(
      "React",
      "item",
      "annualMode",
      "showParking",
      ts.transpileModule(
        `${helpers.map((helper) => helper.getText(source)).join("\n")}\nreturn (${fragment});`,
        {
          compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
        },
      ).outputText,
    ),
  ]),
) as Record<"header" | "stock" | "summary", ParkingFragment>;

describe("Associative parking display", () => {
  it("covers the dedicated stock column and selected property description", () =>
    expect(Object.keys(render).sort()).toEqual(["header", "stock", "summary"]));
  it("labels the dedicated column as Vaga only in the Associative simulator", () => {
    expect(renderToStaticMarkup(render.header(React, {}, true, true))).toBe(
      '<th class="investor-stock-parking-heading">Vaga</th>',
    );
    expect(renderToStaticMarkup(render.header(React, {}, false, false))).toBe("");
  });
  it.each([0, 1, 2])("preserves the actual parking count %s in both locations", (parkingSpaces) => {
    expect(
      renderToStaticMarkup(
        render.stock(React, { product: "Unidade sintética", parkingSpaces }, true, true),
      ),
    ).toBe(`<td class="investor-stock-parking" data-label="Vaga">${parkingSpaces}</td>`);
    expect(
      renderToStaticMarkup(
        render.summary(React, { product: "Unidade sintética", parkingSpaces }, true, true),
      ),
    ).toContain(`VAGA: ${parkingSpaces}`);
  });
  it.each([null, undefined, -1, 1.5, NaN, Infinity, "1", ""])(
    "does not turn missing or invalid parking %s into zero",
    (parkingSpaces) => {
      expect(
        renderToStaticMarkup(
          render.stock(React, { product: "Unidade sintética", parkingSpaces }, true, true),
        ),
      ).toContain("Não informada");
      expect(
        renderToStaticMarkup(
          render.summary(React, { product: "Unidade sintética", parkingSpaces }, true, true),
        ),
      ).toContain("VAGA: Não informada");
    },
  );
  it("keeps the other simulator variants unchanged", () => {
    for (const fragment of Object.values(render))
      expect(
        renderToStaticMarkup(
          fragment(React, { product: "Unidade sintética", parkingSpaces: 1 }, false, false),
        ),
      ).not.toContain("VAGA:");
  });
});
