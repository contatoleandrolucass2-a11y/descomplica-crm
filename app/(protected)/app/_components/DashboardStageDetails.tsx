"use client";

import { X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { DashboardStageDetailRow } from "@/lib/crm/dashboard/analysis";
import type { DashboardFunnelKey } from "@/lib/crm/dashboard/presentation";

import styles from "./DashboardStageDetails.module.css";

export interface DashboardStageDetailPeriod {
  label: string;
  months?: readonly string[];
  start?: string;
  end?: string;
  note?: string;
}

interface Selection {
  stage: DashboardFunnelKey;
  stageLabel: string;
  cardLabel: string;
  period: DashboardStageDetailPeriod;
}

interface ContextValue {
  open: (selection: Selection) => void;
}

const StageDetailsContext = createContext<ContextValue | null>(null);
const pageSize = 50;
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const filterFields = ["channel", "manager", "owner", "company", "development"] as const;
const labels = {
  date: "Data",
  channel: "Canal de vendas",
  manager: "Gerente de vendas",
  owner: "Responsável da conta",
  company: "Empresa",
  development: "Empreendimento",
  quantity: "Quantidade",
} as const;

function dateLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? dateFormatter.format(new Date(`${value}T00:00:00Z`))
    : value;
}

function inPeriod(row: DashboardStageDetailRow, period: DashboardStageDetailPeriod) {
  if (period.months) return period.months.includes(row.date.slice(0, 7));
  return (!period.start || row.date >= period.start) && (!period.end || row.date <= period.end);
}

export function DashboardStageDetailsProvider({
  rows,
  children,
}: {
  rows: readonly DashboardStageDetailRow[];
  children: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [filters, setFilters] = useState<Record<(typeof filterFields)[number], string>>({
    channel: "",
    manager: "",
    owner: "",
    company: "",
    development: "",
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selection || dialog.current?.open) return;
    dialog.current?.showModal();
    closeButton.current?.focus();
  }, [selection]);

  const scopedRows = useMemo(
    () =>
      selection
        ? rows.filter((row) => row.stage === selection.stage && inPeriod(row, selection.period))
        : [],
    [rows, selection],
  );
  const options = useMemo(
    () =>
      Object.fromEntries(
        filterFields.map((field) => [
          field,
          [...new Set(scopedRows.map((row) => row[field]).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, "pt-BR"),
          ),
        ]),
      ) as Record<(typeof filterFields)[number], string[]>,
    [scopedRows],
  );
  const visibleFields = filterFields.filter((field) => options[field].length > 0);
  const filteredRows = scopedRows.filter((row) =>
    filterFields.every((field) => !filters[field] || row[field] === filters[field]),
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const total = filteredRows.reduce((sum, row) => sum + row.quantity, 0);

  const close = () => {
    dialog.current?.close();
    setSelection(null);
  };

  return (
    <StageDetailsContext.Provider
      value={{
        open: (next) => {
          setFilters({ channel: "", manager: "", owner: "", company: "", development: "" });
          setPage(1);
          setSelection(next);
        },
      }}
    >
      {children}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => setSelection(null)}
      >
        {selection ? (
          <article className={styles.content}>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>{selection.cardLabel}</p>
                <h2 id={`${id}-title`}>{selection.stageLabel}</h2>
                <p>{selection.period.label}</p>
              </div>
              <button
                ref={closeButton}
                type="button"
                className={styles.close}
                aria-label="Fechar detalhamento da etapa"
                onClick={close}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            {selection.period.note ? <p className={styles.note}>{selection.period.note}</p> : null}
            <div className={styles.summary} role="status">
              <span>{numberFormatter.format(total)} registros no recorte</span>
              <span>{numberFormatter.format(filteredRows.length)} combinações</span>
            </div>
            {visibleFields.length ? (
              <fieldset className={styles.filters}>
                <legend>Filtrar colunas do relatório</legend>
                {visibleFields.map((field) => (
                  <label key={field}>
                    <span>{labels[field]}</span>
                    <select
                      value={filters[field]}
                      onChange={(event) => {
                        setFilters((current) => ({ ...current, [field]: event.target.value }));
                        setPage(1);
                      }}
                    >
                      <option value="">Todos</option>
                      {options[field].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {visibleRows.length ? (
              <div className={styles.tableRegion} tabIndex={0} aria-label="Detalhes da etapa">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{labels.date}</th>
                      {visibleFields.map((field) => (
                        <th scope="col" key={field}>
                          {labels[field]}
                        </th>
                      ))}
                      <th scope="col">{labels.quantity}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => (
                      <tr key={`${row.stage}-${row.date}-${index}`}>
                        <td data-label={labels.date}>{dateLabel(row.date)}</td>
                        {visibleFields.map((field) => (
                          <td data-label={labels[field]} key={field}>
                            {row[field] || "Não informado"}
                          </td>
                        ))}
                        <td data-label={labels.quantity}>{numberFormatter.format(row.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>Nenhum registro encontrado para este recorte.</p>
            )}
            {totalPages > 1 ? (
              <nav className={styles.pagination} aria-label="Paginação do detalhamento">
                <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </button>
                <span>
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </nav>
            ) : null}
          </article>
        ) : null}
      </dialog>
    </StageDetailsContext.Provider>
  );
}

export function DashboardStageDetailTrigger({
  stage,
  stageLabel,
  cardLabel,
  period,
}: {
  stage: DashboardFunnelKey;
  stageLabel: string;
  cardLabel: string;
  period: DashboardStageDetailPeriod;
}) {
  const context = useContext(StageDetailsContext);
  if (!context) return null;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-label={`Abrir detalhes de ${stageLabel}: ${cardLabel}`}
      onClick={() => context.open({ stage, stageLabel, cardLabel, period })}
    />
  );
}
