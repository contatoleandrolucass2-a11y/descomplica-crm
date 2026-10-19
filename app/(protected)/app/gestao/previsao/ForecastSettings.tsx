"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  forecastDocumentSchema,
  forecastRecordSchema,
  forecastSnapshotSchema,
  type ForecastDocument,
} from "@/lib/crm/forecasts";
import { getForecastCalendar } from "@/lib/crm/forecast-calendar";

import analytics from "../../_components/analytics/analytics.module.css";
import styles from "./ForecastSettings.module.css";

import {
  createForecastDocument,
  normalizeForecastDocument,
  getForecastGroups,
  addForecastGroup,
  removeForecastGroup,
  moveForecastGroup,
  renameForecastGroup,
  forecastCellToCents,
  formatForecastCents,
  getForecastTotals,
  getForecastInvalidCells,
  FORECAST_MAX_GROUPS,
  type ForecastGroup,
} from "@/lib/crm/forecast-grid";

const initialDocument = createForecastDocument;
const ACTION_PLAN_COLUMN_ID = "action_plan";
const calendarWeekdays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const calendarMonths = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const calendarDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
function getCalendarDays(year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingDays = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  return [...days, ...Array.from({ length: (7 - (days.length % 7)) % 7 }, () => null)];
}

const documentOnly = (record: ForecastDocument): ForecastDocument => ({
  title: record.title,
  columns: record.columns,
  rows: record.rows,
});

type ForecastNavigationEvent = Event & {
  hashChange: boolean;
  destination: { url: string; sameDocument: boolean };
  navigationType: string;
};

type ForecastBrowserNavigation = {
  currentEntry?: { index: number };
  addEventListener: (
    type: "navigate" | "navigatesuccess" | "navigateerror",
    listener: (event: ForecastNavigationEvent) => void,
  ) => void;
  removeEventListener: (
    type: "navigate" | "navigatesuccess" | "navigateerror",
    listener: (event: ForecastNavigationEvent) => void,
  ) => void;
};

export function ForecastSettings() {
  const [document, setDocument] = useState<ForecastDocument>(initialDocument);
  const [baseline, setBaseline] = useState(() => JSON.stringify(document));
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLElement>(null);
  const calendarButton = useRef<HTMLButtonElement>(null);
  const calendarDialog = useRef<HTMLDialogElement>(null);
  const calendarCloseButton = useRef<HTMLButtonElement>(null);
  const draggedGroup = useRef<string | null>(null);
  const mounted = useRef(false);
  const [today] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => today.getMonth());
  const [calendarYear, setCalendarYear] = useState(() => today.getFullYear());
  const dirty = JSON.stringify(document) !== baseline;
  const editable = loaded && canEdit && !saving && !loading;
  const groups = getForecastGroups(document);
  const totals = getForecastTotals(document);
  const invalidCells = getForecastInvalidCells(document);
  const calendarDays = getCalendarDays(calendarYear, calendarMonth);
  const calendarWeeks = Array.from({ length: calendarDays.length / 7 }, (_, index) =>
    calendarDays.slice(index * 7, index * 7 + 7),
  );
  const calendarSummary = getForecastCalendar(calendarYear, calendarMonth + 1, today);
  const validatedDays = new Set(calendarSummary.validatedDays);
  const calendarYears = Array.from({ length: 21 }, (_, index) => today.getFullYear() - 5 + index);
  const actionPlanColumns = Math.min(
    60,
    Math.max(
      24,
      ...document.rows.map((row) =>
        Math.max(
          ...(row.cells[ACTION_PLAN_COLUMN_ID] ?? "").split("\n").map((line) => line.length),
        ),
      ),
    ),
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/forecasts", { cache: "no-store", signal: signal ?? null });
      if (!response.ok) throw new Error();
      const snapshot = forecastSnapshotSchema.parse(await response.json());
      if (!mounted.current || signal?.aborted) return;
      const original = snapshot.forecast ? documentOnly(snapshot.forecast) : initialDocument();
      const next = normalizeForecastDocument(original);
      setDocument(next);
      setBaseline(JSON.stringify(snapshot.can_edit ? original : next));
      setRevision(snapshot.forecast?.revision ?? 0);
      setCanEdit(snapshot.can_edit);
      setLoaded(true);
      setConflict(false);
      setNotice("");
    } catch {
      if (mounted.current && !signal?.aborted)
        setError("Não foi possível carregar a previsão do CRM. Tente novamente.");
    } finally {
      if (mounted.current && !signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const protectedLocation = new URL(window.location.href);
    const protectedHistoryState = window.history.state;
    const browserNavigation = (window as Window & { navigation?: ForecastBrowserNavigation })
      .navigation;
    const protectedHistoryIndex = browserNavigation?.currentEntry?.index;
    let restoringHistory = false;
    let approvedDestination: string | null = null;
    let unloadApproved = false;
    const destinationKey = (destination: URL) =>
      destination.origin + destination.pathname + destination.search;
    const confirmDiscard = () =>
      window.confirm("Existem alterações não salvas na previsão. Sair sem salvar?");
    const approveNavigation = (destination: URL) => {
      approvedDestination = destinationKey(destination);
    };
    const clearApproval = () => {
      approvedDestination = null;
      unloadApproved = false;
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unloadApproved) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== protectedLocation.origin) return;
      if (
        destination.pathname === protectedLocation.pathname &&
        destination.search === protectedLocation.search
      )
        return;
      if (approvedDestination === destinationKey(destination)) return;
      if (!confirmDiscard()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      approveNavigation(destination);
    };
    const confirmNavigationApi = (event: ForecastNavigationEvent) => {
      if (event.hashChange || !event.cancelable) return;
      // App Router commits history with the render; cancelling pushState cannot undo that render.
      if (event.destination.sameDocument && ["push", "replace"].includes(event.navigationType))
        return;
      const destination = new URL(event.destination.url);
      if (destination.origin !== protectedLocation.origin) return;
      if (
        event.navigationType !== "reload" &&
        destination.pathname === protectedLocation.pathname &&
        destination.search === protectedLocation.search
      )
        return;
      if (approvedDestination === destinationKey(destination)) {
        unloadApproved = !event.destination.sameDocument;
        return;
      }
      if (!confirmDiscard()) {
        event.preventDefault();
        return;
      }
      approveNavigation(destination);
      unloadApproved = !event.destination.sameDocument;
    };
    const confirmHistoryNavigation = (event: PopStateEvent) => {
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      const destination = new URL(window.location.href);
      if (
        destination.pathname === protectedLocation.pathname &&
        destination.search === protectedLocation.search
      )
        return;
      if (approvedDestination === destinationKey(destination)) return;
      if (confirmDiscard()) {
        approveNavigation(destination);
        return;
      }
      event.stopImmediatePropagation();
      const destinationHistoryIndex = browserNavigation?.currentEntry?.index;
      if (
        Number.isInteger(protectedHistoryIndex) &&
        Number.isInteger(destinationHistoryIndex) &&
        protectedHistoryIndex !== destinationHistoryIndex
      ) {
        restoringHistory = true;
        window.history.go(protectedHistoryIndex! - destinationHistoryIndex!);
        return;
      }
      window.history.pushState(protectedHistoryState, "", protectedLocation.href);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    browserNavigation?.addEventListener("navigate", confirmNavigationApi);
    browserNavigation?.addEventListener("navigatesuccess", clearApproval);
    browserNavigation?.addEventListener("navigateerror", clearApproval);
    window.addEventListener("popstate", confirmHistoryNavigation, true);
    globalThis.document.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      browserNavigation?.removeEventListener("navigate", confirmNavigationApi);
      browserNavigation?.removeEventListener("navigatesuccess", clearApproval);
      browserNavigation?.removeEventListener("navigateerror", clearApproval);
      window.removeEventListener("popstate", confirmHistoryNavigation, true);
      globalThis.document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [dirty]);

  function focusField(label: string) {
    requestAnimationFrame(() => {
      const field = Array.from(
        root.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea") ??
          [],
      ).find((element) => element.getAttribute("aria-label") === label);
      field?.focus();
    });
  }

  function change(next: ForecastDocument) {
    setDocument(next);
    setNotice("");
    setError(null);
  }

  function addRow() {
    if (!editable || document.rows.length >= 200) return;
    const row = {
      id: crypto.randomUUID(),
      cells: Object.fromEntries(document.columns.map((column) => [column.id, ""])),
    };
    change({ ...document, rows: [...document.rows, row] });
    focusField(`Nome do corretor, linha ${document.rows.length + 1}`);
  }

  function addColumn() {
    if (!editable || groups.length >= FORECAST_MAX_GROUPS) return;
    change(addForecastGroup(document));
    focusField(`Nome do empreendimento ${groups.length + 1}`);
  }

  function removeRow(index: number) {
    if (!editable) return;
    if (
      Object.values(document.rows[index]!.cells).some((cell) => cell.trim()) &&
      !window.confirm(
        `Excluir a linha ${index + 1} e todo o seu conteúdo? Salve para confirmar a exclusão no CRM.`,
      )
    )
      return;
    change({ ...document, rows: document.rows.filter((_, position) => position !== index) });
    if (document.rows.length > 1)
      focusField(`Nome do corretor, linha ${Math.min(index + 1, document.rows.length - 1)}`);
    else
      requestAnimationFrame(() =>
        root.current?.querySelector<HTMLButtonElement>("[data-add-row]")?.focus(),
      );
  }

  function removeGroup(group: ForecastGroup) {
    if (!editable) return;
    if (
      document.rows.some(
        (row) => row.cells[group.forecastId]?.trim() || row.cells[group.actualId]?.trim(),
      ) &&
      !window.confirm(
        `Excluir “${group.label}”, Previsão, Realizado e todos os valores? Salve para confirmar a exclusão no CRM.`,
      )
    )
      return;
    change(removeForecastGroup(document, group.id));
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLButtonElement>("[data-add-group]")?.focus(),
    );
  }

  function moveGroup(groupId: string, targetIndex: number) {
    if (!editable || targetIndex < 0 || targetIndex >= groups.length) return;
    change(moveForecastGroup(document, groupId, targetIndex));
    focusField(`Nome do empreendimento ${targetIndex + 1}`);
    setNotice(`Empreendimento movido para a posição ${targetIndex + 1}. Alterações não salvas.`);
  }

  function changeCell(rowId: string, columnId: string, value: string) {
    if (!editable) return;
    if (
      columnId !== "broker" &&
      columnId !== ACTION_PLAN_COLUMN_ID &&
      forecastCellToCents(value) === null
    ) {
      setError(
        "Previsão e Realizado aceitam somente números de 0 a 999.999.999,99, com até duas casas decimais.",
      );
      return;
    }
    change({
      ...document,
      rows: document.rows.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row,
      ),
    });
  }

  async function save() {
    if (!editable || conflict || !dirty) return;
    if (invalidCells.length) {
      setError(
        "Corrija os valores destacados: Previsão e Realizado aceitam somente números não negativos com até duas casas decimais.",
      );
      return;
    }
    const parsed = forecastDocumentSchema.safeParse(document);
    if (!parsed.success) {
      setError(
        "Preencha o nome de todos os empreendimentos antes de salvar. Respeite os limites da tabela.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/forecasts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, expected_revision: revision }),
      });
      if (response.status === 409) {
        setConflict(true);
        setError(
          "Outra pessoa salvou uma versão mais recente. Seu rascunho foi preservado. Copie o que precisar antes de carregar a versão salva.",
        );
        return;
      }
      if (response.status === 403) {
        setCanEdit(false);
        throw new Error("permission");
      }
      if (!response.ok) throw new Error();
      const record = forecastRecordSchema.parse(await response.json());
      if (!mounted.current) return;
      const next = documentOnly(record);
      setDocument(next);
      setBaseline(JSON.stringify(next));
      setRevision(record.revision);
      setNotice("Previsão salva no CRM.");
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error && cause.message === "permission"
            ? "Seu acesso de edição mudou. O rascunho foi preservado nesta tela."
            : "Não foi possível salvar no CRM. Seu rascunho foi preservado. Tente novamente.",
        );
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  function reload() {
    if (
      dirty &&
      !window.confirm("Descartar o rascunho desta tela e carregar a versão salva no CRM?")
    )
      return;
    void load();
  }

  function openCalendar() {
    if (!calendarDialog.current?.open) {
      calendarDialog.current?.showModal();
      requestAnimationFrame(() => calendarCloseButton.current?.focus());
    }
  }

  function closeCalendar() {
    calendarDialog.current?.close();
  }

  return (
    <section ref={root} className={analytics.canvasMain} aria-label="Previsão">
      <div className={`${analytics.canvas} ${styles.page}`}>
        <div className={styles.main}>
          <header className={styles.header}>
            <h1>Previsão</h1>
            <div className={styles.actions}>
              <button
                type="button"
                data-add-row
                disabled={!editable || document.rows.length >= 200}
                onClick={addRow}
              >
                <Plus size={16} aria-hidden="true" /> Inserir linha
              </button>
              <button
                type="button"
                data-add-group
                disabled={!editable || groups.length >= FORECAST_MAX_GROUPS}
                onClick={addColumn}
              >
                <Plus size={16} aria-hidden="true" /> Inserir coluna
              </button>
              <button ref={calendarButton} type="button" onClick={openCalendar}>
                <CalendarDays size={16} aria-hidden="true" /> Calendário
              </button>
              <button
                type="button"
                className={styles.save}
                disabled={!editable || !dirty || conflict || invalidCells.length > 0}
                onClick={() => void save()}
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </header>
          <p className={styles.srOnly} data-dirty={dirty} role="status" aria-live="polite">
            {loading
              ? "Carregando previsão…"
              : notice ||
                (dirty
                  ? "Alterações não salvas."
                  : loaded
                    ? "Tabela compartilhada no CRM."
                    : "Aguardando carregamento.")}
          </p>
          {loaded && !canEdit && (
            <p className={styles.notice}>Você tem acesso somente à leitura desta previsão.</p>
          )}
          {error && (
            <div role="alert" className={styles.error}>
              <p>{error}</p>
              {(!loaded || conflict) && (
                <button type="button" disabled={loading} onClick={reload}>
                  {conflict
                    ? "Descartar rascunho e carregar versão salva"
                    : "Tentar carregar novamente"}
                </button>
              )}
            </div>
          )}
          {invalidCells.length > 0 && (
            <p className={styles.error} role="alert">
              Há {invalidCells.length} valor(es) antigo(s) que precisam ser corrigidos. Os dados
              foram preservados; os totais afetados ficam indisponíveis até a correção.
            </p>
          )}
          <div
            className={styles.tableScroll}
            role="region"
            aria-label="Tabela de previsão"
            tabIndex={0}
            aria-busy={loading}
          >
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Previsão e realizado por corretor, agrupados por empreendimento. Tabela editável.
              </caption>
              <colgroup>
                <col className={styles.brokerColumn} />
                {groups.flatMap((group) => [
                  <col key={group.forecastId} className={styles.metricColumn} />,
                  <col key={group.actualId} className={styles.metricColumn} />,
                ])}
                <col className={styles.totalColumn} />
                <col className={styles.actionPlanColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" rowSpan={2} className={styles.brokerHeading}>
                    Nome do corretor
                  </th>
                  {groups.map((group, index) => (
                    <th
                      key={group.id}
                      scope="colgroup"
                      colSpan={2}
                      className={styles.groupHeading}
                      onDragOver={(event) => {
                        if (editable && draggedGroup.current) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = draggedGroup.current;
                        draggedGroup.current = null;
                        if (id) moveGroup(id, index);
                      }}
                    >
                      {groupHeading(group, index)}
                    </th>
                  ))}
                  <th scope="col" rowSpan={2} className={styles.totalHeading}>
                    Total
                  </th>
                  <th scope="col" rowSpan={2} className={styles.actionPlanHeading}>
                    Plano de ação
                  </th>
                </tr>
                <tr className={styles.metricHeadings}>
                  {groups.flatMap((group) => [
                    <th key={group.forecastId} scope="col">
                      Previsão
                    </th>,
                    <th key={group.actualId} scope="col">
                      Realizado
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {document.rows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row" className={styles.brokerCell}>
                      <div className={styles.brokerContent}>
                        <span className={styles.rowNumber}>{index + 1}</span>
                        <input
                          aria-label={`Nome do corretor, linha ${index + 1}`}
                          maxLength={4000}
                          readOnly={!editable}
                          value={row.cells.broker ?? ""}
                          dir="ltr"
                          onChange={(event) => changeCell(row.id, "broker", event.target.value)}
                        />
                        {canEdit && (
                          <button
                            type="button"
                            disabled={!editable}
                            aria-label={`Excluir linha ${index + 1}`}
                            onClick={() => removeRow(index)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </th>
                    {groups.flatMap((group) => [
                      numericCell(row, index, group, "Previsão", group.forecastId),
                      numericCell(row, index, group, "Realizado", group.actualId),
                    ])}
                    <td className={styles.totalCell}>
                      <span className={styles.mobileLabel}>Total</span>
                      <output aria-label={`Total, linha ${index + 1}`}>
                        {totalText(totals.rows[row.id])}
                      </output>
                    </td>
                    <td className={styles.actionPlanCell}>
                      <textarea
                        aria-label={`Plano de ação, linha ${index + 1}`}
                        cols={actionPlanColumns}
                        rows={3}
                        maxLength={4000}
                        readOnly={!editable}
                        value={row.cells[ACTION_PLAN_COLUMN_ID] ?? ""}
                        placeholder={
                          editable ? "Descreva ações para melhorar o desempenho" : undefined
                        }
                        onChange={(event) =>
                          changeCell(row.id, ACTION_PLAN_COLUMN_ID, event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className={styles.footerLabel}>
                    Total geral
                  </th>
                  {groups.flatMap((group) => [
                    <td key={group.forecastId}>
                      <span className={styles.mobileLabel}>{group.label} · Previsão</span>
                      <output aria-label={`Total de ${group.label} — Previsão`}>
                        {totalText(totals.columns[group.forecastId])}
                      </output>
                    </td>,
                    <td key={group.actualId}>
                      <span className={styles.mobileLabel}>{group.label} · Realizado</span>
                      <output aria-label={`Total de ${group.label} — Realizado`}>
                        {totalText(totals.columns[group.actualId])}
                      </output>
                    </td>,
                  ])}
                  <td className={styles.totalCell}>
                    <span className={styles.mobileLabel}>Total</span>
                    <output aria-label="Total geral">{totalText(totals.grandTotal)}</output>
                  </td>
                  <td
                    className={styles.actionPlanFooter}
                    aria-label="Plano de ação não possui total"
                  >
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
            {loaded && document.rows.length === 0 && (
              <div className={styles.empty}>
                <p>Nenhuma linha cadastrada.</p>
                {canEdit && <p>Use Inserir linha para começar sua previsão.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={calendarDialog}
        className={styles.calendarDialog}
        aria-labelledby="forecast-calendar-title"
        aria-describedby="forecast-calendar-description"
        onClose={() => calendarButton.current?.focus()}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeCalendar();
        }}
      >
        <div className={styles.calendarPanel}>
          <header className={styles.calendarHeader}>
            <div className={styles.calendarBadge} aria-hidden="true">
              {String(calendarSummary.remaining).padStart(2, "0")}
            </div>
            <div>
              <span>CALENDÁRIO DO MÊS</span>
              <h2 id="forecast-calendar-title">Dias validados estimados</h2>
            </div>
            <button
              ref={calendarCloseButton}
              type="button"
              className={styles.calendarClose}
              aria-label="Fechar calendário"
              onClick={closeCalendar}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className={styles.calendarTitleRow}>
            <div>
              <strong>
                {calendarMonths[calendarMonth]} de {calendarYear}
              </strong>
              <p id="forecast-calendar-description">Quinta a domingo · somente dias validados</p>
            </div>
            <span>{calendarSummary.total} dias validados</span>
          </div>
          <div className={styles.calendarFilters}>
            <label>
              <span>MÊS</span>
              <select
                aria-label="Mês do calendário"
                value={calendarMonth}
                onChange={(event) => setCalendarMonth(Number(event.target.value))}
              >
                {calendarMonths.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>ANO</span>
              <select
                aria-label="Ano do calendário"
                value={calendarYear}
                onChange={(event) => setCalendarYear(Number(event.target.value))}
              >
                {calendarYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.calendarGrid} role="grid" aria-label="Dias do mês">
            <div className={styles.calendarGridRow} role="row">
              {calendarWeekdays.map((weekday) => (
                <span key={weekday} className={styles.calendarWeekday} role="columnheader">
                  {weekday}
                </span>
              ))}
            </div>
            {calendarWeeks.map((week, weekIndex) => (
              <div className={styles.calendarGridRow} role="row" key={`week-${weekIndex}`}>
                {week.map((day, dayIndex) => {
                  if (day === null)
                    return (
                      <span
                        key={`empty-${dayIndex}`}
                        className={styles.calendarEmpty}
                        aria-hidden="true"
                      />
                    );
                  const date = new Date(calendarYear, calendarMonth, day);
                  const validated = validatedDays.has(day);
                  const current =
                    day === today.getDate() &&
                    calendarMonth === today.getMonth() &&
                    calendarYear === today.getFullYear();
                  const accessibleDate = calendarDateFormatter.format(date);
                  return (
                    <span
                      key={day}
                      role="gridcell"
                      aria-label={`${accessibleDate}${validated ? ", dia validado" : ""}`}
                      aria-current={current ? "date" : undefined}
                      className={`${styles.calendarDay} ${validated ? styles.calendarDayValidated : ""} ${current ? styles.calendarDayCurrent : ""}`}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className={styles.calendarSummary}>
            <div>
              <span>Total de dias validados</span>
              <strong>{calendarSummary.total}</strong>
              <small>no mês selecionado</small>
            </div>
            <div>
              <span>Dias validados passados</span>
              <strong>{calendarSummary.elapsed}</strong>
              <small>{calendarSummary.remaining} restantes</small>
            </div>
            <div className={styles.calendarRhythm}>
              <span>Ritmo por corretor</span>
              <strong>1 por dia validado</strong>
              <small>{calendarSummary.total} agendamentos no mês</small>
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );

  function totalText(value: number | null | undefined) {
    return value == null ? "—" : formatForecastCents(value);
  }

  function numericCell(
    row: ForecastDocument["rows"][number],
    index: number,
    group: ForecastGroup,
    metric: string,
    columnId: string,
  ) {
    const value = row.cells[columnId] ?? "";
    const invalid = forecastCellToCents(value) === null;
    return (
      <td key={columnId} className={styles.numericCell}>
        <span className={styles.mobileLabel}>
          {group.label} · {metric}
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={`${group.label} — ${metric}, linha ${index + 1}`}
          aria-invalid={invalid || undefined}
          title={
            invalid
              ? "Corrija este valor: use somente números não negativos, com até duas casas decimais."
              : value
          }
          readOnly={!editable}
          value={value}
          maxLength={invalid ? 4000 : 12}
          onChange={(event) => changeCell(row.id, columnId, event.target.value)}
        />
      </td>
    );
  }

  function groupHeading(group: ForecastGroup, index: number) {
    return (
      <div className={styles.columnHeading}>
        <textarea
          aria-label={`Nome do empreendimento ${index + 1}`}
          rows={2}
          maxLength={120}
          readOnly={!editable}
          value={group.label}
          onChange={(event) => change(renameForecastGroup(document, group.id, event.target.value))}
        />
        {canEdit && (
          <div className={styles.groupActions}>
            <span
              className={styles.dragHandle}
              draggable={editable}
              title={`Arrastar ${group.label}`}
              onDragStart={(event) => {
                if (!editable) {
                  event.preventDefault();
                  return;
                }
                draggedGroup.current = group.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", group.id);
              }}
              onDragEnd={() => {
                draggedGroup.current = null;
              }}
            >
              <GripVertical size={14} aria-hidden="true" />
            </span>
            <button
              type="button"
              aria-label={`Mover ${group.label} para a esquerda`}
              disabled={!editable || index === 0}
              onClick={() => moveGroup(group.id, index - 1)}
            >
              <ArrowLeft size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Mover ${group.label} para a direita`}
              disabled={!editable || index === groups.length - 1}
              onClick={() => moveGroup(group.id, index + 1)}
            >
              <ArrowRight size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Excluir ${group.label}`}
              disabled={!editable || groups.length <= 1}
              onClick={() => removeGroup(group)}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );
  }
}
