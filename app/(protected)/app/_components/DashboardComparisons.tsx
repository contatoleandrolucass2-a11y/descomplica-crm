import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import type { OperationalComparison } from "@/lib/crm/dashboard/presentation";

import styles from "./DashboardComparisons.module.css";

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

function available(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function unavailable(reason: string) {
  return (
    <span className={styles.unavailable} title={reason} aria-label={`Indisponível: ${reason}`}>
      Indisponível
    </span>
  );
}

function numberValue(value: number | null, reason = "Dados indisponíveis para este intervalo.") {
  return available(value) ? numberFormatter.format(value) : unavailable(reason);
}

function Variation({ value }: { value: number | null }) {
  if (!available(value)) return unavailable("Sem base anterior suficiente para comparação.");

  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;

  return (
    <span className={styles.variation} data-direction={direction}>
      <Icon size={14} aria-hidden="true" focusable="false" />
      <span>{`${value > 0 ? "+" : ""}${percentFormatter.format(value)}`}</span>
    </span>
  );
}

export function DashboardComparisons({
  label,
  rows,
}: {
  label: string;
  rows: OperationalComparison[];
}) {
  return (
    <table className={styles.table} role="table">
      <caption className={styles.caption}>
        {`${label}: realizado, comparação e meta por intervalo`}
      </caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">
            Intervalo
          </th>
          <th scope="col" role="columnheader">
            Anterior
          </th>
          <th scope="col" role="columnheader" className={styles.current}>
            Realizado
          </th>
          <th scope="col" role="columnheader">
            Variação
          </th>
          <th scope="col" role="columnheader">
            Meta
          </th>
          <th scope="col" role="columnheader">
            % realizado da meta
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={row.key} role="row">
            <th scope="row" role="rowheader" data-label="Intervalo">
              <strong className={styles.interval}>{row.label}</strong>
              <span className={styles.comparison}>{row.comparison}</span>
            </th>
            <td role="cell" data-label="Anterior">
              <span className={styles.value}>{numberValue(row.previous)}</span>
            </td>
            <td role="cell" data-label="Realizado" className={styles.current}>
              <b className={styles.value}>{numberValue(row.current)}</b>
            </td>
            <td role="cell" data-label="Variação">
              <span className={styles.value}>
                <Variation value={row.variation} />
              </span>
            </td>
            <td role="cell" data-label="Meta">
              <span className={styles.value}>
                {numberValue(row.goal, "Meta indisponível para este intervalo.")}
              </span>
            </td>
            <td role="cell" data-label="% realizado da meta">
              <span className={styles.value}>
                {available(row.goalProgress)
                  ? percentFormatter.format(row.goalProgress)
                  : unavailable("Sem base suficiente para calcular a relação.")}
              </span>
            </td>
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr role="row">
            <td role="cell" colSpan={6} className={styles.empty}>
              Nenhum intervalo disponível.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
