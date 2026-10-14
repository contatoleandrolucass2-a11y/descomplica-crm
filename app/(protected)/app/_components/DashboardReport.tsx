import Link from "next/link";

import {
  DASHBOARD_PERIODS,
  DASHBOARD_STAGES,
  DASHBOARD_VIEWS,
  type DashboardPeriodKey,
  type DashboardStageKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import type { DashboardReadModel } from "@/lib/crm/dashboard/data";
import {
  buildMonthlyFunnelSnapshots,
  buildOperationalComparisons,
  buildPeriodFunnelReadings,
  calculateConversion,
  calculateProgress,
  metricValueForPeriod,
  type FunnelReading,
  type OperationalComparison,
} from "@/lib/crm/dashboard/presentation";
import { CRM_STAGES } from "@/lib/crm/stages/catalog";

import { SalesforceRefreshButton } from "./SalesforceRefreshButton";
import { DonutChart } from "./analytics/Charts";
import {
  AnalyticsCard,
  AnalyticsCanvas,
  AnalyticsTable,
  CommercialSourceLabel,
  FilterGroup,
  FilterLink,
  RankingList,
  SectionHeading,
  type AnalyticsColumn,
} from "./analytics/DataDisplay";
import { UnavailableValue } from "./analytics/DataState";
import styles from "./DashboardReport.module.css";

export interface DashboardReportProps {
  dashboard: DashboardReadModel | null;
  selectedView: DashboardViewKey;
  selectedPeriod: DashboardPeriodKey;
  authorizedViews: readonly DashboardViewKey[];
  canViewStages: boolean;
  canRefresh: boolean;
  canViewRanking: boolean;
  team?: { brokers: number; managers: Array<{ name: string; total: number }> } | null;
  teamUnavailableReason?: string | undefined;
}

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
const stages = Object.keys(DASHBOARD_STAGES) as DashboardStageKey[];
const operationalStages = ["appointments", "visits", "folders", "sales"] as const;
const monthlyBlocks = [
  { key: "year-average", label: "Média do ano", detail: "Meses encerrados" },
  { key: "three-month-average", label: "Média dos últimos 3 meses", detail: "Meses encerrados" },
  { key: "previous", label: "Mês anterior", detail: "Até o mesmo dia do mês" },
  { key: "goal", label: "Meta atual", detail: "Meta mensal" },
  { key: "expected", label: "Meta esperada até hoje", detail: "Esperado indisponível" },
  { key: "current", label: "Mês atual", detail: "Realizado" },
] as const;

function dashboardHref(view: DashboardViewKey, period: DashboardPeriodKey) {
  return `/app?view=${encodeURIComponent(view)}&period=${encodeURIComponent(period)}`;
}

function emptyReadings(): FunnelReading[] {
  return stages.map((key) => ({
    key,
    label: DASHBOARD_STAGES[key].label,
    value: null,
    conversion: null,
  }));
}

function numberValue(value: number | null, reason = "Dados indisponíveis para este intervalo.") {
  return value === null ? <UnavailableValue reason={reason} /> : numberFormatter.format(value);
}

function ratioValue(value: number | null) {
  return value === null ? (
    <UnavailableValue reason="Sem base suficiente para calcular a relação." />
  ) : (
    percentFormatter.format(value)
  );
}

function totalConversion(readings: FunnelReading[]) {
  const opportunities = readings.find((reading) => reading.key === "opportunities")?.value ?? null;
  const sales = readings.find((reading) => reading.key === "sales")?.value ?? null;
  return opportunities === null || sales === null
    ? null
    : calculateConversion(sales, opportunities);
}

function goalAssessment(current: number | null, goal: number | null) {
  if (goal === null) return "Meta indisponível";
  if (current === null) return "Realizado indisponível";
  if (current >= goal) return "Meta atingida";
  return `Faltam ${numberFormatter.format(goal - current)} para a meta`;
}

function updatedAt(dashboard: DashboardReadModel | null) {
  if (!dashboard) return "Indisponível";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: dashboard.timezone,
    }).format(new Date(dashboard.generatedAt));
  } catch {
    return "Indisponível";
  }
}

function ConversionDetails({ readings }: { readings: FunnelReading[] }) {
  return (
    <details className={styles.conversionDetails}>
      <summary>Conversões intermediárias</summary>
      <dl className={styles.readings}>
        {readings.slice(1).map((reading, index) => (
          <div key={reading.key}>
            <dt>{`${readings[index]?.label} para ${reading.label.toLocaleLowerCase("pt-BR")}`}</dt>
            <dd>{ratioValue(reading.conversion)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const operationalColumns: Array<AnalyticsColumn<OperationalComparison>> = [
  {
    key: "interval",
    label: "Intervalo",
    render: (row) => (
      <span>
        <strong className={styles.interval}>{row.label}</strong>
        <span className={styles.comparison}>{row.comparison}</span>
      </span>
    ),
  },
  {
    key: "previous",
    label: "Anterior",
    align: "right",
    render: (row) => numberValue(row.previous),
  },
  { key: "current", label: "Realizado", align: "right", render: (row) => numberValue(row.current) },
  {
    key: "variation",
    label: "Variação",
    align: "right",
    render: (row) =>
      row.variation === null ? (
        <UnavailableValue reason="Sem base anterior suficiente para comparação." />
      ) : (
        `${row.variation > 0 ? "+" : ""}${percentFormatter.format(row.variation)}`
      ),
  },
  {
    key: "goal",
    label: "Meta",
    align: "right",
    render: (row) => numberValue(row.goal, "Meta indisponível para este intervalo."),
  },
  {
    key: "progress",
    label: "% realizado da meta",
    align: "right",
    render: (row) => ratioValue(row.goalProgress),
  },
];

const unavailableComparisons: OperationalComparison[] = [
  { key: "month", label: "Mês", comparison: "Mês anterior × mês atual" },
  {
    key: "fourteen-days",
    label: "Últimos 14 dias",
    comparison: "14 dias anteriores × 14 dias atuais",
  },
  { key: "seven-days", label: "Últimos 7 dias", comparison: "7 dias anteriores × 7 dias atuais" },
  { key: "week", label: "Semana", comparison: "Semana passada × semana atual" },
  { key: "day", label: "Dia", comparison: "Ontem × hoje" },
].map((row) => ({
  ...row,
  key: row.key as OperationalComparison["key"],
  previous: null,
  current: null,
  variation: null,
  goal: null,
  goalProgress: null,
}));

export function DashboardReport({
  dashboard,
  selectedView,
  selectedPeriod,
  authorizedViews,
  canViewStages,
  canRefresh,
  canViewRanking,
  team,
  teamUnavailableReason,
}: DashboardReportProps) {
  const metrics = dashboard?.metrics[selectedView] ?? null;
  const goalsAvailable = dashboard?.goalsAvailable === true;
  const readings = metrics ? buildPeriodFunnelReadings(metrics, selectedPeriod) : emptyReadings();
  const monthly = metrics ? buildMonthlyFunnelSnapshots(metrics, goalsAvailable) : [];
  const sales = metrics ? metricValueForPeriod(metrics.sales, selectedPeriod) : null;
  const salesGoal = goalsAvailable && sales && sales.goal > 0 ? sales.goal : null;
  const salesGap = sales && salesGoal !== null ? Math.max(0, salesGoal - sales.current) : null;
  const salesValue = dashboard?.salesValue[selectedView]?.[selectedPeriod] ?? null;
  const lowestConversion = readings.reduce<FunnelReading | null>((lowest, reading) => {
    if (reading.conversion === null) return lowest;
    return lowest?.conversion === null || lowest === null || reading.conversion < lowest.conversion
      ? reading
      : lowest;
  }, null);
  const lowestIndex = lowestConversion ? readings.indexOf(lowestConversion) : -1;
  const visibleTeam = selectedView === "all" && canViewRanking ? team : null;
  const knownManagers =
    visibleTeam?.managers.filter(
      (manager) => manager.name.trim().toLocaleLowerCase("pt-BR") !== "sem gerente informado",
    ).length ?? null;
  const ranking = canViewRanking ? (dashboard?.topDevelopments[selectedView] ?? []) : [];

  return (
    <AnalyticsCanvas kind="dashboard">
      <div className={styles.report}>
        <div className={styles.heading}>
          <div>
            <h1>Relatório completo da equipe.</h1>
            <p className={styles.context}>
              {DASHBOARD_VIEWS[selectedView].label} · {DASHBOARD_PERIODS[selectedPeriod].label}
            </p>
          </div>
          <dl className={styles.metadata}>
            <div>
              <dt>Atualizado em</dt>
              <dd>{updatedAt(dashboard)}</dd>
            </div>
            <div>
              <dt>Fonte</dt>
              <dd>
                <CommercialSourceLabel value={dashboard?.source} />
              </dd>
            </div>
          </dl>
        </div>

        <nav className={styles.tabs} aria-label="Visão geral e etapas comerciais">
          <Link
            href={dashboardHref(selectedView, selectedPeriod)}
            prefetch={false}
            aria-current="page"
          >
            Visão geral
          </Link>
          {CRM_STAGES.map((stage) =>
            canViewStages ? (
              <Link
                key={stage.key}
                href={`/app/etapas/${stage.slug}?view=${encodeURIComponent(selectedView)}&period=${encodeURIComponent(selectedPeriod)}`}
                prefetch={false}
              >
                {stage.label}
              </Link>
            ) : (
              <span key={stage.key} title="Acesso indisponível">
                {stage.label}
              </span>
            ),
          )}
        </nav>

        <section className={styles.filters} aria-label="Filtros do relatório">
          <dl className={styles.dimensions}>
            {["Canal de vendas", "Gerente de Vendas", "Responsável da conta", "Empresa"].map(
              (label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <UnavailableValue reason="Sem dados disponíveis para este filtro." />
                  </dd>
                </div>
              ),
            )}
          </dl>
          <div className={styles.filterLinks}>
            <FilterGroup label="Visão">
              {authorizedViews.map((view) => (
                <FilterLink
                  key={view}
                  href={dashboardHref(view, selectedPeriod)}
                  active={selectedView === view}
                >
                  {DASHBOARD_VIEWS[view].label}
                </FilterLink>
              ))}
            </FilterGroup>
            <FilterGroup label="Período">
              {(Object.keys(DASHBOARD_PERIODS) as DashboardPeriodKey[]).map((period) => (
                <FilterLink
                  key={period}
                  href={dashboardHref(selectedView, period)}
                  active={selectedPeriod === period}
                >
                  {DASHBOARD_PERIODS[period].label}
                </FilterLink>
              ))}
            </FilterGroup>
            {canRefresh ? (
              <div className={styles.refresh}>
                <SalesforceRefreshButton available messageClassName={styles.refreshMessage!} />
              </div>
            ) : null}
          </div>
        </section>

        {!metrics ? (
          <p className={styles.notice} role="status">
            Dados indisponíveis para esta visão.
          </p>
        ) : null}

        <section className={styles.section} aria-labelledby="report-pulse-title">
          <SectionHeading
            id="report-pulse-title"
            kicker="Pulso do funil"
            title="Conversão por etapa"
            description="Relações entre volumes agregados do período, sem acompanhar trajetórias individuais."
            density="compact"
          />
          <div className={styles.pulseGrid}>
            {readings.map((reading, index) => {
              const metric = metrics?.[reading.key];
              const rawGoal = metric ? metricValueForPeriod(metric, selectedPeriod).goal : null;
              const goal = goalsAvailable && rawGoal !== null && rawGoal > 0 ? rawGoal : null;
              const progress =
                reading.value !== null && goal !== null
                  ? calculateProgress(reading.value, goal)
                  : null;
              return (
                <AnalyticsCard className={styles.card} key={reading.key} density="compact">
                  <h3>{reading.label}</h3>
                  <div className={styles.donut}>
                    <DonutChart
                      label={
                        index === 0
                          ? "Conversão de oportunidades"
                          : `${readings[index - 1]?.label} para ${reading.label.toLocaleLowerCase("pt-BR")}`
                      }
                      value={
                        index === 0
                          ? "Entrada"
                          : reading.conversion === null
                            ? "N/D"
                            : percentFormatter.format(reading.conversion)
                      }
                      ratio={reading.conversion}
                      accent={CRM_STAGES[index]!.accent}
                    />
                  </div>
                  <p className={styles.conversionCaption}>
                    {index === 0 ? "Entrada do funil" : "Em relação à etapa anterior"}
                  </p>
                  <dl className={styles.readings}>
                    <div>
                      <dt>Quantidade</dt>
                      <dd className={styles.quantity}>{numberValue(reading.value)}</dd>
                    </div>
                    <div>
                      <dt>Meta</dt>
                      <dd>{numberValue(goal, "Meta indisponível para o período.")}</dd>
                    </div>
                    <div>
                      <dt>% realizado da meta</dt>
                      <dd>{ratioValue(progress)}</dd>
                    </div>
                  </dl>
                  <p className={styles.assessment} data-met={progress !== null && progress >= 1}>
                    {goalAssessment(reading.value, goal)}
                  </p>
                </AnalyticsCard>
              );
            })}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="report-monthly-title">
          <SectionHeading
            id="report-monthly-title"
            kicker="Comparativo mensal"
            title="Realizado e meta lado a lado"
            density="compact"
          />
          <div className={styles.monthlyGrid}>
            {monthlyBlocks.map((block) => {
              const blockReadings =
                monthly.find((snapshot) => snapshot.key === block.key)?.readings ?? emptyReadings();
              return (
                <AnalyticsCard key={block.key} className={styles.card} density="compact">
                  <h3>{block.label}</h3>
                  <p className={styles.blockDetail}>{block.detail}</p>
                  <dl className={styles.readings}>
                    {blockReadings.map((reading) => (
                      <div key={reading.key}>
                        <dt>{reading.label}</dt>
                        <dd>{numberValue(reading.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className={styles.totalConversion}>
                    <div>
                      <dt>
                        Conversão total <span>Vendas / oportunidades</span>
                      </dt>
                      <dd>{ratioValue(totalConversion(blockReadings))}</dd>
                    </div>
                  </dl>
                  <ConversionDetails readings={blockReadings} />
                </AnalyticsCard>
              );
            })}
          </div>
          <div className={styles.pace}>
            <div>
              <h3>Ritmo de vendas</h3>
              <p>Realizado frente ao esperado no mês</p>
            </div>
            <dl className={styles.paceValues}>
              <div>
                <dt>Vendas realizadas</dt>
                <dd>{numberValue(metrics?.sales.currentMonth ?? null)}</dd>
              </div>
              <div>
                <dt>Esperado até hoje</dt>
                <dd>
                  <UnavailableValue reason="Meta esperada até hoje ainda não definida." />
                </dd>
              </div>
              <div>
                <dt>Parecer de ritmo</dt>
                <dd>
                  <UnavailableValue reason="Depende do esperado até hoje." />
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="report-diagnosis-title">
          <SectionHeading
            id="report-diagnosis-title"
            kicker="Diagnóstico"
            title="Eficiência do funil"
            density="compact"
          />
          <div className={styles.diagnosisGrid}>
            <div>
              <h3>Conversão total</h3>
              <strong>{ratioValue(totalConversion(readings))}</strong>
              <p>Vendas / oportunidades no período</p>
            </div>
            <div>
              <h3>Falta para a meta de vendas</h3>
              <strong>{numberValue(salesGap, "Meta ou realizado indisponível.")}</strong>
              <p>{goalAssessment(sales?.current ?? null, salesGoal)}</p>
            </div>
            <div>
              <h3>Menor relação entre etapas</h3>
              <strong>{ratioValue(lowestConversion?.conversion ?? null)}</strong>
              <p>
                {lowestConversion
                  ? `${readings[lowestIndex - 1]?.label} para ${lowestConversion.label.toLocaleLowerCase("pt-BR")}`
                  : "Sem base suficiente para comparação"}
              </p>
            </div>
            <div>
              <h3>Plano de ação</h3>
              <strong>
                <UnavailableValue reason="Critério de ação ainda não aprovado." />
              </strong>
              <p>Aguardando critério aprovado.</p>
            </div>
            <div>
              <h3>VGV do período</h3>
              <strong>
                {salesValue === null ? <UnavailableValue /> : currencyFormatter.format(salesValue)}
              </strong>
              <p>
                {DASHBOARD_PERIODS[selectedPeriod].label} · {DASHBOARD_VIEWS[selectedView].label}
              </p>
            </div>
          </div>
          <p className={styles.footnote}>
            A menor relação considera as etapas com base disponível. Volumes agregados não indicam
            quais pessoas avançaram.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="report-operational-title">
          <SectionHeading
            id="report-operational-title"
            kicker="Detalhamento operacional"
            title="Realizado Funil"
            density="compact"
          />
          <div className={styles.operationalGrid}>
            {operationalStages.map((stage) => (
              <div className={styles.tableSection} key={stage}>
                <h3>
                  {DASHBOARD_STAGES[stage].label}{" "}
                  {stage === "appointments" ? "realizados" : "realizadas"}
                </h3>
                <AnalyticsTable
                  caption={`${DASHBOARD_STAGES[stage].label}: realizado, comparação e meta por intervalo`}
                  captionVisible={false}
                  columns={operationalColumns}
                  rows={
                    metrics
                      ? buildOperationalComparisons(metrics[stage], goalsAvailable)
                      : unavailableComparisons
                  }
                  rowKey={(row) => row.key}
                />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="report-team-title">
          <SectionHeading
            id="report-team-title"
            kicker="Estrutura comercial"
            title="Corretores por gerente"
            density="compact"
          />
          {visibleTeam ? (
            <>
              <dl className={styles.teamTotals}>
                <div>
                  <dt>Corretores</dt>
                  <dd>{numberFormatter.format(visibleTeam.brokers)}</dd>
                </div>
                <div>
                  <dt>Gerentes conhecidos</dt>
                  <dd>{numberValue(knownManagers)}</dd>
                </div>
              </dl>
              <p className={styles.footnote}>Vínculos informados no snapshot</p>
              <div className={styles.teamGrid}>
                {visibleTeam.managers.map((manager, index) => (
                  <AnalyticsCard
                    key={`${manager.name}-${index}`}
                    className={styles.card}
                    density="compact"
                  >
                    <h3>{manager.name}</h3>
                    <dl className={styles.readings}>
                      <div>
                        <dt>Corretores</dt>
                        <dd>{numberFormatter.format(manager.total)}</dd>
                      </div>
                      <div>
                        <dt>Participação na equipe</dt>
                        <dd>
                          {ratioValue(calculateConversion(manager.total, visibleTeam.brokers))}
                        </dd>
                      </div>
                    </dl>
                  </AnalyticsCard>
                ))}
              </div>
              {visibleTeam.managers.length === 0 ? (
                <p className={styles.notice}>Nenhum vínculo com gerente informado.</p>
              ) : null}
            </>
          ) : (
            <p className={styles.notice}>
              {teamUnavailableReason ?? "Distribuição indisponível para esta visão."}
            </p>
          )}
        </section>

        {canViewRanking ? (
          <details className={styles.otherIndicators}>
            <summary>Outros indicadores</summary>
            <section className={styles.ranking} aria-labelledby="report-ranking-title">
              <SectionHeading
                id="report-ranking-title"
                kicker="Ranking validado"
                title="Oportunidades por empreendimento"
                density="compact"
              />
              {ranking.length > 0 ? (
                <RankingList
                  items={ranking.map((development) => ({
                    id: `${selectedView}-${development.rank}`,
                    rank: development.rank,
                    name: development.name,
                    value: numberFormatter.format(development.total),
                  }))}
                />
              ) : (
                <p className={styles.notice}>
                  {dashboard ? "Sem empreendimentos classificados." : "Ranking indisponível."}
                </p>
              )}
            </section>
          </details>
        ) : null}
      </div>
    </AnalyticsCanvas>
  );
}
