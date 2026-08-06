import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { salesforceIngestionSchema } from "@/lib/crm/ingestion/schema";
import { buildSalesforceSnapshot } from "@/ops/salesforce/transform.mjs";

describe("Salesforce production transform", () => {
  it("produces the strict versioned ingestion contract", () => {
    const result = buildSalesforceSnapshot({
      referenceDate: "2026-08-06",
      generatedAt: "2026-08-06T15:00:00.000Z",
      requestId: "00000000-0000-4000-8000-000000000001",
      reports: {
        brokers: [{ contactId: "003000000000001AAA", name: "Corretor Um", status: "Ativo" }],
        imobAccounts: [{ accountId: "001000000000001AAA", name: "Imobiliária Parceira" }],
        opportunities: [
          {
            recordId: "006000000000001AAA",
            name: "Oportunidade 1",
            createdAt: "2026-08-06",
            brokerName: "Corretor Um",
            managerName: "Gerente Um",
            realEstateName: "Imobiliária Parceira",
            development: "Empreendimento A",
          },
        ],
        appointments: [],
        visits: [],
        folders: [],
        sales: [],
      },
    });

    expect(salesforceIngestionSchema.safeParse(result.payload).success).toBe(true);
  });

  it.runIf(process.env.SALESFORCE_CANDIDATE_PATH)(
    "validates a protected candidate snapshot against the production schema",
    () => {
      const candidatePath = process.env.SALESFORCE_CANDIDATE_PATH;
      if (!candidatePath) throw new Error("candidate path is required");
      const candidate = JSON.parse(readFileSync(candidatePath, "utf8")) as { payload: unknown };
      expect(salesforceIngestionSchema.safeParse(candidate.payload).success).toBe(true);
    },
  );
});
