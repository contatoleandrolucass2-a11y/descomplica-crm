import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @ts-expect-error — módulo de filtros preservado da Tabela Direta em JavaScript.
import * as investorFilterOptions from "@/lib/archive-investor/investor-filter-options.mjs";

const { buildInvestorFilterOptions, matchesInvestorFilters, sortInvestorInventoryBySalePrice } =
  investorFilterOptions;

const inventory = [
  {
    id: "3",
    businessUnit: "Riva",
    project: "Bela Vista",
    product: "Apartamento 305",
    identifier: "BL-305",
    plant: "2 quartos",
    finalPrice: 420_000,
  },
  {
    id: "1",
    businessUnit: "Direcional",
    project: "Leste Park",
    product: "Apartamento 201",
    identifier: "A-201",
    plant: "1 quarto",
    finalPrice: 190_000,
  },
  {
    id: "2",
    businessUnit: "Riva",
    project: "Bela Vista",
    product: "Apartamento 102",
    identifier: "BL-102",
    plant: "2 quartos",
    finalPrice: 310_000,
  },
];

describe("Tabelão protegido", () => {
  it("mantém rota, permissão, menu e fonte oficial", () => {
    const page = readFileSync(
      new URL("../app/(protected)/app/simulacao/tabelao/page.tsx", import.meta.url),
      "utf8",
    );
    const archive = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoArchive.tsx", import.meta.url),
      "utf8",
    );
    const client = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoClient.tsx", import.meta.url),
      "utf8",
    );
    const menu = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/SiteMenu.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const cookieBanner = readFileSync(
      new URL("../app/_components/CookieConsentBanner.tsx", import.meta.url),
      "utf8",
    );
    const protectedShell = readFileSync(
      new URL("../app/(protected)/_components/ProtectedShellFrame.tsx", import.meta.url),
      "utf8",
    );
    const authorizedBreadcrumbs = readFileSync(
      new URL("../app/(protected)/_components/AuthorizedBreadcrumbs.tsx", import.meta.url),
      "utf8",
    );

    expect(page).toContain('await enforcePermission("crm.simulators.view")');
    expect(page).toContain('alternates: { canonical: "/app/simulacao/tabelao" }');
    expect(page).toContain("<TabelaoArchive />");
    expect(menu).toContain('href="/app/simulacao/tabelao"');
    expect(menu).toContain('activePathname === "/simulacao/tabelao"');
    expect(archive).toContain(
      'className="app-shell simulation-page-shell investor-page-shell tabelao-page-shell"',
    );
    expect(archive).toContain('className="goal-page-hero investor-compact-hero"');
    expect(archive).toContain("<h1>Simulador Tabelão</h1>");
    expect(archive).toContain("<InvestorInfoHint");
    expect(archive).toContain("<InvestorGuideLauncher />");
    expect(archive).toContain("<TabelaoClient />");
    expect(archive).toContain('className="investor-page-footer"');
    expect(client).toContain('fetchInventoryPayload("/api/inventory"');
    expect(client).not.toContain("investor-inventory.json");
    expect(client).not.toContain("isInvestorEligibleUnit");
    expect(client).toContain("Nenhuma fonte alternativa foi usada");
    expect(rootLayout).toContain("suppressHydrationWarning");
    expect(cookieBanner).toContain('"/app/simulacao/tabelao"');
    expect(protectedShell).toContain('"/app/simulacao/tabelao"');
    expect(authorizedBreadcrumbs).toContain('"/app/simulacao/tabelao"');
  });

  it("replica os seis filtros e preserva a densidade e as doze colunas", () => {
    const client = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoClient.tsx", import.meta.url),
      "utf8",
    );
    const filters = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoFilters.tsx", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
        import.meta.url,
      ),
      "utf8",
    );

    for (const label of [
      "Incorporadora",
      "Empreendimento",
      "Metragem",
      "Data de Entrega",
      "Planta",
      "Unidades",
      "Menor valor",
      "Folga Volta ao Caixa",
      "Valor de Avaliação Bancária",
      "Logradouro Obra / Número / Bairro",
      "Total do andamento da obra (%)",
      "Outras descrições",
    ]) {
      expect(client).toContain(label);
    }
    for (const sharedClass of [
      "investor-workspace investor-direct-workspace investor-direct-design-copy",
      "investor-stock-panel",
      "investor-section-heading",
      "investor-stock-results",
      "investor-stock-table",
    ]) {
      expect(client).toContain(sharedClass);
    }
    for (const label of [
      "Filtros do estoque",
      "Nome do Empreendimento",
      "Região",
      "Valor do Imóvel",
      "Ordenar valor",
      "Limpar filtros",
    ]) {
      expect(filters).toContain(label);
    }
    expect(filters).toContain('className="investor-stock-filters"');
    expect(filters).toContain("disabled={disabled}");
    expect(filters).toContain('name="priceOrder"');
    expect(client.indexOf("<TabelaoFilters")).toBeGreaterThan(
      client.indexOf('id="tabelao-stock-title"'),
    );
    expect(client.indexOf("<TabelaoFilters")).toBeLessThan(
      client.indexOf('className="investor-stock-results"'),
    );
    expect(client).not.toContain("Empreendimento / Unidade");
    expect(client).toContain("{group.project}");
    expect(client).not.toContain("buildInvestorFilterOptions");
    expect(client).not.toContain("matchesInvestorFilters");
    expect(client).not.toContain("reconcileInvestorFilters");
    expect(client).toContain("buildTabelaoExclusiveInventory(inventory)");
    expect(client).toContain('"/api/inventory/snapshot"');
    expect(client).toContain("enrichTabelaoLocationFields(payload.items, referencePayload.items)");
    expect(client).not.toContain("Promise.all([");
    expect(client).not.toContain("referenceRequest");
    expect(client.indexOf('setLoadState("ready")')).toBeLessThan(
      client.indexOf("void loadLocationReference(payload)"),
    );
    expect(client).toContain("setLocationReferenceMeta(inventoryMetadata(referencePayload))");
    expect(client).toContain(
      "exclusiveInventory.filter((item) => matchesTabelaoFacets(item, filters))",
    );
    expect(client).toContain('priceOrder === "desc" ? "project-desc" : "project"');
    expect(client).toContain("setFilters(TABELAO_FILTER_DEFAULTS)");
    expect(client).toContain("groupTabelaoInventoryByProject(matchingInventory)");
    expect(client).toContain("inventoryGroups.map");
    expect(client).toContain("group.items.map");
    expect(client.match(/rowSpan=\{group.items.length\}/g)).toHaveLength(2);
    expect(client.match(/scope="rowgroup"/g)).toHaveLength(2);
    expect(client).toContain('item.availableUnits.toLocaleString("pt-BR")');
    expect(client.indexOf('id="tabelao-quantity"')).toBeLessThan(
      client.indexOf('id="tabelao-price"'),
    );
    expect(client).toContain("formatMoneyValue(item.cashBackSlack)");
    expect(client).toContain("formatMoneyValue(item.appraisal)");
    expect(client).toContain("formatAddress(item)");
    expect(client).toContain("formatProgress(item.progress)");
    expect(client).toContain("descriptiveLabel(item.classification)");
    expect(client).toContain('className="tabelao-stock-area"');
    expect(client.match(/colSpan=\{12\}/g)).toHaveLength(3);
    expect(client).toContain("total + item.pricedUnits");
    expect(client).not.toContain("INVENTORY_WINDOW_SIZE");
    expect(client).not.toContain("Spacer");
    expect(client).not.toContain("onScroll=");
    expect(client).not.toContain("matchingInventory.slice");
    expect(client).not.toContain('href="/app/simulacao/tabela-direta"');
    expect(client).toContain('window.addEventListener("investor:start-guide"');
    expect(client).toContain('.join(" ")');
    expect(styles).toContain("herda integralmente o visual da Tabela Associativo");
    expect(styles).toContain("grade completa, expansiva");
    expect(styles).toContain(".tabelao-page-shell .tabelao-stock-col-quantity");
    expect(styles).toContain(".tabelao-page-shell .tabelao-stock-col-address");
    expect(styles).toContain(
      ".tabelao-page-shell .investor-stock-table tbody td.tabelao-stock-area",
    );
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-panel > \.investor-section-heading\s*\{[^}]*height: auto !important;[^}]*min-height: 48px !important;/,
    );
    expect(styles).toContain("min-width: 2080px");
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-results\s*\{[^}]*max-height: none;[^}]*overflow-x: auto;[^}]*overflow-y: visible;/,
    );
    expect(styles).toContain("height:23px!important");
    expect(styles).toContain("font-size:10px");
    expect(styles).toContain("@media (prefers-reduced-motion:reduce)");
    expect(styles).toContain("grid-template-rows: 44px 44px");
    expect(styles).toContain("min-height: 96px !important");
    expect(styles).not.toContain(".tabelao-main");
    expect(styles).not.toContain(".tabelao-hero-note");
  });

  it("preserva cada unidade, filtra e ordena com os helpers do estoque", () => {
    const allFilters = {
      businessUnit: "Todas",
      project: "Todos",
      plant: "Todos",
      region: "Todas",
      salePrice: "Todos",
    };

    expect(inventory.filter((item) => matchesInvestorFilters(item, allFilters))).toHaveLength(3);
    expect(buildInvestorFilterOptions(inventory, allFilters).totals.businessUnit).toBe(3);
    expect(
      sortInvestorInventoryBySalePrice(inventory, "asc").map((item: { id?: string }) => item.id),
    ).toEqual(["1", "2", "3"]);
    expect(
      sortInvestorInventoryBySalePrice(inventory, "desc").map((item: { id?: string }) => item.id),
    ).toEqual(["3", "2", "1"]);
  });
});
