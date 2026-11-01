"use client";

import { useId, useMemo } from "react";
import type { DashboardAnalysisSlice } from "@/lib/crm/dashboard/analysis-contract";
import { useDashboardBarHeightControl } from "@/lib/dashboard-canvas/ui/configurable/bar-height-controls";
import { buildAppointmentComparison } from "./appointments-comparison";
import styles from "./AppointmentsComparison.module.css";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const colors = ["var(--analytics-cyan-strong)", "var(--analytics-warning)", "var(--analytics-ink)"];

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
        <option value="line">Linhas: mês, anterior e média anual</option>
      </select>
    </label>
  );
}

export function AppointmentsComparison({
  analysis,
  options,
}: {
  analysis: DashboardAnalysisSlice;
  options: Parameters<typeof buildAppointmentComparison>[1];
}) {
  const { month, filters = {}, brokerRoster = null, goalsByMonth = {} } = options;
  const comparison = useMemo(
    () =>
      buildAppointmentComparison(analysis, {
        month,
        filters,
        brokerRoster,
        goalsByMonth,
      }),
    [analysis, month, filters, brokerRoster, goalsByMonth],
  );
  const id = useId();
  const allValues = comparison.series
    .flatMap((series) => series.values)
    .filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...allValues);
  const ceiling = maximum * 1.08;
  const x = (index: number) => 8 + (index / 30) * 704;
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
          <div className={styles.plot}>
            <span className={styles.maximum} style={{ top: `${(y(maximum) / 300) * 100}%` }}>
              {number.format(maximum)}
            </span>
            <span className={styles.zero} style={{ top: `${(y(0) / 300) * 100}%` }}>
              0
            </span>
            <svg viewBox="0 0 720 300" preserveAspectRatio="none" role="img" aria-labelledby={id}>
              <title id={id}>
                Comparação por dia do mês. Meses sem cobertura e dias inexistentes não recebem zero.
                Valores disponíveis na tabela abaixo.
              </title>
              {comparison.series.map((series, index) => (
                <g key={series.key}>
                  <path
                    d={path(series.values)}
                    fill="none"
                    stroke={colors[index]}
                    strokeWidth="2.5"
                    strokeDasharray={index === 0 ? undefined : index === 1 ? "7 4" : "2 4"}
                    vectorEffect="non-scaling-stroke"
                    data-comparison-series={series.key}
                  />
                  {series.values.map((value, day) =>
                    value === null ? null : (
                      <circle key={day} cx={x(day)} cy={y(value)} r="2.5" fill={colors[index]}>
                        <title>{`${series.label}, dia ${day + 1}: ${number.format(value)}`}</title>
                      </circle>
                    ),
                  )}
                </g>
              ))}
            </svg>
          </div>
          <div className={styles.days} aria-hidden="true">
            {[1, 5, 10, 15, 20, 25, 31].map((day) => (
              <span
                key={day}
                data-comparison-day={day}
                style={{ left: `${(x(day - 1) / 720) * 100}%` }}
              >
                {String(day).padStart(2, "0")}
              </span>
            ))}
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
