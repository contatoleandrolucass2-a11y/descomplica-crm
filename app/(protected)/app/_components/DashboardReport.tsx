import { type DashboardPeriodKey, type DashboardViewKey } from "@/lib/crm/dashboard/catalog";
import type { DashboardReadModel } from "@/lib/crm/dashboard/data";
import {
  buildMonthlyFunnelSnapshots,
  calculateConversion,
  DASHBOARD_FUNNEL_STAGES,
  type DashboardFunnelKey,
  type DashboardFunnelReading,
} from "@/lib/crm/dashboard/presentation";
import {
  emptyDashboardFilters,
  type DashboardAnalysisResult,
  type DashboardFilters as FilterValues,
} from "@/lib/crm/dashboard/analysis";
import {
  buildDashboardManagementGoals,
  DASHBOARD_PARTNERSHIP_MANAGER_COUNT,
  type DashboardPartnershipGoalValues,
} from "@/lib/crm/dashboard/management-goals";
import { DASHBOARD_CHANNELS } from "@/lib/crm/dashboard/analysis-contract";

import { SalesforceRefreshButton } from "./SalesforceRefreshButton";
import { DashboardAutoRefresh } from "./DashboardAutoRefresh";
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
  goalBrokerCount?: number | null;
  partnershipGoals?: DashboardPartnershipGoalValues | null;
  filters?: FilterValues;
  today?: string;
}

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});
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

function numberValue(value: number | null, reason = "Dados indisponíveis para este intervalo.") {
  return value === null ? (
    <UnavailableValue reason={reason} />
  ) : (
    numberFormatter.format(Math.floor(value))
  );
}

function ratioValue(value: number | null) {
  return value === null ? (
    <UnavailableValue reason="Sem base suficiente para calcular a relação." />
  ) : (
    percentFormatter.format(value)
  );
}

function totalConversion(readings: DashboardFunnelReading[]) {
  const firstStage = readings[0]?.value ?? null;
  const sales = readings.find((reading) => reading.key === "sales")?.value ?? null;
  return firstStage === null || sales === null ? null : calculateConversion(sales, firstStage);
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

function ConversionDetails({ readings }: { readings: DashboardFunnelReading[] }) {
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

function MonthlyFunnel({ label, readings }: { label: string; readings: DashboardFunnelReading[] }) {
  return (
    <figure
      className={styles.monthlyFunnel}
      aria-label={`Funil mensal: ${label}`}
      data-stage-count={readings.length}
    >
      <dl>
        {readings.map((entry) => (
          <div className={styles.funnelStep} key={entry.key} data-stage={entry.key}>
            <dt>{entry.label}</dt>
            <dd
              data-unavailable={entry.value === null}
              data-long={
                entry.value !== null && numberFormatter.format(Math.floor(entry.value)).length > 7
              }
            >
              {numberValue(entry.value)}
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
  readings: DashboardFunnelReading[];
  history?: DashboardAnalysisResult["history"]["year-average"] | undefined;
}) {
  const firstStageLabel = readings[0]?.label.toLocaleLowerCase("pt-BR") ?? "etapa inicial";
  return (
    <AnalyticsCard className={styles.card} density="compact">
      {history ? (
        <DashboardMonthlyHistory
          title={label}
          months={history}
          stageKeys={readings.map((reading) => reading.key)}
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
            Conversão total <span>Vendas / {firstStageLabel}</span>
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
  canRefresh,
  authorizedViews,
  analysis = null,
  goalBrokerCount = null,
  partnershipGoals = null,
  filters = emptyDashboardFilters(),
  today,
}: DashboardReportProps) {
  const staleMonth =
    !!today && !!dashboard && today.slice(0, 7) !== dashboard.referenceDate.slice(0, 7);
  const sourceMetrics = dashboard?.metrics[selectedView] ?? null;
  const metrics = staleMonth ? null : sourceMetrics;
  const activeChannel =
    DASHBOARD_CHANNELS.find((channel) => filters.channel[0] === channel) ?? DASHBOARD_CHANNELS[1];
  const activeFunnelStages =
    activeChannel === DASHBOARD_CHANNELS[0]
      ? DASHBOARD_FUNNEL_STAGES.filter(({ key }) =>
          ["visits", "folders", "approved-folders", "sales"].includes(key),
        )
      : DASHBOARD_FUNNEL_STAGES;
  const emptyReadings = (): DashboardFunnelReading[] =>
    activeFunnelStages.map(({ key, label }) => ({
      key,
      label,
      value: null,
      conversion: null,
    }));
  const managementGoals = dashboard
    ? buildDashboardManagementGoals({
        referenceDate: today ?? dashboard.referenceDate,
        brokerCount: goalBrokerCount,
        channel: activeChannel,
        partnershipGoals,
      })
    : null;
  const goals =
    managementGoals?.monthlyGoals ??
    (Object.fromEntries(DASHBOARD_FUNNEL_STAGES.map(({ key }) => [key, null])) as Record<
      DashboardFunnelKey,
      number | null
    >);
  const expected = managementGoals?.expectedByToday;
  const monthly = sourceMetrics ? buildMonthlyFunnelSnapshots(sourceMetrics, false) : [];
  const readingsFromValues = (
    values: Partial<Record<DashboardFunnelKey, number | null>> | undefined,
  ): DashboardFunnelReading[] =>
    activeFunnelStages.map(({ key, label }, index) => {
      const value = values?.[key] ?? null;
      const previousKey = activeFunnelStages[index - 1]?.key;
      const previous = previousKey ? (values?.[previousKey] ?? null) : null;
      return {
        key,
        label,
        value,
        conversion:
          value === null || previous === null ? null : calculateConversion(value, previous),
      };
    });
  const periodReadings = (key: (typeof periodBlocks)[number]["key"]) =>
    staleMonth
      ? emptyReadings()
      : readingsFromValues(
          Object.fromEntries(
            (analysis?.periodReadings[key] ?? []).map((reading) => [reading.key, reading.value]),
          ),
        );
  const historicalReadings = (key: keyof DashboardAnalysisResult["history"]) => {
    if (!analysis || staleMonth) return emptyReadings();
    const months = analysis.history[key];
    const legacy = monthly.find((snapshot) => snapshot.key === key)?.readings ?? [];
    const approved = months
      .map(
        (month) =>
          month.readings.find((reading) => reading.key === "approved-folders")?.value ?? null,
      )
      .filter((value): value is number => value !== null);
    const values = Object.fromEntries([
      ...legacy.map((reading) => [reading.key, reading.value] as const),
      [
        "approved-folders",
        approved.length === months.length && months.length
          ? approved.reduce((sum, value) => sum + value, 0) / approved.length
          : null,
      ] as const,
    ]) as Record<DashboardFunnelKey, number | null>;
    return readingsFromValues(values);
  };
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
            <h1>Dashboard | Resumo Geral</h1>
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
            authorizedViews={authorizedViews}
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

        <section className={styles.section} aria-labelledby="report-monthly-title">
          <h2 id="report-monthly-title" className={styles.srOnly}>
            Funis comerciais
          </h2>
          <section className={styles.funnelGroup} aria-labelledby="report-goals-title">
            <SectionHeading id="report-goals-title" title="Metas" density="compact" />
            <div className={styles.monthlyGrid}>
              {goalBlocks.map((block) => (
                <FunnelCard
                  key={block.key}
                  label={block.label}
                  context="Metas"
                  detail={
                    block.key === "goal"
                      ? activeChannel === DASHBOARD_CHANNELS[0]
                        ? partnershipGoals
                          ? `${DASHBOARD_PARTNERSHIP_MANAGER_COUNT} gerentes de vendas no grupo`
                          : "Meta Imob indisponível para o mês"
                        : goalBrokerCount != null
                          ? `${numberFormatter.format(goalBrokerCount)} corretores no grupo`
                          : block.detail
                      : block.detail
                  }
                  readings={
                    block.key === "goal"
                      ? readingsFromValues(goals)
                      : block.key === "expected"
                        ? readingsFromValues(expected)
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
        </section>
      </div>
    </AnalyticsCanvas>
  );
}
