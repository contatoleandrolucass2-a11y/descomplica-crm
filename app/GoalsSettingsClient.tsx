"use client";
import { useEffect, useMemo, useState } from "react";
import { SiteMenu } from "./SiteMenu";

const stages = [
  { key: "opportunities", label: "Oportunidades", color: "#ff3f68" },
  { key: "appointments", label: "Agendamentos", color: "#ffab3d" },
  { key: "visits", label: "Visitas", color: "#f4df27" },
  { key: "folders", label: "Pastas", color: "#38c7d8" },
  { key: "sales", label: "Vendas", color: "#21c97b" },
] as const;

type Values = Record<(typeof stages)[number]["key"], number | "">;

export function GoalsSettingsClient() {
  const [values, setValues] = useState<Values>({ opportunities: "", appointments: "", visits: "", folders: "", sales: "" });
  const [message, setMessage] = useState("Carregando metas atuais…");

  useEffect(() => {
    fetch("/api/settings/goals", { cache: "no-store" }).then((response) => response.json()).then((row) => {
      if (row) setValues((current) => Object.fromEntries(stages.map(({ key }) => [key, Number.isFinite(Number(row[key])) ? Number(row[key]) : current[key]])) as Values);
      setMessage("");
    }).catch(() => setMessage("Não foi possível carregar as metas."));
  }, []);

  const conversions = useMemo(() => stages.map((stage, index) => {
    if (index === 0) return null;
    const from = Number(values[stages[index - 1].key]); const to = Number(values[stage.key]);
    return from > 0 && to >= 0 ? (to / from) * 100 : null;
  }), [values]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage("Salvando…");
    const payload = Object.fromEntries(stages.map(({ key }) => [key, Number(values[key]) || 0]));
    const response = await fetch("/api/settings/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setMessage(response.ok ? "Metas salvas. O Dashboard já usará esta projeção." : "Falha ao salvar metas.");
  }

  return <main className="settings-shell"><SiteMenu /><section className="goal-settings-card"><div className="goal-settings-intro"><p className="eyebrow">Configurações / Metas</p><h1>Meta projetada deste mês</h1><p>Edite os volumes esperados em cada etapa. As conversões são calculadas automaticamente.</p></div><form className="goal-funnel" onSubmit={save}><div className="goal-funnel-side" aria-label="Conversões entre etapas">{stages.map((stage, index) => <div className="goal-conversion" key={stage.key}>{index === 0 ? <span className="goal-conversion-muted">Base da projeção</span> : <><span>{stages[index - 1].label} → {stage.label}</span><strong>{conversions[index] === null ? "—" : `${conversions[index]!.toFixed(1).replace(".", ",")}%`}</strong></>}</div>)}</div><div className="goal-funnel-visual">{stages.map((stage) => <label key={stage.key} className="goal-stage" style={{ "--goal-color": stage.color } as React.CSSProperties}><span>{stage.label}</span><input aria-label={`Meta de ${stage.label}`} type="number" min="0" step="0.1" value={values[stage.key]} placeholder="—" onChange={(event) => setValues((current) => ({ ...current, [stage.key]: event.target.value === "" ? "" : Number(event.target.value) }))} /></label>)}<button className="primary-link" type="submit">Salvar projeção</button><p className="settings-message" role="status">{message}</p></div></form></section></main>;
}
