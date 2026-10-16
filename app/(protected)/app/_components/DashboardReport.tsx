import {
  DASHBOARD_STAGES,
  type DashboardPeriodKey,
  type DashboardStageKey,
  type DashboardViewKey,
} from "@/lib/crm/dashboard/catalog";
import type { DashboardReadModel } from "@/lib/crm/dashboard/data";
import {
  buildMonthlyFunnelSnapshots,
  buildPeriodFunnelReadings,
  calculateConversion,
  type FunnelReading,
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
import { DashboardFilters } from "./DashboardFilters";
import { DashboardMonthlyHistory } from "./DashboardMonthlyHistory";
import { AnalyticsCard, AnalyticsCanvas, SectionHeading } from "./analytics/DataDisplay";
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
const stages = Object.keys(DASHBOARD_STAGES) as DashboardStageKey[];
const goalBlocks = [
  { key: "goal", label: "Meta mês", detail: "Meta mensal por corretor" },
  { key: "expected", label: "Meta esperada até hoje", detail: "Proporcional ao dia do mês" },
  { key: "current", label: "Mês atual", detail: "Realizado" },
] as const;
const periodBlocks = [
  { key: "month", label: "Mês" },
  { key: "previous-week", label: "Semana anterior" },
  { key: "current-week", label: "Esta semana" },
  { key: "yesterday", label: "Ontem" },
  { key: "today", label: "Hoje" },
] as const;
const historyBlocks = [
  { key: "year-average", label: "Média do ano", detail: "Meses encerrados" },
  { key: "three-month-average", label: "Média dos últimos 3 meses", detail: "Meses encerrados" },
  { key: "previous", label: "Mês anterior", detail: "Mês encerrado" },
  { key: "current", label: "Mês", detail: "Realizado no mês atual" },
  { key: "sale-average", label: "Média venda", detail: "Média anual por venda" },
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

function FunnelCard({
  label,
  context,
  detail,
  readings,
  history,
}: {
  label: string;
  context: string;
  detail: string;
  readings: FunnelReading[];
  history?: DashboardAnalysisResult["history"]["year-average"] | undefined;
}) {
  return (
    <AnalyticsCard className={styles.card} density="compact">
      {history ? (
        <DashboardMonthlyHistory
          title={label}
          months={history}
          missingReason={
            history.length ? "" : "Aguardando a coleta detalhada dos meses encerrados."
          }
        />
      ) : (
        <h3>{label}</h3>
      )}
      <p className={styles.blockDetail}>{detail}</p>
      <MonthlyFunnel
        label={label === "Mês" ? `${label} (${context})` : label}
        readings={readings}
      />
      <dl className={styles.totalConversion}>
        <div>
          <dt>
            Conversão total <span>Vendas / oportunidades</span>
          </dt>
          <dd>{ratioValue(totalConversion(readings))}</dd>
        </div>
      </dl>
      <ConversionDetails readings={readings} />
    </AnalyticsCard>
  );
}

export function DashboardReport({
  dashboard,
  selectedView,
  selectedPeriod,
  canRefresh,
  analysis = null,
  filters = emptyDashboardFilters(),
  today,
}: DashboardReportProps) {
  const staleMonth =
    !!today && !!dashboard && today.slice(0, 7) !== dashboard.referenceDate.slice(0, 7);
  const staleDay = !!today && !!dashboard && today !== dashboard.referenceDate;
  const sourceMetrics = dashboard?.metrics[selectedView] ?? null;
  const metrics = staleMonth ? null : sourceMetrics;
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
  const periodReadings = (key: (typeof periodBlocks)[number]["key"]) =>
    staleMonth ? emptyReadings() : (analysis?.periodReadings[key] ?? emptyReadings());
  const historicalReadings = (key: string) =>
    analysis && !staleMonth
      ? (monthly.find((snapshot) => snapshot.key === key)?.readings ?? emptyReadings())
      : emptyReadings();
  const annualReadings = historicalReadings("year-average");
  const annualSales = annualReadings.find((reading) => reading.key === "sales")?.value ?? null;
  const saleAverageReadings = annualReadings.map((reading) => {
    const ratio =
      annualSales !== null &&
      annualSales > 0 &&
      Number.isFinite(annualSales) &&
      reading.value !== null
        ? reading.value / annualSales
        : null;
    const value = ratio !== null && Number.isFinite(ratio) ? ratio : null;
    return { ...reading, value, conversion: value === null ? null : reading.conversion };
  });

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
          <SectionHeading id="report-monthly-title" title="Funis comerciais" density="compact" />
          <section className={styles.funnelGroup} aria-labelledby="report-goals-title">
            <SectionHeading id="report-goals-title" title="Metas" density="compact" />
            <div className={styles.monthlyGrid}>
              {goalBlocks.map((block) => (
                <FunnelCard
                  key={block.key}
                  label={block.label}
                  context="Metas"
                  detail={
                    block.key === "goal" && analysis?.brokerCount != null
                      ? `${numberFormatter.format(analysis.brokerCount)} corretores no grupo`
                      : block.detail
                  }
                  readings={
                    block.key === "goal"
                      ? goalReadings(goals)
                      : block.key === "expected"
                        ? goalReadings(expected)
                        : periodReadings("month")
                  }
                />
              ))}
            </div>
          </section>
          <section className={styles.funnelGroup} aria-labelledby="report-periods-title">
            <SectionHeading id="report-periods-title" title="Períodos do mês" density="compact" />
            <div className={styles.fiveColumnGrid}>
              {periodBlocks.map((block) => (
                <FunnelCard
                  key={block.key}
                  label={block.label}
                  context="Períodos do mês"
                  detail="Realizado no mês vigente"
                  readings={periodReadings(block.key)}
                />
              ))}
            </div>
          </section>
          <section className={styles.funnelGroup} aria-labelledby="report-history-title">
            <SectionHeading
              id="report-history-title"
              title="Histórico e média por venda"
              density="compact"
            />
            <div className={styles.fiveColumnGrid}>
              {historyBlocks.map((block) => (
                <FunnelCard
                  key={block.key}
                  label={block.label}
                  context="Histórico"
                  detail={block.detail}
                  readings={
                    block.key === "current"
                      ? periodReadings("month")
                      : block.key === "sale-average"
                        ? saleAverageReadings
                        : historicalReadings(block.key)
                  }
                  history={
                    block.key === "year-average" ||
                    block.key === "three-month-average" ||
                    block.key === "previous"
                      ? staleMonth
                        ? []
                        : (analysis?.history[block.key] ?? [])
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
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
      </div>
    </AnalyticsCanvas>
  );
}
