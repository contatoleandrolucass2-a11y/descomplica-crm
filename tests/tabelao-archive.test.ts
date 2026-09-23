import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildTabelaoExclusiveInventory,
  buildTabelaoOptions,
  matchesTabelaoFilters,
  sortTabelaoInventory,
  summarizeTabelao,
} from "@/lib/archive-investor/tabelao-inventory.mjs";

const inventory = [
  {
    id: "3",
    businessUnit: "Riva",
    project: "Bela Vista",
    product: "Apartamento 305",
    identifier: "BL-305",
    plant: "2 quartos",
    district: "Bela Vista",
    finalPrice: 420_000,
  },
  {
    id: "1",
    businessUnit: "Direcional",
    project: "Leste Park",
    product: "Apartamento 201",
    identifier: "A-201",
    plant: "1 quarto",
    district: "Itaquera",
    finalPrice: 190_000,
  },
  {
    id: "2",
    businessUnit: "Riva",
    project: "Bela Vista",
    product: "Apartamento 102",
    identifier: "BL-102",
    plant: "2 quartos",
    district: "Bela Vista",
    finalPrice: 310_000,
  },
];

describe("Tabelão protegido", () => {
  it("publica a réplica integral no caminho pedido e no item correto do menu", () => {
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
    const styles = readFileSync(
      new URL(
        "../app/(protected)/app/simulacao/_components/archive-investor/investor-archive.css",
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
    expect(archive).toContain("Sem combinações repetidas. Só a melhor referência.");
    expect(archive).toContain("<TabelaoClient />");
    expect(client).toContain('fetch("/api/inventory"');
    expect(client).not.toContain("investor-inventory.json");
    expect(client).toContain("Nenhum dado alternativo foi exibido");
    for (const label of [
      "Busca rápida",
      "Negócio",
      "Empreendimento",
      "Planta",
      "Região",
      "Menor valor",
      "Ordenar por",
    ]) {
      expect(client).toContain(label);
    }
    expect(styles).toContain(':root[data-theme="dark"] .tabelao-page-shell');
    expect(styles).toContain(
      ".tabelao-page-shell .documentation-breadcrumb a,\n.tabelao-page-shell .goal-kicker",
    );
    expect(styles).toContain(
      ".tabelao-page-shell .tabelao-unit-card dd { color:var(--tabelao-text); }",
    );
    expect(styles).toContain(".tabelao-mobile-list");
    expect(styles).toContain("@media (prefers-reduced-motion:reduce)");
    expect(rootLayout).toContain("suppressHydrationWarning");
    expect(protectedShell).toContain('"/app/simulacao/tabelao"');
    expect(authorizedBreadcrumbs).toContain('"/app/simulacao/tabelao"');
  });

  it("mantém uma combinação por empreendimento e planta com o menor preço", () => {
    const exclusive = buildTabelaoExclusiveInventory(inventory);

    expect(exclusive).toHaveLength(2);
    expect(
      exclusive.map(({ project, plant, finalPrice, availableUnits }) => ({
        project,
        plant,
        finalPrice,
        availableUnits,
      })),
    ).toEqual([
      { project: "Bela Vista", plant: "2 quartos", finalPrice: 310_000, availableUnits: 2 },
      { project: "Leste Park", plant: "1 quarto", finalPrice: 190_000, availableUnits: 1 },
    ]);
    expect(exclusive[0]!.id).toBe("2");
  });

  it("descarta chave ou preço inválido e desempata por identificador", () => {
    const exclusive = buildTabelaoExclusiveInventory([
      {
        id: "b",
        project: " Sacomã ",
        plant: " TIPO 2Q ",
        identifier: "BL02-1205",
        finalPrice: 262_000,
      },
      {
        id: "a",
        project: "Sacomã",
        plant: "TIPO 2Q",
        identifier: "BL02-1105",
        finalPrice: 262_000,
      },
      { id: "zero", project: "Sacomã", plant: "TIPO 2Q", finalPrice: 0 },
      { id: "sem-planta", project: "Sacomã", plant: "", finalPrice: 250_000 },
    ]);

    expect(exclusive).toHaveLength(1);
    expect(exclusive[0]).toMatchObject({
      id: "a",
      project: "Sacomã",
      plant: "TIPO 2Q",
      availableUnits: 2,
    });
  });

  it("combina busca, filtros, ordenação, opções e resumo no mesmo grão", () => {
    const exclusive = buildTabelaoExclusiveInventory(inventory);

    expect(
      exclusive
        .filter((item) =>
          matchesTabelaoFilters(item, {
            query: "leste",
            businessUnit: "Direcional",
            priceRange: "up-to-200",
          }),
        )
        .map((item) => item.id),
    ).toEqual(["1"]);
    expect(sortTabelaoInventory(exclusive, "price-asc").map(({ id }) => id)).toEqual(["1", "2"]);
    expect(buildTabelaoOptions(exclusive)).toMatchObject({
      businessUnits: ["Direcional", "Riva"],
      projects: ["Bela Vista", "Leste Park"],
    });
    expect(summarizeTabelao(exclusive)).toEqual({
      exclusiveOptions: 2,
      projects: 2,
      plants: 2,
      minimumPrice: 190_000,
      maximumPrice: 310_000,
    });
  });
});
