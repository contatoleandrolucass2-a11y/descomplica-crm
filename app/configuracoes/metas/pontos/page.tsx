import { loadDashboardPageData } from "../../../dashboard-data";
import { PointsSettingsClient } from "../../../PointsSettingsClient";

export const dynamic = "force-dynamic";

export default async function MetasPorPontos() {
  const { dashboard } = await loadDashboardPageData("/configuracoes/metas/pontos");
  const appointments = dashboard?.views.all.metrics.appointments.current.month ?? 0;
  const visits = dashboard?.views.all.metrics.visits.current.month ?? 0;
  const conversionRate = appointments > 0 ? visits / appointments : 0;

  return (
    <PointsSettingsClient
      conversionRate={conversionRate}
      appointments={appointments}
      visits={visits}
      sourceUpdatedAt={dashboard?.generatedAt ?? null}
    />
  );
}
