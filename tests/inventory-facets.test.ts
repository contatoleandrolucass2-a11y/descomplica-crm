import { describe, expect, it } from "vitest";
// @ts-expect-error -- Shared archive module is JavaScript.
import * as investorFilters from "@/lib/archive-investor/investor-filter-options.mjs";
import { resolveInvestorRegion } from "@/lib/archive-investor/investor-region.mjs";

const { buildInvestorFilterOptions, matchesInvestorFilters } = investorFilters;

const inventory = Array.from({ length: 60 }, (_, i) => ({
  businessUnit: i % 2 ? "Riva" : "Direcional",
  project: `Projeto ${i % 5}`,
  plant: i % 7 ? `${(i % 3) + 1} quartos` : null,
  region: i % 2 ? "Zona Sul" : "Centro",
  finalPrice: i % 11 ? ((i % 4) + 1) * 100_000 : null,
}));
const dimensions = {
  businessUnit: "businessUnits",
  project: "projects",
  plant: "plants",
  region: "regions",
  salePrice: "salePrices",
};

describe("single-pass inventory facets", () => {
  it("preserves every chained count, including null prices and unavailable combinations", () => {
    for (const businessUnit of ["Todas", "Riva", "Direcional", "missing"]) {
      for (const project of ["Todos", "Projeto 1", "Projeto 2"]) {
        for (const region of ["Todas", "Zona Sul", "Centro"]) {
          for (const plant of ["Todos", "1 quartos", "2 quartos"]) {
            for (const salePrice of ["Todos", "100000", "400000"]) {
              const filters = { businessUnit, project, region, plant, salePrice };
              const result = buildInvestorFilterOptions(inventory, filters);
              for (const [dimension, key] of Object.entries(dimensions)) {
                const compatible = inventory.filter((item) =>
                  matchesInvestorFilters(item, filters, dimension),
                );
                const counts = new Map<string, number>();
                for (const item of compatible) {
                  const value =
                    dimension === "salePrice"
                      ? item.finalPrice
                        ? String(item.finalPrice)
                        : null
                      : dimension === "region"
                        ? resolveInvestorRegion(item)
                        : item[dimension as "businessUnit" | "project" | "plant"];
                  if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
                }
                expect(result.totals[dimension]).toBe(compatible.length);
                expect(
                  new Map(
                    result[key].map((option: { value: string; count: number }) => [
                      option.value,
                      option.count,
                    ]),
                  ),
                ).toEqual(counts);
              }
            }
          }
        }
      }
    }
  });
});
