"use client";

import Link from "next/link";
import { useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  DataState,
  PageHeader,
  UnavailableValue,
} from "@/app/(protected)/app/_components/analytics";
import {
  SIMULATOR_LIST,
  type SimulatorDefinition,
  type SimulatorField,
  type SimulatorSection,
} from "@/lib/crm/simulators/catalog";
import { isOfficialSimulatorSlug } from "@/lib/crm/simulators/official/catalog";
import {
  buildOfficialSimulatorInput,
  officialSimulatorInitialValues,
  officialSimulatorResultRows,
  type OfficialSimulatorResultRow,
} from "@/lib/crm/simulators/official/client";

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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </svg>
  );
}

function inputId(sectionKey: string, fieldKey: string, itemNumber?: number) {
  const itemSegment = itemNumber === undefined ? "" : `-${itemNumber}`;
  return `simulator-${sectionKey}${itemSegment}-${fieldKey}`;
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
  itemNumber,
  value,
  touched,
  onValueChange,
  onTouched,
}: {
  sectionKey: string;
  field: SimulatorField;
  itemNumber?: number | undefined;
  value: string | boolean | undefined;
  touched: boolean;
  onValueChange: (id: string, value: string | boolean) => void;
  onTouched: (id: string) => void;
}) {
  const id = inputId(sectionKey, field.key, itemNumber);
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
                  name={id}
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
          name={id}
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
          name={id}
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
            name={id}
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

function SectionPreview({ section }: { section: SimulatorSection }) {
  if (!section.preview) return null;

  const preview = section.preview;

  return (
    <div className={styles.fieldGrid}>
      <div className={styles.fieldWide}>
        <DataState
          variant="unavailable"
          compact
          title={preview.title}
          description={preview.description}
        />

        {preview.kind === "inventory" ? (
          <>
            <dl className={styles.resultList} aria-label="Colunas do estoque conciliado">
              {preview.items.map((item) => (
                <div key={item}>
                  <dt>{item}</dt>
                  <dd>
                    <UnavailableValue reason="Fonte oficial não conciliada" />
                  </dd>
                </div>
              ))}
            </dl>
            <div className={styles.actionBar}>
              <p>
                <strong>Paginação preparada.</strong>
                <span id={`inventory-unavailable-reason-${section.key}`}>
                  Nenhuma unidade foi carregada porque a fonte oficial está indisponível.
                </span>
              </p>
              <div className={styles.simulatorNav}>
                <button
                  type="button"
                  disabled
                  className={styles.unavailableAction}
                  data-cta-state="unavailable"
                  aria-describedby={`inventory-unavailable-reason-${section.key}`}
                >
                  Atualizar estoque
                </button>
                <button
                  type="button"
                  disabled
                  className={styles.unavailableAction}
                  data-cta-state="unavailable"
                  aria-describedby={`inventory-unavailable-reason-${section.key}`}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled
                  className={styles.unavailableAction}
                  data-cta-state="unavailable"
                  aria-describedby={`inventory-unavailable-reason-${section.key}`}
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.processGrid} aria-label={preview.title}>
            {preview.items.map((item) => (
              <article className={styles.processCard} key={item}>
                <span>{item}</span>
                <strong>Indisponível</strong>
                <small>{UNAVAILABLE_MESSAGE}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type OfficialExecutionResult = {
  formulaVersion: string;
  rows: OfficialSimulatorResultRow[];
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export function SimulatorWorkspace({
  definition,
  executionEnabled = false,
  executionReason = UNAVAILABLE_MESSAGE,
}: {
  definition: SimulatorDefinition;
  executionEnabled?: boolean;
  executionReason?: string;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    officialSimulatorInitialValues(definition.slug),
  );
  const [touchedFields, setTouchedFields] = useState<ReadonlySet<string>>(() => new Set());
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [executionStatus, setExecutionStatus] = useState<"idle" | "pending" | "error">("idle");
  const [executionError, setExecutionError] = useState("");
  const [officialResult, setOfficialResult] = useState<OfficialExecutionResult | null>(null);
  const navigationGroups = Array.from(
    new Set(
      definition.sections
        .map((section) => section.group)
        .filter((group): group is string => group !== undefined),
    ),
  );
  const [requestedGroup, setRequestedGroup] = useState<string | undefined>(navigationGroups[0]);
  const activeGroup = navigationGroups.includes(requestedGroup ?? "")
    ? requestedGroup
    : navigationGroups[0];
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([]);

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

  function setRepeatCount(sectionKey: string, nextCount: number) {
    setRepeatCounts((currentCounts) => ({ ...currentCounts, [sectionKey]: nextCount }));
  }

  function removeLastRepeatedItem(section: SimulatorSection, currentCount: number) {
    if (currentCount <= 1) return;

    const removedPrefix = `simulator-${section.key}-${currentCount}-`;
    setValues((currentValues) =>
      Object.fromEntries(
        Object.entries(currentValues).filter(([key]) => !key.startsWith(removedPrefix)),
      ),
    );
    setTouchedFields(
      (currentFields) =>
        new Set([...currentFields].filter((key) => !key.startsWith(removedPrefix))),
    );
    setRepeatCount(section.key, currentCount - 1);
  }

  function clearFields() {
    if (
      Object.keys(values).length > 0 &&
      !window.confirm("Limpar os campos preenchidos nesta simulação?")
    ) {
      return;
    }

    setValues(officialSimulatorInitialValues(definition.slug));
    setTouchedFields(new Set());
    setRepeatCounts({});
    setExecutionStatus("idle");
    setExecutionError("");
    setOfficialResult(null);
  }

  async function executeOfficialSimulator() {
    if (!executionEnabled || !isOfficialSimulatorSlug(definition.slug)) return;
    const input = buildOfficialSimulatorInput(definition.slug, values);
    if (!input) return;

    setExecutionStatus("pending");
    setExecutionError("");
    setOfficialResult(null);
    try {
      const response = await fetch(`/api/official-simulator/${definition.slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, input }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error("request_failed");
      }
      const envelope = payload as Record<string, unknown>;
      const result = envelope.result;
      const rows = officialSimulatorResultRows(definition.slug, result);
      if (
        !rows ||
        typeof envelope.formulaVersion !== "string" ||
        !result ||
        typeof result !== "object"
      ) {
        throw new Error("invalid_response");
      }
      const resultRecord = result as Record<string, unknown>;
      setOfficialResult({
        formulaVersion: envelope.formulaVersion,
        rows,
        ok: resultRecord.ok === true,
        errors: stringList(resultRecord.errors),
        warnings: stringList(resultRecord.warnings),
      });
      setExecutionStatus("idle");
    } catch {
      setExecutionStatus("error");
      setExecutionError(
        "Não foi possível concluir o cálculo. Nenhum resultado parcial foi considerado válido.",
      );
    }
  }

  function selectAdjacentTab(event: ReactKeyboardEvent<HTMLAnchorElement>, currentIndex: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % navigationGroups.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + navigationGroups.length) % navigationGroups.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = navigationGroups.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    setRequestedGroup(navigationGroups[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  function isFieldVisible(section: SimulatorSection, field: SimulatorField, itemNumber?: number) {
    if (!field.visibleWhen) return true;

    const dependencyValue = values[inputId(section.key, field.visibleWhen.fieldKey, itemNumber)];
    return (
      typeof dependencyValue === "string" && field.visibleWhen.values.includes(dependencyValue)
    );
  }

  function renderFields(section: SimulatorSection, itemNumber?: number) {
    return section.fields
      .filter((field) => isFieldVisible(section, field, itemNumber))
      .map((field) => {
        const id = inputId(section.key, field.key, itemNumber);

        return (
          <StandardField
            field={field}
            itemNumber={itemNumber}
            key={field.key}
            sectionKey={section.key}
            value={values[id]}
            touched={touchedFields.has(id)}
            onValueChange={updateValue}
            onTouched={markTouched}
          />
        );
      });
  }

  function renderSection(section: SimulatorSection) {
    if (executionEnabled && section.fields.length === 0 && section.preview?.kind === "status") {
      return null;
    }
    const sectionIndex = definition.sections.findIndex(({ key }) => key === section.key);
    const repeatCount = section.repeatable ? (repeatCounts[section.key] ?? 1) : 1;
    const repeatLimitReached =
      section.repeatable?.maxItems !== undefined && repeatCount >= section.repeatable.maxItems;

    return (
      <section className={styles.formSection} key={section.key}>
        <div className={styles.sectionHeading}>
          <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
          <div>
            <h2>{section.title}</h2>
            {section.description ? <p>{section.description}</p> : null}
          </div>
        </div>

        {section.repeatable ? (
          <div className={styles.fieldGrid}>
            {Array.from({ length: repeatCount }, (_, index) => {
              const itemNumber = index + 1;

              return (
                <fieldset className={`${styles.processCard} ${styles.fieldWide}`} key={itemNumber}>
                  <legend>
                    <strong>
                      {section.repeatable?.itemLabel} {itemNumber}
                    </strong>
                  </legend>
                  <div className={styles.fieldGrid}>{renderFields(section, itemNumber)}</div>
                  {repeatCount > 1 && itemNumber === repeatCount ? (
                    <div className={styles.actionBar}>
                      <p>
                        <strong>Item local.</strong>
                        <span>Nenhum dado será persistido.</span>
                      </p>
                      <button
                        type="button"
                        className={styles.enabledAction}
                        data-cta-state="enabled"
                        onClick={() => removeLastRepeatedItem(section, repeatCount)}
                      >
                        Remover {section.repeatable?.itemLabel.toLocaleLowerCase("pt-BR")}
                      </button>
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
            <div className={`${styles.actionBar} ${styles.fieldWide}`}>
              <p>
                <strong>Estrutura repetível.</strong>
                <span>
                  {section.repeatable.maxItems
                    ? `Limite oficial: ${section.repeatable.maxItems} itens.`
                    : "Sem limite presumido; a política oficial permanece pendente."}
                </span>
              </p>
              <button
                type="button"
                disabled={repeatLimitReached}
                className={repeatLimitReached ? styles.unavailableAction : styles.enabledAction}
                data-cta-state={repeatLimitReached ? "unavailable" : "enabled"}
                onClick={() => setRepeatCount(section.key, repeatCount + 1)}
              >
                {repeatLimitReached ? "Limite atingido" : section.repeatable.addLabel}
              </button>
            </div>
          </div>
        ) : section.fields.length > 0 ? (
          <div className={styles.fieldGrid}>{renderFields(section)}</div>
        ) : null}

        <SectionPreview section={section} />
      </section>
    );
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
                <strong>{executionEnabled ? "Validação Master" : "Aguardando validação"}</strong>
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

        {executionEnabled ? (
          <DataState
            variant="warning"
            compact
            title="Motor oficial em validação Master"
            description="O cálculo usa a versão oficial identificada na referência viva. O resultado não é persistido nem constitui proposta comercial."
          />
        ) : (
          <DataState
            variant="unavailable"
            compact
            title={UNAVAILABLE_MESSAGE}
            description="Os campos permanecem disponíveis para conferência. Nenhum valor é calculado, persistido ou tratado como proposta comercial."
          />
        )}

        <div className={styles.workspace}>
          <form
            className={styles.form}
            aria-label={`Entradas de ${definition.title}`}
            onSubmit={(event) => {
              event.preventDefault();
              void executeOfficialSimulator();
            }}
          >
            {navigationGroups.length > 1 ? (
              <nav aria-label="Áreas da simulação" className={styles.simulatorNav} role="tablist">
                {navigationGroups.map((group, index) => {
                  const tabId = `simulator-tab-${definition.slug}-${index}`;
                  const panelId = `simulator-panel-${definition.slug}-${index}`;
                  const isActive = group === activeGroup;

                  return (
                    <a
                      aria-controls={panelId}
                      aria-selected={isActive}
                      href={`#${panelId}`}
                      id={tabId}
                      key={group}
                      onClick={(event) => {
                        event.preventDefault();
                        setRequestedGroup(group);
                      }}
                      onKeyDown={(event) => selectAdjacentTab(event, index)}
                      ref={(element) => {
                        tabRefs.current[index] = element;
                      }}
                      role="tab"
                      tabIndex={isActive ? 0 : -1}
                    >
                      {group}
                    </a>
                  );
                })}
              </nav>
            ) : null}

            {navigationGroups.length > 1
              ? navigationGroups.map((group, index) => {
                  const isActive = group === activeGroup;

                  return (
                    <div
                      aria-labelledby={`simulator-tab-${definition.slug}-${index}`}
                      className={styles.form}
                      hidden={!isActive}
                      id={`simulator-panel-${definition.slug}-${index}`}
                      key={group}
                      role="tabpanel"
                      tabIndex={0}
                    >
                      {definition.sections
                        .filter((section) => section.group === group)
                        .map(renderSection)}
                    </div>
                  );
                })
              : definition.sections.map(renderSection)}

            <div className={styles.actionBar}>
              <p>
                <strong>Preenchimento disponível.</strong>
                <span>
                  {executionEnabled
                    ? "Cálculo não persistente disponível somente para conferência Master."
                    : "Nenhum cálculo ou envio ao servidor será executado."}
                </span>
              </p>
              <div className={styles.simulatorNav}>
                <button
                  type="button"
                  className={styles.enabledAction}
                  data-cta-state="enabled"
                  onClick={clearFields}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  className={styles.enabledAction}
                  data-cta-state="enabled"
                  onClick={() => window.print()}
                >
                  Imprimir estrutura
                </button>
                {executionEnabled ? (
                  <button
                    type="submit"
                    disabled={executionStatus === "pending"}
                    className={styles.enabledAction}
                    data-cta-state="enabled"
                  >
                    {executionStatus === "pending" ? "Calculando…" : definition.actionLabel}
                  </button>
                ) : (
                  <span className={styles.blockedControl}>
                    <button
                      type="button"
                      disabled
                      className={styles.blockedAction}
                      data-cta-state="blocked"
                      aria-describedby="calculation-blocked-reason"
                    >
                      <LockIcon />
                      {definition.actionLabel}
                    </button>
                    <span id="calculation-blocked-reason" className={styles.blockedReason}>
                      Motor bloqueado. {executionReason}.
                    </span>
                  </span>
                )}
              </div>
            </div>
            {executionStatus === "error" ? (
              <DataState
                variant="error"
                compact
                title="Cálculo não concluído"
                description={executionError}
              />
            ) : null}
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
              {officialResult
                ? "Resultado determinístico da fórmula oficial versionada."
                : "Estrutura pronta para receber somente cálculo oficialmente validado."}
            </p>
            <dl className={styles.resultList}>
              {officialResult
                ? officialResult.rows.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>
                        <strong>{item.value}</strong>
                      </dd>
                    </div>
                  ))
                : definition.resultItems.map((item) => (
                    <div key={item}>
                      <dt>{item}</dt>
                      <dd>
                        <UnavailableValue reason={UNAVAILABLE_MESSAGE} />
                      </dd>
                    </div>
                  ))}
            </dl>
            <div className={styles.resultNotice}>
              {officialResult ? (
                <>
                  <strong>
                    {officialResult.ok
                      ? "Cálculo concluído para conferência."
                      : "Entradas rejeitadas pelas regras oficiais."}
                  </strong>
                  <span>Versão da fórmula: {officialResult.formulaVersion}</span>
                  {officialResult.errors.map((error) => (
                    <span key={error}>{error}</span>
                  ))}
                  {officialResult.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </>
              ) : (
                <>
                  <strong>{executionEnabled ? "Preencha e calcule." : UNAVAILABLE_MESSAGE}</strong>
                  <span>
                    {executionEnabled
                      ? "O cálculo será executado sem persistir os dados informados."
                      : "Nenhuma fórmula é executada enquanto o gate permanece desligado."}
                  </span>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
