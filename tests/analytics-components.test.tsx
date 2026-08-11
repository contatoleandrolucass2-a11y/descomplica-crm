import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AnalyticsSkeleton,
  AnalyticsTable,
  DataState,
  FilterBar,
  FilterGroup,
  FilterLink,
  FunnelChart,
  Gauge,
  MetricCard,
  RankingList,
} from "../app/(protected)/app/_components/analytics";

describe("analytical design system", () => {
  it("keeps an unavailable goal distinct from a real zero", () => {
    const unavailable = renderToStaticMarkup(
      <MetricCard
        label="Vendas"
        value="0"
        detail="Meta oficial indisponível"
        ratio={null}
        ratioLabel="Indisponível"
      />,
    );

    expect(unavailable).toContain(">0<");
    expect(unavailable).toContain("Indisponível");
    expect(unavailable).not.toContain("stroke-dasharray");
    expect(unavailable).not.toContain("0%");
  });

  it("clamps only the visual arc while preserving the formatted reading", () => {
    const markup = renderToStaticMarkup(
      <MetricCard
        label="Oportunidades"
        value="140"
        detail="Meta: 100"
        ratio={1.4}
        ratioLabel="140%"
      />,
    );

    expect(markup).toContain("140%");
    expect(markup).toContain('stroke-dasharray="100 0"');
  });

  it("renders real zero and unavailable funnel readings without substitution", () => {
    const markup = renderToStaticMarkup(
      <FunnelChart
        label="Funil validado"
        stages={[
          { key: "a", label: "Entrada", value: 0, conversion: null },
          { key: "b", label: "Saída", value: null, conversion: null },
        ]}
      />,
    );

    expect(markup).toContain("Entrada do funil");
    expect(markup).toContain(">0<");
    expect(markup).toContain("Indisponível");
    expect(markup).toContain("Conversão indisponível");
  });

  it("renders a gauge with textual fallback when no official target exists", () => {
    const markup = renderToStaticMarkup(
      <Gauge label="Atingimento da meta" value="Indisponível" ratio={null} />,
    );

    expect(markup).toContain("Atingimento da meta: indisponível");
    expect(markup).toContain("Indisponível");
    expect(markup).not.toContain("stroke-dasharray");
  });

  it("exposes only real link filters and labels unavailable dimensions", () => {
    const markup = renderToStaticMarkup(
      <FilterBar label="Filtros autorizados" unavailableDimensions={["Gerente", "Empresa"]}>
        <FilterGroup label="Período">
          <FilterLink href="/app?period=month" active>
            Mês
          </FilterLink>
        </FilterGroup>
      </FilterBar>,
    );

    expect(markup).toContain('aria-label="Filtros autorizados"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("Filtros dimensionais indisponíveis");
    expect(markup).toContain("Gerente");
    expect(markup).toContain("Empresa");
  });

  it("keeps tables semantic and horizontally reachable by keyboard", () => {
    const rows = [{ id: "one", label: "Oportunidades", value: 12 }];
    const markup = renderToStaticMarkup(
      <AnalyticsTable
        caption="Indicadores reais"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: "label", label: "Etapa", render: (row) => row.label },
          {
            key: "value",
            label: "Valor",
            align: "right",
            render: (row) => row.value,
          },
        ]}
      />,
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("<caption>Indicadores reais</caption>");
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('scope="row"');
  });

  it("preserves the ranking order supplied by the validated source", () => {
    const markup = renderToStaticMarkup(
      <RankingList
        items={[
          { id: "two", rank: 2, name: "Segundo", value: "8" },
          { id: "one", rank: 1, name: "Primeiro", value: "10" },
        ]}
      />,
    );

    expect(markup.indexOf("Segundo")).toBeLessThan(markup.indexOf("Primeiro"));
  });

  it("provides empty, stale, unavailable, error and loading semantics", () => {
    const empty = renderToStaticMarkup(
      <DataState variant="empty" title="Sem registros" description="Nada encontrado." />,
    );
    const unavailable = renderToStaticMarkup(
      <DataState
        variant="unavailable"
        title="Fonte pendente"
        description="Aguardando fonte oficial."
      />,
    );
    const stale = renderToStaticMarkup(
      <DataState variant="stale" title="Fonte atrasada" description="Watermark preservado." />,
    );
    const error = renderToStaticMarkup(
      <DataState variant="error" title="Falha segura" description="Tente novamente." />,
    );
    const loading = renderToStaticMarkup(<AnalyticsSkeleton />);

    expect(empty).toContain("Sem dados");
    expect(unavailable).toContain("Indisponível");
    expect(stale).toContain('data-variant="stale"');
    expect(stale).toContain('role="status"');
    expect(error).toContain('role="alert"');
    expect(loading).toContain('aria-busy="true"');
  });

  it("disables skeleton motion when reduced motion is requested", () => {
    const stylesheet = readFileSync(
      new URL("../app/(protected)/app/_components/analytics/analytics.module.css", import.meta.url),
      "utf8",
    );

    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toMatch(/\.skeletonLine,[\s\S]*animation: none/);
  });

  it("does not encode invented funnel proportions and keeps long ranking names readable", () => {
    const stylesheet = readFileSync(
      new URL("../app/(protected)/app/_components/analytics/analytics.module.css", import.meta.url),
      "utf8",
    );

    expect(stylesheet).toMatch(/\.funnelStep \{[\s\S]*?width: 100%/);
    expect(stylesheet).not.toContain(".funnelStep:nth-child");
    expect(stylesheet).toMatch(/\.rankingName \{[\s\S]*?overflow-wrap: anywhere/);
    expect(stylesheet).toMatch(/\.rankingName \{[\s\S]*?white-space: normal/);
  });
});
