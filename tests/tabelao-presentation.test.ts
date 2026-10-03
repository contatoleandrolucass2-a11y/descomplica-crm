import { describe, expect, it } from "vitest";

import {
  buildTabelaoMapsUrl,
  formatTabelaoAddress,
  formatTabelaoDescription,
  formatTabelaoPlant,
} from "../lib/archive-investor/tabelao-presentation.mjs";
import { enrichTabelaoLocationFields } from "../lib/archive-investor/tabelao-inventory.mjs";
import type { TabelaoPayloadItem } from "../lib/archive-investor/tabelao-payload";

describe("apresentacao do Tabelao em portugues brasileiro", () => {
  it.each([
    ["TIPO 2Q", "Tipo 2Q"],
    ["TERREO 2Q", "T\u00e9rreo 2Q"],
    ["Terreo 1Q PCD", "T\u00e9rreo 1Q PCD"],
    ["Tipo 2Q C/ AP", "Tipo 2Q C/ AP"],
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
    ["TERREO 2Q C/ AP", "T\u00e9rreo\n2Q C/ AP"],
    ["Tipo 1Q PCD", "Tipo\n1Q PCD"],
    ["VAGA", "Vaga"],
    ["Garden 3Q", "Garden 3Q"],
  ])("quebra a planta %s depois do tipo de pavimento", (input, expected) => {
    expect(formatTabelaoPlant(input)).toBe(expected);
    expect(formatTabelaoPlant(input).replace(/\s+/g, " ")).toBe(formatTabelaoDescription(input));
  });

  it.each([
    ["Tipo 2Q S\u00e3o Miguel", "Tipo 2Q S\u00e3o Miguel"],
    ["UNIDADE Brooklin Sky PCD", "Unidade Brooklin Sky PCD"],
    ["PROGRAMA Minha Casa Minha Vida", "Programa Minha Casa Minha Vida"],
    ["iTower RESIDENCIAL XYZ", "iTower residencial XYZ"],
    ["UNIDADE NR FGTS IPHAN", "Unidade NR FGTS IPHAN"],
    ["R2V-Adaptavel PCD", "R2V-adapt\u00e1vel PCD"],
    ["r2-v-adaptavel PCD", "R2-V-adapt\u00e1vel PCD"],
    ["TIPO 2Q HIS-2-PCD", "Tipo 2Q HIS-2-PCD"],
    ["his-2-ADAPTAVEL pcd/pne", "HIS-2-adapt\u00e1vel PCD/PNE"],
  ])("preserva nomes e codigos em %s", (input, expected) => {
    expect(formatTabelaoDescription(input)).toBe(expected);
  });

  it.each([
    ["c/ap", "C/AP"],
    ["c/ ap", "C/ AP"],
    ["c /ap", "C /AP"],
    ["c / ap", "C / AP"],
    ["c/  ap", "C/  AP"],
    ["c/s", "C/S"],
    ["c/ s", "C/ S"],
  ])("preserva espacos ao redor da barra em %s", (input, expected) => {
    expect(formatTabelaoDescription(input)).toBe(expected);
  });

  it("mantem distintos os rotulos de plantas com C/AP e C/ AP", () => {
    const inputs = ["TIPO 2Q C/AP", "TIPO 2Q C/ AP"];
    expect(inputs.map(formatTabelaoDescription)).toEqual(["Tipo 2Q C/AP", "Tipo 2Q C/ AP"]);
    expect(new Set(inputs.map(formatTabelaoDescription)).size).toBe(2);
    expect(inputs.map(formatTabelaoPlant)).toEqual(["Tipo\n2Q C/AP", "Tipo\n2Q C/ AP"]);
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

describe("endereco e Google Maps do Tabelao", () => {
  const item = Object.freeze({
    id: "qa-address",
    businessUnit: "QA",
    project: "Projeto QA",
    product: "Unidade QA",
    street: "  Rua S\u00e3o Teste  ",
    streetNumber: "  10-A  ",
    neighborhood: "  Bairro QA  ",
    city: "  Cidade QA  ",
    state: "  UF  ",
    postalCode: "  00001-234  ",
  } satisfies TabelaoPayloadItem);

  it("preserva o formato visual, acentos e caixa dos componentes recebidos", () => {
    expect(formatTabelaoAddress(item)).toBe("Rua S\u00e3o Teste / 10-A / Bairro QA");
  });

  it.each([null, "", " \t\n "])("explicita cada componente ausente: %s", (value) => {
    expect(formatTabelaoAddress({ street: value, streetNumber: value, neighborhood: value })).toBe(
      "N\u00e3o informado / N\u00e3o informado / N\u00e3o informado",
    );
    expect(formatTabelaoAddress({ ...item, streetNumber: value })).toBe(
      "Rua S\u00e3o Teste / N\u00e3o informado / Bairro QA",
    );
    expect(formatTabelaoAddress({ ...item, neighborhood: value })).toBe(
      "Rua S\u00e3o Teste / 10-A / N\u00e3o informado",
    );
  });

  it("aceita os campos opcionais omitidos pelo payload", () => {
    expect(formatTabelaoAddress({})).toBe(
      "N\u00e3o informado / N\u00e3o informado / N\u00e3o informado",
    );
    expect(formatTabelaoAddress({ street: item.street, neighborhood: item.neighborhood })).toBe(
      "Rua S\u00e3o Teste / N\u00e3o informado / Bairro QA",
    );
    expect(formatTabelaoAddress({ street: item.street, streetNumber: item.streetNumber })).toBe(
      "Rua S\u00e3o Teste / 10-A / N\u00e3o informado",
    );
  });

  it("combina os seis componentes reais em uma busca no Maps", () => {
    const url = new URL(buildTabelaoMapsUrl(item)!);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/search/");
    expect([...url.searchParams]).toEqual([
      ["api", "1"],
      ["query", "Rua S\u00e3o Teste, 10-A, Bairro QA, Cidade QA, UF, 00001-234"],
    ]);
    expect(url.hash).toBe("");
  });

  it.each([null, "", " \t\n ", "N\u00e3o informado", " NAO INFORMADA "])(
    "nao cria link sem logradouro, mesmo com contexto geografico: %s",
    (street) => {
      expect(buildTabelaoMapsUrl({ ...item, street })).toBeNull();
    },
  );

  it("nao transforma bairro, municipio, UF ou CEP isolados em endereco do imovel", () => {
    expect(buildTabelaoMapsUrl({})).toBeNull();
    expect(buildTabelaoMapsUrl({ neighborhood: "Bairro QA" })).toBeNull();
    expect(
      buildTabelaoMapsUrl({ city: "Cidade QA", state: "UF", postalCode: "00001-234" }),
    ).toBeNull();
  });

  it("usa somente o logradouro quando o restante nao foi informado", () => {
    expect(buildTabelaoMapsUrl({ street: "Rua QA" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Rua+QA",
    );
  });

  it("omite ausencias da busca sem inventar numero, municipio, UF ou pais", () => {
    const partial = {
      street: "Rua QA",
      streetNumber: null,
      neighborhood: "Bairro QA",
      city: "",
      state: " \t ",
      postalCode: "00001-234",
    };
    expect(formatTabelaoAddress(partial)).toBe("Rua QA / N\u00e3o informado / Bairro QA");
    expect(new URL(buildTabelaoMapsUrl(partial)!).searchParams.get("query")).toBe(
      "Rua QA, Bairro QA, 00001-234",
    );
  });

  it("nao envia rotulos de ausencia como componentes para o Maps", () => {
    const url = buildTabelaoMapsUrl({
      street: "Rua QA",
      streetNumber: "N\u00e3o informado",
      neighborhood: " NAO INFORMADO ",
      city: "N\u00e3o informada",
      state: null,
    });
    expect(new URL(url!).searchParams.get("query")).toBe("Rua QA");
  });

  it.each(["0", "s/n", "0010-B"])("preserva o numero textual da origem: %s", (streetNumber) => {
    const address = { street: "Rua QA", streetNumber };
    expect(formatTabelaoAddress(address)).toBe(`Rua QA / ${streetNumber} / N\u00e3o informado`);
    expect(new URL(buildTabelaoMapsUrl(address)!).searchParams.get("query")).toBe(
      `Rua QA, ${streetNumber}`,
    );
  });

  it("codifica caracteres reservados sem permitir trocar host, parametros ou fragmento", () => {
    const street = "Rua QA &api=0&query=https://example.invalid/#teste + 50% / a\u00e7\u00e3o?";
    const url = new URL(buildTabelaoMapsUrl({ street, streetNumber: "1&x=2" })!);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/search/");
    expect([...url.searchParams]).toEqual([
      ["api", "1"],
      ["query", `${street}, 1&x=2`],
    ]);
    expect(url.hash).toBe("");
  });

  it("nao cria link com endereco de referencia geograficamente conflitante", () => {
    const live = { ...item, street: null, streetNumber: null, neighborhood: null };
    const reference = {
      ...item,
      city: "Cidade da referencia",
      state: "XX",
      postalCode: "00009-999",
    };
    const [enriched] = enrichTabelaoLocationFields([live], [reference]);
    expect(enriched).toEqual(live);
    expect(formatTabelaoAddress(enriched!)).toBe(
      "N\u00e3o informado / N\u00e3o informado / N\u00e3o informado",
    );
    expect(buildTabelaoMapsUrl(enriched!)).toBeNull();
  });

  it("monta Maps com referencia compativel e preserva a geografia viva", () => {
    const live = { ...item, street: null, streetNumber: null, neighborhood: null };
    const [enriched] = enrichTabelaoLocationFields(
      [live],
      [{ ...item, city: "cidade qa", state: "uf", postalCode: "00001234" }],
    );
    expect(new URL(buildTabelaoMapsUrl(enriched!)!).searchParams.get("query")).toBe(
      "Rua S\u00e3o Teste, 10-A, Bairro QA, Cidade QA, UF, 00001-234",
    );
    expect(enriched).toMatchObject({
      city: item.city,
      state: item.state,
      postalCode: item.postalCode,
    });
  });

  it("nao usa nome comercial, regiao ou distrito para completar o endereco", () => {
    const address = {
      street: "Rua QA",
      project: "Projeto QA",
      district: "Distrito QA",
      region: "Zona QA",
    };
    expect(new URL(buildTabelaoMapsUrl(address)!).searchParams.get("query")).toBe("Rua QA");
  });

  it("e deterministico e nao modifica o item do payload", () => {
    const original = { ...item };
    expect(formatTabelaoAddress(item)).toBe(formatTabelaoAddress(item));
    expect(buildTabelaoMapsUrl(item)).toBe(buildTabelaoMapsUrl(item));
    expect(item).toEqual(original);
  });
});
