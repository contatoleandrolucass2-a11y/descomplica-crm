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

const DATA_UNAVAILABLE_LABEL = "Dado indisponível — integração pendente";

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

const OPERATIONAL_STAGES = ["appointments", "visits", "folders", "sales"] as const;

const operationalColumns: Array<AnalyticsColumn<OperationalComparison>> = [
  {
    key: "comparison",
    label: "Comparativo",
    render: (row) => (
      <span>
        <strong className="block text-slate-900">{row.label}</strong>
        <span className="block text-xs text-slate-600">{row.comparison}</span>
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

function DashboardCompletion({
  metrics,
  selectedPeriod,
  goalsAvailable,
}: {
  metrics: Record<DashboardStageKey, DashboardMetric> | null;
  selectedPeriod: DashboardPeriodKey;
  goalsAvailable: boolean;
}) {
  const realizedSales = metrics
    ? metricValueForPeriod(metrics.sales, selectedPeriod).current
    : null;

  return (
    <>
      <section aria-labelledby="sales-pace-title">
        <SectionHeading
          id="sales-pace-title"
          kicker="Ritmo de vendas"
          title="Realizado frente ao esperado"
          description="O realizado vem do snapshot selecionado; ritmo, sinal e esperado exigem calendário e meta oficial versionados."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Vendas realizadas"
            value={realizedSales === null ? "Indisponível" : numberFormatter.format(realizedSales)}
            detail={realizedSales === null ? DATA_UNAVAILABLE_LABEL : "Snapshot autorizado"}
            ratio={null}
            ratioLabel="Realizado"
            accent="emerald"
          />
          <MetricCard
            label="Vendas esperadas até a data"
            value="Indisponível"
            detail="Calendário e meta oficial ausentes"
            ratio={null}
            ratioLabel="Indisponível"
            accent="cyan"
          />
          <AnalyticsCard>
            <DataState
              variant="unavailable"
              compact
              headingLevel="h3"
              title="Parecer de ritmo indisponível"
              description="Nenhum texto positivo, neutro ou negativo é inferido sem o esperado oficial."
            />
          </AnalyticsCard>
        </div>
      </section>

      <section className="min-w-0" aria-labelledby="operational-detail-title">
        <SectionHeading
          id="operational-detail-title"
          kicker="Detalhamento operacional"
          title="Realizado Funil"
          description="Mês, 14 dias, 7 dias, semana e dia usam somente janelas presentes no mesmo snapshot. Corretores e gerentes aguardam fonte escopada."
        />
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Corretores", "Fonte de vínculos escopados indisponível"],
              ["Gerentes", "Fonte de vínculos escopados indisponível"],
            ] as const
          ).map(([label, reason]) => (
            <AnalyticsCard key={label}>
              <p className="text-xs font-semibold tracking-wide text-cyan-700 uppercase">{label}</p>
              <UnavailableValue reason={reason} />
            </AnalyticsCard>
          ))}
        </div>
        <div className="grid min-w-0 gap-5">
          {OPERATIONAL_STAGES.map((stageKey) => {
            const rows = metrics
              ? buildOperationalComparisons(metrics[stageKey], goalsAvailable)
              : [];
            return (
              <AnalyticsCard key={stageKey} className="min-w-0">
                <h3 className="mb-3 text-lg font-semibold text-slate-950">
                  {DASHBOARD_STAGES[stageKey].label} realizados
                </h3>
                {rows.length > 0 ? (
                  <AnalyticsTable
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

      <section aria-labelledby="manager-brokers-title">
        <SectionHeading
          id="manager-brokers-title"
          kicker="Estrutura comercial"
          title="Corretores por gerente"
          description="Total ativo, participação, periodicidade e o grupo sem gerente dependem do roster oficial por IDs e vigência."
        />
        <DataState
          variant="unavailable"
          title="Distribuição indisponível"
          description="Nenhum nome, vínculo ou quantidade é presumido. Aguardando fonte oficial escopada."
        />
      </section>

      <footer className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <strong className="text-slate-900">Descomplica CRM</strong>
        <span> · Inteligência comercial consolidada do Salesforce</span>
        <span className="block">Canal de contato: configuração institucional indisponível.</span>
      </footer>
    </>
  );
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
  const stages = Object.entries(DASHBOARD_STAGES) as Array<
    [DashboardStageKey, (typeof DASHBOARD_STAGES)[DashboardStageKey]]
  >;
  const result = await loadDashboardReadModel();

  if (result.status === "empty") {
    const emptyFunnel = stages.map(([key, stage]) => ({
      key,
      label: stage.label,
      value: null,
      conversion: null,
    }));
    const emptyRows = stages.map(([key, stage]) => ({ key, label: stage.label }));
    const emptyColumns: Array<AnalyticsColumn<(typeof emptyRows)[number]>> = [
      { key: "stage", label: "Etapa", render: (row) => row.label },
      ...[
        "Mês atual",
        "Mês anterior",
        "Média dos meses encerrados no ano",
        "Média 3 meses",
        "Últimos 14 dias",
        "Últimos 7 dias",
        "Semana",
        "Hoje",
        "Meta mensal",
      ].map((label, index) => ({
        key: `unavailable-${index}`,
        label,
        align: "right" as const,
        render: () => <UnavailableValue reason={DATA_UNAVAILABLE_LABEL} />,
      })),
    ];

    return (
      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-1 gap-7">
          <PageHeader
            eyebrow="Visão consolidada"
            title="Relatório completo da equipe"
            description="Resultados separados por origem e atualizados pelo Salesforce. Dimensões sem fonte segura permanecem indisponíveis."
            meta={
              <div className="grid gap-3">
                <dl className="grid gap-3">
                  <div>
                    <dt className="text-xs tracking-wide text-slate-300 uppercase">
                      Atualizado em
                    </dt>
                    <dd className="mt-1 font-semibold text-white">{DATA_UNAVAILABLE_LABEL}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-slate-300 uppercase">Fonte</dt>
                    <dd className="mt-1 text-slate-100">{DATA_UNAVAILABLE_LABEL}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-slate-300 uppercase">
                      Periodicidade
                    </dt>
                    <dd className="mt-1 text-slate-100">{DATA_UNAVAILABLE_LABEL}</dd>
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
                  <Link
                    href={dashboardHref(selectedView, selectedPeriod)}
                    aria-current="page"
                    className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-[#082137]"
                  >
                    Visão Geral
                  </Link>
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

          <section className="min-w-0" aria-labelledby="empty-funnel-indicators-title">
            <SectionHeading
              id="empty-funnel-indicators-title"
              kicker="Pulso do funil"
              title="Conversão por etapa"
              description="Rosca = avanço entre etapas · Parecer = realizado frente à meta. Valores e pareceres aguardam snapshot oficial seguro."
            />
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {stages.map(([stageKey, stage]) => (
                <div key={stageKey} className="grid gap-2">
                  <MetricCard
                    label={stage.label}
                    value="Indisponível"
                    detail={DATA_UNAVAILABLE_LABEL}
                    ratio={null}
                    ratioLabel="Indisponível"
                    accent={STAGE_ACCENTS[stageKey]}
                  />
                  {authorization.permissions.includes("crm.stages.view") ? (
                    <Link
                      href={`/app/etapas/${CRM_STAGES.find((item) => item.key === stageKey)?.slug ?? stageKey}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-800"
                    >
                      Abrir análise
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <AnalyticsCard className="min-w-0">
              <SectionHeading
                kicker="Relação entre volumes"
                title="Funil do período"
                description="Volumes e conversões permanecem indisponíveis até existir snapshot real validado."
              />
              <FunnelChart
                label={`${DASHBOARD_VIEWS[selectedView].label}, ${DASHBOARD_PERIODS[selectedPeriod].label.toLocaleLowerCase("pt-BR")}`}
                stages={emptyFunnel}
              />
            </AnalyticsCard>

            <div className="grid min-w-0 grid-cols-1 gap-5">
              <AnalyticsCard tone="navy" className="min-w-0">
                <p className="text-xs font-semibold tracking-widest text-cyan-300 uppercase">
                  Valor vendido
                </p>
                <div className="mt-4 text-slate-100">
                  <UnavailableValue reason={DATA_UNAVAILABLE_LABEL} />
                </div>
              </AnalyticsCard>
              <AnalyticsCard className="min-w-0">
                <SectionHeading
                  kicker="Ranking validado"
                  title="Oportunidades por empreendimento"
                  description="Nenhuma posição é inferida sem dados oficiais."
                />
                <DataState
                  variant="unavailable"
                  compact
                  title={DATA_UNAVAILABLE_LABEL}
                  description="O ranking aguarda entradas do snapshot autorizado."
                />
              </AnalyticsCard>
            </div>
          </section>

          <section className="min-w-0" aria-labelledby="empty-commercial-diagnosis-title">
            <SectionHeading
              id="empty-commercial-diagnosis-title"
              kicker="Leitura operacional"
              title="Diagnóstico, gargalo e plano de ação"
              description="Nenhuma leitura comercial é inferida sem dados e critérios oficiais validados."
            />
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
              {[
                ["Diagnóstico comercial", "Leitura do período"],
                ["Gargalo do funil", "Etapa crítica"],
                ["Plano de ação", "Próximas ações"],
              ].map(([kicker, title], index) => (
                <AnalyticsCard
                  key={kicker}
                  tone={index === 1 ? "navy" : "default"}
                  className="min-w-0"
                >
                  <p
                    className={`text-xs font-semibold tracking-widest uppercase ${index === 1 ? "text-lime-300" : "text-cyan-700"}`}
                  >
                    {kicker}
                  </p>
                  <h3
                    className={`mt-3 text-xl font-semibold ${index === 1 ? "text-white" : "text-slate-950"}`}
                  >
                    {title}
                  </h3>
                  <div className="mt-5">
                    <DataState
                      variant="unavailable"
                      compact
                      headingLevel="h3"
                      title={DATA_UNAVAILABLE_LABEL}
                      description="A fonte oficial ainda não está disponível."
                    />
                  </div>
                </AnalyticsCard>
              ))}
            </div>
          </section>

          <section className="min-w-0" aria-labelledby="empty-monthly-comparisons-title">
            <SectionHeading
              id="empty-monthly-comparisons-title"
              kicker="Comparativo mensal"
              title="Realizado e meta lado a lado"
              description="Histórico × planejamento × realizado. Médias fechadas e meta esperada aguardam intervalos confirmados pelo backend."
            />
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                "Média do ano — meses fechados",
                "Média dos últimos três meses fechados",
                "Mês anterior no mesmo intervalo",
                "Meta atual projetada para o mês",
                "Meta esperada até hoje",
                "Mês atual",
              ].map((label, index) => (
                <AnalyticsCard key={label} className="min-w-0">
                  <FunnelChart
                    label={label}
                    stages={emptyFunnel}
                    accent={index === 2 ? "lime" : "cyan"}
                  />
                </AnalyticsCard>
              ))}
            </div>
          </section>

          <section className="min-w-0" aria-labelledby="empty-realized-table-title">
            <SectionHeading
              id="empty-realized-table-title"
              kicker="Série validada"
              title="Realizados e referências temporais"
              description="A estrutura temporal permanece auditável; células sem fonte não são convertidas em zero."
            />
            <AnalyticsTable
              caption="Indicadores por etapa e janela temporal"
              rows={emptyRows}
              columns={emptyColumns}
              rowKey={(row) => row.key}
            />
          </section>

          <DashboardCompletion
            metrics={null}
            selectedPeriod={selectedPeriod}
            goalsAvailable={false}
          />
        </div>
      </main>
    );
  }

  const { dashboard } = result;
  const metrics = dashboard.metrics[selectedView];
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
    <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid max-w-7xl min-w-0 grid-cols-1 gap-7">
        <PageHeader
          eyebrow="Visão consolidada"
          title="Relatório completo da equipe"
          description="Resultados separados por origem e atualizados pelo Salesforce. Cada valor mantém o recorte autorizado do snapshot."
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
                <div>
                  <dt className="text-xs tracking-wide text-slate-300 uppercase">Periodicidade</dt>
                  <dd className="mt-1 text-slate-100">
                    Dado indisponível — contrato de sincronização pendente
                  </dd>
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
                <Link
                  href={dashboardHref(selectedView, selectedPeriod)}
                  aria-current="page"
                  className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-[#082137]"
                >
                  Visão Geral
                </Link>
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
            kicker={`Pulso do funil · ${DASHBOARD_VIEWS[selectedView].label} · ${DASHBOARD_PERIODS[selectedPeriod].label}`}
            title="Conversão por etapa"
            description="Rosca = avanço entre etapas · Parecer = realizado frente à meta. O arco aparece somente quando existe meta oficial maior que zero."
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

              const stageSlug = CRM_STAGES.find((item) => item.key === stageKey)?.slug;
              return (
                <div key={stageKey} className="grid gap-2">
                  <MetricCard
                    label={stage.label}
                    value={numberFormatter.format(reading.current)}
                    detail={goalDetail}
                    ratio={progress}
                    ratioLabel={
                      progress === null ? "Indisponível" : percentFormatter.format(progress)
                    }
                    accent={STAGE_ACCENTS[stageKey]}
                  />
                  {authorization.permissions.includes("crm.stages.view") && stageSlug ? (
                    <Link
                      href={`/app/etapas/${stageSlug}?view=${selectedView}&period=${selectedPeriod}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-800"
                    >
                      Abrir análise
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <AnalyticsCard className="min-w-0">
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

          <div className="grid min-w-0 grid-cols-1 gap-5">
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

        <section aria-labelledby="commercial-diagnosis-title">
          <SectionHeading
            id="commercial-diagnosis-title"
            kicker="Leitura operacional"
            title="Diagnóstico, gargalo e plano de ação"
            description="Composição preservada sem transformar volume agregado em recomendação comercial não validada."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <AnalyticsCard>
              <p className="text-xs font-semibold tracking-widest text-cyan-700 uppercase">
                Diagnóstico comercial
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">Leitura do período</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">
                Espaço reservado para diagnóstico derivado de regra comercial oficial.
              </p>
              <div className="mt-5">
                <DataState
                  variant="unavailable"
                  compact
                  headingLevel="h3"
                  title="Dado indisponível — integração pendente"
                  description="O snapshot atual não contém diagnóstico validado."
                />
              </div>
            </AnalyticsCard>

            <AnalyticsCard tone="navy">
              <p className="text-xs font-semibold tracking-widest text-lime-300 uppercase">
                Gargalo do funil
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">Etapa crítica</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">
                A interface não escolhe gargalos somente pela menor razão agregada.
              </p>
              <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-5">
                <strong className="block text-base text-white">
                  Dado indisponível — integração pendente
                </strong>
                <span className="mt-2 block text-sm leading-6 text-slate-300">
                  Critério oficial de diagnóstico ainda não versionado.
                </span>
              </div>
            </AnalyticsCard>

            <AnalyticsCard>
              <p className="text-xs font-semibold tracking-widest text-cyan-700 uppercase">
                Plano de ação
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">Próximas ações</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">
                Recomendações só serão exibidas após validação por responsável comercial.
              </p>
              <div className="mt-5">
                <DataState
                  variant="unavailable"
                  compact
                  headingLevel="h3"
                  title="Dado indisponível — integração pendente"
                  description="Nenhuma ação automática foi inferida dos dados."
                />
              </div>
            </AnalyticsCard>
          </div>
        </section>

        <section aria-labelledby="monthly-comparisons-title">
          <SectionHeading
            id="monthly-comparisons-title"
            kicker="Comparativo mensal"
            title="Realizado e meta lado a lado"
            description="Histórico × planejamento × realizado. Somente janelas existentes no read model; projeção proporcional exige fórmula oficial validada."
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
            {["Mês anterior no mesmo intervalo de dias", "Meta esperada até hoje"].map((label) => (
              <AnalyticsCard key={label}>
                <h3 className="text-lg font-semibold text-slate-950">{label}</h3>
                <div className="mt-4">
                  <DataState
                    variant="unavailable"
                    compact
                    headingLevel="h3"
                    title={DATA_UNAVAILABLE_LABEL}
                    description="O snapshot ainda não fornece o intervalo confirmado pelo backend."
                  />
                </div>
              </AnalyticsCard>
            ))}
          </div>
        </section>

        <section className="min-w-0" aria-labelledby="realized-table-title">
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

        <DashboardCompletion
          metrics={metrics}
          selectedPeriod={selectedPeriod}
          goalsAvailable={dashboard.goalsAvailable}
        />
      </div>
    </main>
  );
}
