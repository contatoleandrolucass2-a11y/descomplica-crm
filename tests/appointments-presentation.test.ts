import { describe, expect, it } from "vitest";
import {
  APPOINTMENTS_REFERENCE_WIDTH,
  fitPresentationCard,
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
    expect(order).toEqual(["funnel", "daily-copy", "daily", "table"]);
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
