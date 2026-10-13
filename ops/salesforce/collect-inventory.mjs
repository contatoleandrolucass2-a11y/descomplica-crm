import { isDeepStrictEqual } from "node:util";

import { createSalesforceRequest, SalesforceCollectionError } from "./report-request.mjs";

export const INVENTORY_REPORT_ID = "00OU6000007yRpKMAU";
const endpoint = `https://direcional.my.salesforce.com/services/data/v61.0/analytics/reports/${INVENTORY_REPORT_ID}`;
const projectColumn = "Empreendimento__c.Name";
const statusColumn = "Produto__c.StatusUnidade__c";
const productColumn = "Produto__c.Name";
const salesforceId = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/u;
const invalid = () => new SalesforceCollectionError("SALESFORCE_INVALID_REPORT");
const incomplete = () => new SalesforceCollectionError("SALESFORCE_INCOMPLETE_REPORT");

const textColumns = {
  businessUnit: "Empreendimento__c.UnidadeDeNegocio__c",
  project: projectColumn,
  product: productColumn,
  description: "Produto__c.Descricao__c",
  identifier: "Produto__c.Identificador__c",
  plant: "Produto__c.Area__c",
  classification: "Produto__c.OutrasDescricoes__c",
  unitType: "Produto__c.TipoUnidade__c",
  building: "Produto__c.BlocoEtapa__c",
  constructionStatus: "Empreendimento__c.CondicaoEmpreendimento__c",
  completionDate: "Empreendimento__c.DataEntrega__c",
  postalCode: "Empreendimento__c.CEPObra__c",
  city: "Empreendimento__c.CidadeObra__c",
  street: "Empreendimento__c.LogradouroObra__c",
  neighborhood: "Empreendimento__c.BairroObra__c",
  district: "Empreendimento__c.Bairro__c",
  state: "Empreendimento__c.EstadoObra__c",
  status: statusColumn,
};
const moneyColumns = {
  launchPrice: "Produto__c.ValordeLancamento__c",
  appraisal: "AvaliacaoBancaria__c.Valor__c",
  finalWithKit: "Produto__c.ValorFinalComKit__c",
  unitBonus: "Produto__c.B_A_da_Unidade__c",
  tableSlack: "Produto__c.Valor_Folga__c",
  cashBackSlack: "Produto__c.Folga_Volta_ao_Caixa__c",
  minimumSignal: "Produto__c.Valor_Minimo_de_Sinal__c",
};
const numberColumns = {
  privateArea: "Produto__c.AreaCobertaFinal__c",
  rooms: "Produto__c.NumeroQuartos__c",
  parkingSpaces: "Produto__c.QuantidadeVagas__c",
  floor: "Produto__c.Andar__c",
  finalUnit: "Produto__c.FinalUnidade__c",
  progress: "Empreendimento__c.TotalAndamentoObra__c",
};
export const inventoryRequiredColumns = [
  ...Object.values(textColumns).filter((column) => column !== statusColumn),
  ...Object.values(moneyColumns),
  ...Object.values(numberColumns),
  "Empreendimento__c.NumeroObra__c",
];

function metadataValid(metadata) {
  if (
    metadata?.id !== INVENTORY_REPORT_ID ||
    metadata.reportFormat !== "TABULAR" ||
    metadata.topRows != null ||
    !Array.isArray(metadata.detailColumns) ||
    new Set(metadata.detailColumns).size !== metadata.detailColumns.length ||
    !inventoryRequiredColumns.every((column) => metadata.detailColumns.includes(column)) ||
    !Array.isArray(metadata.reportFilters) ||
    (metadata.reportBooleanFilter != null && typeof metadata.reportBooleanFilter !== "string")
  )
    throw invalid();
}

function count(result, key = "T!T") {
  const index = result.reportMetadata?.aggregates?.indexOf("RowCount");
  const value = result.factMap?.[key]?.aggregates?.[index]?.value;
  if (index < 0 || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}

function fullResult(result, metadata, details) {
  const filters = (value) =>
    value?.map(({ column, operator, value }) => ({ column, operator, value }));
  if (result?.allData !== true || result.hasExceededTabularRowLimit === true) throw incomplete();
  if (
    result.reportMetadata?.id !== INVENTORY_REPORT_ID ||
    result.reportMetadata.reportFormat !== metadata.reportFormat ||
    result.hasDetailRows !== details ||
    !isDeepStrictEqual(result.reportMetadata.detailColumns, metadata.detailColumns) ||
    !isDeepStrictEqual(
      filters(result.reportMetadata.reportFilters),
      filters(metadata.reportFilters),
    ) ||
    !isDeepStrictEqual(result.reportMetadata.standardDateFilter, metadata.standardDateFilter) ||
    (result.reportMetadata.reportBooleanFilter ?? null) !== (metadata.reportBooleanFilter ?? null)
  )
    throw invalid();
}

async function projectCounts(request, original) {
  const metadata = {
    ...original,
    reportFormat: "SUMMARY",
    detailColumns: original.detailColumns.filter((column) => column !== projectColumn),
    hasDetailRows: false,
    hasRecordCount: true,
    showGrandTotal: true,
    aggregates: ["RowCount"],
    groupingsDown: [{ name: projectColumn, sortOrder: "Asc" }],
    groupingsAcross: [],
  };
  const result = await request(`${endpoint}?includeDetails=false`, {
    method: "POST",
    body: { reportMetadata: metadata },
  });
  fullResult(result, metadata, false);
  const groups = result.groupingsDown?.groupings;
  if (!Array.isArray(groups) || groups.length > 1000) throw invalid();
  const projects = groups.map((group) => {
    if (
      !salesforceId.test(group.value) ||
      typeof group.label !== "string" ||
      !group.label.trim() ||
      !/^\d+$/u.test(group.key) ||
      (group.groupings?.length ?? 0) !== 0 ||
      /[",\r\n]/u.test(group.label)
    )
      throw invalid(); // Ambiguous multi-value filter syntax must never broaden a partition.
    return { id: group.value, label: group.label, rows: count(result, `${group.key}!T`) };
  });
  const total = count(result);
  if (
    total <= 0 ||
    total > 100_000 ||
    new Set(projects.map((project) => project.id)).size !== projects.length ||
    new Set(projects.map((project) => project.label.toLocaleLowerCase("pt-BR"))).size !==
      projects.length ||
    projects.reduce((sum, project) => sum + project.rows, 0) !== total
  )
    throw incomplete();
  return { total, projects: projects.sort((a, b) => a.id.localeCompare(b.id)) };
}

function number(raw) {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) throw invalid();
  return raw;
}

function money(cell) {
  let raw = cell?.value;
  if (raw && typeof raw === "object") {
    // Single-currency reports omit the ISO code but explicitly label each amount in reais.
    const brl =
      raw.currency === "BRL" ||
      (raw.currency === null && /^(?:BRL|R\$)\s*/u.test(cell.label ?? ""));
    if (!brl || !Object.hasOwn(raw, "amount")) throw invalid();
    raw = raw.amount;
  }
  const amount = number(raw);
  if (amount === null) return null;
  const cents = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) throw invalid();
  return cents / 100;
}

export function projectInventoryRow(row) {
  const id = row[productColumn]?.recordId;
  if (typeof id !== "string" || !salesforceId.test(id) || !id.startsWith("a0Q")) throw invalid();
  const item = { id };
  for (const [field, column] of Object.entries(textColumns)) {
    const cell = row[column];
    if (!cell || !Object.hasOwn(cell, "value")) throw invalid();
    const raw = cell.value;
    if (raw !== null && typeof raw !== "string") throw invalid();
    item[field] = raw === null ? null : (cell.label || raw).trim() || null;
  }
  for (const field of ["businessUnit", "project", "product", "status"]) {
    if (!item[field]) throw invalid();
  }
  if (item.completionDate !== null) {
    const raw = row[textColumns.completionDate].value;
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(raw) ||
      !Number.isFinite(Date.parse(raw)) ||
      new Date(raw).toISOString().slice(0, 10) !== raw
    )
      throw invalid();
    item.completionDate = raw;
  }
  for (const [field, column] of Object.entries(moneyColumns)) {
    item[field] = money(row[column]);
  }
  for (const [field, column] of Object.entries(numberColumns)) {
    item[field] = number(row[column]?.value);
    if (
      ["rooms", "parkingSpaces", "floor", "finalUnit"].includes(field) &&
      item[field] !== null &&
      !Number.isSafeInteger(item[field])
    )
      throw invalid();
  }
  if (item.progress !== null) {
    if (item.progress > 100) throw invalid();
    item.progress /= 100;
  }
  const streetNumber = number(row["Empreendimento__c.NumeroObra__c"]?.value);
  item.streetNumber = streetNumber === null ? null : String(streetNumber);
  const priceParts = [item.finalWithKit, item.unitBonus, item.tableSlack];
  const netCents = priceParts.some((part) => part === null)
    ? null
    : Math.round(item.finalWithKit * 100) -
      Math.round(item.unitBonus * 100) -
      Math.round(item.tableSlack * 100);
  // Same existing simulator formula, computed in cents; absent amounts remain absent.
  item.finalPrice =
    netCents !== null && Number.isSafeInteger(netCents) && netCents > 0 ? netCents / 100 : null;
  return item;
}

export async function collectInventory(sessionId, options = {}) {
  const request = options.request ?? createSalesforceRequest(sessionId, options);
  const { reportMetadata: original } = await request(`${endpoint}/describe`);
  metadataValid(original);
  const baseline = await projectCounts(request, original);
  const items = new Map();
  let sourceRows = 0;
  const columns = [...new Set([...original.detailColumns, statusColumn])];
  for (const project of baseline.projects) {
    const metadata = {
      ...original,
      detailColumns: columns,
      reportFilters: [
        ...original.reportFilters,
        { column: projectColumn, operator: "equals", value: project.label },
      ],
      reportBooleanFilter: original.reportBooleanFilter
        ? `(${original.reportBooleanFilter}) AND ${original.reportFilters.length + 1}`
        : null,
      hasDetailRows: true,
      hasRecordCount: true,
      showGrandTotal: true,
      aggregates: ["RowCount"],
    };
    const result = await request(`${endpoint}?includeDetails=true`, {
      method: "POST",
      body: { reportMetadata: metadata },
    });
    fullResult(result, metadata, true);
    const rows = result.factMap?.["T!T"]?.rows;
    if (!Array.isArray(rows) || count(result) !== project.rows || rows.length !== project.rows)
      throw incomplete();
    for (const entry of rows) {
      if (!Array.isArray(entry.dataCells) || entry.dataCells.length !== columns.length)
        throw invalid();
      const row = Object.fromEntries(
        columns.map((column, index) => [column, entry.dataCells[index]]),
      );
      if (row[projectColumn]?.recordId !== project.id) throw invalid();
      const item = projectInventoryRow(row);
      if (items.has(item.id) && !isDeepStrictEqual(items.get(item.id), item)) throw invalid();
      items.set(item.id, item);
      sourceRows++;
    }
    options.onProject?.({ rows: rows.length, collectedRows: sourceRows });
  }
  const end = await projectCounts(request, original);
  const finalDescription = await request(`${endpoint}/describe`);
  if (
    !isDeepStrictEqual(baseline, end) ||
    !isDeepStrictEqual(original, finalDescription.reportMetadata) ||
    sourceRows !== baseline.total
  )
    throw incomplete();
  return {
    schemaVersion: 1,
    source: "Salesforce · ESTOQUE SPC",
    sourceKind: "live",
    reportId: INVENTORY_REPORT_ID,
    generatedAt: new Date((options.now ?? Date.now)()).toISOString(),
    sourceRows,
    duplicateRows: sourceRows - items.size,
    projectCount: baseline.projects.length,
    count: items.size,
    items: [...items.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
