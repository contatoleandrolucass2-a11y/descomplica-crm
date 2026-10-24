import { Columns3, Filter } from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import {
  LeadStatePanel,
  LeadSummaryMetric,
  leadStyles,
  type LeadSourceState,
} from "./LeadWorkspace";

export type LeadFunnelCard = {
  id: string;
  customerName: string;
  interest: string | null;
  responsibleName: string | null;
  nextActivityLabel: string | null;
};

export type LeadFunnelStage = {
  id: string;
  label: string;
  leads: readonly LeadFunnelCard[];
  total: number;
  conversionPercent: number | null;
};

export function LeadFunnelWorkspace({
  state,
  stages,
  totalLeads,
  visibleLeads,
  averageCycleLabel,
  overallConversionPercent,
  scopeId,
}: {
  state: LeadSourceState;
  stages: readonly LeadFunnelStage[];
  totalLeads: number | null;
  visibleLeads?: number | undefined;
  averageCycleLabel: string | null;
  overallConversionPercent: number | null;
  scopeId?: string | undefined;
}) {
  return (
    <div className={leadStyles.workspace}>
      <section aria-labelledby="lead-funnel-analysis-title" className={leadStyles.stack}>
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-funnel-analysis-title" className={managementStyles.sectionTitle}>
              Análise do funil
            </h2>
            <p className={managementStyles.sectionDescription}>
              Indicadores calculados apenas com dados oficiais disponíveis.
            </p>
          </div>
        </div>
        <div className={leadStyles.analysisGrid}>
          <LeadSummaryMetric
            label="Leads no funil"
            value={totalLeads}
            helper={
              totalLeads !== null && visibleLeads !== undefined && visibleLeads < totalLeads
                ? `${visibleLeads} exibidos neste quadro`
                : undefined
            }
          />
          <LeadSummaryMetric
            label="Conversão geral"
            value={overallConversionPercent === null ? null : `${overallConversionPercent}%`}
          />
          <LeadSummaryMetric label="Ciclo médio" value={averageCycleLabel} />
        </div>
      </section>

      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full justify-between`}>
          <span className="inline-flex items-center gap-2">
            <Filter size={16} aria-hidden="true" />
            Filtrar funil
          </span>
          <span className={leadStyles.meta}>Responsável e período</span>
        </summary>
        <form className={leadStyles.filterPanel} method="get">
          {scopeId ? <input type="hidden" name="scope" value={scopeId} /> : null}
          <label className={leadStyles.field}>
            Responsável
            <input className={leadStyles.input} name="responsavel" placeholder="Todos" />
          </label>
          <label className={leadStyles.field}>
            Desde
            <input className={leadStyles.input} name="desde" type="date" />
          </label>
          <label className={leadStyles.field}>
            Até
            <input className={leadStyles.input} name="ate" type="date" />
          </label>
          <div className={`${leadStyles.inlineActions} ${leadStyles.fieldWide}`}>
            <button className={managementStyles.buttonPrimary} type="submit">
              Aplicar
            </button>
            <Link
              className={managementStyles.button}
              href={
                scopeId
                  ? `/app/leads/funil?scope=${encodeURIComponent(scopeId)}`
                  : "/app/leads/funil"
              }
            >
              Limpar
            </Link>
          </div>
        </form>
      </details>

      <section aria-labelledby="lead-funnel-title" className={leadStyles.stack}>
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-funnel-title" className={managementStyles.sectionTitle}>
              Visão Kanban
            </h2>
            <p className={managementStyles.sectionDescription}>
              Abra um cartão para trabalhar o lead; mudanças de etapa dependem de ação autorizada.
            </p>
          </div>
        </div>

        {state === "ready" || state === "empty" ? (
          stages.length > 0 ? (
            <div
              className={leadStyles.kanban}
              tabIndex={0}
              aria-label="Funil de leads; deslize horizontalmente em telas estreitas"
            >
              {stages.map((stage) => (
                <section
                  key={stage.id}
                  className={leadStyles.kanbanColumn}
                  aria-labelledby={`stage-${stage.id}`}
                >
                  <header className={leadStyles.kanbanHeader}>
                    <strong id={`stage-${stage.id}`}>{stage.label}</strong>
                    <span className={leadStyles.pill}>{stage.total}</span>
                  </header>
                  {stage.conversionPercent === null ? null : (
                    <div>
                      <div className={leadStyles.barTrack} aria-hidden="true">
                        <div
                          className={leadStyles.barValue}
                          style={{
                            width: `${Math.min(100, Math.max(0, stage.conversionPercent))}%`,
                          }}
                        />
                      </div>
                      <span className={leadStyles.meta}>
                        {stage.conversionPercent}% de conversão
                      </span>
                    </div>
                  )}
                  {stage.leads.length > 0 ? (
                    stage.leads.map((lead) => (
                      <Link
                        key={lead.id}
                        className={leadStyles.kanbanCard}
                        href={`/app/leads/lista?lead=${encodeURIComponent(lead.id)}${scopeId ? `&scope=${encodeURIComponent(scopeId)}` : ""}`}
                        prefetch={false}
                      >
                        <strong className="text-sm text-[var(--analytics-ink)]">
                          {lead.customerName}
                        </strong>
                        <span className={leadStyles.meta}>
                          {lead.interest ?? "Interesse não informado"}
                        </span>
                        <span className={leadStyles.meta}>
                          {lead.responsibleName ?? "Sem responsável"}
                        </span>
                        {lead.nextActivityLabel ? (
                          <span className={leadStyles.pill}>{lead.nextActivityLabel}</span>
                        ) : null}
                      </Link>
                    ))
                  ) : (
                    <span className={leadStyles.helper}>Nenhum lead nesta etapa.</span>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <LeadStatePanel
              state="empty"
              icon={Columns3}
              title="Funil sem etapas"
              description="Configure etapas comerciais antes de distribuir oportunidades."
            />
          )
        ) : (
          <LeadStatePanel
            state={state === "error" ? "error" : "not_configured"}
            icon={Columns3}
            title={
              state === "error"
                ? "Funil temporariamente indisponível"
                : "Etapas do funil ainda não configuradas"
            }
            description={
              state === "error"
                ? "A consulta falhou. Nenhuma contagem anterior foi apresentada como atual."
                : "O Kanban será exibido somente com etapas e dados da fonte oficial."
            }
          />
        )}
      </section>
    </div>
  );
}
