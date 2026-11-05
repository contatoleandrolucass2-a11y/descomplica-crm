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

test("official roster hierarchy is additive and bounded by reference date", () => {
  const input = fixture();
  const legacy = buildSalesforceSnapshot(input).payload.ranking.participants;
  input.reports.brokers[0].managerName = "Gerente Oficial";
  input.reports.appointments.push(
    {
      appointmentCode: "H1",
      createdAt: "2026-08-05",
      brokerName: "Corretor Um",
      managerName: "Gerente Oficial",
      regionalManager: "Regional Anterior",
    },
    {
      appointmentCode: "H2",
      createdAt: "2026-08-06T23:30:00-03:00",
      brokerName: "Corretor Um",
      managerName: "Gerente Oficial",
      regionalManager: "Regional Atual",
    },
    {
      appointmentCode: "H3",
      createdAt: "2026-08-07",
      brokerName: "Corretor Um",
      managerName: "Gerente Oficial",
      regionalManager: "Regional Futuro",
    },
  );
  const result = buildSalesforceSnapshot(input).payload.ranking.participants;
  assert.ok(
    result.every(
      (row) =>
        row.rosterManagerName === "Gerente Oficial" && row.regionalManagerName === "Regional Atual",
    ),
  );
  // Compare against the same activity input with no official roster relationship:
  // legacy manager/counts must not depend on the additive hierarchy.
  delete input.reports.brokers[0].managerName;
  const unchanged = buildSalesforceSnapshot(input).payload.ranking.participants;
  const strip = ({ rosterManagerName, regionalManagerName, ...row }) => row;
  assert.deepEqual(result.map(strip), unchanged.map(strip));
  assert.ok(
    legacy.every((row) => row.rosterManagerName === null && row.regionalManagerName === null),
  );
});

test("regional reconciliation requires the broker's own observation, even for a single observed manager region", () => {
  const input = fixture();
  input.reports.brokers[0].managerName = "Gerente Um";
  input.reports.appointments = ["Regional A", "Regional B"].map((regionalManager, index) => ({
    appointmentCode: `H${index}`,
    createdAt: "2026-08-06",
    brokerName: "Corretor Um",
    managerName: "Gerente Um",
    regionalManager,
  }));
  assert.equal(
    buildSalesforceSnapshot(input).payload.ranking.participants[0].regionalManagerName,
    null,
  );
  input.reports.appointments.forEach((row) => {
    row.brokerName = "Outro Corretor";
  });
  assert.equal(
    buildSalesforceSnapshot(input).payload.ranking.participants[0].regionalManagerName,
    null,
  );
  input.reports.appointments.pop();
  assert.equal(
    buildSalesforceSnapshot(input).payload.ranking.participants[0].regionalManagerName,
    null,
  );
  input.reports.appointments[0].regionalManager = "";
  assert.equal(
    buildSalesforceSnapshot(input).payload.ranking.participants[0].regionalManagerName,
    null,
  );
});

test("latest missing regional and duplicate broker names do not invent a regional person", () => {
  const input = fixture();
  input.reports.brokers[0].managerName = "Gerente Um";
  input.reports.appointments[0].regionalManager = "Regional A";
  input.reports.appointments.push({
    appointmentCode: "L1",
    createdAt: "2026-08-06T23:00:00-03:00",
    brokerName: "Corretor Um",
    managerName: "Gerente Um",
    regionalManager: "",
  });
  assert.equal(
    buildSalesforceSnapshot(input).payload.ranking.participants[0].regionalManagerName,
    null,
  );
  input.reports.appointments.pop();
  input.reports.brokers.push({ ...input.reports.brokers[0], contactId: "003000000000003AAA" });
  assert.ok(
    buildSalesforceSnapshot(input).payload.ranking.participants.every(
      (row) => row.regionalManagerName === null,
    ),
  );
});

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
  input.goals = Object.fromEntries(
    ["all", "with_canal_imob", "without_canal_imob"].map((view) => [
      view,
      Object.fromEntries(
        ["opportunities", "appointments", "visits", "folders", "sales"].map((stage) => [
          stage,
          { month: 10, week: 3, today: 1 },
        ]),
      ),
    ]),
  );
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
  assert.equal(first.payload.dashboard.goalsAvailable, true);
});

test("marks missing goals and roulette as unavailable instead of commercial zero", () => {
  const result = buildSalesforceSnapshot(fixture());
  assert.equal(result.payload.dashboard.goalsAvailable, false);
  assert.equal(result.payload.ranking.rouletteAvailable, false);
  assert.ok(
    result.payload.dashboard.metrics.every(
      (metric) => metric.goalMonth === 0 && metric.goalWeek === 0 && metric.goalToday === 0,
    ),
  );
  assert.ok(
    result.payload.ranking.participants.every(
      (participant) =>
        participant.roulette === 0 &&
        participant.rouletteSaturday === 0 &&
        participant.rouletteSunday === 0,
    ),
  );
});
