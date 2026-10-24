import { BarChart3, Download, Filter } from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import {
  LeadStatePanel,
  LeadSummaryMetric,
  leadStyles,
  type LeadSourceState,
} from "./LeadWorkspace";

export type LeadReportKind = "overview" | "visits" | "closed" | "performance" | "source" | "nature";
export type LeadReportRow = { id: string; label: string; values: readonly string[] };
export type LeadReportData = {
  available: boolean;
  periodLabel: string;
  metrics: ReadonlyArray<{ label: string; value: string | number | null; helper?: string }>;
  columns: readonly string[];
  rows: readonly LeadReportRow[];
};

const REPORTS: ReadonlyArray<{ key: LeadReportKind; label: string }> = [
  { key: "overview", label: "Geral" },
  { key: "visits", label: "Visitas" },
  { key: "closed", label: "Fechamentos" },
  { key: "performance", label: "Desempenho" },
  { key: "source", label: "Origem" },
  { key: "nature", label: "Natureza" },
];

export function LeadReportsWorkspace({
  state,
  reportKind,
  report,
  scopeId,
  canExport,
  exportHref,
}: {
  state: LeadSourceState;
  reportKind: LeadReportKind;
  report: LeadReportData | null;
  scopeId?: string | undefined;
  canExport: boolean;
  exportHref?: string | undefined;
}) {
  return (
    <div className={leadStyles.workspace}>
      <nav className={leadStyles.tabs} aria-label="Tipos de relatório">
        {REPORTS.map(({ key, label }) => (
          <Link
            key={key}
            className={leadStyles.tab}
            aria-current={reportKind === key ? "page" : undefined}
            href={`/app/leads/relatorios?relatorio=${key}${scopeId ? `&scope=${encodeURIComponent(scopeId)}` : ""}`}
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>
      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full justify-between`}>
          <span className="inline-flex items-center gap-2">
            <Filter size={16} aria-hidden="true" />
            Filtros do relatório
          </span>
          <span className={leadStyles.meta}>{report?.periodLabel ?? "Período não consultado"}</span>
        </summary>
        <form className={leadStyles.filterPanel} method="get">
          {scopeId ? <input type="hidden" name="scope" value={scopeId} /> : null}
          <input type="hidden" name="relatorio" value={reportKind} />
          <label className={leadStyles.field}>
            Desde
            <input className={leadStyles.input} name="desde" type="date" />
          </label>
          <label className={leadStyles.field}>
            Até
            <input className={leadStyles.input} name="ate" type="date" />
          </label>
          <label className={leadStyles.field}>
            Responsável
            <input className={leadStyles.input} name="responsavel" placeholder="Todos" />
          </label>
          <div className={`${leadStyles.inlineActions} ${leadStyles.fieldWide}`}>
            <button className={managementStyles.buttonPrimary} type="submit">
              Aplicar filtros
            </button>
            <Link
              className={managementStyles.button}
              href={`/app/leads/relatorios?relatorio=${reportKind}${scopeId ? `&scope=${encodeURIComponent(scopeId)}` : ""}`}
            >
              Limpar
            </Link>
          </div>
        </form>
      </details>
      {(state === "ready" || state === "empty") && report?.available ? (
        <>
          <section className={leadStyles.stack} aria-labelledby="report-kpis-title">
            <div className={managementStyles.sectionHeader}>
              <div>
                <h2 id="report-kpis-title" className={managementStyles.sectionTitle}>
                  Indicadores
                </h2>
                <p className={managementStyles.sectionDescription}>{report.periodLabel}</p>
              </div>
              {canExport && exportHref ? (
                <a className={managementStyles.button} href={exportHref} download>
                  <Download size={16} aria-hidden="true" />
                  Exportar dados filtrados
                </a>
              ) : (
                <span className={leadStyles.helper}>Exportação não autorizada</span>
              )}
            </div>
            <div className={leadStyles.summaryGrid}>
              {report.metrics.map((metric) => (
                <LeadSummaryMetric
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  helper={metric.helper}
                />
              ))}
            </div>
          </section>
          <section className={leadStyles.stack} aria-labelledby="report-details-title">
            <h2 id="report-details-title" className={managementStyles.sectionTitle}>
              Detalhamento
            </h2>
            {report.rows.length > 0 ? (
              <div
                className={leadStyles.tableRegion}
                tabIndex={0}
                aria-label="Tabela do relatório; deslize horizontalmente em telas estreitas"
              >
                <table className={leadStyles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Dimensão</th>
                      {report.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.label}</th>
                        {row.values.map((value, index) => (
                          <td key={`${row.id}-${report.columns[index] ?? index}`}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <LeadStatePanel
                state="empty"
                title="Sem dados no período"
                description="A fonte está disponível, mas nenhum registro corresponde aos filtros."
              />
            )}
          </section>
        </>
      ) : (
        <LeadStatePanel
          state={state === "error" ? "error" : "not_configured"}
          icon={BarChart3}
          title={
            state === "error"
              ? "Relatório temporariamente indisponível"
              : report && !report.available
                ? "Relatório não disponível"
                : state === "scope_required"
                  ? "Selecione um escopo"
                  : "Relatórios ainda não configurados"
          }
          description={
            state === "error"
              ? "A consulta falhou; valores anteriores não foram apresentados como atuais."
              : "Indicadores só aparecem quando a fonte oficial declara disponibilidade."
          }
        />
      )}
    </div>
  );
}
