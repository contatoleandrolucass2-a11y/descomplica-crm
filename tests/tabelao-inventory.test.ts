import { describe, expect, it } from "vitest";

import {
  buildTabelaoExclusiveInventory,
  buildTabelaoFacets,
  groupTabelaoInventoryByProject,
  matchesTabelaoFacets,
  TABELAO_FILTER_DEFAULTS,
  calculateTabelaoPrice,
  sortTabelaoInventory,
  summarizeTabelao,
  type TabelaoInventoryItem,
} from "@/lib/archive-investor/tabelao-inventory.mjs";

const unit = (id: string, fields: Partial<TabelaoInventoryItem> = {}) => ({
  id,
  businessUnit: "Incorporadora QA",
  project: "Empreendimento QA",
  plant: "Tipo 2Q",
  privateArea: 42,
  identifier: id,
  product: `Apartamento ${id} - Empreendimento QA`,
  finalWithKit: 300_000,
  unitBonus: 10_000,
  tableSlack: 5_000,
  finalPrice: 300_000,
  ...fields,
});

describe("Menor valor por tipologia no Tabelão", () => {
  it("conta unidades distintas do estoque inclusive sem preço, mantendo a comparação válida", () => {
    const source = [
      unit("1"),
      unit("2", { privateArea: 60, finalWithKit: 400_000 }),
      unit("3", { plant: " TIPO 2q ", finalWithKit: null }),
      unit("4", { plant: "Tipo 1Q" }),
      unit("5", { project: "Outro" }),
      unit("6", { businessUnit: "Outra" }),
      unit("7", { project: "Sem preço", unitBonus: null }),
    ];
    const before = structuredClone(source);
    const result = buildTabelaoExclusiveInventory(source);
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      id: "1",
      availableUnits: 3,
      pricedUnits: 2,
      minimumPrice: 285_000,
    });
    expect(result.reduce((total, item) => total + item.pricedUnits, 0)).toBe(5);
    expect(result.reduce((total, item) => total + item.availableUnits, 0)).toBe(6);
    expect(
      buildTabelaoExclusiveInventory([source[0]!, source[0]!, source[1]!])[0]!.availableUnits,
    ).toBe(2);
    expect(source).toEqual(before);
  });

  it("mescla apenas o mesmo empreendimento e incorporadora, preservando todas as plantas", () => {
    const source = buildTabelaoExclusiveInventory([
      unit("1", { project: "Águas", plant: "Tipo 1Q" }),
      unit("2", { project: " AGUAS ", plant: "Tipo 2Q", finalWithKit: 320_000 }),
      unit("3", { project: "Águas", businessUnit: "Outra" }),
      unit("4", { project: "Bosque" }),
    ]);
    const before = structuredClone(source);
    const grouped = groupTabelaoInventoryByProject(sortTabelaoInventory(source, "project"));
    expect(grouped.map((group) => group.items.map((item) => item.id))).toEqual([
      ["1", "2"],
      ["3"],
      ["4"],
    ]);
    expect(grouped.map((group) => group.startIndex)).toEqual([0, 2, 3]);
    expect(new Set(grouped.map((group) => group.key)).size).toBe(3);
    expect(
      groupTabelaoInventoryByProject(sortTabelaoInventory(source, "project-desc"))[0]!.items.map(
        (item) => item.id,
      ),
    ).toEqual(["2", "1"]);
    const filtered = source.filter((item) =>
      matchesTabelaoFacets(item, { ...TABELAO_FILTER_DEFAULTS, plant: "tipo 1q" }),
    );
    expect(groupTabelaoInventoryByProject(filtered).map((group) => group.items.length)).toEqual([
      1,
    ]);
    expect(filtered[0]!.availableUnits).toBe(source[0]!.availableUnits);
    expect(source).toEqual(before);
    expect(groupTabelaoInventoryByProject([])).toEqual([]);
  });

  it("não limita grupos ou plantas ao tamanho da antiga janela de 60 linhas", () => {
    const source = Array.from({ length: 130 }, (_, index) =>
      unit(String(index), {
        project: `Projeto ${Math.floor(index / 50)}`,
        plant: `Planta ${index}`,
      }),
    );
    const groups = groupTabelaoInventoryByProject(
      sortTabelaoInventory(buildTabelaoExclusiveInventory(source), "project"),
    );
    expect(groups.map((group) => group.items.length)).toEqual([50, 50, 30]);
    expect(groups.map((group) => group.startIndex)).toEqual([0, 50, 100]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(130);
    expect(groups.at(-1)?.items.at(-1)?.id).toBe("129");
  });

  const filterSource = () =>
    buildTabelaoExclusiveInventory([
      unit("a1", { project: "Águas", plant: "Tipo 1Q", region: "Zona Sul" }),
      unit("a2", { project: "aguas", plant: "TIPO 2Q", region: "Zona Sul", finalWithKit: 320_000 }),
      unit("a3", { project: "Águas", plant: "Tipo 1Q", region: "Zona Sul", finalWithKit: 400_000 }),
      unit("b1", {
        project: "Bosque",
        plant: "Tipo 1Q",
        region: "Zona Norte",
        businessUnit: "Outra",
      }),
    ]);

  it("filtra os mínimos já escolhidos, não o preço bruto nem a unidade mais cara", () => {
    const source = filterSource();
    const before = structuredClone(source);
    const filters = { ...TABELAO_FILTER_DEFAULTS, price: "28500000" };
    expect(
      source.filter((item) => matchesTabelaoFacets(item, filters)).map((item) => item.id),
    ).toEqual(["a1", "b1"]);
    expect(
      source.filter((item) => matchesTabelaoFacets(item, { ...filters, price: "40000000" })),
    ).toEqual([]);
    const facets = buildTabelaoFacets(source, TABELAO_FILTER_DEFAULTS);
    expect(facets.price.options).toEqual([
      { value: "28500000", label: "28500000", count: 2 },
      { value: "30500000", label: "30500000", count: 1 },
    ]);
    expect(source).toEqual(before);
  });

  it("normaliza opções e encadeia contagens ignorando apenas a própria dimensão", () => {
    const source = filterSource();
    const defaults = buildTabelaoFacets(source, TABELAO_FILTER_DEFAULTS);
    expect(defaults.project.options).toEqual([
      { value: "aguas", label: "Águas", count: 2 },
      { value: "bosque", label: "Bosque", count: 1 },
    ]);
    const filters = { ...TABELAO_FILTER_DEFAULTS, project: "aguas", plant: "tipo 1q" };
    const facets = buildTabelaoFacets(source, filters);
    expect(facets.project.total).toBe(2);
    expect(facets.plant.total).toBe(2);
    expect(facets.price.options).toEqual([{ value: "28500000", label: "28500000", count: 1 }]);
    expect(
      source.filter((item) => matchesTabelaoFacets(item, filters)).map((item) => item.id),
    ).toEqual(["a1"]);
    for (const facet of Object.values(facets)) {
      expect(facet.options.reduce((sum, option) => sum + option.count, 0)).toBe(facet.total);
    }
  });

  it("combina as cinco dimensões e limpar restaura todas as opções", () => {
    const source = filterSource();
    const filters = {
      businessUnit: "outra",
      project: "bosque",
      region: "zona norte",
      plant: "tipo 1q",
      price: "28500000",
    };
    expect(
      source.filter((item) => matchesTabelaoFacets(item, filters)).map((item) => item.id),
    ).toEqual(["b1"]);
    expect(
      source.filter((item) => matchesTabelaoFacets(item, { ...filters, region: "zona sul" })),
    ).toEqual([]);
    expect(source.filter((item) => matchesTabelaoFacets(item, TABELAO_FILTER_DEFAULTS))).toEqual(
      source,
    );
    expect(
      Object.values(buildTabelaoFacets([], TABELAO_FILTER_DEFAULTS)).every(
        (facet) => facet.total === 0 && facet.options.length === 0,
      ),
    ).toBe(true);
  });

  it("inverte preços dentro do empreendimento sem separar o grupo ou alterar os mínimos", () => {
    const source = filterSource();
    expect(sortTabelaoInventory(source, "project-desc").map((item) => item.id)).toEqual([
      "a2",
      "a1",
      "b1",
    ]);
    expect(sortTabelaoInventory(source, "project").map((item) => item.id)).toEqual([
      "a1",
      "a2",
      "b1",
    ]);
    expect(
      sortTabelaoInventory(
        [unit("invalid", { finalWithKit: null }), unit("valid")],
        "project-desc",
      ).map((item) => item.id),
    ).toEqual(["valid", "invalid"]);
  });
  it("aplica os dois abatimentos com kit, sem substituir pelo finalPrice", () => {
    expect(
      calculateTabelaoPrice(
        unit("1", {
          finalWithKit: 340_000,
          unitBonus: 95_000,
          tableSlack: 15_000,
          finalPrice: 1,
        }),
      ),
    ).toBe(230_000);
    expect(calculateTabelaoPrice(unit("2", { unitBonus: 0, tableSlack: 0 }))).toBe(300_000);
  });

  it("escolhe o menor líquido mesmo quando o preço bruto e finalPrice sugerem outra unidade", () => {
    const grossCheapest = unit("101", {
      finalWithKit: 290_000,
      unitBonus: 0,
      tableSlack: 0,
      finalPrice: 1,
    });
    const netCheapest = unit("201", {
      finalWithKit: 320_000,
      unitBonus: 30_000,
      tableSlack: 20_000,
    });
    const source = [grossCheapest, netCheapest];
    const before = structuredClone(source);
    expect(buildTabelaoExclusiveInventory(source)).toMatchObject([
      {
        id: "201",
        minimumPrice: 270_000,
        availableUnits: 2,
        finalWithKit: 320_000,
        finalPrice: 300_000,
      },
    ]);
    expect(source).toEqual(before);
  });

  it("preserva todas as plantas, vagas e lojas por empreendimento e incorporadora sem duplicar por área", () => {
    const source = [
      unit("1"),
      unit("2", { privateArea: 42.01 }),
      unit("3", { plant: "Tipo 1Q" }),
      unit("4", { project: "Outro empreendimento" }),
      unit("5", { businessUnit: "Outra incorporadora" }),
      unit("6", { plant: "Vaga", privateArea: 8.4 }),
      unit("7", { plant: "Loja", privateArea: 70 }),
      unit("8", { privateArea: 42.001 }),
    ];
    const result = buildTabelaoExclusiveInventory(source);
    expect(result).toHaveLength(6);
    expect(new Set(result.map((item) => item.exclusiveKey)).size).toBe(6);
    expect(summarizeTabelao(result)).toMatchObject({ exclusiveOptions: 6, projects: 3 });
    expect(result[0]).toMatchObject({ id: "1", availableUnits: 3 });
  });

  it("compara todas as áreas da mesma planta e preserva a área da unidade de menor líquido", () => {
    const source = [
      unit("101", { privateArea: 42, finalWithKit: 290_000, unitBonus: 0, tableSlack: 0 }),
      unit("201", { privateArea: 50, finalWithKit: 320_000, unitBonus: 40_000 }),
      unit("301", { privateArea: 42.001, finalWithKit: 300_000 }),
    ];
    expect(buildTabelaoExclusiveInventory(source)).toMatchObject([
      { id: "201", privateArea: 50, minimumPrice: 275_000, availableUnits: 3 },
    ]);
    expect(buildTabelaoExclusiveInventory([...source].reverse())).toEqual(
      buildTabelaoExclusiveInventory(source),
    );
  });

  it.each([null, 0, NaN, Infinity])(
    "não exclui o menor preço por falta de área válida (%s), que não define exclusividade",
    (privateArea) => {
      expect(
        buildTabelaoExclusiveInventory([
          unit("1"),
          unit("2", { privateArea, finalWithKit: 250_000 }),
        ]),
      ).toMatchObject([{ id: "2", minimumPrice: 235_000, availableUnits: 2 }]);
    },
  );

  it("normaliza apenas os nomes do grupo e mantém o registro completo da unidade vencedora", () => {
    const winner = unit("1", { project: "Residencial São Paulo" });
    const other = unit("2", { project: " residencial  SAO PAULO ", plant: " tipo  2q " });
    const [result] = buildTabelaoExclusiveInventory([other, winner]);
    expect(result).toMatchObject({ ...winner, availableUnits: 2 });
  });

  it("desempata pelo identificador de forma natural e independente da ordem da fonte", () => {
    const source = [unit("A-10"), unit("A-2"), unit("A-3")];
    expect(buildTabelaoExclusiveInventory(source)[0]?.id).toBe("A-2");
    expect(buildTabelaoExclusiveInventory([...source].reverse())).toEqual(
      buildTabelaoExclusiveInventory(source),
    );
  });

  it("fecha a conta em centavos", () => {
    expect(
      calculateTabelaoPrice(
        unit("1", { finalWithKit: 300_000.29, unitBonus: 0.1, tableSlack: 0.19 }),
      ),
    ).toBe(300_000);
    expect(
      calculateTabelaoPrice(unit("2", { finalWithKit: 100.01, unitBonus: 0.01, tableSlack: 0.01 })),
    ).toBe(99.99);
  });

  it.each([null, undefined, NaN, Infinity, -1, "100", ""])(
    "não transforma campo financeiro inválido (%s) em zero ou preço final alternativo",
    (invalid) => {
      for (const field of ["finalWithKit", "unitBonus", "tableSlack"]) {
        const candidate = unit("1", { [field]: invalid });
        expect(calculateTabelaoPrice(candidate)).toBeNull();
        expect(buildTabelaoExclusiveInventory([candidate])).toEqual([]);
      }
    },
  );

  it("recusa líquido não positivo e grupos sem identidade", () => {
    for (const fields of [
      { finalWithKit: 0 },
      { unitBonus: 300_000 },
      { id: "" },
      { businessUnit: "" },
      { project: " " },
      { plant: null },
    ]) {
      expect(buildTabelaoExclusiveInventory([unit("1", fields)])).toEqual([]);
    }
  });

  it("não limita a um empreendimento ou às 60 primeiras opções da janela visual", () => {
    const source = Array.from({ length: 150 }, (_, index) =>
      unit(String(index), {
        plant: `Planta ${index}`,
        privateArea: 40 + index / 100,
        finalWithKit: 350_000 - index * 100,
      }),
    );
    const sorted = sortTabelaoInventory(buildTabelaoExclusiveInventory(source));
    expect(sorted).toHaveLength(150);
    expect(sorted[0]).toMatchObject({ id: "149", minimumPrice: 320_100 });
    expect(sorted.at(-1)).toMatchObject({ id: "0", minimumPrice: 335_000 });
  });

  it("retorna vazio sem inventar preços e ordena valores ausentes ao fim", () => {
    expect(buildTabelaoExclusiveInventory([])).toEqual([]);
    expect(summarizeTabelao([])).toMatchObject({
      exclusiveOptions: 0,
      minimumPrice: null,
      maximumPrice: null,
    });
    const source = [unit("1", { finalWithKit: null }), unit("2"), unit("3", { unitBonus: null })];
    expect(sortTabelaoInventory(source).map((item) => item.id)).toEqual(["2", "1", "3"]);
  });

  it("agrupa empreendimentos antes do preço e ordena o líquido dentro de cada grupo", () => {
    const source = [
      unit("b-1", { project: "Bosque", finalWithKit: 200_000 }),
      unit("a-2", { project: "Águas", plant: "Tipo 1Q", finalWithKit: 400_000 }),
      unit("a-3", { project: "aguas", businessUnit: "Outra", finalWithKit: 180_000 }),
      unit("a-1", {
        project: " AGUAS  ",
        plant: "Tipo 3Q",
        finalWithKit: 500_000,
        unitBonus: 250_000,
      }),
      unit("b-2", { project: "Bosque", plant: "Tipo 3Q", privateArea: 50, finalWithKit: 220_000 }),
    ];
    const exclusive = buildTabelaoExclusiveInventory(source);
    const before = structuredClone(exclusive);
    const grouped = sortTabelaoInventory(exclusive, "project");

    expect(grouped.map((item) => item.id)).toEqual(["a-1", "a-2", "a-3", "b-1", "b-2"]);
    expect(grouped.map((item) => item.minimumPrice)).toEqual([
      245_000, 385_000, 165_000, 185_000, 205_000,
    ]);
    expect(new Set(grouped.map((item) => item.exclusiveKey))).toEqual(
      new Set(exclusive.map((item) => item.exclusiveKey)),
    );
    expect(exclusive).toEqual(before);
    expect(sortTabelaoInventory([...exclusive].reverse(), "project")).toEqual(grouped);
  });

  it("mantém desempate natural e preços ausentes no fim do respectivo empreendimento", () => {
    const source = [
      unit("B-1", { project: "B", finalWithKit: 100_000 }),
      unit("A-10", { project: "A" }),
      unit("A-0", { project: "A", finalWithKit: null }),
      unit("A-2", { project: "A" }),
    ];
    expect(sortTabelaoInventory(source, "project").map((item) => item.id)).toEqual([
      "A-2",
      "A-10",
      "A-0",
      "B-1",
    ]);
    expect(sortTabelaoInventory([...source].reverse(), "project")).toEqual(
      sortTabelaoInventory(source, "project"),
    );
    expect(sortTabelaoInventory([], "project")).toEqual([]);
  });

  it("não intercala grupos distintos que a ordenação natural considera equivalentes", () => {
    const source = [
      unit("1", { project: "Residencial 1", finalWithKit: 200_000 }),
      unit("2", { project: "Residencial 01", finalWithKit: 300_000 }),
      unit("3", { project: "Residencial 1", finalWithKit: 400_000 }),
      unit("4", { project: "Residencial 01", finalWithKit: 500_000 }),
    ];
    expect(sortTabelaoInventory(source, "project").map((item) => item.id)).toEqual([
      "2",
      "4",
      "1",
      "3",
    ]);
  });
});
