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
  const [rates, setRates] = useState<Array<number | "">>(["", "", "", ""]);
  const [message, setMessage] = useState("Carregando metas atuais…");
  useEffect(() => { fetch("/api/settings/goals", { cache: "no-store" }).then((r) => r.json()).then((row) => { if (row) { const loaded = Object.fromEntries(stages.map(({ key }) => [key, Number.isFinite(Number(row[key])) ? Number(row[key]) : ""])) as Values; setValues(loaded); setRates(stages.slice(1).map((stage, index) => { const from = Number(loaded[stages[index].key]); const to = Number(loaded[stage.key]); return from > 0 ? Number(((to / from) * 100).toFixed(1)) : ""; })); } setMessage(""); }).catch(() => setMessage("Não foi possível carregar as metas.")); }, []);
  const computedValues = useMemo(() => stages.map((stage, index) => index === 0 ? Number(values[stage.key]) || 0 : (Number(values[stages[index - 1].key]) || 0) * ((Number(rates[index - 1]) || 0) / 100)), [rates, values]);
  async function save(event: React.FormEvent) { event.preventDefault(); setMessage("Salvando…"); const payload = Object.fromEntries(stages.map(({ key }, index) => [key, Number(computedValues[index].toFixed(1))])); const response = await fetch("/api/settings/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); setMessage(response.ok ? "Metas salvas. O Dashboard já usará esta projeção." : "Falha ao salvar metas."); }
  return <main className="settings-shell"><SiteMenu /><section className="goal-settings-card"><div className="goal-settings-intro"><p className="eyebrow">Configurações / Metas</p><h1>Meta projetada deste mês</h1><p>Edite a base e os percentuais. Os resultados são calculados automaticamente.</p></div><form className="goal-funnel" onSubmit={save}><div className="goal-funnel-side" aria-label="Percentuais editáveis">{stages.map((stage, index) => <div className="goal-conversion" key={stage.key}>{index === 0 ? <span className="goal-conversion-muted">Base da projeção</span> : <><span>{stages[index - 1].label} → {stage.label}</span><label className="percent-editor"><input aria-label={`Percentual de ${stages[index - 1].label} para ${stage.label}`} type="number" min="0" max="1000" step="0.1" value={rates[index - 1]} placeholder="0" onChange={(e) => setRates((current) => current.map((rate, i) => i === index - 1 ? (e.target.value === "" ? "" : Number(e.target.value)) : rate))} />%</label></>}</div>)}</div><div className="goal-funnel-visual">{stages.map((stage, index) => <label key={stage.key} className="goal-stage" style={{ "--goal-color": stage.color } as React.CSSProperties}><span>{stage.label}</span>{index === 0 ? <input aria-label="Base de oportunidades" type="number" min="0" step="0.1" value={values[stage.key]} placeholder="0" onChange={(e) => setValues((current) => ({ ...current, [stage.key]: e.target.value === "" ? "" : Number(e.target.value) }))} /> : <output>{computedValues[index].toFixed(1).replace(".", ",")}</output>}</label>)}<button className="primary-link" type="submit">Salvar projeção</button><p className="settings-message" role="status">{message}</p></div></form></section></main>;
}
