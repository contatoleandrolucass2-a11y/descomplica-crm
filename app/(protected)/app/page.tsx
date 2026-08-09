import Link from "next/link";

import { enforcePermission } from "@/lib/authorization/enforce";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_STAGES,
  DASHBOARD_VIEWS,
  isDashboardPeriod,
  isDashboardView,
  type DashboardPeriodKey,
  type DashboardStageKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import { loadDashboardReadModel, type DashboardMetric } from "@/lib/crm/dashboard/data";
import {
  buildMonthlyFunnelSnapshots,
  buildPeriodFunnelReadings,
  calculateProgress,
  metricValueForPeriod,
} from "@/lib/crm/dashboard/presentation";
import {
  getSalesforceIngestConfiguration,
  getSalesforceRefreshConfiguration,
} from "@/lib/crm/salesforce/config";
import { GOALS_UNAVAILABLE_LABEL, availableCommercialValue } from "@/lib/crm/source-availability";
import { CRM_STAGES } from "@/lib/crm/stages/catalog";

import { SalesforceRefreshButton } from "./_components/SalesforceRefreshButton";
import {
  AnalyticsCard,
  AnalyticsTable,
  DataState,
  FilterBar,
  FilterGroup,
  FilterLink,
  FunnelChart,
  MetricCard,
  PageHeader,
  RankingList,
  SectionHeading,
  UnavailableValue,
  type AnalyticsColumn,
  type ChartAccent,
} from "./_components/analytics";

export const metadata = { title: "Dashboard comercial" };

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const STAGE_ACCENTS: Record<DashboardStageKey, ChartAccent> = {
  opportunities: "cyan",
  appointments: "blue",
  visits: "violet",
  folders: "teal",
  sales: "emerald",
};

function dashboardHref(view: DashboardViewKey, period: DashboardPeriodKey) {
  return `/app?view=${encodeURIComponent(view)}&period=${encodeURIComponent(period)}`;
}

function optionalNumber(value: number | null, reason: string) {
  return value === null ? <UnavailableValue reason={reason} /> : numberFormatter.format(value);
}

interface RealizedRow {
  key: DashboardStageKey;
  label: string;
  metric: DashboardMetric;
}

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; period?: string | string[] }>;
}) {
  const authorization = await enforcePermission("crm.dashboard.view");
  const canRefresh = authorization.permissions.includes("crm.salesforce.refresh");
  const ingestConfiguration = getSalesforceIngestConfiguration();
  const refreshConfiguration = getSalesforceRefreshConfiguration();
  const query = await searchParams;
  const selectedView: DashboardViewKey = isDashboardView(query.view) ? query.view : "all";
  const selectedPeriod: DashboardPeriodKey = isDashboardPeriod(query.period)
    ? query.period
    : "month";
  const result = await loadDashboardReadModel();

  if (result.status === "empty") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <DataState
          variant="empty"
          title="Dashboard aguardando snapshot real"
          description={
            ingestConfiguration.available
              ? "A ingestão autenticada está pronta. Nenhum dado demonstrativo substitui o snapshot comercial validado."
              : "A integração de dados está indisponível neste ambiente. Nenhum dado demonstrativo é exibido."
          }
          headingLevel="h1"
          action={
            canRefresh ? (
              <SalesforceRefreshButton available={refreshConfiguration.available} />
            ) : undefined
          }
        />
      </main>
    );
  }

  const { dashboard } = result;
  const metrics = dashboard.metrics[selectedView];
  const stages = Object.entries(DASHBOARD_STAGES) as Array<
    [DashboardStageKey, (typeof DASHBOARD_STAGES)[DashboardStageKey]]
  >;
  const selectedFunnel = buildPeriodFunnelReadings(metrics, selectedPeriod);
  const monthlySnapshots = buildMonthlyFunnelSnapshots(metrics, dashboard.goalsAvailable);
  const realizedRows: RealizedRow[] = stages.map(([key, stage]) => ({
    key,
    label: stage.label,
    metric: metrics[key],
  }));
  const unavailableReason = "A janela não existe no snapshot validado atual.";
  const goalsReason = "A fonte oficial de metas ainda não está disponível.";
  const realizedColumns: Array<AnalyticsColumn<RealizedRow>> = [
    { key: "stage", label: "Etapa", render: (row) => row.label },
    {
      key: "month",
      label: "Mês atual",
      align: "right",
      render: (row) => numberFormatter.format(row.metric.currentMonth),
    },
    {
      key: "previous-month",
      label: "Mês anterior",
      align: "right",
      render: (row) => optionalNumber(row.metric.previousMonth, unavailableReason),
    },
    {
      key: "year-average",
      label: "Média dos meses encerrados no ano",
      align: "right",
      render: (row) => optionalNumber(row.metric.yearClosedMonthsAverage, unavailableReason),
    },
    {
      key: "three-month-average",
      label: "Média 3 meses",
      align: "right",
      render: (row) => optionalNumber(row.metric.lastThreeClosedMonthsAverage, unavailableReason),
    },
    {
      key: "last-fourteen",
      label: "Últimos 14 dias",
      align: "right",
      render: (row) => optionalNumber(row.metric.lastFourteenDays, unavailableReason),
    },
    {
      key: "last-seven",
      label: "Últimos 7 dias",
      align: "right",
      render: (row) => optionalNumber(row.metric.lastSevenDays, unavailableReason),
    },
    {
      key: "week",
      label: "Semana",
      align: "right",
      render: (row) => numberFormatter.format(row.metric.currentWeek),
    },
    {
      key: "today",
      label: "Hoje",
      align: "right",
      render: (row) => numberFormatter.format(row.metric.currentToday),
    },
    {
      key: "goal",
      label: "Meta mensal",
      align: "right",
      render: (row) =>
        dashboard.goalsAvailable && row.metric.goalMonth > 0 ? (
          numberFormatter.format(row.metric.goalMonth)
        ) : (
          <UnavailableValue
            reason={dashboard.goalsAvailable ? "Meta não definida." : goalsReason}
          />
        ),
    },
  ];
  const salesValue = dashboard.salesValue[selectedView][selectedPeriod];

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl gap-7">
        <PageHeader
          eyebrow="Visão comercial autorizada"
          title="Dashboard do funil"
          description={DASHBOARD_VIEWS[selectedView].description}
          meta={
            <div className="grid gap-3">
              <dl className="grid gap-3">
                <div>
                  <dt className="text-xs tracking-wide text-slate-300 uppercase">Atualizado em</dt>
                  <dd className="mt-1 font-semibold text-white">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: dashboard.timezone,
                    }).format(new Date(dashboard.generatedAt))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-slate-300 uppercase">
                    Data de referência
                  </dt>
                  <dd className="mt-1 font-semibold text-white">
                    {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                      new Date(`${dashboard.referenceDate}T00:00:00Z`),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte</dt>
                  <dd className="mt-1 break-words text-slate-100">{dashboard.source}</dd>
                </div>
              </dl>
              {canRefresh ? (
                <div>
                  <SalesforceRefreshButton available={refreshConfiguration.available} />
                </div>
              ) : null}
            </div>
          }
          footer={
            authorization.permissions.includes("crm.stages.view") ? (
              <nav aria-label="Etapas do funil" className="flex flex-wrap gap-2">
                {CRM_STAGES.map((stage) => (
                  <Link
                    key={stage.slug}
                    href={`/app/etapas/${stage.slug}?view=${selectedView}&period=${selectedPeriod}`}
                    className="inline-flex min-h-11 items-center rounded-xl bg-white/8 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
                  >
                    {stage.label}
                  </Link>
                ))}
              </nav>
            ) : null
          }
        />

        <FilterBar
          label="Filtros autorizados do dashboard"
          unavailableDimensions={["Canal de vendas", "Gerente", "Responsável", "Empresa"]}
        >
          <FilterGroup label="Visão">
            {(Object.keys(DASHBOARD_VIEWS) as DashboardViewKey[]).map((viewKey) => (
              <FilterLink
                key={viewKey}
                href={dashboardHref(viewKey, selectedPeriod)}
                active={selectedView === viewKey}
              >
                {DASHBOARD_VIEWS[viewKey].label}
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup label="Período">
            {(Object.keys(DASHBOARD_PERIODS) as DashboardPeriodKey[]).map((periodKey) => (
              <FilterLink
                key={periodKey}
                href={dashboardHref(selectedView, periodKey)}
                active={selectedPeriod === periodKey}
              >
                {DASHBOARD_PERIODS[periodKey].label}
              </FilterLink>
            ))}
          </FilterGroup>
        </FilterBar>

        {!dashboard.goalsAvailable ? (
          <DataState
            variant="unavailable"
            compact
            title={GOALS_UNAVAILABLE_LABEL}
            description="Os realizados vêm do snapshot real. Metas, atingimento e arcos de progresso permanecem indisponíveis até existir fonte oficial segura."
          />
        ) : null}

        <section aria-labelledby="funnel-indicators-title">
          <SectionHeading
            id="funnel-indicators-title"
            kicker={`${DASHBOARD_VIEWS[selectedView].label} · ${DASHBOARD_PERIODS[selectedPeriod].label}`}
            title="Indicadores do funil"
            description="Valores realizados do snapshot autorizado; o arco aparece somente quando existe meta oficial maior que zero."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stages.map(([stageKey, stage]) => {
              const reading = metricValueForPeriod(metrics[stageKey], selectedPeriod);
              const goal = availableCommercialValue(dashboard.goalsAvailable, reading.goal);
              const progress =
                goal !== null && goal > 0 ? calculateProgress(reading.current, goal) : null;
              const goalDetail =
                goal === null
                  ? GOALS_UNAVAILABLE_LABEL
                  : goal > 0
                    ? `Meta: ${numberFormatter.format(goal)}`
                    : "Meta não definida para o período";

              return (
                <MetricCard
                  key={stageKey}
                  label={stage.label}
                  value={numberFormatter.format(reading.current)}
                  detail={goalDetail}
                  ratio={progress}
                  ratioLabel={
                    progress === null ? "Indisponível" : percentFormatter.format(progress)
                  }
                  accent={STAGE_ACCENTS[stageKey]}
                />
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <AnalyticsCard>
            <SectionHeading
              kicker="Relação entre volumes"
              title="Funil do período"
              description="Razões sequenciais comparam volumes agregados do mesmo snapshot; não representam coortes individuais."
            />
            <FunnelChart
              label={`${DASHBOARD_VIEWS[selectedView].label}, ${DASHBOARD_PERIODS[selectedPeriod].label.toLocaleLowerCase("pt-BR")}`}
              stages={selectedFunnel}
            />
          </AnalyticsCard>

          <div className="grid gap-5">
            <AnalyticsCard tone="navy">
              <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
                Valor vendido
              </p>
              <strong className="mt-3 block text-3xl font-semibold text-white">
                {currencyFormatter.format(salesValue)}
              </strong>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Total validado para a visão e o período selecionados.
              </p>
            </AnalyticsCard>
            <AnalyticsCard>
              <SectionHeading
                kicker="Ranking validado"
                title="Oportunidades por empreendimento"
                description="Ordem já calculada na ingestão; este componente não pontua nem reordena."
              />
              {dashboard.topDevelopments[selectedView].length > 0 ? (
                <RankingList
                  items={dashboard.topDevelopments[selectedView].map((development) => ({
                    id: `${selectedView}-${development.rank}`,
                    rank: development.rank,
                    name: development.name,
                    value: numberFormatter.format(development.total),
                  }))}
                />
              ) : (
                <DataState
                  variant="empty"
                  compact
                  title="Sem empreendimentos classificados"
                  description="O snapshot atual não trouxe entradas para este ranking."
                />
              )}
            </AnalyticsCard>
          </div>
        </section>

        <section aria-labelledby="monthly-comparisons-title">
          <SectionHeading
            id="monthly-comparisons-title"
            kicker="Comparação visual"
            title="Funis mensais disponíveis"
            description="Somente janelas existentes no read model. A projeção proporcional da referência não é reproduzida porque não há fórmula oficial validada."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {monthlySnapshots.map((snapshot, index) => (
              <AnalyticsCard key={snapshot.key}>
                <FunnelChart
                  label={snapshot.label}
                  stages={snapshot.readings}
                  accent={index === monthlySnapshots.length - 1 ? "lime" : "cyan"}
                />
              </AnalyticsCard>
            ))}
          </div>
        </section>

        <section aria-labelledby="realized-table-title">
          <SectionHeading
            id="realized-table-title"
            kicker="Série validada"
            title="Realizados e referências temporais"
            description="Ausências do snapshot ficam explícitas e não são convertidas em zero ou substituídas por outra janela."
          />
          <AnalyticsTable
            caption="Indicadores reais por etapa e janela temporal"
            rows={realizedRows}
            columns={realizedColumns}
            rowKey={(row) => row.key}
          />
        </section>
      </div>
    </main>
  );
}
