import { describe, expect, it } from "vitest";

import {
  buildTabelaoExclusiveInventory,
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

  it("preserva todas as plantas e áreas, inclusive vagas e lojas, separadas por empreendimento e incorporadora", () => {
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
    expect(result).toHaveLength(8);
    expect(new Set(result.map((item) => item.exclusiveKey)).size).toBe(8);
    expect(summarizeTabelao(result)).toMatchObject({ exclusiveOptions: 8, projects: 3 });
  });

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

  it("recusa líquido não positivo e grupos sem identidade ou metragem válida", () => {
    for (const fields of [
      { finalWithKit: 0 },
      { unitBonus: 300_000 },
      { id: "" },
      { businessUnit: "" },
      { project: " " },
      { plant: null },
      { privateArea: null },
      { privateArea: 0 },
      { privateArea: NaN },
      { privateArea: Infinity },
    ]) {
      expect(buildTabelaoExclusiveInventory([unit("1", fields)])).toEqual([]);
    }
  });

  it("não limita a um empreendimento ou às 60 primeiras opções da janela visual", () => {
    const source = Array.from({ length: 150 }, (_, index) =>
      unit(String(index), {
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
      unit("b-2", { project: "Bosque", privateArea: 50, finalWithKit: 220_000 }),
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
