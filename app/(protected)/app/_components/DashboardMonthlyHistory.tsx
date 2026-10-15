"use client";

import { Info, X } from "lucide-react";
import { useId, useRef } from "react";

import { DASHBOARD_STAGES, type DashboardStageKey } from "@/lib/crm/dashboard/catalog";

import styles from "./DashboardMonthlyHistory.module.css";

export interface DashboardMonthlyHistoryMonth {
  month: string;
  readings: Array<{ key: DashboardStageKey; value: number | null }>;
}

export interface DashboardMonthlyHistoryProps {
  title: string;
  /** Closed months selected by the caller; this component never calculates periods or averages. */
  months: DashboardMonthlyHistoryMonth[];
  missingReason?: string;
  coverage?: string;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const stageKeys = Object.keys(DASHBOARD_STAGES) as DashboardStageKey[];

function monthLabel(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

function readingValue(month: DashboardMonthlyHistoryMonth, key: DashboardStageKey) {
  const value = month.readings.find((reading) => reading.key === key)?.value;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function DashboardMonthlyHistory({
  title,
  months,
  missingReason,
  coverage,
}: DashboardMonthlyHistoryProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const orderedMonths = [...months].sort((left, right) => left.month.localeCompare(right.month));
  const hasHistory = orderedMonths.some((month) =>
    stageKeys.some((key) => readingValue(month, key) !== null),
  );

  return (
    <div className={styles.heading}>
      <h3 className={styles.title}>{title}</h3>
      <button
        ref={triggerRef}
        type="button"
        className={styles.iconButton}
        aria-label={`Ver histórico mensal: ${title}`}
        title={`Ver histórico mensal: ${title}`}
        aria-haspopup="dialog"
        aria-controls={`${id}-dialog`}
        onClick={() => dialogRef.current?.showModal()}
      >
        <Info size={18} aria-hidden="true" focusable="false" />
      </button>
      <dialog
        ref={dialogRef}
        id={`${id}-dialog`}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onKeyDown={(event) => {
          // The close button is the only tab stop in this read-only dialog.
          if (event.key === "Tab") {
            event.preventDefault();
            closeRef.current?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          event.currentTarget.close();
        }}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <article className={styles.content}>
          <header className={styles.dialogHeader}>
            <h2 id={`${id}-title`}>{title}: histórico mensal</h2>
            <button
              ref={closeRef}
              type="button"
              className={styles.iconButton}
              aria-label="Fechar histórico mensal"
              title="Fechar histórico mensal"
              onClick={() => dialogRef.current?.close()}
            >
              <X size={20} aria-hidden="true" focusable="false" />
            </button>
          </header>
          {coverage ? <p className={styles.note}>{coverage}</p> : null}
          {missingReason ? <p className={styles.note}>{missingReason}</p> : null}
          <section aria-labelledby={`${id}-months`}>
            <h3 id={`${id}-months`} className={styles.sectionTitle}>
              Meses considerados ({orderedMonths.length})
            </h3>
            {orderedMonths.length ? (
              <ul className={styles.months}>
                {orderedMonths.map((month) => (
                  <li key={month.month}>
                    <time dateTime={month.month}>{monthLabel(month.month)}</time>
                  </li>
                ))}
              </ul>
            ) : null}
            {!hasHistory ? <p className={styles.note}>Sem histórico mensal disponível.</p> : null}
          </section>
          {orderedMonths.length ? (
            <div className={styles.charts}>
              {stageKeys.map((key) => {
                const values = orderedMonths.map((month) => readingValue(month, key));
                const maximum = Math.max(1, ...values.map((value) => value ?? 0));
                return (
                  <figure className={styles.chart} key={key} aria-labelledby={`${id}-${key}`}>
                    <figcaption id={`${id}-${key}`}>{DASHBOARD_STAGES[key].label}</figcaption>
                    <ol className={styles.readings}>
                      {orderedMonths.map((month, index) => {
                        const value = values[index] ?? null;
                        return (
                          <li className={styles.reading} key={month.month}>
                            <time dateTime={month.month}>{monthLabel(month.month)}</time>
                            <svg
                              viewBox="0 0 100 16"
                              preserveAspectRatio="none"
                              className={styles.bar}
                              aria-hidden="true"
                              focusable="false"
                            >
                              <rect className={styles.track} width="100" height="16" rx="2" />
                              {value !== null ? (
                                <rect
                                  className={styles.value}
                                  width={(value / maximum) * 100}
                                  height="16"
                                  rx="2"
                                />
                              ) : null}
                            </svg>
                            <span className={styles.count}>
                              {value === null ? "Sem histórico" : numberFormatter.format(value)}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </figure>
                );
              })}
            </div>
          ) : null}
        </article>
      </dialog>
    </div>
  );
}
