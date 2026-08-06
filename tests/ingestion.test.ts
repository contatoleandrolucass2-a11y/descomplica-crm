import { describe, expect, it } from "vitest";

import { salesforceIngestionSchema } from "../lib/crm/ingestion/schema";
import { isSameOriginRequest, safeExternalUrl, secretsMatch } from "../lib/security/api";

const views = ["all", "with_canal_imob", "without_canal_imob"] as const;
const stages = ["opportunities", "appointments", "visits", "folders", "sales"] as const;

function validPayload() {
  return {
    schemaVersion: 2,
    requestId: "60000000-0000-4000-8000-000000000001",
    workflow: "salesforce_daily",
    dashboard: {
      snapshotKey: "global",
      referenceDate: "2026-08-04",
      generatedAt: "2026-08-04T06:00:00.000Z",
      timezone: "America/Sao_Paulo",
      source: "Salesforce",
      goalsAvailable: true,
      views: views.map((viewKey) => ({
        viewKey,
        salesValueMonth: 100,
        salesValueWeek: 20,
        salesValueToday: 5,
      })),
      metrics: views.flatMap((viewKey) =>
        stages.map((stageKey) => ({
          viewKey,
          stageKey,
          currentMonth: 10,
          currentWeek: 3,
          currentToday: 1,
          goalMonth: 20,
          goalWeek: 5,
          goalToday: 1,
          previousMonth: null,
          yearClosedMonthsAverage: null,
          lastThreeClosedMonthsAverage: null,
          previousFourteenDays: null,
          lastFourteenDays: null,
          previousSevenDays: null,
          lastSevenDays: null,
          previousWeek: null,
          yesterday: null,
        })),
      ),
      topDevelopments: [{ viewKey: "all", rank: 1, name: "Reserva", total: 3 }],
    },
    ranking: {
      snapshotKey: "global",
      referenceDate: "2026-08-04",
      generatedAt: "2026-08-04T06:00:00.000Z",
      timezone: "America/Sao_Paulo",
      source: "Salesforce",
      rouletteAvailable: true,
      participants: [
        {
          periodKey: "month",
          brokerKey: "ana-silva",
          brokerName: "Ana Silva",
          managerName: "Gerente A",
          roulette: 2,
          rouletteSaturday: 0,
          rouletteSunday: 0,
          schedule: 10,
          visit: 5,
          approvedFolder: 2,
          sale: 1,
        },
      ],
    },
  };
}

describe("Salesforce ingestion contract", () => {
  it("accepts a complete normalized dashboard and ranking snapshot", () => {
    expect(salesforceIngestionSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("rejects duplicate or incomplete dashboard identities", () => {
    const payload = validPayload();
    payload.dashboard.metrics[14] = payload.dashboard.metrics[0]!;
    expect(salesforceIngestionSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects duplicate ranking participants and unknown fields", () => {
    const payload = validPayload();
    payload.ranking.participants.push({ ...payload.ranking.participants[0]! });
    expect(salesforceIngestionSchema.safeParse(payload).success).toBe(false);
    expect(
      salesforceIngestionSchema.safeParse({ ...validPayload(), unexpected: true }).success,
    ).toBe(false);
  });

  it("requires dashboard and ranking to describe the same snapshot", () => {
    const payload = validPayload();
    payload.ranking.generatedAt = "2026-08-04T06:01:00.000Z";
    expect(salesforceIngestionSchema.safeParse(payload).success).toBe(false);
  });

  it("distinguishes unavailable sources from a real zero", () => {
    const unavailable = validPayload();
    unavailable.dashboard.goalsAvailable = false;
    unavailable.ranking.rouletteAvailable = false;
    for (const metric of unavailable.dashboard.metrics) {
      metric.goalMonth = 0;
      metric.goalWeek = 0;
      metric.goalToday = 0;
    }
    for (const participant of unavailable.ranking.participants) {
      participant.roulette = 0;
      participant.rouletteSaturday = 0;
      participant.rouletteSunday = 0;
    }
    expect(salesforceIngestionSchema.safeParse(unavailable).success).toBe(true);

    unavailable.dashboard.metrics[0]!.goalMonth = 1;
    unavailable.ranking.participants[0]!.roulette = 1;
    expect(salesforceIngestionSchema.safeParse(unavailable).success).toBe(false);
  });
});

describe("integration request boundaries", () => {
  it("compares long server secrets without exposing length-dependent buffers", () => {
    const secret = "a".repeat(32);
    expect(secretsMatch(secret, secret)).toBe(true);
    expect(secretsMatch("b".repeat(32), secret)).toBe(false);
    expect(secretsMatch("short", "short")).toBe(false);
  });

  it("requires the browser origin to match the application", () => {
    expect(
      isSameOriginRequest(
        new Request("https://crm.example.com/api/refresh/salesforce", {
          headers: { origin: "https://crm.example.com" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        new Request("https://crm.example.com/api/refresh/salesforce", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });

  it("requires HTTPS for external production webhooks", () => {
    expect(safeExternalUrl("https://automation.example/refresh", true)?.protocol).toBe("https:");
    expect(safeExternalUrl("http://automation.example/refresh", true)).toBeNull();
    expect(safeExternalUrl("https://user:pass@automation.example/refresh", true)).toBeNull();
  });
});
