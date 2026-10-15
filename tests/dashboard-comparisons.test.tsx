import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardComparisons } from "@/app/(protected)/app/_components/DashboardComparisons";
import type { OperationalComparison } from "@/lib/crm/dashboard/presentation";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

function elements(node: Node, tag: string): Element[] {
  const found: Element[] = "tagName" in node && node.tagName === tag ? [node] : [];
  if ("childNodes" in node)
    for (const child of node.childNodes) found.push(...elements(child, tag));
  return found;
}

function text(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join("") : "";
}

function attribute(node: Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function fixture(): OperationalComparison[] {
  return [
    {
      key: "month",
      label: "Mês",
      comparison: "Mês anterior × mês atual",
      previous: 800,
      current: 1000,
      variation: 0.25,
      goal: 1600,
      goalProgress: 0.625,
    },
    {
      key: "fourteen-days",
      label: "Últimos 14 dias",
      comparison: "14 dias anteriores × 14 dias atuais",
      previous: null,
      current: null,
      variation: null,
      goal: null,
      goalProgress: null,
    },
    {
      key: "seven-days",
      label: "Últimos 7 dias",
      comparison: "7 dias anteriores × 7 dias atuais",
      previous: 0,
      current: 0,
      variation: null,
      goal: 0,
      goalProgress: null,
    },
    {
      key: "week",
      label: "Semana",
      comparison: "Semana passada × semana atual",
      previous: 20,
      current: 10,
      variation: -0.5,
      goal: 5,
      goalProgress: 2,
    },
    {
      key: "day",
      label: "Dia",
      comparison: "Ontem × hoje",
      previous: 0,
      current: 0,
      variation: 0,
      goal: 10,
      goalProgress: 0,
    },
  ];
}

function render(rows = fixture(), label = "Agendamentos") {
  return parseFragment(renderToStaticMarkup(createElement(DashboardComparisons, { label, rows })));
}

function bodyRows(root: Node) {
  return elements(elements(root, "tbody")[0]!, "tr");
}

describe("DashboardComparisons: SSR com dados sinteticos", () => {
  it.each(["Agendamentos", "Visitas", "Pastas", "Vendas"])(
    "transpoe os cinco periodos em uma unica linha Realizado para %s",
    (label) => {
      const root = render(fixture(), label);
      expect(elements(root, "table")).toHaveLength(1);
      expect(elements(root, "caption").map(text)).toEqual([`${label}: realizado por intervalo`]);
      const headers = elements(elements(root, "thead")[0]!, "th");
      expect(headers.map(text)).toEqual([
        "Indicador",
        "Mês",
        "Últimos 14 dias",
        "Últimos 7 dias",
        "Esta Semana",
        "Hoje",
      ]);
      for (const header of headers) expect(attribute(header, "scope")).toBe("col");
      const rows = bodyRows(root);
      expect(rows).toHaveLength(1);
      expect(elements(rows[0]!, "th").map(text)).toEqual(["Realizado"]);
      expect(attribute(elements(rows[0]!, "th")[0]!, "scope")).toBe("row");
      expect(elements(rows[0]!, "td").map(text)).toEqual(["1.000", "Indisponível", "0", "10", "0"]);
      expect(text(root)).not.toMatch(/Anterior|Variação|Meta|%|comparação|×/);
      expect(elements(root, "svg")).toHaveLength(0);
    },
  );

  it("associa contagens por chave mesmo quando os periodos chegam fora de ordem", () => {
    const rows = fixture()
      .map((row, index) => ({ ...row, current: index + 1 }))
      .reverse();
    expect(elements(bodyRows(render(rows))[0]!, "td").map(text)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("mantem colunas ausentes como indisponiveis sem deslocar contagens ou fabricar zeros", () => {
    const root = render([fixture()[3]!]);
    expect(bodyRows(root)).toHaveLength(1);
    expect(elements(bodyRows(root)[0]!, "td").map(text)).toEqual([
      "Indisponível",
      "Indisponível",
      "Indisponível",
      "10",
      "Indisponível",
    ]);
    const unavailable = elements(root, "span");
    expect(unavailable).toHaveLength(4);
    for (const node of unavailable) {
      expect(attribute(node, "title")).toBe("Dados indisponíveis para este intervalo.");
      expect(attribute(node, "aria-label")).toBe(`Indisponível: ${attribute(node, "title")}`);
    }
  });

  it("preserva a unica linha e os cinco periodos quando a lista esta vazia", () => {
    const root = render([]);
    expect(bodyRows(root)).toHaveLength(1);
    expect(elements(bodyRows(root)[0]!, "th").map(text)).toEqual(["Realizado"]);
    expect(elements(bodyRows(root)[0]!, "td").map(text)).toEqual(Array(5).fill("Indisponível"));
  });

  it.each([NaN, Infinity, -Infinity])("trata %s como indisponivel", (current) => {
    const root = render([{ ...fixture()[0]!, current }]);
    expect(elements(bodyRows(root)[0]!, "td").map(text)).toEqual(Array(5).fill("Indisponível"));
    expect(text(root)).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("formata o realizado recebido sem recalcular ou limitar seu valor", () => {
    const root = render([{ ...fixture()[0]!, current: -12.5 }]);
    expect(text(elements(bodyRows(root)[0]!, "td")[0]!)).toBe("-12,5");
  });

  it("preserva semantica de tabela e uma regiao de rolagem nomeada acessivel por teclado", () => {
    const root = render();
    const region = elements(root, "div")[0]!;
    expect(attribute(region, "role")).toBe("region");
    expect(attribute(region, "aria-label")).toBe("Agendamentos: períodos");
    expect(attribute(region, "tabindex")).toBe("0");
    expect(attribute(elements(root, "table")[0]!, "role")).toBe("table");
    for (const tag of ["thead", "tbody"]) {
      expect(attribute(elements(root, tag)[0]!, "role")).toBe("rowgroup");
    }
    for (const row of elements(root, "tr")) expect(attribute(row, "role")).toBe("row");
    expect(attribute(elements(bodyRows(root)[0]!, "th")[0]!, "role")).toBe("rowheader");
    for (const cell of elements(root, "td")) expect(attribute(cell, "role")).toBe("cell");
    expect(
      renderToStaticMarkup(
        createElement(DashboardComparisons, { label: "Vendas", rows: fixture() }),
      ),
    ).not.toMatch(/style=/);
  });
});
