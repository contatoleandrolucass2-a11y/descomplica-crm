import { describe, expect, it } from "vitest";
import {
  APPOINTMENTS_REFERENCE_WIDTH,
  fitPresentationCard,
  groupPresentationRows,
  isPresentationMetric,
  stepPresentation,
} from "../app/(protected)/_components/appointments-presentation";

describe("appointment presentation without profile mutation", () => {
  it("keeps a fixed logical composition while selecting charts after the overview", () => {
    expect(APPOINTMENTS_REFERENCE_WIDTH).toBe(1236);
    expect(isPresentationMetric("appointments.goal")).toBe(false);
    expect(isPresentationMetric("team.productive")).toBe(false);
    expect(isPresentationMetric("appointments.today")).toBe(false);
    expect(isPresentationMetric("appointments.funnel-comparison")).toBe(true);
    expect(isPresentationMetric("ranking.manager")).toBe(true);
    expect(isPresentationMetric(undefined)).toBe(false);
  });

  it("starts with the first chart, keeps saved order, and returns to the overview", () => {
    const order = Object.freeze(["funnel", "daily-copy", "daily", "table"]);
    expect(stepPresentation(order, null, "next")).toBe("funnel");
    expect(stepPresentation(order, "funnel", "next")).toBe("daily-copy");
    expect(stepPresentation(order, "daily-copy", "next")).toBe("daily");
    expect(stepPresentation(order, "daily-copy", "previous")).toBe("funnel");
    expect(stepPresentation(order, "funnel", "previous")).toBeNull();
    expect(stepPresentation(order, "table", "next")).toBe("table");
    expect(stepPresentation([], null, "next")).toBeNull();
    expect(stepPresentation(order, null, "previous")).toBe("table");
    expect(order).toEqual(["funnel", "daily-copy", "daily", "table"]);
  });

  it("navigates whole visual rows, including three rankings and two developments", () => {
    const cards = Object.freeze([
      { id: "funnel", top: 400, left: 0 },
      { id: "daily", top: 908, left: 0 },
      { id: "today", top: 1416, left: 0 },
      { id: "weekly", top: 1416.5, left: 404 },
      { id: "score", top: 1417, left: 808 },
      { id: "owner", top: 1924, left: 0 },
      { id: "manager", top: 1924, left: 404 },
      { id: "regional", top: 1924, left: 808 },
      { id: "pdv", top: 2432, left: 0 },
      { id: "development", top: 2432, left: 610 },
      { id: "table", top: 2940, left: 0 },
    ]);
    const rows = groupPresentationRows(cards);
    expect(rows).toEqual([
      ["funnel"],
      ["daily"],
      ["today", "weekly", "score"],
      ["owner", "manager", "regional"],
      ["pdv", "development"],
      ["table"],
    ]);
    const rowIds = rows.map((row) => row[0]!);
    expect(stepPresentation(rowIds, "daily", "next")).toBe("today");
    expect(stepPresentation(rowIds, "today", "next")).toBe("owner");
    expect(stepPresentation(rowIds, "owner", "previous")).toBe("today");
    expect(cards.map((card) => card.id)).toEqual(rows.flat());
  });

  it("groups by actual geometry after user reordering, rather than metric or input order", () => {
    expect(
      groupPresentationRows([
        { id: "last", top: 1000, left: 0 },
        { id: "right", top: 0.5, left: 500 },
        { id: "left", top: 0, left: 0 },
        { id: "middle", top: 0, left: 250 },
      ]),
    ).toEqual([["left", "middle", "right"], ["last"]]);
    expect(groupPresentationRows([])).toEqual([]);
  });

  it.each([
    { card: { width: 1205, height: 500 }, area: { width: 1220, height: 780 } },
    { card: { width: 396, height: 500 }, area: { width: 1220, height: 480 } },
    { card: { width: 1205, height: 900 }, area: { width: 330, height: 600 } },
    { card: { width: 1205, height: 500 }, area: { width: 780, height: 240 } },
    { card: { width: 1205, height: 500 }, area: { width: 300, height: 150 } },
  ])("fits both axes and retains aspect ratio: $card in $area", ({ card, area }) => {
    const scale = fitPresentationCard(card, area);
    expect(card.width * scale).toBeLessThanOrEqual(area.width + 0.001);
    expect(card.height * scale).toBeLessThanOrEqual(area.height + 0.001);
    expect((card.width * scale) / (card.height * scale)).toBeCloseTo(card.width / card.height);
  });
});
