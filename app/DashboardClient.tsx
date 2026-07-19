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
  { key: "opportunities", label: "Oportunidades", short: "Oportunidades" },
  { key: "appointments", label: "Agendamentos", short: "Agendamentos" },
  { key: "visits", label: "Visitas", short: "Visitas" },
  { key: "folders", label: "Pastas", short: "Pastas" },
  { key: "sales", label: "Vendas", short: "Vendas" },
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

function ProgressRing({ value }: { value: number }) {
  const safeValue = Math.min(Math.max(value, 0), 1);
  return (
    <span
      className="progress-ring"
      aria-label={`${formatNumber(value * 100)}% da meta`}
      style={{ "--progress": `${safeValue * 360}deg` } as React.CSSProperties}
    >
      <span>{formatNumber(value * 100)}%</span>
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
    }));
    const max = Math.max(...values.map((item) => item.value), 1);
    return values.map((item, index) => ({
      ...item,
      width: Math.max(18, (item.value / max) * 100),
      rate:
        index === 0 || values[index - 1].value === 0
          ? null
          : item.value / values[index - 1].value,
    }));
  }, [active, period]);

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
                {salesGap > 0
                  ? `Faltam ${formatNumber(salesGap)} vendas para a meta.`
                  : "Meta atingida. Continue avançando."}
              </h2>
              <p>
                A equipe realizou <strong>{formatNumber(sales.current[period])}</strong>{" "}
                de <strong>{formatNumber(sales.goal[period])}</strong> vendas no
                período selecionado.
              </p>
            </div>
            <ProgressRing value={salesProgress} />
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

        <section className="metric-grid" aria-label="Indicadores do funil">
          {METRICS.map((item) => {
            const metric = active.metrics[item.key];
            const value = metric.current[period];
            const goal = metric.goal[period];
            const rate = progress(metric, period);
            return (
              <article className="metric-card" key={item.key}>
                <div>
                  <span>{item.label}</span>
                  <strong>{formatNumber(value)}</strong>
                </div>
                <p>
                  Meta {formatNumber(goal)} · {formatNumber(rate * 100)}%
                </p>
                <div className="metric-progress" aria-hidden="true">
                  <span style={{ width: `${Math.min(rate, 1) * 100}%` }} />
                </div>
              </article>
            );
          })}
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
            <div className="funnel-list">
              {conversions.map((item) => (
                <div className="funnel-row" key={item.key}>
                  <div className="funnel-label">
                    <span>{item.short}</span>
                    <strong>{formatNumber(item.value)}</strong>
                  </div>
                  <div className="funnel-track">
                    <span style={{ width: `${item.width}%` }} />
                  </div>
                  <small>
                    {item.rate === null
                      ? "Base do funil"
                      : `${formatNumber(item.rate * 100)}% de conversão`}
                  </small>
                </div>
              ))}
            </div>
          </article>

          <article className="ranking-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Concentração</p>
                <h2>Empreendimentos em destaque</h2>
              </div>
            </div>
            {active.topDevelopments.length ? (
              <ol className="ranking-list">
                {active.topDevelopments.map((item, index) => (
                  <li key={item.name}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>Registros no período</small>
                    </div>
                    <b>{formatNumber(item.total)}</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Nenhum empreendimento no período.</p>
            )}
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
