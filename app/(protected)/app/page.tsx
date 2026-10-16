import { forbidden } from "next/navigation";

import { getAuthorizedDashboardViews } from "@/lib/authorization/dashboard-views";
import { enforcePermission } from "@/lib/authorization/enforce";
import {
  isDashboardPeriod,
  isDashboardView,
  type DashboardPeriodKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel } from "@/lib/crm/dashboard/data";
import { loadDashboardTeam } from "@/lib/crm/dashboard/team";
import { getSalesforceRefreshConfiguration } from "@/lib/crm/salesforce/config";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";

import { DashboardReport } from "./_components/DashboardReport";
import styles from "./_components/analytics/analytics.module.css";

export const metadata = { title: "Dashboard comercial" };

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; period?: string | string[] }>;
}) {
  const authorization = await enforcePermission("crm.dashboard.view");
  const query = await searchParams;
  const authorizedViews = getAuthorizedDashboardViews(authorization.permissions);
  if (authorizedViews.length === 0) forbidden();
  if (isDashboardView(query.view) && !authorizedViews.includes(query.view)) forbidden();

  const selectedView: DashboardViewKey = isDashboardView(query.view)
    ? query.view
    : authorizedViews[0]!;
  const selectedPeriod: DashboardPeriodKey = isDashboardPeriod(query.period)
    ? query.period
    : "month";
  const canViewRanking = authorization.permissions.includes("crm.ranking.view");
  const pages = await getAuthorizedNavigation(authorization);
  const result = await loadDashboardReadModel([selectedView], {
    includeTopDevelopments: canViewRanking,
  });
  const dashboard = result.status === "ready" ? result.dashboard : null;
  const teamResult = dashboard
    ? await loadDashboardTeam(dashboard, authorization, selectedView)
    : { status: "unavailable" as const, reason: "Aguardando uma atualização da equipe." };
  const canRefresh =
    authorization.permissions.includes("crm.salesforce.refresh") &&
    getSalesforceRefreshConfiguration().available;

  return (
    <main className={styles.canvasMain}>
      <DashboardReport
        dashboard={dashboard}
        selectedView={selectedView}
        selectedPeriod={selectedPeriod}
        authorizedViews={authorizedViews}
        canViewStages={pages.some((page) => page.path.startsWith("/app/etapas/"))}
        authorizedStagePaths={pages.map((page) => page.path)}
        canViewRanking={canViewRanking}
        canRefresh={canRefresh}
        team={teamResult.status === "ready" ? teamResult.team : null}
        teamUnavailableReason={teamResult.status === "unavailable" ? teamResult.reason : undefined}
      />
    </main>
  );
}
