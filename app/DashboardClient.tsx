"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const METRICS = [
  {
    key: "opportunities",
    label: "Oportunidades",
    short: "Oportunidades",
    color: "#2563eb",
  },
  {
    key: "appointments",
    label: "Agendamentos",
    short: "Agendamentos",
    color: "#0891b2",
  },
  { key: "visits", label: "Visitas", short: "Visitas", color: "#7c3aed" },
  { key: "folders", label: "Pastas", short: "Pastas", color: "#d97706" },
  { key: "sales", label: "Vendas", short: "Vendas", color: "#059669" },
] as const;

const REALIZED_STAGES = [
  { key: "agendamentos", label: "Agendamentos realizados" },
  { key: "visitas", label: "Visitas realizadas" },
  { key: "pastas", label: "Pastas realizadas" },
  { key: "vendas", label: "Vendas realizadas" },
] as const;

const REALIZED_PERIODS = [
  { key: "mesAnterior", label: "Mês anterior" },
  { key: "mesAtual", label: "Mês atual", goal: "mes", rate: "realizado_meta_mes" },
  { key: "ultimos14Dias", label: "Últimos 14 dias" },
  { key: "ultimos7Dias", label: "Últimos 7 dias" },
  { key: "estaSemana", label: "Esta semana", goal: "semana", rate: "realizado_meta_semana" },
  { key: "ontem", label: "Ontem" },
  { key: "hoje", label: "Hoje", goal: "dia", rate: "realizado_meta_dia" },
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

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value * 100)}%`;
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

function ProgressRing({
  value,
  label,
  display,
}: {
  value: number;
  label?: string;
  display?: string;
}) {
  const safeValue = Math.min(Math.max(value, 0), 1);
  return (
    <span
      className="progress-ring"
      aria-label={label ?? `${formatNumber(value * 100)}% da meta`}
      style={{ "--progress": `${safeValue * 360}deg` } as React.CSSProperties}
    >
      <span>{display ?? `${formatNumber(value * 100)}%`}</span>
    </span>
  );
}

function RealizedMetricTable({
  label,
  metric,
}: {
  label: string;
  metric: RealizedFunnelMetric;
}) {
  return (
    <article className="realized-card">
      <h3>{label}</h3>
      <div className="realized-table" role="table" aria-label={label}>
        <div className="realized-row realized-head" role="row">
          <span role="columnheader">Período</span>
          <span role="columnheader">Realizado</span>
          <span role="columnheader">Meta</span>
          <span role="columnheader">% da meta</span>
        </div>
        {REALIZED_PERIODS.map((item) => (
          <div className="realized-row" role="row" key={item.key}>
            <span role="cell">{item.label}</span>
            <strong role="cell">{formatNumber(metric[item.key])}</strong>
            <span role="cell">
              {item.goal ? formatNumber(metric.metas[item.goal]) : "—"}
            </span>
            <span role="cell" className={item.rate ? "rate" : "muted-rate"}>
              {item.rate ? formatPercent(metric[item.rate]) : "—"}
            </span>
          </div>
        ))}
      </div>
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
}: {
  label: string;
  value: number;
  conversion: number | null;
  goal: number;
  goalRate: number;
  color: string;
  index: number;
}) {
  const ringRate = conversion === null ? (value > 0 ? 1 : 0) : conversion;
  const safeRingRate = Math.min(Math.max(ringRate, 0), 1);
  const conversionLabel =
    conversion === null
      ? value > 0
        ? "Base do funil"
        : "Sem base"
      : `${formatNumber(conversion * 100)}% conversão`;

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
          window.location.replace(`/?synced=${synced}`);
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
  const salesProgress = sales ? progress(sales, period) : 0;
  const salesGap = sales
    ? Math.max(0, sales.goal[period] - sales.current[period])
    : 0;

  const conversions = useMemo(() => {
    if (!active) return [];
    const values = METRICS.map((item) => ({
      ...item,
      value: active.metrics[item.key].current[period],
      goal: active.metrics[item.key].goal[period],
      goalRate: progress(active.metrics[item.key], period),
    }));
    const max = Math.max(...values.map((item) => item.value), 1);
    return values.map((item, index) => ({
      ...item,
      width: Math.max(34, (item.value / max) * 100),
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

        <section className="hero-grid">
          <article className="goal-card">
            <div className="goal-copy">
              <span className="card-label">Meta de vendas</span>
              <h2>
                {sales.goal[period] <= 0
                  ? "Meta de vendas ainda não definida."
                  : salesGap > 0
                  ? `Faltam ${formatNumber(salesGap)} vendas para a meta.`
                  : "Meta atingida. Continue avançando."}
              </h2>
              <p>
                {sales.goal[period] > 0 ? (
                  <>
                    A equipe realizou <strong>{formatNumber(sales.current[period])}</strong>{" "}
                    de <strong>{formatNumber(sales.goal[period])}</strong> vendas no
                    período selecionado.
                  </>
                ) : (
                  <>
                    A equipe realizou <strong>{formatNumber(sales.current[period])}</strong>{" "}
                    vendas no período selecionado.
                  </>
                )}
              </p>
            </div>
            <ProgressRing
              value={salesProgress}
              label={sales.goal[period] > 0 ? undefined : "Meta não definida"}
              display={sales.goal[period] > 0 ? undefined : "—"}
            />
            <dl className="goal-stats">
              <div>
                <dt>VGV realizado</dt>
                <dd>{formatCurrency(active.salesValue[period])}</dd>
              </div>
              <div>
                <dt>Últimos 7 dias</dt>
                <dd>{formatNumber(sales.last7Days ?? 0)}</dd>
              </div>
              <div>
                <dt>Mês anterior</dt>
                <dd>{formatNumber(sales.previousMonth ?? 0)}</dd>
              </div>
            </dl>
          </article>

          <article className="channel-card">
            <span className="card-label">Leitura da visualização</span>
            <h3>{active.label}</h3>
            <p>
              {activeView === "all"
                ? "Esta visão consolida todas as origens. Use as outras abas para separar o impacto do CANAL IMOB."
                : activeView === "with_canal_imob"
                  ? "Considera oportunidades, pastas e vendas cuja imobiliária contém CANAL IMOB."
                  : "Remove oportunidades, pastas e vendas cuja imobiliária contém CANAL IMOB."}
            </p>
            <div className="channel-total">
              <span>Oportunidades</span>
              <strong>
                {formatNumber(active.metrics.opportunities.current[period])}
              </strong>
            </div>
          </article>
        </section>

        <section className="stage-section" aria-labelledby="stage-title">
          <div className="stage-section-heading">
            <div>
              <p className="eyebrow">Pulso do funil</p>
              <h2 id="stage-title">Conversão por etapa</h2>
            </div>
            <p>Rosca = avanço sobre a etapa anterior · Meta = período selecionado</p>
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
              Largura proporcional ao volume. Conversão contra a etapa anterior.
            </p>
            <div className="sales-funnel" role="list" aria-label="Funil de vendas por etapa">
              {conversions.map((item) => (
                <div
                  className="funnel-stage"
                  key={item.key}
                  role="listitem"
                  aria-label={`${item.label}: ${formatNumber(item.value)}`}
                  style={{
                    width: `${item.width}%`,
                    "--stage-color": item.color,
                  } as React.CSSProperties}
                >
                  <span>{item.short}</span>
                  <strong>{formatNumber(item.value)}</strong>
                  <small>
                    {item.rate === null
                      ? item.value > 0
                        ? "Base 100%"
                        : "Sem dados"
                      : `${formatNumber(item.rate * 100)}%`}
                  </small>
                </div>
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
              <div>
                <span>Meta de vendas</span>
                <strong>
                  {sales.goal[period] > 0 ? `${formatNumber(salesProgress * 100)}%` : "—"}
                </strong>
                <small>
                  {sales.goal[period] > 0
                    ? `${formatNumber(sales.current[period])} de ${formatNumber(sales.goal[period])}`
                    : `Meta não definida · ${formatNumber(sales.current[period])} vendas`}
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
