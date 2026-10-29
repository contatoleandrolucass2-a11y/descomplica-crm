import { describe, expect, it } from "vitest";
import {
  dashboardCardsSchema,
  dashboardCardsMatchPageLayout,
  dashboardProfileCreateSchema,
  dashboardProfileRecordSchema,
} from "@/lib/dashboard-canvas/persistence/schema";

const card = {
  id: "free-card",
  type: "kpi" as const,
  metric: "visits.total",
  period: "month" as const,
  groupBy: "day" as const,
  entityIds: null,
  layout: { order: 0, columnSpan: 1, height: 72, width: 128 },
};
const profile = { pageKey: "crm.stage.appointments", name: "Livre", cards: [card] };

describe("appointments pixel dimensions persistence", () => {
  it("accepts free dimensions only in the appointments envelope and preserves v2", () => {
    expect(dashboardProfileCreateSchema.parse(profile)).toMatchObject({
      schemaVersion: 2,
      cards: [card],
    });
    expect(dashboardCardsSchema.safeParse([card]).success).toBe(false);
    expect(
      dashboardProfileRecordSchema.parse({
        ...profile,
        id: "22222222-2222-4222-8222-222222222222",
        userId: "11111111-1111-4111-8111-111111111111",
        scopeKey: null,
        isDefault: true,
        schemaVersion: 2,
        version: 4,
        createdAt: "2026-10-29T20:00:00.000Z",
        updatedAt: "2026-10-29T21:00:00.000Z",
      }).cards[0]?.layout,
    ).toEqual(card.layout);
  });

  it.each([
    { width: 127 },
    { width: 16_385 },
    { width: 128.5 },
    { width: null },
    { height: 71 },
    { height: 16_385 },
    { height: 72.5 },
    { columnSpan: 0 },
    { columnSpan: 13 },
    { height: Number.NaN },
  ])("rejects invalid dimensional input %j", (patch) => {
    expect(
      dashboardProfileCreateSchema.safeParse({
        ...profile,
        cards: [{ ...card, layout: { ...card.layout, ...patch } }],
      }).success,
    ).toBe(false);
  });

  it("preserves the other pages' type bounds and rejects pixel width there", () => {
    const overview = {
      ...card,
      metric: "overview.current.month",
      layout: { order: 0, columnSpan: 2, height: 168 },
    };
    expect(
      dashboardProfileCreateSchema.safeParse({
        ...profile,
        pageKey: "crm.dashboard",
        cards: [overview],
      }).success,
    ).toBe(true);
    for (const layout of [
      card.layout,
      { ...overview.layout, width: 128 },
      { ...overview.layout, height: 167 },
      { ...overview.layout, columnSpan: 1 },
      { ...overview.layout, height: 481 },
    ]) {
      expect(
        dashboardProfileCreateSchema.safeParse({
          ...profile,
          pageKey: "crm.dashboard",
          cards: [{ ...overview, layout }],
        }).success,
      ).toBe(false);
      expect(dashboardCardsMatchPageLayout("crm.dashboard", [{ ...overview, layout }])).toBe(false);
    }
  });

  it("accepts legacy appointments without width and bounded maximum dimensions", () => {
    const legacy = { ...card, layout: { order: 0, columnSpan: 2, height: 288 } };
    expect(
      dashboardProfileCreateSchema.parse({ ...profile, cards: [legacy] }).cards[0]?.layout,
    ).toEqual(legacy.layout);
    expect(
      dashboardProfileCreateSchema.safeParse({
        ...profile,
        cards: [{ ...card, layout: { ...card.layout, width: 16_384, height: 16_384 } }],
      }).success,
    ).toBe(true);
  });
});
