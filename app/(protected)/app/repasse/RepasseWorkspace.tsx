"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListChecks,
  LoaderCircle,
  Search,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type {
  RepasseBoardColumn,
  RepasseBoardRecord,
  RepasseLookupState,
  RepasseOverviewState,
} from "@/lib/crm/repasse/contracts";

import { getRepasseDetailAction } from "./actions";
import { RepasseLookup } from "./RepasseLookup";
import styles from "./RepasseWorkspace.module.css";

const COLUMN_DEFINITIONS: ReadonlyArray<{
  key: RepasseBoardColumn;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
}> = [
  {
    key: "repassado",
    title: "Repassado",
    description: "Repasse concluído",
    icon: CheckCircle2,
  },
  {
    key: "pendencia",
    title: "Pendência",
    description: "Aguardando alguma etapa",
    icon: Clock3,
  },
  {
    key: "mais_de_20_dias",
    title: "Mais de 20 dias",
    description: "Prazo sinalizado na fonte",
    icon: Timer,
  },
  {
    key: "distrato",
    title: "Distrato / desistência",
    description: "Venda não seguirá para repasse",
    icon: XCircle,
  },
];

const ALL_PROJECTS = "__all_projects__";
const ALL_STATUSES = "__all_statuses__";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function recordMatchesSearch(record: RepasseBoardRecord, search: string) {
  if (!search) return true;
  return normalizeSearch(
    [record.nomeCliente, record.fid, record.empreendimento, record.etapa, record.status]
      .filter(Boolean)
      .join(" "),
  ).includes(search);
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}

function isValidFid(fid: string | null): fid is string {
  return typeof fid === "string" && /^[0-9]{1,12}$/u.test(fid.trim());
}

function DetailMessage({ state }: { state: RepasseLookupState }) {
  if (state.status === "idle" || state.status === "ready") return null;

  const title =
    state.status === "validation_error"
      ? "Detalhe completo indisponível"
      : state.status === "not_found"
        ? "Cadastro não localizado"
        : state.status === "source_conflict"
          ? "Cadastro precisa de conferência"
          : "Não foi possível carregar o detalhe";

  return (
    <div className={styles.detailMessage} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{state.message}</p>
      </div>
    </div>
  );
}

function RepasseCard({
  record,
  onOpen,
}: {
  record: RepasseBoardRecord;
  onOpen: (record: RepasseBoardRecord, trigger: HTMLButtonElement) => void;
}) {
  const client = displayValue(record.nomeCliente);
  const fid = displayValue(record.fid);

  return (
    <button
      type="button"
      className={styles.repasseCard}
      data-column={record.column}
      aria-label={`${client}, FID ${fid}`}
      onClick={(event) => onOpen(record, event.currentTarget)}
    >
      <span className={styles.cardTopline}>
        <span className={styles.cardFid}>FID {fid}</span>
        <ChevronRight aria-hidden="true" />
      </span>
      <strong className={styles.cardClient}>{client}</strong>
      <span className={styles.cardMeta}>
        <Building2 aria-hidden="true" />
        <span>{displayValue(record.empreendimento)}</span>
      </span>
      <span className={styles.cardMeta}>
        <ListChecks aria-hidden="true" />
        <span>{displayValue(record.etapa)}</span>
      </span>
      <span className={styles.cardStatus}>{displayValue(record.status)}</span>
    </button>
  );
}

export function RepasseWorkspace({ overviewState }: { overviewState: RepasseOverviewState }) {
  const [activeTab, setActiveTab] = useState<"overview" | "lookup">("overview");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState(ALL_PROJECTS);
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [selected, setSelected] = useState<RepasseBoardRecord | null>(null);
  const [detailState, setDetailState] = useState<RepasseLookupState>({ status: "idle" });
  const [detailLoading, setDetailLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const detailRequestRef = useRef(0);

  const records = useMemo(
    () => (overviewState.status === "ready" ? overviewState.overview.records : []),
    [overviewState],
  );
  const lastUpdated = overviewState.status === "ready" ? overviewState.overview.lastUpdated : null;

  const projects = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.empreendimento?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [records],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        COLUMN_DEFINITIONS.map((column) => [
          column.key,
          records.filter((record) => record.column === column.key).length,
        ]),
      ) as Record<RepasseBoardColumn, number>,
    [records],
  );

  const normalizedQuery = normalizeSearch(deferredSearch);
  const filteredRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          (project === ALL_PROJECTS || record.empreendimento?.trim() === project) &&
          (status === ALL_STATUSES || record.column === status) &&
          recordMatchesSearch(record, normalizedQuery),
      ),
    [normalizedQuery, project, records, status],
  );

  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setSelected(null);
    setDetailLoading(false);
    setDetailState({ status: "idle" });
  }, []);

  useEffect(() => {
    if (!selected) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetail();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      openerRef.current?.focus();
    };
  }, [closeDetail, selected]);

  const openDetail = useCallback(async (record: RepasseBoardRecord, trigger: HTMLButtonElement) => {
    openerRef.current = trigger;
    setSelected(record);
    setDetailState({ status: "idle" });

    if (!isValidFid(record.fid)) {
      setDetailState({
        status: "validation_error",
        message:
          "Este item não possui um FID numérico válido na fonte. Os dados disponíveis no quadro continuam exibidos abaixo.",
      });
      return;
    }

    const fid = record.fid.trim();
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    try {
      const result = await getRepasseDetailAction(fid);
      if (detailRequestRef.current === requestId) setDetailState(result);
    } catch {
      if (detailRequestRef.current === requestId) {
        setDetailState({
          status: "unavailable",
          message: "Não foi possível carregar o detalhe agora. Tente novamente em instantes.",
        });
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }, []);

  const detailRecord = detailState.status === "ready" ? detailState.record : selected;

  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            <Building2 />
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              Assessoria <span translate="no">M.A.P DE CAMPOS SOLUÇÕES</span>
            </p>
            <h1>Consulta de repasses</h1>
            <p>
              Acompanhe cada cliente por etapa, encontre pendências e abra os dados detalhados do
              repasse.
            </p>
          </div>
          <div className={styles.sourceBadge}>
            <span>Última atualização</span>
            <strong>{lastUpdated || "Não informada"}</strong>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Navegação de repasses">
          <button
            type="button"
            role="tab"
            id="repasse-tab-overview"
            aria-controls="repasse-panel-overview"
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          >
            Visão geral
          </button>
          <button
            type="button"
            role="tab"
            id="repasse-tab-lookup"
            aria-controls="repasse-panel-lookup"
            aria-selected={activeTab === "lookup"}
            onClick={() => setActiveTab("lookup")}
          >
            Consulta por FID
          </button>
        </div>

        {activeTab === "overview" ? (
          <section
            className={styles.overviewPanel}
            id="repasse-panel-overview"
            role="tabpanel"
            aria-labelledby="repasse-tab-overview"
          >
            {overviewState.status === "unavailable" ? (
              <div className={styles.unavailable} role="alert">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <h2>Visão geral indisponível</h2>
                  <p>{overviewState.message}</p>
                  <button type="button" onClick={() => setActiveTab("lookup")}>
                    Consultar por FID
                  </button>
                </div>
              </div>
            ) : (
              <>
                <section className={styles.metrics} aria-label="Resumo dos repasses">
                  {COLUMN_DEFINITIONS.map((column) => {
                    const Icon = column.icon;
                    const active = status === column.key;
                    return (
                      <button
                        type="button"
                        className={styles.metricCard}
                        data-column={column.key}
                        aria-pressed={active}
                        aria-label={`${column.title}: ${counts[column.key]}. ${active ? "Remover filtro" : "Filtrar por este status"}`}
                        onClick={() => setStatus(active ? ALL_STATUSES : column.key)}
                        key={column.key}
                      >
                        <span className={styles.metricIcon}>
                          <Icon aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{counts[column.key]}</strong>
                          <small>{column.title}</small>
                        </span>
                      </button>
                    );
                  })}
                </section>

                <section className={styles.filters} aria-label="Filtros da visão geral">
                  <label className={styles.searchField}>
                    <span>Buscar cliente ou FID</span>
                    <span className={styles.inputShell}>
                      <Search aria-hidden="true" />
                      <input
                        name="repasse-search"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Digite um nome ou número…"
                      />
                    </span>
                  </label>
                  <label>
                    <span>Filtrar por empreendimento</span>
                    <select
                      name="repasse-project"
                      value={project}
                      onChange={(event) => setProject(event.target.value)}
                    >
                      <option value={ALL_PROJECTS}>Todos os empreendimentos</option>
                      {projects.map((projectName) => (
                        <option value={projectName} key={projectName}>
                          {projectName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Filtrar por status</span>
                    <select
                      name="repasse-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value={ALL_STATUSES}>Todos os status</option>
                      {COLUMN_DEFINITIONS.map((column) => (
                        <option value={column.key} key={column.key}>
                          {column.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                <div className={styles.resultSummary} aria-live="polite">
                  <strong>{filteredRecords.length}</strong>{" "}
                  {filteredRecords.length === 1 ? "cliente exibido" : "clientes exibidos"}
                </div>

                <section className={styles.board} aria-label="Quadro de repasses">
                  {COLUMN_DEFINITIONS.map((column) => {
                    const columnRecords = filteredRecords.filter(
                      (record) => record.column === column.key,
                    );
                    const Icon = column.icon;
                    return (
                      <section
                        className={styles.boardColumn}
                        data-column={column.key}
                        aria-labelledby={`repasse-column-${column.key}`}
                        key={column.key}
                      >
                        <header className={styles.columnHeader}>
                          <span className={styles.columnIcon} aria-hidden="true">
                            <Icon />
                          </span>
                          <div>
                            <h2 id={`repasse-column-${column.key}`}>{column.title}</h2>
                            <p>{column.description}</p>
                          </div>
                          <strong aria-label={`${columnRecords.length} itens`}>
                            {columnRecords.length}
                          </strong>
                        </header>
                        <div className={styles.cardList}>
                          {columnRecords.length ? (
                            columnRecords.map((record) => (
                              <RepasseCard
                                record={record}
                                onOpen={openDetail}
                                key={`${record.sourceRow}-${record.fid ?? "sem-fid"}`}
                              />
                            ))
                          ) : (
                            <p className={styles.emptyColumn}>Nenhum cliente neste status.</p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </section>
              </>
            )}
          </section>
        ) : (
          <section
            className={styles.lookupTab}
            id="repasse-panel-lookup"
            role="tabpanel"
            aria-labelledby="repasse-tab-lookup"
          >
            <RepasseLookup embedded />
          </section>
        )}
      </div>

      {selected ? (
        <div className={styles.dialogBackdrop}>
          <section
            ref={dialogRef}
            className={styles.detailDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do repasse"
          >
            <header className={styles.detailHeader} data-column={selected.column}>
              <div>
                <p>FID {displayValue(selected.fid)}</p>
                <h2>{displayValue(selected.nomeCliente)}</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                aria-label="Fechar detalhes"
                onClick={closeDetail}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className={styles.detailBody} aria-busy={detailLoading}>
              {detailLoading ? (
                <div className={styles.detailLoading} role="status">
                  <LoaderCircle aria-hidden="true" />
                  Carregando dados completos…
                </div>
              ) : (
                <DetailMessage state={detailState} />
              )}

              {detailRecord ? (
                <dl className={styles.detailGrid}>
                  <div>
                    <dt>Cliente</dt>
                    <dd>{displayValue(detailRecord.nomeCliente)}</dd>
                  </div>
                  <div>
                    <dt>Empreendimento</dt>
                    <dd>{displayValue(detailRecord.empreendimento)}</dd>
                  </div>
                  <div>
                    <dt>Etapa</dt>
                    <dd>{displayValue(detailRecord.etapa)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{displayValue(detailRecord.status)}</dd>
                  </div>
                  {detailState.status === "ready" ? (
                    <div className={styles.detailWide}>
                      <dt>Motivo / observação</dt>
                      <dd>{displayValue(detailState.record.motivo)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              <p className={styles.detailSource}>
                {detailState.status === "ready" && detailState.lastUpdated
                  ? `Fonte atualizada em ${detailState.lastUpdated}.`
                  : lastUpdated
                    ? `Visão geral atualizada em ${lastUpdated}.`
                    : "Data de atualização não informada pela fonte."}
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
