import { forbidden } from "next/navigation";

import { enforcePageAccess } from "@/lib/authorization/enforce";
import { getAuthorizedDashboardViews } from "@/lib/authorization/dashboard-views";
import { isDashboardView } from "@/lib/crm/dashboard/catalog";
import { loadProductiveTeamReadModel } from "@/lib/crm/stages/productive-team-data";
import { saoPauloDate } from "@/lib/crm/stages/appointments";
import { AnalyticsCanvas } from "../_components/analytics";
import analytics from "../_components/analytics/analytics.module.css";
import { ProductiveTeamDashboard } from "./_components/ProductiveTeamDashboard";

export default async function ProductiveTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const authorization = await enforcePageAccess("/app/equipe-produtiva");
  const views = getAuthorizedDashboardViews(authorization.permissions);
  const query = await searchParams;
  if (!views.length || (isDashboardView(query.view) && !views.includes(query.view))) forbidden();
  const view = isDashboardView(query.view) ? query.view : views[0]!;
  const data = await loadProductiveTeamReadModel(view);
  return (
    <main className={analytics.canvasMain}>
      <AnalyticsCanvas kind="stage">
        <ProductiveTeamDashboard {...data} calendarDate={saoPauloDate(new Date().toISOString())} />
      </AnalyticsCanvas>
    </main>
  );
}
