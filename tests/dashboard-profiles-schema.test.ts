import { describe, expect, it } from "vitest";

import {
  dashboardCardsSchema,
  dashboardProfileCreateSchema,
  dashboardProfilePatchSchema,
} from "@/lib/dashboard-canvas/persistence/schema";

const card = {
  id: "card-1",
  type: "bars" as const,
  metric: "appointments.total",
  title: "Agendamentos",
  period: "month" as const,
  groupBy: "day" as const,
  entityIds: null,
  layout: { order: 0, columnSpan: 6, height: 360 },
  options: { showLegend: true },
};

describe("dashboard profile persistence schema", () => {
  it("normalizes safe profile text and defaults server-owned fields", () => {
    expect(
      dashboardProfileCreateSchema.parse({
        pageKey: "crm.stage.appointments",
        name: "  Meu painel  ",
        cards: [card],
      }),
    ).toEqual({
      pageKey: "crm.stage.appointments",
      scopeKey: null,
      name: "Meu painel",
      isDefault: false,
      schemaVersion: 2,
      cards: [card],
    });
  });

  it("rejects malformed cards", () => {
    const candidates = [
      { ...card, period: "custom" },
      { ...card, period: "custom", startDate: "2026-02-30", endDate: "2026-03-01" },
      { ...card, period: "today", startDate: "2026-10-26" },
      { ...card, layout: { ...card.layout, columnSpan: 13 } },
      { ...card, layout: { ...card.layout, height: 239 } },
      { ...card, entityIds: ["channel.house", "channel.house"] },
      { ...card, title: "<script>" },
    ];
    for (const candidate of candidates) {
      expect(dashboardCardsSchema.safeParse([candidate]).success).toBe(false);
    }
  });

  it("uses schema v2, accepts KPI height 168 and rejects page catalog escapes", () => {
    const kpi = {
      ...card,
      type: "kpi" as const,
      layout: { ...card.layout, columnSpan: 2, height: 168 },
    };
    expect(
      dashboardProfileCreateSchema.safeParse({
        pageKey: "crm.stage.appointments",
        name: "KPI",
        cards: [kpi],
      }).success,
    ).toBe(true);
    expect(
      dashboardCardsSchema.safeParse([{ ...kpi, layout: { ...kpi.layout, height: 167 } }]).success,
    ).toBe(false);
    expect(
      dashboardProfileCreateSchema.safeParse({
        pageKey: "crm.stage.appointments",
        name: "Métrica inválida",
        cards: [{ ...card, metric: "finance.revenue" }],
      }).success,
    ).toBe(false);
    expect(
      dashboardProfileCreateSchema.safeParse({
        pageKey: "crm.stage.appointments",
        name: "Entidade inválida",
        cards: [{ ...card, entityIds: ["manager.untrusted"] }],
      }).success,
    ).toBe(false);
  });

  it("accepts bounded presentation controls and rejects unsafe values", () => {
    const presented = {
      ...card,
      presentation: {
        content: "Prioridade do mês",
        fontScale: 1.15,
        textAlign: "left" as const,
        verticalAlign: "start" as const,
        textColor: "#d9e8f2",
        accentColor: "#55c4dc",
        barScale: 1.25,
      },
    };
    expect(dashboardCardsSchema.safeParse([presented]).success).toBe(true);
    expect(
      dashboardCardsSchema.safeParse([
        { ...presented, presentation: { ...presented.presentation, fontScale: 9 } },
      ]).success,
    ).toBe(false);
    expect(
      dashboardCardsSchema.safeParse([
        { ...presented, presentation: { ...presented.presentation, textColor: "red" } },
      ]).success,
    ).toBe(false);
  });

  it("accepts only the registered overview metrics on the overview page", () => {
    const overview = {
      ...card,
      id: "overview-goal",
      type: "funnel" as const,
      metric: "overview.goal.month",
      layout: { order: 0, columnSpan: 4, height: 384 },
    };
    expect(
      dashboardProfileCreateSchema.safeParse({
        pageKey: "crm.dashboard",
        name: "Visão geral",
        cards: [overview],
      }).success,
    ).toBe(true);
    expect(
      dashboardProfileCreateSchema.safeParse({
        pageKey: "crm.dashboard",
        name: "Métrica alheia",
        cards: [{ ...overview, metric: "appointments.daily" }],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate identity, order and logical signature", () => {
    const sameSignature = {
      ...card,
      id: "card-2",
      layout: { ...card.layout, order: 1 },
      entityIds: ["channel.partnerships", "channel.house"],
    };
    const first = { ...card, entityIds: ["channel.house", "channel.partnerships"] };
    expect(dashboardCardsSchema.safeParse([first, sameSignature]).success).toBe(false);
    expect(
      dashboardCardsSchema.safeParse([
        card,
        {
          ...card,
          id: "card-2",
          metric: "appointments.rate",
          layout: { ...card.layout, order: 0 },
        },
      ]).success,
    ).toBe(false);
  });

  it("requires optimistic version and at least one mutable field", () => {
    expect(dashboardProfilePatchSchema.safeParse({ version: 4 }).success).toBe(false);
    expect(dashboardProfilePatchSchema.safeParse({ version: 4, name: "Novo nome" }).success).toBe(
      true,
    );
    expect(dashboardProfilePatchSchema.safeParse({ version: 0, cards: [] }).success).toBe(false);
  });
});
