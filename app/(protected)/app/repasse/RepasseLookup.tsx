"use client";

import { ArrowLeft, Building2, LoaderCircle, Search } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import type { RepasseLookupState, RepasseRecord } from "@/lib/crm/repasse/contracts";

import { lookupRepasseAction } from "./actions";
import styles from "./RepasseLookup.module.css";

const initialState: RepasseLookupState = { status: "idle" };

function displayValue(value: string | null) {
  return value ?? <span className={styles.emptyValue}>Não informado</span>;
}

function statusTone(status: string | null) {
  const normalized =
    status
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? "";
  if (/REPASS|CONCLUID|ASSINAD/u.test(normalized)) return styles.statusPositive;
  if (/DESIST|REPROV|CANCEL/u.test(normalized)) return styles.statusDanger;
  if (/PEND|AGUARD|ANDAMENTO|ENTREVISTA/u.test(normalized)) return styles.statusWarning;
  return styles.statusNeutral;
}

function SourceUpdate({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <p className={styles.sourceUpdate}>
      {lastUpdated
        ? `Data da última atualização: ${lastUpdated}`
        : "Data da última atualização não informada pela fonte."}
    </p>
  );
}

function ResultTable({ record }: { record: RepasseRecord }) {
  return (
    <div
      className={styles.tableFrame}
      role="region"
      aria-label="Resultado detalhado do repasse"
      tabIndex={0}
    >
      <table className={styles.resultTable}>
        <caption className={styles.srOnly}>
          Dados de repasse localizados para o FID consultado
        </caption>
        <thead>
          <tr>
            <th scope="col">Empreendimento</th>
            <th scope="col">Etapa</th>
            <th scope="col">Status</th>
            <th scope="col">Nome do cliente</th>
            <th scope="col">Motivo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="Empreendimento">{displayValue(record.empreendimento)}</td>
            <td data-label="Etapa">{displayValue(record.etapa)}</td>
            <td data-label="Status">
              <span className={`${styles.statusBadge} ${statusTone(record.status)}`}>
                {displayValue(record.status)}
              </span>
            </td>
            <td data-label="Nome do cliente">{displayValue(record.nomeCliente)}</td>
            <td data-label="Motivo">{displayValue(record.motivo)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NewLookupLink() {
  return (
    <a className={styles.secondaryAction} href="/app/repasse">
      Nova consulta
    </a>
  );
}

export function RepasseLookup() {
  const [state, formAction, pending] = useActionState(lookupRepasseAction, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const invalid = state.status === "validation_error";

  useEffect(() => {
    if (invalid) inputRef.current?.focus();
  }, [invalid]);

  const describedBy = invalid ? "repasse-fid-help repasse-fid-error" : "repasse-fid-help";

  return (
    <main className={styles.page}>
      <section className={styles.lookupPanel} aria-labelledby="repasse-page-title">
        <header className={styles.panelHeader}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Building2 />
          </span>
          <div>
            <p className={styles.eyebrow}>
              Assessoria <span translate="no">M.A.P DE CAMPOS SOLUÇÕES</span>
            </p>
            <h1 id="repasse-page-title">Consulta de repasse</h1>
          </div>
        </header>

        <div className={styles.formArea} id="consulta-repasse">
          <div className={styles.formCard}>
            <h2>Consulte o repasse do cliente pelo FID</h2>
            <p className={styles.formIntro}>
              Informe o número exato para consultar o acompanhamento online da assessoria.
            </p>
            <form action={formAction} aria-busy={pending} className={styles.form}>
              <label htmlFor="repasse-fid">Número do FID</label>
              <input
                ref={inputRef}
                id="repasse-fid"
                name="fid"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                pattern="[0-9]{1,12}"
                maxLength={12}
                placeholder="Ex.: 123456"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                required
              />
              <p id="repasse-fid-help" className={styles.fieldHelp}>
                Use somente os números do FID.
              </p>
              {invalid ? (
                <p id="repasse-fid-error" className={styles.fieldError} role="alert">
                  {state.message}
                </p>
              ) : null}
              <button type="submit" className={styles.primaryAction} disabled={pending}>
                {pending ? (
                  <LoaderCircle className={styles.spinner} aria-hidden="true" />
                ) : (
                  <Search aria-hidden="true" />
                )}
                <span>{pending ? "Consultando…" : "Consultar repasse"}</span>
              </button>
            </form>
            <p className={styles.privacyNote}>
              A consulta é protegida e exibe somente o cadastro correspondente ao FID informado.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.feedbackRegion} aria-live="polite" aria-busy={pending}>
        {state.status === "ready" ? (
          <article className={styles.resultPanel} aria-labelledby="repasse-result-title">
            <a className={styles.backLink} href="#consulta-repasse">
              <ArrowLeft aria-hidden="true" />
              Voltar à consulta
            </a>
            <header className={styles.resultHeader}>
              <div>
                <div className={styles.resultTitleRow}>
                  <h2 id="repasse-result-title">Resultado da consulta</h2>
                  <span className={styles.fidBadge}>FID {state.fid}</span>
                </div>
                <SourceUpdate lastUpdated={state.lastUpdated} />
              </div>
              <NewLookupLink />
            </header>
            <ResultTable record={state.record} />
            <p className={styles.sourceNote}>
              Fonte: acompanhamento online de repasse da assessoria M.A.P DE CAMPOS SOLUÇÕES.
            </p>
          </article>
        ) : null}

        {state.status === "not_found" ? (
          <article className={`${styles.statePanel} ${styles.stateNeutral}`}>
            <p className={styles.stateKicker}>FID {state.fid}</p>
            <h2>Nenhum repasse localizado</h2>
            <p>{state.message}</p>
            <SourceUpdate lastUpdated={state.lastUpdated} />
            <NewLookupLink />
          </article>
        ) : null}

        {state.status === "source_conflict" ? (
          <article className={`${styles.statePanel} ${styles.stateWarning}`} role="alert">
            <p className={styles.stateKicker}>FID {state.fid}</p>
            <h2>Cadastro precisa de conferência</h2>
            <p>{state.message}</p>
            <NewLookupLink />
          </article>
        ) : null}

        {state.status === "unavailable" ? (
          <article className={`${styles.statePanel} ${styles.stateDanger}`} role="alert">
            <p className={styles.stateKicker}>Consulta indisponível</p>
            <h2>Não foi possível consultar agora</h2>
            <p>{state.message}</p>
            <NewLookupLink />
          </article>
        ) : null}
      </section>
    </main>
  );
}
