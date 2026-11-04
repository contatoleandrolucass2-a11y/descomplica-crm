"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import type {
  AppointmentBrokerRosterEntry,
  AppointmentBucket,
  AppointmentFilters,
} from "@/lib/crm/stages/appointments";
import {
  analyzeDailyAppointmentTeam,
  type DailyAppointmentTeam,
} from "@/lib/crm/stages/appointments-daily-team";
import { ProductiveTeamDetails } from "../../equipe-produtiva/_components/ProductiveTeamDetails";
import styles from "./DailyAppointmentsTeamDetails.module.css";

const displayDate = (date: string) => date.split("-").reverse().join("/");
const unavailableMessage = (reason: DailyAppointmentTeam["unavailableReason"]) => {
  if (reason === "outside-selected-period") return "Dia fora do período selecionado.";
  if (reason === "unavailable-period") return "Este dia não está coberto pela fonte.";
  if (reason === "unsupported-dimensions")
    return "O cadastro de corretores não permite detalhar a equipe neste filtro.";
  if (reason === "missing-roster") return "Cadastro oficial de corretores indisponível.";
  return "Não foi possível conciliar com segurança a equipe cadastrada neste dia.";
};

/** Mouse/focus preview stays outside the card's clipped canvas. Touch has an explicit control. */
export function DailyAppointmentsTeamDetails({
  analysis,
  brokerRoster,
  filters,
  month,
  buckets,
  children,
}: {
  analysis: DashboardAnalysisSlice;
  brokerRoster: AppointmentBrokerRosterEntry[] | null;
  filters: AppointmentFilters;
  month: string;
  buckets: AppointmentBucket[];
  children: ReactNode;
}) {
  const [active, setActive] = useState<{ date: string; pinned: boolean; top: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismissedDate = useRef<string | null>(null);
  const titleId = useId();
  const panelId = useId();
  const selectId = useId();
  const date = active && buckets.some((bucket) => bucket.key === active.date) ? active.date : null;
  const team = useMemo(
    () =>
      date === null
        ? null
        : analyzeDailyAppointmentTeam(analysis, { date, month, filters, brokerRoster }),
    [analysis, brokerRoster, filters, month, date],
  );

  const cancelClose = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    if (active?.pinned) return;
    closeTimer.current = setTimeout(() => setActive(null), 180);
  };
  const close = (restoreFocus: boolean) => {
    cancelClose();
    dismissedDate.current = date;
    setActive(null);
    if (restoreFocus) (anchor.current ?? openButton.current)?.focus();
  };
  const open = (element: HTMLElement, day: string, pinned = false) => {
    if (!buckets.some((bucket) => bucket.key === day) || dismissedDate.current === day) return;
    cancelClose();
    anchor.current = element;
    const rect = element.getBoundingClientRect();
    const height = Math.min(440, window.innerHeight - 24);
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12));
    setActive((previous) =>
      previous?.date === day && previous.pinned === pinned && previous.top === top
        ? previous
        : { date: day, pinned, top },
    );
  };
  const triggerFor = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>("button[data-appointments-day]") : null;
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const target = event.relatedTarget;
    if (
      target instanceof Node &&
      (root.current?.contains(target) || panel.current?.contains(target))
    )
      return;
    scheduleClose();
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (date === null) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearTimeout(closeTimer.current);
      dismissedDate.current = date;
      setActive(null);
      if (panel.current?.contains(document.activeElement))
        (anchor.current ?? openButton.current)?.focus();
    };
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !root.current?.contains(target) &&
        !panel.current?.contains(target)
      )
        setActive(null);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [date]);

  return (
    <div
      ref={root}
      className={styles.root}
      onPointerOver={(event) => {
        if (event.pointerType === "touch" || active?.pinned) return;
        if (
          event.target instanceof Element &&
          event.target.closest("[data-appointments-column-label]")
        ) {
          scheduleClose();
          return;
        }
        const trigger = triggerFor(event.target);
        if (trigger) open(trigger, trigger.dataset.appointmentsDay!);
      }}
      onPointerOut={(event) => {
        const trigger = triggerFor(event.target);
        if (
          trigger &&
          (!(event.relatedTarget instanceof Node) || !trigger.contains(event.relatedTarget))
        ) {
          dismissedDate.current = null;
          scheduleClose();
        }
      }}
      onFocusCapture={(event) => {
        if (active?.pinned) return;
        const trigger = triggerFor(event.target);
        if (trigger) open(trigger, trigger.dataset.appointmentsDay!);
      }}
      onBlurCapture={onBlur}
      onKeyDownCapture={(event) => {
        if (event.key !== "ArrowDown" || !date || !triggerFor(event.target)) return;
        event.preventDefault();
        setActive((previous) => (previous ? { ...previous, pinned: true } : previous));
        closeButton.current?.focus();
      }}
    >
      {children}
      {buckets.length > 0 && (
        <button
          ref={openButton}
          type="button"
          className={styles.openButton}
          aria-haspopup="dialog"
          aria-expanded={date !== null}
          aria-controls={date !== null ? panelId : undefined}
          onClick={(event) => {
            dismissedDate.current = null;
            open(event.currentTarget, date ?? buckets[0]!.key, true);
          }}
        >
          Ver equipe por dia
        </button>
      )}
      {date !== null && active && team && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panel}
              id={panelId}
              role="dialog"
              aria-modal="false"
              aria-labelledby={titleId}
              className={styles.panel}
              style={
                {
                  "--daily-team-top": `${active.top}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                } as CSSProperties
              }
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleClose}
              onFocusCapture={cancelClose}
              onBlurCapture={onBlur}
            >
              <header className={styles.header}>
                <h3 id={titleId} className={styles.title}>
                  Equipe — {displayDate(date)}
                </h3>
                <button
                  ref={closeButton}
                  type="button"
                  className={styles.close}
                  aria-label="Fechar equipe do dia"
                  onClick={() => close(true)}
                >
                  ×
                </button>
              </header>
              <div className={styles.controls}>
                <label htmlFor={selectId}>Dia</label>
                <select
                  id={selectId}
                  value={date}
                  onChange={(event) =>
                    setActive((previous) =>
                      previous ? { ...previous, date: event.target.value, pinned: true } : previous,
                    )
                  }
                >
                  {buckets.map((bucket) => (
                    <option key={bucket.key} value={bucket.key}>
                      {displayDate(bucket.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={styles.content}
                role="region"
                aria-label={`Equipes de ${displayDate(date)}`}
                tabIndex={0}
              >
                <ProductiveTeamDetails
                  productiveMembers={team.withAppointments}
                  unproductiveMembers={team.withoutAppointments}
                  unavailableDetail={unavailableMessage(team.unavailableReason)}
                  appointmentLabels
                  shortNames
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
