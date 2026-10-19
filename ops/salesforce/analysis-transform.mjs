import {
  ANALYSIS_STAGE_KEYS,
  DASHBOARD_CHANNELS,
  dashboardAnalysisSchema,
} from "../../lib/crm/dashboard/analysis-contract.ts";

const invalid = () => new Error("Invalid Salesforce dashboard analysis.");
const dimensions = {
  managers: "managerName",
  owners: "brokerName",
  companies: "businessUnit",
  developments: "development",
  stores: "storeName",
};

function validateDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw invalid();
  }
  return parsed;
}

/** Earliest of January 1 and the first day three months before the supplied local date. */
export function dashboardAnalysisCoverageStart(referenceDate) {
  const start = validateDate(referenceDate);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const previousThree = start.toISOString().slice(0, 10);
  const january = `${referenceDate.slice(0, 4)}-01-01`;
  return previousThree < january ? previousThree : january;
}

/**
 * Input views must already use the source's authorization-view partition and
 * deduplicated stage records. Dates are explicit America/Sao_Paulo YYYY-MM-DD
 * strings; approvedFolder is the source's existing approved-status predicate.
 * Empresa uses businessUnit (Unidade de Negocio); Canal uses realEstateName
 * (Imobiliaria). These source columns must never be interchanged.
 * Only dimension labels and daily aggregates are emitted. Missing labels use -1.
 * Unknown channels and dates outside coverage are excluded before dictionaries
 * are built; ambiguous channels and invalid data fail without exposing records.
 */
export function buildDashboardAnalysis({ referenceDate, views }) {
  const coverageStart = dashboardAnalysisCoverageStart(referenceDate);
  const analysisViews = views.map(({ viewKey, stages }) => {
    const records = [];
    for (const [stage, stageKey] of ANALYSIS_STAGE_KEYS.entries()) {
      for (const row of stages[stageKey]) {
        const realEstateName = String(row.realEstateName ?? "").toLowerCase();
        const matches = DASHBOARD_CHANNELS.flatMap((label, index) =>
          realEstateName.includes(label.toLowerCase()) ? [index] : [],
        );
        if (matches.length > 1) throw new Error("Ambiguous Salesforce dashboard channel.");
        if (matches.length === 0) continue;
        validateDate(row.date);
        if (row.date < coverageStart || row.date > referenceDate) continue;
        const labels = Object.fromEntries(
          Object.entries(dimensions).map(([key, field]) => {
            const value = key === "stores" && stageKey !== "appointments" ? "" : row[field];
            if (value !== undefined && value !== null && typeof value !== "string") throw invalid();
            return [key, (value ?? "").trim()];
          }),
        );
        const amount = stageKey === "sales" ? row.amount : 0;
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw invalid();
        if (stageKey === "folders" && typeof row.approvedFolder !== "boolean") throw invalid();
        records.push({
          stage,
          date: row.date,
          channel: matches[0],
          labels,
          amount,
          approved: stageKey === "folders" && row.approvedFolder ? 1 : 0,
        });
      }
    }
    const dictionaries = Object.fromEntries(
      Object.keys(dimensions).map((key) => [
        key,
        [...new Set(records.map((record) => record.labels[key]).filter(Boolean))].sort(),
      ]),
    );
    const indices = Object.fromEntries(
      Object.entries(dictionaries).map(([key, labels]) => [
        key,
        new Map(labels.map((label, index) => [label, index])),
      ]),
    );
    const aggregates = new Map();
    for (const record of records) {
      const index = (key) => indices[key].get(record.labels[key]) ?? -1;
      const key = [
        record.stage,
        record.date,
        index("managers"),
        index("owners"),
        index("companies"),
        record.channel,
        index("developments"),
      ];
      const store = index("stores");
      const encoded = JSON.stringify([...key, store]);
      const fact = aggregates.get(encoded) ?? [...key, 0, 0, 0, store];
      fact[7] += 1;
      fact[8] += record.amount;
      fact[9] += record.approved;
      aggregates.set(encoded, fact);
    }
    const facts = [...aggregates.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([, fact]) => fact);
    return { viewKey, dimensions: dictionaries, facts };
  });
  const parsed = dashboardAnalysisSchema.safeParse({
    version: 2,
    coverageStart,
    referenceDate,
    views: analysisViews,
  });
  if (!parsed.success) throw invalid();
  return parsed.data;
}
