"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AppointmentComparison } from "./appointments-comparison";
import styles from "./AppointmentsComparison.module.css";
import { appointmentWeekdayLabel } from "./appointment-day-label";
import {
  appointmentHoliday,
  appointmentHolidayDescription,
} from "@/lib/crm/stages/appointment-holidays";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const colors = [
  "var(--analytics-cyan-strong)",
  "var(--analytics-warning)",
  "var(--analytics-ink)",
  "var(--analytics-positive)",
];

export type AppointmentLineLayout = "straight" | "smooth" | "steps" | "points" | "area";

const lineLayouts: readonly { value: AppointmentLineLayout; label: string }[] = [
  { value: "straight", label: "Linhas retas" },
  { value: "smooth", label: "Linhas suaves" },
  { value: "steps", label: "Linhas em degraus" },
  { value: "points", label: "Linhas com pontos" },
  { value: "area", label: "Linhas com área" },
];

/** Null coverage breaks every layout, including the filled area. */
export function appointmentComparisonPath(
  values: readonly (number | null)[],
  layout: AppointmentLineLayout,
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let previous: { x: number; y: number } | null = null;
  const segments: string[] = [];
  for (const [index, value] of values.entries()) {
    if (value === null) {
      previous = null;
      continue;
    }
    const point = { x: x(index), y: y(value) };
    if (previous === null) segments.push(`M${point.x},${point.y}`);
    else if (layout === "steps") segments.push(`H${point.x} V${point.y}`);
    else if (layout === "smooth") {
      const middle = (previous.x + point.x) / 2;
      segments.push(`C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`);
    } else segments.push(`L${point.x},${point.y}`);
    previous = point;
  }
  return segments.join(" ");
}

function comparisonAreaPath(
  values: readonly (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let start: number | null = null;
  let end = 0;
  let segment = "";
  const paths: string[] = [];
  const finish = () => {
    if (start !== null) paths.push(`${segment} L${x(end)},${y(0)} L${x(start)},${y(0)} Z`);
    start = null;
    segment = "";
  };
  for (const [index, value] of values.entries()) {
    if (value === null) finish();
    else {
      segment += `${start === null ? "M" : " L"}${x(index)},${y(value)}`;
      start ??= index;
      end = index;
    }
  }
  finish();
  return paths.join(" ");
}

export function AppointmentsComparison({
  getComparison,
  initialLayout = "points",
}: {
  getComparison: () => AppointmentComparison | null;
  initialLayout?: AppointmentLineLayout;
}) {
  const comparison = useMemo(() => getComparison(), [getComparison]);
  const id = useId();
  const [layout, setLayout] = useState<AppointmentLineLayout>(initialLayout);
  const [hoveredPoint, setTooltip] = useState<{
    comparison: AppointmentComparison;
    value: number;
    index: number;
  } | null>(null);
  if (comparison === null) return <p role="status">Comparativo indisponível neste recorte.</p>;
  const allValues = comparison.series
    .flatMap((series) => series.values)
    .filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...allValues);
  const ceiling = maximum * 1.08;
  const tooltip = hoveredPoint?.comparison === comparison ? hoveredPoint : null;
  const x = (index: number) =>
    comparison.days.length === 1 ? 360 : 8 + (index / (comparison.days.length - 1)) * 704;
  const y = (value: number) => 292 - (value / ceiling) * 284;
  return (
    <div className={styles.comparison} data-appointments-comparison data-line-layout={layout}>
      <label className={styles.typeControl}>
        <span>Gráfico</span>
        <select
          aria-label="Layout do gráfico de linhas"
          value={layout}
          onChange={(event) => setLayout(event.target.value as AppointmentLineLayout)}
        >
          {lineLayouts.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <ul className={styles.legend} aria-label="Séries comparadas">
        {comparison.series.map((series, index) => (
          <li key={series.key}>
            <span
              aria-hidden="true"
              style={{ borderColor: colors[index], borderStyle: index === 0 ? "solid" : "dashed" }}
            />
            {series.label}
          </li>
        ))}
      </ul>
      <p className={styles.description}>{comparison.description}</p>
      {allValues.length === 0 ? (
        <p role="status">Sem cobertura disponível para os meses comparados.</p>
      ) : (
        <>
          <div className={styles.chartScroll} tabIndex={0} aria-label="Dias do gráfico comparativo">
            <div
              className={styles.chartArea}
              style={{ "--comparison-days": comparison.days.length } as CSSProperties}
            >
              <div className={styles.plot}>
                <span className={styles.maximum} style={{ top: `${(y(maximum) / 300) * 100}%` }}>
                  {number.format(maximum)}
                </span>
                <span className={styles.zero} style={{ top: `${(y(0) / 300) * 100}%` }}>
                  0
                </span>
                <svg
                  viewBox="0 0 720 300"
                  preserveAspectRatio="none"
                  role="img"
                  aria-labelledby={id}
                >
                  <title id={id}>
                    Comparação por dia do mês. Meses sem cobertura e dias inexistentes não recebem
                    zero. Cada ponto informa a série, o dia e o valor.
                  </title>
                  {comparison.series.map((series, index) => (
                    <g key={series.key}>
                      {layout === "area" && (
                        <path
                          d={comparisonAreaPath(series.values, x, y)}
                          fill={colors[index]}
                          fillOpacity="0.12"
                          aria-hidden="true"
                        />
                      )}
                      <path
                        d={appointmentComparisonPath(series.values, layout, x, y)}
                        fill="none"
                        stroke={colors[index]}
                        strokeWidth="2.5"
                        strokeDasharray={
                          index === 0
                            ? undefined
                            : index === 1
                              ? "7 4"
                              : index === 2
                                ? "2 4"
                                : "10 3 2 3"
                        }
                        vectorEffect="non-scaling-stroke"
                        data-comparison-series={series.key}
                      />
                      {series.values.map((value, day) =>
                        value === null ? null : (
                          <circle
                            key={day}
                            cx={x(day)}
                            cy={y(value)}
                            r={layout === "points" ? 4 : 2.25}
                            fill={colors[index]}
                            className={styles.point}
                            tabIndex={0}
                            role="img"
                            aria-label={`${series.label}, dia ${comparison.days[day]}: ${number.format(value)}`}
                            onMouseEnter={() => setTooltip({ comparison, value, index: day })}
                            onMouseLeave={() => setTooltip(null)}
                            onFocus={() => setTooltip({ comparison, value, index: day })}
                            onBlur={() => setTooltip(null)}
                          />
                        ),
                      )}
                    </g>
                  ))}
                </svg>
                {tooltip &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <output role="tooltip" className={styles.pointTooltip}>
                      {number.format(tooltip.value)}
                    </output>,
                    document.body,
                  )}
              </div>
              <div className={styles.days} aria-label="Dias do mês de referência">
                {comparison.days.map((day, index) => {
                  const holiday = appointmentHoliday(
                    `${comparison.month}-${String(day).padStart(2, "0")}`,
                  );
                  const weekday = new Date(
                    `${comparison.month}-${String(day).padStart(2, "0")}T12:00:00Z`,
                  ).getUTCDay();
                  const weekend = weekday === 0 || weekday === 6;
                  const weekdayLabel = appointmentWeekdayLabel(
                    `${comparison.month}-${String(day).padStart(2, "0")}`,
                  );
                  const dayTitle = holiday
                    ? `${weekdayLabel} — ${appointmentHolidayDescription(holiday)}`
                    : (weekdayLabel ?? undefined);
                  return (
                    <span
                      key={day}
                      data-comparison-day={day}
                      data-comparison-weekend={weekend || undefined}
                      data-comparison-holiday={holiday?.name}
                      className={`${weekend ? styles.weekend : ""} ${holiday ? styles.holiday : ""}`}
                      title={dayTitle}
                      aria-label={`${day}: ${dayTitle}`}
                      style={{ left: `${(x(index) / 720) * 100}%` }}
                    >
                      {String(day).padStart(2, "0")}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
