"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation matches existing Vinext routes. */

import { useEffect, useMemo, useState } from "react";
import { SiteMenu } from "./SiteMenu";

const stages = [
  { key: "opportunities", label: "Oportunidades", short: "Oportunidade", color: "#ff426b" },
  { key: "appointments", label: "Agendamentos", short: "Agendamento", color: "#ffab42" },
  { key: "visits", label: "Visitas", short: "Visita", color: "#f2dd2f" },
  { key: "folders", label: "Pastas", short: "Pasta", color: "#34c5d7" },
  { key: "approved_folders", label: "Pastas aprovadas", short: "Pasta aprovada", color: "#3bd48d" },
  { key: "sales", label: "Vendas", short: "Venda", color: "#168bd2" },
] as const;

type Values = Record<(typeof stages)[number]["key"], number | "">;
const brokerMinimumFields = [
  { key: "month_1", label: "1º mês" },
  { key: "month_2", label: "2º mês" },
  { key: "month_3", label: "3º mês" },
  { key: "month_4_plus", label: "4º mês ou mais" },
] as const;
type BrokerMinimums = Record<(typeof brokerMinimumFields)[number]["key"], number | "">;
type BrokerWeeklyTargets = { appointments: number | ""; visits: number | "" };
const productiveMetrics = [
  { key: "appointments", label: "Meta agendamentos", color: "#20b9c3" },
  { key: "visits", label: "Meta visitas", color: "#f2c94c" },
  { key: "folders", label: "Meta pastas", color: "#42d995" },
  { key: "sales", label: "Meta vendas", color: "#4386ef" },
] as const;
type ProductiveTeamTargets = Record<(typeof productiveMetrics)[number]["key"], number | "">;

const formatWhole = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function buildMonthCalendar(reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay() === 0 ? 6 : first.getDay() - 1;
  return Array.from({ length: leading + totalDays }, (_, index) => {
    if (index < leading) return null;
    const day = index - leading + 1;
    const date = new Date(year, month, day);
    return { day, business: isBusinessDay(date), elapsed: date <= reference, today: date.toDateString() === reference.toDateString() };
  });
}

export function GoalsSettingsClient() {
  const [values, setValues] = useState<Values>(
    Object.fromEntries(stages.map(({ key }) => [key, ""])) as Values,
  );
  const [rates, setRates] = useState<Array<number | "">>(["", "", "", "", ""]);
  const [message, setMessage] = useState("Carregando metas atuais…");
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [brokerMinimums, setBrokerMinimums] = useState<BrokerMinimums>({
    month_1: 4,
    month_2: 6,
    month_3: 8,
    month_4_plus: 10,
  });
  const [brokerWeeklyTargets, setBrokerWeeklyTargets] = useState<BrokerWeeklyTargets>({ appointments: 6, visits: 2 });
  const [productiveTeamTargets, setProductiveTeamTargets] = useState<ProductiveTeamTargets>({ appointments: 100, visits: 100, folders: 100, sales: 60 });
  const [today] = useState(() => new Date());

  const calendar = useMemo(() => buildMonthCalendar(today), [today]);
  const businessDays = calendar.filter((day) => day?.business).length;
  const businessDaysElapsed = calendar.filter((day) => day?.business && day.elapsed).length;
  const businessDaysRemaining = Math.max(businessDays - businessDaysElapsed, 0);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(today);

  useEffect(() => {
    fetch("/api/settings/goals", { cache: "no-store" })
      .then((response) => response.json())
      .then((row) => {
        if (row) {
          const loaded = Object.fromEntries(
            stages.map(({ key }) => [key, Number.isFinite(Number(row[key])) ? Number(row[key]) : ""]),
          ) as Values;
          setValues(loaded);
          setRates(
            Array.isArray(row.rates) && row.rates.length === 5
              ? row.rates.map((rate: unknown) => Number(rate))
              : stages.slice(0, -1).map((stage, index) => {
              const lower = Number(loaded[stages[index + 1].key]);
              const current = Number(loaded[stage.key]);
              return lower > 0 ? Math.round((current / lower) * 100) : "";
            }),
          );
          setUpdatedAt(row.updated_at ?? null);
          const loadedMinimums = row.broker_minimums && typeof row.broker_minimums === "object" ? row.broker_minimums as Record<string, unknown> : {};
          setBrokerMinimums(Object.fromEntries(brokerMinimumFields.map(({ key }) => [key, Number.isFinite(Number(loadedMinimums[key])) ? Number(loadedMinimums[key]) : 0])) as BrokerMinimums);
          const loadedWeekly = row.broker_weekly_targets && typeof row.broker_weekly_targets === "object" ? row.broker_weekly_targets as Record<string, unknown> : {};
          setBrokerWeeklyTargets({
            appointments: Number.isFinite(Number(loadedWeekly.appointments)) ? Number(loadedWeekly.appointments) : 0,
            visits: Number.isFinite(Number(loadedWeekly.visits)) ? Number(loadedWeekly.visits) : 0,
          });
          const loadedProductive = row.productive_team_targets && typeof row.productive_team_targets === "object" ? row.productive_team_targets as Record<string, unknown> : {};
          setProductiveTeamTargets(Object.fromEntries(productiveMetrics.map(({ key }) => [key, Number.isFinite(Number(loadedProductive[key])) ? Number(loadedProductive[key]) : 0])) as ProductiveTeamTargets);
        }
        setMessage("");
      })
      .catch(() => setMessage("Não foi possível carregar as metas."));
  }, []);

  const computedValues = useMemo(() => {
    const output = Array<number>(stages.length).fill(0);
    output[stages.length - 1] = Number(values.sales) || 0;
    for (let index = stages.length - 2; index >= 0; index -= 1) {
      output[index] = output[index + 1] * ((Number(rates[index]) || 0) / 100);
    }
    return output;
  }, [rates, values.sales]);

  const totalConversion = computedValues[0] > 0
    ? (computedValues[computedValues.length - 1] / computedValues[0]) * 100
    : 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("Salvando projeção…");
    const payload = Object.fromEntries(
      stages.map(({ key }, index) => [key, Math.round(computedValues[index])]),
    );
    const response = await fetch("/api/settings/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        rates: rates.map((rate) => Number(rate) || 0),
        broker_minimums: Object.fromEntries(brokerMinimumFields.map(({ key }) => [key, Number(brokerMinimums[key]) || 0])),
        broker_weekly_targets: {
          appointments: Number(brokerWeeklyTargets.appointments) || 0,
          visits: Number(brokerWeeklyTargets.visits) || 0,
        },
        productive_team_targets: Object.fromEntries(productiveMetrics.map(({ key }) => [key, Number(productiveTeamTargets[key]) || 0])),
      }),
    });
    setSaving(false);
    if (response.ok) {
      const saved = await response.json();
      setUpdatedAt(saved.updated_at ?? new Date().toISOString());
      setMessage("Projeção salva. Dashboard atualizado com novos parâmetros.");
    } else {
      setMessage("Falha ao salvar metas.");
    }
  }

  return (
    <main className="goal-page-shell">
      <header className="goal-page-topbar">
        <a className="goal-brand" href="/" aria-label="Voltar ao Dashboard">
          <span>D</span>
          <div><strong>Descomplica</strong><small>Inteligência comercial</small></div>
        </a>
        <SiteMenu />
      </header>

      <section className="goal-page-hero">
        <div>
          <p className="goal-kicker">Planejamento comercial</p>
          <h1>Estúdio de metas</h1>
          <p>Defina conversões. Sistema calcula volume necessário em cada etapa.</p>
        </div>
        <div className="goal-hero-status">
          <span className="goal-live-dot" />
          <div><small>Projeção ativa</small><strong>Meta mensal</strong></div>
        </div>
      </section>

      <form className="goal-studio" onSubmit={save}>
        <aside className="goal-panel goal-controls-panel">
          <header><span>01</span><div><p>Indicadores</p><h2>Conversões desejadas</h2></div></header>
          <p className="goal-panel-note">Percentuais multiplicam resultado da etapa seguinte.</p>
          <div className="goal-rate-list">
            {stages.slice(0, -1).map((stage, index) => (
              <label className="goal-rate-card" key={stage.key}>
                <span className="goal-rate-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="goal-rate-copy">
                  <strong>{stage.short}</strong>
                  <small>sobre {stages[index + 1].short.toLowerCase()}</small>
                </span>
                <span className="goal-rate-input">
                  <input
                    aria-label={`Percentual de ${stage.label}`}
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    value={rates[index]}
                    placeholder="0"
                    onChange={(event) => setRates((current) =>
                      current.map((rate, rateIndex) =>
                        rateIndex === index
                          ? event.target.value === "" ? "" : Number(event.target.value)
                          : rate,
                      ))}
                  />
                  <b>%</b>
                </span>
              </label>
            ))}
          </div>
        </aside>

        <section className="goal-panel goal-preview-panel">
          <header><span>02</span><div><p>Resultado automático</p><h2>Funil projetado</h2></div></header>
          <div className="goal-premium-funnel">
            {stages.map((stage, index) => (
              <div
                className="goal-premium-stage"
                key={stage.key}
                style={{ "--stage-color": stage.color } as React.CSSProperties}
              >
                <span>{stage.label}</span>
                {index === stages.length - 1 ? (
                  <input
                    aria-label="Meta de vendas"
                    type="number"
                    min="0"
                    step="1"
                    value={values.sales}
                    placeholder="0"
                    onChange={(event) => setValues((current) => ({
                      ...current,
                      sales: event.target.value === "" ? "" : Number(event.target.value),
                    }))}
                  />
                ) : (
                  <output>{formatWhole(computedValues[index])}</output>
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="goal-panel goal-summary-panel">
          <header><span>03</span><div><p>Leitura rápida</p><h2>Resumo executivo</h2></div></header>
          <div className="goal-summary-spotlight">
            <small>Meta de vendas</small>
            <strong>{formatWhole(computedValues[5])}</strong>
            <span>unidades no mês</span>
          </div>
          <div className="goal-summary-grid">
            <div><small>Oportunidades</small><strong>{formatWhole(computedValues[0])}</strong></div>
            <div><small>Conversão total</small><strong>{totalConversion.toFixed(1).replace(".", ",")}%</strong></div>
            <div><small>Agendamentos</small><strong>{formatWhole(computedValues[1])}</strong></div>
            <div><small>Pastas aprovadas</small><strong>{formatWhole(computedValues[4])}</strong></div>
          </div>
          <div className="goal-formula-note">
            <strong>Lógica Planilha3</strong>
            <span>Venda vira base. Cada percentual projeta etapa anterior.</span>
          </div>
          <button className="goal-save-button" type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar e aplicar no Dashboard"}
          </button>
          <p className="goal-save-message" role="status">{message}</p>
          {updatedAt ? <small className="goal-updated-at">Última alteração: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(updatedAt))}</small> : null}
        </aside>

        <section className="goal-panel goal-productivity-panel">
          <header><span>04</span><div><p>Gestão de equipe</p><h2>Meta mínima por gerente</h2></div></header>
          <p className="goal-panel-note">Quantidade mínima de corretores ativos sob cada gerente, por tempo de casa.</p>
          <div className="goal-productivity-layout">
            <div className="goal-productivity-block">
              <div className="goal-productivity-block-heading"><strong>Corretores por gerente</strong><small>Meta mensal editável</small></div>
              <div className="goal-productivity-fields">
                {brokerMinimumFields.map(({ key, label }) => (
                  <label className="goal-productivity-field" key={key}>
                    <span>{label}</span>
                    <input
                      aria-label={`Meta mínima de corretores no ${label}`}
                      type="number"
                      min="0"
                      step="1"
                      value={brokerMinimums[key]}
                      onChange={(event) => setBrokerMinimums((current) => ({ ...current, [key]: event.target.value === "" ? "" : Number(event.target.value) }))}
                    />
                    <small>corretores</small>
                  </label>
                ))}
              </div>
            </div>
            <div className="goal-productivity-block">
              <div className="goal-productivity-block-heading"><strong>Por corretor</strong><small>Meta semanal editável</small></div>
              <div className="goal-productivity-fields goal-productivity-fields-two">
                <label className="goal-productivity-field">
                  <span>Agendamentos</span>
                  <input aria-label="Agendamentos por corretor por semana" type="number" min="0" step="1" value={brokerWeeklyTargets.appointments} onChange={(event) => setBrokerWeeklyTargets((current) => ({ ...current, appointments: event.target.value === "" ? "" : Number(event.target.value) }))} />
                  <small>por semana</small>
                </label>
                <label className="goal-productivity-field">
                  <span>Visitas</span>
                  <input aria-label="Visitas por corretor por semana" type="number" min="0" step="1" value={brokerWeeklyTargets.visits} onChange={(event) => setBrokerWeeklyTargets((current) => ({ ...current, visits: event.target.value === "" ? "" : Number(event.target.value) }))} />
                  <small>por semana</small>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="goal-panel goal-calendar-panel">
          <header><span>05</span><div><p>Cadência comercial</p><h2>Dias úteis e produtividade</h2></div></header>
          <div className="goal-calendar-layout">
            <div className="goal-calendar-card">
              <div className="goal-calendar-heading"><div><strong>{monthLabel}</strong><small>Segunda a sexta contam como dia útil</small></div><span>{businessDays} dias úteis</span></div>
              <div className="goal-calendar-week"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
              <div className="goal-calendar-grid">
                {calendar.map((item, index) => item ? <span className={`${item.business ? "business" : "weekend"} ${item.today ? "today" : ""}`} key={item.day}>{item.day}</span> : <i aria-hidden="true" key={`blank-${index}`} />)}
              </div>
            </div>
            <div className="goal-calendar-insights">
              <div><small>Dias úteis no mês</small><strong>{businessDays}</strong><span>base da meta mensal</span></div>
              <div><small>Dias já passados</small><strong>{businessDaysElapsed}</strong><span>{businessDaysRemaining} restantes</span></div>
              <div className="goal-calendar-rule"><small>Meta de agendamentos</small><strong>1 por dia útil / corretor</strong><span>{businessDays} agendamentos por corretor no mês</span></div>
            </div>
          </div>
        </section>

        <section className="goal-panel goal-productive-panel">
          <header><span>06</span><div><p>Indicador de equipe</p><h2>Equipe produtiva</h2></div></header>
          <p className="goal-panel-note">Defina o percentual mínimo de equipe produtiva esperado em cada etapa.</p>
          <div className="goal-productive-grid">
            {productiveMetrics.map(({ key, label, color }) => {
              const value = Number(productiveTeamTargets[key]) || 0;
              return <label className="goal-productive-card" key={key} style={{ "--productive-color": color } as React.CSSProperties}>
                <div className="goal-donut" style={{ "--productive-rate": `${Math.min(value, 100)}%` } as React.CSSProperties}><div><strong>{formatWhole(value)}%</strong><span>equipe produtiva</span></div></div>
                <span className="goal-productive-label">{label}</span>
                <div className="goal-productive-input"><input aria-label={`${label} da equipe produtiva`} type="number" min="0" max="100" step="1" value={productiveTeamTargets[key]} onChange={(event) => setProductiveTeamTargets((current) => ({ ...current, [key]: event.target.value === "" ? "" : Number(event.target.value) }))} /><b>%</b></div>
              </label>;
            })}
          </div>
        </section>
      </form>
    </main>
  );
}
