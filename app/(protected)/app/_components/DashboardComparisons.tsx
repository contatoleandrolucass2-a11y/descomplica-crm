import type { OperationalComparison } from "@/lib/crm/dashboard/presentation";

import styles from "./DashboardComparisons.module.css";

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const periods = [
  { key: "month", label: "Mês" },
  { key: "fourteen-days", label: "Últimos 14 dias" },
  { key: "seven-days", label: "Últimos 7 dias" },
  { key: "week", label: "Esta Semana" },
  { key: "day", label: "Hoje" },
] as const satisfies ReadonlyArray<Pick<OperationalComparison, "key" | "label">>;

function numberValue(value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return numberFormatter.format(value);

  const reason = "Dados indisponíveis para este intervalo.";
  return (
    <span className={styles.unavailable} title={reason} aria-label={`Indisponível: ${reason}`}>
      Indisponível
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
    <div className={styles.scroll} role="region" aria-label={`${label}: períodos`} tabIndex={0}>
      <table className={styles.table} role="table">
        <caption className={styles.caption}>{`${label}: realizado por intervalo`}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Indicador
            </th>
            {periods.map((period) => (
              <th key={period.key} scope="col" role="columnheader">
                {period.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row">
            <th scope="row" role="rowheader">
              Realizado
            </th>
            {periods.map((period) => (
              <td key={period.key} role="cell">
                <b className={styles.value}>
                  {numberValue(rows.find((row) => row.key === period.key)?.current)}
                </b>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
