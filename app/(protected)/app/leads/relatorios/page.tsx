import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getLeadReport } from "@/lib/crm/leads/operations-data";

import {
  LeadReportsWorkspace,
  type LeadReportData,
  type LeadReportKind,
} from "../_components/LeadReportsWorkspace";
import { firstSearchValue, resolveLeadPageScope } from "../_components/LeadPageScope";
import {
  LeadPageShell,
  LeadScopeSelector,
  LeadSourceNotice,
  type LeadSourceState,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Relatórios de leads" };
const REPORTS = new Set<LeadReportKind>([
  "overview",
  "visits",
  "closed",
  "performance",
  "source",
  "nature",
]);
const REPORT_KEY = {
  overview: "general",
  visits: "visits",
  closed: "closed",
  performance: "performance",
  source: "origin",
  nature: "nature",
} as const;
const safeDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
const display = (value: unknown) =>
  value === null || value === undefined
    ? "Não informado"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

export default async function LeadReportsPage(props?: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await enforcePageAccess("/app/leads/relatorios");
  const params = (await props?.searchParams) ?? {};
  const requested = firstSearchValue(params.relatorio) as LeadReportKind;
  const reportKind = REPORTS.has(requested) ? requested : "overview";
  const scope = await resolveLeadPageScope(params, Boolean(props));
  let state: LeadSourceState = scope.state;
  let report: LeadReportData | null = null;
  if (scope.selectedScopeId) {
    const now = new Date();
    const defaultTo = now.toISOString().slice(0, 10);
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
    const from = safeDate(firstSearchValue(params.desde)) || defaultFrom;
    const to = safeDate(firstSearchValue(params.ate)) || defaultTo;
    try {
      const result = await getLeadReport(
        scope.selectedScopeId,
        REPORT_KEY[reportKind],
        from,
        to,
        {},
      );
      const keys = Array.from(new Set(result.items.flatMap((item) => Object.keys(item))));
      const labelKey = keys.find((key) =>
        ["label", "name", "source", "nature", "responsible"].includes(key),
      );
      const columns = keys.filter((key) => key !== labelKey && key !== "id");
      report = {
        available: result.available,
        periodLabel: `${result.period.from} a ${result.period.to}`,
        metrics: [{ label: "Total", value: result.summary.total }],
        columns,
        rows: result.items.map((item, index) => ({
          id: typeof item.id === "string" ? item.id : `row-${index}`,
          label: labelKey ? display(item[labelKey]) : `Linha ${index + 1}`,
          values: columns.map((column) => display(item[column])),
        })),
      };
      state = result.available
        ? result.items.length > 0 || result.summary.total > 0
          ? "ready"
          : "empty"
        : "not_configured";
    } catch {
      state = "error";
    }
  }
  const canExport = access.permissions.includes("crm.leads.reports.export");
  const exportHref =
    canExport && scope.selectedScopeId
      ? `/app/leads/exportar?scope=${encodeURIComponent(scope.selectedScopeId)}`
      : undefined;
  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Relatórios"
      description="Indicadores comerciais com período, escopo e disponibilidade explícitos."
      sourceState={state}
    >
      <LeadSourceNotice state={state} />
      <LeadScopeSelector
        scopes={scope.scopes}
        selectedScopeId={scope.selectedScopeId}
        invalid={scope.invalid}
      />
      <LeadReportsWorkspace
        state={state}
        reportKind={reportKind}
        report={report}
        scopeId={scope.selectedScopeId}
        canExport={canExport}
        exportHref={exportHref}
      />
    </LeadPageShell>
  );
}
