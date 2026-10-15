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

function validAnalysis() {
  return {
    version: 1,
    coverageStart: "2026-01-01",
    referenceDate: "2026-08-04",
    views: views.map((viewKey) => ({
      viewKey,
      dimensions: {
        managers: ["Gerente sintetico"],
        owners: ["Corretor sintetico"],
        companies: ["Empresa sintetica"],
        developments: ["Empreendimento sintetico"],
      },
      facts: [
        [3, "2026-08-04", 0, 0, 0, viewKey === "without_canal_imob" ? 1 : 0, 0, 2, 0, 1],
        [4, "2026-08-04", -1, -1, -1, viewKey === "without_canal_imob" ? 1 : 0, -1, 1, 250000, 0],
      ],
    })),
  };
}

describe("Salesforce optional packed analysis", () => {
  function payloadWithAnalysis(analysis: unknown = validAnalysis()) {
    const payload = validPayload();
    return { ...payload, dashboard: { ...payload.dashboard, analysis } };
  }

  it("preserves the optional extension and accepts legacy v2 without analysis", () => {
    expect(salesforceIngestionSchema.parse(payloadWithAnalysis()).dashboard.analysis).toEqual(
      validAnalysis(),
    );
    expect(salesforceIngestionSchema.parse(validPayload()).dashboard.analysis).toBeUndefined();
  });

  it("rejects metadata for another dashboard snapshot", () => {
    const result = salesforceIngestionSchema.safeParse(
      payloadWithAnalysis({
        ...validAnalysis(),
        referenceDate: "2026-08-05",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["dashboard", "analysis", "referenceDate"],
          message: "dashboard analysis must belong to the same snapshot",
        }),
      );
    }
  });

  it.each([null, [], 1, { ...validAnalysis(), version: 2 }, { ...validAnalysis(), ranking: [] }])(
    "rejects malformed, unsupported or extra analysis fields (%#)",
    (analysis) => {
      expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(analysis)).success).toBe(
        false,
      );
    },
  );

  it.each([
    ["2026-02-30", "2026-08-04"],
    ["2026-01-02", "2026-08-04"],
    ["2026-09-01", "2026-08-04"],
    ["2026-01-01", "2026-02-30"],
    ["2025-04-01", "2026-08-04"],
    ["0001-01-01", "2026-08-04"],
  ])("rejects invalid coverage %s / %s", (coverageStart, referenceDate) => {
    expect(
      salesforceIngestionSchema.safeParse(
        payloadWithAnalysis({
          ...validAnalysis(),
          coverageStart,
          referenceDate,
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts coverage exactly fifteen months before the reference month", () => {
    expect(
      salesforceIngestionSchema.safeParse(
        payloadWithAnalysis({ ...validAnalysis(), coverageStart: "2025-05-01" }),
      ).success,
    ).toBe(true);
  });

  it("requires all three distinct views and forbids unknown dimension fields", () => {
    const analysis = validAnalysis();
    analysis.views[2] = analysis.views[0]!;
    expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(analysis)).success).toBe(false);
    const unknown = validAnalysis();
    Object.assign(unknown.views[0]!.dimensions, { ranking: [] });
    expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(unknown)).success).toBe(false);
  });

  it.each([
    [0, 5],
    [0, 0.5],
    [1, "2026-02-30"],
    [1, "2025-12-31"],
    [1, "2026-08-05"],
    [2, -2],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, -1],
    [5, 2],
    [6, 1],
    [7, 0],
    [7, 1.5],
    [7, 1000000001],
    [8, -1],
    [8, 1],
    [9, 3],
    [9, -1],
    [9, 0.5],
  ])("rejects invalid tuple cell %s = %s", (index, value) => {
    const analysis = validAnalysis();
    analysis.views[0]!.facts[0]![index as number] = value;
    expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(analysis)).success).toBe(false);
  });

  it("rejects sales with approval counts, excessive amounts, duplicate facts and extra tuple cells", () => {
    for (const mutate of [
      (analysis: ReturnType<typeof validAnalysis>) => {
        analysis.views[0]!.facts[1]![9] = 1;
      },
      (analysis: ReturnType<typeof validAnalysis>) => {
        analysis.views[0]!.facts[1]![8] = 1000000000000001;
      },
      (analysis: ReturnType<typeof validAnalysis>) => {
        analysis.views[0]!.facts.push([...analysis.views[0]!.facts[0]!]);
      },
      (analysis: ReturnType<typeof validAnalysis>) => {
        analysis.views[0]!.facts[0]!.push(0);
      },
    ]) {
      const analysis = validAnalysis();
      mutate(analysis);
      expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(analysis)).success).toBe(
        false,
      );
    }
  });

  it("enforces dictionary and fact limits through the ingestion entrypoint", () => {
    const labelTooLong = validAnalysis();
    labelTooLong.views[0]!.dimensions.owners = ["x".repeat(201)];
    expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(labelTooLong)).success).toBe(
      false,
    );
    const duplicateLabel = validAnalysis();
    duplicateLabel.views[0]!.dimensions.owners = ["Owner", "Owner"];
    expect(salesforceIngestionSchema.safeParse(payloadWithAnalysis(duplicateLabel)).success).toBe(
      false,
    );
    const dictionaryTooLong = validAnalysis();
    dictionaryTooLong.views[0]!.dimensions.owners = Array.from(
      { length: 10001 },
      (_, i) => `Owner ${i}`,
    );
    expect(
      salesforceIngestionSchema.safeParse(payloadWithAnalysis(dictionaryTooLong)).success,
    ).toBe(false);
    const factsTooLong = validAnalysis();
    factsTooLong.views[0]!.facts = Array.from({ length: 100001 }, (_, i) => [
      4,
      "2026-08-04",
      -1,
      -1,
      -1,
      0,
      -1,
      1,
      i,
      0,
    ]);
    const result = salesforceIngestionSchema.safeParse(payloadWithAnalysis(factsTooLong));
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "too_big",
          path: ["dashboard", "analysis", "views", 0, "facts"],
        }),
      );
  }, 30_000);
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
    expect(
      isSameOriginRequest(
        new Request("https://crm.example.com/api/refresh/salesforce", {
          headers: {
            origin: "https://evil.example",
            "x-forwarded-host": "evil.example",
            "x-forwarded-proto": "https",
          },
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
