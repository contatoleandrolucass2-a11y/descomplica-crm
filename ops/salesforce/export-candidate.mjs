import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import { chromium } from "@playwright/test";

import { refreshSalesforceSession, safeCdpEndpoint } from "./browser-session.mjs";
import { publishSalesforceCandidate } from "./publish-candidate.mjs";
import { hardenPrivateRegularFile } from "./private-file.mjs";
import { acquireExportLock } from "./export-lock.mjs";
import {
  collectReportRows,
  validateProjectedRows,
  validateReportDate,
} from "./report-collection.mjs";
import {
  SalesforceAuthenticationError,
  SalesforceCollectionError,
  safeSalesforceError,
  throwIfSalesforceAborted,
  withSalesforceSignal,
} from "./report-request.mjs";
import { buildSalesforceSnapshot } from "./transform.mjs";

export const REPORTS = [
  {
    key: "opportunities",
    id: "00OU600000DrfDeMAJ",
    dated: true,
    requiredColumns: [
      "Opportunity.Name",
      "Opportunity.CreatedDate",
      "Opportunity.Contato_Corretor_Proprietario1__c.Name",
      "Opportunity.Gerente_de_vendas__c",
      "Opportunity.Imobiliaria__c.Name",
      "Opportunity.Unidade_De_Neg_cio__c",
      "Opportunity.Empreendimento__c.Name",
    ],
  },
  {
    key: "appointments",
    id: "00OU600000ELaA6MAL",
    dated: true,
    dateColumn: "Activity.CreatedDate",
    requiredColumns: [
      "Activity.Codigo_do_agendamento__c",
      "Activity.CreatedDate",
      "Activity.Corretor__c.Name",
      "Activity.Gerente_de_Vendas__c",
      ["Activity.Imobiliaria__c.Name", "Activity.Nome_da_imobiliaria__c"],
      "Activity.PDV__c.Name",
      "Activity.Account.AccountSource",
      "Activity.Account.Campanha__c.Name__lookup",
    ],
  },
  {
    key: "visits",
    id: "00OU600000EboNZMAZ",
    dated: true,
    requiredColumns: [
      "Activity.Codigo_do_agendamento__c",
      "Activity.Data_de_comparecimento__c",
      "Activity.Corretor__c.Name",
      "Activity.Gerente_de_Vendas__c",
      ["Activity.Imobiliaria__c.Name", "Activity.Nome_da_imobiliaria__c"],
      "Activity.PDV__c.Name",
      "Activity.Account.AccountSource",
      "Activity.Account.Campanha__c.Name__lookup",
    ],
  },
  {
    key: "folders",
    id: "00OU600000EjufWMAR",
    dated: true,
    requiredColumns: [
      "Avaliacao_credito__c.Name",
      "Avaliacao_credito__c.Oportunidade__c.Gerente_regional__c",
      "Avaliacao_credito__c.Oportunidade__c.Name",
      "Avaliacao_credito__c.CreatedDate",
      "Avaliacao_credito__c.Corretor__c.Name",
      "Avaliacao_credito__c.Nome_Imobili_ria__c.Comissionado_generico_3__c.Name",
      "Avaliacao_credito__c.Imobiliaria__c",
      "Avaliacao_credito__c.Empreendimento__c.UnidadeDeNegocio__c",
      "Avaliacao_credito__c.Empreendimento__c.Name",
      "Avaliacao_credito__c.Status__c",
    ],
  },
  {
    key: "sales",
    id: "00OU600000EjFyyMAF",
    dated: true,
    requiredColumns: [
      "Opportunity.Name",
      "Opportunity.DataVenda__c",
      "Opportunity.Contato_Corretor_Proprietario1__c.Name",
      "Opportunity.Imobiliaria__c.Comissionado_generico_3__c.Name",
      "Opportunity.Imobiliaria__c.Name",
      "Opportunity.Unidade_De_Neg_cio__c",
      "Opportunity.Empreendimento__c.Name",
      "Opportunity.Valor_Real_de_Venda__c",
    ],
  },
  {
    key: "brokers",
    id: "00OTT000009j0l32AA",
    dated: false,
    requiredColumns: ["Contact.Name", "Contact.Status_Corretor__c"],
  },
  {
    key: "imobAccounts",
    id: "00OU6000006RqzxMAC",
    dated: false,
    requiredColumns: ["Account.Name"],
  },
];

function log(message, details = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), message, ...details })}\n`,
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
  return rows.map((row) => ({
    accountId: recordId(row, "Account.Name"),
    name: field(row, "Account.Name"),
  }));
}

export async function collectReport(sessionId, definition, startDate, endDate, options = {}) {
  const rows = await collectReportRows(sessionId, definition, startDate, endDate, options);
  return validateProjectedRows(definition.key, project(definition.key, rows));
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

export function resolveReferenceDate(environment = process.env) {
  return validateReportDate(
    environment.SALESFORCE_REFERENCE_DATE?.trim() || saoPauloReferenceDate(),
  );
}

export function resolveCandidateOutputPath(environment = process.env, platform = process.platform) {
  const outputPath = environment.SALESFORCE_CANDIDATE_OUTPUT;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (!outputPath || !pathApi.isAbsolute(outputPath)) {
    throw new SalesforceCollectionError("SALESFORCE_EXPORT_CONFIG");
  }
  return pathApi.normalize(outputPath);
}

export async function writeCandidateAtomically(filePath, value, privateFileOptions, signal) {
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    throwIfSalesforceAborted(signal);
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx", signal });
    await hardenPrivateRegularFile(temporary, privateFileOptions);
    throwIfSalesforceAborted(signal);
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function publishCandidatePayload(candidate, environment, signal) {
  try {
    return await withSalesforceSignal(
      () =>
        publishSalesforceCandidate(candidate, environment, {
          fetch: async (url, init) => {
            throwIfSalesforceAborted(signal);
            return fetch(url, {
              ...init,
              signal: signal ? AbortSignal.any([signal, init.signal]) : init.signal,
            });
          },
        }),
      signal,
    );
  } catch {
    throwIfSalesforceAborted(signal);
    throw new SalesforceCollectionError("publication_failed");
  }
}

export async function exportCandidate(environment = process.env, options = {}) {
  const outputPath = resolveCandidateOutputPath(environment);
  const referenceDate = resolveReferenceDate(environment);
  const startDate = `${referenceDate.slice(0, 4)}-01-01`;
  throwIfSalesforceAborted(options.signal);
  const cycleTimeoutMs = Math.min(options.cycleTimeoutMs ?? 25 * 60_000, 25 * 60_000);
  if (!Number.isFinite(cycleTimeoutMs) || cycleTimeoutMs <= 0)
    throw new SalesforceCollectionError("SALESFORCE_TIMEOUT");
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  // Leave time to disconnect CDP and release ownership before the 25-minute cycle limit.
  const timer = setTimeout(
    () => controller.abort(new SalesforceCollectionError("SALESFORCE_TIMEOUT")),
    Math.max(1, cycleTimeoutMs - 5_000),
  );
  let releaseLock;
  let browser;
  try {
    releaseLock = await acquireExportLock(outputPath);
    throwIfSalesforceAborted(signal);
    const connection = chromium.connectOverCDP(safeCdpEndpoint(environment.SALESFORCE_CDP_URL), {
      timeout: 30_000,
    });
    void connection.then(
      (connected) => {
        if (signal.aborted) void connected.close().catch(() => {});
      },
      () => {},
    );
    browser = await withSalesforceSignal(() => connection, signal);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Salesforce browser context unavailable");
    let sessionId;
    try {
      sessionId = await withSalesforceSignal(() => refreshSalesforceSession(context), signal);
    } catch (error) {
      if (error?.message?.endsWith("manual login required"))
        throw new SalesforceAuthenticationError();
      throw error;
    }
    log("Salesforce session refreshed");
    const reports = {};
    for (const definition of REPORTS) {
      reports[definition.key] = await collectReport(
        sessionId,
        definition,
        startDate,
        referenceDate,
        { signal },
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
    await writeCandidateAtomically(outputPath, candidate, undefined, signal);
    throwIfSalesforceAborted(signal);
    log("candidate written", {
      payloadMetrics: candidate.payload.dashboard.metrics.length,
      rankingParticipants: candidate.payload.ranking.participants.length,
    });
    await withSalesforceSignal(async () => options.onCollected?.(candidate), signal);
    const publication = await publishCandidatePayload(candidate, environment, signal);
    log("candidate publication evaluated", {
      published: publication.published,
      status: publication.status,
      requestId: candidate.payload.requestId,
    });
    return candidate;
  } catch (error) {
    throwIfSalesforceAborted(signal);
    if (error instanceof SalesforceCollectionError) throw error;
    throw new SalesforceCollectionError("SALESFORCE_EXPORT_FAILED");
  } finally {
    try {
      if (browser)
        await withSalesforceSignal(() => browser.close(), AbortSignal.timeout(4_000)).catch(
          () => {},
        );
    } finally {
      clearTimeout(timer);
      await releaseLock?.();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  exportCandidate(process.env, { signal: controller.signal })
    .catch((error) => {
      log("candidate failed", safeSalesforceError(error));
      process.exitCode = 1;
    })
    .finally(() => {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    });
}
