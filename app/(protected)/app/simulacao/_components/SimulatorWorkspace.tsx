"use client";

import Link from "next/link";
import { useState, type FocusEvent } from "react";

import {
  DataState,
  PageHeader,
  UnavailableValue,
} from "@/app/(protected)/app/_components/analytics";
import {
  SIMULATOR_LIST,
  type SimulatorDefinition,
  type SimulatorField,
} from "@/lib/crm/simulators/catalog";

import styles from "../simulators.module.css";

const UNAVAILABLE_MESSAGE = "Cálculo temporariamente indisponível — regra aguardando validação";

function CalculatorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="2.75" width="16" height="18.5" rx="3" />
      <path d="M7.5 6.5h9v3h-9zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
    </svg>
  );
}

function inputId(sectionKey: string, field: SimulatorField) {
  return `simulator-${sectionKey}-${field.key}`;
}

function describedBy(id: string, hasHint: boolean, isInvalid: boolean) {
  return (
    [hasHint ? `${id}-hint` : null, isInvalid ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined
  );
}

function ValidationMessage({ id }: { id: string }) {
  return (
    <small id={`${id}-error`} className={styles.validationMessage} role="alert">
      Preencha este campo obrigatório.
    </small>
  );
}

function StandardField({
  sectionKey,
  field,
  value,
  touched,
  onValueChange,
  onTouched,
}: {
  sectionKey: string;
  field: SimulatorField;
  value: string | boolean | undefined;
  touched: boolean;
  onValueChange: (id: string, value: string | boolean) => void;
  onTouched: (id: string) => void;
}) {
  const id = inputId(sectionKey, field);
  const textValue = typeof value === "string" ? value : "";
  const isEmpty = field.type === "checkbox" ? value !== true : textValue.trim() === "";
  const isInvalid = field.required === true && touched && isEmpty;
  const fieldDescription = describedBy(id, Boolean(field.hint), isInvalid);

  if (field.type === "radio") {
    return (
      <fieldset
        className={`${styles.field} ${field.wide ? styles.fieldWide : ""} ${
          isInvalid ? styles.fieldInvalid : ""
        }`}
        aria-describedby={fieldDescription}
        aria-invalid={isInvalid || undefined}
        onBlur={(event: FocusEvent<HTMLFieldSetElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onTouched(id);
          }
        }}
      >
        <legend className={styles.fieldLabel}>
          {field.label}
          {field.required ? <span aria-hidden="true"> *</span> : null}
        </legend>
        <div className={styles.choiceGrid}>
          {field.options?.map((option) => {
            const optionId = `${id}-${option.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <label className={styles.choice} htmlFor={optionId} key={option}>
                <input
                  id={optionId}
                  name={field.key}
                  type="radio"
                  value={option}
                  required={field.required}
                  checked={textValue === option}
                  onChange={(event) => onValueChange(id, event.currentTarget.value)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
        {field.hint ? <small id={`${id}-hint`}>{field.hint}</small> : null}
        {isInvalid ? <ValidationMessage id={id} /> : null}
      </fieldset>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label
        className={`${styles.checkField} ${field.wide ? styles.fieldWide : ""} ${
          isInvalid ? styles.checkFieldInvalid : ""
        }`}
        htmlFor={id}
      >
        <input
          id={id}
          name={field.key}
          type="checkbox"
          required={field.required}
          checked={value === true}
          aria-describedby={fieldDescription}
          aria-invalid={isInvalid || undefined}
          onBlur={() => onTouched(id)}
          onChange={(event) => onValueChange(id, event.currentTarget.checked)}
        />
        <span>
          <strong>
            {field.label}
            {field.required ? <span aria-hidden="true"> *</span> : null}
          </strong>
          {field.hint ? <small id={`${id}-hint`}>{field.hint}</small> : null}
          {isInvalid ? <ValidationMessage id={id} /> : null}
        </span>
      </label>
    );
  }

  return (
    <label className={`${styles.field} ${field.wide ? styles.fieldWide : ""}`} htmlFor={id}>
      <span className={styles.fieldLabel}>
        {field.label}
        {field.required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {field.type === "select" ? (
        <select
          id={id}
          name={field.key}
          required={field.required}
          value={textValue}
          aria-describedby={fieldDescription}
          aria-invalid={isInvalid || undefined}
          onBlur={() => onTouched(id)}
          onChange={(event) => onValueChange(id, event.currentTarget.value)}
        >
          <option value="" disabled>
            Selecione
          </option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <span className={styles.inputShell}>
          {field.type === "currency" ? <span aria-hidden="true">R$</span> : null}
          <input
            id={id}
            name={field.key}
            type={field.type === "currency" ? "text" : field.type}
            required={field.required}
            value={textValue}
            inputMode={field.type === "currency" ? "decimal" : undefined}
            placeholder={field.placeholder ?? (field.type === "currency" ? "0,00" : undefined)}
            autoComplete="off"
            min={field.type === "number" ? 0 : undefined}
            aria-describedby={fieldDescription}
            aria-invalid={isInvalid || undefined}
            onBlur={() => onTouched(id)}
            onChange={(event) => onValueChange(id, event.currentTarget.value)}
          />
        </span>
      )}
      {field.hint ? <small id={`${id}-hint`}>{field.hint}</small> : null}
      {isInvalid ? <ValidationMessage id={id} /> : null}
    </label>
  );
}

export function SimulatorWorkspace({ definition }: { definition: SimulatorDefinition }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [touchedFields, setTouchedFields] = useState<ReadonlySet<string>>(() => new Set());

  function updateValue(id: string, value: string | boolean) {
    setValues((currentValues) => ({ ...currentValues, [id]: value }));
  }

  function markTouched(id: string) {
    setTouchedFields((currentFields) => {
      if (currentFields.has(id)) return currentFields;

      const nextFields = new Set(currentFields);
      nextFields.add(id);
      return nextFields;
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          eyebrow={`Simulação · ${definition.code}`}
          title={definition.title}
          description={definition.description}
          meta={
            <div className={styles.headerStatus}>
              <CalculatorIcon />
              <span>
                <small>Motor de cálculo</small>
                <strong>Aguardando validação</strong>
              </span>
            </div>
          }
          footer={
            <nav aria-label="Ferramentas de simulação" className={styles.simulatorNav}>
              <Link href="/app/simulacao">Todas</Link>
              {SIMULATOR_LIST.map((simulator) => (
                <Link
                  key={simulator.slug}
                  href={`/app/simulacao/${simulator.slug}`}
                  aria-current={simulator.slug === definition.slug ? "page" : undefined}
                >
                  {simulator.code}
                </Link>
              ))}
            </nav>
          }
        />

        <DataState
          variant="unavailable"
          compact
          title={UNAVAILABLE_MESSAGE}
          description="Os campos permanecem disponíveis para conferência. Nenhum valor é calculado, persistido ou tratado como proposta comercial."
        />

        <div className={styles.workspace}>
          <form
            className={styles.form}
            aria-label={`Entradas de ${definition.title}`}
            onSubmit={(event) => event.preventDefault()}
          >
            {definition.sections.map((section, index) => (
              <section className={styles.formSection} key={section.key}>
                <div className={styles.sectionHeading}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>{section.title}</h2>
                    {section.description ? <p>{section.description}</p> : null}
                  </div>
                </div>
                <div className={styles.fieldGrid}>
                  {section.fields.map((field) => (
                    <StandardField
                      field={field}
                      key={field.key}
                      sectionKey={section.key}
                      value={values[inputId(section.key, field)]}
                      touched={touchedFields.has(inputId(section.key, field))}
                      onValueChange={updateValue}
                      onTouched={markTouched}
                    />
                  ))}
                </div>
              </section>
            ))}

            <div className={styles.actionBar}>
              <p>
                <strong>Preenchimento disponível.</strong>
                <span>Nenhum cálculo ou envio ao servidor será executado.</span>
              </p>
              <button type="button" disabled aria-describedby="calculation-blocked-reason">
                {definition.actionLabel}
              </button>
              <span id="calculation-blocked-reason" className={styles.visuallyHidden}>
                {UNAVAILABLE_MESSAGE}
              </span>
            </div>
          </form>

          <aside className={styles.results} aria-labelledby="simulator-results-title">
            <div className={styles.resultsHeading}>
              <span className={styles.resultsIcon}>
                <CalculatorIcon />
              </span>
              <div>
                <p>Resultado</p>
                <h2 id="simulator-results-title">Painel da simulação</h2>
              </div>
            </div>
            <p className={styles.resultsDescription}>
              Estrutura pronta para receber somente cálculo oficialmente validado.
            </p>
            <dl className={styles.resultList}>
              {definition.resultItems.map((item) => (
                <div key={item}>
                  <dt>{item}</dt>
                  <dd>
                    <UnavailableValue reason={UNAVAILABLE_MESSAGE} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className={styles.resultNotice}>
              <strong>{UNAVAILABLE_MESSAGE}</strong>
              <span>Nenhuma fórmula da referência foi copiada.</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
