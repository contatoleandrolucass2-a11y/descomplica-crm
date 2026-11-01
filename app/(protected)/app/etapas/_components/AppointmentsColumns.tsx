"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useDashboardBarHeightControl } from "@/lib/dashboard-canvas/ui/configurable/bar-height-controls";
import type { AppointmentBucket } from "@/lib/crm/stages/appointments";
import styles from "./AppointmentsDashboard.module.css";

const number = new Intl.NumberFormat("pt-BR");
type Bucket = AppointmentBucket & { goal?: number | null };
type PlotFrame = { top: number; left: number; width: number; height: number; headroom: number };
const emptyFrame: PlotFrame = { top: 0, left: 0, width: 0, height: 0, headroom: 24 };

/** Draw only known targets. A null target is unavailable, never an invented zero. */
export function appointmentsGoalPath(
  goals: readonly (number | null | undefined)[],
  height: number,
  pixelsPerUnit: number,
) {
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
}: {
  buckets: Bucket[];
  label: string;
  daily?: boolean;
  selected?: string | undefined;
  isSelected?: ((bucket: AppointmentBucket) => boolean) | undefined;
  onSelect?: (bucket: AppointmentBucket) => void;
  monthly?: boolean;
  verticalLabels?: boolean;
}) {
  const control = useDashboardBarHeightControl();
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const draft = useRef<number | undefined>(control?.value);
  const gesture = useRef<{ y: number; height: number; scale: number; moved: boolean } | null>(null);
  const [override, setOverride] = useState<{ value: number | undefined } | null>(null);
  const [text, setText] = useState(control?.value === undefined ? "" : String(control.value));
  const [frame, setFrame] = useState(emptyFrame);
  const [inheritedLimit, setInheritedLimit] = useState<number | undefined>(undefined);
  const helpId = useId();
  const heightInput = useRef<HTMLInputElement>(null);

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
  }, [buckets.length, verticalLabels]);

  const limit = override ? override.value : control ? control.value : inheritedLimit;
  const availableHeight = Math.max(0, frame.height - frame.headroom);
  const renderedLimit = Math.min(limit ?? availableHeight, availableHeight);
  const largest = buckets.reduce<Bucket | null>(
    (best, bucket) => (!best || bucket.total > best.total ? bucket : best),
    null,
  );
  const maximum = Math.max(1, largest?.total ?? 0);
  const pixelsPerUnit = renderedLimit / maximum;
  const goals = buckets.map((bucket) => bucket.goal);
  const knownGoals = goals.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  const missingGoals = buckets.filter((bucket) => "goal" in bucket && bucket.goal == null).length;
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
      className={styles.columnsChart}
      data-appointments-plot
      data-pixel-height={limit ?? "auto"}
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
              Arraste a linha superior ou informe pixels. O maior valor ancora a escala; o card
              mantém suas dimensões. Vazio usa a altura disponível.
            </span>
          </div>
        )}
      </div>
      <div ref={plot} className={styles.columnsPlot}>
        <ol
          aria-label={label}
          className={`${styles.columns} ${daily ? styles.daily : ""} ${monthly ? styles.monthly : ""} ${verticalLabels ? styles.verticalLabels : ""}`}
          style={{ "--column-count": buckets.length } as CSSProperties}
        >
          {buckets.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={isSelected ? isSelected(item) : selected === item.key}
                aria-label={`${daily ? item.key.split("-").reverse().join("/") : item.label}: ${number.format(item.total)} agendamentos${item.goal == null ? "" : `; meta ${number.format(item.goal)}; ${item.total >= item.goal ? "meta atingida" : "abaixo da meta"}`}`}
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
                      item.goal == null
                        ? "goal" in item
                          ? "unavailable"
                          : "neutral"
                        : item.total >= item.goal
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
                <span className={styles.columnLabel}>{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {frame.width > 0 && (
          <div
            className={styles.plotReferences}
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
                aria-label="Meta dinâmica por período; valores nos detalhes de cada torre"
              >
                <title>{`Meta ${minGoal === maxGoal ? number.format(minGoal ?? 0) : `${number.format(minGoal ?? 0)} a ${number.format(maxGoal ?? 0)}`}${outsideGoals ? "; há metas fora da área disponível" : ""}`}</title>
                <path
                  data-appointments-goal-line
                  d={appointmentsGoalPath(goals, frame.height, pixelsPerUnit)}
                />
              </svg>
            )}
            <div
              className={styles.maximumLine}
              data-dashboard-bar-top-line
              data-appointments-max-line
              style={{ bottom: renderedLimit }}
              role={editable ? "slider" : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-label={editable ? "Ajustar altura máxima das torres" : undefined}
              aria-valuemin={editable ? 1 : undefined}
              aria-valuemax={editable ? Number.MAX_SAFE_INTEGER : undefined}
              aria-valuenow={editable ? Math.max(1, Math.round(limit ?? renderedLimit)) : undefined}
              aria-valuetext={
                editable
                  ? `${Math.max(1, Math.round(limit ?? renderedLimit))} pixels; maior valor ${number.format(largest?.total ?? 0)}`
                  : undefined
              }
              aria-orientation={editable ? "vertical" : undefined}
              onPointerDown={
                editable
                  ? (event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      const element = plot.current;
                      const scale =
                        element && element.clientWidth > 0
                          ? element.getBoundingClientRect().width / element.clientWidth
                          : 1;
                      gesture.current = {
                        y: event.clientY,
                        height: renderedLimit,
                        scale,
                        moved: false,
                      };
                    }
                  : undefined
              }
              onPointerMove={
                editable
                  ? (event) => {
                      const current = gesture.current;
                      if (!current) return;
                      event.stopPropagation();
                      if (Math.abs(event.clientY - current.y) < 1 && !current.moved) return;
                      current.moved = true;
                      change(
                        Math.max(
                          1,
                          Math.round(current.height - (event.clientY - current.y) / current.scale),
                        ),
                      );
                    }
                  : undefined
              }
              onPointerUp={
                editable
                  ? (event) => {
                      if (!gesture.current) return;
                      event.stopPropagation();
                      if (gesture.current.moved) commit();
                      gesture.current = null;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  : undefined
              }
              onPointerCancel={() => {
                gesture.current = null;
                dirty.current = false;
                draft.current = control?.value;
                setOverride(null);
                setText(control?.value === undefined ? "" : String(control.value));
              }}
              onKeyDown={
                editable
                  ? (event) => {
                      const current = draft.current ?? limit ?? Math.round(renderedLimit);
                      const step = event.shiftKey ? 10 : 1;
                      const next =
                        event.key === "ArrowUp"
                          ? current + step
                          : event.key === "ArrowDown"
                            ? current - step
                            : event.key === "Home"
                              ? 1
                              : event.key === "End"
                                ? Math.round(availableHeight)
                                : null;
                      if (next === null) return;
                      event.preventDefault();
                      event.stopPropagation();
                      change(Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, next)));
                    }
                  : undefined
              }
              onKeyUp={
                editable
                  ? (event) => {
                      if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                        event.stopPropagation();
                        commit();
                      }
                    }
                  : undefined
              }
              onBlur={editable ? commit : undefined}
            >
              <span aria-hidden="true" className={styles.maximumGrip}>
                ↕
              </span>
            </div>
          </div>
        )}
      </div>
      {knownGoals.length > 0 && (
        <p className={styles.chartLegend}>
          Vermelho: abaixo da meta · Azul: meta atingida · Pontilhado: meta dinâmica{" "}
          {minGoal === maxGoal
            ? number.format(minGoal ?? 0)
            : `${number.format(minGoal ?? 0)}–${number.format(maxGoal ?? 0)}`}
        </p>
      )}
      {outsideGoals > 0 && (
        <p className={styles.referenceNotice}>
          Meta fora da área disponível; o traço na borda indica que ela está além da escala visível.
        </p>
      )}
      {missingGoals > 0 && (
        <p className={styles.referenceNotice}>
          {knownGoals.length
            ? "Meta indisponível em parte do período; a linha aparece somente nos trechos conhecidos."
            : "Meta não definida para este recorte · Sem classificação de produtividade"}
        </p>
      )}
    </div>
  );
}
