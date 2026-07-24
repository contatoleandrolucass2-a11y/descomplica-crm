"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMonthToDateLabels,
  PeriodComparisonTable,
  type PeriodComparisonRow,
} from "./PeriodComparisonTable";
import { StageNavigation } from "./StageNavigation";
import { SiteMenu } from "./SiteMenu";
import { ACTION_PLANS, STAGES } from "./stage-config";
import { DashboardFilters, useDashboardFilters } from "./DashboardFilters";
import {
  buildFilteredRealizedFunnel,
  buildFilteredView,
} from "./dashboard-filtering";
import type {
  DashboardPayload,
  MetricSnapshot,
  PeriodKey,
  RealizedFunnelMetric,
} from "./types";

type Props = {
  dashboard: DashboardPayload | null;
  dataStatus: "live" | "demo" | "waiting";
  signedInEmail: string;
  signedInName: string;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "month", label: "Mês" },
  { key: "week", label: "Semana" },
  { key: "today", label: "Hoje" },
];

const REALIZED_STAGES = [
  { key: "agendamentos", label: "Agendamentos realizados" },
  { key: "visitas", label: "Visitas realizadas" },
  { key: "pastas", label: "Pastas realizadas" },
  { key: "vendas", label: "Vendas realizadas" },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function salesGapText(value: number, surpassed = false) {
  if (surpassed) {
    return value === 1
      ? "Meta superada em 1 venda"
      : `Meta superada em ${formatNumber(value)} vendas`;
  }
  return value === 1
    ? "Falta 1 venda"
    : `Faltam ${formatNumber(value)} vendas`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function progress(metric: MetricSnapshot, period: PeriodKey) {
  const goal = metric.goal[period];
  return goal > 0 ? metric.current[period] / goal : 0;
}

function stageAssessment(value: number, goal: number, goalRate: number) {
  if (goal <= 0) {
    return value > 0
      ? {
          tone: "neutral",
          title: "Sem meta definida",
          text: `${formatNumber(value)} registros no período para acompanhar.`,
        }
      : {
          tone: "neutral",
          title: "Sem movimento",
          text: "Nenhum registro e nenhuma meta definida no período.",
        };
  }

  const gap = Math.max(goal - value, 0);
  const surplus = Math.max(value - goal, 0);

  if (goalRate >= 1) {
    return {
      tone: "strong",
      title: "Meta atingida",
      text:
        surplus > 0
          ? `Superou a meta em ${formatNumber(surplus)}.`
          : "Volume planejado alcançado.",
    };
  }
  if (goalRate >= 0.8) {
    return {
      tone: "healthy",
      title: "Próximo da meta",
      text: `Faltam ${formatNumber(gap)} para atingir o objetivo.`,
    };
  }
  if (goalRate >= 0.5) {
    return {
      tone: "attention",
      title: "Ritmo em atenção",
      text: `Gap atual de ${formatNumber(gap)} no período.`,
    };
  }
  return {
    tone: "critical",
    title: "Gap relevante",
    text: `Faltam ${formatNumber(gap)} para a meta do período.`,
  };
}

function RealizedMetricTable({
  label,
  metric,
  referenceDate,
}: {
  label: string;
  metric: RealizedFunnelMetric;
  referenceDate?: string;
}) {
  const monthLabels = getMonthToDateLabels(referenceDate);
  const rows: PeriodComparisonRow[] = [
    {
      label: "Mês",
      previousLabel: monthLabels.previous,
      previous: metric.mesAnterior,
      currentLabel: monthLabels.current,
      current: metric.mesAtual,
      goal: metric.metas.mes,
    },
    {
      label: "14 dias",
      previousLabel: "14 dias anteriores",
      previous: metric.ultimos14DiasAnteriores ?? null,
      currentLabel: "Últimos 14 dias",
      current: metric.ultimos14Dias,
    },
    {
      label: "7 dias",
      previousLabel: "7 dias anteriores",
      previous:
        metric.ultimos7DiasAnteriores ??
        Math.max(metric.ultimos14Dias - metric.ultimos7Dias, 0),
      currentLabel: "Últimos 7 dias",
      current: metric.ultimos7Dias,
    },
    {
      label: "Semana",
      previousLabel: "Semana passada",
      previous: metric.semanaPassada ?? null,
      currentLabel: "Esta semana",
      current: metric.estaSemana,
      goal: metric.metas.semana,
    },
    {
      label: "Dia",
      previousLabel: "Ontem",
      previous: metric.ontem,
      currentLabel: "Hoje",
      current: metric.hoje,
      goal: metric.metas.dia,
    },
  ];

  return (
    <article className="realized-card">
      <h3>{label}</h3>
      <PeriodComparisonTable rows={rows} label={label} />
    </article>
  );
}

function StageDonut({
  label,
  value,
  conversion,
  goal,
  goalRate,
  color,
  index,
  href,
}: {
  label: string;
  value: number;
  conversion: number | null;
  goal: number;
  goalRate: number;
  color: string;
  index: number;
  href: string;
}) {
  const ringRate = conversion === null ? (value > 0 ? 1 : 0) : conversion;
  const safeRingRate = Math.min(Math.max(ringRate, 0), 1);
  const conversionLabel =
    conversion === null
      ? value > 0
        ? "Base do funil"
        : "Sem base"
      : `${formatNumber(conversion * 100)}% conversão`;
  const assessment = stageAssessment(value, goal, goalRate);

  return (
    <article
      className="metric-card donut-card"
      style={{
        "--stage-color": color,
        "--donut-progress": `${safeRingRate * 360}deg`,
      } as React.CSSProperties}
    >
      <div className="metric-card-head">
        <span className="stage-number">{String(index + 1).padStart(2, "0")}</span>
        <span>{label}</span>
      </div>
      <div
        className="stage-donut"
        role="img"
        aria-label={`${label}: ${formatNumber(value)}. ${conversionLabel}.`}
      >
        <div>
          <strong>{formatNumber(value)}</strong>
          <span>{conversionLabel}</span>
        </div>
      </div>
      <div className="donut-meta">
        <span>
          Meta <strong>{formatNumber(goal)}</strong>
        </span>
        <span>
          Realizado <strong>{goal > 0 ? `${formatNumber(goalRate * 100)}%` : "—"}</strong>
        </span>
      </div>
      <div className={`stage-assessment ${assessment.tone}`}>
        <span>Parecer</span>
        <strong>{assessment.title}</strong>
        <small>{assessment.text}</small>
      </div>
      <a className="stage-detail-link" href={href}>
        Abrir análise <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}

type MonthlyFunnelStage = (typeof STAGES)[number] & {
  value: number | null;
  width: number;
  rate: number | null;
};

type ThemeMode = "light" | "balanced" | "dark";

const FUNNEL_STAGE_COLORS = [
  "#ff315f",
  "#ff9f24",
  "#f0dc20",
  "#25c9dc",
  "#12c878",
] as const;

const FUNNEL_STAGE_WIDTHS = [100, 84, 70, 57, 44] as const;

function buildMonthlyFunnel(
  valueFor: (stage: (typeof STAGES)[number]) => number | null,
): MonthlyFunnelStage[] {
  const values = STAGES.map((stage) => valueFor(stage));

  return STAGES.map((stage, index) => {
    const value = values[index];
    const previousValue = index > 0 ? values[index - 1] : null;

    return {
      ...stage,
      value,
      width: FUNNEL_STAGE_WIDTHS[index],
      rate:
        index === 0 || value === null || previousValue === null || previousValue <= 0
          ? null
          : value / previousValue,
    };
  });
}

function MonthlyFunnel({
  label,
  periodLabel,
  stages,
  tone,
}: {
  label: string;
  periodLabel: string;
  stages: MonthlyFunnelStage[];
  tone: "year" | "historical" | "previous" | "goal" | "pace" | "current";
}) {
  const [showConversions, setShowConversions] = useState(false);
  const sales = stages[stages.length - 1]?.value ?? null;
  const stageY = [42, 109, 176, 243, 310];
  const stageHalfWidths = stages.map((item) => (104 * item.width) / 100);
  const markerLeft = `funnel-arrow-left-${tone}`;
  const markerRight = `funnel-arrow-right-${tone}`;
  const conversionMapId = `conversion-map-${tone}`;

  const conversionLabel = (from: number | null, to: number | null, self = false) => {
    if (from === null || to === null) return "—";
    if (self) return "100%";
    if (from <= 0) return "—";
    return `${formatNumber((to / from) * 100)}%`;
  };

  const valueFlow = (from: number | null, to: number | null) =>
    `${from === null ? "—" : formatNumber(from)} → ${to === null ? "—" : formatNumber(to)}`;

  return (
    <section className={`monthly-funnel ${tone}`} aria-label={`${label}: ${periodLabel}`}>
      <header className="monthly-funnel-head">
        <div>
          <span>{label}</span>
          <strong>{periodLabel}</strong>
        </div>
      </header>

      <div className="sales-funnel" aria-label={`Etapas de ${label.toLowerCase()}`}>
        {showConversions ? <svg
          id={conversionMapId}
          className="funnel-arrow-map visible"
          viewBox="0 0 420 372"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker id={markerLeft} markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto">
              <path d="M0 0 L7 3.5 L0 7 Z" className="arrow-head left" />
            </marker>
            <marker id={markerRight} markerWidth="7" markerHeight="7" refX="5.4" refY="3.5" orient="auto">
              <path d="M0 0 L7 3.5 L0 7 Z" className="arrow-head right" />
            </marker>
          </defs>

          {stages.slice(0, -1).map((item, index) => {
            const next = stages[index + 1];
            const startX = 210 - stageHalfWidths[index];
            const endX = 210 - stageHalfWidths[index + 1];
            const startY = stageY[index] + 18;
            const endY = stageY[index + 1] - 18;
            const midY = (startY + endY) / 2;
            return (
              <g className="funnel-curve left" key={`next-${item.key}`}>
                <path
                  d={`M ${startX} ${startY} C 74 ${startY}, 74 ${endY}, ${endX} ${endY}`}
                  markerEnd={`url(#${markerLeft})`}
                />
                <text x="45" y={midY - 5} textAnchor="middle">
                  <tspan x="45">{valueFlow(item.value, next.value)}</tspan>
                  <tspan className="rate" x="45" dy="14">{conversionLabel(item.value, next.value)}</tspan>
                </text>
              </g>
            );
          })}

          {stages.slice(0, -1).map((item, index) => {
            const startX = 210 + stageHalfWidths[index];
            const endX = 210 + stageHalfWidths[stages.length - 1];
            const curveX = 404 - index * 14;
            const targetY = stageY[stages.length - 1] - 15 + index * 8;
            return (
              <g className="funnel-curve right" key={`sale-${item.key}`}>
                <path
                  d={`M ${startX} ${stageY[index]} C ${curveX} ${stageY[index]}, ${curveX} ${targetY}, ${endX} ${targetY}`}
                  markerEnd={`url(#${markerRight})`}
                />
                <text x={curveX - 23} y={stageY[index] - 8} textAnchor="middle">
                  <tspan x={curveX - 23}>{valueFlow(item.value, sales)}</tspan>
                  <tspan className="rate" x={curveX - 23} dy="14">{conversionLabel(item.value, sales)}</tspan>
                </text>
              </g>
            );
          })}
        </svg> : null}

        <div className="funnel-stage-stack" role="list">
          {stages.map((item, index) => {
            const valueLabel = item.value === null ? "—" : formatNumber(item.value);
            return (
              <a
                className="funnel-stage"
                key={item.key}
                role="listitem"
                href={`/etapas/${item.slug}`}
                aria-label={`${item.label}: ${valueLabel}. Abrir análise.`}
                style={
                  {
                    width: `${item.width}%`,
                    "--funnel-color": FUNNEL_STAGE_COLORS[index],
                  } as React.CSSProperties
                }
              >
                <span className="funnel-stage-name">{item.short}</span>
                <strong>{valueLabel}</strong>
              </a>
            );
          })}
        </div>
        <button
          className={`conversion-toggle ${showConversions ? "active" : ""}`}
          type="button"
          aria-controls={conversionMapId}
          aria-expanded={showConversions}
          onClick={() => setShowConversions((visible) => !visible)}
        >
          Conversão
        </button>
      </div>
    </section>
  );
}

export function DashboardClient({
  dashboard,
  dataStatus,
  signedInEmail,
  signedInName,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [refreshState, setRefreshState] = useState<
    "idle" | "starting" | "polling" | "error"
  >("idle");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const { selection, setSelection } = useDashboardFilters();

  useEffect(() => {
    const saved = window.localStorage.getItem("descomplica-theme") as ThemeMode | null;
    if (saved === "light" || saved === "balanced" || saved === "dark") {
      const timer = window.setTimeout(() => setTheme(saved), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("descomplica-theme", theme);
  }, [theme]);

  const refreshSalesforce = useCallback(async () => {
    if (
      !dashboard ||
      dataStatus !== "live" ||
      refreshState === "starting" ||
      refreshState === "polling"
    ) return;

    const previousGeneratedAt = dashboard.generatedAt;
    setRefreshState("starting");
    setRefreshMessage("Solicitando dados atuais ao Salesforce…");

    try {
      const response = await fetch("/api/refresh/salesforce", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok && response.status !== 409) {
        throw new Error("refresh_rejected");
      }

      setRefreshState("polling");
      setRefreshMessage("Salesforce atualizando os seis relatórios…");

      for (let attempt = 0; attempt < 96; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
        const statusResponse = await fetch("/api/dashboard/status", {
          cache: "no-store",
        });
        if (!statusResponse.ok) continue;

        const status = (await statusResponse.json()) as {
          generatedAt?: string;
        };
        if (status.generatedAt && status.generatedAt !== previousGeneratedAt) {
          const synced = encodeURIComponent(status.generatedAt);
          window.location.replace(`${window.location.pathname}?synced=${synced}`);
          return;
        }
      }

      setRefreshState("idle");
      setRefreshMessage(
        "A atualização continua em processamento. Tente novamente em instantes.",
      );
    } catch {
      setRefreshState("error");
      setRefreshMessage("Não foi possível iniciar a atualização. Tente novamente.");
    }
  }, [dashboard, dataStatus, refreshState]);

  useEffect(() => {
    if (!dashboard || dataStatus !== "live") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/dashboard/status", { cache: "no-store" });
        if (!response.ok) return;
        const status = (await response.json()) as { generatedAt?: string };
        if (status.generatedAt && status.generatedAt !== dashboard.generatedAt) {
          window.location.replace(`${window.location.pathname}?synced=${encodeURIComponent(status.generatedAt)}`);
        }
      } catch {
        // A próxima verificação tenta novamente sem interromper o painel.
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [dashboard, dataStatus]);

  const active = useMemo(
    () => (dashboard ? buildFilteredView(dashboard, selection) : null),
    [dashboard, selection],
  );
  const realizedFunnel = useMemo(
    () => dashboard && active
      ? buildFilteredRealizedFunnel(dashboard, active, selection)
      : undefined,
    [active, dashboard, selection],
  );
  const sales = active?.metrics.sales;
  const salesGap = sales
    ? Math.max(0, sales.goal[period] - sales.current[period])
    : 0;
  const salesSurplus = sales
    ? Math.max(0, sales.current[period] - sales.goal[period])
    : 0;

  const conversions = useMemo(() => {
    if (!active) return [];
    const values = STAGES.map((item) => ({
      ...item,
      value: active.metrics[item.key].current[period],
      goal: active.metrics[item.key].goal[period],
      goalRate: progress(active.metrics[item.key], period),
    }));
    const max = Math.max(...values.map((item) => item.value), 1);
    return values.map((item, index) => ({
      ...item,
      width: 58 + Math.sqrt(item.value / max) * 42,
      rate:
        index === 0 || values[index - 1].value === 0
          ? null
          : item.value / values[index - 1].value,
    }));
  }, [active, period]);

  const funnelSummary = useMemo(() => {
    const first = conversions[0];
    const last = conversions[conversions.length - 1];
    const stages = conversions.slice(1).map((item, index) => ({
      ...item,
      previousLabel: conversions[index].label,
      loss: Math.max(conversions[index].value - item.value, 0),
    }));
    const bottleneck = stages.reduce<(typeof stages)[number] | null>(
      (lowest, item) => {
        if (item.rate === null) return lowest;
        if (!lowest || lowest.rate === null || item.rate < lowest.rate) return item;
        return lowest;
      },
      null,
    );

    return {
      totalRate:
        first && last && first.value > 0 ? last.value / first.value : null,
      bottleneck,
    };
  }, [conversions]);

  const monthlyFunnels = useMemo(() => {
    if (!active || !dashboard) {
      return { year: [], historical: [], previous: [], goal: [], pace: [], current: [] };
    }
    const [year, month, day] = dashboard.referenceDate.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const elapsedRate = daysInMonth > 0 ? Math.min(day / daysInMonth, 1) : 0;
    return {
      year: buildMonthlyFunnel(
        (stage) => active.metrics[stage.key].yearClosedMonthsAverage ?? null,
      ),
      historical: buildMonthlyFunnel(
        (stage) => active.metrics[stage.key].last3ClosedMonthsAverage ?? null,
      ),
      previous: buildMonthlyFunnel(
        (stage) => active.metrics[stage.key].previousMonth ?? null,
      ),
      goal: buildMonthlyFunnel(
        (stage) => active.metrics[stage.key].goal.month,
      ),
      pace: buildMonthlyFunnel(
        (stage) => active.metrics[stage.key].goal.month * elapsedRate,
      ),
      current: buildMonthlyFunnel(
        (stage) => active.metrics[stage.key].current.month,
      ),
    };
  }, [active, dashboard]);

  const paceSales = monthlyFunnels.pace.at(-1)?.value ?? null;
  const currentSales = monthlyFunnels.current.at(-1)?.value ?? null;
  const paceSalesGap =
    paceSales !== null && currentSales !== null ? currentSales - paceSales : null;

  const monthLabels =
    dashboard?.monthComparisonMode === "same_day_mtd"
      ? getMonthToDateLabels(dashboard.referenceDate)
      : { current: "Mês atual", previous: "Mês anterior" };

  const actionPlan = funnelSummary.bottleneck
    ? ACTION_PLANS[funnelSummary.bottleneck.key]
    : ACTION_PLANS.opportunities;

  if (!dashboard || !active) {
    return (
      <main className="empty-shell">
        <section className="empty-card">
          <div className="brand-mark" aria-hidden="true">D</div>
          <p className="eyebrow">Descomplica CRM</p>
          <h1>Seu painel está pronto para receber os dados.</h1>
          <p>
            O acesso de <strong>{signedInEmail}</strong> foi reconhecido, mas o
            relatório completo do Salesforce ainda não chegou. Assim que a
            automação rodar, os resultados da equipe aparecerão aqui.
          </p>
          <span className="status-pill waiting">Aguardando sincronização</span>
        </section>
      </main>
    );
  }

  const statusLabel =
    dataStatus === "live"
      ? "Atualizado pelo Salesforce"
      : dataStatus === "demo"
        ? "Prévia demonstrativa"
        : "Aguardando dados";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">D</div>
          <div>
            <strong>Descomplica</strong>
            <span>Inteligência comercial</span>
          </div>
        </div>
        <div className="topbar-actions">
          <SiteMenu />
          <div className="theme-switch" role="group" aria-label="Tema do painel">
            {([
              ["light", "Claro"],
              ["balanced", "Médio"],
              ["dark", "Escuro"],
            ] as const).map(([key, text]) => (
              <button
                key={key}
                type="button"
                className={theme === key ? "active" : ""}
                aria-pressed={theme === key}
                onClick={() => setTheme(key)}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="account-block">
          <span className={`status-pill ${dataStatus}`}>{statusLabel}</span>
          <div>
            <strong>{dashboard.collaborator.name || signedInName}</strong>
            <span>{dashboard.collaborator.manager}</span>
          </div>
          <div className="avatar" aria-hidden="true">
            {(dashboard.collaborator.name || signedInName)
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </div>
          </div>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="page-intro">
          <div>
            <p className="eyebrow">Visão consolidada</p>
            <h1>Relatório completo da equipe.</h1>
            <p>
              Resultados de todos os colaboradores, separados por origem e
              atualizados automaticamente pelo Salesforce.
            </p>
          </div>
          <div className="snapshot-meta">
            <span>Atualizado em</span>
            <strong>{formatDate(dashboard.generatedAt)}</strong>
            <small>{dashboard.source}</small>
            <small className="automatic-update">Automático a cada 30 minutos</small>
            <button
              className="refresh-button"
              type="button"
              onClick={() => {
                if (refreshState === "error") setRefreshState("idle");
                void refreshSalesforce();
              }}
              disabled={refreshState === "starting" || refreshState === "polling"}
            >
              {refreshState === "starting" || refreshState === "polling"
                ? "Atualizando…"
                : "Atualizar"}
            </button>
            {refreshMessage ? (
              <small className={`refresh-message ${refreshState}`}>
                {refreshMessage}
              </small>
            ) : null}
          </div>
        </section>

        <StageNavigation />

        <DashboardFilters
          data={dashboard.filterData}
          selection={selection}
          onChange={setSelection}
        />

        <section className="view-summary" role="tabpanel">
          <div>
            <p className="eyebrow">{active.label}</p>
            <h2>{active.description}</h2>
          </div>
          <div className="period-switch" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={period === item.key ? "active" : ""}
                aria-pressed={period === item.key}
                onClick={() => setPeriod(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="stage-section" aria-labelledby="stage-title">
          <div className="stage-section-heading">
            <div>
              <p className="eyebrow">Pulso do funil</p>
              <h2 id="stage-title">Conversão por etapa</h2>
            </div>
            <p>Rosca = avanço entre etapas · Parecer = realizado frente à meta</p>
          </div>
          <div className="metric-grid" aria-label="Indicadores do funil">
            {conversions.map((item, index) => (
              <StageDonut
                key={item.key}
                label={item.label}
                value={item.value}
                conversion={item.rate}
                goal={item.goal}
                goalRate={item.goalRate}
                color={item.color}
                index={index}
                href={`/etapas/${item.slug}`}
              />
            ))}
          </div>
        </section>

        <section className="analysis-grid">
          <article className="funnel-card comparison-funnel-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Comparativo mensal</p>
                <h2>Realizado e meta lado a lado</h2>
              </div>
              <span>Histórico × planejamento × realizado</span>
            </div>
            <p className="chart-subtitle">
              Médias usam somente meses fechados. Meta esperada considera dias corridos até hoje.
            </p>
            <div className="funnel-comparison-grid">
              <MonthlyFunnel
                label="Média do ano"
                periodLabel={`Meses fechados de ${dashboard.referenceDate.slice(0, 4)}`}
                stages={monthlyFunnels.year}
                tone="year"
              />
              <MonthlyFunnel
                label="Média últimos 3 meses"
                periodLabel="Últimos 3 meses fechados"
                stages={monthlyFunnels.historical}
                tone="historical"
              />
              <MonthlyFunnel
                label="Mês anterior"
                periodLabel={monthLabels.previous}
                stages={monthlyFunnels.previous}
                tone="previous"
              />
              <MonthlyFunnel
                label="Meta atual"
                periodLabel="Meta projetada deste mês"
                stages={monthlyFunnels.goal}
                tone="goal"
              />
              <MonthlyFunnel
                label="Meta esperada até hoje"
                periodLabel={`Ritmo esperado · dias 1–${dashboard.referenceDate.slice(-2).replace(/^0/, "")}`}
                stages={monthlyFunnels.pace}
                tone="pace"
              />
              <MonthlyFunnel
                label="Mês atual"
                periodLabel={monthLabels.current}
                stages={monthlyFunnels.current}
                tone="current"
              />
            </div>
            {paceSalesGap !== null && paceSales !== null && currentSales !== null ? (
              <div className={`pace-readout ${paceSalesGap >= 0 ? "ahead" : "behind"}`}>
                <div>
                  <span>Ritmo de vendas</span>
                  <strong>
                    {paceSalesGap >= 0
                      ? `${formatNumber(paceSalesGap)} acima do esperado`
                      : `${formatNumber(Math.abs(paceSalesGap))} abaixo do esperado`}
                  </strong>
                </div>
                <small>
                  {formatNumber(currentSales)} realizadas · {formatNumber(paceSales)} esperadas até hoje
                </small>
              </div>
            ) : null}
          </article>

          <article className="efficiency-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Diagnóstico</p>
                <h2>Eficiência do funil</h2>
              </div>
            </div>
            <div className="efficiency-horizontal">
              <div className="efficiency-hero">
                <span>Conversão total</span>
                <strong>
                  {funnelSummary.totalRate === null
                    ? "—"
                    : `${formatNumber(funnelSummary.totalRate * 100)}%`}
                </strong>
                <small>Oportunidades → vendas</small>
              </div>
              <div className="insight-grid">
                <div>
                  <span>Gap para meta de vendas</span>
                  <strong>
                    {sales.goal[period] <= 0
                      ? "Meta não definida"
                      : salesGap > 0
                        ? salesGapText(salesGap)
                        : salesSurplus > 0
                          ? salesGapText(salesSurplus, true)
                          : "Meta atingida"}
                  </strong>
                  <small>
                    {sales.goal[period] > 0
                      ? `${formatNumber(sales.current[period])} realizadas de ${formatNumber(sales.goal[period])}`
                      : `${formatNumber(sales.current[period])} vendas realizadas no período`}
                  </small>
                </div>
                <div>
                  <span>Gargalo principal</span>
                  <strong>
                    {funnelSummary.bottleneck
                      ? `${funnelSummary.bottleneck.previousLabel} → ${funnelSummary.bottleneck.label}`
                      : "Sem base suficiente"}
                  </strong>
                  <small>
                    {funnelSummary.bottleneck?.rate === null || !funnelSummary.bottleneck
                      ? "Aguardando volume"
                      : `${formatNumber(funnelSummary.bottleneck.rate * 100)}% converte · ${formatNumber(funnelSummary.bottleneck.loss)} não avançaram`}
                  </small>
                </div>
                <div className="action-plan">
                  <span>Plano de ação</span>
                  <strong>{actionPlan}</strong>
                  <small>
                    Prioridade definida pelo menor avanço entre etapas no filtro atual.
                  </small>
                </div>
                <div>
                  <span>VGV realizado</span>
                  <strong>{formatCurrency(active.salesValue[period])}</strong>
                  <small>{PERIODS.find((item) => item.key === period)?.label}</small>
                </div>
              </div>
            </div>
          </article>
        </section>

        {realizedFunnel ? (
          <section className="realized-section" aria-labelledby="realized-title">
            <div className="section-heading realized-heading">
              <div>
                <p className="eyebrow">Detalhamento operacional</p>
                <h2 id="realized-title">Realizado Funil</h2>
              </div>
              <div className="team-summary" aria-label="Resumo da equipe">
                <span>
                  <strong>{formatNumber(realizedFunnel.resumo.corretores)}</strong>
                  Corretores
                </span>
                <span>
                  <strong>{formatNumber(realizedFunnel.resumo.gerentes)}</strong>
                  Gerentes
                </span>
              </div>
            </div>
            <p className="realized-note">
              {dashboard.monthComparisonMode === "same_day_mtd"
                ? "Comparativo mensal usa o dia 1 até a mesma data nos dois meses. "
                : "Último relatório ainda usa o mês anterior completo. A próxima sincronização aplicará o período equivalente. "}
              Todos os indicadores respondem às seleções ativas.
            </p>
            <div className="realized-grid">
              {REALIZED_STAGES.map((stage) => (
                <RealizedMetricTable
                  key={stage.key}
                  label={stage.label}
                  metric={realizedFunnel[stage.key]}
                  referenceDate={
                    dashboard.monthComparisonMode === "same_day_mtd"
                      ? dashboard.referenceDate
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        <footer className="dashboard-footer">
          <span>Descomplica CRM · Dados consolidados do Salesforce</span>
          <span>{signedInEmail}</span>
        </footer>
      </main>
    </div>
  );
}
