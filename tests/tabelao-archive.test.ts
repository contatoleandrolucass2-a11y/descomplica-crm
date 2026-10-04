import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getProtectedPageGate } from "@/lib/authorization/page-gates";
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
    expect(page).toContain('getProtectedPageGate("/app/simulacao/tabelao")?.releaseEnabled');
    expect(page).toContain("forbidden()");
    expect(page).toContain('alternates: { canonical: "/app/simulacao/tabelao" }');
    expect(page).toContain("<TabelaoArchive />");
    expect(getProtectedPageGate("/app/simulacao/tabelao")).toEqual({
      pageKey: "crm.simulation.tabelao",
      path: "/app/simulacao/tabelao",
      permission: "crm.simulators.view",
      releaseEnabled: true,
    });
    expect(archive).toContain(
      'className="app-shell simulation-page-shell investor-page-shell tabelao-page-shell"',
    );
    expect(archive).not.toContain("ArchiveHeader");
    expect(archive).not.toContain("SiteMenu");
    expect(archive).toContain('className="goal-page-hero investor-compact-hero"');
    expect(archive).toContain("<h1>Simulador Tabelão</h1>");
    expect(archive).toContain("<InvestorInfoHint");
    expect(archive).toContain("<InvestorGuideLauncher compact />");
    expect(archive).not.toMatch(/documentation-breadcrumb|goal-kicker/);
    expect(archive).toContain('import "./archive-investor/tabelao-layout.css"');
    expect(archive).toContain("<TabelaoClient />");
    expect(archive).toContain("<TabelaoResources />");
    expect(archive.indexOf("<TabelaoResources />")).toBeGreaterThan(
      archive.indexOf("<TabelaoClient />"),
    );
    expect(archive.indexOf("<TabelaoResources />")).toBeLessThan(
      archive.indexOf('className="investor-page-closing"'),
    );
    expect(archive).toContain('className="investor-page-footer"');
    expect(client).toContain('fetchInventoryPayload("/api/inventory"');
    expect(client).not.toContain("investor-inventory.json");
    expect(client).not.toContain("isInvestorEligibleUnit");
    expect(client).toContain("Nenhuma fonte alternativa foi usada");
    expect(client).toContain('document.querySelector<HTMLElement>("[data-protected-topbar]")');
    expect(client).toContain('shell?.querySelector<HTMLElement>(":scope > .topbar")');
    expect(rootLayout).toContain("suppressHydrationWarning");
    expect(cookieBanner).not.toContain("ARCHIVE_SIMULATOR_ROUTES");
    expect(protectedShell).toContain("data-protected-shell");
    expect(protectedShell).not.toContain("usePathname");
    expect(authorizedBreadcrumbs).not.toContain("ARCHIVE_SIMULATOR_ROUTES");
  });

  it("preserva sete selects e quatorze colunas compactas", () => {
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

    const visibleColumnLabels = [
      "Região",
      "Empresa",
      "Empreendimento",
      "Endereço",
      "Metragem",
      "Entrega",
      "Planta",
      "Vagas",
      "Estoque",
      "% obra",
      "Limitador",
      "Volta ao Caixa",
      "Avaliação",
      "Valor do Imóvel",
    ];
    const tableHeaderSource = client.slice(client.indexOf("<thead>"), client.indexOf("</thead>"));
    const renderedColumnLabels = [
      ...tableHeaderSource.matchAll(/<th[^>]*>\s*([^<]+?)\s*<\/th>/g),
    ].map((match) => match[1]?.trim() ?? "");

    expect(renderedColumnLabels).toEqual(visibleColumnLabels);
    for (const label of visibleColumnLabels) {
      expect(client).toContain(`data-label="${label}"`);
    }
    const renderedCellLabels = [...client.matchAll(/data-label="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(renderedCellLabels).toEqual(visibleColumnLabels);
    const columnSource = client.slice(client.indexOf("<colgroup>"), client.indexOf("</colgroup>"));
    expect(
      [...columnSource.matchAll(/<col className="([^"]+)"/g)].map((match) => match[1]),
    ).toEqual([
      "tabelao-stock-col-region",
      "investor-stock-col-business",
      "tabelao-stock-col-project",
      "tabelao-stock-col-address",
      "investor-stock-col-area",
      "investor-stock-col-date",
      "investor-stock-col-plant",
      "tabelao-stock-col-parking",
      "tabelao-stock-col-quantity",
      "tabelao-stock-col-progress",
      "tabelao-stock-col-description",
      "tabelao-stock-col-cashback",
      "tabelao-stock-col-appraisal",
      "investor-stock-col-price",
    ]);
    for (const accessibleLabel of [
      "Data de entrega",
      "Unidades no estoque publicado",
      "Menor valor do imóvel",
      "Folga volta ao caixa",
      "Valor de avaliação bancária",
      "Logradouro da obra / Número / Bairro",
      "Total do andamento da obra (%)",
      "Outras descrições",
      "Quantidade de vagas",
    ]) {
      expect(tableHeaderSource).toContain(`aria-label="${accessibleLabel}"`);
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
      "Empresa",
      "Nome do empreendimento",
      "Região",
      "Valor do imóvel",
      "Ordenar valor",
      "Limpar filtros",
      "Quantidade de vagas",
    ]) {
      expect(filters).toContain(label);
    }
    expect(filters).toContain('className="investor-stock-filters"');
    expect(filters).toContain("disabled={disabled}");
    expect(filters).toContain('{ dimension: "plant", label: "Planta", all: "Todas" }');
    expect(filters).toContain('name="priceOrder"');
    expect(filters.match(/\{ dimension: "/g)).toHaveLength(6);
    expect(filters.match(/<select\b/g)).toHaveLength(2);
    expect(filters).toContain("{fields.map(");
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
    expect(client).toContain("buildTabelaoExclusiveInventory(inventoryWithRegions)");
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
    expect(client.match(/colSpan=\{14\}/g)).toHaveLength(3);
    expect(client).toContain('item.parkingSpaces ?? "Não informado"');
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
    expect(client).toContain('className="tabelao-stock-col-quantity"');
    expect(client).toContain('className="tabelao-stock-col-address"');
    expect(styles).toContain(
      ".tabelao-page-shell .investor-stock-table tbody td.tabelao-stock-area",
    );
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-panel > \.investor-section-heading\s*\{[^}]*height: auto !important;[^}]*min-height: 48px !important;/,
    );
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-table\s*\{[^}]*width: 100%;[^}]*min-width: 1100px;[^}]*table-layout: fixed;/,
    );
    const columnWidths = [
      ...styles.matchAll(
        /\.tabelao-page-shell \.investor-stock-table \.[\w-]+-col-[\w-]+\s*\{\s*width: ([\d.]+)%;\s*\}/g,
      ),
    ].map((match) => Number(match[1]));
    expect(columnWidths).toHaveLength(14);
    expect(columnWidths.reduce((total, width) => total + width, 0)).toBe(100);
    expect(styles).toMatch(
      /\.investor-page-shell\.tabelao-page-shell \.investor-stock-table :is\(th, td\)\s*\{[^}]*font-size: var\(--tabelao-cell-font-size\) !important;[^}]*text-align: center;[^}]*vertical-align: middle;/,
    );
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-table\s*\{[^}]*--tabelao-cell-font-size: 11px;/,
    );
    expect(styles).not.toContain("--tabelao-cell-font-size: 12px;");
    expect(styles).toMatch(
      /\.investor-page-shell\.tabelao-page-shell \.investor-stock-table thead th\s*\{[^}]*white-space: nowrap;[^}]*text-transform: none;/,
    );
    for (const [column, width] of [
      ["tabelao-stock-col-region", "4.5"],
      ["investor-stock-col-area", "6"],
      ["investor-stock-col-plant", "6.5"],
      ["tabelao-stock-col-parking", "4"],
      ["tabelao-stock-col-quantity", "5"],
    ]) {
      expect(styles).toContain(
        `.tabelao-page-shell .investor-stock-table .${column} { width: ${width}%; }`,
      );
    }
    expect(styles).not.toContain("font-size: 6px !important;");
    expect(styles).not.toContain("font-size: 4px !important;");
    expect(styles).not.toContain("min-width: 2080px");
    expect(styles).not.toMatch(
      /\.tabelao-page-shell \.investor-stock-table\s*\{[^}]*width: max-content;/,
    );
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

  it("formata apenas a apresentação das plantas e descrições, preservando agrupamento e nomes próprios", () => {
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
    expect(client).toContain('className="tabelao-stock-plant-text"');
    expect(client).toContain("{formatTabelaoPlant(item.plant)}");
    expect(client).toContain("title={informationLabel(item.plant)}");
    expect(client).toContain("group.items.map((item) => descriptiveLabel(item.classification))");
    expect(client).toMatch(
      /const classification = formatTabelaoDescription\(\s*descriptiveLabel\(item.classification\),?\s*\)/,
    );
    expect(client).toContain(
      'return normalized && normalized !== "0" ? normalized : "Não informado"',
    );
    expect(client).toContain("{group.businessUnit}");
    expect(client).toContain("{group.project}");
    expect(client).toContain("formatTabelaoAddress as formatAddress");
    expect(client).not.toContain("function formatAddress(");
    expect(filters).toContain('dimension === "plant"');
    expect(filters).toContain("formatTabelaoDescription(item.label)");
    expect(filters).toContain("value={item.value}");
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-table \.tabelao-stock-plant-text\s*\{[^}]*white-space: pre-line;/,
    );
  });

  it("compacta textos completos e mescla apenas células consecutivas dentro do projeto", () => {
    const client = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoClient.tsx", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(client).toMatch(
      /addressSpans: buildTabelaoCellSpans\(\s*group\.items\.map\(\(item\) =>\s*JSON\.stringify\(\[formatAddress\(item\), buildTabelaoMapsUrl\(item\)\]\),?\s*\),?\s*\)/,
    );
    expect(client).toContain("buildTabelaoCellSpans(group.items.map(resolveTabelaoRegion))");
    expect(client).toContain("const regionSpan = group.regionSpans[itemIndex] ?? 1");
    expect(client).toContain("rowSpan={regionSpan}");
    expect(client).toContain("regionSpan > 0");
    expect(client).toMatch(/<td\s+className="tabelao-stock-long-text"\s+data-label="Região"/);
    expect(client).toContain("title={formatRegionTitle(item)}");
    expect(client).toContain("data-inventory-region={resolveTabelaoRegion(item)}");
    expect(client).toContain("group.items.map((item) => descriptiveLabel(item.classification))");
    expect(client).toContain("const addressSpan = group.addressSpans[itemIndex] ?? 1");
    expect(client).toContain(
      "const classificationSpan = group.classificationSpans[itemIndex] ?? 1",
    );
    expect(client).toContain("rowSpan={addressSpan}");
    expect(client).toContain("rowSpan={classificationSpan}");
    expect(client).toContain("addressSpan > 0");
    expect(client).toContain("classificationSpan > 0");
    expect(client).toContain("<TabelaoRegionLabel region={region} />");
    expect(client).toContain('<span className="sr-only">{region}</span>');
    expect(client).toContain('className="tabelao-region-vertical" aria-hidden="true"');
    expect(client).toContain('region.split(" ").map((word)');
    expect(styles).toMatch(
      /\.tabelao-page-shell \.tabelao-region-vertical > span\s*\{[^}]*writing-mode: vertical-lr;[^}]*text-orientation: upright;/,
    );
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-results\s*\{[^}]*width: calc\(100% - 48px\);[^}]*max-width: calc\(100% - 48px\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\)\s*\{\s*\.tabelao-page-shell \.investor-stock-results\s*\{[^}]*width: calc\(100% - 28px\);[^}]*max-width: calc\(100% - 28px\);/,
    );
    expect(styles).toMatch(
      /\.tabelao-group-cell \.investor-stock-product-text\s*\{[^}]*width: 100%;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/,
    );
    expect(styles).toMatch(
      /\.tabelao-page-shell \.investor-stock-table \.tabelao-stock-wrapped-text\s*\{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*overflow: visible;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/,
    );
  });

  it("combina regiões sem substituir estoque, complementar endereço ou redefinir filtros", () => {
    const client = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoClient.tsx", import.meta.url),
      "utf8",
    );
    const regionLoad = client.slice(
      client.indexOf("void loadTabelaoRegions("),
      client.indexOf("} catch (error)"),
    );
    expect(regionLoad).toContain("controller.signal");
    expect(regionLoad).toContain("if (!active) return");
    expect(regionLoad).toContain("new Map(current).set(postalCode, resolution)");
    expect(regionLoad).not.toMatch(/setInventory|setFilters|clearFilters|setLoadState/);
    expect(client.indexOf('setLoadState("ready")')).toBeLessThan(
      client.indexOf("void loadTabelaoRegions("),
    );
    expect(client).toContain("[inventory, regionResolutions]");
    expect(client).toContain("const postalCode = normalizeTabelaoPostalCode(item.postalCode)");
    expect(client).toMatch(
      /return \{\s*\.\.\.item,\s*regionResolution: regionResolutions.get\(postalCode \?\? ""\) \?\? null,/,
    );
    expect(client).toContain(
      "regionLookupPending: postalCode !== null && !regionResolutions.has(postalCode)",
    );
    expect(client).not.toContain("?? item.regionResolution");
    expect(client).toContain("active = false;");
    expect(client).toContain("controller.abort();");
    expect(client).toContain("}, [loadKey]);");
  });

  it("mantém o cabeçalho original sob a navegação e limpa observadores ao desmontar", () => {
    const client = readFileSync(
      new URL("../app/(protected)/app/simulacao/_components/TabelaoClient.tsx", import.meta.url),
      "utf8",
    );
    const styles = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(client).toContain("ref={stockTable}");
    expect(client).toContain('querySelector<HTMLElement>(":scope > .topbar")');
    expect(client).toContain("window.requestAnimationFrame(updateHeading)");
    expect(client).toContain(
      "Math.min(top - headingRect.top, tableRect.bottom - headingRect.bottom)",
    );
    expect(client).toContain("new ResizeObserver(scheduleHeading)");
    expect(client).toContain(
      'window.addEventListener("scroll", scheduleHeading, { capture: true, passive: true })',
    );
    expect(client).toContain('window.removeEventListener("scroll", scheduleHeading, true)');
    expect(client).toContain("observer.disconnect()");
    expect(client).toContain("window.cancelAnimationFrame(frame)");
    expect(client).toContain('table.style.removeProperty("--tabelao-heading-offset")');
    expect(client).not.toContain("cloneNode");
    expect(styles).toMatch(
      /\.investor-page-shell\.tabelao-page-shell \.investor-stock-table thead th\s*\{[^}]*transform: translateY\(var\(--tabelao-heading-offset, 0px\)\);/,
    );
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

  it("amplia as provas DOM sem alterar os vinte critérios publicados do Tabelão", () => {
    const script = readFileSync(
      new URL("../scripts/qa/authenticated-visual.mjs", import.meta.url),
      "utf8",
    );
    const validation = script.slice(
      script.indexOf("async function checkTabelaoValidation("),
      script.indexOf("async function checkDirectTableValidation("),
    );
    const result = validation.slice(validation.lastIndexOf("  return {"));
    expect([...result.matchAll(/^    (\w+)(?=:|,)/gm)].map((match) => match[1])).toEqual([
      "responsiveGrid",
      "spotlightSized",
      "placementClassApplied",
      "guideReachedLastStep",
      "guideCompletionReturnedFocus",
      "guideEscapeReturnedFocus",
      "exclusiveRows",
      "netPrices",
      "groupedProjects",
      "liveAvailableBeforeLocationReference",
      "locationReferenceApplied",
      "locationMetadataFits",
      "malformedPayloadRecoverable",
      "malformedPayloadRetryRestoresInventory",
      "completeLiveSkipsLocationReference",
      "concurrentResponsesKeepFiltersIndependent",
      "emptyStateVisible",
      "errorStateAccessible",
      "loadingStateVisible",
      "cookieBannerHidden",
    ]);
    expect(validation).toContain("Object.assign(initial, await page.evaluate(readTabelaoLayout))");
    expect(validation).toContain("await checkTabelaoLayout(page)");
    expect(validation).toContain("await checkTabelaoMapsFixture(page)");
    expect(validation).toContain(
      "typographyAndLabels &&= Object.values(layoutAndResources).every(Boolean)",
    );
    expect(validation).toContain(
      "regionOrderAndLayout &&= Object.values(mapsDestinations).every(Boolean)",
    );
  });
});
