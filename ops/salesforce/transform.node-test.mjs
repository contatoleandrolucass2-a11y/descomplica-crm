import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSalesforceSnapshot } from "./transform.mjs";

function fixture() {
  return {
    referenceDate: "2026-08-06",
    generatedAt: "2026-08-06T15:00:00.000Z",
    requestId: "00000000-0000-4000-8000-000000000001",
    reports: {
      brokers: [
        { contactId: "003000000000001AAA", name: "Corretor Um", status: "Ativo" },
        { contactId: "003000000000002AAA", name: "Corretor Dois", status: "Inativo" },
      ],
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
        {
          recordId: "006000000000002AAA",
          name: "Oportunidade 2",
          createdAt: "2026-08-05",
          brokerName: "Corretor Um",
          managerName: "Gerente Um",
          realEstateName: "Equipe interna",
          development: "Empreendimento B",
        },
      ],
      appointments: [
        {
          appointmentCode: "AG-1",
          createdAt: "2026-08-06",
          brokerName: "Corretor Um",
          managerName: "Gerente Um",
          realEstateName: "Imobiliária Parceira",
        },
      ],
      visits: [
        {
          appointmentCode: "AG-ORPHAN",
          attendedAt: "2026-08-06",
          brokerName: "Corretor Um",
          managerName: "Gerente Um",
          realEstateName: "Imobiliária Parceira",
        },
      ],
      folders: [
        {
          recordId: "a1V000000000001AAA",
          opportunityRecordId: "006000000000001AAA",
          creditName: "Pasta 1",
          createdAt: "2026-08-06",
          brokerName: "Corretor Um",
          managerName: "Gerente Um",
          realEstateName: "Imobiliária Parceira",
          status: "Análise aprovada",
        },
        {
          recordId: "a1V000000000002AAA",
          opportunityRecordId: "006000000000001AAA",
          creditName: "Pasta 2",
          createdAt: "2026-08-06",
          brokerName: "Corretor Um",
          managerName: "Gerente Um",
          realEstateName: "Imobiliária Parceira",
          status: "Análise reprovada",
        },
      ],
      sales: [
        {
          opportunityRecordId: "006000000000099AAA",
          opportunityName: "Venda órfã",
          saleDate: "2026-08-06",
          brokerName: "Corretor Um",
          managerName: "Gerente Um",
          realEstateName: "Imobiliária Parceira",
          amount: 100_000,
        },
      ],
    },
  };
}

test("builds complete three-view dashboard without dropping source divergences", () => {
  const result = buildSalesforceSnapshot(fixture());
  assert.equal(result.payload.dashboard.views.length, 3);
  assert.equal(result.payload.dashboard.metrics.length, 15);
  assert.equal(result.diagnostics.dataQuality.visitsWithoutAppointment, 1);
  assert.equal(result.diagnostics.dataQuality.salesWithoutOpportunityById, 1);
  assert.equal(result.diagnostics.dataQuality.salesWithoutOpportunityByName, 1);
  assert.equal(result.diagnostics.dataQuality.approvedFolders, 1);

  const folders = result.payload.dashboard.metrics.find(
    (metric) => metric.viewKey === "with_canal_imob" && metric.stageKey === "folders",
  );
  assert.equal(folders.currentToday, 2);
});

test("uses approved folders only in ranking and hashes stable Salesforce contact ids", () => {
  const result = buildSalesforceSnapshot(fixture());
  const today = result.payload.ranking.participants.find(
    (participant) => participant.periodKey === "today",
  );
  assert.equal(result.payload.ranking.participants.length, 4);
  assert.equal(today.approvedFolder, 1);
  assert.equal(today.sale, 1);
  assert.match(today.brokerKey, /^sf-contact-[a-f0-9]{32}$/);
  assert.ok(!JSON.stringify(result.payload).includes("003000000000001AAA"));
});

test("is deterministic for the same request and accepts goals only from input", () => {
  const input = fixture();
  input.goals = {
    all: { opportunities: { month: 10, week: 3, today: 1 } },
  };
  const first = buildSalesforceSnapshot(input);
  const second = buildSalesforceSnapshot(input);
  assert.deepEqual(first, second);
  const metric = first.payload.dashboard.metrics.find(
    (item) => item.viewKey === "all" && item.stageKey === "opportunities",
  );
  assert.deepEqual(
    { month: metric.goalMonth, week: metric.goalWeek, today: metric.goalToday },
    { month: 10, week: 3, today: 1 },
  );
  assert.equal(first.diagnostics.goals, "provided");
});
