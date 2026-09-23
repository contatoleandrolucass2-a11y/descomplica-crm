import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// @ts-expect-error — módulo de filtros preservado da Tabela Direta em JavaScript.
import { sortInvestorInventoryBySalePrice } from "@/lib/archive-investor/investor-filter-options.mjs";

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
    expect(archive).toContain("<h1>Tabelão</h1>");
    expect(archive).toContain("Uma linha para cada unidade do estoque.");
    expect(archive).toContain("<TabelaoClient />");
    expect(client).toContain('fetch("/api/inventory"');
    expect(client).not.toContain("investor-inventory.json");
    expect(client).toContain("Nenhuma fonte alternativa foi usada");
    expect(rootLayout).toContain("suppressHydrationWarning");
    expect(protectedShell).toContain('"/app/simulacao/tabelao"');
    expect(authorizedBreadcrumbs).toContain('"/app/simulacao/tabelao"');
  });

  it("replica as sete colunas e remove resumo, filtros e KPIs", () => {
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

    for (const label of [
      "Início",
      "Incorporadora",
      "Produto",
      "Metragem",
      "Data de Entrega",
      "Planta",
      "Valor do imóvel",
    ]) {
      expect(client).toContain(`<th>${label}</th>`);
    }
    for (const removedClass of [
      "tabelao-command-bar",
      "tabelao-filters",
      "tabelao-summary",
      "tabelao-mobile-list",
    ]) {
      expect(client).not.toContain(removedClass);
      expect(styles).not.toContain(`.${removedClass}`);
    }
    expect(client).toContain("INVENTORY_WINDOW_SIZE = 60");
    expect(client).toContain('href="/app/simulacao/tabela-direta"');
    expect(styles).toContain("height:24px");
    expect(styles).toContain("font-size:10px");
    expect(styles).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("preserva cada unidade e ordena pelo valor como a Tabela Direta", () => {
    expect(
      sortInvestorInventoryBySalePrice(inventory, "asc").map((item: { id?: string }) => item.id),
    ).toEqual(["1", "2", "3"]);
  });
});
