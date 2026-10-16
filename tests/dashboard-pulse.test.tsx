import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DashboardPulse,
  type DashboardPulseProps,
} from "@/app/(protected)/app/_components/DashboardPulse";
import { DASHBOARD_STAGES, type DashboardStageKey } from "@/lib/crm/dashboard/catalog";
import type { FunnelReading } from "@/lib/crm/dashboard/presentation";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

function elements(node: Node, tag: string): Element[] {
  const found = "tagName" in node && node.tagName === tag ? [node] : [];
  return "childNodes" in node
    ? [...found, ...node.childNodes.flatMap((child) => elements(child, tag))]
    : found;
}

function content(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(content).join("") : "";
}

function attribute(node: Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function fixture(
  overrides: Partial<FunnelReading> = {},
  goal: number | null = 10,
): DashboardPulseProps {
  const keys = Object.keys(DASHBOARD_STAGES) as DashboardStageKey[];
  return {
    readings: keys.map((key) => ({
      key,
      label: DASHBOARD_STAGES[key].label,
      value: 5,
      conversion: key === "opportunities" ? null : 0.5,
      ...(key === "appointments" ? overrides : {}),
    })),
    goals: { opportunities: goal, appointments: goal, visits: goal, folders: goal, sales: goal },
  };
}

function render(props: DashboardPulseProps) {
  return parseFragment(renderToStaticMarkup(<DashboardPulse {...props} />));
}

function appointment(props: DashboardPulseProps) {
  return elements(render(props), "li")[1]!;
}

describe("DashboardPulse", () => {
  it("preserves the five stages, quantities, goals, progress and assessment", () => {
    const document = render(fixture());
    expect(elements(document, "h3").map(content)).toEqual(
      Object.values(DASHBOARD_STAGES).map((stage) => stage.label),
    );
    const card = elements(document, "li")[1]!;
    expect(elements(card, "dt").map(content)).toEqual([
      "Quantidade",
      "Meta",
      "% realizado da meta",
    ]);
    expect(elements(card, "dd").map(content)).toEqual(["5", "10", "50%"]);
    expect(elements(card, "p").map(content)).toEqual(["Faltam 5 para a meta"]);
    expect(attribute(elements(card, "figure")[0]!, "aria-label")).toBe(
      "Oportunidades para agendamentos: 50%",
    );
    expect(attribute(elements(card, "circle")[1]!, "stroke-dasharray")).toBe("50 50");
  });

  it("keeps missing values and their accessible reasons without substituting zero", () => {
    const card = appointment(fixture({ value: null, conversion: null }, null));
    expect(elements(card, "dd").map(content)).toEqual([
      "N/DQuantidade indisponível para este intervalo.",
      "N/DMeta indisponível para o período.",
      "N/DSem base suficiente para calcular o realizado da meta.",
    ]);
    expect(attribute(elements(card, "figure")[0]!, "aria-label")).toContain(
      "Sem base suficiente para calcular a relação.",
    );
    expect(elements(card, "circle")).toHaveLength(1);
    expect(elements(card, "p").map(content)).toEqual(["Meta indisponível"]);
    expect(content(card)).not.toContain("0%");
  });

  it("distinguishes entry from an actual zero conversion", () => {
    const document = render(fixture({ value: 0, conversion: 0 }));
    const [entry, zero] = elements(document, "li");
    expect(attribute(elements(entry!, "figure")[0]!, "aria-label")).toBe(
      "Entrada do funil; conversão não se aplica.",
    );
    expect(content(entry!)).toContain("Entrada");
    expect(elements(zero!, "dd").map(content)).toEqual(["0", "10", "0%"]);
    expect(attribute(elements(zero!, "figure")[0]!, "aria-label")).toBe(
      "Oportunidades para agendamentos: 0%",
    );
    expect(elements(zero!, "circle")).toHaveLength(1);
    expect(elements(zero!, "p").map(content)).toEqual(["Faltam 10 para a meta"]);
  });

  it("renders exactly 100% without an overflow signal", () => {
    const card = appointment(fixture({ value: 10, conversion: 1 }));
    expect(attribute(elements(card, "circle")[1]!, "stroke-dasharray")).toBe("100 0");
    expect(attribute(elements(card, "figure")[0]!, "data-overflow")).toBe("false");
    expect(elements(card, "dd").map(content)).toEqual(["10", "10", "100%"]);
    expect(elements(card, "p").map(content)).toEqual(["Meta atingida"]);
    expect(content(card)).not.toContain("Acima de 100%");
  });

  it("retains 226.7% as 226,7% and marks the circular scale overflow", () => {
    const card = appointment(fixture({ value: 2267, conversion: 2.267 }, 1000));
    expect(elements(card, "strong").map(content)).toContain("226,7%");
    expect(elements(card, "dd").map(content)).toEqual(["2.267", "1.000", "226,7%"]);
    expect(attribute(elements(card, "circle")[1]!, "stroke-dasharray")).toBe("100 0");
    expect(elements(card, "circle")).toHaveLength(3);
    expect(attribute(elements(card, "figure")[0]!, "aria-label")).toContain(
      "226,7%; acima de 100%. A rosca representa até 100%.",
    );
    expect(content(card)).toContain("Acima de 100%");
    expect(elements(card, "p").map(content)).toEqual(["Meta atingida"]);
  });

  it.each([null, -1])("keeps conversion available without a valid goal (%s)", (goal) => {
    const card = appointment(fixture({}, goal));
    expect(elements(card, "strong").map(content)).toContain("50%");
    expect(elements(card, "dd").map(content)).toEqual([
      "5",
      "N/DMeta indisponível para o período.",
      "N/DSem base suficiente para calcular o realizado da meta.",
    ]);
    expect(elements(card, "p").map(content)).toEqual(["Meta indisponível"]);
  });

  it.each([0, 5])("shows a zero goal with realized %s without dividing by zero", (value) => {
    const card = appointment(fixture({ value, conversion: value === 0 ? 0 : 0.5 }, 0));
    expect(elements(card, "dd").map(content)).toEqual([
      String(value),
      "0",
      "N/DSem base suficiente para calcular o realizado da meta.",
    ]);
    expect(elements(card, "p").map(content)).toEqual(["Meta atingida"]);
    expect(content(card)).not.toMatch(/NaN|Infinity|Meta indisponível/);
  });

  it("preserves a zero goal when realized data is unavailable", () => {
    const card = appointment(fixture({ value: null, conversion: null }, 0));
    expect(elements(card, "dd").map(content)).toEqual([
      "N/DQuantidade indisponível para este intervalo.",
      "0",
      "N/DSem base suficiente para calcular o realizado da meta.",
    ]);
    expect(elements(card, "p").map(content)).toEqual(["Realizado indisponível"]);
  });

  it("retains the goal when realized data is missing", () => {
    const card = appointment(fixture({ value: null, conversion: null }));
    expect(content(elements(card, "dd")[1]!)).toBe("10");
    expect(elements(card, "p").map(content)).toEqual(["Realizado indisponível"]);
  });

  it("identifies entry by stage key even when readings are reordered", () => {
    const props = fixture();
    props.readings.reverse();
    const figures = elements(render(props), "figure");
    expect(attribute(figures[0]!, "data-state")).toBe("value");
    expect(attribute(figures[0]!, "aria-label")).toBe("Pastas para vendas: 50%");
    expect(attribute(figures[4]!, "data-state")).toBe("entry");
  });
});
