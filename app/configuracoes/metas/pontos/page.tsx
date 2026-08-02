import { loadDashboardPageData } from "../../../dashboard-data";
import { PointsSettingsClient } from "../../../PointsSettingsClient";
import type { DashboardFilterRecord } from "../../../types";

export const dynamic = "force-dynamic";

const TARGET_AGENCY = "DIRECIONAL VENDAS SPC";

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function isTargetAgency(record: DashboardFilterRecord) {
  const raw = record as DashboardFilterRecord & Record<string, unknown>;
  return [record.realEstateAgency, record.salesChannel, record.company, raw["Imobiliária"], raw.Imobiliaria]
    .some((value) => normalized(value).includes(normalized(TARGET_AGENCY)));
}

function currentMonthCount(records: DashboardFilterRecord[], referenceDate: string) {
  const month = referenceDate.slice(0, 7);
  return records.filter((record) => isTargetAgency(record) && record.date?.slice(0, 7) === month && record.date.slice(0, 10) <= referenceDate.slice(0, 10)).length;
}

export default async function MetasPorPontos() {
  const { dashboard, dataStatus } = await loadDashboardPageData("/configuracoes/metas/pontos");
  const records = dashboard?.filterData?.records;
  const appointments = dashboard && records ? currentMonthCount(records.appointments, dashboard.referenceDate) : dashboard?.views.all.metrics.appointments.current.month ?? 0;
  const visits = dashboard && records ? currentMonthCount(records.visits, dashboard.referenceDate) : dashboard?.views.all.metrics.visits.current.month ?? 0;
  const conversionRate = appointments > 0 ? visits / appointments : 0;

  return (
    <PointsSettingsClient
      conversionRate={conversionRate}
      appointments={appointments}
      visits={visits}
      sourceUpdatedAt={dashboard?.generatedAt ?? null}
      dashboard={dashboard}
      dataStatus={dataStatus}
    />
  );
}
