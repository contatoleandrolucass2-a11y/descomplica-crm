import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SimulatorWorkspace } from "../app/(protected)/app/simulacao/_components/SimulatorWorkspace";
import { SIMULATORS, SIMULATOR_LIST, isSimulatorSlug } from "../lib/crm/simulators/catalog";

describe("simulator visual catalog", () => {
  it("maps the five user-approved simulator identities without inventing another route", () => {
    expect(SIMULATOR_LIST.map(({ slug, code }) => [slug, code])).toEqual([
      ["associativo-fluxo-linear", "WF13"],
      ["calcular-documentacao", "WF16"],
      ["caixa", "CAIXA"],
      ["tabela-direta", "WF14"],
      ["tabela-investidor", "WF15"],
    ]);
    expect(isSimulatorSlug("caixa")).toBe(true);
    expect(isSimulatorSlug("regra-nao-aprovada")).toBe(false);
  });

  it.each(SIMULATOR_LIST)("renders full $code composition with a blocked engine", (definition) => {
    const markup = renderToStaticMarkup(<SimulatorWorkspace definition={definition} />);
    const fieldCount = definition.sections.reduce(
      (total, section) => total + section.fields.length,
      0,
    );

    expect(definition.sections.length).toBeGreaterThan(1);
    expect(fieldCount).toBeGreaterThan(5);
    expect(definition.resultItems.length).toBeGreaterThan(3);
    expect(markup).toContain(definition.title);
    expect(markup).toContain("Cálculo temporariamente indisponível — regra aguardando validação");
    expect(markup).toContain("Nenhuma fórmula da referência foi copiada");
    expect(markup).toContain('aria-label="Ferramentas de simulação"');
    expect(markup).toContain("disabled");
    expect(markup).not.toContain("<output");
    expect(markup).not.toContain("action=");
  });

  it("keeps every field id unique inside the longest simulator", () => {
    const markup = renderToStaticMarkup(
      <SimulatorWorkspace definition={SIMULATORS["associativo-fluxo-linear"]} />,
    );
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
