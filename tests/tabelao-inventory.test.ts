import { describe, expect, it } from "vitest";
import type { TabelaoRegionName } from "@/lib/archive-investor/tabelao-region.mjs";

import {
  buildTabelaoCellSpans,
  buildTabelaoExclusiveInventory,
  buildTabelaoFacets,
  buildTabelaoOptions,
  enrichTabelaoLocationFields,
  formatTabelaoParkingSpaces,
  groupTabelaoInventoryByProject,
  matchesTabelaoFacets,
  matchesTabelaoFilters,
  normalizeTabelaoParkingSpaces,
  normalizeTabelaoProgress,
  TABELAO_FILTER_DEFAULTS,
  calculateTabelaoPrice,
  sortTabelaoInventory,
  summarizeTabelao,
  type TabelaoInventoryItem,
} from "@/lib/archive-investor/tabelao-inventory.mjs";

const verifiedRegion = (region: TabelaoRegionName): Partial<TabelaoInventoryItem> => ({
  postalCode: "01001000",
  regionResolution: {
    postalCode: "01001000",
    region,
    status: "confirmed",
    reason: "single-region-for-postal-code",
    municipality: "São Paulo",
    state: "SP",
    districts: ["Distrito QA"],
    checkedAt: "2026-10-01T12:00:00.000Z",
    source: "viacep+localizasampa+geosampa",
  },
});

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
  cashBackSlack: 3_000,
  appraisal: 330_000,
  classification: "Residencial",
  street: "Rua QA",
  streetNumber: "10",
  neighborhood: "Bairro QA",
  progress: 0.42,
  finalPrice: 300_000,
  ...fields,
});

describe("Menor valor por tipologia no Tabelão", () => {
  it.each([
    [[], []],
    [["R2V"], [1]],
    [
      ["R2V", "R2V", "HIS-2", "HIS-2", "PCD"],
      [2, 0, 2, 0, 1],
    ],
    [
      ["R2V", "HIS-2", "R2V"],
      [1, 1, 1],
    ],
    [
      ["Rua A / 1 / Centro", "Rua A / 2 / Centro"],
      [1, 1],
    ],
    [
      ["HIS-2", "HIS-2 - Adaptável PCD/PNE"],
      [1, 1],
    ],
    [
      ["Não informado", "Não informado"],
      [2, 0],
    ],
  ])("mescla somente sequências de rótulos idênticos: %j", (labels, expected) => {
    const before = [...labels];
    const spans = buildTabelaoCellSpans(labels as string[]);
    expect(spans).toEqual(expected);
    expect(spans.reduce((sum, value) => sum + value, 0)).toBe(labels.length);
    expect(labels).toEqual(before);
  });

  it("recalcula células mescladas por projeto, incorporadora, filtro e ordem", () => {
    const source = [
      unit("1", { plant: "A", finalWithKit: 300_000, classification: "HIS-2" }),
      unit("2", { plant: "B", finalWithKit: 320_000, classification: "HIS-2" }),
      unit("3", { plant: "C", finalWithKit: 340_000, classification: "R2V" }),
      unit("4", { businessUnit: "Outra", classification: "R2V" }),
      unit("5", { project: "Outro", classification: "R2V" }),
    ];
    const spansByProject = (items: typeof source, order = "project") =>
      groupTabelaoInventoryByProject(sortTabelaoInventory(items, order)).map((group) =>
        buildTabelaoCellSpans(group.items.map((item) => item.classification ?? "Não informado")),
      );
    expect(spansByProject(source)).toEqual([[2, 0, 1], [1], [1]]);
    expect(spansByProject(source, "project-desc")).toEqual([[1, 2, 0], [1], [1]]);
    expect(spansByProject(source.filter((item) => item.plant === "B"))).toEqual([[1]]);
  });

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
      unit("a1", { project: "Águas", plant: "Tipo 1Q", ...verifiedRegion("Zona Sul") }),
      unit("a2", {
        project: "aguas",
        plant: "TIPO 2Q",
        ...verifiedRegion("Zona Sul"),
        finalWithKit: 320_000,
      }),
      unit("a3", {
        project: "Águas",
        plant: "Tipo 1Q",
        ...verifiedRegion("Zona Sul"),
        finalWithKit: 400_000,
      }),
      unit("b1", {
        project: "Bosque",
        plant: "Tipo 1Q",
        ...verifiedRegion("Zona Norte"),
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

  it("combina as seis dimensões e limpar restaura todas as opções", () => {
    const source = filterSource();
    const filters = {
      businessUnit: "outra",
      project: "bosque",
      region: "zona norte",
      plant: "tipo 1q",
      parkingSpaces: "unknown",
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

  it("mantém os novos detalhes da mesma unidade que define o menor valor", () => {
    const expensive = unit("101", {
      finalWithKit: 400_000,
      cashBackSlack: 11_000,
      appraisal: 500_000,
      classification: "Detalhe caro",
      street: "Rua Cara",
      streetNumber: "101",
      neighborhood: "Bairro Caro",
      progress: 0.8,
    });
    const minimum = unit("201", {
      finalWithKit: 300_000,
      cashBackSlack: 0,
      appraisal: 0,
      classification: "Detalhe mínimo",
      street: "Rua Mínima",
      streetNumber: "201",
      neighborhood: "Bairro Mínimo",
      progress: 0.25,
    });

    expect(buildTabelaoExclusiveInventory([expensive, minimum])).toMatchObject([
      {
        id: "201",
        availableUnits: 2,
        cashBackSlack: 0,
        appraisal: 0,
        classification: "Detalhe mínimo",
        street: "Rua Mínima",
        streetNumber: "201",
        neighborhood: "Bairro Mínimo",
        progress: 0.25,
      },
    ]);
  });

  it("complementa somente endereço ausente por referência coerente da unidade ou empreendimento", () => {
    const live = [
      unit("1", { street: null, streetNumber: null, neighborhood: "Bairro vivo" }),
      unit("2", {
        project: "Projeto com referência única",
        identifier: "sem-correspondencia",
        street: null,
        streetNumber: null,
        neighborhood: null,
      }),
      unit("3", {
        businessUnit: "Outra",
        street: null,
        streetNumber: null,
        neighborhood: null,
      }),
    ];
    const reference = [
      unit("r1", {
        identifier: "1",
        street: "Rua de referência",
        streetNumber: "100",
        neighborhood: "Bairro vivo",
      }),
      unit("r2", {
        project: "Projeto com referência única",
        identifier: "outra-unidade",
        street: "Rua do projeto",
        streetNumber: "200",
        neighborhood: "Bairro do projeto",
      }),
    ];
    const before = structuredClone(live);

    expect(enrichTabelaoLocationFields(live, reference)).toMatchObject([
      {
        street: "Rua de referência",
        streetNumber: "100",
        neighborhood: "Bairro vivo",
      },
      {
        street: "Rua do projeto",
        streetNumber: "200",
        neighborhood: "Bairro do projeto",
      },
      { street: null, streetNumber: null, neighborhood: null },
    ]);
    expect(live).toEqual(before);
  });

  it("não combina referência com componente vivo conflitante", () => {
    const live = [unit("1", { street: null, streetNumber: null, neighborhood: "Bairro atual" })];
    const reference = [
      unit("r1", {
        identifier: "1",
        street: "Rua antiga",
        streetNumber: "100",
        neighborhood: "Bairro antigo",
      }),
    ];

    expect(enrichTabelaoLocationFields(live, reference)).toMatchObject([
      { street: null, streetNumber: null, neighborhood: "Bairro atual" },
    ]);
  });

  it("não fabrica endereço ao combinar registros ou escolher projeto ambíguo", () => {
    const live = [
      unit("1", {
        identifier: "sem-correspondencia",
        street: null,
        streetNumber: null,
        neighborhood: null,
      }),
      unit("2", {
        project: "Projeto ambíguo",
        identifier: "sem-correspondencia-2",
        street: null,
        streetNumber: null,
        neighborhood: null,
      }),
    ];
    const reference = [
      unit("r1", {
        identifier: "outra-1",
        street: "Rua A",
        streetNumber: null,
        neighborhood: "Bairro A",
      }),
      unit("r2", {
        identifier: "outra-2",
        street: null,
        streetNumber: "10",
        neighborhood: "Bairro A",
      }),
      unit("r3", {
        project: "Projeto ambíguo",
        identifier: "outra-3",
        street: "Rua B",
        streetNumber: "20",
        neighborhood: "Bairro B",
      }),
      unit("r4", {
        project: "Projeto ambíguo",
        identifier: "outra-4",
        street: "Rua C",
        streetNumber: "30",
        neighborhood: "Bairro C",
      }),
    ];

    expect(enrichTabelaoLocationFields(live, reference)).toMatchObject([
      { street: null, streetNumber: null, neighborhood: null },
      { street: null, streetNumber: null, neighborhood: null },
    ]);
  });

  it("aceita somente a escala oficial de andamento entre zero e um", () => {
    expect(normalizeTabelaoProgress(0)).toBe(0);
    expect(normalizeTabelaoProgress(0.42)).toBe(0.42);
    expect(normalizeTabelaoProgress(1)).toBe(1);
    for (const value of [-0.01, 1.01, 42, NaN, Infinity, null, "0.42"]) {
      expect(normalizeTabelaoProgress(value)).toBeNull();
    }
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

describe("Quantidade de vagas no Tabelão", () => {
  it.each([
    [0, "0 vagas"],
    [1, "1 vaga"],
    [2, "2 vagas"],
    [10, "10 vagas"],
    [Number.MAX_SAFE_INTEGER, `${Number.MAX_SAFE_INTEGER} vagas`],
  ])("preserva o inteiro seguro %s e formata seu rótulo", (value, label) => {
    expect(normalizeTabelaoParkingSpaces(value)).toBe(value);
    expect(formatTabelaoParkingSpaces(value)).toBe(label);
  });

  it("normaliza zero negativo como zero vagas", () => {
    expect(normalizeTabelaoParkingSpaces(-0)).toBe(0);
    expect(formatTabelaoParkingSpaces(-0)).toBe("0 vagas");
    expect(
      buildTabelaoExclusiveInventory([
        unit("a", { parkingSpaces: -0 }),
        unit("b", { parkingSpaces: 0 }),
      ]),
    ).toMatchObject([{ parkingSpaces: 0, availableUnits: 2, pricedUnits: 2 }]);
  });

  it.each([
    undefined,
    null,
    "0",
    "1",
    " 2 ",
    "",
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    true,
    false,
    {},
    [],
    1n,
  ])("mantém a entrada inválida %s como desconhecida, separada de zero", (value) => {
    expect(normalizeTabelaoParkingSpaces(value)).toBeNull();
    expect(formatTabelaoParkingSpaces(value)).toBe("Não informado");
    const invalid = Object.assign(unit("invalid"), { parkingSpaces: value });
    // Exercise malformed source values at the runtime boundary.
    const source = [
      invalid as TabelaoInventoryItem,
      unit("missing"),
      unit("zero", { parkingSpaces: 0 }),
    ];
    const result = buildTabelaoExclusiveInventory(source);
    expect(result).toHaveLength(2);
    expect(result).toMatchObject([
      { parkingSpaces: null, availableUnits: 2, pricedUnits: 2 },
      { parkingSpaces: 0, availableUnits: 1, pricedUnits: 1 },
    ]);
    expect(buildTabelaoFacets(source, TABELAO_FILTER_DEFAULTS).parkingSpaces).toEqual({
      total: 3,
      options: [
        { value: "0", label: "0 vagas", count: 1 },
        { value: "unknown", label: "Não informado", count: 2 },
      ],
    });
    expect(matchesTabelaoFilters(source[0]!, { parkingSpaces: "unknown" })).toBe(true);
    expect(matchesTabelaoFilters(source[0]!, { parkingSpaces: "0" })).toBe(false);
  });

  it("separa 0/1/2/desconhecido, escolhe o menor líquido e conta IDs por grupo", () => {
    const parkingCounts = [0, 1, 2, null];
    const source = parkingCounts.flatMap((parkingSpaces, index) => {
      const winner = unit(`${index}-net`, {
        parkingSpaces,
        finalWithKit: 320_000 + index * 10_000,
        unitBonus: 30_000,
        tableSlack: 20_000,
        privateArea: 50,
      });
      return [
        unit(`${index}-gross`, {
          parkingSpaces,
          finalWithKit: 290_000 + index * 10_000,
          unitBonus: 0,
          tableSlack: 0,
          finalPrice: 1,
        }),
        winner,
        unit(`${index}-no-price`, { parkingSpaces, finalWithKit: null }),
        { ...winner, id: ` ${winner.id} ` },
      ];
    });
    const before = structuredClone(source);
    const result = buildTabelaoExclusiveInventory(source);

    expect(result).toHaveLength(4);
    expect(new Set(result.map((item) => item.exclusiveKey)).size).toBe(4);
    for (const [index, parkingSpaces] of parkingCounts.entries()) {
      expect(result[index]).toMatchObject({
        parkingSpaces,
        minimumPrice: 270_000 + index * 10_000,
        privateArea: 50,
        availableUnits: 3,
        pricedUnits: 2,
      });
      expect(JSON.parse(result[index]!.exclusiveKey)).toEqual([
        "incorporadora qa",
        "empreendimento qa",
        "tipo 2q",
        parkingSpaces,
      ]);
    }
    expect(sortTabelaoInventory(buildTabelaoExclusiveInventory([...source].reverse()))).toEqual(
      sortTabelaoInventory(result),
    );
    expect(summarizeTabelao(result)).toMatchObject({ exclusiveOptions: 4, projects: 1, plants: 1 });
    expect(source).toEqual(before);
  });

  it.each([0, 1, 2, null])(
    "deduplica IDs sem perder o menor preço e desempata de forma determinística (%s)",
    (parkingSpaces) => {
      const source = [
        unit("A-10", { parkingSpaces }),
        unit("A-2", { parkingSpaces, finalWithKit: 400_000 }),
        unit("A-3", { parkingSpaces, finalWithKit: null }),
        unit("A-2", { parkingSpaces }),
        unit("A-2", { parkingSpaces }),
      ];
      const result = buildTabelaoExclusiveInventory(source);
      expect(result).toMatchObject([
        { id: "A-2", parkingSpaces, minimumPrice: 285_000, availableUnits: 3, pricedUnits: 2 },
      ]);
      expect(buildTabelaoExclusiveInventory([...source].reverse())).toEqual(result);

      const tied = ["a", "A"].map((id) =>
        unit(id, { parkingSpaces, identifier: "mesma unidade", product: "mesmo produto" }),
      );
      expect(buildTabelaoExclusiveInventory(tied)[0]!.id).toBe("A");
      expect(buildTabelaoExclusiveInventory([...tied].reverse())).toEqual(
        buildTabelaoExclusiveInventory(tied),
      );
    },
  );

  const facetSource = () =>
    buildTabelaoExclusiveInventory([
      ...[0, 1, 2, 10, null].map((parkingSpaces, index) =>
        unit(`a-${index}`, { parkingSpaces, ...verifiedRegion("Zona Sul") }),
      ),
      unit("a-duplicate", {
        parkingSpaces: 1,
        ...verifiedRegion("Zona Sul"),
        finalWithKit: 400_000,
      }),
      unit("a-expensive", {
        parkingSpaces: 1,
        ...verifiedRegion("Zona Sul"),
        plant: "Tipo 3Q",
        finalWithKit: 400_000,
      }),
      unit("b", { parkingSpaces: 1, ...verifiedRegion("Zona Sul"), project: "Outro" }),
      unit("c", { parkingSpaces: 1, ...verifiedRegion("Zona Norte"), businessUnit: "Outra" }),
    ]);

  it("oferece facetas rotuladas em ordem numérica e conta opções exclusivas", () => {
    const source = facetSource();
    expect(buildTabelaoFacets(source, TABELAO_FILTER_DEFAULTS).parkingSpaces).toEqual({
      total: 8,
      options: [
        { value: "0", label: "0 vagas", count: 1 },
        { value: "1", label: "1 vaga", count: 4 },
        { value: "2", label: "2 vagas", count: 1 },
        { value: "10", label: "10 vagas", count: 1 },
        { value: "unknown", label: "Não informado", count: 1 },
      ],
    });
    expect(source.find((item) => item.id === "a-1")!.availableUnits).toBe(2);
  });

  it("combina vagas com as demais facetas, excluindo somente a própria dimensão da contagem", () => {
    const source = facetSource();
    const filters = {
      businessUnit: "incorporadora qa",
      project: "empreendimento qa",
      region: "zona sul",
      plant: "tipo 2q",
      parkingSpaces: "1",
      price: "28500000",
    };
    const facets = buildTabelaoFacets(source, filters);
    expect(
      source.filter((item) => matchesTabelaoFacets(item, filters)).map((item) => item.id),
    ).toEqual(["a-1"]);
    expect(facets.parkingSpaces).toEqual({
      total: 5,
      options: [
        { value: "0", label: "0 vagas", count: 1 },
        { value: "1", label: "1 vaga", count: 1 },
        { value: "2", label: "2 vagas", count: 1 },
        { value: "10", label: "10 vagas", count: 1 },
        { value: "unknown", label: "Não informado", count: 1 },
      ],
    });
    expect(facets.project.options).toEqual([
      { value: "empreendimento qa", label: "Empreendimento QA", count: 1 },
      { value: "outro", label: "Outro", count: 1 },
    ]);
    expect(facets.plant.total).toBe(1);
    expect(facets.price.options).toEqual([{ value: "28500000", label: "28500000", count: 1 }]);
    for (const facet of Object.values(facets)) {
      expect(facet.options.reduce((sum, option) => sum + option.count, 0)).toBe(facet.total);
    }
    for (const [parkingSpaces, id] of [
      ["0", "a-0"],
      ["unknown", "a-4"],
    ] as const) {
      expect(
        source
          .filter((item) => matchesTabelaoFacets(item, { ...filters, parkingSpaces }))
          .map((item) => item.id),
      ).toEqual([id]);
    }
    expect(
      source.filter((item) => matchesTabelaoFacets(item, { ...filters, parkingSpaces: "3" })),
    ).toEqual([]);
    expect(buildTabelaoFacets(source, { ...filters, parkingSpaces: "3" }).parkingSpaces).toEqual(
      facets.parkingSpaces,
    );
    expect(source.filter((item) => matchesTabelaoFacets(item, TABELAO_FILTER_DEFAULTS))).toEqual(
      source,
    );
  });

  it("preserva filtros legados e acrescenta opções de vagas sem perder zero ou desconhecido", () => {
    const source = facetSource();
    const options = buildTabelaoOptions(source);
    expect(options).toMatchObject({
      businessUnits: ["Incorporadora QA", "Outra"],
      projects: ["Empreendimento QA", "Outro"],
      plants: ["Tipo 2Q", "Tipo 3Q"],
      parkingSpaces: ["0", "1", "2", "10", "unknown"],
      regions: ["Zona Norte", "Zona Sul"],
    });
    const filters = {
      businessUnit: "Incorporadora QA",
      project: "Empreendimento QA",
      plant: "Tipo 2Q",
      region: "Zona Sul",
      priceRange: "200-to-300",
      query: "empreendimento",
    };
    expect(source.filter((item) => matchesTabelaoFilters(item, filters))).toHaveLength(5);
    for (const [parkingSpaces, id] of [
      ["0", "a-0"],
      ["1", "a-1"],
      ["unknown", "a-4"],
    ] as const) {
      expect(
        source
          .filter((item) => matchesTabelaoFilters(item, { ...filters, parkingSpaces }))
          .map((item) => item.id),
      ).toEqual([id]);
    }
    expect(
      source.filter((item) => matchesTabelaoFilters(item, { ...filters, parkingSpaces: "all" })),
    ).toEqual(source.filter((item) => matchesTabelaoFilters(item, filters)));
    expect(matchesTabelaoFilters(source[0]!)).toBe(true);
    expect(buildTabelaoOptions([]).parkingSpaces).toEqual([]);
  });
});
