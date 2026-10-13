import assert from "node:assert/strict";
import test from "node:test";

import {
  collectInventory,
  inventoryRequiredColumns,
  INVENTORY_REPORT_ID,
  projectInventoryRow,
} from "./collect-inventory.mjs";

const projectId = (n) => `a0P${String(n).padStart(12, "0")}AAA`;
const productId = (n) => `a0Q${String(n).padStart(12, "0")}AAA`;
const projects = [1, 2].map((n) => ({
  value: projectId(n),
  label: `Projeto ${n}`,
  key: String(n - 1),
  groupings: [],
}));
function row(n = 1) {
  const result = Object.fromEntries(
    inventoryRequiredColumns.map((column) => [column, { value: null, label: "-" }]),
  );
  Object.assign(result, {
    "Empreendimento__c.UnidadeDeNegocio__c": { value: "Riva", label: "Riva" },
    "Empreendimento__c.Name": {
      value: projectId(n),
      label: `Projeto ${n}`,
      recordId: projectId(n),
    },
    "Produto__c.Name": { value: productId(n), label: `Produto ${n}`, recordId: productId(n) },
    "Produto__c.Identificador__c": { value: "BL01-0001", label: "BL01-0001" },
    "Produto__c.StatusUnidade__c": { value: "Mirror - Reservada", label: "Mirror - Reservada" },
    "Produto__c.ValorFinalComKit__c": { value: 300000.1 },
    "Produto__c.B_A_da_Unidade__c": { value: 10000.02 },
    "Produto__c.Valor_Folga__c": { value: 10000.03 },
    "Produto__c.ValordeLancamento__c": { value: { amount: 280000, currency: "BRL" } },
    "Empreendimento__c.TotalAndamentoObra__c": { value: 82.5 },
    "Empreendimento__c.DataEntrega__c": { value: "2027-11-01", label: "01/11/2027" },
  });
  return result;
}

function fixture(change = () => {}) {
  const original = {
    id: INVENTORY_REPORT_ID,
    reportFormat: "TABULAR",
    topRows: null,
    detailColumns: inventoryRequiredColumns,
    aggregates: ["RowCount"],
    reportFilters: [
      {
        column: "Produto__c.StatusUnidade__c",
        operator: "equals",
        value: "Disponível,Mirror - Reservada",
      },
    ],
    reportBooleanFilter: "1",
    standardDateFilter: { column: "Empreendimento__c.CreatedDate", startDate: null, endDate: null },
  };
  const calls = [];
  return {
    calls,
    request: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/describe")) return { reportMetadata: structuredClone(original) };
      const m = structuredClone(init.body.reportMetadata);
      const summary = m.reportFormat === "SUMMARY";
      const projectNumber = Number(m.reportFilters.at(-1).value?.split(" ").at(-1));
      const record = row(projectNumber);
      const result = {
        allData: true,
        hasDetailRows: !summary,
        reportMetadata: m,
        groupingsDown: { groupings: structuredClone(projects) },
        factMap: summary
          ? {
              "T!T": { aggregates: [{ value: 2 }] },
              "0!T": { aggregates: [{ value: 1 }] },
              "1!T": { aggregates: [{ value: 1 }] },
            }
          : {
              "T!T": {
                aggregates: [{ value: 1 }],
                rows: [{ dataCells: m.detailColumns.map((column) => record[column]) }],
              },
            },
      };
      change(result, { summary, projectNumber, calls });
      return result;
    },
  };
}

test("collects every project, reconciles counts and keeps the original scope", async () => {
  const f = fixture();
  const result = await collectInventory("test", {
    request: f.request,
    now: () => Date.parse("2026-10-13T17:40:00Z"),
  });
  assert.equal(result.count, 2);
  assert.equal(result.sourceRows, 2);
  assert.equal(result.projectCount, 2);
  assert.equal(result.generatedAt, "2026-10-13T17:40:00.000Z");
  assert.equal(result.items[0].status, "Mirror - Reservada");
  const detailRequests = f.calls.filter(
    (call) => call.init?.body.reportMetadata.reportFormat === "TABULAR",
  );
  assert.equal(detailRequests.length, 2);
  for (const call of detailRequests) {
    assert.equal(
      call.init.body.reportMetadata.reportFilters[0].value,
      "Disponível,Mirror - Reservada",
    );
    assert.equal(call.init.body.reportMetadata.reportBooleanFilter, "(1) AND 2");
  }
});

test("maps official amounts in cents and preserves nulls and reserved status", () => {
  const item = projectInventoryRow(row());
  assert.equal(item.finalPrice, 280000.05);
  assert.equal(item.launchPrice, 280000);
  assert.equal(item.minimumSignal, null);
  assert.equal(item.appraisal, null);
  assert.equal(item.progress, 0.825);
  assert.equal(item.completionDate, "2027-11-01");
  assert.equal(item.identifier, "BL01-0001");
  assert.equal(item.status, "Mirror - Reservada");
});

test("does not turn absent financial fields into a price", () => {
  const source = row();
  source["Produto__c.B_A_da_Unidade__c"].value = null;
  assert.equal(projectInventoryRow(source).finalPrice, null);
});

test("accepts omitted ISO only with the source's explicit BRL currency label", () => {
  const source = row();
  source["Produto__c.ValordeLancamento__c"] = {
    value: { amount: 123.45, currency: null },
    label: "R$ 123,45",
  };
  assert.equal(projectInventoryRow(source).launchPrice, 123.45);
  source["Produto__c.ValordeLancamento__c"].label = "123,45";
  assert.throws(() => projectInventoryRow(source), /integrity/u);
});

for (const [name, change] of [
  [
    "truncated partition",
    (r, { summary }) => {
      if (!summary) r.allData = false;
    },
  ],
  [
    "missing row",
    (r, { summary }) => {
      if (!summary) r.factMap["T!T"].rows = [];
    },
  ],
  [
    "changed filters",
    (r, { summary }) => {
      if (!summary) r.reportMetadata.reportFilters = [];
    },
  ],
  [
    "wrong project",
    (r, { summary }) => {
      if (!summary)
        r.factMap["T!T"].rows[0].dataCells[
          r.reportMetadata.detailColumns.indexOf("Empreendimento__c.Name")
        ].recordId = projectId(99);
    },
  ],
  [
    "ambiguous project label",
    (r, { summary }) => {
      if (summary) r.groupingsDown.groupings[0].label = "A,B";
    },
  ],
  [
    "incomplete aggregate",
    (r, { summary }) => {
      if (summary) r.factMap["T!T"].aggregates[0].value = 3;
    },
  ],
  [
    "changed baseline",
    (r, { summary, calls }) => {
      if (summary && calls.length > 3) r.groupingsDown.groupings[0].value = projectId(99);
    },
  ],
]) {
  test(`rejects ${name} before publication`, async () => {
    const f = fixture(change);
    await assert.rejects(collectInventory("test", { request: f.request }), /Salesforce report/u);
  });
}

for (const [name, column, value] of [
  ["foreign currency", "Produto__c.ValordeLancamento__c", { amount: 1000, currency: "USD" }],
  ["non-numeric price", "Produto__c.ValorFinalComKit__c", "1000"],
  ["invalid date", "Empreendimento__c.DataEntrega__c", "2026-02-31"],
  ["progress outside range", "Empreendimento__c.TotalAndamentoObra__c", 101],
]) {
  test(`rejects ${name}`, () => {
    const r = row();
    r[column].value = value;
    assert.throws(() => projectInventoryRow(r), /integrity/u);
  });
}
