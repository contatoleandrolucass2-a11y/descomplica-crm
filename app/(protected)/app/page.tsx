import { forbidden } from "next/navigation";

import { getAuthorizedDashboardViews } from "@/lib/authorization/dashboard-views";
import { enforcePermission } from "@/lib/authorization/enforce";
import { isDashboardView, type DashboardViewKey } from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel } from "@/lib/crm/dashboard/data";
import { loadDashboardTeam } from "@/lib/crm/dashboard/team";
import {
  analyzeDashboard,
  applyDashboardAnalysis,
  parseDashboardFilters,
} from "@/lib/crm/dashboard/analysis";
import { DASHBOARD_CHANNELS } from "@/lib/crm/dashboard/analysis-contract";
import { getSalesforceRefreshConfiguration } from "@/lib/crm/salesforce/config";
import { loadFunnelGoals } from "@/lib/crm/goals/data";
import { getAuthorizedNavigation } from "@/lib/navigation/pages";

import { DashboardReport } from "./_components/DashboardReport";
import styles from "./_components/analytics/analytics.module.css";

export const metadata = { title: "Dashboard | Resumo Geral" };

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
  const profileChannel =
    selectedView === "with_canal_imob" ? DASHBOARD_CHANNELS[0] : DASHBOARD_CHANNELS[1];
  filters.channel =
    selectedView === "all" && filters.channel.length === 1 ? filters.channel : [profileChannel];
  const canViewRanking = authorization.permissions.includes("crm.ranking.view");
  const pages = await getAuthorizedNavigation(authorization);
  const [result, partnershipGoalResult] = await Promise.all([
    loadDashboardReadModel([selectedView], {
      includeTopDevelopments: canViewRanking,
      includeAnalysis: true,
    }),
    filters.channel[0] === DASHBOARD_CHANNELS[0]
      ? loadFunnelGoals("partnerships")
      : Promise.resolve(null),
  ]);
  const sourceDashboard = result.status === "ready" ? result.dashboard : null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const slice = sourceDashboard?.analysis?.[selectedView];
  const analysis = slice ? analyzeDashboard(slice, filters, today) : null;
  const teamResult =
    sourceDashboard && filters.channel[0] === DASHBOARD_CHANNELS[1]
      ? await loadDashboardTeam(sourceDashboard, authorization, selectedView)
      : { status: "unavailable" as const, reason: "Equipe indisponível neste canal." };
  const goalBrokerCount =
    teamResult.status === "ready" && filters.owner.length === 0 && filters.company.length === 0
      ? filters.manager.length === 0
        ? teamResult.team.brokers
        : teamResult.team.managers
            .filter((manager) => filters.manager.includes(manager.name))
            .reduce((sum, manager) => sum + manager.total, 0)
      : null;
  const dashboard =
    sourceDashboard && analysis
      ? applyDashboardAnalysis(sourceDashboard, analysis, selectedView)
      : sourceDashboard
        ? { ...sourceDashboard, metrics: {}, salesValue: {}, topDevelopments: {} }
        : null;
  const canRefresh =
    authorization.permissions.includes("crm.salesforce.refresh") &&
    getSalesforceRefreshConfiguration().available;
  const partnershipGoals =
    partnershipGoalResult?.status === "ready"
      ? {
          visits: partnershipGoalResult.goals.visits,
          folders: partnershipGoalResult.goals.folders,
          "approved-folders": partnershipGoalResult.goals.approvedFolders,
          sales: partnershipGoalResult.goals.sales,
        }
      : null;

  return (
    <main className={styles.canvasMain}>
      <DashboardReport
        dashboard={dashboard}
        selectedView={selectedView}
        selectedPeriod="month"
        analysis={analysis}
        goalBrokerCount={goalBrokerCount}
        partnershipGoals={partnershipGoals}
        filters={filters}
        today={today}
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
