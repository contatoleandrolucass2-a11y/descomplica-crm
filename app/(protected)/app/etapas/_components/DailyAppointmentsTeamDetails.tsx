"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
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
const visibleName = (value: string | null) =>
  value && !/não informad|sem responsável|sem gerente/iu.test(value)
    ? value.trim().split(/\s+/u).slice(0, 2).join(" ")
    : value;
const unavailableMessage = (reason: DailyAppointmentTeam["unavailableReason"]) => {
  if (reason === "outside-selected-period") return "Dia fora do período selecionado.";
  if (reason === "unavailable-period") return "Este dia não está coberto pela fonte.";
  if (reason === "unsupported-dimensions")
    return "O cadastro de corretores não permite detalhar a equipe neste filtro.";
  if (reason === "missing-roster") return "Cadastro oficial de corretores indisponível.";
  return "Não foi possível conciliar com segurança a equipe cadastrada neste dia.";
};

/** Only the numeric result opens the centered preview; keyboard/touch have an explicit control. */
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
  const [active, setActive] = useState<{ date: string; pinned: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismissedDate = useRef<string | null>(null);
  const focusExplicitOpen = useRef(false);
  const restoringFocus = useRef(false);
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
  const scheduleClose = (fromPointer = false) => {
    cancelClose();
    if (active?.pinned && !fromPointer) return;
    closeTimer.current = setTimeout(() => {
      setActive(null);
      if (panel.current?.contains(document.activeElement)) {
        restoringFocus.current = true;
        try {
          (anchor.current ?? openButton.current)?.focus();
        } finally {
          restoringFocus.current = false;
        }
      }
    }, 250);
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
    anchor.current = element.closest<HTMLElement>("button") ?? element;
    if (pinned) {
      if (closeButton.current) closeButton.current.focus();
      else focusExplicitOpen.current = true;
    }
    setActive((previous) =>
      previous?.date === day && previous.pinned === pinned ? previous : { date: day, pinned },
    );
  };
  const triggerFor = (target: EventTarget | null, includeButton = false) =>
    target instanceof Element
      ? (target.closest<HTMLElement>("[data-appointments-team-day]") ??
        (includeButton
          ? target.closest("button")?.querySelector<HTMLElement>("[data-appointments-team-day]")
          : null) ??
        null)
      : null;
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
    if (date === null || !focusExplicitOpen.current) return;
    focusExplicitOpen.current = false;
    closeButton.current?.focus();
  }, [date]);
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
        const trigger = triggerFor(event.target);
        if (trigger) open(trigger, trigger.dataset.appointmentsTeamDay!);
      }}
      onPointerOut={(event) => {
        const trigger = triggerFor(event.target);
        if (
          trigger &&
          (!(event.relatedTarget instanceof Node) || !trigger.contains(event.relatedTarget))
        ) {
          dismissedDate.current = null;
          if (
            !(event.relatedTarget instanceof Node) ||
            !panel.current?.contains(event.relatedTarget)
          )
            scheduleClose(true);
        }
      }}
      onFocusCapture={(event) => {
        if (active?.pinned || restoringFocus.current) return;
        const trigger = triggerFor(event.target, true);
        if (trigger) open(trigger, trigger.dataset.appointmentsTeamDay!);
      }}
      onBlurCapture={onBlur}
      onKeyDownCapture={(event) => {
        if (event.key !== "ArrowDown" || !date || !triggerFor(event.target, true)) return;
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
              onPointerEnter={cancelClose}
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") scheduleClose(true);
              }}
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
                  productiveMembers={
                    team.withAppointments?.map((member) => ({
                      ...member,
                      regionalManager: visibleName(member.regionalManager),
                      manager: visibleName(member.manager) ?? member.manager,
                      owner: visibleName(member.owner) ?? member.owner,
                    })) ?? null
                  }
                  unproductiveMembers={
                    team.withoutAppointments?.map((member) => ({
                      ...member,
                      regionalManager: visibleName(member.regionalManager),
                      manager: visibleName(member.manager) ?? member.manager,
                      owner: visibleName(member.owner) ?? member.owner,
                    })) ?? null
                  }
                  unavailableDetail={unavailableMessage(team.unavailableReason)}
                  appointmentLabels
                  shortNames
                  compact
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
