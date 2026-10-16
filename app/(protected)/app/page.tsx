import { forbidden } from "next/navigation";

import { getAuthorizedDashboardViews } from "@/lib/authorization/dashboard-views";
import { enforcePermission } from "@/lib/authorization/enforce";
import { isDashboardView, type DashboardViewKey } from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel } from "@/lib/crm/dashboard/data";
import {
  analyzeDashboard,
  applyDashboardAnalysis,
  parseDashboardFilters,
} from "@/lib/crm/dashboard/analysis";
import { getSalesforceRefreshConfiguration } from "@/lib/crm/salesforce/config";

import { DashboardReport } from "./_components/DashboardReport";
import styles from "./_components/analytics/analytics.module.css";

export const metadata = { title: "Dashboard comercial" };

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authorization = await enforcePermission("crm.dashboard.view");
  const query = await searchParams;
  const authorizedViews = getAuthorizedDashboardViews(authorization.permissions);
  if (authorizedViews.length === 0) forbidden();
  if (isDashboardView(query.view) && !authorizedViews.includes(query.view)) forbidden();

  const selectedView: DashboardViewKey = isDashboardView(query.view)
    ? query.view
    : authorizedViews[0]!;
  const filters = parseDashboardFilters(query);
  const canViewRanking = authorization.permissions.includes("crm.ranking.view");
  const result = await loadDashboardReadModel([selectedView], {
    includeTopDevelopments: canViewRanking,
    includeAnalysis: true,
  });
  const sourceDashboard = result.status === "ready" ? result.dashboard : null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const slice = sourceDashboard?.analysis?.[selectedView];
  const analysis = slice ? analyzeDashboard(slice, filters, today) : null;
  const dashboard =
    sourceDashboard && analysis
      ? applyDashboardAnalysis(sourceDashboard, analysis, selectedView)
      : sourceDashboard
        ? { ...sourceDashboard, metrics: {}, salesValue: {}, topDevelopments: {} }
        : null;
  const canRefresh =
    authorization.permissions.includes("crm.salesforce.refresh") &&
    getSalesforceRefreshConfiguration().available;

  return (
    <main className={styles.canvasMain}>
      <DashboardReport
        dashboard={dashboard}
        selectedView={selectedView}
        selectedPeriod="month"
        analysis={analysis}
        filters={filters}
        today={today}
        authorizedViews={authorizedViews}
        canViewStages={authorization.permissions.includes("crm.stages.view")}
        canViewRanking={canViewRanking}
        canRefresh={canRefresh}
        team={null}
        teamUnavailableReason="Aguardando a coleta detalhada da equipe."
      />
    </main>
  );
}
