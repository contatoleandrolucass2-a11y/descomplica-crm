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
    "preserva caption, cinco intervalos e seis colunas para %s",
    (label) => {
      const root = render(fixture(), label);
      expect(elements(root, "table")).toHaveLength(1);
      expect(elements(root, "caption").map(text)).toEqual([
        `${label}: realizado, comparação e meta por intervalo`,
      ]);
      expect(elements(root, "h3")).toHaveLength(0);
      const headers = elements(elements(root, "thead")[0]!, "th");
      expect(headers.map(text)).toEqual([
        "Intervalo",
        "Anterior",
        "Realizado",
        "Variação",
        "Meta",
        "% realizado da meta",
      ]);
      for (const header of headers) expect(attribute(header, "scope")).toBe("col");
      const rows = bodyRows(root);
      expect(rows).toHaveLength(5);
      rows.forEach((row, index) => {
        const heading = elements(row, "th");
        expect(heading).toHaveLength(1);
        expect(attribute(heading[0]!, "scope")).toBe("row");
        expect(elements(row, "strong").map(text)).toEqual([fixture()[index]!.label]);
        expect(elements(heading[0]!, "span").map(text)).toEqual([fixture()[index]!.comparison]);
        expect(elements(row, "td")).toHaveLength(5);
      });
    },
  );

  it("distingue nulos, zeros, queda e meta superada sem recalcular os dados", () => {
    const root = render();
    expect(bodyRows(root).map((row) => elements(row, "td").map(text))).toEqual([
      ["800", "1.000", "+25%", "1.600", "62,5%"],
      Array(5).fill("Indisponível"),
      ["0", "0", "Indisponível", "0", "Indisponível"],
      ["20", "10", "-50%", "5", "200%"],
      ["0", "0", "0%", "10", "0%"],
    ]);
    expect(elements(bodyRows(root)[0]!, "b").map(text)).toEqual(["1.000"]);
    const unavailable = elements(bodyRows(root)[1]!, "span").filter((node) =>
      attribute(node, "title"),
    );
    expect(unavailable).toHaveLength(5);
    for (const node of unavailable) {
      expect(attribute(node, "aria-label")).toBe(`Indisponível: ${attribute(node, "title")}`);
    }
  });

  it("mantem sinais e numeros negativos sem limitar percentuais de meta", () => {
    const rows = [
      {
        ...fixture()[0]!,
        previous: -12.5,
        current: -5,
        variation: -1.25,
        goal: -10,
        goalProgress: -0.5,
      },
    ];
    expect(elements(bodyRows(render(rows))[0]!, "td").map(text)).toEqual([
      "-12,5",
      "-5",
      "-125%",
      "-10",
      "-50%",
    ]);
  });

  it("usa setas Lucide decorativas com sinal textual e estado neutro distinto", () => {
    const root = render();
    const variations = elements(root, "span").filter((node) => attribute(node, "data-direction"));
    expect(variations.map((node) => attribute(node, "data-direction"))).toEqual([
      "up",
      "down",
      "flat",
    ]);
    expect(variations.map(text)).toEqual(["+25%", "-50%", "0%"]);
    const icons = elements(root, "svg");
    expect(icons).toHaveLength(3);
    for (const icon of icons) {
      expect(attribute(icon, "aria-hidden")).toBe("true");
      expect(attribute(icon, "focusable")).toBe("false");
    }
  });

  it("preserva papeis de tabela e rotulos mobile sem estilos inline", () => {
    const root = render();
    expect(attribute(elements(root, "table")[0]!, "role")).toBe("table");
    expect(attribute(elements(root, "thead")[0]!, "role")).toBe("rowgroup");
    for (const row of bodyRows(root)) {
      expect(attribute(row, "role")).toBe("row");
      expect(attribute(elements(row, "th")[0]!, "role")).toBe("rowheader");
      expect(elements(row, "td").map((cell) => attribute(cell, "data-label"))).toEqual([
        "Anterior",
        "Realizado",
        "Variação",
        "Meta",
        "% realizado da meta",
      ]);
      for (const cell of elements(row, "td")) expect(attribute(cell, "role")).toBe("cell");
    }
    expect(
      renderToStaticMarkup(
        createElement(DashboardComparisons, { label: "Vendas", rows: fixture() }),
      ),
    ).not.toMatch(/style=|NaN|Infinity|undefined/);
  });

  it("trata numeros nao finitos como indisponiveis e informa lista vazia", () => {
    const rows = [
      {
        ...fixture()[0]!,
        previous: NaN,
        current: Infinity,
        variation: -Infinity,
        goal: NaN,
        goalProgress: Infinity,
      },
    ];
    expect(elements(bodyRows(render(rows))[0]!, "td").map(text)).toEqual(
      Array(5).fill("Indisponível"),
    );
    const empty = elements(bodyRows(render([]))[0]!, "td");
    expect(empty.map(text)).toEqual(["Nenhum intervalo disponível."]);
    expect(attribute(empty[0]!, "colspan")).toBe("6");
  });
});
