import {
  ArrowDownUp,
  ChartNoAxesCombined,
  CircleDollarSign,
  ListChecks,
  Target,
} from "lucide-react";

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
  metricValueForPeriod,
  type FunnelReading,
  type OperationalComparison,
} from "@/lib/crm/dashboard/presentation";
import {
  emptyDashboardFilters,
  type DashboardAnalysisResult,
  type DashboardFilters as FilterValues,
} from "@/lib/crm/dashboard/analysis";
import { buildDashboardManagementGoals } from "@/lib/crm/dashboard/management-goals";

import { SalesforceRefreshButton } from "./SalesforceRefreshButton";
import { DashboardAutoRefresh } from "./DashboardAutoRefresh";
import { DashboardPulse } from "./DashboardPulse";
import { DashboardComparisons } from "./DashboardComparisons";
import { DashboardFilters } from "./DashboardFilters";
import { DashboardMonthlyHistory } from "./DashboardMonthlyHistory";
import {
  AnalyticsCard,
  AnalyticsCanvas,
  RankingList,
  SectionHeading,
} from "./analytics/DataDisplay";
import { UnavailableValue } from "./analytics/DataState";
import styles from "./DashboardReport.module.css";

export interface DashboardReportProps {
  dashboard: DashboardReadModel | null;
  selectedView: DashboardViewKey;
  selectedPeriod: DashboardPeriodKey;
  authorizedViews: readonly DashboardViewKey[];
  canViewStages: boolean;
  authorizedStagePaths?: readonly string[];
  canRefresh: boolean;
  canViewRanking: boolean;
  team?: { brokers: number; managers: Array<{ name: string; total: number }> } | null;
  teamUnavailableReason?: string | undefined;
  analysis?: DashboardAnalysisResult | null;
  filters?: FilterValues;
  today?: string;
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
  { key: "previous", label: "Mês anterior", detail: "Mês encerrado" },
  { key: "goal", label: "Meta mês", detail: "Meta mensal por corretor" },
  { key: "expected", label: "Meta esperada até hoje", detail: "Proporcional ao dia do mês" },
  { key: "current", label: "Mês atual", detail: "Realizado" },
] as const;

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

function MonthlyFunnel({ label, readings }: { label: string; readings: FunnelReading[] }) {
  // Approved folders have no monthly dashboard series; ranking totals are not interchangeable.
  const entries = readings.flatMap((reading) =>
    reading.key === "folders"
      ? [
          reading,
          { key: "approved-folders", label: "Pastas aprovadas", value: null, conversion: null },
        ]
      : [reading],
  );

  return (
    <figure className={styles.monthlyFunnel} aria-label={`Funil mensal: ${label}`}>
      <dl>
        {entries.map((entry) => (
          <div className={styles.funnelStep} key={entry.key} data-stage={entry.key}>
            <dt>{entry.label}</dt>
            <dd
              data-unavailable={entry.value === null}
              data-long={entry.value !== null && numberFormatter.format(entry.value).length > 7}
            >
              {numberValue(
                entry.value,
                entry.key === "approved-folders"
                  ? "Pastas aprovadas não possuem uma série mensal separada no dashboard."
                  : undefined,
              )}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

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
  canRefresh,
  canViewRanking,
  team,
  teamUnavailableReason,
  analysis = null,
  filters = emptyDashboardFilters(),
  today,
}: DashboardReportProps) {
  const staleMonth =
    !!today && !!dashboard && today.slice(0, 7) !== dashboard.referenceDate.slice(0, 7);
  const staleDay = !!today && !!dashboard && today !== dashboard.referenceDate;
  const sourceMetrics = dashboard?.metrics[selectedView] ?? null;
  const metrics = staleMonth ? null : sourceMetrics;
  const goalsAvailable = dashboard?.goalsAvailable === true;
  const readings = metrics ? buildPeriodFunnelReadings(metrics, selectedPeriod) : emptyReadings();
  const managementGoals = dashboard
    ? buildDashboardManagementGoals({
        referenceDate: today ?? dashboard.referenceDate,
        brokerCount: analysis?.brokerCount ?? null,
      })
    : null;
  const goals =
    managementGoals?.monthlyGoals ??
    (Object.fromEntries(stages.map((stage) => [stage, null])) as Record<
      DashboardStageKey,
      number | null
    >);
  const expected = managementGoals?.expectedByToday;
  const monthly = sourceMetrics ? buildMonthlyFunnelSnapshots(sourceMetrics, false) : [];
  const goalReadings = (
    values: Record<DashboardStageKey, number | null> | undefined,
  ): FunnelReading[] =>
    stages.map((key, index) => {
      const value = values?.[key] ?? null;
      const previous = index ? (values?.[stages[index - 1]!] ?? null) : null;
      return {
        key,
        label: DASHBOARD_STAGES[key].label,
        value,
        conversion:
          value === null || previous === null ? null : calculateConversion(value, previous),
      };
    });
  const sales = metrics ? metricValueForPeriod(metrics.sales, selectedPeriod) : null;
  const salesGoal = goals.sales;
  const salesGap =
    sales?.current != null && salesGoal !== null ? Math.max(0, salesGoal - sales.current) : null;
  const salesValue = staleMonth
    ? null
    : (dashboard?.salesValue[selectedView]?.[selectedPeriod] ?? null);
  const lowestConversion = readings.reduce<FunnelReading | null>((lowest, reading) => {
    if (reading.conversion === null) return lowest;
    return lowest?.conversion === null || lowest === null || reading.conversion < lowest.conversion
      ? reading
      : lowest;
  }, null);
  const lowestIndex = lowestConversion ? readings.indexOf(lowestConversion) : -1;
  const visibleTeam = canViewRanking
    ? (analysis?.team ?? (selectedView === "all" ? team : null))
    : null;
  const knownManagers =
    visibleTeam?.managers.filter(
      (manager) => manager.name.trim().toLocaleLowerCase("pt-BR") !== "sem gerente informado",
    ).length ?? null;
  const ranking = canViewRanking ? (dashboard?.topDevelopments[selectedView] ?? []) : [];

  return (
    <AnalyticsCanvas kind="dashboard">
      <DashboardAutoRefresh
        referenceDay={today}
        generatedAt={dashboard?.generatedAt ?? null}
        updatedAt={dashboard?.updatedAt ?? null}
      />
      <div className={styles.report} data-dashboard-source={dashboard?.source}>
        <div className={styles.heading}>
          <div>
            <h1>Relatório completo da equipe.</h1>
          </div>
          <dl className={styles.metadata}>
            <div>
              <dt>Atualizado em</dt>
              <dd>{updatedAt(dashboard)}</dd>
            </div>
          </dl>
        </div>

        <section className={styles.filters} aria-label="Filtros do relatório">
          <DashboardFilters
            values={filters}
            options={analysis?.options ?? emptyDashboardFilters()}
            available={analysis !== null}
          />
          {canRefresh ? (
            <div className={styles.refresh}>
              <SalesforceRefreshButton available messageClassName={styles.refreshMessage!} />
            </div>
          ) : null}
        </section>

        {!metrics ? (
          <p className={styles.notice} role="status">
            {staleMonth
              ? "Aguardando a coleta do mês vigente."
              : "Dados indisponíveis para esta visão."}
          </p>
        ) : null}

        <section className={styles.section} aria-labelledby="report-pulse-title">
          <SectionHeading
            id="report-pulse-title"
            kicker="Pulso do funil"
            title="Conversão por etapa"
            density="compact"
          />
          <DashboardPulse readings={readings} goals={goals} />
        </section>

        <section className={styles.section} aria-labelledby="report-monthly-title">
          <SectionHeading id="report-monthly-title" title="Comparativo mensal" density="compact" />
          <div className={styles.monthlyGrid}>
            {monthlyBlocks.map((block) => {
              const history =
                block.key === "year-average" ||
                block.key === "three-month-average" ||
                block.key === "previous";
              const blockReadings =
                block.key === "goal"
                  ? goalReadings(goals)
                  : block.key === "expected"
                    ? goalReadings(expected)
                    : block.key === "current"
                      ? metrics
                        ? buildPeriodFunnelReadings(metrics, "month")
                        : emptyReadings()
                      : analysis && !staleMonth
                        ? (monthly.find((snapshot) => snapshot.key === block.key)?.readings ??
                          emptyReadings())
                        : emptyReadings();
              return (
                <AnalyticsCard key={block.key} className={styles.card} density="compact">
                  {history ? (
                    <DashboardMonthlyHistory
                      title={block.label}
                      months={staleMonth ? [] : (analysis?.history[block.key] ?? [])}
                      missingReason={
                        staleMonth || !analysis?.history[block.key]?.length
                          ? "Aguardando a coleta detalhada dos meses encerrados."
                          : ""
                      }
                    />
                  ) : (
                    <h3>{block.label}</h3>
                  )}
                  <p className={styles.blockDetail}>
                    {block.key === "goal" && analysis?.brokerCount != null
                      ? `${numberFormatter.format(analysis.brokerCount)} corretores no grupo`
                      : block.detail}
                  </p>
                  <MonthlyFunnel label={block.label} readings={blockReadings} />
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
                  {numberValue(expected?.sales ?? null, "Quantidade de corretores indisponível.")}
                </dd>
              </div>
              <div>
                <dt>Parecer de ritmo</dt>
                <dd>
                  {staleDay || expected?.sales == null || metrics?.sales.currentMonth == null ? (
                    <UnavailableValue reason="Depende do esperado e realizado até hoje." />
                  ) : metrics.sales.currentMonth >= expected.sales ? (
                    "Dentro do esperado"
                  ) : (
                    "Abaixo do esperado"
                  )}
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
              <h3>
                <ChartNoAxesCombined size={18} aria-hidden="true" />
                Conversão total
              </h3>
              <strong>{ratioValue(totalConversion(readings))}</strong>
              <p>Vendas / oportunidades no período</p>
            </div>
            <div>
              <h3>
                <CircleDollarSign size={18} aria-hidden="true" />
                VGV do período
              </h3>
              <strong>
                {salesValue === null ? <UnavailableValue /> : currencyFormatter.format(salesValue)}
              </strong>
              <p>
                {DASHBOARD_PERIODS[selectedPeriod].label} · {DASHBOARD_VIEWS[selectedView].label}
              </p>
            </div>
            <div>
              <h3>
                <ArrowDownUp size={18} aria-hidden="true" />
                Menor relação entre etapas
              </h3>
              <strong>{ratioValue(lowestConversion?.conversion ?? null)}</strong>
              <p>
                {lowestConversion
                  ? `${readings[lowestIndex - 1]?.label} para ${lowestConversion.label.toLocaleLowerCase("pt-BR")}`
                  : "Sem base suficiente para comparação"}
              </p>
            </div>
            <div data-secondary="true">
              <h3>
                <Target size={18} aria-hidden="true" />
                Falta para a meta de vendas
              </h3>
              <strong>{numberValue(salesGap, "Meta ou realizado indisponível.")}</strong>
              <p>{goalAssessment(sales?.current ?? null, salesGoal)}</p>
            </div>
            <div data-secondary="true">
              <h3>
                <ListChecks size={18} aria-hidden="true" />
                Plano de ação
              </h3>
              <strong>
                <UnavailableValue reason="Critério de ação ainda não aprovado." />
              </strong>
              <p>Aguardando critério aprovado.</p>
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
                <DashboardComparisons
                  label={DASHBOARD_STAGES[stage].label}
                  rows={
                    metrics
                      ? buildOperationalComparisons(metrics[stage], goalsAvailable)
                      : unavailableComparisons
                  }
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
