"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native links avoid a Vinext hydration bug. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMonthToDateLabels,
  PeriodComparisonTable,
  type PeriodComparisonRow,
} from "./PeriodComparisonTable";
import { StageNavigation } from "./StageNavigation";
import { ACTION_PLANS, STAGES, type StageConfig } from "./stage-config";
import type { DashboardPayload, DashboardViewKey, PeriodKey } from "./types";

type Props = {
  dashboard: DashboardPayload | null;
  dataStatus: "live" | "demo" | "waiting";
  signedInEmail: string;
  signedInName: string;
  stage: StageConfig;
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function StageDetailClient({
  dashboard,
  dataStatus,
  signedInEmail,
  signedInName,
  stage,
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
      if (!response.ok && response.status !== 409) throw new Error("refresh_rejected");

      setRefreshState("polling");
      setRefreshMessage("Salesforce atualizando os seis relatórios…");

      for (let attempt = 0; attempt < 96; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
        const statusResponse = await fetch("/api/dashboard/status", { cache: "no-store" });
        if (!statusResponse.ok) continue;

        const status = (await statusResponse.json()) as { generatedAt?: string };
        if (status.generatedAt && status.generatedAt !== previousGeneratedAt) {
          const synced = encodeURIComponent(status.generatedAt);
          window.location.replace(`${window.location.pathname}?synced=${synced}`);
          return;
        }
      }

      setRefreshState("idle");
      setRefreshMessage("A atualização continua em processamento. Tente novamente em instantes.");
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
    const timer = window.setTimeout(() => void refreshSalesforce(), 0);
    return () => window.clearTimeout(timer);
  }, [dashboard, dataStatus, refreshSalesforce]);

  const stageIndex = STAGES.findIndex((item) => item.key === stage.key);
  const previousStage = stageIndex > 0 ? STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null;
  const active = dashboard?.views[activeView] ?? null;
  const metric = active?.metrics[stage.key] ?? null;
  const current = metric?.current[period] ?? 0;
  const goal = metric?.goal[period] ?? 0;
  const goalRate = goal > 0 ? current / goal : 0;
  const gap = goal > 0 ? Math.max(goal - current, 0) : 0;
  const previousValue = previousStage
    ? active?.metrics[previousStage.key].current[period] ?? 0
    : null;
  const conversion = previousValue && previousValue > 0 ? current / previousValue : null;
  const ringRate = Math.min(Math.max(goal > 0 ? goalRate : conversion ?? (current > 0 ? 1 : 0), 0), 1);
  const monthLabels = getMonthToDateLabels(dashboard?.referenceDate);

  const comparisonRows: PeriodComparisonRow[] = (() => {
    if (!metric) return [];
    return [
      {
        label: "Mês",
        previousLabel: monthLabels.previous,
        previous: metric.previousMonth ?? null,
        currentLabel: monthLabels.current,
        current: metric.current.month,
        goal: metric.goal.month,
      },
      {
        label: "14 dias",
        previousLabel: "14 dias anteriores",
        previous: metric.previous14Days ?? null,
        currentLabel: "Últimos 14 dias",
        current: metric.last14Days ?? 0,
      },
      {
        label: "7 dias",
        previousLabel: "7 dias anteriores",
        previous:
          metric.previous7Days ??
          (metric.last14Days !== undefined && metric.last7Days !== undefined
            ? Math.max(metric.last14Days - metric.last7Days, 0)
            : null),
        currentLabel: "Últimos 7 dias",
        current: metric.last7Days ?? metric.current.week,
      },
      {
        label: "Semana",
        previousLabel: "Semana passada",
        previous: metric.previousWeek ?? null,
        currentLabel: "Esta semana",
        current: metric.currentWeek ?? metric.current.week,
        goal: metric.goal.week,
      },
      {
        label: "Dia",
        previousLabel: "Ontem",
        previous: metric.yesterday ?? null,
        currentLabel: "Hoje",
        current: metric.current.today,
        goal: metric.goal.today,
      },
    ];
  })();

  if (!dashboard || !active || !metric) {
    return (
      <main className="empty-shell">
        <section className="empty-card">
          <div className="brand-mark" aria-hidden="true">D</div>
          <p className="eyebrow">Descomplica CRM</p>
          <h1>Dados da etapa ainda não chegaram.</h1>
          <p>O Salesforce ainda não enviou o relatório completo para esta análise.</p>
          <a href="/" className="empty-back-link">Voltar à visão geral</a>
        </section>
      </main>
    );
  }

  const statusLabel = dataStatus === "live" ? "Atualizado pelo Salesforce" : "Prévia demonstrativa";
  const attainment = goal <= 0
    ? { label: "Sem meta definida", tone: "neutral" }
    : goalRate >= 1
      ? { label: "Meta atingida", tone: "strong" }
      : goalRate >= 0.8
        ? { label: "Próximo da meta", tone: "healthy" }
        : goalRate >= 0.5
          ? { label: "Atenção ao ritmo", tone: "attention" }
          : { label: "Gap relevante", tone: "critical" };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup brand-link" href="/">
          <div className="brand-mark" aria-hidden="true">D</div>
          <div><strong>Descomplica</strong><span>Inteligência comercial</span></div>
        </a>
        <div className="account-block">
          <span className={`status-pill ${dataStatus}`}>{statusLabel}</span>
          <div><strong>{dashboard.collaborator.name || signedInName}</strong><span>{dashboard.collaborator.manager}</span></div>
          <div className="avatar" aria-hidden="true">
            {(dashboard.collaborator.name || signedInName).split(" ").slice(0, 2).map((part) => part[0]).join("")}
          </div>
        </div>
      </header>

      <main className="dashboard-shell stage-detail-shell">
        <section className="page-intro stage-page-intro">
          <div>
            <p className="eyebrow">Etapa {String(stageIndex + 1).padStart(2, "0")} do funil</p>
            <h1>Detalhe de {stage.label}.</h1>
            <p>{stage.description} Explore o resultado por origem e período.</p>
          </div>
          <div className="snapshot-meta">
            <span>Atualizado em</span>
            <strong>{formatDate(dashboard.generatedAt)}</strong>
            <small>{dashboard.source}</small>
            <button className="refresh-button" type="button" onClick={() => void refreshSalesforce()} disabled={refreshState === "starting" || refreshState === "polling"}>
              {refreshState === "starting" || refreshState === "polling" ? "Atualizando…" : "Atualizar"}
            </button>
            {refreshMessage ? <small className={`refresh-message ${refreshState}`}>{refreshMessage}</small> : null}
          </div>
        </section>

        <StageNavigation active={stage.slug} />

        <nav className="view-tabs" role="tablist" aria-label="Visualizações">
          {VIEW_ORDER.map((key) => {
            const item = dashboard.views[key];
            return (
              <button key={key} type="button" role="tab" aria-selected={activeView === key} className={activeView === key ? "active" : ""} onClick={() => setActiveView(key)}>
                <span>{item.label}</span>
                <small>{key === "with_canal_imob" ? "Canal parceiro" : key === "without_canal_imob" ? "Operação própria" : "Todos os dados"}</small>
              </button>
            );
          })}
        </nav>

        <section className="view-summary stage-view-summary" role="tabpanel">
          <div><p className="eyebrow">{active.label}</p><h2>{active.description}</h2></div>
          <div className="period-switch" role="group" aria-label="Período">
            {PERIODS.map((item) => <button key={item.key} type="button" className={period === item.key ? "active" : ""} aria-pressed={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
          </div>
        </section>

        <section className="stage-detail-hero" style={{ "--detail-accent": stage.color } as React.CSSProperties}>
          <div className="stage-detail-main">
            <span className="detail-stage-label">{stage.label} no período</span>
            <strong>{formatNumber(current)}</strong>
            <p>{goal > 0 ? `${formatNumber(goalRate * 100)}% da meta de ${formatNumber(goal)}` : "Acompanhamento sem meta definida"}</p>
            <div className={`detail-status ${attainment.tone}`}><span aria-hidden="true" />{attainment.label}</div>
          </div>
          <div className="detail-progress" style={{ "--detail-progress": `${ringRate * 360}deg` } as React.CSSProperties} role="img" aria-label={`${formatPercent(goalRate)} da meta`}>
            <div><strong>{goal > 0 ? formatPercent(goalRate) : conversion === null ? "Base" : formatPercent(conversion)}</strong><span>{goal > 0 ? "da meta" : "conversão"}</span></div>
          </div>
        </section>

        <section className="stage-kpi-grid" aria-label={`Indicadores de ${stage.label}`}>
          <article><span>Realizado</span><strong>{formatNumber(current)}</strong><small>{PERIODS.find((item) => item.key === period)?.label}</small></article>
          <article><span>Meta</span><strong>{goal > 0 ? formatNumber(goal) : "—"}</strong><small>{goal > 0 ? "Objetivo do período" : "Não definida"}</small></article>
          <article><span>Gap</span><strong>{goal > 0 ? formatNumber(gap) : "—"}</strong><small>{gap > 0 ? "Faltam para a meta" : goal > 0 ? "Meta coberta" : "Sem referência"}</small></article>
          <article><span>Conversão</span><strong>{previousStage && conversion !== null ? formatPercent(conversion) : "Base"}</strong><small>{previousStage ? `${previousStage.label} → ${stage.label}` : "Entrada do funil"}</small></article>
        </section>

        <section className="stage-detail-grid">
          <article className="history-card">
            <div className="section-heading"><div><p className="eyebrow">Evolução</p><h2>Comparativo entre períodos</h2></div></div>
            <p className="comparison-helper">Mês compara o dia 1 até a mesma data nos dois períodos.</p>
            <PeriodComparisonTable rows={comparisonRows} label={`Comparativo de ${stage.label}`} />
          </article>

          <article className="stage-action-card">
            <p className="eyebrow">Diagnóstico da etapa</p>
            <h2>{attainment.label}</h2>
            <div className="stage-action-metric"><span>Gap atual</span><strong>{goal > 0 ? (gap > 0 ? `${formatNumber(gap)} para a meta` : "Meta coberta") : "Sem meta definida"}</strong></div>
            <div className="stage-action-plan"><span>Plano de ação</span><strong>{ACTION_PLANS[stage.key]}</strong></div>
            <div className="stage-flow-links">
              {previousStage ? <a href={`/etapas/${previousStage.slug}`}>← {previousStage.label}</a> : <span>Início do funil</span>}
              {nextStage ? <a href={`/etapas/${nextStage.slug}`}>{nextStage.label} →</a> : <span>Fim do funil</span>}
            </div>
          </article>
        </section>

        <footer className="dashboard-footer"><span>Descomplica CRM · Dados consolidados do Salesforce</span><span>{signedInEmail}</span></footer>
      </main>
    </div>
  );
}
