import { describe, expect, it } from "vitest";

import {
  createQlikRankingIngestionSchema,
  n8nSalesforceEnvelopeSchema,
  qlikRankingIngestionSchema,
  salesforceSourceReportsSchema,
  type SalesforceSourceReports,
  unavailableStockContractSchema,
} from "@/lib/crm/integrations/contracts";

function sourceReports(): SalesforceSourceReports {
  return {
    opportunities: [
      {
        recordId: "006000000000001AAA",
        name: "Oportunidade sanitizada",
        createdAt: "2026-08-07T09:00:00-03:00",
        brokerName: "Corretor QA",
        managerName: "Gerente QA",
        realEstateName: "Imobiliária QA",
        businessUnit: "Unidade QA",
        development: "Empreendimento QA",
      },
    ],
    appointments: [],
    visits: [],
    folders: [],
    sales: [],
    brokers: [{ contactId: "003000000000001AAA", name: "Corretor QA", status: "Ativo" }],
    imobAccounts: [{ accountId: "001000000000001AAA", name: "Imobiliária Parceira QA" }],
  };
}

function salesforcePayload() {
  const metrics = ["opportunities", "appointments", "visits", "folders", "sales"].flatMap(
    (stageKey) =>
      ["all", "with_canal_imob", "without_canal_imob"].map((viewKey) => ({
        viewKey,
        stageKey,
        currentMonth: 0,
        currentWeek: 0,
        currentToday: 0,
        goalMonth: 0,
        goalWeek: 0,
        goalToday: 0,
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
  );
  return {
    schemaVersion: 2 as const,
    requestId: "00000000-0000-4000-8000-000000000001",
    workflow: "salesforce_n8n_v1",
    dashboard: {
      snapshotKey: "global",
      referenceDate: "2026-08-07",
      generatedAt: "2026-08-07T18:03:36.329Z",
      timezone: "America/Sao_Paulo",
      source: "Salesforce Analytics Reports API v61 via n8n",
      goalsAvailable: false,
      views: ["all", "with_canal_imob", "without_canal_imob"].map((viewKey) => ({
        viewKey,
        salesValueMonth: 0,
        salesValueWeek: 0,
        salesValueToday: 0,
      })),
      metrics,
      topDevelopments: [],
    },
  };
}

describe("integration source contracts", () => {
  it("accepts the minimum projected Salesforce reports", () => {
    expect(salesforceSourceReportsSchema.safeParse(sourceReports()).success).toBe(true);
  });

  it("accepts documented Salesforce name fallbacks and rejects missing identities", () => {
    const fallback = sourceReports();
    fallback.opportunities[0]!.recordId = "";
    fallback.folders.push({
      recordId: "",
      opportunityRecordId: "",
      opportunityName: "Oportunidade sanitizada",
      creditName: "Pasta sanitizada",
      createdAt: "2026-08-07",
      brokerName: "",
      managerName: "",
      realEstateName: "",
      development: "",
      businessUnit: "",
      status: "",
    });
    expect(salesforceSourceReportsSchema.safeParse(fallback).success).toBe(true);

    fallback.opportunities[0]!.name = "";
    fallback.folders[0]!.creditName = "";
    expect(salesforceSourceReportsSchema.safeParse(fallback).success).toBe(false);
  });

  it("rejects unknown source fields and malformed Salesforce identities", () => {
    const withPii = sourceReports();
    expect(
      salesforceSourceReportsSchema.safeParse({
        ...withPii,
        opportunities: [{ ...withPii.opportunities[0], email: "not-accepted@example.test" }],
      }).success,
    ).toBe(false);

    const malformed = sourceReports();
    malformed.brokers[0]!.contactId = "not-a-salesforce-id";
    expect(salesforceSourceReportsSchema.safeParse(malformed).success).toBe(false);

    const impossibleDate = sourceReports();
    impossibleDate.opportunities[0]!.createdAt = "2026-02-30";
    expect(salesforceSourceReportsSchema.safeParse(impossibleDate).success).toBe(false);
  });

  it("accepts direct and n8n-wrapped v2 snapshots but rejects envelope extras", () => {
    const payload = salesforcePayload();
    expect(n8nSalesforceEnvelopeSchema.safeParse(payload).success).toBe(true);
    expect(n8nSalesforceEnvelopeSchema.safeParse({ body: payload }).success).toBe(true);
    expect(
      n8nSalesforceEnvelopeSchema.safeParse({ body: payload, credential: "forbidden" }).success,
    ).toBe(false);
  });

  it("validates Qlik month/year, uniqueness and strict shape", () => {
    const payload = {
      schemaVersion: 1 as const,
      requestId: "00000000-0000-4000-8000-000000000002",
      referenceYear: 2026,
      generatedAt: "2026-08-09T05:07:36.463Z",
      entries: [
        {
          periodMonth: "2026-08-01",
          imobKey: "imob.qa",
          imobName: "Imobiliária QA",
          vgv: "0.00",
          contracts: 0,
          sourceRankVgv: null,
          sourceRankContracts: null,
        },
      ],
    };

    expect(qlikRankingIngestionSchema.safeParse(payload).success).toBe(true);
    expect(
      qlikRankingIngestionSchema.safeParse({
        ...payload,
        entries: [payload.entries[0], payload.entries[0]],
      }).success,
    ).toBe(false);
    expect(
      qlikRankingIngestionSchema.safeParse({
        ...payload,
        entries: [{ ...payload.entries[0], periodMonth: "2025-08-01" }],
      }).success,
    ).toBe(false);
    expect(
      qlikRankingIngestionSchema.safeParse({
        ...payload,
        entries: [{ ...payload.entries[0], vgv: "0.29" }],
      }).success,
    ).toBe(true);
    expect(
      qlikRankingIngestionSchema.safeParse({
        ...payload,
        entries: [{ ...payload.entries[0], vgv: "0.001" }],
      }).success,
    ).toBe(false);
    expect(
      qlikRankingIngestionSchema.safeParse({
        ...payload,
        entries: [{ ...payload.entries[0], vgv: "10000000000000000.00" }],
      }).success,
    ).toBe(false);
  });

  it("matches the Qlik RPC five-minute future tolerance", () => {
    const schema = createQlikRankingIngestionSchema(() => new Date("2026-08-09T05:00:00.000Z"));
    const base = {
      schemaVersion: 1 as const,
      requestId: "00000000-0000-4000-8000-000000000003",
      referenceYear: 2026,
      generatedAt: "2026-08-09T05:05:00.000Z",
      sourceUpdatedAt: "2026-08-09T05:05:00.000Z",
      entries: [
        {
          periodMonth: "2026-08-01",
          imobKey: "imob.qa",
          imobName: "Imobiliária QA",
          vgv: "0.00",
          contracts: 0,
        },
      ],
    };

    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, generatedAt: "2026-08-09T05:05:00.001Z" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...base, sourceUpdatedAt: "2026-08-09T05:05:00.001Z" }).success).toBe(
      false,
    );
  });

  it("keeps stock fail-closed until an official contract exists", () => {
    expect(
      unavailableStockContractSchema.safeParse({
        availability: "unavailable",
        reason: "official_contract_missing",
      }).success,
    ).toBe(true);
    expect(
      unavailableStockContractSchema.safeParse({
        availability: "available",
        units: [{ price: 100_000 }],
      }).success,
    ).toBe(false);
  });
});
