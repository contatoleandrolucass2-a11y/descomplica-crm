import { CalendarClock } from "lucide-react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePageAccess } from "@/lib/authorization/enforce";

import {
  LeadEmptyState,
  LeadPageShell,
  LeadSourceNotice,
  LeadUnavailableMetric,
} from "../_components/LeadWorkspace";

export const metadata = { title: "Atividades de leads" };

export default async function LeadActivitiesPage() {
  await enforcePageAccess("/app/leads/atividades");

  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Atividades"
      description="Tarefas, visitas e próximos compromissos vinculados aos leads."
    >
      <LeadSourceNotice />

      <section aria-labelledby="lead-activity-summary-title" className="grid gap-3">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-activity-summary-title" className={managementStyles.sectionTitle}>
              Agenda comercial
            </h2>
            <p className={managementStyles.sectionDescription}>
              Ausência de dados não é apresentada como zero.
            </p>
          </div>
        </div>
        <div className={managementStyles.summaryGrid}>
          <LeadUnavailableMetric label="Vencidas" />
          <LeadUnavailableMetric label="Para hoje" />
          <LeadUnavailableMetric label="Visitas" />
          <LeadUnavailableMetric label="Futuras" />
        </div>
      </section>

      <section aria-labelledby="lead-activity-list-title" className="grid gap-3 pt-1">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-activity-list-title" className={managementStyles.sectionTitle}>
              Próximas atividades
            </h2>
          </div>
        </div>
        <LeadEmptyState
          icon={CalendarClock}
          title="Agenda indisponível"
          description="As atividades aparecerão aqui depois que a fonte oficial e as regras de acesso forem configuradas."
        />
      </section>
    </LeadPageShell>
  );
}
