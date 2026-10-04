import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  inventoryIdentityKey,
  uniqueInventoryReferences,
} from "@/lib/archive-investor/inventory-reference";

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
const declarations = [
  "normalize",
  "inventoryProjectKey",
  "inferLocation",
  "inferUnitType",
  "enrichInventory",
].map((name) => {
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  if (!declaration) throw new Error(`Missing actual inventory function: ${name}`);
  return declaration.getText(source);
});
const compiled = ts.transpileModule(`${declarations.join("\n")}\nreturn enrichInventory;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

type Unit = {
  id: string;
  businessUnit: string;
  project: string;
  identifier: string | null;
  product: string;
  finalPrice: number;
  appraisal: number | null;
  progress: number | null;
  completionDate: string | null;
};

const enrichInventory = new Function("inventoryIdentityKey", "uniqueInventoryReferences", compiled)(
  inventoryIdentityKey,
  uniqueInventoryReferences,
) as (items: Unit[], reference: Unit[]) => Unit[];

const missingFacts = { appraisal: null, progress: null, completionDate: null };
const current: Unit = {
  id: "synthetic-live-0715",
  businessUnit: "Riva",
  project: "Estilo Lapa",
  identifier: "BL02-0715",
  product: "Apartamento BL02-0715 - Estilo Lapa",
  finalPrice: 240_000,
  ...missingFacts,
};
const ownReference: Unit = {
  ...current,
  id: "synthetic-reference-0715",
  finalPrice: 230_000,
  appraisal: 350_000,
  progress: 0.42,
  completionDate: "2028-12-30",
};
// Identical project spelling exercises the literal project lookup in the JSX.
const neighbor: Unit = {
  ...ownReference,
  id: "synthetic-reference-0716",
  identifier: "BL02-0716",
  product: "Apartamento BL02-0716 - Estilo Lapa",
  appraisal: 470_000,
  progress: 0.81,
  completionDate: "2030-06-30",
};

describe("actual JSX inventory enrichment", () => {
  it("never borrows appraisal, progress or delivery from a neighboring unit in the same literal project", () => {
    expect(enrichInventory([current], [neighbor])[0]).toMatchObject({
      ...current,
      ...missingFacts,
    });
  });

  it.each([false, true])(
    "keeps missing own-reference facts missing with the neighbor last: %s",
    (neighborLast) => {
      const emptyReference = { ...ownReference, ...missingFacts };
      const references = neighborLast ? [emptyReference, neighbor] : [neighbor, emptyReference];
      expect(enrichInventory([current], references)[0]).toMatchObject(missingFacts);
    },
  );

  it("fills all three facts from the unique unit even when a different neighbor is last", () => {
    expect(enrichInventory([current], [ownReference, neighbor])[0]).toMatchObject({
      id: current.id,
      finalPrice: current.finalPrice,
      appraisal: 350_000,
      progress: 0.42,
      completionDate: "2028-12-30",
    });
  });

  it("rejects duplicate unit references instead of borrowing project facts", () => {
    const duplicate = { ...ownReference, id: "synthetic-reference-duplicate", progress: 0.63 };
    expect(enrichInventory([current], [ownReference, duplicate, neighbor])[0]).toMatchObject(
      missingFacts,
    );
  });

  it("rejects duplicate live identities instead of borrowing project facts", () => {
    const duplicate = { ...current, id: "synthetic-live-duplicate" };
    const enriched = enrichInventory([current, duplicate], [ownReference, neighbor]);
    expect(enriched).toHaveLength(2);
    for (const item of enriched) expect(item).toMatchObject(missingFacts);
  });

  it.each([null, "", "   "])(
    "does not borrow facts without a unit identifier: %j",
    (identifier) => {
      const missingIdentity = { ...current, identifier };
      expect(enrichInventory([missingIdentity], [ownReference, neighbor])[0]).toMatchObject(
        missingFacts,
      );
    },
  );

  it("preserves reported live appraisal, zero progress and an explicit divergent delivery date", () => {
    const reported = {
      ...current,
      appraisal: 360_000,
      progress: 0,
      completionDate: "2035-12-30",
    };
    expect(enrichInventory([reported], [ownReference, neighbor])[0]).toMatchObject(reported);
  });

  it("keeps facts absent when neither source reports them, without deriving appraisal from price", () => {
    const emptyReference = { ...ownReference, ...missingFacts };
    expect(enrichInventory([current], [emptyReference])[0]).toMatchObject({
      ...missingFacts,
      finalPrice: 240_000,
    });
  });
});
