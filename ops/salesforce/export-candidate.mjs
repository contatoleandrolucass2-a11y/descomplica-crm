import { randomUUID } from "node:crypto";
import { chmod, rename, writeFile } from "node:fs/promises";
import process from "node:process";

import { chromium } from "playwright-core";

import { buildSalesforceSnapshot } from "./transform.mjs";

const SALESFORCE_ORIGIN = "https://direcional.my.salesforce.com";
const API_VERSION = "v61.0";
const REPORTS = [
  { key: "opportunities", id: "00OU600000DrfDeMAJ", dated: true },
  {
    key: "appointments",
    id: "00OU600000ELaA6MAL",
    dated: true,
    dateColumn: "Activity.CreatedDate",
  },
  { key: "visits", id: "00OU600000EboNZMAZ", dated: true },
  { key: "folders", id: "00OU600000EjufWMAR", dated: true },
  { key: "sales", id: "00OU600000EjFyyMAF", dated: true },
  { key: "brokers", id: "00OTT000009j0l32AA", dated: false },
  { key: "imobAccounts", id: "00OU6000006RqzxMAC", dated: false },
];

function log(message, details = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), message, ...details })}\n`,
  );
}

function cellValue(cell) {
  if (cell?.label !== undefined && cell.label !== null && cell.label !== "") return cell.label;
  return cell?.value ?? "";
}

function rowsFrom(result) {
  const columns = result.reportMetadata?.detailColumns ?? [];
  const tabular = result.factMap?.["T!T"]?.rows;
  const facts =
    Array.isArray(tabular) && tabular.length > 0
      ? [result.factMap["T!T"]]
      : Object.values(result.factMap ?? {}).filter((fact) => Array.isArray(fact?.rows));
  return facts.flatMap((fact) =>
    (fact.rows ?? []).map((row) =>
      Object.fromEntries(
        columns.map((column, index) => [
          column,
          {
            value: cellValue(row.dataCells?.[index]),
            raw: row.dataCells?.[index]?.value ?? null,
            recordId: row.dataCells?.[index]?.recordId ?? null,
          },
        ]),
      ),
    ),
  );
}

function field(row, name) {
  return row[name]?.value ?? "";
}

function raw(row, name) {
  return row[name]?.raw ?? field(row, name);
}

function recordId(row, name) {
  return row[name]?.recordId ?? "";
}

function project(key, rows) {
  if (key === "opportunities") {
    return rows.map((row) => ({
      recordId: recordId(row, "Opportunity.Name"),
      name: field(row, "Opportunity.Name"),
      createdAt: raw(row, "Opportunity.CreatedDate"),
      brokerName: field(row, "Opportunity.Contato_Corretor_Proprietario1__c.Name"),
      managerName: field(row, "Opportunity.Gerente_de_vendas__c"),
      realEstateName: field(row, "Opportunity.Imobiliaria__c.Name"),
      businessUnit: field(row, "Opportunity.Unidade_De_Neg_cio__c"),
      development: field(row, "Opportunity.Empreendimento__c.Name"),
    }));
  }
  if (key === "appointments" || key === "visits") {
    return rows.map((row) => ({
      appointmentCode: field(row, "Activity.Codigo_do_agendamento__c"),
      ...(key === "appointments"
        ? { createdAt: raw(row, "Activity.CreatedDate") }
        : { attendedAt: raw(row, "Activity.Data_de_comparecimento__c") }),
      brokerName: field(row, "Activity.Corretor__c.Name"),
      managerName: field(row, "Activity.Gerente_de_Vendas__c"),
      realEstateName:
        field(row, "Activity.Imobiliaria__c.Name") || field(row, "Activity.Nome_da_imobiliaria__c"),
      development: field(row, "Activity.PDV__c.Name"),
      accountSource: field(row, "Activity.Account.AccountSource"),
      campaignName: field(row, "Activity.Account.Campanha__c.Name__lookup"),
    }));
  }
  if (key === "folders") {
    return rows.map((row) => ({
      recordId: recordId(row, "Avaliacao_credito__c.Name"),
      opportunityRecordId: recordId(
        row,
        "Avaliacao_credito__c.Oportunidade__c.Gerente_regional__c",
      ),
      opportunityName: field(row, "Avaliacao_credito__c.Oportunidade__c.Name"),
      creditName: field(row, "Avaliacao_credito__c.Name"),
      createdAt: raw(row, "Avaliacao_credito__c.CreatedDate"),
      brokerName: field(row, "Avaliacao_credito__c.Corretor__c.Name"),
      managerName: field(
        row,
        "Avaliacao_credito__c.Nome_Imobili_ria__c.Comissionado_generico_3__c.Name",
      ),
      realEstateName: field(row, "Avaliacao_credito__c.Imobiliaria__c"),
      businessUnit: field(row, "Avaliacao_credito__c.Empreendimento__c.UnidadeDeNegocio__c"),
      development: field(row, "Avaliacao_credito__c.Empreendimento__c.Name"),
      status: field(row, "Avaliacao_credito__c.Status__c"),
    }));
  }
  if (key === "sales") {
    return rows.map((row) => ({
      opportunityRecordId: recordId(row, "Opportunity.Name"),
      opportunityName: field(row, "Opportunity.Name"),
      saleDate: raw(row, "Opportunity.DataVenda__c"),
      brokerName: field(row, "Opportunity.Contato_Corretor_Proprietario1__c.Name"),
      managerName: field(row, "Opportunity.Imobiliaria__c.Comissionado_generico_3__c.Name"),
      realEstateName: field(row, "Opportunity.Imobiliaria__c.Name"),
      businessUnit: field(row, "Opportunity.Unidade_De_Neg_cio__c"),
      development: field(row, "Opportunity.Empreendimento__c.Name"),
      amount: raw(row, "Opportunity.Valor_Real_de_Venda__c"),
    }));
  }
  if (key === "brokers") {
    return rows.map((row) => ({
      contactId: recordId(row, "Contact.Name"),
      name: field(row, "Contact.Name"),
      status: field(row, "Contact.Status_Corretor__c"),
    }));
  }
  return [
    ...new Map(
      rows.map((row) => {
        const accountId = recordId(row, "Account.Name");
        return [accountId, { accountId, name: field(row, "Account.Name") }];
      }),
    ).values(),
  ].filter((account) => account.accountId && account.name);
}

function splitRange(start, end) {
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const days = Math.floor((endDate - startDate) / 86_400_000);
  if (days < 1) return null;
  const leftEnd = new Date(startDate);
  leftEnd.setUTCDate(leftEnd.getUTCDate() + Math.floor(days / 2));
  const rightStart = new Date(leftEnd);
  rightStart.setUTCDate(rightStart.getUTCDate() + 1);
  return [
    [start, leftEnd.toISOString().slice(0, 10)],
    [rightStart.toISOString().slice(0, 10), end],
  ];
}

async function executeReport(sessionId, definition, range) {
  const endpoint = `${SALESFORCE_ORIGIN}/services/data/${API_VERSION}/analytics/reports/${definition.id}`;
  const headers = { Authorization: `Bearer ${sessionId}`, "Content-Type": "application/json" };
  const describeResponse = await fetch(`${endpoint}/describe`, { headers });
  if (!describeResponse.ok) throw new Error(`describe failed for ${definition.key}`);
  const describe = await describeResponse.json();
  const metadata = describe.reportMetadata;
  if (range) {
    if (!metadata?.standardDateFilter?.column) {
      throw new Error(`missing date filter for ${definition.key}`);
    }
    metadata.standardDateFilter = {
      ...metadata.standardDateFilter,
      column: definition.dateColumn ?? metadata.standardDateFilter.column,
      durationValue: "CUSTOM",
      startDate: range[0],
      endDate: range[1],
    };
  }
  const startResponse = await fetch(`${endpoint}/instances`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reportMetadata: metadata }),
  });
  if (!startResponse.ok) throw new Error(`start failed for ${definition.key}`);
  const started = await startResponse.json();
  const instanceId = started.id ?? started.instanceId;
  if (!instanceId) throw new Error(`missing instance for ${definition.key}`);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const response = await fetch(`${endpoint}/instances/${instanceId}?includeDetails=true`, {
      headers,
    });
    if (!response.ok) throw new Error(`result failed for ${definition.key}`);
    const result = await response.json();
    if (result.status === "Success" || result.factMap) return result;
    if (result.status === "Error") throw new Error(`report failed for ${definition.key}`);
  }
  throw new Error(`report timeout for ${definition.key}`);
}

async function collectReport(sessionId, definition, startDate, endDate) {
  const queue = definition.dated ? [[startDate, endDate]] : [null];
  const rows = [];
  while (queue.length) {
    const range = queue.shift();
    const result = await executeReport(sessionId, definition, range);
    if (result.allData === false && range) {
      const halves = splitRange(range[0], range[1]);
      if (!halves) throw new Error(`row limit on one day for ${definition.key}`);
      queue.unshift(...halves);
      continue;
    }
    rows.push(...rowsFrom(result));
  }
  return project(definition.key, rows);
}

function saoPauloReferenceDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function atomicWrite(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}

async function main() {
  const outputPath = process.env.SALESFORCE_CANDIDATE_OUTPUT;
  if (!outputPath?.startsWith("/")) throw new Error("absolute output path required");
  const referenceDate = process.env.SALESFORCE_REFERENCE_DATE ?? saoPauloReferenceDate();
  const startDate = `${referenceDate.slice(0, 4)}-01-01`;
  const browser = await chromium.connectOverCDP(
    process.env.SALESFORCE_CDP_URL ?? "http://127.0.0.1:9222",
  );
  try {
    const context = browser.contexts()[0];
    const cookies = await context.cookies();
    const session = cookies.find(
      (cookie) => cookie.name === "sid" && cookie.domain.includes("salesforce.com"),
    );
    if (!session?.value) throw new Error("Salesforce session unavailable");
    const reports = {};
    for (const definition of REPORTS) {
      reports[definition.key] = await collectReport(
        session.value,
        definition,
        startDate,
        referenceDate,
      );
      log("report collected", { report: definition.key, rows: reports[definition.key].length });
    }
    const generatedAt = new Date().toISOString();
    const candidate = buildSalesforceSnapshot({
      reports,
      referenceDate,
      generatedAt,
      requestId: randomUUID(),
    });
    await atomicWrite(outputPath, candidate);
    log("candidate written", {
      output: outputPath,
      payloadMetrics: candidate.payload.dashboard.metrics.length,
      rankingParticipants: candidate.payload.ranking.participants.length,
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  log("candidate failed", { error: error.message });
  process.exitCode = 1;
});
