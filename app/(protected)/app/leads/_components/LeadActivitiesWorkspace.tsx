import { CalendarClock, CheckCircle2, Clock3, MapPin, PhoneCall } from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import {
  LeadStatePanel,
  LeadSummaryMetric,
  leadStyles,
  type LeadSourceState,
} from "./LeadWorkspace";

export type LeadActivityBucket = "overdue" | "today" | "visits" | "future";

export type LeadActivityItem = {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  type: "task" | "visit" | "call";
  dueAtLabel: string;
  responsibleName: string | null;
  isOverdue: boolean;
};

type LeadMutation = (formData: FormData) => void | Promise<void>;

const BUCKETS: ReadonlyArray<{ key: LeadActivityBucket; label: string }> = [
  { key: "overdue", label: "Vencidas" },
  { key: "today", label: "Hoje" },
  { key: "visits", label: "Visitas" },
  { key: "future", label: "Futuras" },
];

const TYPE_ICON = { task: Clock3, visit: MapPin, call: PhoneCall } as const;

export function LeadActivitiesWorkspace({
  state,
  activeBucket,
  activities,
  counts,
  scopeId,
  completeAction,
}: {
  state: LeadSourceState;
  activeBucket: LeadActivityBucket;
  activities: readonly LeadActivityItem[];
  counts: Partial<Record<LeadActivityBucket, number>>;
  scopeId?: string | undefined;
  completeAction?: LeadMutation | undefined;
}) {
  return (
    <div className={leadStyles.workspace}>
      <section aria-labelledby="lead-activity-summary-title" className={leadStyles.stack}>
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-activity-summary-title" className={managementStyles.sectionTitle}>
              Agenda comercial
            </h2>
            <p className={managementStyles.sectionDescription}>
              Contagens ausentes permanecem indisponíveis.
            </p>
          </div>
        </div>
        <div className={leadStyles.summaryGrid}>
          {BUCKETS.map((bucket) => (
            <LeadSummaryMetric
              key={bucket.key}
              label={bucket.label}
              value={counts[bucket.key] ?? null}
            />
          ))}
        </div>
      </section>

      <nav className={leadStyles.tabs} aria-label="Períodos e tipos de atividade">
        {BUCKETS.map((bucket) => (
          <Link
            key={bucket.key}
            className={leadStyles.tab}
            href={`/app/leads/atividades?grupo=${bucket.key}${scopeId ? `&scope=${encodeURIComponent(scopeId)}` : ""}`}
            aria-current={activeBucket === bucket.key ? "page" : undefined}
            prefetch={false}
          >
            {bucket.label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="lead-activity-list-title" className={leadStyles.stack}>
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-activity-list-title" className={managementStyles.sectionTitle}>
              Atividades
            </h2>
            <p className={managementStyles.sectionDescription}>
              Priorize atrasos e compromissos com horário definido.
            </p>
          </div>
        </div>

        {state === "ready" || state === "empty" ? (
          activities.length > 0 ? (
            <div className={leadStyles.activityGrid}>
              {activities.map((activity) => {
                const Icon = TYPE_ICON[activity.type];
                return (
                  <article key={activity.id} className={leadStyles.activityCard}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span className={managementStyles.iconFrame} aria-hidden="true">
                        <Icon />
                      </span>
                      <span className={leadStyles.pill}>
                        {activity.isOverdue ? "Vencida" : activity.dueAtLabel}
                      </span>
                    </div>
                    <div>
                      <h3 className={leadStyles.panelTitle}>{activity.title}</h3>
                      <p className={leadStyles.panelDescription}>
                        <Link
                          className={leadStyles.cardLink}
                          href={`/app/leads/lista?lead=${encodeURIComponent(activity.leadId)}${scopeId ? `&scope=${encodeURIComponent(scopeId)}` : ""}`}
                          prefetch={false}
                        >
                          {activity.leadName}
                        </Link>
                      </p>
                    </div>
                    <span className={leadStyles.meta}>
                      {activity.dueAtLabel} · {activity.responsibleName ?? "Sem responsável"}
                    </span>
                    <form {...(completeAction ? { action: completeAction } : {})}>
                      <input type="hidden" name="activityId" value={activity.id} />
                      <button
                        className={managementStyles.button}
                        type="submit"
                        disabled={!completeAction}
                      >
                        <CheckCircle2 size={16} aria-hidden="true" />
                        Concluir
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : (
            <LeadStatePanel
              state="empty"
              icon={CalendarClock}
              title="Nenhuma atividade nesta visão"
              description="Altere o período ou agende uma atividade no detalhe de um lead."
            />
          )
        ) : (
          <LeadStatePanel
            state={state === "error" ? "error" : "not_configured"}
            icon={CalendarClock}
            title={
              state === "error" ? "Agenda temporariamente indisponível" : "Agenda indisponível"
            }
            description={
              state === "error"
                ? "A consulta falhou. Tente novamente antes de reorganizar o atendimento."
                : "As atividades reais aparecerão quando a DAL autorizada estiver configurada."
            }
          />
        )}
      </section>
    </div>
  );
}
