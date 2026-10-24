import { Columns3, Filter } from "lucide-react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePageAccess } from "@/lib/authorization/enforce";

import { LeadEmptyState, LeadPageShell, LeadSourceNotice } from "../_components/LeadWorkspace";

export const metadata = { title: "Funil de leads" };

export default async function LeadFunnelPage() {
  await enforcePageAccess("/app/leads/funil");

  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Funil"
      description="Acompanhamento das oportunidades por etapa comercial."
    >
      <LeadSourceNotice />

      <section aria-labelledby="lead-funnel-title" className="grid gap-3">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-funnel-title" className={managementStyles.sectionTitle}>
              Visão Kanban
            </h2>
            <p className={managementStyles.sectionDescription}>
              Etapas, contagens e valores dependerão da configuração comercial aprovada.
            </p>
          </div>
          <button type="button" className={managementStyles.button} disabled>
            <Filter size={17} aria-hidden="true" />
            Filtrar funil
          </button>
        </div>

        <LeadEmptyState
          icon={Columns3}
          title="Etapas do funil ainda não configuradas"
          description="Nenhuma coluna ou oportunidade demonstrativa foi criada. O quadro será montado somente com etapas e dados da fonte oficial."
        />
      </section>
    </LeadPageShell>
  );
}
