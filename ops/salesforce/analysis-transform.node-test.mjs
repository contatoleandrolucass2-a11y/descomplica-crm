import assert from "node:assert/strict";
import { test } from "node:test";

import { dashboardAnalysisSchema } from "../../lib/crm/dashboard/analysis-contract.ts";
import { MAX_SALESFORCE_INGESTION_BODY_BYTES } from "../../lib/crm/salesforce/transport.ts";
import { buildDashboardAnalysis, dashboardAnalysisCoverageStart } from "./analysis-transform.mjs";
import { buildSalesforceSnapshot } from "./transform.mjs";

function input() {
  const labels = {
    brokerName: "Broker Internal",
    managerName: "Manager Internal",
    realEstateName: "regional direcional vendas spc branch",
    businessUnit: "Empresa Internal",
    development: "Development Internal",
  };
  return {
    referenceDate: "2026-01-15",
    generatedAt: "2026-01-15T15:00:00Z",
    requestId: "00000000-0000-4000-8000-000000000001",
    analysisEnabled: true,
    reports: {
      brokers: [],
      imobAccounts: [{ name: "Registered Partner" }],
      opportunities: [
        {
          ...labels,
          recordId: "OP-1",
          name: "PRIVATE CUSTOMER",
          phone: "PRIVATE PHONE",
          customerId: "PRIVATE ID",
          createdAt: "2026-01-15",
        },
      ],
      appointments: [
        {
          ...labels,
          appointmentCode: "AG-1",
          createdAt: "2025-10-01T15:00:00Z",
          scheduledAt: "2026-01-15T16:00:00Z",
          attendedAt: "",
          visitPerformed: false,
          regionalManager: "Regional Internal",
          accountName: "Account Internal",
          accountRanking: "A",
        },
      ],
      visits: [{ ...labels, appointmentCode: "AG-1", attendedAt: "2025-12-31" }],
      folders: [
        { ...labels, recordId: "F-1", createdAt: "2026-01-15", status: "An\u00e1lise aprovada" },
        { ...labels, recordId: "F-2", createdAt: "2026-01-15", status: "Analise reprovada" },
      ],
      sales: [
        { ...labels, opportunityRecordId: "S-1", saleDate: "2026-01-15", amount: 125.5 },
        { ...labels, opportunityRecordId: "S-2", saleDate: "2026-01-15", amount: 74.5 },
      ],
    },
  };
}

function view(analysis, viewKey = "all") {
  return analysis.views.find((entry) => entry.viewKey === viewKey);
}

test("v4 keeps store and true development separate and publishes operational details", () => {
  const source = input();
  source.reports.appointments = [
    { ...source.reports.appointments[0], storeName: "Store A", development: "Development A" },
    {
      ...source.reports.appointments[0],
      appointmentCode: "AG-2",
      storeName: "Store B",
      development: "Development A",
    },
  ];
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  assert.equal(analysis.version, 4);
  assert.equal(analysis.brokerCount, 0);
  const current = view(analysis);
  assert.deepEqual(current.dimensions.stores, ["Store A", "Store B"]);
  const appointments = current.facts.filter((fact) => fact[0] === 1);
  assert.equal(appointments.length, 2);
  assert.deepEqual(
    appointments.map((fact) => fact[10]),
    [0, 1],
  );
  assert.ok(
    appointments.every((fact) => current.dimensions.developments[fact[6]] === "Development A"),
  );
  assert.equal(
    appointments.reduce((sum, fact) => sum + fact[7], 0),
    2,
  );
  assert.ok(current.facts.filter((fact) => fact[0] !== 1).every((fact) => fact[10] === -1));
  const legacy = structuredClone(analysis);
  legacy.version = 1;
  delete legacy.brokerCount;
  delete legacy.brokerManagerCount;
  for (const entry of legacy.views) {
    delete entry.dimensions.stores;
    delete entry.appointments;
    entry.facts = entry.facts.filter((fact) => fact[0] !== 1).map((fact) => fact.slice(0, 10));
  }
  assert.equal(dashboardAnalysisSchema.safeParse(legacy).success, true);
  const invalid = structuredClone(analysis);
  invalid.views[0].facts.find((fact) => fact[0] === 1)[10] = 2;
  assert.equal(dashboardAnalysisSchema.safeParse(invalid).success, false);
});

test("v4 marks registered productive brokers and counts managers from the broker report", () => {
  const source = input();
  source.reports.brokers = [
    {
      contactId: "003000000000001AAA",
      name: "Broker Internal",
      status: "Ativo",
      managerName: "Manager Roster",
    },
    {
      contactId: "003000000000002AAA",
      name: "Broker without activity",
      status: "Ativo",
      managerName: "Manager Roster",
    },
  ];
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  assert.equal(analysis.version, 4);
  assert.equal(analysis.brokerCount, 2);
  assert.equal(analysis.brokerManagerCount, 1);
  assert.equal(view(analysis).appointments[0].registeredBroker, true);
  assert.equal(view(analysis).appointments[0].channel, 1);
  assert.equal(view(analysis).appointments[0].company, "Empresa Internal");
});

test("analysis is strictly opt-in and preserves every legacy field", () => {
  const source = input();
  const enabled = buildSalesforceSnapshot(source);
  for (const flag of [undefined, false, "true", 1, null]) {
    const legacy = buildSalesforceSnapshot({ ...source, analysisEnabled: flag });
    assert.equal(Object.hasOwn(legacy.payload.dashboard, "analysis"), false);
    const withoutAnalysis = structuredClone(enabled);
    delete withoutAnalysis.payload.dashboard.analysis;
    assert.deepEqual(legacy, withoutAnalysis);
  }
});

test("uses normalized deduplicated records and emits contract-valid daily counts and sales sums", () => {
  const source = input();
  source.reports.opportunities.push({ ...source.reports.opportunities[0] });
  source.reports.sales.push({ ...source.reports.sales[0] });
  const result = buildSalesforceSnapshot(source);
  const analysis = result.payload.dashboard.analysis;
  assert.equal(dashboardAnalysisSchema.safeParse(analysis).success, true);
  assert.equal(analysis.coverageStart, "2025-10-01");
  assert.deepEqual(view(analysis).dimensions.companies, ["Empresa Internal"]);
  assert.deepEqual(view(analysis).facts, [
    [0, "2026-01-15", 0, 0, 0, 1, 0, 1, 0, 0, -1],
    [1, "2025-10-01", 0, 0, 0, 1, 0, 1, 0, 0, -1],
    [2, "2025-12-31", 0, 0, 0, 1, 0, 1, 0, 0, -1],
    [3, "2026-01-15", 0, 0, 0, 1, 0, 2, 0, 1, -1],
    [4, "2026-01-15", 0, 0, 0, 1, 0, 2, 200, 0, -1],
  ]);
  assert.equal(result.diagnostics.duplicates.opportunities, 1);
  assert.equal(result.diagnostics.duplicates.sales, 1);
  assert.doesNotMatch(
    JSON.stringify(analysis),
    /PRIVATE|OP-1|AG-1|F-1|S-1|customerId|phone|recordId/,
  );
  assert.deepEqual(Object.keys(analysis).sort(), [
    "brokerCount",
    "brokerManagerCount",
    "coverageStart",
    "referenceDate",
    "version",
    "views",
  ]);
});

test("each view builds its own dictionaries using existing real-estate membership, not channel", () => {
  const source = input();
  source.reports.imobAccounts = [{ name: "DIRECIONAL VENDAS SPC Registered Partner" }];
  source.reports.opportunities.push(
    {
      recordId: "OP-2",
      createdAt: "2026-01-15",
      realEstateName: "DIRECIONAL VENDAS SPC Registered Partner",
      brokerName: "Broker Partner",
      managerName: "Manager Partner",
      development: "Development Partner",
      businessUnit: "Empresa Partner",
    },
    {
      recordId: "OP-3",
      createdAt: "2026-01-15",
      realEstateName: "prefix spc - canal imob pj suffix",
      brokerName: "Broker Channel",
      managerName: "Manager Channel",
      development: "Development Channel",
      businessUnit: "Empresa Channel",
    },
  );
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  const withChannel = view(analysis, "with_canal_imob");
  const withoutChannel = view(analysis, "without_canal_imob");
  assert.deepEqual(withChannel.dimensions.owners, ["Broker Channel", "Broker Partner"]);
  assert.deepEqual(withoutChannel.dimensions.owners, ["Broker Internal"]);
  assert.doesNotMatch(JSON.stringify(withChannel), /Internal/);
  assert.doesNotMatch(JSON.stringify(withoutChannel), /Partner|Channel/);
  assert.deepEqual(withChannel.facts.map((fact) => fact[5]).sort(), [0, 1]);
  for (const current of analysis.views) {
    for (const fact of current.facts) assert.ok(current.dimensions.owners[fact[3]]);
  }
});

test("excludes unsupported channels and out-of-coverage dates before building dictionaries", () => {
  const source = input();
  const base = source.reports.opportunities[0];
  for (const [recordId, createdAt, realEstateName] of [
    ["old", "2025-09-30", base.realEstateName],
    ["future", "2026-01-16", base.realEstateName],
    ["other", "2026-01-15", "OTHER CHANNEL"],
    ["blank", "2026-01-15", ""],
    ["partial", "2026-01-15", "SPC - CANAL IMOB"],
  ])
    source.reports.opportunities.push({
      ...base,
      recordId,
      createdAt,
      realEstateName,
      brokerName: "EXCLUDED LABEL",
      managerName: "EXCLUDED LABEL",
      businessUnit: "EXCLUDED LABEL",
      development: "EXCLUDED LABEL",
    });
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  assert.equal(view(analysis).facts.filter((fact) => fact[0] === 0).length, 1);
  assert.doesNotMatch(JSON.stringify(analysis), /EXCLUDED/);
});

test("rejects ambiguous channel membership without leaking row values", () => {
  const source = input();
  source.reports.opportunities[0].realEstateName =
    "SPC - CANAL IMOB PJ / DIRECIONAL VENDAS SPC PRIVATE";
  assert.throws(() => buildSalesforceSnapshot(source), {
    message: "Ambiguous Salesforce dashboard channel.",
  });
});

test("uses each source stage date in Sao Paulo, including UTC midnight boundaries", () => {
  const source = input();
  source.reports.opportunities[0].createdAt = "2026-01-15T02:59:59Z";
  source.reports.appointments[0].createdAt = "2026-01-15T03:00:00Z";
  source.reports.visits[0].attendedAt = "2026-01-16T02:59:59Z";
  source.reports.sales[0].saleDate = "2026-01-16T03:00:00Z";
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  const facts = view(analysis).facts;
  assert.equal(facts.find((fact) => fact[0] === 0)[1], "2026-01-14");
  assert.equal(facts.find((fact) => fact[0] === 1)[1], "2026-01-15");
  assert.equal(facts.find((fact) => fact[0] === 2)[1], "2026-01-15");
  assert.equal(facts.find((fact) => fact[0] === 4)[8], 74.5);
});

test("keeps date-only appointment details on the same Sao Paulo calendar day", () => {
  const source = input();
  source.referenceDate = "2026-10-20";
  source.reports.appointments[0].createdAt = "2026-10-20";
  source.reports.appointments[0].scheduledAt = "2026-10-20";
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  const current = view(analysis);
  assert.equal(current.facts.find((fact) => fact[0] === 1)[1], "2026-10-20");
  assert.equal(current.appointments[0].createdAt, "2026-10-20T03:00:00.000Z");
  assert.equal(current.appointments[0].scheduledAt, "2026-10-20T03:00:00.000Z");
});

test("missing dimensions use -1 and empty views never inherit labels", () => {
  const source = input();
  const row = source.reports.opportunities[0];
  for (const field of ["brokerName", "managerName", "businessUnit", "development"])
    delete row[field];
  const analysis = buildSalesforceSnapshot(source).payload.dashboard.analysis;
  assert.deepEqual(view(analysis).facts[0].slice(2, 7), [-1, -1, -1, 1, -1]);
  assert.deepEqual(view(analysis, "with_canal_imob"), {
    viewKey: "with_canal_imob",
    dimensions: { managers: [], owners: [], companies: [], developments: [], stores: [] },
    facts: [],
    appointments: [],
  });
});

test("coverage includes three prior months across year boundaries and leap years", () => {
  for (const [date, expected] of [
    ["2026-01-15", "2025-10-01"],
    ["2026-02-28", "2025-11-01"],
    ["2024-03-31", "2023-12-01"],
    ["2024-04-30", "2024-01-01"],
    ["2024-02-29", "2023-11-01"],
    ["2026-12-31", "2026-01-01"],
  ])
    assert.equal(dashboardAnalysisCoverageStart(date), expected);
  for (const date of ["2026-02-29", "2026-13-01", "bad", "2026-01-15T00:00:00Z"]) {
    assert.throws(
      () => dashboardAnalysisCoverageStart(date),
      /Invalid Salesforce dashboard analysis/,
    );
  }
});

test("helper rejects invalid aggregates and oversized labels without truncation", () => {
  const stages = { opportunities: [], appointments: [], visits: [], folders: [], sales: [] };
  const make = (row) =>
    buildDashboardAnalysis({
      referenceDate: "2026-01-15",
      brokerCount: 0,
      views: [
        { viewKey: "all", stages: { ...stages, sales: [row] } },
        { viewKey: "with_canal_imob", stages },
        { viewKey: "without_canal_imob", stages },
      ],
    });
  const base = { date: "2026-01-15", realEstateName: "DIRECIONAL VENDAS SPC", amount: 1 };
  for (const amount of [-1, Infinity, NaN, "100", 1_000_000_000_000_001]) {
    assert.throws(() => make({ ...base, amount }), /Invalid Salesforce dashboard analysis/);
  }
  assert.throws(
    () => make({ ...base, brokerName: "x".repeat(201) }),
    /Invalid Salesforce dashboard analysis/,
  );
});

test("measures a synthetic payload and rejects a full payload over the publisher byte ceiling", (t) => {
  const source = input();
  const candidate = buildSalesforceSnapshot(source);
  const bytes = Buffer.byteLength(JSON.stringify(candidate.payload), "utf8");
  assert.ok(bytes < MAX_SALESFORCE_INGESTION_BODY_BYTES);
  t.diagnostic(
    `Synthetic 7-record candidate payload: ${bytes} UTF-8 bytes (ceiling ${MAX_SALESFORCE_INGESTION_BODY_BYTES}).`,
  );
  source.reports.opportunities = Array.from({ length: 2600 }, (_, index) => {
    const label = "\u6e2c".repeat(195) + String(index).padStart(5, "0");
    return {
      recordId: `OP-${index}`,
      createdAt: "2026-01-15",
      realEstateName: "DIRECIONAL VENDAS SPC",
      brokerName: label,
      managerName: label,
      businessUnit: label,
      development: label,
    };
  });
  assert.throws(() => buildSalesforceSnapshot(source), {
    message: "Salesforce candidate payload exceeds 8 MiB",
  });
});

test("measures realistic synthetic daily histories against the 8 MiB envelope without truncating", (t) => {
  // Workload assumptions, not goals: one opportunity/day; appointments on weekdays
  // with two on Thursdays; 8 visits, 4 folders and 1 sale per complete month.
  // No customer data: all labels and legacy ranking contacts are synthetic.
  const stageKeys = ["opportunities", "appointments", "visits", "folders", "sales"];
  const referenceDate = "2026-10-15";
  const sizes = [];
  for (const brokerCount of [10, 25, 50]) {
    const views = ["all", "with_canal_imob", "without_canal_imob"].map((viewKey) => ({
      viewKey,
      stages: Object.fromEntries(stageKeys.map((key) => [key, []])),
    }));
    const brokers = [];
    for (let broker = 0; broker < brokerCount; broker += 1) {
      const name = `Corretor sintetico ${String(broker + 1).padStart(3, "0")}`;
      brokers.push({ contactId: `synthetic-${broker}`, name, status: "Ativo" });
      const channel = broker % 2;
      const labels = {
        brokerName: name,
        managerName: `Gerente sintetico ${Math.floor(broker / 10) + 1}`,
        realEstateName:
          channel === 0 ? `SPC - CANAL IMOB PJ sintetico ${broker % 5}` : "DIRECIONAL VENDAS SPC",
        businessUnit: `Unidade de negocio sintetica ${broker % 4}`,
        development: `Empreendimento sintetico ${broker % 12}`,
      };
      for (
        let day = new Date("2026-01-01T12:00:00Z");
        day.toISOString().slice(0, 10) <= referenceDate;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        const date = day.toISOString().slice(0, 10);
        const monthDay = day.getUTCDate();
        const weekday = day.getUTCDay();
        const counts = [
          1,
          weekday >= 1 && weekday <= 5 ? (weekday === 4 ? 2 : 1) : 0,
          [3, 7, 11, 15, 19, 23, 27, 28].includes(monthDay) ? 1 : 0,
          [7, 14, 21, 28].includes(monthDay) ? 1 : 0,
          monthDay === 28 ? 1 : 0,
        ];
        for (const [stage, count] of counts.entries()) {
          for (let record = 0; record < count; record += 1) {
            const row = {
              ...labels,
              date,
              amount: stage === 4 ? 250_000 : 0,
              approvedFolder: stage === 3 && monthDay % 2 === 0,
              ...(stage === 1
                ? {
                    createdAt: `${date}T12:00:00Z`,
                    scheduledAt: `${date}T15:00:00Z`,
                    attendedAt: monthDay % 2 === 0 ? `${date}T16:00:00Z` : "",
                    visitPerformed: monthDay % 2 === 0,
                    regionalManager: `Regional sintetico ${broker % 3}`,
                    accountName: `Conta sintetica ${broker}`,
                    accountRanking: ["Ouro", "Prata", "Bronze"][broker % 3],
                  }
                : {}),
            };
            views[0].stages[stageKeys[stage]].push(row);
            views[channel === 0 ? 1 : 2].stages[stageKeys[stage]].push(row);
          }
        }
      }
    }
    const analysis = buildDashboardAnalysis({ referenceDate, views, brokerCount });
    const baseline = buildSalesforceSnapshot({
      ...input(),
      referenceDate,
      generatedAt: `${referenceDate}T15:00:00Z`,
      analysisEnabled: false,
      reports: { brokers },
    }).payload;
    baseline.dashboard.analysis = analysis;
    const bytes = Buffer.byteLength(JSON.stringify(baseline), "utf8");
    const records = Object.values(views[0].stages).reduce((sum, rows) => sum + rows.length, 0);
    const facts = analysis.views.reduce((sum, current) => sum + current.facts.length, 0);
    assert.equal(
      analysis.views[0].facts.reduce((sum, fact) => sum + fact[7], 0),
      records,
    );
    sizes.push(bytes);
    t.diagnostic(
      JSON.stringify({
        scenario: "synthetic-2026-01-01-to-2026-10-15",
        brokers: brokerCount,
        sourceRecords: records,
        factsAcrossThreeViews: facts,
        legacyRankingParticipants: brokerCount * 4,
        payloadBytes: bytes,
        limitBytes: MAX_SALESFORCE_INGESTION_BODY_BYTES,
        fits: bytes <= MAX_SALESFORCE_INGESTION_BODY_BYTES,
      }),
    );
  }
  assert.ok(sizes[0] < 3_000_000);
  assert.ok(sizes[1] < MAX_SALESFORCE_INGESTION_BODY_BYTES);
  assert.ok(sizes.at(-1) > MAX_SALESFORCE_INGESTION_BODY_BYTES);
});
