import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @ts-expect-error — módulo de regras preservado do artefato anexado em JavaScript.
import { calculateInvestorFlow } from "@/lib/archive-investor/investor-calculator-rules.mjs";
// @ts-expect-error — módulo de filtros preservado do artefato anexado em JavaScript.
import { isInvestorEligibleUnit } from "@/lib/archive-investor/investor-filter-options.mjs";

const baseFlow = {
  selectedUnitId: "stock-2",
  baseDate: "2026-08-06",
  completionDate: "2028-12-31",
  salePrice: 400_000,
  discountAuthorized: false,
  discount: 0,
  entryValue: 40_000,
  installments: 18,
  signals: [0, 0, 0],
  intermediaries: [0, 0, 0],
};
const privateSnapshotUrl = new URL("../private-data/investor-inventory.json", import.meta.url);
const itWithPrivateSnapshot = existsSync(privateSnapshotUrl) ? it : it.skip;

describe("Tabela Investidor do arquivo anexado", () => {
  it("publica o conteúdo completo na rota protegida e no item correto do menu", () => {
    const page = readFileSync(
      new URL("../app/(protected)/app/simulacao/[simulator]/page.tsx", import.meta.url),
      "utf8",
    );
    const archive = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/InvestorTableArchive.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const menu = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/SiteMenu.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const calculator = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/InvestorCalculator.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(page).toContain('if (simulator === "tabela-investidor")');
    expect(page).toContain("<InvestorTableArchive />");
    expect(archive).toContain("investor-standard-table-page");
    expect(archive).toContain("<InvestorCalculator />");
    expect(archive).toContain("<InvestorLearningManual />");
    expect(archive).toContain("Simulador Tabela Investidor");
    expect(menu).toContain('href="/app/simulacao/tabela-investidor"');
    expect(menu).not.toContain('href="/simulacao/tabela-investidor?ficha=3"');
    expect(calculator).toContain("const inventoryWindowSize = 60");
    expect(calculator).toContain("aria-rowcount={matchingInventory.length + 1}");
    expect(calculator).toContain('className="investor-stock-spacer"');
    expect(calculator).toContain("if (!inventoryInteractionStarted.current)");
  });

  it("mantém as oito opções e fecha o valor do imóvel no centavo", () => {
    const result = calculateInvestorFlow(baseFlow);

    expect(result.ok).toBe(true);
    expect(result.standardScenarios.map((scenario: { code: string }) => scenario.code)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
    ]);
    expect(
      result.standardScenarios.every(
        (scenario: {
          entry: number;
          signalTotal: number;
          intermediaryTotal: number;
          balance: number;
        }) =>
          Math.round(
            (scenario.entry +
              scenario.signalTotal +
              scenario.intermediaryTotal +
              scenario.balance) *
              100,
          ) === Math.round(baseFlow.salePrice * 100),
      ),
    ).toBe(true);
  });

  itWithPrivateSnapshot("valida o snapshot completo e exclui somente vagas avulsas", () => {
    const payload = JSON.parse(readFileSync(privateSnapshotUrl, "utf8")) as {
      count: number;
      items: Array<{
        id: string;
        product: string;
        unitType: string | null;
        finalPrice: number | null;
        completionDate: string | null;
      }>;
    };
    const eligible = payload.items.filter(isInvestorEligibleUnit);

    expect(payload.count).toBe(payload.items.length);
    expect(payload.items).toHaveLength(3_301);
    expect(new Set(payload.items.map((item) => item.id)).size).toBe(3_301);
    expect(eligible).toHaveLength(3_179);
    expect(
      eligible.every(
        (item) =>
          item.unitType?.toLocaleLowerCase("pt-BR") !== "vaga de garagem" &&
          !item.product.toLocaleLowerCase("pt-BR").startsWith("vaga de garagem"),
      ),
    ).toBe(true);
    expect(
      payload.items.filter(
        (item) => !Number.isFinite(item.finalPrice) || Number(item.finalPrice) <= 0,
      ),
    ).toHaveLength(314);
    expect(payload.items.filter((item) => !item.completionDate)).toHaveLength(0);
  });
});
