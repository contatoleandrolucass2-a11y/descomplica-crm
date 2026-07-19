"use client";

import { useMemo, useState } from "react";
import type {
  DashboardPayload,
  DashboardViewKey,
  MetricSnapshot,
  PeriodKey,
} from "./types";

type Props = {
  dashboard: DashboardPayload | null;
  dataStatus: "live" | "demo" | "waiting";
  signedInEmail: string;
  signedInName: string;
  isConsolidated?: boolean;
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

export function DashboardClient({
  dashboard,
  dataStatus,
  signedInEmail,
  signedInName,
  isConsolidated = false,
}: Props) {
  const [activeView, setActiveView] = useState<DashboardViewKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("month");

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
            O acesso de <strong>{signedInEmail}</strong> foi reconhecido, mas a
            primeira sincronização do Salesforce ainda não chegou. Assim que a
            automação rodar, seus resultados aparecerão aqui.
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
            <p className="eyebrow">
              {isConsolidated ? "Visão consolidada" : "Meu desempenho"}
            </p>
            <h1>
              {isConsolidated
                ? "Relatório completo da equipe."
                : `Olá, ${dashboard.collaborator.name.split(" ")[0]}.`}
            </h1>
            <p>
              {isConsolidated
                ? "Resultados de todos os colaboradores, separados por origem e atualizados automaticamente."
                : "Seus resultados do funil, separados por origem e atualizados automaticamente."}
            </p>
          </div>
          <div className="snapshot-meta">
            <span>Última atualização</span>
            <strong>{formatDate(dashboard.generatedAt)}</strong>
            <small>{dashboard.source}</small>
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
                {isConsolidated ? "A equipe realizou" : "Você realizou"}{" "}
                <strong>{formatNumber(sales.current[period])}</strong>{" "}
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

        <footer className="dashboard-footer">
          <span>Descomplica CRM · Dados consolidados do Salesforce</span>
          <span>{signedInEmail}</span>
        </footer>
      </main>
    </div>
  );
}
