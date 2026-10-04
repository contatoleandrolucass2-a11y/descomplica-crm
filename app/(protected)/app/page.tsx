import Link from "next/link";
import {
  BadgeCheck,
  CalendarCheck2,
  FolderCheck,
  Handshake,
  MapPin,
  type LucideIcon,
} from "lucide-react";

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
import {
  loadDashboardReadModel,
  type DashboardMetric,
  type DashboardReadModel,
} from "@/lib/crm/dashboard/data";
import {
  buildMonthlyFunnelSnapshots,
  buildOperationalComparisons,
  buildPeriodFunnelReadings,
  calculateProgress,
  metricValueForPeriod,
  type OperationalComparison,
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
  CommercialSourceLabel,
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

const DATA_UNAVAILABLE_LABEL = "Dados indisponíveis";

const STAGE_ACCENTS: Record<DashboardStageKey, ChartAccent> = {
  opportunities: "cyan",
  appointments: "blue",
  visits: "violet",
  folders: "teal",
  sales: "emerald",
};

const STAGE_ICONS: Record<DashboardStageKey, LucideIcon> = {
  opportunities: Handshake,
  appointments: CalendarCheck2,
  visits: MapPin,
  folders: FolderCheck,
  sales: BadgeCheck,
};

type StageSummaryRow = {
  key: DashboardStageKey;
  label: string;
  current: number | null;
  goal: number | null;
  progress: number | null;
};

const summaryColumns: Array<AnalyticsColumn<StageSummaryRow>> = [
  { key: "stage", label: "Etapa", render: (row) => row.label },
  {
    key: "current",
    label: "Realizado",
    align: "right",
    render: (row) =>
      row.current === null ? (
        <UnavailableValue reason="Ainda não existe snapshot comercial validado." />
      ) : (
        numberFormatter.format(row.current)
      ),
  },
  {
    key: "goal",
    label: "Meta",
    align: "right",
    render: (row) =>
      row.goal === null ? (
        <UnavailableValue reason="Meta oficial indisponível ou não definida para o período." />
      ) : (
        numberFormatter.format(row.goal)
      ),
  },
  {
    key: "progress",
    label: "Atingimento",
    align: "right",
    render: (row) =>
      row.progress === null ? (
        <UnavailableValue reason="O atingimento exige meta oficial maior que zero." />
      ) : (
        percentFormatter.format(row.progress)
      ),
  },
];

const OPERATIONAL_STAGES = ["appointments", "visits", "folders", "sales"] as const;

function optionalNumber(value: number | null, reason: string) {
  return value === null ? <UnavailableValue reason={reason} /> : numberFormatter.format(value);
}

const operationalColumns: Array<AnalyticsColumn<OperationalComparison>> = [
  {
    key: "comparison",
    label: "Comparativo",
    render: (row) => (
      <span>
        <strong className="block text-[var(--analytics-ink)]">{row.label}</strong>
        <span className="block text-xs text-[var(--analytics-muted)]">{row.comparison}</span>
      </span>
    ),
  },
  {
    key: "previous",
    label: "Realizado anterior",
    align: "right",
    render: (row) => optionalNumber(row.previous, "A janela anterior não existe no snapshot."),
  },
  {
    key: "current",
    label: "Realizado atual",
    align: "right",
    render: (row) => optionalNumber(row.current, "A janela atual não existe no snapshot."),
  },
  {
    key: "variation",
    label: "Variação",
    align: "right",
    render: (row) =>
      row.variation === null ? (
        <UnavailableValue reason="Sem base anterior suficiente para comparação." />
      ) : (
        `${row.variation >= 0 ? "+" : ""}${percentFormatter.format(row.variation)}`
      ),
  },
  {
    key: "goal",
    label: "Meta atual",
    align: "right",
    render: (row) => optionalNumber(row.goal, "Meta não aplicável ou sem fonte oficial."),
  },
  {
    key: "goal-progress",
    label: "Percentual da meta",
    align: "right",
    render: (row) =>
      row.goalProgress === null ? (
        <UnavailableValue reason="Meta não aplicável ou sem fonte oficial." />
      ) : (
        percentFormatter.format(row.goalProgress)
      ),
  },
];

type TemporalRow = {
  key: DashboardStageKey;
  label: string;
  metric: DashboardMetric | null;
};

function temporalColumns(goalsAvailable: boolean): Array<AnalyticsColumn<TemporalRow>> {
  const unavailableReason = "A janela não existe no snapshot validado atual.";
  const metricValue = (
    row: TemporalRow,
    key:
      | "currentMonth"
      | "previousMonth"
      | "yearClosedMonthsAverage"
      | "lastThreeClosedMonthsAverage"
      | "lastFourteenDays"
      | "lastSevenDays"
      | "currentWeek"
      | "currentToday",
  ) => optionalNumber(row.metric?.[key] ?? null, unavailableReason);

  return [
    { key: "stage", label: "Etapa", render: (row) => row.label },
    {
      key: "month",
      label: "Mês atual",
      align: "right",
      render: (row) => metricValue(row, "currentMonth"),
    },
    {
      key: "previous-month",
      label: "Mês anterior",
      align: "right",
      render: (row) => metricValue(row, "previousMonth"),
    },
    {
      key: "year-average",
      label: "Média dos meses encerrados no ano",
      align: "right",
      render: (row) => metricValue(row, "yearClosedMonthsAverage"),
    },
    {
      key: "three-month-average",
      label: "Média 3 meses",
      align: "right",
      render: (row) => metricValue(row, "lastThreeClosedMonthsAverage"),
    },
    {
      key: "last-fourteen",
      label: "Últimos 14 dias",
      align: "right",
      render: (row) => metricValue(row, "lastFourteenDays"),
    },
    {
      key: "last-seven",
      label: "Últimos 7 dias",
      align: "right",
      render: (row) => metricValue(row, "lastSevenDays"),
    },
    {
      key: "week",
      label: "Semana",
      align: "right",
      render: (row) => metricValue(row, "currentWeek"),
    },
    {
      key: "today",
      label: "Hoje",
      align: "right",
      render: (row) => metricValue(row, "currentToday"),
    },
    {
      key: "goal",
      label: "Meta mensal",
      align: "right",
      render: (row) => {
        const goal = row.metric?.goalMonth ?? null;
        return goalsAvailable && goal !== null && goal > 0 ? (
          numberFormatter.format(goal)
        ) : (
          <UnavailableValue
            reason={
              goalsAvailable
                ? "Meta não definida para esta etapa."
                : "A fonte oficial de metas ainda não está disponível."
            }
          />
        );
      },
    },
  ];
}

function dashboardHref(view: DashboardViewKey, period: DashboardPeriodKey) {
  return `/app?view=${encodeURIComponent(view)}&period=${encodeURIComponent(period)}`;
}

function stageMetric(
  dashboard: DashboardReadModel | null,
  view: DashboardViewKey,
  stage: DashboardStageKey,
): DashboardMetric | null {
  return dashboard?.metrics[view][stage] ?? null;
}

function officialGoal(
  dashboard: DashboardReadModel | null,
  metric: DashboardMetric | null,
  period: DashboardPeriodKey,
) {
  if (!dashboard || !metric) return null;
  const value = availableCommercialValue(
    dashboard.goalsAvailable,
    metricValueForPeriod(metric, period).goal,
  );
  return value !== null && value > 0 ? value : null;
}

function generatedAtLabel(dashboard: DashboardReadModel | null) {
  if (!dashboard) return DATA_UNAVAILABLE_LABEL;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: dashboard.timezone,
  }).format(new Date(dashboard.generatedAt));
}

function DashboardDetailSections({
  dashboard,
  metrics,
  selectedPeriod,
}: {
  dashboard: DashboardReadModel | null;
  metrics: Record<DashboardStageKey, DashboardMetric> | null;
  selectedPeriod: DashboardPeriodKey;
}) {
  const stages = Object.entries(DASHBOARD_STAGES) as Array<
    [DashboardStageKey, (typeof DASHBOARD_STAGES)[DashboardStageKey]]
  >;
  const goalsAvailable = dashboard?.goalsAvailable === true;
  const realizedSales = metrics
    ? metricValueForPeriod(metrics.sales, selectedPeriod).current
    : null;
  const monthlySnapshots = metrics ? buildMonthlyFunnelSnapshots(metrics, goalsAvailable) : [];
  const emptyFunnel = stages.map(([key, stage]) => ({
    key,
    label: stage.label,
    value: null,
    conversion: null,
  }));
  const temporalRows: TemporalRow[] = stages.map(([key, stage]) => ({
    key,
    label: stage.label,
    metric: metrics?.[key] ?? null,
  }));

  return (
    <>
      <section aria-labelledby="sales-pace-title">
        <SectionHeading
          id="sales-pace-title"
          density="compact"
          kicker="Ritmo de vendas"
          title="Realizado frente ao esperado"
          description="O realizado vem do snapshot selecionado; ritmo e esperado exigem calendário e meta oficial versionados."
        />
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            variant="compact"
            label="Vendas realizadas"
            value={realizedSales === null ? "—" : numberFormatter.format(realizedSales)}
            detail={realizedSales === null ? DATA_UNAVAILABLE_LABEL : "Snapshot autorizado"}
            ratio={null}
            ratioLabel="Realizado"
            accent="emerald"
          />
          <MetricCard
            variant="compact"
            label="Vendas esperadas até a data"
            value="—"
            detail="Calendário e meta oficial ausentes"
            ratio={null}
            ratioLabel="Indisponível"
            accent="cyan"
          />
          <AnalyticsCard density="compact">
            <DataState
              variant="unavailable"
              compact
              headingLevel="h3"
              title="Parecer de ritmo indisponível"
              description="Nenhum parecer é inferido sem o esperado oficial."
            />
          </AnalyticsCard>
        </div>
      </section>

      <section className="min-w-0" aria-labelledby="operational-detail-title">
        <SectionHeading
          id="operational-detail-title"
          density="compact"
          kicker="Detalhamento operacional"
          title="Realizado Funil"
          description="Mês, 14 dias, 7 dias, semana e dia usam somente janelas presentes no mesmo snapshot."
        />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          {["Corretores", "Gerentes"].map((label) => (
            <AnalyticsCard key={label} density="compact">
              <p className="text-xs font-semibold tracking-wide text-[var(--analytics-cyan-strong)] uppercase">
                {label}
              </p>
              <UnavailableValue reason="Fonte de vínculos escopados indisponível." />
            </AnalyticsCard>
          ))}
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {OPERATIONAL_STAGES.map((stageKey) => {
            const rows = metrics
              ? buildOperationalComparisons(metrics[stageKey], goalsAvailable)
              : [];
            return (
              <AnalyticsCard key={stageKey} density="compact" className="min-w-0">
                <h3 className="mb-3 text-base font-semibold text-[var(--analytics-ink)]">
                  {DASHBOARD_STAGES[stageKey].label} realizados
                </h3>
                {rows.length > 0 ? (
                  <AnalyticsTable
                    density="compact"
                    caption={`${DASHBOARD_STAGES[stageKey].label}: comparativos por intervalo`}
                    rows={rows}
                    columns={operationalColumns}
                    rowKey={(row) => row.key}
                  />
                ) : (
                  <DataState
                    variant="unavailable"
                    compact
                    headingLevel="h3"
                    title={DATA_UNAVAILABLE_LABEL}
                    description="Nenhum intervalo validado está disponível para esta etapa."
                  />
                )}
              </AnalyticsCard>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="commercial-diagnosis-title">
        <SectionHeading
          id="commercial-diagnosis-title"
          density="compact"
          kicker="Leitura operacional"
          title="Diagnóstico, gargalo e plano de ação"
          description="A composição permanece visível sem transformar volume agregado em recomendação comercial não validada."
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            ["Diagnóstico comercial", "Leitura do período"],
            ["Gargalo do funil", "Etapa crítica"],
            ["Plano de ação", "Próximas ações"],
          ].map(([kicker, title], index) => (
            <AnalyticsCard key={kicker} density="compact" tone={index === 1 ? "navy" : "default"}>
              <p
                className={`text-xs font-semibold tracking-widest uppercase ${
                  index === 1 ? "text-cyan-300" : "text-[var(--analytics-cyan-strong)]"
                }`}
              >
                {kicker}
              </p>
              <h3
                className={`mt-2 text-base font-semibold ${
                  index === 1 ? "text-white" : "text-[var(--analytics-ink)]"
                }`}
              >
                {title}
              </h3>
              <div className="mt-3">
                <DataState
                  variant="unavailable"
                  compact
                  headingLevel="h3"
                  title={DATA_UNAVAILABLE_LABEL}
                  description="Aguardando critério e fonte oficial versionados."
                />
              </div>
            </AnalyticsCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="monthly-comparisons-title">
        <SectionHeading
          id="monthly-comparisons-title"
          density="compact"
          kicker="Comparativo mensal"
          title="Realizado e meta lado a lado"
          description="Histórico, planejamento e realizado usam apenas as janelas existentes no read model."
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(monthlySnapshots.length > 0
            ? monthlySnapshots
            : [
                "Média do ano — meses fechados",
                "Média dos últimos três meses fechados",
                "Mês atual",
              ].map((label, index) => ({
                key: `unavailable-${index}`,
                label,
                readings: emptyFunnel,
              }))
          ).map((snapshot, index) => (
            <AnalyticsCard key={snapshot.key} density="compact">
              <FunnelChart
                variant="compact"
                label={snapshot.label}
                stages={snapshot.readings}
                accent={index === monthlySnapshots.length - 1 ? "lime" : "cyan"}
              />
            </AnalyticsCard>
          ))}
          {["Mês anterior no mesmo intervalo de dias", "Meta esperada até hoje"].map((label) => (
            <AnalyticsCard key={label} density="compact">
              <h3 className="text-base font-semibold text-[var(--analytics-ink)]">{label}</h3>
              <div className="mt-3">
                <DataState
                  variant="unavailable"
                  compact
                  headingLevel="h3"
                  title={DATA_UNAVAILABLE_LABEL}
                  description="A base ainda não fornece esse intervalo confirmado."
                />
              </div>
            </AnalyticsCard>
          ))}
        </div>
      </section>

      <section className="min-w-0" aria-labelledby="temporal-series-title">
        <SectionHeading
          id="temporal-series-title"
          density="compact"
          kicker="Série validada"
          title="Realizados e referências temporais"
          description="Ausências do snapshot permanecem explícitas e nunca são convertidas em zero."
        />
        <AnalyticsTable
          density="compact"
          caption="Indicadores reais por etapa e janela temporal"
          rows={temporalRows}
          columns={temporalColumns(goalsAvailable)}
          rowKey={(row) => row.key}
        />
      </section>

      <section aria-labelledby="manager-brokers-title">
        <SectionHeading
          id="manager-brokers-title"
          density="compact"
          kicker="Estrutura comercial"
          title="Corretores por gerente"
          description="A distribuição depende do roster oficial por IDs, escopo e vigência."
        />
        <DataState
          variant="unavailable"
          compact
          title="Distribuição indisponível"
          description="Nenhum nome, vínculo ou quantidade é presumido."
        />
      </section>
    </>
  );
}

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; period?: string | string[] }>;
}) {
  const authorization = await enforcePermission("crm.dashboard.view");
  const canViewStages = authorization.permissions.includes("crm.stages.view");
  const canRefresh = authorization.permissions.includes("crm.salesforce.refresh");
  const ingestConfiguration = getSalesforceIngestConfiguration();
  const refreshConfiguration = getSalesforceRefreshConfiguration();
  const query = await searchParams;
  const selectedView: DashboardViewKey = isDashboardView(query.view) ? query.view : "all";
  const selectedPeriod: DashboardPeriodKey = isDashboardPeriod(query.period)
    ? query.period
    : "month";
  const result = await loadDashboardReadModel();
  const dashboard = result.status === "ready" ? result.dashboard : null;
  const stages = Object.entries(DASHBOARD_STAGES) as Array<
    [DashboardStageKey, (typeof DASHBOARD_STAGES)[DashboardStageKey]]
  >;
  const metrics = dashboard?.metrics[selectedView] ?? null;
  const funnel = metrics
    ? buildPeriodFunnelReadings(metrics, selectedPeriod)
    : stages.map(([key, stage]) => ({
        key,
        label: stage.label,
        value: null,
        conversion: null,
      }));
  const summaryRows = stages.map(([key, stage]): StageSummaryRow => {
    const metric = stageMetric(dashboard, selectedView, key);
    const current = metric ? metricValueForPeriod(metric, selectedPeriod).current : null;
    const goal = officialGoal(dashboard, metric, selectedPeriod);

    return {
      key,
      label: stage.label,
      current,
      goal,
      progress: current === null || goal === null ? null : calculateProgress(current, goal),
    };
  });
  const salesValue = dashboard?.salesValue[selectedView][selectedPeriod] ?? null;

  return (
    <main className="min-w-0 px-3 py-5 sm:px-5 sm:py-7">
      <div className="mx-auto grid max-w-[100rem] min-w-0 grid-cols-1 gap-5">
        <PageHeader
          variant="compact"
          title="Dashboard comercial"
          description="Visão geral da operação comercial com os filtros e o snapshot autorizados."
          meta={
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs tracking-wide uppercase">Atualizado em</dt>
                <dd className="mt-1 font-semibold text-[var(--analytics-ink)]">
                  {generatedAtLabel(dashboard)}
                </dd>
              </div>
              <div>
                <dt className="text-xs tracking-wide uppercase">Fonte</dt>
                <dd className="mt-1 font-semibold break-words text-[var(--analytics-ink)]">
                  {dashboard ? (
                    <CommercialSourceLabel value={dashboard.source} />
                  ) : (
                    DATA_UNAVAILABLE_LABEL
                  )}
                </dd>
              </div>
            </dl>
          }
        />

        <FilterBar
          density="compact"
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

        {canRefresh ? (
          <div className="flex justify-end [&_span]:text-[var(--analytics-muted)]">
            <SalesforceRefreshButton available={refreshConfiguration.available} />
          </div>
        ) : null}

        {!dashboard ? (
          <DataState
            variant="unavailable"
            compact
            title={DATA_UNAVAILABLE_LABEL}
            description={
              ingestConfiguration.available
                ? "A ingestão autenticada está pronta, mas ainda não existe snapshot comercial validado."
                : "A integração de dados está indisponível neste ambiente. Nenhum dado demonstrativo é exibido."
            }
          />
        ) : !dashboard.goalsAvailable ? (
          <DataState
            variant="unavailable"
            compact
            title={GOALS_UNAVAILABLE_LABEL}
            description="Os realizados permanecem visíveis. Metas e atingimento ficam indisponíveis até existir fonte oficial segura."
          />
        ) : null}

        <section aria-labelledby="stage-summary-title">
          <SectionHeading
            id="stage-summary-title"
            density="compact"
            kicker={`${DASHBOARD_VIEWS[selectedView].label} · ${DASHBOARD_PERIODS[selectedPeriod].label}`}
            title="Indicadores do funil"
            description="Cada cartão mostra o volume real da etapa; meta e atingimento aparecem somente quando a fonte oficial permite."
          />
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summaryRows.map((row) => {
              const stage = CRM_STAGES.find((item) => item.key === row.key);
              const Icon = STAGE_ICONS[row.key];
              const metric = stageMetric(dashboard, selectedView, row.key);
              const rawGoal = metric ? metricValueForPeriod(metric, selectedPeriod).goal : null;
              const detail = !dashboard
                ? DATA_UNAVAILABLE_LABEL
                : !dashboard.goalsAvailable
                  ? GOALS_UNAVAILABLE_LABEL
                  : row.goal === null
                    ? rawGoal === 0
                      ? "Meta não definida para o período"
                      : "Meta indisponível"
                    : `Meta: ${numberFormatter.format(row.goal)}`;

              return (
                <div className="grid gap-2" key={row.key}>
                  <MetricCard
                    variant="compact"
                    label={row.label}
                    value={row.current === null ? "—" : numberFormatter.format(row.current)}
                    detail={detail}
                    ratio={row.progress}
                    ratioLabel={
                      row.progress === null
                        ? "Atingimento indisponível"
                        : `${percentFormatter.format(row.progress)} da meta`
                    }
                    accent={STAGE_ACCENTS[row.key]}
                    icon={<Icon strokeWidth={1.8} />}
                  />
                  {canViewStages && stage ? (
                    <Link
                      href={`/app/etapas/${stage.slug}?view=${encodeURIComponent(selectedView)}&period=${encodeURIComponent(selectedPeriod)}`}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--analytics-line)] bg-[var(--analytics-surface)] px-3 py-2 text-sm font-semibold text-[var(--analytics-cyan-strong)] hover:border-[var(--analytics-cyan-strong)]"
                    >
                      Abrir etapa
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
          <AnalyticsCard density="compact" className="min-w-0">
            <SectionHeading
              density="compact"
              kicker="Relação entre volumes"
              title="Funil do período"
              description="As razões comparam volumes agregados da mesma base; não acompanham grupos individuais ao longo do tempo."
            />
            <FunnelChart
              variant="compact"
              label={`${DASHBOARD_VIEWS[selectedView].label}, ${DASHBOARD_PERIODS[selectedPeriod].label.toLocaleLowerCase("pt-BR")}`}
              stages={funnel}
            />
          </AnalyticsCard>

          <div className="grid min-w-0 content-start gap-4">
            <AnalyticsCard density="compact" tone="navy">
              <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
                Valor vendido no período
              </p>
              <strong className="mt-2 block text-2xl font-semibold text-white">
                {salesValue === null
                  ? DATA_UNAVAILABLE_LABEL
                  : currencyFormatter.format(salesValue)}
              </strong>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Total do snapshot para a visão e o período selecionados.
              </p>
            </AnalyticsCard>
            <AnalyticsCard density="compact">
              <SectionHeading
                density="compact"
                kicker="Ranking validado"
                title="Oportunidades por empreendimento"
                description="Ordem fornecida pelo snapshot da visão selecionada."
              />
              {dashboard && dashboard.topDevelopments[selectedView].length > 0 ? (
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
                  variant={dashboard ? "empty" : "unavailable"}
                  compact
                  headingLevel="h3"
                  title={dashboard ? "Sem empreendimentos classificados" : DATA_UNAVAILABLE_LABEL}
                  description={
                    dashboard
                      ? "O snapshot atual não trouxe entradas para este ranking."
                      : "O ranking aguarda um snapshot comercial validado."
                  }
                />
              )}
            </AnalyticsCard>
          </div>
        </section>

        <section aria-labelledby="latest-activities-title">
          <SectionHeading
            id="latest-activities-title"
            density="compact"
            kicker="Movimentações recentes"
            title="Últimas atividades"
            description="O feed só será exibido quando existir uma fonte oficial escopada e validada no servidor."
          />
          <AnalyticsCard density="compact">
            <DataState
              variant="unavailable"
              compact
              headingLevel="h3"
              title="Dados indisponíveis"
              description="Nenhuma atividade é presumida ou reaproveitada de outra janela enquanto a fonte segura estiver ausente."
            />
          </AnalyticsCard>
        </section>

        <section className="min-w-0" aria-labelledby="summary-table-title">
          <SectionHeading
            id="summary-table-title"
            density="compact"
            kicker="Leitura consolidada"
            title="Realizado e meta por etapa"
            description="Ausência permanece ausência; a interface não converte dado faltante em zero."
          />
          <AnalyticsTable
            density="compact"
            caption={`Resumo do funil — ${DASHBOARD_VIEWS[selectedView].label}, ${DASHBOARD_PERIODS[selectedPeriod].label.toLocaleLowerCase("pt-BR")}`}
            rows={summaryRows}
            columns={summaryColumns}
            rowKey={(row) => row.key}
          />
        </section>

        <DashboardDetailSections
          dashboard={dashboard}
          metrics={metrics}
          selectedPeriod={selectedPeriod}
        />
      </div>
    </main>
  );
}
