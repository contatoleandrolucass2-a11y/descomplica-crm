import { isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

import {
  createSalesforceRequest,
  SalesforceCollectionError,
  throwIfSalesforceAborted,
  withSalesforceSignal,
} from "./report-request.mjs";

const API_ROOT = "https://direcional.my.salesforce.com/services/data/v61.0/analytics/reports";
const FORMATS = new Set(["TABULAR", "SUMMARY", "MATRIX"]);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const invalid = () => new SalesforceCollectionError("SALESFORCE_INVALID_REPORT");

function instanceStatus(value) {
  if (value.status && value.attributes?.status && value.status !== value.attributes.status)
    throw invalid();
  return value.attributes?.status ?? value.status;
}

export function validateReportDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) ||
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw invalid();
  }
  return value;
}

function splitRange([start, end]) {
  const first = Date.parse(`${start}T12:00:00Z`);
  const last = Date.parse(`${end}T12:00:00Z`);
  const days = (last - first) / 86_400_000;
  if (days < 1) throw new SalesforceCollectionError("SALESFORCE_INCOMPLETE_REPORT");
  const middle = first + Math.floor(days / 2) * 86_400_000;
  return [
    [start, new Date(middle).toISOString().slice(0, 10)],
    [new Date(middle + 86_400_000).toISOString().slice(0, 10), end],
  ];
}

function validateMetadata(metadata, definition) {
  if (
    !object(metadata) ||
    metadata.id !== definition.id ||
    !FORMATS.has(metadata.reportFormat) ||
    !Array.isArray(metadata.detailColumns) ||
    !metadata.detailColumns.length ||
    metadata.detailColumns.some((column) => typeof column !== "string" || !column) ||
    new Set(metadata.detailColumns).size !== metadata.detailColumns.length ||
    !Array.isArray(metadata.aggregates) ||
    metadata.aggregates.some((aggregate) => typeof aggregate !== "string") ||
    new Set(metadata.aggregates).size !== metadata.aggregates.length ||
    (metadata.topRows !== null && metadata.topRows !== undefined)
  ) {
    throw invalid();
  }
  for (const required of definition.requiredColumns) {
    const alternatives = Array.isArray(required) ? required : [required];
    if (!alternatives.some((column) => metadata.detailColumns.includes(column))) throw invalid();
  }
}

function rowCount(result) {
  const index = result.reportMetadata.aggregates.indexOf("RowCount");
  const value = result.factMap?.["T!T"]?.aggregates?.[index]?.value;
  if (index < 0 || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}

function rowsFrom(result) {
  const columns = result.reportMetadata.detailColumns;
  const entries = Object.entries(result.factMap);
  if (!entries.length) throw invalid();
  const rows = [];
  for (const [key, fact] of entries) {
    if (result.reportMetadata.reportFormat === "TABULAR" && key !== "T!T") throw invalid();
    if (!/^(?:T|\d+(?:_\d+)*)!(?:T|\d+(?:_\d+)*)$/.test(key) || !object(fact)) {
      throw invalid();
    }
    if (fact.rows === undefined) continue;
    if (!Array.isArray(fact.rows)) throw invalid();
    for (const row of fact.rows) {
      if (
        !object(row) ||
        !Array.isArray(row.dataCells) ||
        row.dataCells.length !== columns.length
      ) {
        throw invalid();
      }
      rows.push(
        Object.fromEntries(
          columns.map((column, index) => {
            const cell = row.dataCells[index];
            if (
              !object(cell) ||
              !Object.hasOwn(cell, "value") ||
              (cell.label !== undefined && cell.label !== null && typeof cell.label !== "string") ||
              (cell.recordId !== undefined &&
                cell.recordId !== null &&
                typeof cell.recordId !== "string")
            )
              throw invalid();
            return [
              column,
              {
                value:
                  cell.label !== undefined && cell.label !== null && cell.label !== ""
                    ? cell.label
                    : (cell.value ?? ""),
                raw: cell.value ?? null,
                recordId: cell.recordId ?? null,
              },
            ];
          }),
        ),
      );
    }
  }
  // Count before business dedupe: repeated joins are source rows, missing details are not zero.
  if (rows.length !== rowCount(result)) throw invalid();
  return rows;
}

export async function collectReportRows(sessionId, definition, startDate, endDate, options = {}) {
  if (definition.dated) {
    validateReportDate(startDate);
    validateReportDate(endDate);
    if (startDate > endDate) throw invalid();
  }
  const request = createSalesforceRequest(sessionId, options);
  const sleep = options.sleep ?? delay;
  const now = options.now ?? Date.now;
  const endpoint = `${API_ROOT}/${definition.id}`;
  const describe = await request(`${endpoint}/describe`);
  validateMetadata(describe.reportMetadata, definition);
  const metadata = structuredClone(describe.reportMetadata);
  // Request details/counts at instance creation; a later GET cannot add omitted details.
  metadata.hasDetailRows = true;
  metadata.hasRecordCount = true;
  metadata.showGrandTotal = true;
  if (!metadata.aggregates.includes("RowCount")) metadata.aggregates.push("RowCount");
  if (definition.dated && !metadata.standardDateFilter?.column) throw invalid();
  const queue = definition.dated ? [[startDate, endDate]] : [null];
  const rows = [];
  let expectedCount;
  let executions = 0;
  while (queue.length) {
    throwIfSalesforceAborted(options.signal);
    // Bound pathological partitioning when filters or the upstream data keep changing.
    if (++executions > 1_024) throw new SalesforceCollectionError("SALESFORCE_INCOMPLETE_REPORT");
    const range = queue.shift();
    const requested = structuredClone(metadata);
    if (range)
      requested.standardDateFilter = {
        ...requested.standardDateFilter,
        column: definition.dateColumn ?? requested.standardDateFilter.column,
        durationValue: "CUSTOM",
        startDate: range[0],
        endDate: range[1],
      };
    const deadline = now() + (options.reportTimeoutMs ?? 180_000);
    const started = await request(`${endpoint}/instances?includeDetails=true`, {
      method: "POST",
      body: { reportMetadata: requested },
      deadline,
    });
    if (instanceStatus(started) === "Error")
      throw new SalesforceCollectionError("SALESFORCE_REPORT_ERROR");
    const instanceId = started.id ?? started.instanceId;
    if (
      typeof instanceId !== "string" ||
      !/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(instanceId)
    ) {
      throw invalid();
    }
    let result;
    while (true) {
      if (now() >= deadline) throw new SalesforceCollectionError("SALESFORCE_TIMEOUT");
      await withSalesforceSignal(
        () =>
          sleep(Math.min(options.pollIntervalMs ?? 1_500, deadline - now()), undefined, {
            signal: options.signal,
          }),
        options.signal,
      );
      result = await request(`${endpoint}/instances/${instanceId}?includeDetails=true`, {
        deadline,
      });
      const status = instanceStatus(result);
      if (status === "Error") throw new SalesforceCollectionError("SALESFORCE_REPORT_ERROR");
      if (status === "Success") break;
      if (!["New", "Running"].includes(status)) throw invalid();
    }
    validateMetadata(result.reportMetadata, definition);
    if (
      typeof result.allData !== "boolean" ||
      result.hasDetailRows !== true ||
      !object(result.factMap) ||
      (result.hasExceededTabularRowLimit !== undefined &&
        typeof result.hasExceededTabularRowLimit !== "boolean") ||
      result.reportMetadata.reportFormat !== requested.reportFormat ||
      !isDeepStrictEqual(result.reportMetadata.detailColumns, requested.detailColumns) ||
      (range &&
        !isDeepStrictEqual(result.reportMetadata.standardDateFilter, requested.standardDateFilter))
    )
      throw invalid();
    const count = rowCount(result);
    expectedCount ??= count;
    if (!result.allData || result.hasExceededTabularRowLimit === true) {
      if (!range) throw new SalesforceCollectionError("SALESFORCE_INCOMPLETE_REPORT");
      queue.unshift(...splitRange(range));
      continue;
    }
    rows.push(...rowsFrom(result));
  }
  if (rows.length !== expectedCount) throw invalid();
  return rows;
}

export function validateProjectedRows(key, rows) {
  const contracts = {
    opportunities: ["recordId", "006", "createdAt"],
    appointments: ["appointmentCode", null, "createdAt"],
    visits: ["appointmentCode", null, "attendedAt"],
    folders: ["recordId", "a1V", "createdAt"],
    sales: ["opportunityRecordId", "006", "saleDate"],
    brokers: ["contactId", "003"],
    imobAccounts: ["accountId", "001"],
  };
  const [identity, prefix, date] = contracts[key];
  const seen = new Map();
  for (const row of rows) {
    if (
      Object.entries(row).some(([field, value]) => field !== "amount" && typeof value !== "string")
    )
      throw invalid();
    const id = row[identity];
    if (typeof id !== "string" || !id.trim()) throw invalid();
    if (prefix && (!/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(id) || !id.startsWith(prefix))) {
      throw invalid();
    }
    if (date) {
      const value = row[date];
      if (typeof value !== "string" || !value.trim()) throw invalid();
      const iso = value.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
      const local = value.match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
      );
      if (iso) {
        validateReportDate(iso[1]);
        if (!Number.isFinite(Date.parse(value))) throw invalid();
      } else if (local) {
        validateReportDate(`${local[3]}-${local[2]}-${local[1]}`);
        if (Number(local[4] ?? 0) > 23 || Number(local[5] ?? 0) > 59 || Number(local[6] ?? 0) > 59)
          throw invalid();
      } else throw invalid();
    }
    if (
      key === "sales" &&
      (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount < 0)
    )
      throw invalid();
    if (
      ["brokers", "imobAccounts"].includes(key) &&
      (typeof row.name !== "string" || !row.name.trim())
    )
      throw invalid();
    if (key === "brokers" && (typeof row.status !== "string" || !row.status.trim()))
      throw invalid();
    if (seen.has(id.trim()) && !isDeepStrictEqual(seen.get(id.trim()), row)) throw invalid();
    seen.set(id.trim(), row);
  }
  // The transform already deduplicates stage rows and records duplicate diagnostics.
  return ["brokers", "imobAccounts"].includes(key) ? [...seen.values()] : rows;
}
