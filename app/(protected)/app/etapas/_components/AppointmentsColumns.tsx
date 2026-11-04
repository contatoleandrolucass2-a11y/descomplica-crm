"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useDashboardBarHeightControl } from "@/lib/dashboard-canvas/ui/configurable/bar-height-controls";
import type { AppointmentBucket } from "@/lib/crm/stages/appointments";
import styles from "./AppointmentsDashboard.module.css";
import overrides from "./AppointmentsColumnsOverrides.module.css";
import {
  appointmentHoliday,
  appointmentHolidayDescription,
} from "@/lib/crm/stages/appointment-holidays";
import { appointmentWeekdayLabel } from "./appointment-day-label";

const number = new Intl.NumberFormat("pt-BR");
type Bucket = AppointmentBucket & { goal?: number | null };
type PlotFrame = { top: number; left: number; width: number; height: number; headroom: number };
const emptyFrame: PlotFrame = { top: 0, left: 0, width: 0, height: 0, headroom: 24 };

/** Calendar dates are bucket dates, independent of the browser's time zone. */
export function appointmentWeekendDay(key: string): "sábado" | "domingo" | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(key)) return null;
  const date = new Date(`${key}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return null;
  return date.getUTCDay() === 6 ? "sábado" : date.getUTCDay() === 0 ? "domingo" : null;
}

/** Draw only known targets. A null target is unavailable, never an invented zero. */
export function appointmentsGoalPath(
  goals: readonly (number | null | undefined)[],
  height: number,
  pixelsPerUnit: number,
) {
  const fixedGoal = goals[0];
  if (
    fixedGoal != null &&
    Number.isFinite(fixedGoal) &&
    goals.every((goal) => goal === fixedGoal)
  ) {
    return `M0,${height - Math.min(height, Math.max(0, fixedGoal * pixelsPerUnit))} H100`;
  }
  let path = "";
  let previousKnown = false;
  for (const [index, goal] of goals.entries()) {
    if (goal == null || !Number.isFinite(goal)) {
      previousKnown = false;
      continue;
    }
    const left = (index / goals.length) * 100;
    const right = ((index + 1) / goals.length) * 100;
    const y = height - Math.min(height, Math.max(0, goal * pixelsPerUnit));
    path += `${previousKnown ? ` V${y}` : ` M${left},${y}`} H${right}`;
    previousKnown = true;
  }
  return path.trim();
}

export function AppointmentsColumns({
  buckets,
  label,
  daily = false,
  selected,
  isSelected,
  onSelect,
  monthly = false,
  verticalLabels = false,
  reference,
}: {
  buckets: Bucket[];
  label: string;
  daily?: boolean;
  selected?: string | undefined;
  isSelected?: ((bucket: AppointmentBucket) => boolean) | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
  monthly?: boolean;
  verticalLabels?: boolean;
  reference?: { value: number | null; label: string; classify?: boolean; showSummary?: boolean };
}) {
  const control = useDashboardBarHeightControl();
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const draft = useRef<number | undefined>(control?.value);
  const [override, setOverride] = useState<{ value: number | undefined } | null>(null);
  const [text, setText] = useState(control?.value === undefined ? "" : String(control.value));
  const [frame, setFrame] = useState(emptyFrame);
  const [inheritedLimit, setInheritedLimit] = useState<number | undefined>(undefined);
  const helpId = useId();
  const heightInput = useRef<HTMLInputElement>(null);
  // Equal-length months still replace keyed tracks; observe their new DOM nodes.
  const firstBucketKey = buckets[0]?.key;
  const lastBucketKey = buckets.at(-1)?.key;

  useEffect(() => {
    if (dirty.current) return;
    draft.current = control?.value;
    heightInput.current?.setCustomValidity("");
    setText(control?.value === undefined ? "" : String(control.value));
    setOverride(null);
  }, [control?.value]);

  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const tracks = element.querySelectorAll<HTMLElement>("[data-appointments-track]");
    const first = tracks[0];
    const last = tracks[tracks.length - 1];
    if (!first || !last) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const scale =
        element.clientWidth > 0 && bounds.width > 0 ? bounds.width / element.clientWidth : 1;
      const firstBounds = first.getBoundingClientRect();
      const lastBounds = last.getBoundingClientRect();
      const value = first.querySelector<HTMLElement>("[data-appointments-value]");
      const next = {
        top: (firstBounds.top - bounds.top) / scale,
        left: (firstBounds.left - bounds.left) / scale,
        width: (lastBounds.right - firstBounds.left) / scale,
        height: first.clientHeight,
        headroom: Math.max(20, (value?.getBoundingClientRect().height ?? 16) / scale + 6),
      };
      setFrame((current) =>
        Object.keys(next).every(
          (key) => Math.abs(current[key as keyof PlotFrame] - next[key as keyof PlotFrame]) < 0.1,
        )
          ? current
          : next,
      );
      const inherited = Number.parseFloat(
        getComputedStyle(host.current ?? element).getPropertyValue("--dashboard-bar-max-height"),
      );
      setInheritedLimit(Number.isSafeInteger(inherited) && inherited > 0 ? inherited : undefined);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(first);
    return () => observer.disconnect();
  }, [buckets.length, firstBucketKey, lastBucketKey, verticalLabels]);

  const limit = override ? override.value : control ? control.value : inheritedLimit;
  const availableHeight = Math.max(0, frame.height - frame.headroom);
  const renderedLimit = Math.min(limit ?? availableHeight, availableHeight);
  const largest = buckets.reduce<Bucket | null>(
    (best, bucket) => (!best || bucket.total > best.total ? bucket : best),
    null,
  );
  const maximum = Math.max(1, largest?.total ?? 0);
  const pixelsPerUnit = renderedLimit / maximum;
  const referenceName = reference?.label ?? "Meta";
  const classifyReference = reference?.classify !== false;
  const referenceValue =
    reference?.value != null && Number.isFinite(reference.value) && reference.value >= 0
      ? reference.value
      : null;
  const goals = buckets.map((bucket) => (reference ? referenceValue : bucket.goal));
  const knownGoals = goals.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  const missingGoals = reference
    ? referenceValue == null
      ? buckets.length
      : 0
    : buckets.filter((bucket) => "goal" in bucket && bucket.goal == null).length;
  const outsideGoals = knownGoals.filter(
    (goal) => goal * pixelsPerUnit > frame.height || goal < 0,
  ).length;
  const minGoal = knownGoals.length ? Math.min(...knownGoals) : null;
  const maxGoal = knownGoals.length ? Math.max(...knownGoals) : null;
  const editable = Boolean(control?.editable);

  function change(value: number | undefined) {
    draft.current = value;
    dirty.current = true;
    setOverride({ value });
    setText(value === undefined ? "" : String(value));
  }

  function commit() {
    if (!dirty.current || !control?.editable) return;
    dirty.current = false;
    control.onCommit(draft.current);
  }

  function commitText(input: HTMLInputElement) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
    commit();
  }

  if (!buckets.length)
    return <p className={styles.empty}>Nenhum agendamento no período coberto.</p>;

  return (
    <div
      ref={host}
      className={`${styles.columnsChart} ${daily ? overrides.dailyChart : ""}`}
      data-appointments-plot
      data-pixel-height={limit ?? "auto"}
      data-appointments-rendered-max={renderedLimit}
      data-reference-classify={classifyReference ? "true" : "false"}
    >
      <div className={styles.columnsHeading}>
        <p className={styles.axis}>
          Quantidade de agendamentos
          <span className={styles.maximumSummary}>
            Máximo {number.format(largest?.total ?? 0)}
            {largest
              ? ` · ${daily ? largest.key.split("-").reverse().join("/") : largest.label}`
              : ""}
          </span>
          {reference?.showSummary && (
            <span className={styles.maximumSummary} data-appointments-reference-summary>
              {referenceName}{" "}
              {referenceValue === null ? "indisponível" : number.format(referenceValue)}
            </span>
          )}
        </p>
        {editable && (
          <div className={styles.barHeightTools}>
            <label>
              <span aria-hidden="true">Altura</span>
              <input
                ref={heightInput}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                aria-label="Altura máxima das torres (px)"
                aria-describedby={helpId}
                placeholder="Auto"
                value={text}
                onChange={(event) => {
                  const next = event.target.value;
                  setText(next);
                  const value = Number(next);
                  const valid = !next.trim() || (Number.isSafeInteger(value) && value > 0);
                  event.currentTarget.setCustomValidity(
                    valid ? "" : "Informe um número inteiro de pixels maior que zero.",
                  );
                  if (valid) {
                    draft.current = next.trim() ? value : undefined;
                    dirty.current = true;
                    setOverride({ value: draft.current });
                  }
                }}
                onBlur={(event) => commitText(event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitText(event.currentTarget);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    dirty.current = false;
                    draft.current = control?.value;
                    setOverride(null);
                    setText(control?.value === undefined ? "" : String(control.value));
                    event.currentTarget.setCustomValidity("");
                  }
                }}
              />
              <span aria-hidden="true">px</span>
            </label>
            <button
              type="button"
              aria-label="Usar altura automática das torres"
              title="Altura automática"
              onClick={() => {
                heightInput.current?.setCustomValidity("");
                change(undefined);
                commit();
              }}
            >
              ↺
            </button>
            <span id={helpId} className="sr-only">
              Informe pixels ou use altura automática. O maior valor ancora a escala; o card mantém
              suas dimensões. Vazio usa a altura disponível, com espaço para o rótulo.
            </span>
          </div>
        )}
      </div>
      <div
        className={`${overrides.plotViewport} ${daily ? overrides.dailyViewport : ""}`}
        data-appointments-scroll-viewport={daily ? true : undefined}
        role={daily ? "region" : undefined}
        tabIndex={daily ? 0 : undefined}
        aria-label={daily ? `${label}; deslize na horizontal para ver todos os dias` : undefined}
      >
        <div ref={plot} className={`${styles.columnsPlot} ${daily ? overrides.dailyPlot : ""}`}>
          <ol
            aria-label={label}
            className={`${styles.columns} ${daily ? styles.daily : ""} ${monthly ? styles.monthly : ""} ${verticalLabels ? styles.verticalLabels : ""}`}
            style={{ "--column-count": buckets.length } as CSSProperties}
          >
            {buckets.map((item, index) => {
              const goal = goals[index];
              const weekend = daily ? appointmentWeekendDay(item.key) : null;
              const holiday = daily ? appointmentHoliday(item.key) : null;
              const weekdayLabel = daily ? appointmentWeekdayLabel(item.key) : null;
              const dayTitle = holiday
                ? `${weekdayLabel} — ${appointmentHolidayDescription(holiday)}`
                : (weekdayLabel ?? undefined);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    data-appointments-day={daily ? item.key : undefined}
                    aria-pressed={isSelected ? isSelected(item) : selected === item.key}
                    aria-label={`${daily ? item.key.split("-").reverse().join("/") : item.label}${weekend ? `, ${weekend}` : ""}: ${number.format(item.total)} agendamentos${goal == null ? "" : `; ${reference ? referenceName : "meta"} ${number.format(goal)}${classifyReference ? `; ${item.total >= goal ? "referência atingida" : "abaixo da referência"}` : ""}`}`}
                    className={styles.chartButton}
                    onClick={() => onSelect?.(item)}
                  >
                    <div
                      className={styles.columnTrack}
                      data-appointments-track
                      style={
                        {
                          "--bar-height": `${item.total * pixelsPerUnit}px`,
                          "--rendered-bar-height": `${item.total * pixelsPerUnit}px`,
                        } as CSSProperties
                      }
                    >
                      <div
                        className={styles.column}
                        data-appointments-bar
                        data-goal-status={
                          !classifyReference
                            ? "neutral"
                            : goal == null
                              ? reference || "goal" in item
                                ? "unavailable"
                                : "neutral"
                              : item.total >= goal
                                ? "positive"
                                : "negative"
                        }
                        style={{ height: "var(--rendered-bar-height)" }}
                      />
                      <span
                        className={styles.columnValue}
                        data-appointments-value
                        style={{ bottom: item.total * pixelsPerUnit }}
                      >
                        {number.format(item.total)}
                      </span>
                    </div>
                    <span className={styles.columnLabel} data-appointments-column-label>
                      <span
                        className={`${overrides.dayMarker} ${weekend ? overrides.weekend : ""} ${holiday ? overrides.holiday : ""}`}
                        data-appointments-weekend={weekend ?? undefined}
                        data-appointments-holiday={holiday?.name}
                        title={dayTitle}
                        aria-label={daily ? `${item.label}: ${dayTitle}` : undefined}
                      >
                        {item.label}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {frame.width > 0 && (
            <div
              className={styles.plotReferences}
              data-appointments-references
              style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
            >
              {knownGoals.length > 0 && (
                <svg
                  className={styles.goalReference}
                  data-dashboard-goal-line
                  data-out-of-scale={outsideGoals > 0 ? "true" : undefined}
                  data-missing-goals={missingGoals}
                  viewBox={`0 0 100 ${Math.max(1, frame.height)}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={
                    reference && referenceValue !== null
                      ? `${referenceName}: linha horizontal em ${number.format(referenceValue)} agendamentos`
                      : `${referenceName}: referência dinâmica por período; valores nos detalhes de cada torre`
                  }
                >
                  <title>{`${referenceName} ${minGoal === maxGoal ? number.format(minGoal ?? 0) : `${number.format(minGoal ?? 0)} a ${number.format(maxGoal ?? 0)}`}${outsideGoals ? "; há referências fora da área disponível" : ""}`}</title>
                  <path
                    data-appointments-goal-line
                    d={appointmentsGoalPath(goals, frame.height, pixelsPerUnit)}
                  />
                </svg>
              )}
            </div>
          )}
        </div>
      </div>
      {knownGoals.length > 0 && (
        <p className={styles.chartLegend}>
          {classifyReference ? "Vermelho: abaixo da referência · Azul: referência atingida · " : ""}
          Pontilhado: {referenceName}{" "}
          {minGoal === maxGoal
            ? number.format(minGoal ?? 0)
            : `${number.format(minGoal ?? 0)}–${number.format(maxGoal ?? 0)}`}
        </p>
      )}
      {knownGoals.length > 0 && (
        <p
          className={styles.referenceNotice}
          data-appointments-overflow-notice
          data-active={outsideGoals > 0 ? "true" : "false"}
          aria-hidden={outsideGoals === 0}
        >
          Referência acima da área visível.
        </p>
      )}
      {missingGoals > 0 && (
        <p className={styles.referenceNotice}>
          {knownGoals.length
            ? "Referência indisponível em parte do período; a linha aparece somente nos trechos conhecidos."
            : `${referenceName} indisponível para este recorte${classifyReference ? " · Sem classificação de produtividade" : ""}`}
        </p>
      )}
    </div>
  );
}
