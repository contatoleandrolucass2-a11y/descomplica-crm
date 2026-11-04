"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { useDashboardBarHeightControl } from "@/lib/dashboard-canvas/ui/configurable/bar-height-controls";
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

export function DailyChartTypeControl() {
  const control = useDashboardBarHeightControl();
  const id = useId();
  return (
    <label className={styles.typeControl} htmlFor={id}>
      <span>Gráfico</span>
      <select
        id={id}
        aria-label="Tipo do gráfico diário"
        value={control?.type ?? "bars"}
        disabled={!control?.onTypeChange}
        onChange={(event) =>
          control?.onTypeChange?.(event.target.value === "line" ? "line" : "bars")
        }
      >
        <option value="bars">Torres</option>
        <option value="line">Linhas: mês, anterior, média anual e trimestre</option>
      </select>
    </label>
  );
}

export function AppointmentsComparison({
  getComparison,
}: {
  getComparison: () => AppointmentComparison | null;
}) {
  const comparison = useMemo(() => getComparison(), [getComparison]);
  const id = useId();
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
  const path = (values: readonly (number | null)[]) => {
    let connected = false;
    return values
      .map((value, index) => {
        if (value === null) {
          connected = false;
          return "";
        }
        const segment = `${connected ? "L" : "M"}${x(index)},${y(value)}`;
        connected = true;
        return segment;
      })
      .join(" ");
  };
  return (
    <div className={styles.comparison} data-appointments-comparison>
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
                    zero. Valores disponíveis na tabela abaixo.
                  </title>
                  {comparison.series.map((series, index) => (
                    <g key={series.key}>
                      <path
                        d={path(series.values)}
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
                            r="3.5"
                            fill={colors[index]}
                            className={styles.point}
                            tabIndex={0}
                            role="img"
                            aria-label={`${series.label}, dia ${comparison.days[day]}: ${number.format(value)}`}
                            onMouseEnter={() => setTooltip({ comparison, value, index: day })}
                            onMouseLeave={() => setTooltip(null)}
                            onFocus={() => setTooltip({ comparison, value, index: day })}
                            onBlur={() => setTooltip(null)}
                          >
                            <title>{number.format(value)}</title>
                          </circle>
                        ),
                      )}
                    </g>
                  ))}
                </svg>
                {tooltip && (
                  <output
                    role="tooltip"
                    className={styles.pointTooltip}
                    style={{
                      left: `calc(1.8rem + (100% - 2.3rem) * ${x(tooltip.index) / 720})`,
                      top: `${(y(tooltip.value) / 300) * 100}%`,
                      transform: y(tooltip.value) < 60 ? "translate(-50%, 0.5rem)" : undefined,
                    }}
                  >
                    {number.format(tooltip.value)}
                  </output>
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
      <details className={styles.details}>
        <summary>Ver valores e cobertura</summary>
        <div>
          <table>
            <caption>Agendamentos por dia dos meses comparados</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                {comparison.series.map((series) => (
                  <th scope="col" key={series.key}>
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.days.map((day, index) => (
                <tr key={day}>
                  <th scope="row">{day}</th>
                  {comparison.series.map((series) => (
                    <td key={series.key}>
                      {series.values[index] === null
                        ? "Sem cobertura"
                        : number.format(series.values[index]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
