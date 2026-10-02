import { describe, expect, it } from "vitest";

import {
  formatTabelaoDescription,
  formatTabelaoPlant,
} from "../lib/archive-investor/tabelao-presentation.mjs";

describe("apresentacao do Tabelao em portugues brasileiro", () => {
  it.each([
    ["TIPO 2Q", "Tipo 2Q"],
    ["TERREO 2Q", "T\u00e9rreo 2Q"],
    ["Terreo 1Q PCD", "T\u00e9rreo 1Q PCD"],
    ["Tipo 2Q C/ AP", "Tipo 2Q C/AP"],
    ["Tipo 2Q C/S", "Tipo 2Q C/S"],
    ["HIS-2 - ADAPTAVEL PCD/PNE", "HIS-2 - adapt\u00e1vel PCD/PNE"],
    ["UNIDADE ADAPT\u00c1VEL PARA PCD", "Unidade adapt\u00e1vel para PCD"],
    ["VAGA AVULSA", "Vaga avulsa"],
    ["NAO INFORMADO", "N\u00e3o informado"],
    ["  CONDOMINIO   RESIDENCIAL  ", "Condom\u00ednio residencial"],
    ["r2v", "R2V"],
    ["r2-v", "R2-V"],
    ["hmp", "HMP"],
    ["pcd/pne", "PCD/PNE"],
    ["PROGRAMA RESIDENCIAL ESPECIAL", "Programa residencial especial"],
  ])("formata %s sem perder siglas", (input, expected) => {
    expect(formatTabelaoDescription(input)).toBe(expected);
  });

  it.each([undefined, null, "", "   "])("mantem ausencia explicita: %s", (value) => {
    expect(formatTabelaoDescription(value)).toBe("N\u00e3o informado");
    expect(formatTabelaoPlant(value)).toBe("N\u00e3o informado");
  });

  it.each([
    ["TIPO 2Q", "Tipo\n2Q"],
    ["TERREO 2Q C/ AP", "T\u00e9rreo\n2Q C/AP"],
    ["Tipo 1Q PCD", "Tipo\n1Q PCD"],
    ["VAGA", "Vaga"],
    ["Garden 3Q", "Garden 3Q"],
  ])("quebra a planta %s depois do tipo de pavimento", (input, expected) => {
    expect(formatTabelaoPlant(input)).toBe(expected);
    expect(formatTabelaoPlant(input).replace(/\s+/g, " ")).toBe(formatTabelaoDescription(input));
  });

  it("nao modifica os campos que identificam e agrupam o estoque", () => {
    const item = Object.freeze({
      plant: "TERREO 2Q C/ AP",
      classification: "HIS-2 - ADAPTAVEL PCD/PNE",
      project: "Residencial S\u00e3o Miguel",
      street: "Rua S\u00e3o Jo\u00e3o",
    });
    formatTabelaoPlant(item.plant);
    formatTabelaoDescription(item.classification);
    expect(item).toEqual({
      plant: "TERREO 2Q C/ AP",
      classification: "HIS-2 - ADAPTAVEL PCD/PNE",
      project: "Residencial S\u00e3o Miguel",
      street: "Rua S\u00e3o Jo\u00e3o",
    });
  });
});
