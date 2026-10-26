"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, GripVertical, Maximize2, X } from "lucide-react";

import styles from "./ChartBoard.module.css";

export type ChartBoardProps = {
  children: ReactNode;
  ids: string[];
  /** Opt-in namespace. Storage contains only IDs; schema version lives in the key. */
  storageKey?: string;
};

export type ChartTileProps = {
  id: string;
  title: string;
  children: ReactNode;
  controls?: ReactNode;
  wide?: boolean;
  className?: string;
  tone?: "blue" | "red" | "yellow";
};

type BoardContext = {
  order: string[];
  move: (id: string, target: number, title: string) => void;
};

const Board = createContext<BoardContext | null>(null);

function reconcile(saved: string[], ids: string[]) {
  const available = new Set(ids);
  return [...new Set([...saved.filter((id) => available.has(id)), ...ids])];
}

export function ChartBoard({ children, ids, storageKey }: ChartBoardProps) {
  const [saved, setSaved] = useState<{ key: string | undefined; ids: string[] }>({
    key: storageKey,
    ids: [],
  });
  const [announcement, setAnnouncement] = useState("");
  const order = reconcile(saved.key === storageKey ? saved.ids : [], ids);
  const key = storageKey ? `crm:chart-board:v1:${storageKey}` : undefined;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    // Hydration starts with the server order. Storage is read only after mounting.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
          setSaved({ key: storageKey, ids: parsed });
        }
      } catch {
        // Disabled storage or malformed preferences must not block the board.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, storageKey]);

  function move(id: string, target: number, title: string) {
    const from = order.indexOf(id);
    if (from < 0 || target < 0 || target >= order.length || target === from) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(target, 0, id);
    setSaved({ key: storageKey, ids: next });
    setAnnouncement(`${title}: posição ${target + 1} de ${next.length}.`);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* In-memory ordering remains usable. */
      }
    }
  }

  return (
    <Board.Provider value={{ order, move }}>
      <div className={styles.board} data-chart-board>
        {children}
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </Board.Provider>
  );
}

export function ChartTile({
  id,
  title,
  children,
  controls,
  wide = false,
  className,
  tone,
}: ChartTileProps) {
  const board = useContext(Board);
  const titleId = useId();
  const helpId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  if (!board) throw new Error("ChartTile must be rendered inside ChartBoard.");
  const { order, move } = board;
  const index = order.indexOf(id);
  if (index < 0) throw new Error(`ChartTile id "${id}" must be present in ChartBoard ids.`);

  function expand() {
    const element = dialog.current;
    if (!element || element.matches(":modal")) return;
    // The same dialog is an inline region while collapsed: no portal, clone,
    // remount, duplicate IDs or lost uncontrolled filter/chart state.
    element.close();
    element.showModal();
    setExpanded(true);
    closeButton.current?.focus();
  }

  function collapse() {
    const element = dialog.current;
    if (!element) return;
    if (element.open) element.close();
    element.show();
    setExpanded(false);
    expandButton.current?.focus();
  }

  return (
    <section
      data-appointments-chart={id}
      className={[styles.tile, wide ? styles.wide : "", className].filter(Boolean).join(" ")}
      style={{ order: index }}
      aria-label={`${title}, posição ${index + 1} de ${order.length}`}
    >
      <dialog
        ref={dialog}
        open
        role={expanded ? "dialog" : "region"}
        aria-modal={expanded ? true : undefined}
        aria-labelledby={titleId}
        className={[styles.card, tone ? styles[tone] : ""].filter(Boolean).join(" ")}
        onCancel={(event) => {
          event.preventDefault();
          collapse();
        }}
        onClose={() => {
          // close() queues an event even when immediately followed by showModal().
          if (dialog.current && !dialog.current.open) collapse();
        }}
      >
        <header className={styles.header}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.handle}`}
              disabled={expanded}
              aria-label={`Reordenar ${title}`}
              aria-describedby={helpId}
              onPointerDown={(event) => {
                if (event.button !== 0 || expanded) return;
                pointerOrigin.current = { x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                pointerOrigin.current = null;
              }}
              onLostPointerCapture={() => {
                pointerOrigin.current = null;
              }}
              onPointerUp={(event) => {
                const origin = pointerOrigin.current;
                pointerOrigin.current = null;
                if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5)
                  return;
                const target = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>("[data-appointments-chart]");
                if (
                  !target ||
                  target.closest("[data-chart-board]") !==
                    event.currentTarget.closest("[data-chart-board]")
                )
                  return;
                move(id, order.indexOf(target.dataset.appointmentsChart ?? ""), title);
              }}
              onKeyDown={(event) => {
                const delta =
                  event.key === "ArrowUp" || event.key === "ArrowLeft"
                    ? -1
                    : event.key === "ArrowDown" || event.key === "ArrowRight"
                      ? 1
                      : 0;
                if (delta) {
                  event.preventDefault();
                  move(id, index + delta, title);
                }
              }}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={expanded || index === 0}
              aria-label={`Mover ${title} para antes`}
              onClick={() => move(id, index - 1, title)}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={expanded || index === order.length - 1}
              aria-label={`Mover ${title} para depois`}
              onClick={() => move(id, index + 1, title)}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button
              ref={expandButton}
              type="button"
              className={`${styles.button} ${styles.expand}`}
              aria-label={`Expandir ${title}`}
              aria-haspopup="dialog"
              onClick={expand}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            <button
              ref={closeButton}
              type="button"
              className={`${styles.button} ${styles.close}`}
              aria-label={`Fechar ${title}`}
              onClick={collapse}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>
        <span id={helpId} className={styles.srOnly}>
          Arraste pela alça ou use as setas do teclado para mover o gráfico.
        </span>
        {controls ? <div className={styles.controls}>{controls}</div> : null}
        <div
          className={styles.content}
          tabIndex={0}
          role="region"
          aria-label={`Conteúdo de ${title}`}
        >
          {children}
        </div>
      </dialog>
    </section>
  );
}
