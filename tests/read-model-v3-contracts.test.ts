import { describe, expect, it } from "vitest";

import {
  createReadModelV3IngestionSchema,
  readModelV3ResponseSchema,
  type ReadModelV3Ingestion,
  type ReadModelV3Response,
} from "@/lib/crm/read-model-v3/contracts";
import { validateReadModelV3Response } from "@/lib/crm/read-model-v3/data";

const readModelV3IngestionSchema = createReadModelV3IngestionSchema(
  () => new Date("2026-08-09T18:00:00.000Z"),
);

function payload(): ReadModelV3Ingestion {
  return {
    schemaVersion: 3,
    requestId: "10000000-0000-4000-8000-000000000001",
    datasetKey: "funnel",
    sourceKey: "salesforce",
    workflowKey: "official-export-v3",
    producerKey: "crm-relay-v3",
    sourceSnapshotId: "snapshot-qa-001",
    referenceDate: "2026-08-09",
    timezone: "America/Sao_Paulo",
    generatedAt: "2026-08-09T18:00:00Z",
    sourceUpdatedAt: "2026-08-09T17:55:00Z",
    coverage: { start: "2026-01-01", end: "2026-08-09", status: "complete" },
    sourceStatus: "ready",
    statusReason: null,
    qualityStatus: "verified",
    qualityIssues: [],
    availableMeasures: ["counts", "sales_amount"],
    coveredReportingScopeExternalIds: ["scope-broker-001"],
    closedMonths: ["2026-06-01", "2026-07-01"],
    records: [
      {
        sourceRecordId: "006000000000001AAA",
        stageKey: "sales",
        occurredAt: "2026-08-09T12:00:00-03:00",
        commercialDate: "2026-08-09",
        amount: "250000.00",
        dimensions: {
          reportingScopeExternalId: "scope-broker-001",
          organizationExternalId: "001000000000001AAA",
          teamExternalId: "team-001",
          brokerExternalId: "003000000000001AAA",
          developmentExternalId: "development-001",
        },
      },
    ],
  };
}

describe("read model v3 source contract", () => {
  it("accepts only stable official identifiers and explicit source provenance", () => {
    expect(readModelV3IngestionSchema.safeParse(payload()).success).toBe(true);
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        records: [{ ...payload().records[0], brokerName: "Never an identity" }],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate source grain and people without a team identity", () => {
    const value = payload();
    expect(
      readModelV3IngestionSchema.safeParse({
        ...value,
        records: [value.records[0], value.records[0]],
      }).success,
    ).toBe(false);

    const dimensions = { ...value.records[0]!.dimensions };
    delete dimensions.teamExternalId;
    expect(
      readModelV3IngestionSchema.safeParse({
        ...value,
        records: [{ ...value.records[0], dimensions }],
      }).success,
    ).toBe(false);
  });

  it("distinguishes real zero from unavailable measures", () => {
    const zero = payload();
    zero.records[0]!.amount = "0.00";
    expect(readModelV3IngestionSchema.safeParse(zero).success).toBe(true);

    const unavailable = payload();
    unavailable.availableMeasures = ["counts"];
    unavailable.records[0]!.amount = null;
    expect(readModelV3IngestionSchema.safeParse(unavailable).success).toBe(true);

    unavailable.records[0]!.amount = "1.00";
    expect(readModelV3IngestionSchema.safeParse(unavailable).success).toBe(false);

    const excessivePrecision = payload();
    excessivePrecision.records[0]!.amount = "1.001";
    expect(readModelV3IngestionSchema.safeParse(excessivePrecision).success).toBe(false);

    const exact = payload();
    exact.records[0]!.amount = "9999999999999999.99";
    const parsed = readModelV3IngestionSchema.safeParse(exact);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.records[0]!.amount).toBe("9999999999999999.99");
    }
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        records: [{ ...payload().records[0], amount: 0.29 }],
      }).success,
    ).toBe(false);
  });

  it("requires explicit source, quality and closed-month states", () => {
    const stale = payload();
    stale.sourceStatus = "stale";
    stale.statusReason = "source_watermark_stale";
    expect(readModelV3IngestionSchema.safeParse(stale).success).toBe(true);

    stale.statusReason = null;
    expect(readModelV3IngestionSchema.safeParse(stale).success).toBe(false);

    const partial = payload();
    partial.coverage.status = "partial";
    expect(readModelV3IngestionSchema.safeParse(partial).success).toBe(false);

    const missingClosedMonthWatermark = payload();
    missingClosedMonthWatermark.sourceStatus = "unavailable";
    missingClosedMonthWatermark.statusReason = "official_source_unavailable";
    missingClosedMonthWatermark.sourceUpdatedAt = null;
    missingClosedMonthWatermark.availableMeasures = [];
    missingClosedMonthWatermark.records = [];
    expect(readModelV3IngestionSchema.safeParse(missingClosedMonthWatermark).success).toBe(false);
  });

  it("rejects invalid timezones, future records and unknown fields", () => {
    expect(
      readModelV3IngestionSchema.safeParse({ ...payload(), timezone: "Brazil/Imaginary" }).success,
    ).toBe(false);
    expect(readModelV3IngestionSchema.safeParse({ ...payload(), timezone: "GMT" }).success).toBe(
      false,
    );
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        records: [{ ...payload().records[0], occurredAt: "2026-08-10T00:00:00Z" }],
      }).success,
    ).toBe(false);
    expect(
      readModelV3IngestionSchema.safeParse({ ...payload(), secret: "never accepted" }).success,
    ).toBe(false);
  });

  it("matches the RPC clock and watermark ordering invariants", () => {
    const schema = createReadModelV3IngestionSchema(() => new Date("2026-08-09T05:00:00.000Z"));
    const value = payload();
    value.generatedAt = "2026-08-09T05:05:00.000Z";
    value.sourceUpdatedAt = "2026-08-09T05:05:00.000Z";
    value.records[0]!.occurredAt = "2026-08-09T04:00:00.000Z";

    expect(schema.safeParse(value).success).toBe(true);
    expect(schema.safeParse({ ...value, generatedAt: "2026-08-09T05:05:00.001Z" }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({
        ...value,
        generatedAt: "2026-08-09T05:00:00.000Z",
        sourceUpdatedAt: "2026-08-09T05:00:00.001Z",
      }).success,
    ).toBe(false);
  });

  it("requires ordered coverage containing the reference date", () => {
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        coverage: { start: "2026-08-10", end: "2026-08-09", status: "complete" },
      }).success,
    ).toBe(false);
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        coverage: { start: "2026-01-01", end: "2026-08-08", status: "complete" },
      }).success,
    ).toBe(false);
  });

  it("requires an explicit, unique scope coverage manifest for readable runs", () => {
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        coveredReportingScopeExternalIds: [],
      }).success,
    ).toBe(false);
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        coveredReportingScopeExternalIds: ["scope-broker-001", "scope-broker-001"],
      }).success,
    ).toBe(false);
  });

  it("derives commercial dates in the declared IANA timezone", () => {
    const value = payload();
    value.records[0]!.occurredAt = "2026-08-09T01:30:00.000Z";
    value.records[0]!.commercialDate = "2026-08-08";
    expect(readModelV3IngestionSchema.safeParse(value).success).toBe(true);

    value.records[0]!.commercialDate = "2026-08-09";
    expect(readModelV3IngestionSchema.safeParse(value).success).toBe(false);
  });

  it("keeps certified months before reference and fully inside coverage", () => {
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        closedMonths: ["2026-08-01"],
      }).success,
    ).toBe(false);
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        coverage: { start: "2026-06-15", end: "2026-08-09", status: "complete" },
        closedMonths: ["2026-06-01"],
      }).success,
    ).toBe(false);
    expect(
      readModelV3IngestionSchema.safeParse({
        ...payload(),
        closedMonths: ["2026-13-01"],
      }).success,
    ).toBe(false);
  });
});

describe("read model v3 response contract", () => {
  function response(salesAmount: string): ReadModelV3Response {
    return {
      schemaVersion: 3,
      dataStatus: "ready",
      reasonCode: null,
      scopeId: "00000000-0000-4000-8000-000000000001",
      datasetKey: "funnel",
      source: {
        sourceKey: "salesforce",
        workflowKey: "official-export-v3",
        producerKey: "crm-relay-v3",
        referenceDate: "2026-08-09",
        generatedAt: "2026-08-09T18:00:00Z",
        sourceUpdatedAt: "2026-08-09T17:55:00Z",
        timezone: "America/Sao_Paulo",
        coverageStart: "2026-01-01",
        coverageEnd: "2026-08-09",
        coverageStatus: "complete",
        sourceStatus: "ready",
        qualityStatus: "verified",
        qualityIssues: [],
      },
      filters: { period: "month" },
      options: {
        organizations: [],
        teams: [],
        portfolios: [],
        coordinators: [],
        managers: [],
        brokers: [],
        origins: [],
        developments: [],
        locations: [],
      },
      truncatedOptions: [],
      metrics: {
        stageTotals: (["opportunities", "appointments", "visits", "folders", "sales"] as const).map(
          (stageKey) => ({ stageKey, value: 0, conversion: null, closedMonthsAverage: null }),
        ),
        salesAmount,
        goalsAvailable: false,
        goal: null,
        planningAvailable: false,
        monthlySeries: [],
      },
      breakdowns: { organizations: [], brokers: [], managers: [], developments: [] },
    };
  }

  it("preserves the maximum aggregate implied by 10,000 exact event amounts", () => {
    const exact = "99999999999999999900.00";
    const parsed = readModelV3ResponseSchema.safeParse(response(exact));

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.metrics?.salesAmount).toBe(exact);
    expect(readModelV3ResponseSchema.safeParse(response("999999999999999999999.00")).success).toBe(
      false,
    );
  });

  it("requires explicit, bounded option truncation metadata", () => {
    const truncated = response("0.00");
    truncated.truncatedOptions = ["brokers", "organizations"];
    expect(readModelV3ResponseSchema.safeParse(truncated).success).toBe(true);

    const tooManyOptions = response("0.00");
    tooManyOptions.options.brokers = Array.from({ length: 101 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      label: `Corretor ${index}`,
    }));
    expect(readModelV3ResponseSchema.safeParse(tooManyOptions).success).toBe(false);

    const unknownDimension = { ...response("0.00"), truncatedOptions: ["unknown"] };
    expect(readModelV3ResponseSchema.safeParse(unknownDimension).success).toBe(false);

    const unsorted = { ...response("0.00"), truncatedOptions: ["teams", "brokers"] };
    expect(readModelV3ResponseSchema.safeParse(unsorted).success).toBe(false);
  });

  it("rejects source timezones that the renderer cannot format", () => {
    const incompatible = response("0.00");
    incompatible.source!.timezone = "Factory";
    expect(readModelV3ResponseSchema.safeParse(incompatible).success).toBe(false);
  });

  it("binds a valid response to the requested dataset and reporting scope", () => {
    const model = response("0.00");

    expect(validateReadModelV3Response(model, "funnel", model.scopeId)).toEqual(model);
    expect(validateReadModelV3Response(model, "ranking", model.scopeId)).toBeNull();
    expect(
      validateReadModelV3Response(model, "funnel", "00000000-0000-4000-8000-000000000099"),
    ).toBeNull();
  });

  it("requires every funnel stage in each monthly series row", () => {
    const complete = response("0.00");
    complete.metrics!.monthlySeries = [
      {
        monthStart: "2026-07-01",
        stages: {
          opportunities: 10,
          appointments: 8,
          visits: 6,
          folders: 4,
          sales: 2,
        },
      },
    ];
    expect(readModelV3ResponseSchema.safeParse(complete).success).toBe(true);

    const partial = structuredClone(complete) as unknown as Record<string, unknown>;
    delete (partial.metrics as { monthlySeries: Array<{ stages: Record<string, number> }> })
      .monthlySeries[0]!.stages.sales;
    expect(readModelV3ResponseSchema.safeParse(partial).success).toBe(false);
  });
});
