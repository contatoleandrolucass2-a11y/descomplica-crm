"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation matches existing Vinext routes. */

import { useEffect, useMemo, useState } from "react";
import { SiteMenu } from "./SiteMenu";

const metrics = [
  { key: "roulette", label: "Roleta", short: "R", color: "#2563eb" },
  { key: "schedule", label: "Agenda", short: "A", color: "#0e7490" },
  { key: "visit", label: "Visita", short: "V", color: "#eab308" },
  { key: "approvedFolder", label: "Pasta aprovada", short: "P", color: "#14b8a6" },
  { key: "sale", label: "Venda", short: "V", color: "#059669" },
] as const;

type MetricKey = (typeof metrics)[number]["key"];
type MetricValues = Record<MetricKey, number | "">;

const defaultWeights: MetricValues = { roulette: 1, schedule: 1, visit: 7, approvedFolder: 4, sale: 10 };
const defaultTargets: MetricValues = { roulette: 0, schedule: 0, visit: 0, approvedFolder: 0, sale: 0 };
const formatWhole = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: value % 1 ? 1 : 0, maximumFractionDigits: 1 }).format(value);

const navigation = [
  { label: "Direcional Vendas", description: "Equipe interna", href: "/configuracoes/metas" },
  { label: "Canal Parcerias", description: "Imobiliárias parceiras", href: "/configuracoes/metas/parcerias" },
  { label: "Meta por pontos", description: "Pontuação comercial", href: "/configuracoes/metas/pontos", active: true },
];

export function PointsSettingsClient({
  conversionRate,
  appointments,
  visits,
  sourceUpdatedAt,
}: {
  conversionRate: number;
  appointments: number;
  visits: number;
  sourceUpdatedAt: string | null;
}) {
  const [weights, setWeights] = useState<MetricValues>(defaultWeights);
  const [message, setMessage] = useState("Carregando pontuação…");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/points", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("load_failed");
        return response.json();
      })
      .then((row) => {
        if (row?.weights) {
          setWeights(Object.fromEntries(metrics.map(({ key }) => [key, Number(row.weights[key]) || 0])) as MetricValues);
        }
        setUpdatedAt(row?.updated_at ?? null);
        setMessage("");
      })
      .catch(() => setMessage("Valores padrão em uso. Salve para registrar sua configuração."));
  }, []);

  const basePoints = useMemo(
    () => metrics.reduce((total, { key }) => total + (Number(weights[key]) || 0), 0),
    [weights],
  );
  const conversionBonus = Math.floor(basePoints * conversionRate);
  const finalResult = basePoints + conversionBonus;
  const conversionPercent = conversionRate * 100;

  function changeValue(setter: React.Dispatch<React.SetStateAction<MetricValues>>, key: MetricKey, value: string) {
    setter((current) => ({ ...current, [key]: value === "" ? "" : Math.max(Math.floor(Number(value) || 0), 0) }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("Salvando pontuação…");
    const response = await fetch("/api/settings/points", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        weights: Object.fromEntries(metrics.map(({ key }) => [key, Number(weights[key]) || 0])),
        targets: defaultTargets,
      }),
    });
    setSaving(false);
    if (response.ok) {
      const saved = await response.json();
      setUpdatedAt(saved.updated_at ?? new Date().toISOString());
      setMessage("Pontuação salva e pronta para uso.");
    } else {
      setMessage("Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <main className="goal-page-shell points-page-shell">
      <header className="goal-page-topbar">
        <a className="goal-brand" href="/" aria-label="Voltar ao Dashboard">
          <span>D</span>
          <div><strong>Descomplica</strong><small>Inteligência comercial</small></div>
        </a>
        <SiteMenu />
      </header>

      <section className="goal-page-hero points-page-hero">
        <div className="goal-hero-copy">
          <p className="goal-kicker">Metas comerciais</p>
          <h1>Meta por pontos</h1>
        </div>
        <div className="goal-command-center">
          <div className="goal-channel-switcher">
            <div className="goal-channel-label"><small>Plano comercial</small><strong>Escolha a meta</strong></div>
            <nav className="goal-profile-tabs" aria-label="Selecionar tipo de meta">
              {navigation.map((item) => (
                <a className={item.active ? "active" : ""} href={item.href} aria-current={item.active ? "page" : undefined} key={item.href}>
                  <i aria-hidden="true" />
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </a>
              ))}
            </nav>
          </div>
          <div className="goal-hero-actions">
            <div className="goal-save-state"><i aria-hidden="true" /><div><p className="goal-save-message" role="status">{message}</p>{updatedAt ? <small className="goal-updated-at">Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(updatedAt))}</small> : null}</div></div>
            <button className="goal-save-button" type="submit" form="point-settings-form" disabled={saving}><span aria-hidden="true">{saving ? "…" : "✓"}</span>{saving ? "Salvando" : "Salvar"}</button>
          </div>
        </div>
      </section>

      <form id="point-settings-form" className="points-studio" onSubmit={save}>
        <section className="points-panel points-editor-panel">
          <header className="points-panel-heading"><span>01</span><div><p>Configuração</p><h2>Pontos por ação</h2></div><small>Clique e edite</small></header>
          <p className="points-panel-note">Edite livremente o valor de cada avanço comercial.</p>
          <div className="points-metric-list">
            {metrics.map((metric) => (
              <label className="points-metric-card" style={{ "--metric-color": metric.color } as React.CSSProperties} key={metric.key}>
                <i aria-hidden="true">{metric.short}</i><span><strong>{metric.label}</strong><small>pontos por registro</small></span>
                <span className="points-value-editor">
                  <input aria-label={`Pontos de ${metric.label}`} type="number" min="0" max="100000" step="1" value={weights[metric.key]} onChange={(event) => changeValue(setWeights, metric.key, event.target.value)} />
                  <b>pts</b>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="points-panel points-result-panel">
          <header className="points-panel-heading"><span>02</span><div><p>Cálculo automático</p><h2>Resultado</h2></div><small>Atualiza na hora</small></header>
          <div className="points-conversion-source">
            <div><span>Conversão Agendamento → Visita</span><strong>{formatPercent(conversionPercent)}%</strong></div>
            <small>{formatWhole(appointments)} agendamentos · {formatWhole(visits)} visitas{sourceUpdatedAt ? ` · dados de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(sourceUpdatedAt))}` : ""}</small>
          </div>
          <div className="points-equation" aria-label={`${basePoints} mais ${conversionBonus} igual a ${finalResult}`}>
            <div><span>Pontos-base</span><strong>{formatWhole(basePoints)}</strong></div><b aria-hidden="true">+</b>
            <div><span>Bônus da conversão</span><strong>{formatWhole(conversionBonus)}</strong><small>{formatWhole(basePoints)} × {formatPercent(conversionPercent)}%</small></div><b aria-hidden="true">=</b>
            <div className="points-equation-result"><span>Resultado final</span><output>{formatWhole(finalResult)}</output></div>
          </div>
          <div className="points-rounding-note"><i aria-hidden="true">↓</i><span>Resultado da conversão sempre arredondado para baixo, sem casas decimais.</span></div>
          <div className="points-score-band" style={{ "--base-width": `${Math.min((basePoints / Math.max(finalResult, 1)) * 100, 100)}%` } as React.CSSProperties}><span /><i /></div>
          <div className="points-result-breakdown"><span><i className="base" />Base {formatWhole(basePoints)}</span><span><i className="bonus" />Conversão +{formatWhole(conversionBonus)}</span></div>
        </section>
      </form>
    </main>
  );
}
