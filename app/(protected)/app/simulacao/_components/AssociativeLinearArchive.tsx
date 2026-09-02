"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import {
  calculateAssociativeLinearArchive,
  type AssociativeLinearArchiveResult,
  type AssociativeLinearForm,
} from "@/lib/crm/simulators/associative-linear-archive";

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const initialForm: AssociativeLinearForm = {
  development: "", product: "", stockMatch: false, policyConfirmed: false,
  policyLimit: "84", installments: "84", entryDate: todayIso(), constructionEnd: "",
  salePrice: "", bonus: "0", discount: "0", financing: "", subsidy: "0", fgts: "0",
  housingCheck: "0", entry: "", signal1: "0", signal2: "0", signal3: "0",
  annual1: "0", annual2: "0", annual3: "0", annual4: "0", annual5: "0",
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const annualKeys = ["annual1", "annual2", "annual3", "annual4", "annual5"] as const;

function formatDate(value: string) {
  return value ? date.format(new Date(`${value}T00:00:00.000Z`)) : "—";
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>{label}
      <span className="doccalc-money-input"><b>R$</b><input type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0,00" /></span>
    </label>
  );
}

function AuditList({ audit }: { audit: AssociativeLinearArchiveResult["audit"] }) {
  return <details className="doccalc-audit"><summary>Ver auditoria do cálculo</summary><ul>{audit.map((item) => <li key={item.label} className={item.ok ? "ok" : "error"}><span aria-hidden="true">{item.ok ? "✓" : "×"}</span>{item.label}</li>)}</ul></details>;
}

function AssociativeLinearCalculator({ executionEnabled }: { executionEnabled: boolean }) {
  const [form, setForm] = useState(initialForm);
  const [calculated, setCalculated] = useState(false);
  const result = useMemo(() => calculateAssociativeLinearArchive(form), [form]);

  function update<Key extends keyof AssociativeLinearForm>(key: Key, value: AssociativeLinearForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!executionEnabled) return;
    setCalculated(true);
    requestAnimationFrame(() => document.querySelector("#resultado-fluxo-linear")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  }

  return (
    <div className="linearcalc-layout">
      <form className="doccalc-form linearcalc-form" onSubmit={submit} noValidate>
        <header><span>13</span><div><p>WF-13 • motor homologado</p><h2>Entradas do fluxo linear</h2></div></header>

        <fieldset className="linearcalc-fieldset">
          <legend>1. Contexto oficial</legend>
          <div className="doccalc-grid">
            <label>Empreendimento<input value={form.development} onChange={(event) => update("development", event.target.value)} placeholder="Nome completo na fonte oficial" /></label>
            <label>Produto / unidade<input value={form.product} onChange={(event) => update("product", event.target.value)} placeholder="Produto exato do estoque" /></label>
          </div>
          <label className="doccalc-check"><input type="checkbox" checked={form.stockMatch} onChange={(event) => update("stockMatch", event.target.checked)} /><span><strong>Match 100% confirmado</strong><small>Empreendimento e produto conferidos na base oficial.</small></span></label>
          <div className="doccalc-grid">
            <label>Data vigente<input type="date" value={form.entryDate} onChange={(event) => update("entryDate", event.target.value)} /></label>
            <label>Término da obra<input type="date" value={form.constructionEnd} onChange={(event) => update("constructionEnd", event.target.value)} /></label>
          </div>
        </fieldset>

        <fieldset className="linearcalc-fieldset">
          <legend>2. Formação do pró-soluto</legend>
          <div className="doccalc-grid doccalc-grid-three">
            <MoneyField label="Valor do imóvel" value={form.salePrice} onChange={(value) => update("salePrice", value)} />
            <MoneyField label="Bônus adimplência" value={form.bonus} onChange={(value) => update("bonus", value)} />
            <MoneyField label="Desconto" value={form.discount} onChange={(value) => update("discount", value)} />
            <MoneyField label="Financiamento" value={form.financing} onChange={(value) => update("financing", value)} />
            <MoneyField label="Subsídio" value={form.subsidy} onChange={(value) => update("subsidy", value)} />
            <MoneyField label="FGTS" value={form.fgts} onChange={(value) => update("fgts", value)} />
            <MoneyField label="Cheque moradia" value={form.housingCheck} onChange={(value) => update("housingCheck", value)} />
          </div>
        </fieldset>

        <fieldset className="linearcalc-fieldset">
          <legend>3. Ato e sinais</legend>
          <p className="doccalc-form-note">Entrada mínima de R$ 150,00. Cada sinal depende do anterior e não pode superá-lo.</p>
          <div className="doccalc-grid doccalc-grid-three">
            <MoneyField label="Entrada / ato" value={form.entry} onChange={(value) => update("entry", value)} />
            <MoneyField label="Sinal 1" value={form.signal1} onChange={(value) => update("signal1", value)} />
            <MoneyField label="Sinal 2" value={form.signal2} onChange={(value) => update("signal2", value)} />
            <MoneyField label="Sinal 3" value={form.signal3} onChange={(value) => update("signal3", value)} />
          </div>
        </fieldset>

        <fieldset className="linearcalc-fieldset">
          <legend>4. Anuais</legend>
          <p className="doccalc-form-note">Até cinco anuais opcionais em 15/12. Elas reduzem a base das mensais, sem reduzir o Pró-Soluto.</p>
          <div className="doccalc-grid doccalc-grid-three">
            {annualKeys.map((key, index) => <MoneyField key={key} label={`Anual ${index + 1}`} value={form[key]} onChange={(value) => update(key, value)} />)}
          </div>
        </fieldset>

        <fieldset className="linearcalc-fieldset linearcalc-policy">
          <legend>5. Política comercial</legend>
          <div className="doccalc-grid">
            <label>Limite aprovado<input type="number" min="1" step="1" value={form.policyLimit} onChange={(event) => update("policyLimit", event.target.value)} /></label>
            <label>Parcelas mensais solicitadas<input type="number" min="1" step="1" value={form.installments} onChange={(event) => update("installments", event.target.value)} /></label>
          </div>
          <label className="doccalc-check"><input type="checkbox" checked={form.policyConfirmed} onChange={(event) => update("policyConfirmed", event.target.checked)} /><span><strong>Política comercial conferida</strong><small>D61 não é livre: deve respeitar o limite oficial do empreendimento.</small></span></label>
        </fieldset>

        <button className="doccalc-submit" type="submit" disabled={!executionEnabled} data-cta-state={executionEnabled ? "enabled" : "blocked"}>Calcular fluxo linear <span aria-hidden="true">→</span></button>
      </form>

      <aside className={`doccalc-result linearcalc-result${calculated ? " calculated" : ""}`} id="resultado-fluxo-linear" aria-live="polite">
        {!calculated ? (
          <div className="doccalc-empty"><span aria-hidden="true">%</span><h2>Tabela associativo</h2><p>Preencha os dados oficiais. O resultado mostra parcela, datas e a memória completa do fluxo pré e pós-obra.</p><ul><li>0,5% a.m. no pré</li><li>1,5% a.m. no pós</li><li>Vencimentos 5 / 10 / 15</li></ul></div>
        ) : !result.ok ? (
          <div className="doccalc-blocked"><span className="doccalc-status blocked">Cálculo bloqueado</span><h2>Revise os gates do WF-13</h2><ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul><AuditList audit={result.audit} /></div>
        ) : (
          <div className="doccalc-summary linearcalc-summary">
            <header><div><span className="doccalc-status approved">Simulação validada</span><h2>Fluxo associativo linear</h2></div><button type="button" onClick={() => window.print()}>Imprimir</button></header>
            <section className="linearcalc-hero-result"><small>Parcela corrigida</small><strong>{money.format(result.correctedInstallment)}</strong><span>Início em {formatDate(result.firstInstallmentDate)} • PGTO oficial</span></section>
            <section className="doccalc-financing-card linearcalc-kpis">
              <div><small>Pró-soluto</small><strong>{money.format(result.proSoluto)}</strong><span>Recursos + entrada + sinais; sem anuais</span></div>
              <div><small>Base mensal corrigida</small><strong>{money.format(result.correctedInstallmentBalance)}</strong><span>Após anuais • carência de {result.graceMonths} mês(es)</span></div>
              <div><small>Parcelas pré</small><strong>{result.preInstallments}</strong><span>Taxa de 0,5% a.m.</span></div>
              <div><small>Parcelas pós</small><strong>{result.postInstallments}</strong><span>Taxa de 1,5% a.m.</span></div>
            </section>
            <section className="linearcalc-table-card"><div className="linearcalc-section-title"><div><small>Memória financeira</small><h3>Distribuição pré e pós-obra</h3></div><span>{result.installments} parcelas</span></div><div className="linearcalc-table-wrap"><table><thead><tr><th>Período</th><th>Qtd.</th><th>VAR</th><th>%</th><th>Base</th><th>Ajustado</th><th>PGTO</th></tr></thead><tbody><tr><th>Pré</th><td>{result.preInstallments}</td><td>{number.format(result.preVariable)}</td><td>{percent.format(result.prePercentage)}</td><td>{money.format(result.prePeriodTotal)}</td><td>{money.format(result.adjustedPre)}</td><td>{money.format(result.prePayment)}</td></tr><tr><th>Pós</th><td>{result.postInstallments}</td><td>{number.format(result.postVariable)}</td><td>{percent.format(result.postPercentage)}</td><td>{money.format(result.postPeriodTotal)}</td><td>{money.format(result.adjustedPost)}</td><td>{money.format(result.postPayment)}</td></tr></tbody></table></div></section>
            {result.annualSchedule.some((annual) => annual.amount > 0) && <section className="linearcalc-table-card"><div className="linearcalc-section-title"><div><small>Condição de pagamento</small><h3>Anuais corrigidas</h3></div><span>{money.format(result.annualCorrectedTotal)}</span></div><div className="linearcalc-table-wrap"><table><thead><tr><th>Anual</th><th>Vencimento</th><th>Informada</th><th>Corrigida</th></tr></thead><tbody>{result.annualSchedule.filter((annual) => annual.amount > 0).map((annual) => <tr key={annual.index}><th>{annual.index}</th><td>{formatDate(annual.dueDate)}</td><td>{money.format(annual.amount)}</td><td>{money.format(annual.corrected)}</td></tr>)}</tbody></table></div></section>}
            <section className="linearcalc-ratios"><div><small>% sobre a parcela</small><strong>{percent.format(result.installmentOverSale)}</strong></div><div><small>% pró-soluto</small><strong>{percent.format(result.proSolutoOverSale)}</strong></div><div><small>Ato + sinais válidos</small><strong>{money.format(result.validInitialTotal)}</strong></div></section>
            <AuditList audit={result.audit} />
          </div>
        )}
      </aside>
    </div>
  );
}

export function AssociativeLinearArchive({ executionEnabled }: { executionEnabled: boolean }) {
  return (
    <div className="simulation-page-shell">
      <main className="simulation-main">
        <section className="simulation-hero">
          <div><nav className="simulation-breadcrumb" aria-label="Trilha de navegação"><Link href="/app/simulacao">Simulação</Link><span aria-hidden="true">/</span><span>Simulador Associativo</span></nav><p className="eyebrow">Tabela Associativo • WF13</p><h1>Simulador Associativo</h1><p>Simulação auditável do pró-soluto, divisão pré e pós-obra, anuais e parcela corrigida.</p></div>
          <div className="simulation-rule-chips" aria-label="Regras principais"><span>0,5% a.m. pré</span><span>1,5% a.m. pós</span><span>Dias 5 / 10 / 15</span><span>D61 com política</span></div>
        </section>
        <AssociativeLinearCalculator executionEnabled={executionEnabled} />
        <p className="simulation-disclaimer">Resultado preliminar sujeito à política comercial vigente, validação do estoque e fechamento oficial no WF-13.</p>
      </main>
    </div>
  );
}
