"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation matches existing Vinext routes. */

import { useEffect, useMemo, useState } from "react";
import { SiteMenu } from "./SiteMenu";

const stages = [
  { key: "opportunities", label: "Oportunidades", short: "Oportunidade", color: "#173b68", text: "#ffffff" },
  { key: "appointments", label: "Agendamentos", short: "Agendamento", color: "#155e75", text: "#ffffff" },
  { key: "visits", label: "Visitas", short: "Visita", color: "#0e7490", text: "#ffffff" },
  { key: "folders", label: "Pastas", short: "Pasta", color: "#0891b2", text: "#ffffff" },
  { key: "approved_folders", label: "Pastas aprovadas", short: "Pasta aprovada", color: "#0f766e", text: "#ffffff" },
  { key: "sales", label: "Vendas", short: "Venda", color: "#059669", text: "#ffffff" },
] as const;
const goalStageWidths = [100, 90, 80, 70, 60, 50] as const;

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
  { key: "appointments", label: "Agendamentos", color: "#20b9c3" },
  { key: "visits", label: "Visitas", color: "#f2c94c" },
  { key: "folders", label: "Pastas", color: "#42d995" },
  { key: "sales", label: "Vendas", color: "#4386ef" },
] as const;
type ProductiveTeamTargets = Record<(typeof productiveMetrics)[number]["key"], number | "">;
const formatWhole = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));
const formatRatio = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function buildMonthCalendar(reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  return Array.from({ length: leading + totalDays }, (_, index) => {
    if (index < leading) return null;
    const day = index - leading + 1;
    const date = new Date(year, month, day);
    return { day, business: isBusinessDay(date), elapsed: date <= reference, today: date.toDateString() === reference.toDateString() };
  });
}

function buildWeekBuckets(reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const mondayOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const firstMonday = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(firstMonday);
    start.setDate(firstMonday.getDate() + index * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const daysInMonth = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + dayIndex);
      return date;
    }).filter((date) => date >= first && date <= last);
    if (daysInMonth.length === 0) return null;
    return {
      label: `${index + 1}ª semana`,
      range: `${daysInMonth[0].getDate()}–${daysInMonth[daysInMonth.length - 1].getDate()}`,
      businessDays: daysInMonth.filter(isBusinessDay).length,
      current: daysInMonth.some((date) => date.toDateString() === reference.toDateString()),
    };
  }).filter((week): week is { label: string; range: string; businessDays: number; current: boolean } => week !== null);
}

function allocateWeekly(total: number, weights: number[]) {
  const roundedTotal = Math.max(Math.round(total), 0);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (roundedTotal === 0 || weightTotal === 0) return weights.map(() => 0);
  const raw = weights.map((weight) => roundedTotal * weight / weightTotal);
  const result = raw.map(Math.floor);
  let remaining = roundedTotal - result.reduce((sum, value) => sum + value, 0);
  raw.map((value, index) => ({ index, remainder: value - result[index] }))
    .sort((left, right) => right.remainder - left.remainder)
    .forEach(({ index }) => {
      if (remaining > 0) {
        result[index] += 1;
        remaining -= 1;
      }
    });
  return result;
}

function buildSequentialWeekly(monthlyValues: number[], weights: number[]) {
  const monthly = monthlyValues.map((value) => Math.max(Math.round(value), 0));
  const weekly = monthly.map(() => weights.map(() => 0));
  if (monthly.length === 0 || weights.length === 0) return weekly;

  weekly[0] = allocateWeekly(monthly[0], weights);

  for (let stageIndex = 1; stageIndex < monthly.length; stageIndex += 1) {
    const previousTarget = monthly[stageIndex - 1];
    const currentTarget = monthly[stageIndex];
    let previousCumulative = 0;
    let currentCumulative = 0;

    for (let weekIndex = 0; weekIndex < weights.length; weekIndex += 1) {
      previousCumulative += weekly[stageIndex - 1][weekIndex];
      const supportedCumulative = previousTarget > 0
        ? Math.min(currentTarget, Math.floor((previousCumulative * currentTarget) / previousTarget + Number.EPSILON))
        : 0;
      const nextCumulative = weekIndex === weights.length - 1 && previousCumulative >= previousTarget
        ? currentTarget
        : supportedCumulative;

      weekly[stageIndex][weekIndex] = Math.max(nextCumulative - currentCumulative, 0);
      currentCumulative = nextCumulative;
    }
  }

  return weekly;
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
  const computedValues = useMemo(() => {
    const output = Array<number>(stages.length).fill(0);
    output[stages.length - 1] = Number(values.sales) || 0;
    for (let index = stages.length - 2; index >= 0; index -= 1) {
      output[index] = output[index + 1] * ((Number(rates[index]) || 0) / 100);
    }
    return output;
  }, [rates, values.sales]);
  const displayedValues = useMemo(
    () => computedValues.map((value) => Math.max(Math.round(value), 0)),
    [computedValues],
  );
  const weekBuckets = useMemo(() => buildWeekBuckets(today), [today]);
  const weeklyDistribution = useMemo(() => {
    const sequential = buildSequentialWeekly(computedValues, weekBuckets.map((week) => week.businessDays));
    return stages.map((stage, index) => {
      let cumulative = 0;
      return {
        ...stage,
        monthly: Math.max(Math.round(computedValues[index]), 0),
        weekly: sequential[index].map((value) => {
          cumulative += value;
          return { value, cumulative };
        }),
      };
    });
  }, [computedValues, weekBuckets]);

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
      .catch(() => setMessage("Não foi possível carregar as metas. Atualize a página e tente novamente."));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("Salvando metas…");
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
      setMessage("Metas salvas. O painel já usa os novos valores.");
    } else {
      setMessage("Não foi possível salvar. Tente novamente.");
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
          <p className="goal-kicker">Metas comerciais</p>
          <h1>Planejamento de metas</h1>
        </div>
        <div className="goal-hero-actions">
          <button className="goal-save-button" type="submit" form="goal-settings-form" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <p className="goal-save-message" role="status">{message}</p>
          {updatedAt ? <small className="goal-updated-at">Salvo em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(updatedAt))}</small> : null}
        </div>
      </section>

      <form id="goal-settings-form" className="goal-studio" onSubmit={save}>
        <aside className="goal-panel goal-controls-panel">
          <header><span>01</span><div><p>Configuração</p><h2>Volume necessário por etapa</h2></div></header>
          <p className="goal-panel-note">Informe quantas vezes uma etapa precisa ser maior que a etapa seguinte.</p>
          <div className="goal-rate-list">
            {stages.slice(0, -1).map((stage, index) => (
              <label className="goal-rate-card" key={stage.key}>
                <span className="goal-rate-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="goal-rate-copy">
                  <strong>{stage.short}</strong>
                  <small>para cada {stages[index + 1].short.toLowerCase()}</small>
                  <em>{Number(rates[index]) > 0 ? `≈ ${formatRatio(Number(rates[index]))} para 1` : "Informe o percentual"}</em>
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
          <div className="goal-sales-target">
            <div><strong>Meta de vendas</strong><small>Total desejado no mês</small></div>
            <label className="goal-sales-input">
              <input
                aria-label="Meta mensal de vendas"
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
              <span>vendas</span>
            </label>
          </div>
        </aside>

        <section className="goal-panel goal-preview-panel">
          <header><span>02</span><div><p>Projeção calculada</p><h2>Funil da meta</h2></div></header>
          <div className="goal-premium-funnel">
            {stages.map((stage, index) => {
              const currentValue = displayedValues[index];
              return <div
                className="goal-premium-step"
                key={stage.key}
                style={{ "--stage-width": `${goalStageWidths[index]}%` } as React.CSSProperties}
              >
                <div className="goal-premium-stage" style={{ "--stage-color": stage.color, "--stage-text": stage.text } as React.CSSProperties}>
                  <span>{stage.label}</span>
                  <output>{formatWhole(currentValue)}</output>
                </div>
              </div>;
            })}
          </div>
        </section>

        <section className="goal-panel goal-conversion-panel">
          <header><span>03</span><div><p>Análise</p><h2>Conversões do funil</h2></div><small className="goal-weekly-context">Etapa a etapa</small></header>
          <p className="goal-panel-note">Compare o avanço para a próxima etapa e o resultado até a venda.</p>
          <div className="goal-conversion-table" role="table" aria-label="Conversões entre etapas e até vendas">
            <div className="goal-conversion-row goal-conversion-head" role="row"><span role="columnheader">Etapa</span><span role="columnheader">Próxima etapa</span><span role="columnheader">Até a venda</span></div>
            {stages.slice(0, -1).map((stage, index) => {
              const currentValue = displayedValues[index];
              const nextValue = displayedValues[index + 1];
              const nextConversion = currentValue > 0 ? (nextValue / currentValue) * 100 : 0;
              const salesConversion = currentValue > 0 ? (displayedValues[displayedValues.length - 1] / currentValue) * 100 : 0;
              return <div className="goal-conversion-row" role="row" key={stage.key}>
                <span className="goal-conversion-stage" role="rowheader"><i style={{ background: stage.color }} />{stage.short}</span>
                <span className="goal-conversion-cell" role="cell"><small>{stage.short} → {stages[index + 1].short}</small><b>{formatWhole(currentValue)} → {formatWhole(nextValue)}</b><strong>{nextConversion.toFixed(1).replace(".", ",")}%</strong></span>
                <span className="goal-conversion-cell goal-conversion-sales" role="cell"><small>{stage.short} → Venda</small><b>{formatWhole(currentValue)} → {formatWhole(displayedValues[displayedValues.length - 1])}</b><strong>{salesConversion.toFixed(1).replace(".", ",")}%</strong></span>
              </div>;
            })}
          </div>
        </section>

        <section className="goal-panel goal-weekly-panel">
          <header><span>04</span><div><p>Metas semanais</p><h2>Acompanhamento por semana</h2></div><small className="goal-weekly-context">6 etapas · metas acumuladas</small></header>
          <p className="goal-panel-note">Cada coluna mostra a meta acumulada até o fim da semana. O valor menor indica quanto produzir naquela semana.</p>
          <div className="goal-weekly-distribution" role="table" aria-label="Rota acumulada semanal das metas do funil" style={{ "--week-count": weekBuckets.length } as React.CSSProperties}>
            <div className="goal-weekly-table-row goal-weekly-table-head" role="row"><span role="columnheader">Etapa</span>{weekBuckets.map((week) => <span className={week.current ? "current" : ""} role="columnheader" key={week.label}>{week.label}<small>{week.range}</small>{week.current ? <em>Agora</em> : null}</span>)}</div>
            {weeklyDistribution.map((stage) => <div className="goal-weekly-table-row" role="row" key={stage.key}>
              <span className="goal-weekly-stage" role="rowheader"><i style={{ background: stage.color }} />{stage.label}<small>{formatWhole(stage.monthly)} no mês</small></span>
              {stage.weekly.map((week, index) => <strong className={weekBuckets[index]?.current ? "current" : ""} role="cell" key={`${stage.key}-${index}`}><b>{formatWhole(week.cumulative)}</b><small>+{formatWhole(week.value)} na semana</small></strong>)}
            </div>)}
          </div>
          <div className="goal-weekly-legend"><span>Valor principal = meta acumulada · +N = meta da semana</span><strong>Cada etapa respeita o volume da etapa anterior</strong></div>
        </section>

        <section className="goal-panel goal-productivity-panel">
          <header><span>05</span><div><p>Equipe de vendas</p><h2>Corretores por gerente</h2></div></header>
          <p className="goal-panel-note">Defina quantos corretores cada gerente deve manter ativos, conforme o tempo de casa.</p>
          <div className="goal-productivity-layout">
            <div className="goal-productivity-block">
              <div className="goal-productivity-block-heading"><strong>Meta por tempo de casa</strong><small>corretores por gerente</small></div>
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
              <div className="goal-productivity-block-heading"><strong>Produção por corretor</strong><small>meta semanal</small></div>
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
          <header><span>06</span><div><p>Calendário do mês</p><h2>Dias úteis estimados</h2></div></header>
          <div className="goal-calendar-layout">
            <div className="goal-calendar-card">
              <div className="goal-calendar-heading"><div><strong>{monthLabel}</strong><small>Segunda a sexta · feriados não descontados</small></div><span>{businessDays} dias úteis</span></div>
              <div className="goal-calendar-week"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>
              <div className="goal-calendar-grid">
                {calendar.map((item, index) => item ? <span className={`${item.business ? "business" : "weekend"} ${item.today ? "today" : ""}`} key={item.day}>{item.day}</span> : <i aria-hidden="true" key={`blank-${index}`} />)}
              </div>
            </div>
            <div className="goal-calendar-insights">
              <div><small>Total de dias úteis</small><strong>{businessDays}</strong><span>no mês atual</span></div>
              <div><small>Dias úteis passados</small><strong>{businessDaysElapsed}</strong><span>{businessDaysRemaining} restantes</span></div>
              <div className="goal-calendar-rule"><small>Ritmo por corretor</small><strong>1 por dia útil</strong><span>{businessDays} agendamentos no mês</span></div>
            </div>
          </div>
        </section>

        <section className="goal-panel goal-productive-panel">
          <header><span>07</span><div><p>Produtividade</p><h2>Equipe que deve atingir a meta</h2></div></header>
          <p className="goal-panel-note">Defina a porcentagem mínima da equipe que deve atingir cada meta.</p>
          <div className="goal-productive-grid">
            {productiveMetrics.map(({ key, label, color }) => {
              const value = Number(productiveTeamTargets[key]) || 0;
              return <label className="goal-productive-card" key={key} style={{ "--productive-color": color } as React.CSSProperties}>
                <span className="goal-productive-label">{label}</span>
                <div className="goal-donut" style={{ "--productive-rate": `${Math.min(value, 100)}%` } as React.CSSProperties}><div><strong>{formatWhole(value)}%</strong><span>da equipe</span></div></div>
                <div className="goal-productive-target">
                  <small>Meta mínima</small>
                  <div className="goal-productive-input"><input aria-label={`${label} da equipe produtiva`} type="number" min="0" max="100" step="1" value={productiveTeamTargets[key]} onChange={(event) => setProductiveTeamTargets((current) => ({ ...current, [key]: event.target.value === "" ? "" : Number(event.target.value) }))} /><b>%</b></div>
                </div>
              </label>;
            })}
          </div>
        </section>

      </form>
    </main>
  );
}
