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
  dashboardCurrentMonthPeriod,
  emptyDashboardFilters,
  type DashboardStageDetailRow,
  type DashboardAnalysisResult,
  type DashboardFilters as FilterValues,
} from "@/lib/crm/dashboard/analysis";
import {
  buildDashboardManagementGoals,
  DASHBOARD_PARTNERSHIP_MANAGER_COUNT,
  type DashboardPartnershipGoalValues,
} from "@/lib/crm/dashboard/management-goals";
import { DASHBOARD_CHANNELS } from "@/lib/crm/dashboard/analysis-contract";
import { ConfigurableDashboardCanvas } from "@/lib/dashboard-canvas/ui/configurable/configurable-dashboard-canvas";
import type { DashboardContentByMetricAndType } from "@/lib/dashboard-canvas/ui/configurable/types";

import { SalesforceRefreshButton } from "./SalesforceRefreshButton";
import { DashboardAutoRefresh } from "./DashboardAutoRefresh";
import { DashboardFilters } from "./DashboardFilters";
import { DashboardMonthlyHistory } from "./DashboardMonthlyHistory";
import {
  DashboardStageDetailsProvider,
  DashboardStageDetailTrigger,
  type DashboardStageDetailPeriod,
} from "./DashboardStageDetails";
import { AnalyticsCanvas } from "./analytics/DataDisplay";
import { UnavailableValue } from "./analytics/DataState";
import {
  OVERVIEW_CANVAS_CATALOG,
  OVERVIEW_CANVAS_COMPATIBILITY,
  OVERVIEW_CANVAS_DEFAULT_CARDS,
  OVERVIEW_CANVAS_GROUPS,
  OVERVIEW_CANVAS_PAGE_KEY,
} from "./dashboard-canvas-config";
import styles from "./DashboardReport.module.css";

export interface DashboardReportProps {
  dashboard: DashboardReadModel | null;
  selectedView: DashboardViewKey;
  selectedPeriod: DashboardPeriodKey;
  authorizedViews: readonly DashboardViewKey[];
  canViewStages: boolean;
  authorizedStagePaths?: readonly string[];
  stageDetails?: readonly DashboardStageDetailRow[];
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

function MonthlyFunnel({
  label,
  readings,
  detailPeriod,
  authorizedStages,
  detailAvailableStages,
}: {
  label: string;
  readings: DashboardFunnelReading[];
  detailPeriod: DashboardStageDetailPeriod;
  authorizedStages: ReadonlySet<DashboardFunnelKey>;
  detailAvailableStages: ReadonlySet<DashboardFunnelKey>;
}) {
  return (
    <figure
      className={styles.monthlyFunnel}
      aria-label={`Funil mensal: ${label}`}
      data-stage-count={readings.length}
    >
      <dl>
        {readings.map((entry) => (
          <div className={styles.funnelStep} key={entry.key} data-stage={entry.key}>
            <dt>
              {entry.label}
              {authorizedStages.has(entry.key) && detailAvailableStages.has(entry.key) ? (
                <DashboardStageDetailTrigger
                  stage={entry.key}
                  stageLabel={entry.label}
                  cardLabel={label}
                  period={detailPeriod}
                />
              ) : null}
            </dt>
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
  detailPeriod,
  authorizedStages,
  detailAvailableStages,
  groupKey,
}: {
  label: string;
  context: string;
  detail: string;
  readings: DashboardFunnelReading[];
  history?: DashboardAnalysisResult["history"]["year-average"] | undefined;
  detailPeriod: DashboardStageDetailPeriod;
  authorizedStages: ReadonlySet<DashboardFunnelKey>;
  detailAvailableStages: ReadonlySet<DashboardFunnelKey>;
  groupKey: (typeof OVERVIEW_CANVAS_GROUPS)[number]["key"];
}) {
  const firstStageLabel = readings[0]?.label.toLocaleLowerCase("pt-BR") ?? "etapa inicial";
  return (
    <div
      className={styles.card}
      data-density="compact"
      data-dashboard-group={groupKey}
      aria-describedby={`overview-canvas-group-${groupKey}`}
    >
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
        <h3 className={styles.cardTitle} aria-hidden="true">
          {label}
        </h3>
      )}
      <p className={styles.blockDetail}>{detail}</p>
      <MonthlyFunnel
        label={label === "Mês" ? `${label} (${context})` : label}
        readings={readings}
        detailPeriod={detailPeriod}
        authorizedStages={authorizedStages}
        detailAvailableStages={detailAvailableStages}
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
    </div>
  );
}

export function DashboardReport({
  dashboard,
  selectedView,
  canViewStages,
  canRefresh,
  authorizedViews,
  analysis = null,
  goalBrokerCount = null,
  partnershipGoals = null,
  filters = emptyDashboardFilters(),
  today,
  authorizedStagePaths = [],
  stageDetails = [],
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
  const stagePath: Record<DashboardFunnelKey, string> = {
    opportunities: "/app/etapas/oportunidades",
    appointments: "/app/etapas/agendamentos",
    visits: "/app/etapas/visitas",
    folders: "/app/etapas/pastas",
    "approved-folders": "/app/etapas/pastas",
    sales: "/app/etapas/vendas",
  };
  const authorizedStages = new Set(
    canViewStages
      ? activeFunnelStages
          .map(({ key }) => key)
          .filter((key) => authorizedStagePaths.includes(stagePath[key]))
      : [],
  );
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
  const availableStagesFromReadings = (readings: readonly DashboardFunnelReading[]) =>
    new Set(readings.filter(({ value }) => value !== null).map(({ key }) => key));
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
  const referenceDate = today ?? dashboard?.referenceDate ?? "";
  const detailReferenceDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? referenceDate
    : "9999-12-31";
  const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
  const periodDetail = (key: (typeof periodBlocks)[number]["key"]): DashboardStageDetailPeriod => {
    const { start, end } = dashboardCurrentMonthPeriod(detailReferenceDate, key);
    return {
      label: "Registros realizados no período",
      start,
      end,
      ...(end < start ? { note: "Este período não possui dias dentro do mês vigente." } : {}),
    };
  };
  const historyMonths = (key: "year-average" | "three-month-average" | "previous") =>
    (analysis?.history[key] ?? []).map(({ month }) => month);
  const goalDetail: DashboardStageDetailPeriod = {
    label: "Realizado no mês vigente para comparação",
    start: monthStart(detailReferenceDate),
    end: detailReferenceDate,
    note: "O valor do funil é uma meta calculada. A tabela apresenta o realizado no mês como referência.",
  };
  const monthDetailAvailability = availableStagesFromReadings(periodReadings("month"));
  const goalContent = goalBlocks.map((block, index) => {
    const metric = OVERVIEW_CANVAS_GROUPS[0].metricKeys[index]!;
    return [
      metric,
      {
        funnel: (
          <FunnelCard
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
            detailPeriod={block.key === "current" ? periodDetail("month") : goalDetail}
            authorizedStages={authorizedStages}
            detailAvailableStages={monthDetailAvailability}
            groupKey="goals"
          />
        ),
      },
    ] as const;
  });
  const periodContent = periodBlocks.map((block, index) => {
    const metric = OVERVIEW_CANVAS_GROUPS[1].metricKeys[index]!;
    const readings = periodReadings(block.key);
    return [
      metric,
      {
        funnel: (
          <FunnelCard
            label={block.label}
            context="Períodos do mês"
            detail="Realizado no mês vigente"
            readings={readings}
            detailPeriod={periodDetail(block.key)}
            authorizedStages={authorizedStages}
            detailAvailableStages={availableStagesFromReadings(readings)}
            groupKey="periods"
          />
        ),
      },
    ] as const;
  });
  const historyContent = historyBlocks.map((block, index) => {
    const metric = OVERVIEW_CANVAS_GROUPS[2].metricKeys[index]!;
    const readings =
      block.key === "current"
        ? periodReadings("month")
        : block.key === "sale-average"
          ? saleAverageReadings
          : historicalReadings(block.key);
    const months =
      block.key === "current"
        ? []
        : historyMonths(block.key === "sale-average" ? "year-average" : block.key);
    const detailAvailableStages =
      block.key === "current" || months.length > 0
        ? availableStagesFromReadings(readings)
        : new Set<DashboardFunnelKey>();
    return [
      metric,
      {
        funnel: (
          <FunnelCard
            label={block.label}
            context="Histórico"
            detail={block.detail}
            readings={readings}
            history={
              block.key === "year-average" ||
              block.key === "three-month-average" ||
              block.key === "previous"
                ? staleMonth
                  ? []
                  : (analysis?.history[block.key] ?? [])
                : undefined
            }
            detailPeriod={
              block.key === "current"
                ? periodDetail("month")
                : block.key === "sale-average"
                  ? {
                      label: "Registros dos meses encerrados usados na média anual",
                      months: historyMonths("year-average"),
                      note: "O valor do funil é uma razão média por venda; as linhas exibem o realizado que compõe a base anual.",
                    }
                  : {
                      label: "Registros dos meses considerados no cálculo",
                      months: historyMonths(block.key),
                      ...(block.key === "previous"
                        ? {}
                        : {
                            note: "O valor do funil é uma média; a tabela apresenta os registros dos meses usados no cálculo.",
                          }),
                    }
            }
            authorizedStages={authorizedStages}
            detailAvailableStages={detailAvailableStages}
            groupKey="history"
          />
        ),
      },
    ] as const;
  });
  const contentByMetricAndType = Object.fromEntries([
    ...goalContent,
    ...periodContent,
    ...historyContent,
  ]) as DashboardContentByMetricAndType;
  const exportFilters = Object.entries(filters)
    .flatMap(([key, values]) => values.map((value) => `${key}: ${value}`))
    .join("; ");
  const scopeKey =
    activeChannel === DASHBOARD_CHANNELS[0] ? "channel.partnerships" : "channel.house";

  return (
    <DashboardStageDetailsProvider rows={stageDetails} initialFilters={filters}>
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
            <div className={styles.canvasGroups} aria-label="Grupos dos funis comerciais">
              {OVERVIEW_CANVAS_GROUPS.map((group) => (
                <div key={group.key}>
                  <h2 id={`overview-canvas-group-${group.key}`}>{group.label}</h2>
                  <span>{group.metricKeys.length} cards</span>
                </div>
              ))}
            </div>
            <ConfigurableDashboardCanvas
              className={styles.configurableCanvas!}
              initialCards={OVERVIEW_CANVAS_DEFAULT_CARDS}
              catalog={OVERVIEW_CANVAS_CATALOG}
              compatibility={OVERVIEW_CANVAS_COMPATIBILITY}
              contentByMetricAndType={contentByMetricAndType}
              pageKey={OVERVIEW_CANVAS_PAGE_KEY}
              scopeKey={scopeKey}
              ariaLabel="Funis comerciais configuráveis"
              exportContext={{
                title: "Dashboard | Resumo Geral",
                context: activeChannel === DASHBOARD_CHANNELS[0] ? "Imob" : "House",
                ...(exportFilters ? { filters: exportFilters } : {}),
                ...(dashboard?.source ? { source: dashboard.source } : {}),
                ...(dashboard?.generatedAt ? { generatedAt: dashboard.generatedAt } : {}),
              }}
            />
          </section>
        </div>
      </AnalyticsCanvas>
    </DashboardStageDetailsProvider>
  );
}
