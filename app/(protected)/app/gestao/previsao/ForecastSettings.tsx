"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  forecastDocumentSchema,
  forecastRecordSchema,
  forecastSnapshotSchema,
  type ForecastDocument,
} from "@/lib/crm/forecasts";

import "@/app/(protected)/app/simulacao/_components/archive-investor/investor-theme-tokens.css";
import styles from "./ForecastSettings.module.css";

const initialDocument = (): ForecastDocument => ({
  title: "Equipe",
  columns: [
    { id: "broker", label: "Nome do corretor" },
    { id: "forecast", label: "Previsão" },
    { id: "actual", label: "Realizado" },
  ],
  rows: [],
});
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
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialDocument()));
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const dirty = JSON.stringify(document) !== baseline;
  const editable = loaded && canEdit && !saving && !loading;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/forecasts", { cache: "no-store", signal: signal ?? null });
      if (!response.ok) throw new Error();
      const snapshot = forecastSnapshotSchema.parse(await response.json());
      if (!mounted.current || signal?.aborted) return;
      const next = snapshot.forecast ? documentOnly(snapshot.forecast) : initialDocument();
      setDocument(next);
      setBaseline(JSON.stringify(next));
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
        root.current?.querySelectorAll<HTMLTextAreaElement>("textarea") ?? [],
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
    focusField(`${document.columns[0]!.label}, linha ${document.rows.length + 1}`);
  }

  function addColumn() {
    if (!editable || document.columns.length >= 30) return;
    const column = { id: crypto.randomUUID(), label: `Coluna ${document.columns.length + 1}` };
    change({
      ...document,
      columns: [...document.columns, column],
      rows: document.rows.map((row) => ({ ...row, cells: { ...row.cells, [column.id]: "" } })),
    });
    focusField(`Nome da coluna ${document.columns.length + 1}`);
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
      focusField(
        `${document.columns[0]!.label}, linha ${Math.min(index + 1, document.rows.length - 1)}`,
      );
    else
      requestAnimationFrame(() =>
        root.current?.querySelector<HTMLButtonElement>("[data-add-row]")?.focus(),
      );
  }

  function removeColumn(index: number) {
    if (!editable || document.columns.length <= 1) return;
    const column = document.columns[index]!;
    if (
      (column.label.trim() || document.rows.some((row) => row.cells[column.id]?.trim())) &&
      !window.confirm(
        `Excluir a coluna “${column.label}” e todo o seu conteúdo? Salve para confirmar a exclusão no CRM.`,
      )
    )
      return;
    change({
      ...document,
      columns: document.columns.filter((_, position) => position !== index),
      rows: document.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(Object.entries(row.cells).filter(([id]) => id !== column.id)),
      })),
    });
    focusField(`Nome da coluna ${Math.min(index + 1, document.columns.length - 1)}`);
  }

  async function save() {
    if (!editable || conflict || !dirty) return;
    const parsed = forecastDocumentSchema.safeParse(document);
    if (!parsed.success) {
      setError(
        "Preencha o nome de todas as colunas antes de salvar. Respeite os limites da tabela.",
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

  return (
    <section ref={root} className={`${styles.page} investor-page-shell`} aria-label="Previsão">
      <div className={`${styles.main} investor-main`}>
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
              disabled={!editable || document.columns.length >= 30}
              onClick={addColumn}
            >
              <Plus size={16} aria-hidden="true" /> Inserir coluna
            </button>
            <button
              type="button"
              className={styles.save}
              disabled={!editable || !dirty || conflict}
              onClick={() => void save()}
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </header>
        <p className={styles.status} role="status" aria-live="polite">
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
        <p className={styles.help} id="forecast-help">
          Edite diretamente na tabela. Até 200 linhas e 30 colunas; 120 caracteres nos títulos e
          4.000 por célula. Use Salvar para compartilhar as alterações.
        </p>
        <div
          className={styles.tableScroll}
          role="region"
          aria-label="Tabela de previsão"
          tabIndex={0}
          aria-describedby="forecast-help"
          aria-busy={loading}
        >
          <table
            className={styles.table}
            style={{ minWidth: Math.max(600, document.columns.length * 210 + 60) }}
          >
            <caption className={styles.srOnly}>
              Previsão e realizado por corretor. Tabela editável.
            </caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className={styles.rowNumber}>
                  Linha
                </th>
                {document.columns.length > 1 ? (
                  <>
                    <th scope="col" rowSpan={2}>
                      {columnHeading(0)}
                    </th>
                    <th scope="colgroup" colSpan={document.columns.length - 1}>
                      <textarea
                        aria-label="Nome da equipe"
                        rows={1}
                        maxLength={120}
                        readOnly={!editable}
                        value={document.title}
                        onChange={(event) => change({ ...document, title: event.target.value })}
                      />
                    </th>
                  </>
                ) : (
                  <th scope="col">
                    <textarea
                      aria-label="Nome da equipe"
                      rows={1}
                      maxLength={120}
                      readOnly={!editable}
                      value={document.title}
                      onChange={(event) => change({ ...document, title: event.target.value })}
                    />
                  </th>
                )}
                <th scope="col" rowSpan={2} className={styles.rowAction}>
                  <span className={styles.srOnly}>Ações</span>
                </th>
              </tr>
              <tr>
                {document.columns.map(
                  (_, index) =>
                    (document.columns.length === 1 || index > 0) && (
                      <th key={document.columns[index]!.id} scope="col">
                        {columnHeading(index)}
                      </th>
                    ),
                )}
              </tr>
            </thead>
            <tbody>
              {document.rows.map((row, index) => (
                <tr key={row.id}>
                  <th scope="row" className={styles.rowNumber}>
                    {index + 1}
                  </th>
                  {document.columns.map((column) => (
                    <td key={column.id}>
                      <textarea
                        aria-label={`${column.label || `Coluna ${document.columns.indexOf(column) + 1}`}, linha ${index + 1}`}
                        rows={2}
                        maxLength={4000}
                        readOnly={!editable}
                        value={row.cells[column.id] ?? ""}
                        onChange={(event) =>
                          change({
                            ...document,
                            rows: document.rows.map((current) =>
                              current.id === row.id
                                ? {
                                    ...current,
                                    cells: { ...current.cells, [column.id]: event.target.value },
                                  }
                                : current,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td className={styles.rowAction}>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={!editable}
                        aria-label={`Excluir linha ${index + 1}`}
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loaded && document.rows.length === 0 && (
            <div className={styles.empty}>
              <p>Nenhuma linha cadastrada.</p>
              {canEdit && <p>Use Inserir linha para começar sua previsão.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  function columnHeading(index: number) {
    const column = document.columns[index]!;
    return (
      <div className={styles.columnHeading}>
        <textarea
          aria-label={`Nome da coluna ${index + 1}`}
          rows={2}
          maxLength={120}
          readOnly={!editable}
          value={column.label}
          onChange={(event) =>
            change({
              ...document,
              columns: document.columns.map((current) =>
                current.id === column.id ? { ...current, label: event.target.value } : current,
              ),
            })
          }
        />
        {canEdit && (
          <button
            type="button"
            aria-label={`Excluir coluna ${index + 1}: ${column.label}`}
            disabled={!editable || document.columns.length <= 1}
            onClick={() => removeColumn(index)}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
}
