import {
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { DashboardReport } from "@/app/(protected)/app/_components/DashboardReport";
import {
  OVERVIEW_CANVAS_CATALOG,
  OVERVIEW_CANVAS_COMPATIBILITY,
  OVERVIEW_CANVAS_DEFAULT_CARDS,
  OVERVIEW_CANVAS_GROUPS,
  OVERVIEW_CANVAS_PAGE_KEY,
} from "@/app/(protected)/app/_components/dashboard-canvas-config";
import { ConfigurableDashboardCanvas } from "@/lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas";
import type { ConfigurableDashboardCanvasProps } from "@/lib/dashboard-canvas/ui/configurable/types";
import { emptyDashboardFilters } from "@/lib/crm/dashboard/analysis";
import { DASHBOARD_CHANNELS } from "@/lib/crm/dashboard/analysis-contract";

function findElement(
  node: ReactNode,
  type: typeof ConfigurableDashboardCanvas,
): ReactElement<ConfigurableDashboardCanvasProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, type);
      if (match) return match;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === type) return node as ReactElement<ConfigurableDashboardCanvasProps>;
  return findElement(node.props.children, type);
}

function reportProps(filters = emptyDashboardFilters()): ComponentProps<typeof DashboardReport> {
  return {
    dashboard: null,
    selectedView: "all",
    selectedPeriod: "month",
    authorizedViews: ["all"],
    canViewStages: false,
    canRefresh: false,
    canViewRanking: false,
    filters,
  };
}

function report(filters = emptyDashboardFilters()) {
  const canvas = findElement(DashboardReport(reportProps(filters)), ConfigurableDashboardCanvas);
  expect(canvas).not.toBeNull();
  return canvas!.props;
}

describe("Visão Geral configurável", () => {
  it("preserva os 13 funis na ordem inicial 3 + 5 + 5", () => {
    expect(OVERVIEW_CANVAS_PAGE_KEY).toBe("crm.dashboard");
    expect(OVERVIEW_CANVAS_GROUPS.map(({ metricKeys }) => metricKeys.length)).toEqual([3, 5, 5]);
    expect(OVERVIEW_CANVAS_DEFAULT_CARDS).toHaveLength(13);
    expect(OVERVIEW_CANVAS_DEFAULT_CARDS.map(({ layout }) => layout.order)).toEqual(
      Array.from({ length: 13 }, (_, index) => index),
    );
    expect(OVERVIEW_CANVAS_DEFAULT_CARDS.map(({ layout }) => layout.columnSpan)).toEqual([
      4, 4, 4, 2, 2, 2, 3, 3, 2, 2, 2, 3, 3,
    ]);
  });

  it("expõe somente o modelo e os parâmetros que cada conteúdo renderiza", () => {
    expect(OVERVIEW_CANVAS_CATALOG.types).toEqual([{ value: "funnel", label: "Funil" }]);
    expect(OVERVIEW_CANVAS_CATALOG.groups).toEqual([{ value: "entity", label: "Funil comercial" }]);
    expect(OVERVIEW_CANVAS_CATALOG.options).toEqual([]);
    for (const card of OVERVIEW_CANVAS_DEFAULT_CARDS) {
      expect(OVERVIEW_CANVAS_COMPATIBILITY.typesByMetric?.[card.metric]).toEqual(["funnel"]);
      expect(OVERVIEW_CANVAS_COMPATIBILITY.groupsByMetric?.[card.metric]).toEqual(["entity"]);
      expect(OVERVIEW_CANVAS_COMPATIBILITY.periodsByMetric?.[card.metric]).toEqual([card.period]);
      expect(OVERVIEW_CANVAS_COMPATIBILITY.optionsByMetric?.[card.metric]).toEqual([]);
    }
  });

  it("liga conteúdo por métrica e separa perfis House e Imob", () => {
    const house = report();
    expect(house.pageKey).toBe("crm.dashboard");
    expect(house.scopeKey).toBe("channel.house");
    expect(Object.keys(house.contentByMetricAndType ?? {})).toEqual(
      OVERVIEW_CANVAS_DEFAULT_CARDS.map(({ metric }) => metric),
    );
    for (const content of Object.values(house.contentByMetricAndType ?? {})) {
      expect(Object.keys(content)).toEqual(["funnel"]);
      expect(isValidElement(content.funnel)).toBe(true);
    }

    const filters = emptyDashboardFilters();
    filters.channel = [DASHBOARD_CHANNELS[0]];
    expect(report(filters).scopeKey).toBe("channel.partnerships");
  });

  it("renderiza um funil por card e mantém a associação aos três grupos", () => {
    const html = renderToStaticMarkup(createElement(DashboardReport, reportProps()));
    expect(html.match(/data-dashboard-card-id=/g)).toHaveLength(13);
    expect(html.match(/aria-label="Funil mensal:/g)).toHaveLength(13);
    expect(html.match(/data-dashboard-group="goals"/g)).toHaveLength(3);
    expect(html.match(/data-dashboard-group="periods"/g)).toHaveLength(5);
    expect(html.match(/data-dashboard-group="history"/g)).toHaveLength(5);
  });
});
