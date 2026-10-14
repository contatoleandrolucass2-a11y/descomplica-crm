import { describe, expect, it } from "vitest";
import { filterInventoryBySearch } from "@/lib/archive-investor/inventory-search";

const inventory = [
  { identifier: "BL04-0105", project: "Conquista Sacomã", product: "Apartamento BL04-0105" },
  { identifier: "BL03-0006", project: "Residencial Abytá", product: "Apartamento BL03-0006" },
  { identifier: null, project: "Conquista Sacomã", product: "Apartamento sem identificação" },
];

describe("pesquisa manual do estoque", () => {
  it.each(["bl04-0105", "BL040105", "bl04 0105", "  sacoma 0105  "])(
    "encontra a unidade por código e empreendimento: %s",
    (query) => expect(filterInventoryBySearch(inventory, query)).toEqual([inventory[0]]),
  );

  it("combina palavras sem depender da ordem, caixa ou acentos", () => {
    expect(filterInventoryBySearch(inventory, "ABYTA residencial")).toEqual([inventory[1]]);
    expect(filterInventoryBySearch(inventory, "sacoma")).toEqual([inventory[0], inventory[2]]);
    expect(filterInventoryBySearch(inventory, "sem identificacao")).toEqual([inventory[2]]);
  });

  it("não restaura unidades excluídas pelos filtros nem altera os objetos ou a ordem", () => {
    const filtered = Object.freeze([Object.freeze(inventory[2]!), Object.freeze(inventory[0]!)]);
    const result = filterInventoryBySearch([...filtered], "sacoma");
    expect(result).toEqual(filtered);
    expect(result[0]).toBe(inventory[2]);
    expect(filterInventoryBySearch([...filtered], "abyta")).toEqual([]);
  });

  it("restaura a lista ao limpar e trata campos ausentes sem fabricar correspondências", () => {
    expect(filterInventoryBySearch(inventory, "   ")).toBe(inventory);
    expect(filterInventoryBySearch([{}], "0105")).toEqual([]);
    expect(filterInventoryBySearch(inventory, "inexistente")).toEqual([]);
  });
});
