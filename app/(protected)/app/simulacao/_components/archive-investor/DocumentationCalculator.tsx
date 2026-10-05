"use client";

import { Check, Printer } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  calculateDocumentation,
  getDocumentationIncomeBand,
  OFFICIAL_PARAMETERS,
  type DocumentationAuditItem,
} from "@/lib/archive-investor/documentation-calculator-rules.mjs";
import { useDismissiblePopover } from "./useDismissiblePopover";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const fieldSteps = {
  businessUnit: 1,
  modality: 2,
  firstProperty: 3,
  salePrice: 4,
  appraisalValue: 5,
  financing: 6,
  income: 7,
} as const;
type FieldName = keyof typeof fieldSteps;
type FormValues = Record<FieldName, string>;

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function positive(value: string) {
  return numeric(value) > 0;
}
function formatDate(value: string) {
  return date.format(new Date(`${value}T00:00:00.000Z`));
}

function DocumentationInfoHint({ label }: { label: string }) {
  const [root, trigger, open, , toggle] = useDismissiblePopover();
  return (
    <span className="documentation-info-hint" ref={root as React.RefObject<HTMLSpanElement | null>}>
      <button
        ref={trigger as React.RefObject<HTMLButtonElement | null>}
        type="button"
        className="documentation-info-trigger"
        aria-label={`Informações sobre ${label}`}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="documentation-info-mark" aria-hidden="true" />
      </button>
      {open && (
        <span
          className="documentation-info-dialog"
          role="dialog"
          aria-label={`Instruções sobre ${label}`}
        >
          Em construção
        </span>
      )}
    </span>
  );
}

function MoneyField({
  fieldName,
  label,
  note,
  value,
  onChange,
  primary = false,
  helper = "",
  helperState = "neutral",
  disabled = false,
}: {
  fieldName: FieldName;
  label: string;
  note: string;
  value: string;
  onChange: (value: string) => void;
  primary?: boolean;
  helper?: string;
  helperState?: "neutral" | "warning" | "valid";
  disabled?: boolean;
}) {
  const state = disabled ? "locked" : positive(value) ? "complete" : "current";
  const helperId = `${fieldName}-helper`;
  return (
    <div className={`documentation-money-field ${state} ${primary ? "primary" : ""}`}>
      <span className="documentation-money-heading">
        <strong>{label}</strong>
        <span className="documentation-money-heading-meta">
          <small>{note}</small>
          <DocumentationInfoHint label={label} />
        </span>
      </span>
      <span className="documentation-money-input">
        <b>R$</b>
        <input
          name={fieldName}
          aria-label={label}
          aria-describedby={helperId}
          aria-invalid={helperState === "warning" || undefined}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={value ? decimal.format(numeric(value)) : ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 15);
            onChange(digits ? (Number(digits) / 100).toFixed(2) : "");
          }}
          onFocus={(event) => event.currentTarget.select()}
          placeholder="0,00"
        />
      </span>
      <span
        id={helperId}
        className={`documentation-money-helper ${helperState}`}
        role="status"
        aria-live="polite"
      >
        {helper || "\u00a0"}
      </span>
    </div>
  );
}

function Audit({ audit }: { audit: DocumentationAuditItem[] }) {
  return (
    <details className="documentation-audit">
      <summary>Auditoria do cálculo</summary>
      <ul>
        {audit.map((item) => (
          <li key={item.label} className={item.ok ? "ok" : "error"}>
            <span aria-hidden="true">{item.ok ? "✓" : "×"}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function DocumentationCalculator({
  baseDate,
  showHeroHeading = true,
}: {
  baseDate: string;
  showHeroHeading?: boolean;
}) {
  const [values, setValues] = useState<FormValues>({
    businessUnit: "",
    modality: "",
    firstProperty: "",
    salePrice: "",
    appraisalValue: "",
    financing: "",
    income: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [unlockedStep, setUnlockedStep] = useState(0);
  const result = useMemo(
    () => calculateDocumentation({ ...values, baseDate, requestedFirstInstallment: "" }),
    [values, baseDate],
  );
  const modality = result.effectiveModality || values.modality;
  const financingRate =
    modality === "MCMV"
      ? OFFICIAL_PARAMETERS.mcmvFinancingLimit
      : modality === "SBPE"
        ? OFFICIAL_PARAMETERS.sbpeFinancingLimit
        : 0;
  const appraisal = numeric(values.appraisalValue);
  const salePrice = numeric(values.salePrice);
  const financing = numeric(values.financing);
  const appraisalLimit = appraisal > 0 ? appraisal * financingRate : 0;
  const maximumFinancing =
    appraisalLimit > 0 ? Math.min(appraisalLimit, salePrice > 0 ? salePrice : appraisalLimit) : 0;
  const exceedsLimit = maximumFinancing > 0 && financing > maximumFinancing;
  const incomeBand = getDocumentationIncomeBand(values.income);
  const financingShare = salePrice > 0 ? financing / salePrice : 0;
  const completedValues = [
    positive(values.salePrice),
    positive(values.appraisalValue),
    positive(values.financing),
    modality === "SBPE" || positive(values.income),
  ];
  const progress = Math.round(
    (completedValues.filter(Boolean).length / completedValues.length) * 100,
  );
  const profileComplete = Boolean(values.businessUnit && modality && values.firstProperty);
  const financialComplete = completedValues.every(Boolean);
  const valuesComplete = profileComplete && financialComplete && result.ok;
  const displayedProgress =
    financialComplete && !valuesComplete ? Math.min(progress, 75) : progress;
  const limitBasis =
    salePrice > 0 && appraisalLimit > salePrice
      ? "limitado ao valor da venda"
      : `${percent.format(financingRate)} da avaliação`;
  const financingHelper =
    maximumFinancing > 0
      ? `Limite permitido: ${currency.format(maximumFinancing)} · ${limitBasis}`
      : "Informe a avaliação bancária para calcular o limite permitido.";
  const incomeHelper =
    modality === "MCMV"
      ? incomeBand
        ? incomeBand.maximum == null
          ? `${incomeBand.label} · revisar enquadramento SBPE.`
          : incomeBand.minimum <= 0.01
            ? `${incomeBand.label} · renda até ${currency.format(incomeBand.maximum)}`
            : `${incomeBand.label} · ${currency.format(incomeBand.minimum)} a ${currency.format(incomeBand.maximum)}`
        : "Preencha a renda para identificar a faixa MCMV."
      : "SBPE não utiliza faixa de renda MCMV.";
  const flowState = {
    profile: profileComplete,
    values: valuesComplete,
    result: submitted && result.ok,
  };
  const activeStep = profileComplete ? (valuesComplete ? "result" : "values") : "profile";

  function update(field: FieldName, value: string) {
    const isChoice = ["businessUnit", "modality", "firstProperty"].includes(field);
    if (isChoice ? Boolean(value) : positive(value))
      setUnlockedStep((step) => Math.max(step, fieldSteps[field]));
    setValues((current) => ({ ...current, [field]: value }));
    setSubmitted(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileComplete || !financialComplete) return;
    setSubmitted(true);
    requestAnimationFrame(() =>
      document.querySelector("#resultado-documentacao")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      }),
    );
  }

  return (
    <>
      <section className="goal-page-hero documentation-page-hero">
        {showHeroHeading ? (
          <div className="goal-hero-copy">
            <p className="goal-kicker">Simulação comercial</p>
            <h1>Calcular documentação</h1>
          </div>
        ) : null}
        <div className="goal-command-center documentation-command-center">
          <div className="documentation-growth-signal" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <i />
            <i />
            <i />
          </div>
          <div className="goal-channel-switcher">
            <ol className="documentation-flow" aria-label="Etapas da simulação">
              {(
                [
                  { key: "profile", label: "Perfil", detail: "Tipo da compra" },
                  { key: "values", label: "Valores", detail: "Estrutura financeira" },
                  { key: "result", label: "Resultado", detail: "Resumo financeiro" },
                ] as const
              ).map((step) => (
                <li
                  key={step.key}
                  className={`${flowState[step.key] ? "complete" : "pending"} ${activeStep === step.key ? "active" : ""}`}
                >
                  <i aria-hidden="true" />
                  <span>{step.label}</span>
                  <small>{step.detail}</small>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <main className="documentation-page-main">
        <form
          id="documentation-calculator-form"
          className="documentation-studio"
          onSubmit={submit}
          noValidate
        >
          <section
            className={`goal-panel documentation-panel documentation-profile-panel ${profileComplete ? "is-complete" : "is-active"}`}
          >
            <header>
              <span>01</span>
              <div>
                <p>Perfil da proposta</p>
                <h2>Como será a compra?</h2>
              </div>
            </header>
            <p className="goal-panel-note">Selecione as regras comerciais aplicáveis.</p>
            <fieldset
              className={`documentation-choice-group ${unlockedStep === 0 ? "current" : "complete"}`}
            >
              <legend>
                <span>Construtora</span>
                <DocumentationInfoHint label="Construtora" />
              </legend>
              <div className="documentation-choice-row">
                {["Direcional", "Riva"].map((option) => (
                  <label key={option} className={values.businessUnit === option ? "selected" : ""}>
                    <input
                      type="radio"
                      name="businessUnit"
                      value={option}
                      checked={values.businessUnit === option}
                      onChange={(event) => update("businessUnit", event.target.value)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {!values.businessUnit && (
                <p className="documentation-choice-prompt">Escolha a opção desejada</p>
              )}
            </fieldset>
          </section>
          <section
            className={`goal-panel documentation-panel documentation-purchase-panel ${profileComplete ? "is-complete" : unlockedStep >= 1 ? "is-active" : "is-locked"}`}
          >
            <header>
              <span>02</span>
              <div>
                <p>Tipo da compra</p>
                <h2>Defina o financiamento</h2>
              </div>
            </header>
            <fieldset
              className={`documentation-choice-group ${unlockedStep < 1 ? "locked" : unlockedStep === 1 ? "current" : "complete"}`}
              disabled={unlockedStep < 1}
            >
              <legend>
                <span>Financiamento</span>
                <DocumentationInfoHint label="Financiamento" />
              </legend>
              <div className="documentation-choice-row">
                {[
                  ["MCMV", "até 80%"],
                  ["SBPE", "até 90%"],
                ].map(([option, cap]) => (
                  <label
                    key={option}
                    className={`${modality === option ? "selected" : ""} ${values.firstProperty === "NAO" && option === "MCMV" ? "disabled" : ""}`}
                  >
                    <input
                      type="radio"
                      name="modality"
                      value={option}
                      checked={modality === option}
                      disabled={values.firstProperty === "NAO" && option === "MCMV"}
                      onChange={(event) => update("modality", event.target.value)}
                    />
                    <b>{cap}</b>
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {unlockedStep < 1 ? (
                <p className="documentation-choice-prompt locked">Conclua a etapa anterior</p>
              ) : (
                !values.modality && (
                  <p className="documentation-choice-prompt">Escolha a opção desejada</p>
                )
              )}
            </fieldset>
            <fieldset
              className={`documentation-choice-group ${unlockedStep < 2 ? "locked" : unlockedStep === 2 ? "current" : "complete"}`}
              disabled={unlockedStep < 2}
            >
              <legend>
                <span>Primeiro imóvel?</span>
                <DocumentationInfoHint label="Primeiro imóvel" />
              </legend>
              <div className="documentation-choice-row documentation-yes-no">
                {[
                  ["SIM", "Sim"],
                  ["NAO", "Não"],
                ].map(([option, label]) => (
                  <label key={option} className={values.firstProperty === option ? "selected" : ""}>
                    <input
                      type="radio"
                      name="firstProperty"
                      value={option}
                      checked={values.firstProperty === option}
                      onChange={(event) => update("firstProperty", event.target.value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {unlockedStep < 2 ? (
                <p className="documentation-choice-prompt locked">Conclua a etapa anterior</p>
              ) : (
                !values.firstProperty && (
                  <p className="documentation-choice-prompt">Escolha a opção desejada</p>
                )
              )}
            </fieldset>
            {values.firstProperty === "NAO" && (
              <p className="doccalc-inline-alert smart-rule">
                <strong>SBPE aplicado automaticamente.</strong> A condição informada não permite
                MCMV, isenção de ITBI ou descontos de primeiro imóvel.
              </p>
            )}
          </section>
          <section
            className={`goal-panel documentation-panel documentation-values-panel ${valuesComplete ? "is-complete" : unlockedStep >= 3 ? "is-active" : "is-locked"}`}
          >
            <header>
              <span>03</span>
              <div>
                <p>Estrutura financeira</p>
                <h2>Informe os valores</h2>
              </div>
              <small
                style={{ "--documentation-progress": `${displayedProgress}%` } as CSSProperties}
              >
                {displayedProgress}%
              </small>
            </header>
            <p className="goal-panel-note">Valores usados para validar teto e calcular taxas.</p>
            <div className="documentation-money-list">
              <MoneyField
                fieldName="salePrice"
                label="Valor do imóvel"
                note="Venda"
                value={values.salePrice}
                onChange={(value) => update("salePrice", value)}
                primary
                disabled={unlockedStep < 3}
                helper={
                  unlockedStep < 3
                    ? "Conclua a etapa anterior"
                    : positive(values.salePrice)
                      ? ""
                      : "Preencha um valor maior que zero para continuar"
                }
              />
              <MoneyField
                fieldName="appraisalValue"
                label="Avaliação bancária"
                note="Base do teto"
                value={values.appraisalValue}
                onChange={(value) => update("appraisalValue", value)}
                disabled={unlockedStep < 4}
                helper={
                  unlockedStep < 4
                    ? "Conclua a etapa anterior"
                    : positive(values.appraisalValue)
                      ? ""
                      : "Preencha um valor maior que zero para continuar"
                }
              />
              <MoneyField
                fieldName="financing"
                label="Financiamento"
                note={`${percent.format(Math.max(0, financingShare))} da venda`}
                value={values.financing}
                onChange={(value) => update("financing", value)}
                disabled={unlockedStep < 5}
                helper={
                  unlockedStep < 5
                    ? "Conclua a etapa anterior"
                    : positive(values.financing)
                      ? financingHelper
                      : "Preencha um valor maior que zero para continuar"
                }
                helperState={
                  exceedsLimit
                    ? "warning"
                    : maximumFinancing > 0 && positive(values.financing)
                      ? "valid"
                      : "neutral"
                }
              />
              <MoneyField
                fieldName="income"
                label="Renda familiar"
                note={modality === "MCMV" ? "Obrigatória" : "Opcional"}
                value={values.income}
                onChange={(value) => update("income", value)}
                disabled={unlockedStep < 6}
                helper={
                  unlockedStep < 6
                    ? "Conclua a etapa anterior"
                    : modality === "MCMV" && !positive(values.income)
                      ? "Preencha um valor maior que zero para continuar"
                      : incomeHelper
                }
                helperState={
                  modality === "MCMV"
                    ? incomeBand?.maximum == null && positive(values.income)
                      ? "warning"
                      : incomeBand
                        ? "valid"
                        : "neutral"
                    : "neutral"
                }
              />
            </div>
            <div className="documentation-values-actions">
              <button
                className="goal-save-button documentation-hero-submit documentation-values-submit"
                type="submit"
                form="documentation-calculator-form"
                disabled={!profileComplete || !financialComplete}
              >
                <span aria-hidden="true">
                  <Check size={18} />
                </span>
                <span className="documentation-hero-submit-copy">
                  <strong>Calcular documentação</strong>
                  <small>Data da simulação: {formatDate(baseDate)}</small>
                </span>
              </button>
            </div>
          </section>
          {submitted && (
            <section
              className="goal-panel documentation-result-panel calculated"
              id="resultado-documentacao"
              aria-live="polite"
            >
              {result.ok ? (
                <div className="documentation-summary-result">
                  <header>
                    <span>03</span>
                    <div>
                      <p>Proposta calculada</p>
                      <h2>Resumo financeiro</h2>
                    </div>
                    <button type="button" onClick={() => window.print()}>
                      <Printer size={14} aria-hidden="true" /> Imprimir
                    </button>
                  </header>
                  {result.modalityForced && (
                    <p className="doccalc-inline-alert smart-rule">
                      Modalidade recalculada para <strong>SBPE</strong> conforme renda, primeiro
                      imóvel e valor da unidade.
                    </p>
                  )}
                  <div className="documentation-summary-grid">
                    <section className="documentation-plan-card">
                      <small>Plano sugerido</small>
                      <p className="documentation-plan-line">
                        <strong>{result.installments}x Parcelas de</strong>{" "}
                        <span>{currency.format(result.installmentValue)}</span>
                      </p>
                      <p className="documentation-plan-date">
                        1° Parcela para <strong>{formatDate(result.firstInstallmentDate)}</strong>
                      </p>
                      <div className="documentation-plan-total">
                        <small>Total da documentação</small>
                        <strong>{currency.format(result.totalCash)}</strong>
                      </div>
                    </section>
                    <section className="documentation-breakdown">
                      <h3>Composição</h3>
                      <dl>
                        <div>
                          <dt>ITBI</dt>
                          <dd>{currency.format(result.itbi)}</dd>
                        </div>
                        <div>
                          <dt>Registro total</dt>
                          <dd>{currency.format(result.totalRegistration)}</dd>
                        </div>
                        <div>
                          <dt>Despachante</dt>
                          <dd>{currency.format(result.dispatchFee)}</dd>
                        </div>
                        <div>
                          <dt>Seguro Caixa</dt>
                          <dd>{currency.format(result.caixaInsurance)}</dd>
                        </div>
                        <div className="documentation-breakdown-total">
                          <dt>Total da documentação</dt>
                          <dd>{currency.format(result.totalCash)}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                  <p className="documentation-interest">
                    Tabela Price · juros fixos de{" "}
                    {percent.format(OFFICIAL_PARAMETERS.monthlyInterest)} ao mês · {result.itbiRule}
                  </p>
                  <Audit audit={result.audit} />
                </div>
              ) : (
                <div className="documentation-blocked-result" role="alert">
                  <header>
                    <span aria-hidden="true">!</span>
                    <div>
                      <p>Alerta da simulação</p>
                      <h2>Revise os dados informados</h2>
                    </div>
                  </header>
                  <div className="documentation-error-alert">
                    <strong>Não foi possível calcular a documentação.</strong>
                    <ul>
                      {result.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                  {result.maximumFinancing > 0 && (
                    <div className="documentation-limit">
                      <small>Teto disponível</small>
                      <strong>{currency.format(result.maximumFinancing)}</strong>
                      <span>{limitBasis}</span>
                    </div>
                  )}
                  <Audit audit={result.audit} />
                </div>
              )}
            </section>
          )}
        </form>
        <p className="simulation-disclaimer">
          Valores aproximados. Proposta final deve ser validada no Bora Vender e pela Secretaria de
          Vendas.
        </p>
      </main>
    </>
  );
}
