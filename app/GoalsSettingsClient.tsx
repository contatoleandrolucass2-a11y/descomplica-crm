"use client";
import { useEffect, useMemo, useState } from "react";
import { SiteMenu } from "./SiteMenu";

const stages = [
  { key: "opportunities", label: "Oportunidades", color: "#ff3f68" },
  { key: "appointments", label: "Agendamentos", color: "#ffab3d" },
  { key: "visits", label: "Visitas", color: "#f4df27" },
  { key: "folders", label: "Pastas", color: "#38c7d8" },
  { key: "approved_folders", label: "Pasta aprovada", color: "#36d68d" },
  { key: "sales", label: "Vendas", color: "#21a6e0" },
] as const;
type Values = Record<(typeof stages)[number]["key"], number | "">;

export function GoalsSettingsClient() {
  const [values, setValues] = useState<Values>(Object.fromEntries(stages.map(({ key }) => [key, ""])) as Values);
  const [rates, setRates] = useState<Array<number | "">>(["", "", "", "", ""]);
  const [message, setMessage] = useState("Carregando metas atuais…");
  useEffect(() => { fetch("/api/settings/goals", { cache: "no-store" }).then((r) => r.json()).then((row) => { if (row) { const loaded = Object.fromEntries(stages.map(({ key }) => [key, Number.isFinite(Number(row[key])) ? Number(row[key]) : ""])) as Values; setValues(loaded); setRates(stages.slice(0, -1).map((stage, index) => { const lower = Number(loaded[stages[index + 1].key]); const current = Number(loaded[stage.key]); return lower > 0 ? Number(((current / lower) * 100).toFixed(1)) : ""; })); } setMessage(""); }).catch(() => setMessage("Não foi possível carregar as metas.")); }, []);
  const computedValues = useMemo(() => { const output = Array<number>(stages.length).fill(0); output[stages.length - 1] = Number(values.sales) || 0; for (let i = stages.length - 2; i >= 0; i -= 1) output[i] = output[i + 1] * ((Number(rates[i]) || 0) / 100); return output; }, [rates, values.sales]);
  async function save(event: React.FormEvent) { event.preventDefault(); setMessage("Salvando…"); const payload = Object.fromEntries(stages.map(({ key }, index) => [key, Number(computedValues[index].toFixed(1))])); const response = await fetch("/api/settings/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); setMessage(response.ok ? "Metas salvas. O Dashboard já usará esta projeção." : "Falha ao salvar metas."); }
  return <main className="settings-shell"><SiteMenu /><section className="goal-settings-card"><div className="goal-settings-intro"><p className="eyebrow">Configurações / Metas</p><h1>Distribuição da meta</h1><p>Venda é a base. Edite os percentuais; os resultados sobem automaticamente, como na Planilha3.</p></div><form className="goal-funnel" onSubmit={save}><div className="goal-funnel-side" aria-label="Percentuais editáveis">{stages.map((stage, index) => <div className="goal-conversion" key={stage.key}>{index === stages.length - 1 ? <span className="goal-conversion-muted">Base da meta</span> : <><span>{stage.label} → {stages[index + 1].label}</span><label className="percent-editor"><input aria-label={`Percentual de ${stage.label}`} type="number" min="0" max="10000" step="0.1" value={rates[index]} placeholder="0" onChange={(e) => setRates((current) => current.map((rate, i) => i === index ? (e.target.value === "" ? "" : Number(e.target.value)) : rate))} />%</label></>}</div>)}</div><div className="goal-funnel-visual">{stages.map((stage, index) => <label key={stage.key} className="goal-stage" style={{ "--goal-color": stage.color } as React.CSSProperties}><span>{stage.label}</span>{index === stages.length - 1 ? <input aria-label="Meta de vendas" type="number" min="0" step="0.1" value={values.sales} placeholder="0" onChange={(e) => setValues((current) => ({ ...current, sales: e.target.value === "" ? "" : Number(e.target.value) }))} /> : <output>{computedValues[index].toFixed(1).replace(".", ",")}</output>}</label>)}<button className="primary-link" type="submit">Salvar projeção</button><p className="settings-message" role="status">{message}</p></div></form></section></main>;
}
