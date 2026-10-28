"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  calculateExtraAmortization,
  calculateFgtsTime,
  calculateHousingSimulation,
  estimateConstructionInterest,
  getMcmvBand,
  getMaximumFinancingQuota,
  getMaximumTerm,
  getMcmvSubsidyEligibility,
  getMunicipalLimit,
  type HousingInput,
  type HousingResult,
} from "@/lib/crm/simulators/caixa";
import {
  CAIXA_CITIES,
  CAIXA_APPLICANT_TYPES,
  CAIXA_DIAGNOSIS_GUIDES,
  createApplicant,
  getApplicantDocuments,
  type ApplicantProfile,
} from "@/lib/crm/simulators/caixa-reference-data";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rate = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const states =
  "AC.AL.AP.AM.BA.CE.DF.ES.GO.MA.MT.MS.MG.PA.PB.PR.PE.PI.RJ.RN.RS.RO.RR.SC.SP.SE.TO".split(".");
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
const cities = [...CAIXA_CITIES]
  .sort((a, b) => {
    if (a.n === "São Paulo" && a.u === "SP") return -1;
    if (b.n === "São Paulo" && b.u === "SP") return 1;
    return a.n.localeCompare(b.n, "pt-BR") || a.u.localeCompare(b.u);
  })
  .map((city) => ({ ...city, search: normalize(`${city.n} ${city.u}`) }));

const initialForm = {
  income: "",
  approvedPayment: "",
  propertyValue: "",
  appraisalValue: "",
  ownFunds: "",
  birthDate: "",
  city: "",
  state: "SP",
  term: "420",
  product: "mcmv",
  system: "price",
  hasFgts36: false,
  previousSubsidy: false,
  socialFactor: false,
  inConstruction: true,
  fgts: "",
  confirmedSubsidy: "",
  confirmedPublicContribution: "",
  approvedFinancingQuotaPercent: "",
  officialQuickEstimate: true,
  nominalRate: "",
  mipMonthly: "",
  dfiMonthly: "",
  operatingFee: "",
  propertyCondition: "new",
  propertyType: "",
  propertyArea: "",
  hasDependents: "",
  constructionMonths: "",
};
type Form = typeof initialForm;
type Tab = "simulador" | "documentos" | "diagnostico" | "utilitarios";
type SuccessfulResult = Extract<HousingResult, { ok: true }>;

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}
function automaticMaximumTerm(form: Form, baseDate: string) {
  const constructionMonths = optionalNumber(form.constructionMonths);
  return getMaximumTerm({
    birthDate: form.birthDate,
    inConstruction: form.inConstruction,
    ...(constructionMonths !== undefined ? { constructionMonths } : {}),
    asOf: baseDate,
  });
}
function housingInput(form: Form, baseDate: string, participants: number): HousingInput {
  const input: HousingInput = {
    income: Number(form.income),
    propertyValue: Number(form.propertyValue),
    officialQuickEstimate: form.officialQuickEstimate,
    ownFunds: Number(form.ownFunds),
    birthDate: form.birthDate,
    state: form.state,
    city: form.city,
    term: Number(form.term),
    product: form.product as "mcmv" | "sbpe",
    system: form.system as "price" | "sac",
    hasFgts36: form.hasFgts36,
    previousSubsidy: form.previousSubsidy,
    socialFactor: form.socialFactor,
    inConstruction: form.inConstruction,
    fgts: Number(form.fgts),
    propertyCondition: form.propertyCondition as "new" | "used",
    singlePersonFamily: participants === 1 && form.hasDependents === "no",
    asOf: baseDate,
  };
  for (const key of [
    "approvedPayment",
    "appraisalValue",
    "confirmedSubsidy",
    "confirmedPublicContribution",
    "approvedFinancingQuotaPercent",
    "nominalRate",
    "mipMonthly",
    "dfiMonthly",
    "operatingFee",
  ] as const) {
    const value = optionalNumber(form[key]);
    if (value !== undefined) input[key] = value;
  }
  const constructionMonths = optionalNumber(form.constructionMonths);
  const propertyArea = optionalNumber(form.propertyArea);
  if (form.propertyType) input.propertyType = form.propertyType as "apartment" | "house";
  if (propertyArea !== undefined) input.propertyArea = propertyArea;
  if (form.inConstruction && constructionMonths !== undefined)
    input.constructionMonths = constructionMonths;
  return input;
}

function MoneyInput({
  value,
  onChange,
  required = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
}) {
  return (
    <div className="caixa-money-input">
      <b aria-hidden="true">R$</b>
      <input
        aria-label={label}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder="0,00"
        value={value ? decimal.format(Number(value)) : ""}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
          onChange(digits ? (Number(digits) / 100).toFixed(2) : "");
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`caixa-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="caixa-field caixa-qualification-item caixa-fgts-choice">
      <span>{label}</span>
      <div className="caixa-toggle-card caixa-toggle-inline">
        <div className="caixa-toggle" role="group" aria-label={label}>
          {[true, false].map((choice) => (
            <button
              key={String(choice)}
              type="button"
              aria-pressed={value === choice}
              className={value === choice ? "active" : ""}
              onClick={() => onChange(choice)}
            >
              {choice ? "Sim" : "Não"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CityPicker({
  value,
  state,
  onChange,
}: {
  value: string;
  state: string;
  onChange: (city: string, state?: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(90);
  const [highlighted, setHighlighted] = useState(0);
  const query = normalize(value);
  const filtered = useMemo(
    () => (query ? cities.filter((city) => city.search.includes(query)) : cities),
    [query],
  );
  const visible = filtered.slice(0, limit);
  function choose(index: number) {
    const city = filtered[index];
    if (city) {
      onChange(city.n, city.u);
      setOpen(false);
    }
  }
  return (
    <div className={`caixa-field caixa-city-field`}>
      <span id={`${id}-label`}>Cidade *</span>
      <div
        className={open ? "caixa-city-picker open" : "caixa-city-picker"}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <input
          required
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && visible[highlighted] ? `${id}-${highlighted}` : undefined}
          autoComplete="off"
          placeholder="Buscar cidade"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setLimit(90);
            setHighlighted(0);
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setHighlighted((previous) =>
                Math.max(
                  0,
                  Math.min(visible.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1)),
                ),
              );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              choose(highlighted);
            }
          }}
        />
        <button
          type="button"
          aria-label={open ? "Fechar lista de cidades" : "Abrir lista de cidades"}
          onClick={() => setOpen(!open)}
        >
          ⌄
        </button>
        {open && (
          <div
            id={`${id}-options`}
            className="caixa-city-options"
            role="listbox"
            aria-label="Municípios do Brasil"
            onScroll={(event) => {
              const target = event.currentTarget;
              if (target.scrollTop + target.clientHeight >= target.scrollHeight - 48)
                setLimit((previous) => Math.min(previous + 90, filtered.length));
            }}
          >
            <p>{filtered.length.toLocaleString("pt-BR")} municípios</p>
            {visible.map((city, index) => (
              <button
                id={`${id}-${index}`}
                key={`${city.u}-${city.n}`}
                type="button"
                role="option"
                aria-selected={city.n === value && city.u === state}
                className={highlighted === index ? "highlighted" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{city.n}</span>
                <small>{city.u}</small>
              </button>
            ))}
            {visible.length < filtered.length && (
              <small className="caixa-city-more">Role para carregar mais</small>
            )}
            {!filtered.length && (
              <strong className="caixa-city-empty">Nenhum município encontrado.</strong>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Actions({
  text,
  fileLabel,
  hidePrint = false,
}: {
  text: string;
  fileLabel: string;
  hidePrint?: boolean;
}) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copiado");
    } catch {
      setMessage("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }
  return (
    <div className="caixa-actions" aria-label={`Ações para ${fileLabel}`}>
      {!hidePrint && (
        <button type="button" onClick={() => window.print()}>
          Imprimir
        </button>
      )}
      <button type="button" onClick={copy}>
        Copiar
      </button>
      <a
        className="primary"
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "caixa-metric accent" : "caixa-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function CaixaClient({
  baseDate,
  initialTab = "simulador",
}: {
  baseDate: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [form, setForm] = useState(initialForm);
  const [participants, setParticipants] = useState(1);
  const [saved, setSaved] = useState<{ form: Form; result: SuccessfulResult }[]>([]);
  const [construction, setConstruction] = useState({ months: "36", progress: "0", tr: "0" });
  const [profiles, setProfiles] = useState<ApplicantProfile[]>([createApplicant(0)]);
  const [phase, setPhase] = useState<"profile" | "phase1" | "phase2">("profile");
  const [diagnosis, setDiagnosis] = useState({
    status: "",
    reason: "",
    income: "",
    payment: "",
    property: "",
  });
  const [utility, setUtility] = useState("amortization");
  const [amortization, setAmortization] = useState({
    balance: "",
    annualRate: "",
    remainingTerm: "",
    contribution: "",
    system: "price",
  });
  const [periods, setPeriods] = useState([{ company: "", start: "", end: "" }]);
  const [showPeriodResult, setShowPeriodResult] = useState(false);
  const amortizationResult = useMemo(
    () =>
      calculateExtraAmortization({
        balance: Number(amortization.balance),
        annualRate: Number(amortization.annualRate),
        remainingTerm: Number(amortization.remainingTerm),
        contribution: Number(amortization.contribution),
        system: amortization.system as "price" | "sac",
      }),
    [amortization],
  );
  const fgtsResult = useMemo(() => calculateFgtsTime(periods, baseDate), [periods, baseDate]);
  const municipalLimit = getMunicipalLimit(form.city, form.state);
  const maximumTerm = form.birthDate ? automaticMaximumTerm(form, baseDate) : 420;
  const automaticPaymentLimit = Number(form.income) * 0.3;
  const numericIncome = Number(form.income);
  const numericPropertyValue = Number(form.propertyValue);
  const automaticMiddleClass =
    form.product === "mcmv" && (numericIncome > 9600 || numericPropertyValue > 400000);
  const subsidyEligibility = getMcmvSubsidyEligibility({
    income: numericIncome,
    propertyValue: numericPropertyValue,
    product: form.product as "mcmv" | "sbpe",
    previousSubsidy: form.previousSubsidy,
    middleClass: automaticMiddleClass,
    confirmedSubsidy: optionalNumber(form.confirmedSubsidy),
  });
  const displayedBand =
    form.product === "sbpe"
      ? "SBPE"
      : automaticMiddleClass
        ? "Classe Média"
        : numericIncome <= 5000 &&
            municipalLimit !== undefined &&
            numericPropertyValue > municipalLimit
          ? "Faixa 3 · imóvel"
          : getMcmvBand(numericIncome);
  const maximumFinancingQuotaPercent =
    getMaximumFinancingQuota({
      income: numericIncome,
      propertyValue: numericPropertyValue,
      product: form.product as "mcmv" | "sbpe",
      system: form.system as "price" | "sac",
      state: form.state,
      propertyCondition: form.propertyCondition as "new" | "used",
    }) * 100;
  const applicablePropertyLimit =
    form.product === "sbpe"
      ? "Conforme proposta CAIXA"
      : automaticMiddleClass
        ? money.format(600000)
        : numericIncome > 5000
          ? money.format(400000)
          : form.city && municipalLimit !== undefined
            ? money.format(municipalLimit)
            : "Selecione cidade e estado";
  function update<Key extends keyof Form>(key: Key, value: Form[Key]) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      const middleClass =
        next.product === "mcmv" &&
        (Number(next.income) > 9600 || Number(next.propertyValue) > 400000);
      return middleClass ? { ...next, confirmedSubsidy: "" } : next;
    });
  }
  function clear() {
    setForm(initialForm);
    setParticipants(1);
    setProfiles([createApplicant(0)]);
  }
  const complete =
    Number(form.income) > 0 &&
    Number(form.propertyValue) > 0 &&
    !!form.birthDate &&
    !!form.city.trim() &&
    !!form.propertyCondition &&
    Number(form.term) > 0 &&
    (subsidyEligibility !== "eligible-review" ||
      (!!form.propertyType &&
        Number(form.propertyArea) > 0 &&
        (participants > 1 || !!form.hasDependents)));
  const result = useMemo(
    () =>
      complete ? calculateHousingSimulation(housingInput(form, baseDate, participants)) : null,
    [baseDate, complete, form, participants],
  );
  const constructionResult = useMemo(
    () =>
      result?.ok
        ? estimateConstructionInterest({
            financing: result.financing,
            annualRate: result.rate,
            months: Number(construction.months),
            currentProgress: Number(construction.progress),
            trAnnual: Number(construction.tr),
            operatingFee: result.operatingFee,
            mipMonthly: result.mipMonthly,
            dfiMonthly: result.dfiMonthly,
          })
        : null,
    [result, construction],
  );
  const simulationText = result?.ok
    ? [
        "SIMULAÇÃO CAIXA — DESCOMPLICA CRM",
        `${result.rateBand} · ${result.system.toUpperCase()} · ${result.term} meses`,
        `Valor do imóvel: ${money.format(result.propertyValue)}`,
        `Base da cota (menor entre compra e avaliação): ${money.format(result.quotaBaseValue)}`,
        `Potencial de financiamento indicativo: ${money.format(result.financing)}`,
        `Subsídio: ${
          result.subsidyConfirmed || result.subsidyEligibility === "automatic"
            ? money.format(result.subsidy)
            : result.subsidyEligibility === "eligible-review"
              ? "renda elegível à análise; valor não abatido"
              : "não aplicável neste cenário"
        }`,
        ...(result.publicContribution > 0
          ? [`Aporte MCMV Cidades: ${money.format(result.publicContribution)}`]
          : []),
        `FGTS + recursos próprios: ${money.format(result.totalResources)}`,
        `Cota aplicada: ${decimal.format(result.financingQuota * 100)}%`,
        `Complemento de entrada: ${money.format(result.entryNeeded)}`,
        `Primeiro encargo estimado${result.insuranceEstimated ? " com seguros de referência" : result.insuranceKnown ? "" : " parcial; seguros não confirmados"}: ${money.format(result.firstPayment)}`,
        `Taxa nominal: ${rate.format(result.rate)}% a.a.`,
        "Simulação indicativa, sem atualização futura por TR e sem aprovação de crédito. Confirme valores e elegibilidade com a CAIXA.",
      ].join("\n")
    : "";
  const checklistText = profiles
    .flatMap((profile, index) => [
      `PROPONENTE ${index + 1} — ${profile.name}`,
      ...getApplicantDocuments(profile, phase === "phase2" ? 2 : 1, profiles.length).map(
        (document) => `• ${document.title}: ${document.detail}`,
      ),
      "",
    ])
    .join("\n");
  const guideKey =
    diagnosis.status === "approved" || diagnosis.status === "documents"
      ? diagnosis.status
      : diagnosis.reason;
  const guide = CAIXA_DIAGNOSIS_GUIDES[guideKey];
  const commitment =
    Number(diagnosis.income) > 0 ? (Number(diagnosis.payment) / Number(diagnosis.income)) * 100 : 0;
  function updateProfile(index: number, patch: Partial<ApplicantProfile>) {
    setProfiles((previous) =>
      previous.map((profile, position) =>
        position === index ? { ...profile, ...patch } : profile,
      ),
    );
  }
  function synchronizeProfilesFromSimulation() {
    setProfiles((previous) =>
      Array.from({ length: participants }, (_, index) => {
        const profile = previous[index] ?? createApplicant(index);
        return index === 0
          ? {
              ...profile,
              income: form.income,
              product: form.product,
              hasFgts36: form.hasFgts36,
              useFgts: form.hasFgts36 && Number(form.fgts) > 0,
            }
          : profile;
      }),
    );
  }

  return (
    <section className="caixa-workspace" aria-label="Simulador CAIXA">
      <div className="caixa-workspace-heading">
        <div>
          <h1>Simulador CAIXA</h1>
          <span>Crédito habitacional com regras atualizadas</span>
        </div>
        <p>Preencha os dados e acompanhe o resultado automático.</p>
      </div>
      <nav className="caixa-tabs" aria-label="Ferramentas Caixa">
        {(
          [
            ["simulador", "01", "Simulador"],
            ["documentos", "02", "Documentos"],
            ["diagnostico", "03", "Diagnóstico"],
            ["utilitarios", "04", "Utilitários"],
          ] as const
        ).map(([key, number, label]) => (
          <button
            type="button"
            key={key}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            aria-label={`${number} ${label}`}
            onClick={() => {
              if (key === "documentos") synchronizeProfilesFromSimulation();
              setTab(key);
            }}
          >
            <span>{number}</span>
            {label}
          </button>
        ))}
      </nav>
      {tab === "simulador" && (
        <div className="caixa-simulator-layout">
          <form className="caixa-form caixa-full-form" onSubmit={(event) => event.preventDefault()}>
            <section
              className="caixa-panel caixa-form-section caixa-qualification-section"
              aria-labelledby="caixa-client-property-title"
            >
              <h2 id="caixa-client-property-title" className="caixa-sr-only">
                Dados do cliente e do imóvel
              </h2>
              <div className="caixa-form-section-content">
                <div className="caixa-form-grid caixa-qualification-grid caixa-primary-grid">
                  <Field
                    className="caixa-qualification-item caixa-income-field"
                    label="Renda familiar bruta *"
                  >
                    <MoneyInput
                      required
                      value={form.income}
                      onChange={(value) => update("income", value)}
                    />
                    <small className="caixa-field-insight" aria-live="polite">
                      Limite de parcela (30%): {money.format(automaticPaymentLimit)} ·{" "}
                      {displayedBand}
                    </small>
                  </Field>
                  <Field
                    className="caixa-qualification-item caixa-approved-field"
                    label={
                      <>
                        Prestação aprovada <small>opcional</small>
                      </>
                    }
                  >
                    <MoneyInput
                      value={form.approvedPayment}
                      onChange={(value) => update("approvedPayment", value)}
                    />
                  </Field>
                  <Field
                    className="caixa-qualification-item caixa-property-field"
                    label="Valor do imóvel *"
                  >
                    <MoneyInput
                      required
                      value={form.propertyValue}
                      onChange={(value) => update("propertyValue", value)}
                    />
                    <small className="caixa-field-insight" aria-live="polite">
                      Limite aplicável: {applicablePropertyLimit}
                    </small>
                  </Field>
                  <Field
                    className="caixa-qualification-item caixa-own-funds-field"
                    label={
                      <>
                        Recursos próprios <small>opcional</small>
                      </>
                    }
                  >
                    <MoneyInput
                      value={form.ownFunds}
                      onChange={(value) => update("ownFunds", value)}
                    />
                  </Field>
                  <Field
                    className="caixa-qualification-item caixa-participants-field"
                    label="Quantidade de proponentes"
                  >
                    <div className="caixa-participant-control">
                      <input
                        aria-label="Quantidade de proponentes"
                        type="number"
                        min="1"
                        max="4"
                        step="1"
                        value={participants}
                        onChange={(event) => {
                          const value = Math.max(
                            1,
                            Math.min(4, Math.floor(Number(event.target.value)) || 1),
                          );
                          setParticipants(value);
                          if (value > 1)
                            setForm((previous) => ({ ...previous, hasDependents: "" }));
                        }}
                      />
                    </div>
                  </Field>
                </div>
                {subsidyEligibility === "eligible-review" && (
                  <div className="caixa-form-grid caixa-subsidy-inputs">
                    <Field label="Tipo da unidade *">
                      <select
                        required
                        value={form.propertyType}
                        onChange={(event) => update("propertyType", event.target.value)}
                      >
                        <option value="">Selecione…</option>
                        <option value="apartment">Apartamento</option>
                        <option value="house">Casa</option>
                      </select>
                    </Field>
                    <Field label="Área oficial da unidade (m²) *">
                      <input
                        required
                        type="number"
                        min="1"
                        max="10000"
                        step="0.01"
                        value={form.propertyArea}
                        onChange={(event) => update("propertyArea", event.target.value)}
                      />
                      <small>Use a área coberta indicada no documento do imóvel.</small>
                    </Field>
                    {participants === 1 && (
                      <Field label="Possui dependentes? *">
                        <select
                          required
                          value={form.hasDependents}
                          onChange={(event) => update("hasDependents", event.target.value)}
                        >
                          <option value="">Selecione…</option>
                          <option value="yes">Sim</option>
                          <option value="no">Não</option>
                        </select>
                        <small>Sem dependentes aplica a regra de família unipessoal.</small>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            </section>
            <section
              className="caixa-panel caixa-form-section caixa-financing-section"
              aria-labelledby="caixa-financing-title"
            >
              <h2 id="caixa-financing-title" className="caixa-sr-only">
                Condições do financiamento
              </h2>
              <div className="caixa-form-section-content">
                <div className="caixa-form-grid caixa-secondary-grid">
                  <Field className="caixa-date-field" label="Data de nascimento *">
                    <input
                      required
                      type="date"
                      max={baseDate}
                      value={form.birthDate}
                      onChange={(event) => {
                        const birthDate = event.target.value;
                        setForm((previous) => {
                          const next = { ...previous, birthDate };
                          const allowedTerm = automaticMaximumTerm(next, baseDate);
                          return {
                            ...next,
                            ...(allowedTerm > 0 ? { term: String(allowedTerm) } : {}),
                          };
                        });
                      }}
                    />
                    <small>Informe a data do proponente mais velho.</small>
                  </Field>
                  <CityPicker
                    value={form.city}
                    state={form.state}
                    onChange={(city, state) => {
                      setForm((previous) => ({ ...previous, city, ...(state ? { state } : {}) }));
                    }}
                  />
                  <Field className="caixa-state-field" label="Estado *">
                    <select
                      value={form.state}
                      onChange={(event) => {
                        setForm((previous) => ({
                          ...previous,
                          state: event.target.value,
                          city: "",
                        }));
                      }}
                    >
                      {states.map((state) => (
                        <option key={state}>{state}</option>
                      ))}
                    </select>
                  </Field>
                  <Field className="caixa-term-field" label="Prazo em meses *">
                    <input
                      required
                      type="number"
                      min="1"
                      max={maximumTerm || 420}
                      step="1"
                      value={form.term}
                      onChange={(event) => {
                        const value = event.target.value;
                        const parsed = Number(value);
                        update(
                          "term",
                          value && Number.isFinite(parsed) && maximumTerm > 0
                            ? String(Math.min(maximumTerm, Math.max(1, Math.floor(parsed))))
                            : value,
                        );
                      }}
                    />
                    <small>
                      Máximo automático pela idade:{" "}
                      {maximumTerm > 0 ? `${maximumTerm} meses` : "não disponível"}.
                    </small>
                  </Field>
                  <div className="caixa-field-pair caixa-product-system-field">
                    <Field label="Produto">
                      <select
                        value={form.product}
                        onChange={(event) => {
                          const product = event.target.value;
                          setForm((previous) => ({
                            ...previous,
                            product,
                            ...(product === "sbpe"
                              ? {
                                  confirmedSubsidy: "",
                                  confirmedPublicContribution: "",
                                }
                              : {}),
                          }));
                        }}
                      >
                        <option value="mcmv">MCMV</option>
                        <option value="sbpe">SBPE</option>
                      </select>
                    </Field>
                    <Field label="Sistema">
                      <select
                        value={form.system}
                        onChange={(event) => update("system", event.target.value)}
                      >
                        <option value="price">PRICE</option>
                        <option value="sac">SAC</option>
                      </select>
                    </Field>
                  </div>
                </div>
                <div className="caixa-form-grid caixa-binary-grid">
                  <Toggle
                    label="Tem 36+ meses de FGTS?"
                    value={form.hasFgts36}
                    onChange={(value) => {
                      setForm((previous) => ({
                        ...previous,
                        hasFgts36: value,
                        fgts: value ? previous.fgts : "",
                      }));
                    }}
                  />
                  <Toggle
                    label="Já recebeu subsídio?"
                    value={form.previousSubsidy}
                    onChange={(value) => update("previousSubsidy", value)}
                  />
                  <Toggle
                    label="Tem fator social? (informativo)"
                    value={form.socialFactor}
                    onChange={(value) => update("socialFactor", value)}
                  />
                  <div className="caixa-property-condition-group">
                    <Toggle
                      label="Imóvel na planta?"
                      value={form.inConstruction}
                      onChange={(value) => {
                        setForm((previous) => {
                          const constructionMonths = optionalNumber(previous.constructionMonths);
                          const allowedTerm = getMaximumTerm({
                            birthDate: previous.birthDate,
                            inConstruction: value,
                            ...(constructionMonths !== undefined ? { constructionMonths } : {}),
                            asOf: baseDate,
                          });
                          return {
                            ...previous,
                            inConstruction: value,
                            propertyCondition: value ? "new" : "",
                            ...(allowedTerm > 0 ? { term: String(allowedTerm) } : {}),
                          };
                        });
                      }}
                    />
                    <Field label="Condição do imóvel *">
                      <select
                        required={!form.inConstruction}
                        disabled={form.inConstruction}
                        value={form.propertyCondition}
                        onChange={(event) => update("propertyCondition", event.target.value)}
                      >
                        <option value="">Selecione…</option>
                        <option value="new">Novo</option>
                        <option value="used">Usado</option>
                      </select>
                      <small>
                        {form.inConstruction
                          ? "Novo definido automaticamente para imóvel na planta."
                          : "Escolha Novo ou Usado para continuar."}
                      </small>
                    </Field>
                  </div>
                </div>
              </div>
            </section>
            <details className="caixa-confirmed-parameters">
              <summary>Parâmetros confirmados e valores opcionais</summary>
              <p>
                Preencha com os valores da simulação oficial. A base da cota é o menor entre valor
                de compra e avaliação da CAIXA. Ter 36 meses de FGTS não garante a elegibilidade
                para usar o saldo.
              </p>
              <div className="caixa-form-grid">
                {form.hasFgts36 && (
                  <Field label="Saldo de FGTS disponível">
                    <MoneyInput value={form.fgts} onChange={(value) => update("fgts", value)} />
                  </Field>
                )}
                <Field label="Avaliação confirmada pela CAIXA">
                  <MoneyInput
                    value={form.appraisalValue}
                    onChange={(value) => update("appraisalValue", value)}
                  />
                  <small>Se ficar vazio, o valor de compra será usado provisoriamente.</small>
                </Field>
                {form.product === "mcmv" && (
                  <>
                    {!automaticMiddleClass && (
                      <Field label="Desconto complemento FGTS confirmado">
                        <MoneyInput
                          value={form.confirmedSubsidy}
                          onChange={(value) => update("confirmedSubsidy", value)}
                        />
                      </Field>
                    )}
                    <Field label="Aporte MCMV Cidades confirmado">
                      <MoneyInput
                        value={form.confirmedPublicContribution}
                        onChange={(value) => update("confirmedPublicContribution", value)}
                      />
                    </Field>
                  </>
                )}
                <Field label="Taxa nominal confirmada (% a.a.)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    value={form.nominalRate}
                    onChange={(event) => update("nominalRate", event.target.value)}
                  />
                  <small>
                    Se ausente no SBPE, a estimativa rápida usa a taxa pública por faixa de renda.
                  </small>
                </Field>
                <Field label="Cota aprovada pela CAIXA (%)">
                  <input
                    type="number"
                    min="0.01"
                    max={String(maximumFinancingQuotaPercent)}
                    step="0.01"
                    value={form.approvedFinancingQuotaPercent}
                    onChange={(event) =>
                      update("approvedFinancingQuotaPercent", event.target.value)
                    }
                  />
                  <small>
                    Opcional. Teto aplicado: {maximumFinancingQuotaPercent}% neste cenário.
                  </small>
                </Field>
                {form.inConstruction && (
                  <Field label="Prazo previsto de construção (meses)">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="1"
                      value={form.constructionMonths}
                      onChange={(event) => {
                        const constructionMonths = event.target.value;
                        const constructionTerm = optionalNumber(constructionMonths);
                        const allowedTerm = getMaximumTerm({
                          birthDate: form.birthDate,
                          inConstruction: true,
                          ...(constructionTerm !== undefined
                            ? { constructionMonths: constructionTerm }
                            : {}),
                          asOf: baseDate,
                        });
                        setForm((previous) => ({
                          ...previous,
                          constructionMonths,
                          ...(allowedTerm > 0 ? { term: String(allowedTerm) } : {}),
                        }));
                        setConstruction((previous) => ({
                          ...previous,
                          months: constructionMonths || "36",
                        }));
                      }}
                    />
                    <small>Integra o prazo total para a conferência do limite de idade.</small>
                  </Field>
                )}
                <Field label="Seguro MIP confirmado (R$/mês)">
                  <MoneyInput
                    value={form.mipMonthly}
                    onChange={(value) => update("mipMonthly", value)}
                  />
                </Field>
                <Field label="Seguro DFI confirmado (R$/mês)">
                  <MoneyInput
                    value={form.dfiMonthly}
                    onChange={(value) => update("dfiMonthly", value)}
                  />
                </Field>
                <Field label="Tarifa mensal confirmada (R$)">
                  <MoneyInput
                    value={form.operatingFee}
                    onChange={(value) => update("operatingFee", value)}
                  />
                </Field>
                <label className="caixa-middle-class-option">
                  <input
                    type="checkbox"
                    checked={form.officialQuickEstimate}
                    onChange={(event) => update("officialQuickEstimate", event.target.checked)}
                  />
                  Estimar taxa SBPE, MIP, DFI e tarifa ausentes com a calculadora rápida CAIXA
                </label>
              </div>
            </details>
            <footer className="caixa-step-actions caixa-full-form-actions">
              <span className="caixa-auto-status" role="status" aria-live="polite">
                {result
                  ? "Simulação atualizada automaticamente"
                  : "Preencha os campos obrigatórios"}
              </span>
              <button type="button" className="ghost" onClick={clear}>
                Limpar
              </button>
            </footer>
          </form>
          {result && (
            <aside
              id="caixa-simulation-result"
              className="caixa-panel caixa-result-panel"
              aria-label="Resultado da simulação"
            >
              {!result.ok ? (
                <div className="caixa-errors" role="alert">
                  <p>Revise os dados:</p>
                  {result.errors.map((error) => (
                    <span key={error}>{error}</span>
                  ))}
                </div>
              ) : (
                <div className="caixa-result-content caixa-result-summary">
                  <div className="caixa-result-summary-heading">
                    <h2>Resumo financeiro</h2>
                    <button
                      type="button"
                      className="caixa-result-print"
                      onClick={() => window.print()}
                    >
                      Imprimir
                    </button>
                  </div>
                  <div className="caixa-result-summary-grid">
                    <section className="caixa-result-plan">
                      <small>Plano sugerido</small>
                      <p className="caixa-result-plan-line">
                        <strong>
                          {result.system === "sac"
                            ? `SAC · ${result.term} meses · primeira parcela`
                            : `${result.term} meses · parcela inicial`}
                        </strong>
                        <span>{money.format(result.firstPayment)}</span>
                      </p>
                      <p className="caixa-result-plan-caption">
                        1º encargo estimado
                        {result.insuranceEstimated
                          ? " com seguros de referência"
                          : result.insuranceKnown
                            ? ""
                            : " parcial; seguros não confirmados"}{" "}
                        · {result.rateBand} · {result.system.toUpperCase()}
                      </p>
                      <div className="caixa-result-plan-total">
                        <span>Financiamento indicativo</span>
                        <strong>{money.format(result.financing)}</strong>
                        <b className={result.fitsProperty ? "approved" : "attention"}>
                          {result.fitsProperty
                            ? "Composição coberta nesta estimativa"
                            : "Complementar entrada"}
                        </b>
                      </div>
                    </section>
                    <section className="caixa-result-composition">
                      <h3>Composição</h3>
                      <dl>
                        {[
                          ["Valor do imóvel", money.format(result.propertyValue)],
                          ["Base da cota", money.format(result.quotaBaseValue)],
                          ...(result.municipalLimit !== undefined
                            ? [["Limite municipal", money.format(result.municipalLimit)]]
                            : []),
                          ["Financiamento", money.format(result.financing)],
                          [
                            "Subsídio",
                            result.subsidyConfirmed || result.subsidyEligibility === "automatic"
                              ? money.format(result.subsidy)
                              : result.subsidyEligibility === "eligible-review"
                                ? "Elegível à análise · valor não abatido"
                                : "Não aplicável neste cenário",
                          ],
                          ...(result.publicContribution > 0
                            ? [["Aporte MCMV Cidades", money.format(result.publicContribution)]]
                            : []),
                          ["FGTS + recursos", money.format(result.totalResources)],
                          ["Complemento de entrada", money.format(result.entryNeeded)],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className={
                              label === "Complemento de entrada"
                                ? "caixa-result-composition-total"
                                : undefined
                            }
                          >
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  </div>
                  <p className="caixa-result-note">
                    {result.rateBand} · {result.system.toUpperCase()} · taxa nominal de{" "}
                    {rate.format(result.rate)}% a.a. · taxa efetiva de{" "}
                    {rate.format(result.effectiveRate)}% a.a.
                    {result.rateEstimated ? " (estimada)" : ""} · comprometimento estimado de{" "}
                    {result.commitment.toFixed(1)}%.
                  </p>
                  <details className="caixa-result-audit">
                    <summary>Auditoria do cálculo</summary>
                    <div className="caixa-result-audit-grid">
                      <Metric
                        label="Parcela principal"
                        value={money.format(result.principalPayment)}
                      />
                      <Metric
                        label={`Seguro MIP + DFI${result.insuranceEstimated ? " (estimativa rápida)" : ""}`}
                        value={
                          result.insuranceKnown
                            ? `${money.format(result.insurance)}/mês`
                            : result.insuranceEstimated
                              ? `${money.format(result.insurance)}/mês`
                              : "Não informado; não incluído"
                        }
                      />
                      <Metric
                        label={`Tarifa operacional${result.operatingFeeEstimated ? " (estimativa rápida)" : ""}`}
                        value={
                          result.operatingFeeKnown
                            ? `${money.format(result.operatingFee)}/mês`
                            : result.operatingFeeEstimated
                              ? `${money.format(result.operatingFee)}/mês`
                              : "Não informada; não incluída"
                        }
                      />
                      <Metric label="Prazo" value={`${result.term} meses`} />
                      <Metric
                        label="Quota de financiamento"
                        value={`${decimal.format(result.financingQuota * 100)}% sobre ${money.format(result.quotaBaseValue)}`}
                      />
                      <Metric label="TR futura" value="Não projetada na amortização" />
                    </div>
                    <p>
                      PRICE: P × i ÷ (1 − (1 + i)⁻ⁿ). SAC inicial: P ÷ n + P × i. i = taxa nominal
                      anual ÷ 12. Crédito limitado pela renda, quota e recursos. Aprovação, CET,
                      avaliação bancária e seguros dependem da CAIXA.
                    </p>
                  </details>
                  <div className="caixa-result-actions">
                    <Actions text={simulationText} fileLabel="simulação" hidePrint />
                    <button
                      type="button"
                      className="caixa-save"
                      onClick={() =>
                        setSaved((previous) =>
                          [{ form: { ...form }, result }, ...previous].slice(0, 5),
                        )
                      }
                    >
                      Salvar na sessão
                    </button>
                  </div>
                  {saved.length > 0 && (
                    <details className="caixa-history">
                      <summary>Simulações salvas ({saved.length})</summary>
                      {saved.map((item, index) => (
                        <button
                          type="button"
                          key={index}
                          onClick={() => {
                            setForm(item.form);
                            setConstruction((previous) => ({
                              ...previous,
                              months: item.form.constructionMonths || "36",
                            }));
                          }}
                        >
                          {item.form.city} · {money.format(item.result.propertyValue)}
                          <span>{money.format(item.result.financing)}</span>
                        </button>
                      ))}
                      <small>Disponíveis apenas enquanto esta página permanecer aberta.</small>
                    </details>
                  )}
                  {form.inConstruction && (
                    <details className="caixa-result-audit caixa-construction-details">
                      <summary>Estimativa de juros de obra</summary>
                      <section className="caixa-construction">
                        {construction.months !== form.constructionMonths && (
                          <p className="caixa-reference-notice">
                            O prazo deste cenário é uma hipótese independente e não altera o prazo
                            total usado na conferência da idade. Para recalcular essa conferência,
                            ajuste o prazo previsto nos parâmetros e calcule novamente.
                          </p>
                        )}
                        <div className="caixa-form-grid">
                          {(
                            [
                              ["months", "Meses restantes", 1, 120],
                              ["progress", "Obra atual (%)", 0, 99],
                              ["tr", "TR estimada (% a.a.)", 0, 100],
                            ] as const
                          ).map(([key, label, min, max]) => (
                            <Field key={key} label={label}>
                              <input
                                type="number"
                                min={min}
                                max={max}
                                step={key === "months" ? 1 : 0.1}
                                value={construction[key]}
                                onChange={(event) =>
                                  setConstruction((previous) => ({
                                    ...previous,
                                    [key]: event.target.value,
                                  }))
                                }
                              />
                            </Field>
                          ))}
                        </div>
                        {constructionResult?.ok ? (
                          <div className="caixa-result-grid">
                            <Metric
                              label="Primeiro encargo"
                              value={money.format(constructionResult.firstPayment)}
                            />
                            <Metric
                              label="Último encargo"
                              value={money.format(constructionResult.lastPayment)}
                            />
                            <Metric
                              label="Total estimado"
                              value={money.format(constructionResult.total)}
                              accent
                            />
                          </div>
                        ) : (
                          <p>Informe os parâmetros válidos da obra.</p>
                        )}
                        <small>
                          Estimativa linear ilustrativa. Medições, liberação de recursos, TR e
                          seguros reais alteram os encargos. Não representa cronograma aprovado.
                        </small>
                      </section>
                    </details>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
      {tab === "documentos" && (
        <div className="caixa-panel caixa-documents">
          <div className="caixa-panel-heading">
            <div>
              <p>Checklist inteligente</p>
              <h2>Documentos necessários</h2>
            </div>
            <div className="caixa-phase-tabs">
              {(
                [
                  ["profile", "Perfil"],
                  ["phase1", "Fase 1"],
                  ["phase2", "Fase 2"],
                ] as const
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={phase === key ? "active" : ""}
                  aria-pressed={phase === key}
                  onClick={() => setPhase(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="caixa-reference-notice">
            Checklist de apoio da referência comercial. A CAIXA pode solicitar documentos
            adicionais; confirme a relação e os prazos na análise oficial.
          </p>
          {phase === "profile" ? (
            <>
              <div className="caixa-choice-row">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={profiles.length === count ? "active" : ""}
                    aria-pressed={profiles.length === count}
                    onClick={() => {
                      setParticipants(count);
                      setProfiles((previous) =>
                        Array.from(
                          { length: count },
                          (_, index) => previous[index] ?? createApplicant(index),
                        ),
                      );
                    }}
                  >
                    {count} {count === 1 ? "proponente" : "proponentes"}
                  </button>
                ))}
              </div>
              <div className="caixa-profile-grid">
                {profiles.map((profile, index) => (
                  <article className="caixa-profile" key={index}>
                    <header>
                      <span>{index + 1}</span>
                      <input
                        aria-label={`Nome do proponente ${index + 1}`}
                        value={profile.name}
                        onChange={(event) => updateProfile(index, { name: event.target.value })}
                      />
                    </header>
                    <Field label="Tipo de vínculo / renda">
                      <select
                        value={profile.type}
                        onChange={(event) => updateProfile(index, { type: event.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {CAIXA_APPLICANT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Renda mensal bruta">
                      <MoneyInput
                        value={profile.income}
                        onChange={(value) => updateProfile(index, { income: value })}
                      />
                    </Field>
                    {["informal", "mei", "empresario"].includes(profile.type) && (
                      <Field label="Meses de extrato">
                        <select
                          value={profile.statementMonths}
                          onChange={(event) =>
                            updateProfile(index, { statementMonths: event.target.value })
                          }
                        >
                          {[3, 6, 12].map((months) => (
                            <option key={months} value={months}>
                              {months} meses
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Toggle
                      label="FGTS com 36+ meses?"
                      value={profile.hasFgts36}
                      onChange={(value) => updateProfile(index, { hasFgts36: value })}
                    />
                    <Toggle
                      label="Vai usar o FGTS?"
                      value={profile.useFgts}
                      onChange={(value) => updateProfile(index, { useFgts: value })}
                    />
                    <Toggle
                      label="Declara IR?"
                      value={profile.declaredIr}
                      onChange={(value) => updateProfile(index, { declaredIr: value })}
                    />
                    <Field label="Produto">
                      <select
                        value={profile.product}
                        onChange={(event) => updateProfile(index, { product: event.target.value })}
                      >
                        <option value="mcmv">MCMV</option>
                        <option value="sbpe">SBPE</option>
                      </select>
                    </Field>
                    {profile.product === "mcmv" &&
                      Number(profile.income) <= 4000 &&
                      profiles.length === 1 && (
                        <Field label="Fator Social">
                          <select
                            value={profile.socialFactor}
                            onChange={(event) =>
                              updateProfile(index, { socialFactor: event.target.value })
                            }
                          >
                            <option value="none">Sem fator social</option>
                            <option value="child">Filho menor de 18 anos</option>
                            <option value="relative">Parente até 3º grau</option>
                          </select>
                        </Field>
                      )}
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="caixa-submit"
                disabled={profiles.some((profile) => !profile.type || Number(profile.income) <= 0)}
                onClick={() => setPhase("phase1")}
              >
                Gerar documentos da Fase 1
              </button>
            </>
          ) : (
            <div className="caixa-checklists">
              {profiles.map((profile, index) => (
                <article key={index}>
                  <header>
                    <span>{index + 1}</span>
                    <div>
                      <h3>{profile.name}</h3>
                      <p>{phase === "phase1" ? "Análise de potencial" : "Fechamento da venda"}</p>
                    </div>
                  </header>
                  {getApplicantDocuments(profile, phase === "phase1" ? 1 : 2, profiles.length).map(
                    (document) => (
                      <div className="caixa-check-item" key={document.title}>
                        <i aria-hidden="true">✓</i>
                        <div>
                          <strong>{document.title}</strong>
                          <span>{document.detail}</span>
                        </div>
                      </div>
                    ),
                  )}
                </article>
              ))}
              <Actions
                text={`${checklistText}\nChecklist indicativo; confirmar com a CAIXA.`}
                fileLabel="checklist de documentos"
              />
              <button
                type="button"
                className="caixa-submit"
                onClick={() => setPhase(phase === "phase1" ? "phase2" : "profile")}
              >
                {phase === "phase1" ? "Ir para Fase 2 — fechar venda" : "Editar perfis"}
              </button>
            </div>
          )}
        </div>
      )}
      {tab === "diagnostico" && (
        <div className="caixa-panel caixa-diagnosis">
          <div className="caixa-panel-heading">
            <div>
              <p>Leitura da análise</p>
              <h2>Qual foi o resultado?</h2>
            </div>
            {diagnosis.status && (
              <button
                type="button"
                className="caixa-text-button"
                onClick={() =>
                  setDiagnosis({ status: "", reason: "", income: "", payment: "", property: "" })
                }
              >
                Nova consulta
              </button>
            )}
          </div>
          <p className="caixa-reference-notice">
            Orientação de apoio. Selecione o resultado informado pela instituição; esta ferramenta
            não consulta cadastros nem aprova crédito.
          </p>
          <div className="caixa-diagnosis-topics" aria-label="Resultado da análise">
            {[
              ["approved", "✓", "Aprovado"],
              ["conditioned", "!", "Condicionado"],
              ["documents", "≡", "Documentação pendente"],
              ["rejected", "×", "Reprovado"],
            ].map(([key, icon, label]) => (
              <button
                type="button"
                key={key}
                className={diagnosis.status === key ? "active" : ""}
                aria-pressed={diagnosis.status === key}
                onClick={() =>
                  setDiagnosis((previous) => ({ ...previous, status: key ?? "", reason: "" }))
                }
              >
                <span aria-hidden="true">{icon}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </div>
          {diagnosis.status && (
            <div className="caixa-diagnosis-subfilters">
              <span>Detalhamento</span>
              {diagnosis.status === "approved" && <strong>Crédito liberado</strong>}
              {diagnosis.status === "documents" && <strong>Falta documento</strong>}
              {(diagnosis.status === "conditioned"
                ? [
                    ["income", "Renda comprometida"],
                    ["scr", "Dívida/prejuízo no SCR Bacen"],
                    ["conres", "Restrição interna Caixa"],
                    ["dirtyName", "Nome sujo (SPC/Serasa)"],
                  ]
                : diagnosis.status === "rejected"
                  ? [
                      ["rating", "Pontuação (rating)"],
                      ["margin", "Renda comprometida"],
                    ]
                  : []
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={diagnosis.reason === key ? "active" : ""}
                  aria-pressed={diagnosis.reason === key}
                  onClick={() => setDiagnosis((previous) => ({ ...previous, reason: key ?? "" }))}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {diagnosis.reason === "income" && (
            <div className="caixa-diagnosis-income">
              <div className="caixa-form-grid">
                {(
                  [
                    ["income", "Renda bruta"],
                    ["payment", "Prestação aprovada"],
                    ["property", "Valor do imóvel desejado"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <MoneyInput
                      value={diagnosis[key]}
                      onChange={(value) =>
                        setDiagnosis((previous) => ({ ...previous, [key]: value }))
                      }
                    />
                  </Field>
                ))}
              </div>
              {commitment > 0 && (
                <div className="caixa-guide">
                  <h3>Condicionado — renda comprometida</h3>
                  <p>
                    Prestação informada: {commitment.toFixed(1)}% da renda. O percentual isolado não
                    comprova a causa da decisão.
                  </p>
                  <ol>
                    <li>
                      Use a prestação aprovada no simulador para estimar o potencial de
                      financiamento.
                    </li>
                    <li>Avalie composição de renda e o endividamento com a instituição.</li>
                    <li>Solicite nova análise após a atualização cadastral.</li>
                  </ol>
                  <button
                    type="button"
                    className="caixa-submit"
                    onClick={() => {
                      setForm((previous) => ({
                        ...previous,
                        income: diagnosis.income,
                        approvedPayment: diagnosis.payment,
                        propertyValue: diagnosis.property,
                      }));
                      setTab("simulador");
                    }}
                  >
                    Levar dados para o simulador
                  </button>
                </div>
              )}
            </div>
          )}
          {guide && (
            <div className="caixa-guide">
              <header>
                <span aria-hidden="true">{diagnosis.status === "approved" ? "✓" : "!"}</span>
                <div>
                  <h3>{guide.title}</h3>
                  <p>{guide.subtitle}</p>
                </div>
              </header>
              <ol>
                {guide.steps.map((step, index) => (
                  <li key={step}>
                    <b aria-hidden="true">{index + 1}</b>
                    {step}
                  </li>
                ))}
              </ol>
              {guide.deadline && <div className="caixa-deadline">{guide.deadline}</div>}
              <Actions
                text={[
                  guide.title,
                  ...guide.steps,
                  guide.deadline ?? "",
                  "Orientação indicativa; confirmar com a instituição.",
                ].join("\n")}
                fileLabel="diagnóstico"
              />
            </div>
          )}
        </div>
      )}
      {tab === "utilitarios" && (
        <div className="caixa-panel caixa-utilities">
          <div className="caixa-panel-heading">
            <div>
              <p>Ferramentas extras</p>
              <h2>Utilitários do corretor</h2>
            </div>
            <div className="caixa-phase-tabs">
              {[
                ["amortization", "Amortização"],
                ["fgts", "Tempo de FGTS"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={utility === key}
                  className={utility === key ? "active" : ""}
                  onClick={() => setUtility(key ?? "")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {utility === "amortization" ? (
            <div className="caixa-amort-layout">
              <div>
                <p>
                  Compare redução de prazo e de parcela com taxa constante, sem seguros, tarifas ou
                  atualização monetária.
                </p>
                <button
                  className="caixa-save"
                  type="button"
                  disabled={!result?.ok}
                  onClick={() => {
                    if (result?.ok)
                      setAmortization({
                        balance: String(result.financing),
                        annualRate: String(result.rate),
                        remainingTerm: String(result.term),
                        contribution: "",
                        system: result.system,
                      });
                  }}
                >
                  Carregar última simulação
                </button>
                <div className="caixa-form-grid">
                  {(
                    [
                      ["balance", "Saldo devedor atual"],
                      ["annualRate", "Taxa nominal anual (%)"],
                      ["remainingTerm", "Prazo restante (meses)"],
                      ["contribution", "Valor a amortizar"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="number"
                        min={key === "remainingTerm" ? 1 : 0}
                        max={key === "remainingTerm" ? 420 : undefined}
                        step={key === "remainingTerm" ? 1 : 0.0001}
                        value={amortization[key]}
                        onChange={(event) =>
                          setAmortization((previous) => ({
                            ...previous,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  ))}
                  <Field label="Sistema">
                    <select
                      value={amortization.system}
                      onChange={(event) =>
                        setAmortization((previous) => ({ ...previous, system: event.target.value }))
                      }
                    >
                      <option value="price">PRICE</option>
                      <option value="sac">SAC</option>
                    </select>
                  </Field>
                </div>
              </div>
              <div>
                {amortizationResult.ok ? (
                  <div className="caixa-amort-result">
                    <Metric
                      label="Parcela atual (principal + juros)"
                      value={money.format(amortizationResult.originalPayment)}
                    />
                    <article>
                      <span>Maior economia</span>
                      <h3>Reduzir o prazo</h3>
                      <Metric
                        label="Meses eliminados"
                        value={String(amortizationResult.eliminatedMonths)}
                        accent
                      />
                      <Metric
                        label="Novo prazo"
                        value={`${amortizationResult.shortenedTerm} meses`}
                      />
                      <Metric
                        label="Economia de juros"
                        value={money.format(amortizationResult.interestSavingByTerm)}
                      />
                    </article>
                    <article>
                      <span>Alívio mensal</span>
                      <h3>Reduzir a parcela</h3>
                      <Metric
                        label="Nova parcela"
                        value={money.format(amortizationResult.newPayment)}
                        accent
                      />
                      <Metric
                        label="Redução mensal"
                        value={money.format(amortizationResult.monthlyReduction)}
                      />
                      <Metric
                        label="Economia de juros"
                        value={money.format(amortizationResult.interestSavingByPayment)}
                      />
                    </article>
                  </div>
                ) : (
                  <div className="caixa-empty small">
                    <span>%</span>
                    <h2>Simule um aporte.</h2>
                    <p>Informe saldo, taxa, prazo e aporte válidos.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="caixa-fgts-tool">
              <p>
                Some períodos formais de trabalho. Eles não precisam ser contínuos nem no mesmo
                emprego. O tempo não substitui as demais condições oficiais de utilização do FGTS.
              </p>
              {periods.map((period, index) => (
                <article key={index}>
                  <header>
                    <strong>Período {index + 1}</strong>
                    <button
                      type="button"
                      disabled={periods.length === 1}
                      onClick={() => {
                        setPeriods((previous) =>
                          previous.filter((_, position) => position !== index),
                        );
                        setShowPeriodResult(false);
                      }}
                    >
                      Remover
                    </button>
                  </header>
                  <div className="caixa-form-grid">
                    {(
                      [
                        ["company", "Empresa (opcional)", "text"],
                        ["start", "Data início", "date"],
                        ["end", "Data fim (vazio = atual)", "date"],
                      ] as const
                    ).map(([key, label, type]) => (
                      <Field key={key} label={label}>
                        <input
                          type={type}
                          max={type === "date" ? baseDate : undefined}
                          value={period[key]}
                          onChange={(event) => {
                            setPeriods((previous) =>
                              previous.map((entry, position) =>
                                position === index
                                  ? { ...entry, [key]: event.target.value }
                                  : entry,
                              ),
                            );
                            setShowPeriodResult(false);
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                </article>
              ))}
              <div className="caixa-actions">
                <button
                  type="button"
                  className="caixa-save"
                  disabled={periods.length >= 11}
                  onClick={() => {
                    setPeriods((previous) => [...previous, { company: "", start: "", end: "" }]);
                    setShowPeriodResult(false);
                  }}
                >
                  Adicionar período de trabalho
                </button>
                <button type="button" className="primary" onClick={() => setShowPeriodResult(true)}>
                  Calcular tempo de FGTS
                </button>
              </div>
              {showPeriodResult && (
                <div
                  className={
                    fgtsResult.eligible ? "caixa-fgts-result eligible" : "caixa-fgts-result"
                  }
                >
                  {fgtsResult.invalid && (
                    <p role="alert">
                      Confira os períodos: datas devem ser válidas, o fim não pode anteceder o
                      início nem ultrapassar a data-base. O resultado não comprova o requisito de
                      tempo.
                    </p>
                  )}
                  <span>Tempo total sem duplicar sobreposições</span>
                  <strong>{fgtsResult.days} dias</strong>
                  <h3>
                    {fgtsResult.eligible ? "36 MESES ATINGIDOS NA ESTIMATIVA" : "TEMPO A CONFERIR"}
                  </h3>
                  <p>
                    {fgtsResult.eligible
                      ? "O requisito de tempo estimado foi atingido. Confirme o extrato e as demais condições na CAIXA."
                      : `Faltam aproximadamente ${fgtsResult.missingDays} dias para o marco estimado de 36 meses.`}
                  </p>
                  {fgtsResult.overlap && (
                    <em>
                      Existem períodos sobrepostos; o mesmo intervalo não pode ser contado duas
                      vezes.
                    </em>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <footer className="caixa-sources">
        <p>
          Simulações teóricas e indicativas. Taxas, subsídios, seguros, limites municipais e
          aprovação final devem ser confirmados no sistema oficial da Caixa Econômica Federal. Não
          substitui proposta bancária nem cálculo do CET.
        </p>
        <p>
          Fontes oficiais:{" "}
          <a
            href="https://simuladorhabitacao.caixa.gov.br/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Simulador habitacional CAIXA
          </a>{" "}
          ·{" "}
          <a
            href="https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts"
            target="_blank"
            rel="noopener noreferrer"
          >
            Regras e taxas MCMV
          </a>
          . Consulta de regras em 26/10/2026. Data-base desta simulação:{" "}
          {baseDate.split("-").reverse().join("/")}.
        </p>
      </footer>
    </section>
  );
}
