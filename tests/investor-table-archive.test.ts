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
    expect(archive).not.toContain("<InvestorLearningManual />");
    expect(archive).toContain("Simulador Tabela Investidor");
    expect(menu).toContain('href="/app/simulacao/tabela-investidor"');
    expect(menu).not.toContain('href="/simulacao/tabela-investidor?ficha=3"');
    expect(calculator).toContain("const inventoryWindowSize = 60");
    expect(calculator).toContain("aria-rowcount={matchingInventory.length + 1}");
    expect(calculator).toContain('className="investor-stock-spacer"');
    expect(calculator).toContain("if (!inventoryInteractionStarted.current)");
    expect(calculator).toContain(
      'className="investor-direct-resource-actions investor-standard-resource-actions"',
    );
    expect(calculator).toContain("<InvestorLearningManual />");
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
      result.standardScenarios.map(
        (scenario: { installmentLimit: number }) => scenario.installmentLimit,
      ),
    ).toEqual([18, 18, 18, 18, 24, 24, 24, 24]);
    expect(
      result.standardScenarios.map((scenario: { entryRate: number }) => scenario.entryRate),
    ).toEqual([0.1, 0.06, 0.06, 0.1, 0.2, 0.17, 0.17, 0.2]);
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

  it("mostra quatro opções de 18 parcelas e quatro de 24 em duas linhas permanentes", () => {
    const calculator = readFileSync(
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
    const directArchive = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/DirectTableArchive.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(calculator).toContain('18: ["C1", "C2", "C4", "C3"]');
    expect(calculator).toContain('24: ["C5", "C6", "C8", "C7"]');
    expect(calculator).toContain('className="investor-standard-plan-picker"');
    expect(calculator).toContain('className="investor-standard-option-row"');
    expect(calculator).toContain("disabled={!scenario.available}");
    expect(calculator).not.toContain("expandedScenarioPlans");
    expect(styles).toContain(
      ".investor-page-shell.investor-standard-table-page .investor-standard-plan-picker",
    );
    expect(styles).toContain("grid-auto-flow:column");
    expect(directArchive).toContain(
      "<InvestorCalculator directTable directVisualLayout={false} />",
    );
  });

  it("compacta os cards, centraliza o detalhe completo e guia cada seleção", () => {
    const calculator = readFileSync(
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

    expect(calculator).toContain("const standardProposalSectionRef");
    expect(calculator).toContain("const standardScenarioDetailRef");
    expect(calculator).toContain("scrollToGuidedSection(standardProposalSectionRef.current)");
    expect(calculator).toContain(
      "scrollToCenteredGuidedSection(standardScenarioDetailRef.current)",
    );
    expect(calculator).toContain(
      'className="investor-standard-detail investor-guided-scroll-target"',
    );
    expect(calculator).toContain('className="investor-direct-comparison-ledger"');
    expect(calculator).toContain("payments.map((payment)");
    expect(calculator).toContain("DirectComparisonLedgerRow");
    expect(calculator).toContain("label: `${scenario.installments} parcelas mensais`");
    expect(styles).toContain(
      ".investor-page-shell.investor-standard-table-page .investor-standard-option-row > button",
    );
    expect(styles).toContain("min-height: 88px");
    expect(styles).toContain(
      ".investor-page-shell.investor-standard-table-page .investor-standard-detail",
    );
    expect(styles).toContain("width: 50%");
    expect(calculator).toContain(
      'className="investor-associative-ledger investor-standard-editable-ledger"',
    );
    expect(calculator).toContain('label="Resultado da proposta"');
    expect(calculator).toContain('id="investor-entry-meta"');
    expect(calculator).toContain("Redistribuir sinais automaticamente");
    expect(calculator).toContain(
      "disabled={visibleScenarioCodes.length === 0 || associativeCalculatedProposalLocked}",
    );
    expect(calculator).not.toContain(
      "!directTable && !annualMode ? <section className={`investor-result-panel",
    );
    expect(calculator).toContain("Doc Pessoa Jurídica</button>");
    expect(styles).toContain(
      ".investor-page-shell.investor-standard-table-page .investor-standard-resource-actions",
    );
    expect(styles).toContain("@media (min-width: 1101px)");
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
