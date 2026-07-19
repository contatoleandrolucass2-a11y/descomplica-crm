"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PeriodComparisonTable, type PeriodComparisonRow } from "./PeriodComparisonTable";
import { StageNavigation } from "./StageNavigation";
import { ACTION_PLANS, STAGES } from "./stage-config";
import type {
  DashboardPayload,
  DashboardViewKey,
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

const VIEW_ORDER: DashboardViewKey[] = [
  "with_canal_imob",
  "without_canal_imob",
  "all",
];

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
}: {
  label: string;
  metric: RealizedFunnelMetric;
}) {
  const rows: PeriodComparisonRow[] = [
    {
      label: "Mês",
      previousLabel: "Mês anterior",
      previous: metric.mesAnterior,
      currentLabel: "Mês atual",
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

export function DashboardClient({
  dashboard,
  dataStatus,
  signedInEmail,
  signedInName,
}: Props) {
  const [activeView, setActiveView] = useState<DashboardViewKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [refreshState, setRefreshState] = useState<
    "idle" | "starting" | "polling" | "error"
  >("idle");
  const [refreshMessage, setRefreshMessage] = useState("");
  const autoRefreshStarted = useRef(false);

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
    if (!dashboard || dataStatus !== "live" || autoRefreshStarted.current) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get("synced") === dashboard.generatedAt) {
      url.searchParams.delete("synced");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      return;
    }

    autoRefreshStarted.current = true;
    const timer = window.setTimeout(() => {
      void refreshSalesforce();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dashboard, dataStatus, refreshSalesforce]);

  const active = dashboard?.views[activeView] ?? null;
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

        <nav className="view-tabs" role="tablist" aria-label="Visualizações">
          {VIEW_ORDER.map((key) => {
            const item = dashboard.views[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeView === key}
                className={activeView === key ? "active" : ""}
                onClick={() => setActiveView(key)}
              >
                <span>{item.label}</span>
                <small>
                  {key === "with_canal_imob"
                    ? "Canal parceiro"
                    : key === "without_canal_imob"
                      ? "Operação própria"
                      : "Todos os dados"}
                </small>
              </button>
            );
          })}
        </nav>

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
          <article className="funnel-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Conversão</p>
                <h2>Funil por etapa</h2>
              </div>
              <span>{PERIODS.find((item) => item.key === period)?.label}</span>
            </div>
            <p className="chart-subtitle">
              Escala visual suavizada para leitura. Valores e conversões são exatos.
            </p>
            <div className="sales-funnel" role="list" aria-label="Funil de vendas por etapa">
              {conversions.map((item, index) => (
                <a
                  className="funnel-stage"
                  key={item.key}
                  role="listitem"
                  href={`/etapas/${item.slug}`}
                  aria-label={`${item.label}: ${formatNumber(item.value)}`}
                  style={{
                    width: `${item.width}%`,
                    "--funnel-color": item.funnelColor,
                  } as React.CSSProperties}
                >
                  <span className="funnel-stage-name">
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    {item.short}
                  </span>
                  <strong>{formatNumber(item.value)}</strong>
                  <small className="funnel-rate">
                    {item.rate === null
                      ? item.value > 0
                        ? "Base 100%"
                        : "Sem dados"
                      : `${formatNumber(item.rate * 100)}%`}
                  </small>
                  <span className="funnel-open" aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </article>

          <article className="efficiency-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Diagnóstico</p>
                <h2>Eficiência do funil</h2>
              </div>
            </div>
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
          </article>
        </section>

        {dashboard.realizedFunnel ? (
          <section className="realized-section" aria-labelledby="realized-title">
            <div className="section-heading realized-heading">
              <div>
                <p className="eyebrow">Detalhamento operacional</p>
                <h2 id="realized-title">Realizado Funil</h2>
              </div>
              <div className="team-summary" aria-label="Resumo da equipe">
                <span>
                  <strong>{formatNumber(dashboard.realizedFunnel.resumo.corretores)}</strong>
                  Corretores
                </span>
                <span>
                  <strong>{formatNumber(dashboard.realizedFunnel.resumo.gerentes)}</strong>
                  Gerentes
                </span>
              </div>
            </div>
            <p className="realized-note">
              Vendas seguem a regra operacional sem CANAL IMOB. As três abas
              acima mantêm a comparação com, sem e geral.
            </p>
            <div className="realized-grid">
              {REALIZED_STAGES.map((stage) => (
                <RealizedMetricTable
                  key={stage.key}
                  label={stage.label}
                  metric={dashboard.realizedFunnel![stage.key]}
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
