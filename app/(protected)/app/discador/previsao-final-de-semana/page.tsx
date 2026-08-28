import { forbidden } from "next/navigation";

import { DataState, PageHeader, SectionHeading } from "@/app/(protected)/app/_components/analytics";
import { enforcePermission } from "@/lib/authorization/enforce";
import { getProtectedPageGate, protectedPageGateIsReleased } from "@/lib/authorization/page-gates";

import styles from "../discador.module.css";
import { WeekendForecastWorkspace } from "./WeekendForecastWorkspace";

export const metadata = { title: "Previsão Final de Semana" };
export const dynamic = "force-dynamic";

export default async function WeekendForecastPage() {
  const authorization = await enforcePermission("crm.dialer.view");
  const pageGate = getProtectedPageGate("/app/discador/previsao-final-de-semana");
  if (authorization.roleKey !== "master" || !pageGate || !protectedPageGateIsReleased(pageGate)) {
    forbidden();
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          eyebrow="Planejamento comercial"
          title="Previsão Final de Semana"
          description="Estrutura de previsto e realizado por corretor e empreendimento."
        />
        <DataState
          variant="warning"
          compact
          title="Página em desenvolvimento"
          description="Somente contratos e estados sintéticos estão disponíveis. Gravações operacionais permanecem desligadas."
        />
        <SectionHeading
          id="forecast-title"
          kicker="Detalhamento"
          title="Previsão por corretor"
          description="Abas de visitas e vendas serão preenchidas somente após aprovação da fonte e do fluxo de escrita."
        />
        <WeekendForecastWorkspace />
      </div>
    </main>
  );
}
