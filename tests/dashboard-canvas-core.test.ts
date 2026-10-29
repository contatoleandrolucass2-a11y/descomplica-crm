import { describe, expect, it } from "vitest";

import {
  CURRENT_DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_CANVAS_SCHEMA_VERSION,
  FREE_HEIGHT_CARD_LAYOUT_POLICY,
  canvasReducer,
  ceilingForPeriod,
  constrainCardLayout,
  createCanvasHistoryState,
  dashboardCardSignature,
  hasCanvasOverlap,
  inclusiveDayCount,
  migrateCanvasSchema,
  normalizeDashboardCard,
  packCanvas,
  resolveDashboardPeriod,
  resizeCardLayout,
  serializeCanvasSnapshot,
  type DashboardCard,
} from "@/lib/dashboard-canvas";
import {
  DashboardCanvas,
  type DashboardCanvasCommitHandler,
  type DashboardCanvasProps,
  type DashboardCanvasRenderer,
} from "@/lib/dashboard-canvas/ui";

function card(
  id: string,
  order: number,
  columnSpan = 6,
  overrides: Partial<DashboardCard> = {},
): DashboardCard {
  return {
    id,
    type: "bars",
    metric: `metric-${id}`,
    period: "month",
    groupBy: "entity",
    entityIds: null,
    layout: { order, columnSpan, height: 336 },
    ...overrides,
  };
}

describe("dashboard canvas periods", () => {
  it.each([
    ["2026-10-26", "2026-10-26", 1],
    ["2026-10-01", "2026-10-31", 31],
    ["2024-02-28", "2024-03-01", 3],
    ["0099-12-31", "0100-01-01", 2],
  ])("counts inclusive civil days from %s to %s", (start, end, expected) => {
    expect(inclusiveDayCount(start, end)).toBe(expected);
  });

  it("resolves today, current week, current month, global and custom periods", () => {
    const options = {
      today: "2026-10-25",
      globalRange: { start: "2026-01-01", end: "2026-10-25" },
      customRange: { start: "2026-10-10", end: "2026-10-12" },
    };
    expect(resolveDashboardPeriod("today", options)).toEqual({
      start: "2026-10-25",
      end: "2026-10-25",
    });
    expect(resolveDashboardPeriod("week", options)).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
    });
    expect(resolveDashboardPeriod("month", options)).toEqual({
      start: "2026-10-01",
      end: "2026-10-25",
    });
    expect(resolveDashboardPeriod("global", options)).toEqual(options.globalRange);
    expect(resolveDashboardPeriod("custom", options)).toEqual(options.customRange);
  });

  it("multiplies a daily ceiling by inclusive days without changing business thresholds", () => {
    expect(ceilingForPeriod(125.5, { start: "2026-10-10", end: "2026-10-12" })).toBe(376.5);
  });

  it("rejects invalid or reversed civil dates instead of normalizing them", () => {
    expect(() => inclusiveDayCount("2026-02-29", "2026-03-01")).toThrow(RangeError);
    expect(() => inclusiveDayCount("2026-10-12", "2026-10-10")).toThrow(RangeError);
  });
});

describe("dashboard canvas UI contract", () => {
  it("exports stable integration interfaces from the UI boundary", () => {
    const renderCard: DashboardCanvasRenderer = () => null;
    const onCommit: DashboardCanvasCommitHandler = () => undefined;
    const props: DashboardCanvasProps = { cards: [], onCommit, renderCard };
    expect(typeof DashboardCanvas).toBe("function");
    expect(props).toEqual({ cards: [], onCommit, renderCard });
  });
});

describe("dashboard canvas cards", () => {
  it("locks the delegated core schema and minimum height", () => {
    const minimumCard = normalizeDashboardCard({
      id: "minimum-card",
      type: "kpi",
      metric: "sales",
      period: "today",
      groupBy: "day",
      entityIds: null,
      layout: { order: 0, columnSpan: 2, height: 168 },
    });
    expect(DASHBOARD_CANVAS_SCHEMA_VERSION).toBe(2);
    expect(minimumCard?.layout.height).toBe(168);
  });

  it("creates a stable duplicate signature with sorted entity ids", () => {
    const first = card("first", 0, 6, {
      metric: "sales",
      entityIds: ["b", "a", "b"],
      period: "custom",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
    });
    const second = { ...first, id: "second", entityIds: ["a", "b"] };
    expect(dashboardCardSignature(first)).toBe(dashboardCardSignature(second));
  });

  it("normalizes serializable cards and applies type limits", () => {
    const normalized = normalizeDashboardCard({
      id: " table ",
      type: "table",
      metric: " revenue ",
      title: " Receita ",
      period: "custom",
      startDate: "2026-10-20",
      endDate: "2026-10-01",
      groupBy: "entity",
      entityIds: [" b ", "a", "b", ""],
      layout: { order: -4, columnSpan: 2, height: 200 },
      options: { showLegend: true, ignored: true },
    });
    expect(normalized).toEqual({
      id: "table",
      type: "table",
      metric: "revenue",
      title: "Receita",
      period: "global",
      groupBy: "entity",
      entityIds: ["b", "a"],
      layout: { order: 0, columnSpan: 6, height: 360 },
      options: { showLegend: true },
    });
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);
  });

  it("migrates legacy schema aliases to the current schema", () => {
    const migrated = migrateCanvasSchema({
      schemaVersion: 0,
      cards: [
        {
          id: "legacy",
          chartType: "kpi",
          metric: "sales",
          period: "today",
          groupBy: "day",
          entities: ["team-a"],
          order: 3,
          columnSpan: 5,
          height: 199,
          settings: { showGoal: true },
        },
      ],
    });
    expect(migrated).toEqual({
      schemaVersion: CURRENT_DASHBOARD_SCHEMA_VERSION,
      cards: [
        {
          id: "legacy",
          type: "kpi",
          metric: "sales",
          period: "today",
          groupBy: "day",
          entityIds: ["team-a"],
          layout: { order: 0, columnSpan: 5, height: 192 },
          options: { showGoal: true },
        },
      ],
    });
    expect(DASHBOARD_CANVAS_SCHEMA_VERSION).toBe(2);
    expect(serializeCanvasSnapshot(migrated)).toContain('"schemaVersion":2');
  });

  it("rejects unknown future schema versions", () => {
    expect(() => migrateCanvasSchema({ schemaVersion: 99, cards: [] })).toThrow(
      "Unsupported dashboard schemaVersion: 99.",
    );
  });
});

describe("dashboard canvas layout", () => {
  it("packs ordered cards into 12-column rows without overlap", () => {
    const packed = packCanvas([
      card("c", 2, 4),
      card("a", 0, 6),
      card("b", 1, 6),
      card("d", 3, 4),
      card("e", 4, 4),
    ]);
    expect(packed.map(({ card: entry, row, column }) => [entry.id, row, column])).toEqual([
      ["a", 1, 1],
      ["b", 1, 7],
      ["c", 2, 1],
      ["d", 2, 5],
      ["e", 2, 9],
    ]);
    expect(hasCanvasOverlap(packed)).toBe(false);
    expect(
      packed.every(({ column, columnSpan }) => column >= 1 && column + columnSpan - 1 <= 12),
    ).toBe(true);
  });

  it("clamps and snaps size by card type", () => {
    expect(constrainCardLayout("kpi", { order: 0, columnSpan: 2, height: 168 })).toEqual({
      order: 0,
      columnSpan: 2,
      height: 168,
    });
    expect(constrainCardLayout("kpi", { order: 1, columnSpan: 1, height: 185 })).toEqual({
      order: 1,
      columnSpan: 2,
      height: 192,
    });
    expect(constrainCardLayout("funnel", { order: 1, columnSpan: 4, height: 2_000 })).toEqual({
      order: 1,
      columnSpan: 4,
      height: 888,
    });
    expect(
      constrainCardLayout(
        "funnel",
        { order: 1, columnSpan: 4, height: 2_000 },
        FREE_HEIGHT_CARD_LAYOUT_POLICY,
      ),
    ).toEqual({ order: 1, columnSpan: 4, height: 1_992 });
    expect(
      resizeCardLayout({
        type: "bars",
        initial: { order: 0, columnSpan: 6, height: 336 },
        deltaX: 202,
        deltaY: -60,
        containerWidth: 1_200,
        gap: 0,
      }),
    ).toEqual({ order: 0, columnSpan: 8, height: 288 });
  });
});

describe("dashboard canvas reducer", () => {
  it("records one snapshot per completed move/resize and supports undo/redo", () => {
    let state = createCanvasHistoryState([card("a", 0), card("b", 1), card("c", 2)]);
    state = canvasReducer(state, { type: "move-card", cardId: "c", toIndex: 0 });
    expect(state.present.cards.map(({ id }) => id)).toEqual(["c", "a", "b"]);
    expect(state.history).toHaveLength(1);

    state = canvasReducer(state, {
      type: "resize-card",
      cardId: "c",
      layout: { columnSpan: 9, height: 405 },
    });
    expect(state.present.cards[0]?.layout).toEqual({ order: 0, columnSpan: 9, height: 408 });
    expect(state.history).toHaveLength(2);

    state = canvasReducer(state, { type: "undo" });
    expect(state.present.cards[0]?.layout).toEqual({ order: 0, columnSpan: 6, height: 336 });
    state = canvasReducer(state, { type: "undo" });
    expect(state.present.cards.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    state = canvasReducer(state, { type: "redo" });
    expect(state.present.cards.map(({ id }) => id)).toEqual(["c", "a", "b"]);
  });

  it("restores removed cards and clears future after a new change", () => {
    let state = createCanvasHistoryState([card("a", 0), card("b", 1)]);
    state = canvasReducer(state, { type: "remove-card", cardId: "b" });
    expect(state.present.cards.map(({ id }) => id)).toEqual(["a"]);
    state = canvasReducer(state, { type: "undo" });
    expect(state.present.cards.map(({ id }) => id)).toEqual(["a", "b"]);
    state = canvasReducer(state, { type: "remove-card", cardId: "a" });
    expect(state.future).toEqual([]);
    expect(canvasReducer(state, { type: "redo" })).toBe(state);
  });

  it("reports an existing card instead of adding a duplicate", () => {
    const existing = card("existing", 0, 6, { metric: "sales", entityIds: ["b", "a"] });
    const duplicate = card("copy", 1, 12, { metric: "sales", entityIds: ["a", "b"] });
    const initial = createCanvasHistoryState([existing]);
    const state = canvasReducer(initial, { type: "add-card", card: duplicate });
    expect(state.present.cards).toEqual(initial.present.cards);
    expect(state.history).toEqual([]);
    expect(state.duplicateCardId).toBe("existing");
  });

  it("enforces the configured history limit", () => {
    let state = createCanvasHistoryState([card("a", 0)], 2);
    for (const height of [360, 384, 408]) {
      state = canvasReducer(state, {
        type: "resize-card",
        cardId: "a",
        layout: { columnSpan: 6, height },
      });
    }
    expect(state.history).toHaveLength(2);
  });
});
